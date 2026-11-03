// Pestaña «MERCADO» de la plaza (backend Doc 3.3 y 3.13): órdenes de compra y venta, y la flota de caravanas comerciales. Solo actúan los residentes del origen
// (`colocarOrdenMercado`, `crearCaravana`, `agregarCarroCaravana`, `comprarAnimalCaravana`, `moverCarroCaravana`, `reservarCaravana`, `prepararCaravana`,
// `cancelarCaravana`), la escolta de cada caravana (`asignarEscolta`, `quitarEscolta`: Doc 3.13.4) y las caravanas aparcadas aquí por un ejército
// (`moverCargaCaravanaAparcada`, `enviarCaravanaAlOrigen`: Doc 3.13.7), todo en la misma tarjeta por caravana. Costes de carros y animales, capacidad, velocidad, preparación y cupos salen del balance; quien valida es el servidor y su rechazo sale flotando.
// Tomar una orden AJENA es otra cosa (`comerciarEnPlaza`: con una columna tuya a la puerta de esa plaza) y no se hace desde dentro de la tuya.
import { catalogoDeCaravanas, catalogoDePoliticas, cupoDeFlota, type ProyeccionJugador } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, Caravana, Escuadron } from '../tiposDominio';
import { ayuda } from './ayuda';
import { textoEnTiempoReal } from './estadoCliente';
import { chipLiderazgo } from './liderazgo';
import type { Ejecutar } from './panelCarro';
import { iconoEdificio } from './iconosEdificio';
import { iconoEnFila, iconoTropa } from './iconosTropa';
import { cablearEncargo, htmlEncargo, motivoSinEncargo } from './encargoCaravana';
import { mostrar as mostrarAviso } from './avisos';
import { olvidarEdicion } from './repintado';
import { ICONO_CARRETA } from './juegoVisual';
import { iconoRitmo, velocidadDePiezas } from './velocidadColumna';

type Escapar = (valor: string) => string;

const RECURSOS_ORDEN = Object.keys(RECURSO_NOMBRE).filter((r) => r !== 'oro');
const ESTADO_ICONO: Record<string, string> = { disponible: '⚓', preparando: '⏳', adjunta: '🔗', aparcada: '🅿️', en_transito: '➜', retornando: '↩', esperando: '⌛' };
const CARRO: Record<string, string> = { basico: 'Carro básico', reforzado: 'Carro reforzado' };
const ANIMAL: Record<string, string> = { buey: 'Buey', caballo: 'Caballo', camello: 'Camello' };
const ANIMAL_ICONO: Record<string, string> = { buey: '🐂', caballo: '🐎', camello: '🐪' };

/** Cómo se llama una caravana: su nombre, si un residente de su origen se lo puso, o «Caravana car-N». */
export function nombreDeCaravana(c: { id: string; nombre?: string }): string {
  return c.nombre ?? `Caravana ${c.id}`;
}

/** Tope del nombre de una caravana: el mismo que el de una plaza (`NOMBRE_ASENTAMIENTO.largoMaximo`; `caravana.nombre_largo`). */
const LARGO_NOMBRE_CARAVANA = 32;

/** La caravana cuyo nombre se está cambiando: vive entre repintados (el sondeo de 3 s no lo cierra). */
let caravanaRenombrando: string | null = null;

/** El nombre de la tarjeta: con ✎ si puedes cambiarlo (resides en su origen y estás dentro) y, al pulsarlo, el campo con ✓ y ✕. */
function nombreEnTarjeta(c: Caravana, renombrable: boolean, e: Escapar): string {
  if (renombrable && caravanaRenombrando === c.id) {
    return `<span class="caravana-renombrar"><input class="form-input" type="text" maxlength="${LARGO_NOMBRE_CARAVANA}" data-caravana-nombre="${e(c.id)}" value="${e(c.nombre ?? '')}" placeholder="Sin nombre (${e(c.id)})" aria-label="Nombre de la caravana" />
      <button class="caravana-ok" type="button" data-caravana-guardar="${e(c.id)}" title="Guardar (Intro)" aria-label="Guardar">✓</button><button type="button" data-caravana-cancelar title="Cancelar (Esc)" aria-label="Cancelar">✕</button></span>`;
  }
  const lapiz = renombrable ? `<button class="caravana-lapiz" type="button" data-caravana-renombrar="${e(c.id)}" title="Ponerle nombre" aria-label="Ponerle nombre">✎</button>` : '';
  return `<strong title="${e(c.id)}">${e(nombreDeCaravana(c))}${lapiz}</strong>`;
}

