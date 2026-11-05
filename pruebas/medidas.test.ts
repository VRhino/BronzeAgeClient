import { describe, expect, it } from 'vitest';
import { medidas } from '../src/contrato/medidas';

describe('medidas de red (panel de rendimiento, F3)', () => {
  it('cuenta el ping, los bytes, lo que tarda en aplicar y cada orden por tipo', () => {
    for (const x of [40, 60, 50]) medidas.ping(x);
    medidas.recibido(2048);
    medidas.recibido(1024);
    medidas.aplicado(3);
    medidas.ordenSale('p-1', 'marcharA');
    medidas.ordenVuelve('p-1');
    medidas.ordenSale('p-2', 'construir');
    const r = medidas.resumen();
    expect(r.ping.ultima).toBe(50);
    expect(r.ping.media).toBe(50);
    expect(r.ping.max).toBe(60);
    expect(r.bytesTotales).toBe(3072);
    expect(r.bytesPorSegundo).toBeCloseTo(3072 / 5);
    expect(r.aplicar.n).toBe(1);
    expect(r.ordenes.map((o) => o.tipo)).toEqual(['marcharA']);
    expect(r.ordenesEnVuelo).toBe(1);
    medidas.olvidarOrdenes();
    expect(medidas.resumen().ordenesEnVuelo).toBe(0);
  });
  it('una respuesta sin orden conocida no cuenta', () => {
    medidas.ordenVuelve('no-existe');
    expect(medidas.resumen().ordenes.some((o) => o.tipo === 'undefined')).toBe(false);
  });
});
