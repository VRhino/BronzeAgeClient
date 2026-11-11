// El árbol de reclutamiento de la plaza (Víctor, 2026-11-06; prototipo del hilo del árbol de tropas, https://claude.ai/artifact/WVuwAj63HGUQPnkgfKoKLZ,
// encargo en interfaces/arbol-reclutamiento/encargo.md). Hermano del árbol de tecnologías (0.158.0): misma rejilla, mismas líneas y mismas Eras al 30 %.
//   - Carriles = el edificio donde se recluta (Centro Urbano, Barracón, Galería de tiro, Caballerizas). Si la plaza no tiene uno, su carril se
//     pliega: la franja con el nombre y el número de tropas, sin cartas. Si lo tiene a menos nivel, la carta se queda y lo dice.
//   - Las tecnologías salen del árbol pero no del tooltip. Una tropa B va tras A cuando B necesita la tecnología que habilita a A: línea continua
//     si es por el hito de su tecnología, a rayas si la piden su edificio o su equipo, punteada si solo la pide el logro (dependencia oculta).
//     Cuando una tecnología habilita varias tropas, se dibuja una sola línea (la que cuenta el logro, si no la del carril, si no la primera).
//   - Solo recluta: reponer va aparte (Víctor, 2026-11-06). Con la escuadra ya hecha, la carta lo dice y no hay botón (una por tropa y héroe).
//   - Solo sale lo que se puede reclutar aquí (Víctor, 2026-11-07; 0.181.0): las tropas listas y las que ya tienes. Las que piden tecnología,
//     edificio, nivel o una Era que aún no empieza no salen, ni los carriles sin tropa que reclutar ni las Eras sin ninguna.
import { bloqueDeDatos, oroPorSoldado, type ProyeccionJugador, type TropaReclutable } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { datosDelArbol, requisitos, ultimaEraVisible, cupoEra, eraOrd, erasOrdenadas, tecsDeEra, adoptadasEn, BRUTO, type Acc, type DatosArbol } from './arbolTecnologias';
import { fijarDibujo, htmlTablero, montarTablero, muestraLinea, type CartaTablero, type ContextoArbol, type NodoTablero, type TipoArista } from './arbolTablero';
import { iconoEdificio } from './iconosEdificio';
import { iconoTropa } from './iconosTropa';
import { iconoRitmo, piezaDeTropa, velocidadDePiezas } from './velocidadColumna';

type Escapar = (s: string) => string;
const CLAVE = 'reclutamiento';
const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];

// ── Grafo de tropas ──────────────────────────────────────────────────────────

export interface NodoTropa extends NodoTablero {
  id: string;
  d: TropaReclutable;
  acc: Acc;
  era: number;
  /** Todas las tropas previas (tras la reducción transitiva), aunque se dibuje una por grupo de hermanas. */
  todos: { de: string; tipo: TipoArista }[];
  hijosTodos: string[];
}
export interface CarrilTropa { id: string; nombre: string; tropas: string[] }
export interface GrafoTropas { D: DatosArbol; nodos: Map<string, NodoTropa>; carriles: CarrilTropa[] }

const ORDEN_CARRILES = ['centroUrbano', 'barracon', 'galeriaDeTiro', 'caballerizas'];
const NOMBRE_CARRIL: Record<string, string> = { centroUrbano: 'Centro Urbano', galeriaDeTiro: 'Galería de tiro' };
export const nombreEdificio = (t: string): string => NOMBRE_CARRIL[t] ?? EDIFICIO_NOMBRE[t] ?? t;
/** La tropa que cuenta el logro de una tecnología (`reclutados.X`, o los hoplitas de `batallas.conHoplitas`). */
const tropaDelLogro = (c: string | undefined): string | null => (c?.startsWith('reclutados.') ? c.split('.')[1]! : c === 'batallas.conHoplitas' ? 'hoplitas_ciudadanos' : null);

