// Banco de pruebas del mundo 3D (`npm run mundo3d`): la vista del modo mundo con el artefacto y el relieve reales del motor, sin servidor ni
// cuenta. Una columna propia que va en línea recta adonde se hace clic, a 30 u/min, y una niebla de mentira: se explora lo que se ve y se ve lo
// que cae en el radio de visión. Los campamentos de mercenarios son los del artefacto; junto al héroe hay unas maquetas de mentira (una plaza
// propia con su zona, sus pueblos, avanzadas y obras, una plaza ajena que se ve, otra que se recuerda y caminos) para mirarlas sin partida.
// `?x=…&y=…` pone el héroe en otro sitio; `?raster` usa el raster de 4 u del artefacto en vez del relieve; `?sinMaquetas` quita las de mentira.
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema, PaqueteRelieveSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { Relieve } from '../../src/mundo/relieve';
import { ANCHOS, type EstadoVista, type MundoEnVista } from '../../src/mundo3d/estado';
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
  const mundo = mundoDePrueba(cabeza, parametros.has('sinMaquetas'));
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
    return {
      heroe: cabeza,
      radioVision: radio,
      columnas: [{ id: 'mia', propia: true, posicion: cabeza, ruta: ruta.length ? [cabeza, ...ruta] : [], jinetes: 1, soldados: soldados ? 6 : 0 }],
      niebla,
      mundo,
    };
  };

  const vista = new VistaMundo3D($('escena'), {
    fuente,
    mapa,
    estado,
    alClicar: (p) => { ruta = [p]; },
  });
  const irA = (x: number, y: number) => { ruta = [{ x, y }]; };
  $('normal').addEventListener('click', () => vista.zoom('normal'));
  $('alejado').addEventListener('click', () => vista.zoom('alejado'));
  $('soldados').addEventListener('change', (e) => { soldados = (e.target as HTMLInputElement).checked; nieblaEn = null; });
  $('sin-niebla').addEventListener('change', (e) => vista.fijarSinNiebla((e.target as HTMLInputElement).checked));
  setInterval(() => {
    const c = vista.camara;
    const n = vista.cuentas();
    $('lectura').textContent = `héroe ${cabeza.x.toFixed(1)}, ${cabeza.y.toFixed(1)} · ${c.enPantalla} u en pantalla (${c.zoom}) · inclinación ${Math.round(c.inclinacion)}° · altura ${fuente.alturaEn(cabeza.x, cabeza.y).toFixed(0)} m · ${n.arboles} árboles${parametros.has('raster') ? ' · raster de 4 u' : ''}`;
  }, 250);
  Object.assign(window, { __banco: { vista, irA, get cabeza() { return cabeza; }, listo: true } });
}

/** Una plaza propia de nivel 3 (zona de 15 u) a unas 10 u del héroe con dos pueblos, tres avanzadas (una en ruinas) y dos obras; una plaza
 * ajena que se ve, con su frontera, y otra que se recuerda, con su círculo discontinuo; caminos entre ellas. */
function mundoDePrueba(c: Punto, vacio: boolean): MundoEnVista {
  const m: MundoEnVista = { plazas: [], pueblos: [], avanzadas: [], obras: [], campamentos: [], trazos: [] };
  if (vacio) return m;
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
  return m;
}

arrancar().catch((e) => { $('lectura').textContent = `el banco no arrancó: ${(e as Error).message}`; console.error(e); });
