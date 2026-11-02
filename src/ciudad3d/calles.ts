// La red de calles de la plaza, celda a celda. El motor manda las calles y los caminos troceados en tiras (`trazado.calles`, `trazado.caminos`:
// rectángulos de una celda de alto, así que una calle que baja llega como una pila de cuadrados). Aquí se vuelven a juntar: cada celda de calle
// sabe con qué vecinas se une (norte, sur, este, oeste) y, de ahí, si es tramo recto, esquina, cruce en T, cruce en X, final o suelta; si está
// en una explanada (un bloque de 2 × 2 celdas de calle); y cuánto se usa, que separa las calles principales de los callejones. Nada de esto
// toca el trazado: solo decide cómo se pinta cada celda que el motor ya dio por calle.
import { hash3 } from './estado';
import type { RectanguloLocal } from '../tiposDominio';

/** Los lados de una celda, en bits: este, sur, oeste, norte (x crece al este, y al sur). Girar 90° en el sentido del reloj: E → S → O → N. */
export const LADO = { E: 1, S: 2, O: 4, N: 8 } as const;

/** La forma de la red en una celda, en su postura de dibujo (con los lados de `FORMA_BASE`); `giro` la lleva a la de la celda. */
export type FormaDeCalle = 'suelta' | 'final' | 'recta' | 'esquina' | 't' | 'x';

/** Los lados unidos de cada forma en su postura de dibujo (giro 0): final al este, recta este-oeste, esquina este-sur, T este-sur-oeste. */
export const FORMA_BASE: Record<FormaDeCalle, number> = { suelta: 0, final: LADO.E, recta: LADO.E | LADO.O, esquina: LADO.E | LADO.S, t: LADO.E | LADO.S | LADO.O, x: 15 };

export type ClaseDeCalle = 'principal' | 'callejon' | 'explanada' | 'senda';

export interface CeldaDeCalle {
  /** Columna y fila de la celda (la celda va de `c·T` a `(c+1)·T`). */
  c: number;
  f: number;
  /** Los lados por los que sigue la red (bits de `LADO`). */
  lados: number;
  forma: FormaDeCalle;
  /** Cuartos de vuelta, en el sentido del reloj, de la postura de dibujo a la de la celda (0 a 3). */
  giro: number;
  clase: ClaseDeCalle;
  /** Cuánto se usa, de 0 a 1 (la raíz de los recorridos que pasan, relativa al más usado). */
  uso: number;
  semilla: number;
}

/** Gira unos lados `k` cuartos de vuelta en el sentido del reloj. */
export const girarLados = (lados: number, k: number): number => {
  let m = lados & 15;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};

/** La forma y el giro que dan esos lados. */
export function formaDe(lados: number): { forma: FormaDeCalle; giro: number } {
  for (const forma of ['x', 't', 'esquina', 'recta', 'final', 'suelta'] as const) {
    for (let giro = 0; giro < 4; giro++) if (girarLados(FORMA_BASE[forma], giro) === lados) return { forma, giro };
  }
  return { forma: 'suelta', giro: 0 };
}

const VECINOS = [[1, 0, LADO.E], [0, 1, LADO.S], [-1, 0, LADO.O], [0, -1, LADO.N]] as const;

/**
 * La red de calles y caminos, celda a celda.
 * - `edificios`: las huellas, para saber por qué celda se sale de cada uno a la calle (cuentan como uso: los que no son viviendas, el triple).
 * - `centro`: de dónde salen y adónde llegan todos los recorridos (el centro urbano); `salidas`: las puertas de la muralla, en ul. Las celdas de
 *   calle que tocan un camino también son salidas, y pesan como medio barrio.
 */
