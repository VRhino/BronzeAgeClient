// Subpestaña «Fundación» de Centro urbano (Doc 1.8): lanzar la Caravana de Fundación desde la plaza (`lanzarCaravanaFundacion`) y desarmarla (`desarmarCaravanaFundacion`).
// La lanza un residente presente, que pasa a ser su titular; nace parada en la plaza y sin destino: se engancha a la columna y se funda con `fundar` donde se esté (riel «Fundar» del mapa).
// Gates a la vez (los valida el servidor; aquí se enseñan con su motivo): coste completo en el almacén, nivel 2, cooldown de creación y cupo del Cap de Fundación.
import { capDeFundacion, cooldownDeCaravanaMinutos, costoCompletoDeCaravanaDeFundacion } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';
import type { ContextoPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';

/** A qué distancia de la puerta de su origen se puede desarmar (`MOVIMIENTO.radioPuerta`). */
const RADIO_PUERTA = 10;
const ESTADO: Record<string, string> = {
  disponible: 'suelta',
  adjunta: 'enganchada a una columna',
  aparcada: 'aparcada en una plaza',
  en_transito: 'en camino',
  retornando: 'de vuelta a su origen',
};

export function htmlFundacionDePlaza(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, resideAqui: reside, escapar: e } = c;
  const presente = p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id;
  const faccion = p.facciones.find((f) => f.id === a.faccionId);
  const costo = costoCompletoDeCaravanaDeFundacion(c.refrescar);
  const cap = capDeFundacion(faccion?.nivel ?? 1, c.refrescar);

  const filas = costo
    ? Object.entries(costo).map(([r, n]) => {
        const hay = Math.floor(a.almacen?.[r]?.cantidad ?? 0);
        const falta = Math.max(0, n - hay);
        return `<div class="fondo-fila${falta === 0 ? ' listo' : ''}"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span>
          <div class="fondo-barra"><i style="width:${Math.min(100, (hay / n) * 100).toFixed(1)}%"></i></div>
          <strong>${Math.min(hay, n)} / ${n}</strong>
          <small>${falta === 0 ? '✓ en el almacén' : `<span class="recl-coste falta">faltan ${falta}</span>`}</small></div>`;
      }).join('')
    : '<p class="asent-lado-nota">Cargando el coste de la caravana…</p>';
  const faltantes = costo ? Object.entries(costo).filter(([r, n]) => Math.floor(a.almacen?.[r]?.cantidad ?? 0) < n) : [];

  // Cada gate: ¿se cumple? y, si no, por qué.
  const nivel = a.nivelActual ?? a.nivel;
  const msCooldown = a.ultimaCaravanaCreadaEn === undefined ? 0 : Math.max(0, a.ultimaCaravanaCreadaEn + cooldownDeCaravanaMinutos(c.refrescar) * 60_000 - p.instante);
  const propias = p.asentamientos.filter((x) => x.faccionId === a.faccionId).length;
  const vivas = p.caravanas.filter((k) => k.tipo === 'construccion' && (k.faccionId ?? a.faccionId) === a.faccionId).length;
  const gates: [boolean, string, string][] = [
    [reside && presente, 'Residente presente', !reside ? 'solo la lanza quien reside en esta plaza' : 'tienes que estar en la plaza'],
    [nivel >= 2, 'Plaza de nivel 2 o más', `la plaza es de nivel ${nivel}`],
    [msCooldown === 0, 'Sin enfriamiento de caravanas', `faltan ~${textoEnTiempoReal(msCooldown)} (lo comparten las caravanas comerciales)`],
    [cap === null || propias + vivas < cap, 'Cupo del Cap de Fundación', `${propias + vivas}/${cap} contando las caravanas ya lanzadas (nivel de Facción ${faccion?.nivel ?? 1})`],
    [costo !== null && faltantes.length === 0, 'Coste completo en el almacén', costo ? `faltan ${faltantes.map(([r, n]) => `${n - Math.floor(a.almacen?.[r]?.cantidad ?? 0)} de ${e(RECURSO_NOMBRE[r] ?? r)}`).join(', ')}` : 'aún no se conoce el coste'],
  ];
  const lanzable = gates.every(([ok]) => ok);

  const mias = p.caravanas.filter((k) => k.tipo === 'construccion' && k.origenAsentamientoId === a.id && k.origenCampamentoId === undefined);
  const lista = mias.length === 0 ? '<p class="mapa-lista-vacia">Esta plaza no tiene ninguna Caravana de Fundación en pie.</p>' : `<div class="mapa-lista">${mias.map((k) => {
    const estado = k.estado ?? 'disponible';
    const suelta = estado === 'disponible' || estado === 'aparcada';
    const enLaPuerta = Math.hypot(k.posicionActual.x - a.posicion.x, k.posicionActual.y - a.posicion.y) <= RADIO_PUERTA;
    const titular = k.titularId === p.heroeId;
    const desarmar = titular && estado === 'disponible' && enLaPuerta;
    const nota = !titular ? `la lleva ${e(k.titularId ? nombreDeHeroe(p, k.titularId) : '—')}: solo su titular la desarma`
      : estado !== 'disponible' ? 'para desarmarla tiene que estar suelta (desengánchala primero)'
        : !enLaPuerta ? 'para desarmarla tiene que estar en la puerta de su plaza' : '';
    return `<div class="mapa-lista-item"><div><strong>${e(k.id)}</strong><span>${ESTADO[estado] ?? e(estado)} · titular ${e(k.titularId ? nombreDeHeroe(p, k.titularId) : '—')}${suelta && k.caducaEn !== undefined ? ` · caduca en ${textoEnTiempoReal(k.caducaEn - p.instante)}` : ''}${nota ? ` · ${nota}` : ''}</span></div>
      <button class="btn-secondary" type="button" data-desarmar="${e(k.id)}"${desarmar ? '' : ' disabled'}>Desarmar</button></div>`;
  }).join('')}</div>`;

  return `<span class="faction-kicker">Caravana de Fundación ${ayuda('plaza:fundacion', 'Fundar un asentamiento nuevo exige una Caravana de Fundación. La plaza paga su coste entero del almacén; quien la lanza es su titular. Nace parada aquí, sin destino: engánchala a tu columna (riel «Fundar» del mapa) y funda donde estés. Si nadie la lleva caduca y el coste vuelve al almacén; desarmarla a mano también lo devuelve.')}</span>
    <strong class="heroe-sub">Coste (sale del almacén de la plaza)</strong>
    ${filas}
    <strong class="heroe-sub">Requisitos</strong>
    ${gates.map(([ok, texto, porque]) => `<p class="asent-lado-nota">${ok ? '✓' : '✗'} ${texto}${ok ? '' : ` — ${porque}`}</p>`).join('')}
    <button class="btn-primary" type="button" data-lanzar-fundacion${lanzable ? '' : ' disabled'}>Lanzar caravana</button>
    <strong class="heroe-sub">Caravanas de fundación de esta plaza</strong>
    ${lista}
    <p class="faction-error" data-campo="error-fundacion" role="alert"></p>`;
}

export function cablearFundacionDePlaza(c: ContextoPlaza): void {
  const error = c.cuerpo.querySelector<HTMLElement>('[data-campo="error-fundacion"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  c.cuerpo.querySelector<HTMLButtonElement>('[data-lanzar-fundacion]')?.addEventListener('click', (ev) =>
    void lanzar(ev.currentTarget as HTMLButtonElement, 'lanzarCaravanaFundacion', { origenAsentamientoId: c.asentamiento.id }));
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-desarmar]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('¿Desarmar la Caravana de Fundación? El coste vuelve al almacén de la plaza.')) void lanzar(b, 'desarmarCaravanaFundacion', { caravanaId: b.dataset.desarmar! });
  }));
}
