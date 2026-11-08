// La tanda 69 del motor (d0326fd) en el cliente: lo que cambia con los datos de juego de verdad (`pruebas/plaza/datos.json`, sacado de Docs/Mechanics
// del motor): los edificios de la comida en «Construir», la estatua y la Maravilla por prestigio, la refundación sin oro, el botín de bandidos en
// madera, piedra, trigo y monedas, y los rechazos nuevos.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, Edificio, PuebloDeMapa } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';
import type { MapaGenerado } from '../src/terreno';

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
const { produce, SUBPESTANA_PUEBLOS } = await import('../src/ui/pueblos');
const { sitiosDeAldea } = await import('../src/mundo/fertilidad');

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

// ---------------------------------------------------------------- tanda 2 (0.186.0)

describe('el cultivo de las aldeas', () => {
  const aldea = (cultivo?: string): PuebloDeMapa => ({ id: 'pueblo-1', tipo: 'aldeaAgricola', madreId: 'as-1', propio: true, posicion: { x: 0, y: 0 }, almacen: {}, capacidad: 1000, ...(cultivo ? { cultivo } : {}) }) as PuebloDeMapa;

  test('lo que produce (y se le puede dejar) depende del cultivo: solo la de trigo tiene rebaño', () => {
    expect(produce(aldea('trigo'))).toEqual(['trigo', 'livestock', 'carne', 'leche']);
    expect(produce(aldea())).toEqual(['trigo', 'livestock', 'carne', 'leche']);
    expect(produce(aldea('vid'))).toEqual(['uva']);
    expect(produce(aldea('oliva'))).toEqual(['aceituna']);
  });

  test('al marcar una aldea, la vid sale desde el nivel 3 de la plaza y el olivo desde el 4; con solo el trigo no hay que elegir', () => {
    const cultivos = (nivel: number): string[] => {
      const a = { ...plaza(nivel), posicion: { x: 50, y: 50 }, faccionId: 'f-1', cargos: { gobernadorId: 'h' } } as unknown as Asentamiento;
      const proyeccion = { heroeId: 'h', faccionId: 'f-1', facciones: [], asentamientos: [a], asentamientosAvistados: [], pueblos: [], obrasDeMapa: [], avanzadas: [], caravanas: [] } as unknown as ProyeccionJugador;
      const c = { proyeccion, asentamiento: a, cargo: 'gobernador', resideAqui: true, escapar: esc, refrescar: () => {} } as unknown as ContextoPlaza;
      return [...SUBPESTANA_PUEBLOS.html(c).matchAll(/name="pueblo-cultivo" value="(\w+)"/g)].map((m) => m[1]!);
    };
    expect(cultivos(1)).toEqual([]);
    expect(cultivos(3)).toEqual(['trigo', 'vid']);
    expect(cultivos(4)).toEqual(['trigo', 'vid', 'oliva']);
  });
});

describe('los sitios de la aldea, con la tierra de su cultivo', () => {
  // 10×10 celdas de 1 u, todo tierra firme; el trigo no crece en ninguna, la vid en la mitad de la derecha y el olivo en ninguna.
  const capa = (valor: (c: number) => number) => ({ columnas: 10, filas: 10, celda: 1, datos: Uint8Array.from({ length: 100 }, (_, i) => valor(i % 10)) });
  const mapa = { rasters: { terreno: capa(() => 3), fertilidad: capa(() => 0), fertilidadVid: capa((c) => (c >= 5 ? 200 : 0)), fertilidadOliva: capa(() => 0) } } as unknown as MapaGenerado;
  const zona = { centro: { x: 5, y: 5 }, radio: 4 };

  test('cada cultivo mira su capa', () => {
    expect(sitiosDeAldea(mapa, zona, [], 0.3, 1)!.validos).toHaveLength(0);
    const vid = sitiosDeAldea(mapa, zona, [], 0.3, 1, 'vid')!;
    expect(vid.validos.length).toBeGreaterThan(0);
    expect(vid.validos.every((q) => q.x >= 5)).toBe(true);
    expect(vid.mejor).toBeCloseTo(200 / 255);
    expect(sitiosDeAldea(mapa, zona, [], 0.3, 1, 'oliva')!.validos).toHaveLength(0);
  });

  test('sin la capa de su cultivo (un mundo de antes) no se sabe', () => {
    const viejo = { rasters: { terreno: capa(() => 3), fertilidad: capa(() => 255) } } as unknown as MapaGenerado;
    expect(sitiosDeAldea(viejo, zona, [], 0.3, 1, 'vid')).toBeNull();
    expect(sitiosDeAldea(viejo, zona, [], 0.3, 1)!.validos.length).toBeGreaterThan(0);
  });
});

