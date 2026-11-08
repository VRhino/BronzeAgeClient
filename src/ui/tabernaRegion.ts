// La taberna regional (tanda 69, motor d0326fd; Niebla_De_Guerra §6.3, Comercio_Caravanas §5.8.10, Mercenarios_Por_Contrato §3.3):
//  - en la taberna de una plaza propia, el Rey, el Embajador o el Gobernador (dentro) compran el informe de la región del relieve donde está la plaza:
//    el de `plazas` (sus fichas pasan a la memoria de la Facción) o el de `ordenes` (sus órdenes de mercado llegan en la VISTA unos minutos);
//  - con un informe de órdenes vigente, el Mercado de cualquier plaza propia enseña esas órdenes y las toma a distancia con una caravana libre
//    (`tomarOrdenADistancia`), con los cargos de los encargos;
//  - la taberna enseña además el tablón de los campamentos de su región (`Asentamiento.mercenariosRegion`) y se contrata desde ahí, pagando con
//    el almacén de la plaza (los mismos tres cargos) o con monedas.
// Quien valida es el motor; aquí se enseña solo lo que el jugador puede hacer (regla de Víctor).
import type { ProyeccionJugador } from '../apiCliente';
import { nombreDeRegion, regionEn, type Region } from '../mundo/region';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, InformeRegion, OrdenMercado, Point } from '../tiposDominio';
import { ayuda } from './ayuda';
import { mostrar as mostrarAviso } from './avisos';
import type { FuenteDeContrato } from './columnaQuePaga';
import { motivoSinEncargo } from './encargoCaravana';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { cablearTablonMercenarios, htmlTablonMercenarios } from './mercenarios';
import { caravanasLibres } from './panelMercado';

type Escapar = (valor: string) => string;
type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

const mapa = () => estadoCliente.mapaCache?.mapa;
const miFaccion = (p: ProyeccionJugador) => p.facciones.find((f) => f.id === p.faccionId);

/** La región del relieve donde está la plaza (la de su posición, como el motor); `null` sin el mundo cargado. */
export const regionDePlaza = (a: { posicion: Point }): Region | null => regionEn(mapa(), a.posicion);

export const tabernaActiva = (a: Asentamiento): boolean => (a.edificios ?? []).some((x) => x.tipo === 'taberna' && x.estado === 'activo');

/** ¿Compra intel en la taberna de `a`? El Rey, el Embajador o el Gobernador de esa plaza de su Facción, dentro de ella (`compraIntel` del motor). */
export function compraIntelEn(p: ProyeccionJugador, a: Asentamiento): boolean {
  if (!p.faccionId || a.faccionId !== p.faccionId) return false;
  const u = p.heroe.ubicacion;
  if (u.tipo !== 'asentamiento' || u.asentamientoId !== a.id) return false;
  const f = miFaccion(p);
  return f?.reyId === p.heroeId || f?.embajadorId === p.heroeId || a.cargos?.gobernadorId === p.heroeId;
}

/** Los informes de región de tu Facción (`Faccion.informesRegion`): siguen en la lista hasta la próxima compra, aunque ya caducaran. */
export const informesDeRegion = (p: ProyeccionJugador): InformeRegion[] => miFaccion(p)?.informesRegion ?? [];

/** Los informes de órdenes que aún dejan ver las órdenes de su región. */
export const informesDeOrdenesVigentes = (p: ProyeccionJugador): InformeRegion[] =>
  informesDeRegion(p).filter((x) => x.tipo === 'ordenes' && x.caducaEn !== undefined && x.caducaEn > p.instante);

const TIPO: Record<InformeRegion['tipo'], { icono: string; nombre: string }> = {
  plazas: { icono: '🏛', nombre: 'Plazas' },
  ordenes: { icono: '⚖', nombre: 'Órdenes de mercado' },
};

// ---------------------------------------------------------------- La taberna: comprar el informe

