// Subpestaña «Fundación» de Centro urbano (Doc 1.8): lanzar la Caravana de Fundación desde la plaza (`lanzarCaravanaFundacion`) y desarmarla (`desarmarCaravanaFundacion`).
// La lanza un residente presente, que pasa a ser su titular; nace parada en la plaza y sin destino: se engancha a la columna y se funda con `fundar` donde se esté (riel «Fundar» del mapa).
// Gates a la vez (los valida el servidor, y su rechazo sale flotando; aquí se enseñan con su motivo): coste completo en el almacén, nivel 2, cooldown de creación y cupo del Cap de Fundación.
import { bloqueDeDatos, capDeFundacion, cooldownDeCaravanaMinutos, costoCompletoDeCaravanaDeFundacion, radioDePuerta } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';
import type { ContextoPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';
import { confirmar } from './dialogo';
import { mostrar as mostrarAviso } from './avisos';
import { barraAvance, ICONO_CARRETA } from './juegoVisual';

const ESTADO: Record<string, string> = {
  disponible: 'esperando dentro',
  adjunta: 'enganchada a una columna',
  aparcada: 'aparcada en una plaza',
  en_transito: 'en camino',
  retornando: 'de vuelta a su origen',
};

const ESTADO_ICONO: Record<string, string> = { disponible: '⚓', adjunta: '🔗', aparcada: '🅿️', en_transito: '➜', retornando: '↩' };

/**
 * Fundación, con aire de juego (2026-11-02): la carreta con su coste en fichas (lo que hay frente a lo que pide, con su barra; en rojo lo que falta),
 * los requisitos como pilotos (verde cumplido, rojo no, con el porqué) y «Lanzar»; las caravanas de la plaza en tarjetas con su estado, su titular y
 * la barra de lo que les queda antes de caducar.
 */
export function htmlFundacionDePlaza(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, resideAqui: reside, escapar: e } = c;
  const presente = p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id;
  const faccion = p.facciones.find((f) => f.id === a.faccionId);
  const costo = costoCompletoDeCaravanaDeFundacion(c.refrescar);
  const cap = capDeFundacion(faccion?.nivel ?? 1, c.refrescar);

  const fichas = costo
    ? Object.entries(costo).map(([r, n]) => {
        const hay = Math.floor(a.almacen?.[r]?.cantidad ?? 0);
        const falta = Math.max(0, n - hay);
        return `<span class="fundar-coste${falta ? ' falta' : ''}" title="${e(`${RECURSO_NOMBRE[r] ?? r}: ${falta ? `faltan ${falta}` : 'en el almacén'}`)}"><i aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</i><b>${Math.min(hay, n)}<small>/${n}</small></b>${barraAvance(Math.min(1, hay / n))}</span>`;
      }).join('')
    : '<p class="asent-lado-nota">Cargando el coste de la caravana…</p>';
  const faltantes = costo ? Object.entries(costo).filter(([r, n]) => Math.floor(a.almacen?.[r]?.cantidad ?? 0) < n) : [];

  // Cada gate: ¿se cumple? y, si no, por qué.
  const nivel = a.nivelActual ?? a.nivel;
  const msCooldown = a.ultimaCaravanaCreadaEn === undefined ? 0 : Math.max(0, a.ultimaCaravanaCreadaEn + cooldownDeCaravanaMinutos(c.refrescar) * 60_000 - p.instante);
  const propias = p.asentamientos.filter((x) => x.faccionId === a.faccionId).length;
  const vivas = p.caravanas.filter((k) => k.tipo === 'construccion' && (k.faccionId ?? a.faccionId) === a.faccionId).length;
  const gates: [boolean, string, string, string][] = [
    [reside && presente, '🏠', 'Residente presente', !reside ? 'solo la lanza quien reside en esta plaza' : 'tienes que estar en la plaza'],
    [nivel >= 2, '🏛️', 'Plaza de nivel 2 o más', `la plaza es de nivel ${nivel}`],
    [msCooldown === 0, '⏱', 'Sin enfriamiento de caravanas', `faltan ~${textoEnTiempoReal(msCooldown)} (lo comparten las caravanas comerciales)`],
    [cap === null || propias + vivas < cap, '🏕️', `Cupo de Fundación${cap !== null ? ` ${propias + vivas}/${cap}` : ''}`, `${propias + vivas}/${cap} contando las caravanas ya lanzadas (nivel de Facción ${faccion?.nivel ?? 1})`],
    [costo !== null && faltantes.length === 0, '📦', 'Coste completo en el almacén', costo ? `faltan ${faltantes.map(([r, n]) => `${n - Math.floor(a.almacen?.[r]?.cantidad ?? 0)} de ${e(RECURSO_NOMBRE[r] ?? r)}`).join(', ')}` : 'aún no se conoce el coste'],
  ];
  const lanzable = gates.every(([ok]) => ok);
  const pendientes = gates.filter(([ok]) => !ok).length;

  const caducidadMs = (bloqueDeDatos<{ caducidadCaravanaHoras?: number }>('FUNDACION', c.refrescar)?.caducidadCaravanaHoras ?? 0) * 3_600_000;
  const mias = p.caravanas.filter((k) => k.tipo === 'construccion' && k.origenAsentamientoId === a.id && k.origenCampamentoId === undefined);
  const lista = mias.length === 0 ? '<p class="mapa-lista-vacia">Esta plaza no tiene ninguna Caravana de Fundación en pie.</p>' : mias.map((k) => {
    const estado = k.estado ?? 'disponible';
    const suelta = estado === 'disponible' || estado === 'aparcada';
    const enLaPuerta = Math.hypot(k.posicionActual.x - a.posicion.x, k.posicionActual.y - a.posicion.y) <= radioDePuerta();
    const titular = k.titularId === p.heroeId;
    const desarmar = titular && estado === 'disponible' && enLaPuerta;
    const nota = !titular ? `La lleva ${e(k.titularId ? nombreDeHeroe(p, k.titularId) : '—')}: solo su titular la desarma.`
      : estado !== 'disponible' ? 'Para desarmarla tiene que estar suelta (desengánchala primero).'
        : !enLaPuerta ? 'Para desarmarla tiene que estar en la puerta de su plaza.' : '';
    const caduca = suelta && k.caducaEn !== undefined
      ? `<div class="fundar-caduca" title="Si nadie la lleva, caduca y el coste vuelve al almacén"><small>⌛ caduca en ${textoEnTiempoReal(k.caducaEn - p.instante)}</small>${caducidadMs > 0 ? barraAvance(Math.max(0, Math.min(1, (k.caducaEn - p.instante) / caducidadMs))) : ''}</div>` : '';
    return `<div class="caravana-tarjeta ${e(estado)}">
      <div class="caravana-cab"><span class="caravana-icono">${ICONO_CARRETA}</span><span class="caravana-titulo"><strong>Caravana ${e(k.id)}</strong><small>👤 ${e(k.titularId ? nombreDeHeroe(p, k.titularId) : '—')}${titular ? ' (tú)' : ''}</small></span><span class="caravana-estado ${e(estado)}">${ESTADO_ICONO[estado] ?? ''} ${ESTADO[estado] ?? e(estado)}</span></div>
      ${caduca}
      ${nota ? `<small class="asent-lado-nota">${nota}</small>` : ''}
      ${titular ? `<div class="anillo-acciones"><button class="anillo-abandonar" type="button" data-desarmar="${e(k.id)}"${desarmar ? ' title="El coste vuelve al almacén de la plaza"' : ` disabled title="${e(nota)}"`}>✕ Desarmar</button></div>` : ''}
    </div>`;
  }).join('');

  return `<div class="obra-titulo"><span class="faction-kicker">Caravana de Fundación</span>${ayuda('plaza:fundacion', 'Fundar un asentamiento nuevo exige una Caravana de Fundación. La plaza paga su coste entero del almacén; quien la lanza es su titular. Espera aquí dentro: cualquiera de tu Facción que salga como ejército puede llevársela (al partir, el Líder elige). Luego funda donde estés. Si nadie la lleva caduca y el coste vuelve al almacén; desarmarla a mano también lo devuelve.')}</div>
    <div class="fundar-tarjeta${lanzable ? ' lista' : ''}">
      <div class="fundar-cab"><span class="fundar-icono">${ICONO_CARRETA}</span><span class="fundar-titulo"><strong>Nueva caravana</strong><small>${lanzable ? 'Todo listo: sale del almacén de la plaza' : `Falta${pendientes === 1 ? '' : 'n'} ${pendientes} requisito${pendientes === 1 ? '' : 's'}`}</small></span></div>
      <div class="fundar-costes">${fichas}</div>
      <div class="fundar-reqs">${gates.map(([ok, icono, texto, porque]) => `<div class="fundar-req ${ok ? 'ok' : 'falta'}"><i aria-hidden="true">${ok ? '✓' : '✗'}</i><span aria-hidden="true">${icono}</span><span><b>${texto}</b>${ok ? '' : `<small>${porque}</small>`}</span></div>`).join('')}</div>
      <div class="fundar-pie"><button class="fundar-lanzar" type="button" data-lanzar-fundacion${lanzable ? '' : ' disabled'}>🏕️ Lanzar caravana</button></div>
    </div>
    <div class="obra-titulo"><span class="faction-kicker">De esta plaza</span><span class="obra-chip">${mias.length}</span></div>
    ${lista}`;
}

export function cablearFundacionDePlaza(c: ContextoPlaza): void {
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
  };
  c.cuerpo.querySelector<HTMLButtonElement>('[data-lanzar-fundacion]')?.addEventListener('click', (ev) =>
    void lanzar(ev.currentTarget as HTMLButtonElement, 'lanzarCaravanaFundacion', { origenAsentamientoId: c.asentamiento.id }));
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-desarmar]').forEach((b) => b.addEventListener('click', () => {
    void confirmar('El coste vuelve al almacén de la plaza.', { titulo: '¿Desarmar la Caravana de Fundación?', aceptar: 'Desarmar' }).then((ok) => { if (ok) void lanzar(b, 'desarmarCaravanaFundacion', { caravanaId: b.dataset.desarmar! }); });
  }));
}