function resideAqui(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** Lo que falta para un instante de mundo, en el tiempo que verá el jugador (el mundo corre más rápido que el reloj). */
function falta(hasta: number, p: ProyeccionJugador): string {
  const ms = hasta - p.instante;
  if (ms <= 0) return 'ya';
  const min = ms / 60_000;
  return min >= 60 ? `${Math.round(min / 60)} h` : min >= 1 ? `${Math.round(min)} min` : `${Math.round(ms / 1000)} s`;
}

// ---------------------------------------------------------------- Órdenes

/** Lo elegido en la boleta de la orden (sobrevive a los repintados del sondeo). */
const boleta = { tipo: 'venta' as 'venta' | 'compra', recurso: RECURSOS_ORDEN[0] ?? 'madera' };

/**
 * Órdenes, con aire de juego (2026-11-02): una boleta con Vender / Comprar, el almacén como inventario de casillas (icono y lo que hay) para elegir el
 * recurso, cantidad y precio con lo que sale en total, y las órdenes en pie como fichas con su barra de cumplido, su precio y lo que les queda.
 */
export function htmlOrdenes(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const reside = resideAqui(p, a);
  const mias = p.ordenes.filter((o) => o.asentamientoId === a.id && o.estado === 'activa');
  const hay = (r: string): number => Math.floor(a.almacen?.[r]?.cantidad ?? 0);
  const info = ayuda('mercado:ordenes', 'Una orden de <strong>venta</strong> ofrece recursos de tu almacén por oro; una de <strong>compra</strong> pide recursos pagando con el oro de la plaza. Cualquiera de tu Facción (o de fuera) con una columna a la puerta puede tomarla en persona. Sin precio, se usa el de mercado.');
  // Lo que hay en el almacén va primero (para vender); lo que falta, después y apagado (para pedirlo).
  const casillas = [...RECURSOS_ORDEN.filter((r) => hay(r) > 0), ...RECURSOS_ORDEN.filter((r) => hay(r) <= 0)].map((r) => `<button class="orden-recurso${r === boleta.recurso ? ' elegido' : ''}${hay(r) > 0 ? '' : ' vacio'}" type="button" data-orden-recurso="${e(r)}" title="${e(`${RECURSO_NOMBRE[r] ?? r}: hay ${hay(r)}`)}" aria-label="${e(RECURSO_NOMBRE[r] ?? r)}" aria-pressed="${r === boleta.recurso}">
      <span aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</span><small>${hay(r)}</small></button>`).join('');
  const boletaHtml = reside ? `<div class="orden-boleta ${boleta.tipo}">
      <input type="hidden" data-orden="tipo" value="${boleta.tipo}" /><input type="hidden" data-orden="recurso" value="${e(boleta.recurso)}" />
      <div class="orden-tipos" role="radiogroup">
        <button class="orden-tipo venta${boleta.tipo === 'venta' ? ' elegido' : ''}" type="button" data-orden-tipo="venta" aria-pressed="${boleta.tipo === 'venta'}">▲ Vender</button>
        <button class="orden-tipo compra${boleta.tipo === 'compra' ? ' elegido' : ''}" type="button" data-orden-tipo="compra" aria-pressed="${boleta.tipo === 'compra'}">▼ Comprar</button>
      </div>
      <div class="orden-inventario">${casillas}</div>
      <div class="orden-elegido"><span class="orden-elegido-icono" data-orden-icono>${RECURSO_ICONO[boleta.recurso] ?? '📦'}</span><strong data-orden-nombre>${e(RECURSO_NOMBRE[boleta.recurso] ?? boleta.recurso)}</strong><small data-orden-hay>hay ${hay(boleta.recurso)}</small></div>
      <div class="orden-campos">
        <label><span>Cantidad</span><input class="form-input" type="number" min="1" step="1" placeholder="0" data-orden="cantidad" /></label>
        <label><span>🪙 c/u</span><input class="form-input" type="number" min="0" step="0.01" placeholder="mercado" data-orden="precio" /></label>
      </div>
      <div class="orden-pie"><span class="orden-total" data-orden-total>a precio de mercado</span><button class="orden-colocar" type="button" data-orden-colocar>${boleta.tipo === 'venta' ? 'Poner a la venta' : 'Pedir'}</button></div>
    </div>` : '<p class="asent-lado-nota">Solo quien reside en esta plaza coloca órdenes.</p>';
  const ficha = (o: (typeof mias)[number]): string => {
    const hecho = o.cantidad > 0 ? Math.min(1, o.cantidadCumplida / o.cantidad) : 0;
    return `<div class="orden-ficha ${o.tipo}" title="${e(`${o.tipo === 'venta' ? 'Vende' : 'Compra'} ${RECURSO_NOMBRE[o.recurso] ?? o.recurso}: ${Math.floor(o.cantidadCumplida)} de ${Math.floor(o.cantidad)} · ${o.precioUnitario.toFixed(2)} de oro c/u · caduca en ${falta(o.expiraEn, p)}`)}">
      <span class="orden-ficha-icono">${RECURSO_ICONO[o.recurso] ?? '📦'}<i>${o.tipo === 'venta' ? '▲' : '▼'}</i></span>
      <span class="orden-ficha-cuerpo"><b>${o.tipo === 'venta' ? 'Vende' : 'Compra'} ${Math.floor(o.cantidad)}</b><span class="obra-barra"><i style="width:${(hecho * 100).toFixed(1)}%"></i></span><small>${Math.floor(o.cantidadCumplida)}/${Math.floor(o.cantidad)} · 🪙 ${o.precioUnitario.toFixed(2)} · ⏳ ${falta(o.expiraEn, p)}</small></span>
    </div>`;
  };
  // A pantalla completa, la boleta a la izquierda y las órdenes en pie a la derecha (`cols-completa`, sin efecto en una ventana estrecha).
  return `<div class="cols-completa"><div class="col-completa"><div class="obra-titulo"><span class="faction-kicker">Órdenes de mercado</span><span class="obra-chip" title="Oro de la plaza">🪙 ${hay('oro')}</span>${info}</div>
    ${boletaHtml}</div><div class="col-completa">
    <div class="obra-titulo"><span class="faction-kicker">En pie</span><span class="obra-chip">${mias.length}</span></div>
    ${mias.length === 0 ? '<p class="mapa-lista-vacia">No hay órdenes en pie.</p>' : `<div class="orden-fichas">${mias.map(ficha).join('')}</div>`}</div></div>`;
}

export function cablearOrdenes(raiz: HTMLElement, a: Asentamiento, ejecutar: Ejecutar): void {
  const campo = (n: string): HTMLInputElement | HTMLSelectElement | null => raiz.querySelector(`[data-orden="${n}"]`);
  const total = (): void => {
    const el = raiz.querySelector<HTMLElement>('[data-orden-total]');
    const n = Number(campo('cantidad')?.value), precio = Number(campo('precio')?.value);
    if (el) el.textContent = n >= 1 && precio > 0 ? `${boleta.tipo === 'venta' ? 'cobras' : 'pagas'} 🪙 ${Math.round(n * precio * 100) / 100}` : 'a precio de mercado';
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-orden-recurso]').forEach((b) => b.addEventListener('click', () => {
    boleta.recurso = b.dataset.ordenRecurso!;
    const r = boleta.recurso;
    (campo('recurso') as HTMLInputElement).value = r;
    raiz.querySelectorAll<HTMLButtonElement>('[data-orden-recurso]').forEach((x) => { x.classList.toggle('elegido', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    const icono = raiz.querySelector('[data-orden-icono]'), nombre = raiz.querySelector('[data-orden-nombre]'), hay = raiz.querySelector('[data-orden-hay]');
    if (icono) icono.textContent = RECURSO_ICONO[r] ?? '📦';
    if (nombre) nombre.textContent = RECURSO_NOMBRE[r] ?? r;
    if (hay) hay.textContent = `hay ${Math.floor(a.almacen?.[r]?.cantidad ?? 0)}`;
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-orden-tipo]').forEach((b) => b.addEventListener('click', () => {
    boleta.tipo = b.dataset.ordenTipo as 'venta' | 'compra';
    (campo('tipo') as HTMLInputElement).value = boleta.tipo;
    raiz.querySelectorAll<HTMLButtonElement>('[data-orden-tipo]').forEach((x) => { x.classList.toggle('elegido', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    raiz.querySelector('.orden-boleta')?.classList.remove('venta', 'compra');
    raiz.querySelector('.orden-boleta')?.classList.add(boleta.tipo);
    const colocar = raiz.querySelector('[data-orden-colocar]');
    if (colocar) colocar.textContent = boleta.tipo === 'venta' ? 'Poner a la venta' : 'Pedir';
    total();
  }));
  campo('cantidad')?.addEventListener('input', total);
  campo('precio')?.addEventListener('input', total);
  total();
  const boton = raiz.querySelector<HTMLButtonElement>('[data-orden-colocar]');
  boton?.addEventListener('click', async () => {
    const cantidad = Number(campo('cantidad')?.value);
    if (!(cantidad >= 1)) { mostrarAviso('Pon una cantidad de 1 o más.', true); return; }
    const precio = campo('precio')?.value;
    boton.disabled = true;
    const mensaje = await ejecutar('colocarOrdenMercado', { asentamientoId: a.id, tipo: boleta.tipo, recurso: boleta.recurso, cantidad, ...(precio ? { precio: Number(precio) } : {}) });
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
  });
}

// ---------------------------------------------------------------- Caravanas

/** Caravanas con el desplegable «Añadir escolta» abierto: sobrevive a los repintados del sondeo (el HTML lo pinta según este conjunto). */
const escoltaAbierta = new Set<string>();

/** Los residentes de ese asentamiento (fundadores o con casa comprada); sin su ficha no se sabe y se deja probar al servidor. */
function resideEn(p: ProyeccionJugador, asentamientoId: string): boolean | null {
  const x = p.asentamientos.find((y) => y.id === asentamientoId);
  return x ? resideAqui(p, x) : null;
}

function nombrePlaza(p: ProyeccionJugador, id: string): string {
  return p.asentamientos.find((x) => x.id === id)?.nombre ?? p.asentamientosAvistados.find((x) => x.id === id)?.nombre ?? p.asentamientosConocidos.find((x) => x.asentamientoId === id)?.nombre ?? id;
}

/** Lo que sale de los catálogos del balance y de las políticas activas de la plaza para una caravana. */
interface DatosCaravana {
  cat: NonNullable<ReturnType<typeof catalogoDeCaravanas>>;
  /** Multiplicadores de las políticas `carga_ampliada` y `rutas_rapidas` que la plaza tiene activas (1 si no hay). */
  fCapacidad: number;
  fVelocidad: number;
  /** Puntos de Liderazgo de escolta que da el Mercado por caravana, si el balance los trae. */
  escoltaPts?: number;
}

const iconos = (costo: Record<string, number>): string => Object.entries(costo).map(([r, n]) => `${n} ${RECURSO_ICONO[r] ?? RECURSO_NOMBRE[r] ?? r}`).join(' ');
/** Lo que falta del almacén para pagar un coste, o `null` si alcanza. */
function motivoCosto(costo: Record<string, number>, almacen: Record<string, number>): string | null {
  const faltan = Object.entries(costo).filter(([r, n]) => Math.floor(almacen[r] ?? 0) < n).map(([r, n]) => `${n} ${RECURSO_NOMBRE[r] ?? r}`);
  return faltan.length > 0 ? `Faltan ${faltan.join(' y ')} en el almacén.` : null;
}

function barraEscolta(usado: number, cupo: number): string {
  return `<div class="escolta-barra${usado >= cupo ? ' llena' : ''}" title="Liderazgo de la escolta: lo que gastan las escuadras cedidas sobre el cupo de la caravana"><i style="width:${cupo > 0 ? Math.min(100, (usado / cupo) * 100).toFixed(1) : 0}%"></i></div>
    <small class="escolta-cifras"><strong>${usado}/${cupo} pts</strong> de Liderazgo · quedan ${Math.max(0, cupo - usado)}</small>`;
}

/** Escolta de una caravana comercial de esta plaza (Doc 3.13.4): cupo, escuadras cedidas con «Retirar» y «Añadir escolta», que despliega las que puedes ceder.
 * También la del carro de acarreo de un pueblo (`ui/pueblos.ts`), que el motor escolta igual. */
export function escolta(c: Caravana, p: ProyeccionJugador, reside: boolean, parada: boolean, escoltaPts: number | undefined, e: Escapar): string {
  const cupo = c.escoltaLiderazgo?.cupo ?? escoltaPts;
  if (cupo === undefined) return '<p class="asent-lado-nota">El backend no publica su cupo de escolta.</p>';
  const cedidas = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'escolta' && s.contenedor.caravanaId === c.id);
  const mias = cedidas.reduce((t, s) => t + s.costeLiderazgo, 0);
  // El motor no publica lo usado: cuentan las escuadras tuyas cedidas (su coste sale del escalón de la tropa); las de otros residentes solo se ven como ids.
  const usado = c.escoltaLiderazgo?.usado ?? mias;
  const ajenas = (c.escoltaIds ?? []).filter((id) => !cedidas.some((s) => s.id === id)).length;
  const deOtros = c.escoltaLiderazgo ? Math.max(0, usado - mias) : 0;
  const libre = cupo - usado;
  const candidatas: Escuadron[] = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);
  const motivo = !parada ? 'Solo se cambia con la caravana parada en su origen.'
    : !reside ? 'Solo quien reside en esta plaza cede escolta.'
      : candidatas.length === 0 ? 'No tienes escuadras libres en el campamento.'
        : candidatas.every((s) => s.costeLiderazgo > libre) ? `No cabe ninguna: quedan ${Math.max(0, libre)} pts.` : null;
  const abierta = motivo === null && escoltaAbierta.has(c.id);
  const cedidasHtml = cedidas.length > 0
    ? `<div class="mapa-lista">${cedidas.map((s) => `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div>${parada ? `<button class="btn-secondary" type="button" data-quitar-escolta="${e(s.id)}" data-caravana="${e(c.id)}">Retirar</button>` : ''}</div>`).join('')}</div>`
    : '<p class="asent-lado-nota">No has cedido ninguna escuadra.</p>';
  const libresHtml = candidatas.map((s) => {
    const cabe = s.costeLiderazgo <= libre;
    return `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres${cabe ? '' : ` · no cabe: quedan ${Math.max(0, libre)} pts`}</span></div><button class="btn-secondary" type="button" data-ceder-escolta="${e(s.id)}" data-caravana="${e(c.id)}"${cabe ? '' : ' disabled'}>Ceder</button></div>`;
  }).join('');
  const otros = deOtros > 0 ? `Otros residentes han cedido ${deOtros} pts.`
    : !c.escoltaLiderazgo && ajenas > 0 ? `Además van ${ajenas === 1 ? '1 escuadra' : `${ajenas} escuadras`} de otros residentes: la barra no cuenta su coste y el servidor sí.` : '';
  return `<div class="caravana-seccion-cab"><strong class="heroe-sub">Escolta</strong><button class="btn-secondary btn-chico" type="button" data-escolta-abrir="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${abierta ? '▾' : '＋'} Añadir escolta</button></div>
    ${barraEscolta(usado, cupo)}
    ${otros ? `<p class="asent-lado-nota">${otros}</p>` : ''}
    ${motivo && parada && reside ? `<small class="asent-lado-nota">${e(motivo)}</small>` : ''}
    ${motivo ? '' : `<div class="mapa-lista" data-escolta-lista="${e(c.id)}"${abierta ? '' : ' hidden'}>${libresHtml}</div>`}
    ${cedidasHtml}`;
}

/** Caravana aparcada AQUÍ por un ejército (Doc 3.13.7): sigue siendo de su origen; intercambia carga con el almacén y solo sale enganchada o enviada al origen.
 * Con aire de juego (2026-11-02): lo que lleva en fichas, el recurso y la cantidad en una fila con «Cargar» y «Descargar», y «Enviar al origen». */
function cuerpoAparcada(k: Caravana, a: Asentamiento, p: ProyeccionJugador, e: Escapar): string {
  const carga = Object.entries(k.contenido ?? {}).filter(([, n]) => n > 0);
  const almacen = Object.entries(a.almacen ?? {}).filter(([r]) => r !== 'oro');
  const recursos = [...new Set([...carga.map(([r]) => r), ...almacen.map(([r]) => r)])];
  // Sin la ficha del origen no se sabe: se deja probar y el servidor contesta.
  const motivo = resideEn(p, k.origenAsentamientoId) === false ? 'Solo los residentes del origen la manejan.' : null;
  const dis = motivo ? ` disabled title="${e(motivo)}"` : '';
  const fichas = carga.length === 0 ? '<span class="aparcada-vacia">Va vacía</span>'
    : carga.map(([r, n]) => `<span class="pacto-linea" title="${e(RECURSO_NOMBRE[r] ?? r)}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i><b>${Math.floor(n)}</b></span>`).join('');
  return `<div class="aparcada-carga"><small>Lleva</small>${fichas}</div>
    ${motivo ? `<p class="asent-lado-nota">${e(motivo)}</p>` : ''}
    <div class="aparcada-mover">
      <select class="form-input" data-aparcada-recurso="${e(k.id)}" aria-label="Recurso">${recursos.map((r) => `<option value="${e(r)}">${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)} (carro ${Math.floor(k.contenido?.[r] ?? 0)} · almacén ${Math.floor(a.almacen?.[r]?.cantidad ?? 0)})</option>`).join('')}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="0" aria-label="Cantidad" data-aparcada-cantidad="${e(k.id)}" />
      <button class="btn-secondary btn-chico" type="button" data-aparcada-mover="${e(k.id)}:cargar" title="Del almacén al carro"${dis}>⬆ Cargar</button>
      <button class="btn-secondary btn-chico" type="button" data-aparcada-mover="${e(k.id)}:descargar" title="Del carro al almacén"${dis}>⬇ Descargar</button>
    </div>
    <div class="aparcada-pie"><button class="aparcada-origen" type="button" data-aparcada-origen="${e(k.id)}"${dis}>↩ Enviar al origen</button></div>`;
}

