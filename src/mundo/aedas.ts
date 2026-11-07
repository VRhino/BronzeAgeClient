// Lo de los Aedas itinerantes que no depende de la interfaz (lo usan el mapa, el mundo 3D y las fichas): su nombre y su color.

/** Los nombres de los itinerantes, por su N (el motor no los nombra). Bardos y cantores de la tradición griega. */
const NOMBRES_ITINERANTES = ['Demódoco', 'Femio', 'Tamiris', 'Lino', 'Museo', 'Arión', 'Terpandro', 'Eumolpo', 'Anfión', 'Olén', 'Taletas', 'Alcmán',
  'Melampo', 'Crisótemis', 'Filamón', 'Estesícoro', 'Panfo', 'Íbico', 'Corina', 'Telesila', 'Praxila', 'Lasos', 'Polimnesto', 'Sácadas'];

/** `aeda-3` → «Tamiris». Si el id no lleva número, el id. */
export function nombreDeAeda(id: string): string {
  const n = Number(/(\d+)$/.exec(id)?.[1]);
  return Number.isFinite(n) && n >= 1 ? NOMBRES_ITINERANTES[(n - 1) % NOMBRES_ITINERANTES.length]! : id;
}

/** El color de la lira y del cartel de un Aeda: lana clara, sin Facción. */
export const COLOR_AEDA = '#e9d8a6';
