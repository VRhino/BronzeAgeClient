// La región del relieve del generador en un punto (tanda 69): la capa `rasters.region` del artefacto con los nombres de `regiones`, como la lee
// el motor (`Geografia::region_en`, celda de la posición). La usan la taberna (el informe de región se compra para la región de la plaza) y el
// Mercado (las órdenes que deja ver un informe de órdenes).
import type { MapaGenerado, Point } from '../terreno';

export interface Region {
  id: number;
  nombre: string;
}

/** La región en `p`, o `null` sin la capa, fuera del mapa o en una celda sin región (0). */
export function regionEn(mapa: MapaGenerado | null | undefined, p: Point): Region | null {
  const r = mapa?.rasters?.region;
  if (!r || p.x < 0 || p.y < 0) return null;
  const c = Math.floor(p.x / r.celda);
  const f = Math.floor(p.y / r.celda);
  if (c >= r.columnas || f >= r.filas) return null;
  const id = r.datos[f * r.columnas + c]!;
  return id === 0 ? null : { id, nombre: nombreDeRegion(mapa, id) };
}

/** El nombre de la región `id` («Altiplano interior»); sin la lista, «la región N». */
export function nombreDeRegion(mapa: MapaGenerado | null | undefined, id: number): string {
  return mapa?.regiones?.find((x) => x.id === id)?.nombre ?? `la región ${id}`;
}
