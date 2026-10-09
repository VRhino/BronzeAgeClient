// Pantalla CAMPAMENTO (backend 2026-10-04, Doc 1.9b): el héroe nace DENTRO de un campamento de mercenarios y vuelve a él.
// Se organiza como la del asentamiento: la planta a la izquierda y, a la derecha, subpestañas (Resumen · Salir · Tropa · Mercado ·
// Fondo · Taberna) en vez de una sola columna larga. Aquí no se decide ninguna regla: quien valida es el backend, y su rechazo sale
// tal cual en `#camp-error`. Los menús del jugador (héroe, escuadras, Facción) están en la barra superior (`barraJugador.ts`).
import { chipLiderazgo } from './liderazgo';
import { cablearPreparacion, htmlPreparacion } from './convocatoria';
import { actualizarConvocatorias, cablearSalidaComoEjercito, htmlSalidaComoEjercito } from './salidaComoEjercito';
import { cablearCargaDeSalida, htmlCargaDeSalida, leerCarga } from './cargaDeSalida';
import { costoDeRefundacion, tropasDeCampamento, unidadesDeTropa, type ProyeccionJugador } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { CampamentoMercenarios, Escuadron } from '../tiposDominio';

/** Manda el comando y refresca; devuelve el mensaje de error o `null`. Lo pone `main.ts`. */
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;
type Escapar = (valor: string) => string;

export type SeccionCampamento = 'resumen' | 'salir' | 'tropa' | 'mercado' | 'fondo' | 'taberna';

const ETIQUETA: Record<SeccionCampamento, string> = { resumen: 'Resumen', salir: 'Salir', tropa: 'Tropa', mercado: 'Mercado', fondo: 'Fondo', taberna: 'Taberna' };

/** Las tres tropas de leva comunal que presta el campamento (backend `TROPAS_RECLUTABLES`, tecnología `leva_comunal`). */
const TROPAS_PRESTAMO: [string, string][] = [['milicia_lanceros', 'Milicia de lanceros'], ['lenadores', 'Leñadores'], ['granjeros', 'Granjeros']];

const nombreRecurso = (r: string): string => RECURSO_NOMBRE[r] ?? r;

/** De dónde sale el oro de «Reclutar»: vive entre repintados, como el bien elegido del mercado. */
let pagarConElegido: 'almacenPersonal' | 'carro' = 'almacenPersonal';
const EDIFICIO_RECLUTA: Record<string, string> = { barracon: 'Barracón', galeriaDeTiro: 'Galería de tiro', caballerizas: 'Caballerizas' };

export function campamentoActual(proyeccion: ProyeccionJugador): CampamentoMercenarios | undefined {
  const u = proyeccion.heroe.ubicacion;
  return u.tipo === 'mercenarios' ? proyeccion.campamentosMercenarios.find((c) => c.id === u.campamentoId) : undefined;
}

/** ¿Tiene tu Facción algún asentamiento a la vista o en memoria? Sin ninguno, el campamento le vende la Caravana de Fundación. */
function faccionConPlaza(p: ProyeccionJugador): boolean {
  return p.asentamientos.length > 0 || [...p.asentamientosAvistados, ...p.asentamientosConocidos].some((a) => a.faccionId === p.faccionId);
}

/** Las subpestañas que hay ahora: el Fondo de refundación solo aparece mientras tu Facción no tiene plaza. */
export function seccionesDeCampamento(p: ProyeccionJugador): { id: SeccionCampamento; etiqueta: string }[] {
  const ids: SeccionCampamento[] = ['resumen', 'salir', 'tropa', 'mercado', ...(p.faccionId !== null && !faccionConPlaza(p) ? ['fondo' as const] : []), 'taberna'];
  return ids.map((id) => ({ id, etiqueta: ETIQUETA[id] }));
}

function listaRecursos(recursos: Record<string, number>, e: Escapar): string {
  const filas = Object.entries(recursos).filter(([, n]) => n > 0);
  return filas.length > 0
    ? `<div class="asent-ficha-grid">${filas.map(([r, n]) => `<div><span>${e(nombreRecurso(r))}</span><strong>${Math.floor(n)}</strong></div>`).join('')}</div>`
    : '<p class="asent-lado-nota">Nada.</p>';
}

