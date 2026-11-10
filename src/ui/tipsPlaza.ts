// Lo que cuentan los tooltips con ficha de la plaza (0.192.0, Víctor 2026-11-10: «un tooltip más acorde» al pasar el ratón por un edificio de
// Construir y por un recurso del Almacén, con la pinta de los de los árboles de tecnologías y de tropas). El tooltip en sí (dónde sale, cuándo se
// va) es ui/tipFicha.ts; aquí se arma su HTML con los datos de juego (`/v1/datos`) y la plaza abierta, que fija quien pinta los botones
// (`fijarPlazaDelTip`). Nada de reglas propias: todo sale del catálogo y de los bloques del motor, y lo que el bloque no trae no se cuenta.
// No importa panelObras ni vistaCiudad (son ellos los que importan esto).
import { bloqueDeDatos, catalogoDePoliticas, tropasReclutables, type ReglasPrestigio, type RecetaDeEdificio } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { iconoEdificio } from './iconosEdificio';
import { duracion } from './juegoVisual';
import { maximoPorPlaza } from './recetasUnicas';
import { registrarTip } from './tipFicha';

type Escapar = (valor: string) => string;
const esc: Escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Cifras como en los árboles: enteras tal cual; con fracción, hasta dos decimales con coma (cuatro por debajo de 0,1: los impuestos). */
const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(+n.toFixed(Math.abs(n) < 0.1 ? 4 : 2)).replace('.', ','));
const EN = (tipo: string): string => EDIFICIO_NOMBRE[tipo] ?? tipo;
const RN = (r: string): string => RECURSO_NOMBRE[r] ?? r;
/** Una lista de nombres en castellano: «a», «a y b», «a, b y c». */
const yLista = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

// ---------------------------------------------------------------- la plaza del tooltip

let plaza: Asentamiento | null = null;
/** La plaza cuyos botones se acaban de pintar: los tooltips miran su almacén, sus edificios y su nivel. */
export function fijarPlazaDelTip(a: Asentamiento | null): void { plaza = a; }

/** El producto de los factores de las políticas activas de la plaza para ese campo (1 si no hay). */
export function factorDePoliticas(a: Asentamiento, campo: string): number {
  const politicas = bloqueDeDatos<{ id: string; [k: string]: unknown }[]>('POLITICA_CATALOGO') ?? [];
  return (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.[campo]; return typeof v === 'number' ? t * v : t; }, 1);
}

// ---------------------------------------------------------------- los datos de juego que se leen

interface Nivel {
  trabajadoresRequeridos?: number;
  recetas?: RecetaDeEdificio[];
  costoMejora?: Record<string, number>;
  requisitoNivelAsentamiento?: number;
  requiereEdificio?: string;
  requiereEdificioNivel?: number;
  requiereTecnologia?: string;
  obraMinutos?: number;
  cupoCaravanas?: number;
  cupoCarros?: number;
  cupoMiradas?: number;
  capacidadTrigo?: number;
  capacidadNobles?: number;
  tamano?: { ancho: number; alto: number };
  [clave: string]: unknown;
}
interface Def {
  costo?: Record<string, number>;
  tiempoConstruccionMinutos?: number;
  requisitoNivelAsentamientoConstruccion?: number;
  requiereTecnologia?: string;
  nivelFaccionMinimo?: number;
  trabajadoresRequeridos?: number;
  capacidadPesants?: number;
  capacidadArtesanos?: number;
  capacidadPorRecursoAdicional?: number;
  factorBuey?: number;
  niveles?: Record<string, Nivel>;
  [clave: string]: unknown;
}
interface Bien { clases: string[]; racion: number; modificador: number }
interface Requisito { edificios?: string[]; edificiosConNivel?: Record<string, number>; nivelInternoMinimo?: Record<string, number> }

const catalogo = (): Record<string, Def> | null => bloqueDeDatos<Record<string, Def>>('EDIFICIO_CATALOGO');
const tecnologias = (): Record<string, { nombre?: string; bonusProduccion?: { recurso: string; factor: number } }> =>
  bloqueDeDatos<Record<string, { nombre?: string; bonusProduccion?: { recurso: string; factor: number } }>>('TECNOLOGIAS') ?? {};
const TN = (t: string): string => tecnologias()[t]?.nombre ?? t.replace(/_/g, ' ');

/** Las tecnologías adoptadas por tu Facción, o `null` sin saberlo (sin Facción no hay ninguna). */
function adoptadas(): string[] | null {
  const p = estadoCliente.proyeccionUltima;
  if (!p) return null;
  const t = p.tecnologia as { propias?: { adoptadas?: string[] } | null } | undefined;
  const lista = [...(p.tecnologiasAdoptadas ?? []), ...(t?.propias?.adoptadas ?? [])];
  return lista.length || t ? [...new Set(lista)] : null;
}

/** Los niveles del catálogo en orden (1, 2, 3…); un edificio sin `niveles` tiene solo el 1, con lo de la raíz. */
const nivelesDe = (def: Def): [number, Nivel][] =>
  Object.entries(def.niveles ?? { 1: {} }).map(([n, x]) => [Number(n), x] as [number, Nivel]).sort((x, y) => x[0] - y[0]);

/** Qué produce un extractor o granja (`produccionBase<Recurso>` en el nivel o en la raíz) y cuánto de base. */
function produccionBaseDe(fuente: Record<string, unknown>): { recurso: string; base: number } | null {
  const clave = Object.keys(fuente).find((k) => k.startsWith('produccionBase') && typeof fuente[k] === 'number');
  if (!clave) return null;
  const r = clave.slice('produccionBase'.length);
  return { recurso: r === 'Livestock' ? 'livestock' : r.charAt(0).toLowerCase() + r.slice(1), base: Number(fuente[clave]) };
}

