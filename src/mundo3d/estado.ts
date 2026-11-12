// Lo que pinta el mundo 3D, sacado de la proyección del jugador: las columnas y caravanas, lo que hay en el mundo (con el lado de la niebla de
// cada capa, como en `render.ts`), las Miradas, los nombres, lo seleccionado y la vista previa de fundar. La vista no lee la proyección
// directamente: así se prueba sola (y el banco de pruebas de `pruebas/mundo3d/` le da un estado de mentira).
import { caravanaEnElMapa } from '../mundo/caravanas';
import type { ProyeccionJugador } from '../apiCliente';
import type { SitiosDeAldea } from '../mundo/fertilidad';
import { faccionColor } from '../paletas';
import { svgSigilo } from '../sigilo/sigilo';
import type { NieblaProyectada } from '../tiposDominio';
import { HOLGURA_ARO, radioDeAlijo, radioDeAvanzada, radioDeBandidos, radioDeBatalla, radioDeCampamento, radioDeObra, radioDePlaza, radioDePueblo } from './huellas';
import type { TropaDeColumna } from './figuras';
import { circulo, sentidoDe, suavizarCamino } from './lineas';
import { partirFronteras, type ZonaDeFaccion } from '../mundo/fronteras';
import { zonasDeLoRecordado } from '../mundo/zonasRecordadas';
import { COLOR_AEDA, nombreDeAeda } from '../mundo/aedas';
import type { RellenoDeTerritorio } from './territorio';

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
  /** De quién es y, de una columna personal, quién la lleva (su héroe): su cartel encima. */
  faccionId?: string;
  heroe?: string;
  /** Quieta, esperando a ser tres para ser un ejército (Doc 5.14.4): lleva un anillo discontinuo. */
  formacion: boolean;
}

/** Una caravana suelta en el mapa (las enganchadas van detrás de su columna): la propia con su ruta, la avistada sin ella. */
export interface CaravanaEnVista { id: string; posicion: Punto; ruta: Punto[]; fundacion: boolean; color: string; faccionId?: string;
  /** Las escuadras de su escolta, que marchan delante del carro: las cedidas de la propia (`escoltaIds`); de la avistada solo se sabe si va
   * escoltada (`escoltada`), y se pinta una. */
  escolta?: number;
  /** Lo que tira de cada uno de sus carros (`carros[].animal`, solo en las comerciales propias): un carro por animal. Sin él, un carro con buey. */
  animales?: AnimalDeTiro[] }
/** Un Aeda itinerante de camino: él a pie y su burro (`figurasDeAeda`). */
export interface AedaEnVista { id: string; posicion: Punto }
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
export interface EtiquetaEnVista { id: string; posicion: Punto; texto: string; tipo: 'plaza' | 'mirada' | 'territorio' | 'nodo' | 'campamento' | 'columna' | 'ejercito' | 'caravana' | 'aeda'; color?: string; tenue?: boolean; subtexto?: string; sigilo?: string }

/** Una plaza: la ciudad del juego ocupa el 10 % del radio de su zona. `recordada` = se vio alguna vez y ahora no (va bajo la niebla).
 * `muralla`: si tiene muralla (una empezada cuenta), lo que se sabe desde fuera; sin saberlo (recordada), lo de su nivel. */
