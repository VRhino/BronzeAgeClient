// El árbol de tecnologías de la pestaña Tecnología de Facción (Víctor, 2026-11-06; prototipo del hilo del árbol de tropas,
// https://claude.ai/artifact/Wqbw16kT56pyN1ziBgDJ2M). Reglas suyas:
//   - Carriles por tema (filas) × Eras (columnas). Las líneas solo unen tecnologías del mismo carril; lo que viene de otro lo dice la carta («Pide X»)
//     y el camino entero se dibuja al pasar el ratón. «Ver todas las conexiones» las enseña todas.
//   - Líneas rectas con ángulos rectos y nodos con aire entre ellos.
//   - Las dependencias ocultas de los logros (lo que cuenta el contador pide antes otra tecnología) se pintan como directas, punteadas.
//   - Lo que el canon dice que abren tres tecnologías y el motor no aplica va marcado «canon, sin efecto aún».
//   - Los iconos del cliente (recursos, edificios y tropas).
//   - El árbol se descubre por Eras: solo se ve la Era I hasta que la Facción adopta el 30 % de sus tecnologías (con las de arranque, hacia arriba);
//     entonces aparece la siguiente, bloqueada mientras no empiece en el mundo. Lo oculto no se nombra en ningún sitio. Regla de pantalla: el motor
//     no cambia.
// Todo sale del balance que ya carga el cliente (TECNOLOGIAS, ERAS, TARIFA_ADOPCION, TROPAS_RECLUTABLES, EDIFICIO_CATALOGO) y del estado de la
// Facción (`p.tecnologia`). Los contadores de los logros en curso no viajan nunca: la carta dice «cumplido» o «falta», sin barra.
import { bloqueDeDatos, catalogoDeTecnologia, tropasReclutables, type CatalogoTecnologia, type NivelDeEdificio, type ProyeccionJugador, type TropaReclutable } from '../apiCliente';
import type { CondicionHito } from '../tiposDominio';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { iconoEdificio } from './iconosEdificio';
import { iconoTropa } from './iconosTropa';

type Escapar = (s: string) => string;
type Tec = CatalogoTecnologia['TECNOLOGIAS'][string];

// ── Datos ────────────────────────────────────────────────────────────────────

interface EdificioDelArbol {
  construir: { plaza: number; tec?: string };
  niveles: Record<string, { plaza?: number; edificio?: string; edificioNivel?: number; tec?: string }>;
}
interface RecetaDelArbol { edificio: string; nivel: number; tec?: string; consume: Record<string, number> }
export interface DatosArbol {
  tec: Record<string, Tec>;
  eras: Record<string, { orden: number; nombre: string; plazoSemanas: number; minimoSemanas?: number }>;
  tarifa: Record<string, Record<string, number>>;
  tropas: TropaReclutable[];
  edificios: Record<string, EdificioDelArbol>;
  recetas: Record<string, RecetaDelArbol>;
}
type EntradaCatalogo = { requisitoNivelAsentamientoConstruccion?: number; requiereTecnologia?: string; niveles?: Record<string, NivelDeEdificio> };

/** Los edificios (requisitos de construir y de cada nivel) y las recetas (cada producto, en el primer edificio y nivel que lo hace) del catálogo. */
export function datosDesdeCatalogo(cat: Pick<CatalogoTecnologia, 'TECNOLOGIAS' | 'ERAS' | 'TARIFA_ADOPCION'>, tropas: TropaReclutable[], catalogo: Record<string, EntradaCatalogo>): DatosArbol {
  const edificios: Record<string, EdificioDelArbol> = {};
  const recetas: Record<string, RecetaDelArbol> = {};
  for (const [tipo, v] of Object.entries(catalogo)) {
    const niveles: EdificioDelArbol['niveles'] = {};
    for (const [n, l] of Object.entries(v.niveles ?? {})) niveles[n] = { plaza: l.requisitoNivelAsentamiento, edificio: l.requiereEdificio, edificioNivel: l.requiereEdificioNivel, tec: l.requiereTecnologia };
    edificios[tipo] = { construir: { plaza: v.requisitoNivelAsentamientoConstruccion ?? 1, tec: v.requiereTecnologia }, niveles };
    if (tipo === 'granFundicion') continue;
    for (const [n, l] of Object.entries(v.niveles ?? {}).sort(([a], [b]) => Number(a) - Number(b))) {
      for (const r of l.recetas ?? []) if (!recetas[r.produce]) recetas[r.produce] = { edificio: tipo, nivel: Number(n), tec: r.requiereTecnologia, consume: r.consumePorUnidad };
    }
  }
  return { tec: cat.TECNOLOGIAS, eras: cat.ERAS, tarifa: cat.TARIFA_ADOPCION, tropas, edificios, recetas };
}

let datosCache: { claves: unknown[]; d: DatosArbol } | null = null;
/** Los datos del árbol, o `null` mientras no llegue el balance. */
function datosDelArbol(alCargar?: () => void): DatosArbol | null {
  const cat = catalogoDeTecnologia(alCargar), tropas = tropasReclutables(alCargar), catalogo = bloqueDeDatos<Record<string, EntradaCatalogo>>('EDIFICIO_CATALOGO', alCargar);
  if (!cat || !tropas || !catalogo) return null;
  const claves = [cat, tropas, catalogo];
  if (!datosCache || datosCache.claves.some((c, i) => c !== claves[i])) datosCache = { claves, d: datosDesdeCatalogo(cat, tropas, catalogo) };
  return datosCache.d;
}

// ── Tablas del cliente ───────────────────────────────────────────────────────

