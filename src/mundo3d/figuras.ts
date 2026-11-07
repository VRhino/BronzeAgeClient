// Las maquetas de una columna: sus héroes a caballo al frente, su tropa detrás, de tres en fondo, el carrito del héroe (sin animal) si lleva algo y
// al final los carros de sus caravanas (más grandes, cada uno con su animal y de dos en dos; el de fundación, con lona), todos pisando el rastro
// de la cabeza.
// Las mismas de la mesa de escalas 3D, a la escala `MUNDO3D.tropa`. Una caravana suelta es una columna sin héroes: su escolta y sus carros.
import * as THREE from 'three';
import { MUNDO3D } from './config';
import type { AnimalDeTiro, Carros } from './estado';

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
    vara: caja(0.008, 0.008, 0.08, 0, 0.05, 0.11),
    buey: caja(0.05, 0.05, 0.11, 0, 0.055, 0.19),
    testuz: caja(0.035, 0.035, 0.04, 0, 0.075, 0.26),
    cuernos: caja(0.064, 0.008, 0.008, 0, 0.097, 0.262),
    caballo: caja(0.04, 0.045, 0.12, 0, 0.075, 0.2),
    patasCaballo: caja(0.034, 0.055, 0.1, 0, 0.027, 0.2),
    cuelloCaballo: (() => { const g = new THREE.BoxGeometry(0.028, 0.06, 0.032); g.rotateX(-0.6); g.translate(0, 0.115, 0.265); return g; })(),
    cabezaCaballo: caja(0.024, 0.024, 0.05, 0, 0.14, 0.295),
    camello: caja(0.05, 0.05, 0.13, 0, 0.095, 0.2),
    joroba: caja(0.036, 0.032, 0.05, 0, 0.134, 0.19),
    patasCamello: caja(0.04, 0.07, 0.11, 0, 0.035, 0.2),
    cuelloCamello: (() => { const g = new THREE.BoxGeometry(0.022, 0.075, 0.024); g.rotateX(-0.45); g.translate(0, 0.13, 0.28); return g; })(),
    cabezaCamello: caja(0.024, 0.022, 0.042, 0, 0.165, 0.3),
    // el carrito del héroe: dos ruedas, una caja corta con sus fardos y dos varas hacia delante
    cajita: caja(0.07, 0.035, 0.085, 0, 0.05, 0),
    fardos: caja(0.056, 0.026, 0.065, 0, 0.08, -0.004),
    varas: [caja(0.006, 0.006, 0.09, -0.026, 0.045, 0.085), caja(0.006, 0.006, 0.09, 0.026, 0.045, 0.085)],
    ruedita: (() => { const g = new THREE.CylinderGeometry(0.028, 0.028, 0.01, 10); g.rotateZ(Math.PI / 2); return g; })(),
    // el Aeda: a pie, con el manto largo hasta los pies, el bastón y la lira colgada al costado; detrás, su burro con las alforjas
    manto: caja(0.056, 0.11, 0.046, 0, 0.055, 0),
    banda: caja(0.058, 0.014, 0.048, 0, 0.078, 0),
    cabezaAeda: caja(0.034, 0.034, 0.034, 0, 0.127, 0.002),
    capucha: caja(0.042, 0.036, 0.016, 0, 0.13, -0.022),
    baston: caja(0.007, 0.21, 0.007, 0.038, 0.105, 0.014),
    liraBrazos: [caja(0.007, 0.07, 0.007, -0.05, 0.085, -0.016), caja(0.007, 0.07, 0.007, -0.05, 0.085, 0.016)],
    liraYugo: caja(0.007, 0.007, 0.046, -0.05, 0.12, 0),
    liraCaja: caja(0.012, 0.016, 0.036, -0.05, 0.05, 0),
    burro: caja(0.036, 0.04, 0.09, 0, 0.055, 0),
    patasBurro: caja(0.03, 0.04, 0.075, 0, 0.02, 0),
    cabezaBurro: (() => { const g = new THREE.BoxGeometry(0.022, 0.045, 0.03); g.rotateX(-0.5); g.translate(0, 0.088, 0.055); return g; })(),
    orejas: caja(0.026, 0.02, 0.006, 0, 0.118, 0.06),
    alforjas: caja(0.058, 0.028, 0.045, 0, 0.068, -0.008),
    pelaje: m(0x6b4a2e),
    blanco: m(0xd8cfbd),
    buey_: m(0x8c7a64),
    camello_: m(0xc2a070),
    arpillera: m(0xb89a6a),
    bronce: m(0xc08a3e),
    piel: m(0xc89a78),
    madera: m(0x8a6440),
    lana: m(0xe9dcc0),
    ocre: m(0xa4452c),
    ceniza: m(0x8f877a),
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

