// Copia INDEPENDIENTE de las formas de datos que sirve `GET /jugador/partidas/:gameId/mapa/:mapaId`.
// Deliberadamente NO importadas de `src/domain/types.ts` ni `src/worldgen/types.ts` del backend — ver el
// README de esta carpeta para el porqué (duplicación T2a asumida a propósito, cero import del motor).

export interface Point {
  x: number;
  y: number;
}

export type TerrenoTipo = 'agua' | 'costa' | 'llano' | 'colina' | 'montana' | 'cima';

export type BiomaTipo = 'agua' | 'costa' | 'estepa' | 'llanuraFertil' | 'colina' | 'montana' | 'cima';

export interface RioZona {
  id: string;
  puntos: Point[];
  terminaEnLago: boolean;
  navegable: boolean;
}

export interface ZonaBosque {
  id: string;
  centro: Point;
  radio: number;
  densidad: number;
}

export interface NodoRecurso {
  id: string;
  tipo: string;
  rareza: string;
  posicion: Point;
  cantidadInicial: number;
}

/** Desplazamiento propio de cada octava del ruido fractal — ver `ruido.ts`. */
export interface DesplazamientoOctava {
  dx: number;
  dy: number;
}

export interface CampoRuido {
  permutacion: number[];
  octavas: number;
  frecuenciaBase: number;
  lacunaridad: number;
  persistencia: number;
  desplazamientos: DesplazamientoOctava[];
  amplitudTotal: number;
}

export type CampoFertilidad = CampoRuido;

/**
 * `region` se omite a propósito de esta copia: `evaluarElevacion` aquí SOLO reproduce el caso "mundo libre"
 * (sin región). Un `MapaGenerado.elevacion.region` presente (partida creada con `region` en `POST
 * /admin/partidas`) no se interpreta — ver la limitación documentada en `elevacion.ts` y en el README.
 */
export interface CampoElevacion {
  ruido: CampoRuido;
  region?: unknown;
  borde?: { ruido: CampoRuido; limites: { ancho: number; alto: number } };
}

export interface WorldConfig {
  ancho: number;
  alto: number;
  seed: number;
  region?: string;
}

/** Forma de lo que devuelve `GET /jugador/partidas/:gameId/mapa/:mapaId` (Fase C11a) — igual que
 * `MapaGenerado` del servidor, pero es una interfaz propia de este cliente, no un import. */
export interface MapaGenerado {
  version: number;
  config: WorldConfig;
  bosques: ZonaBosque[];
  nodos: NodoRecurso[];
  /** Solo en el mapa del backend TypeScript (el ruido que este cliente recalculaba); el del motor en Rust trae `rasters`. */
  fertilidad?: CampoFertilidad;
  elevacion?: CampoElevacion;
  rios: RioZona[];
  /** Las capas raster del artefacto de mundo (contrato 06), en unidades estratégicas: con ellas no se recalcula nada. */
  rasters?: RastersDeMundo;
}

/** Un raster del artefacto de mundo: `columnas × filas` celdas de `celda` unidades, por filas de norte a sur. */
export interface RasterU8 {
  columnas: number;
  filas: number;
  celda: number;
  datos: Uint8Array;
}

export interface RasterU16 {
  columnas: number;
  filas: number;
  celda: number;
  datos: Uint16Array;
}

export interface RastersDeMundo {
  /** `ClaseTerreno` de world.proto: 1 agua, 2 costa, 3 llano, 4 colina, 5 montaña, 6 cima. */
  terreno?: RasterU8;
  /** 0..65535 sobre el rango del generador. */
  altura?: RasterU16;
  densidadBosque?: RasterU8;
}
