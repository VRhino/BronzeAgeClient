// Lo que rodea a cada campamento de mercenarios donde se puede nacer, sacado del artefacto de mundo (contrato 06) y de los datos de juego: la
// pantalla de elección de `crearHeroe` lo enseña para que el jugador sepa qué tierra le espera. Nada de esto lo manda el motor: es lectura del
// mismo artefacto que pinta el mapa.
import type { MapaGenerado, Point, RasterU8 } from '../terreno';

/** La tierra que el generador reparte alrededor de cada campamento (Generacion_Del_Mundo, canon 1.9c): el foco hasta 150 u y la frontera hasta 250. */
export const RADIO_FOCO = 150;
export const RADIO_FRONTERA = 250;
/** Densidad de bosque (0..255) desde la que una celda es bosque, como `pintarArtefacto.ts` y el motor. */
const UMBRAL_BOSQUE = 38;

/**
 * Las áreas del relieve regional del generador (`generador/src/regional.ts`, `crearRelieveRegional`): centro en fracción del mapa, radio en
 * unidades del generador para un mundo de 24.000 de lado corto, y nombre. La semilla mueve cada centro hasta ±1,25 % y cada radio ×0,8..1,2 y
 * el artefacto no la trae, así que el nombre sale de esta disposición nominal: cerca de una linde puede tocar el área vecina.
 */
const AREAS: readonly (readonly [number, number, number, string])[] = [
  [0.12, 0.08, 2500, 'Costa boscosa'],
  [0.55, 0.10, 3800, 'Altiplano interior'],
  [0.84, 0.12, 4500, 'Tierras altas secas'],
  [0.755, 0.51, 2300, 'Corredor levantino'],
  [0.53, 0.27, 2900, 'Cuenca fértil'],
  [0.89, 0.46, 4400, 'Gran llanura fluvial'],
  [0.95, 0.28, 2100, 'Piedemonte oriental'],
  [0.22, 0.25, 2100, 'Colinas boscosas'],
  [0.25, 0.945, 3900, 'Llanura costera meridional'],
  [0.54, 0.94, 3000, 'Valle meridional'],
  [0.91, 0.84, 4200, 'Estepa abierta'],
  [0.22, 0.425, 1500, 'Península de los golfos'],
  [0.35, 0.105, 2100, 'Tierras del estrecho'],
  [0.755, 0.78, 2500, 'Meseta del istmo'],
  [0.54, 0.76, 1900, 'Delta interior'],
  [0.88, 0.65, 2500, 'Valles orientales'],
];

/** El área regional donde cae `p`: la de más peso, `1 / (0,03 + d²³)` con `d` la distancia relativa a su radio, como `regionEn` del generador
 * (sin el ondulado de la linde, que depende de la semilla). Va en unidades estratégicas: la proporción es la misma que en las del generador. */
export function regionDe(p: Point, ancho: number, alto: number): { nombre: string; centro: Point } {
  const escala = Math.min(ancho, alto) / 24000;
  let mejor = AREAS[0]!;
  let maximo = -1;
  for (const a of AREAS) {
    const d2 = ((p.x - a[0] * ancho) ** 2 + (p.y - a[1] * alto) ** 2) / (a[2] * escala) ** 2;
    const peso = 1 / (0.03 + d2 ** 3);
    if (peso > maximo) { maximo = peso; mejor = a; }
  }
  return { nombre: mejor[3], centro: { x: mejor[0] * ancho, y: mejor[1] * alto } };
}

/** Hacia dónde queda `p` visto desde `c`, en una palabra (norte arriba: la `y` crece hacia el sur). */
function rumbo(c: Point, p: Point): string {
  const a = Math.atan2(c.y - p.y, p.x - c.x); // 0 = este, π/2 = norte
  const n = ['este', 'nordeste', 'norte', 'noroeste', 'oeste', 'suroeste', 'sur', 'sudeste'];
  return n[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]!;
}

/** Un nombre por campamento: el de su región y, si dos caen en la misma, con hacia dónde queda cada uno dentro de ella (y un número si aún chocan). */
export function nombresDeCampamentos(posiciones: readonly Point[], ancho: number, alto: number): string[] {
  const regiones = posiciones.map((p) => regionDe(p, ancho, alto));
  const nombres = regiones.map((r, i) => {
    const repetida = regiones.some((o, j) => j !== i && o.nombre === r.nombre);
    return repetida ? `${r.nombre} (${rumbo(r.centro, posiciones[i]!)})` : r.nombre;
  });
  const vistos = new Map<string, number>();
  return nombres.map((n) => {
    const k = (vistos.get(n) ?? 0) + 1;
    vistos.set(n, k);
    return nombres.filter((x) => x === n).length > 1 ? `${n} ${['I', 'II', 'III', 'IV', 'V'][k - 1] ?? k}` : n;
  });
}

