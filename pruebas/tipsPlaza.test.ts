// Los tooltips con ficha de la plaza (0.192.0, Víctor 2026-11-10) y las casillas de fertilidad por cultivo desbloqueado, con los datos de juego de
// verdad (`pruebas/plaza/datos.json`, sacado de Docs/Mechanics del motor).
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento, Edificio } from '../src/tiposDominio';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos, tropasReclutables } = await import('../src/apiCliente');
const { htmlConstruir, htmlConstruidosVentana } = await import('../src/ui/panelObras');
const { fichaRecurso } = await import('../src/ui/vistaCiudad');
const { alternarRecursoDeLaBarra, cablearEleccionBarra, htmlEleccionBarra } = await import('../src/ui/hudPlaza');
const { htmlTipConstruido, htmlTipEdificio, htmlTipRecurso } = await import('../src/ui/tipsPlaza');
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

  test('la bodega: sus dos recetas sin cifras (qué hace y con qué), quién la trabaja y el tope de tres por plaza', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(3), 'bodega'));
    expect(t).toContain('hasta 3 por plaza');
    expect(t).toMatch(/Vino, con .*uva/);
    expect(t).toMatch(/Cerveza, con .*cebada/);
    expect(t).not.toContain('/min');
    expect(t).not.toContain('por unidad');
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

  test('sin construir, solo lo del nivel 1: ni mejoras ni cuántos niveles tiene (0.196.0)', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(2), 'granero'));
    expect(t).not.toContain('Mejora');
    expect(t).not.toMatch(/Nivel \d/);
    expect(t).not.toContain('niveles');
    expect(t).toContain('Qué da');
    expect(t).toContain('+4000 de cabida para el trigo');
    expect(t).not.toContain('12000');
  });

  test('la producción, sin cifras: la granja dice que da trigo, no cuánto', () => {
    const t = sinEtiquetas(htmlTipEdificio(plaza(1), 'granja'));
    expect(t).toMatch(/🌾 Trigo/);
    expect(t).not.toContain('/min');
    expect(t).not.toContain('mano de obra completa');
  });

  test('para qué hace falta en la plaza: subirla de nivel y quién lo pide', () => {
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'fundicion'))).toContain('Hace falta para subir la plaza al nivel 3');
    // en una plaza que ya pasó ese nivel ya no se dice
    expect(sinEtiquetas(htmlTipEdificio(plaza(3), 'fundicion'))).not.toContain('subir la plaza al nivel 3');
    // desde el motor 3d05872 el nivel 2 pide la Leñera y ya no la Granja a nivel 2
    expect(sinEtiquetas(htmlTipEdificio(plaza(1, [edificio('lenera')]), 'lenera'))).toContain('Hace falta para subir la plaza al nivel 2');
    expect(sinEtiquetas(htmlTipEdificio(plaza(1, [edificio('granja')]), 'granja'))).not.toContain('subir la plaza al nivel 2');
    const carpinteria = htmlTipEdificio(plaza(2), 'carpinteria');
    expect(carpinteria).toContain('Lo piden:');
    expect(carpinteria).toContain('Barracón');
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'mercado'))).toContain('Lo piden:');
  });

  test('las tropas que recluta, solo las de tecnologías de tu Facción; de las otras, ni rastro', () => {
    const tropas = (tropasReclutables() ?? []).filter((x) => x.edificio === 'barracon' && x.nivelRequerido === 1);
    expect(tropas.length).toBeGreaterThan(0);
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [], tecnologiasAdoptadas: [], asentamientos: [] } as unknown as ProyeccionJugador;
    const sin = sinEtiquetas(htmlTipEdificio(plaza(2), 'barracon'));
    for (const x of tropas) expect(sin).not.toContain(x.nombre);
    expect(sin).not.toContain('tecnologías que tu Facción');
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [], tecnologiasAdoptadas: [tropas[0]!.tecnologia], asentamientos: [] } as unknown as ProyeccionJugador;
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'barracon'))).toContain(`Recluta ${tropas[0]!.nombre}`);
    estadoCliente.proyeccionUltima = null;
  });

  test('las recetas que piden una tecnología que no tienes no salen', () => {
    // la armería: el arma de cobre pide Metalurgia del cobre
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'armeria'))).not.toContain('Arma de cobre');
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [], tecnologiasAdoptadas: ['metalurgia_cobre'], asentamientos: [] } as unknown as ProyeccionJugador;
    expect(sinEtiquetas(htmlTipEdificio(plaza(2), 'armeria'))).toMatch(/Arma de cobre, con .*lingote de cobre/);
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
  /** Tu Facción, con esas tecnologías adoptadas (se deshace con `sinFaccion`). */
  const conTecnologias = (...t: string[]): void => {
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [], tecnologiasAdoptadas: t, asentamientos: [] } as unknown as ProyeccionJugador;
  };
  const sinFaccion = (): void => { estadoCliente.proyeccionUltima = null; };

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

  test('sin cifras: ni existencias ni ritmos, solo el aviso de almacén lleno (0.195.0)', () => {
    const a = plaza(1, [], { trigo: { cantidad: 300, capacidad: 800, porMinuto: 5, produccion: 10, consumido: 5 } });
    const t = sinEtiquetas(htmlTipRecurso(a, 'trigo'));
    expect(t).not.toContain('300');
    expect(t).not.toContain('/min');
    expect(t).not.toContain('Por minuto');
    expect(t).not.toContain('Se llena en');
    const lleno = sinEtiquetas(htmlTipRecurso(plaza(1, [], { trigo: { cantidad: 800, capacidad: 800 } }), 'trigo'));
    expect(lleno).toContain('Almacén lleno: lo que se produce de más se pierde.');
  });

  test('en ningún recurso sale otra cifra que la de los multiplicadores y el nivel del mantenimiento', () => {
    conTecnologias('canteria', 'metalurgia_cobre', 'aleacion_bronce', 'carros_guerra');
    for (const r of ['trigo', 'madera', 'piedra', 'oro', 'pan', 'harina', 'carne', 'leche', 'queso', 'cebada', 'uva', 'vino', 'cobre', 'lingoteCobre', 'cuero', 'livestock', 'chatarraBronce']) {
      const t = sinEtiquetas(htmlTipRecurso(plaza(1), r))
        .replace(/×\d+(,\d+)?/g, '')
        .replace(/desde el nivel \d/g, '');
      expect(t, r).not.toMatch(/\d/);
    }
    sinFaccion();
  });

  test('el pan: lo comen los pesants, sin la ración, y sale del horno', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'pan'));
    expect(t).toContain('Lo comen los pesants');
    expect(t).not.toContain('por cabeza');
    expect(t).toContain('los pesants crecen ×2');
    expect(t).toContain('De dónde sale');
    expect(htmlTipRecurso(plaza(1), 'pan')).toContain('Horno');
  });

  test('la carne: todos los tipos de población, no «clases», y la guarnición', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'carne'));
    expect(t).toContain('Lo comen todos los tipos de población');
    expect(t).toContain('todos los tipos de población crecen ×');
    expect(t).not.toContain('clases');
    expect(t).toContain('La guarnición lo come junto al trigo, una ración por soldado');
    expect(t).toContain('Los rebaños de las aldeas ganaderas');
  });

  test('la piedra: la Cantería la multiplica, y paga el mantenimiento desde el nivel 2', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'piedra'));
    expect(t).toContain('Cantería');
    expect(t).toContain('×1,5 a lo que se produce');
    expect(t).toContain('El mantenimiento de la plaza, desde el nivel 2');
    expect(t).toContain('Subir la plaza de nivel');
  });

  test('el oro: la recaudación y el reclutamiento, sin tasas ni precios', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'oro'));
    expect(t).toContain('La recaudación: los impuestos de la población de la plaza');
    expect(t).toContain('Reclutar: lo paga cada soldado, y cada caballo aparte');
    expect(t).toContain('Presión Fiscal');
  });

  test('la leche no se come: es de la quesera; sale de los rebaños', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'leche'));
    expect(t).toContain('No se come');
    expect(t).toContain('Los rebaños de las aldeas ganaderas');
  });

  test('la harina: el molino con buey la dobla', () => {
    expect(sinEtiquetas(htmlTipRecurso(plaza(1), 'harina'))).toContain('con un buey uncido: ×2');
  });

  test('la cebada: de las aldeas de cebada, y la bodega hace cerveza (sin «por unidad»)', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'cebada'));
    expect(t).toContain('Las aldeas de cebada');
    expect(t).not.toContain('desde que una plaza');
    expect(t).toMatch(/Bodega hace .*cerveza/);
    expect(t).not.toContain('por unidad');
  });

  test('las recetas, las tropas y las mejoras que piden una tecnología que no tienes no salen en «Para qué sirve»', () => {
    // el lingote de cobre: la armería hace armas de cobre con él solo con Metalurgia del cobre
    sinFaccion();
    const sinMetalurgia = sinEtiquetas(htmlTipRecurso(plaza(2), 'lingoteCobre'));
    expect(sinMetalurgia).not.toContain('Arma de cobre');
    expect(sinMetalurgia).toContain('Armadura intermedia'); // esa no pide tecnología
    conTecnologias('metalurgia_cobre');
    expect(sinEtiquetas(htmlTipRecurso(plaza(2), 'lingoteCobre'))).toContain('Arma de cobre');
    // el bronce de los carros de guerra de la carpintería, solo con Carros de guerra
    const sinCarros = sinEtiquetas(htmlTipRecurso(plaza(3), 'cueroCurtido'));
    expect(sinCarros).not.toMatch(/Carpintería hace/);
    conTecnologias('carros_guerra');
    expect(sinEtiquetas(htmlTipRecurso(plaza(3), 'cueroCurtido'))).toMatch(/Carpintería hace/);
    sinFaccion();
  });

  test('la chatarra sale de las batallas y la refunde la Gran Fundición', () => {
    const t = sinEtiquetas(htmlTipRecurso(plaza(1), 'chatarraBronce'));
    expect(t).toContain('Las batallas');
    expect(htmlTipRecurso(plaza(1), 'chatarraBronce')).toContain('Gran Fundición');
  });
});

