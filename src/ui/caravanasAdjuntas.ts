// CARAVANAS ADJUNTAS a tu columna (backend Doc 5.13.2-5.13.3), dentro del panel «Lo que llevas»:
//   adjuntarCaravana    { ejercitoId, caravanaId, heroeId }   engancha una caravana propia, suelta (`disponible`) o `aparcada`, al alcance
//   soltarCaravana      { ejercitoId, caravanaId, heroeId }   se queda donde esté la columna; no vuelve sola a casa
//   cargarCaravana      { ejercitoId, caravanaId, asentamientoId, recurso, cantidad }   del almacén de una plaza que abra su puerta
//   entregarDeCaravana  { ejercitoId, caravanaId, acuerdoId }   cumple tu parte de un trueque activo, estando junto al que recibe
// Los manda cualquiera que vaya en la columna (no solo el Líder). Aquí no se decide ninguna regla: el backend valida y el rechazo se enseña con su motivo;
// los avisos (por qué no se puede) son orientativos y salen de los mismos datos que el motor mira (Facción, estado, distancia, lado pendiente del trueque).
// La capacidad de una caravana no viaja en la proyección ni en el balance público (necesita Backend): se enseña lo cargado y el servidor topa al cargar.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeReabastecimiento } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { AcuerdoTrueque, Caravana, Ejercito, LineaTrueque } from '../tiposDominio';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;
type Punto = { x: number; y: number };

const ESTADO: Record<NonNullable<Caravana['estado']>, string> = {
  disponible: 'suelta', preparando: 'preparándose', adjunta: 'enganchada', aparcada: 'aparcada', en_transito: 'en camino', retornando: 'de vuelta',
};
const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const icono = (r: string): string => RECURSO_ICONO[r] ?? '📦';
const distancia = (a: Punto, b: Punto): number => Math.hypot(a.x - b.x, a.y - b.y);
const cargaTotal = (c: Caravana): number => Object.values(c.contenido ?? {}).reduce((a, b) => a + b, 0);

/** Tuya si lo dice su `faccionId` o, sin él, si sale de una plaza tuya (la flota comercial). */
function esDeMiFaccion(p: ProyeccionJugador, c: Caravana): boolean {
  return c.faccionId ? c.faccionId === p.faccionId : conocidos(p).some((a) => a.id === c.origenAsentamientoId && a.faccionId === p.faccionId);
}

/** Todo asentamiento que conoces: el que pisas, los que ves y los recordados. En el mundo `asentamientos` va vacío: tus plazas llegan como avistadas o recordadas, sin almacén. */
function conocidos(p: ProyeccionJugador): { id: string; nombre?: string; faccionId?: string; posicion: Punto }[] {
  return [...p.asentamientos, ...p.asentamientosAvistados, ...p.asentamientosConocidos.map((a) => ({ ...a, id: a.asentamientoId }))];
}

function nombreDe(p: ProyeccionJugador, id: string): string {
  return conocidos(p).find((a) => a.id === id)?.nombre ?? id;
}

/** Qué impide enganchar esa caravana a tu columna ahora, o `''`. Orientativo: decide `adjuntarCaravana` (engine/ejercitos.ts). */
export function motivoParaEnganchar(p: ProyeccionJugador, col: Ejercito, c: Caravana): string {
  if (!esDeMiFaccion(p, c)) return 'No es de tu Facción.';
  if (p.ejercitos.some((x) => x.id !== col.id && x.caravanasAdjuntasIds?.includes(c.id))) return 'Va enganchada a otro ejército.';
  const deFundacion = c.titularId !== undefined;
  if (deFundacion && c.titularId !== p.heroeId && c.estado !== 'retornando') return 'La Caravana de Fundación la lleva su titular.';
  const libre = c.estado === 'disponible' || c.estado === 'aparcada' || (deFundacion && c.estado === 'retornando');
  if (!libre) return `Está ${ESTADO[c.estado ?? 'disponible']}: solo se engancha una caravana suelta o aparcada, no una ya despachada.`;
  const lejos = distancia(c.posicionActual, col.posicionActual);
  if (lejos > radioDeReabastecimiento()) return `Está a ${Math.ceil(lejos)} de tu columna: hay que estar a ${radioDeReabastecimiento()} o menos.`;
  return '';
}

