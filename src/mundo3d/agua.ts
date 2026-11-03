// El agua del mundo 3D (Víctor, 2026-11-03: «que no solo sea el piso pintado de azul»). El mar y los lagos son una lámina a su nivel sobre un
// fondo que baja desde la orilla; los ríos, una cinta de la misma agua que corre. La lámina es transparente: turquesa donde cubre poco, azul
// hondo mar adentro, con olas que se mueven, el brillo del sol, el cielo reflejado cuando se mira de lado y espuma en la orilla. La orilla es
// donde el suelo corta la lámina, no el borde de las muestras de agua: sale suave, sin dientes.
import * as THREE from 'three';
import { MUNDO3D } from './config';
import type { NieblaDeGuerra } from './niebla';

const { metrosPorUnidad: MPU, umbrales: U } = MUNDO3D;

export const AGUA = {
  /** Hasta cuántas u de la orilla sigue bajando el fondo. */
  orilla: 6,
  /** Lo que cubre el agua (u) lejos de la orilla, como mucho (el fondo del mar del relieve, más hondo, se respeta). */
  maxima: 2.6,
  /** La pendiente de la orilla: lo que sube o baja el suelo (u) de la tierra entera (`b` = 0) al agua entera (`b` = 1). */
  playa: 0.8,
  /** Lo que queda, como poco, la tierra sobre la lámina (u): ninguna orilla se hunde bajo el agua. */
  seco: 0.03,
  /** Colores (sRGB): agua somera y honda, espuma y el cielo que refleja; fondo arenoso junto a la orilla y oscuro donde cubre mucho. */
  somero: 0x5aaea6,
  hondo: 0x1d4d72,
  espuma: 0xe8f0ea,
  cielo: 0xb9cfdd,
  fondoSomero: [0.74, 0.69, 0.5] as const,
  fondoHondo: [0.3, 0.33, 0.29] as const,
};

/** El nivel del agua (m) en una muestra de agua con el suelo a `h` m. El relieve da el mar más bajo que la costa (375 m) y cada lago plano a su
 * nivel: la lámina va un metro por debajo de eso, para que la orilla quede siempre por encima. */
export const nivelDelAgua = (h: number): number => Math.max(U.agua, h) - 1;

const suave = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Lo que cubre el agua (u) a `d` u de la orilla: nada junto a ella y más mar adentro. */
export const profundidadA = (d: number): number => AGUA.maxima * suave(0, AGUA.orilla, d);

/** La máscara de agua emborronada (dos pasadas de caja de 3 × 3): 0 en tierra lejos del agua, 1 en agua lejos de la tierra, y en medio, la
 * orilla. Donde vale 0,5 queda la línea de costa: como cruza la rejilla en cualquier punto y no solo en sus vértices, sale suave. */
export function mascaraSuave(agua: Uint8Array, ancho: number, alto: number): Float32Array {
  let a = Float32Array.from(agua);
  for (let pasada = 0; pasada < 2; pasada++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < alto; j++) {
      for (let i = 0; i < ancho; i++) {
        let s = 0, c = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const x = i + di, y = j + dj;
          if (x < 0 || y < 0 || x >= ancho || y >= alto) continue;
          s += a[y * ancho + x]!; c++;
        }
        b[j * ancho + i] = s / c;
      }
    }
    a = b;
  }
  return a;
}

/** La altura del suelo (m) junto al agua, para que la orilla siga la máscara suave `b` y no los dientes de las muestras: el agua baja hasta lo
 * que pide la distancia a tierra `d` (u) o la orilla, lo más hondo; la tierra baja hacia la lámina si está cerca del agua, sin hundirse. */
export function sueloJuntoAlAgua(h: number, nivelM: number, esAgua: boolean, b: number, d: number): number {
  const orilla = nivelM + (0.5 - b) * AGUA.playa * MPU;
  if (esAgua) return Math.min(h, orilla, nivelM - profundidadA(d) * MPU);
  return b > 0 ? Math.min(h, Math.max(nivelM + AGUA.seco * MPU, orilla)) : h;
}

/** El color del fondo (lineal, 0..1) donde el agua cubre `prof` u: arena junto a la orilla, oscuro donde cubre mucho. */
export function colorDelFondo(prof: number): [number, number, number] {
  const t = suave(0, 2, prof), a = AGUA.fondoSomero, b = AGUA.fondoHondo;
  const lin = (c: number) => new THREE.Color().setRGB(c, c, c, THREE.SRGBColorSpace).r;
  return [lin(a[0] + (b[0] - a[0]) * t), lin(a[1] + (b[1] - a[1]) * t), lin(a[2] + (b[2] - a[2]) * t)];
}

/** La distancia (en muestras) de cada muestra de agua a la tierra más cercana en una rejilla `ancho × alto` (`agua[k]` 1 = agua): la de chaflán,
 * con pasos de 1 y √2. La tierra vale 0; sin tierra en la rejilla, Infinity. */
