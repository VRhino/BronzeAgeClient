// Lo que pinta el mundo 3D, sacado de la proyección del jugador: las columnas y caravanas, lo que hay en el mundo (con el lado de la niebla de
// cada capa, como en `render.ts`), las Miradas, los nombres, lo seleccionado y la vista previa de fundar. La vista no lee la proyección
// directamente: así se prueba sola (y el banco de pruebas de `pruebas/mundo3d/` le da un estado de mentira).
import type { ProyeccionJugador } from '../apiCliente';
import type { SitiosDeAldea } from '../mundo/fertilidad';
import { faccionColor } from '../paletas';
import { svgSigilo } from '../sigilo/sigilo';
import type { NieblaProyectada } from '../tiposDominio';
import { MUNDO3D } from './config';
import type { TropaDeColumna } from './figuras';
import { circulo, sentidoDe, suavizarCamino } from './lineas';
import { partirFronteras, type ZonaDeFaccion } from '../mundo/fronteras';

type Punto = { x: number; y: number };

/** Lo que tira de un carro de caravana (`Caravana.carros[].animal`). */
export type AnimalDeTiro = 'buey' | 'caballo' | 'camello';

/** Lo que una columna arrastra detrás de la tropa. */
export interface Carros {
  /** Carros de carga (las caravanas enganchadas). */
  carga: number;
  /** Lleva la Caravana de Fundación (el último carro, con lona). */
  fundacion: boolean;
  /** El carrito del héroe (Víctor, 2026-11-02): la columna lleva algo en su carro (`suministro`). Pequeño y sin animal, justo detrás de la
   * tropa; solo se sabe de las de la Facción. */
  propio?: true;
  /** Lo que tira de cada carro de caravana, en orden (los de carga y al final el de fundación); sin él, un buey. */
  animales?: AnimalDeTiro[];
}

export interface ColumnaEnVista {
  id: string;
  /** La del jugador: la cámara la sigue y lleva la mira y el destino. */
  mia: boolean;
  /** De su Facción (o la suya): enseña su ruta. De las avistadas no viaja la ruta, ni la tropa: se pintan sus héroes. */
  propia: boolean;
  posicion: Punto;
  /** Lo que queda por andar (vacío si está quieta o es ajena). */
  ruta: Punto[];
  /** Héroes a caballo al frente. */
  jinetes: number;
  /** La tropa detrás: escuadras por héroe y si es un ejército (cambia la formación, `bloquesDeTropa`). */
  tropa: TropaDeColumna;
  /** El de su Facción: túnicas y penachos. */
  color: string;
  carros: Carros;
  /** Quieta, esperando a ser tres para ser un ejército (Doc 5.14.4): lleva un anillo discontinuo. */
  formacion: boolean;
}

/** Una caravana suelta en el mapa (las enganchadas van detrás de su columna): la propia con su ruta, la avistada sin ella. */
export interface CaravanaEnVista { id: string; posicion: Punto; ruta: Punto[]; fundacion: boolean; color: string;
  /** Las escuadras de su escolta, que marchan delante del carro: las cedidas de la propia (`escoltaIds`); de la avistada solo se sabe si va
   * escoltada (`escoltada`), y se pinta una. */
  escolta?: number;
  /** Lo que tira de cada uno de sus carros (`carros[].animal`, solo en las comerciales propias): un carro por animal. Sin él, un carro con buey. */
  animales?: AnimalDeTiro[] }
/** Una Mirada de taberna (Doc 5.12.10): abierta, su círculo; caducada, un anillo discontinuo mientras la zona sigue vedada. */
export interface MiradaEnVista { id: string; centro: Punto; radio: number; abierta: boolean; minutos: number }
/** La vista previa de fundar alrededor de la columna: la zona con que nacería, dónde cabría una aldea y las parcelas de bosque. */
export interface FundacionEnVista {
  centro: Punto;
  radio: number;
  sitios: SitiosDeAldea | null;
  parcelas: { centro: Punto; estado: 'libre' | 'ocupada' | 'ajena' }[];
}
/** Lo seleccionado en el mapa: un aro alrededor. */
export interface SeleccionEnVista { posicion: Punto; radio: number }
/** Un nombre sobre el mundo (HTML encima del lienzo). `tenue` = lo que solo se recuerda. */
/** Un nombre sobre el mundo. El texto va siempre en blanco; `color` (el de la Facción o el del campamento) es el filete de la izquierda. Una plaza
 * lleva además el escudo de su Facción (`sigilo`, SVG en línea) y debajo del nombre `subtexto` («Nivel n»). */
