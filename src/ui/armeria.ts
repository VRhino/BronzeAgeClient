// LA ARMERÍA DE LA PLAZA (0.207.0, motor 457c278; Heroe_Y_Tropa §4.6, Objetos_Del_Heroe §3.3 y §3.4): la ventana «Armería» del riel, dentro de
// cualquier plaza con la Armería activa (también ajena, si la puerta te dejó entrar).
//  - Tienda: `comprarObjeto { objeto }` (armas, armaduras y monturas hasta `tiendaHastaTier`, con el metal que abre la Facción de la plaza) y
//    `venderObjeto { casilla, cantidad }` (cualquier objeto de la mochila, a `ventaPct` de su ficha; una forjada vale lo mismo).
//  - Forja: `forjarObjeto { objeto }` (tiers II a V) si la forja está abierta a tu grupo (tu Facción, siempre), con los metales de la plaza y la Era
//    del mundo; gasta un plano y crisoles de la mochila, los materiales que tienes a mano (en tu residencia, tu almacén personal y tu carro; en otra
//    plaza, el carro de la columna con la que entraste) y el impuesto en monedas, que va al fondo de la plaza.
//  - Abrir la forja: `configurarForja { asentamientoId, grupo, abierta, recargoPct }`, solo el Tesorero o el Gobernador, residentes y dentro.
// Regla de interfaz: cada botón sale solo cuando se puede; lo que no, se dice en una línea. Ninguna cifra copiada: todo sale de `OBJETOS`.
import { catalogoDeTecnologia, type ProyeccionJugador } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { AperturaForja, Asentamiento, GrupoForja, ItemInstancia } from '../tiposDominio';
import { ayuda } from './ayuda';
import { catalogoDeObjetos, nombreDeClase, type FichaObjeto } from './clasesHeroe';
import { columnaQuePaga } from './columnaQuePaga';
import { claveDeRareza } from './fichaCombate';
import { cifrasDe, htmlCifras, htmlFichaDePieza, iconoDeObjeto, libresEn, nombreDeObjeto, pesosDeLaClase, rarezaDeObjeto, textoDeTipo } from './objetosHeroe';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: Record<string, unknown>) => Promise<string | null>;
/** Tu grupo en la plaza, como el de la puerta: tu Facción, aliados (alianza o vasallaje), enemigos (guerra) o neutrales. */
export type GrupoDeForja = 'misma' | GrupoForja;
export type PestanaArmeria = 'tienda' | 'forja' | 'abrir';

const miles = (n: number): string => Math.floor(n).toLocaleString('es-ES');
const NOMBRE_GRUPO: Record<GrupoDeForja, string> = { misma: 'miembro de la Facción', aliados: 'aliado', neutrales: 'neutral', enemigos: 'enemigo' };
export const GRUPOS_DE_FUERA: readonly [GrupoForja, string, string][] = [['aliados', '🤝', 'Aliados'], ['neutrales', '🕊️', 'Neutrales'], ['enemigos', '⚔️', 'Enemigos']];

// ── Las reglas ──

/** Tu grupo respecto de la plaza `a` (`grupo_de_puerta` del motor): por la Facción y las relaciones activas entre las dos. */
export function grupoEnPlaza(p: ProyeccionJugador, a: Pick<Asentamiento, 'faccionId'>): GrupoDeForja {
  if (p.faccionId && a.faccionId === p.faccionId) return 'misma';
  if (!p.faccionId || !a.faccionId) return 'neutrales';
  const entre = (x: string, y: string): boolean => (x === p.faccionId && y === a.faccionId) || (x === a.faccionId && y === p.faccionId);
  const activas = (p.relaciones ?? []).filter((r) => r.estado === 'activa' && entre(r.faccionAId, r.faccionBId));
  if (activas.some((r) => r.tipo === 'guerra')) return 'enemigos';
  if (activas.some((r) => r.tipo === 'alianza' || r.tipo === 'vasallaje')) return 'aliados';
  return 'neutrales';
}

/** La forja para tu grupo: la misma Facción, siempre abierta y sin recargo; los de fuera, lo que puso la plaza (de partida, cerrada). */
export function aperturaPara(a: Pick<Asentamiento, 'forja'>, g: GrupoDeForja): AperturaForja {
  if (g === 'misma') return { abierta: true, recargoPct: 0 };
  return a.forja?.[g] ?? { abierta: false, recargoPct: catalogoDeObjetos()?.forja?.recargoInicialPct ?? 100 };
}

/** El impuesto de forjar una pieza de tier `tier` con el recargo `recargoPct` (`impuestoPorTier × (100 + r) / 100`, hacia abajo), o `null` sin datos. */
export function impuestoDeForja(tier: number, recargoPct: number): number | null {
  const base = catalogoDeObjetos()?.forja?.impuestoPorTier[String(tier)];
  return base === undefined ? null : Math.floor((base * (100 + recargoPct)) / 100);
}

/** El `orden` de la Era del mundo (1 a 5), de `ERAS`; 1 sin datos. */
export function ordenDeEraDelMundo(p: ProyeccionJugador): number {
  const era = p.tecnologia?.era;
  return (era ? catalogoDeTecnologia()?.ERAS?.[era]?.orden : undefined) ?? 1;
}
/** La Era que pide forjar una pieza de ese tier (0: ninguna). */
export const eraDelTier = (tier: number): number => catalogoDeObjetos()?.forja?.eraPorTier[String(tier)] ?? 0;

/** ¿Abre la Armería de esta plaza el metal de la pieza? `inicio` y las monturas no piden tecnología. */
export function metalAbierto(a: Pick<Asentamiento, 'metalesArmeria'>, f: FichaObjeto): boolean {
  return f.tipo === 'montura' || !f.metal || f.metal === 'inicio' || (a.metalesArmeria ?? []).includes(f.metal);
}

