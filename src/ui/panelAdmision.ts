// Ajuste del Rey «admitir a otras Facciones en nuestros ataques» (backend Doc 2.2, 5.15.1b). Vive en la pestaña Facción. Activado, en los
// asedios y asaltos de caravana que abre su Facción pueden unirse al ataque héroes de Facciones neutrales o enemigas del defensor.
import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion } from '../tiposDominio';
import { crearEnvio, type Ejecutar } from './panelAnexion';

/** El ajuste, visible para todos los ciudadanos; solo el Rey lo cambia. */
export function htmlAdmision(proyeccion: ProyeccionJugador, faccion: Faccion): string {
  const admite = faccion.admiteOtrasEnAtaques === true;
  const esRey = faccion.reyId === proyeccion.heroeId;
  return `<div class="faction-list"><span class="faction-kicker">Ataques abiertos a otras Facciones</span>
    <div class="faction-list-item"><div><strong>${admite ? 'Admitidas' : 'Solo la tuya'}</strong><span>${admite
      ? 'En vuestros asedios pueden unirse al ataque héroes de Facciones neutrales o enemigas del defensor.'
      : 'En vuestros asedios solo combaten ciudadanos de tu Facción.'}</span></div>${esRey
      ? `<button id="btn-admision" class="btn-secondary" type="button" data-admitir="${admite ? 'no' : 'si'}">${admite ? 'Dejar de admitirlas' : 'Admitirlas'}</button>`
      : ''}</div><p id="error-admision" class="faction-error" role="alert"></p></div>`;
}

/** Cablea el botón de `htmlAdmision` tras cada render. */
export function cablearAdmision(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'error-admision', ejecutar, avisar);
  const boton = raiz.querySelector<HTMLButtonElement>('#btn-admision');
  boton?.addEventListener('click', () => {
    if (proyeccion.faccionId) void enviar(boton, 'admitirOtrasFacciones', { faccionId: proyeccion.faccionId, admitir: boton.dataset.admitir === 'si' });
  });
}
