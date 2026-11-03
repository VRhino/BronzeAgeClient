// De qué carro sale el oro de un contrato de mercenario (`columnaQuePaga`, como `columna_que_lleva` del motor).
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import { columnaQuePaga } from '../src/ui/columnaQuePaga';

const columna = { id: 'ej-1', faccionId: 'fac-1', tipo: 'ejercito', liderId: 'heroe-1', estado: 'estacionado', posicionActual: { x: 0, y: 0 }, participantes: [{ heroeId: 'heroe-1', unidoEn: 0 }], suministro: { oro: 260 } };

const proyeccion = (ubicacion: unknown, residentes: string[] = [], carro?: Record<string, number>): ProyeccionJugador =>
  ({
    heroeId: 'heroe-1',
    heroe: { id: 'heroe-1', ubicacion, carro, escuadrones: [] },
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
