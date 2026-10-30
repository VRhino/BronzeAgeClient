// De dónde sale la altura del suelo: el paquete de relieve (cada 0,5 u) o, si el servidor no lo tiene, el raster `altura` del artefacto (cada
// 4 u, que se ve más liso). Alturas en metros, la escala del raster (65535 = 1.000 m).
import type { Relieve } from '../mundo/relieve';
import type { MapaGenerado } from '../terreno';

export interface FuenteDeAltura {
  /** Tamaño del mapa, en u. */
  readonly ancho: number;
  readonly alto: number;
  /** El paso más fino que tiene sentido muestrear, en u. */
  readonly paso: number;
  /** Metros en (x, y), interpolando entre muestras; fuera del mapa, la del borde. */
  alturaEn(x: number, y: number): number;
  /** ¿Agua (mar o lago) en (x, y)? */
  aguaEn(x: number, y: number): boolean;
}

export function fuenteDesdeRelieve(r: Relieve): FuenteDeAltura {
  return {
    ancho: (r.columnas - 1) * r.paso,
    alto: (r.filas - 1) * r.paso,
    paso: r.paso,
    alturaEn: (x, y) => r.alturaEn(x, y),
    aguaEn: (x, y) => r.aguaEn(x, y),
  };
}

/** `TERRENO_AGUA` de `ClaseTerreno` (world.proto). */
const CLASE_AGUA = 1;

/** El raster `altura` del artefacto (muestras en los centros de celda) y el agua de su raster `terreno`. `null` si el mapa no trae rasters. */
export function fuenteDesdeMapa(m: MapaGenerado): FuenteDeAltura | null {
  const altura = m.rasters?.altura, terreno = m.rasters?.terreno;
  if (!altura) return null;
  const { columnas, filas, celda, datos } = altura;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return {
    ancho: m.config.ancho,
    alto: m.config.alto,
    paso: celda,
    alturaEn(x, y) {
      const fi = clamp(x / celda - 0.5, columnas - 1), fj = clamp(y / celda - 0.5, filas - 1);
      const i = Math.min(columnas - 2, Math.floor(fi)), j = Math.min(filas - 2, Math.floor(fj)), a = fi - i, b = fj - j, k = j * columnas + i;
      const v = (datos[k]! * (1 - a) + datos[k + 1]! * a) * (1 - b) + (datos[k + columnas]! * (1 - a) + datos[k + columnas + 1]! * a) * b;
      return (v / 65535) * 1000;
    },
    aguaEn(x, y) {
      if (!terreno) return false;
      const i = clamp(Math.floor(x / terreno.celda), terreno.columnas - 1), j = clamp(Math.floor(y / terreno.celda), terreno.filas - 1);
      return terreno.datos[j * terreno.columnas + i] === CLASE_AGUA;
    },
  };
}

/** La densidad de bosque (0..1) en (x, y), del raster del artefacto (cada 4 u), interpolada. 0 si el mapa no la trae. */
export function bosqueEn(m: MapaGenerado, x: number, y: number): number {
  const r = m.rasters?.densidadBosque;
  if (!r) return 0;
  const fi = Math.min(Math.max(x / r.celda - 0.5, 0), r.columnas - 1), fj = Math.min(Math.max(y / r.celda - 0.5, 0), r.filas - 1);
  const i = Math.min(r.columnas - 2, Math.floor(fi)), j = Math.min(r.filas - 2, Math.floor(fj)), a = fi - i, b = fj - j, k = j * r.columnas + i, d = r.datos;
  return ((d[k]! * (1 - a) + d[k + 1]! * a) * (1 - b) + (d[k + r.columnas]! * (1 - a) + d[k + r.columnas + 1]! * a) * b) / 255;
}
