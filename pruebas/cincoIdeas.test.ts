// Las cinco ideas del motor del 2026-11-10 en el cliente (motor 906fb24, contrato 0.21.0; cliente 0.199.0): reclutar con tu columna en una plaza
// de tu Facción donde no resides y el interruptor que lo cierra, el rumor de las vetas de estaño en la taberna, pausar el consumo por bien y el
// aviso de solvencia del ascenso. Sin DOM.
import { describe, expect, test, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento } from '../src/tiposDominio';
import type { MapaGenerado } from '../src/terreno';
import { AsentamientoSchema, InsolvenciaSchema } from '../src/contrato/gen/bronzeage/v1/entities_pb';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { plazaDeContrato } = await import('../src/motor/proyeccion');
const { traducirOrden } = await import('../src/motor/ordenes');
const { permisoDeReclutar, liderazgoFuera, mandaReclutamiento, htmlCierreACiudadanos, htmlNotaDeCiudadano } = await import('../src/ui/reclutamiento');
const { htmlPausarConsumo, lineaDeNutricion, pausaConsumo, textoPausados, cablearPausarConsumo } = await import('../src/ui/consumoPausado');
const { htmlAvisoSolvencia } = await import('../src/ui/panelCentro');
const { htmlServicioRumores, vetasPorContar, compraRumores } = await import('../src/ui/rumores');
const { htmlEstadoPie } = await import('../src/ui/hudPlaza');
const { explicarError } = await import('../src/ui/erroresServidor');
const { estadoCliente } = await import('../src/ui/estadoCliente');

const e = (t: string): string => t;

/** Una plaza de la Facción f-1 con lo que haga falta. */
const plaza = (x: Partial<Asentamiento> = {}): Asentamiento =>
  ({ id: 'as-1', nombre: 'Micenas', faccionId: 'f-1', nivel: 2, posicion: { x: 5, y: 5 }, edificios: [], heroesFundadoresIds: [], casasCompradas: [], ...x }) as Asentamiento;

/** El jugador (heroe-1, de f-1) dentro de `a`, con esas escuadras y quizá su columna. */
const proy = (a: Asentamiento, o: { columna?: boolean; escuadrones?: unknown[]; cargos?: string[]; faccionId?: string | null } = {}): ProyeccionJugador =>
  ({
    heroeId: 'heroe-1', faccionId: o.faccionId === undefined ? 'f-1' : o.faccionId, instante: 0,
    heroe: { id: 'heroe-1', liderazgoBase: 20, ubicacion: { tipo: 'asentamiento', asentamientoId: a.id }, escuadrones: o.escuadrones ?? [] },
    facciones: [{ id: 'f-1', nombre: 'Casa de Micenas', reyId: 'heroe-9', miembros: [{ heroeId: 'heroe-1', cargos: o.cargos ?? [], participacion: 0 }] }],
    ejercitos: o.columna ? [{ id: 'ej-1', participantes: [{ heroeId: 'heroe-1' }], posicionActual: { x: 5, y: 5 } }] : [],
    asentamientos: [a], plazasPropias: [a], asentamientosAvistados: [], asentamientosConocidos: [], campamentosMercenarios: [],
    exploracion: { tamanoCelda: 5, columnas: 8, filas: 4, celdas: '', visibles: '' },
    tarifasIntel: { rumores: { vetasEstano: { oro: 80, radio: 10 } } },
  }) as unknown as ProyeccionJugador;

describe('el contrato 0.21.0', () => {
  test('los campos 52 a 54 de la plaza llegan a la proyección (en unidades por minuto)', () => {
    const pb = create(AsentamientoSchema, {
      id: 'as-1', reclutamientoCerradoACiudadanos: true, consumoPausado: ['carne', 'pan'],
      insolvenciaAscenso: [create(InsolvenciaSchema, { recurso: 'trigo', llega: 1200n, pide: 3000n })],
    });
    const { asentamiento: a } = plazaDeContrato(pb, 0);
    expect(a.reclutamientoCerradoACiudadanos).toBe(true);
    expect(a.consumoPausado).toEqual(['carne', 'pan']);
    expect(a.insolvenciaAscenso).toEqual([{ recurso: 'trigo', llega: 1.2, pide: 3 }]);
  });

  test('sin nada, los tres quedan ausentes', () => {
    const { asentamiento: a } = plazaDeContrato(create(AsentamientoSchema, { id: 'as-1' }), 0);
    expect(a.reclutamientoCerradoACiudadanos).toBeUndefined();
    expect(a.consumoPausado).toBeUndefined();
    expect(a.insolvenciaAscenso).toBeUndefined();
  });

  test('las tres órdenes nuevas se traducen', () => {
    expect(traducirOrden('cerrarReclutamientoACiudadanos', { asentamientoId: 'as-1', cerrado: true })).toMatchObject({ case: 'cerrarReclutamientoACiudadanos', value: { asentamientoId: 'as-1', cerrado: true } });
    expect(traducirOrden('pausarConsumo', { asentamientoId: 'as-1', recurso: 'carne', pausado: true })).toMatchObject({ case: 'pausarConsumo', value: { asentamientoId: 'as-1', recurso: 'carne', pausado: true } });
    expect(traducirOrden('comprarRumor', { origen: { tipo: 'campamento', id: 'camp-2' }, tipo: 'vetas_estano' })).toMatchObject({ case: 'comprarRumor', value: { origen: { tipo: 'campamento', id: 'camp-2' }, tipo: 'vetas_estano' } });
  });

  test('los rechazos nuevos tienen texto', () => {
    for (const c of ['reclutamiento.solo_reponer', 'consumo.no_se_pausa', 'rumor.sin_novedad', 'intel.sin_oro']) expect(explicarError(c)).not.toBe(c);
  });
});

