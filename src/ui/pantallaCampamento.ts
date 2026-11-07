// Pantalla CAMPAMENTO (backend 2026-10-04, Doc 1.9b): el héroe nace DENTRO de un campamento de mercenarios y vuelve a él.
// Se organiza como la del asentamiento: la planta a la izquierda y, a la derecha, subpestañas (Resumen · Tropa · Mercado ·
// Fondo · Taberna) en vez de una sola columna larga; salir va por la ventana común «Salir al mundo» (ventanaSalida.ts). Aquí no se decide ninguna regla: quien valida es el backend, y su rechazo sale
// tal cual en `#camp-error`. Los menús del jugador (héroe, escuadras, Facción) están en la barra superior (`barraJugador.ts`).
import { ayuda } from './ayuda';
import { chipLiderazgo } from './liderazgo';
import { costoDeRefundacion, unidadesDeTropa, type ProyeccionJugador } from '../apiCliente';
import { datosDeReclutamiento, grafoDe, htmlArbolDeLugar, montarArbolReclutamiento, nombreEdificio, ultimoDibujo, type EstadoPlaza, type EstadoTropa, type LugarDeReclutamiento } from './arbolReclutamiento';
import { eraOrd, ultimaEraVisible, type DatosArbol } from './arbolTecnologias';
import { iconoDeParte } from './hudInterior';
import { iconoEdificio } from './iconosEdificio';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { CampamentoMercenarios, Escuadron } from '../tiposDominio';
import { confirmar } from './dialogo';
import { iconoEnFila } from './iconosTropa';
import { cablearTablonMercenarios, htmlTablonMercenarios } from './mercenarios';

/** Manda el comando y refresca; devuelve el mensaje de error o `null`. Lo pone `main.ts`. */
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;
type Escapar = (valor: string) => string;

export type SeccionCampamento = 'resumen' | 'tropa' | 'mercado' | 'mercenarios' | 'fondo' | 'taberna';

const ETIQUETA: Record<SeccionCampamento, string> = { resumen: 'Resumen', tropa: 'Tropa', mercado: 'Mercado', mercenarios: 'Mercenarios', fondo: 'Fondo', taberna: 'Taberna' };

/** Las tres tropas de leva comunal que presta el campamento (backend `TROPAS_RECLUTABLES`, tecnología `leva_comunal`). */
const TROPAS_PRESTAMO: [string, string][] = [['milicia_lanceros', 'Milicia de lanceros'], ['lenadores', 'Leñadores'], ['granjeros', 'Granjeros']];

const nombreRecurso = (r: string): string => RECURSO_NOMBRE[r] ?? r;

/** De dónde sale el oro de «Reclutar»: vive entre repintados, como el bien elegido del mercado. */
let pagarConElegido: 'almacenPersonal' | 'carro' = 'almacenPersonal';

/**
 * El carro que llevas en este campamento, como el motor (`carro_en_campamento`, e4923d4d): el de la columna en la que vas (dentro o a la puerta)
 * o, dentro y residiendo aquí sin columna, tu propio carro (`heroe.carro`). `null` si no hay ninguno (el motor diría `heroe.sin_columna`).
 */
function carroAqui(p: ProyeccionJugador, c: CampamentoMercenarios): { recursos: Record<string, number>; que: string } | null {
  const heroe = p.heroe;
  const columna = p.ejercitos.find((x) => x.liderId === heroe.id || x.participantes.some((h) => h.heroeId === heroe.id));
  if (columna) return { recursos: columna.suministro ?? {}, que: 'el carro de tu columna' };
  const dentro = heroe.ubicacion.tipo === 'mercenarios' && heroe.ubicacion.campamentoId === c.id;
  if (dentro && c.residentesIds.includes(heroe.id)) return { recursos: heroe.carro ?? {}, que: 'tu carro' };
  return null;
}

export function campamentoActual(proyeccion: ProyeccionJugador): CampamentoMercenarios | undefined {
  const u = proyeccion.heroe.ubicacion;
  return u.tipo === 'mercenarios' ? proyeccion.campamentosMercenarios.find((c) => c.id === u.campamentoId) : undefined;
}

/** ¿Tiene tu Facción algún asentamiento a la vista o en memoria? Sin ninguno, el campamento le vende la Caravana de Fundación. */
function faccionConPlaza(p: ProyeccionJugador): boolean {
  return p.asentamientos.length > 0 || [...p.asentamientosAvistados, ...p.asentamientosConocidos].some((a) => a.faccionId === p.faccionId);
}

