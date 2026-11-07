// Banco de una avanzada por dentro (`/pruebas/avanzadas/`): el mismo esqueleto que monta `montarAvanzada` en main.ts, con la avanzada en 3D
// detrás, sin servidor. `?etapa=1|2|3` (atalaya, fuerte, ciudadela), `&ruinas=1` en ruinas, `&parte=resumen|guarnicion|almacen|tropa` con esa
// ventana abierta, `&gobernador=1` como Gobernador de la madre, `&ficha=1` la ficha del mapa con la columna a la puerta, `&territorio=1` la tarjeta de
// Territorio en la madre. Los botones no hacen nada. `window.banco.mirar(...)` mueve la cámara (capturas).
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import { avanzadaEnVista, svgPlanoAvanzada } from '../../src/ciudad3d/avanzada';
import { encuadreDeSvg, Minimapa } from '../../src/ciudad3d/minimapa';
import { VistaCiudad3D } from '../../src/ciudad3d/vista';
import { bloqueDeDatos, tropasReclutables, type ProyeccionJugador } from '../../src/apiCliente';
import { htmlBarraJugador } from '../../src/ui/barraJugador';
import { htmlBlasonInterior, htmlPlacaDeRecursos, htmlRielInterior, htmlTituloDeParte } from '../../src/ui/hudInterior';
import { almacenDelPie, htmlAvanzadaALaPuerta, htmlParteAvanzada, iconoDeAvanzada, nombreDeEtapa, partesDeAvanzada, type ParteAvanzada } from '../../src/ui/avanzadas';
import { SUBPESTANA_PUEBLOS } from '../../src/ui/pueblos';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { EDIFICIO_NOMBRE } from '../../src/paletas';
import type { Asentamiento, AvanzadaDeMapa } from '../../src/tiposDominio';
import type { ContextoPlaza } from '../../src/ui/ganchos';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const qs = new URLSearchParams(location.search);
const etapa = Math.max(1, Math.min(3, Number(qs.get('etapa') ?? 2)));
const ruinas = qs.get('ruinas') === '1';
const parte = qs.get('parte') as ParteAvanzada | null;
const gobernador = qs.get('gobernador') === '1';

