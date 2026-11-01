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

/** Por qué no puedes dar ni tocar encargos en esta plaza, o `null` si puedes. */
export function motivoSinEncargo(p: ProyeccionJugador, a: Asentamiento, reside: boolean): string | null {
  const c = a.cargos;
  const cargo = [c?.gobernadorId, c?.tesoreroId, c?.maestroCaravanasId].includes(p.heroeId);
  if (!cargo) return 'Los encargos los dan el Gobernador, el Tesorero o el Maestro de Caravanas de esta plaza.';
  if (!reside) return 'Solo quien reside en esta plaza da encargos.';
  if (!(p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id)) return 'Tienes que estar dentro de la plaza.';
  return null;
}

function textoParada(x: ParadaEncargo | undefined, ajena: boolean, e: Escapar): string {
  if (!x || (x.recoger.length === 0 && x.dejar.length === 0)) return 'nada';
  const dejar = x.dejar.map((l) => `${icono(l.recurso)} ${e(nombre(l.recurso))}${l.tope !== undefined ? ` hasta ${cifra(l.tope)}` : ''}${l.precioMin !== undefined ? ` a ≥${cifra(l.precioMin)}` : ''}`);
  const recoger = x.recoger.map((l) => `${icono(l.recurso)} ${e(nombre(l.recurso))} ${cifra(l.cantidad)}${l.precioMax !== undefined ? ` a ≤${cifra(l.precioMax)}` : ''}`);
  const partes = [
    dejar.length ? `${ajena ? 'vende' : 'deja'} ${dejar.join(', ')}${x.desecharSobrante ? ' (tira lo que no quepa)' : ''}` : '',
    recoger.length ? `${ajena ? 'compra' : 'recoge'} ${recoger.join(', ')}${x.esperarExistencias ? ' (espera a tenerlo)' : ''}` : '',
  ].filter(Boolean);
  return partes.join(' · ');
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
export function htmlEncargo(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, capacidad: number, conAnimal: boolean, e: Escapar): string {
  if (c.tipo !== 'comercial' || c.origenAsentamientoId !== a.id) return '';
  const k = c.encargo;
  const motivo = motivoSinEncargo(p, a, reside);
  const abierto = abiertos.has(c.id) && !motivo;
  if (!k) {
    if (c.estado !== 'disponible' || !conAnimal) return '';
    return `<div class="caravana-seccion">
      <div class="caravana-seccion-cab"><strong class="heroe-sub">Encargo</strong><button class="btn-secondary btn-chico" type="button" data-enc-abrir="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${abierto ? '▾ Cerrar' : '＋ Dar encargo'}</button></div>
      ${abierto ? htmlFormulario(c, p, a, capacidad, e) : '<p class="asent-lado-nota">Sin encargo. Con uno va y viene sola: una ruta entre dos plazas tuyas, o un envío de una ida y vuelta.</p>'}
    </div>`;
  }
  const ajena = !destinos(p, a.id).find((x) => x.id === k.destinoAsentamientoId)?.propia;
  const situacion = textoSituacion(c, k, p);
  const botones = k.cancelado ? '' : `<span class="caravana-botones">
      <button class="btn-secondary btn-chico" type="button" data-enc-abrir="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${abierto ? '▾ Cerrar' : 'Cambiar'}</button>
      <button class="btn-secondary btn-chico" type="button" data-enc-cancelar="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Cancelar encargo</button></span>`;
  return `<div class="caravana-seccion encargo">
    <div class="caravana-seccion-cab"><strong class="heroe-sub">${k.modo === 'ruta' ? 'Ruta' : 'Envío'} → ${e(nombrePlaza(p, k.destinoAsentamientoId))}${ajena ? ' (ajena)' : ''}</strong>${botones}</div>
    <p class="asent-lado-nota">${k.cancelado ? 'Cancelado: termina al volver al origen.' : e(situacion)}${k.modo === 'ruta' ? ` · ${k.vueltas} ${k.vueltas === 1 ? 'vuelta' : 'vueltas'}` : ''}</p>
    <p class="asent-lado-nota">Origen: ${textoParada(k.paradaOrigen, false, e)}<br>Destino: ${textoParada(k.paradaDestino, ajena, e)}</p>
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

export function cablearEncargo(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar, error: HTMLElement | null, repintar: () => void): void {
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<boolean> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
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
