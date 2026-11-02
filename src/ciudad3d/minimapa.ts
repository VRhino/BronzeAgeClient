// El minimapa de la vista 3D: el plano 2D de siempre (el lienzo de `pintarAsentamiento` en la plaza, el SVG de la planta en un campamento) con
// una capa encima que dibuja lo que abarca la cámara 3D, y el clic en él, que lleva la cámara a ese punto. El plano enseña un cuadrado del
// suelo (su encuadre, en ul) estirado sobre todo el elemento; la capa se estira igual, así comparten la misma conversión de ul a píxeles.
import { proyeccionAsentamiento } from '../render';
import type { TrazadoAsentamiento } from '../tiposDominio';

type Punto = { x: number; y: number };

/** El cuadrado del suelo que enseña el plano: esquina de arriba a la izquierda y lado, en ul. */
export interface EncuadreMinimapa {
  x0: number;
  y0: number;
  lado: number;
}

/** El encuadre del 2D de la plaza (`proyeccionAsentamiento`): centrado en el origen, el disco urbano al 92 % del lienzo. */
export function encuadreDePlaza(trazado: TrazadoAsentamiento | undefined): EncuadreMinimapa {
  const { escala } = proyeccionAsentamiento(1, trazado);
  return { x0: -0.5 / escala, y0: -0.5 / escala, lado: 1 / escala };
}

/** El encuadre de un SVG cuadrado por su `viewBox` (la planta del campamento). */
export function encuadreDeSvg(svg: SVGSVGElement | null): EncuadreMinimapa | null {
  const v = svg?.viewBox.baseVal;
  return v && v.width > 0 ? { x0: v.x, y0: v.y, lado: Math.max(v.width, v.height) } : null;
}

export class Minimapa {
  readonly capa = document.createElement('canvas');
  private huella: Punto[] = [];
  private encuadre: EncuadreMinimapa = encuadreDePlaza(undefined);

  /** `plano`: el lienzo o el SVG del 2D; la capa va justo detrás de él, encima. */
  constructor(private readonly plano: Element) {
    this.capa.className = 'asent-minimapa-camara';
    this.capa.setAttribute('aria-hidden', 'true');
    this.capa.width = this.capa.height = plano instanceof HTMLCanvasElement ? plano.width : 600;
    plano.insertAdjacentElement('afterend', this.capa);
  }

  /** De ul a píxeles internos de la capa. */
  private aPx(p: Punto): Punto {
    const { x0, y0, lado } = this.encuadre;
    return { x: ((p.x - x0) / lado) * this.capa.width, y: ((p.y - y0) / lado) * this.capa.height };
  }

  /** El punto del suelo (ul) bajo un evento del ratón sobre el minimapa. */
  puntoLocal(e: { clientX: number; clientY: number }): Punto {
    const r = this.capa.getBoundingClientRect(), { x0, y0, lado } = this.encuadre;
    return { x: x0 + ((e.clientX - r.left) / Math.max(1, r.width)) * lado, y: y0 + ((e.clientY - r.top) / Math.max(1, r.height)) * lado };
  }

  /** El trazado con que se pintó el 2D de la plaza (cambia la escala del minimapa). */
  fijarTrazado(t: TrazadoAsentamiento | undefined): void {
    this.fijarEncuadre(encuadreDePlaza(t));
  }

  /** Lo que enseña el plano, cuando no es el 2D de la plaza. */
  fijarEncuadre(e: EncuadreMinimapa): void {
    this.encuadre = e;
    this.pintar();
  }

  /** Lo que ve la cámara: las cuatro esquinas sobre el suelo (ul). */
  fijarHuella(h: Punto[]): void {
    this.huella = h;
    this.pintar();
  }

  private pintar(): void {
    const c = this.capa;
    if (this.plano instanceof HTMLCanvasElement && (c.width !== this.plano.width || c.height !== this.plano.height)) { c.width = this.plano.width; c.height = this.plano.height; }
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
