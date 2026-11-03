import { describe, expect, it } from 'vitest';
import { AGUA, distanciaATierra, laminaDeAgua, mascaraSuave, nivelDelAgua, profundidadA, sueloJuntoAlAgua } from '../src/mundo3d/agua';
import { MUNDO3D } from '../src/mundo3d/config';

// El agua del mundo 3D (Víctor, 2026-11-03: «que no solo sea el piso pintado de azul»): lámina a su nivel sobre un fondo que baja desde la orilla.

const MPU = MUNDO3D.metrosPorUnidad;

describe('nivel y profundidad', () => {
  it('la lámina va un metro bajo la costa en el mar y bajo su nivel en un lago', () => {
    expect(nivelDelAgua(280)).toBe(MUNDO3D.umbrales.agua - 1);
    expect(nivelDelAgua(500)).toBe(499);
  });
  it('nada junto a la orilla, lo más hondo desde `orilla` u, y siempre bajando', () => {
    expect(profundidadA(0)).toBe(0);
    expect(profundidadA(AGUA.orilla)).toBeCloseTo(AGUA.maxima);
    expect(profundidadA(99)).toBeCloseTo(AGUA.maxima);
    for (let d = 0; d < AGUA.orilla; d += 0.5) expect(profundidadA(d + 0.5)).toBeGreaterThanOrEqual(profundidadA(d));
  });
});

describe('distanciaATierra', () => {
  it('cuenta muestras hasta la tierra, con diagonales de √2', () => {
    const fila = distanciaATierra(Uint8Array.from([0, 1, 1, 1, 1]), 5, 1);
    expect(Array.from(fila)).toEqual([0, 1, 2, 3, 4]);
    // 3 × 3 con tierra solo en la esquina: el centro, en diagonal
    const d = distanciaATierra(Uint8Array.from([0, 1, 1, 1, 1, 1, 1, 1, 1]), 3, 3);
    expect(d[4]).toBeCloseTo(Math.SQRT2);
    expect(d[8]).toBeCloseTo(2 * Math.SQRT2);
  });
  it('sin tierra, infinita', () => {
    expect(distanciaATierra(Uint8Array.from([1, 1, 1, 1]), 2, 2)[0]).toBe(Infinity);
  });
});

describe('mascaraSuave', () => {
  it('0 en tierra lejos, 1 en agua lejos y la costa recta en 0,5 entre las dos', () => {
    // 10 columnas: 5 de tierra y 5 de agua, en 3 filas
    const agua = new Uint8Array(30);
    for (let j = 0; j < 3; j++) for (let i = 5; i < 10; i++) agua[j * 10 + i] = 1;
    const b = mascaraSuave(agua, 10, 3);
    expect(b[10]).toBe(0);
    expect(b[19]).toBe(1);
    expect((b[14]! + b[15]!) / 2).toBeCloseTo(0.5);
    for (let i = 0; i < 9; i++) expect(b[10 + i + 1]).toBeGreaterThanOrEqual(b[10 + i]!);
  });
});

describe('sueloJuntoAlAgua', () => {
  const nivel = 374;
  it('el agua lejos de la orilla baja hasta lo más hondo; el fondo del mar del relieve, más hondo, se respeta', () => {
    expect(sueloJuntoAlAgua(375, nivel, true, 1, 20)).toBeCloseTo(nivel - AGUA.maxima * MPU);
    expect(sueloJuntoAlAgua(280, nivel, true, 1, 20)).toBe(280);
  });
  it('junto a la orilla el agua cubre poco: el fondo, cerca de la lámina', () => {
    const h = sueloJuntoAlAgua(375, nivel, true, 0.55, 0.5);
    expect(h).toBeLessThan(nivel);
    expect(nivel - h).toBeLessThan(1 * MPU);
  });
  it('la tierra junto al agua baja hacia ella sin hundirse; la de lejos, tal cual', () => {
    const h = sueloJuntoAlAgua(420, nivel, false, 0.4, 0);
    expect(h).toBeLessThan(420);
    expect(h).toBeGreaterThanOrEqual(nivel + AGUA.seco * MPU);
    expect(sueloJuntoAlAgua(420, nivel, false, 0, 0)).toBe(420);
    // la que ya está casi a ras de la lámina no se toca: ni se hunde ni se levanta
    expect(sueloJuntoAlAgua(nivel + 0.1, nivel, false, 0.45, 0)).toBe(nivel + 0.1);
  });
});

describe('laminaDeAgua', () => {
  const n = 3;
  const rejilla = (f: (i: number, j: number) => number) => Float32Array.from({ length: n * n }, (_, k) => f(k % n, Math.floor(k / n)));
  it('sin agua, nada', () => {
    expect(laminaDeAgua(n, 1, 0, 0, rejilla(() => Number.NaN), rejilla(() => 40))).toBeNull();
  });
  it('toda agua honda: un solo cuadrado', () => {
    const geo = laminaDeAgua(n, 1, 0, 0, rejilla(() => 31), rejilla(() => 20))!;
    expect(geo.getAttribute('position').count).toBe(4);
    expect(geo.index!.count).toBe(6);
  });
  it('en la orilla: cada celda con alguna esquina de agua, la tierra al nivel de su vecino y lo que cubre en cada vértice', () => {
    // la columna de la izquierda es tierra; las otras dos, agua somera a 31 u sobre un fondo a 30,5
    const nivel = rejilla((i) => (i === 0 ? Number.NaN : 31)), fondo = rejilla((i) => (i === 0 ? 33 : 30.5));
    const geo = laminaDeAgua(n, 1, 10, 20, nivel, fondo)!;
    const pos = geo.getAttribute('position'), prof = geo.getAttribute('profundidad');
    expect(geo.index!.count).toBe(4 * 6); // las 4 celdas tocan agua
    expect(pos.count).toBe(9);
    for (let k = 0; k < pos.count; k++) {
      expect(pos.getY(k)).toBe(31);
      expect(prof.getX(k)).toBeCloseTo(pos.getX(k) === 10 ? 0 : 0.5);
    }
  });
});
