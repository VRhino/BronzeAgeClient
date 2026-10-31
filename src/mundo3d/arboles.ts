// Los árboles, uno a uno donde el artefacto tiene bosque (su raster de densidad, cada 4 u), por trozos de 32 u alrededor del héroe: copas
// instanciadas de 0,3 u (la de la mesa de escalas) con su tronco. Lejos van menos y más grandes, para que el bosque siga tapando el suelo con
// muchas menos copas. Solo donde se ha explorado: lo que nunca se vio lo tapa la niebla, y un árbol de más ahí sería una silueta oscura
// delante de lo que sí se ve. Ni en el agua, ni en los cauces, ni en las laderas muy empinadas, ni en los claros de plazas y pueblos.
import * as THREE from 'three';
import type { MapaGenerado } from '../terreno';
import { MUNDO3D } from './config';
import { bosqueEn, type FuenteDeAltura } from './fuente';
import type { NieblaDeGuerra } from './niebla';

type Punto = { x: number; y: number };
/** Un círculo sin árboles. */
export interface Claro { x: number; y: number; r: number }

const TROZO = 32;
/** Árboles por u² con el bosque al máximo y copa `c`: las copas se tocan sin taparse del todo (la cifra de la mesa). */
const PORCION = 0.55;
/** Pendiente (m/m) por encima de la cual no hay árboles. */
const PENDIENTE_MAX = 1.1;
/** Bandas de distancia al héroe (u) y la parte de los árboles que queda en cada una; las copas crecen para tapar lo mismo. */
const BANDAS = [{ hasta: 48, parte: 1 }, { hasta: 80, parte: 0.5 }, { hasta: 128, parte: 0.25 }, { hasta: Infinity, parte: 0.125 }] as const;