const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];
/** De dónde salen las materias primas fuera de las recetas (pueblos y aldeas desde el 2026-11-01). */
const BRUTO: Record<string, { donde: string; tec?: string }> = {
  madera: { donde: 'Leñera' }, piedra: { donde: 'un pueblo de cantera' }, cobre: { donde: 'un pueblo de mina de cobre' },
  estano: { donde: 'un pueblo de mina de estaño' }, hierro: { donde: 'un pueblo de mina de hierro', tec: 'forja_hierro_temprana' },
  livestock: { donde: 'el rebaño de una aldea agrícola' }, trigo: { donde: 'Granja' }, oro: { donde: 'impuestos y pueblo de mina de oro' },
};
/** El hito «edificio» de estos tipos se cumple con un pueblo o una aldea (Tecnologia_Aedas §3). */
const HITO_PUEBLO: Record<string, string> = { corral: 'una aldea agrícola activa', cantera: 'un pueblo de cantera activo', minaHierro: 'un pueblo de mina de hierro activo' };
/** El texto de cada contador de logro. */
const CONTADOR: Record<string, string> = {
  'extraido.cobre': 'cobre extraído', 'extraido.estano': 'estaño extraído', 'extraido.piedra': 'piedra extraída', 'extraido.hierro': 'hierro extraído',
  'fabricado.equipoBronce': 'piezas de equipo de bronce fabricadas', 'fabricado.armaduraBronce': 'armaduras de bronce fabricadas',
  'batallas.libradas': 'batallas libradas', 'batallas.conHoplitas': 'batallas con hoplitas ciudadanos', 'batallas.campoAbierto': 'batallas en campo abierto',
  'asedios.resistidosEnCombate': 'asedios resistidos combatiendo', 'asedios.resistidosConResidentes': 'asedios resistidos con residentes en persona',
  'asedios.contraMurallaCompleta': 'asedios contra muralla completa', 'conquistas.conMurallaCompleta': 'conquistas de plaza con muralla completa',
  'caravanas.destruidasOCapturadas': 'caravanas destruidas o capturadas', 'bandidos.campamentosDestruidos': 'campamentos de bandidos destruidos',
  'animales.comprados': 'animales comprados a caravanas', 'reclutados.escuadrones': 'escuadras nuevas reclutadas',
  'reclutados.caballeria': 'jinetes reclutados (cada carro cuenta 5)', 'reclutados.arqueros': 'arqueros reclutados',
  'reclutados.escaramuzadores_jabalina': 'escaramuzadores con jabalina reclutados', 'reclutados.arqueros_compuesto': 'arqueros con arco compuesto reclutados',
  'reclutados.jinetes_asirios': 'jinetes asirios reclutados', 'plazasEnNivel.2': 'plazas a la vez en nivel 2 o más (récord)', 'plazasEnNivel.3': 'plazas a la vez en nivel 3 o más (récord)',
};
/** El texto de un contador de logro («caravanas destruidas o capturadas»), o el id legible. */
export const textoContador = (c: string): string => CONTADOR[c] ?? c.replace(/[._]/g, ' ');
/** Lo que el canon (Doc 6.6, 5.2 y 5.3) dice que abren y el motor aún no aplica. */
const CANON_CORTO: Record<string, string> = { disciplina_formacion: 'Formaciones cerradas', carpinteria_militar: 'Escalas y defensas', trabajos_asedio: 'Equipo de asedio' };
/** Carriles por tema, con el icono del edificio que manda en cada uno. Una tecnología nueva sin carril cae en «Otras». */
const CARRILES_BASE = [
  { id: 'gobierno', nombre: 'Gobierno y obras', icono: 'salaConsejo', tecs: ['canteria', 'instituciones_civicas'] },
  { id: 'infanteria', nombre: 'Infantería', icono: 'barracon', tecs: ['leva_comunal', 'escudos_ligeros', 'armamento_palacial', 'disciplina_formacion', 'panoplia_bronce', 'ciudadania_militar', 'falange_hoplita'] },
  { id: 'metal', nombre: 'Metalurgia', icono: 'fundicion', tecs: ['metalurgia_cobre', 'aleacion_bronce', 'bronce_calidad_militar', 'forja_hierro_temprana', 'bronce_laminado', 'forja_hierro_estandarizada'] },
  { id: 'proyectiles', nombre: 'Proyectiles', icono: 'galeriaDeTiro', tecs: ['hostigamiento_tribal', 'arqueria_palacial', 'arco_compuesto', 'pantalla_escaramuzadores', 'arqueria_especializada'] },
  { id: 'caballeria', nombre: 'Caballería', icono: 'caballerizas', tecs: ['cria_caballar', 'carros_guerra', 'equitacion_militar', 'caballeria_organizada'] },
  { id: 'asedio', nombre: 'Ingeniería y asedio', icono: 'carpinteria', tecs: ['carpinteria_militar', 'trabajos_asedio'] },
];

// ── Requisitos ───────────────────────────────────────────────────────────────

/** Un acumulador: tecnologías (con el motivo), edificios (tipo → nivel mínimo), nivel de plaza y pueblos. */
interface Acc { tecs: Map<string, Set<string>>; eds: Map<string, number>; plaza: number; pueblos: Set<string> }
const nuevoAcc = (): Acc => ({ tecs: new Map(), eds: new Map(), plaza: 1, pueblos: new Set() });
const anotaTec = (acc: Acc, t: string | undefined, por: string): void => { if (!t) return; if (!acc.tecs.has(t)) acc.tecs.set(t, new Set()); acc.tecs.get(t)!.add(por); };

export interface Grafo {
  D: DatosArbol;
  nodos: Map<string, Nodo>;
  carriles: Carril[];
  accTropa: Map<string, Acc>;
  logroDe: (id: string) => string[];
}
interface Nodo { id: string; d: Tec; acc: Acc; preds: { de: string; tipo: 'hito' | 'implicita' | 'logro' }[]; hijos: string[]; era: number; carril: string; col?: number; fila?: number }
interface Carril { id: string; nombre: string; icono: string; tecs: string[]; visible?: boolean; filas?: number; fila0?: number; filaFin?: number }

const eraOrd = (D: DatosArbol, id: string): number => D.eras[id]?.orden ?? 99;

