// La 0.206.0 (motor 457c278, datos de `pruebas/plaza/datos.json`): el equipo de siete huecos, la mochila y el almacén de objetos, lo que se puede
// hacer con cada pieza según dónde está el héroe (D2 y D22), las cifras de una forjada, los avisos de botín y de objeto usado, los objetos de la
// diaria individual y de una recompensa de misión, y las cinco órdenes. Sin DOM.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Escuadron, HeroeProyectado, ItemInstancia, SlotEquipo } from '../src/tiposDominio';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { fichaDeObjeto } = await import('../src/ui/clasesHeroe');
const o = await import('../src/ui/objetosHeroe');
const { premiosDeDiaria, premiosDeMision } = await import('../src/ui/recompensasMision');
const { traducirOrden } = await import('../src/motor/ordenes');
const { explicarError } = await import('../src/ui/erroresServidor');

beforeAll(async () => {
  for (const b of ['OBJETOS', 'CLASES_HEROE', 'BOTIN_OBJETOS']) {
    await new Promise<void>((listo) => { if (bloqueDeDatos(b, listo)) listo(); });
  }
});

const pieza = (id: string, casilla: number, cantidad = 1, x: Partial<ItemInstancia> = {}): ItemInstancia =>
  ({ itemDefinitionId: id, casillaInventario: casilla, cantidad, ...x }) as ItemInstancia;
const vacio: Record<SlotEquipo, ItemInstancia | null> = { arma: null, casco: null, torso: null, guantes: null, pantalones: null, botas: null, montura: null };
const esc = (id: string, nivel: number, x: Partial<Escuadron> = {}): Escuadron => ({ id, nombre: id, nivel, enBatalla: false, ...x }) as Escuadron;

/** El héroe (arco y lanza: ligera y media) dentro de `donde`, residente en Micenas, con esa mochila, ese almacén y ese equipo. */
function proy(x: { donde?: 'residencia' | 'ajena' | 'campo'; mochila?: ItemInstancia[]; almacen?: ItemInstancia[]; equipo?: Partial<typeof vacio>; escuadrones?: Escuadron[] } = {}): ProyeccionJugador {
  const ubicacion = x.donde === 'campo' ? { tipo: 'mapa' } : { tipo: 'asentamiento', asentamientoId: x.donde === 'ajena' ? 'as-9' : 'as-1' };
  const heroe = {
    id: 'heroe-1', classDefinitionId: 'arco_lanza', residenciaId: 'as-1', ubicacion, escuadrones: x.escuadrones ?? [],
    inventario: x.mochila ?? [], almacenObjetos: x.almacen ?? [], equipamiento: { ...vacio, arma: pieza('arco_lanza_cobre', 0), ...x.equipo },
  } as unknown as HeroeProyectado;
  return { heroeId: 'heroe-1', heroe } as unknown as ProyeccionJugador;
}
/** Una mochila llena de planos sueltos, de la casilla `desde` a la última. */
const llena = (desde: number): ItemInstancia[] => Array.from({ length: 72 - desde }, (_, i) => pieza('plano_2', desde + i));
const acciones = (p: ProyeccionJugador, donde: 'mochila' | 'almacen' | 'equipo', clave: number | SlotEquipo): string[] => o.accionesDe(p, donde, clave).map((a) => a.accion);