export function grafoDeTropas(D: DatosArbol): GrafoTropas {
  const { reqTropa, reqTec } = requisitos(D);
  const tecReq = new Map(Object.keys(D.tec).map((id) => [id, reqTec(id)]));
  // Cada requisito de una tecnología con su tipo: el hito lo pide, lo piden los edificios del hito (implícita) o solo su logro.
  const tipoTec = (id: string, x: string): TipoArista => { const m = tecReq.get(id)!.tecs.get(x)!; return m.has('hito') ? 'hito' : [...m].every((v) => v === 'logro') ? 'logro' : 'implicita'; };
  const cierre = (desde: string[], vale: (a: string, x: string) => boolean): Set<string> => {
    const s = new Set<string>();
    const v = (t: string): void => { for (const x of tecReq.get(t)?.tecs.keys() ?? []) if (vale(t, x) && !s.has(x)) { s.add(x); v(x); } };
    desde.forEach((t) => { s.add(t); v(t); });
    return s;
  };
  const accTropa = new Map(D.tropas.map((t) => [t.id, reqTropa(t)]));
  const eraTropa = (t: TropaReclutable): number => Math.max(1, ...[...accTropa.get(t.id)!.tecs.keys()].filter((x) => D.tec[x]).map((x) => eraOrd(D, D.tec[x]!.era)));
  const tropa = (id: string): TropaReclutable => D.tropas.find((t) => t.id === id)!;
  const nodos = new Map<string, NodoTropa & { cands: { de: string; tipo: TipoArista }[] }>();
  for (const t of D.tropas) {
    const directas = [...accTropa.get(t.id)!.tecs.keys()].filter((x) => D.tec[x]);
    const todas = cierre(directas, () => true);
    const porHito = cierre([t.tecnologia], (a, x) => tipoTec(a, x) === 'hito');
    const sinLogro = cierre(directas, (a, x) => tipoTec(a, x) !== 'logro');
    const cands = D.tropas.filter((a) => a.tecnologia !== t.tecnologia && todas.has(a.tecnologia))
      .map((a) => ({ de: a.id, tipo: (porHito.has(a.tecnologia) ? 'hito' : sinLogro.has(a.tecnologia) ? 'implicita' : 'logro') as TipoArista }));
    nodos.set(t.id, { id: t.id, d: t, acc: accTropa.get(t.id)!, cands, todos: [], preds: [], hijos: [], hijosTodos: [], era: eraTropa(t), carril: t.edificio });
  }
  const antT = new Map<string, Set<string>>();
  const antTDe = (id: string): Set<string> => {
    if (antT.has(id)) return antT.get(id)!;
    const s = new Set<string>();
    antT.set(id, s);
    for (const p of nodos.get(id)!.cands) { s.add(p.de); antTDe(p.de).forEach((x) => s.add(x)); }
    return s;
  };
  for (const n of nodos.values()) n.todos = n.cands.filter((p) => !n.cands.some((q) => q.de !== p.de && antTDe(q.de).has(p.de)));
  for (const n of nodos.values()) {
    const preferida = tropaDelLogro(D.tec[n.d.tecnologia]?.logro?.contador);
    const grupos = new Map<string, { de: string; tipo: TipoArista }[]>();
    for (const p of n.todos) { const k = tropa(p.de).tecnologia; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(p); }
    n.preds = [...grupos.values()].map((g) => g.find((p) => p.de === preferida) ?? g.find((p) => nodos.get(p.de)!.carril === n.carril) ?? g[0]!);
  }
  for (const n of nodos.values()) { for (const p of n.preds) nodos.get(p.de)!.hijos.push(n.id); for (const p of n.todos) nodos.get(p.de)!.hijosTodos.push(n.id); }
  const ids = [...new Set([...ORDEN_CARRILES, ...D.tropas.map((t) => t.edificio)])];
  const carriles = ids.map((id) => ({ id, nombre: nombreEdificio(id), tropas: D.tropas.filter((t) => t.edificio === id).map((t) => t.id) })).filter((c) => c.tropas.length);
  return { D, nodos, carriles };
}

let grafoCache: { D: DatosArbol; g: GrafoTropas } | null = null;
export const grafoDe = (D: DatosArbol): GrafoTropas => (grafoCache?.D === D ? grafoCache.g : (grafoCache = { D, g: grafoDeTropas(D) }).g);

// ── Estado en la plaza ───────────────────────────────────────────────────────

export type EstadoTropa = 'lista' | 'tuya' | 'edificio' | 'adoptable' | 'bloqueada' | 'futura';
export interface EstadoPlaza {
  adoptadas: string[];
  aparecidas: string[];
  eraMundo: string;
  /** Nivel de cada edificio de reclutamiento de la plaza (0 si no lo tiene); el Centro Urbano lo tiene toda plaza. */
  niveles: Record<string, number>;
  /** Tus escuadras (propias, no prestadas) por tropa. */
  escuadras: Record<string, number>;
}

export function estadoPlazaDe(p: ProyeccionJugador, a: Asentamiento): EstadoPlaza | null {
  const t = p.tecnologia;
  if (!t?.propias) return null;
  const niveles: Record<string, number> = {};
  for (const x of a.edificios ?? []) if (x.estado === 'activo') niveles[x.tipo] = Math.max(niveles[x.tipo] ?? 0, x.nivelInterno ?? 1);
  const escuadras: Record<string, number> = {};
  for (const s of p.heroe.escuadrones) if (!s.prestada) escuadras[s.tropaId] = s.cantidad;
  return { adoptadas: t.propias.adoptadas, aparecidas: t.propias.aparecidas, eraMundo: t.era, niveles, escuadras };
}

export const nivelEnPlaza = (E: EstadoPlaza, edificio: string): number => (edificio === 'centroUrbano' ? 99 : E.niveles[edificio] ?? 0);
/** Las tecnologías que pide la tropa y la Facción no tiene adoptadas. */
const faltanDe = (G: GrafoTropas, E: EstadoPlaza, id: string): string[] => [...G.nodos.get(id)!.acc.tecs.keys()].filter((x) => G.D.tec[x] && !E.adoptadas.includes(x));

/** Se recluta con su tecnología adoptada y su edificio al nivel en la plaza (como el motor); lo demás que pide (equipo) se compra o se fabrica. */
export function estadoTropa(G: GrafoTropas, E: EstadoPlaza, id: string): EstadoTropa {
  const n = G.nodos.get(id)!, t = n.d;
  if (n.era > eraOrd(G.D, E.eraMundo)) return 'futura';
  if (!E.adoptadas.includes(t.tecnologia)) return E.aparecidas.includes(t.tecnologia) ? 'adoptable' : 'bloqueada';
  if (nivelEnPlaza(E, t.edificio) < t.nivelRequerido) return 'edificio';
  return E.escuadras[id] !== undefined ? 'tuya' : 'lista';
}

