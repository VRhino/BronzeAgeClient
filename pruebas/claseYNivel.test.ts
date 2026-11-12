// La 0.204.0 (motor c82d6ed y ebfc4354, datos de `pruebas/plaza/datos.json` desde 457c278): la clase obligatoria al crear el héroe con su equipo
// inicial, el nivel del héroe con su curva y su aviso, el aceite de sésamo y el nivel 5 de la plaza, la escolta del carro de acarreo sin Mercado
// y la receta que pide edificio.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, Edificio } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { clasesDeHeroe, catalogoDeObjetos, equipoInicial, htmlSelectorDeClase, nombreDeClase, textoDeArmaduras } = await import('../src/ui/clasesHeroe');
const { experienciaParaSubir, progresoDeNivel, textoDeNivelSubido } = await import('../src/ui/progresionHeroe');
const { htmlAscensoPlaza } = await import('../src/ui/panelCentro');
const { htmlRecetas } = await import('../src/ui/vistaCiudad');
const { puntosDeEscolta, puntosDeEscoltaDelCarro } = await import('../src/ui/panelMercado');
const { procesar, historialDeAvisos } = await import('../src/ui/avisos');
const { bienesDeConsumo } = await import('../src/ui/consumoPausado');

beforeAll(async () => {
  for (const b of ['EDIFICIO_CATALOGO', 'CLASES_HEROE', 'OBJETOS', 'PROGRESION_HEROE', 'NIVEL_ASENTAMIENTO', 'ASCENSO_ASENTAMIENTO']) {
    await new Promise<void>((listo) => { if (bloqueDeDatos(b, listo)) listo(); });
  }
});

const esc = (s: string): string => s;
const sinEtiquetas = (h: string): string => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const edificio = (id: string, tipo: string, nivelInterno = 1): Edificio => ({ id, tipo, estado: 'activo', nivelInterno, posicion: { x: 0, y: 0 } }) as unknown as Edificio;

describe('la clase al crear el héroe', () => {
  test('cinco clases, y cada una nace con su arma de tier I, la armadura de su peso sin casco y el caballo de tiro', () => {
    const clases = clasesDeHeroe()!;
    expect(clases.map((c) => c.id)).toEqual(['lanza_escudo_redondo', 'espada_escudo_mediano', 'arco_lanza', 'hacha_dos_manos', 'dagas']);
    const objetos = catalogoDeObjetos()!.objetos;
    const espada = clases.find((c) => c.id === 'espada_escudo_mediano')!;
    // lo mismo que `Equipo::inicial` del motor (crates/objetos/src/equipo.rs)
    expect(equipoInicial(espada, objetos).map((o) => o.id)).toEqual(['espada_escudo_mediano_inicio', 'torso_media_inicio', 'guantes_media_inicio', 'pantalones_media_inicio', 'botas_media_inicio', 'montura_tiro']);
    expect(equipoInicial(clases.find((c) => c.id === 'dagas')!, objetos)[1]!.id).toBe('torso_ligera_inicio');
    expect(textoDeArmaduras(espada)).toBe('media y pesada');
  });

  test('sin elegir no hay ficha; elegida, su armadura, sus atributos y con qué nace', () => {
    const clases = clasesDeHeroe()!;
    const objetos = catalogoDeObjetos()!.objetos;
    const sin = htmlSelectorDeClase(clases, objetos, null, esc);
    expect([...sin.matchAll(/data-clase="(\w+)"/g)]).toHaveLength(5);
    expect(sin).not.toContain('Nace con');
    const con = sinEtiquetas(htmlSelectorDeClase(clases, objetos, 'arco_lanza', esc));
    expect(con).toContain('Armadura ligera y media; empieza con la ligera.');
    expect(con).toContain('Nace con Arco compuesto y lanza de pacotilla, Torso de inicio (ligera)');
    expect(con).toContain('Caballo de tiro');
    expect(htmlSelectorDeClase(clases, objetos, 'arco_lanza', esc)).toContain('class="clase-boton elegida" data-clase="arco_lanza"');
  });

  test('el nombre de la clase por su id; un id que ya no está, legible', () => {
    expect(nombreDeClase('dagas')).toBe('Dagas');
    expect(nombreDeClase('hacha_dos_manos')).toBe('Hacha a dos manos');
    expect(nombreDeClase('Spear')).toBe('Spear');
  });
});

