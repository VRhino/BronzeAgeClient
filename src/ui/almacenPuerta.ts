// La ventana «Almacén» de la puerta (0.222.0, Víctor 2026-11-19: «modificar la interfaz a ventana centrada en Desktop y full en móvil con los
// elementos de almacén con su icono a la izquierda y con cada clic sobre uno suma 10 al lado contrario, y del otro lado igual»; «se confirma al
// final»; «la transferencia debería ser bidireccional»). A la puerta de una plaza o un pueblo de tu Facción, con tu columna parada y siendo su
// Líder: a la izquierda el almacén del sitio, a la derecha el carro de la columna. Cada clic en un bien pasa 10 (o lo que quede, o lo que quepa)
// al otro lado; no se manda nada hasta «Confirmar», que primero deja (libera sitio en el carro) y luego saca. Solo salen los bienes que hay.
// Órdenes (motor 2026-11-19, nucleo 0.50.0): plaza `cargarDePlaza` / `dejarEnPlaza { asentamientoId, recurso, cantidad }`; pueblo
// `cargarDePueblo` / `dejarEnPueblo { puebloId, recurso, cantidad }` (en el pueblo solo se deja lo que produce).
import type { ProyeccionJugador } from '../apiCliente';
import { capacidadDeCarga } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { aplicarAyudas, ayuda } from './ayuda';
import { ocupacion } from './panelCarro';

type Escapar = (valor: string) => string;
type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** Lo que se pasa en cada clic. */
export const PASO_ALMACEN = 10;

/** El sitio de la puerta: su almacén, lo que cabe en él y las órdenes para sacar y dejar. */
export interface SitioAlmacen {
  /** `plaza:as-1` o `pueblo:pueblo-4`: el borrador de cada sitio va aparte. */
  clave: string;
  nombre: string;
  almacen: Record<string, number>;
  /** Lo que cabe aún de `r` en el almacén (la plaza, por recurso; el pueblo, en total). */
  hueco: (r: string, almacen: Record<string, number>) => number;
  /** Por qué no se saca nada (almacén cerrado), o `null`. */
  motivoSacar: string | null;
  /** Por qué no se deja `r` (en un pueblo, lo que no produce), o `null`. */
  motivoDejar: (r: string) => string | null;
  /** La nota del carro cuando lleva cosas que aquí no se dejan. */
  notaDejar?: string;
  sacar: (r: string, n: number) => [string, object];
  dejar: (r: string, n: number) => [string, object];
}

/** El borrador de cada sitio: por recurso, lo que pasa al carro (positivo) o al almacén (negativo). Vive entre repintados. */
const borradores = new Map<string, Record<string, number>>();
const borrador = (clave: string): Record<string, number> => {
  let b = borradores.get(clave);
  if (!b) { b = {}; borradores.set(clave, b); }
  return b;
};

const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const icono = (r: string): string => RECURSO_ICONO[r] ?? '📦';
const suma = (x: Record<string, number>): number => Object.values(x).reduce((t, n) => t + n, 0);

