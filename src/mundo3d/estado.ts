// Lo que pinta el mundo 3D, sacado de la proyección del jugador. La vista no lee la proyección directamente: así se prueba sola (y el banco de
// pruebas de `pruebas/mundo3d/` le da un estado de mentira).
import type { ProyeccionJugador } from '../apiCliente';
import { faccionColor } from '../paletas';
import { circulo } from './lineas';
import type { NieblaProyectada } from '../tiposDominio';

type Punto = { x: number; y: number };

export interface ColumnaEnVista {
  id: string;
  /** La columna del jugador. */
  propia: boolean;
  posicion: Punto;
  /** Lo que queda por andar (vacío si está quieta). */
  ruta: Punto[];
  /** Héroes a caballo al frente. */
  jinetes: number;
  /** Figuras de tropa detrás. */
  soldados: number;
}

/** Una plaza: la ciudad del juego ocupa el 10 % del radio de su zona. `recordada` = se vio alguna vez y ahora no (va bajo la niebla). */
export interface PlazaEnVista { id: string; posicion: Punto; radioCiudad: number; color: string; recordada: boolean }
/** Un pueblo: extractor sobre su nodo o aldea agrícola. */
export interface PuebloEnVista { id: string; posicion: Punto; aldea: boolean; color: string }
/** Una avanzada: 1 atalaya, 2 fuerte, 3 ciudadela. */
export interface AvanzadaEnVista { id: string; posicion: Punto; etapa: number; ruinas: boolean; color: string }
/** Una obra de mapa a la espera de materiales o ya en marcha (`arrancada`). */
export interface ObraEnVista { id: string; posicion: Punto; arrancada: boolean; color: string }
/** Un campamento de mercenarios con su anillo de protección. */
export interface CampamentoEnVista { id: string; posicion: Punto; radioProteccion: number }
/** Una raya sobre el terreno: camino, frontera o zona. `bajoNiebla` = la oscurece la niebla, como en el 2D; si no, va encima. */
export interface TrazoEnVista { puntos: Punto[]; ancho: number; color: string; bajoNiebla: boolean; discontinuo?: boolean; tipo: 'camino' | 'frontera' | 'zona' | 'anillo' }

/** Lo que hay en el mundo además del suelo y las columnas: se rehace solo cuando cambia. */
export interface MundoEnVista {
  plazas: PlazaEnVista[];
  pueblos: PuebloEnVista[];
  avanzadas: AvanzadaEnVista[];
  obras: ObraEnVista[];
  campamentos: CampamentoEnVista[];
  trazos: TrazoEnVista[];
}

export const MUNDO_VACIO: MundoEnVista = { plazas: [], pueblos: [], avanzadas: [], obras: [], campamentos: [], trazos: [] };

export interface EstadoVista {
  /** Donde mira la cámara: la cabeza de la columna del jugador o, si no va en una, el sitio donde está. */
  heroe: Punto | null;
  /** Radio de visión de la columna del jugador (`VISION` del servidor): decide cuánto cabe en pantalla. */
  radioVision: number;
  columnas: ColumnaEnVista[];
  niebla: NieblaProyectada | null;
  mundo: MundoEnVista;
}

/** Los radios de visión del servidor (`Movimiento_Ejercitos.VISION`): el héroe solo y la columna con soldados. */
export interface RadiosDeVision { solo: number; ejercito: number }

/** Las cifras del servidor que hacen falta para pintar: la visión, el radio con que nace una zona (`reglas.territorio.radio_inicial`) y el
 * anillo de protección de los campamentos de mercenarios (`MERCENARIOS.radioProteccion`). */
export interface ReglasDeVista { vision: RadiosDeVision; radioZonaInicial: number; radioProteccion: number }

/** La ciudad del juego, respecto al radio de su zona (`Economia_Construccion`). */
const FRACCION_CIUDAD = 0.1;
/** Anchura de las rayas, en u: caminos por escalón (sendero, camino, calzada), fronteras, la zona propia y el anillo de los mercenarios. Más
 * gruesas que en la realidad para que se lean desde la cámara de juego. */
export const ANCHOS = { caminos: [0.2, 0.35, 0.55], frontera: 0.12, zona: 0.18, anillo: 0.1 } as const;
const COLOR_AJENO = '#9a927f', COLOR_CAMINO = '#8b5a2b', COLOR_ANILLO = '#2e5e8c';

/** Figuras de tropa por escuadra, y como mucho. */
const FIGURAS_POR_ESCUADRA = 3, MAX_FIGURAS = 18, MAX_JINETES = 4;

/** El estado de la vista para la proyección `p` (la del instante, con las columnas ya movidas). `dondeEsta` es el sitio del héroe cuando no va
 * en una columna en el mapa (dentro de una plaza o de un campamento). */
