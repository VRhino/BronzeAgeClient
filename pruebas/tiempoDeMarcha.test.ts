import { test, expect, vi } from 'vitest';
const nodos: any[] = [], aristas: any[] = [];
for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) nodos.push({ id: y * 50 + x, posicion: { x: BigInt(x * 4000), y: BigInt(y * 4000) } });
for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) {
  if (x < 49) aristas.push({ a: y * 50 + x, b: y * 50 + x + 1, costeMilesimas: x >= 20 && x < 25 && y < 45 ? 3500 : 1000, vado: false });
  if (y < 49) aristas.push({ a: y * 50 + x, b: (y + 1) * 50 + x, costeMilesimas: 1000, vado: false });
}
vi.mock('../src/apiCliente', () => ({ grafoDeNavegacion: () => ({ nodos, aristas }), bloqueDeDatos: () => null, tropasReclutables: () => [] }));
// Una rejilla de 50 × 50 nodos cada 4 u con una franja cara (×3,5) de 20 u de ancho que corta casi todo el mapa: cruzarla sale más barato que rodearla.
test('el tiempo hasta un punto sigue el camino más barato del grafo a la velocidad del héroe solo (66)', async () => {
  const { minutosHasta } = await import('../src/mundo/tiempoDeMarcha');
  const p: any = { heroe: { escuadrones: [] }, heroeId: 'h', heroesVisibles: [], caravanas: [] };
  const c: any = { escuadronIds: [], participantes: [{ heroeId: 'h' }], posicionActual: { x: 0, y: 0 } };
  const m = minutosHasta(p, c, { x: 196, y: 0 });
  expect(m).toBeCloseTo((196 + 20 * 2.5) / 66, 3);
});
