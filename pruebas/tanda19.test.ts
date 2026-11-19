// La tanda del 19-11 (cliente 0.221.0, motor ca67e25): lo que come la plaza, «Al carro» a la puerta de tu plaza y el Tesorero con el almacén cerrado.
import { describe, expect, test, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento } from '../src/tiposDominio';
import { AsentamientoSchema } from '../src/contrato/gen/bronzeage/v1/entities_pb';
import { CantidadesSchema } from '../src/contrato/gen/bronzeage/v1/common_pb';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { plazaDeContrato } = await import('../src/motor/proyeccion');
const { htmlComidaDePlaza, lineasDeComida, textoComida } = await import('../src/ui/consumoPausado');
const { htmlAlmacenALaPuerta } = await import('../src/ui/panelCarro');

const e = (t: string): string => t;

const proy = (o: { lider?: boolean } = {}): ProyeccionJugador =>
  ({
    heroeId: 'heroe-1', faccionId: 'f-1', instante: 0,
    heroe: { id: 'heroe-1', ubicacion: { tipo: 'ejercito' }, escuadrones: [] },
    facciones: [{ id: 'f-1', nombre: 'Casa', miembros: [{ heroeId: 'heroe-1', cargos: [], participacion: 0 }] }],
    ejercitos: [{ id: 'ej-1', liderId: o.lider === false ? 'heroe-2' : 'heroe-1', participantes: [{ heroeId: 'heroe-1' }], posicionActual: { x: 5, y: 5 }, suministro: { madera: 10 } }],
    asentamientos: [], asentamientosAvistados: [], campamentosMercenarios: [],
  }) as unknown as ProyeccionJugador;

describe('lo que come la plaza', () => {
  test('los campos 59 y 60 llegan a la proyección en unidades por minuto y se enseñan por hora', () => {
    const pb = create(AsentamientoSchema, {
      id: 'as-1',
      comidaPoblacion: create(CantidadesSchema, { porId: { trigo: 2000n, carne: 500n } }),
      comidaGuarnicion: create(CantidadesSchema, { porId: { carne: 250n } }),
    });
    const { asentamiento: a } = plazaDeContrato(pb, 0);
    expect(a.comidaPoblacion).toEqual({ trigo: 2, carne: 0.5 });
    expect(a.comidaGuarnicion).toEqual({ carne: 0.25 });
    expect(textoComida(a.comidaPoblacion)).toContain('120/h');
    expect(lineasDeComida(a)).toHaveLength(2);
    expect(htmlComidaDePlaza(a, e)).toContain('Lo que come la plaza');
  });

  test('sin los campos no sale nada', () => {
    const { asentamiento: a } = plazaDeContrato(create(AsentamientoSchema, { id: 'as-1' }), 0);
    expect(a.comidaPoblacion).toBeUndefined();
    expect(lineasDeComida(a)).toEqual([]);
    expect(htmlComidaDePlaza(a, e)).toBe('');
  });
});

describe('al carro a la puerta de tu plaza', () => {
  const plaza = (x: Partial<Asentamiento> = {}) => ({ id: 'as-1', nombre: 'Micenas', almacen: { trigo: { cantidad: 40 } }, ...x }) as unknown as Asentamiento;

  test('saca del almacén al carro; dejar es de dentro', () => {
    const html = htmlAlmacenALaPuerta(proy(), plaza(), e);
    expect(html).toContain('data-carro="dePlaza"');
    expect(html).not.toContain('data-carro="aPlaza"');
    expect(html).not.toMatch(/data-carro="dePlaza"[^>]*disabled/);
  });

  test('cerrado a los ciudadanos: saca el Tesorero, no un ciudadano sin cargo', () => {
    const cerrada = { almacenCerradoACiudadanos: true };
    expect(htmlAlmacenALaPuerta(proy(), plaza(cerrada), e)).toMatch(/data-carro="dePlaza"[^>]*disabled/);
    expect(htmlAlmacenALaPuerta(proy(), plaza({ ...cerrada, cargos: { tesoreroId: 'heroe-1' } } as Partial<Asentamiento>), e)).not.toMatch(/data-carro="dePlaza"[^>]*disabled/);
  });
});