// ── Disposición ──────────────────────────────────────────────────────────────

interface DisposicionTropas { eraVisible: number; erasVis: ReturnType<typeof erasOrdenadas>; colsEra: Record<number, number>; baseEra: Record<number, number>; NCOL: number; ocupa: Record<string, Set<number>[]>; filas: Record<string, number> }

/**
 * Dentro de cada Era, las columnas van por el nivel del edificio que pide la tropa (nivel 1 a la izquierda), y una tropa va siempre a la derecha de
 * las de su misma Era que la preceden. Las columnas que no usa nadie se quitan. El Centro Urbano no tiene niveles: sus tropas se reparten en un
 * cuadro. Fila: la de su previa del mismo carril si el tramo recto queda libre; si no, la primera libre.
 */
export function disponerTropas(G: GrafoTropas, eraVisible: number, plegados: Set<string> = new Set(), ocultas: Set<string> = new Set()): DisposicionTropas {
  const erasVis = erasOrdenadas(G.D).filter((e) => e.orden <= eraVisible);
  // Los carriles plegados no cuentan: sus tropas no tienen carta. Tampoco las tropas que este lugar no enseña.
  const vis = [...G.nodos.values()].filter((n) => n.era <= eraVisible && !plegados.has(n.carril) && !ocultas.has(n.id));
  const enVis = new Set(vis.map((n) => n.id));
  const local = new Map<string, number>();
  const colDe = (n: NodoTropa): number => {
    if (local.has(n.id)) return local.get(n.id)!;
    local.set(n.id, 0);
    const previas = n.preds.map((p) => G.nodos.get(p.de)!).filter((x) => x.era === n.era && enVis.has(x.id));
    const c = Math.max(n.carril === 'centroUrbano' ? 0 : n.d.nivelRequerido - 1, ...previas.map((x) => colDe(x) + 1));
    local.set(n.id, c);
    return c;
  };
  vis.forEach(colDe);
  // El Centro Urbano en cuadro: tantas columnas como pida la raíz del número de tropas, sin pasar de las que ya tiene la Era (y una Era tiene al
  // menos dos en el tablero: `MIN_COLS` de arbolTablero.ts).
  for (const e of erasVis) {
    const cu = vis.filter((n) => n.era === e.orden && n.carril === 'centroUrbano' && !n.preds.length && !n.hijos.some((h) => G.nodos.get(h)!.era === e.orden));
    const usadas = new Set(vis.filter((n) => n.era === e.orden && n.carril !== 'centroUrbano').map((n) => local.get(n.id)!));
    const ancho = Math.max(1, Math.min(Math.ceil(Math.sqrt(cu.length)), Math.max(2, usadas.size)));
    cu.forEach((n, i) => local.set(n.id, i % ancho));
  }
  const colsEra: Record<number, number> = {}, baseEra: Record<number, number> = {};
  const compacta = new Map<string, number>();
  let NCOL = 0;
  for (const e of erasVis) {
    const usadas = [...new Set(vis.filter((n) => n.era === e.orden).map((n) => local.get(n.id)!))].sort((x, y) => x - y);
    vis.filter((n) => n.era === e.orden).forEach((n) => compacta.set(n.id, usadas.indexOf(local.get(n.id)!)));
    colsEra[e.orden] = Math.max(1, usadas.length);
    baseEra[e.orden] = NCOL;
    NCOL += colsEra[e.orden]!;
  }
  G.nodos.forEach((n) => { delete n.fila; n.col = enVis.has(n.id) ? baseEra[n.era]! + compacta.get(n.id)! : undefined; });
  const ocupa: Record<string, Set<number>[]> = {};
  const filas: Record<string, number> = {};
  for (const c of G.carriles) {
    const occ: Set<number>[] = [];
    ocupa[c.id] = occ;
    const libre = (r: number, col: number): boolean => !occ[r]?.has(col);
    const orden = (n: NodoTropa): number => c.tropas.indexOf(n.id);
    const ts = c.tropas.map((t) => G.nodos.get(t)!).filter((n) => enVis.has(n.id))
      .sort((x, y) => x.col! - y.col! || x.d.nivelRequerido - y.d.nivelRequerido || x.d.escalon - y.d.escalon || orden(x) - orden(y));
    for (const n of ts) {
      const dentro = n.preds.map((p) => G.nodos.get(p.de)!).filter((x) => x.carril === c.id && x.fila !== undefined);
      const ok = (r: number): boolean => {
        if (!libre(r, n.col!)) return false;
        const p = dentro.find((q) => q.fila === r);
        if (!p) return true;
        for (let k = p.col! + 1; k < n.col!; k++) if (!libre(r, k)) return false;
        return true;
      };
      n.fila = [...dentro.map((x) => x.fila!), ...Array.from({ length: 16 }, (_, i) => i)].find(ok) ?? 0;
      (occ[n.fila] ??= new Set()).add(n.col!);
    }
    filas[c.id] = Math.max(1, occ.length);
  }
  return { eraVisible, erasVis, colsEra, baseEra, NCOL, ocupa, filas };
}

