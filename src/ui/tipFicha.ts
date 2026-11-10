// Tooltips con ficha (0.192.0, Víctor 2026-11-10): los de los botones de «Construir» y los de los recursos del Almacén, con la misma pinta que
// los de los árboles de tecnologías y de tropas (`.ta-tip`, ui/arbolTablero.ts). Un elemento lo pide con `data-tip="tipo:argumento"`; quien
// sabe pintar ese tipo se apunta con `registrarTip`. El tooltip vive en <body>, sigue al ratón (o se pone junto al elemento con el teclado) y
// se va al salir, al pulsar Esc o cuando el elemento desaparece en un repintado sin otro igual bajo el ratón (si el repintado pone el mismo en su
// sitio, el tooltip pasa a él con las cifras nuevas). No se fija ni tiene acciones: el clic sigue siendo del botón.

type Generador = (argumento: string, el: HTMLElement) => string;

const generadores = new Map<string, Generador>();
let tip: HTMLElement | null = null;
let ancla: HTMLElement | null = null;
let vigia: ReturnType<typeof setInterval> | undefined;
/** Dónde estaba el ratón la última vez (para buscar el elemento que deja un repintado en el sitio del de antes). */
let raton: { x: number; y: number } | null = null;
let instalado = false;

/** Apunta quién pinta los tooltips de un tipo (`edificio`, `recurso`…) e instala los oyentes la primera vez. */
export function registrarTip(tipo: string, generador: Generador): void {
  generadores.set(tipo, generador);
  instalar();
}

/** El atributo que pide el tooltip de `tipo` con `argumento`, ya escapado. */
export function atributoTip(tipo: string, argumento: string, esc: (s: string) => string): string {
  return ` data-tip="${esc(`${tipo}:${argumento}`)}"`;
}

/** El HTML del tooltip de un elemento con `data-tip`, o `''` si nadie sabe pintarlo (para las pruebas y para `mostrar`). */
export function contenidoTip(el: HTMLElement): string {
  const pedido = el.dataset.tip ?? '';
  const i = pedido.indexOf(':');
  const g = generadores.get(i < 0 ? pedido : pedido.slice(0, i));
  return g ? g(i < 0 ? '' : pedido.slice(i + 1), el) : '';
}

function elTip(): HTMLElement {
  if (tip?.isConnected) return tip;
  tip = document.createElement('div');
  tip.className = 'ta-tip tip-ficha';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  return tip;
}

function ocultar(): void {
  if (tip) tip.hidden = true;
  ancla = null;
  if (vigia) { clearInterval(vigia); vigia = undefined; }
}

function mostrar(el: HTMLElement, ev: MouseEvent | FocusEvent): void {
  const html = contenidoTip(el);
  if (!html) { ocultar(); return; }
  const t = elTip();
  t.innerHTML = html;
  t.hidden = false;
  ancla = el;
  colocar(ev);
  // un repintado quita el elemento de debajo del ratón: si en su sitio queda otro que pide lo mismo (la ventana del Almacén se repinta con cada
  // proyección), el tooltip pasa a él y se rehace con las cifras nuevas; si no, se va
  vigia ??= setInterval(() => {
    if (!ancla || ancla.isConnected) return;
    const otro = raton ? conTip(document.elementFromPoint(raton.x, raton.y)) : null;
    if (otro && otro.dataset.tip === ancla.dataset.tip && tip) { ancla = otro; const html = contenidoTip(otro); if (html) tip.innerHTML = html; else ocultar(); }
    else ocultar();
  }, 300);
}

function colocar(ev: MouseEvent | FocusEvent | null): void {
  const t = tip;
  if (!t || t.hidden || !ancla) return;
  const r = t.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  let x: number, y: number;
  if (ev && 'clientX' in ev) {
    x = ev.clientX + 16; y = ev.clientY + 16;
    if (x + r.width > vw - 8) x = Math.max(8, ev.clientX - r.width - 16);
    // abajo no cabe: encima del ratón (los botones de Construir van al pie de la pantalla)
    if (y + r.height > vh - 8) y = Math.max(8, ev.clientY - r.height - 12);
  } else {
    const b = ancla.getBoundingClientRect();
    x = b.left; y = b.top - r.height - 8;
    if (y < 8) y = b.bottom + 8;
    if (x + r.width > vw - 8) x = Math.max(8, vw - r.width - 8);
  }
  if (y + r.height > vh - 8) y = Math.max(8, vh - r.height - 8);
  t.style.left = `${Math.round(x)}px`;
  t.style.top = `${Math.round(y)}px`;
}

const conTip = (x: EventTarget | null): HTMLElement | null => (x instanceof Element ? x.closest<HTMLElement>('[data-tip]') : null);

function instalar(): void {
  if (instalado || typeof document === 'undefined') return;
  instalado = true;
  document.addEventListener('mouseover', (ev) => {
    raton = { x: ev.clientX, y: ev.clientY };
    const el = conTip(ev.target);
    if (el && el !== ancla) mostrar(el, ev);
    else if (!el && ancla) ocultar();
  });
  document.addEventListener('mousemove', (ev) => { raton = { x: ev.clientX, y: ev.clientY }; if (ancla) colocar(ev); });
  document.addEventListener('mouseout', (ev) => { if (ancla && !conTip(ev.relatedTarget)) ocultar(); });
  document.addEventListener('focusin', (ev) => { const el = conTip(ev.target); if (el) { raton = null; mostrar(el, ev); } });
  document.addEventListener('focusout', () => ocultar());
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ancla) ocultar(); });
  document.addEventListener('click', () => ocultar(), true);
}
