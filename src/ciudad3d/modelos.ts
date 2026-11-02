// Los edificios de la plaza hechos en código, cada uno DENTRO de su huella (nada sale de ella ni se gira fuera de ella: el trazado manda).
// El aspecto lo da el estilo (el nivel de la plaza con el umbral de cada casa, `estado.ts`):
//   1. chozas redondas de zarzo y paja, casas largas de madera con tejado de paja a dos aguas;
//   2. casas largas y absidales de barro y paja, y las primeras de adobe;
//   3. adobe de techo plano con pretil, trampilla, vigas que asoman, patio y pérgola (la aldea en ladera, 3D Stoa);
//   4. enlucido sobre zócalo de piedra, dos alturas, ventanas;
//   5. piedra y enlucido con franjas y columnas rojas, terrazas escalonadas (Cnosos).
// Y su estado: en obra, un armazón de postes y vigas que crece con el avance; en mejora, su modelo con andamios; en cola (solo la propia),
// estacas y cuerda; dañado, ruina de muros bajos, escombro y vigas quemadas.
import { COLOR } from './config';
import { hash3, type EdificioEnVista } from './estado';
import { mezclar, oscurecer, type Forma, type Piezas } from './piezas';

/** El marco de una huella: `u` a lo largo de su lado largo y `v` a lo ancho, desde su centro. */
class Marco {
  readonly cx: number;
  readonly cz: number;
  readonly g: number;
  /** Lado largo y lado corto, en ul. */
  readonly L: number;
  readonly S: number;
  private readonly c: number;
  private readonly s: number;

  constructor(readonly p: Piezas, readonly e: EdificioEnVista) {
    this.cx = e.x + e.ancho / 2;
    this.cz = e.y + e.alto / 2;
    const largoEnX = e.ancho >= e.alto;
    this.g = largoEnX ? 0 : Math.PI / 2;
    this.L = largoEnX ? e.ancho : e.alto;
    this.S = largoEnX ? e.alto : e.ancho;
    this.c = Math.cos(this.g);
    this.s = Math.sin(this.g);
  }

  x(u: number, v: number): number { return this.cx + u * this.c - v * this.s; }
  z(u: number, v: number): number { return this.cz + u * this.s + v * this.c; }

  forma(f: Forma, color: number, u: number, v: number, l: number, s: number, h: number, y = 0, giro = 0, inclina?: number): void {
    this.p.forma(f, color, this.x(u, v), this.z(u, v), l, s, h, this.g + giro, y, inclina);
  }
  caja(color: number, u: number, v: number, l: number, s: number, h: number, y = 0, giro = 0): void {
    this.forma('caja', color, u, v, l, s, h, y, giro);
  }
  losa(color: number, u: number, v: number, l: number, s: number, h = 0.04, y = 0): void {
    this.forma('losa', color, u, v, l, s, h, y);
  }
  poste(color: number, u: number, v: number, h: number, grueso = 0.12, y = 0): void {
    this.p.poste(color, this.x(u, v), this.z(u, v), h, grueso, y);
  }
  viga(color: number, u0: number, v0: number, u1: number, v1: number, y: number, grueso = 0.1, alto = grueso): void {
    this.p.viga(color, this.x(u0, v0), this.z(u0, v0), this.x(u1, v1), this.z(u1, v1), y, grueso, alto);
  }
  /** Un número fijo entre 0 y 1 por edificio y `k`. */
  azar(k: number): number { return hash3(this.e.semilla, k, 3); }
  /** Entre `a` y `b`, fijo por edificio y `k`. */
  entre(k: number, a: number, b: number): number { return a + (b - a) * this.azar(k); }
}

// ───────────────────────────── Piezas de arquitectura ─────────────────────────────

/** Una choza redonda de radio `r`: muro de zarzo y techo cónico de paja, con la puerta hacia `frente` (±1 en v). */
function choza(m: Marco, u: number, v: number, r: number, o: { techo?: number; muro?: number; alto?: number; frente?: number } = {}): void {
  const h = o.alto ?? 0.75, f = o.frente ?? 1;
  m.forma('cilindro', o.muro ?? COLOR.zarzo, u, v, 2 * r, 2 * r, h);
  m.forma('cono', o.techo ?? COLOR.paja, u, v, 2 * r * 1.22, 2 * r * 1.22, r * 1.15 + 0.35, h * 0.8);
  m.caja(COLOR.hueco, u, v + f * r * 0.97, Math.min(0.5, r * 0.5), 0.12, Math.min(0.62, h * 0.85));
}

/** Una casa larga de `l` × `s`: muros bajos y tejado de paja a dos aguas; con ábside, un extremo redondo. La puerta en el hastial de +u. */
function casaLarga(m: Marco, u: number, v: number, l: number, s: number, o: { techo?: number; muro?: number; alto?: number; abside?: boolean } = {}): void {
  const h = o.alto ?? 0.8, muro = o.muro ?? COLOR.zarzo, techo = o.techo ?? COLOR.paja;
  let ub = u, lb = l;
  if (o.abside && l > s * 1.2) {
    const ua = u - l / 2 + s / 2;
    m.forma('cilindro', muro, ua, v, s, s, h);
    m.forma('cono', techo, ua, v, s * 1.2, s * 1.2, s * 0.62 + 0.15, h * 0.86);
    ub = u + s / 4;
    lb = l - s / 2;
  }
  m.caja(muro, ub, v, lb, s, h);
  m.forma('aguas', techo, ub, v, lb + 0.25, s + 0.45, s * 0.66, h * 0.86);
  m.caja(COLOR.hueco, u + l / 2, v, 0.12, Math.min(0.55, s * 0.35), Math.min(0.65, h * 0.85));
}

/** Una casa de adobe de techo plano: pretil, trampilla, vigas que asoman y la puerta hacia `frente`. Devuelve su alto. */
function casaPlana(m: Marco, u: number, v: number, l: number, s: number, h: number, color: number, o: { frente?: number; pretil?: boolean; trampilla?: boolean; vigas?: boolean; y?: number } = {}): number {
  const f = o.frente ?? 1, y = o.y ?? 0;
  m.caja(color, u, v, l, s, h, y);
  if (o.pretil !== false) {
    const c = oscurecer(color, 0.95), t = 0.1, a = 0.16;
    m.caja(c, u, v - s / 2 + t / 2, l, t, a, y + h);
    m.caja(c, u, v + s / 2 - t / 2, l, t, a, y + h);
    m.caja(c, u - l / 2 + t / 2, v, t, s - 2 * t, a, y + h);
    m.caja(c, u + l / 2 - t / 2, v, t, s - 2 * t, a, y + h);
  }
  if (o.trampilla !== false) m.caja(COLOR.hueco, u + l * 0.18, v - f * s * 0.12, Math.min(0.32, l * 0.2), Math.min(0.32, s * 0.2), 0.03, y + h);
  if (y === 0) m.caja(COLOR.hueco, u - l * 0.22, v + f * (s / 2 + 0.01), Math.min(0.4, l * 0.3), 0.06, Math.min(0.68, h * 0.7));
  if (o.vigas) {
    const n = Math.max(2, Math.round(l / 0.7));
    for (let i = 0; i < n; i++) m.caja(COLOR.maderaOscura, u - l / 2 + (l * (i + 0.5)) / n, v + f * (s / 2 + 0.06), 0.08, 0.14, 0.08, y + h - 0.18);
  }
  return y + h;
}

/** Ventanas pequeñas en la fachada de `frente`, a la altura `y`. */
function ventanas(m: Marco, u: number, v: number, l: number, s: number, y: number, frente: number, marco?: number): void {
  const n = Math.max(1, Math.round(l / 1.1));
  for (let i = 0; i < n; i++) {
    const uu = u - l / 2 + (l * (i + 0.5)) / n;
    if (marco !== undefined) m.caja(marco, uu, v + frente * (s / 2 + 0.01), 0.34, 0.05, 0.4, y - 0.04);
    m.caja(COLOR.hueco, uu, v + frente * (s / 2 + 0.025), 0.22, 0.05, 0.28, y);
  }
}

/** Una pérgola de postes y cañas de `l` × `s`. */
function pergola(m: Marco, u: number, v: number, l: number, s: number, y = 0, h = 0.9, hoja = false): void {
  const du = l / 2 - 0.06, dv = s / 2 - 0.06;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, u + a * du, v + b * dv, h, 0.08, y);
  m.viga(COLOR.madera, u - du, v - dv, u + du, v - dv, y + h, 0.08);
  m.viga(COLOR.madera, u - du, v + dv, u + du, v + dv, y + h, 0.08);
  const n = Math.max(3, Math.round(l / 0.3));
  for (let i = 0; i < n; i++) {
    const uu = u - du + (2 * du * i) / (n - 1);
    m.viga(hoja && i % 2 ? COLOR.hoja : COLOR.maderaOscura, uu, v - dv - 0.05, uu, v + dv + 0.05, y + h + 0.08, 0.05, 0.04);
  }
}

/** Una columna (roja de capitel negro, la de Cnosos; o de madera). */
function columna(m: Marco, u: number, v: number, h: number, y = 0, roja = true): void {
  m.forma('cilindro', roja ? COLOR.rojo : COLOR.madera, u, v, 0.2, 0.2, h - 0.12, y);
  m.caja(roja ? COLOR.negro : COLOR.maderaOscura, u, v, 0.28, 0.28, 0.12, y + h - 0.12);
}

/** Cuernos de consagración (Cnosos) sobre un tejado. */
function cuernos(m: Marco, u: number, v: number, y: number): void {
  m.caja(COLOR.enlucido, u, v, 0.34, 0.12, 0.08, y);
  m.caja(COLOR.enlucido, u - 0.13, v, 0.08, 0.12, 0.2, y + 0.08);
  m.caja(COLOR.enlucido, u + 0.13, v, 0.08, 0.12, 0.2, y + 0.08);
}

/** Una tapia baja de (u0, v0) a (u1, v1). */
function tapia(m: Marco, u0: number, v0: number, u1: number, v1: number, color: number, alto = 0.45, grueso = 0.12): void {
  m.viga(color, u0, v0, u1, v1, 0, grueso, alto);
}

/** Una valla de zarzo: postes y dos varas. */
function valla(m: Marco, u0: number, v0: number, u1: number, v1: number, alto = 0.45): void {
  const l = Math.hypot(u1 - u0, v1 - v0), n = Math.max(2, Math.round(l / 0.7) + 1);
  for (let i = 0; i < n; i++) m.poste(COLOR.madera, u0 + ((u1 - u0) * i) / (n - 1), v0 + ((v1 - v0) * i) / (n - 1), alto, 0.06);
  m.viga(COLOR.zarzo, u0, v0, u1, v1, alto * 0.45, 0.05, alto * 0.45);
}