export function construirGrafo(D: DatosArbol): Grafo {
  function reqEdificio(acc: Acc, tipo: string, nivel: number, por = 'edificio'): void {
    if (tipo === 'centroUrbano') return;
    if ((acc.eds.get(tipo) ?? 0) >= nivel) return;
    acc.eds.set(tipo, nivel);
    const e = D.edificios[tipo];
    if (!e) return;
    acc.plaza = Math.max(acc.plaza, e.construir.plaza || 1);
    anotaTec(acc, e.construir.tec, 'e:' + tipo);
    for (let n = 2; n <= nivel; n++) {
      const l = e.niveles[String(n)]; if (!l) continue;
      acc.plaza = Math.max(acc.plaza, l.plaza || 1);
      anotaTec(acc, l.tec, `e:${tipo}:${n}`);
      if (l.edificio) reqEdificio(acc, l.edificio, l.edificioNivel || 1, por);
    }
  }
  function reqRecurso(acc: Acc, r: string, vistos = new Set<string>()): void {
    if (vistos.has(r)) return;
    vistos.add(r);
    const rc = D.recetas[r];
    if (rc) {
      anotaTec(acc, rc.tec, 'r:' + r);
      reqEdificio(acc, rc.edificio, rc.nivel);
      for (const x of Object.keys(rc.consume)) reqRecurso(acc, x, vistos);
    } else if (BRUTO[r]) {
      if (BRUTO[r]!.donde.startsWith('un pueblo') || BRUTO[r]!.donde.startsWith('el rebaño')) acc.pueblos.add(BRUTO[r]!.donde);
      anotaTec(acc, BRUTO[r]!.tec, 'r:' + r);
    }
  }
  const reqTropa = (t: TropaReclutable): Acc => {
    const acc = nuevoAcc();
    anotaTec(acc, t.tecnologia, 'la habilita');
    reqEdificio(acc, t.edificio, t.nivelRequerido);
    for (const r of Object.keys(t.costoEquipo)) reqRecurso(acc, r);
    return acc;
  };
  // Dependencias ocultas en el logro: lo que cuenta el contador pide antes otras tecnologías en alguna Facción del mundo. Si el contador sube por
  // varias vías, solo cuenta lo que piden todas (las que no piden la propia).
  const logroDe = (id: string): string[] => {
    const c = D.tec[id]?.logro?.contador ?? '';
    const deTropa = (tid: string): string[] => { const t = D.tropas.find((x) => x.id === tid); return t ? [...reqTropa(t).tecs.keys()] : []; };
    const deRecurso = (r: string): string[] => { const a = nuevoAcc(); reqRecurso(a, r); return [...a.tecs.keys()]; };
    let vias: string[][] = [];
    if (c === 'reclutados.caballeria') vias = D.tropas.filter((t) => t.edificio === 'caballerizas').map((t) => deTropa(t.id));
    else if (c.startsWith('reclutados.') && c !== 'reclutados.escuadrones') vias = [deTropa(c.split('.')[1]!)];
    else if (c === 'batallas.conHoplitas') vias = [deTropa('hoplitas_ciudadanos')];
    else if (c === 'fabricado.equipoBronce') vias = ['armaBronce', 'armaBronceCalidad', 'armaduraBronce', 'armaduraBronceCalidad'].map(deRecurso);
    else if (c === 'fabricado.armaduraBronce') vias = [deRecurso('armaduraBronce')];
    else if (c === 'extraido.hierro') vias = [['forja_hierro_temprana']];
    vias = vias.filter((v) => v.length && !v.includes(id));
    if (!vias.length) return [];
    return vias[0]!.filter((x) => D.tec[x] && vias.every((v) => v.includes(x)));
  };
  const reqTec = (id: string): Acc => {
    const acc = nuevoAcc();
    for (const h of D.tec[id]!.hito) {
      if (h.tipo === 'tecnologia') anotaTec(acc, h.id, 'hito');
      else if (h.tipo === 'edificio' && !HITO_PUEBLO[h.edificio]) reqEdificio(acc, h.edificio, h.nivelInterno || 1, 'hito');
      else if (h.tipo === 'edificio' && h.edificio === 'minaHierro') anotaTec(acc, 'forja_hierro_temprana', 'pueblo de mina de hierro');
      else if (h.tipo === 'capitalEnNivel') reqEdificio(acc, h.conEdificio, 1, 'hito');
    }
    for (const x of logroDe(id)) anotaTec(acc, x, 'logro');
    acc.tecs.delete(id);
    for (const t of [...acc.tecs.keys()]) if (!D.tec[t]) acc.tecs.delete(t);
    return acc;
  };

  const carriles: Carril[] = CARRILES_BASE.map((c) => ({ ...c, tecs: c.tecs.filter((t) => D.tec[t]) }));
  const carrilDe = new Map<string, string>();
  carriles.forEach((c) => c.tecs.forEach((t) => carrilDe.set(t, c.id)));
  const sueltas = Object.keys(D.tec).filter((t) => !carrilDe.has(t));
  if (sueltas.length) { carriles.push({ id: 'otras', nombre: 'Otras', icono: 'plaza', tecs: sueltas }); sueltas.forEach((t) => carrilDe.set(t, 'otras')); }

  const nodos = new Map<string, Nodo>();
  for (const id of Object.keys(D.tec)) nodos.set(id, { id, d: D.tec[id]!, acc: reqTec(id), preds: [], hijos: [], era: 0, carril: carrilDe.get(id)! });
  const accTropa = new Map(D.tropas.map((t) => [t.id, reqTropa(t)]));
  const antep = new Map<string, Set<string>>();
  const antepDe = (t: string, camino = new Set<string>()): Set<string> => {
    if (antep.has(t)) return antep.get(t)!;
    const s = new Set<string>();
    if (camino.has(t)) return s;
    camino.add(t);
    for (const p of nodos.get(t)!.acc.tecs.keys()) { s.add(p); antepDe(p, camino).forEach((x) => s.add(x)); }
    antep.set(t, s);
    return s;
  };
  for (const n of nodos.values()) {
    const todas = [...n.acc.tecs.keys()];
    const delHito = (a: string): boolean => n.d.hito.some((h) => h.tipo === 'tecnologia' && h.id === a);
    // Se quita la arista que ya implica otra (si A pide B y B pide C, A → C sobra).
    n.preds = todas.filter((a) => !todas.some((b) => b !== a && antepDe(b).has(a)))
      .map((a) => ({ de: a, tipo: delHito(a) ? 'hito' : n.acc.tecs.get(a)!.has('logro') ? 'logro' : 'implicita' }));
    n.era = Math.max(eraOrd(D, n.d.era), ...todas.map((t) => eraOrd(D, D.tec[t]!.era)));
  }
  for (const n of nodos.values()) for (const p of n.preds) nodos.get(p.de)!.hijos.push(n.id);
  return { D, nodos, carriles, accTropa, logroDe };
}

let grafoCache: { D: DatosArbol; g: Grafo } | null = null;
const grafoDe = (D: DatosArbol): Grafo => (grafoCache?.D === D ? grafoCache.g : (grafoCache = { D, g: construirGrafo(D) }).g);

// ── Estado de la Facción ─────────────────────────────────────────────────────

export type EstadoCarta = 'adoptada' | 'adoptable' | 'revelada' | 'logro' | 'bloqueada' | 'futura';
export interface EstadoArbol {
  adoptadas: string[];
  aparecidas: string[];
  reveladas: Map<string, { cumplidas: boolean[]; hito: CondicionHito[]; descubridor: string }>;
  /** Logros del mundo cumplidos. */
  logros: { contador: string; umbral: number }[];
  eraMundo: string;
}

/** Al 30 % de adoptadas de una Era (con las de arranque, redondeando hacia arriba) aparece la siguiente (Víctor, 2026-11-06). */
export const UMBRAL_ERA = 0.3;
const erasOrdenadas = (D: DatosArbol): { id: string; orden: number; nombre: string; plazoSemanas: number; minimoSemanas?: number }[] =>
  Object.entries(D.eras).sort((a, b) => a[1].orden - b[1].orden).map(([id, e]) => ({ id, ...e }));
const tecsDeEra = (D: DatosArbol, o: number): string[] => Object.keys(D.tec).filter((t) => eraOrd(D, D.tec[t]!.era) === o);
export const cupoEra = (D: DatosArbol, o: number): number => Math.ceil(UMBRAL_ERA * tecsDeEra(D, o).length - 1e-9);
const adoptadasEn = (D: DatosArbol, adoptadas: string[], o: number): number => tecsDeEra(D, o).filter((t) => adoptadas.includes(t)).length;
/** La última Era que la Facción ve. */
export function ultimaEraVisible(D: DatosArbol, adoptadas: string[]): number {
  const eras = erasOrdenadas(D);
  let u = eras[0]?.orden ?? 1;
  for (const e of eras.slice(0, -1)) { if (e.orden !== u || adoptadasEn(D, adoptadas, e.orden) < cupoEra(D, e.orden)) break; u = e.orden + 1; }
  return u;
}

const logroCumplido = (E: EstadoArbol, t: Tec): boolean => Boolean(t.logro && E.logros.some((l) => l.contador === t.logro!.contador && l.umbral >= t.logro!.umbral));
export function estadoDe(G: Grafo, E: EstadoArbol, id: string): EstadoCarta {
  if (E.adoptadas.includes(id)) return 'adoptada';
  if (E.aparecidas.includes(id)) return 'adoptable';
  if (G.nodos.get(id)!.era > eraOrd(G.D, E.eraMundo)) return 'futura';
  if (E.reveladas.has(id)) return 'revelada';
  if (logroCumplido(E, G.D.tec[id]!)) return 'logro';
  return 'bloqueada';
}

export function estadoDesdeProyeccion(p: ProyeccionJugador): EstadoArbol | null {
  const t = p.tecnologia;
  if (!t?.propias) return null;
  return {
    adoptadas: t.propias.adoptadas,
    aparecidas: t.propias.aparecidas,
    reveladas: new Map(t.reveladas.map((r) => [r.tecnologiaId, { cumplidas: r.cumplidas, hito: r.hito, descubridor: r.descubridorFaccionId }])),
    logros: t.logros,
    eraMundo: t.era,
  };
}

// ── Disposición ──────────────────────────────────────────────────────────────

interface Disposicion { eraVisible: number; erasVis: ReturnType<typeof erasOrdenadas>; colsEra: Record<number, number>; baseEra: Record<number, number>; NCOL: number; ocupa: Record<string, Set<number>[]>; carriles: Carril[] }