describe('lo que sale con cada pieza', () => {
  test('en su residencia: ponerse lo de su clase, guardar, usar; lo que su clase no admite, solo guardarlo', () => {
    const p = proy({ mochila: [pieza('casco_ligera_cobre', 0), pieza('torso_pesada_cobre', 1), pieza('crisol', 2, 3)] });
    expect(acciones(p, 'mochila', 0)).toEqual(['equipar', 'guardar']);
    expect(acciones(p, 'mochila', 1)).toEqual(['guardar']);
    expect(acciones(p, 'mochila', 2)).toEqual(['guardar']);
    expect(o.accionesDe(p, 'mochila', 2)[0]).toMatchObject({ cantidad: 3 });
  });

  test('en una plaza ajena se cambia el equipo, pero el almacén no se abre (D22)', () => {
    const p = proy({ donde: 'ajena', mochila: [pieza('casco_ligera_cobre', 0)], almacen: [pieza('plano_3', 0)] });
    expect(acciones(p, 'mochila', 0)).toEqual(['equipar']);
    expect(acciones(p, 'almacen', 0)).toEqual([]);
    expect(o.dentroDeSuResidencia(p)).toBe(false);
  });

  test('en el mapa o con una escuadra en batalla, nada del equipo (D2), y lo dice', () => {
    const fuera = proy({ donde: 'campo', mochila: [pieza('casco_ligera_cobre', 0)], equipo: { casco: pieza('casco_ligera_cobre', 0) } });
    expect(acciones(fuera, 'mochila', 0)).toEqual([]);
    expect(acciones(fuera, 'equipo', 'casco')).toEqual([]);
    expect(o.motivoDeLugar(fuera)).toContain('dentro de una plaza');
    const batalla = proy({ mochila: [pieza('casco_ligera_cobre', 0)], escuadrones: [esc('esc-1', 3, { enBatalla: true })] });
    expect(acciones(batalla, 'mochila', 0)).toEqual(['guardar']);
    expect(o.motivoDeLugar(batalla)).toContain('en batalla');
  });

  test('el arma no se quita; lo demás, si cabe en la mochila', () => {
    const p = proy({ equipo: { casco: pieza('casco_ligera_cobre', 0) } });
    expect(acciones(p, 'equipo', 'arma')).toEqual([]);
    expect(acciones(p, 'equipo', 'casco')).toEqual(['quitar']);
    expect(acciones(p, 'equipo', 'torso')).toEqual([]);
    expect(acciones(proy({ mochila: llena(0), equipo: { casco: pieza('casco_ligera_cobre', 0) } }), 'equipo', 'casco')).toEqual([]);
  });

  test('con la mochila llena se cambia una pieza por otra (su casilla queda libre), pero no un arma que devuelve dos', () => {
    const torsoMedia = pieza('torso_media_cobre', 0);
    const p = proy({ mochila: [pieza('casco_ligera_cobre', 0), pieza('dagas_cobre', 1), ...llena(2)], equipo: { casco: pieza('casco_ligera_cobre', 0), torso: torsoMedia } });
    expect(o.accionesDe(p, 'mochila', 0)).toContainEqual({ accion: 'equipar', casilla: 0, vuelven: 1 });
    // las dagas (solo ligera) devuelven el arco y la coraza media: dos piezas para una casilla
    expect(o.vuelvenAlEquipar(p.heroe, fichaDeObjeto('dagas_cobre')!)).toBe(2);
    expect(acciones(p, 'mochila', 1)).not.toContain('equipar');
  });

  test('la medalla de tropa, solo con escuadras que la pueden recibir', () => {
    const medalla = [pieza('medalla_tropa_pequena', 0, 2)];
    const p = proy({ mochila: medalla, escuadrones: [esc('esc-1', 10), esc('esc-2', 4, { prestada: { campamentoId: 'c' } } as Partial<Escuadron>), esc('esc-3', 2)] });
    const usar = o.accionesDe(p, 'mochila', 0).find((a) => a.accion === 'usar');
    expect(usar && 'escuadras' in usar ? usar.escuadras?.map((s) => s.id) : null).toEqual(['esc-3']);
    expect(acciones(proy({ mochila: medalla, escuadrones: [esc('esc-1', 10)] }), 'mochila', 0)).toEqual(['guardar']);
    expect(acciones(proy({ mochila: [pieza('cofre_monturas', 0)] }), 'mochila', 0)).toEqual(['usar', 'guardar']);
  });

  test('sacar del almacén con la mochila llena, solo a una pila que ya esté en ella', () => {
    const p = proy({ mochila: [pieza('crisol', 0, 2), ...llena(1)], almacen: [pieza('crisol', 0, 6), pieza('plano_3', 1)] });
    expect(acciones(p, 'almacen', 0)).toEqual(['sacar']);
    expect(acciones(p, 'almacen', 1)).toEqual([]);
  });
});

describe('la ficha de la pieza', () => {
  test('una forjada lleva sus cifras, no las de la ficha', () => {
    const forjada = { itemDefinitionId: 'torso_media_cobre', estadisticas: [
      { nombre: 'fuerza', valor: 3 }, { nombre: 'destreza', valor: 3 }, { nombre: 'armadura', valor: 2 }, { nombre: 'vitalidad', valor: 1 },
      { nombre: 'defensaPerforante', valor: 9 }, { nombre: 'defensaCortante', valor: 10 }, { nombre: 'defensaContundente', valor: 7 }, { nombre: 'salud', valor: 431 },
    ] } as Pick<ItemInstancia, 'itemDefinitionId' | 'estadisticas'>;
    expect(o.cifrasDe(forjada)).toMatchObject({ atributos: { fuerza: 3, destreza: 3, armadura: 2, vitalidad: 1 }, defensa: { perforante: 9, cortante: 10, contundente: 7 }, salud: 431 });
    expect(o.cifrasDe({ itemDefinitionId: 'torso_media_cobre' })).toMatchObject({ salud: 474, defensa: { perforante: 5 } });
  });

  test('qué es, qué hace y su icono', () => {
    expect(o.textoDeTipo(fichaDeObjeto('torso_pesada_cobre')!)).toBe('Armadura pesada · torso');
    expect(o.textoDeEfecto(fichaDeObjeto('medalla_tropa_pequena')!)).toContain('Da 12 de experiencia');
    expect(o.textoDeEfecto(fichaDeObjeto('cofre_monturas')!)).toMatch(/^Una montura: .+ %\)/);
    expect(['crisol', 'plano_2', 'cofre_monturas', 'montura_estepa'].map(o.iconoDeObjeto)).toEqual(['🏺', '📜', '🧰', '🐎']);
  });
});

