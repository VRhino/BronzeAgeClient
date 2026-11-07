// Lo que ocupa en el suelo cada maqueta del mundo 3D (0.175.0, Víctor 2026-11-07): de aquí salen el aro de lo seleccionado («el círculo
// alrededor de la maqueta es demasiado grande, que sea del tamaño de la maqueta»), la zona de clic, el claro sin árboles y el colisionador
// de cliente: plazas, pueblos, aldeas y avanzadas son sólidas para lo que se mueve en el mapa. Una marcha a ellas o a un punto de dentro se
// queda al borde, y las columnas, caravanas y Aedas que el servidor pone dentro se pintan empujadas a su borde (rodean la maqueta). Solo es
// del cliente: el servidor sigue andando su línea; el sitio de la columna (vista, puerta, encuentros) es el suyo.
import { MUNDO3D } from './config';
import type { MundoEnVista } from './estado';

type Punto = { x: number; y: number };

/** Un círculo sólido: centro y radio, en u. */
export interface Solido { x: number; y: number; r: number }

const M = (): number => MUNDO3D.maqueta;
/** Pueblos y aldeas (empalizada, casas, campos). */
const P = (): number => MUNDO3D.maqueta * MUNDO3D.pueblo;
/** Avanzadas (atalaya, fuerte, ciudadela). */
const A = (): number => MUNDO3D.maqueta * MUNDO3D.avanzada;

/** Lo que ocupa una plaza: su muralla (desde el nivel 3) o el borde de sus casas: el caserío (1) y el poblado (2), más recogidos. */
export const radioDePlaza = (radioCiudad: number, nivel: number): number => radioCiudad * M() * (nivel <= 1 ? 0.62 : nivel === 2 ? 0.8 : 1);
/** Lo que ocupa un pueblo o una aldea: su empalizada (los campos de la aldea quedan fuera y se pisan). */
export const radioDePueblo = (_aldea: boolean): number => 0.58 * P();
/** Hasta dónde llegan los campos de una aldea (la zona de clic). */
export const radioDeCampos = (): number => 1.4 * P();
/** Lo que ocupa una avanzada: la cerca de la atalaya; las torres de las esquinas del fuerte; las torres del recinto de la ciudadela. */
export const radioDeAvanzada = (etapa: number): number => (etapa <= 1 ? 0.3 : 0.5) * A();
export const radioDeObra = (): number => 0.4 * M();
export const radioDeCampamento = (): number => 0.63 * M() * MUNDO3D.campamento;
export const radioDeBandidos = (): number => 0.48 * M() * MUNDO3D.campamento;
export const radioDeAlijo = (): number => 0.14 * M() * MUNDO3D.alijo;
export const radioDeBatalla = (): number => 0.65;

/** Lo que el aro de lo seleccionado deja de holgura alrededor de la maqueta. */
export const HOLGURA_ARO = 0.12;
/** Lo que queda una columna del borde de lo sólido. */
const HOLGURA_SOLIDO = 0.25;

/** Lo sólido del mundo: plazas, pueblos, aldeas y avanzadas, con la holgura de quien se para a su lado. */
export function solidosDelMundo(m: MundoEnVista): Solido[] {
  return [
    ...m.plazas.map((x) => ({ x: x.posicion.x, y: x.posicion.y, r: radioDePlaza(x.radioCiudad, x.nivel) + HOLGURA_SOLIDO })),
    ...m.pueblos.map((x) => ({ x: x.posicion.x, y: x.posicion.y, r: radioDePueblo(x.aldea) + HOLGURA_SOLIDO })),
    ...m.avanzadas.map((x) => ({ x: x.posicion.x, y: x.posicion.y, r: radioDeAvanzada(x.etapa) + HOLGURA_SOLIDO })),
  ];
}

/** El punto `p` fuera de lo sólido: si cae dentro de alguno, al borde, por el lado de `hacia` (de donde viene); sin `hacia` o justo en el
 * centro, por el lado por donde ya estaba. Dos pasadas por si al salir de uno se cae en otro pegado. */
export function fueraDeSolidos(p: Punto, solidos: readonly Solido[], hacia?: Punto): Punto {
  let q = p;
  for (let pasada = 0; pasada < 2; pasada++) {
    let movido = false;
    for (const s of solidos) {
      const dx = q.x - s.x, dy = q.y - s.y, d = Math.hypot(dx, dy);
      if (d >= s.r) continue;
      let ux: number, uy: number;
      const h = hacia ? Math.hypot(hacia.x - s.x, hacia.y - s.y) : 0;
      if (hacia && h > 1e-6 && pasada === 0) { ux = (hacia.x - s.x) / h; uy = (hacia.y - s.y) / h; }
      else if (d > 1e-6) { ux = dx / d; uy = dy / d; }
      else { ux = 0; uy = 1; }
      q = { x: s.x + ux * s.r, y: s.y + uy * s.r };
      movido = true;
    }
    if (!movido) break;
  }
  return q;
}