/** Lo que vende la tienda de esta plaza: armas, armaduras y monturas hasta `tiendaHastaTier`, con su metal abierto. */
export function piezasDeTienda(a: Pick<Asentamiento, 'metalesArmeria'>): FichaObjeto[] {
  const cat = catalogoDeObjetos();
  const hasta = cat?.tiendaHastaTier ?? 2;
  return (cat?.objetos ?? []).filter((f) => (f.tipo === 'arma' || f.tipo === 'armadura' || f.tipo === 'montura') && f.tier !== null && f.tier <= hasta && metalAbierto(a, f));
}

/** Lo que te paga la tienda por una unidad: `ventaPct` del precio de su ficha, hacia abajo. */
export const precioDeVenta = (f: Pick<FichaObjeto, 'precio'>): number => Math.floor((f.precio * (catalogoDeObjetos()?.ventaPct ?? 50)) / 100);

/** Los materiales que tienes a mano para forjar en esta plaza (`Nucleo::carro_dentro`): en tu residencia, tu almacén personal y tu carro (el de la
 * columna que llevas, si vas en una); en otra plaza, el carro de la columna con la que entraste. */
export function materialesAMano(p: ProyeccionJugador, resideAqui: boolean): { recursos: Record<string, number>; donde: string } {
  const columna = columnaQuePaga(p);
  const carro = columna ? columna.suministro ?? {} : resideAqui ? p.heroe.carro ?? {} : {};
  const personal = resideAqui ? p.heroe.almacenPersonal ?? {} : {};
  const recursos: Record<string, number> = { ...personal };
  for (const [r, n] of Object.entries(carro)) recursos[r] = (recursos[r] ?? 0) + n;
  const donde = resideAqui ? `de tu almacén personal y, lo que falte, de ${columna ? 'el carro de tu columna' : 'tu carro'}` : columna ? 'del carro de la columna con la que entraste' : 'de ningún sitio: no entraste con tu columna';
  return { recursos, donde };
}

/** Cuántas hay de una pieza en la mochila (todas sus casillas). */
const enMochila = (inv: readonly ItemInstancia[], id: string): number => inv.filter((x) => x.itemDefinitionId === id).reduce((t, x) => t + x.cantidad, 0);

/** Una receta que se puede forjar en esta plaza: su impuesto con tu recargo y lo que te falta para forjarla ya (vacío: se puede). */
export interface RecetaEnForja { f: FichaObjeto; tier: number; impuesto: number; faltan: string[] }

/**
 * Las recetas de esta plaza para ti, si su forja está abierta a tu grupo: las piezas con receta (tiers II a V) de los metales que abre su Armería
 * y cuyo tier ya abrió la Era del mundo. Cada una dice lo que te falta: el plano, los crisoles, una casilla en la mochila (la del plano o los
 * crisoles cuenta si se gastan enteros), los materiales a mano y las monedas del impuesto.
 */
export function recetasDeForja(p: ProyeccionJugador, a: Asentamiento, resideAqui: boolean): RecetaEnForja[] {
  const cat = catalogoDeObjetos();
  if (!cat?.forja) return [];
  const ap = aperturaPara(a, grupoEnPlaza(p, a));
  if (!ap.abierta) return [];
  const era = ordenDeEraDelMundo(p);
  const mano = materialesAMano(p, resideAqui).recursos;
  const inv = p.heroe.inventario;
  const monedas = p.heroe.monedas ?? 0;
  const libres = libresEn(p.heroe, 'mochila');
  return cat.objetos.filter((f) => f.forja && f.tier !== null && f.tier >= 2 && metalAbierto(a, f) && eraDelTier(f.tier) <= era).map((f) => {
    const r = f.forja!, tier = f.tier!;
    const impuesto = impuestoDeForja(tier, ap.recargoPct) ?? 0;
    const plano = `plano_${r.plano}`;
    const [planos, crisoles] = [enMochila(inv, plano), enMochila(inv, 'crisol')];
    const faltan: string[] = [];
    if (planos < 1) faltan.push(`un ${nombreDeObjeto(plano)}`);
    if (crisoles < r.crisoles) faltan.push(`${r.crisoles - crisoles} ${r.crisoles - crisoles === 1 ? 'crisol' : 'crisoles'}`);
    const sueltan = (planos === 1 ? 1 : 0) + (r.crisoles > 0 && crisoles === r.crisoles ? 1 : 0);
    if (libres + sueltan < 1) faltan.push('una casilla libre en la mochila');
    for (const [m, n] of Object.entries(r.materiales)) {
      const hay = Math.floor(mano[m] ?? 0);
      if (hay < n) faltan.push(`${n - hay} de ${RECURSO_NOMBRE[m] ?? m}`);
    }
    if (monedas < impuesto) faltan.push(`${miles(impuesto - monedas)} monedas`);
    return { f, tier, impuesto, faltan };
  });
}

/** ¿Puede este héroe abrir y cerrar la forja de la plaza? El Tesorero o el Gobernador, residente y dentro. */
export function puedeAbrirLaForja(p: ProyeccionJugador, a: Asentamiento, resideAqui: boolean): boolean {
  const u = p.heroe.ubicacion;
  const dentro = u.tipo === 'asentamiento' && u.asentamientoId === a.id;
  return dentro && resideAqui && (a.cargos?.tesoreroId === p.heroeId || a.cargos?.gobernadorId === p.heroeId);
}

/** Las pestañas que tiene la ventana para ti: la tienda siempre; la forja si está abierta a tu grupo; abrirla, si tienes el cargo. */
export function pestanasDeArmeria(p: ProyeccionJugador, a: Asentamiento, resideAqui: boolean): [PestanaArmeria, string][] {
  return [
    ['tienda', 'Tienda'],
    ...(aperturaPara(a, grupoEnPlaza(p, a)).abierta ? [['forja', 'Forja'] as [PestanaArmeria, string]] : []),
    ...(puedeAbrirLaForja(p, a, resideAqui) ? [['abrir', 'Abrir la forja'] as [PestanaArmeria, string]] : []),
  ];
}

// ── Lo que se ve ──

