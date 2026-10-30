// El artefacto de mundo (contrato 06): lo baja por hash (`InfoMundo.url_artefacto`), lo guarda en IndexedDB para no bajarlo otra vez y lo
// convierte al `MapaGenerado` que ya pinta `render.ts`, en unidades estratégicas (el contrato viaja en milésimas). El relieve y la clase de
// terreno salen de sus rasters, no de recalcular el ruido del generador como hacía el cliente con el backend TypeScript (`src/terreno/`).
import { fromBinary } from '@bufbuild/protobuf';
import { decompress } from 'fzstd';
import { ArtefactoDeMundoSchema, EncodingRaster, type ArtefactoDeMundo, type Raster } from '../contrato/gen/bronzeage/v1/world_pb';
import { descargarArtefacto } from '../contrato/acceso';
import type { MapaGenerado, RastersDeMundo, RasterU8, RasterU16 } from '../terreno';
import { cacheDeUno } from './cacheDeUno';

const MIL = 1000;

/** Las celdas de un raster, ya descomprimidas. */
function bytes(r: Raster): Uint8Array {
  return r.zstd ? decompress(r.datos) : r.datos;
}

function u8(r: Raster | undefined): RasterU8 | undefined {
  if (!r || r.encoding !== EncodingRaster.ENCODING_U8) return undefined;
  return { columnas: r.columnas, filas: r.filas, celda: r.tamanoCelda / MIL, datos: bytes(r) };
}

function u16(r: Raster | undefined): RasterU16 | undefined {
  if (!r || r.encoding !== EncodingRaster.ENCODING_U16_LE) return undefined;
  const b = bytes(r);
  const datos = new Uint16Array(r.columnas * r.filas);
  const vista = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < datos.length; i++) datos[i] = vista.getUint16(i * 2, true);
  return { columnas: r.columnas, filas: r.filas, celda: r.tamanoCelda / MIL, datos };
}

const punto = (p: { x: bigint; y: bigint } | undefined) => ({ x: Number(p?.x ?? 0n) / MIL, y: Number(p?.y ?? 0n) / MIL });

/** Los tipos de nodo que el motor carga en su mapa (crates/nucleo/src/economia.rs, `Mapa`), en ese orden de artefacto. */
const TIPOS_DEL_MOTOR = new Set(['piedra', 'livestock', 'oro', 'cobre', 'estano', 'hierro']);

/**
 * El id de cada nodo como lo usa el motor: `nodo-N`, con N su posición entre los nodos del artefacto de esos tipos (el motor los indexa así).
 * Es el que llega en `pueblo.nodoId`, `obra.nodoId` y `edificio.fuenteId`, y el que pide `marcarPueblo`; el del artefacto (`piedra-727`) el
 * motor no lo entiende. Los de otro tipo conservan el suyo.
 */
function nodosConIdDelMotor(a: ArtefactoDeMundo): { n: ArtefactoDeMundo['nodos'][number]; id: string }[] {
  let i = 0;
  return a.nodos.map((n) => ({ n, id: TIPOS_DEL_MOTOR.has(n.tipo) ? `nodo-${i++}` : n.id }));
}

/** El artefacto, en la forma que pinta el mapa. */
export function mapaDesdeArtefacto(a: ArtefactoDeMundo): MapaGenerado {
  const tamano = punto(a.manifiesto?.tamano);
  const rasters: RastersDeMundo = { terreno: u8(a.terreno), altura: u16(a.altura), densidadBosque: u8(a.densidadBosque), fertilidad: u8(a.fertilidad) };
  return {
    version: a.manifiesto?.versionFormato ?? 0,
    config: { ancho: tamano.x, alto: tamano.y, seed: 0 },
    bosques: a.bosques.map((b) => ({ id: b.id, centro: punto(b.centro), radio: Number(b.radio) / MIL, densidad: b.densidadMilesimas / MIL })),
    nodos: nodosConIdDelMotor(a).map(({ n, id }) => ({ id, tipo: n.tipo, rareza: n.rareza, posicion: punto(n.posicion), cantidadInicial: Number(n.cantidadInicial) / MIL })),
    parcelas: a.parcelas.map((x) => ({ id: x.id, bosqueId: x.bosqueId, centro: punto(x.centro), densidad: x.densidadMilesimas / MIL })),
    rios: a.rios.map((r) => ({ id: r.id, puntos: r.puntos.map(punto), terminaEnLago: r.terminaEnLago, navegable: r.navegable, vados: r.vados.map(punto) })),
    rasters,
  };
}

// ─────────────────────────── caché en IndexedDB ───────────────────────────

const cache = cacheDeUno('bronzeage-mundo', 'artefactos');

/** El hash del artefacto que hay en caché (para `Hola.mundo_hash_conocido`), si hay alguno. */
export function hashEnCache(): Promise<string | undefined> {
  return cache.clave();
}

/** El mapa del mundo vigente: de la caché si coincide el hash; si no, lo baja de `url` y lo guarda. */
export async function cargarMundo(base: string, url: string, hash: string): Promise<{ mapa: MapaGenerado; artefacto: ArtefactoDeMundo }> {
  let datos = await cache.leer(hash);
  if (!datos) {
    datos = await descargarArtefacto(base, url);
    await cache.guardar(hash, datos);
  }
  const artefacto = fromBinary(ArtefactoDeMundoSchema, datos);
  return { mapa: mapaDesdeArtefacto(artefacto), artefacto };
}
