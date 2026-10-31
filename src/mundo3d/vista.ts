// La vista 3D del modo mundo: la escena, la cámara de juego, el suelo por teselas con la niebla, los árboles, los ríos y los nodos, las
// maquetas, las rayas (caminos, fronteras, zonas), las columnas y la ruta. Pinta en su propio bucle de fotogramas y en cada uno pide el estado
// (`estado()`: la proyección del instante, ya convertida), así las columnas andan solas. Lo que hay que construir alrededor del héroe se hace
// poco a poco, con un presupuesto de tiempo por fotograma.
// Coordenadas de escena: x = x del mapa, z = y del mapa, y = altura en unidades (metros / 12).
import * as THREE from 'three';
import { CamaraDeJuego, type Zoom } from './camara';
import { MUNDO3D } from './config';
import { instalarEntrada, type Entrada } from './entrada';
import type { ColumnaEnVista, EstadoVista } from './estado';
import { FigurasDeColumna } from './figuras';
import type { FuenteDeAltura } from './fuente';
import { Arboles } from './arboles';
import { aro, cinta, circulo, linea, rutaPendiente } from './lineas';
import { Maquetas } from './maquetas';
import { NieblaDeGuerra } from './niebla';
import { Paisaje } from './paisaje';
import { Terreno } from './terreno';
import { Trazos } from './trazos';
import type { MapaGenerado } from '../terreno';

type Punto = { x: number; y: number };

export interface OpcionesVista {
  fuente: FuenteDeAltura;
  mapa: MapaGenerado;
  /** El estado de ahora (se pide en cada fotograma); `null` mientras no haya proyección. */
  estado: () => EstadoVista | null;
  /** Un clic en el terreno: el punto del mapa bajo el ratón. */
  alClicar: (punto: Punto, evento: PointerEvent) => void;
  /** Píxeles por unidad a la distancia del héroe, para el radio de agarre de los clics (`ui/agarre.ts`). */
  alCambiarEscala?: (pxPorUnidad: number) => void;
  /** Sin niebla (`?sinNiebla` en desarrollo). */
  sinNiebla?: boolean;
}

/** Color de la tropa propia. */
const COLOR_PROPIO = 0xc0392b;
/** Milisegundos por fotograma para construir lo que falta alrededor del héroe. */
const PRESUPUESTO = 8;
/** Hasta dónde llegan, como mucho, los árboles y lo que va sobre el suelo (u); más allá la bruma ya casi lo tapa todo. */
const ALCANCE = { arboles: 200, paisaje: 240, trazos: 240 };

