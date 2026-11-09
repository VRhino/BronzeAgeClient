// Cebada, sésamo y una receta por bodega y prensa (motor b55e90f) en el cliente, con los datos de juego de verdad (`pruebas/plaza/datos.json`,
// sacado de Docs/Mechanics del motor): los tres recursos nuevos, el desbloqueo de cultivos por Facción, la capa de fertilidad de cada cultivo, la
// receta de la bodega y la prensa con su selector y el tope de tres por plaza.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, Edificio, PuebloDeMapa } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';
import type { MapaGenerado } from '../src/terreno';
import { ArtefactoDeMundoSchema, EncodingRaster } from '../src/contrato/gen/bronzeage/v1/world_pb';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { htmlConstruir, elegirGrupoDe } = await import('../src/ui/panelObras');
const { estadoCliente } = await import('../src/ui/estadoCliente');
const { explicarError } = await import('../src/ui/erroresServidor');
const { RECURSO_NOMBRE, RECURSO_ICONO, RECURSO_COLOR, RECURSOS_POR_INDICE } = await import('../src/paletas');
const { htmlRecetaUnica, htmlRecetas, htmlTooltipEdificio } = await import('../src/ui/vistaCiudad');
const { TEXTO_DE_RECETA, recetasElegibles, recetasDistintas } = await import('../src/ui/recetasUnicas');
const { produce, nivelAlcanzadoEnLaFaccion, SUBPESTANA_PUEBLOS } = await import('../src/ui/pueblos');
const { sitiosDeAldea, fertilidadEn } = await import('../src/mundo/fertilidad');
const { mapaDesdeArtefacto } = await import('../src/mundo/artefacto');
const { htmlCapas } = await import('../src/ui/capasMapa');
const { cultivoDeLaCapa, fijarCultivoDeLaCapa } = await import('../src/mundo/capasDelMapa');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('EDIFICIO_CATALOGO', listo)) listo(); });
});

const esc = (s: string): string => s;
type Estado = Edificio['estado'];
const edificio = (id: string, tipo: string, extra: Partial<Edificio> = {}): Edificio => ({ id, tipo, estado: 'activo' as Estado, nivelInterno: 1, posicion: { x: 0, y: 0 }, ...extra }) as Edificio;
const plaza = (nivel: number, edificios: Edificio[] = [], nivelActual = nivel): Asentamiento =>
  ({ id: 'as-1', faccionId: 'f-1', nivel, nivelActual, posicion: { x: 50, y: 50 }, cargos: { gobernadorId: 'h' }, almacen: { madera: { cantidad: 9000 }, piedra: { cantidad: 9000 } }, edificios }) as unknown as Asentamiento;

describe('los tres recursos nuevos', () => {
  test('tienen nombre, icono y color, y su índice en los hechos es el del motor', () => {
    for (const r of ['cebada', 'cerveza', 'sesamo']) {
      expect(RECURSO_NOMBRE[r]).toBeTruthy();
      expect(RECURSO_ICONO[r]).toBeTruthy();
      expect(RECURSO_COLOR[r]).toBeTruthy();
    }
    expect(RECURSO_NOMBRE.sesamo).toBe('Sésamo');
    expect(RECURSOS_POR_INDICE).toHaveLength(41);
    expect(RECURSOS_POR_INDICE.slice(38)).toEqual(['cebada', 'cerveza', 'sesamo']);
    expect([RECURSOS_POR_INDICE[34], RECURSOS_POR_INDICE[35]]).toEqual(['uva', 'aceituna']);
  });

  test('los iconos de los cultivos y sus productos no se repiten con los de otros recursos', () => {
    const iconos = Object.values(RECURSO_ICONO);
    for (const r of ['cebada', 'cerveza', 'sesamo']) expect(iconos.filter((i) => i === RECURSO_ICONO[r])).toHaveLength(1);
  });
});

