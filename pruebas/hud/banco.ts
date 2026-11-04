// Banco del HUD de la plaza en 3D (`/pruebas/hud/`, `?ventana=mercado` para abrir una ventana, `?construir=1` con el cajón de Construcción en el
// sitio del riel, `?ficha=mejora|activo|obra` con la ficha de un edificio, `?3d=1` con la escena 3D): la ciudad de nivel 5 del banco 3D con el mismo
// esqueleto que monta `montarAsentamiento` en main.ts (blasón, obras, barra de abajo, riel, minimapa, columna derecha), sin servidor. Sirve para
// mirar la disposición a distintos tamaños de pantalla; los botones no hacen nada. `?camp=resumen|tropa|mercado|mercenarios|taberna` pinta
// en su lugar el riel y la ventana del campamento de mercenarios al empezar la partida (`&faccion=1` con Facción, `&tablon=1` con ofertas).
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
import { cablearCaravanas, cablearRutas, htmlCaravanas, htmlRutas } from '../../src/ui/panelMercado';
import { SUBPESTANA_GUARNICION } from '../../src/ui/panelGuarnicion';
import { FICHA_OBRA } from '../../src/ui/pueblos';
import { ahora as ahoraJuego } from '../../src/ui/juegoVisual';
import { cablearTesoreria, htmlReservaRecursos } from '../../src/ui/panelTesoreria';
import { htmlAutoConstruccion } from '../../src/ui/panelCentro';
import { bloqueDeDatos, nivelesDeEdificio } from '../../src/apiCliente';
import type { Edificio } from '../../src/tiposDominio';
import { estadoCliente } from '../../src/ui/estadoCliente';
import type { ContextoPlaza } from '../../src/ui/ganchos';
import { iconoEdificio } from '../../src/ui/iconosEdificio';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { anchoDeParteCampamento, htmlSeccionCampamento, seccionesDeCampamento, type SeccionCampamento } from '../../src/ui/pantallaCampamento';
import { htmlRielInterior, htmlTituloDeParte } from '../../src/ui/hudInterior';
import type { CampamentoMercenarios } from '../../src/tiposDominio';
import { fundacionLista } from '../../src/ui/panelFundacionDePlaza';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const RIEL: [string, string, string, boolean?][] = [
  ['construccion', 'Construcción', ICONO_RIEL.construccion], ['gobierno', 'Gobierno', ICONO_RIEL.gobierno], ['defensa', 'Defensa', iconoEdificio('muralla', 28)],
  ['territorio', 'Territorio', ICONO_RIEL.territorio], ['reclutamiento', 'Reclutamiento', iconoEdificio('barracon', 28)],
  ['taberna', 'Taberna', iconoEdificio('taberna', 28), true], ['mercado', 'Mercado', iconoEdificio('mercado', 28)],
];
const ventana = new URLSearchParams(location.search).get('ventana');
// `?obrasMapa=1`: «Obras» del panel izquierdo con una aldea esperando materiales y un pueblo levantándose (0.149.0).
const obrasMapa = (): never[] => new URLSearchParams(location.search).get('obrasMapa') ? [
  { id: 'obra-7', tipo: 'aldea', madreId: a.id, propia: true, posicion: a.posicion, requerido: { madera: 300, trigo: 200 }, entregado: { madera: 300, trigo: 40 } },
  { id: 'obra-8', tipo: 'pueblo', madreId: a.id, propia: true, posicion: a.posicion, requerido: { madera: 400 }, entregado: { madera: 400 }, terminaEn: ahoraJuego() + 26 * 60_000 },
] as never[] : [];

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
      <div class="asent-blason">${htmlBlasonHud({ nombre: a.nombre ?? 'Pesinunte', faccion: 'Casa de Micenas', escudo: svgSigilo(undefined, 64), nivel: a.nivel, renombrar: true, editando: false, residencia: 'dentro', capital: 'si', abierto: null, ascenso: new URLSearchParams(location.search).get('ascenso') === 'listo' ? 'listo' : 'abrir' }, e)}</div>
      <div class="asent-obras-hud">${htmlObrasHud(a, e, true, obrasMapa())}</div>
    </aside>
    <aside class="asent-der">${new URLSearchParams(location.search).get('ficha') ? '' : '<div class="misiones-rastreador" style="padding:10px;border:1px solid var(--bronce);background:rgba(18,13,8,.9);color:var(--pergamino)">Misiones 3/3</div>'}</aside>
    <div class="asent-pie">${htmlPieDePlaza(a, e)}</div>
    <nav class="asent-riel${construir ? ' asent-riel-cajon' : ''}">${construir ? '' : riel}</nav>
    <div class="asent-lienzo asent-minimapa"><canvas id="mapa" width="900" height="900"></canvas></div>
    <header class="asent-barra"><div class="asent-barra-acciones"><button id="btn-salir-mundo" class="btn-primary" type="button">Salir al mundo</button></div></header>
    ${ventana ? `<section class="asent-ventana" data-ancho="${ventana === 'mercado' || ventana === 'taberna' || ventana === 'almacen' || ventana === 'caravanas' ? 'completa' : ventana === 'reclutamiento' ? 'ancha' : ''}"><header class="asent-ventana-cab"><div class="asent-ventana-titulo"><h2>${ventana}</h2></div><button class="asent-ventana-cerrar">✕</button></header><div class="asent-edif-cuerpo">${ventana === 'almacen' || ventana === 'caravanas' ? '' : '<p>Contenido de la ventana.</p>'.repeat(40)}</div></section>` : ''}
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
// `?ventana=almacen`: la ventana del Almacén de verdad (elección de la barra, almacén, extracción, reserva y talleres), con la barra repintándose.
// `&tesorero=1`: el héroe es el Tesorero, en la plaza, y calibra la reserva (0.147.0: la reserva pasó de Gobierno al Almacén).
function pintarAlmacen(): void {
  const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo');
  const pie = document.querySelector<HTMLElement>('.asent-pie')!;
  pie.innerHTML = htmlPieDePlaza(a, e);
  if (ventana !== 'almacen' || !cuerpo) return;
  const c = { proyeccion: p, asentamiento: a, cuerpo, ejecutar: async () => null, refrescar: pintarAlmacen, cargo: 'gobernador', resideAqui: true, escapar: e } as unknown as ContextoPlaza;
  if (qs.get('tesorero')) {
    a.cargos = { ...(a.cargos ?? {}), tesoreroId: 'h' } as typeof a.cargos;
    (p.heroe as { ubicacion: unknown }).ubicacion = { tipo: 'asentamiento', asentamientoId: a.id };
    a.reservaManual = { madera: 200, trigo: 300 };
  }
  cuerpo.innerHTML = `<div class="cols-completa"><div class="col-completa">${htmlEleccionBarra(a, e)}${htmlExtraccion(c)}<div class="almacen-reserva">${htmlReservaRecursos(c)}</div></div><div class="col-completa">${htmlRecetas(c)}</div></div>`;
  cablearEleccionBarra(cuerpo, a, pintarAlmacen, (m) => alert(m));
  cablearProduccionYRecetas(c);
  cablearTesoreria(c);
}
pintarAlmacen();
// `?ventana=caravanas`: la vista de flota de verdad (`htmlCaravanas`) con una flota de mentira: una en la plaza, una de camino, una en una aldea.
function pintarCaravanas(): void {
  const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo');
  if (ventana !== 'caravanas' || !cuerpo) return;
  // `&sub=rutas`: la pestaña Rutas del Mercado (0.138.0) con la misma flota.
  if (qs.get('sub') === 'rutas') {
    cuerpo.innerHTML = `<div class="asent-lado-cuerpo">${htmlRutas(p, a, e, pintarCaravanas)}</div>`;
    cablearRutas(cuerpo, p, async () => null, pintarCaravanas);
    return;
  }
  cuerpo.innerHTML = `<div class="asent-lado-cuerpo">${htmlCaravanas(p, a, e, pintarCaravanas)}</div>`;
  cablearCaravanas(cuerpo, p, a, async () => null, pintarCaravanas);
}
if (ventana === 'caravanas') {
  const q = p as unknown as Record<string, unknown>;
  a.heroesFundadoresIds = ['h'];
  for (const x of a.edificios) if (x.tipo === 'mercado') x.nivelInterno = 3;
  if (!a.edificios.some((x) => x.tipo === 'mercado')) a.edificios.push({ id: 'm1', tipo: 'mercado', estado: 'activo', nivelInterno: 3 } as Edificio);
  const aldea = { x: a.posicion.x + 30, y: a.posicion.y + 12 };
  q.pueblos = [{ id: 'pu1', madreId: a.id, propio: true, tipo: 'aldeaAgricola', posicion: aldea, almacen: {}, capacidad: 500 }];
  q.asentamientosAvistados = [{ id: 'as-9', nombre: 'Cnosos', faccionId: 'f1', posicion: { x: a.posicion.x + 200, y: a.posicion.y }, nivel: 3 }];
  q.asentamientosConocidos = [{ asentamientoId: 'as-7', nombre: 'Ugarit', faccionId: 'f2', posicion: { x: a.posicion.x - 150, y: a.posicion.y + 80 }, nivel: 4, conocidoEn: Date.now() }];
  a.cargos = { gobernadorId: 'h', maestroObrasId: null, maestroCaravanasId: null, tesoreroId: null, generalId: null, sacerdoteId: null };
  q.faccionId = 'f1';
  a.faccionId = 'f1';
  q.instante = Date.now();
  const yo = { ubicacion: { tipo: 'asentamiento', asentamientoId: a.id }, displayName: 'Víctor', liderazgoBase: 300 };
  const escuadra = (id: string, nombre: string, tropaId: string, coste: number, contenedor: object) => ({ id, nombre, tropaId, cantidad: 40, nivel: 1, costeLiderazgo: coste, contenedor, enGuarnicion: false });
  q.heroe = { ...yo, escuadrones: [
    escuadra('s1', 'Lanceros de Tebas', 'hoplitas_ciudadanos', 40, { tipo: 'escolta', caravanaId: 'car-1' }),
    escuadra('s2', 'Arqueros', 'arqueros', 60, { tipo: 'campamento' }),
    escuadra('s3', 'Honderos', 'honderos', 30, { tipo: 'campamento' }),
  ], loadouts: [] };
  q.caravanas = [
    { id: 'car-1', nombre: 'Ánfora', tipo: 'comercial', origenAsentamientoId: a.id, posicionActual: a.posicion, estado: 'disponible', reservadaManual: true,
      carros: [{ tipoCarro: 'basico', animal: 'buey' }, { tipoCarro: 'basico', animal: 'caballo' }, { tipoCarro: 'reforzado' }], escoltaIds: ['s1', 'x-otro'], escoltaLiderazgo: { usado: 75, cupo: 200 }, contenido: {} },
    { id: 'car-2', nombre: 'Sal del Egeo', tipo: 'comercial', origenAsentamientoId: a.id, posicionActual: { x: a.posicion.x + 90, y: a.posicion.y }, estado: 'en_transito', destinoAsentamientoId: 'as-9',
      carros: [{ tipoCarro: 'basico', animal: 'buey' }, { tipoCarro: 'basico', animal: 'buey' }], contenido: { trigo: 600, madera: 200 },
      encargo: { modo: 'ruta', destinoAsentamientoId: 'as-9', vueltas: 3, paradaActual: 'destino', fase: '', cancelado: false,
        paradaOrigen: { dejar: [], desecharSobrante: false, recoger: [{ recurso: 'trigo', cantidad: 600 }, { recurso: 'madera', cantidad: 200 }], esperarExistencias: true },
        paradaDestino: { dejar: [{ recurso: 'trigo' }, { recurso: 'madera', tope: 200 }], desecharSobrante: true, recoger: [{ recurso: 'cobre', cantidad: 120 }], esperarExistencias: false } } },
    { id: 'car-5', nombre: 'Vino de Quíos', tipo: 'comercial', origenAsentamientoId: a.id, posicionActual: a.posicion, estado: 'esperando',
      carros: [{ tipoCarro: 'reforzado', animal: 'buey' }, { tipoCarro: 'basico', animal: 'caballo' }], contenido: { vino: 140 },
      encargo: { modo: 'envio', destinoAsentamientoId: 'as-7', vueltas: 0, paradaActual: 'origen', fase: 'carga', inicioPaso: Date.now() - 150_000, finPaso: Date.now() + 90_000, cancelado: false,
        paradaOrigen: { dejar: [], desecharSobrante: false, recoger: [{ recurso: 'vino', cantidad: 300 }, { recurso: 'oro', cantidad: 80 }], esperarExistencias: false },
        paradaDestino: { dejar: [{ recurso: 'vino', precioMin: 2.5 }], desecharSobrante: false, recoger: [{ recurso: 'estano', cantidad: 60, precioMax: 4 }], esperarExistencias: true } } },
    { id: 'car-3', nombre: 'Grano del valle', tipo: 'comercial', origenAsentamientoId: a.id, posicionActual: aldea, estado: 'aparcada', carros: [{ tipoCarro: 'basico', animal: 'camello' }], contenido: { trigo: 180 } },
    { id: 'car-4', tipo: 'comercial', origenAsentamientoId: a.id, posicionActual: a.posicion, estado: 'disponible', carros: [], contenido: {} },
  ];
  // `&detener=1`: la ruta de car-2 ya detenida (0.141.0): acaba la vuelta y se queda sin ruta.
  if (qs.get('detener')) (q.caravanas.find((x) => x.id === 'car-2')!.encargo as { detener?: boolean }).detener = true;
  // `&visita=1`: de visita con tu columna (0.139.0): no resides, pero cedes escolta de la columna.
  if (qs.get('visita')) {
    a.heroesFundadoresIds = [];
    a.casasCompradas = [];
    a.cargos = undefined;
    const h = q.heroe as { escuadrones: { contenedor: object }[] };
    h.escuadrones[1]!.contenedor = { tipo: 'ejercito', ejercitoId: 'ej-1' };
    h.escuadrones[2]!.contenedor = { tipo: 'ejercito', ejercitoId: 'ej-1' };
    q.ejercitos = [{ id: 'ej-1', liderId: 'h', participantes: [{ heroeId: 'h' }], posicionActual: a.posicion, estado: 'estacionado' }];
  }
  if (qs.get('caravana')) (document.querySelector('.asent-ventana') as HTMLElement).dataset.elegir = qs.get('caravana')!;
  pintarCaravanas();
  bloqueDeDatos('EDIFICIO_CATALOGO', pintarCaravanas);
}
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
const pintarObras = (): void => { document.querySelector<HTMLElement>('.asent-obras-hud')!.innerHTML = htmlObrasHud(a, e, true, obrasMapa()); };
const alCargar = (): void => { if (bloqueDeDatos('EDIFICIO_CATALOGO', alCargar)) { pintarObras(); if (construir) pintarCajon(); elegirParaFicha(); repintarFicha(); } };
alCargar();
// `?camp=…`: el campamento de mercenarios al empezar la partida, con el riel de verdad (`seccionesDeCampamento`) y el ancho de verdad de cada parte
const camp = qs.get('camp') as SeccionCampamento | null;
if (camp) {
  const q = p as unknown as Record<string, unknown>;
  const c: CampamentoMercenarios = { id: 'mc-1', posicion: a.posicion, origen: 0, edificios: ['taberna', 'mercado', 'barracon'], residentesIds: ['h'], eligieronComoInicial: 3,
    mercado: { trigo: 400, madera: 120, cobre: 30 }, fondos: {},
    tablon: qs.get('tablon') ? [{ heroeId: 'bot07', tropa: [{ tropaId: 'milicia_lanceros', cantidad: 40, nivel: 1 }], tarifas: [{ plazoDias: 1, oro: 30 }, { plazoDias: 3, oro: 80 }, { oro: 600 }] }] : [] };
  q.faccionId = qs.get('faccion') ? 'f1' : null;
  q.heroe = { id: 'h', displayName: 'Víctor', ubicacion: { tipo: 'mercenarios', campamentoId: c.id }, escuadrones: [], loadouts: [], almacenPersonal: { oro: 120, trigo: 40 } };
  q.ejercitos = []; q.caravanas = []; q.heroesVisibles = [{ id: 'bot07', displayName: 'Perdicas' }]; q.asentamientos = []; q.asentamientosAvistados = []; q.asentamientosConocidos = [];
  q.campamentosMercenarios = [c];
  q.mercadoCampamento = { precios: { trigo: 0.5, madera: 1.2, cobre: 4 }, cupoRestante: { trigo: 200, madera: 60, cobre: 10 },
    reclutamiento: { tropas: [{ tropaId: 'milicia_lanceros', precioPorSoldado: 1.5, desbloqueada: true }], poblacion: 80, topePoblacion: 120 } };
  const secciones = seccionesDeCampamento(p, c);
  const raiz = document.querySelector<HTMLElement>('.plaza-3d')!;
  raiz.classList.add('camp-screen');
  document.querySelector<HTMLElement>('.asent-izq')!.style.display = 'none';
  document.querySelector('.asent-blason')!.innerHTML = '';
  document.querySelector('.asent-obras-hud')!.innerHTML = '';
  document.querySelector('.asent-pie')!.innerHTML = '';
  document.querySelector('.asent-der')!.innerHTML = '';
  document.querySelector('.asent-riel')!.innerHTML = htmlRielInterior(secciones.map((x) => ({ id: x.id, titulo: x.etiqueta })), camp, e);
  document.querySelector('.asent-ventana')?.remove();
  if (secciones.some((x) => x.id === camp)) {
    document.querySelector('.asent-cuerpo')!.insertAdjacentHTML('beforeend', `<section class="asent-ventana" data-ancho="${anchoDeParteCampamento(camp)}">
      <header class="asent-ventana-cab"><div class="asent-ventana-titulo">${htmlTituloDeParte(camp, secciones.find((x) => x.id === camp)!.etiqueta, e)}</div><button class="asent-ventana-cerrar">✕</button></header>
      <div class="asent-edif-cuerpo">${htmlSeccionCampamento(camp, p, c, e)}</div></section>`);
  }
}
// El «!» de Territorio (0.136.0) con la cuenta de verdad (`fundacionLista`): se repinta cuando llegan los datos del coste.
function avisoFundacion(): void {
  if (camp || construir || qs.get('visita')) return;
  a.heroesFundadoresIds = ['h'];
  const q = p as unknown as { caravanas?: unknown[] };
  q.caravanas ??= [];
  const fs = p.facciones as unknown as { id: string; nivel: number }[];
  if (a.faccionId && !fs.some((f) => f.id === a.faccionId)) fs.push({ id: a.faccionId, nivel: 3 });
  const lista = fundacionLista({ proyeccion: p, asentamiento: a, resideAqui: true, escapar: e, refrescar: avisoFundacion });
  const boton = document.querySelectorAll<HTMLElement>('.asent-riel-boton')[3];
  const previo = boton?.querySelector('.asent-aviso-atencion');
  if (previo) previo.outerHTML = '';
  if (lista) boton?.insertAdjacentHTML('beforeend', '<b class="asent-aviso-atencion">!</b>');
  if (ventana === 'territorio') {
    const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo')!;
    cuerpo.innerHTML = `<div class="asent-tabs asent-subtabs"><button class="asent-tab activo" type="button">Pueblos y aldeas</button><button class="asent-tab" type="button">Fundación${lista ? '<b class="asent-aviso-atencion">!</b>' : ''}</button></div><p>…</p>`;
  }
}
avisoFundacion();
// `?ventana=defensa`: la Guarnición de verdad (0.138.0): dos tuyas dentro, una de otro residente y las del campamento para dejar.
function pintarDefensa(): void {
  const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo');
  if (ventana !== 'defensa' || !cuerpo) return;
  const c = { proyeccion: p, asentamiento: a, cuerpo, ejecutar: async () => null, refrescar: pintarDefensa, cargo: null, resideAqui: !qs.get('visita'), escapar: e } as unknown as ContextoPlaza;
  cuerpo.innerHTML = `<div class="asent-tabs asent-subtabs"><button class="asent-tab activo" type="button">Guarnición</button><button class="asent-tab" type="button">Muralla</button><button class="asent-tab" type="button">Puerta</button></div>${SUBPESTANA_GUARNICION.html(c)}`;
  SUBPESTANA_GUARNICION.cablear?.(c);
}
if (ventana === 'defensa') {
  const q = p as unknown as Record<string, unknown>;
  q.faccionId = a.faccionId;
  const escuadra = (id: string, nombre: string, tropaId: string, coste: number, enGuarnicion: boolean) => ({ id, nombre, tropaId, cantidad: 40, nivel: 1, costeLiderazgo: coste, contenedor: { tipo: 'campamento' }, enGuarnicion });
  q.heroe = { displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: a.id }, cupoGuarnicion: 120, guarnicionOcupada: 70, loadouts: [], escuadrones: [
    escuadra('s1', 'Lanceros de Tebas', 'hoplitas_ciudadanos', 40, true), escuadra('s2', 'Honderos', 'honderos', 30, true),
    escuadra('s3', 'Arqueros', 'arqueros', 60, false), escuadra('s4', 'Carros ligeros', 'carros_ligeros', 45, false)] };
  a.guarnicionIds = ['s1', 's2', 'esc-99', 'esc-98'];
  a.guarnicion = [{ tropaId: 'hoplitas_ciudadanos', cantidad: 40, heroeId: 'h' }, { tropaId: 'honderos', cantidad: 40, heroeId: 'h' }, { tropaId: 'arqueros', cantidad: 55, heroeId: 'h2' }, { tropaId: 'lanceros', cantidad: 30, heroeId: 'h3' }];
  a.cupoGuarnicion = 120;
  q.nombresDeCompaneros = { h2: 'Ariadna', h3: 'Néstor' };
  q.heroesVisibles = [];
  // `&visita=1`: de visita con tu columna (0.139.0): las tuyas dentro llegan con `contenedor: plaza` y las de la columna se ofrecen.
  if (qs.get('visita')) {
    const h = q.heroe as { escuadrones: { contenedor: object; enGuarnicion: boolean }[] };
    h.escuadrones[0]!.contenedor = { tipo: 'plaza', asentamientoId: a.id }; h.escuadrones[0]!.enGuarnicion = false;
    h.escuadrones[1]!.contenedor = { tipo: 'plaza', asentamientoId: a.id }; h.escuadrones[1]!.enGuarnicion = false;
    h.escuadrones[2]!.contenedor = { tipo: 'ejercito', ejercitoId: 'ej-1' };
    h.escuadrones[3]!.contenedor = { tipo: 'ejercito', ejercitoId: 'ej-1' };
    q.ejercitos = [{ id: 'ej-1', liderId: 'h', participantes: [{ heroeId: 'h' }], posicionActual: a.posicion, estado: 'estacionado' }];
  }
  pintarDefensa();
}
// `?obra=1`: la ficha de una obra de pueblo en el mapa (0.138.0), con la columna al lado llevando parte de lo que falta. `&sinEmpezar=1`: sin nada
// entregado y en la caja de verdad del mundo (`.mapa-seleccion`, 280 de ancho), donde se desbordaba (0.147.0).
if (qs.get('obra')) {
  const q = p as unknown as Record<string, unknown>;
  const sinEmpezar = Boolean(qs.get('sinEmpezar'));
  const o = { id: 'obra-1', tipo: 'pueblo', madreId: a.id, propia: true, posicion: { x: a.posicion.x + 40, y: a.posicion.y },
    requerido: sinEmpezar ? { madera: 1200, piedra: 800, trigo: 600, cobre: 250, estano: 60 } : { madera: 400, piedra: 250, trigo: 120 },
    entregado: sinEmpezar ? {} : { madera: 400, piedra: 90 } };
  q.ejercitos = [{ id: 'ej-1', liderId: 'h', participantes: [{ heroeId: 'h' }], posicionActual: o.posicion, suministro: { piedra: 200, trigo: 40 } }];
  q.heroe = { ...(p.heroe as object), ubicacion: { tipo: 'ejercito', ejercitoId: 'ej-1' } };
  const caja = document.createElement('div');
  caja.className = sinEmpezar ? 'mapa-seleccion' : 'mapa-panel';
  caja.style.cssText = sinEmpezar ? 'z-index:50' : 'position:absolute;right:20px;top:120px;width:360px;z-index:50;padding:14px';
  caja.innerHTML = FICHA_OBRA.html(p, o as never, { escapar: e } as never);
  document.body.append(caja);
}
(window as unknown as { __banco: unknown }).__banco = { listo: true, p, a };