/** El edificio militar de un campamento como lo deriva el motor (`Nucleo::edificio_militar`): `lista[huella mod lista]`, con
 * `huella = |⌊x⌋·31 + ⌊y⌋·17 + índice|` y `(x, y)` la puerta del campamento en unidades. */
export function edificioMilitarDe(puerta: Point, indice: number, lista: readonly string[]): string | undefined {
  if (!lista.length) return undefined;
  const huella = Math.abs(Math.floor(puerta.x) * 31 + Math.floor(puerta.y) * 17 + indice);
  return lista[huella % lista.length];
}

/** Las clases de terreno que se cuentan (`ClaseTerreno`): la cima va con la montaña. */
export type ClaseDeSuelo = 'agua' | 'costa' | 'llano' | 'colina' | 'montana';
const CLASE: Record<number, ClaseDeSuelo> = { 1: 'agua', 2: 'costa', 3: 'llano', 4: 'colina', 5: 'montana', 6: 'montana' };

export interface Cercano { tipo: string; posicion: Point; distancia: number }

export interface AnalisisCampamento {
  /** Su índice en el artefacto: el N de `camp-N`. */
  indice: number;
  posicion: Point;
  /** Fracción de celdas de cada clase dentro del foco. */
  suelo: Record<ClaseDeSuelo, number>;
  /** Fertilidad media de la tierra firme del foco, 0..1. */
  fertilidad: number;
  /** Fracción de la tierra firme del foco que es bosque. */
  bosque: number;
  /** Yacimientos hasta la frontera, del más cercano al más lejano. */
  nodos: Cercano[];
  /** El tramo de río más cercano hasta la frontera. */
  rio: { distancia: number; navegable: boolean } | null;
  /** La celda de agua (mar o lago) más cercana hasta la frontera. */
  agua: number | null;
  /** Los campamentos de bandidos con que nace el mundo hasta la frontera, del más cercano al más lejano (`tipo` = su nivel). */
  bandidos: (Cercano & { nivel: number })[];
  /** El campamento de mercenarios más cercano. */
  vecino: { indice: number; distancia: number } | null;
}

