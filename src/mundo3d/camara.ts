// La cámara de juego: gira libre alrededor del héroe, a la distancia a la que un círculo de «en pantalla» u de diámetro cabe justo en la
// pantalla (con cualquier inclinación; desde arriba es el lado corto, como el modo mundo en 2D), y le sigue siempre.
import * as THREE from 'three';
import { encuadres, MUNDO3D } from './config';

/** La distancia a la que un círculo de radio `r` alrededor del objetivo cabe justo en la pantalla, con la inclinación `th` (radianes), la
 * tangente de media apertura vertical `tg` y el aspecto `asp` (ancho / alto). Se mide sobre el plano del objetivo. */
export function distanciaDeEncuadre(r: number, th: number, tg: number, asp: number): number {
  const s = Math.sin(th), c = Math.cos(th);
  const cabe = (d: number): boolean => {
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a), p = d - z * c;
      if (p <= 0 || Math.abs((z * s) / p) > tg || Math.abs(x / p) > tg * asp) return false;
    }
    return true;
  };
  let lo = r * c + 1e-3, hi = r * 60;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (cabe(m)) hi = m;
    else lo = m;
  }
  return hi;
}

export type Zoom = 'normal' | 'alejado';

export class CamaraDeJuego {
  readonly camara = new THREE.PerspectiveCamera(MUNDO3D.apertura, 1, 0.1, 2000);
  /** Grados sobre el horizonte. */
  inclinacion: number = MUNDO3D.inclinacion.inicial;
  /** Radianes alrededor del héroe. */
  giro = 0;
  zoom: Zoom = 'normal';
  /** Radio de visión de la columna (`VISION` del servidor): decide cuánto cabe en pantalla. */
  radioVision = 15;
  /** Distancia de la cámara al héroe, la del último `colocar`. */
  distancia = 30;

  /** Lo que cabe en pantalla ahora, en u. */
  get enPantalla(): number {
    return encuadres(this.radioVision)[this.zoom === 'alejado' ? 1 : 0];
  }

  inclinar(grados: number): void {
    this.inclinacion = Math.min(MUNDO3D.inclinacion.max, Math.max(MUNDO3D.inclinacion.min, this.inclinacion + grados));
  }

  /** Coloca la cámara mirando a `objetivo` (coordenadas de la escena). `suelo(x, z)` da la altura del terreno en la escena: en la montaña la
   * cámara se levanta para no quedar dentro de una ladera. */
  colocar(objetivo: THREE.Vector3, aspecto: number, suelo: (x: number, z: number) => number): void {
    const th = (Math.min(89.5, this.inclinacion) * Math.PI) / 180, tg = Math.tan((MUNDO3D.apertura * Math.PI) / 360);
    const d = distanciaDeEncuadre(this.enPantalla / 2, th, tg, aspecto);
    this.distancia = d;
    const c = this.camara;
    c.aspect = aspecto;
    c.near = Math.max(0.05, d * 0.05);
    c.far = Math.max(600, d * 20);
    c.updateProjectionMatrix();
    c.position.set(objetivo.x + d * Math.cos(th) * Math.sin(this.giro), objetivo.y + d * Math.sin(th), objetivo.z + d * Math.cos(th) * Math.cos(this.giro));
    const minimo = suelo(c.position.x, c.position.z) + 0.5;
    if (c.position.y < minimo) c.position.y = minimo;
    c.lookAt(objetivo);
    c.updateMatrixWorld();
  }

  /** Píxeles de pantalla por unidad del mapa a la distancia del héroe (para el radio de agarre de los clics). */
  pxPorUnidad(altoPx: number): number {
    return altoPx / (2 * this.distancia * Math.tan((MUNDO3D.apertura * Math.PI) / 360));
  }
}
