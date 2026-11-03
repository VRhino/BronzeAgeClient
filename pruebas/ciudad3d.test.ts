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
import { COLOR } from '../src/ciudad3d/config';
import { montarEdificio } from '../src/ciudad3d/modelos';
import { idDeCeldaDeMuro, montarMurallas } from '../src/ciudad3d/murallas';
import { puebloEnVista } from '../src/ciudad3d/pueblo';
import { Piezas, type Pieza } from '../src/ciudad3d/piezas';
import { AsentamientoSchema, CampamentoMercenariosSchema } from '../src/contrato/gen/bronzeage/v1/entities_pb';
import { escenaCampamento, plazaDeContrato } from '../src/motor/proyeccion';
import type { Asentamiento, EscenaPueblo, TrazadoAsentamiento } from '../src/tiposDominio';

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

  test('un puesto de mercado de una plaza de nivel 2 o más nunca se queda en tenderete', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `ed-${i}`);
    expect(ids.every((id) => estiloDe(id, 'puestoMercado', 2, undefined, 0) === 2)).toBe(true);
    expect(new Set(ids.map((id) => estiloDe(id, 'puestoMercado', 3, undefined, 0)))).toEqual(new Set([2, 3]));
    expect(estiloDe('ed-1', 'puestoMercado', 1, undefined, 0)).toBe(1);
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

describe('los pueblos extractores y las aldeas', () => {
  // las plantas que saca `urbanismo::planta_de_pueblo` del motor (posición en milésimas de ul, lados en ul), como las mandará VISTA
  type Json = { id: string; tipoExtractor: string; planta: { id: string; tipo: string; posicion: { x: number; y: number }; ancho: number; alto: number }[]; trazado: { unidadesPorCelda: number; radioUl: number; calles: EscenaPueblo['calles']; caminos: EscenaPueblo['caminos'] } };
  const escena = (nombre: string, nivelMadre?: number): EscenaPueblo => {
    const j = JSON.parse(readFileSync(new URL(`./ciudad3d/pueblos/${nombre}.json`, import.meta.url), 'utf8')) as Json;
    return {
      puebloId: j.id, tipo: j.tipoExtractor, nivelMadre, unidadesPorCelda: j.trazado.unidadesPorCelda, radio: j.trazado.radioUl,
      edificios: j.planta.map((p) => ({ edificioId: p.id, tipo: p.tipo, posicion: { x: p.posicion.x / 1000, y: p.posicion.y / 1000 }, ancho: p.ancho, alto: p.alto })),
      calles: j.trazado.calles, caminos: j.trazado.caminos,
    };
  };
  const PUEBLOS = ['cantera', 'mina', 'mina-cobre', 'mina-estano', 'mina-hierro', 'aldea-1', 'aldea-2', 'aldea-3'];

  for (const nombre of PUEBLOS) {
    test(`${nombre}: cada pieza en su huella exacta, el estilo de la plaza madre hasta el 3`, () => {
      const e = escena(nombre, 5), c = puebloEnVista(e, { instante: 0 })!;
      expect(c.nivel).toBe(3);
      expect(puebloEnVista(escena(nombre), { instante: 0 })!.nivel).toBe(1);
      expect(c.edificios.length).toBe(e.edificios.length);
      for (const p of e.edificios) {
        const v = c.edificios.find((x) => x.id === p.edificioId)!;
        expect({ x: v.x + v.ancho / 2, y: v.y + v.alto / 2, ancho: v.ancho, alto: v.alto, tipo: v.tipo }).toEqual({ x: p.posicion.x, y: p.posicion.y, ancho: p.ancho, alto: p.alto, tipo: p.tipo });
      }
    });

    test(`${nombre}: lo que llena las celdas libres no pisa piezas ni calles`, () => {
      const c = puebloEnVista(escena(nombre, 2), { instante: 0 })!, T = c.celda;
      const pisa = (x: number, y: number, r: { x: number; y: number; ancho: number; alto: number }) => x < r.x + r.ancho - 1e-6 && x + T > r.x + 1e-6 && y < r.y + r.alto - 1e-6 && y + T > r.y + 1e-6;
      expect(c.libres.filter((l) => [...c.calles, ...c.caminos, ...c.edificios].some((r) => pisa(l.x, l.y, r))).slice(0, 3)).toEqual([]);
    });
  }

  test('las bocaminas de cada metal y la cantera, en cualquier estilo y variante, no salen de su parcela más que un alero', () => {
    let peor = { fuera: 0, que: '' };
    for (const tipo of ['mina', 'minaCobre', 'minaEstano', 'minaHierro', 'cantera']) for (const estilo of [1, 2, 3]) for (let k = 0; k < 120; k++) {
      const e = { id: `p-${k}`, tipo, x: 0, y: 0, ancho: 3, alto: 3, estado: 'activo' as const, avance: null, mejora: false, danado: false, nivel: 1, estilo, semilla: k * 7919 + 13 };
      const p = new Piezas();
      montarEdificio(p, e);
      expect(p.lista.length).toBeGreaterThan(10);
      for (const q of p.lista) { const fuera = salida(q, e); if (fuera > peor.fuera) peor = { fuera, que: `${tipo} estilo ${estilo} semilla ${e.semilla}: ${q.forma}` }; }
    }
    expect(peor.fuera, peor.que).toBeLessThanOrEqual(ALERO);
  });
});

