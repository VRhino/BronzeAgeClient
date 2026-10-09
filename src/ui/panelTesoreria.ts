// Subpestaña «Tesorería» de Centro urbano (Doc 4.2 y 4.4): la RESERVA de recursos del Tesorero (`calibrarReservaManual`) y las POLÍTICAS de cargo (`activarPolitica`).
// Reserva: lo que la auto-construcción no puede tocar, 0-999 por recurso; solo el Tesorero residente y presente la calibra. Políticas: cada cargo activa las de su pool
// (el Gobernador, cualquiera); duran un plazo fijo, no se cancelan, y el cargo tiene un número limitado de slots. El catálogo, los slots y la duración salen del balance;
// el servidor valida y su rechazo se enseña tal cual.
import { catalogoDePoliticas, type PoliticaDelCatalogo } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { textoEnTiempoReal } from './estadoCliente';
import type { ContextoPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';

type Cargo = 'gobernador' | 'tesorero' | 'general' | 'maestroObras' | 'sacerdote';
const CARGOS: [Cargo, string, keyof NonNullable<Asentamiento['cargos']>][] = [
  ['gobernador', 'Gobernador', 'gobernadorId'],
  ['tesorero', 'Tesorero', 'tesoreroId'],
  ['maestroObras', 'Maestro de Obras', 'maestroObrasId'],
  ['general', 'General', 'generalId'],
  ['sacerdote', 'Sacerdote', 'sacerdoteId'],
];
const RECURSOS_RESERVA = Object.keys(RECURSO_NOMBRE).filter((r) => r !== 'oro');

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

  const filasReserva = RECURSOS_RESERVA.filter((r) => calibra || (a.reservaManual?.[r] ?? 0) > 0).map((r) => {
    const valor = Math.round(a.reservaManual?.[r] ?? 0);
    const hay = Math.floor(a.almacen?.[r]?.cantidad ?? 0);
    return `<div class="carro-fila"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><small>hay ${hay}</small>
      ${calibra
        ? `<input class="form-input" type="number" min="0" max="999" step="1" value="${valor}" data-reserva="${e(r)}" /><button class="btn-secondary" type="button" data-reserva-fijar="${e(r)}">Fijar</button>`
        : `<strong>${valor}</strong>`}</div>`;
  }).join('');
  const reserva = `<span class="faction-kicker">Reserva de recursos</span>
    <p class="asent-lado-nota">Lo que la auto-construcción no gasta: se suma a la reserva que ya guarda sola. De 0 a 999 por recurso; no afecta a lo que añades a mano a la cola.</p>
    ${a.cargos?.tesoreroId ? '' : '<p class="asent-lado-nota">Esta plaza no tiene Tesorero: sin él no se puede calibrar la reserva.</p>'}
    ${calibra ? '' : `<p class="asent-lado-nota">${esTesorero ? `${motivo} para calibrarla.` : 'Solo el Tesorero de la plaza calibra la reserva.'}</p>`}
    ${filasReserva || '<p class="mapa-lista-vacia">No hay ninguna reserva fijada.</p>'}`;

  const datos = catalogoDePoliticas(c.refrescar);
  let politicas = '<span class="faction-kicker">Políticas de cargo</span>';
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
    politicas += `<p class="asent-lado-nota">Cada cargo activa las políticas de su pool (el Gobernador, cualquiera). Duran ${textoEnTiempoReal(reglas.duracionMinutosPorDefecto * 60_000)} y no se pueden cancelar antes; ocupan un slot del cargo mientras estén en vigor. No tienen coste.</p>`;
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
  return `${reserva}${politicas}<p class="faction-error" data-campo="error-tesoreria" role="alert"></p>`;
}

export function cablearTesoreria(c: ContextoPlaza): void {
  const error = c.cuerpo.querySelector<HTMLElement>('[data-campo="error-tesoreria"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-reserva-fijar]').forEach((b) => b.addEventListener('click', () => {
    const recurso = b.dataset.reservaFijar!;
    const valor = Number(c.cuerpo.querySelector<HTMLInputElement>(`input[data-reserva="${recurso}"]`)?.value);
    if (!(valor >= 0 && valor <= 999)) { if (error) error.textContent = 'La reserva va de 0 a 999.'; return; }
    void lanzar(b, 'calibrarReservaManual', { asentamientoId: c.asentamiento.id, recurso, valor });
  }));
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-politica]').forEach((b) => b.addEventListener('click', () => {
    const [cargo, politicaId] = b.dataset.politica!.split(':');
    void lanzar(b, 'activarPolitica', { asentamientoId: c.asentamiento.id, cargo, politicaId });
  }));
}