// ── Piezas ───────────────────────────────────────────────────────────────────

const ORIGEN = (escalon: number): 'pesants' | 'artesanos' | 'nobleza' => (escalon <= 2 ? 'pesants' : escalon === 3 ? 'artesanos' : 'nobleza');
const ORIGEN_ICONO: Record<string, string> = { pesants: '🌾', artesanos: '⚒️', nobleza: '👑' };
const PUEBLO: Record<string, [string, string]> = {
  'un pueblo de mina de hierro': ['minaHierro', 'Pueblo de mina de hierro'], 'un pueblo de mina de cobre': ['minaCobre', 'Pueblo de mina de cobre'],
  'un pueblo de mina de estaño': ['minaEstano', 'Pueblo de mina de estaño'], 'un pueblo de cantera': ['cantera', 'Pueblo de cantera'],
  'el rebaño de una aldea ganadera': ['corral', 'Aldea ganadera'], Leñera: ['lenera', 'Leñera'], Granja: ['granja', 'Granja'],
  'impuestos y pueblo de mina de oro': ['mina', 'Pueblo de mina de oro'],
};
const MEDALLA: Partial<Record<EstadoTropa, string>> = { lista: '✓', tuya: '⚑', adoptable: '!' };
const liderazgoDe = (escalon: number): number | undefined => bloqueDeDatos<{ costePorEscalon?: Record<string, number> }>('LIDERAZGO')?.costePorEscalon?.[String(escalon)];

function piezas(G: GrafoTropas, e: Escapar, icono: (tipo: string, n: number) => string = iconoEdificio) {
  const D = G.D;
  const TN = (t: string): string => D.tec[t]?.nombre ?? t;
  const RN = (r: string): string => RECURSO_NOMBRE[r] ?? r;
  const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ','));
  const RI = (r: string, n?: number): string => `<span class="ta-rec" title="${e(RN(r))}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i>${n !== undefined ? `<b>${num(n)}</b>` : ''}<span class="ta-sr">${e(RN(r))}</span></span>`;
  const EI = (tipo: string, nivel?: number | string | null, nombre?: string): string => `<span class="ta-rec ta-edi" title="${e(nombre ?? nombreEdificio(tipo))}${nivel ? ` nivel ${nivel}` : ''}">${icono(tipo, 18)}${nivel ? `<b>${nivel}</b>` : ''}<span class="ta-sr">${e(nombre ?? nombreEdificio(tipo))}${nivel ? ` ${nivel}` : ''}</span></span>`;
  const IC = (icono: string, n: number | undefined, titulo: string): string => `<span class="ta-rec" title="${e(titulo)}"><i aria-hidden="true">${icono}</i>${n !== undefined ? `<b>${n}</b>` : ''}<span class="ta-sr">${e(titulo)}</span></span>`;
  const ritmo = (t: TropaReclutable): string => iconoRitmo(velocidadDePiezas([piezaDeTropa(t.id)]), 11);
  const stats = (t: TropaReclutable): string => `${IC('⚔️', t.poderBase, 'Poder')}${IC(ritmo(t), t.velocidad, `Velocidad: ${t.velocidad ?? '?'} u/min`)}${IC('♛', liderazgoDe(t.escalon), 'Liderazgo que ocupa la escuadra')}`;
  const mini = (t: TropaReclutable, n: number): string => `<span class="ta-mini-tropa" title="${e(t.nombre)}">${iconoTropa(t.id, n)}<span class="ta-sr">${e(t.nombre)}</span></span>`;
  const PI = (donde: string): string => (PUEBLO[donde] ? EI(PUEBLO[donde]![0], null, PUEBLO[donde]![1]) : e(donde));
  return { TN, RI, EI, IC, stats, mini, PI };
}

// ── El lugar donde se recluta ────────────────────────────────────────────────

/**
 * Lo que cambia entre la plaza y el campamento de mercenarios (Víctor, 2026-11-06: «la tropa del campamento, la misma interfaz que el
 * reclutamiento, con Campamento donde dice Centro Urbano y ahí pedir prestadas sus tropas»): el nombre del primer carril y qué tropas lleva,
 * qué carriles se pliegan, el estado de cada tropa y cómo se dice.
 */
export interface LugarDeReclutamiento {
  clave: string;
  /** «esta plaza», «este campamento». */
  donde: string;
  /** Tecnologías de tu Facción (marcas del tooltip) y tus escuadras. */
  E: EstadoPlaza;
  eraVisible: number;
  /** El orden de la Era del mundo, si se sabe (sin él no se marca ninguna Era como bloqueada). */
  eraMundo: number | null;
  /** El primer carril (el del Centro Urbano): su nombre, su icono y, si no salen todas, qué tropas lleva. */
  centro: { nombre: string; icono: string; tropas?: Set<string> };
  /** Si el carril se pliega aquí, el texto de la franja. */
  plegado: (carril: string) => string | null;
  estado: (id: string) => EstadoTropa;
  /** La franja de estado de la carta y el texto de la caja del tooltip. */
  carta: (id: string, pz: Piezas) => string;
  caja: (id: string, pz: Piezas) => string;
  /** En lugar de «Por soldado» del catálogo (el campamento cobra oro con el equipo dentro). */
  porSoldado?: (id: string, pz: Piezas) => string | null;
  /** Cómo se dice cada estado en la leyenda. */
  leyenda: Partial<Record<EstadoTropa, string>>;
  ayuda: string;
  icono?: (tipo: string, n: number) => string;
  /** El tooltip dice qué edificios y pueblos de una plaza pide la tropa (no en el campamento, que cobra el equipo dentro). */
  sinEdificios?: boolean;
}
export type Piezas = ReturnType<typeof piezas>;

