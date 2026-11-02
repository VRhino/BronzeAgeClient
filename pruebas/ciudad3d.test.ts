// La plaza 3D sin pintar: lo que sale de la proyección (`ciudadEnVista`) y los modelos hechos en código, contra ciudades reales del motor (las
// de `pruebas/ciudad3d/ciudades/`). Lo primero que se comprueba es que se respeta el trazado: cada edificio en su huella, nada fuera de ella
// más que un alero, y las celdas libres sin pisar calles, huellas ni muralla.
import { readFileSync } from 'node:fs';
import { fromBinary } from '@bufbuild/protobuf';
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { anillosDe, campamentoEnVista } from '../src/ciudad3d/campamento';
import { FORMA_BASE, girarLados } from '../src/ciudad3d/calles';
import { montarGuardacantones, teselasDe } from '../src/ciudad3d/calzada';
import { ciudadEnVista, estiloDe, type CiudadEnVista } from '../src/ciudad3d/estado';
import { montarEdificio } from '../src/ciudad3d/modelos';
import { Piezas, type Pieza } from '../src/ciudad3d/piezas';
import { AsentamientoSchema, CampamentoMercenariosSchema } from '../src/contrato/gen/bronzeage/v1/entities_pb';
import { escenaCampamento, plazaDeContrato } from '../src/motor/proyeccion';
import type { Asentamiento, TrazadoAsentamiento } from '../src/tiposDominio';

const DIA = 24 * 3_600_000;
const DIAS: Record<string, number> = { aldea: 3, pueblo: 8, ciudad: 16 };
function plaza(nombre: string): { a: Asentamiento; t: TrazadoAsentamiento; c: CiudadEnVista } {
  const pb = fromBinary(AsentamientoSchema, readFileSync(new URL(`./ciudad3d/ciudades/${nombre}.bin`, import.meta.url)));
  const { asentamiento: a, trazado: t } = plazaDeContrato(pb, DIAS[nombre]! * DIA);
  const c = ciudadEnVista(a, t, { instante: DIAS[nombre]! * DIA, minutosDeObra: () => 60 })!;
  return { a, t: t!, c };
}

describe('la plaza que se dibuja', () => {
  test('sin trazado no hay ciudad', () => {
    const { a } = plaza('aldea');
    expect(ciudadEnVista(a, undefined, { instante: 0 })).toBeNull();
  });

  for (const nombre of ['aldea', 'pueblo', 'ciudad']) {
    test(`${nombre}: cada edificio de la plaza, en su huella tal cual; los del mapa, fuera`, () => {
      const { a, t, c } = plaza(nombre);
      const internos = a.edificios.filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa' && t.huellas[e.id]);
      expect(c.edificios.map((e) => e.id).sort()).toEqual(internos.map((e) => e.id).sort());
      for (const e of c.edificios) expect({ x: e.x, y: e.y, ancho: e.ancho, alto: e.alto }).toEqual(t.huellas[e.id]);
    });

    test(`${nombre}: las celdas libres no pisan calles, caminos, huellas ni muralla`, () => {
      const { c } = plaza(nombre);
      const T = c.celda;
      const pisa = (x: number, y: number, r: { x: number; y: number; ancho: number; alto: number }) => x < r.x + r.ancho - 1e-6 && x + T > r.x + 1e-6 && y < r.y + r.alto - 1e-6 && y + T > r.y + 1e-6;
      const rects = [...c.calles, ...c.caminos, ...c.edificios], muro = c.recintos.flatMap((r) => r.celdas);
      const malas = c.libres.filter((l) => rects.some((r) => pisa(l.x, l.y, r)) || muro.some((k) => Math.abs(l.x + T / 2 - k.x) < T / 2 && Math.abs(l.y + T / 2 - k.y) < T / 2));
      expect(malas.slice(0, 3)).toEqual([]);
    }, 30_000);

    test(`${nombre}: ninguna pieza de un edificio sale de su huella más que un alero, en ningún estilo ni estado`, () => {
      const { c } = plaza(nombre);
      let peor = { fuera: 0, que: '' };
      for (const estilo of [1, 2, 3, 4, 5]) for (const estado of ['activo', 'en_construccion', 'en_cola'] as const) for (const e of c.edificios) {
        const p = new Piezas();
        montarEdificio(p, { ...e, estilo, estado, avance: estado === 'en_construccion' ? 0.5 : null });
        for (const q of p.lista) {
          const fuera = salida(q, e);
          if (fuera > peor.fuera) peor = { fuera, que: `${e.tipo} estilo ${estilo} ${estado}: ${q.forma}` };
        }
      }
      expect(peor.fuera, peor.que).toBeLessThanOrEqual(ALERO);
    }, 30_000);
  }

  test('la cámara de entrada encuadra lo construido, no el radio entero', () => {
    const { c } = plaza('ciudad');
    expect(c.nucleo).toBeLessThan(c.radio);
    expect(c.nucleo).toBeGreaterThan(20);
  });

  test('la muralla: en pie lo que lleva hecho, y su nivel', () => {
    const { a, c } = plaza('ciudad');
    for (const r of a.recintos ?? []) {
      const v = c.recintos.find((x) => x.id === r.id)!;
      expect(v.celdas.filter((k) => k.enPie).length).toBe(Math.min(r.avance, r.celdas.length));
    }
  });
});

