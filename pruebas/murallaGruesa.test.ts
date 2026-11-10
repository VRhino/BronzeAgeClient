// El muro que cruzaba la plaza en la vista 3D (Víctor, 2026-11-10): una empalizada con un rincón grueso (una celda de más en el codo) y una celda
// que sobresale junto a la puerta. `anillosDe` no la recorre de una vez, la vista cae al orden de obra del motor y ese orden deja esas celdas para
// el final: antes, cada celda se unía con la de antes y la de después de la lista, y salía un muro de punta a punta por encima de los edificios.
// Ahora cada celda se une solo con sus vecinas de la rejilla, como se ve en el 2D.
import { describe, expect, test } from 'vitest';
import { anillosDe, ciudadEnVista } from '../src/ciudad3d/estado';
import { idDeCeldaDeMuro, montarMurallas, vecinasDeMuro } from '../src/ciudad3d/murallas';
import { Piezas } from '../src/ciudad3d/piezas';
import type { Asentamiento, TrazadoAsentamiento } from '../src/tiposDominio';

const T = 3;
type C = { col: number; row: number; clase: 'muro' | 'puerta' | 'torre' };
const k = (col: number, row: number, clase: C['clase'] = 'muro'): C => ({ col: col - 5, row: row - 4, clase });
/** Un anillo de 10 × 8 celdas con el rincón de arriba a la izquierda metido hacia dentro, en el orden de obra del motor: desde la puerta (al
 * este) hacia abajo, toda la vuelta, y al final lo que el paseo se saltó: la celda que sobresale junto a la puerta y la del codo. */
const ANILLO: C[] = [
  k(9, 4, 'puerta'), k(9, 5), k(9, 6), k(9, 7),
  ...[8, 7, 6, 5, 4, 3, 2, 1, 0].map((c) => k(c, 7)),
  k(0, 6), k(0, 5, 'torre'), k(0, 4), k(0, 3),
  k(1, 3), k(2, 3), k(3, 3), k(3, 2), k(3, 1), k(3, 0),
  ...[4, 5, 6, 7, 8, 9].map((c) => k(c, 0)),
  k(9, 1), k(9, 2), k(9, 3),
  k(10, 3), // sobresale junto a la puerta: solo toca a (9, 3) y (9, 4), que ya se tocan
  k(2, 4), // la del codo, por dentro del rincón: toca a (1, 3), (2, 3) y (3, 3)
];

function ciudad(nivel: number) {
  const a = { id: 'as-1', nivel: 3, edificios: [], recintos: [{ id: 'r-1', nivel, celdas: ANILLO, avance: ANILLO.length - 1 }] } as unknown as Asentamiento;
  const t = { calles: [], caminos: [], huellas: {}, murallas: [], radio: 40, celda: T } as unknown as TrazadoAsentamiento;
  return ciudadEnVista(a, t, { instante: 0 })!;
}

describe('una muralla con un rincón grueso y una celda que sobresale', () => {
  test('el paseo de vecina en vecina no la recorre de una vez (por eso la vista caía al orden del motor)', () => {
    expect(anillosDe(ANILLO).length).toBeGreaterThan(1);
  });

  test('cada celda se une solo con sus vecinas: de lado y, en diagonal, solo si ninguna de lado las une ya', () => {
    const r = ciudad(1).recintos[0]!;
    const vecinas = vecinasDeMuro(r.celdas, T);
    const en = (col: number, row: number) => r.celdas.findIndex((c) => Math.abs(c.x - (col - 5 + 0.5) * T) < 1e-6 && Math.abs(c.y - (row - 4 + 0.5) * T) < 1e-6);
    const de = (col: number, row: number) => vecinas[en(col, row)]!.map((j) => `${Math.round(r.celdas[j]!.x / T - 0.5) + 5},${Math.round(r.celdas[j]!.y / T - 0.5) + 4}`).sort();
    expect(de(2, 4)).toEqual(['2,3']); // el codo: con la de su lado; no en diagonal con (1, 3) ni (3, 3), que ya une (2, 3)
    expect(de(2, 3)).toEqual(['1,3', '2,4', '3,3']);
    expect(de(10, 3)).toEqual(['9,3']); // la que sobresale: con la de su lado, no en diagonal con la puerta
    expect(de(9, 4)).toEqual(['9,3', '9,5']); // la puerta
    expect(de(0, 3)).toEqual(['0,4', '1,3']);
    // nadie se une con una celda que no está al lado
    vecinas.forEach((vs, i) => vs.forEach((j) => expect(Math.max(Math.abs(r.celdas[i]!.x - r.celdas[j]!.x), Math.abs(r.celdas[i]!.y - r.celdas[j]!.y))).toBeLessThanOrEqual(T + 1e-6)));
  });

  for (const nivel of [1, 2, 3]) {
    test(`nivel ${nivel}: ninguna pieza del muro sale lejos de su celda (antes, un tramo de once celdas cruzaba la plaza)`, () => {
      const c = ciudad(nivel), r = c.recintos[0]!, p = new Piezas();
      montarMurallas(p, c.recintos);
      let peor = { d: 0, que: '' };
      r.celdas.forEach((celda, i) => {
        for (const q of p.lista.filter((x) => x.de === idDeCeldaDeMuro(r.id, i))) {
          const d = Math.max(Math.abs(q.x - celda.x), Math.abs(q.z - celda.y)) + Math.max(q.ancho, q.fondo) / 2;
          if (d > peor.d) peor = { d, que: `celda ${i}: ${q.forma} ${q.ancho.toFixed(2)}` };
        }
      });
      expect(peor.d, peor.que).toBeLessThanOrEqual(1.5 * T);
    });
  }

  test('la puerta sigue con una torre a cada lado, más alta que el muro', () => {
    const c = ciudad(1), r = c.recintos[0]!, p = new Piezas();
    montarMurallas(p, c.recintos);
    const i = (col: number, row: number) => r.celdas.findIndex((x) => Math.abs(x.x - (col - 5 + 0.5) * T) < 1e-6 && Math.abs(x.y - (row - 4 + 0.5) * T) < 1e-6);
    const arriba = (j: number) => Math.max(...p.lista.filter((q) => q.de === idDeCeldaDeMuro(r.id, j)).map((q) => q.y + q.alto));
    expect(arriba(i(9, 3))).toBeGreaterThan(arriba(i(6, 0)) + 0.5);
    expect(arriba(i(9, 5))).toBeGreaterThan(arriba(i(6, 0)) + 0.5);
  });
});
