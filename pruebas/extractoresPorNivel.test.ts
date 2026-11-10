// La Cantera y las minas suben de nivel (motor c1ad93d, contrato 0.22.0; cliente 0.201.0): del 1 al 3 con `mejorarAldea`, la orden de la aldea,
// solo el Gobernador o el Maestro de Obras de la madre y solo con la madre en el nivel operativo que pide el siguiente. Su nivel llega en
// `nivelAldea`, lo que saca va por el `factor` del nivel y la mejora en marcha es una obra `mejoraAldea` con `destinoId` = el pueblo.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, ObraDeMapa, PuebloDeMapa } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { SUBPESTANA_PUEBLOS, htmlCuerpoPueblo, nombreDeObra, nombreDePueblo, siguienteDeExtractor, factorDeExtractor } = await import('../src/ui/pueblos');
const { explicarError } = await import('../src/ui/erroresServidor');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('PUEBLOS_EXTRACTORES', listo)) listo(); });
});

const esc = (s: string): string => s;
const mina = (nivel: number | undefined, o: Partial<PuebloDeMapa> = {}): PuebloDeMapa =>
  ({ id: 'pueblo-4', tipo: 'minaEstano', madreId: 'as-1', propio: true, posicion: { x: 58, y: 50 }, almacen: { estano: 30 }, capacidad: 1000, nivelAldea: nivel, ...o }) as PuebloDeMapa;
const mejora = (destinoId: string): ObraDeMapa =>
  ({ id: 'obra-9', tipo: 'mejoraAldea', madreId: 'as-1', propia: true, posicion: { x: 58, y: 50 }, destinoId, requerido: { madera: 180, piedra: 60 }, entregado: { madera: 20 } }) as unknown as ObraDeMapa;

/** Territorio de una plaza de nivel `nivel` con esos pueblos y obras; `cargo: null`, quien mira no gestiona. */
function contexto(pueblos: PuebloDeMapa[], obras: ObraDeMapa[], o: { cargo?: string | null; nivel?: number } = {}): ContextoPlaza & { enviado: [string, object][] } {
  const nivel = o.nivel ?? 2;
  const a = { id: 'as-1', faccionId: 'f-1', nivel, nivelActual: nivel, posicion: { x: 50, y: 50 }, cargos: o.cargo === null ? {} : { gobernadorId: 'h' }, almacen: { madera: { cantidad: 9000 } }, edificios: [] } as unknown as Asentamiento;
  const proyeccion = { heroeId: 'h', faccionId: 'f-1', facciones: [], asentamientos: [a], asentamientosAvistados: [], asentamientosConocidos: [], pueblos, obrasDeMapa: obras, avanzadas: [], caravanas: [], ejercitos: [] } as unknown as ProyeccionJugador;
  const enviado: [string, object][] = [];
  return { proyeccion, asentamiento: a, cargo: o.cargo === undefined ? 'gobernador' : o.cargo, resideAqui: true, escapar: esc, refrescar: () => {}, ejecutar: async (tipo: string, params: object) => { enviado.push([tipo, params]); return null; }, enviado } as unknown as ContextoPlaza & { enviado: [string, object][] };
}

/** Abre la tarjeta del pueblo `id` (un clic en su botón de la fila, tal como lo cablea Territorio) y devuelve el HTML. */
function abrir(c: ContextoPlaza, id: string): string {
  let clic: (() => void) | undefined;
  const boton = { dataset: { puebloAbrir: id }, getAttribute: () => 'false', addEventListener: (_: string, f: () => void) => { clic = f; } };
  const cuerpo = { querySelectorAll: (sel: string) => (sel === '[data-pueblo-abrir]' ? [boton] : []), querySelector: () => null } as unknown as HTMLElement;
  SUBPESTANA_PUEBLOS.html(c);
  SUBPESTANA_PUEBLOS.cablear!({ ...c, cuerpo } as ContextoPlaza);
  clic!();
  return SUBPESTANA_PUEBLOS.html(c);
}