/** El molino y el horno los trabajan los pesants (motor, tanda 69); los demás talleres, los artesanos; los extractores y la granja, los pesants. */
const TALLERES_DE_PESANTS = new Set(['molino', 'horno']);
const claseQueTrabaja = (tipo: string, def: Def): 'pesants' | 'artesanos' =>
  TALLERES_DE_PESANTS.has(tipo) || nivelesDe(def).every(([, n]) => !(n.recetas ?? []).length) ? 'pesants' : 'artesanos';

const CLASE: Record<string, { una: string; varias: string; icono: string }> = {
  pesants: { una: 'pesant', varias: 'pesants', icono: '👨‍🌾' },
  artesanos: { una: 'artesano', varias: 'artesanos', icono: '🔨' },
  nobleza: { una: 'noble', varias: 'nobles', icono: '👑' },
};
const clase = (c: string, n: number): string => (n === 1 ? CLASE[c]?.una : CLASE[c]?.varias) ?? c;

// ---------------------------------------------------------------- piezas (las de los árboles)

/** Un recurso con su icono y, si se da, su cifra; `falta` lo pone en rojo. */
const RI = (r: string, n?: number, falta = false): string =>
  `<span class="ta-rec${falta ? ' falta' : ''}" title="${esc(RN(r))}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i>${n !== undefined ? `<b>${num(n)}</b>` : ''}<span class="ta-sr">${esc(RN(r))}</span></span>`;
/** Un edificio con su icono y, si se da, su nivel. */
const EI = (tipo: string, nivel?: number | null): string =>
  `<span class="ta-rec ta-edi" title="${esc(EN(tipo))}${nivel ? ` nivel ${nivel}` : ''}">${iconoEdificio(tipo, 18)}${nivel ? `<b>${nivel}</b>` : ''}<span class="ta-sr">${esc(EN(tipo))}${nivel ? ` ${nivel}` : ''}</span></span>`;
/** Un edificio con su icono y su nombre a la vista (el tooltip no deja pasar el ratón por sus piezas, así que un icono solo no se lee). */
const EIN = (tipo: string, nivel?: number | null): string =>
  `<span class="ta-rec ta-edi">${iconoEdificio(tipo, 18)}<span class="tip-nombre">${esc(EN(tipo))}</span>${nivel ? `<b>${nivel}</b>` : ''}</span>`;
/** Varios edificios: con su nombre si son pocos; si son muchos, «muchos edificios» y sus iconos (sin contarlos: el tooltip de un recurso no lleva
 * cifras). */
const edificios = (tipos: string[]): string => (tipos.length <= 6 ? tipos.map((t) => EIN(t)).join(' ') : `muchos edificios <span class="ta-fichas tip-iconos">${tipos.map((t) => EI(t)).join('')}</span>`);
/** Lo que gasta una receta por unidad, con el nombre de cada insumo: «🍇2 de uva». */
const insumos = (c: Record<string, number>): string => yLista(Object.entries(c).map(([r, n]) => `${RI(r, n)} de ${esc(RN(r).toLowerCase())}`));
/** Una pieza con un icono cualquiera (tiempo, gente…). */
const IC = (icono: string, texto: string, nombre: string): string =>
  `<span class="ta-rec" title="${esc(nombre)}"><i aria-hidden="true">${icono}</i><b>${esc(texto)}</b><span class="ta-sr">${esc(nombre)}</span></span>`;
const coste = (c: Record<string, number>, almacen?: Asentamiento['almacen']): string =>
  Object.entries(c).map(([r, n]) => RI(r, n, almacen !== undefined && (almacen[r]?.cantidad ?? 0) < n)).join(' ');
const tec = (t: string): string => {
  const ad = adoptadas();
  return `<span class="ta-tec">${esc(TN(t))}</span>${ad ? (ad.includes(t) ? ' <span class="ok" title="Adoptada">✓</span>' : ' <span class="no" title="Tu Facción no la tiene">✗</span>') : ''}`;
};
/** Una receta: «🍞 hasta 4/min, con 🌾1 por unidad». */
const receta = (r: RecetaDeEdificio): string =>
  `${RI(r.produce)} ${esc(RN(r.produce))}: hasta <span class="ta-n">${num(r.produccionBase)}</span>/min, con ${insumos(r.consumePorUnidad)} por unidad${r.requiereTecnologia ? ` · pide ${tec(r.requiereTecnologia)}` : ''}`;

// ---------------------------------------------------------------- la función de cada edificio