/** Las subpestañas que hay ahora (solo lo que se puede usar): el Fondo de refundación mientras tu Facción no tiene plaza; Mercenarios
 * solo si alguien se ofrece en el tablón de este campamento; la Taberna solo con Facción. */
export function seccionesDeCampamento(p: ProyeccionJugador, c: Pick<CampamentoMercenarios, 'tablon'>): { id: SeccionCampamento; etiqueta: string }[] {
  const ids: SeccionCampamento[] = [
    'resumen', 'tropa', 'mercado',
    ...((c.tablon?.length ?? 0) > 0 ? ['mercenarios' as const] : []),
    ...(p.faccionId !== null && !faccionConPlaza(p) ? ['fondo' as const] : []),
    ...(p.faccionId !== null ? ['taberna' as const] : []),
  ];
  return ids.map((id) => ({ id, etiqueta: ETIQUETA[id] }));
}

/** El ancho de la ventana de cada parte (`.asent-ventana[data-ancho]`): Mercenarios y Taberna a pantalla completa; Tropa y Mercado en una ventana
 * centrada como la de Misiones (0.129.0: al empezar la partida hay poco que poner en ellas); el resto, la normal. */
export function anchoDeParteCampamento(parte: SeccionCampamento): 'completa' | 'centrada' | 'normal' {
  return parte === 'mercenarios' || parte === 'taberna' || parte === 'tropa' ? 'completa' : parte === 'mercado' ? 'centrada' : 'normal';
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
  if (c.tipo === 'pueblo') return 'guarneciendo un pueblo';
  if (c.tipo === 'plaza') return 'en la guarnición de otra plaza';
  if (c.tipo === 'avanzada') return 'guarneciendo una avanzada';
  const columna = p.ejercitos.find((x) => x.id === c.ejercitoId);
  return columna?.estado === 'estacionado' ? 'en tu columna, aparcada en la puerta' : 'en tu columna';
}

function filaEscuadra(s: Escuadron, p: ProyeccionJugador, e: Escapar): string {
  return `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}</div><span>${s.cantidad} hombres · ${dondeEstaLaEscuadra(s, p)}${s.prestada ? ' · prestada' : ''}</span></div></div>`;
}

function resumen(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const edificios = [...new Set(c.edificios)].map((t) => EDIFICIO_NOMBRE[t] ?? t);
  const info = ayuda('camp:resumen', `${resides
    ? 'Este campamento es tu residencia: aquí guardas tu almacén, te prestan tropa y compras en el mercado completo.'
    : 'No resides aquí: sales con la columna con la que entraste y solo te venden trigo. Si te mudas, la tropa prestada por tu campamento anterior se te retira.'}${p.faccionId === null ? '<br>Aún no tienes Facción: abre «Facción» en la barra de arriba para crear una o pedir ingreso.' : ''}`);
  return `
    <strong class="heroe-sub">Campamento${info}</strong>
    <div class="asent-ficha-grid">
      <div><span>Residentes</span><strong>${c.residentesIds.length}</strong></div>
      <div><span>Resides aquí</span><strong>${resides ? 'Sí' : 'No'}</strong></div>
    </div>
    ${resides ? '' : '<button class="btn-secondary" type="button" id="btn-residir">Residir aquí</button>'}
    <strong class="heroe-sub">Tu tropa</strong>
    ${heroe.escuadrones.length > 0 ? `<div class="mapa-lista">${heroe.escuadrones.map((s) => filaEscuadra(s, p, e)).join('')}</div>` : '<p class="asent-lado-nota">No tienes tropa. En la pestaña Tropa te prestan una.</p>'}
    <strong class="heroe-sub">Tu almacén</strong>
    ${listaRecursos(heroe.almacenPersonal ?? {}, e)}
    <strong class="heroe-sub">Edificios del campamento</strong>
    <p class="asent-lado-nota">${edificios.map(e).join(' · ') || 'Ninguno.'}</p>`;
}

/**
 * TROPA (Víctor, 2026-11-06): la misma interfaz que el reclutamiento de la plaza (`arbolReclutamiento.ts`), con «Campamento» donde dice Centro
 * Urbano y, en ese carril, las tropas que presta el campamento (gratis, sin experiencia, se retiran si dejas de residir). Los demás carriles son
 * los edificios militares del campamento (plegados si no los tiene), con lo que el servidor manda a quien reside (`mercadoCampamento.reclutamiento`):
 * precio por soldado en oro con el equipo dentro (recargo, reputación y descuento ya aplicados), si está desbloqueada y los reclutas que quedan.
 * Un clic abre la ficha con «Pedir prestada» o «Reclutar». Solo recluta: reponer va aparte, como en la plaza.
 */
const CLAVE_ARBOL = 'campamento';

