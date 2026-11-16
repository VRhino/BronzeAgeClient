// Los edificios de la plaza hechos en código, cada uno DENTRO de su huella (nada sale de ella ni se gira fuera de ella: el trazado manda).
// El aspecto lo da el estilo (el nivel de la plaza con el umbral de cada casa, `estado.ts`):
//   1. chozas redondas de zarzo y paja, casas largas de madera con tejado de paja a dos aguas;
//   2. casas largas y absidales de barro y paja, y las primeras de adobe;
//   3. adobe de techo plano con pretil, trampilla, vigas que asoman, patio y pérgola (la aldea en ladera, 3D Stoa);
//   4. enlucido sobre zócalo de piedra, dos alturas, ventanas;
//   5. piedra y enlucido con franjas y columnas rojas, terrazas escalonadas (Cnosos).
// Eso es la Era I, la de los reinos palaciales. La época (`EdificioEnVista.epoca`, la Era a la que llegó la plaza por las tecnologías de su
// Facción, `estado.ts`; Víctor, 2026-11-16) cambia el vocabulario sin tocar el tamaño, que sigue siendo del estilo:
//   II. crisis y adaptación: sin franjas rojas ni cuernos, postes de madera, zócalo de piedra, casas absidales y paja (con su cumbrera) o
//       terrado, las vigas de atado de madera en los muros; el héroon en los niveles 2 y 3, y en el 4 y el 5 la sala grande de piedra en su
//       recinto (en el mismo nivel, la II nunca se ve más pobre que la I);
// Una Era nunca se ve más pobre que la anterior en el mismo nivel (lo comprueba `pruebas/ciudad3d.test.ts`). El Centro Urbano va con el nivel en
// todas las Eras: en el 1, el sitio de reunión con la casa pequeña del jefe; en el 2 y el 3, de transición; el edificio grande en el 4 y el palacio
// en el 5 (Víctor, 2026-11-16).
//   III. polis e imperios: teja de barro a dos aguas, columnas dóricas de piedra estucada, el templo con frontón, la estoa con su tejado;
//   IV. clásica: casas encaladas sobre zócalo de piedra clara, teja a cuatro aguas en las ricas (estilo 4 y 5) y a dos en el resto, dos plantas
//       como mucho; lo público de sillería con sus hiladas marcadas; jónico en lo rico y dórico en lo demás; templos y estoas de mármol; la Sala
//       del Consejo es el bouleuterion (la sala cuadrada con tejado a cuatro aguas y su pórtico); el palacio, con su propileo y su patio
//       porticado (de jónicas);
//   V. helenística: estuco pintado con franjas rojo pompeyano u ocre desde el estilo 4, casas de peristilo en el 5 y hasta tres plantas;
//       corintio en lo rico y jónico en el resto (también en el palacio); la Maravilla, el gran templo díptero o sobre
//       un podio alto con su escalinata.
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
  /** La época con que se viste (de 1 a 5; sin ella, la 1). */
  readonly era: number;
  private readonly c: number;
  private readonly s: number;

  constructor(readonly p: Piezas, readonly e: EdificioEnVista) {
    this.era = Math.max(1, Math.min(5, Math.floor(e.epoca ?? 1)));
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

// ───────────────────────────── La época: lo que cambia de una Era a otra ─────────────────────────────
// En la Era I todo sale como antes de las épocas (los mismos números, pieza a pieza): lo de aquí solo cambia algo desde la II.

type Cubierta = 'paja' | 'plano' | 'teja' | 'cuatro';

/**
 * El tejado de los cuerpos de casa de un edificio, fijo por edificio: en la Era I, paja en los estilos 1 y 2 y terrado desde el 3; en la II,
 * paja o terrado (más paja); desde la III, teja de barro, con algún terrado (y aún paja en la mitad de las casas pobres de la III); desde la IV,
 * a cuatro aguas en los estilos 4 y 5.
 */
function cubierta(m: Marco, estilo: number): Cubierta {
  if (m.era === 1) return estilo <= 2 ? 'paja' : 'plano';
  const k = m.azar(43);
  if (m.era === 2) return estilo <= 2 || k < (estilo >= 4 ? 0.3 : 0.55) ? 'paja' : 'plano';
  if (m.era === 3 && estilo === 1 && k < 0.5) return 'paja';
  if (k < 0.1) return 'plano';
  return m.era >= 4 && estilo >= 4 ? 'cuatro' : 'teja';
}

/** El tejado de un cobertizo o un tejadillo: el de su casa, salvo en los estilos bajos, de paja hasta la Era II y de teja después. */
function cubiertaLigera(m: Marco, estilo: number): Cubierta {
  if (estilo <= 2) return m.era >= 3 ? 'teja' : 'paja';
  const c = cubierta(m, estilo);
  return c === 'cuatro' ? 'teja' : c;
}

/** La franja bajo el techo, o ninguna: la roja de Cnosos en el estilo 5 de la Era I; las vigas de atado de madera desde el estilo 3 de la Era II;
 * la del estuco helenístico (rojo pompeyano u ocre, fija por edificio) desde el estilo 4 de la Era V. */
function franjaDe(m: Marco, estilo: number): number | undefined {
  if (m.era === 1) return estilo === 5 ? COLOR.rojo : undefined;
  if (m.era === 5 && estilo >= 4) return m.azar(45) < 0.6 ? COLOR.rojoPompeyano : COLOR.ocre;
  // en la Era II, las vigas de atado de madera que corren por los muros (y enmarcan las ventanas): sin el rojo de Cnosos, no más pobre
  if (m.era === 2 && estilo >= 3) return COLOR.maderaOscura;
  return undefined;
}

/** Los edificios públicos: desde la Era IV, de sillería con sus hiladas (`bloque`). */
const PUBLICOS = new Set(['centroUrbano', 'palacio', 'salaConsejo', 'maravilla', 'almacen', 'granero', 'barracon', 'mercado', 'patioDeGremios']);

/** Las hiladas marcadas de la sillería en un cuerpo de `l` × `s`, de `y` a `y + h`. */
function hiladas(m: Marco, u: number, v: number, l: number, s: number, y: number, h: number, paso = 0.35): void {
  const c = oscurecer(COLOR.sillar, 0.86);
  for (let yy = y + paso; yy < y + h - 0.12; yy += paso) m.caja(c, u, v, l + 0.02, s + 0.02, 0.025, yy);
}

/**
 * Un tejado a cuatro aguas de `l` × `s` (`l` a lo largo de `giro`) y `h` de alto sobre `y`: la cumbrera a lo largo del lado largo (un prisma a dos
 * aguas) y los dos faldones de los extremos (medias pirámides), o una pirámide si es cuadrado.
 */
function aCuatroAguas(m: Marco, color: number, u: number, v: number, l: number, s: number, h: number, y: number, giro = 0): void {
  const a = Math.max(l, s), b = Math.min(l, s), g = giro + (l >= s ? 0 : Math.PI / 2), d = (a - b) / 2;
  if (d > 0.03) m.forma('aguas', color, u, v, 2 * d, b, h, y, g);
  for (const k of d > 0.03 ? [-1, 1] : [0]) m.forma('cuatroAguas', color, u + k * d * Math.cos(g), v + k * d * Math.sin(g), b, b, h, y, g);
}

/** Si la casa va sobre un zócalo de piedra: en la Era I, desde el estilo 4; después de la crisis, toda casa de muros (desde el 2). */
function conZocalo(m: Marco, estilo: number): boolean {
  return m.era === 1 ? estilo >= 4 : estilo >= 2;
}

function colorZocalo(m: Marco, estilo: number): number {
  if (m.era === 1) return estilo === 5 ? COLOR.piedraClara : COLOR.piedra;
  return m.era >= 4 ? COLOR.piedraClara : COLOR.piedra;
}

/**
 * Un tejado a dos aguas sobre un cuerpo de `l` × `s` cuyo techo está a la altura `y`, con la cumbrera a lo largo de u (girado `giro`): de paja,
 * alto; o de teja, bajo, y con `fronton` (un color de piedra) el frontón en los dos hastiales. Devuelve la altura de la cumbrera.
 */
function tejado(m: Marco, cub: 'paja' | 'teja' | 'cuatro', u: number, v: number, l: number, s: number, y: number, fronton?: number, giro = 0): number {
  if (cub === 'cuatro') {
    const h = Math.min(0.75, Math.min(l, s) * 0.3);
    aCuatroAguas(m, m.azar(44) < 0.3 ? COLOR.tejaVieja : COLOR.teja, u, v, l + 0.24, s + 0.24, h, y, giro);
    return y + h;
  }
  if (cub === 'paja') {
    const h = s * 0.5, yc = y - 0.04 + h;
    m.forma('aguas', m.azar(44) < 0.35 ? COLOR.pajaVieja : COLOR.paja, u, v, l + 0.25, s + 0.4, h, y - 0.04, giro);
    // la cumbrera de madera y, en cada hastial, las dos varas cruzadas que la sujetan
    m.forma('caja', COLOR.maderaOscura, u, v, l + 0.3, 0.12, 0.1, yc - 0.06, giro);
    for (const k of [-1, 1]) {
      const du = (k * (l + 0.3)) / 2, uu = u + du * Math.cos(giro), vv = v + du * Math.sin(giro);
      for (const t of [-1, 1]) m.forma('caja', COLOR.maderaOscura, uu, vv, 0.06, 0.06, 0.4, yc - 0.2, giro, t * 0.5);
    }
    return yc;
  }
  const h = Math.min(0.75, s * 0.26);
  m.forma('aguas', m.azar(44) < 0.3 ? COLOR.tejaVieja : COLOR.teja, u, v, l + 0.2, s + 0.26, h, y, giro);
  // el frontón: un prisma de piedra algo más largo y más bajo, que asoma por los hastiales dentro del borde de la teja
  if (fronton !== undefined) m.forma('aguas', fronton, u, v, l + 0.26, s + 0.1, h * 0.84, y, giro);
  return y + h;
}

/**
 * El techo de un cobertizo de `l` × `s` a la altura `h`: de paja a dos aguas, de teja o plano (una tablazón de `plano`), según `cubiertaLigera`.
 * Lo de la Era I sale como antes: paja en los estilos 1 y 2 y plano desde el 3.
 */
function techoLigero(m: Marco, estilo: number, u: number, v: number, l: number, s: number, h: number, plano: number, giro = 0): void {
  const cub = cubiertaLigera(m, estilo);
  if (cub === 'paja') m.forma('aguas', COLOR.paja, u, v, l + 0.2, s + 0.3, s * 0.5, h, giro);
  else if (cub === 'teja') tejado(m, 'teja', u, v, l, s, h, undefined, giro);
  else m.forma('caja', plano, u, v, l + 0.12, s + 0.12, 0.1, h, giro);
}

type Orden = 'minoica' | 'madera' | 'dorica' | 'jonica' | 'corintia';

/** El orden de las columnas: la roja de Cnosos (o de madera) en la Era I; postes de madera en la II; dóricas en la III. */
function ordenDe(m: Marco, rica: boolean): Orden {
  switch (m.era) {
    case 1: return rica ? 'minoica' : 'madera';
    case 2: return 'madera';
    case 3: return 'dorica';
    case 4: return rica ? 'jonica' : 'dorica';
    default: return rica ? 'corintia' : 'jonica';
  }
}

/** La piedra de las columnas y los templos: estucada en la Era III, mármol desde la IV. */
function piedraNoble(m: Marco): number {
  return m.era >= 4 ? COLOR.marmol : COLOR.estuco;
}

// ───────────────────────────── Piezas de arquitectura ─────────────────────────────

/**
 * Una choza redonda de radio `r`: muro de zarzo y techo cónico de paja, con la puerta hacia `frente` (±1 en v). En la Era II, sobre un anillo de
 * piedras; desde la III ya no son redondas: una casilla cuadrada de barro sobre su zócalo, con el tejado a cuatro aguas de paja o de teja.
 */
function choza(m: Marco, u: number, v: number, r: number, o: { techo?: number; muro?: number; alto?: number; frente?: number } = {}): void {
  const h = o.alto ?? 0.75, f = o.frente ?? 1;
  if (m.era >= 3) {
    const a = 2 * r * 0.86, muro = o.muro !== undefined && o.muro !== COLOR.zarzo ? o.muro : m.era >= 4 ? COLOR.adobe : COLOR.barro;
    const cub = cubierta(m, 1), techo = cub === 'paja' ? (o.techo ?? COLOR.paja) : m.azar(44) < 0.3 ? COLOR.tejaVieja : COLOR.teja;
    m.caja(COLOR.piedra, u, v, a + 0.06, a + 0.06, 0.2);
    m.caja(muro, u, v, a, a, h + 0.1);
    m.forma('cuatroAguas', techo, u, v, a + 0.3, a + 0.3, cub === 'paja' ? a * 0.6 : a * 0.32, h + 0.1);
    m.caja(COLOR.hueco, u, v + f * (a / 2 + 0.01), Math.min(0.5, a * 0.3), 0.06, Math.min(0.62, h * 0.85));
    return;
  }
  if (m.era === 2) m.forma('cilindro', COLOR.piedra, u, v, 2 * r + 0.1, 2 * r + 0.1, 0.18);
  m.forma('cilindro', o.muro ?? COLOR.zarzo, u, v, 2 * r, 2 * r, h);
  m.forma('cono', o.techo ?? COLOR.paja, u, v, 2 * r * 1.22, 2 * r * 1.22, r * 1.15 + 0.35, h * 0.8);
  m.caja(COLOR.hueco, u, v + f * r * 0.97, Math.min(0.5, r * 0.5), 0.12, Math.min(0.62, h * 0.85));
}

/**
 * Una casa larga de `l` × `s`: muros bajos y tejado de paja a dos aguas; con ábside, un extremo redondo. La puerta en el hastial de +u. Desde
 * la Era II, de barro (no de zarzo) sobre un zócalo de piedra; desde la III, sin ábside y casi siempre con teja.
 */
function casaLarga(m: Marco, u: number, v: number, l: number, s: number, o: { techo?: number; muro?: number; alto?: number; abside?: boolean } = {}): void {
  const h = o.alto ?? 0.8, techo = o.techo ?? COLOR.paja;
  const muro = m.era >= 2 && (o.muro ?? COLOR.zarzo) === COLOR.zarzo ? COLOR.barro : o.muro ?? COLOR.zarzo;
  let ub = u, lb = l;
  if (o.abside && m.era <= 2 && l > s * 1.2) {
    const ua = u - l / 2 + s / 2;
    if (m.era === 2) m.forma('cilindro', COLOR.piedra, ua, v, s + 0.08, s + 0.08, 0.22);
    m.forma('cilindro', muro, ua, v, s, s, h);
    m.forma('cono', techo, ua, v, s * 1.2, s * 1.2, s * 0.62 + 0.15, h * 0.86);
    ub = u + s / 4;
    lb = l - s / 2;
  }
  if (m.era >= 2) m.caja(COLOR.piedra, ub, v, lb + 0.08, s + 0.08, 0.22);
  m.caja(muro, ub, v, lb, s, h);
  if (m.era >= 3 && !(m.era === 3 && m.azar(43) < 0.3)) tejado(m, 'teja', ub, v, lb, s, h);
  else m.forma('aguas', techo, ub, v, lb + 0.25, s + 0.45, s * 0.66, h * 0.86);
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

/**
 * Una columna de `h` de alto: en la Era I, roja de capitel negro (la de Cnosos) o, sin `roja`, de madera; después, la del orden de su época
 * (`ordenDe`, `roja` es la rica): el poste de madera de la II, la dórica de fuste grueso con su equino y su ábaco, la jónica fina con su basa
 * y sus volutas, la corintia con su capitel de hojas.
 */
function columna(m: Marco, u: number, v: number, h: number, y = 0, roja = true): void {
  const orden = ordenDe(m, roja);
  if (orden === 'minoica' || orden === 'madera') {
    const r = orden === 'minoica';
    m.forma('cilindro', r ? COLOR.rojo : COLOR.madera, u, v, 0.2, 0.2, h - 0.12, y);
    m.caja(r ? COLOR.negro : COLOR.maderaOscura, u, v, 0.28, 0.28, 0.12, y + h - 0.12);
    return;
  }
  const p = piedraNoble(m);
  if (orden === 'dorica') {
    m.forma('cilindro', p, u, v, 0.25, 0.25, h - 0.14, y);
    m.forma('cilindro', oscurecer(p, 0.96), u, v, 0.33, 0.33, 0.06, y + h - 0.14);
    m.caja(p, u, v, 0.35, 0.35, 0.08, y + h - 0.08);
    return;
  }
  m.forma('cilindro', p, u, v, 0.28, 0.28, 0.06, y);
  m.forma('cilindro', p, u, v, 0.18, 0.18, h - 0.2, y + 0.06);
  if (orden === 'jonica') {
    m.caja(oscurecer(p, 0.95), u, v, 0.42, 0.17, 0.1, y + h - 0.14);
    m.caja(p, u, v, 0.27, 0.27, 0.04, y + h - 0.04);
  } else {
    m.forma('copa', oscurecer(p, 0.95), u, v, 0.3, 0.3, 0.17, y + h - 0.21);
    m.caja(p, u, v, 0.33, 0.33, 0.05, y + h - 0.05);
  }
}

/** Cuernos de consagración (Cnosos) sobre un tejado: solo en la Era I. */
function cuernos(m: Marco, u: number, v: number, y: number): void {
  if (m.era > 1) return;
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

/** La casilla del campo de `l` × `s`: en la Era I, de techo plano y `h` de alto; después, el cuerpo de casa de su época. */
function casita(m: Marco, estilo: number, u: number, v: number, l: number, s: number, h: number): void {
  if (m.era === 1) casaPlana(m, u, v, l, s, h, fabrica(m, estilo), { frente: 1 });
  else bloque(m, estilo, u, v, l, s, { frente: 1 });
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
  if (m.era >= 3) tejado(m, 'teja', u, v, l, s, 1.07);
  else m.forma('aguas', COLOR.paja, u, v, l + 0.2, s + 0.35, s * 0.7, 1.0);
}

/** Un silo de colmena (cilindro bajo con su cúpula). */
function silo(m: Marco, u: number, v: number, r: number, color: number): void {
  m.forma('cilindro', color, u, v, 2 * r, 2 * r, r * 0.7);
  m.forma('cupula', color, u, v, 2 * r, 2 * r, r * 1.1, r * 0.7);
  m.caja(COLOR.hueco, u, v + r * 0.98, r * 0.5, 0.05, r * 0.55, r * 0.7);
}

/**
 * El color de la fábrica del estilo y la época: en la Era I, barro, adobe o enlucido según el estilo; en la II, adobe y barro (sin enlucido); en
 * la III, adobe y algo de enlucido en los altos; en la IV, el encalado; en la V, enlucido, encalado y estuco ocre.
 */
function fabrica(m: Marco, estilo: number): number {
  const k = m.azar(41);
  if (m.era === 1) {
    if (estilo <= 2) return COLOR.barro;
    if (estilo === 3) return k < 0.5 ? COLOR.adobe : COLOR.adobeClaro;
    return k < 0.7 ? COLOR.enlucido : COLOR.enlucidoSombra;
  }
  if (estilo <= 2) return m.era >= 4 ? COLOR.adobe : COLOR.barro;
  switch (m.era) {
    case 2: return k < 0.5 ? COLOR.adobe : k < 0.8 ? COLOR.adobeFresco : COLOR.barro;
    case 3: return estilo >= 4 && k < 0.35 ? COLOR.enlucidoSombra : k < 0.65 ? COLOR.adobe : COLOR.adobeClaro;
    case 4: return k < 0.75 ? COLOR.encalado : k < 0.92 ? COLOR.enlucido : COLOR.adobeClaro;
    default: return k < 0.4 ? COLOR.enlucido : k < 0.7 ? COLOR.encalado : COLOR.estucoOcre;
  }
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
  // las casas griegas, de una o dos plantas: tres solo en la Era I (Cnosos) y en la V
  const sillar = o.color === undefined && m.era >= 4 && PUBLICOS.has(m.e.tipo);
  const color = o.color ?? (sillar ? COLOR.sillar : fabrica(m, estilo)), plantas = Math.max(1, Math.min(m.era === 1 || m.era === 5 ? 3 : 2, o.plantas ?? 1));
  const franja = franjaDe(m, estilo) === undefined ? undefined : o.franja ?? franjaDe(m, estilo), cub = cubierta(m, estilo);
  if (conZocalo(m, estilo)) m.caja(colorZocalo(m, estilo), u, v, l + 0.06, s + 0.06, 0.32);
  let y = 0, arriba = { u, v, l, s };
  for (let k = 0; k < plantas; k++) {
    const enc = k * 0.12, lk = l - enc * l * 0.6, sk = s - enc * s;
    const uk = u + (k ? (m.azar(60 + k) - 0.5) * (l - lk) : 0), vk = v - f * enc * s * 0.5, ultima = k === plantas - 1 && cub === 'plano';
    y = casaPlana(m, uk, vk, lk, sk, P, color, { frente: f, y, pretil: ultima, trampilla: ultima, vigas: (estilo === 3 || m.era === 2) && k === 0 });
    if (sillar) hiladas(m, uk, vk, lk, sk, y - P, P);
    if (franja !== undefined) m.caja(franja, uk, vk, lk + 0.04, sk + 0.04, 0.1, y - 0.22);
    if (estilo >= 4 && k > 0) ventanas(m, uk, vk, lk, sk, y - P * 0.62, f, franja);
    arriba = { u: uk, v: vk, l: lk, s: sk };
  }
  if (cub !== 'plano') return tejado(m, cub, arriba.u, arriba.v, arriba.l, arriba.s, y);
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
    else if (m.era === 1) casaPlana(m, 0, -f * S * 0.15, L * 0.8, S * 0.62, 0.95, COLOR.adobe, { frente: f, vigas: true });
    else bloque(m, 3, 0, -f * S * 0.15, L * 0.8, S * 0.62, { frente: f, color: COLOR.adobe });
    if (m.azar(8) < 0.3) almiar(m, L / 2 - 0.35, f * (S / 2 - 0.35), 0.3);
    return;
  }
  if (m.era === 5 && estilo === 5 && Math.min(L, S) >= 4.4 && m.azar(47) < 0.6) return peristilo(m, estilo, L, S, f);
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
  } else if (m.azar(7) < 0.25 && cubierta(m, estilo) === 'plano') pergola(m, u, v, l * 0.5, s * 0.6, techo - 0.16, 0.7);
  if (estilo === 5 && m.azar(9) < 0.4 && patio > 0.6) {
    // un porche de columnas rojas delante de la casa (las de su época; de teja desde la Era III)
    for (const a of [-1, 1]) columna(m, u + a * (l / 2 - 0.2), v + f * (s / 2 + Math.min(0.6, patio * 0.6)), 1.0);
    m.caja(m.era === 1 ? COLOR.enlucido : m.era === 2 ? COLOR.madera : COLOR.teja, u, v + f * (s / 2 + Math.min(0.6, patio * 0.6) / 2), l, Math.min(0.6, patio * 0.6) + 0.15, 0.12, 1.0);
  }
  if (estilo >= 4 && m.azar(10) < 0.2) cuernos(m, u, v, techo);
}

/** Los tonos de las casas altas de cada época (estilo 4 y estilo 5); la Era I, los de abajo de `viviendaAlta`. */
const TONOS_ALTOS: Record<number, [number[], number[]]> = {
  2: [[COLOR.adobe, COLOR.adobeClaro, COLOR.adobeFresco, 0xc2a37c], [COLOR.adobeClaro, COLOR.adobe, 0xd2b88f, COLOR.adobeFresco]],
  3: [[COLOR.adobe, COLOR.adobeClaro, COLOR.enlucidoSombra, 0xd6bb92], [COLOR.adobeClaro, COLOR.enlucidoSombra, COLOR.enlucido, 0xd6bb92]],
  4: [[COLOR.encalado, COLOR.encalado, COLOR.enlucido, 0xeee6d6], [COLOR.encalado, COLOR.encalado, COLOR.enlucido, 0xf3efe6]],
  5: [[COLOR.enlucido, COLOR.encalado, COLOR.estucoOcre, 0xe6d2b4], [COLOR.enlucido, COLOR.encalado, COLOR.estucoOcre, 0xeadcc0, 0xf0e8d8]],
};

/**
 * Las otras casas de los niveles 4 y 5 (una de cada tres sigue siendo la de bloque y patio): en L alrededor de un patio, dos cuerpos en
 * hilera de distinta altura, o de azotea con la planta de arriba retranqueada; de varios tonos de enlucido, con franjas rojas, ocres o
 * azules en el 5, escalera de fuera, tinajas y toldos en las azoteas.
 */
function viviendaAlta(m: Marco, estilo: number, L: number, S: number, f: number): void {
  const tonos = TONOS_ALTOS[m.era]?.[estilo === 5 ? 1 : 0] ?? (estilo === 5 ? [COLOR.enlucido, COLOR.enlucidoSombra, 0xeadcc0, 0xe6d2b4, 0xf0e8d8] : [COLOR.adobeClaro, COLOR.enlucido, COLOR.enlucidoSombra, 0xd6bb92]);
  const tono = (k: number): number => tonos[Math.floor(m.azar(k) * tonos.length)]!;
  const fr = m.azar(13), pintada = franjaDe(m, estilo) !== undefined;
  const franja = m.era === 1 ? (fr < 0.6 ? COLOR.rojo : fr < 0.85 ? COLOR.ocre : COLOR.azul) : franjaDe(m, estilo) ?? COLOR.ocre;
  const alta = (k: number): number => (estilo === 4 ? (m.azar(k) < 0.5 ? 2 : 1) : m.azar(k) < 0.35 ? 3 : 2);
  // la de azotea es de terrado: con tejado de paja o de teja, la de dos cuerpos en hilera
  const plano = cubierta(m, estilo) === 'plano', lado = m.azar(14) < 0.5 ? 1 : -1;
  let forma = m.azar(11) / 0.68;
  if (!plano && forma >= 0.72) forma = 0.6;
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
    m.caja(colorZocalo(m, estilo), 0, v, L * 0.94 + 0.06, s + 0.06, 0.32);
    const y1 = casaPlana(m, 0, v, L * 0.94, s, P, c, { frente: f, trampilla: false });
    if (pintada) m.caja(franja, 0, v, L * 0.94 + 0.04, s + 0.04, 0.1, y1 - 0.22);
    const s2 = s * 0.5, v2 = v - f * (s - s2) / 2;
    techo = casaPlana(m, -lado * L * 0.12, v2, L * 0.6, s2, P, c, { frente: f, y: y1 });
    ventanas(m, -lado * L * 0.12, v2, L * 0.6, s2, techo - P * 0.62, f, pintada ? franja : undefined);
    if (pintada) m.caja(franja, -lado * L * 0.12, v2, L * 0.6 + 0.04, s2 + 0.04, 0.1, techo - 0.22);
    azoteaU = lado * L * 0.25; azoteaV = v + f * s * 0.25; azoteaL = L * 0.36;
    pergola(m, azoteaU, azoteaV, azoteaL, s * 0.4, y1, 0.75, m.azar(8) < 0.4);
    techo = y1;
  }
  // la escalera de fuera, pegada a un costado, hasta la primera azotea (con terrado)
  if (plano && m.azar(16) < 0.45) {
    const n = 5, paso = 0.2, u0 = lado * (L / 2 - 0.12), c = tono(6);
    for (let i = 0; i < n; i++) m.caja(c, u0, v + f * (s / 2 + 0.05) - f * (i + 0.5) * paso * 1.3, 0.22, paso * 1.3, ((i + 1) * 1.0) / n, 0);
  }
  // en la azotea, unas tinajas o un toldo (con terrado)
  const k = plano ? m.azar(17) : 1;
  if (k < 0.3) tinajas(m, azoteaU - 0.3, azoteaV, 2 + Math.floor(m.azar(18) * 2), COLOR.barro, techo);
  else if (k < 0.5) {
    const t = COLOR.toldo[Math.floor(m.azar(19) * COLOR.toldo.length)]!, du = azoteaL / 2 - 0.08, dv = Math.min(0.5, s * 0.3);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, azoteaU + a * du, azoteaV + b * dv, 0.7, 0.05, techo);
    m.caja(t, azoteaU, azoteaV, azoteaL, 2 * dv + 0.1, 0.03, techo + 0.7);
  }
  if (estilo === 5 && m.azar(10) < 0.25) cuernos(m, azoteaU, v, techo);
}