/** La tarjeta «Informe de la región» de la taberna de la plaza `a`, con lo que hay en su almacén (`oroPlaza`). Vacía si no lo puedes comprar. */
export function htmlServicioRegion(p: ProyeccionJugador, a: Asentamiento, oroPlaza: number, e: Escapar): string {
  if (!compraIntelEn(p, a) || !tabernaActiva(a)) return '';
  const t = p.tarifasIntel.region;
  const region = regionDePlaza(a);
  const dura = textoEnTiempoReal(t.caducidadMinutos * 60_000);
  const fila = (tipo: InformeRegion['tipo'], titulo: string, texto: string): string => {
    const previo = region ? informesDeRegion(p).find((x) => x.region === region.id && x.tipo === tipo) : undefined;
    const libre = previo && previo.libreEn > p.instante ? previo.libreEn : null;
    const vigente = previo?.caducaEn !== undefined && previo.caducaEn > p.instante ? previo.caducaEn : null;
    const caro = t.oro > oroPlaza;
    const boton = libre !== null
      ? `<button class="intel-comprar" type="button" disabled>Otra vez en ${textoEnTiempoReal(libre - p.instante)}</button>`
      : `<button class="intel-comprar" type="button" data-region-comprar="${tipo}"${caro ? ` disabled title="El almacén de la plaza no tiene ${t.oro} de oro"` : ''}>Comprar <span class="intel-precio${caro ? ' falta' : ''}">🪙 ${t.oro}</span></button>`;
    return `<div class="intel-region-fila">
      <span class="intel-region-icono" aria-hidden="true">${TIPO[tipo].icono}</span>
      <span class="intel-region-texto"><b>${titulo}</b><small>${texto}</small>${vigente !== null ? `<em>A la vista ${textoEnTiempoReal(vigente - p.instante)} más</em>` : ''}</span>
      ${boton}
    </div>`;
  };
  const info = ayuda('plaza:intel-region', `Lo que se sabe de toda la región del relieve donde está esta plaza. Entran sus plazas que no son de tu Facción ni de una Facción en guerra con la tuya. Cada informe cuesta ${t.oro} de oro del almacén de la plaza y no se repite hasta dentro de ${textoEnTiempoReal(t.cooldownMinutos * 60_000)}. Nadie se entera.`);
  return `<section class="intel-servicio intel-region">
    <div class="intel-servicio-cab"><span class="intel-servicio-icono" aria-hidden="true">🗺</span><span><strong>Informe de la región</strong><small>${e(region?.nombre ?? 'La región de esta plaza')}</small></span>${info}</div>
    ${fila('plazas', 'Sus plazas', 'Nombre, Facción, nivel y sitio de cada una, en tu memoria.')}
    ${fila('ordenes', 'Sus órdenes de mercado', `Las ves ${dura} y las tomas desde el Mercado de tus plazas.`)}
  </section>`;
}

/** «Tus informes de región», en la columna de lo comprado: de qué región, de qué tipo, si aún se ve y cuándo se puede repetir. */
export function htmlInformesRegion(p: ProyeccionJugador, e: Escapar): string {
  const lista = [...informesDeRegion(p)].sort((x, y) => y.compradoEn - x.compradoEn);
  if (lista.length === 0) return '';
  const filas = lista.map((x) => {
    const vigente = x.caducaEn !== undefined && x.caducaEn > p.instante;
    const estado = x.tipo === 'ordenes' ? (vigente ? `a la vista ${textoEnTiempoReal(x.caducaEn! - p.instante)} más` : 'ya no se ven') : 'en tu memoria';
    const repetir = x.libreEn > p.instante ? `otra vez en ${textoEnTiempoReal(x.libreEn - p.instante)}` : 'se puede repetir';
    return `<div class="intel-region-informe${vigente ? ' vigente' : ''}"><span aria-hidden="true">${TIPO[x.tipo].icono}</span><span><b>${e(nombreDeRegion(mapa(), x.region))}</b><small>${TIPO[x.tipo].nombre} · ${estado} · ${repetir}</small></span></div>`;
  }).join('');
  return `<div class="obra-titulo"><span class="faction-kicker">Tus informes de región</span><span class="obra-chip">${lista.length}</span></div><div class="intel-region-informes">${filas}</div>`;
}

export function cablearServicioRegion(root: HTMLElement, a: Asentamiento, ejecutar: Ejecutar): void {
  root.querySelectorAll<HTMLButtonElement>('[data-region-comprar]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const m = await ejecutar('comprarInformeRegion', { asentamientoId: a.id, tipo: b.dataset.regionComprar });
    b.disabled = false;
    if (m) mostrarAviso(m, true);
  }));
}

// ---------------------------------------------------------------- La taberna: el tablón de la región

