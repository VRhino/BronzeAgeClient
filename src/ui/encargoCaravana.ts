// El ENCARGO de una caravana comercial (motor 2c4bca6, Comercio_Caravanas §5.8): una ruta permanente entre dos plazas de la Facción o un envío de
// una ida y vuelta (también a una plaza ajena, ya o a una hora). En cada parada deja y luego recoge; en una plaza ajena dejar es vender a sus
// órdenes de compra y recoger es comprar a sus órdenes de venta, y cada línea lleva su precio. Lo dan, cambian y cancelan el Gobernador, el Tesorero
// o el Maestro de Caravanas del origen, residentes y dentro (`encargarCaravana`, `cambiarEncargo`, `cancelarEncargo`). Quien valida es el servidor.
// El formulario tiene un número fijo de líneas por lista: así el repintado del sondeo (`repintado.ts`) conserva lo que el jugador ya ha escrito.
import { bloqueDeDatos, type ProyeccionJugador } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, Caravana, Encargo, ParadaEncargo } from '../tiposDominio';
import { ritmoDelMundo, textoEnTiempoReal } from './estadoCliente';
import type { Ejecutar } from './panelCarro';
import { mostrar as mostrarAviso } from './avisos';

type Escapar = (valor: string) => string;
type Punta = 'origen' | 'destino';

const LINEAS = 3;
const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const icono = (r: string): string => RECURSO_ICONO[r] ?? '📦';
const cifra = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Formularios abiertos (por caravana): se conservan entre repintados. */
const abiertos = new Set<string>();

interface Plaza { id: string; nombre: string; propia: boolean }

/** Las plazas a las que puede ir: las de la Facción (para una ruta o un envío) y las demás que conoces (solo envío). */
function destinos(p: ProyeccionJugador, origen: string): Plaza[] {
  const todas: Plaza[] = [
    ...p.asentamientos.map((x) => ({ id: x.id, nombre: x.nombre ?? x.id, propia: x.faccionId === p.faccionId })),
    ...p.asentamientosAvistados.map((x) => ({ id: x.id, nombre: x.nombre ?? x.id, propia: x.faccionId === p.faccionId })),
    ...p.asentamientosConocidos.map((x) => ({ id: x.asentamientoId, nombre: x.nombre ?? x.asentamientoId, propia: x.faccionId === p.faccionId })),
  ];
  return todas.filter((x, i, l) => x.id !== origen && l.findIndex((y) => y.id === x.id) === i).sort((a, b) => Number(b.propia) - Number(a.propia) || a.nombre.localeCompare(b.nombre));
}

function nombrePlaza(p: ProyeccionJugador, id: string): string {
  return destinos(p, '').find((x) => x.id === id)?.nombre ?? id;
}

/** Dónde está una plaza que conoces (para situar la carreta en el dibujo de la ruta). */
function posicionPlaza(p: ProyeccionJugador, id: string): { x: number; y: number } | undefined {
  return p.asentamientos.find((x) => x.id === id)?.posicion ?? p.asentamientosAvistados.find((x) => x.id === id)?.posicion
    ?? p.asentamientosConocidos.find((x) => x.asentamientoId === id)?.posicion;
}

/** Por qué no puedes dar ni tocar encargos en esta plaza, o `null` si puedes. */
export function motivoSinEncargo(p: ProyeccionJugador, a: Asentamiento, reside: boolean): string | null {
  const c = a.cargos;
  const cargo = [c?.gobernadorId, c?.tesoreroId, c?.maestroCaravanasId].includes(p.heroeId);
  if (!cargo) return 'Los encargos los dan el Gobernador, el Tesorero o el Maestro de Caravanas de esta plaza.';
  if (!reside) return 'Solo quien reside en esta plaza da encargos.';
  if (!(p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id)) return 'Tienes que estar dentro de la plaza.';
  return null;
}

