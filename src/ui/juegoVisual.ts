// PIEZAS VISUALES de los paneles de la plaza con aire de juego de estrategia (petición de Víctor, 2026-11-02): tiempos, barras de avance, marcas de
// nivel, chips de coste, medallones de nivel y medidores con color. Las usan el panel de obras (`panelObras.ts`) y Centro urbano (`panelCentro.ts`);
// los estilos van en `style.css` (bloques «Panel de obras» y «Centro urbano»).
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { estadoCliente } from './estadoCliente';

type Escapar = (valor: string) => string;

/** El instante de mundo de la última proyección (o el del reloj, sin ella). */
export const ahora = (): number => estadoCliente.proyeccionUltima?.instante ?? Date.now();

/** "3 d 4 h" / "2 h 15 min" / "40 min". Desde un día, en días y horas (las subidas de nivel duran días). */
export function duracion(minutos: number): string {
  if (minutos >= 1440) {
    const d = Math.floor(minutos / 1440);
    const h = Math.round((minutos % 1440) / 60);
    return h === 0 ? `${d} d` : h === 24 ? `${d + 1} d` : `${d} d ${h} h`;
  }
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  return h === 0 ? `${min} min` : min === 0 ? `${h} h` : `${h} h ${min} min`;
}

/** Lo que falta para un instante de mundo: "3 min", "45 s", "listo". */
export function cuentaAtras(instanteFin: number | undefined): string {
  if (typeof instanteFin !== 'number') return '';
  const ms = instanteFin - ahora();
  if (ms <= 0) return 'listo';
  return ms >= 60_000 ? duracion(Math.round(ms / 60_000)) : `${Math.round(ms / 1000)} s`;
}

/** Barra de avance (0 a 1); `null` = sin saber cuánto (rayas que corren). */
export const barraAvance = (x: number | null): string => `<span class="obra-barra${x === null ? ' indefinida' : ''}"><i style="width:${x === null ? 100 : (x * 100).toFixed(1)}%"></i></span>`;

/** Las marcas de nivel: llenas hasta `nivel`, vacías hasta el máximo. */
export const marcasNivel = (nivel: number, maximo: number): string =>
  `<span class="obra-marcas" aria-label="Nivel ${nivel} de ${maximo}">${Array.from({ length: Math.max(nivel, maximo) }, (_, i) => `<i${i < nivel ? ' class="llena"' : ''}></i>`).join('')}</span>`;

/** Un coste en chips con icono; en rojo lo que el almacén no cubre. Con más recursos que `maximo`, los primeros y «+N» (el coste entero, en el título). */
export function chipsDeCoste(a: { almacen?: Record<string, { cantidad: number }> }, coste: Record<string, number>, esc: Escapar, maximo = Infinity): string {
  const lista = Object.entries(coste);
  const resto = lista.length > maximo ? lista.length - maximo + 1 : 0;
  const hay = (r: string): number => a.almacen?.[r]?.cantidad ?? 0;
  const faltaEnResto = resto > 0 && lista.slice(maximo - 1).some(([r, n]) => hay(r) < n);
  return (resto ? lista.slice(0, maximo - 1) : lista).map(([r, n]) => {
    const falta = hay(r) < n;
    return `<span class="obra-coste${falta ? ' falta' : ''}" title="${esc(`${n} ${RECURSO_NOMBRE[r] ?? r}${falta ? ` (hay ${Math.floor(hay(r))})` : ''}`)}">${RECURSO_ICONO[r] ?? '📦'}${n}</span>`;
  }).join('') + (resto ? `<span class="obra-coste${faltaEnResto ? ' falta' : ''}">+${resto}</span>` : '');
}

/** Un medallón de nivel (escudo con la cifra). `clase`: 'apagado' (aún no), 'listo' (se puede subir) o '' (el de ahora). */
export function medallonNivel(nivel: number, clase = '', titulo = `Nivel ${nivel}`): string {
  return `<span class="medallon-nivel${clase ? ` ${clase}` : ''}" title="${titulo}" aria-label="${titulo}">
    <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 37 10v14c0 10-7.4 17.4-17 20C10.4 41.4 3 34 3 24V10Z"/></svg><b>${nivel}</b></span>`;
}

export type Tono = 'bien' | 'medio' | 'mal';

/** El tono de un valor de 0 a 100 en el que más es mejor: verde desde 66, ámbar desde 33, rojo por debajo. */
export const tonoDe = (valor: number): Tono => (valor >= 66 ? 'bien' : valor >= 33 ? 'medio' : 'mal');

/** Un medidor de 0 a 100 con icono, cifra grande y una palabra de estado; el color va con el tono. */
export function medidor(icono: string, etiqueta: string, valor: number, estados: Record<Tono, string>, titulo: string, esc: Escapar): string {
  const tono = tonoDe(valor);
  const v = Math.max(0, Math.min(100, valor));
  return `<div class="medidor ${tono}" title="${esc(titulo)}">
    <span class="medidor-icono" aria-hidden="true">${icono}</span>
    <span class="medidor-cab"><span>${esc(etiqueta)}</span><strong>${Math.round(valor)}</strong></span>
    <span class="medidor-pista"><i style="width:${v.toFixed(1)}%"></i></span>
    <small class="medidor-estado">${esc(estados[tono])}</small>
  </div>`;
}

/** Números con separador de miles. */
export const miles = (n: number): string => Math.floor(n).toLocaleString('es-ES');
