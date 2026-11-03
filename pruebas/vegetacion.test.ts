import { describe, expect, it } from 'vitest';
import { caucesDe, type Entorno } from '../src/mundo3d/arboles';
import { MUNDO3D } from '../src/mundo3d/config';
import { ESPECIES, especieDe, geometrias, RIBERA, zonaDe } from '../src/mundo3d/especies';
import type { FuenteDeAltura } from '../src/mundo3d/fuente';
import { matasDelTrozo, POR_MATA, probabilidades, TIPOS_DE_MATA } from '../src/mundo3d/matas';
import { colorDelSuelo } from '../src/mundo3d/terreno';
import { AVES, bandadas, chimeneas } from '../src/mundo3d/vida';
import type { MapaGenerado } from '../src/terreno';

// El suelo, los árboles por especie y la vegetación baja del mundo 3D (Víctor, 2026-11-03: «mejorar el piso, con vegetación y diferentes
// tipos de árboles»).

const U = MUNDO3D.umbrales;
const cuenta = (lista: number[]) => {
  const c: Record<string, number> = {};
  for (const e of lista) c[ESPECIES[e]!] = (c[ESPECIES[e]!] ?? 0) + 1;
  return c;
};
/** Las especies de una rejilla de árboles a la altura `h` y con el agua a `d` u. */
const especiesEn = (h: number, d: number) => {
  const out: number[] = [];
  for (let y = 0; y < 400; y += 2) for (let x = 0; x < 400; x += 2) out.push(especieDe(x, y, h, d, ((x * 7919 + y * 104729) % 1000) / 1000));
  return cuenta(out);
};

describe('especies de árbol', () => {
  it('zonas por altura y agua cercana', () => {
    expect(zonaDe(0, 0, 390, 1)).toBe('ribera');
    expect(zonaDe(0, 0, 480, RIBERA + 5)).toBe('llano');
    expect(zonaDe(0, 0, 650, 1)).toBe('montana'); // en la montaña no hay ribera
  });
  it('en la montaña, sobre todo abetos; en la ribera baja, álamos y palmeras', () => {
    const monte = especiesEn(650, 99), total = Object.values(monte).reduce((a, b) => a + b, 0);
    expect(monte.abeto! / total).toBeGreaterThan(0.5);
    expect(monte.palmera ?? 0).toBe(0);
    const ribera = especiesEn(390, 1), t2 = Object.values(ribera).reduce((a, b) => a + b, 0);
    expect(((ribera.alamo ?? 0) + (ribera.palmera ?? 0)) / t2).toBeGreaterThan(0.7);
  });
  it('el ciprés va suelto: nunca manda en una mancha', () => {
    const llano = especiesEn(480, 99), total = Object.values(llano).reduce((a, b) => a + b, 0);
    expect(llano.cipres! / total).toBeLessThan(0.1);
    expect(llano.cipres).toBeGreaterThan(0);
  });
  it('el mismo árbol, la misma especie', () => {
    expect(especieDe(123.4, 567.8, 480, 9, 0.42)).toBe(especieDe(123.4, 567.8, 480, 9, 0.42));
  });
  it('geometrías: una por especie de cerca, cuatro de lejos; la copa toma el color del árbol y el tronco no', () => {
    const g = geometrias();
    expect(g.cerca).toHaveLength(ESPECIES.length);
    expect(g.lejos).toHaveLength(4);
    expect(g.grupoLejos.every((k) => k >= 0 && k < 4)).toBe(true);
    const encina = g.cerca[ESPECIES.indexOf('encina')]!, tinte = encina.getAttribute('tinte');
    let tronco = 0, copa = 0;
    for (let k = 0; k < tinte.count; k++) (tinte.getX(k) ? copa++ : tronco++);
    expect(tronco).toBeGreaterThan(0);
    expect(copa).toBeGreaterThan(tronco);
    expect(encina.getAttribute('color').count).toBe(tinte.count);
  });
});

