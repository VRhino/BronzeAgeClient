// Banco de pruebas de la plaza 3D (`npm run ciudad3d`): la vista 3D de la plaza con ciudades reales del motor, sin servidor ni cuenta. Las
// ciudades (`ciudades/*.bin`) son la proyección del interior (`pb.Asentamiento`) de plazas que el motor dejó crecer días con recursos de sobra:
// una aldea de nivel 1, un pueblo de nivel 3 con su empalizada y una ciudad de nivel 5 con su muralla de piedra mejorándose a ciclópea.
// Los mandos cambian lo que se dibuja sin tocar el trazado: el estilo (nivel de la plaza), el nivel de la muralla, el avance de las obras,
// la plaza vista como ajena (sin la cola), saqueada (edificios dañados) o subiendo de nivel (las casas cambian por partes).
// `window.banco` deja mover la cámara desde fuera (capturas): `banco.mirar({ x, y, distancia, giro, inclinacion })`.
import { fromBinary } from '@bufbuild/protobuf';
import { AsentamientoSchema } from '../../src/contrato/gen/bronzeage/v1/entities_pb';
import { ciudadEnVista, hash3, hashTexto } from '../../src/ciudad3d/estado';
import { Minimapa } from '../../src/ciudad3d/minimapa';
import { VistaCiudad3D } from '../../src/ciudad3d/vista';
import { plazaDeContrato } from '../../src/motor/proyeccion';
import { EDIFICIO_NOMBRE } from '../../src/paletas';
import { pintarAsentamiento } from '../../src/render';
import type { Asentamiento, TrazadoAsentamiento } from '../../src/tiposDominio';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Las horas que vivió cada ciudad en el motor: su instante de mundo al volcarla. */
const DIAS: Record<string, number> = { aldea: 3, pueblo: 8, ciudad: 16 };
const HORA = 3_600_000;

const cache = new Map<string, { asentamiento: Asentamiento; trazado: TrazadoAsentamiento | undefined }>();
async function cargar(nombre: string): Promise<{ asentamiento: Asentamiento; trazado: TrazadoAsentamiento | undefined }> {
  const hecho = cache.get(nombre);
  if (hecho) return hecho;
  const r = await fetch(new URL(`./ciudades/${nombre}.bin`, import.meta.url));
  const pb = fromBinary(AsentamientoSchema, new Uint8Array(await r.arrayBuffer()));
  const p = plazaDeContrato(pb, DIAS[nombre]! * 24 * HORA);
  cache.set(nombre, p);
  return p;
}

let seleccion: { id: string; tipo: string } | null = null;
const vista = new VistaCiudad3D($('escena'), {
  alElegir: (id) => {
    const e = actual?.asentamiento.edificios.find((x) => x.id === id);
    seleccion = e ? { id: e.id, tipo: e.tipo } : null;
    vista.seleccionar(seleccion);
    $('ficha').textContent = e ? `${EDIFICIO_NOMBRE[e.tipo] ?? e.tipo} · ${e.id} · ${e.estado}${e.danado ? ' · dañado' : ''}${e.mejora ? ' · mejorando' : ''}` : 'Clic en un edificio.';
    repintarMini();
  },
  alMover: (h) => minimapa.fijarHuella(h),
  rotulo: (e) => `${e.mejora ? 'Mejora' : 'Obra'} ${Math.round((e.avance ?? 0) * 100)} %`,
});
const lienzo2d = $<HTMLCanvasElement>('mapa');
const minimapa = new Minimapa(lienzo2d);
lienzo2d.addEventListener('click', (e) => vista.centrar(minimapa.puntoLocal(e)));

let actual: { asentamiento: Asentamiento; trazado: TrazadoAsentamiento | undefined } | null = null;

function repintarMini(): void {
  if (!actual) return;
  pintarAsentamiento(lienzo2d.getContext('2d')!, actual.asentamiento, actual.trazado, seleccion, null, true);
  minimapa.fijarTrazado(actual.trazado);
}

async function rehacer(): Promise<void> {
  const nombre = $<HTMLSelectElement>('ciudad').value;
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
