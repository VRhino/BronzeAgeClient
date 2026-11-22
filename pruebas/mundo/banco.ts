// (mundo: copia ampliada del banco del ejército) Banco de la ventana «Ejército» del mapa (`/pruebas/ejercito/`, 0.132.0) y de la pestaña «Ejércitos» de la Facción (`?faccion=1`): una partida de
// mentira, sin servidor, con la misma estructura que pinta main.ts. `?lider=1`: tú diriges; `?solo=1`: vas por tu cuenta; `?fondo=<url>`: imagen detrás.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { htmlPanelEjercito } from '../../src/ui/ejercitos';
import { htmlIndicadorVelocidad } from '../../src/ui/velocidadColumna';
import { htmlColumna } from '../../src/ui/panelColumna';
import { htmlCapas } from '../../src/ui/capasMapa';
import { HTML_VENTANA_PUERTA, htmlAccionesPuerta } from '../../src/ui/accionesPuerta';
import { htmlBarraJugador } from '../../src/ui/barraJugador';
import { pintarCamino } from '../../src/ui/caminoPrimeraPlaza';
import { costoDeRefundacion } from '../../src/apiCliente';

const qs = new URLSearchParams(location.search);
const AHORA = Date.parse('2026-11-04T09:00:00Z');
import { instalarMenuJugadorMovil } from '../../src/ui/menuJugadorMovil';
instalarMenuJugadorMovil();
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
  ejercitosAvistados: [], caravanasAvistadas: [], acuerdos: [], miradasIntel: [], informesPlaza: [], alijos: [], zonasFusionadas: [], titulos: [],
} as unknown as ProyeccionJugador;


const barra = htmlBarraJugador(p, e);
const panel = qs.get('panel') ?? 'ninguno';
const botonRiel = (id: string, t: string) => `<button type="button" data-panel="${id}"${panel === id ? ' class="activo"' : ''}>${t}</button>`;
const cosas = `<span class="faction-kicker">Mis cosas</span><div class="mapa-lista"><strong>Asentamientos</strong><button class="mapa-lista-item" type="button">Micenas<span>Nivel 3</span></button><button class="mapa-lista-item" type="button">Tirinto<span>Nivel 2 · recordado</span></button><strong>Columnas</strong><button class="mapa-lista-item" type="button">Tu columna<span>marchando</span></button></div>`;
let contenidoPanel = '';
if (panel === 'columna') contenidoPanel = htmlColumna(p, e);
else if (panel === 'ejercito') contenidoPanel = htmlPanelEjercito(p, e);
else if (panel === 'cosas') contenidoPanel = cosas;
// la barra de víveres del mundo (`pintarComida` de main.ts): marcha forzada, velocidad, víveres y «desde el carro»; con columna, siempre a la vista
const velocidad = htmlIndicadorVelocidad({ valor: 30, ritmo: 'ligera', limita: 'la milicia', ligera: 30 } as never, e);
const comida = `<div class="mapa-comida" role="status"><button type="button" class="mapa-forzada" aria-pressed="false">» Marcha forzada</button>${velocidad}<span>🌾 Víveres</span><div class="mapa-comida-barra"><i style="width:62%"></i></div><strong>310 / 500</strong><button type="button" class="btn-secondary">＋ desde el carro</button></div>`;
const sel = qs.get('sel');
const tarjeta = sel ? `<aside class="mapa-seleccion"><button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
  <span class="faction-kicker">Campamento de bandidos</span><h3>Bandidos · nivel 2</h3>
  <div class="bandidos-nivel"><i class="on"></i><i class="on"></i><i></i><span>Nivel 2 de 3</span></div>
  <div class="mapa-seleccion-datos"><div><span>Nivel</span><strong>2</strong></div><div><span>Poder</span><strong>340</strong></div><div><span>Defensores</span><strong>40</strong></div><div><span>Distancia</span><strong>212</strong></div><div><span>Tiempo hasta allí</span><strong>7 min</strong></div></div>
  ${htmlAccionesPuerta([{ id: 'marchar', etiqueta: 'Marchar aquí', icono: '➜' }, { id: 'atacar', etiqueta: 'Atacar', icono: '⚔', principal: true }], e)}
  <p class="faction-error" role="alert"></p></aside>` : '';
document.getElementById('app')!.innerHTML = `<div class="mapa-screen" style="background:radial-gradient(circle at 50% 45%, #6f8a4a, #2f3d22)">
  <div class="mapa-lienzo"></div>
  ${barra}
  <aside class="mapa-panel${panel === 'ejercito' ? ' mapa-panel-ventana' : ''}"${contenidoPanel ? '' : ' hidden'}>${contenidoPanel}</aside>
  ${tarjeta}
  <div class="mapa-abajo"><nav class="mapa-riel" aria-label="Paneles del mapa">${botonRiel('columna', '⚔')}${botonRiel('ejercito', '⚑')}${botonRiel('cosas', '📍')}${botonRiel('fundar', '⌂')}</nav>${comida}</div>
  ${htmlCapas('mundo', 0.3, ['trigo'])}
  <button class="mapa-avatar" type="button" aria-label="Menú de sesión">VÍ</button>
  <div class="mapa-menu"${qs.get('menu') ? '' : ' hidden'}><button type="button">Refrescar</button><button type="button">Mostrar rejilla de movimiento</button><button type="button">Pantalla completa</button><button type="button">Cambiar de partida</button><button type="button">Cerrar sesión</button></div>
</div>`;
if (qs.get('capas')) { document.querySelector<HTMLElement>('.mapa-capas-lista')?.removeAttribute('hidden'); document.querySelector('.mapa-capas-boton')?.classList.add('activo'); }
// `?camino=1` (0.225.0): la tarjeta «Tu primera plaza» arriba a la derecha, sin plaza en tu Facción y con madera en el carro: toca volver a aportarla
if (qs.get('camino')) {
  const q = p as unknown as Record<string, unknown>;
  q.campamentosMercenarios = [{ id: 'camp-1', posicion: { x: 300, y: 300 }, residentesIds: ['heroe-1'], fondos: { 'fac-1': { madera: 30, piedra: 8, trigo: 40 } } }];
  const pintarCaminoBanco = (): void => pintarCamino(p, {}, costoDeRefundacion(pintarCaminoBanco), () => {}, e);
  pintarCaminoBanco();
}
(window as unknown as { __listo: boolean }).__listo = true;