/** Columna: la Era y, dentro de ella, lo largo de la cadena de la misma Era que la precede. Fila: la de su previa del mismo carril si el tramo
 * recto está libre; si no, la primera libre. */
function disponer(G: Grafo, eraVisible: number): Disposicion {
  const prof = new Map<string, number>();
  const profDe = (id: string): number => {
    if (prof.has(id)) return prof.get(id)!;
    prof.set(id, 0);
    const n = G.nodos.get(id)!;
    const v = Math.max(-1, ...n.preds.map((p) => G.nodos.get(p.de)!).filter((x) => x.era === n.era).map((x) => profDe(x.id))) + 1;
    prof.set(id, v);
    return v;
  };
  const erasVis = erasOrdenadas(G.D).filter((e) => e.orden <= eraVisible);
  const colsEra: Record<number, number> = {}, baseEra: Record<number, number> = {};
  let NCOL = 0;
  for (const e of erasVis) {
    colsEra[e.orden] = 1 + Math.max(0, ...[...G.nodos.values()].filter((n) => n.era === e.orden).map((n) => profDe(n.id)));
    baseEra[e.orden] = NCOL;
    NCOL += colsEra[e.orden]!;
  }
  G.nodos.forEach((n) => { delete n.fila; n.col = n.era <= eraVisible ? baseEra[n.era]! + profDe(n.id) : undefined; });
  const ocupa: Record<string, Set<number>[]> = {};
  const carriles = G.carriles.map((c) => ({ ...c }));
  for (const c of carriles) {
    const occ: Set<number>[] = [];
    ocupa[c.id] = occ;
    const libre = (r: number, col: number): boolean => !occ[r]?.has(col);
    const ts = c.tecs.map((t) => G.nodos.get(t)!).filter((n) => n.era <= eraVisible).sort((a, b) => a.col! - b.col! || c.tecs.indexOf(a.id) - c.tecs.indexOf(b.id));
    for (const n of ts) {
      const dentro = n.preds.map((p) => G.nodos.get(p.de)!).filter((x) => x.carril === c.id && x.fila !== undefined);
      const ok = (r: number): boolean => {
        if (!libre(r, n.col!)) return false;
        const p = dentro.find((q) => q.fila === r);
        if (!p) return true;
        for (let k = p.col! + 1; k < n.col!; k++) if (!libre(r, k)) return false;
        return true;
      };
      n.fila = [...dentro.map((x) => x.fila!), ...Array.from({ length: 12 }, (_, i) => i)].find(ok) ?? 0;
      (occ[n.fila] ??= new Set()).add(n.col!);
    }
    c.visible = ts.length > 0;
    c.filas = Math.max(1, occ.length);
  }
  return { eraVisible, erasVis, colsEra, baseEra, NCOL, ocupa, carriles };
}

// ── Piezas de HTML ───────────────────────────────────────────────────────────

const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ','));
const miles = (n: number): string => n.toLocaleString('es-ES');
const RN = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const EN = (t: string): string => EDIFICIO_NOMBRE[t] ?? t;
const tam = (svg: string, n: number): string => svg.replace(/width="\d+" height="\d+"/, `width="${n}" height="${n}"`);

/** Lo que el árbol necesita para pintarse, de la última vez que se generó su HTML (lo usan el trazado y el tooltip). */
interface Dibujo { G: Grafo; E: EstadoArbol; lay: Disposicion; e: Escapar; visibles: Set<string> }
let dibujo: Dibujo | null = null;

function piezas(G: Grafo, e: Escapar) {
  const D = G.D;
  const TN = (t: string): string => D.tec[t]?.nombre ?? t;
  const RI = (r: string, n?: number, falta = false): string => `<span class="ta-rec${falta ? ' falta' : ''}" title="${e(RN(r))}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i>${n !== undefined ? `<b>${num(n)}</b>` : ''}<span class="ta-sr">${e(RN(r))}</span></span>`;
  const EI = (tipo: string, nivel?: number | string | null, nombre?: string): string => `<span class="ta-rec ta-edi" title="${e(nombre ?? EN(tipo))}${nivel ? ` nivel ${nivel}` : ''}">${iconoEdificio(tipo, 18)}${nivel ? `<b>${nivel}</b>` : ''}<span class="ta-sr">${e(nombre ?? EN(tipo))}${nivel ? ` ${nivel}` : ''}</span></span>`;
  const costeTxt = (c: Record<string, number> | undefined, almacen?: Record<string, { cantidad: number }>): string =>
    Object.entries(c ?? {}).map(([r, n]) => RI(r, n, almacen !== undefined && (almacen[r]?.cantidad ?? 0) < n)).join(' ');
  const muestraLinea = (tipo: string, ancho = 18): string => `<svg width="${ancho}" height="8" viewBox="0 0 ${ancho} 8" aria-hidden="true"><path d="M1 4H${ancho - 1}" class="ta-arista ${tipo} muestra"/></svg>`;
  return { TN, RI, EI, costeTxt, muestraLinea };
}

/** Lo que abre una tecnología, en iconos (tropas, edificios, niveles, recetas, bonus y canon). */
function abreDe(G: Grafo, id: string, e: Escapar): string {
  const D = G.D, k = D.tec[id]!;
  const ico = (svg: string, nombre: string, nivel?: string): string => `<span class="ta-abre-ico" title="${e(nombre)}">${tam(svg, 24)}${nivel ? `<b class="nivel">${nivel}</b>` : ''}<span class="ta-sr">${e(nombre)}</span></span>`;
  const h: string[] = [];
  D.tropas.filter((t) => t.tecnologia === id).forEach((t) => h.push(ico(iconoTropa(t.id, 24), t.nombre)));
  Object.entries(D.edificios).filter(([, x]) => x.construir.tec === id).forEach(([t]) => h.push(ico(iconoEdificio(t, 24), EN(t))));
  Object.entries(D.edificios).forEach(([t, x]) => Object.entries(x.niveles).filter(([, l]) => l.tec === id).forEach(([nv]) => h.push(ico(iconoEdificio(t, 24), `${EN(t)} ${nv}`, nv))));
  Object.entries(D.recetas).filter(([, r]) => r.tec === id).forEach(([prod]) => h.push(`<span class="ta-abre-rec" title="${e(RN(prod))}"><span aria-hidden="true">${RECURSO_ICONO[prod] ?? '📦'}</span><span class="ta-sr">${e(RN(prod))}</span></span>`));
  if (k.bonusProduccion) h.push(`<span class="ta-abre-rec" title="${e(RN(k.bonusProduccion.recurso))} ×${num(k.bonusProduccion.factor)}"><span aria-hidden="true">${RECURSO_ICONO[k.bonusProduccion.recurso] ?? '📦'}</span><b>×${num(k.bonusProduccion.factor)}</b><span class="ta-sr">${e(RN(k.bonusProduccion.recurso))}</span></span>`);
  if (CANON_CORTO[id]) h.push(`<span class="ta-abre-canon">${e(CANON_CORTO[id]!)} · canon</span>`);
  return h.join('');
}

const MEDALLA: Partial<Record<EstadoCarta, string>> = { adoptada: '✓', adoptable: '!', revelada: '♪', logro: '✦' };