function lugarCampamento(D: DatosArbol, p: ProyeccionJugador, c: CampamentoMercenarios): LugarDeReclutamiento {
  const G = grafoDe(D);
  const t = p.tecnologia;
  const adoptadas = t?.propias?.adoptadas ?? p.tecnologiasAdoptadas ?? [];
  const escuadras: Record<string, number> = {};
  const prestadas: Record<string, Escuadron> = {};
  for (const s of p.heroe.escuadrones) { if (s.prestada) prestadas[s.tropaId] = s; else escuadras[s.tropaId] = s.cantidad; }
  const E: EstadoPlaza = { adoptadas, aparecidas: t?.propias?.aparecidas ?? [], eraMundo: t?.era ?? '', niveles: {}, escuadras };
  const oferta = new Map((p.mercadoCampamento?.reclutamiento?.tropas ?? []).map((o) => [o.tropaId, o]));
  const presta = new Set(TROPAS_PRESTAMO.map(([id]) => id));
  const eraDe = (id: string): number => G.nodos.get(id)?.era ?? 1;
  const mundo = t?.era ? eraOrd(D, t.era) : null;
  // Lo que se puede hacer aquí no se esconde detrás de las Eras de tu Facción: la Era de lo que el campamento ya ofrece también se ve.
  const eraVisible = Math.max(ultimaEraVisible(D, adoptadas), ...[...oferta.values()].filter((o) => o.desbloqueada).map((o) => eraDe(o.tropaId)), ...[...presta].map(eraDe));
  const estado = (id: string): EstadoTropa => {
    const tr = G.nodos.get(id)!.d;
    if (tr.edificio === 'centroUrbano') return prestadas[id] ? 'tuya' : 'lista';
    const o = oferta.get(id);
    if (!o) return mundo !== null && eraDe(id) > mundo ? 'futura' : 'edificio';
    if (!o.desbloqueada) return 'bloqueada';
    return escuadras[id] !== undefined ? 'tuya' : 'lista';
  };
  const oro = (n: number): string => `<span class="ta-rec" title="Oro"><i aria-hidden="true">${RECURSO_ICONO['oro'] ?? '🪙'}</i><b>${formatoPrecio(n)}</b></span>`;
  return {
    clave: CLAVE_ARBOL, donde: 'este campamento', E, eraVisible, eraMundo: mundo, sinEdificios: true,
    centro: { nombre: 'Campamento', icono: 'campamento', tropas: presta },
    icono: (tipo, n) => (tipo === 'campamento' ? iconoDeParte('campamento', n) : iconoEdificio(tipo, n)),
    plegado: (carril) => (carril !== 'centroUrbano' && !c.edificios.includes(carril) ? `Este campamento no tiene ${nombreEdificio(carril)}: aquí no se recluta` : null),
    estado,
    carta: (id, { EI }) => {
      const tr = G.nodos.get(id)!.d, est = estado(id), o = oferta.get(id);
      if (tr.edificio === 'centroUrbano') return est === 'tuya' ? `Prestada: <b>${prestadas[id]!.cantidad}</b> hombres` : 'Te la prestan gratis';
      if (est === 'lista') return `Lista · ${oro(o!.precioPorSoldado)} por soldado`;
      if (est === 'tuya') return `Tu escuadra <b>${escuadras[id]}</b>/${tr.unidadesPorDefecto}`;
      if (est === 'edificio') return `Falta ${EI(tr.edificio, tr.nivelRequerido)} en el campamento`;
      if (est === 'futura') return `Bloqueada: la Era ${['', 'I', 'II', 'III', 'IV', 'V'][eraDe(id)]} aún no empieza`;
      return 'El campamento aún no la ofrece';
    },
    caja: (id, { EI }) => {
      const tr = G.nodos.get(id)!.d, est = estado(id), o = oferta.get(id);
      if (tr.edificio === 'centroUrbano') return est === 'tuya'
        ? `<b>Te la han prestado</b> (${prestadas[id]!.cantidad} hombres, ${dondeEstaLaEscuadra(prestadas[id]!, p)}). Se retira si dejas de residir aquí.`
        : '<b>Te la prestan gratis</b> para aprender a usar tropa antes de tener la tuya. No gana experiencia y se retira si dejas de residir en este campamento.';
      return {
        lista: `<b>Lista para reclutar</b> en este campamento por ${oro(o?.precioPorSoldado ?? 0)} de oro por soldado, con el equipo dentro.`,
        tuya: `<b>Ya tienes su escuadra</b> (${escuadras[id]} de ${tr.unidadesPorDefecto} hombres). Un héroe tiene una escuadra por tropa.`,
        edificio: `<b>El campamento tiene ${EI(tr.edificio)},</b> pero esta tropa pide ${EI(tr.edificio, tr.nivelRequerido)}.`,
        adoptable: '',
        bloqueada: '<b>El campamento aún no la ofrece.</b> Los campamentos ofrecen una tropa 72 h después de que la primera Facción descubra su tecnología, o cuando la adopte la mitad de las Facciones vivas.',
        futura: `<b>Bloqueada:</b> la Era ${['', 'I', 'II', 'III', 'IV', 'V'][eraDe(id)]} aún no ha empezado en el mundo.`,
      }[est];
    },
    porSoldado: (id) => {
      const tr = G.nodos.get(id)!.d, o = oferta.get(id);
      if (tr.edificio === 'centroUrbano') return '<h4>Préstamo</h4><ul><li>Gratis. La escuadra no gana experiencia.</li></ul>';
      if (!o) return null;
      return `<h4>Por soldado</h4><ul><li>${oro(o.precioPorSoldado)} con el equipo dentro (recargo, reputación y descuento ya aplicados)</li><li>1 recluta del campamento</li></ul>`;
    },
    leyenda: { lista: 'se recluta o te la prestan aquí', tuya: 'ya la tienes', edificio: 'el campamento no tiene el edificio a su nivel', bloqueada: 'el campamento aún no la ofrece', futura: 'bloqueada: su Era aún no empieza' },
    ayuda: 'Pasa el ratón por una tropa para ver qué pide; haz clic para abrir su ficha y pedirla prestada o reclutarla. Arrastra el tablero para moverte.',
  };
}

