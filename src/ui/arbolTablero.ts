// El tablero de los árboles (tecnologías en Facción, 0.158.0; reclutamiento en la plaza, 0.159.0): carriles (filas) × Eras (columnas), cartas
// en una rejilla y líneas en ángulo recto trazadas en un SVG al medirla. Aquí va lo común: el HTML de la rejilla, el trazado, el resaltado del
// camino al pasar el ratón, el tooltip (en <body>), la ficha fija con las acciones del árbol, el arrastre y «Ver todas las conexiones».
// Cada árbol pone sus nodos, su disposición y sus cartas, y guarda su dibujo con `fijarDibujo(clave, …)` al generar el HTML.

type Escapar = (s: string) => string;

export type TipoArista = 'hito' | 'implicita' | 'logro';
export interface NodoTablero { preds: { de: string; tipo: TipoArista }[]; hijos: string[]; carril: string; col?: number; fila?: number }

/** Lo que el montaje necesita del árbol pintado. */
export interface DibujoTablero {
  nodos: Map<string, NodoTablero>;
  /** Los carriles en orden (para saber si una línea entre carriles baja o sube). */
  ordenCarriles: string[];
  /** Casillas ocupadas por carril y fila (para saber si un tramo recto está libre). */
  ocupa: Record<string, Set<number>[]>;
  /** El contenido del tooltip de una carta. */
  tip: (id: string) => string;
  /** Alto (px) desde el borde de arriba de la carta donde entran y salen las líneas. */
  ancla: number;
  /** Lo que se ilumina al pasar el ratón; si no, se sigue `preds` e `hijos`. */
  antes?: (id: string) => Set<string>;
  despues?: (id: string) => Set<string>;
}

/** Lo que pone la ficha fija de una carta además del tooltip: sus acciones y cómo cablearlas. */
export interface ContextoArbol {
  acciones: (id: string) => string;
  cablearAcciones: (raiz: HTMLElement) => void;
}

// ── HTML de la rejilla ───────────────────────────────────────────────────────

export interface EraTablero { base: number; cols: number; futura: boolean; cab: string }
export interface CarrilTablero { id: string; nombre: string; icono: string; sub: string; filas: number; vacio?: string }
export interface CartaTablero { carril: string; col: number; fila: number; html: (estilo: string) => string }

/** El tablero entero: la columna de carriles, las cabeceras de Era, los fondos y las cartas (cada una recibe su `grid-column`/`grid-row`). */
export function htmlTablero(o: {
  clave: string; esquina: string; NCOL: number; eras: EraTablero[]; carriles: CarrilTablero[]; cartas: CartaTablero[];
  ayuda: string; leyenda: string; icono: (tipo: string, n: number) => string; e: Escapar;
}): string {
  const { e } = o;
  const todas = estado(o.clave).todas;
  const filas = ['auto'];
  const fila0 = new Map<string, number>(), filaFin = new Map<string, number>();
  let idx = 2;
  for (const c of o.carriles) { filas.push('var(--ta-canal)'); idx++; fila0.set(c.id, idx); for (let i = 0; i < Math.max(1, c.filas); i++) { filas.push('auto'); idx++; } filaFin.set(c.id, idx); }
  filas.push('var(--ta-canal)');
  let h = '<svg class="ta-lineas" aria-hidden="true"></svg>';
  o.eras.forEach((x, i) => { h += `<div class="ta-era-fondo${i % 2 ? ' par' : ''}${i ? ' raya' : ''}${x.futura ? ' futura' : ''}" style="grid-column:${2 + x.base} / span ${x.cols}"></div>`; });
  o.carriles.forEach((c, i) => { h += `<div class="ta-carril-fondo${i % 2 ? ' par' : ''}${c.vacio ? ' cerrado' : ''}" data-carril="${e(c.id)}" style="grid-row:${fila0.get(c.id)} / ${filaFin.get(c.id)}"></div>`; });
  h += `<div class="ta-esquina"><span>${e(o.esquina)}</span></div>`;
  for (const x of o.eras) h += `<div class="ta-era-cab" style="grid-column:${2 + x.base} / span ${x.cols}; grid-row:1">${x.cab}</div>`;
  for (const c of o.carriles) {
    if (c.vacio) h += `<div class="ta-carril-vacio" style="grid-row:${fila0.get(c.id)}">${e(c.vacio)}</div>`;
    h += `<div class="ta-carril-nombre${c.vacio ? ' cerrado' : ''}" style="grid-row:${fila0.get(c.id)} / ${filaFin.get(c.id)}" title="${e(c.nombre)}">${o.icono(c.icono, 30)}<strong>${e(c.nombre)}</strong><small>${e(c.sub)}</small></div>`;
  }
  for (const k of o.cartas) if (fila0.has(k.carril)) h += k.html(`grid-column:${2 + k.col}; grid-row:${fila0.get(k.carril)! + k.fila}`);
  return `<div class="ta-mandos"><button class="ta-btn-sec" type="button" data-ta-todas aria-pressed="${todas}"><span class="caja" aria-hidden="true">${todas ? '✓' : ''}</span>Ver todas las conexiones</button>
      <span class="ta-ayuda">${o.ayuda}</span></div>
    <div class="ta-leyenda">${o.leyenda}</div>
    <div class="ta-tablero-marco"><div class="ta-tablero${todas ? ' todas' : ''}" data-ta-clave="${e(o.clave)}" style="grid-template-columns: var(--ta-carril) repeat(${o.NCOL}, var(--ta-carta)); grid-template-rows: ${filas.join(' ')}">${h}</div></div>`;
}

