import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { elegirConsejo, type CatalogoDeCarga } from '../src/ui/pantallaCarga';

// Las pantallas de carga (docs/Pantallas_De_Carga.md): cómo se elige el consejo, y que el catálogo que va con el cliente vale.

const catalogo = (consejos: CatalogoDeCarga['consejos']): CatalogoDeCarga => ({ imagenes: {}, consejos });

describe('elegirConsejo', () => {
  it('solo da consejos activos de esa vista, o sin vistas', () => {
    const c = catalogo([
      { id: 'plaza', texto: 'de la plaza', vistas: ['asentamiento'] },
      { id: 'mundo', texto: 'del mundo', vistas: ['mundo'] },
      { id: 'todas', texto: 'de todas' },
      { id: 'apartado', texto: 'apartado', vistas: ['asentamiento'], activo: false },
      { id: 'vacio', texto: '   ', vistas: ['asentamiento'] },
    ]);
    const vistos = new Set<string>();
    for (let i = 0; i < 40; i++) vistos.add(elegirConsejo(c, 'asentamiento', () => (i % 10) / 10)!.id);
    expect([...vistos].sort()).toEqual(['plaza', 'todas']);
  });

  it('al entrar en la partida (sin vista) vale cualquiera', () => {
    const c = catalogo([{ id: 'a', texto: 'a', vistas: ['pueblo'] }, { id: 'b', texto: 'b', vistas: ['mundo'] }]);
    const vistos = new Set<string>();
    for (let i = 0; i < 20; i++) vistos.add(elegirConsejo(c, null, () => (i % 2) / 2)!.id);
    expect(vistos.size).toBe(2);
  });

  it('no repite el mismo dos veces seguidas si hay otro', () => {
    const c = catalogo([{ id: 'a', texto: 'a' }, { id: 'b', texto: 'b' }, { id: 'c', texto: 'c' }]);
    let antes = elegirConsejo(c, 'mundo', () => 0)!.id;
    for (let i = 0; i < 30; i++) {
      const ahora = elegirConsejo(c, 'mundo', () => 0)!.id;
      expect(ahora).not.toBe(antes);
      antes = ahora;
    }
  });

  it('con uno solo, lo repite; sin ninguno, nada', () => {
    const uno = catalogo([{ id: 'solo', texto: 'solo' }]);
    expect(elegirConsejo(uno, 'mundo')!.id).toBe('solo');
    expect(elegirConsejo(uno, 'mundo')!.id).toBe('solo');
    expect(elegirConsejo(catalogo([]), 'mundo')).toBeNull();
  });
});

describe('public/carga/consejos.json', () => {
  const carpeta = join(__dirname, '../public/carga');
  const c = JSON.parse(readFileSync(join(carpeta, 'consejos.json'), 'utf8')) as CatalogoDeCarga;
  const VISTAS = ['mundo', 'asentamiento', 'campamento', 'pueblo'];

  it('cada consejo tiene id único, texto, vistas válidas y una imagen que existe', () => {
    const ids = c.consejos.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of c.consejos) {
      expect(x.texto.trim().length, x.id).toBeGreaterThan(0);
      for (const v of x.vistas ?? []) expect(VISTAS, `${x.id}: ${v}`).toContain(v);
      if (x.imagen) expect(c.imagenes[x.imagen], `${x.id}: ${x.imagen}`).toBeDefined();
    }
  });

  it('cada imagen del catálogo está en la carpeta', () => {
    for (const [id, im] of Object.entries(c.imagenes)) expect(existsSync(join(carpeta, im.archivo)), `${id}: ${im.archivo}`).toBe(true);
  });

  it('cada vista tiene al menos un consejo', () => {
    for (const v of VISTAS) expect(c.consejos.some((x) => x.activo !== false && (!x.vistas?.length || x.vistas.includes(v as never))), v).toBe(true);
  });
});
