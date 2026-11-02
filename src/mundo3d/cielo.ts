// El cielo del mundo 3D: una bóveda que va con la cámara, con el degradado del horizonte (bruma clara y cálida) al cénit (azul), el halo del
// sol donde está la luz de la escena y unas nubes altas y finas que derivan despacio. La bruma lejana del suelo es del color del horizonte,
// así el terreno se funde con el cielo en vez de cortarse contra un fondo liso.
import * as THREE from 'three';
import { MUNDO3D } from './config';

const C = MUNDO3D.cielo;
const srgb = (hex: number): THREE.Color => new THREE.Color().setHex(hex, THREE.SRGBColorSpace);

/** El color del horizonte, el de la bruma lejana. */
export const colorHorizonte = (): THREE.Color => srgb(C.horizonte);

export class Cielo {
  readonly malla: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(sol: THREE.Vector3) {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uCenit: { value: srgb(C.cenit) },
        uHorizonte: { value: srgb(C.horizonte) },
        uSuelo: { value: srgb(C.bajoHorizonte) },
        uSol: { value: sol.clone().normalize() },
        uTiempo: { value: 0 },
      },
      vertexShader: `varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform vec3 uCenit; uniform vec3 uHorizonte; uniform vec3 uSuelo; uniform vec3 uSol; uniform float uTiempo; varying vec3 vDir;
        float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float ruido(vec2 p) {
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), u.x), mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a * ruido(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          // del horizonte al cénit (deprisa: con la cámara baja solo asoma una franja de cielo), por debajo un poco más oscuro
          vec3 col = h > 0.0 ? mix(uHorizonte, uCenit, 1.0 - exp(-h * 6.0)) : mix(uHorizonte, uSuelo, clamp(-h * 4.0, 0.0, 1.0));
          // nubes altas: el plano del cielo visto desde abajo, más finas cerca del horizonte
          if (h > 0.02) {
            vec2 q = d.xz / (h + 0.12) * 1.6 + vec2(uTiempo * 0.004, uTiempo * 0.0015);
            float n = smoothstep(0.52, 0.85, fbm(q));
            col = mix(col, vec3(0.97, 0.97, 0.95), n * 0.55 * smoothstep(0.02, 0.25, h));
          }
          // el sol y su halo
          float s = max(dot(d, normalize(uSol)), 0.0);
          col += vec3(1.0, 0.86, 0.62) * (pow(s, 600.0) * 1.2 + pow(s, 24.0) * 0.22);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    // los colores van en lineal y `colorspace_fragment` los pasa a sRGB, como el resto de la escena
    this.malla = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material);
    this.malla.frustumCulled = false;
    this.malla.renderOrder = -1000;
  }

  /** Centra la bóveda en la cámara, justo dentro de su plano lejano. */
  actualizar(camara: THREE.PerspectiveCamera, ahora: number): void {
    this.malla.position.copy(camara.position);
    this.malla.scale.setScalar(camara.far * 0.9);
    this.material.uniforms.uTiempo!.value = ahora / 1000;
  }

  destruir(): void {
    this.malla.geometry.dispose();
    this.material.dispose();
  }
}
