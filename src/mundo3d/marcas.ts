// Las marcas sobre el terreno que no son del mundo sino de lo que el jugador mira o decide: el anillo discontinuo de las formaciones, el círculo
// de cada Mirada de taberna (discontinuo y gris cuando caduca), el aro de lo seleccionado (late) y la vista previa de fundar alrededor de la
// columna: la zona con que nacería la plaza, dónde cabría una aldea (verde; gris si queda demasiado cerca de algo) y las parcelas de bosque
// (verdes las libres, rojas las ocupadas o de otra plaza). Todo va encima de la niebla, como en el 2D, y se rehace cuando cambia.
import * as THREE from 'three';
import type { ColumnaEnVista, FundacionEnVista, MiradaEnVista, SeleccionEnVista } from './estado';
import { cinta, circulo } from './lineas';

const COLOR = { mirada: 0x7cc4ea, caducada: 0xb4b4b4, seleccion: 0xf4ead2, fundacion: 0xf1d38b, valido: 0x46c85a, cerca: 0xa0a096, libre: 0x78dc6e, ocupada: 0xc85a46 };

export interface Marcas {
  columnas: readonly ColumnaEnVista[];
  miradas: readonly MiradaEnVista[];
  seleccion: SeleccionEnVista | null;
  fundacion: FundacionEnVista | null;
}

export class MarcasEnSuelo {
  readonly grupo = new THREE.Group();
  private readonly materiales = new Map<string, THREE.MeshBasicMaterial>();
  private readonly seleccion = new THREE.Group();
  private readonly matSeleccion: THREE.MeshBasicMaterial;
  private clave = '';
  private claveSeleccion = '';

  constructor(private readonly alturaU: (x: number, y: number) => number) {
    this.matSeleccion = this.material(COLOR.seleccion, 1);
    this.matSeleccion.transparent = true;
    this.grupo.add(this.seleccion);
  }

  private material(color: number, opacidad: number): THREE.MeshBasicMaterial {
    const clave = `${color}|${opacidad}`;
    let m = this.materiales.get(clave);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacidad < 1, opacity: opacidad, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
      this.materiales.set(clave, m);
    }
    return m;
  }

  private aro(grupo: THREE.Group, centro: { x: number; y: number }, r: number, ancho: number, mat: THREE.Material, discontinuo = false): void {
    const geo = cinta(circulo(centro, r, Math.max(32, Math.ceil(r * 8))), this.alturaU, ancho, { dy: 0.09, paso: Math.min(0.5, r / 8), trazo: discontinuo ? [0.6, 0.45] : undefined });
    if (geo) grupo.add(new THREE.Mesh(geo, mat));
  }

  /** Rehace lo que cambió; `ahora` (ms) hace latir el aro de lo seleccionado. */
  actualizar(m: Marcas, ahora: number): void {
    const f = (v: number) => v.toFixed(1);
    const formaciones = m.columnas.filter((c) => c.formacion);
    const fun = m.fundacion;
    const clave = [
      ...formaciones.map((c) => `F${c.id}:${f(c.posicion.x)},${f(c.posicion.y)}:${c.color}`),
      ...m.miradas.map((x) => `M${x.id}:${x.abierta}:${x.radio}`),
      fun ? `U${f(fun.centro.x)},${f(fun.centro.y)}:${fun.radio}:${fun.sitios?.validos.length ?? 0}:${fun.sitios?.cerca.length ?? 0}:${fun.parcelas.map((q) => q.estado).join('')}` : '',
    ].join('|');
    if (clave !== this.clave) {
      this.clave = clave;
      this.vaciar(this.grupo, [this.seleccion]);
      for (const c of formaciones) this.aro(this.grupo, c.posicion, 1, 0.06, this.material(new THREE.Color(c.color).getHex(), 1), true);
      for (const x of m.miradas) this.aro(this.grupo, x.centro, x.radio, x.abierta ? 0.15 : 0.1, this.material(x.abierta ? COLOR.mirada : COLOR.caducada, x.abierta ? 1 : 0.55), !x.abierta);
      if (fun) this.fundar(fun);
    }
    const s = m.seleccion, claveSel = s ? `${f(s.posicion.x)},${f(s.posicion.y)}:${s.radio}` : '';
    if (claveSel !== this.claveSeleccion) {
      this.claveSeleccion = claveSel;
      this.vaciar(this.seleccion);
      if (s) this.aro(this.seleccion, s.posicion, s.radio, 0.07, this.matSeleccion);
    }
    this.matSeleccion.opacity = 0.55 + 0.45 * Math.sin(ahora / 260) ** 2;
  }

  private fundar(fun: FundacionEnVista): void {
    this.aro(this.grupo, fun.centro, fun.radio, 0.12, this.material(COLOR.fundacion, 1), true);
    this.aro(this.grupo, fun.centro, 0.25, 0.08, this.material(COLOR.fundacion, 1));
    // los sitios de aldea: cuadros planos del paso de la rejilla con que se buscaron
    const s = fun.sitios;
    if (s && s.validos.length + s.cerca.length) {
      const lado = s.paso * 0.85, caja = new THREE.BoxGeometry(lado, 0.02, lado), m = new THREE.Matrix4();
      for (const [lista, color] of [[s.validos, COLOR.valido], [s.cerca, COLOR.cerca]] as const) {
        if (!lista.length) continue;
        const im = new THREE.InstancedMesh(caja, this.material(color, 0.6), lista.length);
        lista.forEach((q, k) => im.setMatrixAt(k, m.makeTranslation(q.x, this.alturaU(q.x, q.y) + 0.06, q.y)));
        im.computeBoundingSphere();
        this.grupo.add(im);
      }
    }
    for (const q of fun.parcelas) this.aro(this.grupo, q.centro, 2, 0.12, this.material(q.estado === 'libre' ? COLOR.libre : COLOR.ocupada, 0.85));
  }

  private vaciar(g: THREE.Group, salvo: THREE.Object3D[] = []): void {
    for (const o of [...g.children]) {
      if (salvo.includes(o)) continue;
      g.remove(o);
      if (o instanceof THREE.InstancedMesh) { o.geometry.dispose(); o.dispose(); } else (o as THREE.Mesh).geometry.dispose();
    }
  }

  destruir(): void {
    this.vaciar(this.seleccion);
    this.vaciar(this.grupo);
    for (const m of this.materiales.values()) m.dispose();
  }
}
