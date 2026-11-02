// Las piezas con que se montan los modelos de la ciudad: unas pocas formas de lado 1 (caja, cilindro, cono, tejado a dos aguas, tejado a cuatro
// aguas, cúpula, media torre, copa de árbol) que se escalan, giran y tiñen una a una. Todas las de una forma van en una sola malla instanciada
// (un material blanco teñido por instancia): miles de piezas en una docena de llamadas de dibujo. Cada pieza puede llevar el id del edificio al
// que pertenece, para saber qué hay bajo el ratón.
// Coordenadas: x y z de la escena = x e y locales del trazado; y = altura. Cada forma apoya su base en y = 0.
import * as THREE from 'three';

export type Forma = 'caja' | 'cilindro' | 'cono' | 'aguas' | 'cuatroAguas' | 'cupula' | 'media' | 'copa' | 'losa';

export interface Pieza {
  forma: Forma;
  /** Centro de la base. */
  x: number;
  z: number;
  /** Altura de la base sobre el suelo. */
  y: number;
  /** Lados: `ancho` en x, `fondo` en z (antes de girar) y `alto`. */
  ancho: number;
  fondo: number;
  alto: number;
  /** Giro alrededor de la vertical, en radianes. */
  giro: number;
  /** Inclinación alrededor del eje x de la pieza (un poste caído, una viga), en radianes. */
  inclina?: number;
  color: number;
  /** El edificio al que pertenece (para el clic). */
  de?: string;
}

const GEO: Record<Forma, THREE.BufferGeometry> = (() => {
  const base = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.translate(0, 0.5, 0);
  // tejado a dos aguas: prisma de caballete en x, alero en z = ±0,5
  const tri = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  const aguas = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false });
  aguas.translate(0, 0, -0.5);
  aguas.rotateY(Math.PI / 2);
  const cuatro = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  cuatro.rotateY(Math.PI / 4);
  const cupula = new THREE.SphereGeometry(0.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  cupula.scale(1, 2, 1);
  // media torre: medio cilindro hacia +x, la cara plana en x = 0 (contra el muro)
  const media = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, 0, Math.PI);
  return {
    caja: base(new THREE.BoxGeometry(1, 1, 1)),
    cilindro: base(new THREE.CylinderGeometry(0.5, 0.5, 1, 12)),
    cono: base(new THREE.ConeGeometry(0.5, 1, 14)),
    aguas,
    cuatroAguas: base(cuatro),
    cupula,
    media: base(media),
    copa: base(new THREE.IcosahedronGeometry(0.5, 1)),
    // una caja sin sombra propia, para lo que va pegado al suelo (losas, campos, cuerdas)
    losa: base(new THREE.BoxGeometry(1, 1, 1)),
  };
})();

/** Lo que se va montando: piezas sueltas que luego se vuelcan en mallas instanciadas. */
export class Piezas {
  readonly lista: Pieza[] = [];
  /** El edificio al que se asignan las piezas que se añaden ahora. */
  de: string | undefined;
  /** Un tinte que se aplica a todo lo que se añade ahora (1 = sin tinte; menos, más oscuro): lo dañado. */
  tinte = 1;

  add(p: Omit<Pieza, 'de'>): void {
    const color = this.tinte === 1 ? p.color : oscurecer(p.color, this.tinte);
    this.lista.push({ ...p, color, de: this.de });
  }

  /** Una forma de `ancho` × `fondo` × `alto` en (x, z), girada `giro` y subida `y`. */
  forma(forma: Forma, color: number, x: number, z: number, ancho: number, fondo: number, alto: number, giro = 0, y = 0, inclina?: number): void {
    if (ancho <= 0 || fondo <= 0 || alto <= 0) return;
    this.add({ forma, x, z, y, ancho, fondo, alto, giro, inclina, color });
  }

  caja(color: number, x: number, z: number, ancho: number, fondo: number, alto: number, giro = 0, y = 0): void {
    this.forma('caja', color, x, z, ancho, fondo, alto, giro, y);
  }

  /** Un poste vertical (cilindro fino). */
  poste(color: number, x: number, z: number, alto: number, grueso = 0.12, y = 0): void {
    this.forma('cilindro', color, x, z, grueso, grueso, alto, 0, y);
  }

  /** Una viga o tablón de (x0, z0) a (x1, z1) a la altura `y`. */
  viga(color: number, x0: number, z0: number, x1: number, z1: number, y: number, grueso = 0.1, alto = grueso): void {
    const l = Math.hypot(x1 - x0, z1 - z0);
    if (l < 1e-3) return;
    this.caja(color, (x0 + x1) / 2, (z0 + z1) / 2, l, grueso, alto, Math.atan2(z1 - z0, x1 - x0), y);
  }

  /** Lo que hay que girar una pieza para que su eje x vaya de (x0, z0) a (x1, z1). */
  static rumbo(x0: number, z0: number, x1: number, z1: number): number {
    return Math.atan2(z1 - z0, x1 - x0);
  }
}

/** Un color más oscuro (`k` < 1) o más claro (`k` > 1). */
export function oscurecer(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k)), g = Math.min(255, Math.round(((color >> 8) & 255) * k)), b = Math.min(255, Math.round((color & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/** Mezcla dos colores (t = 0, el primero; 1, el segundo). */
export function mezclar(a: number, b: number, t: number): number {
  const c = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

/** Un grupo de mallas instanciadas hecho de unas piezas, con el id del edificio de cada instancia. */
export class MallasDePiezas {
  readonly grupo = new THREE.Group();
  /** Por malla, el edificio de cada instancia. */
  private readonly ids = new Map<THREE.InstancedMesh, (string | undefined)[]>();

  constructor(piezas: readonly Pieza[], material: THREE.Material, sombras = true) {
    const porForma = new Map<Forma, Pieza[]>();
    for (const p of piezas) {
      let l = porForma.get(p.forma);
      if (!l) porForma.set(p.forma, (l = []));
      l.push(p);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), s = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
    for (const [forma, lista] of porForma) {
      const im = new THREE.InstancedMesh(GEO[forma], material, lista.length);
      const ids: (string | undefined)[] = [];
      lista.forEach((p, k) => {
        e.set(p.inclina ?? 0, -p.giro, 0);
        q.setFromEuler(e);
        s.set(p.ancho, p.alto, p.fondo);
        v.set(p.x, p.y, p.z);
        im.setMatrixAt(k, m.compose(v, q, s));
        im.setColorAt(k, c.setHex(p.color, THREE.SRGBColorSpace));
        ids.push(p.de);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.computeBoundingBox();
      im.castShadow = sombras && forma !== 'losa';
      im.receiveShadow = sombras;
      this.ids.set(im, ids);
      this.grupo.add(im);
    }
  }

  /** El edificio de una instancia tocada por un rayo. */
  idDe(objeto: THREE.Object3D, instancia: number | undefined): string | undefined {
    return instancia === undefined ? undefined : this.ids.get(objeto as THREE.InstancedMesh)?.[instancia];
  }

  get cuantas(): number {
    let n = 0;
    for (const im of this.ids.keys()) n += im.count;
    return n;
  }

  destruir(): void {
    for (const im of this.ids.keys()) im.dispose();
    this.grupo.clear();
    this.ids.clear();
  }
}