export interface PlazaEnVista { id: string; posicion: Punto; radioCiudad: number; color: string; recordada: boolean; nivel: number; muralla?: boolean }
/** Un pueblo: extractor sobre su nodo o aldea agrícola; la aldea, con su `cultivo` (tanda 69: `trigo`, `vid` u `oliva`) si se sabe. */
export interface PuebloEnVista { id: string; posicion: Punto; aldea: boolean; color: string; cultivo?: string }
/** Una avanzada: 1 atalaya, 2 fuerte, 3 ciudadela. */
export interface AvanzadaEnVista { id: string; posicion: Punto; etapa: number; ruinas: boolean; color: string }
/** Una obra de mapa a la espera de materiales o ya en marcha (`arrancada`). */
export interface ObraEnVista { id: string; posicion: Punto; arrancada: boolean; color: string }
/** Un campamento de mercenarios con su anillo de protección. */
export interface CampamentoEnVista { id: string; posicion: Punto; radioProteccion: number }
/** Una raya sobre el terreno: camino, frontera o zona. `bajoNiebla` = la oscurece la niebla, como en el 2D; si no, va encima. */
export interface TrazoEnVista { puntos: Punto[]; ancho: number; color: string; bajoNiebla: boolean; discontinuo?: boolean; tipo: 'camino' | 'frontera' | 'zona' | 'anillo'; recordada?: boolean;
  /** De un camino: 0 sendero, 1 camino de tierra (su textura). En el mundo abierto no hay calzadas: el escalón 2 del servidor va como 1. */
  escalon?: 0 | 1;
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
  /** El relleno suave de las zonas de influencia sobre el suelo, uno por Facción (`territorio.ts`). */
  territorios: RellenoDeTerritorio[];
}

export const mundoVacio = (): MundoEnVista => ({ plazas: [], pueblos: [], avanzadas: [], obras: [], campamentos: [], bandidos: [], alijos: [], batallas: [], trazos: [], territorios: [] });