describe('las aldeas de cebada y de sésamo, desbloqueadas por la Facción', () => {
  const aldea = (cultivo: string): PuebloDeMapa => ({ id: 'pueblo-1', tipo: 'aldeaAgricola', madreId: 'as-1', propio: true, posicion: { x: 0, y: 0 }, almacen: {}, capacidad: 1000, cultivo }) as PuebloDeMapa;
  /** Los cultivos que se ofrecen al marcar una aldea desde una madre de nivel 1, con otras plazas de esos niveles (alcanzado, operativo y Facción). */
  const cultivos = (otras: { nivel: number; nivelActual?: number; faccionId?: string }[]): string[] => {
    const a = plaza(1);
    const avistadas = otras.map((o, i) => ({ id: `as-${i + 2}`, faccionId: o.faccionId ?? 'f-1', nivel: o.nivel, posicion: { x: 300, y: 300 }, zona: [] }));
    const proyeccion = { heroeId: 'h', faccionId: 'f-1', facciones: [], asentamientos: [a], asentamientosAvistados: avistadas, pueblos: [], obrasDeMapa: [], avanzadas: [], caravanas: [] } as unknown as ProyeccionJugador;
    const c = { proyeccion, asentamiento: a, cargo: 'gobernador', resideAqui: true, escapar: esc, refrescar: () => {} } as unknown as ContextoPlaza;
    return [...SUBPESTANA_PUEBLOS.html(c).matchAll(/name="pueblo-cultivo" value="(\w+)"/g)].map((m) => m[1]!);
  };

  test('dan su cultivo, sin rebaño', () => {
    expect(produce(aldea('cebada'))).toEqual(['cebada']);
    expect(produce(aldea('sesamo'))).toEqual(['sesamo']);
  });

  test('una madre de nivel 1 ofrece la vid y la cebada si otra plaza de la Facción llegó al 3, y el olivo y el sésamo si llegó al 4', () => {
    expect(cultivos([])).toEqual([]);
    expect(cultivos([{ nivel: 2 }])).toEqual([]);
    expect(cultivos([{ nivel: 3 }])).toEqual(['trigo', 'vid', 'cebada']);
    expect(cultivos([{ nivel: 2 }, { nivel: 4 }])).toEqual(['trigo', 'vid', 'oliva', 'cebada', 'sesamo']);
  });

  test('cuenta el nivel alcanzado, no el operativo, y solo las plazas de la Facción', () => {
    expect(cultivos([{ nivel: 4, nivelActual: 2 }])).toEqual(['trigo', 'vid', 'oliva', 'cebada', 'sesamo']);
    expect(cultivos([{ nivel: 5, faccionId: 'f-9' }])).toEqual([]);
    const a = plaza(3, [], 1);
    expect(nivelAlcanzadoEnLaFaccion({ asentamientos: [a], asentamientosAvistados: [] } as unknown as ProyeccionJugador, a)).toBe(3);
  });

  test('el rechazo dice que lo que falta es una plaza de la Facción con el nivel', () => {
    expect(explicarError('pueblo.cultivo_bloqueado')).toContain('Ninguna plaza de tu Facción');
  });
});

describe('la tierra de la cebada y del sésamo', () => {
  // 10×10 celdas de 1 u, todo tierra firme: la cebada en la mitad de la izquierda y el sésamo en la de abajo.
  const capa = (valor: (c: number, f: number) => number) => ({ columnas: 10, filas: 10, celda: 1, datos: Uint8Array.from({ length: 100 }, (_, i) => valor(i % 10, Math.floor(i / 10))) });
  const mapa = { rasters: { terreno: capa(() => 3), fertilidad: capa(() => 0), fertilidadCebada: capa((c) => (c < 5 ? 200 : 0)), fertilidadSesamo: capa((_, f) => (f >= 5 ? 150 : 0)) } } as unknown as MapaGenerado;
  const zona = { centro: { x: 5, y: 5 }, radio: 4 };

  test('cada una mira su capa', () => {
    const cebada = sitiosDeAldea(mapa, zona, [], 0.3, 1, 'cebada')!;
    expect(cebada.validos.length).toBeGreaterThan(0);
    expect(cebada.validos.every((q) => q.x < 5)).toBe(true);
    const sesamo = sitiosDeAldea(mapa, zona, [], 0.3, 1, 'sesamo')!;
    expect(sesamo.validos.every((q) => q.y >= 5)).toBe(true);
    expect(fertilidadEn(mapa, { x: 2.5, y: 2.5 }, 'cebada')).toBeCloseTo(200 / 255);
    expect(fertilidadEn(mapa, { x: 2.5, y: 2.5 }, 'sesamo')).toBe(0);
  });

  test('el artefacto del mundo trae sus dos capas (23 y 24)', () => {
    const raster = (v: number) => ({ columnas: 2, filas: 2, tamanoCelda: 1000, encoding: EncodingRaster.ENCODING_U8, datos: Uint8Array.from([v, v, v, v]) });
    const m = mapaDesdeArtefacto(create(ArtefactoDeMundoSchema, { fertilidadCebada: raster(7), fertilidadSesamo: raster(9) }));
    expect(m.rasters?.fertilidadCebada?.datos[0]).toBe(7);
    expect(m.rasters?.fertilidadSesamo?.datos[3]).toBe(9);
  });
});

