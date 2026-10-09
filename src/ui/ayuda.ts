// AYUDA «ⓘ»: el texto que explica una regla o un panel vive escondido detrás de un botón de información y se puede mostrar y ocultar, para que
// las interfaces estén limpias. Lo que NO va aquí: datos, estados, errores y el motivo corto de un botón apagado (ese va en `title` o en una línea breve).
//
//   ayuda('clave-unica', 'Texto largo…')   →   HTML: botón ⓘ + texto oculto (escapa tú el texto si viene del servidor).
//
// La `clave` identifica esa ayuda entre repintados: si el jugador la abrió, SIGUE abierta aunque el panel se repinte con el sondeo (`aplicarAyudas`
// la llama `pintar` de `ui/repintado.ts`). Se recuerda también entre sesiones (`localStorage`, en try/catch: sin él, todo cerrado al recargar).
const ALMACEN = 'bronze.ayudasAbiertas';
const abiertas = new Set<string>(leer());

function leer(): string[] {
  try { const v = JSON.parse(localStorage.getItem(ALMACEN) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}
function guardar(): void {
  try { localStorage.setItem(ALMACEN, JSON.stringify([...abiertas])); } catch { /* sin almacenamiento: se recuerda solo en esta página */ }
}

const escapar = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Botón ⓘ con su texto escondido. `texto` es HTML ya escapado (puede llevar `<strong>`, `<br>`…). `etiqueta` opcional: el nombre accesible del botón. */
export function ayuda(clave: string, texto: string, etiqueta = 'Información'): string {
  // Siempre sale cerrada: el HTML no depende de lo que el jugador tenga abierto (así `pintar` no repinta por abrir o cerrar); `aplicarAyudas` abre las suyas.
  return `<span class="ayuda" data-ayuda="${escapar(clave)}"><button type="button" class="ayuda-btn" aria-expanded="false" aria-label="${escapar(etiqueta)}" title="${escapar(etiqueta)}">ⓘ</button><span class="ayuda-texto" hidden>${texto}</span></span>`;
}

/** Pone al día las ayudas de un contenedor recién pintado según las que el jugador tiene abiertas. */
export function aplicarAyudas(raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('.ayuda[data-ayuda]').forEach((a) => marcar(a, abiertas.has(a.dataset.ayuda!)));
}

function marcar(a: HTMLElement, abierta: boolean): void {
  a.classList.toggle('abierta', abierta);
  a.querySelector('.ayuda-btn')?.setAttribute('aria-expanded', String(abierta));
  const texto = a.querySelector<HTMLElement>('.ayuda-texto');
  if (texto) texto.hidden = !abierta;
}

// Un solo oyente para toda la página: el botón es un nodo que los repintados reemplazan, así que no se cablea uno a uno.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (ev) => {
    const boton = (ev.target as HTMLElement | null)?.closest?.('.ayuda-btn');
    const a = boton?.closest<HTMLElement>('.ayuda[data-ayuda]');
    if (!a) return;
    const clave = a.dataset.ayuda!;
    const abrir = !abiertas.has(clave);
    if (abrir) abiertas.add(clave); else abiertas.delete(clave);
    guardar();
    // Si la misma ayuda aparece en más de un sitio a la vez, se abren juntas.
    document.querySelectorAll<HTMLElement>('.ayuda[data-ayuda]').forEach((x) => { if (x.dataset.ayuda === clave) marcar(x, abrir); });
  });
}