describe('pagar contratos con monedas', async () => {
  const { fuentesDeContrato } = await import('../src/ui/columnaQuePaga');
  const { htmlTablonMercenarios, textoDeHechoMercenario } = await import('../src/ui/mercenarios');
  const columna = { id: 'ej-1', faccionId: 'f-1', tipo: 'ejercito', liderId: 'heroe-1', estado: 'estacionado', posicionActual: { x: 0, y: 0 }, participantes: [{ heroeId: 'heroe-1', unidoEn: 0 }], suministro: { oro: 30 } };
  const proy = (monedas: number, ubicacion: unknown = { tipo: 'columna', ejercitoId: 'ej-1' }, ejercitos: unknown[] = [columna]): ProyeccionJugador =>
    ({
      heroeId: 'heroe-1', faccionId: 'f-1', instante: 0,
      heroe: { id: 'heroe-1', ubicacion, monedas, escuadrones: [] },
      ejercitos, asentamientos: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'f-1', posicion: { x: 0, y: 0 } }], asentamientosConocidos: [], asentamientosAvistados: [], caravanasAvistadas: [],
      pueblos: [], avanzadas: [], caravanas: [], convocatorias: [], campamentosBandidos: [], heroesVisibles: [], ejercitosAvistados: [], relaciones: [], nombresDeCompaneros: {},
      facciones: [{ id: 'f-1', nombre: 'Uno', nivel: 1, reyId: 'heroe-1' }],
      campamentosMercenarios: [{ id: 'camp-2', residentesIds: [] }],
    }) as unknown as ProyeccionJugador;
  const camp = { id: 'camp-2', residentesIds: [] as string[] };

  test('las monedas se ofrecen al final, solo si tienes alguna y estás en el campamento', () => {
    expect(fuentesDeContrato(proy(4800), camp).map((f) => [f.pagarCon, f.saldo, f.enMonedas])).toEqual([['carro', 30, false], ['monedas', 4800, true]]);
    expect(fuentesDeContrato(proy(0), camp).map((f) => f.pagarCon)).toEqual(['carro']);
    // dentro del campamento sin columna ni residencia: no hay oro a mano, pero las monedas valen en cualquier sitio donde se firme
    expect(fuentesDeContrato(proy(500, { tipo: 'mercenarios', campamentoId: 'camp-2' }, []), camp).map((f) => f.pagarCon)).toEqual(['monedas']);
    // lejos del campamento, nada
    expect(fuentesDeContrato(proy(500, { tipo: 'desconectado' }, []), camp)).toEqual([]);
  });

  test('con monedas, el tablón cobra la tarifa en monedas', () => {
    const tablon = [{ heroeId: 'heroe-30', tropa: [], tarifas: [{ plazoDias: 1, oro: 48, monedas: 4800 }, { plazoDias: 3, oro: 112, monedas: 11200 }, { plazoDias: 7, oro: 224, monedas: 22400 }, { oro: 1600, monedas: 160000 }] }];
    const html = htmlTablonMercenarios(proy(5000, { tipo: 'mercenarios', campamentoId: 'camp-2' }, []), tablon as never, (t) => t, camp);
    expect(html).toContain('💰 5000 monedas');
    expect(html).toContain('4800 💰');
    expect(html).toContain('11.200 💰');
    expect(html).not.toContain('48 🪙');
    // lo elegido por defecto (3 días) y con qué se paga van en el botón
    expect(html).toMatch(/data-merc-pagar-con="monedas"[^>]*>Contratar · 11\.200 💰/);
  });

  test('los hechos dicen con qué se pagó', () => {
    expect(textoDeHechoMercenario('mercenarios.contratado', { mercenario: 30, oro: 0, monedas: 4800 }, null)).toBe('heroe-30 entra a sueldo de tu Facción por 4800 monedas.');
    expect(textoDeHechoMercenario('mercenarios.contratado', { mercenario: 30, oro: 48000, monedas: 0 }, null)).toBe('heroe-30 entra a sueldo de tu Facción por 48 de oro.');
    expect(textoDeHechoMercenario('mercenarios.prorrogado', { mercenario: 30, oro: 0, monedas: 11200 }, null)).toBe('Se prorroga el contrato de heroe-30 por 11.200 monedas.');
  });
});