describe('suelo', () => {
  it('más verde cuanto más fértil, y nada en la montaña', () => {
    const verde = (c: number[]) => c[1]! / c[0]!;
    expect(verde(colorDelSuelo(480, 0, 0, 0.9, 10, 10))).toBeGreaterThan(verde(colorDelSuelo(480, 0, 0, 0.05, 10, 10)) + 0.1);
    const monte = colorDelSuelo(650, 0, 0, 0.9, 10, 10), monteSeco = colorDelSuelo(650, 0, 0, 0.05, 10, 10);
    expect(verde(monte)).toBeCloseTo(verde(monteSeco), 2);
  });
});

describe('vegetación baja', () => {
  const T = Object.fromEntries(TIPOS_DE_MATA.map((n, k) => [n, k]));
  it('las probabilidades suman como mucho 1', () => {
    for (const h of [376, 450, 560, 650]) for (const p of [0, 0.5, 1.2]) for (const f of [0, 0.5, 1]) for (const d of [0, 1, 9]) {
      const s = probabilidades(h, p, f, 0.3, d, 0.9).reduce((a, b) => a + b, 0);
      expect(s).toBeLessThanOrEqual(1.000001);
    }
  });
  it('juncos solo junto al agua; flores solo en suelo fértil; más hierba cuanto más fértil; más piedra cuanto más empinado', () => {
    expect(probabilidades(450, 0, 0.5, 0, 0.3, 0.5)[T.junco!]).toBeGreaterThan(0.3);
    expect(probabilidades(450, 0, 0.5, 0, 5, 0.5)[T.junco!]).toBe(0);
    expect(probabilidades(450, 0, 0.1, 0, 9, 0.9)[T.flor!]).toBe(0);
    expect(probabilidades(450, 0, 0.7, 0, 9, 0.9)[T.flor!]).toBeGreaterThan(0.1);
    expect(probabilidades(450, 0, 0.8, 0, 9, 0)[T.hierba!]).toBeGreaterThan(probabilidades(450, 0, 0.1, 0, 9, 0)[T.hierba!]! * 2);
    expect(probabilidades(560, 1, 0.2, 0, 9, 0)[T.piedra!]).toBeGreaterThan(probabilidades(560, 0, 0.2, 0, 9, 0)[T.piedra!]! * 4);
  });

  const llano: FuenteDeAltura = { ancho: 64, alto: 64, paso: 0.5, alturaEn: () => 450, aguaEn: () => false };
  const pradera = { config: { ancho: 64, alto: 64, seed: 0 }, rios: [], rasters: { fertilidad: { columnas: 16, filas: 16, celda: 4, datos: new Uint8Array(256).fill(200) } } } as unknown as MapaGenerado;
  const entorno = (cambios: Partial<Entorno> = {}): Entorno => ({ fuente: llano, mapa: pradera, cauces: caucesDe(pradera), claros: [], ...cambios });

  it('en una pradera fértil, sobre todo hierba; lejos quedan las de cerca, menos', () => {
    const todas = matasDelTrozo(entorno(), 0, 0, 16, 1), n = todas.length / POR_MATA;
    let hierba = 0;
    for (let k = 0; k < n; k++) if (todas[POR_MATA * k + 4] === T.hierba) hierba++;
    expect(hierba / n).toBeGreaterThan(0.6);
    expect(n / 256).toBeGreaterThan(1.5); // de 4 candidatas por u²
    const mitad = matasDelTrozo(entorno(), 0, 0, 16, 0.5), claves = new Set<string>();
    for (let k = 0; k < todas.length; k += POR_MATA) claves.add(`${todas[k]},${todas[k + 1]}`);
    expect(mitad.length / todas.length).toBeGreaterThan(0.35);
    expect(mitad.length / todas.length).toBeLessThan(0.65);
    for (let k = 0; k < mitad.length; k += POR_MATA) expect(claves.has(`${mitad[k]},${mitad[k + 1]}`)).toBe(true);
  });
  it('ni en el agua ni en un claro', () => {
    expect(matasDelTrozo(entorno({ fuente: { ...llano, aguaEn: () => true } }), 0, 0, 8, 1).length).toBe(0);
    const conClaro = matasDelTrozo(entorno({ claros: [{ x: 8, y: 8, r: 3 }] }), 0, 0, 16, 1);
    for (let k = 0; k < conClaro.length; k += POR_MATA) expect(Math.hypot(conClaro[k]! - 8, conClaro[k + 1]! - 8)).toBeGreaterThanOrEqual(3);
  });
  it('junto a un lago, juncos', () => {
    // agua a la izquierda de x = 4
    const orilla: FuenteDeAltura = { ...llano, alturaEn: () => U.agua + 5, aguaEn: (x) => x < 4 };
    const lista = matasDelTrozo(entorno({ fuente: orilla }), 0, 0, 16, 1);
    let juncos = 0;
    for (let k = 0; k < lista.length; k += POR_MATA) if (lista[k + 4] === T.junco) { juncos++; expect(lista[k]!).toBeLessThan(6); }
    expect(juncos).toBeGreaterThan(5);
  });
});

