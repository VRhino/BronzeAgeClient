// Cuánto tardaría tu columna en llegar a un punto del mapa, para las fichas de selección (Víctor, 2026-10-31: junto a la distancia, el tiempo).
// Es una estimación del cliente, como la haría el motor (Movimiento_Ejercitos §4): el camino más barato por el grafo de navegación del artefacto
// (`GrafoNavegacion`, la misma autoridad de rutas que usa el motor), cada arista a su coste de terreno, a la velocidad de la columna (el mínimo
// de su tropa y sus caravanas; el héroe solo, `MOVIMIENTO.velocidadJugador`; ×1,5 con marcha forzada). No cuenta los caminos construidos, que
// aceleran: el motor llega antes o igual. Sin grafo, en línea recta y en llano.
import { bloqueDeDatos, grafoDeNavegacion, tropasReclutables, type ProyeccionJugador } from '../apiCliente';
import { navegacionDesdeGrafo, type Navegacion } from '../mundo3d/rejilla';
import type { Ejercito } from '../tiposDominio';
import { textoEnTiempoReal } from '../ui/estadoCliente';

type Punto = { x: number; y: number };

/** El grafo con su lista de vecinos (CSR), construido una vez por grafo. */
interface Red { nav: Navegacion; inicio: Int32Array; vecino: Int32Array; peso: Float32Array }
let red: { grafo: unknown; red: Red } | null = null;

function redActual(): Red | null {
  const grafo = grafoDeNavegacion();
  if (!grafo) return null;
  if (red?.grafo === grafo) return red.red;
  const nav = navegacionDesdeGrafo(grafo);
  const n = nav.x.length, m = nav.a.length, grado = new Int32Array(n + 1);
  for (let k = 0; k < m; k++) if (nav.a[k]! >= 0 && nav.b[k]! >= 0) { grado[nav.a[k]! + 1]!++; grado[nav.b[k]! + 1]!++; }
  for (let i = 0; i < n; i++) grado[i + 1]! += grado[i]!;
  const inicio = grado.slice(), lleno = grado.slice(0, n), vecino = new Int32Array(inicio[n]!), peso = new Float32Array(inicio[n]!);
  for (let k = 0; k < m; k++) {
    const a = nav.a[k]!, b = nav.b[k]!;
    if (a < 0 || b < 0) continue;
    // coste de recorrerla en «unidades de llano»: su longitud por su coste medio
    const w = Math.hypot(nav.x[a]! - nav.x[b]!, nav.y[a]! - nav.y[b]!) * (nav.coste[k]! / 1000);
    vecino[lleno[a]!] = b; peso[lleno[a]!++] = w;
    vecino[lleno[b]!] = a; peso[lleno[b]!++] = w;
  }
  red = { grafo, red: { nav, inicio, vecino, peso } };
  return red.red;
}

/** El nodo más cercano a `p`, buscando por las casillas del índice de la rejilla. */
function nodoCercano(r: Red, p: Punto): number {
  let mejor = -1, d2 = Infinity;
  for (let radio = 1; radio <= 4 && mejor < 0; radio++) {
    const cx = Math.floor(p.x / 8), cy = Math.floor(p.y / 8);
    for (let x = cx - radio; x <= cx + radio; x++) for (let y = cy - radio; y <= cy + radio; y++) {
      for (const k of r.nav.porCasilla.get(x * 100_000 + y) ?? []) {
        const i = r.nav.a[k]!, dx = r.nav.x[i]! - p.x, dy = r.nav.y[i]! - p.y;
        if (dx * dx + dy * dy < d2) { d2 = dx * dx + dy * dy; mejor = i; }
      }
    }
  }
  return mejor;
}

/** A* de `desde` a `hasta`: el coste en unidades de llano, o `null` si no hay camino por tierra (o se pasa del tope de nodos). */
function costeDeRuta(r: Red, desde: number, hasta: number): number | null {
  const { nav, inicio, vecino, peso } = r;
  const n = nav.x.length, g = new Float32Array(n).fill(Infinity), cerrado = new Uint8Array(n);
  const hx = nav.x[hasta]!, hy = nav.y[hasta]!;
  const h = (i: number) => Math.hypot(nav.x[i]! - hx, nav.y[i]! - hy);
  // montículo binario de [f, nodo]
  const heapF: number[] = [], heapN: number[] = [];
  const meter = (f: number, i: number) => {
    let k = heapF.length; heapF.push(f); heapN.push(i);
    while (k > 0) { const pa = (k - 1) >> 1; if (heapF[pa]! <= f) break; heapF[k] = heapF[pa]!; heapN[k] = heapN[pa]!; k = pa; }
    heapF[k] = f; heapN[k] = i;
  };
  const sacar = (): number => {
    const top = heapN[0]!, f = heapF.pop()!, i = heapN.pop()!;
    if (heapF.length) {
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, d = l + 1;
        let c = k, cf = f;
        if (l < heapF.length && heapF[l]! < cf) { c = l; cf = heapF[l]!; }
        if (d < heapF.length && heapF[d]! < cf) { c = d; cf = heapF[d]!; }
        if (c === k) break;
        heapF[k] = heapF[c]!; heapN[k] = heapN[c]!; k = c;
      }
      heapF[k] = f; heapN[k] = i;
    }
    return top;
  };
  g[desde] = 0; meter(h(desde), desde);
  let vistos = 0;
  while (heapF.length) {
    const i = sacar();
    if (cerrado[i]) continue;
    if (i === hasta) return g[i]!;
    cerrado[i] = 1;
    if (++vistos > 300_000) return null;
    for (let e = inicio[i]!; e < inicio[i + 1]!; e++) {
      const j = vecino[e]!, nuevo = g[i]! + peso[e]!;
      if (nuevo < g[j]!) { g[j] = nuevo; meter(nuevo + h(j), j); }
    }
  }
  return null;
}

