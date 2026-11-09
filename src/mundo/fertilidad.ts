// Dónde cabe una aldea agrícola (mecánica 50): el motor la acepta en tierra firme, dentro de la zona de la plaza, a `separacionMinima` de toda
// plaza y todo pueblo y con fertilidad de `fertilidadMinima` o más en ese punto (`pueblos.rs`, `sitio_de_aldea_sin_ruta`). Aquí se buscan esos
// puntos con la capa de fertilidad de su cultivo (`fertilidad` el trigo, `fertilidadVid` y `fertilidadOliva` la vid y el olivo: tanda 69;
// `fertilidadCebada` y `fertilidadSesamo` la cebada y el sésamo: motor b55e90f) del artefacto,
// para enseñarlos al elegir el sitio y al fundar. El camino hasta la plaza no se puede saber
// aquí (es el A* del motor): un punto válido puede salir rechazado por eso.
import type { MapaGenerado, Point, RasterU8 } from '../terreno';

/** El cultivo de una aldea (tanda 69, Economia_Construccion §14.0; la cebada y el sésamo desde el motor b55e90f): cada uno mira su capa de
 * fertilidad. */
export type Cultivo = 'trigo' | 'vid' | 'oliva' | 'cebada' | 'sesamo';

/** Todos, en el orden en que se ofrecen. */
export const CULTIVOS_DE_ALDEA: readonly Cultivo[] = ['trigo', 'vid', 'oliva', 'cebada', 'sesamo'];

/** ¿Es el id de un cultivo de aldea? */
export const esCultivo = (x: unknown): x is Cultivo => typeof x === 'string' && (CULTIVOS_DE_ALDEA as readonly string[]).includes(x);

/** La capa de fertilidad de un cultivo, como la lee el motor (`Geografia::fertilidad_en(punto, cultivo)`); `undefined` si el artefacto no la trae. */
export function capaDe(mapa: MapaGenerado, cultivo: Cultivo): RasterU8 | undefined {
  const r = mapa.rasters;
  switch (cultivo) {
    case 'vid': return r?.fertilidadVid;
    case 'oliva': return r?.fertilidadOliva;
    case 'cebada': return r?.fertilidadCebada;
    case 'sesamo': return r?.fertilidadSesamo;
    default: return r?.fertilidad;
  }
}

/** Paso de la rejilla de búsqueda, en unidades (el raster tiene celdas de varias unidades: más fino no aporta). */
const PASO = 0.5;

export interface SitiosDeAldea {
  /** Puntos donde la aldea cabría hoy (salvo el camino). */
  validos: Point[];
  /** Fértiles, pero demasiado cerca de una plaza o un pueblo. */
  cerca: Point[];
  /** La mejor fertilidad (0..1) entre los válidos; 0 si no hay. */
  mejor: number;
  paso: number;
}

/** La fertilidad (0..1) para `cultivo` (de serie, el trigo) de la celda donde cae `p`, como la lee el motor; `null` sin la capa o fuera del mapa. */
export function fertilidadEn(mapa: MapaGenerado, p: Point, cultivo: Cultivo = 'trigo'): number | null {
  const r = capaDe(mapa, cultivo);
  if (!r || p.x < 0 || p.y < 0) return null;
  const c = Math.floor(p.x / r.celda);
  const f = Math.floor(p.y / r.celda);
  if (c >= r.columnas || f >= r.filas) return null;
  return r.datos[f * r.columnas + c]! / 255;
}

/** ¿Tierra firme? Agua (1) y cima (6) no; sin clase (0), tampoco. */
function firme(mapa: MapaGenerado, p: Point): boolean {
  const t = mapa.rasters?.terreno;
  if (!t || p.x < 0 || p.y < 0) return false;
  const c = Math.floor(p.x / t.celda);
  const f = Math.floor(p.y / t.celda);
  if (c >= t.columnas || f >= t.filas) return false;
  const clase = t.datos[f * t.columnas + c]!;
  return clase > 1 && clase < 6;
}

function dentroDelPoligono(p: Point, poligono: readonly Point[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!, b = poligono[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/**
 * Los sitios de aldea de una zona: un polígono (la zona real de la plaza) o un círculo (`radio` alrededor de `centro`, la zona al fundar).
 * `ocupados` son las plazas y los pueblos (y obras de pueblo) que se conocen; los que no se ven no cuentan, y el motor sí los mira. `cultivo`
 * elige la capa de fertilidad (de serie, la del trigo).
 */
export function sitiosDeAldea(
  mapa: MapaGenerado,
  zona: { centro: Point; radio: number; poligono?: readonly Point[]; anillo?: { desde: number; hasta: number } },
  ocupados: readonly Point[],
  fertilidadMinima: number,
  separacionMinima: number,
  cultivo: Cultivo = 'trigo',
): SitiosDeAldea | null {
  if (!capaDe(mapa, cultivo)) return null;
  const pol = zona.poligono && zona.poligono.length > 2 ? zona.poligono : null;
  const caja = pol
    ? pol.reduce((c, q) => ({ x0: Math.min(c.x0, q.x), y0: Math.min(c.y0, q.y), x1: Math.max(c.x1, q.x), y1: Math.max(c.y1, q.y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
    : { x0: zona.centro.x - zona.radio, y0: zona.centro.y - zona.radio, x1: zona.centro.x + zona.radio, y1: zona.centro.y + zona.radio };
  const dentro = (p: Point) => (pol ? dentroDelPoligono(p, pol) : Math.hypot(p.x - zona.centro.x, p.y - zona.centro.y) <= zona.radio);
  const s2 = separacionMinima * separacionMinima;
  const r: SitiosDeAldea = { validos: [], cerca: [], mejor: 0, paso: PASO };
  for (let y = Math.ceil(caja.y0 / PASO) * PASO; y <= caja.y1; y += PASO) {
    for (let x = Math.ceil(caja.x0 / PASO) * PASO; x <= caja.x1; x += PASO) {
      const p = { x, y };
      if (!dentro(p) || !firme(mapa, p)) continue;
      // la siguiente aldea va en su anillo, (desde, hasta] u de la plaza
      if (zona.anillo) { const d = Math.hypot(x - zona.centro.x, y - zona.centro.y); if (d <= zona.anillo.desde || d > zona.anillo.hasta) continue; }
      const f = fertilidadEn(mapa, p, cultivo) ?? 0;
      if (f < fertilidadMinima) continue;
      if (ocupados.some((o) => (o.x - x) ** 2 + (o.y - y) ** 2 < s2)) { r.cerca.push(p); continue; }
      r.validos.push(p);
      r.mejor = Math.max(r.mejor, f);
    }
  }
  return r;
}

/** Pinta los sitios sobre el mapa (en `escala` px por unidad): los válidos en verde, los fértiles pero cerca de algo en gris. */
export function pintarSitiosDeAldea(ctx: CanvasRenderingContext2D, s: SitiosDeAldea, escala: number): void {
  const lado = Math.max(1.5, s.paso * escala);
  ctx.save();
  ctx.fillStyle = 'rgba(160, 160, 150, 0.45)';
  for (const p of s.cerca) ctx.fillRect(p.x * escala - lado / 2, p.y * escala - lado / 2, lado, lado);
  ctx.fillStyle = 'rgba(70, 200, 90, 0.6)';
  for (const p of s.validos) ctx.fillRect(p.x * escala - lado / 2, p.y * escala - lado / 2, lado, lado);
  ctx.restore();
}
