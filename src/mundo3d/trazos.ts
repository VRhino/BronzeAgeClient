// Las rayas sobre el terreno que vienen de la proyección: caminos (su grosor dice si es sendero, camino o calzada), fronteras (la silueta real
// de lo que se ve; un círculo discontinuo de lo que se recuerda), la zona propia y el anillo de protección de los campamentos de mercenarios.
// Caminos y fronteras van bajo la niebla y lo propio encima, como en `render.ts`: de una frontera solo se ve el tramo que cae en lo explorado.
// Se recortan a una caja alrededor del héroe y se rehacen cuando cambian o cuando el héroe se aleja de donde se hicieron.
import * as THREE from 'three';
import type { TrazoEnVista } from './estado';
import { cinta, tramosEnCaja } from './lineas';
import type { NieblaDeGuerra } from './niebla';

/** Lo que sube cada clase de raya sobre el suelo y cuánto se adelanta en el z-buffer: lo de encima tapa a lo de debajo. */
const CAPA = { camino: { dy: 0.04, f: -2 }, frontera: { dy: 0.06, f: -3 }, zona: { dy: 0.08, f: -4 }, anillo: { dy: 0.08, f: -4 } } as const;
/** Raya discontinua: lleno y hueco, en u. La frontera va en segmentos largos; la de una zona que solo se recuerda, en trazos cortos. */
const DISCONTINUA = [1.2, 0.7] as const;
const RECORDADA = [0.4, 0.6] as const;

export class Trazos {
  readonly grupo = new THREE.Group();
  private readonly materiales = new Map<string, THREE.Material>();
  private clave = '';
  private centro = { x: NaN, y: NaN };
  /** Los caminos de ahora (donde no crecen árboles) y lo que los resume. */
  caminos: TrazoEnVista[] = [];
  claveCaminos = '';

  constructor(private readonly niebla: NieblaDeGuerra, private readonly alturaU: (x: number, y: number) => number) {}

  private material(t: TrazoEnVista): THREE.Material {
    const clave = `${t.tipo}|${t.color}|${t.bajoNiebla}|${t.tenue ?? false}`;
    let m = this.materiales.get(clave);
    if (!m) {
      const f = CAPA[t.tipo].f, comunes = { color: t.color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f };
      // el camino es suelo (le da la luz); las rayas políticas, color plano para que se lean
      m = t.tipo === 'camino' ? new THREE.MeshLambertMaterial(comunes) : new THREE.MeshBasicMaterial({ ...comunes, transparent: t.tipo === 'anillo' || !!t.tenue, opacity: t.tenue ? 0.45 : t.tipo === 'anillo' ? 0.7 : 1, depthWrite: !t.tenue });
      if (t.bajoNiebla) this.niebla.aplicar(m);
      this.materiales.set(clave, m);
    }
    return m;
  }

  /** Rehace las rayas si cambiaron o si (cx, cy) se alejó más de un cuarto de `radio` de donde se hicieron; recorta a `radio` u. */
  actualizar(trazos: readonly TrazoEnVista[], cx: number, cy: number, radio: number): void {
    const clave = trazos.map((t) => {
      const a = t.puntos[0]!, b = t.puntos[t.puntos.length - 1]!;
      return `${t.tipo}:${t.color}:${t.bajoNiebla}:${t.discontinuo ?? false}:${t.haciaDentro ?? 0}:${t.tenue ?? false}:${t.ancho}:${t.puntos.length}:${a.x},${a.y}:${b.x},${b.y}`;
    }).join('|');
    if (clave === this.clave && Math.hypot(cx - this.centro.x, cy - this.centro.y) < radio / 4) return;
    if (clave !== this.clave) {
      this.caminos = trazos.filter((t) => t.tipo === 'camino');
      this.claveCaminos = clave.split('|').filter((c) => c.startsWith('camino:')).join('|');
    }
    this.clave = clave;
    this.centro = { x: cx, y: cy };
    this.vaciar();
    for (const t of trazos) {
      const capa = CAPA[t.tipo];
      for (const tramo of tramosEnCaja(t.puntos, cx - radio, cy - radio, cx + radio, cy + radio)) {
        // un contorno va corrido medio ancho hacia dentro: donde se tocan dos zonas, cada raya queda de su lado y se ven las dos
        const desplazar = t.haciaDentro ? t.haciaDentro * (t.ancho / 2 + 0.02) : 0;
        const geo = cinta(tramo, this.alturaU, t.ancho, { dy: capa.dy, trazo: t.discontinuo ? (t.recordada ? RECORDADA : DISCONTINUA) : undefined, desplazar });
        if (!geo) continue;
        const malla = new THREE.Mesh(geo, this.material(t));
        malla.receiveShadow = t.tipo === 'camino';
        this.grupo.add(malla);
      }
    }
  }

  private vaciar(): void {
    for (const m of [...this.grupo.children]) {
      this.grupo.remove(m);
      (m as THREE.Mesh).geometry.dispose();
    }
  }

  destruir(): void {
    this.vaciar();
    for (const m of this.materiales.values()) m.dispose();
  }
}
