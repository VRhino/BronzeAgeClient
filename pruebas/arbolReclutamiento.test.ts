import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, catalogoDeTecnologia: () => null, tropasReclutables: () => [], oroPorSoldado: () => 0 }));
import datos from './plaza/datos.json';
import { datosDesdeCatalogo } from '../src/ui/arbolTecnologias';
import { disponerTropas, estadoTropa, grafoDeTropas, type EstadoPlaza } from '../src/ui/arbolReclutamiento';

const docs = (datos as unknown as { documentos: Record<string, Record<string, unknown>> }).documentos;
const bloque = <T,>(n: string): T => Object.values(docs).find((d) => n in d)![n] as T;
const D = datosDesdeCatalogo(
  { TECNOLOGIAS: bloque('TECNOLOGIAS'), ERAS: bloque('ERAS'), TARIFA_ADOPCION: bloque('TARIFA_ADOPCION') },
  bloque('TROPAS_RECLUTABLES'),
  bloque('EDIFICIO_CATALOGO'),
);
const G = grafoDeTropas(D);
const mitad: EstadoPlaza = {
  adoptadas: ['leva_comunal', 'hostigamiento_tribal', 'metalurgia_cobre', 'aleacion_bronce', 'escudos_ligeros', 'armamento_palacial', 'arqueria_palacial', 'cria_caballar', 'canteria'],
  aparecidas: ['carros_guerra', 'bronce_calidad_militar'], eraMundo: 'crisis_adaptacion', niveles: { barracon: 2, galeriaDeTiro: 2 }, escuadras: { honderos: 20 },
};

describe('árbol de reclutamiento', () => {
  it('carriles por el edificio donde se recluta', () => {
    expect(G.carriles.slice(0, 4).map((c) => c.id)).toEqual(['centroUrbano', 'barracon', 'galeriaDeTiro', 'caballerizas']);
  });
  it('B va tras A cuando B necesita la tecnología que habilita a A; de las hermanas, una sola línea', () => {
    expect(G.nodos.get('lanceros_pesados')!.preds).toEqual([{ de: 'shardana', tipo: 'hito' }]);
    expect(G.nodos.get('arqueros_compuesto')!.preds).toEqual([{ de: 'arqueros', tipo: 'logro' }]);
    // espadachines de bronce y hacheros armados salen con la misma tecnología: se dibuja una, el tooltip nombra las dos
    expect(G.nodos.get('shardana')!.preds.map((p) => p.de)).toEqual(['espadachines_bronce']);
    expect(G.nodos.get('shardana')!.todos.map((p) => p.de).sort()).toEqual(['espadachines_bronce', 'hacheros_armados']);
  });
  it('en la Era, la columna va por el nivel del edificio y siempre a la derecha de su previa', () => {
    disponerTropas(G, 2);
    const col = (id: string): number => G.nodos.get(id)!.col!;
    expect(col('lanceros_mimbre')).toBe(0);
    expect(col('espadachines_cobre')).toBe(0);
    expect(col('espadachines_bronce')).toBe(1);
    expect(col('hacheros_ligeros')).toBe(2);
    expect(col('shardana')).toBeLessThan(col('lanceros_pesados'));
    expect(col('shardana')).toBeGreaterThanOrEqual(3);
  });
  it('un carril plegado no ocupa columnas', () => {
    const con = disponerTropas(G, 2).NCOL;
    const sin = disponerTropas(G, 2, new Set(['barracon', 'galeriaDeTiro', 'caballerizas'])).NCOL;
    expect(sin).toBeLessThan(con);
  });
  it('estado en la plaza', () => {
    expect(estadoTropa(G, mitad, 'lanceros_mimbre')).toBe('lista');
    expect(estadoTropa(G, mitad, 'honderos')).toBe('tuya');
    expect(estadoTropa(G, mitad, 'shardana')).toBe('adoptable');
    expect(estadoTropa(G, mitad, 'guerreros_filisteos')).toBe('bloqueada');
    expect(estadoTropa(G, { ...mitad, niveles: { barracon: 1 } }, 'espadachines_bronce')).toBe('edificio');
    expect(estadoTropa(G, { ...mitad, eraMundo: 'reinos_palaciales' }, 'shardana')).toBe('futura');
  });
});
