// La 0.205.0 (motor 457c278, datos de `pruebas/plaza/datos.json`): las Eras IV y V con sus hitos y contadores, las diez tropas nuevas con su
// ficha de combate, la experiencia de la escuadra con su curva, la formación de cada escuadra y los víveres de Logística de campaña.
import { beforeAll, describe, expect, test, vi } from 'vitest';
import datos from './plaza/datos.json';
import type { ProyeccionJugador, TropaReclutable } from '../src/apiCliente';
import type { CondicionHito } from '../src/tiposDominio';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => datos })));

const { bloqueDeDatos, capacidadDeViveres, origenDeTropa } = await import('../src/apiCliente');
const { estadoCliente } = await import('../src/ui/estadoCliente');
const { htmlFichaCombate, textoDeTier } = await import('../src/ui/fichaCombate');
const { formacionesPermitidas, htmlExperienciaEscuadra, htmlSelectorFormacion, nombreDeFormacion, progresoDeEscuadra, siguienteHabilidad } = await import('../src/ui/progresionEscuadra');
const { duracionDeEra, textoContador } = await import('../src/ui/arbolTecnologias');
const { explicarError: textoDeError } = await import('../src/ui/erroresServidor');

beforeAll(async () => {
  for (const b of ['TROPAS_RECLUTABLES', 'OBJETOS', 'MILITAR', 'FORMACIONES', 'LOGISTICA', 'TECNOLOGIAS']) {
    await new Promise<void>((listo) => { if (bloqueDeDatos(b, listo)) listo(); });
  }
});

const esc = (s: string): string => s;
const sinEtiquetas = (h: string): string => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tropa = (id: string): TropaReclutable => bloqueDeDatos<TropaReclutable[]>('TROPAS_RECLUTABLES')!.find((t) => t.id === id)!;

describe('las Eras IV y V', () => {
  test('doce tecnologías nuevas, seis en cada Era, y las diez tropas que abren', () => {
    const tec = bloqueDeDatos<Record<string, { era: string }>>('TECNOLOGIAS')!;
    expect(Object.values(tec).filter((t) => t.era === 'profesionalizacion_imperial')).toHaveLength(6);
    expect(Object.values(tec).filter((t) => t.era === 'hegemonia_macedonica')).toHaveLength(6);
    expect(bloqueDeDatos<TropaReclutable[]>('TROPAS_RECLUTABLES')).toHaveLength(37);
  });

  test('la última Era no tiene plazo', () => {
    expect(duracionDeEra({ orden: 5, plazoSemanas: 26, minimoSemanas: 1 }, 5)).toBe('la última Era, sin plazo');
    expect(duracionDeEra({ orden: 4, plazoSemanas: 8, minimoSemanas: 1 }, 5)).toBe('dura de 1 a 8 semanas');
  });

  test('los contadores nuevos se leen en castellano', () => {
    expect(textoContador('escuadras.veteranas')).toBe('escuadras que llegan al nivel 5');
    expect(textoContador('batallas.conRey')).toBe('batallas en las que combate un Rey');
  });

  test('las condiciones de hito nuevas tienen su forma', () => {
    const c: CondicionHito[] = [
      { tipo: 'escuadrasVivas', cantidad: 12 }, { tipo: 'heroesEnFaccion', cantidad: 4 }, { tipo: 'plazaEnNivel', nivel: 4 },
      { tipo: 'nivelFaccion', nivel: 5 }, { tipo: 'columnasEnMarcha', cantidad: 3 }, { tipo: 'edificioEnPlazaDeNivel', edificio: 'barracon', nivelInterno: 3, nivelPlaza: 4 },
    ];
    expect(c).toHaveLength(6);
  });

  test('los falangitas salen de los artesanos aunque sean del escalón 4', () => {
    expect(origenDeTropa(tropa('falangitas'))).toBe('artesanos');
    expect(origenDeTropa(tropa('hipaspistas'))).toBe('nobleza');
  });
});

describe('la ficha de combate', () => {
  test('el tier con el nombre de su rareza', () => {
    expect(textoDeTier(1)).toBe('Tier I, común');
    expect(textoDeTier(4)).toBe('Tier IV, épica');
    expect(textoDeTier(5)).toBe('Tier V, legendaria');
  });

  test('vida, cadencia y alcance; las filas a cero no salen; las de % llevan %', () => {
    const milicia = sinEtiquetas(htmlFichaCombate(tropa('milicia_lanceros'), esc));
    expect(milicia).toContain('Tier II, poco común');
    expect(milicia).toContain('800');
    expect(milicia).toContain('1,5 s');
    expect(milicia).toContain('Daño');
    expect(milicia).not.toContain('Penetración');
    const falangitas = sinEtiquetas(htmlFichaCombate(tropa('falangitas'), esc));
    expect(falangitas).toContain('Penetración 25 %');
  });

  test('las de distancia, además, precisión y munición', () => {
    const h = htmlFichaCombate(tropa('agrianos'), esc);
    expect(h).toContain('title="Precisión (1-100)"');
    expect(h).toContain('title="Munición"');
    expect(htmlFichaCombate(tropa('falangitas'), esc)).not.toContain('Munición');
  });

  test('sin bloque de combate no hay ficha', () => {
    expect(htmlFichaCombate({ tier: 3 }, esc)).toBe('');
  });
});

