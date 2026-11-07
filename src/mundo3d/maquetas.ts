// Las maquetas de plazas, pueblos, avanzadas, obras y campamentos (de mercenarios y de bandidos), alijos y batallas, a la escala del juego
// (`MUNDO3D.maqueta`, ×1): las piezas de la mesa de escalas 3D (muralla, casas, empalizada, torre, tiendas) y una bandera del color de su
// Facción. Todas las de un material van en una sola malla instanciada. Las plazas que solo se recuerdan van bajo la niebla (oscurecidas, como
// en `render.ts`); lo demás, encima: lo propio y lo que se ve ahora.
import * as THREE from 'three';
import type { Claro } from './arboles';
import { MUNDO3D } from './config';
import type { MundoEnVista } from './estado';
import type { NieblaDeGuerra } from './niebla';
import type { SueloPintado } from './terreno';

const COLORES = {
  muro: 0xc9b48f, adobe: 0xd2bf9a, techo: 0xa8714a, madera: 0x8a6440, lona: 0xd8cfbd, ruina: 0x7d7466, campo: 0xb59a3a, mina: 0x4a4038,
  lonaOscura: 0x4a3f36, fuego: 0xd35400, oro: 0xe0b422, filo: 0xf4ead2, batallaPropia: 0x2f6b3a, batallaAjena: 0x8a3b12,
};
type Material = keyof typeof COLORES;
/** Color de la bandera de los campamentos de mercenarios y de los de bandidos (los del 2D). */
const COLOR_MERCENARIOS = '#6fa3d6', COLOR_BANDIDOS = '#c0392b';

/** Una pieza: caja (o tienda) en (x, y) de `ancho` × `fondo` × `alto` u, girada `giro` rad, inclinada `inclina` rad de lado y subida `base` u
 * sobre el suelo. */
interface Pieza { x: number; y: number; ancho: number; fondo: number; alto: number; giro: number; base: number; inclina?: number }

/** Un número fijo entre 0 y 1 por (a, b, c). */
function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const GEO = (() => {
  const caja = new THREE.BoxGeometry(1, 1, 1);
  caja.translate(0, 0.5, 0);
  const tienda = new THREE.ConeGeometry(0.5, 1, 4);
  tienda.translate(0, 0.5, 0);
  // la bandera, con el asta en x = 0: ondea hacia +x
  const bandera = new THREE.BoxGeometry(1, 1, 1);
  bandera.translate(0.5, -0.5, 0);
  return { caja, tienda, bandera };
})();

/** Las piezas de una escena de maquetas, por material, y las banderas por color. */
class Piezas {
  readonly por = new Map<string, Pieza[]>();
  readonly banderas = new Map<string, Pieza[]>();
  add(mat: Material, p: Pieza): void {
    let l = this.por.get(mat);
    if (!l) this.por.set(mat, (l = []));
    l.push(p);
  }
  caja(mat: Material, x: number, y: number, ancho: number, fondo: number, alto: number, giro = 0, base = 0): void {
    this.add(mat, { x, y, ancho, fondo, alto, giro, base });
  }
  /** Un anillo de tramos rectos (muralla o empalizada) de radio `r`, con un hueco (la puerta) en el tramo `hueco`. */
  anillo(cx: number, cy: number, r: number, alto: number, grueso: number, mat: Material, hueco = 7): void {
    const seg = Math.max(14, Math.round((2 * Math.PI * r) / 0.25));
    for (let k = 0; k < seg; k++) {
      if (k === hueco) continue;
      const a0 = (k / seg) * 2 * Math.PI, a1 = ((k + 1) / seg) * 2 * Math.PI;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      this.caja(mat, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) + 0.02, grueso, alto, Math.atan2(y1 - y0, x1 - x0));
    }
  }
  /** Un asta de `alto` u con su bandera de `color` arriba. */
  bandera(x: number, y: number, alto: number, color: string, base = 0): void {
    const M = MUNDO3D.maqueta;
    this.caja('madera', x, y, 0.02 * M, 0.02 * M, alto, 0, base);
    let l = this.banderas.get(color);
    if (!l) this.banderas.set(color, (l = []));
    l.push({ x, y, ancho: 0.16 * M, fondo: 0.012 * M, alto: 0.1 * M, giro: 0, base: base + alto });
  }
}

