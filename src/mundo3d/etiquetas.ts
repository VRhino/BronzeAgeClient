// Los nombres sobre el mundo: elementos HTML encima del lienzo, colocados en cada fotograma donde cae en pantalla su punto del mundo. Se
// reutilizan por su id; los que quedan detrás de la cámara, fuera de la pantalla o más allá de `lejos` se esconden.
import * as THREE from 'three';
import type { EtiquetaEnVista } from './estado';

export class Etiquetas {
  readonly capa = document.createElement('div');
  private readonly vivas = new Map<string, { el: HTMLElement; texto: string }>();
  private readonly v = new THREE.Vector3();

  constructor(contenedor: HTMLElement) {
    this.capa.className = 'mundo3d-etiquetas';
    contenedor.appendChild(this.capa);
  }

  /** Coloca `lista` vista con `camara` en un lienzo de `ancho` × `alto` px. `alturaU(x, y)` da el suelo; `cerca` (x, y) el punto desde el que se
   * mide `lejos`. */
  actualizar(lista: readonly EtiquetaEnVista[], camara: THREE.Camera, ancho: number, alto: number, alturaU: (x: number, y: number) => number, cerca: { x: number; y: number }, lejos: number): void {
    const usadas = new Set<string>();
    for (const e of lista) {
      if (Math.hypot(e.posicion.x - cerca.x, e.posicion.y - cerca.y) > lejos) continue;
      const v = this.v.set(e.posicion.x, alturaU(e.posicion.x, e.posicion.y) + (e.tipo === 'plaza' ? 1.2 : e.tipo === 'nodo' ? 0.5 : 0.1), e.posicion.y).project(camara);
      if (v.z > 1 || v.z < -1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
      usadas.add(e.id);
      let viva = this.vivas.get(e.id);
      if (!viva) {
        const el = document.createElement('span');
        el.className = `mundo3d-etiqueta mundo3d-etiqueta-${e.tipo}${e.tenue ? ' es-tenue' : ''}`;
        this.capa.appendChild(el);
        viva = { el, texto: '' };
        this.vivas.set(e.id, viva);
      }
      if (viva.texto !== e.texto) { viva.el.textContent = e.texto; viva.texto = e.texto; }
      viva.el.style.color = e.color ?? '';
      viva.el.classList.toggle('es-tenue', !!e.tenue);
      viva.el.style.left = `${(((v.x + 1) / 2) * ancho).toFixed(1)}px`;
      viva.el.style.top = `${(((1 - v.y) / 2) * alto).toFixed(1)}px`;
    }
    for (const [id, viva] of this.vivas) if (!usadas.has(id)) { viva.el.remove(); this.vivas.delete(id); }
  }

  destruir(): void {
    this.capa.remove();
    this.vivas.clear();
  }
}