/** Qué enseña la tienda (armas, armaduras o monturas) y si solo lo de tu clase; se recuerda entre repintados. */
let tipoTienda: 'arma' | 'armadura' | 'montura' = 'armadura';
let soloMiClase = true;
/** El borrador de «Abrir la forja», por grupo, hasta que se guarda. */
const borradorForja = new Map<string, AperturaForja>();

/** ¿Es de tu clase? Un arma de la clase de la tuya; una armadura de un peso que admite; lo demás, sí. */
function deMiClase(p: ProyeccionJugador, f: FichaObjeto): boolean {
  if (f.tipo === 'arma') return f.clase === claseDeArma(p);
  if (f.tipo === 'armadura') return pesosDeLaClase(p.heroe).includes(f.tipoArmadura ?? '');
  return true;
}
const claseDeArma = (p: ProyeccionJugador): string => catalogoDeObjetos()?.objetos.find((o) => o.id === p.heroe.equipamiento.arma?.itemDefinitionId)?.clase ?? p.heroe.classDefinitionId;

const HUECO_ORDEN = ['arma', 'casco', 'torso', 'guantes', 'pantalones', 'botas', 'montura'];
const PESO_ORDEN = ['ligera', 'media', 'pesada'];
const ordenar = (x: FichaObjeto, y: FichaObjeto): number =>
  (x.tier ?? 0) - (y.tier ?? 0) || HUECO_ORDEN.indexOf(x.hueco ?? x.tipo) - HUECO_ORDEN.indexOf(y.hueco ?? y.tipo)
  || PESO_ORDEN.indexOf(x.tipoArmadura ?? '') - PESO_ORDEN.indexOf(y.tipoArmadura ?? '') || x.nombre.localeCompare(y.nombre);

/** La pieza que miras en cada lado de la tienda (la de la venta, por su casilla); se recuerdan entre repintados. */
let elegidaTienda: string | null = null;
let elegidaVenta: number | null = null;
/** Hasta dónde bajaste la ventana de la tienda, para no volver arriba al comprar o filtrar. */
let scrollDeTienda = 0;

/** Una casilla de la rejilla: el icono con el borde del color de su rareza, como en la mochila; `cuantas` y `forjada` son sus marcas. */
function casilla(atributo: string, valorAtributo: string, id: string, nombre: string, elegida: boolean, e: Escapar, cuantas = 1, forjada = false): string {
  return `<button type="button" class="obj-casilla ${rarezaDeObjeto(id)}${elegida ? ' elegida' : ''}" ${atributo}="${e(valorAtributo)}" aria-pressed="${elegida}" title="${e(nombre)}${cuantas > 1 ? ` ×${cuantas}` : ''}${forjada ? ' (forjada)' : ''}"><i aria-hidden="true">${iconoDeObjeto(id)}</i>${cuantas > 1 ? `<b>${cuantas}</b>` : ''}${forjada ? '<em aria-hidden="true">✦</em>' : ''}<span class="ta-sr">${e(nombre)}</span></button>`;
}