describe('las tiendas del mercado', () => {
  // los puestos de 1 × 1, 1 × 2 y 1 × 3 celdas, tumbados y de pie (`PUESTO_MERCADO_FORMA` del motor)
  const HUELLAS = [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3]] as const;
  const puesto = (cw: number, ch: number, estilo: number, frente: 1 | -1 | undefined, semilla: number) =>
    ({ id: `pm-${semilla}`, tipo: 'puestoMercado', x: 0, y: 0, ancho: cw * 3, alto: ch * 3, estado: 'activo' as const, avance: null, mejora: false, danado: false, nivel: cw * ch === 2 ? 1 : cw * ch === 3 ? 2 : 3, estilo, semilla, frente });
  const toldos = (p: Piezas) => p.lista.filter((q) => q.forma === 'caja' && Math.abs(q.alto - 0.05) < 1e-9 && (COLOR.toldo as readonly number[]).includes(q.color));

  test('en cualquier forma, estilo y lado de la calle, no salen de su huella más que un alero', () => {
    let peor = { fuera: 0, que: '' };
    for (const [cw, ch] of HUELLAS) for (const estilo of [1, 2, 3, 4, 5]) for (const frente of [1, -1, undefined] as const) for (let k = 0; k < 25; k++) {
      const e = puesto(cw, ch, estilo, frente, k * 7919 + 5);
      const p = new Piezas();
      montarEdificio(p, e);
      for (const q of p.lista) { const fuera = salida(q, e); if (fuera > peor.fuera) peor = { fuera, que: `${cw}×${ch} estilo ${estilo} frente ${frente} semilla ${e.semilla}: ${q.forma}` }; }
    }
    expect(peor.fuera, peor.que).toBeLessThanOrEqual(ALERO);
  });

  test('de estilo 2 en adelante abren a la calle: el toldo cae del lado del frente', () => {
    for (const [cw, ch] of HUELLAS) for (const estilo of [2, 3, 4, 5]) for (const frente of [1, -1] as const) for (let k = 0; k < 10; k++) {
      const e = puesto(cw, ch, estilo, frente, k * 104_729 + 3);
      const p = new Piezas();
      montarEdificio(p, e);
      const ts = toldos(p);
      expect(ts.length, `${cw}×${ch} estilo ${estilo}`).toBeGreaterThan(0);
      // tumbado, +v es hacia abajo (+y del plano); de pie, hacia la izquierda (−x)
      for (const q of ts) {
        if (e.ancho >= e.alto) expect(Math.sign(q.z - e.alto / 2)).toBe(frente);
        else expect(Math.sign(e.ancho / 2 - q.x)).toBe(frente);
      }
    }
  });

  test('en la ciudad, el frente de cada puesto da a una calle o un camino', () => {
    const { c } = plaza('ciudad'), T = c.celda;
    const puestos = c.edificios.filter((e) => e.tipo === 'puestoMercado');
    expect(puestos.some((e) => e.frente !== undefined)).toBe(true);
    const enVia = (x: number, y: number) => [...c.calles, ...c.caminos].some((r) => x > r.x && x < r.x + r.ancho && y > r.y && y < r.y + r.alto);
    for (const e of puestos.filter((x) => x.frente !== undefined)) {
      const delante = e.ancho >= e.alto
        ? Array.from({ length: Math.round(e.ancho / T) }, (_, i) => [e.x + T * (i + 0.5), e.frente === 1 ? e.y + e.alto + T / 2 : e.y - T / 2])
        : Array.from({ length: Math.round(e.alto / T) }, (_, i) => [e.frente === 1 ? e.x - T / 2 : e.x + e.ancho + T / 2, e.y + T * (i + 0.5)]);
      expect(delante.some(([x, y]) => enVia(x!, y!)), e.id).toBe(true);
    }
  });
});