// ---------------------------------------------------------------- la vista de flota (Víctor, 2026-11-03)
// A la izquierda (un cuarto) la lista de caravanas con lo mínimo: dónde está o adónde va, si está reservada, sus carros y lo que lleva; a la
// derecha (tres cuartos) la elegida. Solo se maneja la que está en la plaza; de las que andan fuera (en un pueblo, una aldea, de camino) se ve
// dónde están y nada de dentro. Carros y escolta van en huecos como la tropa de «Salir al mundo», y abajo, Viaje o Encargo.

/** La caravana abierta a la derecha; si no está en la lista, la primera. */
let caravanaElegida: string | null = null;
/** El carro elegido en la tira (`caravanaId:indice`), para comprarle el animal o pasarlo a otra caravana. */
let carroElegido: string | null = null;
/** Caravanas con el «añadir carro» abierto, y lo que se lleva elegido en él. */
const carroNuevoAbierto = new Set<string>();
const carroNuevoEleccion = new Map<string, { tipo?: string; animal?: string }>();
/** Viaje o Encargo, por caravana (sin elegir: Viaje). */
const modoCaravana = new Map<string, 'viaje' | 'encargo'>();

const mismoSitio = (x: { x: number; y: number }, y: { x: number; y: number }): boolean => Math.abs(x.x - y.x) < 0.5 && Math.abs(x.y - y.y) < 0.5;

