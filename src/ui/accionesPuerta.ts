// LAS ACCIONES A LA PUERTA en la ficha del mundo (Víctor, 2026-11-10: «mover ese panel abajo a la derecha con las acciones que puedes hacer sobre
// él, con un botón para cada una, reutilizando los paneles internos para lo que lo amerite»). Sin cambios en el motor: si algo no se puede hacer
// desde fuera, no sale. La ficha (`.mapa-seleccion`, abajo a la derecha) lleva sus datos y debajo una fila de botones de dos clases:
//   · los que actúan al pulsarlos (Entrar, Llenar víveres, Atacar, Inspeccionar, Unirte a la batalla, Reponer las prestadas…): cada ficha los
//     cablea con su `data-puerta`;
//   · los que abren una ventana (Carga, Caravanas, Mercado, Taberna, Guarnición, Obra): `data-puerta-ventana`, que este módulo abre y cierra.
// La ventana usa el marco de las ventanas del riel de la plaza (`.asent-ventana`), a la izquierda de la ficha, con el panel de siempre dentro.
import { pintar, vaciar } from './repintado';

type Escapar = (valor: string) => string;

/** Un botón de la fila. `ventana`: abre la ventana con ese id; si no, es una acción directa (`data-puerta="id"`). `motivo`: apagado, y por qué. */
export interface AccionPuerta {
  id: string;
  etiqueta: string;
  icono?: string;
  principal?: boolean;
  ventana?: boolean;
  motivo?: string;
  titulo?: string;
}

/** Lo que pinta una ventana de la puerta: título, icono, ancho y el panel de dentro con su cableado. */
export interface VentanaPuerta {
  titulo: string;
  icono: string;
  ancho?: 'estrecha' | 'normal' | 'ancha';
  html: string;
  cablear: (cuerpo: HTMLElement) => void;
}

/** La fila de botones de la ficha; vacía si no hay ninguno. */
export function htmlAccionesPuerta(acciones: AccionPuerta[], e: Escapar): string {
  if (!acciones.length) return '';
  const boton = (a: AccionPuerta): string => {
    const clase = a.ventana ? 'puerta-boton puerta-boton-ventana' : `puerta-boton ${a.principal ? 'btn-primary' : 'btn-secondary'}`;
    const dato = a.ventana ? `data-puerta-ventana="${e(a.id)}"` : `data-puerta="${e(a.id)}"`;
    const activa = a.ventana === true && ventanaPuertaAbierta() === a.id;
    const abierta = a.ventana ? ` aria-pressed="${activa}"` : '';
    const titulo = a.motivo ?? a.titulo;
    return `<button class="${clase}${activa ? ' activo' : ''}" type="button" ${dato}${abierta}${a.motivo ? ' disabled' : ''}${titulo ? ` title="${e(titulo)}"` : ''}>${a.icono ? `<span class="puerta-boton-icono" aria-hidden="true">${a.icono}</span>` : ''}<span>${e(a.etiqueta)}</span></button>`;
  };
  const directas = acciones.filter((a) => !a.ventana);
  const ventanas = acciones.filter((a) => a.ventana);
  return `<div class="puerta-acciones">
    ${directas.length ? `<div class="puerta-fila">${directas.map(boton).join('')}</div>` : ''}
    ${ventanas.length ? `<div class="puerta-fila puerta-fila-ventanas">${ventanas.map(boton).join('')}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- la ventana abierta

/** La ventana abierta y de qué ficha (`clave` = `tipo:id` de la selección): al cambiar de selección se cierra sola. */
let abierta_: { clave: string; id: string } | null = null;
/** Las ventanas que ofrece la ficha pintada ahora (las pone cada ficha al pintarse). */
let ofrecidas: Record<string, () => VentanaPuerta> = {};
let claveOfrecida = '';

/** Lo que la ficha que se acaba de pintar ofrece como ventanas. Se llama en cada repintado de la ficha, aunque su HTML no cambie. */
export function ofrecerVentanas(clave: string, ventanas: Record<string, () => VentanaPuerta>): void {
  claveOfrecida = clave;
  ofrecidas = ventanas;
}

export const ventanaPuertaAbierta = (): string | null => (abierta_ && abierta_.clave === claveOfrecida ? abierta_.id : null);

export function cerrarVentanaPuerta(): void {
  abierta_ = null;
}

/** Cablea los botones de ventana de la ficha: abren su ventana o, si ya está abierta, la cierran. `repintar` vuelve a pintar la ficha y la ventana. */
export function cablearBotonesDeVentana(cont: HTMLElement, clave: string, repintar: () => void): void {
  cont.querySelectorAll<HTMLButtonElement>('[data-puerta-ventana]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.puertaVentana!;
    abierta_ = abierta_?.clave === clave && abierta_.id === id ? null : { clave, id };
    repintar();
  }));
}

/** Pinta (o esconde) la ventana de la puerta en `ventana` (una `.asent-ventana` del mundo). Si la ficha ya no ofrece esa ventana, se cierra. */
export function pintarVentanaPuerta(ventana: HTMLElement | null, alCerrar: () => void): void {
  if (!ventana) return;
  const titulo = ventana.querySelector<HTMLElement>('.asent-ventana-titulo');
  const cuerpo = ventana.querySelector<HTMLElement>('.asent-edif-cuerpo');
  if (!titulo || !cuerpo) return;
  const id = ventanaPuertaAbierta();
  const hacer = id ? ofrecidas[id] : undefined;
  if (!id || !hacer) {
    if (abierta_ && (!id || !hacer)) abierta_ = null;
    ventana.hidden = true;
    vaciar(cuerpo);
    return;
  }
  const x = hacer();
  ventana.hidden = false;
  ventana.dataset.ancho = x.ancho ?? 'normal';
  ventana.setAttribute('aria-label', x.titulo);
  pintar(titulo, `<span class="asent-ventana-icono" aria-hidden="true">${x.icono}</span><h2>${x.titulo}</h2>`, undefined, 'titulo');
  pintar(cuerpo, `<div class="asent-lado-cuerpo">${x.html}</div>`, () => x.cablear(cuerpo), `${claveOfrecida}:${id}`);
  const cerrar = ventana.querySelector<HTMLButtonElement>('[data-ventana-cerrar]');
  if (cerrar && !cerrar.dataset.cableado) {
    cerrar.dataset.cableado = '1';
    cerrar.addEventListener('click', () => { abierta_ = null; alCerrar(); });
  }
}

/** El HTML del marco vacío de la ventana (va una vez en la pantalla del mundo). */
export const HTML_VENTANA_PUERTA = `<section class="asent-ventana puerta-ventana" role="dialog" aria-label="Puerta" hidden>
  <header class="asent-ventana-cab"><div class="asent-ventana-titulo"></div><button class="asent-ventana-cerrar" type="button" data-ventana-cerrar title="Cerrar (Esc)" aria-label="Cerrar">✕</button></header>
  <div class="asent-edif-cuerpo"></div>
</section>`;
