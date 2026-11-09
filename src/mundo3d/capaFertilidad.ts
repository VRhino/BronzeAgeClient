// La capa de fertilidad en el mundo 3D (Víctor, 2026-11-04: «agregar el filtro de fertilidad a las capas del mapa para que se apague y se
// encienda como el nombre de los nodos»). La misma rampa que en el modo mapa (`pixelesDeFertilidad`), en una textura del raster de fertilidad
// del artefacto que el suelo mezcla con su color antes de la luz, así sigue el relieve. Como en el modo mapa, solo sobre lo explorado (lo dice
// la textura de la niebla, en el mismo sombreado) y nunca en el agua. La textura se hace una vez por mundo, corte de la aldea y cultivo (0.190.0:
// la capa es la del cultivo elegido en la leyenda).
import * as THREE from 'three';
import { pixelesDeFertilidad } from '../mundo/capasDelMapa';
import { capaDe, type Cultivo } from '../mundo/fertilidad';
import type { MapaGenerado } from '../terreno';

export class CapaDeFertilidad {
  private readonly uniformes = {
    uFertilidad: { value: null as THREE.DataTexture | null },
    uTamFertilidad: { value: new THREE.Vector2(1, 1) },
    uFertilidadActiva: { value: 0 },
  };
  private minima = Number.NaN;
  private raster: object | null = null;

  constructor(private readonly mapa: MapaGenerado) {}

  /** Pone o quita la capa; `minima` es la fertilidad desde la que cabe una aldea (donde salta el color); `cultivo`, el de la capa (sin la suya en
   * el artefacto, la del trigo). */
  fijar(si: boolean, minima: number, cultivo: Cultivo = 'trigo'): void {
    const f = capaDe(this.mapa, cultivo) ?? this.mapa.rasters?.fertilidad;
    this.uniformes.uFertilidadActiva.value = si && f ? 1 : 0;
    if (!si || !f || (minima === this.minima && f === this.raster)) return;
    this.minima = minima;
    this.raster = f;
    const datos = Uint8Array.from(pixelesDeFertilidad(f, this.mapa.rasters?.terreno, () => true, minima));
    this.uniformes.uFertilidad.value?.dispose();
    const t = new THREE.DataTexture(datos, f.columnas, f.filas, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.uniformes.uFertilidad.value = t;
    this.uniformes.uTamFertilidad.value.set(f.columnas * f.celda, f.filas * f.celda);
  }

  get activa(): boolean {
    return this.uniformes.uFertilidadActiva.value === 1;
  }

  /** Mete la capa en el sombreado del suelo, sobre `diffuseColor`. Se llama desde su `onBeforeCompile`, antes de la niebla: usa su textura
   * (`uNiebla`, rojo = explorado) para no pintar lo que no se ha explorado. */
  parchear(sh: THREE.WebGLProgramParametersWithUniforms): void {
    Object.assign(sh.uniforms, this.uniformes);
    sh.vertexShader = 'varying vec2 vFertilidadXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vFertilidadXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
    sh.fragmentShader = 'uniform sampler2D uFertilidad; uniform vec2 uTamFertilidad; uniform float uFertilidadActiva; varying vec2 vFertilidadXZ;\n'
      + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (uFertilidadActiva > 0.5) {
        vec4 fert = texture2D(uFertilidad, vFertilidadXZ / uTamFertilidad);
        float explorado = uActiva > 0.5 ? texture2D(uNiebla, vFertilidadXZ / uTamNiebla).r : 1.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, fert.rgb, fert.a * explorado);
      }`);
  }

  destruir(): void {
    this.uniformes.uFertilidad.value?.dispose();
  }
}