/**
 * Un patio porticado de `l` × `s` con su centro en (u, v): enlosado, con las columnas de su época alrededor (a un paso del borde), el entablamento
 * y el tejadillo de teja de la galería hasta el borde, y en medio el impluvio con su brocal.
 */
function patioPorticado(m: Marco, u: number, v: number, l: number, s: number, h: number, rica: boolean): void {
  const p = piedraNoble(m), d = Math.min(0.6, Math.min(l, s) * 0.18), cl = l - 2 * d, cs = s - 2 * d;
  m.losa(COLOR.losa, u, v, l, s, 0.04);
  const nu = Math.max(2, Math.round(cl / 0.85) + 1), nv = Math.max(2, Math.round(cs / 0.85) + 1);
  for (let i = 0; i < nu; i++) for (const b of [-1, 1]) columna(m, u - cl / 2 + (cl * i) / (nu - 1), v + (b * cs) / 2, h, 0, rica);
  for (let j = 1; j < nv - 1; j++) for (const a of [-1, 1]) columna(m, u + (a * cl) / 2, v - cs / 2 + (cs * j) / (nv - 1), h, 0, rica);
  for (const b of [-1, 1]) {
    m.caja(p, u, v + (b * cs) / 2, cl + 0.3, 0.3, 0.16, h);
    m.caja(p, u + (b * cl) / 2, v, 0.3, cs, 0.16, h);
    m.caja(COLOR.teja, u, v + b * (cs / 2 + d / 2), l, d + 0.15, 0.07, h + 0.16);
    m.caja(COLOR.teja, u + b * (cl / 2 + d / 2), v, d + 0.15, cs - 0.15, 0.07, h + 0.16);
  }
  const ai = Math.min(1.1, Math.min(cl, cs) * 0.35);
  m.caja(COLOR.piedraClara, u, v, ai, ai, 0.12);
  m.losa(COLOR.agua, u, v, ai - 0.16, ai - 0.16, 0.02, 0.12);
}

