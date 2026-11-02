// Las murallas de la plaza: cada celda del recinto (en el orden de su anillo) lleva su tramo, que va de su centro hacia las celdas de antes y de
// después; así el muro no sale de sus celdas (entre dos celdas en diagonal, los tramos se juntan en la esquina que comparten).
//   Nivel 1: empalizada de estacas sobre un talud de tierra, con su foso por fuera; torres de vigía de madera; puerta con su dintel.
//   Nivel 2: zócalo de piedra y muro de adobe con almenas; torres en bastión semicircular (Los Millares) con su garita; puerta entre torres.
//   Nivel 3: muro ciclópeo de bloques grandes con adarve y almenas; torres cuadradas macizas; la puerta de los leones (Micenas).
// Lo comprometido y aún no levantado: la zanja marcada con estacas. Con una mejora en obra, las celdas ya mejoradas van con el nivel nuevo.
import { COLOR } from './config';
import { hash3, type CeldaDeMuro, type RecintoEnVista } from './estado';
import { mezclar, type Piezas } from './piezas';

type V = { x: number; y: number };

/** Lo que necesita cada celda para montarse: su centro, sus medios tramos, hacia dónde mira el tramo (`t`) y hacia fuera (`n`). */
interface Tramo {
  c: CeldaDeMuro;
  /** Los extremos de sus medios tramos (hacia la celda anterior y la siguiente). */
  hacia: V[];
  /** Por cada medio tramo, si va hacia otra celda de puerta (el paso sigue: ni estacas ni muro). */
  aPuerta: boolean[];
  /** Las celdas de antes y de después en el anillo. */
  ant?: CeldaDeMuro;
  sig?: CeldaDeMuro;
  t: V;
  n: V;
  k: number;
}

function tramos(r: RecintoEnVista): Tramo[] {
  const N = r.celdas.length;
  return r.celdas.map((c, i) => {
    const ant = i > 0 ? r.celdas[i - 1] : r.cerrado ? r.celdas[N - 1] : undefined;
    const sig = i < N - 1 ? r.celdas[i + 1] : r.cerrado ? r.celdas[0] : undefined;
    const hacia: V[] = [], aPuerta: boolean[] = [];
    for (const o of [ant, sig]) if (o) { hacia.push({ x: (c.x + o.x) / 2, y: (c.y + o.y) / 2 }); aPuerta.push(c.clase === 'puerta' && o.clase === 'puerta'); }
    const a = ant ?? c, b = sig ?? c;
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    if (!ant && !sig) { tx = 1; ty = 0; }
    // hacia fuera: la perpendicular que se aleja del centro de la plaza
    let nx = ty, ny = -tx;
    if (nx * c.x + ny * c.y < 0) { nx = -nx; ny = -ny; }
    return { c, hacia, aPuerta, ant, sig, t: { x: tx, y: ty }, n: { x: nx, y: ny }, k: i };
  });
}

/** Una caja a lo largo de un medio tramo, desplazada `d` hacia fuera. */
function aLoLargo(p: Piezas, color: number, tr: Tramo, h: V, grueso: number, alto: number, y = 0, d = 0, alarga = 0, desde = 0): void {
  const lh = Math.hypot(h.x - tr.c.x, h.y - tr.c.y) || 1, f = Math.min(1, desde / lh);
  const x0 = tr.c.x + (h.x - tr.c.x) * f + tr.n.x * d, z0 = tr.c.y + (h.y - tr.c.y) * f + tr.n.y * d, x1 = h.x + tr.n.x * d, z1 = h.y + tr.n.y * d;
  const l = Math.hypot(x1 - x0, z1 - z0) + alarga;
  if (l < 0.05) return;
  const g = Math.atan2(z1 - z0, x1 - x0);
  p.caja(color, x0 + (Math.cos(g) * l) / 2, z0 + (Math.sin(g) * l) / 2, l, grueso, alto, g, y);
}

/** Puntos repartidos a lo largo de un medio tramo (sin el centro), desplazados `d` hacia fuera. */
function puntos(tr: Tramo, h: V, paso: number, d: number): V[] {
  const dx = h.x - tr.c.x, dy = h.y - tr.c.y, l = Math.hypot(dx, dy), n = Math.max(1, Math.round(l / paso)), r: V[] = [];
  for (let i = 1; i <= n; i++) r.push({ x: tr.c.x + (dx * i) / n + tr.n.x * d, y: tr.c.y + (dy * i) / n + tr.n.y * d });
  return r;
}

const giroDe = (v: V): number => Math.atan2(v.y, v.x);

