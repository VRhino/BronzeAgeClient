// El motor 3d05872 (2026-11-11) en el cliente, con los datos de juego de verdad (`pruebas/plaza/datos.json`): la aldea de trigo sin corrales y la
// ganadera aparte (solo corrales y rebaño, en la tierra del trigo, desde el nivel 1), la Granja de un solo nivel, el nivel 2 con la Leñera y dos
// pueblos, y la guarnición que come carne y trigo a la vez.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, EscenaPueblo, PuebloDeMapa } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';
import type { MapaGenerado } from '../src/terreno';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { cultivosDesbloqueados, nombreDePueblo, produce, SUBPESTANA_PUEBLOS } = await import('../src/ui/pueblos');
const { capaDe, capaDeCultivo, sitiosDeAldea } = await import('../src/mundo/fertilidad');
const { htmlTipConstruido, htmlTipRecurso } = await import('../src/ui/tipsPlaza');
const { puebloEnVista } = await import('../src/ciudad3d/pueblo');
const { iconoDePueblo } = await import('../src/ui/hudInterior');
const { iconoEdificio } = await import('../src/ui/iconosEdificio');
const { htmlAscensoPlaza } = await import('../src/ui/panelCentro');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('EDIFICIO_CATALOGO', listo)) listo(); });
  await new Promise<void>((listo) => { if (bloqueDeDatos('PUEBLOS_EXTRACTORES', listo)) listo(); });
  await new Promise<void>((listo) => { if (bloqueDeDatos('NIVEL_ASENTAMIENTO', listo)) listo(); });
});

const esc = (s: string): string => s;
const sinEtiquetas = (h: string): string => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const aldea = (cultivo: string, nivelAldea = 1): PuebloDeMapa =>
  ({ id: 'pueblo-1', tipo: 'aldeaAgricola', cultivo, nivelAldea, madreId: 'as-1', propio: true, posicion: { x: 0, y: 0 }, almacen: {}, capacidad: 1000 }) as unknown as PuebloDeMapa;