/** El Aeda itinerante, a pie: manto claro de lana con banda ocre, la capucha caída a la espalda, bastón y lira de bronce al costado. */
function aeda(): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.manto, p.lana), new THREE.Mesh(p.banda, p.ocre), new THREE.Mesh(p.cabezaAeda, p.piel), new THREE.Mesh(p.capucha, p.ocre),
    new THREE.Mesh(p.baston, p.madera), ...p.liraBrazos.map((b) => new THREE.Mesh(b, p.bronce)), new THREE.Mesh(p.liraYugo, p.bronce), new THREE.Mesh(p.liraCaja, p.madera));
  return g;
}

/** Su burro, con las alforjas. */
function burro(): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.burro, p.ceniza), new THREE.Mesh(p.patasBurro, p.ceniza), new THREE.Mesh(p.cabezaBurro, p.ceniza), new THREE.Mesh(p.orejas, p.ceniza), new THREE.Mesh(p.alforjas, p.arpillera));
  return g;
}

/** Las piezas del animal que tira de un carro de caravana, delante de él (+z). */
function animal(a: AnimalDeTiro): THREE.Mesh[] {
  const p = PIEZAS, mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);
  if (a === 'caballo') return [mesh(p.caballo, p.pelaje), mesh(p.patasCaballo, p.pelaje), mesh(p.cuelloCaballo, p.pelaje), mesh(p.cabezaCaballo, p.pelaje)];
  if (a === 'camello') return [mesh(p.camello, p.camello_), mesh(p.joroba, p.camello_), mesh(p.patasCamello, p.camello_), mesh(p.cuelloCamello, p.camello_), mesh(p.cabezaCamello, p.camello_)];
  return [mesh(p.buey, p.buey_), mesh(p.testuz, p.buey_), mesh(p.cuernos, p.blanco)];
}

/** Un carro de caravana con su animal; el de fundación, con la lona puesta. */
function carro(fundacion: boolean, tiro: AnimalDeTiro): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.caja, p.madera), new THREE.Mesh(p.vara, p.madera), ...animal(tiro));
  for (const [x, z] of [[-0.058, -0.05], [0.058, -0.05], [-0.058, 0.05], [0.058, 0.05]] as const) {
    const r = new THREE.Mesh(p.rueda, p.madera);
    r.position.set(x, 0.032, z);
    g.add(r);
  }
  if (fundacion) g.add(new THREE.Mesh(p.lona, p.blanco));
  return g;
}

/** El carrito del héroe: pequeño, de dos ruedas y sin animal. */
function carrito(): THREE.Group {
  const p = PIEZAS, g = new THREE.Group();
  g.add(new THREE.Mesh(p.cajita, p.madera), new THREE.Mesh(p.fardos, p.arpillera), ...p.varas.map((v) => new THREE.Mesh(v, p.madera)));
  for (const x of [-0.042, 0.042]) {
    const r = new THREE.Mesh(p.ruedita, p.madera);
    r.position.set(x, 0.028, -0.01);
    g.add(r);
  }
  return g;
}

/** Cuánto más grande va un carro de caravana que el resto de las figuras, para que no se confunda con el carrito del héroe. */
export const ESCALA_CARRO_CARAVANA = 1.5;
/** Lo que ocupa cada carro delante y detrás de su sitio, en unidades de figura (sin su escala): el de caravana con su animal, el carrito con
 * sus varas. */
const LARGO = { caravana: { frente: 0.325, cola: 0.085 }, carrito: { frente: 0.13, cola: 0.045 } } as const;

/** A qué lado del centro va cada carro de una pareja, en el `lado` de los sitios (× 0,1 unidades de figura): el carro de caravana mide 0,13 de
 * ancho (×1,5), así queda un palmo entre los dos. */
const LADO_CARRO_PAREJA = 1.3;

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

/** Las figuras de todas las columnas, en una malla instanciada por pieza y material: con decenas de columnas a la vista, cada pieza de cada
 * figura como malla suelta eran miles de llamadas de dibujo (el doble con la sombra). Se rellena en cada fotograma. */
