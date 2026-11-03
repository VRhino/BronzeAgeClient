// Banco de pruebas del mundo 3D (`npm run mundo3d`): la vista del modo mundo con el artefacto y el relieve reales del motor, sin servidor ni
// cuenta. Una columna propia que va en línea recta adonde se hace clic, a 30 u/min, y una niebla de mentira: se explora lo que se ve y se ve lo
// que cae en el radio de visión. Los campamentos de mercenarios son los del artefacto; junto al héroe hay un mundo de mentira para mirarlo sin
// partida: una plaza propia con su zona, sus pueblos, avanzadas y obras, una plaza ajena que se ve y otra que se recuerda, caminos, una columna
// ajena en formación, caravanas, bandidos, un alijo, una batalla y dos Miradas. Un clic cerca de algo lo selecciona (como en el juego); en el
// suelo, la columna va allí. «Fundar aquí» enciende la vista previa de fundar alrededor del héroe.
// `?x=…&y=…` pone el héroe en otro sitio; `?raster` usa el raster de 4 u del artefacto en vez del relieve; `?sinMaquetas` quita lo de mentira;
// `?acarreo=N` pone N carros de acarreo en marcha (para medir el mundo con muchas caravanas andando).
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema, PaqueteRelieveSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { Relieve } from '../../src/mundo/relieve';
import { ANCHOS, mundoVacio, rellenosDeTerritorio, trazosDeFronteras, type CaravanaEnVista, type ColumnaEnVista, type EstadoVista, type EtiquetaEnVista, type FundacionEnVista, type MiradaEnVista, type MundoEnVista, type SeleccionEnVista } from '../../src/mundo3d/estado';
import { circulo, suavizarCamino } from '../../src/mundo3d/lineas';
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
const VELOCIDAD_ACARREO = 0.4; // u por segundo (24 u/min, el buey)
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
  const acarreos = carrosDeAcarreo(cabeza, Number(parametros.get('acarreo') ?? 0));
  caravanas.push(...acarreos.map((a) => a.caravana));
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
    for (const c of caravanas) if (c.ruta.length >= 2 && !c.id.startsWith('acarreo-')) {
      const t = (ahora / 40000) % 1, a = c.ruta[0]!, b = c.ruta[1]!;
      c.posicion = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    // los carros de acarreo (`?acarreo=N`) andan su trazado de ida y vuelta, y su ruta es lo que les queda, como en el juego
    for (const a of acarreos) {
      const total = a.largos[a.largos.length - 1]!, d = ((ahora / 1000) * VELOCIDAD_ACARREO + a.desfase) % (2 * total);
      const ida = d <= total, s = ida ? d : 2 * total - d;
      let k = 1;
      while (k < a.trazado.length - 1 && a.largos[k]! < s) k++;
      const p0 = a.trazado[k - 1]!, p1 = a.trazado[k]!, l0 = a.largos[k - 1]!, f = (s - l0) / Math.max(1e-6, a.largos[k]! - l0);
      a.caravana.posicion = { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
      a.caravana.ruta = ida ? [a.caravana.posicion, ...a.trazado.slice(k)] : [a.caravana.posicion, ...a.trazado.slice(0, k).reverse()];
    }
    const mia: ColumnaEnVista = {
      id: 'mia', mia: true, propia: true, posicion: cabeza, ruta: ruta.length ? [cabeza, ...ruta] : [], jinetes: 1, tropa: { porHeroe: [soldados ? 1 : 0], ejercito: false },
      color: '#c0392b', carros: { carga: soldados ? 1 : 0, fundacion: !!fundacion, propio: true, animales: ['caballo'] }, formacion: false,
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
  // `?carga=N`: la distancia de carga del jugador (u)
  if (parametros.has('carga')) vista.fijarDistanciaDeCarga(Number(parametros.get('carga')));
  const irA = (x: number, y: number) => { ruta = [{ x, y }]; };
  $('cerca').addEventListener('click', () => vista.zoom('cerca'));
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
  m.plazas.push({ id: 'propia', posicion: plaza, radioCiudad: 1.5, color: PROPIO, recordada: false, nivel: 3 });
  m.plazas.push({ id: 'ajena', posicion: ajena, radioCiudad: 1, color: AJENO, recordada: false, nivel: 4 });
  m.plazas.push({ id: 'recordada', posicion: recordada, radioCiudad: 1, color: OTRO, recordada: true, nivel: 2 });
  // `?niveles`: una fila con una plaza de cada nivel (1 a 5) al sur del héroe
  if (parametros.has('niveles')) for (let n = 1; n <= 5; n++) m.plazas.push({ id: `nivel-${n}`, posicion: en(-14 + 7 * n, -10), radioCiudad: 1.5, color: PROPIO, recordada: false, nivel: n });
  m.pueblos.push({ id: 'aldea', posicion: en(6, 5, plaza), aldea: true, color: PROPIO }, { id: 'cantera', posicion: en(-6, 6, plaza), aldea: false, color: PROPIO });
  m.avanzadas.push(
    { id: 'atalaya', posicion: en(11, -3, plaza), etapa: 1, ruinas: false, color: PROPIO },
    { id: 'fuerte', posicion: en(-3, 12, plaza), etapa: 2, ruinas: false, color: PROPIO },
    { id: 'ciudadela', posicion: en(-10, -6, plaza), etapa: 3, ruinas: false, color: PROPIO },
    { id: 'ruinas', posicion: en(3, -12, plaza), etapa: 2, ruinas: true, color: PROPIO },
  );
  m.obras.push({ id: 'obra-en-marcha', posicion: en(8, 9, plaza), arrancada: true, color: PROPIO }, { id: 'obra-pendiente', posicion: en(-7, 2, plaza), arrancada: false, color: PROPIO });
  // la zona propia (encima de la niebla) y las fronteras (bajo ella)
  m.trazos.push({ puntos: circulo(plaza, 15, 48), ancho: ANCHOS.zona, color: PROPIO, bajoNiebla: false, discontinuo: true, tipo: 'zona', haciaDentro: 1 });
  m.trazos.push({ puntos: circulo(ajena, 10, 48), ancho: ANCHOS.frontera, color: AJENO, bajoNiebla: true, discontinuo: true, tipo: 'frontera', haciaDentro: 1 });
  m.trazos.push({ puntos: circulo(recordada, 10), ancho: ANCHOS.frontera, color: OTRO, bajoNiebla: true, discontinuo: true, recordada: true, tipo: 'frontera', haciaDentro: 1 });
  // tres zonas que se tocan: dos de la misma Facción (se fusionan, con una línea tenue entre provincias) y otra de otra Facción (cada
  // frontera de su lado)
  const choque = en(-20, -14), cuadro = (x0: number, x1: number, y0 = -4, y1 = 4): Punto[] => [en(x0, y0, choque), en(x1, y0, choque), en(x1, y1, choque), en(x0, y1, choque)];
  const colores: Record<string, string> = { a: AJENO, b: OTRO };
  const zonasChoque = [
    { faccionId: 'a', contorno: cuadro(-12, -4), recordada: false, color: AJENO },
    { faccionId: 'a', contorno: cuadro(-4, 4), recordada: false, color: AJENO },
    { faccionId: 'b', contorno: cuadro(4, 12), recordada: false, color: OTRO },
  ];
  m.trazos.push(...trazosDeFronteras(zonasChoque, (f) => colores[f] ?? OTRO, 'propia', true));
  // el relleno del territorio, como lo saca `mundoDesdeProyeccion`
  m.territorios.push(...rellenosDeTerritorio(
    [{ faccionId: 'ajena', contorno: circulo(ajena, 10, 48).slice(0, -1), recordada: false, color: AJENO }, { faccionId: 'otra', contorno: circulo(recordada, 10).slice(0, -1), recordada: true, color: OTRO }, ...zonasChoque],
    [{ faccionId: 'propia', contornos: [circulo(plaza, 15, 48).slice(0, -1)] }], () => PROPIO, 'propia', true,
  ));
  // caminos (en escalera, nodo a nodo como los manda el servidor), con el trazado suavizado como en el juego: un solo tramo del héroe a la ajena
  // que cruza la plaza (pasa por ella: ese vértice no se suaviza) y un sendero a la aldea
  const camino = (puntos: Punto[], escalon: 0 | 1, fijos: number[] = []) => m.trazos.push({ puntos: suavizarCamino(puntos, fijos), ancho: ANCHOS.caminos[escalon], color: '#8b5a2b', bajoNiebla: true, tipo: 'camino', escalon });
  const escalera = (a: Punto, b: Punto): Punto[] => {
    const out = [a];
    for (let q = a; Math.hypot(b.x - q.x, b.y - q.y) > 4;) {
      const dx = Math.sign(Math.round((b.x - q.x) / 4)), dy = Math.sign(Math.round((b.y - q.y) / 4));
      out.push((q = { x: q.x + 4 * dx, y: q.y + 4 * dy }));
    }
    return [...out, b];
  };
  const hastaPlaza = escalera(c, plaza);
  camino([...hastaPlaza, ...escalera(plaza, ajena).slice(1)], 1, [hastaPlaza.length - 1]);
  camino([plaza, en(3, 4, plaza), en(6, 5, plaza)], 0);
  // lo ajeno: una columna en formación junto a la plaza ajena, bandidos, un alijo y una batalla; caravanas propia y ajena; dos Miradas
  ajenas.push({ id: 'ajena', mia: false, propia: false, posicion: en(-6, 4, ajena), ruta: [], jinetes: 2, tropa: { porHeroe: [0, 0], ejercito: false }, color: AJENO, carros: { carga: 0, fundacion: true }, formacion: true });
  m.bandidos.push({ id: 'bandidos', posicion: en(-4, 12), nivel: 2 });
  m.alijos.push({ id: 'alijo', posicion: en(3, 6) });
  m.batallas.push({ id: 'batalla', posicion: en(18, -10), propia: false });
  caravanas.push({ id: 'caravana', posicion: plaza, ruta: [plaza, ajena], fundacion: false, color: PROPIO, escolta: 2, animales: ['buey', 'camello'] });
  caravanas.push({ id: 'caravana-ajena', posicion: en(4, -3, ajena), ruta: [], fundacion: false, color: AJENO, escolta: 1 });
  miradas.push({ id: 'abierta', centro: en(-14, -4), radio: 6, abierta: true, minutos: 37 }, { id: 'caducada', centro: en(22, 2), radio: 5, abierta: false, minutos: 12 });
  etiquetas.push(
    { id: 'plaza:propia', posicion: plaza, texto: 'Ilión', tipo: 'plaza', color: PROPIO },
    { id: 'plaza:ajena', posicion: ajena, texto: 'Micenas', tipo: 'plaza', color: AJENO },
    { id: 'plaza:recordada', posicion: recordada, texto: 'Tirinto', tipo: 'plaza', color: OTRO, tenue: true },
    ...miradas.map((x) => ({ id: `mirada:${x.id}`, posicion: x.centro, texto: `${x.abierta ? '👁' : '⏳'} ${x.minutos} min`, tipo: 'mirada' as const, tenue: !x.abierta })),
  );
  return { mundo: m, ajenas, caravanas, miradas, etiquetas };
}

/** `n` carros de acarreo de mentira (`?acarreo=N`), para medir el mundo con muchas caravanas en marcha: cada uno va y viene por un trazado en
 * escalera de 4 u (como los manda el servidor) entre un pueblo cerca del héroe y una plaza a entre 40 y 220 u, algunas fuera de lo que se carga. */
function carrosDeAcarreo(c: Punto, n: number): { caravana: CaravanaEnVista; trazado: Punto[]; largos: number[]; desfase: number }[] {
  const out: { caravana: CaravanaEnVista; trazado: Punto[]; largos: number[]; desfase: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2, cerca = 6 + (i % 5) * 4, lejos = 40 + ((i * 37) % 180);
    const a = { x: c.x + Math.cos(ang) * cerca, y: c.y + Math.sin(ang) * cerca }, b = { x: c.x + Math.cos(ang + 0.4) * lejos, y: c.y + Math.sin(ang + 0.4) * lejos };
    const trazado = [a];
    for (let q = a; Math.hypot(b.x - q.x, b.y - q.y) > 4;) {
      const dx = Math.sign(Math.round((b.x - q.x) / 4)), dy = Math.sign(Math.round((b.y - q.y) / 4));
      trazado.push((q = { x: q.x + 4 * dx, y: q.y + 4 * dy }));
    }
    trazado.push(b);
    const largos = [0];
    for (let k = 1; k < trazado.length; k++) largos.push(largos[k - 1]! + Math.hypot(trazado[k]!.x - trazado[k - 1]!.x, trazado[k]!.y - trazado[k - 1]!.y));
    out.push({ caravana: { id: `acarreo-${i}`, posicion: a, ruta: trazado, fundacion: false, color: '#d4a017', animales: ['buey'] }, trazado, largos, desfase: i * 13.7 });
  }
  return out;
}

arrancar().catch((e) => { $('lectura').textContent = `el banco no arrancó: ${(e as Error).message}`; console.error(e); });