/** La plaza `a`: carriles por sus edificios, el estado por las tecnologías de tu Facción y el nivel de sus edificios. */
export function lugarPlaza(D: DatosArbol, E: EstadoPlaza): LugarDeReclutamiento {
  const G = grafoDe(D);
  return {
    clave: CLAVE, donde: 'esta plaza', E, eraVisible: ultimaEraVisible(D, E.adoptadas), eraMundo: eraOrd(D, E.eraMundo),
    centro: { nombre: 'Centro Urbano', icono: 'centroUrbano' },
    plegado: (c) => (c !== 'centroUrbano' && !(E.niveles[c]! > 0) ? `Esta plaza no tiene ${nombreEdificio(c)}: aquí no se recluta` : null),
    estado: (id) => estadoTropa(G, E, id),
    carta: (id, { TN, EI }) => {
      const t = G.nodos.get(id)!.d, est = estadoTropa(G, E, id), e = escapar;
      if (est === 'lista') return 'Lista para reclutar';
      if (est === 'tuya') return `Tu escuadra <b>${E.escuadras[id]}</b>/${t.unidadesPorDefecto}`;
      if (est === 'edificio') return `Falta ${EI(t.edificio, t.nivelRequerido)} · tu plaza: ${nivelEnPlaza(E, t.edificio)}`;
      if (est === 'adoptable') return `<span class="ta-btn-mini">Adoptar</span> ${e(TN(t.tecnologia))}`;
      if (est === 'futura') return `Bloqueada: la Era ${ROMANO[G.nodos.get(id)!.era]} aún no empieza`;
      const f = faltanDe(G, E, id);
      return f.length === 1 ? `Falta ${e(TN(f[0]!))}` : `Faltan ${f.length} tecnologías`;
    },
    caja: (id, { TN, EI }) => {
      const n = G.nodos.get(id)!, t = n.d, e = escapar, f = faltanDe(G, E, id);
      return {
        lista: `<b>Lista para reclutar</b> en esta plaza: tienes su tecnología y ${t.edificio === 'centroUrbano' ? 'el Centro Urbano' : `${EI(t.edificio, nivelEnPlaza(E, t.edificio))}`}.`,
        tuya: `<b>Ya tienes su escuadra</b> (${E.escuadras[id]} de ${t.unidadesPorDefecto} hombres). Un héroe tiene una escuadra por tropa.`,
        edificio: `<b>Tienes su tecnología,</b> pero esta plaza tiene ${EI(t.edificio, nivelEnPlaza(E, t.edificio))} y la tropa pide ${EI(t.edificio, t.nivelRequerido)}.`,
        adoptable: `<b>Solo falta adoptar</b> <span class="ta-tec">${e(TN(t.tecnologia))}</span>: ya ha aparecido y el Rey puede adoptarla en la capital.`,
        bloqueada: `<b>${f.length > 1 ? `Te faltan ${f.length} tecnologías` : 'Te falta 1 tecnología'}</b> (marcada${f.length > 1 ? 's' : ''} con ✗ o ! abajo).`,
        futura: `<b>Bloqueada:</b> la Era ${ROMANO[n.era]} aún no ha empezado en el mundo.`,
      }[estadoTropa(G, E, id)];
    },
    leyenda: { lista: 'lista para reclutar', tuya: 'ya tienes su escuadra', edificio: 'falta el edificio a su nivel', adoptable: 'solo falta adoptar su tecnología', bloqueada: 'faltan tecnologías', futura: 'bloqueada: su Era aún no empieza' },
    ayuda: 'Pasa el ratón por una tropa para ver su camino; haz clic para abrir su ficha y reclutarla. Arrastra el tablero para moverte.',
  };
}

/** Lo que el árbol necesita al pintar el tooltip. */
interface Dibujo { G: GrafoTropas; L: LugarDeReclutamiento; visibles: Set<string> }
const dibujos = new Map<string, Dibujo>();
let escapar: Escapar = (s) => s;

// ── HTML del árbol ───────────────────────────────────────────────────────────

/** Los datos del árbol (o `null` mientras no llega el balance) para montar un lugar sobre ellos. */
export const datosDeReclutamiento = (alCargar?: () => void): DatosArbol | null => datosDelArbol(alCargar);

/** El árbol de reclutamiento de la plaza `a`, o un aviso mientras no lleguen el balance o la Facción. */
export function htmlArbolReclutamiento(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar?: () => void): string {
  const D = datosDelArbol(alCargar);
  const E = estadoPlazaDe(p, a);
  if (!D) return '<p class="mapa-lista-vacia">Cargando el catálogo de tropas…</p>';
  if (!E) return '<p class="mapa-lista-vacia">Sin Facción no hay tecnologías, y sin ellas no se recluta.</p>';
  return htmlArbolDeLugar(D, lugarPlaza(D, E), e);
}

