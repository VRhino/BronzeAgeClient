// REPINTADO MÍNIMO de los paneles. El sondeo de 3 s vuelve a pedir el estado y cada panel se rehace; si se hiciera a ciegas, cada repintado se llevaría lo
// que el jugador está eligiendo (casillas, cantidades, listas), el foco y el scroll. Todo panel que se repinta con el sondeo pasa por `pintar`:
//   1. Si el HTML no cambió, NO toca el DOM (los botones siguen siendo los mismos nodos: un clic nunca cae en un botón que se acaba de reemplazar).
//   2. Si cambió, lo reemplaza y devuelve al jugador lo suyo: el valor de los controles que ha TOCADO (los que no tocó toman el valor nuevo del servidor),
//      el foco con su cursor y el scroll. Los listeners se vuelven a cablear con los datos frescos (`cablear`), por eso no se muta el DOM en sitio.
// Un panel que cambia de contenido (otra pestaña, otro panel en el mismo contenedor) pasa un `ambito` distinto y empieza limpio.
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface EstadoControl { valor: string; marcado: boolean }

const previos = new WeakMap<HTMLElement, { html: string; primero: ChildNode | null; ambito: string }>();
const tocados = new WeakMap<HTMLElement, Map<string, EstadoControl>>();
const vigilados = new WeakSet<HTMLElement>();

const esControl = (n: EventTarget | null): n is Control => n instanceof HTMLInputElement || n instanceof HTMLSelectElement || n instanceof HTMLTextAreaElement;

/** Lo que identifica un control entre dos pintados: etiqueta, tipo, name, id, sus `data-*` y, en radios y casillas, su `value`; los iguales se distinguen por orden. */
function firma(c: Control): string {
  const datos = Array.from(c.attributes).filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}=${a.value}`).join(';');
  const valor = c instanceof HTMLInputElement && (c.type === 'radio' || c.type === 'checkbox') ? c.getAttribute('value') ?? '' : '';
  return `${c.tagName}|${c instanceof HTMLInputElement ? c.type : ''}|${c.name}|${c.id}|${valor}|${datos}`;
}

function clavesDe(el: HTMLElement): Map<Control, string> {
  const vistos = new Map<string, number>();
  const salida = new Map<Control, string>();
  el.querySelectorAll<Control>('input, select, textarea').forEach((c) => {
    const f = firma(c);
    const n = vistos.get(f) ?? 0;
    vistos.set(f, n + 1);
    salida.set(c, `${f}#${n}`);
  });
  return salida;
}

/** Anota lo que el jugador toca (`input` y `change` suben hasta el contenedor): solo eso se restaura tras un repintado. */
function vigilar(el: HTMLElement): void {
  if (vigilados.has(el)) return;
  vigilados.add(el);
  const anotar = (ev: Event): void => {
    const c = ev.target;
    if (!esControl(c)) return;
    const clave = clavesDe(el).get(c);
    if (!clave) return;
    const mapa = tocados.get(el) ?? new Map<string, EstadoControl>();
    mapa.set(clave, { valor: c.value, marcado: c instanceof HTMLInputElement ? c.checked : false });
    tocados.set(el, mapa);
  };
  el.addEventListener('input', anotar);
  el.addEventListener('change', anotar);
}

/**
 * Pone `html` en `el` solo si cambió, conservando lo del jugador, y llama a `cablear` con los nodos nuevos. Devuelve `true` si repintó.
 * `ambito` identifica QUÉ se está enseñando en ese contenedor: si cambia, se olvida lo tocado y el scroll.
 */
export function pintar(el: HTMLElement, html: string, cablear?: () => void, ambito = ''): boolean {
  vigilar(el);
  const previo = previos.get(el);
  if (previo && previo.html === html && previo.ambito === ambito && el.firstChild === previo.primero) return false;
  const mismoAmbito = previo?.ambito === ambito;
  if (!mismoAmbito) tocados.delete(el);

  // Lo que hay que devolver: foco con cursor y scroll (del contenedor y de lo que desplaza dentro).
  const activo = document.activeElement;
  const claves = clavesDe(el);
  const foco = mismoAmbito && esControl(activo) && el.contains(activo) ? { clave: claves.get(activo), ini: activo instanceof HTMLSelectElement ? null : activo.selectionStart, fin: activo instanceof HTMLSelectElement ? null : activo.selectionEnd } : null;
  const desplazados: { i: number; y: number }[] = mismoAmbito
    ? [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))].flatMap((n, i) => (n.scrollTop > 0 ? [{ i, y: n.scrollTop }] : []))
    : [];

  el.innerHTML = html;
  cablear?.();

  // Los controles que el jugador tocó recuperan su valor (los demás se quedan con el de `html`).
  const editados = tocados.get(el);
  const nuevas = clavesDe(el);
  if (editados) {
    nuevas.forEach((clave, c) => {
      const estado = editados.get(clave);
      if (!estado) return;
      if (c instanceof HTMLInputElement && (c.type === 'checkbox' || c.type === 'radio')) c.checked = estado.marcado;
      else c.value = estado.valor;
    });
  }
  if (foco?.clave) {
    const c = Array.from(nuevas.entries()).find(([, k]) => k === foco.clave)?.[0];
    if (c) {
      c.focus({ preventScroll: true });
      if (foco.ini !== null && foco.fin !== null && !(c instanceof HTMLSelectElement)) { try { c.setSelectionRange(foco.ini, foco.fin); } catch { /* number y similares no admiten selección */ } }
    }
  }
  if (desplazados.length > 0) {
    const nodos = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))];
    desplazados.forEach(({ i, y }) => { if (nodos[i]) nodos[i]!.scrollTop = y; });
  }
  previos.set(el, { html, primero: el.firstChild, ambito });
  return true;
}

/** Deja el contenedor vacío y sin memoria (se cerró el panel). */
export function vaciar(el: HTMLElement): void {
  el.innerHTML = '';
  previos.delete(el);
  tocados.delete(el);
}

/** Olvida lo que el jugador había tocado en ese contenedor (p. ej. tras enviar el formulario con éxito: el siguiente pintado vuelve a los valores del servidor). */
export function olvidarEdicion(el: HTMLElement): void {
  tocados.delete(el);
}

/** Fuerza que el siguiente `pintar` repinte aunque el HTML sea el mismo (y olvida lo tocado): para «volver a empezar» ese panel. */
export function invalidar(el: HTMLElement): void {
  previos.delete(el);
  tocados.delete(el);
}
