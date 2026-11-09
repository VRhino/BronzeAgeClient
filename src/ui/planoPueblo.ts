// La planta de un pueblo extractor o de una aldea (`EscenaPueblo`, la que manda el motor estando dentro) en SVG: el minimapa de su vista 3D. Suelo
// llano, calles y caminos, y cada pieza con su color; encuadrada sobre todo lo que hay, con un margen.
import type { EscenaPueblo } from '../tiposDominio';

const COLOR: Record<string, string> = {
  vivienda: '#c9b27c',
  almacen: '#8a6a44',
  corral: '#a58b5c',
  granja: '#b7a24e',
  cantera: '#bdb4a2',
  mina: '#d6b544',
  minaCobre: '#4f8f6f',
  minaEstano: '#4a4542',
  minaHierro: '#8e3f2a',
  // las granjas de las aldeas de viñas y de olivos (tanda 69)
  vina: '#6f7f3a',
  olivar: '#8a9466',
};
const NOMBRE: Record<string, string> = {
  vivienda: 'Vivienda',
  almacen: 'Almacén',
  corral: 'Corral',
  granja: 'Granja',
  cantera: 'Cantera',
  mina: 'Mina de oro',
  minaCobre: 'Mina de cobre',
  minaEstano: 'Mina de estaño',
  minaHierro: 'Mina de hierro',
  vina: 'Viña',
  olivar: 'Olivar',
};
const SUELO = '#93c26b';

/** El nombre de una pieza de un pueblo, para el jugador; la granja de una aldea de viñas o de olivos (`cultivo`, tanda 69) es una viña o un olivar. */
export function nombreDePiezaPueblo(tipo: string, cultivo?: string): string {
  return NOMBRE[tipoDePieza(tipo, cultivo)] ?? tipo;
}

function tipoDePieza(tipo: string, cultivo: string | undefined): string {
  return tipo === 'granja' && cultivo === 'vid' ? 'vina' : tipo === 'granja' && cultivo === 'oliva' ? 'olivar' : tipo;
}

/** El SVG de la planta, en unidades locales, encuadrado sobre las piezas, las calles y los caminos con un margen del 12 %. */
export function svgPlanoPueblo(e: EscenaPueblo): string {
  const rects = [...e.edificios.map((p) => ({ x: p.posicion.x - p.ancho / 2, y: p.posicion.y - p.alto / 2, ancho: p.ancho, alto: p.alto })), ...e.calles, ...e.caminos];
  if (rects.length === 0) return '';
  const minX = Math.min(...rects.map((r) => r.x)), minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.ancho)), maxY = Math.max(...rects.map((r) => r.y + r.alto));
  const lado = Math.max(maxX - minX, maxY - minY), caja = lado * 1.24, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const f = (n: number): string => n.toFixed(2);
  const rect = (x: number, y: number, w: number, h: number, relleno: string, titulo = '', extra = ''): string =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${relleno}"${extra}>${titulo ? `<title>${titulo}</title>` : ''}</rect>`;
  const caminos = e.caminos.map((r) => rect(r.x, r.y, r.ancho, r.alto, 'rgba(120, 92, 58, 0.38)')).join('');
  const calles = e.calles.map((r) => rect(r.x, r.y, r.ancho, r.alto, 'rgba(120, 92, 58, 0.60)')).join('');
  const piezas = e.edificios
    .map((p) => rect(p.posicion.x - p.ancho / 2, p.posicion.y - p.alto / 2, p.ancho, p.alto, COLOR[tipoDePieza(p.tipo, e.cultivo)] ?? '#888', nombreDePiezaPueblo(p.tipo, e.cultivo), ` stroke="#1b1a17" stroke-width="${f(lado * 0.004)}"`))
    .join('');
  return `<svg class="pueblo-plano" viewBox="${f(cx - caja / 2)} ${f(cy - caja / 2)} ${f(caja)} ${f(caja)}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="Planta del pueblo">${rect(cx - caja / 2, cy - caja / 2, caja, caja, SUELO)}${caminos}${calles}${piezas}</svg>`;
}
