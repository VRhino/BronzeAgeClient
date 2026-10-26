// El terreno del artefacto de mundo (contrato 06) a cualquier escala, con la cámara del mapa (`ui/geometriaVista.ts`). Mismo criterio que
// el cliente de administración:
//  * de LEJOS (menos de 10 px por celda de 4 u): una imagen de una celda por píxel, hecha una vez por mundo (color por clase de terreno,
//    sombreado de ladera con luz del noroeste, bosque por densidad y ríos), escalada con `drawImage`;
//  * de CERCA: no se amplía esa imagen (se vería a cuadros). Se pinta la vista a media resolución de pantalla: relieve con la altura
//    interpolada, bordes de clase orgánicos (la clase se mira en un punto desplazado por ruido determinista) y suelo de bosque oscurecido;
//    encima, árboles sueltos a escala real. Se guarda por cámara: solo se recalcula al mover o hacer zoom.
//
// Todo se pinta con la transformación de la cámara ya puesta en `ctx` (unidades × `escala`), como el resto del mapa.
import type { MapaGenerado, RasterU8 } from '../terreno';

/** Celda en px a partir de la cual se pinta de cerca. */
const PX_POR_CELDA_CERCA = 10;
/** Densidad (0..255) por debajo de la cual no hay bosque, como `crates/batch/src/fondo.rs` del motor. */
const UMBRAL_BOSQUE = 38;
/** Exageración del relieve para el sombreado (la altura del raster va de 0 a 1). */
const ESCALA_RELIEVE = 350;

/** Color por `ClaseTerreno` (world.proto): 0 sin clase, 1 agua, 2 costa, 3 llano, 4 colina, 5 montaña, 6 cima. */
const COLOR_CLASE: readonly (readonly [number, number, number])[] = [
  [38, 82, 130],
  [38, 82, 130],
  [196, 186, 132],
  [147, 194, 107],
  [128, 168, 90],
  [128, 116, 98],
  [226, 226, 222],
];
const COLOR_BOSQUE = [36, 76, 34] as const;
const COLOR_RIO = [38, 90, 145] as const;

export interface VistaDelMundo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** px de pantalla (CSS) por unidad. */
  escala: number;
  /** px del lienzo por px CSS. */
  dpr: number;
}

/** El rectángulo del mundo que cubre el lienzo con la transformación de `ctx`, que pinta unidades × `escala`. */
export function vistaDelLienzo(ctx: CanvasRenderingContext2D, escala: number): VistaDelMundo {
  const m = ctx.getTransform();
  const dpr = m.a || 1;
  const k = dpr * escala;
  return { x0: -m.e / k, y0: -m.f / k, x1: (ctx.canvas.width - m.e) / k, y1: (ctx.canvas.height - m.f) / k, escala, dpr };
}

export function hayArtefacto(mapa: MapaGenerado): boolean {
  return Boolean(mapa.rasters?.terreno && mapa.rasters.altura);
}

export function esDeCerca(mapa: MapaGenerado, escala: number): boolean {
  return escala * (mapa.rasters?.terreno?.celda ?? 4) >= PX_POR_CELDA_CERCA;
}

// ─────────────────────────── muestreo ───────────────────────────

/** Bilineal sobre un raster, en unidades de mundo (centro de celda en `(c + 0,5) · celda`). */
function bilineal(r: { columnas: number; filas: number; celda: number; datos: ArrayLike<number> }, x: number, y: number): number {
  const fx = Math.min(r.columnas - 1, Math.max(0, x / r.celda - 0.5));
  const fy = Math.min(r.filas - 1, Math.max(0, y / r.celda - 0.5));
  const c0 = fx | 0;
  const f0 = fy | 0;
  const c1 = Math.min(r.columnas - 1, c0 + 1);
  const f1 = Math.min(r.filas - 1, f0 + 1);
  const tx = fx - c0;
  const ty = fy - f0;
  const d = r.datos;
  const arriba = d[f0 * r.columnas + c0]! * (1 - tx) + d[f0 * r.columnas + c1]! * tx;
  const abajo = d[f1 * r.columnas + c0]! * (1 - tx) + d[f1 * r.columnas + c1]! * tx;
  return arriba * (1 - ty) + abajo * ty;
}

function celdaDe(r: RasterU8, x: number, y: number): number {
  const c = Math.min(r.columnas - 1, Math.max(0, Math.floor(x / r.celda)));
  const f = Math.min(r.filas - 1, Math.max(0, Math.floor(y / r.celda)));
  return r.datos[f * r.columnas + c]!;
}

