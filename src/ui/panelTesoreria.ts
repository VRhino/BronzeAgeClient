// Subpestaña «Tesorería» de Centro urbano (Doc 4.2 y 4.4): la RESERVA de recursos del Tesorero (`calibrarReservaManual`) y las POLÍTICAS de cargo (`activarPolitica`).
// Reserva: lo que la auto-construcción no puede tocar, 0-999 por recurso; solo el Tesorero residente y presente la calibra. Políticas: cada cargo activa las de su pool
// (el Gobernador, cualquiera); duran un plazo fijo, no se cancelan, y el cargo tiene un número limitado de slots. El catálogo, los slots y la duración salen del balance;
// el servidor valida y su rechazo se enseña tal cual.
import { catalogoDePoliticas, type PoliticaDelCatalogo } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';
import type { ContextoPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';
import { cablearPlegables, plegable } from './plegable';

type Cargo = 'gobernador' | 'tesorero' | 'general' | 'maestroObras' | 'sacerdote';
const CARGOS: [Cargo, string, keyof NonNullable<Asentamiento['cargos']>][] = [
  ['gobernador', 'Gobernador', 'gobernadorId'],
  ['tesorero', 'Tesorero', 'tesoreroId'],
  ['maestroObras', 'Maestro de Obras', 'maestroObrasId'],
  ['general', 'General', 'generalId'],
  ['sacerdote', 'Sacerdote', 'sacerdoteId'],
];
const RECURSOS_RESERVA = Object.keys(RECURSO_NOMBRE).filter((r) => r !== 'oro');

/** Lo que el Tesorero lleva escrito sin guardar, por plaza (el panel se repinta con el sondeo). */
const borradorReserva = new Map<string, Record<string, number>>();
/** Recursos que el Tesorero añadió a la tabla aunque la plaza no los produzca ni los tenga. */
const anadidos = new Map<string, Set<string>>();

/** Cómo se dice cada efecto del catálogo: etiqueta del factor (multiplicador) o del cupo (suma). */
const EFECTOS: Record<string, string> = {
  factorConsumoComida: 'consumo de comida',
  factorCrecimientoNobleza: 'crecimiento de la nobleza',
  factorTiempoConstruccion: 'tiempo de obra',
  factorComisionExterna: 'comisión del comercio exterior',
  factorCostoReclutamiento: 'coste de reclutar',
  factorProduccionTrigo: 'producción de trigo',
  factorCapacidadCaravana: 'capacidad de las caravanas',
  factorVelocidadCaravana: 'velocidad de las caravanas',
  factorRecaudacion: 'recaudación de oro',
  factorCrecimientoPoblacion: 'crecimiento de la población',
  factorTiempoMuralla: 'tiempo de muralla',
  factorProduccionTalleres: 'producción de los talleres',
};
const SUMAS: Record<string, string> = { cupoCaravanaExtra: 'caravana de flota', cupoGuarnicionExtra: 'de guarnición por héroe' };

function textoEfecto(def: PoliticaDelCatalogo): string {
  const partes = Object.entries(def).flatMap(([campo, v]) => {
    if (typeof v === 'number' && EFECTOS[campo]) return [`${EFECTOS[campo]} ×${v}`];
    if (typeof v === 'number' && SUMAS[campo]) return [`+${v} ${SUMAS[campo]}`];
    return campo === 'perfilTrazado' ? [`el trazado de la ciudad tiende a «${v}»`] : [];
  });
  return partes.join(' · ');
}

export function htmlTesoreria(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, resideAqui: reside, escapar: e } = c;
  const presente = p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id;
  const puede = reside && presente;
  const motivo = !reside ? 'Solo quien reside en esta plaza' : !presente ? 'Tienes que estar en la plaza' : '';
  const esTesorero = a.cargos?.tesoreroId === p.heroeId;
  const calibra = esTesorero && puede;

  // Solo los recursos que la plaza produce o guarda, y los que ya tienen reserva; el Tesorero añade otros con «+ Añadir recurso».
  const almacen = a.almacen ?? {};
  const produce = (r: string): number => almacen[r]?.producido ?? Math.max(0, almacen[r]?.porMinuto ?? 0);
  const borrador = borradorReserva.get(a.id) ?? {};
  const visibles = RECURSOS_RESERVA.filter((r) => produce(r) > 0 || (almacen[r]?.cantidad ?? 0) >= 1 || (a.reservaManual?.[r] ?? 0) > 0 || r in borrador || (calibra && anadidos.get(a.id)?.has(r)));
  const resto = RECURSOS_RESERVA.filter((r) => !visibles.includes(r));
  const fmt = (n: number): string => (n === 0 ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));
  const filasReserva = visibles.map((r) => {
    const guardada = Math.round(a.reservaManual?.[r] ?? 0);
    const valor = borrador[r] ?? guardada;
    return `<tr><td>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</td><td>${Math.floor(almacen[r]?.cantidad ?? 0)}</td><td>${fmt(produce(r))}</td>
      <td>${calibra ? `<input class="form-input${valor !== guardada ? ' tesoreria-cambiada' : ''}" type="number" min="0" max="999" step="1" value="${valor}" data-reserva="${e(r)}" aria-label="Reserva de ${e(RECURSO_NOMBRE[r] ?? r)}" />` : guardada || '—'}</td></tr>`;
  }).join('');
  const cambios = Object.keys(borrador).filter((r) => borrador[r] !== Math.round(a.reservaManual?.[r] ?? 0)).length;
  const reserva = `<span class="faction-kicker">Reserva de recursos ${ayuda('plaza:tesoreria-reserva', 'Lo que la auto-construcción no gasta: se suma a la reserva que ya guarda sola. De 0 a 999 por recurso; no afecta a lo que añades a mano a la cola.')}</span>
    ${a.cargos?.tesoreroId ? '' : '<p class="asent-lado-nota">Esta plaza no tiene Tesorero: sin él no se puede calibrar la reserva.</p>'}
    ${calibra ? '' : `<p class="asent-lado-nota">${esTesorero ? `${motivo} para calibrarla.` : 'Solo el Tesorero de la plaza calibra la reserva.'}</p>`}
    ${visibles.length
      ? `<table class="tesoreria-tabla"><thead><tr><th>Recurso</th><th>Hay</th><th>Produce/min</th><th>Reserva</th></tr></thead><tbody>${filasReserva}</tbody></table>`
      : '<p class="mapa-lista-vacia">La plaza no produce ni guarda nada todavía.</p>'}
    ${calibra ? `<div class="mapa-seleccion-acciones">
      ${resto.length ? `<select class="form-input" data-reserva-anadir aria-label="Añadir recurso"><option value="">+ Añadir recurso</option>${resto.map((r) => `<option value="${e(r)}">${e(RECURSO_NOMBRE[r] ?? r)}</option>`).join('')}</select>` : ''}
      <button class="btn-primary" type="button" data-reserva-guardar${cambios ? '' : ' disabled'}>Guardar reserva${cambios ? ` (${cambios})` : ''}</button>
      ${cambios ? '<button class="btn-secondary" type="button" data-reserva-descartar>Descartar</button>' : ''}</div>` : ''}`;

  const datos = catalogoDePoliticas(c.refrescar);
  let politicas = '';
  if (!datos) politicas += '<p class="asent-lado-nota">Cargando el catálogo de políticas…</p>';
  else {
    const { catalogo, reglas } = datos;
    const nivelFaccion = p.facciones.find((f) => f.id === a.faccionId)?.nivel ?? 1;
    const sala = a.edificios.some((x) => x.tipo === 'salaConsejo' && x.estado === 'activo');
    const slots = (cargo: Cargo): number => {
      const cfg = reglas.slotsPorCargo[cargo];
      if (!cfg) return 0;
      if (cargo !== 'gobernador') return cfg.base;
      return Math.min(cfg.maximo, cfg.base + Math.floor(nivelFaccion / reglas.nivelFaccionPorSlotExtraGobernador)) + (sala ? reglas.slotSalaConsejo : 0);
    };
    politicas = `<p class="asent-lado-nota">${ayuda('plaza:tesoreria-politicas', `Cada cargo activa las políticas de su pool (el Gobernador, cualquiera). Duran ${textoEnTiempoReal(reglas.duracionMinutosPorDefecto * 60_000)} y no se pueden cancelar antes; ocupan un slot del cargo mientras estén en vigor. No tienen coste.`)} Cada cargo, con sus políticas en vigor y las que puede activar.</p>`;
    politicas += CARGOS.map(([cargo, nombre, campoId]) => {
      const titular = a.cargos?.[campoId];
      const mio = titular === p.heroeId;
      const activas = (a.politicasActivas ?? []).filter((x) => x.cargo === cargo);
      const limite = slots(cargo);
      const lleno = activas.length >= limite;
      const enVigor = activas.map((x) => {
        const def = catalogo.find((d) => d.id === x.politicaId);
        return `<div class="mapa-lista-item"><div><strong>${e(def?.nombre ?? x.politicaId)}</strong><span>${def ? e(textoEfecto(def)) : ''} · expira en ${textoEnTiempoReal(x.expiraEn - p.instante)}</span></div></div>`;
      }).join('');
      let ofrecidas = '';
      if (!titular) ofrecidas = '<p class="asent-lado-nota">Cargo vacante: sin titular no se activa ninguna política en su nombre.</p>';
      else if (!mio) ofrecidas = `<p class="asent-lado-nota">Solo ${e(nombreDeHeroe(p, titular))}, como ${nombre}, activa estas políticas.</p>`;
      else {
        const pool = catalogo.filter((d) => cargo === 'gobernador' || d.cargo === cargo);
        ofrecidas = `${puede ? '' : `<p class="asent-lado-nota">${motivo} para activar políticas.</p>`}
          <div class="mapa-lista">${pool.map((d) => {
            const yaActiva = activas.some((x) => x.politicaId === d.id);
            const bloqueo = !puede ? motivo : yaActiva ? 'Ya está activa' : lleno ? 'Sin slots libres' : '';
            return `<div class="mapa-lista-item"><div><strong>${e(d.nombre)}</strong><span>${e(textoEfecto(d))}${cargo === 'gobernador' && d.cargo !== 'gobernador' ? ` · pool de ${e(CARGOS.find((x) => x[0] === d.cargo)?.[1] ?? d.cargo)}` : ''}</span></div>
              <button class="btn-secondary" type="button" data-politica="${e(cargo)}:${e(d.id)}"${bloqueo ? ` disabled title="${e(bloqueo)}"` : ''}>Activar</button></div>`;
          }).join('')}</div>`;
      }
      return `<div class="escolta-caravana"><strong class="heroe-sub">${nombre} · ${titular ? e(nombreDeHeroe(p, titular)) : 'vacante'} · slots ${activas.length}/${limite}</strong>
        ${enVigor || '<p class="mapa-lista-vacia">Ninguna política en vigor.</p>'}${ofrecidas}</div>`;
    }).join('');
  }
  const enVigor = (a.politicasActivas ?? []).length;
  return `${reserva}${plegable(`tesoreria-politicas:${a.id}`, `Políticas de cargo · ${enVigor ? `${enVigor} en vigor` : 'ninguna en vigor'}`, politicas)}<p class="faction-error" data-campo="error-tesoreria" role="alert"></p>`;
}

