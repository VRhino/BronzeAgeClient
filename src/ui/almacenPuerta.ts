// La ventana «Almacén» de la puerta (0.222.0, Víctor 2026-11-19: «modificar la interfaz a ventana centrada en Desktop y full en móvil con los
// elementos de almacén con su icono a la izquierda y con cada clic sobre uno suma 10 al lado contrario, y del otro lado igual»; «se confirma al
// final»; «la transferencia debería ser bidireccional»). A la puerta de una plaza o un pueblo de tu Facción, con tu columna parada y siendo su
// Líder: a la izquierda el almacén del sitio, a la derecha el carro de la columna. Cada clic en un bien pasa 10 (o lo que quede, o lo que quepa)
// al otro lado; no se manda nada hasta «Confirmar», que primero deja (libera sitio en el carro) y luego saca. Solo salen los bienes que hay.
// 0.223.0 (Víctor 2026-11-19, «reutilizar en la interfaz de dentro de la plaza», opción 2): la misma ventana por dentro, con un selector arriba
// cuando hay más de un almacén a mano: «Plaza ↔ carro» y «Personal ↔ carro» (`htmlAlmacenes`). Dentro del pueblo (Carga), el del pueblo; en tu
// residencia y a su puerta, el personal (`guardarEnAlmacenPersonal` / `sacarDelAlmacenPersonal { recurso, cantidad }`, solo el Líder).
// Órdenes (motor 2026-11-19, nucleo 0.50.0): plaza `cargarDePlaza` / `dejarEnPlaza { asentamientoId, recurso, cantidad }`; pueblo
// `cargarDePueblo` / `dejarEnPueblo { puebloId, recurso, cantidad }` (en el pueblo solo se deja lo que produce).
import type { ProyeccionJugador } from '../apiCliente';
import { capacidadDeCarga } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { aplicarAyudas, ayuda } from './ayuda';
import { almacenPersonalAMano, ocupacion } from './panelCarro';
import { CAPACIDAD_CARRO_SALIDA } from './cargaDeSalida';

type Escapar = (valor: string) => string;
type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** Lo que se pasa en cada clic. */
export const PASO_ALMACEN = 10;

