// Las murallas de la plaza: cada celda del recinto lleva su tramo, que va de su centro hacia sus vecinas de la rejilla (las de lado y, en
// diagonal, las que no une ya una de lado); así el muro no sale de sus celdas (entre dos celdas en diagonal, los tramos se juntan en la esquina
// que comparten) y se ve lo mismo que en el 2D, venga la lista en el orden que venga. Antes iba hacia la celda de antes y la de después de la
// lista: en un anillo grueso (un codo con una celda de más, una celda que sobresale junto a la puerta) la vista caía al orden de obra del motor,
// que deja esas celdas para el final, y salía un muro de punta a punta por encima de los edificios (Víctor, 2026-11-10).
//   Nivel 1: empalizada de estacas sobre un talud de tierra, con su foso por fuera; torres de vigía de madera; puerta con sus hojas, entre dos
//            torres de madera unidas por una pasarela.
//   Nivel 2: zócalo de piedra y muro de adobe con almenas; torres en bastión semicircular (Los Millares) con su garita; puerta entre dos torres
//            cuadradas que salen del muro, con el muro corrido por encima del paso.
//   Nivel 3: muro ciclópeo de bloques grandes con adarve y almenas; torres cuadradas macizas; la puerta de los leones (Micenas) entre dos torres.
// Las torres de la puerta (Víctor, 2026-11-03: «puertas de muralla de verdad, con una torre a cada lado, incluso en la empalizada») van en las
// celdas de muro de cada lado del paso: el motor no cambia y nada sale de sus celdas.
// Lo comprometido y aún no levantado: la zanja marcada con estacas. Con una mejora en obra, las celdas ya mejoradas van con el nivel nuevo.
// La puerta resalta del muro (Víctor, 2026-11-08: «en la maqueta la puerta casi no se distingue del resto del muro»): en los tres niveles, las
// hojas entreabiertas hacia dentro (con bandas de bronce en la piedra), pendones rojos en las torres de la puerta y fuego a los lados del paso;
// en la empalizada, además, el puente de tablas sobre el foso y el bucráneo en el dintel; en la de adobe, el umbral enlosado y el marco
// enlucido con el dintel pintado de rojo; en la ciclópea, las jambas y el dintel de piedra clara y el relieve de los leones en el triángulo.
import { COLOR } from './config';
import { hash3, type CeldaDeMuro, type RecintoEnVista } from './estado';
import { mezclar, type Piezas } from './piezas';

type V = { x: number; y: number };

/** Lo que necesita cada celda para montarse: su centro, sus medios tramos, hacia dónde mira el tramo (`t`) y hacia fuera (`n`). */
interface Tramo {
  c: CeldaDeMuro;
  /** Los extremos de sus medios tramos (hacia cada vecina). */
  hacia: V[];
  /** Por cada medio tramo, si va hacia otra celda de puerta (el paso sigue: ni estacas ni muro). */
  aPuerta: boolean[];
  /** Sus vecinas (su puesto en la lista del recinto). */
  vecinas: number[];
  t: V;
  n: V;
  k: number;
}

