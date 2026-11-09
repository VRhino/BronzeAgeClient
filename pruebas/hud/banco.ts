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
import { olvidarFlechasPob, cablearEleccionBarra, htmlBlasonHud, htmlEleccionBarra, htmlObrasHud, htmlPieDePlaza, ICONO_RIEL, vigilarPieArriba } from '../../src/ui/hudPlaza';
import { cablearProduccionYRecetas, cablearVistaCiudad, elegirEdificio, htmlExtraccion, htmlRecetas, repintarFicha } from '../../src/ui/vistaCiudad';
import { cablearPanelObras, cuantosConstruidos, elegirGrupoDe, htmlConstruidosVentana, htmlConstruir } from '../../src/ui/panelObras';
import { cablearCaravanas, cablearRutas, htmlCaravanas, htmlRutas } from '../../src/ui/panelMercado';
import { SUBPESTANA_GUARNICION } from '../../src/ui/panelGuarnicion';
import { FICHA_OBRA, SUBPESTANA_PUEBLOS } from '../../src/ui/pueblos';
import { ahora as ahoraJuego } from '../../src/ui/juegoVisual';
import { cablearTesoreria, htmlReservaRecursos } from '../../src/ui/panelTesoreria';
import { htmlAutoConstruccion } from '../../src/ui/panelCentro';
import { bloqueDeDatos, nivelesDeEdificio } from '../../src/apiCliente';
import type { Edificio } from '../../src/tiposDominio';
import { estadoCliente } from '../../src/ui/estadoCliente';
import type { ContextoPlaza } from '../../src/ui/ganchos';
import { iconoEdificio } from '../../src/ui/iconosEdificio';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { anchoDeParteCampamento, cablearCampamento, htmlSeccionCampamento, seccionesDeCampamento, type SeccionCampamento } from '../../src/ui/pantallaCampamento';
import { htmlRielInterior, htmlTituloDeParte } from '../../src/ui/hudInterior';
import type { CampamentoMercenarios } from '../../src/tiposDominio';
import { fundacionLista } from '../../src/ui/panelFundacionDePlaza';
import { cablearReclutamiento, htmlReclutamiento } from '../../src/ui/reclutamiento';
import { cablearVentanaAedas, htmlVentanaAedas } from '../../src/ui/ventanaAedas';
import { htmlCarro } from '../../src/ui/panelCarro';
import { catalogoDeTecnologia } from '../../src/apiCliente';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const RIEL: [string, string, string, boolean?][] = [
  ['construccion', 'Construcción', ICONO_RIEL.construccion], ['gobierno', 'Gobierno', ICONO_RIEL.gobierno], ['defensa', 'Defensa', iconoEdificio('muralla', 28)],
  ['territorio', 'Territorio', ICONO_RIEL.territorio], ['reclutamiento', 'Reclutamiento', iconoEdificio('barracon', 28)],
  ['taberna', 'Taberna', iconoEdificio('taberna', 28), true], ['mercado', 'Mercado', iconoEdificio('mercado', 28)],
  ['aedas', 'Aedas', ICONO_RIEL.aedas, new URLSearchParams(location.search).get('ventana') !== 'aedas'],
];
const ventana = new URLSearchParams(location.search).get('ventana');
const qs0 = new URLSearchParams(location.search);
// `?obrasMapa=1`: «Obras» del panel izquierdo con una aldea esperando materiales y un pueblo levantándose (0.149.0).
const obrasMapa = (): never[] => new URLSearchParams(location.search).get('obrasMapa') ? [
  { id: 'obra-7', tipo: 'aldea', madreId: a.id, propia: true, posicion: a.posicion, requerido: { madera: 300, trigo: 200 }, entregado: { madera: 300, trigo: 40 } },
  { id: 'obra-8', tipo: 'pueblo', madreId: a.id, propia: true, posicion: a.posicion, requerido: { madera: 400 }, entregado: { madera: 400 }, terminaEn: ahoraJuego() + 26 * 60_000 },
  { id: 'obra-9', tipo: 'avanzada', madreId: a.id, propia: true, posicion: a.posicion, requerido: { madera: 200, piedra: 100 }, entregado: { madera: 120 } },
] as never[] : [];