/** Lo que hace en una parada, en fichas: «Deja» (o «Vende») y «Recoge» (o «Compra»), cada recurso con su icono, su cifra y su precio. */
function paradaEnFichas(titulo: string, x: ParadaEncargo | undefined, ajena: boolean, aqui: boolean, e: Escapar): string {
  const ficha = (r: string, cifraTxt: string, precio: string): string =>
    `<span class="ruta-ficha" title="${e(nombre(r))}"><i>${icono(r)}</i><b>${cifraTxt}</b><small>${e(nombre(r))}${precio}</small></span>`;
  const dejar = (x?.dejar ?? []).map((l) => ficha(l.recurso, l.tope !== undefined ? `≤ ${cifra(l.tope)}` : 'todo', l.precioMin !== undefined ? ` · a ≥ ${cifra(l.precioMin)}` : ''));
  const recoger = (x?.recoger ?? []).map((l) => ficha(l.recurso, cifra(l.cantidad), l.precioMax !== undefined ? ` · a ≤ ${cifra(l.precioMax)}` : ''));
  const fila = (verbo: string, fichas: string[], marca: string): string =>
    `<div class="ruta-accion"><span class="ruta-verbo">${verbo}</span>${fichas.length ? fichas.join('') : '<span class="ruta-nada">nada</span>'}${marca}</div>`;
  return `<div class="ruta-parada${aqui ? ' aqui' : ''}">
      <strong class="ruta-parada-cab">${e(titulo)}</strong>
      ${fila(ajena ? '⬇ Vende' : '⬇ Deja', dejar, x?.desecharSobrante ? '<span class="ruta-marca" title="Lo que no quepa en el almacén se tira">tira lo que sobre</span>' : '')}
      ${fila(ajena ? '⬆ Compra' : '⬆ Recoge', recoger, x?.esperarExistencias ? '<span class="ruta-marca" title="No sale hasta tenerlo todo">espera a tenerlo</span>' : '')}
    </div>`;
}

/** Cuándo empezó el paso en curso (descarga o carga), por caravana y fin de paso: el motor solo manda el fin (`fin_paso_ms`), así que se apunta el
 * primer instante en que se vio. Si se abre a mitad del paso, la barra arranca ahí. */
const inicioVisto = new Map<string, number>();

/** La barra de tiempo de la descarga o la carga (0.140.0, Víctor 2026-11-04), con lo que queda. `''` fuera de esos pasos. */
function barraDePaso(c: Caravana, k: Encargo, p: ProyeccionJugador, e: Escapar): string {
  if (c.estado !== 'esperando' || (k.fase !== 'carga' && k.fase !== 'descarga') || !k.finPaso) return '';
  const clave = `${c.id}:${k.finPaso}`;
  const inicio = k.inicioPaso ?? inicioVisto.get(clave) ?? p.instante;
  if (k.inicioPaso === undefined && !inicioVisto.has(clave)) inicioVisto.set(clave, inicio);
  const total = Math.max(1, k.finPaso - inicio);
  const hecho = Math.min(1, Math.max(0, (p.instante - inicio) / total));
  const queda = Math.max(0, k.finPaso - p.instante);
  const donde = k.paradaActual === 'origen' ? 'el origen' : 'el destino';
  return `<div class="ruta-paso ${k.fase}" title="${e(`${k.fase === 'carga' ? 'Cargando' : 'Descargando'} en ${donde}`)}">
      <span class="ruta-paso-cab"><span>${k.fase === 'carga' ? '⬆ Cargando' : '⬇ Descargando'} en ${donde}</span><b>${queda > 0 ? `⏳ ${e(textoEnTiempoReal(queda))}` : 'ya casi'}</b></span>
      <span class="obra-barra"><i style="width:${(hecho * 100).toFixed(1)}%"></i></span>
    </div>`;
}

/** El dibujo de la ruta (0.138.0): origen y destino con la carreta en el camino (proyectada sobre la recta entre las dos plazas), la fase y las vueltas,
 * y lo que hace en cada parada en fichas. Lo usan la ficha de la caravana y la pestaña Rutas del Mercado. */