describe('la elección de la barra de arriba en el Almacén (0.195.0)', () => {
  const botones = (h: string): string[] => [...h.matchAll(/data-barra-recurso="([^"]+)"/g)].map((m) => m[1]!);
  /** Una raíz de mentira con los botones de la cabecera: `pulsar('[data-barra-todos]')` hace el clic. */
  const raizFalsa = (): { raiz: HTMLElement; pulsar: (sel: string) => void } => {
    const clics = new Map<string, () => void>();
    const raiz = {
      querySelectorAll: () => [],
      querySelector: (sel: string) => ({ addEventListener: (_: string, f: () => void) => { clics.set(sel, f); } }),
    } as unknown as HTMLElement;
    return { raiz, pulsar: (sel) => clics.get(sel)?.() };
  };

  test('de serie, solo los recursos con algo (y los que ya van en la barra), con «Mostrar todos»', () => {
    const a = plaza(1, [], { madera: { cantidad: 50, capacidad: 900 }, piedra: { cantidad: 0, capacidad: 900 }, oro: { cantidad: 0.4, capacidad: 900 }, cobre: { cantidad: 0, capacidad: 900 } });
    alternarRecursoDeLaBarra(a, 'cobre'); // elegido aunque esté a 0: sale para poder quitarlo
    const h = htmlEleccionBarra(a, esc);
    expect(botones(h)).toEqual(['madera', 'cobre']);
    expect(h).toContain('data-barra-todos');
    expect(h).toContain('Mostrar todos');
    const { raiz, pulsar } = raizFalsa();
    cablearEleccionBarra(raiz, a, () => {}, () => {});
    pulsar('[data-barra-sola]'); // vuelve a ir sola
  });

  test('«Mostrar todos» enseña el resto y se vuelve «Solo los que hay»', () => {
    const a = plaza(1, [], { madera: { cantidad: 50, capacidad: 900 }, piedra: { cantidad: 0, capacidad: 900 } });
    let repintes = 0;
    const { raiz, pulsar } = raizFalsa();
    cablearEleccionBarra(raiz, a, () => { repintes += 1; }, () => {});
    pulsar('[data-barra-todos]');
    expect(repintes).toBe(1);
    const todos = htmlEleccionBarra(a, esc);
    expect(botones(todos)).toContain('piedra');
    expect(todos).toContain('Solo los que hay');
    pulsar('[data-barra-todos]');
    expect(botones(htmlEleccionBarra(a, esc))).not.toContain('piedra');
  });

  test('si todo tiene algo, no hay botón', () => {
    expect(htmlEleccionBarra(plaza(1, [], {}), esc)).not.toContain('data-barra-todos');
  });
});

