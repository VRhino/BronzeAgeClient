// Prototipo del generador del campo de batalla del lugar, para calibrar en la mesa (`npm run campo3d`). Sigue el diseño de Conquest
// (`Docs/Design/Campo_De_Batalla_Del_Lugar.md`: §3 el recorte que manda el motor, §5 los tipos de campo, §6 las reglas). El generador de
// verdad será el de C# de Conquest, con aritmética entera; este calcula con `number` y el ruido de `src/mundo3d/ruido.ts`, porque solo sirve
// para ver cómo queda el campo y cerrar las cifras.
// Coordenadas: el mundo, en u (x al este, y al sur); el campo, en metros desde su centro (x al este, y al sur).
import { chaikin } from '../../src/mundo3d/lineas';
import { anchoJunto } from '../../src/terreno/tipos';
import { probabilidades, TIPOS_DE_MATA } from '../../src/mundo3d/matas';
import { azar, manchas } from '../../src/mundo3d/ruido';

export interface P {
  x: number;
  y: number;
}

/** Las cifras de la §13 del documento (placeholders por calibrar). */
export const PARAMETROS = {
  // el zoom del campo: metros por u del mundo, el mismo en todas las batallas (autor, 2026-11-23); lo que se lee del mundo sale del lado
  escala_campo: 75,
  // pequeña: persecución (columna contra columna) y caravana pequeña; grande: campal (ejército contra ejército) y caravana grande
  lado_pequena: 600,
  distancia_pequena: 275,
  lado_grande: 1000,
  distancia_grande: 450,
  anillo_fondo: 700,
  distancia_procedencia: 2,
  relieve_minimo: 8,
  // el detalle fractal (§6.2): una base (m, por la clase de terreno), cuánto pesa la rugosidad del mundo y el largo de la octava más larga (m)
  detalle_amplitud: 2,
  detalle_rugosidad: 1,
  detalle_longitud: 400,
  // cuánto relieve propio pone cada octava por metro de largo y por unidad de pendiente del mundo (m por m)
  detalle_pendiente: 0.3,
  // lo que pesa cada octava respecto a la anterior (0,5: la mitad; más, más detalle menudo)
  detalle_persistencia: 0.5,
  acento_relieve: 1,
  radio_acento: 3,
  // la del agente del NavMesh: con el zoom, las laderas tienen la pendiente del mundo, y en el mundo se andan
  pendiente_max_transitable: 45,
  radio_placa: 25,
  relieve_colinas: 15,
  bosque_campo: 0.3,
  bosque_cerrado: 0.7,
  umbral_bosque_claro: 0.25,
  umbral_bosque_cerrado: 0.6,
  celda_bosque: 8,
  separacion_cerrado: 4,
  // el río y el vado, proporcionales al mapa de mundo (autor, 2026-11-23): sus anchos en u del mundo, por la escala del campo
  ancho_rio_mundo: 1.5,
  altura_orilla: 2,
  ancho_vado_mundo: 0.8,
  ancho_playa: 60,
  ancho_somero: 25,
  max_arboles: 6000,
  // la decoración del suelo: un hueco cada tantos metros (cada hueco, una pieza o nada según el sitio)
  paso_decoracion: 3,
  // los sotos de la llanura sin bosque: uno como mucho por celda de tantos metros, con esta probabilidad (por la fertilidad, de ×0,5 a ×1,5)
  sotos_celda: 70,
  sotos_probabilidad: 0.25,
};
export type Parametros = typeof PARAMETROS;

/** El tamaño de la batalla, por su entidad más grande (autor, 2026-11-23): columnas y caravanas sueltas o de un héroe, pequeña; con un ejército, grande. */
export type Tamano = 'pequena' | 'grande';

/** Las medidas de un tamaño: el área jugable y la distancia de cada spawn al centro (m); lo que se lee del mundo y el recorte (u), por el zoom. */
export function medidasDe(p: Parametros, tamano: Tamano): { lado_jugable: number; distancia_al_centro: number; lado_mundo: number; lado_recorte: number } {
  const lado_jugable = tamano === 'grande' ? p.lado_grande : p.lado_pequena;
  return {
    lado_jugable,
    distancia_al_centro: tamano === 'grande' ? p.distancia_grande : p.distancia_pequena,
    lado_mundo: lado_jugable / p.escala_campo,
    lado_recorte: (lado_jugable + 2 * p.anillo_fondo) / p.escala_campo,
  };
}

/** El contexto de la batalla como lo trae el ticket del motor: `solitarios` en campo abierto ya existe («persecución entre columnas
 * personales; si no, campal entre ejércitos»); en caravana es nuevo (§3). */
export interface ContextoDeBatalla {
  tipo: 'campo_abierto' | 'caravana';
  solitarios: boolean;
}
export const tamanoDe = (c: ContextoDeBatalla): Tamano => (c.solitarios ? 'pequena' : 'grande');

/** Lo que no se calibra en la mesa. */
const PASO_RELIEVE = 0.5; // u entre muestras del paquete de relieve
const PASO_ALTURAS = 2; // m entre muestras de la rejilla de alturas del campo
const CELDA_ZONAS = 4; // m por celda de la rejilla de zonas
const METROS_POR_U = 12; // la escala del mapa de mundo (`factor_unity`)
const PROFUNDIDAD_CAUCE = 1.5; // m del cauce bajo la lámina del río
const RAMPA_ORILLA = 8; // m de la orilla del río, de la lámina al suelo
const RAMPA_VADO = 15; // m de las rampas del vado
// la bajada al vado: en el pasillo del vado, la orilla se corta con una pendiente que empieza en unos 11° junto al agua y llega a unos 42°
// (por debajo de lo transitable) a tantos metros del agua
const PENDIENTE_BAJADA_VADO = 0.2;
const PENDIENTE_FIN_BAJADA = 0.9;
const BAJADA_VADO = 100;
// el embudo de la bajada (m): cuánto se abre por la orilla y a qué distancia del agua, y cuánto más por metro ladera arriba
// los vados: ninguno en el agua ni a menos de tantas u (del mundo) de un lago o del mar; y el río, que se iguala al nivel del lago o del mar
// en los últimos tantos metros
const VADO_LEJOS_DEL_AGUA = 0.75;
const IGUALAR_AL_LAGO = 120;
// vueltas de suavizado de la lámina de los ríos (cada una, a los cuatro vecinos de 2 m): unas 20 dejan los saltos en rampas de unos 40 m
const VUELTAS_LAMINA = 4;
/** El radio (m) en que se busca lo más hondo del lecho para poner el agua encima, y aquel con que se alisa el lecho. */
const RADIO_LAMINA = 12;
const RADIO_LECHO = 20;
/** Cuántos puntos de cada lado se promedian al alisar la lámina a lo largo del río: poco, para que siga al relieve. */
const SUAVE_LAMINA = 3;
const EMBUDO_ANCHO = 45;
const EMBUDO_LARGO = 25;
const EMBUDO_PENDIENTE = 0.5;
const PENDIENTE_COLINA = 12; // grados a partir de los que la zona se pinta de colina
const SEPARACION_PUNTOS = 15; // m entre los tres puntos de spawn de un bando
const DISTANCIA_MINIMA_SPAWN = 100; // m: hasta aquí se acorta `distancia_al_centro`
const PASO_ACORTE = 25; // m
const PASO_GIRO = 5; // grados
const COINCIDEN = 20; // m: dos procedencias más cerca que esto coinciden
/** Árboles por m² con el bosque al máximo: los del mapa de mundo (`PORCION` / copa² por u², `src/mundo3d/arboles.ts`, con copa de 0,5 u),
 * pasados a metros (0,55 / 6²); y la densidad desde la que hay árboles, la misma (0,2). */
const ARBOLES_POR_M2 = 0.55 / 36;
const BOSQUE_MINIMO = 0.2;
const MARGEN_DECORACION = 40; // m de decoración más allá del área jugable
const PIEDRAS_EN_EL_VADO = 0.35; // probabilidad de un canto en cada hueco de la decoración dentro del paso del vado
// el detalle fractal: el largo de la octava más corta (m), la altura máxima de cada octava por metro de largo, y la base por clase de
// terreno (veces `detalle_amplitud`): llano, más en colina, más en montaña o cima
const LARGO_MINIMO_DETALLE = 10;
const ALTO_POR_LARGO = 0.2;
const PENDIENTE_TOPE_DETALLE = 0.35; // m por m (unos 19°): la pendiente del mundo que cuenta para el detalle, como mucho
const DETALLE_LLANO = 0.5;
const DETALLE_COLINA = 1;
const DETALLE_MONTANA = 2;

export const ZONA = { llano: 0, colina: 1, bosqueClaro: 2, bosqueCerrado: 3, arena: 4, somero: 5, honda: 6, camino: 7, acantilado: 8 } as const;
export type Zona = (typeof ZONA)[keyof typeof ZONA];

export type TipoDeCampo = 'vado' | 'paso' | 'costa' | 'lago' | 'ribera' | 'colinas' | 'bosque' | 'llano';

/** Lo que el motor sabe del mundo; con esto la mesa hace el recorte que mandaría en el ticket. */
export interface Mundo {
  readonly ancho: number;
  readonly alto: number;
  alturaEn(x: number, y: number): number;
  aguaEn(x: number, y: number): boolean;
  /** ¿Es mar (no lago) el agua de (x, y)? */
  marEn(x: number, y: number): boolean;
  /** Lado de las celdas de los rasters del artefacto, en u (4). */
  readonly celda: number;
  /** `ClaseTerreno` de la celda (i, j): 1 agua, 2 costa, 3 llano, 4 colina, 5 montaña, 6 cima. */
  terrenoCelda(i: number, j: number): number;
  /** Densidad de bosque de la celda (i, j), de 0 a 255. */
  bosqueCelda(i: number, j: number): number;
  /** Fertilidad del suelo de la celda (i, j), de 0 a 255: el verdor del pasto (y, en Conquest, la vegetación). */
  fertilidadCelda(i: number, j: number): number;
  readonly rios: readonly { puntos: readonly P[]; vados?: readonly P[]; navegable?: boolean; anchos?: readonly number[] }[];
}

/** Una rejilla de muestras: la (i, j) está en (x0 + i·paso, y0 + j·paso). */
export interface Rejilla {
  x0: number;
  y0: number;
  paso: number;
  columnas: number;
  filas: number;
  datos: Float32Array;
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const suave = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** El valor en (x, y), interpolado entre las cuatro muestras de alrededor; fuera, el del borde. */
export function muestra(r: Rejilla, x: number, y: number): number {
  const fi = clamp((x - r.x0) / r.paso, 0, r.columnas - 1), fj = clamp((y - r.y0) / r.paso, 0, r.filas - 1);
  const i = Math.min(r.columnas - 2, Math.floor(fi)), j = Math.min(r.filas - 2, Math.floor(fj)), a = fi - i, b = fj - j;
  const d = r.datos, k = j * r.columnas + i;
  return (d[k]! * (1 - a) + d[k + 1]! * a) * (1 - b) + (d[k + r.columnas]! * (1 - a) + d[k + r.columnas + 1]! * a) * b;
}

/** El valor en (x, y), interpolado en bicúbico (Catmull-Rom) entre las 16 muestras de alrededor: curvas suaves, sin facetas. */
export function cubica(r: Rejilla, x: number, y: number): number {
  const fi = clamp((x - r.x0) / r.paso, 0, r.columnas - 1), fj = clamp((y - r.y0) / r.paso, 0, r.filas - 1);
  const i = Math.min(r.columnas - 2, Math.floor(fi)), j = Math.min(r.filas - 2, Math.floor(fj)), a = fi - i, b = fj - j;
  const v = (ii: number, jj: number) => r.datos[clamp(jj, 0, r.filas - 1) * r.columnas + clamp(ii, 0, r.columnas - 1)]!;
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const fila = (jj: number) => cr(v(i - 1, jj), v(i, jj), v(i + 1, jj), v(i + 2, jj), a);
  return cr(fila(j - 1), fila(j), fila(j + 1), fila(j + 2), b);
}

/** La media de caja de radio `R` muestras, en x y en y, `vueltas` veces (con dos, casi una gaussiana). */
function suavizar(d: Float32Array, n: number, m: number, R: number, vueltas: number): Float32Array {
  const at = (x: Float32Array, i: number, j: number) => x[clamp(j, 0, m - 1) * n + clamp(i, 0, n - 1)]!;
  let s = Float32Array.from(d);
  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    for (const enX of [true, false]) {
      // ventana deslizante: al avanzar una muestra entra la de delante y sale la de detrás (los bordes se repiten, como antes)
      const t = new Float32Array(n * m), largo = enX ? n : m, filas = enX ? m : n;
      for (let f = 0; f < filas; f++) {
        const lee = (q: number) => (enX ? at(s, q, f) : at(s, f, q));
        let suma = 0;
        for (let k = -R; k <= R; k++) suma += lee(k);
        for (let q = 0; q < largo; q++) {
          t[enX ? f * n + q : q * n + f] = suma / (2 * R + 1);
          suma += lee(q + R + 1) - lee(q - R);
        }
      }
      s = t;
    }
  }
  return s;
}

