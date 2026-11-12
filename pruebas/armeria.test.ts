// La 0.207.0 (motor 457c278, datos de `pruebas/plaza/datos.json`): la Armería de la plaza. Tu grupo en la plaza, la apertura de la forja y su
// impuesto, lo que vende la tienda y lo que paga, las recetas que la Era y los metales abren con lo que te falta, los materiales a mano, quién abre
// la forja y qué pestañas salen, los avisos, el fondo de la plaza para pagar contratos, las cuatro órdenes y la plaza ajena vista desde dentro
// (su Armería, sus edificios y sus murallas) tal como la proyecta el cliente. Sin DOM.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, ItemInstancia } from '../src/tiposDominio';
import { AmbitoTipo } from '../src/contrato/gen/bronzeage/v1/common_pb';
import { AsentamientoSchema, ClaseCelda, EstadoEdificio } from '../src/contrato/gen/bronzeage/v1/entities_pb';
import { MensajeDeServidorSchema, type MensajeDeServidor } from '../src/contrato/gen/bronzeage/v1/session_pb';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos, catalogoDeTecnologia } = await import('../src/apiCliente');
const arm = await import('../src/ui/armeria');
const { fuentesDeRegion } = await import('../src/ui/tabernaRegion');
const { traducirOrden } = await import('../src/motor/ordenes');
const { plazaDeContrato, proyectar } = await import('../src/motor/proyeccion');
const { Almacen } = await import('../src/contrato/almacen');
const { explicarError } = await import('../src/ui/erroresServidor');

beforeAll(async () => {
  for (const b of ['OBJETOS', 'CLASES_HEROE']) await new Promise<void>((listo) => { if (bloqueDeDatos(b, listo)) listo(); });
  await new Promise<void>((listo) => { if (catalogoDeTecnologia(listo)) listo(); });
});

const pieza = (id: string, casilla: number, cantidad = 1): ItemInstancia => ({ itemDefinitionId: id, casillaInventario: casilla, cantidad }) as ItemInstancia;
const ERAS = ['reinos_palaciales', 'crisis_adaptacion', 'polis_imperios', 'profesionalizacion_imperial', 'hegemonia_macedonica'];

/** Micenas (f-1) o Hattusa (f-2), con la Armería activa, sus metales y su forja (la de serie: abierta a los aliados al 100 %). */
function plaza(x: Partial<Asentamiento> & { ajena?: boolean } = {}): Asentamiento {
  return {
    id: x.ajena ? 'as-9' : 'as-1', nombre: x.ajena ? 'Hattusa' : 'Micenas', faccionId: x.ajena ? 'f-2' : 'f-1', posicion: { x: 0, y: 0 },
    edificios: [{ id: 'e1', tipo: 'armeria', estado: 'activo' }], armeriaActiva: true, metalesArmeria: ['inicio', 'cobre'],
    forja: { aliados: { abierta: true, recargoPct: 100 }, neutrales: { abierta: false, recargoPct: 200 }, enemigos: { abierta: false, recargoPct: 500 }, fondo: 900 },
    cargos: { gobernadorId: 'heroe-9', tesoreroId: 'heroe-8' },
    ...x,
  } as unknown as Asentamiento;
}

/** El héroe (arco y lanza), de f-1, dentro de `dentroDe`, con la Era `era` (1 a 5) y la relación con f-2 que se diga. */
function proy(x: { dentroDe?: string; era?: number; monedas?: number; mochila?: ItemInstancia[]; relacion?: 'alianza' | 'vasallaje' | 'guerra'; sinFaccion?: boolean; columna?: Record<string, number>; carro?: Record<string, number>; personal?: Record<string, number> } = {}): ProyeccionJugador {
  return {
    heroeId: 'heroe-1', faccionId: x.sinFaccion ? null : 'f-1',
    heroe: {
      id: 'heroe-1', classDefinitionId: 'arco_lanza', residenciaId: 'as-1', monedas: x.monedas ?? 1000,
      ubicacion: { tipo: 'asentamiento', asentamientoId: x.dentroDe ?? 'as-1' }, escuadrones: [],
      inventario: x.mochila ?? [pieza('plano_2', 0, 2), pieza('crisol', 1, 5)], almacenObjetos: [],
      equipamiento: { arma: pieza('arco_lanza_cobre', 0), casco: null, torso: null, guantes: null, pantalones: null, botas: null, montura: null },
      almacenPersonal: x.personal ?? {}, carro: x.carro ?? {},
    },
    // Micenas es su residencia (la fundó): ahí no va en ninguna columna (`columnaQuePaga`)
    asentamientos: [{ id: 'as-1', heroesFundadoresIds: ['heroe-1'] }], campamentosMercenarios: [],
    ejercitos: x.columna ? [{ id: 'ej-1', liderId: 'heroe-1', participantes: [{ heroeId: 'heroe-1' }], posicionActual: { x: 0, y: 0 }, suministro: x.columna }] : [],
    relaciones: x.relacion ? [{ tipo: x.relacion, faccionAId: 'f-2', faccionBId: 'f-1', estado: 'activa' }] : [],
    facciones: [{ id: 'f-1', nombre: 'Casa de Micenas', reyId: 'heroe-1' }],
    tecnologia: { era: ERAS[(x.era ?? 3) - 1], propias: { adoptadas: [], aparecidas: [] }, reveladas: [], logros: [], epicasPosibles: [] },
  } as unknown as ProyeccionJugador;
}