/** Una torre cuadrada de `lado` y `alto` u con su almena (un remate algo más ancho arriba). */
function torre(p: Piezas, mat: Material, x: number, y: number, lado: number, alto: number, giro = 0): void {
  p.caja(mat, x, y, lado, lado, alto, giro);
  p.caja(mat, x, y, lado * 1.25, lado * 1.25, lado * 0.3, giro, alto);
}

/** Torres repartidas por un anillo de radio `r` (sin la de la puerta, en el tramo 7 de `anillo`). */
function torresEnAnillo(p: Piezas, mat: Material, x: number, y: number, r: number, n: number, lado: number, alto: number): void {
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * 2 * Math.PI;
    torre(p, mat, x + r * Math.cos(a), y + r * Math.sin(a), lado, alto, a);
  }
}

/** Un número fijo entre 0 y 1 por (a, b, c), mejor mezclado que `hash` (con índices seguidos, `hash` daba espirales: Víctor, 2026-11-07). */
function azar(a: number, b: number, c: number): number {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b1) ^ Math.imul(c | 0, 0x85ebca77);
  for (let k = 0; k < 2; k++) {
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Un círculo que las casas dejan libre (un granero, un corral, el templo). */
interface Hueco { x: number; y: number; r: number }

/**
 * Las casas de una plaza (0.173.0, Víctor 2026-11-07: «es un espiral sin sentido, dale más forma de plaza y que no se monten»): en manzanas de
 * una cuadrícula girada `giro`, cada casa en su solar (así nunca se montan), con dos calles que se cruzan en el centro y la plaza libre en medio
 * (el cuadrado de medio lado `desde`). Se llenan antes los solares cerca de la plaza, con algo de azar, hasta `n` o hasta el borde `hasta`.
 */
function casas(p: Piezas, x: number, y: number, n: number, desde: number, hasta: number, tam: number, sem: number, techo: number, giro = 0, huecos: Hueco[] = []): void {
  // el solar crece si hay pocas casas para tanto sitio (una plaza grande con el tope de casas): huertos entre ellas, no un hueco en el borde
  const area = Math.PI * hasta * hasta - 4 * desde * desde;
  const L = Math.max(0.27 * tam, Math.min(0.36 * tam, Math.sqrt(Math.max(0, area) * 0.7 / Math.max(1, n)))), calle = 0.09 * tam, cg = Math.cos(giro), sg = Math.sin(giro);
  const solares: { u: number; v: number; orden: number; i: number; j: number }[] = [];
  const max = Math.ceil(hasta / L) + 1;
  for (let i = -max; i < max; i++) for (let j = -max; j < max; j++) {
    // los solares a los lados de las dos calles del centro
    const u = Math.sign(i + 0.5) * (calle + (Math.abs(i + 0.5) - 0.5) * L + L / 2), v = Math.sign(j + 0.5) * (calle + (Math.abs(j + 0.5) - 0.5) * L + L / 2);
    const d = Math.hypot(u, v);
    if (d + L * 0.45 > hasta) continue;
    if (Math.abs(u) - L / 2 < desde && Math.abs(v) - L / 2 < desde) continue;
    const wx = x + u * cg - v * sg, wy = y + u * sg + v * cg;
    if (huecos.some((h) => Math.hypot(wx - h.x, wy - h.y) < h.r + L * 0.5)) continue;
    solares.push({ u, v, i, j, orden: d / L + 1.6 * azar(sem, i * 131 + j, 7) });
  }
  solares.sort((a, b) => a.orden - b.orden);
  for (const s of solares.slice(0, n)) {
    const k = s.i * 131 + s.j;
    const ancho = (0.12 + 0.07 * azar(sem, k, 3)) * tam, fondo = (0.11 + 0.06 * azar(sem, k, 4)) * tam;
    const holgura = Math.max(0, L - Math.max(ancho, fondo)) * 0.7;
    const u = s.u + (azar(sem, k, 8) - 0.5) * holgura, v = s.v + (azar(sem, k, 9) - 0.5) * holgura;
    p.caja(azar(sem, k, 6) < techo ? 'techo' : 'adobe', x + u * cg - v * sg, y + u * sg + v * cg, ancho, fondo, (0.07 + 0.06 * azar(sem, k, 5)) * tam, giro + (azar(sem, k, 10) - 0.5) * 0.12);
  }
}

/**
 * La ciudad del juego, distinta en cada nivel y más elaborada cuanto más alto (Víctor, 2026-11-01). Los niveles 1 y 2 no tienen muralla:
 *  1. un caserío: la casa del jefe y un puñado de chozas;
 *  2. un poblado: casa grande con su patio, granero y más casas;
 *  3. ciudad amurallada: muralla de piedra con puerta, palacio y templo;
 *  4. muralla con torres, palacio de dos plantas y templo con columnas;
 *  5. doble muralla con torres, ciudadela interior y zigurat escalonado.
 */
function ciudad(p: Piezas, x: number, y: number, rc: number, nivel: number, color: string, sem: number): void {
  const M = MUNDO3D.maqueta, r = rc * M, n = Math.max(1, Math.min(5, Math.round(nivel)));
  const lleno = [0.35, 0.6, 0.8, 1, 1.15][n - 1]!;
  const cuantas = Math.max(5, Math.min(170, Math.round(26 * rc * rc * lleno)));
  const borde = Math.max(0.3 * M, r - 0.3 * M);
  // la cuadrícula de la plaza, girada por plaza; lo del centro, girado con ella
  const giro = azar(sem, 0, 11) * Math.PI / 2, cg = Math.cos(giro), sg = Math.sin(giro);
  const en = (u: number, v: number): [number, number] => [x + u * M * cg - v * M * sg, y + u * M * sg + v * M * cg];
  if (n === 1) {
    // la plaza con la casa del jefe a un lado, el pozo en medio y el corral fuera de las calles; chozas alrededor
    const [jx, jy] = en(0, -0.2), [px, py] = en(0.05, 0.05), [cx, cy] = en(-0.55, -0.55);
    p.caja('techo', jx, jy, 0.2 * M, 0.14 * M, 0.11 * M, giro);
    p.caja('muro', px, py, 0.05 * M, 0.05 * M, 0.035 * M, giro);
    p.anillo(cx, cy, 0.12 * M, 0.04 * M, 0.015 * M, 'madera', -1);
    casas(p, x, y, cuantas, 0.3 * M, borde * 0.8, M * 0.85, sem, 0.15, giro, [{ x: cx, y: cy, r: 0.13 * M }]);
    const [bx, by] = en(0.1, -0.14);
    p.bandera(bx, by, 0.4 * M, color);
    return;
  }
  if (n === 2) {
    // la plaza: la casa grande con su patio (cuatro alas bajas) a un lado, el granero y el pozo enfrente, y las casas en manzanas alrededor
    const [hx, hy] = en(0, -0.32), [gx, gy] = en(-0.3, 0.3), [px, py] = en(0.08, 0.08);
    p.caja('adobe', hx, hy, 0.3 * M, 0.2 * M, 0.16 * M, giro);
    p.caja('techo', hx, hy, 0.32 * M, 0.22 * M, 0.03 * M, giro, 0.16 * M);
    for (const dv of [-0.13, 0.13]) { const [ax, ay] = en(dv * 1.6, -0.32); p.caja('adobe', ax, ay, 0.06 * M, 0.22 * M, 0.07 * M, giro); }
    p.caja('madera', gx, gy, 0.12 * M, 0.12 * M, 0.14 * M, giro);
    p.caja('techo', gx, gy, 0.14 * M, 0.14 * M, 0.025 * M, giro, 0.14 * M);
    p.caja('muro', px, py, 0.05 * M, 0.05 * M, 0.035 * M, giro);
    casas(p, x, y, cuantas, 0.48 * M, borde * 0.9, M, sem, 0.3, giro);
    const [bx, by] = en(0.14, -0.2);
    p.bandera(bx, by, 0.5 * M, color);
    return;
  }
  // desde el 3, amurallada: cuanto más nivel, muralla más alta y gruesa
  const alto = [0.14, 0.18, 0.22][n - 3]! * M, grueso = [0.05, 0.065, 0.08][n - 3]! * M;
  p.anillo(x, y, r, alto, grueso, 'muro');
  // la puerta: dos torres a los lados del hueco (tramo 7)
  const seg = Math.max(14, Math.round((2 * Math.PI * r) / 0.25));
  for (const k of [7, 8]) {
    const a = (k / seg) * 2 * Math.PI;
    torre(p, 'muro', x + r * Math.cos(a), y + r * Math.sin(a), grueso * 2, alto * 1.35, a);
  }
  if (n >= 4) torresEnAnillo(p, 'muro', x, y, r, Math.max(6, Math.round(r / (0.45 * M))), grueso * 1.9, alto * 1.3);
  if (n === 3) {
    // palacio y templo
    p.caja('muro', x, y, 0.34 * M, 0.26 * M, 0.22 * M);
    p.caja('techo', x + 0.32 * M, y - 0.12 * M, 0.16 * M, 0.24 * M, 0.16 * M);
  } else if (n === 4) {
    // palacio de dos plantas y templo con columnas sobre su basa
    p.caja('muro', x, y, 0.4 * M, 0.3 * M, 0.18 * M);
    p.caja('muro', x, y, 0.26 * M, 0.2 * M, 0.14 * M, 0, 0.18 * M);
    p.caja('muro', x + 0.38 * M, y - 0.12 * M, 0.24 * M, 0.32 * M, 0.03 * M);
    for (const dx of [-0.08, 0.08]) for (const dy of [-0.12, -0.04, 0.04, 0.12]) p.caja('filo', x + 0.38 * M + dx * M, y - 0.12 * M + dy * M, 0.025 * M, 0.025 * M, 0.14 * M, 0, 0.03 * M);
    p.caja('techo', x + 0.38 * M, y - 0.12 * M, 0.24 * M, 0.32 * M, 0.04 * M, 0, 0.17 * M);
  } else {
    // ciudadela interior con su muro y torres, zigurat escalonado y templo
    const ri = Math.min(0.75 * M, r * 0.45);
    p.anillo(x, y, ri, alto * 0.85, grueso * 0.8, 'muro', 3);
    torresEnAnillo(p, 'muro', x, y, ri, 4, grueso * 1.7, alto * 1.15);
    for (let k = 0; k < 4; k++) p.caja('muro', x, y, (0.42 - 0.09 * k) * M, (0.42 - 0.09 * k) * M, 0.09 * M, 0, k * 0.09 * M);
    p.caja('techo', x, y, 0.1 * M, 0.1 * M, 0.08 * M, 0, 0.36 * M);
    const tx = x + (ri + 0.35 * M), ty = y + 0.2 * M;
    p.caja('muro', tx, ty, 0.26 * M, 0.34 * M, 0.03 * M);
    for (const dx of [-0.09, 0.09]) for (const dy of [-0.13, -0.045, 0.045, 0.13]) p.caja('filo', tx + dx * M, ty + dy * M, 0.025 * M, 0.025 * M, 0.15 * M, 0, 0.03 * M);
    p.caja('techo', tx, ty, 0.26 * M, 0.34 * M, 0.045 * M, 0, 0.18 * M);
  }
  const desde = n === 5 ? Math.min(0.75 * M, r * 0.45) + 0.1 * M : 0.3 * M;
  // lo grande del centro (palacio y templo, o la ciudadela) y la puerta quedan libres
  const huecos: Hueco[] = n === 3 ? [{ x: x + 0.32 * M, y: y - 0.12 * M, r: 0.16 * M }] : n === 4 ? [{ x: x + 0.38 * M, y: y - 0.12 * M, r: 0.22 * M }]
    : [{ x: x + Math.min(0.75 * M, r * 0.45) + 0.35 * M, y: y + 0.2 * M, r: 0.24 * M }];
  casas(p, x, y, cuantas, desde, borde - 0.08 * M, M, sem, 0.25 + 0.1 * (n - 3), 0, huecos);
  p.bandera(x + 0.12 * M, y + 0.1 * M, (n === 5 ? 0.7 : 0.55) * M, color, n === 5 ? 0.36 * M : n === 4 ? 0.32 * M : 0.22 * M);
}

/** Un pueblo: empalizada y casas; la aldea agrícola con sus campos alrededor, el extractor con su bocamina. */
function pueblo(p: Piezas, x: number, y: number, aldea: boolean, color: string, sem: number): void {
  const M = MUNDO3D.maqueta;
  p.anillo(x, y, 0.55 * M, 0.06 * M, 0.03 * M, 'madera');
  for (let k = 0; k < (aldea ? 8 : 5); k++) {
    const a = hash(sem, k, 1) * 2 * Math.PI, d = (0.12 + 0.33 * Math.sqrt(hash(sem, k, 2))) * M;
    p.caja(hash(sem, k, 6) < 0.5 ? 'techo' : 'adobe', x + d * Math.cos(a), y + d * Math.sin(a), (0.09 + 0.05 * hash(sem, k, 3)) * M, (0.09 + 0.05 * hash(sem, k, 4)) * M, (0.06 + 0.04 * hash(sem, k, 5)) * M, a);
  }
  if (aldea) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 2 * Math.PI + hash(sem, k, 7), d = (0.85 + 0.3 * hash(sem, k, 8)) * M;
      p.caja('campo', x + d * Math.cos(a), y + d * Math.sin(a), 0.42 * M, 0.3 * M, 0.015 * M, a);
    }
  } else {
    p.caja('mina', x + 0.2 * M, y - 0.15 * M, 0.2 * M, 0.16 * M, 0.08 * M, hash(sem, 0, 9));
  }
  p.bandera(x - 0.1 * M, y + 0.05 * M, 0.4 * M, color);
}

