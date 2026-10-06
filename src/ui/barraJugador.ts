// Barra superior del JUGADOR: los menús que son suyos —héroe, escuadras, Facción— y no de un sitio concreto, accesibles desde cualquier
// vista (mapa, campamento, asentamiento). Lo propio de cada sitio (mercado, edificios, salir…) vive en la pantalla de ese sitio.
// Aquí solo está el HTML y la lista de paneles; quien pinta cada panel y cablea los botones es `main.ts`.
import type { ProyeccionJugador } from '../apiCliente';

export type PanelJugador = 'heroe' | 'escuadras' | 'faccion';

const BOTONES: [PanelJugador, string][] = [
  ['heroe', 'Héroe'],
  ['escuadras', 'Escuadras'],
  ['faccion', 'Facción'],
];

/** Dónde está el héroe, en una frase corta para la barra. */
function dondeEstas(p: ProyeccionJugador): string {
  const u = p.heroe.ubicacion;
  if (u.tipo === 'mercenarios') return `Campamento ${u.campamentoId}`;
  if (u.tipo === 'asentamiento') return `Dentro de ${p.asentamientos[0]?.nombre ?? u.asentamientoId}`;
  if (u.tipo === 'columna') return 'En el mapa, con tu columna';
  return 'Desconectado';
}

/**
 * La barra. `conMapa` añade el botón «Mapa (M)» (dentro de un asentamiento o un campamento: en el propio mapa no hace falta). El avatar y su
 * menú de sesión los pone `main.ts` (`menuEsquinaHtml`) fuera de la barra, anclados a su esquina.
 */
export function htmlBarraJugador(p: ProyeccionJugador, conMapa: boolean, e: (valor: string) => string): string {
  return `<header class="jugador-barra">
    <span class="jugador-quien"><strong>${e(p.heroe.displayName)}</strong><small>${e(dondeEstas(p))}</small></span>
    <nav class="jugador-botones" aria-label="Menús del jugador">
      ${BOTONES.map(([id, nombre]) => `<button type="button" data-panel-jugador="${id}">${nombre}</button>`).join('')}
      ${conMapa ? '<button type="button" data-ver-mapa title="Ver el mapa con la visión que tienes (M)">Mapa <kbd>M</kbd></button>' : ''}
    </nav>
  </header>`;
}
