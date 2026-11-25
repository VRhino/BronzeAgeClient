// Los ríos del mundo 3D, como parte del suelo (autor, 2026-11-25: «construimos de 0 el cómo se muestra»). Antes cada río era una cinta de
// agua puesta encima de un suelo sin cauce: la orilla del agua era el borde de la cinta, en las juntas se solapaban y en las curvas se
// doblaban. Ahora es como el mar y los lagos (`terreno.ts`, `agua.ts`): un campo dice, en cada punto, a qué distancia queda el río, su medio
// ancho y su nivel; cada tesela talla con él el cauce en su suelo y pone la lámina de agua a ese nivel, que el suelo corta por la orilla. Las
// juntas se unen solas (es el mismo campo), y el agua de un río que llega a un lago o al mar es la misma lámina.
import type { RioZona } from '../terreno/tipos';
import { anchoDelRio } from '../terreno/tipos';
import { AGUA } from './agua';
import { MUNDO3D } from './config';
import type { FuenteDeAltura } from './fuente';

type Punto = { x: number; y: number };
const { metrosPorUnidad: MPU } = MUNDO3D;

export const RIO = {
  /** La separación de las muestras de la curva de cada río (u). */
  paso: 0.5,
  /** Lo hondo que se ve el agua en medio del cauce (u): `base + porMedio · medio ancho`, como mucho `AGUA.maxima`. Exagerado, como el mar,
   * para que el color del agua (somero en la orilla, más hondo en medio) se lea a la escala del mundo. */
  hondo: { base: 0.35, porMedio: 0.5 },
  /** La orilla: de la lámina al relieve en `orilla` medios anchos, como poco `orillaMinima` u. */
  orilla: 0.6, orillaMinima: 0.6,
  /** Lo que queda la orilla sobre la lámina (u): el agua no se sale del cauce aunque el relieve de al lado quede más bajo. */
  seco: AGUA.seco,
  /** La franja de suelo mojado junto al agua (u). */
  mojado: 1.2,
};

/** Lo que da el campo en un punto: el suelo con el cauce tallado (m); el nivel del agua (m, NaN si el punto no cae en un río); cuánto se
 * moja el suelo (0..1) y el rumbo de la corriente (u por segundo de las olas). */
export interface EnRio { suelo: number; nivel: number; mojado: number; cx: number; cy: number }

/** Las muestras de la curva de un río (Catmull-Rom centrípeta por sus puntos, cada `paso` u) con el ancho de cada una, interpolado entre los
 * puntos del motor. */
export function curvaConAncho(rio: Pick<RioZona, 'puntos' | 'anchos' | 'navegable'>, paso = RIO.paso): { x: number; y: number; ancho: number }[] {
  const ps = rio.puntos, out = [{ ...ps[0]!, ancho: anchoDelRio(rio, 0) }];
  for (let i = 0; i + 1 < ps.length; i++) {
    const p0 = ps[Math.max(0, i - 1)]!, p1 = ps[i]!, p2 = ps[i + 1]!, p3 = ps[Math.min(ps.length - 1, i + 2)]!;
    const t = (a: Punto, b: Punto) => Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)) || 1e-6;
    const t1 = t(p0, p1), t2 = t1 + t(p1, p2), t3 = t2 + t(p2, p3);
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / paso)), wa = anchoDelRio(rio, i), wb = anchoDelRio(rio, i + 1);
    for (let k = 1; k <= n; k++) {
      const u = t1 + ((t2 - t1) * k) / n;
      const mezcla = (a: Punto, b: Punto, ta: number, tb: number) => ({ x: ((tb - u) * a.x + (u - ta) * b.x) / (tb - ta), y: ((tb - u) * a.y + (u - ta) * b.y) / (tb - ta) });
      const a1 = mezcla(p0, p1, 0, t1), a2 = mezcla(p1, p2, t1, t2), a3 = mezcla(p2, p3, t2, t3);
      const q = k === n ? p2 : mezcla(mezcla(a1, a2, 0, t2), mezcla(a2, a3, t1, t3), t1, t2);
      out.push({ x: q.x, y: q.y, ancho: wa + ((wb - wa) * k) / n });
    }
  }
  return out;
}

/** Si el cauce acaba a poco de un lago o del mar (el generador lo deja en la orilla de su raster, más basto que el relieve), lo alarga en su
 * último rumbo hasta el agua, `hasta` u como mucho; si no hay agua tan cerca, lo deja como está. */
export function alargarHastaElAgua<T extends Punto>(puntos: readonly T[], aguaEn: (x: number, y: number) => boolean, hasta = 8, paso = 0.25): T[] {
  const n = puntos.length;
  if (n < 2) return [...puntos];
  const b = puntos[n - 1]!, a = puntos[n - 2]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / l, uy = (b.y - a.y) / l;
  for (let d = 0; d <= hasta; d += paso) if (aguaEn(b.x + ux * d, b.y + uy * d)) return d ? [...puntos, { ...b, x: b.x + ux * d, y: b.y + uy * d }] : [...puntos];
  return [...puntos];
}

const suave = (t: number): number => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/** El campo de los ríos: por segmento de la curva de cada río, sus extremos, su medio ancho y su nivel (m) en cada uno, en una rejilla de
 * cubos para buscar los cercanos. */
export class CampoDeRios {
  private static readonly CUBO = 4;
  /** Por segmento: ax ay bx by medioA medioB nivelA nivelB. */
  private readonly s: Float64Array;
  private readonly cubos = new Map<number, number[]>();
  /** Las curvas de los ríos, con su medio ancho y su nivel por muestra (para los vados). */
  readonly curvas: { rio: RioZona; puntos: { x: number; y: number; medio: number; nivel: number }[] }[];

