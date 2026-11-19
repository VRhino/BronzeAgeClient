// Banco de la tanda del 19-11 (0.221.0; 0.222.0, la ventana «Almacén»): las fichas del mapa con «Almacén» a la puerta de tu plaza y de tu pueblo,
// en la pantalla del mundo y con los clics de verdad (las órdenes van a la consola), y «Cancelar la obra / la mejora» a la puerta de una obra de
// pueblo, con los paneles de verdad y datos de mentira. `?ver=plaza|plaza-cerrada|pueblo|obra|mejora`.
import datos from '../plaza/datos.json';
const fetchReal = window.fetch.bind(window);
window.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
  String(url).endsWith('/v1/datos') ? Promise.resolve(new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } })) : fetchReal(url, init)) as typeof fetch;
import '../../src/style.css';
import type { ProyeccionJugador } from '../../src/apiCliente';
import { estadoCliente } from '../../src/ui/estadoCliente';
import { htmlAccionesPuerta } from '../../src/ui/accionesPuerta';
import { cablearAlmacenPuerta, htmlAlmacenPuerta, sitioDePlaza } from '../../src/ui/almacenPuerta';
import { FICHA_OBRA, FICHA_PUEBLO } from '../../src/ui/pueblos';
import type { ContextoFicha } from '../../src/ui/ganchos';

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ver = new URLSearchParams(location.search).get('ver') ?? 'plaza';
const pos = { x: 100, y: 100 };
const plaza = {
  id: 'as-1', nombre: 'Micenas', faccionId: 'f-1', nivel: 3, posicion: pos,
  almacen: { trigo: { cantidad: 640, capacidad: 2000 }, madera: { cantidad: 380, capacidad: 2000 }, piedra: { cantidad: 210, capacidad: 2000 }, cobre: { cantidad: 45, capacidad: 500 }, pan: { cantidad: 120, capacidad: 500 } },
  almacenCerradoACiudadanos: ver === 'plaza-cerrada',
  cargos: { gobernadorId: 'otro', tesoreroId: ver === 'plaza-cerrada' ? 'h' : 'otro2', maestroObrasId: null },
  heroesFundadoresIds: ['h'],
};
const pueblo = { id: 'pueblo-4', tipo: 'minaCobre', madreId: 'as-1', propio: true, posicion: { x: 140, y: 120 }, nivelAldea: 1, almacen: { cobre: 86 }, capacidad: 300, carroId: 'car-9' };
const aldea = { id: 'pueblo-5', tipo: 'aldeaAgricola', cultivo: 'trigo', madreId: 'as-1', propio: true, posicion: { x: 160, y: 80 }, nivelAldea: 1, almacen: { trigo: 120 }, capacidad: 1000 };
const obras = [
  { id: 'obra-6', tipo: 'pueblo', madreId: 'as-1', propia: true, posicion: { x: 60, y: 140 }, nodoId: undefined, requerido: { madera: 400, piedra: 150 }, entregado: { madera: 250, piedra: 40 } },
  { id: 'obra-5', tipo: 'mejoraAldea', madreId: 'as-1', propia: true, posicion: aldea.posicion, destinoId: 'pueblo-5', requerido: { madera: 180, piedra: 60 }, entregado: { madera: 90 } },
];
const enPunto = ver === 'pueblo' ? pueblo.posicion : ver === 'obra' ? obras[0]!.posicion : ver === 'mejora' ? aldea.posicion : pos;
const p = {
  instante: Date.now(), heroeId: 'h', faccionId: 'f-1',
  heroe: { id: 'h', displayName: 'Víctor', ubicacion: { tipo: 'ejercito' }, escuadrones: [], viveres: 999 },
  facciones: [{ id: 'f-1', nombre: 'Casa de Micenas', reyId: 'h', miembros: [{ heroeId: 'h', cargos: ver === 'obra' || ver === 'mejora' ? ['gobernador@as-1'] : [] }] }],
  ejercitos: [{ id: 'ej-1', liderId: 'h', tipo: 'personal', participantes: [{ heroeId: 'h' }], posicionActual: enPunto, estado: 'estacionado', capacidadCarga: 400, suministro: { madera: 60, trigo: 20 } }],
  asentamientos: [plaza], plazasPropias: [plaza], asentamientosAvistados: [], asentamientosConocidos: [], campamentosMercenarios: [],
  pueblos: [pueblo, aldea], obrasDeMapa: obras, caravanas: [], batallas: [], avanzadas: [],
} as unknown as ProyeccionJugador;
estadoCliente.proyeccionUltima = p;