/** La casa de peristilo de la Era V (estilo 5): el cuerpo del fondo alto, dos alas bajas a los lados y entre ellas el patio porticado, cerrado a la
 * calle por la tapia con su portal. */
function peristilo(m: Marco, estilo: number, L: number, S: number, f: number): void {
  const d = Math.min(1.6, S * 0.3), d2 = Math.min(1.3, L * 0.24);
  bloque(m, estilo, 0, -f * (S / 2 - d / 2), L, d, { plantas: m.azar(5) < 0.4 ? 3 : 2, frente: f });
  for (const a of [-1, 1]) bloque(m, estilo, a * (L / 2 - d2 / 2), (f * d) / 2, d2, S - d, { plantas: 1, frente: f });
  const pl = L - 2 * d2, ps = S - d - 0.15;
  patioPorticado(m, 0, f * (d / 2 - 0.075), pl, ps, 1.0, true);
  const c = fabrica(m, estilo), puerta = Math.min(0.9, pl * 0.3), vt = f * (S / 2 - 0.06);
  tapia(m, -pl / 2, vt, -puerta / 2, vt, c, 1.1);
  tapia(m, puerta / 2, vt, pl / 2, vt, c, 1.1);
  const franja = franjaDe(m, estilo);
  if (franja !== undefined) for (const a of [-1, 1]) m.viga(franja, (a * puerta) / 2, vt, (a * pl) / 2, vt, 0.85, 0.14, 0.1);
}

// ───────────────────────────── El gobierno y los grandes ─────────────────────────────

/**
 * El Centro Urbano y el Palacio, según el nivel (Víctor, 2026-11-16: «en nivel 1 debería ser un edificio pequeño y como una plaza donde se junta
 * la gente»): en el 1, el sitio de reunión con la casa pequeña del jefe; en el 2 y el 3, de transición, la casa larga del jefe y la sala con su
 * pórtico, cada una con su patio de reunión (el héroon en la Era II); el edificio grande (el megarón con sus alas) en el 4, y el palacio en el 5.
 * Desde la Era IV, el palacio con su propileo en el 4 y el 5; en la Era II, la sala grande de piedra en su recinto (sin bajón respecto a la I).
 */
function palacio(m: Marco, estilo: number): void {
  const L = m.L - 0.6, S = m.S - 0.6;
  if (estilo === 1) return lugarDeReunion(m, L, S);
  if (m.era === 2 && estilo <= 3) return heroon(m, estilo);
  if (estilo === 2) {
    casaLarga(m, 0, -S * 0.1, L * 0.78, S * 0.42, { muro: COLOR.madera, alto: 1.25, techo: COLOR.paja });
    graneroEnPilotes(m, L * 0.36, S * 0.34, 1.2, 1.0);
    choza(m, -L * 0.36, S * 0.33, Math.min(L, S) * 0.11, { muro: COLOR.barro, frente: -1 });
    // delante de la casa del jefe, el hogar donde se junta la gente, con sus bancos
    fogata(m, 0, S * 0.3, 2);
    bancos(m, 0, S * 0.3, Math.min(L, S) * 0.16, 3, Math.PI * 0.15);
    cercoPostes(m, L, S);
    return;
  }
  if (estilo === 3) return salaDelJefe(m, L, S);
  if (m.era === 2) return palacioDeEraII(m, estilo, L, S);
  if (m.era >= 4) return palacioHelenistico(m, estilo);
  if (estilo === 4) return megaron(m, estilo, L, S);
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
    m.caja(m.era === 1 ? COLOR.enlucido : piedraNoble(m), 0, v + a * 0.2, pl, 0.6, 0.14, 1.1);
    if (m.era === 1) m.caja(COLOR.rojo, 0, v + a * 0.2, pl + 0.02, 0.62, 0.06, 1.14);
    else tejado(m, 'teja', 0, v + a * 0.2, pl, 0.6, 1.24);
  }
  // la escalinata a un lado
  for (let k = 0; k < 4; k++) m.caja(COLOR.piedraClara, -pl / 2 - 0.4 + k * 0.01, ps / 2 + 0.2 + k * 0.18, 0.9, 0.2, 0.15 + k * 0.15);
}

/** El megarón con sus alas: la sala con su pórtico (de dos columnas, o de `columnas`), alas alrededor de un patio y el cuerpo del frente. */
function megaron(m: Marco, estilo: number, L: number, S: number, o: { sala?: number; columnas?: number } = {}): void {
  const c = fabrica(m, estilo), patioL = L * 0.42, patioS = S * 0.38, nc = o.columnas ?? 2, vc = -S * 0.28 + S * 0.18 + 0.35;
  m.losa(estilo >= 4 ? COLOR.losa : COLOR.tierra, 0, S * 0.12, patioL, patioS, 0.04);
  bloque(m, estilo, 0, -S * 0.28, L * 0.5, S * 0.36, { plantas: estilo >= 4 ? 2 : 1, frente: 1, color: o.sala });
  if (nc === 2) for (const a of [-1, 1]) columna(m, a * L * 0.12, vc, 1.1, 0, estilo >= 4);
  else for (let i = 0; i < nc; i++) columna(m, -L * 0.22 + (L * 0.44 * i) / (nc - 1), vc, 1.1, 0, estilo >= 4);
  m.caja(m.era >= 4 ? COLOR.sillar : c, 0, -S * 0.28 + S * 0.18 + 0.2, L * 0.5, 0.55, 0.14, 1.1);
  for (const a of [-1, 1]) bloque(m, estilo, a * L * 0.36, S * 0.05, L * 0.24, S * 0.62, { plantas: 1 + (m.azar(70 + a) < 0.5 ? 1 : 0), frente: 1 });
  bloque(m, estilo, 0, S * 0.4, L * 0.46, S * 0.18, { plantas: 1, frente: -1 });
  if (estilo === 4) for (const a of [-1, 1]) cuernos(m, a * L * 0.15, -S * 0.32, 2.4);
}

/** Bancos de piedra en corro de radio `r` alrededor de (u, v), `n` de ellos, empezando en el ángulo `a0`. */
function bancos(m: Marco, u: number, v: number, r: number, n: number, a0 = 0): void {
  for (let k = 0; k < n; k++) {
    const a = a0 + (2 * Math.PI * k) / n;
    m.caja(COLOR.piedra, u + Math.cos(a) * r, v + Math.sin(a) * r, 0.8, 0.28, 0.32, 0, a + Math.PI / 2);
  }
}

/**
 * El Centro Urbano de nivel 1: el sitio de reunión, no un edificio. El suelo pisado, el hogar en medio con sus troncos, el corro de bancos de
 * piedra, la casa pequeña del jefe en una esquina, el altar de piedra en otra, el pozo y, si cabe, un árbol grande. En todas las Eras (la casa,
 * la de su época).
 */
function lugarDeReunion(m: Marco, L: number, S: number): void {
  const lado = Math.min(L, S), r = Math.max(0.7, Math.min(1.2, lado * 0.15));
  const corro = Math.min(1.9, lado * 0.27), suelo = Math.min(lado * 0.78, 2 * corro + 2.4);
  m.forma('cilindro', mezclar(COLOR.tierra, COLOR.rocaClara, 0.25), 0, 0, suelo, suelo, 0.03);
  fogata(m, 0, 0, 3);
  bancos(m, 0, 0, corro, 5, 0.3);
  choza(m, -L / 2 + r + 0.1, -S / 2 + r + 0.1, r, { frente: 1, alto: 0.85 });
  m.caja(COLOR.piedraClara, L / 2 - 0.7, -S / 2 + 0.7, 0.7, 0.5, 0.5);
  m.caja(COLOR.piedraClara, L / 2 - 0.7, -S / 2 + 0.7, 0.8, 0.6, 0.08, 0.5);
  pozo(m, -L / 2 + 0.8, S / 2 - 0.8);
  if (lado >= 6) arbol(m, L / 2 - 0.9, S / 2 - 0.9, 0.95, 1);
}

/**
 * El Centro Urbano de nivel 3, de transición: la sala del jefe con su pórtico de dos columnas al fondo y delante el patio de reunión (con el hogar;
 * desde la Era III, enlosado y con el altar), sus bancos, el granero, el pozo y la tapia baja alrededor.
 */
function salaDelJefe(m: Marco, L: number, S: number): void {
  const v = -S * 0.24, l = L * 0.56, s = S * 0.38, c = fabrica(m, 3);
  bloque(m, 3, 0, v, l, s, { plantas: 1, frente: 1 });
  for (const a of [-1, 1]) columna(m, a * l * 0.25, v + s / 2 + 0.35, 1.1, 0, false);
  m.caja(m.era >= 4 ? COLOR.sillar : c, 0, v + s / 2 + 0.2, l * 0.7, 0.55, 0.14, 1.1);
  const vp = S * 0.18;
  m.losa(m.era >= 3 ? COLOR.losa : COLOR.tierra, 0, vp, L * 0.5, S * 0.4, 0.04);
  if (m.era >= 3) {
    m.caja(piedraNoble(m), 0, vp, 0.8, 0.6, 0.5);
    m.forma('cono', COLOR.fuego, 0, vp, 0.3, 0.3, 0.3, 0.5);
  } else fogata(m, 0, vp, 2);
  bancos(m, 0, vp, Math.min(L, S) * 0.16, 4, 0.8);
  graneroEnPilotes(m, L * 0.36, S * 0.32, 1.1, 0.9);
  pozo(m, -L * 0.36, S * 0.32);
  cerco(m, 0, 0, L + 0.3, S + 0.3, true, c);
}

/**
 * El palacio de la Era II (niveles 4 y 5): la sala grande de piedra con su pórtico de postes y sus alas, dentro de un recinto de piedra con
 * torres en las esquinas y la puerta al frente; el hogar en el patio; en el 5, además, las tinajas del almacén y el pozo. Sin franjas ni cuernos.
 */
function palacioDeEraII(m: Marco, estilo: number, L: number, S: number): void {
  const Li = L - 0.6, Si = S - 0.6;
  megaron(m, estilo, Li, Si, { sala: COLOR.piedra, columnas: estilo >= 5 ? 6 : 4 });
  fogata(m, 0, Si * 0.12, 2);
  cerco(m, 0, 0, L + 0.3, S + 0.3, true, COLOR.piedra);
  // la puerta del recinto: dos pilares y el dintel sobre el hueco de la cerca
  for (const a of [-1, 1]) m.caja(COLOR.piedra, a * 0.55, (S + 0.3) / 2, 0.3, 0.3, 1.3);
  m.caja(COLOR.piedraOscura, 0, (S + 0.3) / 2, 1.4, 0.3, 0.2, 1.3);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    m.caja(COLOR.piedra, a * (L / 2 - 0.15), b * (S / 2 - 0.15), 0.8, 0.8, 1.2);
    m.caja(COLOR.piedraOscura, a * (L / 2 - 0.15), b * (S / 2 - 0.15), 0.9, 0.9, 0.12, 1.2);
  }
  if (estilo >= 5) {
    for (const a of [-1, 1]) tinajas(m, a * Li * 0.12 - 0.42, Si * 0.24, 4, a > 0 ? COLOR.ocre : COLOR.barro);
    pozo(m, 0, Si * 0.02);
    // los pórticos de postes a los lados del patio, contra las alas
    const up = Li * 0.21, n = 4;
    for (const a of [-1, 1]) {
      for (let i = 0; i < n; i++) m.poste(COLOR.madera, a * up, -Si * 0.04 + (Si * 0.34 * i) / (n - 1), 1.1, 0.13);
      m.caja(COLOR.maderaOscura, a * (up + 0.2), Si * 0.13, 0.55, Si * 0.4, 0.12, 1.1);
    }
  }
}

/**
 * El palacio de las Eras IV y V (estilo 4 y 5; el de Pela o Vergina; desde la IV por Víctor, 2026-11-16): el ala del fondo de dos plantas, las de los lados y el frente alrededor de un gran
 * patio porticado, y en medio del frente, a la calle (+v), el propileo.
 */
function palacioHelenistico(m: Marco, estilo: number): void {
  const L = m.L - 0.6, S = m.S - 0.6, d = Math.min(2.4, S * 0.24), dl = Math.min(2.0, L * 0.2), df = Math.min(1.8, S * 0.18), pw = Math.min(3.2, L * 0.34);
  bloque(m, estilo, 0, -S / 2 + d / 2, L, d, { plantas: 2, frente: 1 });
  const ls = S - d - df, vs = -S / 2 + d + ls / 2, wf = (L - pw) / 2;
  for (const a of [-1, 1]) bloque(m, estilo, a * (L / 2 - dl / 2), vs, dl, ls, { plantas: 1 + (m.azar(70 + a) < 0.5 ? 1 : 0), frente: 1 });
  for (const a of [-1, 1]) bloque(m, estilo, a * (pw / 2 + wf / 2), S / 2 - df / 2, wf, df, { plantas: 1, frente: 1 });
  patioPorticado(m, 0, vs, L - 2 * dl, ls, 1.2, true);
  propileo(m, 0, S / 2 - df / 2, pw, df);
}

/** El propileo: la puerta monumental de `w` de ancho y `hondo` de fondo, a la calle (+v): gradas, dos filas de columnas, el muro con la puerta en
 * medio, el entablamento y el tejado con su frontón a la calle. */
function propileo(m: Marco, u: number, v: number, w: number, hondo: number): void {
  const p = piedraNoble(m), h = 1.9, n = 4;
  let y = 0;
  for (let k = 0; k < 2; k++) { m.caja(k ? p : oscurecer(p, 0.92), u, v, w + 0.3 - k * 0.2, hondo + 0.3 - k * 0.2, 0.12, y); y += 0.12; }
  for (const b of [-1, 1]) for (let i = 0; i < n; i++) columna(m, u - w / 2 + 0.2 + ((w - 0.4) * i) / (n - 1), v + b * (hondo / 2 - 0.2), h, y, true);
  m.caja(COLOR.sillar, u, v, w - 0.2, 0.25, h, y);
  m.caja(COLOR.hueco, u, v + 0.13, Math.min(1.2, w * 0.4), 0.04, h * 0.75, y);
  m.caja(p, u, v, w, hondo, 0.24, y + h);
  tejado(m, 'teja', u, v, hondo, w, y + h + 0.24, p, Math.PI / 2);
}

/**
 * El Centro Urbano de la Era II en los niveles 2 y 3, la de después del colapso de los palacios (el héroon de Lefkandi): la gran casa larga del jefe, absidal, de barro
 * sobre zócalo de piedra y techo de paja, con una galería de postes alrededor; su hogar delante, el granero y, en los estilos altos, las casas
 * largas de los suyos; todo dentro de una cerca de piedra seca.
 */
