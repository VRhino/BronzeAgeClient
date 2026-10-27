// La cámara de la pantalla Mapa: solo DOM y eventos; la matemática está en `geometriaVista.ts`.
//
// El lienzo mide lo que mide el contenedor (por `devicePixelRatio`) y se REPINTA a cada cambio de cámara (`alCambiar`): ya no se escala
// por CSS una imagen del mundo entero, porque de la vista del mundo a la escala de visión del jugador hay un factor ~80 y la imagen se
// vería a cuadros. Quien pinta fija `ctx.setTransform` con `transformar(ctx)` y dibuja en unidades × `escala`, como siempre.

import { fijarEscalaDeAgarre } from './agarre';
import { acotar, aMundo, arrastrar, escalaDeVision, escalaMinima, origen, zoomHacia, type Camara } from './geometriaVista';

/** Radio de visión de un héroe solo (`VISION.jugadorSolo`) hasta que lleguen los datos de juego del servidor. */
export const RADIO_VISION_POR_DEFECTO = 15;

export interface ControlMapa {
  /** +1 acerca, -1 aleja (botones +/−); el zoom con rueda va por su cuenta. */
  zoomHacia(direccion: 1 | -1): void;
  /** Fija un punto de MUNDO que la vista debe mantener centrado (la columna del jugador). Da igual llamarlo antes de que el mapa haya
   * cargado: se aplica en cuanto se conocen el tamaño del lienzo y el del mundo. Arrastrar o hacer zoom con rueda lo suelta. */
  centrar(puntoMundo: { x: number; y: number }, anchoMundo: number, altoMundo: number): void;
  /** El tamaño del mundo (el del motor es 2.667 × 2.000). */
  fijarMundo(anchoMundo: number, altoMundo: number): void;
  /** El radio de visión del héroe, que fija el zoom máximo (y el inicial). */
  fijarRadioVision(radio: number): void;
  /** La cámara actual (para guardar la vista). */
  estado(): Camara;
  /** ¿Sigue la vista un punto fijado con `centrar`? (hasta que se arrastra o se hace zoom con la rueda). */
  siguiendo(): boolean;
  /** El punto del mundo bajo un evento del puntero. */
  aMundo(evento: { clientX: number; clientY: number }): { x: number; y: number };
  /** Fija en `ctx` la transformación de la cámara (unidades × `escala` → px del lienzo) y devuelve la `escala` con la que pintar. */
  transformar(ctx: CanvasRenderingContext2D): number;
  destruir(): void;
}

