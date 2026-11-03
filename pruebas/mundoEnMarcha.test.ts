import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { caravanaEnElMapa } from '../src/mundo/caravanas';
import { algoSeMueve } from '../src/mundo3d/estado';
import { RutaEnSuelo } from '../src/mundo3d/lineas';
import type { ProyeccionJugador } from '../src/apiCliente';

// Lo que se mueve en el mundo 3D (Víctor, 2026-11-03): que las columnas ajenas anden en cada fotograma, que las rutas no se vuelvan a muestrear
// cada vez que algo avanza y que el carro de acarreo no se vea mientras carga dentro de su pueblo.

const proyeccion = (p: Partial<ProyeccionJugador>): ProyeccionJugador => ({ ejercitos: [], caravanas: [], ejercitosAvistados: [], caravanasAvistadas: [], ...p }) as ProyeccionJugador;

describe('algoSeMueve', () => {
  it('nada quieto', () => {
    expect(algoSeMueve(proyeccion({ ejercitos: [{ estado: 'estacionado', ruta: [] }] as never }))).toBe(false);
  });
  it('tu columna o una caravana propia con ruta', () => {
    expect(algoSeMueve(proyeccion({ ejercitos: [{ estado: 'marchando', ruta: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }] as never }))).toBe(true);
    expect(algoSeMueve(proyeccion({ caravanas: [{ ruta: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }] as never }))).toBe(true);
  });
  it('una columna o una caravana ajena que va por su plan, con la tuya parada', () => {
    expect(algoSeMueve(proyeccion({ ejercitosAvistados: [{ id: 'e', enMarcha: true }] as never }))).toBe(true);
    expect(algoSeMueve(proyeccion({ caravanasAvistadas: [{ id: 'c', enMarcha: true }] as never }))).toBe(true);
    expect(algoSeMueve(proyeccion({ ejercitosAvistados: [{ id: 'e' }], caravanasAvistadas: [{ id: 'c' }] } as never))).toBe(false);
  });
});

describe('caravanaEnElMapa', () => {
  it('solo de camino o aparcada en el campo', () => {
    for (const estado of ['en_transito', 'retornando', 'aparcada'] as const) expect(caravanaEnElMapa({ estado, tipo: 'acarreo' }), estado).toBe(true);
    for (const estado of ['disponible', 'preparando', 'esperando', 'adjunta'] as const) expect(caravanaEnElMapa({ estado, tipo: 'acarreo' }), estado).toBe(false);
  });
  it('sin estado, sí, salvo la de fundación', () => {
    expect(caravanaEnElMapa({ tipo: 'comercial' })).toBe(true);
    expect(caravanaEnElMapa({ tipo: 'construccion' })).toBe(false);
  });
});

describe('RutaEnSuelo', () => {
  const suelo = (): number => 0;
  const muestras = (r: RutaEnSuelo) => {
    const [linea, cabeza] = r.grupo.children as THREE.Line[];
    const g = linea!.geometry, pos = g.getAttribute('position');
    return { linea: linea!, cabeza: cabeza!, total: pos?.count ?? 0, desde: g.drawRange.start, cuantos: g.drawRange.count, primera: pos ? { x: pos.getX(g.drawRange.start), y: pos.getZ(g.drawRange.start) } : null };
  };
  it('se muestrea una vez y se acorta por delante según anda la cabeza', () => {
    const r = new RutaEnSuelo(new THREE.LineBasicMaterial(), suelo);
    const vertices = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 4 }];
    r.fijar([{ x: 0, y: 0 }, ...vertices.slice(1)]);
    const a = muestras(r), geometria = a.linea.geometry;
    expect(a.total).toBe(1 + 8 + 8); // lo que queda (sin la cabeza), cada 0,5 u
    expect(a.primera).toEqual({ x: 4, y: 0 });
    // la cabeza avanza por el primer tramo: no se vuelve a muestrear
    r.fijar([{ x: 2.3, y: 0 }, ...vertices.slice(1)]);
    expect(muestras(r).linea.geometry).toBe(geometria);
    // pasa el segundo vértice: la misma geometría, dibujada desde el tercero
    r.fijar([{ x: 5, y: 0 }, ...vertices.slice(2)]);
    const b = muestras(r);
    expect(b.linea.geometry).toBe(geometria);
    expect(b.primera).toEqual({ x: 8, y: 0 });
    expect(b.desde + b.cuantos).toBe(b.total);
    // el tramo de la cabeza va de ella al siguiente vértice
    const c = b.cabeza.geometry.getAttribute('position');
    expect([c.getX(0), c.getX(c.count - 1)]).toEqual([5, 8]);
  });
  it('otra ruta se vuelve a muestrear', () => {
    const r = new RutaEnSuelo(new THREE.LineBasicMaterial(), suelo);
    r.fijar([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    const g = muestras(r).linea.geometry;
    r.fijar([{ x: 0, y: 0 }, { x: 0, y: 4 }]);
    expect(muestras(r).linea.geometry).not.toBe(g);
    expect(muestras(r).primera).toEqual({ x: 0, y: 4 });
  });
});