export class Tropel {
  readonly grupo = new THREE.Group();
  /** Por geometría y material (sin claves de texto: se mira en cada pieza de cada fotograma). */
  private readonly piezas = new Map<THREE.BufferGeometry, Map<THREE.Material, { n: number; malla: THREE.InstancedMesh | null }>>();
  private readonly m = new THREE.Matrix4();

  pintar(columnas: readonly FigurasDeColumna[]): void {
    for (const porMat of this.piezas.values()) for (const p of porMat.values()) p.n = 0;
    // primero se cuentan, para que cada malla tenga sitio; luego se escriben las matrices directamente en ella
    for (const c of columnas) for (const f of c.figuras) for (const o of f.children as THREE.Mesh[]) this.pieza(o).n++;
    for (const [geo, porMat] of this.piezas) for (const [mat, p] of porMat) {
      if (p.malla && p.malla.instanceMatrix.count < p.n) { p.malla.removeFromParent(); p.malla.dispose(); p.malla = null; }
      if (!p.malla && p.n) {
        p.malla = new THREE.InstancedMesh(geo, mat, Math.max(64, p.n * 2));
        p.malla.castShadow = true;
        p.malla.frustumCulled = false; // se mueven en cada fotograma: no vale la esfera de un momento
        this.grupo.add(p.malla);
      }
      if (p.malla) p.malla.count = 0;
    }
    for (const c of columnas) for (const f of c.figuras) {
      f.updateMatrix();
      for (const o of f.children as THREE.Mesh[]) {
        const malla = this.pieza(o).malla!;
        this.m.multiplyMatrices(f.matrix, o.matrix).toArray(malla.instanceMatrix.array, 16 * malla.count++);
      }
    }
    for (const porMat of this.piezas.values()) for (const { malla } of porMat.values()) {
      if (!malla) continue;
      malla.instanceMatrix.clearUpdateRanges();
      malla.instanceMatrix.addUpdateRange(0, 16 * malla.count);
      malla.instanceMatrix.needsUpdate = true;
    }
  }

  private pieza(o: THREE.Mesh): { n: number; malla: THREE.InstancedMesh | null } {
    let porMat = this.piezas.get(o.geometry);
    if (!porMat) this.piezas.set(o.geometry, (porMat = new Map()));
    const mat = o.material as THREE.Material;
    let p = porMat.get(mat);
    if (!p) porMat.set(mat, (p = { n: 0, malla: null }));
    return p;
  }

  destruir(): void {
    for (const porMat of this.piezas.values()) for (const p of porMat.values()) p.malla?.dispose();
    this.grupo.removeFromParent();
  }
}

/** Las figuras de un Aeda itinerante (`FigurasDeColumna` con él y su burro). */
export const figurasDeAeda = (): FigurasDeColumna => new FigurasDeColumna(0, { porHeroe: [], ejercito: false }, 0, { carga: 0, fundacion: false }, true);

export class FigurasDeColumna {
  /** Cada figura, con sus piezas como hijas: no van a la escena, las pinta `Tropel`. */
  readonly figuras: THREE.Group[] = [];
  /** Por dónde ha pasado la cabeza, del más viejo al más nuevo. */
  private rastro: Punto[] = [];
  /** Dónde estaba la cabeza la última vez que se colocó. */
  private puesta: (Punto & { suelo: number }) | null = null;

  /** Cuánto va cada figura detrás de la cabeza y a qué lado (−1, 0, 1), en unidades de figura (×`MUNDO3D.tropa`). */
  private readonly sitios: { atras: number; lado: number }[] = [];