function heroon(m: Marco, estilo: number): void {
  const L = m.L - 0.6, S = m.S - 0.6, s = S * (estilo >= 4 ? 0.4 : 0.34), l = L * (estilo >= 5 ? 0.86 : 0.78), v = -S * 0.16;
  const alto = estilo >= 4 ? 1.45 : 1.25;
  casaLarga(m, 0, v, l, s, { muro: COLOR.barro, alto, abside: true });
  // la galería: postes a lo largo de los dos lados largos y del frente, bajo el alero
  const n = Math.max(4, Math.round(l / 0.75)), dv = s / 2 + 0.16;
  for (let i = 0; i < n; i++) for (const b of [-1, 1]) m.poste(COLOR.madera, -l / 2 + s / 2 + ((l - s / 2) * i) / (n - 1), v + b * dv, alto * 0.95, 0.12);
  for (const b of [-0.5, 0, 0.5]) m.poste(COLOR.madera, l / 2 + 0.16, v + b * s * 0.7, alto * 0.95, 0.12);
  // el hogar delante de la puerta; el granero y la casa larga de los suyos (o la leña) a los lados de la entrada de la cerca, que queda libre
  const uh = Math.min(l / 2 + 0.7, L / 2 - 0.5);
  m.forma('cilindro', COLOR.piedraOscura, uh, v, 0.8, 0.8, 0.12);
  m.forma('cono', COLOR.fuego, uh, v, 0.32, 0.32, 0.36, 0.12);
  graneroEnPilotes(m, L * 0.32, S * 0.3, 1.2, 1.0);
  if (estilo >= 4) casaLarga(m, -L * 0.27, S * 0.3, L * 0.28, S * 0.2, { muro: COLOR.barro, alto: 0.95, abside: m.azar(72) < 0.5 });
  else lena(m, -L * 0.25, S * 0.34, 1.2, 3);
  if (estilo <= 2) cercoPostes(m, L, S);
  else cerco(m, 0, 0, L + 0.3, S + 0.3, true, COLOR.piedra);
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
  if (m.era >= 4 && estilo >= 3) return bouleuterion(m, estilo, L, S);
  // desde la Era III, la sala con el frente de templo: el pórtico de columnas en el hastial de +u y el frontón encima
  if (m.era >= 3 && estilo >= 3) {
    templo(m, 0, 0, L * 0.92, S * 0.8, { periptero: false, alto: estilo >= 4 ? 1.9 : 1.5, muro: fabrica(m, estilo) });
    return;
  }
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

/**
 * El bouleuterion (Eras IV y V): la sala cuadrada de sillería con sus hiladas, el tejado a cuatro aguas y delante (+u) el pórtico de columnas con su
 * frontón, todo sobre un zócalo de piedra clara.
 */
function bouleuterion(m: Marco, estilo: number, L: number, S: number): void {
  const a = Math.min(S * 0.9, L * 0.72), p = Math.max(0.8, Math.min(1.5, L - a - 0.3)), H = estilo >= 4 ? 2.2 : 1.8, base = 0.2, piedra = piedraNoble(m);
  // la sala de −(a + p)/2 a a/2 − p/2; el pórtico de ahí a (a + p)/2
  const us = -p / 2, up = a / 2, hc = H - 0.25, n = Math.max(4, Math.round((a - 0.4) / 0.75) + 1);
  m.caja(oscurecer(COLOR.piedraClara, 0.92), 0, 0, a + p, a + 0.2, base * 0.5);
  m.caja(COLOR.piedraClara, 0, 0, a + p - 0.12, a + 0.08, base);
  m.caja(COLOR.sillar, us, 0, a, a, H, base);
  hiladas(m, us, 0, a, a, base, H);
  // las ventanas altas de los costados, que dan luz a las gradas de dentro
  for (const b of [-1, 1]) for (const k of [-1, 0, 1]) m.caja(COLOR.hueco, us + k * a * 0.28, b * (a / 2 + 0.01), 0.3, 0.05, 0.36, base + H - 0.62);
  aCuatroAguas(m, m.azar(44) < 0.3 ? COLOR.tejaVieja : COLOR.teja, us, 0, a + 0.3, a + 0.3, Math.min(1.1, a * 0.24), base + H);
  m.caja(COLOR.hueco, us + a / 2 + 0.01, 0, 0.06, Math.min(0.9, a * 0.2), H * 0.6, base);
  for (let i = 0; i < n; i++) columna(m, up + p / 2 - 0.2, -a / 2 + 0.2 + ((a - 0.4) * i) / (n - 1), hc, base, estilo >= 4);
  m.caja(piedra, up, 0, p, a, 0.22, base + hc);
  // el tejado del pórtico entra en el de la sala, que tapa su hastial de atrás
  const dentro = Math.min(2.0, a * 0.45);
  tejado(m, 'teja', up - dentro / 2, 0, p + dentro, a, base + hc + 0.22, piedra);
}

/**
 * Un templo griego de `l` (a lo largo de u) por `s` sobre sus tres gradas: con `periptero`, columnas por los cuatro lados alrededor de la cella;
 * sin él, solo el pórtico en el hastial de +u delante de la sala. El entablamento con la franja del friso (pintada en la Era III) y el tejado de
 * teja con sus frontones. Las columnas, las de la época (en la V, corintias). Devuelve la altura de la cumbrera.
 */
function templo(m: Marco, u: number, v: number, l: number, s: number, o: { periptero: boolean; alto: number; muro: number; diptero?: boolean; podio?: number }): number {
  const p = piedraNoble(m);
  let y = 0;
  if (o.podio) {
    // sobre un podio alto (Era V): la escalinata metida en su frente (+u) y el templo encima, en lo que queda
    const st = Math.min(1.4, l * 0.2), n = 7;
    m.caja(oscurecer(p, 0.86), u - st / 2, v, l - st + 0.06, s + 0.06, 0.2);
    m.caja(oscurecer(p, 0.92), u - st / 2, v, l - st, s, o.podio);
    m.caja(oscurecer(p, 0.86), u - st / 2, v, l - st + 0.06, s + 0.06, 0.12, o.podio - 0.12);
    for (let k = 0; k < n; k++) m.caja(k % 2 ? p : oscurecer(p, 0.96), u + l / 2 - st + (st * (k + 0.5)) / n, v, st / n + 0.01, Math.min(s * 0.7, s - 0.4), (o.podio * (n - k)) / n);
    u -= st / 2;
    l -= st;
    y = o.podio;
  } else for (let k = 0; k < 3; k++) { m.caja(k ? p : oscurecer(p, 0.92), u, v, l + 0.4 - k * 0.2, s + 0.4 - k * 0.2, 0.12, y); y += 0.12; }
  const paso = 0.62, nu = Math.max(3, Math.round(l / paso) + 1), nv = Math.max(2, Math.round(s / paso) + 1);
  const en = (i: number, n: number, a: number): number => -a / 2 + 0.16 + ((a - 0.32) * i) / (n - 1);
  if (o.periptero) {
    for (let i = 0; i < nu; i++) for (const b of [-1, 1]) columna(m, u + en(i, nu, l), v + b * (s / 2 - 0.16), o.alto, y, m.era >= 5);
    for (let j = 1; j < nv - 1; j++) for (const a of [-1, 1]) columna(m, u + a * (l / 2 - 0.16), v + en(j, nv, s), o.alto, y, m.era >= 5);
    // el díptero: una segunda fila de columnas por dentro, y la cella más estrecha
    const di = o.diptero ? 0.6 : 0;
    if (di) {
      const li = l - 2 * di, si = s - 2 * di, nui = Math.max(3, Math.round(li / paso) + 1), nvi = Math.max(2, Math.round(si / paso) + 1);
      for (let i = 0; i < nui; i++) for (const b of [-1, 1]) columna(m, u + en(i, nui, li), v + b * (si / 2 - 0.16), o.alto, y, true);
      for (let j = 1; j < nvi - 1; j++) for (const a of [-1, 1]) columna(m, u + a * (li / 2 - 0.16), v + en(j, nvi, si), o.alto, y, true);
    }
    m.caja(o.muro, u - 0.15, v, l - 1.3 - 2 * di, s - 1.0 - 2 * di, o.alto, y);
    m.caja(COLOR.hueco, u + l / 2 - 0.66, v, 0.06, Math.min(0.7, s * 0.22), o.alto * 0.7, y);
  } else {
    const hondo = Math.min(1.1, l * 0.24);
    m.caja(o.muro, u - hondo / 2, v, l - hondo, s, o.alto, y);
    for (const b of [-1, 1]) m.caja(o.muro, u + l / 2 - hondo / 2, v + b * (s / 2 - 0.12), hondo, 0.24, o.alto, y);
    for (let j = 1; j < nv - 1; j++) columna(m, u + l / 2 - 0.16, v + en(j, nv, s), o.alto, y, m.era >= 5);
    m.caja(COLOR.hueco, u + l / 2 - hondo + 0.01, v, 0.06, Math.min(0.8, s * 0.25), o.alto * 0.7, y);
  }
  m.caja(p, u, v, l, s, 0.26, y + o.alto);
  m.caja(m.era === 3 ? oscurecer(COLOR.azul, 0.7) : oscurecer(p, 0.9), u, v, l + 0.02, s + 0.02, 0.1, y + o.alto + 0.12);
  return tejado(m, 'teja', u, v, l, s, y + o.alto + 0.26, p);
}

/** La Maravilla: un túmulo de piedra en los bajos; un templo escalonado en los altos; desde la Era III, el gran templo con columnas alrededor. */
function maravilla(m: Marco, estilo: number): void {
  const L = m.L - 0.6, S = m.S - 0.6, lado = Math.min(L, S);
  if (m.era >= 3 && estilo >= 3) {
    // el recinto sagrado enlosado, el templo en medio, el altar delante de su puerta (en +u) y cipreses en las esquinas
    m.losa(COLOR.losa, 0, 0, L, S, 0.04);
    // en la Era V, el gran templo: díptero si cabe la doble fila (y le toca), si no, sobre su podio alto
    const grande = m.era === 5, l = L * (grande ? 0.74 : 0.66), s = Math.min(S * (grande ? 0.62 : 0.56), l * 0.55);
    const diptero = grande && s >= 3.6 && m.azar(46) < 0.55;
    templo(m, -L * 0.06, 0, l, s, { periptero: true, alto: Math.max(1.8, s * 0.42), muro: m.era >= 4 ? COLOR.marmol : COLOR.sillar, diptero, podio: grande && !diptero ? Math.min(1.3, s * 0.3) : 0 });
    const ua = Math.min(-L * 0.06 + l / 2 + 1.1, L / 2 - 0.6);
    m.caja(oscurecer(piedraNoble(m), 0.92), ua, 0, 0.8, 1.3, 0.5);
    m.forma('cono', COLOR.fuego, ua, 0, 0.3, 0.3, 0.3, 0.5);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) arbol(m, a * (L / 2 - 0.5), b * (S / 2 - 0.5), 0.5, 3);
    return;
  }
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
  else casita(m, estilo, L / 2 - 0.9, -S / 2 + 0.7, 1.2, 0.9, 0.9);
  almiar(m, -L / 2 + 0.7, -S / 2 + 0.7, 0.4);
}

function lenera(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4;
  // cobertizo abierto de postes
  const cl = L * 0.55, cs = S * 0.45, cu = -L / 2 + cl / 2, cv = -S / 2 + cs / 2;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, cu + a * (cl / 2 - 0.08), cv + b * (cs / 2 - 0.08), 0.95, 0.1);
  if (m.era > 1) techoLigero(m, estilo, cu, cv, cl, cs, 0.95, COLOR.madera);
  else if (estilo <= 2) m.forma('aguas', COLOR.paja, cu, cv, cl + 0.2, cs + 0.3, cs * 0.55, 0.95);
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
  // el rebaño, solo en los corrales de la aldea ganadera (motor 3d05872; `cultivo: 'ganado'`, lo pone `puebloEnVista`): un abrevadero y, en la
  // mitad libre, unas reses y unas ovejas paciendo, cada corral con las suyas (la semilla del edificio)
  if (m.e.cultivo !== 'ganado') return;
  abrevadero(m, r * 0.05, -r * 0.1, Math.min(1.4, r * 0.45), 0, estilo >= 3);
  // a 1,7 de la bestia de tiro: que se lean como rebaño desde la cámara de la plaza
  const cabezas = 5 + Math.floor(m.azar(60) * 3), k = 1.7;
  for (let i = 0; i < cabezas; i++) {
    const u = (-0.6 + (1.2 * (i + 0.5)) / cabezas + 0.08 * (m.azar(61 + i) - 0.5)) * r, v = (0.32 + 0.33 * m.azar(70 + i)) * r;
    const a = m.azar(80 + i) * Math.PI * 2;
    if (m.azar(90 + i) < 0.35) oveja(m, u, v, a, k);
    else bestia(m, u, v, a, false, m.azar(100 + i) < 0.5 ? COLOR.buey : COLOR.res, k);
  }
}

function caballerizas(m: Marco, estilo: number): void {
  const L = m.L - 0.4, S = m.S - 0.4, s = S * 0.45, v = -S / 2 + s / 2;
  // la cuadra larga, abierta por delante con sus postes
  m.caja(estilo <= 2 ? COLOR.madera : fabrica(m, estilo), 0, v - s * 0.3, L, s * 0.4, 1.0);
  const n = Math.max(3, Math.round(L / 0.9));
  for (let i = 0; i < n; i++) m.poste(COLOR.madera, -L / 2 + 0.1 + ((L - 0.2) * i) / (n - 1), v + s / 2 - 0.08, 1.0, 0.1);
  if (m.era > 1) techoLigero(m, estilo, 0, v, L, s, 1.0, fabrica(m, estilo));
  else if (estilo <= 2) m.forma('aguas', COLOR.paja, 0, v, L + 0.2, s + 0.3, s * 0.5, 1.0);
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
  if (m.era > 1) techoLigero(m, estilo, u, v, l, s, h, COLOR.maderaOscura);
  else if (estilo <= 2) m.forma('aguas', COLOR.paja, u, v, l + 0.2, s + 0.25, s * 0.5, h);
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

// ───────────────────────────── Los talleres de la comida y la estatua (tanda 69) ─────────────────────────────

/** Sacos de lona en fila (de harina o de grano). */
function sacos(m: Marco, u: number, v: number, n: number, color = COLOR.lona): void {
  for (let i = 0; i < n; i++) {
    m.forma('cilindro', color, u + i * 0.26, v, 0.24, 0.22, 0.3);
    m.forma('cupula', color, u + i * 0.26, v, 0.22, 0.2, 0.07, 0.3);
  }
}

/**
 * El molino (2 × 2 celdas): la casa al fondo y en el patio la muela de sangre, la de piedra que se mueve dando vueltas: la solera ancha, la muela
 * de encima, el eje y la vara. Con su buey (`Edificio.buey`), el buey uncido a la vara sobre el camino que pisa; sin él, la vara apoyada y la
 * gente la mueve a mano (no se ve). Sacos de harina y el montón de trigo por moler.
 */
function molino(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s) => {
    const cu = u - l * 0.12, cv = pv(0.5), r = Math.max(0.7, Math.min(s * 0.4, l * 0.3, 1.35));
    // el camino redondo que pisa la bestia, la solera y la muela
    m.forma('cilindro', COLOR.tierraOscura, cu, cv, 2 * r + 0.5, 2 * r + 0.5, 0.02);
    m.forma('cilindro', COLOR.tierra, cu, cv, 2 * r - 0.35, 2 * r - 0.35, 0.03);
    m.forma('cilindro', COLOR.piedra, cu, cv, 0.95, 0.95, 0.3);
    m.forma('cilindro', COLOR.piedraOscura, cu, cv, 0.66, 0.66, 0.26, 0.3);
    m.poste(COLOR.maderaOscura, cu, cv, 1.2, 0.11);
    const a = m.entre(70, 0, Math.PI * 2), bu = cu + Math.cos(a) * r, bv = cv + Math.sin(a) * r;
    if (m.e.buey) {
      // la vara del eje al yugo y el buey de lado, mirando hacia donde anda (la tangente)
      m.viga(COLOR.madera, cu, cv, bu, bv, 0.62, 0.08);
      bestia(m, bu, bv, a + Math.PI / 2, false);
    } else {
      m.viga(COLOR.madera, cu, cv, cu + Math.cos(a) * r * 0.9, cv + Math.sin(a) * r * 0.9, 0.62, 0.08);
    }
    // la harina en sacos y el trigo por moler
    sacos(m, u + l / 2 - 0.95, pv(0.22), 3);
    m.forma('cono', COLOR.trigo, u + l / 2 - 0.6, pv(0.72), 0.8, 0.8, 0.45);
  });
}