/** El tablero entero (cabeceras de Era, carriles y cartas) y la leyenda. Las líneas las traza `montarArbol` al medir la rejilla. */
export function htmlArbol(p: ProyeccionJugador, e: Escapar, precioAeda: (id: string) => number | null): string {
  const D = datosDelArbol(() => {});
  const E = estadoDesdeProyeccion(p);
  if (!D || !E) return `<p class="asent-lado-nota">${E ? 'Cargando el árbol de tecnologías…' : 'Sin Facción no hay árbol de tecnologías.'}</p>`;
  const G = grafoDe(D);
  const eraVisible = ultimaEraVisible(D, E.adoptadas);
  const lay = disponer(G, eraVisible);
  const { TN, RI, costeTxt, muestraLinea } = piezas(G, e);
  const visibles = new Set([...G.nodos.values()].filter((n) => n.era <= eraVisible).map((n) => n.id));
  dibujo = { G, E, lay, e, visibles };
  const eras = erasOrdenadas(D);
  const ultima = eras.at(-1)?.orden ?? 1;
  const mundo = eraOrd(D, E.eraMundo);
  const futura = (o: number): boolean => o > mundo;

  const carriles = lay.carriles.filter((c) => c.visible);
  const filas = ['auto'];
  let idx = 2;
  for (const c of carriles) { filas.push('var(--ta-canal)'); idx++; c.fila0 = idx; for (let i = 0; i < c.filas!; i++) { filas.push('auto'); idx++; } c.filaFin = idx; }
  filas.push('var(--ta-canal)');
  let h = '<svg class="ta-lineas" aria-hidden="true"></svg>';
  lay.erasVis.forEach((x, i) => { h += `<div class="ta-era-fondo${i % 2 ? ' par' : ''}${i ? ' raya' : ''}${futura(x.orden) ? ' futura' : ''}" style="grid-column:${2 + lay.baseEra[x.orden]!} / span ${lay.colsEra[x.orden]}"></div>`; });
  carriles.forEach((c, i) => { h += `<div class="ta-carril-fondo${i % 2 ? ' par' : ''}" data-carril="${c.id}" style="grid-row:${c.fila0} / ${c.filaFin}"></div>`; });
  h += '<div class="ta-esquina"><span>Carril · Era</span></div>';
  for (const x of lay.erasVis) {
    const actual = x.orden === mundo;
    const sigue = x.orden === eraVisible && x.orden < ultima;
    const llevas = adoptadasEn(D, E.adoptadas, x.orden), cupo = cupoEra(D, x.orden);
    h += `<div class="ta-era-cab" style="grid-column:${2 + lay.baseEra[x.orden]!} / span ${lay.colsEra[x.orden]}; grid-row:1">
      <span class="ta-era-num" aria-hidden="true">${ROMANO[x.orden] ?? x.orden}</span>
      <span class="ta-era-nombre">Era ${ROMANO[x.orden] ?? x.orden} · ${e(x.nombre)}</span>
      <span class="ta-era-sub">${x.minimoSemanas !== undefined ? `dura de ${x.minimoSemanas} a ${x.plazoSemanas} semanas` : `dura hasta ${x.plazoSemanas} semanas`}</span>
      <span class="ta-era-coste">Adoptar cada una: ${costeTxt(D.tarifa[x.id])}</span>
      ${sigue ? `<span class="ta-era-sigue"><span>La Era ${ROMANO[x.orden + 1]} aparece con ${cupo} de ${tecsDeEra(D, x.orden).length} adoptadas: llevas <b>${llevas}</b></span><span class="barra" style="--p:${Math.min(1, llevas / Math.max(1, cupo))}"></span></span>` : ''}
      ${actual || futura(x.orden) ? `<span class="ta-era-marca${actual ? ' actual' : ' futura'}">${actual ? 'Era del mundo' : 'Bloqueada'}</span>` : ''}</div>`;
  }
  for (const c of carriles) {
    const n = c.tecs.filter((t) => visibles.has(t)).length;
    h += `<div class="ta-carril-nombre" style="grid-row:${c.fila0} / ${c.filaFin}" title="${e(c.nombre)}">${iconoEdificio(c.icono, 30)}<strong>${e(c.nombre)}</strong><small>${n} tecnología${n > 1 ? 's' : ''}</small></div>`;
  }
  const carrilPorId = new Map(carriles.map((c) => [c.id, c]));
  for (const n of G.nodos.values()) {
    if (!visibles.has(n.id)) continue;
    const k = n.d, c = carrilPorId.get(n.carril)!, est = estadoDe(G, E, n.id);
    const cruces = n.preds.filter((x) => G.nodos.get(x.de)!.carril !== n.carril);
    let estado = '';
    if (!k.deArranque) {
      if (est === 'adoptada') estado = 'Adoptada';
      else if (est === 'adoptable') estado = `<span class="ta-btn-mini">Adoptar</span>${costeTxt(D.tarifa[k.era])}`;
      else if (est === 'revelada') { const r = E.reveladas.get(n.id)!; const pr = precioAeda(n.id); estado = `Revelada · hito ${r.cumplidas.filter(Boolean).length}/${r.cumplidas.length}${pr !== null ? ` · Aeda ${RI('oro', pr)}` : ''}`; }
      else if (est === 'logro') estado = 'Logro del mundo ✓ · falta tu hito';
      else if (est === 'futura') estado = `Bloqueada: la Era ${ROMANO[n.era]} aún no empieza`;
      else estado = 'Falta el logro del mundo';
    }
    h += `<button type="button" class="ta-carta ${est}" data-tec="${e(n.id)}" style="grid-column:${2 + n.col!}; grid-row:${c.fila0! + n.fila!}" aria-label="Tecnología ${e(k.nombre)}">
      <span class="ta-carta-cab"><span class="ta-carta-nombre">${e(k.nombre)}</span><span class="ta-medalla" aria-hidden="true">${MEDALLA[est] ?? ''}</span></span>
      <span class="ta-carta-abre">${abreDe(G, n.id, e)}</span>
      ${cruces.length ? `<span class="ta-carta-pide">${cruces.map((x) => `<span class="ta-pide">${muestraLinea(x.tipo)}Pide ${e(TN(x.de))}</span>`).join('')}</span>` : ''}
      ${k.deArranque ? '<span class="ta-arranque">De arranque</span>' : ''}
      ${estado ? `<span class="ta-carta-estado">${estado}</span>` : ''}</button>`;
  }
  const tipos = new Set([...G.nodos.values()].filter((n) => visibles.has(n.id)).flatMap((n) => n.preds.map((x) => x.tipo)));
  const hay = new Set([...visibles].map((id) => estadoDe(G, E, id)));
  const sw = (est: EstadoCarta, txt: string): string => (hay.has(est) ? `<span><span class="ta-muestra ${est}"></span>${txt}</span>` : '');
  const ley = [
    tipos.has('hito') ? `<span>${muestraLinea('hito', 26)}la pide su hito</span>` : '',
    tipos.has('implicita') ? `<span>${muestraLinea('implicita', 26)}la piden los edificios de su hito</span>` : '',
    tipos.has('logro') ? `<span>${muestraLinea('logro', 26)}la pide su logro (dependencia oculta)</span>` : '',
    sw('adoptada', 'adoptada'), sw('adoptable', 'aparecida: se puede adoptar'), sw('revelada', 'revelada por un Aeda'),
    sw('logro', 'logro del mundo cumplido'), sw('bloqueada', 'sin logro aún'), sw('futura', 'bloqueada: su Era aún no empieza'),
  ].filter(Boolean).join('');
  return `<div class="ta-mandos"><button class="ta-btn-sec" type="button" data-ta-todas aria-pressed="${todas}"><span class="caja" aria-hidden="true">${todas ? '✓' : ''}</span>Ver todas las conexiones</button>
      <span class="ta-ayuda">Pasa el ratón por una tecnología para ver su camino; haz clic para abrir su ficha. Arrastra el tablero para moverte.</span></div>
    <div class="ta-leyenda">${ley}</div>
    <div class="ta-tablero-marco"><div class="ta-tablero${todas ? ' todas' : ''}" style="grid-template-columns: var(--ta-carril) repeat(${lay.NCOL}, var(--ta-carta)); grid-template-rows: ${filas.join(' ')}">${h}</div></div>`;
}