describe('el campamento de mercenarios', () => {
  const campamento = (n: number) => escenaCampamento(fromBinary(CampamentoMercenariosSchema, readFileSync(new URL(`./ciudad3d/ciudades/campamento-${n}.bin`, import.meta.url))))!;

  for (const n of [0, 1, 2]) {
    test(`campamento ${n}: cada pieza en su huella exacta (centro y lados del motor), las viviendas como tiendas, de nivel 1`, () => {
      const e = campamento(n), c = campamentoEnVista(e, { instante: 0 })!, T = e.unidadesPorCelda;
      expect(c.nivel).toBe(1);
      expect(c.edificios.length).toBe(e.edificios.length);
      for (const p of e.edificios) {
        const v = c.edificios.find((x) => x.id === p.edificioId)!;
        expect({ x: v.x + v.ancho / 2, y: v.y + v.alto / 2, ancho: v.ancho, alto: v.alto }).toEqual({ x: p.posicion.x, y: p.posicion.y, ancho: p.ancho * T, alto: p.alto * T });
        expect(v.tipo).toBe(p.tipo === 'vivienda' ? 'tienda' : p.tipo);
        expect(v.estilo).toBe(1);
      }
    });

    test(`campamento ${n}: la empalizada es un anillo cerrado, celda a celda, con todas sus celdas y la puerta`, () => {
      const e = campamento(n), c = campamentoEnVista(e, { instante: 0 })!;
      expect(c.recintos.length).toBe(1);
      const r = c.recintos[0]!;
      expect(r.cerrado).toBe(true);
      expect(r.celdas.length).toBe(e.empalizada.length);
      expect(r.celdas.every((k) => k.enPie && k.nivel === 1)).toBe(true);
      expect(r.celdas.filter((k) => k.clase === 'puerta').length).toBe(e.empalizada.filter((k) => k.clase === 'puerta').length);
      // de vecina en vecina: cada celda toca a la siguiente
      for (let i = 0; i < r.celdas.length; i++) {
        const a = r.celdas[i]!, b = r.celdas[(i + 1) % r.celdas.length]!;
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThanOrEqual(c.celda + 1e-6);
      }
    });

    test(`campamento ${n}: lo de dentro de la empalizada no pisa piezas, calles ni empalizada; ni huertos ni rediles dentro`, () => {
      const c = campamentoEnVista(campamento(n), { instante: 0 })!, T = c.celda;
      const pisa = (x: number, y: number, r: { x: number; y: number; ancho: number; alto: number }) => x < r.x + r.ancho - 1e-6 && x + T > r.x + 1e-6 && y < r.y + r.alto - 1e-6 && y + T > r.y + 1e-6;
      const rects = [...c.calles, ...c.caminos, ...c.edificios], muro = c.recintos.flatMap((r) => r.celdas);
      const malas = c.libres.filter((l) => rects.some((r) => pisa(l.x, l.y, r)) || muro.some((k) => Math.abs(l.x + T / 2 - k.x) < T / 2 && Math.abs(l.y + T / 2 - k.y) < T / 2));
      expect(malas.slice(0, 3)).toEqual([]);
      expect(c.libres.filter((l) => !l.campo && (l.tipo === 'huerto' || l.tipo === 'patio')).length).toBe(0);
    });
  }

  test('las tiendas, en cualquier variante, no salen de su celda más que un alero', () => {
    let peor = { fuera: 0, que: '' };
    for (let k = 0; k < 300; k++) {
      const e = { id: `t-${k}`, tipo: 'tienda', x: 0, y: 0, ancho: 3, alto: 3, estado: 'activo' as const, avance: null, mejora: false, danado: false, nivel: 1, estilo: 1, semilla: k * 7919 };
      const p = new Piezas();
      montarEdificio(p, e);
      for (const q of p.lista) { const fuera = salida(q, e); if (fuera > peor.fuera) peor = { fuera, que: `semilla ${e.semilla}: ${q.forma}` }; }
    }
    expect(peor.fuera, peor.que).toBeLessThanOrEqual(ALERO);
  });

  test('los anillos: de vecina en vecina, y otro anillo si no se tocan', () => {
    const cuadrado = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]].map(([col, row]) => ({ col: col!, row: row! }));
    const desordenado = [...cuadrado].reverse().sort((a, b) => a.col - b.col);
    const [uno, ...otros] = anillosDe(desordenado);
    expect(otros).toEqual([]);
    expect(uno!.map((k) => `${k.col},${k.row}`)).toEqual(['0,0', '1,0', '2,0', '2,1', '2,2', '1,2', '0,2', '0,1']);
    expect(anillosDe([...cuadrado, { col: 10, row: 10 }, { col: 11, row: 10 }]).length).toBe(2);
  });
});