/** El horno de pan (2 × 1): la casa al fondo y delante dos hornos de cúpula con su boca encendida, la leña y la mesa con los panes. */
function panaderia(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s) => {
    const r = Math.min(0.48, s * 0.38);
    for (const k of [-1, 1]) {
      // la boca (el hueco de `horno`) da a +v: la brasa, dentro
      const uu = u + k * l * 0.3;
      horno(m, uu, pv(0.45), r, estilo >= 3 ? COLOR.adobe : COLOR.barro);
      m.caja(COLOR.fuego, uu, pv(0.45) + r * 0.93, r * 0.4, 0.04, r * 0.3, 0.02);
    }
    lena(m, u - l * 0.02, pv(0.25), 0.7, 2);
    m.caja(COLOR.maderaOscura, u + l * 0.02, pv(0.75), 0.8, 0.26, 0.42);
    m.caja(COLOR.madera, u + l * 0.02, pv(0.75), 0.9, 0.34, 0.06, 0.42);
    for (const k of [-0.28, 0, 0.28]) m.forma('cupula', COLOR.pan, u + l * 0.02 + k, pv(0.75), 0.22, 0.16, 0.08, 0.48);
  });
}

/** La quesera (2 × 1): la casa al fondo y delante el caldero al fuego, las tinajas de la leche y el estante con los quesos curándose. */
function quesera(m: Marco, estilo: number): void {
  taller(m, estilo, (u, pv, l, s) => {
    const uc = u - l * 0.3, vc = pv(0.45);
    // el caldero sobre su fuego
    m.caja(COLOR.fuego, uc, vc, 0.3, 0.3, 0.06);
    for (const k of [-1, 1]) m.caja(COLOR.piedraOscura, uc + k * 0.24, vc, 0.12, 0.3, 0.2);
    m.forma('cupula', COLOR.bronce, uc, vc, 0.5, 0.5, 0.28, 0.2);
    tinajas(m, uc + 0.45, pv(0.2), 2, COLOR.enlucido);
    // el estante de los quesos: dos baldas con sus quesos en fila
    const ue = u + l * 0.22, ve = pv(0.55), le = Math.min(1.5, l * 0.4), d = Math.min(0.34, s * 0.3);
    for (const k of [-1, 1]) m.poste(COLOR.madera, ue + (k * le) / 2, ve, 0.85, 0.06);
    for (const y of [0.3, 0.62]) {
      m.caja(COLOR.madera, ue, ve, le, d, 0.04, y);
      const n = Math.max(2, Math.floor(le / 0.3));
      for (let i = 0; i < n; i++) m.forma('cilindro', COLOR.queso, ue - le / 2 + (le * (i + 0.5)) / n, ve, 0.22, 0.22, 0.12, y + 0.04);
    }
  });
}

/**
 * La bodega (2 × 2): la casa al fondo y en el patio, según su receta (`Edificio.receta`, motor b55e90f). La del vino: el lagar donde se pisa
 * la uva (con el mosto), una parra encima y las grandes tinajas del vino, tapadas. La de la cerveza: la era donde la cebada mojada echa el
 * germen (la malta), extendida, el caldero al fuego donde se cuece, los sacos de cebada y las tinajas abiertas con la cerveza y su espuma.
 */
function bodega(m: Marco, estilo: number): void {
  const cerveza = m.e.receta === 'cebada';
  taller(m, estilo, (u, pv, l, s) => {
    const ul = u - l * 0.22, vl = pv(0.4), ll = Math.min(1.8, l * 0.4), sl = Math.min(1.3, s * 0.45), borde = estilo >= 4 ? COLOR.enlucidoSombra : COLOR.piedra;
    if (cerveza) {
      // la era de la malta: un enlosado bajo con su bordillo y la cebada germinada extendida en dos tonos, y el rastrillo
      m.caja(borde, ul, vl, ll, sl, 0.08);
      m.losa(COLOR.malta, ul, vl, ll - 0.14, sl - 0.14, 0.03, 0.08);
      for (let i = 0; i < 3; i++) m.losa(COLOR.cebada, ul - ll / 2 + 0.3 + i * ((ll - 0.6) / 2), vl, 0.18, sl - 0.3, 0.02, 0.11);
      m.forma('cilindro', COLOR.madera, ul + ll / 2 - 0.1, vl + sl * 0.3, 0.04, 0.04, ll - 0.3, 0.12, Math.PI / 2, Math.PI / 2);
      // el caldero de cocer sobre su fuego, entre la era y las tinajas
      const uc = ul + ll / 2 + 0.35, vc = pv(0.78);
      m.caja(COLOR.fuego, uc, vc, 0.3, 0.3, 0.06);
      for (const k of [-1, 1]) m.caja(COLOR.piedraOscura, uc + k * 0.24, vc, 0.12, 0.3, 0.2);
      m.forma('cilindro', COLOR.bronce, uc, vc, 0.52, 0.52, 0.26, 0.2);
      m.forma('cilindro', COLOR.cerveza, uc, vc, 0.44, 0.44, 0.02, 0.45);
      sacos(m, ul - ll / 2 + 0.15, pv(0.85), 3, COLOR.lonaVieja);
    } else {
      // el lagar: una pila baja de piedra (de enlucido en los altos) con el mosto y unos racimos al borde
      m.caja(borde, ul, vl, ll, sl, 0.32);
      m.losa(COLOR.mosto, ul, vl, ll - 0.18, sl - 0.18, 0.02, 0.31);
      m.caja(borde, ul + ll / 2 + 0.15, vl, 0.3, 0.26, 0.16);
      for (let i = 0; i < 4; i++) m.forma('copa', COLOR.uva, ul - ll / 2 + 0.25 + i * 0.36, vl - sl / 2 - 0.12, 0.2, 0.2, 0.2);
      // la parra sobre el lagar
      if (s > 1.6) pergola(m, ul, vl, ll + 0.4, sl + 0.4, 0, 1.05, true);
    }
    // las tinajas grandes, medio enterradas, en filas: las del vino tapadas; las de la cerveza abiertas, con la cerveza y la espuma
    const n = Math.max(2, Math.floor((l * 0.4) / 0.42)), filas = s > 2 ? 2 : 1;
    for (let j = 0; j < filas; j++) for (let i = 0; i < n; i++) {
      const uu = u + l * 0.1 + i * 0.42, vv = pv(0.3 + j * 0.4);
      m.forma('cilindro', COLOR.barro, uu, vv, 0.36, 0.36, 0.42);
      if (cerveza) {
        m.forma('cilindro', COLOR.barro, uu, vv, 0.3, 0.3, 0.06, 0.42);
        m.forma('cilindro', COLOR.cerveza, uu, vv, 0.24, 0.24, 0.02, 0.47);
        m.forma('cupula', COLOR.espuma, uu, vv, 0.16, 0.16, 0.04, 0.48);
      } else {
        m.forma('cupula', COLOR.barro, uu, vv, 0.36, 0.36, 0.1, 0.42);
        m.forma('cilindro', COLOR.ocre, uu, vv, 0.14, 0.14, 0.08, 0.5);
      }
    }
  });
}

/**
 * La prensa de aceite (2 × 1): la casa al fondo y delante la prensa de viga, la de la Edad del Bronce: la viga larga metida por un extremo en
 * el muro, que aprieta los capachos sobre la piedra de prensar, con la piedra que cuelga del otro extremo; las tinajas del aceite y lo que se
 * prensa, según su receta (`Edificio.receta`, motor b55e90f): la aceituna, oscura, en cestos; o el sésamo, la semilla clara, en cestos y
 * sacos, con la muela de mano donde se tuesta y se machaca antes de prensarlo.
 */
function prensa(m: Marco, estilo: number): void {
  const sesamo = m.e.receta === 'sesamo', fruto = sesamo ? COLOR.sesamo : COLOR.aceituna;
  taller(m, estilo, (u, pv, l, _s, f) => {
    const vv = pv(0.45), u0 = u - l / 2 + 0.25, up = u - l * 0.12, u1 = u + l * 0.3;
    // la piedra de prensar con su canal y los capachos apilados encima
    m.forma('cilindro', COLOR.piedra, up, vv, 0.8, 0.8, 0.26);
    m.caja(COLOR.piedra, up, vv + f * 0.4, 0.14, 0.3, 0.1);
    for (let k = 0; k < 3; k++) m.forma('cilindro', k % 2 ? COLOR.zarzo : fruto, up, vv, 0.6, 0.6, 0.1, 0.26 + k * 0.1);
    // el poste del muro donde entra la viga, la viga y la piedra colgada de su punta
    m.caja(estilo <= 2 ? COLOR.madera : COLOR.piedraOscura, u0, vv, 0.3, 0.4, 1.0);
    m.viga(COLOR.maderaOscura, u0, vv, u1, vv, 0.68, 0.16, 0.18);
    m.poste(COLOR.cuerda, u1 - 0.05, vv, 0.4, 0.03, 0.3);
    m.caja(COLOR.piedraOscura, u1 - 0.05, vv, 0.42, 0.36, 0.3);
    // el aceite en tinajas y el fruto en cestos
    tinajas(m, u + l / 2 - 0.85, pv(0.2), 3, COLOR.ocre);
    for (let i = 0; i < 2; i++) {
      m.forma('cilindro', COLOR.zarzo, u + l / 2 - 0.7 + i * 0.32, pv(0.75), 0.28, 0.28, 0.22);
      m.forma('copa', fruto, u + l / 2 - 0.7 + i * 0.32, pv(0.75), 0.24, 0.24, 0.1, 0.18);
    }
    if (sesamo) {
      // la muela de mano (la piedra de moler y su mano) con el sésamo machacado, y un saco
      m.caja(COLOR.piedra, u + l * 0.1, pv(0.8), 0.5, 0.3, 0.14);
      m.losa(COLOR.sesamo, u + l * 0.1, pv(0.8), 0.36, 0.2, 0.02, 0.14);
      m.forma('cilindro', COLOR.piedraOscura, u + l * 0.1, pv(0.8), 0.1, 0.1, 0.3, 0.2, Math.PI / 2, Math.PI / 2);
      sacos(m, u + l / 2 - 0.25, pv(0.5), 1, COLOR.lonaVieja);
    }
  });
}

/**
 * La estatua de la capital (1 × 1): sobre un pedestal de dos gradas, una figura de pie con la lanza en alto (de piedra hasta el estilo 3; de
 * bronce desde el 4), en un enlosado con dos braseros a los lados.
 */
function estatua(m: Marco, estilo: number): void {
  const lado = Math.min(m.L, m.S) - 0.3, piedra = estilo >= 4 ? COLOR.piedraClara : COLOR.piedra, figura = estilo >= 4 ? COLOR.bronce : COLOR.rocaClara;
  m.losa(estilo >= 3 ? COLOR.losa : COLOR.tierra, 0, 0, lado, lado, 0.04);
  m.caja(piedra, 0, 0, 1.3, 1.3, 0.25);
  m.caja(piedra, 0, 0, 0.95, 0.95, 0.4, 0.25);
  const franja = franjaDe(m, estilo);
  if (franja !== undefined) m.caja(franja, 0, 0, 0.97, 0.97, 0.08, 0.5);
  // la figura: las piernas, la túnica, el pecho, los hombros, la cabeza; un brazo con la lanza y el otro con el escudo
  const y = 0.65;
  for (const k of [-0.09, 0.09]) m.forma('cilindro', figura, 0, k, 0.13, 0.13, 0.5, y);
  m.forma('cilindro', figura, 0, 0, 0.36, 0.3, 0.32, y + 0.4);
  m.caja(figura, 0, 0, 0.22, 0.4, 0.4, y + 0.7);
  m.caja(figura, 0, 0, 0.2, 0.54, 0.1, y + 1.04);
  m.forma('cilindro', figura, 0, 0, 0.09, 0.09, 0.08, y + 1.14);
  m.forma('cupula', figura, 0, 0, 0.2, 0.2, 0.24, y + 1.2);
  m.caja(figura, 0, 0.3, 0.1, 0.1, 0.45, y + 1.0);
  m.forma('cilindro', figura, 0.04, 0.32, 0.04, 0.04, 1.5, y + 0.55);
  m.forma('cono', figura, 0.04, 0.32, 0.08, 0.08, 0.18, y + 2.05);
  m.forma('cilindro', figura, 0.08, -0.38, 0.42, 0.42, 0.05, y + 0.8, 0, Math.PI / 2);
  // los braseros, delante de la figura (que mira hacia +u)
  for (const k of [-1, 1]) {
    const uu = lado / 2 - 0.3, vv = k * (lado / 2 - 0.3);
    m.poste(COLOR.bronce, uu, vv, 0.5, 0.06);
    m.forma('cupula', COLOR.bronce, uu, vv, 0.3, 0.3, 0.12, 0.5);
    m.forma('cono', COLOR.fuego, uu, vv, 0.16, 0.16, 0.18, 0.56);
  }
}

// ───────────────────────────── Las granjas de las aldeas de viñas y de olivos (tanda 69) ─────────────────────────────

