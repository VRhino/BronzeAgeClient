// Las maquetas de plazas, pueblos, avanzadas, obras y campamentos (de mercenarios y de bandidos), alijos y batallas, a la escala del juego
// (`MUNDO3D.maqueta`, ×1): las piezas de la mesa de escalas 3D (muralla, casas, empalizada, torre, tiendas) y una bandera del color de su
// Facción. Todas las de un material van en una sola malla instanciada. Las plazas que solo se recuerdan van bajo la niebla (oscurecidas, como
// en `render.ts`); lo demás, encima: lo propio y lo que se ve ahora.
import * as THREE from 'three';
import type { Claro } from './arboles';
import { MUNDO3D } from './config';
import type { MundoEnVista } from './estado';
import type { NieblaDeGuerra } from './niebla';

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

/** Casas repartidas entre `desde` y `hasta` u del centro. */
function casas(p: Piezas, x: number, y: number, n: number, desde: number, hasta: number, tam: number, sem: number, techo: number): void {
  for (let k = 0; k < n; k++) {
    const a = hash(sem, k, 1) * 2 * Math.PI, d = desde + (hasta - desde) * Math.sqrt(hash(sem, k, 2));
    p.caja(hash(sem, k, 6) < techo ? 'techo' : 'adobe', x + d * Math.cos(a), y + d * Math.sin(a), (0.1 + 0.08 * hash(sem, k, 3)) * tam, (0.1 + 0.08 * hash(sem, k, 4)) * tam, (0.07 + 0.06 * hash(sem, k, 5)) * tam, a);
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
  if (n === 1) {
    // la casa del jefe, chozas y un corral de madera
    p.caja('techo', x, y, 0.2 * M, 0.16 * M, 0.11 * M);
    casas(p, x, y, cuantas, 0.2 * M, borde * 0.7, M * 0.85, sem, 0.15);
    p.anillo(x + 0.3 * M, y - 0.25 * M, 0.12 * M, 0.04 * M, 0.015 * M, 'madera', -1);
    p.bandera(x + 0.12 * M, y + 0.1 * M, 0.4 * M, color);
    return;
  }
  if (n === 2) {
    // casa grande con su patio (cuatro alas bajas), el granero y más casas
    p.caja('adobe', x, y, 0.3 * M, 0.24 * M, 0.16 * M);
    p.caja('techo', x, y, 0.32 * M, 0.26 * M, 0.03 * M, 0, 0.16 * M);
    p.caja('adobe', x, y + 0.2 * M, 0.36 * M, 0.06 * M, 0.06 * M);
    p.caja('adobe', x, y - 0.2 * M, 0.36 * M, 0.06 * M, 0.06 * M);
    p.caja('madera', x - 0.32 * M, y + 0.05 * M, 0.12 * M, 0.12 * M, 0.14 * M);
    casas(p, x, y, cuantas, 0.3 * M, borde * 0.85, M, sem, 0.3);
    p.bandera(x + 0.14 * M, y + 0.1 * M, 0.5 * M, color);
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
  const desde = n === 5 ? Math.min(0.75 * M, r * 0.45) + 0.15 * M : 0.3 * M;
  casas(p, x, y, cuantas, desde, borde, M, sem, 0.25 + 0.1 * (n - 3));
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

  constructor(private readonly niebla: NieblaDeGuerra, private readonly alturaU: (x: number, y: number) => number) {}

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
    if (clave === this.clave) return false;
    this.clave = clave;
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
      lista.forEach((x, k) => {
        e.set(0, -x.giro, x.inclina ?? 0);
        q.setFromEuler(e);
        s.set(...escala(x));
        v.set(x.x, this.alturaU(x.x, x.y) - 0.02 + x.base, x.y);
        im.setMatrixAt(k, m.compose(v, q, s));
      });
      im.computeBoundingSphere();
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