/** Un recinto rectangular de valla (o tapia), con un hueco en el lado de +v. */
function cerco(m: Marco, u: number, v: number, l: number, s: number, piedra: boolean, color = COLOR.piedra): void {
  const a = u - l / 2, b = u + l / 2, c = v - s / 2, d = v + s / 2, hueco = Math.min(0.8, l * 0.25);
  const lado = piedra ? (u0: number, v0: number, u1: number, v1: number) => tapia(m, u0, v0, u1, v1, color, 0.42, 0.16) : (u0: number, v0: number, u1: number, v1: number) => valla(m, u0, v0, u1, v1);
  lado(a, c, b, c);
  lado(a, c, a, d);
  lado(b, c, b, d);
  lado(a, d, u - hueco / 2, d);
  lado(u + hueco / 2, d, b, d);
}

/** Un montón de leña: troncos tumbados en capas. */
function lena(m: Marco, u: number, v: number, l: number, capas = 3, giro = 0): void {
  // el tronco tumbado crece desde su base hacia −u (girado `giro`): la base, a medio largo hacia +u para que el montón quede centrado
  const bu = u + (Math.cos(giro) * l) / 2, bv = v + (Math.sin(giro) * l) / 2;
  for (let c = 0; c < capas; c++) {
    const n = capas - c + 1;
    for (let i = 0; i < n; i++) {
      const d = -((n - 1) * 0.11) + i * 0.22;
      m.forma('cilindro', i % 2 ? COLOR.madera : COLOR.tronco, bu - Math.sin(giro) * d, bv + Math.cos(giro) * d, 0.2, 0.2, l, c * 0.18, giro + Math.PI / 2, Math.PI / 2);
    }
  }
}

/** Ánforas y tinajas en fila. */
function tinajas(m: Marco, u: number, v: number, n: number, color = COLOR.barro, y = 0): void {
  for (let i = 0; i < n; i++) {
    m.forma('cilindro', color, u + i * 0.28, v, 0.22, 0.22, 0.32, y);
    m.forma('cupula', color, u + i * 0.28, v, 0.22, 0.22, 0.08, y + 0.32);
  }
}

/** Un horno de cúpula. */
function horno(m: Marco, u: number, v: number, r = 0.3, color = COLOR.barro): void {
  m.forma('cupula', color, u, v, 2 * r, 2 * r, r * 1.1);
  m.caja(COLOR.hueco, u, v + r * 0.9, r * 0.6, 0.06, r * 0.5);
}

/** Un almiar (cono de heno sobre su palo). */
function almiar(m: Marco, u: number, v: number, r = 0.45): void {
  m.forma('cono', COLOR.heno, u, v, 2 * r, 2 * r, r * 2.2);
  m.poste(COLOR.madera, u, v, r * 2.6, 0.05);
}

/** Un granero sobre pilotes (los de madera de los niveles bajos). */
function graneroEnPilotes(m: Marco, u: number, v: number, l: number, s: number): void {
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]] as const) m.poste(COLOR.madera, u + a * (l / 2 - 0.08), v + b * (s / 2 - 0.08), 0.45, 0.1);
  m.caja(COLOR.madera, u, v, l, s, 0.62, 0.45);
  m.forma('aguas', COLOR.paja, u, v, l + 0.2, s + 0.35, s * 0.7, 1.0);
}

/** Un silo de colmena (cilindro bajo con su cúpula). */
function silo(m: Marco, u: number, v: number, r: number, color: number): void {
  m.forma('cilindro', color, u, v, 2 * r, 2 * r, r * 0.7);
  m.forma('cupula', color, u, v, 2 * r, 2 * r, r * 1.1, r * 0.7);
  m.caja(COLOR.hueco, u, v + r * 0.98, r * 0.5, 0.05, r * 0.55, r * 0.7);
}

/** El color de la fábrica del estilo (adobe, enlucido…). */
function fabrica(m: Marco, estilo: number): number {
  if (estilo <= 2) return COLOR.barro;
  if (estilo === 3) return m.azar(41) < 0.5 ? COLOR.adobe : COLOR.adobeClaro;
  return m.azar(41) < 0.7 ? COLOR.enlucido : COLOR.enlucidoSombra;
}

/**
 * Un cuerpo de edificio de `l` × `s` en el estilo: choza o casa larga en los bajos; adobe, enlucido o piedra con franja roja en los altos.
 * `plantas`: de 1 a 3 (solo cuenta desde el 3). Devuelve la altura de su tejado.
 */
function bloque(m: Marco, estilo: number, u: number, v: number, l: number, s: number, o: { plantas?: number; frente?: number; techo?: number; color?: number; franja?: number } = {}): number {
  const f = o.frente ?? 1, P = 1.05;
  if (estilo === 1) {
    if (l / s < 1.45) {
      choza(m, u, v, Math.min(l, s) / 2, { frente: f, techo: o.techo });
      return Math.min(l, s) * 0.6 + 0.9;
    }
    casaLarga(m, u, v, l, s, { techo: o.techo, alto: 0.75 });
    return 0.75 + s * 0.6;
  }
  if (estilo === 2) {
    casaLarga(m, u, v, l, s, { muro: COLOR.barro, techo: o.techo, alto: 0.85, abside: m.azar(51) < 0.3 });
    return 0.85 + s * 0.6;
  }
  const color = o.color ?? fabrica(m, estilo), plantas = Math.max(1, Math.min(3, o.plantas ?? 1)), franja = o.franja ?? COLOR.rojo;
  if (estilo >= 4) m.caja(estilo === 5 ? COLOR.piedraClara : COLOR.piedra, u, v, l + 0.06, s + 0.06, 0.32);
  let y = 0;
  for (let k = 0; k < plantas; k++) {
    const enc = k * 0.12, lk = l - enc * l * 0.6, sk = s - enc * s;
    const uk = u + (k ? (m.azar(60 + k) - 0.5) * (l - lk) : 0);
    y = casaPlana(m, uk, v - f * enc * s * 0.5, lk, sk, P, color, { frente: f, y, pretil: k === plantas - 1, trampilla: k === plantas - 1, vigas: estilo === 3 && k === 0 });
    if (estilo === 5) m.caja(franja, uk, v - f * enc * s * 0.5, lk + 0.04, sk + 0.04, 0.1, y - 0.22);
    if (estilo >= 4 && k > 0) ventanas(m, uk, v - f * enc * s * 0.5, lk, sk, y - P * 0.62, f, estilo === 5 ? franja : undefined);
  }
  return y + 0.16;
}

// ───────────────────────────── Las viviendas ─────────────────────────────

function vivienda(m: Marco, estilo: number): void {
  const L = m.L - 0.45, S = m.S - 0.45, f = m.azar(1) < 0.5 ? 1 : -1;
  if (estilo === 1) {
    const r = (Math.min(L, S) / 2) * m.entre(2, 0.78, 0.9);
    const u = (m.azar(3) - 0.5) * (L - 2 * r), v = (m.azar(4) - 0.5) * (S - 2 * r);
    choza(m, u, v, r, { techo: m.azar(5) < 0.4 ? COLOR.pajaVieja : COLOR.paja, frente: f });
    if (m.azar(6) < 0.4) lena(m, -u * 0.2 + (L / 2 - 0.35) * Math.sign(-u || 1), -f * (S / 2 - 0.3), 0.6, 2);
    if (m.azar(7) < 0.3) valla(m, -L / 2, f * S / 2, L / 2, f * S / 2, 0.4);
    return;
  }
  if (estilo === 2) {
    const k = m.azar(2);
    if (k < 0.55) casaLarga(m, 0, (m.azar(3) - 0.5) * S * 0.3, L * 0.96, S * m.entre(4, 0.52, 0.62), { muro: COLOR.barro, abside: m.azar(5) < 0.35, techo: m.azar(6) < 0.3 ? COLOR.pajaVieja : COLOR.paja });
    else if (k < 0.8) choza(m, 0, 0, (Math.min(L, S) / 2) * 0.88, { muro: COLOR.barro, frente: f });
    else casaPlana(m, 0, -f * S * 0.15, L * 0.8, S * 0.62, 0.95, COLOR.adobe, { frente: f, vigas: true });
    if (m.azar(8) < 0.3) almiar(m, L / 2 - 0.35, f * (S / 2 - 0.35), 0.3);
    return;
  }
  if (estilo >= 4 && m.azar(11) < 0.68) return viviendaAlta(m, estilo, L, S, f);
  // Desde el 3: la casa al fondo y un patio delante, con su tapia, su pérgola o su horno.
  const l = L * m.entre(2, 0.62, 0.92), s = S * m.entre(3, 0.48, 0.66);
  const u = (m.azar(4) - 0.5) * (L - l), v = -f * (S - s) / 2;
  const plantas = estilo === 3 ? (m.azar(5) < 0.25 ? 2 : 1) : estilo === 4 ? (m.azar(5) < 0.55 ? 2 : 1) : m.azar(5) < 0.3 ? 3 : 2;
  const techo = bloque(m, estilo, u, v, l, s, { plantas, frente: f });
  const patio = S - s, vp = f * (S / 2 - patio / 2);
  const color = fabrica(m, estilo);
  if (patio > 0.7 && m.azar(6) < 0.7) {
    tapia(m, -L / 2, f * S / 2, L / 2 - 0.7, f * S / 2, color, 0.45);
    tapia(m, -L / 2, v + f * s / 2, -L / 2, f * S / 2, color, 0.45);
    tapia(m, L / 2, v + f * s / 2, L / 2, f * S / 2, color, 0.45);
  }
  if (patio > 0.8) {
    const k = m.azar(7);
    if (k < 0.32) pergola(m, u, vp, Math.min(l, 1.6), patio * 0.7, 0, 0.85, m.azar(8) < 0.5);
    else if (k < 0.5) horno(m, L / 2 - 0.45, vp, 0.26);
    else if (k < 0.62) tinajas(m, -L / 2 + 0.35, vp, 3);
  } else if (m.azar(7) < 0.25) pergola(m, u, v, l * 0.5, s * 0.6, techo - 0.16, 0.7);
  if (estilo === 5 && m.azar(9) < 0.4 && patio > 0.6) {
    // un porche de columnas rojas delante de la casa
    for (const a of [-1, 1]) columna(m, u + a * (l / 2 - 0.2), v + f * (s / 2 + Math.min(0.6, patio * 0.6)), 1.0);
    m.caja(COLOR.enlucido, u, v + f * (s / 2 + Math.min(0.6, patio * 0.6) / 2), l, Math.min(0.6, patio * 0.6) + 0.15, 0.12, 1.0);
  }
  if (estilo >= 4 && m.azar(10) < 0.2) cuernos(m, u, v, techo);
}

