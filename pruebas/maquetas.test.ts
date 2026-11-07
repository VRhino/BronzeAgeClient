// Las maquetas de plaza del mundo 3D (0.173.0): las casas no se montan unas en otras ni en lo del centro (Víctor, 2026-11-07).
import { describe, expect, test } from 'vitest';
import { piezasDeCiudad } from '../src/mundo3d/maquetas';

type Caja = ReturnType<typeof piezasDeCiudad>[number];

/** ¿Se pisan dos cajas giradas, vistas desde arriba? (ejes separadores) */
function sePisan(a: Caja, b: Caja): boolean {
  const ejes = (c: Caja): [number, number][] => [[Math.cos(c.giro), Math.sin(c.giro)], [-Math.sin(c.giro), Math.cos(c.giro)]];
  const esquinas = (c: Caja): [number, number][] => {
    const [[ux, uy], [vx, vy]] = ejes(c);
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [c.x + (i! * c.ancho / 2) * ux + (j! * c.fondo / 2) * vx, c.y + (i! * c.ancho / 2) * uy + (j! * c.fondo / 2) * vy]);
  };
  for (const [ex, ey] of [...ejes(a), ...ejes(b)]) {
    const pa = esquinas(a).map(([x, y]) => x * ex + y * ey), pb = esquinas(b).map(([x, y]) => x * ex + y * ey);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
}

describe('maquetas de plaza', () => {
  for (const nivel of [1, 2, 3, 4, 5]) for (const rc of [2.5, 4]) {
    test(`nivel ${nivel}, radio ${rc}: ninguna casa se monta`, () => {
      // las casas y la casa grande del centro, en el suelo (los techos sobre ella van más arriba)
      const casas = piezasDeCiudad(0, 0, rc, nivel, 4242).filter((c) => c.base === 0 && (c.mat === 'adobe' || c.mat === 'techo'));
      let montadas = 0;
      for (let i = 0; i < casas.length; i++) for (let j = i + 1; j < casas.length; j++) if (sePisan(casas[i]!, casas[j]!)) montadas++;
      expect(montadas).toBe(0);
      expect(casas.length).toBeGreaterThan(5);
    });
  }
});
