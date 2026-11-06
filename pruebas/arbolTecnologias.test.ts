import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, catalogoDeTecnologia: () => null, tropasReclutables: () => [] }));
import datos from './plaza/datos.json';
import { construirGrafo, cupoEra, datosDesdeCatalogo, estadoDe, ultimaEraVisible, type EstadoArbol } from '../src/ui/arbolTecnologias';

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
  it('las dependencias ocultas del logro van como directas y punteadas', () => {
    const n = G.nodos.get('arqueria_especializada')!;
    expect(n.preds).toContainEqual({ de: 'arco_compuesto', tipo: 'logro' });
  });
  it('el logro de reclutar jinetes asirios pide lo que pide esa tropa (reducido a lo directo)', () => {
    expect(new Set(G.logroDe('caballeria_organizada'))).toEqual(new Set(['equitacion_militar', 'cria_caballar', 'forja_hierro_temprana']));
    expect(G.nodos.get('caballeria_organizada')!.preds.map((p) => p.de).sort()).toEqual(['equitacion_militar', 'forja_hierro_temprana']);
  });
  it('estados de la carta', () => {
    const E: EstadoArbol = { adoptadas: ['leva_comunal'], aparecidas: ['escudos_ligeros'], reveladas: new Map([['arqueria_palacial', { cumplidas: [false], hito: [], descubridor: 'f-2' }]]),
      logros: [{ contador: D.tec['metalurgia_cobre']!.logro!.contador, umbral: D.tec['metalurgia_cobre']!.logro!.umbral }], eraMundo: 'reinos_palaciales' };
    expect(estadoDe(G, E, 'leva_comunal')).toBe('adoptada');
    expect(estadoDe(G, E, 'escudos_ligeros')).toBe('adoptable');
    expect(estadoDe(G, E, 'arqueria_palacial')).toBe('revelada');
    expect(estadoDe(G, E, 'metalurgia_cobre')).toBe('logro');
    expect(estadoDe(G, E, 'canteria')).toBe('bloqueada');
    expect(estadoDe(G, E, 'forja_hierro_temprana')).toBe('futura');
  });
});
