// La lectura del artefacto para la pantalla de elegir campamento (`mundo/analisisCampamento.ts`).
import { describe, expect, test } from 'vitest';
import { analizarCampamentos, edificioMilitarDe, nombresDeCampamentos, regionDe, valorarCampamentos } from '../src/mundo/analisisCampamento';
import type { MapaGenerado } from '../src/terreno';

const LISTA = ['barracon', 'galeriaDeTiro', 'caballerizas'];

describe('elegir campamento', () => {
  test('el edificio militar sale de la puerta y el índice, como en el motor', () => {
    // huella = |1230·31 + 1782·17 + 0| = 68424 → 68424 mod 3 = 0
    expect(edificioMilitarDe({ x: 1230.9, y: 1782.2 }, 0, LISTA)).toBe('barracon');
    // huella = |1541·31 + 512·17 + 1| = 56476 → 1
    expect(edificioMilitarDe({ x: 1541.4, y: 512.7 }, 1, LISTA)).toBe('galeriaDeTiro');
    expect(edificioMilitarDe({ x: 1, y: 1 }, 0, [])).toBeUndefined();
  });

  test('la región es la del área más cercana a su radio, y dos en la misma se distinguen por su rumbo', () => {
    expect(regionDe({ x: 0.53 * 2667, y: 0.27 * 2000 }, 2667, 2000).nombre).toBe('Cuenca fértil');
    expect(regionDe({ x: 0.22 * 2667, y: 0.425 * 2000 }, 2667, 2000).nombre).toBe('Península de los golfos');
    const n = nombresDeCampamentos([{ x: 0.54 * 2667 - 200, y: 0.94 * 2000 - 100 }, { x: 0.54 * 2667 + 200, y: 0.94 * 2000 }, { x: 0.12 * 2667, y: 0.08 * 2000 }], 2667, 2000);
    expect(n).toEqual(['Valle meridional (noroeste)', 'Valle meridional (este)', 'Costa boscosa']);
  });

  test('cuenta el suelo del foco, los yacimientos, el río y el vecino', () => {
    // 100 × 100 celdas de 4 u: agua en la columna de la izquierda, el resto llano fértil.
    const c = 100, celda = 4;
    const terreno = new Uint8Array(c * c).map((_, i) => (i % c < 10 ? 1 : 3));
    const fertilidad = new Uint8Array(c * c).fill(204);
    const mapa = {
      version: 1, config: { ancho: 400, alto: 400, seed: 0 }, bosques: [], parcelas: [],
      nodos: [{ id: 'nodo-0', tipo: 'cobre', rareza: 'comun', posicion: { x: 220, y: 200 }, cantidadInicial: 1 }, { id: 'nodo-1', tipo: 'estano', rareza: 'rara', posicion: { x: 200, y: 380 }, cantidadInicial: 1 }],
      rios: [{ id: 'r', puntos: [{ x: 300, y: 0 }, { x: 300, y: 400 }] }],
      campamentos: [{ id: 'campamento-0', posicion: { x: 200, y: 200 }, origen: 0 }, { id: 'campamento-1', posicion: { x: 200, y: 600 }, origen: 0 }],
      bandidos: [{ id: 'b', posicion: { x: 200, y: 100 }, nivel: 2 }],
      rasters: { terreno: { columnas: c, filas: c, celda, datos: terreno }, fertilidad: { columnas: c, filas: c, celda, datos: fertilidad } },
    } as unknown as MapaGenerado;
    const [a] = analizarCampamentos(mapa);
    expect(a!.suelo.agua).toBe(0); // el agua está a 160 u, fuera del foco
    expect(a!.suelo.llano).toBe(1);
    expect(a!.agua).toBeCloseTo(162, 0); // al centro de la última celda de agua (38, 202)
    expect(a!.fertilidad).toBeCloseTo(0.8, 2);
    expect(a!.nodos.map((n) => [n.tipo, Math.round(n.distancia)])).toEqual([['cobre', 20], ['estano', 180]]);
    expect(a!.rio).toEqual({ distancia: 100, navegable: false });
    expect(a!.bandidos.map((b) => [b.nivel, b.distancia])).toEqual([[2, 100]]);
    expect(a!.vecino).toEqual({ indice: 1, distancia: 400 });
    const [v0, v1] = valorarCampamentos(analizarCampamentos(mapa), [0, 10]);
    expect(v0!.nota).toBeGreaterThan(v1!.nota);
    expect(v0!.razones).toContain('Poca gente');
  });
});
