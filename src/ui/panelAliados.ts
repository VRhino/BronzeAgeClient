// Bloque «Aliados» del final de la subpestaña «Puerta»: abrir o cerrar el almacén de la plaza a los ejércitos ALIADOS que pasan (`alternarReabastecerAliados`, Doc 5.13 «Reabastecimiento en ruta»).
// Repostar cuesta stock real a la plaza; por eso lo decide ella. Lo cambia el Gobernador o el Tesorero residentes y presentes; el servidor valida y su rechazo sale flotando.
import { ayuda } from './ayuda';
import type { ContextoPlaza } from './ganchos';
import { mostrar as mostrarAviso } from './avisos';
import { olvidarEdicion } from './repintado';

/** El bloque «Reabastecer a los aliados», que va al final de la subpestaña «Puerta»: una tarjeta con un interruptor (2026-11-02). */
export function htmlAliados(c: ContextoPlaza): string {
  const abierto = c.asentamiento.permiteReabastecerAliados === true;
  const cargos = c.asentamiento.cargos;
  const tieneCargo = c.resideAqui && (cargos?.gobernadorId === c.proyeccion.heroeId || cargos?.tesoreroId === c.proyeccion.heroeId);
  return `<div class="obra-titulo"><span class="faction-kicker">Reabastecer a los aliados</span>${ayuda('plaza:aliados', 'Los ejércitos de tu Facción reponen víveres en esta plaza siempre. Los de un <strong>aliado</strong> solo si abres el almacén, y eso le cuesta stock real a la plaza. Cerrar no es retroactivo: lo ya repuesto está repuesto. Neutrales y hostiles nunca reponen.')}</div>
    <div class="aliados-tarjeta${abierto ? ' abierto' : ''}">
      <span class="aliados-icono" aria-hidden="true">🌾</span>
      <span class="aliados-cuerpo"><strong>${abierto ? 'Almacén abierto a los aliados' : 'Almacén cerrado a los aliados'}</strong><small>${tieneCargo ? 'Sus ejércitos reponen víveres aquí a costa de la plaza.' : 'Lo cambian el Gobernador o el Tesorero, estando dentro.'}</small></span>
      <label class="interruptor aliados-interruptor" title="${abierto ? 'Cerrar el almacén a los aliados' : 'Abrir el almacén a los aliados'}"><input type="checkbox" data-alternar-aliados${abierto ? ' checked' : ''}${tieneCargo ? '' : ' disabled'} /><span class="interruptor-pista" aria-hidden="true"><i></i></span></label>
    </div>`;
}

export function cablearAliados(c: ContextoPlaza): void {
  c.cuerpo.querySelector<HTMLInputElement>('[data-alternar-aliados]')?.addEventListener('change', async (ev) => {
    const caja = ev.currentTarget as HTMLInputElement;
    caja.disabled = true;
    const mensaje = await c.ejecutar('alternarReabastecerAliados', { asentamientoId: c.asentamiento.id, permitido: caja.checked });
    caja.disabled = false;
    // Si no sale, el interruptor vuelve a como estaba y se olvida lo tocado (si no, el repintado lo dejaría en la posición rechazada).
    if (mensaje) { caja.checked = !caja.checked; olvidarEdicion(c.cuerpo); mostrarAviso(mensaje, true); }
  });
}
