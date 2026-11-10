// Pestaña «RECLUTAMIENTO» de la plaza: el árbol de reclutamiento (Víctor, 2026-11-06; `arbolReclutamiento.ts`). Todas las tropas en carriles por
// el edificio donde se reclutan, con su estado en esta plaza; un clic abre su ficha, y la que está lista se recluta desde ahí con
// `reclutarTropa { asentamientoId, heroeId, tropaId }`. Solo recluta: reponer va aparte (Víctor, 2026-11-06), y con la escuadra hecha no hay botón
// (un héroe tiene una escuadra por tropa). Lo que no llega (equipo, oro, gente libre) va en rojo y lo deshabilita. El oro por soldado sale del
// balance como en el motor; si algo falla, el rechazo del servidor se enseña tal cual.
// Quién recluta (motor 906fb24, cliente 0.199.0): quien reside en la plaza y, en una plaza de su Facción donde no reside, el ciudadano que entró
// con su columna y no está vetado, mientras la plaza no lo haya cerrado: su escuadra nueva va a esa columna (y tiene que caber en su Liderazgo).
// Cerrado, el ciudadano solo repone (en su Base). El Gobernador y el General residentes lo abren y lo cierran con un interruptor
// (`cerrarReclutamientoACiudadanos`).
import type { ProyeccionJugador } from '../apiCliente';
import { costeDeLiderazgo, oroPorSoldado, tropasReclutables } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { mostrar as mostrarAviso } from './avisos';
import { htmlArbolReclutamiento, montarArbolReclutamiento, ultimoDibujo } from './arbolReclutamiento';
import { resideEnPlaza, tieneCargoEnPlaza } from './cargosPlaza';
import { miColumna } from './ejercitos';
import { chipsDeCoste } from './juegoVisual';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const ORIGEN = (escalon: number): 'pesants' | 'artesanos' | 'nobleza' => (escalon <= 2 ? 'pesants' : escalon === 3 ? 'artesanos' : 'nobleza');
const ORIGEN_ICONO: Record<string, string> = { pesants: '🌾', artesanos: '⚒️', nobleza: '👑' };

/** Cómo recluta el jugador en `a` (`reclutamiento::permiso` del motor): `todo` si reside; `ciudadano` si es de su Facción, no reside y no está
 * vetado (escuadras nuevas a su columna); `soloReponer` si además la plaza lo cerró; `no` en otro caso. */
export type PermisoDeReclutar = 'todo' | 'ciudadano' | 'soloReponer' | 'no';
export function permisoDeReclutar(p: ProyeccionJugador, a: Asentamiento): PermisoDeReclutar {
  if (resideEnPlaza(p, a)) return 'todo';
  if (!p.faccionId || a.faccionId !== p.faccionId || (a.vetadosIds ?? []).includes(p.heroeId)) return 'no';
  return a.reclutamientoCerradoACiudadanos ? 'soloReponer' : 'ciudadano';
}

/** El Liderazgo que ya lleva fuera del campamento y de la guarnición de visita de `a` (lo que cuenta el motor para la escuadra nueva de un
 * ciudadano, que va a su columna). */
export function liderazgoFuera(p: ProyeccionJugador, a: Asentamiento): number {
  return p.heroe.escuadrones
    .filter((s) => s.contenedor.tipo !== 'campamento' && !(s.contenedor.tipo === 'plaza' && s.contenedor.asentamientoId === a.id))
    .reduce((t, s) => t + s.costeLiderazgo, 0);
}

/** ¿Abre y cierra el reclutamiento a los ciudadanos? El Gobernador o el General de la plaza, que residen en ella (y están dentro: es su ventana). */
export const mandaReclutamiento = (p: ProyeccionJugador, a: Asentamiento): boolean =>
  resideEnPlaza(p, a) && (tieneCargoEnPlaza(p, a, 'gobernador') || tieneCargoEnPlaza(p, a, 'general'));