/**
 * Una avanzada, distinta en cada etapa (Doc 5.17): la ATALAYA es una torre de vigía de madera con su plataforma y una cerca; el FUERTE,
 * un recinto cuadrado de piedra con torres en las esquinas y la torre del homenaje; la CIUDADELA, un recinto redondo y alto con torres,
 * su torre mayor, cuartel y almacén. En ruinas, baja y gris, sin bandera.
 */
function avanzada(p: Piezas, x: number, y: number, etapa: number, ruinas: boolean, color: string): void {
  const M = MUNDO3D.maqueta, e = Math.max(1, Math.min(3, etapa)), b = ruinas ? 0.4 : 1;
  const mat = (m: Material): Material => (ruinas ? 'ruina' : m);
  let cima: number;
  if (e === 1) {
    // cuatro postes, la plataforma, su tejadillo y una cerca baja
    const alto = 0.5 * M * b;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) p.caja(mat('madera'), x + dx * 0.06 * M, y + dy * 0.06 * M, 0.025 * M, 0.025 * M, alto);
    p.caja(mat('madera'), x, y, 0.18 * M, 0.18 * M, 0.025 * M, 0, alto);
    if (!ruinas) p.caja('techo', x, y, 0.2 * M, 0.2 * M, 0.035 * M, 0, alto + 0.12 * M);
    p.anillo(x, y, 0.26 * M, 0.05 * M * b, 0.02 * M, mat('madera'), 3);
    p.caja(mat('adobe'), x + 0.15 * M, y + 0.1 * M, 0.08 * M, 0.07 * M, 0.06 * M);
    cima = alto + 0.15 * M;
  } else if (e === 2) {
    // recinto cuadrado de piedra, torres en las esquinas y la torre del homenaje
    const l = 0.32 * M, alto = 0.12 * M * b, g = 0.035 * M;
    for (const [dx, dy, gi] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]] as const) {
      if (dy === 1) {
        // la puerta, en el lado norte
        p.caja(mat('muro'), x - l * 0.6, y + l, l * 0.8, g, alto, gi);
        p.caja(mat('muro'), x + l * 0.6, y + l, l * 0.8, g, alto, gi);
      } else p.caja(mat('muro'), x + dx * l, y + dy * l, 2 * l, g, alto, gi);
    }
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) torre(p, mat('muro'), x + dx * l, y + dy * l, 0.08 * M, alto * 1.5);
    const homenaje = 0.45 * M * b;
    torre(p, mat('muro'), x, y - 0.06 * M, 0.15 * M, homenaje);
    p.caja(mat('techo'), x + 0.14 * M, y + 0.12 * M, 0.12 * M, 0.08 * M, 0.06 * M);
    cima = homenaje + 0.05 * M;
  } else {
    // recinto redondo y alto con torres, torre mayor, cuartel y almacén
    const r = 0.45 * M, alto = 0.16 * M * b, g = 0.045 * M;
    p.anillo(x, y, r, alto, g, mat('muro'), 3);
    torresEnAnillo(p, mat('muro'), x, y, r, 6, 0.09 * M, alto * 1.4);
    const mayor = 0.62 * M * b;
    torre(p, mat('muro'), x, y, 0.18 * M, mayor);
    p.caja(mat('muro'), x, y, 0.28 * M, 0.28 * M, 0.1 * M * b);
    p.caja(mat('techo'), x - 0.24 * M, y + 0.06 * M, 0.1 * M, 0.22 * M, 0.07 * M, 0.3);
    p.caja(mat('madera'), x + 0.22 * M, y - 0.12 * M, 0.12 * M, 0.12 * M, 0.08 * M, -0.4);
    cima = mayor + 0.055 * M;
  }
  if (!ruinas) p.bandera(x, y, 0.14 * M, color, cima);
}

