// Líneas pegadas al relieve: la ruta de la columna y el aro del destino (líneas finas) y las cintas con anchura de verdad de ríos, vados,
// caminos, fronteras y zonas.
import * as THREE from 'three';

type Punto = { x: number; y: number };

/** Los puntos de una polilínea muestreados cada `paso` u y subidos `dy` sobre el suelo (`alturaU`, en unidades de escena). */
export function pegarAlSuelo(puntos: readonly Punto[], alturaU: (x: number, y: number) => number, paso = 0.5, dy = 0.12): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let k = 0; k < puntos.length; k++) {
    const b = puntos[k]!;
    if (k === 0) { out.push(new THREE.Vector3(b.x, alturaU(b.x, b.y) + dy, b.y)); continue; }
    const a = puntos[k - 1]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / paso));
    for (let s = 1; s <= n; s++) {
      const x = a.x + ((b.x - a.x) * s) / n, y = a.y + ((b.y - a.y) * s) / n;
      out.push(new THREE.Vector3(x, alturaU(x, y) + dy, y));
    }
  }
  return out;
}

/** Una línea pegada al suelo. */
export function linea(puntos: readonly Punto[], alturaU: (x: number, y: number) => number, material: THREE.LineBasicMaterial, dy = 0.12): THREE.Line {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pegarAlSuelo(puntos, alturaU, 0.5, dy)), material);
}

/** Un aro de radio `r` pegado al suelo. */
export function aro(centro: Punto, r: number, alturaU: (x: number, y: number) => number, material: THREE.LineBasicMaterial, dy = 0.14): THREE.Line {
  const n = Math.max(24, Math.ceil(r * 12)), pts: Punto[] = [];
  for (let k = 0; k <= n; k++) pts.push({ x: centro.x + r * Math.cos((k / n) * Math.PI * 2), y: centro.y + r * Math.sin((k / n) * Math.PI * 2) });
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pegarAlSuelo(pts, alturaU, Math.max(0.1, r / 20), dy)), material);
}

/** Lo que queda por andar de una ruta: desde el tramo más cercano a `donde` hasta el final. */
export function rutaPendiente(ruta: readonly Punto[], donde: Punto): Punto[] {
  if (ruta.length < 2) return [];
  let mejor = 0, dist = Infinity;
  for (let k = 1; k < ruta.length; k++) {
    const a = ruta[k - 1]!, b = ruta[k]!, dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((donde.x - a.x) * dx + (donde.y - a.y) * dy) / l)) : 0;
    const d = Math.hypot(donde.x - a.x - t * dx, donde.y - a.y - t * dy);
    if (d < dist) { dist = d; mejor = k; }
  }
  return [donde, ...ruta.slice(mejor)];
}

export interface OpcionesCinta {
  /** Lo que sube sobre el suelo, en u. */
  dy?: number;
  /** `'bajo'`: la cinta va plana a la altura del punto más bajo del corte (el agua en su cauce). `'encima'` (por defecto): cada borde sobre su
   * suelo, y toda ella por encima del centro (un camino o una raya que no se hunde en la ladera ni en un lomo). */
  asiento?: 'bajo' | 'encima';
  /** [lleno, hueco] en u, para una raya discontinua. */
  trazo?: readonly [number, number];
  /** Cada cuánto se muestrea, en u. */
  paso?: number;
  /** Corre la cinta de lado, en u: positivo hacia la izquierda del sentido de los puntos (el interior de un contorno antihorario). */
  desplazar?: number;
  /** Con coordenadas de textura: `u` de 0 (izquierda) a 1 (derecha) de lado a lado y `v` = lo recorrido / `periodo` (lo que ocupa una vez la
   * textura a lo largo, en u), contando desde `desde` u (lo andado antes del primer punto: así un tramo recortado no corre la textura). */
  textura?: { periodo: number; desde?: number };
}

/** Una cinta de `ancho` u a lo largo de `puntos`, pegada al relieve: una muestra cada `paso` u con un vértice a cada lado. Las caras miran
 * arriba. `null` si no hay tramo. */