const c: ContextoFicha = {
  ejecutar: async () => null, aviso: () => {}, ejecutarConDatos: async () => ({ error: null }), repintar: () => {}, cerrar: () => {}, escapar: e,
  alcance: () => ({ distancia: 0, impide: '' }), verBatalla: () => {},
};
const escena = document.querySelector<HTMLElement>('#escena')!;
const mundo = document.querySelector<HTMLElement>('#mundo')!;
const ejecutar = async (tipo: string, params: object): Promise<string | null> => { console.log('orden', tipo, JSON.stringify(params)); return null; };
/** La ficha y la ventana «Almacén» en la pantalla del mundo, como en el juego (la ventana centrada). */
function enElMundo(ficha: string, titulo: string, icono: string, html: string, cablear: (cuerpo: HTMLElement) => void): void {
  mundo.hidden = false;
  escena.hidden = true;
  mundo.innerHTML = `<div class="asent-ventana mapa-seleccion">${ficha}</div>
    <section class="asent-ventana puerta-ventana" role="dialog" data-ancho="centrada">
    <header class="asent-ventana-cab"><div class="asent-ventana-titulo"><span class="asent-ventana-icono" aria-hidden="true">${icono}</span><h2>${titulo}</h2></div><button class="asent-ventana-cerrar" type="button">✕</button></header>
    <div class="asent-edif-cuerpo"><div class="asent-lado-cuerpo">${html}</div></div></section>`;
  cablear(mundo.querySelector<HTMLElement>('.asent-edif-cuerpo')!);
}
const ventana = (titulo: string, icono: string, html: string): string => `<section class="asent-ventana puerta-ventana" role="dialog" data-ancho="normal">
  <header class="asent-ventana-cab"><div class="asent-ventana-titulo"><span class="asent-ventana-icono" aria-hidden="true">${icono}</span><h2>${titulo}</h2></div><button class="asent-ventana-cerrar" type="button">✕</button></header>
  <div class="asent-edif-cuerpo"><div class="asent-lado-cuerpo">${html}</div></div></section>`;

function pintar(): void {
  if (ver === 'plaza' || ver === 'plaza-cerrada') {
    // la ficha de la plaza como la pinta main.ts (`puertaDePlaza`): las acciones a la puerta de tu plaza, con la ventana «Almacén» abierta
    const acciones = htmlAccionesPuerta([
      { id: 'marchar', etiqueta: 'Marchar aquí', icono: '➜' }, { id: 'entrar', etiqueta: 'Entrar', icono: '🚪', principal: true },
      { id: 'almacen', etiqueta: 'Almacén', icono: '📦', ventana: true }, { id: 'guarnicion', etiqueta: 'Guarnición', icono: '🛡', ventana: true },
    ], e).replace(/(<button class="[^"]*)("[^>]*data-puerta="almacen")/, '$1 activo$2');
    const sitio = sitioDePlaza(p, plaza as never);
    enElMundo(`<span class="faction-kicker">Tu asentamiento</span><h3>Micenas</h3>
      <div class="mapa-seleccion-datos"><div><span>Facción</span><strong>Casa de Micenas</strong></div><div><span>Nivel</span><strong>3</strong></div><div><span>Distancia</span><strong>0</strong></div></div>${acciones}`,
      'Almacén', '📦', htmlAlmacenPuerta(p, sitio, e), (cuerpo) => cablearAlmacenPuerta(cuerpo, p, sitio, ejecutar, e));
    return;
  }
  if (ver === 'pueblo') {
    const v = FICHA_PUEBLO.ventanas!(p, pueblo as never, { ...c, ejecutar }).almacen!();
    enElMundo(FICHA_PUEBLO.html(p, pueblo as never, c).replace(/(<button class="[^"]*)("[^>]*data-puerta="almacen")/, '$1 activo$2'), v.titulo, v.icono, v.html, v.cablear);
    return;
  }
  const o = ver === 'obra' ? obras[0]! : obras[1]!;
  if (ver === 'mejora') {
    const v = FICHA_PUEBLO.ventanas!(p, aldea as never, c).obra!();
    escena.innerHTML = `<div class="mapa-seleccion">${FICHA_PUEBLO.html(p, aldea as never, c)}</div>${ventana(v.titulo, v.icono, v.html)}`;
    return;
  }
  escena.innerHTML = `<div class="mapa-seleccion">${FICHA_OBRA.html(p, o as never, c)}</div>`;
}
pintar();
// el repintado de las fichas (para cuando llega el balance) solo en las vistas sin clics
if (ver === 'obra' || ver === 'mejora') setTimeout(pintar, 600);
