// El relieve fino del mundo (contrato 06 §8, `PaqueteRelieve`): la altura cada 0,5 u de todo el mapa, la que dibuja el modo mundo en 3D. Se
// baja una vez por mundo (`InfoMundo.url_relieve`), se guarda en IndexedDB por su hash (`hash_relieve`) y se abre por teselas de 64 u, solo
// las que se piden. La altura se dibuja tal cual: la exageración vive en el generador, así las pendientes que se ven son las que usa el
// servidor.
import { fromBinary, toBinary } from '@bufbuild/protobuf';
import { decompress } from 'fzstd';
import { PaqueteRelieveSchema, type PaqueteRelieve, type TeselaRelieve } from '../contrato/gen/bronzeage/v1/world_pb';
import { descargarRelieve } from '../contrato/acceso';
import { cacheDeUno } from './cacheDeUno';

/** Metros que vale la altura máxima (65535), la escala del raster `altura` del artefacto. */
export const METROS_ALTURA = 1000;
const MIL = 1000;

export interface TeselaAbierta {
  /** (lado + 1)² muestras en orden de filas, de 0 a 65535 sobre `METROS_ALTURA`. */
  altura: Uint16Array;
  /** (lado + 1)² muestras: 1 = agua (mar o lago). */
  agua: Uint8Array;
}

/** Abre una tesela: deshace el zstd y la predicción de cada altura (izquierda + arriba − diagonal, módulo 2^16). */
export function abrirTesela(t: TeselaRelieve, lado: number): TeselaAbierta {
  const n = lado + 1, total = n * n;
  const crudo = decompress(t.altura);
  if (crudo.length !== total * 2) throw new Error(`tesela de relieve de ${crudo.length} bytes; se esperaban ${total * 2}`);
  const altura = new Uint16Array(total);
  for (let j = 0, k = 0; j < n; j++) {
    for (let i = 0; i < n; i++, k++) {
      const prediccion = i && j ? altura[k - 1]! + altura[k - n]! - altura[k - n - 1]! : i ? altura[k - 1]! : j ? altura[k - n]! : 0;
      altura[k] = ((crudo[2 * k]! | (crudo[2 * k + 1]! << 8)) + prediccion) & 0xffff;
    }
  }
  const agua = new Uint8Array(total);
  if (t.agua.length) {
    const bits = decompress(t.agua);
    for (let k = 0; k < total; k++) agua[k] = (bits[k >> 3]! >> (k & 7)) & 1;
  }
  return { altura, agua };
}

/** El paquete abierto: la altura y el agua en cualquier punto del mapa, abriendo solo las teselas que hacen falta. */
export class Relieve {
  readonly hash: string;
  readonly hashArtefacto: string;
  /** Unidades del mapa entre muestras. */
  readonly paso: number;
  /** Intervalos por lado de tesela. */
  readonly lado: number;
  readonly columnas: number;
  readonly filas: number;
  readonly teselasX: number;
  readonly teselasY: number;
  private readonly teselas: TeselaRelieve[];
  /** Las teselas abiertas, de la menos a la más usada hace poco. */
  private readonly abiertas = new Map<number, TeselaAbierta>();
  /** La última tesela pedida: pedir la misma seguida (lo normal al montar el terreno) no toca la lista de abiertas. */
  private ultima: { k: number; t: TeselaAbierta } | null = null;

  /** `maxAbiertas`: cuántas teselas se guardan abiertas (cada una ocupa unos 50 KB). */
  constructor(p: PaqueteRelieve, private readonly maxAbiertas = 96) {
    this.hash = p.hash;
    this.hashArtefacto = p.hashArtefacto;
    this.paso = p.paso / MIL;
    this.lado = p.ladoTesela;
    this.columnas = p.columnas;
    this.filas = p.filas;
    this.teselasX = p.teselasX;
    this.teselasY = p.teselasY;
    this.teselas = p.teselas;
    if (this.lado <= 0 || this.teselas.length !== this.teselasX * this.teselasY) throw new Error('paquete de relieve mal formado');
  }

