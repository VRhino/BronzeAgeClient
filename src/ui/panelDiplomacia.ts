// Relaciones diplomáticas de la Facción (backend Doc 2.4 y 2.7): alianza y vasallaje (son propuestas que solo el Rey de la otra Facción acepta), guerra
// (la paz exige que la ofrezcan las dos), romper una relación y rebelión del vasallo. Las propone el Rey o el Embajador. Vive en la pestaña Facción.
// Quien valida es el backend (ya hay relación, reputación demasiado baja…): su rechazo sale tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion, PropuestaRelacion, RelacionPolitica } from '../tiposDominio';
import { RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';
import { caduca, crearEnvio, type Ejecutar } from './panelAnexion';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { confirmar } from './dialogo';
import { nombreDeHeroe } from './nombres';

const TRIBUTOS = ['trigo', 'madera', 'piedra', 'cobre', 'estano', 'oro'];
type Escapar = (valor: string) => string;

/** Lo que le queda a una propuesta: en tiempo real si el mundo va acelerado (pocos minutos); si no, en horas o días de mundo. */
export function plazo(expiraEn: number, ahora: number): string {
  const real = textoEnTiempoReal(expiraEn - ahora);
  return parseInt(real, 10) <= 180 ? `caduca en ${real}` : caduca(expiraEn, ahora);
}

/** Las relaciones activas de tu Facción con lo que puedes hacer en cada una, y el formulario para proponer una nueva. Vacío si no hay nada que mostrar.
 * Con `con`, solo lo que hay con esa Facción, y el formulario va dirigido a ella (la ficha de la ventana de Diplomacia). */
export function htmlDiplomacia(proyeccion: ProyeccionJugador, faccion: Faccion, escaparHtml: (valor: string) => string, con?: { id: string; nombre: string }): string {
  const conAutoridad = faccion.reyId === proyeccion.heroeId || faccion.embajadorId === proyeccion.heroeId;
  const nombreDe = (id: string) => escaparHtml(proyeccion.facciones.find((f) => f.id === id)?.nombre ?? proyeccion.directorioFacciones?.find((f) => f.id === id)?.nombre ?? id);
  const toca = (a: string, b: string) => !con || a === con.id || b === con.id;
  const mias = (proyeccion.relaciones ?? []).filter((r) => r.estado === 'activa' && r.id && (r.faccionAId === faccion.id || r.faccionBId === faccion.id) && toca(r.faccionAId, r.faccionBId));
  const boton = (atributo: string, id: string, texto: string) => `<button class="btn-secondary" type="button" ${atributo}="${escaparHtml(id)}">${texto}</button>`;
  const tributo = (r: Pick<RelacionPolitica, 'tributo'>) => r.tributo ? `${r.tributo.cantidadPorMinuto} ${escaparHtml(RECURSO_NOMBRE[r.tributo.recurso] ?? r.tributo.recurso)}/min` : 'sin tributo';

  const fila = (r: RelacionPolitica): string => {
    const id = r.id ?? '';
    const yoSoyA = r.faccionAId === faccion.id;
    const otra = nombreDe(yoSoyA ? r.faccionBId : r.faccionAId);
    if (r.tipo === 'alianza') {
      return `<div class="faction-list-item"><div><strong>Alianza con ${otra}</strong></div>${conAutoridad ? boton('data-dipl-romper', id, 'Romper alianza').replace('<button ', '<button title="Romperla sin más cuesta 12 puntos de reputación" ') : ''}</div>`;
    }
    if (r.tipo === 'vasallaje') {
      return yoSoyA
        ? `<div class="faction-list-item"><div><strong>${otra} es tu vasalla</strong><span>Tributo: ${tributo(r)}</span></div>${conAutoridad ? boton('data-dipl-romper', id, 'Liberar vasallo').replace('<button ', '<button title="Liberarla da 6 puntos de reputación" ') : ''}</div>`
        : `<div class="faction-list-item"><div><strong>Eres vasalla de ${otra}</strong><span>Tributo: ${tributo(r)}</span></div>${conAutoridad ? boton('data-dipl-rebelion', id, 'Rebelarse') : ''}</div>`;
    }
    const estado = r.pazPropuestaPor === faccion.id ? 'Has ofrecido la paz: falta que la ofrezca la otra' : r.pazPropuestaPor ? `${otra} ofrece la paz` : 'La paz exige que la ofrezcan las dos';
    const accion = r.pazPropuestaPor === faccion.id ? '' : boton('data-dipl-paz', id, r.pazPropuestaPor ? 'Aceptar la paz' : 'Ofrecer la paz');
    return `<div class="faction-list-item"><div><strong>En guerra con ${otra}</strong><span>${estado}</span></div>${conAutoridad ? accion : ''}</div>`;
  };

  // Alianza y vasallaje piden aceptación: las recibe el Rey de la Facción destino (los demás solo las leen) y las retira quien tiene autoridad en la que propone.
  const propuestas = (proyeccion.propuestasRelacion ?? []).filter((p) => toca(p.faccionAId, p.faccionBId));
  const recibidas = propuestas.filter((p) => p.faccionBId === faccion.id);
  const enviadas = propuestas.filter((p) => p.faccionAId === faccion.id);
  const esRey = faccion.reyId === proyeccion.heroeId;
  const botonResponder = (p: PropuestaRelacion, aceptar: boolean) => `<button class="btn-secondary" type="button" data-dipl-responder="${escaparHtml(p.id)}" data-tipo="${p.tipo}" data-aceptar="${aceptar ? 'si' : 'no'}">${aceptar ? 'Aceptar' : 'Rechazar'}</button>`;
  const filaRecibida = (p: PropuestaRelacion) => `<div class="faction-list-item faction-list-item-texto"><div><strong>${nombreDe(p.faccionAId)} te propone ${p.tipo === 'alianza' ? 'una alianza' : `un vasallaje: serías su vasalla y pagarías ${tributo(p)}`}</strong><span>${plazo(p.expiraEn, proyeccion.instante)}${esRey ? '' : ' · solo tu Rey responde'}</span></div>${esRey ? botonResponder(p, true) + botonResponder(p, false) : ''}</div>`;
  const filaEnviada = (p: PropuestaRelacion) => `<div class="faction-list-item faction-list-item-texto"><div><strong>Propones ${p.tipo === 'alianza' ? 'una alianza' : `un vasallaje (${tributo(p)})`} a ${nombreDe(p.faccionBId)}</strong><span>${plazo(p.expiraEn, proyeccion.instante)}</span></div>${conAutoridad ? boton('data-dipl-retirar', p.id, 'Retirar') : ''}</div>`;
  const bloquePropuestas = (titulo: string, lista: PropuestaRelacion[], pintarFila: (p: PropuestaRelacion) => string) => lista.length > 0 ? `<span class="faction-kicker">${titulo}</span>${lista.map(pintarFila).join('')}` : '';

  const info = ayuda('faccion:diplomacia', 'Tributo por minuto, solo en vasallaje. Alianza y vasallaje son propuestas: solo nacen si el Rey de la otra Facción las acepta antes de que caduquen (3 días de mundo); mientras tanto las puedes retirar. Una Facción con reputación por debajo de −40 no puede proponer alianzas. La guerra es libre y arrastra a señor y vasallos del rival; solo se acaba con la paz de las dos. Romper una alianza sin más cuesta 12 puntos de reputación; liberar a un vasallo da 6.');

  if (con) {
    // La ficha de otra Facción (0.144.0, Víctor 2026-11-04): las relaciones con ella, todas las propuestas en curso entre las dos (relación, anexión,
    // fusión) y el constructor de la propuesta.
    const enCurso = propuestasEntre(proyeccion, faccion, con.id, escaparHtml, { filaRecibida, filaEnviada });
    return `<div class="faction-list faction-list-libre"><span class="faction-kicker">Diplomacia${info}</span>${mias.map(fila).join('')}
      <span class="faction-kicker">Propuestas activas (${enCurso.length})</span>
      ${enCurso.length ? enCurso.join('') : '<p class="legend-note">Ninguna propuesta en curso con ella.</p>'}
      ${htmlPropuesta(proyeccion, faccion, con.id, escaparHtml)}
      ${conAutoridad ? '' : '<p class="legend-note">Proponer alianzas, vasallajes, anexiones o la guerra es cosa del Rey o del Embajador; la fusión, del Rey.</p>'}
      <p id="error-diplomacia" class="faction-error" role="alert"></p></div>`;
  }
  const aviso = conAutoridad ? '<p class="legend-note">Para proponer algo a otra Facción, elígela en la lista de la derecha.</p>' : '';
  if (mias.length === 0 && propuestas.length === 0 && !aviso) return '';
  return `<div class="faction-list faction-list-libre"><span class="faction-kicker">Diplomacia${info}</span>${mias.map(fila).join('')}${bloquePropuestas('Propuestas recibidas', recibidas, filaRecibida)}${bloquePropuestas('Propuestas enviadas', enviadas, filaEnviada)}${aviso}<p id="error-diplomacia" class="faction-error" role="alert"></p></div>`;
}

/** Cablea los botones de `htmlDiplomacia` tras cada render. */
export function cablearDiplomacia(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  cablearPropuesta(raiz, proyeccion, ejecutar, avisar);
  const enviar = crearEnvio(raiz, 'error-diplomacia', ejecutar, avisar);
  const yo = proyeccion.faccionId;
  // Tras proponer, el comando ya refrescó la proyección: la propuesta nueva trae su plazo para decir «caduca en X».
  const proponer = async (boton: HTMLButtonElement, params: { tipo: string; faccionAId: string; faccionBId: string; [extra: string]: unknown }): Promise<void> => {
    await enviar(boton, 'proponerRelacion', params);
    const p = estadoCliente.proyeccionUltima;
    const nueva = p?.propuestasRelacion?.find((x) => x.tipo === params.tipo && x.faccionAId === params.faccionAId && x.faccionBId === params.faccionBId);
    if (p && nueva && boton.disabled) avisar(`Propuesta enviada: ${plazo(nueva.expiraEn, p.instante)} si su Rey no responde.`);
  };
  raiz.querySelector<HTMLButtonElement>('#btn-proponer-diplomacia')?.addEventListener('click', (ev) => {
    const destino = raiz.querySelector<HTMLSelectElement | HTMLInputElement>('#sel-diplomacia')?.value;
    const tipo = raiz.querySelector<HTMLSelectElement>('#tipo-diplomacia')?.value;
    if (!destino || !yo) return;
    const boton = ev.currentTarget as HTMLButtonElement;
    if (tipo === 'guerra') {
      void confirmar('También la declaras al señor y a los vasallos del rival, y solo termina con la paz de las dos Facciones.', { titulo: '¿Declarar la guerra?', aceptar: 'Declarar la guerra', peligro: true }).then((ok) => { if (ok) void enviar(boton, 'declararGuerra', { faccionAId: yo, faccionBId: destino }); });
    } else if (tipo === 'vasallaje') {
      const tributoCantidad = Number(raiz.querySelector<HTMLInputElement>('#tributo-cantidad')?.value);
      const tributoRecurso = raiz.querySelector<HTMLSelectElement>('#tributo-recurso')?.value;
      if (Number.isFinite(tributoCantidad) && tributoCantidad >= 0) {
        void confirmar('Solo nace si su Rey acepta. Entonces ellos te pagarán el tributo y tú los defenderás (una guerra contra ellos es una guerra contra ti).', { titulo: '¿Proponer el vasallaje?', aceptar: 'Proponer' })
          .then((ok) => { if (ok) void proponer(boton, { tipo, faccionAId: yo, faccionBId: destino, tributoRecurso, tributoCantidad }); });
      }
    } else if (tipo) {
      void proponer(boton, { tipo, faccionAId: yo, faccionBId: destino });
    }
  });
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-responder]').forEach((b) => b.addEventListener('click', () => {
    const aceptar = b.dataset.aceptar === 'si';
    const responder = (): void => void enviar(b, 'responderRelacion', { propuestaId: b.dataset.diplResponder, aceptar });
    if (!(aceptar && b.dataset.tipo === 'vasallaje')) return responder();
    void confirmar('Pasas a ser su vasalla: les pagarás el tributo cada minuto y no podrás dejarlo salvo rebelándote (guerra contra tu señora y sus vasallos). Una guerra contra ti será también contra ella.', { titulo: '¿Aceptar el vasallaje?', aceptar: 'Aceptar el vasallaje', peligro: true })
      .then((ok) => { if (ok) responder(); });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-retirar]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'retirarRelacion', { propuestaId: b.dataset.diplRetirar })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-paz]').forEach((b) => b.addEventListener('click', () =>
    void enviar(b, 'proponerPaz', { relacionId: b.dataset.diplPaz, faccionId: yo })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-romper]').forEach((b) => b.addEventListener('click', () => {
    void confirmar('Es inmediato.', { titulo: '¿Terminar esta relación?', aceptar: 'Terminarla', peligro: true }).then((ok) => { if (ok) void enviar(b, 'romperRelacion', { relacionId: b.dataset.diplRomper, iniciadorFaccionId: yo }); });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-dipl-rebelion]').forEach((b) => b.addEventListener('click', () => {
    void confirmar('Rompes el vasallaje, declaras la guerra a tu señor y al resto de sus vasallos, y se cancelan al instante los acuerdos de trueque entre vuestras plazas. Tu señor pierde 10 puntos de reputación. No hay vuelta atrás.', { titulo: '¿Rebelarse?', aceptar: 'Rebelarse', peligro: true })
      .then((ok) => { if (ok) void enviar(b, 'rebelionVasallo', { relacionId: b.dataset.diplRebelion }); });
  }));
}