describe('la aldea ganadera', () => {
  test('se llama así, da lo del rebaño y nada de granjas; la de trigo, solo trigo', () => {
    expect(nombreDePueblo(aldea('ganado', 2))).toBe('Aldea ganadera (nivel 2)');
    expect(produce(aldea('ganado'))).toEqual(['livestock', 'carne', 'leche']);
    expect(produce(aldea('trigo'))).toEqual(['trigo']);
  });

  test('mira la tierra del trigo, y no sale como casilla aparte en las capas del mapa', () => {
    expect(capaDeCultivo('ganado')).toBe('trigo');
    const capa = { columnas: 10, filas: 10, celda: 1, datos: Uint8Array.from({ length: 100 }, (_, i) => (i % 10 >= 5 ? 200 : 0)) };
    const mapa = { rasters: { terreno: { ...capa, datos: new Uint8Array(100).fill(3) }, fertilidad: capa } } as unknown as MapaGenerado;
    expect(capaDe(mapa, 'ganado')).toBe(capa);
    const zona = { centro: { x: 5, y: 5 }, radio: 4 };
    expect(sitiosDeAldea(mapa, zona, [], 0.3, 1, 'ganado')).toEqual(sitiosDeAldea(mapa, zona, [], 0.3, 1, 'trigo'));
    expect(cultivosDesbloqueados(null)).toEqual(['trigo']);
  });

  test('al marcar, desde el nivel 1: trigo o ganado, y la ayuda ya no da corrales al trigo', () => {
    const a = { id: 'as-1', nivel: 1, nivelActual: 1, posicion: { x: 50, y: 50 }, faccionId: 'f-1', cargos: { gobernadorId: 'h' }, edificios: [], almacen: {} } as unknown as Asentamiento;
    const proyeccion = { heroeId: 'h', faccionId: 'f-1', facciones: [], asentamientos: [a], asentamientosAvistados: [], pueblos: [], obrasDeMapa: [], avanzadas: [], caravanas: [] } as unknown as ProyeccionJugador;
    const html = SUBPESTANA_PUEBLOS.html({ proyeccion, asentamiento: a, cargo: 'gobernador', resideAqui: true, escapar: esc, refrescar: () => {} } as unknown as ContextoPlaza);
    expect([...html.matchAll(/name="pueblo-cultivo" value="(\w+)"/g)].map((m) => m[1])).toEqual(['trigo', 'ganado']);
    expect(html).toContain('ganado, la aldea ganadera, sin granjas y con corrales');
    expect(html).not.toContain('trigo, que lleva corrales');
    expect(html).toContain('El nivel 2 de la plaza pide 2 pueblos activos');
  });

  test('en 3D, el rebaño va en los corrales de la ganadera y no en el del buey de las demás', () => {
    const escena = (cultivo: string, tipoAncla: string): EscenaPueblo => ({
      puebloId: 'pueblo-1', tipo: 'aldeaAgricola', nivelMadre: 1, unidadesPorCelda: 3, radio: 20, calles: [], caminos: [], cultivo,
      edificios: [{ edificioId: 'p-0', tipo: tipoAncla, posicion: { x: 0, y: 0 }, ancho: 6, alto: 6 }, { edificioId: 'p-1', tipo: 'corral', posicion: { x: 10, y: 0 }, ancho: 12, alto: 9 }],
    }) as unknown as EscenaPueblo;
    const corrales = (e: EscenaPueblo) => puebloEnVista(e, { instante: 0 })!.edificios.filter((x) => x.tipo === 'corral').map((x) => x.cultivo);
    expect(corrales(escena('ganado', 'corral'))).toEqual(['ganado', 'ganado']);
    expect(corrales(escena('trigo', 'granja'))).toEqual([undefined]);
    expect(iconoDePueblo('aldeaAgricola', 46, 'ganado')).toBe(iconoEdificio('corral', 46));
    expect(iconoDePueblo('aldeaAgricola', 46, 'trigo')).toBe(iconoEdificio('granja', 46));
  });
});

describe('la Granja, el ganado y la guarnición', () => {
  const plaza = { id: 'as-1', nivel: 2, nivelActual: 2, almacen: {}, edificios: [{ id: 'g', tipo: 'granja', estado: 'activo', posicion: { x: 0, y: 0 } }] } as unknown as Asentamiento;

  test('el nivel 2 pide la Leñera y dos pueblos activos, y ya no la Granja a nivel 2', () => {
    const p = { heroeId: 'h', faccionId: 'f-1', pueblos: [{ ...aldea('ganado'), madreId: 'as-1' }] } as unknown as ProyeccionJugador;
    const a = { ...plaza, nivel: 1, nivelActual: 1, poblacion: { pesants: 400, artesanos: 0, nobleza: 0 } } as unknown as Asentamiento;
    const t = sinEtiquetas(htmlAscensoPlaza(p, a, true, esc, undefined, true));
    expect(t).toContain('2 pueblos activos');
    expect(t).not.toContain('Granja a nivel 2');
    expect(htmlAscensoPlaza(p, a, true, esc, undefined, true)).toContain('Leñera');
  });

  test('la Granja de la fundación, de un solo nivel: no ofrece mejora', () => {
    const t = sinEtiquetas(htmlTipConstruido(plaza, 'granja'));
    expect(t).not.toContain('Mejora al nivel');
    expect(t).toContain('no sube de nivel');
  });

  test('el ganado sale de los rebaños de las aldeas ganaderas; la carne la come la guarnición junto al trigo', () => {
    const ganado = sinEtiquetas(htmlTipRecurso(plaza, 'livestock'));
    expect(ganado).toContain('Los rebaños de las aldeas ganaderas');
    expect(ganado).not.toContain('Las aldeas de ganado');
    expect(sinEtiquetas(htmlTipRecurso(plaza, 'carne'))).toContain('La guarnición lo come junto al trigo');
  });
});