/** La muestra de una línea (leyenda y «Pide X» / «Tras X» de las cartas). */
export const muestraLinea = (tipo: string, ancho = 18): string =>
  `<svg width="${ancho}" height="8" viewBox="0 0 ${ancho} 8" aria-hidden="true"><path d="M1 4H${ancho - 1}" class="ta-arista ${tipo} muestra"/></svg>`;

// ── Estado de cada tablero (sobrevive a los repintados del panel) ───────────

interface EstadoTablero {
  dibujo: DibujoTablero | null;
  todas: boolean;
  fijado: string | null;
  scroll: number;
  ctx: ContextoArbol | null;
  tablero: HTMLElement | null;
  svg: SVGSVGElement | null;
  resaltado: string | null;
}
const tableros = new Map<string, EstadoTablero>();
function estado(clave: string): EstadoTablero {
  let s = tableros.get(clave);
  if (!s) tableros.set(clave, (s = { dibujo: null, todas: false, fijado: null, scroll: 0, ctx: null, tablero: null, svg: null, resaltado: null }));
  return s;
}
/** Guarda lo que el montaje necesita del árbol recién generado. */
export function fijarDibujo(clave: string, d: DibujoTablero): void { estado(clave).dibujo = d; }

let tip: HTMLElement | null = null;
/** El tablero que enseña el tooltip ahora. */
let tipDe: string | null = null;
let vigia: ReturnType<typeof setInterval> | undefined;
let globalesPuestos = false;

// ── Trazado ──────────────────────────────────────────────────────────────────