export interface EtiquetaEnVista { id: string; posicion: Punto; texto: string; tipo: 'plaza' | 'mirada' | 'territorio' | 'nodo' | 'campamento'; color?: string; tenue?: boolean; subtexto?: string; sigilo?: string }

/** Una plaza: la ciudad del juego ocupa el 10 % del radio de su zona. `recordada` = se vio alguna vez y ahora no (va bajo la niebla). */
export interface PlazaEnVista { id: string; posicion: Punto; radioCiudad: number; color: string; recordada: boolean; nivel: number }
/** Un pueblo: extractor sobre su nodo o aldea agrícola. */
export interface PuebloEnVista { id: string; posicion: Punto; aldea: boolean; color: string }
/** Una avanzada: 1 atalaya, 2 fuerte, 3 ciudadela. */
export interface AvanzadaEnVista { id: string; posicion: Punto; etapa: number; ruinas: boolean; color: string }
/** Una obra de mapa a la espera de materiales o ya en marcha (`arrancada`). */
export interface ObraEnVista { id: string; posicion: Punto; arrancada: boolean; color: string }
/** Un campamento de mercenarios con su anillo de protección. */
export interface CampamentoEnVista { id: string; posicion: Punto; radioProteccion: number }
/** Una raya sobre el terreno: camino, frontera o zona. `bajoNiebla` = la oscurece la niebla, como en el 2D; si no, va encima. */
export interface TrazoEnVista { puntos: Punto[]; ancho: number; color: string; bajoNiebla: boolean; discontinuo?: boolean; tipo: 'camino' | 'frontera' | 'zona' | 'anillo'; recordada?: boolean;
  /** De un camino: 0 sendero, 1 camino, 2 calzada (su textura). */
  escalon?: 0 | 1 | 2;
  /** De un contorno: 1 o -1 según su sentido, para correr la raya hacia dentro y que, donde chocan dos zonas, se vean las dos. */
  haciaDentro?: 1 | -1;
  /** La línea entre dos provincias de la misma Facción: fina y medio transparente. */
  tenue?: boolean }

/** Lo que hay en el mundo además del suelo y las columnas: se rehace solo cuando cambia. */
export interface MundoEnVista {
  plazas: PlazaEnVista[];
  pueblos: PuebloEnVista[];
  avanzadas: AvanzadaEnVista[];
  obras: ObraEnVista[];
  campamentos: CampamentoEnVista[];
  /** Campamentos de bandidos: solo los que se ven ahora (no tienen memoria). */
  bandidos: { id: string; posicion: Punto; nivel: number }[];
  alijos: { id: string; posicion: Punto }[];
  /** Batallas de Unity: donde se libran; `propia` = combates en ella. */
  batallas: { id: string; posicion: Punto; propia: boolean }[];
  trazos: TrazoEnVista[];
}

export const mundoVacio = (): MundoEnVista => ({ plazas: [], pueblos: [], avanzadas: [], obras: [], campamentos: [], bandidos: [], alijos: [], batallas: [], trazos: [] });

export interface EstadoVista {
  /** Donde mira la cámara: la cabeza de la columna del jugador o, si no va en una, el sitio donde está. */
  heroe: Punto | null;
  /** Radio de visión de la columna del jugador (`VISION` del servidor): decide cuánto cabe en pantalla. */
  radioVision: number;
  columnas: ColumnaEnVista[];
  caravanas: CaravanaEnVista[];
  niebla: NieblaProyectada | null;
  mundo: MundoEnVista;
  miradas: MiradaEnVista[];
  etiquetas: EtiquetaEnVista[];
  seleccion: SeleccionEnVista | null;
  fundacion: FundacionEnVista | null;
}

/** Los radios de visión del servidor (`Movimiento_Ejercitos.VISION`): el héroe solo y la columna con soldados. */
export interface RadiosDeVision { solo: number; ejercito: number }

/** Las cifras del servidor que hacen falta para pintar: la visión, el radio con que nace una zona (`reglas.territorio.radio_inicial`) y el
 * anillo de protección de los campamentos de mercenarios (`MERCENARIOS.radioProteccion`). */
