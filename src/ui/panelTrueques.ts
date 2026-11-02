// Subpestaña «TRUEQUES» de Mercado (backend Doc 3.2): contratos marco entre DOS plazas, cada lado con una o varias líneas (recurso + cantidad).
// `proponerTrueque { asentamientoAId, lineasA, asentamientoBId, lineasB }` (A = esta plaza; solo sus residentes), y el lado receptor (B) contesta con
// `aceptarTrueque`/`rechazarTrueque { acuerdoId }` (solo sus residentes). Una propuesta no obliga a nadie hasta el sí; el plazo para cumplir se cuenta desde el sí.
// Plazos, reparto en caravanas y penalizaciones los decide el servidor: su rechazo sale flotando, tal cual.
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { AcuerdoTrueque, LineaTrueque } from '../tiposDominio';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { ayuda } from './ayuda';
import { etiquetaCiudad } from './etiquetaCiudad';
import { mostrar as mostrarAviso } from './avisos';
import { barraAvance } from './juegoVisual';

const RECURSOS = Object.keys(RECURSO_NOMBRE);
const FILAS_POR_LADO = 3;
const ESTADO: Record<AcuerdoTrueque['estado'], string> = {
  propuesto: 'sin contestar',
  activo: 'en vigor',
  rechazado: 'rechazado',
  cumplido: 'cumplido',
  expirado: 'expirado',
};

function falta(hasta: number, instante: number): string {
  const ms = hasta - instante;
  if (ms <= 0) return 'ya';
  const min = ms / 60_000;
  return min >= 60 ? `${Math.round(min / 60)} h` : min >= 1 ? `${Math.round(min)} min` : `${Math.round(ms / 1000)} s`;
}

const ESTADO_ICONO: Record<AcuerdoTrueque['estado'], string> = { propuesto: '📜', activo: '🤝', rechazado: '✕', cumplido: '✔', expirado: '⌛' };

/** Las líneas de un lado como fichas con icono y cantidad; en vigor, con lo entregado y su barra. */
function lineas(ls: LineaTrueque[], progreso: boolean, c: ContextoPlaza): string {
  return ls.map((l) => {
    const nombre = RECURSO_NOMBRE[l.recurso] ?? l.recurso;
    const hecho = l.cantidadTotal > 0 ? Math.min(1, l.cantidadEntregada / l.cantidadTotal) : 0;
    return `<span class="pacto-linea${progreso && hecho >= 1 ? ' entregada' : ''}" title="${c.escapar(`${nombre}: ${progreso ? `${Math.floor(l.cantidadEntregada)} de ` : ''}${Math.floor(l.cantidadTotal)}`)}">
      <i aria-hidden="true">${RECURSO_ICONO[l.recurso] ?? '📦'}</i><b>${progreso ? `${Math.floor(l.cantidadEntregada)}<small>/${Math.floor(l.cantidadTotal)}</small>` : Math.floor(l.cantidadTotal)}</b>${progreso ? barraAvance(hecho) : ''}</span>`;
  }).join('');
}

/**
 * Un pacto, con aire de juego (2026-11-02): las dos plazas frente a frente con su escudo, lo que da cada una en fichas (con lo entregado, en vigor),
 * el estado como sello y el plazo; si te toca contestar, «Aceptar» y «Rechazar» grandes.
 */
function tarjeta(a: AcuerdoTrueque, c: ContextoPlaza): string {
  const e = c.escapar;
  const recibido = a.asentamientoBId === c.asentamiento.id;
  const pendiente = a.estado === 'propuesto';
  const progreso = a.estado === 'activo' || a.estado === 'cumplido';
  const plazo = pendiente ? `contestar en ${falta(a.expiraEn, c.proyeccion.instante)}` : a.estado === 'activo' ? `cumplir en ${falta(a.expiraEn, c.proyeccion.instante)}` : '';
  const quien = pendiente ? (recibido ? 'Te toca contestar a ti.' : 'Espera la respuesta de la otra plaza.') : '';
  const apagado = c.resideAqui ? '' : ' disabled title="Solo contestan los residentes de esta plaza"';
  const acciones = pendiente && recibido
    ? `<div class="pacto-acciones">
        <button class="pacto-si" type="button" data-trueque-aceptar="${e(a.id)}"${apagado}>✓ Aceptar</button>
        <button class="pacto-no" type="button" data-trueque-rechazar="${e(a.id)}"${apagado}>✕ Rechazar</button>
      </div>` : '';
  const lado = (plaza: string, ls: LineaTrueque[]): string => `<div class="pacto-lado">${etiquetaCiudad(c.proyeccion, plaza, e)}<div class="pacto-lineas">${lineas(ls, progreso, c)}</div></div>`;
  return `<div class="pacto ${a.estado}${pendiente && recibido ? ' te-toca' : ''}">
      <div class="pacto-cab"><span class="pacto-estado ${a.estado}">${ESTADO_ICONO[a.estado]} ${ESTADO[a.estado]}</span>${plazo ? `<span class="pacto-plazo">⏳ ${plazo}</span>` : ''}</div>
      <div class="pacto-lados">${lado(a.asentamientoAId, a.lineasA)}<span class="pacto-sello" aria-label="a cambio de">⇄</span>${lado(a.asentamientoBId, a.lineasB)}</div>
      ${quien ? `<small class="pacto-quien">${quien}</small>` : ''}${acciones}
    </div>`;
}

function filasLado(lado: 'A' | 'B'): string {
  const opciones = RECURSOS.map((r) => `<option value="${r}">${RECURSO_ICONO[r] ?? '📦'} ${RECURSO_NOMBRE[r]}</option>`).join('');
  return Array.from({ length: FILAS_POR_LADO }, (_, i) => `<div class="trueque-linea">
      <select class="form-input" data-trueque-recurso="${lado}${i}" aria-label="Recurso"><option value="">— nada —</option>${opciones}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="0" aria-label="Cantidad" data-trueque-cantidad="${lado}${i}" />
    </div>`).join('');
}

