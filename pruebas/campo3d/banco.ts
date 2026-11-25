// Mesa del campo de batalla del lugar (`npm run campo3d`), en dos fases. En la del mundo, el mundo real del motor a pantalla completa y a
// escala del héroe (la vista del modo mundo, `VistaMundo3D`): WASD lo mueve y un clic en el terreno abre la batalla allí. En la de la batalla,
// la mesa hace el ticket que mandaría el motor, genera el campo solo con él (`generador.ts`) y lo pinta a escala de batalla, con el mundo en
// miniatura en el panel, para ver cómo quedan el campo, las distancias y los spawns y calibrar las cifras de Conquest
// (`Docs/Design/Campo_De_Batalla_Del_Lugar.md`). Sin servidor ni cuenta: el artefacto y el relieve los sirve el plugin `bancoMundo3d` de
// `vite.config.ts`, como al banco del mundo 3D.
// `?x=…&y=…` abre directamente la batalla de ese sitio; `&ax=…&ay=…` y `&dx=…&dy=…`, la procedencia del atacante y del defensor (sin ellas, quieto).
import { fromBinary } from '@bufbuild/protobuf';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArtefactoDeMundoSchema, PaqueteRelieveSchema } from '../../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../../src/mundo/artefacto';
import { Relieve } from '../../src/mundo/relieve';
import { ANCHOS, mundoVacio, type ColumnaEnVista, type EstadoVista } from '../../src/mundo3d/estado';
import { fuenteDesdeRelieve } from '../../src/mundo3d/fuente';
import { VistaMundo3D } from '../../src/mundo3d/vista';
import { colorDeCopa, especieDe, geometrias } from '../../src/mundo3d/especies';
import { azar } from '../../src/mundo3d/ruido';
import { colorDeMata, GEO as GEO_MATAS, TIPOS_DE_MATA } from '../../src/mundo3d/matas';
import { colorDelSuelo } from '../../src/mundo3d/terreno';
import type { MapaGenerado, RasterU8 } from '../../src/terreno';
import { alturaDelCampo, bytesEnProtobuf, centroEnTierra, crearTicket, generarCampo, leerTicket, medidasDe, muestra, PARAMETROS, tamanoDe, type ContextoDeBatalla, ZONA, zonaDelCampo, type Campo, type Mundo, type P, type Parametros, type TicketDelLugar } from './generador';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const parametrosUrl = new URLSearchParams(location.search);

async function bajar(ruta: string): Promise<Uint8Array> {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(await r.text());
  return new Uint8Array(await r.arrayBuffer());
}

// ─────────────────────────── el mundo, como lo vería el motor ───────────────────────────

/** Las celdas de agua del raster de terreno que son mar: las que tocan el borde del mapa o forman una masa grande. */
function marDelTerreno(t: RasterU8): Uint8Array {
  const n = t.columnas * t.filas, mar = new Uint8Array(n), visto = new Uint8Array(n), cola = new Int32Array(n);
  for (let k0 = 0; k0 < n; k0++) {
    if (visto[k0] || t.datos[k0] !== 1) continue;
    let ini = 0, fin = 0, borde = false;
    cola[fin++] = k0;
    visto[k0] = 1;
    while (ini < fin) {
      const k = cola[ini++]!, i = k % t.columnas, j = (k - i) / t.columnas;
      if (i === 0 || j === 0 || i === t.columnas - 1 || j === t.filas - 1) borde = true;
      for (const v of [i > 0 ? k - 1 : -1, i + 1 < t.columnas ? k + 1 : -1, j > 0 ? k - t.columnas : -1, j + 1 < t.filas ? k + t.columnas : -1]) {
        if (v >= 0 && !visto[v] && t.datos[v] === 1) {
          visto[v] = 1;
          cola[fin++] = v;
        }
      }
    }
    if (borde || fin >= 2000) for (let q = 0; q < fin; q++) mar[cola[q]!] = 1;
  }
  return mar;
}

function mundoDesde(mapa: MapaGenerado, relieve: Relieve): Mundo {
  const t = mapa.rasters!.terreno!, b = mapa.rasters?.densidadBosque, f = mapa.rasters?.fertilidad, mar = marDelTerreno(t);
  const indice = (r: RasterU8, i: number, j: number) => Math.min(r.filas - 1, Math.max(0, j)) * r.columnas + Math.min(r.columnas - 1, Math.max(0, i));
  return {
    ancho: mapa.config.ancho,
    alto: mapa.config.alto,
    celda: t.celda,
    alturaEn: (x, y) => relieve.alturaEn(x, y),
    aguaEn: (x, y) => relieve.aguaEn(x, y),
    marEn: (x, y) => {
      const i = Math.floor(x / t.celda), j = Math.floor(y / t.celda);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (mar[indice(t, i + di, j + dj)]) return true;
      return false;
    },
    terrenoCelda: (i, j) => t.datos[indice(t, i, j)]!,
    bosqueCelda: (i, j) => (b ? b.datos[indice(b, i, j)]! : 0),
    fertilidadCelda: (i, j) => (f ? f.datos[indice(f, i, j)]! : 128),
    rios: mapa.rios.map((r) => ({ puntos: r.puntos, vados: r.vados ?? [], navegable: r.navegable, ...(r.anchos?.length ? { anchos: r.anchos } : {}) })),
  };
}

// ─────────────────────────── estado ───────────────────────────

interface Estado {
  punto: P;
  atacante: P | null;
  defensor: P | null;
  params: Parametros;
  contexto: ContextoDeBatalla;
}

/** Los tipos de batalla del selector y su contexto en el ticket (autor, 2026-11-23). */
const TIPOS_DE_BATALLA: Record<string, ContextoDeBatalla> = {
  persecucion: { tipo: 'campo_abierto', solitarios: true },
  campal: { tipo: 'campo_abierto', solitarios: false },
  caravana_pequena: { tipo: 'caravana', solitarios: true },
  caravana_grande: { tipo: 'caravana', solitarios: false },
};
const claveDeTipo = (c: ContextoDeBatalla) => Object.keys(TIPOS_DE_BATALLA).find((k) => TIPOS_DE_BATALLA[k]!.tipo === c.tipo && TIPOS_DE_BATALLA[k]!.solitarios === c.solitarios) ?? 'persecucion';

const COLOR_CLASE: Record<number, [number, number, number]> = { 1: [44, 93, 138], 2: [216, 198, 144], 3: [127, 154, 85], 4: [143, 138, 85], 5: [138, 122, 104], 6: [230, 230, 230] };
const COLOR_ZONA: Record<number, number> = {
  [ZONA.llano]: 0x7d9450, [ZONA.colina]: 0x8e8a5a, [ZONA.bosqueClaro]: 0x5f7d3e, [ZONA.bosqueCerrado]: 0x3f5e2c, [ZONA.arena]: 0xd9c79a,
  [ZONA.somero]: 0xc9b98f, [ZONA.honda]: 0x6f6650, [ZONA.camino]: 0xb39a6a, [ZONA.acantilado]: 0x6b5f58,
};
const SPAN_LUGAR = 24; // u del mapa del lugar