describe('la capa de fertilidad, por cultivo', () => {
  test('la leyenda deja elegir los cinco cultivos, y se recuerda el elegido', () => {
    const html = htmlCapas('mapa', 0.3);
    expect([...html.matchAll(/data-capa-cultivo/g)]).toHaveLength(5);
    expect(html).toContain('value="trigo" data-capa-cultivo checked');
    fijarCultivoDeLaCapa('sesamo');
    expect(cultivoDeLaCapa()).toBe('sesamo');
    expect(htmlCapas('mundo', 0.3)).toContain('value="sesamo" data-capa-cultivo checked');
    fijarCultivoDeLaCapa('trigo');
  });

  test('con un solo cultivo en el mundo no hay nada que elegir', () => {
    expect(htmlCapas('mapa', 0.3, ['trigo'])).not.toContain('data-capa-cultivo');
  });
});

describe('la receta de la bodega y la prensa', () => {
  const bodega = (id: string, extra: Partial<Edificio> = {}) => edificio(id, 'bodega', extra);
  const prensa = (id: string, extra: Partial<Edificio> = {}) => edificio(id, 'prensa', extra);

  test('la bodega trabaja una bebida en los niveles 3 y 4 y dos en el 5; la prensa, siempre una fuente', () => {
    expect([3, 4, 5].map((n) => recetasDistintas('bodega', n))).toEqual([1, 1, 2]);
    expect([4, 5].map((n) => recetasDistintas('prensa', n))).toEqual([1, 1]);
  });

  test('sin elegir, la bodega hace vino y la prensa aceite de aceituna; con cargo y sola en la plaza, se puede cambiar', () => {
    const b = bodega('ed-1');
    const html = htmlRecetaUnica(plaza(3, [b]), b, 'gobernador', esc);
    expect(html).toContain('Vino, con 2');
    expect(html).toContain('data-ficha-receta="cebada"');
    expect(html).toContain('Hacer cerveza');
    const p = prensa('ed-2', { receta: 'sesamo' });
    const deSesamo = htmlRecetaUnica(plaza(4, [p]), p, 'maestroObras', esc);
    expect(deSesamo).toContain('Aceite de sésamo');
    expect(deSesamo).toContain('data-ficha-receta="aceituna"');
  });

  test('sin cargo se ve la receta, pero no el selector', () => {
    const b = bodega('ed-1', { receta: 'cebada' });
    const html = htmlRecetaUnica(plaza(3, [b]), b, null, esc);
    expect(html).toContain('Cerveza');
    expect(html).not.toContain('data-ficha-receta');
  });

  test('con dos bodegas en el nivel 3 o 4 no se ofrece cambiar ninguna, y se dice por qué; en el 5, sí', () => {
    const [b1, b2] = [bodega('ed-1'), bodega('ed-2')];
    for (const nivel of [3, 4]) {
      const html = htmlRecetaUnica(plaza(nivel, [b1, b2]), b1, 'gobernador', esc);
      expect(html).not.toContain('data-ficha-receta');
      expect(html).toContain('solo cambia de receta si es la única');
    }
    expect(recetasElegibles(plaza(5, [b1, b2]), b1)).toEqual(['cebada']);
  });

  test('las prensas sacan todas el aceite de la misma fuente, también en el nivel 5', () => {
    const [p1, p2] = [prensa('ed-1'), prensa('ed-2')];
    expect(recetasElegibles(plaza(5, [p1, p2]), p1)).toEqual([]);
    expect(recetasElegibles(plaza(5, [p1]), p1)).toEqual(['sesamo']);
  });

  test('las obras en marcha cuentan para el tope de recetas distintas', () => {
    const [b1, b2] = [bodega('ed-1'), bodega('ed-2', { estado: 'en_construccion' })];
    expect(recetasElegibles(plaza(4, [b1, b2]), b1)).toEqual([]);
  });

  test('una receta parada lo dice, y deja volver a la que trabaja la plaza', () => {
    const [b1, b2] = [bodega('ed-1', { receta: 'uva' }), bodega('ed-2', { receta: 'cebada', recetaParada: true })];
    const a = plaza(5, [b1, b2], 4);
    const html = htmlRecetaUnica(a, b2, 'gobernador', esc);
    expect(html).toContain('Parada');
    expect(html).toContain('data-ficha-receta="uva"');
    expect(htmlTooltipEdificio({ produccionDeAsentamiento: [] } as unknown as ProyeccionJugador, b2, esc)).toContain('receta parada');
  });

  test('otro edificio no tiene bloque de receta', () => {
    const m = edificio('ed-1', 'molino');
    expect(htmlRecetaUnica(plaza(3, [m]), m, 'gobernador', esc)).toBe('');
  });

  test('en «Talleres» cuenta solo la receta activa de cada bodega, y nada la parada', () => {
    const filas = (a: Asentamiento): string[] => {
      const c = { proyeccion: { heroeId: 'h', facciones: [] }, asentamiento: a, cargo: null, escapar: esc, refrescar: () => {} } as unknown as ContextoPlaza;
      return [...htmlRecetas(c).matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]!);
    };
    expect(filas(plaza(5, [bodega('ed-1')]))).toEqual(['Vino']);
    expect(filas(plaza(5, [bodega('ed-1'), bodega('ed-2', { receta: 'cebada' })]))).toEqual(['Cerveza', 'Vino']);
    expect(filas(plaza(5, [bodega('ed-1'), bodega('ed-2', { receta: 'cebada', recetaParada: true })], 4))).toEqual(['Vino']);
    expect(filas(plaza(4, [prensa('ed-1', { receta: 'sesamo' })]))).toEqual(['Aceite']);
    expect(htmlRecetas({ proyeccion: { heroeId: 'h', facciones: [] }, asentamiento: plaza(4, [prensa('ed-1', { receta: 'sesamo' })]), cargo: null, escapar: esc, refrescar: () => {} } as unknown as ContextoPlaza)).toContain('Sésamo');
  });

  test('el aviso del hecho dice qué hace ahora, por el índice del insumo', () => {
    expect(TEXTO_DE_RECETA[RECURSOS_POR_INDICE[38]!]).toContain('cerveza');
    expect(TEXTO_DE_RECETA[RECURSOS_POR_INDICE[40]!]).toContain('sésamo');
  });
});

