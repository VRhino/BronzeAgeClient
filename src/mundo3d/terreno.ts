// El suelo, por teselas de 64 u alrededor del héroe: se construyen las que caen a la vista, las más cercanas primero, y se sueltan las que se
// quedan lejos. Cerca van a 0,5 u (las muestras del paquete de relieve), más lejos a 1 y a 2 u; un faldón en el borde de cada tesela tapa las
// grietas entre niveles. Color por clase de terreno (los umbrales del generador), verde donde el suelo es fértil (el raster de fertilidad del
// artefacto) y por manchas, roca en las laderas y sotobosque donde hay bosque. Donde hay agua (mar o lago) el fondo baja desde la orilla y
// encima va su lámina (`agua.ts`).
import * as THREE from 'three';
import type { MapaGenerado } from '../terreno';
import { AGUA, colorDelFondo, distanciaATierra, laminaDeAgua, mascaraSuave, nivelDelAgua, sueloJuntoAlAgua } from './agua';
import { MUNDO3D } from './config';
import { bosqueEn, fertilidadEn, type FuenteDeAltura } from './fuente';
import { manchas } from './ruido';
import type { NieblaDeGuerra } from './niebla';
import type { Territorio } from './territorio';

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
  sotobosque: lineal(0.36, 0.44, 0.25),
  pasto: lineal(0.5, 0.58, 0.31),
  pastoRico: lineal(0.39, 0.5, 0.24),
};
/** Un número fijo entre 0 y 1 por punto de la rejilla, para variar un poco el color y que el suelo no se vea liso. */
const ruido = (x: number, y: number): number => {
  let h = Math.imul(Math.round(x * 2) | 0, 374761393) ^ Math.imul(Math.round(y * 2) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const suave = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/** El color de un punto (x, y) del suelo: clase por altura (en metros); pasto según la fertilidad `f` (0..1), por manchas de unas 12 u, más
 * ralo junto al mar y nada en la montaña; roca por pendiente (m/m) y sotobosque por densidad de bosque. */
export function colorDelSuelo(h: number, pendiente: number, bosque: number, f = 0, x = 0, y = 0): [number, number, number] {
  let c =
    h < U.costa ? mezcla(PAL.costa, PAL.llano, suave(U.agua, U.costa, h))
    : h < U.colina ? mezcla(PAL.llano, PAL.colina, suave(U.colina - 40, U.colina, h))
    : h < U.montana ? mezcla(PAL.colina, PAL.montana, suave(U.montana - 20, U.montana, h))
    : h < U.cima ? mezcla(PAL.montana, PAL.cima, suave(U.cima - 15, U.cima + 10, h))
    : PAL.cima;
  const mancha = manchas(x, y, 12, 5), verdor = suave(0.15, 0.75, f + (mancha - 0.5) * 0.3) * suave(U.agua + 8, U.agua + 30, h) * (1 - suave(U.montana - 25, U.montana + 15, h));
  c = mezcla(c, mezcla(PAL.pasto, PAL.pastoRico, suave(0.55, 0.95, f)), 0.8 * verdor);
  const luz = 0.95 + 0.1 * manchas(x, y, 5, 9);
  c = [c[0] * luz, c[1] * luz, c[2] * luz];
  c = mezcla(c, PAL.roca, suave(0.45, 0.9, pendiente));
  return mezcla(c, PAL.sotobosque, 0.55 * suave(0.15, 0.6, bosque));
}

/** La malla de la tesela (tx, ty) con muestras cada `paso` u, y su lámina de agua si la tiene. */
function mallaDeTesela(fuente: FuenteDeAltura, mapa: MapaGenerado, tx: number, ty: number, paso: number, material: THREE.Material, materialAgua: THREE.Material): { suelo: THREE.Mesh; agua: THREE.Mesh | null } {
  const n = Math.round(LADO / paso) + 1, x0 = tx * LADO, y0 = ty * LADO, m = n + 2;
  // alturas con un anillo de más alrededor, para las normales del borde
  const h = new Float32Array(m * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) h[j * m + i] = fuente.alturaEn(x0 + (i - 1) * paso, y0 + (j - 1) * paso);
  // El agua: en una ventana con `orilla` u de margen, cada muestra de agua sabe a qué distancia queda la tierra y cada muestra cuánta agua tiene
  // alrededor (la máscara suave); el fondo baja desde la orilla, la tierra de junto al agua baja hacia ella (sin hundirse) y la lámina va a su
  // nivel. `nivel` es NaN en tierra; en u, como la malla.
  const M = Math.ceil(AGUA.orilla / paso), W = n + 2 * M, enVentana = new Uint8Array(W * W);
  const xv = (i: number) => x0 + (i - M) * paso, yv = (j: number) => y0 + (j - M) * paso;
  let hayAgua = false;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) if (fuente.aguaEn(xv(i), yv(j))) { enVentana[j * W + i] = 1; hayAgua = true; }
  const nivel = new Float32Array(m * m).fill(Number.NaN);
  if (hayAgua) {
    const dist = distanciaATierra(enVentana, W, W), b = mascaraSuave(enVentana, W, W);
    // el nivel de la lámina junto a una muestra de tierra: el de la muestra de agua más cercana de su alrededor
    const nivelCerca = (i: number, j: number): number => {
      for (let r = 1; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const a = i + di, c = j + dj;
        if (a >= 0 && c >= 0 && a < W && c < W && enVentana[c * W + a]) return nivelDelAgua(fuente.alturaEn(xv(a), yv(c)));
      }
      return Number.NaN;
    };
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const iv = i - 1 + M, jv = j - 1 + M, v = jv * W + iv, k = j * m + i, agua = enVentana[v] === 1;
        if (!agua && !b[v]) continue;
        const sobre = agua ? nivelDelAgua(h[k]!) : nivelCerca(iv, jv);
        if (Number.isNaN(sobre)) continue;
        if (agua) nivel[k] = sobre / MPU;
        h[k] = sueloJuntoAlAgua(h[k]!, sobre, agua, b[v]!, dist[v]! * paso);
      }
    }
  }
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
      const cubre = nivel[c]! - alt / MPU;
      const base = cubre >= 0 ? colorDelFondo(cubre) : colorDelSuelo(alt, Math.hypot(dx, dz), bosqueEn(mapa, x, y), fertilidadEn(mapa, x, y), x, y), v = 0.95 + 0.08 * ruido(x, y);
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
  if (!hayAgua) return { suelo: malla, agua: null };
  // la lámina: el nivel y el fondo de los vértices de la tesela (sin el anillo)
  const nv = new Float32Array(n * n), fondo = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = (j + 1) * m + (i + 1); nv[j * n + i] = nivel[c]!; fondo[j * n + i] = h[c]! / MPU; }
  const lamina = laminaDeAgua(n, paso, x0, y0, nv, fondo);
  if (!lamina) return { suelo: malla, agua: null };
  const agua = new THREE.Mesh(lamina, materialAgua);
  agua.receiveShadow = true;
  agua.matrixAutoUpdate = false;
  agua.renderOrder = 1;
  return { suelo: malla, agua };
}