/**
 * Las otras casas de los niveles 4 y 5 (una de cada tres sigue siendo la de bloque y patio): en L alrededor de un patio, dos cuerpos en
 * hilera de distinta altura, o de azotea con la planta de arriba retranqueada; de varios tonos de enlucido, con franjas rojas, ocres o
 * azules en el 5, escalera de fuera, tinajas y toldos en las azoteas.
 */
function viviendaAlta(m: Marco, estilo: number, L: number, S: number, f: number): void {
  const tonos = estilo === 5 ? [COLOR.enlucido, COLOR.enlucidoSombra, 0xeadcc0, 0xe6d2b4, 0xf0e8d8] : [COLOR.adobeClaro, COLOR.enlucido, COLOR.enlucidoSombra, 0xd6bb92];
  const tono = (k: number): number => tonos[Math.floor(m.azar(k) * tonos.length)]!;
  const fr = m.azar(13), franja = fr < 0.6 ? COLOR.rojo : fr < 0.85 ? COLOR.ocre : COLOR.azul;
  const alta = (k: number): number => (estilo === 4 ? (m.azar(k) < 0.5 ? 2 : 1) : m.azar(k) < 0.35 ? 3 : 2);
  const forma = m.azar(11) / 0.68, lado = m.azar(14) < 0.5 ? 1 : -1;
  const s = S * m.entre(3, 0.5, 0.62), v = -f * (S - s) / 2;
  let techo: number, azoteaU = 0, azoteaV = v, azoteaL = L * 0.4;
  if (forma < 0.4) {
    // en L: el cuerpo del fondo y un ala más baja que baja por un lado hasta la calle; el patio, en la esquina que queda
    const pl = alta(5), c = tono(6);
    techo = bloque(m, estilo, 0, v, L * 0.94, s, { plantas: pl, frente: f, color: c, franja });
    const la = L * m.entre(7, 0.32, 0.42), sa = S - s;
    bloque(m, estilo, lado * (L * 0.47 - la / 2), f * (S / 2 - sa / 2), la, sa, { plantas: Math.max(1, pl - 1), frente: f, color: c, franja });
    const up = -lado * (L * 0.47 - (L * 0.94 - la) / 2), vp = f * (S / 2 - sa / 2);
    tapia(m, -lado * L * 0.47, f * S / 2, up + lado * (L * 0.94 - la) / 2 - lado * 0.6, f * S / 2, c, 0.5);
    tapia(m, -lado * L * 0.47, f * (S / 2 - sa), -lado * L * 0.47, f * S / 2, c, 0.5);
    if (m.azar(8) < 0.5) pergola(m, up, vp, Math.min(1.6, L * 0.94 - la - 0.4), sa * 0.7, 0, 0.85, true);
    else { tinajas(m, up - lado * 0.4, vp, 3); horno(m, up + lado * 0.3, vp + f * 0.2, 0.24); }
    azoteaU = -lado * L * 0.2;
  } else if (forma < 0.72) {
    // dos cuerpos en hilera, uno más alto, de tonos distintos
    const l1 = L * m.entre(7, 0.45, 0.58), l2 = L * 0.96 - l1, u1 = -L * 0.48 + l1 / 2, u2 = L * 0.48 - l2 / 2;
    const p1 = alta(5), p2 = Math.max(1, p1 + (m.azar(9) < 0.5 ? -1 : 1));
    const s2 = s * m.entre(10, 0.85, 1.15);
    const t1 = bloque(m, estilo, u1, v, l1, s, { plantas: p1, frente: f, color: tono(6), franja });
    const t2 = bloque(m, estilo, u2, -f * (S - s2) / 2, l2, Math.min(S * 0.8, s2), { plantas: Math.min(3, p2), frente: f, color: tono(12), franja });
    techo = Math.min(t1, t2);
    azoteaU = t1 < t2 ? u1 : u2; azoteaL = Math.min(l1, l2) * 0.8;
    if (m.azar(8) < 0.5) tinajas(m, (m.azar(15) - 0.5) * L * 0.6, f * (S / 2 - 0.35), 3);
  } else {
    // de azotea: la planta baja entera y la de arriba retranqueada al fondo; la azotea de delante, con su toldo o su pérgola
    const c = tono(6), P = 1.05;
    m.caja(estilo === 5 ? COLOR.piedraClara : COLOR.piedra, 0, v, L * 0.94 + 0.06, s + 0.06, 0.32);
    const y1 = casaPlana(m, 0, v, L * 0.94, s, P, c, { frente: f, trampilla: false });
    if (estilo === 5) m.caja(franja, 0, v, L * 0.94 + 0.04, s + 0.04, 0.1, y1 - 0.22);
    const s2 = s * 0.5, v2 = v - f * (s - s2) / 2;
    techo = casaPlana(m, -lado * L * 0.12, v2, L * 0.6, s2, P, c, { frente: f, y: y1 });
    ventanas(m, -lado * L * 0.12, v2, L * 0.6, s2, techo - P * 0.62, f, estilo === 5 ? franja : undefined);
    if (estilo === 5) m.caja(franja, -lado * L * 0.12, v2, L * 0.6 + 0.04, s2 + 0.04, 0.1, techo - 0.22);
    azoteaU = lado * L * 0.25; azoteaV = v + f * s * 0.25; azoteaL = L * 0.36;
    pergola(m, azoteaU, azoteaV, azoteaL, s * 0.4, y1, 0.75, m.azar(8) < 0.4);
    techo = y1;
  }
  // la escalera de fuera, pegada a un costado, hasta la primera azotea
  if (m.azar(16) < 0.45) {
    const n = 5, paso = 0.2, u0 = lado * (L / 2 - 0.12), c = tono(6);
    for (let i = 0; i < n; i++) m.caja(c, u0, v + f * (s / 2 + 0.05) - f * (i + 0.5) * paso * 1.3, 0.22, paso * 1.3, ((i + 1) * 1.0) / n, 0);
  }
  // en la azotea, unas tinajas o un toldo
  const k = m.azar(17);
  if (k < 0.3) tinajas(m, azoteaU - 0.3, azoteaV, 2 + Math.floor(m.azar(18) * 2), COLOR.barro, techo);
  else if (k < 0.5) {
    const t = COLOR.toldo[Math.floor(m.azar(19) * COLOR.toldo.length)]!, du = azoteaL / 2 - 0.08, dv = Math.min(0.5, s * 0.3);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, azoteaU + a * du, azoteaV + b * dv, 0.7, 0.05, techo);
    m.caja(t, azoteaU, azoteaV, azoteaL, 2 * dv + 0.1, 0.03, techo + 0.7);
  }
  if (estilo === 5 && m.azar(10) < 0.25) cuernos(m, azoteaU, v, techo);
}

// ───────────────────────────── El gobierno y los grandes ─────────────────────────────

/** El Centro Urbano y el Palacio: de la gran choza del jefe al palacio de patio central. */
function palacio(m: Marco, estilo: number): void {
  const L = m.L - 0.6, S = m.S - 0.6;
  if (estilo === 1) {
    choza(m, 0, 0, Math.min(L, S) * 0.27, { alto: 1.0, frente: 1 });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1]] as const) choza(m, a * L * 0.33, b * S * 0.33, Math.min(L, S) * 0.1, { frente: -b });
    graneroEnPilotes(m, L * 0.33, S * 0.33, 1.1, 0.9);
    cercoPostes(m, L, S);
    return;
  }
  if (estilo === 2) {
    casaLarga(m, 0, -S * 0.1, L * 0.78, S * 0.42, { muro: COLOR.madera, alto: 1.25, techo: COLOR.paja });
    graneroEnPilotes(m, L * 0.36, S * 0.34, 1.2, 1.0);
    choza(m, -L * 0.36, S * 0.33, Math.min(L, S) * 0.11, { muro: COLOR.barro, frente: -1 });
    lena(m, 0, S * 0.36, 1.2, 3);
    cercoPostes(m, L, S);
    return;
  }
  if (estilo <= 4) {
    // megarón: la sala con su pórtico de dos columnas, alas alrededor de un patio
    const c = fabrica(m, estilo), patioL = L * 0.42, patioS = S * 0.38;
    m.losa(estilo === 4 ? COLOR.losa : COLOR.tierra, 0, S * 0.12, patioL, patioS, 0.04);
    bloque(m, estilo, 0, -S * 0.28, L * 0.5, S * 0.36, { plantas: estilo === 4 ? 2 : 1, frente: 1 });
    for (const a of [-1, 1]) columna(m, a * L * 0.12, -S * 0.28 + S * 0.18 + 0.35, 1.1, 0, estilo === 4);
    m.caja(c, 0, -S * 0.28 + S * 0.18 + 0.2, L * 0.5, 0.55, 0.14, 1.1);
    for (const a of [-1, 1]) bloque(m, estilo, a * L * 0.36, S * 0.05, L * 0.24, S * 0.62, { plantas: 1 + (m.azar(70 + a) < 0.5 ? 1 : 0), frente: 1 });
    bloque(m, estilo, 0, S * 0.4, L * 0.46, S * 0.18, { plantas: 1, frente: -1 });
    if (estilo === 4) for (const a of [-1, 1]) cuernos(m, a * L * 0.15, -S * 0.32, estilo === 4 ? 2.4 : 1.3);
    return;
  }
  // 5, Cnosos: bloques escalonados de dos y tres plantas alrededor de un patio enlosado, pórticos rojos, pozos de luz y cuernos
  const pl = L * 0.4, ps = S * 0.34;
  m.losa(COLOR.losa, 0, 0, pl, ps, 0.05);
  const alas: [number, number, number, number, number][] = [
    [0, -S * 0.34, L * 0.92, S * 0.3, 3], [0, S * 0.36, L * 0.92, S * 0.26, 2], [-L * 0.36, 0, L * 0.24, ps + 0.1, 2], [L * 0.36, 0, L * 0.24, ps + 0.1, 3],
  ];
  alas.forEach(([u, v, l, s, n], k) => {
    const alto = bloque(m, 5, u, v, l, s, { plantas: n, frente: v ? -Math.sign(v) : -Math.sign(u) });
    if (k < 2) for (let i = 0; i < 3; i++) cuernos(m, u - l * 0.3 + i * l * 0.3, v - Math.sign(v) * s * 0.3, alto);
  });
  // pórticos de columnas rojas en los lados largos del patio
  for (const a of [-1, 1]) {
    const v = a * (ps / 2 - 0.25);
    const n = Math.max(3, Math.round(pl / 1));
    for (let i = 0; i < n; i++) columna(m, -pl / 2 + 0.3 + ((pl - 0.6) * i) / (n - 1), v, 1.1);
    m.caja(COLOR.enlucido, 0, v + a * 0.2, pl, 0.6, 0.14, 1.1);
    m.caja(COLOR.rojo, 0, v + a * 0.2, pl + 0.02, 0.62, 0.06, 1.14);
  }
  // la escalinata a un lado
  for (let k = 0; k < 4; k++) m.caja(COLOR.piedraClara, -pl / 2 - 0.4 + k * 0.01, ps / 2 + 0.2 + k * 0.18, 0.9, 0.2, 0.15 + k * 0.15);
}

