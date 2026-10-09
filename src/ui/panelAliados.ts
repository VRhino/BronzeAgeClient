// Subpestaña «Aliados» de Centro urbano: abrir o cerrar el almacén de la plaza a los ejércitos ALIADOS que pasan (`alternarReabastecerAliados`, Doc 5.13 «Reabastecimiento en ruta»).
// Repostar cuesta stock real a la plaza; por eso lo decide ella. Lo cambia el Gobernador o el Tesorero residentes y presentes; el servidor valida y su rechazo se enseña tal cual.
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';

function html(c: ContextoPlaza): string {
  const abierto = c.asentamiento.permiteReabastecerAliados === true;
  const cargos = c.asentamiento.cargos;
  const tieneCargo = c.resideAqui && (cargos?.gobernadorId === c.proyeccion.heroeId || cargos?.tesoreroId === c.proyeccion.heroeId);
  return `<span class="faction-kicker">Reabastecer a los aliados</span>
    <p class="asent-lado-nota">Los ejércitos de tu Facción reponen víveres en esta plaza siempre. Los de un <strong>aliado</strong> solo si abres el almacén, y eso le cuesta stock real a la plaza. Cerrar no es retroactivo: lo ya repuesto está repuesto. Neutrales y hostiles nunca reponen.</p>
    <p class="asent-lado-nota">Estado actual: <strong>${abierto ? 'abierto a los aliados' : 'cerrado'}</strong>.</p>
    <button class="${abierto ? 'btn-secondary' : 'btn-primary'}" type="button" data-alternar-aliados="${abierto ? 'cerrar' : 'abrir'}">${abierto ? 'Cerrar el almacén a los aliados' : 'Abrir el almacén a los aliados'}</button>
    ${tieneCargo ? '' : '<small class="asent-lado-nota">Solo el Gobernador o el Tesorero de la plaza, estando dentro, pueden cambiarlo.</small>'}
    <p class="faction-error" data-campo="error-aliados" role="alert"></p>`;
}

function cablear(c: ContextoPlaza): void {
  const error = c.cuerpo.querySelector<HTMLElement>('[data-campo="error-aliados"]');
  c.cuerpo.querySelector<HTMLButtonElement>('[data-alternar-aliados]')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const mensaje = await c.ejecutar('alternarReabastecerAliados', { asentamientoId: c.asentamiento.id, permitido: boton.dataset.alternarAliados === 'abrir' });
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  });
}

export const SUBPESTANA_ALIADOS: SubpestanaPlaza = { id: 'aliados', etiqueta: 'Aliados', html, cablear };