export interface ReglasDeVista { vision: RadiosDeVision; radioZonaInicial: number; radioProteccion: number }

/** La ciudad del juego, respecto al radio de su zona (`Economia_Construccion`). */
const FRACCION_CIUDAD = 0.1;
/** Anchura de las rayas, en u: caminos por escalón (sendero, camino, calzada), fronteras, la zona propia y el anillo de los mercenarios. Más
 * gruesas que en la realidad para que se lean desde la cámara de juego. De un camino es la cinta entera: lo que se ve es algo menos, que sus
 * bordes se funden con el suelo (`caminos.ts`). */
export const ANCHOS = { caminos: [0.4, 0.65, 0.9], frontera: 0.24, zona: 0.36, provincia: 0.08, anillo: 0.1 } as const;
const COLOR_AJENO = '#9a927f', COLOR_CAMINO = '#8b5a2b', COLOR_ANILLO = '#2e5e8c';
/** La tropa de quien aún no tiene Facción. */
const COLOR_SIN_FACCION = '#c0392b';

/** Héroes a caballo que se pintan, como mucho; y carros de una caravana suelta y escuadras de su escolta. */
const MAX_JINETES = 4, MAX_CARROS_CARAVANA = 3, MAX_ESCOLTA = 3;

/** Lo que tira de los carros de una caravana: uno por carro (el que no lleva animal, un buey), como mucho `max`. */
function animalesDe(c: { carros?: { animal?: AnimalDeTiro }[] } | undefined, max: number): AnimalDeTiro[] {
  return (c?.carros ?? []).slice(0, max).map((x) => x.animal ?? 'buey');
}
/** Los animales solo si alguno no es un buey (sin ellos, todos lo son). */
const conAnimales = (animales: AnimalDeTiro[]): { animales?: AnimalDeTiro[] } => (animales.some((a) => a !== 'buey') ? { animales } : {});

/** Lo que la vista pinta y no sale de la proyección: lo seleccionado en el panel y la vista previa de fundar. */
export interface ExtraDeVista {
  seleccion?: { tipo: string; id: string } | null;
  fundacion?: FundacionEnVista | null;
}

/** El estado de la vista para la proyección `p` (la del instante, con las columnas ya movidas). `dondeEsta` es el sitio del héroe cuando no va
 * en una columna en el mapa (dentro de una plaza o de un campamento). */