describe('el Albergue de caravanas', () => {
  // su huella del motor: 2 × 3 celdas de 3 ul, tumbada (9 × 6) o de pie (6 × 9)
  const albergue = (ancho: number, alto: number, estilo: number, nivel: number, frente: 1 | -1 | undefined, semilla: number, estado: 'activo' | 'en_construccion' | 'en_cola' = 'activo') =>
    ({ id: `alb-${semilla}`, tipo: 'albergueCaravanas', x: 30, y: -12, ancho, alto, estado, avance: estado === 'en_construccion' ? 0.5 : null, mejora: false, danado: false, nivel, estilo, semilla, frente });
  const ruedas = (p: Piezas) => p.lista.filter((q) => q.forma === 'cilindro' && q.inclina !== undefined && Math.abs(q.ancho - 0.38) < 1e-9).length;
  const bestias = (p: Piezas) => p.lista.filter((q) => q.forma === 'caja' && (q.color === COLOR.buey || q.color === COLOR.asno) && q.alto > 0.15).length;

  test('en cualquier estilo, nivel, lado de la calle y estado, no sale de su huella más que un alero', () => {
    let peor = { fuera: 0, que: '' };
    for (const [w, h] of [[9, 6], [6, 9]] as const) for (const estilo of [1, 2, 3, 4, 5]) for (const nivel of [1, 2, 3]) for (const frente of [1, -1, undefined] as const)
      for (const estado of ['activo', 'en_construccion', 'en_cola'] as const) for (let k = 0; k < 12; k++) {
        const e = albergue(w, h, estilo, nivel, frente, k * 7919 + 11, estado);
        const p = new Piezas();
        montarEdificio(p, { ...e, mejora: estado === 'activo' && k % 3 === 0 });
        for (const q of p.lista) { const fuera = salida(q, e); if (fuera > peor.fuera) peor = { fuera, que: `${w}×${h} estilo ${estilo} nivel ${nivel} frente ${frente} ${estado} semilla ${e.semilla}: ${q.forma}` }; }
      }
    expect(peor.fuera, peor.que).toBeLessThanOrEqual(ALERO);
  });

  test('cuanto más nivel, más carros y más bestias', () => {
    for (const estilo of [1, 3, 5]) for (let k = 0; k < 6; k++) {
      const cuenta = [1, 2, 3].map((nivel) => { const p = new Piezas(); montarEdificio(p, albergue(9, 6, estilo, nivel, 1, k * 104_729 + 3)); return { ruedas: ruedas(p), bestias: bestias(p) }; });
      // nivel 1: tres carros en el cobertizo y uno en el patio; nivel 2: cuatro y uno; nivel 3: cinco, uno y el largo de cuatro ruedas
      expect(cuenta.map((c) => c.ruedas)).toEqual([8, 10, 16]);
      expect(cuenta.map((c) => c.bestias)).toEqual([2, 4, 6]);
    }
  });

  test('el portón da a la calle: hueco en la tapia del frente, tapia en la del fondo', () => {
    for (const [w, h] of [[9, 6], [6, 9]] as const) for (const estilo of [1, 2, 3, 4, 5]) for (const frente of [1, -1] as const) for (let k = 0; k < 4; k++) {
      const e = albergue(w, h, estilo, 1 + (k % 3), frente, k * 31 + 7), p = new Piezas();
      montarEdificio(p, e);
      // el punto medio del lado largo del frente (tumbado, +v es hacia abajo; de pie, hacia la izquierda) y el del fondo, a 0,3 ul del borde
      const cx = e.x + w / 2, cy = e.y + h / 2, d = Math.min(w, h) / 2 - 0.2;
      const delante = w >= h ? { x: cx, y: cy + frente * d } : { x: cx - frente * d, y: cy };
      const detras = w >= h ? { x: cx, y: cy - frente * d } : { x: cx + frente * d, y: cy };
      const tapan = (pt: { x: number; y: number }) => p.lista.filter((q) => q.forma !== 'losa' && contiene(q, pt.x, 0.25, pt.y)).length;
      expect(tapan(delante), `${w}×${h} estilo ${estilo} frente ${frente}`).toBe(0);
      expect(tapan(detras), `${w}×${h} estilo ${estilo} frente ${frente}`).toBeGreaterThan(0);
    }
  });
});