describe('la taberna regional', async () => {
  const { traducirOrden } = await import('../src/motor/ordenes');
  const { regionEn } = await import('../src/mundo/region');
  const { compraIntelEn, htmlServicioRegion, informesDeOrdenesVigentes, ordenesDeLaRegion, fuentesDeRegion, SUBPESTANA_REGION } = await import('../src/ui/tabernaRegion');
  const { tarifasDeIntel } = await import('../src/apiCliente');
  const AHORA = 1_000_000_000;
  const mapa = { rasters: { region: { columnas: 4, filas: 2, celda: 10, datos: new Uint8Array([3, 3, 5, 5, 3, 3, 5, 0]) } }, regiones: [{ id: 3, nombre: 'Llanura de Argos' }, { id: 5, nombre: 'Altiplano interior' }] } as unknown as MapaGenerado;
  const plaza = (gobernador = 'heroe-1') => ({ id: 'as-1', faccionId: 'f-1', posicion: { x: 5, y: 5 }, cargos: { gobernadorId: gobernador }, edificios: [{ id: 't', tipo: 'taberna', estado: 'activo' }], almacen: { oro: { cantidad: 200 } } }) as unknown as Asentamiento;
  const proy = (o: { rey?: string; dentro?: boolean; monedas?: number; informes?: unknown[]; ordenes?: unknown[] } = {}): ProyeccionJugador =>
    ({
      heroeId: 'heroe-1', faccionId: 'f-1', instante: AHORA,
      heroe: { id: 'heroe-1', ubicacion: o.dentro === false ? { tipo: 'desconectado' } : { tipo: 'asentamiento', asentamientoId: 'as-1' }, monedas: o.monedas ?? 0 },
      facciones: [{ id: 'f-1', nombre: 'Uno', reyId: o.rey ?? 'heroe-9', informesRegion: o.informes ?? [] }, { id: 'f-2', nombre: 'Dos' }],
      asentamientos: [plaza()], asentamientosAvistados: [],
      asentamientosConocidos: [{ asentamientoId: 'as-7', nombre: 'Tirinto', faccionId: 'f-2', posicion: { x: 30, y: 5 } }, { asentamientoId: 'as-2', nombre: 'Mía', faccionId: 'f-1', posicion: { x: 8, y: 5 } }],
      ordenes: o.ordenes ?? [], tarifasIntel: tarifasDeIntel(),
    }) as unknown as ProyeccionJugador;

  test('la región de un punto sale de la capa del mundo, con su nombre', () => {
    expect(regionEn(mapa, { x: 12, y: 4 })).toEqual({ id: 3, nombre: 'Llanura de Argos' });
    expect(regionEn(mapa, { x: 25, y: 15 })).toEqual({ id: 5, nombre: 'Altiplano interior' });
    expect(regionEn(mapa, { x: 35, y: 15 })).toBeNull(); // celda sin región
    expect(regionEn(mapa, { x: 50, y: 5 })).toBeNull(); // fuera del mapa
  });

  test('las órdenes nuevas se traducen al contrato (la cantidad, en milésimas)', () => {
    expect(traducirOrden('comprarInformeRegion', { asentamientoId: 'as-1', tipo: 'ordenes' })).toMatchObject({ case: 'comprarInformeRegion', value: { asentamientoId: 'as-1', tipo: 'ordenes' } });
    expect(traducirOrden('tomarOrdenADistancia', { asentamientoId: 'as-1', ordenId: 'ord-3', cantidad: 25 })).toMatchObject({ case: 'tomarOrdenADistancia', value: { asentamientoId: 'as-1', ordenId: 'ord-3', cantidad: 25000n } });
  });

  test('el informe lo compran el Rey, el Embajador o el Gobernador, dentro de la plaza', () => {
    expect(compraIntelEn(proy(), plaza())).toBe(true); // Gobernador
    expect(compraIntelEn(proy(), plaza('heroe-9'))).toBe(false);
    expect(compraIntelEn(proy({ rey: 'heroe-1' }), plaza('heroe-9'))).toBe(true);
    expect(compraIntelEn(proy({ dentro: false }), plaza())).toBe(false);
    expect(htmlServicioRegion(proy(), plaza('heroe-9'), 200, (t) => t)).toBe('');
    expect(htmlServicioRegion(proy(), plaza(), 200, (t) => t)).toContain('data-region-comprar="ordenes"');
  });

  test('un informe reciente no se vuelve a comprar hasta que pasa su enfriamiento', () => {
    estadoCliente.mapaCache = { id: 'm', mapa };
    const informes = [{ region: 3, tipo: 'ordenes', compradoEn: AHORA - 1, caducaEn: AHORA + 60_000, libreEn: AHORA + 120_000 }];
    const html = htmlServicioRegion(proy({ informes }), plaza(), 200, (t) => t);
    expect(html).toContain('Llanura de Argos');
    expect(html).toContain('data-region-comprar="plazas"');
    expect(html).not.toContain('data-region-comprar="ordenes"');
    expect(html).toContain('Otra vez en');
    estadoCliente.mapaCache = null;
  });

  test('las órdenes de la región: solo las ajenas y activas; la pestaña, solo con un informe de órdenes vigente', () => {
    const orden = (id: string, asentamientoId: string, estado = 'activa') => ({ id, asentamientoId, tipo: 'venta', recurso: 'estano', cantidad: 10, cantidadCumplida: 0, precioUnitario: 3, expiraEn: AHORA + 1, estado });
    const ordenes = [orden('o1', 'as-7'), orden('o2', 'as-1'), orden('o3', 'as-2'), orden('o4', 'as-7', 'cumplida')];
    const p = proy({ ordenes, informes: [{ region: 3, tipo: 'ordenes', compradoEn: AHORA - 1, caducaEn: AHORA + 60_000, libreEn: AHORA + 120_000 }] });
    expect(ordenesDeLaRegion(p, { x: 5, y: 5 }).map((g) => [g.plaza.nombre, g.ordenes.map((o) => o.id)])).toEqual([['Tirinto', ['o1']]]);
    const c = (q: ProyeccionJugador) => ({ proyeccion: q, asentamiento: plaza() }) as unknown as ContextoPlaza;
    expect(informesDeOrdenesVigentes(p)).toHaveLength(1);
    expect(SUBPESTANA_REGION.visible!(c(p))).toBe(true);
    expect(SUBPESTANA_REGION.visible!(c(proy({ informes: [{ region: 3, tipo: 'ordenes', compradoEn: AHORA - 9, caducaEn: AHORA - 1, libreEn: AHORA + 1 }] })))).toBe(false);
  });

  test('desde la taberna se contrata con el almacén de la plaza (los tres cargos) o con monedas', () => {
    expect(fuentesDeRegion(proy({ monedas: 500 }), plaza()).map((f) => [f.pagarCon, f.saldo])).toEqual([['almacenPlaza', 200], ['monedas', 500]]);
    expect(fuentesDeRegion(proy(), plaza('heroe-9'))).toEqual([]);
  });
});
