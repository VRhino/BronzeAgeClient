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

/** La ciudad del juego: muralla al radio de la ciudad, la casa grande en medio y casas dentro; cuántas, según su tamaño. */
function ciudad(p: Piezas, x: number, y: number, rc: number, color: string, sem: number): void {
  const M = MUNDO3D.maqueta, r = rc * M;
  p.anillo(x, y, r, 0.14 * M, 0.05 * M, 'muro');
  p.caja('muro', x, y, 0.34 * M, 0.26 * M, 0.22 * M);
  const n = Math.max(8, Math.min(160, Math.round(26 * rc * rc))), dentro = Math.max(0.27 * M, r - 0.3 * M);
  for (let k = 0; k < n; k++) {
    const a = hash(sem, k, 1) * 2 * Math.PI, d = 0.25 * M + (dentro - 0.25 * M) * Math.sqrt(hash(sem, k, 2));
    p.caja(hash(sem, k, 6) < 0.3 ? 'techo' : 'adobe', x + d * Math.cos(a), y + d * Math.sin(a), (0.1 + 0.08 * hash(sem, k, 3)) * M, (0.1 + 0.08 * hash(sem, k, 4)) * M, (0.07 + 0.06 * hash(sem, k, 5)) * M, a);
  }
  p.bandera(x + 0.12 * M, y + 0.1 * M, 0.55 * M, color);
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

/** Una avanzada: empalizada (de piedra desde el fuerte) y la torre, más alta en cada etapa. En ruinas, baja y gris, sin bandera. */
function avanzada(p: Piezas, x: number, y: number, etapa: number, ruinas: boolean, color: string): void {
  const M = MUNDO3D.maqueta, e = Math.max(1, Math.min(3, etapa)), torre = [0.42, 0.55, 0.7][e - 1]! * M, lado = [0.13, 0.16, 0.2][e - 1]! * M;
  const mat = (m: Material): Material => (ruinas ? 'ruina' : m);
  p.anillo(x, y, (0.3 + 0.05 * (e - 1)) * M, (ruinas ? 0.04 : 0.1) * M, 0.03 * M, mat(e >= 2 ? 'muro' : 'madera'), 3);
  p.caja(mat(e >= 2 ? 'muro' : 'madera'), x, y, lado, lado, ruinas ? torre * 0.4 : torre);
  p.caja(mat('adobe'), x + 0.12 * M, y + 0.08 * M, 0.1 * M, 0.08 * M, 0.07 * M);
  if (!ruinas) p.bandera(x, y, 0.14 * M, color, torre);
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
  const M = MUNDO3D.maqueta;
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
      ...m.plazas.map((x) => `P${x.id}:${f(x.posicion.x)},${f(x.posicion.y)}:${f(x.radioCiudad)}:${x.color}:${x.recordada}`),
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
      ciudad(x.recordada ? bajo : encima, x.posicion.x, x.posicion.y, x.radioCiudad, x.color, semilla(x.posicion.x, x.posicion.y));
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