/** Un punto que se pinta: empujado al borde de lo sólido por donde ya estaba. */
export const empujar = (p: Punto, solidos: readonly Solido[]): Punto => fueraDeSolidos(p, solidos);

/** El sólido en que cae `p` (el primero), o ninguno. */
const enCual = (p: Punto, solidos: readonly Solido[]): Solido | undefined => solidos.find((s) => Math.hypot(p.x - s.x, p.y - s.y) < s.r);

/** Puntos del arco de `s` de `a0` a `a1` (por el lado corto), sin los extremos, cada `paso` u. */
function arco(s: Solido, a0: number, a1: number, paso: number): Punto[] {
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  const n = Math.ceil((Math.abs(d) * s.r) / paso), out: Punto[] = [];
  for (let i = 1; i < n; i++) { const a = a0 + (d * i) / n; out.push({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }); }
  return out;
}

/** Una ruta pintada que rodea lo sólido: se parte cada `paso` u, cada punto de dentro sale a su borde y, donde la ruta lo cruza por el
 * medio, se rodea por el arco. Sin nada sólido en el camino, la misma. */
export function rutaQueRodea(ruta: readonly Punto[], solidos: readonly Solido[], paso = 0.4): Punto[] {
  if (ruta.length < 2 || !solidos.length) return ruta as Punto[];
  const cerca = solidos.filter((s) => ruta.some((p, k) => k > 0 && distanciaASegmento(s, ruta[k - 1]!, p) < s.r));
  if (!cerca.length) return ruta as Punto[];
  const out: Punto[] = [];
  let antes: { s: Solido; a: number } | null = null;
  for (let k = 1; k < ruta.length; k++) {
    const a = ruta[k - 1]!, b = ruta[k]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / paso));
    for (let i = k === 1 ? 0 : 1; i <= n; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }, s = enCual(p, cerca);
      if (!s) { out.push(p); antes = null; continue; }
      const q = empujar(p, cerca), ang = Math.atan2(q.y - s.y, q.x - s.x);
      if (antes && antes.s === s) out.push(...arco(s, antes.a, ang, paso));
      out.push(q);
      antes = { s, a: ang };
    }
  }
  return out;
}

/**
 * Lo que se mueve, pintado fuera de lo sólido y sin saltos: con cada cosa que el servidor pone dentro de una maqueta, su punto pintado va por
 * el borde hacia el lado por donde está (si cruza por el medio, da la vuelta) y no más deprisa que 4,5 veces lo que anda de verdad. Fuera,
 * donde está. Recuerda cada cosa por su id; lo que no se ve en un rato se olvida.
 */
export class Colisionador {
  private readonly vistos = new Map<string, { real: Punto; pintado: Punto; cuadro: number }>();
  private cuadro = 0;

  /** Empieza un fotograma. */
  empezar(): void {
    if (++this.cuadro % 600 === 0) for (const [id, v] of this.vistos) if (this.cuadro - v.cuadro > 600) this.vistos.delete(id);
  }

  /** Dónde se pinta `id`, que el servidor pone en `p`. */
  mover(id: string, p: Punto, solidos: readonly Solido[]): Punto {
    const antes = this.vistos.get(id), s = solidos.length ? enCual(p, solidos) : undefined;
    let pintado = p;
    if (s) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      const quiere = d > 0.1 * s.r || !antes ? Math.atan2(p.y - s.y, p.x - s.x) : Math.atan2(antes.pintado.y - s.y, antes.pintado.x - s.x);
      if (antes && Math.hypot(antes.pintado.x - p.x, antes.pintado.y - p.y) < s.r * 2.5) {
        // desde donde se pintó la última vez, girando por el borde sin pasar de 4,5 veces lo que anduvo (y algo, para no quedarse quieto)
        const desde = Math.atan2(antes.pintado.y - s.y, antes.pintado.x - s.x);
        let giro = quiere - desde;
        while (giro > Math.PI) giro -= 2 * Math.PI;
        while (giro <= -Math.PI) giro += 2 * Math.PI;
        const max = (4.5 * Math.hypot(p.x - antes.real.x, p.y - antes.real.y) + 0.002) / s.r, a = desde + Math.max(-max, Math.min(max, giro));
        pintado = fueraDeSolidos({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }, solidos);
      } else pintado = fueraDeSolidos(p, solidos);
    }
    this.vistos.set(id, { real: p, pintado, cuadro: this.cuadro });
    return pintado;
  }
}

function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const vx = b.x - a.x, vy = b.y - a.y, l = vx * vx + vy * vy;
  const t = l > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l)) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}
