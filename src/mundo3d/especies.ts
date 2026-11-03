// Las especies de árbol del mundo 3D (Víctor, 2026-11-03: «diferentes tipos de árboles»): las del Egeo, Anatolia, el Nilo y Mesopotamia en la
// Edad del Bronce. Cuál crece en cada sitio sale de la altura, de lo cerca que queda el agua y de una mancha por zona (los bosques van por
// manchas de una especie, con otras sueltas). Solo se ven: el juego no distingue la madera de un árbol de la de otro.
//   encina: la de siempre, redonda, en los llanos;      olivo: bajo y ancho, verde plata, en llanos y colinas;
//   pino piñonero: tronco alto y copa en sombrilla;      ciprés: alto y estrecho, casi negro;
//   abeto (y cedro): conos apilados, en la montaña;      palmera: junto al agua en lo bajo;
//   álamo: alto y de verde claro, en las riberas.
// Cada especie es una geometría con el tronco y la copa juntos (una malla instanciada por especie y trozo): la copa toma el color de cada árbol
// (`tinte` = 1) y el tronco lleva el suyo (`tinte` = 0). De cerca, copas con lóbulos; de lejos, la silueta sola.
import * as THREE from 'three';
import { MUNDO3D } from './config';
import { azar, manchas } from './ruido';

const U = MUNDO3D.umbrales;

export const ESPECIES = ['encina', 'olivo', 'pino', 'cipres', 'abeto', 'palmera', 'alamo'] as const;
export type Especie = (typeof ESPECIES)[number];
const E = Object.fromEntries(ESPECIES.map((n, k) => [n, k])) as Record<Especie, number>;

/** Los colores de la copa (sRGB): cada árbol los varía un poco. */
export const COLOR_COPA: Record<Especie, readonly [number, number, number]> = {
  encina: [0.4, 0.52, 0.28],
  olivo: [0.5, 0.57, 0.4],
  pino: [0.3, 0.44, 0.24],
  cipres: [0.22, 0.33, 0.19],
  abeto: [0.23, 0.37, 0.29],
  palmera: [0.47, 0.6, 0.25],
  alamo: [0.52, 0.66, 0.32],
};

/** Qué crece en cada zona, con su peso. La ribera es lo bajo a menos de `RIBERA` u del agua (lago, mar o río). */
const ZONAS = {
  ribera: [[E.alamo, 5], [E.palmera, 3], [E.encina, 1]],
  riberaAlta: [[E.alamo, 5], [E.encina, 2], [E.cipres, 1]],
  costa: [[E.pino, 4], [E.olivo, 2], [E.palmera, 1.5], [E.encina, 1], [E.cipres, 1]],
  llano: [[E.encina, 5], [E.olivo, 3], [E.pino, 1], [E.cipres, 1]],
  colina: [[E.pino, 4], [E.encina, 2], [E.olivo, 2], [E.cipres, 1], [E.abeto, 1]],
  montana: [[E.abeto, 6], [E.pino, 2], [E.cipres, 0.5]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;
type Zona = keyof typeof ZONAS;
/** Las que pueden mandar en una mancha: todas menos el ciprés. */
const MANDAN = {} as Record<Zona, readonly (readonly [number, number])[]>;
for (const z of Object.keys(ZONAS) as Zona[]) MANDAN[z] = (ZONAS[z] as readonly (readonly [number, number])[]).filter(([e]) => e !== E.cipres);
export const RIBERA = 2.5;

/** La zona de (x, y) con el suelo a `h` m y el agua a `dAgua` u. Los cortes de altura bailan unos metros por manchas, para que no sean rayas. */
export function zonaDe(x: number, y: number, h: number, dAgua: number): Zona {
  const hh = h + (manchas(x, y, 7, 101) - 0.5) * 30;
  if (dAgua < RIBERA && hh < U.colina) return hh < U.costa + 15 ? 'ribera' : 'riberaAlta';
  return hh < U.costa ? 'costa' : hh < U.colina ? 'llano' : hh < U.montana ? 'colina' : 'montana';
}

/** Lo que pesa cada cosa de una lista según `t` (0..1). */
function elegir(lista: readonly (readonly [number, number])[], t: number): number {
  let total = 0;
  for (const [, p] of lista) total += p;
  let s = t * total;
  for (const [e, p] of lista) { if ((s -= p) < 0) return e; }
  return lista[lista.length - 1]![0];
}

/** La especie (índice en `ESPECIES`) de un árbol en (x, y). `t` es un azar del árbol. En cada mancha de unas 22 u (de borde irregular) manda
 * una especie de la zona: siete de cada diez árboles son de ella; el resto, cualquiera de la zona según su peso. El ciprés nunca manda: va
 * suelto entre los demás. */
export function especieDe(x: number, y: number, h: number, dAgua: number, t: number): number {
  const zona = zonaDe(x, y, h, dAgua), lista = ZONAS[zona];
  const wx = x + (manchas(x, y, 9, 211) - 0.5) * 14, wy = y + (manchas(x, y, 9, 223) - 0.5) * 14;
  const dominante = elegir(MANDAN[zona], azar(Math.floor(wx / 22), Math.floor(wy / 22), 307));
  return t < 0.7 ? dominante : elegir(lista, (t - 0.7) / 0.3);
}

// ---- geometría ----

const lin = (c: readonly [number, number, number]): [number, number, number] => {
  const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  return [k.r, k.g, k.b];
};

interface Pieza { geo: THREE.BufferGeometry; color: readonly [number, number, number]; tinte: 0 | 1 }

/** Una copa redonda: icosaedro con normales de esfera, estirado (`ex`, `ey`, `ez`) y puesto en (x, y, z). */
function copa(r: number, x: number, y: number, z: number, ex = 1, ey = 1, ez = 1, detalle = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detalle), p = g.attributes.position!, n: number[] = [];
  for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k).normalize(); n.push(v.x, v.y, v.z); }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.scale(ex, ey, ez);
  g.translate(x, y, z);
  return g;
}

