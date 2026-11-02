// Barra superior del JUGADOR: los menús que son suyos —héroe, escuadras, Facción— y no de un sitio concreto, accesibles desde cualquier
// vista (mapa, campamento, asentamiento). Lo propio de cada sitio (mercado, edificios, salir…) vive en la pantalla de ese sitio.
// Aquí solo está el HTML y la lista de paneles; quien pinta cada panel y cablea los botones es `main.ts`.
import type { ProyeccionJugador } from '../apiCliente';
import { nombreDePueblo } from './pueblos';

export type PanelJugador = 'heroe' | 'escuadras' | 'carro' | 'faccion' | 'tecnologia' | 'misiones' | 'avisos';

const BOTONES: [PanelJugador, string][] = [
  ['heroe', 'Héroe'],
  ['escuadras', 'Escuadras'],
  ['carro', 'Carro'],
  ['faccion', 'Facción'],
  ['tecnologia', 'Tecnología'],
  ['misiones', 'Misiones'],
  ['avisos', 'Avisos'],
];

/** El icono de cada botón (trazo en `currentColor`, 24×24). En el mundo la barra solo enseña el icono; el nombre queda en el `title`. */
const ICONO: Record<PanelJugador | 'mapa' | 'asentamiento', string> = {
  // yelmo corintio
  heroe: '<path d="M5 20v-8a7 7 0 0 1 14 0v8"/><path d="M5 20h4v-6h6v6h4"/><path d="M12 5V2M9 3h6"/>',
  // dos lanzas cruzadas sobre un escudo
  escuadras: '<path d="M4 4l16 16M20 4L4 20"/><path d="M4 4l3 0M4 4l0 3M20 4l-3 0M20 4l0 3"/><circle cx="12" cy="12" r="4"/>',
  // rueda de carro
  carro: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.6"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7"/>',
  // estandarte
  faccion: '<path d="M6 21V3"/><path d="M6 4h12l-3 4 3 4H6"/>',
  // tablilla de escritura
  tecnologia: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  // diana
  misiones: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8"/>',
  // campana
  avisos: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
  // mapa plegado
  mapa: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  // muralla con su torre y su puerta (la ventana de la plaza)
  asentamiento: '<path d="M3 21V11h3V8h3v3h2V5h2V3h2v2h2v6h2V8h3v13z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
};
export const icono = (id: PanelJugador | 'mapa' | 'asentamiento'): string =>
  `<svg class="jugador-icono" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONO[id]}</svg>`;

/** Dónde está el héroe, en una frase corta para la barra. */
function dondeEstas(p: ProyeccionJugador): string {
  const u = p.heroe.ubicacion;
  if (u.tipo === 'mercenarios') return `Campamento ${u.campamentoId}`;
  if (u.tipo === 'asentamiento') return `Dentro de ${p.asentamientos[0]?.nombre ?? u.asentamientoId}`;
  if (u.tipo === 'columna') return 'En el mapa, con tu columna';
  if (u.tipo === 'pueblo') { const x = (p.pueblos ?? []).find((q) => q.id === u.puebloId); return `Dentro de ${x ? nombreDePueblo(x) : 'un pueblo'}`; }
  if (u.tipo === 'avanzada') return 'Dentro de una avanzada';
  return 'Desconectado';
}

/**
 * La barra, con el botón «Mapa» (el modo mapa: zoom libre, solo para mirar) en todas las pantallas, también en el mundo. El avatar y su
 * menú de sesión los pone `main.ts` (`menuEsquinaHtml`) fuera de la barra, anclados a su esquina. `extra`: botones propios de la pantalla, al
 * principio (en la plaza, «Asentamiento», que abre su ventana).
 */
export function htmlBarraJugador(p: ProyeccionJugador, e: (valor: string) => string, extra = ''): string {
  return `<header class="jugador-barra">
    <span class="jugador-quien"><strong>${e(p.heroe.displayName)}</strong><small>${e(dondeEstas(p))}</small></span>
    <div class="jugador-estados" aria-label="Estados activos"></div>
    <div class="jugador-alerta" role="status" hidden></div>
    <nav class="jugador-botones" aria-label="Menús del jugador">${extra}
      ${BOTONES.map(([id, nombre]) => `<button type="button" data-panel-jugador="${id}" title="${nombre}" aria-label="${nombre}">${icono(id)}<span class="jugador-nombre">${nombre}</span>${id === 'avisos' ? '<b class="jugador-badge" hidden></b>' : id === 'misiones' ? '<b class="jugador-badge misiones-badge" hidden title="Misiones cumplidas por reclamar"></b>' : ''}</button>`).join('')}
      <button type="button" data-ver-mapa title="Mapa: la visión que tienes, con zoom libre (solo para mirar)" aria-label="Mapa">${icono('mapa')}<span class="jugador-nombre">Mapa</span></button>
    </nav>
  </header>`;
}