/** Lo que va bajo el tooltip de la ficha fija: pedir prestada, reclutar o por qué no. */
function accionesCampamento(p: ProyeccionJugador, e: Escapar, id: string): string {
  const d = ultimoDibujo(CLAVE_ARBOL);
  const tr = d?.G.nodos.get(id)?.d;
  if (!d || !tr) return '';
  const nota = (txt: string): string => `<p class="ta-ficha-nota">${txt}</p>`;
  const est = d.L.estado(id);
  if (tr.edificio === 'centroUrbano') {
    if (est === 'tuya') return '';
    return `<button class="btn-primary ta-ficha-boton" type="button" data-ficha-prestamo="${e(id)}">Pedir prestada · ${unidadesDeTropa(id) ?? tr.unidadesPorDefecto} hombres, gratis</button>`;
  }
  if (est === 'tuya') return nota(`Ya tienes una escuadra de ${e(tr.nombre)}.`);
  if (est !== 'lista') return '';
  const oferta = p.mercadoCampamento?.reclutamiento;
  const o = oferta?.tropas.find((x) => x.tropaId === id);
  if (!oferta || !o) return '';
  const columna = p.ejercitos.find((x) => x.liderId === p.heroe.id);
  const oroOrigen = Math.floor(pagarConElegido === 'carro' ? columna?.suministro?.['oro'] ?? 0 : p.heroe.almacenPersonal?.['oro'] ?? 0);
  const oro = Math.ceil(o.precioPorSoldado * tr.unidadesPorDefecto);
  const motivo = oferta.poblacion < tr.unidadesPorDefecto ? `Faltan reclutas: hay ${Math.floor(oferta.poblacion)} y hacen falta ${tr.unidadesPorDefecto}.`
    : oro > oroOrigen ? `No te llega el oro: ${oro} y tienes ${oroOrigen} en ${pagarConElegido === 'carro' ? 'el carro' : 'tu almacén'}.` : '';
  return `${motivo ? nota(e(motivo)) : ''}<button class="btn-primary ta-ficha-boton" type="button" data-ficha-reclutar-camp="${e(id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>⚔ Reclutar ${tr.unidadesPorDefecto} <span class="recl-costes"><span class="obra-coste${oro > oroOrigen ? ' falta' : ''}">${RECURSO_ICONO['oro'] ?? '🪙'}${oro}</span></span></button>`;
}