/** Dónde está la caravana (o adónde va) y si está dentro de esta plaza. */
function ubicacionDe(c: Caravana, p: ProyeccionJugador, a: Asentamiento): { texto: string; enPlaza: boolean } {
  const estado = c.estado ?? 'disponible';
  const quieta = estado === 'disponible' || estado === 'preparando' || estado === 'esperando' || estado === 'aparcada';
  if (quieta && mismoSitio(c.posicionActual, a.posicion)) {
    return { texto: estado === 'preparando' ? `En la plaza · sale en ${c.preparaHasta ? falta(c.preparaHasta, p) : 'un momento'}` : 'En la plaza', enPlaza: true };
  }
  if (quieta) {
    const pueblo = (p.pueblos ?? []).find((x) => mismoSitio(x.posicion, c.posicionActual));
    if (pueblo) return { texto: pueblo.tipo === 'aldeaAgricola' ? 'En aldea agrícola' : `En pueblo ${EDIFICIO_NOMBRE[pueblo.tipo] ?? pueblo.tipo}`, enPlaza: false };
    const plaza = [...p.asentamientos, ...p.asentamientosAvistados].find((x) => mismoSitio(x.posicion, c.posicionActual))
      ?? p.asentamientosConocidos.find((x) => mismoSitio(x.posicion, c.posicionActual));
    if (plaza) return { texto: `En ${plaza.nombre ?? 'otra plaza'}`, enPlaza: false };
  }
  const destino = c.encargo?.paradaActual === 'origen' ? c.origenAsentamientoId : c.encargo?.destinoAsentamientoId ?? c.destinoAsentamientoId;
  if (estado === 'en_transito' || (estado === 'esperando' && destino)) return { texto: destino ? `Hacia ${nombrePlaza(p, destino)}` : 'De camino', enPlaza: false };
  if (estado === 'retornando') return { texto: `Volviendo a ${nombrePlaza(p, c.origenAsentamientoId)}`, enPlaza: false };
  if (estado === 'adjunta') return { texto: 'Con un ejército', enPlaza: false };
  return { texto: 'Fuera de la plaza', enPlaza: false };
}

/** Lo que puede llevar: solo cuentan los carros con animal (Doc 3.13.1); las políticas de la plaza lo multiplican. */
function capacidadDe(c: Caravana, d: DatosCaravana | null): number | null {
  if (!d) return null;
  return Math.floor((c.carros ?? []).reduce((t, r) => {
    const def = d.cat.carros[r.tipoCarro];
    const an = r.animal ? d.cat.animales[r.animal] : undefined;
    return def && an ? t + def.capacidadBase * an.factorCarga : t;
  }, 0) * d.fCapacidad);
}

const cargaDe = (c: Caravana): number => Math.floor(Object.values(c.contenido ?? {}).reduce((t, n) => t + n, 0));

/** Una fila de la lista de la izquierda. */
function filaFlota(c: Caravana, p: ProyeccionJugador, a: Asentamiento, elegida: boolean, d: DatosCaravana | null, e: Escapar): string {
  const estado = c.estado ?? 'disponible';
  const ajena = estado === 'aparcada' && c.origenAsentamientoId !== a.id;
  const { texto } = ubicacionDe(c, p, a);
  const carros = c.carros ?? [];
  const tiran = carros.filter((r) => r.animal).length;
  const cap = capacidadDe(c, d);
  const carga = cargaDe(c);
  const llenado = cap ? Math.min(100, (carga / cap) * 100) : 0;
  return `<button type="button" class="flota-fila ${e(estado)}${elegida ? ' activo' : ''}" data-flota-elegir="${e(c.id)}" aria-pressed="${elegida}">
      <span class="flota-fila-cab"><span class="caravana-icono">${ICONO_CARRETA}</span><strong>${e(nombreDeCaravana(c))}</strong>${c.reservadaManual ? '<i class="flota-reservada" title="Reservada: la plaza no la usa en sus envíos automáticos">🔒</i>' : ''}</span>
      <small class="flota-fila-donde">${ESTADO_ICONO[estado] ?? ''} ${e(ajena ? `Aparcada aquí · de ${nombrePlaza(p, c.origenAsentamientoId)}` : texto)}</small>
      <span class="flota-fila-datos"><span title="Carros con animal / carros">🛞 ${tiran}/${carros.length}</span>
        <span class="flota-fila-carga" title="Carga: ${carga}${cap !== null ? ` de ${cap}` : ''}"><span class="escolta-barra${llenado >= 100 ? ' llena' : ''}"><i style="width:${llenado.toFixed(1)}%"></i></span><small>📦 ${carga}${cap !== null ? `/${cap}` : ''}</small></span></span>
    </button>`;
}

/** Los carros en huecos, con «+» para añadir uno (tipo y animal a la vez) y, al elegir uno, lo que se le puede hacer. */
function carrosEnHuecos(c: Caravana, a: Asentamiento, editable: boolean, otras: Caravana[], almacen: Record<string, number>, carrosLleno: boolean, d: DatosCaravana | null, e: Escapar): string {
  const carros = c.carros ?? [];
  const elegido = carroElegido?.startsWith(`${c.id}:`) ? Number(carroElegido.slice(c.id.length + 1)) : null;
  const huecos = carros.map((r, i) => {
    const def = d?.cat.carros[r.tipoCarro];
    const an = r.animal ? d?.cat.animales[r.animal] : undefined;
    const cap = def && an ? Math.floor(def.capacidadBase * an.factorCarga * (d?.fCapacidad ?? 1)) : null;
    const accion = editable && (!r.animal || otras.length > 0);
    const cuerpo = `<span class="salida-hueco-icono carro-hueco-icono"><span aria-hidden="true">${r.animal ? ANIMAL_ICONO[r.animal] ?? '🐾' : '∅'}</span><i>${r.tipoCarro === 'reforzado' ? 'R' : 'B'}</i></span>
      <span class="salida-hueco-nombre">${e(r.tipoCarro === 'reforzado' ? 'Reforzado' : r.tipoCarro === 'basico' ? 'Básico' : r.tipoCarro)}</span>
      <small>${r.animal ? `${e(ANIMAL[r.animal] ?? r.animal)}${cap !== null ? ` · 📦 ${cap}` : ''}` : 'sin animal: no tira'}</small>`;
    return accion
      ? `<button type="button" class="salida-hueco lleno carro-hueco${r.animal ? '' : ' sin-animal'}${elegido === i ? ' activo' : ''}" data-carro-elegir="${e(c.id)}:${i}" title="${r.animal ? 'Pasarlo a otra caravana' : 'Comprarle un animal'}">${cuerpo}</button>`
      : `<div class="salida-hueco lleno carro-hueco${r.animal ? '' : ' sin-animal'}">${cuerpo}</div>`;
  });
  const abierto = carroNuevoAbierto.has(c.id);
  if (editable && !carrosLleno) huecos.push(`<button class="salida-hueco mas${abierto ? ' activo' : ''}" type="button" data-carro-mas="${e(c.id)}" title="Añadir un carro" aria-label="Añadir un carro">+</button>`);
  // Lo del carro elegido: el animal que le falta o pasarlo a otra caravana parada.
  const r = elegido !== null ? carros[elegido] : undefined;
  let acciones = '';
  if (editable && r && elegido !== null) {
    const animales = Object.entries(d?.cat.animales ?? {}).map(([id, x]) => {
      const m = motivoCosto(x.costo, almacen);
      return `<option value="${e(id)}"${m ? ' disabled' : ''}>${ANIMAL_ICONO[id] ?? ''} ${e(ANIMAL[id] ?? id)} · ${iconos(x.costo)} · ×${x.factorCarga} · vel. ${x.velocidad}</option>`;
    }).join('');
    acciones = `<div class="carro-acciones">
      ${!r.animal ? `<span>Le falta el animal:</span><select class="form-input" data-animal-tipo="${e(c.id)}:${elegido}">${animales}</select><button class="btn-secondary btn-chico" type="button" data-animal="${e(c.id)}" data-carro="${elegido}">Comprar</button>` : ''}
      ${otras.length > 0 ? `<select class="form-input carro-mover" data-mover-a="${e(c.id)}:${elegido}" title="Pasar este carro a otra caravana parada"><option value="">⇄ Pasar a…</option>${otras.map((x) => `<option value="${e(x.id)}">${e(nombreDeCaravana(x))}</option>`).join('')}</select>` : ''}
    </div>`;
  }
  // Añadir: el tipo de carro (solo los que se pueden fabricar aquí) y su animal; lo que no se puede pagar sale en rojo.
  let nuevo = '';
  if (editable && !carrosLleno && abierto && d) {
    const tipos = Object.entries(d.cat.carros).filter(([, x]) => x.fabrica === 'mercado' || a.edificios.some((y) => y.tipo === x.fabrica && y.estado === 'activo'));
    const ele = carroNuevoEleccion.get(c.id) ?? {};
    const tipo = ele.tipo && tipos.some(([id]) => id === ele.tipo) ? ele.tipo : tipos[0]?.[0];
    const animales = Object.entries(d.cat.animales);
    const animal = ele.animal && animales.some(([id]) => id === ele.animal) ? ele.animal : animales[0]?.[0];
    const opcion = (grupo: string, id: string, actual: string | undefined, icono: string, nombre: string, detalle: string, costo: Record<string, number>): string => {
      const m = motivoCosto(costo, almacen);
      return `<label class="carro-opcion${m ? ' caro' : ''}" title="${e(m ?? nombre)}"><input type="radio" name="${grupo}-${e(c.id)}" value="${e(id)}" data-carro-nuevo-${grupo}="${e(c.id)}"${id === actual ? ' checked' : ''} />
        <span class="carro-opcion-icono" aria-hidden="true">${icono}</span><span><strong>${e(nombre)}</strong><small>${e(detalle)}</small><small class="carro-opcion-coste">${iconos(costo)}</small></span></label>`;
    };
    const def = tipo ? d.cat.carros[tipo] : undefined;
    const an = animal ? d.cat.animales[animal] : undefined;
    const costo: Record<string, number> = { ...(def?.costo ?? {}) };
    for (const [k, n] of Object.entries(an?.costo ?? {})) costo[k] = (costo[k] ?? 0) + n;
    const motivo = !def || !an ? 'Elige el carro y su animal.' : motivoCosto(costo, almacen);
    nuevo = `<div class="carro-nuevo">
      <div class="carro-nuevo-grupo"><small>Carro</small>${tipos.map(([id, x]) => opcion('tipo', id, tipo, id === 'reforzado' ? 'R' : 'B', CARRO[id] ?? id, `capacidad ${x.capacidadBase}`, x.costo)).join('')}</div>
      <div class="carro-nuevo-grupo"><small>Animal</small>${animales.map(([id, x]) => opcion('animal', id, animal, ANIMAL_ICONO[id] ?? '🐾', ANIMAL[id] ?? id, `×${x.factorCarga} de carga · vel. ${x.velocidad}`, x.costo)).join('')}</div>
      <div class="carro-nuevo-pie"><span>Total: ${iconos(costo)}</span><button class="btn-primary btn-chico" type="button" data-carro-agregar="${e(c.id)}" data-tipo="${e(tipo ?? '')}" data-animal="${e(animal ?? '')}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Agregar</button></div>
    </div>`;
  }
  const vacio = carros.length === 0 ? '<p class="asent-lado-nota">Casco vacío: no sale hasta que le montes un carro con su animal.</p>' : '';
  return `<div class="caravana-seccion">
      <div class="caravana-seccion-cab"><strong class="heroe-sub">Carros</strong>${editable && carrosLleno ? `<small class="asent-lado-nota">La flota ya tiene el tope de carros de ${a.edificios.some((x) => x.tipo === 'albergueCaravanas' && x.estado === 'activo') ? 'tu Mercado y tu Albergue' : 'tu Mercado'}.</small>` : ''}</div>
      ${vacio}<div class="salida-huecos carro-huecos">${huecos.join('')}</div>${acciones}${nuevo}
    </div>`;
}