// ── Tooltip y ficha ──────────────────────────────────────────────────────────

/** Lo que pone la ficha fija de una carta además del tooltip: las acciones (Adoptar, Comprar a un Aeda, Empezar épica) y su línea de error. */
export interface ContextoArbol {
  acciones: (id: string) => string;
  cablearAcciones: (raiz: HTMLElement) => void;
}

function hitoLi(G: Grafo, e: Escapar, c: CondicionHito): string {
  const { TN, RI, EI } = piezas(G, e);
  switch (c.tipo) {
    case 'edificio': return HITO_PUEBLO[c.edificio] ? `${EI(c.edificio, null, HITO_PUEBLO[c.edificio])} ${e(HITO_PUEBLO[c.edificio]!)}` : `${EI(c.edificio, c.nivelInterno || 1)} en alguna plaza`;
    case 'tecnologia': return `<span class="ta-tec">${e(TN(c.id))}</span> adoptada`;
    case 'recursoEnCapital': return `${RI(c.recurso)} en el almacén de la capital`;
    case 'capitalEnNivel': return `Capital a nivel ${c.nivel} con ${EI(c.conEdificio)}`;
    case 'yacimientoEnTerritorio': return `Un yacimiento de ${RI(c.recurso)} en tu territorio`;
  }
}

function tipTec(d: Dibujo, id: string, precioAeda: (id: string) => number | null): string {
  const { G, E, e, visibles } = d;
  const D = G.D, n = G.nodos.get(id)!, k = n.d, a = n.acc;
  const c = G.carriles.find((x) => x.id === n.carril)!;
  const { TN, RI, EI, costeTxt } = piezas(G, e);
  const est = estadoDe(G, E, id);
  let h = `<div class="ta-tip-cab">${iconoEdificio(c.icono, 34)}<div><h3>${e(k.nombre)}</h3><div class="ta-meta">${e(c.nombre)} · Era ${ROMANO[eraOrd(D, k.era)] ?? ''} · ${e(D.eras[k.era]?.nombre ?? k.era)}</div></div></div>`;
  // El estado en tu Facción.
  let t: string;
  if (k.deArranque) t = '<b>Adoptada</b> desde que nació la Facción.';
  else if (est === 'adoptada') t = '<b>Adoptada.</b> Todo lo que abre ya está disponible en tus plazas.';
  else if (est === 'adoptable') t = `<b>Aparecida.</b> El Rey, dentro de la capital, puede adoptarla ya por ${costeTxt(D.tarifa[k.era])}.`;
  else if (est === 'revelada') {
    const r = E.reveladas.get(id)!, pr = precioAeda(id);
    const hito = r.hito.length ? r.hito : k.hito;
    t = `<b>Revelada por un Aeda</b> (la descubrió otra Facción). El logro del mundo ya está; tu hito:<ul>${hito.map((x, i) => `<li><span class="${r.cumplidas[i] ? 'ok' : 'no'}">${r.cumplidas[i] ? '✓' : '✗'}</span> ${hitoLi(G, e, x)}</li>`).join('')}</ul>${pr !== null ? `Un Aeda itinerante detenido en tu plaza te la vende por ${RI('oro', pr)} (salta el hito, no el logro).` : ''}`;
  } else if (est === 'logro') t = '<b>El logro del mundo ya se cumplió.</b> Aparece en cuanto tu Facción cumpla el hito.';
  else if (est === 'futura') t = `<b>Bloqueada:</b> la Era ${ROMANO[n.era]} aún no ha empezado en el mundo. Ya la ves porque tu Facción tiene adoptado el 30 % de la Era anterior.`;
  else t = '<b>Aún nadie ha cumplido su logro</b> en el mundo.';
  h += `<div class="ta-estado-caja ${est}"><span class="ta-meta">En tu Facción</span><br>${t}</div>`;
  if (k.deArranque) h += '<h4>Cómo se consigue</h4><ul><li>Toda Facción la tiene adoptada desde que nace.</li></ul>';
  else {
    h += '<h4>Para que aparezca en tu Facción</h4><ul>';
    const ocultas = G.logroDe(id).filter((x) => visibles.has(x));
    if (k.logro) h += `<li>Logro del mundo: <span class="ta-n">${miles(k.logro.umbral)}</span> ${e(CONTADOR[k.logro.contador] ?? k.logro.contador)}, entre todas las Facciones${ocultas.length ? `<div class="ta-nota">Antes alguien del mundo necesita ${ocultas.map((x) => `<span class="ta-tec">${e(TN(x))}</span>`).join(', ')}: lo que cuenta este logro lo pide.</div>` : ''}</li>`;
    h += `<li>Y además, en tu Facción:<ul>${k.hito.map((x) => `<li>${hitoLi(G, e, x)}</li>`).join('') || '<li>nada más</li>'}</ul></li>`;
    h += '<li>O sin esperar: comprarla a un Aeda itinerante, o que un Aeda residente cante su épica (no antes de que empiece su Era)</li></ul>';
    const otras = [...a.tecs.keys()].filter((x) => visibles.has(x) && !k.hito.some((q) => q.tipo === 'tecnologia' && q.id === x) && [...a.tecs.get(x)!].some((m) => m !== 'logro'));
    const eds = [...a.eds.entries()].filter(([x]) => !k.hito.some((q) => q.tipo === 'edificio' && q.edificio === x));
    if (otras.length || eds.length || a.plaza > 1) h += `<div class="ta-nota">Esos edificios piden${a.plaza > 1 ? ` plaza a nivel ${a.plaza}` : ''}${eds.map(([x, nv]) => `, ${e(EN(x))} ${nv}`).join('')}${otras.length ? `, y ${otras.map((x) => e(TN(x))).join(', ')}` : ''}.</div>`;
    h += `<h4>Adoptarla</h4><ul><li>El Rey, dentro de la capital, paga ${costeTxt(D.tarifa[k.era])} de su almacén</li></ul>`;
  }
  const tropaChip = (x: TropaReclutable): string => `<span class="ta-rec ta-edi" title="${e(x.nombre)}">${iconoTropa(x.id, 18)}<span class="ta-sr">${e(x.nombre)}</span></span>`;
  const tropas = D.tropas.filter((x) => x.tecnologia === id);
  const pide = D.tropas.filter((x) => x.tecnologia !== id && G.accTropa.get(x.id)?.tecs.has(id) && [...G.accTropa.get(x.id)!.tecs.keys()].every((q) => !G.nodos.has(q) || visibles.has(q)));
  const recetas = Object.entries(D.recetas).filter(([, r]) => r.tec === id).map(([prod]) => RI(prod));
  const eds = Object.entries(D.edificios).filter(([, x]) => x.construir.tec === id).map(([x]) => EI(x));
  const nivs = Object.entries(D.edificios).flatMap(([x, ed]) => Object.entries(ed.niveles).filter(([, l]) => l.tec === id).map(([nv]) => EI(x, nv)));
  const lst: string[] = [];
  if (tropas.length) lst.push(`<li>Recluta: ${tropas.map(tropaChip).join(' ')}</li>`);
  if (recetas.length) lst.push(`<li>Fabrica: ${recetas.join(' ')}</li>`);
  if (eds.length) lst.push(`<li>Construye: ${eds.join(' ')}</li>`);
  if (nivs.length) lst.push(`<li>Mejora: ${nivs.join(' ')}</li>`);
  if (k.bonusProduccion) lst.push(`<li>×${num(k.bonusProduccion.factor)} ${RI(k.bonusProduccion.recurso)}</li>`);
  if (id === 'instituciones_civicas') lst.push(`<li>Con la ${EI('salaConsejo')}: el nivel 4 de plaza (la pide) y +1 política del Gobernador</li>`);
  const canon: Record<string, string> = {
    disciplina_formacion: 'Formaciones cerradas: táctica de batalla (romper formación penaliza; los lanceros en formación tienen bono anti-carga)',
    carpinteria_militar: `Escalas y defensas de campaña: equipo de la ${EI('carpinteria', 2)}, sin efecto en el combate con números`,
    trabajos_asedio: `Equipo de asedio de la ${EI('carpinteria', 2)}, sin efecto en el combate con números`,
  };
  if (canon[id]) lst.push(`<li><span class="ta-etq">canon, sin efecto aún</span>${canon[id]}</li>`);
  if (pide.length) lst.push(`<li>Hace falta para: ${pide.map(tropaChip).join(' ')}</li>`);
  const hijos = n.hijos.filter((x) => visibles.has(x));
  if (hijos.length) lst.push(`<li>Lleva a: ${hijos.map((x) => `<span class="ta-tec">${e(TN(x))}</span>`).join(', ')}</li>`);
  if (lst.length) h += `<h4>Abre</h4><ul>${lst.join('')}</ul>`;
  return h;
}

