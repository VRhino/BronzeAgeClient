// Pestaña «RECLUTAMIENTO» de la plaza: reclutar o reponer tropa con `reclutarTropa { asentamientoId, heroeId, tropaId }`. Todos los edificios militares juntos.
// Solo se ENSEÑA lo que la Facción puede reclutar ya (tecnología adoptada, edificio activo y de nivel suficiente): lo bloqueado por eso se esconde. Lo que depende
// del momento (residencia, la escuadra que ya tienes, hombres libres, equipo) se dice en la fila. Un héroe tiene como mucho UNA escuadra por tropa en toda la partida:
// si ya la tiene, reclutar la REPONE y solo donde está. El oro por soldado sale del balance como en el motor (escalón + caballos; la tropa del Centro Urbano no paga; «Leva Forzosa» solo toca el equipo); si algo falla, el rechazo del servidor se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import { oroPorSoldado, tropasReclutables, type TropaReclutable } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const ORDEN_EDIFICIO = ['centroUrbano', 'barracon', 'galeriaDeTiro', 'caballerizas'];
const ORIGEN = (escalon: number): 'pesants' | 'artesanos' | 'nobleza' => (escalon <= 2 ? 'pesants' : escalon === 3 ? 'artesanos' : 'nobleza');

function resideAqui(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** Tecnologías que adoptó la Facción propia; `null` si el backend no las manda (entonces no se filtra por tecnología). */
function adoptadasDe(p: ProyeccionJugador): string[] | null {
  const t = p.tecnologia as { propias?: { adoptadas?: string[] } | null } | undefined;
  return t?.propias?.adoptadas ?? (t ? [] : null);
}

function fila(t: TropaReclutable, p: ProyeccionJugador, a: Asentamiento, reside: boolean, e: Escapar): string {
  const existente = p.heroe.escuadrones.find((s) => s.tropaId === t.id && !s.prestada);
  const falta = t.unidadesPorDefecto - (existente?.cantidad ?? 0);
  const origen = ORIGEN(t.escalon);
  const libres = a.poblacion?.[origen] ?? 0;
  const almacen = a.almacen ?? {};
  const oroUnidad = oroPorSoldado(t) ?? 0;
  const coste = Object.entries(oroUnidad > 0 ? { ...t.costoEquipo, oro: (t.costoEquipo['oro'] ?? 0) + oroUnidad } : t.costoEquipo)
    .map(([r, n]) => {
      const total = Math.ceil((n ?? 0) * Math.max(falta, 0));
      const hay = Math.floor(almacen[r]?.cantidad ?? 0);
      return `<span class="recl-coste${hay < total ? ' falta' : ''}" title="Hay ${hay} en el almacén">${RECURSO_ICONO[r] ?? '📦'} ${total} ${e(RECURSO_NOMBRE[r] ?? r)}</span>`;
    })
    .join('');

  let bloqueo = '';
  if (falta <= 0) bloqueo = 'Escuadra al completo.';
  else if (existente && existente.contenedor.tipo !== 'campamento') bloqueo = 'Tu escuadra está fuera del campamento: solo se repone donde está.';
  else if (!reside) bloqueo = 'Solo quien reside en esta plaza recluta aquí.';
  const tienes = existente ? `Tienes ${existente.cantidad}/${t.unidadesPorDefecto}` : `${t.unidadesPorDefecto} hombres`;
  return `<div class="mapa-lista-item recl-fila">
    <div>
      <strong>${e(t.nombre)}</strong> <span class="recl-esc" title="Escalón de élite">Esc. ${t.escalon}</span>
      <span>${tienes} · salen de ${origen} (${Math.floor(libres)})</span>
      <div class="recl-costes">${coste || '<span class="recl-coste">sin coste de equipo</span>'}</div>
      ${bloqueo ? `<small class="asent-lado-nota">${bloqueo}</small>` : ''}
    </div>
    <button class="btn-primary" type="button" data-reclutar="${e(t.id)}"${bloqueo ? ' disabled' : ''}>${existente ? `Reponer +${falta}` : 'Reclutar'}</button>
  </div>`;
}

export function htmlReclutamiento(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar: () => void): string {
  const tropas = tropasReclutables(alCargar);
  if (!tropas) return '<p class="mapa-lista-vacia">Cargando el catálogo de tropas…</p>';
  const adoptadas = adoptadasDe(p);
  const nivelDe = (tipo: string): number => Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === tipo && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
  const disponibles = tropas.filter((t) => (adoptadas === null || adoptadas.includes(t.tecnologia)) && nivelDe(t.edificio) >= t.nivelRequerido);
  const reside = resideAqui(p, a);
  const porEdificio = ORDEN_EDIFICIO.map((tipo) => [tipo, disponibles.filter((t) => t.edificio === tipo).sort((x, y) => x.escalon - y.escalon)] as const).filter(([, l]) => l.length > 0);
  const pob = a.poblacion;
  const info = ayuda('plaza:reclutamiento', 'Los militares de la plaza, juntos. Reclutas con el equipo del almacén; si ya tienes una escuadra de esa tropa, solo la repones hasta completarla. Aquí solo salen las tropas que tu Facción ya puede formar: otras llegan con más tecnología o edificios militares mejores.<br>El servidor no deja reclutar si dejaría la producción sin brazos.');
  return `<span class="faction-kicker">Reclutamiento ${info}</span>
    ${pob ? `<p class="asent-lado-nota">Gente libre: ${Math.floor(pob.pesants)} pesants · ${Math.floor(pob.artesanos)} artesanos · ${Math.floor(pob.nobleza)} nobleza.</p>` : ''}
    ${porEdificio.length === 0
      ? '<p class="mapa-lista-vacia">Aún no puedes reclutar ninguna tropa: hace falta la tecnología y el edificio militar de cada una.</p>'
      : porEdificio.map(([tipo, lista]) => `<strong class="heroe-sub">${e(EDIFICIO_NOMBRE[tipo] ?? tipo)} · nivel ${nivelDe(tipo)}</strong><div class="mapa-lista">${lista.map((t) => fila(t, p, a, reside, e)).join('')}</div>`).join('')}
    <p class="faction-error" data-campo="error-reclutar" role="alert"></p>`;
}

export function cablearReclutamiento(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-reclutar"]');
  raiz.querySelectorAll<HTMLButtonElement>('[data-reclutar]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const mensaje = await ejecutar('reclutarTropa', { asentamientoId: a.id, heroeId: p.heroeId, tropaId: boton.dataset.reclutar! });
      if (mensaje !== null) { boton.disabled = false; if (error) error.textContent = mensaje; }
    })
  );
}