describe('las puertas de muralla', () => {
  // la muralla del pueblo y la de la ciudad (anillos cerrados con su puerta), levantadas enteras en cada nivel
  const recintos = (nombre: string, nivel: number) => plaza(nombre).c.recintos.map((r) => ({ ...r, mejorandoA: undefined, celdas: r.celdas.map((k) => ({ ...k, enPie: true, nivel })) }));

  test('se dibujan de vecina en vecina aunque el motor mande las celdas en otro orden (la ciudad lleva una torre al final de la lista)', () => {
    const { a, c } = plaza('ciudad');
    const lista = a.recintos![0]!.celdas, salta = (p: { col: number; row: number }, q: { col: number; row: number }) => Math.max(Math.abs(p.col - q.col), Math.abs(p.row - q.row)) > 1;
    expect(lista.some((k, i) => salta(k, lista[(i + 1) % lista.length]!))).toBe(true);
    const r = c.recintos[0]!;
    expect(r.cerrado).toBe(true);
    expect(r.celdas.every((k, i) => { const s = r.celdas[(i + 1) % r.celdas.length]!; return Math.max(Math.abs(k.x - s.x), Math.abs(k.y - s.y)) <= c.celda + 1e-6; })).toBe(true);
    // lo levantado sigue el orden de las obras del motor
    expect(r.celdas.filter((k) => k.enPie).length).toBe(Math.min(a.recintos![0]!.avance, lista.length));
  });

  for (const [nombre, nivel] of [['pueblo', 1], ['pueblo', 2], ['pueblo', 3], ['ciudad', 1], ['ciudad', 2], ['ciudad', 3]] as const) {
    test(`${nombre}, nivel ${nivel}: una torre a cada lado del paso, más alta que el muro, sin salir de su celda más que un alero`, () => {
      const rs = recintos(nombre, nivel), p = new Piezas();
      montarMurallas(p, rs);
      for (const r of rs) {
        const N = r.celdas.length, T = 3;
        const arriba = (i: number) => Math.max(...p.lista.filter((q) => q.de === idDeCeldaDeMuro(r.id, i)).map((q) => q.y + q.alto));
        const muro = Math.max(...r.celdas.map((k, i) => (k.clase === 'muro' && r.celdas[(i + 1) % N]!.clase !== 'puerta' && r.celdas[(i - 1 + N) % N]!.clase !== 'puerta' ? arriba(i) : 0)));
        const puertas = r.celdas.flatMap((k, i) => (k.clase === 'puerta' ? [i] : []));
        expect(puertas.length).toBeGreaterThan(0);
        for (const i of puertas) for (const j of [(i - 1 + N) % N, (i + 1) % N]) {
          const k = r.celdas[j]!;
          if (k.clase === 'puerta') continue;
          // una torre de las otras (de vigía, el bastión) a un lado de la puerta también la flanquea; la de la puerta, más alta que el muro
          expect(arriba(j), `celda ${j}`).toBeGreaterThan(muro + 0.5);
          const celda = { x: k.x - T / 2, y: k.y - T / 2, ancho: T, alto: T };
          // las torres de la puerta: lo que pasa de la altura del muro, dentro de su celda
          for (const q of p.lista.filter((x) => x.de === idDeCeldaDeMuro(r.id, j) && x.y + x.alto > muro + 0.3)) expect(salida(q, celda), `${q.forma} en la celda ${j}`).toBeLessThanOrEqual(ALERO);
        }
      }
    });
  }
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

/** Si el punto (x, y, z) de la escena cae dentro de la caja que envuelve la pieza (girada, inclinada y escalada como en la malla). */
function contiene(q: Pieza, x: number, y: number, z: number): boolean {
  M.compose(V.set(q.x, q.y, q.z), Q.setFromEuler(E.set(q.inclina ?? 0, -q.giro, 0)), S.set(q.ancho, q.alto, q.fondo)).invert();
  P.set(x, y, z).applyMatrix4(M);
  return Math.abs(P.x) <= 0.5 && P.y >= 0 && P.y <= 1 && Math.abs(P.z) <= 0.5;
}