// ---------------------------------------------------------------- las propuestas en curso con una Facción

/** Todas las propuestas en curso entre tu Facción y otra: de relación (alianza o vasallaje), de anexión y de fusión, cada una con lo que puedes hacer. */
function propuestasEntre(p: ProyeccionJugador, faccion: Faccion, otraId: string, e: Escapar,
  filas: { filaRecibida: (x: PropuestaRelacion) => string; filaEnviada: (x: PropuestaRelacion) => string }): string[] {
  const yo = faccion.id;
  const esRey = faccion.reyId === p.heroeId;
  const conAutoridad = esRey || faccion.embajadorId === p.heroeId;
  const entre = (a: string, b: string): boolean => (a === yo && b === otraId) || (a === otraId && b === yo);
  const btn = (attr: string, id: string, texto: string, extra = ''): string => `<button class="btn-secondary" type="button" ${attr}="${e(id)}"${extra}>${texto}</button>`;
  const relacion = (p.propuestasRelacion ?? []).filter((x) => entre(x.faccionAId, x.faccionBId)).map((x) => (x.faccionBId === yo ? filas.filaRecibida(x) : filas.filaEnviada(x)));
  const anexion = (p.propuestasAnexion ?? []).filter((x) => entre(x.absorbenteId, x.absorbidaId)).map((x) => x.absorbidaId === yo
    ? `<div class="faction-list-item faction-list-item-texto"><div><strong>Te propone anexionarte</strong><span>Tu Facción desaparecería y todo lo suyo pasaría a la de ella · ${plazo(x.expiraEn, p.instante)}${esRey ? '' : ' · solo tu Rey responde'}</span></div>${esRey ? btn('data-anexion-responder', x.id, 'Aceptar', ' data-aceptar="si"') + btn('data-anexion-responder', x.id, 'Rechazar', ' data-aceptar="no"') : ''}</div>`
    : `<div class="faction-list-item faction-list-item-texto"><div><strong>Propones anexionarla</strong><span>${plazo(x.expiraEn, p.instante)}</span></div>${conAutoridad ? btn('data-anexion-retirar', x.id, 'Retirar') : ''}</div>`);
  const fusion = (p.propuestasFusion ?? []).filter((x) => entre(x.faccionAId, x.faccionBId)).map((x) => {
    const rey = x.nuevoReyId === p.heroeId ? 'tú' : nombreDeHeroe(p, x.nuevoReyId);
    return x.faccionBId === yo
      ? `<div class="faction-list-item faction-list-item-texto"><div><strong>Te propone fusionaros en «${e(x.nuevoNombre)}»</strong><span>Rey de la nueva: ${e(rey)} · ${plazo(x.expiraEn, p.instante)}${esRey ? '' : ' · solo tu Rey responde'}</span></div>${esRey ? btn('data-fusion-responder', x.id, 'Aceptar', ' data-aceptar="si"') + btn('data-fusion-responder', x.id, 'Rechazar', ' data-aceptar="no"') : ''}</div>`
      : `<div class="faction-list-item faction-list-item-texto"><div><strong>Propones fusionaros en «${e(x.nuevoNombre)}»</strong><span>Rey de la nueva: ${e(rey)} · ${plazo(x.expiraEn, p.instante)}</span></div>${esRey ? btn('data-fusion-retirar', x.id, 'Retirar') : ''}</div>`;
  });
  return [...relacion, ...anexion, ...fusion];
}

