// Lo que el artefacto pone sobre el suelo, por teselas de 64 u alrededor del héroe: los ríos (una cinta de agua de 1,5 u, 3 si es
// navegable, a la altura del punto más bajo de su corte), sus vados (un paso de grava de orilla a orilla) y los nodos de recursos (rocas:
// grises la piedra, del color de su metal los afloramientos). Todo va bajo la niebla, como en `render.ts`.
import * as THREE from 'three';
import { RECURSO_COLOR } from '../paletas';
import type { MapaGenerado } from '../terreno';
import type { RioZona } from '../terreno/tipos';
import { MUNDO3D } from './config';
import type { FuenteDeAltura } from './fuente';
import { cinta, tramosEnCaja } from './lineas';
import type { NieblaDeGuerra } from './niebla';

type Punto = { x: number; y: number };

const LADO = MUNDO3D.ladoTesela;
const COLOR = { agua: 0x3f6f96, vado: 0xd9c79a, piedra: 0x8d8d8d };

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

/** El rumbo (unitario) del cauce junto a un punto: el del tramo más cercano. */
function rumboJunto(puntos: readonly Punto[], v: Punto): Punto {
  let mejor = { d: Infinity, x: 1, y: 0 };
  for (let k = 1; k < puntos.length; k++) {
    const a = puntos[k - 1]!, b = puntos[k]!, d = Math.hypot((a.x + b.x) / 2 - v.x, (a.y + b.y) / 2 - v.y), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    if (d < mejor.d) mejor = { d, x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  }
  return { x: mejor.x, y: mejor.y };
}

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

interface RioSuave { rio: RioZona; puntos: Punto[]; ancho: number; x0: number; y0: number; x1: number; y1: number }

export class Paisaje {
  readonly grupo = new THREE.Group();
  private readonly agua: THREE.MeshLambertMaterial;
  private readonly vado: THREE.MeshLambertMaterial;
  private readonly roca: THREE.MeshLambertMaterial;
  private readonly rios: RioSuave[];
  private readonly teselas = new Map<string, THREE.Group>();

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra, private readonly alturaU: (x: number, y: number) => number) {
    const sobre = (factor: number) => ({ polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor });
    this.agua = niebla.aplicar(new THREE.MeshLambertMaterial({ color: COLOR.agua, ...sobre(-2) }));
    this.vado = niebla.aplicar(new THREE.MeshLambertMaterial({ color: COLOR.vado, ...sobre(-4) }));
    this.roca = niebla.aplicar(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    this.rios = mapa.rios.filter((r) => r.puntos.length >= 2).map((rio) => {
      const puntos = suavizar(rio.puntos);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of puntos) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      return { rio, puntos, ancho: rio.navegable ? 3 : 1.5, x0, y0, x1, y1 };
    });
  }

  /** Pide las teselas a menos de `alcance` u de (cx, cy), las más cercanas primero, mientras quede tiempo (`hasta`), y suelta las lejanas. */
  actualizar(cx: number, cy: number, alcance: number, hasta: number): number {
    const maxX = Math.ceil(this.fuente.ancho / LADO) - 1, maxY = Math.ceil(this.fuente.alto / LADO) - 1;
    const quiero = new Map<string, { tx: number; ty: number; d: number }>();
    for (let ty = Math.max(0, Math.floor((cy - alcance) / LADO)); ty <= Math.min(maxY, Math.floor((cy + alcance) / LADO)); ty++) {
      for (let tx = Math.max(0, Math.floor((cx - alcance) / LADO)); tx <= Math.min(maxX, Math.floor((cx + alcance) / LADO)); tx++) {
        const d = Math.hypot(Math.max(tx * LADO - cx, 0, cx - (tx + 1) * LADO), Math.max(ty * LADO - cy, 0, cy - (ty + 1) * LADO));
        if (d <= alcance) quiero.set(`${tx},${ty}`, { tx, ty, d });
      }
    }
    for (const clave of [...this.teselas.keys()]) if (!quiero.has(clave)) this.soltar(clave);
    const pendientes = [...quiero.entries()].filter(([k]) => !this.teselas.has(k)).sort((a, b) => a[1].d - b[1].d);
    let hechas = 0;
    for (const [k, t] of pendientes) {
      if (hechas && performance.now() > hasta) break;
      const g = this.tesela(t.tx, t.ty);
      this.teselas.set(k, g);
      this.grupo.add(g);
      hechas++;
    }
    return pendientes.length - hechas;
  }

  private tesela(tx: number, ty: number): THREE.Group {
    const g = new THREE.Group(), x0 = tx * LADO, y0 = ty * LADO, x1 = x0 + LADO, y1 = y0 + LADO;
    const dentro = (p: Punto) => p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1;
    for (const r of this.rios) {
      if (r.x1 + 2 < x0 || r.x0 - 2 > x1 || r.y1 + 2 < y0 || r.y0 - 2 > y1) continue;
      for (const tramo of tramosEnCaja(r.puntos, x0 - 1, y0 - 1, x1 + 1, y1 + 1)) {
        const geo = cinta(tramo, this.alturaU, r.ancho, { asiento: 'bajo', dy: 0.04 });
        if (geo) g.add(new THREE.Mesh(geo, this.agua));
      }
      // los vados, de orilla a orilla (cada uno en la tesela donde cae)
      for (const v of r.rio.vados ?? []) {
        if (!dentro(v)) continue;
        const d = rumboJunto(r.puntos, v), largo = (r.ancho * 1.4 + 0.6) / 2;
        const geo = cinta([{ x: v.x - d.y * largo, y: v.y + d.x * largo }, { x: v.x + d.y * largo, y: v.y - d.x * largo }], this.alturaU, 0.8, { dy: 0.07, paso: 0.25 });
        if (geo) g.add(new THREE.Mesh(geo, this.vado));
      }
    }
    const nodos = this.mapa.nodos.filter((n) => dentro(n.posicion));
    if (nodos.length) {
      const piezas: { x: number; y: number; r: number; giro: number; color: THREE.Color }[] = [];
      for (const n of nodos) {
        const piedra = n.tipo === 'piedra', cuantas = piedra ? 5 : 3, color = colorDeNodo(n.tipo);
        for (let k = 0; k < cuantas; k++) {
          const a = azar(n.posicion.x + k, 1) * Math.PI * 2, dist = (piedra ? 1 : 0.6) * Math.sqrt(azar(n.posicion.y + k, 2));
          piezas.push({ x: n.posicion.x + Math.cos(a) * dist, y: n.posicion.y + Math.sin(a) * dist, r: (piedra ? 0.15 : 0.12) + (piedra ? 0.3 : 0.18) * azar(n.posicion.x, 3 + k), giro: a, color });
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
    const g = this.teselas.get(clave);
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
    this.agua.dispose();
    this.vado.dispose();
    this.roca.dispose();
  }
}