function trazar(s: EstadoTablero): void {
  const d = s.dibujo, tablero = s.tablero, svg = s.svg;
  if (!d || !tablero || !svg || !tablero.isConnected) return;
  const cartas = new Map(Array.from(tablero.querySelectorAll<HTMLElement>('.ta-carta')).map((el) => [el.dataset.nodo!, el]));
  const cs = getComputedStyle(tablero);
  const pistas = cs.gridTemplateColumns.split(' ').map(parseFloat);
  const hueco = parseFloat(cs.columnGap) || 0;
  const xPista = (i: number): number => pistas.slice(0, i).reduce((t, w) => t + w + hueco, 0);
  const xHueco = (col: number): number => xPista(col + 1) + (pistas[col + 1] ?? 0) + hueco / 2;
  const canales = new Map<number, Map<string, number>>();
  const canal = (col: number, clave: string): number => {
    if (!canales.has(col)) canales.set(col, new Map());
    const m = canales.get(col)!;
    if (!m.has(clave)) m.set(clave, m.size);
    const k = m.get(clave)!;
    return xHueco(col) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 7;
  };
  const alto = parseFloat(cs.getPropertyValue('--ta-canal')) || 20;
  const bandas = Object.fromEntries(Array.from(tablero.querySelectorAll<HTMLElement>('.ta-carril-fondo')).map((el) => [el.dataset.carril!, { y: el.offsetTop, h: el.offsetHeight }]));
  const usoCanal = new Map<string, number>();
  const yCanal = (carril: string, arriba: boolean): number => {
    const b = bandas[carril]!;
    const base = arriba ? b.y - alto / 2 - 1 : b.y + b.h + alto / 2 + 1;
    const clave = carril + (arriba ? '↑' : '↓');
    const k = usoCanal.get(clave) ?? 0;
    usoCanal.set(clave, k + 1);
    return base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 5;
  };
  const libreEnFila = (carril: string, fila: number, c0: number, c1: number): boolean => { for (let k = c0; k <= c1; k++) if (d.ocupa[carril]?.[fila]?.has(k)) return false; return true; };
  const caja = (id: string): { x: number; y: number; w: number } => { const el = cartas.get(id)!; return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth }; };
  let t = `<defs><marker id="ta-punta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1.5 1L7 4L1.5 7" fill="none" style="stroke:var(--bronce)" stroke-width="1.6"/></marker>
    <marker id="ta-punta-luz" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1.5 1L7 4L1.5 7" fill="none" style="stroke:var(--oro-claro)" stroke-width="1.6"/></marker></defs>`;
  for (const [id, n] of d.nodos) {
    if (!cartas.has(id)) continue;
    for (const p of n.preds) {
      if (!cartas.has(p.de)) continue;
      const a = d.nodos.get(p.de)!, A = caja(p.de), B = caja(id);
      const x1 = A.x + A.w, y1 = A.y + d.ancla, x2 = B.x - 1, y2 = B.y + d.ancla;
      const xa = canal(a.col!, 'S' + p.de);
      const mismo = a.carril === n.carril;
      let dd: string;
      if (mismo && a.fila === n.fila && libreEnFila(n.carril, n.fila!, a.col! + 1, n.col! - 1)) dd = `M${x1} ${y1}H${x2}`;
      else if (n.col === a.col! + 1) dd = `M${x1} ${y1}H${xa}V${y2}H${x2}`;
      else if (mismo && libreEnFila(n.carril, n.fila!, a.col! + 1, n.col! - 1)) dd = `M${x1} ${y1}H${xa}V${y2}H${x2}`;
      else if (mismo && libreEnFila(n.carril, a.fila!, a.col! + 1, n.col! - 1)) dd = `M${x1} ${y1}H${canal(n.col! - 1, 'T' + id)}V${y2}H${x2}`;
      else if (mismo) {
        // Ni la fila de salida ni la de llegada están libres: por la franja de debajo del carril.
        const yg = yCanal(n.carril, false);
        dd = `M${x1} ${y1}H${xa}V${yg}H${canal(n.col! - 1, 'T' + id)}V${y2}H${x2}`;
      } else {
        const yg = yCanal(n.carril, d.ordenCarriles.indexOf(n.carril) > d.ordenCarriles.indexOf(a.carril));
        dd = `M${x1} ${y1}H${xa}V${yg}H${canal(n.col! - 1, 'T' + id)}V${y2}H${x2}`;
      }
      t += `<path class="ta-arista ${p.tipo}${mismo ? '' : ' cruce'}" data-de="${p.de}" data-a="${id}" d="${dd}"/>`;
    }
  }
  svg.setAttribute('width', String(tablero.scrollWidth));
  svg.setAttribute('height', String(tablero.scrollHeight));
  svg.innerHTML = t;
  if (s.resaltado) resaltar(s, s.resaltado);
}

