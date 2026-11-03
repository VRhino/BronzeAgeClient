// Los árboles, uno a uno donde el artefacto tiene bosque (su raster de densidad, cada 4 u), por trozos de 32 u alrededor del héroe, cada uno de
// su especie (`especies.ts`: encina, olivo, pino, ciprés, abeto, palmera o álamo, según la altura, el agua cercana y la mancha de bosque), en
// una malla instanciada por especie y trozo. Lejos van menos y más grandes, para que el bosque siga tapando el suelo con
// muchas menos copas. También donde nunca se exploró: esa niebla deja ver el mapa a media luz (Víctor, 2026-11-02), y el bosque es parte de
// él; su material va bajo la niebla como el suelo. Ni en el agua, ni en los cauces, ni en las laderas muy empinadas, ni en los claros de plazas y pueblos.
import * as THREE from 'three';
import type { MapaGenerado } from '../terreno';
import { distanciaATierra } from './agua';
import { MUNDO3D } from './config';
import { colorDeCopa, especieDe, geometrias, materialDeArboles } from './especies';
import { bosqueEn, type FuenteDeAltura } from './fuente';
import type { NieblaDeGuerra } from './niebla';
import { azar as hash } from './ruido';

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

/** Lo que ocupa cada árbol en la lista de `arbolesDelTrozo`: x, y, altura (u), azar y especie (índice en `ESPECIES`). */
export const POR_ARBOL = 5;

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
export function caucesCerca(c: Cauces, x0: number, y0: number, x1: number, y1: number, m: number): number[] {
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

export function enCauce(t: readonly number[], x: number, y: number, margen = 0.2): boolean {
  return aCauce(t, x, y) < margen;
}

/** Lo que queda (u) de (x, y) al borde del cauce más cercano de la lista (negativo dentro; Infinity sin cauces). */
export function aCauce(t: readonly number[], x: number, y: number): number {
  let d = Infinity;
  for (let k = 0; k < t.length; k += 5) {
    const ax = t[k]!, ay = t[k + 1]!, dx = t[k + 2]! - ax, dy = t[k + 3]! - ay, l = dx * dx + dy * dy;
    const s = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
    d = Math.min(d, Math.hypot(x - ax - s * dx, y - ay - s * dy) - t[k + 4]!);
  }
  return d;
}

/** Las alturas y el agua de un trozo cada `paso` u, con `margen` muestras de más alrededor, y lo que queda de cada muestra al agua (u) del
 * mar o de un lago (Infinity si no hay en la ventana). La comparten árboles y matas. */
export interface Muestras { n: number; paso: number; margen: number; x0: number; y0: number; h: Float32Array; agua: Uint8Array; aAgua: Float32Array }

export function muestrasDelTrozo(fuente: FuenteDeAltura, x0: number, y0: number, lado: number, paso: number, margen: number): Muestras {
  const n = Math.round(lado / paso) + 1 + 2 * margen, h = new Float32Array(n * n), agua = new Uint8Array(n * n), tierra = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + (i - margen) * paso, y = y0 + (j - margen) * paso, k = j * n + i;
    h[k] = fuente.alturaEn(x, y);
    agua[k] = fuente.aguaEn(x, y) ? 1 : 0;
    tierra[k] = 1 - agua[k]!;
  }
  // la distancia de cada muestra de tierra al agua: la de la tierra al agua, cambiando los papeles
  const aAgua = distanciaATierra(tierra, n, n);
  for (let k = 0; k < aAgua.length; k++) aAgua[k] = aAgua[k]! * paso;
  return { n, paso, margen, x0, y0, h, agua, aAgua };
}