async function arrancar(): Promise<void> {
  const [datosMundo, datosRelieve] = await Promise.all([bajar('/__banco/mundo'), bajar('/__banco/relieve')]);
  const mapa = mapaDesdeArtefacto(fromBinary(ArtefactoDeMundoSchema, datosMundo));
  const relieve = new Relieve(fromBinary(PaqueteRelieveSchema, datosRelieve));
  const mundo = mundoDesde(mapa, relieve);
  const terreno = mapa.rasters!.terreno!;
  const vista = new Vista3D($('escena'));

  const numero = (k: string) => (parametrosUrl.has(k) ? Number(parametrosUrl.get(k)) : NaN);
  const desdeUrl = (kx: string, ky: string): P | null => (Number.isFinite(numero(kx)) && Number.isFinite(numero(ky)) ? { x: numero(kx), y: numero(ky) } : null);
  const estado: Estado = { punto: desdeUrl('x', 'y') ?? { x: 0, y: 0 }, atacante: desdeUrl('ax', 'ay'), defensor: desdeUrl('dx', 'dy'), params: { ...PARAMETROS },
    contexto: { ...(TIPOS_DE_BATALLA[parametrosUrl.get('tipo') ?? ''] ?? TIPOS_DE_BATALLA.persecucion!) } };
  let campo: Campo | null = null;
  // el ticket: lo hace la mesa con cada clic o se carga de un fichero (y entonces los parámetros regeneran sin rehacerlo)
  const mapaId = relieve.hashArtefacto;
  let ticket: TicketDelLugar | null = null, ticketDeFichero = false;
  // la fase y el héroe de la fase del mundo
  let fase: 'mundo' | 'batalla' = 'mundo';
  let heroe: P = desdeUrl('x', 'y') ?? mapa.campamentos?.[0]?.posicion ?? { x: mundo.ancho / 2, y: mundo.alto / 2 };

  // ── sitios al azar
  const azar = <T>(xs: readonly T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];
  const tangente = (puntos: readonly P[], q: P): P => {
    let mejor = Infinity, t = { x: 1, y: 0 };
    for (let i = 0; i + 1 < puntos.length; i++) {
      const a = puntos[i]!, b = puntos[i + 1]!, d = Math.hypot((a.x + b.x) / 2 - q.x, (a.y + b.y) / 2 - q.y);
      if (d < mejor) { mejor = d; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; t = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }
    }
    return t;
  };
  const dentroDelMapa = (q: P) => q.x > 10 && q.y > 10 && q.x < mundo.ancho - 10 && q.y < mundo.alto - 10;
  const irA = (que: string) => {
    const d = estado.params.distancia_procedencia;
    for (let intento = 0; intento < 400; intento++) {
      if (que === 'vado') {
        const rio = azar(mapa.rios.filter((r) => r.vados?.length));
        const v = rio && azar(rio.vados!);
        if (!rio || !v || !dentroDelMapa(v)) continue;
        const t = tangente(rio.puntos, v), n = { x: -t.y, y: t.x };
        estado.punto = { x: v.x + n.x * 0.6, y: v.y + n.y * 0.6 };
        estado.defensor = { x: v.x + n.x * (d + 0.6), y: v.y + n.y * (d + 0.6) };
        estado.atacante = { x: v.x - n.x * (d + 0.6), y: v.y - n.y * (d + 0.6) };
      } else if (que === 'ribera') {
        const rio = azar(mapa.rios.filter((r) => r.puntos.length > 3));
        const q = rio && azar(rio.puntos.slice(1, -1));
        if (!rio || !q || !dentroDelMapa(q) || (rio.vados ?? []).some((v) => Math.hypot(v.x - q.x, v.y - q.y) < 8)) continue;
        const t = tangente(rio.puntos, q), n = { x: -t.y, y: t.x };
        estado.punto = { x: q.x + n.x * 1.2, y: q.y + n.y * 1.2 };
        estado.atacante = { x: estado.punto.x + t.x * d, y: estado.punto.y + t.y * d };
        estado.defensor = null;
      } else {
        const clase = que === 'costa' ? 2 : 3;
        const k = Math.floor(Math.random() * terreno.datos.length);
        if (terreno.datos[k] !== clase) continue;
        const i = k % terreno.columnas, j = (k - i) / terreno.columnas, c = { x: (i + 0.5) * terreno.celda, y: (j + 0.5) * terreno.celda };
        if (!dentroDelMapa(c) || mundo.aguaEn(c.x, c.y)) continue;
        if (que === 'llano' && mapa.rios.some((r) => r.puntos.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 8))) continue;
        let tierra = { x: 0, y: 0 }, mojados = 0;
        for (let a = 0; a < 16; a++) {
          const ang = (a * Math.PI) / 8, q = { x: c.x + Math.cos(ang) * 3, y: c.y + Math.sin(ang) * 3 }, agua = mundo.aguaEn(q.x, q.y), s = agua ? -1 : 1;
          if (agua) mojados++;
          tierra = { x: tierra.x + Math.cos(ang) * s, y: tierra.y + Math.sin(ang) * s };
        }
        // la costa, con agua a menos de 3 u (la clase costa del artefacto es una franja ancha); el llano, sin agua
        if (que === 'costa' ? mojados < 3 || mojados > 10 : mojados > 0) continue;
        const l = Math.hypot(tierra.x, tierra.y);
        const dir = que === 'costa' && l > 0 ? { x: -tierra.y / l, y: tierra.x / l } : (() => { const a = Math.random() * 2 * Math.PI; return { x: Math.cos(a), y: Math.sin(a) }; })();
        estado.punto = c;
        estado.atacante = { x: c.x + dir.x * d, y: c.y + dir.y * d };
        estado.defensor = null;
      }
      // en el mundo, el héroe salta a donde llegaría el atacante; en la batalla, se abre la de ese sitio
      if (fase === 'mundo') {
        const a = estado.atacante;
        heroe = { ...(a && !mundo.aguaEn(a.x, a.y) ? a : estado.punto) };
      }
      else cambio(true);
      return;
    }
  };

  // ── mapa del mundo
  const lienzoMundo = $<HTMLCanvasElement>('mapa-mundo');
  lienzoMundo.height = Math.round((lienzoMundo.width * mundo.alto) / mundo.ancho);
  const escMundo = lienzoMundo.width / mundo.ancho;
  const fondoMundo = document.createElement('canvas');
  fondoMundo.width = terreno.columnas;
  fondoMundo.height = terreno.filas;
  {
    const img = fondoMundo.getContext('2d')!.createImageData(terreno.columnas, terreno.filas);
    const b = mapa.rasters?.densidadBosque;
    for (let k = 0; k < terreno.datos.length; k++) {
      const [r, g, bl] = COLOR_CLASE[terreno.datos[k]!] ?? [0, 0, 0];
      const sombra = b && terreno.datos[k]! > 2 ? 1 - (b.datos[k]! / 255) * 0.45 : 1;
      img.data.set([r * sombra, g * sombra, bl * sombra, 255], k * 4);
    }
    fondoMundo.getContext('2d')!.putImageData(img, 0, 0);
  }
  const pintarMundo = () => {
    const g = lienzoMundo.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(fondoMundo, 0, 0, lienzoMundo.width, lienzoMundo.height);
    g.strokeStyle = 'rgba(120,180,230,0.9)';
    g.lineWidth = 1;
    for (const rio of mapa.rios) {
      g.lineWidth = rio.orden ? 0.4 + 0.5 * rio.orden : 1; // más gruesos los de más orden
      g.beginPath();
      rio.puntos.forEach((q, i) => (i ? g.lineTo(q.x * escMundo, q.y * escMundo) : g.moveTo(q.x * escMundo, q.y * escMundo)));
      g.stroke();
    }
    g.fillStyle = '#f0d060';
    for (const rio of mapa.rios) for (const v of rio.vados ?? []) g.fillRect(v.x * escMundo - 1, v.y * escMundo - 1, 2, 2);
    // en la batalla, el sitio de la batalla; en el mundo, solo el héroe
    if (fase === 'batalla') {
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      const s = 16;
      g.strokeRect(estado.punto.x * escMundo - s / 2, estado.punto.y * escMundo - s / 2, s, s);
    }
    g.fillStyle = '#c0392b';
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(heroe.x * escMundo, heroe.y * escMundo, 3.5, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
  };
  lienzoMundo.addEventListener('click', (e) => {
    const r = lienzoMundo.getBoundingClientRect(), q = { x: ((e.clientX - r.left) / r.width) * mundo.ancho, y: ((e.clientY - r.top) / r.height) * mundo.alto };
    // en el mundo, el héroe va ahí
    if (fase === 'mundo') {
      heroe = q;
      pintarMundo();
      return;
    }
    const dx = q.x - estado.punto.x, dy = q.y - estado.punto.y;
    estado.punto = q;
    if (estado.atacante) estado.atacante = { x: estado.atacante.x + dx, y: estado.atacante.y + dy };
    if (estado.defensor) estado.defensor = { x: estado.defensor.x + dx, y: estado.defensor.y + dy };
    cambio(true);
  });

  // ── mapa del lugar: lo bastante grande para el recorte del tamaño de ahora (24 u la pequeña; algo más que su recorte la grande)
  const lienzoLugar = $<HTMLCanvasElement>('mapa-lugar');
  const dims = () => medidasDe(estado.params, tamanoDe(estado.contexto));
  const spanLugar = () => Math.max(SPAN_LUGAR, Math.ceil(dims().lado_recorte + 4));
  const escLugar = () => lienzoLugar.width / spanLugar();
  let fondoLugar: ImageData | null = null, fondoEn: P | null = null, fondoSpan = 0;
  const origenLugar = () => ({ x: estado.punto.x - spanLugar() / 2, y: estado.punto.y - spanLugar() / 2 });
  const aLienzo = (q: P) => { const o = origenLugar(), e = escLugar(); return { x: (q.x - o.x) * e, y: (q.y - o.y) * e }; };
  const pintarLugar = () => {
    const g = lienzoLugar.getContext('2d')!, W = lienzoLugar.width, o = origenLugar(), span = spanLugar();
    $('titulo-lugar').textContent = `Lugar (${span} u)`;
    if (!fondoLugar || !fondoEn || fondoEn.x !== estado.punto.x || fondoEn.y !== estado.punto.y || fondoSpan !== span) {
      fondoLugar = g.createImageData(W, W);
      fondoSpan = span;
      const paso = span / W;
      for (let j = 0; j < W; j++) {
        for (let i = 0; i < W; i++) {
          const x = o.x + (i + 0.5) * paso, y = o.y + (j + 0.5) * paso, k = (j * W + i) * 4;
          if (mundo.aguaEn(x, y)) { fondoLugar.data.set([44, 93, 138, 255], k); continue; }
          const h = mundo.alturaEn(x, y), luz = clampN(0.75 + (mundo.alturaEn(x - 0.25, y - 0.25) - h) * 0.12, 0.35, 1.25);
          const [r, gg, b] = COLOR_CLASE[mundo.terrenoCelda(Math.floor(x / mundo.celda), Math.floor(y / mundo.celda))] ?? [120, 120, 120];
          const bosque = 1 - (mundo.bosqueCelda(Math.floor(x / mundo.celda), Math.floor(y / mundo.celda)) / 255) * 0.4;
          fondoLugar.data.set([r * luz * bosque, gg * luz * bosque, b * luz * bosque, 255], k);
        }
      }
      fondoEn = { ...estado.punto };
    }
    g.putImageData(fondoLugar, 0, 0);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(120,180,230,0.95)';
    for (const rio of mapa.rios) {
      g.lineWidth = rio.orden ? 1 + rio.orden : 2;
      g.beginPath();
      rio.puntos.forEach((q, i) => { const p = aLienzo(q); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
      g.stroke();
    }
    g.fillStyle = '#f0d060';
    for (const rio of mapa.rios) for (const v of rio.vados ?? []) { const p = aLienzo(v); g.beginPath(); g.arc(p.x, p.y, 4, 0, 2 * Math.PI); g.fill(); }
    const centro = campo?.recorte.centro ?? estado.punto;
    const cuadro = (lado: number, color: string, discontinuo: boolean) => {
      const p = aLienzo({ x: centro.x - lado / 2, y: centro.y - lado / 2 });
      g.setLineDash(discontinuo ? [5, 4] : []);
      g.strokeStyle = color;
      g.lineWidth = 1.5;
      g.strokeRect(p.x, p.y, lado * escLugar(), lado * escLugar());
      g.setLineDash([]);
    };
    cuadro(dims().lado_recorte, 'rgba(240,208,96,0.6)', true);
    cuadro(dims().lado_mundo, '#f0d060', false);
    const marca = (q: P, color: string, r: number) => { const p = aLienzo(q); g.fillStyle = color; g.beginPath(); g.arc(p.x, p.y, r, 0, 2 * Math.PI); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); };
    const flecha = (de: P, a: P, color: string) => {
      const p = aLienzo(de), q = aLienzo(a);
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
    };
    if (estado.atacante) { flecha(estado.atacante, estado.punto, '#e0533f'); marca(estado.atacante, '#e0533f', 5); }
    if (estado.defensor) { flecha(estado.defensor, estado.punto, '#4f7fe8'); marca(estado.defensor, '#4f7fe8', 5); }
    marca(estado.punto, '#4f7fe8', 4);
    const c = aLienzo(centro);
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(c.x - 6, c.y); g.lineTo(c.x + 6, c.y); g.moveTo(c.x, c.y - 6); g.lineTo(c.x, c.y + 6); g.stroke();
  };
  lienzoLugar.addEventListener('click', (e) => {
    const r = lienzoLugar.getBoundingClientRect(), o = origenLugar();
    const q = { x: o.x + ((e.clientX - r.left) / r.width) * spanLugar(), y: o.y + ((e.clientY - r.top) / r.height) * spanLugar() };
    const modo = (document.querySelector('input[name="modo"]:checked') as HTMLInputElement).value;
    if (modo === 'atacante') estado.atacante = q;
    else if (modo === 'defensor') estado.defensor = q;
    else {
      const dx = q.x - estado.punto.x, dy = q.y - estado.punto.y;
      estado.punto = q;
      if (estado.atacante) estado.atacante = { x: estado.atacante.x + dx, y: estado.atacante.y + dy };
      if (estado.defensor) estado.defensor = { x: estado.defensor.x + dx, y: estado.defensor.y + dy };
    }
    cambio(true);
  });

  // ── quietos
  const quietoA = $<HTMLInputElement>('atacante-quieto'), quietoD = $<HTMLInputElement>('defensor-quieto');
  const recordado: { atacante: P | null; defensor: P | null } = { atacante: null, defensor: null };
  for (const [caja, lado] of [[quietoA, 'atacante'], [quietoD, 'defensor']] as const) {
    caja.addEventListener('change', () => {
      if (caja.checked) { recordado[lado] = estado[lado]; estado[lado] = null; }
      else estado[lado] = recordado[lado] ?? { x: estado.punto.x + (lado === 'atacante' ? 1 : -1) * estado.params.distancia_procedencia, y: estado.punto.y };
      cambio(true);
    });
  }

  // ── parámetros
  const cajaParametros = $('parametros');
  const entradas = new Map<keyof Parametros, HTMLInputElement>();
  for (const clave of Object.keys(PARAMETROS) as (keyof Parametros)[]) {
    const etiqueta = document.createElement('label'), entrada = document.createElement('input');
    etiqueta.textContent = clave;
    entrada.type = 'number';
    entrada.step = PARAMETROS[clave] < 2 ? '0.05' : '1';
    entrada.value = String(PARAMETROS[clave]);
    entrada.addEventListener('change', () => {
      const v = Number(entrada.value);
      if (Number.isFinite(v)) { estado.params[clave] = v; cambio(true, !ticketDeFichero); }
    });
    etiqueta.htmlFor = entrada.id = `p-${clave}`;
    cajaParametros.append(etiqueta, entrada);
    entradas.set(clave, entrada);
  }
  $('restablecer').addEventListener('click', () => {
    estado.params = { ...PARAMETROS };
    for (const [k, e] of entradas) e.value = String(PARAMETROS[k]);
    cambio(true, !ticketDeFichero);
  });

  // ── el ticket: descargar, copiar y cargar
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  const mostrarTicket = (t: TicketDelLugar, texto: string) => {
    const r = t.recorte, lado = (x: { punto: P; quieto: boolean }) => (x.quieto ? 'quieto' : `desde (${x.punto.x.toFixed(1)}, ${x.punto.y.toFixed(1)})`);
    const tam = t.contexto ? tamanoDe(t.contexto) : 'pequena', md = medidasDe(estado.params, tam);
    $('ticket-resumen').textContent = [
      `${ticketDeFichero ? 'Cargado de un fichero' : 'Hecho en la mesa'}: ${kb(texto.length)} en JSON · ≈ ${kb(bytesEnProtobuf(t))} en protobuf`,
      `${t.contexto ? `${t.contexto.tipo}, solitarios ${t.contexto.solitarios}` : 'sin contexto'} → batalla ${tam === 'grande' ? 'grande' : 'pequeña'}: ${md.lado_jugable} m (${md.lado_mundo} u del mundo), spawns a ${md.distancia_al_centro} m del centro`,
      `mapa_id ${t.mapa_id.slice(0, 12)}…${t.mapa_id === mapaId ? '' : ' ⚠ no es el de este mundo'}`,
      `punto (${t.punto.x.toFixed(1)}, ${t.punto.y.toFixed(1)}) · centro (${t.centro.x.toFixed(1)}, ${t.centro.y.toFixed(1)})`,
      `alturas ${r.alturas.columnas}×${r.alturas.filas} · celdas ${r.terreno.columnas}×${r.terreno.filas} · ríos ${r.rios.length} · vados ${r.rios.reduce((n, x) => n + x.vados.length, 0)} · caminos ${r.caminos.length}`,
      `atacante ${lado(r.procedencia_atacante)} · defensor ${lado(r.procedencia_defensor)}`,
    ].join('\n');
    // las listas de números, en una línea
    $('ticket-json').textContent = JSON.stringify(t, null, 1).replace(/\[\s*(-?[\d.]+(?:,\s*-?[\d.]+)*)\s*\]/g, (_, xs: string) => `[${xs.replace(/\s+/g, '')}]`);
  };
  $('ticket-bajar').addEventListener('click', () => {
    if (!ticket) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(ticket, null, 1)], { type: 'application/json' }));
    a.download = `ticket-${ticket.punto.x.toFixed(1)}-${ticket.punto.y.toFixed(1)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('ticket-copiar').addEventListener('click', () => {
    if (ticket) void navigator.clipboard.writeText(JSON.stringify(ticket, null, 1));
  });
  $<HTMLInputElement>('ticket-cargar').addEventListener('change', async (e) => {
    const entrada = e.target as HTMLInputElement, fichero = entrada.files?.[0];
    entrada.value = '';
    if (!fichero) return;
    try {
      const t = JSON.parse(await fichero.text()) as TicketDelLugar;
      leerTicket(t, estado.params); // que se pueda leer antes de quedárselo
      ticket = t;
      ticketDeFichero = true;
      estado.punto = { ...t.punto };
      estado.atacante = t.recorte.procedencia_atacante.quieto ? null : { ...t.recorte.procedencia_atacante.punto };
      estado.defensor = t.recorte.procedencia_defensor.quieto ? null : { ...t.recorte.procedencia_defensor.punto };
      estado.contexto = { ...(t.contexto ?? TIPOS_DE_BATALLA.persecucion!) };
      cambio(true, false);
    } catch (error) {
      $('lectura').textContent = `No se pudo leer el ticket: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
  document.querySelectorAll<HTMLButtonElement>('button[data-ir]').forEach((b) => b.addEventListener('click', () => irA(b.dataset.ir!)));
  // el tipo de batalla (en el mundo y en el panel): decide el tamaño; en la batalla, un ticket nuevo
  const selectoresDeTipo = Array.from(document.querySelectorAll<HTMLSelectElement>('select.tipo-batalla'));
  for (const s of selectoresDeTipo) {
    s.addEventListener('change', () => {
      estado.contexto = { ...TIPOS_DE_BATALLA[s.value]! };
      for (const otro of selectoresDeTipo) otro.value = s.value;
      if (fase === 'batalla') cambio(true);
    });
  }
  $<HTMLInputElement>('con-arboles').addEventListener('change', (e) => vista.verArboles((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('con-decoracion').addEventListener('change', (e) => vista.verDecoracion((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('con-regla').addEventListener('change', (e) => vista.usarRegla((e.target as HTMLInputElement).checked));

  // ── generar
  let pendiente = 0;
  /** `rehacerTicket`: la mesa hace un ticket nuevo con el sitio y las procedencias de ahora (si no, se regenera con el que hay). */
  function cambio(regenerar: boolean, rehacerTicket = true): void {
    quietoA.checked = !estado.atacante;
    quietoD.checked = !estado.defensor;
    const q = new URLSearchParams({ x: estado.punto.x.toFixed(2), y: estado.punto.y.toFixed(2) });
    if (estado.atacante) { q.set('ax', estado.atacante.x.toFixed(2)); q.set('ay', estado.atacante.y.toFixed(2)); }
    if (estado.defensor) { q.set('dx', estado.defensor.x.toFixed(2)); q.set('dy', estado.defensor.y.toFixed(2)); }
    q.set('tipo', claveDeTipo(estado.contexto));
    history.replaceState(null, '', `?${q}`);
    for (const s of selectoresDeTipo) s.value = claveDeTipo(estado.contexto);
    pintarMundo();
    pintarLugar();
    if (!regenerar) return;
    $('lectura').textContent = 'generando…';
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => setTimeout(() => {
      const t0 = performance.now();
      if (rehacerTicket || !ticket) {
        ticket = crearTicket(mundo, estado.punto, { atacante: estado.atacante, defensor: estado.defensor }, mapaId, estado.params, estado.contexto);
        ticketDeFichero = false;
      }
      // Conquest solo ve el ticket: pasado a texto y leído otra vez, como llegaría
      const texto = JSON.stringify(ticket);
      mostrarTicket(ticket, texto);
      const { recorte, procedencias } = leerTicket(JSON.parse(texto) as TicketDelLugar, estado.params);
      const t1 = performance.now();
      campo = generarCampo(recorte, procedencias, estado.params);
      const t2 = performance.now();
      vista.pintar(campo);
      $('lectura').textContent = lectura(campo, t1 - t0, t2 - t1, performance.now() - t2);
      pintarLugar();
    }, 0));
  }

  // ── la fase del mundo: el mundo a escala del héroe, a pantalla completa; WASD lo mueve y un clic abre la batalla
  const vacio = mundoVacio(), pulsadas = new Set<string>(), MOVIMIENTO = new Set(['w', 'a', 's', 'd']);
  let antes = performance.now(), rumbo: P = { x: 0, y: -1 }, vistaMundo: VistaMundo3D | null = null;
  // WASD es del héroe: se coge antes de que llegue al lienzo de la vista, que con esas teclas gira la cámara (las flechas siguen girándola)
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (fase !== 'mundo') return;
    if (k === 'shift') pulsadas.add(k);
    if (!MOVIMIENTO.has(k)) return;
    pulsadas.add(k);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    pulsadas.delete(k);
    if (fase === 'mundo' && MOVIMIENTO.has(k)) e.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('blur', () => pulsadas.clear());
  // el área que ocuparía la batalla si el clic fuera donde está el héroe: la jugable (continua) y el recorte del ticket (discontinua), ya
  // desplazadas hacia la tierra si hiciera falta; se rehacen cuando el héroe se mueve un cuarto de u
  const casillaArea = $<HTMLInputElement>('con-area');
  let claveArea = '', centroArea: P | null = null;
  const cuadro = (c: P, lado: number): P[] => {
    const h = lado / 2, esquinas = [{ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y - h }, { x: c.x + h, y: c.y + h }, { x: c.x - h, y: c.y + h }];
    const puntos: P[] = [];
    // cada lado partido cada 0,5 u, para que la cinta siga el suelo
    for (let e = 0; e < 4; e++) {
      const a = esquinas[e]!, b = esquinas[(e + 1) % 4]!, n = Math.ceil(lado / 0.5);
      for (let i = 0; i < n; i++) puntos.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
    }
    puntos.push({ ...esquinas[0]! });
    return puntos;
  };
  const ponerAreaDeBatalla = () => {
    const q = { x: Math.round(heroe.x * 4) / 4, y: Math.round(heroe.y * 4) / 4 };
    const d = dims(), clave = casillaArea.checked ? `${q.x},${q.y},${d.lado_mundo},${d.lado_recorte}` : '';
    if (clave === claveArea) return;
    claveArea = clave;
    if (!clave) {
      vacio.trazos = [];
      centroArea = null;
      return;
    }
    const c = centroEnTierra(mundo, q, d.lado_mundo).centro;
    centroArea = c;
    vacio.trazos = [
      { puntos: cuadro(c, d.lado_mundo), ancho: ANCHOS.zona, color: '#f0d060', bajoNiebla: false, tipo: 'zona' },
      { puntos: cuadro(c, d.lado_recorte), ancho: ANCHOS.anillo, color: '#f0d060', bajoNiebla: false, discontinuo: true, tipo: 'anillo' },
    ];
  };
  const estadoMundo = (): EstadoVista => {
    const ahora = performance.now(), dt = Math.min(0.2, (ahora - antes) / 1000);
    antes = ahora;
    // la cámara está detrás del héroe: adelante es de la cámara hacia él
    const g = vistaMundo?.camara.giro ?? 0, f = (pulsadas.has('w') ? 1 : 0) - (pulsadas.has('s') ? 1 : 0), l = (pulsadas.has('d') ? 1 : 0) - (pulsadas.has('a') ? 1 : 0);
    const mov = { x: -Math.sin(g) * f + Math.cos(g) * l, y: -Math.cos(g) * f - Math.sin(g) * l }, n = Math.hypot(mov.x, mov.y);
    if (n > 0) {
      const paso = VELOCIDAD_HEROE * (pulsadas.has('shift') ? CORRER : 1) * dt;
      rumbo = { x: mov.x / n, y: mov.y / n };
      heroe = { x: clampN(heroe.x + rumbo.x * paso, 0, mundo.ancho), y: clampN(heroe.y + rumbo.y * paso, 0, mundo.alto) };
    }
    ponerAreaDeBatalla();
    const mia: ColumnaEnVista = {
      id: 'mia', mia: true, propia: true, posicion: heroe, ruta: [], jinetes: 1, tropa: { porHeroe: [0], ejercito: false },
      color: '#c0392b', carros: { carga: 0, fundacion: false }, formacion: false, heroe: 'Héroe',
    };
    return { heroe, radioVision: 15, columnas: [mia], caravanas: [], niebla: null, mundo: vacio, miradas: [], etiquetas: [], seleccion: null, fundacion: null };
  };
  vistaMundo = new VistaMundo3D($('mundo-escena'), { fuente: fuenteDesdeRelieve(relieve), mapa, estado: estadoMundo, alClicar: (q) => abrirBatalla(q), sinNiebla: true });
  setInterval(() => {
    if (fase !== 'mundo') return;
    pintarMundo(); // el héroe en el minimapa, mientras anda
    const desplazada = centroArea && Math.hypot(centroArea.x - heroe.x, centroArea.y - heroe.y) > 0.3 ? ' · el área se aparta del agua' : '';
    $('mundo-lectura').textContent = `héroe (${heroe.x.toFixed(1)}, ${heroe.y.toFixed(1)}) u · altura ${Math.round(mundo.alturaEn(heroe.x, heroe.y))} m${mundo.aguaEn(heroe.x, heroe.y) ? ' · en el agua' : ''}${desplazada}`;
  }, 250);

  /** Un clic en el mundo: la batalla, ahí. El defensor, quieto en el clic; el atacante, llegando desde donde está el héroe. */
  function abrirBatalla(q: P): void {
    const d = estado.params.distancia_procedencia, v = { x: heroe.x - q.x, y: heroe.y - q.y }, l = Math.hypot(v.x, v.y);
    const dir = l > 0.2 ? { x: v.x / l, y: v.y / l } : { x: -rumbo.x, y: -rumbo.y };
    estado.punto = q;
    estado.atacante = { x: q.x + dir.x * d, y: q.y + dir.y * d };
    estado.defensor = null;
    ponerFase('batalla');
    cambio(true);
  }
  function ponerFase(f: 'mundo' | 'batalla'): void {
    fase = f;
    $('fase-mundo').hidden = f !== 'mundo';
    $('fase-batalla').hidden = f !== 'batalla';
    vistaMundo?.pausar(f !== 'mundo');
    vista.activa(f === 'batalla');
    pulsadas.clear();
    // el mapa del mundo es uno solo: abajo a la derecha en el mundo, en el panel en la batalla
    $(f === 'mundo' ? 'mundo-minimapa' : 'panel-minimapa').prepend(lienzoMundo);
    pintarMundo();
    if (f === 'mundo') {
      history.replaceState(null, '', location.pathname);
      document.querySelector<HTMLCanvasElement>('#mundo-escena canvas')?.focus();
    }
  }
  $('volver').addEventListener('click', () => ponerFase('mundo'));
  // para mirar desde la consola (y las pruebas en el navegador)
  Object.assign(window, { __mesa: { mundo, vista, get campo() { return campo; }, get ticket() { return ticket; }, get heroe() { return heroe; }, set heroe(q: P) { heroe = q; }, get vistaMundo() { return vistaMundo; }, abrirBatalla, ponerFase } });

  // con `?x=…&y=…`, la batalla de ese caso; si no, el mundo
  if (desdeUrl('x', 'y')) {
    ponerFase('batalla');
    cambio(true);
  } else ponerFase('mundo');
}

/** u por segundo del héroe en la fase del mundo, y cuántas veces más deprisa con Mayús. */
const VELOCIDAD_HEROE = 1;
const CORRER = 4;

const clampN = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const m = (v: number) => `${Math.round(v)} m`;
const pct = (v: number) => `${Math.round(v * 100)} %`;

function lectura(c: Campo, msTicket: number, msCampo: number, msPintar: number): string {
  const i = c.informe, r = c.recorte;
  const lineas = [
    `Tipo: ${i.tipo}${i.llanoForzado ? ` (forzado; la lectura decía ${c.lectura.tipo})` : ''}`,
    `Sitio: (${r.punto.x.toFixed(1)}, ${r.punto.y.toFixed(1)}) u` + (r.desplazamiento ? ` · recorte desplazado ${r.desplazamiento} u hacia la tierra (agua ${pct(i.aguaAntes)} → ${pct(i.aguaDespues)})` : ` · agua ${pct(i.aguaAntes)}`),
    `Lectura del mundo: montaña ${pct(i.medidas.montana)} · pendiente media ${i.medidas.pendienteMedia.toFixed(1)}° · desnivel ${m(i.medidas.desnivel)} · bosque ${i.medidas.bosqueMedio.toFixed(2)}`,
    c.spawns
      ? `Spawns: rumbo del atacante ${Math.round(i.rumbo)}° · giro ${i.giro}° · a ${m(i.distancia)} del centro · ${m(i.separacion)} entre bandos`
      : 'Spawns: ninguno válido',
    `Campo: desnivel jugable ${m(i.desnivel)} · variación interna ${i.variacion.toFixed(1)} m · pendiente media ${i.pendienteCampo.toFixed(1)}° (el mundo, ${i.medidas.pendienteMedia.toFixed(1)}°) · acantilado ${pct(i.acantilado)} · árboles ${i.arbolesJugables} jugables (${i.arboles} en total; ${i.sotos} sotos) · vados ${c.vados.length}`,
    `Decoración: ${TIPOS_DE_MATA.map((t, n) => { let k = 0; for (let q = 2; q < c.decoracion.length; q += 5) if (c.decoracion[q] === n) k++; return `${k} ${t}`; }).join(' · ')}`,
    `Tiempo: ticket ${Math.round(msTicket)} ms · campo ${Math.round(msCampo)} ms · montaje ${Math.round(msPintar)} ms`,
  ];
  for (const a of i.avisos) lineas.push(`⚠ ${a}`);
  return lineas.join('\n');
}

// ─────────────────────────── la vista 3D ───────────────────────────

/** Coordenadas: x del campo → x, y del campo (sur) → z, altura → y. El norte es −z. */
class Vista3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  private readonly camara: THREE.PerspectiveCamera;
  private readonly mandos: OrbitControls;
  private grupo = new THREE.Group();
  private arboles: THREE.Group | null = null;
  private decoracion: THREE.Group | null = null;
  private suelo: THREE.Mesh | null = null;
  private campo: Campo | null = null;
  private regla = false;
  private readonly marcasRegla = new THREE.Group();
  private puntosRegla: THREE.Vector3[] = [];
  // WASD (y Mayús) mientras la vista está en marcha
  private readonly pulsadas = new Set<string>();
  private enMarcha = false;
  private antes = 0;

  constructor(private readonly caja: HTMLElement) {
    const escribiendo = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.enMarcha || escribiendo(e) || !['w', 'a', 's', 'd', 'shift'].includes(k)) return;
      this.pulsadas.add(k);
      if (k !== 'shift') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.pulsadas.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.pulsadas.clear());
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    caja.append(this.renderer.domElement);
    this.escena.background = new THREE.Color(COLOR_NIEBLA);
    this.escena.fog = new THREE.Fog(COLOR_NIEBLA, 1400, 3200);
    this.camara = new THREE.PerspectiveCamera(45, 1, 1, 6000);
    this.camara.position.set(0, 520, 760);
    this.mandos = new OrbitControls(this.camara, this.renderer.domElement);
    this.mandos.target.set(0, 0, 0);
    this.mandos.maxPolarAngle = Math.PI * 0.49;
    this.escena.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3f2a, 1.3));
    const sol = new THREE.DirectionalLight(0xfff0d8, 1.9);
    sol.position.set(-400, 600, 300);
    this.escena.add(sol, this.grupo, this.marcasRegla);
    this.escena.add(etiqueta('N', 0xffffff, 60, new THREE.Vector3(0, 60, -560)));
    new ResizeObserver(() => this.ajustar()).observe(caja);
    this.ajustar();
    // la regla: un clic (sin arrastrar) sobre el terreno
    let abajo: { x: number; y: number } | null = null;
    this.renderer.domElement.addEventListener('pointerdown', (e) => (abajo = { x: e.clientX, y: e.clientY }));
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (!this.regla || !abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 4 || !this.suelo) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camara);
      const toque = ray.intersectObject(this.suelo)[0];
      if (toque) this.marcarRegla(toque.point);
    });
  }

  /** Pinta (en la fase de la batalla) o deja de pintar (oculta, en la del mundo). */
  activa(si: boolean): void {
    this.enMarcha = si;
    this.pulsadas.clear();
    this.antes = performance.now();
    this.renderer.setAnimationLoop(si ? () => {
      const ahora = performance.now(), dt = Math.min(0.1, (ahora - this.antes) / 1000);
      this.antes = ahora;
      this.andar(dt);
      this.limitar();
      this.mandos.update();
      this.renderer.render(this.escena, this.camara);
    } : null);
    if (si) this.ajustar();
  }

  /** La cámara, dentro de la batalla (autor, 2026-11-23): el punto al que mira no sale del área jugable, se mueva con WASD o arrastrando; si
   * sale, la cámara entera vuelve lo que se pasó. (El alejamiento lo topa `maxDistance`, en `pintar`.) */
  private limitar(): void {
    if (!this.campo) return;
    const h = this.campo.jugable / 2, t = this.mandos.target, c = this.camara.position;
    const x = clampN(t.x, -h, h), z = clampN(t.z, -h, h);
    if (x === t.x && z === t.z) return;
    c.x += x - t.x;
    c.z += z - t.z;
    t.x = x;
    t.z = z;
  }

  /** WASD: la cámara y el punto al que mira se desplazan por el suelo, hacia donde mira la cámara (W adelante, D a la derecha); más deprisa
   * cuanto más lejos está la cámara, y ×3 con Mayús. El punto al que mira sigue la altura del terreno. */
  private andar(dt: number): void {
    const f = (this.pulsadas.has('w') ? 1 : 0) - (this.pulsadas.has('s') ? 1 : 0), l = (this.pulsadas.has('d') ? 1 : 0) - (this.pulsadas.has('a') ? 1 : 0);
    if (!f && !l) return;
    const c = this.camara.position, t = this.mandos.target;
    let fx = t.x - c.x, fz = t.z - c.z;
    const lf = Math.hypot(fx, fz) || 1;
    fx /= lf;
    fz /= lf;
    // a la derecha de (fx, fz) en el suelo: (−fz, fx)
    let mx = fx * f - fz * l, mz = fz * f + fx * l;
    const lm = Math.hypot(mx, mz);
    mx /= lm;
    mz /= lm;
    const paso = Math.max(15, c.distanceTo(t) * 0.25) * (this.pulsadas.has('shift') ? 3 : 1) * dt;
    const x = t.x + mx * paso, z = t.z + mz * paso, y = this.campo ? alturaDelCampo(this.campo, x, z) + 1 : t.y;
    const dy = y - t.y;
    t.set(x, y, z);
    c.set(c.x + mx * paso, c.y + dy, c.z + mz * paso);
  }

  private ajustar(): void {
    const w = this.caja.clientWidth, h = this.caja.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / Math.max(1, h);
    this.camara.updateProjectionMatrix();
  }

  verArboles(si: boolean): void {
    if (this.arboles) this.arboles.visible = si;
  }

  verDecoracion(si: boolean): void {
    if (this.decoracion) this.decoracion.visible = si;
  }

  usarRegla(si: boolean): void {
    this.regla = si;
    $('regla').hidden = !si;
    $('regla').textContent = 'Regla: clic en dos puntos del terreno';
    this.puntosRegla = [];
    this.marcasRegla.clear();
  }

  private marcarRegla(q: THREE.Vector3): void {
    if (this.puntosRegla.length >= 2) {
      this.puntosRegla = [];
      this.marcasRegla.clear();
    }
    this.puntosRegla.push(q.clone());
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10), new THREE.MeshBasicMaterial({ color: 0xff40ff }));
    poste.position.copy(q).add(new THREE.Vector3(0, 5, 0));
    this.marcasRegla.add(poste);
    const [a, b] = this.puntosRegla;
    if (!a || !b || !this.campo) {
      $('regla').textContent = 'Regla: clic en el segundo punto';
      return;
    }
    const puntos: THREE.Vector3[] = [];
    let suelo = 0;
    for (let i = 0; i <= 100; i++) {
      const x = a.x + ((b.x - a.x) * i) / 100, z = a.z + ((b.z - a.z) * i) / 100, p = new THREE.Vector3(x, alturaDelCampo(this.campo, x, z) + 1, z);
      if (i) suelo += p.distanceTo(puntos[i - 1]!);
      puntos.push(p);
    }
    this.marcasRegla.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineBasicMaterial({ color: 0xff40ff })));
    $('regla').textContent = `Regla: ${Math.round(Math.hypot(b.x - a.x, b.z - a.z))} m en planta · ${Math.round(suelo)} m por el suelo · desnivel ${(b.y - a.y).toFixed(1)} m`;
  }

  pintar(c: Campo): void {
    this.campo = c;
    // no alejarse más que lo que abarca el campo entero, ni meterse bajo el suelo
    this.mandos.maxDistance = c.lado * 1.2;
    this.mandos.minDistance = 3;
    this.limitar();
    this.grupo.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mt of mats) { (mt as THREE.Material & { map?: THREE.Texture | null }).map?.dispose(); mt.dispose(); }
      }
    });
    this.escena.remove(this.grupo);
    this.grupo = new THREE.Group();
    this.escena.add(this.grupo);
    this.puntosRegla = [];
    this.marcasRegla.clear();
    const L = c.lado, J = c.jugable, fuera = (x: number, z: number) => Math.abs(x) > J / 2 || Math.abs(z) > J / 2;

    // el suelo, con el color del mapa de mundo (`colorDelSuelo`): por la altura de verdad, la pendiente, el bosque y la fertilidad del sitio;
    // bajo el agua, el color del lecho
    const n = c.nAlturas, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), color = new THREE.Color();
    const aMundo = (x: number, z: number) => ({ x: c.recorte.centro.x + x / c.escala, y: c.recorte.centro.y + z / c.escala });
    for (let j = 0, k = 0; j < n; j++) {
      for (let i = 0; i < n; i++, k++) {
        const x = -L / 2 + i * c.pasoAlturas, z = -L / 2 + j * c.pasoAlturas, zona = zonaDelCampo(c, x, z);
        pos.set([x, c.alturas[k]!, z], k * 3);
        // bajo el agua, el lecho por la profundidad de ese vértice: grava clara donde hay poca (el vado), oscuro donde cubre
        if (!Number.isNaN(c.lamina[k]!)) color.copy(COLOR_GRAVA).lerp(COLOR_LECHO, suaveEntre(0.6, 1.6, c.lamina[k]! - c.alturas[k]!));
        else if (zona === ZONA.somero || zona === ZONA.honda) color.setHex(COLOR_ZONA[zona]!);
        else {
          const h = (di: number, dj: number) => c.alturas[Math.min(n - 1, Math.max(0, j + dj)) * n + Math.min(n - 1, Math.max(0, i + di))]!;
          const pendiente = Math.hypot(h(1, 0) - h(-1, 0), h(0, 1) - h(0, -1)) / (2 * c.pasoAlturas), w = aMundo(x, z);
          const bosque = Math.min(1, Math.max(0, celdaDeZonas(c, c.bosque, x, z)));
          color.setRGB(...colorDelSuelo(alturaDelMundo(c, c.alturas[k]!), pendiente, bosque, muestra(c.recorte.fertilidad, w.x, w.y), w.x, w.y));
          // la tierra mojada junto al agua, como la orilla del río del mapa de mundo (1,2 u, oscura junto al agua y desvaída hacia fuera)
          const dAgua = celdaDeZonas(c, c.aAgua, x, z), t = dAgua / (ORILLA_MUNDO * c.escala);
          if (zona !== ZONA.arena && t < 1) color.lerp(COLOR_ORILLA, 0.8 * (1 - suaveEntre(0.1, 1, t)));
          // la bajada al vado: tierra pisada, como el camino de grava del vado del mapa de mundo, desvaída hacia los lados y ladera arriba
          if (c.pisado[k]! > 0) color.lerp(COLOR_BAJADA, 0.75 * c.pisado[k]!);
        }
        if (fuera(x, z)) color.multiplyScalar(0.8);
        col.set([color.r, color.g, color.b], k * 3);
      }
    }
    const indices = new Uint32Array((n - 1) * (n - 1) * 6);
    for (let j = 0, q = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
        indices.set([a, d, b, b, d, e], q);
        q += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    this.suelo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.grupo.add(this.suelo);

    // el agua: una lámina por celda de zonas con agua
    // el agua, a la resolución de las alturas (2 m): una lámina por vértice con agua (y su vecino en seco, que el suelo tapa, para que la orilla
    // no salga en escalera); clara y muy transparente donde hay poca agua (el vado, se ve el lecho de grava) y verdosa y opaca donde cubre
    const lam = Float32Array.from(c.lamina);
    for (let j = 0, k = 0; j < n; j++) {
      for (let i = 0; i < n; i++, k++) {
        if (!Number.isNaN(c.lamina[k]!)) continue;
        for (const v of [i > 0 ? k - 1 : -1, i + 1 < n ? k + 1 : -1, j > 0 ? k - n : -1, j + 1 < n ? k + n : -1]) if (v >= 0 && !Number.isNaN(c.lamina[v]!)) { lam[k] = c.lamina[v]!; break; }
      }
    }
    const somera = new THREE.Color(0xa8d8d0), honda = new THREE.Color(0x3f8f9c), aPos: number[] = [], aCol: number[] = [], aIdx: number[] = [], indice = new Int32Array(n * n).fill(-1);
    const verticeDeAgua = (k: number): number => {
      if (indice[k]! >= 0) return indice[k]!;
      const i = k % n, j = (k - i) / n, x = -L / 2 + i * c.pasoAlturas, z = -L / 2 + j * c.pasoAlturas, t = suaveEntre(0.4, 1.4, lam[k]! - c.alturas[k]!);
      // los rápidos: donde la lámina baja deprisa (un salto del río suavizado en rampa), espuma blanca, como agua que corre y cae
      const en = (v: number) => (v >= 0 && v < n * n && !Number.isNaN(lam[v]!) ? lam[v]! : lam[k]!);
      const caida = Math.hypot(en(i + 1 < n ? k + 1 : -1) - en(i > 0 ? k - 1 : -1), en(k + n) - en(k - n)) / (2 * c.pasoAlturas), espuma = suaveEntre(0.03, 0.15, caida);
      color.copy(somera).lerp(honda, t).lerp(COLOR_ESPUMA, 0.85 * espuma);
      if (fuera(x, z)) color.multiplyScalar(0.7);
      aPos.push(x, lam[k]! + 0.05, z);
      aCol.push(color.r, color.g, color.b, Math.max(0.3 + 0.55 * t, 0.9 * espuma));
      return (indice[k] = aPos.length / 3 - 1);
    };
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
        if ([a, b, d, e].some((v) => Number.isNaN(lam[v]!))) continue;
        aIdx.push(verticeDeAgua(a), verticeDeAgua(d), verticeDeAgua(b), verticeDeAgua(b), verticeDeAgua(d), verticeDeAgua(e));
      }
    }
    if (aIdx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(aCol, 4));
      g.setIndex(aIdx);
      g.computeVertexNormals();
      this.grupo.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false })));
    }

    // los árboles, como en el mapa de mundo: la especie de cada sitio (`especieDe`: por la altura y el agua cercana), sus geometrías y el
    // color de su copa, a su tamaño de verdad (la copa de 0,5 u son 6 m)
    const nArboles = c.arboles.length / 2;
    this.arboles = new THREE.Group();
    if (nArboles) {
      const lista: { x: number; z: number; e: number; r: number; r2: number }[] = [];
      for (let t = 0; t < nArboles; t++) {
        const x = c.arboles[2 * t]!, z = c.arboles[2 * t + 1]!, w = aMundo(x, z), r = azar(Math.round(x * 8), Math.round(z * 8), 41);
        const e = especieDe(w.x, w.y, alturaDelMundo(c, alturaDelCampo(c, x, z)), celdaDeZonas(c, c.aAgua, x, z) / c.escala, azar(Math.round(x * 8), Math.round(z * 8), 67));
        lista.push({ x, z, e, r, r2: azar(Math.round(x * 8), Math.round(z * 8), 5) });
      }
      const material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
      const mt = new THREE.Matrix4(), s = new THREE.Vector3(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), copa = new THREE.Color();
      GEO_ARBOLES.cerca.forEach((geo, e) => {
        const suyos = lista.filter((a) => a.e === e);
        if (!suyos.length) return;
        const malla = new THREE.InstancedMesh(geo, material, suyos.length);
        suyos.forEach((a, k) => {
          const esc = ESCALA_ARBOL * (0.75 + 0.5 * a.r), alto = 0.9 + 0.3 * a.r2;
          qt.setFromEuler(eu.set(0, a.r * 6.28, 0));
          mt.compose(p.set(a.x, alturaDelCampo(c, a.x, a.z) - 0.3, a.z), qt, s.set(esc, esc * alto, esc));
          malla.setMatrixAt(k, mt);
          malla.setColorAt(k, colorDeCopa(e, a.r, a.r2, copa));
        });
        this.arboles!.add(malla);
      });
    }
    this.arboles.visible = $<HTMLInputElement>('con-arboles').checked;
    this.grupo.add(this.arboles);

    // la decoración del suelo: las geometrías y los colores de las matas del mapa de mundo, a su tamaño de verdad; las piedras, mayores en
    // las laderas (peñascos)
    this.decoracion = new THREE.Group();
    const nDeco = c.decoracion.length / 5;
    if (nDeco) {
      const material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
      const porTipo: number[][] = TIPOS_DE_MATA.map(() => []);
      for (let k = 0; k < nDeco; k++) porTipo[c.decoracion[5 * k + 2]!]!.push(k);
      const mt = new THREE.Matrix4(), s = new THREE.Vector3(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), tono = new THREE.Color();
      porTipo.forEach((lista, t) => {
        if (!lista.length) return;
        const malla = new THREE.InstancedMesh(GEO_MATAS[t]!, material, lista.length);
        lista.forEach((k, n) => {
          const x = c.decoracion[5 * k]!, z = c.decoracion[5 * k + 1]!, r = c.decoracion[5 * k + 3]!, f = c.decoracion[5 * k + 4]!, w = aMundo(x, z), h = alturaDelCampo(c, x, z);
          const ladera = t === PIEDRA ? Math.hypot(alturaDelCampo(c, x + 2, z) - alturaDelCampo(c, x - 2, z), alturaDelCampo(c, x, z + 2) - alturaDelCampo(c, x, z - 2)) / 4 : 0;
          // los cantos del vado, mayores, para que asomen del agua
          const enElAgua = t === PIEDRA && zonaDelCampo(c, x, z) === ZONA.somero ? 1.8 : 1;
          const esc = TAMANO_DECORACION[t]! * (0.7 + 0.6 * r) * (1 + 3 * ladera) * enElAgua;
          qt.setFromEuler(eu.set(0, r * 6.28, 0));
          mt.compose(p.set(x, h - 0.05, z), qt, s.set(esc, esc, esc));
          malla.setMatrixAt(n, mt);
          malla.setColorAt(n, colorDeMata(t, w.x, w.y, r, f, tono));
        });
        this.decoracion!.add(malla);
      });
    }
    this.decoracion.visible = $<HTMLInputElement>('con-decoracion').checked;
    this.grupo.add(this.decoracion);

    // el borde del área jugable
    const borde: THREE.Vector3[] = [];
    const esquinas = [[-J / 2, -J / 2], [J / 2, -J / 2], [J / 2, J / 2], [-J / 2, J / 2], [-J / 2, -J / 2]] as const;
    for (let e = 0; e < 4; e++) {
      const [x0, z0] = esquinas[e]!, [x1, z1] = esquinas[e + 1]!;
      for (let i = 0; i <= 60; i++) {
        const x = x0 + ((x1 - x0) * i) / 60, z = z0 + ((z1 - z0) * i) / 60;
        borde.push(new THREE.Vector3(x, Math.max(alturaDelCampo(c, x, z), superficieEn(c, x, z)) + 1, z));
      }
    }
    this.grupo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(borde), new THREE.LineBasicMaterial({ color: 0xf0d060 })));

    // los vados
    for (const v of c.vados) {
      const r = c.anchoVado / 2 + 6;
      const anillo = new THREE.Mesh(new THREE.RingGeometry(r - 2.5, r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0d060, side: THREE.DoubleSide }));
      anillo.position.set(v.x, Math.max(alturaDelCampo(c, v.x, v.y), superficieEn(c, v.x, v.y)) + 0.4, v.y);
      this.grupo.add(anillo);
    }

    // los spawns: las placas, los seis puntos y el eje
    const sp = c.spawns;
    if (sp) {
      const R = sp.radio;
      [[sp.atacante, 0xe0533f], [sp.defensor, 0x4f7fe8]].forEach(([q, hex]) => {
        const p = q as P, h = alturaDelCampo(c, p.x, p.y);
        const placa = new THREE.Mesh(new THREE.RingGeometry(R - 1.5, R, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hex as number, side: THREE.DoubleSide }));
        placa.position.set(p.x, h + 0.3, p.y);
        this.grupo.add(placa);
      });
      // en cada punto, una escuadra de referencia (20 soldados de `ALTO_SOLDADO`, 5 de frente y 4 de fondo, a 1,5 m) mirando al enemigo, y su
      // estandarte: para ver la escala de los árboles, las matas y el relieve
      const porPunto = 20, cuerpos = new THREE.InstancedMesh(GEO_CUERPO, new THREE.MeshLambertMaterial({ color: 0xffffff }), sp.puntos.length * porPunto);
      const cabezas = new THREE.InstancedMesh(GEO_CABEZA, new THREE.MeshLambertMaterial({ color: 0xd9b38c }), sp.puntos.length * porPunto);
      const mt = new THREE.Matrix4(), uno = new THREE.Vector3(1, 1, 1), qt = new THREE.Quaternion(), tono = new THREE.Color();
      let n = 0;
      sp.puntos.forEach((p, i) => {
        const h = alturaDelCampo(c, p.x, p.y), hex = i < 3 ? 0xe0533f : 0x4f7fe8;
        // de frente al enemigo: el atacante mira hacia −eje y el defensor hacia +eje
        const frente = i < 3 ? { x: -sp.eje.x, y: -sp.eje.y } : { x: sp.eje.x, y: sp.eje.y }, lado = { x: -frente.y, y: frente.x };
        qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(frente.x, frente.y));
        for (let fila = 0; fila < 4; fila++) {
          for (let col = 0; col < 5; col++, n++) {
            const x = p.x + lado.x * (col - 2) * 1.5 - frente.x * fila * 1.5, z = p.y + lado.y * (col - 2) * 1.5 - frente.y * fila * 1.5, y = alturaDelCampo(c, x, z);
            mt.compose(new THREE.Vector3(x, y, z), qt, uno);
            cuerpos.setMatrixAt(n, mt);
            cuerpos.setColorAt(n, tono.setHex(hex));
            cabezas.setMatrixAt(n, mt);
          }
        }
        const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4), new THREE.MeshLambertMaterial({ color: 0x6b5d40 }));
        asta.position.set(p.x + frente.x * 2, h + 2, p.y + frente.y * 2);
        const pano = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide }));
        pano.position.set(p.x + frente.x * 2 + lado.x * 0.6, h + 3.5, p.y + frente.y * 2 + lado.y * 0.6);
        pano.rotation.y = Math.atan2(lado.x, lado.y) + Math.PI / 2;
        this.grupo.add(asta, pano, etiqueta(String(i + 1), hex, 4, new THREE.Vector3(p.x, h + 6, p.y)));
      });
      this.grupo.add(cuerpos, cabezas);
      const eje: THREE.Vector3[] = [];
      for (let i = 0; i <= 100; i++) {
        const x = sp.defensor.x + ((sp.atacante.x - sp.defensor.x) * i) / 100, z = sp.defensor.y + ((sp.atacante.y - sp.defensor.y) * i) / 100;
        eje.push(new THREE.Vector3(x, Math.max(alturaDelCampo(c, x, z), superficieEn(c, x, z)) + 1.2, z));
      }
      this.grupo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eje), new THREE.LineBasicMaterial({ color: 0xffffff })));
    }

    // La niebla, al final del anillo de fondo (autor, 2026-11-25): por la distancia al centro del campo (la del cuadrado, como su borde), no
    // a la cámara; empieza a `NIEBLA_DESDE` del anillo y lo tapa entero en su borde, así no se ve dónde se corta el mapa.
    const anillo = (L - J) / 2;
    this.escena.fog = new THREE.Fog(COLOR_NIEBLA, J / 2 + anillo * NIEBLA_DESDE, L / 2);
    this.grupo.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Line)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) nieblaDelCampo(m as THREE.Material);
    });
  }
}