const distancia = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Distancia de `p` al segmento `ab`. */
function aSegmento(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Recorre las celdas de `r` cuyo centro cae a `radio` o menos de `c`. */
function celdasEnCirculo(r: RasterU8, c: Point, radio: number, f: (valor: number, d: number, i: number) => void): void {
  const c0 = Math.max(0, Math.floor((c.x - radio) / r.celda)), c1 = Math.min(r.columnas - 1, Math.floor((c.x + radio) / r.celda));
  const f0 = Math.max(0, Math.floor((c.y - radio) / r.celda)), f1 = Math.min(r.filas - 1, Math.floor((c.y + radio) / r.celda));
  for (let fila = f0; fila <= f1; fila++) {
    const y = (fila + 0.5) * r.celda;
    for (let col = c0; col <= c1; col++) {
      const d = Math.hypot((col + 0.5) * r.celda - c.x, y - c.y);
      if (d <= radio) { const i = fila * r.columnas + col; f(r.datos[i]!, d, i); }
    }
  }
}

/** Lo que rodea a cada campamento del artefacto, en su orden. */
export function analizarCampamentos(mapa: MapaGenerado): AnalisisCampamento[] {
  const campamentos = mapa.campamentos ?? [];
  const terreno = mapa.rasters?.terreno;
  const fertilidad = mapa.rasters?.fertilidad;
  const bosque = mapa.rasters?.densidadBosque;
  return campamentos.map((c, indice) => {
    const p = c.posicion;
    const suelo: Record<ClaseDeSuelo, number> = { agua: 0, costa: 0, llano: 0, colina: 0, montana: 0 };
    let total = 0, firme = 0, sumaFertilidad = 0, deBosque = 0;
    let agua: number | null = null;
    if (terreno) {
      celdasEnCirculo(terreno, p, RADIO_FRONTERA, (v, d, i) => {
        if (v === 1 && (agua === null || d < agua)) agua = d;
        if (d > RADIO_FOCO) return;
        const clase = CLASE[v];
        if (!clase) return;
        total++;
        suelo[clase]++;
        if (v <= 1) return;
        firme++;
        // Los tres rasters comparten rejilla en el artefacto; si no, se busca la celda por posición.
        const x = ((i % terreno.columnas) + 0.5) * terreno.celda, y = (Math.floor(i / terreno.columnas) + 0.5) * terreno.celda;
        if (fertilidad) sumaFertilidad += valorEn(fertilidad, x, y, i, terreno);
        if (bosque && valorEn(bosque, x, y, i, terreno) >= UMBRAL_BOSQUE) deBosque++;
      });
    }
    for (const k of Object.keys(suelo) as ClaseDeSuelo[]) suelo[k] = total ? suelo[k] / total : 0;
    const nodos = mapa.nodos
      .map((n) => ({ tipo: n.tipo, posicion: n.posicion, distancia: distancia(p, n.posicion) }))
      .filter((n) => n.distancia <= RADIO_FRONTERA)
      .sort((a, b) => a.distancia - b.distancia);
    let rio: AnalisisCampamento['rio'] = null;
    for (const r of mapa.rios) for (let k = 1; k < r.puntos.length; k++) {
      const d = aSegmento(p, r.puntos[k - 1]!, r.puntos[k]!);
      if (d <= RADIO_FRONTERA && (!rio || d < rio.distancia)) rio = { distancia: d, navegable: Boolean(r.navegable) };
    }
    const bandidos = (mapa.bandidos ?? [])
      .map((b) => ({ tipo: 'bandidos', posicion: b.posicion, nivel: b.nivel, distancia: distancia(p, b.posicion) }))
      .filter((b) => b.distancia <= RADIO_FRONTERA)
      .sort((a, b) => a.distancia - b.distancia);
    let vecino: AnalisisCampamento['vecino'] = null;
    campamentos.forEach((o, j) => {
      const d = distancia(p, o.posicion);
      if (j !== indice && (!vecino || d < vecino.distancia)) vecino = { indice: j, distancia: d };
    });
    return { indice, posicion: p, suelo, fertilidad: firme ? sumaFertilidad / firme / 255 : 0, bosque: firme ? deBosque / firme : 0, nodos, rio, agua, bandidos, vecino };
  });
}

function valorEn(r: RasterU8, x: number, y: number, i: number, rejilla: RasterU8): number {
  if (r.columnas === rejilla.columnas && r.filas === rejilla.filas) return r.datos[i]!;
  const c = Math.min(r.columnas - 1, Math.max(0, Math.floor(x / r.celda)));
  const f = Math.min(r.filas - 1, Math.max(0, Math.floor(y / r.celda)));
  return r.datos[f * r.columnas + c]!;
}

/** Peso de cada yacimiento al valorar un sitio: los metales del bronce y el oro más que la piedra y el ganado. */
const PESO_NODO: Record<string, number> = { cobre: 2, estano: 3, hierro: 1.5, oro: 2, piedra: 1, livestock: 1 };

export interface Valoracion {
  /** 0..1, comparada con los demás campamentos. */
  nota: number;
  /** Las razones a favor que más pesan, en pocas palabras. */
  razones: string[];
}

/**
 * Una nota por campamento para el «Recomendado» y «Elegir por mí»: poca gente, tierra fértil, yacimientos en el foco, pocos bandidos y agua
 * cerca, cada cosa comparada con los demás campamentos (0 el peor, 1 el mejor). Es una ayuda del cliente: el motor no valora nada.
 */
export function valorarCampamentos(analisis: readonly AnalisisCampamento[], gente: readonly number[]): Valoracion[] {
  const factores = analisis.map((a, i) => ({
    gente: -(gente[i] ?? 0),
    fertilidad: a.fertilidad,
    // Que haya de cada tipo pesa más que el montón: hasta tres de un tipo cuentan, los demás no suman.
    yacimientos: Object.entries(PESO_NODO).reduce((s, [tipo, peso]) => s + peso * Math.min(3, a.nodos.filter((n) => n.tipo === tipo && n.distancia <= RADIO_FOCO).length) / 3, 0),
    bandidos: -a.bandidos.filter((b) => b.distancia <= RADIO_FOCO).reduce((s, b) => s + b.nivel, 0),
    agua: (a.rio ? 1 - a.rio.distancia / RADIO_FRONTERA : 0) + (a.agua !== null ? 0.5 * (1 - a.agua / RADIO_FRONTERA) : 0),
  }));
  const pesos = { gente: 0.3, fertilidad: 0.25, yacimientos: 0.25, bandidos: 0.1, agua: 0.1 } as const;
  const texto = { gente: 'Poca gente', fertilidad: 'Tierra fértil', yacimientos: 'Yacimientos cerca', bandidos: 'Pocos bandidos', agua: 'Agua cerca' } as const;
  type Clave = keyof typeof pesos;
  const claves = Object.keys(pesos) as Clave[];
  const rango = Object.fromEntries(claves.map((k) => {
    const v = factores.map((f) => f[k]);
    return [k, [Math.min(...v), Math.max(...v)]];
  })) as Record<Clave, [number, number]>;
  const normal = (k: Clave, v: number): number => (rango[k][1] > rango[k][0] ? (v - rango[k][0]) / (rango[k][1] - rango[k][0]) : 0.5);
  return factores.map((f) => {
    const n = claves.map((k) => ({ k, v: normal(k, f[k]) }));
    const nota = n.reduce((s, x) => s + x.v * pesos[x.k], 0);
    const razones = n.filter((x) => x.v >= 0.6 && rango[x.k][1] > rango[x.k][0]).sort((a, b) => b.v * pesos[b.k] - a.v * pesos[a.k]).slice(0, 2).map((x) => texto[x.k]);
    return { nota, razones };
  });
}
