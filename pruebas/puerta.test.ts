// La puerta es todo el contorno (motor 23-11-2026, «Tamaños y distancias del mapa», tanda 2): a `radioPuerta` (1) o menos del BORDE del lugar, con
// el radio de `TAMANOS_MAPA` (plaza por nivel y muralla, campamento, aldea por nivel, avanzada por etapa).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, radioDePuerta: () => 1 }));
const { aLaPuerta, distanciaAlBorde, radioDelLugarEn, radioDePlaza } = await import('../src/ui/puerta');

const plaza = (nivel: number, extra: object = {}) => ({ id: 'as-1', posicion: { x: 100, y: 100 }, nivel, ...extra });
const proy = (extra: object = {}) => ({ asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], campamentosMercenarios: [], pueblos: [], avanzadas: [], obrasDeMapa: [], campamentosBandidos: [], alijos: [], ...extra }) as never;

describe('la puerta es el contorno', () => {
  it('el radio de la plaza sube con el nivel y con la muralla', () => {
    expect(radioDePlaza(1, false)).toBe(1.38);
    expect(radioDePlaza(5, false)).toBe(5.68);
    expect(radioDePlaza(5, true)).toBe(6.27);
  });
  it('una plaza de nivel 3: a 5,2 del centro ya es la puerta (borde a 4,21); a 5,5 no', () => {
    const p = proy({ asentamientos: [plaza(3)] });
    expect(aLaPuerta(p, { x: 105.2, y: 100 }, { x: 100, y: 100 })).toBe(true);
    expect(aLaPuerta(p, { x: 105.5, y: 100 }, { x: 100, y: 100 })).toBe(false);
    expect(aLaPuerta(p, { x: 100, y: 94.8 }, { x: 100, y: 100 })).toBe(true); // por cualquier lado
  });
  it('con muralla el contorno es mayor', () => {
    const p = proy({ asentamientos: [plaza(3, { recintos: [{}] })] });
    expect(aLaPuerta(p, { x: 105.6, y: 100 }, { x: 100, y: 100 })).toBe(true);
  });
  it('un campamento de mercenarios mide 2,2; una avanzada, por su etapa', () => {
    const p = proy({ campamentosMercenarios: [{ id: 'mc-1', posicion: { x: 10, y: 10 } }], avanzadas: [{ id: 'av-1', etapa: 3, posicion: { x: 50, y: 50 } }] });
    expect(radioDelLugarEn(p, { x: 10, y: 10 })).toBe(2.2);
    expect(radioDelLugarEn(p, { x: 50, y: 50 })).toBe(2.28);
    expect(distanciaAlBorde(p, { x: 15, y: 10 }, { x: 10, y: 10 })).toBeCloseTo(2.8);
  });
  it('bandidos y alijos miden desde su borde (tanda 6): 1,61 y 0,52', () => {
    const p = proy({ campamentosBandidos: [{ id: 'b', posicion: { x: 20, y: 20 } }], alijos: [{ id: 'a', posicion: { x: 30, y: 30 } }] });
    expect(radioDelLugarEn(p, { x: 20, y: 20 })).toBe(1.61);
    expect(radioDelLugarEn(p, { x: 30, y: 30 })).toBe(0.52);
    expect(aLaPuerta(p, { x: 30.5, y: 30 }, { x: 30, y: 30 })).toBe(true);
  });
  it('un punto sin lugar mide 0: la puerta es la de siempre, desde el punto', () => {
    expect(aLaPuerta(proy(), { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(aLaPuerta(proy(), { x: 2, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });
});