/** Para qué está cada edificio, en una frase (las cifras salen del catálogo). Lo que no esté aquí se cuenta solo con sus datos. */
const FUNCION: Record<string, (d: Def) => string> = {
  vivienda: (d) => `Casa de la gente de la plaza: da sitio a ${d.capacidadPesants ?? 0} pesants y ${d.capacidadArtesanos ?? 0} artesanos. Sin sitio, la población deja de crecer.`,
  almacen: (d) => `Amplía lo que cabe en la plaza: ${d.capacidadPorRecursoAdicional ?? 0} más de cada recurso. Lo que se produce con el almacén lleno se pierde.`,
  granero: () => 'Guarda el trigo: cada nivel le da más cabida.',
  granja: () => 'La granja de la fundación: da el trigo de la plaza, más cuanto más fértil es la tierra. Hay una sola y se mejora; el trigo de más sale de las aldeas.',
  lenera: () => 'Corta madera en una parcela de bosque libre de tu zona: cuanto más denso el bosque, más madera.',
  molino: (d) => `Muele el trigo en harina para el horno. Con un buey uncido rinde ×${num(d.factorBuey ?? 2)}.`,
  horno: () => 'Cuece la harina en pan, la comida que hace crecer a los pesants.',
  quesera: () => 'Hace queso con la leche de los rebaños, la comida de los artesanos.',
  bodega: () => 'Hace vino con la uva o cerveza con la cebada, para la nobleza. Trabaja una sola receta a la vez.',
  prensa: () => 'Saca aceite de la aceituna o del sésamo, para la nobleza. Trabaja una sola receta a la vez.',
  fundicion: () => 'Funde el cobre y el estaño en lingotes y los alea en bronce: el metal de las armas y de las obras grandes.',
  granFundicion: () => 'Refunde en lingotes la chatarra que dejan las batallas. Solo en la capital.',
  curtiduria: () => 'Saca cuero del ganado y lo curte: el material de las armaduras.',
  armeria: () => 'Forja las armas y las armaduras con las que se equipan las tropas.',
  carpinteria: () => 'El taller de la madera: el barracón, la galería de tiro y las caballerizas lo piden para mejorar. En el nivel 2 hace carros de guerra.',
  barracon: () => 'Recluta la infantería de la plaza. Cada nivel abre tropas mejores.',
  galeriaDeTiro: () => 'Recluta a los honderos, los arqueros y la demás tropa de tiro.',
  caballerizas: () => 'Recluta la caballería y los carros de guerra. Los caballos se pagan en oro.',
  salaConsejo: () => 'Donde se reúne el gobierno de la plaza: da al Gobernador un hueco más de política.',
  palacio: () => 'La casa de la nobleza: le da sitio para vivir en la plaza.',
  taberna: () => 'Desde ella se ve el tablón de mercenarios de los campamentos de la región y se contrata sin ir. Compra Miradas e Informes.',
  mercado: () => 'Abre el comercio de la plaza y le da su flota: caravanas y carros para mover mercancía.',
  albergueCaravanas: () => 'Amplía la flota del Mercado con más caravanas y carros.',
  maravilla: () => 'La obra mayor de la Facción: la levanta una plaza de nivel 5 con el prestigio suficiente.',
  estatua: () => 'Adorno de la capital: una por cada umbral de prestigio que alcanza la Facción.',
};

/** El tamaño en el trazado: el del nivel 1 si lo trae (la Granja crece), el de la tabla o el de serie (1 × 1). */
function tamanoDe(tipo: string, def: Def): { ancho: number; alto: number } {
  const t = def.niveles?.['1']?.tamano ?? bloqueDeDatos<Record<string, { ancho: number; alto: number }>>('EDIFICIO_TAMANO')?.[tipo]
    ?? bloqueDeDatos<{ ancho: number; alto: number }>('EDIFICIO_TAMANO_POR_DEFECTO') ?? { ancho: 1, alto: 1 };
  return t;
}

/** Lo que da un nivel (o la raíz, para el 1): capacidades, cupos, producción y gente. `previo`, el nivel de antes, para contar solo lo que cambia.
 * `todo`: lo que da un edificio que ya está en ese nivel, con lo de la raíz y las tropas de los niveles de antes (el tooltip de Construidos). */
function loQueDa(tipo: string, def: Def, n: number, nivel: Nivel, previo?: Nivel, todo = false): string[] {
  const raiz = n === 1 || todo;
  const li: string[] = [];
  const recetasPrevias = new Set((previo?.recetas ?? []).map((r) => `${r.produce}:${Object.keys(r.consumePorUnidad).join('+')}`));
  for (const r of nivel.recetas ?? []) {
    const clave = `${r.produce}:${Object.keys(r.consumePorUnidad).join('+')}`;
    const antes = previo?.recetas?.find((x) => `${x.produce}:${Object.keys(x.consumePorUnidad).join('+')}` === clave);
    if (!recetasPrevias.has(clave)) li.push(receta(r));
    else if (antes && antes.produccionBase !== r.produccionBase) li.push(`${RI(r.produce)} ${esc(RN(r.produce))}: hasta <span class="ta-n">${num(r.produccionBase)}</span>/min`);
  }
  const base = produccionBaseDe(nivel) ?? (raiz ? produccionBaseDe(def) : null);
  const basePrevia = previo ? produccionBaseDe(previo) : null;
  if (base && base.base !== basePrevia?.base) li.push(`${RI(base.recurso)} ${esc(RN(base.recurso))}: hasta <span class="ta-n">${num(base.base)}</span>/min con la mano de obra completa`);
  const trab = nivel.trabajadoresRequeridos ?? (raiz ? def.trabajadoresRequeridos : undefined);
  const trabPrevio = previo?.trabajadoresRequeridos;
  if (trab && trab !== trabPrevio) {
    const c = claseQueTrabaja(tipo, def);
    li.push(`${IC(CLASE[c]!.icono, String(trab), clase(c, trab))} ${clase(c, trab)} de mano de obra`);
  }
  if (raiz && (def.capacidadPesants || def.capacidadArtesanos)) li.push(`Sitio para <span class="ta-n">${def.capacidadPesants ?? 0}</span> pesants y <span class="ta-n">${def.capacidadArtesanos ?? 0}</span> artesanos`);
  if (raiz && def.capacidadPorRecursoAdicional) li.push(`<span class="ta-n">+${def.capacidadPorRecursoAdicional}</span> de cabida para cada recurso`);
  if (nivel.capacidadTrigo && nivel.capacidadTrigo !== previo?.capacidadTrigo) li.push(`${RI('trigo')} <span class="ta-n">${previo?.capacidadTrigo ? '' : '+'}${nivel.capacidadTrigo}</span> de cabida para el trigo`);
  if (nivel.capacidadNobles && nivel.capacidadNobles !== previo?.capacidadNobles) li.push(`${IC(CLASE.nobleza!.icono, String(nivel.capacidadNobles), 'nobles')} sitio para ${nivel.capacidadNobles} nobles`);
  if ((nivel.cupoCaravanas || nivel.cupoCarros) && (nivel.cupoCaravanas !== previo?.cupoCaravanas || nivel.cupoCarros !== previo?.cupoCarros)) {
    li.push(`Flota: <span class="ta-n">${tipo === 'mercado' ? '' : '+'}${nivel.cupoCaravanas ?? 0}</span> caravanas y <span class="ta-n">${tipo === 'mercado' ? '' : '+'}${nivel.cupoCarros ?? 0}</span> carros`);
  }
  if (nivel.cupoMiradas && nivel.cupoMiradas !== previo?.cupoMiradas) li.push(`Hasta <span class="ta-n">${nivel.cupoMiradas}</span> Mirada${nivel.cupoMiradas > 1 ? 's' : ''} a la vez`);
  if (raiz && def.factorBuey) li.push(`Con un buey, ×${num(def.factorBuey)}`);
  // las tropas que abre ese nivel: las de las tecnologías de tu Facción por su nombre, las demás contadas
  const tropas = (tropasReclutables() ?? []).filter((t) => t.edificio === tipo && (todo ? t.nivelRequerido <= n : t.nivelRequerido === n));
  if (tropas.length) {
    const ad = adoptadas();
    const ya = ad ? tropas.filter((t) => ad.includes(t.tecnologia)) : tropas;
    const resto = tropas.length - ya.length;
    li.push(`Recluta ${ya.length ? yLista(ya.map((t) => esc(t.nombre))) : ''}${ya.length && resto ? `, y ${resto} más` : resto ? `${resto} tropa${resto > 1 ? 's' : ''}` : ''}${resto ? ` con tecnologías que tu Facción aún no tiene` : ''}`);
  }
  if (raiz && tipo === 'salaConsejo') {
    const slot = catalogoDePoliticas()?.reglas.slotSalaConsejo;
    if (slot) li.push(`<span class="ta-n">+${slot}</span> política para el Gobernador`);
  }
  return li;
}

