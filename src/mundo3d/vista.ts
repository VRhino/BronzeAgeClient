// La vista 3D del modo mundo: la escena, la cámara de juego, el suelo por teselas con la niebla, los árboles, los ríos y los nodos, las
// maquetas, las rayas (caminos, fronteras, zonas), las columnas y caravanas con sus rutas, las marcas (formaciones, Miradas, lo seleccionado,
// la vista previa de fundar) y los nombres. Pinta en su propio bucle de fotogramas y en cada uno pide el estado (`estado()`: la proyección del
// instante, ya convertida), así las columnas andan solas. Lo que hay que construir alrededor del héroe se hace poco a poco, con un
// presupuesto de tiempo por fotograma.
// Coordenadas de escena: x = x del mapa, z = y del mapa, y = altura en unidades (metros / 12).
import * as THREE from 'three';
import { registrarRenderer } from '../rendimiento';
import './mundo3d.css';
import { CamaraDeJuego, type Zoom } from './camara';
import { DISTANCIA_CARGA, MUNDO3D } from './config';
import { instalarEntrada, type Entrada } from './entrada';
import type { AedaEnVista, CaravanaEnVista, Carros, ColumnaEnVista, EstadoVista, EtiquetaEnVista, MundoEnVista } from './estado';
import { Etiquetas } from './etiquetas';
import { RejillaDeMovimiento, type Navegacion } from './rejilla';
import { FigurasDeColumna, Tropel, figurasDeAeda, type TropaDeColumna } from './figuras';
import type { FuenteDeAltura } from './fuente';
import { Agua, alturaVisible } from './agua';
import { Arboles } from './arboles';
import { Matas } from './matas';
import { Vida } from './vida';
import { aro, cinta, circulo, rutaPendiente, RutaEnSuelo } from './lineas';
import { Maquetas } from './maquetas';
import { Colisionador, fueraDeSolidos, HOLGURA_ARO, radioDeAlijo, radioDeAvanzada, radioDeBandidos, radioDeBatalla, radioDeCampamento, radioDeCampos, radioDeObra, radioDePlaza, radioDePueblo, rutaQueRodea, solidosDelMundo, type Solido } from './huellas';
import { MarcasEnSuelo } from './marcas';
import { NieblaDeGuerra } from './niebla';
import { Territorio } from './territorio';
import { CapaDeFertilidad } from './capaFertilidad';
import { Cielo, colorHorizonte } from './cielo';
import { Paisaje } from './paisaje';
import { Terreno, type SueloPintado } from './terreno';
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
  /** Un clic en el mundo: `punto`, donde cae (en el centro de lo que haya debajo, si hay algo); `centros`, los de todo lo que tiene debajo, del
   * más cercano al más lejano (con dos o más, el juego deja elegir). */
  alClicar: (punto: Punto, evento?: PointerEvent, centros?: Punto[]) => void;
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
/** Hasta dónde llegan, como mucho, los árboles y lo que va sobre el suelo (u) con la distancia de carga de serie; con otra, en proporción. Más
 * allá la bruma ya casi lo tapa todo. */
const ALCANCE = { arboles: 200, paisaje: 240, trazos: 240, matas: 48 };
/** Cada cuánto (fracción de la distancia de carga) se rehace la lista de lo que cae dentro: así no se rehacen las maquetas a cada paso. */
const PASO_CERCANO = 1 / 8;

