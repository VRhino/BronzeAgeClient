// La avanzada por dentro (`ciudad3d/avanzada.ts`): en cada etapa, el recinto cierra con su puerta abajo y nada de dentro pisa la muralla ni se sale
// de ella; en ruinas, los edificios son escombro y la muralla queda en pie solo en parte.
import { describe, expect, it } from 'vitest';
import { avanzadaEnVista } from '../src/ciudad3d/avanzada';

const cruzan = (a: { x: number; y: number; ancho: number; alto: number }, b: { x: number; y: number; ancho: number; alto: number }): boolean =>
  a.x < b.x + b.ancho - 1e-6 && b.x < a.x + a.ancho - 1e-6 && a.y < b.y + b.alto - 1e-6 && b.y < a.y + a.alto - 1e-6;

describe('avanzada por dentro', () => {
  for (const etapa of [1, 2, 3]) {
    it(`etapa ${etapa}: recinto cerrado con puerta y edificios dentro, sin pisar el muro`, () => {
      const c = avanzadaEnVista({ id: 'av-1', etapa, enRuinas: false }, { instante: 0 })!;
      expect(c).not.toBeNull();
      const r = c.recintos[0]!;
      expect(r.cerrado).toBe(true);
      expect(r.celdas.filter((k) => k.clase === 'puerta')).toHaveLength(2);
      expect(r.celdas.every((k) => k.enPie)).toBe(true);
      const T = c.celda;
      const muro = r.celdas.map((k) => ({ x: k.x - T / 2, y: k.y - T / 2, ancho: T, alto: T }));
      const radioMuro = Math.min(...r.celdas.map((k) => Math.max(Math.abs(k.x), Math.abs(k.y))));
      for (const e of c.edificios) {
        expect(muro.some((m) => cruzan(m, e)), `${e.tipo} pisa la muralla`).toBe(false);
        for (const [x, y] of [[e.x, e.y], [e.x + e.ancho, e.y], [e.x, e.y + e.alto], [e.x + e.ancho, e.y + e.alto]] as const) {
          expect(Math.hypot(x, y) < Math.hypot(radioMuro, radioMuro), `${e.tipo} se sale`).toBe(true);
        }
        for (const o of c.edificios) if (o !== e) expect(cruzan(o, e), `${e.tipo} pisa ${o.tipo}`).toBe(false);
        for (const k of c.calles) expect(cruzan(k, e), `${e.tipo} pisa la calle`).toBe(false);
      }
    });
  }

  it('en ruinas: escombro y la muralla a medias', () => {
    const c = avanzadaEnVista({ id: 'av-1', etapa: 2, enRuinas: true }, { instante: 0 })!;
    expect(c.edificios.every((e) => e.danado)).toBe(true);
    const r = c.recintos[0]!;
    const enPie = r.celdas.filter((k) => k.enPie).length;
    expect(enPie).toBeGreaterThan(0);
    expect(enPie).toBeLessThan(r.celdas.length);
  });
});
