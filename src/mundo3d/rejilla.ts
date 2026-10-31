// La rejilla de movimiento del servidor (`ArtefactoDeMundo.navegacion`: nodos cada ~4 u y sus aristas con el coste de andarlas) pintada sobre el
// relieve alrededor del héroe, para ver por dónde puede ir una columna y cuánto le cuesta: verde el llano, hacia rojo lo caro y en azul los vados.
// Se enciende desde el menú de la esquina. Solo se pinta lo de cerca: el grafo entero son cientos de miles de aristas.
import * as THREE from 'three';
import type { GrafoNavegacion } from '../contrato/gen/bronzeage/v1/world_pb';

type Punto = { x: number; y: number };

/** Lado de las casillas del índice, en u. */
const CASILLA = 8;
/** Hasta dónde se pinta alrededor del héroe (u) y cuánto tiene que moverse para repintarla. */
const RADIO = 40, REPINTAR = 4;

/** El grafo en arrays planos, con las aristas repartidas por la casilla de su primer nodo. */
export interface Navegacion {
  x: Float32Array;
  y: Float32Array;
  a: Int32Array;
  b: Int32Array;
  coste: Uint16Array;
  vado: Uint8Array;
  porCasilla: Map<number, number[]>;
}

const clave = (cx: number, cy: number): number => cx * 100_000 + cy;

/** Pasa el grafo del contrato (milésimas, ids de nodo) a arrays por índice. */
export function navegacionDesdeGrafo(g: GrafoNavegacion): Navegacion {
  const n = g.nodos.length, x = new Float32Array(n), y = new Float32Array(n), indice = new Map<number, number>();
  g.nodos.forEach((nodo, i) => {
    x[i] = Number(nodo.posicion?.x ?? 0n) / 1000;
    y[i] = Number(nodo.posicion?.y ?? 0n) / 1000;
    indice.set(nodo.id, i);
  });
  const m = g.aristas.length, a = new Int32Array(m), b = new Int32Array(m), coste = new Uint16Array(m), vado = new Uint8Array(m);
  const porCasilla = new Map<number, number[]>();
  g.aristas.forEach((e, k) => {
    const ia = indice.get(e.a) ?? -1, ib = indice.get(e.b) ?? -1;
    a[k] = ia; b[k] = ib;
    coste[k] = Math.min(65535, e.costeMilesimas);
    vado[k] = e.vado ? 1 : 0;
    if (ia < 0 || ib < 0) return;
    const c = clave(Math.floor(x[ia]! / CASILLA), Math.floor(y[ia]! / CASILLA));
    let l = porCasilla.get(c);
    if (!l) porCasilla.set(c, (l = []));
    l.push(k);
  });
  return { x, y, a, b, coste, vado, porCasilla };
}

const LLANO = new THREE.Color(0x6fc46a), CARO = new THREE.Color(0xe0503a), VADO = new THREE.Color(0x4aa3df);

export class RejillaDeMovimiento {
  readonly grupo = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  private navegacion: Navegacion | null = null;
  private visible = false;
  private centro: Punto | null = null;

  constructor(private readonly alturaU: (x: number, y: number) => number) {}

  fijar(navegacion: Navegacion | null, visible: boolean): void {
    if (navegacion !== this.navegacion || visible !== this.visible) this.centro = null;
    this.navegacion = navegacion;
    this.visible = visible;
    if (!visible) this.vaciar();
  }

  /** Repinta alrededor de (x, y) si se encendió o el héroe se movió. */
  actualizar(x: number, y: number): void {
    const nav = this.navegacion;
    if (!this.visible || !nav) return;
    if (this.centro && Math.hypot(this.centro.x - x, this.centro.y - y) < REPINTAR) return;
    this.centro = { x, y };
    this.vaciar();
    const pos: number[] = [], col: number[] = [], c = new THREE.Color();
    const desde = Math.floor((x - RADIO) / CASILLA), hasta = Math.floor((x + RADIO) / CASILLA);
    const desdeY = Math.floor((y - RADIO) / CASILLA), hastaY = Math.floor((y + RADIO) / CASILLA);
    for (let cx = desde; cx <= hasta; cx++) {
      for (let cy = desdeY; cy <= hastaY; cy++) {
        for (const k of nav.porCasilla.get(clave(cx, cy)) ?? []) {
          const ia = nav.a[k]!, ib = nav.b[k]!;
          const ax = nav.x[ia]!, ay = nav.y[ia]!, bx = nav.x[ib]!, by = nav.y[ib]!;
          if (Math.hypot(ax - x, ay - y) > RADIO) continue;
          pos.push(ax, this.alturaU(ax, ay) + 0.08, ay, bx, this.alturaU(bx, by) + 0.08, by);
          // 1000 = llano; a partir de ×3,5 (la montaña) ya es rojo del todo
          if (nav.vado[k]) c.copy(VADO);
          else c.copy(LLANO).lerp(CARO, Math.max(0, Math.min(1, (nav.coste[k]! - 1000) / 2500)));
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
    }
    if (pos.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.grupo.add(new THREE.LineSegments(geo, this.material));
  }

  private vaciar(): void {
    for (const l of [...this.grupo.children]) { this.grupo.remove(l); (l as THREE.LineSegments).geometry.dispose(); }
  }

  destruir(): void {
    this.vaciar();
    this.material.dispose();
  }
}
