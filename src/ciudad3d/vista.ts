// La vista 3D de la plaza (sustituye a la vista de trazado en 2D, que queda de minimapa; Víctor, 2026-11-02). La escena: el cielo y la luz del
// mundo 3D, el suelo pintado, los edificios hechos en código dentro de sus huellas, las murallas y el relleno de las celdas libres; la cámara
// que orbita, se desplaza y se acerca; el clic que elige un edificio y su resalte; los rótulos de las obras con su cuenta atrás.
// Coordenadas de escena: x = x local del trazado, z = y local, y = altura; todo en ul (1 ul = 3 m).
import * as THREE from 'three';
import { registrarRenderer } from '../rendimiento';
import './ciudad3d.css';
import { Cielo, colorHorizonte } from '../mundo3d/cielo';
import { Calzada } from './calzada';
import { CamaraDeCiudad } from './camara';
import { CIUDAD3D, COLOR } from './config';
import { instalarEntrada, type EntradaDeCiudad } from './entrada';
import { edificioEn, type CiudadEnVista, type ClaseCelda, type EdificioEnVista } from './estado';
import { montarEdificio } from './modelos';
import { idDeCeldaDeMuro, montarMurallas } from './murallas';
import { MallasDePiezas, Piezas } from './piezas';
import { montarRelleno } from './relleno';
import { Suelo } from './suelo';

type Punto = { x: number; y: number };

/** Una celda de muralla elegida o señalada: su recinto, su clase y cómo está. */
export interface MurallaElegida {
  recintoId: string;
  clase: ClaseCelda;
  nivel: number;
  enPie: boolean;
}

/** Lo que hay bajo el ratón: un edificio o la muralla. */
type Elegido = { edificio: string } | { muralla: MurallaElegida };

export interface OpcionesCiudad3D {
  /** El color del terreno donde está la plaza (sRGB); sin él, un llano verde. */
  sueloBase?: number;
  /** Se eligió un edificio con un clic (o nada: `null`). */
  alElegir: (id: string | null) => void;
  /** El ratón pasa por encima de un edificio (o de nada), para el rótulo flotante. */
  alPasar?: (id: string | null, evento: PointerEvent | null) => void;
  /** Se eligió la muralla (una celda de muro, puerta o torre) con un clic. Sin esto, la muralla no se elige ni se señala. */
  alElegirMuralla?: (m: MurallaElegida) => void;
  /** El ratón pasa por encima de la muralla (o deja de pasar: `null`), para el rótulo flotante. */
  alPasarMuralla?: (m: MurallaElegida | null, evento: PointerEvent | null) => void;
  /** Lo que se ve cambió: las cuatro esquinas sobre el suelo, en ul (el minimapa lo dibuja). */
  alMover?: (huella: Punto[]) => void;
  /** El texto del rótulo de un edificio en obra (su cuenta atrás); `null`, sin rótulo. */
  rotulo?: (e: EdificioEnVista) => string | null;
}

/** El sol, desde lo que mira la cámara. */
const SOL = new THREE.Vector3(-70, 120, 50);

export class VistaCiudad3D {
  readonly lienzo = document.createElement('canvas');
  readonly camara = new CamaraDeCiudad();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  private readonly sol = new THREE.DirectionalLight(0xfff0d8, 2.3);
  private readonly bruma: THREE.Fog;
  private readonly cielo = new Cielo(SOL);
  private readonly suelo: Suelo;
  private readonly calzada: Calzada;
  private readonly lejano: THREE.Mesh;
  private readonly material = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  private readonly matResalte = new THREE.MeshBasicMaterial({ color: COLOR.seleccion });
  private readonly matResalteTenue = new THREE.MeshBasicMaterial({ color: COLOR.seleccion, transparent: true, opacity: 0.5 });
  private readonly resalte = new THREE.Group();
  private readonly capaRotulos = document.createElement('div');
  private readonly rotulos = new Map<string, HTMLElement>();
  private readonly entrada: EntradaDeCiudad;
  private readonly observador: ResizeObserver;
  private readonly rayo = new THREE.Raycaster();
  private edificios: MallasDePiezas | null = null;
  private murallas: MallasDePiezas | null = null;
  private relleno: MallasDePiezas | null = null;
  private claves = { edificios: '', murallas: '', relleno: '', seleccion: '', huella: '' };
  private ciudad: CiudadEnVista | null = null;
  private seleccion: { id: string; tipo: string } | null = null;
  private base: number;
  private pasando: PointerEvent | null = null;
  private pasandoClase: 'edificio' | 'muralla' | null = null;
  private fotograma = 0;
  private antes = performance.now();
  private pausada = false;
  private primera = true;
  private readonly tiempos: Record<string, number> = {};