/** El árbol de un lugar: la plaza o el campamento. */
export function htmlArbolDeLugar(D: DatosArbol, L: LugarDeReclutamiento, e: Escapar): string {
  escapar = e;
  const G = grafoDe(D);
  const plegados = new Set(G.carriles.filter((c) => L.plegado(c.id) !== null).map((c) => c.id));
  // lo que no se puede reclutar aquí no se enseña: ni la tropa, ni su carril, ni su Era
  const ocultas = new Set([...G.nodos.values()].filter((n) => (n.carril === 'centroUrbano' && L.centro.tropas && !L.centro.tropas.has(n.id))
    || plegados.has(n.carril) || n.era > L.eraVisible || !SE_RECLUTA.has(L.estado(n.id))).map((n) => n.id));
  const quedan = [...G.nodos.values()].filter((n) => !ocultas.has(n.id));
  if (!quedan.length) return `<p class="mapa-lista-vacia">Aún no puedes reclutar ninguna tropa en ${e(L.donde)}.</p>`;
  const eraVisible = Math.max(...quedan.map((n) => n.era));
  const lay = disponerTropas(G, eraVisible, plegados, ocultas);
  const visibles = new Set([...G.nodos.values()].filter((n) => n.era <= eraVisible && !ocultas.has(n.id)).map((n) => n.id));
  const d: Dibujo = { G, L, visibles };
  dibujos.set(L.clave, d);
  const pz = piezas(G, e, L.icono);
  const { EI, stats, mini } = pz;
  const mundo = L.eraMundo ?? 99;
  const ultima = erasOrdenadas(D).at(-1)?.orden ?? 1;
  const futura = (o: number): boolean => o > mundo;
  const carriles = G.carriles.filter((c) => c.tropas.some((t) => visibles.has(t)));
  const enCarta = new Set([...visibles].filter((id) => !plegados.has(G.nodos.get(id)!.carril)));
  const antes = (id: string): Set<string> => { const s = new Set<string>(); const v = (i: string): void => G.nodos.get(i)!.todos.forEach((x) => { if (!s.has(x.de)) { s.add(x.de); v(x.de); } }); v(id); return s; };
  const despues = (id: string): Set<string> => { const s = new Set<string>(); const v = (i: string): void => G.nodos.get(i)!.hijosTodos.forEach((h) => { if (!s.has(h)) { s.add(h); v(h); } }); v(id); return s; };
  fijarDibujo(L.clave, { nodos: G.nodos, ordenCarriles: G.carriles.map((c) => c.id), ocupa: lay.ocupa, ancla: 21, tip: (id) => tipTropa(d, id), antes, despues });

  const eraCab = (x: (typeof lay.erasVis)[number]): string => {
    const actual = x.orden === mundo;
    const sigue = L.E.adoptadas.length > 0 && x.orden === eraVisible && x.orden < ultima && x.orden === ultimaEraVisible(D, L.E.adoptadas);
    const llevas = adoptadasEn(D, L.E.adoptadas, x.orden), cupo = cupoEra(D, x.orden);
    const n = [...G.nodos.values()].filter((y) => y.era === x.orden && !ocultas.has(y.id)).length;
    return `<span class="ta-era-num" aria-hidden="true">${ROMANO[x.orden] ?? x.orden}</span>
      <span class="ta-era-nombre">Era ${ROMANO[x.orden] ?? x.orden} · ${e(x.nombre)}</span>
      <span class="ta-era-sub">${n} tropa${n === 1 ? '' : 's'} · ${x.minimoSemanas !== undefined ? `dura de ${x.minimoSemanas} a ${x.plazoSemanas} semanas` : `dura hasta ${x.plazoSemanas} semanas`}</span>
      ${sigue ? `<span class="ta-era-sigue"><span>La Era ${ROMANO[x.orden + 1]} aparece con ${cupo} de las ${tecsDeEra(D, x.orden).length} tecnologías de esta Era adoptadas: llevas <b>${llevas}</b></span><span class="barra" style="--p:${Math.min(1, llevas / Math.max(1, cupo))}"></span></span>` : ''}
      ${actual || futura(x.orden) ? `<span class="ta-era-marca${actual ? ' actual' : ' futura'}">${actual ? 'Era del mundo' : 'Bloqueada'}</span>` : ''}`;
  };
  const cartas: CartaTablero[] = [];
  for (const id of enCarta) {
    const n = G.nodos.get(id)!, t = n.d, est = L.estado(id);
    const cruces = n.preds.filter((x) => G.nodos.get(x.de)!.carril !== n.carril && enCarta.has(x.de));
    const porTipo = (['hito', 'implicita', 'logro'] as const).map((tp) => [tp, cruces.filter((x) => x.tipo === tp)] as const).filter(([, l]) => l.length);
    const edificio = t.edificio === 'centroUrbano' ? EI(L.centro.icono, null, L.centro.nombre) : EI(t.edificio, t.nivelRequerido);
    cartas.push({ carril: n.carril, col: n.col!, fila: n.fila!, html: (estilo) => `<button type="button" class="ta-carta ta-tropa ${est}" data-nodo="${e(id)}" style="${estilo}" aria-label="${e(t.nombre)}">
      <span class="ta-carta-cab"><span class="ta-carta-ico">${iconoTropa(t.id, 30)}</span><span class="ta-carta-nombre">${e(t.nombre)}</span><span class="ta-medalla" aria-hidden="true">${MEDALLA[est] ?? ''}</span></span>
      <span class="ta-carta-datos">${edificio}<span>escalón ${t.escalon}</span><span>${t.unidadesPorDefecto} ${ORIGEN_ICONO[ORIGEN(t.escalon)]}</span></span>
      <span class="ta-carta-stats">${stats(t)}</span>
      ${porTipo.length ? `<span class="ta-carta-pide">${porTipo.map(([tp, l]) => `<span class="ta-pide">${muestraLinea(tp)}Tras ${l.map((x) => mini(G.nodos.get(x.de)!.d, 20)).join('')}${l.length === 1 ? `<span class="ta-pide-nombre">${e(corta(G.nodos.get(l[0]!.de)!.d.nombre, 26))}</span>` : ''}</span>`).join('')}</span>` : ''}
      <span class="ta-carta-estado">${L.carta(id, pz)}</span></button>` });
  }
  const tipos = new Set([...enCarta].flatMap((id) => G.nodos.get(id)!.preds.filter((x) => enCarta.has(x.de)).map((x) => x.tipo)));
  const hay = new Set([...enCarta].map((id) => L.estado(id)));
  const sw = (est: EstadoTropa): string => (hay.has(est) && L.leyenda[est] ? `<span><span class="ta-muestra ${est}"></span>${L.leyenda[est]}</span>` : '');
  const ley = [
    tipos.size ? '<span>B va tras A cuando B necesita la tecnología que habilita a A:</span>' : '',
    tipos.has('hito') ? `<span>${muestraLinea('hito', 26)}su tecnología la pide en el hito</span>` : '',
    tipos.has('implicita') ? `<span>${muestraLinea('implicita', 26)}la pide su edificio o su equipo</span>` : '',
    tipos.has('logro') ? `<span>${muestraLinea('logro', 26)}la pide el logro de su tecnología (dependencia oculta)</span>` : '',
    ...(['lista', 'tuya', 'edificio', 'adoptable', 'bloqueada', 'futura'] as EstadoTropa[]).map(sw),
  ].filter(Boolean).join('');
  return htmlTablero({
    clave: L.clave, esquina: 'Se recluta en · Era', NCOL: lay.NCOL, e, icono: L.icono ?? iconoEdificio, cartas, leyenda: ley, ayuda: L.ayuda,
    eras: lay.erasVis.map((x) => ({ base: lay.baseEra[x.orden]!, cols: lay.colsEra[x.orden]!, futura: futura(x.orden), cab: eraCab(x) })),
    carriles: carriles.map((c) => {
      const n = c.tropas.filter((t) => visibles.has(t)).length;
      const centro = c.id === 'centroUrbano';
      const vacio = L.plegado(c.id);
      return { id: c.id, nombre: centro ? L.centro.nombre : c.nombre, icono: centro ? L.centro.icono : c.id, filas: vacio ? 1 : lay.filas[c.id]!, sub: `${n} tropa${n === 1 ? '' : 's'}`, vacio: vacio ?? undefined };
    }),
  });
}