/** Un número fijo entre 0 y 1 por (i, j, k). */
function hash(i: number, j: number, k: number): number {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Franjas sin árboles a lo largo de líneas (ríos y caminos): sus tramos como [ax, ay, bx, by, medio ancho], con la caja de cada línea para
 * descartar las lejanas. */
export interface Cauces { rios: { x0: number; y0: number; x1: number; y1: number; tramos: Float32Array }[] }

export function franjas(lineas: readonly { puntos: readonly Punto[]; medio: number }[]): Cauces {
  return {
    rios: lineas.filter((r) => r.puntos.length >= 2).map((r) => {
      const tramos = new Float32Array((r.puntos.length - 1) * 5);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      r.puntos.forEach((p, k) => {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
        if (k) { const a = r.puntos[k - 1]!; tramos.set([a.x, a.y, p.x, p.y, r.medio], (k - 1) * 5); }
      });
      return { x0, y0, x1, y1, tramos };
    }),
  };
}

/** Los cauces de los ríos del artefacto: 1,5 u, 3 si es navegable. */
export const caucesDe = (mapa: MapaGenerado): Cauces => franjas(mapa.rios.map((r) => ({ puntos: r.puntos, medio: (r.navegable ? 3 : 1.5) / 2 })));

/** Los tramos de río que pasan a menos de `m` u de la caja. */
function caucesCerca(c: Cauces, x0: number, y0: number, x1: number, y1: number, m: number): number[] {
  const out: number[] = [];
  for (const r of c.rios) {
    if (r.x1 + m < x0 || r.x0 - m > x1 || r.y1 + m < y0 || r.y0 - m > y1) continue;
    for (let k = 0; k < r.tramos.length; k += 5) {
      const ax = r.tramos[k]!, ay = r.tramos[k + 1]!, bx = r.tramos[k + 2]!, by = r.tramos[k + 3]!;
      if (Math.max(ax, bx) + m < x0 || Math.min(ax, bx) - m > x1 || Math.max(ay, by) + m < y0 || Math.min(ay, by) - m > y1) continue;
      out.push(ax, ay, bx, by, r.tramos[k + 4]!);
    }
  }
  return out;
}

function enCauce(t: readonly number[], x: number, y: number): boolean {
  for (let k = 0; k < t.length; k += 5) {
    const ax = t[k]!, ay = t[k + 1]!, dx = t[k + 2]! - ax, dy = t[k + 3]! - ay, l = dx * dx + dy * dy;
    const s = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
    if (Math.hypot(x - ax - s * dx, y - ay - s * dy) < t[k + 4]! + 0.2) return true;
  }
  return false;
}

export interface Entorno {
  fuente: FuenteDeAltura;
  mapa: MapaGenerado;
  cauces: Cauces;
  /** Los caminos de la proyección: tampoco crecen árboles encima. */
  caminos?: Cauces;
  claros: readonly Claro[];
  /** ¿Se exploró (x, y)? */
  explorada: (x: number, y: number) => boolean;
}

/** Los árboles del trozo que empieza en (x0, y0), como [x, y, altura en u, azar] por árbol. `parte` es la fracción que se queda (las bandas
 * lejanas): siempre los mismos, así al acercarse solo se añaden. */
export function arbolesDelTrozo(e: Entorno, x0: number, y0: number, lado: number, parte: number, copa = MUNDO3D.copa): Float32Array {
  const { fuente, mapa } = e, MPU = MUNDO3D.metrosPorUnidad;
  // alturas y agua cada 0,5 u (con un anillo de más para las pendientes del borde): de aquí sale todo lo del trozo
  const paso = 0.5, n = Math.round(lado / paso) + 3, h = new Float32Array(n * n), agua = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + (i - 1) * paso, y = y0 + (j - 1) * paso;
    h[j * n + i] = fuente.alturaEn(x, y);
    agua[j * n + i] = fuente.aguaEn(x, y) ? 1 : 0;
  }
  const rejilla = (x: number, y: number) => {
    const fi = Math.min(n - 1.001, Math.max(0, (x - x0) / paso + 1)), fj = Math.min(n - 1.001, Math.max(0, (y - y0) / paso + 1));
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, k = j * n + i;
    return { k, alt: (h[k]! * (1 - a) + h[k + 1]! * a) * (1 - b) + (h[k + n]! * (1 - a) + h[k + n + 1]! * a) * b };
  };
  const cauces = caucesCerca(e.cauces, x0, y0, x0 + lado, y0 + lado, 2);
  if (e.caminos) cauces.push(...caucesCerca(e.caminos, x0, y0, x0 + lado, y0 + lado, 2));
  const claros = e.claros.filter((c) => c.x + c.r > x0 && c.x - c.r < x0 + lado && c.y + c.r > y0 && c.y - c.r < y0 + lado);
  const porU2 = PORCION / (copa * copa), out: number[] = [];
  for (let j = y0; j < y0 + lado; j++) {
    for (let i = x0; i < x0 + lado; i++) {
      const d = bosqueEn(mapa, i + 0.5, j + 0.5);
      if (d < 0.2) continue;
      const l = porU2 * d, cuantos = Math.floor(l) + (hash(i, j, 7) < l % 1 ? 1 : 0);
      for (let k = 0; k < cuantos; k++) {
        if (hash(i, j, 53 + k) >= parte) continue;
        const x = i + hash(i, j, 11 + k), y = j + hash(i, j, 29 + k), { k: c, alt } = rejilla(x, y);
        if (agua[c] || agua[c + 1] || agua[c + n] || agua[c + n + 1]) continue;
        const pendiente = Math.hypot(h[c + 1]! - h[c]!, h[c + n]! - h[c]!) / (paso * MPU);
        if (pendiente > PENDIENTE_MAX || !e.explorada(x, y) || enCauce(cauces, x, y)) continue;
        if (claros.some((q) => (x - q.x) ** 2 + (y - q.y) ** 2 < q.r * q.r)) continue;
        out.push(x, y, alt / MPU, hash(i, j, 41 + k));
      }
    }
  }
  return new Float32Array(out);
}