  constructor(private readonly contenedor: HTMLElement, private readonly o: OpcionesCiudad3D) {
    this.base = o.sueloBase ?? 0x93b26b;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true });
    registrarRenderer('plaza', this.renderer); // para el panel de rendimiento (F3)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.lienzo.className = 'ciudad3d-lienzo';
    this.lienzo.tabIndex = 0;
    this.lienzo.setAttribute('aria-label', 'Tu plaza en 3D. Arrastra para moverte, con el botón derecho o Mayúsculas para girar, la rueda acerca y aleja; un clic elige un edificio.');
    contenedor.appendChild(this.lienzo);
    this.capaRotulos.className = 'ciudad3d-rotulos';
    contenedor.appendChild(this.capaRotulos);

    const horizonte = colorHorizonte();
    this.escena.background = horizonte;
    this.bruma = new THREE.Fog(horizonte, 200, 900);
    this.escena.fog = this.bruma;
    this.escena.add(this.cielo.malla);
    this.escena.add(new THREE.HemisphereLight(0xdfe9f0, 0x6b5a40, 1.35));
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0005;
    this.sol.shadow.normalBias = 0.04;
    this.escena.add(this.sol, this.sol.target);

    this.suelo = new Suelo(this.renderer.capabilities.getMaxAnisotropy());
    this.calzada = new Calzada(this.renderer.capabilities.getMaxAnisotropy());
    // más allá del suelo pintado, un llano del mismo color hasta la bruma
    this.lejano = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: new THREE.Color().setHex(this.base, THREE.SRGBColorSpace) }));
    this.lejano.rotation.x = -Math.PI / 2;
    this.lejano.position.y = -0.03;
    this.lejano.receiveShadow = true;
    this.escena.add(this.lejano, this.suelo.malla, this.calzada.malla, this.resalte);

    this.entrada = instalarEntrada(this.lienzo, this.camara, { alClicar: (e) => this.clic(e), alPasar: (e) => { this.pasando = e; if (!e) this.avisarPaso(null, null); } });
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(contenedor);
    this.ajustar();
    this.fotograma = requestAnimationFrame((t) => this.bucle(t));
  }

  /** Lo que se dibuja ahora. */
  ciudadActual(): CiudadEnVista | null {
    return this.ciudad;
  }

  /** La ciudad que se dibuja. Solo se rehace lo que cambió (los edificios, la muralla, el relleno, el suelo). */
  fijar(c: CiudadEnVista | null): void {
    this.ciudad = c;
    if (!c) return;
    const t0 = performance.now();
    if (this.primera) { this.camara.ajustar(c.radio, c.extension, true, c.nucleo); this.primera = false; }
    else this.camara.ajustar(c.radio, c.extension, false);
    const paso = (a: number | null): number => (a === null ? -1 : Math.floor(a / CIUDAD3D.pasoObra));
    const ce = c.edificios.map((e) => `${e.id}:${e.tipo}:${e.estado}:${e.x},${e.y},${e.ancho},${e.alto}:${e.estilo}:${e.danado}:${e.mejora}:${paso(e.estado === 'en_construccion' ? e.avance : null)}`).join('|');
    if (ce !== this.claves.edificios) {
      this.claves.edificios = ce;
      const p = new Piezas();
      for (const e of c.edificios) montarEdificio(p, e);
      this.edificios = this.cambiar(this.edificios, p);
    }
    const cm = c.recintos.map((r) => `${r.id}:${r.cerrado}:${r.mejorandoA}:${r.celdas.map((k) => `${k.x},${k.y},${k.clase[0]}${k.enPie ? k.nivel : 0}`).join(';')}`).join('|');
    if (cm !== this.claves.murallas) {
      this.claves.murallas = cm;
      const p = new Piezas();
      montarMurallas(p, c.recintos);
      this.murallas = this.cambiar(this.murallas, p);
    }
    const cr = `${c.id}:${c.nivel}:${c.radio}:${c.extension}:${c.libres.map((r) => `${r.x},${r.y}${r.tipo[0]}`).join(';')}:${cm.length}:${ce.length}:${c.red.length}`;
    if (cr !== this.claves.relleno) {
      this.claves.relleno = cr;
      const p = new Piezas();
      montarRelleno(p, c, Math.max(1, Math.min(5, c.nivel)));
      this.relleno = this.cambiar(this.relleno, p);
    }
    this.suelo.actualizar(c, this.base);
    this.calzada.actualizar(c);
    this.claves.seleccion = '';
    this.medir('fijar', t0);
  }

  /** El color del terreno de la plaza (cuando llega el mapa). */
  fijarSuelo(base: number): void {
    if (base === this.base) return;
    this.base = base;
    (this.lejano.material as THREE.MeshLambertMaterial).color.setHex(base, THREE.SRGBColorSpace);
    if (this.ciudad) this.suelo.actualizar(this.ciudad, base);
  }

  /** El edificio elegido (resaltado fuerte) y los demás de su tipo (resaltado tenue). */
  seleccionar(s: { id: string; tipo: string } | null): void {
    this.seleccion = s;
  }

  /** Mira a un punto de la plaza (ul), p. ej. desde el minimapa. */
  centrar(p: Punto): void {
    this.camara.centrar(p);
  }

  /** Mira a un edificio y se acerca a él. */
  enfocar(id: string): void {
    const e = this.ciudad?.edificios.find((x) => x.id === id);
    if (!e) return;
    this.camara.centrar({ x: e.x + e.ancho / 2, y: e.y + e.alto / 2 });
    if (this.camara.distancia > 40) this.camara.acercar(40 / this.camara.distancia);
  }

  pausar(si: boolean): void {
    this.pausada = si;
  }

  /** Cuántas piezas hay puestas (para el banco). */
  cuentas(): { edificios: number; murallas: number; relleno: number } {
    return { edificios: this.edificios?.cuantas ?? 0, murallas: this.murallas?.cuantas ?? 0, relleno: this.relleno?.cuantas ?? 0 };
  }

  /** Lo que tarda cada parte (ms, media móvil). */
  rendimiento(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.tiempos).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  }

  private medir(parte: string, desde: number): number {
    const ahora = performance.now();
    this.tiempos[parte] = (this.tiempos[parte] ?? ahora - desde) * 0.9 + (ahora - desde) * 0.1;
    return ahora;
  }

  private cambiar(antes: MallasDePiezas | null, p: Piezas): MallasDePiezas {
    if (antes) { this.escena.remove(antes.grupo); antes.destruir(); }
    const m = new MallasDePiezas(p.lista, this.material);
    this.escena.add(m.grupo);
    return m;
  }

  private ajustar(): void {
    const w = this.contenedor.clientWidth, h = this.contenedor.clientHeight;
    if (w && h) this.renderer.setSize(w, h, false);
  }

  /** El rayo de la cámara por un punto de la pantalla. */
  private apuntar(e: { clientX: number; clientY: number }): void {
    const r = this.lienzo.getBoundingClientRect();
    this.rayo.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camara.camara);
  }

  /** El edificio bajo un punto de la pantalla: el de la pieza que toca el rayo o, si no toca ninguna, el de la huella donde el rayo da en el suelo. */
  edificioBajo(e: { clientX: number; clientY: number }): string | null {
    const x = this.elegidoBajo(e);
    return x && 'edificio' in x ? x.edificio : null;
  }

  /**
   * Lo que hay bajo un punto de la pantalla: la pieza más cercana que toca el rayo (de un edificio o, si se puede elegir, de la muralla) o, si no
   * toca ninguna, lo que hay donde el rayo da en el suelo (la huella de un edificio o una celda de la muralla).
   */
  private elegidoBajo(e: { clientX: number; clientY: number }): Elegido | null {
    const c = this.ciudad;
    if (!c) return null;
    this.apuntar(e);
    const conMuralla = Boolean(this.o.alElegirMuralla), murallas = conMuralla ? this.murallas : null;
    const mallas = [...(this.edificios?.grupo.children ?? []), ...(murallas?.grupo.children ?? [])];
    for (const h of this.rayo.intersectObjects(mallas, false)) {
      const id = this.edificios?.idDe(h.object, h.instanceId);
      if (id) return { edificio: id };
      const m = this.murallaDeId(murallas?.idDe(h.object, h.instanceId));
      if (m) return { muralla: m };
    }
    const p = new THREE.Vector3();
    if (!this.rayo.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    const ed = edificioEn(c, { x: p.x, y: p.z });
    if (ed) return { edificio: ed.id };
    if (!conMuralla) return null;
    const T = c.celda / 2;
    for (const r of c.recintos) {
      const k = r.celdas.findIndex((q) => Math.abs(q.x - p.x) <= T && Math.abs(q.y - p.z) <= T);
      if (k >= 0) return { muralla: this.murallaDeId(idDeCeldaDeMuro(r.id, k))! };
    }
    return null;
  }

  /** La celda de muralla de un id de sus piezas (`idDeCeldaDeMuro`). */
  private murallaDeId(id: string | undefined): MurallaElegida | null {
    if (!id || !this.ciudad) return null;
    const i = id.lastIndexOf('#'), r = this.ciudad.recintos.find((x) => x.id === id.slice(0, i)), q = r?.celdas[Number(id.slice(i + 1))];
    return r && q ? { recintoId: r.id, clase: q.clase, nivel: q.nivel, enPie: q.enPie } : null;
  }

  private clic(e: PointerEvent): void {
    const x = this.elegidoBajo(e);
    if (x && 'muralla' in x) { this.o.alElegir(null); this.o.alElegirMuralla?.(x.muralla); return; }
    this.o.alElegir(x?.edificio ?? null);
  }

  private avisarPaso(x: Elegido | null, e: PointerEvent | null): void {
    const clase = !x ? null : 'edificio' in x ? 'edificio' : 'muralla';
    if (clase === null && this.pasandoClase === null) return;
    // primero se apaga lo que se dejó (el rótulo es el mismo), luego se avisa de lo de ahora (en cada fotograma, que el rótulo sigue al ratón)
    if (this.pasandoClase === 'edificio' && clase !== 'edificio') this.o.alPasar?.(null, null);
    if (this.pasandoClase === 'muralla' && clase !== 'muralla') this.o.alPasarMuralla?.(null, null);
    this.pasandoClase = clase;
    if (x && 'edificio' in x) this.o.alPasar?.(x.edificio, e);
    else if (x) this.o.alPasarMuralla?.(x.muralla, e);
    this.lienzo.style.cursor = x ? 'pointer' : '';
  }

  /** El marco del resalte alrededor de una huella. */
  private marco(e: EdificioEnVista, mat: THREE.Material, grueso: number): void {
    const m = 0.15, x0 = e.x - m, x1 = e.x + e.ancho + m, z0 = e.y - m, z1 = e.y + e.alto + m, y = 0.07;
    const caja = (cx: number, cz: number, w: number, d: number): void => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat);
      b.position.set(cx, y, cz);
      this.resalte.add(b);
    };
    caja((x0 + x1) / 2, z0, x1 - x0 + grueso, grueso);
    caja((x0 + x1) / 2, z1, x1 - x0 + grueso, grueso);
    caja(x0, (z0 + z1) / 2, grueso, z1 - z0);
    caja(x1, (z0 + z1) / 2, grueso, z1 - z0);
  }

  private ponerResalte(): void {
    const s = this.seleccion, c = this.ciudad;
    const clave = s && c ? `${s.id}:${s.tipo}:${this.claves.edificios.length}` : '';
    if (clave === this.claves.seleccion) return;
    this.claves.seleccion = clave;
    for (const b of [...this.resalte.children]) { (b as THREE.Mesh).geometry.dispose(); this.resalte.remove(b); }
    if (!s || !c) return;
    for (const e of c.edificios) {
      if (e.tipo !== s.tipo) continue;
      if (e.id === s.id) this.marco(e, this.matResalte, 0.22);
      else this.marco(e, this.matResalteTenue, 0.1);
    }
  }

  /** Las cuentas atrás de las obras, encima de cada una. */
  private ponerRotulos(w: number, h: number): void {
    const c = this.ciudad, usados = new Set<string>(), v = new THREE.Vector3();
    if (c && this.o.rotulo && this.camara.distancia < 160) {
      for (const e of c.edificios) {
        if (e.estado !== 'en_construccion' && !e.mejora) continue;
        const texto = this.o.rotulo(e);
        if (!texto) continue;
        v.set(e.x + e.ancho / 2, 2.6, e.y + e.alto / 2).project(this.camara.camara);
        if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) continue;
        usados.add(e.id);
        let el = this.rotulos.get(e.id);
        if (!el) {
          el = document.createElement('span');
          el.className = 'ciudad3d-rotulo';
          this.capaRotulos.appendChild(el);
          this.rotulos.set(e.id, el);
        }
        if (el.textContent !== texto) el.textContent = texto;
        el.style.left = `${(((v.x + 1) / 2) * w).toFixed(1)}px`;
        el.style.top = `${(((1 - v.y) / 2) * h).toFixed(1)}px`;
      }
    }
    for (const [id, el] of this.rotulos) if (!usados.has(id)) { el.remove(); this.rotulos.delete(id); }
  }

  private bucle(ahora: number): void {
    this.fotograma = requestAnimationFrame((t) => this.bucle(t));
    const dt = Math.min(0.1, (ahora - this.antes) / 1000);
    this.antes = ahora;
    if (this.pausada) return;
    let t = performance.now();
    const inicio = t;
    const w = this.lienzo.clientWidth || 1, h = this.lienzo.clientHeight || 1;
    this.entrada.teclas(dt);
    this.camara.colocar(w / h, dt);
    const d = this.camara.distancia, f = this.camara.foco;
    this.bruma.near = d * 2.5 + 80;
    this.bruma.far = d * 9 + 400;
    // la sombra sigue a lo que se mira y cubre lo que se ve
    const r = Math.min(260, Math.max(25, d * 1.4));
    this.sol.position.set(f.x + SOL.x, SOL.y, f.y + SOL.z);
    this.sol.target.position.set(f.x, 0, f.y);
    const sc = this.sol.shadow.camera;
    if (sc.right !== r) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 500; sc.updateProjectionMatrix(); }
    t = this.medir('camara', t);
    if (this.pasando) {
      const e = this.pasando;
      this.pasando = null;
      this.avisarPaso(this.elegidoBajo(e), e);
    }
    this.ponerResalte();
    this.ponerRotulos(w, h);
    if (this.o.alMover && this.ciudad) {
      const hu = this.camara.huella(this.ciudad.extension * 2 + 60);
      const clave = hu.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(';');
      if (clave !== this.claves.huella) { this.claves.huella = clave; this.o.alMover(hu); }
    }
    t = this.medir('marcas', t);
    this.cielo.actualizar(this.camara.camara, ahora);
    this.renderer.render(this.escena, this.camara.camara);
    this.medir('render', t);
    this.medir('total', inicio);
  }

  destruir(): void {
    cancelAnimationFrame(this.fotograma);
    this.observador.disconnect();
    this.entrada.destruir();
    for (const m of [this.edificios, this.murallas, this.relleno]) m?.destruir();
    for (const b of this.resalte.children) (b as THREE.Mesh).geometry.dispose();
    this.suelo.destruir();
    this.calzada.destruir();
    this.lejano.geometry.dispose();
    (this.lejano.material as THREE.Material).dispose();
    this.material.dispose();
    this.matResalte.dispose();
    this.matResalteTenue.dispose();
    this.cielo.destruir();
    this.renderer.dispose();
    this.capaRotulos.remove();
    this.lienzo.remove();
  }
}
