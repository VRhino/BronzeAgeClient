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
import { iconoEnFila } from './iconosTropa';
import { cablearEncargo, htmlEncargo } from './encargoCaravana';
import { mostrar as mostrarAviso } from './avisos';
import { ICONO_CARRETA } from './juegoVisual';
import { iconoRitmo, velocidadDePiezas } from './velocidadColumna';

type Escapar = (valor: string) => string;

const RECURSOS_ORDEN = Object.keys(RECURSO_NOMBRE).filter((r) => r !== 'oro');
const ESTADO: Record<string, string> = {
  disponible: 'parada',
  preparando: 'preparándose',
  adjunta: 'enganchada a un ejército',
  aparcada: 'aparcada',
  en_transito: 'en camino',
  retornando: 'de vuelta',
  esperando: 'con encargo, en una parada',
};
const ESTADO_ICONO: Record<string, string> = { disponible: '⚓', preparando: '⏳', adjunta: '🔗', aparcada: '🅿️', en_transito: '➜', retornando: '↩', esperando: '⌛' };
const CARRO: Record<string, string> = { basico: 'Carro básico', reforzado: 'Carro reforzado' };
const ANIMAL: Record<string, string> = { buey: 'Buey', caballo: 'Caballo', camello: 'Camello' };
const ANIMAL_ICONO: Record<string, string> = { buey: '🐂', caballo: '🐎', camello: '🐪' };

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
  return `<div class="obra-titulo"><span class="faction-kicker">Órdenes de mercado</span><span class="obra-chip" title="Oro de la plaza">🪙 ${hay('oro')}</span>${info}</div>
    ${boletaHtml}
    <div class="obra-titulo"><span class="faction-kicker">En pie</span><span class="obra-chip">${mias.length}</span></div>
    ${mias.length === 0 ? '<p class="mapa-lista-vacia">No hay órdenes en pie.</p>' : `<div class="orden-fichas">${mias.map(ficha).join('')}</div>`}`;
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
const atributosApagado = (motivo: string | null, e: Escapar): string => (motivo ? ` disabled title="${e(motivo)}"` : '');

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