function htmlTienda(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const monedas = p.heroe.monedas ?? 0;
  const libres = libresEn(p.heroe, 'mochila');
  const todas = piezasDeTienda(a);
  const tipos = (['arma', 'armadura', 'montura'] as const).filter((t) => todas.some((f) => f.tipo === t));
  if (!tipos.includes(tipoTienda)) tipoTienda = tipos[0] ?? 'armadura';
  const lista = todas.filter((f) => f.tipo === tipoTienda && (!soloMiClase || deMiClase(p, f))).sort(ordenar);
  // lo que vende: una casilla por pieza y, escondida hasta tocarla, su ficha con el precio y Comprar
  if (!lista.some((f) => f.id === elegidaTienda)) elegidaTienda = null;
  const casillasCompra = lista.map((f) => casilla('data-arm-ver', f.id, f.id, f.nombre, f.id === elegidaTienda, e)).join('');
  const detallesCompra = lista.map((f) => {
    const falta = f.precio - monedas;
    const accion = libres < 1 ? '<small class="arm-falta">La mochila está llena.</small>' : falta > 0
      ? `<small class="arm-falta">Te faltan ${miles(falta)}</small>`
      : `<button class="btn-primary" type="button" data-arm-comprar="${e(f.id)}">Comprar</button>`;
    const pie = `<div class="arm-ficha-pie"><span class="arm-precio${falta > 0 ? ' caro' : ''}">💰 ${miles(f.precio)}</span>${accion}</div>`;
    return `<div class="arm-detalle" data-arm-detalle="${e(f.id)}"${f.id === elegidaTienda ? '' : ' hidden'}>${htmlFichaDePieza({ itemDefinitionId: f.id }, e, '', pie)}</div>`;
  }).join('');
  const NOMBRE_TIPO = { arma: 'Armas', armadura: 'Armaduras', montura: 'Monturas' } as const;
  const filtros = `<div class="arm-filtros">${tipos.map((t) => `<button type="button" class="obra-chip arm-chip${t === tipoTienda ? ' activo' : ''}" data-arm-tipo="${t}" aria-pressed="${t === tipoTienda}">${NOMBRE_TIPO[t]}</button>`).join('')}
    ${tipoTienda !== 'montura' ? `<label class="arm-solo"><input type="checkbox" data-arm-solo${soloMiClase ? ' checked' : ''}> Solo lo de tu clase (${e(nombreDeClase(claseDeArma(p)))})</label>` : ''}</div>`;

  // lo que vendes: tu mochila entera en casillas, cada una en su sitio; la ficha trae la cantidad y Vender
  const total = catalogoDeObjetos()?.casillasMochila ?? 72;
  const porCasilla = new Map(p.heroe.inventario.map((it) => [it.casillaInventario, it]));
  if (elegidaVenta !== null && !porCasilla.has(elegidaVenta)) elegidaVenta = null;
  // hasta la última fila con algo y una más; las demás casillas libres se cuentan en una línea
  const visibles = Math.min(total, Math.max(24, (Math.floor(Math.max(-1, ...porCasilla.keys()) / 12) + 2) * 12));
  const casillasVenta = Array.from({ length: visibles }, (_, n) => {
    const it = porCasilla.get(n);
    const f = it ? catalogoDeObjetos()?.objetos.find((o) => o.id === it.itemDefinitionId) : undefined;
    return it && f ? casilla('data-arm-ver-venta', String(n), f.id, f.nombre, n === elegidaVenta, e, it.cantidad, Boolean(it.itemInstanceId)) : '<span class="obj-casilla vacia" aria-hidden="true"></span>';
  }).join('');
  const detallesVenta = p.heroe.inventario.map((it) => {
    const f = catalogoDeObjetos()?.objetos.find((o) => o.id === it.itemDefinitionId);
    if (!f) return '';
    const cuantas = it.cantidad > 1 ? `<input class="form-input obj-cantidad" type="number" min="1" max="${it.cantidad}" value="1" data-arm-cantidad aria-label="Cuántas" />` : '';
    const nota = it.itemInstanceId ? '<p class="obj-forjada">✦ Forjada: sus cifras, por la calidad que le salió.</p>' : '';
    const pie = `<div class="arm-ficha-pie"><span class="arm-precio">💰 ${miles(precioDeVenta(f))}${it.cantidad > 1 ? ' c/u' : ''}</span><span class="obj-mover">${cuantas}<button class="btn-secondary" type="button" data-arm-vender="${it.casillaInventario}">Vender</button></span></div>`;
    return `<div class="arm-detalle" data-arm-detalle="${it.casillaInventario}"${it.casillaInventario === elegidaVenta ? '' : ' hidden'}>${htmlFichaDePieza(it, e, nota, pie)}</div>`;
  }).join('');
  const pista = (elegida: boolean, texto: string): string => `<p class="mapa-lista-vacia arm-pista"${elegida ? ' hidden' : ''}>${texto}</p>`;
  return `<div class="arm-tienda"><div class="arm-cab"><span class="arm-saldo">💰 <strong>${miles(monedas)}</strong> monedas</span><span class="arm-saldo">🎒 ${p.heroe.inventario.length}/${total}</span>
      ${libres < 1 ? '<p class="asent-lado-nota">La mochila está llena: vende algo o guárdalo en tu almacén de objetos antes de comprar.</p>' : ''}</div>
    <div class="cols-completa arm-cols">
      <section class="col-completa arm-panel" data-arm-panel="comprar"><div class="obra-titulo"><span class="faction-kicker">Comprar</span>${ayuda('armeria:tienda', `Al 100\u00a0%, con tus monedas, y a tu mochila. Vende armas, armaduras y monturas hasta el tier ${catalogoDeObjetos()?.tiendaHastaTier ?? 2}, con los metales que abre la tecnología de la Facción de esta plaza. Lo mejor se forja.`)}</div>
        ${filtros}<div class="arm-rejilla">${casillasCompra || '<p class="mapa-lista-vacia">Nada de esto a la venta aquí.</p>'}</div>
        ${lista.length ? pista(elegidaTienda !== null, 'Toca una pieza para ver su ficha y comprarla.') : ''}${detallesCompra}</section>
      <section class="col-completa arm-panel" data-arm-panel="vender"><div class="obra-titulo"><span class="faction-kicker">Vender</span>${ayuda('armeria:vender', `Cualquier cosa de tu mochila, al ${catalogoDeObjetos()?.ventaPct ?? 50}\u00a0% del precio de su ficha. Una pieza forjada vale lo mismo que la de tienda. Lo que llevas puesto no se vende: quítatelo antes.`)}</div>
        <div class="arm-rejilla">${casillasVenta}</div>${visibles < total ? `<p class="obj-nota">Y ${total - visibles} casillas libres más.</p>` : ''}
        ${p.heroe.inventario.length ? pista(elegidaVenta !== null, 'Toca una pieza de tu mochila para ver su ficha y venderla.') : '<p class="mapa-lista-vacia">Tu mochila está vacía.</p>'}${detallesVenta}</section>
    </div></div>`;
}

// ── La forja: un banco de trabajo, no una lista ──
// A la izquierda, el estante: una casilla por pieza, agrupadas por hueco, encendidas las que ya puedes forjar. A la derecha, el banco: la receta de
// la pieza elegida en ranuras (lo que pide y lo que tienes), el yunque con la pieza que sale, su calidad, sus cifras y el martillo.

/** La pieza elegida en el banco y hasta dónde bajaste el estante; se recuerdan entre repintados. */
let elegidaEnForja: string | null = null;
let scrollDeForja = 0;

// Forjar se ve (0.217.0): al pulsar «Forjar» el banco trabaja `DURACION_FORJA_MS` con su barra y solo entonces sale la orden; cuando la pieza llega
// a la mochila, su ficha tapa la pestaña hasta pulsar «Continuar». El estado vive aquí para que un repintado a medias no lo pierda.
export const DURACION_FORJA_MS = 3000;
/** La pieza que el banco está forjando y desde cuándo. */
let enCurso: { objeto: string; desde: number } | null = null;
/** La orden ya salió: la pieza nueva es la forjada de ese objeto que no estaba en `antes`. */
let esperando: { objeto: string; antes: Set<string> } | null = null;
/** La pieza recién forjada, a la vista hasta «Continuar». */
let premio: Pick<ItemInstancia, 'itemDefinitionId' | 'itemInstanceId' | 'estadisticas'> | null = null;
/** Las forjadas que había en la mochila en el último pintado. */
let forjadasVistas = new Set<string>();
/** La calidad que le salió a cada pieza forjada (`heroe.objeto_forjado`), por su `itemInstanceId`. */
const calidadDeForjada = new Map<string, number>();
/** La ventana pintada ahora, para acabar la forja aunque se haya repintado entretanto. */
let ventanaViva: { root: HTMLElement; ejecutar: Ejecutar; repintar: () => void } | null = null;

