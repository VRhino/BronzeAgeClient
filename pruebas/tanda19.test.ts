// La tanda del 19-11 (cliente 0.221.0, motor ca67e25): lo que come la plaza, la ventana «Almacén» a la puerta (0.222.0) y el Tesorero con el almacén cerrado.
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
const { PASO_ALMACEN, deshacerAlmacen, htmlAlmacenes, ordenesDelBorrador, sitioPersonal, htmlAlmacenPuerta, pasar, sitioDePlaza, sitioDePueblo } = await import('../src/ui/almacenPuerta');

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

describe('la ventana «Almacén» a la puerta', () => {
  const plaza = (x: Partial<Asentamiento> = {}) => ({ id: 'as-1', nombre: 'Micenas', almacen: { trigo: { cantidad: 40 }, cobre: { cantidad: 0 } }, ...x }) as unknown as Asentamiento;

  test('solo salen los bienes con algo, cada uno con su icono a la izquierda; sin borrador no se confirma', () => {
    const s = sitioDePlaza(proy(), plaza());
    deshacerAlmacen(s.clave);
    const html = htmlAlmacenPuerta(proy(), s, e);
    expect(html).toMatch(/data-alm-lado="almacen" data-recurso="trigo"[\s\S]*?alm-icono/);
    expect(html).toContain('data-alm-lado="carro" data-recurso="madera"');
    expect(html).not.toContain('data-recurso="cobre"');
    expect(html).toMatch(/data-alm-confirmar disabled/);
  });

  test('cada clic pasa 10 al otro lado, en los dos sentidos, y no más de lo que hay', () => {
    const p = proy();
    const s = sitioDePlaza(p, plaza());
    deshacerAlmacen(s.clave);
    expect(PASO_ALMACEN).toBe(10);
    expect(pasar(p, s, 'trigo', 'almacen')).toBe(10);
    expect(pasar(p, s, 'madera', 'carro')).toBe(10);
    expect(pasar(p, s, 'madera', 'carro')).toBe(0); // ya no queda madera en el carro
    expect(pasar(p, s, 'trigo', 'carro')).toBe(10); // y se puede devolver lo pasado
    pasar(p, s, 'trigo', 'almacen'); pasar(p, s, 'trigo', 'almacen');
    const html = htmlAlmacenPuerta(p, s, e);
    expect(html).toMatch(/data-alm-lado="carro" data-recurso="trigo"[\s\S]*?<b>20<\/b><small class="alm-delta">\+20/);
    expect(html).toMatch(/data-alm-lado="almacen" data-recurso="madera"[\s\S]*?<b>10<\/b><small class="alm-delta">\+10/);
    expect(html).not.toMatch(/data-alm-confirmar disabled/);
    deshacerAlmacen(s.clave);
  });

  test('«Confirmar» deja primero y saca después; «Deshacer» vacía el borrador', () => {
    const p = proy();
    const s = sitioDePlaza(p, plaza());
    deshacerAlmacen(s.clave);
    pasar(p, s, 'trigo', 'almacen');
    pasar(p, s, 'madera', 'carro');
    expect(ordenesDelBorrador(s)).toEqual([
      ['dejarEnPlaza', { asentamientoId: 'as-1', recurso: 'madera', cantidad: 10 }],
      ['cargarDePlaza', { asentamientoId: 'as-1', recurso: 'trigo', cantidad: 10 }],
    ]);
    deshacerAlmacen(s.clave);
    expect(ordenesDelBorrador(s)).toEqual([]);
    expect(htmlAlmacenPuerta(p, s, e)).toMatch(/data-alm-confirmar disabled/);
  });

  test('cerrado a los ciudadanos: no se saca sin cargo (sí el Tesorero), pero se deja', () => {
    const cerrada = { almacenCerradoACiudadanos: true };
    const s = sitioDePlaza(proy(), plaza(cerrada));
    deshacerAlmacen(s.clave);
    expect(pasar(proy(), s, 'trigo', 'almacen')).toBe(0);
    expect(htmlAlmacenPuerta(proy(), s, e)).not.toContain('data-alm-lado="almacen" data-recurso="trigo"');
    expect(pasar(proy(), s, 'madera', 'carro')).toBe(10);
    deshacerAlmacen(s.clave);
    const t = sitioDePlaza(proy(), plaza({ ...cerrada, cargos: { tesoreroId: 'heroe-1' } } as Partial<Asentamiento>));
    expect(pasar(proy(), t, 'trigo', 'almacen')).toBe(10);
    deshacerAlmacen(t.clave);
  });

  test('en un pueblo solo se deja lo que produce, hasta su capacidad', () => {
    const s = sitioDePueblo({ id: 'pueblo-4', almacen: { cobre: 25 }, capacidad: 30 }, 'Cobre de Micenas', ['cobre']);
    deshacerAlmacen(s.clave);
    expect(pasar(proy(), s, 'madera', 'carro')).toBe(0);
    expect(s.sacar('cobre', 10)).toEqual(['cargarDePueblo', { puebloId: 'pueblo-4', recurso: 'cobre', cantidad: 10 }]);
    expect(s.dejar('cobre', 5)).toEqual(['dejarEnPueblo', { puebloId: 'pueblo-4', recurso: 'cobre', cantidad: 5 }]);
    expect(pasar(proy(), s, 'cobre', 'almacen')).toBe(10);
    deshacerAlmacen(s.clave);
  });
});

describe('la ventana «Almacén» por dentro (0.223.0)', () => {
  const conPersonal = (o: { lider?: boolean } = {}): ProyeccionJugador => {
    const p = proy(o) as unknown as { heroe: Record<string, unknown> };
    p.heroe.almacenPersonal = { cobre: 30, trigo: 0 };
    p.heroe.capacidadAlmacenPersonal = 35;
    return p as unknown as ProyeccionJugador;
  };

  test('el almacén personal: sacar y guardar, hasta su capacidad', () => {
    const p = conPersonal();
    const s = sitioPersonal(p);
    deshacerAlmacen(s.clave);
    expect(pasar(p, s, 'cobre', 'almacen')).toBe(10);
    expect(pasar(p, s, 'madera', 'carro')).toBe(10); // 30 − 10 + 10 = 30 de 35
    expect(ordenesDelBorrador(s)).toEqual([
      ['guardarEnAlmacenPersonal', { recurso: 'madera', cantidad: 10 }],
      ['sacarDelAlmacenPersonal', { recurso: 'cobre', cantidad: 10 }],
    ]);
    deshacerAlmacen(s.clave);
  });

  test('solo el Líder de la columna mueve el carro con el almacén personal', () => {
    const p = conPersonal({ lider: false });
    const s = sitioPersonal(p);
    expect(pasar(p, s, 'cobre', 'almacen')).toBe(0);
    expect(pasar(p, s, 'madera', 'carro')).toBe(0);
  });

  test('con dos almacenes sale el selector; con uno, no', () => {
    const p = conPersonal();
    const plaza = sitioPlaza();
    const dos = htmlAlmacenes(p, [plaza, sitioPersonal(p)], e);
    expect(dos).toContain('data-alm-sitio="plaza:as-1"');
    expect(dos).toContain('Personal ↔ carro');
    expect(dos).toMatch(/data-alm-sitio="plaza:as-1" aria-pressed="true"/);
    expect(htmlAlmacenes(p, [sitioPersonal(p)], e)).not.toContain('data-alm-sitio');
  });

  const sitioPlaza = () => sitioDePlaza(proy(), { id: 'as-1', nombre: 'Micenas', almacen: { trigo: { cantidad: 40 } } } as unknown as Asentamiento);
});
