// Banco del HUD de la plaza en 3D (`/pruebas/hud/`, `?ventana=mercado` para abrir una ventana, `?construir=1` con el cajón de Construcción en el
// sitio del riel, `?ficha=mejora|activo|obra` con la ficha de un edificio, `?3d=1` con la escena 3D): la ciudad de nivel 5 del banco 3D con el mismo
// esqueleto que monta `montarAsentamiento` en main.ts (blasón, obras, barra de abajo, riel, minimapa, columna derecha), sin servidor. Sirve para
// mirar la disposición a distintos tamaños de pantalla; los botones no hacen nada.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { fromBinary } from '@bufbuild/protobuf';
import { AsentamientoSchema } from '../../src/contrato/gen/bronzeage/v1/entities_pb';
import { ciudadEnVista } from '../../src/ciudad3d/estado';
import { Minimapa } from '../../src/ciudad3d/minimapa';
import { VistaCiudad3D } from '../../src/ciudad3d/vista';
import { plazaDeContrato } from '../../src/motor/proyeccion';
import { pintarAsentamiento } from '../../src/render';
import { svgSigilo } from '../../src/sigilo/sigilo';
import { htmlBarraJugador } from '../../src/ui/barraJugador';
import { cablearEleccionBarra, htmlBlasonHud, htmlEleccionBarra, htmlObrasHud, htmlPieDePlaza, ICONO_RIEL, vigilarPieArriba } from '../../src/ui/hudPlaza';
import { cablearProduccionYRecetas, cablearVistaCiudad, elegirEdificio, htmlExtraccion, htmlRecetas, repintarFicha } from '../../src/ui/vistaCiudad';
import { cablearPanelObras, htmlConstruir } from '../../src/ui/panelObras';
import { htmlAutoConstruccion } from '../../src/ui/panelCentro';
import { bloqueDeDatos, nivelesDeEdificio } from '../../src/apiCliente';
import type { Edificio } from '../../src/tiposDominio';
import { estadoCliente } from '../../src/ui/estadoCliente';
import type { ContextoPlaza } from '../../src/ui/ganchos';
import { iconoEdificio } from '../../src/ui/iconosEdificio';
import type { ProyeccionJugador } from '../../src/apiCliente';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const RIEL: [string, string, string, boolean?][] = [
  ['construccion', 'Construcción', ICONO_RIEL.construccion], ['gobierno', 'Gobierno', ICONO_RIEL.gobierno], ['defensa', 'Defensa', iconoEdificio('muralla', 28)],
  ['territorio', 'Territorio', ICONO_RIEL.territorio], ['reclutamiento', 'Reclutamiento', iconoEdificio('barracon', 28)],
  ['taberna', 'Taberna', iconoEdificio('taberna', 28), true], ['mercado', 'Mercado', iconoEdificio('mercado', 28)],
];
const ventana = new URLSearchParams(location.search).get('ventana');

const binario = new Uint8Array(await (await fetch(new URL('../ciudad3d/ciudades/ciudad.bin', import.meta.url).href)).arrayBuffer());
const { asentamiento: a, trazado } = plazaDeContrato(fromBinary(AsentamientoSchema, binario), 16 * 24 * 3_600_000);
a.cargos = { ...(a.cargos ?? {}), gobernadorId: 'h' } as typeof a.cargos;
// el «ahora» del banco: un rato antes de que acabe la primera obra en marcha (los tiempos de la ciudad del banco son de su día)
const finesDeObra = (a.edificios ?? []).flatMap((x) => [x.mejora?.completaEn, x.estado === 'en_construccion' ? x.completaEn : undefined]).filter((x): x is number => typeof x === 'number');
const p = { instante: finesDeObra.length ? Math.min(...finesDeObra) - 50 * 60_000 : Date.now(), heroe: { displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: a.id } }, asentamientos: [a], facciones: [], heroeId: 'h' } as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;
const construir = new URLSearchParams(location.search).get('construir');

