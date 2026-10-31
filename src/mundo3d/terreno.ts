// El suelo, por teselas de 64 u alrededor del héroe: se construyen las que caen a la vista, las más cercanas primero, y se sueltan las que se
// quedan lejos. Cerca van a 0,5 u (las muestras del paquete de relieve), más lejos a 1 y a 2 u; un faldón en el borde de cada tesela tapa las
// grietas entre niveles. Color por clase de terreno (los umbrales del generador), roca en las laderas, sotobosque donde hay bosque y agua.
import * as THREE from 'three';
import type { MapaGenerado } from '../terreno';
import { MUNDO3D } from './config';
import { bosqueEn, type FuenteDeAltura } from './fuente';
import type { NieblaDeGuerra } from './niebla';

const { metrosPorUnidad: MPU, ladoTesela: LADO, umbrales: U } = MUNDO3D;
/** Lo que baja el faldón del borde de cada tesela. */
const FALDON = 3;

/** Un color sRGB (0..1) en el espacio lineal en que se mezclan los colores de vértice. */
const lineal = (r: number, g: number, b: number): [number, number, number] => {
  const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
};
const PAL = {
  costa: lineal(0.8, 0.76, 0.56),
  llano: lineal(0.72, 0.69, 0.47),
  colina: lineal(0.58, 0.57, 0.38),
  montana: lineal(0.53, 0.47, 0.39),
  cima: lineal(0.76, 0.74, 0.7),
  roca: lineal(0.47, 0.43, 0.39),
  agua: lineal(0.27, 0.46, 0.6),
  sotobosque: lineal(0.36, 0.44, 0.25),
};
/** Un número fijo entre 0 y 1 por punto de la rejilla, para variar un poco el color y que el suelo no se vea liso. */
const ruido = (x: number, y: number): number => {
  let h = Math.imul(Math.round(x * 2) | 0, 374761393) ^ Math.imul(Math.round(y * 2) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const suave = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/** El color de un punto del suelo: clase por altura (en metros), roca por pendiente (m/m) y sotobosque por densidad de bosque. */
function colorDelSuelo(h: number, pendiente: number, bosque: number): [number, number, number] {
  let c =
    h < U.costa ? mezcla(PAL.costa, PAL.llano, suave(U.agua, U.costa, h))
    : h < U.colina ? mezcla(PAL.llano, PAL.colina, suave(U.colina - 40, U.colina, h))
    : h < U.montana ? mezcla(PAL.colina, PAL.montana, suave(U.montana - 20, U.montana, h))
    : h < U.cima ? mezcla(PAL.montana, PAL.cima, suave(U.cima - 15, U.cima + 10, h))
    : PAL.cima;
  c = mezcla(c, PAL.roca, suave(0.45, 0.9, pendiente));
  return mezcla(c, PAL.sotobosque, 0.55 * suave(0.15, 0.6, bosque));
}

/** La malla de la tesela (tx, ty) con muestras cada `paso` u. */
function mallaDeTesela(fuente: FuenteDeAltura, mapa: MapaGenerado, tx: number, ty: number, paso: number, material: THREE.Material): THREE.Mesh {
  const n = Math.round(LADO / paso) + 1, x0 = tx * LADO, y0 = ty * LADO, m = n + 2;
  // alturas con un anillo de más alrededor, para las normales del borde
  const h = new Float32Array(m * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) h[j * m + i] = fuente.alturaEn(x0 + (i - 1) * paso, y0 + (j - 1) * paso);
  const perimetro = 4 * (n - 1), total = n * n + perimetro;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i, c = (j + 1) * m + (i + 1), x = x0 + i * paso, y = y0 + j * paso, alt = h[c]!;
      // normal y pendiente por diferencias centradas, en unidades de escena
      const dx = (h[c + 1]! - h[c - 1]!) / MPU / (2 * paso), dz = (h[c + m]! - h[c - m]!) / MPU / (2 * paso);
      const l = Math.hypot(dx, 1, dz);
      pos.set([x, alt / MPU, y], 3 * k);
      nor.set([-dx / l, 1 / l, -dz / l], 3 * k);
      const base = fuente.aguaEn(x, y) ? PAL.agua : colorDelSuelo(alt, Math.hypot(dx, dz), bosqueEn(mapa, x, y)), v = 0.93 + 0.12 * ruido(x, y);
      col.set([base[0] * v, base[1] * v, base[2] * v], 3 * k);
    }
  }
  // el faldón: cada vértice del borde, repetido más abajo
  const borde: number[] = [];
  for (let i = 0; i < n - 1; i++) borde.push(i);
  for (let j = 0; j < n - 1; j++) borde.push(j * n + n - 1);
  for (let i = n - 1; i > 0; i--) borde.push((n - 1) * n + i);
  for (let j = n - 1; j > 0; j--) borde.push(j * n);
  borde.forEach((k, b) => {
    const d = n * n + b;
    pos.set([pos[3 * k]!, pos[3 * k + 1]! - FALDON, pos[3 * k + 2]!], 3 * d);
    nor.set(nor.subarray(3 * k, 3 * k + 3), 3 * d);
    col.set(col.subarray(3 * k, 3 * k + 3), 3 * d);
  });
  const indices: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  for (let b = 0; b < perimetro; b++) {
    const a = borde[b]!, s = borde[(b + 1) % perimetro]!, a2 = n * n + b, s2 = n * n + ((b + 1) % perimetro);
    indices.push(a, a2, s, s, a2, s2, a, s, a2, s, s2, a2); // las dos caras: el faldón se ve desde fuera y desde dentro
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  const malla = new THREE.Mesh(geo, material);
  malla.receiveShadow = true;
  malla.matrixAutoUpdate = false;
  return malla;
}

export class Terreno {
  readonly grupo = new THREE.Group();
  private readonly material: THREE.MeshLambertMaterial;
  private readonly teselas = new Map<string, { malla: THREE.Mesh; paso: number }>();

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra) {
    this.material = niebla.aplicar(new THREE.MeshLambertMaterial({ vertexColors: true }));
  }

  /** El paso al que va una tesela a `d` u del centro. */
  private pasoA(d: number): number {
    const base = this.fuente.paso;
    return Math.max(base, d < 80 ? 0.5 : d < 160 ? 1 : 2);
  }

  /** Pide las teselas a menos de `alcance` u de (cx, cy) y suelta las que quedan más lejos. Construye las más cercanas primero mientras quede
   * tiempo (`hasta`, en `performance.now()`), al menos una. Devuelve cuántas faltan. */
  actualizar(cx: number, cy: number, alcance: number, hasta: number): number {
    const maxX = Math.ceil(this.fuente.ancho / LADO) - 1, maxY = Math.ceil(this.fuente.alto / LADO) - 1;
    const quiero = new Map<string, { tx: number; ty: number; d: number; paso: number }>();
    for (let ty = Math.max(0, Math.floor((cy - alcance) / LADO)); ty <= Math.min(maxY, Math.floor((cy + alcance) / LADO)); ty++) {
      for (let tx = Math.max(0, Math.floor((cx - alcance) / LADO)); tx <= Math.min(maxX, Math.floor((cx + alcance) / LADO)); tx++) {
        // distancia del centro al punto más cercano de la tesela
        const dx = Math.max(tx * LADO - cx, 0, cx - (tx + 1) * LADO), dy = Math.max(ty * LADO - cy, 0, cy - (ty + 1) * LADO), d = Math.hypot(dx, dy);
        if (d <= alcance) quiero.set(`${tx},${ty}`, { tx, ty, d, paso: this.pasoA(d) });
      }
    }
    for (const [clave, t] of this.teselas) {
      if (quiero.get(clave)?.paso === t.paso) continue;
      if (quiero.has(clave)) continue; // otro nivel de detalle: se cambia cuando esté la nueva
      this.soltar(clave);
    }
    const pendientes = [...quiero.entries()].filter(([clave, t]) => this.teselas.get(clave)?.paso !== t.paso).sort((a, b) => a[1].d - b[1].d);
    let hechas = 0;
    for (const [clave, t] of pendientes) {
      if (hechas && performance.now() > hasta) break;
      const malla = mallaDeTesela(this.fuente, this.mapa, t.tx, t.ty, t.paso, this.material);
      this.soltar(clave);
      this.grupo.add(malla);
      this.teselas.set(clave, { malla, paso: t.paso });
      hechas++;
    }
    return pendientes.length - hechas;
  }

  private soltar(clave: string): void {
    const t = this.teselas.get(clave);
    if (!t) return;
    this.grupo.remove(t.malla);
    t.malla.geometry.dispose();
    this.teselas.delete(clave);
  }

  destruir(): void {
    for (const clave of [...this.teselas.keys()]) this.soltar(clave);
    this.material.dispose();
  }
}