/** El sitio de la puerta: su almacén, lo que cabe en él y las órdenes para sacar y dejar. */
export interface SitioAlmacen {
  /** `plaza:as-1` o `pueblo:pueblo-4`: el borrador de cada sitio va aparte. */
  clave: string;
  nombre: string;
  /** El texto de su botón en el selector, cuando hay varios (`Plaza ↔ carro`). */
  etiqueta?: string;
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

/** El carro: el de tu columna o, dentro de tu residencia sin ella, el que traes contigo (`heroe.carro`, entrar no lo vacía). */
function carroDe(p: ProyeccionJugador): { bienes: Record<string, number>; capacidad: number; titulo: string } {
  const col = columnaDe(p);
  return col ? { bienes: col.suministro ?? {}, capacidad: capacidadDeCarga(col), titulo: 'Carro de tu columna' } : { bienes: p.heroe.carro ?? {}, capacidad: CAPACIDAD_CARRO_SALIDA, titulo: 'Tu carro' };
}

/** El almacén y el carro como quedarían con el borrador, en unidades enteras. */
function conBorrador(p: ProyeccionJugador, s: SitioAlmacen): { almacen: Record<string, number>; carro: Record<string, number>; capacidad?: number; titulo: string; d: Record<string, number> } {
  const c = carroDe(p);
  const d = borrador(s.clave);
  const almacen: Record<string, number> = {};
  const carro: Record<string, number> = {};
  for (const [r, n] of Object.entries(s.almacen)) almacen[r] = Math.floor(n);
  for (const [r, n] of Object.entries(c.bienes)) carro[r] = Math.floor(n);
  for (const [r, n] of Object.entries(d)) { almacen[r] = (almacen[r] ?? 0) - n; carro[r] = (carro[r] ?? 0) + n; }
  return { almacen, carro, capacidad: c.capacidad, titulo: c.titulo, d };
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
  const info = ayuda('puerta:almacen', `Cada clic en un bien pasa ${PASO_ALMACEN} al otro lado (o lo que quede, o lo que quepa). No se mueve nada hasta «Confirmar».`);
  return `<div class="alm-puerta" data-alm-clave="${e(s.clave)}">
    <div class="alm-lados">
      <section class="alm-lado"><div class="alm-cab">${ocupacion(e(s.nombre), {}, undefined)}${info}</div>
        ${s.motivoSacar ? `<p class="asent-lado-nota">${e(s.motivoSacar)}</p>` : ''}
        ${fichas('almacen', x.almacen, x.d, () => s.motivoSacar, e)}</section>
      <section class="alm-lado">${ocupacion(x.titulo, x.carro, x.capacidad)}
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
export function sitioDePlaza(p: ProyeccionJugador, a: { id: string; nombre?: string | null; faccionId?: string | null; almacen?: Record<string, { cantidad: number; capacidad?: number }>; almacenCerradoACiudadanos?: boolean; cargos?: { gobernadorId?: string | null; tesoreroId?: string | null } }): SitioAlmacen {
  // el cargo, por la ficha de la plaza o por los cargos de tu Facción (`gobernador@as-1`, `tesorero@as-1`)
  const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
  const conCargo = [a.cargos?.gobernadorId, a.cargos?.tesoreroId].includes(p.heroeId) || Boolean(yo?.cargos.some((c) => c === `gobernador@${a.id}` || c === `tesorero@${a.id}`));
  const ciudadano = !a.faccionId || a.faccionId === p.faccionId;
  const capacidad = (r: string): number => a.almacen?.[r]?.capacidad ?? Infinity;
  return {
    clave: `plaza:${a.id}`,
    nombre: `Almacén de ${a.nombre ?? a.id}`,
    etiqueta: 'Plaza ↔ carro',
    almacen: Object.fromEntries(Object.entries(a.almacen ?? {}).map(([r, v]) => [r, v.cantidad])),
    hueco: (r, almacen) => capacidad(r) - (almacen[r] ?? 0),
    motivoSacar: !ciudadano ? 'Solo sus ciudadanos sacan de este almacén; si es de una Facción aliada o vasalla, puedes dejarle lo del carro.'
      : a.almacenCerradoACiudadanos && !conCargo ? 'El Gobernador ha cerrado el almacén a los ciudadanos: no se saca al carro, pero se puede dejar.' : null,
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

/** Tu almacén personal (en tu residencia, o con tu columna a su puerta): solo el Líder de la columna mueve el carro; hasta su capacidad, compartida. */
export function sitioPersonal(p: ProyeccionJugador): SitioAlmacen {
  const col = columnaDe(p);
  const motivo = col && col.liderId !== p.heroeId ? 'Solo el Líder de la columna mueve lo del carro.' : null;
  const capacidad = p.heroe.capacidadAlmacenPersonal ?? Infinity;
  return {
    clave: 'personal',
    nombre: 'Almacén personal',
    etiqueta: 'Personal ↔ carro',
    almacen: p.heroe.almacenPersonal ?? {},
    hueco: (_r, almacen) => capacidad - suma(almacen),
    motivoSacar: motivo,
    motivoDejar: () => motivo,
    sacar: (r, n) => ['sacarDelAlmacenPersonal', { recurso: r, cantidad: n }],
    dejar: (r, n) => ['guardarEnAlmacenPersonal', { recurso: r, cantidad: n }],
  };
}

/** Los almacenes a mano dentro de una plaza: el suyo y, en tu residencia, el personal. */
export function sitiosDentroDePlaza(p: ProyeccionJugador, a: Parameters<typeof sitioDePlaza>[1]): SitioAlmacen[] {
  return [sitioDePlaza(p, a), ...(almacenPersonalAMano(p) ? [sitioPersonal(p)] : [])];
}

/** El almacén elegido en el selector, por grupo de sitios. */
const elegidos = new Map<string, string>();
const grupo = (sitios: SitioAlmacen[]): string => sitios.map((s) => s.clave).join('|');
function elegido(sitios: SitioAlmacen[]): SitioAlmacen {
  const k = elegidos.get(grupo(sitios));
  return sitios.find((s) => s.clave === k) ?? sitios[0]!;
}

/** Lo de debajo de la ventana según el sitio: en la plaza, cerrar el almacén (el Gobernador); en el personal sin columna, «Todo al almacén personal». */
function pieDe(p: ProyeccionJugador, s: SitioAlmacen, e: Escapar): string {
  if (s.clave.startsWith('plaza:')) {
    const id = s.clave.slice('plaza:'.length);
    const a = p.asentamientos.find((x) => x.id === id);
    const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
    if (!a || !yo?.cargos.includes(`gobernador@${id}`)) return '';
    return `<label class="asent-toggle"><input type="checkbox" data-almacen-cerrar="${e(id)}"${a.almacenCerradoACiudadanos ? ' checked' : ''} /> Cerrar el almacén a los ciudadanos (no sacan al carro)</label>`;
  }
  if (s.clave === 'personal' && !columnaDe(p) && Object.values(p.heroe.carro ?? {}).some((n) => n >= 1)) {
    return '<button class="btn-secondary" type="button" data-vaciar-carro>Todo al almacén personal</button>';
  }
  return '';
}

/** La ventana con el selector arriba («Plaza ↔ carro», «Personal ↔ carro») si hay más de un almacén a mano; con uno, la de la puerta tal cual. */
export function htmlAlmacenes(p: ProyeccionJugador, sitios: SitioAlmacen[], e: Escapar): string {
  if (!sitios.length) return '';
  const s = elegido(sitios);
  const selector = sitios.length > 1
    ? `<div class="asent-tabs alm-selector">${sitios.map((x) => `<button class="asent-tab${x === s ? ' activo' : ''}" type="button" data-alm-sitio="${e(x.clave)}"${x === s ? ' aria-pressed="true"' : ''}>${e(x.etiqueta ?? x.nombre)}</button>`).join('')}</div>`
    : '';
  const pie = pieDe(p, s, e);
  return `<div class="alm-varios">${selector}${htmlAlmacenPuerta(p, s, e)}${pie ? `<div class="alm-extra">${pie}</div>` : ''}</div>`;
}

/** Los clics de `htmlAlmacenes`: el selector cambia de almacén (cada uno guarda su borrador) y el resto, como en la puerta. */
export function cablearAlmacenes(raiz: HTMLElement, p: ProyeccionJugador, sitios: SitioAlmacen[], ejecutar: Ejecutar, e: Escapar): void {
  const caja = raiz.querySelector<HTMLElement>('.alm-varios');
  if (!caja || !sitios.length) return;
  const cablearDentro = (): void => {
    cablearAlmacenPuerta(caja, p, elegido(sitios), ejecutar, e);
    const error = (m: string | null): void => { const x = caja.querySelector<HTMLElement>('[data-alm-error]'); if (x) x.textContent = m ?? ''; };
    caja.querySelector<HTMLButtonElement>('[data-vaciar-carro]')?.addEventListener('click', async (ev) => {
      (ev.currentTarget as HTMLButtonElement).disabled = true;
      error(await ejecutar('vaciarCarro', { heroeId: p.heroeId }));
    });
    caja.querySelector<HTMLInputElement>('[data-almacen-cerrar]')?.addEventListener('change', async (ev) => {
      const c = ev.currentTarget as HTMLInputElement;
      error(await ejecutar('cerrarAlmacenACiudadanos', { asentamientoId: c.dataset.almacenCerrar!, cerrado: c.checked }));
    });
  };
  caja.querySelector('.alm-selector')?.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-alm-sitio]');
    if (!b) return;
    elegidos.set(grupo(sitios), b.dataset.almSitio!);
    caja.innerHTML = new DOMParser().parseFromString(htmlAlmacenes(p, sitios, e), 'text/html').querySelector('.alm-varios')!.innerHTML;
    aplicarAyudas(caja);
    // el selector es nuevo: se vuelve a cablear todo
    cablearAlmacenes(raiz, p, sitios, ejecutar, e);
  });
  cablearDentro();
}