// ───────────────────────────── Nivel 1: empalizada ─────────────────────────────

/** Las celdas de puerta seguidas que empiezan en la `i` (si antes no hay otra de puerta): el paso que comparten, que lleva una sola puerta. */
function pasoDesde(ts: readonly Tramo[], i: number): Tramo[] | null {
  const tr = ts[i]!;
  if (tr.c.clase !== 'puerta' || tr.ant?.clase === 'puerta') return null;
  const paso = [tr];
  for (let j = i; paso[paso.length - 1]!.sig?.clase === 'puerta' && paso.length < ts.length; ) {
    j = (j + 1) % ts.length;
    paso.push(ts[j]!);
  }
  return paso;
}

function empalizada(p: Piezas, tr: Tramo, paso: Tramo[] | null): void {
  const { c } = tr, puerta = c.clase === 'puerta';
  // el talud y el foso
  p.caja(COLOR.talud, c.x, c.y, 1.5, 1.5, 0.42, giroDe(tr.t));
  for (const h of tr.hacia) {
    aLoLargo(p, COLOR.talud, tr, h, 1.5, 0.42);
    aLoLargo(p, COLOR.foso, tr, h, 0.55, 0.03, 0, 1.15, 0.3);
  }
  // las estacas, sobre el talud, un poco hacia fuera; en la puerta, el paso queda libre
  const est = (q: V, k: number): void => {
    if (puerta && Math.hypot(q.x - c.x, q.y - c.y) < 0.75) return;
    p.poste(mezclar(COLOR.madera, COLOR.maderaOscura, hash3(Math.round(q.x * 10), Math.round(q.y * 10), 5)), q.x, q.y, 1.55 + 0.35 * hash3(Math.round(q.x * 10), Math.round(q.y * 10), k), 0.17, 0.38);
  };
  if (!puerta) est({ x: c.x + tr.n.x * 0.3, y: c.y + tr.n.y * 0.3 }, 1);
  tr.hacia.forEach((h, j) => { if (!tr.aPuerta[j]) puntos(tr, h, 0.22, 0.3).forEach((q, k) => est(q, k + 2)); });
  if (c.clase === 'torre') torreDeMadera(p, c.x - tr.n.x * 0.1, c.y - tr.n.y * 0.1, 1.2, 3.0, giroDe(tr.t));
  if (paso) {
    // una sola puerta para todo el paso (dos celdas de puerta seguidas son una puerta ancha): un poste a cada lado, las hojas, el dintel
    // de lado a lado y su tejadillo
    const a = paso[0]!.c, b = paso[paso.length - 1]!.c, l = Math.hypot(b.x - a.x, b.y - a.y);
    const t = l > 0.01 ? { x: (b.x - a.x) / l, y: (b.y - a.y) / l } : tr.t, n = tr.n, g = giroDe(t), ancho = l + 1.6;
    const mx = (a.x + b.x) / 2 + n.x * 0.3, mz = (a.y + b.y) / 2 + n.y * 0.3;
    const hoja = ancho / 2 - 0.1;
    for (const s of [-1, 1]) {
      const x = mx + (t.x * s * ancho) / 2, z = mz + (t.y * s * ancho) / 2;
      p.poste(COLOR.maderaOscura, x, z, 2.6, 0.26, 0.3);
      // las hojas, colgadas de su poste y abiertas hacia dentro
      p.caja(COLOR.madera, x - (n.x * hoja) / 2, z - (n.y * hoja) / 2, 0.08, hoja, 1.6, g, 0.42);
    }
    p.caja(COLOR.maderaOscura, mx, mz, ancho + 0.1, 0.3, 0.22, g, 2.6);
    p.forma('aguas', COLOR.paja, mx, mz, ancho + 0.3, 0.8, 0.5, g, 2.82);
  }
}

/** Una torre de vigía de madera: cuatro postes, la plataforma con su baranda y el tejadillo de paja. */
function torreDeMadera(p: Piezas, x: number, z: number, lado: number, alto: number, giro: number, y = 0): void {
  const c = Math.cos(giro), s = Math.sin(giro), m = lado / 2 - 0.06;
  const en = (a: number, b: number): [number, number] => [x + a * c - b * s, z + a * s + b * c];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const [px, pz] = en(a * m, b * m);
    p.poste(COLOR.madera, px, pz, alto, 0.12, y);
  }
  p.caja(COLOR.madera, x, z, lado + 0.1, lado + 0.1, 0.1, giro, y + alto * 0.78);
  for (const [a0, b0, a1, b1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
    const [x0, z0] = en(a0 * m, b0 * m), [x1, z1] = en(a1 * m, b1 * m);
    p.viga(COLOR.madera, x0, z0, x1, z1, y + alto * 0.78 + 0.45, 0.05);
  }
  p.forma('cuatroAguas', COLOR.paja, x, z, lado + 0.4, lado + 0.4, 0.75, giro, y + alto);
}

