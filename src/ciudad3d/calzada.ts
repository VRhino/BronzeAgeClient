// Las calles y los caminos de la plaza, pintados celda a celda según la red (`calles.ts`). Cada celda de calle es un cuadrado sobre el suelo con
// su tesela, pintada en un lienzo según con qué se une por cada lado:
// - la banda pisada sigue la forma de la red (tramo, esquina redonda, T, X, final con su vuelta) y se ensancha en los cruces;
// - las rodadas van por donde va la calle: rectas en los tramos, en curva en las esquinas, girando en las T y cruzándose en las X;
// - las principales son más anchas y llevan rodadas; los callejones, una senda de pisadas en medio; las explanadas, tierra abierta; los caminos
//   de fuera serpentean con dos rodadas y hierba entre ellas;
// - en los cruces hay desgaste y, a veces, un charco; en las esquinas de las T y las X, guardacantones de piedra;
// - desde el nivel 4 se enlosan las principales y las explanadas (en hiladas que siguen la calle, con bordillo y un rosetón en las X); en el 5,
//   todo, y las principales llevan en medio la calzada de losas grandes de Cnosos.
// Por cada lado unido, el borde de la tesela es igual al de la vecina (anchura media de las dos, rodadas en el mismo sitio y con la intensidad
// menor de las dos): las calles se juntan sin costura. Las teselas iguales se pintan una vez (un atlas por ciudad).
import * as THREE from 'three';
import type { CeldaDeCalle, ClaseDeCalle } from './calles';
import { COLOR } from './config';
import { hash3, type CiudadEnVista } from './estado';
import type { Piezas } from './piezas';

type P2 = [number, number];

