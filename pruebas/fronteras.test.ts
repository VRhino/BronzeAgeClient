import { describe, expect, it } from 'vitest';
import { partirFronteras } from '../src/mundo/fronteras';

const cuadro = (x0: number, x1: number) => [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 4 }, { x: x0, y: 4 }];
const largo = (p: { x: number; y: number }[]) => p.slice(1).reduce((t, q, k) => t + Math.hypot(q.x - p[k]!.x, q.y - p[k]!.y), 0);

describe('fronteras fusionadas por Facción', () => {
  it('una zona sola sale entera y cerrada', () => {
    const t = partirFronteras([{ faccionId: 'f-1', contorno: cuadro(0, 4) }]);
    expect(t).toHaveLength(1);
    expect(t[0]!.tipo).toBe('exterior');
    expect(largo(t[0]!.puntos)).toBeCloseTo(16);
  });

  it('dos de la misma Facción que se tocan: frontera por fuera y una línea interior, una sola vez', () => {
    const t = partirFronteras([{ faccionId: 'f-1', contorno: cuadro(0, 4) }, { faccionId: 'f-1', contorno: cuadro(4, 8) }]);
    const exterior = t.filter((x) => x.tipo === 'exterior').reduce((s, x) => s + largo(x.puntos), 0);
    const interior = t.filter((x) => x.tipo === 'interior');
    expect(exterior).toBeCloseTo(24);
    expect(interior).toHaveLength(1);
    expect(largo(interior[0]!.puntos)).toBeCloseTo(4);
  });

  it('de Facciones distintas no se fusionan', () => {
    const t = partirFronteras([{ faccionId: 'f-1', contorno: cuadro(0, 4) }, { faccionId: 'f-2', contorno: cuadro(4, 8) }]);
    expect(t.every((x) => x.tipo === 'exterior')).toBe(true);
    expect(t).toHaveLength(2);
  });

  it('lo que cae dentro de una hermana no se pinta', () => {
    const t = partirFronteras([{ faccionId: 'f-1', contorno: cuadro(0, 6) }, { faccionId: 'f-1', contorno: cuadro(4, 10) }]);
    const total = t.reduce((s, x) => s + largo(x.puntos), 0);
    // exterior de la unión (0..10 × 0..4) = 28; los trozos de lado dentro de la otra no salen
    expect(t.filter((x) => x.tipo === 'exterior').reduce((s, x) => s + largo(x.puntos), 0)).toBeCloseTo(28, 0);
    expect(total).toBeLessThan(28 + 8.5);
  });
});
