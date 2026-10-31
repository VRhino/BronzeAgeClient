// Lo que el mundo 3D calcula sin pintar: el encuadre de la cámara, lo que cabe en pantalla según la visión, el estado que sale de la proyección
// (columnas y lo que hay en el mundo, con el lado de la niebla de cada capa), la ruta que queda, las cintas pegadas al suelo, dónde van los
// árboles y la altura del raster del artefacto.
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import { arbolesDelTrozo, caucesDe, franjas, type Entorno } from '../src/mundo3d/arboles';
import { distanciaDeEncuadre } from '../src/mundo3d/camara';
import { encuadres } from '../src/mundo3d/config';
import { ANCHOS, estadoDesdeProyeccion, mundoDesdeProyeccion } from '../src/mundo3d/estado';
import { fuenteDesdeMapa, type FuenteDeAltura } from '../src/mundo3d/fuente';
import { cinta, circulo, rutaPendiente, tramosEnCaja } from '../src/mundo3d/lineas';
import { suavizar } from '../src/mundo3d/paisaje';
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
const REGLAS = { vision: { solo: 15, ejercito: 30 }, radioZonaInicial: 6, radioProteccion: 10 };

describe('el estado de la vista', () => {
  test('la columna propia: la cámara la sigue y con soldados ve 30 u', () => {
    const e = estadoDesdeProyeccion(proyeccion([columna({ escuadronIds: ['e1', 'e2'], estado: 'marchando', ruta: [{ x: 10, y: 20 }, { x: 30, y: 20 }] })]), REGLAS, null);
    expect(e.heroe).toEqual({ x: 10, y: 20 });
    expect(e.radioVision).toBe(30);
    expect(e.columnas).toEqual([{ id: 'ej-1', propia: true, posicion: { x: 10, y: 20 }, ruta: [{ x: 10, y: 20 }, { x: 30, y: 20 }], jinetes: 1, soldados: 6 }]);
  });

  test('sola y quieta, ve 15 u y no enseña ruta', () => {
    const e = estadoDesdeProyeccion(proyeccion([columna({ ruta: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })]), REGLAS, null);
    expect([e.radioVision, e.columnas[0]!.ruta]).toEqual([15, []]);
  });

  test('dentro de un lugar no está en el mapa: la cámara mira donde está el héroe', () => {
    const e = estadoDesdeProyeccion(proyeccion([columna({ dentroDe: 'as-1' })]), REGLAS, { x: 5, y: 5 });
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

describe('lo que hay en el mundo, sacado de la proyección', () => {
  const zona = circulo({ x: 100, y: 100 }, 15, 48).slice(0, -1);
  const p = {
    heroeId: 'heroe-1', faccionId: 'f-1', ejercitos: [], exploracion: undefined,
    facciones: [{ id: 'f-1' }, { id: 'f-2' }],
    asentamientosAvistados: [{ id: 'a-1', faccionId: 'f-2', posicion: { x: 100, y: 100 }, nivel: 3, zona }],
    asentamientosConocidos: [{ asentamientoId: 'a-2', faccionId: 'f-2', posicion: { x: 300, y: 100 }, nivel: 1, conocidoEn: 0, radioPotencial: 8 }, { asentamientoId: 'a-3', faccionId: 'f-2', posicion: { x: 400, y: 100 }, nivel: 1, conocidoEn: 0 }],
    caminos: [{ id: 'c', escalon: 2, puntos: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }, { id: 's', escalon: 0, puntos: [{ x: 0, y: 5 }, { x: 10, y: 5 }] }],
    zonasFusionadas: [{ faccionId: 'f-1', contornos: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]] }],
    campamentosMercenarios: [{ id: 'camp-0', posicion: { x: 50, y: 50 } }],
    pueblos: [{ id: 'pu', madreId: 'a-1', propio: false, tipo: 'aldeaAgricola', posicion: { x: 110, y: 100 } }, { id: 'ex', madreId: 'm', propio: true, tipo: 'cantera', posicion: { x: 90, y: 100 } }],
    avanzadas: [{ id: 'av', madreId: 'm', etapa: 2, posicion: { x: 100, y: 110 }, enRuinas: true, propia: true }],
    obrasDeMapa: [{ id: 'o1', madreId: 'm', propia: true, tipo: 'aldea', posicion: { x: 1, y: 1 }, requerido: {}, entregado: {} }, { id: 'o2', madreId: 'm', propia: true, tipo: 'mejoraAldea', posicion: { x: 2, y: 2 }, requerido: {}, entregado: {}, terminaEn: 5 }],
  } as unknown as ProyeccionJugador;
  const m = mundoDesdeProyeccion(p, REGLAS);

  test('la ciudad es el 10 % del radio de su zona: la del contorno si se ve, la recordada si no, y si no la inicial', () => {
    expect(m.plazas.map((x) => [x.id, +x.radioCiudad.toFixed(3), x.recordada])).toEqual([['a-1', 1.5, false], ['a-2', 0.8, true], ['a-3', 0.6, true]]);
  });

  test('cada raya en su lado de la niebla: caminos y fronteras debajo, la zona propia y el anillo de los mercenarios encima', () => {
    const t = m.trazos.map((x) => [x.tipo, x.bajoNiebla, x.ancho, x.discontinuo ?? false]);
    expect(t).toEqual([
      ['camino', true, ANCHOS.caminos[2], false],
      ['camino', true, ANCHOS.caminos[0], false],
      ['frontera', true, ANCHOS.frontera, false],
      ['frontera', true, ANCHOS.frontera, true],
      ['zona', false, ANCHOS.zona, false],
      ['anillo', false, ANCHOS.anillo, false],
    ]);
    // los contornos se cierran
    const frontera = m.trazos[2]!.puntos;
    expect(frontera[frontera.length - 1]).toEqual(frontera[0]);
  });

  test('pueblos, avanzadas y obras con el color de su Facción; la mejora de una aldea no se pinta aparte', () => {
    expect(m.pueblos.map((x) => [x.id, x.aldea])).toEqual([['pu', true], ['ex', false]]);
    expect(m.pueblos[0]!.color).toBe(m.plazas[0]!.color); // el de su plaza madre ajena
    expect(m.avanzadas).toEqual([{ id: 'av', posicion: { x: 100, y: 110 }, etapa: 2, ruinas: true, color: m.pueblos[1]!.color }]);
    expect(m.obras.map((x) => [x.id, x.arrancada])).toEqual([['o1', false]]);
    expect(m.campamentos).toEqual([{ id: 'camp-0', posicion: { x: 50, y: 50 }, radioProteccion: 10 }]);
  });
});

describe('las cintas pegadas al suelo', () => {
  const suelo = (x: number) => x * 0.1;

  test('dos vértices por muestra, a medio ancho del eje, y las caras mirando arriba', () => {
    const g = cinta([{ x: 0, y: 0 }, { x: 4, y: 0 }], suelo, 2, { dy: 0 })!;
    const pos = g.getAttribute('position')!;
    expect(pos.count).toBe(2 * 9); // de 0 a 4 cada 0,5 u
    expect([pos.getZ(0), pos.getZ(1)]).toEqual([1, -1]);
    expect(pos.getY(16)).toBeCloseTo(0.4, 6); // en x = 4, sobre el suelo
    const i = g.getIndex()!, v = (k: number) => [pos.getX(i.getX(k)), pos.getY(i.getX(k)), pos.getZ(i.getX(k))];
    const [a, b, c] = [v(0), v(1), v(2)], u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], w = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    expect(u[2]! * w[0]! - u[0]! * w[2]!).toBeGreaterThan(0); // la normal del triángulo tiene y > 0
  });

  test('el agua va plana a la altura del punto más bajo de su corte; un camino, sobre el suelo de cada borde', () => {
    const ladera = (_x: number, y: number) => y * 0.5;
    const agua = cinta([{ x: 0, y: 0 }, { x: 1, y: 0 }], ladera, 2, { asiento: 'bajo', dy: 0 })!.getAttribute('position')!;
    expect([agua.getY(0), agua.getY(1)]).toEqual([-0.5, -0.5]);
    const camino = cinta([{ x: 0, y: 0 }, { x: 1, y: 0 }], ladera, 2, { dy: 0 })!.getAttribute('position')!;
    expect([camino.getY(0), camino.getY(1)]).toEqual([0.5, -0.5]);
  });

  test('discontinua: deja huecos', () => {
    const llena = cinta([{ x: 0, y: 0 }, { x: 10, y: 0 }], suelo, 1)!.getIndex()!.count;
    const rayas = cinta([{ x: 0, y: 0 }, { x: 10, y: 0 }], suelo, 1, { trazo: [1, 1] })!.getIndex()!.count;
    expect(rayas).toBe(llena / 2);
  });

  test('recortar a una caja: los segmentos con algún extremo dentro, seguidos', () => {
    const l = [{ x: -10, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, { x: 3, y: 1 }];
    expect(tramosEnCaja(l, 0, -5, 5, 5)).toEqual([[l[0], l[1], l[2], l[3]], [l[4], l[5]]]);
  });

  test('suavizar un río no mueve sus extremos', () => {
    const r = suavizar([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect([r[0], r[r.length - 1]]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    expect(r.length).toBe(12); // dos pasadas de Chaikin: 3 puntos, 6, 12
  });
});

describe('los árboles', () => {
  const llano: FuenteDeAltura = { ancho: 64, alto: 64, paso: 0.5, alturaEn: () => 450, aguaEn: () => false };
  const bosque = { config: { ancho: 64, alto: 64, seed: 0 }, rios: [], rasters: { densidadBosque: { columnas: 16, filas: 16, celda: 4, datos: new Uint8Array(256).fill(255) } } } as unknown as MapaGenerado;
  const entorno = (cambios: Partial<Entorno> = {}): Entorno => ({ fuente: llano, mapa: bosque, cauces: caucesDe(bosque), claros: [], explorada: () => true, ...cambios });

  test('en bosque cerrado, las copas de 0,3 u casi se tocan: 0,55 / 0,3² árboles por u²', () => {
    const n = arbolesDelTrozo(entorno(), 0, 0, 16, 1).length / 4;
    expect(n / 256).toBeGreaterThan(5.6);
    expect(n / 256).toBeLessThan(6.6);
  });

  test('lejos quedan la mitad, y son de los mismos', () => {
    const todos = arbolesDelTrozo(entorno(), 0, 0, 16, 1), mitad = arbolesDelTrozo(entorno(), 0, 0, 16, 0.5);
    expect(mitad.length / todos.length).toBeGreaterThan(0.4);
    expect(mitad.length / todos.length).toBeLessThan(0.6);
    const claves = new Set<string>();
    for (let k = 0; k < todos.length; k += 4) claves.add(`${todos[k]},${todos[k + 1]}`);
    for (let k = 0; k < mitad.length; k += 4) expect(claves.has(`${mitad[k]},${mitad[k + 1]}`)).toBe(true);
  });

  test('ni en lo que no se exploró, ni en un claro, ni en el cauce de un río', () => {
    expect(arbolesDelTrozo(entorno({ explorada: () => false }), 0, 0, 16, 1).length).toBe(0);
    const conClaro = arbolesDelTrozo(entorno({ claros: [{ x: 8, y: 8, r: 3 }] }), 0, 0, 16, 1);
    for (let k = 0; k < conClaro.length; k += 4) expect(Math.hypot(conClaro[k]! - 8, conClaro[k + 1]! - 8)).toBeGreaterThanOrEqual(3);
    const conRio = { ...bosque, rios: [{ id: 'r', puntos: [{ x: 0, y: 8 }, { x: 16, y: 8 }], terminaEnLago: false, navegable: false }] } as MapaGenerado;
    const junto = arbolesDelTrozo(entorno({ mapa: conRio, cauces: caucesDe(conRio) }), 0, 0, 16, 1);
    for (let k = 0; k < junto.length; k += 4) expect(Math.abs(junto[k + 1]! - 8)).toBeGreaterThanOrEqual(0.95);
  });

  test('ni sobre un camino', () => {
    const caminos = franjas([{ puntos: [{ x: 8, y: 0 }, { x: 8, y: 16 }], medio: 0.35 }]);
    const t = arbolesDelTrozo(entorno({ caminos }), 0, 0, 16, 1);
    for (let k = 0; k < t.length; k += 4) expect(Math.abs(t[k]! - 8)).toBeGreaterThanOrEqual(0.55);
  });

  test('ni en el agua ni en una ladera muy empinada', () => {
    expect(arbolesDelTrozo(entorno({ fuente: { ...llano, aguaEn: () => true } }), 0, 0, 8, 1).length).toBe(0);
    expect(arbolesDelTrozo(entorno({ fuente: { ...llano, alturaEn: (x) => x * 24 } }), 0, 0, 8, 1).length).toBe(0); // 2 m/m
  });
});