/** Una empalizada de postes alrededor de la huella, con su puerta en +v. */
function cercoPostes(m: Marco, L: number, S: number): void {
  const a = -L / 2 - 0.1, b = L / 2 + 0.1, c = -S / 2 - 0.1, d = S / 2 + 0.1;
  const tramo = (u0: number, v0: number, u1: number, v1: number): void => {
    const l = Math.hypot(u1 - u0, v1 - v0), n = Math.max(2, Math.round(l / 0.22));
    for (let i = 0; i <= n; i++) m.poste(COLOR.madera, u0 + ((u1 - u0) * i) / n, v0 + ((v1 - v0) * i) / n, 0.7 + 0.1 * hash3(i, Math.round(u0 * 10), Math.round(v0 * 10)), 0.13);
  };
  tramo(a, c, b, c);
  tramo(a, c, a, d);
  tramo(b, c, b, d);
  tramo(a, d, -0.6, d);
  tramo(0.6, d, b, d);
}

/** La Sala del Consejo: la sala con su pórtico (de postes en los bajos, de columnas en los altos). */
function salaConsejo(m: Marco, estilo: number): void {
  const L = m.L - 0.5, S = m.S - 0.5;
  if (estilo <= 2) {
    casaLarga(m, -L * 0.08, 0, L * 0.82, S * 0.7, { muro: estilo === 1 ? COLOR.madera : COLOR.barro, alto: 1.1 });
    for (const a of [-1, 1]) m.poste(COLOR.madera, L / 2 - 0.15, a * S * 0.25, 1.0, 0.14);
    return;
  }
  const alto = bloque(m, estilo, -L * 0.1, 0, L * 0.78, S * 0.78, { plantas: estilo >= 4 ? 2 : 1, frente: 1 });
  const n = Math.max(2, Math.round(S / 1.1));
  for (let i = 0; i < n; i++) {
    const v = -S * 0.36 + (S * 0.72 * i) / Math.max(1, n - 1);
    if (estilo >= 4) columna(m, L / 2 - 0.2, v, 1.1);
    else m.poste(COLOR.madera, L / 2 - 0.2, v, 1.1, 0.16);
  }
  m.caja(fabrica(m, estilo), L / 2 - 0.25, 0, 0.6, S * 0.8, 0.14, 1.1);
  if (estilo === 5) cuernos(m, -L * 0.1, 0, alto);
}

/** La Maravilla: un túmulo de piedra en los bajos; un templo escalonado en los altos. */
function maravilla(m: Marco, estilo: number): void {
  const L = m.L - 0.6, S = m.S - 0.6, lado = Math.min(L, S);
  if (estilo <= 2) {
    m.forma('cupula', COLOR.talud, 0, 0, lado * 0.9, lado * 0.9, lado * 0.3);
    m.forma('cilindro', COLOR.piedra, 0, 0, lado * 0.95, lado * 0.95, 0.3);
    m.caja(COLOR.piedraOscura, 0, lado * 0.45, 0.6, 1.2, 0.9);
    return;
  }
  const piedra = estilo >= 4 ? COLOR.piedraClara : COLOR.adobe;
  let y = 0;
  for (let k = 0; k < 4; k++) {
    const f = 1 - k * 0.2, h = 0.8 - k * 0.08;
    m.caja(piedra, 0, 0, L * f, S * f, h, y);
    y += h;
  }
  // el santuario arriba, con columnas rojas
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) columna(m, a * L * 0.14, b * S * 0.12, 1.1, y, estilo >= 4);
  m.caja(estilo >= 4 ? COLOR.enlucido : COLOR.adobeClaro, 0, 0, L * 0.34, S * 0.3, 0.16, y + 1.1);
  if (estilo >= 4) cuernos(m, 0, 0, y + 1.26);
  // la escalinata por delante (+v)
  for (let k = 0; k < 6; k++) m.caja(piedra, 0, S * 0.5 - 0.15 - k * 0.22, Math.min(1.4, L * 0.2), 0.24, 0.3 + k * 0.42);
}

// ───────────────────────────── Almacenes, granjas y talleres ─────────────────────────────

function almacen(m: Marco, estilo: number): void {
  const L = m.L - 0.45, S = m.S - 0.45, f = m.azar(1) < 0.5 ? 1 : -1;
  if (estilo <= 2) {
    casaLarga(m, 0, -f * S * 0.12, L * 0.94, S * 0.66, { muro: COLOR.madera, alto: 1.0 });
    lena(m, -L * 0.2, f * (S / 2 - 0.2), 0.8, 2, 0);
    tinajas(m, L * 0.1, f * (S / 2 - 0.2), 3);
    return;
  }
  bloque(m, estilo, 0, -f * S * 0.1, L * 0.94, S * 0.72, { plantas: estilo >= 4 ? 2 : 1, frente: f });
  tinajas(m, -L / 2 + 0.3, f * (S / 2 - 0.15), Math.max(2, Math.floor(L / 0.6)), estilo >= 4 ? COLOR.ocre : COLOR.barro);
}

function granero(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4;
  if (estilo <= 2) {
    const n = L > 4 ? 3 : L > 2.4 ? 2 : 1;
    for (let i = 0; i < n; i++) graneroEnPilotes(m, -L / 2 + (L * (i + 0.5)) / n, 0, Math.min(1.3, (L / n) * 0.75), Math.min(1.2, S * 0.6));
    return;
  }
  // silos de colmena en fila (la aldea en ladera); en los altos, también la nave del granero
  const color = estilo >= 4 ? COLOR.enlucidoSombra : COLOR.adobe;
  const r = Math.min(0.7, S * 0.26), n = Math.max(2, Math.floor(L / (2 * r + 0.25)));
  for (let i = 0; i < n; i++) silo(m, -L / 2 + (L * (i + 0.5)) / n, S * 0.22, r, color);
  if (estilo >= 4) bloque(m, estilo, 0, -S * 0.28, L * 0.9, S * 0.36, { frente: 1 });
}

/** La granja: el campo labrado en surcos (el color del cultivo en el suelo y sus filas en relieve), su valla o su tapia, la choza del campo y un almiar. */
function granja(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3, trigo = m.azar(1) < 0.5;
  const n = Math.max(3, Math.floor(S / 0.55));
  for (let i = 0; i < n; i++) m.losa(trigo ? COLOR.trigo : COLOR.cultivo, 0, -S / 2 + 0.3 + ((S - 0.6) * i) / (n - 1), L - 0.5, 0.26, 0.12);
  if (estilo <= 2) cerco(m, 0, 0, L, S, false);
  else cerco(m, 0, 0, L, S, true, estilo >= 4 ? COLOR.piedraClara : COLOR.piedra);
  const ch = Math.min(0.8, S * 0.15);
  if (estilo <= 2) choza(m, L / 2 - ch - 0.3, -S / 2 + ch + 0.3, ch, { frente: 1 });
  else casaPlana(m, L / 2 - 0.9, -S / 2 + 0.7, 1.2, 0.9, 0.9, fabrica(m, estilo), { frente: 1 });
  almiar(m, -L / 2 + 0.7, -S / 2 + 0.7, 0.4);
}

function lenera(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4;
  // cobertizo abierto de postes
  const cl = L * 0.55, cs = S * 0.45, cu = -L / 2 + cl / 2, cv = -S / 2 + cs / 2;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, cu + a * (cl / 2 - 0.08), cv + b * (cs / 2 - 0.08), 0.95, 0.1);
  if (estilo <= 2) m.forma('aguas', COLOR.paja, cu, cv, cl + 0.2, cs + 0.3, cs * 0.55, 0.95);
  else m.caja(COLOR.madera, cu, cv, cl + 0.15, cs + 0.15, 0.1, 0.95);
  lena(m, cu, cv, cl * 0.8, 3);
  lena(m, L * 0.2, S * 0.25, L * 0.4, 3);
  for (let i = 0; i < 3; i++) m.forma('cilindro', COLOR.tronco, L * 0.3 - i * 0.5, -S * 0.15 + i * 0.2, 0.3, 0.3, 0.25);
}

function corral(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3, r = Math.min(L, S) / 2;
  const n = Math.max(12, Math.round((2 * Math.PI * r) / 0.4));
  for (let k = 0; k < n; k++) {
    if (k === 0) continue;
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    if (estilo >= 3) m.viga(COLOR.piedra, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, 0, 0.2, 0.5);
    else { m.poste(COLOR.madera, Math.cos(a0) * r, Math.sin(a0) * r, 0.55, 0.07); m.viga(COLOR.zarzo, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, 0.2, 0.05, 0.25); }
  }
  choza(m, -r * 0.45, -r * 0.4, r * 0.25, { frente: 1 });
  almiar(m, r * 0.4, -r * 0.35, 0.35);
}

function caballerizas(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4, s = S * 0.45, v = -S / 2 + s / 2;
  // la cuadra larga, abierta por delante con sus postes
  m.caja(estilo <= 2 ? COLOR.madera : fabrica(m, estilo), 0, v - s * 0.3, L, s * 0.4, 1.0);
  const n = Math.max(3, Math.round(L / 0.9));
  for (let i = 0; i < n; i++) m.poste(COLOR.madera, -L / 2 + 0.1 + ((L - 0.2) * i) / (n - 1), v + s / 2 - 0.08, 1.0, 0.1);
  if (estilo <= 2) m.forma('aguas', COLOR.paja, 0, v, L + 0.2, s + 0.3, s * 0.5, 1.0);
  else m.caja(fabrica(m, estilo), 0, v, L + 0.1, s + 0.1, 0.12, 1.0);
  // el cercado con el abrevadero y el heno
  cerco(m, 0, S / 2 - (S - s) / 2, L, S - s - 0.1, false);
  m.caja(COLOR.madera, -L * 0.25, S * 0.25, 1.0, 0.3, 0.25);
  m.losa(COLOR.agua, -L * 0.25, S * 0.25, 0.9, 0.2, 0.03, 0.25);
  almiar(m, L * 0.3, S * 0.25, 0.35);
}

/** Un taller: su casa al fondo y el patio de trabajo delante con `patio`. */
/**
 * Un taller: el cuerpo al fondo y el patio de trabajo delante. `patio` monta lo del patio con `pv(k)`, la v a la fracción `k` de su fondo
 * (0, contra la casa; 1, en la calle), y `f`, hacia dónde da (todo dentro de la huella).
 */
