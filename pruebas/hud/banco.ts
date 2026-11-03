// Banco del HUD de la plaza en 3D (`/pruebas/hud/`, `?ventana=mercado` para abrir una ventana, `?3d=1` con la escena 3D): la ciudad de nivel 5 del banco 3D con el mismo
// esqueleto que monta `montarAsentamiento` en main.ts (blasón, obras, barra de abajo, riel, minimapa, columna derecha), sin servidor. Sirve para
// mirar la disposición a distintos tamaños de pantalla; los botones no hacen nada.
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
import { htmlBlasonHud, htmlObrasHud, htmlPieDePlaza, ICONO_RIEL } from '../../src/ui/hudPlaza';
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
const p = { heroe: { displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: a.id } }, asentamientos: [a], facciones: [], heroeId: 'h' } as unknown as ProyeccionJugador;

let barra = '';
try { barra = htmlBarraJugador(p, e, '<button type="button" class="jugador-boton-info">?</button>'); } catch { barra = '<header class="jugador-barra"></header>'; }
const riel = RIEL.map(([id, nombre, icono, bloq], i) => `<button type="button" class="asent-riel-boton${id === ventana ? ' activo' : ''}${bloq ? ' bloqueada' : ''}" data-etiqueta="${nombre}">${icono}${i === 0 ? '<b class="asent-riel-insignia">2</b>' : ''}</button>`).join('');
document.getElementById('app')!.innerHTML = `<div class="asent-screen plaza-3d">
  ${barra}
  <div class="asent-cuerpo">
    <div class="asent-centro"><div class="asent-mapa asent-mapa-3d"><div class="ciudad3d-escena"></div></div></div>
    <aside class="asent-izq">
      <div class="asent-blason">${htmlBlasonHud({ nombre: a.nombre ?? 'Pesinunte', faccion: 'Casa de Micenas', escudo: svgSigilo(undefined, 64), nivel: a.nivel, renombrar: true, editando: false, residencia: 'dentro', capital: 'si', abierto: null, ascenso: 'abrir' }, e)}</div>
      <div class="asent-obras-hud">${htmlObrasHud(a, e)}</div>
    </aside>
    <aside class="asent-der"><div class="misiones-rastreador" style="padding:10px;border:1px solid var(--bronce);background:rgba(18,13,8,.9);color:var(--pergamino)">Misiones 3/3</div></aside>
    <div class="asent-pie">${htmlPieDePlaza(a, e)}</div>
    <nav class="asent-riel">${riel}</nav>
    <div class="asent-lienzo asent-minimapa"><canvas id="mapa" width="900" height="900"></canvas></div>
    <header class="asent-barra"><div class="asent-barra-acciones"><button type="button">Ejércitos</button><button class="btn-primary" type="button">Salir al mundo</button></div></header>
    ${ventana ? `<section class="asent-ventana" data-ancho="${ventana === 'mercado' || ventana === 'taberna' ? 'completa' : ventana === 'reclutamiento' ? 'ancha' : ''}"><header class="asent-ventana-cab"><div class="asent-ventana-titulo"><h2>${ventana}</h2></div><button class="asent-ventana-cerrar">✕</button></header><div class="asent-edif-cuerpo">${'<p>Contenido de la ventana.</p>'.repeat(40)}</div></section>` : ''}
  </div>
</div>`;
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
(window as unknown as { __banco: unknown }).__banco = { listo: true };
