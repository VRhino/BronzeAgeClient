// Lo que crece bajo los árboles y entre ellos, solo cerca del héroe (Víctor, 2026-11-03: «mejorar el piso, con vegetación»): hierba por matojos,
// más espesa y verde cuanto más fértil es el suelo y pajiza donde no; flores por manchas en los prados fértiles (amapolas, margaritas, de
// amarillo y de malva, cada mancha de un color); matas de monte bajo donde el suelo es pobre y en el borde de los bosques; juncos en la orilla
// de lagos, mares y ríos; y piedras sueltas en las laderas y en la montaña. Por trozos de 24 u hasta 48 u, en una malla instanciada por tipo
// y trozo; lejos van menos. La hierba, las flores y los juncos se mecen con el viento. Ni en el agua, ni en los cauces, ni en los caminos, ni
// en los claros de las maquetas. Solo se ven: no cuentan para nada del juego.
import * as THREE from 'three';
import { aCauce, caucesCerca, caucesDe, enCauce, enMuestras, franjas, muestrasDelTrozo, type Cauces, type Claro, type Entorno } from './arboles';
import { MUNDO3D } from './config';
import { bosqueEn, fertilidadEn, type FuenteDeAltura } from './fuente';
import type { NieblaDeGuerra } from './niebla';
import { azar, manchas } from './ruido';
import type { MapaGenerado } from '../terreno';

type Punto = { x: number; y: number };
const U = MUNDO3D.umbrales, MPU = MUNDO3D.metrosPorUnidad;

export const TIPOS_DE_MATA = ['hierba', 'flor', 'mata', 'junco', 'piedra'] as const;
const T = Object.fromEntries(TIPOS_DE_MATA.map((n, k) => [n, k])) as Record<(typeof TIPOS_DE_MATA)[number], number>;
/** Lo que ocupa cada mata en la lista de `matasDelTrozo`: x, y, altura (u), azar, tipo y fertilidad del suelo. */
export const POR_MATA = 6;

const TROZO = 24;
/** Bandas de distancia al héroe (u), la parte que queda en cada una y lo que crece lo que queda. */
const BANDAS = [{ hasta: 20, parte: 1, crece: 1 }, { hasta: 34, parte: 0.5, crece: 1.2 }, { hasta: Infinity, parte: 0.25, crece: 1.4 }] as const;
/** Candidatas por u² (una por celda de 0,5 u, movida al azar dentro). */
const PASO = 0.5;

const suave = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Lo que tiene de probable cada tipo en un punto: altura `h` (m), pendiente `p` (m/m), fertilidad `f`, bosque `b`, agua a `d` u y la mancha de
 * flores `m` (0..1). Suman como mucho 1; lo que falta es suelo desnudo. En el orden de `TIPOS_DE_MATA`. */
export function probabilidades(h: number, p: number, f: number, b: number, d: number, m: number): [number, number, number, number, number] {
  const bajo = h < U.colina, monte = h > U.montana;
  const junco = d < 1.2 && bajo ? 0.5 * (1 - d / 1.2) + 0.15 : 0;
  const piedra = 0.012 + 0.22 * suave(0.35, 1.0, p) + (monte ? 0.08 : h > U.colina ? 0.03 : 0);
  const borde = suave(0.05, 0.25, b) * (1 - suave(0.45, 0.75, b));
  const mata = (0.01 + 0.045 * (1 - f) * (h > U.costa ? 1 : 0.5) + 0.08 * borde) * (1 - suave(0.7, 1.1, p));
  const flor = f > 0.35 && b < 0.3 && !monte ? 0.3 * suave(0.6, 0.8, m) * suave(0.35, 0.55, f) : 0;
  const hierba = (0.1 + 0.6 * suave(0.12, 0.7, f)) * (1 - 0.65 * suave(0.2, 0.7, b)) * (1 - suave(0.6, 1.1, p)) * (h > U.montana + 20 ? 0.3 : 1) * suave(U.agua - 2, U.agua + 12, h);
  const total = junco + piedra + mata + flor + hierba, k = total > 1 ? 1 / total : 1;
  return [hierba * k, flor * k, mata * k, junco * k, piedra * k];
}

