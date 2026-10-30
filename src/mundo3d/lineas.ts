// Líneas pegadas al relieve: la ruta de la columna, el aro del destino y, más adelante, caminos, fronteras y zonas.
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