/** La escolta en huecos: las escuadras tuyas (✕ para retirarlas), las de otros residentes, «+» para ceder y la barra de Liderazgo del cupo. */
function escoltaEnHuecos(c: Caravana, p: ProyeccionJugador, editable: boolean, escoltaPts: number | undefined, e: Escapar): string {
  const cupo = c.escoltaLiderazgo?.cupo ?? escoltaPts;
  if (cupo === undefined) return '';
  const cedidas = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'escolta' && s.contenedor.caravanaId === c.id);
  const mias = cedidas.reduce((t, s) => t + s.costeLiderazgo, 0);
  const usado = c.escoltaLiderazgo?.usado ?? mias;
  const ajenas = (c.escoltaIds ?? []).filter((id) => !cedidas.some((s) => s.id === id));
  const libre = cupo - usado;
  const candidatas = editable ? p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0) : [];
  const caben = candidatas.filter((s) => s.costeLiderazgo <= libre);
  const abierta = escoltaAbierta.has(c.id) && candidatas.length > 0;
  const huecos = [
    ...cedidas.map((s) => `<div class="salida-hueco lleno" title="${e(`${s.nombre} · ${s.cantidad} hombres`)}">
        <span class="salida-hueco-icono">${iconoTropa(s.tropaId, 34)}</span><span class="salida-hueco-nombre">${e(s.nombre)}</span>
        <small>Tuya · ${s.cantidad} hombres ${chipLiderazgo(s)}</small>
        ${editable ? `<button class="salida-hueco-quitar" type="button" data-quitar-escolta="${e(s.id)}" data-caravana="${e(c.id)}" title="Retirarla" aria-label="Retirar ${e(s.nombre)}">✕</button>` : ''}
      </div>`),
    ...ajenas.map(() => `<div class="salida-hueco lleno ajena"><span class="salida-hueco-icono escolta-ajena-icono" aria-hidden="true">⚔</span><span class="salida-hueco-nombre">Escuadra</span><small>De otro residente</small></div>`),
  ];
  if (editable && caben.length > 0) huecos.push(`<button class="salida-hueco mas${abierta ? ' activo' : ''}" type="button" data-escolta-mas="${e(c.id)}" title="Ceder una escuadra" aria-label="Ceder una escuadra">+</button>`);
  const lista = abierta ? `<div class="salida-elegir">${candidatas.map((s) => {
    const cabe = s.costeLiderazgo <= libre;
    return `<button class="salida-candidata" type="button" data-ceder-escolta="${e(s.id)}" data-caravana="${e(c.id)}"${cabe ? '' : ` disabled title="No cabe: quedan ${Math.max(0, libre)} pts"`}>${iconoTropa(s.tropaId, 26)}<span><strong>${e(s.nombre)}</strong><small>${s.cantidad} hombres · ${s.costeLiderazgo} de Liderazgo</small></span></button>`;
  }).join('')}</div>` : '';
  const deOtros = Math.max(0, usado - mias);
  return `<div class="caravana-seccion">
      <div class="salida-tropa-cab"><strong class="heroe-sub">Escolta</strong><span class="salida-liderazgo${usado > cupo ? ' excedido' : ''}" title="Liderazgo de escolta: lo comparten los residentes; ceder no gasta el tuyo">Liderazgo ${usado} / ${cupo}${deOtros > 0 ? ` · ${deOtros} de otros residentes` : ''}</span></div>
      <div class="escolta-barra${usado >= cupo ? ' llena' : ''}"><i style="width:${cupo > 0 ? Math.min(100, (usado / cupo) * 100).toFixed(1) : 0}%"></i></div>
      ${huecos.length ? `<div class="salida-huecos">${huecos.join('')}</div>` : '<p class="asent-lado-nota">Sin escolta.</p>'}${lista}
    </div>`;
}

/** El viaje a mano: destino, carga del almacén contra la capacidad y «Lanzar». */
function seccionViaje(c: Caravana, p: ProyeccionJugador, a: Asentamiento, almacen: Record<string, number>, capacidad: number, e: Escapar): string {
  const carros = c.carros ?? [];
  const destinos = [...p.asentamientosAvistados.map((x) => ({ id: x.id, nombre: x.nombre, faccionId: x.faccionId })), ...p.asentamientosConocidos.map((x) => ({ id: x.asentamientoId, nombre: x.nombre, faccionId: x.faccionId }))]
    .filter((x, i, l) => x.id !== a.id && l.findIndex((y) => y.id === x.id) === i);
  const filas = Object.entries(almacen).filter(([r, n]) => n >= 1 && r !== 'oro');
  const preparacion = textoEnTiempoReal((catalogoDeCaravanas()?.preparacionKPorCarro ?? 0) * Math.max(0, carros.length - 1) * 60_000);
  return `<div class="caravana-seccion">
      <div class="caravana-seccion-cab"><strong class="heroe-sub">Destino</strong><select class="form-input viaje-destino" data-viaje-destino="${e(c.id)}">${destinos.length === 0 ? '<option value="">— no conoces otra plaza —</option>' : destinos.map((x) => `<option value="${e(x.id)}">${e(x.nombre ?? x.id)}${x.faccionId === p.faccionId ? ' (tuya)' : ''}</option>`).join('')}</select></div>
      ${filas.length === 0 ? '<p class="asent-lado-nota">No hay nada que cargar en el almacén.</p>' : `<div class="carga-grid">${filas.map(([r, n]) => `<label class="carga-celda" title="${e(RECURSO_NOMBRE[r] ?? r)}: hay ${Math.floor(n)} en el almacén"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-viaje-carga="${e(c.id)}:${e(r)}" /><small>/${Math.floor(n)}</small></label>`).join('')}</div>`}
      <div class="carga-total" data-carga-total="${e(c.id)}" data-capacidad="${capacidad}"><div class="escolta-barra"><i style="width:0%"></i></div><small class="escolta-cifras"><strong>0/${capacidad}</strong> de carga</small></div>
      <button class="btn-primary btn-chico" type="button" data-preparar="${e(c.id)}"${destinos.length === 0 ? ' disabled title="No conoces otra plaza"' : ''}>${carros.length > 1 ? `Preparar (${preparacion}) y lanzar` : 'Lanzar ya'}</button>
    </div>`;
}

