// La lista de qué hay bajo un clic del mapa: cómo se llama cada cosa (sacado de la proyección) y que la misma cosa encontrada desde dos sitios
// sale una vez.
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';

// `ui/pueblos.ts` (los nombres de pueblos, avanzadas y obras) trae `apiCliente`, que lee `location` al cargar
(globalThis as Record<string, unknown>).location = { protocol: 'http:', host: 'x', hostname: 'x', search: '' };
const { rotuloDe, sinRepetir } = await import('../src/ui/eleccionClic');

const p = {
  heroeId: 'h-1', faccionId: 'f-1', heroe: { displayName: 'Víctor' }, nombresDeCompaneros: { 'h-2': 'Néstor' },
  facciones: [{ id: 'f-1', nombre: 'Casa de Micenas' }, { id: 'f-2', nombre: 'Troya' }],
  directorioFacciones: [{ id: 'f-3', nombre: 'Hatti' }],
  asentamientos: [{ id: 'as-4', nombre: 'Pesinunte', nivel: 3 }],
  asentamientosAvistados: [{ id: 'as-9', nombre: 'Ilión', faccionId: 'f-2', nivel: 2, posicion: { x: 0, y: 0 } }],
  asentamientosConocidos: [{ asentamientoId: 'as-7', nombre: 'Hattusa', faccionId: 'f-3', nivel: 4, posicion: { x: 0, y: 0 }, conocidoEn: 0 }],
  ejercitos: [{ id: 'ej-2', tipo: 'ejercito', faccionId: 'f-1', liderId: 'h-2', participantes: [{ heroeId: 'h-2', unidoEn: 0 }] }],
  ejercitosAvistados: [{ id: 'av-1', tipo: 'personal', faccionId: 'f-2', participantes: 1, heroeIds: [], enFormacion: false, caravanasAdjuntasIds: [] }],
  caravanasAvistadas: [{ id: 'cav-1', faccionId: 'f-3', escoltada: true, recursos: [] }],
  pueblos: [{ id: 'pu-1', madreId: 'as-4', propio: true, tipo: 'aldeaAgricola', posicion: { x: 0, y: 0 } }],
  avanzadas: [{ id: 'av-9', madreId: 'as-9', propia: false, etapa: 2, enRuinas: true, posicion: { x: 0, y: 0 } }],
  campamentosBandidos: [{ id: 'b-1', nivel: 3, posicion: { x: 0, y: 0 } }],
  batallas: [{ battleId: 'bt-1', punto: { x: 0, y: 0 }, ladoPropio: 'atacante' }],
} as unknown as ProyeccionJugador;

describe('qué hay bajo el clic', () => {
  test('cada cosa con su nombre y de quién es', () => {
    const r = (tipo: string, id: string) => { const x = rotuloDe(p, { tipo, id }); return [x.titulo, x.detalle]; };
    expect(r('asentamiento', 'as-4')).toEqual(['Pesinunte', 'Nivel 3 · Tu Facción']);
    expect(r('asentamiento', 'as-9')).toEqual(['Ilión', 'Nivel 2 · Troya']);
    expect(r('asentamiento', 'as-7')).toEqual(['Hattusa', 'Nivel 4 · Hatti']); // del directorio
    expect(r('ejercito', 'ej-2')).toEqual(['Ejército de tu Facción', 'Con Néstor']);
    expect(r('ejercitoAjeno', 'av-1')).toEqual(['Columna ajena', 'Troya · 1 héroe']);
    expect(r('caravanaAjena', 'cav-1')).toEqual(['Caravana ajena', 'Hatti · escoltada']);
    expect(r('puebloMapa', 'pu-1')).toEqual(['Aldea agrícola', 'De Pesinunte']);
    expect(r('avanzadaMapa', 'av-9')).toEqual(['Fuerte', 'De Ilión · en ruinas']);
    expect(r('campamento', 'b-1')).toEqual(['Campamento de bandidos', 'Nivel 3']);
    expect(r('batalla', 'bt-1')).toEqual(['Batalla', 'Combates en ella']);
  });

  test('la misma cosa encontrada desde dos centros sale una vez, la primera', () => {
    const a = { seleccion: { tipo: 'asentamiento', id: 'as-4' }, ir: 1 }, b = { seleccion: { tipo: 'alijo', id: 'x' } };
    expect(sinRepetir([a, b, { seleccion: { tipo: 'asentamiento', id: 'as-4' }, ir: 2 }])).toEqual([a, b]);
  });
});
