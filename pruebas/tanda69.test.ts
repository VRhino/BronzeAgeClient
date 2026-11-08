// La tanda 69 del motor (d0326fd) en el cliente: lo que cambia con los datos de juego de verdad (`pruebas/plaza/datos.json`, sacado de Docs/Mechanics
// del motor): los edificios de la comida en «Construir», la estatua y la Maravilla por prestigio, la refundación sin oro, el botín de bandidos en
// madera, piedra, trigo y monedas, y los rechazos nuevos.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, Edificio } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos, costoDeRefundacion } = await import('../src/apiCliente');
const { htmlConstruir, elegirGrupoDe } = await import('../src/ui/panelObras');
const { estadoCliente } = await import('../src/ui/estadoCliente');
const { textoDeBotin } = await import('../src/ui/informeCombate');
const { explicarError } = await import('../src/ui/erroresServidor');
const { RECURSO_NOMBRE, RECURSO_ICONO, EDIFICIO_NOMBRE } = await import('../src/paletas');
const { htmlDiplomacia } = await import('../src/ui/panelDiplomacia');
const { htmlLateralFaccion } = await import('../src/ui/pestanaFaccion');
const { htmlBuey, htmlRecetas } = await import('../src/ui/vistaCiudad');
const { loQueAbreElPrestigio } = await import('../src/ui/avisos');

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

// ---------------------------------------------------------------- tanda 1 (0.185.0)

const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Tu Facción (f-1, eres su Rey) y Troya (f-2), con las alianzas activas que se digan de cada una y sus topes. */
function diplomacia(o: { mias: number; topeMio: number; suyas?: number; topeSuyo?: number; propuestaDeTroya?: boolean }): ProyeccionJugador {
  const aliadas = (de: string, n: number, desde: number) => Array.from({ length: n }, (_, i) => ({ tipo: 'alianza', estado: 'activa', faccionAId: de, faccionBId: `f-${desde + i}` }));
  return {
    heroeId: 'h', faccionId: 'f-1', instante: 0, heroe: { displayName: 'Víctor' }, nombresDeCompaneros: {}, asentamientos: [], asentamientosConocidos: [], asentamientosAvistados: [], titulos: [],
    facciones: [{ id: 'f-1', nombre: 'Micenas', nivel: 1, reyId: 'h', prestigio: 0, topeAlianzas: o.topeMio }, { id: 'f-2', nombre: 'Troya', nivel: 1, reyId: 'r2', prestigio: 0, topeAlianzas: o.topeSuyo ?? 3 }],
    relaciones: [...aliadas('f-1', o.mias, 10), ...aliadas('f-2', o.suyas ?? 0, 20)],
    propuestasRelacion: o.propuestaDeTroya ? [{ id: 'pr-1', tipo: 'alianza', faccionAId: 'f-2', faccionBId: 'f-1', expiraEn: 10_000_000 }] : [],
    propuestasAnexion: [], propuestasFusion: [],
  } as unknown as ProyeccionJugador;
}
const proponerAlianza = (p: ProyeccionJugador): boolean =>
  htmlDiplomacia(p, p.facciones[0]!, esc, { id: 'f-2', nombre: 'Troya' }).includes('data-propuesta-poner="alianza"');

describe('el tope de alianzas, por prestigio', () => {
  test('«Alianza» solo se ofrece si a las dos Facciones les cabe otra', () => {
    expect(proponerAlianza(diplomacia({ mias: 0, topeMio: 1 }))).toBe(true);
    expect(proponerAlianza(diplomacia({ mias: 1, topeMio: 1 }))).toBe(false);
    expect(proponerAlianza(diplomacia({ mias: 1, topeMio: 2, suyas: 3, topeSuyo: 3 }))).toBe(false);
  });

  test('una alianza que llega con el tope lleno solo se puede rechazar, y dice por qué', () => {
    const lleno = htmlDiplomacia(diplomacia({ mias: 1, topeMio: 1, propuestaDeTroya: true }), diplomacia({ mias: 1, topeMio: 1 }).facciones[0]!, esc);
    expect(lleno).not.toContain('data-aceptar="si"');
    expect(lleno).toContain('data-aceptar="no"');
    expect(lleno).toContain('todas las alianzas que le da su prestigio');
    const conHueco = htmlDiplomacia(diplomacia({ mias: 0, topeMio: 1, propuestaDeTroya: true }), diplomacia({ mias: 0, topeMio: 1 }).facciones[0]!, esc);
    expect(conHueco).toContain('data-aceptar="si"');
  });
});

