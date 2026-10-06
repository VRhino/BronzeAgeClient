// Anexión entre Facciones (backend Doc 2.6): la propone el Rey o el Embajador de la absorbente y solo la acepta el Rey de la absorbida. Vive en la
// pestaña Facción. Quien valida es el backend (B vasalla de un tercero, ya hay propuesta…): su rechazo sale tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion } from '../tiposDominio';

const HORA = 3_600_000;

export function caduca(expiraEn: number, ahora: number): string {
  const horas = Math.max(0, Math.ceil((expiraEn - ahora) / HORA));
  return horas >= 48 ? `caduca en ${Math.ceil(horas / 24)} días` : `caduca en ${horas} h`;
}

/** Las propuestas que recibes (Rey: aceptar o rechazar), las que ofreces (Rey o Embajador: retirar) y el formulario para proponer. Vacío si no hay nada que hacer. */
export function htmlAnexion(proyeccion: ProyeccionJugador, faccion: Faccion, escaparHtml: (valor: string) => string): string {
  const yo = proyeccion.heroeId;
  const esRey = faccion.reyId === yo;
  const conAutoridad = esRey || faccion.embajadorId === yo;
  const nombreDe = (id: string) => escaparHtml(proyeccion.facciones.find((f) => f.id === id)?.nombre ?? id);
  const propuestas = proyeccion.propuestasAnexion ?? [];
  const recibidas = propuestas.filter((p) => p.absorbidaId === faccion.id);
  const ofrecidas = propuestas.filter((p) => p.absorbenteId === faccion.id);
  const ocupadas = new Set(propuestas.flatMap((p) => [p.absorbenteId, p.absorbidaId]));
  const candidatas = proyeccion.facciones.filter((f) => f.id !== faccion.id && !ocupadas.has(f.id));

  const filaRecibida = (p: (typeof recibidas)[number]) => `<div class="faction-list-item"><div><strong>${nombreDe(p.absorbenteId)} te ofrece anexionarte</strong><span>${caduca(p.expiraEn, proyeccion.instante)}${esRey ? '' : ' · solo tu Rey responde'}</span></div>${esRey
    ? `<button class="btn-secondary" type="button" data-anexion-responder="${escaparHtml(p.id)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-anexion-responder="${escaparHtml(p.id)}" data-aceptar="no">Rechazar</button>`
    : ''}</div>`;
  const filaOfrecida = (p: (typeof ofrecidas)[number]) => `<div class="faction-list-item"><div><strong>Propones anexionar a ${nombreDe(p.absorbidaId)}</strong><span>${caduca(p.expiraEn, proyeccion.instante)}</span></div>${conAutoridad
    ? `<button class="btn-secondary" type="button" data-anexion-retirar="${escaparHtml(p.id)}">Retirar</button>`
    : ''}</div>`;
  const formulario = conAutoridad && candidatas.length > 0
    ? `<div class="faction-list-item"><select id="sel-anexion" class="form-input">${candidatas.map((f) => `<option value="${escaparHtml(f.id)}">${escaparHtml(f.nombre)}</option>`).join('')}</select><button id="btn-proponer-anexion" class="btn-secondary" type="button">Proponer anexión</button></div><p class="legend-note">Si su Rey acepta, su facción desaparece y todo lo suyo pasa a la tuya.</p>`
    : '';

  if (recibidas.length + ofrecidas.length === 0 && !formulario) return '';
  return `<div class="faction-list"><span class="faction-kicker">Anexión</span>${recibidas.map(filaRecibida).join('')}${ofrecidas.map(filaOfrecida).join('')}${formulario}<p id="error-anexion" class="faction-error" role="alert"></p></div>`;
}

export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** Envía un comando desde un botón: lo deshabilita mientras espera y deja el rechazo del backend en `#idError` (o en el aviso global si no está). Lo comparten la anexión y la fusión. */
export function crearEnvio(raiz: ParentNode, idError: string, ejecutar: Ejecutar, avisar: (mensaje: string) => void) {
  return async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    if (mensaje) {
      boton.disabled = false;
      const error = raiz.querySelector<HTMLElement>(`#${idError}`);
      if (error) error.textContent = mensaje; else avisar(mensaje);
    }
  };
}

/** Cablea los botones de `htmlAnexion` tras cada render. `ejecutar` devuelve el mensaje de rechazo o `null`. */
export function cablearAnexion(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'error-anexion', ejecutar, avisar);
  raiz.querySelector<HTMLButtonElement>('#btn-proponer-anexion')?.addEventListener('click', (ev) => {
    const destino = raiz.querySelector<HTMLSelectElement>('#sel-anexion')?.value;
    if (destino && proyeccion.faccionId) void enviar(ev.currentTarget as HTMLButtonElement, 'proponerAnexion', { faccionAId: proyeccion.faccionId, faccionBId: destino });
  });
  raiz.querySelectorAll<HTMLButtonElement>('[data-anexion-responder]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'responderAnexion', { propuestaId: b.dataset.anexionResponder, aceptar: b.dataset.aceptar === 'si' })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-anexion-retirar]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'retirarAnexion', { propuestaId: b.dataset.anexionRetirar })));
}