export function estadoDesdeProyeccion(p: ProyeccionJugador, reglas: ReglasDeVista, dondeEsta: Punto | null, extra: ExtraDeVista = {}): EstadoVista {
  const radios = reglas.vision;
  const color = (faccionId: string | null | undefined) => (faccionId ? faccionColor(faccionId, p.facciones) : COLOR_SIN_FACCION);
  // la columna en la que marcha el héroe (como `miColumna` de `ui/ejercitos.ts`, sin traerse la interfaz)
  const mia = p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
  // escuadras de cada héroe: las mías por mis escuadrones, las de los demás por su ficha pública (`escuadrasQueLleva`)
  const escuadrasDe = (heroeId: string) => p.heroesVisibles?.find((h) => h.heroeId === heroeId)?.escuadrasQueLleva.length ?? 0;
  const misEscuadrones = new Set((p.heroe?.escuadrones ?? []).map((x) => x.id));
  const tropaPropia = (e: (typeof p.ejercitos)[number]): TropaDeColumna => {
    const porHeroe = e.participantes.map((x) => (x.heroeId === p.heroeId ? e.escuadronIds.filter((id) => misEscuadrones.has(id)).length : escuadrasDe(x.heroeId)));
    // lo que no se sabe de quién es (sin ficha a la vista) va con el último héroe: el total es el de la columna
    const faltan = e.escuadronIds.length - porHeroe.reduce((s, n) => s + n, 0);
    if (faltan > 0) { if (porHeroe.length === 0) porHeroe.push(0); porHeroe[porHeroe.length - 1]! += faltan; }
    return { porHeroe, ejercito: e.tipo === 'ejercito' };
  };
  const enElMapa = mia && !mia.dentroDe ? mia : undefined;
  const columnas: ColumnaEnVista[] = [];
  // las de la Facción, con su ruta y lo que arrastran; una columna que entró en un lugar no está en el mapa
  for (const e of p.ejercitos) {
    if (e.dentroDe) continue;
    const lleva = new Set(e.caravanasAdjuntasIds ?? []);
    const deFundacion = (c: { id: string; tipo?: string; estado?: string; titularId?: string }) =>
      c.tipo === 'construccion' && (lleva.has(c.id) || (c.estado === 'adjunta' && !!c.titularId && e.participantes.some((x) => x.heroeId === c.titularId)));
    const fundacion = !!e.caravanaFundacionId || (p.caravanas ?? []).some(deFundacion);
    // un carro por caravana enganchada (como mucho dos), con el animal de su primer carro que lo lleve
    const deCarga = (p.caravanas ?? []).filter((c) => lleva.has(c.id) && c.tipo !== 'construccion').slice(0, 2);
    const animales = [...deCarga.map((c) => c.carros?.find((x) => x.animal)?.animal ?? 'buey'), ...(fundacion ? ['buey' as const] : [])];
    const lleno = Object.values(e.suministro ?? {}).some((n) => n > 0);
    columnas.push({
      id: e.id,
      mia: e === mia,
      propia: true,
      posicion: e.posicionActual,
      ruta: e.estado !== 'estacionado' ? e.ruta ?? [] : [],
      jinetes: Math.max(1, Math.min(MAX_JINETES, e.participantes.length)),
      tropa: tropaPropia(e),
      color: color(e.faccionId ?? p.faccionId),
      carros: { carga: deCarga.length, fundacion, ...(lleno ? { propio: true as const } : {}), ...conAnimales(animales) },
      formacion: !!e.formacion,
    });
  }
  // las ajenas que se ven ahora: sin ruta (sería leerles el plan); su tropa son las escuadras que lleva cada héroe público que va en ella
  // (`escuadrasQueLleva`) y detrás, las caravanas que arrastra
  for (const a of p.ejercitosAvistados ?? []) {
    columnas.push({
      id: a.id, mia: false, propia: false, posicion: a.posicionActual, ruta: [], jinetes: Math.max(1, Math.min(MAX_JINETES, a.participantes)),
      tropa: { porHeroe: a.heroeIds.map(escuadrasDe), ejercito: a.tipo === 'ejercito' },
      color: color(a.faccionId), carros: { carga: Math.min(2, a.caravanasAdjuntasIds.length), fundacion: !!a.caravanaFundacionId }, formacion: !!a.enFormacion,
    });
  }
  // las caravanas sueltas: las enganchadas (propias o ajenas) van con su columna y la de fundación que espera dentro de su plaza no está en el mapa
  const adjuntas = new Set([...p.ejercitos, ...(p.ejercitosAvistados ?? [])].flatMap((e) => [...(e.caravanasAdjuntasIds ?? []), ...(e.caravanaFundacionId ? [e.caravanaFundacionId] : [])]));
  const caravanas: CaravanaEnVista[] = (p.caravanas ?? [])
    .filter((c) => !adjuntas.has(c.id) && c.estado !== 'adjunta' && !(c.tipo === 'construccion' && c.estado === 'disponible'))
    .map((c) => {
      const fundacion = c.tipo === 'construccion', escolta = Math.min(MAX_ESCOLTA, c.escoltaIds?.length ?? 0);
      const animales = fundacion ? [] : animalesDe(c, MAX_CARROS_CARAVANA);
      return {
        id: c.id, posicion: c.posicionActual, ruta: (c.ruta?.length ?? 0) >= 2 ? c.ruta! : [], fundacion,
        color: color(p.asentamientos.find((a) => a.id === c.origenAsentamientoId)?.faccionId ?? p.faccionId),
        ...(escolta ? { escolta } : {}), ...(animales.length ? { animales } : {}),
      };
    });
  for (const c of (p.caravanasAvistadas ?? []).filter((x) => !adjuntas.has(x.id)))
    caravanas.push({ id: c.id, posicion: c.posicionActual, ruta: [], fundacion: false, color: c.faccionId ? color(c.faccionId) : COLOR_AJENO, ...(c.escoltada ? { escolta: 1 } : {}) });
  const miradas = (p.miradasIntel ?? []).map((m) => {
    const abierta = m.expiraEn > p.instante;
    return { id: m.id, centro: m.centro, radio: m.radio, abierta, minutos: Math.max(0, Math.ceil(((abierta ? m.expiraEn : m.libreEn) - p.instante) / 60_000)) };
  });
  const mundo = mundoDesdeProyeccion(p, reglas);
  return {
    heroe: enElMapa?.posicionActual ?? dondeEsta,
    radioVision: mia && mia.escuadronIds.length > 0 ? radios.ejercito : radios.solo,
    columnas,
    caravanas,
    niebla: p.exploracion ?? null,
    mundo,
    miradas,
    etiquetas: etiquetasDesdeProyeccion(p, columnas, miradas),
    seleccion: dondeEstaLaSeleccion(p, extra.seleccion ?? null, mundo),
    fundacion: extra.fundacion ?? null,
  };
}