/** La caravana elegida, a la derecha. */
function detalleFlota(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, flota: Caravana[], almacen: Record<string, number>, carrosLleno: boolean, d: DatosCaravana | null, e: Escapar): string {
  const estado = c.estado ?? 'disponible';
  const ajena = estado === 'aparcada' && c.origenAsentamientoId !== a.id;
  const dentro = p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id;
  const { texto, enPlaza } = ubicacionDe(c, p, a);
  const renombrable = reside && dentro && c.origenAsentamientoId === a.id && enPlaza;
  const reservar = enPlaza && reside && !ajena && estado === 'disponible'
    ? `<label class="interruptor caravana-reservar" title="Reservada: la plaza no la usa en sus envíos automáticos; sin reservar, una caravana con animal puede salir sola en el reparto"><input type="checkbox" data-reservar="${e(c.id)}"${c.reservadaManual ? ' checked' : ''} /><span class="interruptor-pista" aria-hidden="true"><i></i></span><span>Reservada</span></label>`
    : c.reservadaManual ? '<span class="obra-chip">🔒 Reservada</span>' : '';
  const cab = `<div class="caravana-cab"><span class="caravana-icono">${ICONO_CARRETA}</span><span class="caravana-titulo">${nombreEnTarjeta(c, renombrable, e)}<small>${e(ajena ? `aparcada aquí · de ${nombrePlaza(p, c.origenAsentamientoId)}` : texto)}</small></span>${reservar}</div>`;
  if (ajena) return `<div class="caravana-tarjeta flota-detalle ${e(estado)}">${cab}${cuerpoAparcada(c, a, p, e)}</div>`;
  // Fuera de la plaza no se toca y no se enseña lo de dentro.
  if (!enPlaza) {
    const situacion = c.encargo ? `${c.encargo.modo === 'ruta' ? 'Ruta' : 'Envío'} → ${nombrePlaza(p, c.encargo.destinoAsentamientoId)}.` : '';
    return `<div class="caravana-tarjeta flota-detalle ${e(estado)}">${cab}<p class="asent-lado-nota">${e(situacion)} Está fuera de la plaza: se maneja cuando vuelva.</p></div>`;
  }
  const carros = c.carros ?? [];
  const parada = estado === 'disponible';
  const editable = parada && reside;
  const otras = flota.filter((x) => x.id !== c.id && (x.estado ?? 'disponible') === 'disponible' && mismoSitio(x.posicionActual, a.posicion));
  const tira = carros.filter((r) => r.animal && d?.cat.carros[r.tipoCarro] && d.cat.animales[r.animal]);
  const capacidad = capacidadDe(c, d) ?? 0;
  const velocidad = d && tira.length > 0 ? Math.min(...tira.map((r) => d.cat.animales[r.animal!]!.velocidad)) * d.fVelocidad : 0;
  const ritmo = tira.length > 0 ? velocidadDePiezas([{ nombre: 'la caravana', velocidad }]) : null;
  const preparacion = d ? textoEnTiempoReal(d.cat.preparacionKPorCarro * Math.max(0, carros.length - 1) * 60_000) : '';
  const politicas = d && (d.fCapacidad !== 1 || d.fVelocidad !== 1) ? ' title="Con las políticas de la plaza"' : '';
  const chips = `<div class="caravana-chips"${politicas}>
      <span title="Lo que puede llevar: solo cuentan los carros con animal"><i>📦</i><strong>${d ? capacidad : '?'}</strong><small>carga</small></span>
      <span class="ritmo-${ritmo?.ritmo ?? 'ligera'}" title="Velocidad: la del animal más lento"><i>${ritmo ? iconoRitmo(ritmo, 12) : '🐾'}</i><strong>${tira.length > 0 ? Math.round(velocidad * 10) / 10 : '—'}</strong><small>velocidad</small></span>
      <span title="Tiempo de preparación antes de salir"><i>⏱</i><strong>${carros.length > 1 ? preparacion : 'ya'}</strong><small>preparar</small></span>
    </div>`;
  // Abajo, Viaje o Encargo: con encargo, el encargo; parada y sin él, las dos (se ve una u otra); preparándose, la espera.
  let abajo = '';
  if (c.encargo) abajo = htmlEncargo(c, p, a, reside, capacidad, tira.length > 0, e);
  else if (estado === 'preparando') abajo = `<div class="caravana-seccion"><p class="asent-lado-nota">Sale en ${c.preparaHasta ? falta(c.preparaHasta, p) : 'un momento'}.</p>${reside ? `<button class="btn-secondary btn-chico" type="button" data-cancelar-caravana="${e(c.id)}">Cancelar preparación</button>` : ''}</div>`;
  else if (editable && tira.length === 0) abajo = '<p class="asent-lado-nota">Ponle un carro con su animal para cargarla y lanzarla.</p>';
  else if (editable) {
    const puedeEncargo = motivoSinEncargo(p, a, reside) === null;
    const modo = puedeEncargo ? modoCaravana.get(c.id) ?? 'viaje' : 'viaje';
    const pestanas = puedeEncargo ? `<div class="asent-tabs asent-subtabs caravana-modos">${(['viaje', 'encargo'] as const).map((m) => `<button type="button" class="asent-tab${m === modo ? ' activo' : ''}" data-caravana-modo="${e(c.id)}:${m}" aria-pressed="${m === modo}">${m === 'viaje' ? 'Viaje' : 'Encargo'}</button>`).join('')}</div>` : '<strong class="heroe-sub">Viaje</strong>';
    abajo = `${pestanas}${modo === 'viaje' ? seccionViaje(c, p, a, almacen, capacidad, e) : htmlEncargo(c, p, a, reside, capacidad, true, e, true)}`;
  }
  return `<div class="caravana-tarjeta flota-detalle ${e(estado)}">${cab}${chips}
    ${carrosEnHuecos(c, a, editable, otras, almacen, carrosLleno, d, e)}
    ${escoltaEnHuecos(c, p, reside && (parada || (estado === 'esperando' && c.encargo?.paradaActual === 'origen')), d?.escoltaPts, e)}
    ${abajo}</div>`;
}

/** Los puntos de Liderazgo de escolta por caravana que da el Mercado activo de la plaza (`escoltaPorNivelMercado`); `undefined` sin Mercado o sin datos. */
export function puntosDeEscolta(a: Asentamiento, alCargar?: () => void): number | undefined {
  const nivelMercado = Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === 'mercado' && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
  const cat = catalogoDeCaravanas(alCargar);
  return cat && nivelMercado > 0 ? cat.escoltaPorNivelMercado[nivelMercado - 1] : undefined;
}

/** «Añadir escolta», «Ceder» y «Retirar» de las escoltas pintadas con `escolta` dentro de `raiz`. */
export function cablearEscolta(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  // Escolta: «Añadir escolta» despliega o pliega la lista en la propia tarjeta (sin repintar: el conjunto hace que el siguiente pintado salga igual).
  raiz.querySelectorAll<HTMLButtonElement>('[data-escolta-abrir]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.escoltaAbrir!;
    const abrir = !escoltaAbierta.has(id);
    if (abrir) escoltaAbierta.add(id); else escoltaAbierta.delete(id);
    raiz.querySelectorAll<HTMLElement>('[data-escolta-lista]').forEach((l) => { if (l.dataset.escoltaLista === id) l.hidden = !abrir; });
    b.textContent = `${abrir ? '▾' : '＋'} Añadir escolta`;
  }));
  const escoltar = (tipo: 'asignarEscolta' | 'quitarEscolta', atributo: string): void =>
    raiz.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((boton) => boton.addEventListener('click', async () => {
      const botones = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'));
      const antes = botones.map((b) => b.disabled);
      botones.forEach((b) => { b.disabled = true; });
      const mensaje = await ejecutar(tipo, { caravanaId: boton.dataset.caravana!, heroeId: p.heroeId, escuadronIds: [boton.getAttribute(atributo)!] });
      // Con éxito el refresco repinta el panel; si falla, se reabren los botones y se dice por qué.
      if (mensaje !== null) { botones.forEach((b, i) => { b.disabled = antes[i]!; }); mostrarAviso(mensaje, true); }
    }));
  escoltar('asignarEscolta', 'data-ceder-escolta');
  escoltar('quitarEscolta', 'data-quitar-escolta');
}

