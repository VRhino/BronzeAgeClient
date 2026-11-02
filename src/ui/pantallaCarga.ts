// PANTALLA DE CARGA (Víctor, 2026-11-02): entre la vista del mundo y las de dentro (plaza, campamento, pueblo), y al entrar en la partida, una
// imagen a pantalla completa con un consejo del juego en el cuarto inferior (centrado, sobre un fondo opaco que se aclara hacia las orillas) y la
// barra de carga abajo. Es todo del cliente: el motor no sabe nada de esto.
//
// Los consejos y sus imágenes viven en un archivo del cliente, `public/carga/consejos.json` (se sirve en `<base>/carga/consejos.json`), que se lee
// en tiempo de ejecución: se puede cambiar sin recompilar, y lo edita la página «Consejos de carga» del cliente de administración. Su forma está en
// `docs/Pantallas_De_Carga.md`. Si el archivo no llega, la pantalla sale igual, con la barra y sin consejo.
//
// La pantalla se abre al cambiar de vista (`abrirCarga`) y se cierra cuando la vista nueva está pintada (`cerrarCarga`), con un mínimo para que
// dé tiempo a leer el consejo y un máximo por si la vista no avisa nunca.

/** Las vistas a las que se entra con pantalla de carga. Un consejo dice en cuáles sale (`vistas`; sin ninguna, en todas). */
export type VistaDeCarga = 'mundo' | 'asentamiento' | 'campamento' | 'pueblo';

export interface Consejo {
  id: string;
  texto: string;
  /** Id de una imagen de `imagenes`. */
  imagen?: string;
  vistas?: VistaDeCarga[];
  activo?: boolean;
}

export interface ImagenDeCarga {
  /** Ruta relativa a la carpeta `carga/` (p. ej. `img/plaza-muralla.jpg`) o una URL completa. */
  archivo: string;
  descripcion?: string;
}

export interface CatalogoDeCarga {
  version?: number;
  imagenes: Record<string, ImagenDeCarga>;
  consejos: Consejo[];
}

/** Lo que dura como poco (para leer el consejo) y como mucho (si la vista no avisa) una pantalla de carga, en ms. */
const MINIMO_MS = 2200;
const MAXIMO_MS = 15000;
const SALIDA_MS = 450;

const CARPETA = `${import.meta.env.BASE_URL ?? '/'}carga/`;

let catalogo: CatalogoDeCarga | null = null;
let pedido: Promise<CatalogoDeCarga | null> | null = null;
/** El último consejo enseñado, para no repetirlo dos veces seguidas (también al recargar la página: se guarda en la pestaña). */
const CLAVE_ULTIMO = 'bronzeage.carga.ultimo';
let ultimo: string | null = (() => { try { return sessionStorage.getItem(CLAVE_ULTIMO); } catch { return null; } })();

