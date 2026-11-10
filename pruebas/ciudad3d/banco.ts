// Banco de pruebas de la plaza 3D (`npm run ciudad3d`): la vista 3D de la plaza con ciudades reales del motor, sin servidor ni cuenta. Las
// ciudades (`ciudades/*.bin`) son la proyección del interior (`pb.Asentamiento`) de plazas que el motor dejó crecer días con recursos de sobra:
// una aldea de nivel 1, un pueblo de nivel 3 con su empalizada y una ciudad de nivel 5 con su muralla de piedra mejorándose a ciclópea.
// Y tres campamentos de mercenarios (`ciudades/campamento-*.bin`, el `pb.CampamentoMercenarios` que el motor manda estando dentro, con su planta),
// con la planta en SVG de minimapa, como en su pantalla. Y pueblos y aldeas (`pueblos/*.json`: la planta de `urbanismo::planta_de_pueblo` del motor, con la
// forma de `Pueblo.planta` y `trazado`), con el estilo de su madre (el mando «Estilo», hasta el 3).
// Los mandos cambian lo que se dibuja sin tocar el trazado: el estilo (nivel de la plaza), el nivel de la muralla, el avance de las obras,
// la plaza vista como ajena (sin la cola), saqueada (edificios dañados) o subiendo de nivel (las casas cambian por partes).
// `window.banco` deja mover la cámara desde fuera (capturas): `banco.mirar({ x, y, distancia, giro, inclinacion })`. Y la dirección, abrir con los
// mandos puestos (capturas): `?plaza=muestra-comida&estilo=3&muralla=2&cultivo=vid`.
// Tanda 69: la muestra de los talleres de la comida y la estatua («muestra-comida»), la de la muralla con las puertas rectas de la
// `LAYOUT_VERSION` 7 («muestra-muralla», con el mando «Muralla») y el cultivo de las aldeas (el mando «Cultivo»). Desde 0.191.0 (motor b55e90f),
// la bodega de la cerveza y la prensa del sésamo en «muestra-comida», y la cebada y el sésamo en «Cultivo».
import { fromBinary } from '@bufbuild/protobuf';
import { AsentamientoSchema, CampamentoMercenariosSchema } from '../../src/contrato/gen/bronzeage/v1/entities_pb';
import { campamentoEnVista } from '../../src/ciudad3d/campamento';
import { puebloEnVista } from '../../src/ciudad3d/pueblo';
import { ciudadEnVista, hash3, hashTexto, type CiudadEnVista, type FuenteDeCiudad } from '../../src/ciudad3d/estado';
import { encuadreDeSvg, Minimapa } from '../../src/ciudad3d/minimapa';
import { VistaCiudad3D } from '../../src/ciudad3d/vista';
import { escenaCampamento, plazaDeContrato } from '../../src/motor/proyeccion';
import { EDIFICIO_NOMBRE } from '../../src/paletas';
import { pintarAsentamiento } from '../../src/render';
import type { Asentamiento, EscenaCampamento, EscenaPueblo, RectanguloLocal, TrazadoAsentamiento } from '../../src/tiposDominio';
import { svgPlanoCampamento } from '../../src/ui/planoCampamento';
import { svgPlanoPueblo } from '../../src/ui/planoPueblo';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Las horas que vivió cada ciudad en el motor: su instante de mundo al volcarla. */
const DIAS: Record<string, number> = { aldea: 3, pueblo: 8, ciudad: 16 };
const HORA = 3_600_000;

