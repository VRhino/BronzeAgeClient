// Lo que el artefacto pone sobre el suelo, por teselas de 64 u alrededor del héroe: los vados de los ríos (un paso de grava de orilla a
// orilla, a ras del agua) y los nodos de recursos (rocas: grises la piedra, del color de su metal los afloramientos). Los ríos mismos, su
// cauce y su agua, son parte del suelo (`rios.ts`, `terreno.ts`). Donde el suelo ya es agua (un lago, el mar) no hay vados. Todo va bajo la
// niebla.
import * as THREE from 'three';
import { RECURSO_COLOR } from '../paletas';
import type { MapaGenerado } from '../terreno';
import { MUNDO3D } from './config';
import type { FuenteDeAltura } from './fuente';
import { cinta } from './lineas';
import type { NieblaDeGuerra } from './niebla';
import type { CampoDeRios } from './rios';
import type { SueloPintado } from './terreno';

type Punto = { x: number; y: number };

const { ladoTesela: LADO, metrosPorUnidad: MPU } = MUNDO3D;
const COLOR = { vado: 0xd9c79a, piedra: 0x8d8d8d };

/** Chaikin: redondea los quiebros de la polilínea del artefacto (cada pasada, dos puntos por tramo al 25 y al 75 %). */
export function suavizar(puntos: readonly Punto[], pasadas = 2): Punto[] {
  let p = [...puntos];
  for (let r = 0; r < pasadas && p.length > 2; r++) {
    const o: Punto[] = [p[0]!];
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k]!, b = p[k + 1]!;
      o.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    o.push(p[p.length - 1]!);
    p = o;
  }
  return p;
}

/** El vado: lo que sobresale de cada orilla (u) y su anchura a lo largo del río (u; como poco `anchoMinimo`, y `anchoPorAncho` del río). */
const VADO = { sobra: 0.8, anchoMinimo: 0.8, anchoPorAncho: 0.35 };