describe('el tooltip de los edificios construidos (0.195.0)', () => {
  const conMejora = (e: Edificio, nivelObjetivo: number): Edificio => ({ ...e, mejora: { nivelObjetivo, completaEn: 0 } }) as Edificio;

  test('cada cuadrito de «Construidos» lo pide con data-tip y sin el title del navegador', () => {
    const html = htmlConstruidosVentana(plaza(2, [edificio('horno'), edificio('granja', 2)]), esc);
    expect(html).toContain('data-tip="construido:horno"');
    expect(html).toContain('data-tip="construido:granja"');
    expect(html).not.toMatch(/class="construido[^"]*"[^>]*title=/);
    expect(contenidoTip({ dataset: { tip: 'construido:horno' } } as unknown as HTMLElement)).toContain('<h3>Horno</h3>');
  });

  // La Granja tiene un solo nivel desde el motor 3d05872: los niveles se prueban con el Granero, que tiene cuatro.
  test('la granja, de un solo nivel: ni nivel, ni mejora, ni cifras de producción', () => {
    const t = sinEtiquetas(htmlTipConstruido(plaza(2, [edificio('granja')]), 'granja'));
    expect(t).toContain('uno en la plaza');
    expect(t).not.toContain('· nivel');
    expect(t).not.toContain('Mejora al nivel');
    expect(t).not.toContain('nivel más alto');
    expect(t).not.toContain('/min');
    expect(t).toContain('Clic para verlo en la plaza.');
  });

  test('el granero de nivel 2: lo que tiene, todo junto, y solo la mejora al nivel 3', () => {
    const t = sinEtiquetas(htmlTipConstruido(plaza(4, [edificio('granero', 2)]), 'granero'));
    expect(t).toContain('uno en la plaza · nivel 2');
    expect(t).not.toContain('de 4');
    expect(t).toContain('Lo que tiene');
    expect(t).toContain('Mejora al nivel 3');
    expect(t).not.toContain('Mejora al nivel 4');
    expect(t).toContain('Clic para verlo en la plaza.');
  });

  test('la mejora siguiente sin lo bloqueado: sin su tecnología, ni la receta nueva ni el nivel que la pide', () => {
    // la carpintería 2 hace carros de guerra solo con «Carros de guerra»
    const carp = (): string => sinEtiquetas(htmlTipConstruido(plaza(3, [edificio('carpinteria')]), 'carpinteria'));
    expect(carp()).toContain('Mejora al nivel 2');
    expect(carp()).not.toContain('Carro de guerra');
    estadoCliente.proyeccionUltima = { faccionId: 'f-1', facciones: [], tecnologiasAdoptadas: ['carros_guerra'], asentamientos: [] } as unknown as ProyeccionJugador;
    expect(carp()).toMatch(/Carro de guerra, con .*madera.*cuero curtido.*lingote de bronce/);
    // la fundición 3 pide «Forja de hierro estandarizada»: sin ella, no se enseña esa mejora
    const fund = sinEtiquetas(htmlTipConstruido(plaza(4, [edificio('fundicion', 2)]), 'fundicion'));
    expect(fund).not.toContain('Mejora al nivel 3');
    expect(fund).not.toContain('nivel más alto');
    estadoCliente.proyeccionUltima = null;
  });

  test('varios del mismo tipo: cuántos, el mejor nivel, los que se mejoran y los dañados', () => {
    const casas = [edificio('vivienda'), { ...edificio('vivienda'), id: 'e-2', danado: true } as Edificio, conMejora({ ...edificio('vivienda'), id: 'e-3' }, 2)];
    const t = sinEtiquetas(htmlTipConstruido(plaza(2, casas), 'vivienda'));
    expect(t).toContain('3 en la plaza');
    expect(t).toContain('Uno se está mejorando');
    expect(t).toContain('Uno está dañado');
    expect(t).toContain('Lo que tiene cada uno');
    expect(t).toContain('cada clic, el siguiente');
  });

  test('de niveles distintos, cuenta el mejor', () => {
    const t = sinEtiquetas(htmlTipConstruido(plaza(4, [edificio('granero', 1), { ...edificio('granero', 2), id: 'e-2' } as Edificio]), 'granero'));
    expect(t).toContain('2 en la plaza · nivel 1 a 2');
    expect(t).toContain('Lo que tiene el mejor');
    expect(t).toContain('Mejora del mejor al nivel 3');
  });

  test('en su nivel más alto no ofrece mejora', () => {
    const t = sinEtiquetas(htmlTipConstruido(plaza(4, [edificio('granero', 4)]), 'granero'));
    expect(t).not.toContain('Mejora al nivel');
    expect(t).toContain('Está en su nivel más alto.');
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