/**
 * Los rasgos del relieve del mundo:
 * - `acentuada`: la altura con lo que sobresale o se hunde respecto a su entorno (de radio `radio_acento`) multiplicado por `acento_relieve`
 *   (1 = como en el mundo). El conjunto no cambia: crecen las crestas y las vaguadas que el mundo ya tiene.
 * - `rugosidad`: cuánto se quiebra el relieve del mundo a la escala de sus muestras (m del mundo): la raíz de la media, en un entorno de
 *   2 muestras, de lo que cada altura se aparta de la media de sus vecinas. Dice cuánto detalle le toca a cada sitio del campo.
 */
export function rasgosDelMundo(a: Rejilla, p: Parametros): { acentuada: Rejilla; rugosidad: Rejilla; pendiente: Rejilla } {
  const n = a.columnas, m = a.filas;
  const s = suavizar(a.datos, n, m, Math.max(1, Math.round(p.radio_acento / a.paso)), 2);
  const acentuada = new Float32Array(n * m);
  for (let k = 0; k < n * m; k++) acentuada[k] = s[k]! + p.acento_relieve * (a.datos[k]! - s[k]!);
  const vecinas = suavizar(a.datos, n, m, 1, 1), cuadrados = new Float32Array(n * m);
  for (let k = 0; k < n * m; k++) cuadrados[k] = (a.datos[k]! - vecinas[k]!) ** 2;
  const rugosidad = suavizar(cuadrados, n, m, 2, 1).map(Math.sqrt);
  // la pendiente del mundo (m por m), media en un entorno de 1 u: la de la ladera, no la de cada muestra
  const at = (i: number, j: number) => a.datos[clamp(j, 0, m - 1) * n + clamp(i, 0, n - 1)]!, cruda = new Float32Array(n * m);
  for (let j = 0, k = 0; j < m; j++) {
    for (let i = 0; i < n; i++, k++) cruda[k] = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * a.paso * METROS_POR_U);
  }
  return { acentuada: { ...a, datos: acentuada }, rugosidad: { ...a, datos: rugosidad }, pendiente: { ...a, datos: suavizar(cruda, n, m, 2, 1) } };
}

/** ¿Cae el vado `v` (u del mundo) en un lago o en el mar, o a menos de `VADO_LEJOS_DEL_AGUA` u de su orilla? Ese no es un paso de río: como
 * en el mapa de mundo, el río se acaba en la orilla y no lleva vados en el agua ni pegados a ella. */
export function vadoEnAgua(r: Recorte, v: P): boolean {
  const e = VADO_LEJOS_DEL_AGUA;
  return [[0, 0], [e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, -e], [e, -e], [-e, e]].some(([dx, dy]) => cercana(r.agua, v.x + dx!, v.y + dy!) >= 1);
}

/** La muestra más cercana a (x, y). */
function cercana(r: Rejilla, x: number, y: number): number {
  const i = clamp(Math.round((x - r.x0) / r.paso), 0, r.columnas - 1), j = clamp(Math.round((y - r.y0) / r.paso), 0, r.filas - 1);
  return r.datos[j * r.columnas + i]!;
}

// ─────────────────────────── el recorte (lo que haría el motor) ───────────────────────────

export interface Recorte {
  /** El `Batalla.punto`: la posición del defensor. */
  punto: P;
  /** El centro del recorte: el punto, desplazado hacia la tierra si más de la mitad del área jugable era agua (§3). */
  centro: P;
  /** Cuánto se desplazó el centro, en u. */
  desplazamiento: number;
  /** Fracción de agua del área jugable en el punto y en el centro. */
  aguaAntes: number;
  aguaDespues: number;
  /** Alturas en metros, cada 0,5 u. */
  alturas: Rejilla;
  /** 1 donde hay agua (mar o lago), cada 0,5 u. */
  agua: Rejilla;
  /** 1 donde el agua es de mar, cada 0,5 u. */
  mar: Rejilla;
  /** Clase de terreno, bosque (0..1) y fertilidad (0..1) de las celdas de 4 u que toca el recorte, con la muestra en el centro de cada celda. */
  terreno: Rejilla;
  bosque: Rejilla;
  fertilidad: Rejilla;
  /** Los ríos que cruzan el recorte, con sus vados. */
  rios: { puntos: P[]; vados: P[]; navegable: boolean; anchos?: number[] }[];
  /** El tamaño de la batalla: decide el área jugable y lo que se lee del mundo. */
  tamano: Tamano;
}

/** La fracción de agua de un cuadrado de `lado` u centrado en `c`, por las muestras del relieve. */
export function fraccionDeAgua(m: Mundo, c: P, lado: number): number {
  const n = Math.round(lado / PASO_RELIEVE);
  let agua = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) if (m.aguaEn(c.x - lado / 2 + i * PASO_RELIEVE, c.y - lado / 2 + j * PASO_RELIEVE)) agua++;
  return agua / ((n + 1) * (n + 1));
}

/** El campo abierto es siempre terrestre (§3): con más de la mitad de agua, el menor desplazamiento (en 8 direcciones) que deja más tierra que agua. */
export function centroEnTierra(m: Mundo, punto: P, lado: number, maximo = 2 * lado): { centro: P; desplazamiento: number } {
  if (fraccionDeAgua(m, punto, lado) <= 0.5) return { centro: punto, desplazamiento: 0 };
  for (let d = PASO_RELIEVE; d <= maximo; d += PASO_RELIEVE) {
    let mejor: { c: P; f: number } | null = null;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, c = { x: punto.x + Math.cos(a) * d, y: punto.y + Math.sin(a) * d };
      const f = fraccionDeAgua(m, c, lado);
      if (f < 0.5 && (!mejor || f < mejor.f)) mejor = { c, f };
    }
    if (mejor) return { centro: mejor.c, desplazamiento: d };
  }
  return { centro: punto, desplazamiento: 0 };
}

/** ¿Corta el tramo a-b la caja? (Liang-Barsky) */
export function tramoCortaCaja(a: P, b: P, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** El recorte del lugar (§3) alrededor de `punto`, como lo mandaría el motor en el ticket. */
export function recortar(m: Mundo, punto: P, p: Parametros = PARAMETROS, tamano: Tamano = 'pequena'): Recorte {
  const med = medidasDe(p, tamano);
  const aguaAntes = fraccionDeAgua(m, punto, med.lado_mundo);
  const { centro, desplazamiento } = centroEnTierra(m, punto, med.lado_mundo);
  const L = med.lado_recorte;
  const x0 = Math.floor((centro.x - L / 2) / PASO_RELIEVE) * PASO_RELIEVE, y0 = Math.floor((centro.y - L / 2) / PASO_RELIEVE) * PASO_RELIEVE;
  const n = Math.ceil(L / PASO_RELIEVE) + 2;
  const rejilla = (): Rejilla => ({ x0, y0, paso: PASO_RELIEVE, columnas: n, filas: n, datos: new Float32Array(n * n) });
  const alturas = rejilla(), agua = rejilla(), mar = rejilla();
  for (let j = 0, k = 0; j < n; j++) {
    for (let i = 0; i < n; i++, k++) {
      const x = x0 + i * PASO_RELIEVE, y = y0 + j * PASO_RELIEVE;
      alturas.datos[k] = m.alturaEn(x, y);
      const a = m.aguaEn(x, y);
      agua.datos[k] = a ? 1 : 0;
      mar.datos[k] = a && m.marEn(x, y) ? 1 : 0;
    }
  }
  const c = m.celda, ci0 = Math.floor((centro.x - L / 2) / c), cj0 = Math.floor((centro.y - L / 2) / c);
  const cols = Math.floor((centro.x + L / 2) / c) - ci0 + 1, filas = Math.floor((centro.y + L / 2) / c) - cj0 + 1;
  const celdas = (f: (i: number, j: number) => number): Rejilla => {
    const datos = new Float32Array(cols * filas);
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) datos[j * cols + i] = f(ci0 + i, cj0 + j);
    return { x0: (ci0 + 0.5) * c, y0: (cj0 + 0.5) * c, paso: c, columnas: cols, filas, datos };
  };
  const terreno = celdas((i, j) => m.terrenoCelda(i, j)), bosque = celdas((i, j) => m.bosqueCelda(i, j) / 255), fertilidad = celdas((i, j) => m.fertilidadCelda(i, j) / 255);
  // los trozos de río que cruzan el recorte (con un tramo de más a cada lado) y los vados de dentro
  const bx0 = centro.x - L / 2, by0 = centro.y - L / 2, bx1 = centro.x + L / 2, by1 = centro.y + L / 2;
  const rios: Recorte['rios'] = [];
  for (const rio of m.rios) {
    let primero = -1, ultimo = -1;
    for (let i = 0; i + 1 < rio.puntos.length; i++) {
      if (tramoCortaCaja(rio.puntos[i]!, rio.puntos[i + 1]!, bx0 - 1, by0 - 1, bx1 + 1, by1 + 1)) {
        if (primero < 0) primero = i;
        ultimo = i + 1;
      }
    }
    if (primero < 0) continue;
    const desde = Math.max(0, primero - 1), hasta = Math.min(rio.puntos.length, ultimo + 2);
    const puntos = rio.puntos.slice(desde, hasta).map((q) => ({ ...q }));
    const vados = (rio.vados ?? []).filter((v) => v.x >= bx0 && v.x <= bx1 && v.y >= by0 && v.y <= by1).map((v) => ({ ...v }));
    rios.push({ puntos, vados, navegable: !!rio.navegable, ...(rio.anchos?.length ? { anchos: rio.anchos.slice(desde, hasta) } : {}) });
  }
  return { punto, centro, desplazamiento, aguaAntes, aguaDespues: fraccionDeAgua(m, centro, med.lado_mundo), alturas, agua, mar, terreno, bosque, fertilidad, rios, tamano };
}

// ─────────────────────────── el ticket (§3): lo único que Conquest recibe del lugar ───────────────────────────

/** Una rejilla del ticket: `valores` en orden de filas; `origen` es la primera muestra (alturas, agua) o la esquina de la primera celda (rasters). */
export interface RejillaDelTicket {
  origen: P;
  paso: number;
  columnas: number;
  filas: number;
  valores: number[];
}

/**
 * El `RecorteDelLugar` del ticket como lo propone la §3, en JSON (el motor lo mandará en protobuf). Las posiciones, en u con tres decimales
 * (el contrato viaja en milésimas). Además de la §3 lleva `punto` (la posición del defensor: sin ella, un recorte desplazado hacia la tierra
 * pierde dónde estaba el defensor) y el agua distingue mar de lago (el tipo costa contra orilla de lago).
 */