/** Lee una ciudad. En la página publicada van dentro como `data:` (y la política de la página no deja hacer `fetch` de un `data:`): se decodifica aquí. */
async function leerBinario(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const b64 = url.slice(url.indexOf(',') + 1), s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

const cache = new Map<string, { asentamiento: Asentamiento; trazado: TrazadoAsentamiento | undefined }>();
async function cargar(nombre: string): Promise<{ asentamiento: Asentamiento; trazado: TrazadoAsentamiento | undefined }> {
  const hecho = cache.get(nombre);
  if (hecho) return hecho;
  const pb = fromBinary(AsentamientoSchema, await leerBinario(new URL(`./ciudades/${nombre}.bin`, import.meta.url).href));
  const p = plazaDeContrato(pb, DIAS[nombre]! * 24 * HORA);
  cache.set(nombre, p);
  return p;
}

const camps = new Map<string, EscenaCampamento>();
async function cargarCampamento(nombre: string): Promise<EscenaCampamento> {
  const hecho = camps.get(nombre);
  if (hecho) return hecho;
  const e = escenaCampamento(fromBinary(CampamentoMercenariosSchema, await leerBinario(new URL(`./ciudades/${nombre}.bin`, import.meta.url).href)))!;
  camps.set(nombre, e);
  return e;
}

type RectJson = { x: number; y: number; ancho: number; alto: number };
interface PuebloJson {
  id: string;
  tipoExtractor: string;
  planta: { id: string; tipo: string; posicion: { x: number; y: number }; ancho: number; alto: number }[];
  trazado: { unidadesPorCelda: number; radioUl: number; calles: RectJson[]; caminos: RectJson[] };
}
const pueblos = new Map<string, PuebloJson>();
async function cargarPueblo(nombre: string): Promise<PuebloJson> {
  const hecho = pueblos.get(nombre);
  if (hecho) return hecho;
  const j = JSON.parse(new TextDecoder().decode(await leerBinario(new URL(`./pueblos/${nombre}.json`, import.meta.url).href))) as PuebloJson;
  pueblos.set(nombre, j);
  return j;
}

let seleccion: { id: string; tipo: string } | null = null;
let campActual: CiudadEnVista | null = null;
const vista = new VistaCiudad3D($('escena'), {
  alElegir: (id) => {
    const e = actual?.asentamiento.edificios.find((x) => x.id === id) ?? campActual?.edificios.find((x) => x.id === id);
    seleccion = e ? { id: e.id, tipo: e.tipo } : null;
    vista.seleccionar(seleccion);
    $('ficha').textContent = e ? `${EDIFICIO_NOMBRE[e.tipo] ?? e.tipo} · ${e.id} · ${e.estado}${'danado' in e && e.danado ? ' · dañado' : ''}${e.mejora ? ' · mejorando' : ''}` : 'Clic en un edificio.';
    if (actual) repintarMini();
  },
  // en la plaza, la muralla abre Defensa (en el banco, se dice en la ficha)
  alElegirMuralla: (m) => { $('ficha').textContent = `${m.clase === 'puerta' ? 'Puerta' : m.clase === 'torre' ? 'Torre' : 'Muralla'} · ${m.recintoId} · ${m.enPie ? `nivel ${m.nivel}` : 'sin levantar'} → Defensa`; },
  alMover: (h) => { minimapa.fijarHuella(h); miniCamp.fijarHuella(h); },
  rotulo: (e) => `${e.mejora ? 'Mejora' : 'Obra'} ${Math.round((e.avance ?? 0) * 100)} %`,
});
const lienzo2d = $<HTMLCanvasElement>('mapa');
const minimapa = new Minimapa(lienzo2d);
lienzo2d.addEventListener('click', (e) => vista.centrar(minimapa.puntoLocal(e)));
const plano = document.getElementById('plano') as unknown as SVGSVGElement;
const miniCamp = new Minimapa(plano);
$('mini-camp').addEventListener('click', (e) => vista.centrar(miniCamp.puntoLocal(e)));

let actual: { asentamiento: Asentamiento; trazado: TrazadoAsentamiento | undefined } | null = null;

function repintarMini(): void {
  if (!actual) return;
  pintarAsentamiento(lienzo2d.getContext('2d')!, actual.asentamiento, actual.trazado, seleccion, null, true);
  minimapa.fijarTrazado(actual.trazado);
}

/** Un campamento: siempre de nivel 1, sin obras ni mandos que tocar. */
async function rehacerCampamento(nombre: string): Promise<void> {
  const e = await cargarCampamento(nombre);
  actual = null;
  // la planta en SVG, como en su pantalla: se cambia el SVG entero y la capa de la cámara toma su encuadre
  fijarPlano(svgPlanoCampamento(e));
  const c = campamentoEnVista(e, { instante: 0 });
  campActual = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  const cuentas = vista.cuentas();
  $('lectura').textContent = `${nombre}: ${c?.edificios.length ?? 0} piezas, empalizada de ${c?.recintos[0]?.celdas.length ?? 0} celdas (${c?.recintos.length ?? 0} anillo${c?.recintos.length === 1 ? '' : 's'}, ${c?.recintos[0]?.cerrado ? 'cerrado' : 'abierto'}), ${c?.libres.length ?? 0} celdas libres\npiezas: ${cuentas.edificios} edificios · ${cuentas.murallas} muralla · ${cuentas.relleno} relleno`;
}

/** Pone un plano en SVG de minimapa (el del campamento o el del pueblo). */
function fijarPlano(svgTexto: string): void {
  $('mini').hidden = true;
  $('mini-camp').hidden = false;
  const svg = new DOMParser().parseFromString(svgTexto, 'image/svg+xml').documentElement;
  for (const a of ['viewBox', 'preserveAspectRatio']) plano.setAttribute(a, svg.getAttribute(a) ?? '');
  plano.innerHTML = svg.innerHTML;
  const encuadre = encuadreDeSvg(plano);
  if (encuadre) miniCamp.fijarEncuadre(encuadre);
}

/** Un pueblo o una aldea: la planta del motor con el estilo de su madre (el mando «Estilo»; si no, 2). */
async function rehacerPueblo(nombre: string): Promise<void> {
  const j = await cargarPueblo(nombre);
  actual = null;
  const estilo = $<HTMLSelectElement>('nivel').value, cultivo = j.tipoExtractor === 'aldeaAgricola' ? $<HTMLSelectElement>('cultivo').value || undefined : undefined;
  // la aldea de viñas o de olivos no tiene corrales (tanda 69), salvo el del buey, el primero de la planta: las plantas del banco son de trigo
  const corralDelBuey = j.planta.findIndex((p) => p.tipo === 'corral');
  const planta = cultivo ? j.planta.filter((p, i) => p.tipo !== 'corral' || i === corralDelBuey) : j.planta;
  const e: EscenaPueblo = {
    puebloId: j.id, tipo: j.tipoExtractor, nivelMadre: estilo ? Number(estilo) : 2, unidadesPorCelda: j.trazado.unidadesPorCelda, radio: j.trazado.radioUl,
    edificios: planta.map((p) => ({ edificioId: p.id, tipo: p.tipo, posicion: { x: p.posicion.x / 1000, y: p.posicion.y / 1000 }, ancho: p.ancho, alto: p.alto })),
    calles: j.trazado.calles, caminos: j.trazado.caminos, cultivo,
  };
  fijarPlano(svgPlanoPueblo(e));
  const c = puebloEnVista(e, { instante: 0 });
  campActual = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  const cuentas = vista.cuentas();
  $('lectura').textContent = `${nombre}: ${j.tipoExtractor}${e.cultivo ? ` de ${e.cultivo}` : ''}, estilo ${c?.nivel}, ${c?.edificios.length ?? 0} piezas, radio ${c?.radio} ul, ${c?.libres.length ?? 0} celdas libres\npiezas: ${cuentas.edificios} edificios · ${cuentas.relleno} relleno`;
}

/**
 * El Albergue de caravanas en todos sus estilos (columnas, del 1 al 5) y sus niveles (filas, del 1 al 3), cada uno con su calle delante, a la que
 * da su portón. Una plaza de mentira con su trazado: lo demás es la proyección de verdad (`ciudadEnVista`); solo se fija el estilo de cada uno.
 */
function rehacerMuestra(): void {
  actual = null;
  ultima = null;
  $('mini').hidden = true;
  $('mini-camp').hidden = true;
  const edificios: Asentamiento['edificios'] = [], huellas: Record<string, RectanguloLocal> = {}, calles: RectanguloLocal[] = [];
  for (let n = 1; n <= 3; n++) {
    const y = -18 + (n - 1) * 12;
    calles.push({ x: -33, y: y + 6, ancho: 63, alto: 3 });
    for (let estilo = 1; estilo <= 5; estilo++) {
      const id = `albergue-e${estilo}-n${n}`, x = -30 + (estilo - 1) * 12;
      edificios.push({ id, tipo: 'albergueCaravanas', estado: 'activo', posicion: { x: x + 4.5, y: y + 3 }, nivelInterno: n });
      huellas[id] = { x, y, ancho: 9, alto: 6 };
    }
  }
  for (let k = 0; k < 4; k++) calles.push({ x: -21 + k * 12, y: -18, ancho: 3, alto: 33 });
  const a: FuenteDeCiudad = { id: 'muestra-albergue', nivel: 3, edificios, recintos: [], ascenso: undefined };
  const c = ciudadEnVista(a, { calles, caminos: [], huellas, murallas: [], radio: 36, celda: 3 }, { instante: 0 })!;
  for (const e of c.edificios) e.estilo = Number(/-e(\d)-/.exec(e.id)![1]);
  campActual = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  const cuentas = vista.cuentas();
  $('lectura').textContent = `Albergue de caravanas: estilo 1 a 5 de izquierda a derecha, nivel 1 a 3 de arriba abajo\npiezas: ${cuentas.edificios} edificios · ${cuentas.relleno} relleno`;
}

/** Los talleres de la comida y la estatua (tanda 69), cada fila un tipo y cada columna un estilo (del 1 al 5), con su calle delante. */
const FILAS_COMIDA: { tipo: string; ancho: number; alto: number; buey?: boolean; receta?: string }[] = [
  { tipo: 'molino', ancho: 6, alto: 6 },
  { tipo: 'molino', ancho: 6, alto: 6, buey: true },
  { tipo: 'horno', ancho: 6, alto: 3 },
  { tipo: 'quesera', ancho: 6, alto: 3 },
  { tipo: 'bodega', ancho: 6, alto: 6 },
  // la bodega de la cerveza y la prensa del sésamo (motor b55e90f: `Edificio.receta`)
  { tipo: 'bodega', ancho: 6, alto: 6, receta: 'cebada' },
  { tipo: 'prensa', ancho: 6, alto: 3 },
  { tipo: 'prensa', ancho: 6, alto: 3, receta: 'sesamo' },
  { tipo: 'estatua', ancho: 3, alto: 3 },
];

function rehacerComida(): void {
  actual = null;
  ultima = null;
  $('mini').hidden = true;
  $('mini-camp').hidden = true;
  const edificios: Asentamiento['edificios'] = [], huellas: Record<string, RectanguloLocal> = {}, calles: RectanguloLocal[] = [];
  let y = -30;
  FILAS_COMIDA.forEach((f, i) => {
    calles.push({ x: -24, y: y + f.alto, ancho: 48, alto: 3 });
    for (let estilo = 1; estilo <= 5; estilo++) {
      const id = `${f.tipo}${f.buey ? '-buey' : ''}${f.receta ? `-${f.receta}` : ''}-e${estilo}-f${i}`, x = -22.5 + (estilo - 1) * 9 + (6 - f.ancho) / 2;
      edificios.push({ id, tipo: f.tipo, estado: 'activo', posicion: { x: x + f.ancho / 2, y: y + f.alto / 2 }, buey: f.buey, receta: f.receta });
      huellas[id] = { x, y, ancho: f.ancho, alto: f.alto };
    }
    y += f.alto + 3;
  });
  for (let k = 0; k < 4; k++) calles.push({ x: -16.5 + k * 9, y: -30, ancho: 3, alto: y + 30 - 3 });
  const a: FuenteDeCiudad = { id: 'muestra-comida', nivel: 3, edificios, recintos: [], ascenso: undefined };
  const c = ciudadEnVista(a, { calles, caminos: [], huellas, murallas: [], radio: 40, celda: 3 }, { instante: 0 })!;
  for (const e of c.edificios) e.estilo = Number(/-e(\d)-/.exec(e.id)![1]);
  campActual = c;
  ultima = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  const cuentas = vista.cuentas();
  $('lectura').textContent = `Talleres de la comida y estatua: estilo 1 a 5 de izquierda a derecha; molino, molino con buey, horno, quesera, bodega de vino, bodega de cerveza, prensa de aceituna, prensa de sésamo y estatua de arriba abajo\npiezas: ${cuentas.edificios} edificios · ${cuentas.relleno} relleno`;
}

/**
 * Una muralla de muestra con las puertas de la `LAYOUT_VERSION` 7 del motor (tanda 69: toda puerta con dos celdas de muro recto a cada lado):
 * un anillo cuadrado de 11 × 11 celdas con una puerta de una celda al sur, una de dos al norte y torres en las esquinas, y la calle que lo
 * cruza por las dos. El nivel, el del mando «Muralla» (sin él, 2).
 */
function rehacerMuralla(): void {
  actual = null;
  ultima = null;
  $('mini').hidden = true;
  $('mini-camp').hidden = true;
  const h = 5, celdas: { col: number; row: number; clase: 'muro' | 'puerta' | 'torre' }[] = [];
  const clase = (col: number, row: number): 'muro' | 'puerta' | 'torre' =>
    (row === h && col === 0) || (row === -h && (col === 0 || col === -1)) ? 'puerta' : Math.abs(col) === h && Math.abs(row) === h ? 'torre' : 'muro';
  for (let c = -h; c <= h; c++) celdas.push({ col: c, row: -h, clase: clase(c, -h) });
  for (let r = -h + 1; r <= h; r++) celdas.push({ col: h, row: r, clase: clase(h, r) });
  for (let c = h - 1; c >= -h; c--) celdas.push({ col: c, row: h, clase: clase(c, h) });
  for (let r = h - 1; r > -h; r--) celdas.push({ col: -h, row: r, clase: clase(-h, r) });
  // `&gruesa=1` (0.198.1): la de la captura de Víctor del 2026-11-10, un anillo de 10 × 8 con el rincón de arriba a la izquierda metido, una celda
  // de más en el codo y otra que sobresale junto a la puerta, en el orden de obra del motor (lo que el paseo se saltó, al final)
  if (new URLSearchParams(location.search).get('gruesa')) {
    celdas.length = 0;
    const k = (col: number, row: number, c: 'muro' | 'puerta' | 'torre' = 'muro') => celdas.push({ col: col - 5, row: row - 4, clase: c });
    k(9, 4, 'puerta'); k(9, 5); k(9, 6); k(9, 7);
    for (const c of [8, 7, 6, 5, 4, 3, 2, 1, 0]) k(c, 7);
    k(0, 6); k(0, 5, 'torre'); k(0, 4); k(0, 3); k(1, 3); k(2, 3); k(3, 3); k(3, 2); k(3, 1); k(3, 0);
    for (const c of [4, 5, 6, 7, 8, 9]) k(c, 0);
    k(9, 1); k(9, 2); k(9, 3); k(10, 3); k(2, 4);
  }
  const nivel = Number($<HTMLSelectElement>('muralla').value || 2);
  const a: FuenteDeCiudad = { id: 'muestra-muralla', nivel: 3, edificios: [], recintos: [{ id: 'recinto-muestra', nivel, celdas, avance: celdas.length }], ascenso: undefined };
  const calles: RectanguloLocal[] = [{ x: 0, y: 0, ancho: 3, alto: 3 * (h + 4) }, { x: -3, y: -3 * (h + 4), ancho: 6, alto: 3 * (h + 4) }];
  const c = ciudadEnVista(a, { calles, caminos: [], huellas: {}, murallas: [], radio: 3 * (h + 2), celda: 3 }, { instante: 0 })!;
  campActual = c;
  ultima = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  const cuentas = vista.cuentas();
  $('lectura').textContent = `Muralla de nivel ${nivel}: puertas rectas (una de una celda al sur, una de dos al norte)\npiezas: ${cuentas.murallas} muralla · ${cuentas.relleno} relleno`;
}

/**
 * Pone un Albergue de caravanas de nivel `nivel` en una plaza del banco (las del motor no lo tienen): en el hueco libre de 2 × 3 celdas, dentro
 * del disco urbano (y de la muralla, si la hay) y con calle a lo largo de un lado largo (mejor entero), más cerca del Mercado (su ancla en el
 * motor).
 */
function conAlbergue(a: Asentamiento, t: TrazadoAsentamiento, nivel: number): { asentamiento: Asentamiento; trazado: TrazadoAsentamiento } {
  const T = t.celda ?? 3, clave = (c: number, f: number): string => `${c},${f}`, ocupada = new Set<string>(), calle = new Set<string>();
  const marcar = (r: RectanguloLocal, s: Set<string>): void => {
    for (let c = Math.floor(r.x / T + 1e-6); c < Math.ceil((r.x + r.ancho) / T - 1e-6); c++) for (let f = Math.floor(r.y / T + 1e-6); f < Math.ceil((r.y + r.alto) / T - 1e-6); f++) s.add(clave(c, f));
  };
  for (const r of [...t.calles, ...t.caminos]) { marcar(r, ocupada); marcar(r, calle); }
  for (const r of Object.values(t.huellas)) marcar(r, ocupada);
  for (const r of a.recintos ?? []) for (const k of r.celdas) ocupada.add(clave(k.col, k.row));
  const mercado = a.edificios.find((e) => e.tipo === 'mercado'), hm = mercado ? t.huellas[mercado.id] : undefined;
  const ancla = hm ? { x: hm.x + hm.ancho / 2, y: hm.y + hm.alto / 2 } : { x: 0, y: 0 }, radio = t.radio ?? 40, R = Math.ceil(radio / T);
  // con muralla, lo de fuera: lo que se alcanza desde el borde sin pisar una celda de muro (de lado, que la muralla también va en diagonal)
  const fuera = new Set<string>();
  if ((a.recintos ?? []).length) {
    const muro = new Set((a.recintos ?? []).flatMap((r) => r.celdas.map((k) => clave(k.col, k.row)))), cola: [number, number][] = [];
    for (let k = -R - 1; k <= R + 1; k++) cola.push([k, -R - 1], [k, R + 1], [-R - 1, k], [R + 1, k]);
    while (cola.length) {
      const [c, f] = cola.pop()!;
      if (Math.abs(c) > R + 1 || Math.abs(f) > R + 1 || fuera.has(clave(c, f)) || muro.has(clave(c, f))) continue;
      fuera.add(clave(c, f));
      cola.push([c + 1, f], [c - 1, f], [c, f + 1], [c, f - 1]);
    }
  }
  const buscar = (dentro: boolean): { r: RectanguloLocal; d: number } | null => {
    let mejor: { r: RectanguloLocal; d: number } | null = null;
    for (const [w, h] of [[3, 2], [2, 3]] as const) for (let c = -R; c <= R; c++) for (let f = -R; f <= R; f++) {
      let libre = true;
      for (let i = 0; i < w && libre; i++) for (let j = 0; j < h && libre; j++) if (ocupada.has(clave(c + i, f + j)) || (dentro && fuera.has(clave(c + i, f + j)))) libre = false;
      const r = { x: c * T, y: f * T, ancho: w * T, alto: h * T };
      if (!libre || Math.hypot(r.x + r.ancho / 2, r.y + r.alto / 2) + 5 > radio) continue;
      // cuántas celdas de calle tiene pegadas su mejor lado largo (el motor lo pone con calle delante); se prefiere el lado entero
      const cuenta = (n: number, k: (i: number) => string): number => Array.from({ length: n }, (_, i) => k(i)).filter((x) => calle.has(x)).length;
      const pegadas = w > h ? Math.max(cuenta(w, (i) => clave(c + i, f + h)), cuenta(w, (i) => clave(c + i, f - 1))) : Math.max(cuenta(h, (j) => clave(c - 1, f + j)), cuenta(h, (j) => clave(c + w, f + j)));
      if (pegadas < 2) continue;
      const d = Math.hypot(r.x + r.ancho / 2 - ancla.x, r.y + r.alto / 2 - ancla.y) + (3 - pegadas) * 30;
      if (!mejor || d < mejor.d) mejor = { r, d };
    }
    return mejor;
  };
  // dentro de la muralla si cabe; las plazas del banco van muy llenas y a veces no cabe más que fuera
  const mejor = buscar(true) ?? buscar(false);
  if (!mejor) return { asentamiento: a, trazado: t };
  const id = 'albergue-banco', r = mejor.r;
  return {
    asentamiento: { ...a, edificios: [...a.edificios, { id, tipo: 'albergueCaravanas', estado: 'activo', ambito: 'asentamiento', posicion: { x: r.x + r.ancho / 2, y: r.y + r.alto / 2 }, nivelInterno: nivel }] },
    trazado: { ...t, huellas: { ...t.huellas, [id]: r } },
  };
}

let ultima: CiudadEnVista | null = null;

async function rehacer(): Promise<void> {
  const nombre = $<HTMLSelectElement>('ciudad').value;
  if (nombre.startsWith('campamento')) return rehacerCampamento(nombre);
  if (nombre.startsWith('pueblos/')) return rehacerPueblo(nombre.slice('pueblos/'.length));
  if (nombre === 'muestra-albergue') return rehacerMuestra();
  if (nombre === 'muestra-comida') return rehacerComida();
  if (nombre === 'muestra-muralla') return rehacerMuralla();
  campActual = null;
  $('mini').hidden = false;
  $('mini-camp').hidden = true;
  const cargada = await cargar(nombre), albergue = $<HTMLSelectElement>('albergue').value;
  const base = albergue && cargada.trazado ? conAlbergue(cargada.asentamiento, cargada.trazado, Number(albergue)) : cargada;
  const instante = DIAS[nombre]! * 24 * HORA;
  const nivel = $<HTMLSelectElement>('nivel').value, muralla = $<HTMLSelectElement>('muralla').value;
  const obras = Number($<HTMLInputElement>('obras').value) / 100;
  const ajena = $<HTMLInputElement>('ajena').checked, saqueo = $<HTMLInputElement>('saqueo').checked, ascenso = $<HTMLInputElement>('ascenso').checked;
  // una copia con los mandos aplicados (el trazado no se toca)
  let edificios = base.asentamiento.edificios.map((e) => {
    if (saqueo && e.estado === 'activo' && e.tipo !== 'centroUrbano' && hashTexto(e.id, 3) < 0.3) return { ...e, estado: 'en_cola' as const, danado: true, mejora: undefined, completaEn: undefined };
    return e;
  });
  if (ajena) edificios = edificios.filter((e) => e.estado !== 'en_cola' || e.danado);
  const a: Asentamiento = {
    ...base.asentamiento,
    nivel: nivel ? Number(nivel) : base.asentamiento.nivel,
    edificios,
    recintos: (base.asentamiento.recintos ?? []).map((r) => (muralla ? { ...r, nivel: Number(muralla), mejorandoA: undefined, mejoradas: undefined, avance: r.celdas.length } : r)),
    ascenso: ascenso ? { nivelObjetivo: Math.min(5, (nivel ? Number(nivel) : base.asentamiento.nivel) + 1), iniciadoEn: instante - obras * 10 * HORA, completaEn: instante + (1 - obras) * 10 * HORA } : undefined,
  };
  actual = { asentamiento: a, trazado: base.trazado };
  // las obras: la barra de «Obras» fija su avance (el banco no tiene el catálogo: toda obra dura una hora)
  const c = ciudadEnVista(a, base.trazado, { instante, minutosDeObra: () => 60 });
  if (c) for (const e of c.edificios) if (e.avance !== null) e.avance = Math.max(0, Math.min(1, obras + (hash3(e.semilla, 1, 1) - 0.5) * 0.3));
  ultima = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  repintarMini();
  const n = c?.edificios.length ?? 0, cuentas = vista.cuentas();
  $('lectura').textContent = `${nombre}: nivel ${a.nivel}, radio ${c?.radio} ul, ${n} edificios, ${c?.recintos.length ?? 0} recintos, ${c?.libres.length ?? 0} celdas libres\npiezas: ${cuentas.edificios} edificios · ${cuentas.murallas} muralla · ${cuentas.relleno} relleno`;
}

for (const id of ['ciudad', 'nivel', 'muralla', 'albergue', 'cultivo', 'obras', 'ajena', 'saqueo', 'ascenso']) $(id).addEventListener(id === 'obras' ? 'input' : 'change', () => void rehacer());
setInterval(() => {
  const r = vista.rendimiento();
  const t = $('lectura').textContent?.split('\n').slice(0, 2).join('\n') ?? '';
  $('lectura').textContent = `${t}\nms: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(' · ')}`;
}, 1000);

// los mandos de la dirección (capturas): ?plaza=…&estilo=…&muralla=…&albergue=…&cultivo=…
{
  const q = new URLSearchParams(location.search);
  for (const [k, id] of [['plaza', 'ciudad'], ['estilo', 'nivel'], ['muralla', 'muralla'], ['albergue', 'albergue'], ['cultivo', 'cultivo']] as const) {
    const v = q.get(k);
    if (v !== null) $<HTMLSelectElement>(id).value = v;
  }
}
void rehacer();

/** Para las capturas: mover la cámara desde fuera. */
(window as unknown as { banco: unknown }).banco = {
  vista,
  rehacer,
  /** Dónde está un edificio de la plaza que se ve (su huella, en ul). */
  huella(id: string) { const e = (ultima ?? campActual)?.edificios.find((x) => x.id === id); return e ? { x: e.x, y: e.y, ancho: e.ancho, alto: e.alto, frente: e.frente, estilo: e.estilo } : null; },
  mirar(o: { x?: number; y?: number; distancia?: number; giro?: number; inclinacion?: number }) {
    const p = (vista.camara as unknown as { pedido: Record<string, number> }).pedido;
    Object.assign(p, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
  },
};
