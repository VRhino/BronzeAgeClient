import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ bloqueDeDatos: () => null, distanciasDeFundar: () => ({ plazas: 20, campamentos: 20 }) }));
import type { ProyeccionJugador } from '../src/apiCliente';
import type { MapaGenerado } from '../src/terreno';
import { sitioDeFundacion } from '../src/ui/sitioDeFundacion';

// un mapa de 200×200 sin rasters (sin agua, llano, sin bosque), con un campamento en (100, 100) y un río por y = 40
const mapa = { config: { ancho: 200, alto: 200 }, campamentos: [{ id: 'camp-0', posicion: { x: 100, y: 100 }, origen: 0 }], rios: [{ id: 'r', puntos: [{ x: 0, y: 40 }, { x: 200, y: 40 }], navegable: false, terminaEnLago: false }], nodos: [], bosques: [] } as unknown as MapaGenerado;
const proy = (extra: object = {}) => ({ asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], campamentosMercenarios: [], zonasFusionadas: [], ...extra }) as unknown as ProyeccionJugador;

describe('Fundar sin adivinar', () => {
  it('a menos de 20 del campamento no; a 20 justos, sí (como el motor)', () => {
    expect(sitioDeFundacion(proy(), mapa, { x: 115, y: 100 }).motivo).toContain('aléjate 5 más');
    expect(sitioDeFundacion(proy(), mapa, { x: 120, y: 100 }).motivo).toBeNull();
  });

  it('el círculo del campamento cercano sale para pintarlo; uno lejano, no', () => {
    expect(sitioDeFundacion(proy(), mapa, { x: 130, y: 100 }).prohibidos).toEqual([{ centro: { x: 100, y: 100 }, radio: 20, de: 'campamento' }]);
    expect(sitioDeFundacion(proy(), { ...mapa, config: { ancho: 1000, alto: 1000 } } as MapaGenerado, { x: 600, y: 600 }).prohibidos).toEqual([]);
  });

  it('pegado al río (media anchura + radio de la plaza) no; fuera del mapa tampoco', () => {
    expect(sitioDeFundacion(proy(), mapa, { x: 150, y: 50 }).motivo).toContain('río');
    expect(sitioDeFundacion(proy(), mapa, { x: 150, y: 57 }).motivo).toBeNull();
    expect(sitioDeFundacion(proy(), mapa, { x: -1, y: 150 }).motivo).toBe('Fuera del mapa.');
  });

  it('cerca de una plaza conocida o dentro del territorio de otra, no', () => {
    const conPlaza = proy({ asentamientosConocidos: [{ posicion: { x: 160, y: 160 } }] });
    expect(sitioDeFundacion(conPlaza, mapa, { x: 150, y: 160 }).motivo).toContain('otra plaza');
    const conZona = proy({ zonasFusionadas: [{ faccionId: 'f-2', contornos: [[{ x: 140, y: 140 }, { x: 190, y: 140 }, { x: 190, y: 190 }, { x: 140, y: 190 }]] }] });
    expect(sitioDeFundacion(conZona, mapa, { x: 170, y: 170 }).motivo).toContain('territorio');
  });

  it('a menos de 12 de un nodo de recurso no; a 12 justos, sí (fundacion.cerca_de_nodo, 23-11)', () => {
    const conNodo = { ...mapa, nodos: [{ id: 'n-1', tipo: 'piedra', rareza: 'comun', posicion: { x: 150, y: 150 }, cantidadInicial: 100 }] } as unknown as MapaGenerado;
    expect(sitioDeFundacion(proy(), conNodo, { x: 150, y: 160 }).motivo).toContain('yacimiento');
    expect(sitioDeFundacion(proy(), conNodo, { x: 150, y: 162 }).motivo).toBeNull();
  });
});