export function redDeCalles(
  calles: readonly RectanguloLocal[],
  caminos: readonly RectanguloLocal[],
  T: number,
  o: { edificios?: readonly (RectanguloLocal & { tipo: string })[]; centro?: { x: number; y: number }; salidas?: readonly { x: number; y: number }[] } = {}
): CeldaDeCalle[] {
  const clave = (c: number, f: number): string => `${c},${f}`;
  const tipo = new Map<string, 'calle' | 'camino'>();
  const llenar = (r: RectanguloLocal, que: 'calle' | 'camino'): void => {
    const c0 = Math.floor(r.x / T + 1e-6), c1 = Math.ceil((r.x + r.ancho) / T - 1e-6) - 1, f0 = Math.floor(r.y / T + 1e-6), f1 = Math.ceil((r.y + r.alto) / T - 1e-6) - 1;
    for (let c = c0; c <= c1; c++) for (let f = f0; f <= f1; f++) if (que === 'calle' || !tipo.has(clave(c, f))) tipo.set(clave(c, f), que);
  };
  for (const r of caminos) llenar(r, 'camino');
  for (const r of calles) llenar(r, 'calle');
  const celdas = [...tipo.keys()].map((k) => k.split(',').map(Number) as [number, number]);
  const es = (c: number, f: number): boolean => tipo.has(clave(c, f));

  // los recorridos: un árbol de caminos más cortos desde el centro por las calles (los caminos de fuera no cuentan para el uso)
  const deCalle = celdas.filter(([c, f]) => tipo.get(clave(c, f)) === 'calle');
  const masCerca = (p: { x: number; y: number }, lista: [number, number][]): [number, number] | undefined => {
    let mejor: [number, number] | undefined, d = Infinity;
    for (const k of lista) {
      const e = Math.hypot((k[0] + 0.5) * T - p.x, (k[1] + 0.5) * T - p.y);
      if (e < d) { d = e; mejor = k; }
    }
    return mejor;
  };
  const padre = new Map<string, string | null>();
  const raiz = masCerca(o.centro ?? { x: 0, y: 0 }, deCalle);
  if (raiz) {
    padre.set(clave(...raiz), null);
    const cola = [raiz];
    for (let i = 0; i < cola.length; i++) {
      const [c, f] = cola[i]!;
      for (const [dc, df] of VECINOS) {
        const k = clave(c + dc, f + df);
        if (tipo.get(k) !== 'calle' || padre.has(k)) continue;
        padre.set(k, clave(c, f));
        cola.push([c + dc, f + df]);
      }
    }
  }
  const uso = new Map<string, number>();
  const recorrer = (desde: string | undefined, peso: number): void => {
    for (let k = desde; k !== undefined && k !== null && padre.has(k); k = padre.get(k) ?? undefined) uso.set(k, (uso.get(k) ?? 0) + peso);
  };
  // de cada edificio, la celda de calle que lo toca más cerca de su centro
  for (const e of o.edificios ?? []) {
    const c0 = Math.floor(e.x / T + 1e-6) - 1, c1 = Math.ceil((e.x + e.ancho) / T - 1e-6), f0 = Math.floor(e.y / T + 1e-6) - 1, f1 = Math.ceil((e.y + e.alto) / T - 1e-6);
    const borde: [number, number][] = [];
    for (let c = c0; c <= c1; c++) for (let f = f0; f <= f1; f++) {
      const dentro = c > c0 && c < c1 && f > f0 && f < f1, esquina = (c === c0 || c === c1) && (f === f0 || f === f1);
      if (!dentro && !esquina && tipo.get(clave(c, f)) === 'calle') borde.push([c, f]);
    }
    const k = masCerca({ x: e.x + e.ancho / 2, y: e.y + e.alto / 2 }, borde);
    if (k) recorrer(clave(...k), e.tipo === 'vivienda' ? 1 : 3);
  }
  // las salidas: las puertas de la muralla y lo que lleva a los caminos de fuera
  const barrio = Math.max(4, (o.edificios?.length ?? 0) / 4);
  for (const p of o.salidas ?? []) { const k = masCerca(p, deCalle); if (k) recorrer(clave(...k), barrio); }
  for (const [c, f] of deCalle) if (VECINOS.some(([dc, df]) => tipo.get(clave(c + dc, f + df)) === 'camino')) recorrer(clave(c, f), barrio / 2);

  const mayor = Math.max(1, ...uso.values());
  const explanada = (c: number, f: number): boolean =>
    [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a, b]) => es(c + a!, f + b!) && es(c + a! + 1, f + b!) && es(c + a!, f + b! + 1) && es(c + a! + 1, f + b! + 1));

  return celdas.map(([c, f]) => {
    let lados = 0;
    for (const [dc, df, l] of VECINOS) if (es(c + dc, f + df)) lados |= l;
    const { forma, giro } = formaDe(lados);
    const u = Math.sqrt((uso.get(clave(c, f)) ?? 0) / mayor);
    const clase: ClaseDeCalle = tipo.get(clave(c, f)) === 'camino' ? 'senda' : explanada(c, f) ? 'explanada' : u >= 0.3 ? 'principal' : 'callejon';
    return { c, f, lados, forma, giro, clase, uso: u, semilla: Math.floor(hash3(c, f, 53) * 1e9) };
  });
}
