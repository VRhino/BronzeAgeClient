// Relaciones diplomáticas de la Facción (backend Doc 2.4 y 2.7): alianza y vasallaje (se pactan al instante, sin respuesta de la otra parte), guerra
// (la paz exige que la ofrezcan las dos), romper una relación y rebelión del vasallo. Las propone el Rey o el Embajador. Vive en la pestaña Facción.
// Quien valida es el backend (ya hay relación, reputación demasiado baja…): su rechazo sale tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion, RelacionPolitica } from '../tiposDominio';
import { RECURSO_NOMBRE } from '../paletas';
import { crearEnvio, type Ejecutar } from './panelAnexion';

const TRIBUTOS = ['trigo', 'madera', 'piedra', 'cobre', 'estano', 'oro'];

/** Las relaciones activas de tu Facción con lo que puedes hacer en cada una, y el formulario para proponer una nueva. Vacío si no hay nada que mostrar. */
export function htmlDiplomacia(proyeccion: ProyeccionJugador, faccion: Faccion, escaparHtml: (valor: string) => string): string {
  const conAutoridad = faccion.reyId === proyeccion.heroeId || faccion.embajadorId === proyeccion.heroeId;
  const nombreDe = (id: string) => escaparHtml(proyeccion.facciones.find((f) => f.id === id)?.nombre ?? id);
  const mias = (proyeccion.relaciones ?? []).filter((r) => r.estado === 'activa' && r.id && (r.faccionAId === faccion.id || r.faccionBId === faccion.id));
  const conRelacion = new Set(mias.flatMap((r) => [r.faccionAId, r.faccionBId]));
  const candidatas = proyeccion.facciones.filter((f) => f.id !== faccion.id && !conRelacion.has(f.id));
  const boton = (atributo: string, id: string, texto: string) => `<button class="btn-secondary" type="button" ${atributo}="${escaparHtml(id)}">${texto}</button>`;
  const tributo = (r: RelacionPolitica) => r.tributo ? `${r.tributo.cantidadPorMinuto} ${escaparHtml(RECURSO_NOMBRE[r.tributo.recurso] ?? r.tributo.recurso)}/min` : 'sin tributo';

  const fila = (r: RelacionPolitica): string => {
    const id = r.id ?? '';
    const yoSoyA = r.faccionAId === faccion.id;
    const otra = nombreDe(yoSoyA ? r.faccionBId : r.faccionAId);
    if (r.tipo === 'alianza') {
      return `<div class="faction-list-item"><div><strong>Alianza con ${otra}</strong><span>Romperla sin más cuesta 12 puntos de reputación</span></div>${conAutoridad ? boton('data-dipl-romper', id, 'Romper alianza') : ''}</div>`;
    }
    if (r.tipo === 'vasallaje') {
      return yoSoyA
        ? `<div class="faction-list-item"><div><strong>${otra} es tu vasalla</strong><span>Tributo: ${tributo(r)} · liberarla da 6 puntos de reputación</span></div>${conAutoridad ? boton('data-dipl-romper', id, 'Liberar vasallo') : ''}</div>`
        : `<div class="faction-list-item"><div><strong>Eres vasalla de ${otra}</strong><span>Tributo: ${tributo(r)}</span></div>${conAutoridad ? boton('data-dipl-rebelion', id, 'Rebelarse') : ''}</div>`;
    }
    const estado = r.pazPropuestaPor === faccion.id ? 'Has ofrecido la paz: falta que la ofrezca la otra' : r.pazPropuestaPor ? `${otra} ofrece la paz` : 'La paz exige que la ofrezcan las dos';
    const accion = r.pazPropuestaPor === faccion.id ? '' : boton('data-dipl-paz', id, r.pazPropuestaPor ? 'Aceptar la paz' : 'Ofrecer la paz');
    return `<div class="faction-list-item"><div><strong>En guerra con ${otra}</strong><span>${estado}</span></div>${conAutoridad ? accion : ''}</div>`;
  };

  const formulario = conAutoridad && candidatas.length > 0
    ? `<div class="faction-list-item"><select id="sel-diplomacia" class="form-input">${candidatas.map((f) => `<option value="${escaparHtml(f.id)}">${escaparHtml(f.nombre)}</option>`).join('')}</select>` +
      `<select id="tipo-diplomacia" class="form-input"><option value="alianza">Alianza</option><option value="vasallaje">Vasallaje (tú, señora)</option><option value="guerra">Declarar guerra</option></select></div>` +
      `<div class="faction-list-item"><select id="tributo-recurso" class="form-input">${TRIBUTOS.map((t) => `<option value="${t}">${escaparHtml(RECURSO_NOMBRE[t] ?? t)}</option>`).join('')}</select>` +
      `<input id="tributo-cantidad" class="form-input" type="number" min="0" step="1" value="10" aria-label="Tributo por minuto" /><button id="btn-proponer-diplomacia" class="btn-secondary" type="button">Proponer</button></div>` +
      `<p class="legend-note">Tributo por minuto, solo en vasallaje. Alianza y vasallaje se pactan al instante, sin respuesta de la otra Facción; una Facción con reputación por debajo de −40 no puede proponer alianzas. La guerra es libre y arrastra a señor y vasallos del rival; solo se acaba con la paz de las dos.</p>`
    : '';

  if (mias.length === 0 && !formulario) return '';
  return `<div class="faction-list"><span class="faction-kicker">Diplomacia</span>${mias.map(fila).join('')}${formulario}<p id="error-diplomacia" class="faction-error" role="alert"></p></div>`;
}