describe('vida: humo y pájaros', () => {
  const vacio = { plazas: [], pueblos: [], avanzadas: [], obras: [], campamentos: [], bandidos: [], alijos: [], batallas: [], trazos: [] };
  it('humo: más columnas cuanto más nivel la plaza, ninguna en una recordada; una por pueblo, avanzada en pie desde el fuerte y campamento', () => {
    const plaza = (nivel: number, recordada = false) => ({ id: 'p', posicion: { x: 100, y: 100 }, radioCiudad: 3, color: '#fff', recordada, nivel });
    expect(chimeneas({ ...vacio, plazas: [plaza(1)] })).toHaveLength(2);
    expect(chimeneas({ ...vacio, plazas: [plaza(5)] })).toHaveLength(4);
    expect(chimeneas({ ...vacio, plazas: [plaza(3, true)] })).toHaveLength(0);
    const resto = chimeneas({
      ...vacio,
      pueblos: [{ id: 'a', posicion: { x: 10, y: 10 }, aldea: true, color: '#fff' }],
      avanzadas: [{ id: 'b', posicion: { x: 20, y: 20 }, etapa: 1, ruinas: false, color: '#fff' }, { id: 'c', posicion: { x: 30, y: 30 }, etapa: 2, ruinas: false, color: '#fff' }, { id: 'd', posicion: { x: 40, y: 40 }, etapa: 3, ruinas: true, color: '#fff' }],
      campamentos: [{ id: 'e', posicion: { x: 50, y: 50 }, radioProteccion: 10 }],
      bandidos: [{ id: 'f', posicion: { x: 60, y: 60 }, nivel: 1 }],
    });
    expect(resto).toHaveLength(4);
    // dentro de la ciudad, siempre en el mismo sitio
    const [a] = chimeneas({ ...vacio, plazas: [plaza(1)] }), [b] = chimeneas({ ...vacio, plazas: [plaza(1)] });
    expect(a).toEqual(b);
    expect(Math.hypot(a!.x - 100, a!.y - 100)).toBeLessThanOrEqual(3 * 0.6 + 1e-9);
  });
  it('pájaros: las bandadas de cada celda son siempre las mismas, y al moverse el héroe las de las celdas que siguen cerca no cambian', () => {
    const aqui = bandadas(500, 500), otraVez = bandadas(500, 500), alLado = bandadas(500 + AVES.celda, 500);
    expect(aqui).toEqual(otraVez);
    const clave = (b: { x: number; y: number }) => `${b.x},${b.y}`, enAlLado = new Set(alLado.map(clave));
    const comunes = aqui.filter((b) => enAlLado.has(clave(b)));
    expect(comunes.length).toBeGreaterThan(0);
    for (const b of [...aqui, ...alLado]) {
      expect(b.radio).toBeGreaterThanOrEqual(4);
      expect(b.pajaros).toBeGreaterThanOrEqual(3);
    }
  });
});