// ───────────────────────────── Nivel 2: piedra y adobe ─────────────────────────────

function piedraYAdobe(p: Piezas, tr: Tramo): void {
  const { c } = tr, g = giroDe(tr.t), adobe = mezclar(COLOR.adobe, COLOR.barro, 0.25);
  const H0 = 0.7, H = 2.2, paso = c.clase === 'puerta' ? 0.5 : 0;
  if (!paso) {
    p.caja(COLOR.piedra, c.x, c.y, 1.3, 1.3, H0, g);
    p.caja(adobe, c.x, c.y, 1.1, 1.1, H - H0, g, H0);
  }
  for (const h of tr.hacia) {
    aLoLargo(p, COLOR.piedra, tr, h, 1.3, H0, 0, 0, 0, paso);
    aLoLargo(p, adobe, tr, h, 1.1, H - H0, H0, 0, 0, paso);
    // almenas en el borde de fuera
    for (const q of puntos(tr, h, 0.5, 0.42)) p.caja(adobe, q.x, q.y, 0.28, 0.24, 0.3, g, H);
  }
  if (c.clase === 'torre') {
    // bastión semicircular hacia fuera, con su garita de madera
    p.forma('media', COLOR.piedra, c.x + tr.n.x * 0.4, c.y + tr.n.y * 0.4, 2.1, 2.1, 1.0, giroDe(tr.n));
    p.forma('media', adobe, c.x + tr.n.x * 0.4, c.y + tr.n.y * 0.4, 1.9, 1.9, 1.8, giroDe(tr.n), 1.0);
    p.caja(adobe, c.x, c.y, 1.2, 1.2, 0.6, g, H);
    torreDeMadera(p, c.x, c.y, 1.0, 1.1, g, H + 0.6);
  }
  if (c.clase === 'puerta') {
    // el paso por el medio: dos torres cuadradas a los lados y el dintel
    for (const s of [-1, 1]) p.caja(COLOR.piedra, c.x + tr.t.x * s * 0.95, c.y + tr.t.y * s * 0.95, 1.0, 1.5, 3.0, g);
    p.caja(COLOR.maderaOscura, c.x, c.y, 1.0, 1.3, 0.3, g, 2.0);
    p.caja(COLOR.madera, c.x - tr.n.x * 0.5, c.y - tr.n.y * 0.5, 0.9, 0.08, 1.9, g, 0);
  }
}

// ───────────────────────────── Nivel 3: ciclópea ─────────────────────────────

function ciclopea(p: Piezas, tr: Tramo): void {
  const { c } = tr, g = giroDe(tr.t), H = 3.0, puerta = c.clase === 'puerta';
  const color = (k: number): number => mezclar(COLOR.piedra, COLOR.piedraOscura, 0.15 + 0.5 * hash3(Math.round(c.x * 7), Math.round(c.y * 7), k));
  if (!puerta) p.caja(color(0), c.x, c.y, 2.0, 2.0, H, g);
  tr.hacia.forEach((h, j) => {
    // tres hiladas de dos bloques, cada uno algo distinto (de grueso y de color): se lee como piedra grande
    const dx = h.x - c.x, dy = h.y - c.y, l = Math.hypot(dx, dy), t00 = puerta ? Math.min(0.9, 0.5 / (l || 1)) : 0;
    for (let hil = 0; hil < 3; hil++) for (let b = 0; b < 2; b++) {
      const t0 = Math.max(t00, (b + (hil % 2) * 0.5) / 2), t1 = Math.min(1, (b + (hil % 2) * 0.5) / 2 + 0.5);
      if (t1 <= t0) continue;
      const k = j * 10 + hil * 3 + b, ex = 0.04 * hash3(Math.round(c.x * 3), Math.round(c.y * 3), k + 40);
      const x = c.x + dx * ((t0 + t1) / 2), z = c.y + dy * ((t0 + t1) / 2);
      p.caja(color(k + 1), x, z, l * (t1 - t0) + 0.02, 2.0 + ex, H / 3, Math.atan2(dy, dx), hil * (H / 3));
    }
    // el adarve: pretil y almenas por fuera
    aLoLargo(p, color(9), tr, h, 0.3, 0.5, H, 0.85);
    for (const q of puntos(tr, h, 0.55, 0.85)) p.caja(color(11), q.x, q.y, 0.3, 0.3, 0.35, g, H + 0.5);
  });
  if (c.clase === 'torre') {
    const x = c.x + tr.n.x * 0.2, z = c.y + tr.n.y * 0.2;
    p.caja(color(20), x, z, 2.6, 2.6, 4.0, g);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      p.caja(color(21), x + (a * Math.cos(g) - b * Math.sin(g)) * 1.15, z + (a * Math.sin(g) + b * Math.cos(g)) * 1.15, 0.36, 0.36, 0.45, g, 4.0);
    }
  }
  if (c.clase === 'puerta') {
    // la puerta de los leones: dos jambas, el dintel enorme y el triángulo de descarga encima
    const gn = giroDe(tr.n);
    for (const s of [-1, 1]) p.caja(color(30 + s), c.x + tr.t.x * s * 0.95, c.y + tr.t.y * s * 0.95, 2.2, 1.0, 3.2, gn);
    p.caja(COLOR.piedraClara, c.x, c.y, 2.0, 2.2, 0.55, g, 2.6);
    p.forma('aguas', COLOR.piedraOscura, c.x + tr.n.x * 0.95, c.y + tr.n.y * 0.95, 0.2, 1.4, 0.8, gn, 3.15);
  }
}