describe('tu grupo y la forja', () => {
  test('el grupo es el de la puerta: la misma Facción, aliados (alianza o vasallaje, en cualquier sentido), enemigos (guerra) o neutrales', () => {
    expect(arm.grupoEnPlaza(proy(), plaza())).toBe('misma');
    expect(arm.grupoEnPlaza(proy({ relacion: 'alianza' }), plaza({ ajena: true }))).toBe('aliados');
    expect(arm.grupoEnPlaza(proy({ relacion: 'vasallaje' }), plaza({ ajena: true }))).toBe('aliados');
    expect(arm.grupoEnPlaza(proy({ relacion: 'guerra' }), plaza({ ajena: true }))).toBe('enemigos');
    expect(arm.grupoEnPlaza(proy(), plaza({ ajena: true }))).toBe('neutrales');
    expect(arm.grupoEnPlaza(proy({ sinFaccion: true }), plaza({ ajena: true }))).toBe('neutrales');
  });

  test('la misma Facción forja siempre y sin recargo; los de fuera, lo que puso la plaza; sin forja en la ficha, cerrada al recargo inicial', () => {
    expect(arm.aperturaPara(plaza(), 'misma')).toEqual({ abierta: true, recargoPct: 0 });
    expect(arm.aperturaPara(plaza(), 'aliados')).toEqual({ abierta: true, recargoPct: 100 });
    expect(arm.aperturaPara(plaza(), 'enemigos')).toEqual({ abierta: false, recargoPct: 500 });
    expect(arm.aperturaPara(plaza({ forja: undefined }), 'neutrales')).toEqual({ abierta: false, recargoPct: 100 });
  });

  test('el impuesto es el del tier por (100 + recargo) / 100, hacia abajo, de OBJETOS.forja', () => {
    expect(arm.impuestoDeForja(2, 0)).toBe(100);
    expect(arm.impuestoDeForja(3, 100)).toBe(350);
    expect(arm.impuestoDeForja(5, 500)).toBe(2100);
    expect(arm.impuestoDeForja(9, 0)).toBeNull();
  });

  test('la Era del mundo y la que pide cada tier', () => {
    expect(arm.ordenDeEraDelMundo(proy({ era: 4 }))).toBe(4);
    expect([2, 3, 4, 5].map(arm.eraDelTier)).toEqual([0, 3, 4, 5]);
  });
});

describe('la tienda', () => {
  test('vende armas, armaduras y monturas hasta el tier 2 con los metales de la plaza; `inicio` y las monturas no piden tecnología', () => {
    const piezas = arm.piezasDeTienda(plaza());
    expect(piezas.length).toBeGreaterThan(0);
    expect(piezas.every((f) => ['arma', 'armadura', 'montura'].includes(f.tipo) && f.tier !== null && f.tier <= 2)).toBe(true);
    expect(piezas.every((f) => f.tipo === 'montura' || !f.metal || ['inicio', 'cobre'].includes(f.metal))).toBe(true);
    expect(piezas.some((f) => f.id === 'casco_ligera_cobre')).toBe(true);
    expect(piezas.some((f) => f.id === 'casco_ligera_hierro_temprano')).toBe(false);
    expect(piezas.some((f) => f.tipo === 'montura')).toBe(true);
    expect(arm.piezasDeTienda(plaza({ metalesArmeria: ['inicio', 'cobre', 'hierro_temprano'] })).some((f) => f.id === 'casco_ligera_hierro_temprano')).toBe(true);
  });

  test('paga la mitad de la ficha, hacia abajo', () => {
    expect(arm.precioDeVenta({ precio: 450 })).toBe(225);
    expect(arm.precioDeVenta({ precio: 5 })).toBe(2);
  });
});