export function estadoDesdeProyeccion(p: ProyeccionJugador, reglas: ReglasDeVista, dondeEsta: Punto | null): EstadoVista {
  const radios = reglas.vision;
  // la columna en la que marcha el héroe (como `miColumna` de `ui/ejercitos.ts`, sin traerse la interfaz)
  const mia = p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
  const enElMapa = mia && !mia.dentroDe ? mia : undefined;
  const columnas: ColumnaEnVista[] = [];
  if (enElMapa) {
    columnas.push({
      id: enElMapa.id,
      propia: true,
      posicion: enElMapa.posicionActual,
      ruta: enElMapa.estado !== 'estacionado' ? enElMapa.ruta ?? [] : [],
      jinetes: Math.max(1, Math.min(MAX_JINETES, enElMapa.participantes.length)),
      soldados: Math.min(MAX_FIGURAS, enElMapa.escuadronIds.length * FIGURAS_POR_ESCUADRA),
    });
  }
  return {
    heroe: enElMapa?.posicionActual ?? dondeEsta,
    radioVision: mia && mia.escuadronIds.length > 0 ? radios.ejercito : radios.solo,
    columnas,
    niebla: p.exploracion ?? null,
    mundo: mundoDesdeProyeccion(p, reglas),
  };
}

/** El radio de una zona a partir de su contorno: hasta su punto más lejano (el contorno está recortado contra los vecinos, pero no por fuera). */
function radioDelContorno(centro: Punto, zona: readonly Punto[]): number {
  let r = 0;
  for (const q of zona) r = Math.max(r, Math.hypot(q.x - centro.x, q.y - centro.y));
  return r;
}

/** Plazas, pueblos, avanzadas, obras, campamentos y rayas de la proyección, con el lado de la niebla de cada capa como en `render.ts`. */
export function mundoDesdeProyeccion(p: ProyeccionJugador, reglas: ReglasDeVista): MundoEnVista {
  const color = (faccionId: string | null | undefined) => (faccionId ? faccionColor(faccionId, p.facciones) : COLOR_AJENO);
  const colorDeMadre = (madreId: string, propio: boolean) => (propio ? color(p.faccionId) : color(p.asentamientosAvistados?.find((a) => a.id === madreId)?.faccionId));
  const plazas: PlazaEnVista[] = [];
  const trazos: TrazoEnVista[] = [];
  // bajo la niebla: caminos, fronteras de lo que se ve (su silueta real) y de lo que se recuerda (un círculo discontinuo con su radio)
  for (const c of p.caminos ?? []) if (c.puntos.length >= 2) trazos.push({ puntos: c.puntos, ancho: ANCHOS.caminos[c.escalon ?? 1] ?? ANCHOS.caminos[1], color: COLOR_CAMINO, bajoNiebla: true, tipo: 'camino' });
  for (const a of p.asentamientosAvistados ?? []) {
    const zona = a.zona ?? [], radioZona = zona.length >= 3 ? radioDelContorno(a.posicion, zona) : reglas.radioZonaInicial;
    plazas.push({ id: a.id, posicion: a.posicion, radioCiudad: radioZona * FRACCION_CIUDAD, color: color(a.faccionId), recordada: false });
    if (zona.length >= 3) trazos.push({ puntos: [...zona, zona[0]!], ancho: ANCHOS.frontera, color: color(a.faccionId), bajoNiebla: true, tipo: 'frontera' });
  }
  for (const c of p.asentamientosConocidos ?? []) {
    const radioZona = c.radioPotencial ?? reglas.radioZonaInicial;
    plazas.push({ id: c.asentamientoId, posicion: c.posicion, radioCiudad: radioZona * FRACCION_CIUDAD, color: color(c.faccionId), recordada: true });
    if (c.radioPotencial !== undefined) trazos.push({ puntos: circulo(c.posicion, c.radioPotencial), ancho: ANCHOS.frontera, color: color(c.faccionId), bajoNiebla: true, discontinuo: true, tipo: 'frontera' });
  }
  // encima: la zona propia y el anillo de protección de los campamentos de mercenarios
  for (const z of p.zonasFusionadas ?? []) for (const c of z.contornos) if (c.length >= 3) trazos.push({ puntos: [...c, c[0]!], ancho: ANCHOS.zona, color: color(z.faccionId), bajoNiebla: false, tipo: 'zona' });
  const campamentos = (p.campamentosMercenarios ?? []).map((c) => ({ id: c.id, posicion: c.posicion, radioProteccion: reglas.radioProteccion }));
  for (const c of campamentos) trazos.push({ puntos: circulo(c.posicion, c.radioProteccion), ancho: ANCHOS.anillo, color: COLOR_ANILLO, bajoNiebla: false, tipo: 'anillo' });
  return {
    plazas,
    pueblos: (p.pueblos ?? []).map((x) => ({ id: x.id, posicion: x.posicion, aldea: x.tipo === 'aldeaAgricola', color: colorDeMadre(x.madreId, x.propio) })),
    avanzadas: (p.avanzadas ?? []).map((x) => ({ id: x.id, posicion: x.posicion, etapa: x.etapa, ruinas: x.enRuinas, color: colorDeMadre(x.madreId, x.propia) })),
    // la mejora de una aldea no se pinta aparte: la aldea ya está
    obras: (p.obrasDeMapa ?? []).filter((o) => o.tipo !== 'mejoraAldea').map((o) => ({ id: o.id, posicion: o.posicion, arrancada: o.terminaEn !== undefined, color: colorDeMadre(o.madreId, o.propia) })),
    campamentos,
    trazos,
  };
}