const binario = new Uint8Array(await (await fetch(new URL('../ciudad3d/ciudades/ciudad.bin', import.meta.url).href)).arrayBuffer());
const { asentamiento: a, trazado } = plazaDeContrato(fromBinary(AsentamientoSchema, binario), 16 * 24 * 3_600_000);
a.cargos = { ...(a.cargos ?? {}), gobernadorId: 'h' } as typeof a.cargos;
// el «ahora» del banco: un rato antes de que acabe la primera obra en marcha (los tiempos de la ciudad del banco son de su día)
const finesDeObra = (a.edificios ?? []).flatMap((x) => [x.mejora?.completaEn, x.estado === 'en_construccion' ? x.completaEn : undefined]).filter((x): x is number => typeof x === 'number');
const p = { instante: finesDeObra.length ? Math.min(...finesDeObra) - 50 * 60_000 : Date.now(), heroe: { displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: a.id } }, asentamientos: [a], facciones: [], heroeId: 'h' } as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;
// `&prestigio=N` (tanda 69): la plaza es la capital de una Facción con ese prestigio (la estatua y la Maravilla de «Construir»)
if (qs0.get('prestigio')) {
  const q = p as unknown as Record<string, unknown>;
  q.faccionId = a.faccionId;
  q.facciones = [{ id: a.faccionId, nombre: 'Casa de Micenas', nivel: 2, prestigio: Number(qs0.get('prestigio')), capitalId: a.id, reyId: 'h' }];
}
// `&molino=1` (tanda 69): la plaza con un molino activo; `&molino=buey`, ya con su buey. `?ficha=molino` abre su ficha.
if (qs0.get('molino')) a.edificios = [...(a.edificios ?? []), { id: 'ed-molino', tipo: 'molino', estado: 'activo', nivelInterno: 1, posicion: a.posicion, ...(qs0.get('molino') === 'buey' ? { buey: true } : {}) } as Edificio];
// `&bodegas=uva,cebada` y `&prensas=sesamo,...` (0.190.0): bodegas y prensas activas con esas recetas; `&parada=N`, la N-ésima de ellas (contando
// bodegas y luego prensas, desde 1) con la receta parada, y `&nivelActual=N`, la plaza rindiendo como de ese nivel. `?ficha=bodega|bodega2|prensa`
// abre la ficha de la primera bodega, la segunda o la primera prensa.
for (const [tipo, lista] of [['bodega', qs0.get('bodegas')], ['prensa', qs0.get('prensas')]] as const) {
  for (const [i, receta] of (lista ? lista.split(',') : []).entries()) a.edificios = [...(a.edificios ?? []), { id: `ed-${tipo}-${i + 1}`, tipo, estado: 'activo', nivelInterno: 1, posicion: a.posicion, receta } as Edificio];
}
if (qs0.get('parada')) {
  const deUna = (a.edificios ?? []).filter((x) => x.id.startsWith('ed-bodega-') || x.id.startsWith('ed-prensa-'));
  const x = deUna[Number(qs0.get('parada')) - 1];
  if (x) x.recetaParada = true;
}
if (qs0.get('nivelActual')) a.nivelActual = Number(qs0.get('nivelActual'));
// `&grupo=<tipo>`: «Construir» abierto en la pestaña de ese tipo (p. ej. `bodega`, la Comida)
if (qs0.get('grupo')) elegirGrupoDe(qs0.get('grupo')!);
// `&comida=1` (tanda 69): el almacén con la comida nueva, junto al trigo
if (qs0.get('comida')) {
  const hay = { harina: 140, pan: 260, carne: 45, leche: 80, queso: 30, uva: 120, vino: 40, cebada: 95, cerveza: 30, aceituna: 90, sesamo: 60, aceite: 25 };
  for (const [r, n] of Object.entries(hay)) a.almacen = { ...a.almacen, [r]: { cantidad: n, capacidad: a.almacen?.trigo?.capacidad ?? 1000 } };
}
const construir = new URLSearchParams(location.search).get('construir');

