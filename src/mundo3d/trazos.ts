// Las rayas sobre el terreno que vienen de la proyección: caminos (su grosor dice si es sendero, camino o calzada), fronteras (la silueta real
// de lo que se ve; un círculo discontinuo de lo que se recuerda), la zona propia y el anillo de protección de los campamentos de mercenarios.
// Caminos y fronteras van bajo la niebla y lo propio encima, como en `render.ts`: de una frontera solo se ve el tramo que cae en lo explorado.
// Se recortan a una caja alrededor del héroe y se rehacen cuando cambian o cuando el héroe se aleja de donde se hicieron.
import * as THREE from 'three';
import { periodoDeCamino, texturaDeCamino } from './caminos';
import type { TrazoEnVista } from './estado';
import { cinta, recorridos, tramosEnCaja } from './lineas';
import type { NieblaDeGuerra } from './niebla';
import type { SueloPintado } from './terreno';

type Punto = { x: number; y: number };

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

  /** Cada cinta puesta, con lo que hace falta para rehacerla y la firma del suelo bajo ella. */
  private puestas: { malla: THREE.Mesh; hacer: () => THREE.BufferGeometry | null; caja: [number, number, number, number]; firma: number }[] = [];
  private version = -1;

  constructor(private readonly niebla: NieblaDeGuerra, private readonly suelo: SueloPintado) {}

  private material(t: TrazoEnVista): THREE.Material {
    const clave = `${t.tipo}|${t.color}|${t.bajoNiebla}|${t.tenue ?? false}|${t.escalon ?? ''}`;
    let m = this.materiales.get(clave);
    if (!m) {
      const f = CAPA[t.tipo].f, comunes = { color: t.color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f };
      // el camino es suelo (le da la luz), con la textura de su escalón y los bordes fundidos con el terreno; las rayas políticas, color plano
      // para que se lean
      m = t.tipo === 'camino'
        ? new THREE.MeshLambertMaterial({ ...comunes, color: 0xffffff, map: texturaDeCamino(t.escalon ?? 1), transparent: true, depthWrite: false })
        : new THREE.MeshBasicMaterial({ ...comunes, transparent: t.tipo === 'anillo' || !!t.tenue, opacity: t.tenue ? 0.45 : t.tipo === 'anillo' ? 0.7 : 1, depthWrite: !t.tenue });
      if (t.bajoNiebla) this.niebla.aplicar(m);
      this.materiales.set(clave, m);
    }
    return m;
  }

  /** Rehace las rayas si cambiaron o si (cx, cy) se alejó más de un cuarto de `radio` de donde se hicieron; recorta a `radio` u. */
  actualizar(trazos: readonly TrazoEnVista[], cx: number, cy: number, radio: number): void {
    const clave = trazos.map((t) => {
      const a = t.puntos[0]!, b = t.puntos[t.puntos.length - 1]!;
      return `${t.tipo}:${t.color}:${t.bajoNiebla}:${t.discontinuo ?? false}:${t.haciaDentro ?? 0}:${t.tenue ?? false}:${t.ancho}:${t.escalon ?? ''}:${t.puntos.length}:${a.x},${a.y}:${b.x},${b.y}`;
    }).join('|');
    if (clave === this.clave && Math.hypot(cx - this.centro.x, cy - this.centro.y) < radio / 4) {
      if (this.suelo.version !== this.version) this.recolocar();
      return;
    }
    this.version = this.suelo.version;
    if (clave !== this.clave) {
      this.caminos = trazos.filter((t) => t.tipo === 'camino');
      this.claveCaminos = clave.split('|').filter((c) => c.startsWith('camino:')).join('|');
    }
    this.clave = clave;
    this.centro = { x: cx, y: cy };
    this.vaciar();
    for (const t of trazos) {
      const capa = CAPA[t.tipo];
      // de un camino, lo andado hasta cada vértice: la textura sigue en su sitio aunque el recorte empiece en otro vértice
      let andado: Map<Punto, number> | null = null;
      if (t.tipo === 'camino') { const s = recorridos(t.puntos); andado = new Map(t.puntos.map((q, k) => [q, s[k]!])); }
      for (const tramo of tramosEnCaja(t.puntos, cx - radio, cy - radio, cx + radio, cy + radio)) {
        // un contorno va corrido medio ancho hacia dentro: donde se tocan dos zonas, cada raya queda de su lado y se ven las dos
        const desplazar = t.haciaDentro ? t.haciaDentro * (t.ancho / 2 + 0.02) : 0;
        const textura = andado ? { periodo: periodoDeCamino(t.ancho), desde: andado.get(tramo[0]!) ?? 0 } : undefined;
        const hacer = () => cinta(tramo, (x, y) => this.suelo.alturaU(x, y), t.ancho, { dy: capa.dy, trazo: t.discontinuo ? (t.recordada ? RECORDADA : DISCONTINUA) : undefined, desplazar, textura });
        const geo = hacer();
        if (!geo) continue;
        const malla = new THREE.Mesh(geo, this.material(t));
        malla.receiveShadow = t.tipo === 'camino';
        this.grupo.add(malla);
        const caja = cajaDe(tramo, t.ancho / 2 + Math.abs(desplazar) + 0.5);
        this.puestas.push({ malla, hacer, caja, firma: this.suelo.firma(...caja) });
      }
    }
  }

  /** Rehace las cintas cuyo suelo cambió (otro detalle de su tesela, o la que faltaba). */
  private recolocar(): void {
    this.version = this.suelo.version;
    for (const p of this.puestas) {
      const firma = this.suelo.firma(...p.caja);
      if (firma === p.firma) continue;
      p.firma = firma;
      const geo = p.hacer();
      if (!geo) continue;
      p.malla.geometry.dispose();
      p.malla.geometry = geo;
    }
  }

  private vaciar(): void {
    this.puestas = [];
    for (const m of [...this.grupo.children]) {
      this.grupo.remove(m);
      (m as THREE.Mesh).geometry.dispose();
    }
  }

  destruir(): void {
    this.vaciar();
    for (const m of this.materiales.values()) m.dispose();
    // las texturas de los caminos se quedan: son de todas las vistas y se hacen una vez
  }
}

/** La caja de unos puntos, con `margen` u de más. */
function cajaDe(puntos: readonly Punto[], margen: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of puntos) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return [x0 - margen, y0 - margen, x1 + margen, y1 + margen];
}
