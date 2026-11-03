// Lo que da vida al mundo 3D sin ser del juego (Víctor, 2026-11-03: «mejorar la vista de mundo en general»): el humo que sube de las plazas,
// los pueblos, las avanzadas y los campamentos, y bandadas de pájaros que dan vueltas cerca del héroe. Todo se mueve en el sombreado (una
// malla instanciada para el humo y otra para los pájaros): en cada fotograma solo cambia el reloj. Va bajo la niebla de guerra.
import * as THREE from 'three';
import type { MundoEnVista } from './estado';
import { MUNDO3D } from './config';
import type { NieblaDeGuerra } from './niebla';
import { azar } from './ruido';

type Punto = { x: number; y: number };

/** El humo: bocanadas por columna, lo que tarda cada una en subir y deshacerse (s), lo alto que llega (u), el tamaño al salir (u) y hacia dónde
 * lo lleva el viento (el de las nubes). */
export const HUMO = { bocanadas: 8, vida: 10, alto: 3, tamano: 0.24, viento: [0.9, 0.35] as const };
/** Los pájaros: la rejilla de celdas donde puede haber una bandada (u), cuántas celdas alrededor del héroe y la parte de ellas que la tiene. */
export const AVES = { celda: 24, anillo: 2, parte: 0.35, envergadura: 0.22 };

/** De dónde sale humo: las plazas que se ven (más columnas cuanto más nivel), los pueblos, las avanzadas en pie desde el fuerte y los
 * campamentos (de mercenarios y de bandidos, su fuego). Cada columna en un sitio fijo del asentamiento. */
