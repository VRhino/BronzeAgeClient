// La tanda 69 del motor (d0326fd) en el cliente: lo que cambia con los datos de juego de verdad (`pruebas/plaza/datos.json`, sacado de Docs/Mechanics
// del motor): los edificios de la comida en «Construir», la estatua y la Maravilla por prestigio, la refundación sin oro, el botín de bandidos en
// madera, piedra, trigo y monedas, y los rechazos nuevos.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento } from '../src/tiposDominio';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos, costoDeRefundacion } = await import('../src/apiCliente');
const { htmlConstruir, elegirGrupoDe } = await import('../src/ui/panelObras');
const { estadoCliente } = await import('../src/ui/estadoCliente');
const { textoDeBotin } = await import('../src/ui/informeCombate');
const { explicarError } = await import('../src/ui/erroresServidor');
const { RECURSO_NOMBRE, RECURSO_ICONO, EDIFICIO_NOMBRE } = await import('../src/paletas');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('EDIFICIO_CATALOGO', listo)) listo(); });
});

const plaza = (nivel: number, edificios: { tipo: string; estado?: 'activo' | 'en_construccion' | 'en_cola' }[] = []): Asentamiento =>
  ({ id: 'as-1', nivel, nivelActual: nivel, almacen: { madera: { cantidad: 9000 }, piedra: { cantidad: 9000 } }, edificios: edificios.map((e, i) => ({ id: `e${i}`, posicion: { x: 0, y: 0 }, estado: 'activo', ...e })) }) as unknown as Asentamiento;

/** La Facción del jugador con ese prestigio y esa capital. */
function conFaccion(prestigio: number, capitalId = 'as-1'): void {
  estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [{ id: 'f-1', nombre: 'Uno', nivel: 1, prestigio, capitalId }], tecnologiasAdoptadas: [] } as unknown as ProyeccionJugador;
}

/** ¿Sale la casilla de ese tipo en «Construir»? Solo se pintan las de la pestaña abierta: se abre la suya antes de mirar. */
const ofrece = (a: Asentamiento, tipo: string): boolean => {
  elegirGrupoDe(tipo);
  return htmlConstruir(a, 'gobernador', (t) => t).includes(`data-construir="${tipo}"`);
};

describe('los recursos y edificios nuevos', () => {
  test('los nueve recursos de la comida tienen nombre e icono', () => {
    for (const r of ['harina', 'pan', 'carne', 'leche', 'queso', 'uva', 'aceituna', 'vino', 'aceite']) {
      expect(RECURSO_NOMBRE[r]).toBeTruthy();
      expect(RECURSO_ICONO[r]).toBeTruthy();
    }
  });

  test('los seis edificios tienen nombre', () => {
    for (const t of ['molino', 'horno', 'quesera', 'bodega', 'prensa', 'estatua']) expect(EDIFICIO_NOMBRE[t]).toBeTruthy();
  });

  test('«Construir» tiene la pestaña Comida, y en el nivel 1 trae el molino y el horno, no la quesera', () => {
    conFaccion(0);
    const html = htmlConstruir(plaza(1), 'gobernador', (t) => t);
    expect(html).toContain('data-grupo-construir="comida"');
  });
});

describe('la estatua y la Maravilla, por prestigio', () => {
  test('sin prestigio no hay estatua; con 200, una en la capital', () => {
    conFaccion(0);
    expect(ofrece(plaza(1), 'estatua')).toBe(false);
    conFaccion(200);
    expect(ofrece(plaza(1), 'estatua')).toBe(true);
  });

  test('fuera de la capital no sale nunca', () => {
    conFaccion(5000, 'as-9');
    expect(ofrece(plaza(5), 'estatua')).toBe(false);
  });

  test('cuentan las hechas y las que están en obra: con 200 cabe una, con 500 dos', () => {
    conFaccion(200);
    expect(ofrece(plaza(1, [{ tipo: 'estatua', estado: 'en_construccion' }]), 'estatua')).toBe(false);
    conFaccion(500);
    expect(ofrece(plaza(1, [{ tipo: 'estatua' }]), 'estatua')).toBe(true);
    expect(ofrece(plaza(1, [{ tipo: 'estatua' }, { tipo: 'estatua', estado: 'en_cola' }]), 'estatua')).toBe(false);
  });

  test('la Maravilla pide 2000 de prestigio', () => {
    conFaccion(1999);
    expect(ofrece(plaza(5), 'maravilla')).toBe(false);
    conFaccion(2000);
    expect(ofrece(plaza(5), 'maravilla')).toBe(true);
  });
});

describe('la comida en «Construir», por nivel de plaza', () => {
  test('molino y horno desde el 1; quesera desde el 2, bodega desde el 3 y prensa desde el 4', () => {
    conFaccion(0);
    const en = (nivel: number) => ['molino', 'horno', 'quesera', 'bodega', 'prensa'].filter((t) => ofrece(plaza(nivel), t));
    expect(en(1)).toEqual(['molino', 'horno']);
    expect(en(2)).toEqual(['molino', 'horno', 'quesera']);
    expect(en(3)).toEqual(['molino', 'horno', 'quesera', 'bodega']);
    expect(en(4)).toEqual(['molino', 'horno', 'quesera', 'bodega', 'prensa']);
  });
});

describe('la refundación y los bandidos ya no dan ni piden oro', () => {
  test('la refundación cuesta 64 de madera, 8 de piedra y 40 de trigo, sin oro (Fundacion_Y_Refundacion)', () => {
    expect(costoDeRefundacion()).toEqual({ madera: 64, piedra: 8, trigo: 40 });
  });

  test('el botín de unos bandidos se cuenta en recursos al carro y monedas', () => {
    expect(textoDeBotin({ madera: 5, piedra: 5, trigo: 5 }, 50, 1)).toBe('5 de madera, 5 de piedra y 5 de trigo al carro y 50 monedas');
    expect(textoDeBotin({ madera: 10, piedra: 0, trigo: 10 }, 300, 3)).toBe('10 de madera y 10 de trigo al carro y 300 monedas entre los 3 héroes');
    expect(textoDeBotin({ madera: 0 }, 0, 1)).toBeNull();
  });
});

describe('los rechazos nuevos', () => {
  test('tienen su texto', () => {
    for (const c of ['heroe.sin_monedas', 'obra.prestigio_insuficiente', 'obra.solo_en_capital', 'molino.no_es_molino', 'molino.ya_tiene_buey', 'pueblo.cultivo_bloqueado',
      'diplomacia.tope_alianzas', 'intel.sin_informe_de_ordenes', 'mercenario.fuera_de_la_region']) {
      expect(explicarError(c)).not.toBe(c);
    }
  });
});