/** Lo que cuesta llegar a un nivel (2 en adelante) y lo que pide. */
function pideElNivel(nivel: Nivel, almacen: Asentamiento['almacen'] | undefined, nivelPlaza: number | null): string {
  const partes: string[] = [];
  if (nivel.costoMejora) partes.push(coste(nivel.costoMejora, almacen));
  if (nivel.requisitoNivelAsentamiento) partes.push(`<span class="${nivelPlaza !== null && nivelPlaza < nivel.requisitoNivelAsentamiento ? 'no' : ''}">plaza ${nivel.requisitoNivelAsentamiento}</span>`);
  if (nivel.requiereEdificio) partes.push(EIN(nivel.requiereEdificio, nivel.requiereEdificioNivel ?? null));
  if (nivel.requiereTecnologia) partes.push(tec(nivel.requiereTecnologia));
  return partes.join(' · ');
}

/** El tooltip de un edificio de Construir: qué es, lo que cuesta, lo que da, sus niveles y para qué hace falta en la plaza. */
export function htmlTipEdificio(a: Asentamiento | null, tipo: string): string {
  const cat = catalogo();
  const def = cat?.[tipo];
  if (!def) return '';
  const niveles = nivelesDe(def);
  const unicos = bloqueDeDatos<string[]>('EDIFICIOS_UNICOS') ?? [];
  const tope = maximoPorPlaza(tipo);
  const t = tamanoDe(tipo, def);
  const meta = [
    `${t.ancho} × ${t.alto} casillas`,
    unicos.includes(tipo) ? 'uno por plaza' : tope ? `hasta ${tope} por plaza` : '',
    niveles.length > 1 ? `${niveles.length} niveles` : '',
  ].filter(Boolean).join(' · ');
  let h = `<div class="ta-tip-cab">${iconoEdificio(tipo, 34)}<div><h3>${esc(EN(tipo))}</h3><div class="ta-meta">${esc(meta)}</div></div></div>`;
  const funcion = FUNCION[tipo]?.(def);
  if (funcion) h += `<p class="tip-funcion">${esc(funcion)}</p>`;

  // Construir: el coste (en rojo lo que no hay en el almacén) y la obra con las políticas de hoy
  const c = def.costo ?? {};
  const minutos = def.tiempoConstruccionMinutos ? Math.max(1, Math.round(def.tiempoConstruccionMinutos * (a ? factorDePoliticas(a, 'factorTiempoConstruccion') : 1))) : 0;
  const caro = a ? Object.entries(c).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n) : false;
  h += `<h4>Construir</h4><div class="ta-fichas">${coste(c, a?.almacen)}${minutos ? IC('⏳', duracion(minutos), 'Tiempo de obra') : ''}</div>`;
  if (caro) h += '<div class="ta-nota">No hay bastante en el almacén: lo que falta va en rojo.</div>';

  // Qué da: el nivel 1
  const [, n1] = niveles[0] ?? [1, {}];
  const da = loQueDa(tipo, def, 1, n1);
  if (tipo === 'estatua' || tipo === 'maravilla') {
    const reglas = bloqueDeDatos<ReglasPrestigio>('PRESTIGIO');
    const p = estadoCliente.proyeccionUltima;
    const prestigio = p?.facciones.find((f) => f.id === p.faccionId)?.prestigio;
    if (tipo === 'estatua' && reglas?.estatuas?.length) da.push(`Una con ${yLista(reglas.estatuas.map((u) => `<span class="ta-n">${u}</span>`))} de prestigio${prestigio !== undefined ? ` (tu Facción: ${prestigio})` : ''}`);
    if (tipo === 'maravilla' && reglas?.maravilla !== undefined) da.push(`Pide <span class="ta-n">${reglas.maravilla}</span> de prestigio de la Facción${prestigio !== undefined ? ` (tiene ${prestigio})` : ''}`);
  }
  if (da.length) h += `<h4>${niveles.length > 1 ? 'En el nivel 1' : 'Qué da'}</h4><ul>${da.map((x) => `<li>${x}</li>`).join('')}</ul>`;

  // Los niveles de mejora: lo que piden y lo que añaden
  if (niveles.length > 1) {
    const nivelPlaza = a ? a.nivel : null;
    const filas = niveles.slice(1).map(([n, x], i) => {
      const anade = loQueDa(tipo, def, n, x, niveles[i]![1]);
      const pide = pideElNivel(x, a?.almacen, nivelPlaza);
      return `<li><b>Nivel ${n}</b>${pide ? `: ${pide}` : ''}${anade.length ? `<ul>${anade.map((y) => `<li>${y}</li>`).join('')}</ul>` : ''}</li>`;
    });
    h += `<h4>Mejoras</h4><ul class="tip-niveles">${filas.join('')}</ul>`;
  }

  // En la plaza: los que hay, si hace falta para subir la plaza y quién lo pide
  const plazaLi: string[] = [];
  if (a) {
    const hay = (a.edificios ?? []).filter((e) => e.tipo === tipo);
    if (hay.length) {
      const nv = Math.max(...hay.map((e) => e.nivelInterno ?? 1));
      plazaLi.push(`Ya ${hay.length > 1 ? `hay ${hay.length}` : 'hay uno'}${niveles.length > 1 ? `, el mejor de nivel ${nv}` : ''}`);
    }
  }
  plazaLi.push(...paraLaPlaza(a, tipo, cat ?? {}));
  if (plazaLi.length) h += `<h4>En la plaza</h4><ul>${plazaLi.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  h += '<div class="ta-nota">Clic para ponerlo en la cola de obras.</div>';
  return h;
}

/** Para qué hace falta el edificio en la plaza: subirla de nivel (los niveles que le quedan) y los edificios que lo piden para mejorar. */
function paraLaPlaza(a: Asentamiento | null, tipo: string, cat: Record<string, Def>): string[] {
  const li: string[] = [];
  if (a) {
    const reqs = bloqueDeDatos<{ nivelMaximo?: number; requisitos?: Record<string, Requisito> }>('NIVEL_ASENTAMIENTO');
    const asc = bloqueDeDatos<{ nivelTechoProvisional?: number }>('ASCENSO_ASENTAMIENTO');
    const techo = Math.min(reqs?.nivelMaximo ?? 5, asc?.nivelTechoProvisional ?? 5);
    for (const [k, r] of Object.entries(reqs?.requisitos ?? {})) {
      const objetivo = Number(k);
      if (objetivo <= a.nivel || objetivo > techo || !(r.edificios ?? []).includes(tipo)) continue;
      const deNivel = r.edificiosConNivel?.[tipo] ?? r.nivelInternoMinimo?.[tipo];
      li.push(`Hace falta${deNivel ? ` de nivel ${deNivel}` : ''} para subir la plaza al nivel ${objetivo}`);
    }
  }
  const lePiden: string[] = [];
  for (const [otro, d] of Object.entries(cat)) {
    if (otro === tipo) continue;
    for (const [n, x] of nivelesDe(d)) if (x.requiereEdificio === tipo) { lePiden.push(EIN(otro, n > 1 ? n : null)); break; }
  }
  if (lePiden.length) li.push(`Lo piden: ${lePiden.join(' ')}`);
  return li;
}

/** El tooltip de un tipo ya construido (ventana «Construidos», Víctor 2026-11-10): cuántos hay y de qué nivel, qué hacen, lo que da su nivel de
 * ahora, la mejora siguiente con lo que pide y añade, y para qué hacen falta en la plaza. Con varios de niveles distintos, cuenta el mejor. */
export function htmlTipConstruido(a: Asentamiento | null, tipo: string): string {
  const cat = catalogo();
  const def = cat?.[tipo];
  if (!def) return '';
  const hay = (a?.edificios ?? []).filter((e) => e.tipo === tipo && e.estado === 'activo');
  const niveles = nivelesDe(def);
  const nivelesHay = hay.map((e) => e.nivelInterno ?? 1);
  const max = nivelesHay.length ? Math.max(...nivelesHay) : 1, min = nivelesHay.length ? Math.min(...nivelesHay) : 1;
  const meta = [
    hay.length > 1 ? `${hay.length} en la plaza` : 'uno en la plaza',
    niveles.length > 1 ? `nivel ${min === max ? max : `${min} a ${max}`} de ${niveles.length}` : '',
  ].filter(Boolean).join(' · ');
  let h = `<div class="ta-tip-cab">${iconoEdificio(tipo, 34)}<div><h3>${esc(EN(tipo))}</h3><div class="ta-meta">${esc(meta)}</div></div></div>`;
  const mejorando = hay.filter((e) => e.mejora), danados = hay.filter((e) => e.danado).length;
  const estado = [
    mejorando.length ? `${mejorando.length > 1 ? `${mejorando.length} se están mejorando` : `${hay.length > 1 ? 'Uno se está mejorando' : 'Se está mejorando'} al nivel ${mejorando[0]!.mejora!.nivelObjetivo}`}.` : '',
    danados ? `${danados > 1 ? `${danados} están dañados` : hay.length > 1 ? 'Uno está dañado' : 'Está dañado'}.` : '',
  ].filter(Boolean).join(' ');
  if (estado) h += `<div class="ta-estado-caja${danados ? ' baja' : ''}">${esc(estado)}</div>`;
  const funcion = FUNCION[tipo]?.(def);
  if (funcion) h += `<p class="tip-funcion">${esc(funcion)}</p>`;

  // lo que da el nivel de ahora (el mejor), entero
  const actual = niveles.find(([n]) => n === max) ?? niveles[0];
  if (actual) {
    const da = loQueDa(tipo, def, actual[0], actual[1], undefined, true);
    const titulo = niveles.length <= 1 ? `Qué da${hay.length > 1 ? ' cada uno' : ''}` : min !== max ? `Lo que da el mejor, de nivel ${max}` : `Lo que da en el nivel ${max}${hay.length > 1 ? ', cada uno' : ''}`;
    if (da.length) h += `<h4>${titulo}</h4><ul>${da.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  }
  // la mejora siguiente: lo que pide y lo que añade
  const i = niveles.findIndex(([n]) => n === max);
  const siguiente = i >= 0 ? niveles[i + 1] : undefined;
  if (siguiente && actual) {
    const [n, x] = siguiente;
    const anade = loQueDa(tipo, def, n, x, actual[1]);
    const pide = pideElNivel(x, a?.almacen, a ? a.nivel : null);
    h += `<h4>${min !== max ? `Mejora del mejor al nivel ${n}` : `Mejora al nivel ${n}`}</h4>${pide ? `<div class="ta-fichas">${pide}</div>` : ''}${anade.length ? `<ul>${anade.map((y) => `<li>${y}</li>`).join('')}</ul>` : ''}`;
  } else if (niveles.length > 1) h += `<div class="ta-nota">${min !== max ? 'El mejor está en su nivel más alto.' : 'Está en su nivel más alto.'}</div>`;

  const plazaLi = paraLaPlaza(a, tipo, cat ?? {});
  if (plazaLi.length) h += `<h4>En la plaza</h4><ul>${plazaLi.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  h += `<div class="ta-nota">${hay.length > 1 ? 'Clic para verlo en la plaza; cada clic, el siguiente.' : 'Clic para verlo en la plaza.'}</div>`;
  return h;
}

// ---------------------------------------------------------------- los recursos del almacén

/** Lo que hay de un recurso en el almacén de la plaza (lo que publica el motor por recurso). */
export type Existencia = { cantidad: number; capacidad: number; porMinuto?: number; producido?: number; produccion?: number; consumido?: number };

/** Lo que rinden los edificios (quepa o no), lo que se consume y lo que se enseña como neto: con el almacén lleno, el balance producción − consumo
 * y no el neto del almacén, que baja a lo que entra y hacía parecer la ficha a la baja (Víctor, 2026-11-03: «sale como si tuviera producción
 * negativa cuando no es así»). */
export function flujosDe(x: Existencia): { produce: number; consume: number; neto: number; lleno: boolean } {
  const produce = x.produccion ?? x.producido ?? 0, consume = x.consumido ?? 0;
  const lleno = x.capacidad > 0 && x.cantidad >= x.capacidad;
  return { produce, consume, neto: lleno ? produce - consume : x.porMinuto ?? 0, lleno };
}

/** Cifras del almacén: enteras; con fracción, un decimal (con coma) por debajo de 10. */
const cifra = (n: number): string => (Number.isInteger(n) || Math.abs(n) >= 10 ? String(Math.round(n)) : n.toFixed(1).replace('.', ','));

/** La línea de existencias: lo que hay frente a lo que cabe, lo que entra y sale por minuto, y cuándo se llena o se acaba. */
export function textoDeExistencias(r: string, x: Existencia): string {
  const { produce: p, consume: c, neto: n, lleno } = flujosDe(x);
  const minutos = n > 0 && x.capacidad > 0 && !lleno ? (x.capacidad - x.cantidad) / n : n < 0 && x.cantidad > 0 ? x.cantidad / -n : null;
  const cuando = minutos === null ? '' : `${n > 0 ? 'lleno' : 'se acaba'} en ${textoEnTiempoReal(minutos * 60_000)}`;
  return `${RN(r)}: ${Math.floor(x.cantidad)} de ${Math.floor(x.capacidad)}${p || c ? ` · por minuto produce ${cifra(p)}, consume ${cifra(c)}` : ''} · ${lleno ? 'balance' : 'neto'} ${n > 0 ? '+' : ''}${cifra(n)}/min${lleno ? ' · almacén lleno: lo que se produce de más se pierde' : cuando ? ` · ${cuando}` : ''}`;
}

/** Dónde está cada extractor de fuera de la plaza (los de los pueblos). */
const DONDE_EXTRACTOR: Record<string, string> = {
  cantera: 'en los pueblos de cantera', mina: 'en los pueblos mineros', minaCobre: 'en los pueblos mineros', minaEstano: 'en los pueblos mineros', minaHierro: 'en los pueblos mineros',
  lenera: 'en el bosque de tu zona',
};
/** Los tipos de población en plural para las frases de comida («los pesants y los artesanos»; los tres, «todos los tipos de población»). */
const poblacionTexto = (cs: string[]): string => (cs.length >= 3 ? 'todos los tipos de población' : yLista(cs.map((c) => `los ${CLASE[c]?.varias ?? c}`)));

/** ¿Tiene tu Facción la tecnología? Sin ninguna pedida, sí; sin saber las adoptadas (o sin Facción), no. */
const tieneTec = (t: string | undefined, ad: string[] | null): boolean => !t || (ad ?? []).includes(t);

/** Lo que hace un recurso: para qué sirve, de dónde sale y qué lo multiplica, sacado del catálogo y los bloques de la economía. Sin cantidades ni
 * ritmos (Víctor, 2026-11-10: «no mostrar números en general, solo los multiplicadores»; las cifras ya están en la ficha del Almacén), y en «Para
 * qué sirve» solo lo que tu Facción puede hacer ya: las recetas, obras y tropas que piden una tecnología que no tiene no salen. */
export function htmlTipRecurso(a: Asentamiento | null, r: string, nota?: string): string {
  const cat = catalogo() ?? {};
  const ad = adoptadas();
  const x = a?.almacen?.[r];
  let h = `<div class="ta-tip-cab"><span class="tip-ficha-icono" aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</span><div><h3>${esc(RN(r))}</h3></div></div>`;
  if (x && flujosDe(x).lleno) h += '<div class="ta-estado-caja">Almacén lleno: lo que se produce de más se pierde.</div>';

  const usos: string[] = [], fuentes: string[] = [], multiplica: string[] = [];
  const bienes = bloqueDeDatos<{ bienes?: Record<string, Bien>; guarnicion?: string[] }>('BIENES_DE_CONSUMO');
  const bien = bienes?.bienes?.[r];
  const nivelPlaza = a?.nivel ?? 0;

  // --- para qué sirve: sin cifras y solo lo que se puede hacer ya
  if (bien) usos.push(`Lo comen ${poblacionTexto(bien.clases)}`);
  if ((bienes?.guarnicion ?? []).includes(r)) usos.push('La guarnición lo come antes que el trigo');
  if (r === 'trigo') {
    usos.push('La comida de base: pone lo que no cubren los demás bienes');
    usos.push('Los víveres de columnas y ejércitos son solo trigo');
  }
  if (r === 'leche') usos.push('No se come: es la materia de la quesera');
  // los talleres que lo gastan, si tu Facción tiene lo que piden el taller, el nivel donde sale la receta y la receta
  const gastan = new Map<string, { tipo: string; produce: string }>();
  for (const [tipo, d] of Object.entries(cat)) {
    if (!tieneTec(d.requiereTecnologia, ad)) continue;
    let nivelAbierto = true;
    for (const [, nv] of nivelesDe(d)) {
      nivelAbierto &&= tieneTec(nv.requiereTecnologia, ad);
      if (!nivelAbierto) break;
      for (const rc of nv.recetas ?? []) {
        const k = `${tipo}:${rc.produce}`;
        if (r in rc.consumePorUnidad && tieneTec(rc.requiereTecnologia, ad) && !gastan.has(k)) gastan.set(k, { tipo, produce: rc.produce });
      }
    }
  }
  for (const { tipo, produce } of gastan.values()) usos.push(`${EIN(tipo)} hace ${RI(produce)} ${esc(RN(produce).toLowerCase())}`);
  // el equipo de las tropas que tu Facción ya puede reclutar
  const tropas = (tropasReclutables() ?? []).filter((t) => (t.costoEquipo[r] ?? 0) > 0 && tieneTec(t.tecnologia, ad));
  if (tropas.length) {
    const nombres = tropas.map((t) => esc(t.nombre));
    usos.push(`El equipo de ${nombres.length > 5 ? `${nombres.slice(0, 4).join(', ')} y otras tropas` : yLista(nombres)}`);
  }
  if (r === 'oro' && Object.keys(bloqueDeDatos<Record<string, number>>('RECLUTAMIENTO_ORO_POR_ESCALON') ?? {}).length) {
    usos.push(`Reclutar: lo paga cada soldado${bloqueDeDatos<number>('ORO_POR_CABALLO') ? ', y cada caballo aparte' : ''}`);
  }
  // obras: construir y mejorar lo que tu Facción puede levantar
  const construir = Object.entries(cat)
    .filter(([t, d]) => (d.costo?.[r] ?? 0) > 0 && !t.startsWith('mina') && t !== 'cantera' && t !== 'corral' && tieneTec(d.requiereTecnologia, ad)).map(([t]) => t);
  if (construir.length) usos.push(`Construir: ${edificios(construir)}`);
  const mejorar = Object.entries(cat)
    .filter(([, d]) => tieneTec(d.requiereTecnologia, ad) && nivelesDe(d).some(([, nv]) => (nv.costoMejora?.[r] ?? 0) > 0 && tieneTec(nv.requiereTecnologia, ad))).map(([t]) => t);
  if (mejorar.length) usos.push(`Mejorar: ${edificios(mejorar)}`);
  // subir la plaza, si algún nivel que le queda lo pide
  const asc = bloqueDeDatos<{ porNivelObjetivo?: Record<string, { costo?: Record<string, number> }>; nivelTechoProvisional?: number }>('ASCENSO_ASENTAMIENTO');
  const reqs = bloqueDeDatos<{ nivelMaximo?: number }>('NIVEL_ASENTAMIENTO');
  const techo = Math.min(reqs?.nivelMaximo ?? 5, asc?.nivelTechoProvisional ?? 5);
  if (Object.entries(asc?.porNivelObjetivo ?? {}).some(([k, v]) => (v.costo?.[r] ?? 0) > 0 && Number(k) > nivelPlaza && Number(k) <= techo)) usos.push('Subir la plaza de nivel');
  // el mantenimiento: madera siempre, piedra y oro desde su nivel (el nivel es la condición, no una cantidad)
  const mant = bloqueDeDatos<{ costoBase?: Record<string, number>; nivelParaPiedra?: number; nivelParaOro?: number }>('MANTENIMIENTO');
  if (mant) {
    if (mant.costoBase?.[r]) usos.push('El mantenimiento de la plaza');
    if (r === 'piedra' && mant.nivelParaPiedra) usos.push(`El mantenimiento de la plaza, desde el nivel ${mant.nivelParaPiedra}`);
    if (r === 'oro' && mant.nivelParaOro) usos.push(`El mantenimiento de la plaza, desde el nivel ${mant.nivelParaOro}`);
  }

  // --- de dónde sale: solo el sitio
  const lugares = new Set<string>();
  const lugar = (html: string): void => { if (!lugares.has(html)) { lugares.add(html); fuentes.push(html); } };
  for (const [tipo, d] of Object.entries(cat)) {
    if (tipo === 'corral') continue; // el ganado de los corrales sale de los rebaños (abajo)
    const p = produccionBaseDe(d.niveles?.['1'] ?? {}) ?? produccionBaseDe(d);
    if (p?.recurso === r) lugar(`${EIN(tipo)}${DONDE_EXTRACTOR[tipo] ? ` ${esc(DONDE_EXTRACTOR[tipo]!)}` : ''}`);
  }
  const cultivos = bloqueDeDatos<{ aldea?: { cultivos?: Record<string, { produce: string; nivelMadre: number }> } }>('PUEBLOS_EXTRACTORES')?.aldea?.cultivos ?? {};
  const NOMBRE_ALDEA: Record<string, string> = { trigo: 'trigo', vid: 'viñas', oliva: 'olivos', cebada: 'cebada', sesamo: 'sésamo' };
  for (const [cultivo, c] of Object.entries(cultivos)) if (c.produce === r) lugar(`Las aldeas de ${NOMBRE_ALDEA[cultivo] ?? cultivo}`);
  const vacuno = bloqueDeDatos<Record<string, { lechePorCabezaYHora?: number; productos?: Record<string, number> }>>('ESPECIES')?.vacuno;
  if (vacuno?.productos?.[r] || (r === 'leche' && vacuno?.lechePorCabezaYHora)) lugar('Los rebaños de las aldeas de trigo');
  for (const [tipo, d] of Object.entries(cat)) if (nivelesDe(d).some(([, nv]) => (nv.recetas ?? []).some((rc) => rc.produce === r))) lugar(EIN(tipo));
  if (r === 'oro' && bloqueDeDatos('IMPUESTOS')) lugar('La recaudación: los impuestos de la población de la plaza');
  if (r.startsWith('chatarra')) lugar('Las batallas: la de los caídos va al carro del que gana, o al almacén de la plaza que se defiende y gana');

  // --- qué lo multiplica: lo único con cifras
  for (const [id, t] of Object.entries(tecnologias())) if (t.bonusProduccion?.recurso === r) multiplica.push(`${tec(id)}: ×${num(t.bonusProduccion.factor)} a lo que se produce`);
  for (const [tipo, d] of Object.entries(cat)) {
    if (d.factorBuey && nivelesDe(d).some(([, nv]) => (nv.recetas ?? []).some((rc) => rc.produce === r))) multiplica.push(`${EIN(tipo)} con un buey uncido: ×${num(d.factorBuey)}`);
  }
  if (r === 'trigo') multiplica.push('La fertilidad de la tierra, en la granja y en las aldeas');
  if (r === 'madera') multiplica.push('La densidad del bosque, en la leñera');
  if (bien) multiplica.push(`Con la ración entera, ${poblacionTexto(bien.clases)} crecen ×${num(bien.modificador)} (se multiplica con los demás bienes)`);
  const politicas = bloqueDeDatos<{ id: string; nombre?: string; [k: string]: unknown }[]>('POLITICA_CATALOGO') ?? [];
  const activas = new Set((a?.politicasActivas ?? []).map((p) => p.politicaId));
  const esDeTaller = Object.values(cat).some((d) => nivelesDe(d).some(([, nv]) => (nv.recetas ?? []).some((rc) => rc.produce === r)));
  const campos: string[] = [...(r === 'trigo' ? ['factorProduccionTrigo', 'factorConsumoComida'] : []), ...(r === 'oro' ? ['factorRecaudacion'] : []), ...(esDeTaller ? ['factorProduccionTalleres'] : [])];
  for (const campo of campos) for (const p of politicas) {
    const v = p[campo];
    if (typeof v !== 'number') continue;
    const que = campo === 'factorConsumoComida' ? 'a lo que se come' : campo === 'factorRecaudacion' ? 'a la recaudación' : 'a lo que se produce';
    multiplica.push(`La política <span class="ta-tec">${esc(p.nombre ?? p.id)}</span>: ×${num(v)} ${que}${activas.has(p.id) ? ' <span class="ok" title="Activa en esta plaza">✓ activa aquí</span>' : ''}`);
  }

  const lista = (titulo: string, xs: string[]): string => (xs.length ? `<h4>${titulo}</h4><ul>${xs.map((y) => `<li>${y}</li>`).join('')}</ul>` : '');
  h += lista('Para qué sirve', usos) + lista('De dónde sale', fuentes) + lista('Qué lo multiplica', multiplica);
  if (nota) h += `<div class="ta-nota">${esc(nota)}</div>`;
  return h;
}

// Los tipos se apuntan al cargar el módulo: `data-tip="edificio:vivienda"`, `data-tip="construido:vivienda"` y `data-tip="recurso:madera"` (con
// `data-tip-nota` para el pie).
registrarTip('edificio', (tipo) => htmlTipEdificio(plaza, tipo));
registrarTip('construido', (tipo) => htmlTipConstruido(plaza, tipo));
registrarTip('recurso', (r, el) => htmlTipRecurso(plaza, r, el.dataset.tipNota));
