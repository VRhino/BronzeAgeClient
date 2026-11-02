// El suelo de la plaza: un plano con una textura pintada una vez en un lienzo 2D. Lleva el color del terreno donde está la plaza (el del mapa),
// moteado; el disco urbano pisado; la tierra pisada bajo las calles y los caminos (la calzada va encima, en `calzada.ts`); la tierra apisonada
// bajo cada edificio; los campos en surcos de las granjas; los huertos y patios de las celdas libres; el césped de los parques y las losas de
// las plazas.
import * as THREE from 'three';
import { CIUDAD3D, COLOR } from './config';
import { hash3, type CiudadEnVista } from './estado';

const rgb = (c: number, a = 1): string => `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${a})`;

export class Suelo {
  readonly malla: THREE.Mesh;
  private readonly material: THREE.MeshLambertMaterial;
  private textura: THREE.CanvasTexture | null = null;
  private clave = '';
  /** El lado medio del plano, en ul. */
  medio = 100;

  constructor(private readonly anisotropia: number) {
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.malla.rotation.x = -Math.PI / 2;
    this.malla.receiveShadow = true;
  }

  /** Repinta el suelo si cambió lo que lleva. `base`: el color del terreno donde está la plaza. */
  actualizar(c: CiudadEnVista, base: number): void {
    const clave = [c.id, c.nivel, c.radio, base, c.calles.length, c.caminos.length, c.libres.length, ...c.edificios.map((e) => `${e.id}:${e.tipo}:${e.estado}:${e.x},${e.y},${e.ancho},${e.alto}:${e.estilo}`)].join('|');
    if (clave === this.clave) return;
    this.clave = clave;
    const medio = c.extension + CIUDAD3D.holgura;
    this.medio = medio;
    const px = Math.min(CIUDAD3D.sueloPx, CIUDAD3D.sueloMax / (2 * medio)), lado = Math.ceil(2 * medio * px);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = lado;
    const g = lienzo.getContext('2d')!;
    // de ul a píxel
    const X = (x: number): number => (x + medio) * px;
    pintar(g, c, base, X, px, lado);
    this.textura?.dispose();
    const t = new THREE.CanvasTexture(lienzo);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.anisotropia;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    this.textura = t;
    this.material.map = t;
    this.material.needsUpdate = true;
    this.malla.scale.set(2 * medio, 2 * medio, 1);
  }

  destruir(): void {
    this.textura?.dispose();
    this.material.dispose();
    this.malla.geometry.dispose();
  }
}

function pintar(g: CanvasRenderingContext2D, c: CiudadEnVista, base: number, X: (x: number) => number, px: number, lado: number): void {
  const T = c.celda, alto = c.nivel >= 4;
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, lado, lado);
  // moteado: manchas suaves más claras y más oscuras
  for (let i = 0; i < 260; i++) {
    const r = lado * (0.01 + hash3(i, 1, 3) * 0.05), x = hash3(i, 2, 3) * lado, y = hash3(i, 3, 3) * lado;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hash3(i, 4, 3) < 0.5 ? 'rgba(40, 32, 18, 0.16)' : 'rgba(255, 245, 210, 0.13)');
    gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // lo poblado, pisado: la tierra de las calles y de alrededor de cada casa se desborda un poco (más cuanto más nivel)
  const pisado = 0.22 + 0.06 * Math.min(5, c.nivel);
  borroso(g, () => {
    g.fillStyle = rgb(COLOR.tierra, pisado);
    for (const r of c.libres) if (!r.campo) g.fillRect(X(r.x), X(r.y), T * px, T * px);
    for (const r of c.calles) g.fillRect(X(r.x - T), X(r.y - T), (r.ancho + 2 * T) * px, (r.alto + 2 * T) * px);
  }, 6);
  // tierra apisonada bajo cada edificio (y su terreno propio: campos, césped, losas)
  for (const e of c.edificios) {
    const x = X(e.x), y = X(e.y), w = e.ancho * px, h = e.alto * px;
    if (e.tipo === 'granja' && e.estado === 'activo') surcos(g, x, y, w, h, px, e.semilla);
    else if (e.tipo === 'parque' && e.estado === 'activo') { g.fillStyle = rgb(0x7d9a4f, 0.9); g.fillRect(x + px * 0.2, y + px * 0.2, w - px * 0.4, h - px * 0.4); }
    else if ((e.tipo === 'plaza' || e.tipo === 'patioDeGremios' || e.tipo === 'mercado') && e.estado === 'activo' && e.estilo >= 3) losas(g, x, y, w, h, px, COLOR.losa);
    else { g.fillStyle = rgb(COLOR.tierra, 0.55); g.fillRect(x + px * 0.1, y + px * 0.1, w - px * 0.2, h - px * 0.2); }
  }
  // bajo las calles y los caminos, tierra pisada (la calzada, con su forma, sus rodadas y sus losas, va encima: `calzada.ts`)
  borroso(g, () => {
    g.fillStyle = rgb(COLOR.tierra, 0.4);
    for (const r of c.calles) g.fillRect(X(r.x), X(r.y), r.ancho * px, r.alto * px);
    g.fillStyle = rgb(COLOR.tierra, 0.22);
    for (const r of c.caminos) g.fillRect(X(r.x), X(r.y), r.ancho * px, r.alto * px);
  }, 3);
  // el foso de las empalizadas va en 3D; aquí, la tierra removida al pie de la muralla
  for (const r of c.recintos) for (const k of r.celdas) {
    g.fillStyle = rgb(k.enPie ? COLOR.tierra : COLOR.tierraOscura, k.enPie ? 0.5 : 0.35);
    g.fillRect(X(k.x - T / 2), X(k.y - T / 2), T * px, T * px);
  }
  // las celdas libres: huertos en surcos y patios de tierra clara
  for (const r of c.libres) {
    const x = X(r.x), y = X(r.y), w = T * px;
    if (r.tipo === 'huerto') huerto(g, x, y, w, px, r.semilla);
    else if (r.tipo === 'patio') { g.fillStyle = rgb(alto ? COLOR.losa : 0xc4ad86, 0.75); g.fillRect(x + px * 0.2, y + px * 0.2, w - px * 0.4, w - px * 0.4); }
    else if (r.tipo === 'redil') { g.fillStyle = rgb(COLOR.tierraOscura, 0.35); g.beginPath(); g.arc(x + w / 2, y + w / 2, w * 0.36, 0, Math.PI * 2); g.fill(); }
  }
}

