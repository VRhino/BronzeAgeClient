// La niebla de guerra en el sombreado. La rejilla de `proyeccion.exploracion` (celdas de 5 u) va a una textura (rojo: explorado, verde: se ve
// ahora) y cada material de lo que en el 2D se pinta BAJO la niebla la mezcla con su color: sin ver, casi tapado pero con el mapa a la vista;
// recordado, oscurecido; viéndolo, tal cual (`MUNDO3D.niebla`). Lo propio y lo que se ve ahora no lleva este material: va encima, como en `render.ts`.
// Como toda la geografía pasa por aquí, aquí van también las sombras de las nubes: manchas de unas 15 u algo más oscuras que el viento arrastra.
import * as THREE from 'three';
import type { NieblaProyectada } from '../tiposDominio';
import { MUNDO3D } from './config';

/** Los bits de una máscara en hexadecimal (`NieblaProyectada.celdas`/`visibles`): celda `i` → byte `i >> 3`, bit `i & 7`. */
function bits(hex: string, celdas: number): Uint8Array {
  const out = new Uint8Array(celdas);
  const bytes = Math.min(hex.length >> 1, Math.ceil(celdas / 8));
  for (let b = 0; b < bytes; b++) {
    const v = parseInt(hex.substr(b * 2, 2), 16);
    if (!v) continue;
    for (let k = 0; k < 8; k++) if (v & (1 << k) && b * 8 + k < celdas) out[b * 8 + k] = 255;
  }
  return out;
}

/** Las nubes vistas desde abajo: ruido de valor en tres octavas (0..1). Las coordenadas se pliegan para no perder precisión. */
const NUBES = `
#define SOMBRA_NUBE 0.2
float azarNube(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453); }
float ruidoNube(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(azarNube(i), azarNube(i + vec2(1.0, 0.0)), u.x), mix(azarNube(i + vec2(0.0, 1.0)), azarNube(i + vec2(1.0, 1.0)), u.x), u.y);
}
float nubes(vec2 p) { return ruidoNube(p) * 0.55 + ruidoNube(p * 2.1 + 7.3) * 0.3 + ruidoNube(p * 4.3 + 1.7) * 0.15; }
`;

export class NieblaDeGuerra {
  private readonly uniformes = {
    uNiebla: { value: null as THREE.DataTexture | null },
    uTamNiebla: { value: new THREE.Vector2(1, 1) },
    uActiva: { value: 0 },
    // se mezcla después de pasar el color a sRGB (`colorspace_fragment` va antes que `fog_fragment`): va tal cual, en sRGB
    uColorNiebla: { value: new THREE.Vector3(...MUNDO3D.niebla.color.map((c) => c / 255)) },
    uAlfas: { value: new THREE.Vector3(MUNDO3D.niebla.alfaSinVer / 255, MUNDO3D.niebla.alfaRecordado / 255, MUNDO3D.niebla.alfaVisible / 255) },
    uTiempoNubes: { value: 0 },
  };
  private ultima = '';
  private ultimasCeldas = '';
  private explorado: Uint8Array | null = null;
  private rejilla = { columnas: 0, filas: 0, celda: 5 };
  /** Sube cada vez que cambia lo explorado o se quita o pone la niebla: quien filtra por ella (los árboles) sabe cuándo rehacer. */
  version = 0;

  /** Lado de las celdas de la niebla, en u. */
  get celda(): number {
    return this.rejilla.celda;
  }

  /** ¿Se ha explorado alguna vez (x, y)? Sin niebla, todo. */
  exploradaEn(x: number, y: number): boolean {
    const e = this.explorado, r = this.rejilla;
    if (!e || !this.uniformes.uActiva.value) return true;
    const i = Math.floor(x / r.celda), j = Math.floor(y / r.celda);
    return i >= 0 && j >= 0 && i < r.columnas && j < r.filas && e[j * r.columnas + i]! > 0;
  }

