// Banco de la ventana de Diplomacia de la Facción (`/pruebas/diplomacia/?elegida=fac-2`): una partida de mentira, sin servidor, con la misma
// estructura que pinta `renderPanelJugador` en main.ts, para mirarla a distintos tamaños de pantalla.
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { elegirFaccion, htmlLateralFaccion, PESTANAS_FACCION, renderPestanaFaccion } from '../../src/ui/pestanaFaccion';

const AHORA = Date.parse('2026-11-03T12:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sig = (n: number) => ({ forma: n % 5, colorFondo: n % 7, colorFigura: (n + 3) % 7, figura: n % 9, division: n % 4 });
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1', mapaId: 'm',
  heroe: { id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, carro: {}, escuadrones: [] },
  facciones: [
    { id: 'fac-1', nombre: 'Casa de Micenas', sigilo: sig(1), reyId: 'heroe-1', embajadorId: 'heroe-9', nivel: 3, reputacion: 14, experiencia: 420, ciudadanosIds: ['heroe-1', 'heroe-9', 'heroe-21'],
      miembros: [{ heroeId: 'heroe-1', residenciaId: 'as-1', cargos: ['rey'], participacion: 420 }, { heroeId: 'heroe-9', residenciaId: 'as-4', cargos: ['embajador'], participacion: 180 }] },
    { id: 'fac-2', nombre: 'Reino de Hatti', sigilo: sig(2), reyId: 'heroe-40', nivel: 4, reputacion: -3, ciudadanosIds: ['heroe-40', 'heroe-41'] },
    { id: 'fac-3', nombre: 'Señorío de Ugarit', sigilo: sig(3), reyId: 'heroe-50', nivel: 2, reputacion: 20, ciudadanosIds: ['heroe-50'] },
    { id: 'fac-4', nombre: 'Casa de Pilos', sigilo: sig(4), reyId: 'heroe-60', nivel: 2, reputacion: 5, ciudadanosIds: ['heroe-60'] },
  ],
  directorioFacciones: Array.from({ length: 14 }, (_, i) => ({ id: `fac-d${i}`, nombre: ['Tribu de Arzawa', 'Gente de Lukka', 'Clan de Mitanni', 'Casa de Tebas', 'Reino de Alashiya', 'Casa de Cnosos', 'Señorío de Troya'][i % 7] + (i >= 7 ? ' II' : ''), sigilo: sig(i + 10), nivel: 1 + (i % 3), ciudadanos: 1 + (i % 4), esBot: i % 3 === 0 })),
  asentamientos: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 410, y: 300 } }],
  asentamientosAvistados: [{ id: 'as-8', nombre: 'Hattusa', faccionId: 'fac-2', nivel: 4, posicion: { x: 560, y: 240 } }, { id: 'as-9', nombre: 'Ugarit', faccionId: 'fac-3', nivel: 2, posicion: { x: 600, y: 400 } }],
  asentamientosConocidos: [{ asentamientoId: 'as-10', nombre: 'Pilos', faccionId: 'fac-4', nivel: 2, posicion: { x: 300, y: 420 } }],
  pueblos: [], avanzadas: [], caravanas: [], ejercitos: [], convocatorias: [], campamentosBandidos: [], ejercitosAvistados: [], caravanasAvistadas: [],
  relaciones: [
    { id: 'rel-1', tipo: 'guerra', estado: 'activa', faccionAId: 'fac-1', faccionBId: 'fac-2', pazPropuestaPor: 'fac-2' },
    { id: 'rel-2', tipo: 'alianza', estado: 'activa', faccionAId: 'fac-1', faccionBId: 'fac-3' },
  ],
  propuestasRelacion: [
    { id: 'prop-1', tipo: 'vasallaje', faccionAId: 'fac-4', faccionBId: 'fac-1', expiraEn: AHORA + 40 * H, tributo: { recurso: 'trigo', cantidadPorMinuto: 6 } },
    { id: 'prop-2', tipo: 'alianza', faccionAId: 'fac-1', faccionBId: 'fac-d1', expiraEn: AHORA + 60 * H },
  ],
  campamentosMercenarios: [], heroesVisibles: [], titulos: [],
  nombresDeCompaneros: { 'heroe-9': 'Agamenón', 'heroe-40': 'Hattusili', 'heroe-50': 'Niqmaddu', 'heroe-60': 'Néstor' },
} as unknown as ProyeccionJugador;

const panel = document.querySelector<HTMLElement>('.jugador-panel')!;
function pintar(): void {
  elegirFaccion(new URLSearchParams(location.search).get('elegida'));
  const pestanas = `<nav class="faccion-pestanas" role="tablist">${PESTANAS_FACCION.map(([id, nombre]) => `<button type="button" class="faccion-pestana${id === 'diplomacia' ? ' activo' : ''}">${nombre}</button>`).join('')}</nav>`;
  const cuerpo = renderPestanaFaccion(p, e, 'diplomacia', '', true);
  panel.innerHTML = `<div class="faccion-cabecera"><div class="mapa-panel-jugador">Facción</div><button class="btn-secondary" type="button">Cerrar</button></div><div class="faccion-marco">${htmlLateralFaccion(p, e)}<div class="faccion-principal">${pestanas}<div class="faccion-cuerpo faccion-cuerpo-diplomacia">${cuerpo}</div></div></div>`;
}
pintar();
(window as unknown as { __banco: unknown }).__banco = { listo: true };
