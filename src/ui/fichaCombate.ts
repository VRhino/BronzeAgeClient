// La ficha de combate de una tropa (0.205.0, motor 457c278): su tier, con el nombre de la rareza de `OBJETOS.rarezas`, y su bloque `combate`
// de `TROPAS_RECLUTABLES` (Heroe_Y_Tropa §12): vida por soldado; daño, penetración, defensa y alivio en %, por tipo de daño; bloqueo del escudo;
// cadencia (segundos entre golpes) y alcance (metros); las de distancia, precisión (1-100) y munición. Es lo que Conquest usa en la batalla:
// el cliente solo lo enseña.
import type { CombateDeTropa, PorTipoDeDano, TropaReclutable } from '../apiCliente';
import { catalogoDeObjetos } from './clasesHeroe';

type Escapar = (valor: string) => string;

const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];
/** Los nombres de las rarezas en pantalla, por su clave de `OBJETOS.rarezas`. */
const NOMBRE_RAREZA: Record<string, string> = { comun: 'común', pocoComun: 'poco común', rara: 'rara', epica: 'épica', legendaria: 'legendaria' };

/** La clave de rareza de un tier (1-5): la de `OBJETOS.rarezas` o, sin el bloque, la del orden de siempre. */
export function claveDeRareza(tier: number): string {
  return catalogoDeObjetos()?.rarezas?.[String(tier)] ?? ['comun', 'pocoComun', 'rara', 'epica', 'legendaria'][tier - 1] ?? 'comun';
}
/** «Tier III, rara». */
export function textoDeTier(tier: number): string {
  const clave = claveDeRareza(tier);
  return `Tier ${ROMANO[tier] ?? tier}, ${NOMBRE_RAREZA[clave] ?? clave}`;
}

const TIPOS: [keyof PorTipoDeDano, string, string][] = [['perforante', '🗡', 'Perforante'], ['cortante', '🪓', 'Cortante'], ['contundente', '🔨', 'Contundente']];
const FILAS: [keyof Pick<CombateDeTropa, 'dano' | 'penetracion' | 'defensa' | 'alivio'>, string, string][] = [
  ['dano', 'Daño', 'Lo que hace cada golpe, por tipo'],
  ['penetracion', 'Penetración', 'Cuánto atraviesa la defensa del rival, en %'],
  ['defensa', 'Defensa', 'Cuánto para de cada tipo de golpe, en %'],
  ['alivio', 'Alivio', 'Cuánto le quita al daño que le llega, en %'],
];
const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ','));

/** El bloque «Combate» del tooltip de una tropa; vacío si el catálogo no trae su ficha. Las filas todo a cero no salen. */
export function htmlFichaCombate(t: Pick<TropaReclutable, 'tier' | 'combate'>, e: Escapar): string {
  const c = t.combate;
  if (!c) return '';
  const tier = t.tier ? `<span class="ta-rareza r-${e(claveDeRareza(t.tier))}">${e(textoDeTier(t.tier))}</span>` : '';
  const filas = FILAS.filter(([k]) => TIPOS.some(([x]) => (c[k]?.[x] ?? 0) !== 0))
    .map(([k, nombre, titulo]) => `<tr><th scope="row" title="${e(titulo)}">${nombre}</th>${TIPOS.map(([x]) => `<td>${c[k][x] ? `${num(c[k][x])}${k === 'dano' ? '' : ' %'}` : '·'}</td>`).join('')}</tr>`).join('');
  const sueltas = [
    ['❤', `${num(c.vida)}`, 'Vida por soldado'],
    ...(c.bloqueo ? [['🛡', num(c.bloqueo), 'Bloqueo del escudo']] : []),
    ['⏱', `${num(c.cadencia)} s`, 'Cadencia: segundos entre golpes'],
    ['↔', `${num(c.alcance)} m`, 'Alcance'],
    ...(c.precision !== undefined ? [['🎯', num(c.precision), 'Precisión (1-100)']] : []),
    ...(c.municion !== undefined ? [['➶', num(c.municion), 'Munición']] : []),
  ].map(([i, v, titulo]) => `<span class="ta-rec" title="${e(titulo!)}"><i aria-hidden="true">${i}</i><b>${e(v!)}</b><span class="ta-sr">${e(titulo!)}</span></span>`).join('');
  const tabla = filas ? `<table class="ta-combate"><thead><tr><td></td>${TIPOS.map(([, i, n]) => `<th scope="col" title="${n}"><span aria-hidden="true">${i}</span> ${n}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>` : '';
  return `<h4>Combate ${tier}</h4><div class="ta-fichas">${sueltas}</div>${tabla}`;
}