function html(c: ContextoPlaza): string {
  const p = c.proyeccion;
  const a = c.asentamiento;
  const e = c.escapar;
  const mios = p.acuerdos.filter((x) => x.asentamientoAId === a.id || x.asentamientoBId === a.id);
  const vivos = mios.filter((x) => x.estado === 'propuesto' || x.estado === 'activo');
  const cerrados = mios.filter((x) => x.estado !== 'propuesto' && x.estado !== 'activo');
  const porContestar = vivos.filter((x) => x.estado === 'propuesto' && x.asentamientoBId === a.id).length;
  const destinos = [...p.asentamientos.map((x) => x.id), ...p.asentamientosAvistados.map((x) => x.id), ...p.asentamientosConocidos.map((x) => x.asentamientoId)]
    .filter((id, i, v) => id !== a.id && v.indexOf(id) === i);
  const proponer = !c.resideAqui ? '<p class="asent-lado-nota">Solo quien reside en esta plaza propone trueques en su nombre.</p>'
    : destinos.length === 0 ? '<p class="asent-lado-nota">No conoces otra plaza con la que pactar.</p>'
      : `<div class="trueque-destinos" role="radiogroup" aria-label="Con qué plaza" data-trueque-destino>${destinos.map((id, i) => `<label class="trueque-destino"><input type="radio" name="trueque-destino" value="${e(id)}"${i === 0 ? ' checked' : ''} />${etiquetaCiudad(p, id, e)}</label>`).join('')}</div>
      <div class="trueque-balanza">
        <div class="trueque-platillo da"><strong><i aria-hidden="true">▲</i> Das <small>${e(a.nombre ?? a.id)}</small></strong>${filasLado('A')}</div>
        <span class="trueque-fiel" aria-hidden="true">⚖</span>
        <div class="trueque-platillo recibe"><strong><i aria-hidden="true">▼</i> Recibes <small>la otra plaza</small></strong>${filasLado('B')}</div>
      </div>
      <div class="trueque-pie"><button class="trueque-proponer" type="button" data-trueque-proponer>🤝 Proponer trueque</button></div>`;
  return `<div class="obra-titulo"><span class="faction-kicker">Trueques en curso</span><span class="obra-chip">${vivos.length}</span>${porContestar ? `<span class="obra-chip activa" title="Propuestas que esperan tu respuesta">📜 ${porContestar} por contestar</span>` : ''}${ayuda('mercado:trueques', 'Un trueque es un pacto entre dos plazas: cada una se compromete a entregar sus líneas, que van en caravanas. No obliga a nadie hasta que la otra plaza dice que sí; una propuesta sin contestar caduca sin castigo. Aceptado, el plazo corre desde el sí, y vencer sin cumplir resta reputación a cada lado en proporción a lo que dejó sin entregar (Doc 2.7).')}</div>
    ${vivos.length === 0 ? '<p class="mapa-lista-vacia">No hay trueques propuestos ni en vigor.</p>' : `<div class="pactos">${vivos.map((x) => tarjeta(x, c)).join('')}</div>`}
    ${cerrados.length === 0 ? '' : `<div class="obra-titulo"><span class="faction-kicker">Cerrados</span><span class="obra-chip">${cerrados.length}</span></div><div class="pactos cerrados">${cerrados.map((x) => tarjeta(x, c)).join('')}</div>`}
    <div class="obra-titulo"><span class="faction-kicker">Proponer un trueque</span>${ayuda('mercado:trueques-proponer', `Elige la plaza y hasta ${FILAS_POR_LADO} líneas por lado, sin repetir recurso. Deja en «nada» las que no uses.`)}</div>
    ${proponer}`;
}

function cablear(c: ContextoPlaza): void {
  const raiz = c.cuerpo;
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-trueque-aceptar]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'aceptarTrueque', { acuerdoId: b.dataset.truequeAceptar! })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-trueque-rechazar]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'rechazarTrueque', { acuerdoId: b.dataset.truequeRechazar! })));
  const proponer = raiz.querySelector<HTMLButtonElement>('[data-trueque-proponer]');
  const leer = (lado: 'A' | 'B'): { recurso: string; cantidad: number }[] => Array.from({ length: FILAS_POR_LADO }, (_, i) => ({
    recurso: raiz.querySelector<HTMLSelectElement>(`[data-trueque-recurso="${lado}${i}"]`)?.value ?? '',
    cantidad: Number(raiz.querySelector<HTMLInputElement>(`[data-trueque-cantidad="${lado}${i}"]`)?.value),
  })).filter((l) => l.recurso !== '' || l.cantidad > 0);
  proponer?.addEventListener('click', () => {
    const lineasA = leer('A');
    const lineasB = leer('B');
    if ([...lineasA, ...lineasB].some((l) => !l.recurso || !(l.cantidad >= 1))) { mostrarAviso('Cada línea necesita recurso y una cantidad de 1 o más.', true); return; }
    if (lineasA.length === 0 || lineasB.length === 0) { mostrarAviso('Cada lado tiene que ofrecer al menos una línea.', true); return; }
    void lanzar(proponer, 'proponerTrueque', { asentamientoAId: c.asentamiento.id, lineasA, asentamientoBId: raiz.querySelector<HTMLInputElement>('input[name="trueque-destino"]:checked')!.value, lineasB });
  });
}

export const SUBPESTANA_TRUEQUES: SubpestanaPlaza = { id: 'trueques', etiqueta: 'Trueques', html, cablear };
