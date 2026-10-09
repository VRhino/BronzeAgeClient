// Cargos de Facción y abandono (backend Doc 2.2 y 2.5): el Rey traspasa el trono (`asignarRey`) y designa al Embajador (`asignarEmbajador`); cualquiera
// puede dejar la Facción (`dejarFaccion`). Vive en la pestaña Facción. Quien valida es el backend: su rechazo sale tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion } from '../tiposDominio';
import { nombreDeHeroe } from './nombres';
import { crearEnvio, type Ejecutar } from './panelAnexion';

const DIAS_COOLDOWN_CREACION = 7; // CIUDADANIA.cooldownCreacionFaccionDias del servidor

/** Los selectores del Rey (traspasar el trono, designar Embajador). Vacío si no eres el Rey. */
export function htmlCargos(proyeccion: ProyeccionJugador, faccion: Faccion, escaparHtml: (valor: string) => string): string {
  if (faccion.reyId !== proyeccion.heroeId) return '';
  const opciones = (ids: string[]) => ids.map((id) => `<option value="${escaparHtml(id)}">${escaparHtml(nombreDeHeroe(proyeccion, id))}</option>`).join('');
  const ciudadanos = faccion.ciudadanosIds ?? [];
  const otros = ciudadanos.filter((id) => id !== proyeccion.heroeId);
  const embajadores = ciudadanos.filter((id) => id !== faccion.embajadorId);
  return `<div class="faction-list"><span class="faction-kicker">Cargos</span>
    ${embajadores.length > 0
      ? `<div class="faction-list-item"><select id="sel-embajador" class="form-input">${opciones(embajadores)}</select><button id="btn-embajador" class="btn-secondary" type="button">Designar Embajador</button></div><p class="legend-note">El Embajador propone, con el Rey, alianzas y vasallajes, declara guerra y ofrece la paz.</p>`
      : ''}
    ${otros.length > 0
      ? `<div class="faction-list-item"><select id="sel-rey" class="form-input">${opciones(otros)}</select><button id="btn-traspasar-trono" class="btn-secondary" type="button">Traspasar el trono</button></div><p class="legend-note">Dejas de ser Rey en el acto; solo el nuevo Rey podría devolvértelo.</p>`
      : '<p class="legend-note">Eres el único ciudadano: nadie más puede recibir el trono ni la embajada.</p>'}
    <p id="error-cargos" class="faction-error" role="alert"></p></div>`;
}

/** El botón de abandonar, con lo que implica según tu cargo. */
export function htmlDejarFaccion(proyeccion: ProyeccionJugador, faccion: Faccion): string {
  const alguienMas = (faccion.ciudadanosIds ?? []).some((id) => id !== proyeccion.heroeId);
  const cargo = faccion.reyId === proyeccion.heroeId
    ? alguienMas ? ' Eres el Rey: el trono pasa al siguiente ciudadano por orden de ingreso.' : ' Eres el último ciudadano: la Facción se queda sin Rey.'
    : faccion.embajadorId === proyeccion.heroeId ? ' Eres el Embajador: la embajada queda libre.' : '';
  return `<div class="faction-list"><span class="faction-kicker">Abandonar</span>
    <div class="faction-list-item"><button id="btn-dejar-faccion" class="btn-secondary" type="button">Dejar la Facción</button></div>
    <p class="legend-note">Pierdes la ciudadanía, tu casa y tus cargos locales; pasas al campamento de mercenarios más cercano y conservas lo que llevas.${cargo} No podrás crear otra Facción hasta pasados ${DIAS_COOLDOWN_CREACION} días.</p>
    <p id="error-dejar-faccion" class="faction-error" role="alert"></p></div>`;
}

/** Cablea `htmlCargos` y `htmlDejarFaccion` tras cada render. */
export function cablearCargos(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'error-cargos', ejecutar, avisar);
  const faccionId = proyeccion.faccionId;
  const elegido = (id: string) => raiz.querySelector<HTMLSelectElement>(id);
  raiz.querySelector<HTMLButtonElement>('#btn-embajador')?.addEventListener('click', (ev) => {
    const heroeId = elegido('#sel-embajador')?.value;
    if (heroeId && faccionId) void enviar(ev.currentTarget as HTMLButtonElement, 'asignarEmbajador', { faccionId, heroeId });
  });
  raiz.querySelector<HTMLButtonElement>('#btn-traspasar-trono')?.addEventListener('click', (ev) => {
    const sel = elegido('#sel-rey');
    if (!sel?.value || !faccionId) return;
    if (!confirm(`¿Traspasar el trono a ${sel.selectedOptions[0]?.textContent}? Dejarás de ser Rey en el acto.`)) return;
    void enviar(ev.currentTarget as HTMLButtonElement, 'asignarRey', { faccionId, heroeId: sel.value });
  });
  raiz.querySelector<HTMLButtonElement>('#btn-dejar-faccion')?.addEventListener('click', (ev) => {
    if (!confirm('¿Dejar la Facción? Pierdes ciudadanía, casa y cargos, y tendrás que esperar para crear otra. Si eres Rey, el trono pasa al siguiente ciudadano.')) return;
    void crearEnvio(raiz, 'error-dejar-faccion', ejecutar, avisar)(ev.currentTarget as HTMLButtonElement, 'dejarFaccion', {});
  });
}
