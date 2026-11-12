// BODEGA Y PRENSA, UNA RECETA A LA VEZ (motor b55e90f, Economia_Construccion §5.3 y §6.4). La bodega hace vino (de uva) o cerveza (de cebada) y
// la prensa aceite de aceituna o de sésamo, pero cada edificio trabaja una sola: la de su insumo activo (`Edificio.receta`). La elige el
// Gobernador o el Maestro de Obras con `elegirReceta`. `TALLERES_DE_UNA_RECETA` da los topes por plaza: cuántos edificios de cada tipo caben
// (de cualquier estado) y cuántas recetas distintas puede trabajar la plaza según su nivel operativo; si baja de nivel y le sobran, las que
// sobran paran (`Edificio.recetaParada`). Aquí se calcula lo mismo que el motor (`recetas_unicas.rs`) para no ofrecer lo que rechazaría.
import { bloqueDeDatos, nivelesDeEdificio } from '../apiCliente';
import type { Asentamiento, Edificio } from '../tiposDominio';

/** Un tipo de `TALLERES_DE_UNA_RECETA`: cuántos caben en una plaza y cuántas recetas distintas por nivel operativo. */
interface TallerDeUnaReceta { maximoPorPlaza?: number; recetasDistintasPorNivel?: Record<string, number> }

/** Lo que hace cada insumo, para decirlo en palabras: en qué taller, qué sale y su nombre corto. */
export const RECETA_DE_INSUMO: Record<string, { taller: string; produce: string; nombre: string }> = {
  uva: { taller: 'bodega', produce: 'vino', nombre: 'Vino' },
  cebada: { taller: 'bodega', produce: 'cerveza', nombre: 'Cerveza' },
  aceituna: { taller: 'prensa', produce: 'aceite', nombre: 'Aceite de oliva' },
  sesamo: { taller: 'prensa', produce: 'aceiteSesamo', nombre: 'Aceite de sésamo' },
};

/** El aviso del hecho `construccion.receta_elegida`, por el insumo que se eligió. */
export const TEXTO_DE_RECETA: Record<string, string> = {
  uva: 'Una bodega de la plaza hace ahora vino, de uva.',
  cebada: 'Una bodega de la plaza hace ahora cerveza, de cebada.',
  aceituna: 'Una prensa de la plaza hace ahora aceite de oliva.',
  sesamo: 'Una prensa de la plaza hace ahora aceite de sésamo.',
};

const reglas = (alCargar?: () => void): Record<string, TallerDeUnaReceta> | null => bloqueDeDatos<Record<string, TallerDeUnaReceta>>('TALLERES_DE_UNA_RECETA', alCargar);

/** ¿Trabaja ese tipo una sola receta a la vez? (la bodega y la prensa). Sin los datos todavía, por su nombre. */
export function esDeUnaReceta(tipo: string, alCargar?: () => void): boolean {
  const r = reglas(alCargar);
  return r ? tipo in r : tipo === 'bodega' || tipo === 'prensa';
}

/** El insumo de cada receta del nivel interno del edificio, en el orden del catálogo (la primera es la de partida). */
export function insumosDe(e: Edificio, alCargar?: () => void): string[] {
  const recetas = nivelesDeEdificio(e.tipo, alCargar)?.[String(e.nivelInterno ?? 1)]?.recetas ?? [];
  return recetas.map((r) => Object.keys(r.consumePorUnidad)[0]).filter((x): x is string => Boolean(x));
}

/** El insumo de la receta que trabaja el edificio: el elegido o, sin elegir, el de la primera receta (como `insumo_activo` del motor). */
export function insumoActivo(e: Edificio, alCargar?: () => void): string | undefined {
  if (!esDeUnaReceta(e.tipo, alCargar)) return undefined;
  return e.receta ?? insumosDe(e, alCargar)[0];
}

/** Cuántas recetas distintas de ese tipo caben en ese nivel: un nivel que no está usa el más alto por debajo y, por debajo del primero, el primero. */
export function recetasDistintas(tipo: string, nivel: number, alCargar?: () => void): number {
  const tabla = Object.entries(reglas(alCargar)?.[tipo]?.recetasDistintasPorNivel ?? {}).map(([k, v]) => [Number(k), v] as const).sort((x, y) => x[0] - y[0]);
  if (!tabla.length) return 1;
  return ([...tabla].reverse().find(([n]) => n <= nivel) ?? tabla[0]!)[1];
}

/** Cuántos edificios de ese tipo caben en una plaza (de cualquier estado); `null` si no tiene tope. */
export function maximoPorPlaza(tipo: string, alCargar?: () => void): number | null {
  return reglas(alCargar)?.[tipo]?.maximoPorPlaza ?? null;
}

/** ¿La plaza ya tiene todos los edificios de ese tipo que caben (contando la cola y las obras)? */
export function topeDeEdificiosLleno(a: Asentamiento, tipo: string, alCargar?: () => void): boolean {
  const maximo = maximoPorPlaza(tipo, alCargar);
  return maximo !== null && (a.edificios ?? []).filter((x) => x.tipo === tipo).length >= maximo;
}

/** Los insumos distintos que trabajan los edificios de ese tipo de la plaza (de cualquier estado), con `cambio` puesto en uno de ellos. */
function insumosDistintos(a: Asentamiento, tipo: string, cambio?: { id: string; insumo: string }, alCargar?: () => void): Set<string> {
  const distintos = new Set<string>();
  for (const x of a.edificios ?? []) {
    if (x.tipo !== tipo) continue;
    const insumo = cambio && x.id === cambio.id ? cambio.insumo : insumoActivo(x, alCargar);
    if (insumo) distintos.add(insumo);
  }
  return distintos;
}

/** Las recetas a las que se puede pasar el edificio ahora, por su insumo (sin la que ya tiene): las de su nivel que no pasan del tope de recetas
 * distintas de la plaza en su nivel operativo, como `elegir_receta` del motor. Vacío si no es una bodega ni una prensa. */
export function recetasElegibles(a: Asentamiento, e: Edificio, alCargar?: () => void): string[] {
  if (!esDeUnaReceta(e.tipo, alCargar)) return [];
  const activo = insumoActivo(e, alCargar);
  const caben = recetasDistintas(e.tipo, a.nivelActual ?? a.nivel, alCargar);
  return insumosDe(e, alCargar).filter((i) => i !== activo && insumosDistintos(a, e.tipo, { id: e.id, insumo: i }, alCargar).size <= caben);
}