/** La velocidad de la columna (u/min antes del terreno), como `velocidad_de_ejercito` del motor. */
export function velocidadDeColumna(p: ProyeccionJugador, c: Ejercito): number {
  const tropas = tropasReclutables() ?? [];
  const vel = (tropaId: string) => tropas.find((t) => t.id === tropaId)?.velocidad;
  const mias = new Set(c.escuadronIds);
  const velocidades: (number | undefined)[] = [
    ...p.heroe.escuadrones.filter((s) => mias.has(s.id) && s.cantidad > 0).map((s) => vel(s.tropaId)),
    ...c.participantes.filter((x) => x.heroeId !== p.heroeId).flatMap((x) => p.heroesVisibles.find((h) => h.heroeId === x.heroeId)?.escuadrasQueLleva ?? []).filter((s) => s.cantidad > 0).map((s) => vel(s.tropaId)),
  ];
  const caravanas = bloqueDeDatos<Record<string, { velocidad?: number }>>('CARAVANA_CATALOGO');
  const animales = bloqueDeDatos<Record<string, { velocidad?: number }>>('ANIMAL_CATALOGO');
  for (const id of c.caravanasAdjuntasIds ?? []) {
    const car = (p.caravanas ?? []).find((x) => x.id === id);
    if (!car) continue;
    const conAnimal = (car.carros ?? []).filter((x) => x.animal).map((x) => animales?.[x.animal!]?.velocidad);
    velocidades.push(conAnimal.length ? Math.min(...conAnimal.map((v) => v ?? Infinity)) : caravanas?.[car.tipo ?? '']?.velocidad);
  }
  if (c.caravanaFundacionId) velocidades.push(caravanas?.['construccion']?.velocidad);
  const conocidas = velocidades.filter((v): v is number => typeof v === 'number' && v > 0);
  const mov = bloqueDeDatos<{ velocidadJugador?: number; factorVelocidadMarchaForzada?: number }>('MOVIMIENTO');
  const base = conocidas.length ? Math.min(...conocidas) : mov?.velocidadJugador ?? 66;
  return base * (c.marchaForzada ? mov?.factorVelocidadMarchaForzada ?? 1.5 : 1);
}

/** Lo ya calculado: el A* es caro y la ficha se repinta en cada refresco. Se rehace si la columna se movió un poco o cambió el destino. */
let ultimo: { desde: Punto; hasta: Punto; coste: number | null } | null = null;

/** Minutos de mundo que tardaría la columna `c` en ir de donde está a `destino`; `null` si no hay camino por tierra. */
export function minutosHasta(p: ProyeccionJugador, c: Ejercito, destino: Punto): number | null {
  const desde = c.posicionActual;
  let coste: number | null;
  if (ultimo && Math.hypot(ultimo.desde.x - desde.x, ultimo.desde.y - desde.y) < 2 && ultimo.hasta.x === destino.x && ultimo.hasta.y === destino.y) coste = ultimo.coste;
  else {
    const r = redActual();
    const a = r ? nodoCercano(r, desde) : -1, b = r ? nodoCercano(r, destino) : -1;
    coste = r && a >= 0 && b >= 0
      ? (() => { const c2 = costeDeRuta(r, a, b); return c2 === null ? null : c2 + Math.hypot(r.nav.x[a]! - desde.x, r.nav.y[a]! - desde.y) + Math.hypot(r.nav.x[b]! - destino.x, r.nav.y[b]! - destino.y); })()
      : Math.hypot(destino.x - desde.x, destino.y - desde.y);
    ultimo = { desde: { ...desde }, hasta: { ...destino }, coste };
  }
  return coste === null ? null : coste / velocidadDeColumna(p, c);
}

/** «~12 min» (en tiempo de jugador) hasta `destino` con tu columna en el mapa, «sin camino por tierra», o `null` si no estás en el mapa. */
export function textoTiempoHasta(p: ProyeccionJugador, destino: Punto): string | null {
  const c = p.ejercitos.find((e) => !e.dentroDe && e.participantes.some((x) => x.heroeId === p.heroeId));
  if (!c) return null;
  const min = minutosHasta(p, c, destino);
  return min === null ? 'sin camino por tierra' : `~${textoEnTiempoReal(min * 60_000)}`;
}