/** Dónde está una escuadra, dicho como lo entiende el jugador: la tropa de una columna aparcada en la puerta NO está «en el campamento». */
function dondeEstaLaEscuadra(s: Escuadron, p: ProyeccionJugador): string {
  const c = s.contenedor;
  if (c.tipo === 'campamento') return 'en el campamento';
  if (c.tipo === 'escolta') return 'escoltando una caravana';
  if (c.tipo === 'fuera') return 'fuera del mundo';
  const columna = p.ejercitos.find((x) => x.id === c.ejercitoId);
  return columna?.estado === 'estacionado' ? 'en tu columna, aparcada en la puerta' : 'en tu columna';
}

function filaEscuadra(s: Escuadron, p: ProyeccionJugador, e: Escapar): string {
  return `<div class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}</div><span>${s.cantidad} hombres · ${dondeEstaLaEscuadra(s, p)}${s.prestada ? ' · prestada' : ''}</span></div>`;
}

function resumen(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const edificios = [...new Set(c.edificios)].map((t) => EDIFICIO_NOMBRE[t] ?? t);
  return `
    <div class="asent-ficha-grid">
      <div><span>Residentes</span><strong>${c.residentesIds.length}</strong></div>
      <div><span>Oro de botín</span><strong>${Math.floor(heroe.oroDeBotin ?? 0)}</strong></div>
    </div>
    ${resides
      ? '<p class="asent-lado-nota">Este campamento es tu residencia: aquí guardas tu almacén, te prestan tropa y compras en el mercado completo.</p>'
      : '<button class="btn-secondary" type="button" id="btn-residir">Residir aquí</button><p class="asent-lado-nota">No resides aquí: sales con la columna con la que entraste y solo te venden trigo. Si te mudas, la tropa prestada por tu campamento anterior se te retira.</p>'}
    ${p.faccionId === null ? '<p class="asent-lado-nota">Aún no tienes Facción: abre «Facción» en la barra de arriba para crear una o pedir ingreso.</p>' : ''}
    <strong class="heroe-sub">Tu tropa</strong>
    ${heroe.escuadrones.length > 0 ? `<div class="mapa-lista">${heroe.escuadrones.map((s) => filaEscuadra(s, p, e)).join('')}</div>` : '<p class="asent-lado-nota">No tienes tropa. En la pestaña Tropa te prestan una.</p>'}
    <strong class="heroe-sub">Tu almacén</strong>
    ${listaRecursos(heroe.almacenPersonal ?? {}, e)}
    <strong class="heroe-sub">Edificios del campamento</strong>
    <p class="asent-lado-nota">${edificios.map(e).join(' · ') || 'Ninguno.'}</p>`;
}

function salir(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const almacen = heroe.almacenPersonal ?? {};
  const enCampamento = heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento');
  const aparcadas = heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito');
  // En un ejército en preparación solo se ve ese panel: mientras tanto el backend rechaza cualquier otra salida.
  const preparacion = htmlPreparacion(p, e);
  if (preparacion) return preparacion;
  if (!resides) {
    return `<p class="asent-lado-nota">Sales con la columna con la que entraste, tal cual${aparcadas.length > 0 ? `: ${aparcadas.map((s) => `${e(s.nombre)} (${s.cantidad})`).join(', ')}` : ''}.</p>
      ${htmlSalidaComoEjercito(p, e)}
      <button class="btn-primary" type="button" id="btn-salir-campamento">Salir</button>`;
  }
  return `
    <p class="asent-lado-nota">Elige la tropa que sacas y lo que cargas de tu almacén. La ración gratis de trigo llena tus víveres, que van siempre contigo.</p>
    <div class="mapa-lista">${enCampamento.length > 0
      ? enCampamento.map((s) => `<label class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div><input type="checkbox" data-salir-escuadra="${e(s.id)}" checked /></label>`).join('')
      : '<p class="asent-lado-nota">No tienes tropa en el campamento.</p>'}</div>
    ${htmlSalidaComoEjercito(p, e)}
    ${htmlCargaDeSalida(almacen, 'tu almacén personal', e)}
    <p class="asent-lado-nota">Al volver a entrar en un campamento, lo que quede en el carro regresa solo a tu almacén personal. Tus víveres no se descargan.</p>
    <button class="btn-primary" type="button" id="btn-salir-campamento">Salir</button>`;
}

