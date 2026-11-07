// Banco de los Aedas fuera del panel de Tecnología (0.169.0), sin servidor: la ficha de un Aeda itinerante parado en tu plaza (`?ficha=camino`:
// el que va de camino), el panel de Avisos con los hechos de los Aedas, la Crónica del mundo y la lira del modo mapa.
import '../../src/style.css';
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import { catalogoDeTecnologia, type ProyeccionJugador } from '../../src/apiCliente';
import type { EventoDominio } from '../../src/tiposDominio';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { FICHA_AEDA, dibujarAedasEnMapa } from '../../src/ui/aedas';
import { historialDeAvisos, procesar } from '../../src/ui/avisos';
import { htmlAvisos } from '../../src/ui/panelAvisos';
import { fijarCronica, htmlCronica } from '../../src/ui/cronica';

const AHORA = Date.parse('2026-11-07T10:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const qs = new URLSearchParams(location.search);
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1',
  heroe: { id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, carro: {}, escuadrones: [] },
  facciones: [{ id: 'fac-1', nombre: 'Casa de Micenas', reyId: 'heroe-1' }, { id: 'fac-2', nombre: 'Reino de Hatti' }, { id: 'fac-3', nombre: 'Señorío de Ugarit' }],
  directorioFacciones: [{ id: 'fac-4', nombre: 'Casa de Pilos' }],
  asentamientos: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 140, y: 120 }, almacen: { oro: { cantidad: 950 } }, cargos: {} }],
  asentamientosAvistados: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 140, y: 120 } }, { id: 'as-8', nombre: 'Hattusa', faccionId: 'fac-2', nivel: 4, posicion: { x: 330, y: 70 } }],
  asentamientosConocidos: [{ asentamientoId: 'as-10', nombre: 'Pilos', faccionId: 'fac-4', nivel: 2, posicion: { x: 0, y: 0 } }],
  ejercitos: [], ejercitosAvistados: [], caravanas: [], caravanasAvistadas: [], heroesVisibles: [], nombresDeCompaneros: {},
  titulos: [{ tituloId: 'mecenas', nombre: 'Mecenas de los Aedas', poseedorId: 'fac-1', valorMetrica: 12 }],
  tecnologia: {
    era: 'reinos_palaciales', eraDesde: AHORA - 30 * H, capitalId: 'as-1', logros: [], epicasPosibles: [],
    propias: { adoptadas: ['leva_comunal'], aparecidas: [] },
    reveladas: [
      { tecnologiaId: 'metalurgia_cobre', descubridorFaccionId: 'fac-2', hito: [], cumplidas: [false] },
      { tecnologiaId: 'escudos_ligeros', descubridorFaccionId: 'fac-3', hito: [], cumplidas: [false] },
    ],
  },
  aedasAvistados: [{ id: 'aeda-2', posicion: { x: 140, y: 120 }, enAsentamientoId: 'as-1' }, { id: 'aeda-1', posicion: { x: 250, y: 150 }, enMarcha: true }],
  aedasResidentes: [{ id: 'aeda-r1', nombre: 'Ión', asentamientoId: 'as-1' }],
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const app = document.querySelector<HTMLElement>('#app')!;
app.style.cssText = 'display:grid;grid-template-columns:340px 380px 420px;gap:18px;padding:18px;height:auto;align-items:start;color:var(--pergamino)';
app.innerHTML = `
  <div><div class="mapa-seleccion" style="position:static;display:block;max-width:none"></div>
    <canvas id="mapa" width="680" height="440" style="width:340px;height:220px;margin-top:14px;border-radius:6px;background:#2f3a24"></canvas></div>
  <div class="jugador-panel" style="position:static;max-height:none" data-cual="avisos"></div>
  <div class="jugador-panel" style="position:static;max-height:none" data-cual="cronica"></div>`;

const ev = (codigo: string, payload: Record<string, unknown>, horas: number, asentamientoId?: string): EventoDominio =>
  ({ codigo, mensaje: codigo, version: 100 - horas, momento: new Date(AHORA - horas * H).toISOString(), payload, ...(asentamientoId ? { asentamientoId } : {}) }) as EventoDominio;