/** Los lados en el orden de los bits de `LADO`: este, sur, oeste, norte (x crece al este, y al sur, como en el lienzo). */
const D: readonly P2[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const MEDIO = (k: number): P2 => [0.5 + 0.5 * D[k]![0], 0.5 + 0.5 * D[k]![1]];

/** Anchura de la banda pisada (en celdas), rodadas y senda de pisadas de cada clase. */
const ANCHO: Record<ClaseDeCalle, number> = { principal: 0.68, callejon: 0.46, explanada: 0.9, senda: 0.36 };
const RODADA: Record<ClaseDeCalle, number> = { principal: 1, callejon: 0, explanada: 0, senda: 1 };
const PISADAS: Record<ClaseDeCalle, number> = { principal: 0, callejon: 1, explanada: 0, senda: 0 };
/** Media distancia entre las dos rodadas de un carro, en celdas. */
const VIA = 0.12;

/** Si una calle de esa clase va enlosada en una plaza de ese nivel. */
export const enlosada = (clase: ClaseDeCalle, nivel: number): boolean => clase !== 'senda' && (nivel >= 5 || (nivel >= 4 && clase !== 'callejon'));

/** Lo que decide cómo se pinta una celda. */
export interface Tesela {
  clase: ClaseDeCalle;
  /** El nivel de la plaza (las losas dependen de él). */
  nivel: number;
  /** La clase de la vecina por cada lado unido (este, sur, oeste, norte); `null`, lado sin calle. */
  lados: (ClaseDeCalle | null)[];
  /** Esquinas (sureste, suroeste, noroeste, noreste) que se llenan en una explanada: los dos lados y la diagonal son calle. */
  rincones: boolean[];
  variante: number;
}

/** La tesela de cada celda de la red y las distintas que hay. */
export function teselasDe(red: readonly CeldaDeCalle[], nivel: number): { deCelda: string[]; distintas: Map<string, Tesela> } {
  const porCelda = new Map(red.map((x) => [`${x.c},${x.f}`, x]));
  const distintas = new Map<string, Tesela>(), deCelda: string[] = [];
  for (const x of red) {
    const lados = D.map(([dc, df], k) => ((x.lados >> k) & 1 ? (porCelda.get(`${x.c + dc},${x.f + df}`)?.clase ?? null) : null));
    const rincones = D.map((_, k) => {
      const a = D[k]!, b = D[(k + 1) % 4]!;
      return x.clase === 'explanada' && !!lados[k] && !!lados[(k + 1) % 4] && porCelda.has(`${x.c + a[0] + b[0]},${x.f + a[1] + b[1]}`);
    });
    const t: Tesela = { clase: x.clase, nivel: enlosada(x.clase, nivel) || lados.some((l) => l && enlosada(l, nivel)) ? nivel : 1, lados, rincones, variante: x.semilla % 3 };
    const clave = `${t.clase}|${t.nivel}|${lados.map((l) => (l ? l[0] : '-')).join('')}|${rincones.map(Number).join('')}|${t.variante}`;
    if (!distintas.has(clave)) distintas.set(clave, t);
    deCelda.push(clave);
  }
  return { deCelda, distintas };
}

// ---------------------------------------------------------------- trazos: el eje de cada tramo de la red dentro de la celda

interface Trazo {
  /** El punto del eje y su normal en `t` (0 en el lado `a`, 1 en el `b` o en el centro; fuera de [0, 1], los cabos que salen de la celda). */
  en(t: number): { p: P2; n: P2 };
  a: number;
  /** El otro lado, o -1 si acaba en el centro. */
  b: number;
  /** Largo del eje dentro de la celda (en celdas). */
  largo: number;
}

/** De un lado al opuesto. */
function recta(a: number): Trazo {
  const m = MEDIO(a), d: P2 = [-D[a]![0], -D[a]![1]], n: P2 = [-d[1], d[0]];
  return { a, b: (a + 2) % 4, largo: 1, en: (t) => ({ p: [m[0] + d[0] * t, m[1] + d[1] * t], n }) };
}

/** De un lado al centro. */
function brazo(a: number): Trazo {
  const m = MEDIO(a), d: P2 = [-D[a]![0], -D[a]![1]], n: P2 = [-d[1], d[0]];
  return { a, b: -1, largo: 0.5, en: (t) => ({ p: [m[0] + d[0] * 0.5 * t, m[1] + d[1] * 0.5 * t], n }) };
}

/** De un lado al siguiente (en el sentido del reloj), en un cuarto de círculo alrededor de la esquina que comparten. */
function curva(a: number): Trazo {
  const b = (a + 1) % 4, ma = MEDIO(a), mb = MEDIO(b), C: P2 = [ma[0] + mb[0] - 0.5, ma[1] + mb[1] - 0.5];
  const ta = Math.atan2(ma[1] - C[1], ma[0] - C[0]), tb = Math.atan2(mb[1] - C[1], mb[0] - C[0]);
  let delta = tb - ta;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const largo = 0.5 * Math.abs(delta);
  return {
    a, b, largo,
    en: (t) => {
      if (t < 0) return { p: [ma[0] + D[a]![0] * -t * largo, ma[1] + D[a]![1] * -t * largo], n: [Math.cos(ta), Math.sin(ta)] };
      if (t > 1) return { p: [mb[0] + D[b]![0] * (t - 1) * largo, mb[1] + D[b]![1] * (t - 1) * largo], n: [Math.cos(tb), Math.sin(tb)] };
      const th = ta + delta * t, n: P2 = [Math.cos(th), Math.sin(th)];
      return { p: [C[0] + 0.5 * n[0], C[1] + 0.5 * n[1]], n };
    },
  };
}

const suave = (x: number): number => x * x * (3 - 2 * x);
/** Un valor que va de `ea` (en el lado a) a `m` (en medio) y a `eb` (en el lado b o el centro). */
const tramo = (t: number, ea: number, m: number, eb: number): number =>
  t <= 0 ? ea : t >= 1 ? eb : t < 0.5 ? ea + (m - ea) * suave(t / 0.5) : m + (eb - m) * suave((t - 0.5) / 0.5);

interface Banda {
  tr: Trazo;
  /** Anchura en el lado a, en medio y en el lado b. */
  w: [number, number, number];
  /** Cuánto serpentea (en celdas) y cómo. */
  serpea: number;
  fase: [number, number];
}

const desvio = (b: Banda, t: number): number =>
  b.serpea && t > 0 && t < 1 ? b.serpea * (b.fase[0] * Math.sin(Math.PI * t) + b.fase[1] * Math.sin(2 * Math.PI * t)) : 0;

/** El contorno de una banda (más estrecha en `menos` por cada lado). */
function contorno(g: CanvasRenderingContext2D, b: Banda, menos = 0, extra = 0.2): void {
  const ts: number[] = [];
  const n = Math.max(6, Math.ceil(b.tr.largo * 24));
  ts.push(-extra / b.tr.largo);
  for (let i = 0; i <= n; i++) ts.push(i / n);
  if (b.tr.b >= 0) ts.push(1 + extra / b.tr.largo);
  const izq: P2[] = [], der: P2[] = [];
  for (const t of ts) {
    const { p, n: nn } = b.tr.en(t), w = Math.max(0.02, tramo(t, b.w[0], b.w[1], b.w[2]) / 2 - menos), o = desvio(b, t);
    izq.push([p[0] + nn[0] * (o + w), p[1] + nn[1] * (o + w)]);
    der.push([p[0] + nn[0] * (o - w), p[1] + nn[1] * (o - w)]);
  }
  g.moveTo(izq[0]![0], izq[0]![1]);
  for (const q of izq.slice(1)) g.lineTo(q[0], q[1]);
  for (const q of der.reverse()) g.lineTo(q[0], q[1]);
  g.closePath();
}

/** Una línea paralela al eje, a `desde` del eje (más lo que serpentea y un temblor). */
function paralela(g: CanvasRenderingContext2D, b: Banda, desde: number, temblor: (t: number) => number, extra = 0.2): void {
  const n = Math.max(6, Math.ceil(b.tr.largo * 28));
  const t0 = -extra / b.tr.largo, t1 = b.tr.b >= 0 ? 1 + extra / b.tr.largo : 1;
  for (let i = 0; i <= n + 2; i++) {
    const t = i === 0 ? t0 : i === n + 2 ? t1 : (i - 1) / n;
    const { p, n: nn } = b.tr.en(t), o = desvio(b, t) + desde + (t > 0 && t < 1 ? temblor(t) : 0);
    if (i === 0) g.moveTo(p[0] + nn[0] * o, p[1] + nn[1] * o);
    else g.lineTo(p[0] + nn[0] * o, p[1] + nn[1] * o);
  }
}

/** Un degradado a lo largo del trazo con la intensidad en los dos cabos y en medio. */
function aLoLargo(g: CanvasRenderingContext2D, tr: Trazo, rgb: string, alfa: number, ia: number, im: number, ib: number): CanvasGradient {
  const p0 = tr.en(0).p, p1 = tr.en(1).p, cx = p1[0] - p0[0], cy = p1[1] - p0[1], l2 = cx * cx + cy * cy || 1;
  const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
  let antes = -1;
  for (const t of [0, 0.3, 0.5, 0.7, 1]) {
    const p = tr.en(t).p, u = Math.min(1, Math.max(antes + 1e-4, ((p[0] - p0[0]) * cx + (p[1] - p0[1]) * cy) / l2));
    antes = u;
    gr.addColorStop(Math.min(1, u), `rgba(${rgb}, ${(alfa * tramo(t, ia, im, ib)).toFixed(3)})`);
  }
  return gr;
}

// ---------------------------------------------------------------- la tesela

/** Azar fijo de una tesela. */
const azarDe = (t: Tesela, k: number): number => hash3(t.variante * 7 + t.lados.reduce((s, l, i) => s + (l ? (i + 1) * 3 : 0), 0), k, 97);

/** Un recorrido de ruedas o de pies: su banda y cuánto pesa en cada cabo (por la vecina de ese lado) y en medio (por la propia). */
interface Rodada { banda: Banda; fa: number; fm: number; fb: number }

/** Las bandas, las rodadas y los ejes de las losas de una tesela. */
function montar(t: Tesela): { bandas: Banda[]; discos: [number, number][]; rodadas: Rodada[]; ejes: Banda[]; cruce: 0 | 1 | 2; final: number } {
  const own = ANCHO[t.clase], con = [0, 1, 2, 3].filter((k) => t.lados[k]);
  const borde = (k: number): number => (t.lados[k] ? (own + ANCHO[t.lados[k]!]) / 2 : own);
  const fase: [number, number] = [azarDe(t, 1) * 2 - 1, azarDe(t, 2) * 2 - 1];
  const serpea = t.clase === 'senda' && con.length <= 2 ? 0.075 : 0;
  const banda = (tr: Trazo): Banda => ({ tr, w: [borde(tr.a), own, tr.b >= 0 ? borde(tr.b) : own], serpea, fase });
  const bandas: Banda[] = [], rodadas: Rodada[] = [], ejes: Banda[] = [], discos: [number, number][] = [];
  let cruce: 0 | 1 | 2 = 0, final = -1;
  if (con.length === 0) discos.push([0.3, 0]);
  else if (con.length === 1) {
    const b = banda(brazo(con[0]!));
    bandas.push(b); ejes.push(b);
    discos.push([own / 2, 0]);
    rodadas.push({ banda: b, fa: 1, fm: 1, fb: 1 });
    final = con[0]!;
  } else if (con.length === 2) {
    const [a, b] = con as [number, number];
    const tr = b - a === 2 ? recta(a) : curva(b - a === 1 ? a : b);
    const bb = banda(tr);
    bandas.push(bb); ejes.push(bb);
    rodadas.push({ banda: bb, fa: 1, fm: 1, fb: 1 });
  } else if (con.length === 3) {
    const falta = [0, 1, 2, 3].find((k) => !t.lados[k])!, s = (falta + 2) % 4;
    const paso = banda(recta((s + 1) % 4)), c1 = banda(curva(s)), c2 = banda(curva((s + 3) % 4));
    bandas.push(paso, c1, c2);
    discos.push([own / 2 + 0.05, 0]);
    rodadas.push({ banda: paso, fa: 1, fm: 1, fb: 1 });
    // las dos curvas salen juntas del brazo: la mitad cada una, y se apagan al llegar a la calle que cruza
    rodadas.push({ banda: c1, fa: 0.55, fm: 0.6, fb: 0 }, { banda: c2, fa: 0, fm: 0.6, fb: 0.55 });
    ejes.push(banda(brazo(s)), paso);
    cruce = 1;
  } else {
    const h = banda(recta(0)), v = banda(recta(1));
    bandas.push(h, v, ...[0, 1, 2, 3].map((k) => banda(curva(k))));
    discos.push([own / 2 + 0.07, 0]);
    rodadas.push({ banda: h, fa: 1, fm: 1, fb: 1 }, { banda: v, fa: 1, fm: 1, fb: 1 });
    for (let k = 0; k < 4; k++) rodadas.push({ banda: bandas[2 + k]!, fa: 0, fm: 0.35, fb: 0 });
    ejes.push(h, v);
    cruce = 2;
  }
  return { bandas, discos, rodadas, ejes, cruce, final };
}

/** Las intensidades (cabo a, medio, cabo b) de un recorrido, con `valor` de cada clase: en el borde con la vecina, la menor de las dos. */
function intensidades(t: Tesela, r: Rodada, valor: (c: ClaseDeCalle) => number): [number, number, number] {
  const propio = valor(t.clase), cabo = (k: number): number => (k >= 0 && t.lados[k] ? Math.min(propio, valor(t.lados[k]!)) : propio);
  return [r.fa * cabo(r.banda.tr.a), r.fm * propio, r.fb * (r.banda.tr.b >= 0 ? cabo(r.banda.tr.b) : propio)];
}

/** Las rodadas de cada clase: en la piedra, solo el desgaste. */
const rodadaDe = (t: Tesela) => (c: ClaseDeCalle): number => RODADA[c] * (enlosada(c, t.nivel) ? 0.3 : 1);

const girar = (g: CanvasRenderingContext2D, k: number): void => {
  g.translate(0.5, 0.5);
  g.rotate((k * Math.PI) / 2);
  g.translate(-0.5, -0.5);
};

/** La forma pisada (opaca) de la tesela, con `menos` de margen por cada lado (para el bordillo). */
function mascara(g: CanvasRenderingContext2D, t: Tesela, m: ReturnType<typeof montar>, menos: number): void {
  g.fillStyle = '#fff';
  for (const b of m.bandas) { g.beginPath(); contorno(g, b, menos); g.fill(); }
  for (const [r] of m.discos) { g.beginPath(); g.arc(0.5, 0.5, Math.max(0.02, r - menos), 0, Math.PI * 2); g.fill(); }
  for (let k = 0; k < 4; k++) {
    if (!t.rincones[k]) continue;
    g.save();
    girar(g, k);
    g.fillRect(0.5, 0.5, 0.7, 0.7);
    g.restore();
  }
}

const hex = (c: number): string => `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
const tono = (c: number, f: number): string => `rgb(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f)))).join(', ')})`;

const TIERRA: Record<ClaseDeCalle, number> = { principal: 0x957857, callejon: 0xa08564, explanada: 0x9e8460, senda: 0x978262 };

/** Tierra pisada: el color, manchas, desgaste en los cruces, pisadas, rodadas, chinas y algún charco. */
function tierra(g: CanvasRenderingContext2D, t: Tesela, m: ReturnType<typeof montar>, az: (k: number) => number): void {
  g.fillStyle = `rgb(${hex(TIERRA[t.clase])})`;
  g.fillRect(-0.2, -0.2, 1.4, 1.4);
  for (let i = 0; i < 22; i++) {
    const x = az(10 + i) * 1.2 - 0.1, y = az(40 + i) * 1.2 - 0.1, r = 0.06 + az(70 + i) * 0.16;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, az(100 + i) < 0.55 ? 'rgba(70, 52, 34, 0.13)' : 'rgba(225, 205, 165, 0.12)');
    gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // el desgaste del cruce, y en las explanadas, por donde más se pasa
  if (m.cruce || t.clase === 'explanada') {
    const gr = g.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.38);
    gr.addColorStop(0, 'rgba(78, 58, 38, 0.30)');
    gr.addColorStop(1, 'rgba(78, 58, 38, 0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1, 1);
  }
  // la hierba entre las rodadas de los caminos de fuera
  if (t.clase === 'senda') {
    for (const r of m.rodadas) {
      const [ia, im, ib] = intensidades(t, r, (c) => (c === 'senda' ? 1 : 0));
      g.beginPath();
      paralela(g, r.banda, 0, () => 0);
      g.strokeStyle = aLoLargo(g, r.banda.tr, '112, 130, 70', 0.45, ia, im, ib);
      g.lineWidth = 0.1;
      g.stroke();
    }
  }
  // la senda de pisadas de los callejones
  for (const r of m.rodadas) {
    const [ia, im, ib] = intensidades(t, r, (c) => PISADAS[c]);
    if (Math.max(ia, im, ib) <= 0.01) continue;
    const temblor = (x: number): number => 0.025 * Math.sin(Math.PI * x) * Math.sin(3 * Math.PI * x + az(5) * 6);
    g.beginPath();
    paralela(g, r.banda, 0, temblor);
    g.strokeStyle = aLoLargo(g, r.banda.tr, '104, 82, 56', 0.42, ia, im, ib);
    g.lineWidth = 0.13;
    g.stroke();
  }
  rodadas(g, t, m, az, '58, 43, 28', 0.5);
  // chinas
  for (let i = 0; i < 46; i++) {
    const x = az(200 + i), y = az(300 + i), r = 0.004 + az(400 + i) * 0.007;
    g.fillStyle = az(500 + i) < 0.5 ? 'rgba(205, 190, 160, 0.55)' : 'rgba(80, 64, 44, 0.45)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // un charco en algunos cruces y explanadas, y en pocos tramos
  const charco = (m.cruce || t.clase === 'explanada' ? 0.45 : t.clase === 'principal' ? 0.12 : 0) > az(600);
  if (charco) {
    const x = 0.5 + (az(601) - 0.5) * 0.24, y = 0.5 + (az(602) - 0.5) * 0.24, rx = 0.07 + az(603) * 0.07, ry = rx * (0.55 + az(604) * 0.3), a = az(605) * Math.PI;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = 'rgba(92, 72, 50, 0.55)';
    g.beginPath(); g.ellipse(0, 0, rx * 1.35, ry * 1.4, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createLinearGradient(-rx, -ry, rx, ry);
    gr.addColorStop(0, 'rgb(112, 128, 130)');
    gr.addColorStop(1, 'rgb(70, 82, 84)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(230, 236, 230, 0.35)';
    g.lineWidth = 0.008;
    g.beginPath(); g.ellipse(-rx * 0.2, -ry * 0.2, rx * 0.55, ry * 0.4, 0, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    g.restore();
  }
}

/** Las rodadas: un surco oscuro y su caballón claro al lado, por cada rueda; y en los finales, la vuelta del carro. */
function rodadas(g: CanvasRenderingContext2D, t: Tesela, m: ReturnType<typeof montar>, az: (k: number) => number, oscuro: string, alfa: number): void {
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  const valor = rodadaDe(t);
  for (const [i, r0] of m.rodadas.entries()) {
    const [ia, im, ib] = intensidades(t, r0, valor), r = { banda: r0.banda, ia, im, ib };
    if (Math.max(ia, im, ib) <= 0.01) continue;
    for (const lado of [-1, 1]) {
      const f = az(700 + i * 4 + lado), temblor = (x: number): number => 0.01 * Math.sin(Math.PI * x) * Math.sin((2 + f * 3) * Math.PI * x + f * 6);
      g.beginPath();
      paralela(g, r.banda, lado * VIA, temblor);
      g.strokeStyle = aLoLargo(g, r.banda.tr, oscuro, alfa, r.ia, r.im, r.ib);
      g.lineWidth = 0.028;
      g.stroke();
      g.beginPath();
      paralela(g, r.banda, lado * (VIA + 0.028), temblor);
      g.strokeStyle = aLoLargo(g, r.banda.tr, '214, 196, 160', alfa * 0.35, r.ia, r.im, r.ib);
      g.lineWidth = 0.016;
      g.stroke();
    }
  }
  if (m.final >= 0 && valor(t.clase) > 0.01) {
    // la vuelta: las dos rodadas se juntan en un medio círculo pasado el centro
    g.save();
    girar(g, m.final);
    g.strokeStyle = `rgba(${oscuro}, ${(alfa * valor(t.clase)).toFixed(3)})`;
    g.lineWidth = 0.028;
    g.beginPath();
    g.arc(0.5, 0.5, VIA, -Math.PI / 2, Math.PI / 2, true);
    g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------- las losas

const LOSA = { junta: 'rgb(92, 82, 66)', bordillo: 0x8a7f6c };

/** Piedras de una cuadrícula temblada (sin temblar en el borde de la celda, para que case con la vecina). */
function adoquines(g: CanvasRenderingContext2D, paso: number, base: number, varia: number, az: (k: number) => number, semilla: number): void {
  const n = Math.round(1 / paso), lo = -2, hi = n + 2;
  const v = (i: number, j: number): P2 => {
    const jx = i <= 0 || i >= n ? 0 : (hash3(i, j, semilla) - 0.5) * paso * 0.45, jy = j <= 0 || j >= n ? 0 : (hash3(j, i, semilla + 1) - 0.5) * paso * 0.45;
    return [i * paso + jx, j * paso + jy];
  };
  g.fillStyle = LOSA.junta;
  g.fillRect(-0.2, -0.2, 1.4, 1.4);
  for (let i = lo; i < hi; i++) for (let j = lo; j < hi; j++) {
    const q = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)], cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    g.fillStyle = tono(base, 1 + (hash3(i, j, semilla + 2) - 0.5) * varia);
    g.beginPath();
    for (const [k, p] of q.entries()) {
      const x = cx + (p[0] - cx) * 0.88, y = cy + (p[1] - cy) * 0.88;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.fill();
  }
  void az;
}

/** Hiladas de losas a lo largo de un eje: juntas de través, y a lo largo, a tresbolillo. */
function hiladas(g: CanvasRenderingContext2D, b: Banda, paso: number, base: number, az: (k: number) => number, semilla: number): void {
  const n = Math.max(2, Math.round(b.tr.largo / paso)), dt = 1 / n, fin = b.tr.b >= 0 ? n + 2 : n;
  g.save();
  g.beginPath();
  contorno(g, b, 0);
  g.clip();
  for (let i = -2; i < fin; i++) {
    const t0 = i * dt, t1 = (i + 1) * dt;
    let o = -0.55 + (hash3(i, semilla, 5) * 0.08);
    for (let k = 0; o < 0.55; k++) {
      const w = 0.09 + hash3(i, k, semilla) * 0.07, o2 = Math.min(0.6, o + w);
      const a = b.tr.en(t0), c = b.tr.en(t1);
      const q: P2[] = [
        [a.p[0] + a.n[0] * (o + 0.004), a.p[1] + a.n[1] * (o + 0.004)], [a.p[0] + a.n[0] * (o2 - 0.004), a.p[1] + a.n[1] * (o2 - 0.004)],
        [c.p[0] + c.n[0] * (o2 - 0.004), c.p[1] + c.n[1] * (o2 - 0.004)], [c.p[0] + c.n[0] * (o + 0.004), c.p[1] + c.n[1] * (o + 0.004)],
      ];
      // separa un poco las hiladas
      const s = 0.006, dx = (c.p[0] - a.p[0]) * s / (dt * b.tr.largo || 1), dy = (c.p[1] - a.p[1]) * s / (dt * b.tr.largo || 1);
      q[0] = [q[0]![0] + dx, q[0]![1] + dy]; q[1] = [q[1]![0] + dx, q[1]![1] + dy]; q[2] = [q[2]![0] - dx, q[2]![1] - dy]; q[3] = [q[3]![0] - dx, q[3]![1] - dy];
      g.fillStyle = tono(base, 0.92 + hash3(i, k, semilla + 3) * 0.16);
      g.beginPath();
      g.moveTo(q[0]![0], q[0]![1]);
      for (const p of q.slice(1)) g.lineTo(p[0], p[1]);
      g.fill();
      o = o2;
    }
  }
  g.restore();
  void az;
}

/** La calzada de Cnosos: una franja de losas grandes y claras por el eje. */
function franja(g: CanvasRenderingContext2D, b: Banda, semilla: number): void {
  const n = Math.max(2, Math.round(b.tr.largo / 0.17)), dt = 1 / n, fin = b.tr.b >= 0 ? n + 2 : n, w = 0.1;
  for (let i = -2; i < fin; i++) {
    const a = b.tr.en(i * dt + 0.006), c = b.tr.en((i + 1) * dt - 0.006);
    g.fillStyle = tono(0xcdc3ab, 0.94 + hash3(i, semilla, 9) * 0.1);
    g.beginPath();
    g.moveTo(a.p[0] + a.n[0] * w, a.p[1] + a.n[1] * w);
    g.lineTo(a.p[0] - a.n[0] * w, a.p[1] - a.n[1] * w);
    g.lineTo(c.p[0] - c.n[0] * w, c.p[1] - c.n[1] * w);
    g.lineTo(c.p[0] + c.n[0] * w, c.p[1] + c.n[1] * w);
    g.fill();
  }
  // la junta de los bordes de la franja
  g.strokeStyle = 'rgba(92, 82, 66, 0.7)';
  g.lineWidth = 0.01;
  for (const lado of [-1, 1]) { g.beginPath(); paralela(g, b, lado * (w + 0.006), () => 0); g.stroke(); }
}

/** El rosetón de un cruce en X: anillos de piedras alrededor de una losa redonda. */
function roseton(g: CanvasRenderingContext2D, radio: number, semilla: number): void {
  g.fillStyle = LOSA.junta;
  g.beginPath(); g.arc(0.5, 0.5, radio, 0, Math.PI * 2); g.fill();
  g.fillStyle = tono(0xcdc3ab, 1);
  g.beginPath(); g.arc(0.5, 0.5, 0.065, 0, Math.PI * 2); g.fill();
  for (let r0 = 0.075, k = 0; r0 < radio - 0.02; r0 += 0.065, k++) {
    const r1 = Math.min(radio - 0.006, r0 + 0.058), n = Math.max(6, Math.round((2 * Math.PI * (r0 + r1)) / 2 / 0.075)), da = (2 * Math.PI) / n, desf = k % 2 ? da / 2 : 0;
    for (let i = 0; i < n; i++) {
      const a0 = desf + i * da + 0.012 / r1, a1 = desf + (i + 1) * da - 0.012 / r1;
      g.fillStyle = tono(k % 2 ? 0xb0a28a : 0xbfb299, 0.94 + hash3(i, k, semilla) * 0.12);
      g.beginPath();
      g.arc(0.5, 0.5, r1, a0, a1);
      g.arc(0.5, 0.5, r0 + 0.005, a1, a0, true);
      g.closePath();
      g.fill();
    }
  }
}

function losas(g: CanvasRenderingContext2D, t: Tesela, m: ReturnType<typeof montar>, az: (k: number) => number): void {
  const semilla = 31 + t.variante;
  if (t.clase === 'explanada') { adoquines(g, 1 / 4, 0xc0b49c, 0.16, az, semilla); return; }
  adoquines(g, 1 / 9, 0xa99c84, 0.18, az, semilla);
  if (t.clase === 'principal' && t.nivel >= 5) for (const b of m.ejes) franja(g, b, semilla);
  else for (const b of m.ejes) hiladas(g, b, t.clase === 'callejon' ? 0.085 : 0.1, t.clase === 'callejon' ? 0xab9e86 : 0xb6a890, az, semilla);
  if (m.cruce === 2) roseton(g, ANCHO[t.clase] / 2 + (t.clase === 'principal' ? 0.02 : -0.04), semilla);
  if (m.final >= 0 && t.clase === 'principal' && t.nivel >= 5) { g.fillStyle = tono(0xcdc3ab, 1); g.beginPath(); g.arc(0.5, 0.5, 0.12, 0, Math.PI * 2); g.fill(); }
  // el desgaste de las ruedas sobre la piedra y alguna mancha de tierra
  rodadas(g, t, m, az, '70, 62, 50', 0.4);
  for (let i = 0; i < 6; i++) {
    const x = az(800 + i), y = az(810 + i), r = 0.05 + az(820 + i) * 0.08, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(120, 96, 66, 0.16)');
    gr.addColorStop(1, 'rgba(120, 96, 66, 0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}

// ---------------------------------------------------------------- el atlas y la malla

/** Píxeles por celda de las teselas y la holgura que se pinta alrededor (para el difuminado y para el filtro de la textura). */
const HOLGURA = 0.125;

function lienzo(lado: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  return [c, c.getContext('2d')!];
}

/** Pinta una tesela en un lienzo de `S` píxeles por celda más la holgura. */
export function pintarTesela(t: Tesela, S: number): HTMLCanvasElement {
  const P = Math.round(S * HOLGURA), L = S + 2 * P, m = montar(t), az = (k: number): number => azarDe(t, k);
  const enUnidades = (g: CanvasRenderingContext2D): void => g.setTransform(S, 0, 0, S, P, P);
  const losa = enlosada(t.clase, t.nivel);
  const [sup, g] = lienzo(L);
  enUnidades(g);
  if (losa) losas(g, t, m, az); else tierra(g, t, m, az);
  // la forma: difuminada en la tierra, nítida y con bordillo en las losas
  const forma = (menos: number, difumina: number): HTMLCanvasElement => {
    const [a, ga] = lienzo(L);
    enUnidades(ga);
    mascara(ga, t, m, menos);
    const [b, gb] = lienzo(L);
    gb.filter = `blur(${difumina}px)`;
    gb.drawImage(a, 0, 0);
    return b;
  };
  if (losa) {
    const dentro = forma(0.045, S * 0.006);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(dentro, 0, 0);
    // el bordillo debajo
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = `rgb(${hex(LOSA.bordillo)})`;
    g.fillRect(0, 0, L, L);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(forma(0, S * 0.006), 0, 0);
  } else {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(forma(0, S * (t.clase === 'senda' ? 0.04 : 0.028)), 0, 0);
  }
  g.globalCompositeOperation = 'source-over';
  return sup;
}

export class Calzada {
  readonly malla: THREE.Mesh;
  private readonly material: THREE.MeshLambertMaterial;
  private textura: THREE.CanvasTexture | null = null;
  private clave = '';

  constructor(private readonly anisotropia: number) {
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // Los bordes difuminados: la textura sube premultiplicada (así se filtra bien, sin los colores falsos de los píxeles casi transparentes,
    // que dejaban un halo anaranjado) y aquí se deshace la premultiplicación y se pasa de sRGB a lineal antes de iluminar.
    this.material.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 tesela = texture2D( map, vMapUv );
  tesela.rgb /= max( tesela.a, 1e-4 );
  diffuseColor *= vec4( sRGBTransferEOTF( vec4( tesela.rgb, 1.0 ) ).rgb, tesela.a );
#endif`
      );
    };
    this.malla = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.malla.receiveShadow = true;
    this.malla.renderOrder = 1;
  }

  /** Rehace las calles si cambió la red o el nivel de la plaza. */
  actualizar(c: CiudadEnVista): void {
    const nivel = Math.max(1, Math.min(5, c.nivel));
    const clave = `${nivel}|${c.celda}|${c.red.map((x) => `${x.c},${x.f},${x.clase[0]},${x.lados}`).join(';')}`;
    if (clave === this.clave) return;
    this.clave = clave;
    const { deCelda, distintas } = teselasDe(c.red, nivel);
    // el atlas: cuantas más teselas distintas, más pequeñas
    const lista = [...distintas.keys()], n = Math.max(1, lista.length);
    const S = n <= 220 ? 128 : n <= 420 ? 96 : 64, P = Math.round(S * HOLGURA), G = Math.min(P, 6), paso = S + 2 * G;
    const cols = Math.max(1, Math.floor(2048 / paso)), filas = Math.ceil(n / cols), W = cols * paso, H = filas * paso;
    const [atlas, ga] = lienzo(1);
    atlas.width = W;
    atlas.height = H;
    const uv = new Map<string, [number, number, number, number]>();
    lista.forEach((k, i) => {
      const x0 = (i % cols) * paso + G, y0 = Math.floor(i / cols) * paso + G;
      ga.drawImage(pintarTesela(distintas.get(k)!, S), P - G, P - G, S + 2 * G, S + 2 * G, x0 - G, y0 - G, S + 2 * G, S + 2 * G);
      uv.set(k, [x0 / W, y0 / H, (x0 + S) / W, (y0 + S) / H]);
    });
    // un cuadrado por celda, un pelo por encima del suelo
    const T = c.celda, y = 0.015, pos = new Float32Array(c.red.length * 12), nor = new Float32Array(c.red.length * 12), uvs = new Float32Array(c.red.length * 8), idx: number[] = [];
    c.red.forEach((x, i) => {
      const [u0, v0, u1, v1] = uv.get(deCelda[i]!)!, x0 = x.c * T, x1 = x0 + T, z0 = x.f * T, z1 = z0 + T;
      pos.set([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], i * 12);
      nor.set([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], i * 12);
      uvs.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8);
      const b = i * 4;
      idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    this.malla.geometry.dispose();
    this.malla.geometry = geo;
    this.textura?.dispose();
    const tx = new THREE.CanvasTexture(atlas);
    tx.flipY = false;
    tx.premultiplyAlpha = true;
    tx.colorSpace = THREE.NoColorSpace;
    tx.anisotropy = this.anisotropia;
    tx.minFilter = THREE.LinearMipmapLinearFilter;
    this.textura = tx;
    this.material.map = tx;
    this.material.needsUpdate = true;
    this.malla.visible = c.red.length > 0;
  }

  destruir(): void {
    this.textura?.dispose();
    this.material.dispose();
    this.malla.geometry.dispose();
  }
}