export function htmlRutaVisual(c: Caravana, k: Encargo, p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const ajena = !destinos(p, a.id).find((x) => x.id === k.destinoAsentamientoId)?.propia;
  const o = a.posicion, d = posicionPlaza(p, k.destinoAsentamientoId);
  const estado = c.estado ?? 'disponible';
  const enCamino = estado === 'en_transito' || estado === 'retornando';
  let t = k.paradaActual === 'destino' ? 0.97 : 0.03;
  if (enCamino) {
    const dx = (d?.x ?? o.x) - o.x, dy = (d?.y ?? o.y) - o.y, l2 = dx * dx + dy * dy;
    t = l2 > 0 ? ((c.posicionActual.x - o.x) * dx + (c.posicionActual.y - o.y) * dy) / l2 : 0.5;
    t = Math.min(0.92, Math.max(0.08, t));
  }
  const vuelve = estado === 'retornando';
  let fase = k.cancelado ? '✕ Cancelado: termina al volver' : textoSituacion(c, k, p).replace(/\.$/, '') || 'Parada';
  // Con la barra de tiempo debajo, la píldora no repite lo que queda.
  const conBarra = c.estado === 'esperando' && (k.fase === 'carga' || k.fase === 'descarga') && Boolean(k.finPaso);
  if (conBarra) fase = fase.replace(/ \([^)]*\)$/, '');
  const faseClase = k.cancelado ? 'cancelado' : enCamino ? 'camino' : k.fase === 'espera' ? 'espera' : 'trabajo';
  const aquiO = !enCamino && k.paradaActual === 'origen', aquiD = !enCamino && k.paradaActual === 'destino';
  const punta = (nombreTxt: string, rol: string, aqui: boolean, deOtro: boolean): string =>
    `<div class="ruta-punta${aqui ? ' aqui' : ''}"><span class="ruta-punta-icono">${deOtro ? '🏴' : '🏛️'}</span><strong>${e(nombreTxt)}</strong><small>${rol}${deOtro ? ' · ajena' : ''}</small></div>`;
  return `<div class="ruta-vis">
      <div class="ruta-linea">
        ${punta(a.nombre ?? a.id, 'origen', aquiO, false)}
        <div class="ruta-pista${enCamino ? ' en-camino' : ''}" aria-hidden="true">
          <span class="ruta-camino"></span>
          <span class="ruta-carreta${vuelve ? ' vuelve' : ''}" style="left:${(t * 100).toFixed(1)}%" title="${e(fase)}">🛞</span>
          <span class="ruta-sentido">${k.modo === 'ruta' ? '⇄' : '→ ←'}</span>
        </div>
        ${punta(nombrePlaza(p, k.destinoAsentamientoId), 'destino', aquiD, ajena)}
      </div>
      <div class="ruta-estado">
        <span class="ruta-fase ${faseClase}">${e(fase)}</span>
        <span class="obra-chip">${k.modo === 'ruta' ? '⇄ Ruta permanente' : '→ Envío de ida y vuelta'}</span>
        ${k.modo === 'ruta' ? `<span class="obra-chip" title="Vueltas completas">↻ ${k.vueltas} ${k.vueltas === 1 ? 'vuelta' : 'vueltas'}</span>` : ''}
      </div>
      ${barraDePaso(c, k, p, e)}
      <div class="ruta-paradas">
        ${paradaEnFichas(`En ${a.nombre ?? 'el origen'}`, k.paradaOrigen, false, aquiO, e)}
        ${paradaEnFichas(`En ${nombrePlaza(p, k.destinoAsentamientoId)}`, k.paradaDestino, ajena, aquiD, e)}
      </div>
    </div>`;
}

/** Dónde anda y qué hace la caravana con encargo. */
function textoSituacion(c: Caravana, k: Encargo, p: ProyeccionJugador): string {
  const donde = k.paradaActual === 'origen' ? 'el origen' : 'el destino';
  if (c.estado === 'en_transito') return 'De camino al destino.';
  if (c.estado === 'retornando') return 'De vuelta al origen.';
  if (c.estado !== 'esperando') return '';
  const fin = k.finPaso && k.finPaso > p.instante ? ` (${textoEnTiempoReal(k.finPaso - p.instante)})` : '';
  if (k.fase === 'descarga') return `Descargando en ${donde}${fin}.`;
  if (k.fase === 'carga') return `Cargando en ${donde}${fin}.`;
  if (k.salirEn && k.salirEn > p.instante && k.vueltas === 0 && k.paradaActual === 'origen') return `Espera en el origen: sale dentro de ${textoEnTiempoReal(k.salirEn - p.instante)}.`;
  return `Esperando en ${donde}${k.fase === 'espera' ? ' a que haya existencias' : ''}.`;
}

/** Las líneas de una lista del formulario: las que ya hay y huecos hasta `LINEAS` (siempre al menos una libre). */
function filas<T>(lista: T[]): (T | undefined)[] {
  return Array.from({ length: Math.max(LINEAS, lista.length + 1) }, (_, i) => lista[i]);
}