describe('la forja', () => {
  const receta = (rs: { f: { id: string } }[], id: string) => rs.find((r) => r.f.id === id) as (typeof rs)[number] & { faltan: string[]; impuesto: number } | undefined;

  test('en la Era III salen los tiers II y III de los metales de la plaza; en la I, solo el II; con la forja cerrada a tu grupo, nada', () => {
    const tiers = (p: ProyeccionJugador, a = plaza()) => new Set(arm.recetasDeForja(p, a, true).map((r) => r.tier));
    expect([...tiers(proy({ era: 1 }))]).toEqual([2]);
    expect(tiers(proy({ era: 3 })).has(4)).toBe(false);
    expect(arm.recetasDeForja(proy(), plaza(), true).every((r) => r.f.metal === 'inicio' || r.f.metal === 'cobre')).toBe(true);
    expect(arm.recetasDeForja(proy(), plaza({ ajena: true }), false)).toEqual([]);
  });

  test('dice lo que falta: los materiales a mano y, en una ajena con recargo, el impuesto subido', () => {
    const enCasa = arm.recetasDeForja(proy({ personal: { lingoteCobre: 1, cuero: 4 } }), plaza(), true);
    const gorro = receta(enCasa, 'casco_ligera_cobre')!;
    expect(gorro.impuesto).toBe(100);
    expect(gorro.faltan).toEqual([]);
    const sinNada = receta(arm.recetasDeForja(proy({ mochila: [] }), plaza(), true), 'casco_ligera_cobre')!;
    expect(sinNada.faltan[0]).toMatch(/^un Plano de tier II$/);
    expect(sinNada.faltan[1]).toBe('2 crisoles');
    expect(sinNada.faltan.some((t) => /Lingote de cobre/.test(t))).toBe(true);
    const aliado = receta(arm.recetasDeForja(proy({ relacion: 'alianza', dentroDe: 'as-9', monedas: 150, columna: { lingoteCobre: 1, cuero: 4 } }), plaza({ ajena: true }), false), 'casco_ligera_cobre')!;
    expect(aliado.impuesto).toBe(200);
    expect(aliado.faltan).toEqual(['50 monedas']);
  });

  test('con la mochila llena, falta una casilla salvo que el plano o los crisoles se gasten enteros', () => {
    const llena = (plano: number, crisoles: number) => [pieza('plano_2', 0, plano), pieza('crisol', 1, crisoles), ...Array.from({ length: 70 }, (_, i) => pieza('crisol', i + 2, 1))];
    const casilla = (p: ProyeccionJugador) => receta(arm.recetasDeForja(p, plaza(), true), 'casco_ligera_cobre')!.faltan.includes('una casilla libre en la mochila');
    expect(casilla(proy({ mochila: llena(2, 1), personal: { lingoteCobre: 1, cuero: 4 } }))).toBe(true);
    expect(casilla(proy({ mochila: llena(1, 1), personal: { lingoteCobre: 1, cuero: 4 } }))).toBe(false);
  });

  test('los materiales: en tu residencia, el almacén personal y el carro; en otra plaza, el carro de la columna con la que entraste', () => {
    expect(arm.materialesAMano(proy({ personal: { cuero: 2 }, carro: { cuero: 3, madera: 1 } }), true).recursos).toEqual({ cuero: 5, madera: 1 });
    expect(arm.materialesAMano(proy({ dentroDe: 'as-9', personal: { cuero: 2 }, carro: { cuero: 3 }, columna: { cuero: 9 } }), false).recursos).toEqual({ cuero: 9 });
    expect(arm.materialesAMano(proy({ dentroDe: 'as-9', personal: { cuero: 2 } }), false)).toEqual({ recursos: {}, donde: 'de ningún sitio: no entraste con tu columna' });
  });
});

describe('quién abre la forja y qué pestañas salen', () => {
  test('el Tesorero o el Gobernador, residente y dentro', () => {
    const conCargo = plaza({ cargos: { gobernadorId: 'heroe-9', tesoreroId: 'heroe-1' } } as Partial<Asentamiento>);
    expect(arm.puedeAbrirLaForja(proy(), conCargo, true)).toBe(true);
    expect(arm.puedeAbrirLaForja(proy(), conCargo, false)).toBe(false);
    expect(arm.puedeAbrirLaForja(proy({ dentroDe: 'as-2' }), conCargo, true)).toBe(false);
    expect(arm.puedeAbrirLaForja(proy(), plaza(), true)).toBe(false);
    expect(arm.pestanasDeArmeria(proy(), conCargo, true).map(([id]) => id)).toEqual(['tienda', 'forja', 'abrir']);
    expect(arm.pestanasDeArmeria(proy(), plaza(), true).map(([id]) => id)).toEqual(['tienda', 'forja']);
    expect(arm.pestanasDeArmeria(proy({ relacion: 'alianza', dentroDe: 'as-9' }), plaza({ ajena: true }), false).map(([id]) => id)).toEqual(['tienda', 'forja']);
    expect(arm.pestanasDeArmeria(proy({ dentroDe: 'as-9' }), plaza({ ajena: true }), false).map(([id]) => id)).toEqual(['tienda']);
  });
});

