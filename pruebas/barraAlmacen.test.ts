// La barra del Almacén automática (0.125.0): enseña lo que la plaza tiene, hasta 8, sin echar a nadie; al elegir el jugador, manda su elección.
import { describe, expect, it } from 'vitest';
import type { Asentamiento } from '../src/tiposDominio';

// `hudPlaza` trae `apiCliente`, que lee `location` al cargar
(globalThis as Record<string, unknown>).location = { protocol: 'http:', host: 'x', hostname: 'x', search: '' };
const { alternarRecursoDeLaBarra, barraAutomaticaActiva, recursosDeLaBarra } = await import('../src/ui/hudPlaza');

const plaza = (id: string, cantidades: Record<string, number>): Asentamiento =>
  ({ id, almacen: Object.fromEntries(Object.entries(cantidades).map(([r, c]) => [r, { cantidad: c, capacidad: 1000 }])) }) as unknown as Asentamiento;

describe('barra del Almacén', () => {
  it('va sola: entra lo nuevo al final, sale lo que se acaba y el noveno espera', () => {
    expect(barraAutomaticaActiva()).toBe(true);
    const base = { oro: 50, trigo: 100, piedra: 80, madera: 90, cobre: 0 };
    const inicio = recursosDeLaBarra(plaza('p1', base));
    expect(inicio.sort()).toEqual(['madera', 'oro', 'piedra', 'trigo']);
    const conCobre = recursosDeLaBarra(plaza('p1', { ...base, cobre: 20 }));
    expect(conCobre).toHaveLength(5);
    expect(conCobre[4]).toBe('cobre');
    expect(recursosDeLaBarra(plaza('p1', base))).not.toContain('cobre');
    const ocho = { ...base, cobre: 1, estano: 1, lingoteBronce: 1, livestock: 1 };
    const lleno = recursosDeLaBarra(plaza('p1', ocho));
    expect(lleno).toHaveLength(8);
    const nueve = recursosDeLaBarra(plaza('p1', { ...ocho, cuero: 5 }));
    expect(nueve).toEqual(lleno);
    // se acaba el cobre: el noveno entra en su sitio
    const sinCobre = recursosDeLaBarra(plaza('p1', { ...ocho, cobre: 0, cuero: 5 }));
    expect(sinCobre).toContain('cuero');
    expect(sinCobre).not.toContain('cobre');
  });

  it('al elegir, parte de lo que se ve y deja de cambiar sola', () => {
    const a = plaza('p2', { oro: 50, trigo: 100 });
    const vistos = recursosDeLaBarra(a);
    expect(alternarRecursoDeLaBarra(a, 'cobre')).toBe(true);
    expect(barraAutomaticaActiva()).toBe(false);
    // el oro se acaba y el cobre está a 0, pero la elección no cambia sola
    expect(recursosDeLaBarra(plaza('p2', { trigo: 100 }))).toEqual([...vistos, 'cobre']);
  });
});