function taller(m: Marco, estilo: number, patio: (u: number, pv: (k: number) => number, l: number, s: number, f: number) => void): void {
  const L = m.L - 0.45, S = m.S - 0.45, f = m.azar(1) < 0.5 ? 1 : -1;
  const s = S * (S > 4 ? 0.45 : 0.55), l = L * (L > 4 ? 0.7 : 0.85);
  bloque(m, estilo, (m.azar(2) - 0.5) * (L - l), -f * (S - s) / 2, l, s, { frente: f, plantas: estilo >= 4 ? 2 : 1 });
  const borde = f * (-S / 2 + s), fondo = S - s;
  patio(0, (k) => borde + f * k * fondo, L, fondo, f);
}

/** Un cobertizo abierto de cuatro postes. */
function cobertizo(m: Marco, u: number, v: number, l: number, s: number, estilo: number, h = 1.0): void {
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, u + a * (l / 2 - 0.06), v + b * (s / 2 - 0.06), h, 0.09);
  if (estilo <= 2) m.forma('aguas', COLOR.paja, u, v, l + 0.2, s + 0.25, s * 0.5, h);
  else m.caja(COLOR.maderaOscura, u, v, l + 0.1, s + 0.1, 0.08, h);
}

function fundicion(m: Marco, estilo: number, grande: boolean): void {
  taller(m, estilo, (u, pv, l, s, f) => {
    const n = grande ? Math.max(2, Math.floor(l / 1.6)) : 1, d = Math.min(0.9, s * 0.7);
    for (let i = 0; i < n; i++) {
      const uu = u - l / 2 + (l * (i + 0.5)) / n, vv = pv(0.45);
      m.forma('cupula', COLOR.barro, uu, vv, d, d, 0.7);
      m.forma('cilindro', COLOR.barro, uu, vv, 0.26, 0.26, 1.3);
      m.caja(COLOR.fuego, uu, vv + f * d * 0.47, 0.22, 0.06, 0.16, 0.05);
    }
    m.forma('cono', COLOR.carbon, u + l * 0.35, pv(0.7), Math.min(0.7, s * 0.5), Math.min(0.7, s * 0.5), 0.4);
    m.forma('cono', COLOR.bronce, u - l * 0.35, pv(0.75), 0.5, 0.5, 0.28);
    if (s > 1.4) cobertizo(m, u, pv(0.5), Math.min(l, 2.2), Math.min(s * 0.85, 1.6), estilo, 1.4);
  });
}

function curtiduria(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s) => {
    const n = Math.max(2, Math.floor(l / 0.8)), d = Math.min(0.55, s * 0.45);
    for (let i = 0; i < n; i++) {
      m.forma('cilindro', COLOR.barro, u - l / 2 + (l * (i + 0.5)) / n, pv(0.3), d, d, 0.3);
      m.losa(i % 2 ? COLOR.tierraOscura : COLOR.cuero, u - l / 2 + (l * (i + 0.5)) / n, pv(0.3), d * 0.76, d * 0.76, 0.02, 0.29);
    }
    // tendederos con pieles
    for (const k of [-1, 1]) {
      const uu = u + k * l * 0.25, vv = pv(0.78);
      m.poste(COLOR.madera, uu - 0.5, vv, 0.9, 0.07);
      m.poste(COLOR.madera, uu + 0.5, vv, 0.9, 0.07);
      m.viga(COLOR.madera, uu - 0.5, vv, uu + 0.5, vv, 0.88, 0.05);
      m.caja(COLOR.cuero, uu, vv, 0.7, 0.03, 0.45, 0.42);
    }
  });
}

function armeria(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s, f) => {
    const h = Math.min(0.7, s * 0.6);
    m.forma('cupula', COLOR.barro, u - l * 0.25, pv(0.45), h, h, 0.5);
    m.caja(COLOR.fuego, u - l * 0.25, pv(0.45) + f * h * 0.47, 0.18, 0.05, 0.12, 0.04);
    m.caja(COLOR.negro, u, pv(0.45), 0.35, 0.2, 0.35);
    // un armero con lanzas y escudos
    const uu = u + l * 0.28, vv = pv(0.5);
    m.viga(COLOR.madera, uu - 0.5, vv, uu + 0.5, vv, 0.6, 0.06);
    for (let i = 0; i < 5; i++) m.forma('cilindro', COLOR.madera, uu - 0.4 + i * 0.2, vv - f * 0.05, 0.04, 0.04, 1.4, 0, 0, 0.15);
    for (const k of [-1, 1]) m.forma('cilindro', COLOR.cuero, uu + k * 0.3, vv + f * 0.12, 0.45, 0.45, 0.05, 0.3, 0, Math.PI / 2);
  });
}

function carpinteria(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s) => {
    for (let i = 0; i < 3; i++) m.caja(i % 2 ? COLOR.madera : COLOR.tronco, u - l * 0.15, pv(0.3), l * 0.55, 0.32, 0.16, i * 0.16);
    lena(m, u + l * 0.3, pv(0.35), 0.9, 2);
    // borriquetas
    for (const k of [-1, 1]) {
      m.caja(COLOR.maderaOscura, u + k * 0.3 - l * 0.15, pv(0.74), 0.08, Math.min(0.5, s * 0.4), 0.45);
    }
    m.caja(COLOR.madera, u - l * 0.15, pv(0.74), 1.0, 0.2, 0.06, 0.45);
    if (s > 1.4) cobertizo(m, u - l * 0.15, pv(0.5), Math.min(l * 0.7, 2.4), Math.min(s * 0.8, 1.4), estilo, 1.1);
  });
}

function barracon(m: Marco, estilo: number): void {
  const L = m.L - 0.45, S = m.S - 0.45, s = S * 0.42;
  if (estilo <= 2) casaLarga(m, 0, -S / 2 + s / 2, L, s, { muro: estilo === 1 ? COLOR.madera : COLOR.barro, alto: 0.95 });
  else bloque(m, estilo, 0, -S / 2 + s / 2, L, s, { frente: 1, plantas: estilo >= 4 ? 2 : 1 });
  // el patio de armas: postes de práctica y un armero
  const n = Math.max(2, Math.floor(L / 1.3));
  for (let i = 0; i < n; i++) {
    const u = -L / 2 + (L * (i + 0.5)) / n, v = S * 0.2;
    m.poste(COLOR.madera, u, v, 1.05, 0.12);
    m.viga(COLOR.madera, u - 0.3, v, u + 0.3, v, 0.75, 0.06);
  }
  m.viga(COLOR.madera, -L * 0.3, S / 2 - 0.2, L * 0.3, S / 2 - 0.2, 0.55, 0.06);
  for (let i = 0; i < 6; i++) m.forma('cilindro', COLOR.madera, -L * 0.25 + i * L * 0.1, S / 2 - 0.28, 0.04, 0.04, 1.3, 0, 0, 0.18);
}

function galeriaDeTiro(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4;
  // la calle de tiro a lo largo, con sus varas a los lados, las dianas al fondo y el puesto del tirador
  for (const a of [-1, 1]) valla(m, -L / 2, a * (S / 2 - 0.1), L / 2, a * (S / 2 - 0.1), 0.5);
  const n = Math.max(1, Math.floor(S / 1.1));
  for (let i = 0; i < n; i++) {
    const v = -S / 2 + (S * (i + 0.5)) / n;
    m.forma('cilindro', COLOR.heno, L / 2 - 0.4, v, 0.75, 0.75, 0.3, 0.2, Math.PI / 2, Math.PI / 2);
    m.forma('cilindro', COLOR.rojo, L / 2 - 0.56, v, 0.25, 0.25, 0.02, 0.45, Math.PI / 2, Math.PI / 2);
    m.poste(COLOR.madera, L / 2 - 0.3, v - 0.3, 0.6, 0.06);
    m.poste(COLOR.madera, L / 2 - 0.3, v + 0.3, 0.6, 0.06);
  }
  if (estilo <= 2) cobertizo(m, -L / 2 + 0.8, 0, 1.2, Math.min(S * 0.6, 1.8), estilo, 1.0);
  else bloque(m, estilo, -L / 2 + 0.75, 0, 1.2, Math.min(S * 0.6, 1.8), { frente: 1 });
}

function taberna(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s) => {
    if (s > 0.8) pergola(m, u, pv(0.5), Math.min(l, 2.6), s * 0.8, 0, 0.95, true);
    const n = Math.max(1, Math.floor(Math.min(l, 2.6) / 1.0)), banco = Math.min(0.33, s * 0.3);
    for (let i = 0; i < n; i++) {
      const uu = u - Math.min(l, 2.6) / 2 + (Math.min(l, 2.6) * (i + 0.5)) / n;
      m.caja(COLOR.madera, uu, pv(0.5), 0.6, 0.35, 0.08, 0.38);
      for (const k of [-1, 1]) m.caja(COLOR.maderaOscura, uu, pv(0.5) + k * banco, 0.55, 0.12, 0.22);
    }
    tinajas(m, u + l / 2 - 0.9, pv(0.2), 3, COLOR.ocre);
  });
}

/** Un puesto de mercado: mesa, cuatro postes y su toldo. */
function puesto(m: Marco, u: number, v: number, l: number, s: number, k: number): void {
  const toldo = COLOR.toldo[k % COLOR.toldo.length]!;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, u + a * (l / 2 - 0.05), v + b * (s / 2 - 0.05), 0.95, 0.06);
  m.caja(toldo, u, v, l + 0.1, s + 0.1, 0.05, 0.95, 0);
  m.caja(COLOR.madera, u, v, l * 0.8, s * 0.5, 0.06, 0.42);
  for (let i = 0; i < 3; i++) m.forma('cilindro', i % 2 ? COLOR.barro : COLOR.ocre, u - l * 0.25 + i * l * 0.25, v, 0.14, 0.14, 0.16, 0.48);
}

function mercado(m: Marco, estilo: number): void {
  const L = m.L - 0.5, S = m.S - 0.5;
  m.losa(estilo >= 4 ? COLOR.losa : COLOR.tierra, 0, 0, L, S, 0.03);
  if (estilo >= 4) {
    // una estoa: el pórtico largo con su cubierta, y los puestos delante
    const s = Math.min(1.4, S * 0.3), v = -S / 2 + s / 2;
    m.caja(COLOR.enlucido, 0, v - s * 0.3, L, s * 0.35, 1.2);
    const n = Math.max(3, Math.round(L / 1.0));
    for (let i = 0; i < n; i++) columna(m, -L / 2 + 0.2 + ((L - 0.4) * i) / (n - 1), v + s / 2 - 0.12, 1.2, 0, estilo === 5);
    m.caja(COLOR.enlucido, 0, v, L + 0.1, s + 0.1, 0.14, 1.2);
    if (estilo === 5) m.caja(COLOR.rojo, 0, v, L + 0.12, s + 0.12, 0.06, 1.24);
    const k = Math.max(1, Math.floor(L / 1.6));
    for (let i = 0; i < k; i++) puesto(m, -L / 2 + (L * (i + 0.5)) / k, S * 0.2, 1.0, 0.7, i + m.e.semilla);
    return;
  }
  const cu = Math.max(1, Math.floor(L / 1.6)), cv = Math.max(1, Math.floor(S / 1.6));
  for (let i = 0; i < cu; i++) for (let j = 0; j < cv; j++) {
    if (cu > 2 && cv > 2 && i > 0 && i < cu - 1 && j > 0 && j < cv - 1) continue;
    puesto(m, -L / 2 + (L * (i + 0.5)) / cu, -S / 2 + (S * (j + 0.5)) / cv, 1.0, 0.7, i * 7 + j + m.e.semilla);
  }
}