// ---------------------------------------------------------------- el constructor de la propuesta (0.144.0, Víctor 2026-11-04)

/** Una cláusula de la propuesta. El motor admite una sola por propuesta (un tipo de relación, una anexión o una fusión) con un tributo en el
 * vasallaje: elegir otra la sustituye. */
type Clausula =
  | { tipo: 'alianza' }
  | { tipo: 'vasallaje'; recurso: string; cantidad: number }
  | { tipo: 'guerra' }
  | { tipo: 'anexion' }
  | { tipo: 'fusion'; nombre: string; rey: 'yo' | 'otro' };

/** La propuesta a medio hacer con cada Facción: sobrevive a los repintados y a cambiar de Facción en la lista. */
const borradores = new Map<string, Clausula[]>();

const OPCIONES: { tipo: Clausula['tipo']; icono: string; nombre: string; ayuda: string }[] = [
  { tipo: 'alianza', icono: '🤝', nombre: 'Alianza', ayuda: 'Os defendéis y comerciáis como aliadas. Nace si su Rey acepta.' },
  { tipo: 'vasallaje', icono: '👑', nombre: 'Vasallaje', ayuda: 'Tú serías la señora: te pagan un tributo por minuto y tú las defiendes. Nace si su Rey acepta.' },
  { tipo: 'anexion', icono: '🏛', nombre: 'Anexión', ayuda: 'Su Facción desaparece y todo lo suyo pasa a la tuya. Nace si su Rey acepta.' },
  { tipo: 'fusion', icono: '🔗', nombre: 'Fusión', ayuda: 'Las dos desaparecen y nace una nueva con el nombre y el Rey que elijas. Nace si su Rey acepta.' },
  { tipo: 'guerra', icono: '⚔', nombre: 'Guerra', ayuda: 'No se propone: se declara al momento y arrastra a señor y vasallos del rival.' },
];