/** La muestra de (x, y) (la de abajo a la izquierda de su celda) y la altura interpolada (m). */
export function enMuestras(m: Muestras, x: number, y: number): { k: number; alt: number } {
  const { n, paso, margen, h } = m;
  const fi = Math.min(n - 1.001, Math.max(0, (x - m.x0) / paso + margen)), fj = Math.min(n - 1.001, Math.max(0, (y - m.y0) / paso + margen));
  const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, k = j * n + i;
  return { k, alt: (h[k]! * (1 - a) + h[k + 1]! * a) * (1 - b) + (h[k + n]! * (1 - a) + h[k + n + 1]! * a) * b };
}

export interface Entorno {
  fuente: FuenteDeAltura;
  mapa: MapaGenerado;
  cauces: Cauces;
  /** Los caminos de la proyección: tampoco crecen árboles encima. */
  caminos?: Cauces;
  claros: readonly Claro[];
  /** ¿Pueden crecer árboles en (x, y) según la niebla? Sin él, en todas partes. */
  explorada?: (x: number, y: number) => boolean;
}

/** Los árboles del trozo que empieza en (x0, y0), `POR_ARBOL` números por árbol: x, y, altura en u, azar y especie. `parte` es la fracción
 * que se queda (las bandas lejanas): siempre los mismos, así al acercarse solo se añaden. */
export function arbolesDelTrozo(e: Entorno, x0: number, y0: number, lado: number, parte: number, copa = MUNDO3D.copa): Float32Array {
  const { fuente, mapa } = e, MPU = MUNDO3D.metrosPorUnidad;
  // alturas y agua cada 0,5 u, con 3 u de más alrededor (las pendientes del borde y el agua cercana): de aquí sale todo lo del trozo
  const muestras = muestrasDelTrozo(fuente, x0, y0, lado, 0.5, 6), { n, paso, h, agua, aAgua } = muestras;
  const rios = caucesCerca(e.cauces, x0, y0, x0 + lado, y0 + lado, 4);
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
        const x = i + hash(i, j, 11 + k), y = j + hash(i, j, 29 + k), { k: c, alt } = enMuestras(muestras, x, y);
        if (agua[c] || agua[c + 1] || agua[c + n] || agua[c + n + 1]) continue;
        const pendiente = Math.hypot(h[c + 1]! - h[c]!, h[c + n]! - h[c]!) / (paso * MPU);
        if (pendiente > PENDIENTE_MAX || (e.explorada && !e.explorada(x, y)) || enCauce(cauces, x, y)) continue;
        if (claros.some((q) => (x - q.x) ** 2 + (y - q.y) ** 2 < q.r * q.r)) continue;
        const dAgua = Math.min(aAgua[c]!, aCauce(rios, x, y));
        out.push(x, y, alt / MPU, hash(i, j, 41 + k), especieDe(x, y, alt, dAgua, hash(i, j, 67 + k)));
      }
    }
  }
  return new Float32Array(out);
}

/** Las geometrías de cada especie, compartidas por todos los trozos. */
const GEO = geometrias();

interface Trozo { grupo: THREE.Group; clave: string }