let barra = '';
try { barra = htmlBarraJugador(p, e, '<button type="button" class="jugador-boton-info">?</button>'); } catch { barra = '<header class="jugador-barra"></header>'; }
const riel = RIEL.filter(([, , , bloq]) => !bloq).map(([id, nombre, icono], i) => `<button type="button" class="asent-riel-boton${id === ventana ? ' activo' : ''}" data-etiqueta="${nombre}">${icono}${i === 0 ? '<b class="asent-riel-insignia">2</b>' : ''}</button>`).join('');
// el cajón de Construcción, como `htmlCajonConstruir` de main.ts
// `&construidos=1`: con la ventana «Construidos» abierta encima del cajón
let construidosAbiertos = new URLSearchParams(location.search).has('construidos');
const cajon = (): string => `<div class="cajon-construir"><div class="construidos-ventana"${construidosAbiertos ? '' : ' hidden'}>${htmlConstruidosVentana(a, e)}</div><div class="cajon-construir-cab"><button type="button" class="cajon-volver">← Volver</button><button type="button" class="cajon-volver cajon-construidos-boton${construidosAbiertos ? ' activo' : ''}" data-cajon-construidos>Construidos <b>${cuantosConstruidos(a)}</b></button><h2>${ICONO_RIEL.construccion}<span>Construcción</span></h2>${htmlAutoConstruccion(a)}</div><div class="cajon-construir-cuerpo">${htmlConstruir(a, 'gobernador', e, qs0.get('pob') === 'llena' ? 'vivienda' : undefined)}</div></div>`;
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
    ${ventana ? `<section class="asent-ventana" data-ancho="${ventana === 'mercado' || ventana === 'taberna' || ventana === 'almacen' || ventana === 'caravanas' || ventana === 'territorio' || ventana === 'reclutamiento' ? 'completa' : ''}"><header class="asent-ventana-cab"><div class="asent-ventana-titulo"><h2>${ventana}</h2></div><button class="asent-ventana-cerrar">✕</button></header><div class="asent-edif-cuerpo">${ventana === 'almacen' || ventana === 'caravanas' || ventana === 'reclutamiento' ? '' : '<p>Contenido de la ventana.</p>'.repeat(40)}</div></section>` : ''}
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
  // `&carga=1`: la subpestaña «Tu carga» (0.172.0): residente en la plaza, con el carro cargado y el almacén personal
  if (qs.get('carga')) {
    const q = p as unknown as Record<string, unknown>;
    q.faccionId = a.faccionId; q.facciones = [{ id: a.faccionId, nombre: 'Casa de Micenas', reyId: 'h', miembros: [{ heroeId: 'h', cargos: [`gobernador@${a.id}`] }] }];
    q.ejercitos = []; q.asentamientosAvistados = []; q.campamentosMercenarios = [];
    a.heroesFundadoresIds = ['h'];
    q.heroe = { ...(p.heroe as object), ubicacion: { tipo: 'asentamiento', asentamientoId: a.id }, carro: { madera: 120, trigo: 60 }, almacenPersonal: { oro: 300, cobre: 40 }, capacidadAlmacenPersonal: 2000 };
    cuerpo.innerHTML = `<div class="asent-tabs asent-subtabs"><button class="asent-tab" type="button">Almacén</button><button class="asent-tab activo" type="button">Tu carga</button></div><div class="asent-lado-cuerpo"><div class="almacen-carga">${htmlCarro(p, e, false, true, true)}</div></div>`;
    return;
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
  q.nombresDeCompaneros = { ...(q.nombresDeCompaneros ?? {}), 'heroe-12': 'Ariadna' };
  q.caravanas = [
    { id: 'car-1', nombre: 'Ánfora', tipo: 'comercial', origenAsentamientoId: a.id, posicionActual: a.posicion, estado: 'disponible', reservadaManual: true,
      carros: [{ tipoCarro: 'basico', animal: 'buey' }, { tipoCarro: 'basico', animal: 'caballo' }, { tipoCarro: 'reforzado' }], escoltaIds: ['s1', 'x-otro'], escolta: [{ tropaId: 'hoplitas_ciudadanos', cantidad: 40, heroeId: 'h' }, { tropaId: 'arqueros', cantidad: 55, heroeId: 'heroe-12' }], escoltaLiderazgo: { usado: 75, cupo: 200 }, contenido: {} },
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
  nav.querySelector('[data-cajon-construidos]')?.addEventListener('click', () => { construidosAbiertos = !construidosAbiertos; pintarCajon(); });
  nav.querySelector('[data-construidos-cerrar]')?.addEventListener('click', () => { construidosAbiertos = false; pintarCajon(); });
}
// `?ficha=…`: la ficha de verdad (`cablearVistaCiudad` + `elegirEdificio`) de un edificio mejorándose, uno activo que se puede mejorar o una obra
const ficha = qs.get('ficha');
if (ficha) {
  cablearVistaCiudad(document.querySelector<HTMLElement>('.asent-cuerpo')!, { proyeccion: () => p, ejecutar: async () => null, escapar: e, redibujar: () => {}, repintarLista: () => {} });
}
const elegirParaFicha = (): void => {
  if (!ficha) return;
  const conSiguiente = (x: Edificio): boolean => Boolean(nivelesDeEdificio(x.tipo)?.[String((x.nivelInterno ?? 1) + 1)]);
  const porId: Record<string, string> = { bodega: 'ed-bodega-1', bodega2: 'ed-bodega-2', prensa: 'ed-prensa-1' };
  const elegido = (a.edificios ?? []).find((x) => (porId[ficha] ? x.id === porId[ficha] : ficha === 'molino' ? x.tipo === 'molino' : ficha === 'obra' ? x.estado === 'en_construccion' : x.estado === 'activo' && !x.mejora && x.tipo !== 'centroUrbano' && conSiguiente(x)));
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
    tablon: qs.get('tablon') ? ['bot07', 'bot08', 'bot09'].map((heroeId, i) => ({ heroeId, tropa: [{ tropaId: 'milicia_lanceros', cantidad: 24 + i, nivel: 1 }, { tropaId: 'milicia_lanceros', cantidad: 28 + i, nivel: 1 }],
      tarifas: [{ plazoDias: 1, oro: 220 + 13 * i, monedas: (220 + 13 * i) * 100 }, { plazoDias: 3, oro: 514 + 29 * i, monedas: (514 + 29 * i) * 100 }, { plazoDias: 7, oro: 1027 + 58 * i, monedas: (1027 + 58 * i) * 100 }, { oro: 7330 + 420 * i, monedas: (7330 + 420 * i) * 100 }] })) : [] };
  q.faccionId = qs.get('faccion') ? 'f1' : null;
  q.heroe = { id: 'h', displayName: 'Víctor', ubicacion: { tipo: 'mercenarios', campamentoId: c.id }, escuadrones: [], loadouts: [], almacenPersonal: { oro: 120, trigo: 40 } };
  q.ejercitos = []; q.caravanas = []; q.heroesVisibles = [{ id: 'bot07', displayName: 'Perdicas' }]; q.campamentosBandidos = []; q.ejercitosAvistados = []; q.nombresDeCompaneros = { bot07: 'Suppiluliuma II', bot08: 'Telipinu', bot09: 'Thariyelli' }; q.asentamientos = []; q.asentamientosAvistados = []; q.asentamientosConocidos = [];
  q.campamentosMercenarios = [c];
  // `&rey=1`: con Facción y siendo su Rey, con una plaza, una caravana, una columna y bandidos a la vista: los cinco trabajos del tablón se pueden firmar.
  if (qs.get('rey')) {
    const pos = (dx: number) => ({ x: a.posicion.x + dx, y: a.posicion.y });
    q.faccionId = 'f1'; q.heroeId = 'h';
    q.facciones = [{ id: 'f1', nombre: 'Casa de Micenas', reyId: 'h', miembros: [{ heroeId: 'h', cargos: ['rey'] }] }];
    q.asentamientos = [{ id: 'as-1', nombre: 'Micenas', faccionId: 'f1', posicion: pos(60) }];
    q.caravanas = [{ id: 'car-1', nombre: 'Ánfora', faccionId: 'f1', origenAsentamientoId: 'as-1', posicionActual: pos(70), estado: 'disponible' }];
    q.ejercitos = [{ id: 'ej-1', faccionId: 'f1', tipo: 'ejercito', liderId: 'h', posicionActual: pos(5), participantes: [{ heroeId: 'h' }], estado: 'estacionado' }];
    q.campamentosBandidos = [{ id: 'bd-1', posicion: pos(-80) }];
  }
  q.mercadoCampamento = { precios: { trigo: 0.5, madera: 1.2, cobre: 4 }, cupoRestante: { trigo: 200, madera: 60, cobre: 10 },
    reclutamiento: { tropas: [{ tropaId: 'milicia_lanceros', precioPorSoldado: 1.5, desbloqueada: true }], poblacion: 80, topePoblacion: 120 } };
  // `&camp=tropa`: el árbol de la Tropa (0.160.0) con un campamento de Barracón y Galería de tiro, una tropa prestada y lo que ofrece al empezar
  if (camp === 'tropa') {
    c.edificios = ['taberna', 'mercado', 'barracon', 'galeriaDeTiro'];
    (q.heroe as { escuadrones: unknown[] }).escuadrones = [{ id: 's1', nombre: 'Milicia de lanceros', tropaId: 'milicia_lanceros', cantidad: 25, nivel: 1, prestada: true, contenedor: { tipo: 'campamento' } }];
    q.tecnologia = { era: 'reinos_palaciales', capitalId: null, reveladas: [], logros: [], epicasPosibles: [], propias: qs.get('faccion') ? { adoptadas: ['leva_comunal', 'hostigamiento_tribal'], aparecidas: [] } : null };
    (q.mercadoCampamento as { reclutamiento: unknown }).reclutamiento = { poblacion: 80, topePoblacion: 120, tropas: [
      { tropaId: 'lanceros_mimbre', precioPorSoldado: 3.5, desbloqueada: true }, { tropaId: 'espadachines_cobre', precioPorSoldado: 4, desbloqueada: false },
      { tropaId: 'honderos', precioPorSoldado: 3, desbloqueada: true }] };
  }
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
    const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo')!;
    const repintar = (): void => { cuerpo.innerHTML = htmlSeccionCampamento(camp, p, c, e); cablearCampamento(cuerpo, p, c, async () => null, { ejecutarConDatos: async () => ({ error: null }), repintar }); };
    if (camp === 'tropa') { repintar(); const vigia = setInterval(() => { if (cuerpo.querySelector('.ta-carta')) clearInterval(vigia); else repintar(); }, 300); }
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
    // 0.153.0: la de verdad, a ventana completa (zona, pueblos y marcar a la izquierda; avanzadas a la derecha), con las obras de `?obrasMapa=1`
    (p as unknown as { obrasDeMapa: unknown[] }).obrasDeMapa = obrasMapa();
    // `&aldeas=humedas` (0.190.0): una aldea de cebada y una de sésamo
    if (qs.get('aldeas') === 'humedas') {
      const cerca = (dx: number, dy: number) => ({ x: a.posicion.x + dx, y: a.posicion.y + dy });
      (p as unknown as { pueblos: unknown[] }).pueblos = [
        { id: 'pueblo-1', tipo: 'aldeaAgricola', cultivo: 'cebada', madreId: a.id, propio: true, posicion: cerca(8, 3), nivelAldea: 2, fertilidad: 0.58, almacen: { cebada: 160 }, capacidad: 1000 },
        { id: 'pueblo-2', tipo: 'aldeaAgricola', cultivo: 'sesamo', madreId: a.id, propio: true, posicion: cerca(-6, 9), nivelAldea: 1, fertilidad: 0.46, almacen: { sesamo: 75 }, capacidad: 1000 },
      ];
    }
    // `&madre=1` (0.190.0): la plaza es de nivel 1 y otra de su Facción llegó al 4: se ofrecen igual los cinco cultivos
    if (qs.get('madre')) {
      a.nivel = 1; a.nivelActual = 1;
      a.faccionId = a.faccionId || 'fac-1';
      (p as unknown as { asentamientosAvistados: unknown[] }).asentamientosAvistados = [{ id: 'as-99', nombre: 'Tirinto', faccionId: a.faccionId, nivel: 4, posicion: { x: a.posicion.x + 300, y: a.posicion.y }, zona: [] }];
    }
    // `&aldeas=1` (tanda 69): una aldea de trigo con su rebaño y una de viñas, sin corrales
    if (qs.get('aldeas') === '1') {
      const cerca = (dx: number, dy: number) => ({ x: a.posicion.x + dx, y: a.posicion.y + dy });
      (p as unknown as { pueblos: unknown[] }).pueblos = [
        { id: 'pueblo-1', tipo: 'aldeaAgricola', cultivo: 'trigo', madreId: a.id, propio: true, posicion: cerca(8, 3), nivelAldea: 2, fertilidad: 0.71, almacen: { trigo: 210, livestock: 40, carne: 18, leche: 35 }, capacidad: 1000, rebano: { especie: 'vacuno', cabezas: 52 } },
        { id: 'pueblo-2', tipo: 'aldeaAgricola', cultivo: 'vid', madreId: a.id, propio: true, posicion: cerca(-6, 9), nivelAldea: 1, fertilidad: 0.64, almacen: { uva: 120 }, capacidad: 1000 },
      ];
    }
    a.cargos = { ...(a.cargos ?? {}), gobernadorId: 'h' } as typeof a.cargos;
    a.faccionId = a.faccionId || 'fac-1';
    (p as unknown as { faccionId: string }).faccionId = a.faccionId;
    const c = { proyeccion: p, asentamiento: a, cuerpo, ejecutar: async () => null, refrescar: avisoFundacion, cargo: 'gobernador', resideAqui: true, escapar: e } as unknown as ContextoPlaza;
    cuerpo.innerHTML = `<div class="asent-tabs asent-subtabs"><button class="asent-tab activo" type="button">Pueblos y aldeas</button><button class="asent-tab" type="button">Fundación${lista ? '<b class="asent-aviso-atencion">!</b>' : ''}</button></div>${SUBPESTANA_PUEBLOS.html(c)}`;
    // con su cableado (tanda 69): el cultivo de la aldea nueva repinta la carta
    SUBPESTANA_PUEBLOS.cablear?.(c);
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
// `?ventana=reclutamiento`: el árbol de reclutamiento de verdad (0.159.0) con una Facción a mitad de la Era II (la del banco de Facción → Tecnología).
// `&plaza=barracon:2,galeriaDeTiro:2` deja esos edificios de reclutamiento a ese nivel y quita los demás (sin Caballerizas, su carril plegado);
// `&inicio=1` con una Facción recién fundada; `&visita=1` sin residir.
if (ventana === 'reclutamiento') {
  const q = p as unknown as Record<string, unknown>;
  const inicio = Boolean(qs.get('inicio'));
  q.faccionId = a.faccionId;
  q.tecnologia = {
    era: inicio ? 'reinos_palaciales' : 'crisis_adaptacion', capitalId: a.id, reveladas: [], logros: [], epicasPosibles: [],
    propias: inicio ? { adoptadas: ['leva_comunal', 'hostigamiento_tribal'], aparecidas: ['escudos_ligeros'] }
      : { adoptadas: ['leva_comunal', 'hostigamiento_tribal', 'metalurgia_cobre', 'aleacion_bronce', 'escudos_ligeros', 'armamento_palacial', 'arqueria_palacial', 'cria_caballar', 'canteria'], aparecidas: ['carros_guerra', 'bronce_calidad_militar'] },
  };
  const plaza = qs.get('plaza') ?? (inicio ? '' : 'barracon:2,galeriaDeTiro:2');
  const niveles = Object.fromEntries(plaza.split(',').filter(Boolean).map((x) => { const [t, n] = x.split(':'); return [t!, Number(n)]; }));
  a.edificios = (a.edificios ?? []).filter((x) => !['barracon', 'galeriaDeTiro', 'caballerizas'].includes(x.tipo));
  for (const [t, n] of Object.entries(niveles)) a.edificios.push({ id: `r-${t}`, tipo: t, estado: 'activo', nivelInterno: n } as Edificio);
  a.heroesFundadoresIds = qs.get('visita') ? [] : ['h'];
  a.poblacion = { pesants: 140, artesanos: 30, nobleza: 6 };
  q.heroe = { displayName: 'Víctor', ubicacion: { tipo: 'asentamiento', asentamientoId: a.id }, loadouts: [], escuadrones: inicio ? [] : [
    { id: 's1', nombre: 'Honderos', tropaId: 'honderos', cantidad: 30, nivel: 1, contenedor: { tipo: 'campamento' } }] };
  const pintarRecl = (): void => {
    const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo');
    if (!cuerpo) return;
    cuerpo.innerHTML = htmlReclutamiento(p, a, e, pintarRecl);
    cablearReclutamiento(cuerpo, p, a, async () => null, pintarRecl);
  };
  pintarRecl();
}
// `?ventana=aedas`: la ventana de los Aedas de la plaza (0.170.0): un itinerante parado que vende dos reveladas y dos residentes, uno cantando su
// épica y otro sin ella. `&sinCargo=1`: sin ser Rey ni Gobernador (se ve lo que vende, sin comprar). `&solo=itinerante|residente`: solo uno de los dos.
if (ventana === 'aedas') {
  const q = p as unknown as Record<string, unknown>;
  const solo = qs.get('solo');
  q.faccionId = a.faccionId;
  q.facciones = [{ id: a.faccionId, nombre: 'Casa de Micenas', reyId: qs.get('sinCargo') ? 'otro' : 'h' }];
  if (qs.get('sinCargo')) a.cargos = { ...(a.cargos ?? {}), gobernadorId: 'otro' } as typeof a.cargos;
  a.almacen = { ...(a.almacen ?? {}), oro: { cantidad: 950 } } as typeof a.almacen;
  q.tecnologia = { era: 'reinos_palaciales', capitalId: a.id, logros: [], epicasPosibles: ['cria_caballar', 'canteria'], propias: { adoptadas: ['leva_comunal'], aparecidas: [] },
    reveladas: [{ tecnologiaId: 'metalurgia_cobre', descubridorFaccionId: 'f-2', hito: [], cumplidas: [false] }, { tecnologiaId: 'escudos_ligeros', descubridorFaccionId: 'f-3', hito: [], cumplidas: [false] }] };
  q.aedasAvistados = solo === 'residente' ? [] : [{ id: 'aeda-3', posicion: a.posicion, enAsentamientoId: a.id }];
  q.aedasResidentes = solo === 'itinerante' ? [] : [
    { id: 'aeda-r1', nombre: 'Ión', asentamientoId: a.id, epica: { tecnologiaId: 'arqueria_palacial', nombre: 'La caza del león', capitulo: 1, capitulos: 3, tituloCapitulo: 'El arco', hechos: 2, hechosNecesarios: 5, ultimoHechoEn: p.instante - 20 * 60_000 } },
    { id: 'aeda-r2', nombre: 'Femio', asentamientoId: a.id },
  ];
  const pintarAedas = (): void => {
    const cuerpo = document.querySelector<HTMLElement>('.asent-edif-cuerpo');
    const titulo = document.querySelector<HTMLElement>('.asent-ventana-titulo');
    if (!cuerpo) return;
    if (titulo) titulo.innerHTML = `<span class="asent-ventana-icono" aria-hidden="true">${ICONO_RIEL.aedas}</span><h2>Aedas</h2>`;
    cuerpo.innerHTML = `<div class="asent-lado-cuerpo">${htmlVentanaAedas(p, a, e)}</div>`;
    cablearVentanaAedas(cuerpo, a, async () => null, () => {});
  };
  pintarAedas();
  catalogoDeTecnologia(pintarAedas);
}
// `?pob=llena|crece|baja`: la placa de Población de 0.171.0. `llena`: los pesants llenan sus Viviendas y no llegan a lo que pide el nivel
// siguiente (tramo rojo, «+» de Vivienda que se pulsa, ⏸); los artesanos crecen (▲). `crece`: hay sitio y crecen. `baja`: se van (▼).
// Con `&construir=1`, el cajón con la Vivienda marcada.
if (qs.get('pob')) {
  const modo = qs.get('pob');
  // una plaza de nivel 1 con dos Viviendas, para ver la meta del nivel 2
  let n = 0;
  a.nivel = 1;
  a.edificios = (a.edificios ?? []).filter((x) => x.tipo !== 'vivienda' || x.estado !== 'activo' || n++ < 2);
  const pintarPob = (): void => {
    const cat = bloqueDeDatos<Record<string, { capacidadPesants?: number; capacidadArtesanos?: number }>>('EDIFICIO_CATALOGO', pintarPob);
    if (!cat) return;
    const viv = (a.edificios ?? []).filter((x) => x.tipo === 'vivienda' && x.estado === 'activo').length;
    const capP = viv * (cat['vivienda']?.capacidadPesants ?? 0), capA = viv * (cat['vivienda']?.capacidadArtesanos ?? 0);
    const pie = document.querySelector<HTMLElement>('.asent-pie')!;
    olvidarFlechasPob();
    const fijar = (pes: number, art: number): void => { a.poblacion = { pesants: pes, artesanos: art, nobleza: a.poblacion?.nobleza ?? 4 }; pie.innerHTML = htmlPieDePlaza(a, e, undefined, { construir: true }); };
    if (modo === 'llena') { fijar(capP, Math.round(capA * 0.5)); fijar(capP, Math.round(capA * 0.55)); }
    else if (modo === 'crece') { fijar(Math.round(capP * 0.6), Math.round(capA * 0.4)); fijar(Math.round(capP * 0.62), Math.round(capA * 0.42)); }
    else { fijar(Math.round(capP * 0.7), Math.round(capA * 0.5)); fijar(Math.round(capP * 0.66), Math.round(capA * 0.5)); }
    console.log('viviendas', viv, capP, capA, a.nivel);
  };
  pintarPob();
}
(window as unknown as { __banco: unknown }).__banco = { listo: true, p, a };