/** Los nombres sobre el mundo: el de cada plaza (tenue el de la que solo se recuerda), los minutos de cada Mirada y, bajo una columna propia que
 * pisa tierra ajena, de quién es (lo dice el servidor, `territorioPorEjercito`). */
export function etiquetasDesdeProyeccion(p: ProyeccionJugador, columnas: readonly ColumnaEnVista[], miradas: readonly MiradaEnVista[]): EtiquetaEnVista[] {
  const out: EtiquetaEnVista[] = [];
  const color = (f: string) => faccionColor(f, p.facciones);
  // el escudo completo de la Facción dueña, de su ficha o, si no es de las que llegan enteras, del directorio
  const escudos = new Map<string, string>();
  const escudo = (f: string): string => {
    let svg = escudos.get(f);
    if (svg === undefined) {
      svg = svgSigilo((p.facciones.find((x) => x.id === f) ?? p.directorioFacciones?.find((x) => x.id === f))?.sigilo, 40);
      escudos.set(f, svg);
    }
    return svg;
  };
  for (const a of p.asentamientosAvistados ?? []) out.push({ id: `plaza:${a.id}`, posicion: a.posicion, texto: a.nombre || a.id, tipo: 'plaza', color: color(a.faccionId), subtexto: `Nivel ${a.nivel}`, sigilo: escudo(a.faccionId) });
  for (const c of p.asentamientosConocidos ?? []) out.push({ id: `plaza:${c.asentamientoId}`, posicion: c.posicion, texto: c.nombre || c.asentamientoId, tipo: 'plaza', color: color(c.faccionId), tenue: true, subtexto: `Nivel ${c.nivel}`, sigilo: escudo(c.faccionId) });
  // Los campamentos con su cartel, como las plazas: los de mercenarios (siempre a la vista) y los de bandidos que se ven ahora.
  for (const c of p.campamentosMercenarios ?? []) out.push({ id: `mercenarios:${c.id}`, posicion: c.posicion, texto: '⛺ Mercenarios', tipo: 'campamento', color: '#9cc3ea' });
  for (const c of p.campamentosBandidos ?? []) out.push({ id: `bandidos:${c.id}`, posicion: c.posicion, texto: `☠ Bandidos · nivel ${c.nivel}`, tipo: 'campamento', color: '#e8826f' });
  for (const m of miradas) out.push({ id: `mirada:${m.id}`, posicion: m.centro, texto: `${m.abierta ? '👁' : '⏳'} ${m.minutos} min`, tipo: 'mirada', tenue: !m.abierta });
  for (const c of columnas) {
    const duena = c.propia ? p.territorioPorEjercito?.[c.id] : undefined;
    if (duena === undefined || duena === p.faccionId) continue;
    out.push({ id: `territorio:${c.id}`, posicion: c.posicion, texto: `⚑ ${p.facciones.find((f) => f.id === duena)?.nombre ?? duena}`, tipo: 'territorio', color: color(duena) });
  }
  return out;
}

