// Los tooltips con ficha de la plaza (0.192.0, Víctor 2026-11-10) y las casillas de fertilidad por cultivo desbloqueado, con los datos de juego de
// verdad (`pruebas/plaza/datos.json`, sacado de Docs/Mechanics del motor).
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, Edificio } from '../src/tiposDominio';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos } = await import('../src/apiCliente');
const { htmlConstruir } = await import('../src/ui/panelObras');
const { fichaRecurso } = await import('../src/ui/vistaCiudad');
const { htmlEleccionBarra } = await import('../src/ui/hudPlaza');
const { htmlTipEdificio, htmlTipRecurso } = await import('../src/ui/tipsPlaza');
const { contenidoTip } = await import('../src/ui/tipFicha');
const { cultivosDesbloqueados } = await import('../src/ui/pueblos');
const { estadoCliente } = await import('../src/ui/estadoCliente');

beforeAll(async () => {
  await new Promise<void>((listo) => { if (bloqueDeDatos('EDIFICIO_CATALOGO', listo)) listo(); });
});

const esc = (s: string): string => s;
const edificio = (tipo: string, nivelInterno = 1): Edificio => ({ id: `e-${tipo}`, tipo, estado: 'activo', nivelInterno, posicion: { x: 0, y: 0 } }) as Edificio;
const plaza = (nivel: number, edificios: Edificio[] = [], almacen: Record<string, { cantidad: number; capacidad?: number; porMinuto?: number; produccion?: number; consumido?: number }> = {}): Asentamiento =>
  ({ id: 'as-1', faccionId: 'f-1', nivel, nivelActual: nivel, posicion: { x: 50, y: 50 }, cargos: { gobernadorId: 'h' }, almacen: { madera: { cantidad: 9000, capacidad: 9000 }, piedra: { cantidad: 9000, capacidad: 9000 }, ...almacen }, edificios }) as unknown as Asentamiento;
const sinEtiquetas = (h: string): string => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('el tooltip de los edificios de Construir', () => {
  test('cada botón lo pide con data-tip y ya no lleva el title del navegador', () => {
    const html = htmlConstruir(plaza(1), 'gobernador', esc);
    expect(html).toContain('data-construir="vivienda" data-tip="edificio:vivienda"');
    expect(html).not.toMatch(/class="obra-construir[^"]*"[^>]*title=/);
    // y el tooltip sale con la plaza que se acaba de pintar
    expect(contenidoTip({ dataset: { tip: 'edificio:vivienda' } } as unknown as HTMLElement)).toContain('<h3>Vivienda</h3>');
  });

  test('la vivienda: su función con las cifras del catálogo, su coste y su obra', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(1), 'vivienda'));
    expect(t).toContain('da sitio a 15 pesants y 10 artesanos');
    expect(t).toContain('Construir');
    expect(t).toContain('10 min');
    expect(t).toContain('Clic para ponerlo en la cola de obras.');
  });

  test('la bodega: sus dos recetas, quién la trabaja y el tope de tres por plaza', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(3), 'bodega'));
    expect(t).toContain('hasta 3 por plaza');
    expect(t).toMatch(/Vino: hasta 1 \/min, con .*2 .*por unidad/);
    expect(t).toContain('Cerveza');
    expect(t).toMatch(/🔨 3 artesanos artesanos de mano de obra/);
  });

  test('el molino lo trabajan los pesants y rinde el doble con buey', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(1), 'molino'));
    expect(t).toMatch(/👨‍🌾 2 pesants pesants de mano de obra/);
    expect(t).toContain('Con un buey, ×2');
  });

  test('lo que falta en el almacén va en rojo', () => {
    const pobre = plaza(1, [], { madera: { cantidad: 1, capacidad: 800 } });
    const h = htmlTipEdificio(pobre, 'vivienda');
    expect(h).toContain('ta-rec falta');
    expect(h).toContain('No hay bastante en el almacén');
  });

  test('las mejoras dicen lo que piden y lo que añaden', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(2), 'granero'));
    expect(t).toContain('Mejoras');
    expect(t).toMatch(/Nivel 4 : .*plaza 3/);
    expect(t).toContain('12000 de cabida para el trigo');
  });

  test('para qué hace falta en la plaza: subirla de nivel y quién lo pide', () => {
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'fundicion'))).toContain('Hace falta para subir la plaza al nivel 3');
    // en una plaza que ya pasó ese nivel ya no se dice
    expect(sinEtiquetas(htmlTipEdificio(plaza(3), 'fundicion'))).not.toContain('subir la plaza al nivel 3');
    expect(sinEtiquetas(htmlTipEdificio(plaza(1, [edificio('granja')]), 'granja'))).toContain('Hace falta de nivel 2 para subir la plaza al nivel 2');
    const carpinteria = htmlTipEdificio(plaza(2), 'carpinteria');
    expect(carpinteria).toContain('Lo piden:');
    expect(carpinteria).toContain('Barracón');
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'mercado'))).toContain('Lo piden:');
  });

  test('el barracón cuenta las tropas que abre; sin las tecnologías, contadas y sin nombre', () => {
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [], tecnologiasAdoptadas: ['hostigamiento_tribal'], asentamientos: [] } as unknown as ProyeccionJugador;
    const t = sinEtiquetas(htmlTipEdificio(plaza(2), 'barracon'));
    expect(t).toContain('Recluta');
    expect(t).toContain('con tecnologías que tu Facción aún no tiene');
    estadoCliente.proyeccionUltima = null;
  });

  test('la Sala del Consejo da una política más al Gobernador', () => {
    expect(sinEtiquetas(htmlTipEdificio(plaza(3), 'salaConsejo'))).toContain('hueco más de política');
  });

  test('un tipo que no está en el catálogo no tiene tooltip', () => {
    expect(htmlTipEdificio(plaza(1), 'noExiste')).toBe('');
  });
});

