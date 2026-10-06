// La planta del campamento de mercenarios (backend D73, `EscenaCampamento`), dibujada como la dibuja el cliente admin (`drawCampamento`):
// suelo de tierra llana, calles, empalizada con su puerta y los edificios con su rótulo, encuadrada para que la empalizada llene el lienzo.
// Solo presentación: lo que sale es lo que manda el backend, que la deriva del id del campamento.
import type { EscenaCampamento } from '../tiposDominio';

/** Colores y nombres por elemento, los mismos que el cliente admin (`COLOR_ELEMENTO_CAMPAMENTO`). */
const COLOR: Record<string, string> = {
  taberna: '#a0672d',
  vivienda: '#c9b27c',
  mercado: '#d6a437',
  puestoMercado: '#e0c070',
  barracon: '#7a2f2f',
  galeriaDeTiro: '#566b3a',
  caballerizas: '#6b5638',
  plazaDeArmas: '#9a8f78',
  plaza: '#b9ae94',
  pozo: '#7d8f9a',
  parque: '#8fb070',
};
const NOMBRE: Record<string, string> = {
  taberna: 'Taberna',
  vivienda: 'Vivienda',
  mercado: 'Mercado',
  puestoMercado: 'Puesto de mercado',
  barracon: 'Barracón',
  galeriaDeTiro: 'Galería de tiro',
  caballerizas: 'Caballerizas',
  plazaDeArmas: 'Plaza de armas',
  plaza: 'Plaza',
  pozo: 'Pozo',
  parque: 'Parque',
};
/** Los que llevan su nombre escrito encima (los demás son relleno del trazado). */
const ROTULADOS = new Set(['taberna', 'mercado', 'barracon', 'galeriaDeTiro', 'caballerizas', 'plazaDeArmas']);
export const COLOR_SUELO_CAMPAMENTO = '#93c26b';

/** El SVG del plano, en unidades del mundo y encuadrado sobre la empalizada con un margen del 12 % (como el 80 % del admin). */
export function svgPlanoCampamento(escena: EscenaCampamento): string {
  const u = escena.unidadesPorCelda;
  if (escena.empalizada.length === 0) return '';
  const minX = Math.min(...escena.empalizada.map((m) => m.col)) * u;
  const minY = Math.min(...escena.empalizada.map((m) => m.row)) * u;
  const maxX = (Math.max(...escena.empalizada.map((m) => m.col)) + 1) * u;
  const maxY = (Math.max(...escena.empalizada.map((m) => m.row)) + 1) * u;
  const lado = Math.max(maxX - minX, maxY - minY);
  const margen = lado * 0.12;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const caja = lado + 2 * margen;
  const f = (n: number): string => n.toFixed(2);
  const rect = (x: number, y: number, w: number, h: number, relleno: string, titulo = '', extra = ''): string =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${relleno}"${extra}>${titulo ? `<title>${titulo}</title>` : ''}</rect>`;
  const fuente = lado * 0.024;

  const calles = escena.calles.map((c) => rect(c.col * u, c.row * u, c.ancho * u, c.alto * u, 'rgba(120, 92, 58, 0.60)')).join('');
  const muros = escena.empalizada.map((m) => rect(m.col * u, m.row * u, u, u, m.clase === 'puerta' ? '#e8dcb8' : '#6b4a2a', m.clase === 'puerta' ? 'Puerta' : 'Empalizada')).join('');
  const edificios = escena.edificios
    .map((e) => {
      const w = e.ancho * u;
      const h = e.alto * u;
      const x = e.posicion.x - w / 2;
      const y = e.posicion.y - h / 2;
      const nombre = NOMBRE[e.tipo] ?? e.tipo;
      const caja = rect(x, y, w, h, COLOR[e.tipo] ?? '#888', nombre, ` stroke="#1b1a17" stroke-width="${f(lado * 0.0025)}"`);
      if (!ROTULADOS.has(e.tipo)) return caja;
      // Un rótulo que no cabe se aprieta al ancho de la huella, como el `maxWidth` del `fillText` del admin.
      const apretar = nombre.length * fuente * 0.58 > w - 2 ? ` textLength="${f(w - 2)}" lengthAdjust="spacingAndGlyphs"` : '';
      return `${caja}<text x="${f(e.posicion.x)}" y="${f(e.posicion.y)}" fill="#fff" font-size="${f(fuente)}" text-anchor="middle" dominant-baseline="middle"${apretar}>${nombre}</text>`;
    })
    .join('');
  return `<svg class="campamento-plano" viewBox="${f(cx - caja / 2)} ${f(cy - caja / 2)} ${f(caja)} ${f(caja)}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="Planta del campamento">${rect(cx - caja / 2, cy - caja / 2, caja, caja, COLOR_SUELO_CAMPAMENTO)}${calles}${muros}${edificios}</svg>`;
}

/** La leyenda: un cuadrado de color por tipo de elemento que hay en la planta. */
export function leyendaPlanoCampamento(escena: EscenaCampamento): string {
  const tipos = [...new Set(escena.edificios.map((e) => e.tipo))];
  return `<div class="campamento-leyenda">${tipos.map((t) => `<span><i style="background:${COLOR[t] ?? '#888'}"></i>${NOMBRE[t] ?? t}</span>`).join('')}<span><i style="background:#e8dcb8"></i>Puerta</span></div>`;
}
