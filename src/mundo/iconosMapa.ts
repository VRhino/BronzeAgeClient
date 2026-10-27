// Iconos del mapa del mundo: game-icons.net (CC BY 3.0, autores en `src/sigilo/CREDITOS.md`), como los emblemas del sigilo.
// `iconosMapa.json` guarda el trazado de cada uno en un lienzo de 512×512; para cambiar un icono, ver `CREDITOS.md`.
import iconos from './iconosMapa.json';

export interface IconoMapa {
  /** Autor en game-icons.net: hay que citarlo (CC BY 3.0). */
  autor: string;
  icono: string;
  d: string;
}

export const ICONOS_MAPA: Record<string, IconoMapa> = iconos;

const trazados = new Map<string, Path2D>();

function trazado(id: string): Path2D | undefined {
  let p = trazados.get(id);
  if (!p) {
    const icono = ICONOS_MAPA[id];
    if (!icono || typeof Path2D === 'undefined') return undefined;
    p = new Path2D(icono.d);
    trazados.set(id, p);
  }
  return p;
}

/**
 * Pinta el icono `id` centrado en (x, y) con `lado` px de lado, como el emblema del sigilo: un halo oscuro debajo (para que se lea
 * sobre cualquier suelo y sobre la niebla) y encima el relleno. Devuelve false si el icono no existe, para que quien llama pinte
 * su glifo de siempre.
 */
export function dibujarIconoMapa(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, lado: number, relleno: string, halo = '#1b1a17'): boolean {
  const p = trazado(id);
  if (!p) return false;
  const s = lado / 512;
  ctx.save();
  ctx.translate(x - lado / 2, y - lado / 2);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = halo;
  ctx.lineWidth = Math.min(80, 3 / s); // ≈3 px de halo a cualquier tamaño
  ctx.stroke(p);
  ctx.fillStyle = relleno;
  ctx.fill(p);
  ctx.restore();
  return true;
}