const nueva = (tipo: Clausula['tipo']): Clausula => (tipo === 'vasallaje' ? { tipo, recurso: 'trigo', cantidad: 10 } : tipo === 'fusion' ? { tipo, nombre: '', rey: 'yo' } : { tipo });

/** Qué puede proponer tu héroe a esa Facción ahora (regla de interfaz: lo que no se puede hacer no se enseña). */
function opcionesPosibles(p: ProyeccionJugador, faccion: Faccion, otraId: string): Set<Clausula['tipo']> {
  const esRey = faccion.reyId === p.heroeId;
  const conAutoridad = esRey || faccion.embajadorId === p.heroeId;
  const posibles = new Set<Clausula['tipo']>();
  if (!conAutoridad || otraId === faccion.id) return posibles;
  const entre = (a: string, b: string): boolean => (a === faccion.id && b === otraId) || (a === otraId && b === faccion.id);
  const relacion = (p.relaciones ?? []).some((r) => r.estado === 'activa' && entre(r.faccionAId, r.faccionBId));
  const pendiente = (p.propuestasRelacion ?? []).some((x) => entre(x.faccionAId, x.faccionBId));
  if (!relacion && !pendiente) { posibles.add('alianza'); posibles.add('vasallaje'); }
  if (!relacion) posibles.add('guerra');
  const otra = p.facciones.find((f) => f.id === otraId);
  const anexando = new Set((p.propuestasAnexion ?? []).flatMap((x) => [x.absorbenteId, x.absorbidaId]));
  if (otra && !anexando.has(otraId)) posibles.add('anexion');
  const fusionando = new Set((p.propuestasFusion ?? []).flatMap((x) => [x.faccionAId, x.faccionBId]));
  if (esRey && otra?.reyId && !fusionando.has(otraId)) posibles.add('fusion');
  return posibles;
}