const textoDeCalidad = (c: number): string => `✦ Forjada con una calidad del ${c}\u00a0%`;
/** El hecho `heroe.objeto_forjado` dice la calidad de la pieza `pieza` (`obj-N`): se apunta y, si su ficha está a la vista, se escribe. */
export function anotarCalidadDeForja(pieza: number | string, calidad: number): void {
  const id = String(pieza).startsWith('obj-') ? String(pieza) : `obj-${pieza}`;
  calidadDeForjada.set(id, calidad);
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLElement>('[data-fj-calidad]').forEach((x) => { if (x.dataset.fjCalidad === id) x.textContent = `${textoDeCalidad(calidad)}.`; });
}

/** La ficha de la pieza recién forjada, centrada sobre la pestaña, con «Continuar». */
function htmlPremio(e: Escapar): string {
  if (!premio) return '';
  const f = catalogoDeObjetos()?.objetos.find((o) => o.id === premio!.itemDefinitionId);
  const id = premio.itemInstanceId ?? '';
  const c = calidadDeForjada.get(id);
  const nota = `<p class="obj-forjada" data-fj-calidad="${e(id)}">${c !== undefined ? `${textoDeCalidad(c)}.` : '✦ Forjada.'}</p>`;
  return `<div class="fj-premio r-${f?.tier ? e(claveDeRareza(f.tier)) : 'ninguna'}" role="dialog" aria-label="Pieza forjada">
    <span class="fj-premio-rotulo">Pieza forjada</span>
    ${htmlFichaDePieza(premio, e, nota)}
    <small class="fj-premio-donde">Ya está en tu mochila.</small>
    <button class="btn-primary fj-continuar" type="button" data-arm-continuar>Continuar</button></div>`;
}
const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];
const NOMBRE_GRUPO_HUECO: Record<string, string> = { arma: 'Armas', casco: 'Cascos', torso: 'Torso', guantes: 'Guantes', pantalones: 'Pantalones', botas: 'Botas', montura: 'Monturas' };

/** Una ranura de la receta: el icono, cuánto pide y cuánto tienes; en rojo si no llega. */
const ranura = (icono: string, pide: number, hay: number, nombre: string, e: Escapar): string =>
  `<span class="fj-ranura${hay < pide ? ' falta' : ''}" title="${e(nombre)}: pide ${miles(pide)}, tienes ${miles(hay)}"><i aria-hidden="true">${icono}</i><b>×${miles(pide)}</b><small>${e(nombre)}</small><em>tienes ${miles(hay)}</em></span>`;