/** Un número fijo entre 0 y 1 por (a, b). */
const azar = (a: number, b: number): number => {
  let h = Math.imul(Math.round(a * 16) | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** La roca de los nodos (un dodecaedro aplastado) y el color de cada metal, en sRGB. */
const ROCA = (() => { const g = new THREE.DodecahedronGeometry(1, 0); g.scale(1, 0.6, 1); return g; })();
const colorDeNodo = (tipo: string): THREE.Color => {
  const gris = new THREE.Color(COLOR.piedra);
  return tipo === 'piedra' ? gris : gris.lerp(new THREE.Color(RECURSO_COLOR[tipo] ?? '#8a4b3a'), 0.7);
};

/** Cuánto se sale de su tesela lo que pone (u): un vado del río más ancho. */
const MARGEN = 5;

export class Paisaje {
  readonly grupo = new THREE.Group();
  private readonly vado: THREE.MeshLambertMaterial;
  private readonly roca: THREE.MeshLambertMaterial;
  /** Cada tesela con la firma del suelo pintado bajo ella (y un margen: los vados se salen): si cambia, se rehace. */
  private readonly teselas = new Map<string, { g: THREE.Group; firma: number }>();
  private readonly alturaU = (x: number, y: number): number => this.suelo.alturaU(x, y);

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra, private readonly suelo: SueloPintado, private readonly rios: CampoDeRios) {
    this.vado = niebla.aplicar(new THREE.MeshLambertMaterial({ color: COLOR.vado, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.roca = niebla.aplicar(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
  }

  /** Pide las teselas a menos de `alcance` u de (cx, cy), las más cercanas primero, mientras quede tiempo (`hasta`), y suelta las lejanas. */
  actualizar(cx: number, cy: number, alcance: number, hasta: number): number {
    const maxX = Math.ceil(this.fuente.ancho / LADO) - 1, maxY = Math.ceil(this.fuente.alto / LADO) - 1;
    const quiero = new Map<string, { tx: number; ty: number; d: number; firma: number }>();
    for (let ty = Math.max(0, Math.floor((cy - alcance) / LADO)); ty <= Math.min(maxY, Math.floor((cy + alcance) / LADO)); ty++) {
      for (let tx = Math.max(0, Math.floor((cx - alcance) / LADO)); tx <= Math.min(maxX, Math.floor((cx + alcance) / LADO)); tx++) {
        const d = Math.hypot(Math.max(tx * LADO - cx, 0, cx - (tx + 1) * LADO), Math.max(ty * LADO - cy, 0, cy - (ty + 1) * LADO));
        if (d <= alcance) quiero.set(`${tx},${ty}`, { tx, ty, d, firma: this.suelo.firma(tx * LADO - MARGEN, ty * LADO - MARGEN, (tx + 1) * LADO + MARGEN, (ty + 1) * LADO + MARGEN) });
      }
    }
    for (const clave of [...this.teselas.keys()]) if (!quiero.has(clave)) this.soltar(clave);
    const pendientes = [...quiero.entries()].filter(([k, t]) => this.teselas.get(k)?.firma !== t.firma).sort((a, b) => a[1].d - b[1].d);
    let hechas = 0;
    for (const [k, t] of pendientes) {
      if (hechas && performance.now() > hasta) break;
      const g = this.tesela(t.tx, t.ty);
      this.soltar(k);
      this.teselas.set(k, { g, firma: t.firma });
      this.grupo.add(g);
      hechas++;
    }
    return pendientes.length - hechas;
  }

  private tesela(tx: number, ty: number): THREE.Group {
    const g = new THREE.Group(), x0 = tx * LADO, y0 = ty * LADO, x1 = x0 + LADO, y1 = y0 + LADO;
    const dentro = (p: Punto) => p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1;
    // los vados, de orilla a orilla (cada uno en la tesela donde cae); no en un lago ni en el mar, ni pegados a su orilla
    for (const { rio } of this.rios.curvas) {
      for (const delMotor of rio.vados ?? []) {
        if (!dentro(delMotor)) continue;
        // sobre la curva del río (la del motor va en recto entre sus puntos y, en una curva, se aparta del agua)
        const v = this.rios.junto(rio, delMotor);
        if (!v) continue;
        const ancho = 2 * v.medio, cerca = v.medio + 1;
        if ([[0, 0], [cerca, 0], [-cerca, 0], [0, cerca], [0, -cerca]].some(([dx, dy]) => this.fuente.aguaEn(v.x + dx!, v.y + dy!))) continue;
        // de orilla a orilla, un poco más ancho que el río en ese sitio, y su piedra a ras del agua (o del suelo, donde este queda por encima)
        const largo = v.medio + VADO.sobra, agua = v.nivel / MPU;
        const geo = cinta([{ x: v.x - v.ry * largo, y: v.y + v.rx * largo }, { x: v.x + v.ry * largo, y: v.y - v.rx * largo }], this.alturaU,
          Math.max(VADO.anchoMinimo, ancho * VADO.anchoPorAncho), { asiento: 'bajo', dy: 0.06, paso: 0.25, nivel: (x, y) => Math.max(this.alturaU(x, y), agua) });
        if (geo) g.add(new THREE.Mesh(geo, this.vado));
      }
    }
    const nodos = this.mapa.nodos.filter((n) => dentro(n.posicion));
    if (nodos.length) {
      const piezas: { x: number; y: number; r: number; giro: number; color: THREE.Color }[] = [];
      for (const n of nodos) {
        const piedra = n.tipo === 'piedra', cuantas = piedra ? 5 : 3, color = colorDeNodo(n.tipo);
        for (let k = 0; k < cuantas; k++) {
          // a la escala `MUNDO3D.nodo` (la mitad: Víctor, 2026-11-07), el montón y cada roca
          const N = MUNDO3D.nodo, a = azar(n.posicion.x + k, 1) * Math.PI * 2, dist = N * (piedra ? 1 : 0.6) * Math.sqrt(azar(n.posicion.y + k, 2));
          piezas.push({ x: n.posicion.x + Math.cos(a) * dist, y: n.posicion.y + Math.sin(a) * dist, r: N * ((piedra ? 0.15 : 0.12) + (piedra ? 0.3 : 0.18) * azar(n.posicion.x, 3 + k)), giro: a, color });
        }
      }
      const rocas = new THREE.InstancedMesh(ROCA, this.roca, piezas.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      piezas.forEach((p, k) => {
        e.set(0.2 * Math.sin(p.giro * 3), p.giro, 0.2 * Math.cos(p.giro * 5));
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(p.x, this.alturaU(p.x, p.y) + p.r * 0.25, p.y), q, new THREE.Vector3(p.r, p.r, p.r));
        rocas.setMatrixAt(k, m);
        rocas.setColorAt(k, p.color);
      });
      rocas.computeBoundingSphere();
      rocas.castShadow = rocas.receiveShadow = true;
      g.add(rocas);
    }
    return g;
  }

  private soltar(clave: string): void {
    const g = this.teselas.get(clave)?.g;
    if (!g) return;
    this.grupo.remove(g);
    for (const m of g.children) {
      if (m instanceof THREE.InstancedMesh) m.dispose();
      else (m as THREE.Mesh).geometry.dispose();
    }
    this.teselas.delete(clave);
  }

  destruir(): void {
    for (const clave of [...this.teselas.keys()]) this.soltar(clave);
    this.vado.dispose();
    this.roca.dispose();
  }
}