let barra = '';
try { barra = htmlBarraJugador(p, e, '<button type="button" class="jugador-boton-info">?</button>'); } catch { barra = '<header class="jugador-barra"></header>'; }
const riel = RIEL.filter(([, , , bloq]) => !bloq).map(([id, nombre, icono], i) => `<button type="button" class="asent-riel-boton${id === ventana ? ' activo' : ''}" data-etiqueta="${nombre}">${icono}${i === 0 ? '<b class="asent-riel-insignia">2</b>' : ''}</button>`).join('');
// el cajón de Construcción, como `htmlCajonConstruir` de main.ts
const cajon = (): string => `<div class="cajon-construir"><div class="cajon-construir-cab"><button type="button" class="cajon-volver">← Volver</button><h2>${ICONO_RIEL.construccion}<span>Construcción</span></h2>${htmlAutoConstruccion(a)}</div><div class="cajon-construir-cuerpo">${htmlConstruir(a, 'gobernador', e)}</div></div>`;
document.getElementById('app')!.innerHTML = `<div class="asent-screen plaza-3d${construir ? ' construyendo' : ''}">
  ${barra}
  <div class="asent-cuerpo">
    <div class="asent-centro"><div class="asent-mapa asent-mapa-3d"><div class="ciudad3d-escena"></div></div></div>
    <aside class="asent-izq">
      <div class="asent-blason">${htmlBlasonHud({ nombre: a.nombre ?? 'Pesinunte', faccion: 'Casa de Micenas', escudo: svgSigilo(undefined, 64), nivel: a.nivel, renombrar: true, editando: false, residencia: 'dentro', capital: 'si', abierto: null, ascenso: 'abrir' }, e)}</div>
      <div class="asent-obras-hud">${htmlObrasHud(a, e, true)}</div>
    </aside>
    <aside class="asent-der">${new URLSearchParams(location.search).get('ficha') ? '' : '<div class="misiones-rastreador" style="padding:10px;border:1px solid var(--bronce);background:rgba(18,13,8,.9);color:var(--pergamino)">Misiones 3/3</div>'}</aside>
    <div class="asent-pie">${htmlPieDePlaza(a, e)}</div>
    <nav class="asent-riel${construir ? ' asent-riel-cajon' : ''}">${construir ? '' : riel}</nav>
    <div class="asent-lienzo asent-minimapa"><canvas id="mapa" width="900" height="900"></canvas></div>
    <header class="asent-barra"><div class="asent-barra-acciones"><button class="btn-primary" type="button">Salir al mundo</button></div></header>
    ${ventana ? `<section class="asent-ventana" data-ancho="${ventana === 'mercado' || ventana === 'taberna' || ventana === 'almacen' ? 'completa' : ventana === 'reclutamiento' ? 'ancha' : ''}"><header class="asent-ventana-cab"><div class="asent-ventana-titulo"><h2>${ventana}</h2></div><button class="asent-ventana-cerrar">✕</button></header><div class="asent-edif-cuerpo">${ventana === 'almacen' ? '' : '<p>Contenido de la ventana.</p>'.repeat(40)}</div></section>` : ''}
  </div>
</div>`;
vigilarPieArriba(document.querySelector<HTMLElement>('.plaza-3d'));
const escena = document.querySelector<HTMLElement>('.ciudad3d-escena')!;
const lienzo = document.getElementById('mapa') as HTMLCanvasElement;
const minimapa = new Minimapa(lienzo);
// Con `?3d=1`, la ciudad en 3D; sin ello, una imagen de fondo (`?fondo=<url>`) o un degradado: con WebGL por software (Playwright en la nube) la
// escena 3D deja la página sin responder y no se puede fotografiar.
const qs = new URLSearchParams(location.search);
if (qs.get('3d')) {
  const vista = new VistaCiudad3D(escena, { alElegir: () => {}, alMover: (h) => minimapa.fijarHuella(h) });
  vista.fijar(ciudadEnVista(a, trazado, { instante: 16 * 24 * 3_600_000 }));
} else {
  escena.style.cssText = `position:absolute;inset:0;background:${qs.get('fondo') ? `url("${qs.get('fondo')}") center/cover` : 'radial-gradient(circle at 50% 45%, #6f8a4a, #2f3d22)'}`;
}
pintarAsentamiento(lienzo.getContext('2d')!, a, trazado, null, null, true);
minimapa.fijarTrazado(trazado);
// `?ventana=almacen`: la ventana del Almacén de verdad (elección de la barra, almacén, extracción y talleres), con la barra repintándose.
function pintarAlmacen(): void {
  const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo');
  const pie = document.querySelector<HTMLElement>('.asent-pie')!;
  pie.innerHTML = htmlPieDePlaza(a, e);
  if (ventana !== 'almacen' || !cuerpo) return;
  const c = { proyeccion: p, asentamiento: a, cuerpo, ejecutar: async () => null, refrescar: pintarAlmacen, cargo: 'gobernador', resideAqui: true, escapar: e } as unknown as ContextoPlaza;
  cuerpo.innerHTML = `<div class="cols-completa"><div class="col-completa">${htmlEleccionBarra(a, e)}${htmlExtraccion(c)}</div><div class="col-completa">${htmlRecetas(c)}</div></div>`;
  cablearEleccionBarra(cuerpo, pintarAlmacen, (m) => alert(m));
  cablearProduccionYRecetas(c);
}
pintarAlmacen();
// `?construir=1`: el cajón, repintado cuando llega el catálogo y al cambiar de pestaña
function pintarCajon(): void {
  const nav = document.querySelector<HTMLElement>('.asent-riel')!;
  nav.innerHTML = cajon();
  cablearPanelObras(nav, pintarCajon);
}
// `?ficha=…`: la ficha de verdad (`cablearVistaCiudad` + `elegirEdificio`) de un edificio mejorándose, uno activo que se puede mejorar o una obra
const ficha = qs.get('ficha');
if (ficha) {
  cablearVistaCiudad(document.querySelector<HTMLElement>('.asent-cuerpo')!, { proyeccion: () => p, ejecutar: async () => null, escapar: e, redibujar: () => {}, repintarLista: () => {} });
}
const elegirParaFicha = (): void => {
  if (!ficha) return;
  const conSiguiente = (x: Edificio): boolean => Boolean(nivelesDeEdificio(x.tipo)?.[String((x.nivelInterno ?? 1) + 1)]);
  const elegido = (a.edificios ?? []).find((x) => (ficha === 'obra' ? x.estado === 'en_construccion' : x.estado === 'activo' && !x.mejora && x.tipo !== 'centroUrbano' && conSiguiente(x)));
  if (!elegido) return;
  // `?ficha=mejora`: la ciudad del banco no trae mejoras en marcha; se le pone una a ese edificio, a medias
  if (ficha === 'mejora') elegido.mejora = { nivelObjetivo: (elegido.nivelInterno ?? 1) + 1, completaEn: p.instante + 35 * 60_000 };
  elegirEdificio(elegido.id);
  pintarObras();
};
const pintarObras = (): void => { document.querySelector<HTMLElement>('.asent-obras-hud')!.innerHTML = htmlObrasHud(a, e, true); };
const alCargar = (): void => { if (bloqueDeDatos('EDIFICIO_CATALOGO', alCargar)) { pintarObras(); if (construir) pintarCajon(); elegirParaFicha(); repintarFicha(); } };
alCargar();
(window as unknown as { __banco: unknown }).__banco = { listo: true };