export function cinta(puntos: readonly Punto[], alturaU: (x: number, y: number) => number, ancho: number, o: OpcionesCinta = {}): THREE.BufferGeometry | null {
  const paso = o.paso ?? 0.5, dy = o.dy ?? 0.05, medio = ancho / 2;
  // las muestras, con lo recorrido hasta cada una (para la raya discontinua)
  const xs: number[] = [], ys: number[] = [], s: number[] = [];
  let recorrido = 0;
  for (let k = 0; k < puntos.length; k++) {
    const b = puntos[k]!;
    if (k === 0) { xs.push(b.x); ys.push(b.y); s.push(0); continue; }
    const a = puntos[k - 1]!, l = Math.hypot(b.x - a.x, b.y - a.y);
    if (!l) continue;
    const n = Math.max(1, Math.ceil(l / paso));
    for (let i = 1; i <= n; i++) { xs.push(a.x + ((b.x - a.x) * i) / n); ys.push(a.y + ((b.y - a.y) * i) / n); s.push(recorrido + (l * i) / n); }
    recorrido += l;
  }
  const m = xs.length;
  if (m < 2) return null;
  const pos = new Float32Array(m * 6), nor = new Float32Array(m * 6), uv = o.textura ? new Float32Array(m * 4) : null;
  for (let k = 0; k < m; k++) {
    if (uv) { const v = ((o.textura!.desde ?? 0) + s[k]!) / o.textura!.periodo; uv.set([0, v, 1, v], 4 * k); }
    const a = Math.max(0, k - 1), b = Math.min(m - 1, k + 1), tx = xs[b]! - xs[a]!, ty = ys[b]! - ys[a]!, l = Math.hypot(tx, ty) || 1;
    const ux = -ty / l, uy = tx / l, nx = ux * medio, ny = uy * medio, x = xs[k]! + ux * (o.desplazar ?? 0), y = ys[k]! + uy * (o.desplazar ?? 0);
    const hc = alturaU(x, y), hi = alturaU(x + nx, y + ny), hd = alturaU(x - nx, y - ny);
    let izq: number, der: number;
    if (o.asiento === 'bajo') izq = der = Math.min(hc, hi, hd);
    else { const subir = Math.max(0, hc - (hi + hd) / 2); izq = hi + subir; der = hd + subir; }
    pos.set([x + nx, izq + dy, y + ny, x - nx, der + dy, y - ny], 6 * k);
    nor.set([0, 1, 0, 0, 1, 0], 6 * k);
  }
  const indices: number[] = [];
  for (let k = 1; k < m; k++) {
    if (o.trazo) {
      const ciclo = o.trazo[0] + o.trazo[1];
      if (((s[k - 1]! + s[k]!) / 2) % ciclo > o.trazo[0]) continue;
    }
    const a = 2 * (k - 1);
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); // vistas desde arriba, en el sentido contrario a las agujas: de frente
  }
  if (!indices.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/** El signo del área de un contorno en (x, y): 1 si va en sentido antihorario (su interior queda a la izquierda), -1 si no. */
export function sentidoDe(puntos: readonly Punto[]): 1 | -1 {
  let a = 0;
  for (let k = 0; k < puntos.length; k++) {
    const p = puntos[k]!, q = puntos[(k + 1) % puntos.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a >= 0 ? 1 : -1;
}

/** Los puntos de un círculo (cerrado: el último repite el primero). */
export function circulo(centro: Punto, r: number, lados = Math.max(24, Math.ceil(r * 6))): Punto[] {
  const out: Punto[] = [];
  for (let k = 0; k <= lados; k++) out.push({ x: centro.x + r * Math.cos((k / lados) * Math.PI * 2), y: centro.y + r * Math.sin((k / lados) * Math.PI * 2) });
  return out;
}

/** Los tramos de una polilínea que caen en la caja [x0, x1] × [y0, y1]: los segmentos con algún extremo dentro, seguidos, así cada tramo
 * llega hasta el vértice de fuera. */
export function tramosEnCaja(puntos: readonly Punto[], x0: number, y0: number, x1: number, y1: number): Punto[][] {
  const dentro = (p: Punto) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  const out: Punto[][] = [];
  let actual: Punto[] = [];
  for (let k = 1; k < puntos.length; k++) {
    const a = puntos[k - 1]!, b = puntos[k]!;
    if (dentro(a) || dentro(b)) {
      if (!actual.length) actual.push(a);
      actual.push(b);
    } else if (actual.length) {
      out.push(actual);
      actual = [];
    }
  }
  if (actual.length) out.push(actual);
  return out;
}

/** Lo largo de una polilínea hasta cada vértice. */
export function recorridos(puntos: readonly Punto[]): number[] {
  const out = [0];
  for (let k = 1; k < puntos.length; k++) out.push(out[k - 1]! + Math.hypot(puntos[k]!.x - puntos[k - 1]!.x, puntos[k]!.y - puntos[k - 1]!.y));
  return out;
}

/** Ramer-Douglas-Peucker: quita los vértices que se apartan menos de `tolerancia` u de la recta entre los que se quedan. Los extremos, siempre. */
export function simplificar(puntos: readonly Punto[], tolerancia: number): Punto[] {
  if (puntos.length < 3) return [...puntos];
  const queda = new Uint8Array(puntos.length);
  queda[0] = queda[puntos.length - 1] = 1;
  const pila: [number, number][] = [[0, puntos.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop()!;
    const a = puntos[i]!, b = puntos[j]!, dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    let peor = -1, max = tolerancia;
    for (let k = i + 1; k < j; k++) {
      const q = puntos[k]!, d = l ? Math.abs((q.x - a.x) * dy - (q.y - a.y) * dx) / l : Math.hypot(q.x - a.x, q.y - a.y);
      if (d > max) { max = d; peor = k; }
    }
    if (peor >= 0) { queda[peor] = 1; pila.push([i, peor], [peor, j]); }
  }
  return puntos.filter((_, k) => queda[k]);
}

/** Chaikin: en cada vuelta, cada esquina se corta por un cuarto de sus dos tramos (como mucho `corteMax` u). Los extremos no se mueven. */
export function chaikin(puntos: readonly Punto[], vueltas: number, corteMax: number): Punto[] {
  let ps = [...puntos];
  for (let v = 0; v < vueltas && ps.length >= 3; v++) {
    const out: Punto[] = [ps[0]!];
    for (let k = 0; k < ps.length - 1; k++) {
      const a = ps[k]!, b = ps[k + 1]!, l = Math.hypot(b.x - a.x, b.y - a.y), t = l ? Math.min(0.25, corteMax / l) : 0;
      if (k > 0) out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      if (k < ps.length - 2) out.push({ x: b.x - (b.x - a.x) * t, y: b.y - (b.y - a.y) * t });
    }
    out.push(ps[ps.length - 1]!);
    ps = out;
  }
  return ps;
}

/** El trazado de un camino tal como se pinta. El servidor lo manda nodo a nodo de su red (cada 4 u, en ocho direcciones): una escalera. Se pasa
 * por el punto medio de cada tramo (que sigue sobre la red), se quitan los vértices que no doblan y se redondean las curvas; los extremos, que
 * es donde se juntan los caminos, no se mueven. */
export function suavizarCamino(puntos: readonly Punto[]): Punto[] {
  if (puntos.length < 3) return [...puntos];
  const medios: Punto[] = [puntos[0]!];
  for (let k = 1; k < puntos.length; k++) medios.push({ x: (puntos[k - 1]!.x + puntos[k]!.x) / 2, y: (puntos[k - 1]!.y + puntos[k]!.y) / 2 });
  medios.push(puntos[puntos.length - 1]!);
  return chaikin(simplificar(medios, 0.3), 3, 1.5);
}