export class Arboles {
  readonly grupo = new THREE.Group();
  private readonly material: THREE.MeshLambertMaterial;
  private readonly trozos = new Map<string, Trozo>();
  private readonly cauces: Cauces;
  private claros: readonly Claro[] = [];
  private caminos: Cauces = { rios: [] };
  private claveClaros = '';

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra) {
    this.material = materialDeArboles((sh) => niebla.parchear(sh));
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
   * suelta los que quedan lejos. Un trozo se rehace al cambiar de banda o de claros. Devuelve cuántos faltan. */
  actualizar(cx: number, cy: number, alcance: number, hasta: number): number {
    const quiero = new Map<string, { x0: number; y0: number; d: number; banda: number; clave: string }>();
    const maxX = Math.ceil(this.fuente.ancho / TROZO) - 1, maxY = Math.ceil(this.fuente.alto / TROZO) - 1;
    for (let ty = Math.max(0, Math.floor((cy - alcance) / TROZO)); ty <= Math.min(maxY, Math.floor((cy + alcance) / TROZO)); ty++) {
      for (let tx = Math.max(0, Math.floor((cx - alcance) / TROZO)); tx <= Math.min(maxX, Math.floor((cx + alcance) / TROZO)); tx++) {
        const x0 = tx * TROZO, y0 = ty * TROZO;
        const d = Math.hypot(Math.max(x0 - cx, 0, cx - x0 - TROZO), Math.max(y0 - cy, 0, cy - y0 - TROZO));
        if (d > alcance) continue;
        const banda = BANDAS.findIndex((b) => d < b.hasta), k = `${tx},${ty}`;
        quiero.set(k, { x0, y0, d, banda, clave: `${banda}|${this.claveClaros}` });
      }
    }
    for (const clave of [...this.trozos.keys()]) if (!quiero.has(clave)) this.soltar(clave);
    const pendientes = [...quiero.entries()].filter(([k, t]) => this.trozos.get(k)?.clave !== t.clave).sort((a, b) => a[1].d - b[1].d);
    let hechos = 0;
    for (const [k, t] of pendientes) {
      if (hechos && performance.now() > hasta) break;
      this.poner(k, t.x0, t.y0, t.banda, t.clave);
      hechos++;
    }
    return pendientes.length - hechos;
  }

  private poner(clave: string, x0: number, y0: number, banda: number, claveTrozo: string): void {
    const parte = BANDAS[banda]!.parte, crece = 1 / Math.sqrt(parte);
    const lista = arbolesDelTrozo({ fuente: this.fuente, mapa: this.mapa, cauces: this.cauces, caminos: this.caminos, claros: this.claros }, x0, y0, TROZO, parte);
    this.soltar(clave);
    const grupo = new THREE.Group(), n = lista.length / POR_ARBOL;
    // de cerca, una malla por especie, con lóbulos, tronco y sombra; de lejos, la silueta, con las copas redondas en una sola malla
    const cerca = banda === 0, geos = cerca ? GEO.cerca : GEO.lejos, grupoDe = (e: number) => (cerca ? e : GEO.grupoLejos[e]!);
    const cuantos = new Array<number>(geos.length).fill(0);
    for (let k = 0; k < n; k++) cuantos[grupoDe(lista[POR_ARBOL * k + 4]!)]!++;
    const mallas = cuantos.map((c, g) => (c ? new THREE.InstancedMesh(geos[g]!, this.material, c) : null)), puestos = cuantos.map(() => 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), color = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const o = POR_ARBOL * k, x = lista[o]!, y = lista[o + 1]!, h = lista[o + 2]!, r = lista[o + 3]!, e = lista[o + 4]!, g = grupoDe(e), malla = mallas[g]!;
      const esc = MUNDO3D.copa * crece * (0.75 + 0.5 * r), r2 = hash(Math.round(x * 64), Math.round(y * 64), 5), alto = 0.9 + 0.3 * r2;
      const [fx, fy, fz, alza] = cerca ? [1, 1, 1, 0] : GEO.forma[e]!;
      eu.set(0, r * 6.28, 0);
      q.setFromEuler(eu);
      s.set(esc * fx, esc * fy * alto, esc * fz);
      p.set(x, h - 0.03 + esc * alto * alza, y);
      m.compose(p, q, s);
      malla.setMatrixAt(puestos[g]!, m);
      malla.setColorAt(puestos[g]!++, colorDeCopa(e, r, r2, color));
    }
    for (const malla of mallas) {
      if (!malla) continue;
      malla.computeBoundingSphere();
      malla.castShadow = banda === 0;
      grupo.add(malla);
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
    for (const t of this.trozos.values()) for (const m of t.grupo.children) n += (m as THREE.InstancedMesh).count;
    return n;
  }

  destruir(): void {
    for (const clave of [...this.trozos.keys()]) this.soltar(clave);
    this.material.dispose();
  }
}