/**
 * RECLUTAR (backend 2026-10-02, Doc 1.9b): las tropas de los edificios militares del campamento, pagadas SOLO con oro y con la población del
 * campamento. Qué tecnología tiene desbloqueada el campamento, cuántos reclutas le quedan y el precio final (escalón + caballos + equipo, recargo,
 * reputación, descuento sin plazas) no viajan en la proyección ni en el balance: lo dice el servidor al rechazar o al cobrar.
 */
function reclutar(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const catalogo = tropasDeCampamento();
  if (!catalogo) return '<p class="asent-lado-nota">Cargando las tropas…</p>';
  const ofrecidas = catalogo.tropas.filter((t) => t.edificio !== 'centroUrbano' && c.edificios.includes(t.edificio) && t.nivelRequerido <= catalogo.nivelEdificios);
  if (ofrecidas.length === 0) return '<p class="asent-lado-nota">Este campamento no tiene barracón, galería de tiro ni caballerizas: no ofrece tropa.</p>';
  const propias = new Map(heroe.escuadrones.filter((s) => !s.prestada).map((s) => [s.tropaId, s] as const));
  const columna = p.ejercitos.find((x) => x.liderId === heroe.id);
  const oroAlmacen = Math.floor(heroe.almacenPersonal?.['oro'] ?? 0);
  const oroCarro = Math.floor(columna?.suministro?.['oro'] ?? 0);
  if (pagarConElegido === 'carro' && !columna) pagarConElegido = 'almacenPersonal';
  const equipo = (t: (typeof ofrecidas)[number]): string =>
    [...Object.entries(t.costoEquipo).map(([r, n]) => `${n} ${nombreRecurso(r)}`), ...(t.caballos ? [`${t.caballos} caballo${t.caballos > 1 ? 's' : ''}`] : [])].join(', ') || 'sin equipo';
  const filas = ofrecidas.map((t) => {
    const ya = propias.get(t.id);
    const faltan = t.unidadesPorDefecto - (ya?.cantidad ?? 0);
    return `<div class="mapa-lista-item"><div><strong>${e(t.nombre)}</strong>
        <span>${e(EDIFICIO_RECLUTA[t.edificio] ?? t.edificio)} · ${t.unidadesPorDefecto} hombres · escalón ${t.escalon} · equipo (se cobra en oro): ${e(equipo(t))}</span>
        <span>${ya ? `ya la tienes: ${ya.cantidad}/${t.unidadesPorDefecto}, ${dondeEstaLaEscuadra(ya, p)}` : 'aún no la tienes'}</span></div>
      <button class="btn-secondary" type="button" data-reclutar="${e(t.id)}"${faltan <= 0 ? ' disabled' : ''}>${ya ? (faltan > 0 ? `Reponer ${faltan}` : 'Completa') : 'Reclutar'}</button></div>`;
  }).join('');
  return `
    <p class="asent-lado-nota">Se paga solo con oro y con los reclutas del campamento. Solo hay una escuadra por tropa: si ya la tienes, se repone hasta el tope y se cobra lo que falta (la de una columna, con la columna a la puerta). Qué tropas están desbloqueadas lo decide el campamento: si aún no, el servidor lo dirá.</p>
    <label class="mapa-lista-item"><span>Pagar con</span>
      <select class="form-input" id="reclutar-pagar-con">
        <option value="almacenPersonal"${pagarConElegido === 'almacenPersonal' ? ' selected' : ''}>Mi almacén personal (${oroAlmacen} de oro)</option>
        ${columna ? `<option value="carro"${pagarConElegido === 'carro' ? ' selected' : ''}>El carro de mi columna (${oroCarro} de oro; a la puerta)</option>` : ''}
      </select></label>
    <div class="mapa-lista">${filas}</div>`;
}

