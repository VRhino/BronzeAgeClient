// Ratón, teclado y dedos sobre la plaza 3D:
//   arrastrar con el botón izquierdo desplaza; con el derecho (o con Mayúsculas) gira e inclina; la rueda acerca y aleja;
//   WASD o flechas desplazan, Q y E giran, R y F inclinan, + y − acercan y alejan;
//   un clic sin arrastre (menos de 5 px) elige lo que hay debajo; pasar el ratón por encima avisa (para el rótulo flotante);
//   con dos dedos se pellizca para acercar.
import type { CamaraDeCiudad } from './camara';

export interface EntradaDeCiudad {
  teclas(dt: number): void;
  destruir(): void;
}

export function instalarEntrada(
  lienzo: HTMLCanvasElement,
  camara: CamaraDeCiudad,
  o: { alClicar: (e: PointerEvent) => void; alPasar: (e: PointerEvent | null) => void },
): EntradaDeCiudad {
  const dedos = new Map<number, { x: number; y: number }>();
  let pulsado: { x: number; y: number; boton: number; giro: boolean } | null = null, movido = 0, pellizco = 0;
  const pulsadas = new Set<string>();

  const abajo = (e: PointerEvent): void => {
    lienzo.focus({ preventScroll: true });
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lienzo.setPointerCapture(e.pointerId);
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      pellizco = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      pulsado = null;
      return;
    }
    pulsado = { x: e.clientX, y: e.clientY, boton: e.button, giro: e.button === 2 || e.shiftKey };
    movido = 0;
  };
  const mueve = (e: PointerEvent): void => {
    const antes = dedos.get(e.pointerId);
    if (!antes) { o.alPasar(e); return; }
    const dx = e.clientX - antes.x, dy = e.clientY - antes.y;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pellizco > 0 && d > 0) camara.acercar(pellizco / d);
      pellizco = d;
      return;
    }
    if (!pulsado) return;
    movido += Math.abs(dx) + Math.abs(dy);
    if (pulsado.giro) {
      camara.girar(-dx * 0.006);
      camara.inclinar(dy * 0.25);
    } else camara.desplazar(dx, dy, lienzo.clientHeight);
  };
  const arriba = (e: PointerEvent): void => {
    const p = pulsado;
    dedos.delete(e.pointerId);
    if (dedos.size < 2) pellizco = 0;
    pulsado = null;
    if (p && p.boton === 0 && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 5 && movido <= 8) o.alClicar(e);
  };
  const cancela = (e: PointerEvent): void => { dedos.delete(e.pointerId); pulsado = null; pellizco = 0; };
  const fuera = (): void => o.alPasar(null);
  const rueda = (e: WheelEvent): void => {
    e.preventDefault();
    camara.acercar(Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0015))));
  };
  const menu = (e: MouseEvent): void => e.preventDefault();
  const TECLAS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'q', 'e', 'r', 'f', '+', '-'];
  const tecla = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!TECLAS.includes(k) || e.ctrlKey || e.metaKey || e.altKey) return;
    pulsadas.add(k);
    e.preventDefault();
  };
  const suelta = (e: KeyboardEvent): void => { pulsadas.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); };
  const vacia = (): void => pulsadas.clear();

  lienzo.addEventListener('pointerdown', abajo);
  lienzo.addEventListener('pointermove', mueve);
  lienzo.addEventListener('pointerup', arriba);
  lienzo.addEventListener('pointercancel', cancela);
  lienzo.addEventListener('pointerleave', fuera);
  lienzo.addEventListener('wheel', rueda, { passive: false });
  lienzo.addEventListener('contextmenu', menu);
  lienzo.addEventListener('keydown', tecla);
  lienzo.addEventListener('keyup', suelta);
  lienzo.addEventListener('blur', vacia);
  return {
    teclas(dt) {
      const v = camara.distancia * 0.9 * dt, h = (k: string) => pulsadas.has(k);
      if (h('ArrowUp') || h('w')) camara.andar(0, v);
      if (h('ArrowDown') || h('s')) camara.andar(0, -v);
      if (h('ArrowLeft') || h('a')) camara.andar(-v, 0);
      if (h('ArrowRight') || h('d')) camara.andar(v, 0);
      if (h('q')) camara.girar(1.4 * dt);
      if (h('e')) camara.girar(-1.4 * dt);
      if (h('r')) camara.inclinar(40 * dt);
      if (h('f')) camara.inclinar(-40 * dt);
      if (h('+')) camara.acercar(Math.exp(-1.2 * dt));
      if (h('-')) camara.acercar(Math.exp(1.2 * dt));
    },
    destruir() {
      lienzo.removeEventListener('pointerdown', abajo);
      lienzo.removeEventListener('pointermove', mueve);
      lienzo.removeEventListener('pointerup', arriba);
      lienzo.removeEventListener('pointercancel', cancela);
      lienzo.removeEventListener('pointerleave', fuera);
      lienzo.removeEventListener('wheel', rueda);
      lienzo.removeEventListener('contextmenu', menu);
      lienzo.removeEventListener('keydown', tecla);
      lienzo.removeEventListener('keyup', suelta);
      lienzo.removeEventListener('blur', vacia);
    },
  };
}
