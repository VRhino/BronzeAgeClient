// Lo que pinta la vista 3D de la plaza, sacado de la proyección sin tocar three.js (se prueba solo): las huellas de los edificios con su
// estado, su obra y su estilo; los recintos de muralla celda a celda, en el orden de su anillo; y las celdas libres de la ciudad con lo que
// las rellena (huertos, patios, árboles…). Nada se mueve ni sale de su huella: el trazado manda (Víctor, 2026-11-02).
// Coordenadas: unidades locales del trazado (ul), x a la derecha e y hacia abajo, como el 2D; la celda del trazado mide `celda` ul.
import type { Asentamiento, Edificio, RectanguloLocal, TrazadoAsentamiento } from '../tiposDominio';
import { redDeCalles, type CeldaDeCalle } from './calles';

type Punto = { x: number; y: number };

export interface EdificioEnVista {
  id: string;
  tipo: string;
  /** La huella: esquina de arriba a la izquierda y lados, en ul. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  estado: 'activo' | 'en_construccion' | 'en_cola';
  /** Avance de la obra en curso (construcción o mejora), de 0 a 1; `null` si no hay obra o no se sabe. */
  avance: number | null;
  /** Instante de mundo en que acaba la obra en curso. */
  completaEn?: number;
  mejora: boolean;
  danado: boolean;
  /** Nivel interno del edificio. */
  nivel: number;
  /** El estilo con que se dibuja, de 1 (chozas de paja) a 5 (palacio de piedra): el nivel de la plaza, con el umbral fijo de cada casa. */
  estilo: number;
  /** Un número fijo por edificio (de su id), para el azar de su maqueta. */
  semilla: number;
  /**
   * Hacia qué lado largo da la calle, en el `v` del marco de su maqueta (`modelos.ts`): +1 o −1. Sin calle a un lado (o con calle a los dos),
   * no se sabe y la maqueta lo echa a suertes. Lo usan las tiendas del mercado para abrir su puerta y su mostrador a la calle.
   */
  frente?: 1 | -1;
  /** El molino con su buey (tanda 69, `Edificio.buey`): la maqueta lo pone dando vueltas a la muela. */
  buey?: boolean;
  /** La granja de una aldea que no es de trigo (tanda 69 y motor b55e90f, `Pueblo.cultivo`, lo pone `puebloEnVista`): `vid`, `oliva`, `cebada`
   * o `sesamo`; sin él, de trigo. */
  cultivo?: string;
  /** La bodega o la prensa (motor b55e90f, `Edificio.receta`): el insumo de la receta que trabaja (`uva` o `cebada`; `aceituna` o `sesamo`). */
  receta?: string;
}

export type ClaseCelda = 'muro' | 'puerta' | 'torre';

export interface CeldaDeMuro {
  /** Centro de la celda, en ul. */
  x: number;
  y: number;
  clase: ClaseCelda;
  /** Ya levantada. */
  enPie: boolean;
  /** El nivel con que está en pie (con una mejora en obra, las primeras celdas ya son del nivel nuevo). */
  nivel: number;
  /** Su puesto en el orden de las obras del motor (el de la lista del recinto), si la vista las ordenó de otra manera. */
  obra?: number;
}

export interface RecintoEnVista {
  id: string;
  nivel: number;
  /** En el orden del anillo. */
  celdas: CeldaDeMuro[];
  /** El anillo se cierra (la última celda toca la primera). */
  cerrado: boolean;
  mejorandoA?: number;
  /** El lado de una celda, en ul: con él se buscan las vecinas de cada celda (`vecinasDeMuro`). */
  lado?: number;
}

export type TipoRelleno = 'huerto' | 'patio' | 'arboles' | 'redil' | 'horno' | 'lena' | 'almiar' | 'vacio';

/** Una celda libre de la ciudad y lo que hay en ella. */
export interface Relleno {
  /** Esquina de la celda, en ul. */
  x: number;
  y: number;
  tipo: TipoRelleno;
  semilla: number;
  /** Del campo de alrededor, no de la ciudad. */
  campo?: boolean;
}

