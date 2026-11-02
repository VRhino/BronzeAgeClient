// El minimapa de la plaza: el 2D de siempre (`pintarAsentamiento`, en su lienzo) con una capa encima que dibuja lo que abarca la cámara 3D, y el
// clic en él, que lleva la cámara a ese punto. La capa tiene el mismo tamaño interno que el lienzo del 2D y se estira igual, así comparten la
// misma conversión de unidades locales a píxeles (`proyeccionAsentamiento`).
import { proyeccionAsentamiento } from '../render';
import type { TrazadoAsentamiento } from '../tiposDominio';

type Punto = { x: number; y: number };

export class Minimapa {
  readonly capa = document.createElement('canvas');
  private huella: Punto[] = [];
  private trazado: TrazadoAsentamiento | undefined;

  constructor(private readonly lienzo: HTMLCanvasElement) {
    this.capa.className = 'asent-minimapa-camara';
    this.capa.setAttribute('aria-hidden', 'true');
    lienzo.insertAdjacentElement('afterend', this.capa);
  }

  /** De ul a píxeles internos del lienzo. */
  private aPx(p: Punto): Punto {
    const { escala, centro } = proyeccionAsentamiento(this.lienzo.width, this.trazado);
    return { x: centro + p.x * escala, y: this.lienzo.height / 2 + p.y * escala };
  }

  /** El punto de la plaza (ul) bajo un evento del ratón sobre el minimapa. */
  puntoLocal(e: { clientX: number; clientY: number }): Punto {
    const r = this.lienzo.getBoundingClientRect();
    const px = (e.clientX - r.left) * (this.lienzo.width / r.width), py = (e.clientY - r.top) * (this.lienzo.height / r.height);
    const { escala, centro } = proyeccionAsentamiento(this.lienzo.width, this.trazado);
    return { x: (px - centro) / escala, y: (py - this.lienzo.height / 2) / escala };
  }

  /** El trazado con que se pintó el 2D (cambia la escala del minimapa). */
  fijarTrazado(t: TrazadoAsentamiento | undefined): void {
    this.trazado = t;
    this.pintar();
  }

  /** Lo que ve la cámara: las cuatro esquinas sobre el suelo (ul). */
  fijarHuella(h: Punto[]): void {
    this.huella = h;
    this.pintar();
  }

  private pintar(): void {
    const c = this.capa;
    if (c.width !== this.lienzo.width || c.height !== this.lienzo.height) { c.width = this.lienzo.width; c.height = this.lienzo.height; }
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (this.huella.length < 3) return;
    g.beginPath();
    this.huella.forEach((p, i) => { const q = this.aPx(p); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
    g.closePath();
    g.fillStyle = 'rgba(255, 236, 170, 0.14)';
    g.fill();
    g.lineWidth = Math.max(2, c.width / 220);
    g.strokeStyle = 'rgba(255, 226, 140, 0.95)';
    g.stroke();
  }

  destruir(): void {
    this.capa.remove();
  }
}