function tropa(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  if (!c.residentesIds.includes(heroe.id)) return '<p class="asent-lado-nota">Solo se presta o se recluta tropa en el campamento donde resides: pulsa «Residir aquí» en Resumen.</p>';
  const prestadas = new Map(heroe.escuadrones.filter((s) => s.prestada).map((s) => [s.tropaId, s] as const));
  return `
    <strong class="heroe-sub">Reclutar</strong>
    ${reclutar(p, c, e)}
    <strong class="heroe-sub">Tropa prestada</strong>
    <p class="asent-lado-nota">Gratis, para aprender a usar tropa antes de tener la tuya. No gana experiencia. Se retira si dejas de residir en este campamento.</p>
    <div class="mapa-lista">${TROPAS_PRESTAMO.map(([id, nombre]) => {
      const ya = prestadas.get(id);
      return `<label class="mapa-lista-item"><div><strong>${nombre}</strong><span>${ya ? `ya la tienes: ${ya.cantidad} hombres, ${dondeEstaLaEscuadra(ya, p)}` : `${unidadesDeTropa(id, () => { /* se pinta con el siguiente sondeo */ }) ?? '?'} hombres`}</span></div><input type="checkbox" data-prestamo="${id}"${ya ? ' disabled' : ''} /></label>`;
    }).join('')}</div>
    <div class="mapa-seleccion-acciones">
      <button class="btn-secondary" type="button" id="btn-pedir-prestamo">Pedir</button>
      ${prestadas.size > 0 ? '<button class="btn-secondary" type="button" id="btn-reponer-prestamo">Reponer bajas</button>' : ''}
    </div>
    <strong class="heroe-sub">Toda tu tropa</strong>
    ${heroe.escuadrones.length > 0 ? `<div class="mapa-lista">${heroe.escuadrones.map((s) => filaEscuadra(s, p, e)).join('')}</div>` : '<p class="asent-lado-nota">Ninguna.</p>'}`;
}

/** El bien elegido en el mercado y el resultado de la última compra: viven entre repintados (el sondeo de 3 s no los borra). */
let bienElegido: string | null = null;
let ultimaCompra: string | null = null;

/**
 * El MERCADO del campamento: una lista de lo que hay en venta y, del bien elegido, todo lo necesario para decidir antes de pulsar «Comprar»:
 * lo que hay en venta, lo que ya tienes, el cupo de hoy, tu oro, la cantidad y el total a pagar. Precio y cupo los manda el backend
 * (`mercadoCampamento`); se paga primero con el oro de botín y luego con el oro del almacén personal. Si no cabe todo o no alcanza, el
 * campamento sirve lo que puede, y se dice.
 */