describe('reclutar en una plaza de tu Facción donde no resides', () => {
  test('el permiso, como el motor', () => {
    expect(permisoDeReclutar(proy(plaza({ heroesFundadoresIds: ['heroe-1'] })), plaza({ heroesFundadoresIds: ['heroe-1'] }))).toBe('todo');
    const a = plaza();
    expect(permisoDeReclutar(proy(a), a)).toBe('ciudadano');
    const cerrada = plaza({ reclutamientoCerradoACiudadanos: true });
    expect(permisoDeReclutar(proy(cerrada), cerrada)).toBe('soloReponer');
    const vetado = plaza({ vetadosIds: ['heroe-1'] });
    expect(permisoDeReclutar(proy(vetado), vetado)).toBe('no');
    const ajena = plaza({ faccionId: 'f-2' });
    expect(permisoDeReclutar(proy(ajena), ajena)).toBe('no');
    expect(permisoDeReclutar(proy(a, { faccionId: null }), a)).toBe('no');
  });

  test('el Liderazgo que ya lleva fuera no cuenta el campamento ni la guarnición de visita de esta plaza', () => {
    const a = plaza();
    const esc = (contenedor: unknown, costeLiderazgo: number) => ({ id: `s${costeLiderazgo}`, tropaId: 't', cantidad: 10, costeLiderazgo, contenedor });
    const p = proy(a, { escuadrones: [esc({ tipo: 'campamento' }, 1), esc({ tipo: 'ejercito', ejercitoId: 'ej-1' }, 2), esc({ tipo: 'plaza', asentamientoId: 'as-1' }, 4), esc({ tipo: 'plaza', asentamientoId: 'as-2' }, 8)] });
    expect(liderazgoFuera(p, a)).toBe(10);
  });

  test('encima del árbol, quien no reside lee cómo recluta aquí', () => {
    const a = plaza();
    expect(htmlNotaDeCiudadano(proy(a, { columna: true }), a)).toContain('va a tu columna');
    expect(htmlNotaDeCiudadano(proy(a), a)).toContain('has entrado sin columna');
    const cerrada = plaza({ reclutamientoCerradoACiudadanos: true });
    expect(htmlNotaDeCiudadano(proy(cerrada, { columna: true }), cerrada)).toContain('solo repones');
    const suya = plaza({ heroesFundadoresIds: ['heroe-1'], reclutamientoCerradoACiudadanos: true });
    expect(htmlNotaDeCiudadano(proy(suya), suya)).toBe('');
  });

  test('el interruptor sale al Gobernador y al General que residen, a nadie más', () => {
    const a = plaza({ heroesFundadoresIds: ['heroe-1'] });
    expect(mandaReclutamiento(proy(a), a)).toBe(false);
    expect(htmlCierreACiudadanos(proy(a), a)).toBe('');
    const gob = plaza({ heroesFundadoresIds: ['heroe-1'], cargos: { gobernadorId: 'heroe-1' } });
    expect(htmlCierreACiudadanos(proy(gob), gob)).toContain('data-recl-cerrar="as-1"');
    const general = plaza({ heroesFundadoresIds: ['heroe-1'] });
    expect(mandaReclutamiento(proy(general, { cargos: ['general@as-1'] }), general)).toBe(true);
    // el General que no reside no lo toca
    const fuera = plaza({ cargos: { generalId: 'heroe-1' } });
    expect(mandaReclutamiento(proy(fuera), fuera)).toBe(false);
    const cerrada = plaza({ heroesFundadoresIds: ['heroe-1'], cargos: { gobernadorId: 'heroe-1' }, reclutamientoCerradoACiudadanos: true });
    const html = htmlCierreACiudadanos(proy(cerrada), cerrada);
    expect(html).toContain(' checked');
    expect(html).toContain('solo reponen');
  });
});

