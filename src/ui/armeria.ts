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
import { claveDeRareza, textoDeTier } from './fichaCombate';
import { cifrasDe, htmlCifras, iconoDeObjeto, libresEn, nombreDeObjeto, pesosDeLaClase, textoDeTipo } from './objetosHeroe';

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

/** El nombre de la pieza con su icono, su rareza y lo que es; debajo, sus cifras plegadas. */
function htmlPieza(f: FichaObjeto, e: Escapar, extra = ''): string {
  const tier = f.tier ? `<span class="ta-rareza r-${e(claveDeRareza(f.tier))}">${e(textoDeTier(f.tier))}</span>` : '';
  const metal = f.metal && f.metal !== 'inicio' ? ` · ${e(f.metal.replace(/_/g, ' '))}` : '';
  return `<span class="arm-pieza-icono r-${f.tier ? e(claveDeRareza(f.tier)) : 'ninguna'}" aria-hidden="true">${iconoDeObjeto(f.id)}</span>
    <span class="arm-pieza-texto"><strong>${e(f.nombre)}</strong><small>${e(textoDeTipo(f))}${metal}</small>${tier}${extra}
      <details class="arm-cifras"><summary>Cifras</summary>${htmlCifras(cifrasDe({ itemDefinitionId: f.id }))}</details></span>`;
}

function htmlTienda(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const monedas = p.heroe.monedas ?? 0;
  const libres = libresEn(p.heroe, 'mochila');
  const todas = piezasDeTienda(a);
  const tipos = (['arma', 'armadura', 'montura'] as const).filter((t) => todas.some((f) => f.tipo === t));
  if (!tipos.includes(tipoTienda)) tipoTienda = tipos[0] ?? 'armadura';
  const lista = todas.filter((f) => f.tipo === tipoTienda && (!soloMiClase || deMiClase(p, f))).sort(ordenar);
  const filas = lista.map((f) => {
    const falta = f.precio - monedas;
    const accion = libres < 1 ? '' : falta > 0
      ? `<small class="arm-falta">te faltan ${miles(falta)}</small>`
      : `<button class="btn-primary btn-chico" type="button" data-arm-comprar="${e(f.id)}">Comprar</button>`;
    return `<li class="arm-fila">${htmlPieza(f, e)}<span class="arm-precio${falta > 0 ? ' caro' : ''}">💰 ${miles(f.precio)}</span><span class="arm-accion">${accion}</span></li>`;
  }).join('');
  const NOMBRE_TIPO = { arma: 'Armas', armadura: 'Armaduras', montura: 'Monturas' } as const;
  const filtros = `<div class="arm-filtros">${tipos.map((t) => `<button type="button" class="obra-chip arm-chip${t === tipoTienda ? ' activo' : ''}" data-arm-tipo="${t}" aria-pressed="${t === tipoTienda}">${NOMBRE_TIPO[t]}</button>`).join('')}
    ${tipoTienda !== 'montura' ? `<label class="arm-solo"><input type="checkbox" data-arm-solo${soloMiClase ? ' checked' : ''}> Solo lo de tu clase (${e(nombreDeClase(claseDeArma(p)))})</label>` : ''}</div>`;
  const vender = p.heroe.inventario.slice().sort((x, y) => x.casillaInventario - y.casillaInventario).map((it) => {
    const f = catalogoDeObjetos()?.objetos.find((o) => o.id === it.itemDefinitionId);
    if (!f) return '';
    const cuantas = it.cantidad > 1 ? `<input class="form-input obj-cantidad" type="number" min="1" max="${it.cantidad}" value="1" data-arm-cantidad aria-label="Cuántas" />` : '';
    return `<li class="arm-fila arm-fila-venta"><span class="arm-pieza-icono r-${f.tier ? e(claveDeRareza(f.tier)) : 'ninguna'}" aria-hidden="true">${iconoDeObjeto(f.id)}</span>
      <span class="arm-pieza-texto"><strong>${e(f.nombre)}${it.cantidad > 1 ? ` ×${it.cantidad}` : ''}${it.itemInstanceId ? ' <em title="Forjada">✦</em>' : ''}</strong><small>casilla ${it.casillaInventario + 1}</small></span>
      <span class="arm-precio">💰 ${miles(precioDeVenta(f))}${it.cantidad > 1 ? ' c/u' : ''}</span><span class="arm-accion obj-mover">${cuantas}<button class="btn-secondary btn-chico" type="button" data-arm-vender="${it.casillaInventario}">Vender</button></span></li>`;
  }).join('');
  return `<div class="arm-cab"><span class="arm-saldo">💰 <strong>${miles(monedas)}</strong> monedas</span><span class="arm-saldo">🎒 ${p.heroe.inventario.length}/${catalogoDeObjetos()?.casillasMochila ?? 72}</span>
      ${libres < 1 ? '<p class="asent-lado-nota">La mochila está llena: vende algo o guárdalo en tu almacén de objetos antes de comprar.</p>' : ''}</div>
    <div class="cols-completa arm-cols">
      <section class="col-completa"><div class="obra-titulo"><span class="faction-kicker">Comprar</span>${ayuda('armeria:tienda', `Al 100\u00a0%, con tus monedas, y a tu mochila. Vende armas, armaduras y monturas hasta el tier ${catalogoDeObjetos()?.tiendaHastaTier ?? 2}, con los metales que abre la tecnología de la Facción de esta plaza. Lo mejor se forja.`)}</div>
        ${filtros}<ul class="arm-lista">${filas || '<li class="mapa-lista-vacia">Nada de esto a la venta aquí.</li>'}</ul></section>
      <section class="col-completa"><div class="obra-titulo"><span class="faction-kicker">Vender</span>${ayuda('armeria:vender', `Cualquier cosa de tu mochila, al ${catalogoDeObjetos()?.ventaPct ?? 50}\u00a0% del precio de su ficha. Una pieza forjada vale lo mismo que la de tienda. Lo que llevas puesto no se vende: quítatelo antes.`)}</div>
        <ul class="arm-lista">${vender || '<li class="mapa-lista-vacia">Tu mochila está vacía.</li>'}</ul></section>
    </div>`;
}