export interface EstadoVista {
  /** Donde mira la cámara: la cabeza de la columna del jugador o, si no va en una, el sitio donde está. */
  heroe: Punto | null;
  /** Radio de visión de la columna del jugador (`VISION` del servidor): decide cuánto cabe en pantalla. */
  radioVision: number;
  columnas: ColumnaEnVista[];
  caravanas: CaravanaEnVista[];
  /** Los Aedas itinerantes que van de camino (los parados en una plaza no andan por ella: se dicen en su cartel). */
  aedas?: AedaEnVista[];
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
/** Anchura de las rayas, en u: caminos por escalón (sendero, camino de tierra), fronteras, la zona propia y el anillo de los mercenarios. Más
 * gruesas que en la realidad para que se lean desde la cámara de juego. De un camino es la cinta entera: lo que se ve es algo menos, que sus
 * bordes se funden con el suelo (`caminos.ts`). La frontera y la zona, la mitad que antes de 0.124.0 (Víctor: «reducimos el grosor»). */
export const ANCHOS = { caminos: [0.4, 0.65], frontera: 0.12, zona: 0.18, provincia: 0.06, anillo: 0.1 } as const;
/** Opacidad del relleno de las zonas de influencia sobre el suelo: la propia y las ajenas (`territorio.ts`). */
export const ALFA_TERRITORIO = { propio: 0.18, ajeno: 0.13 } as const;
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
/** ¿Anda algo de lo que se ve? Las columnas y caravanas propias con ruta y las ajenas que van por su plan (`enMarcha`). Mientras algo anda, la
 * vista se rehace con la proyección del instante y no solo cuando llega una del servidor: sin las ajenas, con tu columna parada, las demás iban
 * a saltos (una vez por cambio del servidor; Víctor lo vio con 40-50 héroes en marcha, 2026-11-03). */
export function algoSeMueve(p: ProyeccionJugador): boolean {
  return p.ejercitos.some((e) => e.estado !== 'estacionado' && (e.ruta?.length ?? 0) >= 2)
    || (p.caravanas ?? []).some((c) => (c.ruta?.length ?? 0) >= 2)
    || (p.ejercitosAvistados ?? []).some((e) => e.enMarcha)
    || (p.caravanasAvistadas ?? []).some((c) => c.enMarcha)
    || (p.aedasAvistados ?? []).some((a) => a.enMarcha);
}

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
  // el nombre del héroe que lleva una columna: el tuyo de tu ficha, el de otro de su ficha pública (si se ve)
  const conNombre = (heroeId: string | undefined): { heroe?: string } => {
    const nombre = heroeId === undefined ? undefined : heroeId === p.heroeId ? p.heroe?.displayName : p.heroesVisibles?.find((h) => h.heroeId === heroeId)?.displayName;
    return nombre ? { heroe: nombre } : {};
  };
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
      faccionId: e.faccionId ?? p.faccionId ?? undefined,
      ...conNombre(e.liderId ?? e.participantes[0]?.heroeId),
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
      color: color(a.faccionId), faccionId: a.faccionId, ...conNombre(a.heroeIds[0]),
      carros: { carga: Math.min(2, a.caravanasAdjuntasIds.length), fundacion: !!a.caravanaFundacionId }, formacion: !!a.enFormacion,
    });
  }
  // las caravanas sueltas: las enganchadas (propias o ajenas) van con su columna, y las que esperan dentro (en su plaza, su pueblo o una parada)
  // no están en el mapa (`caravanaEnElMapa`)
  const adjuntas = new Set([...p.ejercitos, ...(p.ejercitosAvistados ?? [])].flatMap((e) => [...(e.caravanasAdjuntasIds ?? []), ...(e.caravanaFundacionId ? [e.caravanaFundacionId] : [])]));
  const caravanas: CaravanaEnVista[] = (p.caravanas ?? [])
    .filter((c) => !adjuntas.has(c.id) && caravanaEnElMapa(c))
    .map((c) => {
      const fundacion = c.tipo === 'construccion', escolta = Math.min(MAX_ESCOLTA, c.escoltaIds?.length ?? 0);
      const animales = fundacion ? [] : animalesDe(c, MAX_CARROS_CARAVANA);
      return {
        id: c.id, posicion: c.posicionActual, ruta: (c.ruta?.length ?? 0) >= 2 ? c.ruta! : [], fundacion,
        color: color(p.asentamientos.find((a) => a.id === c.origenAsentamientoId)?.faccionId ?? p.faccionId),
        faccionId: p.asentamientos.find((a) => a.id === c.origenAsentamientoId)?.faccionId ?? c.faccionId ?? p.faccionId ?? undefined,
        ...(escolta ? { escolta } : {}), ...(animales.length ? { animales } : {}),
      };
    });
  for (const c of (p.caravanasAvistadas ?? []).filter((x) => !adjuntas.has(x.id)))
    caravanas.push({ id: c.id, posicion: c.posicionActual, ruta: [], fundacion: false, color: c.faccionId ? color(c.faccionId) : COLOR_AJENO, ...(c.faccionId ? { faccionId: c.faccionId } : {}), ...(c.escoltada ? { escolta: 1 } : {}) });
  const miradas = (p.miradasIntel ?? []).map((m) => {
    const abierta = m.expiraEn > p.instante;
    return { id: m.id, centro: m.centro, radio: m.radio, abierta, minutos: Math.max(0, Math.ceil(((abierta ? m.expiraEn : m.libreEn) - p.instante) / 60_000)) };
  });
  const mundo = mundoDesdeProyeccion(p, reglas);
  const aedas = (p.aedasAvistados ?? []).filter((a) => !a.enAsentamientoId).map((a) => ({ id: a.id, posicion: a.posicion }));
  return {
    heroe: enElMapa?.posicionActual ?? dondeEsta,
    radioVision: mia && mia.escuadronIds.length > 0 ? radios.ejercito : radios.solo,
    columnas,
    caravanas,
    aedas,
    niebla: p.exploracion ?? null,
    mundo,
    miradas,
    etiquetas: etiquetasDesdeProyeccion(p, columnas, miradas, caravanas),
    seleccion: dondeEstaLaSeleccion(p, extra.seleccion ?? null, mundo),
    fundacion: extra.fundacion ?? null,
  };
}

/** El ancho (px) del escudo de los carteles de columnas, ejércitos y caravanas: más pequeño que el de las plazas. */
const CARTEL = 26;

/** El SVG de un sigilo, guardado por sigilo y ancho: los carteles se rehacen en cada fotograma y el SVG de un escudo no cambia. */
const svgsDeSigilo = new WeakMap<object, Map<number, string>>();
const SIN_SIGILO = {};
function svgSigiloGuardado(sigilo: Parameters<typeof svgSigilo>[0], ancho: number): string {
  const clave = (sigilo ?? SIN_SIGILO) as object;
  let porAncho = svgsDeSigilo.get(clave);
  if (!porAncho) svgsDeSigilo.set(clave, (porAncho = new Map()));
  let svg = porAncho.get(ancho);
  if (svg === undefined) porAncho.set(ancho, (svg = svgSigilo(sigilo, ancho)));
  return svg;
}

