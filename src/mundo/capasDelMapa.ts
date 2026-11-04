// Las capas del mapa que el jugador pone y quita (Víctor, 2026-11-03): los nombres de los nodos, en el modo mundo y en el modo mapa, y en el
// modo mapa la fertilidad del suelo y las parcelas de bosque, estas dos solo sobre lo explorado alguna vez. También hasta dónde se carga el mundo
// 3D. Se recuerdan en este navegador.
// Aquí va lo que no pinta: qué capas hay puestas, qué se ha explorado y el color de cada fertilidad. Lo pinta `render.ts`.
import type { RasterU8 } from '../terreno';
import { DISTANCIA_CARGA } from '../mundo3d/config';
import type { NieblaProyectada } from '../tiposDominio';

export interface CapasDelMapa {
  /** Los nombres de los nodos de recursos (en el 3D, los cercanos; en el modo mapa, de cerca). */
  nombresDeNodos: boolean;
  /** La fertilidad del suelo, con el corte de la aldea agrícola. En el modo mapa y, desde 0.131.0, en el mundo 3D. */
  fertilidad: boolean;
  /** Las parcelas de bosque (el cupo de Leñeras), libres, con Leñera o en zona ajena. Solo en el modo mapa. */
  parcelas: boolean;
}

export const CAPAS_POR_DEFECTO: Readonly<CapasDelMapa> = { nombresDeNodos: true, fertilidad: false, parcelas: false };
const CLAVE = 'bronzeage.capas';

function leer(): CapasDelMapa {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Record<keyof CapasDelMapa, unknown>>;
    const capas = { ...CAPAS_POR_DEFECTO };
    for (const k of Object.keys(capas) as (keyof CapasDelMapa)[]) if (typeof guardadas[k] === 'boolean') capas[k] = guardadas[k];
    return capas;
  } catch {
    return { ...CAPAS_POR_DEFECTO };
  }
}

let capas: CapasDelMapa | null = null;

/** Las capas puestas ahora. */
export function capasDelMapa(): Readonly<CapasDelMapa> {
  capas ??= leer();
  return capas;
}

/** Pone o quita una capa y lo recuerda (sin almacenamiento, vale para esta sesión). */
export function fijarCapa(nombre: keyof CapasDelMapa, si: boolean): void {
  capas = { ...capasDelMapa(), [nombre]: si };
  try { localStorage.setItem(CLAVE, JSON.stringify(capas)); } catch { /* sin almacenamiento */ }
}

const CLAVE_CARGA = 'bronzeage.distanciaCarga';
let carga: number | null = null;

/** Hasta dónde se carga el mundo 3D alrededor del héroe (u): el ajuste del jugador, dentro de `DISTANCIA_CARGA`, en pasos de `paso`. */
export function distanciaDeCarga(): number {
  if (carga === null) {
    let guardada = Number.NaN;
    try { guardada = Number(localStorage.getItem(CLAVE_CARGA) ?? Number.NaN); } catch { /* sin almacenamiento */ }
    carga = Number.isFinite(guardada) ? ajustarCarga(guardada) : DISTANCIA_CARGA.porDefecto;
  }
  return carga;
}

/** Lleva `u` a un valor válido de la distancia de carga: dentro del rango y en su paso. */
export function ajustarCarga(u: number): number {
  const { min, max, paso } = DISTANCIA_CARGA;
  return Math.min(max, Math.max(min, Math.round(u / paso) * paso));
}

export function fijarDistanciaDeCarga(u: number): void {
  carga = ajustarCarga(u);
  try { localStorage.setItem(CLAVE_CARGA, String(carga)); } catch { /* sin almacenamiento */ }
}

/** Lo explorado alguna vez, como pregunta por un punto (u). Sin niebla, todo. Se decodifica una vez por máscara. */
export type Explorado = (x: number, y: number) => boolean;
let ultimoExplorado: { celdas: string; columnas: number; filas: number; tamano: number; fn: Explorado } | null = null;

