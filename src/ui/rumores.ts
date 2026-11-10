// Los rumores de la taberna (motor 906fb24, contrato 0.21.0; cliente 0.199.0). El único por ahora, las vetas de estaño: `comprarRumor { origen,
// tipo: 'vetas_estano' }` deja explorado para tu Facción un disco alrededor de cada yacimiento de estaño de la región del relieve donde está la
// taberna (`INTEL.rumores.vetasEstano`: precio y radio), como si una columna hubiera andado por allí; llega por la máscara de exploración. Se
// compra donde se compra la intel: en la taberna de una plaza de tu Facción el Rey, el Embajador o el Gobernador (paga el almacén de la plaza) y
// en la de un campamento cualquier héroe con Facción (paga su almacén personal si reside allí; si no, el carro). Si la Facción ya tiene
// explorados todos esos yacimientos, el motor lo rechaza sin cobrar: aquí se mira lo mismo con el mapa y la máscara, y entonces no hay botón.
import type { ProyeccionJugador } from '../apiCliente';
import { exploradoDe } from '../mundo/capasDelMapa';
import { regionEn, type Region } from '../mundo/region';
import { RECURSO_ICONO } from '../paletas';
import type { MapaGenerado } from '../terreno';
import { ayuda } from './ayuda';
import { estadoCliente } from './estadoCliente';
import type { TabernaDisponible } from './panelIntel';
import { compraIntelEn } from './tabernaRegion';

type Escapar = (valor: string) => string;

/** El tipo de nodo del mapa de los yacimientos de estaño (`Tipo::MinaEstano` del motor). */
const NODO_ESTANO = 'estano';

/** ¿Puede comprar rumores en esta taberna? En la de una plaza, quien compra la intel en ella; en la de un campamento, cualquiera con Facción. */
export function compraRumores(p: ProyeccionJugador, t: TabernaDisponible): boolean {
  if (!p.faccionId) return false;
  if (t.origen.tipo === 'campamento') return true;
  const plaza = [...p.asentamientos, ...(p.plazasPropias ?? [])].find((a) => a.id === t.origen.id);
  return Boolean(plaza && compraIntelEn(p, plaza, true));
}

/** Las vetas de estaño de la región de `posicion` que tu Facción aún no tiene exploradas (las que contaría el rumor), y la región. `null` sin el
 * mapa o fuera de toda región. */
export function vetasPorContar(p: ProyeccionJugador, posicion: { x: number; y: number }, mapa: MapaGenerado | null | undefined = estadoCliente.mapaCache?.mapa): { region: Region; nuevas: number } | null {
  const region = regionEn(mapa, posicion);
  if (!mapa || !region) return null;
  const explorado = exploradoDe(p.exploracion);
  const nuevas = (mapa.nodos ?? []).filter((n) => n.tipo === NODO_ESTANO && regionEn(mapa, n.posicion)?.id === region.id && !explorado(n.posicion.x, n.posicion.y)).length;
  return { region, nuevas };
}

/** La tarjeta «Rumores» de la taberna `t`, solo para quien puede comprar. */
export function htmlServicioRumores(p: ProyeccionJugador, t: TabernaDisponible, e: Escapar): string {
  if (!compraRumores(p, t)) return '';
  const cuenta = vetasPorContar(p, t.posicion);
  if (!cuenta) return '';
  const { oro: precio, radio } = p.tarifasIntel.rumores?.vetasEstano ?? { oro: 0, radio: 0 };
  const caro = precio > t.oro;
  const paga = t.origen.tipo === 'asentamiento' ? 'el almacén de la plaza' : 'tu oro (el de tu almacén si resides en el campamento; si no, el del carro)';
  const boton = cuenta.nuevas === 0
    ? '<em class="intel-rumor-sabido">Tu Facción ya lo sabe</em>'
    : `<button class="intel-comprar" type="button" data-rumor-comprar="vetas_estano"${caro ? ` disabled title="No te llegan ${precio} de oro"` : ''}>Comprar <span class="intel-precio${caro ? ' falta' : ''}">${RECURSO_ICONO['oro'] ?? '🪙'} ${precio}</span></button>`;
  const info = ayuda('plaza:intel-rumores', `Lo que se cuenta en la taberna de la región del relieve donde está. Las vetas de estaño: el terreno a ${radio} de cada yacimiento de estaño de la región queda explorado para tu Facción, como si lo hubiera andado una columna; no deja ver lo que pase después. Lo paga ${paga}. Si tu Facción ya lo sabe todo, no se vende. Nadie se entera.`);
  return `<section class="intel-servicio intel-rumores">
    <div class="intel-servicio-cab"><span class="intel-servicio-icono" aria-hidden="true">🗣</span><span><strong>Rumores</strong><small>${e(cuenta.region.nombre)}</small></span>${info}</div>
    <div class="intel-region-fila">
      <span class="intel-region-icono" aria-hidden="true">⛏</span>
      <span class="intel-region-texto"><b>Vetas de estaño de la región</b><small>${cuenta.nuevas === 0 ? 'Ya tiene exploradas todas las de esta región.' : 'Deja explorado el terreno de alrededor de cada una.'}</small></span>
      ${boton}
    </div>
  </section>`;
}
