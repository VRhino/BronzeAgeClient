// Banco de pruebas del mundo 3D (`npm run mundo3d`): la vista del modo mundo con el artefacto y el relieve reales del motor, sin servidor ni
// cuenta. Una columna propia que va en línea recta adonde se hace clic, a 30 u/min, y una niebla de mentira: se explora lo que se ve y se ve lo
// que cae en el radio de visión. Los campamentos de mercenarios son los del artefacto; junto al héroe hay un mundo de mentira para mirarlo sin
// partida: una plaza propia con su zona, sus pueblos, avanzadas y obras, una plaza ajena que se ve y otra que se recuerda, caminos, una columna
// ajena en formación, caravanas, bandidos, un alijo, una batalla y dos Miradas. Un clic cerca de algo lo selecciona (como en el juego); en el
// suelo, la columna va allí. «Fundar aquí» enciende la vista previa de fundar alrededor del héroe.
// `?x=…&y=…` pone el héroe en otro sitio; `?raster` usa el raster de 4 u del artefacto en vez del relieve; `?sinMaquetas` quita lo de mentira.
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema, PaqueteRelieveSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { Relieve } from '../../src/mundo/relieve';
import { ANCHOS, mundoVacio, type CaravanaEnVista, type ColumnaEnVista, type EstadoVista, type EtiquetaEnVista, type FundacionEnVista, type MiradaEnVista, type MundoEnVista, type SeleccionEnVista } from '../../src/mundo3d/estado';
import { circulo } from '../../src/mundo3d/lineas';
import { fuenteDesdeMapa, fuenteDesdeRelieve } from '../../src/mundo3d/fuente';
import { VistaMundo3D } from '../../src/mundo3d/vista';
import type { NieblaProyectada } from '../../src/tiposDominio';

type Punto = { x: number; y: number };
const $ = (id: string) => document.getElementById(id)!;
const parametros = new URLSearchParams(location.search);

async function bajar(ruta: string): Promise<Uint8Array> {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(await r.text());
  return new Uint8Array(await r.arrayBuffer());
}

const VELOCIDAD = 0.5; // u por segundo (30 u/min)
const CELDA = 5; // la rejilla de exploración del servidor

