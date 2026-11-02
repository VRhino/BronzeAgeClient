// Banco del panel derecho de la plaza (`/pruebas/centro/`): la subida de nivel, el Resumen (con la Residencia al pie), los Cargos, Reclutamiento, Taberna y Mercado (Órdenes, Caravanas y Trueques), con una plaza de mentira y
// sin servidor. Los datos de juego son los bloques de Docs/Mechanics del motor (`../plaza/datos.json`, como `GET /v1/datos`). Las órdenes no
// salen: se anotan en `window.__banco.enviadas`.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { bloqueDeDatos } from '../../src/apiCliente';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { cablearPlegables } from '../../src/ui/plegable';
import { cablearCargosPlaza, cablearResumenPlaza, htmlAscensoPlaza, htmlCargosPlaza, htmlResumenPlaza } from '../../src/ui/panelCentro';
import { htmlResidentesPlaza } from '../../src/ui/participacion';
import { SUBPESTANA_RESIDENCIA } from '../../src/ui/panelResidencia';
import { cablearReclutamiento, htmlReclutamiento } from '../../src/ui/reclutamiento';
import { cablearPanelIntel, renderPanelIntel } from '../../src/ui/panelIntel';
import { tarifasDeIntel } from '../../src/apiCliente';
import { cablearCaravanas, cablearOrdenes, htmlCaravanas, htmlOrdenes } from '../../src/ui/panelMercado';
import { SUBPESTANA_TRUEQUES } from '../../src/ui/panelTrueques';
import { escena, type Escena } from './datos-escena';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const banco = { enviadas: [] as [string, object][], listo: false };
(window as unknown as { __banco: typeof banco }).__banco = banco;
let esc: Escena = 'gobernador';
let sub = 'resumen';
const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo')!;

function ver(): void {
  const { p, a } = escena(esc);
  estadoCliente.proyeccionUltima = p;
  const reside = [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
  const cargo = a.cargos?.gobernadorId === p.heroeId ? 'gobernador' as const : null;
  const ctx = { proyeccion: p, asentamiento: a, cuerpo, ejecutar: async (t: string, x: object) => { banco.enviadas.push([t, x]); return null; }, refrescar: ver, cargo, resideAqui: reside, escapar: e };
  const ascenso = htmlAscensoPlaza(p, a, cargo === 'gobernador', e, ver);
  (p as unknown as { tarifasIntel: unknown }).tarifasIntel = tarifasDeIntel();
  if (sub === 'reclutamiento' || sub === 'taberna') {
    const ejecutar = ctx.ejecutar;
    cuerpo.innerHTML = sub === 'reclutamiento' ? `<div class="asent-lado-cuerpo">${htmlReclutamiento(p, a, e, ver)}</div>` : renderPanelIntel(p, e);
    if (sub === 'reclutamiento') cablearReclutamiento(cuerpo, p, a, ejecutar, ver); else cablearPanelIntel(cuerpo, p, ejecutar, ver);
    return;
  }
  if (sub === 'ordenes' || sub === 'caravanas' || sub === 'trueques') {
    const tabs = `<div class="asent-tabs asent-subtabs">${[['ordenes', 'Órdenes'], ['caravanas', 'Caravanas'], ['trueques', 'Trueques']].map(([id, n]) => `<button class="asent-tab${id === sub ? ' activo' : ''}" type="button">${n}</button>`).join('')}</div>`;
    const contenido = sub === 'ordenes' ? htmlOrdenes(p, a, e) : sub === 'caravanas' ? htmlCaravanas(p, a, e, ver) : SUBPESTANA_TRUEQUES.html(ctx);
    cuerpo.innerHTML = `${tabs}<div class="asent-lado-cuerpo">${contenido}</div>`;
    cablearPlegables(cuerpo);
    if (sub === 'ordenes') cablearOrdenes(cuerpo, a, ctx.ejecutar); else if (sub === 'caravanas') cablearCaravanas(cuerpo, p, a, ctx.ejecutar, ver); else SUBPESTANA_TRUEQUES.cablear?.(ctx);
    return;
  }
  const contenido = sub === 'resumen'
    ? htmlResumenPlaza(ctx) + `<div class="asent-resumen-residencia">${SUBPESTANA_RESIDENCIA.html(ctx)}</div>`
    : htmlCargosPlaza(ctx, htmlResidentesPlaza(p, a, e));
  const tabs = `<div class="asent-tabs asent-subtabs">${[['resumen', 'Resumen'], ['edificios', 'Edificios'], ['cargos', 'Cargos'], ['muralla', 'Muralla'], ['puerta', 'Puerta']].map(([id, n]) => `<button class="asent-tab${id === sub ? ' activo' : ''}" type="button">${n}</button>`).join('')}</div>`;
  cuerpo.innerHTML = `${ascenso ? `<section class="asent-ascenso">${ascenso}</section>` : ''}${tabs}<div class="asent-lado-cuerpo">${contenido}</div>`;
  cablearPlegables(cuerpo);
  if (sub === 'resumen') { cablearResumenPlaza(ctx); SUBPESTANA_RESIDENCIA.cablear?.(ctx); } else cablearCargosPlaza(ctx);
}
document.querySelectorAll<HTMLButtonElement>('[data-escena]').forEach((b) => b.addEventListener('click', () => { esc = b.dataset.escena as Escena; ver(); }));
document.querySelectorAll<HTMLButtonElement>('#mandos [data-sub]').forEach((b) => b.addEventListener('click', () => { sub = b.dataset.sub!; ver(); }));
const esperar = (): void => { if (bloqueDeDatos('NIVEL_ASENTAMIENTO', esperar) && bloqueDeDatos('ASCENSO_ASENTAMIENTO', esperar) && bloqueDeDatos('EDIFICIO_CATALOGO', esperar)) { ver(); banco.listo = true; } };
esperar();