function mercado(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const precios = p.mercadoCampamento?.precios;
  const enVenta = Object.entries(c.mercado).filter(([r, n]) => n >= 1 && r !== 'oro' && (resides || r === 'trigo'));
  const nota = resides ? '' : '<p class="asent-lado-nota">Si no resides aquí, solo te venden trigo, y va al carro de tu columna.</p>';
  if (enVenta.length === 0) return `${nota}<p class="asent-lado-nota">Nada en venta.</p>`;
  if (!bienElegido || !enVenta.some(([r]) => r === bienElegido)) bienElegido = enVenta[0]![0];

  const almacen = heroe.almacenPersonal ?? {};
  const oroBotin = Math.floor(heroe.oroDeBotin ?? 0);
  const oroAlmacen = Math.floor(almacen['oro'] ?? 0);
  const oro = oroBotin + oroAlmacen;
  const carro = p.ejercitos.find((x) => x.liderId === heroe.id)?.suministro ?? {};
  const tienes = (r: string): number => Math.floor(resides ? (almacen[r] ?? 0) : (carro[r] ?? 0));

  const lista = enVenta
    .map(([r, n]) => `<button class="mercado-bien${r === bienElegido ? ' activo' : ''}" type="button" data-bien="${e(r)}"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(nombreRecurso(r))}</span><small>${Math.floor(n)} en venta${precios?.[r] ? ` · ${formatoPrecio(precios[r]!)} oro/u` : ''}</small></button>`)
    .join('');

  const r = bienElegido;
  const stock = Math.floor(c.mercado[r] ?? 0);
  const precio = precios?.[r];
  const cupo = p.mercadoCampamento?.cupoRestante[r];
  let maximo = Math.min(stock, cupo ?? Infinity);
  if (precio) {
    maximo = Math.min(maximo, Math.floor(oro / precio));
    while (maximo > 0 && Math.ceil(maximo * precio) > oro) maximo--;
  }
  const inicial = Math.max(0, Math.min(10, maximo));
  return `${nota}
    <div class="mercado-lista">${lista}</div>
    <section class="mercado-detalle" data-precio="${precio ?? ''}" data-oro="${oro}" data-tienes="${tienes(r)}">
      <strong class="heroe-sub">${RECURSO_ICONO[r] ?? '📦'} ${e(nombreRecurso(r))}</strong>
      <div class="asent-ficha-grid">
        <div><span>En venta</span><strong>${stock}</strong></div>
        <div><span>Tienes ${resides ? 'en tu almacén' : 'en tu carro'}</span><strong>${tienes(r)}</strong></div>
        ${cupo !== undefined ? `<div><span>Cupo de hoy</span><strong>${cupo}</strong></div>` : ''}
        <div><span>Tu oro</span><strong title="Oro de botín ${oroBotin} · almacén ${oroAlmacen}">${oro}</strong></div>
        ${precio ? `<div><span>Precio por unidad</span><strong>${formatoPrecio(precio)}</strong></div>` : ''}
      </div>
      ${maximo < 1
        ? `<p class="asent-lado-nota">${cupo === 0 ? 'Ya has comprado hoy todo lo que se te vende de esto.' : precio && oro < precio ? 'No te llega el oro ni para una unidad.' : 'No se puede comprar ahora.'}</p>`
        : `<label class="mercado-cantidad"><span>Cantidad</span>
            <input class="form-input" type="number" min="1" max="${maximo}" value="${inicial}" data-cantidad />
            <input type="range" min="1" max="${maximo}" value="${inicial}" data-cantidad-barra />
          </label>
          <div class="mercado-total">
            <div><span>Pagas</span><strong data-total>${precio ? Math.ceil(inicial * precio) : '—'}</strong><small>de oro</small></div>
            <div><span>Te queda</span><strong data-resta>${precio ? oro - Math.ceil(inicial * precio) : '—'}</strong><small>de oro</small></div>
            <div><span>Tendrás</span><strong data-tendras>${tienes(r) + inicial}</strong><small>${e(nombreRecurso(r))}</small></div>
          </div>
          <button class="btn-primary" type="button" data-comprar="${e(r)}">Comprar</button>`}
      ${ultimaCompra ? `<p class="mercado-hecho">${e(ultimaCompra)}</p>` : ''}
      <p class="asent-lado-nota">Se paga primero con el oro de botín y luego con el oro de tu almacén. Si no cabe todo o no te llega, se compra lo que se pueda.</p>
    </section>`;
}

