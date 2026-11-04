// Lo que el artefacto pone sobre el suelo, por teselas de 64 u alrededor del héroe: los ríos (una cinta de agua de 1,5 u, 3 si es
// navegable, a la altura del punto más bajo de su corte, del agua de `agua.ts` que corre río abajo, y una orilla de tierra mojada a cada lado
// que sigue al relieve), sus vados (un paso de grava de orilla a orilla) y los nodos de recursos (rocas: grises la piedra, del color de su metal
// los afloramientos). Donde el suelo ya es agua (un lago, el mar) el río se acaba en la orilla y no lleva vados. Todo va bajo la niebla.
import * as THREE from 'three';
import { RECURSO_COLOR } from '../paletas';
import type { MapaGenerado } from '../terreno';
import type { RioZona } from '../terreno/tipos';
import { MUNDO3D } from './config';
import type { FuenteDeAltura } from './fuente';
import { cinta, recorridos, tramosEnCaja } from './lineas';
import type { NieblaDeGuerra } from './niebla';
import type { SueloPintado } from './terreno';

type Punto = { x: number; y: number };

const LADO = MUNDO3D.ladoTesela;
const COLOR = { orilla: 0x6b5d40, vado: 0xd9c79a, piedra: 0x8d8d8d };
/** El ancho (u) de la tierra mojada a cada lado del río: oscura junto al agua y desvaída hacia fuera. */
const ORILLA = 1.2;