const LADOS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const DIAGONALES = [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const;

/** El lado de una celda: el del recinto o, si no lo trae, el menor paso entre dos celdas. */
function ladoDe(r: RecintoEnVista): number {
  if (r.lado) return r.lado;
  let l = Infinity;
  for (const a of r.celdas) for (const b of r.celdas) {
    const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    if (d > 1e-6 && d < l) l = d;
  }
  return Number.isFinite(l) ? l : 3;
}

/**
 * Las vecinas de cada celda del muro en la rejilla (su puesto en `celdas`): las de lado y, en diagonal, solo las que no une ya una celda de lado
 * de las dos (en un codo el muro dobla por la celda del codo; en una escalera en diagonal, va de esquina a esquina). Nunca una celda que no está
 * al lado, sea cual sea el orden de la lista.
 */
export function vecinasDeMuro(celdas: readonly { x: number; y: number }[], lado: number): number[][] {
  const clave = (c: number, f: number): string => `${c},${f}`;
  const sitio = celdas.map((k) => [Math.round(k.x / lado - 0.5), Math.round(k.y / lado - 0.5)] as const);
  const indice = new Map(sitio.map(([c, f], i) => [clave(c, f), i]));
  return sitio.map(([c, f], i) => {
    const v: number[] = [];
    for (const [dc, df] of LADOS) {
      const j = indice.get(clave(c + dc, f + df));
      if (j !== undefined && j !== i) v.push(j);
    }
    for (const [dc, df] of DIAGONALES) {
      const j = indice.get(clave(c + dc, f + df));
      if (j === undefined || j === i || indice.has(clave(c + dc, f)) || indice.has(clave(c, f + df))) continue;
      v.push(j);
    }
    return v;
  });
}

const lejos = (a: V, b: V): number => Math.hypot(a.x - b.x, a.y - b.y);

function tramos(r: RecintoEnVista): Tramo[] {
  const vecinas = vecinasDeMuro(r.celdas, ladoDe(r));
  return r.celdas.map((c, i) => {
    const vs = vecinas[i]!;
    const hacia = vs.map((j) => ({ x: (c.x + r.celdas[j]!.x) / 2, y: (c.y + r.celdas[j]!.y) / 2 }));
    const aPuerta = vs.map((j) => c.clase === 'puerta' && r.celdas[j]!.clase === 'puerta');
    // por dónde va el muro: entre las dos vecinas más opuestas (con dos, esas; con una, hacia ella)
    let a: CeldaDeMuro = c, b: CeldaDeMuro = c;
    if (vs.length === 1) b = r.celdas[vs[0]!]!;
    for (const x of vs) for (const y of vs) {
      const p = r.celdas[x]!, q = r.celdas[y]!;
      if (x < y && lejos(p, q) > lejos(a, b)) { a = p; b = q; }
    }
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    if (vs.length === 0) { tx = 1; ty = 0; }
    // hacia fuera: la perpendicular que se aleja del centro de la plaza
    let nx = ty, ny = -tx;
    if (nx * c.x + ny * c.y < 0) { nx = -nx; ny = -ny; }
    return { c, hacia, aPuerta, vecinas: vs, t: { x: tx, y: ty }, n: { x: nx, y: ny }, k: i };
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

// ───────────────────────────── Lo que hace resaltar la puerta ─────────────────────────────

/**
 * Una hoja de la puerta entreabierta hacia dentro: colgada en `bisagra`, cerrada iría hacia −`s`·`t` (el medio del paso) y se abre 60° hacia
 * dentro (−`n`). De tablas, con `bandas` bandas cruzadas de `banda` (de bronce en la piedra).
 */
function hoja(p: Piezas, bisagra: V, t: V, n: V, s: number, largo: number, alto: number, y: number, color: number, banda: number, bandas: number): void {
  const c = Math.cos(Math.PI / 3), si = Math.sin(Math.PI / 3);
  const dx = -t.x * s * c - n.x * si, dy = -t.y * s * c - n.y * si, g = Math.atan2(dy, dx);
  const x = bisagra.x + (dx * largo) / 2, z = bisagra.y + (dy * largo) / 2;
  p.caja(color, x, z, largo, 0.09, alto, g, y);
  for (let k = 0; k < bandas; k++) p.caja(banda, x, z, largo + 0.01, 0.12, 0.08, g, y + (alto * (k + 0.5)) / bandas - 0.04);
}

/** Un pendón rojo con su franja ocre, colgado de su vara contra la cara de fuera: centrado en `q`, de `ancho` a lo largo de `g`, de `y0` a `y1`. */
function pendon(p: Piezas, q: V, g: number, ancho: number, y0: number, y1: number): void {
  p.caja(COLOR.rojo, q.x, q.y, ancho, 0.04, y1 - y0, g, y0);
  p.caja(COLOR.ocre, q.x, q.y, ancho + 0.02, 0.06, 0.14, g, y0 + 0.14);
  p.caja(COLOR.maderaOscura, q.x, q.y, ancho + 0.18, 0.07, 0.07, g, y1);
}

/** Un brasero de bronce encendido, de pie a un lado del paso. */
function brasero(p: Piezas, x: number, z: number, alto = 0.75): void {
  p.poste(COLOR.bronce, x, z, alto, 0.07);
  p.forma('cupula', COLOR.bronce, x, z, 0.34, 0.34, 0.12, 0, alto);
  p.forma('cono', COLOR.fuego, x, z, 0.2, 0.2, 0.28, 0, alto + 0.05);
}

/** Una antorcha en su soporte, contra un poste (en `q`) y hacia fuera (`n`), a la altura `y`. */
function antorcha(p: Piezas, q: V, n: V, y: number): void {
  const x = q.x + n.x * 0.2, z = q.y + n.y * 0.2;
  p.caja(COLOR.maderaOscura, (q.x + x) / 2, (q.y + z) / 2, 0.24, 0.06, 0.06, giroDe(n), y);
  p.poste(COLOR.maderaOscura, x, z, 0.32, 0.06, y);
  p.forma('cono', COLOR.fuego, x, z, 0.16, 0.16, 0.26, 0, y + 0.3);
}

// ───────────────────────────── Nivel 1: empalizada ─────────────────────────────

/** Un paso de puerta: sus celdas en fila (dos de puerta que se tocan son una puerta ancha) y la celda de muro que lo flanquea por cada lado. */
interface Paso { celdas: Tramo[]; flancos: [Tramo | undefined, Tramo | undefined] }

/**
 * Los pasos de las puertas del recinto: cada grupo de celdas de puerta que se tocan, en fila de una punta a la otra, con la celda de muro que
 * lo flanquea por cada lado (la vecina que más se aparta del paso a lo largo de él): llevan las torres de la puerta. Solo vecinas de verdad.
 */
function pasosDePuerta(ts: readonly Tramo[]): Paso[] {
  const visto = new Set<number>(), pasos: Paso[] = [];
  for (const tr of ts) {
    if (tr.c.clase !== 'puerta' || visto.has(tr.k)) continue;
    const grupo: Tramo[] = [], pila = [tr.k];
    visto.add(tr.k);
    while (pila.length) {
      const i = pila.pop()!;
      grupo.push(ts[i]!);
      for (const j of ts[i]!.vecinas) if (!visto.has(j) && ts[j]!.c.clase === 'puerta') { visto.add(j); pila.push(j); }
    }
    // el eje del paso: de una punta a la otra del grupo; con una sola celda, el del muro
    let a = grupo[0]!, b = grupo[0]!;
    for (const x of grupo) for (const y of grupo) if (lejos(x.c, y.c) > lejos(a.c, b.c)) { a = x; b = y; }
    const l = lejos(a.c, b.c), t = l > 1e-6 ? { x: (b.c.x - a.c.x) / l, y: (b.c.y - a.c.y) / l } : a.t;
    const sobreElEje = (x: Tramo, desde: Tramo): number => (x.c.x - desde.c.x) * t.x + (x.c.y - desde.c.y) * t.y;
    grupo.sort((x, y) => sobreElEje(x, a) - sobreElEje(y, a));
    const flanco = (g: Tramo, s: number): Tramo | undefined => {
      let mejor: Tramo | undefined, m = 1e-6;
      for (const j of g.vecinas) {
        const x = ts[j]!;
        if (x.c.clase === 'puerta') continue;
        const d = s * sobreElEje(x, g);
        if (d > m) { m = d; mejor = x; }
      }
      return mejor;
    };
    pasos.push({ celdas: grupo, flancos: [flanco(grupo[0]!, -1), flanco(grupo[grupo.length - 1]!, 1)] });
  }
  return pasos;
}

/**
 * Los ejes de la torre de una puerta: los de la celda (no los del tramo), con `n` hacia fuera. Así, en una esquina del anillo, donde el tramo va
 * en diagonal, la torre no sale de su celda.
 */
function ejesDeTorre(tr: Tramo): { g: number; n: V } {
  const g = Math.round(giroDe(tr.t) / (Math.PI / 2)) * (Math.PI / 2);
  const n = { x: -Math.sin(g), y: Math.cos(g) };
  return { g, n: n.x * tr.n.x + n.y * tr.n.y < 0 ? { x: -n.x, y: -n.y } : n };
}

/** El sitio de la torre de una celda que flanquea la puerta: en su centro, algo hacia fuera. */
const sitioDeTorre = (tr: Tramo, fuera: number): V => { const { n } = ejesDeTorre(tr); return { x: tr.c.x + n.x * fuera, y: tr.c.y + n.y * fuera }; };

function empalizada(p: Piezas, tr: Tramo, paso: Tramo[] | null, flancos: readonly (Tramo | undefined)[] = [], flanco = false): void {
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
  // la torre de la puerta, más alta y más ancha que las de vigía (si la celda ya era de torre, la de la puerta va en su lugar)
  if (flanco) {
    const q = sitioDeTorre(tr, 0.1), { g, n } = ejesDeTorre(tr);
    torreDeMadera(p, q.x, q.y, 1.5, ALTO_TORRE_PUERTA, g);
    // el pendón, colgado de la plataforma por fuera
    pendon(p, { x: q.x + n.x * 0.8, y: q.y + n.y * 0.8 }, g, 0.62, ALTO_TORRE_PUERTA * 0.78 - 1.25, ALTO_TORRE_PUERTA * 0.78 - 0.05);
  }
  else if (c.clase === 'torre') torreDeMadera(p, c.x - tr.n.x * 0.1, c.y - tr.n.y * 0.1, 1.2, 3.0, giroDe(tr.t));
  if (paso) {
    // una sola puerta para todo el paso (dos celdas de puerta seguidas son una puerta ancha): un poste a cada lado, las hojas, el dintel
    // de lado a lado y su tejadillo
    const a = paso[0]!.c, b = paso[paso.length - 1]!.c, l = Math.hypot(b.x - a.x, b.y - a.y);
    const t = l > 0.01 ? { x: (b.x - a.x) / l, y: (b.y - a.y) / l } : tr.t, n = tr.n, g = giroDe(t), ancho = l + 1.6;
    const mx = (a.x + b.x) / 2 + n.x * 0.3, mz = (a.y + b.y) / 2 + n.y * 0.3;
    const largo = ancho / 2 - 0.12;
    for (const s of [-1, 1]) {
      const x = mx + (t.x * s * ancho) / 2, z = mz + (t.y * s * ancho) / 2;
      p.poste(COLOR.maderaOscura, x, z, 2.6, 0.26, 0.3);
      // las hojas, colgadas de su poste y entreabiertas hacia dentro, con sus travesaños; y una antorcha en cada poste
      hoja(p, { x: x - t.x * s * 0.12, y: z - t.y * s * 0.12 }, t, n, s, largo, 1.6, 0.42, COLOR.madera, COLOR.maderaOscura, 2);
      antorcha(p, { x, y: z }, n, 1.75);
    }
    p.caja(COLOR.maderaOscura, mx, mz, ancho + 0.1, 0.3, 0.22, g, 2.6);
    // el bucráneo en el dintel, por fuera: la calavera del buey y sus cuernos
    const bx = mx + n.x * 0.2, bz = mz + n.y * 0.2;
    p.caja(COLOR.cuerno, bx, bz, 0.22, 0.1, 0.3, g, 2.36);
    p.caja(COLOR.cuerno, bx, bz, 0.66, 0.07, 0.07, g, 2.62);
    for (const s of [-1, 1]) p.caja(COLOR.cuerno, bx + t.x * s * 0.3, bz + t.y * s * 0.3, 0.07, 0.07, 0.24, g, 2.62);
    // el puente de tablas sobre el foso, delante del paso
    const fx = (a.x + b.x) / 2 + n.x * 1.15, fz = (a.y + b.y) / 2 + n.y * 1.15;
    p.caja(COLOR.madera, fx, fz, Math.max(1.3, l + 1.2), 0.95, 0.07, g, 0.02);
    for (const s of [-1, 1]) p.caja(COLOR.maderaOscura, fx + (t.x * s * Math.max(1.3, l + 1.2)) / 2, fz + (t.y * s * Math.max(1.3, l + 1.2)) / 2, 0.1, 1.0, 0.14, g, 0.02);
    const [fa, fb] = flancos;
    if (fa?.c.enPie && fb?.c.enPie) {
      // la pasarela de torre a torre, a la altura de sus plataformas, con su baranda por fuera
      const qa = sitioDeTorre(fa, 0.1), qb = sitioDeTorre(fb, 0.1), y = ALTO_TORRE_PUERTA * 0.78;
      p.viga(COLOR.madera, qa.x, qa.y, qb.x, qb.y, y, 0.9, 0.12);
      p.viga(COLOR.madera, qa.x + n.x * 0.42, qa.y + n.y * 0.42, qb.x + n.x * 0.42, qb.y + n.y * 0.42, y + 0.5, 0.06);
      const l2 = Math.hypot(qb.x - qa.x, qb.y - qa.y), np = Math.max(2, Math.round(l2 / 0.7));
      for (let i = 1; i < np; i++) {
        const x = qa.x + ((qb.x - qa.x) * i) / np + n.x * 0.42, z = qa.y + ((qb.y - qa.y) * i) / np + n.y * 0.42;
        p.poste(COLOR.madera, x, z, 0.5, 0.06, y);
      }
    } else {
      p.forma('aguas', COLOR.paja, mx, mz, ancho + 0.3, 0.8, 0.5, g, 2.82);
    }
  }
}

/** Lo alto de las torres de madera de la puerta (las de vigía, 3,0). */
const ALTO_TORRE_PUERTA = 3.6;

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

function piedraYAdobe(p: Piezas, tr: Tramo, flanco = false): void {
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
  else if (flanco) {
    // la torre de la puerta: cuadrada, sale del muro hacia fuera y lo pasa en alto, con zócalo de piedra y almenas
    const q = sitioDeTorre(tr, 0.4), { g: gt, n } = ejesDeTorre(tr), alto = 3.3;
    p.caja(COLOR.piedra, q.x, q.y, 1.9, 2.2, 1.0, gt);
    p.caja(adobe, q.x, q.y, 1.75, 2.05, alto - 1.0, gt, 1.0);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [0, -1]] as const) {
      p.caja(adobe, q.x + a * 0.75 * Math.cos(gt) - b * 0.88 * Math.sin(gt), q.y + a * 0.75 * Math.sin(gt) + b * 0.88 * Math.cos(gt), 0.3, 0.3, 0.32, gt, alto);
    }
    p.caja(COLOR.hueco, q.x + n.x * 1.03, q.y + n.y * 1.03, 0.18, 0.05, 0.4, gt, alto - 1.0);
    pendon(p, { x: q.x + n.x * 1.05, y: q.y + n.y * 1.05 }, gt, 0.75, 1.0, 2.15);
  }
  if (c.clase === 'puerta') {
    // el paso por el medio: el umbral enlosado, las jambas de piedra con su marco enlucido por fuera, el dintel pintado de rojo, las hojas
    // entreabiertas hacia dentro, un brasero a cada lado y el muro corrido por encima, con sus almenas
    p.caja(COLOR.losa, c.x, c.y, 1.5, 2.9, 0.05, g);
    for (const s of [-1, 1]) {
      p.caja(COLOR.piedra, c.x + tr.t.x * s * 1.05, c.y + tr.t.y * s * 1.05, 0.6, 1.4, 2.0, g);
      p.caja(COLOR.enlucido, c.x + tr.t.x * s * 0.85 + tr.n.x * 0.71, c.y + tr.t.y * s * 0.85 + tr.n.y * 0.71, 0.22, 0.05, 1.96, g);
      hoja(p, { x: c.x + tr.t.x * s * 0.73 - tr.n.x * 0.6, y: c.y + tr.t.y * s * 0.73 - tr.n.y * 0.6 }, tr.t, tr.n, s, 0.72, 1.8, 0.05, COLOR.madera, COLOR.bronce, 2);
      brasero(p, c.x + tr.t.x * s * 1.1 + tr.n.x * 1.12, c.y + tr.t.y * s * 1.1 + tr.n.y * 1.12);
    }
    p.caja(COLOR.maderaOscura, c.x, c.y, 2.6, 1.3, 0.3, g, 1.95);
    p.caja(COLOR.rojo, c.x + tr.n.x * 0.66, c.y + tr.n.y * 0.66, 1.92, 0.04, 0.26, g, 1.97);
    p.caja(COLOR.enlucido, c.x + tr.n.x * 0.66, c.y + tr.n.y * 0.66, 1.92, 0.05, 0.05, g, 2.23);
    p.caja(adobe, c.x, c.y, 2.6, 1.1, H + 0.2 - 2.25, g, 2.25);
    for (const k of [-1, 0, 1]) p.caja(adobe, c.x + tr.t.x * k * 0.85 + tr.n.x * 0.42, c.y + tr.t.y * k * 0.85 + tr.n.y * 0.42, 0.28, 0.24, 0.3, g, H + 0.2);
  }
}

// ───────────────────────────── Nivel 3: ciclópea ─────────────────────────────

function ciclopea(p: Piezas, tr: Tramo, flanco = false): void {
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
  if (c.clase === 'torre' || flanco) {
    // las torres de la puerta suben más que las otras: el paso queda entre dos torres altas (como el bastión de los Leones)
    const deLaPuerta = flanco && c.clase !== 'torre', alto = deLaPuerta ? 4.6 : 4.0;
    const gt = deLaPuerta ? ejesDeTorre(tr).g : g, { x, y: z } = deLaPuerta ? sitioDeTorre(tr, 0.2) : { x: c.x + tr.n.x * 0.2, y: c.y + tr.n.y * 0.2 };
    p.caja(color(20), x, z, 2.6, 2.6, alto, gt);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      p.caja(color(21), x + (a * Math.cos(gt) - b * Math.sin(gt)) * 1.15, z + (a * Math.sin(gt) + b * Math.cos(gt)) * 1.15, 0.36, 0.36, 0.45, gt, alto);
    }
    if (deLaPuerta) { const { n } = ejesDeTorre(tr); pendon(p, { x: x + n.x * 1.32, y: z + n.y * 1.32 }, gt, 0.9, 1.9, 3.75); }
  }
  if (c.clase === 'puerta') {
    // la puerta de los leones: el paso enlosado, dos jambas y el dintel enorme de piedra clara (labrada, más clara que el muro), las hojas
    // chapadas de bronce entreabiertas, un brasero a cada lado y el triángulo de descarga encima con su relieve: la columna roja entre dos leones
    const gn = giroDe(tr.n), en = (dt: number, dn: number): [number, number] => [c.x + tr.t.x * dt + tr.n.x * dn, c.y + tr.t.y * dt + tr.n.y * dn];
    p.caja(COLOR.losa, c.x, c.y, 0.95, 2.95, 0.05, g);
    for (const s of [-1, 1]) {
      const [jx, jz] = en(s * 0.95, 0), [bx, bz] = en(s * 1.0, 1.3);
      p.caja(COLOR.piedraClara, jx, jz, 2.2, 1.0, 3.2, gn);
      const [hx, hz] = en(s * 0.45, -0.35);
      hoja(p, { x: hx, y: hz }, tr.t, tr.n, s, 0.45, 2.4, 0.05, COLOR.maderaOscura, COLOR.bronce, 3);
      brasero(p, bx, bz, 0.8);
    }
    p.caja(COLOR.piedraClara, c.x, c.y, 2.3, 2.2, 0.55, g, 2.6);
    const [tx, tz] = en(0, 0.95), [kx, kz] = en(0, 1.07);
    p.forma('aguas', COLOR.rocaClara, tx, tz, 0.2, 1.4, 0.8, gn, 3.15);
    p.forma('cilindro', COLOR.rojo, kx, kz, 0.1, 0.1, 0.45, 0, 3.17);
    p.caja(COLOR.negro, kx, kz, 0.18, 0.08, 0.06, g, 3.62);
    for (const s of [-1, 1]) { const [lx, lz] = en(s * 0.24, 1.07); p.caja(COLOR.piedraOscura, lx, lz, 0.2, 0.05, 0.32, g, 3.17); }
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
    const ts = tramos(r), pasos = pasosDePuerta(ts);
    const flancos = new Set(pasos.flatMap((x) => x.flancos.flatMap((f) => (f ? [f.k] : []))));
    // la puerta de cada paso se monta con su primera celda
    const pasoDe = new Map(pasos.map((x) => [x.celdas[0]!.k, x]));
    for (const tr of ts) {
      // cada celda lleva su id (`idDeCeldaDeMuro`) para el clic en la vista
      p.de = idDeCeldaDeMuro(r.id, tr.k);
      if (!tr.c.enPie) { zanja(p, tr); continue; }
      const n = Math.max(1, Math.min(3, tr.c.nivel)), flanco = flancos.has(tr.k);
      if (n === 1) {
        const paso = pasoDe.get(tr.k);
        // los flancos del paso (para la pasarela), si son de empalizada
        empalizada(p, tr, paso?.celdas ?? null, paso ? paso.flancos.map((x) => (x && x.c.nivel <= 1 ? x : undefined)) : [], flanco);
      } else if (n === 2) piedraYAdobe(p, tr, flanco);
      else ciclopea(p, tr, flanco);
    }
    // la mejora en obra: andamios en la primera celda que aún no es del nivel nuevo
    if (r.mejorandoA !== undefined) {
      const tr = ts.filter((t) => t.c.enPie && t.c.nivel !== r.mejorandoA).sort((a, b) => (a.c.obra ?? a.k) - (b.c.obra ?? b.k))[0];
      if (tr) { p.de = idDeCeldaDeMuro(r.id, tr.k); andamioDeMuro(p, tr, ALTO_NIVEL[Math.min(3, r.mejorandoA)]!); }
    }
  }
  p.de = undefined;
}

/** El id de las piezas de una celda de muralla: su recinto y su sitio en el anillo. */
export function idDeCeldaDeMuro(recintoId: string, k: number): string {
  return `${recintoId}#${k}`;
}