describe('los avisos, los rechazos y las órdenes', () => {
  const nombre = (id: string) => (id === 'as-9' ? 'Hattusa' : id);
  test('comprar, vender, forjar y abrir o cerrar la forja', () => {
    expect(arm.textoDeHechoArmeria('heroe.objeto_comprado', { objeto: 'casco_ligera_cobre', precio: 200 }, nombre)).toMatch(/^Compras .+ por 200 monedas\. Va a tu mochila\.$/);
    expect(arm.textoDeHechoArmeria('heroe.objeto_vendido', { objeto: 'crisol', cantidad: 3, cobro: 6 }, nombre)).toMatch(/^Vendes 3 × .+ por 6 monedas\.$/);
    expect(arm.textoDeHechoArmeria('heroe.objeto_forjado', { objeto: 'casco_ligera_cobre', calidad: 104, impuesto: 200, pieza: 7 }, nombre)).toMatch(/calidad del 104 %\. Pagas 200 monedas/);
    expect(arm.textoDeHechoArmeria('asentamiento.forja_configurada', { plaza: 'as-9', grupo: 'neutrales', abierta: 1, recargo: 200 }, nombre)).toBe('La forja de Hattusa se abre a los neutrales, +200 % (×3).');
    expect(arm.textoDeHechoArmeria('asentamiento.forja_configurada', { plaza: 'as-9', grupo: 'enemigos', abierta: 0, recargo: 500 }, nombre)).toBe('La forja de Hattusa se cierra a los enemigos.');
    expect(arm.textoDeHechoArmeria('heroe.otra_cosa', {}, nombre)).toBeNull();
  });

  test('los rechazos nuevos, en castellano', () => {
    for (const c of ['armeria.sin_armeria', 'armeria.no_se_vende', 'armeria.sin_tecnologia', 'forja.cerrada', 'forja.era_cerrada', 'forja.sin_plano', 'forja.sin_crisoles', 'forja.sin_materiales', 'forja.recargo_invalido', 'mercenarios.sin_fondo', 'sin_cambios']) {
      expect(explicarError(c)).not.toBe(c);
    }
  });

  test('las cuatro órdenes y el contrato pagado con el fondo se traducen al contrato', () => {
    expect(traducirOrden('comprarObjeto', { objeto: 'casco_ligera_cobre' })).toMatchObject({ case: 'comprarObjeto', value: { objeto: 'casco_ligera_cobre' } });
    expect(traducirOrden('venderObjeto', { casilla: 1, cantidad: 3 })).toMatchObject({ case: 'venderObjeto', value: { casilla: 1, cantidad: 3 } });
    expect(traducirOrden('forjarObjeto', { objeto: 'casco_ligera_cobre' })).toMatchObject({ case: 'forjarObjeto', value: { objeto: 'casco_ligera_cobre' } });
    expect(traducirOrden('configurarForja', { asentamientoId: 'as-1', grupo: 'neutrales', abierta: true, recargoPct: 200 }))
      .toMatchObject({ case: 'configurarForja', value: { asentamientoId: 'as-1', grupo: 'neutrales', abierta: true, recargoPct: 200 } });
    expect(traducirOrden('contratarMercenario', { mercenarioId: 'heroe-7', trabajo: 'defender', plazoDias: 3, pagarCon: 'fondoPlaza' })).toMatchObject({ value: { pagarCon: 'fondoPlaza' } });
  });

  test('el fondo de la plaza paga contratos en la Taberna, a la tarifa en monedas, si tiene algo', () => {
    const a = plaza({ cargos: { gobernadorId: 'heroe-1' }, almacen: { oro: { cantidad: 200 } } } as unknown as Partial<Asentamiento>);
    expect(fuentesDeRegion(proy({ monedas: 50 }), a).map((f) => [f.pagarCon, f.saldo, f.enMonedas])).toEqual([['almacenPlaza', 200, false], ['fondoPlaza', 900, true], ['monedas', 50, true]]);
    expect(fuentesDeRegion(proy({ monedas: 0 }), { ...a, forja: { ...a.forja!, fondo: 0 } }).map((f) => f.pagarCon)).toEqual(['almacenPlaza']);
  });
});