/** La tierra mojada de la orilla: transparente hacia fuera (la u de la cinta: 0 junto al agua, 1 en su borde), para que no se vea una raya. */
function orillaMojada(niebla: NieblaDeGuerra, sobre: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: COLOR.orilla, transparent: true, depthWrite: false, ...sobre });
  m.defines = { USE_UV: '' };
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.a *= 0.8 * (1.0 - smoothstep(0.1, 1.0, vUv.x));`);
    niebla.parchear(sh);
  };
  m.customProgramCacheKey = () => 'orilla-mojada';
  return m;
}

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

interface RioSuave { rio: RioZona; tramos: TramoDeRio[]; puntos: Punto[]; ancho: number; x0: number; y0: number; x1: number; y1: number }

/** Si el cauce acaba a poco de un lago o del mar (el generador lo deja en la orilla de su raster, más basto que el relieve), lo alarga en su
 * último rumbo hasta el agua, `hasta` u como mucho; si no hay agua tan cerca, lo deja como está. */
export function alargarHastaElAgua(puntos: readonly Punto[], aguaEn: (x: number, y: number) => boolean, hasta = 8, paso = 0.25): Punto[] {
  const n = puntos.length;
  if (n < 2) return [...puntos];
  const b = puntos[n - 1]!, a = puntos[n - 2]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / l, uy = (b.y - a.y) / l;
  for (let d = 0; d <= hasta; d += paso) if (aguaEn(b.x + ux * d, b.y + uy * d)) return d ? [...puntos, { x: b.x + ux * d, y: b.y + uy * d }] : [...puntos];
  return [...puntos];
}

/** Un tramo del cauce por tierra: `tierra` acaba en la orilla; `agua` sigue un poco dentro del lago o del mar para que la cinta se funda con él. */
export interface TramoDeRio { tierra: Punto[]; agua: Punto[] }

/**
 * Los tramos del cauce que van por tierra: se parte donde el suelo ya es agua (el río entra en un lago o en el mar). Las muestras van cada
 * 0,5 u; en cada corte `tierra` llega a la primera muestra de agua y `agua` se mete `entra` u más.
 */
export function tramosEnTierra(puntos: readonly Punto[], aguaEn: (x: number, y: number) => boolean, paso = 0.5, entra = 2): TramoDeRio[] {
  const m: Punto[] = [];
  for (let k = 0; k < puntos.length; k++) {
    const b = puntos[k]!;
    if (k === 0) { m.push(b); continue; }
    const a = puntos[k - 1]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / paso));
    for (let i = 1; i <= n; i++) m.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  }
  const tierra = m.map((p) => !aguaEn(p.x, p.y)), extra = Math.round(entra / paso), out: TramoDeRio[] = [];
  let desde = -1;
  const cerrar = (hasta: number) => {
    const t0 = Math.max(0, desde - 1), t1 = Math.min(m.length - 1, hasta + 1);
    if (t1 - t0 >= 1) out.push({ tierra: m.slice(t0, t1 + 1), agua: m.slice(Math.max(0, t0 - extra), Math.min(m.length, t1 + 1 + extra)) });
  };
  for (let k = 0; k < m.length; k++) {
    if (tierra[k] && desde < 0) desde = k;
    else if (!tierra[k] && desde >= 0) { cerrar(k - 1); desde = -1; }
  }
  if (desde >= 0) cerrar(m.length - 1);
  return out;
}

/** De un tramo de río, lo andado hasta cada vértice (se calcula una vez): la corriente sigue en su sitio aunque el recorte de la tesela empiece
 * en otro vértice. */
const andados = new WeakMap<readonly Punto[], Map<Punto, number>>();
function andadoEn(puntos: readonly Punto[]): Map<Punto, number> {
  let a = andados.get(puntos);
  if (!a) { const s = recorridos(puntos); a = new Map(puntos.map((q, k) => [q, s[k]!])); andados.set(puntos, a); }
  return a;
}

/** Cuánto se sale de su tesela lo que pone (u): las orillas del río ancho, a 1 u de la caja más medio río y la orilla. */
const MARGEN = 4;

export class Paisaje {
  readonly grupo = new THREE.Group();
  private readonly vado: THREE.MeshLambertMaterial;
  private readonly orilla: THREE.MeshLambertMaterial;
  private readonly roca: THREE.MeshLambertMaterial;
  private readonly rios: RioSuave[];
  /** Cada tesela con la firma del suelo pintado bajo ella (y un margen: las orillas y los vados se salen): si cambia, se rehace. */
  private readonly teselas = new Map<string, { g: THREE.Group; firma: number }>();
  private readonly alturaU = (x: number, y: number): number => this.suelo.alturaU(x, y);

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra, private readonly suelo: SueloPintado, private readonly materialRio: THREE.Material) {
    const sobre = (factor: number) => ({ polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor });
    this.vado = niebla.aplicar(new THREE.MeshLambertMaterial({ color: COLOR.vado, ...sobre(-4) }));
    this.orilla = orillaMojada(niebla, sobre(-1));
    this.roca = niebla.aplicar(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    this.rios = mapa.rios.filter((r) => r.puntos.length >= 2).map((rio) => {
      const puntos = alargarHastaElAgua(suavizar(rio.puntos), (x, y) => fuente.aguaEn(x, y));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of puntos) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      // el agua del río entra medio u en el lago o el mar, para que no quede un hueco en la boca: el resto ya es su lámina
      return { rio, tramos: tramosEnTierra(puntos, (x, y) => fuente.aguaEn(x, y), 0.5, 0.5), puntos, ancho: rio.navegable ? 3 : 1.5, x0, y0, x1, y1 };
    });
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
    for (const r of this.rios) {
      if (r.x1 + 2 < x0 || r.x0 - 2 > x1 || r.y1 + 2 < y0 || r.y0 - 2 > y1) continue;
      for (const t of r.tramos) {
        // el agua al nivel más bajo del corte, con su corriente (`agua.ts`: la cinta lleva de orilla a orilla y lo recorrido, para que el agua
        // baje), y la orilla mojada a cada lado, sobre el relieve
        for (const tramo of tramosEnCaja(t.agua, x0 - 1, y0 - 1, x1 + 1, y1 + 1)) {
          const agua = cinta(tramo, this.alturaU, r.ancho, { asiento: 'bajo', dy: 0.04, textura: { periodo: 1, desde: andadoEn(t.agua).get(tramo[0]!) ?? 0 } });
          if (!agua) continue;
          agua.setAttribute('uvRio', agua.getAttribute('uv'));
          const malla = new THREE.Mesh(agua, this.materialRio);
          malla.renderOrder = 1;
          g.add(malla);
        }
        for (const tramo of tramosEnCaja(t.tierra, x0 - 1, y0 - 1, x1 + 1, y1 + 1)) {
          for (const lado of [1, -1]) {
            const orilla = cinta(tramo, this.alturaU, ORILLA, { dy: 0.03, desplazar: lado * (r.ancho / 2 + ORILLA / 2 - 0.1), textura: { periodo: 1 } });
            if (!orilla) continue;
            // u: 0 junto al agua y 1 en el borde de fuera (la cinta lleva u = 0 en su lado izquierdo)
            const uv = orilla.getAttribute('uv') as THREE.BufferAttribute;
            if (lado > 0) for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k));
            g.add(new THREE.Mesh(orilla, this.orilla));
          }
        }
      }
      // los vados, de orilla a orilla (cada uno en la tesela donde cae); no en un lago ni en el mar, ni pegados a su orilla
      for (const v of r.rio.vados ?? []) {
        if (!dentro(v)) continue;
        const cerca = r.ancho / 2 + 1;
        if ([[0, 0], [cerca, 0], [-cerca, 0], [0, cerca], [0, -cerca]].some(([dx, dy]) => this.fuente.aguaEn(v.x + dx!, v.y + dy!))) continue;
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
    this.orilla.dispose();
    this.roca.dispose();
  }
}