/** Lo que va bajo el tooltip de la ficha fija: reclutar (si se puede aquí) o por qué no. */
function acciones(p: ProyeccionJugador, a: Asentamiento, e: Escapar, id: string): string {
  const d = ultimoDibujo();
  const t = d?.G.nodos.get(id)?.d;
  if (!d || !t) return '';
  const nota = (txt: string): string => `<p class="ta-ficha-nota">${txt}</p>`;
  const tuya = d.E.escuadras[id];
  if (tuya !== undefined) return nota(`Ya tienes una escuadra de ${e(t.nombre)} (${tuya}/${t.unidadesPorDefecto}).`);
  if (!d.E.adoptadas.includes(t.tecnologia) || (t.edificio !== 'centroUrbano' && (d.E.niveles[t.edificio] ?? 0) < t.nivelRequerido)) return '';
  const permiso = permisoDeReclutar(p, a);
  if (permiso === 'no') return nota((a.vetadosIds ?? []).includes(p.heroeId) ? 'Estás vetado en esta plaza: aquí no reclutas.' : 'Solo quien reside en esta plaza o es ciudadano de su Facción recluta aquí.');
  if (permiso === 'soloReponer') return nota('Esta plaza ha cerrado el reclutamiento a los ciudadanos que no residen en ella: aquí solo repones las escuadras que ya tienes (en tu Base, tecla B).');
  // El ciudadano que no reside: la escuadra nueva va a la columna con la que entró y tiene que caber en su Liderazgo.
  let liderazgo: string | null = null;
  if (permiso === 'ciudadano') {
    if (!miColumna(p)) return nota('Sin residir aquí, la escuadra nueva va a la columna con la que entras, y has entrado sin ella.');
    const usado = liderazgoFuera(p, a) + costeDeLiderazgo(t.id);
    if (usado > p.heroe.liderazgoBase) liderazgo = `No cabe en tu Liderazgo (${usado} / ${p.heroe.liderazgoBase})`;
  }
  const origen = ORIGEN(t.escalon);
  const libres = Math.floor(a.poblacion?.[origen] ?? 0);
  const oro = oroPorSoldado(t) ?? 0;
  const porSoldado: Record<string, number> = { ...(t.costoEquipo as Record<string, number>) };
  if (oro > 0) porSoldado['oro'] = (porSoldado['oro'] ?? 0) + oro;
  const coste = Object.fromEntries(Object.entries(porSoldado).map(([r, n]) => [r, Math.ceil(n * t.unidadesPorDefecto)]).filter(([, n]) => (n as number) > 0)) as Record<string, number>;
  const faltaRec = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
  const faltaGente = libres < t.unidadesPorDefecto;
  const motivo = liderazgo ?? (faltaRec ? 'El almacén de la plaza no tiene bastante' : faltaGente ? `No hay ${t.unidadesPorDefecto} ${origen} libres en la plaza` : '');
  return `<div class="ta-ficha-recluta">
      <span class="obra-chip${faltaGente ? ' baja' : ''}" title="Salen de los ${origen} libres de la plaza">${ORIGEN_ICONO[origen]} ${libres} ${origen} libres</span>
    </div>
    ${permiso === 'ciudadano' ? `<p class="ta-ficha-nota${liderazgo ? ' falta' : ''}">${liderazgo ? `${e(liderazgo)}: la escuadra nueva va a tu columna.` : 'Va a tu columna y come de sus víveres; la paga la plaza.'}</p>` : ''}
    <button class="btn-primary ta-ficha-boton" type="button" data-ficha-reclutar="${e(id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>⚔ Reclutar ${t.unidadesPorDefecto} <span class="recl-costes">${Object.keys(coste).length ? chipsDeCoste(a, coste, e) : 'sin coste'}</span></button>`;
}