export class VistaMundo3D {
  readonly lienzo = document.createElement('canvas');
  readonly camara = new CamaraDeJuego();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  private readonly sol = new THREE.DirectionalLight(0xfff0d8, 2.2);
  private readonly bruma: THREE.Fog;
  /** Hacia dónde está el sol (la luz que da sombra), desde el héroe. */
  private static readonly SOL = new THREE.Vector3(-60, 110, 45);
  private readonly cielo = new Cielo(VistaMundo3D.SOL);
  private readonly niebla = new NieblaDeGuerra();
  private readonly agua = new Agua(this.niebla);
  private readonly territorio: Territorio;
  private readonly fertilidad: CapaDeFertilidad;
  private readonly terreno: Terreno;
  private readonly paisaje: Paisaje;
  private readonly arboles: Arboles;
  private readonly matas: Matas;
  private readonly vida: Vida;
  private readonly maquetas: Maquetas;
  private readonly trazos: Trazos;
  private readonly marcas: MarcasEnSuelo;
  private readonly etiquetas: Etiquetas;
  private readonly rejilla: RejillaDeMovimiento;
  private readonly entrada: Entrada;
  private readonly columnas = new Map<string, { figuras: FigurasDeColumna; clave: string }>();
  private readonly tropel = new Tropel();
  private readonly figurasPuestas: FigurasDeColumna[] = [];
  private readonly lineas = new THREE.Group();
  private readonly matRuta = new THREE.LineBasicMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.85 });
  /** La ruta de la columna del jugador: punteada y más marcada que el rastro de las demás (Víctor, 2026-10-31); el aro del destino sigue entero. */
  private readonly matRutaMia = new THREE.LineDashedMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.9, dashSize: 0.35, gapSize: 0.25 });
  /** Las rutas de las demás columnas de la Facción y de las caravanas: un rastro discontinuo, más tenue el de las caravanas (como en el 2D). */
  private readonly matRutaFaccion = new THREE.LineDashedMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.6, dashSize: 0.6, gapSize: 0.4 });
  private readonly matRutaCaravana = new THREE.LineDashedMaterial({ color: 0xf1e6c8, transparent: true, opacity: 0.35, dashSize: 0.6, gapSize: 0.4 });
  /** Los nombres de los nodos cercanos ya explorados, y dónde y con qué niebla se calcularon. */
  private nodos: { clave: string; lista: EtiquetaEnVista[] } = { clave: '', lista: [] };
  /** Sin los nombres de los nodos (botón de capas): solo quedan los de la vista previa de fundar. */
  private sinNombresDeNodos = false;
  /** Hasta dónde se carga el mundo (u), el ajuste del jugador (`DISTANCIA_CARGA`). */
  private distanciaCarga: number = DISTANCIA_CARGA.porDefecto;
  /** Lo de `estado.mundo` que cae dentro de la distancia de carga, medido desde un centro que solo cambia cada `PASO_CERCANO`. */
  private cercano: { de: MundoEnVista | null; clave: string; mundo: MundoEnVista } | null = null;
  private readonly matMira = new THREE.MeshBasicMaterial({ color: 0xf1e6c8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  private readonly observador: ResizeObserver;
  /** La ruta de cada columna y caravana con su material (`id|material`), la mira bajo tu columna y el aro de tu destino, con lo que los hizo. */
  private readonly rutas = new Map<string, RutaEnSuelo>();
  private mira: THREE.Mesh | null = null;
  private claveMira = '';
  private destino: THREE.Line | null = null;
  private claveDestino = '';
  private fotograma = 0;
  private antes = performance.now();
  private pausada = false;
  /** El último estado pintado: con él se decide sobre qué cae un clic. */
  private ultimo: EstadoVista | null = null;
  /** Lo sólido cerca del héroe (`huellas.ts`) y de qué mundo y sitio se sacó; lo que se mueve se pinta por fuera (`Colisionador`). */
  private solidos: { mundo: MundoEnVista | null; x: number; y: number; lista: Solido[] } = { mundo: null, x: 0, y: 0, lista: [] };
  private readonly colision = new Colisionador();
  private sinNiebla: boolean;
  /** Lo que tarda cada parte del fotograma (ms, media móvil), para la pasada de rendimiento: `rendimiento()`. */
  private readonly tiempos: Record<string, number> = {};
  /** Lo que queda por construir alrededor del héroe (teselas de suelo y paisaje, trozos de árboles). */
  private readonly faltan = { terreno: 0, paisaje: 0, arboles: 0, matas: 0 };
  /** Dónde y con qué se miró por última vez cada parte (`hayQueMirar`). */
  private readonly mirado: Partial<Record<keyof VistaMundo3D['faltan'], { x: number; y: number; clave: string }>> = {};
  private objetivo = new THREE.Vector3();
  /** Adónde mira la cámara de verdad: persigue a `objetivo` con un muelle amortiguado, para que siga a la columna sin tirones aunque su
   * posición llegue a saltos (la proyección del instante se rehace cada 33 ms, el relieve cambia de pendiente, el servidor corrige). */
  private foco: THREE.Vector3 | null = null;
  private rayo = new THREE.Raycaster();

  constructor(private readonly contenedor: HTMLElement, private readonly o: OpcionesVista) {
    this.sinNiebla = o.sinNiebla ?? false;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true });
    registrarRenderer('mundo', this.renderer); // para el panel de rendimiento (F3)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // en una pantalla retina, 2 sombrearía cada píxel cuatro veces
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.lienzo.className = 'mundo3d-lienzo';
    this.lienzo.tabIndex = 0;
    this.lienzo.setAttribute('aria-label', 'El mundo alrededor de tu héroe. Arrastra para girar la cámara, la rueda acerca y aleja, y un clic en el terreno manda tu columna.');
    contenedor.appendChild(this.lienzo);

    // el cielo, y la bruma lejana del color de su horizonte: el suelo se funde con él a lo lejos
    const horizonte = colorHorizonte();
    this.escena.background = horizonte;
    this.bruma = new THREE.Fog(horizonte, 60, 200);
    this.escena.add(this.cielo.malla);
    this.escena.fog = this.bruma;
    this.escena.add(new THREE.HemisphereLight(0xdfe9f0, 0x6b5a40, 1.4));
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    this.escena.add(this.sol, this.sol.target);

    this.territorio = new Territorio();
    this.fertilidad = new CapaDeFertilidad(o.mapa);
    this.terreno = new Terreno(o.fuente, o.mapa, this.niebla, this.agua.mar, this.territorio, this.fertilidad);
    this.paisaje = new Paisaje(o.fuente, o.mapa, this.niebla, this.suelo, this.agua.rio);
    this.arboles = new Arboles(o.fuente, o.mapa, this.niebla, this.suelo);
    this.matas = new Matas(o.fuente, o.mapa, this.niebla, this.suelo);
    this.vida = new Vida(this.niebla, this.suelo);
    this.maquetas = new Maquetas(this.niebla, this.suelo);
    this.trazos = new Trazos(this.niebla, this.suelo);
    this.marcas = new MarcasEnSuelo(this.suelo);
    this.etiquetas = new Etiquetas(contenedor, (punto) => this.o.alClicar(punto));
    this.rejilla = new RejillaDeMovimiento(this.suelo);
    this.escena.add(this.terreno.grupo, this.paisaje.grupo, this.arboles.grupo, this.matas.grupo, this.vida.grupo, this.maquetas.grupo, this.trazos.grupo, this.marcas.grupo, this.lineas, this.rejilla.grupo, this.tropel.grupo);
    this.entrada = instalarEntrada(this.lienzo, this.camara, (e) => this.clic(e), () => {}); // el zoom se lee de la cámara en cada fotograma
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(contenedor);
    this.ajustar();
    this.fotograma = requestAnimationFrame((t) => this.bucle(t));
  }

  /** La altura del relieve en (x, y), en u: la del suelo, o la de la lámina donde hay agua. */
  private readonly alturaRelieve = (x: number, y: number): number => alturaVisible(this.o.fuente.alturaEn(x, y), this.o.fuente.aguaEn(x, y));
  /** La altura que se ve en (x, y), en u: la del suelo tal como se pinta (lejos la malla va más basta que el relieve y junto al agua baja hacia
   * ella) o la de la lámina donde hay agua. Todo lo que va encima se pone ahí, y el clic se queda ahí; donde aún no hay tesela, el relieve. */
  readonly alturaU = (x: number, y: number): number => this.terreno.alturaPintada(x, y) ?? this.alturaRelieve(x, y);
  /** El suelo pintado para lo que se pone encima: su altura y lo que firma lo de debajo, para recolocarse cuando cambia (`SueloPintado`). */
  private readonly suelo: SueloPintado = ((v: VistaMundo3D): SueloPintado => ({
    alturaU: v.alturaU,
    firma: (x0, y0, x1, y1) => v.terreno.firma(x0, y0, x1, y1),
    get version() { return v.terreno.version; },
  }))(this);

  zoom(z: Zoom): void {
    this.camara.zoom = z;
  }

  /** Un paso de zoom (los botones + y −): −1 acerca, 1 aleja. */
  pasoDeZoom(sentido: -1 | 1): void {
    this.camara.pasoDeZoom(sentido);
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
  cuentas(): { arboles: number; matas: number; maquetas: number; trazos: number; faltan: { terreno: number; paisaje: number; arboles: number; matas: number } } {
    let maquetas = 0;
    for (const m of this.maquetas.grupo.children) maquetas += (m as THREE.InstancedMesh).count;
    return { arboles: this.arboles.cuantos, matas: this.matas.cuantas, maquetas, trazos: this.trazos.grupo.children.length, faltan: { ...this.faltan } };
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
    if (!p) return;
    const centros = this.iman(p);
    this.o.alClicar(centros[0] ?? p, evento, centros);
  }

  /** Un clic cerca de algo que se puede seleccionar cae en su centro: su zona de clic es lo que ocupa su maqueta, y como poco
   * `MIN_PX_CLIC` píxeles de pantalla (`main.ts` busca luego qué hay en ese punto con su propio radio, que en 3D es pequeño). Devuelve los
   * centros de todo lo que tiene el clic en su zona, del más cercano al más lejano (vacío: suelo). La columna propia no atrae: un clic a su lado
   * es una marcha. */
  private iman(p: Punto): Punto[] {
    const e = this.ultimo;
    if (!e) return [];
    const minimo = MIN_PX_CLIC / Math.max(1, this.camara.pxPorUnidad(this.lienzo.clientHeight || 1));
    // la zona de clic de cada maqueta es lo que ocupa (`huellas.ts`); la aldea, con sus campos
    const m = e.mundo, candidatos: { posicion: Punto; radio: number }[] = [
      ...m.plazas.map((x) => ({ posicion: x.posicion, radio: radioDePlaza(x.radioCiudad, x.nivel) + HOLGURA_ARO })),
      ...m.pueblos.map((x) => ({ posicion: x.posicion, radio: x.aldea ? radioDeCampos() : radioDePueblo(false) + HOLGURA_ARO })),
      ...m.avanzadas.map((x) => ({ posicion: x.posicion, radio: radioDeAvanzada(x.etapa) + HOLGURA_ARO })),
      ...m.obras.map((x) => ({ posicion: x.posicion, radio: radioDeObra() + HOLGURA_ARO })),
      ...m.campamentos.map((x) => ({ posicion: x.posicion, radio: radioDeCampamento() + HOLGURA_ARO })),
      ...m.bandidos.map((x) => ({ posicion: x.posicion, radio: radioDeBandidos() + HOLGURA_ARO })),
      ...m.alijos.map((x) => ({ posicion: x.posicion, radio: radioDeAlijo() + HOLGURA_ARO })),
      ...m.batallas.map((x) => ({ posicion: x.posicion, radio: radioDeBatalla() + HOLGURA_ARO })),
      ...e.columnas.filter((c) => !c.mia).map((c) => ({ posicion: c.posicion, radio: 0.8 })),
      ...e.caravanas.map((c) => ({ posicion: c.posicion, radio: 0.7 })),
      ...(e.aedas ?? []).map((a) => ({ posicion: a.posicion, radio: 0.5 })),
    ];
    return candidatos
      .map((c) => ({ c, d: Math.hypot(c.posicion.x - p.x, c.posicion.y - p.y) }))
      .filter(({ c, d }) => d <= Math.max(c.radio, minimo))
      .sort((a, b) => a.d - b.d)
      .map(({ c }) => ({ x: c.posicion.x, y: c.posicion.y }));
  }

  /** Lo sólido a menos de la distancia de carga del héroe; se rehace al cambiar el mundo o al moverse el héroe 8 u. */
  private solidosCerca(e: EstadoVista): Solido[] {
    const h = e.heroe!, s = this.solidos;
    if (s.mundo !== e.mundo || Math.hypot(h.x - s.x, h.y - s.y) > 8) {
      const lejos = this.distanciaCarga + 10;
      this.solidos = { mundo: e.mundo, x: h.x, y: h.y, lista: solidosDelMundo(e.mundo).filter((q) => Math.hypot(q.x - h.x, q.y - h.y) < lejos + q.r) };
    }
    return this.solidos.lista;
  }

  /** El estado con lo que se mueve fuera de lo sólido (columnas, caravanas y Aedas, sus rutas, sus carteles, su aro y la cámara): solo se
   * pinta así, el servidor sigue con su sitio. */
  private colisionar(e: EstadoVista): EstadoVista {
    const sol = this.solidosCerca(e);
    if (!sol.length) return e;
    this.colision.empezar();
    const movidos: { de: Punto; a: Punto; cartel: string }[] = [];
    const mover = (clave: string, cartel: string, p: Punto): Punto => {
      const q = this.colision.mover(clave, p, sol);
      if (q !== p) movidos.push({ de: p, a: q, cartel });
      return q;
    };
    const ruta = (r: Punto[], de: Punto, a: Punto): Punto[] => {
      if (r.length < 2) return r;
      const out = rutaQueRodea(r, sol);
      if (r[0]!.x === de.x && r[0]!.y === de.y) out[0] = a;
      return out;
    };
    let heroe = e.heroe;
    const columnas = e.columnas.map((c) => {
      const q = mover(`c:${c.id}`, `columna:${c.id}`, c.posicion);
      if (c.mia && heroe && heroe.x === c.posicion.x && heroe.y === c.posicion.y) heroe = q;
      return { ...c, posicion: q, ruta: ruta(c.ruta, c.posicion, q) };
    });
    const caravanas = e.caravanas.map((c) => {
      const q = mover(`v:${c.id}`, `caravana:${c.id}`, c.posicion);
      return { ...c, posicion: q, ruta: ruta(c.ruta, c.posicion, q) };
    });
    const aedas = e.aedas?.map((a) => ({ ...a, posicion: mover(`a:${a.id}`, `aeda:${a.id}`, a.posicion) }));
    if (!movidos.length) return { ...e, columnas, caravanas, aedas };
    const porCartel = new Map(movidos.map((m) => [m.cartel, m.a]));
    const etiquetas = e.etiquetas.map((x) => { const a = porCartel.get(x.id); return a ? { ...x, posicion: a } : x; });
    const sel = e.seleccion, deSel = sel && movidos.find((m) => m.de.x === sel.posicion.x && m.de.y === sel.posicion.y);
    return { ...e, heroe, columnas, caravanas, aedas, etiquetas, seleccion: deSel ? { ...sel, posicion: deSel.a } : sel };
  }

  /** Adónde se marcha de verdad al pulsar `p` (Víctor, 2026-11-07: «al darle clic y moverse se queden al borde»): si cae dentro de una plaza,
   * un pueblo, una aldea o una avanzada, a su borde por el lado de la columna; si no, `p`. */
  destinoAlBorde(p: Punto): Punto {
    const e = this.ultimo;
    if (!e?.heroe) return p;
    return fueraDeSolidos(p, solidosDelMundo(e.mundo), e.heroe);
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
    const crudo = this.o.estado();
    t = this.medir('estado', t);
    if (!crudo?.heroe) return;
    const estado = this.colisionar(crudo);
    if (!estado.heroe) return;
    this.ultimo = estado;
    this.entrada.teclas(dt);
    this.niebla.actualizar(estado.niebla, this.sinNiebla);
    this.camara.radioVision = estado.radioVision;
    const w = this.lienzo.clientWidth || 1, h = this.lienzo.clientHeight || 1, { x, y } = estado.heroe;
    this.territorio.actualizar(estado.mundo.territorios, x, y);
    this.objetivo.set(x, this.alturaU(x, y), y);
    // Un salto grande (otra columna, entrar al mundo) se corta; lo demás se sigue suave.
    if (!this.foco || this.foco.distanceTo(this.objetivo) > MUNDO3D.camaraSuave.corte) this.foco = this.objetivo.clone();
    else this.foco.lerp(this.objetivo, 1 - Math.exp(-dt * MUNDO3D.camaraSuave.seguir));
    this.camara.colocar(this.foco, w / h, (cx, cz) => this.alturaU(cx, cz), dt);
    this.o.alCambiarEscala?.(this.camara.pxPorUnidad(h));
    // el suelo hasta donde llega la vista (con la cámara baja, hasta la bruma)
    // Hasta dónde se carga: lo que pide la cámara, sin pasar de la distancia de carga. La bruma acaba justo ahí: no se ve el borde.
    const d = this.camara.distancia, carga = this.distanciaCarga, k = carga / DISTANCIA_CARGA.porDefecto;
    const alcance = Math.min(carga, d * 7), hasta = performance.now() + PRESUPUESTO;
    this.bruma.far = alcance;
    this.bruma.near = Math.min(d * 2.2, alcance * 0.4);
    const hastaTrazos = Math.min(alcance, ALCANCE.trazos * k);
    t = this.medir('camara', t);
    this.terreno.escalaDetalle = Math.min(1, k);
    if (this.hayQueMirar('terreno', x, y, `${alcance}|${k}`)) this.faltan.terreno = this.terreno.actualizar(x, y, alcance, hasta);
    t = this.medir('terreno', t);
    const cerca = this.mundoCercano(estado.mundo, x, y);
    this.maquetas.actualizar(cerca);
    this.trazos.actualizar(estado.mundo.trazos, x, y, hastaTrazos);
    t = this.medir('maquetasYTrazos', t);
    const despejes = `${this.maquetas.claveClaros}|${this.trazos.claveCaminos}`;
    this.arboles.fijarDespejes(this.maquetas.claros, this.trazos.caminos, despejes);
    this.matas.fijarDespejes(this.maquetas.claros, this.trazos.caminos, despejes);
    const suelo = this.terreno.version;
    if (this.hayQueMirar('paisaje', x, y, `${alcance}|${k}|${suelo}`)) this.faltan.paisaje = this.paisaje.actualizar(x, y, Math.min(alcance, ALCANCE.paisaje * k), hasta);
    t = this.medir('paisaje', t);
    if (this.hayQueMirar('arboles', x, y, `${alcance}|${k}|${despejes}|${suelo}`)) this.faltan.arboles = this.arboles.actualizar(x, y, Math.min(alcance, ALCANCE.arboles * k), hasta);
    t = this.medir('arboles', t);
    if (this.hayQueMirar('matas', x, y, `${alcance}|${k}|${despejes}|${suelo}`)) this.faltan.matas = this.matas.actualizar(x, y, Math.min(alcance, ALCANCE.matas * Math.min(1, k)), hasta);
    t = this.medir('matas', t);
    this.vida.actualizar(cerca, x, y, ahora / 1000);
    t = this.medir('vida', t);
    const dentro = (p: Punto) => Math.hypot(p.x - x, p.y - y) <= carga;
    const columnas = estado.columnas.filter((c) => c.mia || dentro(c.posicion)), caravanas = estado.caravanas.filter((c) => dentro(c.posicion));
    this.ponerColumnas(columnas, caravanas, (estado.aedas ?? []).filter((a) => dentro(a.posicion)));
    this.ponerLineas(columnas, caravanas, estado.heroe, hastaTrazos);
    this.marcas.actualizar(estado, ahora);
    this.rejilla.actualizar(x, y);
    t = this.medir('columnasYMarcas', t);
    this.etiquetas.actualizar([...estado.etiquetas.filter((e) => dentro(e.posicion)), ...this.etiquetasDeNodos(x, y, estado)], this.camara.camara, w, h, this.alturaU, estado.heroe, (this.bruma.near + this.bruma.far) / 2);
    t = this.medir('etiquetas', t);
    // la sombra sigue al héroe y cubre lo que se ve
    const r = Math.min(120, Math.max(20, d * 1.6));
    this.sol.position.set(x + VistaMundo3D.SOL.x, this.objetivo.y + VistaMundo3D.SOL.y, y + VistaMundo3D.SOL.z);
    this.sol.target.position.copy(this.objetivo);
    const sc = this.sol.shadow.camera;
    if (sc.right !== r) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 600; sc.updateProjectionMatrix(); }
    this.cielo.actualizar(this.camara.camara, ahora);
    this.agua.actualizar(ahora / 1000);
    this.matas.mover(ahora / 1000);
    this.arboles.mover(ahora / 1000);
    this.niebla.mover(ahora / 1000);
    this.renderer.render(this.escena, this.camara.camara);
    this.medir('render', t);
    this.medir('total', inicio);
  }

  /** ¿Hay que mirar qué trozos de `parte` faltan o sobran? Hacer la lista reserva memoria (cientos de trozos con su clave) y era en cada
   * fotograma: no hace falta si no falta nada, el héroe no se ha movido ni un cuarto de unidad y no cambió nada más de lo que la decide
   * (`clave`: el alcance, la distancia de carga, los claros y caminos). */
  private hayQueMirar(parte: keyof typeof this.faltan, x: number, y: number, clave: string): boolean {
    const u = this.mirado[parte];
    if (u && !this.faltan[parte] && Math.abs(x - u.x) < 0.25 && Math.abs(y - u.y) < 0.25 && u.clave === clave) return false;
    this.mirado[parte] = { x, y, clave };
    return true;
  }

  /** Las figuras de cada columna (de la Facción y avistadas) y de cada caravana suelta; se rehacen si cambia lo que llevan o su color. */
  private ponerColumnas(lista: readonly ColumnaEnVista[], caravanas: readonly CaravanaEnVista[], aedas: readonly AedaEnVista[] = []): void {
    const vivas = new Set<string>();
    const poner = (id: string, jinetes: number, tropa: TropaDeColumna, color: string, carros: Carros, posicion: Punto) => {
      vivas.add(id);
      const hex = new THREE.Color(color).getHex();
      const clave = `${jinetes}:${tropa.ejercito ? 'E' : 'P'}${tropa.porHeroe.join(',')}:${hex}:${carros.carga}:${carros.fundacion}:${carros.propio ? 'p' : ''}:${carros.animales?.join(',') ?? ''}`;
      let f = this.columnas.get(id);
      if (!f || f.clave !== clave) {
        f = { figuras: new FigurasDeColumna(jinetes, tropa, hex, carros), clave };
        this.columnas.set(id, f);
      }
      f.figuras.mover(posicion, this.alturaU, this.terreno.version);
    };
    for (const c of lista) poner(c.id, c.jinetes, c.tropa, c.color, c.carros, c.posicion);
    // una caravana suelta: su escolta delante y detrás sus carros, uno por animal (sin animales, uno con buey)
    for (const c of caravanas) {
      const tropa = c.escolta ? { porHeroe: [c.escolta], ejercito: false } : SIN_TROPA;
      const carros: Carros = c.fundacion ? { carga: 0, fundacion: true } : { carga: Math.max(1, c.animales?.length ?? 0), fundacion: false, ...(c.animales ? { animales: c.animales } : {}) };
      poner(`caravana:${c.id}`, 0, tropa, c.color, carros, c.posicion);
    }
    // un Aeda de camino: él a pie y su burro detrás
    for (const a of aedas) {
      const id = `aeda:${a.id}`;
      vivas.add(id);
      let f = this.columnas.get(id);
      if (!f) this.columnas.set(id, (f = { figuras: figurasDeAeda(), clave: 'aeda' }));
      f.figuras.mover(a.posicion, this.alturaU, this.terreno.version);
    }
    for (const id of this.columnas.keys()) if (!vivas.has(id)) this.columnas.delete(id);
    this.figurasPuestas.length = 0;
    for (const c of this.columnas.values()) this.figurasPuestas.push(c.figuras);
    this.tropel.pintar(this.figurasPuestas);
  }

  /** Bajo la columna del jugador, un aro en el suelo (la mira del 2D: entre los árboles se pierde), su ruta y el aro de su destino; las demás
   * de la Facción y las caravanas propias, su rastro discontinuo. Cada ruta se muestrea una vez y se va acortando por delante (`RutaEnSuelo`);
   * la mira se rehace cuando la columna avanza un poco y el aro, cuando cambia el destino. Las rutas de lo que está más allá de lo que se
   * carga no se pintan (la bruma las tapa). */
  private ponerLineas(lista: readonly ColumnaEnVista[], caravanas: readonly CaravanaEnVista[], heroe: Punto, alcance: number): void {
    const vivas = new Set<string>();
    const ruta = (id: string, puntos: readonly Punto[], posicion: Punto, material: THREE.LineBasicMaterial): void => {
      if (puntos.length < 2 || Math.hypot(posicion.x - heroe.x, posicion.y - heroe.y) > alcance) return;
      const pendiente = rutaPendiente(puntos, posicion);
      if (pendiente.length < 2) return;
      const clave = `${id}|${material.uuid}`;
      vivas.add(clave);
      let r = this.rutas.get(clave);
      if (!r) { r = new RutaEnSuelo(material, this.alturaU); this.rutas.set(clave, r); this.lineas.add(r.grupo); }
      r.fijar(pendiente, this.terreno.version);
    };
    let mira: Punto | null = null, destino: Punto | null = null;
    for (const c of lista) {
      if (!c.propia) continue;
      if (c.mia) { mira = c.posicion; if (c.ruta.length >= 2) destino = c.ruta[c.ruta.length - 1]!; }
      ruta(c.id, c.ruta, c.posicion, c.mia ? this.matRutaMia : this.matRutaFaccion);
    }
    for (const c of caravanas) ruta(`caravana:${c.id}`, c.ruta, c.posicion, this.matRutaCaravana);
    for (const [clave, r] of this.rutas) if (!vivas.has(clave)) { r.destruir(); this.rutas.delete(clave); }
    // la mira bajo tu columna y el aro de tu destino
    const claveMira = mira ? `${mira.x.toFixed(1)},${mira.y.toFixed(1)}|${this.terreno.version}` : '';
    if (claveMira !== this.claveMira) {
      this.claveMira = claveMira;
      this.mira?.geometry.dispose();
      this.mira?.removeFromParent();
      const g = mira ? cinta(circulo(mira, 0.45, 32), this.alturaU, 0.05, { dy: 0.06, paso: 0.1 }) : null;
      this.mira = g ? new THREE.Mesh(g, this.matMira) : null;
      if (this.mira) this.lineas.add(this.mira);
    }
    const claveDestino = destino ? `${destino.x},${destino.y}|${this.terreno.version}` : '';
    if (claveDestino !== this.claveDestino) {
      this.claveDestino = claveDestino;
      this.destino?.geometry.dispose();
      this.destino?.removeFromParent();
      this.destino = destino ? aro(destino, 0.5, this.alturaU, this.matRuta) : null;
      if (this.destino) this.lineas.add(this.destino);
    }
  }

  /** Hasta dónde se carga el mundo alrededor del héroe (u, entre `DISTANCIA_CARGA.min` y `.max`): el ajuste del botón de capas. */
  fijarDistanciaDeCarga(u: number): void {
    this.distanciaCarga = Math.min(DISTANCIA_CARGA.max, Math.max(DISTANCIA_CARGA.min, u));
    this.cercano = null;
  }

  /** Las maquetas que caen dentro de la distancia de carga (con medio paso de holgura), medidas desde el héroe redondeado a `PASO_CERCANO`: la
   * lista, y con ella las maquetas, solo cambia cuando el héroe ha andado un trecho o cambia el mundo. */
  private mundoCercano(m: MundoEnVista, x: number, y: number): MundoEnVista {
    const paso = this.distanciaCarga * PASO_CERCANO, cx = Math.round(x / paso) * paso, cy = Math.round(y / paso) * paso;
    const clave = `${cx},${cy},${this.distanciaCarga}`;
    if (this.cercano && this.cercano.de === m && this.cercano.clave === clave) return this.cercano.mundo;
    const r = this.distanciaCarga + paso, dentro = (p: Punto) => Math.hypot(p.x - cx, p.y - cy) <= r;
    const mundo: MundoEnVista = {
      plazas: m.plazas.filter((p) => dentro(p.posicion)), pueblos: m.pueblos.filter((p) => dentro(p.posicion)),
      avanzadas: m.avanzadas.filter((p) => dentro(p.posicion)), obras: m.obras.filter((p) => dentro(p.posicion)),
      campamentos: m.campamentos.filter((p) => dentro(p.posicion)), bandidos: m.bandidos.filter((p) => dentro(p.posicion)),
      alijos: m.alijos.filter((p) => dentro(p.posicion)), batallas: m.batallas.filter((p) => dentro(p.posicion)), trazos: m.trazos, territorios: m.territorios,
    };
    this.cercano = { de: m, clave, mundo };
    return mundo;
  }

  /** Pone o quita la capa de fertilidad del suelo (botón de capas); `minima`, la fertilidad desde la que cabe una aldea. */
  fijarFertilidad(si: boolean, minima: number): void {
    this.fertilidad.fijar(si, minima);
  }

  /** Pone o quita los nombres de los nodos (botón de capas). Quitados, la vista previa de fundar sigue nombrando los de su zona. */
  fijarNombresDeNodos(si: boolean): void {
    this.sinNombresDeNodos = !si;
  }

  /** Los nombres de los nodos de recursos que caben en pantalla y ya se exploraron; con la vista previa de fundar, los de dentro de su zona
   * (resaltados). Se recalculan cuando el héroe se mueve, cambia la niebla o la vista previa. */
  private etiquetasDeNodos(x: number, y: number, estado: EstadoVista): EtiquetaEnVista[] {
    const fun = estado.fundacion, radio = this.camara.enPantalla * 0.75, sin = this.sinNombresDeNodos;
    if (sin && !fun) return [];
    const clave = `${Math.round(x)},${Math.round(y)}:${radio}:${this.niebla.version}:${sin}:${fun ? `${fun.centro.x.toFixed(1)},${fun.centro.y.toFixed(1)},${fun.radio}` : ''}`;
    if (clave === this.nodos.clave) return this.nodos.lista;
    const lista: EtiquetaEnVista[] = [];
    for (const n of this.o.mapa.nodos) {
      const enFundar = !!fun && Math.hypot(n.posicion.x - fun.centro.x, n.posicion.y - fun.centro.y) <= fun.radio;
      if (!enFundar && (sin || Math.hypot(n.posicion.x - x, n.posicion.y - y) > radio || !this.niebla.exploradaEn(n.posicion.x, n.posicion.y))) continue;
      lista.push({ id: `nodo:${n.id}`, posicion: n.posicion, texto: RECURSO_NOMBRE[n.tipo] ?? n.tipo, tipo: 'nodo', color: enFundar ? '#f1d38b' : undefined });
    }
    this.nodos = { clave, lista };
    return lista;
  }

  destruir(): void {
    cancelAnimationFrame(this.fotograma);
    this.observador.disconnect();
    this.entrada.destruir();
    this.tropel.destruir();
    for (const r of this.rutas.values()) r.destruir();
    this.mira?.geometry.dispose();
    this.destino?.geometry.dispose();
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
    this.matas.destruir();
    this.vida.destruir();
    this.maquetas.destruir();
    this.trazos.destruir();
    this.niebla.destruir();
    this.territorio.destruir();
    this.fertilidad.destruir();
    this.cielo.destruir();
    this.agua.destruir();
    this.renderer.dispose();
    this.lienzo.remove();
  }
}
