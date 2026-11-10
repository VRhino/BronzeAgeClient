// La guarnición de la plaza propia desde la puerta (0.199.0, motor 906fb24): con la columna a la puerta y sin entrar, se dejan las escuadras de
// la columna y las tuyas de la guarnición vuelven a ella; lejos y sin residir, nada que dejar.
import { describe, expect, it, vi } from 'vitest';
import type { ProyeccionJugador } from '../src/apiCliente';
import type { Asentamiento } from '../src/tiposDominio';
import type { ContextoPlaza } from '../src/ui/ganchos';

vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
const { SUBPESTANA_GUARNICION } = await import('../src/ui/panelGuarnicion');

const plaza = { id: 'as-1', nombre: 'Tirinto', faccionId: 'f-1', posicion: { x: 100, y: 100 }, nivel: 2, heroesFundadoresIds: [], casasCompradas: [], guarnicionIds: ['s2'], guarnicion: [{ heroeId: 'h', tropaId: 'lanceros' }], cupoGuarnicion: 40 } as unknown as Asentamiento;

function proyeccion(columnaEn: { x: number; y: number }): ProyeccionJugador {
  return {
    heroeId: 'h', faccionId: 'f-1', instante: 0,
    heroe: {
      id: 'h', ubicacion: { tipo: 'columna', ejercitoId: 'ej-1' }, escuadrones: [
        { id: 's1', nombre: 'Honderos', tropaId: 'honderos', cantidad: 25, costeLiderazgo: 4, contenedor: { tipo: 'ejercito', ejercitoId: 'ej-1' } },
        { id: 's2', nombre: 'Lanceros', tropaId: 'lanceros', cantidad: 30, costeLiderazgo: 6, contenedor: { tipo: 'plaza', asentamientoId: 'as-1' } },
      ],
    },
    ejercitos: [{ id: 'ej-1', liderId: 'h', participantes: [{ heroeId: 'h' }], posicionActual: columnaEn }],
    facciones: [], heroes: [],
  } as unknown as ProyeccionJugador;
}

const contexto = (p: ProyeccionJugador): ContextoPlaza => ({ proyeccion: p, asentamiento: plaza, cuerpo: null as never, ejecutar: async () => null, refrescar: () => {}, cargo: null, resideAqui: false, escapar: (s) => s });

describe('guarnición de la plaza propia desde la puerta', () => {
  it('a la puerta: se recoge a la columna y se puede dejar la de la columna', () => {
    const html = SUBPESTANA_GUARNICION.html(contexto(proyeccion({ x: 103, y: 100 })));
    expect(html).toContain('data-guarnicion-retirar="s2"');
    expect(html).toContain('data-guarnicion-mas');
    expect(html).toContain('A la puerta');
  });
  it('lejos y sin residir: ni dejar ni recoger', () => {
    const html = SUBPESTANA_GUARNICION.html(contexto(proyeccion({ x: 400, y: 100 })));
    expect(html).not.toContain('data-guarnicion-retirar');
    expect(html).not.toContain('data-guarnicion-mas');
  });
});
