// Banco de las recompensas de misión flexibles (`/pruebas/misiones/`): una partida de mentira, sin servidor, con la ventana de misiones (cadenas
// de héroe, plaza y Facción) y el tablón de una plaza, para mirar la recompensa fija y la lista libre. Las órdenes no salen.
// Desde la 0.206.0 lee los datos de `pruebas/plaza/datos.json`: H2 da además un objeto y la diaria individual, los de `BOTIN_OBJETOS.misionDiaria`.
import '../../src/style.css';
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import { bloqueDeDatos } from '../../src/apiCliente';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { htmlPanelMisiones, elegirPestanaMisiones } from '../../src/ui/misiones';
import { htmlTablon } from '../../src/ui/tablon';
import type { Mision, MisionRecurrente, DefinicionRecurrente } from '../../src/tiposDominio';

const AHORA = Date.parse('2026-11-01T18:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cond = (contador: string, avance: number, umbral: number) => ({ contador, avance, umbral });
const mision = (id: string, estado: Mision['estado'], m: Partial<Mision>): Mision => ({ id, estado, condiciones: [cond('victorias', 3, 5)], recompensaExperiencia: 0, participacion: 0, recompensas: [], ...m });

const heroe: Mision[] = [
  mision('H2', 'cumplida', { recompensas: [{ tipo: 'recurso', clave: 'madera', cantidad: 300 }, { tipo: 'oro', cantidad: 5 }, { tipo: 'tropa', clave: 'exploradores_caballo', cantidad: 10 }, { tipo: 'objeto', clave: 'medalla_tropa_grande', cantidad: 1 }, { tipo: 'xp', cantidad: 2.5 }] }),
  mision('H3', 'activa', { recompensas: [{ tipo: 'recurso', clave: 'trigo', cantidad: 200 }] }),
];
const plaza: Mision[] = [mision('A4', 'activa', { participacion: 10, recompensas: [{ tipo: 'recurso', clave: 'piedra', cantidad: 400 }, { tipo: 'xp', cantidad: 15 }] })];
const faccion: Mision[] = [mision('F3', 'activa', { recompensaExperiencia: 40, recompensas: [{ tipo: 'oro', cantidad: 50 }, { tipo: 'recurso', clave: 'cobre', cantidad: 120 }] })];

const def = (id: string, tipo: 'individual' | 'grupal', duracion: 'diaria' | 'semanal', titulo: string, texto: string, x: Partial<DefinicionRecurrente>): DefinicionRecurrente => ({
  id, duracion, tipo, limiteSemanal: tipo === 'individual' ? 10 : 0, condiciones: [cond('victorias', 0, 5)], experiencia: 0, participacion: 10, recompensas: [], titulo, texto, explicacion: '', ...x,
});
const rec = (d: DefinicionRecurrente, estado: 'en_curso' | 'cumplida', avance: number): MisionRecurrente => ({
  definicion: d, desde: AHORA - 2 * H, hasta: AHORA + 20 * H, aceptadasSemana: 3,
  aceptaciones: d.tipo === 'individual' ? [{ heroeId: 'heroe-1', estado, condiciones: [cond('victorias', avance, 5)] }] : [],
  ...(d.tipo === 'grupal' ? { estado } : {}), condiciones: [cond('victorias', avance, 5)], aportes: d.tipo === 'grupal' ? { 'heroe-1': 3, 'heroe-2': 1 } : {},
});
const catalogo = [
  def('PD1', 'individual', 'diaria', 'Limpiar los caminos', 'Gana cinco combates cerca de la plaza.', { recompensas: [{ tipo: 'xp', cantidad: 10 }, { tipo: 'recurso', clave: 'madera', cantidad: 300 }, { tipo: 'oro', cantidad: 5 }] }),
  def('PD2', 'grupal', 'diaria', 'Llenar el granero', 'Entre todos, lleva trigo a la plaza.', { participacion: 30, recompensas: [{ tipo: 'recurso', clave: 'trigo', cantidad: 500 }] }),
  def('PS1', 'individual', 'semanal', 'Jinetes para la frontera', 'Patrulla la frontera durante la semana.', { recompensas: [{ tipo: 'tropa', clave: 'exploradores_caballo', cantidad: 10 }, { tipo: 'oro', cantidad: 20 }] }),
];
const tablon = { misiones: [rec(catalogo[0]!, 'cumplida', 5), rec(catalogo[1]!, 'en_curso', 3), rec(catalogo[2]!, 'en_curso', 1)], diariasIds: ['PD1', 'PD2'], semanalesIds: ['PS1'], conEleccion: false, elegidasDiariasIds: [], elegidasSemanalesIds: [], renovacionDiaria: AHORA + 6 * H, renovacionSemanal: AHORA + 70 * H, catalogo };

const p = {
  instante: AHORA, heroeId: 'heroe-1', faccionId: 'f-1',
  facciones: [{ id: 'f-1', nombre: 'Casa del Toro', reyId: 'heroe-1' }],
  asentamientos: [{ id: 'as-1', nombre: 'Kydonia', faccionId: 'f-1', cargos: { gobernadorId: 'heroe-1' } }],
  misiones: { heroe, plaza, faccion, plazaId: 'as-1' },
  heroe: { id: 'heroe-1', displayName: 'Korax' }, heroesVisibles: [], nombresDeCompaneros: { 'heroe-2': 'Ita' },
} as unknown as ProyeccionJugador;

const lienzo = document.querySelector<HTMLElement>('#lienzo')!;
function ver(v: string): void {
  if (v === 'diario') { elegirPestanaMisiones('heroe', 'H2'); lienzo.innerHTML = htmlPanelMisiones(p, e); }
  else lienzo.innerHTML = `<div class="banco-marco">${htmlTablon(p, { tipo: 'plaza', id: 'as-1', tablon: tablon as never }, e)}</div>`;
}
let vista = 'diario';
document.querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => { vista = b.dataset.ver!; ver(vista); }));
const banco = { ver, listo: false };
(window as unknown as { __banco: unknown }).__banco = banco;
// se repinta cuando llegan los datos: los nombres de los objetos y la tabla de la diaria salen de ellos
const repintar = (): void => { ver(vista); banco.listo = bloqueDeDatos('OBJETOS', repintar) !== null && bloqueDeDatos('BOTIN_OBJETOS', repintar) !== null; };
repintar();