// ── Montaje: líneas, resaltado, tooltip, ficha y arrastre ───────────────────

/** Lo que sobrevive a un repintado del panel (que llega con cada cambio de la proyección). */
let todas = false;
let fijado: string | null = null;
let scrollGuardado = 0;
let ctxActual: ContextoArbol | null = null;
let precioActual: (id: string) => number | null = () => null;
let tip: HTMLElement | null = null;
let vigia: ReturnType<typeof setInterval> | undefined;
let tableroActual: HTMLElement | null = null;
let svgActual: SVGSVGElement | null = null;
let resaltado: string | null = null;
let globalesPuestos = false;

const ANCLA = 17;

function trazar(tablero: HTMLElement, svg: SVGSVGElement): void {
  const d = dibujo;
  if (!d || !tablero.isConnected) return;
  const { G, lay } = d;
  const cartas = new Map(Array.from(tablero.querySelectorAll<HTMLElement>('.ta-carta')).map((el) => [el.dataset.tec!, el]));
  const cs = getComputedStyle(tablero);
  const pistas = cs.gridTemplateColumns.split(' ').map(parseFloat);
  const hueco = parseFloat(cs.columnGap) || 0;
  const xPista = (i: number): number => pistas.slice(0, i).reduce((s, w) => s + w + hueco, 0);
  const xHueco = (col: number): number => xPista(col + 1) + (pistas[col + 1] ?? 0) + hueco / 2;
  const canales = new Map<number, Map<string, number>>();
  const canal = (col: number, clave: string): number => {
    if (!canales.has(col)) canales.set(col, new Map());
    const m = canales.get(col)!;
    if (!m.has(clave)) m.set(clave, m.size);
    const k = m.get(clave)!;
    return xHueco(col) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 7;
  };
  const alto = parseFloat(cs.getPropertyValue('--ta-canal')) || 20;
  const bandas = Object.fromEntries(Array.from(tablero.querySelectorAll<HTMLElement>('.ta-carril-fondo')).map((el) => [el.dataset.carril!, { y: el.offsetTop, h: el.offsetHeight }]));
  const usoCanal = new Map<string, number>();
  const yCanal = (carril: string, arriba: boolean): number => {
    const b = bandas[carril]!;
    const base = arriba ? b.y - alto / 2 - 1 : b.y + b.h + alto / 2 + 1;
    const clave = carril + (arriba ? '↑' : '↓');
    const k = usoCanal.get(clave) ?? 0;
    usoCanal.set(clave, k + 1);
    return base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 5;
  };
  const libreEnFila = (carril: string, fila: number, c0: number, c1: number): boolean => { for (let k = c0; k <= c1; k++) if (lay.ocupa[carril]?.[fila]?.has(k)) return false; return true; };
  const caja = (id: string): { x: number; y: number; w: number } => { const el = cartas.get(id)!; return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth }; };
  const orden = G.carriles.map((c) => c.id);
  let s = `<defs><marker id="ta-punta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1.5 1L7 4L1.5 7" fill="none" style="stroke:var(--bronce)" stroke-width="1.6"/></marker>
    <marker id="ta-punta-luz" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1.5 1L7 4L1.5 7" fill="none" style="stroke:var(--oro-claro)" stroke-width="1.6"/></marker></defs>`;
  for (const n of G.nodos.values()) {
    if (!cartas.has(n.id)) continue;
    for (const p of n.preds) {
      if (!cartas.has(p.de)) continue;
      const a = G.nodos.get(p.de)!, A = caja(a.id), B = caja(n.id);
      const x1 = A.x + A.w, y1 = A.y + ANCLA, x2 = B.x - 1, y2 = B.y + ANCLA;
      const xa = canal(a.col!, 'S' + a.id);
      const mismo = a.carril === n.carril;
      let dd: string;
      if (mismo && a.fila === n.fila) dd = `M${x1} ${y1}H${x2}`;
      else if (n.col === a.col! + 1) dd = `M${x1} ${y1}H${xa}V${y2}H${x2}`;
      else if (mismo && libreEnFila(n.carril, n.fila!, a.col! + 1, n.col! - 1)) dd = `M${x1} ${y1}H${xa}V${y2}H${x2}`;
      else if (mismo) dd = `M${x1} ${y1}H${canal(n.col! - 1, 'T' + n.id)}V${y2}H${x2}`;
      else {
        const yg = yCanal(n.carril, orden.indexOf(n.carril) > orden.indexOf(a.carril));
        dd = `M${x1} ${y1}H${xa}V${yg}H${canal(n.col! - 1, 'T' + n.id)}V${y2}H${x2}`;
      }
      s += `<path class="ta-arista ${p.tipo}${mismo ? '' : ' cruce'}" data-de="${a.id}" data-a="${n.id}" d="${dd}"/>`;
    }
  }
  svg.setAttribute('width', String(tablero.scrollWidth));
  svg.setAttribute('height', String(tablero.scrollHeight));
  svg.innerHTML = s;
  if (resaltado) resaltar(resaltado);
}

