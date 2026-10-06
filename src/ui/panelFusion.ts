// Fusión entre Facciones (backend Doc 2.6, opción 2): la propone el Rey de A fijando el nombre y el Rey de la Facción nueva (el de A o el de B) y solo
// la acepta el Rey de B; su «sí» es su voto. Vive en la pestaña Facción. Quien valida es el backend (vasalla de un tercero, ya hay propuesta…): su rechazo sale tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion } from '../tiposDominio';
import { caduca, crearEnvio, type Ejecutar } from './panelAnexion';

/** Las propuestas que recibes (Rey: aceptar o rechazar), las que haces (Rey: retirar) y el formulario para proponer. Vacío si no hay nada que hacer. */
export function htmlFusion(proyeccion: ProyeccionJugador, faccion: Faccion, escaparHtml: (valor: string) => string): string {
  const esRey = faccion.reyId === proyeccion.heroeId;
  const nombreDe = (id: string) => escaparHtml(proyeccion.facciones.find((f) => f.id === id)?.nombre ?? id);
  const propuestas = proyeccion.propuestasFusion ?? [];
  const recibidas = propuestas.filter((p) => p.faccionBId === faccion.id);
  const hechas = propuestas.filter((p) => p.faccionAId === faccion.id);
  const ocupadas = new Set(propuestas.flatMap((p) => [p.faccionAId, p.faccionBId]));
  // Las dos necesitan Rey: sin él nadie puede consentir.
  const candidatas = proyeccion.facciones.filter((f) => f.id !== faccion.id && !ocupadas.has(f.id) && f.reyId);

  const filaRecibida = (p: (typeof recibidas)[number]) => `<div class="faction-list-item"><div><strong>${nombreDe(p.faccionAId)} propone fusionaros en «${escaparHtml(p.nuevoNombre)}»</strong><span>Rey de la nueva: ${p.nuevoReyId === proyeccion.heroeId ? 'tú' : 'el Rey de ' + nombreDe(p.faccionAId)} · ${caduca(p.expiraEn, proyeccion.instante)}${esRey ? '' : ' · solo tu Rey responde'}</span></div>${esRey
    ? `<button class="btn-secondary" type="button" data-fusion-responder="${escaparHtml(p.id)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-fusion-responder="${escaparHtml(p.id)}" data-aceptar="no">Rechazar</button>`
    : ''}</div>`;
  const filaHecha = (p: (typeof hechas)[number]) => `<div class="faction-list-item"><div><strong>Propones fusionarte con ${nombreDe(p.faccionBId)} en «${escaparHtml(p.nuevoNombre)}»</strong><span>Rey de la nueva: ${p.nuevoReyId === proyeccion.heroeId ? 'tú' : 'el Rey de ' + nombreDe(p.faccionBId)} · ${caduca(p.expiraEn, proyeccion.instante)}</span></div>${esRey
    ? `<button class="btn-secondary" type="button" data-fusion-retirar="${escaparHtml(p.id)}">Retirar</button>`
    : ''}</div>`;
  const formulario = esRey && candidatas.length > 0
    ? `<div class="faction-list-item"><select id="sel-fusion" class="form-input">${candidatas.map((f) => `<option value="${escaparHtml(f.id)}" data-rey="${escaparHtml(f.reyId ?? '')}">${escaparHtml(f.nombre)}</option>`).join('')}</select>` +
      `<input id="nombre-fusion" class="form-input" type="text" maxlength="40" placeholder="Nombre de la Facción nueva" />` +
      `<select id="rey-fusion" class="form-input"><option value="yo">Rey: tú</option><option value="otro">Rey: el de la otra Facción</option></select>` +
      `<button id="btn-proponer-fusion" class="btn-secondary" type="button">Proponer fusión</button></div><p class="legend-note">Si su Rey acepta, las dos Facciones desaparecen y nace una nueva con ese nombre y ese Rey (el otro Rey pasa a ser ciudadano). Hereda tu sigilo, el nivel más alto de las dos y la tecnología de ambas.</p>`
    : '';

  if (recibidas.length + hechas.length === 0 && !formulario) return '';
  return `<div class="faction-list"><span class="faction-kicker">Fusión</span>${recibidas.map(filaRecibida).join('')}${hechas.map(filaHecha).join('')}${formulario}<p id="error-fusion" class="faction-error" role="alert"></p></div>`;
}

/** Cablea los botones de `htmlFusion` tras cada render. `ejecutar` devuelve el mensaje de rechazo o `null`. */
export function cablearFusion(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'error-fusion', ejecutar, avisar);
  raiz.querySelector<HTMLButtonElement>('#btn-proponer-fusion')?.addEventListener('click', (ev) => {
    const seleccion = raiz.querySelector<HTMLSelectElement>('#sel-fusion');
    const reyDeLaOtra = seleccion?.selectedOptions[0]?.dataset.rey;
    const nuevoReyId = raiz.querySelector<HTMLSelectElement>('#rey-fusion')?.value === 'otro' ? reyDeLaOtra : proyeccion.heroeId;
    const nuevoNombre = raiz.querySelector<HTMLInputElement>('#nombre-fusion')?.value.trim() ?? '';
    if (seleccion?.value && nuevoReyId && proyeccion.faccionId) {
      void enviar(ev.currentTarget as HTMLButtonElement, 'proponerFusion', { faccionAId: proyeccion.faccionId, faccionBId: seleccion.value, nuevoNombre, nuevoReyId });
    }
  });
  raiz.querySelectorAll<HTMLButtonElement>('[data-fusion-responder]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'responderFusion', { propuestaId: b.dataset.fusionResponder, aceptar: b.dataset.aceptar === 'si' })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-fusion-retirar]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'retirarFusion', { propuestaId: b.dataset.fusionRetirar })));
}
