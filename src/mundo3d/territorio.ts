// El territorio sobre el relieve (Víctor, 2026-11-03: «una capa con un opacity suave sobre el interior de la zona de influencia, para que se
// note bien el territorio»). Las zonas de influencia se pintan en un lienzo que cubre lo que se carga alrededor del héroe, con el color de su
// Facción y poca opacidad, como el relleno del 2D (`render.ts`), y un borde algo más marcado por dentro que se desvanece hacia el centro (así
// se lee también un color oscuro). El suelo lo mezcla con su color antes de la luz: el tinte sigue las laderas y la sombra del relieve se sigue
// leyendo. Solo el suelo: árboles, matas y agua quedan con su color.
import * as THREE from 'three';

type Punto = { x: number; y: number };

/** El relleno de una Facción: sus contornos (cerrados o no) y con qué opacidad y regla se rellena. */
export interface RellenoDeTerritorio {
  color: string;
  /** 0..1, la del interior; el borde, algo más. */
  alfa: number;
  contornos: readonly (readonly Punto[])[];
  /** `nonzero` junta las zonas que se solapan; `evenodd` respeta los huecos de la zona fusionada. */
  regla: CanvasFillRule;
}

/** El lienzo: `px` de lado, que cubren `lado` u alrededor del héroe; se vuelve a centrar cuando el héroe cruza una celda de `paso` u (así
 * siempre cubre, como poco, lado / 2 − paso · √2 / 2 ≈ 510 u: más que la distancia de carga más larga). El borde: `ancho` u hacia dentro, en
 * `capas` trazos que se suman. */
export const TERRITORIO = { px: 1024, lado: 1200, paso: 128, borde: { ancho: 4, capas: 6, alfa: 0.05 } } as const;

export class Territorio {
  private readonly uniformes = {
    uTerritorio: { value: null as THREE.CanvasTexture | null },
    /** x0, y0 y lado del lienzo, en u. */
    uCajaTerritorio: { value: new THREE.Vector3(0, 0, 1) },
  };
  private readonly lienzo: HTMLCanvasElement | null = typeof document === 'undefined' ? null : Object.assign(document.createElement('canvas'), { width: TERRITORIO.px, height: TERRITORIO.px });
  private clave = '';

  /** Repinta si cambiaron los rellenos (su color, opacidad y la forma de sus contornos) o si el héroe, en (`cx`, `cy`), cambió de celda. */
  actualizar(rellenos: readonly RellenoDeTerritorio[], cx: number, cy: number): void {
    const { px, lado, paso, borde } = TERRITORIO;
    const ox = Math.round(cx / paso) * paso - lado / 2, oy = Math.round(cy / paso) * paso - lado / 2;
    const clave = `${ox},${oy}|${claveDe(rellenos)}`;
    if (clave === this.clave || !this.lienzo) return;
    this.clave = clave;
    const ctx = this.lienzo.getContext('2d');
    if (!ctx) return;
    const k = px / lado;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    for (const r of rellenos) {
      const camino = new Path2D();
      for (const c of r.contornos) {
        if (c.length < 3) continue;
        c.forEach((p, i) => (i === 0 ? camino.moveTo(p.x, p.y) : camino.lineTo(p.x, p.y)));
        camino.closePath();
      }
      ctx.save();
      const k = refuerzo(r.color);
      ctx.fillStyle = ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.min(1, r.alfa * k);
      ctx.fill(camino, r.regla);
      // el borde por dentro: trazos cada vez más estrechos sobre el contorno, recortados a la zona; se suman hacia fuera
      ctx.clip(camino, r.regla);
      ctx.globalAlpha = Math.min(1, borde.alfa * k);
      ctx.lineJoin = 'round';
      for (let i = 0; i < borde.capas; i++) {
        ctx.lineWidth = (2 * borde.ancho * (borde.capas - i)) / borde.capas;
        ctx.stroke(camino);
      }
      ctx.restore();
    }
    let t = this.uniformes.uTerritorio.value;
    if (!t) {
      t = new THREE.CanvasTexture(this.lienzo);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false; // la fila 0 del lienzo es la y más pequeña, como la niebla
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      this.uniformes.uTerritorio.value = t;
    }
    t.needsUpdate = true;
    this.uniformes.uCajaTerritorio.value.set(ox, oy, lado);
  }

  /** Mete el tinte en el sombreado del suelo, sobre `diffuseColor` (antes de la luz). Se llama desde su `onBeforeCompile`, antes de la niebla. */
  parchear(sh: THREE.WebGLProgramParametersWithUniforms): void {
    Object.assign(sh.uniforms, this.uniformes);
    sh.vertexShader = 'varying vec2 vTerritorioXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vTerritorioXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
    sh.fragmentShader = 'uniform sampler2D uTerritorio; uniform vec3 uCajaTerritorio; varying vec2 vTerritorioXZ;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 uvTerr = (vTerritorioXZ - uCajaTerritorio.xy) / uCajaTerritorio.z;
        if (all(greaterThan(uvTerr, vec2(0.0))) && all(lessThan(uvTerr, vec2(1.0)))) {
          vec4 terr = texture2D(uTerritorio, uvTerr);
          diffuseColor.rgb = mix(diffuseColor.rgb, terr.rgb, terr.a);
        }
      }`);
  }

  destruir(): void {
    this.uniformes.uTerritorio.value?.dispose();
  }
}

/** Cuánto más opaco va el tinte de un color oscuro: sobre el suelo, un tinte negro solo oscurece, y con la misma opacidad que uno claro se
 * confunde con la sombra de una nube. Hasta ×1,6 para el negro; nada desde una luminancia de 0,35. */
export function refuerzo(color: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color);
  if (!m) return 1;
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => parseInt(h, 16) / 255);
  const luz = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return 1 + 0.6 * Math.min(1, Math.max(0, (0.35 - luz) / 0.35));
}

/** Lo que resume unos rellenos: su color y opacidad, y de cada contorno cuántos puntos tiene y dónde caen el primero y el de en medio. */
export function claveDe(rellenos: readonly RellenoDeTerritorio[]): string {
  return rellenos.map((r) => `${r.color}:${r.alfa}:${r.regla}:` + r.contornos.map((c) => {
    const a = c[0], b = c[c.length >> 1];
    return `${c.length}@${a?.x},${a?.y}/${b?.x},${b?.y}`;
  }).join(';')).join('|');
}