describe('las calles', () => {
  for (const nombre of ['aldea', 'pueblo', 'ciudad']) {
    test(`${nombre}: la red son las celdas de calle y camino del trazado, y la forma de cada una casa con sus vecinas`, () => {
      const { c } = plaza(nombre);
      const T = c.celda, celdas = new Set<string>();
      for (const r of [...c.calles, ...c.caminos]) {
        for (let x = r.x; x < r.x + r.ancho - 1e-6; x += T) for (let y = r.y; y < r.y + r.alto - 1e-6; y += T) celdas.add(`${Math.round(x / T)},${Math.round(y / T)}`);
      }
      expect(new Set(c.red.map((x) => `${x.c},${x.f}`))).toEqual(celdas);
      const hay = (a: number, b: number) => celdas.has(`${a},${b}`);
      const malas = c.red.filter((x) => {
        const lados = (hay(x.c + 1, x.f) ? 1 : 0) | (hay(x.c, x.f + 1) ? 2 : 0) | (hay(x.c - 1, x.f) ? 4 : 0) | (hay(x.c, x.f - 1) ? 8 : 0);
        return x.lados !== lados || girarLados(FORMA_BASE[x.forma], x.giro) !== x.lados;
      });
      expect(malas.slice(0, 3)).toEqual([]);
      // hay calles principales y callejones, y las principales llevan a las salidas
      if (nombre !== 'aldea') expect(c.red.filter((x) => x.clase === 'callejon').length).toBeGreaterThan(0);
      expect(c.red.filter((x) => x.clase === 'principal').length).toBeGreaterThan(0);
    });

    test(`${nombre}: los guardacantones van en celdas de calle, y las teselas iguales se pintan una vez`, () => {
      const { c } = plaza(nombre);
      const T = c.celda, celdas = new Set(c.red.map((x) => `${x.c},${x.f}`)), p = new Piezas();
      montarGuardacantones(p, c);
      for (const q of p.lista) expect(celdas.has(`${Math.floor(q.x / T)},${Math.floor(q.z / T)}`)).toBe(true);
      for (const nivel of [1, 4, 5]) {
        const { deCelda, distintas } = teselasDe(c.red, nivel);
        expect(deCelda.length).toBe(c.red.length);
        expect(distintas.size).toBeLessThanOrEqual(420);
      }
    });
  }
});

describe('el estilo de cada casa', () => {
  test('va con el nivel de la plaza; algunas casas, un nivel atrás; los edificios de gobierno, nunca', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `ed-${i}`);
    const estilos = ids.map((id) => estiloDe(id, 'vivienda', 4, undefined, 0));
    expect(new Set(estilos)).toEqual(new Set([3, 4]));
    expect(estilos.filter((x) => x === 3).length).toBeLessThan(ids.length * 0.3);
    expect(ids.every((id) => estiloDe(id, 'centroUrbano', 4, undefined, 0) === 4)).toBe(true);
    expect(estiloDe('ed-1', 'vivienda', 1, undefined, 0)).toBe(1);
  });

  test('al subir de nivel, la ciudad cambia por partes y el gobierno al final', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `ed-${i}`);
    const ascenso = { nivelObjetivo: 4, iniciadoEn: 0, completaEn: 1000 };
    const nuevas = (t: number) => ids.filter((id) => estiloDe(id, 'vivienda', 3, ascenso, t) === 4).length;
    expect(nuevas(0)).toBe(0);
    expect(nuevas(500)).toBeGreaterThan(ids.length * 0.35);
    expect(nuevas(500)).toBeLessThan(ids.length * 0.65);
    expect(estiloDe('ed-1', 'palacio', 3, ascenso, 500)).toBe(3);
    expect(estiloDe('ed-1', 'palacio', 3, ascenso, 1000)).toBe(4);
  });
});

/** Lo más que una pieza puede asomar fuera de su huella (un alero, un poste de la valla), en ul (0,2 ul = 60 cm). */
const ALERO = 0.2;

/** Cuánto asoma una pieza fuera del rectángulo `e` (negativo: dentro), con su forma de verdad (girada, inclinada y escalada como en la malla). */
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3(), P = new THREE.Vector3();
function salida(q: Pieza, e: { x: number; y: number; ancho: number; alto: number }): number {
  // todas las formas caben en la caja de lado 1 con la base en y = 0 (`piezas.ts`)
  M.compose(V.set(q.x, q.y, q.z), Q.setFromEuler(E.set(q.inclina ?? 0, -q.giro, 0)), S.set(q.ancho, q.alto, q.fondo));
  let peor = -Infinity;
  for (const cx of [-0.5, 0.5]) for (const cy of [0, 1]) for (const cz of [-0.5, 0.5]) {
    P.set(cx, cy, cz).applyMatrix4(M);
    peor = Math.max(peor, e.x - P.x, P.x - (e.x + e.ancho), e.y - P.z, P.z - (e.y + e.alto));
  }
  return peor;
}