export function chimeneas(m: MundoEnVista): Punto[] {
  const out: Punto[] = [];
  const alrededor = (c: Punto, n: number, r0: number, r1: number) => {
    for (let k = 0; k < n; k++) {
      const a = azar(Math.round(c.x * 8), Math.round(c.y * 8), 31 + k) * Math.PI * 2, r = r0 + (r1 - r0) * azar(Math.round(c.x * 8), Math.round(c.y * 8), 61 + k);
      out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
  };
  for (const p of m.plazas) if (!p.recordada) alrededor(p.posicion, Math.min(4, 1 + p.nivel), p.radioCiudad * MUNDO3D.maqueta * 0.2, p.radioCiudad * MUNDO3D.maqueta * 0.6);
  for (const p of m.pueblos) alrededor(p.posicion, 1, 0.3, 0.8);
  for (const a of m.avanzadas) if (!a.ruinas && a.etapa >= 2) alrededor(a.posicion, 1, 0.2, 0.5);
  for (const c of m.campamentos) out.push(c.posicion);
  for (const b of m.bandidos) out.push(b.posicion);
  return out;
}

/** Una bandada: centro (x, y), radio de sus vueltas (u), velocidad (rad/s, con signo: el sentido) y cuántos pájaros. */
export interface Bandada { x: number; y: number; radio: number; giro: number; pajaros: number; semilla: number }

/** Las bandadas alrededor de (cx, cy): una por celda de la rejilla, en las celdas que la tienen. Siempre las mismas en cada celda. */
export function bandadas(cx: number, cy: number): Bandada[] {
  const { celda, anillo, parte } = AVES, ci = Math.floor(cx / celda), cj = Math.floor(cy / celda), out: Bandada[] = [];
  for (let j = cj - anillo; j <= cj + anillo; j++) {
    for (let i = ci - anillo; i <= ci + anillo; i++) {
      if (azar(i, j, 501) >= parte) continue;
      const radio = 4 + 7 * azar(i, j, 503), v = 2 + 1.5 * azar(i, j, 509);
      out.push({ x: (i + azar(i, j, 505)) * celda, y: (j + azar(i, j, 507)) * celda, radio, giro: (azar(i, j, 511) < 0.5 ? -1 : 1) * v / radio, pajaros: 3 + Math.floor(5 * azar(i, j, 513)), semilla: i * 7919 + j });
    }
  }
  return out;
}

/** Un pájaro en V: el cuerpo en el origen mirando a +z y las alas hacia ±x, con las dos caras. */
function pajaro(): THREE.BufferGeometry {
  const e = AVES.envergadura / 2, pos = [
    0, 0, 0.05, -e, 0.01, -0.03, 0, 0, -0.02,
    0, 0, 0.05, 0, 0, -0.02, e, 0.01, -0.03,
  ];
  const doble = [...pos];
  for (let k = 0; k < pos.length; k += 9) doble.push(...pos.slice(k, k + 3), ...pos.slice(k + 6, k + 9), ...pos.slice(k + 3, k + 6));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(doble, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(doble.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  return g;
}

export class Vida {
  readonly grupo = new THREE.Group();
  private readonly tiempo = { value: 0 };
  private readonly matHumo: THREE.MeshLambertMaterial;
  private readonly matAves: THREE.MeshBasicMaterial;
  private readonly geoHumo = new THREE.IcosahedronGeometry(0.5, 1);
  private readonly geoAve = pajaro();
  private humo: THREE.InstancedMesh | null = null;
  private aves: THREE.InstancedMesh | null = null;
  private claveHumo = '';
  private claveAves = '';
  private ultimoMundo: MundoEnVista | null = null;

  constructor(niebla: NieblaDeGuerra, private readonly alturaU: (x: number, y: number) => number) {
    const tiempo = this.tiempo;
    this.matHumo = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setRGB(0.74, 0.75, 0.76, THREE.SRGBColorSpace),
      emissive: new THREE.Color().setRGB(0.3, 0.3, 0.3, THREE.SRGBColorSpace),
      transparent: true,
      depthWrite: false,
    });
    this.matHumo.onBeforeCompile = (sh) => {
      sh.uniforms.uTiempo = tiempo;
      const [vx, vz] = HUMO.viento;
      sh.vertexShader = `attribute float fase; uniform float uTiempo; varying float vHumo;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float t = fract(uTiempo / ${HUMO.vida.toFixed(1)} + fase);
          vec3 sube = vec3(${vx.toFixed(2)} * t * t * 1.4 + sin(t * 6.0 + fase * 40.0) * 0.06, t * ${HUMO.alto.toFixed(2)}, ${vz.toFixed(2)} * t * t * 1.4);
          transformed = transformed * ${HUMO.tamano.toFixed(3)} * mix(0.5, 2.4, t) + sube;
          vHumo = t;
        }`);
      sh.fragmentShader = 'varying float vHumo;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.a *= 0.8 * smoothstep(0.0, 0.1, vHumo) * (1.0 - vHumo) * (1.0 - vHumo * 0.5);`).replace('#include <opaque_fragment>', `#include <opaque_fragment>
        // el borde de cada bocanada, desvaído: una bola de humo, no una piedra
        gl_FragColor.a *= pow(abs(dot(normalize(normal), normalize(vViewPosition))), 1.5);`);
      niebla.parchear(sh);
    };
    this.matHumo.customProgramCacheKey = () => 'humo';
    this.matAves = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.2, 0.19, 0.18, THREE.SRGBColorSpace) });
    this.matAves.onBeforeCompile = (sh) => {
      sh.uniforms.uTiempo = tiempo;
      sh.vertexShader = `attribute vec3 centro; attribute vec4 vuelo; uniform float uTiempo;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // vuelo: radio, giro (rad/s), fase en la vuelta, fase del aleteo
          float a = vuelo.z + uTiempo * vuelo.y;
          vec3 sitio = centro + vec3(cos(a) * vuelo.x, sin(uTiempo * 0.7 + vuelo.w) * 0.3, sin(a) * vuelo.x);
          vec2 rumbo = normalize(vec2(-sin(a), cos(a)) * sign(vuelo.y));
          // a ratos aletea, a ratos planea
          float aleteo = sin(uTiempo * 11.0 + vuelo.w * 7.0) * smoothstep(-0.2, 0.3, sin(uTiempo * 0.5 + vuelo.w));
          vec3 p = transformed;
          p.y += aleteo * 0.5 * abs(p.x);
          vec3 adelante = vec3(rumbo.x, 0.0, rumbo.y), derecha = vec3(rumbo.y, 0.0, -rumbo.x);
          transformed = sitio + adelante * p.z + derecha * p.x + vec3(0.0, p.y, 0.0);
        }`);
      niebla.parchear(sh);
    };
    this.matAves.customProgramCacheKey = () => 'aves';
  }

  /** Pone las columnas de humo del mundo cercano y las bandadas alrededor del héroe (solo si cambian), y mueve el reloj. */
  actualizar(mundo: MundoEnVista, cx: number, cy: number, segundos: number): void {
    this.tiempo.value = segundos % 3600;
    // el mundo cercano solo cambia cuando cambia algo o el héroe se aleja: entonces se miran las columnas
    if (mundo !== this.ultimoMundo) { this.ultimoMundo = mundo; this.ponerHumo(chimeneas(mundo)); }
    const { celda } = AVES, clave = `${Math.floor(cx / celda)},${Math.floor(cy / celda)}`;
    if (clave !== this.claveAves) { this.claveAves = clave; this.ponerAves(bandadas(cx, cy)); }
  }

  private ponerHumo(columnas: Punto[]): void {
    const clave = columnas.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(';');
    if (clave === this.claveHumo) return;
    this.claveHumo = clave;
    this.soltar(this.humo);
    this.humo = null;
    const n = columnas.length * HUMO.bocanadas;
    if (!n) return;
    const malla = new THREE.InstancedMesh(this.geoHumo, this.matHumo, n), fase = new Float32Array(n), m = new THREE.Matrix4();
    columnas.forEach((c, i) => {
      const h = this.alturaU(c.x, c.y) + 0.25, f0 = azar(Math.round(c.x * 8), Math.round(c.y * 8), 71);
      for (let k = 0; k < HUMO.bocanadas; k++) {
        const j = i * HUMO.bocanadas + k;
        malla.setMatrixAt(j, m.makeTranslation(c.x, h, c.y));
        fase[j] = (k / HUMO.bocanadas + f0) % 1;
      }
    });
    malla.geometry = this.geoHumo.clone();
    malla.geometry.setAttribute('fase', new THREE.InstancedBufferAttribute(fase, 1));
    malla.frustumCulled = false;
    this.humo = malla;
    this.grupo.add(malla);
  }

  private ponerAves(lista: Bandada[]): void {
    this.soltar(this.aves);
    this.aves = null;
    let n = 0;
    for (const b of lista) n += b.pajaros;
    if (!n) return;
    const centro = new Float32Array(n * 3), vuelo = new Float32Array(n * 4);
    let k = 0;
    for (const b of lista) {
      const suelo = this.alturaU(b.x, b.y);
      for (let p = 0; p < b.pajaros; p++, k++) {
        const r = (q: number) => azar(b.semilla, p, q);
        centro.set([b.x, suelo + 3.5 + 1.5 * r(1) + 0.4 * p / b.pajaros, b.y], 3 * k);
        // en fila por la vuelta, unos detrás de otros, y un poco más dentro o más fuera
        vuelo.set([b.radio * (0.9 + 0.2 * r(2)), b.giro * (0.97 + 0.06 * r(3)), -Math.sign(b.giro) * p * 0.12 + r(4) * 0.08, r(5) * 6.28], 4 * k);
      }
    }
    const geo = this.geoAve.clone();
    geo.setAttribute('centro', new THREE.InstancedBufferAttribute(centro, 3));
    geo.setAttribute('vuelo', new THREE.InstancedBufferAttribute(vuelo, 4));
    const malla = new THREE.InstancedMesh(geo, this.matAves, n);
    malla.frustumCulled = false;
    this.aves = malla;
    this.grupo.add(malla);
  }

  private soltar(m: THREE.InstancedMesh | null): void {
    if (!m) return;
    this.grupo.remove(m);
    m.geometry.dispose();
    m.dispose();
  }

  destruir(): void {
    this.soltar(this.humo);
    this.soltar(this.aves);
    this.geoHumo.dispose();
    this.geoAve.dispose();
    this.matHumo.dispose();
    this.matAves.dispose();
  }
}
