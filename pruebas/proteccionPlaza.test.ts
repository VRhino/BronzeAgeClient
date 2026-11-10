// La protección de una plaza en su ficha del mapa (Víctor, 2026-11-10): toda plaza nace inatacable `OCUPACION.proteccionMinutos` (un día) y lo
// vuelve a ser tras una conquista. De una ajena solo llega la fundación; de la tuya, `protegida_hasta_ms`.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { htmlFilaProteccion, minutosDeProteccion, motivoProtegida, proteccionRestante, protegidaHasta } = await import('../src/ui/proteccionPlaza');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('OCUPACION', listo)) listo(); });
});

const esc = (s: string): string => s;
const H = 3_600_000;

describe('la protección de una plaza', () => {
  test('sale de OCUPACION.proteccionMinutos', () => {
    expect(minutosDeProteccion()).toBe(1440);
  });

  test('de una ajena, el día tras su fundación', () => {
    expect(protegidaHasta({ fundadoEn: 1000 })).toBe(1000 + 24 * H);
    expect(proteccionRestante({ fundadoEn: 0 }, 6 * H)).toBe(18 * H);
    expect(proteccionRestante({ fundadoEn: 0 }, 24 * H)).toBeUndefined();
    expect(proteccionRestante({}, 0)).toBeUndefined();
  });

  test('si llega su fin (una de tu Facción, o tras una conquista), manda ese', () => {
    expect(proteccionRestante({ protegidaHasta: 50 * H, fundadoEn: 0 }, 30 * H)).toBe(20 * H);
    expect(proteccionRestante({ protegidaHasta: 10 * H, fundadoEn: 0 }, 12 * H)).toBeUndefined();
  });

  test('la fila de la ficha y el motivo del Atacar apagado, solo mientras dura', () => {
    const fila = htmlFilaProteccion({ fundadoEn: 0 }, 6 * H, esc);
    expect(fila).toContain('🛡 Protegida');
    expect(fila).toMatch(/le queda \d+ (h|min|d)/);
    expect(motivoProtegida({ fundadoEn: 0 }, 6 * H)).toMatch(/^Está protegida: se podrá atacar dentro de/);
    expect(htmlFilaProteccion({ fundadoEn: 0 }, 25 * H, esc)).toBe('');
    expect(motivoProtegida({ fundadoEn: 0 }, 25 * H)).toBe('');
  });
});