describe('la experiencia de la escuadra', () => {
  test('la curva: lo que lleva hacia el siguiente sale de la acumulada', () => {
    expect(progresoDeEscuadra({ nivel: 1, experiencia: 0 })).toEqual({ lleva: 0, pide: 10, pct: 0 });
    expect(progresoDeEscuadra({ nivel: 2, experiencia: 18 })).toEqual({ lleva: 8, pide: 25, pct: 32 });
    // 10 + 25 + 50 + 100 = 185 para llegar al 5; con 220 lleva 35 de los 150 del 5 al 6
    expect(progresoDeEscuadra({ nivel: 5, experiencia: 220 })).toEqual({ lleva: 35, pide: 150, pct: 23 });
    expect(progresoDeEscuadra({ nivel: 9, experiencia: 1100 })).toEqual({ lleva: 40, pide: 315, pct: 13 });
    expect(progresoDeEscuadra({ nivel: 10, experiencia: 1375 })).toBeNull();
  });

  test('la habilidad nueva en los niveles 4, 7 y 10', () => {
    expect([1, 3, 4, 6, 9, 10].map(siguienteHabilidad)).toEqual([4, 4, 7, 7, 10, null]);
    expect(sinEtiquetas(htmlExperienciaEscuadra({ nivel: 5, experiencia: 220 }))).toBe('nivel 5 35/150 · habilidad en el 7');
    expect(sinEtiquetas(htmlExperienciaEscuadra({ nivel: 10, experiencia: 1400 }))).toBe('nivel 10 (el tope)');
    expect(htmlExperienciaEscuadra({ nivel: 3, experiencia: 0, prestada: { campamentoId: 'c' } })).toContain('no gana experiencia');
  });
});

describe('la formación de la escuadra', () => {
  test('sin Facción o sin Disciplina, la de reposo y las tres abiertas; con ella, las ocho', () => {
    expect(formacionesPermitidas(null).map((f) => f.id)).toEqual(['reposo', 'linea', 'columna', 'dispersa']);
    expect(formacionesPermitidas(['leva_comunal']).map((f) => f.id)).toEqual(['reposo', 'linea', 'columna', 'dispersa']);
    expect(formacionesPermitidas(['disciplina_formacion'])).toHaveLength(8);
    expect(nombreDeFormacion('')).toBe('En reposo');
    expect(nombreDeFormacion('muro_escudos')).toBe('Muro de escudos');
  });

  test('el selector: la elegida marcada; en batalla, solo el nombre; una que ya no se permite, a la vista y apagada', () => {
    const todas = formacionesPermitidas(['disciplina_formacion']);
    const h = htmlSelectorFormacion({ id: 'esc-3', formacion: 'cuna', enBatalla: false }, todas, esc);
    expect(h).toContain('data-base-formacion="esc-3"');
    expect(h).toContain('<option value="cuna" selected>Cuña</option>');
    const batalla = htmlSelectorFormacion({ id: 'esc-3', formacion: 'cuna', enBatalla: true }, todas, esc);
    expect(batalla).not.toContain('<select');
    expect(sinEtiquetas(batalla)).toContain('Cuña en batalla');
    const sinTec = htmlSelectorFormacion({ id: 'esc-3', formacion: 'testudo', enBatalla: false }, formacionesPermitidas(null), esc);
    expect(sinTec).toContain('<option value="testudo" selected disabled>Testudo (ya no la permite tu Facción)</option>');
    expect(htmlSelectorFormacion({ id: 'esc-3', formacion: '', enBatalla: false }, todas, esc)).toContain('<option value="reposo" selected>En reposo</option>');
  });

  test('los rechazos de elegir la formación, en castellano', () => {
    expect(textoDeError('formacion.sin_tecnologia')).toContain('Disciplina de formación');
    expect(textoDeError('formacion.desconocida')).toBe('Esa formación no existe.');
  });
});

describe('Logística de campaña', () => {
  test('con ella en tu Facción, los víveres de cada héroe ×1,5', () => {
    estadoCliente.proyeccionUltima = { tecnologia: { propias: { adoptadas: [], aparecidas: [] } } } as unknown as ProyeccionJugador;
    expect(capacidadDeViveres()).toBe(350);
    estadoCliente.proyeccionUltima = { tecnologia: { propias: { adoptadas: ['logistica_campana'], aparecidas: [] } } } as unknown as ProyeccionJugador;
    expect(capacidadDeViveres()).toBe(525);
    estadoCliente.proyeccionUltima = null;
    expect(capacidadDeViveres()).toBe(350);
  });
});