export function cablearTesoreria(c: ContextoPlaza): void {
  const error = c.cuerpo.querySelector<HTMLElement>('[data-campo="error-tesoreria"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  const a = c.asentamiento;
  cablearPlegables(c.cuerpo);
  c.cuerpo.querySelectorAll<HTMLInputElement>('input[data-reserva]').forEach((i) => {
    i.addEventListener('input', () => {
      const borrador = { ...(borradorReserva.get(a.id) ?? {}), [i.dataset.reserva!]: Math.round(Number(i.value)) };
      borradorReserva.set(a.id, borrador);
    });
    i.addEventListener('change', () => c.refrescar());
  });
  c.cuerpo.querySelector<HTMLSelectElement>('[data-reserva-anadir]')?.addEventListener('change', (ev) => {
    const r = (ev.currentTarget as HTMLSelectElement).value;
    if (!r) return;
    anadidos.set(a.id, new Set([...(anadidos.get(a.id) ?? []), r]));
    c.refrescar();
  });
  c.cuerpo.querySelector<HTMLButtonElement>('[data-reserva-descartar]')?.addEventListener('click', () => { borradorReserva.delete(a.id); c.refrescar(); });
  c.cuerpo.querySelector<HTMLButtonElement>('[data-reserva-guardar]')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget as HTMLButtonElement;
    const borrador = borradorReserva.get(a.id) ?? {};
    const cambios = Object.entries(borrador).filter(([r, v]) => v !== Math.round(a.reservaManual?.[r] ?? 0));
    if (cambios.some(([, v]) => !(v >= 0 && v <= 999))) { if (error) error.textContent = 'La reserva va de 0 a 999.'; return; }
    // Una orden por recurso (`calibrarReservaManual`); se para en el primer rechazo y lo que quedó sin guardar sigue en el borrador.
    boton.disabled = true;
    for (const [recurso, valor] of cambios) {
      const mensaje = await c.ejecutar('calibrarReservaManual', { asentamientoId: a.id, recurso, valor });
      if (mensaje) { boton.disabled = false; if (error) error.textContent = mensaje; return; }
      const resto = { ...(borradorReserva.get(a.id) ?? {}) };
      delete resto[recurso];
      borradorReserva.set(a.id, resto);
    }
    if (error) error.textContent = '';
    c.refrescar();
  });
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-politica]').forEach((b) => b.addEventListener('click', () => {
    const [cargo, politicaId] = b.dataset.politica!.split(':');
    void lanzar(b, 'activarPolitica', { asentamientoId: c.asentamiento.id, cargo, politicaId });
  }));
}
