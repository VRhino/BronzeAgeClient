// Las maquetas de una columna: sus héroes a caballo al frente, su tropa detrás, de tres en fondo, y sus carros al final (el de fundación, con
// lona), todos pisando el rastro de la cabeza. Las mismas de la mesa de escalas 3D, a la escala `MUNDO3D.tropa`. Una caravana suelta es una
// columna sin gente: su carro con el buey.
import * as THREE from 'three';
import { MUNDO3D } from './config';
import type { Carros } from './estado';

type Punto = { x: number; y: number };

function caja(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** Geometrías y materiales compartidos por todas las columnas. */
const PIEZAS = (() => {
  const m = (color: number) => new THREE.MeshLambertMaterial({ color });
  const escudo = new THREE.CylinderGeometry(0.032, 0.032, 0.008, 10);
  escudo.rotateZ(Math.PI / 2);
  escudo.translate(-0.034, 0.06, 0);
  const cuello = new THREE.BoxGeometry(0.035, 0.07, 0.04);
  cuello.rotateX(-0.5);
  cuello.translate(0, 0.13, 0.075);
  return {
    cuerpo: caja(0.055, 0.1, 0.045, 0, 0.05, 0),
    cabeza: caja(0.036, 0.036, 0.036, 0, 0.118, 0),
    lanza: caja(0.008, 0.24, 0.008, 0.034, 0.11, 0),
    escudo,
    bandera: caja(0.004, 0.07, 0.1, 0.034, 0.2, -0.05),
    lomo: caja(0.05, 0.055, 0.16, 0, 0.085, 0),
    cuello,
    patas: caja(0.04, 0.06, 0.12, 0, 0.03, 0),
    jinete: caja(0.045, 0.07, 0.035, 0, 0.145, -0.01),
    yelmo: caja(0.032, 0.034, 0.032, 0, 0.197, -0.01),
    penacho: caja(0.008, 0.03, 0.05, 0, 0.225, -0.015),
    caja: caja(0.1, 0.05, 0.16, 0, 0.075, 0),
    lona: caja(0.1, 0.06, 0.13, 0, 0.13, -0.01),
    rueda: (() => { const g = new THREE.CylinderGeometry(0.032, 0.032, 0.012, 10); g.rotateZ(Math.PI / 2); return g; })(),
    buey: caja(0.05, 0.05, 0.11, 0, 0.055, 0.17),
    testuz: caja(0.035, 0.035, 0.04, 0, 0.075, 0.24),
    pelaje: m(0x6b4a2e),
    blanco: m(0xd8cfbd),
    buey_: m(0x8c7a64),
    bronce: m(0xc08a3e),
    piel: m(0xc89a78),
    madera: m(0x8a6440),
  };
})();

const MATERIAL_TUNICA = new Map<number, THREE.MeshLambertMaterial>();
const tunica = (color: number) => {
  let mat = MATERIAL_TUNICA.get(color);
  if (!mat) MATERIAL_TUNICA.set(color, (mat = new THREE.MeshLambertMaterial({ color })));
  return mat;
};

function heroe(color: number): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.lomo, p.pelaje), new THREE.Mesh(p.cuello, p.pelaje), new THREE.Mesh(p.patas, p.pelaje), new THREE.Mesh(p.jinete, p.bronce), new THREE.Mesh(p.yelmo, p.bronce), new THREE.Mesh(p.penacho, tunica(color)));
  return g;
}

function soldado(color: number, abanderado: boolean): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.cuerpo, tunica(color)), new THREE.Mesh(p.cabeza, p.piel), new THREE.Mesh(p.lanza, p.madera), new THREE.Mesh(p.escudo, p.bronce));
  if (abanderado) g.add(new THREE.Mesh(p.bandera, tunica(color)));
  return g;
}

/** Un carro con su buey; el de fundación, con la lona puesta. */
function carro(fundacion: boolean): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.caja, p.madera), new THREE.Mesh(p.buey, p.buey_), new THREE.Mesh(p.testuz, p.buey_));
  for (const [x, z] of [[-0.058, -0.05], [0.058, -0.05], [-0.058, 0.05], [0.058, 0.05]] as const) {
    const r = new THREE.Mesh(p.rueda, p.madera);
    r.position.set(x, 0.032, z);
    g.add(r);
  }
  if (fundacion) g.add(new THREE.Mesh(p.lona, p.blanco));
  return g;
}

/** Lo que se separa un bloque de tropa del siguiente además del paso entre filas (en unidades de figura). */
const HUECO_ENTRE_BLOQUES = 0.08;
/** Como mucho, escuadras que se pintan: 6 en una columna personal (36 figuras), 12 en un ejército (48). */
const MAX_ESCUADRAS = { personal: 6, ejercito: 12 } as const;

/** La tropa de una columna: cuántas escuadras lleva cada héroe, en el orden en que van, y si es un ejército. */
export interface TropaDeColumna { porHeroe: number[]; ejercito: boolean }