const botonMejorar = (html: string): string | undefined => html.match(/<button class="anillo-mejorar"[^>]*data-pueblo-accion="mejorar"[^>]*>[^]*?<\/button>/)?.[0];

describe('la Cantera y las minas por nivel: la tarjeta de Territorio', () => {
  test('el Gobernador con la madre en nivel 2 ve «⬆ Nivel 2» con su coste, y el nivel y lo que saca la mina', () => {
    const html = abrir(contexto([mina(1)], []), 'pueblo-4');
    const b = botonMejorar(html);
    expect(b).toBeDefined();
    expect(b).toContain('data-pueblo="pueblo-4"');
    expect(b).toContain('⬆ Nivel 2');
    expect(b).toContain('180');
    expect(b).toContain('saca el doble que en el nivel 1');
    expect(html).toContain('Mina de nivel 1');
    expect(html).toContain('×1');
    expect(html).toContain('pueblo-icono-nivel">1<');
    expect(html).toContain('<strong>Mina de estaño</strong>');
  });

  test('«⬆ Nivel 2» manda `mejorarAldea` con el pueblo', async () => {
    const c = contexto([mina(1)], []);
    abrir(c, 'pueblo-4');
    let clic: (() => void) | undefined;
    const boton = { dataset: { puebloAccion: 'mejorar', pueblo: 'pueblo-4' }, disabled: false, addEventListener: (_: string, f: () => void) => { clic = f; } };
    const cuerpo = { querySelectorAll: (sel: string) => (sel === '[data-pueblo-accion]' ? [boton] : []), querySelector: () => null } as unknown as HTMLElement;
    SUBPESTANA_PUEBLOS.cablear!({ ...c, cuerpo } as ContextoPlaza);
    clic!();
    await Promise.resolve();
    expect(c.enviado).toEqual([['mejorarAldea', { heroeId: 'h', puebloId: 'pueblo-4' }]]);
  });

  test('con la madre por debajo del nivel que pide el siguiente, no hay botón', () => {
    expect(botonMejorar(abrir(contexto([mina(1)], [], { nivel: 1 }), 'pueblo-4'))).toBeUndefined();
    expect(botonMejorar(abrir(contexto([mina(2)], [], { nivel: 2 }), 'pueblo-4'))).toBeUndefined();
    expect(botonMejorar(abrir(contexto([mina(2)], [], { nivel: 3 }), 'pueblo-4'))).toContain('⬆ Nivel 3');
  });

  test('sin cargo de obras, en el nivel máximo o con la mejora en marcha, tampoco', () => {
    expect(botonMejorar(abrir(contexto([mina(1)], [], { cargo: null }), 'pueblo-4'))).toBeUndefined();
    const maxima = abrir(contexto([mina(3)], [], { nivel: 5 }), 'pueblo-4');
    expect(botonMejorar(maxima)).toBeUndefined();
    expect(maxima).toContain('×3');
    const enObra = abrir(contexto([mina(1)], [mejora('pueblo-4')]), 'pueblo-4');
    expect(botonMejorar(enObra)).toBeUndefined();
    expect(enObra).toContain('🔨 Subiendo a 2');
  });

  test('la obra de la mejora se llama por lo que sube, y no ocupa cupo', () => {
    const c = contexto([mina(1), mina(2, { id: 'pueblo-5', tipo: 'cantera', almacen: { piedra: 10 } })], [mejora('pueblo-4'), { ...mejora('pueblo-5'), id: 'obra-10' }]);
    const html = SUBPESTANA_PUEBLOS.html(c);
    expect(html).toContain('Mejora de la mina a nivel 2 · faltan materiales');
    expect(html).toContain('Mejora de la cantera a nivel 3 · faltan materiales');
    expect(html).toContain('🏘 2 /');
    const aldea = { ...mina(1), id: 'pueblo-6', tipo: 'aldeaAgricola', cultivo: 'trigo' } as PuebloDeMapa;
    expect(nombreDeObra(mejora('pueblo-6'), { ...c.proyeccion, pueblos: [aldea] } as ProyeccionJugador)).toBe('Mejora de aldea');
  });
});