/** Dónde está lo seleccionado en el panel (`seleccionMapa` de `main.ts`) y de qué tamaño es su aro. `null` si no está en el mapa. */
export function dondeEstaLaSeleccion(p: ProyeccionJugador, sel: { tipo: string; id: string } | null, mundo: MundoEnVista): SeleccionEnVista | null {
  if (!sel) return null;
  const en = (posicion: Punto | undefined, radio: number): SeleccionEnVista | null => (posicion ? { posicion, radio } : null);
  const M = MUNDO3D.maqueta;
  switch (sel.tipo) {
    case 'asentamiento': {
      const plaza = mundo.plazas.find((x) => x.id === sel.id);
      return plaza ? { posicion: plaza.posicion, radio: plaza.radioCiudad * M + 0.5 } : null;
    }
    case 'campamento': return en(p.campamentosBandidos?.find((x) => x.id === sel.id)?.posicion, 1 * M * MUNDO3D.campamento);
    case 'mercenarios': return en(p.campamentosMercenarios?.find((x) => x.id === sel.id)?.posicion, 1.1 * M * MUNDO3D.campamento);
    case 'alijo': return en(p.alijos?.find((x) => x.id === sel.id)?.posicion, 0.5 * MUNDO3D.alijo);
    case 'batalla': return en(p.batallas?.find((x) => x.battleId === sel.id)?.punto, 1);
    case 'puebloMapa': {
      const x = mundo.pueblos.find((y) => y.id === sel.id);
      return en(x?.posicion, (x?.aldea ? 1.5 : 0.9) * M);
    }
    case 'avanzadaMapa': return en(p.avanzadas?.find((x) => x.id === sel.id)?.posicion, 0.7 * M);
    case 'obraMapa': return en(p.obrasDeMapa?.find((x) => x.id === sel.id)?.posicion, 0.6 * M);
  }
  // columnas (de la Facción, en formación o avistadas) y caravanas: por su id
  const c = [...p.ejercitos, ...(p.ejercitosAvistados ?? []), ...(p.caravanas ?? []), ...(p.caravanasAvistadas ?? [])].find((x) => x.id === sel.id);
  return en(c?.posicionActual, 0.7);
}

/** El radio de una zona a partir de su contorno: hasta su punto más lejano (el contorno está recortado contra los vecinos, pero no por fuera). */
function radioDelContorno(centro: Punto, zona: readonly Punto[]): number {
  let r = 0;
  for (const q of zona) r = Math.max(r, Math.hypot(q.x - centro.x, q.y - centro.y));
  return r;
}

/** Las rayas de las zonas de influencia, fusionadas por Facción: la frontera segmentada por fuera (la de `miFaccion` no, si ya la traza su
 * zona fusionada) y una línea tenue entre provincias (las tuyas, encima de la niebla). */
export function trazosDeFronteras(zonas: readonly (ZonaDeFaccion & { recordada: boolean })[], color: (faccionId: string) => string, miFaccion: string | null | undefined, conZonaPropia: boolean): TrazoEnVista[] {
  const out: TrazoEnVista[] = [];
  for (const t of partirFronteras(zonas)) {
    const z = zonas[t.zona]!, mia = z.faccionId === miFaccion;
    if (t.tipo === 'interior') out.push({ puntos: t.puntos, ancho: ANCHOS.provincia, color: color(z.faccionId), bajoNiebla: !mia, tenue: true, tipo: 'frontera' });
    else if (!(mia && conZonaPropia)) out.push({ puntos: t.puntos, ancho: ANCHOS.frontera, color: color(z.faccionId), bajoNiebla: true, discontinuo: true, recordada: z.recordada, tipo: 'frontera', haciaDentro: sentidoDe(z.contorno) });
  }
  return out;
}

/** El trazado suavizado de cada camino (`suavizarCamino`), guardado por su lista de puntos: la proyección del instante, que se rehace en cada
 * fotograma mientras algo marcha, trae los mismos. */
const CAMINOS_SUAVES = new WeakMap<readonly Punto[], Punto[]>();
function caminoSuave(puntos: readonly Punto[]): Punto[] {
  let s = CAMINOS_SUAVES.get(puntos);
  if (!s) CAMINOS_SUAVES.set(puntos, (s = suavizarCamino(puntos)));
  return s;
}

