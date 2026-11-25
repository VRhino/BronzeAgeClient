// «CAMINO A TU PRIMERA PLAZA» (Víctor, 2026-11-22): en las pruebas de juego, muchos jugadores nuevos no encontraban cómo fundar su primera plaza (dónde
// sacar los materiales, dónde aportarlos, cómo llevarse la caravana) y lo dejaban a la hora. Mientras tu Facción no tiene plaza, una tarjeta arriba a la
// derecha (encima del rastreador de misiones) dice el paso en que estás y trae un botón que lo hace o te lleva allí. El paso sale de la proyección; la
// regla la sigue decidiendo el motor (Fundacion_Y_Refundacion §9 y §5):
//   1 faccion   sin Facción no se aporta al Fondo
//   2 botin     vencer a los bandidos del anillo del campamento (su botín de madera, piedra y trigo va al carro); sin tropa, primero pedirla prestada
//   3 aportar   llevar lo del carro (o del almacén) al Fondo de refundación del campamento donde resides
//   4 comprar   con el Fondo completo, comprar la Caravana de Fundación
//   5 llevar    salir del campamento como ejército llevándosela (una columna personal no lleva caravanas)
//   6 fundar    a 60 o más del campamento, en un sitio que valga, «Fundar aquí» (panel ⌂)
import type { ProyeccionJugador } from '../apiCliente';
import type { CampamentoMercenarios, Ejercito } from '../tiposDominio';
import { RECURSO_NOMBRE } from '../paletas';
import { distanciasDeFundar } from '../apiCliente';
import { aLaPuerta } from './puerta';

type Escapar = (valor: string) => string;
type Punto = { x: number; y: number };

export type PasoCamino = 'faccion' | 'botin' | 'aportar' | 'comprar' | 'llevar' | 'fundar';
export const PASOS: readonly PasoCamino[] = ['faccion', 'botin', 'aportar', 'comprar', 'llevar', 'fundar'];
const TITULO: Record<PasoCamino, string> = {
  faccion: 'Únete a una Facción',
  botin: 'Consigue materiales',
  aportar: 'Aporta al Fondo',
  comprar: 'Compra la Caravana de Fundación',
  llevar: 'Sal con la caravana',
  fundar: 'Funda tu plaza',
};

/** Lo que hace el botón del paso. Lo cablea quien pinta la tarjeta (main.ts), con lo de cada pantalla. */
export type AccionCamino =
  | { tipo: 'faccion' }
  | { tipo: 'parte'; parte: 'tropa' | 'fondo' }
  | { tipo: 'salir' }
  | { tipo: 'bandidos'; id: string; posicion: Punto }
  | { tipo: 'marchar'; posicion: Punto }
  | { tipo: 'entrar'; campamentoId: string }
  | { tipo: 'fundar' };

export interface Paso {
  id: PasoCamino;
  titulo: string;
  texto: string;
  boton?: { etiqueta: string; accion: AccionCamino };
}

/** El sitio desde el que se mira: dentro de un campamento (el de la pantalla) o en el mundo. */
export interface DondeEstas { campamento?: CampamentoMercenarios }

const distancia = (a: Punto, b: Punto): number => Math.hypot(a.x - b.x, a.y - b.y);
const nombre = (r: string): string => (RECURSO_NOMBRE[r] ?? r).toLowerCase();

/** ¿Tiene tu Facción alguna plaza a la vista o en memoria? Con una, el camino ya está hecho (como el Fondo del campamento, `pantallaCampamento.ts`). */
export function faccionConPlaza(p: ProyeccionJugador): boolean {
  return p.asentamientos.some((a) => a.faccionId === p.faccionId) || [...p.asentamientosAvistados, ...p.asentamientosConocidos].some((a) => a.faccionId === p.faccionId);
}

/** El último Fondo visto de cada campamento para tu Facción: fuera del campamento puede no llegar, y el paso no debe saltar atrás por eso. */
const fondosVistos = new Map<string, Record<string, number>>();

