// Las maquetas de plaza del mundo 3D (0.173.0): las casas no se montan unas en otras ni en lo del centro (Víctor, 2026-11-07).
import { describe, expect, test } from 'vitest';
import { banderasDeCiudad, piezasDeCiudad, piezasDePueblo } from '../src/mundo3d/maquetas';

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

  // la muralla, la que dice la VISTA desde fuera (`tieneMuralla`, 0.179.0); sin saberlo, la de su nivel
  const lejos = (c: Caja, r: number): boolean => Math.hypot(c.x, c.y) > r;
  test('nivel 1 con muralla: empalizada; sin ella, ninguna', () => {
    const madera = (m?: boolean): number => piezasDeCiudad(0, 0, 2.5, 1, 4242, m).filter((c) => c.mat === 'madera' && lejos(c, 0.8)).length;
    expect(madera(true)).toBeGreaterThan(madera(false));
    expect(madera(undefined)).toBe(madera(false));
  });
  test('nivel 3 sin muralla: no hay muro en el borde', () => {
    const muro = (m?: boolean): number => piezasDeCiudad(0, 0, 2.5, 3, 4242, m).filter((c) => c.mat === 'muro' && lejos(c, 1)).length;
    expect(muro(false)).toBe(0);
    expect(muro(true)).toBeGreaterThan(0);
    expect(muro(undefined)).toBe(muro(true));
  });

  // la puerta, que se distinga del muro (Víctor, 2026-11-08): una bandera en cada torre de la puerta
  test('nivel 3 con muralla: dos banderas más, las de las torres de la puerta', () => {
    expect(banderasDeCiudad(0, 0, 2.5, 3, 4242, true)).toBe(banderasDeCiudad(0, 0, 2.5, 3, 4242, false) + 2);
    expect(banderasDeCiudad(0, 0, 2.5, 5, 4242, true)).toBe(banderasDeCiudad(0, 0, 2.5, 5, 4242, false) + 2);
  });
});

describe('las aldeas por su cultivo (tanda 69)', () => {
  const mats = (cultivo?: string): Set<string> => new Set(piezasDePueblo(0, 0, true, 77, cultivo).map((c) => c.mat));
  test('la de trigo, sus campos dorados; la de vid, la tierra con sus hileras de cepas; la de olivo, los olivos', () => {
    expect(mats('trigo').has('campo')).toBe(true);
    expect(mats(undefined).has('campo')).toBe(true);
    expect(mats('vid').has('vid')).toBe(true);
    expect(mats('vid').has('campo')).toBe(false);
    expect(mats('oliva').has('olivo')).toBe(true);
    expect(mats('oliva').has('campo')).toBe(false);
  });
  test('la de cebada, pálida con sus surcos verdes; la de sésamo, la tierra con sus matas y su flor (motor b55e90f)', () => {
    expect(mats('cebada').has('cebada') && mats('cebada').has('cebadaVerde')).toBe(true);
    expect(mats('sesamo').has('sesamo') && mats('sesamo').has('florSesamo')).toBe(true);
    for (const c of ['cebada', 'sesamo']) expect(mats(c).has('campo') || mats(c).has('vid') || mats(c).has('olivo')).toBe(false);
  });
  test('la ganadera, sin campos: corrales sobre pasto con su rebaño (motor 3d05872)', () => {
    expect(mats('ganado').has('pasto') && mats('ganado').has('res') && mats('ganado').has('oveja')).toBe(true);
    expect(mats('ganado').has('campo') || mats('ganado').has('vid') || mats('ganado').has('tierra')).toBe(false);
    expect(mats('trigo').has('res')).toBe(false);
  });
  test('un extractor no tiene campos, tenga lo que tenga', () => {
    const m = new Set(piezasDePueblo(0, 0, false, 77, 'vid').map((c) => c.mat));
    expect(m.has('vid') || m.has('campo')).toBe(false);
  });
});
