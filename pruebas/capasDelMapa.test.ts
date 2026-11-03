import { describe, expect, it } from 'vitest';
import { CAPAS_POR_DEFECTO, capasDelMapa, colorDeFertilidad, exploradoDe, fijarCapa, pixelesDeFertilidad } from '../src/mundo/capasDelMapa';
import type { ProyeccionJugador } from '../src/apiCliente';

(globalThis as Record<string, unknown>).location = { protocol: 'http:', host: 'x', hostname: 'x', search: '' };
const { clasificadorDeParcelas } = await import('../src/ui/pestanaAsentamientos');

// Las capas del mapa que se ponen y quitan (Víctor, 2026-11-03): nombres de los nodos, fertilidad y parcelas de bosque, solo sobre lo explorado.

describe('capas puestas', () => {
  it('por defecto, solo los nombres; sin almacenamiento, vale para la sesión', () => {
    expect(capasDelMapa()).toEqual(CAPAS_POR_DEFECTO);
    fijarCapa('fertilidad', true);
    expect(capasDelMapa()).toEqual({ ...CAPAS_POR_DEFECTO, fertilidad: true });
    fijarCapa('fertilidad', false);
  });
});

describe('exploradoDe', () => {
  // 3 × 2 celdas de 5 u: exploradas la (0,0) y la (2,1) → bits 0 y 5 → byte 0b00100001
  const niebla = { tamanoCelda: 5, columnas: 3, filas: 2, celdas: '21', visibles: '' };
  it('lee el bit de la celda donde cae el punto', () => {
    const e = exploradoDe(niebla);
    expect(e(1, 1)).toBe(true);
    expect(e(6, 1)).toBe(false);
    expect(e(14, 9)).toBe(true);
    expect(e(-1, 1)).toBe(false);
    expect(e(16, 1)).toBe(false);
  });
  it('sin niebla, todo explorado', () => {
    expect(exploradoDe(undefined)(999, 999)).toBe(true);
  });
});

describe('fertilidad', () => {
  it('salta de color en el corte de la aldea', () => {
    const [r1, g1] = colorDeFertilidad(0.299, 0.3), [r2, g2] = colorDeFertilidad(0.3, 0.3);
    expect(r1).toBeLessThan(215);
    expect(g2 - g1).toBeGreaterThan(60);
    // más fértil, más verde y menos rojo
    expect(colorDeFertilidad(0.9, 0.3)[0]).toBeLessThan(colorDeFertilidad(0.4, 0.3)[0]);
  });
  it('transparente en el agua y en lo no explorado', () => {
    const f = { columnas: 2, filas: 2, celda: 4, datos: Uint8Array.from([200, 200, 200, 0]) };
    const terreno = { columnas: 2, filas: 2, celda: 4, datos: Uint8Array.from([3, 1, 3, 3]) };
    const px = pixelesDeFertilidad(f, terreno, (x, y) => !(x > 4 && y > 4), 0.3);
    const alfa = [3, 7, 11, 15].map((i) => px[i]);
    expect(alfa).toEqual([160, 0, 160, 0]); // la 2.ª es agua, la 4.ª no se ha explorado
  });
});

describe('clasificadorDeParcelas', () => {
  const zona = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const p = {
    faccionId: 'mia',
    asentamientos: [],
    asentamientosAvistados: [
      { id: 'a', faccionId: 'mia', zona, edificios: [{ tipo: 'lenera', fuenteId: 'parcela-1' }] },
      { id: 'b', faccionId: 'otra', zona: zona.map((q) => ({ x: q.x + 20, y: q.y })), edificios: [] },
    ],
    asentamientosConocidos: [],
    pueblos: [],
    obrasDeMapa: [],
  } as unknown as ProyeccionJugador;
  const parcela = (id: string, x: number) => ({ id, centro: { x, y: 5 } });
  it('en la capa: con Leñera, en zona de otra Facción, o libre (también en la de tu Facción)', () => {
    const estado = clasificadorDeParcelas(p);
    expect(estado(parcela('parcela-1', 5))).toBe('ocupada');
    expect(estado(parcela('parcela-2', 3))).toBe('libre');
    expect(estado(parcela('parcela-3', 25))).toBe('ajena');
    expect(estado(parcela('parcela-4', 50))).toBe('libre');
  });
  it('al fundar, cualquier zona es ajena: la plaza nueva no puede tomarla', () => {
    expect(clasificadorDeParcelas(p, true)(parcela('parcela-2', 3))).toBe('ajena');
  });
});