describe('los avisos', () => {
  test('el botín: a la mochila, al almacén y lo que se pierde', () => {
    expect(o.textoDeBotinDeObjetos({ origen: 'diaria', mochila: [['crisol', 1], ['plano_2', 2]] })).toBe('Botín de la diaria: a la mochila Crisol, 2 × Plano de tier II.');
    expect(o.textoDeBotinDeObjetos({ origen: 'unity', mochila: [['crisol', 1]], almacen: [['plano_2', 1]], perdido: [['crisol', 3]] }))
      .toBe('Botín de la batalla: a la mochila Crisol; al almacén de objetos (la mochila estaba llena) Plano de tier II; y se pierde 3 × Crisol, que no cabía.');
    expect(o.textoDeBotinDeObjetos({ origen: 'bandidos', perdido: [['cofre_monturas', 1]] })).toBe('Botín del campamento de bandidos: se pierde Cofre de monturas, que no cabía.');
  });

  test('el objeto usado: la medalla con su escuadra y el cofre con su montura', () => {
    const escuadras = [esc('esc-2', 3, { nombre: 'Lanceros de mimbre' })];
    expect(o.textoDeObjetoUsado({ objeto: 'medalla_tropa_pequena', escuadra: 2 }, escuadras)).toBe('Usas la Medalla de tropa pequeña con Lanceros de mimbre.');
    expect(o.textoDeObjetoUsado({ objeto: 'cofre_monturas', montura: 'montura_estepa', destino: 'almacen' }, [])).toContain('va a tu almacén de objetos');
  });
});

describe('los premios de objeto', () => {
  test('la diaria individual da además lo de `BOTIN_OBJETOS.misionDiaria`', () => {
    expect(premiosDeDiaria().map((x) => x.nombre)).toEqual(['Crisol', 'Medalla de tropa pequeña', 'Medalla del héroe muy pequeña']);
  });

  test('una recompensa de tipo objeto, con su nombre y a dónde va', () => {
    const [premio] = premiosDeMision({}, [{ tipo: 'objeto', clave: 'medalla_tropa_grande', cantidad: 1 }], 'personal');
    expect(premio).toMatchObject({ tipo: 'objeto', icono: '🎖️', nombre: 'Medalla de tropa grande' });
    expect(premio!.destino).toContain('mochila');
  });
});

describe('las órdenes y sus rechazos', () => {
  test('las cinco órdenes, con los campos del contrato', () => {
    expect(traducirOrden('equiparObjeto', { casilla: 4 })).toMatchObject({ case: 'equiparObjeto', value: { casilla: 4 } });
    expect(traducirOrden('desequiparObjeto', { hueco: 'casco' })).toMatchObject({ case: 'desequiparObjeto', value: { hueco: 'casco' } });
    expect(traducirOrden('guardarObjeto', { casilla: 2, cantidad: 3 })).toMatchObject({ case: 'guardarObjeto', value: { casilla: 2, cantidad: 3 } });
    expect(traducirOrden('sacarObjeto', { casilla: 0, cantidad: 1 })).toMatchObject({ case: 'sacarObjeto', value: { casilla: 0, cantidad: 1 } });
    expect(traducirOrden('usarObjeto', { casilla: 1, escuadronId: 'esc-2' })).toMatchObject({ case: 'usarObjeto', value: { casilla: 1, escuadronId: 'esc-2' } });
  });

  test('en castellano', () => {
    expect(explicarError('equipo.incompatible')).not.toBe('equipo.incompatible');
    expect(explicarError('almacen_objetos.fuera_de_tu_residencia')).toContain('residencia');
    expect(explicarError('mochila.llena')).toContain('mochila');
  });
});