function opcionesRecurso(elegido: string | undefined, e: Escapar): string {
  return `<option value="">—</option>${Object.keys(RECURSO_NOMBRE).map((r) => `<option value="${e(r)}"${r === elegido ? ' selected' : ''}>${icono(r)} ${e(nombre(r))}</option>`).join('')}`;
}

function htmlParada(id: string, punta: Punta, x: ParadaEncargo | undefined, e: Escapar): string {
  const d = (campo: string, i: number): string => `data-enc-${campo}="${e(id)}:${punta}:${i}"`;
  const recoger = filas(x?.recoger ?? []).map((l, i) => `<div class="encargo-linea">
      <select class="form-input" ${d('rec-recurso', i)}>${opcionesRecurso(l?.recurso, e)}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="Cantidad" value="${l ? cifra(l.cantidad) : ''}" ${d('rec-cantidad', i)} />
      <input class="form-input" type="number" min="0" step="0.1" placeholder="Precio máx." value="${l?.precioMax !== undefined ? cifra(l.precioMax) : ''}" ${d('rec-precio', i)} data-enc-precio="${e(id)}:${punta}" />
    </div>`).join('');
  const dejar = filas(x?.dejar ?? []).map((l, i) => `<div class="encargo-linea">
      <select class="form-input" ${d('dej-recurso', i)}>${opcionesRecurso(l?.recurso, e)}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="Tope (todo)" value="${l?.tope !== undefined ? cifra(l.tope) : ''}" ${d('dej-tope', i)} />
      <input class="form-input" type="number" min="0" step="0.1" placeholder="Precio mín." value="${l?.precioMin !== undefined ? cifra(l.precioMin) : ''}" ${d('dej-precio', i)} data-enc-precio="${e(id)}:${punta}" />
    </div>`).join('');
  return `<fieldset class="encargo-parada">
      <legend>${punta === 'origen' ? 'En el origen' : 'En el destino'} <small data-enc-ajena="${e(id)}:${punta}"></small></legend>
      <strong class="heroe-sub">Deja</strong>${dejar}
      <label class="asent-toggle"><input type="checkbox" ${d('desechar', 0)}${x?.desecharSobrante ? ' checked' : ''} /> Tirar lo que no quepa en el almacén</label>
      <strong class="heroe-sub">Recoge</strong>${recoger}
      <label class="asent-toggle"><input type="checkbox" ${d('esperar', 0)}${x?.esperarExistencias ? ' checked' : ''} /> Esperar a que haya todo</label>
    </fieldset>`;
}

function htmlFormulario(c: Caravana, p: ProyeccionJugador, a: Asentamiento, capacidad: number, e: Escapar): string {
  const k = c.encargo;
  const id = c.id;
  const lista = destinos(p, a.id);
  // El destino solo cambia con la caravana esperando en su origen.
  const destinoFijo = k !== undefined && !(c.estado === 'esperando' && k.paradaActual === 'origen');
  const elegido = k?.destinoAsentamientoId ?? lista.find((x) => x.propia)?.id ?? lista[0]?.id;
  const maxDias = bloqueDeDatos<{ maxProgramacionDias?: number }>('CARAVANA_PREPARACION')?.maxProgramacionDias;
  const modo = k
    ? `<input type="hidden" data-enc-modo="${e(id)}" value="${k.modo}" /><span>${k.modo === 'ruta' ? 'Ruta permanente' : 'Envío'}</span>`
    : `<select class="form-input" data-enc-modo="${e(id)}"><option value="ruta">Ruta permanente (entre plazas tuyas)</option><option value="envio">Envío (una ida y vuelta)</option></select>`;
  return `<div class="encargo-form" data-enc-form="${e(id)}">
      <div class="mercado-acciones">${modo}
        <select class="form-input" data-enc-destino="${e(id)}"${destinoFijo ? ' disabled title="El destino solo cambia con la caravana esperando en su origen"' : ''}>${lista.length === 0 ? '<option value="">— no conoces otra plaza —</option>' : lista.map((x) => `<option value="${e(x.id)}" data-propia="${x.propia ? 1 : 0}"${x.id === elegido ? ' selected' : ''}>${e(x.nombre)}${x.propia ? ' (tuya)' : ''}</option>`).join('')}</select>
      </div>
      ${k?.modo === 'ruta' ? '' : `<label class="encargo-salida" data-enc-salida-caja="${e(id)}">Salir dentro de <input class="form-input" type="number" min="0" step="1" placeholder="ya" data-enc-salida="${e(id)}" /> min${maxDias ? ` <small>(hasta ${maxDias} d de mundo)</small>` : ''}</label>`}
      <p class="asent-lado-nota">Primero deja y luego recoge. Cabe ${capacidad} por parada. En una plaza ajena deja es vender a sus órdenes de compra y recoge es comprar a sus órdenes de venta: cada línea con su precio, y sin oro (el oro para comprar se recoge en el origen).</p>
      <div class="encargo-paradas">${htmlParada(id, 'origen', k?.paradaOrigen, e)}${htmlParada(id, 'destino', k?.paradaDestino, e)}</div>
      <div class="mercado-acciones"><button class="btn-primary btn-chico" type="button" data-enc-enviar="${e(id)}"${lista.length === 0 ? ' disabled' : ''}>${k ? 'Guardar cambios' : 'Dar encargo'}</button></div>
    </div>`;
}

