// El aspecto de los caminos del mundo 3D (Víctor, 2026-11-02: «que parezcan caminos y no una línea fea»): una textura por escalón, pintada una
// vez píxel a píxel. El sendero es una huella de tierra pisada que serpentea; el camino, tierra con dos rodadas y algo de hierba en medio. En el
// mundo abierto no hay nada más allá del camino de tierra (Víctor, 2026-11-03: en la Edad del Bronce aún no había calzadas): el escalón más
// alto del servidor se pinta como camino. Los bordes se funden con el suelo. Va de lado a lado de la cinta una vez (`u`) y se repite a lo largo
// (`v` = lo andado / `periodoDeCamino`), con la misma escala en los dos sentidos para que nada se estire.
import * as THREE from 'three';

/** 0 sendero, 1 camino de tierra. */
export type Escalon = 0 | 1;

const ANCHO_PX = 128, LARGO_PX = 512;

/** Lo que ocupa a lo largo una vez la textura de un camino de `ancho` u. */
export const periodoDeCamino = (ancho: number): number => (ancho * LARGO_PX) / ANCHO_PX;

type Rgba = [number, number, number, number];

/** Pseudoaleatorio con semilla (mulberry32): la textura sale siempre igual. */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Una curva suave de −1 a 1 que se repite a lo largo (v en [0, 1)): `n` armónicos enteros con fases al azar. */
function ondas(r: () => number, n: number): (v: number) => number {
  const fases = Array.from({ length: n }, () => r() * Math.PI * 2), amplitudes = Array.from({ length: n }, (_, k) => (0.4 + 0.6 * r()) / (k + 1));
  const total = amplitudes.reduce((s, a) => s + a, 0);
  return (v) => {
    let s = 0;
    for (let k = 0; k < n; k++) s += amplitudes[k]! * Math.sin(2 * Math.PI * (k + 1) * v + fases[k]!);
    return s / total;
  };
}

/** Ruido de valor de −1 a 1 en una rejilla de `cx` × `cy` celdas; se repite a lo largo (y). x e y en [0, 1). */
function grano(r: () => number, cx: number, cy: number): (x: number, y: number) => number {
  const valores = Float32Array.from({ length: (cx + 1) * cy }, () => r() * 2 - 1);
  const en = (i: number, j: number) => valores[j * (cx + 1) + i]!;
  return (x, y) => {
    const fx = x * cx, fy = y * cy, i = Math.min(cx - 1, Math.max(0, Math.floor(fx))), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const j0 = ((j % cy) + cy) % cy, j1 = (j0 + 1) % cy;
    return (en(i, j0) * (1 - sx) + en(i + 1, j0) * sx) * (1 - sy) + (en(i, j1) * (1 - sx) + en(i + 1, j1) * sx) * sy;
  };
}

const paso = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const campana = (x: number, centro: number, ancho: number): number => Math.exp(-(((x - centro) / ancho) ** 2));

/** Sendero: una huella de tierra pisada, más clara en medio, que serpentea dentro de la cinta y de bordes deshilachados. */
function sendero(): (u: number, v: number) => Rgba {
  const r = azar(11), borde = ondas(r, 5), centro = ondas(r, 4), g1 = grano(r, 16, 64), g2 = grano(r, 48, 192);
  return (u, v) => {
    const d = Math.abs(u - 0.5 - 0.07 * centro(v)), medio = 0.27 + 0.06 * borde(v), n = 0.6 * g1(u, v) + 0.4 * g2(u, v);
    const a = 1 - paso(medio - 0.12, medio + 0.06, d + 0.05 * g2(u, v)), pisado = 1 - paso(0, medio, d);
    return [150 + 22 * pisado + 14 * n, 120 + 18 * pisado + 11 * n, 82 + 12 * pisado + 8 * n, a];
  };
}

/** Camino: tierra con dos rodadas, algo de hierba entre ellas y la orilla un poco más oscura (la tierra apartada). */
function camino(): (u: number, v: number) => Rgba {
  const r = azar(23), bi = ondas(r, 5), bd = ondas(r, 5), g1 = grano(r, 12, 48), g2 = grano(r, 40, 160);
  return (u, v) => {
    const n = 0.6 * g1(u, v) + 0.4 * g2(u, v), w = u + 0.03 * g2(u, v);
    const izq = 0.1 + 0.04 * bi(v), der = 0.9 + 0.04 * bd(v);
    const a = paso(izq - 0.06, izq + 0.06, w) * (1 - paso(der - 0.06, der + 0.06, w));
    const surco = Math.max(campana(u, 0.32, 0.035), campana(u, 0.68, 0.035)), orilla = Math.max(campana(u, izq + 0.05, 0.04), campana(u, der - 0.05, 0.04));
    const oscuro = 0.3 * surco + 0.16 * orilla, hierba = 0.55 * campana(u, 0.5, 0.07) * (0.5 + 0.5 * g1(0.3 + u * 0.5, v));
    const tierra = [142 + 14 * n, 112 + 11 * n, 76 + 8 * n].map((c) => c * (1 - oscuro));
    return [tierra[0]! + (104 - tierra[0]!) * hierba, tierra[1]! + (112 - tierra[1]!) * hierba, tierra[2]! + (62 - tierra[2]!) * hierba, a];
  };
}

const TEXTURAS = new Map<Escalon, THREE.DataTexture>();

/** La textura del camino de un escalón (0 sendero, 1 camino de tierra), hecha la primera vez que hace falta. */
export function texturaDeCamino(escalon: Escalon): THREE.DataTexture {
  let t = TEXTURAS.get(escalon);
  if (t) return t;
  const pintar = [sendero, camino][escalon]!(), datos = new Uint8Array(ANCHO_PX * LARGO_PX * 4);
  for (let y = 0; y < LARGO_PX; y++) {
    for (let x = 0; x < ANCHO_PX; x++) {
      const [r, g, b, a] = pintar((x + 0.5) / ANCHO_PX, (y + 0.5) / LARGO_PX), i = 4 * (y * ANCHO_PX + x);
      datos[i] = Math.max(0, Math.min(255, Math.round(r)));
      datos[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      datos[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      datos[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
    }
  }
  t = new THREE.DataTexture(datos, ANCHO_PX, LARGO_PX, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  TEXTURAS.set(escalon, t);
  return t;
}
