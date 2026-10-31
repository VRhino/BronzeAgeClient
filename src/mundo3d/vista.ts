// La vista 3D del modo mundo: la escena, la cámara de juego, el suelo por teselas con la niebla, los árboles, los ríos y los nodos, las
// maquetas, las rayas (caminos, fronteras, zonas), las columnas y caravanas con sus rutas, las marcas (formaciones, Miradas, lo seleccionado,
// la vista previa de fundar) y los nombres. Pinta en su propio bucle de fotogramas y en cada uno pide el estado (`estado()`: la proyección del
// instante, ya convertida), así las columnas andan solas. Lo que hay que construir alrededor del héroe se hace poco a poco, con un
// presupuesto de tiempo por fotograma.
// Coordenadas de escena: x = x del mapa, z = y del mapa, y = altura en unidades (metros / 12).
import * as THREE from 'three';
import './mundo3d.css';
import { CamaraDeJuego, type Zoom } from './camara';
import { MUNDO3D } from './config';
import { instalarEntrada, type Entrada } from './entrada';
import type { CaravanaEnVista, ColumnaEnVista, EstadoVista, EtiquetaEnVista } from './estado';
import { Etiquetas } from './etiquetas';
import { RejillaDeMovimiento, type Navegacion } from './rejilla';
import { FigurasDeColumna, type TropaDeColumna } from './figuras';
import type { FuenteDeAltura } from './fuente';
import { Arboles } from './arboles';
import { aro, cinta, circulo, linea, rutaPendiente } from './lineas';
import { Maquetas } from './maquetas';
import { MarcasEnSuelo } from './marcas';
import { NieblaDeGuerra } from './niebla';
import { Paisaje } from './paisaje';
import { Terreno } from './terreno';
import { Trazos } from './trazos';
import type { MapaGenerado } from '../terreno';
import { RECURSO_NOMBRE } from '../paletas';

type Punto = { x: number; y: number };

export interface OpcionesVista {
  fuente: FuenteDeAltura;
  mapa: MapaGenerado;
  /** El estado de ahora (se pide en cada fotograma); `null` mientras no haya proyección. */
  estado: () => EstadoVista | null;
  /** Un clic en el terreno: el punto del mapa bajo el ratón. */
  alClicar: (punto: Punto, evento?: PointerEvent) => void;
  /** Píxeles por unidad a la distancia del héroe, para el radio de agarre de los clics (`ui/agarre.ts`). */
  alCambiarEscala?: (pxPorUnidad: number) => void;
  /** Sin niebla (`?sinNiebla` en desarrollo). */
  sinNiebla?: boolean;
}