/** La viña: la tierra labrada, las hileras de cepas en su espaldera (postes y una vara), su cerca y los cestos de la vendimia. */
function vina(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3;
  m.losa(COLOR.tierra, 0, 0, L - 0.2, S - 0.2, 0.03);
  // las hileras, a lo largo; al fondo de +v, junto al hueco de la cerca, queda sitio para los cestos
  const filas = Math.max(2, Math.floor((S - 1.1) / 0.75) + 1), largo = L - 0.9;
  for (let i = 0; i < filas; i++) {
    const v = -S / 2 + 0.45 + ((S - 1.3) * i) / Math.max(1, filas - 1);
    const n = Math.max(2, Math.round(largo / 1.2));
    for (let k = 0; k <= n; k++) m.poste(COLOR.madera, -largo / 2 + (largo * k) / n, v, 0.6, 0.05);
    m.viga(COLOR.madera, -largo / 2, v, largo / 2, v, 0.55, 0.03);
    // las cepas entre poste y poste: el tronco retorcido y la hoja encima, con algún racimo
    const c = Math.max(3, Math.round(largo / 0.4));
    for (let k = 0; k < c; k++) {
      const u = -largo / 2 + (largo * (k + 0.5)) / c;
      m.poste(COLOR.cepa, u, v, 0.35, 0.06);
      m.forma('copa', k % 3 ? COLOR.vid : COLOR.hoja, u, v, 0.42, 0.3, 0.3, 0.36);
      if (m.azar(800 + i * 50 + k) < 0.3) m.forma('copa', COLOR.uva, u, v + 0.14, 0.1, 0.1, 0.14, 0.3);
    }
  }
  if (estilo <= 2) cerco(m, 0, 0, L, S, false);
  else cerco(m, 0, 0, L, S, true, estilo >= 4 ? COLOR.piedraClara : COLOR.piedra);
  // los cestos de la vendimia
  for (let i = 0; i < 3; i++) {
    m.forma('cilindro', COLOR.zarzo, -L / 2 + 0.45 + i * 0.3, S / 2 - 0.35, 0.24, 0.24, 0.2);
    m.forma('copa', COLOR.uva, -L / 2 + 0.45 + i * 0.3, S / 2 - 0.35, 0.2, 0.2, 0.1, 0.16);
  }
}

/** El olivar: olivos en tresbolillo sobre la tierra clara, la cerca de piedra seca (de varas en los bajos), la escalera de varear y los cestos. */
function olivar(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3, paso = 1.55;
  m.losa(COLOR.rastrojo, 0, 0, L - 0.2, S - 0.2, 0.03);
  const nu = Math.max(1, Math.floor((L - 0.8) / paso)), nv = Math.max(1, Math.floor((S - 0.8) / (paso * 0.87)));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if ((j % 2) && i === nu - 1) continue;
    const u = -((nu - 1) * paso) / 2 + i * paso + (j % 2 ? paso / 2 : 0), v = -((nv - 1) * paso * 0.87) / 2 + j * paso * 0.87;
    const k = m.azar(900 + j * 40 + i), g = 0.85 + 0.3 * k;
    // el tronco grueso y retorcido, la copa ancha y plateada
    m.forma('cilindro', COLOR.tronco, u, v, 0.2 * g, 0.2 * g, 0.55 * g);
    m.forma('copa', COLOR.olivo, u, v, 1.15 * g, 1.05 * g, 0.75 * g, 0.4 * g);
    if (k < 0.25) m.forma('copa', COLOR.aceituna, u + 0.2, v + 0.15, 0.3, 0.3, 0.22, 0.55 * g);
  }
  if (estilo <= 2) cerco(m, 0, 0, L, S, false);
  else cerco(m, 0, 0, L, S, true, estilo >= 4 ? COLOR.piedraClara : COLOR.piedra);
  // la escalera de varear apoyada y los cestos
  const eu = -L / 2 + 0.55, ev = S / 2 - 0.4;
  for (const k of [-0.12, 0.12]) m.forma('cilindro', COLOR.madera, eu + k, ev, 0.04, 0.04, 1.1, 0, 0, 0.35);
  for (let i = 0; i < 2; i++) {
    m.forma('cilindro', COLOR.zarzo, eu + 0.45 + i * 0.3, ev, 0.24, 0.24, 0.2);
    m.forma('copa', COLOR.aceituna, eu + 0.45 + i * 0.3, ev, 0.2, 0.2, 0.1, 0.16);
  }
}

// ───────────────────────────── Las granjas de las aldeas de cebada y de sésamo (motor b55e90f) ─────────────────────────────

/**
 * El cebadal: la tierra labrada en surcos con la cebada en pie, densa y baja, de verde que amarillea a espiga; al fondo de +v, junto al hueco
 * de la cerca, la parte segada con las gavillas atadas y una hacina; la cerca, la choza del campo (la casa en los altos) y la hoz en su poste.
 */
function cebadal(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3;
  m.losa(COLOR.tierra, 0, 0, L - 0.2, S - 0.2, 0.03);
  // la cebada en pie, en surcos a lo largo; lo segado (el rastrojo) a lo largo de +v
  const segado = Math.min(1.3, S * 0.28), largo = L - 0.6;
  const filas = Math.max(2, Math.floor((S - segado - 0.6) / 0.42) + 1);
  for (let i = 0; i < filas; i++) {
    const v = -S / 2 + 0.4 + ((S - segado - 0.8) * i) / Math.max(1, filas - 1);
    // las cañas verdes, la franja de las espigas encima y las espigas con sus barbas, de punta, a tresbolillo de surco a surco
    m.caja(COLOR.cebadaVerde, 0, v, largo, 0.3, 0.26, 0.03);
    m.caja(i % 2 ? COLOR.cebada : COLOR.heno, 0, v, largo - 0.04, 0.26, 0.08, 0.29);
    const c = Math.max(3, Math.round(largo / 0.35));
    for (let k = 0; k < c; k++) m.forma('cono', m.azar(820 + i * 40 + k) < 0.5 ? COLOR.cebada : COLOR.heno, -largo / 2 + (largo * (k + (i % 2 ? 0.25 : 0.75))) / c, v, 0.1, 0.1, 0.16, 0.37);
  }
  const vs = S / 2 - segado / 2 - 0.1;
  m.losa(COLOR.rastrojo, 0, vs, largo, segado - 0.1, 0.02, 0.03);
  // las gavillas en pie, atadas por el medio, y una hacina (las gavillas apiladas en cono)
  const n = Math.max(2, Math.floor((largo * 0.5) / 0.5));
  for (let i = 0; i < n; i++) {
    const gu = -largo / 2 + 0.4 + i * 0.5, gv = vs - segado * 0.15;
    m.forma('cilindro', COLOR.cebada, gu, gv, 0.2, 0.2, 0.42, 0.03);
    m.forma('cilindro', COLOR.cuerda, gu, gv, 0.22, 0.22, 0.04, 0.2);
    m.forma('cono', COLOR.cebada, gu, gv, 0.3, 0.3, 0.16, 0.45);
  }
  m.forma('cono', COLOR.cebada, largo / 2 - 0.55, vs, 0.8, 0.8, 0.7, 0.03);
  if (estilo <= 2) cerco(m, 0, 0, L, S, false);
  else cerco(m, 0, 0, L, S, true, estilo >= 4 ? COLOR.piedraClara : COLOR.piedra);
  const ch = Math.min(0.7, S * 0.13);
  if (estilo <= 2) choza(m, L / 2 - ch - 0.3, -S / 2 + ch + 0.3, ch, { frente: 1 });
  else casita(m, estilo, L / 2 - 0.9, -S / 2 + 0.7, 1.2, 0.9, 0.9);
}

/**
 * El campo de sésamo: hileras de matas altas y finas, de hoja verde oscura, con sus flores blancas y rosadas; al fondo de +v, los haces
 * segados puestos de pie a secar, apoyados unos en otros (así se abren las cápsulas y suelta la semilla), y la estera con la semilla
 * extendida y los cestos. La cerca como la de las otras granjas.
 */
function sesamal(m: Marco, estilo: number): void {
  const L = m.L - 0.3, S = m.S - 0.3;
  m.losa(COLOR.tierra, 0, 0, L - 0.2, S - 0.2, 0.03);
  const secadero = Math.min(1.3, S * 0.3), largo = L - 0.7;
  const filas = Math.max(2, Math.floor((S - secadero - 0.6) / 0.6) + 1);
  for (let i = 0; i < filas; i++) {
    const v = -S / 2 + 0.4 + ((S - secadero - 0.8) * i) / Math.max(1, filas - 1);
    // la tierra del surco y las matas: el tallo, la hoja en dos pisos y alguna flor
    m.losa(COLOR.tierraOscura, 0, v, largo, 0.22, 0.02, 0.03);
    const c = Math.max(3, Math.round(largo / 0.38));
    for (let k = 0; k < c; k++) {
      const u = -largo / 2 + (largo * (k + 0.5)) / c, alto = 0.55 + 0.2 * m.azar(860 + i * 40 + k);
      m.poste(COLOR.mataSesamo, u, v, alto, 0.04, 0.03);
      m.forma('copa', COLOR.mataSesamo, u, v, 0.26, 0.22, 0.2, 0.18);
      m.forma('copa', COLOR.hoja, u, v, 0.18, 0.16, 0.16, alto * 0.62);
      if (m.azar(880 + i * 40 + k) < 0.55) m.forma('cupula', COLOR.florSesamo, u + 0.03, v + 0.04, 0.09, 0.09, 0.06, alto * 0.72);
    }
  }
  // los haces de pie, a secar: cada uno, un cono inclinado contra los otros
  const vs = S / 2 - secadero / 2 - 0.1, n = Math.max(2, Math.floor((largo * 0.55) / 0.75));
  for (let i = 0; i < n; i++) {
    const hu = -largo / 2 + 0.45 + i * 0.75;
    for (const [dv, inc] of [[-0.08, 0.25], [0.08, -0.25]] as const) m.forma('cono', COLOR.rastrojo, hu, vs + dv, 0.22, 0.22, 0.75, 0.03, 0, inc);
  }
  // la estera con la semilla y los cestos
  const ue = largo / 2 - 0.55;
  m.losa(COLOR.zarzo, ue, vs, 0.9, Math.min(0.8, secadero - 0.2), 0.02, 0.03);
  m.losa(COLOR.sesamo, ue, vs, 0.7, Math.min(0.6, secadero - 0.35), 0.02, 0.05);
  for (let i = 0; i < 2; i++) {
    m.forma('cilindro', COLOR.zarzo, ue - 0.25 + i * 0.3, vs + secadero / 2 - 0.05, 0.24, 0.24, 0.2);
    m.forma('copa', COLOR.sesamo, ue - 0.25 + i * 0.3, vs + secadero / 2 - 0.05, 0.2, 0.2, 0.08, 0.17);
  }
  if (estilo <= 2) cerco(m, 0, 0, L, S, false);
  else cerco(m, 0, 0, L, S, true, estilo >= 4 ? COLOR.piedraClara : COLOR.piedra);
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
    // (desde la Era II el muro es de la fábrica de su época; desde la III, el entablamento de piedra y el tejado de teja con sus frontones)
    const s = Math.min(1.4, S * 0.3), v = -S / 2 + s / 2, muro = m.era === 1 ? COLOR.enlucido : m.era >= 4 ? COLOR.sillar : fabrica(m, estilo);
    m.caja(muro, 0, v - s * 0.3, L, s * 0.35, 1.2);
    if (m.era >= 4) hiladas(m, 0, v - s * 0.3, L, s * 0.35, 0, 1.2, 0.3);
    const n = Math.max(3, Math.round(L / 1.0));
    for (let i = 0; i < n; i++) columna(m, -L / 2 + 0.2 + ((L - 0.4) * i) / (n - 1), v + s / 2 - 0.12, 1.2, 0, estilo === 5);
    m.caja(m.era >= 3 ? piedraNoble(m) : muro, 0, v, L + 0.1, s + 0.1, 0.14, 1.2);
    if (m.era >= 3) tejado(m, 'teja', 0, v, L, s, 1.34, piedraNoble(m));
    const franja = franjaDe(m, estilo);
    if (franja !== undefined) m.caja(franja, 0, v, L + 0.12, s + 0.12, 0.06, 1.24);
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

/**
 * Un puesto del Mercado (Víctor, 2026-11-03: «más allá del nivel 1 son edificios, tiendas más que puestos; los de varias celdas son varias
 * tiendas con varias puertas o una tienda grande»). En una plaza de nivel 1 (y en el campamento), puestos al aire, uno por celda. Desde el nivel
 * 2, tiendas: cada una con su cuerpo al fondo, la puerta y el mostrador al frente, que da a la calle (`frente`), y el toldo sobre la calle. Un
 * puesto de varias celdas es una fila de tiendas, una por celda, o (por su semilla) una tienda grande con el portal en medio y un pórtico corrido.
 */
function puestoMercado(m: Marco, estilo: number): void {
  const T = m.L / Math.max(1, Math.round(m.L / Math.max(0.5, m.S))), n = Math.max(1, Math.round(m.L / T));
  if (estilo <= 1) {
    for (let i = 0; i < n; i++) puesto(m, -m.L / 2 + T * (i + 0.5), 0, Math.min(T - 0.6, 1.6), Math.min(m.S - 0.6, 1.1), m.e.semilla + i * 3);
    return;
  }
  const f = m.e.frente ?? (m.azar(1) < 0.5 ? 1 : -1), S = m.S - 0.3;
  if (n >= 2 && m.azar(2) < 0.4) { tiendaDeMercado(m, estilo, 0, m.L - 0.3, S, f, 0, true); return; }
  for (let i = 0; i < n; i++) tiendaDeMercado(m, estilo, -m.L / 2 + T * (i + 0.5), T - 0.3, S, f, i, false);
}

/** Una tienda de `l` de ancho (o la grande de todo el puesto) centrada en `u`: cuerpo al fondo, portal, mostrador y toldo hacia `f`. */
function tiendaDeMercado(m: Marco, estilo: number, u: number, l: number, S: number, f: number, k: number, grande: boolean): void {
  const s = S * 0.58, v0 = -f * (S - s) / 2, fachada = v0 + (f * s) / 2, fondo = S - s;
  const toldo = COLOR.toldo[(m.e.semilla + k * 3) % COLOR.toldo.length]!;
  let alto: number;
  if (estilo === 2) {
    // barro y paja: muros bajos y tejado a dos aguas con la cumbrera a lo largo de la fachada
    alto = 0.95 + (m.azar(10 + k) - 0.5) * 0.15;
    m.caja(m.era >= 4 ? COLOR.adobe : COLOR.barro, u, v0, l, s, alto);
    if (m.era >= 3) tejado(m, 'teja', u, v0, l, s, alto);
    else m.forma('aguas', COLOR.paja, u, v0, l + 0.2, s + 0.35, s * 0.55, alto * 0.88);
  } else {
    alto = bloque(m, estilo, u, v0, l, s, { frente: f, plantas: grande || m.azar(11 + k) < 0.35 ? 2 : 1 }) - 0.16;
  }
  // el portal y el hueco del mostrador en la fachada (la grande, el portal en medio y un mostrador a cada lado)
  const portal = grande ? Math.min(1.1, l * 0.18) : Math.min(0.5, l * 0.22), uPortal = grande ? u : u - l * 0.25;
  m.caja(COLOR.hueco, uPortal, fachada + f * 0.015, portal, 0.06, grande ? 0.85 : 0.7);
  const mostradores = grande ? [u - l * 0.3, u + l * 0.3] : [u + l * 0.18];
  const anchoMostrador = grande ? Math.min(1.1, l * 0.22) : Math.min(0.95, l * 0.4);
  for (const um of mostradores) {
    m.caja(COLOR.hueco, um, fachada + f * 0.015, anchoMostrador, 0.06, 0.32, 0.5);
    // el mostrador de tablas, sacado a la calle, y lo que se vende encima
    m.caja(COLOR.maderaOscura, um, fachada + f * 0.2, anchoMostrador + 0.1, 0.3, 0.46);
    m.caja(COLOR.madera, um, fachada + f * 0.2, anchoMostrador + 0.16, 0.36, 0.05, 0.46);
    for (let i = 0; i < 3; i++) m.forma('cilindro', (i + k) % 2 ? COLOR.ocre : COLOR.barro, um - anchoMostrador * 0.3 + i * anchoMostrador * 0.3, fachada + f * 0.2, 0.13, 0.13, 0.15, 0.51);
  }
  // el toldo sobre la calle, de la fachada a dos postes (en la grande, un pórtico corrido; de columnas en el palacio)
  const hT = Math.min(alto * 0.85, 1.25), largoToldo = l * 0.94, dv = fondo * 0.9;
  m.caja(toldo, u, fachada + (f * dv) / 2, largoToldo, dv, 0.05, hT);
  if (estilo >= 4 && grande) m.caja(franjaDe(m, estilo) ?? COLOR.maderaOscura, u, fachada + f * (dv - 0.04), largoToldo + 0.04, 0.1, 0.12, hT - 0.06);
  const postes = grande ? Math.max(3, Math.round(largoToldo / 1.2) + 1) : 2;
  for (let i = 0; i < postes; i++) {
    const up = u - largoToldo / 2 + 0.06 + ((largoToldo - 0.12) * i) / (postes - 1), vp = fachada + f * (dv - 0.06);
    if (estilo >= 4 && grande) columna(m, up, vp, hT, 0, estilo === 5);
    else m.poste(COLOR.madera, up, vp, hT, 0.06);
  }
  // en la calle, junto al portal: tinajas, o fardos y cestos
  if (m.azar(20 + k) < 0.5) tinajas(m, uPortal + (grande ? -portal : portal) * 0.9, fachada + f * dv * 0.55, 2, COLOR.ocre);
  else for (let i = 0; i < 2; i++) m.forma('cilindro', COLOR.zarzo, uPortal - portal * 0.9 - i * 0.26, fachada + f * dv * 0.6, 0.24, 0.24, 0.22);
}

// ───────────────────────────── El Albergue de caravanas ─────────────────────────────

/** Un giro `a` (de +u hacia +v) alrededor de (u, v): pasa un punto de un marco propio (`du` a lo largo, `dv` a lo ancho) al de la huella. */
function girado(u: number, v: number, a: number): (du: number, dv: number) => [number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return (du, dv) => [u + du * c - dv * s, v + du * s + dv * c];
}

/**
 * Un carro de caravana parado, de dos ruedas macizas (o, con `cuatro`, uno largo de cuatro): caja de tablas, ejes, ruedas y la lanza con su yugo
 * hacia delante, apoyada en un taco. (u, v) es el centro de la caja, y su delante (la lanza) mira hacia `a`. `carga`: 0 vacío, 1 fardos,
 * 2 tinajas, 3 la lona puesta. Ocupa de −0,35 (−0,5 el de cuatro) a +0,91 (+1,06) a lo largo y ±0,3 a lo ancho.
 */
function carroParado(m: Marco, u: number, v: number, a: number, carga: number, cuatro = false): void {
  const en = girado(u, v, a), largo = cuatro ? 1.0 : 0.7, ancho = 0.44, r = 0.19, y = r + 0.04;
  const caja = (color: number, du: number, dv: number, l: number, s: number, h: number, yy: number): void => { const [x, z] = en(du, dv); m.caja(color, x, z, l, s, h, yy, a); };
  caja(COLOR.madera, 0, 0, largo, ancho, 0.05, y);
  for (const k of [-1, 1]) {
    caja(COLOR.maderaOscura, 0, k * (ancho / 2 - 0.025), largo, 0.05, 0.15, y + 0.05);
    caja(COLOR.maderaOscura, k * (largo / 2 - 0.025), 0, 0.05, ancho - 0.1, 0.15, y + 0.05);
  }
  // los ejes y las ruedas, discos macizos con el eje a lo ancho (el cilindro tumbado crece desde su base hacia +dv)
  for (const du of cuatro ? [-largo * 0.3, largo * 0.3] : [-0.04]) {
    caja(COLOR.maderaOscura, du, 0, 0.06, ancho + 0.16, 0.06, r - 0.03);
    for (const k of [-1, 1]) {
      const [x, z] = en(du, k > 0 ? ancho / 2 + 0.02 : -(ancho / 2 + 0.08));
      m.forma('cilindro', COLOR.madera, x, z, 2 * r, 2 * r, 0.06, r, a, Math.PI / 2);
    }
  }
  // la lanza, el yugo y el taco en que se apoya
  const [u0, v0] = en(largo / 2, 0), [u1, v1] = en(largo / 2 + 0.52, 0);
  m.viga(COLOR.madera, u0, v0, u1, v1, y, 0.06);
  caja(COLOR.maderaOscura, largo / 2 + 0.52, 0, 0.07, 0.6, 0.06, y + 0.04);
  caja(COLOR.tronco, largo / 2 + 0.42, 0, 0.12, 0.12, y, 0);
  if (carga === 1) {
    caja(COLOR.lonaVieja, -largo * 0.2, 0, largo * 0.36, ancho * 0.76, 0.2, y + 0.05);
    caja(COLOR.heno, largo * 0.2, 0, largo * 0.34, ancho * 0.7, 0.18, y + 0.05);
    caja(COLOR.lona, -largo * 0.05, 0, largo * 0.3, ancho * 0.6, 0.14, y + 0.25);
  } else if (carga === 2) {
    const n = cuatro ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const [x, z] = en(-largo / 2 + (largo * (i + 0.5)) / n, 0), color = i % 2 ? COLOR.ocre : COLOR.barro;
      m.forma('cilindro', color, x, z, 0.2, 0.2, 0.26, y + 0.05);
      m.forma('cupula', color, x, z, 0.2, 0.2, 0.07, y + 0.31);
    }
  } else if (carga === 3) {
    const [x, z] = en(0, 0);
    m.forma('aguas', COLOR.lona, x, z, largo + 0.04, ancho + 0.06, 0.3, y + 0.18, a);
  }
}