export class VistaMundo3D {
  readonly lienzo = document.createElement('canvas');
  readonly camara = new CamaraDeJuego();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  private readonly sol = new THREE.DirectionalLight(0xfff0d8, 2.2);
  private readonly bruma: THREE.Fog;
  private readonly niebla = new NieblaDeGuerra();
  private readonly terreno: Terreno;
  private readonly paisaje: Paisaje;
  private readonly arboles: Arboles;
  private readonly maquetas: Maquetas;
  private readonly trazos: Trazos;
  private readonly entrada: Entrada;
  private readonly columnas = new Map<string, FigurasDeColumna>();
  private readonly lineas = new THREE.Group();
  private readonly matRuta = new THREE.LineBasicMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.85 });
  private readonly matMira = new THREE.MeshBasicMaterial({ color: 0xf1e6c8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  private readonly observador: ResizeObserver;
  private claveLineas = '';
  private fotograma = 0;
  private antes = performance.now();
  private pausada = false;
  private sinNiebla: boolean;
  private objetivo = new THREE.Vector3();
  private rayo = new THREE.Raycaster();

  constructor(private readonly contenedor: HTMLElement, private readonly o: OpcionesVista) {
    this.sinNiebla = o.sinNiebla ?? false;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.lienzo.className = 'mundo3d-lienzo';
    this.lienzo.tabIndex = 0;
    this.lienzo.setAttribute('aria-label', 'El mundo alrededor de tu héroe. Arrastra para girar la cámara, la rueda acerca y aleja, y un clic en el terreno manda tu columna.');
    contenedor.appendChild(this.lienzo);

    // el cielo y la bruma lejana, del color de la niebla de guerra: lo que no se ve se funde con ella
    const fondo = new THREE.Color().setRGB(...(MUNDO3D.niebla.color.map((c) => c / 255) as [number, number, number]), THREE.SRGBColorSpace);
    this.escena.background = fondo;
    this.bruma = new THREE.Fog(fondo, 60, 200);
    this.escena.fog = this.bruma;
    this.escena.add(new THREE.HemisphereLight(0xdfe9f0, 0x6b5a40, 1.4));
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    this.escena.add(this.sol, this.sol.target);

    this.terreno = new Terreno(o.fuente, o.mapa, this.niebla);
    this.paisaje = new Paisaje(o.fuente, o.mapa, this.niebla, this.alturaU);
    this.arboles = new Arboles(o.fuente, o.mapa, this.niebla);
    this.maquetas = new Maquetas(this.niebla, this.alturaU);
    this.trazos = new Trazos(this.niebla, this.alturaU);
    this.escena.add(this.terreno.grupo, this.paisaje.grupo, this.arboles.grupo, this.maquetas.grupo, this.trazos.grupo, this.lineas);
    this.entrada = instalarEntrada(this.lienzo, this.camara, (e) => this.clic(e), () => {}); // el zoom se lee de la cámara en cada fotograma
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(contenedor);
    this.ajustar();
    this.fotograma = requestAnimationFrame((t) => this.bucle(t));
  }

  /** Altura del suelo en (x, y) del mapa, en unidades de escena. */
  readonly alturaU = (x: number, y: number): number => this.o.fuente.alturaEn(x, y) / MUNDO3D.metrosPorUnidad;

  zoom(z: Zoom): void {
    this.camara.zoom = z;
  }

  /** Quita o vuelve a poner la niebla de guerra (para mirar el terreno entero en desarrollo). */
  fijarSinNiebla(si: boolean): void {
    this.sinNiebla = si;
  }

  /** Cuánto hay puesto (para el banco de pruebas): árboles y piezas de las maquetas. */
  cuentas(): { arboles: number; maquetas: number; trazos: number } {
    let maquetas = 0;
    for (const m of this.maquetas.grupo.children) maquetas += (m as THREE.InstancedMesh).count;
    return { arboles: this.arboles.cuantos, maquetas, trazos: this.trazos.grupo.children.length };
  }

  /** Deja de pintar (el modo mapa en 2D la tapa) o vuelve a hacerlo. */
  pausar(si: boolean): void {
    this.pausada = si;
  }

  /** El punto del mapa bajo un evento del ratón: el rayo de la cámara avanza hasta tocar el relieve. `null` si no toca el mapa. */
  aMundo(evento: { clientX: number; clientY: number }): Punto | null {
    const r = this.lienzo.getBoundingClientRect();
    this.rayo.setFromCamera(new THREE.Vector2(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1), this.camara.camara);
    const o = this.rayo.ray.origin, d = this.rayo.ray.direction;
    const en = (t: number): [number, number, number] => [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t];
    let t = 0, antes = 0;
    for (let k = 0; k < 8000 && t < 4000; k++) {
      const [x, y, z] = en(t), h = this.alturaU(x, z);
      if (y <= h) {
        let a = antes, b = t;
        for (let s = 0; s < 24; s++) { const m = (a + b) / 2, [mx, my, mz] = en(m); if (my <= this.alturaU(mx, mz)) b = m; else a = m; }
        const [fx, , fz] = en(b);
        return fx >= 0 && fz >= 0 && fx <= this.o.fuente.ancho && fz <= this.o.fuente.alto ? { x: fx, y: fz } : null;
      }
      antes = t;
      t += Math.max(0.02, (y - h) * 0.3);
    }
    return null;
  }

  private clic(evento: PointerEvent): void {
    const p = this.aMundo(evento);
    if (p) this.o.alClicar(p, evento);
  }

  private ajustar(): void {
    const w = this.contenedor.clientWidth, h = this.contenedor.clientHeight;
    if (w && h) this.renderer.setSize(w, h, false);
  }

  private bucle(ahora: number): void {
    this.fotograma = requestAnimationFrame((t) => this.bucle(t));
    const dt = Math.min(0.1, (ahora - this.antes) / 1000);
    this.antes = ahora;
    if (this.pausada) return;
    const estado = this.o.estado();
    if (!estado?.heroe) return;
    this.entrada.teclas(dt);
    this.niebla.actualizar(estado.niebla, this.sinNiebla);
    this.camara.radioVision = estado.radioVision;
    const w = this.lienzo.clientWidth || 1, h = this.lienzo.clientHeight || 1, { x, y } = estado.heroe;
    this.objetivo.set(x, this.alturaU(x, y), y);
    this.camara.colocar(this.objetivo, w / h, (cx, cz) => this.alturaU(cx, cz));
    this.o.alCambiarEscala?.(this.camara.pxPorUnidad(h));
    // el suelo hasta donde llega la vista (con la cámara baja, hasta la bruma)
    const d = this.camara.distancia;
    this.bruma.near = d * 2.2;
    this.bruma.far = d * 7;
    const alcance = Math.min(320, d * 7), hasta = performance.now() + PRESUPUESTO;
    this.terreno.actualizar(x, y, alcance, hasta);
    this.maquetas.actualizar(estado.mundo);
    this.trazos.actualizar(estado.mundo.trazos, x, y, Math.min(alcance, ALCANCE.trazos));
    this.arboles.fijarDespejes(this.maquetas.claros, this.trazos.caminos, `${this.maquetas.claveClaros}|${this.trazos.claveCaminos}`);
    this.paisaje.actualizar(x, y, Math.min(alcance, ALCANCE.paisaje), hasta);
    this.arboles.actualizar(x, y, Math.min(alcance, ALCANCE.arboles), hasta);
    this.ponerColumnas(estado.columnas);
    this.ponerLineas(estado.columnas);
    // la sombra sigue al héroe y cubre lo que se ve
    const r = Math.min(120, Math.max(20, d * 1.6));
    this.sol.position.set(x - 60, this.objetivo.y + 110, y + 45);
    this.sol.target.position.copy(this.objetivo);
    const sc = this.sol.shadow.camera;
    if (sc.right !== r) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 600; sc.updateProjectionMatrix(); }
    this.renderer.render(this.escena, this.camara.camara);
  }

  private ponerColumnas(lista: ColumnaEnVista[]): void {
    const vivas = new Set<string>();
    for (const c of lista) {
      vivas.add(c.id);
      let f = this.columnas.get(c.id);
      if (!f || f.jinetes !== c.jinetes || f.soldados !== c.soldados) {
        f?.destruir();
        f = new FigurasDeColumna(c.jinetes, c.soldados, COLOR_PROPIO);
        this.columnas.set(c.id, f);
        this.escena.add(f.grupo);
      }
      f.mover(c.posicion, this.alturaU);
    }
    for (const [id, f] of this.columnas) if (!vivas.has(id)) { f.destruir(); this.columnas.delete(id); }
  }

  /** El aro en el suelo bajo cada columna propia (la mira del 2D: entre los árboles se pierde), la ruta que le queda y el aro de su destino;
   * se rehacen cuando la cabeza avanza un poco o cambia la ruta. */
  private ponerLineas(lista: ColumnaEnVista[]): void {
    const propias = lista.filter((c) => c.propia);
    const clave = propias.map((c) => `${c.id}:${c.posicion.x.toFixed(1)},${c.posicion.y.toFixed(1)}:${c.ruta.length}:${c.ruta.length ? `${c.ruta[c.ruta.length - 1]!.x},${c.ruta[c.ruta.length - 1]!.y}` : ''}`).join('|');
    if (clave === this.claveLineas) return;
    this.claveLineas = clave;
    for (const l of [...this.lineas.children]) { this.lineas.remove(l); (l as THREE.Line).geometry.dispose(); }
    for (const c of propias) {
      const mira = cinta(circulo(c.posicion, 0.45, 32), this.alturaU, 0.05, { dy: 0.06, paso: 0.1 });
      if (mira) this.lineas.add(new THREE.Mesh(mira, this.matMira));
      if (c.ruta.length < 2) continue;
      const pendiente = rutaPendiente(c.ruta, c.posicion);
      if (pendiente.length >= 2) this.lineas.add(linea(pendiente, this.alturaU, this.matRuta));
      this.lineas.add(aro(c.ruta[c.ruta.length - 1]!, 0.5, this.alturaU, this.matRuta));
    }
  }

  destruir(): void {
    cancelAnimationFrame(this.fotograma);
    this.observador.disconnect();
    this.entrada.destruir();
    for (const f of this.columnas.values()) f.destruir();
    for (const l of this.lineas.children) (l as THREE.Line).geometry.dispose();
    this.matRuta.dispose();
    this.matMira.dispose();
    this.terreno.destruir();
    this.paisaje.destruir();
    this.arboles.destruir();
    this.maquetas.destruir();
    this.trazos.destruir();
    this.niebla.destruir();
    this.renderer.dispose();
    this.lienzo.remove();
  }
}