  /** Cuántas teselas hay abiertas ahora. */
  get teselasAbiertas(): number {
    return this.abiertas.size;
  }

  /** La tesela (tx, ty), abierta. Las últimas `maxAbiertas` se quedan abiertas. */
  tesela(tx: number, ty: number): TeselaAbierta {
    const k = ty * this.teselasX + tx;
    if (this.ultima?.k === k) return this.ultima.t;
    let t = this.abiertas.get(k);
    if (t) {
      this.abiertas.delete(k);
    } else {
      t = abrirTesela(this.teselas[k]!, this.lado);
      if (this.abiertas.size >= this.maxAbiertas) this.abiertas.delete(this.abiertas.keys().next().value!);
    }
    this.abiertas.set(k, t);
    this.ultima = { k, t };
    return t;
  }

  /** La tesela y la posición dentro de ella (0..lado, con decimales) del punto (x, y), en unidades del mapa; fuera del mapa, el borde. */
  private situar(x: number, y: number): { t: TeselaAbierta; i: number; j: number } {
    const fi = Math.min(Math.max(x / this.paso, 0), this.columnas - 1);
    const fj = Math.min(Math.max(y / this.paso, 0), this.filas - 1);
    const tx = Math.min(this.teselasX - 1, Math.floor(fi / this.lado));
    const ty = Math.min(this.teselasY - 1, Math.floor(fj / this.lado));
    return { t: this.tesela(tx, ty), i: fi - tx * this.lado, j: fj - ty * this.lado };
  }

  /** La altura en metros en el punto (x, y), en unidades del mapa, interpolada entre las cuatro muestras de alrededor. */
  alturaEn(x: number, y: number): number {
    const { t, i, j } = this.situar(x, y), n = this.lado + 1;
    const i0 = Math.min(this.lado - 1, Math.floor(i)), j0 = Math.min(this.lado - 1, Math.floor(j)), a = i - i0, b = j - j0;
    const h = t.altura, k = j0 * n + i0;
    const v = (h[k]! * (1 - a) + h[k + 1]! * a) * (1 - b) + (h[k + n]! * (1 - a) + h[k + n + 1]! * a) * b;
    return (v / 65535) * METROS_ALTURA;
  }

  /** ¿Hay agua en la muestra más cercana al punto (x, y)? */
  aguaEn(x: number, y: number): boolean {
    const { t, i, j } = this.situar(x, y);
    return t.agua[Math.round(j) * (this.lado + 1) + Math.round(i)] === 1;
  }
}

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** ¿Es el paquete el anunciado y está entero? Su hash es el sha256 de su serialización con `hash = ""`. */
export async function verificarRelieve(p: PaqueteRelieve, hashAnunciado: string): Promise<boolean> {
  if (p.hash !== hashAnunciado) return false;
  const sinHash = toBinary(PaqueteRelieveSchema, { ...p, hash: '' });
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', sinHash as Uint8Array<ArrayBuffer>))) === p.hash;
}

const cache = cacheDeUno('bronzeage-relieve', 'paquetes');

/** El relieve del mundo vigente: de la caché si está ese hash; si no, lo baja de `url`, comprueba que es el anunciado y lo guarda. */
export async function cargarRelieve(base: string, url: string, hash: string): Promise<Relieve> {
  const guardado = await cache.leer(hash);
  if (guardado) return new Relieve(fromBinary(PaqueteRelieveSchema, guardado));
  const datos = await descargarRelieve(base, url);
  const p = fromBinary(PaqueteRelieveSchema, datos);
  if (!(await verificarRelieve(p, hash))) throw new Error('el relieve que se bajó no es el que anunció el servidor');
  await cache.guardar(hash, datos);
  return new Relieve(p);
}