describe('el tooltip de los recursos del Almacén', () => {
  test('las fichas y los botones de la barra lo piden, con las cifras para el teclado', () => {
    const a = plaza(1, [], { trigo: { cantidad: 300, capacidad: 800, porMinuto: 4, produccion: 10, consumido: 6 } });
    const ficha = fichaRecurso('trigo', a.almacen!.trigo! as never, esc);
    expect(ficha).toContain('data-tip="recurso:trigo"');
    expect(ficha).toContain('aria-label="Trigo: 300 de 800 · por minuto produce 10, consume 6 · neto +4/min');
    expect(ficha).not.toContain('title=');
    const barra = htmlEleccionBarra(a, esc);
    expect(barra).toContain('data-tip="recurso:madera"');
    expect(barra).toContain('data-tip-nota=');
    expect(contenidoTip({ dataset: { tip: 'recurso:madera', tipNota: 'Clic para ponerlo en la barra' } } as unknown as HTMLElement)).toContain('Clic para ponerlo en la barra');
  });

  test('las existencias van arriba: lo que hay, lo que entra y sale y cuándo se llena', () => {
    const a = plaza(1, [], { trigo: { cantidad: 300, capacidad: 800, porMinuto: 5, produccion: 10, consumido: 5 } });
    const t = sinEtiquetas(htmlTipRecurso(a, 'trigo'));
    expect(t).toContain('300 de 800 en el almacén');
    expect(t).toContain('Por minuto entra 10 y sale 5');
    expect(t).toContain('Se llena en');
  });

  test('el pan: comida de los pesants, su ración y su multiplicador, y de dónde sale', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'pan'));
    expect(t).toContain('Comida de los pesants: 0,04 por cabeza y minuto');
    expect(t).toContain('los pesants crecen ×2');
    expect(t).toContain('De dónde sale');
    expect(htmlTipRecurso(plaza(1), 'pan')).toContain('Horno');
  });

  test('la carne: todas las clases y la guarnición', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'carne'));
    expect(t).toContain('Comida de todas las clases');
    expect(t).toContain('La guarnición lo come antes que el trigo');
    expect(t).toContain('Los rebaños de las aldeas de trigo: 60 por cabeza');
  });

  test('la piedra: la Cantería la multiplica, y paga el mantenimiento desde el nivel 2', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'piedra'));
    expect(t).toContain('Cantería');
    expect(t).toContain('×1,5 a lo que se produce');
    expect(t).toContain('El mantenimiento de la plaza, desde el nivel 2');
    expect(t).toMatch(/Subir la plaza: 400 para el nivel 2/);
  });

  test('el oro: la recaudación por clase y el reclutamiento', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'oro'));
    expect(t).toContain('0,004 por pesant, 0,015 por artesano y 0,06 por noble');
    expect(t).toContain('de 1 a 11 por soldado según el escalón, y 5 más por caballo');
    expect(t).toContain('Presión Fiscal');
  });

  test('la leche no se come: es de la quesera; sale de los rebaños sin sacrificar', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'leche'));
    expect(t).toContain('No se come');
    expect(t).toContain('3 por cabeza y hora, sin sacrificar');
  });

  test('la harina: el molino con buey la dobla', () => {
    expect(sinEtiquetas(htmlTipRecurso(plaza(1), 'harina'))).toContain('con un buey uncido: ×2');
  });

  test('la cebada: de las aldeas de cebada desde el nivel 3, y para la cerveza', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'cebada'));
    expect(t).toContain('Las aldeas de cebada, desde que una plaza de tu Facción llega al nivel 3');
    expect(t).toContain('Cerveza');
  });

  test('la chatarra sale de las batallas y la refunde la Gran Fundición', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'chatarraBronce'));
    expect(t).toContain('Las batallas');
    expect(htmlTipRecurso(plaza(1), 'chatarraBronce')).toContain('Gran Fundición');
  });
});

describe('las casillas de fertilidad del mapa, por cultivo desbloqueado', () => {
  const proyeccion = (niveles: number[]): ProyeccionJugador =>
    ({ faccionId: 'f-1', asentamientos: [], plazasPropias: [], asentamientosAvistados: niveles.map((nivel, i) => ({ id: `p-${i}`, faccionId: 'f-1', nivel })) }) as unknown as ProyeccionJugador;

  test('sin Facción o sin plazas, solo el trigo', () => {
    expect(cultivosDesbloqueados(null)).toEqual(['trigo']);
    expect(cultivosDesbloqueados(proyeccion([]))).toEqual(['trigo']);
  });

  test('con una plaza de nivel 3 en la Facción, la vid y la cebada; con una de 4, los cinco', () => {
    expect(cultivosDesbloqueados(proyeccion([1, 3]))).toEqual(['trigo', 'vid', 'cebada']);
    expect(cultivosDesbloqueados(proyeccion([4]))).toEqual(['trigo', 'vid', 'oliva', 'cebada', 'sesamo']);
  });

  test('las plazas de otras Facciones no cuentan', () => {
    const p = { faccionId: 'f-1', asentamientos: [], plazasPropias: [], asentamientosAvistados: [{ id: 'x', faccionId: 'f-2', nivel: 5 }] } as unknown as ProyeccionJugador;
    expect(cultivosDesbloqueados(p)).toEqual(['trigo']);
  });
});