describe('la Cantera y las minas por nivel: nombre, datos y dentro', () => {
  test('el nombre lleva el nivel si llega (un extractor de antes, sin él, no)', () => {
    expect(nombreDePueblo(mina(2))).toBe('Mina de estaño (nivel 2)');
    expect(nombreDePueblo(mina(undefined))).toBe('Mina de estaño');
  });

  test('el factor y el siguiente nivel salen de PUEBLOS_EXTRACTORES.extractor', () => {
    expect([1, 2, 3].map((n) => factorDeExtractor(mina(n)))).toEqual([1, 2, 3]);
    expect(siguienteDeExtractor(mina(1), { nivel: 2, nivelActual: 2 })).toMatchObject({ nivel: 2, factor: 2, nivelMadre: 2, coste: { madera: 180, piedra: 60 } });
    // el nivel operativo es el que cuenta: una plaza de nivel 2 subiendo al 3 aún no deja el 3
    expect(siguienteDeExtractor(mina(2), { nivel: 3, nivelActual: 2 })).toBeUndefined();
    expect(siguienteDeExtractor(mina(3), { nivel: 5 })).toBeUndefined();
    expect(siguienteDeExtractor({ ...mina(1), tipo: 'aldeaAgricola' } as PuebloDeMapa, { nivel: 5 })).toBeUndefined();
  });

  test('dentro del pueblo: su nivel y lo que saca; «Mejorar» solo para quien tiene cargo de obras en la madre', () => {
    const c = contexto([mina(1)], []);
    const gobernador = htmlCuerpoPueblo(c.proyeccion, mina(1), 'resumen', esc);
    expect(gobernador).toContain('Nivel 1: saca lo de serie.');
    expect(gobernador).toContain('data-pueblo-dentro="mejorar"');
    expect(gobernador).toContain('Mejorar a nivel 2');
    const otro = contexto([mina(2)], [], { cargo: null, nivel: 3 });
    const sinCargo = htmlCuerpoPueblo(otro.proyeccion, mina(2), 'resumen', esc);
    expect(sinCargo).toContain('Nivel 2: saca el doble que en el nivel 1.');
    expect(sinCargo).not.toContain('data-pueblo-dentro="mejorar"');
    // el Maestro de Obras de la madre, desde su ficha de miembro de la Facción
    const maestro = { ...otro.proyeccion, facciones: [{ id: 'f-1', miembros: [{ heroeId: 'h', cargos: ['maestroObras@as-1'] }] }] } as unknown as ProyeccionJugador;
    expect(htmlCuerpoPueblo(maestro, mina(2), 'resumen', esc)).toContain('Mejorar a nivel 3');
    const conObra = { ...c.proyeccion, obrasDeMapa: [mejora('pueblo-4')] } as ProyeccionJugador;
    const enMarcha = htmlCuerpoPueblo(conObra, mina(1), 'resumen', esc);
    expect(enMarcha).toContain('Tiene una mejora en marcha');
    expect(enMarcha).not.toContain('data-pueblo-dentro="mejorar"');
  });

  test('los rechazos nuevos hablan del pueblo, no de la aldea', () => {
    expect(explicarError('pueblo.nivel_insuficiente')).toContain('no sube por encima del nivel de su plaza');
    expect(explicarError('pueblo.mejora_en_curso')).toBe('Ese pueblo ya se está mejorando.');
    expect(explicarError('pueblo.nivel_maximo')).toBe('Ese pueblo ya está en su nivel máximo.');
    expect(explicarError('pueblo.no_esta_activo')).toBe('El pueblo aún no está terminado.');
  });
});
