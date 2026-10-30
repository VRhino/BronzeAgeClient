// Lo que el mundo 3D calcula sin pintar: el encuadre de la cámara, lo que cabe en pantalla según la visión, el estado que sale de la proyección,
// la ruta que queda y la altura del raster del artefacto.
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import { distanciaDeEncuadre } from '../src/mundo3d/camara';
import { encuadres } from '../src/mundo3d/config';
import { estadoDesdeProyeccion } from '../src/mundo3d/estado';
import { fuenteDesdeMapa } from '../src/mundo3d/fuente';
import { rutaPendiente } from '../src/mundo3d/lineas';
import type { MapaGenerado } from '../src/terreno';
import type { Ejercito } from '../src/tiposDominio';

const tg = Math.tan((35 * Math.PI) / 360), grados = (g: number) => (g * Math.PI) / 180;

describe('la cámara de juego', () => {
  test('desde arriba, el círculo de «en pantalla» llena el lado corto, como en el 2D', () => {
    expect(distanciaDeEncuadre(7.5, grados(90), tg, 16 / 9)).toBeCloseTo(7.5 / tg, 2);
    expect(distanciaDeEncuadre(7.5, grados(90), tg, 9 / 16)).toBeCloseTo(7.5 / (tg * (9 / 16)), 2);
  });

  test('inclinada, se acerca lo justo para que quepa el borde de abajo', () => {
    // a 30°, el punto del círculo más cercano a la cámara es el que manda: r·sen 30 / (d − r·cos 30) = tg
    const r = 15, d = distanciaDeEncuadre(r, grados(30), tg, 16 / 9);
    expect(d).toBeCloseTo((r * 0.5) / tg + r * Math.cos(grados(30)), 1);
  });

  test('lo que cabe en pantalla sigue a la visión: 15 o 22 u el héroe solo, 30 o 45 con soldados', () => {
    expect(encuadres(15)).toEqual([15, 22]);
    expect(encuadres(30)).toEqual([30, 45]);
    expect(encuadres(60)).toEqual([60, 90]);
  });
});

const columna = (cambios: Partial<Ejercito>): Ejercito => ({
  id: 'ej-1', faccionId: 'f-1', origenAsentamientoId: 'as-1', escuadronIds: [], participantes: [{ heroeId: 'heroe-1', unidoEn: 0 }],
  ruta: [], posicionActual: { x: 10, y: 20 }, estado: 'estacionado', ...cambios,
});
const proyeccion = (ejercitos: Ejercito[]) => ({ heroeId: 'heroe-1', ejercitos, exploracion: undefined }) as unknown as ProyeccionJugador;
const RADIOS = { solo: 15, ejercito: 30 };

describe('el estado de la vista', () => {
  test('la columna propia: la cámara la sigue y con soldados ve 30 u', () => {
    const e = estadoDesdeProyeccion(proyeccion([columna({ escuadronIds: ['e1', 'e2'], estado: 'marchando', ruta: [{ x: 10, y: 20 }, { x: 30, y: 20 }] })]), RADIOS, null);
    expect(e.heroe).toEqual({ x: 10, y: 20 });
    expect(e.radioVision).toBe(30);
    expect(e.columnas).toEqual([{ id: 'ej-1', propia: true, posicion: { x: 10, y: 20 }, ruta: [{ x: 10, y: 20 }, { x: 30, y: 20 }], jinetes: 1, soldados: 6 }]);
  });

  test('sola y quieta, ve 15 u y no enseña ruta', () => {
    const e = estadoDesdeProyeccion(proyeccion([columna({ ruta: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })]), RADIOS, null);
    expect([e.radioVision, e.columnas[0]!.ruta]).toEqual([15, []]);
  });

  test('dentro de un lugar no está en el mapa: la cámara mira donde está el héroe', () => {
    const e = estadoDesdeProyeccion(proyeccion([columna({ dentroDe: 'as-1' })]), RADIOS, { x: 5, y: 5 });
    expect([e.heroe, e.columnas.length]).toEqual([{ x: 5, y: 5 }, 0]);
  });
});

test('la ruta que queda empieza en la cabeza y sigue desde su tramo', () => {
  const ruta = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  expect(rutaPendiente(ruta, { x: 10, y: 3 })).toEqual([{ x: 10, y: 3 }, { x: 10, y: 10 }]);
  expect(rutaPendiente([{ x: 0, y: 0 }], { x: 0, y: 0 })).toEqual([]);
});

test('sin paquete de relieve, la altura sale del raster de 4 u del artefacto, interpolada entre centros de celda', () => {
  const datos = new Uint16Array([0, 65535, 0, 65535]);
  const mapa = { config: { ancho: 8, alto: 8, seed: 0 }, rasters: { altura: { columnas: 2, filas: 2, celda: 4, datos }, terreno: { columnas: 2, filas: 2, celda: 4, datos: new Uint8Array([1, 3, 3, 3]) } } } as unknown as MapaGenerado;
  const f = fuenteDesdeMapa(mapa)!;
  expect(f.alturaEn(2, 2)).toBeCloseTo(0, 6); // centro de la primera celda
  expect(f.alturaEn(6, 2)).toBeCloseTo(1000, 6); // centro de la segunda
  expect(f.alturaEn(4, 2)).toBeCloseTo(500, 6); // a medio camino
  expect([f.aguaEn(1, 1), f.aguaEn(5, 1)]).toEqual([true, false]);
});