/** Con qué se paga un contrato desde la taberna de `a`: el almacén de la plaza (si eres Rey, Embajador o Gobernador, dentro) y tus monedas. */
export function fuentesDeRegion(p: ProyeccionJugador, a: Asentamiento): FuenteDeContrato[] {
  const fuentes: FuenteDeContrato[] = [];
  if (compraIntelEn(p, a)) fuentes.push({ pagarCon: 'almacenPlaza', nombre: 'el almacén de la plaza', saldo: a.almacen?.['oro']?.cantidad ?? 0, enMonedas: false });
  const monedas = p.heroe.monedas ?? 0;
  if (monedas > 0) fuentes.push({ pagarCon: 'monedas', nombre: 'tus monedas', saldo: monedas, enMonedas: true });
  return fuentes;
}

/** La subpestaña «Mercenarios» de la taberna: el tablón de los campamentos de la región, con contratar desde aquí. */
export function htmlMercenariosDeRegion(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  return `${htmlTablonMercenarios(p, a.mercenariosRegion, e, undefined, { plaza: a, fuentes: fuentesDeRegion(p, a) })}<p id="camp-error" class="faction-error" role="alert"></p>`;
}

export function cablearMercenariosDeRegion(root: HTMLElement, ejecutar: Ejecutar, repintar: () => void): void {
  cablearTablonMercenarios(root, ejecutar, (m) => { const el = root.querySelector('#camp-error'); if (el) el.textContent = m; }, repintar);
}

// ---------------------------------------------------------------- El Mercado: las órdenes de la región

interface PlazaDeOrden { id: string; nombre: string; faccionId?: string; posicion?: Point }

function plazaDeOrden(p: ProyeccionJugador, id: string): PlazaDeOrden {
  const vista = [...p.asentamientos, ...p.asentamientosAvistados].find((x) => x.id === id);
  if (vista) return { id, nombre: vista.nombre ?? id, faccionId: vista.faccionId, posicion: vista.posicion };
  const conocida = p.asentamientosConocidos.find((x) => x.asentamientoId === id);
  return conocida ? { id, nombre: conocida.nombre ?? id, faccionId: conocida.faccionId, posicion: conocida.posicion } : { id, nombre: 'Una plaza que no conoces' };
}

/** Las órdenes activas de plazas ajenas que llegan por los informes de órdenes vigentes, por plaza y de la más cercana a `desde` a la más lejana. */
export function ordenesDeLaRegion(p: ProyeccionJugador, desde: Point): { plaza: PlazaDeOrden; ordenes: OrdenMercado[] }[] {
  const grupos = new Map<string, OrdenMercado[]>();
  for (const o of p.ordenes ?? []) {
    if (o.estado !== 'activa' || o.cantidad - o.cantidadCumplida <= 0) continue;
    grupos.set(o.asentamientoId, [...(grupos.get(o.asentamientoId) ?? []), o]);
  }
  const lejos = (x: PlazaDeOrden): number => (x.posicion ? Math.hypot(x.posicion.x - desde.x, x.posicion.y - desde.y) : Infinity);
  return [...grupos].map(([id, ordenes]) => ({ plaza: plazaDeOrden(p, id), ordenes }))
    .filter((g) => g.plaza.faccionId !== p.faccionId)
    .sort((x, y) => lejos(x.plaza) - lejos(y.plaza));
}

