// Pausar el consumo de un bien por plaza (motor 906fb24, contrato 0.21.0; cliente 0.199.0). El Gobernador o el Tesorero, residentes y dentro,
// pausan o reanudan en la ventana del Almacén el consumo de carne, pan, queso, vino, cerveza o aceite (`pausarConsumo { asentamientoId, recurso,
// pausado }`): la población deja de comerlo y su clase pierde el empuje al crecimiento que daba, el trigo pone lo que cubría y la guarnición no come
// la carne. Sirve para guardarlo y venderlo. Lo pausado llega en `Asentamiento.consumoPausado` (dentro y, para las plazas de tu Facción, desde
// fuera): lo ven todos los de dentro en el Almacén, en el letrero de la Nutrición y en la ventana de Facción. El trigo nunca se pausa.
import { bloqueDeDatos, type ProyeccionJugador } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { mostrar as mostrarAviso } from './avisos';
import { dentroDePlaza, resideEnPlaza, tieneCargoEnPlaza } from './cargosPlaza';

type Escapar = (valor: string) => string;
type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** Los bienes de consumo, en el orden del catálogo (`BIENES_DE_CONSUMO.bienes`; sin el bloque, los seis del motor). */
const BIENES_DE_SERIE = ['carne', 'pan', 'queso', 'vino', 'cerveza', 'aceite'];
export function bienesDeConsumo(): string[] {
  const bienes = bloqueDeDatos<{ bienes?: Record<string, unknown> }>('BIENES_DE_CONSUMO')?.bienes;
  const lista = bienes ? Object.keys(bienes).filter((r) => r !== 'trigo') : [];
  return lista.length ? lista : BIENES_DE_SERIE;
}

/** ¿Pausa el consumo en `a`? El Gobernador o el Tesorero, que residen en ella y están dentro (`Cargo(GOBERNADOR_O_TESORERO)` del motor). */
export const pausaConsumo = (p: ProyeccionJugador, a: Asentamiento): boolean =>
  resideEnPlaza(p, a) && dentroDePlaza(p, a) && (tieneCargoEnPlaza(p, a, 'gobernador') || tieneCargoEnPlaza(p, a, 'tesorero'));

const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const icono = (r: string): string => RECURSO_ICONO[r] ?? '📦';

/** Lo pausado en una línea («🥩 Carne y 🍞 Pan»), o `''`. */
export function textoPausados(a: Asentamiento): string {
  const l = (a.consumoPausado ?? []).map((r) => `${icono(r)} ${nombre(r)}`);
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}

/** La línea del letrero de la Nutrición (barra de la plaza y ventana de Facción), o `null` sin nada pausado. */
export function lineaDeNutricion(a: Asentamiento): string | null {
  return a.consumoPausado?.length ? `Consumo pausado: ${textoPausados(a)}. No se come; el trigo pone lo que cubría.` : null;
}

/** El bloque del Almacén: a quien pausa, un interruptor por bien (los que la plaza tiene o produce, y los pausados); a los demás, solo lo pausado. */
export function htmlPausarConsumo(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const pausados = new Set(a.consumoPausado ?? []);
  if (!pausaConsumo(p, a)) {
    return pausados.size ? `<div class="almacen-consumo"><div class="obra-titulo"><span class="faction-kicker">Consumo pausado</span></div>
      <p class="asent-lado-nota">${e(textoPausados(a))}: la población no lo come y el trigo pone lo que cubría. Lo deciden el Gobernador y el Tesorero.</p></div>` : '';
  }
  const almacen = a.almacen ?? {};
  const bienes = bienesDeConsumo().filter((r) => pausados.has(r) || (almacen[r]?.cantidad ?? 0) >= 1 || (almacen[r]?.produccion ?? almacen[r]?.producido ?? 0) > 0);
  const info = ayuda('plaza:pausar-consumo', 'Pausado, la población no come ese bien y su tipo de población pierde lo que le hacía crecer; el trigo pone lo que cubría. La guarnición tampoco come la carne pausada. Sirve para guardarlo y venderlo. El trigo nunca se pausa.');
  const filas = bienes.map((r) => {
    const pausado = pausados.has(r);
    return `<label class="interruptor consumo-pausa${pausado ? ' pausado' : ''}" title="${e(pausado ? `Pausado: la población no come ${nombre(r).toLowerCase()}` : `Clic para que la población deje de comer ${nombre(r).toLowerCase()}`)}">
        <input type="checkbox" data-consumo-pausar="${e(r)}"${pausado ? ' checked' : ''} />
        <span class="interruptor-pista" aria-hidden="true"><i></i></span><span>${icono(r)} ${e(nombre(r))}</span><small>${pausado ? 'pausado' : 'se come'}</small>
      </label>`;
  }).join('');
  return `<div class="almacen-consumo">
      <div class="obra-titulo"><span class="faction-kicker">Pausar consumo</span>${pausados.size ? `<span class="obra-chip" title="Bienes con el consumo pausado">⏸ ${pausados.size}</span>` : ''}${info}</div>
      ${filas ? `<div class="consumo-pausas">${filas}</div>` : '<p class="mapa-lista-vacia">La plaza no tiene ni produce ningún bien de consumo todavía.</p>'}
    </div>`;
}

/** Cablea los interruptores: cada cambio manda `pausarConsumo`; si el servidor lo rechaza, vuelve atrás. */
export function cablearPausarConsumo(raiz: ParentNode, a: Asentamiento, ejecutar: Ejecutar): void {
  raiz.querySelectorAll<HTMLInputElement>('[data-consumo-pausar]').forEach((c) => c.addEventListener('change', async () => {
    c.disabled = true;
    const mensaje = await ejecutar('pausarConsumo', { asentamientoId: a.id, recurso: c.dataset.consumoPausar!, pausado: c.checked });
    c.disabled = false;
    if (mensaje !== null) { c.checked = !c.checked; mostrarAviso(mensaje, true); }
  }));
}