let escaparCamp: Escapar = (s) => s;
function tropa(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  if (!c.residentesIds.includes(heroe.id)) return '<p class="asent-lado-nota">Solo se presta o se recluta tropa en el campamento donde resides: pulsa «Residir aquí» en Resumen.</p>';
  const D = datosDeReclutamiento();
  const oferta = p.mercadoCampamento?.reclutamiento;
  if (!D || !oferta) return '<p class="asent-lado-nota">Cargando las tropas…</p>';
  escaparCamp = e;
  const columna = p.ejercitos.find((x) => x.liderId === heroe.id);
  if (pagarConElegido === 'carro' && !columna) pagarConElegido = 'almacenPersonal';
  const oroAlmacen = Math.floor(heroe.almacenPersonal?.['oro'] ?? 0);
  const oroCarro = Math.floor(columna?.suministro?.['oro'] ?? 0);
  const info = ayuda('camp:reclutar', 'Todas las tropas, en carriles por el edificio del campamento donde se reclutan; si el campamento no lo tiene, su carril se pliega. En el carril del Campamento, las que te presta gratis (no ganan experiencia y se retiran si dejas de residir aquí). Lo demás se paga solo con oro, con el equipo dentro, y con los reclutas del campamento. Un héroe tiene una escuadra por tropa.');
  return `<div class="obra-titulo"><span class="faction-kicker">Tropa</span>
      <span class="obra-chip" title="Reclutas del campamento">🧑 ${Math.floor(oferta.poblacion)}/${Math.floor(oferta.topePoblacion)} reclutas</span>
      <label class="camp-pagar-con"><span>Pagar con</span>
        <select class="form-input" id="reclutar-pagar-con">
          <option value="almacenPersonal"${pagarConElegido === 'almacenPersonal' ? ' selected' : ''}>Mi almacén personal (${oroAlmacen} de oro)</option>
          ${columna ? `<option value="carro"${pagarConElegido === 'carro' ? ' selected' : ''}>El carro de mi columna (${oroCarro} de oro; a la puerta)</option>` : ''}
        </select></label>${info}</div>
    <div class="tec-arbol recl-arbol">${htmlArbolDeLugar(D, lugarCampamento(D, p, c), e)}</div>`;
}

/** Cablea el árbol de la Tropa: la ficha pide prestada o recluta (`pedirPrestamo`, `reclutarEnCampamento`). */
function cablearTropa(root: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  const arbol = root.querySelector<HTMLElement>('.recl-arbol');
  if (!arbol) return;
  montarArbolReclutamiento(arbol, {
    acciones: (id) => accionesCampamento(p, escaparCamp, id),
    cablearAcciones: (caja) => {
      const accion = (selector: string, tipo: string, params: (b: HTMLButtonElement) => object): void => caja.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        b.disabled = true;
        const mensaje = await ejecutar(tipo, params(b));
        const campo = caja.querySelector<HTMLElement>(`[data-campo="error-ficha-${CLAVE_ARBOL}"]`);
        if (mensaje !== null) { b.disabled = false; if (campo) campo.textContent = mensaje; }
      }));
      accion('[data-ficha-prestamo]', 'pedirPrestamo', (b) => ({ tropaIds: [b.dataset.fichaPrestamo!] }));
      accion('[data-ficha-reclutar-camp]', 'reclutarEnCampamento', (b) => ({ tropaId: b.dataset.fichaReclutarCamp!, pagarCon: pagarConElegido }));
    },
  }, CLAVE_ARBOL);
}

/** El bien elegido en el mercado, el resultado de la última compra y de dónde sale el oro: viven entre repintados (el sondeo de 3 s no los borra). */
let bienElegido: string | null = null;
let ultimaCompra: string | null = null;
let pagarMercado: 'almacenPersonal' | 'carro' = 'almacenPersonal';

/**
 * El MERCADO del campamento: una lista de lo que hay en venta y, del bien elegido, todo lo necesario para decidir antes de pulsar «Comprar»:
 * lo que hay en venta, lo que ya tienes, el cupo de hoy, tu oro, la cantidad y el total a pagar. Precio y cupo los manda el backend
 * (`mercadoCampamento`); se paga con el oro del almacén personal (residente) o del carro (visitante). Si no cabe todo o no alcanza, el
 * campamento sirve lo que puede, y se dice.
 */