/** Un tronco de `alto` desde (x, 0, z), inclinado `lean` u hacia +x en la punta. */
function tronco(r0: number, r1: number, alto: number, lean = 0, desde = 0, x = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, alto, 5, 1, true);
  g.translate(0, alto / 2, 0);
  if (lean) g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, lean / alto, 0, 0, 0));
  g.translate(x, desde, 0);
  return g;
}

function cono(r: number, alto: number, y: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, alto, 7, 1, true);
  g.translate(0, y + alto / 2, 0);
  return g;
}

/** Las hojas de la palmera: `n` palmas que salen de (0, y, 0), suben un poco y caen; con las dos caras. */
function palmas(n: number, y: number, largo: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    const ab = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!), ac = new THREE.Vector3(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!);
    const nn = ab.cross(ac).normalize();
    if (nn.y < 0) nn.negate();
    for (const [p, q, r] of [[a, b, c], [a, c, b]] as const) { pos.push(...p, ...q, ...r); for (let k = 0; k < 3; k++) nor.push(nn.x, nn.y, nn.z); }
  };
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2 + (k % 2) * 0.3, cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx, w = largo * 0.16;
    const base = [0, y, 0], m = [cx * largo * 0.5, y + largo * 0.14, cz * largo * 0.5], punta = [cx * largo, y - largo * 0.3, cz * largo];
    const mi = [m[0]! + px * w, m[1]!, m[2]! + pz * w], md = [m[0]! - px * w, m[1]!, m[2]! - pz * w];
    tri(base, mi, md);
    tri(mi, punta, md);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Junta las piezas en una geometría sin índice con `color` (lineal) y `tinte`. Las copas se oscurecen hacia abajo (la sombra de sí mismas). */
function juntar(piezas: readonly Pieza[]): THREE.BufferGeometry {
  const partes = piezas.map((p) => ({ ...p, geo: p.geo.index ? p.geo.toNonIndexed() : p.geo }));
  let total = 0;
  for (const p of partes) total += p.geo.attributes.position!.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), tin = new Float32Array(total);
  let o = 0;
  for (const p of partes) {
    const ps = p.geo.attributes.position!, ns = p.geo.attributes.normal!, c = lin(p.color);
    p.geo.computeBoundingBox();
    const y0 = p.geo.boundingBox!.min.y, y1 = p.geo.boundingBox!.max.y;
    for (let k = 0; k < ps.count; k++) {
      pos.set([ps.getX(k), ps.getY(k), ps.getZ(k)], 3 * (o + k));
      nor.set([ns.getX(k), ns.getY(k), ns.getZ(k)], 3 * (o + k));
      const sombra = p.tinte ? 0.62 + 0.38 * Math.min(1, Math.max(0, (ps.getY(k) - y0) / (y1 - y0 || 1))) : 1;
      col.set([c[0] * sombra, c[1] * sombra, c[2] * sombra], 3 * (o + k));
      tin[o + k] = p.tinte;
    }
    o += ps.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
  g.computeBoundingSphere();
  return g;
}

const BLANCO = [1, 1, 1] as const;
const MADERA = [0.36, 0.27, 0.2] as const, MADERA_GRIS = [0.42, 0.38, 0.32] as const, ESTIPE = [0.52, 0.44, 0.32] as const;
const hoja = (geo: THREE.BufferGeometry): Pieza => ({ geo, color: BLANCO, tinte: 1 });
const palo = (geo: THREE.BufferGeometry, color: readonly [number, number, number] = MADERA): Pieza => ({ geo, color, tinte: 0 });

/** Las geometrías de los árboles. De cerca, una por especie, con lóbulos y tronco. De lejos basta la silueta, y las de copa redonda (encina,
 * olivo, ciprés y álamo) son la misma bola estirada en cada árbol (`forma`: ancho, alto, ancho y a qué altura empieza, por la escala del
 * árbol): así un trozo lejano lleva como mucho cuatro mallas (`grupoLejos`: copa, pino, abeto y palmera). Miden en torno a 1,1 de alto, como
 * la copa de antes: la escala del árbol las pone a su tamaño. */