/** Pinta con los bordes suavizados (los caminos de tierra no tienen arista). */
function borroso(g: CanvasRenderingContext2D, f: () => void, px = 1.5): void {
  g.save();
  g.filter = `blur(${px}px)`;
  f();
  g.restore();
}

/** Un campo en surcos a lo largo de su lado largo, con su lindero. */
function surcos(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, px: number, semilla: number): void {
  const trigo = hash3(semilla, 1, 3) < 0.5;
  g.fillStyle = rgb(trigo ? 0xb89a4e : 0x7f8f45, 1);
  g.fillRect(x + px * 0.15, y + px * 0.15, w - px * 0.3, h - px * 0.3);
  g.strokeStyle = rgb(trigo ? 0x8f7438 : 0x5f6e33, 0.55);
  g.lineWidth = Math.max(1, px * 0.18);
  g.beginPath();
  const paso = px * 0.55;
  if (w >= h) for (let k = y + paso; k < y + h - px * 0.2; k += paso) { g.moveTo(x + px * 0.2, k); g.lineTo(x + w - px * 0.2, k); }
  else for (let k = x + paso; k < x + w - px * 0.2; k += paso) { g.moveTo(k, y + px * 0.2); g.lineTo(k, y + h - px * 0.2); }
  g.stroke();
}

/** Un huerto: bancales cortos de verde y tierra. */
function huerto(g: CanvasRenderingContext2D, x: number, y: number, w: number, px: number, semilla: number): void {
  g.fillStyle = rgb(0x7a5e40, 0.85);
  g.fillRect(x + px * 0.3, y + px * 0.3, w - px * 0.6, w - px * 0.6);
  const n = 4 + Math.floor(hash3(semilla, 2, 3) * 3), verdes = [0x6d8a3e, 0x87a24c, 0x5c7a35];
  for (let k = 0; k < n; k++) {
    g.fillStyle = rgb(verdes[k % 3]!, 0.9);
    const yy = y + px * 0.4 + ((w - px * 0.8) * (k + 0.2)) / n;
    g.fillRect(x + px * 0.4, yy, w - px * 0.8, ((w - px * 0.8) / n) * 0.55);
  }
}

/** Losas: el color de la piedra y sus juntas. */
function losas(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, px: number, color: number): void {
  g.fillStyle = rgb(color, 1);
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(80, 70, 55, 0.35)';
  g.lineWidth = Math.max(1, px * 0.06);
  const paso = px * 0.6;
  g.beginPath();
  for (let k = y + paso; k < y + h; k += paso) { g.moveTo(x, k); g.lineTo(x + w, k); }
  let fila = 0;
  for (let k = y; k < y + h; k += paso, fila++) for (let j = x + (fila % 2 ? paso / 2 : paso); j < x + w; j += paso * 1.4) { g.moveTo(j, k); g.lineTo(j, Math.min(y + h, k + paso)); }
  g.stroke();
}