/** Cablea los botones de `htmlDiplomacia` tras cada render. */
export function cablearDiplomacia(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'error-diplomacia', ejecutar, avisar);
  const yo = proyeccion.faccionId;
  raiz.querySelector<HTMLButtonElement>('#btn-proponer-diplomacia')?.addEventListener('click', (ev) => {
    const destino = raiz.querySelector<HTMLSelectElement>('#sel-diplomacia')?.value;
    const tipo = raiz.querySelector<HTMLSelectElement>('#tipo-diplomacia')?.value;
    if (!destino || !yo) return;
    const boton = ev.currentTarget as HTMLButtonElement;
    if (tipo === 'guerra') {
      if (confirm('¿Declarar la guerra? También la declaras al señor y a los vasallos del rival, y solo termina con la paz de las dos Facciones.')) void enviar(boton, 'declararGuerra', { faccionAId: yo, faccionBId: destino });
    } else if (tipo === 'vasallaje') {
      const tributoCantidad = Number(raiz.querySelector<HTMLInputElement>('#tributo-cantidad')?.value);
      const tributoRecurso = raiz.querySelector<HTMLSelectElement>('#tributo-recurso')?.value;
      if (Number.isFinite(tributoCantidad) && tributoCantidad >= 0 && confirm('¿Imponer el vasallaje? Se pacta al instante: ellos pagarán el tributo y tú los defenderás (una guerra contra ellos es una guerra contra ti).')) {
        void enviar(boton, 'proponerRelacion', { tipo, faccionAId: yo, faccionBId: destino, tributoRecurso, tributoCantidad });
      }
    } else if (tipo) {
      void enviar(boton, 'proponerRelacion', { tipo, faccionAId: yo, faccionBId: destino });
    }
  });
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-paz]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'proponerPaz', { relacionId: b.dataset.diplPaz, faccionId: yo })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-romper]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('¿Terminar esta relación? Es inmediato.')) void enviar(b, 'romperRelacion', { relacionId: b.dataset.diplRomper, iniciadorFaccionId: yo });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-rebelion]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('¿Rebelarse? Rompes el vasallaje, declaras la guerra a tu señor y al resto de sus vasallos, y se cancelan al instante los acuerdos de trueque entre vuestras plazas. Tu señor pierde 10 puntos de reputación. No hay vuelta atrás.')) {
      void enviar(b, 'rebelionVasallo', { relacionId: b.dataset.diplRebelion });
    }
  }));
}
