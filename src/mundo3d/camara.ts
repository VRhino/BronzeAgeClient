// La cámara de juego: gira libre alrededor del héroe, a la distancia a la que un círculo de «en pantalla» u de diámetro cabe justo en la
// pantalla (con cualquier inclinación; desde arriba es el lado corto, como el modo mundo en 2D), y le sigue siempre.
import * as THREE from 'three';
import { ACERCADO, encuadres, MUNDO3D } from './config';

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

/** Los zooms, del más cerca al más lejos: de cerca (0,6 veces el normal, `ACERCADO`), normal y alejado. */
export type Zoom = 'cerca' | 'normal' | 'alejado';
export const ZOOMS: readonly Zoom[] = ['cerca', 'normal', 'alejado'];

export class CamaraDeJuego {
  readonly camara = new THREE.PerspectiveCamera(MUNDO3D.apertura, 1, 0.1, 2000);
  /** Grados sobre el horizonte. */
  inclinacion: number = MUNDO3D.inclinacion.inicial;
  /** Radianes alrededor del héroe. */
  giro = 0;
  zoom: Zoom = 'normal';
  /** Radio de visión de la columna (`VISION` del servidor): decide cuánto cabe en pantalla. */
  radioVision = 15;
  /** Distancia de la cámara al héroe, la del último `colocar` (se acerca a la del encuadre poco a poco al cambiar de zoom). */
  distancia = 0;
  /** Cuánto se levanta la cámara sobre su sitio para no meterse en una ladera; se suaviza para que no dé saltos al pasar sobre el relieve. */
  private alzado = 0;

  /** Lo que cabe en pantalla ahora, en u. */
  get enPantalla(): number {
    const [normal, alejado] = encuadres(this.radioVision);
    return this.zoom === 'alejado' ? alejado : this.zoom === 'cerca' ? normal * ACERCADO : normal;
  }

  /** Un paso de zoom: −1 acerca, 1 aleja (sin pasar del de cerca ni del alejado). Devuelve si cambió. */
  pasoDeZoom(sentido: -1 | 1): boolean {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(this.zoom) + sentido));
    if (ZOOMS[i] === this.zoom) return false;
    this.zoom = ZOOMS[i]!;
    return true;
  }

  inclinar(grados: number): void {
    this.inclinacion = Math.min(MUNDO3D.inclinacion.max, Math.max(MUNDO3D.inclinacion.min, this.inclinacion + grados));
  }

  /** Coloca la cámara mirando a `objetivo` (coordenadas de la escena). `suelo(x, z)` da la altura del terreno en la escena: en la montaña la
   * cámara se levanta para no quedar dentro de una ladera. */
  colocar(objetivo: THREE.Vector3, aspecto: number, suelo: (x: number, z: number) => number, dt = 0): void {
    const th = (Math.min(89.5, this.inclinacion) * Math.PI) / 180, tg = Math.tan((MUNDO3D.apertura * Math.PI) / 360);
    const encuadre = distanciaDeEncuadre(this.enPantalla / 2, th, tg, aspecto);
    const S = MUNDO3D.camaraSuave;
    const d = this.distancia > 0 && dt > 0 ? this.distancia + (encuadre - this.distancia) * (1 - Math.exp(-dt * S.zoom)) : encuadre;
    this.distancia = d;
    const c = this.camara;
    c.aspect = aspecto;
    c.near = Math.max(0.05, d * 0.05);
    c.far = Math.max(600, d * 20);
    c.updateProjectionMatrix();
    c.position.set(objetivo.x + d * Math.cos(th) * Math.sin(this.giro), objetivo.y + d * Math.sin(th), objetivo.z + d * Math.cos(th) * Math.cos(this.giro));
    // Sube deprisa y baja despacio; nunca por debajo del suelo.
    const suelto = c.position.y, minimo = suelo(c.position.x, c.position.z) + 0.5, falta = Math.max(0, minimo - suelto);
    this.alzado = dt > 0 ? this.alzado + (falta - this.alzado) * (1 - Math.exp(-dt * (falta > this.alzado ? S.subir : S.bajar))) : falta;
    c.position.y = Math.max(suelto + this.alzado, suelo(c.position.x, c.position.z) + 0.15);
    c.lookAt(objetivo);
    c.updateMatrixWorld();
  }

  /** Píxeles de pantalla por unidad del mapa a la distancia del héroe (para el radio de agarre de los clics). */
  pxPorUnidad(altoPx: number): number {
    return altoPx / (2 * (this.distancia || 30) * Math.tan((MUNDO3D.apertura * Math.PI) / 360));
  }
}