function htmlForja(p: ProyeccionJugador, a: Asentamiento, resideAqui: boolean, e: Escapar): string {
  const g = grupoEnPlaza(p, a);
  const ap = aperturaPara(a, g);
  const mano = materialesAMano(p, resideAqui);
  const inv = p.heroe.inventario;
  const monedas = p.heroe.monedas ?? 0;
  const hay = (m: string): number => Math.floor(mano.recursos[m] ?? 0);
  const recetas = recetasDeForja(p, a, resideAqui).filter((r) => !soloMiClase || deMiClase(p, r.f)).sort((x, y) => ordenar(x.f, y.f));
  const listas = recetas.filter((r) => r.faltan.length === 0);
  // la forja en marcha: la pieza nueva de la mochila es el premio; mientras, el banco se queda en la que se está forjando
  const forjadas = inv.filter((x) => x.itemInstanceId);
  if (esperando) {
    const nueva = forjadas.find((x) => x.itemDefinitionId === esperando!.objeto && !esperando!.antes.has(x.itemInstanceId!));
    if (nueva) { premio = nueva; esperando = null; enCurso = null; }
  }
  forjadasVistas = new Set(forjadas.map((x) => x.itemInstanceId!));
  if (enCurso && recetas.some((r) => r.f.id === enCurso!.objeto)) elegidaEnForja = enCurso.objeto;
  if (!recetas.some((r) => r.f.id === elegidaEnForja)) elegidaEnForja = (listas[0] ?? recetas[0])?.f.id ?? null;
  const era = ordenDeEraDelMundo(p);
  const tiers = [2, 3, 4, 5].filter((t) => eraDelTier(t) <= era);

  // lo que tienes a mano para forjar: monedas, crisoles, los planos y los materiales que piden estas recetas
  const planos = [...new Set(recetas.map((r) => r.f.forja!.plano))].sort((x, y) => x - y);
  const materiales = [...new Set(recetas.flatMap((r) => Object.keys(r.f.forja!.materiales)))];
  const tengo = (icono: string, n: number, nombre: string): string => `<span class="fj-tengo${n > 0 ? '' : ' nada'}" title="${e(nombre)}">${icono} <strong>${miles(n)}</strong><span class="ta-sr"> ${e(nombre)}</span></span>`;
  const aMano = [
    tengo('💰', monedas, 'monedas'),
    ...planos.map((n) => tengo(`📜<sub>${ROMANO[n] ?? n}</sub>`, enMochila(inv, `plano_${n}`), nombreDeObjeto(`plano_${n}`))),
    tengo('🏺', enMochila(inv, 'crisol'), 'crisoles'),
    ...materiales.map((m) => tengo(RECURSO_ICONO[m] ?? '📦', hay(m), RECURSO_NOMBRE[m] ?? m)),
  ].join('');
  const recargo = ap.recargoPct ? `, con un recargo del ${ap.recargoPct} % por forjar como ${NOMBRE_GRUPO[g]}` : '';
  const explicacion = `Elige una pieza del estante y mira su receta en el banco. Forjar gasta un plano de su tier y sus crisoles de tu mochila, los materiales de la receta y el impuesto en monedas${recargo}, que va al fondo de la plaza. Los materiales salen ${mano.donde}. La pieza sale con una calidad al azar en su rango, que multiplica todas sus cifras, y va a tu mochila. La Era del mundo abre ${tiers.length > 1 ? `los tiers ${tiers.map((t) => ROMANO[t]).join(', ')}` : 'el tier II'}.`;

  // el estante: una casilla por pieza, por hueco
  const casilla = (r: RecetaEnForja): string => {
    const lista = r.faltan.length === 0;
    return `<button type="button" class="fj-pieza r-${e(claveDeRareza(r.tier))}${lista ? ' lista' : ''}${r.f.id === elegidaEnForja ? ' elegida' : ''}" data-arm-elegir="${e(r.f.id)}" aria-pressed="${r.f.id === elegidaEnForja}" title="${e(r.f.nombre)}${lista ? '' : ` · te falta: ${e(r.faltan.join(', '))}`}">
      <b class="fj-tier">${ROMANO[r.tier] ?? r.tier}</b><i aria-hidden="true">${iconoDeObjeto(r.f.id)}</i><span>${e(r.f.nombre)}</span></button>`;
  };
  const grupos = HUECO_ORDEN.map((h) => [h, recetas.filter((r) => (r.f.hueco ?? r.f.tipo) === h)] as const).filter(([, rs]) => rs.length)
    .map(([h, rs]) => `<div class="fj-grupo"><span class="fj-grupo-nombre">${NOMBRE_GRUPO_HUECO[h] ?? h}</span><div class="fj-rejilla">${rs.map(casilla).join('')}</div></div>`).join('');

  // el banco: la receta en ranuras, el yunque con la pieza que sale, sus cifras y el martillo
  const banco = (r: RecetaEnForja): string => {
    const x = r.f.forja!;
    const plano = `plano_${x.plano}`;
    const rz = e(claveDeRareza(r.tier));
    const lista = r.faltan.length === 0;
    const metal = r.f.metal && r.f.metal !== 'inicio' ? ` · ${e(r.f.metal.replace(/_/g, ' '))}` : '';
    const ranuras = [
      ranura(`📜<sub>${ROMANO[x.plano] ?? x.plano}</sub>`, 1, enMochila(inv, plano), `Plano ${ROMANO[x.plano] ?? x.plano}`, e),
      ...(x.crisoles > 0 ? [ranura('🏺', x.crisoles, enMochila(inv, 'crisol'), x.crisoles === 1 ? 'Crisol' : 'Crisoles', e)] : []),
      ...Object.entries(x.materiales).map(([m, n]) => ranura(RECURSO_ICONO[m] ?? '📦', n, hay(m), RECURSO_NOMBRE[m] ?? m, e)),
    ].join('');
    const [min, max] = x.calidad;
    const forjando = enCurso?.objeto === r.f.id;
    const pie = forjando
      ? `<div class="fj-progreso" role="progressbar" aria-label="Forjando"><span style="animation-duration:${DURACION_FORJA_MS}ms;animation-delay:-${Math.min(DURACION_FORJA_MS, Date.now() - enCurso!.desde)}ms"></span><b>Forjando…</b></div>`
      : lista
      ? `<button class="btn-primary fj-martillo" type="button" data-arm-forjar="${e(r.f.id)}"><span aria-hidden="true">⚒️</span> Forjar <em>💰 ${miles(r.impuesto)}</em></button>`
      : `<p class="fj-falta">Te ${r.faltan.length === 1 && /^(un|una|1) /.test(r.faltan[0]!) ? 'falta' : 'faltan'} ${e(r.faltan.join(', '))}.</p><span class="fj-impuesto${monedas < r.impuesto ? ' falta' : ''}">Impuesto 💰 ${miles(r.impuesto)}</span>`;
    return `<section class="fj-banco r-${rz}${lista ? ' lista' : ''}${forjando ? ' forjando' : ''}" data-fj-banco="${e(r.f.id)}"${r.f.id === elegidaEnForja ? '' : ' hidden'}>
      <header class="fj-banco-cab"><h3>${e(r.f.nombre)}</h3><small>${e(textoDeTipo(r.f))}${metal}</small></header>
      <div class="fj-escena">
        <div class="fj-ranuras">${ranuras}</div>
        <span class="fj-golpe" aria-hidden="true"><i>⚒️</i></span>
        <div class="fj-sale">
          <div class="fj-sale-pieza"><span class="fj-resultado"><i aria-hidden="true">${iconoDeObjeto(r.f.id)}</i><b class="fj-tier">${ROMANO[r.tier] ?? r.tier}</b></span>
            <span class="fj-calidad" title="La calidad sale al azar en este rango y multiplica todas las cifras de la pieza. La de tienda es del 100\u00a0%."><span class="fj-calidad-barra" aria-hidden="true"></span>calidad ${min} a ${max}\u00a0%</span></div>
          <div class="fj-cifras">${htmlCifras(cifrasDe({ itemDefinitionId: r.f.id }))}</div>
        </div>
      </div>
      <footer class="fj-pie">${pie}</footer>
    </section>`;
  };

  if (!recetas.length) {
    return `<div class="fj">${htmlPremio(e)}<div class="fj-barra"><div class="fj-a-mano">${aMano}</div>
        <label class="arm-solo"><input type="checkbox" data-arm-solo${soloMiClase ? ' checked' : ''}> Solo lo de tu clase (${e(nombreDeClase(claseDeArma(p)))})</label>${ayuda('armeria:forja', explicacion)}</div>
      <p class="mapa-lista-vacia">Esta forja no tiene recetas ${soloMiClase ? 'para tu clase' : 'todavía'}.</p></div>`;
  }
  return `<div class="fj${enCurso ? ' forjando' : ''}">${htmlPremio(e)}
    <div class="fj-barra"><div class="fj-a-mano" aria-label="Lo que tienes a mano">${aMano}</div>
      <span class="fj-cuenta">Puedes forjar <strong>${listas.length}</strong> de ${recetas.length}</span>
      <label class="arm-solo"><input type="checkbox" data-arm-solo${soloMiClase ? ' checked' : ''}> Solo lo de tu clase (${e(nombreDeClase(claseDeArma(p)))})</label>${ayuda('armeria:forja', explicacion)}</div>
    ${mano.donde.startsWith('de ningún sitio') ? `<p class="fj-falta">Los materiales salen ${e(mano.donde)}.</p>` : ''}
    <div class="fj-mesa"><div class="fj-estante">${grupos}</div><div class="fj-bancos">${recetas.map(banco).join('')}</div></div>
  </div>`;
}