function puestoMercado(m: Marco): void {
  puesto(m, 0, 0, Math.min(m.L - 0.6, 1.6), Math.min(m.S - 0.6, 1.1), m.e.semilla);
}

function plaza(m: Marco, estilo: number): void {
  const L = m.L - 0.2, S = m.S - 0.2;
  if (estilo <= 2) {
    // un gran árbol y unas piedras para sentarse
    m.forma('cilindro', COLOR.tronco, 0, 0, 0.3, 0.3, 1.2);
    m.forma('copa', COLOR.roble, 0, 0, 2.2, 2.2, 1.9, 0.9);
    for (let k = 0; k < 6; k++) m.caja(COLOR.piedra, Math.cos(k) * 1.6, Math.sin(k) * 1.6, 0.5, 0.3, 0.3, 0, k);
    return;
  }
  m.losa(estilo >= 4 ? COLOR.losa : COLOR.adobeClaro, 0, 0, L, S, 0.05);
  m.caja(COLOR.piedraClara, 0, 0, 0.9, 0.9, 0.55);
  if (estilo >= 4) {
    cuernos(m, 0, 0, 0.55);
    // las gradas (el teatro de Cnosos) en un lado
    for (let k = 0; k < 3; k++) m.caja(COLOR.piedraClara, 0, -S / 2 + 0.25 + k * 0.3, L * 0.7, 0.3, 0.15 + k * 0.15);
  }
}

function plazaDeArmas(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3;
  m.losa(COLOR.tierra, 0, 0, L, S, 0.03);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    m.poste(COLOR.madera, a * (L / 2 - 0.2), b * (S / 2 - 0.2), 2.0, 0.08);
    m.caja(COLOR.rojo, a * (L / 2 - 0.2) + 0.25, b * (S / 2 - 0.2), 0.5, 0.03, 0.35, 1.6);
  }
  if (estilo >= 3) m.caja(COLOR.piedra, 0, -S / 2 + 0.4, 1.4, 0.8, 0.5);
}

function patioDeGremios(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4;
  m.losa(estilo >= 4 ? COLOR.losa : COLOR.adobeClaro, 0, 0, L, S, 0.04);
  for (const a of [-1, 1]) {
    const v = a * (S / 2 - 0.35);
    const n = Math.max(3, Math.round(L / 1.1));
    for (let i = 0; i < n; i++) {
      if (estilo >= 4) columna(m, -L / 2 + 0.2 + ((L - 0.4) * i) / (n - 1), v - a * 0.25, 1.1, 0, estilo === 5);
      else m.poste(COLOR.madera, -L / 2 + 0.2 + ((L - 0.4) * i) / (n - 1), v - a * 0.25, 1.1, 0.14);
    }
    m.caja(estilo >= 4 ? COLOR.enlucido : COLOR.adobe, 0, v, L, 0.7, 0.14, 1.1);
  }
  horno(m, 0, 0, 0.4);
}

function pozo(m: Marco): void {
  m.forma('cilindro', COLOR.piedra, 0, 0, 1.2, 1.2, 0.5);
  m.losa(COLOR.agua, 0, 0, 0.85, 0.85, 0.02, 0.44);
  for (const a of [-1, 1]) m.poste(COLOR.madera, a * 0.55, 0, 1.25, 0.08);
  m.viga(COLOR.madera, -0.6, 0, 0.6, 0, 1.2, 0.07);
  m.forma('cilindro', COLOR.barro, 0, 0, 0.18, 0.18, 0.2, 0.75);
}

function parque(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4;
  const n = Math.max(3, Math.round((L * S) / 3.5));
  for (let k = 0; k < n; k++) {
    const u = (m.azar(100 + k) - 0.5) * (L - 1), v = (m.azar(200 + k) - 0.5) * (S - 1);
    arbol(m, u, v, m.azar(300 + k), estilo);
  }
  m.caja(COLOR.piedra, 0, S * 0.3, 0.9, 0.25, 0.3);
}

/** Un árbol: olivo, ciprés o roble (más olivos y cipreses en los niveles altos). */
export function arbol(m: { forma: (f: Forma, color: number, u: number, v: number, l: number, s: number, h: number, y?: number) => void }, u: number, v: number, k: number, estilo: number): void {
  const t = estilo >= 3 ? k : k * 0.6 + 0.4;
  if (t < 0.4) {
    // olivo: tronco bajo y copa ancha y aplastada
    m.forma('cilindro', COLOR.tronco, u, v, 0.16, 0.16, 0.6);
    m.forma('copa', COLOR.olivo, u, v, 1.2, 1.2, 0.8, 0.45);
  } else if (t < 0.65) {
    // ciprés: alto y estrecho
    m.forma('cilindro', COLOR.tronco, u, v, 0.1, 0.1, 0.3);
    m.forma('cono', COLOR.cipres, u, v, 0.55, 0.55, 2.4, 0.15);
  } else {
    m.forma('cilindro', COLOR.tronco, u, v, 0.2, 0.2, 0.9);
    m.forma('copa', COLOR.roble, u, v, 1.6, 1.6, 1.4, 0.7);
  }
}

// ───────────────────────────── El campamento de mercenarios ─────────────────────────────

/**
 * Una tienda a dos aguas de `l` (a lo largo de la cumbrera) por `s` y alto `h`, con su centro en (u, v): la lona o las pieles hasta el suelo,
 * la entrada oscura en un testero con la puerta recogida a un lado, los dos postes de la cumbrera asomando y las estacas a lo largo de los
 * faldones. `deLado`: la cumbrera va a lo ancho de la huella; `entrada`: a qué testero (±1) da la puerta.
 */
function tiendaAguas(m: Marco, u: number, v: number, l: number, s: number, h: number, color: number, deLado: boolean, entrada: number): void {
  const P = (a: number, b: number): [number, number] => (deLado ? [u + b, v + a] : [u + a, v + b]);
  const giro = deLado ? Math.PI / 2 : 0;
  m.forma('aguas', color, u, v, l, s, h, 0, giro);
  // la entrada: un triángulo oscuro en el testero, y el faldón de la puerta recogido a un lado
  const [ex, ev] = P(entrada * (l / 2 + 0.015), 0);
  m.forma('aguas', COLOR.hueco, ex, ev, 0.03, s * 0.42, h * 0.6, 0, giro);
  const [fx, fv] = P(entrada * (l / 2 + 0.05), s * 0.2);
  m.forma('aguas', oscurecer(color, 0.85), fx, fv, 0.05, s * 0.2, h * 0.5, 0, giro);
  for (const a of [-1, 1]) {
    const [x, w] = P(a * (l / 2 + 0.03), 0);
    m.poste(COLOR.madera, x, w, h + 0.22, 0.06);
  }
  // las estacas de los faldones
  const n = Math.max(2, Math.round(l / 0.7));
  for (let i = 0; i < n; i++) for (const b of [-1, 1]) {
    const [x, w] = P(-l / 2 + (l * (i + 0.5)) / n, b * (s / 2 + 0.12));
    m.poste(COLOR.estaca, x, w, 0.14, 0.04);
  }
}

/** Una tienda redonda de pieles sobre varas (las puntas asoman por arriba), con la entrada hacia `frente` (±1 en v). */
function tiendaRedonda(m: Marco, u: number, v: number, r: number, h: number, color: number, frente: number): void {
  m.forma('cono', color, u, v, 2 * r, 2 * r, h);
  m.forma('cono', COLOR.madera, u, v, 0.3, 0.3, h * 0.28 + 0.32, h * 0.74);
  m.forma('aguas', COLOR.hueco, u, v + frente * r * 0.88, 0.05, 0.42, h * 0.34, 0, Math.PI / 2);
  // un cerco de piedras al pie, que sujeta las pieles
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    if (Math.abs(Math.sin(a) - frente) < 0.35) continue;
    m.caja(COLOR.piedra, u + Math.cos(a) * (r + 0.04), v + Math.sin(a) * (r + 0.04), 0.16, 0.12, 0.09, 0, a);
  }
}

/** La lumbre del campamento: un cerco de piedras, las brasas, la llama y unos troncos para sentarse. */
function fogata(m: Marco, u: number, v: number, troncos: number): void {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m.caja(COLOR.piedraOscura, u + Math.cos(a) * 0.27, v + Math.sin(a) * 0.27, 0.13, 0.1, 0.08, 0, a);
  }
  m.forma('cilindro', COLOR.carbon, u, v, 0.36, 0.36, 0.04);
  m.forma('cono', COLOR.fuego, u, v, 0.22, 0.22, 0.32, 0.04);
  // los troncos, tumbados alrededor (el cilindro tumbado va de su base hacia (−sen a, cos a)); solo los que caben en la huella
  const cabe = (x: number, y: number): boolean => Math.abs(x) <= m.L / 2 - 0.12 && Math.abs(y) <= m.S / 2 - 0.12;
  for (let k = 0, puestos = 0; k < 6 && puestos < troncos; k++) {
    const a = m.entre(60 + k, 0, Math.PI * 2), cx = u + Math.cos(a) * 0.68, cy = v + Math.sin(a) * 0.68, dx = -Math.sin(a) * 0.3, dy = Math.cos(a) * 0.3;
    if (!cabe(cx - dx, cy - dy) || !cabe(cx + dx, cy + dy)) continue;
    m.forma('cilindro', COLOR.tronco, cx - dx, cy - dy, 0.16, 0.16, 0.6, 0.08, a, Math.PI / 2);
    puestos++;
  }
}

/** Un armero de campaña: dos horquillas, la vara de través y las lanzas apoyadas; y un escudo redondo al pie. */
function armero(m: Marco, u: number, v: number, l: number): void {
  for (const a of [-1, 1]) m.poste(COLOR.madera, u + (a * l) / 2, v, 0.75, 0.06);
  m.viga(COLOR.madera, u - l / 2, v, u + l / 2, v, 0.7, 0.05);
  const n = Math.max(3, Math.round(l / 0.16));
  for (let i = 0; i < n; i++) m.forma('cilindro', COLOR.maderaOscura, u - l / 2 + 0.08 + ((l - 0.16) * i) / (n - 1), v + 0.12, 0.035, 0.035, 1.35, 0, 0, -0.16);
  m.forma('cilindro', m.azar(70) < 0.5 ? COLOR.cuero : COLOR.bronce, u + l / 2 + 0.25, v + 0.05, 0.5, 0.5, 0.05, 0.27, 0, Math.PI / 2 - 0.2);
}