/** Las matas del trozo que empieza en (x0, y0), `POR_MATA` números por mata. `parte` es la fracción que se queda: siempre las mismas. */
export function matasDelTrozo(e: Entorno, x0: number, y0: number, lado: number, parte: number): Float32Array {
  const { fuente, mapa } = e;
  const muestras = muestrasDelTrozo(fuente, x0, y0, lado, PASO, 3), { n, h, agua, aAgua } = muestras;
  const rios = caucesCerca(e.cauces, x0, y0, x0 + lado, y0 + lado, 3);
  const cauces = caucesCerca(e.cauces, x0, y0, x0 + lado, y0 + lado, 1);
  if (e.caminos) cauces.push(...caucesCerca(e.caminos, x0, y0, x0 + lado, y0 + lado, 1));
  const claros = e.claros.filter((c) => c.x + c.r > x0 && c.x - c.r < x0 + lado && c.y + c.r > y0 && c.y - c.r < y0 + lado);
  const out: number[] = [], celdas = Math.round(lado / PASO);
  for (let j = 0; j < celdas; j++) {
    for (let i = 0; i < celdas; i++) {
      const gi = Math.round(x0 / PASO) + i, gj = Math.round(y0 / PASO) + j;
      if (azar(gi, gj, 3) >= parte) continue;
      const x = x0 + (i + azar(gi, gj, 5)) * PASO, y = y0 + (j + azar(gi, gj, 7)) * PASO, { k: c, alt } = enMuestras(muestras, x, y);
      if (agua[c] || agua[c + 1] || agua[c + n] || agua[c + n + 1]) continue;
      if ((e.explorada && !e.explorada(x, y)) || enCauce(cauces, x, y, 0.1)) continue;
      if (claros.some((q) => (x - q.x) ** 2 + (y - q.y) ** 2 < q.r * q.r)) continue;
      const pendiente = Math.hypot(h[c + 1]! - h[c]!, h[c + n]! - h[c]!) / (PASO * MPU);
      const f = fertilidadEn(mapa, x, y), d = Math.min(aAgua[c]!, aCauce(rios, x, y));
      const pr = probabilidades(alt, pendiente, f, bosqueEn(mapa, x, y), d, manchas(x, y, 6, 77));
      let u = azar(gi, gj, 11), tipo = -1;
      for (let t = 0; t < pr.length; t++) { if ((u -= pr[t]!) < 0) { tipo = t; break; } }
      if (tipo < 0) continue;
      out.push(x, y, alt / MPU, azar(gi, gj, 13), tipo, f);
    }
  }
  return new Float32Array(out);
}

// ---- geometría ----

/** Hojas finas que salen de la base: `n` hojas de `alto` 1 y `ancho` en la base, abiertas `abre` hacia fuera; con las dos caras. El color de
 * vértice va de `abajo` en la base a 1 en la punta (lo multiplica el de cada mata). Las normales miran casi arriba, como el suelo. */
