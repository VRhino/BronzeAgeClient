// Panel de AVISOS: el historial consultable de lo que te ha pasado, con lo más reciente arriba. Arriba del todo, los URGENTES (te atacan, combates tuyos,
// piden unirse a tu ejército…) destacados; debajo, el resto en GRUPOS por categoría, plegables, con su contador de líneas sin leer y su botón de marcar
// como leído. Una línea con «×N» es N avisos iguales fundidos (`ui/avisos.ts`). Un informe de combate se abre como briefing al pulsarlo. Qué te
// persigue ahora mismo no es histórico: sale en la barra superior (`jugador-alerta`).
import { ayuda } from './ayuda';
import { CATEGORIAS, historialDeAvisos, marcarAvisosLeidos, type CategoriaAviso, type EntradaAviso } from './avisos';

const ETIQUETA = { peligro: 'Te atacaron', combate: 'Combate', baja: 'Bajas', mirada: 'Te observaron' } as const;
const AYUDA_CATEGORIA: Record<CategoriaAviso, string> = {
  combate: 'Tus combates, ataques recibidos y deserciones. Son urgentes: salen arriba, con aviso propio.',
  diplomacia: 'Propuestas y cambios de relación con otras Facciones. Las propuestas piden respuesta: salen arriba.',
  movimientos: 'Ejércitos en preparación y uniones en campo. Pedir unirse a tu ejército es urgente; lo demás se agrupa aquí sin avisar.',
  inteligencia: 'Quién te ha observado o ha pedido el plano de una plaza. Se agrupa por tipo y origen y no avisa: solo suma a la insignia.',
  economia: 'Tropa prestada que te retiran y otros cambios de recursos. Se agrupa sin avisar.',
};
const ALMACEN = 'bac_avisos_plegadas';
const plegadas = new Set<string>(leerPlegadas());

function leerPlegadas(): string[] {
  try { const v = JSON.parse(localStorage.getItem(ALMACEN) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function alternarPlegado(cat: string): void {
  if (!plegadas.delete(cat)) plegadas.add(cat);
  try { localStorage.setItem(ALMACEN, JSON.stringify([...plegadas])); } catch { /* sin almacenamiento: se recuerda solo en esta página */ }
}

const hora = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function htmlEntrada(a: EntradaAviso, i: number, e: (s: string) => string): string {
  const veces = a.veces > 1 ? ` ×${a.veces}` : '';
  // Una línea agrupada enseña de cuándo a cuándo (horas, no «hace 2 min»: así el HTML no cambia con el reloj).
  const cuando = a.veces > 1 && a.desde ? (hora(a.desde) === hora(a.hasta) ? `a las ${hora(a.hasta)}` : `de ${hora(a.desde)} a ${hora(a.hasta)}`) : a.momento ? new Date(a.momento).toLocaleString() : `evento ${a.version}`;
  return `<button class="mapa-lista-item aviso-${a.clase}${a.urgente ? ' aviso-urgente' : ''}${a.leido ? '' : ' aviso-nuevo'}" type="button" data-aviso="${i}"${a.informe ? '' : ' disabled'}>
      <strong>${e(a.titulo ?? ETIQUETA[a.clase])}${veces}${a.informe ? ` · ${e(a.informe.resultado)}` : ''}${a.leido ? '' : ' •'}</strong>
      <span>${e(a.texto)}</span>
      <span>${e(cuando)}${a.informe ? ' · ver informe' : ''}</span></button>`;
}

export function htmlAvisos(entradas: readonly EntradaAviso[], e: (s: string) => string): string {
  if (entradas.length === 0) return `<p class="mapa-lista-vacia">Nada que contar todavía.${ayuda('jugador:avisos', 'Aquí quedan tus combates, quién te ha mirado y los movimientos de ejércitos, agrupados por categoría.')}</p>`;
  const con = entradas.map((a, i) => [a, i] as const);
  const urgentes = con.filter(([a]) => a.urgente);
  const secciones = [];
  if (urgentes.length) {
    const sin = urgentes.filter(([a]) => !a.leido).length;
    secciones.push(`<section class="avisos-seccion avisos-urgentes" data-seccion="urgentes">
      <div class="avisos-cab"><strong>Urgentes (${urgentes.length}${sin ? `, ${sin} sin leer` : ''})</strong>${sin ? '<button type="button" class="avisos-leer" data-leer="urgentes">Marcar leído</button>' : ''}${ayuda('avisos:urgentes', 'Lo grave o lo que pide una decisión (te atacan, combates tuyos, deserción, peticiones de unirse a tu ejército, propuestas). Hacen aviso propio y no se agrupan.')}</div>
      <div class="mapa-lista">${urgentes.map(([a, i]) => htmlEntrada(a, i, e)).join('')}</div></section>`);
  }
  for (const [cat, nombre] of CATEGORIAS) {
    const lineas = con.filter(([a]) => !a.urgente && a.categoria === cat);
    if (!lineas.length) continue;
    const sin = lineas.filter(([a]) => !a.leido).length;
    const plegada = plegadas.has(cat);
    secciones.push(`<section class="avisos-seccion" data-seccion="${cat}">
      <div class="avisos-cab"><button type="button" class="avisos-plegar" data-plegar="${cat}" aria-expanded="${!plegada}">${plegada ? '▸' : '▾'} ${nombre} (${lineas.length}${sin ? `, ${sin} sin leer` : ''})</button>${sin ? `<button type="button" class="avisos-leer" data-leer="${cat}">Marcar leído</button>` : ''}${ayuda(`avisos:${cat}`, AYUDA_CATEGORIA[cat])}</div>
      ${plegada ? '' : `<div class="mapa-lista">${lineas.map(([a, i]) => htmlEntrada(a, i, e)).join('')}</div>`}</section>`);
  }
  return `<div class="avisos-grupos">${secciones.join('')}</div>`;
}

/** Cablea el panel recién pintado: informes, plegar/desplegar y marcar leído. Lo urgente se da por visto al abrir el panel; lo demás, solo al marcarlo. */
export function cablearAvisos(panel: HTMLElement, repintar: () => void, abrirInforme: (informe: NonNullable<EntradaAviso['informe']>) => void): void {
  panel.querySelectorAll<HTMLButtonElement>('[data-aviso]').forEach((b) => b.addEventListener('click', () => {
    const informe = historialDeAvisos()[Number(b.dataset.aviso)]?.informe;
    if (informe) abrirInforme(informe);
  }));
  panel.querySelectorAll<HTMLButtonElement>('[data-plegar]').forEach((b) => b.addEventListener('click', () => { alternarPlegado(b.dataset.plegar!); repintar(); }));
  panel.querySelectorAll<HTMLButtonElement>('[data-leer]').forEach((b) => b.addEventListener('click', () => marcarAvisosLeidos(b.dataset.leer as 'urgentes' | CategoriaAviso)));
  marcarAvisosLeidos('urgentes');
}