describe('el nivel del héroe', () => {
  test('la curva: 100 del 1 al 2, 660 para pasar al 30 y 680 desde el 30', () => {
    expect([1, 2, 7, 29, 30, 31, 45].map((n) => experienciaParaSubir(n))).toEqual([100, 120, 220, 660, 680, 680, 680]);
  });

  test('la barra: lo que lleva sale de lo que le falta', () => {
    expect(progresoDeNivel({ nivel: 7, experienciaHaciaSiguienteNivel: 60 })).toEqual({ lleva: 160, pide: 220, pct: 73 });
    expect(progresoDeNivel({ nivel: 1, experienciaHaciaSiguienteNivel: 100 })).toEqual({ lleva: 0, pide: 100, pct: 0 });
  });

  test('el aviso de subir: hasta el 30 trae Liderazgo y un punto; después, solo el nivel', () => {
    expect(textoDeNivelSubido(5)).toContain('un punto de atributo');
    expect(textoDeNivelSubido(31)).toBe('Tu héroe sube al nivel 31.');
    procesar({ version: 7, codigo: 'heroe.nivel_subio', payload: { heroe: 0, nivel: 4 } } as never, 'h', 'historico');
    expect(historialDeAvisos()[0]!.texto).toContain('nivel 4');
  });
});

describe('el aceite de sésamo y el nivel 5', () => {
  test('el aceite de sésamo se come y se pausa como los demás bienes', () => {
    expect(bienesDeConsumo()).toContain('aceiteSesamo');
  });

  test('una plaza de nivel 4 ofrece subir al 5, con los dos aceites en el coste', () => {
    const p = { heroeId: 'h', faccionId: 'f-1', pueblos: [], asentamientos: [], facciones: [] } as unknown as ProyeccionJugador;
    const a = { id: 'as-1', nivel: 4, nivelActual: 4, faccionId: 'f-1', cargos: { gobernadorId: 'h' }, almacen: {}, edificios: [], poblacion: { pesants: 100, artesanos: 10, nobleza: 1 } } as unknown as Asentamiento;
    const html = htmlAscensoPlaza(p, a, true, esc, undefined, true);
    expect(sinEtiquetas(html)).toContain('nivel 5');
    expect(html).toContain('Aceite de sésamo');
    expect(html).toContain('Aceite de oliva');
  });
});

describe('lo pequeño', () => {
  test('el carro de acarreo de una madre sin Mercado admite 100 de escolta', () => {
    const sinMercado = { id: 'as-1', edificios: [] } as unknown as Asentamiento;
    expect(puntosDeEscolta(sinMercado)).toBeUndefined();
    expect(puntosDeEscoltaDelCarro(sinMercado)).toBe(100);
    expect(puntosDeEscoltaDelCarro({ id: 'as-1', edificios: [edificio('m', 'mercado', 2)] } as unknown as Asentamiento)).toBe(200);
  });

  test('en Talleres, el Arma de Hierro de Calidad dice que le falta la Fundición de nivel 3', () => {
    const contexto = (edificios: Edificio[]): ContextoPlaza => ({
      proyeccion: { heroeId: 'h', facciones: [] }, asentamiento: { id: 'as-1', nivel: 5, edificios } as unknown as Asentamiento, cargo: null, escapar: esc, refrescar: () => {},
    }) as unknown as ContextoPlaza;
    const sin = htmlRecetas(contexto([edificio('a', 'armeria', 3)]));
    expect(sin).toContain('🔒 Fundición de nivel 3');
    expect(sin).toContain('le falta una Fundición de nivel 3 en la plaza');
    expect(htmlRecetas(contexto([edificio('a', 'armeria', 3), edificio('f', 'fundicion', 2)]))).toContain('🔒 Fundición de nivel 3');
    expect(htmlRecetas(contexto([edificio('a', 'armeria', 3), edificio('f', 'fundicion', 3)]))).not.toContain('Fundición de nivel 3');
  });
});