/** La sección «Encargo» de la tarjeta de una caravana de la flota de `a` (su origen). */
/** `siempreAbierto`: sin encargo, el formulario directamente (la vista de flota, en «Encargo»), sin el botón «Dar encargo». */
export function htmlEncargo(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, capacidad: number, conAnimal: boolean, e: Escapar, siempreAbierto = false, titulo?: string): string {
  if (c.tipo !== 'comercial' || c.origenAsentamientoId !== a.id) return '';
  const k = c.encargo;
  const motivo = motivoSinEncargo(p, a, reside);
  const abierto = abiertos.has(c.id) && !motivo;
  if (!k) {
    if (c.estado !== 'disponible' || !conAnimal) return '';
    if (siempreAbierto && !motivo) return `<div class="caravana-seccion">${htmlFormulario(c, p, a, capacidad, e)}</div>`;
    return `<div class="caravana-seccion">
      <div class="caravana-seccion-cab"><strong class="heroe-sub">Encargo</strong><button class="btn-secondary btn-chico" type="button" data-enc-abrir="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${abierto ? '▾ Cerrar' : '＋ Dar encargo'}</button></div>
      ${abierto ? htmlFormulario(c, p, a, capacidad, e) : '<p class="asent-lado-nota">Sin encargo. Con uno va y viene sola: una ruta entre dos plazas tuyas, o un envío de una ida y vuelta.</p>'}
    </div>`;
  }
  // Solo quien puede cambiarla ve «Cambiar» y «Cancelar» (lo que no puedes hacer no se enseña).
  const botones = k.cancelado || motivo ? '' : `<span class="caravana-botones">
      <button class="btn-secondary btn-chico" type="button" data-enc-abrir="${e(c.id)}">${abierto ? '▾ Cerrar' : '✎ Cambiar'}</button>
      <button class="btn-secondary btn-chico" type="button" data-enc-cancelar="${e(c.id)}">Cancelar encargo</button></span>`;
  return `<div class="caravana-seccion encargo">
    <div class="caravana-seccion-cab"><strong class="heroe-sub">${titulo ?? (k.modo === 'ruta' ? 'Ruta' : 'Envío')}</strong>${botones}</div>
    ${htmlRutaVisual(c, k, p, a, e)}
    ${abierto && !k.cancelado ? htmlFormulario(c, p, a, capacidad, e) : ''}
  </div>`;
}