/** La copa (icosaedro con normales de esfera, que se ve redonda) y el tronco, de altura 1, compartidos. */
const GEO = (() => {
  const copa = new THREE.IcosahedronGeometry(0.5, 0), p = copa.attributes.position!, n: number[] = [];
  for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k).normalize(); n.push(v.x, v.y, v.z); }
  copa.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  copa.translate(0, 0.62, 0);
  const tronco = new THREE.CylinderGeometry(0.06, 0.08, 1, 5, 1, true);
  tronco.translate(0, 0.25, 0);
  return { copa, tronco };
})();

interface Trozo { grupo: THREE.Group; clave: string }

export class Arboles {
  readonly grupo = new THREE.Group();
  private readonly copas: THREE.MeshLambertMaterial;
  private readonly troncos: THREE.MeshLambertMaterial;
  private readonly trozos = new Map<string, Trozo>();
  private readonly cauces: Cauces;
  private claros: readonly Claro[] = [];
  private caminos: Cauces = { rios: [] };
  private claveClaros = '';
  /** Celdas exploradas de cada trozo, con la versión de la niebla en que se contaron: un trozo solo se rehace si cambia lo suyo. */
  private readonly exploradas = new Map<string, { version: number; cuantas: number }>();

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, private readonly niebla: NieblaDeGuerra) {
    this.copas = niebla.aplicar(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.troncos = niebla.aplicar(new THREE.MeshLambertMaterial({ color: 0x5b4632 }));
    this.cauces = caucesDe(mapa);
  }

  /** Donde no deben crecer árboles además de los ríos: los claros de las maquetas y los caminos. `clave` resume los dos: si cambia, los trozos
   * se rehacen. */
  fijarDespejes(claros: readonly Claro[], caminos: readonly { puntos: readonly Punto[]; ancho: number }[], clave: string): void {
    if (clave === this.claveClaros) return;
    this.claros = claros;
    this.caminos = franjas(caminos.map((c) => ({ puntos: c.puntos, medio: c.ancho / 2 })));
    this.claveClaros = clave;
  }

  /** Pide los trozos a menos de `alcance` u de (cx, cy), los más cercanos primero, mientras quede tiempo (`hasta`, en `performance.now()`), y
   * suelta los que quedan lejos. Un trozo se rehace al cambiar de banda, de claros o de lo explorado. Devuelve cuántos faltan. */
  actualizar(cx: number, cy: number, alcance: number, hasta: number): number {
    const quiero = new Map<string, { x0: number; y0: number; d: number; banda: number; clave: string }>();
    const maxX = Math.ceil(this.fuente.ancho / TROZO) - 1, maxY = Math.ceil(this.fuente.alto / TROZO) - 1;
    for (let ty = Math.max(0, Math.floor((cy - alcance) / TROZO)); ty <= Math.min(maxY, Math.floor((cy + alcance) / TROZO)); ty++) {
      for (let tx = Math.max(0, Math.floor((cx - alcance) / TROZO)); tx <= Math.min(maxX, Math.floor((cx + alcance) / TROZO)); tx++) {
        const x0 = tx * TROZO, y0 = ty * TROZO;
        const d = Math.hypot(Math.max(x0 - cx, 0, cx - x0 - TROZO), Math.max(y0 - cy, 0, cy - y0 - TROZO));
        if (d > alcance) continue;
        const banda = BANDAS.findIndex((b) => d < b.hasta), k = `${tx},${ty}`;
        quiero.set(k, { x0, y0, d, banda, clave: `${banda}|${this.claveClaros}|${this.exploradasEn(k, x0, y0)}` });
      }
    }
    for (const clave of [...this.trozos.keys()]) if (!quiero.has(clave)) this.soltar(clave);
    for (const clave of [...this.exploradas.keys()]) if (!quiero.has(clave)) this.exploradas.delete(clave);
    const pendientes = [...quiero.entries()].filter(([k, t]) => this.trozos.get(k)?.clave !== t.clave).sort((a, b) => a[1].d - b[1].d);
    let hechos = 0;
    for (const [k, t] of pendientes) {
      if (hechos && performance.now() > hasta) break;
      this.poner(k, t.x0, t.y0, t.banda, t.clave);
      hechos++;
    }
    return pendientes.length - hechos;
  }

  /** Cuántas celdas de la niebla del trozo están exploradas; se recuenta solo cuando cambia la niebla. */
  private exploradasEn(clave: string, x0: number, y0: number): number {
    const v = this.niebla.version, c = this.exploradas.get(clave);
    if (c?.version === v) return c.cuantas;
    const c5 = this.niebla.celda, m = c5 / 2;
    let cuantas = 0;
    for (let y = Math.floor(y0 / c5) * c5 + m; y - m < y0 + TROZO; y += c5) for (let x = Math.floor(x0 / c5) * c5 + m; x - m < x0 + TROZO; x += c5) if (this.niebla.exploradaEn(x, y)) cuantas++;
    this.exploradas.set(clave, { version: v, cuantas });
    return cuantas;
  }

  private poner(clave: string, x0: number, y0: number, banda: number, claveTrozo: string): void {
    const parte = BANDAS[banda]!.parte, crece = 1 / Math.sqrt(parte), niebla = this.niebla;
    const lista = arbolesDelTrozo({ fuente: this.fuente, mapa: this.mapa, cauces: this.cauces, caminos: this.caminos, claros: this.claros, explorada: (x, y) => niebla.exploradaEn(x, y) }, x0, y0, TROZO, parte);
    this.soltar(clave);
    const grupo = new THREE.Group(), n = lista.length / 4;
    if (n) {
      const copas = new THREE.InstancedMesh(GEO.copa, this.copas, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const s = new THREE.Vector3(), p = new THREE.Vector3(), color = new THREE.Color();
      // de cerca, con tronco y sombra
      const troncos = banda === 0 ? new THREE.InstancedMesh(GEO.tronco, this.troncos, n) : null;
      for (let k = 0; k < n; k++) {
        const x = lista[4 * k]!, y = lista[4 * k + 1]!, h = lista[4 * k + 2]!, r = lista[4 * k + 3]!, esc = MUNDO3D.copa * crece * (0.75 + 0.5 * r);
        e.set(0, r * 6.28, 0);
        q.setFromEuler(e);
        s.set(esc, esc * (1 + 0.35 * r), esc);
        p.set(x, h - 0.03, y);
        m.compose(p, q, s);
        copas.setMatrixAt(k, m);
        troncos?.setMatrixAt(k, m);
        copas.setColorAt(k, color.setRGB(0.25 + 0.12 * r, 0.38 + 0.1 * r, 0.18 + 0.05 * r)); // los de la mesa, en el espacio lineal
      }
      copas.computeBoundingSphere();
      copas.castShadow = banda === 0;
      grupo.add(copas);
      if (troncos) { troncos.computeBoundingSphere(); troncos.castShadow = true; grupo.add(troncos); }
    }
    this.grupo.add(grupo);
    this.trozos.set(clave, { grupo, clave: claveTrozo });
  }

  private soltar(clave: string): void {
    const t = this.trozos.get(clave);
    if (!t) return;
    this.grupo.remove(t.grupo);
    for (const m of t.grupo.children) (m as THREE.InstancedMesh).dispose();
    this.trozos.delete(clave);
  }

  /** Cuántos árboles hay puestos (para el banco de pruebas). */
  get cuantos(): number {
    let n = 0;
    for (const t of this.trozos.values()) n += (t.grupo.children[0] as THREE.InstancedMesh | undefined)?.count ?? 0;
    return n;
  }

  destruir(): void {
    for (const clave of [...this.trozos.keys()]) this.soltar(clave);
    this.copas.dispose();
    this.troncos.dispose();
  }
}
