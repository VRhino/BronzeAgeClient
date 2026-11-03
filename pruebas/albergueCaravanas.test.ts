// El Albergue de caravanas en la interfaz (motor b5e27ace): en «Construir» solo sale con un Mercado activo (lo que pide su nivel 1), el rechazo
// nuevo del motor tiene su texto, y la flota cuenta su cupo de caravanas y carros sobre el del Mercado.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import type { Asentamiento } from '../src/tiposDominio';

// el catálogo del motor (Docs/Mechanics, EDIFICIO_CATALOGO), recortado a lo que se mira aquí
const CATALOGO = {
  mercado: { costo: { madera: 60 }, tiempoConstruccionMinutos: 120, niveles: { '1': { cupoCaravanas: 2, cupoCarros: 3 }, '2': { cupoCaravanas: 4, cupoCarros: 9 }, '3': { cupoCaravanas: 6, cupoCarros: 18 } } },
  albergueCaravanas: {
    costo: { madera: 80 }, tiempoConstruccionMinutos: 240,
    niveles: {
      '1': { requiereEdificio: 'mercado', cupoCaravanas: 3, cupoCarros: 5 },
      '2': { requisitoNivelAsentamiento: 2, requiereEdificio: 'mercado', requiereEdificioNivel: 2, cupoCaravanas: 6, cupoCarros: 10 },
      '3': { requisitoNivelAsentamiento: 3, requiereEdificio: 'mercado', requiereEdificioNivel: 3, cupoCaravanas: 12, cupoCarros: 22 },
    },
  },
};
vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ documentos: { Asentamientos: { EDIFICIO_CATALOGO: CATALOGO, EDIFICIOS_UNICOS: ['mercado', 'albergueCaravanas'] } } }) })));

const { bloqueDeDatos, cupoDeFlota } = await import('../src/apiCliente');
const { htmlConstruir } = await import('../src/ui/panelObras');
const { explicarError } = await import('../src/ui/erroresServidor');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('EDIFICIO_CATALOGO', listo)) listo(); });
});

const plaza = (edificios: { tipo: string; estado: 'activo' | 'en_construccion' | 'en_cola'; nivelInterno?: number }[]): Asentamiento =>
  ({ id: 'as-1', nivel: 1, nivelActual: 1, almacen: { madera: { cantidad: 500 } }, edificios: edificios.map((e, i) => ({ id: `e${i}`, posicion: { x: 0, y: 0 }, ...e })) }) as unknown as Asentamiento;
const ofrece = (a: Asentamiento, tipo: string): boolean => htmlConstruir(a, 'gobernador', (t) => t).includes(`data-construir="${tipo}"`);

describe('el Albergue de caravanas en «Construir»', () => {
  test('sin Mercado, o con el Mercado aún en obra, no sale: pide uno activo', () => {
    expect(ofrece(plaza([]), 'albergueCaravanas')).toBe(false);
    expect(ofrece(plaza([{ tipo: 'mercado', estado: 'en_construccion' }]), 'albergueCaravanas')).toBe(false);
  });

  test('con el Mercado activo sale, con su nombre y su coste', () => {
    const html = htmlConstruir(plaza([{ tipo: 'mercado', estado: 'activo' }]), 'gobernador', (t) => t);
    expect(html).toContain('data-construir="albergueCaravanas"');
    expect(html).toContain('Albergue de caravanas · 80 Madera');
  });

  test('es único: con uno levantado no se ofrece otro', () => {
    expect(ofrece(plaza([{ tipo: 'mercado', estado: 'activo' }, { tipo: 'albergueCaravanas', estado: 'en_cola' }]), 'albergueCaravanas')).toBe(false);
  });

  test('el rechazo del motor por falta del Mercado se explica', () => {
    expect(explicarError('obra.falta_edificio')).toMatch(/Mercado activo/);
  });
});

describe('la flota con el Albergue', () => {
  test('suma su cupo al del Mercado, a su nivel', () => {
    expect(cupoDeFlota(1)).toEqual({ caravanas: 2, carros: 3 });
    expect(cupoDeFlota(1, 1)).toEqual({ caravanas: 5, carros: 8 });
    expect(cupoDeFlota(2, 2)).toEqual({ caravanas: 10, carros: 19 });
    expect(cupoDeFlota(3, 3)).toEqual({ caravanas: 18, carros: 40 });
  });

  test('la «Ampliación de Flota» suma una caravana más; sin Mercado no hay cupo', () => {
    expect(cupoDeFlota(2, 1, 1)).toEqual({ caravanas: 8, carros: 14 });
    expect(cupoDeFlota(0, 3)).toBeNull();
  });
});