const textoRecargo = (r: number): string => (r === 0 ? 'sin recargo' : `+${r} % (×${(100 + r) / 100})`);

function htmlAbrirForja(a: Asentamiento): string {
  const reglas = catalogoDeObjetos()?.forja;
  const recargos = reglas?.recargosPct ?? [0, 100, 200, 500];
  const filas = GRUPOS_DE_FUERA.map(([g, icono, nombre]) => {
    const actual = aperturaPara(a, g);
    const b = borradorForja.get(`${a.id}|${g}`) ?? actual;
    const cambia = b.abierta !== actual.abierta || b.recargoPct !== actual.recargoPct;
    const ejemplo = impuestoDeForja(2, b.recargoPct);
    const puerta = (a.puertaCerradaA ?? []).includes(g) ? `<small class="arm-falta">Tu puerta está cerrada a los ${nombre.toLowerCase()}: no entran a forjar.</small>` : '';
    return `<li class="arm-fila arm-grupo" data-arm-grupo="${g}"><span class="arm-pieza-icono" aria-hidden="true">${icono}</span>
      <span class="arm-pieza-texto"><strong>${nombre}</strong><small>${actual.abierta ? `Abierta, ${textoRecargo(actual.recargoPct)}` : 'Cerrada'}</small>${puerta}</span>
      <label class="arm-campo"><span>Forja</span><select class="form-input" data-arm-abierta><option value="1"${b.abierta ? ' selected' : ''}>Abierta</option><option value="0"${b.abierta ? '' : ' selected'}>Cerrada</option></select></label>
      <label class="arm-campo"><span>Recargo</span><select class="form-input" data-arm-recargo>${recargos.map((r) => `<option value="${r}"${r === b.recargoPct ? ' selected' : ''}>${textoRecargo(r)}</option>`).join('')}</select></label>
      <span class="arm-accion"><small>un tier II paga ${ejemplo !== null ? `${miles(ejemplo)} monedas` : '—'}</small><button class="btn-primary btn-chico" type="button" data-arm-guardar="${g}"${cambia ? '' : ' disabled'}>Guardar</button></span></li>`;
  }).join('');
  return `<div class="arm-cab"><span class="arm-saldo" title="Lo cobrado por la forja: paga contratos de mercenarios desde la Taberna">🏛️ Fondo de la plaza: <strong>${miles(a.forja?.fondo ?? 0)}</strong> monedas</span>
      <p class="asent-lado-nota">Tu Facción forja siempre, al impuesto base. A cada grupo de fuera puedes abrirle la forja con un recargo sobre ese impuesto; lo cobrado entra en el fondo, con el que el Rey, el Embajador o el Gobernador pagan contratos de mercenarios. Abrir la forja no abre la puerta.</p></div>
    <ul class="arm-lista">${filas}</ul>`;
}

/** El cuerpo de la ventana «Armería», en la pestaña `pestana` (la primera de `pestanasDeArmeria` si no la tienes). */
export function htmlArmeria(p: ProyeccionJugador, a: Asentamiento, resideAqui: boolean, pestana: string, e: Escapar): string {
  if (!catalogoDeObjetos()) return '<p class="asent-lado-nota">Cargando el catálogo de objetos…</p>';
  const g = grupoEnPlaza(p, a);
  const cerrada = !aperturaPara(a, g).abierta ? `<p class="asent-lado-nota">La forja de esta plaza está cerrada a los ${g}: aquí solo se compra y se vende.</p>` : '';
  const html = pestana === 'forja' ? htmlForja(p, a, resideAqui, e) : pestana === 'abrir' ? htmlAbrirForja(a) : `${cerrada}${htmlTienda(p, a, e)}`;
  return `<div class="arm-ventana">${html}<p class="faction-error" data-campo="error-armeria" role="alert"></p></div>`;
}

