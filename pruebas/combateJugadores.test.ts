// El informe de un combate entre jugadores (Víctor, 2026-11-10): la misma ventana que contra bandidos, con lo que manda el motor (planos, en
// milésimas, sin bajas por escuadra). Columna contra columna, para los dos lados; asedios, pueblos, avanzadas y caravanas, para los atacantes y,
// en un asedio resistido, para los residentes de la plaza.
import { describe, expect, test } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { EventoDominio } from '../src/tiposDominio';
import { htmlInforme, informeDeEvento } from '../src/ui/informeCombate';

const esc = (s: string): string => s;
const proyeccion = (o: Record<string, unknown> = {}): ProyeccionJugador => ({
  heroeId: 'h1', faccionId: 'f-1', facciones: [{ id: 'f-1', nombre: 'PlayaNueva' }], directorioFacciones: [{ id: 'f-2', nombre: 'Casa de Amenofis 6' }],
  ejercitos: [{ id: 'ej-1', participantes: [{ heroeId: 'h1' }] }, { id: 'ej-2', participantes: [{ heroeId: 'h2' }] }],
  asentamientos: [], asentamientosAvistados: [{ id: 'as-7', nombre: 'Siquem' }], heroe: { escuadrones: [], residenciaId: 'as-3' }, nombresDeCompaneros: {}, heroesVisibles: [],
  ...o,
}) as unknown as ProyeccionJugador;

/** Columna contra columna: la atacante ej-1 (h1, f-1) gana a ej-2 (h2, f-2); los datos del `combate.encuentro` ya sumados. */
const choque: EventoDominio = {
  codigo: 'combate.resuelto', mensaje: '', version: 40, heroesIds: ['h1', 'h2'], momento: '2026-11-10T14:00:00Z',
  payload: { ejercitoId: 'ej-1', ganaElAtacante: 1, poderAtacante: 120_500, poderDefensor: 80_000, bajasAtacante: 12, bajasDefensor: 30, heridos: 1, robado: 40_000, chatarra: 10_000, botin: 50_000, ejercitoBId: 'ej-2', faccionAId: 'f-1', faccionBId: 'f-2' },
} as EventoDominio;

describe('el informe de un combate entre jugadores', () => {
  test('columna contra columna, el atacante que gana: victoria, contra quién, poderes, bajas y botín', () => {
    const i = informeDeEvento(choque, 'h1', proyeccion())!;
    expect(i).toMatchObject({ tipo: 'combate', resultado: 'victoria', teAtacaron: false, titulo: 'Atacaste una columna', rivalNombre: 'Casa de Amenofis 6', cargaGanada: 50, quedasHerido: false });
    expect(i.propio).toMatchObject({ poder: 120.5, bajasTotales: 12 });
    expect(i.rival).toMatchObject({ poder: 80, bajasTotales: 30 });
    const html = htmlInforme(i, proyeccion(), esc);
    expect(html).toContain('Victoria · Atacaste una columna');
    expect(html).toContain('+50 de carga en tu carro');
    expect(html).toContain('12 bajas');
    expect(html).not.toContain('Tus escuadras');
  });

  test('el mismo combate, para el defensor que pierde: derrota, te atacaron, pierde del carro y queda herido', () => {
    const p = proyeccion({ heroeId: 'h2', faccionId: 'f-2' });
    const i = informeDeEvento(choque, 'h2', p)!;
    expect(i).toMatchObject({ resultado: 'derrota', teAtacaron: true, titulo: 'Atacaron tu columna', rivalNombre: 'PlayaNueva', cargaPerdida: 40, quedasHerido: true });
    const html = htmlInforme(i, p, esc);
    expect(html).toContain('Pierdes del carro');
    expect(html).toContain('1 héroe herido');
  });

  test('si no ves la columna atacante, decide la tuya (la defensora)', () => {
    const p = proyeccion({ heroeId: 'h2', ejercitos: [{ id: 'ej-2', participantes: [{ heroeId: 'h2' }] }] });
    expect(informeDeEvento(choque, 'h2', p)).toMatchObject({ teAtacaron: true, resultado: 'derrota' });
    expect(informeDeEvento(choque, 'h9', p)).toBeNull();
  });

  test('un asedio resistido: el atacante pierde y el residente de la plaza lo ve como defensa ganada', () => {
    const e = { codigo: 'combate.asedio_resistido', mensaje: '', version: 41, heroesIds: ['h2'], asentamientoId: 'as-7', payload: { faccionAtacanteId: 'f-2', faccionDefensoraId: 'f-1', poderAtacante: 50_000, poderDefensor: 90_000, bajasAtacante: 20, bajasDefensor: 4, heridos: 1, botin: 0 } } as unknown as EventoDominio;
    expect(informeDeEvento(e, 'h2', proyeccion({ heroeId: 'h2' }))).toMatchObject({ resultado: 'derrota', titulo: 'Siquem resistió tu asedio', rivalNombre: 'PlayaNueva' });
    const residente = proyeccion({ heroe: { escuadrones: [], residenciaId: 'as-7' } });
    expect(informeDeEvento(e, 'h1', residente)).toMatchObject({ resultado: 'victoria', teAtacaron: true, titulo: 'Asediaron Siquem y resistió', rivalNombre: 'Casa de Amenofis 6' });
    expect(informeDeEvento(e, 'h1', proyeccion())).toBeNull();
  });

  test('una conquista sin defensores: sin combate', () => {
    const e = { codigo: 'combate.asedio_conquista', mensaje: '', version: 42, heroesIds: ['h1'], payload: { faccionAtacanteId: 'f-1', faccionDefensoraId: 'f-2', heridos: 0, chatarra: 0, botin: 0 } } as unknown as EventoDominio;
    const i = informeDeEvento(e, 'h1', proyeccion())!;
    expect(i).toMatchObject({ resultado: 'victoria', titulo: 'Conquistaste la plaza', sinCombate: true });
    expect(htmlInforme(i, proyeccion(), esc)).toContain('No había defensores con soldados');
  });

  test('un pueblo saqueado: lo que te llevas entra como botín', () => {
    const e = { codigo: 'combate.pueblo_saqueado', mensaje: '', version: 43, heroesIds: ['h1'], payload: { puebloId: 'pueblo-4', saqueado: 75_000, chatarra: 0, heridos: 0, carroPerdido: 0, poderAtacante: 60_000, poderDefensor: 20_000, bajasAtacante: 2, bajasDefensor: 30 } } as unknown as EventoDominio;
    expect(informeDeEvento(e, 'h1', proyeccion())).toMatchObject({ resultado: 'victoria', titulo: 'Saqueaste un pueblo', cargaGanada: 75, rivalNombre: 'El pueblo' });
  });
});
