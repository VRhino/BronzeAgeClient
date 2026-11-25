import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, radioDePuerta: () => 2, distanciasDeFundar: () => ({ plazas: 60, campamentos: 60 }) }));
import type { ProyeccionJugador } from '../src/apiCliente';
import { pasoDelCamino } from '../src/ui/caminoPrimeraPlaza';

const PRECIO = { madera: 64, piedra: 8, trigo: 40 };
const camp = (extra: object = {}) => ({ id: 'camp-1', posicion: { x: 100, y: 100 }, residentesIds: ['h'], fondos: {}, ...extra });
const proy = (extra: object = {}): ProyeccionJugador => ({
  heroeId: 'h', faccionId: 'f-1',
  heroe: { id: 'h', escuadrones: [{ id: 's', cantidad: 20 }], almacenPersonal: {}, carro: {} },
  asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [],
  ejercitos: [], caravanas: [], campamentosBandidos: [], campamentosMercenarios: [camp()],
  ...extra,
}) as unknown as ProyeccionJugador;
const columna = (x: number, y: number, extra: object = {}) => ({ id: 'ej-1', posicionActual: { x, y }, participantes: [{ heroeId: 'h' }], suministro: {}, ...extra });

describe('Camino a tu primera plaza', () => {
  it('con plaza en tu Facción no hay camino', () => {
    expect(pasoDelCamino(proy({ asentamientosAvistados: [{ faccionId: 'f-1', posicion: { x: 0, y: 0 } }] }), {}, PRECIO)).toBeNull();
  });

  it('sin Facción, lo primero es tenerla', () => {
    const p = pasoDelCamino(proy({ faccionId: null }), {}, PRECIO);
    expect(p?.id).toBe('faccion');
    expect(p?.boton?.accion).toEqual({ tipo: 'faccion' });
  });

  it('dentro del campamento sin nada: sin tropa, a pedirla; con tropa, a salir', () => {
    const sinTropa = proy({ heroe: { id: 'h', escuadrones: [], almacenPersonal: {} } });
    expect(pasoDelCamino(sinTropa, { campamento: camp() as never }, PRECIO)?.boton?.accion).toEqual({ tipo: 'parte', parte: 'tropa' });
    const p = pasoDelCamino(proy(), { campamento: camp() as never }, PRECIO);
    expect(p?.id).toBe('botin');
    expect(p?.texto).toContain('64 de madera, 8 de piedra y 40 de trigo');
    expect(p?.boton?.accion).toEqual({ tipo: 'salir' });
  });

  it('fuera, va a por los bandidos del anillo de tu campamento antes que a otros más cerca', () => {
    const p = proy({
      ejercitos: [columna(130, 100)],
      campamentosBandidos: [{ id: 'b-cerca', posicion: { x: 131, y: 100 } }, { id: 'b-anillo', posicion: { x: 90, y: 90 }, campamentoMercenariosId: 'camp-1' }],
    });
    expect(pasoDelCamino(p, {}, PRECIO)?.boton?.accion).toMatchObject({ tipo: 'bandidos', id: 'b-anillo' });
  });

  it('con botín en el carro: lejos, vuelve; a la puerta, entra; dentro, abre el Fondo', () => {
    const carro = { suministro: { madera: 15, oro: 30 } };
    const lejos = pasoDelCamino(proy({ ejercitos: [columna(140, 100, carro)] }), {}, PRECIO);
    expect(lejos?.id).toBe('aportar');
    expect(lejos?.texto).toContain('15 de madera');
    expect(lejos?.boton?.accion).toEqual({ tipo: 'marchar', posicion: { x: 100, y: 100 } });
    expect(pasoDelCamino(proy({ ejercitos: [columna(101, 100, carro)] }), {}, PRECIO)?.boton?.accion).toEqual({ tipo: 'entrar', campamentoId: 'camp-1' });
    expect(pasoDelCamino(proy({ ejercitos: [columna(101, 100, carro)] }), { campamento: camp() as never }, PRECIO)?.boton?.accion).toEqual({ tipo: 'parte', parte: 'fondo' });
  });

  it('lo que ya está en el Fondo no se pide otra vez, y completo toca comprar', () => {
    const medio = camp({ fondos: { 'f-1': { madera: 64, piedra: 2, trigo: 40 } } });
    const p = pasoDelCamino(proy({ campamentosMercenarios: [medio] }), { campamento: medio as never }, PRECIO);
    expect(p?.texto).toContain('faltan 6 de piedra');
    const lleno = camp({ fondos: { 'f-1': PRECIO } });
    expect(pasoDelCamino(proy({ campamentosMercenarios: [lleno] }), { campamento: lleno as never }, PRECIO)?.id).toBe('comprar');
  });

  it('el Fondo visto dentro se recuerda fuera, donde no llega', () => {
    const lleno = camp({ id: 'camp-9', fondos: { 'f-1': PRECIO } });
    pasoDelCamino(proy({ campamentosMercenarios: [lleno] }), { campamento: lleno as never }, PRECIO);
    const fuera = proy({ campamentosMercenarios: [{ ...lleno, fondos: {} }], ejercitos: [columna(140, 100)] });
    expect(pasoDelCamino(fuera, {}, PRECIO)?.id).toBe('comprar');
  });

  it('con la caravana esperando dentro: salir con ella; llevándola tú, fundar', () => {
    const caravana = { id: 'car-1', tipo: 'construccion', estado: 'disponible', faccionId: 'f-1', origenCampamentoId: 'camp-1' };
    const p = pasoDelCamino(proy({ caravanas: [caravana] }), { campamento: camp() as never }, PRECIO);
    expect(p?.id).toBe('llevar');
    expect(p?.boton).toEqual({ etiqueta: 'Salir con la caravana', accion: { tipo: 'salir' } });
    const fundar = pasoDelCamino(proy({ ejercitos: [columna(200, 100, { caravanaFundacionId: 'car-1', liderId: 'h' })], caravanas: [{ ...caravana, estado: 'adjunta' }] }), {}, PRECIO);
    expect(fundar?.id).toBe('fundar');
    expect(fundar?.boton?.accion).toEqual({ tipo: 'fundar' });
    const otroLider = pasoDelCamino(proy({ ejercitos: [columna(200, 100, { caravanaFundacionId: 'car-1', liderId: 'otro' })] }), {}, PRECIO);
    expect(otroLider?.boton).toBeUndefined();
  });
});
