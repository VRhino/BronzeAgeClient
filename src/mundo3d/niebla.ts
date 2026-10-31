// La niebla de guerra en el sombreado. La rejilla de `proyeccion.exploracion` (celdas de 5 u) va a una textura (rojo: explorado, verde: se ve
// ahora) y cada material de lo que en el 2D se pinta BAJO la niebla la mezcla con su color: sin ver, opaco; recordado, oscurecido; viéndolo,
// tal cual (`NIEBLA` de `paletas.ts`). Lo propio y lo que se ve ahora no lleva este material: va encima, como en `render.ts`.
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

export class NieblaDeGuerra {
  private readonly uniformes = {
    uNiebla: { value: null as THREE.DataTexture | null },
    uTamNiebla: { value: new THREE.Vector2(1, 1) },
    uActiva: { value: 0 },
    // se mezcla después de pasar el color a sRGB (`colorspace_fragment` va antes que `fog_fragment`): va tal cual, en sRGB
    uColorNiebla: { value: new THREE.Vector3(...MUNDO3D.niebla.color.map((c) => c / 255)) },
    uAlfas: { value: new THREE.Vector3(MUNDO3D.niebla.alfaSinVer / 255, MUNDO3D.niebla.alfaRecordado / 255, MUNDO3D.niebla.alfaVisible / 255) },
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

  /** Hace que `material` se oscurezca con la niebla (para lo que en el 2D va bajo ella). Devuelve el mismo material. */
  aplicar<M extends THREE.Material>(material: M): M {
    const u = this.uniformes;
    material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec2 vNieblaXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 nieblaMundo = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          nieblaMundo = instanceMatrix * nieblaMundo;
        #endif
        vNieblaXZ = (modelMatrix * nieblaMundo).xz;`);
      sh.fragmentShader = 'uniform sampler2D uNiebla; uniform vec2 uTamNiebla; uniform float uActiva; uniform vec3 uColorNiebla; uniform vec3 uAlfas; varying vec2 vNieblaXZ;\n'
        + sh.fragmentShader.replace('#include <fog_fragment>', `if (uActiva > 0.5) {
          vec2 nb = texture2D(uNiebla, vNieblaXZ / uTamNiebla).rg;
          float alfa = mix(uAlfas.x, mix(uAlfas.y, uAlfas.z, nb.g), nb.r);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uColorNiebla, alfa);
        }
        #include <fog_fragment>`);
    };
    material.customProgramCacheKey = () => 'niebla-de-guerra';
    return material;
  }

  destruir(): void {
    this.uniformes.uNiebla.value?.dispose();
  }
}