function tarjeta(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, flota: Caravana[], almacen: Record<string, number>, carrosLleno: boolean, d: DatosCaravana | null, e: Escapar): string {
  const estado = c.estado ?? 'disponible';
  const aparcadaAqui = estado === 'aparcada' && c.origenAsentamientoId !== a.id;
  const destino = aparcadaAqui ? `de ${e(nombrePlaza(p, c.origenAsentamientoId))}` : c.destinoAsentamientoId ? `→ ${e(nombrePlaza(p, c.destinoAsentamientoId))}` : '';
  const etiqueta = aparcadaAqui ? 'aparcada aquí' : (ESTADO[estado] ?? e(estado));
  const titulo = `<span class="caravana-icono">${ICONO_CARRETA}</span><span class="caravana-titulo"><strong>Caravana ${e(c.id)}</strong>${destino ? `<small>${destino}</small>` : ''}</span><span class="caravana-estado ${e(estado)}">${ESTADO_ICONO[estado] ?? ''} ${etiqueta}</span>`;
  if (aparcadaAqui) return `<div class="caravana-tarjeta ${e(estado)}"><div class="caravana-cab">${titulo}</div>${cuerpoAparcada(c, a, p, e)}</div>`;

  const carros = c.carros ?? [];
  const parada = estado === 'disponible' && c.origenAsentamientoId === a.id;
  const otras = flota.filter((x) => x.id !== c.id && (x.estado ?? 'disponible') === 'disponible');
  const motivoLleno = carrosLleno ? 'La flota ya tiene el tope de carros de tu Mercado.' : null;
  const motivoReside = reside ? null : 'Solo quien reside en esta plaza maneja la flota.';
  const motivoCarro = (tipo: string): string | null => {
    const def = d?.cat.carros[tipo];
    if (motivoReside || motivoLleno || !def) return motivoReside ?? motivoLleno;
    if (def.fabrica !== 'mercado' && !a.edificios.some((x) => x.tipo === def.fabrica && x.estado === 'activo')) return `Hace falta tener ${EDIFICIO_NOMBRE[def.fabrica] ?? def.fabrica} en funcionamiento.`;
    return motivoCosto(def.costo, almacen);
  };
  const botonCarro = (tipo: 'basico' | 'reforzado'): string => {
    const def = d?.cat.carros[tipo];
    const info = def ? ` (capacidad ${def.capacidadBase})` : '';
    const m = motivoCarro(tipo);
    return `<button class="btn-secondary btn-chico" type="button" data-carro-nuevo="${e(c.id)}:${tipo}"${m ? ` disabled title="${e(m)}"` : ` title="${e(`${CARRO[tipo]}${info}`)}"`}>＋ ${tipo === 'basico' ? 'Básico' : 'Reforzado'}${def ? ` · ${iconos(def.costo)}` : ''}</button>`;
  };
  // Capacidad y velocidad de la caravana: solo cuentan los carros con animal (Doc 3.13.1); las políticas de la plaza las multiplican.
  const tira = carros.filter((r) => r.animal && d?.cat.carros[r.tipoCarro] && d.cat.animales[r.animal]);
  const capacidad = d ? Math.floor(tira.reduce((t, r) => t + d.cat.carros[r.tipoCarro]!.capacidadBase * d.cat.animales[r.animal!]!.factorCarga, 0) * d.fCapacidad) : 0;
  const velocidad = d && tira.length > 0 ? Math.min(...tira.map((r) => d.cat.animales[r.animal!]!.velocidad)) * d.fVelocidad : 0;
  const preparacion = d ? textoEnTiempoReal(d.cat.preparacionKPorCarro * Math.max(0, carros.length - 1) * 60_000) : '';
  const politicas = d && (d.fCapacidad !== 1 || d.fVelocidad !== 1) ? ' title="Con las políticas de la plaza"' : '';
  const ritmo = tira.length > 0 ? velocidadDePiezas([{ nombre: 'la caravana', velocidad }]) : null;
  const chips = `<div class="caravana-chips"${politicas}>
      <span title="Lo que puede llevar: solo cuentan los carros con animal"><i>📦</i><strong>${d ? capacidad : '?'}</strong><small>carga</small></span>
      <span class="ritmo-${ritmo?.ritmo ?? 'ligera'}" title="Velocidad: la del animal más lento${ritmo?.ritmo ? ` (rojo: más lenta que la infantería ligera; blanco: igual; azul: más rápida)` : ''}"><i>${ritmo ? iconoRitmo(ritmo, 12) : '🐾'}</i><strong>${tira.length > 0 ? Math.round(velocidad * 10) / 10 : '—'}</strong><small>velocidad</small></span>
      <span title="Tiempo de preparación antes de salir"><i>⏱</i><strong>${carros.length > 1 ? preparacion : 'ya'}</strong><small>preparar</small></span>
      <span title="Carros con animal / carros"><i>🛞</i><strong>${tira.length}/${carros.length}</strong><small>tiran</small></span>
    </div>`;

  const opcionesAnimal = (): string => Object.entries(d?.cat.animales ?? {}).map(([id, an]) => {
    const m = motivoCosto(an.costo, almacen);
    return `<option value="${e(id)}"${m ? ' disabled' : ''} title="×${an.factorCarga} de carga · velocidad ${an.velocidad}">${ANIMAL_ICONO[id] ?? ''} ${e(ANIMAL[id] ?? id)} · ${iconos(an.costo)} · ×${an.factorCarga} · vel. ${an.velocidad}</option>`;
  }).join('');
  const motivoAnimal = motivoReside ?? (d && Object.values(d.cat.animales).every((an) => motivoCosto(an.costo, almacen)) ? 'No te llega para ningún animal.' : null);
  const filaCarro = (r: NonNullable<Caravana['carros']>[number], i: number): string => {
    const def = d?.cat.carros[r.tipoCarro];
    const an = r.animal ? d?.cat.animales[r.animal] : undefined;
    const cap = def ? Math.floor(def.capacidadBase * (an?.factorCarga ?? 0) * (d?.fCapacidad ?? 1)) : null;
    const animal = r.animal
      ? `<span class="carro-animal"><b>${e(ANIMAL[r.animal] ?? r.animal)}</b>${cap !== null ? `<small>📦 ${cap}</small>` : ''}</span>`
      : parada && reside
        ? `<span class="carro-animal falta"><select class="form-input" data-animal-tipo="${e(c.id)}:${i}">${d ? opcionesAnimal() : '<option value="buey">Buey</option><option value="caballo">Caballo</option><option value="camello">Camello</option>'}</select><button class="btn-secondary btn-chico" type="button" data-animal="${e(c.id)}" data-carro="${i}"${atributosApagado(motivoAnimal, e)}>Comprar</button></span>`
        : '<span class="carro-animal falta">sin animal: no tira</span>';
    const mover = parada && reside && otras.length > 0
      ? `<select class="form-input carro-mover" data-mover-a="${e(c.id)}:${i}" title="Pasar este carro a otra caravana parada"><option value="">⇄ Mover…</option>${otras.map((x) => `<option value="${e(x.id)}">a ${e(x.id)}</option>`).join('')}</select>`
      : '';
    return `<div class="carro-row${r.animal ? ' tira' : ' sin-animal'}"><span class="carro-slot" title="${e(CARRO[r.tipoCarro] ?? r.tipoCarro)}${def ? ` · capacidad ${def.capacidadBase}` : ''}${r.animal ? ` · ${ANIMAL[r.animal] ?? r.animal}` : ' · sin animal'}"><span aria-hidden="true">${r.animal ? ANIMAL_ICONO[r.animal] ?? '🐾' : '∅'}</span><i>${r.tipoCarro === 'reforzado' ? 'R' : 'B'}</i></span>
      <span class="carro-tipo">${e(r.tipoCarro === 'reforzado' ? 'Reforzado' : r.tipoCarro === 'basico' ? 'Básico' : r.tipoCarro)}</span>${animal}${mover}</div>`;
  };
  const carrosHtml = `<div class="caravana-seccion">
      <div class="caravana-seccion-cab"><strong class="heroe-sub">Carros</strong>${parada && reside ? `<span class="caravana-botones">${botonCarro('basico')}${botonCarro('reforzado')}</span>` : ''}</div>
      ${carros.length === 0 ? '<p class="asent-lado-nota">Casco vacío: no sale hasta que le montes un carro con su animal.</p>' : `<div class="carro-lista">${carros.map(filaCarro).join('')}</div>`}
      ${parada && reside && tira.length < carros.length ? '<p class="asent-lado-nota">Un carro sin animal no tira ni carga: cómprale uno.</p>' : ''}
    </div>`;

  let viaje = '';
  if (parada && reside) {
    const destinos = [...p.asentamientosAvistados.map((x) => ({ id: x.id, nombre: x.nombre, faccionId: x.faccionId })), ...p.asentamientosConocidos.map((x) => ({ id: x.asentamientoId, nombre: x.nombre, faccionId: x.faccionId }))]
      .filter((x, i, l) => x.id !== a.id && l.findIndex((y) => y.id === x.id) === i);
    const filas = Object.entries(almacen).filter(([r, n]) => n >= 1 && r !== 'oro');
    viaje = tira.length === 0 ? '<div class="caravana-seccion"><strong class="heroe-sub">Viaje</strong><p class="asent-lado-nota">Ponle un animal a un carro para poder cargarla y lanzarla.</p></div>'
      : `<div class="caravana-seccion">
        <div class="caravana-seccion-cab"><strong class="heroe-sub">Viaje</strong><select class="form-input viaje-destino" data-viaje-destino="${e(c.id)}">${destinos.length === 0 ? '<option value="">— no conoces otra plaza —</option>' : destinos.map((x) => `<option value="${e(x.id)}">${e(x.nombre ?? x.id)}${x.faccionId === p.faccionId ? ' (tuya)' : ''}</option>`).join('')}</select></div>
        ${filas.length === 0 ? '<p class="asent-lado-nota">No hay nada que cargar en el almacén.</p>' : `<div class="carga-grid">${filas.map(([r, n]) => `<label class="carga-celda" title="${e(RECURSO_NOMBRE[r] ?? r)}: hay ${Math.floor(n)} en el almacén"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-viaje-carga="${e(c.id)}:${e(r)}" /><small>/${Math.floor(n)}</small></label>`).join('')}</div>`}
        <div class="carga-total" data-carga-total="${e(c.id)}" data-capacidad="${capacidad}"><div class="escolta-barra"><i style="width:0%"></i></div><small class="escolta-cifras"><strong>0/${capacidad}</strong> de carga</small></div>
        <button class="btn-primary btn-chico" type="button" data-preparar="${e(c.id)}"${destinos.length === 0 ? ' disabled title="No conoces otra plaza"' : ''}>${carros.length > 1 ? `Preparar (${preparacion}) y lanzar` : 'Lanzar ya'}</button>
      </div>`;
  } else if (estado === 'preparando') {
    viaje = `<div class="caravana-seccion"><p class="asent-lado-nota">Sale en ${c.preparaHasta ? falta(c.preparaHasta, p) : 'un momento'}.</p>${reside ? `<button class="btn-secondary btn-chico" type="button" data-cancelar-caravana="${e(c.id)}">Cancelar preparación</button>` : ''}</div>`;
  }
  const reservar = parada ? `<label class="interruptor caravana-reservar" title="Reservada: la plaza no la usa en sus envíos automáticos; sin reservar, una caravana con animal puede salir sola en el reparto"><input type="checkbox" data-reservar="${e(c.id)}"${c.reservadaManual ? ' checked' : ''}${reside ? '' : ' disabled'} /><span class="interruptor-pista" aria-hidden="true"><i></i></span><span>Reservada</span></label>` : '';
  return `<div class="caravana-tarjeta ${e(estado)}">
    <div class="caravana-cab">${titulo}${reservar}</div>
    ${chips}${carrosHtml}${viaje}${htmlEncargo(c, p, a, reside, capacidad, tira.length > 0, e)}
    <div class="caravana-seccion">${escolta(c, p, reside, parada || (estado === 'esperando' && c.encargo?.paradaActual === 'origen'), d?.escoltaPts, e)}</div></div>`;
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
  // Topes de la flota (Doc 3.13.2): los pone el nivel interno del Mercado y vienen en el balance; el servidor sigue siendo quien rechaza.
  const nivelMercado = Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === 'mercado' && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
  const cupo = nivelMercado > 0 ? cupoDeFlota(nivelMercado, alCargar) : null;
  const carros = flota.reduce((t, c) => t + (c.carros?.length ?? 0), 0);
  const carrosLleno = cupo?.carros !== undefined && carros >= cupo.carros;
  const flotaLlena = cupo?.caravanas !== undefined && flota.length >= cupo.caravanas;
  const cat = catalogoDeCaravanas(alCargar);
  const politicas = catalogoDePoliticas(alCargar)?.catalogo ?? [];
  const factor = (campo: string): number => (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.[campo]; return typeof v === 'number' ? t * v : t; }, 1);
  const datos: DatosCaravana | null = cat ? { cat, fCapacidad: factor('factorCapacidadCaravana'), fVelocidad: factor('factorVelocidadCaravana'), escoltaPts: nivelMercado > 0 ? cat.escoltaPorNivelMercado[nivelMercado - 1] : undefined } : null;
  const pips = (usadas: number, tope: number | undefined, clase: string): string => tope === undefined ? `<b>${usadas}</b>`
    : `<span class="flota-pips ${clase}">${Array.from({ length: Math.max(tope, usadas) }, (_, i) => `<i class="${i < usadas ? 'usada' : ''}"></i>`).join('')}</span><b>${usadas}/${tope}</b>`;
  const topes = cupo ? `<span class="flota-cupo" title="Caravanas de la flota sobre el tope de tu Mercado"><small>Caravanas</small>${pips(flota.length, cupo.caravanas, 'caravanas')}</span>
    <span class="flota-cupo" title="Carros de la flota sobre el tope de tu Mercado"><small>Carros</small>${pips(carros, cupo.carros, 'carros')}</span>
    ${datos?.escoltaPts !== undefined ? `<span class="obra-chip" title="Liderazgo de escolta por caravana">♛ ${datos.escoltaPts}</span>` : ''}` : '';
  // Entre dos caravanas creadas hay una espera (`CARAVANA_COOLDOWN`), compartida con la fundación.
  const listaEn = cat && a.ultimaCaravanaCreadaEn ? a.ultimaCaravanaCreadaEn + cat.cooldownMinutos * 60_000 : 0;
  const motivoCrear = nivelMercado === 0 ? 'Hace falta un Mercado activo.' : flotaLlena ? 'La flota ya tiene el tope de caravanas de tu Mercado.' : listaEn > p.instante ? `Podrás crear otra en ${falta(listaEn, p)}.` : null;
  const info = ayuda('mercado:caravanas', 'Tu flota: un casco se arma con carros (que pagas con materiales del almacén) y un animal por carro, y sale a mano hacia otra plaza con la carga que elijas. Solo cuentan los carros con animal. El cupo de flota y los costes los decide el servidor. Los carros se reparten como quieras entre las caravanas; mover un carro no gasta cupo.<br>La carga sale del almacén al prepararla; si la cancelas antes de salir, vuelve entera.<br><strong>Escolta:</strong> cede escuadras de tu campamento a una caravana parada en su origen: viajarán con ella y volverán al campamento al acabar el viaje. El cupo es de la caravana, en puntos de Liderazgo (lo da tu Mercado) y lo comparten los residentes; ceder no gasta tu Liderazgo.<br><strong>Aparcadas:</strong> caravanas de tu Facción que un ejército dejó aquí al entrar. No las usa esta plaza: puedes pasar carga entre su carro y el almacén, y solo salen enganchadas a un ejército (desde el panel del ejército) o enviadas a su origen. Vacía, aparece en su origen al instante; con carga, vuelve por el camino y la deja allí al llegar.');
  return `<div class="obra-titulo"><span class="faction-kicker">Caravanas comerciales</span>${info}</div>
    <div class="flota-cab">
      <span class="flota-icono">${iconoEdificio('mercado', 32)}</span>
      <span class="flota-cuerpo"><strong>${nivelMercado > 0 ? `Mercado nivel ${nivelMercado}` : 'Sin Mercado activo'}</strong><span class="flota-cupos">${topes}</span></span>
      ${reside ? `<button class="flota-crear" type="button" data-caravana-crear${motivoCrear ? ` disabled title="${e(motivoCrear)}"` : ' title="Crear una caravana nueva (un casco vacío)"'}>＋ Crear</button>` : ''}
    </div>
    ${reside ? (motivoCrear ? `<p class="asent-lado-nota">${e(motivoCrear)}</p>` : '') : '<p class="asent-lado-nota">Solo quien reside en esta plaza maneja la flota.</p>'}
    ${flota.length + aparcadas.length === 0 ? '<p class="mapa-lista-vacia">No hay caravanas en esta plaza.</p>' : [...flota, ...aparcadas].map((c) => tarjeta(c, p, a, reside, flota, almacen, carrosLleno, datos, e)).join('')}`;
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