describe('pausar el consumo', () => {
  const tesorero = plaza({ heroesFundadoresIds: ['heroe-1'], cargos: { tesoreroId: 'heroe-1' }, almacen: { carne: { cantidad: 40, capacidad: 100 }, pan: { cantidad: 0, capacidad: 100, produccion: 2 }, vino: { cantidad: 0, capacidad: 100 }, trigo: { cantidad: 90, capacidad: 100 } } });

  test('el Gobernador y el Tesorero que residen y están dentro', () => {
    expect(pausaConsumo(proy(tesorero), tesorero)).toBe(true);
    const gob = plaza({ heroesFundadoresIds: ['heroe-1'], cargos: { gobernadorId: 'heroe-1' } });
    expect(pausaConsumo(proy(gob), gob)).toBe(true);
    const general = plaza({ heroesFundadoresIds: ['heroe-1'], cargos: { generalId: 'heroe-1' } });
    expect(pausaConsumo(proy(general), general)).toBe(false);
    const deVisita = plaza({ cargos: { tesoreroId: 'heroe-1' } });
    expect(pausaConsumo(proy(deVisita), deVisita)).toBe(false);
  });

  test('un interruptor por bien que la plaza tiene, produce o tiene pausado; nunca el trigo', () => {
    const a = { ...tesorero, consumoPausado: ['aceite'] };
    const html = htmlPausarConsumo(proy(a), a, e);
    expect(html).toContain('data-consumo-pausar="carne"');
    expect(html).toContain('data-consumo-pausar="pan"');
    expect(html).toContain('data-consumo-pausar="aceite" checked');
    expect(html).not.toContain('data-consumo-pausar="vino"');
    expect(html).not.toContain('data-consumo-pausar="trigo"');
  });

  test('a los demás, solo lo pausado y sin interruptores', () => {
    const a = plaza({ consumoPausado: ['carne', 'pan'] });
    const html = htmlPausarConsumo(proy(a), a, e);
    expect(html).not.toContain('data-consumo-pausar');
    expect(html).toContain('Carne');
    expect(htmlPausarConsumo(proy(plaza()), plaza(), e)).toBe('');
  });

  test('la pausa se lee en el letrero de la Nutrición', () => {
    const a = plaza({ consumoPausado: ['carne', 'pan', 'queso'], nutricionPoblacion: 80 });
    expect(textoPausados(a)).toBe('🥩 Carne, 🍞 Pan y 🧀 Queso');
    expect(lineaDeNutricion(a)).toContain('Consumo pausado');
    expect(htmlEstadoPie(a, e)).toContain('Consumo pausado');
    expect(lineaDeNutricion(plaza())).toBeNull();
  });

  test('cada cambio manda pausarConsumo; un rechazo lo devuelve atrás y sale flotando', async () => {
    const aviso = { textContent: '', hidden: true, classList: { toggle: () => undefined } };
    vi.stubGlobal('document', { querySelector: () => aviso });
    const manejadores: (() => Promise<void>)[] = [];
    const c = { dataset: { consumoPausar: 'carne' }, checked: true, disabled: false, addEventListener: (_: string, f: () => Promise<void>) => manejadores.push(f) };
    const raiz = { querySelectorAll: () => [c] } as unknown as ParentNode;
    const enviadas: unknown[] = [];
    cablearPausarConsumo(raiz, plaza(), async (tipo, params) => { enviadas.push([tipo, params]); return 'no'; });
    await manejadores[0]!();
    expect(enviadas).toEqual([['pausarConsumo', { asentamientoId: 'as-1', recurso: 'carne', pausado: true }]]);
    expect(c.checked).toBe(false);
    expect(aviso.textContent).toBe('no');
    vi.unstubAllGlobals();
  });
});

describe('el aviso de solvencia del ascenso', () => {
  test('una línea por recurso que no cubriría el nivel siguiente; sin nada, ni aviso', () => {
    const a = plaza({ insolvenciaAscenso: [{ recurso: 'trigo', llega: 1.2, pide: 3 }, { recurso: 'madera', llega: 12, pide: 40 }] });
    const html = htmlAvisoSolvencia(a, 3, e);
    expect(html).toContain('el nivel 3 no se pagaría solo');
    expect(html).toContain('llega 1,2 y pediría 3,0 por minuto');
    expect(html).toContain('Madera');
    expect(htmlAvisoSolvencia(plaza(), 3, e)).toBe('');
  });
});