/** El sitio de una tienda del campamento (una celda): una tienda grande, dos pequeñas o una redonda de pieles, su lumbre, su armero y sus fardos. */
function tienda(m: Marco): void {
  const L = m.L - 0.4, S = m.S - 0.4, f = m.azar(1) < 0.5 ? 1 : -1, k = m.azar(2);
  const color = (j: number): number => { const x = m.azar(j); return x < 0.45 ? COLOR.lona : x < 0.7 ? COLOR.lonaVieja : x < 0.88 ? COLOR.piel : COLOR.pielOscura; };
  if (k < 0.45) {
    // una tienda grande atrás y la lumbre delante
    const s = S * 0.52, l = L * 0.78;
    tiendaAguas(m, -L * 0.06, -f * (S / 2 - s / 2 - 0.05), l, s, 0.86, color(3), false, m.azar(4) < 0.5 ? 1 : -1);
    fogata(m, L * 0.22, f * (S / 2 - 0.42), 1 + Math.floor(m.azar(5) * 2));
    if (m.azar(6) < 0.55) armero(m, -L * 0.22, f * (S / 2 - 0.3), 0.9);
  } else if (k < 0.78) {
    // dos tiendas pequeñas, una al lado de otra, con la lumbre delante
    const l = L * 0.42, s = S * 0.36;
    for (const a of [-1, 1]) tiendaAguas(m, a * (L / 2 - s / 2 - 0.02), -0.15 * f, l, s, 0.62, color(10 + a), true, f);
    fogata(m, 0, f * (S / 2 - 0.5), 1);
    if (m.azar(7) < 0.5) m.caja(COLOR.cuero, 0, -f * (S / 2 - 0.25), 0.5, 0.32, 0.22, 0, m.azar(8));
  } else {
    // una tienda redonda de pieles
    const r = Math.min(L, S) * 0.3;
    tiendaRedonda(m, -L * 0.12, -f * S * 0.12, r, 1.35, m.azar(3) < 0.6 ? COLOR.piel : COLOR.pielOscura, f);
    fogata(m, L * 0.24, f * (S / 2 - 0.4), 1);
    if (m.azar(6) < 0.5) armero(m, L * 0.25, -f * (S / 2 - 0.35), 0.7);
  }
  // fardos y tinajas de la mesnada
  if (m.azar(9) < 0.5) tinajas(m, -L / 2 + 0.3, f * (S / 2 - 0.3), 2, COLOR.barro);
}

// ───────────────────────────── Los pueblos extractores ─────────────────────────────

/** Una peña: un canto irregular medio hundido en el suelo (asoma un 70 % de su alto). */
function pena(m: Marco, color: number, u: number, v: number, l: number, s: number, h: number, giro = 0): void {
  m.forma('copa', color, u, v, l, s, h, -h * 0.3, giro);
}

/**
 * La boca de una mina en su celda: un cerrillo de peñas al fondo (de la roca de caja de su metal, con matas y vetas del mineral), el frente
 * cortado con la entrada apuntalada (el hueco oscuro, dos postes y el dintel, y su tejadillo desde el nivel 2) y la senda que sale de ella;
 * delante, la escombrera, el mineral apartado en un montón y en cestos, el yunque de piedra donde se machaca y los puntales de repuesto.
 */
function bocamina(m: Marco, tipo: string, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4, f = m.azar(1) < 0.5 ? 1 : -1, c = COLOR.mina[tipo] ?? COLOR.mina.minaCobre!;
  const lado = m.azar(2) < 0.5 ? 1 : -1;
  // el cerrillo: tres peñas que se montan, de roca teñida por su metal, con matas encima
  const hv = -f * S * 0.22, roca = mezclar(COLOR.roca, c.escombrera, 0.3);
  pena(m, roca, 0, hv, 1.8, 1.3, 1.15, (m.azar(5) - 0.5) * 0.6);
  pena(m, mezclar(roca, COLOR.piedraOscura, 0.4), -lado * 0.68, hv - f * 0.12, 1.15, 1.0, 0.95, (m.azar(6) - 0.5) * 0.6);
  pena(m, mezclar(roca, COLOR.talud, 0.35), lado * 0.74, hv + f * 0.02, 1.0, 0.9, 0.7, (m.azar(7) - 0.5) * 0.6);
  m.forma('copa', COLOR.seto, -lado * 0.55, hv - f * 0.25, 0.5, 0.42, 0.26, 0.56);
  m.forma('copa', COLOR.seto, lado * 0.15, hv - f * 0.35, 0.36, 0.3, 0.2, 0.7);
  // el frente cortado a escuadra, con las vetas del mineral, y la entrada apuntalada
  const fv = hv + f * 0.5;
  m.caja(COLOR.piedraOscura, 0, fv, 1.1, 0.36, 0.78);
  for (const [u, y] of [[-0.38, 0.5], [0.4, 0.28], [0.24, 0.66]] as const) m.caja(c.mineral, u, fv + f * 0.18, 0.22, 0.03, 0.08, y, 0.4);
  m.caja(COLOR.negro, 0, fv + f * 0.18, 0.46, 0.04, 0.6);
  for (const a of [-1, 1]) m.poste(COLOR.madera, a * 0.29, fv + f * 0.25, 0.7, 0.09);
  m.caja(COLOR.madera, 0, fv + f * 0.25, 0.78, 0.13, 0.11, 0.66);
  if (estilo >= 2) m.forma('aguas', estilo >= 3 ? COLOR.adobe : COLOR.paja, 0, fv + f * 0.32, 0.96, 0.4, 0.24, 0.77);
  // la senda de la boca hasta el borde
  const sv0 = fv + f * 0.25, sv1 = f * (S / 2);
  m.losa(mezclar(c.escombrera, COLOR.tierra, 0.5), 0, (sv0 + sv1) / 2, 0.6, Math.abs(sv1 - sv0), 0.02);
  // la escombrera a un lado de la senda, el mineral al otro
  m.forma('cono', c.escombrera, lado * L * 0.3, f * S * 0.24, 1.0, 0.9, 0.5);
  m.forma('cono', mezclar(c.escombrera, COLOR.roca, 0.5), lado * L * 0.4, f * S * 0.39, 0.55, 0.5, 0.28);
  m.forma('cono', c.mineral, -lado * L * 0.26, f * S * 0.3, 0.5, 0.46, 0.28);
  for (let i = 0; i < 2; i++) {
    const u = -lado * (L * 0.26 - 0.4 - i * 0.26), v = f * (S * 0.3 + 0.3);
    m.forma('cilindro', COLOR.cuero, u, v, 0.22, 0.22, 0.2);
    m.forma('cono', c.mineral, u, v, 0.18, 0.18, 0.08, 0.2);
  }
  // el yunque de piedra con su percutor, y los puntales de repuesto
  m.caja(COLOR.piedraOscura, -lado * L * 0.38, f * S * 0.12, 0.4, 0.32, 0.22, 0, m.azar(3));
  m.forma('cupula', COLOR.piedraClara, -lado * L * 0.38, f * S * 0.12, 0.14, 0.12, 0.08, 0.22);
  lena(m, lado * (L / 2 - 0.4), f * S * 0.06, 0.7, 2, Math.PI / 2 + 0.1);
}

/**
 * La cantera en su celda: un crestón de peñas al fondo con el frente cortado en dos gradas de piedra recién sacada (más clara); delante, el suelo
 * de polvo de piedra, los bloques ya sacados (uno sobre su rastra de madera), los cascotes y la palanca apoyada.
 */
function cantera(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4, f = m.azar(1) < 0.5 ? 1 : -1;
  const tono = (k: number): number => mezclar(COLOR.rocaClara, COLOR.roca, 0.15 + 0.35 * m.azar(10 + k));
  // el crestón: peñas que se montan, y encima alguna mata
  const hv = -f * S * 0.27;
  pena(m, COLOR.roca, -0.6, hv, 1.3, 1.05, 1.05, (m.azar(5) - 0.5) * 0.6);
  pena(m, mezclar(COLOR.roca, COLOR.piedraOscura, 0.35), 0.52, hv - f * 0.06, 1.35, 1.0, 1.15, (m.azar(6) - 0.5) * 0.6);
  pena(m, mezclar(COLOR.roca, COLOR.talud, 0.3), 0, hv - f * 0.3, 1.3, 0.7, 0.85, (m.azar(7) - 0.5) * 0.6);
  m.forma('copa', COLOR.seto, -0.75, hv - f * 0.2, 0.46, 0.38, 0.24, 0.62);
  m.forma('copa', COLOR.seto, 0.7, hv - f * 0.25, 0.32, 0.28, 0.18, 0.7);
  // el frente cortado: la grada alta metida en el crestón y la baja delante, de roca clara recién sacada
  m.caja(tono(1), 0, hv + f * 0.22, 1.6, 0.62, 0.62, 0, m.entre(2, -0.05, 0.05));
  m.caja(tono(2), 0.05, hv + f * 0.66, 1.15, 0.34, 0.3, 0, m.entre(3, -0.07, 0.07));
  // el suelo de la cantera, de polvo de piedra
  m.losa(mezclar(COLOR.rocaClara, COLOR.tierra, 0.45), 0, f * S * 0.24, L * 0.94, S * 0.48, 0.02);
  // los bloques sacados, uno sobre la rastra
  const lado = m.azar(4) < 0.5 ? 1 : -1, rv = f * (S / 2 - 0.34);
  for (const a of [-1, 1]) m.viga(COLOR.madera, lado * L * 0.24 - 0.4, rv + a * 0.18, lado * L * 0.24 + 0.4, rv + a * 0.18, 0.02, 0.08, 0.08);
  m.caja(COLOR.rocaClara, lado * L * 0.24, rv, 0.62, 0.36, 0.3, 0.1);
  for (let k = 0; k < 3; k++) m.caja(tono(40 + k), -lado * (L * 0.1 + k * 0.36), f * (S * 0.24 + (k % 2) * 0.2), 0.36, 0.28, 0.24, 0, m.azar(50 + k) * 0.6);
  // cascotes al pie de las gradas, y la palanca apoyada en la grada baja
  for (let k = 0; k < 5; k++) m.forma('copa', tono(60 + k), (m.azar(60 + k) - 0.5) * L * 0.7, hv + f * (0.95 + m.azar(70 + k) * 0.2), 0.22, 0.18, 0.12);
  m.forma('cilindro', COLOR.madera, 0.62, hv + f * 0.9, 0.06, 0.06, 1.0, 0, 0, -f * 0.5);
  if (estilo >= 3) m.caja(COLOR.adobe, lado * (L / 2 - 0.3), f * (S / 2 - 0.25), 0.45, 0.4, 0.45);
}