/** «1.3» con un decimal si lo tiene; los precios del campamento salen de la economía y no son enteros. */
function formatoPrecio(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * El FONDO de refundación: lo que cuesta la Caravana de Fundación (`costoDeRefundacion`), cuánto lleva reunido tu Facción de cada material, cuánto falta,
 * lo que has puesto tú, y cómo aportar. Comprar solo se activa con el precio completo.
 */
function fondo(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const almacen = heroe.almacenPersonal ?? {};
  const fondoDeFaccion: Record<string, number> = {};
  const ciudadanos = new Set(p.facciones.find((f) => f.id === p.faccionId)?.ciudadanosIds ?? []);
  for (const [heroeId, aporte] of Object.entries(c.fondos)) {
    if (!ciudadanos.has(heroeId)) continue;
    for (const [r, n] of Object.entries(aporte)) fondoDeFaccion[r] = (fondoDeFaccion[r] ?? 0) + n;
  }
  const mio = c.fondos[heroe.id] ?? {};
  const caravana = p.caravanas.find((k) => k.origenCampamentoId === c.id && k.faccionId === p.faccionId);
  const precio = costoDeRefundacion();
  const tienes = (r: string): number => Math.floor(r === 'oro' ? (heroe.oroDeBotin ?? 0) + (almacen['oro'] ?? 0) : (almacen[r] ?? 0));
  const falta = (r: string): number => Math.max(0, (precio?.[r] ?? 0) - Math.floor(fondoDeFaccion[r] ?? 0));
  const recursosAportables = [...new Set([...Object.keys(almacen), ...(heroe.oroDeBotin ? ['oro'] : [])])].filter((r) => tienes(r) >= 1);

  const necesidad = precio
    ? Object.entries(precio).map(([r, n]) => {
        const hay = Math.floor(fondoDeFaccion[r] ?? 0);
        const listo = hay >= n;
        const mioR = Math.floor(mio[r] ?? 0);
        return `<div class="fondo-fila${listo ? ' listo' : ''}"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(nombreRecurso(r))}</span>
          <div class="fondo-barra"><i style="width:${Math.min(100, (hay / n) * 100).toFixed(1)}%"></i></div>
          <strong>${Math.min(hay, n)} / ${n}</strong>
          <small>${listo ? '✓ completo' : `faltan ${n - hay}`}${mioR > 0 ? ` · tú: ${mioR}` : ''}</small></div>`;
      }).join('')
    : '<p class="asent-lado-nota">Cargando el precio de la caravana…</p>';
  const total = precio ? Object.values(precio).reduce((x, y) => x + y, 0) : 0;
  const reunido = precio ? Object.entries(precio).reduce((x, [r, n]) => x + Math.min(n, Math.floor(fondoDeFaccion[r] ?? 0)), 0) : 0;
  const completo = precio !== null && Object.keys(precio).every((r) => falta(r) === 0);
  const faltantes = precio ? Object.keys(precio).filter((r) => falta(r) > 0).map((r) => `${falta(r)} de ${nombreRecurso(r)}`).join(', ') : '';
  // Lo que ya está en el fondo y no pide el precio sigue siendo de quien lo puso y se puede retirar: se enseña aparte.
  const sobrante = Object.entries(fondoDeFaccion).filter(([r, n]) => n > 0 && !(precio && r in precio));

  return `
    <p class="asent-lado-nota">La Caravana de Fundación se compra aquí entre todos los ciudadanos de tu Facción: cada uno aporta lo que quiere a un fondo común. Lo tuyo se puede retirar mientras no se gaste.</p>
    <strong class="heroe-sub">Precio de la caravana${precio ? ` · reunido ${reunido} / ${total}` : ''}</strong>
    ${precio ? `<div class="fondo-barra fondo-barra-total"><i style="width:${total > 0 ? ((reunido / total) * 100).toFixed(1) : 0}%"></i></div>` : ''}
    ${necesidad}
    ${sobrante.length > 0 ? `<p class="asent-lado-nota">Además en el fondo: ${sobrante.map(([r, n]) => `${Math.floor(n)} de ${e(nombreRecurso(r))}`).join(', ')}.</p>` : ''}
    <strong class="heroe-sub">Aportar</strong>
    ${recursosAportables.length === 0
      ? '<p class="asent-lado-nota">No tienes nada que aportar: el fondo se llena con lo de tu almacén personal y con tu oro de botín.</p>'
      : `<div class="campamento-fila">
      <select class="form-input" id="fondo-recurso">${recursosAportables.map((r) => `<option value="${e(r)}" data-tienes="${tienes(r)}" data-falta="${falta(r)}">${e(nombreRecurso(r))} (tienes ${tienes(r)}${precio && falta(r) > 0 ? `, faltan ${falta(r)}` : ''})</option>`).join('')}</select>
      <input class="form-input" id="fondo-cantidad" type="number" min="1" value="10" />
      <button class="btn-secondary" type="button" id="fondo-lo-que-falta" title="Rellena la cantidad con lo que falta de ese material (o con lo que tienes, si es menos)">Lo que falta</button>
    </div>`}
    <div class="mapa-seleccion-acciones">
      <button class="btn-secondary" type="button" data-fondo="aportarARefundacion"${recursosAportables.length === 0 ? ' disabled' : ''}>Aportar</button>
      <button class="btn-secondary" type="button" data-fondo="retirarDeRefundacion">Retirar</button>
      <button class="btn-primary" type="button" id="btn-comprar-caravana"${caravana || !completo ? ' disabled' : ''}>Comprar caravana</button>
    </div>
    ${!caravana && precio && !completo ? `<p class="asent-lado-nota">Aún no se puede comprar: faltan ${faltantes}.</p>` : ''}
    ${caravana ? `<p class="asent-lado-nota">Caravana de Fundación lista${caravana.titularId === heroe.id ? ', y la llevas tú' : ''}: sal con tu columna, engánchala en el mapa y funda donde quieras (panel ⌂).</p>` : ''}`;
}

/** El HTML de una subpestaña. La Taberna (intel) la pinta `main.ts` en `#camp-taberna`, porque comparte panel con la plaza. */
export function htmlSeccionCampamento(seccion: SeccionCampamento, p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  switch (seccion) {
    case 'resumen': return resumen(p, c, e);
    case 'salir': return salir(p, c, e);
    case 'tropa': return tropa(p, c, e);
    case 'mercado': return mercado(p, c, e);
    case 'fondo': return fondo(p, c, e);
    case 'taberna': return '<div id="camp-taberna"></div>';
  }
}

/** Pone al día la lista de ejércitos en preparación de la pestaña Salir (cambia con el sondeo, sin repintar el formulario). `main.ts` la llama en cada refresco. */
export function actualizarSalida(root: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  const escapar = (v: string): string => v.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
  const aviso = (mensaje: string): void => { const error = root.querySelector<HTMLElement>('#camp-error'); if (error) error.textContent = mensaje; };
  const leer = () => ({ escuadronIds: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-salir-escuadra]:checked')).map((i) => i.dataset.salirEscuadra!), carga: leerCarga(root) });
  actualizarConvocatorias(root, p, leer, ejecutar, aviso, escapar);
}

/** Cablea los botones de la subpestaña pintada. Tras un éxito refresca `ejecutar`, y el router decide la pantalla. */
/** Lo que el mercado necesita además de `ejecutar`: comprar sabiendo cuánto se sirvió (`datos` del comando) y repintar la pestaña al elegir. */
export interface OpcionesMercado {
  ejecutarConDatos: (tipo: string, params: object) => Promise<{ error: string | null; datos?: unknown }>;
  repintar: () => void;
}

function cablearMercado(root: HTMLElement, c: CampamentoMercenarios, opciones: OpcionesMercado): void {
  const error = root.querySelector<HTMLElement>('#camp-error');
  root.querySelectorAll<HTMLButtonElement>('[data-bien]').forEach((boton) => boton.addEventListener('click', () => {
    bienElegido = boton.dataset.bien!;
    ultimaCompra = null;
    opciones.repintar();
  }));
  const detalle = root.querySelector<HTMLElement>('.mercado-detalle');
  const numero = root.querySelector<HTMLInputElement>('[data-cantidad]');
  const barra = root.querySelector<HTMLInputElement>('[data-cantidad-barra]');
  if (!detalle || !numero) return;
  const precio = Number(detalle.dataset.precio) || 0;
  const oro = Number(detalle.dataset.oro);
  const tienes = Number(detalle.dataset.tienes);
  const comprar = root.querySelector<HTMLButtonElement>('[data-comprar]');
  /** Recalcula el total sin repintar (lo escrito no se toca). */
  const actualizar = (n: number): void => {
    const total = Math.ceil(n * precio);
    const poner = (sel: string, v: string) => { const el = detalle.querySelector(sel); if (el) el.textContent = v; };
    if (precio) { poner('[data-total]', String(total)); poner('[data-resta]', String(oro - total)); }
    poner('[data-tendras]', String(tienes + n));
    if (comprar) {
      comprar.disabled = !(n >= 1) || (precio > 0 && total > oro);
      comprar.textContent = n >= 1 ? `Comprar ${n}${precio ? ` por ${total} de oro` : ''}` : 'Comprar';
    }
  };
  numero.addEventListener('input', () => { if (barra) barra.value = numero.value; actualizar(Math.floor(Number(numero.value))); });
  barra?.addEventListener('input', () => { numero.value = barra.value; actualizar(Number(barra.value)); });
  actualizar(Math.floor(Number(numero.value)));
  comprar?.addEventListener('click', async () => {
    const recurso = comprar.dataset.comprar!;
    const pedida = Math.floor(Number(numero.value));
    comprar.disabled = true;
    const r = await opciones.ejecutarConDatos('comprarEnCampamento', { recurso, cantidad: pedida, campamentoId: c.id });
    if (r.error) {
      comprar.disabled = false;
      if (error) error.textContent = r.error;
      return;
    }
    const d = r.datos as { cantidad?: number; oro?: number } | undefined;
    ultimaCompra = d?.cantidad !== undefined
      ? `Compraste ${d.cantidad} de ${nombreRecurso(recurso)} por ${d.oro ?? 0} de oro.${d.cantidad < pedida ? ' No cabía o no alcanzaba para más.' : ''}`
      : 'Compra hecha.';
    opciones.repintar();
  });
}

export function cablearCampamento(root: HTMLElement, p: ProyeccionJugador, c: CampamentoMercenarios, ejecutar: Ejecutar, opciones: OpcionesMercado): void {
  const error = root.querySelector<HTMLElement>('#camp-error');
  const heroeId = p.heroeId;
  const conBoton = (selector: string, tipo: string, params: (this: HTMLButtonElement) => object): void => {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((boton) =>
      boton.addEventListener('click', async () => {
        boton.disabled = true;
        const mensaje = await ejecutar(tipo, params.call(boton));
        boton.disabled = false;
        if (error) error.textContent = mensaje ?? '';
      })
    );
  };
  const marcados = (atributo: string): string[] =>
    Array.from(root.querySelectorAll<HTMLInputElement>(`input[${atributo}]:checked`)).map((i) => i.getAttribute(atributo)!);

  // Mudarse de residencia retira la tropa prestada por el campamento anterior (backend D45), esté donde esté: se avisa antes.
  const prestadas = p.heroe.escuadrones.filter((s) => s.prestada);
  const residir = root.querySelector<HTMLButtonElement>('#btn-residir');
  if (residir && prestadas.length > 0) {
    residir.addEventListener('click', (ev) => {
      if (!confirm(`Si resides aquí, el campamento donde te prestaron tropa la retira (${prestadas.map((s) => `${s.nombre}: ${s.cantidad}`).join(', ')}). ¿Seguro?`)) ev.stopImmediatePropagation();
    }, true);
  }
  conBoton('#btn-residir', 'residirEnCampamento', () => ({ heroeId, campamentoId: c.id }));
  conBoton('#btn-salir-campamento', 'salirDelCampamento', () => ({
    campamentoId: c.id,
    heroeId,
    escuadronIds: marcados('data-salir-escuadra'),
    carga: leerCarga(root),
  }));
  cablearCargaDeSalida(root);
  const avisarEnError = (mensaje: string): void => { const error = root.querySelector<HTMLElement>('#camp-error'); if (error) error.textContent = mensaje; };
  const leerSeleccion = () => ({ escuadronIds: marcados('data-salir-escuadra'), carga: leerCarga(root) });
  cablearSalidaComoEjercito(root, p, root.querySelector<HTMLButtonElement>('#btn-salir-campamento'), 'Salir', leerSeleccion, ejecutar, avisarEnError);
  actualizarSalida(root, p, ejecutar);
  cablearPreparacion(root, p, ejecutar, avisarEnError, opciones.repintar);
  conBoton('#btn-pedir-prestamo', 'pedirPrestamo', () => ({ tropaIds: marcados('data-prestamo') }));
  conBoton('#btn-reponer-prestamo', 'reponerPrestamo', () => ({}));
  root.querySelector<HTMLSelectElement>('#reclutar-pagar-con')?.addEventListener('change', (ev) => { pagarConElegido = (ev.target as HTMLSelectElement).value as typeof pagarConElegido; });
  conBoton('[data-reclutar]', 'reclutarEnCampamento', function () { return { tropaId: this.dataset.reclutar!, pagarCon: pagarConElegido }; });
  cablearMercado(root, c, opciones);
  for (const tipo of ['aportarARefundacion', 'retirarDeRefundacion']) {
    conBoton(`[data-fondo="${tipo}"]`, tipo, () => ({
      recurso: root.querySelector<HTMLSelectElement>('#fondo-recurso')?.value ?? '',
      cantidad: Number(root.querySelector<HTMLInputElement>('#fondo-cantidad')?.value ?? 0),
      lado: 'almacen',
    }));
  }
  conBoton('#btn-comprar-caravana', 'comprarCaravanaDeRefundacion', () => ({}));
  root.querySelector<HTMLButtonElement>('#fondo-lo-que-falta')?.addEventListener('click', () => {
    const opcion = root.querySelector<HTMLSelectElement>('#fondo-recurso')?.selectedOptions[0];
    const cantidad = root.querySelector<HTMLInputElement>('#fondo-cantidad');
    if (!opcion || !cantidad) return;
    const falta = Number(opcion.dataset.falta);
    cantidad.value = String(Math.max(1, Math.min(Number(opcion.dataset.tienes), falta > 0 ? falta : Number(opcion.dataset.tienes))));
  });
}
