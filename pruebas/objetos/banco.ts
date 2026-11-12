// Banco de los objetos fuera de la Base personal (0.206.0, `/pruebas/objetos/`), sin servidor: la ficha de una columna ajena con el equipo puesto
// de cada héroe que va (los siete huecos, motor 457c278) y el panel de Avisos con el botín (`heroe.botin`) y los objetos usados (`heroe.objeto_usado`).
import '../../src/style.css';
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import { bloqueDeDatos, type ProyeccionJugador } from '../../src/apiCliente';
import type { EventoDominio } from '../../src/tiposDominio';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { historialDeAvisos, procesar } from '../../src/ui/avisos';
import { htmlAvisos } from '../../src/ui/panelAvisos';
import { FICHA_COLUMNA_AJENA } from '../../src/ui/interaccionAjena';

const AHORA = Date.parse('2026-11-12T18:00:00Z');
const H = 3_600_000;
const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sinNada = { arma: null, casco: null, torso: null, guantes: null, pantalones: null, botas: null, montura: null };
const p = {
  gameId: 'banco', instante: AHORA, version: 1, heroeId: 'heroe-1', faccionId: 'fac-1',
  heroe: {
    id: 'heroe-1', displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, carro: {},
    escuadrones: [{ id: 'esc-3', nombre: 'Lanceros de mimbre', tropaId: 'milicia_lanceros', nivel: 3, experiencia: 60 }],
  },
  facciones: [{ id: 'fac-1', nombre: 'Casa de Micenas', reyId: 'heroe-1' }, { id: 'fac-2', nombre: 'Reino de Hatti' }],
  asentamientos: [{ id: 'as-1', nombre: 'Micenas', faccionId: 'fac-1', nivel: 3, posicion: { x: 140, y: 120 }, cargos: {} }],
  asentamientosAvistados: [], asentamientosConocidos: [], ejercitos: [], caravanas: [], caravanasAvistadas: [], nombresDeCompaneros: {},
  ejercitosAvistados: [{ id: 'ej-9', tipo: 'personal', faccionId: 'fac-2', posicionActual: { x: 180, y: 130 }, participantes: 2, heroeIds: ['heroe-7', 'heroe-8'], caravanasAdjuntasIds: [] }],
  heroesVisibles: [
    {
      heroeId: 'heroe-7', displayName: 'Muwatalli', classDefinitionId: 'espada_escudo_mediano', nivel: 9, escuadrasQueLleva: [{ tropaId: 'milicia_lanceros', cantidad: 40, nivel: 4 }],
      equipamiento: { ...sinNada, arma: 'espada_escudo_mediano_bronce', casco: 'casco_media_bronce', torso: 'torso_pesada_bronce', botas: 'botas_media_cobre', montura: 'montura_estepa' },
    },
    { heroeId: 'heroe-8', displayName: 'Tudhaliya', classDefinitionId: 'arco_lanza', nivel: 4, escuadrasQueLleva: [], equipamiento: { ...sinNada, arma: 'arco_lanza_cobre' } },
  ],
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const app = document.querySelector<HTMLElement>('#app')!;
app.style.cssText = 'display:grid;grid-template-columns:380px 440px;gap:18px;padding:18px;height:auto;align-items:start;color:var(--pergamino)';
app.innerHTML = `<div class="mapa-seleccion" style="position:static;display:block;max-width:none"></div>
  <div class="jugador-panel" style="position:static;max-height:none" data-cual="avisos"></div>`;

const ev = (codigo: string, payload: Record<string, unknown>, horas: number): EventoDominio =>
  ({ codigo, mensaje: codigo, version: 100 - horas, momento: new Date(AHORA - horas * H).toISOString(), payload }) as EventoDominio;

function pintar(): void {
  const ctx = { ejecutar: async () => null, ejecutarConDatos: async () => ({ error: null }), repintar: pintar, aviso: () => {}, cerrar: () => {}, escapar: e, alcance: () => ({ distancia: null, impide: '' }), verBatalla: () => {} };
  app.querySelector<HTMLElement>('.mapa-seleccion')!.innerHTML = FICHA_COLUMNA_AJENA.html(p, FICHA_COLUMNA_AJENA.buscar(p, 'ej-9') as never, ctx);
  app.querySelector<HTMLElement>('[data-cual="avisos"]')!.innerHTML = htmlAvisos(historialDeAvisos(), e);
}

const banco = { listo: false };
(window as unknown as { __banco: unknown }).__banco = banco;
let avisados = false;
const alLlegar = (): void => {
  if (bloqueDeDatos('OBJETOS', alLlegar) === null) return pintar();
  if (!avisados) {
    avisados = true;
    // los hechos llegan cuando ya están los nombres de los objetos: el texto del aviso se escribe al recibirlo
    for (const x of [
      ev('heroe.botin', { origen: 'diaria', mochila: [['crisol', 1], ['medalla_tropa_pequena', 1], ['medalla_heroe_muy_pequena', 1]], almacen: [], perdido: [] }, 6),
      ev('heroe.botin', { origen: 'unity', mochila: [['casco_ligera_cobre', 1]], almacen: [['plano_2', 2]], perdido: [] }, 4),
      ev('heroe.botin', { origen: 'bandidos', mochila: [], almacen: [], perdido: [['cofre_monturas', 1]] }, 3),
      ev('heroe.objeto_usado', { objeto: 'medalla_tropa_pequena', escuadra: 3 }, 2),
      ev('heroe.objeto_usado', { objeto: 'cofre_monturas', montura: 'montura_escita', destino: 'mochila' }, 1),
    ]) procesar(x, 'heroe-1', 'recuperado');
  }
  pintar();
  banco.listo = true;
};
alLlegar();