export function instalarZoomPan(
  contenedor: HTMLElement,
  lienzo: HTMLElement,
  opciones: {
    /** La vista guardada; se acota igual que cualquier otra. Sin ella, a escala de visión. */
    camaraInicial?: Camara;
    /** Se dispara en un pointerup que NO fue un arrastre (umbral 5 px): un clic sobre el mapa. */
    alClicar?: (evento: PointerEvent) => void;
    /** La cámara cambió (zoom, arrastre, tamaño): hay que repintar. Agrupado por `requestAnimationFrame`. */
    alCambiar?: () => void;
  } = {}
): ControlMapa {
  const canvas = lienzo.querySelector('canvas')!;
  let camara: Camara | null = opciones.camaraInicial ?? null;
  let foco: { x: number; y: number } | null = null;
  let mundo = { ancho: 0, alto: 0 };
  let radioVision = RADIO_VISION_POR_DEFECTO;

  const tamano = () => ({ ancho: contenedor.clientWidth, alto: contenedor.clientHeight });
  const topes = (): [number, number] => {
    const t = tamano();
    return [escalaMinima(t, mundo), escalaDeVision(t, radioVision)];
  };

  let pendiente = 0;
  const avisar = (): void => {
    if (pendiente) return;
    pendiente = requestAnimationFrame(() => {
      pendiente = 0;
      opciones.alCambiar?.();
    });
  };

  function aplicar(): void {
    const t = tamano();
    if (t.ancho === 0 || mundo.ancho === 0) return; // sin maquetar o sin mundo: el ResizeObserver o `fijarMundo` reintentarán
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(t.ancho * dpr);
    const h = Math.round(t.alto * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const [min, max] = topes();
    const base = camara ?? { escala: max, cx: mundo.ancho / 2, cy: mundo.alto / 2 };
    camara = acotar(foco ? { ...base, cx: foco.x, cy: foco.y } : base, t, mundo, min, max);
    fijarEscalaDeAgarre(camara.escala);
    avisar();
  }

  function zoomA(factor: number, focoX: number, focoY: number): void {
    if (!camara) return;
    camara = foco ? { ...camara, escala: camara.escala * factor } : zoomHacia(camara, factor, focoX, focoY);
    aplicar();
  }

  const desdeCentro = (evento: { clientX: number; clientY: number }): [number, number] => {
    const rect = contenedor.getBoundingClientRect();
    return [evento.clientX - rect.left - rect.width / 2, evento.clientY - rect.top - rect.height / 2];
  };

  const onWheel = (evento: WheelEvent): void => {
    evento.preventDefault();
    foco = null;
    const [x, y] = desdeCentro(evento);
    zoomA(evento.deltaY < 0 ? 1.15 : 1 / 1.15, x, y);
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
    if (!arrastrando || !camara) return;
    if (Math.hypot(evento.clientX - inicioX, evento.clientY - inicioY) < 5) return; // aún puede ser un clic
    foco = null;
    camara = arrastrar(camara, evento.clientX - ultimoX, evento.clientY - ultimoY);
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

  // El contenedor puede no estar maquetado aún (innerHTML recién asignado): el observer dispara en cuanto tiene tamaño y en cada cambio.
  const observer = new ResizeObserver(() => aplicar());
  observer.observe(contenedor);

  return {
    estado: () => camara ?? { escala: 1, cx: mundo.ancho / 2, cy: mundo.alto / 2 },
    siguiendo: () => foco !== null,
    zoomHacia: (direccion) => zoomA(direccion === 1 ? 1.4 : 1 / 1.4, 0, 0),
    centrar: (puntoMundo, anchoMundo, altoMundo) => {
      foco = puntoMundo;
      mundo = { ancho: anchoMundo, alto: altoMundo };
      aplicar();
    },
    fijarMundo: (anchoMundo, altoMundo) => {
      if (anchoMundo === mundo.ancho && altoMundo === mundo.alto) return;
      mundo = { ancho: anchoMundo, alto: altoMundo };
      aplicar();
    },
    fijarRadioVision: (radio) => {
      if (!(radio > 0) || radio === radioVision) return;
      // Si se estaba a escala de visión, se sigue a la nueva.
      const enElTope = camara && Math.abs(camara.escala - topes()[1]) < 1e-6;
      radioVision = radio;
      if (enElTope && camara) camara = { ...camara, escala: topes()[1] };
      aplicar();
    },
    aMundo: (evento) => {
      const [x, y] = desdeCentro(evento);
      return camara ? aMundo(camara, x, y) : { x: 0, y: 0 };
    },
    transformar: (ctx) => {
      const c = camara ?? { escala: canvas.width / Math.max(1, mundo.ancho), cx: mundo.ancho / 2, cy: mundo.alto / 2 };
      const dpr = canvas.width / Math.max(1, contenedor.clientWidth);
      const o = origen(c, tamano());
      ctx.setTransform(dpr, 0, 0, dpr, -o.x * c.escala * dpr, -o.y * c.escala * dpr);
      return c.escala;
    },
    destruir: () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      observer.disconnect();
      contenedor.removeEventListener('wheel', onWheel);
      lienzo.removeEventListener('pointerdown', onPointerDown);
      lienzo.removeEventListener('pointermove', onPointerMove);
      lienzo.removeEventListener('pointerup', onPointerUp);
    },
  };
}