const cifra = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** La subpestaña «Región» del Mercado de la plaza propia (con un informe de órdenes vigente): las órdenes ajenas y tomarlas a distancia. */
export function htmlOrdenesRegion(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e } = c;
  const vigentes = informesDeOrdenesVigentes(p);
  const grupos = ordenesDeLaRegion(p, a.posicion);
  const motivo = motivoSinEncargo(p, a, c.resideAqui);
  const libres = caravanasLibres(p, a, c.refrescar);
  const capacidad = Math.max(0, ...libres.map((x) => x.capacidad ?? 0));
  const regiones = vigentes.map((x) => `<span class="obra-chip" title="${e(`Informe de órdenes de ${nombreDeRegion(mapa(), x.region)}`)}">⚖ ${e(nombreDeRegion(mapa(), x.region))} · ${textoEnTiempoReal(x.caducaEn! - p.instante)}</span>`).join('');
  const info = ayuda('mercado:region', 'Las órdenes de mercado activas de las plazas de las regiones de las que tu Facción tiene un informe de órdenes vigente (se compra en la taberna). Tomar una manda la primera caravana libre de esta plaza que pueda con lo pedido a esa plaza, con el precio de la orden como tope: si vende, le compra; si compra, le lleva lo tuyo y se lo vende. La orden no se reserva: al llegar se comercia con lo que quede. El oro sale y entra en tu capital.');
  const nota = motivo ?? (libres.length === 0 ? 'No tienes ninguna caravana libre en esta plaza: hace falta una para tomar una orden.' : null);
  const puede = nota === null;
  const fila = (o: OrdenMercado): string => {
    const pendiente = Math.floor(o.cantidad - o.cantidadCumplida);
    const hay = Math.floor(a.almacen?.[o.recurso]?.cantidad ?? 0);
    const tope = Math.min(pendiente, capacidad || pendiente, o.tipo === 'compra' ? hay : pendiente);
    const accion = o.tipo === 'venta' ? 'Comprarle' : 'Venderle';
    const tomar = !puede ? ''
      : tope < 1 ? `<small class="region-orden-no">${o.tipo === 'compra' ? `No tienes ${e(RECURSO_NOMBRE[o.recurso] ?? o.recurso)} en el almacén` : 'No cabe en tus caravanas'}</small>`
        : `<span class="region-orden-tomar"><input class="form-input" type="number" min="1" max="${tope}" step="1" value="${tope}" data-region-cantidad="${e(o.id)}" aria-label="Cantidad" /><button class="btn-primary" type="button" data-region-tomar="${e(o.id)}">${accion}</button></span>`;
    return `<div class="region-orden ${o.tipo}">
      <span class="orden-ficha-icono">${RECURSO_ICONO[o.recurso] ?? '📦'}<i>${o.tipo === 'venta' ? '▲' : '▼'}</i></span>
      <span class="region-orden-cuerpo"><b>${o.tipo === 'venta' ? 'Vende' : 'Compra'} ${pendiente} ${e(RECURSO_NOMBRE[o.recurso] ?? o.recurso)}</b><small>🪙 ${o.precioUnitario.toFixed(2)} c/u · caduca en ${textoEnTiempoReal(o.expiraEn - p.instante)}${o.tipo === 'compra' ? ` · tienes ${hay}` : ''}</small></span>
      ${tomar}
    </div>`;
  };
  const faccion = (id?: string): string => (id ? p.facciones.find((f) => f.id === id)?.nombre ?? '' : '');
  const lista = grupos.map((g) => {
    const lejos = g.plaza.posicion ? ` · a ${Math.round(Math.hypot(g.plaza.posicion.x - a.posicion.x, g.plaza.posicion.y - a.posicion.y))} u` : '';
    const de = [faccion(g.plaza.faccionId), g.plaza.posicion ? regionEn(mapa(), g.plaza.posicion)?.nombre : undefined].filter(Boolean).join(' · ');
    return `<section class="region-plaza"><div class="region-plaza-cab"><strong>${e(g.plaza.nombre)}</strong><small>${e(de)}${lejos}</small></div>${g.ordenes.map(fila).join('')}</section>`;
  }).join('');
  return `<div class="obra-titulo"><span class="faction-kicker">Órdenes de la región</span>${regiones}${info}</div>
    ${nota ? `<p class="asent-lado-nota">${e(nota)}</p>` : `<p class="asent-lado-nota">Sale la primera caravana libre que pueda con lo pedido: caben hasta ${cifra(capacidad)}.</p>`}
    ${lista || '<p class="mapa-lista-vacia">Ninguna plaza de esas regiones tiene órdenes abiertas ahora.</p>'}`;
}

export function cablearOrdenesRegion(c: ContextoPlaza): void {
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-region-tomar]').forEach((b) => b.addEventListener('click', async () => {
    const ordenId = b.dataset.regionTomar!;
    const cantidad = Number(c.cuerpo.querySelector<HTMLInputElement>(`[data-region-cantidad="${CSS.escape(ordenId)}"]`)?.value ?? 0);
    if (!(cantidad >= 1)) { mostrarAviso('Pon cuánto quieres tomar.', true); return; }
    b.disabled = true;
    const m = await c.ejecutar('tomarOrdenADistancia', { asentamientoId: c.asentamiento.id, ordenId, cantidad });
    b.disabled = false;
    mostrarAviso(m ?? 'Sale la caravana hacia esa plaza.', Boolean(m));
  }));
}

/** «Región» en el Mercado, solo mientras tu Facción tiene un informe de órdenes vigente. */
export const SUBPESTANA_REGION: SubpestanaPlaza = {
  id: 'region',
  etiqueta: 'Región',
  html: htmlOrdenesRegion,
  cablear: cablearOrdenesRegion,
  visible: (c) => c.asentamiento.faccionId === c.proyeccion.faccionId && informesDeOrdenesVigentes(c.proyeccion).length > 0,
};
