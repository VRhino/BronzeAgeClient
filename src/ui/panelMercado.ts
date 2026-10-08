// Pestaña «MERCADO» de la plaza (backend Doc 3.3 y 3.13): órdenes de compra y venta, y la flota de caravanas comerciales. Solo actúan los residentes del origen
// (`colocarOrdenMercado`, `crearCaravana`, `agregarCarroCaravana`, `comprarAnimalCaravana`, `moverCarroCaravana`, `reservarCaravana`, `prepararCaravana`,
// `cancelarCaravana`). Los costes de carros y animales, la capacidad y el cupo de flota los valida y los dice el servidor: aquí no se copian, el rechazo se enseña tal cual.
// Tomar una orden AJENA es otra cosa (`comerciarEnPlaza`: con una columna tuya a la puerta de esa plaza) y no se hace desde dentro de la tuya.
import type { ProyeccionJugador } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, Caravana } from '../tiposDominio';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const RECURSOS_ORDEN = Object.keys(RECURSO_NOMBRE).filter((r) => r !== 'oro');
const ESTADO: Record<string, string> = {
  disponible: 'parada en su origen',
  preparando: 'preparándose para salir',
  adjunta: 'enganchada a un ejército',
  aparcada: 'aparcada en una plaza',
  en_transito: 'en camino',
  retornando: 'de vuelta',
};
const CARRO: Record<string, string> = { basico: 'Carro básico', reforzado: 'Carro reforzado' };
const ANIMAL: Record<string, string> = { buey: 'Buey', caballo: 'Caballo', camello: 'Camello' };