/** Los botones de la ventana: comprar, vender, forjar, los filtros y abrir la forja. `repintar` vuelve a pintar la ventana. */
export function cablearArmeria(root: HTMLElement, a: Asentamiento, ejecutar: Ejecutar, repintar: () => void): void {
  const error = (m: string | null): void => { const x = root.querySelector<HTMLElement>('[data-campo="error-armeria"]'); if (x) x.textContent = m ?? ''; };
  const orden = (selector: string, tipo: string, params: (b: HTMLButtonElement) => Record<string, unknown>, despues?: () => void): void =>
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const m = await ejecutar(tipo, params(b));
      if (m !== null) { b.disabled = false; error(m); } else despues?.();
    }));
  orden('[data-arm-comprar]', 'comprarObjeto', (b) => ({ objeto: b.dataset.armComprar }));
  orden('[data-arm-vender]', 'venderObjeto', (b) => {
    const x = b.parentElement?.querySelector<HTMLInputElement>('[data-arm-cantidad]');
    const cantidad = x ? Math.max(1, Math.min(Number(x.max) || 1, Math.floor(Number(x.value) || 1))) : 1;
    return { casilla: Number(b.dataset.armVender), cantidad };
  });
  // forjar: el banco trabaja unos segundos con su barra y entonces sale la orden; la ficha de lo forjado la pinta `htmlForja` al llegar la pieza
  ventanaViva = { root, ejecutar, repintar };
  root.querySelectorAll<HTMLButtonElement>('[data-arm-forjar]').forEach((b) => b.addEventListener('click', () => {
    if (enCurso || esperando) return;
    const objeto = b.dataset.armForjar ?? '';
    enCurso = { objeto, desde: Date.now() };
    repintar();
    setTimeout(() => void (async () => {
      esperando = { objeto, antes: new Set(forjadasVistas) };
      const m = await (ventanaViva?.ejecutar ?? ejecutar)('forjarObjeto', { objeto });
      const fallo = m !== null;
      if (fallo) esperando = null;
      enCurso = null;
      // lo normal es que el refresco ya haya pintado la ficha; si la pieza no vino en la mochila, se enseña la de su ficha de catálogo
      ventanaViva?.repintar();
      if (!fallo && esperando) { esperando = null; premio = { itemDefinitionId: objeto }; ventanaViva?.repintar(); }
      if (fallo) { const x = ventanaViva?.root.querySelector<HTMLElement>('[data-campo="error-armeria"]'); if (x) x.textContent = m; }
    })(), DURACION_FORJA_MS);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-arm-continuar]').forEach((b) => b.addEventListener('click', () => { premio = null; repintar(); }));
  // el estante de la forja: elegir una pieza cambia el banco sin repintar la ventana; el desplazamiento se recuerda entre repintados
  const tapada = Boolean(root.querySelector('.fj-premio'));
  if (root.querySelector('.fj')) root.scrollTop = tapada ? 0 : scrollDeForja;
  root.onscroll = () => {
    if (root.querySelector('.fj') && !root.querySelector('.fj-premio')) scrollDeForja = root.scrollTop;
    if (root.querySelector('.arm-tienda')) scrollDeTienda = root.scrollTop;
  };
  root.querySelectorAll<HTMLButtonElement>('[data-arm-elegir]').forEach((b) => b.addEventListener('click', () => {
    elegidaEnForja = b.dataset.armElegir ?? null;
    root.querySelectorAll<HTMLButtonElement>('[data-arm-elegir]').forEach((x) => { const es = x === b; x.classList.toggle('elegida', es); x.setAttribute('aria-pressed', String(es)); });
    root.querySelectorAll<HTMLElement>('[data-fj-banco]').forEach((x) => { x.hidden = x.dataset.fjBanco !== elegidaEnForja; });
    error(null);
  }));
  // la tienda: tocar una casilla enseña su ficha sin repintar (la ventana no salta); el desplazamiento se recuerda entre repintados
  if (root.querySelector('.arm-tienda')) root.scrollTop = scrollDeTienda;
  const elegirEnPanel = (atributo: string, guardar: (c: string | null) => void): void => {
    root.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((b) => b.addEventListener('click', () => {
      const panel = b.closest<HTMLElement>('.arm-panel');
      if (!panel) return;
      const ya = b.classList.contains('elegida');
      const nueva = ya ? null : b.getAttribute(atributo);
      panel.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((x) => { const es = x === b && !ya; x.classList.toggle('elegida', es); x.setAttribute('aria-pressed', String(es)); });
      panel.querySelectorAll<HTMLElement>('[data-arm-detalle]').forEach((x) => { x.hidden = x.dataset.armDetalle !== nueva; });
      panel.querySelectorAll<HTMLElement>('.arm-pista').forEach((x) => { x.hidden = nueva !== null; });
      guardar(nueva);
      error(null);
      if (nueva !== null) panel.querySelector<HTMLElement>(`[data-arm-detalle="${CSS.escape(nueva)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
  };
  elegirEnPanel('data-arm-ver', (c) => { elegidaTienda = c; });
  elegirEnPanel('data-arm-ver-venta', (c) => { elegidaVenta = c === null ? null : Number(c); });
  root.querySelectorAll<HTMLButtonElement>('[data-arm-tipo]').forEach((b) => b.addEventListener('click', () => { tipoTienda = b.dataset.armTipo as typeof tipoTienda; repintar(); }));
  root.querySelectorAll<HTMLInputElement>('[data-arm-solo]').forEach((x) => x.addEventListener('change', () => { soloMiClase = x.checked; repintar(); }));
  root.querySelectorAll<HTMLElement>('[data-arm-grupo]').forEach((fila) => {
    const g = fila.dataset.armGrupo as GrupoForja;
    const clave = `${a.id}|${g}`;
    const leer = (): AperturaForja => ({
      abierta: fila.querySelector<HTMLSelectElement>('[data-arm-abierta]')!.value === '1',
      recargoPct: Number(fila.querySelector<HTMLSelectElement>('[data-arm-recargo]')!.value),
    });
    fila.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { borradorForja.set(clave, leer()); repintar(); }));
    orden(`[data-arm-guardar="${g}"]`, 'configurarForja', () => ({ asentamientoId: a.id, grupo: g, ...leer() }), () => borradorForja.delete(clave));
  });
}

// ── Los avisos ──

const valor = (x: unknown): number => Number(x ?? 0);
/** El texto de los hechos de la Armería: `heroe.objeto_comprado`, `heroe.objeto_vendido`, `heroe.objeto_forjado` y `asentamiento.forja_configurada`. */
export function textoDeHechoArmeria(codigo: string, d: Record<string, unknown>, nombrePlaza: (id: string) => string): string | null {
  const objeto = nombreDeObjeto(String(d.objeto ?? ''));
  switch (codigo) {
    case 'heroe.objeto_comprado': return `Compras ${objeto} por ${miles(valor(d.precio))} monedas. Va a tu mochila.`;
    case 'heroe.objeto_vendido': return `Vendes ${valor(d.cantidad) > 1 ? `${valor(d.cantidad)} × ` : ''}${objeto} por ${miles(valor(d.cobro))} monedas.`;
    case 'heroe.objeto_forjado': return `Forjas ${objeto} con una calidad del ${valor(d.calidad)} %. Pagas ${miles(valor(d.impuesto))} monedas de impuesto al fondo de la plaza.`;
    case 'asentamiento.forja_configurada': {
      const g = GRUPOS_DE_FUERA.find(([x]) => x === d.grupo)?.[2].toLowerCase() ?? String(d.grupo ?? '');
      const plaza = nombrePlaza(String(d.plaza ?? ''));
      return valor(d.abierta) ? `La forja de ${plaza} se abre a los ${g}, ${textoRecargo(valor(d.recargo))}.` : `La forja de ${plaza} se cierra a los ${g}.`;
    }
    default: return null;
  }
}