/** Lo que se enseña: lo que se recluta aquí y lo que ya tienes. */
const SE_RECLUTA = new Set<EstadoTropa>(['lista', 'tuya']);

const corta = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);

// ── Tooltip (el del árbol de tropas: las tecnologías siguen aquí) ───────────

function tipTropa(d: Dibujo, id: string): string {
  const { G, L, visibles } = d;
  const E = L.E, e = escapar;
  const D = G.D, n = G.nodos.get(id)!, t = n.d, a = n.acc, est = L.estado(id);
  const pz = piezas(G, e, L.icono);
  const { TN, RI, EI, IC, stats, mini, PI } = pz;
  const costeTxt = (c: Record<string, number | undefined>): string => Object.entries(c).map(([r, x]) => RI(r, x ?? 0)).join(' ');
  const cadena = (r: string, pre: string): string => {
    const rc = D.recetas[r];
    if (!rc) { const b = BRUTO[r]; return b ? `<li>${pre} de ${PI(b.donde)}${b.tec ? ` (pide <span class="ta-tec">${e(TN(b.tec))}</span>)` : ''}</li>` : `<li>${pre}</li>`; }
    return `<li>${pre} ${EI(rc.edificio, rc.nivel)}${rc.tec ? ` con <span class="ta-tec">${e(TN(rc.tec))}</span>` : ''} · sale de ${costeTxt(rc.consume)}</li>`;
  };
  const marca = (x: string): string => (E.adoptadas.includes(x) ? '<span class="ok" title="Adoptada">✓</span>' : E.aparecidas.includes(x) ? '<span class="ap" title="Aparecida: el Rey puede adoptarla">!</span>' : '<span class="no" title="Falta">✗</span>');
  const tecs = [...a.tecs.entries()].filter(([x]) => D.tec[x]).sort((x, y) => eraOrd(D, D.tec[x[0]]!.era) - eraOrd(D, D.tec[y[0]]!.era)).map(([x, por]) => {
    const ps = [...por];
    const recs = ps.filter((q) => q.startsWith('r:')).map((q) => RI(q.slice(2))).concat(ps.filter((q) => q.startsWith('e:')).map((q) => { const [, tp, nv] = q.split(':'); return EI(tp!, nv ? Number(nv) : null); }));
    const motivo = [...ps.filter((q) => q === 'la habilita'), ...(recs.length ? ['para ' + recs.join(' ')] : [])].join(', ');
    const k = D.tec[x]!;
    return `<li>${marca(x)} <span class="ta-tec">${e(TN(x))}</span> <span class="ta-meta">(Era ${ROMANO[eraOrd(D, k.era)] ?? ''}${k.deArranque ? ', de arranque' : ''}${motivo ? ` · ${motivo}` : ''})</span></li>`;
  }).join('');
  const origen = ORIGEN(t.escalon);
  const oroEsc = oroPorSoldado(t);
  const centro = t.edificio === 'centroUrbano';
  let h = `<div class="ta-tip-cab">${iconoTropa(t.id, 34)}<div><h3>${e(t.nombre)}</h3><div class="ta-meta">${e(centro ? L.centro.nombre : `${nombreEdificio(t.edificio)} ${t.nivelRequerido}`)} · Era ${ROMANO[n.era]} · escalón ${t.escalon} · escuadra de ${t.unidadesPorDefecto} ${ORIGEN_ICONO[origen]}</div></div></div>`;
  h += `<div class="ta-estado-caja ${est}"><span class="ta-meta">En ${L.donde}</span><br>${L.caja(id, pz)}</div>`;
  // Sin Facción no hay tecnologías adoptadas que marcar.
  if (E.adoptadas.length) h += `<h4>Tecnologías de tu Facción</h4><ul class="ta-marcadas">${tecs}</ul>`;
  const conTec = [...a.eds.keys()].filter((x) => D.edificios[x]?.construir.tec).map((x) => `${EI(x)} pide <span class="ta-tec">${e(TN(D.edificios[x]!.construir.tec!))}</span> para construirse`);
  if (!L.sinEdificios) h += `<h4>Edificios y pueblos</h4><div class="ta-fichas">${EI('plaza', a.plaza, 'Plaza')}${centro ? EI('centroUrbano', null, 'Centro Urbano (lo tiene toda plaza)') : ''}${[...a.eds.entries()].map(([x, nv]) => EI(x, nv)).join('')}${[...a.pueblos].map(PI).join('')}</div>${conTec.length ? `<div class="ta-nota">${conTec.join('; ')}.</div>` : ''}`;
  const propio = L.porSoldado?.(id, pz);
  if (propio !== undefined && propio !== null) h += propio;
  else {
    const equipo = Object.keys(t.costoEquipo);
    h += `<h4>Por soldado</h4><ul>${equipo.length ? equipo.map((r) => cadena(r, RI(r, t.costoEquipo[r] ?? 0))).join('') : '<li>Sin equipo</li>'}`;
    if (oroEsc !== null) h += `<li>${RI('oro', oroEsc)}${centro ? ' (la leva del Centro Urbano no paga oro)' : t.caballos ? ` (con ${t.caballos} caballo${t.caballos > 1 ? 's' : ''})` : ''}</li>`;
    h += `<li>${IC(ORIGEN_ICONO[origen]!, 1, `${origen} libres de la plaza`)} ${origen === 'pesants' ? 'campesino' : origen === 'artesanos' ? 'artesano' : 'noble'} libre de la plaza</li></ul>`;
  }
  h += `<h4>En campaña</h4><div class="ta-fichas">${stats(t)}</div>`;
  const tras = n.todos.map((x) => G.nodos.get(x.de)!.d), lleva = n.hijosTodos.filter((x) => visibles.has(x)).map((x) => G.nodos.get(x)!.d);
  if (tras.length || lleva.length) h += `<h4>En el árbol</h4><ul>${tras.length ? `<li>Va tras: ${tras.map((x) => `${mini(x, 18)} ${e(x.nombre)}`).join(', ')}</li>` : ''}${lleva.length ? `<li>Lleva a: ${lleva.map((x) => `${mini(x, 18)} ${e(x.nombre)}`).join(', ')}</li>` : ''}</ul>`;
  return h;
}

// ── Montaje ──────────────────────────────────────────────────────────────────

/** Cablea el árbol recién pintado (líneas, resaltado, tooltip, ficha y arrastre: `arbolTablero.ts`). */
export function montarArbolReclutamiento(raiz: HTMLElement, ctx: ContextoArbol, clave = CLAVE): void { montarTablero(clave, raiz, ctx); }
/** El grafo y el estado del último árbol pintado de un lugar (la ficha de reclutar los necesita). */
export const ultimoDibujo = (clave = CLAVE): { G: GrafoTropas; E: EstadoPlaza; L: LugarDeReclutamiento } | null => { const d = dibujos.get(clave); return d ? { G: d.G, E: d.L.E, L: d.L } : null; };
