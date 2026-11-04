// La zona de una plaza que se vio y ya no se ve (Víctor, 2026-11-04: fuera de lo que ves las fronteras «se dejan de ver bien», y en el modo
// mapa «debería mostrar la frontera cuando chocan las áreas de influencia»). De lo recordado el servidor guarda solo el radio
// (`AsentamientoConocido.radioPotencial`); como círculo entero se metía en las zonas vecinas. Aquí se recorta como lo hace el motor
// (`territorio::zona::poligono`): un disco que toca el de otra Facción se corta por una recta perpendicular a la que une los centros, a
// d · r_yo / (r_yo + r_otro) de su centro. Las de la misma Facción no se recortan (se funden al pintar). Los discos son los que se conocen:
// los que se ven (su radio, el de su silueta) y los recordados (el suyo).
import type { AsentamientoAvistado, AsentamientoConocido, Point } from '../tiposDominio';

export interface Disco { centro: Point; radio: number; faccionId: string }

/** Lados del polígono, como el del motor (`poligono_zona`, 48). */
const LADOS = 48;

/** El radio de una silueta vista: lo más lejos que llega del centro (los vértices sin recortar caen en el círculo). */
export function radioDeSilueta(centro: Point, zona: readonly Point[]): number {
  let r = 0;
  for (const q of zona) r = Math.max(r, Math.hypot(q.x - centro.x, q.y - centro.y));
  return r;
}

/** El polígono de la zona de `yo` recortado por los discos de otras Facciones que lo tocan (Sutherland-Hodgman, como el motor). */
export function poligonoDeZona(yo: Disco, otros: readonly Disco[], lados = LADOS): Point[] {
  const { x: cx, y: cy } = yo.centro;
  let pol: Point[] = Array.from({ length: lados }, (_, i) => {
    const a = (Math.PI * 2 * i) / lados;
    return { x: cx + yo.radio * Math.cos(a), y: cy + yo.radio * Math.sin(a) };
  });
  for (const o of otros) {
    const vx = o.centro.x - cx, vy = o.centro.y - cy, d = Math.hypot(vx, vy);
    if (o.faccionId === yo.faccionId || d === 0 || d > yo.radio + o.radio) continue;
    const nx = vx / d, ny = vy / d, k = (d * yo.radio) / (yo.radio + o.radio);
    const fuera = (p: Point) => nx * (p.x - cx) + ny * (p.y - cy) - k;
    const nuevo: Point[] = [];
    for (let i = 0; i < pol.length; i++) {
      const a = pol[i]!, b = pol[(i + 1) % pol.length]!, fa = fuera(a), fb = fuera(b);
      if (fa <= 0) nuevo.push(a);
      if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); nuevo.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); }
    }
    pol = nuevo;
    if (pol.length < 3) return [];
  }
  return pol;
}

/** La zona de cada plaza recordada que tiene radio, recortada contra las demás que se conocen, por id. */
export function zonasDeLoRecordado(avistados: readonly AsentamientoAvistado[] | undefined, conocidos: readonly AsentamientoConocido[] | undefined): Map<string, Point[]> {
  const discos: (Disco & { id: string })[] = [];
  for (const a of avistados ?? []) if ((a.zona?.length ?? 0) >= 3) discos.push({ id: a.id, centro: a.posicion, radio: radioDeSilueta(a.posicion, a.zona), faccionId: a.faccionId || `sin-${a.id}` });
  for (const c of conocidos ?? []) if (c.radioPotencial !== undefined) discos.push({ id: c.asentamientoId, centro: c.posicion, radio: c.radioPotencial, faccionId: c.faccionId || `sin-${c.asentamientoId}` });
  const out = new Map<string, Point[]>();
  for (const c of conocidos ?? []) {
    const yo = discos.find((d) => d.id === c.asentamientoId);
    if (!yo) continue;
    const pol = poligonoDeZona(yo, discos.filter((d) => d !== yo));
    if (pol.length >= 3) out.set(c.asentamientoId, pol);
  }
  return out;
}