/** Hash entero → [0, 1). Determinista: el mismo sitio sale igual en cada repintado y en cada máquina. */
function hash2(x: number, y: number, semilla: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(semilla, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruido de valor en [-1, 1] con interpolación suave, de periodo 1 en las coordenadas que recibe. */
function ruidoValor(x: number, y: number, semilla: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(xi, yi, semilla);
  const b = hash2(xi + 1, yi, semilla);
  const c = hash2(xi, yi + 1, semilla);
  const d = hash2(xi + 1, yi + 1, semilla);
  return ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * 2 - 1;
}

/** Desplazamiento de ±0,45 celdas (dos octavas) para que los bordes entre clases no salgan en escalera. */
function desplazamiento(x: number, y: number, celda: number, semilla: number): number {
  const u = x / celda;
  const v = y / celda;
  return (ruidoValor(u / 2, v / 2, semilla) * 0.3 + ruidoValor(u, v, semilla + 7) * 0.15) * celda;
}

/** Luz de Lambert con sol del noroeste, normalizada a 1 en terreno llano (y no menos de 0,35). */
function luz(dzdx: number, dzdy: number): number {
  const luzZ = Math.SQRT1_2;
  const lambert = Math.max(0, (dzdx * 0.5 + dzdy * 0.5 + luzZ) / Math.hypot(dzdx, dzdy, 1));
  return Math.max(0.35, lambert / luzZ);
}

function mezcla(c: readonly number[], d: readonly number[], t: number): [number, number, number] {
  return [c[0]! + (d[0]! - c[0]!) * t, c[1]! + (d[1]! - c[1]!) * t, c[2]! + (d[2]! - c[2]!) * t];
}

// ─────────────────────────── de lejos ───────────────────────────

const imagenesDeLejos = new WeakMap<MapaGenerado, HTMLCanvasElement>();

/** Una celda del raster por píxel, con relieve, bosque y ríos. Se hace una vez por mundo. */
function imagenDeLejos(mapa: MapaGenerado): HTMLCanvasElement {
  const hecha = imagenesDeLejos.get(mapa);
  if (hecha) return hecha;
  const t = mapa.rasters!.terreno!;
  const alt = mapa.rasters!.altura!;
  const bosque = mapa.rasters!.densidadBosque;
  const capa = document.createElement('canvas');
  capa.width = t.columnas;
  capa.height = t.filas;
  const cctx = capa.getContext('2d')!;
  const img = cctx.createImageData(t.columnas, t.filas);
  const d = img.data;
  const h = (x: number, y: number) => (bilineal(alt, x, y) / 65535) * ESCALA_RELIEVE;
  for (let f = 0; f < t.filas; f++) {
    const y = (f + 0.5) * t.celda;
    for (let c = 0; c < t.columnas; c++) {
      const x = (c + 0.5) * t.celda;
      const i = f * t.columnas + c;
      const clase = t.datos[i]!;
      let color: readonly number[] = COLOR_CLASE[clase] ?? COLOR_CLASE[1]!;
      const dens = bosque ? bilineal(bosque, x, y) : 0;
      if (clase > 2 && dens >= UMBRAL_BOSQUE) color = mezcla(color, COLOR_BOSQUE, 0.35 + 0.45 * (dens / 255));
      const k = clase <= 1 ? 1 : luz((h(x + t.celda, y) - h(x - t.celda, y)) / (2 * t.celda), (h(x, y + t.celda) - h(x, y - t.celda)) / (2 * t.celda));
      d[i * 4] = Math.min(255, color[0]! * k);
      d[i * 4 + 1] = Math.min(255, color[1]! * k);
      d[i * 4 + 2] = Math.min(255, color[2]! * k);
      d[i * 4 + 3] = 255;
    }
  }
  // Ríos, una celda de ancho (Bresenham).
  for (const rio of mapa.rios) {
    for (let k = 1; k < rio.puntos.length; k++) {
      let x0 = Math.floor(rio.puntos[k - 1]!.x / t.celda);
      let y0 = Math.floor(rio.puntos[k - 1]!.y / t.celda);
      const x1 = Math.floor(rio.puntos[k]!.x / t.celda);
      const y1 = Math.floor(rio.puntos[k]!.y / t.celda);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        if (x0 >= 0 && y0 >= 0 && x0 < t.columnas && y0 < t.filas) {
          const i = (y0 * t.columnas + x0) * 4;
          d[i] = COLOR_RIO[0];
          d[i + 1] = COLOR_RIO[1];
          d[i + 2] = COLOR_RIO[2];
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  }
  cctx.putImageData(img, 0, 0);
  imagenesDeLejos.set(mapa, capa);
  return capa;
}

// ─────────────────────────── de cerca ───────────────────────────

let cacheCerca: { mapa: MapaGenerado; clave: string; capa: HTMLCanvasElement } | null = null;

/** La vista a media resolución de pantalla, muestreando los rasters punto a punto. */
function imagenDeCerca(mapa: MapaGenerado, v: VistaDelMundo): HTMLCanvasElement {
  const ancho = Math.max(1, Math.round(((v.x1 - v.x0) * v.escala) / 2));
  const alto = Math.max(1, Math.round(((v.y1 - v.y0) * v.escala) / 2));
  const clave = [v.x0, v.y0, v.escala, ancho, alto].map((n) => n.toFixed(4)).join('|');
  if (cacheCerca && cacheCerca.mapa === mapa && cacheCerca.clave === clave) return cacheCerca.capa;
  const t = mapa.rasters!.terreno!;
  const alt = mapa.rasters!.altura!;
  const bosque = mapa.rasters!.densidadBosque;
  const capa = cacheCerca?.capa ?? document.createElement('canvas');
  capa.width = ancho;
  capa.height = alto;
  const cctx = capa.getContext('2d')!;
  const img = cctx.createImageData(ancho, alto);
  const d = img.data;
  const paso = (v.x1 - v.x0) / ancho;
  const pasoY = (v.y1 - v.y0) / alto;
  const dz = t.celda; // el gradiente se mide a una celda: más fino saldría el escalón de la interpolación
  const h = (x: number, y: number) => (bilineal(alt, x, y) / 65535) * ESCALA_RELIEVE;
  for (let j = 0; j < alto; j++) {
    const y = v.y0 + (j + 0.5) * pasoY;
    for (let i = 0; i < ancho; i++) {
      const x = v.x0 + (i + 0.5) * paso;
      const clase = celdaDe(t, x + desplazamiento(x, y, t.celda, 11), y + desplazamiento(x, y, t.celda, 23));
      let color: readonly number[] = COLOR_CLASE[clase] ?? COLOR_CLASE[1]!;
      if (bosque && clase > 2) {
        const dens = bilineal(bosque, x, y);
        if (dens >= UMBRAL_BOSQUE) color = mezcla(color, COLOR_BOSQUE, 0.15 + 0.35 * (dens / 255));
      }
      const k = clase <= 1 ? 1 : luz((h(x + dz, y) - h(x - dz, y)) / (2 * dz), (h(x, y + dz) - h(x, y - dz)) / (2 * dz));
      const p = (j * ancho + i) * 4;
      d[p] = Math.min(255, color[0]! * k);
      d[p + 1] = Math.min(255, color[1]! * k);
      d[p + 2] = Math.min(255, color[2]! * k);
      d[p + 3] = 255;
    }
  }
  cctx.putImageData(img, 0, 0);
  cacheCerca = { mapa, clave, capa };
  return capa;
}

/** Árboles sueltos: uno cada ~1,2 u con probabilidad = densidad, en sitios fijos por hash de la posición. Solo de cerca. */
function pintarArboles(ctx: CanvasRenderingContext2D, mapa: MapaGenerado, v: VistaDelMundo): void {
  const bosque = mapa.rasters?.densidadBosque;
  const t = mapa.rasters?.terreno;
  const PASO = 1.2;
  if (!bosque || !t || v.escala * PASO < 6) return;
  const tamano = Math.max(2, Math.min(PASO * 0.7, 1) * v.escala);
  ctx.fillStyle = 'rgba(22, 58, 24, 0.9)';
  ctx.beginPath();
  for (let gy = Math.floor(v.y0 / PASO) - 1; gy <= Math.ceil(v.y1 / PASO); gy++) {
    for (let gx = Math.floor(v.x0 / PASO) - 1; gx <= Math.ceil(v.x1 / PASO); gx++) {
      const x = (gx + 0.15 + 0.7 * hash2(gx, gy, 3)) * PASO;
      const y = (gy + 0.15 + 0.7 * hash2(gx, gy, 5)) * PASO;
      const dens = bilineal(bosque, x, y);
      if (dens < UMBRAL_BOSQUE || hash2(gx, gy, 9) * 255 >= dens || celdaDe(t, x, y) <= 2) continue;
      const px = x * v.escala;
      const py = y * v.escala;
      ctx.moveTo(px, py - tamano);
      ctx.lineTo(px + tamano * 0.65, py + tamano * 0.55);
      ctx.lineTo(px - tamano * 0.65, py + tamano * 0.55);
      ctx.closePath();
    }
  }
  ctx.fill();
}

/** El suelo del mundo en la vista: de lejos la imagen de celdas; de cerca la vista muestreada y los árboles. */
export function pintarSueloDelArtefacto(ctx: CanvasRenderingContext2D, mapa: MapaGenerado, v: VistaDelMundo): void {
  ctx.save();
  if (!esDeCerca(mapa, v.escala)) {
    ctx.imageSmoothingEnabled = v.escala * mapa.rasters!.terreno!.celda < 2;
    ctx.drawImage(imagenDeLejos(mapa), 0, 0, mapa.config.ancho * v.escala, mapa.config.alto * v.escala);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagenDeCerca(mapa, v), v.x0 * v.escala, v.y0 * v.escala, (v.x1 - v.x0) * v.escala, (v.y1 - v.y0) * v.escala);
  }
  ctx.restore();
}

export function pintarArbolesDelArtefacto(ctx: CanvasRenderingContext2D, mapa: MapaGenerado, v: VistaDelMundo): void {
  if (esDeCerca(mapa, v.escala)) pintarArboles(ctx, mapa, v);
}