/** Una obra: andamio de cuatro postes y el montón de material; ya arrancada, con los muros a media altura. */
function obra(p: Piezas, x: number, y: number, arrancada: boolean, color: string): void {
  const M = MUNDO3D.maqueta;
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) p.caja('madera', x + dx * 0.15 * M, y + dy * 0.15 * M, 0.02 * M, 0.02 * M, 0.35 * M);
  p.caja('adobe', x + 0.05 * M, y + 0.28 * M, 0.22 * M, 0.18 * M, 0.06 * M);
  if (arrancada) p.caja('adobe', x, y, 0.26 * M, 0.26 * M, 0.12 * M);
  p.bandera(x - 0.15 * M, y - 0.15 * M, 0.15 * M, color, 0.35 * M - 0.15 * M);
}

/** Un campamento de mercenarios: empalizada, tiendas en corro y el asta en medio. */
function campamento(p: Piezas, x: number, y: number, sem: number): void {
  const M = MUNDO3D.maqueta * MUNDO3D.campamento;
  p.anillo(x, y, 0.6 * M, 0.07 * M, 0.03 * M, 'madera');
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * 2 * Math.PI + hash(sem, k, 1) * 0.4, d = (0.25 + 0.2 * hash(sem, k, 2)) * M;
    p.add('lona', { x: x + d * Math.cos(a), y: y + d * Math.sin(a), ancho: 0.18 * M, fondo: 0.18 * M, alto: 0.14 * M, giro: a, base: 0 });
  }
  p.bandera(x, y, 0.5 * M, COLOR_MERCENARIOS);
}