export function htmlCaravanas(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar?: () => void): string {
  const reside = resideAqui(p, a);
  const flota = p.caravanas.filter((c) => c.tipo === 'comercial' && c.origenAsentamientoId === a.id);
  // Las de otra plaza que un ejército dejó aparcadas aquí: salen después de las de la flota.
  const aparcadas = p.caravanas.filter((k) => k.estado === 'aparcada' && k.origenAsentamientoId !== a.id && k.posicionActual.x === a.posicion.x && k.posicionActual.y === a.posicion.y);
  const almacen = Object.fromEntries(Object.entries(a.almacen ?? {}).map(([r, v]) => [r, v.cantidad]));
  // Topes de la flota (Doc 3.13.2): los pone el nivel interno del Mercado, más el del Albergue de caravanas activo (motor b5e27ace) y la
  // «Ampliación de Flota»; vienen en el balance. El servidor sigue siendo quien rechaza.
  const activo = (tipo: string): number => Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === tipo && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
  const nivelMercado = activo('mercado'), nivelAlbergue = activo('albergueCaravanas');
  const politicas = catalogoDePoliticas(alCargar)?.catalogo ?? [];
  const extra = (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.['cupoCaravanaExtra']; return typeof v === 'number' ? t + v : t; }, 0);
  const cupo = nivelMercado > 0 ? cupoDeFlota(nivelMercado, nivelAlbergue, extra, alCargar) : null;
  const deQuien = nivelAlbergue > 0 ? 'tu Mercado y tu Albergue' : 'tu Mercado';
  const carros = flota.reduce((t, c) => t + (c.carros?.length ?? 0), 0);
  const carrosLleno = cupo?.carros !== undefined && carros >= cupo.carros;
  const flotaLlena = cupo?.caravanas !== undefined && flota.length >= cupo.caravanas;
  const cat = catalogoDeCaravanas(alCargar);
  const factor = (campo: string): number => (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.[campo]; return typeof v === 'number' ? t * v : t; }, 1);
  const datos: DatosCaravana | null = cat ? { cat, fCapacidad: factor('factorCapacidadCaravana'), fVelocidad: factor('factorVelocidadCaravana'), escoltaPts: nivelMercado > 0 ? cat.escoltaPorNivelMercado[nivelMercado - 1] : undefined } : null;
  const pips = (usadas: number, tope: number | undefined, clase: string): string => tope === undefined ? `<b>${usadas}</b>`
    : `<span class="flota-pips ${clase}">${Array.from({ length: Math.max(tope, usadas) }, (_, i) => `<i class="${i < usadas ? 'usada' : ''}"></i>`).join('')}</span><b>${usadas}/${tope}</b>`;
  const topes = cupo ? `<span class="flota-cupo" title="Caravanas de la flota sobre el tope de ${deQuien}"><small>Caravanas</small>${pips(flota.length, cupo.caravanas, 'caravanas')}</span>
    <span class="flota-cupo" title="Carros de la flota sobre el tope de ${deQuien}"><small>Carros</small>${pips(carros, cupo.carros, 'carros')}</span>
    ${datos?.escoltaPts !== undefined ? `<span class="obra-chip" title="Liderazgo de escolta por caravana">♛ ${datos.escoltaPts}</span>` : ''}` : '';
  // Entre dos caravanas creadas hay una espera (`CARAVANA_COOLDOWN`), compartida con la fundación.
  const listaEn = cat && a.ultimaCaravanaCreadaEn ? a.ultimaCaravanaCreadaEn + cat.cooldownMinutos * 60_000 : 0;
  const motivoCrear = nivelMercado === 0 ? 'Hace falta un Mercado activo.' : flotaLlena ? `La flota ya tiene el tope de caravanas de ${deQuien}.` : listaEn > p.instante ? `Podrás crear otra en ${falta(listaEn, p)}.` : null;
  const todas = [...flota, ...aparcadas];
  const elegida = todas.find((c) => c.id === caravanaElegida) ?? todas[0];
  const info = ayuda('mercado:caravanas', 'Tu flota: un casco se arma con carros (que pagas con materiales del almacén) y un animal por carro, y sale a mano hacia otra plaza con la carga que elijas. Solo cuentan los carros con animal. El cupo de flota y los costes los decide el servidor. Los carros se reparten como quieras entre las caravanas; mover un carro no gasta cupo.<br>La carga sale del almacén al prepararla; si la cancelas antes de salir, vuelve entera.<br><strong>Escolta:</strong> cede escuadras de tu campamento a una caravana parada en su origen: viajarán con ella y volverán al campamento al acabar el viaje. El cupo es de la caravana, en puntos de Liderazgo (lo da tu Mercado) y lo comparten los residentes; ceder no gasta tu Liderazgo.<br><strong>Aparcadas:</strong> caravanas de tu Facción que un ejército dejó aquí al entrar. No las usa esta plaza: puedes pasar carga entre su carro y el almacén, y solo salen enganchadas a un ejército (desde el panel del ejército) o enviadas a su origen. Vacía, aparece en su origen al instante; con carga, vuelve por el camino y la deja allí al llegar.');
  return `<div class="obra-titulo"><span class="faction-kicker">Caravanas comerciales</span>${info}</div>
    <div class="flota-cab">
      <span class="flota-icono">${iconoEdificio('mercado', 32)}</span>
      <span class="flota-cuerpo"><strong>${nivelMercado > 0 ? `Mercado nivel ${nivelMercado}${nivelAlbergue > 0 ? ` · Albergue nivel ${nivelAlbergue}` : ''}` : 'Sin Mercado activo'}</strong><span class="flota-cupos">${topes}</span></span>
      ${reside ? `<button class="flota-crear" type="button" data-caravana-crear${motivoCrear ? ` disabled title="${e(motivoCrear)}"` : ' title="Crear una caravana nueva (un casco vacío)"'}>＋ Crear</button>` : ''}
    </div>
    ${reside ? (motivoCrear ? `<p class="asent-lado-nota">${e(motivoCrear)}</p>` : '') : '<p class="asent-lado-nota">Solo quien reside en esta plaza maneja la flota.</p>'}
    ${todas.length === 0 ? '<p class="mapa-lista-vacia">No hay caravanas en esta plaza.</p>' : `<div class="flota-marco">
      <div class="flota-lista" role="listbox" aria-label="Caravanas">${todas.map((c) => filaFlota(c, p, a, c.id === elegida!.id, datos, e)).join('')}</div>
      ${detalleFlota(elegida!, p, a, reside, flota, almacen, carrosLleno, datos, e)}
    </div>`}`;
}