  constructor(rios: readonly RioZona[], fuente: FuenteDeAltura) {
    this.curvas = rios.filter((r) => r.puntos.length >= 2).map((rio) => {
      const curva = alargarHastaElAgua(curvaConAncho(rio), (x, y) => fuente.aguaEn(x, y));
      // el nivel: lo más bajo del lecho (el relieve en el eje, que el generador talla siempre bajando) desde el nacimiento
      let antes = Infinity;
      return { rio, puntos: curva.map((q) => { antes = Math.min(antes, fuente.alturaEn(q.x, q.y)); return { x: q.x, y: q.y, medio: q.ancho / 2, nivel: antes }; }) };
    });
    const segs: number[] = [];
    for (const { puntos } of this.curvas) for (let i = 0; i + 1 < puntos.length; i++) {
      const a = puntos[i]!, b = puntos[i + 1]!, k = segs.length / 8;
      segs.push(a.x, a.y, b.x, b.y, a.medio, b.medio, a.nivel, b.nivel);
      const r = Math.max(a.medio, b.medio) * (1 + RIO.orilla) + Math.max(RIO.orillaMinima, RIO.mojado) + 2, C = CampoDeRios.CUBO;
      for (let cy = Math.floor((Math.min(a.y, b.y) - r) / C); cy <= Math.floor((Math.max(a.y, b.y) + r) / C); cy++)
        for (let cx = Math.floor((Math.min(a.x, b.x) - r) / C); cx <= Math.floor((Math.max(a.x, b.x) + r) / C); cx++) {
          const c = cx * 65536 + cy;
          (this.cubos.get(c) ?? this.cubos.set(c, []).get(c)!).push(k);
        }
    }
    this.s = Float64Array.from(segs);
  }

  /** El punto (x, y) con el suelo a `h` m: el suelo con el cauce de los ríos cercanos tallado y, si cae en uno, el nivel de su agua (el más
   * bajo de los que lo cubren) y su corriente. `medioMinimo` (u): el medio ancho con que se pinta un río estrecho, para que la rejilla del
   * suelo (cada `paso` u) lo recoja siempre. `null` lejos de todo río. */
  en(x: number, y: number, h: number, medioMinimo: number): EnRio | null {
    const lista = this.cubos.get(Math.floor(x / CampoDeRios.CUBO) * 65536 + Math.floor(y / CampoDeRios.CUBO));
    if (!lista) return null;
    const s = this.s, seco = RIO.seco * MPU;
    let suelo = Infinity, nivel = Number.NaN, mojado = 0, cx = 0, cy = 0, cerca = false;
    for (const k of lista) {
      const ax = s[8 * k]!, ay = s[8 * k + 1]!, dx = s[8 * k + 2]! - ax, dy = s[8 * k + 3]! - ay, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
      const medio = Math.max(medioMinimo, s[8 * k + 4]! + (s[8 * k + 5]! - s[8 * k + 4]!) * t);
      const orilla = Math.max(RIO.orillaMinima, medio * RIO.orilla);
      if (d >= medio + Math.max(orilla, RIO.mojado)) continue;
      cerca = true;
      const nv = s[8 * k + 6]! + (s[8 * k + 7]! - s[8 * k + 6]!) * t, hondo = Math.min(AGUA.maxima, RIO.hondo.base + RIO.hondo.porMedio * medio) * MPU;
      // la pendiente del cauce donde llega a la orilla; la orilla sale del agua con la misma, para que el suelo corte la lámina justo en el
      // borde (\`medio\`) y no en la muestra de fuera: la orilla sale lisa y no en escalones de la rejilla
      const pendiente = (2 * hondo) / medio;
      if (d < medio) {
        // el cauce: de la orilla (a ras de la lámina) a lo hondo en medio
        suelo = Math.min(suelo, h, nv - hondo * (1 - (d / medio) ** 2));
        if (!(nv >= nivel)) { nivel = nv; const l = Math.sqrt(l2); cx = dx / l; cy = dy / l; }
      } else {
        // la orilla: de la lámina, subiendo con esa pendiente, al relieve (o hasta `seco` sobre el agua, si el relieve queda más bajo: el agua
        // no se sale)
        if (d < medio + orilla) suelo = Math.min(suelo, Math.max(nv + Math.min(seco, pendiente * (d - medio)), nv + pendiente * (d - medio) + (h - nv - pendiente * (d - medio)) * suave((d - medio) / orilla)));
        mojado = Math.max(mojado, 1 - suave((d - medio) / RIO.mojado));
      }
    }
    if (!cerca) return null;
    return { suelo: suelo === Infinity ? h : suelo, nivel, mojado: Number.isNaN(nivel) ? mojado : 1, cx, cy };
  }

  /** Lo más cercano de la curva de un río a `v`: el punto, el rumbo, el medio ancho y el nivel (m). */
  junto(rio: RioZona, v: Punto): { x: number; y: number; rx: number; ry: number; medio: number; nivel: number } | null {
    const c = this.curvas.find((q) => q.rio === rio);
    if (!c || c.puntos.length < 2) return null;
    let mejor = { d: Infinity, x: v.x, y: v.y, rx: 1, ry: 0, medio: 0, nivel: 0 };
    for (let i = 0; i + 1 < c.puntos.length; i++) {
      const a = c.puntos[i]!, b = c.puntos[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((v.x - a.x) * dx + (v.y - a.y) * dy) / l2)), x = a.x + dx * t, y = a.y + dy * t, d = Math.hypot(x - v.x, y - v.y);
      if (d < mejor.d) { const l = Math.sqrt(l2); mejor = { d, x, y, rx: dx / l, ry: dy / l, medio: a.medio + (b.medio - a.medio) * t, nivel: a.nivel + (b.nivel - a.nivel) * t }; }
    }
    return mejor;
  }
}