/** Un campamento de bandidos: tiendas oscuras en corro (más cuanto más nivel), la hoguera y su bandera roja. */
function bandidos(p: Piezas, x: number, y: number, nivel: number, sem: number): void {
  const M = MUNDO3D.maqueta * MUNDO3D.campamento, n = 2 + 2 * Math.max(1, Math.min(3, nivel));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI + hash(sem, k, 1) * 0.5, d = (0.3 + 0.12 * hash(sem, k, 2)) * M;
    p.add('lonaOscura', { x: x + d * Math.cos(a), y: y + d * Math.sin(a), ancho: 0.16 * M, fondo: 0.16 * M, alto: 0.12 * M, giro: a, base: 0 });
  }
  p.caja('fuego', x, y, 0.07 * M, 0.07 * M, 0.04 * M, 0.4);
  p.bandera(x + 0.1 * M, y - 0.12 * M, 0.42 * M, COLOR_BANDIDOS);
}

/** Un alijo: fardos y un cofre con el oro encima. */
function alijo(p: Piezas, x: number, y: number): void {
  const M = MUNDO3D.maqueta * MUNDO3D.alijo;
  p.caja('adobe', x - 0.06 * M, y, 0.1 * M, 0.08 * M, 0.06 * M, 0.3);
  p.caja('madera', x + 0.05 * M, y + 0.03 * M, 0.09 * M, 0.07 * M, 0.07 * M, -0.2);
  p.caja('oro', x + 0.05 * M, y + 0.03 * M, 0.06 * M, 0.05 * M, 0.025 * M, -0.2, 0.07 * M);
}

