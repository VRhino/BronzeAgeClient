// Los Aedas fuera del panel de Tecnología (0.169.0): su nombre, el clic en el mapa, los avisos de sus hechos y las frases de la crónica.
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { EventoDominio } from '../src/tiposDominio';

// `apiCliente` lee `location` al cargar
(globalThis as Record<string, unknown>).location = { protocol: 'http:', host: 'x', hostname: 'x', search: '' };
const { nombreDeAeda } = await import('../src/mundo/aedas');
const { aedasBajoElClic, textoDeHechoAeda } = await import('../src/ui/aedas');
const { fraseDeCronica } = await import('../src/ui/cronica');
const { rotuloDe } = await import('../src/ui/eleccionClic');
const { algoSeMueve, estadoDesdeProyeccion, etiquetasDesdeProyeccion } = await import('../src/mundo3d/estado');

const p = {
  heroeId: 'h-1', faccionId: 'f-1', heroe: { displayName: 'Víctor', ubicacion: { tipo: 'columna' } }, nombresDeCompaneros: {}, instante: 0,
  facciones: [{ id: 'f-1', nombre: 'Casa de Micenas', reyId: 'h-1' }, { id: 'f-2', nombre: 'Troya' }],
  directorioFacciones: [{ id: 'f-3', nombre: 'Hatti' }],
  asentamientos: [], ejercitos: [], ejercitosAvistados: [], caravanas: [], caravanasAvistadas: [], heroesVisibles: [],
  asentamientosAvistados: [{ id: 'as-4', nombre: 'Pesinunte', faccionId: 'f-1', nivel: 3, posicion: { x: 100, y: 100 } }, { id: 'as-9', nombre: 'Ilión', faccionId: 'f-2', nivel: 2, posicion: { x: 300, y: 300 } }],
  asentamientosConocidos: [],
  aedasResidentes: [{ id: 'aeda-r2', nombre: 'Ión', asentamientoId: 'as-4' }],
  aedasAvistados: [{ id: 'aeda-1', posicion: { x: 200, y: 200 }, enMarcha: true }, { id: 'aeda-3', posicion: { x: 100, y: 100 }, enAsentamientoId: 'as-4' }],
  titulos: [{ tituloId: 'mecenas', nombre: 'Mecenas de los Aedas', poseedorId: 'f-1', valorMetrica: 0 }],
} as unknown as ProyeccionJugador;

const ev = (codigo: string, payload: Record<string, unknown>, asentamientoId?: string): EventoDominio =>
  ({ codigo, mensaje: codigo, version: 7, momento: '', payload, ...(asentamientoId ? { asentamientoId } : {}) }) as EventoDominio;

describe('Aedas itinerantes en el mapa', () => {
  test('cada uno con su nombre, siempre el mismo', () => {
    expect(nombreDeAeda('aeda-1')).toBe('Demódoco');
    expect(nombreDeAeda('aeda-3')).toBe('Tamiris');
    expect(nombreDeAeda('aeda-25')).toBe('Demódoco');
    expect(nombreDeAeda('raro')).toBe('raro');
  });

  test('el clic lo encuentra, y en la lista dice dónde está', () => {
    expect(aedasBajoElClic(p, { x: 201, y: 200 })).toEqual([{ tipo: 'aeda', id: 'aeda-1' }]);
    expect(aedasBajoElClic(p, { x: 260, y: 260 })).toEqual([]);
    expect(rotuloDe(p, { tipo: 'aeda', id: 'aeda-3' })).toMatchObject({ titulo: 'Aeda Tamiris', detalle: 'Parado en Pesinunte' });
    expect(rotuloDe(p, { tipo: 'aeda', id: 'aeda-1' }).detalle).toBe('De camino');
  });

  test('el que anda sale en el mundo 3D con su cartel; el parado, en el cartel de su plaza', () => {
    expect(algoSeMueve(p)).toBe(true);
    const e = estadoDesdeProyeccion(p, { vision: { solo: 15, ejercito: 25 }, radioZonaInicial: 30, radioProteccion: 10 }, null);
    expect(e.aedas).toEqual([{ id: 'aeda-1', posicion: { x: 200, y: 200 } }]);
    const et = etiquetasDesdeProyeccion(p, [], []);
    expect(et.find((x) => x.id === 'aeda:aeda-1')).toMatchObject({ texto: '📜 Demódoco', tipo: 'aeda' });
    expect(et.find((x) => x.id === 'plaza:as-4')?.subtexto).toBe('Nivel 3 · 📜 Aeda');
    expect(et.find((x) => x.id === 'plaza:as-9')?.subtexto).toBe('Nivel 2');
  });
});