export function exploradoDe(n: NieblaProyectada | null | undefined): Explorado {
  if (!n || n.columnas <= 0 || n.filas <= 0) return () => true;
  const u = ultimoExplorado;
  if (u && u.celdas === n.celdas && u.columnas === n.columnas && u.filas === n.filas && u.tamano === n.tamanoCelda) return u.fn;
  const { columnas, filas, tamanoCelda } = n;
  const bytes = new Uint8Array(Math.ceil((columnas * filas) / 8));
  const pares = Math.min(bytes.length, n.celdas.length >> 1);
  for (let i = 0; i < pares; i++) bytes[i] = Number.parseInt(n.celdas.slice(i * 2, i * 2 + 2), 16) || 0;
  const fn: Explorado = (x, y) => {
    const c = Math.floor(x / tamanoCelda), f = Math.floor(y / tamanoCelda);
    if (c < 0 || f < 0 || c >= columnas || f >= filas) return false;
    const i = f * columnas + c;
    return (bytes[i >> 3]! & (1 << (i & 7))) !== 0;
  };
  ultimoExplorado = { celdas: n.celdas, columnas, filas, tamano: tamanoCelda, fn };
  return fn;
}

type Rgb = readonly [number, number, number];
const mezcla = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const entre = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));

/** Los colores de la capa: por debajo del corte de la aldea, de óxido a ocre (ahí no cabe); desde el corte, de paja a verde hondo. El salto de
 * color en el corte es a propósito: se ve dónde cabe una aldea. */
export const RAMPA_FERTILIDAD = {
  baja: [140, 66, 44] as Rgb,
  casi: [204, 132, 66] as Rgb,
  corte: [232, 214, 104] as Rgb,
  buena: [118, 178, 66] as Rgb,
  honda: [30, 110, 50] as Rgb,
  alfa: 160,
};

/** El color (RGBA, 0..255) de una fertilidad `f` (0..1) con el corte de la aldea en `minima`. */
export function colorDeFertilidad(f: number, minima: number): [number, number, number, number] {
  const R = RAMPA_FERTILIDAD;
  const rgb = f < minima
    ? mezcla(R.baja, R.casi, entre(f, 0, minima))
    : f < minima + 0.3 ? mezcla(R.corte, R.buena, entre(f, minima, minima + 0.3)) : mezcla(R.buena, R.honda, entre(f, minima + 0.3, minima + 0.6));
  return [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]), R.alfa];
}

/** Los píxeles RGBA de la capa de fertilidad, uno por celda del raster: transparentes en el agua y en lo que no se ha explorado. */
export function pixelesDeFertilidad(f: RasterU8, terreno: RasterU8 | undefined, explorado: Explorado, minima: number): Uint8ClampedArray {
  const tabla = Array.from({ length: 256 }, (_, v) => colorDeFertilidad(v / 255, minima));
  const out = new Uint8ClampedArray(f.columnas * f.filas * 4);
  const mismo = !!terreno && terreno.columnas === f.columnas && terreno.filas === f.filas && terreno.celda === f.celda;
  for (let j = 0; j < f.filas; j++) {
    for (let i = 0; i < f.columnas; i++) {
      const k = j * f.columnas + i, x = (i + 0.5) * f.celda, y = (j + 0.5) * f.celda;
      if (!explorado(x, y)) continue;
      if (terreno) {
        const clase = mismo ? terreno.datos[k] : terreno.datos[Math.floor(y / terreno.celda) * terreno.columnas + Math.floor(x / terreno.celda)];
        if (clase === 1) continue; // agua
      }
      out.set(tabla[f.datos[k]!]!, k * 4);
    }
  }
  return out;
}

/** El radio de una parcela de bosque (u): `PARAMETROS_PARCELAS.rp` del generador. */
export const RADIO_PARCELA = 4;