/** Los bloques de tropa (Víctor, 2026-10-31). En una columna personal, un bloque por escuadra de dos filas de tres; en un ejército, un bloque
 * por héroe con una fila de cuatro por cada una de sus escuadras. Entre bloques, un hueco algo mayor que entre filas. */
export function bloquesDeTropa(t: TropaDeColumna): { filas: number; ancho: number }[] {
  let quedan = MAX_ESCUADRAS[t.ejercito ? 'ejercito' : 'personal'];
  const recorta = (n: number) => { const m = Math.max(0, Math.min(n, quedan)); quedan -= m; return m; };
  if (!t.ejercito) return Array.from({ length: recorta(t.porHeroe.reduce((s, n) => s + n, 0)) }, () => ({ filas: 2, ancho: 3 }));
  return t.porHeroe.map(recorta).filter((n) => n > 0).map((n) => ({ filas: n, ancho: 4 }));
}

export class FigurasDeColumna {
  readonly grupo = new THREE.Group();
  private readonly figuras: THREE.Group[] = [];
  /** Por dónde ha pasado la cabeza, del más viejo al más nuevo. */
  private rastro: Punto[] = [];

  /** Cuánto va cada figura detrás de la cabeza y a qué lado (−1, 0, 1), en unidades de figura (×`MUNDO3D.tropa`). */
  private readonly sitios: { atras: number; lado: number }[] = [];

  /** `jinetes`: héroes de la columna (al frente, a caballo); `tropa`: las escuadras detrás, por bloques (`bloquesDeTropa`; la primera figura
   * lleva el estandarte); `carros`: lo que arrastra al final. */
  constructor(readonly jinetes: number, tropa: TropaDeColumna, color: number, readonly carros: Carros = { carga: 0, fundacion: false }) {
    for (let k = 0; k < jinetes; k++) { this.figuras.push(heroe(color)); this.sitios.push({ atras: k * 0.15, lado: 0 }); }
    // entre filas de un bloque, el paso de siempre; entre un bloque y el siguiente, un poco más
    let ultima = jinetes * 0.15 - 0.15, fila = jinetes, soldados = 0;
    bloquesDeTropa(tropa).forEach((b, i) => {
      for (let f = 0; f < b.filas; f++, fila++) {
        ultima = fila * 0.15 + i * HUECO_ENTRE_BLOQUES;
        for (let k = 0; k < b.ancho; k++) {
          this.figuras.push(soldado(color, soldados++ === 0));
          this.sitios.push({ atras: ultima, lado: k - (b.ancho - 1) / 2 });
        }
      }
    });
    const tras = ultima + 0.15 + (jinetes + soldados ? 0.12 : 0), n = carros.carga + (carros.fundacion ? 1 : 0);
    for (let k = 0; k < n; k++) { this.figuras.push(carro(carros.fundacion && k === n - 1)); this.sitios.push({ atras: tras + k * 0.34, lado: 0 }); }
    for (const f of this.figuras) {
      f.scale.setScalar(MUNDO3D.tropa);
      f.traverse((o) => { o.castShadow = true; });
      this.grupo.add(f);
    }
  }

  /** Pone la columna con la cabeza en `cabeza`; `alturaU(x, y)` da el suelo en unidades de escena. */
  mover(cabeza: Punto, alturaU: (x: number, y: number) => number): void {
    const ultimo = this.rastro[this.rastro.length - 1];
    if (!ultimo || Math.hypot(cabeza.x - ultimo.x, cabeza.y - ultimo.y) > 6) {
      // primera vez o un salto: la columna se forma detrás, hacia el sur
      this.rastro = Array.from({ length: 30 }, (_, k) => ({ x: cabeza.x, y: cabeza.y + (29 - k) * 0.3 }));
    } else if (Math.hypot(cabeza.x - ultimo.x, cabeza.y - ultimo.y) > 0.03) {
      this.rastro.push({ x: cabeza.x, y: cabeza.y });
      if (this.rastro.length > 400) this.rastro.shift();
    }
    const M = MUNDO3D.tropa;
    this.figuras.forEach((f, k) => {
      // los héroes uno tras otro; la tropa, de tres en fondo; los carros, al final
      const { lado } = this.sitios[k]!;
      let atras = this.sitios[k]!.atras * M, i = this.rastro.length - 1, x = cabeza.x, y = cabeza.y, rumbo = 0;
      while (i > 0) {
        const a = this.rastro[i - 1]!, b = this.rastro[i]!, l = Math.hypot(b.x - a.x, b.y - a.y);
        rumbo = Math.atan2(b.y - a.y, b.x - a.x);
        if (l >= atras) { const t = l ? atras / l : 0; x = b.x + (a.x - b.x) * t; y = b.y + (a.y - b.y) * t; break; }
        atras -= l; x = a.x; y = a.y; i--;
      }
      const px = x - Math.sin(rumbo) * lado * 0.1 * M, py = y + Math.cos(rumbo) * lado * 0.1 * M;
      f.position.set(px, alturaU(px, py), py);
      f.rotation.y = -rumbo + Math.PI / 2;
    });
  }

  destruir(): void {
    this.grupo.removeFromParent();
  }
}