/** Ruido de valor en GLSL (0..1), para el grano del suelo. Las coordenadas se pliegan para no perder precisión lejos del origen. */
const GRANO = `
float azarSuelo(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grano(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(azarSuelo(i), azarSuelo(i + vec2(1.0, 0.0)), u.x), mix(azarSuelo(i + vec2(0.0, 1.0)), azarSuelo(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

/** El material del suelo: el color de cada vértice con un grano fino encima (manchas de 0,1 a 1 u más claras u oscuras, y a trozos más
 * amarillas o más verdes), que de cerca quita lo liso y de lejos se apaga. Lleva el tinte del territorio y va bajo la niebla de guerra. */
function materialDelSuelo(niebla: NieblaDeGuerra, territorio: Territorio): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec2 vSueloXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vSueloXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
    sh.fragmentShader = 'varying vec2 vSueloXZ;\n' + GRANO + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float lejos = smoothstep(20.0, 70.0, length(vViewPosition));
        float g = grano(vSueloXZ * 2.3) * 0.55 + grano(vSueloXZ * 8.0 + 31.0) * 0.45, t = grano(vSueloXZ * 0.8 + 17.0) - 0.5;
        vec3 c = diffuseColor.rgb * (0.86 + 0.28 * g) * vec3(1.0 + t * 0.1, 1.0, 1.0 - t * 0.14);
        diffuseColor.rgb = mix(c, diffuseColor.rgb, lejos * 0.75);
      }`);
    territorio.parchear(sh);
    niebla.parchear(sh);
  };
  m.customProgramCacheKey = () => 'suelo-grano-territorio';
  return m;
}

export class Terreno {
  readonly grupo = new THREE.Group();
  private readonly material: THREE.MeshLambertMaterial;
  private readonly teselas = new Map<string, { malla: THREE.Mesh; agua: THREE.Mesh | null; paso: number }>();

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra, private readonly materialAgua: THREE.Material, territorio: Territorio) {
    this.material = materialDelSuelo(niebla, territorio);
  }

  /** Cuánto detalle (×1 con la distancia de carga de serie): con una distancia de carga más corta, el detalle fino llega menos lejos. */
  escalaDetalle = 1;

  /** El paso al que va una tesela a `d` u del centro: 0,5 u hasta 80 u, 1 u hasta 160 u y 2 u más allá (por `escalaDetalle`, sin bajar de 32 y
   * 64 u). */
  private pasoA(d: number): number {
    const base = this.fuente.paso, k = this.escalaDetalle;
    return Math.max(base, d < Math.max(32, 80 * k) ? 0.5 : d < Math.max(64, 160 * k) ? 1 : 2);
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
      const { suelo: malla, agua } = mallaDeTesela(this.fuente, this.mapa, t.tx, t.ty, t.paso, this.material, this.materialAgua);
      this.soltar(clave);
      this.grupo.add(malla);
      if (agua) this.grupo.add(agua);
      this.teselas.set(clave, { malla, agua, paso: t.paso });
      hechas++;
    }
    return pendientes.length - hechas;
  }

  private soltar(clave: string): void {
    const t = this.teselas.get(clave);
    if (!t) return;
    this.grupo.remove(t.malla);
    t.malla.geometry.dispose();
    if (t.agua) { this.grupo.remove(t.agua); t.agua.geometry.dispose(); }
    this.teselas.delete(clave);
  }

  destruir(): void {
    for (const clave of [...this.teselas.keys()]) this.soltar(clave);
    this.material.dispose();
  }
}
