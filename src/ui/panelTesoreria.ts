// La RESERVA (en la ventana del Almacén) y las POLÍTICAS (pestaña «Políticas» de Gobierno) de la antigua Tesorería (Doc 4.2 y 4.4): la RESERVA de recursos del Tesorero (`calibrarReservaManual`) y las POLÍTICAS de cargo (`activarPolitica`).
// Reserva: lo que la auto-construcción no puede tocar, 0-999 por recurso; solo el Tesorero residente y presente la calibra. Políticas: cada cargo activa las de su pool
// (el Gobernador, cualquiera); duran un plazo fijo, no se cancelan, y el cargo tiene un número limitado de slots. El catálogo, los slots y la duración salen del balance;
// el servidor valida y su rechazo sale flotando.
import { catalogoDePoliticas, type PoliticaDelCatalogo } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { textoEnTiempoReal } from './estadoCliente';
import { ayuda } from './ayuda';
import type { ContextoPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';
import { cablearPlegables, plegable } from './plegable';
import { mostrar as mostrarAviso } from './avisos';
import { barraAvance } from './juegoVisual';
import { CARGO_EMBLEMA } from './participacion';

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

/** Cómo se dice cada efecto del catálogo: icono, nombre y si bajarlo es bueno (tiempos, consumos, costes y comisiones). */
const EFECTOS: Record<string, [string, string, boolean]> = {
  factorConsumoComida: ['🍞', 'consumo de comida', true],
  factorCrecimientoNobleza: ['👑', 'crecimiento de la nobleza', false],
  factorTiempoConstruccion: ['🔨', 'tiempo de obra', true],
  factorComisionExterna: ['🪙', 'comisión del comercio exterior', true],
  factorCostoReclutamiento: ['⚔️', 'coste de reclutar', true],
  factorProduccionTrigo: ['🌾', 'producción de trigo', false],
  factorCapacidadCaravana: ['📦', 'capacidad de las caravanas', false],
  factorVelocidadCaravana: ['🐎', 'velocidad de las caravanas', false],
  factorRecaudacion: ['💰', 'recaudación de oro', false],
  factorCrecimientoPoblacion: ['👪', 'crecimiento de la población', false],
  factorTiempoMuralla: ['🧱', 'tiempo de muralla', true],
  factorProduccionTalleres: ['⚒️', 'producción de los talleres', false],
};
const SUMAS: Record<string, [string, string]> = { cupoCaravanaExtra: ['🐂', 'caravana de flota'], cupoGuarnicionExtra: ['🛡️', 'de guarnición por héroe'] };

/** Los efectos de una política como chips: icono y porcentaje, en verde lo que favorece a la plaza y en rojo lo que la castiga. */
function chipsEfecto(def: PoliticaDelCatalogo, e: (s: string) => string): string {
  return Object.entries(def).flatMap(([campo, v]) => {
    if (typeof v === 'number' && EFECTOS[campo]) {
      const [icono, nombre, bajarEsBueno] = EFECTOS[campo];
      const pct = Math.round((v - 1) * 100);
      const bueno = bajarEsBueno ? v < 1 : v > 1;
      return [`<span class="efecto ${bueno ? 'bueno' : 'malo'}" title="${e(`${nombre} ×${v}`)}">${icono} ${pct > 0 ? '+' : '−'}${Math.abs(pct)}%</span>`];
    }
    if (typeof v === 'number' && SUMAS[campo]) return [`<span class="efecto bueno" title="${e(`+${v} ${SUMAS[campo][1]}`)}">${SUMAS[campo][0]} +${v}</span>`];
    return campo === 'perfilTrazado' ? [`<span class="efecto neutro" title="${e(`El trazado de la ciudad tiende a «${v}»`)}">🗺️ ${e(String(v))}</span>`] : [];
  }).join('');
}

/**
 * Tesorería, con aire de juego (2026-11-02). Reserva: una ficha por recurso con lo que hay frente a lo que cabe y una raya roja donde empieza la
 * reserva (lo que la auto-construcción no toca). Políticas: cada cargo con su emblema, sus slots en casillas, lo que tiene en vigor con la barra de lo
 * que le queda y, si es el tuyo, las que puede activar como cartas con sus efectos en chips (verde favorece, rojo castiga).
 */
export function htmlReservaRecursos(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, resideAqui: reside, escapar: e } = c;
  const presente = p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id;
  const puede = reside && presente;
  const motivo = !reside ? 'Solo quien reside en esta plaza' : !presente ? 'Tienes que estar en la plaza' : '';
  const esTesorero = a.cargos?.tesoreroId === p.heroeId;
  const calibra = esTesorero && puede;

  // Solo los recursos que la plaza produce o guarda, y los que ya tienen reserva; el Tesorero añade otros con «+ Añadir recurso».
  const almacen = a.almacen ?? {};
  const produce = (r: string): number => almacen[r]?.produccion ?? almacen[r]?.producido ?? Math.max(0, almacen[r]?.porMinuto ?? 0);
  const borrador = borradorReserva.get(a.id) ?? {};
  const visibles = RECURSOS_RESERVA.filter((r) => produce(r) > 0 || (almacen[r]?.cantidad ?? 0) >= 1 || (a.reservaManual?.[r] ?? 0) > 0 || r in borrador || (calibra && anadidos.get(a.id)?.has(r)));
  const resto = RECURSOS_RESERVA.filter((r) => !visibles.includes(r));
  const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const fichas = visibles.map((r) => {
    const guardada = Math.round(a.reservaManual?.[r] ?? 0);
    const valor = borrador[r] ?? guardada;
    const hay = Math.floor(almacen[r]?.cantidad ?? 0);
    const cabe = Math.max(1, almacen[r]?.capacidad ?? Math.max(hay, valor, 1));
    const bajo = valor > 0 && hay < valor;
    return `<div class="reserva-ficha${valor > 0 ? ' con' : ''}${valor !== guardada ? ' cambiada' : ''}${bajo ? ' bajo' : ''}" title="${e(`${RECURSO_NOMBRE[r] ?? r}: hay ${hay} de ${cabe}${valor ? ` · reserva ${valor}${bajo ? ' (por debajo: la auto-construcción no lo gasta)' : ''}` : ''}`)}">
      <span class="reserva-icono" aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</span>
      <span class="reserva-cuerpo"><b>${e(RECURSO_NOMBRE[r] ?? r)}</b><small>${hay}${produce(r) > 0 ? ` · ▲${fmt(produce(r))}/min` : ''}</small>
        <span class="reserva-barra"><i style="width:${Math.min(100, (hay / cabe) * 100).toFixed(1)}%"></i>${valor > 0 ? `<em style="left:${Math.min(100, (valor / cabe) * 100).toFixed(1)}%"></em>` : ''}</span></span>
      ${calibra ? `<input class="form-input${valor !== guardada ? ' tesoreria-cambiada' : ''}" type="number" min="0" max="999" step="1" value="${valor}" data-reserva="${e(r)}" aria-label="Reserva de ${e(RECURSO_NOMBRE[r] ?? r)}" />` : `<span class="reserva-valor">${guardada ? `🔒 ${guardada}` : '—'}</span>`}
    </div>`;
  }).join('');
  const cambios = Object.keys(borrador).filter((r) => borrador[r] !== Math.round(a.reservaManual?.[r] ?? 0)).length;
  const conReserva = visibles.filter((r) => Math.round(a.reservaManual?.[r] ?? 0) > 0).length;
  const reserva = `<div class="obra-titulo"><span class="faction-kicker">Reserva de recursos</span><span class="obra-chip" title="Recursos con reserva">🔒 ${conReserva}</span>${ayuda('plaza:tesoreria-reserva', 'Lo que la auto-construcción no gasta: se suma a la reserva que ya guarda sola. De 0 a 999 por recurso; no afecta a lo que añades a mano a la cola. En cada ficha, la raya roja marca dónde empieza la reserva.')}</div>
    ${a.cargos?.tesoreroId ? '' : '<p class="asent-lado-nota">Esta plaza no tiene Tesorero: sin él no se puede calibrar la reserva.</p>'}
    ${calibra || !a.cargos?.tesoreroId ? '' : `<p class="asent-lado-nota">${esTesorero ? `${motivo} para calibrarla.` : 'Solo el Tesorero de la plaza calibra la reserva.'}</p>`}
    ${visibles.length ? `<div class="reserva-rejilla">${fichas}</div>` : '<p class="mapa-lista-vacia">La plaza no produce ni guarda nada todavía.</p>'}
    ${calibra ? `<div class="reserva-pie">
      ${resto.length ? `<select class="form-input" data-reserva-anadir aria-label="Añadir recurso"><option value="">＋ Añadir recurso</option>${resto.map((r) => `<option value="${e(r)}">${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</option>`).join('')}</select>` : ''}
      ${cambios ? '<button class="puerta-deshacer" type="button" data-reserva-descartar>Descartar</button>' : ''}
      <button class="reserva-guardar" type="button" data-reserva-guardar${cambios ? '' : ' disabled'}>🔒 Guardar${cambios ? ` (${cambios})` : ''}</button></div>` : ''}`;

  return reserva;
}

/** Políticas de cargo, en la pestaña «Políticas» de Gobierno (Víctor, 2026-11-04: la reserva pasó al Almacén). */
export function htmlPoliticas(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, resideAqui: reside, escapar: e } = c;
  const presente = p.heroe.ubicacion.tipo === 'asentamiento' && p.heroe.ubicacion.asentamientoId === a.id;
  const puede = reside && presente;
  const motivo = !reside ? 'Solo quien reside en esta plaza' : !presente ? 'Tienes que estar en la plaza' : '';
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
      const pips = `<span class="consejo-slots" title="Slots: ${activas.length} de ${limite} en uso">${Array.from({ length: Math.max(limite, activas.length) }, (_, i) => `<i class="${i < activas.length ? 'usado' : ''}"></i>`).join('')}</span>`;
      const enVigor = activas.map((x) => {
        const def = catalogo.find((d) => d.id === x.politicaId);
        const dura = Math.max(1, x.expiraEn - x.activadaEn);
        return `<div class="politica-carta activa"><span class="politica-nombre"><b>${e(def?.nombre ?? x.politicaId)}</b><small>⏳ ${textoEnTiempoReal(x.expiraEn - p.instante)}</small></span>
          <span class="politica-efectos">${def ? chipsEfecto(def, e) : ''}</span>${barraAvance(Math.max(0, Math.min(1, (x.expiraEn - p.instante) / dura)))}</div>`;
      }).join('');
      let ofrecidas = '';
      if (titular && mio) {
        const pool = catalogo.filter((d) => cargo === 'gobernador' || d.cargo === cargo).filter((d) => !activas.some((x) => x.politicaId === d.id));
        const carta = (d: PoliticaDelCatalogo): string => {
            const bloqueo = !puede ? motivo : lleno ? 'Sin slots libres' : '';
            const ajena = cargo === 'gobernador' && d.cargo !== 'gobernador' ? `<span class="politica-pool" title="Del pool de ${e(CARGOS.find((x) => x[0] === d.cargo)?.[1] ?? d.cargo)}">${CARGO_EMBLEMA[d.cargo] ?? ''}</span>` : '';
            return `<div class="politica-carta"><span class="politica-nombre"><b>${e(d.nombre)}</b>${ajena}</span><span class="politica-efectos">${chipsEfecto(d, e)}</span>
              <button class="politica-activar" type="button" data-politica="${e(cargo)}:${e(d.id)}"${bloqueo ? ` disabled title="${e(bloqueo)}"` : ''}>▶ Activar</button></div>`;
        };
        // El Gobernador puede activar las de cualquier pool: las suyas a la vista y las de los demás cargos, plegadas.
        const propias = pool.filter((d) => d.cargo === cargo);
        const ajenas = pool.filter((d) => d.cargo !== cargo);
        ofrecidas = `${puede ? '' : `<p class="asent-lado-nota">${motivo} para activar políticas.</p>`}
          ${propias.length ? `<div class="politica-cartas">${propias.map(carta).join('')}</div>` : ''}
          ${ajenas.length ? plegable(`tesoreria-pool:${a.id}`, `De los otros cargos · ${ajenas.length}`, `<div class="politica-cartas">${ajenas.map(carta).join('')}</div>`) : ''}`;
      }
      return `<div class="consejo-cargo${mio ? ' mio' : ''}${titular ? '' : ' vacante'}">
        <div class="consejo-cab"><span class="cargo-emblema" aria-hidden="true">${CARGO_EMBLEMA[cargo] ?? ''}</span><span class="consejo-titulo"><strong>${nombre}</strong><small>${titular ? e(nombreDeHeroe(p, titular)) : 'vacante: sin titular no se activa ninguna'}</small></span>${pips}</div>
        ${enVigor ? `<div class="politica-cartas">${enVigor}</div>` : ''}${ofrecidas}</div>`;
    }).join('');
  }
  return politicas;
}

/** Cablea la reserva y las políticas (cada una solo encuentra lo suyo en la ventana que la pinta). */
export function cablearTesoreria(c: ContextoPlaza): void {
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
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
    if (cambios.some(([, v]) => !(v >= 0 && v <= 999))) { mostrarAviso('La reserva va de 0 a 999.', true); return; }
    // Una orden por recurso (`calibrarReservaManual`); se para en el primer rechazo y lo que quedó sin guardar sigue en el borrador.
    boton.disabled = true;
    for (const [recurso, valor] of cambios) {
      const mensaje = await c.ejecutar('calibrarReservaManual', { asentamientoId: a.id, recurso, valor });
      if (mensaje) { boton.disabled = false; mostrarAviso(mensaje, true); return; }
      const resto = { ...(borradorReserva.get(a.id) ?? {}) };
      delete resto[recurso];
      borradorReserva.set(a.id, resto);
    }
    c.refrescar();
  });
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-politica]').forEach((b) => b.addEventListener('click', () => {
    const [cargo, politicaId] = b.dataset.politica!.split(':');
    void lanzar(b, 'activarPolitica', { asentamientoId: c.asentamiento.id, cargo, politicaId });
  }));
}