/** Los trueques activos en que tu Facción debe algo, con lo que falta y a quién se entrega (espeja `ladoPendienteParaEjercito`). */
function truequesPendientes(p: ProyeccionJugador): { acuerdo: AcuerdoTrueque; faltan: { recurso: string; faltante: number }[]; destinoId: string }[] {
  const todos = conocidos(p);
  const faccionDe = (id: string) => todos.find((a) => a.id === id)?.faccionId;
  // El servidor solo manda trueques que tocan una plaza tuya: si una de las dos no la conoces, es la tuya cuando la otra es ajena.
  const esMia = (id: string, otra: string) => faccionDe(id) === p.faccionId || (faccionDe(id) === undefined && faccionDe(otra) !== undefined && faccionDe(otra) !== p.faccionId);
  const faltan = (ls: LineaTrueque[]) => ls.map((l) => ({ recurso: l.recurso, faltante: l.cantidadTotal - l.cantidadEntregada })).filter((l) => l.faltante > 0);
  return p.acuerdos.filter((a) => a.estado === 'activo').flatMap((a) => {
    const lado = [
      { deudor: a.asentamientoAId, destinoId: a.asentamientoBId, faltan: faltan(a.lineasA) },
      { deudor: a.asentamientoBId, destinoId: a.asentamientoAId, faltan: faltan(a.lineasB) },
    ].find((x) => esMia(x.deudor, x.destinoId) && x.faltan.length > 0);
    return lado ? [{ acuerdo: a, faltan: lado.faltan, destinoId: lado.destinoId }] : [];
  });
}

function contenido(c: Caravana, e: Escapar): string {
  const lista = Object.entries(c.contenido ?? {}).filter(([, n]) => n >= 1);
  return lista.length === 0 ? 'vacía' : lista.map(([r, n]) => `${icono(r)} ${e(nombre(r))} ${Math.floor(n)}`).join(' · ');
}

function htmlEnganchada(p: ProyeccionJugador, col: Ejercito, c: Caravana, e: Escapar): string {
  const radio = radioDeReabastecimiento();
  // Se carga de una plaza de tu Facción a tu alcance (la propia siempre abre su puerta). En el mundo no ves su almacén: el recurso lo eliges tú y el servidor topa.
  const plazas = conocidos(p).filter((a) => a.faccionId === p.faccionId && distancia(a.posicion, col.posicionActual) <= radio);
  const cargar = plazas.length === 0
    ? `<small>Para cargar tienes que estar a ${radio} o menos de una plaza de tu Facción.</small>`
    : `<select class="form-input" data-cc-plaza="${e(c.id)}">${plazas.map((a) => `<option value="${e(a.id)}">${e(a.nombre ?? a.id)}</option>`).join('')}</select>
       <select class="form-input" data-cc-recurso="${e(c.id)}">${Object.keys(RECURSO_NOMBRE).map((r) => `<option value="${e(r)}">${icono(r)} ${e(nombre(r))}</option>`).join('')}</select>
       <input class="form-input" type="number" min="1" value="100" data-cc-cantidad="${e(c.id)}" /><button class="btn-secondary" type="button" data-cc="cargar" data-caravana="${e(c.id)}">Cargar</button>`;
  const entregas = truequesPendientes(p).map(({ acuerdo, faltan, destinoId }) => {
    const pos = conocidos(p).find((x) => x.id === destinoId)?.posicion;
    const motivo = cargaTotal(c) < 1 ? 'La caravana va vacía.'
      : !pos ? 'No ves dónde está el que recibe.'
      : distancia(pos, col.posicionActual) > radio ? `Estás a ${Math.ceil(distancia(pos, col.posicionActual))} de ${nombreDe(p, destinoId)}: hay que estar a ${radio} o menos.` : '';
    return `<div class="carro-fila"><span>Trueque con ${e(nombreDe(p, destinoId))}: faltan ${faltan.map((f) => `${icono(f.recurso)} ${Math.ceil(f.faltante)}`).join(' · ')}</span>
      <button class="btn-secondary" type="button" data-cc="entregar" data-caravana="${e(c.id)}" data-acuerdo="${e(acuerdo.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Entregar</button>${motivo ? `<small>${e(motivo)}</small>` : ''}</div>`;
  }).join('');
  const fundacion = c.titularId !== undefined;
  return `<div class="ejercito-fila">
    <div><strong>${fundacion ? 'Caravana de Fundación' : 'Caravana'} ${e(c.id)}</strong><span>${ESTADO[c.estado ?? 'adjunta']} · lleva ${Math.floor(cargaTotal(c))}: ${contenido(c, e)}</span></div>
    <button class="btn-secondary" type="button" data-cc="soltar" data-caravana="${e(c.id)}"${fundacion ? ' title="Suelta, vuelve a contar su caducidad."' : ''}>Soltar</button>
    <div class="cc-cargar">${cargar}</div>
    ${entregas ? `<div class="cc-entregas">${entregas}</div>` : ''}</div>`;
}