/** Milisegundos por fotograma para construir lo que falta alrededor del héroe. */
const PRESUPUESTO = 8;
/** Lo mínimo que mide en pantalla la zona de clic de algo seleccionable, en px de radio. */
const MIN_PX_CLIC = 26;
const SIN_TROPA: TropaDeColumna = { porHeroe: [], ejercito: false };
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
  private readonly marcas: MarcasEnSuelo;
  private readonly etiquetas: Etiquetas;
  private readonly rejilla: RejillaDeMovimiento;
  private readonly entrada: Entrada;
  private readonly columnas = new Map<string, { figuras: FigurasDeColumna; clave: string }>();
  private readonly lineas = new THREE.Group();
  private readonly matRuta = new THREE.LineBasicMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.85 });
  /** La ruta de la columna del jugador: punteada y más marcada que el rastro de las demás (Víctor, 2026-10-31); el aro del destino sigue entero. */
  private readonly matRutaMia = new THREE.LineDashedMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.9, dashSize: 0.35, gapSize: 0.25 });
  /** Las rutas de las demás columnas de la Facción y de las caravanas: un rastro discontinuo, más tenue el de las caravanas (como en el 2D). */
  private readonly matRutaFaccion = new THREE.LineDashedMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.6, dashSize: 0.6, gapSize: 0.4 });
  private readonly matRutaCaravana = new THREE.LineDashedMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.35, dashSize: 0.6, gapSize: 0.4 });
  /** Los nombres de los nodos cercanos ya explorados, y dónde y con qué niebla se calcularon. */
  private nodos: { clave: string; lista: EtiquetaEnVista[] } = { clave: '', lista: [] };
  private readonly matMira = new THREE.MeshBasicMaterial({ color: 0xf1e6c8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  private readonly observador: ResizeObserver;
  private claveLineas = '';
  private fotograma = 0;
  private antes = performance.now();
  private pausada = false;
  /** El último estado pintado: con él se decide sobre qué cae un clic. */
  private ultimo: EstadoVista | null = null;
  private sinNiebla: boolean;
  /** Lo que tarda cada parte del fotograma (ms, media móvil), para la pasada de rendimiento: `rendimiento()`. */
  private readonly tiempos: Record<string, number> = {};
  /** Lo que queda por construir alrededor del héroe (teselas de suelo y paisaje, trozos de árboles). */
  private readonly faltan = { terreno: 0, paisaje: 0, arboles: 0 };
  private objetivo = new THREE.Vector3();
  private rayo = new THREE.Raycaster();

  constructor(private readonly contenedor: HTMLElement, private readonly o: OpcionesVista) {
    this.sinNiebla = o.sinNiebla ?? false;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // en una pantalla retina, 2 sombrearía cada píxel cuatro veces
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
    this.marcas = new MarcasEnSuelo(this.alturaU);
    this.etiquetas = new Etiquetas(contenedor, (punto) => this.o.alClicar(punto));
    this.rejilla = new RejillaDeMovimiento(this.alturaU);
    this.escena.add(this.terreno.grupo, this.paisaje.grupo, this.arboles.grupo, this.maquetas.grupo, this.trazos.grupo, this.marcas.grupo, this.lineas, this.rejilla.grupo);
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

  /** Enseña u oculta la rejilla de movimiento del servidor alrededor del héroe. */
  fijarRejilla(navegacion: Navegacion | null, visible: boolean): void {
    this.rejilla.fijar(navegacion, visible);
  }

  /** Quita o vuelve a poner la niebla de guerra (para mirar el terreno entero en desarrollo). */
  fijarSinNiebla(si: boolean): void {
    this.sinNiebla = si;
  }

  /** Cuánto hay puesto (para el banco de pruebas): árboles y piezas de las maquetas. */
  cuentas(): { arboles: number; maquetas: number; trazos: number; faltan: { terreno: number; paisaje: number; arboles: number } } {
    let maquetas = 0;
    for (const m of this.maquetas.grupo.children) maquetas += (m as THREE.InstancedMesh).count;
    return { arboles: this.arboles.cuantos, maquetas, trazos: this.trazos.grupo.children.length, faltan: { ...this.faltan } };
  }

  /** Lo que tarda cada parte del fotograma en el hilo principal (ms, media de los últimos ~30). `render` es lo que tarda en mandar la escena a
   * la tarjeta, no lo que tarda la tarjeta. */
  rendimiento(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.tiempos).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  }

  /** Apunta lo que tardó `parte` desde `desde` y devuelve el instante de ahora. */
  private medir(parte: string, desde: number): number {
    const ahora = performance.now();
    this.tiempos[parte] = (this.tiempos[parte] ?? ahora - desde) * 0.97 + (ahora - desde) * 0.03;
    return ahora;
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
    if (p) this.o.alClicar(this.iman(p), evento);
  }

  /** Un clic cerca de algo que se puede seleccionar cae en su centro: su zona de clic es lo que ocupa su maqueta, y como poco
   * `MIN_PX_CLIC` píxeles de pantalla (`main.ts` busca luego qué hay en ese punto con su propio radio, que en 3D es pequeño). La columna propia
   * no atrae: un clic a su lado es una marcha. */
  private iman(p: Punto): Punto {
    const e = this.ultimo;
    if (!e) return p;
    const M = MUNDO3D.maqueta, minimo = MIN_PX_CLIC / Math.max(1, this.camara.pxPorUnidad(this.lienzo.clientHeight || 1));
    const m = e.mundo, candidatos: { posicion: Punto; radio: number }[] = [
      ...m.plazas.map((x) => ({ posicion: x.posicion, radio: x.radioCiudad * M + 0.5 })),
      ...m.pueblos.map((x) => ({ posicion: x.posicion, radio: (x.aldea ? 1.5 : 0.9) * M })),
      ...m.avanzadas.map((x) => ({ posicion: x.posicion, radio: 0.7 * M })),
      ...m.obras.map((x) => ({ posicion: x.posicion, radio: 0.6 * M })),
      ...m.campamentos.map((x) => ({ posicion: x.posicion, radio: 0.9 * M * MUNDO3D.campamento })),
      ...m.bandidos.map((x) => ({ posicion: x.posicion, radio: 0.7 * M * MUNDO3D.campamento })),
      ...m.alijos.map((x) => ({ posicion: x.posicion, radio: 0.5 * MUNDO3D.alijo })),
      ...m.batallas.map((x) => ({ posicion: x.posicion, radio: 1 })),
      ...e.columnas.filter((c) => !c.mia).map((c) => ({ posicion: c.posicion, radio: 0.8 })),
      ...e.caravanas.map((c) => ({ posicion: c.posicion, radio: 0.7 })),
    ];
    let mejor: Punto | null = null, mejorD = Infinity;
    for (const c of candidatos) {
      const d = Math.hypot(c.posicion.x - p.x, c.posicion.y - p.y);
      if (d <= Math.max(c.radio, minimo) && d < mejorD) { mejor = c.posicion; mejorD = d; }
    }
    return mejor ? { x: mejor.x, y: mejor.y } : p;
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
    let t = performance.now();
    const inicio = t;
    const estado = this.o.estado();
    t = this.medir('estado', t);
    if (!estado?.heroe) return;
    this.ultimo = estado;
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
    t = this.medir('camara', t);
    this.faltan.terreno = this.terreno.actualizar(x, y, alcance, hasta);
    t = this.medir('terreno', t);
    this.maquetas.actualizar(estado.mundo);
    this.trazos.actualizar(estado.mundo.trazos, x, y, Math.min(alcance, ALCANCE.trazos));
    t = this.medir('maquetasYTrazos', t);
    this.arboles.fijarDespejes(this.maquetas.claros, this.trazos.caminos, `${this.maquetas.claveClaros}|${this.trazos.claveCaminos}`);
    this.faltan.paisaje = this.paisaje.actualizar(x, y, Math.min(alcance, ALCANCE.paisaje), hasta);
    t = this.medir('paisaje', t);
    this.faltan.arboles = this.arboles.actualizar(x, y, Math.min(alcance, ALCANCE.arboles), hasta);
    t = this.medir('arboles', t);
    this.ponerColumnas(estado.columnas, estado.caravanas);
    this.ponerLineas(estado.columnas, estado.caravanas);
    this.marcas.actualizar(estado, ahora);
    this.rejilla.actualizar(x, y);
    t = this.medir('columnasYMarcas', t);
    this.etiquetas.actualizar([...estado.etiquetas, ...this.etiquetasDeNodos(x, y, estado)], this.camara.camara, w, h, this.alturaU, estado.heroe, (this.bruma.near + this.bruma.far) / 2);
    t = this.medir('etiquetas', t);
    // la sombra sigue al héroe y cubre lo que se ve
    const r = Math.min(120, Math.max(20, d * 1.6));
    this.sol.position.set(x - 60, this.objetivo.y + 110, y + 45);
    this.sol.target.position.copy(this.objetivo);
    const sc = this.sol.shadow.camera;
    if (sc.right !== r) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 600; sc.updateProjectionMatrix(); }
    this.renderer.render(this.escena, this.camara.camara);
    this.medir('render', t);
    this.medir('total', inicio);
  }

  /** Las figuras de cada columna (de la Facción y avistadas) y de cada caravana suelta; se rehacen si cambia lo que llevan o su color. */
  private ponerColumnas(lista: readonly ColumnaEnVista[], caravanas: readonly CaravanaEnVista[]): void {
    const vivas = new Set<string>();
    const poner = (id: string, jinetes: number, tropa: TropaDeColumna, color: string, carros: { carga: number; fundacion: boolean }, posicion: Punto) => {
      vivas.add(id);
      const hex = new THREE.Color(color).getHex(), clave = `${jinetes}:${tropa.ejercito ? 'E' : 'P'}${tropa.porHeroe.join(',')}:${hex}:${carros.carga}:${carros.fundacion}`;
      let f = this.columnas.get(id);
      if (!f || f.clave !== clave) {
        f?.figuras.destruir();
        f = { figuras: new FigurasDeColumna(jinetes, tropa, hex, carros), clave };
        this.columnas.set(id, f);
        this.escena.add(f.figuras.grupo);
      }
      f.figuras.mover(posicion, this.alturaU);
    };
    for (const c of lista) poner(c.id, c.jinetes, c.tropa, c.color, c.carros, c.posicion);
    for (const c of caravanas) poner(`caravana:${c.id}`, 0, SIN_TROPA, c.color, { carga: c.fundacion ? 0 : 1, fundacion: c.fundacion }, c.posicion);
    for (const [id, f] of this.columnas) if (!vivas.has(id)) { f.figuras.destruir(); this.columnas.delete(id); }
  }

  /** Bajo la columna del jugador, un aro en el suelo (la mira del 2D: entre los árboles se pierde), su ruta y el aro de su destino; las demás
   * de la Facción y las caravanas propias, su rastro discontinuo. Se rehacen cuando una cabeza avanza un poco o cambia una ruta. */
  private ponerLineas(lista: readonly ColumnaEnVista[], caravanas: readonly CaravanaEnVista[]): void {
    const conRuta = [...lista.filter((c) => c.propia), ...caravanas.filter((c) => c.ruta.length >= 2)];
    const clave = conRuta.map((c) => `${c.id}:${c.posicion.x.toFixed(1)},${c.posicion.y.toFixed(1)}:${c.ruta.length}:${c.ruta.length ? `${c.ruta[c.ruta.length - 1]!.x},${c.ruta[c.ruta.length - 1]!.y}` : ''}`).join('|');
    if (clave === this.claveLineas) return;
    this.claveLineas = clave;
    for (const l of [...this.lineas.children]) { this.lineas.remove(l); (l as THREE.Line).geometry.dispose(); }
    for (const c of lista) {
      if (!c.propia) continue;
      if (c.mia) {
        const mira = cinta(circulo(c.posicion, 0.45, 32), this.alturaU, 0.05, { dy: 0.06, paso: 0.1 });
        if (mira) this.lineas.add(new THREE.Mesh(mira, this.matMira));
      }
      if (c.ruta.length < 2) continue;
      const pendiente = rutaPendiente(c.ruta, c.posicion);
      if (pendiente.length >= 2) this.lineas.add(linea(pendiente, this.alturaU, c.mia ? this.matRutaMia : this.matRutaFaccion).computeLineDistances());
      if (c.mia) this.lineas.add(aro(c.ruta[c.ruta.length - 1]!, 0.5, this.alturaU, this.matRuta));
    }
    for (const c of caravanas) {
      if (c.ruta.length < 2) continue;
      const pendiente = rutaPendiente(c.ruta, c.posicion);
      if (pendiente.length >= 2) this.lineas.add(linea(pendiente, this.alturaU, this.matRutaCaravana).computeLineDistances());
    }
  }

  /** Los nombres de los nodos de recursos que caben en pantalla y ya se exploraron; con la vista previa de fundar, los de dentro de su zona
   * (resaltados). Se recalculan cuando el héroe se mueve, cambia la niebla o la vista previa. */
  private etiquetasDeNodos(x: number, y: number, estado: EstadoVista): EtiquetaEnVista[] {
    const fun = estado.fundacion, radio = this.camara.enPantalla * 0.75;
    const clave = `${Math.round(x)},${Math.round(y)}:${radio}:${this.niebla.version}:${fun ? `${fun.centro.x.toFixed(1)},${fun.centro.y.toFixed(1)},${fun.radio}` : ''}`;
    if (clave === this.nodos.clave) return this.nodos.lista;
    const lista: EtiquetaEnVista[] = [];
    for (const n of this.o.mapa.nodos) {
      const enFundar = !!fun && Math.hypot(n.posicion.x - fun.centro.x, n.posicion.y - fun.centro.y) <= fun.radio;
      if (!enFundar && (Math.hypot(n.posicion.x - x, n.posicion.y - y) > radio || !this.niebla.exploradaEn(n.posicion.x, n.posicion.y))) continue;
      lista.push({ id: `nodo:${n.id}`, posicion: n.posicion, texto: RECURSO_NOMBRE[n.tipo] ?? n.tipo, tipo: 'nodo', color: enFundar ? '#f1d38b' : undefined });
    }
    this.nodos = { clave, lista };
    return lista;
  }

  destruir(): void {
    cancelAnimationFrame(this.fotograma);
    this.observador.disconnect();
    this.entrada.destruir();
    for (const f of this.columnas.values()) f.figuras.destruir();
    for (const l of this.lineas.children) (l as THREE.Line).geometry.dispose();
    this.matRuta.dispose();
    this.matRutaMia.dispose();
    this.matRutaFaccion.dispose();
    this.matRutaCaravana.dispose();
    this.matMira.dispose();
    this.marcas.destruir();
    this.etiquetas.destruir();
    this.rejilla.destruir();
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