/** Una bestia de tiro de pie, con la cabeza hacia `a`: un buey con sus cuernos, o un asno, más chico y gris, de orejas largas. `pelo`, otro
 * color para el buey (las reses del rebaño). */
function bestia(m: Marco, u: number, v: number, a: number, asno: boolean, pelo?: number, escala = 1): void {
  const en = girado(u, v, a), k = (asno ? 0.72 : 1) * escala, color = asno ? COLOR.asno : pelo ?? COLOR.buey;
  const caja = (c: number, du: number, dv: number, l: number, s: number, h: number, y: number): void => { const [x, z] = en(du, dv); m.caja(c, x, z, l, s, h, y, a); };
  caja(color, 0, 0, 0.56 * k, 0.24 * k, 0.24 * k, 0.26 * k);
  for (const du of [-0.2, 0.2]) for (const dv of [-0.075, 0.075]) { const [x, z] = en(du * k, dv * k); m.poste(oscurecer(color, 0.8), x, z, 0.27 * k, 0.06 * k); }
  caja(color, 0.34 * k, 0, 0.16 * k, 0.13 * k, 0.15 * k, 0.3 * k);
  if (asno) for (const dv of [-0.035, 0.035]) caja(color, 0.31 * k, dv * k, 0.03, 0.03, 0.12 * k, 0.45 * k);
  else caja(COLOR.cuerno, 0.31 * k, 0, 0.04 * k, 0.28 * k, 0.04 * k, 0.43 * k);
}

/** Una oveja de pie, con la cabeza hacia `a`: el vellón claro y la cabeza y las patas oscuras (el rebaño de la aldea ganadera). */
function oveja(m: Marco, u: number, v: number, a: number, k = 1): void {
  const en = girado(u, v, a);
  const caja = (c: number, du: number, dv: number, l: number, s: number, h: number, y: number): void => { const [x, z] = en(du * k, dv * k); m.caja(c, x, z, l * k, s * k, h * k, y * k, a); };
  caja(COLOR.lana, 0, 0, 0.34, 0.2, 0.17, 0.15);
  for (const du of [-0.11, 0.11]) for (const dv of [-0.05, 0.05]) { const [x, z] = en(du * k, dv * k); m.poste(COLOR.pielOscura, x, z, 0.16 * k, 0.04 * k); }
  caja(COLOR.pielOscura, 0.21, 0, 0.1, 0.09, 0.09, 0.22);
}

/** Un abrevadero de `l` de largo, girado `a` (0: a lo largo de u): de tablas o, con `piedra`, una pila de piedra. */
function abrevadero(m: Marco, u: number, v: number, l: number, a: number, piedra: boolean): void {
  m.caja(piedra ? COLOR.piedra : COLOR.madera, u, v, l, 0.34, 0.28, 0, a);
  m.forma('losa', COLOR.agua, u, v, l - 0.12, 0.22, 0.02, 0.27, a);
}

/**
 * Un cobertizo largo contra la tapia del lado `lado` (±1 en u; la tapia, en u = lado·`uMuro`), de `ds` de fondo y de `v0` a `v1`: el muro del
 * fondo hasta el techo, postes (columnas en los estilos altos) hacia el patio, y su techo de paja a dos aguas o plano.
 */
function cobertizoLateral(m: Marco, estilo: number, lado: number, uMuro: number, ds: number, v0: number, v1: number, h: number): void {
  const uc = lado * (uMuro - ds / 2), ls = Math.abs(v1 - v0), vc = (v0 + v1) / 2, ua = lado * (uMuro - ds + 0.08);
  m.caja(estilo === 1 && m.era === 1 ? COLOR.zarzo : estilo <= 2 ? COLOR.barro : fabrica(m, estilo), lado * (uMuro - 0.06), vc, 0.12, ls, h);
  const np = Math.max(2, Math.round(ls / 1.1) + 1), vp = (i: number): number => vc - ls / 2 + 0.08 + ((ls - 0.16) * i) / (np - 1);
  for (let i = 0; i < np; i++) {
    if (estilo >= 4) columna(m, ua, vp(i), h, 0, estilo === 5);
    else m.poste(COLOR.madera, ua, vp(i), h, 0.11);
  }
  if (m.era > 1 && cubiertaLigera(m, estilo) !== 'plano') {
    techoLigero(m, estilo, uc, vc, ls, ds, h, fabrica(m, estilo), Math.PI / 2);
    return;
  }
  if (estilo <= 2 && m.era === 1) {
    m.forma('aguas', COLOR.paja, uc, vc, ls + 0.2, ds + 0.3, ds * 0.42, h * 0.95, Math.PI / 2);
    return;
  }
  m.caja(estilo >= 4 && m.era === 1 ? COLOR.enlucido : fabrica(m, estilo), uc, vc, ds + 0.08, ls + 0.08, 0.14, h);
  const franja = franjaDe(m, estilo);
  if (franja !== undefined) m.caja(franja, uc, vc, ds + 0.1, ls + 0.1, 0.07, h + 0.02);
  // en el adobe, las cabezas de las vigas asoman sobre los postes
  if (estilo === 3) for (let i = 0; i < np; i++) m.caja(COLOR.maderaOscura, ua - lado * 0.1, vp(i), 0.14, 0.08, 0.08, h - 0.1);
}

/**
 * El portón del albergue en el lado de la calle (v = `vp`), con `puerta` de paso libre: postes y dintel en la valla; con tejadillo de paja en
 * el barro; pilares de adobe con su dintel en el 3; y en el 4 y el 5 un zaguán cubierto sobre dos pilares hondos. Las hojas, abiertas hacia el
 * patio (−`f`).
 */
function portonDelAlbergue(m: Marco, estilo: number, puerta: number, altoTapia: number, vp: number, f: number): void {
  const alto = altoTapia + (estilo === 1 ? 0.65 : 0.55);
  if (estilo <= 2) {
    for (const k of [-1, 1]) m.poste(COLOR.madera, k * (puerta / 2 + 0.08), vp, alto, estilo === 1 ? 0.14 : 0.18);
    m.viga(COLOR.maderaOscura, -puerta / 2 - 0.25, vp, puerta / 2 + 0.25, vp, alto - 0.04, 0.16, 0.14);
    if (estilo === 2 && m.era >= 3) tejado(m, 'teja', 0, vp - f * 0.05, puerta + 0.6, 0.4, alto + 0.08);
    else if (estilo === 2) m.forma('aguas', COLOR.paja, 0, vp - f * 0.05, puerta + 0.8, 0.6, 0.3, alto + 0.08);
  } else if (estilo === 3) {
    for (const k of [-1, 1]) m.caja(fabrica(m, 3), k * (puerta / 2 + 0.17), vp, 0.34, 0.34, alto);
    m.viga(COLOR.maderaOscura, -puerta / 2 - 0.34, vp, puerta / 2 + 0.34, vp, alto - 0.14, 0.24, 0.14);
    for (let i = 0; i < 4; i++) m.caja(COLOR.maderaOscura, -puerta / 2 + (puerta * (i + 0.5)) / 4, vp, 0.08, 0.36, 0.08, alto - 0.16);
  } else {
    const hondo = 0.95, vz = vp - f * (hondo / 2 - 0.18);
    const muro = m.era === 1 ? COLOR.enlucido : fabrica(m, estilo), franja = franjaDe(m, estilo);
    for (const k of [-1, 1]) {
      m.caja(colorZocalo(m, estilo), k * (puerta / 2 + 0.2), vz, 0.44, hondo + 0.04, 0.3);
      m.caja(muro, k * (puerta / 2 + 0.2), vz, 0.4, hondo, alto);
    }
    m.caja(muro, 0, vz, puerta + 0.9, hondo + 0.1, 0.18, alto);
    if (franja !== undefined) m.caja(franja, 0, vz, puerta + 0.92, hondo + 0.12, 0.08, alto + 0.04);
    if (m.era >= 3) tejado(m, 'teja', 0, vz, puerta + 0.9, hondo + 0.1, alto + 0.18, undefined, 0);
  }
  if (estilo >= 2) for (const k of [-1, 1]) m.caja(COLOR.madera, k * (puerta / 2 - 0.05), vp - f * (puerta / 4 + 0.02), 0.06, puerta / 2 - 0.02, alto - (estilo >= 4 ? 0.2 : 0.3));
}

/**
 * El Albergue de caravanas (motor b5e27ace: 2 × 3 celdas junto al Mercado; suma caravanas y carros a la flota). Un patio cerrado, como los
 * caravasares y los barrios de mercaderes de Kanesh: el portón da a la calle (`frente`), la casa de los arrieros al fondo, el cobertizo de los
 * carros y la cuadra de las bestias contra las tapias de los lados, y en el patio carros, fardos y el abrevadero. El estilo pone los materiales
 * (valla de zarzo y paja; tapia de barro; adobe; enlucido sobre zócalo de piedra; piedra con franja roja y columnas) y el nivel del albergue lo
 * que hay dentro: en el 1, la casa arrimada a un lado y un cobertizo al otro; en el 2, cobertizo y cuadra a los dos lados y más carros; en el 3,
 * la casa de dos plantas con su pórtico, el pozo en medio, y más carros y bestias, uno de ellos largo, de cuatro ruedas.
 */