export function distanciaATierra(agua: Uint8Array, ancho: number, alto: number): Float32Array {
  const d = new Float32Array(ancho * alto), D = Math.SQRT2;
  for (let k = 0; k < d.length; k++) d[k] = agua[k] ? Infinity : 0;
  for (let j = 0; j < alto; j++) {
    for (let i = 0; i < ancho; i++) {
      const k = j * ancho + i;
      if (!d[k]) continue;
      let v = d[k]!;
      if (i > 0) v = Math.min(v, d[k - 1]! + 1);
      if (j > 0) {
        v = Math.min(v, d[k - ancho]! + 1);
        if (i > 0) v = Math.min(v, d[k - ancho - 1]! + D);
        if (i < ancho - 1) v = Math.min(v, d[k - ancho + 1]! + D);
      }
      d[k] = v;
    }
  }
  for (let j = alto - 1; j >= 0; j--) {
    for (let i = ancho - 1; i >= 0; i--) {
      const k = j * ancho + i;
      if (!d[k]) continue;
      let v = d[k]!;
      if (i < ancho - 1) v = Math.min(v, d[k + 1]! + 1);
      if (j < alto - 1) {
        v = Math.min(v, d[k + ancho]! + 1);
        if (i < ancho - 1) v = Math.min(v, d[k + ancho + 1]! + D);
        if (i > 0) v = Math.min(v, d[k + ancho - 1]! + D);
      }
      d[k] = v;
    }
  }
  return d;
}

/**
 * La lámina de agua de una rejilla de `n × n` vértices cada `paso` u desde (x0, y0). `nivel[k]` es la altura de la lámina en el vértice k (u;
 * NaN si es tierra) y `fondo[k]`, la del suelo. Lleva agua cada celda con alguna esquina de agua; las esquinas de tierra toman el nivel de un
 * vecino de agua y quedan bajo el suelo, que corta la lámina por la orilla. Cada vértice lleva lo que cubre (`profundidad`, u; 0 en tierra).
 * Si todo es agua honda, basta un cuadrado. `null` sin agua.
 */