/** Los guardacantones: una piedra en cada esquina de un cruce (T o X) que da a una casa, para que los carros no la rocen al girar. */
export function montarGuardacantones(p: Piezas, c: CiudadEnVista): void {
  const T = c.celda, hay = new Set(c.red.map((x) => `${x.c},${x.f}`)), estilo = Math.max(1, Math.min(5, c.nivel));
  for (const x of c.red) {
    if ((x.clase !== 'principal' && x.clase !== 'callejon') || (x.forma !== 't' && x.forma !== 'x')) continue;
    for (let k = 0; k < 4; k++) {
      const a = D[k]!, b = D[(k + 1) % 4]!;
      if (!((x.lados >> k) & 1) || !((x.lados >> ((k + 1) % 4)) & 1) || hay.has(`${x.c + a[0] + b[0]},${x.f + a[1] + b[1]}`)) continue;
      if (hash3(x.semilla, k, 61) < 0.35) continue;
      const cx = (x.c + 0.5 + (a[0] + b[0]) * (0.5 - 0.09)) * T, cz = (x.f + 0.5 + (a[1] + b[1]) * (0.5 - 0.09)) * T;
      if (estilo >= 4) p.forma('caja', COLOR.piedraClara, cx, cz, 0.26, 0.26, 0.34, hash3(x.semilla, k, 62) * 0.5);
      else p.forma('cupula', estilo >= 2 ? COLOR.piedra : COLOR.piedraOscura, cx, cz, 0.34, 0.3, 0.26, hash3(x.semilla, k, 62) * 3);
    }
  }
}