/** Una batalla de Unity: dos espadas cruzadas sobre un aro, verde si combates en ella. */
function batalla(p: Piezas, x: number, y: number, propia: boolean): void {
  p.anillo(x, y, 0.6, 0.03, 0.06, propia ? 'batallaPropia' : 'batallaAjena', -1);
  for (const lado of [-1, 1]) p.add('filo', { x: x + lado * 0.17, y, ancho: 0.035, fondo: 0.012, alto: 0.55, giro: 0, base: 0.15, inclina: lado * 0.6 });
}

const semilla = (x: number, y: number): number => Math.round(x * 7 + y * 13);

export class Maquetas {
  readonly grupo = new THREE.Group();
  /** Donde no crecen árboles: cada maqueta con su holgura. */
  claros: Claro[] = [];
  claveClaros = '';
  private clave = '';
  private readonly materiales = new Map<string, THREE.MeshLambertMaterial>();

  /** Lo puesto, para volver a asentarlo cuando cambia el suelo pintado de debajo (`SueloPintado.version`). */
  private puestas: (() => void)[] = [];
  private version = -1;

  constructor(private readonly niebla: NieblaDeGuerra, private readonly suelo: SueloPintado) {}

  /** El material de un color, encima o bajo la niebla (se crean una vez). */
  private material(color: number | string, bajoNiebla: boolean): THREE.MeshLambertMaterial {
    const clave = `${color}|${bajoNiebla}`;
    let m = this.materiales.get(clave);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color });
      if (bajoNiebla) this.niebla.aplicar(m);
      this.materiales.set(clave, m);
    }
    return m;
  }

  /** Rehace las maquetas si cambió lo que hay. Devuelve si cambiaron (y con ellas los claros). */
  actualizar(m: MundoEnVista): boolean {
    const f = (v: number) => v.toFixed(2);
    const clave = [
      ...m.plazas.map((x) => `P${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${f(x.radioCiudad)}:${x.nivel}:${x.color}:${x.recordada}`),
      ...m.pueblos.map((x) => `U${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${x.aldea}:${x.color}`),
      ...m.avanzadas.map((x) => `A${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${x.etapa}:${x.ruinas}:${x.color}`),
      ...m.obras.map((x) => `O${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${x.arrancada}:${x.color}`),
      ...m.campamentos.map((x) => `C${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}`),
      ...m.bandidos.map((x) => `B${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${x.nivel}`),
      ...m.alijos.map((x) => `J${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}`),
      ...m.batallas.map((x) => `T${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${x.propia}`),
    ].join('|');
    if (clave === this.clave) {
      if (this.suelo.version !== this.version) { this.version = this.suelo.version; for (const asentar of this.puestas) asentar(); }
      return false;
    }
    this.clave = clave;
    this.version = this.suelo.version;
    this.vaciar();
    const M = MUNDO3D.maqueta, encima = new Piezas(), bajo = new Piezas(), claros: Claro[] = [];
    for (const x of m.plazas) {
      ciudad(x.recordada ? bajo : encima, x.posicion.x, x.posicion.y, x.radioCiudad, x.nivel, x.color, semilla(x.posicion.x, x.posicion.y));
      claros.push({ x: x.posicion.x, y: x.posicion.y, r: x.radioCiudad * M + 0.4 });
    }
    for (const x of m.pueblos) {
      pueblo(encima, x.posicion.x, x.posicion.y, x.aldea, x.color, semilla(x.posicion.x, x.posicion.y));
      claros.push({ x: x.posicion.x, y: x.posicion.y, r: (x.aldea ? 1.4 : 0.9) * M });
    }
    for (const x of m.avanzadas) {
      avanzada(encima, x.posicion.x, x.posicion.y, x.etapa, x.ruinas, x.color);
      claros.push({ x: x.posicion.x, y: x.posicion.y, r: 0.7 * M });
    }
    for (const x of m.obras) {
      obra(encima, x.posicion.x, x.posicion.y, x.arrancada, x.color);
      claros.push({ x: x.posicion.x, y: x.posicion.y, r: 0.6 * M });
    }
    for (const x of m.campamentos) {
      campamento(encima, x.posicion.x, x.posicion.y, semilla(x.posicion.x, x.posicion.y));
      claros.push({ x: x.posicion.x, y: x.posicion.y, r: 0.9 * M * MUNDO3D.campamento });
    }
    for (const x of m.bandidos) {
      bandidos(encima, x.posicion.x, x.posicion.y, x.nivel, semilla(x.posicion.x, x.posicion.y));
      claros.push({ x: x.posicion.x, y: x.posicion.y, r: 0.6 * M * MUNDO3D.campamento });
    }
    for (const x of m.alijos) alijo(encima, x.posicion.x, x.posicion.y);
    for (const x of m.batallas) batalla(encima, x.posicion.x, x.posicion.y, x.propia);
    this.poner(encima, false);
    this.poner(bajo, true);
    this.claros = claros;
    this.claveClaros = claros.map((c) => `${f(c.x)},${f(c.y)},${f(c.r)}`).join(';');
    return true;
  }

  private poner(p: Piezas, bajoNiebla: boolean): void {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const malla = (geo: THREE.BufferGeometry, mat: THREE.Material, lista: Pieza[], escala: (x: Pieza) => [number, number, number]) => {
      const im = new THREE.InstancedMesh(geo, mat, lista.length);
      const asentar = () => {
        lista.forEach((x, k) => {
          e.set(0, -x.giro, x.inclina ?? 0);
          q.setFromEuler(e);
          s.set(...escala(x));
          v.set(x.x, this.suelo.alturaU(x.x, x.y) - 0.02 + x.base, x.y);
          im.setMatrixAt(k, m.compose(v, q, s));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
      };
      asentar();
      this.puestas.push(asentar);
      im.castShadow = im.receiveShadow = true;
      this.grupo.add(im);
    };
    for (const [mat, lista] of p.por) {
      const tienda = mat === 'lona' || mat === 'lonaOscura';
      malla(tienda ? GEO.tienda : GEO.caja, this.material(COLORES[mat as Material], bajoNiebla), lista, (x) => [x.ancho, x.alto, x.fondo]);
    }
    for (const [color, lista] of p.banderas) malla(GEO.bandera, this.material(color, bajoNiebla), lista, (x) => [x.ancho, x.alto, x.fondo]);
  }

  private vaciar(): void {
    this.puestas = [];
    for (const im of [...this.grupo.children]) {
      this.grupo.remove(im);
      (im as THREE.InstancedMesh).dispose();
    }
  }

  destruir(): void {
    this.vaciar();
    for (const m of this.materiales.values()) m.dispose();
  }
}

/** Las cajas de la maqueta de una plaza, por material (para las pruebas y los bancos: se ve desde arriba sin WebGL). */
export function piezasDeCiudad(x: number, y: number, rc: number, nivel: number, sem: number): { mat: string; x: number; y: number; ancho: number; fondo: number; alto: number; giro: number; base: number }[] {
  const p = new Piezas();
  ciudad(p, x, y, rc, nivel, '#000000', sem);
  return [...p.por].flatMap(([mat, l]) => l.map((q) => ({ mat, ...q })));
}
