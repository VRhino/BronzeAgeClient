// La puerta es todo el contorno (motor 23-11-2026, «Tamaños y distancias del mapa», tanda 2): a `radioPuerta` (1) o menos del BORDE del lugar, con
// el radio de `TAMANOS_MAPA` (plaza por nivel y muralla, campamento, aldea por nivel, avanzada por etapa).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, radioDePuerta: () => 1 }));
const { aLaPuerta, distanciaAlBorde, radioDelLugarEn, radioDePlaza } = await import('../src/ui/puerta');

const plaza = (nivel: number, extra: object = {}) => ({ id: 'as-1', posicion: { x: 100, y: 100 }, nivel, ...extra });
const proy = (extra: object = {}) => ({ asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], campamentosMercenarios: [], pueblos: [], avanzadas: [], obrasDeMapa: [], campamentosBandidos: [], ...extra }) as never;

describe('la puerta es el contorno', () => {
  it('el radio de la plaza sube con el nivel y con la muralla', () => {
    expect(radioDePlaza(1, false)).toBe(1.49);
    expect(radioDePlaza(5, false)).toBe(7.2);
    expect(radioDePlaza(5, true)).toBe(8.05);
  });
  it('una plaza de nivel 3: a 6,5 del centro ya es la puerta (borde a 5,6); a 7 no', () => {
    const p = proy({ asentamientos: [plaza(3)] });
    expect(aLaPuerta(p, { x: 106.5, y: 100 }, { x: 100, y: 100 })).toBe(true);
    expect(aLaPuerta(p, { x: 107, y: 100 }, { x: 100, y: 100 })).toBe(false);
    expect(aLaPuerta(p, { x: 100, y: 93.5 }, { x: 100, y: 100 })).toBe(true); // por cualquier lado
  });
  it('con muralla el contorno es mayor', () => {
    const p = proy({ asentamientos: [plaza(3, { recintos: [{}] })] });
    expect(aLaPuerta(p, { x: 107, y: 100 }, { x: 100, y: 100 })).toBe(true);
  });
  it('un campamento de mercenarios mide 2,2; una avanzada, por su etapa', () => {
    const p = proy({ campamentosMercenarios: [{ id: 'mc-1', posicion: { x: 10, y: 10 } }], avanzadas: [{ id: 'av-1', etapa: 3, posicion: { x: 50, y: 50 } }] });
    expect(radioDelLugarEn(p, { x: 10, y: 10 })).toBe(2.2);
    expect(radioDelLugarEn(p, { x: 50, y: 50 })).toBe(1.44);
    expect(distanciaAlBorde(p, { x: 15, y: 10 }, { x: 10, y: 10 })).toBeCloseTo(2.8);
  });
  it('un punto sin lugar mide 0: la puerta es la de siempre, desde el punto', () => {
    expect(aLaPuerta(proy(), { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(aLaPuerta(proy(), { x: 2, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });
});
