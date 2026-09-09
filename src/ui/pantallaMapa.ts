// Zoom / pan de la pantalla Mapa (T3). Solo DOM y eventos; la matemática está en `geometriaVista.ts`.
//
// El terreno lo sigue dibujando `render.ts` sobre un canvas de 900×900 sin enterarse del zoom: aquí solo se
// ESCALA el elemento por CSS (`transform`).
// ponytail: zoom por CSS transform, techo = resolución del ráster del terreno (canvas 900 + RES_BIOMA 128);
// si hace falta más detalle al acercar, re-dibujar a un canvas offscreen mayor.

import { clampPan, clampZoom, ladoBase, panParaCentrar, panTrasZoom } from './geometriaVista';

export interface ControlMapa {
  /** +1 acerca, -1 aleja (botones +/−); el zoom con rueda va por su cuenta. */
  zoomHacia(direccion: 1 | -1): void;
  /** Fija un punto de MUNDO que la vista debe mantener centrado (la columna del jugador). Se recalcula solo
   * cuando el contenedor ya tiene tamaño y se conoce el tamaño del mundo, así que da igual llamarlo antes de
   * que el mapa haya cargado. Arrastrar o hacer zoom con rueda lo suelta. */
  centrar(puntoMundo: { x: number; y: number }, anchoMundo: number, altoMundo: number): void;
  destruir(): void;
}

export function instalarZoomPan(
  contenedor: HTMLElement,
  lienzo: HTMLElement,
  opciones: {
    zoomInicial?: number;
    /** Se dispara en un pointerup que NO fue un arrastre (umbral 5 px): un clic sobre el mapa. */
    alClicar?: (evento: PointerEvent) => void;
  } = {}
): ControlMapa {
  let zoom = clampZoom(opciones.zoomInicial ?? 1);
  let panX = 0;
  let panY = 0;
  let foco: { x: number; y: number } | null = null;
  let mundoAncho = 0;
  let mundoAlto = 0;

  const lado = (): number => ladoBase(contenedor.clientWidth, contenedor.clientHeight);

  function aplicar(): void {
    const l = lado();
    if (l === 0) return; // el contenedor todavía no está maquetado; el ResizeObserver reintentará
    lienzo.style.width = `${l}px`;
    lienzo.style.height = `${l}px`;
    if (foco && mundoAncho > 0) {
      const p = panParaCentrar(foco, mundoAncho, mundoAlto, l, zoom);
      panX = p.x;
      panY = p.y;
    }
    panX = clampPan(panX, l * zoom, contenedor.clientWidth);
    panY = clampPan(panY, l * zoom, contenedor.clientHeight);
    lienzo.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  function zoomA(nuevoZoom: number, focoX: number, focoY: number): void {
    const z = clampZoom(nuevoZoom);
    if (z === zoom) return;
    if (!foco) {
      panX = panTrasZoom(panX, zoom, z, focoX);
      panY = panTrasZoom(panY, zoom, z, focoY);
    }
    zoom = z;
    aplicar();
  }

  const onWheel = (evento: WheelEvent): void => {
    evento.preventDefault();
    foco = null;
    const rect = contenedor.getBoundingClientRect();
    const focoX = evento.clientX - rect.left - rect.width / 2;
    const focoY = evento.clientY - rect.top - rect.height / 2;
    zoomA(zoom * (evento.deltaY < 0 ? 1.15 : 1 / 1.15), focoX, focoY);
  };

  let arrastrando = false;
  let ultimoX = 0;
  let ultimoY = 0;
  let inicioX = 0;
  let inicioY = 0;
  const onPointerDown = (evento: PointerEvent): void => {
    arrastrando = true;
    inicioX = ultimoX = evento.clientX;
    inicioY = ultimoY = evento.clientY;
    lienzo.classList.add('arrastrando');
    lienzo.setPointerCapture?.(evento.pointerId);
  };
  const onPointerMove = (evento: PointerEvent): void => {
    if (!arrastrando) return;
    if (Math.hypot(evento.clientX - inicioX, evento.clientY - inicioY) < 5) return; // aún puede ser un clic
    foco = null;
    panX += evento.clientX - ultimoX;
    panY += evento.clientY - ultimoY;
    ultimoX = evento.clientX;
    ultimoY = evento.clientY;
    aplicar();
  };
  const onPointerUp = (evento: PointerEvent): void => {
    arrastrando = false;
    lienzo.classList.remove('arrastrando');
    lienzo.releasePointerCapture?.(evento.pointerId);
    if (Math.hypot(evento.clientX - inicioX, evento.clientY - inicioY) < 5) opciones.alClicar?.(evento);
  };

  contenedor.addEventListener('wheel', onWheel, { passive: false });
  lienzo.addEventListener('pointerdown', onPointerDown);
  lienzo.addEventListener('pointermove', onPointerMove);
  lienzo.addEventListener('pointerup', onPointerUp);

  // El contenedor puede no estar maquetado aún cuando se instala esto (innerHTML recién asignado): el
  // observer dispara la primera vez en cuanto tiene tamaño y en cada cambio posterior — sustituye al listener
  // de `resize` de window y además cubre el arranque.
  const observer = new ResizeObserver(() => aplicar());
  observer.observe(contenedor);
  aplicar();

  return {
    zoomHacia: (direccion) => zoomA(zoom * (direccion === 1 ? 1.4 : 1 / 1.4), 0, 0),
    centrar: (puntoMundo, anchoMundo, altoMundo) => {
      foco = puntoMundo;
      mundoAncho = anchoMundo;
      mundoAlto = altoMundo;
      aplicar();
    },
    destruir: () => {
      observer.disconnect();
      contenedor.removeEventListener('wheel', onWheel);
      lienzo.removeEventListener('pointerdown', onPointerDown);
      lienzo.removeEventListener('pointermove', onPointerMove);
      lienzo.removeEventListener('pointerup', onPointerUp);
    },
  };
}
