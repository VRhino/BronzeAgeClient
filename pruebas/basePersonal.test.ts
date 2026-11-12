import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({
  bloqueDeDatos: () => null, catalogoDeTecnologia: () => null, tropasReclutables: () => [], oroPorSoldado: (t: { edificio: string }) => (t.edificio === 'centroUrbano' ? 0 : 2),
  radioDePuerta: () => 2, capacidadDeViveres: () => 350, consumoDeViveres: () => null, asignarGuarnicion: () => null, retirarGuarnicion: () => null,
  origenDeTropa: (t: { escalon: number; poblacion?: string }) => t.poblacion ?? (t.escalon <= 2 ? 'pesants' : t.escalon === 3 ? 'artesanos' : 'nobleza'),
}));
import type { ProyeccionJugador, TropaReclutable } from '../src/apiCliente';
import { comoReponer } from '../src/ui/basePersonal';

const tropas = [
  { id: 'honderos', nombre: 'Honderos', tecnologia: 'x', edificio: 'galeriaDeTiro', nivelRequerido: 1, costoEquipo: { armaMadera: 1 }, unidadesPorDefecto: 20, escalon: 1 },
  { id: 'lenadores', nombre: 'Leñadores', tecnologia: 'x', edificio: 'centroUrbano', nivelRequerido: 1, costoEquipo: { madera: 1 }, unidadesPorDefecto: 30, escalon: 1 },
  { id: 'arqueros', nombre: 'Arqueros', tecnologia: 'x', edificio: 'galeriaDeTiro', nivelRequerido: 2, costoEquipo: { armaBronce: 1 }, unidadesPorDefecto: 18, escalon: 2 },
] as TropaReclutable[];
const esc = (tropaId: string, cantidad: number, contenedor: object, extra: object = {}) => ({ id: tropaId, tropaId, cantidad, contenedor, ...extra }) as never;
const plaza = (reside: boolean) => ({
  id: 'as-1', faccionId: 'f', posicion: { x: 10, y: 10 }, heroesFundadoresIds: reside ? ['h'] : [],
  edificios: [{ tipo: 'galeriaDeTiro', estado: 'activo', nivelInterno: 1 }], almacen: { armaMadera: { cantidad: 5 }, oro: { cantidad: 100 } }, poblacion: { pesants: 40 },
});
const enPlaza = (reside: boolean, extra: object = {}) => ({ heroeId: 'h', faccionId: 'f', heroe: { ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' } }, asentamientos: [plaza(reside)], ejercitos: [], campamentosMercenarios: [], ...extra }) as unknown as ProyeccionJugador;

describe('Base personal: reponer', () => {
  it('dentro de tu plaza, la escuadra de tu campamento se repone hasta su tope con el equipo y el oro del almacén', () => {
    const r = comoReponer(enPlaza(true), esc('honderos', 12, { tipo: 'campamento' }), tropas);
    expect(r).toMatchObject({ tipo: 'plaza', faltan: 8, coste: { armaMadera: 8, oro: 16 }, motivo: 'El almacén de la plaza no tiene bastante.' });
  });
  it('sin residir no se repone la del campamento; completa o sin el edificio a su nivel, tampoco', () => {
    expect(comoReponer(enPlaza(false), esc('honderos', 12, { tipo: 'campamento' }), tropas)).toBeNull();
    expect(comoReponer(enPlaza(true), esc('honderos', 20, { tipo: 'campamento' }), tropas)).toBeNull();
    expect(comoReponer(enPlaza(true), esc('arqueros', 5, { tipo: 'campamento' }), tropas)).toBeNull();
  });
  it('la de una columna se repone con ella a la puerta, aunque no residas (ciudadano)', () => {
    const cerca = enPlaza(false, { ejercitos: [{ id: 'ej', posicionActual: { x: 11, y: 10 } }] });
    const lejos = enPlaza(false, { ejercitos: [{ id: 'ej', posicionActual: { x: 30, y: 10 } }] });
    expect(comoReponer(cerca, esc('honderos', 12, { tipo: 'ejercito', ejercitoId: 'ej' }), tropas)?.tipo).toBe('plaza');
    expect(comoReponer(lejos, esc('honderos', 12, { tipo: 'ejercito', ejercitoId: 'ej' }), tropas)).toBeNull();
  });
  it('la prestada solo en su campamento, gratis; fuera de él, nada', () => {
    const camp = { id: 'camp-1', posicion: { x: 0, y: 0 }, residentesIds: ['h'] };
    const dentro = { heroeId: 'h', heroe: { ubicacion: { tipo: 'mercenarios', campamentoId: 'camp-1' } }, asentamientos: [], ejercitos: [], campamentosMercenarios: [camp] } as unknown as ProyeccionJugador;
    const prestada = esc('lenadores', 10, { tipo: 'campamento' }, { prestada: { campamentoId: 'camp-1' } });
    expect(comoReponer(dentro, prestada, tropas)).toEqual({ tipo: 'prestada', faltan: 20 });
    expect(comoReponer(enPlaza(true), prestada, tropas)).toBeNull();
  });
});