/** El árbol de reclutamiento de la plaza, con la gente libre arriba. */
let escapar: Escapar = (s) => s;
export function htmlReclutamiento(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar: () => void): string {
  escapar = e;
  if (!tropasReclutables(alCargar)) return '<p class="mapa-lista-vacia">Cargando el catálogo de tropas…</p>';
  const pob = a.poblacion;
  const info = ayuda('plaza:reclutamiento', 'Todas las tropas, en carriles por el edificio donde se reclutan; si la plaza no tiene ese edificio, su carril se pliega. Pasa el ratón por una tropa para ver qué pide y haz clic para abrir su ficha: si está lista, la reclutas desde ahí con el equipo del almacén y la gente libre de la plaza. Recluta quien reside en la plaza y, mientras la plaza no lo cierre, el ciudadano de su Facción que entra con su columna: su escuadra nueva va a esa columna. Cada héroe tiene una escuadra por tropa.<br>El servidor no deja reclutar si dejaría la producción sin brazos.');
  const gente = pob ? (['pesants', 'artesanos', 'nobleza'] as const).map((k) => `<span class="obra-chip" title="${k} libres">${ORIGEN_ICONO[k]} ${Math.floor(pob[k])}</span>`).join('') : '';
  return `<div class="obra-titulo"><span class="faction-kicker">Reclutamiento</span>${gente}${info}</div>
    ${htmlCierreACiudadanos(p, a)}${htmlNotaDeCiudadano(p, a)}
    <div class="tec-arbol recl-arbol">${htmlArbolReclutamiento(p, a, e, alCargar)}</div>`;
}

/** Para quien no reside: cómo recluta aquí, en una línea encima del árbol (la ficha de cada tropa lo repite junto al botón). */
export function htmlNotaDeCiudadano(p: ProyeccionJugador, a: Asentamiento): string {
  const permiso = permisoDeReclutar(p, a);
  const texto = permiso === 'todo' ? ''
    : permiso === 'soloReponer' ? 'Esta plaza ha cerrado el reclutamiento a los ciudadanos que no residen en ella: aquí solo repones las escuadras que ya tienes (en tu Base, tecla B).'
      : permiso === 'no' ? ((a.vetadosIds ?? []).includes(p.heroeId) ? 'Estás vetado en esta plaza: aquí no reclutas.' : '')
        : miColumna(p) ? 'No resides aquí: la escuadra nueva que reclutes va a tu columna, come de sus víveres y la paga la plaza.'
          : 'No resides aquí y has entrado sin columna: la escuadra nueva iría a ella, así que para reclutar entra con tu columna.';
  return texto ? `<p class="asent-lado-nota recl-nota">${texto}</p>` : '';
}

/** El interruptor del Gobernador y el General: encendido, los ciudadanos que no residen solo reponen. A los demás no se les enseña. */
export function htmlCierreACiudadanos(p: ProyeccionJugador, a: Asentamiento): string {
  if (!mandaReclutamiento(p, a)) return '';
  const cerrado = Boolean(a.reclutamientoCerradoACiudadanos);
  return `<label class="interruptor recl-cierre" title="Encendido, los ciudadanos de tu Facción que no residen aquí solo reponen las escuadras que ya tienen en la plaza">
      <input type="checkbox" data-recl-cerrar="${a.id}"${cerrado ? ' checked' : ''} />
      <span class="interruptor-pista" aria-hidden="true"><i></i></span><span>Cerrar el reclutamiento a los ciudadanos</span><small>${cerrado ? 'solo reponen' : 'reclutan a su columna'}</small>
    </label>`;
}

export function cablearReclutamiento(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar, _repintar: () => void): void {
  raiz.querySelectorAll<HTMLInputElement>('[data-recl-cerrar]').forEach((c) => c.addEventListener('change', async () => {
    c.disabled = true;
    const mensaje = await ejecutar('cerrarReclutamientoACiudadanos', { asentamientoId: c.dataset.reclCerrar!, cerrado: c.checked });
    c.disabled = false;
    if (mensaje !== null) { c.checked = !c.checked; mostrarAviso(mensaje, true); }
  }));
  const arbol = raiz.querySelector<HTMLElement>('.recl-arbol');
  if (!arbol) return;
  montarArbolReclutamiento(arbol, {
    acciones: (id) => acciones(p, a, escapar, id),
    cablearAcciones: (caja) => caja.querySelectorAll<HTMLButtonElement>('[data-ficha-reclutar]').forEach((b) => b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      b.disabled = true;
      const mensaje = await ejecutar('reclutarTropa', { asentamientoId: a.id, heroeId: p.heroeId, tropaId: b.dataset.fichaReclutar! });
      const campo = caja.querySelector<HTMLElement>('[data-campo="error-ficha-reclutamiento"]');
      if (mensaje !== null) { b.disabled = false; if (campo) campo.textContent = mensaje; }
    })),
  });
}