/** Los nombres sobre el mundo: el de cada plaza (tenue el de la que solo se recuerda), los minutos de cada Mirada y, bajo una columna propia que
 * pisa tierra ajena, de quién es (lo dice el servidor, `territorioPorEjercito`). */
export function etiquetasDesdeProyeccion(p: ProyeccionJugador, columnas: readonly ColumnaEnVista[], miradas: readonly MiradaEnVista[], caravanas: readonly CaravanaEnVista[] = []): EtiquetaEnVista[] {
  const out: EtiquetaEnVista[] = [];
  const color = (f: string) => faccionColor(f, p.facciones);
  // el escudo completo de la Facción dueña, de su ficha o, si no es de las que llegan enteras, del directorio
  const escudos = new Map<string, string>();
  const fichaDe = (f: string) => p.facciones.find((x) => x.id === f) ?? p.directorioFacciones?.find((x) => x.id === f);
  const escudo = (f: string, ancho = 40): string => {
    let svg = escudos.get(`${f}|${ancho}`);
    if (svg === undefined) {
      svg = svgSigiloGuardado(fichaDe(f)?.sigilo, ancho);
      escudos.set(`${f}|${ancho}`, svg);
    }
    return svg;
  };
  // Un Aeda parado en una plaza no anda por ella: lo dice el cartel de la plaza, como su Armería activa (motor 457c278, donde se compra y se forja).
  const conAeda = new Set((p.aedasAvistados ?? []).map((a) => a.enAsentamientoId).filter(Boolean));
  for (const a of p.asentamientosAvistados ?? []) out.push({ id: `plaza:${a.id}`, posicion: a.posicion, texto: a.nombre || a.id, tipo: 'plaza', color: color(a.faccionId), subtexto: `Nivel ${a.nivel}${a.armeriaActiva ? ' · ⚒️ Armería' : ''}${conAeda.has(a.id) ? ' · 📜 Aeda' : ''}`, sigilo: escudo(a.faccionId) });
  for (const c of p.asentamientosConocidos ?? []) out.push({ id: `plaza:${c.asentamientoId}`, posicion: c.posicion, texto: c.nombre || c.asentamientoId, tipo: 'plaza', color: color(c.faccionId), tenue: true, subtexto: `Nivel ${c.nivel}`, sigilo: escudo(c.faccionId) });
  // Los campamentos con su cartel, como las plazas: los de mercenarios (siempre a la vista) y los de bandidos que se ven ahora.
  for (const c of p.campamentosMercenarios ?? []) out.push({ id: `mercenarios:${c.id}`, posicion: c.posicion, texto: '⛺ Mercenarios', tipo: 'campamento', color: '#9cc3ea' });
  for (const c of p.campamentosBandidos ?? []) out.push({ id: `bandidos:${c.id}`, posicion: c.posicion, texto: `☠ Bandidos · nivel ${c.nivel}`, tipo: 'campamento', color: '#e8826f' });
  for (const m of miradas) out.push({ id: `mirada:${m.id}`, posicion: m.centro, texto: `${m.abierta ? '👁' : '⏳'} ${m.minutos} min`, tipo: 'mirada', tenue: !m.abierta });
  // Sobre cada columna, su cartel (Víctor, 2026-11-06): el escudo de su Facción y, de una personal, el nombre de su héroe con la Facción más
  // pequeña debajo; de un ejército, el nombre de la Facción. Sobre cada caravana suelta, escudo y Facción.
  const nombreDe = (f: string | undefined) => (f ? fichaDe(f)?.nombre : undefined);
  for (const c of columnas) {
    if (!c.faccionId && !c.heroe) continue;
    const f = c.faccionId ?? '', faccion = nombreDe(f) ?? 'Sin Facción', base = { posicion: c.posicion, color: f ? color(f) : COLOR_AJENO, sigilo: escudo(f, CARTEL) };
    if (c.tropa.ejercito) out.push({ id: `columna:${c.id}`, texto: faccion, tipo: 'ejercito', ...base });
    else out.push({ id: `columna:${c.id}`, texto: c.heroe ?? faccion, tipo: 'columna', ...(c.heroe ? { subtexto: faccion } : {}), ...base });
  }
  // Sobre cada Aeda de camino, su nombre (el que le pone el cliente).
  for (const a of p.aedasAvistados ?? []) if (!a.enAsentamientoId) out.push({ id: `aeda:${a.id}`, posicion: a.posicion, texto: `📜 ${nombreDeAeda(a.id)}`, tipo: 'aeda', subtexto: 'Aeda', color: COLOR_AEDA });
  for (const c of caravanas) {
    if (!c.faccionId) continue;
    out.push({ id: `caravana:${c.id}`, posicion: c.posicion, texto: nombreDe(c.faccionId) ?? 'Sin Facción', tipo: 'caravana', color: color(c.faccionId), sigilo: escudo(c.faccionId, CARTEL) });
  }
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
  // el aro, del tamaño de la maqueta (`huellas.ts`; Víctor 2026-11-07: «el círculo alrededor es demasiado grande»)
  const aro = (r: number) => r + HOLGURA_ARO;
  switch (sel.tipo) {
    case 'asentamiento': {
      const plaza = mundo.plazas.find((x) => x.id === sel.id);
      return plaza ? { posicion: plaza.posicion, radio: aro(radioDePlaza(plaza.radioCiudad, plaza.nivel)) } : null;
    }
    case 'campamento': return en(p.campamentosBandidos?.find((x) => x.id === sel.id)?.posicion, aro(radioDeBandidos()));
    case 'mercenarios': return en(p.campamentosMercenarios?.find((x) => x.id === sel.id)?.posicion, aro(radioDeCampamento()));
    case 'alijo': return en(p.alijos?.find((x) => x.id === sel.id)?.posicion, aro(radioDeAlijo()));
    case 'batalla': return en(p.batallas?.find((x) => x.battleId === sel.id)?.punto, aro(radioDeBatalla()));
    case 'puebloMapa': {
      const x = mundo.pueblos.find((y) => y.id === sel.id);
      return en(x?.posicion, aro(radioDePueblo(!!x?.aldea)));
    }
    case 'avanzadaMapa': {
      const x = mundo.avanzadas.find((y) => y.id === sel.id);
      return en(x?.posicion ?? p.avanzadas?.find((y) => y.id === sel.id)?.posicion, aro(radioDeAvanzada(x?.etapa ?? 1)));
    }
    case 'obraMapa': return en(p.obrasDeMapa?.find((x) => x.id === sel.id)?.posicion, aro(radioDeObra()));
  }
  if (sel.tipo === 'aeda') {
    const a = p.aedasAvistados?.find((x) => x.id === sel.id);
    const plaza = a?.enAsentamientoId ? mundo.plazas.find((x) => x.id === a.enAsentamientoId) : undefined;
    return plaza ? { posicion: plaza.posicion, radio: aro(radioDePlaza(plaza.radioCiudad, plaza.nivel)) } : en(a?.posicion, 0.5);
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

/** Los sitios por los que un camino tiene que pasar tal cual (plazas, pueblos, campamentos): su punto redondeado a la u y los de alrededor,
 * que el servidor redondea a la u los extremos de cada tramo de su red. */
function anclasDe(sitios: readonly Punto[]): Set<string> {
  const out = new Set<string>();
  for (const p of sitios) {
    const x = Math.round(p.x), y = Math.round(p.y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.add(`${x + dx},${y + dy}`);
  }
  return out;
}

/** El relleno de las zonas, como en el 2D (`render.ts`): uno por Facción con sus zonas juntas (las que se ven y las que se recuerdan) y el de
 * tu Facción con su zona fusionada, que respeta los huecos. */
export function rellenosDeTerritorio(
  zonas: readonly (ZonaDeFaccion & { color: string })[],
  fusionadas: readonly { faccionId: string; contornos: Punto[][] }[],
  color: (faccionId: string) => string,
  miFaccion: string | null | undefined,
  conZonaPropia: boolean,
): RellenoDeTerritorio[] {
  const porFaccion = new Map<string, RellenoDeTerritorio>();
  for (const z of zonas) {
    if (conZonaPropia && z.faccionId === miFaccion) continue;
    let r = porFaccion.get(z.faccionId);
    if (!r) porFaccion.set(z.faccionId, (r = { color: z.color, alfa: z.faccionId === miFaccion ? ALFA_TERRITORIO.propio : ALFA_TERRITORIO.ajeno, contornos: [], regla: 'nonzero' }));
    (r.contornos as Punto[][]).push(z.contorno as Punto[]);
  }
  const out = [...porFaccion.values()];
  for (const z of fusionadas) if (z.contornos.length) out.push({ color: color(z.faccionId), alfa: ALFA_TERRITORIO.propio, contornos: z.contornos, regla: 'evenodd' });
  return out;
}

/** El trazado suavizado de cada camino (`suavizarCamino`), guardado por su lista de puntos: la proyección del instante, que se rehace en cada
 * fotograma mientras algo marcha, trae los mismos. Un vértice en una plaza o un pueblo no se suaviza: el camino que la cruza pasa por ella y no
 * le corta la esquina por dentro de la ciudad (Víctor, 2026-11-03). */
const CAMINOS_SUAVES = new WeakMap<readonly Punto[], { fijos: string; suave: Punto[] }>();
function caminoSuave(puntos: readonly Punto[], anclas: ReadonlySet<string>): Punto[] {
  const fijos: number[] = [];
  for (let k = 1; k < puntos.length - 1; k++) if (anclas.has(`${Math.round(puntos[k]!.x)},${Math.round(puntos[k]!.y)}`)) fijos.push(k);
  const clave = fijos.join(','), guardado = CAMINOS_SUAVES.get(puntos);
  if (guardado?.fijos === clave) return guardado.suave;
  const suave = suavizarCamino(puntos, fijos);
  CAMINOS_SUAVES.set(puntos, { fijos: clave, suave });
  return suave;
}

/** Plazas, pueblos, avanzadas, obras, campamentos y rayas de la proyección, con el lado de la niebla de cada capa como en `render.ts`. */
export function mundoDesdeProyeccion(p: ProyeccionJugador, reglas: ReglasDeVista): MundoEnVista {
  const color = (faccionId: string | null | undefined) => (faccionId ? faccionColor(faccionId, p.facciones) : COLOR_AJENO);
  const colorDeMadre = (madreId: string, propio: boolean) => (propio ? color(p.faccionId) : color(p.asentamientosAvistados?.find((a) => a.id === madreId)?.faccionId));
  const plazas: PlazaEnVista[] = [];
  const trazos: TrazoEnVista[] = [];
  // bajo la niebla: caminos y fronteras, de lo que se ve (su silueta real) y de lo que se recuerda (su disco recortado por los vecinos)
  const anclas = anclasDe([
    ...(p.asentamientosAvistados ?? []).map((a) => a.posicion), ...(p.asentamientosConocidos ?? []).map((c) => c.posicion),
    ...(p.pueblos ?? []).map((x) => x.posicion), ...(p.campamentosMercenarios ?? []).map((c) => c.posicion),
  ]);
  for (const c of p.caminos ?? []) {
    if (c.puntos.length < 2) continue;
    // sendero o camino de tierra: en la Edad del Bronce no hay calzadas
    const escalon = c.escalon === 0 ? 0 : 1;
    trazos.push({ puntos: caminoSuave(c.puntos, anclas), ancho: ANCHOS.caminos[escalon], color: COLOR_CAMINO, bajoNiebla: true, tipo: 'camino', escalon });
  }
  // Las zonas de una misma Facción, fusionadas (`mundo/fronteras.ts`): frontera por fuera y una línea tenue entre sus provincias. La frontera
  // exterior de lo tuyo la traza la zona fusionada, encima; de ti solo salen aquí las líneas entre provincias, también encima.
  const conZonaPropia = (p.zonasFusionadas ?? []).some((z) => z.faccionId === p.faccionId && z.contornos.length > 0);
  const zonas: (ZonaDeFaccion & { recordada: boolean; color: string })[] = [];
  for (const a of p.asentamientosAvistados ?? []) {
    const zona = a.zona ?? [], radioZona = zona.length >= 3 ? radioDelContorno(a.posicion, zona) : reglas.radioZonaInicial;
    plazas.push({ id: a.id, posicion: a.posicion, radioCiudad: radioZona * FRACCION_CIUDAD, color: color(a.faccionId), recordada: false, nivel: a.nivel ?? 1, muralla: a.tieneMuralla });
    if (zona.length >= 3) zonas.push({ faccionId: a.faccionId || `sin-${a.id}`, contorno: zona, recordada: false, color: color(a.faccionId) });
  }
  // lo que solo se recuerda: el disco de su radio recortado por los de otras Facciones que se conocen, como lo recorta el motor
  // (`zonasRecordadas.ts`); con el trazo de lo que se ve
  const recordadas = zonasDeLoRecordado(p.asentamientosAvistados, p.asentamientosConocidos, [...(p.asentamientos ?? []), ...(p.plazasPropias ?? [])]);
  for (const c of p.asentamientosConocidos ?? []) {
    const radioZona = c.radioPotencial ?? reglas.radioZonaInicial, zona = recordadas.get(c.asentamientoId);
    plazas.push({ id: c.asentamientoId, posicion: c.posicion, radioCiudad: radioZona * FRACCION_CIUDAD, color: color(c.faccionId), recordada: true, nivel: c.nivel ?? 1 });
    if (zona) zonas.push({ faccionId: c.faccionId || `sin-${c.asentamientoId}`, contorno: zona, recordada: false, color: color(c.faccionId) });
  }
  trazos.push(...trazosDeFronteras(zonas, color, p.faccionId, conZonaPropia));
  const territorios = rellenosDeTerritorio(zonas, p.zonasFusionadas ?? [], color, p.faccionId, conZonaPropia);
  // encima: la zona propia y el anillo de protección de los campamentos de mercenarios
  for (const z of p.zonasFusionadas ?? []) for (const c of z.contornos) if (c.length >= 3) trazos.push({ puntos: [...c, c[0]!], ancho: ANCHOS.zona, color: color(z.faccionId), bajoNiebla: false, discontinuo: true, tipo: 'zona', haciaDentro: sentidoDe(c) });
  const campamentos = (p.campamentosMercenarios ?? []).map((c) => ({ id: c.id, posicion: c.posicion, radioProteccion: reglas.radioProteccion }));
  for (const c of campamentos) trazos.push({ puntos: circulo(c.posicion, c.radioProteccion), ancho: ANCHOS.anillo, color: COLOR_ANILLO, bajoNiebla: false, tipo: 'anillo' });
  return {
    plazas,
    pueblos: (p.pueblos ?? []).map((x) => ({ id: x.id, posicion: x.posicion, aldea: x.tipo === 'aldeaAgricola', color: colorDeMadre(x.madreId, x.propio), cultivo: x.cultivo })),
    avanzadas: (p.avanzadas ?? []).map((x) => ({ id: x.id, posicion: x.posicion, etapa: x.etapa, ruinas: x.enRuinas, color: colorDeMadre(x.madreId, x.propia) })),
    // la mejora de una aldea no se pinta aparte: la aldea ya está
    obras: (p.obrasDeMapa ?? []).filter((o) => o.tipo !== 'mejoraAldea').map((o) => ({ id: o.id, posicion: o.posicion, arrancada: o.terminaEn !== undefined, color: colorDeMadre(o.madreId, o.propia) })),
    campamentos,
    bandidos: (p.campamentosBandidos ?? []).map((c) => ({ id: c.id, posicion: c.posicion, nivel: c.nivel })),
    alijos: (p.alijos ?? []).map((a) => ({ id: a.id, posicion: a.posicion })),
    batallas: (p.batallas ?? []).map((b) => ({ id: b.battleId, posicion: b.punto, propia: !!b.ladoPropio })),
    trazos,
    territorios,
  };
}
