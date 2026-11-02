// Banco de pruebas de la plaza 3D (`npm run ciudad3d`): la vista 3D de la plaza con ciudades reales del motor, sin servidor ni cuenta. Las
// ciudades (`ciudades/*.bin`) son la proyección del interior (`pb.Asentamiento`) de plazas que el motor dejó crecer días con recursos de sobra:
// una aldea de nivel 1, un pueblo de nivel 3 con su empalizada y una ciudad de nivel 5 con su muralla de piedra mejorándose a ciclópea.
// Y tres campamentos de mercenarios (`ciudades/campamento-*.bin`, el `pb.CampamentoMercenarios` que el motor manda estando dentro, con su planta),
// con la planta en SVG de minimapa, como en su pantalla. Y pueblos y aldeas (`pueblos/*.json`: la planta de `urbanismo::planta_de_pueblo` del motor, con la
// forma de `Pueblo.planta` y `trazado`), con el estilo de su madre (el mando «Estilo», hasta el 3).
// Los mandos cambian lo que se dibuja sin tocar el trazado: el estilo (nivel de la plaza), el nivel de la muralla, el avance de las obras,
// la plaza vista como ajena (sin la cola), saqueada (edificios dañados) o subiendo de nivel (las casas cambian por partes).
// `window.banco` deja mover la cámara desde fuera (capturas): `banco.mirar({ x, y, distancia, giro, inclinacion })`.
import { fromBinary } from '@bufbuild/protobuf';
import { AsentamientoSchema, CampamentoMercenariosSchema } from '../../src/contrato/gen/bronzeage/v1/entities_pb';
import { campamentoEnVista } from '../../src/ciudad3d/campamento';
import { puebloEnVista } from '../../src/ciudad3d/pueblo';
import { ciudadEnVista, hash3, hashTexto, type CiudadEnVista } from '../../src/ciudad3d/estado';
import { encuadreDeSvg, Minimapa } from '../../src/ciudad3d/minimapa';
import { VistaCiudad3D } from '../../src/ciudad3d/vista';
import { escenaCampamento, plazaDeContrato } from '../../src/motor/proyeccion';
import { EDIFICIO_NOMBRE } from '../../src/paletas';
import { pintarAsentamiento } from '../../src/render';
import type { Asentamiento, EscenaCampamento, EscenaPueblo, TrazadoAsentamiento } from '../../src/tiposDominio';
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
  const estilo = $<HTMLSelectElement>('nivel').value;
  const e: EscenaPueblo = {
    puebloId: j.id, tipo: j.tipoExtractor, nivelMadre: estilo ? Number(estilo) : 2, unidadesPorCelda: j.trazado.unidadesPorCelda, radio: j.trazado.radioUl,
    edificios: j.planta.map((p) => ({ edificioId: p.id, tipo: p.tipo, posicion: { x: p.posicion.x / 1000, y: p.posicion.y / 1000 }, ancho: p.ancho, alto: p.alto })),
    calles: j.trazado.calles, caminos: j.trazado.caminos,
  };
  fijarPlano(svgPlanoPueblo(e));
  const c = puebloEnVista(e, { instante: 0 });
  campActual = c;
  vista.fijar(c);
  vista.seleccionar(seleccion);
  const cuentas = vista.cuentas();
  $('lectura').textContent = `${nombre}: ${j.tipoExtractor}, estilo ${c?.nivel}, ${c?.edificios.length ?? 0} piezas, radio ${c?.radio} ul, ${c?.libres.length ?? 0} celdas libres\npiezas: ${cuentas.edificios} edificios · ${cuentas.relleno} relleno`;
}

async function rehacer(): Promise<void> {
  const nombre = $<HTMLSelectElement>('ciudad').value;
  if (nombre.startsWith('campamento')) return rehacerCampamento(nombre);
  if (nombre.startsWith('pueblos/')) return rehacerPueblo(nombre.slice('pueblos/'.length));
  campActual = null;
  $('mini').hidden = false;
  $('mini-camp').hidden = true;
  const base = await cargar(nombre);
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
  vista.fijar(c);
  vista.seleccionar(seleccion);
  repintarMini();
  const n = c?.edificios.length ?? 0, cuentas = vista.cuentas();
  $('lectura').textContent = `${nombre}: nivel ${a.nivel}, radio ${c?.radio} ul, ${n} edificios, ${c?.recintos.length ?? 0} recintos, ${c?.libres.length ?? 0} celdas libres\npiezas: ${cuentas.edificios} edificios · ${cuentas.murallas} muralla · ${cuentas.relleno} relleno`;
}

for (const id of ['ciudad', 'nivel', 'muralla', 'obras', 'ajena', 'saqueo', 'ascenso']) $(id).addEventListener(id === 'obras' ? 'input' : 'change', () => void rehacer());
setInterval(() => {
  const r = vista.rendimiento();
  const t = $('lectura').textContent?.split('\n').slice(0, 2).join('\n') ?? '';
  $('lectura').textContent = `${t}\nms: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(' · ')}`;
}, 1000);

void rehacer();

/** Para las capturas: mover la cámara desde fuera. */
(window as unknown as { banco: unknown }).banco = {
  vista,
  rehacer,
  mirar(o: { x?: number; y?: number; distancia?: number; giro?: number; inclinacion?: number }) {
    const p = (vista.camara as unknown as { pedido: Record<string, number> }).pedido;
    Object.assign(p, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
  },
};