function resaltar(s: EstadoTablero, id: string | null): void {
  s.resaltado = id;
  const tablero = s.tablero, d = s.dibujo;
  if (!tablero || !d) return;
  tablero.classList.toggle('activo', Boolean(id));
  tablero.querySelectorAll('.luz,.baja,.foco').forEach((x) => x.classList.remove('luz', 'baja', 'foco'));
  if (!id || !d.nodos.has(id)) return;
  const sigue = (rel: (i: string) => string[]) => (i0: string): Set<string> => {
    const v = new Set<string>();
    const ir = (i: string): void => rel(i).forEach((x) => { if (!v.has(x)) { v.add(x); ir(x); } });
    ir(i0);
    return v;
  };
  const arriba = (d.antes ?? sigue((i) => d.nodos.get(i)!.preds.map((p) => p.de)))(id);
  const abajo = (d.despues ?? sigue((i) => d.nodos.get(i)!.hijos))(id);
  arriba.add(id);
  tablero.querySelectorAll<HTMLElement>('.ta-carta').forEach((el) => {
    const i = el.dataset.nodo!;
    if (arriba.has(i)) el.classList.add('luz'); else if (abajo.has(i)) el.classList.add('baja');
    if (i === id) el.classList.add('foco');
  });
  s.svg?.querySelectorAll<SVGPathElement>('.ta-arista').forEach((x) => {
    const de = x.dataset.de!, a = x.dataset.a!;
    if (arriba.has(de) && arriba.has(a)) x.classList.add('luz');
    else if (abajo.has(a) && (abajo.has(de) || de === id)) x.classList.add('baja');
  });
}

// ── Tooltip y ficha ──────────────────────────────────────────────────────────

function elTip(): HTMLElement {
  if (tip?.isConnected) return tip;
  tip = document.createElement('div');
  tip.className = 'ta-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'dialog');
  document.body.appendChild(tip);
  return tip;
}

function ocultarTip(): void {
  if (tip) { tip.hidden = true; tip.classList.remove('fijo'); }
  tipDe = null;
  if (vigia) { clearInterval(vigia); vigia = undefined; }
}

function mostrar(clave: string, id: string, ev?: MouseEvent | FocusEvent | null): void {
  const s = estado(clave), d = s.dibujo;
  if (!d) return;
  const t = elTip();
  const fijo = s.fijado === id;
  t.innerHTML = d.tip(id) + (fijo && s.ctx ? `<div class="ta-ficha-acciones">${s.ctx.acciones(id)}<p class="faction-error" data-campo="error-ficha-${clave}" role="alert"></p></div>` : '');
  t.classList.toggle('fijo', fijo);
  t.hidden = false;
  tipDe = clave;
  if (fijo && s.ctx) s.ctx.cablearAcciones(t);
  colocar(s, ev ?? null, id);
  // Si el árbol desaparece (otra pestaña, ventana cerrada) el tooltip, que vive en <body>, se va con él.
  if (!vigia) vigia = setInterval(() => { const x = tipDe ? tableros.get(tipDe) : null; if (!x?.tablero?.isConnected) { if (x) x.fijado = null; ocultarTip(); } }, 400);
}

function colocar(s: EstadoTablero, ev: MouseEvent | FocusEvent | null, id: string): void {
  const t = tip;
  if (!t || t.hidden) return;
  const r = t.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  let x: number, y: number;
  if (ev && 'clientX' in ev && ev.type.startsWith('mouse')) {
    x = ev.clientX + 16; y = ev.clientY + 16;
    if (x + r.width > vw - 8) x = Math.max(8, ev.clientX - r.width - 16);
  } else {
    const b = s.tablero?.querySelector<HTMLElement>(`.ta-carta[data-nodo="${CSS.escape(id)}"]`)?.getBoundingClientRect();
    if (!b) return;
    x = b.right + 8; y = b.top;
    if (x + r.width > vw - 8) x = Math.max(8, b.left - r.width - 8);
  }
  if (x + r.width > vw - 8) x = 8;
  if (y + r.height > vh - 8) y = Math.max(8, vh - r.height - 8);
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}

function cerrarFicha(s: EstadoTablero): void { s.fijado = null; resaltar(s, null); ocultarTip(); }