function albergueCaravanas(m: Marco, estilo: number): void {
  const n = Math.max(1, Math.min(3, Math.round(m.e.nivel) || 1));
  const f = m.e.frente ?? (m.azar(1) < 0.5 ? 1 : -1), V = (w: number): number => f * w;
  const L = m.L - 0.4, S = m.S - 0.4, ancho = L / 2, fondo = S / 2, lado = m.azar(3) < 0.5 ? -1 : 1;
  m.losa(estilo >= 4 ? COLOR.losa : estilo === 3 ? COLOR.adobeClaro : COLOR.tierra, 0, 0, L, S, 0.03);

  // la tapia (o la valla) y el portón, en medio del lado de la calle
  const puerta = Math.min(1.7, L * 0.2), altoTapia = [0.6, 0.75, 0.95, 1.05, 1.15][estilo - 1] ?? 0.95, g = estilo === 1 ? 0 : 0.09;
  const tramos: [number, number, number, number][] = [
    [-ancho - g, -fondo, ancho + g, -fondo], [-ancho, -fondo, -ancho, fondo], [ancho, -fondo, ancho, fondo],
    [-ancho - g, fondo, -puerta / 2, fondo], [puerta / 2, fondo, ancho + g, fondo],
  ];
  for (const [u0, w0, u1, w1] of tramos) {
    if (estilo === 1) { valla(m, u0, V(w0), u1, V(w1), altoTapia); continue; }
    if (conZocalo(m, estilo)) tapia(m, u0, V(w0), u1, V(w1), colorZocalo(m, estilo), 0.3, 0.26);
    tapia(m, u0, V(w0), u1, V(w1), estilo === 2 ? COLOR.barro : fabrica(m, estilo), altoTapia, 0.18);
    const franja = franjaDe(m, estilo);
    if (franja !== undefined) m.viga(franja, u0, V(w0), u1, V(w1), altoTapia - 0.22, 0.2, 0.1);
  }
  portonDelAlbergue(m, estilo, puerta, altoTapia, V(fondo), f);

  // la casa de los arrieros, al fondo, con su puerta al patio; en el nivel 3, de dos plantas y con pórtico
  const ds = Math.min(1.6, L * 0.19), d = Math.min(1.7, S * 0.3), wCasa = -fondo + 0.12 + d / 2;
  const lc = n === 1 ? L * 0.5 : L - 2 * ds - 0.5, uc = n === 1 ? lado * (ancho - 0.12 - lc / 2) : 0;
  bloque(m, estilo, uc, V(wCasa), lc, d, { frente: f, plantas: n === 3 ? 2 : 1 });
  let wPatio = wCasa + d / 2 + (estilo <= 2 ? 0.25 : 0.05);
  if (n === 3) {
    const hondo = 0.75, wp = wPatio + hondo / 2;
    if (estilo >= 4) {
      const nc = Math.max(3, Math.round(lc / 1.0) + 1);
      for (let i = 0; i < nc; i++) columna(m, uc - lc / 2 + 0.12 + ((lc - 0.24) * i) / (nc - 1), V(wp + hondo / 2 - 0.12), 1.15, 0, estilo === 5);
      m.caja(m.era === 1 ? COLOR.enlucido : m.era >= 3 ? COLOR.teja : fabrica(m, estilo), uc, V(wp), lc + 0.06, hondo + 0.06, 0.14, 1.15);
      const franja = franjaDe(m, estilo);
      if (franja !== undefined) m.caja(franja, uc, V(wp), lc + 0.08, hondo + 0.08, 0.06, 1.19);
    } else pergola(m, uc, V(wp), lc, hondo, 0, estilo <= 2 ? 0.85 : 1.0, estilo === 3);
    wPatio += hondo;
  }
  // lo que se descarga: tinajas y fardos delante de la casa (bajo el pórtico en el 3), a la derecha de su puerta
  const wCarga = n === 3 ? wPatio - 0.75 / 2 - 0.05 : wPatio + 0.22, uCarga = uc - lc * 0.22 + 0.45;
  tinajas(m, uCarga, V(wCarga), 2 + n, n % 2 ? COLOR.barro : COLOR.ocre);
  m.caja(COLOR.lonaVieja, uCarga + (2 + n) * 0.28 + 0.15, V(wCarga), 0.42, 0.3, 0.22);
  m.caja(COLOR.heno, uCarga + (2 + n) * 0.28 + 0.6, V(wCarga), 0.4, 0.3, 0.2);
  m.caja(COLOR.lona, uCarga + (2 + n) * 0.28 + 0.36, V(wCarga), 0.38, 0.28, 0.18, 0.21);

  // el cobertizo de los carros contra una tapia de lado y, desde el nivel 2, la cuadra contra la otra
  const h = estilo <= 2 ? 1.0 : 1.15, lC = n === 1 ? -lado : lado, v0 = V(-fondo + 0.1), v1 = V(fondo - 0.1);
  cobertizoLateral(m, estilo, lC, ancho, ds, v0, v1, h);
  const carros = [3, 4, 5][n - 1]!, paso = Math.min(0.85, (S - 0.5) / carros);
  for (let i = 0; i < carros; i++) carroParado(m, lC * (ancho - 0.5), V((i - (carros - 1) / 2) * paso), lC > 0 ? Math.PI : 0, Math.floor(m.azar(20 + i) * 4));
  if (n >= 2) {
    const lb = -lC, bestias = n === 2 ? 4 : 6, pasoB = Math.min(0.62, (S - 1.2) / bestias);
    cobertizoLateral(m, estilo, lb, ancho, ds, v0, v1, h);
    // el pesebre con su heno a lo largo de la tapia, y las bestias atadas a él
    m.caja(COLOR.madera, lb * (ancho - 0.3), 0, 0.3, S - 1.0, 0.32);
    m.losa(COLOR.heno, lb * (ancho - 0.3), 0, 0.22, S - 1.1, 0.06, 0.3);
    for (let i = 0; i < bestias; i++) bestia(m, lb * (ancho - 0.9), V((i - (bestias - 1) / 2) * pasoB), lb > 0 ? 0 : Math.PI, m.azar(30 + i) < 0.45);
    abrevadero(m, lb * (ancho - ds - 0.4), V((wPatio + fondo) / 2 - 0.2), 1.2, Math.PI / 2, estilo >= 3);
    // en la esquina del patio de la calle, un carro recién llegado; en el 3, otro largo de cuatro ruedas con la lona puesta
    const borde = ancho - ds - 0.1;
    carroParado(m, lb * (borde - 0.4), V(fondo - 0.55), lb > 0 ? Math.PI : 0, 1 + Math.floor(m.azar(40) * 2));
    if (n === 3) {
      carroParado(m, lC * (borde - 0.55), V(fondo - 0.55), lC > 0 ? Math.PI : 0, 3, true);
      pozo(m, 0, V((wPatio + fondo - 0.9) / 2));
    }
  } else {
    // en el nivel 1, el abrevadero al fondo entre el cobertizo y la casa, con dos asnos, y un carro con la lona puesta en la esquina de la calle
    const ua = -lado * (ancho - ds - 0.95);
    abrevadero(m, ua, V(-fondo + 0.35), 1.1, 0, false);
    for (const k of [-1, 1]) bestia(m, ua + k * 0.32, V(-fondo + 0.86), -f * Math.PI / 2, true);
    carroParado(m, lado * (ancho - 0.45), V(fondo - 0.55), lado > 0 ? Math.PI : 0, 3);
  }
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
    // después de Cnosos, en vez de los cuernos: el fuego del altar y dos estelas de piedra
    if (m.era > 1) {
      m.forma('cono', COLOR.fuego, 0, 0, 0.35, 0.35, 0.35, 0.55);
      for (const a of [-1, 1]) m.caja(COLOR.piedraClara, a * 1.0, 0.3, 0.3, 0.16, 1.1);
    }
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
    m.caja(estilo >= 4 ? (m.era === 1 ? COLOR.enlucido : m.era >= 3 ? piedraNoble(m) : fabrica(m, estilo)) : COLOR.adobe, 0, v, L, 0.7, 0.14, 1.1);
    if (m.era >= 3) tejado(m, 'teja', 0, v, L, 0.7, 1.24);
  }
  horno(m, 0, 0, 0.4);
}

function pozo(m: Marco, u = 0, v = 0): void {
  m.forma('cilindro', COLOR.piedra, u, v, 1.2, 1.2, 0.5);
  m.losa(COLOR.agua, u, v, 0.85, 0.85, 0.02, 0.44);
  for (const a of [-1, 1]) m.poste(COLOR.madera, u + a * 0.55, v, 1.25, 0.08);
  m.viga(COLOR.madera, u - 0.6, v, u + 0.6, v, 1.2, 0.07);
  m.forma('cilindro', COLOR.barro, u, v, 0.18, 0.18, 0.2, 0.75);
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
  if (['granja', 'plaza', 'plazaDeArmas', 'parque', 'pozo', 'puestoMercado', 'corral', 'lenera', 'galeriaDeTiro', 'estatua'].includes(tipo)) return 0.9;
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
    case 'granja':
      switch (m.e.cultivo) {
        case 'vid': return vina(m, estilo);
        case 'oliva': return olivar(m, estilo);
        case 'cebada': return cebadal(m, estilo);
        case 'sesamo': return sesamal(m, estilo);
        default: return granja(m, estilo);
      }
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
    case 'molino': return molino(m, estilo);
    case 'horno': return panaderia(m, estilo);
    case 'quesera': return quesera(m, estilo);
    case 'bodega': return bodega(m, estilo);
    case 'prensa': return prensa(m, estilo);
    case 'estatua': return estatua(m, estilo);
    case 'mercado': return mercado(m, estilo);
    case 'puestoMercado': return puestoMercado(m, estilo);
    case 'albergueCaravanas': return albergueCaravanas(m, estilo);
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
    case 'torreVigia': return torreVigia(m);
    case 'torreHomenaje': return torreHomenaje(m, estilo);
    default: {
      bloque(m, estilo, 0, 0, m.L - 0.6, m.S - 0.6, { frente: 1 });
    }
  }
}

/** La torre de vigía de una atalaya: cuatro pies de madera arriostrados, la plataforma con su baranda, un tejadillo de paja y la escala. */
function torreVigia(m: Marco): void {
  const a = Math.min(2.6, Math.min(m.L, m.S) - 0.8) / 2, h = 4.2;
  for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.poste(COLOR.madera, i * a, j * a, h + 1.1, 0.16);
  // las riostras en aspa de cada cara, a dos alturas
  for (const y of [1.2, 2.8]) {
    m.viga(COLOR.maderaOscura, -a, -a, a, -a, y, 0.08);
    m.viga(COLOR.maderaOscura, -a, a, a, a, y, 0.08);
    m.viga(COLOR.maderaOscura, -a, -a, -a, a, y, 0.08);
    m.viga(COLOR.maderaOscura, a, -a, a, a, y, 0.08);
  }
  m.losa(COLOR.madera, 0, 0, a * 2 + 0.5, a * 2 + 0.5, 0.12, h);
  for (const [u0, v0, u1, v1] of [[-a, -a, a, -a], [a, -a, a, a], [a, a, -a, a], [-a, a, -a, -a]] as const) m.viga(COLOR.madera, u0, v0, u1, v1, h + 0.6, 0.07);
  m.forma('cuatroAguas', COLOR.paja, 0, 0, a * 2 + 0.7, a * 2 + 0.7, 0.9, h + 1.1);
  // la escala, pegada a una cara
  for (const k of [-0.22, 0.22]) m.poste(COLOR.madera, k, a + 0.22, h, 0.06);
  for (let i = 1; i < 10; i++) m.viga(COLOR.madera, -0.22, a + 0.22, 0.22, a + 0.22, (h * i) / 10, 0.05);
  m.forma('cilindro', COLOR.fuego, 0, 0, 0.25, 0.25, 0.25, h + 0.12);
}

/** La torre del homenaje de un fuerte o una ciudadela: de adobe sobre zócalo de piedra (hasta el estilo 3) o de piedra, alta, con almenas y su puerta.
 * En una huella grande (la ciudadela) la torre queda en medio de su patio, cercado por un muro bajo con su portillo y torrecillas en las esquinas. */
function torreHomenaje(m: Marco, estilo: number): void {
  const lado = Math.min(m.L, m.S) - 0.7, piedra = estilo >= 4, muro = piedra ? COLOR.piedra : COLOR.adobe;
  const patio = lado > 7;
  const l = patio ? lado * 0.55 : lado, h = Math.max(4.2, l * 0.95);
  if (patio) {
    const a = lado / 2;
    m.losa(COLOR.tierra, 0, 0, lado, lado, 0.03);
    for (const [u0, v0, u1, v1] of [[-a, -a, a, -a], [a, -a, a, a], [-a, -a, -a, a]] as const) tapia(m, u0, v0, u1, v1, muro, 1.3, 0.35);
    tapia(m, -a, a, -0.8, a, muro, 1.3, 0.35);
    tapia(m, 0.8, a, a, a, muro, 1.3, 0.35);
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) m.caja(muro, i * (a - 0.3), j * (a - 0.3), 0.9, 0.9, 1.9);
  }
  m.caja(COLOR.piedraOscura, 0, 0, l + 0.2, l + 0.2, 0.6);
  m.caja(muro, 0, 0, l, l, h - 0.6, 0.6);
  if (piedra) for (let k = 1; k < 4; k++) m.caja(COLOR.piedraClara, 0, 0, l + 0.04, l + 0.04, 0.08, 0.6 + ((h - 0.6) * k) / 4);
  // almenas en el borde de arriba
  const n = Math.max(3, Math.round(l / 0.55));
  for (let i = 0; i < n; i += 2) {
    const t = -l / 2 + (l * (i + 0.5)) / n;
    for (const [u, v] of [[t, -l / 2 + 0.12], [t, l / 2 - 0.12], [-l / 2 + 0.12, t], [l / 2 - 0.12, t]] as const) m.caja(muro, u, v, 0.28, 0.28, 0.4, h);
  }
  m.losa(piedra ? COLOR.losa : COLOR.barro, 0, 0, l - 0.3, l - 0.3, 0.05, h - 0.02);
  m.caja(COLOR.hueco, 0, l / 2 + 0.01, 0.6, 0.06, 1.0, 0.6);
  for (const y of [h * 0.45, h * 0.72]) for (const k of [-1, 1]) m.caja(COLOR.hueco, k * l * 0.25, l / 2 + 0.01, 0.16, 0.05, 0.4, y);
  m.poste(COLOR.madera, l * 0.3, -l * 0.3, 1.6, 0.06, h);
  m.caja(COLOR.rojo, l * 0.3 + 0.3, -l * 0.3, 0.6, 0.03, 0.4, h + 1.1);
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