function resaltar(id: string | null): void {
  resaltado = id;
  const tablero = tableroActual, d = dibujo;
  if (!tablero || !d) return;
  tablero.classList.toggle('activo', Boolean(id));
  tablero.querySelectorAll('.luz,.baja,.foco').forEach((x) => x.classList.remove('luz', 'baja', 'foco'));
  if (!id || !d.G.nodos.has(id)) return;
  const arriba = new Set<string>(), abajo = new Set<string>();
  const sube = (i: string): void => d.G.nodos.get(i)!.preds.forEach((p) => { if (!arriba.has(p.de)) { arriba.add(p.de); sube(p.de); } });
  const baja = (i: string): void => d.G.nodos.get(i)!.hijos.forEach((h) => { if (!abajo.has(h)) { abajo.add(h); baja(h); } });
  sube(id); arriba.add(id); baja(id);
  tablero.querySelectorAll<HTMLElement>('.ta-carta').forEach((el) => {
    const i = el.dataset.tec!;
    if (arriba.has(i)) el.classList.add('luz'); else if (abajo.has(i)) el.classList.add('baja');
    if (i === id) el.classList.add('foco');
  });
  svgActual?.querySelectorAll<SVGPathElement>('.ta-arista').forEach((x) => {
    const de = x.dataset.de!, a = x.dataset.a!;
    if (arriba.has(de) && arriba.has(a)) x.classList.add('luz');
    else if (abajo.has(a) && (abajo.has(de) || de === id)) x.classList.add('baja');
  });
}

function elTip(): HTMLElement {
  if (tip?.isConnected) return tip;
  tip = document.createElement('div');
  tip.className = 'ta-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'dialog');
  document.body.appendChild(tip);
  return tip;
}

function ocultarTip(): void {
  if (tip) { tip.hidden = true; tip.classList.remove('fijo'); }
  if (vigia) { clearInterval(vigia); vigia = undefined; }
}

function mostrar(id: string, ev?: MouseEvent | FocusEvent | null): void {
  const d = dibujo;
  if (!d) return;
  const t = elTip();
  const fijo = fijado === id;
  t.innerHTML = tipTec(d, id, precioActual) + (fijo && ctxActual ? `<div class="ta-ficha-acciones">${ctxActual.acciones(id)}<p class="faction-error" data-campo="error-ficha-tecnologia" role="alert"></p></div>` : '');
  t.classList.toggle('fijo', fijo);
  t.hidden = false;
  if (fijo && ctxActual) ctxActual.cablearAcciones(t);
  colocar(ev ?? null, id);
  // Si el árbol desaparece (otra pestaña, ventana cerrada) el tooltip, que vive en <body>, se va con él.
  if (!vigia) vigia = setInterval(() => { if (!tableroActual?.isConnected) { fijado = null; ocultarTip(); } }, 400);
}

function colocar(ev: MouseEvent | FocusEvent | null, id: string): void {
  const t = tip;
  if (!t || t.hidden) return;
  const r = t.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  let x: number, y: number;
  if (ev && 'clientX' in ev && ev.type.startsWith('mouse')) {
    x = ev.clientX + 16; y = ev.clientY + 16;
    if (x + r.width > vw - 8) x = Math.max(8, ev.clientX - r.width - 16);
  } else {
    const b = tableroActual?.querySelector<HTMLElement>(`.ta-carta[data-tec="${CSS.escape(id)}"]`)?.getBoundingClientRect();
    if (!b) return;
    x = b.right + 8; y = b.top;
    if (x + r.width > vw - 8) x = Math.max(8, b.left - r.width - 8);
  }
  if (x + r.width > vw - 8) x = 8;
  if (y + r.height > vh - 8) y = Math.max(8, vh - r.height - 8);
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}

function cerrarFicha(): void { fijado = null; resaltar(null); ocultarTip(); }

/** Cablea el árbol recién pintado: traza las líneas (y las rehace al cambiar de tamaño), el resaltado, el tooltip, la ficha fija y el arrastre. */
export function montarArbol(raiz: HTMLElement, ctx: ContextoArbol, precioAeda: (id: string) => number | null): void {
  const tablero = raiz.querySelector<HTMLElement>('.ta-tablero');
  const svg = raiz.querySelector<SVGSVGElement>('.ta-lineas');
  ctxActual = ctx;
  precioActual = precioAeda;
  if (!tablero || !svg) { tableroActual = null; return; }
  tableroActual = tablero;
  svgActual = svg;
  resaltado = null;
  let pendiente = 0;
  const retrazar = (): void => { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(() => trazar(tablero, svg)); };
  const ro = new ResizeObserver(retrazar);
  ro.observe(tablero);
  tablero.querySelectorAll('.ta-carta').forEach((el) => ro.observe(el));
  void document.fonts?.ready.then(retrazar);
  retrazar();
  tablero.scrollLeft = scrollGuardado;
  tablero.addEventListener('scroll', () => { scrollGuardado = tablero.scrollLeft; if (!fijado) ocultarTip(); else colocar(null, fijado); });

  raiz.querySelector<HTMLButtonElement>('[data-ta-todas]')?.addEventListener('click', (ev) => {
    todas = !todas;
    const b = ev.currentTarget as HTMLButtonElement;
    b.setAttribute('aria-pressed', String(todas));
    b.querySelector('.caja')!.textContent = todas ? '✓' : '';
    tablero.classList.toggle('todas', todas);
  });

  tablero.querySelectorAll<HTMLButtonElement>('.ta-carta').forEach((el) => {
    const id = el.dataset.tec!;
    el.addEventListener('mouseenter', (ev) => { if (fijado) return; resaltar(id); mostrar(id, ev); });
    el.addEventListener('mousemove', (ev) => { if (!fijado) colocar(ev, id); });
    el.addEventListener('mouseleave', () => { if (fijado) return; resaltar(null); ocultarTip(); });
    el.addEventListener('focus', (ev) => { if (fijado) return; resaltar(id); mostrar(id, ev); });
    el.addEventListener('blur', () => { if (fijado) return; resaltar(null); ocultarTip(); });
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (fijado === id) { cerrarFicha(); return; }
      fijado = id;
      resaltar(id);
      mostrar(id, ev);
    });
  });

  // Arrastrar el tablero con el ratón, como el mapa de un juego.
  let arrastre: { x: number; s: number } | null = null;
  tablero.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || (ev.target as HTMLElement).closest('.ta-carta')) return;
    arrastre = { x: ev.clientX, s: tablero.scrollLeft };
    tablero.classList.add('arrastrando');
  });
  tablero.addEventListener('pointermove', (ev) => { if (arrastre) tablero.scrollLeft = arrastre.s - (ev.clientX - arrastre.x); });
  const soltar = (): void => { arrastre = null; tablero.classList.remove('arrastrando'); };
  tablero.addEventListener('pointerup', soltar);
  tablero.addEventListener('pointerleave', soltar);

  if (!globalesPuestos) {
    globalesPuestos = true;
    document.addEventListener('click', (ev) => { if (fijado && tip && !tip.contains(ev.target as Node)) cerrarFicha(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && fijado) cerrarFicha(); });
    addEventListener('scroll', () => { if (fijado) colocar(null, fijado); }, { passive: true, capture: true });
  }

  // Tras un repintado (llega un cambio de la proyección), la ficha que estaba abierta sigue abierta, con sus datos nuevos.
  if (fijado) {
    if (tablero.querySelector(`.ta-carta[data-tec="${CSS.escape(fijado)}"]`)) { const f = fijado; requestAnimationFrame(() => { if (fijado === f) { resaltar(f); mostrar(f, null); } }); }
    else cerrarFicha();
  } else ocultarTip();
}