function mercado(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const precios = p.mercadoCampamento?.precios;
  // De dónde sale el oro (`pagar_con`, motor e4923d4d): el residente elige entre su almacén personal y el carro que lleva aquí; el visitante, el carro.
  const carro = carroAqui(p, c);
  if (!resides) pagarMercado = 'carro';
  else if (pagarMercado === 'carro' && !carro) pagarMercado = 'almacenPersonal';
  const conCarro = pagarMercado === 'carro';
  // Al visitante solo le venden trigo; el residente que paga con el carro, todo menos el trigo (se reposta gratis a víveres).
  const enVenta = Object.entries(c.mercado).filter(([r, n]) => n >= 1 && r !== 'oro' && (resides ? !(conCarro && r === 'trigo') : r === 'trigo'));
  const donde = conCarro ? (carro?.que ?? 'tu carro') : 'tu almacén';
  const pagar = resides && carro
    ? `<label class="mercado-pagar"><span>Pagar con</span><select class="form-input" data-mercado-pagar>
        <option value="almacenPersonal"${conCarro ? '' : ' selected'}>Mi almacén personal (${Math.floor(heroe.almacenPersonal?.['oro'] ?? 0)} de oro)</option>
        <option value="carro"${conCarro ? ' selected' : ''}>${e(carro.que[0]!.toUpperCase() + carro.que.slice(1))} (${Math.floor(carro.recursos['oro'] ?? 0)} de oro)</option>
      </select></label>`
    : '';
  const nota = `<strong class="heroe-sub">Mercado${ayuda('camp:mercado', `${resides ? '' : 'Si no resides aquí, solo te venden trigo, y va al carro de tu columna.<br>'}Se paga con el oro de tu almacén personal o del carro que llevas aquí (el de tu columna o, si resides aquí, tu propio carro), y lo comprado va adonde salió el oro. Si resides aquí y pagas con el carro, no se vende trigo: se reposta gratis a víveres. Si no cabe todo o no te llega, se compra lo que se pueda.`)}</strong>${pagar}`;
  if (enVenta.length === 0) return `${nota}<p class="asent-lado-nota">${resides && conCarro ? 'Con el carro no hay nada en venta: el trigo no va al carro.' : 'Nada en venta.'}</p>`;
  if (!bienElegido || !enVenta.some(([r]) => r === bienElegido)) bienElegido = enVenta[0]![0];

  const fuente = conCarro ? (carro?.recursos ?? {}) : (heroe.almacenPersonal ?? {});
  const tienes = (r: string): number => Math.floor(fuente[r] ?? 0);
  const oro = tienes('oro');

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
        <div><span>Tienes en ${e(donde)}</span><strong>${tienes(r)}</strong></div>
        ${cupo !== undefined ? `<div><span>Cupo de hoy</span><strong>${cupo}</strong></div>` : ''}
        <div><span>Tu oro</span><strong title="En ${e(donde)}">${oro}</strong></div>
        ${precio ? `<div><span>Precio por unidad</span><strong>${formatoPrecio(precio)}</strong></div>` : ''}
      </div>
      ${maximo < 1
        ? `<p class="asent-lado-nota">${cupo === 0 ? 'Ya has comprado hoy todo lo que se te vende de esto.' : precio && oro < precio ? 'No te llega el oro ni para una unidad.' : 'No se puede comprar ahora.'}</p>`
        : `<label class="mercado-cantidad"><span>Cantidad</span>
            <input class="form-input" type="number" min="1" max="${maximo}" value="${inicial}" data-cantidad />
            <input type="range" min="1" max="${maximo}" value="${inicial}" data-cantidad-barra />
          </label>
          <div class="mercado-total">
            ${precio ? `<div><span>Pagas</span><strong data-total>${Math.ceil(inicial * precio)}</strong><small>de oro</small></div>
            <div><span>Te queda</span><strong data-resta>${oro - Math.ceil(inicial * precio)}</strong><small>de oro</small></div>` : ''}
            <div><span>Tendrás</span><strong data-tendras>${tienes(r) + inicial}</strong><small>${e(nombreRecurso(r))}</small></div>
          </div>
          ${precio ? '' : '<p class="asent-lado-nota">El servidor todavía no publica el precio por unidad: lo cobra al comprar (sale del stock de todo el mundo) y, si no te llega el oro, te vende lo que alcance.</p>'}
          <button class="btn-primary" type="button" data-comprar="${e(r)}">Comprar</button>`}
      ${ultimaCompra ? `<p class="mercado-hecho">${e(ultimaCompra)}</p>` : ''}
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
  // El motor manda el fondo ya sumado por Facción (`fondos` por `f-N`), no por héroe: antes se buscaba por héroe y salía siempre vacío, así
  // que la barra no se movía al aportar. Lo de cada héroe no viaja; al retirar, el motor solo devuelve lo que pusiste tú.
  const fondoDeFaccion: Record<string, number> = { ...(p.faccionId ? (c.fondos[p.faccionId] ?? {}) : {}) };
  const caravana = p.caravanas.find((k) => k.origenCampamentoId === c.id && k.faccionId === p.faccionId);
  const precio = costoDeRefundacion();
  // Se aporta del almacén personal (si resides aquí) o del carro que llevas aquí (`lado` de la orden): el de tu columna, dentro o a la puerta, o,
  // dentro de tu residencia y sin columna, tu propio carro (motor e4923d4d: el lado carro ya vale también dentro).
  const resides = c.residentesIds.includes(heroe.id);
  const carro = carroAqui(p, c);
  const falta = (r: string): number => Math.max(0, (precio?.[r] ?? 0) - Math.floor(fondoDeFaccion[r] ?? 0));
  const origenes: { lado: 'almacen' | 'carro'; de: string; recursos: Record<string, number> }[] = [
    ...(resides ? [{ lado: 'almacen' as const, de: 'almacén', recursos: almacen }] : []),
    ...(carro ? [{ lado: 'carro' as const, de: 'carro', recursos: carro.recursos }] : []),
  ];
  const opciones = origenes.flatMap((o) => Object.entries(o.recursos).filter(([, n]) => n >= 1).map(([r, n]) => ({ lado: o.lado, de: o.de, r, tienes: Math.floor(n) })));

  const necesidad = precio
    ? Object.entries(precio).map(([r, n]) => {
        const hay = Math.floor(fondoDeFaccion[r] ?? 0);
        const listo = hay >= n;
        return `<div class="fondo-fila${listo ? ' listo' : ''}"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(nombreRecurso(r))}</span>
          <div class="fondo-barra"><i style="width:${Math.min(100, (hay / n) * 100).toFixed(1)}%"></i></div>
          <strong>${Math.min(hay, n)} / ${n}</strong>
          <small>${listo ? '✓ completo' : `faltan ${n - hay}`}</small></div>`;
      }).join('')
    : '<p class="asent-lado-nota">Cargando el precio de la caravana…</p>';
  const total = precio ? Object.values(precio).reduce((x, y) => x + y, 0) : 0;
  const reunido = precio ? Object.entries(precio).reduce((x, [r, n]) => x + Math.min(n, Math.floor(fondoDeFaccion[r] ?? 0)), 0) : 0;
  const completo = precio !== null && Object.keys(precio).every((r) => falta(r) === 0);
  const faltantes = precio ? Object.keys(precio).filter((r) => falta(r) > 0).map((r) => `${falta(r)} de ${nombreRecurso(r)}`).join(', ') : '';
  // Lo que ya está en el fondo y no pide el precio sigue siendo de quien lo puso y se puede retirar: se enseña aparte.
  const sobrante = Object.entries(fondoDeFaccion).filter(([r, n]) => n > 0 && !(precio && r in precio));

  return `
    <strong class="heroe-sub">Precio de la caravana${precio ? ` · reunido ${reunido} / ${total}` : ''}${ayuda('camp:fondo', 'La Caravana de Fundación se compra aquí entre todos los ciudadanos de tu Facción: cada uno aporta lo que quiere a un fondo común. Lo tuyo se puede retirar mientras no se gaste. El fondo se llena con lo de tu almacén personal o del carro que llevas aquí (el de tu columna o, si resides aquí, tu propio carro). Cuando el fondo está completo, la caravana espera aquí dentro: sal como ejército (Salir › Convocar ejército) y, al partir, el Líder elige llevársela; luego funda donde quieras (panel ⌂).')}</strong>
    ${precio ? `<div class="fondo-barra fondo-barra-total"><i style="width:${total > 0 ? ((reunido / total) * 100).toFixed(1) : 0}%"></i></div>` : ''}
    ${necesidad}
    ${sobrante.length > 0 ? `<p class="asent-lado-nota">Además en el fondo: ${sobrante.map(([r, n]) => `${Math.floor(n)} de ${e(nombreRecurso(r))}`).join(', ')}.</p>` : ''}
    <strong class="heroe-sub">Aportar</strong>
    ${opciones.length === 0
      ? '<p class="asent-lado-nota">No tienes nada que aportar.</p>'
      : `<div class="campamento-fila">
      <select class="form-input" id="fondo-recurso">${opciones.map((o) => `<option value="${e(o.r)}" data-lado="${o.lado}" data-tienes="${o.tienes}" data-falta="${falta(o.r)}">${e(nombreRecurso(o.r))}, del ${o.de} (tienes ${o.tienes}${precio && falta(o.r) > 0 ? `, faltan ${falta(o.r)}` : ''})</option>`).join('')}</select>
      <input class="form-input" id="fondo-cantidad" type="number" min="1" value="10" />
      <button class="btn-secondary" type="button" id="fondo-lo-que-falta" title="Rellena la cantidad con lo que falta de ese material (o con lo que tienes, si es menos)">Lo que falta</button>
    </div>`}
    <div class="mapa-seleccion-acciones">
      <button class="btn-secondary" type="button" data-fondo="aportarARefundacion"${opciones.length === 0 ? ' disabled' : ''}>Aportar</button>
      <button class="btn-secondary" type="button" data-fondo="retirarDeRefundacion">Retirar</button>
      <button class="btn-primary" type="button" id="btn-comprar-caravana"${caravana || !completo ? ' disabled' : ''}>Comprar caravana</button>
    </div>
    ${!caravana && precio && !completo ? `<p class="asent-lado-nota">Aún no se puede comprar: faltan ${faltantes}.</p>` : ''}
    ${caravana ? `<p class="asent-lado-nota">Caravana de Fundación lista${caravana.estado === 'disponible' ? ': espera aquí dentro hasta que un ejército de tu Facción se la lleve al salir' : caravana.titularId === heroe.id ? ', y la llevas tú' : ''}.</p>` : ''}`;
}