describe('la plaza vista desde dentro', () => {
  const pb = () => create(AsentamientoSchema, {
    id: 'as-9', nombre: 'Hattusa', faccionId: 'f-2', posicion: { x: 50_000n, y: 50_000n }, armeriaActiva: true, metalesArmeria: ['inicio', 'bronce'],
    forja: { aliados: { abierta: true, recargoPct: 200 }, neutrales: { abierta: false, recargoPct: 100 }, enemigos: { abierta: false, recargoPct: 100 }, fondo: 1234n },
    edificios: [
      { id: 'e1', tipo: 'armeria', estado: EstadoEdificio.EDIFICIO_ACTIVO, posicion: { x: 6000n, y: 9000n }, ancho: 6, alto: 4, danado: true, mejora: { nivelObjetivo: 2, completaEnMs: 5000n } },
      { id: 'e2', tipo: 'granero', estado: EstadoEdificio.EDIFICIO_EN_CONSTRUCCION, posicion: { x: 12_000n, y: 9000n }, ancho: 3, alto: 3, completaEnMs: 9000n, buey: true },
    ],
    recintos: [{ id: 'r1', nivel: 1, avance: 2, celdas: [{ col: 0, fila: 0, clase: ClaseCelda.CELDA_MURO }, { col: 1, fila: 0, clase: ClaseCelda.CELDA_PUERTA }, { col: 2, fila: 0, clase: ClaseCelda.CELDA_MURO }] }],
    trazado: { unidadesPorCelda: 3, radioUl: 30, calles: [{ x: 0, y: 0, ancho: 30, alto: 2 }], caminos: [] },
  });

  test('su Armería, su forja con el fondo y sus metales', () => {
    const { asentamiento: a } = plazaDeContrato(pb(), 0);
    expect(a.armeriaActiva).toBe(true);
    expect(a.forja).toEqual({ aliados: { abierta: true, recargoPct: 200 }, neutrales: { abierta: false, recargoPct: 100 }, enemigos: { abierta: false, recargoPct: 100 }, fondo: 1234 });
    expect(a.metalesArmeria).toEqual(['inicio', 'bronce']);
    const sin = plazaDeContrato(create(AsentamientoSchema, { id: 'as-2' }), 0).asentamiento;
    expect([sin.armeriaActiva, sin.forja, sin.metalesArmeria]).toEqual([undefined, undefined, undefined]);
  });

  test('de visita en una ajena (VISTA), la plaza de dentro trae sus edificios, en obra y dañados, con su huella, y sus murallas', () => {
    const almacen = new Almacen();
    const foto = (tipo: AmbitoTipo, id: string, entidades: unknown[]) => almacen.aplicar(create(MensajeDeServidorSchema, { cuerpo: { case: 'foto', value: { ambito: { tipo, id }, version: 1n, entidades } } } as never).cuerpo as MensajeDeServidor['cuerpo']);
    foto(AmbitoTipo.AMBITO_HEROE, 'heroe-1', [{ cuerpo: { case: 'heroe', value: { id: 'heroe-1', displayName: 'Víctor', faccionId: 'f-1', ubicacion: { donde: { case: 'asentamientoId', value: 'as-9' } } } } }]);
    foto(AmbitoTipo.AMBITO_VISTA, 'heroe-1', [{ cuerpo: { case: 'asentamiento', value: pb() } }]);
    const p = proyectar({ almacen, bienvenida: { heroeId: 'heroe-1', faccionId: 'f-1' } as never, ahora: 0, gameId: 'x', mapaId: 'm' }) as ProyeccionJugador;
    const a = p.asentamientos[0]!;
    expect(a.id).toBe('as-9');
    expect(a.armeriaActiva).toBe(true);
    expect(a.edificios.map((x) => [x.tipo, x.estado, x.danado ?? false, x.mejora?.nivelObjetivo ?? null, x.buey ?? false])).toEqual([['armeria', 'activo', true, 2, false], ['granero', 'en_construccion', false, null, true]]);
    expect(a.edificios[1]!.completaEn).toBeDefined();
    expect(a.recintos?.[0]).toMatchObject({ nivel: 1, avance: 2 });
    const t = p.trazadoPorAsentamiento?.['as-9'];
    expect(t?.huellas.e1).toEqual({ x: 3, y: 7, ancho: 6, alto: 4 });
    expect(t?.murallas[0]).toMatchObject({ muro: [{ x: 0, y: 0, ancho: 3, alto: 3 }], puertas: [{ x: 3, y: 0, ancho: 3, alto: 3 }], planificado: [{ x: 6, y: 0, ancho: 3, alto: 3 }] });
  });
});