export interface TicketDelLugar {
  version: 1;
  /** Hash del artefacto de mundo del que sale el recorte. */
  mapa_id: string;
  /** El `Batalla.punto`: la posición del defensor. */
  punto: P;
  /** El centro del recorte (el punto, desplazado hacia la tierra si hacía falta). */
  centro: P;
  /** Del `ContextoEstrategico` del ticket: decide el tamaño de la batalla. */
  contexto: ContextoDeBatalla;
  recorte: {
    lado_recorte: number;
    /** Alturas en u16 sobre `metros_altura`, cada 0,5 u. */
    alturas: RejillaDelTicket & { metros_altura: number };
    /** Una cifra por muestra de las alturas: 0 tierra, 1 lago, 2 mar. */
    agua: string;
    /** Celdas de 4 u: clase de terreno, densidad de bosque y fertilidad (0..255). */
    terreno: RejillaDelTicket;
    bosque: RejillaDelTicket;
    fertilidad: RejillaDelTicket;
    /** Con `navegable`: el navegable es el doble de ancho en el mapa de mundo, y en el campo. `anchos`: el del motor en cada punto (u), si lo trae. */
    rios: { puntos: P[]; vados: P[]; navegable: boolean; anchos?: number[] }[];
    /** Vacío en la mesa: la red de caminos no está en el artefacto. */
    caminos: { escalon: string; puntos: P[] }[];
    procedencia_atacante: { punto: P; quieto: boolean };
    procedencia_defensor: { punto: P; quieto: boolean };
  };
}

const METROS_ALTURA = 1000;
const mil = (v: number) => Math.round(v * 1000) / 1000;
const punto3 = (q: P): P => ({ x: mil(q.x), y: mil(q.y) });

/** Lo que haría el motor al abrir la batalla: el recorte del lugar y de dónde llega cada bando, empaquetados en el ticket. */
export function crearTicket(m: Mundo, punto: P, procedencias: Procedencias, mapaId: string, p: Parametros = PARAMETROS, contexto: ContextoDeBatalla = { tipo: 'campo_abierto', solitarios: true }): TicketDelLugar {
  const tamano = tamanoDe(contexto), r = recortar(m, punto, p, tamano);
  const rejilla = (g: Rejilla, celdas: boolean, f: (v: number) => number): RejillaDelTicket => ({
    origen: punto3(celdas ? { x: g.x0 - g.paso / 2, y: g.y0 - g.paso / 2 } : { x: g.x0, y: g.y0 }),
    paso: g.paso,
    columnas: g.columnas,
    filas: g.filas,
    valores: Array.from(g.datos, f),
  });
  const procedencia = (q: P | null) => ({ punto: punto3(q ?? punto), quieto: !q });
  return {
    version: 1,
    mapa_id: mapaId,
    punto: punto3(punto),
    centro: punto3(r.centro),
    contexto: { ...contexto },
    recorte: {
      lado_recorte: medidasDe(p, tamano).lado_recorte,
      alturas: { ...rejilla(r.alturas, false, (v) => clamp(Math.round((v / METROS_ALTURA) * 65535), 0, 65535)), metros_altura: METROS_ALTURA },
      agua: Array.from(r.agua.datos, (a, k) => (a ? (r.mar.datos[k] ? '2' : '1') : '0')).join(''),
      terreno: rejilla(r.terreno, true, (v) => v),
      bosque: rejilla(r.bosque, true, (v) => Math.round(v * 255)),
      fertilidad: rejilla(r.fertilidad, true, (v) => Math.round(v * 255)),
      rios: r.rios.map((rio) => ({ puntos: rio.puntos.map(punto3), vados: rio.vados.map(punto3), navegable: rio.navegable, ...(rio.anchos ? { anchos: rio.anchos.map(mil) } : {}) })),
      caminos: [],
      procedencia_atacante: procedencia(procedencias.atacante),
      procedencia_defensor: procedencia(procedencias.defensor),
    },
  };
}

/** Lo que ocuparía el recorte en protobuf, en bytes (aproximado: u16 por altura, 2 bits por muestra de agua, un byte por celda, ~8 por punto). */
export function bytesEnProtobuf(t: TicketDelLugar): number {
  const r = t.recorte, puntos = r.rios.reduce((n, rio) => n + rio.puntos.length + rio.vados.length, 0) + r.caminos.reduce((n, c) => n + c.puntos.length, 0);
  return r.alturas.valores.length * 2 + Math.ceil(r.agua.length / 4) + r.terreno.valores.length + r.bosque.valores.length + (r.fertilidad?.valores.length ?? 0) + puntos * 8 + 96;
}

/** Lo que Conquest saca del ticket, sin tocar el mundo: el recorte y las procedencias. */
export function leerTicket(t: TicketDelLugar, p: Parametros = PARAMETROS): { recorte: Recorte; procedencias: Procedencias } {
  if (t.version !== 1) throw new Error(`ticket de versión ${String(t.version)}: esta mesa lee la 1`);
  const r = t.recorte;
  const rejilla = (g: RejillaDelTicket, celdas: boolean, f: (v: number) => number): Rejilla => ({
    x0: g.origen.x + (celdas ? g.paso / 2 : 0),
    y0: g.origen.y + (celdas ? g.paso / 2 : 0),
    paso: g.paso,
    columnas: g.columnas,
    filas: g.filas,
    datos: Float32Array.from(g.valores, f),
  });
  const alturas = rejilla(r.alturas, false, (v) => (v / 65535) * r.alturas.metros_altura);
  if (r.agua.length !== r.alturas.valores.length) throw new Error('el agua del ticket no casa con sus alturas');
  const agua: Rejilla = { ...alturas, datos: Float32Array.from(r.agua, (c) => (c === '0' ? 0 : 1)) };
  const mar: Rejilla = { ...alturas, datos: Float32Array.from(r.agua, (c) => (c === '2' ? 1 : 0)) };
  // un ticket de antes del contexto: pequeña
  const tamano = t.contexto ? tamanoDe(t.contexto) : 'pequena', lado = medidasDe(p, tamano).lado_mundo;
  // el agua del área jugable alrededor del punto y del centro, con las muestras del propio recorte
  const fraccion = (c: P) => {
    const n = Math.round(lado / alturas.paso);
    let a = 0;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) a += cercana(agua, c.x - lado / 2 + i * alturas.paso, c.y - lado / 2 + j * alturas.paso);
    return a / ((n + 1) * (n + 1));
  };
  const recorte: Recorte = {
    punto: t.punto,
    centro: t.centro,
    desplazamiento: mil(Math.hypot(t.centro.x - t.punto.x, t.centro.y - t.punto.y)),
    aguaAntes: fraccion(t.punto),
    aguaDespues: fraccion(t.centro),
    alturas,
    agua,
    mar,
    terreno: rejilla(r.terreno, true, (v) => v),
    bosque: rejilla(r.bosque, true, (v) => v / 255),
    // un ticket de antes de la fertilidad: media
    fertilidad: r.fertilidad ? rejilla(r.fertilidad, true, (v) => v / 255) : { ...rejilla(r.bosque, true, () => 0.5) },
    rios: r.rios.map((rio) => ({ puntos: rio.puntos.map((q) => ({ ...q })), vados: rio.vados.map((q) => ({ ...q })), navegable: !!rio.navegable, ...(rio.anchos ? { anchos: [...rio.anchos] } : {}) })),
    tamano,
  };
  const procedencia = (x: { punto: P; quieto: boolean }) => (x.quieto ? null : { ...x.punto });
  return { recorte, procedencias: { atacante: procedencia(r.procedencia_atacante), defensor: procedencia(r.procedencia_defensor) } };
}

// ─────────────────────────── el tipo de campo (§5) ───────────────────────────

export interface Lectura {
  tipo: TipoDeCampo;
  /** El vado del tipo vado (el más cercano al centro), en u. */
  vado: P | null;
  /** El río del vado, por su índice en `Recorte.rios`. */
  rioDelVado: number;
  medidas: { montana: number; pendienteMedia: number; desnivel: number; bosqueMedio: number };
}

/** El primer tipo de la tabla de la §5 que se cumple en el área jugable. */
export function leerElLugar(r: Recorte, p: Parametros = PARAMETROS): Lectura {
  const c = r.centro, h = medidasDe(p, r.tamano).lado_mundo / 2;
  const dentro = (q: P) => Math.abs(q.x - c.x) <= h && Math.abs(q.y - c.y) <= h;
  // montaña o cima, por celdas de 4 u
  let montana = 0, celdas = 0;
  for (let y = c.y - h + 0.25; y < c.y + h; y += 0.5) {
    for (let x = c.x - h + 0.25; x < c.x + h; x += 0.5) {
      celdas++;
      if (cercana(r.terreno, x, y) >= 5) montana++;
    }
  }
  // pendiente media del mundo, desnivel, bosque medio y agua, con las muestras de 0,5 u
  let pendiente = 0, n = 0, min = Infinity, max = -Infinity, bosque = 0, hayMar = false, hayLago = false;
  for (let y = c.y - h; y <= c.y + h + 1e-9; y += PASO_RELIEVE) {
    for (let x = c.x - h; x <= c.x + h + 1e-9; x += PASO_RELIEVE) {
      const a = muestra(r.alturas, x, y);
      const gx = (muestra(r.alturas, x + PASO_RELIEVE, y) - muestra(r.alturas, x - PASO_RELIEVE, y)) / (2 * PASO_RELIEVE * METROS_POR_U);
      const gy = (muestra(r.alturas, x, y + PASO_RELIEVE) - muestra(r.alturas, x, y - PASO_RELIEVE)) / (2 * PASO_RELIEVE * METROS_POR_U);
      pendiente += (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
      n++;
      min = Math.min(min, a);
      max = Math.max(max, a);
      bosque += muestra(r.bosque, x, y);
      if (cercana(r.agua, x, y) >= 1) {
        if (cercana(r.mar, x, y) >= 1) hayMar = true;
        else hayLago = true;
      }
    }
  }
  const medidas = { montana: montana / celdas, pendienteMedia: pendiente / n, desnivel: max - min, bosqueMedio: bosque / n };
  let vado: P | null = null, rioDelVado = -1, mejor = Infinity;
  for (let i = 0; i < r.rios.length; i++) {
    for (const v of r.rios[i]!.vados) {
      const d = Math.hypot(v.x - c.x, v.y - c.y);
      if (dentro(v) && d < mejor && !vadoEnAgua(r, v)) {
        vado = v;
        rioDelVado = i;
        mejor = d;
      }
    }
  }
  const rioCruza = r.rios.some((rio) => rio.puntos.some((a, i) => i + 1 < rio.puntos.length && tramoCortaCaja(a, rio.puntos[i + 1]!, c.x - h, c.y - h, c.x + h, c.y + h)));
  const base = { vado, rioDelVado, medidas };
  if (vado) return { ...base, tipo: 'vado' };
  // el paso, solo entre montañas: la pendiente media del mundo (medida cada 0,5 u) pasa de 15° en cualquier loma o costa empinada (mesa)
  if (medidas.montana >= 0.5) return { ...base, tipo: 'paso' };
  if (hayMar) return { ...base, tipo: 'costa' };
  if (hayLago) return { ...base, tipo: 'lago' };
  if (rioCruza) return { ...base, tipo: 'ribera' };
  if (medidas.desnivel > p.relieve_colinas) return { ...base, tipo: 'colinas' };
  if (medidas.bosqueMedio > p.bosque_campo) return { ...base, tipo: 'bosque' };
  return { ...base, tipo: 'llano' };
}

// ─────────────────────────── el campo (§6) ───────────────────────────

export interface Spawns {
  /** El centro de la placa de cada bando, en metros del campo. */
  atacante: P;
  defensor: P;
  /** Los puntos 1-3 (atacante) y 4-6 (defensor). */
  puntos: P[];
  /** Hacia dónde mira el eje (del defensor al atacante), unitario. */
  eje: P;
  /** Lo que hubo que girar el eje y la distancia al centro que quedó. */
  giro: number;
  distancia: number;
  /** El radio de las placas, en metros. */
  radio: number;
}

export interface Informe {
  tipo: TipoDeCampo;
  llanoForzado: boolean;
  desplazamiento: number;
  aguaAntes: number;
  aguaDespues: number;
  medidas: Lectura['medidas'];
  /** Rumbo del eje hacia el atacante, en grados (0 norte, 90 este). */
  rumbo: number;
  giro: number;
  distancia: number;
  separacion: number;
  arboles: number;
  arbolesJugables: number;
  /** Los sotos puestos donde el bosque del mundo no da árboles. */
  sotos: number;
  /** Fracción del área jugable que es acantilado. */
  acantilado: number;
  /** Desnivel del área jugable, en metros. */
  desnivel: number;
  /** Pendiente media del área jugable, en grados (para compararla con la del mundo, `medidas.pendienteMedia`). */
  pendienteCampo: number;
  /** La variación interna del área jugable (m): cuánto se aparta el relieve de su versión suavizada a unos 160 m, en media cuadrática. */
  variacion: number;
  avisos: string[];
  ms: number;
}

export interface Campo {
  /** Lado de todo el campo (jugable más el anillo) y del área jugable, en metros. */
  lado: number;
  jugable: number;
  /** Metros del campo por u del mundo. */
  escala: number;
  recorte: Recorte;
  lectura: Lectura;
  /** (n × n) alturas cada `pasoAlturas` m, desde la esquina noroeste (−lado/2, −lado/2). */
  nAlturas: number;
  pasoAlturas: number;
  alturas: Float32Array;
  /** (n × n) celdas de `celdaZonas` m, desde la misma esquina. */
  nZonas: number;
  celdaZonas: number;
  zonas: Uint8Array;
  /** Altura de la lámina de agua de cada celda de zonas; NaN sin agua. */
  superficie: Float32Array;
  /** La altura del mundo (m) de una del campo: `alturaBase + altura / zoomAltura` (las alturas del campo van con el zoom, ×6,25). */
  alturaBase: number;
  zoomAltura: number;
  /** Por celda de zonas: la densidad de bosque (0..1, con su ruido) y la distancia al agua (m). */
  bosque: Float32Array;
  aAgua: Float32Array;
  /** La decoración del suelo, cinco números por pieza: x, y (m del campo), tipo (`TIPOS_DE_MATA`: hierba, flor, mata, junco, piedra),
   * azar y fertilidad del suelo. */
  decoracion: Float32Array;
  /** Por vértice de las alturas: la lámina de agua (m; NaN en seco) y lo pisado del camino que baja a los vados (0..1). */
  lamina: Float32Array;
  pisado: Float32Array;
  /** x, y de cada árbol, en metros del campo. */
  arboles: Float32Array;
  vados: P[];
  /** Ancho del paso de los vados, en metros del campo. */
  anchoVado: number;
  spawns: Spawns | null;
  informe: Informe;
}

/** De dónde llega cada bando, en u del mundo; null si estaba quieto (su procedencia es su posición). */
export interface Procedencias {
  atacante: P | null;
  defensor: P | null;
}

/** Distancia (en metros) de cada celda a la celda marcada más cercana (chaflán 3-4, dos pasadas). */
function distanciaA(marcadas: Uint8Array, n: number, paso: number): Float32Array {
  const d = new Float32Array(n * n).fill(Infinity);
  for (let k = 0; k < n * n; k++) if (marcadas[k]) d[k] = 0;
  const recto = paso, diagonal = paso * Math.SQRT2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      let v = d[k]!;
      if (i > 0) v = Math.min(v, d[k - 1]! + recto);
      if (j > 0) {
        v = Math.min(v, d[k - n]! + recto);
        if (i > 0) v = Math.min(v, d[k - n - 1]! + diagonal);
        if (i + 1 < n) v = Math.min(v, d[k - n + 1]! + diagonal);
      }
      d[k] = v;
    }
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i;
      let v = d[k]!;
      if (i + 1 < n) v = Math.min(v, d[k + 1]! + recto);
      if (j + 1 < n) {
        v = Math.min(v, d[k + n]! + recto);
        if (i + 1 < n) v = Math.min(v, d[k + n + 1]! + diagonal);
        if (i > 0) v = Math.min(v, d[k + n - 1]! + diagonal);
      }
      d[k] = v;
    }
  }
  return d;
}

