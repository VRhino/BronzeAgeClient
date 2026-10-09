// Barra superior del JUGADOR: los menús que son suyos —héroe, escuadras, Facción— y no de un sitio concreto, accesibles desde cualquier
// vista (mapa, campamento, asentamiento). Lo propio de cada sitio (mercado, edificios, salir…) vive en la pantalla de ese sitio.
// Aquí solo está el HTML y la lista de paneles; quien pinta cada panel y cablea los botones es `main.ts`.
import type { ProyeccionJugador } from '../apiCliente';

export type PanelJugador = 'heroe' | 'escuadras' | 'carro' | 'faccion' | 'tecnologia' | 'avisos';

const BOTONES: [PanelJugador, string][] = [
  ['heroe', 'Héroe'],
  ['escuadras', 'Escuadras'],
  ['carro', 'Carro'],
  ['faccion', 'Facción'],
  ['tecnologia', 'Tecnología'],
  ['avisos', 'Avisos'],
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
 * La barra. `conMapa` añade el botón «Mapa» (dentro de un asentamiento o un campamento: en el propio mapa no hace falta). El avatar y su
 * menú de sesión los pone `main.ts` (`menuEsquinaHtml`) fuera de la barra, anclados a su esquina.
 */
export function htmlBarraJugador(p: ProyeccionJugador, conMapa: boolean, e: (valor: string) => string): string {
  return `<header class="jugador-barra">
    <span class="jugador-quien"><strong>${e(p.heroe.displayName)}</strong><small>${e(dondeEstas(p))}</small></span>
    <div class="jugador-estados" aria-label="Estados activos"></div>
    <div class="jugador-alerta" role="status" hidden></div>
    <nav class="jugador-botones" aria-label="Menús del jugador">
      ${BOTONES.map(([id, nombre]) => `<button type="button" data-panel-jugador="${id}">${nombre}${id === 'avisos' ? '<b class="jugador-badge" hidden></b>' : ''}</button>`).join('')}
      ${conMapa ? '<button type="button" data-ver-mapa title="Ver el mapa con la visión que tienes, sin salir">Mapa</button>' : ''}
    </nav>
  </header>`;
}
