// Ratón y teclado sobre la escena: arrastrar gira e inclina la cámara alrededor del héroe; un clic sin arrastre (menos de 5 px) es un clic en el
// terreno; la rueda cambia entre el zoom normal y el alejado; las flechas o WASD giran e inclinan.
import type { CamaraDeJuego } from './camara';

export interface Entrada {
  /** Gira con las teclas pulsadas; se llama en cada fotograma con los segundos que pasaron. */
  teclas(dt: number): void;
  destruir(): void;
}

export function instalarEntrada(lienzo: HTMLCanvasElement, camara: CamaraDeJuego, alClicar: (evento: PointerEvent) => void, alZoom: () => void): Entrada {
  let arrastre: { x: number; y: number } | null = null, pulsado: { x: number; y: number } | null = null;
  const pulsadas = new Set<string>();
  const abajo = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    pulsado = arrastre = { x: e.clientX, y: e.clientY };
    lienzo.setPointerCapture(e.pointerId);
  };
  const mueve = (e: PointerEvent): void => {
    if (!arrastre) return;
    camara.giro -= (e.clientX - arrastre.x) * 0.006;
    camara.inclinar((e.clientY - arrastre.y) * 0.25);
    arrastre = { x: e.clientX, y: e.clientY };
  };
  const arriba = (e: PointerEvent): void => {
    arrastre = null;
    const p = pulsado;
    pulsado = null;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 5) alClicar(e);
  };
  const cancela = (): void => { arrastre = pulsado = null; };
  const rueda = (e: WheelEvent): void => {
    e.preventDefault();
    const quiero = e.deltaY > 0 ? 'alejado' : 'normal';
    if (camara.zoom !== quiero) { camara.zoom = quiero; alZoom(); }
  };
  const tecla = (e: KeyboardEvent): void => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) return;
    pulsadas.add(e.key);
    e.preventDefault();
  };
  const suelta = (e: KeyboardEvent): void => { pulsadas.delete(e.key); };
  const vacia = (): void => pulsadas.clear();
  lienzo.addEventListener('pointerdown', abajo);
  lienzo.addEventListener('pointermove', mueve);
  lienzo.addEventListener('pointerup', arriba);
  lienzo.addEventListener('pointercancel', cancela);
  lienzo.addEventListener('wheel', rueda, { passive: false });
  lienzo.addEventListener('keydown', tecla);
  lienzo.addEventListener('keyup', suelta);
  lienzo.addEventListener('blur', vacia);
  return {
    teclas(dt) {
      if (pulsadas.has('ArrowUp') || pulsadas.has('w')) camara.inclinar(40 * dt);
      if (pulsadas.has('ArrowDown') || pulsadas.has('s')) camara.inclinar(-40 * dt);
      if (pulsadas.has('ArrowLeft') || pulsadas.has('a')) camara.giro += 1.4 * dt;
      if (pulsadas.has('ArrowRight') || pulsadas.has('d')) camara.giro -= 1.4 * dt;
    },
    destruir() {
      lienzo.removeEventListener('pointerdown', abajo);
      lienzo.removeEventListener('pointermove', mueve);
      lienzo.removeEventListener('pointerup', arriba);
      lienzo.removeEventListener('pointercancel', cancela);
      lienzo.removeEventListener('wheel', rueda);
      lienzo.removeEventListener('keydown', tecla);
      lienzo.removeEventListener('keyup', suelta);
      lienzo.removeEventListener('blur', vacia);
    },
  };
}
