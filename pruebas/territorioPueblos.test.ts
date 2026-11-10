// Territorio con los pueblos en botones (0.197.0, Víctor 2026-11-10): un botón con el icono por pueblo u obra, que abre su detalle (uno a la
// vez, y otro clic lo cierra), y «Marcar» tras un «+» al principio, abierto de serie si la plaza no tiene ningún pueblo ni obra.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, ObraDeMapa, PuebloDeMapa } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { SUBPESTANA_PUEBLOS } = await import('../src/ui/pueblos');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('PUEBLOS_EXTRACTORES', listo)) listo(); });
});

const esc = (s: string): string => s;
const aldea: PuebloDeMapa = { id: 'pueblo-1', tipo: 'aldeaAgricola', madreId: 'as-1', propio: true, posicion: { x: 55, y: 50 }, almacen: { trigo: 40 }, capacidad: 1000, cultivo: 'trigo', nivelAldea: 2 } as PuebloDeMapa;
const obra: ObraDeMapa = { id: 'obra-1', tipo: 'pueblo', madreId: 'as-1', propia: true, posicion: { x: 45, y: 50 }, requerido: { madera: 50 }, entregado: {} } as unknown as ObraDeMapa;

/** El contexto de Territorio de una plaza de nivel 3 con esos pueblos y obras; `cargo: null`, quien mira no gestiona. */
function contexto(pueblos: PuebloDeMapa[], obras: ObraDeMapa[], o: { cargo?: string | null; nivel?: number; id?: string } = {}): ContextoPlaza & { repintes: number } {
  const a = { id: o.id ?? 'as-1', faccionId: 'f-1', nivel: o.nivel ?? 3, nivelActual: o.nivel ?? 3, posicion: { x: 50, y: 50 }, cargos: { gobernadorId: 'h' }, almacen: { madera: { cantidad: 9000 } }, edificios: [] } as unknown as Asentamiento;
  // los pueblos y las obras son de esta plaza
  const deAqui = <T extends { madreId: string }>(xs: T[]): T[] => xs.map((x) => ({ ...x, madreId: a.id }));
  const proyeccion = { heroeId: 'h', faccionId: 'f-1', facciones: [], asentamientos: [a], asentamientosAvistados: [], pueblos: deAqui(pueblos), obrasDeMapa: deAqui(obras), avanzadas: [], caravanas: [] } as unknown as ProyeccionJugador;
  const c = { proyeccion, asentamiento: a, cargo: o.cargo === undefined ? 'gobernador' : o.cargo, resideAqui: true, escapar: esc, repintes: 0 } as unknown as ContextoPlaza & { repintes: number };
  (c as { refrescar: () => void }).refrescar = () => { c.repintes += 1; };
  return c;
}

/** Los botones de la fila: id y si está abierto. */
const botones = (html: string): [string, boolean][] =>
  [...html.matchAll(/data-pueblo-abrir="([^"]+)" aria-expanded="(true|false)"/g)].map((m) => [m[1]!, m[2] === 'true']);

/** Pulsa el botón `id` de la fila tal como lo cablea Territorio (con una raíz de mentira) y devuelve el HTML repintado. */
function pulsar(c: ContextoPlaza, id: string): string {
  const html = SUBPESTANA_PUEBLOS.html(c);
  let clic: (() => void) | undefined;
  const estado = botones(html).find(([x]) => x === id);
  if (!estado) throw new Error(`no está el botón ${id}`);
  const boton = { dataset: { puebloAbrir: id }, getAttribute: () => String(estado[1]), addEventListener: (_: string, f: () => void) => { clic = f; } };
  const cuerpo = { querySelectorAll: (sel: string) => (sel === '[data-pueblo-abrir]' ? [boton] : []), querySelector: () => null } as unknown as HTMLElement;
  SUBPESTANA_PUEBLOS.cablear!({ ...c, cuerpo } as ContextoPlaza);
  clic!();
  return SUBPESTANA_PUEBLOS.html(c);
}

describe('Territorio: los pueblos en botones', () => {
  test('sin pueblos ni obras, el «+» va solo y «Marcar» está abierto de serie', () => {
    const html = SUBPESTANA_PUEBLOS.html(contexto([], [], { id: 'as-vacia' }));
    expect(botones(html)).toEqual([['marcar', true]]);
    expect(html).toContain('Marcar un pueblo nuevo');
    expect(html).toContain('Aldea agrícola');
  });

  test('con pueblos, un botón con su icono por cada uno (el «+» primero) y nada abierto', () => {
    const html = SUBPESTANA_PUEBLOS.html(contexto([aldea], [obra], { id: 'as-2' }));
    expect(botones(html)).toEqual([['marcar', false], ['pueblo-1', false], ['obra-1', false]]);
    expect(html).not.toContain('pueblo-tarjeta');
    expect(html).not.toContain('class="obra-mapa');
    expect(html).not.toContain('Aldea agrícola');
    expect(html).toContain('title="Aldea de trigo"');
    expect(html).toContain('pueblo-icono-nivel">2<');
  });

  test('un clic abre su detalle; otro botón lo cambia (uno a la vez); el mismo otra vez lo cierra', () => {
    const c = contexto([aldea], [obra], { id: 'as-3' });
    let html = pulsar(c, 'pueblo-1');
    expect(botones(html)).toEqual([['marcar', false], ['pueblo-1', true], ['obra-1', false]]);
    expect(html).toContain('pueblo-tarjeta');
    expect(html).not.toContain('class="obra-mapa');
    html = pulsar(c, 'obra-1');
    expect(html).not.toContain('pueblo-tarjeta');
    expect(html).toContain('class="obra-mapa');
    html = pulsar(c, 'obra-1');
    expect(html).not.toContain('class="obra-mapa');
    expect(botones(html).every(([, abierto]) => !abierto)).toBe(true);
    html = pulsar(c, 'marcar');
    expect(html).toContain('Aldea agrícola');
    html = pulsar(c, 'marcar');
    expect(html).not.toContain('Aldea agrícola');
    expect(c.repintes).toBe(5);
  });

  test('quien no gestiona ve los pueblos, sin «+»', () => {
    const html = SUBPESTANA_PUEBLOS.html(contexto([aldea], [], { cargo: null, id: 'as-4' }));
    expect(botones(html)).toEqual([['pueblo-1', false]]);
    expect(html).toContain('Los pueblos los marca');
  });

  test('con el cupo lleno no sale el «+», y se dice', () => {
    const otra = { ...aldea, id: 'pueblo-2' } as PuebloDeMapa;
    const html = SUBPESTANA_PUEBLOS.html(contexto([aldea, otra], [], { nivel: 1, id: 'as-5' }));
    expect(botones(html).map(([x]) => x)).toEqual(['pueblo-1', 'pueblo-2']);
    expect(html).toContain('Cupo lleno');
  });
});
