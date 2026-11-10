// Banco de la ficha de una plaza ajena en el mapa (`/pruebas/fichaPlaza/`), con su protección (Víctor, 2026-11-10; `ui/proteccionPlaza.ts`). La
// ficha de verdad la pinta `renderSeleccionMapa` en main.ts; aquí va la misma caja (`.mapa-seleccion`) con sus filas, la de la protección y el
// botón Atacar apagado con su motivo, sin servidor. `?horas=N` le quedan N horas (18 de serie); `&sin=1` ya no está protegida.
// `?informe=gana|pierde|asedio`: la ventana del informe de un combate entre jugadores (`ui/informeCombate.ts`), como la abre main.ts.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { htmlAccionesPuerta } from '../../src/ui/accionesPuerta';
import { htmlFilaProteccion, motivoProtegida, minutosDeProteccion } from '../../src/ui/proteccionPlaza';
import { htmlInforme, informeDeEvento } from '../../src/ui/informeCombate';
import type { ProyeccionJugador } from '../../src/apiCliente';
import type { EventoDominio } from '../../src/tiposDominio';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const qs = new URLSearchParams(location.search);
const ahora = 1_000_000_000;
const horas = qs.get('sin') ? -1 : Number(qs.get('horas') ?? 18);
// recién fundada hace (24 − horas) horas: de una ajena solo llega la fundación
const plaza = { fundadoEn: ahora - (minutosDeProteccion() - horas * 60) * 60_000 };

function pintar(): void {
  const motivo = motivoProtegida(plaza, ahora, pintar) || 'Acércate: estás a 4 y se ataca a 1.';
  document.getElementById('app')!.innerHTML = `<div class="mapa-screen" style="padding:24px"><div class="mapa-seleccion" style="position:static;max-width:300px">
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Asentamiento</span>
    <h3>Siquem</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Facción</span><strong>Casa de Amenofis 6</strong></div>
      <div><span>Nivel</span><strong>1</strong></div>
      <div><span>Muralla</span><strong>No</strong></div>
      <div><span>Mercado</span><strong>No</strong></div>
      ${htmlFilaProteccion(plaza, ahora, e, pintar)}
      <div><span>Distancia</span><strong>4</strong></div>
      <div><span>Tiempo hasta allí</span><strong>~16 s</strong></div>
    </div>
    ${htmlAccionesPuerta([{ id: 'marchar', etiqueta: 'Marchar aquí', icono: '➜' }, { id: 'atacar', etiqueta: 'Atacar', icono: '⚔', principal: true, motivo }, { id: 'inspeccionar', etiqueta: 'Inspeccionar', icono: '👁' }], e)}
    <p class="mapa-lista-vacia">Un ejército solo entra entero en una plaza de su Facción.</p>
    <p class="mapa-lista-vacia">${e(motivo)}</p>
  </div></div>`;
}
function pintarInforme(cual: string): void {
  const p = {
    heroeId: cual === 'pierde' ? 'h2' : 'h1', faccionId: cual === 'pierde' ? 'f-2' : 'f-1', heroe: { displayName: cual === 'pierde' ? 'Ahiram' : 'Rhino', escuadrones: [], residenciaId: 'as-7' },
    facciones: [{ id: 'f-1', nombre: 'PlayaNueva' }], directorioFacciones: [{ id: 'f-2', nombre: 'Casa de Amenofis 6' }],
    ejercitos: [{ id: 'ej-1', participantes: [{ heroeId: 'h1' }] }, { id: 'ej-2', participantes: [{ heroeId: 'h2' }] }],
    asentamientos: [], asentamientosAvistados: [{ id: 'as-7', nombre: 'Siquem' }], nombresDeCompaneros: { h1: 'Rhino', h2: 'Ahiram' }, heroesVisibles: [],
  } as unknown as ProyeccionJugador;
  const ev = cual === 'asedio'
    ? { codigo: 'combate.asedio_resistido', version: 41, heroesIds: ['h2'], asentamientoId: 'as-7', momento: new Date().toISOString(), payload: { faccionAtacanteId: 'f-2', faccionDefensoraId: 'f-1', poderAtacante: 54_200, poderDefensor: 91_800, bajasAtacante: 23, bajasDefensor: 6, heridos: 1, botin: 0 } }
    : { codigo: 'combate.resuelto', version: 40, heroesIds: ['h1', 'h2'], momento: new Date().toISOString(), payload: { ejercitoId: 'ej-1', ganaElAtacante: 1, poderAtacante: 120_500, poderDefensor: 80_300, bajasAtacante: 12, bajasDefensor: 31, heridos: 1, robado: 42_000, chatarra: 9_000, botin: 51_000, ejercitoBId: 'ej-2', faccionAId: 'f-1', faccionBId: 'f-2' } };
  const i = informeDeEvento(ev as unknown as EventoDominio, p.heroeId, p)!;
  document.getElementById('app')!.innerHTML = `<div class="mapa-screen" style="height:100vh"></div><div class="briefing-fondo"><section class="briefing" role="dialog" aria-label="Informe de combate"><button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar informe">×</button>${htmlInforme(i, p, e)}</section></div>`;
}

const informe = qs.get('informe');
if (informe) pintarInforme(informe); else pintar();