/** La tarjeta de una cláusula en la propuesta, con sus términos. */
function tarjeta(c: Clausula, i: number, e: Escapar): string {
  const op = OPCIONES.find((o) => o.tipo === c.tipo)!;
  const quitar = `<button class="propuesta-quitar" type="button" data-propuesta-quitar="${i}" title="Quitarla de la propuesta" aria-label="Quitar ${op.nombre}">✕</button>`;
  const terminos = c.tipo === 'vasallaje'
    ? `<div class="propuesta-terminos"><label class="diplo-campo"><span>Tributo</span><select class="form-input" data-propuesta-campo="recurso" data-i="${i}">${TRIBUTOS.map((t) => `<option value="${t}"${t === c.recurso ? ' selected' : ''}>${e(RECURSO_NOMBRE[t] ?? t)}</option>`).join('')}</select></label>
        <label class="diplo-campo diplo-campo-corto"><span>Por minuto</span><input class="form-input" type="number" min="0" step="1" value="${c.cantidad}" data-propuesta-campo="cantidad" data-i="${i}" /></label></div>`
    : c.tipo === 'fusion'
      ? `<div class="propuesta-terminos"><label class="diplo-campo"><span>Nombre de la nueva</span><input class="form-input" type="text" maxlength="32" placeholder="Nombre de la Facción nueva" value="${e(c.nombre)}" data-propuesta-campo="nombre" data-i="${i}" /></label>
        <label class="diplo-campo"><span>Rey de la nueva</span><select class="form-input" data-propuesta-campo="rey" data-i="${i}"><option value="yo"${c.rey === 'yo' ? ' selected' : ''}>Tú</option><option value="otro"${c.rey === 'otro' ? ' selected' : ''}>El de la otra Facción</option></select></label></div>`
      : '';
  return `<div class="propuesta-clausula${c.tipo === 'guerra' ? ' guerra' : ''}"><div class="propuesta-clausula-cab"><span class="propuesta-icono" aria-hidden="true">${op.icono}</span><strong>${op.nombre}</strong><small>${e(op.ayuda)}</small>${quitar}</div>${terminos}</div>`;
}

