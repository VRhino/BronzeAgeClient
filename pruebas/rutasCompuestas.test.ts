// Rutas compuestas (motor 23-11, contrato 0.32.0): el encargo de una caravana es un circuito de hasta 5 paradas (origen → destino → hasta tres más →
// vuelta al origen), que puede pasar por plazas de otra Facción. El formulario lista las paradas con su plaza y deja añadir hasta 5; la ruta dibuja la
// cadena con la parada actual marcada.
import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
const { htmlEncargo, htmlFormulario, htmlRutaVisual } = await import('../src/ui/encargoCaravana');
const { explicarError } = await import('../src/ui/erroresServidor');

const e = (v: string): string => v;
const origen = { id: 'as-1', nombre: 'Tirinto', faccionId: 'f-1', posicion: { x: 0, y: 0 }, nivel: 3, almacen: { trigo: { cantidad: 500, capacidad: 1000 } }, cargos: { gobernadorId: 'h' } };
const p = (extra: object = {}) => ({
  heroeId: 'h', faccionId: 'f-1', instante: 0,
  heroe: { ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, escuadrones: [] },
  asentamientos: [origen, { id: 'as-2', nombre: 'Micenas', faccionId: 'f-1', posicion: { x: 50, y: 0 }, nivel: 2 }, { id: 'as-3', nombre: 'Pilos', faccionId: 'f-1', posicion: { x: 90, y: 0 }, nivel: 2 }],
  asentamientosAvistados: [{ id: 'as-9', nombre: 'Argos', faccionId: 'f-2', posicion: { x: 0, y: 80 }, nivel: 2 }], asentamientosConocidos: [], ejercitos: [], caravanas: [], plazasPropias: [],
  ...extra,
}) as never;
const parada = { recoger: [{ recurso: 'trigo', cantidad: 100 }], esperarExistencias: false, dejar: [], desecharSobrante: false };
const caravana = (encargo?: object, id = 'car-1') => ({ id, tipo: 'comercial', origenAsentamientoId: 'as-1', estado: 'disponible', posicionActual: { x: 0, y: 0 }, encargo }) as never;

describe('el formulario del circuito', () => {
  it('sin encargo: origen, destino y el botón para añadir paradas (2 de 5)', () => {
    const html = htmlEncargo(caravana(), p(), origen as never, true, 100, true, e, true);
    expect(html).toContain('En el origen');
    expect(html).toContain('Parada 1');
    expect(html).toContain('data-enc-mas-parada');
    expect(html).toContain('2/5');
    expect(html).toContain('Argos');
    expect(html).toContain('(ajena)');
  });
  it('con un circuito de cinco paradas ya no se puede añadir otra', () => {
    const k = { modo: 'ruta', destinoAsentamientoId: 'as-2', paradaOrigen: parada, paradaDestino: parada, masParadas: [{ asentamientoId: 'as-3', parada }, { asentamientoId: 'as-9', parada }, { asentamientoId: 'as-2', parada }], vueltas: 0, paradaActual: 'origen', fase: '', cancelado: false };
    const html = htmlFormulario(caravana(k, 'car-2'), p(), origen as never, 100, e);
    expect(html).not.toContain('data-enc-mas-parada');
    expect(html).toContain('5 de 5 paradas');
    expect(html).toContain('Parada 4');
  });
});

describe('la ruta con circuito', () => {
  const k = { modo: 'ruta', destinoAsentamientoId: 'as-2', paradaOrigen: parada, paradaDestino: parada, masParadas: [{ asentamientoId: 'as-9', parada }], vueltas: 2, paradaActual: 'destino', tramo: 1, fase: 'carga', finPaso: 60_000, cancelado: false };
  it('dibuja la cadena origen → destino → parada y marca la actual', () => {
    const html = htmlRutaVisual(caravana(k) as never, k as never, p(), origen as never, e);
    expect(html).toContain('ruta-circuito');
    expect(html).toContain('3 paradas');
    expect(html).toMatch(/ruta-punta aqui[^>]*>(?:(?!<\/div>).)*Argos/);
    expect(html).toContain('ajena');
  });
  it('con dos paradas sigue siendo el dibujo de siempre', () => {
    const dos = { ...k, masParadas: undefined, tramo: undefined };
    expect(htmlRutaVisual(caravana(dos) as never, dos as never, p(), origen as never, e)).not.toContain('ruta-circuito');
  });
});

describe('los rechazos del circuito', () => {
  it('tienen su texto', () => {
    expect(explicarError('encargo.demasiadas_paradas')).toContain('5 paradas');
    expect(explicarError('encargo.parada_repetida')).toContain('dos veces seguidas');
    expect(explicarError('encargo.deja_sin_recoger')).toContain('ninguna parada');
    expect(explicarError('encargo.supera_capacidad')).toContain('vuelta');
  });
});