export interface CiudadEnVista {
  id: string;
  /** Nivel de la plaza. */
  nivel: number;
  /** Radio del disco urbano, en ul. */
  radio: number;
  /** Lado de una celda, en ul. */
  celda: number;
  calles: RectanguloLocal[];
  caminos: RectanguloLocal[];
  edificios: EdificioEnVista[];
  recintos: RecintoEnVista[];
  libres: Relleno[];
  /** Hasta dónde llega algo de la plaza desde el centro (el lado medio del cuadrado que lo abarca todo), en ul. */
  extension: number;
  /** El radio de lo construido (sin caminos ni lo suelto de las afueras), en ul: lo que encuadra la cámara al entrar. */
  nucleo: number;
  /** Las calles y los caminos celda a celda: con qué vecinas se une cada una y cuánto se usa (`calles.ts`). */
  red: CeldaDeCalle[];
}

/** Un número fijo entre 0 y 1 por texto. */
export function hashTexto(texto: string, sal = 0): number {
  let h = 2166136261 ^ sal;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Un número fijo entre 0 y 1 por (a, b, c). */
export function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Edificios que van con el nivel de la plaza sin quedarse atrás: son su cara. */
const MONUMENTALES = new Set(['centroUrbano', 'palacio', 'salaConsejo', 'maravilla', 'plaza']);

/** Las casas que se quedan un nivel atrás (las más viejas): la ciudad no es uniforme. */
const VIEJAS = 0.82;

/**
 * El estilo de un edificio. Cada casa tiene un umbral fijo (de su id): mientras la plaza sube de nivel, las de umbral más bajo que el avance
 * del ascenso ya lucen el nivel nuevo, así la ciudad se transforma por partes; y las de umbral más alto (`VIEJAS`) se quedan un nivel atrás.
 */
export function estiloDe(id: string, tipo: string, nivel: number, ascenso: Asentamiento['ascenso'], instante: number): number {
  const u = hashTexto(id, 7);
  const p = ascenso ? Math.max(0, Math.min(1, (instante - ascenso.iniciadoEn) / Math.max(1, ascenso.completaEn - ascenso.iniciadoEn))) : 0;
  let n = nivel;
  if (ascenso && (MONUMENTALES.has(tipo) ? p >= 1 : u < p)) n = ascenso.nivelObjetivo;
  else if (!MONUMENTALES.has(tipo) && u > VIEJAS && nivel > 1) n = nivel - 1;
  // un puesto de mercado de una plaza de nivel 2 o más es siempre una tienda (Víctor, 2026-11-03), nunca el tenderete del 1
  if (tipo === 'puestoMercado' && nivel >= 2) n = Math.max(2, n);
  return Math.max(1, Math.min(5, n));
}

const VECINAS_LADO = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const VECINAS_DIAGONAL = [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const;

/**
 * Las celdas de una empalizada o una muralla en el orden de sus anillos: de vecina en vecina, antes de lado que en diagonal, desde la de más
 * arriba a la izquierda. Si quedan celdas que no tocan a las ya recorridas, empiezan otro anillo. El campamento manda sus celdas sueltas, y la
 * plaza, en el orden en que se levantan, que no siempre es el del anillo.
 */
export function anillosDe<T extends { col: number; row: number }>(celdas: T[]): T[][] {
  const clave = (c: number, r: number): string => `${c},${r}`;
  const quedan = new Map(celdas.map((c) => [clave(c.col, c.row), c]));
  const anillos: T[][] = [];
  while (quedan.size) {
    let actual: T | undefined = [...quedan.values()].sort((a, b) => a.row - b.row || a.col - b.col)[0];
    const anillo: T[] = [];
    while (actual) {
      anillo.push(actual);
      quedan.delete(clave(actual.col, actual.row));
      const desde: T = actual;
      actual = undefined;
      for (const [dc, dr] of [...VECINAS_LADO, ...VECINAS_DIAGONAL]) {
        const v = quedan.get(clave(desde.col + dc, desde.row + dr));
        if (v) { actual = v; break; }
      }
    }
    anillos.push(anillo);
  }
  return anillos;
}

/** Lo que hace falta de una plaza para dibujarla (un campamento se dibuja igual: `campamento.ts`). */
export type FuenteDeCiudad = Pick<Asentamiento, 'id' | 'nivel' | 'ascenso' | 'edificios' | 'recintos'>;

export interface OpcionesCiudad {
  /** Instante de mundo de ahora (ms). */
  instante: number;
  /** Lo que dura la obra en curso de un edificio, en minutos (el catálogo con las políticas de la plaza); `null` si no se sabe. */
  minutosDeObra?: (e: Edificio) => number | null;
  /** El edificio del que parten las calles principales, si no es el centro urbano (el ancla de un pueblo). */
  centroId?: string;
}

/** Las celdas de un rectángulo en ul: columnas y filas que toca. */
function celdasDe(r: RectanguloLocal, T: number): { c0: number; c1: number; f0: number; f1: number } {
  return { c0: Math.floor(r.x / T + 1e-6), c1: Math.ceil((r.x + r.ancho) / T - 1e-6) - 1, f0: Math.floor(r.y / T + 1e-6), f1: Math.ceil((r.y + r.alto) / T - 1e-6) - 1 };
}

/** La ciudad que se dibuja, o `null` sin trazado. */
export function ciudadEnVista(a: FuenteDeCiudad, t: TrazadoAsentamiento | undefined, o: OpcionesCiudad): CiudadEnVista | null {
  if (!t) return null;
  const T = t.celda ?? 3;
  const edificios: EdificioEnVista[] = [];
  for (const e of a.edificios ?? []) {
    if ((e.ambito ?? 'asentamiento') === 'mapa') continue;
    const h = t.huellas[e.id];
    if (!h) continue;
    const enObra = e.estado === 'en_construccion' || !!e.mejora;
    const fin = e.mejora?.completaEn ?? e.completaEn;
    const minutos = enObra ? o.minutosDeObra?.(e) ?? null : null;
    const avance = enObra && typeof fin === 'number' && minutos ? Math.max(0, Math.min(1, 1 - (fin - o.instante) / (minutos * 60_000))) : enObra ? 0.5 : null;
    edificios.push({
      id: e.id, tipo: e.tipo, x: h.x, y: h.y, ancho: h.ancho, alto: h.alto, estado: e.estado, avance, completaEn: enObra ? fin : undefined,
      mejora: !!e.mejora, danado: !!e.danado, nivel: e.nivelInterno ?? 1, estilo: estiloDe(e.id, e.tipo, a.nivel, a.ascenso, o.instante),
      semilla: Math.floor(hashTexto(e.id) * 1e9), buey: e.buey || undefined, receta: e.receta,
    });
  }

  const recintos: RecintoEnVista[] = (a.recintos ?? []).map((r) => {
    const enPie = Math.max(0, r.avance);
    // lo levantado y lo mejorado va por el orden del motor (el de las obras); la lista, por el del anillo si las celdas hacen uno solo. El
    // dibujo ya no depende del orden: cada celda se une con sus vecinas de la rejilla (`vecinasDeMuro`, 0.198.1)
    const anillos = anillosDe(r.celdas.map((c, i) => ({ ...c, i })));
    const orden = anillos.length === 1 ? anillos[0]! : r.celdas.map((c, i) => ({ ...c, i }));
    const celdas = orden.map((c) => ({
      x: (c.col + 0.5) * T, y: (c.row + 0.5) * T, clase: c.clase, enPie: c.i < enPie,
      nivel: r.mejorandoA !== undefined && c.i < (r.mejoradas ?? 0) ? r.mejorandoA : r.nivel, obra: c.i,
    }));
    const a0 = orden[0], a1 = orden[orden.length - 1];
    const cerrado = !!a0 && !!a1 && orden.length > 2 && Math.max(Math.abs(a0.col - a1.col), Math.abs(a0.row - a1.row)) <= 1;
    return { id: r.id, nivel: r.nivel, celdas, cerrado, mejorandoA: r.mejorandoA, lado: T };
  });

  // Lo que abarca todo (para el suelo y la rejilla de celdas libres).
  let extension = t.radio ?? 0;
  const abarcar = (x: number, y: number): void => { extension = Math.max(extension, Math.abs(x), Math.abs(y)); };
  for (const r of [...t.calles, ...t.caminos]) { abarcar(r.x, r.y); abarcar(r.x + r.ancho, r.y + r.alto); }
  for (const e of edificios) { abarcar(e.x, e.y); abarcar(e.x + e.ancho, e.y + e.alto); }
  for (const r of recintos) for (const c of r.celdas) abarcar(Math.abs(c.x) + T / 2, Math.abs(c.y) + T / 2);
  const radio = t.radio ?? Math.max(30, extension);
  // Lo construido: hasta donde llega el 90 % de los edificios (las granjas y corrales sueltos de las afueras no cuentan), y la muralla entera.
  const lejanias = edificios.map((e) => Math.hypot(e.x + e.ancho / 2, e.y + e.alto / 2) + Math.max(e.ancho, e.alto) / 2).sort((a, b) => a - b);
  let nucleo = lejanias.length ? lejanias[Math.min(lejanias.length - 1, Math.floor(lejanias.length * 0.9))]! : 20;
  for (const r of recintos) for (const c of r.celdas) nucleo = Math.max(nucleo, Math.hypot(c.x, c.y) + T / 2);

  // Las celdas ocupadas: calles, caminos, huellas y muralla (planificada o en pie, porque ya ocupa suelo).
  const LEJOS = 24, lado = Math.ceil(extension / T) + 2 + LEJOS, ocupada = new Map<number, string>();
  const clave = (c: number, f: number): number => (c + lado) * (2 * lado + 1) + (f + lado);
  const marcar = (r: RectanguloLocal, que: string): void => {
    const { c0, c1, f0, f1 } = celdasDe(r, T);
    for (let c = c0; c <= c1; c++) for (let f = f0; f <= f1; f++) ocupada.set(clave(c, f), que);
  };
  for (const r of t.calles) marcar(r, 'calle');
  for (const r of t.caminos) marcar(r, 'camino');
  for (const e of edificios) marcar(e, e.tipo);
  for (const r of a.recintos ?? []) for (const c of r.celdas) ocupada.set(clave(c.col, c.row), 'muro');

  // El frente de cada edificio: el lado largo con más calle (o camino) pegada. Con el lado largo en x, +v es hacia abajo (y crece); con el lado
  // largo en y, la maqueta gira un cuarto de vuelta y +v es hacia la izquierda (x decrece).
  const esCalle = (c: number, f: number): boolean => { const q = ocupada.get(clave(c, f)); return q === 'calle' || q === 'camino'; };
  for (const e of edificios) {
    const { c0, c1, f0, f1 } = celdasDe(e, T);
    let mas = 0, menos = 0;
    if (e.ancho >= e.alto) for (let c = c0; c <= c1; c++) { if (esCalle(c, f1 + 1)) mas++; if (esCalle(c, f0 - 1)) menos++; }
    else for (let f = f0; f <= f1; f++) { if (esCalle(c0 - 1, f)) mas++; if (esCalle(c1 + 1, f)) menos++; }
    if (mas !== menos) e.frente = mas > menos ? 1 : -1;
  }

  // Lo poblado: a cuántas celdas está cada una de un edificio o una calle (búsqueda en anchura, hasta `LEJOS`). El disco urbano es el techo de la
  // ciudad, no lo que ocupa: lo que queda lejos de todo es campo.
  const dist = new Map<number, number>(), cola: [number, number][] = [];
  for (const [k, que] of ocupada) {
    if (que === 'camino' || que === 'muro') continue;
    const c = Math.floor(k / (2 * lado + 1)) - lado, f = (k % (2 * lado + 1)) - lado;
    dist.set(k, 0);
    cola.push([c, f]);
  }
  for (let i = 0; i < cola.length; i++) {
    const [c, f] = cola[i]!, d = dist.get(clave(c, f))!;
    if (d >= LEJOS) continue;
    for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const nc = c + dc, nf = f + df;
      if (Math.abs(nc) >= lado || Math.abs(nf) >= lado) continue;
      const k = clave(nc, nf);
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      cola.push([nc, nf]);
    }
  }

  const libres: Relleno[] = [];
  const dentro = radio - T * 0.5;
  const cerca = Math.ceil(Math.min(extension, radio) / T) + LEJOS;
  for (let c = -cerca; c < cerca; c++) {
    for (let f = -cerca; f < cerca; f++) {
      const k = clave(c, f);
      if (ocupada.has(k)) continue;
      const d = dist.get(k) ?? LEJOS + 1;
      if (d > LEJOS) continue;
      const cx = (c + 0.5) * T, cy = (f + 0.5) * T;
      const u = hash3(c, f, 91), semilla = Math.floor(hash3(c, f, 17) * 1e9);
      let tipo: TipoRelleno;
      if (d <= 2 && Math.hypot(cx, cy) <= dentro) {
        // en la ciudad: lo que hay junto a cada cosa
        const vecinos = [ocupada.get(clave(c + 1, f)), ocupada.get(clave(c - 1, f)), ocupada.get(clave(c, f + 1)), ocupada.get(clave(c, f - 1))];
        const junto = (que: string): boolean => vecinos.includes(que);
        // junto a las tiendas de un campamento: leña, la reata de los caballos, heno y algún árbol; nada de huertos
        if (junto('tienda')) tipo = u < 0.26 ? 'lena' : u < 0.42 ? 'arboles' : u < 0.52 ? 'almiar' : u < 0.6 ? 'redil' : 'vacio';
        else if (junto('vivienda')) tipo = u < 0.38 ? 'huerto' : u < 0.62 ? 'patio' : u < 0.8 ? 'arboles' : u < 0.88 ? 'horno' : u < 0.94 ? 'lena' : 'vacio';
        else if (junto('granja') || junto('granero') || junto('caballerizas') || junto('corral')) tipo = u < 0.3 ? 'almiar' : u < 0.55 ? 'redil' : u < 0.8 ? 'huerto' : 'arboles';
        else if (junto('lenera') || junto('carpinteria') || junto('tallerCarpinteria')) tipo = u < 0.5 ? 'lena' : 'arboles';
        else if (d === 1) tipo = u < 0.36 ? 'arboles' : u < 0.52 ? 'huerto' : u < 0.62 ? 'redil' : u < 0.67 ? 'horno' : u < 0.74 ? 'almiar' : 'vacio';
        else tipo = u < 0.25 ? 'arboles' : u < 0.4 ? 'huerto' : u < 0.45 ? 'redil' : 'vacio';
      } else {
        // el campo: árboles en corros, más espesos cuanto más lejos; cerca de la ciudad, algún redil o almiar
        const corro = hash3(Math.floor(c / 4), Math.floor(f / 4), 77) * 0.6 + hash3(c, f, 78) * 0.4;
        const densidad = Math.min(0.62, 0.06 + (d - 2) * 0.03);
        if (corro < densidad) tipo = 'arboles';
        else if (d <= 6 && u < 0.03) tipo = u < 0.015 ? 'redil' : 'almiar';
        else continue;
        libres.push({ x: c * T, y: f * T, tipo, semilla, campo: true });
        continue;
      }
      if (tipo === 'vacio') continue;
      libres.push({ x: c * T, y: f * T, tipo, semilla });
    }
  }

  // el corazón de la plaza (en un campamento, su taberna): de él parten las calles principales
  const gobierno = (o.centroId !== undefined ? edificios.find((e) => e.id === o.centroId) : undefined)
    ?? edificios.find((e) => e.tipo === 'centroUrbano') ?? edificios.find((e) => e.tipo === 'palacio') ?? edificios.find((e) => e.tipo === 'taberna');
  const red = redDeCalles(t.calles, t.caminos, T, {
    edificios,
    centro: gobierno ? { x: gobierno.x + gobierno.ancho / 2, y: gobierno.y + gobierno.alto / 2 } : undefined,
    salidas: recintos.flatMap((r) => r.celdas.filter((k) => k.clase === 'puerta')),
  });
  return { id: a.id, nivel: a.nivel, radio, celda: T, calles: t.calles, caminos: t.caminos, edificios, recintos, libres, extension: Math.max(extension, radio), nucleo: Math.max(15, Math.min(nucleo, radio)), red };
}

/** Si un punto (ul) cae en una huella; la de encima si se pisan (no debería). */
export function edificioEn(c: CiudadEnVista, p: Punto): EdificioEnVista | null {
  for (let i = c.edificios.length - 1; i >= 0; i--) {
    const e = c.edificios[i]!;
    if (p.x >= e.x && p.x <= e.x + e.ancho && p.y >= e.y && p.y <= e.y + e.alto) return e;
  }
  return null;
}
