import { describe, expect, it } from 'vitest';
import { Colisionador, fueraDeSolidos, rutaQueRodea, type Solido } from '../src/mundo3d/huellas';

const plaza: Solido = { x: 0, y: 0, r: 2 };
const dist = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe('lo sólido del cliente (0.175.0)', () => {
  it('una marcha a un punto de dentro se queda al borde, por el lado de la columna', () => {
    const q = fueraDeSolidos({ x: 0, y: 0 }, [plaza], { x: 10, y: 0 });
    expect(q.x).toBeCloseTo(2);
    expect(q.y).toBeCloseTo(0);
    const fuera = { x: 5, y: 1 };
    expect(fueraDeSolidos(fuera, [plaza], { x: 10, y: 0 })).toBe(fuera);
  });

  it('una ruta que cruza por el medio rodea por el borde, sin entrar', () => {
    const ruta = rutaQueRodea([{ x: -6, y: 0 }, { x: 6, y: 0 }], [plaza]);
    expect(ruta[0]).toEqual({ x: -6, y: 0 });
    expect(ruta[ruta.length - 1]).toEqual({ x: 6, y: 0 });
    for (const p of ruta) expect(dist(p)).toBeGreaterThanOrEqual(2 - 1e-9);
    // sin saltos: ningún tramo más largo que el paso (algo más en el arco)
    for (let k = 1; k < ruta.length; k++) expect(Math.hypot(ruta[k]!.x - ruta[k - 1]!.x, ruta[k]!.y - ruta[k - 1]!.y)).toBeLessThan(0.5);
  });

  it('lo que el servidor pone dentro se pinta en el borde y lo rodea sin saltar', () => {
    const c = new Colisionador();
    let antes: { x: number; y: number } | null = null;
    for (let x = -4; x <= 4; x += 0.05) {
      c.empezar();
      const p = c.mover('caravana', { x, y: 0 }, [plaza]);
      expect(dist(p)).toBeGreaterThanOrEqual(2 - 1e-9);
      if (antes) expect(Math.hypot(p.x - antes.x, p.y - antes.y)).toBeLessThan(0.05 * 4.5 + 0.02);
      antes = p;
    }
    expect(antes!.x).toBeCloseTo(4);
  });
});
