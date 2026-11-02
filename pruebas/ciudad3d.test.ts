// La plaza 3D sin pintar: lo que sale de la proyección (`ciudadEnVista`) y los modelos hechos en código, contra ciudades reales del motor (las
// de `pruebas/ciudad3d/ciudades/`). Lo primero que se comprueba es que se respeta el trazado: cada edificio en su huella, nada fuera de ella
// más que un alero, y las celdas libres sin pisar calles, huellas ni muralla.
import { readFileSync } from 'node:fs';
import { fromBinary } from '@bufbuild/protobuf';
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { ciudadEnVista, estiloDe, type CiudadEnVista } from '../src/ciudad3d/estado';
import { montarEdificio } from '../src/ciudad3d/modelos';
import { Piezas, type Pieza } from '../src/ciudad3d/piezas';
import { AsentamientoSchema } from '../src/contrato/gen/bronzeage/v1/entities_pb';
import { plazaDeContrato } from '../src/motor/proyeccion';
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
