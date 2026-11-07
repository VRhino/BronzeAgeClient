import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, catalogoDeTecnologia: () => null, tropasReclutables: () => [] }));
import datos from './plaza/datos.json';
import { construirGrafo, cupoEra, datosDesdeCatalogo, estadoDe, parteCumplida, partesLogro, ultimaEraVisible, umbralDe, type EstadoArbol } from '../src/ui/arbolTecnologias';

const docs = (datos as unknown as { documentos: Record<string, Record<string, unknown>> }).documentos;
const bloque = <T,>(n: string): T => Object.values(docs).find((d) => n in d)![n] as T;
const D = datosDesdeCatalogo(
  { TECNOLOGIAS: bloque('TECNOLOGIAS'), ERAS: bloque('ERAS'), TARIFA_ADOPCION: bloque('TARIFA_ADOPCION') },
  bloque('TROPAS_RECLUTABLES'),
  bloque('EDIFICIO_CATALOGO'),
);
const G = construirGrafo(D);

describe('árbol de tecnologías', () => {
  it('se descubre por Eras al 30 % de adoptadas (con las de arranque, hacia arriba)', () => {
    expect(cupoEra(D, 1)).toBe(3);
    expect(ultimaEraVisible(D, ['leva_comunal', 'hostigamiento_tribal'])).toBe(1);
    expect(ultimaEraVisible(D, ['leva_comunal', 'hostigamiento_tribal', 'escudos_ligeros'])).toBe(2);
  });
  it('las líneas son la lista fija de Víctor, todas continuas', () => {
    const de = (id: string): string[] => G.nodos.get(id)!.preds.map((p) => p.de).sort();
    expect(G.nodos.get('arqueria_especializada')!.preds).toEqual([{ de: 'arco_compuesto', tipo: 'hito' }]);
    expect(de('panoplia_bronce')).toEqual(['armamento_palacial', 'bronce_calidad_militar']);
    expect(de('arco_compuesto')).toEqual(['aleacion_bronce', 'arqueria_palacial']);
    expect(de('equitacion_militar')).toEqual(['cria_caballar']);
    expect([...G.nodos.values()].every((n) => n.preds.every((p) => p.tipo === 'hito'))).toBe(true);
    expect(D.tec['cria_caballar']!.nombre).toBe('Cría de caballos');
  });
  it('el logro de reclutar jinetes asirios pide lo que pide esa tropa (reducido a lo directo)', () => {
    expect(new Set(G.logroDe('caballeria_organizada'))).toEqual(new Set(['equitacion_militar', 'cria_caballar', 'forja_hierro_temprana']));
    expect(G.nodos.get('caballeria_organizada')!.preds.map((p) => p.de).sort()).toEqual(['equitacion_militar', 'forja_hierro_temprana']);
  });
  it('estados de la carta', () => {
    const E: EstadoArbol = { adoptadas: ['leva_comunal'], aparecidas: ['escudos_ligeros'], reveladas: new Map([['arqueria_palacial', { cumplidas: [false], hito: [], descubridor: 'f-2' }]]),
      logros: [{ contador: 'extraido.cobre', umbral: 1000 }], eraMundo: 'reinos_palaciales' };
    expect(estadoDe(G, E, 'leva_comunal')).toBe('adoptada');
    expect(estadoDe(G, E, 'escudos_ligeros')).toBe('adoptable');
    expect(estadoDe(G, E, 'arqueria_palacial')).toBe('revelada');
    expect(estadoDe(G, E, 'metalurgia_cobre')).toBe('logro');
    expect(estadoDe(G, E, 'canteria')).toBe('bloqueada');
    expect(estadoDe(G, E, 'forja_hierro_temprana')).toBe('futura');
  });
  it('umbrales por plaza viva y logros de dos partes (motor 8feafd4)', () => {
    const base: EstadoArbol = { adoptadas: [], aparecidas: [], reveladas: new Map(), logros: [], eraMundo: 'reinos_palaciales', plazas: 12 };
    const aleacion = partesLogro(D.tec['aleacion_bronce']!);
    expect(aleacion.map((x) => [x.contador, umbralDe(base, x)])).toEqual([['extraido.cobre', 24000], ['extraido.estano', 12000]]);
    expect(umbralDe({ plazas: 0 }, D.tec['escudos_ligeros']!.logro!)).toBe(20);
    // Pendientes con su umbral de ahora: la metalurgia (12.000 de cobre) ya salió, la aleación no.
    const E = { ...base, pendientes: [{ contador: 'extraido.cobre', umbral: 24000 }, { contador: 'extraido.estano', umbral: 12000 }] };
    expect(parteCumplida(E, D.tec['metalurgia_cobre']!.logro!)).toBe(true);
    expect(aleacion.map((x) => parteCumplida(E, x))).toEqual([false, false]);
    expect(estadoDe(G, E, 'metalurgia_cobre')).toBe('logro');
    expect(estadoDe(G, E, 'aleacion_bronce')).toBe('bloqueada');
  });
});
