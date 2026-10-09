// «Mercado de la plaza» en la ficha del MAPA: tomar en persona una orden de la plaza (`comerciarEnPlaza`, backend Doc 3.3 y
// `Comercio_Fisico_Definicion.md`). Exige una columna PROPIA a la puerta de la plaza y ser su Líder; el servidor «sirve lo que puede»
// (el tope real sale de la orden, el almacén de la plaza, su oro, tu carro y lo que llevas) y devuelve `{ cantidad, valor, comision }`.
// Aquí solo se avisa de lo evidente (sin columna, lejos, no Líder, caducada): el que decide es el servidor y su rechazo se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import { RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';

type Escapar = (valor: string) => string;

/** A qué distancia de la puerta de una plaza se comercia (`MOVIMIENTO.radioPuerta`). */
const RADIO_PUERTA = 10;

interface ContextoMercado {
  ejecutarConDatos: (tipo: string, params: object) => Promise<{ error: string | null; datos?: unknown }>;
  aviso: (texto: string) => void;
}

const num = (n: number): string => n.toFixed(1);

/** Lo que falta para caducar, en tiempo de MUNDO (como el panel de órdenes de la plaza propia). */
const falta = (ms: number): string => (ms >= 3_600_000 ? `${Math.round(ms / 3_600_000)} h` : ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.max(0, Math.round(ms / 1000))} s`);

/** Por qué no se puede tomar ninguna orden de esta plaza ahora; vacío = se puede. */
function motivoGeneral(p: ProyeccionJugador, plazaId: string): string {
  const columna = p.ejercitos.find((e) => e.participantes.some((x) => x.heroeId === p.heroeId));
  const plaza = [...p.asentamientosAvistados, ...p.asentamientos].find((a) => a.id === plazaId);
  if (!columna || !plaza) return 'Sal al mundo con tu columna y plántala a la puerta de la plaza.';
  // Las plazas a la vista traen sus edificios activos: sin Mercado activo no hay órdenes que servir.
  if (plaza.edificios && !plaza.edificios.some((x) => x.tipo === 'mercado' && x.estado === 'activo')) return 'Esa plaza no tiene un Mercado activo.';
  const d = Math.round(Math.hypot(columna.posicionActual.x - plaza.posicion.x, columna.posicionActual.y - plaza.posicion.y));
  if (d > RADIO_PUERTA) return `Acércate a la puerta: estás a ${d} y se comercia a ${RADIO_PUERTA}.`;
  if (columna.liderId !== p.heroeId) return 'Solo el Líder de la columna comercia con su carro.';
  return '';
}

export function htmlMercadoDePlaza(p: ProyeccionJugador, plazaId: string, e: Escapar): string {
  const ordenes = (p.ordenes ?? []).filter((o) => o.asentamientoId === plazaId && o.estado === 'activa');
  if (ordenes.length === 0) return '';
  const general = motivoGeneral(p, plazaId);
  const filas = ordenes.map((o) => {
    const pendiente = o.cantidad - o.cantidadCumplida;
    const caducada = p.instante >= o.expiraEn;
    const motivo = general || (caducada ? 'La orden ha caducado.' : '');
    const titulo = motivo ? ` title="${e(motivo)}"` : '';
    const nombre = e(RECURSO_NOMBRE[o.recurso] ?? o.recurso);
    return `<div class="mapa-lista-item" data-orden-fila="${e(o.id)}">
      <div><strong>${o.tipo === 'venta' ? 'Vende' : 'Compra'} ${nombre}</strong><br><span>${num(pendiente)} pendientes · ${o.precioUnitario.toFixed(2)} de oro c/u · caduca en ${falta(o.expiraEn - p.instante)}</span></div>
      <input class="form-input" type="number" min="1" step="1" value="${Math.max(1, Math.floor(pendiente))}" data-orden-cantidad="${e(o.id)}" aria-label="Cantidad" ${motivo ? 'disabled' : ''}${titulo} />
      <button class="btn-primary" type="button" data-orden-tomar="${e(o.id)}"${motivo ? ' disabled' : ''}${titulo}>${o.tipo === 'venta' ? 'Comprar' : 'Vender'}</button>
      ${motivo && !general ? `<p class="mapa-lista-vacia">${e(motivo)}</p>` : ''}
    </div>`;
  }).join('');
  // El motivo general (el mismo para todas las órdenes) sale una vez, no en cada fila.
  return `<strong class="heroe-sub">Mercado de la plaza${ayuda('mapa:mercado-plaza', 'Tomas la orden en persona con tu carro: pagas o cobras en oro del carro, más la comisión de la plaza. Se sirve lo que se pueda.')}</strong>
    ${general ? `<p class="mapa-lista-vacia">${e(general)}</p>` : ''}
    <div class="mapa-lista">${filas}</div>`;
}

export function cablearMercadoDePlaza(cont: HTMLElement, plazaId: string, ctx: ContextoMercado, heroeId: string): void {
  cont.querySelectorAll<HTMLButtonElement>('[data-orden-tomar]').forEach((boton) => boton.addEventListener('click', async () => {
    const ordenId = boton.dataset.ordenTomar!;
    const campo = Array.from(cont.querySelectorAll<HTMLInputElement>('[data-orden-cantidad]')).find((i) => i.dataset.ordenCantidad === ordenId);
    const cantidad = Number(campo?.value);
    const error = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
    if (!(cantidad > 0)) { if (error) error.textContent = 'Pon una cantidad positiva.'; return; }
    boton.disabled = true;
    const { error: mensaje, datos } = await ctx.ejecutarConDatos('comerciarEnPlaza', { heroeId, asentamientoId: plazaId, ordenId, cantidad });
    if (mensaje) {
      boton.disabled = false;
      if (error) error.textContent = mensaje;
      ctx.aviso(mensaje);
      return;
    }
    if (error) error.textContent = '';
    const d = datos as { cantidad: number; valor: number; comision: number } | undefined;
    ctx.aviso(d ? `Servido: ${num(d.cantidad)} por ${num(d.valor)} de oro (comisión ${num(d.comision)}).` : 'Orden tomada.');
  }));
}