function fondoDe(p: ProyeccionJugador, c: CampamentoMercenarios): Record<string, number> {
  const clave = `${c.id}|${p.faccionId}`;
  const ahora = p.faccionId ? c.fondos?.[p.faccionId] : undefined;
  if (ahora) fondosVistos.set(clave, ahora);
  return ahora ?? fondosVistos.get(clave) ?? {};
}

function miColumna(p: ProyeccionJugador): Ejercito | undefined {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Tu campamento: donde resides o, si no resides en ninguno, en el que estás. */
function campamentoTuyo(p: ProyeccionJugador, donde: DondeEstas): CampamentoMercenarios | undefined {
  return p.campamentosMercenarios.find((c) => c.residentesIds.includes(p.heroeId)) ?? donde.campamento;
}

/** Lo que llevas encima para aportar: el almacén personal (si resides en ese campamento) y el carro que llevas aquí. */
function loQueTienes(p: ProyeccionJugador, c: CampamentoMercenarios, donde: DondeEstas): Record<string, number> {
  const columna = miColumna(p);
  const resides = c.residentesIds.includes(p.heroeId);
  const dentro = donde.campamento?.id === c.id;
  const suma: Record<string, number> = {};
  const sumar = (r?: Record<string, number>): void => { for (const [k, n] of Object.entries(r ?? {})) suma[k] = (suma[k] ?? 0) + Math.floor(n); };
  if (resides) sumar(p.heroe.almacenPersonal);
  if (columna) sumar(columna.suministro);
  else if (dentro && resides) sumar(p.heroe.carro);
  return suma;
}

/** Lo que falta de cada material del precio, con lo que ya hay en el Fondo. */
function faltas(precio: Record<string, number>, fondo: Record<string, number>): [string, number][] {
  return Object.entries(precio).map(([r, n]) => [r, Math.max(0, n - Math.floor(fondo[r] ?? 0))] as [string, number]).filter(([, n]) => n > 0);
}

const lista = (xs: [string, number][]): string => {
  const partes = xs.map(([r, n]) => `${n} de ${nombre(r)}`);
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
};

/**
 * El paso en que estás, o `null` si el camino no aplica: tu Facción ya tiene plaza, o no hay héroe en el mundo. `precio` es el de la caravana en el
 * campamento (`costoDeRefundacion`); mientras no llegue, el paso de los materiales no se puede saber y se queda en «consigue materiales».
 */
export function pasoDelCamino(p: ProyeccionJugador, donde: DondeEstas, precio: Record<string, number> | null): Paso | null {
  if (p.faccionId && faccionConPlaza(p)) return null;
  const columna = miColumna(p);
  const dentro = donde.campamento;
  const paso = (id: PasoCamino, texto: string, boton?: Paso['boton']): Paso => ({ id, titulo: TITULO[id], texto, ...(boton ? { boton } : {}) });

  if (!p.faccionId) {
    return paso('faccion', 'Para fundar hace falta una Facción. Únete a una que ya tenga plaza y te ahorras el camino, o crea la tuya.', { etiqueta: 'Abrir Facción', accion: { tipo: 'faccion' } });
  }

  // 6: la caravana va en tu columna
  if (columna?.caravanaFundacionId) {
    const lider = !columna.liderId || columna.liderId === p.heroeId;
    return paso('fundar', lider
      ? `Llévala a un buen sitio, a ${distanciasDeFundar().campamentos} o más de cualquier campamento y de otras plazas, y funda. El círculo te dice si allí se puede.`
      : 'Tu ejército lleva la caravana: funda su Líder, donde esté la columna.', lider ? { etiqueta: 'Elegir dónde fundar', accion: { tipo: 'fundar' } } : undefined);
  }

  const c = campamentoTuyo(p, donde);
  // 5: la caravana espera en el campamento
  const caravana = p.caravanas.find((k) => k.tipo === 'construccion' && k.faccionId === p.faccionId && k.estado === 'disponible');
  if (caravana) {
    const suyo = p.campamentosMercenarios.find((x) => x.id === caravana.origenCampamentoId) ?? c;
    if (dentro && (!suyo || dentro.id === suyo.id)) {
      return paso('llevar', 'La caravana espera aquí dentro. Sal como ejército y llévatela: una columna personal no puede.', { etiqueta: 'Salir con la caravana', accion: { tipo: 'salir' } });
    }
    if (suyo && columna) {
      const enLaPuerta = aLaPuerta(p, columna.posicionActual, suyo.posicion);
      return paso('llevar', 'La caravana espera dentro del campamento. Entra y sal de nuevo como ejército para llevártela.', enLaPuerta
        ? { etiqueta: 'Entrar en el campamento', accion: { tipo: 'entrar', campamentoId: suyo.id } }
        : { etiqueta: 'Volver al campamento', accion: { tipo: 'marchar', posicion: suyo.posicion } });
    }
    return paso('llevar', 'La caravana espera en tu campamento. Vuelve, y sal de él como ejército para llevártela.');
  }
  const fuera = p.caravanas.find((k) => k.tipo === 'construccion' && k.faccionId === p.faccionId && k.estado !== 'disponible');
  if (fuera?.estado === 'adjunta') return paso('fundar', 'Un ejército de tu Facción lleva la caravana: funda su Líder, donde esté la columna.');
  if (fuera) return paso('llevar', 'Tu caravana vuelve sola a su campamento. Cuando llegue, sal de él como ejército para llevártela.');
  if (!c || !precio) return paso('botin', 'Vence a los bandidos que rodean tu campamento: su botín de madera, piedra y trigo va a tu carro.');

  const fondo = fondoDe(p, c);
  const falta = faltas(precio, fondo);
  const enElCampamento = dentro?.id === c.id;
  const enLaPuerta = !enElCampamento && columna !== undefined && aLaPuerta(p, columna.posicionActual, c.posicion);
  const irAlCampamento = (etiquetaDentro: string, parte: 'fondo'): Paso['boton'] => enElCampamento
    ? { etiqueta: etiquetaDentro, accion: { tipo: 'parte', parte } }
    : enLaPuerta ? { etiqueta: 'Entrar en el campamento', accion: { tipo: 'entrar', campamentoId: c.id } }
    : { etiqueta: 'Volver al campamento', accion: { tipo: 'marchar', posicion: c.posicion } };

  // 4: el Fondo ya cubre el precio
  if (falta.length === 0) return paso('comprar', 'El Fondo está completo: compra la caravana en el campamento.', irAlCampamento('Ir al Fondo', 'fondo'));

  // 3: llevas algo de lo que falta
  const tienes = loQueTienes(p, c, donde);
  const aportable = falta.filter(([r]) => (tienes[r] ?? 0) >= 1);
  if (aportable.length > 0) {
    return paso('aportar', `Llevas ${lista(aportable.map(([r, n]) => [r, Math.min(n, tienes[r]!)]))} que le faltan al Fondo. Apórtalo en tu campamento.`, irAlCampamento('Aportar al Fondo', 'fondo'));
  }

  // 2: hay que salir a por botín
  const texto = `Al Fondo le faltan ${lista(falta)}. Vence a los bandidos que rodean tu campamento: su botín va a tu carro.`;
  if (enElCampamento) {
    const conTropa = p.heroe.escuadrones.some((s) => s.cantidad > 0);
    return conTropa
      ? paso('botin', texto, { etiqueta: 'Salir al mundo', accion: { tipo: 'salir' } })
      : paso('botin', `${texto} Antes, pide tropa prestada: el campamento te la deja gratis.`, { etiqueta: 'Pedir tropa', accion: { tipo: 'parte', parte: 'tropa' } });
  }
  const desde = columna?.posicionActual ?? c.posicion;
  const bandidos = [...(p.campamentosBandidos ?? [])].sort((a, b) =>
    Number(b.campamentoMercenariosId === c.id) - Number(a.campamentoMercenariosId === c.id) || distancia(a.posicion, desde) - distancia(b.posicion, desde));
  const objetivo = bandidos[0];
  return paso('botin', objetivo ? texto : `${texto} Explora alrededor de tu campamento para encontrarlos.`,
    objetivo && columna ? { etiqueta: 'Ir a por los bandidos', accion: { tipo: 'bandidos', id: objetivo.id, posicion: objetivo.posicion } } : undefined);
}

/** ¿Está plegada la tarjeta? Se recuerda en este navegador. */
const CLAVE_PLEGADO = 'bronzeage:camino-plegado';
function plegado(): boolean {
  try { return localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch { return false; }
}
function plegar(si: boolean): void {
  try { localStorage.setItem(CLAVE_PLEGADO, si ? '1' : '0'); } catch { /* sin almacenamiento, no se recuerda */ }
}

export function htmlCamino(paso: Paso, e: Escapar): string {
  const n = PASOS.indexOf(paso.id);
  const cerrado = plegado();
  const marcas = PASOS.map((id, i) => `<i class="${i < n ? 'hecho' : i === n ? 'ahora' : ''}" title="${e(TITULO[id])}"></i>`).join('');
  return `<button class="camino-cab" type="button" data-camino-plegar aria-expanded="${cerrado ? 'false' : 'true'}">
      <span class="camino-sello" aria-hidden="true">⌂</span><span class="camino-nombre">Tu primera plaza</span><span class="camino-cuenta">${n + 1}/${PASOS.length}</span><span class="camino-flecha">${cerrado ? '▸' : '▾'}</span>
    </button>
    <div class="camino-marcas" aria-hidden="true">${marcas}</div>
    ${cerrado ? '' : `<div class="camino-paso">
      <strong>${e(paso.titulo)}</strong>
      <p>${e(paso.texto)}</p>
      ${paso.boton ? `<button class="btn-primary camino-boton" type="button" data-camino-ir>${e(paso.boton.etiqueta)}</button>` : ''}
    </div>`}`;
}

/**
 * Pinta (o quita) la tarjeta. Va donde el rastreador de misiones: en una vista de dentro, al principio de su columna; en el mundo, en la columna de
 * guías de arriba a la derecha (`columnaDeGuias`). `hacer` cumple la acción del botón con lo de la pantalla.
 */
export function pintarCamino(p: ProyeccionJugador, donde: DondeEstas, precio: Record<string, number> | null, hacer: (a: AccionCamino) => void, e: Escapar): void {
  const sitio = document.querySelector<HTMLElement>('.camp-screen .asent-der') ?? columnaDeGuias();
  let el = document.querySelector<HTMLElement>('.camino-plaza');
  const paso = sitio ? pasoDelCamino(p, donde, precio) : null;
  if (!sitio || !paso) { el?.remove(); return; }
  if (!el || el.parentElement !== sitio) {
    el?.remove();
    el = document.createElement('aside');
    el.className = 'camino-plaza';
    el.setAttribute('aria-label', 'Camino a tu primera plaza');
  }
  // siempre la primera de su columna, encima del rastreador
  if (sitio.firstElementChild !== el) sitio.prepend(el);
  const html = htmlCamino(paso, e);
  if (el.dataset.pintado === html) return;
  el.dataset.pintado = html;
  el.dataset.paso = paso.id;
  el.innerHTML = html;
  el.querySelector('[data-camino-plegar]')?.addEventListener('click', () => { plegar(!plegado()); delete el!.dataset.pintado; pintarCamino(p, donde, precio, hacer, e); });
  const boton = paso.boton;
  el.querySelector<HTMLButtonElement>('[data-camino-ir]')?.addEventListener('click', () => { if (boton) hacer(boton.accion); });
}

/** En el mundo, la columna de arriba a la derecha donde van la tarjeta del camino y el rastreador de misiones, una encima de otra. `null` fuera del mundo. */
export function columnaDeGuias(): HTMLElement | null {
  const mundo = document.querySelector<HTMLElement>('.mapa-screen:not(.mapa-interior)');
  if (!mundo) return null;
  let col = mundo.querySelector<HTMLElement>(':scope > .guias-mundo');
  if (!col) {
    col = document.createElement('div');
    col.className = 'guias-mundo';
    mundo.append(col);
  }
  return col;
}