function interiorPropuesta(p: ProyeccionJugador, faccion: Faccion, otraId: string, e: Escapar): string {
  const posibles = opcionesPosibles(p, faccion, otraId);
  const clausulas = (borradores.get(otraId) ?? []).filter((c) => posibles.has(c.tipo));
  const puestas = new Set(clausulas.map((c) => c.tipo));
  const barra = OPCIONES.filter((o) => posibles.has(o.tipo)).map((o) => `<button type="button" class="propuesta-opcion${puestas.has(o.tipo) ? ' puesta' : ''}${o.tipo === 'guerra' ? ' guerra' : ''}" data-propuesta-poner="${o.tipo}" aria-pressed="${puestas.has(o.tipo)}" title="${e(`${o.ayuda}${clausulas.length && !puestas.has(o.tipo) ? ' Sustituye a lo que lleva la propuesta: el motor admite una cosa por propuesta.' : ''}`)}"><span aria-hidden="true">${o.icono}</span>${o.nombre}</button>`).join('');
  const guerra = clausulas.some((c) => c.tipo === 'guerra');
  const falta = clausulas.some((c) => c.tipo === 'fusion' && !c.nombre.trim()) ? 'Ponle nombre a la Facción nueva' : '';
  return `<div class="propuesta-barra" role="toolbar" aria-label="Qué proponer">${barra}</div>
    <div class="propuesta-cuerpo">${clausulas.length ? clausulas.map((c, i) => tarjeta(c, i, e)).join('') : '<p class="legend-note">Pulsa arriba lo que quieres proponer: se añade aquí, ajustas sus términos y la mandas entera con «Proponer».</p>'}</div>
    <div class="propuesta-pie">${falta ? `<small class="falta">${falta}</small>` : ''}<button class="btn-primary btn-chico${guerra ? ' dialogo-peligro' : ''}" type="button" data-propuesta-enviar${clausulas.length && !falta ? '' : ' disabled'}>${guerra ? '⚔ Declarar la guerra' : 'Proponer'}</button></div>`;
}

