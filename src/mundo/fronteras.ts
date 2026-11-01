// Las zonas de influencia de una misma Facción se pintan FUSIONADAS (Víctor, 2026-11-01): una sola frontera por fuera y, donde chocan o se
// solapan dos plazas suyas, solo una línea tenue que separa las provincias del mismo reino. El servidor manda la silueta de cada plaza
// (recortada contra sus vecinas) y aquí se parte cada contorno en tramos: EXTERIOR (lejos de toda zona hermana: la frontera), INTERIOR
// (sobre el borde de una hermana: la separación entre provincias, que se da una sola vez aunque la traigan los dos contornos) y lo que cae
// DENTRO de una hermana, que no se pinta. Lo usan el mundo 3D (`mundo3d/estado.ts`) y el modo mapa (`render.ts`).

type Punto = { x: number; y: number };

export interface ZonaDeFaccion { faccionId: string; contorno: readonly Punto[] }
export interface TramoDeFrontera { zona: number; tipo: 'exterior' | 'interior'; puntos: Punto[] }

/** Lo que se tienen que acercar dos bordes, en u, para contar como el mismo (la silueta del servidor y su redondeo). */
const TOLERANCIA = 0.35;
/** Cada cuánto se mira un lado, en u: un lado puede ser en parte frontera y en parte borde con una hermana. */
const PASO = 0.5;

interface Caja { x0: number; y0: number; x1: number; y1: number }
const cajaDe = (c: readonly Punto[]): Caja => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of c) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
};
const tocan = (a: Caja, b: Caja): boolean => a.x0 <= b.x1 + TOLERANCIA && b.x0 <= a.x1 + TOLERANCIA && a.y0 <= b.y1 + TOLERANCIA && b.y0 <= a.y1 + TOLERANCIA;

function dentro(c: readonly Punto[], p: Punto): boolean {
  let si = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!, b = c[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) si = !si;
  }
  return si;
}

function distanciaAlBorde(c: readonly Punto[], p: Punto): number {
  let d = Infinity;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[j]!, b = c[i]!, dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
    d = Math.min(d, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return d;
}

/** Quita el último punto si repite el primero (contorno cerrado a mano). */
const abierto = (c: readonly Punto[]): readonly Punto[] => (c.length > 1 && c[0]!.x === c[c.length - 1]!.x && c[0]!.y === c[c.length - 1]!.y ? c.slice(0, -1) : c);

/** Parte los contornos de `zonas` en tramos exteriores e interiores (ver arriba). Una zona sin hermanas que la toquen sale entera, cerrada. */
export function partirFronteras(zonas: readonly ZonaDeFaccion[]): TramoDeFrontera[] {
  const contornos = zonas.map((z) => abierto(z.contorno));
  const cajas = contornos.map(cajaDe);
  const out: TramoDeFrontera[] = [];
  contornos.forEach((c, i) => {
    if (c.length < 3) return;
    const hermanas = contornos.map((_, j) => j).filter((j) => j !== i && zonas[j]!.faccionId === zonas[i]!.faccionId && contornos[j]!.length >= 3 && tocan(cajas[i]!, cajas[j]!));
    if (hermanas.length === 0) { out.push({ zona: i, tipo: 'exterior', puntos: [...c, c[0]!] }); return; }
    // cada trocito de lado, clasificado por su punto medio
    type Clase = 'exterior' | 'interior' | 'oculto';
    const tramos: { clase: Clase; puntos: Punto[] }[] = [];
    // el interior queda a la izquierda del sentido de los puntos si el contorno va antihorario
    let area = 0;
    for (let k = 0; k < c.length; k++) { const p = c[k]!, q = c[(k + 1) % c.length]!; area += p.x * q.y - q.x * p.y; }
    const sentido = area >= 0 ? 1 : -1;
    for (let k = 0; k < c.length; k++) {
      const a = c[k]!, b = c[(k + 1) % c.length]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / PASO));
      for (let s = 0; s < n; s++) {
        const p0 = { x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n };
        const p1 = { x: a.x + ((b.x - a.x) * (s + 1)) / n, y: a.y + ((b.y - a.y) * (s + 1)) / n };
        const m = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        let clase: Clase = 'exterior';
        for (const j of hermanas) {
          const c2 = contornos[j]!;
          // sobre el borde de la hermana el trocito entero (no solo su medio: junto a una esquina, el lado de fuera roza su borde)
          if ([p0, m, p1].every((q) => distanciaAlBorde(c2, q) <= TOLERANCIA)) {
            // sobre su borde: si las dos quedan del mismo lado es frontera de las dos (y la da una); si no, el borde entre provincias. En
            // ambos casos lo pinta solo la zona de índice menor.
            const l = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1, f = (sentido * 2 * TOLERANCIA) / l;
            const haciaDentro = { x: m.x - (p1.y - p0.y) * f, y: m.y + (p1.x - p0.x) * f };
            clase = i > j ? 'oculto' : dentro(c2, haciaDentro) ? 'exterior' : 'interior';
            break;
          }
          if (dentro(c2, m)) { clase = 'oculto'; break; }
        }
        const ultimo = tramos[tramos.length - 1];
        if (ultimo && ultimo.clase === clase) ultimo.puntos.push(p1);
        else tramos.push({ clase, puntos: [p0, p1] });
      }
    }
    // el contorno es cerrado: si acaba como empezó, el último tramo sigue en el primero
    if (tramos.length > 1 && tramos[0]!.clase === tramos[tramos.length - 1]!.clase) {
      const ultimo = tramos.pop()!;
      tramos[0]!.puntos = [...ultimo.puntos, ...tramos[0]!.puntos.slice(1)];
    }
    for (const t of tramos) if (t.clase !== 'oculto' && t.puntos.length >= 2) out.push({ zona: i, tipo: t.clase, puntos: t.puntos });
  });
  return out;
}
