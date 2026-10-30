// Banco de pruebas del mundo 3D (`npm run mundo3d`): la vista del modo mundo con el artefacto y el relieve reales del motor, sin servidor ni
// cuenta. Una columna propia que va en línea recta adonde se hace clic, a 30 u/min, y una niebla de mentira: se explora lo que se ve y se ve lo
// que cae en el radio de visión. `?x=…&y=…` pone el héroe en otro sitio; `?raster` usa el raster de 4 u del artefacto en vez del relieve.
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema, PaqueteRelieveSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { Relieve } from '../../src/mundo/relieve';
import type { EstadoVista } from '../../src/mundo3d/estado';
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
    $('lectura').textContent = `héroe ${cabeza.x.toFixed(1)}, ${cabeza.y.toFixed(1)} · ${c.enPantalla} u en pantalla (${c.zoom}) · inclinación ${Math.round(c.inclinacion)}° · altura ${fuente.alturaEn(cabeza.x, cabeza.y).toFixed(0)} m${parametros.has('raster') ? ' · raster de 4 u' : ''}`;
  }, 250);
  Object.assign(window, { __banco: { vista, irA, get cabeza() { return cabeza; }, listo: true } });
}

arrancar().catch((e) => { $('lectura').textContent = `el banco no arrancó: ${(e as Error).message}`; console.error(e); });