describe('tres bodegas y tres prensas por plaza', () => {
  const ofrece = (a: Asentamiento, tipo: string): boolean => {
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [{ id: 'f-1', nombre: 'Uno', nivel: 1, prestigio: 0, capitalId: 'as-1' }], tecnologiasAdoptadas: [] } as unknown as ProyeccionJugador;
    elegirGrupoDe(tipo);
    return htmlConstruir(a, 'gobernador', esc).includes(`data-construir="${tipo}"`);
  };

  test('con dos se ofrece la tercera; con tres, de cualquier estado, no se ofrece la cuarta', () => {
    for (const tipo of ['bodega', 'prensa']) {
      expect(ofrece(plaza(5, [edificio('ed-1', tipo), edificio('ed-2', tipo)]), tipo)).toBe(true);
      expect(ofrece(plaza(5, [edificio('ed-1', tipo), edificio('ed-2', tipo, { estado: 'en_construccion' }), edificio('ed-3', tipo, { estado: 'en_cola' })]), tipo)).toBe(false);
    }
  });

  test('los rechazos nuevos tienen su texto', () => {
    for (const codigo of ['obra.tope_por_plaza', 'receta.no_se_elige', 'receta.desconocida', 'receta.tope_por_plaza', 'edificio.desconocido']) {
      expect(explicarError(codigo)).not.toBe(codigo);
    }
  });
});
