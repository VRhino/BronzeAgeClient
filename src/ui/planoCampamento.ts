// La planta del campamento de mercenarios (backend D73, `EscenaCampamento`), dibujada como plano: calles, empalizada con su puerta y los
// edificios con la taberna en el centro. Solo presentación: lo que sale es lo que manda el backend, que la deriva del id del campamento.
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE } from '../paletas';
import type { EscenaCampamento } from '../tiposDominio';

const LADO = 340;
const MARGEN = 12;

/** El SVG del plano. Una celda mide `unidadesPorCelda` unidades; todo se escala para caber en `LADO`. */
export function svgPlanoCampamento(escena: EscenaCampamento): string {
  const u = escena.unidadesPorCelda;
  const rects: { x: number; y: number; w: number; h: number; color: string; titulo: string; opacidad?: number }[] = [];
  for (const c of escena.calles) rects.push({ x: c.col * u, y: c.row * u, w: c.ancho * u, h: c.alto * u, color: '#7a6a4a', titulo: 'Calle', opacidad: 0.55 });
  for (const m of escena.empalizada) rects.push({ x: m.col * u, y: m.row * u, w: u, h: u, color: m.clase === 'puerta' ? '#f1d38b' : '#4a3a24', titulo: m.clase === 'puerta' ? 'Puerta' : 'Empalizada' });
  for (const e of escena.edificios) {
    rects.push({ x: e.posicion.x - (e.ancho * u) / 2, y: e.posicion.y - (e.alto * u) / 2, w: e.ancho * u, h: e.alto * u, color: EDIFICIO_COLOR[e.tipo] ?? '#888', titulo: EDIFICIO_NOMBRE[e.tipo] ?? e.tipo });
  }
  if (rects.length === 0) return '';
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const ancho = Math.max(...rects.map((r) => r.x + r.w)) - minX;
  const alto = Math.max(...rects.map((r) => r.y + r.h)) - minY;
  const escala = (LADO - 2 * MARGEN) / Math.max(ancho, alto, 1);
  const f = (n: number): string => n.toFixed(1);
  const dibujo = rects
    .map((r) => `<rect x="${f(MARGEN + (r.x - minX) * escala)}" y="${f(MARGEN + (r.y - minY) * escala)}" width="${f(r.w * escala)}" height="${f(r.h * escala)}" fill="${r.color}"${r.opacidad ? ` opacity="${r.opacidad}"` : ''} stroke="rgba(0,0,0,0.35)" stroke-width="0.5"><title>${r.titulo}</title></rect>`)
    .join('');
  return `<svg class="campamento-plano" viewBox="0 0 ${LADO} ${LADO}" width="${LADO}" height="${LADO}" role="img" aria-label="Planta del campamento">${dibujo}</svg>`;
}

/** La leyenda: un cuadrado de color por tipo de edificio que hay en la planta. */
export function leyendaPlanoCampamento(escena: EscenaCampamento): string {
  const tipos = [...new Set(escena.edificios.map((e) => e.tipo))];
  return `<div class="campamento-leyenda">${tipos.map((t) => `<span><i style="background:${EDIFICIO_COLOR[t] ?? '#888'}"></i>${EDIFICIO_NOMBRE[t] ?? t}</span>`).join('')}<span><i style="background:#f1d38b"></i>Puerta</span></div>`;
}