/** Plazas, pueblos, avanzadas, obras, campamentos y rayas de la proyección, con el lado de la niebla de cada capa como en `render.ts`. */
export function mundoDesdeProyeccion(p: ProyeccionJugador, reglas: ReglasDeVista): MundoEnVista {
  const color = (faccionId: string | null | undefined) => (faccionId ? faccionColor(faccionId, p.facciones) : COLOR_AJENO);
  const colorDeMadre = (madreId: string, propio: boolean) => (propio ? color(p.faccionId) : color(p.asentamientosAvistados?.find((a) => a.id === madreId)?.faccionId));
  const plazas: PlazaEnVista[] = [];
  const trazos: TrazoEnVista[] = [];
  // bajo la niebla: caminos, fronteras de lo que se ve (su silueta real) y de lo que se recuerda (un círculo discontinuo con su radio)
  for (const c of p.caminos ?? []) {
    if (c.puntos.length < 2) continue;
    const escalon = c.escalon === 0 || c.escalon === 2 ? c.escalon : 1;
    trazos.push({ puntos: caminoSuave(c.puntos), ancho: ANCHOS.caminos[escalon], color: COLOR_CAMINO, bajoNiebla: true, tipo: 'camino', escalon });
  }
  // Las zonas de una misma Facción, fusionadas (`mundo/fronteras.ts`): frontera por fuera y una línea tenue entre sus provincias. La frontera
  // exterior de lo tuyo la traza la zona fusionada, encima; de ti solo salen aquí las líneas entre provincias, también encima.
  const conZonaPropia = (p.zonasFusionadas ?? []).some((z) => z.faccionId === p.faccionId && z.contornos.length > 0);
  const zonas: (ZonaDeFaccion & { recordada: boolean })[] = [];
  for (const a of p.asentamientosAvistados ?? []) {
    const zona = a.zona ?? [], radioZona = zona.length >= 3 ? radioDelContorno(a.posicion, zona) : reglas.radioZonaInicial;
    plazas.push({ id: a.id, posicion: a.posicion, radioCiudad: radioZona * FRACCION_CIUDAD, color: color(a.faccionId), recordada: false, nivel: a.nivel ?? 1 });
    if (zona.length >= 3) zonas.push({ faccionId: a.faccionId || `sin-${a.id}`, contorno: zona, recordada: false });
  }
  for (const c of p.asentamientosConocidos ?? []) {
    const radioZona = c.radioPotencial ?? reglas.radioZonaInicial;
    plazas.push({ id: c.asentamientoId, posicion: c.posicion, radioCiudad: radioZona * FRACCION_CIUDAD, color: color(c.faccionId), recordada: true, nivel: c.nivel ?? 1 });
    if (c.radioPotencial !== undefined) zonas.push({ faccionId: c.faccionId || `sin-${c.asentamientoId}`, contorno: circulo(c.posicion, c.radioPotencial).slice(0, -1), recordada: true });
  }
  trazos.push(...trazosDeFronteras(zonas, color, p.faccionId, conZonaPropia));
  // encima: la zona propia y el anillo de protección de los campamentos de mercenarios
  for (const z of p.zonasFusionadas ?? []) for (const c of z.contornos) if (c.length >= 3) trazos.push({ puntos: [...c, c[0]!], ancho: ANCHOS.zona, color: color(z.faccionId), bajoNiebla: false, discontinuo: true, tipo: 'zona', haciaDentro: sentidoDe(c) });
  const campamentos = (p.campamentosMercenarios ?? []).map((c) => ({ id: c.id, posicion: c.posicion, radioProteccion: reglas.radioProteccion }));
  for (const c of campamentos) trazos.push({ puntos: circulo(c.posicion, c.radioProteccion), ancho: ANCHOS.anillo, color: COLOR_ANILLO, bajoNiebla: false, tipo: 'anillo' });
  return {
    plazas,
    pueblos: (p.pueblos ?? []).map((x) => ({ id: x.id, posicion: x.posicion, aldea: x.tipo === 'aldeaAgricola', color: colorDeMadre(x.madreId, x.propio) })),
    avanzadas: (p.avanzadas ?? []).map((x) => ({ id: x.id, posicion: x.posicion, etapa: x.etapa, ruinas: x.enRuinas, color: colorDeMadre(x.madreId, x.propia) })),
    // la mejora de una aldea no se pinta aparte: la aldea ya está
    obras: (p.obrasDeMapa ?? []).filter((o) => o.tipo !== 'mejoraAldea').map((o) => ({ id: o.id, posicion: o.posicion, arrancada: o.terminaEn !== undefined, color: colorDeMadre(o.madreId, o.propia) })),
    campamentos,
    bandidos: (p.campamentosBandidos ?? []).map((c) => ({ id: c.id, posicion: c.posicion, nivel: c.nivel })),
    alijos: (p.alijos ?? []).map((a) => ({ id: a.id, posicion: a.posicion })),
    batallas: (p.batallas ?? []).map((b) => ({ id: b.battleId, posicion: b.punto, propia: !!b.ladoPropio })),
    trazos,
  };
}
