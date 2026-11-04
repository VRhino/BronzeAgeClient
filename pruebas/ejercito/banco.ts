// Banco de la ventana «Ejército» del mapa (`/pruebas/ejercito/`, 0.132.0) y de la pestaña «Ejércitos» de la Facción (`?faccion=1`): una partida de
// mentira, sin servidor, con la misma estructura que pinta main.ts. `?lider=1`: tú diriges; `?solo=1`: vas por tu cuenta; `?fondo=<url>`: imagen detrás.
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { htmlEjercitosFaccion, htmlPanelEjercito } from '../../src/ui/ejercitos';
import { htmlBarraJugador } from '../../src/ui/barraJugador';

const qs = new URLSearchParams(location.search);
const AHORA = Date.parse('2026-11-04T09:00:00Z');
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const solo = Boolean(qs.get('solo'));
const lider = qs.get('lider') ? 'heroe-1' : 'heroe-9';
const escuadra = (id: string, nombre: string, tropaId: string, cantidad: number, nivel: number, extra = {}) =>
  ({ id, nombre, tropaId, cantidad, nivel, moral: 80, costeLiderazgo: 30, contenedor: { tipo: 'ejercito', ejercitoId: 'ej-1' }, enGuarnicion: false, ...extra });
const mia = {
  id: 'ej-1', faccionId: 'fac-1', origenAsentamientoId: 'as-1', tipo: solo ? 'personal' : 'ejercito', liderId: solo ? 'heroe-1' : lider, estado: 'marchando',
  participantes: solo ? [{ heroeId: 'heroe-1', unidoEn: AHORA - 9e6 }] : [{ heroeId: 'heroe-9', unidoEn: AHORA - 9e6 }, { heroeId: 'heroe-1', unidoEn: AHORA - 8e6 }, { heroeId: 'heroe-21', unidoEn: AHORA - 7e6 }],
  escuadronIds: ['s1', 's2', 's3'], ruta: [], posicionActual: { x: 400, y: 300 }, politicaDeUnion: 'preguntar',
  suministro: { trigo: 420, madera: 120, oro: 35, bronce: 12 }, capacidadCarga: 900,
  caravanasAdjuntasIds: solo ? [] : ['car-1'], marchaForzada: true,
};
const otro = { id: 'ej-2', faccionId: 'fac-1', origenAsentamientoId: 'as-1', tipo: 'ejercito', liderId: 'heroe-30', estado: 'estacionado', participantes: [{ heroeId: 'heroe-30', unidoEn: 0 }, { heroeId: 'heroe-31', unidoEn: 0 }, { heroeId: 'heroe-32', unidoEn: 0 }], escuadronIds: [], ruta: [], posicionActual: { x: 520, y: 330 }, politicaDeUnion: 'aceptar' };
const formacion = { id: 'ej-3', faccionId: 'fac-1', origenAsentamientoId: 'as-1', tipo: 'personal', liderId: 'heroe-40', estado: 'estacionado', participantes: [{ heroeId: 'heroe-40', unidoEn: 0 }], escuadronIds: [], ruta: [], posicionActual: { x: 410, y: 312 }, politicaDeUnion: 'aceptar', formacion: { expiraEn: AHORA + 4 * 60_000 } };
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1', mapaId: 'm',
  heroe: { id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'mapa' }, carro: {}, almacenPersonal: {}, liderazgoBase: 300, loadouts: [],
    escuadrones: [escuadra('s1', 'Lanceros de Tebas', 'hoplitas_ciudadanos', 60, 3), escuadra('s2', 'Arqueros del río', 'arqueros', 40, 2), escuadra('s3', 'Milicia', 'milicia_lanceros', 30, 1, { prestada: true })] },
  facciones: [{ id: 'fac-1', nombre: 'Casa de Micenas', reyId: 'heroe-1', ciudadanosIds: ['heroe-1', 'heroe-9', 'heroe-21'], miembros: [] }],
  ejercitos: qs.get('faccion') || !solo ? [mia, otro, formacion] : [mia],
  caravanas: [{ id: 'car-1', nombre: 'Ánfora', tipo: 'comercial', origenAsentamientoId: 'as-1', posicionActual: { x: 400, y: 300 }, estado: 'adjunta',
    carros: [{ tipoCarro: 'basico', animal: 'buey' }, { tipoCarro: 'reforzado', animal: 'caballo' }], escoltaIds: ['s9'], contenido: { cobre: 200, estano: 40, vino: 60 } }],
  heroesVisibles: [
    { heroeId: 'heroe-9', displayName: 'Agamenón', classDefinitionId: 'x', nivel: 6, escuadrasQueLleva: [{ tropaId: 'hoplitas_ciudadanos', cantidad: 80, nivel: 4 }, { tropaId: 'carros_de_guerra', cantidad: 12, nivel: 2 }], equipamiento: {} },
  ],
  nombresDeCompaneros: { 'heroe-9': 'Agamenón', 'heroe-21': 'Menelao', 'heroe-30': 'Néstor', 'heroe-31': 'Áyax', 'heroe-32': 'Diomedes', 'heroe-40': 'Ulises' },
  asentamientos: [], asentamientosAvistados: [], asentamientosConocidos: [], pueblos: [], avanzadas: [], convocatorias: [], campamentosMercenarios: [], campamentosBandidos: [],
  ejercitosAvistados: [], caravanasAvistadas: [], miradasIntel: [], informesPlaza: [], alijos: [], zonasFusionadas: [], titulos: [],
} as unknown as ProyeccionJugador;

let barra = '';
try { barra = htmlBarraJugador(p, e); } catch { barra = '<header class="jugador-barra"></header>'; }
const fondo = qs.get('fondo');
document.getElementById('app')!.innerHTML = `<div class="mapa-screen" style="${fondo ? `background:url('${fondo}') center/cover` : 'background:radial-gradient(circle at 50% 45%, #6f8a4a, #2f3d22)'}">
  ${barra}
  <nav class="mapa-riel"><button type="button">⚔</button><button type="button" class="activo">⚑</button><button type="button">📍</button></nav>
  ${qs.get('faccion')
    ? `<aside class="jugador-panel jugador-panel-completo jugador-panel-faccion"><div class="faccion-cabecera"><div class="mapa-panel-jugador">Facción</div><button class="btn-secondary" type="button">Cerrar</button></div>
        <div class="faccion-marco"><div></div><div class="faccion-principal"><nav class="faccion-pestanas"><button class="faccion-pestana">Miembros</button><button class="faccion-pestana">Plazas</button><button class="faccion-pestana activo">Ejércitos</button><button class="faccion-pestana">Tecnología</button></nav>
        <div class="faccion-cuerpo">${htmlEjercitosFaccion(p, e)}</div></div></div></aside>`
    : `<aside class="mapa-panel mapa-panel-ventana">${htmlPanelEjercito(p, e)}</aside>`}
</div>`;
