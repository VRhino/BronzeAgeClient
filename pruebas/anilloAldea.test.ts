// El anillo de la siguiente aldea (motor 5907aa6): con el cupo 2/3/4/5/6 y los techos 10/15/20/25/30 u (los de sin datos), las dos primeras
// hasta 10 u, la tercera de 10 a 15 u, la cuarta de 15 a 20 u.
import { describe, expect, it } from 'vitest';

(globalThis as Record<string, unknown>).location = { protocol: 'http:', host: 'x', hostname: 'x', search: '' };
(globalThis as Record<string, unknown>).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { anilloDeAldea } = await import('../src/ui/pueblos');

const plaza = { id: 'as-1', posicion: { x: 0, y: 0 } };
const con = (aldeas: number, obras = 0) => ({
  pueblos: Array.from({ length: aldeas }, (_, i) => ({ id: `pueblo-${i}`, propio: true, madreId: 'as-1', tipo: 'aldeaAgricola' })),
  obrasDeMapa: Array.from({ length: obras }, (_, i) => ({ id: `obra-${i}`, propia: true, madreId: 'as-1', tipo: 'aldea' })),
});

describe('anillo de la siguiente aldea', () => {
  it('las dos primeras hasta 10 u', () => {
    expect(anilloDeAldea(con(0) as never, plaza as never)).toEqual({ desde: 0, hasta: 10 });
    expect(anilloDeAldea(con(1) as never, plaza as never)).toEqual({ desde: 0, hasta: 10 });
  });
  it('la tercera de 10 a 15 u, contando las obras', () => {
    expect(anilloDeAldea(con(1, 1) as never, plaza as never)).toEqual({ desde: 10, hasta: 15 });
  });
  it('la cuarta de 15 a 20 u', () => {
    expect(anilloDeAldea(con(3) as never, plaza as never)).toEqual({ desde: 15, hasta: 20 });
  });
});
