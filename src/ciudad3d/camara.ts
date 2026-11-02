// La cámara de la plaza: orbita alrededor de un punto del suelo que se desplaza (arrastrar), gira e inclina, y se acerca hasta casi pie de calle
// o se aleja hasta ver la plaza entera. Lo que se pide se alcanza suave (`CIUDAD3D.suave`).
import * as THREE from 'three';
import { CIUDAD3D } from './config';

type Punto = { x: number; y: number };

export class CamaraDeCiudad {
  readonly camara = new THREE.PerspectiveCamera(CIUDAD3D.apertura, 1, 0.1, 3000);
  /** Lo pedido: el punto al que mira (ul), la distancia, el giro (rad) y la inclinación (grados). */
  readonly pedido = { x: 0, y: 0, distancia: 60, giro: 0.6, inclinacion: CIUDAD3D.inclinacion.inicial as number };
  /** Lo de ahora, que persigue a lo pedido. */
  private readonly ahora = { x: 0, y: 0, distancia: 60, giro: 0.6, inclinacion: CIUDAD3D.inclinacion.inicial as number };
  /** Hasta dónde se puede alejar y llevar el punto (ul). */
  private limite = { distancia: 300, radio: 150 };

  /** Se ajusta a una plaza de `radio` ul que lo abarca todo hasta `extension`. `centrar`: vuelve a mirar al centro. */
  ajustar(radio: number, extension: number, centrar: boolean, nucleo = radio): void {
    this.limite = { distancia: Math.max(40, radio * CIUDAD3D.distancia.maxPorRadio), radio: extension + 10 };
    if (centrar) {
      this.pedido.x = this.pedido.y = 0;
      this.pedido.distancia = Math.max(25, nucleo * CIUDAD3D.distancia.inicialPorNucleo);
      Object.assign(this.ahora, this.pedido);
    }
    this.limitar();
  }

  /** Desplaza lo que mira `dx`, `dy` píxeles de pantalla (arrastre): lo de debajo del ratón sigue al ratón, más o menos. */
  desplazar(dx: number, dy: number, altoPx: number): void {
    const k = (2 * this.ahora.distancia * Math.tan((CIUDAD3D.apertura * Math.PI) / 360)) / Math.max(1, altoPx);
    const g = this.ahora.giro, s = 1 / Math.max(0.35, Math.sin((this.ahora.inclinacion * Math.PI) / 180));
    // la derecha de la pantalla y su arriba, sobre el suelo
    this.pedido.x += (-dx * Math.cos(g) - dy * s * Math.sin(g)) * k;
    this.pedido.y += (dx * Math.sin(g) - dy * s * Math.cos(g)) * k;
    this.limitar();
  }

  /** Mueve lo que mira en el suelo, en ul, en ejes de pantalla (`adelante` hacia donde mira la cámara). */
  andar(derecha: number, adelante: number): void {
    const g = this.ahora.giro;
    this.pedido.x += derecha * Math.cos(g) - adelante * Math.sin(g);
    this.pedido.y += -derecha * Math.sin(g) - adelante * Math.cos(g);
    this.limitar();
  }

  girar(rad: number): void { this.pedido.giro += rad; }

  inclinar(grados: number): void {
    const I = CIUDAD3D.inclinacion;
    this.pedido.inclinacion = Math.min(I.max, Math.max(I.min, this.pedido.inclinacion + grados));
  }

  /** Acerca (`factor` < 1) o aleja (> 1). */
  acercar(factor: number): void {
    this.pedido.distancia = Math.min(this.limite.distancia, Math.max(CIUDAD3D.distancia.min, this.pedido.distancia * factor));
  }

  /** Mira a un punto (ul). */
  centrar(p: Punto): void {
    this.pedido.x = p.x;
    this.pedido.y = p.y;
    this.limitar();
  }

  get distancia(): number { return this.ahora.distancia; }
  get foco(): Punto { return { x: this.ahora.x, y: this.ahora.y }; }
  get giro(): number { return this.ahora.giro; }

  private limitar(): void {
    const r = Math.hypot(this.pedido.x, this.pedido.y), R = this.limite.radio;
    if (r > R) { this.pedido.x *= R / r; this.pedido.y *= R / r; }
    this.pedido.distancia = Math.min(this.limite.distancia, Math.max(CIUDAD3D.distancia.min, this.pedido.distancia));
  }

  /** Avanza `dt` s hacia lo pedido y coloca la cámara. */
  colocar(aspecto: number, dt: number): void {
    const a = this.ahora, p = this.pedido, k = dt > 0 ? 1 - Math.exp(-dt * CIUDAD3D.suave) : 1;
    a.x += (p.x - a.x) * k;
    a.y += (p.y - a.y) * k;
    a.distancia *= Math.exp(Math.log(p.distancia / a.distancia) * k);
    a.giro += (p.giro - a.giro) * k;
    a.inclinacion += (p.inclinacion - a.inclinacion) * k;
    const th = (a.inclinacion * Math.PI) / 180, d = a.distancia, c = this.camara;
    c.aspect = aspecto;
    c.near = Math.max(0.1, d * 0.02);
    c.far = Math.max(800, d * 12);
    c.updateProjectionMatrix();
    c.position.set(a.x + d * Math.cos(th) * Math.sin(a.giro), d * Math.sin(th), a.y + d * Math.cos(th) * Math.cos(a.giro));
    c.lookAt(a.x, 0, a.y);
    c.updateMatrixWorld();
  }

  /** Los cuatro puntos del suelo que caen en las esquinas de la pantalla (lo que se ve, para el minimapa); las que miran al cielo se cortan a
   * `lejos` ul. */
  huella(lejos: number): Punto[] {
    const r = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v = new THREE.Vector3();
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
      r.setFromCamera(new THREE.Vector2(x, y), this.camara);
      const o = r.ray.origin, d = r.ray.direction;
      if (r.ray.intersectPlane(plano, v) && v.distanceTo(o) < lejos) return { x: v.x, y: v.z };
      const h = new THREE.Vector3(d.x, 0, d.z).normalize().multiplyScalar(lejos);
      return { x: o.x + h.x, y: o.z + h.z };
    });
  }
}