/** El constructor de la propuesta a otra Facción: una barra con lo que se puede proponer, la propuesta con sus términos y «Proponer». Vacío si no
 * puedes proponerle nada. */
export function htmlPropuesta(p: ProyeccionJugador, faccion: Faccion, otraId: string, e: Escapar): string {
  if (opcionesPosibles(p, faccion, otraId).size === 0) return '';
  return `<div class="propuesta" data-propuesta="${e(otraId)}"><span class="faction-kicker">Nueva propuesta</span><div class="propuesta-interior">${interiorPropuesta(p, faccion, otraId, e)}</div></div>`;
}

function cablearPropuesta(raiz: ParentNode, proyeccion: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const caja = raiz.querySelector<HTMLElement>('[data-propuesta]');
  const faccion = proyeccion.facciones.find((f) => f.id === proyeccion.faccionId);
  if (!caja || !faccion) return;
  const otraId = caja.dataset.propuesta!;
  const interior = caja.querySelector<HTMLElement>('.propuesta-interior')!;
  const e = (v: string): string => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const enviar = crearEnvio(raiz, 'error-diplomacia', ejecutar, avisar);
  const lista = (): Clausula[] => borradores.get(otraId) ?? [];
  const repintar = (): void => { interior.innerHTML = interiorPropuesta(proyeccion, faccion, otraId, e); cablear(); };
  const cablear = (): void => {
    interior.querySelectorAll<HTMLButtonElement>('[data-propuesta-poner]').forEach((b) => b.addEventListener('click', () => {
      const tipo = b.dataset.propuestaPoner as Clausula['tipo'];
      // Una sola cosa por propuesta: pulsar la que ya está la quita; otra, la sustituye.
      borradores.set(otraId, lista().some((c) => c.tipo === tipo) ? [] : [nueva(tipo)]);
      repintar();
    }));
    interior.querySelectorAll<HTMLButtonElement>('[data-propuesta-quitar]').forEach((b) => b.addEventListener('click', () => {
      borradores.set(otraId, lista().filter((_, i) => i !== Number(b.dataset.propuestaQuitar)));
      repintar();
    }));
    interior.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-propuesta-campo]').forEach((x) => {
      const guardar = (): void => {
        const c = lista()[Number(x.dataset.i)] as Record<string, unknown> | undefined;
        if (!c) return;
        const campo = x.dataset.propuestaCampo!;
        c[campo] = campo === 'cantidad' ? Math.max(0, Math.floor(Number(x.value) || 0)) : x.value;
        if (campo === 'nombre') {
          const boton = interior.querySelector<HTMLButtonElement>('[data-propuesta-enviar]');
          if (boton) boton.disabled = !x.value.trim();
          interior.querySelector('.propuesta-pie .falta')?.remove();
        }
      };
      x.addEventListener('input', guardar);
      x.addEventListener('change', guardar);
    });
    interior.querySelector<HTMLButtonElement>('[data-propuesta-enviar]')?.addEventListener('click', (ev) => void mandar(ev.currentTarget as HTMLButtonElement));
  };
  const mandar = async (boton: HTMLButtonElement): Promise<void> => {
    const yo = faccion.id;
    const c = lista()[0];
    if (!c) return;
    const otra = proyeccion.facciones.find((f) => f.id === otraId);
    const pedir = (texto: string, titulo: string, aceptar: string, peligro = false): Promise<boolean> => confirmar(texto, { titulo, aceptar, peligro });
    if (c.tipo === 'guerra') {
      if (!(await pedir('También la declaras al señor y a los vasallos del rival, y solo termina con la paz de las dos Facciones.', '¿Declarar la guerra?', 'Declarar la guerra', true))) return;
      await enviar(boton, 'declararGuerra', { faccionAId: yo, faccionBId: otraId });
    } else if (c.tipo === 'vasallaje') {
      if (!(await pedir(`Solo nace si su Rey acepta. Entonces te pagarán ${c.cantidad} de ${RECURSO_NOMBRE[c.recurso] ?? c.recurso} por minuto y tú los defenderás (una guerra contra ellos es una guerra contra ti).`, '¿Proponer el vasallaje?', 'Proponer'))) return;
      await enviar(boton, 'proponerRelacion', { tipo: 'vasallaje', faccionAId: yo, faccionBId: otraId, tributoRecurso: c.recurso, tributoCantidad: c.cantidad });
    } else if (c.tipo === 'alianza') {
      await enviar(boton, 'proponerRelacion', { tipo: 'alianza', faccionAId: yo, faccionBId: otraId });
    } else if (c.tipo === 'anexion') {
      if (!(await pedir('Si su Rey acepta, su Facción desaparece y todo lo suyo pasa a la tuya.', '¿Proponer la anexión?', 'Proponer'))) return;
      await enviar(boton, 'proponerAnexion', { faccionAId: yo, faccionBId: otraId });
    } else {
      const nuevoReyId = c.rey === 'otro' ? otra?.reyId : proyeccion.heroeId;
      if (!nuevoReyId) return;
      if (!(await pedir(`Si su Rey acepta, las dos Facciones desaparecen y nace «${c.nombre.trim()}».`, '¿Proponer la fusión?', 'Proponer'))) return;
      await enviar(boton, 'proponerFusion', { faccionAId: yo, faccionBId: otraId, nuevoNombre: c.nombre.trim(), nuevoReyId });
    }
    // `crearEnvio` deja el botón apagado si el motor la aceptó: la propuesta ya salió y el borrador se vacía.
    if (boton.disabled) {
      borradores.delete(otraId);
      const nuevaP = estadoCliente.proyeccionUltima?.propuestasRelacion?.find((x) => x.faccionAId === yo && x.faccionBId === otraId);
      avisar(c.tipo === 'guerra' ? 'Guerra declarada.' : nuevaP && estadoCliente.proyeccionUltima ? `Propuesta enviada: ${plazo(nuevaP.expiraEn, estadoCliente.proyeccionUltima.instante)} si su Rey no responde.` : 'Propuesta enviada.');
    }
  };
  cablear();
}