export function cablearCaravanas(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar, repintar: () => void = () => {}): void {
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
  };
  const valor = (selector: string): string => raiz.querySelector<HTMLSelectElement>(selector)?.value ?? '';
  raiz.querySelector<HTMLButtonElement>('[data-caravana-crear]')?.addEventListener('click', (ev) => void lanzar(ev.currentTarget as HTMLButtonElement, 'crearCaravana', { asentamientoId: a.id }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro-nuevo]').forEach((b) => b.addEventListener('click', () => {
    const [caravanaId, tipoCarro] = b.dataset.carroNuevo!.split(':');
    void lanzar(b, 'agregarCarroCaravana', { caravanaId, tipoCarro });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-animal]').forEach((b) => b.addEventListener('click', () => {
    const caravanaId = b.dataset.animal!;
    void lanzar(b, 'comprarAnimalCaravana', { caravanaId, carroIndice: Number(b.dataset.carro), tipoAnimal: valor(`[data-animal-tipo="${caravanaId}:${b.dataset.carro}"]`) });
  }));
  raiz.querySelectorAll<HTMLSelectElement>('[data-mover-a]').forEach((sel) => sel.addEventListener('change', () => {
    if (!sel.value) return;
    const [desdeCaravanaId, carro] = sel.dataset.moverA!.split(':');
    void lanzar(sel as unknown as HTMLButtonElement, 'moverCarroCaravana', { desdeCaravanaId, haciaCaravanaId: sel.value, carroIndice: Number(carro) }).then(() => { sel.value = ''; });
  }));
  // La carga elegida contra la capacidad de la caravana, a cada tecla; de más, no se deja lanzar.
  raiz.querySelectorAll<HTMLElement>('[data-carga-total]').forEach((caja) => {
    const id = caja.dataset.cargaTotal!;
    const capacidad = Number(caja.dataset.capacidad);
    const entradas = Array.from(raiz.querySelectorAll<HTMLInputElement>('input[data-viaje-carga]')).filter((i) => i.dataset.viajeCarga!.startsWith(`${id}:`));
    const boton = raiz.querySelector<HTMLButtonElement>(`[data-preparar="${id}"]`);
    const sinDestino = boton?.disabled ?? true;
    const actualizar = (): void => {
      const total = entradas.reduce((t, i) => t + Math.max(0, Number(i.value) || 0), 0);
      const sobra = total > capacidad;
      const barra = caja.querySelector<HTMLElement>('.escolta-barra');
      barra?.classList.toggle('llena', sobra);
      const i = barra?.querySelector<HTMLElement>('i');
      if (i) i.style.width = `${capacidad > 0 ? Math.min(100, (total / capacidad) * 100).toFixed(1) : 0}%`;
      const cifras = caja.querySelector<HTMLElement>('.escolta-cifras');
      if (cifras) cifras.innerHTML = `<strong>${total}/${capacidad}</strong> de carga${sobra ? ` · sobran ${total - capacidad}` : ''}`;
      if (boton && !sinDestino) { boton.disabled = sobra; boton.title = sobra ? 'Lleva más de lo que cabe en la caravana.' : ''; }
    };
    entradas.forEach((x) => x.addEventListener('input', actualizar));
    actualizar();
  });
  raiz.querySelectorAll<HTMLInputElement>('[data-reservar]').forEach((c) => c.addEventListener('change', async () => {
    const mensaje = await ejecutar('reservarCaravana', { caravanaId: c.dataset.reservar!, reservada: c.checked });
    if (mensaje !== null) { c.checked = !c.checked; mostrarAviso(mensaje, true); }
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-preparar]').forEach((b) => b.addEventListener('click', () => {
    const caravanaId = b.dataset.preparar!;
    const carga = Object.fromEntries(
      Array.from(raiz.querySelectorAll<HTMLInputElement>('input[data-viaje-carga]'))
        .filter((i) => i.dataset.viajeCarga!.startsWith(`${caravanaId}:`))
        .map((i) => [i.dataset.viajeCarga!.slice(caravanaId.length + 1), Number(i.value)] as const)
        .filter(([, n]) => n > 0)
    );
    void lanzar(b, 'prepararCaravana', { caravanaId, heroeId: p.heroeId, destinoAsentamientoId: valor(`[data-viaje-destino="${caravanaId}"]`), carga });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-cancelar-caravana]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'cancelarCaravana', { caravanaId: b.dataset.cancelarCaravana! })));

  // El nombre: ✎ abre el campo; Intro o ✓ lo guarda (vacío la deja sin nombre), Esc o ✕ lo deja como estaba.
  raiz.querySelectorAll<HTMLButtonElement>('[data-caravana-renombrar]').forEach((b) => b.addEventListener('click', () => {
    caravanaRenombrando = b.dataset.caravanaRenombrar!;
    repintar();
    const campo = raiz.querySelector<HTMLInputElement>(`[data-caravana-nombre="${CSS.escape(caravanaRenombrando)}"]`);
    campo?.focus();
    campo?.select();
  }));
  const cerrarNombre = (): void => { caravanaRenombrando = null; olvidarEdicion(raiz); repintar(); };
  const guardarNombre = async (caravanaId: string, boton?: HTMLButtonElement): Promise<void> => {
    const campo = raiz.querySelector<HTMLInputElement>(`[data-caravana-nombre="${CSS.escape(caravanaId)}"]`);
    if (boton) boton.disabled = true;
    const mensaje = await ejecutar('renombrarCaravana', { caravanaId, nombre: (campo?.value ?? '').trim() });
    if (boton) boton.disabled = false;
    if (mensaje) { mostrarAviso(mensaje, true); return; }
    cerrarNombre();
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-caravana-guardar]').forEach((b) => b.addEventListener('click', () => void guardarNombre(b.dataset.caravanaGuardar!, b)));
  raiz.querySelector('[data-caravana-cancelar]')?.addEventListener('click', cerrarNombre);
  raiz.querySelectorAll<HTMLInputElement>('[data-caravana-nombre]').forEach((campo) => campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); void guardarNombre(campo.dataset.caravanaNombre!); }
    else if (ev.key === 'Escape') { ev.stopPropagation(); cerrarNombre(); }
  }));

  // La vista de flota: elegir caravana, un carro de la tira, abrir «añadir carro» o ceder escolta, y Viaje o Encargo.
  raiz.querySelectorAll<HTMLButtonElement>('[data-flota-elegir]').forEach((b) => b.addEventListener('click', () => { caravanaElegida = b.dataset.flotaElegir!; carroElegido = null; repintar(); }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro-elegir]').forEach((b) => b.addEventListener('click', () => {
    carroElegido = carroElegido === b.dataset.carroElegir ? null : b.dataset.carroElegir!;
    repintar();
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro-mas]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.carroMas!;
    if (carroNuevoAbierto.has(id)) carroNuevoAbierto.delete(id); else carroNuevoAbierto.add(id);
    repintar();
  }));
  raiz.querySelectorAll<HTMLInputElement>('[data-carro-nuevo-tipo], [data-carro-nuevo-animal]').forEach((r) => r.addEventListener('change', () => {
    const id = r.dataset.carroNuevoTipo ?? r.dataset.carroNuevoAnimal!;
    const x = { ...(carroNuevoEleccion.get(id) ?? {}) };
    if (r.dataset.carroNuevoTipo) x.tipo = r.value; else x.animal = r.value;
    carroNuevoEleccion.set(id, x);
    repintar();
  }));
  // Agregar: el carro y, en cuanto está, su animal (el carro nuevo va al final de la tira); hecho, el panel se cierra.
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro-agregar]').forEach((b) => b.addEventListener('click', async () => {
    const caravanaId = b.dataset.carroAgregar!;
    const indice = p.caravanas.find((c) => c.id === caravanaId)?.carros?.length ?? 0;
    b.disabled = true;
    const sinCarro = await ejecutar('agregarCarroCaravana', { caravanaId, tipoCarro: b.dataset.tipo });
    if (sinCarro) { b.disabled = false; mostrarAviso(sinCarro, true); return; }
    const sinAnimal = await ejecutar('comprarAnimalCaravana', { caravanaId, carroIndice: indice, tipoAnimal: b.dataset.animal });
    if (sinAnimal) mostrarAviso(`El carro está, pero sin animal: ${sinAnimal}`, true);
    carroNuevoAbierto.delete(caravanaId);
    repintar();
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-caravana-modo]').forEach((b) => b.addEventListener('click', () => {
    const [id, modo] = b.dataset.caravanaModo!.split(':');
    modoCaravana.set(id!, modo as 'viaje' | 'encargo');
    repintar();
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-escolta-mas]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.escoltaMas!;
    if (escoltaAbierta.has(id)) escoltaAbierta.delete(id); else escoltaAbierta.add(id);
    repintar();
  }));

  cablearEscolta(raiz, p, ejecutar);
  cablearEncargo(raiz, p, ejecutar, repintar);

  // Aparcadas: pasar carga entre su carro y el almacén de esta plaza, o mandarla a su origen.
  const base = { heroeId: p.heroeId, asentamientoId: a.id };
  raiz.querySelectorAll<HTMLButtonElement>('[data-aparcada-mover]').forEach((b) => b.addEventListener('click', () => {
    const [caravanaId, sentido] = b.dataset.aparcadaMover!.split(':');
    const recurso = valor(`[data-aparcada-recurso="${caravanaId}"]`);
    const cantidad = Number(raiz.querySelector<HTMLInputElement>(`[data-aparcada-cantidad="${caravanaId}"]`)?.value);
    if (!recurso || !(cantidad >= 1)) { mostrarAviso('Elige un recurso y una cantidad de 1 o más.', true); return; }
    void lanzar(b, 'moverCargaCaravanaAparcada', { ...base, caravanaId, recurso, cantidad, sentido });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-aparcada-origen]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'enviarCaravanaAlOrigen', { ...base, caravanaId: b.dataset.aparcadaOrigen! })));
}