function hojas(n: number, ancho: number, abre: number, abajo: number, alturas: (k: number) => number = () => 1): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + k * 1.3, cx = Math.cos(a), cz = Math.sin(a), px = -cz * ancho / 2, pz = cx * ancho / 2, alto = alturas(k);
    const b0 = [cx * 0.08 + px, 0, cz * 0.08 + pz], b1 = [cx * 0.08 - px, 0, cz * 0.08 - pz], punta = [cx * abre * alto, alto, cz * abre * alto];
    const nn = new THREE.Vector3(cx * 0.35, 1, cz * 0.35).normalize();
    for (const [p, q, r] of [[b0, b1, punta], [b1, b0, punta]] as const) {
      pos.push(...p, ...q, ...r);
      for (let v = 0; v < 3; v++) nor.push(nn.x, nn.y, nn.z);
      col.push(abajo, abajo, abajo, abajo, abajo, abajo, 1, 1, 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Bolas (icosaedros con normales de esfera, sin índice) con color de vértice gris de `abajo` a 1, juntas. Las flores son octaedros y las
 * piedras, icosaedros de caras planas. */
function bolas(lista: readonly [r: number, x: number, y: number, z: number, ey: number][], abajo: number, detalle = 0, tipo: 'bola' | 'flor' | 'piedra' = 'bola'): THREE.BufferGeometry {
  const plano = tipo === 'piedra';
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  for (const [r, x, y, z, ey] of lista) {
    const base = tipo === 'flor' ? new THREE.OctahedronGeometry(r, detalle) : new THREE.IcosahedronGeometry(r, detalle), g = base.index ? base.toNonIndexed() : base, p = g.attributes.position!;
    if (plano) g.computeVertexNormals();
    for (let k = 0; k < p.count; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, k), nn = plano ? new THREE.Vector3().fromBufferAttribute(g.attributes.normal!, k) : v.clone().normalize();
      nn.y /= ey;
      nn.normalize();
      pos.push(v.x + x, v.y * ey + y, v.z + z);
      nor.push(nn.x, nn.y, nn.z);
      const t = abajo + (1 - abajo) * Math.min(1, Math.max(0, (v.y / r + 1) / 2));
      col.push(t, t, t);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Las geometrías, de alto 1 más o menos (la escala de cada mata las pone a su tamaño), en el orden de `TIPOS_DE_MATA`. */
const GEO = [
  hojas(5, 0.34, 0.5, 0.72, (k) => 0.65 + 0.35 * ((k * 7) % 5) / 4),
  bolas([[0.22, 0, 0.55, 0, 1], [0.19, 0.42, 0.4, 0.2, 1], [0.2, -0.3, 0.42, -0.3, 1]], 0.95, 0, 'flor'),
  bolas([[0.5, 0, 0.35, 0, 0.7], [0.36, 0.36, 0.28, 0.14, 0.7]], 0.6),
  hojas(9, 0.06, 0.18, 0.7, (k) => 0.75 + 0.25 * ((k * 3) % 4) / 3),
  bolas([[0.5, 0, 0.12, 0, 0.55]], 0.8, 0, 'piedra'),
];
/** Lo que mide cada tipo (u, con el azar de cada una entre ×0,7 y ×1,3). */
const TAMANO = [0.15, 0.14, 0.2, 0.32, 0.12];
/** Los que se mecen con el viento. */
const MECEN = new Set([T.hierba, T.flor, T.junco]);

const C = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const COLOR = {
  hierbaSeca: C(0.76, 0.69, 0.42),
  hierbaVerde: C(0.47, 0.6, 0.28),
  hierbaRica: C(0.33, 0.5, 0.2),
  flores: [C(0.8, 0.18, 0.13), C(0.95, 0.83, 0.3), C(0.95, 0.94, 0.88), C(0.6, 0.45, 0.75)],
  mata: C(0.34, 0.41, 0.23),
  mataGris: C(0.5, 0.55, 0.4),
  junco: C(0.48, 0.55, 0.3),
  piedra: C(0.58, 0.56, 0.52),
};

/** El color (lineal) de una mata de tipo `t` en (x, y) con su azar `r` y la fertilidad `f`. Las flores van del color de su mancha. */
export function colorDeMata(t: number, x: number, y: number, r: number, f: number, out: THREE.Color): THREE.Color {
  const v = 0.86 + 0.28 * r;
  if (t === T.hierba) {
    out.copy(COLOR.hierbaSeca).lerp(COLOR.hierbaVerde, suave(0.12, 0.5, f));
    if (f > 0.5) out.lerp(COLOR.hierbaRica, suave(0.5, 0.9, f));
  } else if (t === T.flor) out.copy(COLOR.flores[Math.floor(azar(Math.floor(x / 9), Math.floor(y / 9), 401) * COLOR.flores.length)]!);
  else if (t === T.mata) out.copy(COLOR.mata).lerp(COLOR.mataGris, azar(Math.floor(x * 4), Math.floor(y * 4), 17) < 0.2 ? 0.8 : 0);
  else if (t === T.junco) out.copy(COLOR.junco);
  else out.copy(COLOR.piedra);
  return out.multiplyScalar(v);
}

/** El material de las matas: color de vértice por el de cada mata y, con `VIENTO`, la punta se mece. Lleva la niebla de guerra. */
function material(niebla: NieblaDeGuerra, tiempo: { value: number }, viento: boolean): THREE.MeshLambertMaterial {
  // las hojas ya llevan las dos caras en la geometría
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  if (viento) m.defines = { VIENTO: '' };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = tiempo;
    sh.vertexShader = 'uniform float uTiempo;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #if defined( VIENTO ) && defined( USE_INSTANCING )
      {
        vec2 sitio = instanceMatrix[3].xz;
        float rafaga = sin(uTiempo * 1.3 + sitio.x * 0.35 + sitio.y * 0.22) * 0.6 + sin(uTiempo * 2.9 + sitio.x * 1.7 - sitio.y * 1.3) * 0.25;
        transformed.xz += vec2(0.22, 0.12) * rafaga * transformed.y * transformed.y;
      }
      #endif`);
    niebla.parchear(sh);
  };
  m.customProgramCacheKey = () => (viento ? 'matas-viento' : 'matas');
  return m;
}

interface Trozo { grupo: THREE.Group; clave: string }

export class Matas {
  readonly grupo = new THREE.Group();
  private readonly tiempo = { value: 0 };
  private readonly mecen: THREE.MeshLambertMaterial;
  private readonly quietas: THREE.MeshLambertMaterial;
  private readonly trozos = new Map<string, Trozo>();
  private readonly cauces: Cauces;
  private claros: readonly Claro[] = [];
  private caminos: Cauces = { rios: [] };
  private claveClaros = '';

  constructor(private readonly fuente: FuenteDeAltura, private readonly mapa: MapaGenerado, niebla: NieblaDeGuerra) {
    this.mecen = material(niebla, this.tiempo, true);
    this.quietas = material(niebla, this.tiempo, false);
    this.cauces = caucesDe(mapa);
  }

  /** Mueve el viento: `segundos` desde que empezó la vista. */
  mover(segundos: number): void {
    this.tiempo.value = segundos % 3600;
  }

  /** Los claros de las maquetas y los caminos, como en `Arboles.fijarDespejes`. */
  fijarDespejes(claros: readonly Claro[], caminos: readonly { puntos: readonly Punto[]; ancho: number }[], clave: string): void {
    if (clave === this.claveClaros) return;
    this.claros = claros;
    this.caminos = franjas(caminos.map((c) => ({ puntos: c.puntos, medio: c.ancho / 2 })));
    this.claveClaros = clave;
  }

  /** Pide los trozos a menos de `alcance` u de (cx, cy), los más cercanos primero, mientras quede tiempo, y suelta los lejanos. Devuelve
   * cuántos faltan. */
  actualizar(cx: number, cy: number, alcance: number, hasta: number): number {
    const quiero = new Map<string, { x0: number; y0: number; d: number; banda: number; clave: string }>();
    const maxX = Math.ceil(this.fuente.ancho / TROZO) - 1, maxY = Math.ceil(this.fuente.alto / TROZO) - 1;
    for (let ty = Math.max(0, Math.floor((cy - alcance) / TROZO)); ty <= Math.min(maxY, Math.floor((cy + alcance) / TROZO)); ty++) {
      for (let tx = Math.max(0, Math.floor((cx - alcance) / TROZO)); tx <= Math.min(maxX, Math.floor((cx + alcance) / TROZO)); tx++) {
        const x0 = tx * TROZO, y0 = ty * TROZO;
        const d = Math.hypot(Math.max(x0 - cx, 0, cx - x0 - TROZO), Math.max(y0 - cy, 0, cy - y0 - TROZO));
        if (d > alcance) continue;
        const banda = BANDAS.findIndex((b) => d < b.hasta);
        quiero.set(`${tx},${ty}`, { x0, y0, d, banda, clave: `${banda}|${this.claveClaros}` });
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
    const { parte, crece } = BANDAS[banda]!;
    const lista = matasDelTrozo({ fuente: this.fuente, mapa: this.mapa, cauces: this.cauces, caminos: this.caminos, claros: this.claros }, x0, y0, TROZO, parte);
    this.soltar(clave);
    const grupo = new THREE.Group(), n = lista.length / POR_MATA, cuantos = new Array<number>(TIPOS_DE_MATA.length).fill(0);
    for (let k = 0; k < n; k++) cuantos[lista[POR_MATA * k + 4]!]!++;
    const mallas = cuantos.map((c, t) => (c ? new THREE.InstancedMesh(GEO[t]!, MECEN.has(t) ? this.mecen : this.quietas, c) : null)), puestos = cuantos.map(() => 0);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), color = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const o = POR_MATA * k, x = lista[o]!, y = lista[o + 1]!, h = lista[o + 2]!, r = lista[o + 3]!, t = lista[o + 4]!, f = lista[o + 5]!, malla = mallas[t]!;
      const esc = TAMANO[t]! * crece * (0.7 + 0.6 * r);
      eu.set(t === T.piedra ? (r - 0.5) * 0.4 : 0, r * 6.28 * 7, 0);
      q.setFromEuler(eu);
      s.set(esc, esc * (t === T.hierba ? 0.8 + 0.5 * azar(Math.round(x * 50), Math.round(y * 50), 3) : 1), esc);
      p.set(x, h - (t === T.piedra ? 0.02 : 0.01), y);
      m.compose(p, q, s);
      malla.setMatrixAt(puestos[t]!, m);
      malla.setColorAt(puestos[t]!++, colorDeMata(t, x, y, r, f, color));
    }
    for (const [t, malla] of mallas.entries()) {
      if (!malla) continue;
      malla.computeBoundingSphere();
      malla.receiveShadow = true;
      malla.castShadow = banda === 0 && t === T.mata;
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

  /** Cuántas matas hay puestas (para el banco de pruebas). */
  get cuantas(): number {
    let n = 0;
    for (const t of this.trozos.values()) for (const m of t.grupo.children) n += (m as THREE.InstancedMesh).count;
    return n;
  }

  destruir(): void {
    for (const clave of [...this.trozos.keys()]) this.soltar(clave);
    this.mecen.dispose();
    this.quietas.dispose();
  }
}