/** El color de la niebla y del cielo de la batalla, y dónde empieza la niebla (parte del anillo de fondo, desde dentro). */
const COLOR_NIEBLA = 0x9fb6cc;
const NIEBLA_DESDE = 0.25;
/** La niebla de un material de la batalla por la distancia de cada punto al centro del campo en planta (máx. de |x| y |z|: el borde del
 * campo es un cuadrado), en vez de por la distancia a la cámara. */
function nieblaDelCampo(m: THREE.Material): void {
  if (m.userData.nieblaDelCampo) return;
  m.userData.nieblaDelCampo = true;
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <fog_vertex>', `#ifdef USE_FOG
      vec4 nieblaPos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        nieblaPos = instanceMatrix * nieblaPos;
      #endif
      nieblaPos = modelMatrix * nieblaPos;
      vFogDepth = max( abs( nieblaPos.x ), abs( nieblaPos.z ) );
    #endif`);
  };
  m.customProgramCacheKey = () => 'niebla-del-campo';
  m.needsUpdate = true;
}

/** Las geometrías de los árboles del mapa de mundo, una por especie (las de cerca). */
const GEO_ARBOLES = geometrias();
/** Lo que mide cada pieza de la decoración (m, con el azar de cada una entre ×0,7 y ×1,3), en el orden de `TIPOS_DE_MATA`: hierba, flor,
 * mata, junco, piedra. */