const madre = { id: 'as-1', nombre: 'Tirinto', faccionId: 'f-1', posicion: { x: 500, y: 500 }, nivel: 3, nivelActual: 3, edificios: [
  { id: 'e1', tipo: 'barracon', estado: 'activo', nivelInterno: 2, posicion: { x: 0, y: 0 } }, { id: 'e2', tipo: 'galeriaDeTiro', estado: 'activo', nivelInterno: 1, posicion: { x: 0, y: 0 } },
], cargos: { gobernadorId: gobernador ? 'h' : 'h2' } } as unknown as Asentamiento;
const capacidad = etapa === 1 ? {} : Object.fromEntries(['madera', 'piedra', 'trigo', 'bronce', 'oro'].map((r) => [r, etapa === 2 ? 4000 : 20000]));
const x: AvanzadaDeMapa = {
  id: 'av-7', madreId: madre.id, etapa, posicion: { x: 540, y: 480 }, enRuinas: ruinas, propia: true,
  invulnerableHasta: ruinas ? Date.now() + 9 * 3_600_000 : undefined,
  almacen: etapa === 1 ? {} : { madera: 1240, piedra: 3800, trigo: 620, bronce: 40, oro: 0 }, capacidad,
  guarnicionSerieIds: etapa === 1 ? ['s-a'] : etapa === 2 ? ['s-a', 's-b', 's-c', 's-d'] : ['s-a', 's-b', 's-c', 's-d', 's-e', 's-f', 's-g', 's-h'],
  guarnicionJugadoresIds: ['g1', 'g2', 'g3'], tropaPorEscalon: etapa === 2 ? { 3: 'arqueros' } : {},
};
const escuadrones = [
  { id: 'g1', nombre: 'Lanceros de Tirinto', tropaId: 'lanceros', cantidad: 30, nivel: 2, costeLiderazgo: 6, contenedor: { tipo: 'avanzada', avanzadaId: x.id } },
  { id: 's1', nombre: 'Honderos', tropaId: 'honderos', cantidad: 25, nivel: 1, costeLiderazgo: 4, contenedor: { tipo: 'ejercito', ejercitoId: 'ej-1' } },
  { id: 's2', nombre: 'Escudados', tropaId: 'escudados', cantidad: 30, nivel: 1, costeLiderazgo: 8, contenedor: { tipo: 'ejercito', ejercitoId: 'ej-1' } },
];
const columna = { id: 'ej-1', liderId: 'h', participantes: [{ heroeId: 'h' }], posicionActual: qs.get('ficha') === '1' ? { x: 541, y: 480.5 } : x.posicion, suministro: { madera: 180, trigo: 90 }, capacidadCarga: 400 };
const p = {
  instante: Date.now(), heroeId: 'h', faccionId: 'f-1', avanzadas: [x], asentamientos: qs.get('territorio') === '1' ? [madre] : [], asentamientosAvistados: [], asentamientosConocidos: [{ asentamientoId: madre.id, nombre: madre.nombre, faccionId: 'f-1', posicion: madre.posicion, nivel: 3, conocidoEn: 0 }],
  facciones: [{ id: 'f-1', nombre: 'Argólide', miembros: [{ heroeId: 'h', cargos: gobernador ? [`gobernador@${madre.id}`] : [] }] }], relaciones: [],
  heroe: { id: 'h', displayName: 'Víctor', ubicacion: qs.get('ficha') === '1' || qs.get('territorio') === '1' ? { tipo: 'columna', ejercitoId: 'ej-1' } : { tipo: 'avanzada', avanzadaId: x.id }, residenciaId: madre.id, viveres: 140, escuadrones, loadouts: [] },
  ejercitos: [columna], caravanas: [], obrasDeMapa: [], pueblos: [], tecnologiasAdoptadas: ['lanzas', 'arcos', 'escudos', 'hondas'],
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const app = document.getElementById('app')!;

function pintarFicha(): void {
  app.innerHTML = `<div class="mapa-screen" style="padding:24px"><div class="mapa-seleccion" style="position:static;max-width:380px">
    <span class="faction-kicker">Avanzada de tu Facción</span><h3>${e(nombreDeEtapa(x.etapa))}</h3><p class="asent-lado-nota">De ${e(madre.nombre!)}.</p>
    ${htmlAvanzadaALaPuerta(p, x, e)}</div></div>`;
}

function pintarTerritorio(): void {
  const cuerpo = document.createElement('div');
  const c = { proyeccion: p, asentamiento: madre, cuerpo, ejecutar: async () => null, refrescar: () => pintarTerritorio(), cargo: gobernador ? 'gobernador' : 'maestroObras', resideAqui: true, escapar: e } as unknown as ContextoPlaza;
  app.innerHTML = `<div style="background:#1a140d;height:100vh;overflow:auto;padding:20px;box-sizing:border-box"><div class="asent-edif-cuerpo" style="width:1150px;margin:0 auto"></div></div>`;
  const dentro = app.querySelector<HTMLElement>('.asent-edif-cuerpo')!;
  dentro.innerHTML = SUBPESTANA_PUEBLOS.html(c);
}

let vista: VistaCiudad3D | null = null;
function pintarDentro(): void {
  app.innerHTML = `<div class="asent-screen avanzada-screen plaza-3d">
    ${htmlBarraJugador(p, e)}
    <div class="asent-cuerpo">
      <div class="asent-centro"><div class="asent-mapa avanzada-mapa asent-mapa-3d"><div class="ciudad3d-escena"></div></div></div>
      <aside class="asent-izq"><div class="asent-blason"></div></aside>
      <aside class="asent-der"></aside>
      <p class="pueblo-aviso-batalla" hidden>La están atacando: si sigues dentro, defiendes.</p>
      <div class="asent-pie avanzada-almacen" hidden></div>
      <nav class="asent-riel" aria-label="Partes de la avanzada"></nav>
      <div class="asent-lienzo asent-minimapa avanzada-mini"><div class="avanzada-plano"></div></div>
      <header class="asent-barra"><div class="asent-barra-acciones"><button class="btn-primary" type="button">Salir al mundo</button></div></header>
      <section class="asent-ventana" role="dialog" hidden>
        <header class="asent-ventana-cab"><div class="asent-ventana-titulo"></div><button class="asent-ventana-cerrar" type="button">✕</button></header>
        <div class="asent-edif-cuerpo avanzada-lado"></div>
      </section>
    </div>
  </div>`;
  const ciudad = avanzadaEnVista(x, { instante: p.instante })!;
  const plano = app.querySelector<HTMLElement>('.avanzada-plano')!;
  plano.innerHTML = svgPlanoAvanzada(ciudad, (t) => EDIFICIO_NOMBRE[t] ?? t);
  const minimapa = new Minimapa(plano);
  vista = new VistaCiudad3D(app.querySelector<HTMLElement>('.ciudad3d-escena')!, { alElegir: () => {}, alPasar: () => {}, alMover: (h) => minimapa.fijarHuella(h) });
  vista.fijar(ciudad);
  vista.fijarSuelo(0x7d8a4e);
  const encuadre = encuadreDeSvg(plano.querySelector('svg'));
  if (encuadre) minimapa.fijarEncuadre(encuadre);
  app.querySelector<HTMLElement>('.asent-blason')!.innerHTML = htmlBlasonInterior({
    icono: iconoDeAvanzada(x.etapa, 46), nombre: nombreDeEtapa(x.etapa), lineas: [`De ${madre.nombre}`, x.enRuinas ? 'En ruinas' : 'De tu Facción'],
  }, e);
  const pie = almacenDelPie(x);
  const almacen = app.querySelector<HTMLElement>('.avanzada-almacen')!;
  almacen.hidden = !pie;
  if (pie) almacen.innerHTML = htmlPlacaDeRecursos('almacen', 'Almacén', pie.recursos, e, pie.capacidad);
  const partes = partesDeAvanzada(x);
  app.querySelector<HTMLElement>('.asent-riel')!.innerHTML = htmlRielInterior(partes.map(([id, t]) => ({ id, titulo: t })), parte, e);
  if (parte) {
    const ventana = app.querySelector<HTMLElement>('.asent-ventana')!;
    ventana.hidden = false;
    ventana.dataset.ancho = 'normal';
    ventana.querySelector<HTMLElement>('.asent-ventana-titulo')!.innerHTML = htmlTituloDeParte(parte, partes.find(([id]) => id === parte)?.[1] ?? parte, e);
    ventana.querySelector<HTMLElement>('.avanzada-lado')!.innerHTML = htmlParteAvanzada(p, x, parte, e);
  }
}

function pintarTodo(): void {
  (p as unknown as { tecnologiasAdoptadas: string[] }).tecnologiasAdoptadas = (tropasReclutables() ?? []).map((t) => t.tecnologia);
  if (qs.get('ficha') === '1') pintarFicha();
  else if (qs.get('territorio') === '1') pintarTerritorio();
  else if (!vista) pintarDentro();
  else if (parte) app.querySelector<HTMLElement>('.avanzada-lado')!.innerHTML = htmlParteAvanzada(p, x, parte, e);
}
// el balance llega en segundo plano: se repinta cuando están las tropas y las reglas
const listo = (): boolean => Boolean(tropasReclutables(pintarTodo) && bloqueDeDatos('AVANZADA', pintarTodo));
listo();
pintarTodo();
(window as unknown as { banco: unknown }).banco = {
  mirar(o: { x?: number; y?: number; distancia?: number; giro?: number; inclinacion?: number }) {
    const pedido = (vista as unknown as { camara: { pedido: Record<string, number> } } | null)?.camara.pedido;
    if (pedido) Object.assign(pedido, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
  },
};