function htmlSuelta(p: ProyeccionJugador, col: Ejercito, c: Caravana, e: Escapar): string {
  const motivo = motivoParaEnganchar(p, col, c);
  const donde = c.estado === 'aparcada' ? ' · aparcada en una plaza' : '';
  return `<div class="ejercito-fila">
    <div><strong>${c.titularId !== undefined ? 'Caravana de Fundación' : 'Caravana'} ${e(c.id)}</strong><span>${ESTADO[c.estado ?? 'disponible']}${donde} · lleva ${Math.floor(cargaTotal(c))} · a ${Math.round(distancia(c.posicionActual, col.posicionActual))} de ti</span></div>
    <button class="btn-primary" type="button" data-cc="enganchar" data-caravana="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Enganchar</button>
    ${motivo ? `<small>${e(motivo)}</small>` : ''}</div>`;
}

/** El bloque «Caravanas» del panel «Lo que llevas»; vacío si no estás en una columna. */
export function htmlCaravanasAdjuntas(p: ProyeccionJugador, e: Escapar): string {
  const col = p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
  if (!col) return '';
  const idsEnganchadas = col.caravanasAdjuntasIds ?? [];
  const enganchadas = idsEnganchadas.flatMap((id) => p.caravanas.find((c) => c.id === id) ?? []);
  const sueltas = p.caravanas
    .filter((c) => !idsEnganchadas.includes(c.id) && esDeMiFaccion(p, c))
    .sort((a, b) => distancia(a.posicionActual, col.posicionActual) - distancia(b.posicionActual, col.posicionActual) || (a.id < b.id ? -1 : 1));
  return `
    <strong class="heroe-sub">Caravanas de tu columna</strong>
    <p class="asent-lado-nota">Una caravana enganchada viaja con la columna (a su velocidad y a su suerte: si el ejército cae, se pierde) y ya no la reparte el comercio automático: tú eliges qué carga y a quién entregas. Sale de tu flota de comercio mientras dure. Cualquiera que vaya en la columna puede gestionarlas.</p>
    ${enganchadas.length > 0 ? enganchadas.map((c) => htmlEnganchada(p, col, c, e)).join('') : '<p class="mapa-lista-vacia">Ninguna enganchada.</p>'}
    ${idsEnganchadas.length > enganchadas.length ? '<p class="asent-lado-nota">Alguna caravana enganchada no llega en tu proyección.</p>' : ''}
    <strong class="heroe-sub">Para enganchar</strong>
    ${sueltas.length > 0 ? sueltas.map((c) => htmlSuelta(p, col, c, e)).join('') : '<p class="mapa-lista-vacia">No tienes más caravanas de tu Facción.</p>'}
    ${enganchadas.length > 0 ? `<p class="asent-lado-nota">Cargar: de una plaza de tu Facción a ${radioDeReabastecimiento()} o menos (no ves su almacén desde fuera: si no hay de eso, el servidor lo dice). Entregar: junto a la plaza que recibe, de lo que lleve la caravana (el menor entre lo cargado y lo que falta; el destino cobra su comisión). Cuánto cabe lo dice el servidor al cargar.</p>` : ''}
    <p class="faction-error" data-campo="error-caravanas" role="alert"></p>`;
}

export function cablearCaravanasAdjuntas(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  const col = p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-caravanas"]');
  if (!col) return;
  raiz.querySelectorAll<HTMLButtonElement>('[data-cc]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      const caravanaId = boton.dataset.caravana!;
      const base = { ejercitoId: col.id, caravanaId };
      let tipo: string;
      let params: object;
      switch (boton.dataset.cc) {
        case 'enganchar': tipo = 'adjuntarCaravana'; params = { ...base, heroeId: p.heroeId }; break;
        case 'soltar': tipo = 'soltarCaravana'; params = { ...base, heroeId: p.heroeId }; break;
        case 'entregar': tipo = 'entregarDeCaravana'; params = { ...base, acuerdoId: boton.dataset.acuerdo }; break;
        default: {
          const asentamientoId = raiz.querySelector<HTMLSelectElement>(`select[data-cc-plaza="${caravanaId}"]`)?.value;
          const recurso = raiz.querySelector<HTMLSelectElement>(`select[data-cc-recurso="${caravanaId}"]`)?.value;
          const cantidad = Math.floor(Number(raiz.querySelector<HTMLInputElement>(`input[data-cc-cantidad="${caravanaId}"]`)?.value ?? 0));
          if (!asentamientoId || !recurso || !(cantidad >= 1)) { if (error) error.textContent = 'Elige de dónde cargar y una cantidad de 1 o más.'; return; }
          tipo = 'cargarCaravana'; params = { ...base, asentamientoId, recurso, cantidad };
        }
      }
      boton.disabled = true;
      const mensaje = await ejecutar(tipo, params);
      boton.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    })
  );
}