/** Componentes conexas (4 vecinos) de las celdas transitables; −1 en las que no lo son. */
function componentes(transitable: (k: number) => boolean, n: number): Int32Array {
  const comp = new Int32Array(n * n).fill(-1), cola = new Int32Array(n * n);
  let siguiente = 0;
  for (let k0 = 0; k0 < n * n; k0++) {
    if (comp[k0] !== -1 || !transitable(k0)) continue;
    let ini = 0, fin = 0;
    cola[fin++] = k0;
    comp[k0] = siguiente;
    while (ini < fin) {
      const k = cola[ini++]!, i = k % n, j = (k - i) / n;
      for (const v of [i > 0 ? k - 1 : -1, i + 1 < n ? k + 1 : -1, j > 0 ? k - n : -1, j + 1 < n ? k + n : -1]) {
        if (v >= 0 && comp[v] === -1 && transitable(v)) {
          comp[v] = siguiente;
          cola[fin++] = v;
        }
      }
    }
    siguiente++;
  }
  return comp;
}

const girar = (v: P, grados: number): P => {
  const a = (grados * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};

/** El campo de la batalla a partir del recorte y de dónde llega cada bando. */
export function generarCampo(r: Recorte, procedencias: Procedencias, p: Parametros = PARAMETROS, llanoForzado = false): Campo {
  const t0 = performance.now();
  const lectura = leerElLugar(r, p);
  const tipo: TipoDeCampo = llanoForzado ? 'llano' : lectura.tipo;
  const avisos: string[] = [];
  const med = medidasDe(p, r.tamano), J = med.lado_jugable, L = J + 2 * p.anillo_fondo, escala = p.escala_campo, c = r.centro;
  const aMundo = (x: number, y: number): P => ({ x: c.x + x / escala, y: c.y + y / escala });
  const aCampo = (w: P): P => ({ x: (w.x - c.x) * escala, y: (w.y - c.y) * escala });
  const jugable = (x: number, y: number) => Math.abs(x) <= J / 2 && Math.abs(y) <= J / 2;

  // ── relieve (§6.2): la altura del mundo, con el conjunto sin exagerar y sus rasgos (crestas y vaguadas) acentuados por `acento_relieve`,
  // interpolada en bicúbico (sin facetas de 37,5 m), menos la media; ondulación hasta `relieve_minimo`; detalle según la pendiente del mundo
  const { acentuada, rugosidad, pendiente: pendienteMundo } = rasgosDelMundo(r.alturas, p);
  // la clase de terreno, suavizada entre celdas: cuánto hay de colina y de montaña (o cima) en cada sitio, para la forma del detalle
  const deClase = (f: (c: number) => boolean): Rejilla => ({ ...r.terreno, datos: Float32Array.from(r.terreno.datos, (c) => (f(c) ? 1 : 0)) });
  const esColina = deClase((c) => c === 4), esMontana = deClase((c) => c >= 5);
  const nA = Math.round(L / PASO_ALTURAS) + 1, H = new Float32Array(nA * nA);
  const vx = (i: number) => -L / 2 + i * PASO_ALTURAS;
  let media = 0, nMedia = 0;
  for (let j = 0, k = 0; j < nA; j++) {
    for (let i = 0; i < nA; i++, k++) {
      const w = aMundo(vx(i), vx(j));
      H[k] = cubica(acentuada, w.x, w.y);
      if (jugable(vx(i), vx(j))) {
        media += H[k]!;
        nMedia++;
      }
    }
  }
  media /= nMedia;
  const rango = (a: Float32Array) => {
    let min = Infinity, max = -Infinity;
    for (let j = 0, k = 0; j < nA; j++) for (let i = 0; i < nA; i++, k++) if (jugable(vx(i), vx(j))) { min = Math.min(min, a[k]!); max = Math.max(max, a[k]!); }
    return max - min;
  };
  // el campo es un zoom sobre el sitio (autor, 2026-11-23): la altura crece lo mismo que el plano (75 m por u contra los 12 del mapa de
  // mundo), así cada ladera tiene la pendiente que tiene en el mundo, solo que más larga
  const zoom = escala / METROS_POR_U;
  for (let k = 0; k < H.length; k++) H[k] = (H[k]! - media) * zoom;
  // el ruido va en metros absolutos del lugar (la posición del mundo por la escala): el mismo sitio, el mismo ruido
  const absoluto = (i: number, j: number) => ({ X: c.x * escala + vx(i), Y: c.y * escala + vx(j) });
  const desnivelMundo = rango(H);
  if (desnivelMundo < p.relieve_minimo) {
    const onda = new Float32Array(H.length);
    for (let j = 0, k = 0; j < nA; j++) for (let i = 0; i < nA; i++, k++) { const { X, Y } = absoluto(i, j); onda[k] = manchas(X, Y, 220, 11) - 0.5; }
    const f = (p.relieve_minimo - desnivelMundo) / Math.max(1e-6, rango(onda));
    for (let k = 0; k < H.length; k++) H[k] = H[k]! + onda[k]! * f;
  }
  // ── el detalle fractal (§6.2): lomas, vaguadas y quiebros que el mundo no puede tener entre sus muestras (37,5 m en el campo). Octavas de
  // `detalle_longitud` a unos 10 m. Cuánto, en cada octava: lo empinado que es el mundo ahí por el largo de la octava (`detalle_pendiente`:
  // una ladera de 15° admite lomas de decenas de metros; el llano, casi nada), más una base por clase de terreno y la rugosidad del propio
  // mundo, repartidas entre las octavas. Qué forma: crestas en montaña y cima; ondulado en colina y llano. Cada octava, con su altura limitada
  // a una fracción de su largo, para que el detalle no llene el campo de acantilados.
  const octavas: { largo: number; peso: number }[] = [];
  for (let largo = p.detalle_longitud, peso = 1; largo >= LARGO_MINIMO_DETALLE; largo /= 2, peso *= p.detalle_persistencia) octavas.push({ largo, peso });
  const sumaPesos = octavas.reduce((s, o) => s + o.peso, 0);
  for (let j = 0, k = 0; j < nA; j++) {
    for (let i = 0; i < nA; i++, k++) {
      const { X, Y } = absoluto(i, j), w = aMundo(vx(i), vx(j));
      const colina = muestra(esColina, w.x, w.y), montana = muestra(esMontana, w.x, w.y);
      const amplitud = p.detalle_amplitud * (DETALLE_LLANO + colina * DETALLE_COLINA + montana * DETALLE_MONTANA) + p.detalle_rugosidad * muestra(rugosidad, w.x, w.y) * zoom;
      // la pendiente del mundo cuenta hasta un tope: más arriba la montaña ya es empinada y el detalle la volvería pared
      const ladera = p.detalle_pendiente * Math.min(muestra(pendienteMundo, w.x, w.y), PENDIENTE_TOPE_DETALLE);
      let suma = 0;
      octavas.forEach((o, n) => {
        // cada octava girada un ángulo distinto, para que no se vea la rejilla del ruido
        const a = n * 0.9 + 0.4, xr = X * Math.cos(a) - Y * Math.sin(a), yr = X * Math.sin(a) + Y * Math.cos(a);
        const v = manchas(xr, yr, o.largo, 20 + n), ondulado = 2 * v - 1, arista = 1 - Math.abs(ondulado);
        // la arista, de media casi cero: alta y estrecha en la cresta, ancha y baja en la vaguada
        const forma = (1 - montana) * ondulado + montana * (arista * arista - 1 / 3) * 1.5;
        suma += Math.min(ladera * o.largo + (amplitud * o.peso) / sumaPesos, o.largo * ALTO_POR_LARGO) * forma;
      });
      H[k] = H[k]! + suma;
    }
  }
  const rejillaH: Rejilla = { x0: -L / 2, y0: -L / 2, paso: PASO_ALTURAS, columnas: nA, filas: nA, datos: H };
  // por vértice: la lámina de agua (NaN en seco) y lo pisado del camino que baja al vado (0..1), para pintarlos sin escalera de celdas
  const lamina = new Float32Array(nA * nA).fill(NaN), pisado = new Float32Array(nA * nA);

  // ── agua de mar y lago (§6.3): el bit de agua suavizado; playa y franja somera por la distancia a la orilla
  const nZ = Math.round(L / CELDA_ZONAS), zc = (i: number) => -L / 2 + (i + 0.5) * CELDA_ZONAS;
  const zonas = new Uint8Array(nZ * nZ), superficie = new Float32Array(nZ * nZ).fill(NaN), esAgua = new Uint8Array(nZ * nZ), esTierra = new Uint8Array(nZ * nZ);
  for (let j = 0, k = 0; j < nZ; j++) {
    for (let i = 0; i < nZ; i++, k++) {
      const w = aMundo(zc(i), zc(j));
      esAgua[k] = muestra(r.agua, w.x, w.y) >= 0.5 ? 1 : 0;
      esTierra[k] = esAgua[k] ? 0 : 1;
    }
  }
  const dAgua = distanciaA(esAgua, nZ, CELDA_ZONAS), dTierra = distanciaA(esTierra, nZ, CELDA_ZONAS);
  const rejillaZ = (datos: Float32Array): Rejilla => ({ x0: -L / 2 + CELDA_ZONAS / 2, y0: -L / 2 + CELDA_ZONAS / 2, paso: CELDA_ZONAS, columnas: nZ, filas: nZ, datos });
  const zAgua = rejillaZ(Float32Array.from(esAgua)), zdAgua = rejillaZ(dAgua), zdTierra = rejillaZ(dTierra);
  let nivel = 0, nOrilla = 0;
  for (let j = 0, k = 0; j < nZ; j++) for (let i = 0; i < nZ; i++, k++) if (!esAgua[k] && dAgua[k]! <= 8) { nivel += muestra(rejillaH, zc(i), zc(j)); nOrilla++; }
  const hayMar = nOrilla > 0;
  nivel = hayMar ? nivel / nOrilla : 0;
  if (hayMar) {
    for (let j = 0, k = 0; j < nA; j++) {
      for (let i = 0; i < nA; i++, k++) {
        const x = vx(i), y = vx(j);
        if (muestra(zAgua, x, y) >= 0.5) {
          const dt = muestra(zdTierra, x, y);
          H[k] = nivel - (dt <= p.ancho_somero ? 0.2 + (0.6 * dt) / p.ancho_somero : 0.8 + Math.min(3, (dt - p.ancho_somero) / 8));
          lamina[k] = nivel;
        } else {
          const da = muestra(zdAgua, x, y);
          if (da < p.ancho_playa) H[k] = lerp(nivel + 0.25, Math.max(H[k]!, nivel + 0.25), suave(da / p.ancho_playa));
        }
      }
    }
    for (let k = 0; k < nZ * nZ; k++) {
      if (esAgua[k]) {
        zonas[k] = dTierra[k]! <= p.ancho_somero ? ZONA.somero : ZONA.honda;
        superficie[k] = nivel;
      }
    }
  }

  // ── ríos (§6.3, §6.4, §6.5): la polilínea, suavizada, con el ancho del mapa de mundo a la escala del campo (`ancho_rio_mundo`, el doble si
  // es navegable) y hundida; el vado, una franja somera de `ancho_vado_mundo` (también a escala), con rampas
  const vados: P[] = [];
  const esVado = new Uint8Array(nZ * nZ);
  // las celdas de la bajada al vado: el camino pisado que baja al agua
  const esBajada = new Uint8Array(nZ * nZ);
  const medioVado = (p.ancho_vado_mundo * escala) / 2;
  // la línea del río del vado de la lectura, en metros del campo: decide de qué lado del río cae cada spawn (§6.4)
  let rioDelVado: P[] = [];
  // también en el llano forzado: cae al llano con el relieve del lugar, y su agua (el mar, los lagos y los ríos) es parte de él
  {
    // por vértice y por celda: distancia al río más cercano, su medio ancho, su lámina y si cae en el tramo del vado
    // `aV`/`aZ`: lo que queda, a lo largo del río, al vado más cercano (m; Infinity sin vado)
    const dV = new Float32Array(nA * nA).fill(Infinity), mV = new Float32Array(nA * nA), lV = new Float32Array(nA * nA), aV = new Float32Array(nA * nA).fill(Infinity);
    const dZ = new Float32Array(nZ * nZ).fill(Infinity), mZ = new Float32Array(nZ * nZ), lZ = new Float32Array(nZ * nZ), aZ = new Float32Array(nZ * nZ).fill(Infinity);
    r.rios.forEach((rio, ri) => {
      // el medio ancho en cada punto: el del motor (crece aguas abajo con el caudal) o, si no lo trae, el fijo de `ancho_rio_mundo`
      const originales = rio.puntos.map(aCampo), medioFijo = ((rio.navegable ? 2 : 1) * p.ancho_rio_mundo * escala) / 2;
      const puntos = alFondoDelValle(chaikin(originales, 4, 200), rejillaH, BUSCA_FONDO_U * escala);
      const medios = puntos.map((q) => (rio.anchos?.length ? (anchoJunto({ puntos: originales, anchos: rio.anchos, navegable: rio.navegable }, q.x, q.y) * escala) / 2 : medioFijo));
      // (lo que alcanza el cauce: su orilla, de medio ancho, o las rampas del vado)
      const medioMax = Math.max(...medios), alcance = medioMax + Math.max(RAMPA_VADO, medioMax * 0.5);
      if (ri === lectura.rioDelVado) rioDelVado = puntos;
      // la lámina: la altura del suelo menos `altura_orilla`, suavizada a lo largo del río
      // el agua sigue al relieve (autor, 2026-11-25): en cada punto, `PROFUNDIDAD_CAUCE` sobre lo más hondo de su corte ya tallado (el suelo
      // menos la hondonada del cauce, ver más abajo); así el cauce se acomoda al suelo, sin pared, y siempre lleva agua en lo más hondo
      const crudo = puntos.map((q, i) => {
        const a = puntos[Math.max(0, i - 1)]!, b = puntos[Math.min(puntos.length - 1, i + 1)]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l, m = medios[i]!;
        return Math.min(...[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) =>
          muestra(rejillaH, q.x + nx * m * f, q.y + ny * m * f) - (p.altura_orilla + PROFUNDIDAD_CAUCE) * hondonadaDelCauce(Math.abs(f) * m, m))) + PROFUNDIDAD_CAUCE;
      });
      // y, al llegar a un lago o al mar, la de su agua: en los últimos `IGUALAR_AL_LAGO` m se va igualando a su nivel, sin escalón
      const lamina = crudo.map((_, i) => {
        let s = 0, n = 0;
        for (let d = -SUAVE_LAMINA; d <= SUAVE_LAMINA; d++) if (crudo[i + d] !== undefined) { s += crudo[i + d]!; n++; }
        const q = puntos[i]!;
        return hayMar ? lerp(nivel, s / n, suave(muestra(zdAgua, q.x, q.y) / IGUALAR_AL_LAGO)) : s / n;
      });
      const s: number[] = [0];
      for (let i = 1; i < puntos.length; i++) s.push(s[i - 1]! + Math.hypot(puntos[i]!.x - puntos[i - 1]!.x, puntos[i]!.y - puntos[i - 1]!.y));
      // el tramo del vado: el del vado de la lectura, o cualquier vado de este río dentro del campo
      const sVados: number[] = [];
      for (const v of rio.vados) {
        const vc = aCampo(v);
        if (Math.abs(vc.x) > L / 2 || Math.abs(vc.y) > L / 2 || vadoEnAgua(r, v)) continue;
        let mejor = Infinity, sv = 0;
        for (let i = 0; i + 1 < puntos.length; i++) {
          const a = puntos[i]!, b = puntos[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
          const t = clamp(((vc.x - a.x) * dx + (vc.y - a.y) * dy) / l2, 0, 1), d = Math.hypot(a.x + dx * t - vc.x, a.y + dy * t - vc.y);
          if (d < mejor) { mejor = d; sv = s[i]! + (s[i + 1]! - s[i]!) * t; }
        }
        sVados.push(sv);
        vados.push(vc);
      }
      // (lo que cuenta es lo que queda al borde del agua: así, donde se juntan dos ríos, manda el que cubre el punto)
      // los segmentos, en una rejilla de celdas de `cerca` m: cada punto solo mira los que pueden tocarle (más allá no hay orilla, rampa ni
      // bajada al vado que pintar)
      // (junto a un vado, todos: sus bajadas llegan lejos; ver `cercaDeUnVado`)
      const cerca = alcance + 2, rejilla = new Map<number, number[]>(), clave = (cx: number, cy: number) => cx * 100003 + cy;
      // junto a un vado: los segmentos de su cuadro (el de sus bajadas) y un poco más, no todos los del río
      const porVado = new Map<P, number[]>();
      const junto = (x: number, y: number): number[] | undefined => {
        const R = medioMax + 2 * BAJADA_VADO, v = vados.find((q) => Math.abs(x - q.x) <= R && Math.abs(y - q.y) <= R);
        if (!v) return undefined;
        let lista = porVado.get(v);
        if (!lista) {
          const M = R + BAJADA_VADO;
          lista = [];
          for (let i = 0; i + 1 < puntos.length; i++) {
            const a = puntos[i]!, b = puntos[i + 1]!;
            if (Math.max(a.x, b.x) >= v.x - M && Math.min(a.x, b.x) <= v.x + M && Math.max(a.y, b.y) >= v.y - M && Math.min(a.y, b.y) <= v.y + M) lista.push(i);
          }
          porVado.set(v, lista);
        }
        return lista;
      };
      for (let i = 0; i + 1 < puntos.length; i++) {
        const a = puntos[i]!, b = puntos[i + 1]!;
        for (let cy = Math.floor((Math.min(a.y, b.y) - cerca) / cerca); cy <= Math.floor((Math.max(a.y, b.y) + cerca) / cerca); cy++)
          for (let cx = Math.floor((Math.min(a.x, b.x) - cerca) / cerca); cx <= Math.floor((Math.max(a.x, b.x) + cerca) / cerca); cx++) {
            const c = clave(cx, cy); (rejilla.get(c) ?? rejilla.set(c, []).get(c)!).push(i);
          }
      }
      const marcar = (x: number, y: number, k: number, d: Float32Array, m: Float32Array, l: Float32Array, av: Float32Array) => {
        for (const i of junto(x, y) ?? rejilla.get(clave(Math.floor(x / cerca), Math.floor(y / cerca))) ?? []) {
          const a = puntos[i]!, b = puntos[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
          const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1), dist = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
          const medio = lerp(medios[i]!, medios[i + 1]!, t);
          if (dist - medio < d[k]! - m[k]!) {
            d[k] = dist;
            m[k] = medio;
            l[k] = lerp(lamina[i]!, lamina[i + 1]!, t);
            const sp = s[i]! + (s[i + 1]! - s[i]!) * t;
            av[k] = sVados.reduce((mn, sv) => Math.min(mn, Math.abs(sp - sv)), Infinity);
          }
        }
      };
      // solo lo que cae cerca de la caja del río y, junto a cada vado, lo que alcanzan sus bajadas
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of puntos) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
      x0 -= alcance; y0 -= alcance; x1 += alcance; y1 += alcance;
      const cercaDeUnVado = (x: number, y: number) => vados.some((v) => Math.abs(x - v.x) <= medioMax + 2 * BAJADA_VADO && Math.abs(y - v.y) <= medioMax + 2 * BAJADA_VADO);
      const dentro = (x: number, y: number) => (x >= x0 && x <= x1 && y >= y0 && y <= y1) || cercaDeUnVado(x, y);
      for (let j = 0, k = 0; j < nA; j++) for (let i = 0; i < nA; i++, k++) { const x = vx(i), y = vx(j); if (dentro(x, y)) marcar(x, y, k, dV, mV, lV, aV); }
      for (let j = 0, k = 0; j < nZ; j++) for (let i = 0; i < nZ; i++, k++) { const x = zc(i), y = zc(j); if (dentro(x, y)) marcar(x, y, k, dZ, mZ, lZ, aZ); }
    });
    // los vértices del lago o del mar (los que ya tienen lámina antes de los ríos): el borde fijo al suavizar la lámina de los ríos
    const esLagoV = Uint8Array.from(lamina, (v) => (Number.isNaN(v) ? 0 : 1));
    // los vértices del lecho de un vado (su agua es la suya, somera)
    const esVadoV = new Uint8Array(nA * nA);
    // el paso del vado, natural (autor, 2026-11-23): su medio ancho, con ondulaciones amplias (40 m, ±25 %) y menudas (12 m, ±10 %), y más
    // ancho junto a las orillas (hasta un 35 %), donde se abre el embudo de la bajada; `d`, la distancia al centro del río, y `medio`, su
    // medio ancho
    const anchoDelPaso = (x: number, y: number, d: number, medio: number) => {
      const X = c.x * escala + x, Y = c.y * escala + y;
      const onda = 1 + 0.5 * (manchas(X, Y, 40, 91) - 0.5) + 0.2 * (manchas(X, Y, 12, 92) - 0.5);
      return medioVado * onda * (1 + 0.35 * Math.min(1, d / Math.max(1, medio)) ** 2);
    };
    // el embudo de la bajada: el medio ancho del pasillo a `fuera` m del agua; el del vado junto al agua, se abre deprisa por la orilla y luego
    // despacio ladera arriba
    const embudo = (fuera: number) => medioVado + EMBUDO_ANCHO * (1 - Math.exp(-fuera / EMBUDO_LARGO)) + EMBUDO_PENDIENTE * fuera;
    // el camino pisado: más estrecho que el embudo, fuerte en el centro y junto al agua, y desvaído hacia los lados y ladera arriba (0..1)
    const pisadoDe = (av: number, fuera: number) =>
      (1 - suave((av - (medioVado * 0.8 + 0.35 * fuera)) / (12 + 0.25 * fuera))) * (1 - suave((fuera - 40) / 60));
    // la altura de la bajada a `r` m de la entrada del vado: suave junto al agua (`PENDIENTE_BAJADA_VADO`) y cada vez más empinada hasta
    // `PENDIENTE_FIN_BAJADA` a `BAJADA_VADO` m, para encontrarse con la ladera sin escalón (la integral de un paso suave)
    const subida = (r: number) => {
      const u = Math.min(1, r / BAJADA_VADO), extra = PENDIENTE_FIN_BAJADA - PENDIENTE_BAJADA_VADO;
      return PENDIENTE_BAJADA_VADO * r + extra * BAJADA_VADO * (u ** 3 - u ** 4 / 2) + Math.max(0, r - BAJADA_VADO) * extra;
    };
    // el suelo alisado (a `RADIO_LECHO` m): el lecho de un río es liso, sin los bultos del detalle (asomarían como bajíos)
    const alisado = suavizar(H, nA, nA, Math.max(1, Math.round(RADIO_LECHO / PASO_ALTURAS)), 1);
    for (let j = 0, k = 0; j < nA; j++) {
      for (let i = 0; i < nA; i++, k++) {
        const d = dV[k]!, sup = lV[k]!, medio = mV[k]!, av = aV[k]!;
        if (d === Infinity) continue;
        // donde ya hay lago o mar, el río se ha acabado: ni lámina propia; solo su cauce, que sigue hasta lo hondo (sin barra de arena en la
        // boca)
        if (!Number.isNaN(lamina[k]!)) {
          if (d <= medio) H[k] = Math.min(H[k]!, lamina[k]! - PROFUNDIDAD_CAUCE);
          continue;
        }
        const x = vx(i), y = vx(j), cercaDelVado = av <= medioVado + RAMPA_VADO, rampa = cercaDelVado ? RAMPA_VADO : RAMPA_ORILLA;
        if (d <= medio && av <= anchoDelPaso(x, y, d, medio)) {
          // el lecho del vado, de grava, a poca agua y no del todo liso
          H[k] = sup - 0.25 - 0.3 * manchas(c.x * escala + x, c.y * escala + y, 6, 93);
          lamina[k] = sup;
          esVadoV[k] = 1;
          continue;
        }
        // el cauce sigue al relieve (autor, 2026-11-25): no se lleva el suelo a una cota (eso cortaba una pared en cada orilla donde el suelo
        // quedaba por encima), sino que se le resta una hondonada suave, honda en el medio (la orilla más la hondura del cauce) y nada en el
        // borde. El corte del suelo conserva su forma y el agua se ve donde el suelo queda por debajo de ella.
        const hondonada = hondonadaDelCauce(d, medio);
        if (hondonada > 0) H[k] = lerp(H[k]!, alisado[k]!, hondonada) - (p.altura_orilla + PROFUNDIDAD_CAUCE) * hondonada;
        if (d <= medio) {
          lamina[k] = sup;
          continue;
        }
        if (cercaDelVado && d <= medio + rampa) {
          // junto al vado, la orilla baja hasta el agua: por ahí se entra
          const orilla = Math.max(H[k]!, sup + 0.2);
          H[k] = lerp(sup - 0.1, orilla, suave((d - medio) / rampa));
        }
        // la bajada al vado, en embudo: dentro del embudo la orilla baja hacia la entrada del vado (en diagonal desde los flancos, como se
        // llega andando), y en su borde se funde con la orilla de al lado
        const fuera = d - medio, ancho = embudo(fuera), borde = 15 + 0.3 * fuera;
        if (av <= ancho + borde) {
          const tope = sup - 0.1 + subida(Math.hypot(fuera, Math.max(0, av - medioVado))), w = 1 - suave((av - ancho) / borde);
          if (H[k]! > tope) H[k] = lerp(H[k]!, tope, w);
          pisado[k] = Math.max(pisado[k]!, pisadoDe(av, fuera));
        }
      }
    }
    for (let j = 0, k = 0; j < nZ; j++) {
      for (let i = 0; i < nZ; i++, k++) {
        const av = aZ[k]!;
        // el lago o el mar se quedan como son, salvo el cauce del río que entra en ellos, que es hondo
        if (esAgua[k]) {
          if (dZ[k]! <= mZ[k]!) zonas[k] = ZONA.honda;
          continue;
        }
        if (dZ[k]! <= mZ[k]!) {
          const enVado = av <= anchoDelPaso(zc(i), zc(j), dZ[k]!, mZ[k]!);
          zonas[k] = enVado ? ZONA.somero : ZONA.honda;
          esVado[k] = enVado ? 1 : 0;
          superficie[k] = lZ[k]!;
        } else if (pisadoDe(av, dZ[k]! - mZ[k]!) > 0.5) esBajada[k] = 1;
      }
    }
    // el agua sigue al cauce (autor, 2026-11-25): en cada vértice de río, `PROFUNDIDAD_CAUCE` sobre lo más hondo del lecho a su alrededor
    // (a `RADIO_LAMINA` m). Sale del suelo ya tallado, el mismo para todos los ríos: en una junta, las aguas de los dos coinciden solas (con
    // la lámina de cada río por su lado quedaban saltos de varios metros, que el alisado volvía rampas de espuma). El vado guarda la suya.
    {
      const R = Math.max(1, Math.round(RADIO_LAMINA / PASO_ALTURAS)), fila = new Float32Array(nA * nA), hondo = new Float32Array(nA * nA);
      for (let j = 0; j < nA; j++) for (let i = 0; i < nA; i++) {
        let m = Infinity;
        for (let d = Math.max(0, i - R); d <= Math.min(nA - 1, i + R); d++) m = Math.min(m, H[j * nA + d]!);
        fila[j * nA + i] = m;
      }
      for (let j = 0; j < nA; j++) for (let i = 0; i < nA; i++) {
        let m = Infinity;
        for (let d = Math.max(0, j - R); d <= Math.min(nA - 1, j + R); d++) m = Math.min(m, fila[d * nA + i]!);
        hondo[j * nA + i] = m;
      }
      for (let k = 0; k < nA * nA; k++) if (!esLagoV[k] && !esVadoV[k] && !Number.isNaN(lamina[k]!)) lamina[k] = hondo[k]! + PROFUNDIDAD_CAUCE;
    }
    // una sola lámina de agua, continua (autor, 2026-11-23: sin paredes): cada río calcula la suya por tramos, y donde se juntan dos ríos o
    // la lámina cambia de golpe quedaba un escalón con paredes. Se suaviza sobre los vértices de río, con el lago o el mar como borde fijo:
    // los saltos se vuelven rampas de agua (rápidos, con espuma en la vista) y el río empalma con el lago. El lecho baja con la lámina,
    // conservando su hondura.
    const hondura = new Float32Array(nA * nA), deRio: number[] = [];
    for (let k = 0; k < nA * nA; k++) if (!esLagoV[k] && !Number.isNaN(lamina[k]!)) { hondura[k] = lamina[k]! - H[k]!; deRio.push(k); }
    for (let vuelta = 0; vuelta < VUELTAS_LAMINA; vuelta++) {
      const antes = Float32Array.from(lamina);
      for (const k of deRio) {
        const i = k % nA, j = (k - i) / nA;
        let s = antes[k]!, n = 1;
        for (const v of [i > 0 ? k - 1 : -1, i + 1 < nA ? k + 1 : -1, j > 0 ? k - nA : -1, j + 1 < nA ? k + nA : -1]) if (v >= 0 && !Number.isNaN(antes[v]!)) { s += antes[v]!; n++; }
        lamina[k] = s / n;
      }
    }
    for (const k of deRio) H[k] = lamina[k]! - hondura[k]!;
  }

  // ── zonas de tierra: playa, pendiente (colina, acantilado) y bosque (§6.6)
  const densidad = new Float32Array(nZ * nZ);
  for (let j = 0, k = 0; j < nZ; j++) {
    for (let i = 0; i < nZ; i++, k++) {
      const w = aMundo(zc(i), zc(j));
      let d = muestra(r.bosque, w.x, w.y) + (manchas(w.x * escala, w.y * escala, 90, 13) - 0.5) * 0.35;
      densidad[k] = d;
    }
  }
  const esAguaZona = (z: number) => z === ZONA.somero || z === ZONA.honda;
  const zonasDeTierra = () => {
    for (let j = 0, k = 0; j < nZ; j++) {
      for (let i = 0; i < nZ; i++, k++) {
        if (esAguaZona(zonas[k]! as Zona)) continue;
        const x = zc(i), y = zc(j), e = CELDA_ZONAS / 2;
        const gx = (muestra(rejillaH, x + e, y) - muestra(rejillaH, x - e, y)) / (2 * e), gy = (muestra(rejillaH, x, y + e) - muestra(rejillaH, x, y - e)) / (2 * e);
        const pendiente = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
        let z: Zona = hayMar && dAgua[k]! <= p.ancho_playa ? ZONA.arena : ZONA.llano;
        if (pendiente > p.pendiente_max_transitable) z = ZONA.acantilado;
        else if (esBajada[k]) z = ZONA.camino;
        else if (z === ZONA.llano) {
          if (densidad[k]! >= p.umbral_bosque_cerrado) z = ZONA.bosqueCerrado;
          else if (densidad[k]! >= p.umbral_bosque_claro) z = ZONA.bosqueClaro;
          else if (pendiente > PENDIENTE_COLINA) z = ZONA.colina;
        }
        zonas[k] = z;
      }
    }
  };
  zonasDeTierra();

  // ── spawns (§6.8): a la misma distancia del centro, en lados opuestos del eje; cada placa se comprueba
  const celdaDe = (q: P) => {
    const i = clamp(Math.floor((q.x + L / 2) / CELDA_ZONAS), 0, nZ - 1), j = clamp(Math.floor((q.y + L / 2) / CELDA_ZONAS), 0, nZ - 1);
    return j * nZ + i;
  };
  const transitable = (k: number) => zonas[k] !== ZONA.honda && zonas[k] !== ZONA.acantilado;
  const comp = componentes(transitable, nZ), compSinVado = componentes((k) => transitable(k) && !esVado[k], nZ);
  const punto = aCampo(r.punto);
  const pa = procedencias.atacante ? aCampo(procedencias.atacante) : punto, pd = procedencias.defensor ? aCampo(procedencias.defensor) : punto;
  let eje = { x: pa.x - pd.x, y: pa.y - pd.y };
  if (Math.hypot(eje.x, eje.y) < COINCIDEN) eje = { x: pa.x - punto.x, y: pa.y - punto.y };
  if (Math.hypot(eje.x, eje.y) < COINCIDEN) {
    const a = azar(Math.round(c.x), Math.round(c.y), 31) * 2 * Math.PI;
    eje = { x: Math.cos(a), y: Math.sin(a) };
    avisos.push('los dos bandos quietos: el eje sale de la semilla del lugar');
  }
  const le = Math.hypot(eje.x, eje.y);
  eje = { x: eje.x / le, y: eje.y / le };
  // la orilla de cada bando, la de su procedencia (si cae en el campo y en tierra)
  const orillaDe = (q: P) => (Math.abs(q.x) < L / 2 && Math.abs(q.y) < L / 2 ? compSinVado[celdaDe(q)]! : -1);
  // (el quieto, la de donde está: el punto)
  const orillaA = orillaDe(pa), orillaD = orillaDe(pd);
  if (tipo === 'ribera' && orillaA >= 0 && orillaD >= 0 && orillaA !== orillaD) {
    avisos.push('los bandos llegan por orillas opuestas de un río sin vado: el mundo no da esta batalla (§6.4, §6.5)');
  }
  // con los spawns simétricos respecto al centro, un centro pegado al agua honda deja siempre uno de los dos al otro lado
  let aguaAlCentro = Infinity;
  for (let j = 0, k = 0; j < nZ; j++) for (let i = 0; i < nZ; i++, k++) if (zonas[k] === ZONA.honda) aguaAlCentro = Math.min(aguaAlCentro, Math.hypot(zc(i), zc(j)));
  if (tipo === 'ribera' && aguaAlCentro < p.radio_placa + CELDA_ZONAS) {
    avisos.push(`el centro está a ${Math.round(aguaAlCentro)} m del río: con los spawns a la misma distancia del centro y en lados opuestos, uno cae siempre al otro lado`);
  }
  const placaValida = (q: P) => {
    if (Math.abs(q.x) + p.radio_placa > J / 2 + CELDA_ZONAS || Math.abs(q.y) + p.radio_placa > J / 2 + CELDA_ZONAS) return false;
    const R = p.radio_placa;
    for (let y = q.y - R; y <= q.y + R; y += CELDA_ZONAS) {
      for (let x = q.x - R; x <= q.x + R; x += CELDA_ZONAS) {
        if (Math.hypot(x - q.x, y - q.y) > R) continue;
        const z = zonas[celdaDe({ x, y })]! as Zona;
        if (esAguaZona(z) || z === ZONA.acantilado) return false;
      }
    }
    return true;
  };
  const giros = [0];
  for (let g = PASO_GIRO; g <= 180; g += PASO_GIRO) giros.push(g, -g);
  // por qué se descartó cada par de spawns probado (para el aviso cuando no queda ninguno)
  const descartes = { placa: 0, alcance: 0, vado: 0, orilla: 0 };
  const buscarSpawns = (conOrillas: boolean, alcanzarse = true): Spawns | null => {
    for (let d = med.distancia_al_centro; d >= DISTANCIA_MINIMA_SPAWN; d -= PASO_ACORTE) {
      for (const g of giros) {
        const e = girar(eje, g), A = { x: e.x * d, y: e.y * d }, D = { x: -e.x * d, y: -e.y * d };
        if (!placaValida(A) || !placaValida(D)) { descartes.placa++; continue; }
        const ka = celdaDe(A), kd = celdaDe(D);
        if (alcanzarse && comp[ka] !== comp[kd]) { descartes.alcance++; continue; } // §6.9: cada spawn llega al otro
        if (conOrillas) {
          if (tipo === 'vado' && compSinVado[ka] === compSinVado[kd]) { descartes.vado++; continue; } // orillas opuestas
          if ((orillaA >= 0 && compSinVado[ka] !== orillaA) || (orillaD >= 0 && compSinVado[kd] !== orillaD)) { descartes.orilla++; continue; }
        }
        const n = { x: -e.y, y: e.x }, tres = (q: P) => [-1, 0, 1].map((f) => ({ x: q.x + n.x * f * SEPARACION_PUNTOS, y: q.y + n.y * f * SEPARACION_PUNTOS }));
        return { atacante: A, defensor: D, puntos: [...tres(A), ...tres(D)], eje: e, giro: g, distancia: d, radio: p.radio_placa };
      }
    }
    return null;
  };
  // §6.4, en un vado (autor, 2026-11-23): se gira sobre el centro hasta que cada spawn cae a un lado del río del vado, respetando el relieve
  // como salga: la placa solo tiene que caer en seco y el lado lo da la línea del río, no que se alcancen por tierra. El atacante, si se
  // puede, en la orilla de la que viene. Si no hay giro ni distancia que valga, las reglas de siempre.
  const ladoDelRio = (q: P) => {
    let mejor = Infinity, lado = 0;
    for (let i = 0; i + 1 < rioDelVado.length; i++) {
      const a = rioDelVado[i]!, b = rioDelVado[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / l2, 0, 1), d = Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y);
      if (d < mejor) { mejor = d; lado = Math.sign(dx * (q.y - a.y) - dy * (q.x - a.x)); }
    }
    return lado;
  };
  const placaSeca = (q: P) => {
    if (Math.abs(q.x) + p.radio_placa > J / 2 + CELDA_ZONAS || Math.abs(q.y) + p.radio_placa > J / 2 + CELDA_ZONAS) return false;
    for (let y = q.y - p.radio_placa; y <= q.y + p.radio_placa; y += CELDA_ZONAS) {
      for (let x = q.x - p.radio_placa; x <= q.x + p.radio_placa; x += CELDA_ZONAS) if (Math.hypot(x - q.x, y - q.y) <= p.radio_placa && esAguaZona(zonas[celdaDe({ x, y })]! as Zona)) return false;
    }
    return true;
  };
  const buscarEnElVado = (ladoAtacante: number): Spawns | null => {
    for (let d = med.distancia_al_centro; d >= DISTANCIA_MINIMA_SPAWN; d -= PASO_ACORTE) {
      for (const g of giros) {
        const e = girar(eje, g), A = { x: e.x * d, y: e.y * d }, D = { x: -e.x * d, y: -e.y * d };
        const la = ladoDelRio(A), ld = ladoDelRio(D);
        if (!la || !ld || la === ld || (ladoAtacante && la !== ladoAtacante) || !placaSeca(A) || !placaSeca(D)) continue;
        const n = { x: -e.y, y: e.x }, tres = (q: P) => [-1, 0, 1].map((f) => ({ x: q.x + n.x * f * SEPARACION_PUNTOS, y: q.y + n.y * f * SEPARACION_PUNTOS }));
        return { atacante: A, defensor: D, puntos: [...tres(A), ...tres(D)], eje: e, giro: g, distancia: d, radio: p.radio_placa };
      }
    }
    return null;
  };
  let spawns: Spawns | null = null;
  if (tipo === 'vado' && rioDelVado.length > 1) {
    const ladoAtacante = procedencias.atacante ? ladoDelRio(pa) : 0;
    spawns = buscarEnElVado(ladoAtacante) ?? (ladoAtacante ? buscarEnElVado(0) : null);
    if (spawns && ladoAtacante && ladoDelRio(spawns.atacante) !== ladoAtacante) avisos.push('el atacante no cae en la orilla de la que viene');
    if (spawns && comp[celdaDe(spawns.atacante)] !== comp[celdaDe(spawns.defensor)]) avisos.push('el relieve tal como sale no deja llegar por tierra de un spawn al otro');
  }
  if (!spawns) spawns = buscarSpawns(true);
  if (!spawns) {
    spawns = buscarSpawns(false);
    if (spawns) avisos.push(tipo === 'vado' ? 'el río no parte el campo en dos orillas: los bandos no quedan en orillas opuestas' : 'ningún spawn cae en la orilla de su procedencia');
  }
  if (!spawns) {
    if (!llanoForzado) {
      const llano = generarCampo(r, procedencias, p, true);
      const { placa, alcance, vado, orilla } = descartes;
      llano.informe.avisos.unshift(...avisos, `el tipo ${lectura.tipo} no dejó sitio a los spawns: cae al llano con el relieve del lugar (§6.9). Pares descartados: ${placa} por la placa (agua o acantilado), ${alcance} porque no se alcanzan, ${vado} por no quedar en orillas opuestas, ${orilla} por la orilla de su bando`);
      llano.informe.ms = performance.now() - t0;
      return llano;
    }
    // en el llano, con el agua del lugar, los bandos pueden quedar sin llegarse por tierra (un río ancho sin vado, por medio): se avisa y el
    // campo se queda como es, como en el vado (§6.4), en vez de quitarle el río
    spawns = buscarSpawns(false, false);
    avisos.push(spawns ? 'el agua del lugar no deja llegar por tierra de un spawn al otro' : 'ni el llano deja sitio a los spawns');
  }

  // ── placas llanas (§6.2, paso 5) y las zonas de tierra otra vez
  if (spawns) {
    // la placa no es un disco a nivel (en una ladera cortaba una terraza, con un anillo de talud; autor, 2026-11-25): es el plano que mejor
    // se ajusta al suelo del sitio (su altura y su pendiente media), y se funde con el relieve a lo largo de otro radio. Quita los baches y
    // sigue la ladera.
    for (const q of [spawns.atacante, spawns.defensor]) {
      const R = p.radio_placa, borde = R;
      // mínimos cuadrados de h = a + b·dx + c·dy en el disco
      let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sh = 0, sxh = 0, syh = 0;
      for (let j = 0, k = 0; j < nA; j++) for (let i = 0; i < nA; i++, k++) {
        const dx = vx(i) - q.x, dy = vx(j) - q.y;
        if (Math.hypot(dx, dy) > R) continue;
        const h = H[k]!;
        n++; sx += dx; sy += dy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; sh += h; sxh += dx * h; syh += dy * h;
      }
      if (!n) continue;
      // el disco es simétrico: las sumas cruzadas casi se anulan, pero se resuelve entero (3×3, Cramer)
      const det = (m: number[]) => m[0]! * (m[4]! * m[8]! - m[5]! * m[7]!) - m[1]! * (m[3]! * m[8]! - m[5]! * m[6]!) + m[2]! * (m[3]! * m[7]! - m[4]! * m[6]!);
      const A = [n, sx, sy, sx, sxx, sxy, sy, sxy, syy], D = det(A) || 1;
      const a = det([sh, sx, sy, sxh, sxx, sxy, syh, sxy, syy]) / D, b = det([n, sh, sy, sx, sxh, sxy, sy, syh, syy]) / D, cc = det([n, sx, sh, sx, sxx, sxh, sy, sxy, syh]) / D;
      for (let j = 0, k = 0; j < nA; j++) {
        for (let i = 0; i < nA; i++, k++) {
          const dx = vx(i) - q.x, dy = vx(j) - q.y, d = Math.hypot(dx, dy);
          if (d <= R + borde) H[k] = lerp(a + b * dx + cc * dy, H[k]!, suave((d - R) / borde));
        }
      }
    }
    zonasDeTierra();
  }

  // ── árboles (§6.6): los mismos por metro cuadrado que en el mapa de mundo, a la misma densidad (continua, desde 0,2), para que el campo se
  // parezca al sitio; fuera de agua, playa, acantilado y placas. Se prueba un hueco cada `separacion_cerrado`.
  const arboles: number[] = [];
  const sep = p.separacion_cerrado;
  const placas = spawns ? [spawns.atacante, spawns.defensor] : [];
  let arbolesJugables = 0;
  for (let y = -L / 2 + sep / 2; y < L / 2; y += sep) {
    for (let x = -L / 2 + sep / 2; x < L / 2; x += sep) {
      const k = celdaDe({ x, y }), z = zonas[k]! as Zona, d = densidad[k]!;
      const gi = Math.round((c.x * escala + x) / sep), gj = Math.round((c.y * escala + y) / sep);
      const enTierra = z !== ZONA.somero && z !== ZONA.honda && z !== ZONA.arena && z !== ZONA.acantilado;
      const prob = enTierra && d >= BOSQUE_MINIMO ? Math.min(1, ARBOLES_POR_M2 * d * sep * sep) : 0;
      if (azar(gi, gj, 21) >= prob) continue;
      const ax = x + (azar(gi, gj, 22) - 0.5) * sep * 0.8, ay = y + (azar(gi, gj, 23) - 0.5) * sep * 0.8;
      if (placas.some((q) => Math.hypot(ax - q.x, ay - q.y) < p.radio_placa + 6)) continue;
      arboles.push(ax, ay);
      if (jugable(ax, ay)) arbolesJugables++;
    }
  }
  // ── sotos (autor, 2026-11-23): donde el bosque del mundo no da árboles, de vez en cuando un grupito de 3 a 10, para que la llanura no quede
  // pelada. Uno como mucho por celda de `sotos_celda`, con más probabilidad donde el suelo es fértil; en tierra firme, fuera de las placas.
  let sotos = 0;
  const cs = p.sotos_celda;
  for (let y = -L / 2 + cs / 2; y < L / 2; y += cs) {
    for (let x = -L / 2 + cs / 2; x < L / 2; x += cs) {
      const gi = Math.round((c.x * escala + x) / cs), gj = Math.round((c.y * escala + y) / cs);
      const sx = x + (azar(gi, gj, 61) - 0.5) * cs * 0.7, sy = y + (azar(gi, gj, 62) - 0.5) * cs * 0.7, k = celdaDe({ x: sx, y: sy }), z = zonas[k]! as Zona;
      if (densidad[k]! >= BOSQUE_MINIMO || (z !== ZONA.llano && z !== ZONA.colina)) continue;
      const w = aMundo(sx, sy), fertil = muestra(r.fertilidad, w.x, w.y);
      if (azar(gi, gj, 63) >= p.sotos_probabilidad * (0.5 + fertil)) continue;
      if (placas.some((q) => Math.hypot(sx - q.x, sy - q.y) < p.radio_placa + 25)) continue;
      const cuantos = 3 + Math.floor(azar(gi, gj, 64) * 8), radio = 8 + azar(gi, gj, 65) * 12;
      for (let t = 0; t < cuantos; t++) {
        // más juntos en el centro del soto
        const a = azar(gi * 31 + t, gj, 66) * 2 * Math.PI, d = radio * Math.sqrt(azar(gi, gj * 31 + t, 67)) * 0.9;
        const ax = sx + Math.cos(a) * d, ay = sy + Math.sin(a) * d, zt = zonas[celdaDe({ x: ax, y: ay })]! as Zona;
        if (zt !== ZONA.llano && zt !== ZONA.colina && zt !== ZONA.bosqueClaro) continue;
        arboles.push(ax, ay);
        if (jugable(ax, ay)) arbolesJugables++;
      }
      sotos++;
    }
  }
  if (arbolesJugables > p.max_arboles) avisos.push(`${arbolesJugables} árboles en el área jugable: más que max_arboles (${p.max_arboles})`);

  // ── decoración del suelo (§6.6, H11): hierba, flores, matas, juncos y piedras, con las reglas del mapa de mundo (`probabilidades` de
  // `src/mundo3d/matas.ts`): por la altura del mundo, la pendiente, la fertilidad, el bosque y el agua cercana. Un hueco cada
  // `paso_decoracion` en el área jugable y un margen; nada en el agua ni en las placas. Solo se ve: no cuenta para la táctica.
  const aAgua = distanciaA(Uint8Array.from(zonas, (z) => (z === ZONA.somero || z === ZONA.honda ? 1 : 0)), nZ, CELDA_ZONAS);
  const decoracion: number[] = [], pasoDeco = p.paso_decoracion, hasta = J / 2 + MARGEN_DECORACION;
  for (let y = -hasta + pasoDeco / 2; y < hasta; y += pasoDeco) {
    for (let x = -hasta + pasoDeco / 2; x < hasta; x += pasoDeco) {
      const gi = Math.round((c.x * escala + x) / pasoDeco), gj = Math.round((c.y * escala + y) / pasoDeco);
      const ax = x + (azar(gi, gj, 5) - 0.5) * pasoDeco, ay = y + (azar(gi, gj, 7) - 0.5) * pasoDeco, k = celdaDe({ x: ax, y: ay });
      // en el paso del vado, cantos sueltos que asoman del agua; en el resto del agua, nada; en la bajada (el camino pisado), poca hierba
      if (esVado[k]) {
        if (azar(gi, gj, 11) < PIEDRAS_EN_EL_VADO) decoracion.push(ax, ay, TIPOS_DE_MATA.indexOf('piedra'), azar(gi, gj, 13), 0);
        continue;
      }
      if (zonas[k] === ZONA.somero || zonas[k] === ZONA.honda || (esBajada[k] && azar(gi, gj, 17) < 0.8)) continue;
      if (placas.some((q) => Math.hypot(ax - q.x, ay - q.y) < p.radio_placa)) continue;
      const w = aMundo(ax, ay), e = PASO_ALTURAS;
      const pendiente = Math.hypot(muestra(rejillaH, ax + e, ay) - muestra(rejillaH, ax - e, ay), muestra(rejillaH, ax, ay + e) - muestra(rejillaH, ax, ay - e)) / (2 * e);
      // la altura del mundo (para costa, colina o montaña), el agua en u del mapa de mundo (sus juncos crecen a menos de 1,2 u, unos 14 m)
      const alturaMundo = media + muestra(rejillaH, ax, ay) / zoom, f = muestra(r.fertilidad, w.x, w.y);
      const pr = probabilidades(alturaMundo, pendiente, f, clamp(densidad[k]!, 0, 1), aAgua[k]! / METROS_POR_U, manchas(c.x * escala + ax, c.y * escala + ay, 30, 77));
      let u = azar(gi, gj, 11), tipo = -1;
      for (let t = 0; t < pr.length; t++) if ((u -= pr[t]!) < 0) { tipo = t; break; }
      if (tipo >= 0) decoracion.push(ax, ay, tipo, azar(gi, gj, 13), f);
    }
  }

  // ── informe
  let acantilado = 0, celdasJugables = 0, pendienteCampo = 0;
  for (let j = 0, k = 0; j < nZ; j++) {
    for (let i = 0; i < nZ; i++, k++) {
      const x = zc(i), y = zc(j), e = CELDA_ZONAS / 2;
      if (!jugable(x, y)) continue;
      celdasJugables++;
      if (zonas[k] === ZONA.acantilado) acantilado++;
      const gx = (muestra(rejillaH, x + e, y) - muestra(rejillaH, x - e, y)) / (2 * e), gy = (muestra(rejillaH, x, y + e) - muestra(rejillaH, x, y - e)) / (2 * e);
      pendienteCampo += (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  }
  if (lectura.tipo === 'vado' && !llanoForzado && vados.length === 0) avisos.push('el vado de la lectura no cae en el campo');
  const informe: Informe = {
    tipo,
    llanoForzado,
    desplazamiento: r.desplazamiento,
    aguaAntes: r.aguaAntes,
    aguaDespues: r.aguaDespues,
    medidas: lectura.medidas,
    rumbo: spawns ? ((Math.atan2(spawns.eje.x, -spawns.eje.y) * 180) / Math.PI + 360) % 360 : NaN,
    giro: spawns?.giro ?? NaN,
    distancia: spawns?.distancia ?? NaN,
    separacion: spawns ? 2 * spawns.distancia : NaN,
    arboles: arboles.length / 2,
    arbolesJugables,
    sotos,
    acantilado: acantilado / celdasJugables,
    desnivel: rango(H),
    pendienteCampo: pendienteCampo / celdasJugables,
    variacion: variacionInterna(H, nA, (i, j) => jugable(vx(i), vx(j))),
    avisos,
    ms: performance.now() - t0,
  };
  return {
    lado: L, jugable: J, escala, recorte: r, lectura,
    nAlturas: nA, pasoAlturas: PASO_ALTURAS, alturas: H,
    nZonas: nZ, celdaZonas: CELDA_ZONAS, zonas, superficie,
    alturaBase: media, zoomAltura: zoom, bosque: densidad, aAgua, decoracion: Float32Array.from(decoracion), lamina, pisado,
    arboles: Float32Array.from(arboles), vados, anchoVado: 2 * medioVado, spawns, informe,
  };
}

/** Cuánto de la hondonada del cauce hay a `d` m de su eje (0-1): entera en todo el cauce (el agua lo cubre de orilla a orilla) y, fuera,
 * se apaga en una orilla de medio ancho de cauce (como poco `RAMPA_ORILLA` m). */
function hondonadaDelCauce(d: number, medio: number): number {
  return 1 - suave((d - medio) / Math.max(RAMPA_ORILLA, medio * 0.5));
}

/** Hasta dónde se busca el fondo del valle a cada lado del río (u del mundo): la línea del motor va por los centros de las celdas de su
 * cauce, simplificada, y se aparta de él hasta unos 30 m (2,5 u); con el zoom del campo eso son casi 200 m. */
const BUSCA_FONDO_U = 3;
/** Cuántos puntos de cada lado se promedian al suavizar lo que se mueve cada punto (para que el río no haga zigzag). */
const SUAVE_FONDO = 12;
/** Lo que tiene que subir el suelo a cada lado (m del campo) para que un mínimo cuente como fondo de valle. */
const HONDO_FONDO = 8;

/** El río por el fondo de su valle: cada punto se mueve de lado (por la normal del río), hasta `alcance` m, al punto más bajo del suelo
 * del campo; lo que se mueve se suaviza a lo largo del río. Sin esto, el río del campo corre por la ladera, junto al cauce que el mundo talló,
 * y se talla el suyo en ella: paredes a cada lado y un agua que no baja con el valle. */
function alFondoDelValle(puntos: P[], H: Rejilla, alcance: number): P[] {
  const n = puntos.length;
  if (n < 3) return puntos;
  const normal = puntos.map((_, i) => {
    const a = puntos[Math.max(0, i - 2)]!, b = puntos[Math.min(n - 1, i + 2)]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });
  const paso = Math.max(2, alcance / 40);
  // solo a un fondo de verdad: un mínimo de dentro del alcance (el suelo sube a los dos lados); en una ladera sin valle, el río no se mueve
  const crudo = puntos.map((q, i) => {
    const ts: number[] = [], hs: number[] = [];
    for (let t = -alcance; t <= alcance + 1e-9; t += paso) { ts.push(t); hs.push(muestra(H, q.x + normal[i]!.x * t, q.y + normal[i]!.y * t)); }
    let mejor = 0, bajo = Infinity;
    for (let k = 1; k + 1 < ts.length; k++) {
      if (!(hs[k]! < hs[k - 1]! && hs[k]! <= hs[k + 1]!)) continue;
      // un valle de verdad: el suelo sube como poco `HONDO_FONDO` m a cada lado (no las hondonadas del detalle)
      if (Math.max(...hs.slice(0, k)) - hs[k]! < HONDO_FONDO || Math.max(...hs.slice(k + 1)) - hs[k]! < HONDO_FONDO) continue;
      // el más bajo; a igual altura, el más cerca de la línea del motor
      if (hs[k]! < bajo - 1e-3 || (Math.abs(hs[k]! - bajo) <= 1e-3 && Math.abs(ts[k]!) < Math.abs(mejor))) { bajo = hs[k]!; mejor = ts[k]!; }
    }
    return bajo < muestra(H, q.x, q.y) ? mejor : 0;
  });
  return puntos.map((q, i) => {
    let s = 0, k = 0;
    for (let j = Math.max(0, i - SUAVE_FONDO); j <= Math.min(n - 1, i + SUAVE_FONDO); j++) { s += crudo[j]!; k++; }
    const t = s / k;
    return { x: q.x + normal[i]!.x * t, y: q.y + normal[i]!.y * t };
  });
}

/** La variación interna de una rejilla de alturas de `n × n` (cada 2 m): la media cuadrática de lo que se aparta de su versión suavizada
 * (radio de 20 muestras, dos vueltas: lomas y vaguadas de hasta unos 160 m), en las muestras donde `dentro`. */
function variacionInterna(H: Float32Array, n: number, dentro: (i: number, j: number) => boolean): number {
  const s = suavizar(H, n, n, 20, 2);
  let suma = 0, cuantas = 0;
  for (let j = 0, k = 0; j < n; j++) for (let i = 0; i < n; i++, k++) if (dentro(i, j)) { suma += (H[k]! - s[k]!) ** 2; cuantas++; }
  return Math.sqrt(suma / Math.max(1, cuantas));
}

/** La altura del campo en (x, y), en metros del campo. */
export function alturaDelCampo(campo: Campo, x: number, y: number): number {
  return muestra({ x0: -campo.lado / 2, y0: -campo.lado / 2, paso: campo.pasoAlturas, columnas: campo.nAlturas, filas: campo.nAlturas, datos: campo.alturas }, x, y);
}

/** La zona del campo en (x, y). */
export function zonaDelCampo(campo: Campo, x: number, y: number): Zona {
  const n = campo.nZonas, i = clamp(Math.floor((x + campo.lado / 2) / campo.celdaZonas), 0, n - 1), j = clamp(Math.floor((y + campo.lado / 2) / campo.celdaZonas), 0, n - 1);
  return campo.zonas[j * n + i]! as Zona;
}