describe('el prestigio en la ventana de la Facción', () => {
  const conPrestigio = (prestigio: number, tope: number, alianzas = 0): string => {
    const p = diplomacia({ mias: alianzas, topeMio: tope });
    (p.facciones[0] as { prestigio?: number }).prestigio = prestigio;
    return htmlLateralFaccion(p, esc);
  };

  test('enseña el prestigio, las alianzas que caben y lo próximo que abre', () => {
    const html = conPrestigio(340, 4, 1);
    expect(html).toContain('Prestigio');
    expect(html).toContain('<strong>340</strong>');
    expect(html).toContain('Alianzas <b>1 de 4</b>');
    expect(html).toContain('Estatuas <b>1</b>');
    expect(html).toContain('A 400: una alianza más');
  });

  test('un umbral que abre varias cosas a la vez las nombra todas', () => {
    expect(conPrestigio(450, 5)).toContain('A 500: una alianza más y la 2.ª estatua');
    expect(conPrestigio(0, 1)).toContain('A 100: una alianza más');
    expect(conPrestigio(1950, 20)).toContain('A 2000: una alianza más y la Maravilla');
  });

  test('los avisos dicen lo que abre cruzar un umbral', () => {
    expect(loQueAbreElPrestigio(195, 200)).toEqual(['una alianza más a la vez', 'otra estatua en la capital']);
    expect(loQueAbreElPrestigio(1990, 2010)).toEqual(['una alianza más a la vez', 'la Maravilla']);
    expect(loQueAbreElPrestigio(201, 205)).toEqual([]);
  });
});

describe('el buey del molino', () => {
  const molino = (buey: boolean, estado: Edificio['estado'] = 'activo'): Edificio => ({ id: 'ed-7', tipo: 'molino', estado, nivelInterno: 1, posicion: { x: 0, y: 0 }, ...(buey ? { buey } : {}) }) as Edificio;
  const conOro = (oro: number): Asentamiento => ({ ...plaza(1), almacen: { oro: { cantidad: oro, capacidad: 1000 } } }) as unknown as Asentamiento;

  test('con cargo y sin buey se ofrece comprarlo por su precio, también con la obra en marcha', () => {
    for (const estado of ['activo', 'en_construccion'] as const) {
      const html = htmlBuey(conOro(50), molino(false, estado), 'gobernador', esc);
      expect(html).toContain('data-ficha-buey="ed-7"');
      expect(html).toContain('el doble');
      expect(html).toContain('12');
    }
  });

  test('sin cargo no se ofrece; con buey se dice que muele el doble', () => {
    expect(htmlBuey(conOro(50), molino(false), null, esc)).toBe('');
    const con = htmlBuey(conOro(50), molino(true), null, esc);
    expect(con).not.toContain('data-ficha-buey');
    expect(con).toContain('muele el doble');
  });

  test('otro edificio no lleva buey', () => {
    expect(htmlBuey(conOro(50), { ...molino(false), tipo: 'horno' }, 'gobernador', esc)).toBe('');
  });

  test('en «Talleres», el molino con buey hace el doble de harina', () => {
    const ritmo = (buey: boolean): string => {
      const a = { ...plaza(1), edificios: [molino(buey)] } as unknown as Asentamiento;
      const c = { proyeccion: { heroeId: 'h', facciones: [] }, asentamiento: a, cargo: null, escapar: esc, refrescar: () => {} } as unknown as ContextoPlaza;
      return htmlRecetas(c).match(/<small>([\d.,]+)\/min<\/small>/)?.[1] ?? '';
    };
    expect(ritmo(false)).toBe('4');
    expect(ritmo(true)).toBe('8');
  });
});