export function laminaDeAgua(n: number, paso: number, x0: number, y0: number, nivel: Float32Array, fondo: Float32Array): THREE.BufferGeometry | null {
  const agua = (k: number) => !Number.isNaN(nivel[k]!);
  // el nivel de cada vértice: el suyo, o el de un vecino de agua
  const nv = new Float32Array(n * n).fill(Number.NaN);
  let todas = true, honda = true, alguna = false;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (agua(k)) { nv[k] = nivel[k]!; alguna = true; if (nivel[k]! - fondo[k]! < AGUA.maxima * 0.95) honda = false; continue; }
      todas = false;
      for (let dj = -1; dj <= 1 && Number.isNaN(nv[k]!); dj++) {
        for (let di = -1; di <= 1; di++) {
          const a = i + di, b = j + dj;
          if (a >= 0 && b >= 0 && a < n && b < n && agua(b * n + a)) { nv[k] = nivel[b * n + a]!; break; }
        }
      }
    }
  }
  if (!alguna) return null;
  const geo = new THREE.BufferGeometry();
  if (todas && honda) {
    const y = nv[0]!, x1 = x0 + (n - 1) * paso, y1 = y0 + (n - 1) * paso, p = AGUA.maxima;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, y, y0, x1, y, y0, x0, y, y1, x1, y, y1]), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    geo.setAttribute('profundidad', new THREE.BufferAttribute(new Float32Array([p, p, p, p]), 1));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.computeBoundingSphere();
    return geo;
  }
  const indice = new Int32Array(n * n).fill(-1), pos: number[] = [], prof: number[] = [], indices: number[] = [];
  const vertice = (k: number): number => {
    if (indice[k]! >= 0) return indice[k]!;
    const i = k % n, j = (k - i) / n;
    indice[k] = pos.length / 3;
    pos.push(x0 + i * paso, nv[k]!, y0 + j * paso);
    prof.push(Math.max(0, nv[k]! - fondo[k]!));
    return indice[k]!;
  };
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if (!agua(a) && !agua(b) && !agua(c) && !agua(d)) continue;
      if ([a, b, c, d].some((k) => Number.isNaN(nv[k]!))) continue;
      const va = vertice(a), vb = vertice(b), vc = vertice(c), vd = vertice(d);
      indices.push(va, vc, vb, vb, vc, vd);
    }
  }
  if (!indices.length) return null;
  const normales = new Float32Array(pos.length);
  for (let k = 1; k < normales.length; k += 3) normales[k] = 1;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
  geo.setAttribute('profundidad', new THREE.BufferAttribute(new Float32Array(prof), 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/** Las olas: el gradiente de la superficie (d altura / dx, dz) con unas pocas ondas que se cruzan, de largas a cortas. */
const OLAS = `
vec2 olas(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.5, 0.866), d3 = vec2(0.2, -0.98), d4 = vec2(0.95, -0.31);
  vec2 d5 = vec2(-0.87, -0.5), d6 = vec2(0.42, 0.91);
  g += d1 * cos(dot(p, d1) * 1.7 + t * 1.2) * 0.045;
  g += d2 * cos(dot(p, d2) * 2.9 + t * 1.8) * 0.04;
  g += d3 * cos(dot(p, d3) * 4.6 + t * 2.4) * 0.03;
  g += d4 * cos(dot(p, d4) * 7.3 + t * 3.3) * 0.02;
  g += d5 * cos(dot(p, d5) * 11.1 + t * 4.1) * 0.014;
  g += d6 * cos(dot(p, d6) * 16.7 + t * 5.2) * 0.009;
  // a ratos más picada y a ratos más en calma, para que no se vean bandas iguales
  return g * (0.55 + 0.45 * sin(dot(p, vec2(0.11, 0.17)) + t * 0.15));
}`;

/** El agua: el material del mar y los lagos, el de los ríos (`#define RIO`: el perfil y la corriente salen de la cinta, `uvRio`) y el reloj de
 * las olas. Los dos van bajo la niebla de guerra, como la geografía. */
export class Agua {
  private readonly uniformes = {
    uTiempo: { value: 0 },
    uSomero: { value: new THREE.Color().setHex(AGUA.somero, THREE.SRGBColorSpace) },
    uHondo: { value: new THREE.Color().setHex(AGUA.hondo, THREE.SRGBColorSpace) },
    uEspuma: { value: new THREE.Color().setHex(AGUA.espuma, THREE.SRGBColorSpace) },
    uCielo: { value: new THREE.Color().setHex(AGUA.cielo, THREE.SRGBColorSpace) },
  };
  readonly mar: THREE.MeshPhongMaterial;
  readonly rio: THREE.MeshPhongMaterial;

  constructor(niebla: NieblaDeGuerra) {
    this.mar = this.material(niebla, false);
    this.rio = this.material(niebla, true);
  }

  /** Mueve las olas: `segundos` desde que empezó la vista. */
  actualizar(segundos: number): void {
    this.uniformes.uTiempo.value = segundos % 3600;
  }

  private material(niebla: NieblaDeGuerra, rio: boolean): THREE.MeshPhongMaterial {
    const m = new THREE.MeshPhongMaterial({
      color: 0xffffff, specular: 0xd8e4e8, shininess: 70, transparent: true, depthWrite: false,
      ...(rio ? { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } : {}),
    });
    if (rio) m.defines = { RIO: '' };
    const u = this.uniformes;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = `attribute float profundidad; varying float vProf; varying vec3 vAguaMundo;
        #ifdef RIO
        attribute vec2 uvRio; varying vec2 vRioUv;
        #endif
        ` + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vAguaMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #ifdef RIO
          vRioUv = uvRio; vProf = 0.0;
          #else
          vProf = profundidad;
          #endif`);
      sh.fragmentShader = `uniform float uTiempo; uniform vec3 uSomero; uniform vec3 uHondo; uniform vec3 uEspuma; uniform vec3 uCielo;
        varying float vProf; varying vec3 vAguaMundo;
        #ifdef RIO
        varying vec2 vRioUv;
        #endif
        ${OLAS}
        ` + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          #ifdef RIO
          // de orilla a orilla: somero en los bordes y más hondo en medio
          float prof = 1.5 * (1.0 - pow(abs(vRioUv.x * 2.0 - 1.0), 2.0));
          #else
          float prof = vProf;
          #endif
          diffuseColor.rgb = mix(uSomero, uHondo, smoothstep(0.0, 2.4, prof));
          diffuseColor.a = mix(0.45, 0.9, smoothstep(0.0, 1.4, prof));`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #ifdef RIO
          // la corriente: las olas bajan por el río
          vec2 pOla = vec2(vRioUv.x * 1.4, vRioUv.y * 1.6 - uTiempo * 1.1);
          #else
          vec2 pOla = vAguaMundo.xz;
          #endif
          // de lejos, más lisa: las olas finas a lo lejos solo harían rayas
          vec2 gOla = olas(pOla, uTiempo) * mix(0.45, 1.0, smoothstep(0.0, 1.2, prof)) * mix(1.0, 0.25, smoothstep(15.0, 90.0, length(vViewPosition)));
          normal = normalize(normal + (viewMatrix * vec4(-gOla.x, 0.0, -gOla.y, 0.0)).xyz);`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
          {
            // el cielo, cuando se mira de lado; la espuma, donde cubre poco
            float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uCielo, fres * 0.55);
            gl_FragColor.a = mix(gl_FragColor.a, 1.0, fres * 0.5);
            float espuma = (1.0 - smoothstep(0.02, 0.2, prof)) * (0.6 + 0.4 * sin(dot(vAguaMundo.xz, vec2(2.3, 1.7)) + uTiempo * 1.7));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uEspuma, espuma * 0.55);
            gl_FragColor.a = max(gl_FragColor.a, espuma * 0.7);
          }`);
      niebla.parchear(sh);
    };
    m.customProgramCacheKey = () => (rio ? 'agua-rio' : 'agua-mar');
    return m;
  }

  destruir(): void {
    this.mar.dispose();
    this.rio.dispose();
  }
}

/** La altura (u) que se ve en (x, y): la de la lámina donde hay agua y la del suelo donde no. Para poner lo que va encima y para el clic. */
export function alturaVisible(alturaM: number, agua: boolean): number {
  return (agua ? nivelDelAgua(alturaM) : alturaM) / MPU;
}