/** El HTML de una subpestaña. La Taberna (intel) la pinta `main.ts` en `#camp-taberna`, porque comparte panel con la plaza. */
export function htmlSeccionCampamento(seccion: SeccionCampamento, p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  switch (seccion) {
    case 'resumen': return resumen(p, c, e);
    case 'tropa': return tropa(p, c, e);
    case 'mercado': return mercado(p, c, e);
    case 'mercenarios': return htmlTablonMercenarios(p, c.tablon, e, c);
    case 'fondo': return fondo(p, c, e);
    case 'taberna': return '<div id="camp-taberna"></div>';
  }
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
  root.querySelector<HTMLSelectElement>('[data-mercado-pagar]')?.addEventListener('change', (ev) => {
    pagarMercado = (ev.target as HTMLSelectElement).value === 'carro' ? 'carro' : 'almacenPersonal';
    ultimaCompra = null;
    opciones.repintar();
  });
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
    const r = await opciones.ejecutarConDatos('comprarEnCampamento', { recurso, cantidad: pedida, campamentoId: c.id, pagarCon: pagarMercado });
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

  // Mudarse de residencia retira la tropa prestada por el campamento anterior (backend D45), esté donde esté: se avisa antes.
  const prestadas = p.heroe.escuadrones.filter((s) => s.prestada);
  const residir = root.querySelector<HTMLButtonElement>('#btn-residir');
  if (residir && prestadas.length > 0) {
    // El cuadro del juego no bloquea: se para el clic, se pregunta y, si acepta, se repite el clic dejándolo pasar.
    let confirmado = false;
    residir.addEventListener('click', (ev) => {
      if (confirmado) { confirmado = false; return; }
      ev.stopImmediatePropagation();
      void confirmar(`Si resides aquí, el campamento donde te prestaron tropa la retira (${prestadas.map((s) => `${s.nombre}: ${s.cantidad}`).join(', ')}).`, { titulo: '¿Residir aquí?', aceptar: 'Residir aquí' })
        .then((ok) => { if (ok) { confirmado = true; residir.click(); } });
    }, true);
  }
  conBoton('#btn-residir', 'residirEnCampamento', () => ({ heroeId, campamentoId: c.id }));
  root.querySelector<HTMLSelectElement>('#reclutar-pagar-con')?.addEventListener('change', (ev) => { pagarConElegido = (ev.target as HTMLSelectElement).value as typeof pagarConElegido; opciones.repintar(); });
  cablearTropa(root, p, ejecutar);
  cablearMercado(root, c, opciones);
  cablearTablonMercenarios(root, ejecutar, (m) => { if (error) error.textContent = m; }, opciones.repintar);
  for (const tipo of ['aportarARefundacion', 'retirarDeRefundacion']) {
    conBoton(`[data-fondo="${tipo}"]`, tipo, () => ({
      recurso: root.querySelector<HTMLSelectElement>('#fondo-recurso')?.value ?? '',
      cantidad: Number(root.querySelector<HTMLInputElement>('#fondo-cantidad')?.value ?? 0),
      lado: root.querySelector<HTMLSelectElement>('#fondo-recurso')?.selectedOptions[0]?.dataset.lado ?? (c.residentesIds.includes(heroeId) ? 'almacen' : 'carro'),
    }));
  }
  conBoton('[data-vaciar-carro]', 'vaciarCarro', () => ({ heroeId }));
  conBoton('#btn-comprar-caravana', 'comprarCaravanaDeRefundacion', () => ({}));
  root.querySelector<HTMLButtonElement>('#fondo-lo-que-falta')?.addEventListener('click', () => {
    const opcion = root.querySelector<HTMLSelectElement>('#fondo-recurso')?.selectedOptions[0];
    const cantidad = root.querySelector<HTMLInputElement>('#fondo-cantidad');
    if (!opcion || !cantidad) return;
    const falta = Number(opcion.dataset.falta);
    cantidad.value = String(Math.max(1, Math.min(Number(opcion.dataset.tienes), falta > 0 ? falta : Number(opcion.dataset.tienes))));
  });
}