describe('el rumor de las vetas de estaño', () => {
  // Un mundo de 40 × 20 en celdas de 10: la región 3 al oeste (x < 20) y la 5 al este; estaño en (5, 5) y (15, 15) al oeste y en (35, 5) al este.
  const mapa = {
    rasters: { region: { columnas: 4, filas: 2, celda: 10, datos: new Uint8Array([3, 3, 5, 5, 3, 3, 5, 5]) } },
    regiones: [{ id: 3, nombre: 'Llanura de Argos' }, { id: 5, nombre: 'Altiplano interior' }],
    nodos: [
      { id: 'n1', tipo: 'estano', rareza: 'rara', posicion: { x: 5, y: 5 }, cantidadInicial: 1 },
      { id: 'n2', tipo: 'estano', rareza: 'rara', posicion: { x: 15, y: 15 }, cantidadInicial: 1 },
      { id: 'n3', tipo: 'estano', rareza: 'rara', posicion: { x: 35, y: 5 }, cantidadInicial: 1 },
      { id: 'n4', tipo: 'cobre', rareza: 'comun', posicion: { x: 12, y: 3 }, cantidadInicial: 1 },
    ],
  } as unknown as MapaGenerado;
  estadoCliente.mapaCache = { id: 'm', mapa };
  /** La máscara de exploración (celdas de 5, 8 × 4) con esas celdas marcadas, en hex como la VISTA. */
  const mascara = (marcadas: [number, number][]): string => {
    const bytes = new Uint8Array(4);
    for (const [c, f] of marcadas) { const i = f * 8 + c; bytes[i >> 3]! |= 1 << (i & 7); }
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const camp = { origen: { tipo: 'campamento' as const, id: 'camp-1' }, etiqueta: 'Taberna del campamento camp-1', posicion: { x: 8, y: 12 }, oro: 100, cupo: 1 };

  test('cuenta las vetas de la región de la taberna que tu Facción no tiene exploradas', () => {
    const p = proy(plaza());
    expect(vetasPorContar(p, { x: 8, y: 12 }, mapa)).toEqual({ region: { id: 3, nombre: 'Llanura de Argos' }, nuevas: 2 });
    p.exploracion.celdas = mascara([[1, 1]]); // la celda de (5, 5)
    expect(vetasPorContar(p, { x: 8, y: 12 }, mapa)?.nuevas).toBe(1);
    p.exploracion.celdas = mascara([[1, 1], [3, 3]]);
    expect(vetasPorContar(p, { x: 8, y: 12 }, mapa)?.nuevas).toBe(0);
  });

  test('en un campamento lo compra cualquiera con Facción, con el precio de INTEL', () => {
    const p = proy(plaza());
    expect(compraRumores(p, camp)).toBe(true);
    const html = htmlServicioRumores(p, camp, e);
    expect(html).toContain('Vetas de estaño de la región');
    expect(html).toContain('data-rumor-comprar="vetas_estano"');
    expect(html).toContain('🪙 80');
    expect(html).toContain('Llanura de Argos');
    expect(htmlServicioRumores(proy(plaza(), { faccionId: null }), camp, e)).toBe('');
  });

  test('sin oro, el botón en rojo y apagado; sin nada nuevo, sin botón', () => {
    const p = proy(plaza());
    expect(htmlServicioRumores(p, { ...camp, oro: 50 }, e)).toMatch(/data-rumor-comprar="vetas_estano" disabled/);
    p.exploracion.celdas = mascara([[1, 1], [3, 3]]);
    const html = htmlServicioRumores(p, camp, e);
    expect(html).not.toContain('data-rumor-comprar');
    expect(html).toContain('Tu Facción ya lo sabe');
  });

  test('en la taberna de una plaza, solo el Rey, el Embajador o el Gobernador', () => {
    const a = plaza({ edificios: [{ id: 'e1', tipo: 'taberna', estado: 'activo', posicion: { x: 0, y: 0 } }] as Asentamiento['edificios'] });
    const t = { origen: { tipo: 'asentamiento' as const, id: 'as-1' }, etiqueta: 'Taberna de Micenas', posicion: a.posicion, oro: 500, cupo: 1 };
    expect(htmlServicioRumores(proy(a), t, e)).toBe('');
    const gob = { ...a, cargos: { gobernadorId: 'heroe-1' } };
    expect(htmlServicioRumores(proy(gob), t, e)).toContain('data-rumor-comprar');
  });
});