/** Un coste de la receta: icono, cifra y nombre; en rojo si falta. */
const chip = (icono: string, n: number | string, nombre: string, falta: boolean, e: Escapar): string =>
  `<span class="arm-coste${falta ? ' falta' : ''}" title="${e(nombre)}">${icono} ${typeof n === 'number' ? miles(n) : e(n)}<span class="ta-sr"> ${e(nombre)}</span></span>`;

function htmlForja(p: ProyeccionJugador, a: Asentamiento, resideAqui: boolean, e: Escapar): string {
  const g = grupoEnPlaza(p, a);
  const ap = aperturaPara(a, g);
  const mano = materialesAMano(p, resideAqui);
  const inv = p.heroe.inventario;
  const recetas = recetasDeForja(p, a, resideAqui).filter((r) => !soloMiClase || deMiClase(p, r.f)).sort((x, y) => ordenar(x.f, y.f));
  const fila = (r: RecetaEnForja): string => {
    const x = r.f.forja!;
    const plano = `plano_${x.plano}`;
    const costes = [
      chip('📜', 1, nombreDeObjeto(plano), enMochila(inv, plano) < 1, e),
      chip('🏺', x.crisoles, x.crisoles === 1 ? 'crisol' : 'crisoles', enMochila(inv, 'crisol') < x.crisoles, e),
      ...Object.entries(x.materiales).map(([m, n]) => chip(RECURSO_ICONO[m] ?? '📦', n, RECURSO_NOMBRE[m] ?? m, Math.floor(mano.recursos[m] ?? 0) < n, e)),
      chip('💰', r.impuesto, 'monedas de impuesto', (p.heroe.monedas ?? 0) < r.impuesto, e),
    ].join('');
    const calidad = `<small class="arm-calidad">calidad ${x.calidad[0]} a ${x.calidad[1]} %</small>`;
    const accion = r.faltan.length === 0 ? `<button class="btn-primary btn-chico" type="button" data-arm-forjar="${e(r.f.id)}">Forjar</button>` : `<small class="arm-falta">Te ${r.faltan.length === 1 && /^(un|una|1) /.test(r.faltan[0]!) ? 'falta' : 'faltan'} ${e(r.faltan.join(', '))}.</small>`;
    return `<li class="arm-fila arm-fila-forja">${htmlPieza(r.f, e, calidad)}<span class="arm-costes">${costes}</span><span class="arm-accion">${accion}</span></li>`;
  };
  const listas = recetas.filter((r) => r.faltan.length === 0), faltan = recetas.filter((r) => r.faltan.length > 0);
  const era = ordenDeEraDelMundo(p);
  const tiers = [2, 3, 4, 5].filter((t) => eraDelTier(t) <= era);
  const recargo = ap.recargoPct ? ` con un recargo del ${ap.recargoPct} %` : '';
  return `<div class="arm-cab"><span class="arm-saldo">💰 <strong>${miles(p.heroe.monedas ?? 0)}</strong> monedas</span>
      <p class="asent-lado-nota">Forjas aquí como ${NOMBRE_GRUPO[g]}: pagas el impuesto ${ap.recargoPct ? `base${recargo}` : 'base'}, que va al fondo de la plaza. Los materiales salen ${e(mano.donde)}. La Era del mundo abre ${tiers.length > 1 ? `los tiers ${tiers.map((t) => textoDeTier(t).split(',')[0]!.replace('Tier ', '')).join(', ')}` : 'el tier II'}.</p></div>
    <label class="arm-solo"><input type="checkbox" data-arm-solo${soloMiClase ? ' checked' : ''}> Solo lo de tu clase (${e(nombreDeClase(claseDeArma(p)))})</label>
    <div class="obra-titulo"><span class="faction-kicker">Lo que puedes forjar ya</span>${ayuda('armeria:forja', 'Gasta un plano de su tier y sus crisoles de tu mochila, los materiales de la receta y el impuesto. La pieza sale con una calidad al azar en su rango, que multiplica todas sus cifras, y va a tu mochila.')}</div>
    <ul class="arm-lista">${listas.map(fila).join('') || '<li class="mapa-lista-vacia">Ninguna todavía: mira abajo lo que te falta para cada una.</li>'}</ul>
    ${faltan.length ? `<details class="arm-faltan"><summary>Las que aún no puedes forjar (${faltan.length})</summary><ul class="arm-lista">${faltan.map(fila).join('')}</ul></details>` : ''}`;
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
  orden('[data-arm-forjar]', 'forjarObjeto', (b) => ({ objeto: b.dataset.armForjar }));
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