async function arrancar(): Promise<void> {
  const artefacto = fromBinary(ArtefactoDeMundoSchema, await bajar('/__banco/mundo'));
  const mapa = mapaDesdeArtefacto(artefacto);
  const fuente = parametros.has('raster') ? fuenteDesdeMapa(mapa)! : fuenteDesdeRelieve(new Relieve(fromBinary(PaqueteRelieveSchema, await bajar('/__banco/relieve'))));
  const campamento = artefacto.campamentos[0]?.posicion;
  let cabeza: Punto = {
    x: Number(parametros.get('x') ?? Number(campamento?.x ?? 0n) / 1000),
    y: Number(parametros.get('y') ?? Number(campamento?.y ?? 0n) / 1000),
  };
  let ruta: Punto[] = [];
  let soldados = false;
  let antes = performance.now();

  // la niebla: celdas de 5 u, exploradas al verlas
  const columnas = Math.ceil(fuente.ancho / CELDA), filas = Math.ceil(fuente.alto / CELDA), explorado = new Uint8Array(columnas * filas);
  let niebla: NieblaProyectada | null = null, nieblaEn: Punto | null = null;
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const ponerNiebla = (radio: number) => {
    if (nieblaEn && Math.hypot(cabeza.x - nieblaEn.x, cabeza.y - nieblaEn.y) < 1 && niebla) return;
    nieblaEn = { ...cabeza };
    const visible = new Uint8Array(Math.ceil((columnas * filas) / 8)), celdas = new Uint8Array(visible.length);
    for (let j = Math.max(0, Math.floor((cabeza.y - radio) / CELDA)); j <= Math.min(filas - 1, Math.floor((cabeza.y + radio) / CELDA)); j++) {
      for (let i = Math.max(0, Math.floor((cabeza.x - radio) / CELDA)); i <= Math.min(columnas - 1, Math.floor((cabeza.x + radio) / CELDA)); i++) {
        if (Math.hypot((i + 0.5) * CELDA - cabeza.x, (j + 0.5) * CELDA - cabeza.y) > radio) continue;
        const k = j * columnas + i;
        explorado[k] = 1;
        visible[k >> 3]! |= 1 << (k & 7);
      }
    }
    explorado.forEach((e, k) => { if (e) celdas[k >> 3]! |= 1 << (k & 7); });
    niebla = { tamanoCelda: CELDA, columnas, filas, celdas: hex(celdas), visibles: hex(visible) } as NieblaProyectada;
  };

  // lo que hay en el mundo: los campamentos del artefacto y, si no se quitan, las maquetas de mentira alrededor de donde arranca el héroe
  const { mundo, ajenas, caravanas, miradas, etiquetas } = mundoDePrueba(cabeza, parametros.has('sinMaquetas'));
  let seleccion: SeleccionEnVista | null = null, fundacion: FundacionEnVista | null = null;
  // lo que se puede seleccionar con un clic, con el radio de su aro
  const seleccionables = (): SeleccionEnVista[] => [
    ...mundo.plazas.map((x) => ({ posicion: x.posicion, radio: x.radioCiudad + 0.5 })),
    ...mundo.pueblos.map((x) => ({ posicion: x.posicion, radio: x.aldea ? 1.5 : 0.9 })),
    ...[...mundo.avanzadas, ...mundo.obras, ...mundo.alijos].map((x) => ({ posicion: x.posicion, radio: 0.7 })),
    ...[...mundo.bandidos, ...mundo.batallas].map((x) => ({ posicion: x.posicion, radio: 1 })),
    ...mundo.campamentos.map((x) => ({ posicion: x.posicion, radio: 1.1 })),
    ...[...ajenas, ...caravanas].map((x) => ({ posicion: x.posicion, radio: 0.7 })),
  ];
  for (const c of artefacto.campamentos) {
    const posicion = { x: Number(c.posicion?.x ?? 0n) / 1000, y: Number(c.posicion?.y ?? 0n) / 1000 };
    mundo.campamentos.push({ id: c.id, posicion, radioProteccion: 10 });
    mundo.trazos.push({ puntos: circulo(posicion, 10), ancho: ANCHOS.anillo, color: '#2e5e8c', bajoNiebla: false, tipo: 'anillo' });
  }

  const estado = (): EstadoVista => {
    const ahora = performance.now(), dt = Math.min(0.2, (ahora - antes) / 1000);
    antes = ahora;
    // la cabeza avanza por la ruta
    let paso = VELOCIDAD * dt;
    while (ruta.length && paso > 0) {
      const sig = ruta[0]!, d = Math.hypot(sig.x - cabeza.x, sig.y - cabeza.y);
      if (d <= paso) { cabeza = { ...sig }; ruta.shift(); paso -= d; } else { cabeza = { x: cabeza.x + ((sig.x - cabeza.x) * paso) / d, y: cabeza.y + ((sig.y - cabeza.y) * paso) / d }; paso = 0; }
    }
    const radio = soldados ? 30 : 15;
    ponerNiebla(radio);
    // las caravanas de mentira van y vienen por su ruta
    for (const c of caravanas) if (c.ruta.length >= 2) {
      const t = (ahora / 40000) % 1, a = c.ruta[0]!, b = c.ruta[1]!;
      c.posicion = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    const mia: ColumnaEnVista = {
      id: 'mia', mia: true, propia: true, posicion: cabeza, ruta: ruta.length ? [cabeza, ...ruta] : [], jinetes: 1, soldados: soldados ? 6 : 0,
      color: '#c0392b', carros: { carga: soldados ? 1 : 0, fundacion: !!fundacion }, formacion: false,
    };
    return { heroe: cabeza, radioVision: radio, columnas: [mia, ...ajenas], caravanas, niebla, mundo, miradas, etiquetas, seleccion, fundacion };
  };

  const vista = new VistaMundo3D($('escena'), {
    fuente,
    mapa,
    estado,
    alClicar: (p) => {
      const cerca = seleccionables().filter((x) => Math.hypot(x.posicion.x - p.x, x.posicion.y - p.y) < Math.max(1.2, x.radio)).sort((a, b) => Math.hypot(a.posicion.x - p.x, a.posicion.y - p.y) - Math.hypot(b.posicion.x - p.x, b.posicion.y - p.y))[0];
      if (cerca) seleccion = cerca;
      else { seleccion = null; ruta = [p]; }
    },
  });
  const irA = (x: number, y: number) => { ruta = [{ x, y }]; };
  $('normal').addEventListener('click', () => vista.zoom('normal'));
  $('alejado').addEventListener('click', () => vista.zoom('alejado'));
  $('soldados').addEventListener('change', (e) => { soldados = (e.target as HTMLInputElement).checked; nieblaEn = null; });
  $('sin-niebla').addEventListener('change', (e) => vista.fijarSinNiebla((e.target as HTMLInputElement).checked));
  // la vista previa de fundar: la zona inicial (6 u) alrededor del héroe y las parcelas de bosque de dentro, todas libres
  $('fundar').addEventListener('change', (e) => {
    const si = (e.target as HTMLInputElement).checked, centro = { ...cabeza };
    fundacion = si ? { centro, radio: 6, sitios: null, parcelas: (mapa.parcelas ?? []).filter((q) => Math.hypot(q.centro.x - centro.x, q.centro.y - centro.y) <= 6).map((q) => ({ centro: q.centro, estado: 'libre' as const })) } : null;
  });
  setInterval(() => {
    const c = vista.camara;
    const n = vista.cuentas();
    $('lectura').textContent = `héroe ${cabeza.x.toFixed(1)}, ${cabeza.y.toFixed(1)} · ${c.enPantalla} u en pantalla (${c.zoom}) · inclinación ${Math.round(c.inclinacion)}° · altura ${fuente.alturaEn(cabeza.x, cabeza.y).toFixed(0)} m · ${n.arboles} árboles${parametros.has('raster') ? ' · raster de 4 u' : ''}`;
  }, 250);
  Object.assign(window, { __banco: { vista, irA, mundo, seleccionar: (k: number) => { seleccion = seleccionables()[k] ?? null; }, saltar: (x: number, y: number) => { cabeza = { x, y }; ruta = []; }, get cabeza() { return cabeza; }, listo: true } });
}

/** Una plaza propia de nivel 3 (zona de 15 u) a unas 10 u del héroe con dos pueblos, tres avanzadas (una en ruinas) y dos obras; una plaza
 * ajena que se ve, con su frontera, y otra que se recuerda, con su círculo discontinuo; caminos entre ellas. */
function mundoDePrueba(c: Punto, vacio: boolean): { mundo: MundoEnVista; ajenas: ColumnaEnVista[]; caravanas: CaravanaEnVista[]; miradas: MiradaEnVista[]; etiquetas: EtiquetaEnVista[] } {
  const m: MundoEnVista = mundoVacio();
  const ajenas: ColumnaEnVista[] = [], caravanas: CaravanaEnVista[] = [], miradas: MiradaEnVista[] = [], etiquetas: EtiquetaEnVista[] = [];
  if (vacio) return { mundo: m, ajenas, caravanas, miradas, etiquetas };
  const PROPIO = '#d4a017', AJENO = '#8e44ad', OTRO = '#16a085';
  const en = (dx: number, dy: number, desde = c) => ({ x: desde.x + dx, y: desde.y + dy });
  const plaza = en(9, -5), ajena = en(34, 16), recordada = en(-26, 20);
  m.plazas.push({ id: 'propia', posicion: plaza, radioCiudad: 1.5, color: PROPIO, recordada: false });
  m.plazas.push({ id: 'ajena', posicion: ajena, radioCiudad: 1, color: AJENO, recordada: false });
  m.plazas.push({ id: 'recordada', posicion: recordada, radioCiudad: 1, color: OTRO, recordada: true });
  m.pueblos.push({ id: 'aldea', posicion: en(6, 5, plaza), aldea: true, color: PROPIO }, { id: 'cantera', posicion: en(-6, 6, plaza), aldea: false, color: PROPIO });
  m.avanzadas.push(
    { id: 'atalaya', posicion: en(11, -3, plaza), etapa: 1, ruinas: false, color: PROPIO },
    { id: 'ciudadela', posicion: en(-10, -6, plaza), etapa: 3, ruinas: false, color: PROPIO },
    { id: 'ruinas', posicion: en(3, -12, plaza), etapa: 2, ruinas: true, color: PROPIO },
  );
  m.obras.push({ id: 'obra-en-marcha', posicion: en(8, 9, plaza), arrancada: true, color: PROPIO }, { id: 'obra-pendiente', posicion: en(-7, 2, plaza), arrancada: false, color: PROPIO });
  // la zona propia (encima de la niebla) y las fronteras (bajo ella)
  m.trazos.push({ puntos: circulo(plaza, 15, 48), ancho: ANCHOS.zona, color: PROPIO, bajoNiebla: false, tipo: 'zona' });
  m.trazos.push({ puntos: circulo(ajena, 10, 48), ancho: ANCHOS.frontera, color: AJENO, bajoNiebla: true, tipo: 'frontera' });
  m.trazos.push({ puntos: circulo(recordada, 10), ancho: ANCHOS.frontera, color: OTRO, bajoNiebla: true, discontinuo: true, tipo: 'frontera' });
  // caminos: calzada del héroe a la plaza, camino a la ajena y sendero a la aldea
  const camino = (puntos: Punto[], escalon: 0 | 1 | 2) => m.trazos.push({ puntos, ancho: ANCHOS.caminos[escalon], color: '#8b5a2b', bajoNiebla: true, tipo: 'camino' });
  camino([c, en(4, -1), plaza], 2);
  camino([plaza, en(12, 10, plaza), ajena], 1);
  camino([plaza, en(3, 4, plaza), en(6, 5, plaza)], 0);
  // lo ajeno: una columna en formación junto a la plaza ajena, bandidos, un alijo y una batalla; caravanas propia y ajena; dos Miradas
  ajenas.push({ id: 'ajena', mia: false, propia: false, posicion: en(-6, 4, ajena), ruta: [], jinetes: 2, soldados: 0, color: AJENO, carros: { carga: 0, fundacion: true }, formacion: true });
  m.bandidos.push({ id: 'bandidos', posicion: en(-4, 12), nivel: 2 });
  m.alijos.push({ id: 'alijo', posicion: en(3, 6) });
  m.batallas.push({ id: 'batalla', posicion: en(18, -10), propia: false });
  caravanas.push({ id: 'caravana', posicion: plaza, ruta: [plaza, ajena], fundacion: false, color: PROPIO });
  caravanas.push({ id: 'caravana-ajena', posicion: en(4, -3, ajena), ruta: [], fundacion: false, color: AJENO });
  miradas.push({ id: 'abierta', centro: en(-14, -4), radio: 6, abierta: true, minutos: 37 }, { id: 'caducada', centro: en(22, 2), radio: 5, abierta: false, minutos: 12 });
  etiquetas.push(
    { id: 'plaza:propia', posicion: plaza, texto: 'Ilión', tipo: 'plaza', color: PROPIO },
    { id: 'plaza:ajena', posicion: ajena, texto: 'Micenas', tipo: 'plaza', color: AJENO },
    { id: 'plaza:recordada', posicion: recordada, texto: 'Tirinto', tipo: 'plaza', color: OTRO, tenue: true },
    ...miradas.map((x) => ({ id: `mirada:${x.id}`, posicion: x.centro, texto: `${x.abierta ? '👁' : '⏳'} ${x.minutos} min`, tipo: 'mirada' as const, tenue: !x.abierta })),
  );
  return { mundo: m, ajenas, caravanas, miradas, etiquetas };
}

arrancar().catch((e) => { $('lectura').textContent = `el banco no arrancó: ${(e as Error).message}`; console.error(e); });