// ───────────────────────────── Lo planificado y las mejoras ─────────────────────────────

/** Una celda comprometida y aún sin levantar: la zanja marcada y estacas con cuerda. */
function zanja(p: Piezas, tr: Tramo): void {
  const { c } = tr;
  for (const h of tr.hacia) aLoLargo(p, COLOR.tierraOscura, tr, h, 1.0, 0.03, 0, 0, 0.5);
  p.caja(COLOR.tierraOscura, c.x, c.y, 1.0, 1.0, 0.03, giroDe(tr.t));
  for (const s of [-1, 1]) p.poste(COLOR.estaca, c.x + tr.n.x * s * 0.6, c.y + tr.n.y * s * 0.6, 0.55, 0.07);
  if (hash3(Math.round(c.x), Math.round(c.y), 3) < 0.15) for (let k = 0; k < 3; k++) p.caja(COLOR.piedra, c.x - tr.n.x * 1.0 + k * 0.3 * tr.t.x, c.y - tr.n.y * 1.0 + k * 0.3 * tr.t.y, 0.35, 0.3, 0.28, giroDe(tr.t) + k);
}

/** Andamios en la celda donde va la mejora. */
function andamioDeMuro(p: Piezas, tr: Tramo, alto: number): void {
  const { c } = tr;
  for (const s of [-1, 1]) for (const d of [-1.05, 1.05]) p.poste(COLOR.estaca, c.x + tr.t.x * s * 0.7 + tr.n.x * d, c.y + tr.t.y * s * 0.7 + tr.n.y * d, alto + 0.6, 0.07);
  for (const d of [-1.05, 1.05]) {
    const x0 = c.x - tr.t.x * 0.7 + tr.n.x * d, z0 = c.y - tr.t.y * 0.7 + tr.n.y * d, x1 = c.x + tr.t.x * 0.7 + tr.n.x * d, z1 = c.y + tr.t.y * 0.7 + tr.n.y * d;
    p.viga(COLOR.estaca, x0, z0, x1, z1, alto * 0.5, 0.06);
    p.viga(COLOR.estaca, x0, z0, x1, z1, alto + 0.3, 0.06);
  }
}

const ALTO_NIVEL = [0, 2.0, 2.5, 3.5];

/** Monta todos los recintos de la plaza en `p`. */
export function montarMurallas(p: Piezas, recintos: readonly RecintoEnVista[]): void {
  for (const r of recintos) {
    const ts = tramos(r);
    for (const tr of ts) {
      if (!tr.c.enPie) { zanja(p, tr); continue; }
      const n = Math.max(1, Math.min(3, tr.c.nivel));
      if (n === 1) empalizada(p, tr, pasoDesde(ts, tr.k));
      else if (n === 2) piedraYAdobe(p, tr);
      else ciclopea(p, tr);
    }
    // la mejora en obra: andamios en la primera celda que aún no es del nivel nuevo
    if (r.mejorandoA !== undefined) {
      const tr = ts.find((t) => t.c.enPie && t.c.nivel !== r.mejorandoA);
      if (tr) andamioDeMuro(p, tr, ALTO_NIVEL[Math.min(3, r.mejorandoA)]!);
    }
  }
}