/** Lee el catálogo una vez (y vuelve a intentarlo la próxima si falló). Precarga las imágenes para que la primera pantalla no salga en negro. */
export function cargarCatalogoDeCarga(): Promise<CatalogoDeCarga | null> {
  if (catalogo) return Promise.resolve(catalogo);
  pedido ??= fetch(`${CARPETA}consejos.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<CatalogoDeCarga>) : null))
    .then((c) => {
      catalogo = c && Array.isArray(c.consejos) ? { imagenes: c.imagenes ?? {}, consejos: c.consejos, version: c.version } : null;
      if (catalogo) for (const im of Object.values(catalogo.imagenes)) { const i = new Image(); i.src = urlDeImagen(im.archivo); }
      return catalogo;
    })
    .catch(() => null)
    .finally(() => { if (!catalogo) pedido = null; });
  return pedido;
}

export function urlDeImagen(archivo: string): string {
  return /^(https?:|data:|\/)/.test(archivo) ? archivo : `${CARPETA}${archivo}`;
}

/** Un consejo para esa vista: al azar entre los activos que salen en ella, sin repetir el último si hay otro. */
export function elegirConsejo(c: CatalogoDeCarga, vista: VistaDeCarga | null, azar: () => number = Math.random): Consejo | null {
  const validos = c.consejos.filter((x) => x.activo !== false && x.texto?.trim() && (!vista || !x.vistas?.length || x.vistas.includes(vista)));
  const sinRepetir = validos.length > 1 ? validos.filter((x) => x.id !== ultimo) : validos;
  const elegido = sinRepetir[Math.floor(azar() * sinRepetir.length)] ?? null;
  if (elegido) {
    ultimo = elegido.id;
    try { sessionStorage.setItem(CLAVE_ULTIMO, elegido.id); } catch { /* sin almacenamiento: solo no se recuerda al recargar */ }
  }
  return elegido;
}

interface Abierta {
  el: HTMLElement;
  desde: number;
  barra: HTMLElement;
  reloj: ReturnType<typeof setInterval>;
  tope: ReturnType<typeof setTimeout>;
  cerrando: boolean;
}
let abierta: Abierta | null = null;

const escapar = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** ¿Hay una pantalla de carga a la vista? */
export const cargaAbierta = (): boolean => abierta !== null && !abierta.cerrando;

/**
 * Abre la pantalla de carga hacia una vista (`null`: entrar en la partida, sale cualquier consejo). `titulo` es lo que se lee sobre la barra
 * («Entrando en Pesinunte»). Si ya hay una abierta, solo cambia el título: el consejo no salta a mitad de lectura.
 */
export function abrirCarga(vista: VistaDeCarga | null, titulo: string): void {
  if (abierta && !abierta.cerrando) {
    const t = abierta.el.querySelector('.carga-titulo');
    if (t) t.textContent = titulo;
    return;
  }
  if (abierta) quitar(abierta);
  const el = document.createElement('div');
  el.className = 'pantalla-carga';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="carga-imagen"></div><div class="carga-velo"></div>
    <div class="carga-consejo" hidden><span class="carga-kicker">Consejo</span><p class="carga-texto"></p></div>
    <div class="carga-pie"><span class="carga-titulo">${escapar(titulo)}</span><div class="carga-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>`;
  document.body.appendChild(el);
  const barra = el.querySelector<HTMLElement>('.carga-barra i')!;
  const desde = performance.now();
  // La barra avanza sola hacia el 90 % mientras se espera (no se sabe cuánto falta); al terminar, se llena.
  const reloj = setInterval(() => {
    const t = (performance.now() - desde) / 1000;
    poner(barra, 90 * (1 - Math.exp(-t / 1.6)));
  }, 80);
  const tope = setTimeout(() => cerrarCarga(), MAXIMO_MS);
  abierta = { el, desde, barra, reloj, tope, cerrando: false };
  const pintarConsejo = (c: CatalogoDeCarga | null): void => {
    if (!c || abierta?.el !== el) return;
    const consejo = elegirConsejo(c, vista);
    const imagen = consejo?.imagen ? c.imagenes[consejo.imagen] : undefined;
    if (imagen) {
      const fondo = el.querySelector<HTMLElement>('.carga-imagen')!;
      const img = new Image();
      img.onload = () => { fondo.style.backgroundImage = `url("${img.src}")`; fondo.classList.add('cargada'); };
      img.src = urlDeImagen(imagen.archivo);
      if (imagen.descripcion) fondo.setAttribute('aria-label', imagen.descripcion);
    }
    if (consejo) {
      el.querySelector('.carga-texto')!.textContent = consejo.texto;
      el.querySelector<HTMLElement>('.carga-consejo')!.hidden = false;
    }
  };
  if (catalogo) pintarConsejo(catalogo);
  else void cargarCatalogoDeCarga().then(pintarConsejo);
}

function poner(barra: HTMLElement, pct: number): void {
  barra.style.width = `${pct.toFixed(1)}%`;
  barra.parentElement?.setAttribute('aria-valuenow', String(Math.round(pct)));
}

function quitar(a: Abierta): void {
  clearInterval(a.reloj);
  clearTimeout(a.tope);
  a.el.remove();
  if (abierta === a) abierta = null;
}

/** La vista nueva ya está pintada: la barra se llena y la pantalla se va (no antes del mínimo, para que dé tiempo a leer el consejo). */
export function cerrarCarga(): void {
  const a = abierta;
  if (!a || a.cerrando) return;
  a.cerrando = true;
  clearTimeout(a.tope);
  const espera = Math.max(0, MINIMO_MS - (performance.now() - a.desde));
  setTimeout(() => {
    clearInterval(a.reloj);
    poner(a.barra, 100);
    setTimeout(() => {
      a.el.classList.add('saliendo');
      setTimeout(() => quitar(a), SALIDA_MS);
    }, 220);
  }, espera);
}