// ───────────────────────────── Estados: obra, mejora, cola, ruina ─────────────────────────────

/** Lo alto que llega un edificio de este tipo en este estilo (para el armazón de su obra). */
function altoDe(tipo: string, estilo: number): number {
  if (['granja', 'plaza', 'plazaDeArmas', 'parque', 'pozo', 'puestoMercado', 'corral', 'lenera', 'galeriaDeTiro'].includes(tipo)) return 0.9;
  if (['centroUrbano', 'palacio', 'maravilla', 'salaConsejo'].includes(tipo)) return estilo <= 2 ? 1.9 : 2.4;
  return estilo <= 2 ? 1.5 : 1.15;
}

/** Los tipos que son terreno abierto: su obra son estacas y su avance se ve en el suelo. */
const ABIERTOS = new Set(['granja', 'plaza', 'plazaDeArmas', 'parque', 'patioDeGremios', 'corral', 'galeriaDeTiro']);

/** Una obra: cimientos, postes que aparecen y muros que suben con el avance, las vigas arriba y el material al lado. */
function armazon(m: Marco, e: EdificioEnVista): void {
  const a = Math.max(0, Math.min(1, e.avance ?? 0.5)), H = altoDe(e.tipo, e.estilo);
  const L = m.L - 0.6, S = m.S - 0.6;
  if (ABIERTOS.has(e.tipo)) {
    estacas(m, m.L - 0.3, m.S - 0.3);
    // lo que ya está hecho, de un lado a otro con el avance
    m.losa(COLOR.tierra, -L / 2 + (L * a) / 2, 0, L * a, S, 0.04);
    monton(m, L / 2 - 0.5, S / 2 - 0.5, 1 - a);
    return;
  }
  const l = Math.min(L, Math.max(1.4, L * 0.85)), s = Math.min(S, Math.max(1.2, S * 0.7));
  m.caja(COLOR.piedra, 0, 0, l + 0.1, s + 0.1, 0.16);
  const nl = Math.max(2, Math.round(l / 1.1)), ns = Math.max(2, Math.round(s / 1.1));
  const postes: [number, number][] = [];
  for (let i = 0; i <= nl; i++) postes.push([-l / 2 + (l * i) / nl, -s / 2], [-l / 2 + (l * i) / nl, s / 2]);
  for (let j = 1; j < ns; j++) postes.push([-l / 2, -s / 2 + (s * j) / ns], [l / 2, -s / 2 + (s * j) / ns]);
  const visibles = Math.ceil(postes.length * Math.min(1, 0.15 + a * 2));
  postes.slice(0, visibles).forEach(([u, v]) => m.poste(COLOR.madera, u, v, H, 0.11));
  const muro = H * Math.max(0, Math.min(1, (a - 0.25) / 0.6));
  if (muro > 0.05) {
    const t = 0.16;
    m.caja(COLOR.adobeFresco, 0, -s / 2, l, t, muro, 0.16);
    m.caja(COLOR.adobeFresco, 0, s / 2, l, t, muro * 0.8, 0.16);
    m.caja(COLOR.adobeFresco, -l / 2, 0, t, s, muro * 0.9, 0.16);
    m.caja(COLOR.adobeFresco, l / 2, 0, t, s, muro * 0.7, 0.16);
  }
  if (a > 0.5) {
    m.viga(COLOR.madera, -l / 2, -s / 2, l / 2, -s / 2, H, 0.1);
    m.viga(COLOR.madera, -l / 2, s / 2, l / 2, s / 2, H, 0.1);
    m.viga(COLOR.madera, -l / 2, -s / 2, -l / 2, s / 2, H, 0.1);
    m.viga(COLOR.madera, l / 2, -s / 2, l / 2, s / 2, H, 0.1);
  }
  if (a > 0.75) for (let i = 1; i < nl; i++) m.viga(COLOR.maderaOscura, -l / 2 + (l * i) / nl, -s / 2, -l / 2 + (l * i) / nl, s / 2, H + 0.1, 0.07);
  // una escalera de mano apoyada
  m.forma('caja', COLOR.madera, l / 2 + 0.12, s * 0.2, 0.06, 0.4, H * 1.05, 0, 0, -0.25);
  monton(m, -l / 2 + 0.35, s / 2 + Math.min(0.3, (m.S - s) / 2 - 0.05), 1 - a * 0.8);
}

/** El material apilado de una obra: adobes y maderos, menos cuanto más avanza (`cuanto` de 0 a 1). */
function monton(m: Marco, u: number, v: number, cuanto: number): void {
  const n = Math.max(1, Math.round(4 * cuanto));
  for (let k = 0; k < n; k++) m.caja(COLOR.adobeFresco, u + (k % 2) * 0.32, v, 0.3, 0.2, 0.14, Math.floor(k / 2) * 0.14);
  if (cuanto > 0.3) m.caja(COLOR.madera, u + 0.25, v - 0.28, 0.9, 0.14, 0.1);
}

/** Estacas y cuerda alrededor de la huella: lo que espera en la cola (solo en la plaza propia). */
function estacas(m: Marco, L: number, S: number): void {
  const pts: [number, number][] = [[-L / 2, -S / 2], [L / 2, -S / 2], [L / 2, S / 2], [-L / 2, S / 2]];
  for (const [u, v] of pts) m.poste(COLOR.estaca, u, v, 0.55, 0.07);
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = pts[i]!, [u1, v1] = pts[(i + 1) % 4]!;
    m.viga(COLOR.cuerda, u0, v0, u1, v1, 0.42, 0.025);
  }
}

/** Andamios alrededor del modelo (una mejora en obra). */
function andamios(m: Marco, e: EdificioEnVista): void {
  const H = altoDe(e.tipo, e.estilo) + 0.5, L = m.L - 0.3, S = m.S - 0.3;
  const u = L / 2 - 0.05, v = S / 2 - 0.05;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1]] as const) m.poste(COLOR.estaca, a * u, b * v, H, 0.07);
  for (const y of [H * 0.45, H * 0.9]) {
    m.viga(COLOR.estaca, -u, -v, u, -v, y, 0.06);
    m.viga(COLOR.estaca, u, -v, u, v, y, 0.06);
  }
  monton(m, -u + 0.3, v - 0.25, 0.6);
}

/** Una ruina: muros bajos rotos, escombro y vigas quemadas. */
function ruina(m: Marco): void {
  const L = m.L - 0.6, S = m.S - 0.6;
  const lados: [number, number, number, number][] = [[-L / 2, -S / 2, L / 2, -S / 2], [L / 2, -S / 2, L / 2, S / 2], [L / 2, S / 2, -L / 2, S / 2], [-L / 2, S / 2, -L / 2, -S / 2]];
  lados.forEach(([u0, v0, u1, v1], k) => {
    const n = 3;
    for (let i = 0; i < n; i++) {
      if (m.azar(400 + k * 10 + i) < 0.35) continue;
      const t0 = i / n, t1 = (i + 0.85) / n;
      m.viga(COLOR.ruina, u0 + (u1 - u0) * t0, v0 + (v1 - v0) * t0, u0 + (u1 - u0) * t1, v0 + (v1 - v0) * t1, 0, 0.18, 0.15 + 0.55 * m.azar(500 + k * 10 + i));
    }
  });
  for (let k = 0; k < 7; k++) m.caja(k % 3 ? COLOR.ruina : COLOR.quemado, (m.azar(600 + k) - 0.5) * L * 0.8, (m.azar(700 + k) - 0.5) * S * 0.8, 0.3, 0.25, 0.18, 0, m.azar(800 + k) * 3);
  for (let k = 0; k < 3; k++) m.forma('caja', COLOR.quemado, (m.azar(900 + k) - 0.5) * L * 0.6, (m.azar(950 + k) - 0.5) * S * 0.6, Math.min(L, 2), 0.1, 0.1, 0.05, m.azar(990 + k) * 3, 0.15);
}

// ───────────────────────────── El reparto ─────────────────────────────

/** El modelo terminado de un edificio, por su tipo. */
function terminado(m: Marco, tipo: string, estilo: number): void {
  switch (tipo) {
    case 'vivienda': return vivienda(m, estilo);
    case 'centroUrbano': return palacio(m, estilo);
    case 'palacio': return palacio(m, Math.max(4, estilo));
    case 'salaConsejo': return salaConsejo(m, estilo);
    case 'maravilla': return maravilla(m, estilo);
    case 'almacen': return almacen(m, estilo);
    case 'granero': return granero(m, estilo);
    case 'granja': return granja(m, estilo);
    case 'lenera': return lenera(m, estilo);
    case 'corral': return corral(m, estilo);
    case 'caballerizas': return caballerizas(m, estilo);
    case 'fundicion': return fundicion(m, estilo, false);
    case 'granFundicion': return fundicion(m, estilo, true);
    case 'curtiduria': return curtiduria(m, estilo);
    case 'armeria': return armeria(m, estilo);
    case 'carpinteria':
    case 'tallerCarpinteria': return carpinteria(m, estilo);
    case 'barracon': return barracon(m, estilo);
    case 'galeriaDeTiro': return galeriaDeTiro(m, estilo);
    case 'taberna': return taberna(m, estilo);
    case 'mercado': return mercado(m, estilo);
    case 'puestoMercado': return puestoMercado(m);
    case 'plaza': return plaza(m, estilo);
    case 'plazaDeArmas': return plazaDeArmas(m, estilo);
    case 'patioDeGremios': return patioDeGremios(m, estilo);
    case 'pozo': return pozo(m);
    case 'parque': return parque(m, estilo);
    case 'tienda': return tienda(m);
    case 'mina':
    case 'minaCobre':
    case 'minaEstano':
    case 'minaHierro': return bocamina(m, tipo, estilo);
    case 'cantera': return cantera(m, estilo);
    default: {
      bloque(m, estilo, 0, 0, m.L - 0.6, m.S - 0.6, { frente: 1 });
    }
  }
}

/** Monta un edificio de la plaza en `p`, según su tipo, su estilo y su estado. */
export function montarEdificio(p: Piezas, e: EdificioEnVista): void {
  const m = new Marco(p, e);
  p.de = e.id;
  p.tinte = 1;
  if (e.estado === 'en_cola') {
    if (e.danado) ruina(m);
    else estacas(m, m.L - 0.3, m.S - 0.3);
  } else if (e.estado === 'en_construccion') {
    if (e.danado) { p.tinte = 0.8; ruina(m); p.tinte = 1; }
    armazon(m, e);
  } else {
    terminado(m, e.tipo, e.estilo);
    if (e.mejora) andamios(m, e);
  }
  p.de = undefined;
  p.tinte = 1;
}