const TAMANO_DECORACION = [0.35, 0.3, 0.9, 1.3, 0.5];
/** Todo a escala del soldado (autor, 2026-11-23): un soldado mide `ALTO_SOLDADO` (los personajes de Synty, 1,8 m). La escala de las
 * geometrías de los árboles del mapa de mundo (una encina de escala 1 mide algo más de 1 de alto): con 8,5 m, de 7 a 12 m de alto y copas
 * de 6 a 10 m, unas cinco veces el soldado; la hierba le llega a la rodilla, la mata a la cintura y el junco al pecho. */
const ALTO_SOLDADO = 1.8;
const ESCALA_ARBOL = 8.5;
/** El soldado de referencia: cuerpo (con escudo y piernas, en un solo bloque redondeado) y cabeza, de pie sobre el suelo. */
const GEO_CUERPO = new THREE.CapsuleGeometry(0.24, ALTO_SOLDADO - 0.24 * 2 - 0.26, 2, 8).translate(0, (ALTO_SOLDADO - 0.26) / 2, 0);
const GEO_CABEZA = new THREE.SphereGeometry(0.13, 8, 6).translate(0, ALTO_SOLDADO - 0.13, 0);
const PIEDRA = TIPOS_DE_MATA.indexOf('piedra');

/** La altura del mundo (m) de una altura del campo: la que miran el color del suelo y las especies (costa, colina, montaña). */
const alturaDelMundo = (c: Campo, h: number) => c.alturaBase + h / c.zoomAltura;
/** La orilla mojada de los ríos del mapa de mundo (`src/mundo3d/paisaje.ts`): su ancho en u y su color. */
const ORILLA_MUNDO = 1.2;
const COLOR_ORILLA = new THREE.Color(0x6b5d40);
/** La bajada al vado: el color de la grava del vado del mapa de mundo (`paisaje.ts`), algo más oscura por pisada. */
const COLOR_BAJADA = new THREE.Color(0xb8a57c);
/** El lecho bajo el agua: grava clara donde hay poca y oscuro donde cubre. */
const COLOR_GRAVA = new THREE.Color(0xc9b98f);
/** La espuma de los rápidos y las cascadas. */
const COLOR_ESPUMA = new THREE.Color(0xf2f6f4);
const COLOR_LECHO = new THREE.Color(0x6f6650);
const suaveEntre = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** El valor de una rejilla por celda de zonas (`bosque`, `aAgua`) en (x, z) del campo. */
function celdaDeZonas(c: Campo, datos: Float32Array, x: number, z: number): number {
  const n = c.nZonas, i = clampN(Math.floor((x + c.lado / 2) / c.celdaZonas), 0, n - 1), j = clampN(Math.floor((z + c.lado / 2) / c.celdaZonas), 0, n - 1);
  return datos[j * n + i]!;
}

function superficieEn(c: Campo, x: number, z: number): number {
  const n = c.nZonas, i = clampN(Math.floor((x + c.lado / 2) / c.celdaZonas), 0, n - 1), j = clampN(Math.floor((z + c.lado / 2) / c.celdaZonas), 0, n - 1);
  const s = c.superficie[j * n + i]!;
  return Number.isNaN(s) ? -Infinity : s;
}

/** Un cartel de texto que siempre mira a la cámara, de `alto` metros. */
function etiqueta(texto: string, color: number, alto: number, en: THREE.Vector3): THREE.Sprite {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const g = lienzo.getContext('2d')!;
  g.font = 'bold 48px system-ui';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#000';
  g.strokeText(texto, 32, 34);
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  g.fillText(texto, 32, 34);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lienzo), depthTest: false }));
  sprite.scale.set(alto, alto, 1);
  sprite.position.copy(en);
  return sprite;
}

arrancar().catch((e: unknown) => {
  $('lectura').textContent = `No se pudo cargar el mundo: ${e instanceof Error ? e.message : String(e)}`;
});