function resideAqui(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** Lo que falta para un instante de mundo, en el tiempo que verá el jugador (el mundo corre más rápido que el reloj). */
function falta(hasta: number, p: ProyeccionJugador): string {
  const ms = hasta - p.instante;
  if (ms <= 0) return 'ya';
  const min = ms / 60_000;
  return min >= 60 ? `${Math.round(min / 60)} h` : min >= 1 ? `${Math.round(min)} min` : `${Math.round(ms / 1000)} s`;
}

// ---------------------------------------------------------------- Órdenes

export function htmlOrdenes(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const reside = resideAqui(p, a);
  const mias = p.ordenes.filter((o) => o.asentamientoId === a.id && o.estado === 'activa');
  const opciones = RECURSOS_ORDEN.map((r) => `<option value="${e(r)}">${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</option>`).join('');
  return `<span class="faction-kicker">Órdenes de mercado</span>
    <p class="asent-lado-nota">Una orden de <strong>venta</strong> ofrece recursos de tu almacén por oro; una de <strong>compra</strong> pide recursos pagando con el oro de la plaza. Cualquiera de tu Facción (o de fuera) con una columna a la puerta puede tomarla en persona. Sin precio, se usa el de mercado.</p>
    ${reside ? `<div class="mercado-form">
      <select class="form-input" data-orden="tipo"><option value="venta">Vender</option><option value="compra">Comprar</option></select>
      <select class="form-input" data-orden="recurso">${opciones}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="Cantidad" data-orden="cantidad" />
      <input class="form-input" type="number" min="0" step="0.01" placeholder="Precio por unidad (opcional)" data-orden="precio" />
      <button class="btn-primary" type="button" data-orden-colocar>Colocar orden</button>
    </div>` : '<p class="asent-lado-nota">Solo quien reside en esta plaza coloca órdenes.</p>'}
    <strong class="heroe-sub">Órdenes en pie de esta plaza</strong>
    ${mias.length === 0 ? '<p class="mapa-lista-vacia">No hay órdenes en pie.</p>' : `<div class="mapa-lista">${mias.map((o) => `<div class="mapa-lista-item"><div><strong>${o.tipo === 'venta' ? 'Vende' : 'Compra'} ${e(RECURSO_NOMBRE[o.recurso] ?? o.recurso)}</strong><span>${Math.floor(o.cantidadCumplida)}/${Math.floor(o.cantidad)} cumplido · ${o.precioUnitario.toFixed(2)} de oro c/u · caduca en ${falta(o.expiraEn, p)}</span></div></div>`).join('')}</div>`}
    <p class="faction-error" data-campo="error-mercado" role="alert"></p>`;
}

export function cablearOrdenes(raiz: HTMLElement, a: Asentamiento, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-mercado"]');
  const campo = (n: string): HTMLInputElement | HTMLSelectElement | null => raiz.querySelector(`[data-orden="${n}"]`);
  const boton = raiz.querySelector<HTMLButtonElement>('[data-orden-colocar]');
  boton?.addEventListener('click', async () => {
    const cantidad = Number(campo('cantidad')?.value);
    if (!(cantidad >= 1)) { if (error) error.textContent = 'Pon una cantidad de 1 o más.'; return; }
    const precio = campo('precio')?.value;
    boton.disabled = true;
    const mensaje = await ejecutar('colocarOrdenMercado', { asentamientoId: a.id, tipo: campo('tipo')!.value, recurso: campo('recurso')!.value, cantidad, ...(precio ? { precio: Number(precio) } : {}) });
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  });
}

// ---------------------------------------------------------------- Caravanas

function tarjeta(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, flota: Caravana[], almacen: Record<string, number>, e: Escapar): string {
  const destino = c.destinoAsentamientoId ? ` → ${e(p.asentamientosAvistados.find((x) => x.id === c.destinoAsentamientoId)?.nombre ?? p.asentamientosConocidos.find((x) => x.asentamientoId === c.destinoAsentamientoId)?.nombre ?? c.destinoAsentamientoId)}` : '';
  const estado = c.estado ?? 'disponible';
  const carros = c.carros ?? [];
  const parada = estado === 'disponible' && c.origenAsentamientoId === a.id;
  const otras = flota.filter((x) => x.id !== c.id && (x.estado ?? 'disponible') === 'disponible');
  const deshab = reside ? '' : ' disabled';
  const carrosHtml = carros.length === 0
    ? '<p class="asent-lado-nota">Casco vacío: no puede salir hasta que le montes un carro y un animal.</p>'
    : `<div class="mapa-lista">${carros.map((r, i) => `<div class="mapa-lista-item"><div><strong>${e(CARRO[r.tipoCarro] ?? r.tipoCarro)}</strong> · <span>${r.animal ? e(ANIMAL[r.animal] ?? r.animal) : 'sin animal: no tira'}</span></div>
        ${parada ? `<div class="mercado-acciones">
          ${r.animal ? '' : `<select class="form-input" data-animal-tipo="${e(c.id)}:${i}"><option value="buey">Buey</option><option value="caballo">Caballo</option><option value="camello">Camello</option></select><button class="btn-secondary" type="button" data-animal="${e(c.id)}" data-carro="${i}"${deshab}>Comprar animal</button>`}
          ${otras.length > 0 ? `<select class="form-input" data-mover-a="${e(c.id)}:${i}">${otras.map((x) => `<option value="${e(x.id)}">a ${e(x.id)}</option>`).join('')}</select><button class="btn-secondary" type="button" data-mover="${e(c.id)}" data-carro="${i}"${deshab}>Mover</button>` : ''}
        </div>` : ''}</div>`).join('')}</div>`;

  let acciones = '';
  if (parada) {
    const hayTraccion = carros.some((r) => r.animal);
    const destinos = [...p.asentamientosAvistados.map((x) => ({ id: x.id, nombre: x.nombre, faccionId: x.faccionId })), ...p.asentamientosConocidos.map((x) => ({ id: x.asentamientoId, nombre: x.nombre, faccionId: x.faccionId }))]
      .filter((x) => x.id !== a.id);
    const filas = Object.entries(almacen).filter(([r, n]) => n >= 1 && r !== 'oro');
    acciones = `<div class="mercado-acciones">
        <button class="btn-secondary" type="button" data-carro-nuevo="${e(c.id)}:basico"${deshab}>＋ Carro básico</button>
        <button class="btn-secondary" type="button" data-carro-nuevo="${e(c.id)}:reforzado"${deshab}>＋ Carro reforzado</button>
        <label class="asent-toggle"><input type="checkbox" data-reservar="${e(c.id)}"${c.reservadaManual ? ' checked' : ''}${deshab} /> Reservada (fuera del reparto automático)</label>
      </div>
      ${hayTraccion && reside ? `<strong class="heroe-sub">Preparar un viaje</strong>
        <select class="form-input" data-viaje-destino="${e(c.id)}">${destinos.length === 0 ? '<option value="">— no conoces otra plaza —</option>' : destinos.map((x) => `<option value="${e(x.id)}">${e(x.nombre ?? x.id)}${x.faccionId === p.faccionId ? ' (tuya)' : ''}</option>`).join('')}</select>
        ${filas.length === 0 ? '<p class="asent-lado-nota">No hay nada que cargar en el almacén.</p>' : filas.map(([r, n]) => `<div class="carro-fila"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><small>hay ${Math.floor(n)}</small><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-viaje-carga="${e(c.id)}:${e(r)}" /></div>`).join('')}
        <button class="btn-primary" type="button" data-preparar="${e(c.id)}"${destinos.length === 0 ? ' disabled' : ''}>Preparar y lanzar</button>
        <p class="asent-lado-nota">La carga sale del almacén al prepararla; si la cancelas antes de salir, vuelve entera. La escolta se cede en la pestaña Escolta.</p>` : ''}`;
  } else if (estado === 'preparando') {
    acciones = `<p class="asent-lado-nota">Sale en ${c.preparaHasta ? falta(c.preparaHasta, p) : 'un momento'}.</p>${reside ? `<button class="btn-secondary" type="button" data-cancelar-caravana="${e(c.id)}">Cancelar preparación</button>` : ''}`;
  }
  return `<div class="escolta-caravana"><strong class="heroe-sub">Caravana ${e(c.id)}${destino} · ${ESTADO[estado] ?? e(estado)}</strong>
    ${carrosHtml}${acciones}</div>`;
}

export function htmlCaravanas(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const reside = resideAqui(p, a);
  const flota = p.caravanas.filter((c) => c.tipo === 'comercial' && c.origenAsentamientoId === a.id);
  const almacen = Object.fromEntries(Object.entries(a.almacen ?? {}).map(([r, v]) => [r, v.cantidad]));
  return `<span class="faction-kicker">Caravanas comerciales</span>
    <p class="asent-lado-nota">Tu flota: un casco se arma con carros (que pagas con materiales del almacén) y un animal por carro, y sale a mano hacia otra plaza con la carga que elijas. Solo cuentan los carros con animal. El cupo de flota y los costes los decide el servidor.</p>
    ${reside ? '<button class="btn-primary" type="button" data-caravana-crear>Crear caravana (casco vacío)</button>' : '<p class="asent-lado-nota">Solo quien reside en esta plaza maneja la flota.</p>'}
    ${flota.length === 0 ? '<p class="mapa-lista-vacia">No hay caravanas comerciales de esta plaza.</p>' : flota.map((c) => tarjeta(c, p, a, reside, flota, almacen, e)).join('')}
    <p class="faction-error" data-campo="error-mercado" role="alert"></p>`;
}

export function cablearCaravanas(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-mercado"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  const valor = (selector: string): string => raiz.querySelector<HTMLSelectElement>(selector)?.value ?? '';
  raiz.querySelector<HTMLButtonElement>('[data-caravana-crear]')?.addEventListener('click', (ev) => void lanzar(ev.currentTarget as HTMLButtonElement, 'crearCaravana', { asentamientoId: a.id }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro-nuevo]').forEach((b) => b.addEventListener('click', () => {
    const [caravanaId, tipoCarro] = b.dataset.carroNuevo!.split(':');
    void lanzar(b, 'agregarCarroCaravana', { caravanaId, tipoCarro });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-animal]').forEach((b) => b.addEventListener('click', () => {
    const caravanaId = b.dataset.animal!;
    void lanzar(b, 'comprarAnimalCaravana', { caravanaId, carroIndice: Number(b.dataset.carro), tipoAnimal: valor(`[data-animal-tipo="${caravanaId}:${b.dataset.carro}"]`) });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-mover]').forEach((b) => b.addEventListener('click', () => {
    const desdeCaravanaId = b.dataset.mover!;
    void lanzar(b, 'moverCarroCaravana', { desdeCaravanaId, haciaCaravanaId: valor(`[data-mover-a="${desdeCaravanaId}:${b.dataset.carro}"]`), carroIndice: Number(b.dataset.carro) });
  }));
  raiz.querySelectorAll<HTMLInputElement>('[data-reservar]').forEach((c) => c.addEventListener('change', async () => {
    const mensaje = await ejecutar('reservarCaravana', { caravanaId: c.dataset.reservar!, reservada: c.checked });
    if (mensaje !== null) { c.checked = !c.checked; if (error) error.textContent = mensaje; }
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-preparar]').forEach((b) => b.addEventListener('click', () => {
    const caravanaId = b.dataset.preparar!;
    const carga = Object.fromEntries(
      Array.from(raiz.querySelectorAll<HTMLInputElement>('input[data-viaje-carga]'))
        .filter((i) => i.dataset.viajeCarga!.startsWith(`${caravanaId}:`))
        .map((i) => [i.dataset.viajeCarga!.slice(caravanaId.length + 1), Number(i.value)] as const)
        .filter(([, n]) => n > 0)
    );
    void lanzar(b, 'prepararCaravana', { caravanaId, heroeId: p.heroeId, destinoAsentamientoId: valor(`[data-viaje-destino="${caravanaId}"]`), carga });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-cancelar-caravana]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'cancelarCaravana', { caravanaId: b.dataset.cancelarCaravana! })));
}
