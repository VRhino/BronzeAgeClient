// El panel lateral de la Facción (Víctor, 2026-11-10): sin los cinco cuadros; el nivel como escudo sobre el blasón, miembros, prestigio y
// reputación en una franja con icono y cifra, el Rey y el Embajador en una línea; y la Liga solo con los aliados (la guerra no une).
import { describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { htmlLateralFaccion } = await import('../src/ui/pestanaFaccion');
const { ligaDe } = await import('../src/sigilo/imperio');

const esc = (s: string): string => s;
const relaciones = [
  { id: 'r1', tipo: 'guerra', estado: 'activa', faccionAId: 'f-1', faccionBId: 'f-2' },
  { id: 'r2', tipo: 'guerra', estado: 'activa', faccionAId: 'f-1', faccionBId: 'f-3' },
  { id: 'r3', tipo: 'guerra', estado: 'activa', faccionAId: 'f-4', faccionBId: 'f-1' },
  { id: 'r4', tipo: 'alianza', estado: 'activa', faccionAId: 'f-1', faccionBId: 'f-5' },
];
const p = {
  heroeId: 'h1', faccionId: 'f-1', heroe: { displayName: 'Rhino', escuadrones: [] }, nombresDeCompaneros: {}, heroesVisibles: [], titulos: [], relaciones,
  asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], plazasPropias: [], caravanas: [],
  facciones: ['PlayaNueva', 'obelizco', 'Casa de Kurigalzu 4', 'Casa de Amenofis 6', 'Casa de Ahiram 2'].map((nombre, i) => ({ id: `f-${i + 1}`, nombre })),
} as unknown as ProyeccionJugador;
Object.assign(p.facciones[0]!, { nivel: 3, reputacion: 0, prestigio: 62, topeAlianzas: 1, ciudadanosIds: ['h1', 'h2'], reyId: 'h1', experiencia: 195 });

describe('la Liga de tu Facción', () => {
  test('con tres guerras y una alianza, la Liga son solo los dos aliados', () => {
    expect(ligaDe('f-1', relaciones)?.miembrosIds.sort()).toEqual(['f-1', 'f-5']);
    expect(ligaDe('f-1', relaciones.filter((r) => r.tipo === 'guerra'))).toBeUndefined();
  });

  test('el panel la nombra así', () => {
    const html = htmlLateralFaccion(p, esc);
    expect(html).toContain('<span>PlayaNueva, Casa de Ahiram 2</span>');
    expect(html).not.toContain('Casa de Amenofis 6');
  });
});

describe('el panel lateral de la Facción', () => {
  const html = htmlLateralFaccion(p, esc);

  test('sin los cinco cuadros', () => {
    expect(html).not.toContain('faction-stats');
    expect(html).not.toContain('faction-roles');
  });

  test('el nivel, como escudo sobre el blasón', () => {
    expect(html).toMatch(/faccion-escudo-con-nivel">.*<span class="medallon-nivel faccion-nivel" title="Facción de nivel 3"/s);
  });

  test('miembros, prestigio y reputación en una franja, con icono y cifra', () => {
    const franja = html.match(/<div class="faccion-franja">[^]*?<\/div>/)?.[0] ?? '';
    expect(franja).toContain('aria-label="Miembros: 2"');
    expect(franja).toContain('aria-label="Prestigio: 62"');
    expect(franja).toContain('aria-label="Reputación: 0"');
  });

  test('el Rey y el Embajador en una línea', () => {
    const fila = html.match(/<div class="faccion-cargos-fila">[^]*?<\/div>/)?.[0] ?? '';
    expect(fila).toContain('Rey</small><b>Rhino</b>');
    expect(fila).toContain('faccion-cargo vacante');
    expect(fila).toContain('Embajador</small><b>Sin designar</b>');
  });
});