/** Lee una parada del formulario; `undefined` si no tiene ninguna línea. */
function leerParada(raiz: HTMLElement, id: string, punta: Punta, ajena: boolean): ParadaEncargo | undefined {
  const campo = <T extends HTMLElement>(nombreCampo: string, i: number): T | null => raiz.querySelector<T>(`[data-enc-${nombreCampo}="${CSS.escape(`${id}:${punta}:${i}`)}"]`);
  const num = (el: HTMLInputElement | null): number | undefined => (el && el.value.trim() !== '' && Number.isFinite(Number(el.value)) ? Number(el.value) : undefined);
  const recoger: ParadaEncargo['recoger'] = [];
  const dejar: ParadaEncargo['dejar'] = [];
  for (let i = 0; ; i++) {
    const sel = campo<HTMLSelectElement>('rec-recurso', i);
    if (!sel) break;
    const cantidad = num(campo<HTMLInputElement>('rec-cantidad', i));
    if (sel.value && cantidad !== undefined) recoger.push({ recurso: sel.value, cantidad, precioMax: ajena ? num(campo<HTMLInputElement>('rec-precio', i)) : undefined });
  }
  for (let i = 0; ; i++) {
    const sel = campo<HTMLSelectElement>('dej-recurso', i);
    if (!sel) break;
    if (sel.value) dejar.push({ recurso: sel.value, tope: num(campo<HTMLInputElement>('dej-tope', i)), precioMin: ajena ? num(campo<HTMLInputElement>('dej-precio', i)) : undefined });
  }
  const esperarExistencias = campo<HTMLInputElement>('esperar', 0)?.checked ?? false;
  const desecharSobrante = campo<HTMLInputElement>('desechar', 0)?.checked ?? false;
  if (recoger.length === 0 && dejar.length === 0) return undefined;
  return { recoger, esperarExistencias, dejar, desecharSobrante };
}

export function cablearEncargo(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar, repintar: () => void): void {
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<boolean> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
    return mensaje === null;
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-enc-abrir]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.encAbrir!;
    if (abiertos.has(id)) abiertos.delete(id); else abiertos.add(id);
    repintar();
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-enc-cancelar]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Cancelar el encargo? La caravana termina lo que esté haciendo y vuelve a su origen.')) return;
    void lanzar(b, 'cancelarEncargo', { caravanaId: b.dataset.encCancelar! });
  }));
  // Según el modo y el destino: una ruta solo va a plazas tuyas, y los precios solo valen en una plaza ajena.
  raiz.querySelectorAll<HTMLElement>('[data-enc-form]').forEach((form) => {
    const id = form.dataset.encForm!;
    const modo = form.querySelector<HTMLSelectElement | HTMLInputElement>('[data-enc-modo]');
    const destino = form.querySelector<HTMLSelectElement>('[data-enc-destino]');
    const ajustar = (): void => {
      const ruta = modo?.value === 'ruta';
      destino?.querySelectorAll<HTMLOptionElement>('option').forEach((o) => { o.disabled = ruta && o.dataset.propia === '0'; });
      if (destino && destino.selectedOptions[0]?.disabled) {
        const libre = Array.from(destino.options).find((o) => !o.disabled);
        if (libre) destino.value = libre.value;
      }
      const ajena = destino?.selectedOptions[0]?.dataset.propia === '0';
      form.querySelectorAll<HTMLInputElement>('[data-enc-precio]').forEach((i) => { i.hidden = !(ajena && i.dataset.encPrecio === `${id}:destino`); });
      const marca = form.querySelector<HTMLElement>(`[data-enc-ajena="${CSS.escape(`${id}:destino`)}"]`);
      if (marca) marca.textContent = ajena ? '(plaza ajena: vende y compra a sus órdenes)' : '';
      const salida = form.querySelector<HTMLElement>('[data-enc-salida-caja]');
      if (salida) salida.hidden = ruta;
    };
    modo?.addEventListener('change', ajustar);
    destino?.addEventListener('change', ajustar);
    ajustar();
    form.querySelector<HTMLButtonElement>('[data-enc-enviar]')?.addEventListener('click', async (ev) => {
      const boton = ev.currentTarget as HTMLButtonElement;
      const k = p.caravanas.find((c) => c.id === id)?.encargo;
      const ajena = destino?.selectedOptions[0]?.dataset.propia === '0';
      const minutos = Number(form.querySelector<HTMLInputElement>('[data-enc-salida]')?.value || 0);
      const salirEnMs = modo?.value === 'envio' && minutos > 0 ? p.instante + minutos * 60_000 * ritmoDelMundo() : undefined;
      const params = {
        caravanaId: id,
        destinoAsentamientoId: destino?.value ?? '',
        salirEnMs,
        paradaOrigen: leerParada(form, id, 'origen', false),
        paradaDestino: leerParada(form, id, 'destino', ajena),
      };
      const ok = k ? await lanzar(boton, 'cambiarEncargo', params) : await lanzar(boton, 'encargarCaravana', { ...params, modo: modo?.value ?? 'ruta' });
      if (ok) abiertos.delete(id);
    });
  });
}