describe('avisos de los Aedas', () => {
  test('solo los de tu Facción', () => {
    expect(textoDeHechoAeda(ev('aedas.revela', { faccionId: 'f-2', tecnologia: 'bronce' }, 'as-9'), p)).toBeNull();
    const r = textoDeHechoAeda(ev('aedas.revela', { faccionId: 'f-1', descubridoraId: 'f-2', tecnologia: 'escudos_ligeros' }, 'as-4'), p)!;
    expect(r.texto).toContain('Pesinunte');
    expect(r.texto).toContain('Troya');
    expect(r.importante).toBe(false);
  });

  test('lo que te da una tecnología o te quita una épica, arriba', () => {
    expect(textoDeHechoAeda(ev('aedas.epica_tecnologia', { faccionId: 'f-1', aedaResidenteId: 'aeda-r2', tecnologia: 'bronce' }, 'as-4'), p)).toMatchObject({ importante: true, titulo: 'Épica cumplida' });
    expect(textoDeHechoAeda(ev('aedas.epica_tecnologia', { faccionId: 'f-1', aedaResidenteId: 'aeda-r2', tecnologia: 'bronce' }, 'as-4'), p)!.texto).toMatch(/^Ión termina en Pesinunte/);
    const perdida = textoDeHechoAeda(ev('aedas.epica_abandonada', { faccionId: 'f-1', aedaResidenteId: 'aeda-r2', tecnologia: 'bronce', motivo: 'conquista', plazaId: 'as-4' }), p)!;
    expect(perdida.importante).toBe(true);
    expect(perdida.texto).toContain('Pesinunte cayó');
    expect(textoDeHechoAeda(ev('aedas.venta', { faccionId: 'f-1', aedaId: 'aeda-3', tecnologia: 'bronce', precio: 400 }, 'as-4'), p)!.texto).toContain('Tamiris por 400 de oro');
    // la crónica no es un aviso
    expect(textoDeHechoAeda(ev('aedas.canta_descubrimiento', { faccionId: 'f-1', tecnologia: 'bronce' }), p)).toBeNull();
  });
});

describe('frases de la crónica', () => {
  const entrada = (tipo: string, datos: Record<string, unknown>) => ({ version: 3, en: 0, tipo, datos: { tipo, ...datos } });

  test('con los nombres de lo que se conoce', () => {
    expect(fraseDeCronica(entrada('fundacion.asentamiento_fundado', { faccionIds: ['f-2'], asentamientoId: 'as-9' }), p).texto).toMatch(/Ilión/);
    expect(fraseDeCronica(entrada('titulo.nace', { faccionIds: ['f-1'], titulo: 'mecenas' }), p).texto).toBe('Nace el título «Mecenas de los Aedas»: lo gana Casa de Micenas (la tuya).');
    expect(fraseDeCronica(entrada('asentamiento.nivel_subio', { faccionIds: ['f-3'], asentamientoId: 'as-77', nivel: 4 }), p).texto).toBe('una plaza lejana, de Hatti, es la primera plaza del mundo en llegar al nivel 4.');
    expect(fraseDeCronica(entrada('aedas.canta_descubrimiento', { faccionIds: ['f-2'], tecnologia: 'bronce' }), p).icono).toBe('📜');
  });

  test('la variante es siempre la misma para la misma entrada', () => {
    const x = entrada('asentamiento.conquistada', { faccionIds: ['f-1', 'f-2'], asentamientoId: 'as-9' });
    expect(fraseDeCronica(x, p).texto).toBe(fraseDeCronica({ ...x }, p).texto);
    expect(fraseDeCronica(x, p).texto).toContain('Ilión');
  });
});
