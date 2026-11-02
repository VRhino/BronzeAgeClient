import { test, expect, vi } from 'vitest';
import datos from './velocidad/datos.json';
// Los bloques de Docs/Mechanics del motor (los de `pruebas/velocidad/`): tropas, movimiento, caravanas y animales.
const bloques = datos.documentos.Banco as Record<string, unknown>;
vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: (n: string) => bloques[n] ?? null, tropasReclutables: () => bloques.TROPAS_RECLUTABLES }));

test('la infantería ligera es la velocidad más común del catálogo (30)', async () => {
  const { velocidadLigera } = await import('../src/ui/velocidadColumna');
  expect(velocidadLigera()).toBe(30);
});

test('la columna va al paso de lo más lento, con el color frente a la ligera', async () => {
  const { velocidadDePiezas, piezaDeTropa, piezaDeFundacion } = await import('../src/ui/velocidadColumna');
  const v = (ids: string[], forzada = false, caravana = false) => velocidadDePiezas([...ids.map(piezaDeTropa), ...(caravana ? [piezaDeFundacion()] : [])], forzada);
  expect(v([])).toMatchObject({ valor: 66, ritmo: 'rapida', limita: 'el héroe solo' });
  expect(v(['milicia_lanceros', 'honderos'])).toMatchObject({ valor: 30, ritmo: 'ligera' });
  expect(v(['milicia_lanceros', 'hacheros_armados'])).toMatchObject({ valor: 18, ritmo: 'lenta', limita: 'Hacheros armados' });
  expect(v(['milicia_lanceros'], true)).toMatchObject({ valor: 45, ritmo: 'rapida' });
  expect(v(['exploradores_caballo'], false, true)).toMatchObject({ valor: 10, ritmo: 'lenta', limita: 'la Caravana de Fundación' });
});
