// Pestaña «RECLUTAMIENTO» de la plaza: el árbol de reclutamiento (Víctor, 2026-11-06; `arbolReclutamiento.ts`). Todas las tropas en carriles por
// el edificio donde se reclutan, con su estado en esta plaza; un clic abre su ficha, y la que está lista se recluta desde ahí con
// `reclutarTropa { asentamientoId, heroeId, tropaId }`. Solo recluta: reponer va aparte (Víctor, 2026-11-06), y con la escuadra hecha no hay botón
// (un héroe tiene una escuadra por tropa). El botón sale solo a quien reside en la plaza; lo que no llega (equipo, oro, gente libre) va en rojo y
// lo deshabilita. El oro por soldado sale del balance como en el motor; si algo falla, el rechazo del servidor se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import { oroPorSoldado, tropasReclutables } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { htmlArbolReclutamiento, montarArbolReclutamiento, ultimoDibujo } from './arbolReclutamiento';
import { chipsDeCoste } from './juegoVisual';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const ORIGEN = (escalon: number): 'pesants' | 'artesanos' | 'nobleza' => (escalon <= 2 ? 'pesants' : escalon === 3 ? 'artesanos' : 'nobleza');
const ORIGEN_ICONO: Record<string, string> = { pesants: '🌾', artesanos: '⚒️', nobleza: '👑' };

function resideAqui(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** Lo que va bajo el tooltip de la ficha fija: reclutar (si se puede aquí) o por qué no. */
function acciones(p: ProyeccionJugador, a: Asentamiento, e: Escapar, id: string): string {
  const d = ultimoDibujo();
  const t = d?.G.nodos.get(id)?.d;
  if (!d || !t) return '';
  const nota = (txt: string): string => `<p class="ta-ficha-nota">${txt}</p>`;
  const tuya = d.E.escuadras[id];
  if (tuya !== undefined) return nota(`Ya tienes una escuadra de ${e(t.nombre)} (${tuya}/${t.unidadesPorDefecto}).`);
  if (!d.E.adoptadas.includes(t.tecnologia) || (t.edificio !== 'centroUrbano' && (d.E.niveles[t.edificio] ?? 0) < t.nivelRequerido)) return '';
  if (!resideAqui(p, a)) return nota('Solo quien reside en esta plaza recluta aquí.');
  const origen = ORIGEN(t.escalon);
  const libres = Math.floor(a.poblacion?.[origen] ?? 0);
  const oro = oroPorSoldado(t) ?? 0;
  const porSoldado: Record<string, number> = { ...(t.costoEquipo as Record<string, number>) };
  if (oro > 0) porSoldado['oro'] = (porSoldado['oro'] ?? 0) + oro;
  const coste = Object.fromEntries(Object.entries(porSoldado).map(([r, n]) => [r, Math.ceil(n * t.unidadesPorDefecto)]).filter(([, n]) => (n as number) > 0)) as Record<string, number>;
  const faltaRec = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
  const faltaGente = libres < t.unidadesPorDefecto;
  const motivo = faltaRec ? 'El almacén de la plaza no tiene bastante' : faltaGente ? `No hay ${t.unidadesPorDefecto} ${origen} libres en la plaza` : '';
  return `<div class="ta-ficha-recluta">
      <span class="obra-chip${faltaGente ? ' baja' : ''}" title="Salen de los ${origen} libres de la plaza">${ORIGEN_ICONO[origen]} ${libres} ${origen} libres</span>
    </div>
    <button class="btn-primary ta-ficha-boton" type="button" data-ficha-reclutar="${e(id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>⚔ Reclutar ${t.unidadesPorDefecto} <span class="recl-costes">${Object.keys(coste).length ? chipsDeCoste(a, coste, e) : 'sin coste'}</span></button>`;
}

/** El árbol de reclutamiento de la plaza, con la gente libre arriba. */
let escapar: Escapar = (s) => s;
export function htmlReclutamiento(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar: () => void): string {
  escapar = e;
  if (!tropasReclutables(alCargar)) return '<p class="mapa-lista-vacia">Cargando el catálogo de tropas…</p>';
  const pob = a.poblacion;
  const info = ayuda('plaza:reclutamiento', 'Todas las tropas, en carriles por el edificio donde se reclutan; si la plaza no tiene ese edificio, su carril se pliega. Pasa el ratón por una tropa para ver qué pide y haz clic para abrir su ficha: si está lista, la reclutas desde ahí con el equipo del almacén y la gente libre de la plaza. Recluta quien reside en la plaza, y cada héroe tiene una escuadra por tropa.<br>El servidor no deja reclutar si dejaría la producción sin brazos.');
  const gente = pob ? (['pesants', 'artesanos', 'nobleza'] as const).map((k) => `<span class="obra-chip" title="${k} libres">${ORIGEN_ICONO[k]} ${Math.floor(pob[k])}</span>`).join('') : '';
  return `<div class="obra-titulo"><span class="faction-kicker">Reclutamiento</span>${gente}${info}</div>
    <div class="tec-arbol recl-arbol">${htmlArbolReclutamiento(p, a, e, alCargar)}</div>`;
}

export function cablearReclutamiento(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar, _repintar: () => void): void {
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