  /** `jinetes`: héroes de la columna (al frente, a caballo); `tropa`: las escuadras detrás, por bloques (`bloquesDeTropa`; la primera figura
   * lleva el estandarte; en una caravana, su escolta); `carros`: lo que arrastra al final. */
  constructor(readonly jinetes: number, tropa: TropaDeColumna, color: number, readonly carros: Carros = { carga: 0, fundacion: false }, deAeda = false) {
    const poner = (f: THREE.Group, atras: number, lado: number, escala = 1) => {
      f.scale.setScalar(MUNDO3D.tropa * escala);
      for (const o of f.children) o.updateMatrix();
      this.figuras.push(f);
      this.sitios.push({ atras, lado });
    };
    // un Aeda itinerante: él delante y su burro a su lado, un paso por detrás
    if (deAeda) { poner(aeda(), 0, 0); poner(burro(), 0.1, 0.9); return; }
    for (let k = 0; k < jinetes; k++) poner(heroe(color), k * 0.15, 0);
    // entre filas de un bloque, el paso de siempre; entre un bloque y el siguiente, un poco más
    let ultima = jinetes * 0.15 - 0.15, fila = jinetes, soldados = 0;
    bloquesDeTropa(tropa).forEach((b, i) => {
      for (let f = 0; f < b.filas; f++, fila++) {
        ultima = fila * 0.15 + i * HUECO_ENTRE_BLOQUES;
        for (let k = 0; k < b.ancho; k++) poner(soldado(color, soldados++ === 0), ultima, k - (b.ancho - 1) / 2);
      }
    });
    // los carros detrás de la última fila (sin nadie delante, el primero va en la cabeza): el carrito y luego los de las caravanas, cada uno con
    // su animal, de dos en dos (Víctor, 2026-11-04); si son impares, el último solo, en el centro
    let detras = jinetes + soldados ? ultima + 0.1 : null;
    const enganchar = (fila: THREE.Group[], largo: { frente: number; cola: number }, escala: number) => {
      const atras = detras === null ? 0 : detras + largo.frente * escala;
      detras = atras + largo.cola * escala + 0.04;
      fila.forEach((f, k) => poner(f, atras, fila.length === 1 ? 0 : (k === 0 ? -1 : 1) * LADO_CARRO_PAREJA, escala));
    };
    if (carros.propio) enganchar([carrito()], LARGO.carrito, 1);
    const n = carros.carga + (carros.fundacion ? 1 : 0);
    const carroN = (k: number) => carro(carros.fundacion && k === n - 1, carros.animales?.[k] ?? 'buey');
    for (let k = 0; k < n; k += 2) enganchar(k + 1 < n ? [carroN(k), carroN(k + 1)] : [carroN(k)], LARGO.caravana, ESCALA_CARRO_CARAVANA);
  }

  /** Pone la columna con la cabeza en `cabeza`; `alturaU(x, y)` da el suelo en unidades de escena y `suelo` cambia cuando ese suelo cambia (se
   * puso o quitó una tesela). */
  mover(cabeza: Punto, alturaU: (x: number, y: number) => number, suelo = 0): void {
    // quieta y sobre el mismo suelo, todo sigue donde estaba (con decenas de columnas, la mayoría lo están)
    if (this.puesta && cabeza.x === this.puesta.x && cabeza.y === this.puesta.y && this.puesta.suelo === suelo) return;
    this.puesta = { x: cabeza.x, y: cabeza.y, suelo };
    const ultimo = this.rastro[this.rastro.length - 1];
    if (!ultimo || Math.hypot(cabeza.x - ultimo.x, cabeza.y - ultimo.y) > 6) {
      // primera vez o un salto: la columna se forma detrás, hacia el sur
      this.rastro = Array.from({ length: 30 }, (_, k) => ({ x: cabeza.x, y: cabeza.y + (29 - k) * 0.3 }));
    } else if (Math.hypot(cabeza.x - ultimo.x, cabeza.y - ultimo.y) > 0.03) {
      this.rastro.push({ x: cabeza.x, y: cabeza.y });
      if (this.rastro.length > 400) this.rastro.shift();
    }
    const M = MUNDO3D.tropa;
    for (let k = 0; k < this.figuras.length; k++) {
      const f = this.figuras[k]!;
      // los héroes uno tras otro; la tropa, de tres en fondo; los carros, al final
      const { lado } = this.sitios[k]!;
      let atras = this.sitios[k]!.atras * M, i = this.rastro.length - 1, x = cabeza.x, y = cabeza.y, rumbo = 0;
      while (i > 0) {
        const a = this.rastro[i - 1]!, b = this.rastro[i]!, dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy);
        rumbo = Math.atan2(b.y - a.y, b.x - a.x);
        if (l >= atras) { const t = l ? atras / l : 0; x = b.x + (a.x - b.x) * t; y = b.y + (a.y - b.y) * t; break; }
        atras -= l; x = a.x; y = a.y; i--;
      }
      const px = x - Math.sin(rumbo) * lado * 0.1 * M, py = y + Math.cos(rumbo) * lado * 0.1 * M;
      f.position.set(px, alturaU(px, py), py);
      f.rotation.y = -rumbo + Math.PI / 2;
    }
  }
}