function columnaDe(p: ProyeccionJugador) {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

/** El almacén y el carro como quedarían con el borrador, en unidades enteras. */
function conBorrador(p: ProyeccionJugador, s: SitioAlmacen): { almacen: Record<string, number>; carro: Record<string, number>; capacidad?: number; d: Record<string, number> } {
  const col = columnaDe(p);
  const d = borrador(s.clave);
  const almacen: Record<string, number> = {};
  const carro: Record<string, number> = {};
  for (const [r, n] of Object.entries(s.almacen)) almacen[r] = Math.floor(n);
  for (const [r, n] of Object.entries(col?.suministro ?? {})) carro[r] = Math.floor(n);
  for (const [r, n] of Object.entries(d)) { almacen[r] = (almacen[r] ?? 0) - n; carro[r] = (carro[r] ?? 0) + n; }
  return { almacen, carro, capacidad: col ? capacidadDeCarga(col) : undefined, d };
}

/** Un clic: pasa hasta `PASO_ALMACEN` de `r` del lado `de` al otro, sin pasar de lo que hay ni de lo que cabe. Devuelve lo que pasó. */
export function pasar(p: ProyeccionJugador, s: SitioAlmacen, r: string, de: 'almacen' | 'carro'): number {
  const x = conBorrador(p, s);
  let n: number;
  if (de === 'almacen') {
    if (s.motivoSacar) return 0;
    const libre = x.capacidad !== undefined ? Math.max(0, Math.floor(x.capacidad - suma(x.carro))) : Infinity;
    n = Math.min(PASO_ALMACEN, x.almacen[r] ?? 0, libre);
  } else {
    if (s.motivoDejar(r)) return 0;
    n = -Math.min(PASO_ALMACEN, x.carro[r] ?? 0, Math.max(0, Math.floor(s.hueco(r, x.almacen))));
  }
  if (!n) return 0;
  const d = x.d;
  d[r] = (d[r] ?? 0) + n;
  if (!d[r]) delete d[r];
  return Math.abs(n);
}

export function deshacerAlmacen(clave: string): void { borradores.delete(clave); }

function fichas(lado: 'almacen' | 'carro', bienes: Record<string, number>, d: Record<string, number>, motivo: (r: string) => string | null, e: Escapar): string {
  // solo lo que hay y se puede pasar (la regla de interfaz: mostrar solo lo que el jugador puede hacer)
  const conAlgo = Object.entries(bienes).filter(([, n]) => n >= 1);
  const lista = conAlgo.filter(([r]) => !motivo(r)).sort(([a], [b]) => nombre(a).localeCompare(nombre(b), 'es'));
  if (!lista.length) return conAlgo.length ? '' : '<p class="mapa-lista-vacia">Vacío.</p>';
  return `<div class="alm-fichas">${lista.map(([r, n]) => {
    const delta = lado === 'carro' ? d[r] ?? 0 : -(d[r] ?? 0);
    const titulo = `Pasa ${PASO_ALMACEN} ${lado === 'almacen' ? 'al carro' : 'al almacén'}`;
    return `<button type="button" class="alm-ficha${delta > 0 ? ' sube' : delta < 0 ? ' baja' : ''}" data-alm-lado="${lado}" data-recurso="${e(r)}" title="${e(titulo)}">
      <span class="alm-icono" aria-hidden="true">${icono(r)}</span><span class="alm-nombre">${e(nombre(r))}</span>
      <b>${n}</b>${delta ? `<small class="alm-delta">${delta > 0 ? '+' : '−'}${Math.abs(delta)}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

/** El cuerpo de la ventana (se repinta entero en cada clic). */
export function htmlAlmacenPuerta(p: ProyeccionJugador, s: SitioAlmacen, e: Escapar): string {
  const x = conBorrador(p, s);
  const hay = Object.keys(x.d).length > 0;
  const info = ayuda('puerta:almacen', `Cada clic en un bien pasa ${PASO_ALMACEN} al otro lado (o lo que quede, o lo que quepa). No se mueve nada hasta «Confirmar». Solo mueve el carro el Líder de la columna.`);
  return `<div class="alm-puerta" data-alm-clave="${e(s.clave)}">
    <div class="alm-lados">
      <section class="alm-lado"><div class="alm-cab">${ocupacion(e(s.nombre), {}, undefined)}${info}</div>
        ${s.motivoSacar ? `<p class="asent-lado-nota">${e(s.motivoSacar)}</p>` : ''}
        ${fichas('almacen', x.almacen, x.d, () => s.motivoSacar, e)}</section>
      <section class="alm-lado">${ocupacion('Carro de tu columna', x.carro, x.capacidad)}
        ${s.notaDejar && Object.entries(x.carro).some(([r, n]) => n >= 1 && s.motivoDejar(r)) ? `<p class="asent-lado-nota">${e(s.notaDejar)}</p>` : ''}
        ${fichas('carro', x.carro, x.d, s.motivoDejar, e)}</section>
    </div>
    <div class="alm-pie"><button class="btn-secondary" type="button" data-alm-deshacer${hay ? '' : ' disabled'}>Deshacer</button><button class="btn-primary" type="button" data-alm-confirmar${hay ? '' : ' disabled'}>Confirmar</button></div>
    <p class="faction-error" data-alm-error role="alert"></p>
  </div>`;
}

/** Las órdenes que manda «Confirmar»: primero se deja (libera sitio en el carro), luego se saca. */
export function ordenesDelBorrador(s: SitioAlmacen): [string, object][] {
  const d = Object.entries(borrador(s.clave));
  return [...d.filter(([, n]) => n < 0).map(([r, n]) => s.dejar(r, -n)), ...d.filter(([, n]) => n > 0).map(([r, n]) => s.sacar(r, n))];
}

/** Los clics de la ventana. `raiz` es el cuerpo de la ventana; lo de dentro se repinta sin mandar nada hasta «Confirmar». */
export function cablearAlmacenPuerta(raiz: HTMLElement, p: ProyeccionJugador, s: SitioAlmacen, ejecutar: Ejecutar, e: Escapar): void {
  const caja = raiz.querySelector<HTMLElement>('.alm-puerta');
  if (!caja) return;
  const repintar = (error = ''): void => {
    caja.innerHTML = new DOMParser().parseFromString(htmlAlmacenPuerta(p, s, e), 'text/html').querySelector('.alm-puerta')!.innerHTML;
    aplicarAyudas(caja);
    const x = caja.querySelector<HTMLElement>('[data-alm-error]');
    if (x) x.textContent = error;
  };
  caja.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    if (b.dataset.almLado) { pasar(p, s, b.dataset.recurso!, b.dataset.almLado as 'almacen' | 'carro'); repintar(); return; }
    if (b.hasAttribute('data-alm-deshacer')) { deshacerAlmacen(s.clave); repintar(); return; }
    if (!b.hasAttribute('data-alm-confirmar')) return;
    const pasos = ordenesDelBorrador(s);
    caja.querySelectorAll<HTMLButtonElement>('button').forEach((x) => { x.disabled = true; });
    const errores: string[] = [];
    for (const [tipo, params] of pasos) {
      const m = await ejecutar(tipo, params);
      if (m) errores.push(m);
    }
    deshacerAlmacen(s.clave);
    // si nada falló, el refresco repinta la ventana con lo nuevo; si algo falló, se dice aquí
    if (errores.length) repintar(errores.join(' · '));
  });
}

/** El sitio de una plaza de tu Facción vista a la puerta. Sacar: ciudadano; cerrado, el Gobernador o el Tesorero. Dejar: hasta su capacidad. */
export function sitioDePlaza(p: ProyeccionJugador, a: { id: string; nombre?: string | null; almacen?: Record<string, { cantidad: number; capacidad?: number }>; almacenCerradoACiudadanos?: boolean; cargos?: { gobernadorId?: string | null; tesoreroId?: string | null } }): SitioAlmacen {
  const conCargo = [a.cargos?.gobernadorId, a.cargos?.tesoreroId].includes(p.heroeId);
  const capacidad = (r: string): number => a.almacen?.[r]?.capacidad ?? Infinity;
  return {
    clave: `plaza:${a.id}`,
    nombre: `Almacén de ${a.nombre ?? a.id}`,
    almacen: Object.fromEntries(Object.entries(a.almacen ?? {}).map(([r, v]) => [r, v.cantidad])),
    hueco: (r, almacen) => capacidad(r) - (almacen[r] ?? 0),
    motivoSacar: a.almacenCerradoACiudadanos && !conCargo ? 'El Gobernador ha cerrado el almacén a los ciudadanos: no se saca al carro, pero se puede dejar.' : null,
    motivoDejar: (r) => (a.almacen?.[r] || r in RECURSO_NOMBRE ? null : 'Este almacén no guarda eso.'),
    sacar: (r, n) => ['cargarDePlaza', { asentamientoId: a.id, recurso: r, cantidad: n }],
    dejar: (r, n) => ['dejarEnPlaza', { asentamientoId: a.id, recurso: r, cantidad: n }],
  };
}

/** El sitio de un pueblo de tu Facción a la puerta: se saca lo que haya; se deja solo lo que produce, hasta su capacidad (compartida). */
export function sitioDePueblo(x: { id: string; almacen: Record<string, number>; capacidad: number }, nombreDelPueblo: string, produce: string[]): SitioAlmacen {
  return {
    clave: `pueblo:${x.id}`,
    nombre: `Almacén de ${nombreDelPueblo}`,
    almacen: x.almacen,
    hueco: (_r, almacen) => x.capacidad - suma(almacen),
    motivoSacar: null,
    motivoDejar: (r) => (produce.includes(r) ? null : 'El pueblo solo guarda lo que produce.'),
    notaDejar: `Al pueblo solo se le deja lo que produce: ${produce.map(nombre).join(', ')}.`,
    sacar: (r, n) => ['cargarDePueblo', { puebloId: x.id, recurso: r, cantidad: n }],
    dejar: (r, n) => ['dejarEnPueblo', { puebloId: x.id, recurso: r, cantidad: n }],
  };
}