  /** Pone la niebla de la proyección; sin ella (o con `?sinNiebla` en desarrollo) no se oscurece nada. */
  actualizar(n: NieblaProyectada | null | undefined, sinNiebla = false): void {
    const activa = !!n && !sinNiebla && n.columnas > 0 && n.filas > 0;
    if (activa !== (this.uniformes.uActiva.value === 1)) this.version++;
    this.uniformes.uActiva.value = activa ? 1 : 0;
    if (!activa) return;
    const clave = `${n.columnas}x${n.filas}:${n.celdas}|${n.visibles}`;
    if (clave === this.ultima) return;
    if (n.celdas !== this.ultimasCeldas) { this.ultimasCeldas = n.celdas; this.version++; }
    this.ultima = clave;
    const total = n.columnas * n.filas, explorado = bits(n.celdas, total), visible = bits(n.visibles, total), datos = new Uint8Array(total * 4);
    this.explorado = explorado;
    this.rejilla = { columnas: n.columnas, filas: n.filas, celda: n.tamanoCelda };
    for (let i = 0; i < total; i++) { datos[4 * i] = explorado[i]!; datos[4 * i + 1] = visible[i]!; datos[4 * i + 3] = 255; }
    const t = this.uniformes.uNiebla.value;
    if (t && t.image.width === n.columnas && t.image.height === n.filas) {
      (t.image.data as Uint8Array).set(datos);
      t.needsUpdate = true;
    } else {
      t?.dispose();
      const nueva = new THREE.DataTexture(datos, n.columnas, n.filas, THREE.RGBAFormat);
      nueva.magFilter = THREE.LinearFilter;
      nueva.minFilter = THREE.LinearFilter;
      nueva.needsUpdate = true;
      this.uniformes.uNiebla.value = nueva;
    }
    this.uniformes.uTamNiebla.value.set(n.columnas * n.tamanoCelda, n.filas * n.tamanoCelda);
  }

  /** Mueve las sombras de las nubes: `segundos` desde que empezó la vista. */
  mover(segundos: number): void {
    this.uniformes.uTiempoNubes.value = segundos % 3600;
  }

  /** Hace que `material` se oscurezca con la niebla (para lo que en el 2D va bajo ella). Devuelve el mismo material. */
  aplicar<M extends THREE.Material>(material: M): M {
    material.onBeforeCompile = (sh) => this.parchear(sh);
    material.customProgramCacheKey = () => 'niebla-de-guerra';
    return material;
  }

  /** Mete la niebla en el sombreado de un material que ya cambia el suyo (el agua): se llama desde su `onBeforeCompile`, lo último. */
  parchear(sh: THREE.WebGLProgramParametersWithUniforms): void {
    const u = this.uniformes;
    {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec2 vNieblaXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 nieblaMundo = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          nieblaMundo = instanceMatrix * nieblaMundo;
        #endif
        vNieblaXZ = (modelMatrix * nieblaMundo).xz;`);
      sh.fragmentShader = 'uniform sampler2D uNiebla; uniform vec2 uTamNiebla; uniform float uActiva; uniform vec3 uColorNiebla; uniform vec3 uAlfas; uniform float uTiempoNubes; varying vec2 vNieblaXZ;\n'
        + NUBES + sh.fragmentShader.replace('#include <fog_fragment>', `gl_FragColor.rgb *= 1.0 - SOMBRA_NUBE * smoothstep(0.5, 0.75, nubes(vNieblaXZ * 0.065 + vec2(uTiempoNubes * 0.04, uTiempoNubes * 0.015)));
        if (uActiva > 0.5) {
          vec2 nb = texture2D(uNiebla, vNieblaXZ / uTamNiebla).rg;
          float alfa = mix(uAlfas.x, mix(uAlfas.y, uAlfas.z, nb.g), nb.r);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uColorNiebla, alfa);
        }
        #include <fog_fragment>`);
    }
  }

  destruir(): void {
    this.uniformes.uNiebla.value?.dispose();
  }
}