function pintar(): void {
  const ficha = app.querySelector<HTMLElement>('.mapa-seleccion')!;
  const id = qs.get('ficha') === 'camino' ? 'aeda-1' : 'aeda-2';
  const ctx = { ejecutar: async () => null, ejecutarConDatos: async () => ({ error: null }), repintar: pintar, aviso: () => {}, cerrar: () => {}, escapar: e };
  ficha.innerHTML = FICHA_AEDA.html(p, FICHA_AEDA.buscar(p, id) as never, ctx);
  app.querySelector<HTMLElement>('[data-cual="avisos"]')!.innerHTML = htmlAvisos(historialDeAvisos(), e);
  app.querySelector<HTMLElement>('[data-cual="cronica"]')!.innerHTML = htmlCronica(p, e);
  // el modo mapa: dos plazas y los dos Aedas (uno parado en Micenas, otro de camino)
  const c = app.querySelector<HTMLCanvasElement>('#mapa')!.getContext('2d')!;
  c.setTransform(2, 0, 0, 2, 0, 0);
  c.fillStyle = '#2f3a24'; c.fillRect(0, 0, 340, 220);
  c.strokeStyle = 'rgba(190,160,110,0.5)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(140, 120); c.lineTo(330, 70); c.stroke(); c.setLineDash([]);
  for (const [x, y, col] of [[140, 120, '#1b1a17'], [330, 70, '#4a7fb0']] as const) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#d8b878'; c.lineWidth = 2; c.stroke(); }
  dibujarAedasEnMapa(c, p, 1, 1);
}

// los hechos de los Aedas que llegan a tu Facción, del más viejo al más nuevo
const F = { faccionId: 'fac-1' };
for (const x of [
  ev('aedas.residente_llega', { ...F, aedaResidenteId: 'aeda-r1' }, 30, 'as-1'),
  ev('aedas.epica_empieza', { ...F, aedaResidenteId: 'aeda-r1', tecnologia: 'cria_caballar', capitulo: 0, capitulos: 3 }, 26, 'as-1'),
  ev('aedas.revela', { ...F, descubridoraId: 'fac-2', tecnologia: 'metalurgia_cobre', faltan: [0] }, 9, 'as-1'),
  ev('aedas.revela', { ...F, descubridoraId: 'fac-3', tecnologia: 'escudos_ligeros', faltan: [0] }, 9, 'as-1'),
  ev('aedas.epica_capitulo', { ...F, aedaResidenteId: 'aeda-r1', tecnologia: 'cria_caballar', capitulo: 1, capitulos: 3 }, 5, 'as-1'),
  ev('aedas.venta', { ...F, aedaId: 'aeda-2', tecnologia: 'arqueria_palacial', precio: 400 }, 2, 'as-1'),
  ev('aedas.epica_tecnologia', { ...F, aedaResidenteId: 'aeda-r1', tecnologia: 'cria_caballar', capitulo: 3, capitulos: 3 }, 1, 'as-1'),
]) procesar(x, 'heroe-1', 'recuperado');

// la crónica del mundo
const ent = (tipo: string, datos: Record<string, unknown>, horas: number) => ({ version: 1000 - horas, en: AHORA - horas * H, tipo, datos: { tipo, ...datos } });
fijarCronica([
  ent('fundacion.asentamiento_fundado', { faccionIds: ['fac-1'], asentamientoId: 'as-1' }, 70),
  ent('era.comienza', { era: 'reinos_palaciales', orden: 1 }, 72),
  ent('tecnologia.logro', { contador: 'extraido.cobre', umbral: 12000 }, 40),
  ent('aedas.canta_descubrimiento', { faccionIds: ['fac-2'], tecnologia: 'metalurgia_cobre' }, 33),
  ent('titulo.nace', { faccionIds: ['fac-1'], titulo: 'mecenas' }, 20),
  ent('diplomacia.guerra_declarada', { faccionIds: ['fac-2', 'fac-3'] }, 15),
  ent('asentamiento.conquistada', { faccionIds: ['fac-2', 'fac-3'], asentamientoId: 'as-8' }, 8),
  ent('asentamiento.nivel_subio', { faccionIds: ['fac-2'], asentamientoId: 'as-8', nivel: 4, }, 6),
  ent('aedas.epica_cumplida', { faccionIds: ['fac-1'] }, 1),
], true);

pintar();
catalogoDeTecnologia(pintar);
