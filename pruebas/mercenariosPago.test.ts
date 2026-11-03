// De dónde sale el oro de un contrato de mercenario: la columna en la que vas (`columnaQuePaga`, como `columna_que_lleva` del motor) y, desde el
// motor 2b2c2a58, también el almacén personal o el carro propio dentro de tu residencia (`fuentesDePago`).
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import { columnaQuePaga, fuentesDePago } from '../src/ui/columnaQuePaga';

const columna = { id: 'ej-1', faccionId: 'fac-1', tipo: 'ejercito', liderId: 'heroe-1', estado: 'estacionado', posicionActual: { x: 0, y: 0 }, participantes: [{ heroeId: 'heroe-1', unidoEn: 0 }], suministro: { oro: 260 } };

const proyeccion = (ubicacion: unknown, residentes: string[] = [], carro?: Record<string, number>, almacenPersonal?: Record<string, number>): ProyeccionJugador =>
  ({
    heroeId: 'heroe-1',
    heroe: { id: 'heroe-1', ubicacion, carro, almacenPersonal, escuadrones: [] },
    ejercitos: [columna],
    asentamientos: [{ id: 'as-1', heroesFundadoresIds: ['heroe-1'] }],
    campamentosMercenarios: [{ id: 'camp-2', residentesIds: residentes }],
  }) as unknown as ProyeccionJugador;

describe('pagar a un mercenario', () => {
  test('de visita en un campamento, paga el carro de la columna que te trajo', () => {
    expect(columnaQuePaga(proyeccion({ tipo: 'mercenarios', campamentoId: 'camp-2' }))?.suministro?.['oro']).toBe(260);
  });

  test('con la columna a la puerta, paga esa columna aunque residas en el campamento', () => {
    expect(columnaQuePaga(proyeccion({ tipo: 'columna', ejercitoId: 'ej-1' }, ['heroe-1']))?.id).toBe('ej-1');
  });

  test('dentro de tu residencia no vas en columna: ni el carro propio paga', () => {
    expect(columnaQuePaga(proyeccion({ tipo: 'mercenarios', campamentoId: 'camp-2' }, ['heroe-1'], { oro: 500 }))).toBeNull();
    expect(columnaQuePaga(proyeccion({ tipo: 'asentamiento', asentamientoId: 'as-1' }))).toBeNull();
  });
});

describe('con qué se paga un contrato en el campamento (motor 2b2c2a58)', () => {
  const camp = (residentes: string[]) => ({ id: 'camp-2', residentesIds: residentes });
  const fuentes = (ubicacion: unknown, residentes: string[]) =>
    fuentesDePago(proyeccion(ubicacion, residentes, { oro: 40 }, { oro: 500 }), camp(residentes)).map((f) => [f.pagarCon, f.nombre, f.oro]);

  test('dentro de tu residencia, sin columna: el almacén personal (lo de por defecto) o el carro que trajiste', () => {
    expect(fuentes({ tipo: 'mercenarios', campamentoId: 'camp-2' }, ['heroe-1'])).toEqual([['almacenPersonal', 'tu almacén personal', 500], ['carro', 'tu carro', 40]]);
  });

  test('con tu columna a la puerta de tu residencia: su carro (lo de por defecto) o el almacén personal', () => {
    expect(fuentes({ tipo: 'columna', ejercitoId: 'ej-1' }, ['heroe-1'])).toEqual([['carro', 'el carro de tu columna', 260], ['almacenPersonal', 'tu almacén personal', 500]]);
  });

  test('de visita, solo el carro de la columna con la que entraste: el almacén personal no se ofrece', () => {
    expect(fuentes({ tipo: 'mercenarios', campamentoId: 'camp-2' }, [])).toEqual([['carro', 'el carro de tu columna', 260]]);
    expect(fuentes({ tipo: 'columna', ejercitoId: 'ej-1' }, [])).toEqual([['carro', 'el carro de tu columna', 260]]);
  });

  test('sin residir aquí ni columna, nada con que pagar', () => {
    const p = { ...proyeccion({ tipo: 'desconectado' }, []), ejercitos: [] } as unknown as ProyeccionJugador;
    expect(fuentesDePago(p, camp([]))).toEqual([]);
  });
});