/** Cablea el árbol recién pintado: traza las líneas (y las rehace al cambiar de tamaño), el resaltado, el tooltip, la ficha fija y el arrastre. */
export function montarTablero(clave: string, raiz: HTMLElement, ctx: ContextoArbol): void {
  const s = estado(clave);
  const tablero = raiz.querySelector<HTMLElement>(`.ta-tablero[data-ta-clave="${CSS.escape(clave)}"]`);
  const svg = tablero?.querySelector<SVGSVGElement>('.ta-lineas') ?? null;
  s.ctx = ctx;
  if (!tablero || !svg) { s.tablero = null; return; }
  s.tablero = tablero;
  s.svg = svg;
  s.resaltado = null;
  let pendiente = 0;
  const retrazar = (): void => { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(() => trazar(s)); };
  const ro = new ResizeObserver(retrazar);
  ro.observe(tablero);
  tablero.querySelectorAll('.ta-carta').forEach((el) => ro.observe(el));
  void document.fonts?.ready.then(retrazar);
  retrazar();
  tablero.scrollLeft = s.scroll;
  tablero.addEventListener('scroll', () => { s.scroll = tablero.scrollLeft; if (!s.fijado) ocultarTip(); else colocar(s, null, s.fijado); });

  raiz.querySelector<HTMLButtonElement>('[data-ta-todas]')?.addEventListener('click', (ev) => {
    s.todas = !s.todas;
    const b = ev.currentTarget as HTMLButtonElement;
    b.setAttribute('aria-pressed', String(s.todas));
    b.querySelector('.caja')!.textContent = s.todas ? '✓' : '';
    tablero.classList.toggle('todas', s.todas);
  });

  tablero.querySelectorAll<HTMLButtonElement>('.ta-carta').forEach((el) => {
    const id = el.dataset.nodo!;
    el.addEventListener('mouseenter', (ev) => { if (s.fijado) return; resaltar(s, id); mostrar(clave, id, ev); });
    el.addEventListener('mousemove', (ev) => { if (!s.fijado) colocar(s, ev, id); });
    el.addEventListener('mouseleave', () => { if (s.fijado) return; resaltar(s, null); ocultarTip(); });
    el.addEventListener('focus', (ev) => { if (s.fijado) return; resaltar(s, id); mostrar(clave, id, ev); });
    el.addEventListener('blur', () => { if (s.fijado) return; resaltar(s, null); ocultarTip(); });
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (s.fijado === id) { cerrarFicha(s); return; }
      for (const o of tableros.values()) if (o !== s) o.fijado = null;
      s.fijado = id;
      resaltar(s, id);
      mostrar(clave, id, ev);
    });
  });

  // Arrastrar el tablero con el ratón, como el mapa de un juego.
  let arrastre: { x: number; s: number } | null = null;
  tablero.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || (ev.target as HTMLElement).closest('.ta-carta')) return;
    arrastre = { x: ev.clientX, s: tablero.scrollLeft };
    tablero.classList.add('arrastrando');
  });
  tablero.addEventListener('pointermove', (ev) => { if (arrastre) tablero.scrollLeft = arrastre.s - (ev.clientX - arrastre.x); });
  const soltar = (): void => { arrastre = null; tablero.classList.remove('arrastrando'); };
  tablero.addEventListener('pointerup', soltar);
  tablero.addEventListener('pointerleave', soltar);

  if (!globalesPuestos) {
    globalesPuestos = true;
    const abierto = (): EstadoTablero | null => [...tableros.values()].find((o) => o.fijado) ?? null;
    document.addEventListener('click', (ev) => { const o = abierto(); if (o && tip && !tip.contains(ev.target as Node)) cerrarFicha(o); });
    document.addEventListener('keydown', (ev) => { const o = abierto(); if (ev.key === 'Escape' && o) cerrarFicha(o); });
    addEventListener('scroll', () => { const o = abierto(); if (o?.fijado) colocar(o, null, o.fijado); }, { passive: true, capture: true });
  }

  // Tras un repintado (llega un cambio de la proyección), la ficha que estaba abierta sigue abierta, con sus datos nuevos.
  if (s.fijado) {
    if (tablero.querySelector(`.ta-carta[data-nodo="${CSS.escape(s.fijado)}"]`)) { const f = s.fijado; requestAnimationFrame(() => { if (s.fijado === f) { resaltar(s, f); mostrar(clave, f, null); } }); }
    else cerrarFicha(s);
  } else if (tipDe === clave) ocultarTip();
}