export interface GeometriasDeArbol {
  cerca: THREE.BufferGeometry[];
  lejos: THREE.BufferGeometry[];
  grupoLejos: number[];
  forma: (readonly [number, number, number, number])[];
}

export function geometrias(): GeometriasDeArbol {
  const cerca: Record<Especie, Pieza[]> = {
    encina: [palo(tronco(0.08, 0.06, 0.5)), hoja(copa(0.5, 0, 0.66, 0)), hoja(copa(0.3, 0.24, 0.8, 0.12))],
    olivo: [palo(tronco(0.09, 0.06, 0.34, 0.08), MADERA_GRIS), hoja(copa(0.42, 0.06, 0.5, 0, 1.3, 0.62, 1.3)), hoja(copa(0.24, -0.3, 0.46, 0.2, 1.2, 0.7, 1.2))],
    pino: [palo(tronco(0.06, 0.035, 1.05, 0.1)), hoja(copa(0.46, 0.1, 1.08, 0, 1.4, 0.4, 1.4)), hoja(copa(0.26, -0.28, 0.98, 0.16, 1.3, 0.45, 1.3))],
    cipres: [palo(tronco(0.05, 0.04, 0.2)), hoja(copa(0.5, 0, 0.98, 0, 0.32, 1.7, 0.32))],
    abeto: [palo(tronco(0.06, 0.04, 0.3)), hoja(cono(0.48, 0.62, 0.18)), hoja(cono(0.38, 0.56, 0.52)), hoja(cono(0.26, 0.5, 0.86))],
    palmera: [palo(tronco(0.055, 0.04, 0.72, 0.07), ESTIPE), palo(tronco(0.04, 0.032, 0.62, 0.14, 0.7, 0.07), ESTIPE), hoja(palmas(9, 1.32, 0.6))],
    alamo: [palo(tronco(0.06, 0.04, 0.45)), hoja(copa(0.5, 0, 1.0, 0, 0.56, 1.3, 0.56)), hoja(copa(0.3, 0.1, 0.72, 0.08, 0.7, 1.2, 0.7))],
  };
  // de lejos: la bola de 1 de alto con la base en 0, el pino, el abeto y la palmera
  const lejos = [
    juntar([hoja(copa(0.5, 0, 0.5, 0))]),
    juntar([palo(tronco(0.06, 0.035, 1.05)), hoja(copa(0.5, 0, 1.08, 0, 1.45, 0.42, 1.45))]),
    juntar([hoja(cono(0.46, 1.25, 0.12))]),
    juntar([palo(tronco(0.05, 0.035, 1.32, 0.18), ESTIPE), hoja(palmas(6, 1.32, 0.6))]),
  ];
  const grupo: Record<Especie, number> = { encina: 0, olivo: 0, cipres: 0, alamo: 0, pino: 1, abeto: 2, palmera: 3 };
  const forma: Record<Especie, readonly [number, number, number, number]> = {
    encina: [1, 1, 1, 0.12],
    olivo: [1.2, 0.58, 1.2, 0.21],
    cipres: [0.32, 1.75, 0.32, 0.05],
    alamo: [0.58, 1.4, 0.58, 0.22],
    pino: [1, 1, 1, 0], abeto: [1, 1, 1, 0], palmera: [1, 1, 1, 0],
  };
  return { cerca: ESPECIES.map((e) => juntar(cerca[e])), lejos, grupoLejos: ESPECIES.map((e) => grupo[e]), forma: ESPECIES.map((e) => forma[e]) };
}

/** El material de los árboles: el color de la copa sale de cada árbol (`instanceColor`) por el de la geometría, el del tronco solo de la
 * geometría. `parchear` es la niebla de guerra, que va la última. */
export function materialDeArboles(parchear: (sh: THREE.WebGLProgramParametersWithUniforms) => void): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float tinte;\n' + sh.vertexShader.replace('#include <color_vertex>', `
      vColor = color;
      #ifdef USE_INSTANCING_COLOR
      vColor *= mix(vec3(1.0), instanceColor, tinte);
      #endif`);
    parchear(sh);
  };
  m.customProgramCacheKey = () => 'arboles-especies';
  return m;
}

/** El color (lineal) de la copa de un árbol de la especie `e`, con sus dos azares `r` y `s`: más claro u oscuro y un poco más amarillo o azul. */
export function colorDeCopa(e: number, r: number, s: number, out: THREE.Color): THREE.Color {
  const c = COLOR_COPA[ESPECIES[e]!], v = 0.85 + 0.3 * r, t = (s - 0.5) * 0.08;
  return out.setRGB(Math.min(1, c[0] * v + t), Math.min(1, c[1] * v), Math.max(0, c[2] * v - t), THREE.SRGBColorSpace);
}

