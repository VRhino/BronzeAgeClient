// Pestaña «MERCADO» de la plaza (backend Doc 3.3 y 3.13): órdenes de compra y venta, y la flota de caravanas comerciales. Solo actúan los residentes del origen
// (`colocarOrdenMercado`, `crearCaravana`, `agregarCarroCaravana`, `comprarAnimalCaravana`, `moverCarroCaravana`, `reservarCaravana`, `prepararCaravana`,
// `cancelarCaravana`), la escolta de cada caravana (`asignarEscolta`, `quitarEscolta`: Doc 3.13.4) y las caravanas aparcadas aquí por un ejército
// (`moverCargaCaravanaAparcada`, `enviarCaravanaAlOrigen`: Doc 3.13.7), todo en la misma tarjeta por caravana. Costes de carros y animales, capacidad, velocidad, preparación y cupos salen del balance; quien valida es el servidor y su rechazo se enseña tal cual.
// Tomar una orden AJENA es otra cosa (`comerciarEnPlaza`: con una columna tuya a la puerta de esa plaza) y no se hace desde dentro de la tuya.
import { catalogoDeCaravanas, catalogoDePoliticas, cupoDeFlota, type ProyeccionJugador } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, Caravana, Escuadron } from '../tiposDominio';
import { ayuda } from './ayuda';
import { textoEnTiempoReal } from './estadoCliente';
import { chipLiderazgo } from './liderazgo';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const RECURSOS_ORDEN = Object.keys(RECURSO_NOMBRE).filter((r) => r !== 'oro');
const ESTADO: Record<string, string> = {
  disponible: 'parada',
  preparando: 'preparándose',
  adjunta: 'enganchada a un ejército',
  aparcada: 'aparcada',
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
  const info = ayuda('mercado:ordenes', 'Una orden de <strong>venta</strong> ofrece recursos de tu almacén por oro; una de <strong>compra</strong> pide recursos pagando con el oro de la plaza. Cualquiera de tu Facción (o de fuera) con una columna a la puerta puede tomarla en persona. Sin precio, se usa el de mercado.');
  return `<span class="faction-kicker">Órdenes de mercado${info}</span>
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

/** Caravanas con el desplegable «Añadir escolta» abierto: sobrevive a los repintados del sondeo (el HTML lo pinta según este conjunto). */
const escoltaAbierta = new Set<string>();

/** Los residentes de ese asentamiento (fundadores o con casa comprada); sin su ficha no se sabe y se deja probar al servidor. */
function resideEn(p: ProyeccionJugador, asentamientoId: string): boolean | null {
  const x = p.asentamientos.find((y) => y.id === asentamientoId);
  return x ? resideAqui(p, x) : null;
}

function nombrePlaza(p: ProyeccionJugador, id: string): string {
  return p.asentamientos.find((x) => x.id === id)?.nombre ?? p.asentamientosAvistados.find((x) => x.id === id)?.nombre ?? p.asentamientosConocidos.find((x) => x.asentamientoId === id)?.nombre ?? id;
}

/** Lo que sale de los catálogos del balance y de las políticas activas de la plaza para una caravana. */
interface DatosCaravana {
  cat: NonNullable<ReturnType<typeof catalogoDeCaravanas>>;
  /** Multiplicadores de las políticas `carga_ampliada` y `rutas_rapidas` que la plaza tiene activas (1 si no hay). */
  fCapacidad: number;
  fVelocidad: number;
  /** Puntos de Liderazgo de escolta que da el Mercado por caravana, si el balance los trae. */
  escoltaPts?: number;
}

const iconos = (costo: Record<string, number>): string => Object.entries(costo).map(([r, n]) => `${n} ${RECURSO_ICONO[r] ?? RECURSO_NOMBRE[r] ?? r}`).join(' ');
/** Lo que falta del almacén para pagar un coste, o `null` si alcanza. */
function motivoCosto(costo: Record<string, number>, almacen: Record<string, number>): string | null {
  const faltan = Object.entries(costo).filter(([r, n]) => Math.floor(almacen[r] ?? 0) < n).map(([r, n]) => `${n} ${RECURSO_NOMBRE[r] ?? r}`);
  return faltan.length > 0 ? `Faltan ${faltan.join(' y ')} en el almacén.` : null;
}
const atributosApagado = (motivo: string | null, e: Escapar): string => (motivo ? ` disabled title="${e(motivo)}"` : '');

function barraEscolta(usado: number, cupo: number): string {
  return `<div class="escolta-barra${usado >= cupo ? ' llena' : ''}" title="Liderazgo de la escolta: lo que gastan las escuadras cedidas sobre el cupo de la caravana"><i style="width:${cupo > 0 ? Math.min(100, (usado / cupo) * 100).toFixed(1) : 0}%"></i></div>
    <small class="escolta-cifras"><strong>${usado}/${cupo} pts</strong> de Liderazgo · quedan ${Math.max(0, cupo - usado)}</small>`;
}

/** Escolta de una caravana comercial de esta plaza (Doc 3.13.4): cupo, escuadras cedidas con «Retirar» y «Añadir escolta», que despliega las que puedes ceder. */
function escolta(c: Caravana, p: ProyeccionJugador, reside: boolean, parada: boolean, escoltaPts: number | undefined, e: Escapar): string {
  const lid = c.escoltaLiderazgo ?? (escoltaPts !== undefined ? { usado: 0, cupo: escoltaPts } : undefined);
  if (!lid) return '<p class="asent-lado-nota">El backend no publica su cupo de escolta.</p>';
  const cedidas = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'escolta' && s.contenedor.caravanaId === c.id);
  const deOtros = Math.max(0, lid.usado - cedidas.reduce((t, s) => t + s.costeLiderazgo, 0));
  const libre = lid.cupo - lid.usado;
  const candidatas: Escuadron[] = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);
  const motivo = !parada ? 'Solo se cambia con la caravana parada en su origen.'
    : !reside ? 'Solo quien reside en esta plaza cede escolta.'
      : candidatas.length === 0 ? 'No tienes escuadras libres en el campamento.'
        : candidatas.every((s) => s.costeLiderazgo > libre) ? `No cabe ninguna: quedan ${Math.max(0, libre)} pts.` : null;
  const abierta = motivo === null && escoltaAbierta.has(c.id);
  const cedidasHtml = cedidas.length > 0
    ? `<div class="mapa-lista">${cedidas.map((s) => `<div class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div>${parada ? `<button class="btn-secondary" type="button" data-quitar-escolta="${e(s.id)}" data-caravana="${e(c.id)}">Retirar</button>` : ''}</div>`).join('')}</div>`
    : '<p class="asent-lado-nota">No has cedido ninguna escuadra.</p>';
  const libresHtml = candidatas.map((s) => {
    const cabe = s.costeLiderazgo <= libre;
    return `<div class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres${cabe ? '' : ` · no cabe: quedan ${Math.max(0, libre)} pts`}</span></div><button class="btn-secondary" type="button" data-ceder-escolta="${e(s.id)}" data-caravana="${e(c.id)}"${cabe ? '' : ' disabled'}>Ceder</button></div>`;
  }).join('');
  return `<strong class="heroe-sub">Escolta</strong>${barraEscolta(lid.usado, lid.cupo)}
    ${deOtros > 0 ? `<p class="asent-lado-nota">Otros residentes han cedido ${deOtros} pts.</p>` : ''}
    ${cedidasHtml}
    <div class="mercado-acciones"><button class="btn-secondary" type="button" data-escolta-abrir="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${abierta ? '▾' : '＋'} Añadir escolta</button>${motivo ? `<small class="asent-lado-nota">${e(motivo)}</small>` : ''}</div>
    ${motivo ? '' : `<div class="mapa-lista" data-escolta-lista="${e(c.id)}"${abierta ? '' : ' hidden'}>${libresHtml}</div>`}`;
}

/** Caravana aparcada AQUÍ por un ejército (Doc 3.13.7): sigue siendo de su origen; intercambia carga con el almacén y solo sale enganchada o enviada al origen. */
function cuerpoAparcada(k: Caravana, a: Asentamiento, p: ProyeccionJugador, e: Escapar): string {
  const carga = Object.entries(k.contenido ?? {}).filter(([, n]) => n > 0);
  const almacen = Object.entries(a.almacen ?? {}).filter(([r]) => r !== 'oro');
  const recursos = [...new Set([...carga.map(([r]) => r), ...almacen.map(([r]) => r)])];
  // Sin la ficha del origen no se sabe: se deja probar y el servidor contesta.
  const motivo = resideEn(p, k.origenAsentamientoId) === false ? 'Solo los residentes del origen la manejan.' : null;
  const dis = motivo ? ` disabled title="${e(motivo)}"` : '';
  return `<p class="asent-lado-nota">Lleva: ${carga.length === 0 ? 'nada' : carga.map(([r, n]) => `${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)} ${Math.floor(n)}`).join(' · ')}</p>
    ${motivo ? `<p class="asent-lado-nota">${e(motivo)}</p>` : ''}
    <div class="mercado-acciones">
      <select class="form-input" data-aparcada-recurso="${e(k.id)}">${recursos.map((r) => `<option value="${e(r)}">${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)} (carro ${Math.floor(k.contenido?.[r] ?? 0)} · almacén ${Math.floor(a.almacen?.[r]?.cantidad ?? 0)})</option>`).join('')}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="Cantidad" data-aparcada-cantidad="${e(k.id)}" />
      <button class="btn-secondary" type="button" data-aparcada-mover="${e(k.id)}:cargar"${dis}>Cargar (almacén → carro)</button>
      <button class="btn-secondary" type="button" data-aparcada-mover="${e(k.id)}:descargar"${dis}>Descargar (carro → almacén)</button>
    </div>
    <div class="mercado-acciones"><button class="btn-primary" type="button" data-aparcada-origen="${e(k.id)}"${dis}>Enviar al origen</button></div>`;
}

function tarjeta(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, flota: Caravana[], almacen: Record<string, number>, carrosLleno: boolean, d: DatosCaravana | null, e: Escapar): string {
  const estado = c.estado ?? 'disponible';
  const aparcadaAqui = estado === 'aparcada' && c.origenAsentamientoId !== a.id;
  const destino = c.destinoAsentamientoId ? ` → ${e(nombrePlaza(p, c.destinoAsentamientoId))}` : '';
  const etiqueta = aparcadaAqui ? `Aparcada en esta plaza · origen: ${e(nombrePlaza(p, c.origenAsentamientoId))}` : (ESTADO[estado] ?? e(estado));
  const cabecera = `<strong class="heroe-sub">Caravana ${e(c.id)}${destino} <span class="caravana-estado ${e(estado)}">${etiqueta}</span></strong>`;
  if (aparcadaAqui) return `<div class="escolta-caravana">${cabecera}${cuerpoAparcada(c, a, p, e)}</div>`;

  const carros = c.carros ?? [];
  const parada = estado === 'disponible' && c.origenAsentamientoId === a.id;
  const otras = flota.filter((x) => x.id !== c.id && (x.estado ?? 'disponible') === 'disponible');
  const deshab = reside ? '' : ' disabled';
  const motivoLleno = carrosLleno ? 'La flota ya tiene el tope de carros de tu Mercado.' : null;
  const motivoReside = reside ? null : 'Solo quien reside en esta plaza maneja la flota.';
  const motivoCarro = (tipo: string): string | null => {
    const def = d?.cat.carros[tipo];
    if (motivoReside || motivoLleno || !def) return motivoReside ?? motivoLleno;
    if (def.fabrica !== 'mercado' && !a.edificios.some((x) => x.tipo === def.fabrica && x.estado === 'activo')) return `Hace falta ${EDIFICIO_NOMBRE[def.fabrica] ?? def.fabrica} activo.`;
    return motivoCosto(def.costo, almacen);
  };
  const botonCarro = (tipo: 'basico' | 'reforzado'): string => {
    const def = d?.cat.carros[tipo];
    return `<button class="btn-secondary" type="button" data-carro-nuevo="${e(c.id)}:${tipo}"${atributosApagado(motivoCarro(tipo), e)}>＋ ${CARRO[tipo]}${def ? ` · ${iconos(def.costo)}` : ''}</button>`;
  };
  // Capacidad y velocidad de la caravana: solo cuentan los carros con animal (Doc 3.13.1); las políticas de la plaza las multiplican.
  const tira = carros.filter((r) => r.animal && d?.cat.carros[r.tipoCarro] && d.cat.animales[r.animal]);
  const capacidad = d ? tira.reduce((t, r) => t + d.cat.carros[r.tipoCarro]!.capacidadBase * d.cat.animales[r.animal!]!.factorCarga, 0) * d.fCapacidad : 0;
  const velocidad = d && tira.length > 0 ? Math.min(...tira.map((r) => d.cat.animales[r.animal!]!.velocidad)) * d.fVelocidad : 0;
  const preparacion = d ? textoEnTiempoReal(d.cat.preparacionKPorCarro * Math.max(0, carros.length - 1) * 60_000) : '';
  const cifras = d && tira.length > 0 ? `<p class="asent-lado-nota">Capacidad <strong>${Math.floor(capacidad)}</strong> · velocidad <strong>${Math.round(velocidad * 10) / 10}</strong> · ${carros.length > 1 ? `preparación <strong>${preparacion}</strong>` : 'sale al instante'}${d.fCapacidad !== 1 || d.fVelocidad !== 1 ? ' · con las políticas de la plaza' : ''}</p>` : '';
  const opcionesAnimal = (): string => Object.entries(d?.cat.animales ?? {}).map(([id, an]) => {
    const m = motivoCosto(an.costo, almacen);
    return `<option value="${e(id)}"${m ? ' disabled' : ''}>${e(ANIMAL[id] ?? id)} · ${iconos(an.costo)} · ×${an.factorCarga} carga · vel. ${an.velocidad}${m ? ' (no te llega)' : ''}</option>`;
  }).join('');
  const motivoAnimal = motivoReside ?? (d && Object.values(d.cat.animales).every((an) => motivoCosto(an.costo, almacen)) ? 'No te llega para ningún animal.' : null);
  const carrosHtml = carros.length === 0
    ? '<p class="asent-lado-nota">Casco vacío: no puede salir hasta que le montes un carro y un animal.</p>'
    : `${cifras}<div class="mapa-lista">${carros.map((r, i) => `<div class="mapa-lista-item"><div><strong>${e(CARRO[r.tipoCarro] ?? r.tipoCarro)}</strong> · <span>${r.animal ? e(ANIMAL[r.animal] ?? r.animal) : 'sin animal: no tira'}</span></div>
        ${parada ? `<div class="mercado-acciones">
          ${r.animal ? '' : `<select class="form-input" data-animal-tipo="${e(c.id)}:${i}">${d ? opcionesAnimal() : '<option value="buey">Buey</option><option value="caballo">Caballo</option><option value="camello">Camello</option>'}</select><button class="btn-secondary" type="button" data-animal="${e(c.id)}" data-carro="${i}"${atributosApagado(motivoAnimal, e)}>Comprar animal</button>`}
          ${otras.length > 0 ? `<select class="form-input" data-mover-a="${e(c.id)}:${i}">${otras.map((x) => `<option value="${e(x.id)}">a ${e(x.id)}</option>`).join('')}</select><button class="btn-secondary" type="button" data-mover="${e(c.id)}" data-carro="${i}"${deshab}>Mover</button>` : ''}
        </div>` : ''}</div>`).join('')}</div>`;

  let acciones = '';
  if (parada) {
    const hayTraccion = carros.some((r) => r.animal);
    const destinos = [...p.asentamientosAvistados.map((x) => ({ id: x.id, nombre: x.nombre, faccionId: x.faccionId })), ...p.asentamientosConocidos.map((x) => ({ id: x.asentamientoId, nombre: x.nombre, faccionId: x.faccionId }))]
      .filter((x) => x.id !== a.id);
    const filas = Object.entries(almacen).filter(([r, n]) => n >= 1 && r !== 'oro');
    acciones = `<div class="mercado-acciones">
        ${botonCarro('basico')}
        ${botonCarro('reforzado')}
        <label class="asent-toggle"><input type="checkbox" data-reservar="${e(c.id)}"${c.reservadaManual ? ' checked' : ''}${deshab} /> Reservada (fuera del reparto automático)</label>
      </div>
      ${hayTraccion && reside ? `<strong class="heroe-sub">Preparar un viaje</strong>
        <select class="form-input" data-viaje-destino="${e(c.id)}">${destinos.length === 0 ? '<option value="">— no conoces otra plaza —</option>' : destinos.map((x) => `<option value="${e(x.id)}">${e(x.nombre ?? x.id)}${x.faccionId === p.faccionId ? ' (tuya)' : ''}</option>`).join('')}</select>
        ${filas.length === 0 ? '<p class="asent-lado-nota">No hay nada que cargar en el almacén.</p>' : filas.map(([r, n]) => `<div class="carro-fila"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><small>hay ${Math.floor(n)}</small><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-viaje-carga="${e(c.id)}:${e(r)}" /></div>`).join('')}
        <button class="btn-primary" type="button" data-preparar="${e(c.id)}"${destinos.length === 0 ? ' disabled' : ''}>Preparar y lanzar</button>` : ''}`;
  } else if (estado === 'preparando') {
    acciones = `<p class="asent-lado-nota">Sale en ${c.preparaHasta ? falta(c.preparaHasta, p) : 'un momento'}.</p>${reside ? `<button class="btn-secondary" type="button" data-cancelar-caravana="${e(c.id)}">Cancelar preparación</button>` : ''}`;
  }
  return `<div class="escolta-caravana">${cabecera}
    ${carrosHtml}${acciones}${escolta(c, p, reside, parada, d?.escoltaPts, e)}</div>`;
}

export function htmlCaravanas(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar?: () => void): string {
  const reside = resideAqui(p, a);
  const flota = p.caravanas.filter((c) => c.tipo === 'comercial' && c.origenAsentamientoId === a.id);
  // Las de otra plaza que un ejército dejó aparcadas aquí: salen después de las de la flota.
  const aparcadas = p.caravanas.filter((k) => k.estado === 'aparcada' && k.origenAsentamientoId !== a.id && k.posicionActual.x === a.posicion.x && k.posicionActual.y === a.posicion.y);
  const almacen = Object.fromEntries(Object.entries(a.almacen ?? {}).map(([r, v]) => [r, v.cantidad]));
  // Topes de la flota (Doc 3.13.2): los pone el nivel interno del Mercado y vienen en el balance; el servidor sigue siendo quien rechaza.
  const nivelMercado = Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === 'mercado' && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
  const cupo = nivelMercado > 0 ? cupoDeFlota(nivelMercado, alCargar) : null;
  const carros = flota.reduce((t, c) => t + (c.carros?.length ?? 0), 0);
  const carrosLleno = cupo?.carros !== undefined && carros >= cupo.carros;
  const flotaLlena = cupo?.caravanas !== undefined && flota.length >= cupo.caravanas;
  const cat = catalogoDeCaravanas(alCargar);
  const politicas = catalogoDePoliticas(alCargar)?.catalogo ?? [];
  const factor = (campo: string): number => (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.[campo]; return typeof v === 'number' ? t * v : t; }, 1);
  const datos: DatosCaravana | null = cat ? { cat, fCapacidad: factor('factorCapacidadCaravana'), fVelocidad: factor('factorVelocidadCaravana'), escoltaPts: nivelMercado > 0 ? cat.escoltaPorNivelMercado[nivelMercado - 1] : undefined } : null;
  const topes = cupo ? `<p class="asent-lado-nota">Flota de tu Mercado (nivel ${nivelMercado}): <strong>${flota.length}${cupo.caravanas !== undefined ? `/${cupo.caravanas}` : ''}</strong> caravanas · <strong>${carros}${cupo.carros !== undefined ? `/${cupo.carros}` : ''}</strong> carros${flotaLlena ? ' · No caben más caravanas.' : ''}${carrosLleno ? ' · No caben más carros.' : ''}${datos?.escoltaPts !== undefined ? ` · Escolta: <strong>${datos.escoltaPts} pts</strong> de Liderazgo por caravana` : ''}</p>` : '';
  const info = ayuda('mercado:caravanas', 'Tu flota: un casco se arma con carros (que pagas con materiales del almacén) y un animal por carro, y sale a mano hacia otra plaza con la carga que elijas. Solo cuentan los carros con animal. El cupo de flota y los costes los decide el servidor. Los carros se reparten como quieras entre las caravanas; mover un carro no gasta cupo.<br>La carga sale del almacén al prepararla; si la cancelas antes de salir, vuelve entera.<br><strong>Escolta:</strong> cede escuadras de tu campamento a una caravana parada en su origen: viajarán con ella y volverán al campamento al acabar el viaje. El cupo es de la caravana, en puntos de Liderazgo (lo da tu Mercado) y lo comparten los residentes; ceder no gasta tu Liderazgo.<br><strong>Aparcadas:</strong> caravanas de tu Facción que un ejército dejó aquí al entrar. No las usa esta plaza: puedes pasar carga entre su carro y el almacén, y solo salen enganchadas a un ejército (desde el panel del ejército) o enviadas a su origen. Vacía, aparece en su origen al instante; con carga, vuelve por el camino y la deja allí al llegar.');
  return `<span class="faction-kicker">Caravanas comerciales${info}</span>
    ${topes}
    ${reside ? `<button class="btn-primary" type="button" data-caravana-crear${flotaLlena ? ' disabled title="La flota ya tiene el tope de caravanas de tu Mercado"' : ''}>Crear caravana (casco vacío)</button>` : '<p class="asent-lado-nota">Solo quien reside en esta plaza maneja la flota.</p>'}
    ${flota.length + aparcadas.length === 0 ? '<p class="mapa-lista-vacia">No hay caravanas en esta plaza.</p>' : [...flota, ...aparcadas].map((c) => tarjeta(c, p, a, reside, flota, almacen, carrosLleno, datos, e)).join('')}
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

  // Escolta: «Añadir escolta» despliega o pliega la lista en la propia tarjeta (sin repintar: el conjunto hace que el siguiente pintado salga igual).
  raiz.querySelectorAll<HTMLButtonElement>('[data-escolta-abrir]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.escoltaAbrir!;
    const abrir = !escoltaAbierta.has(id);
    if (abrir) escoltaAbierta.add(id); else escoltaAbierta.delete(id);
    raiz.querySelectorAll<HTMLElement>('[data-escolta-lista]').forEach((l) => { if (l.dataset.escoltaLista === id) l.hidden = !abrir; });
    b.textContent = `${abrir ? '▾' : '＋'} Añadir escolta`;
  }));
  const escoltar = (tipo: 'asignarEscolta' | 'quitarEscolta', atributo: string): void =>
    raiz.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((boton) => boton.addEventListener('click', async () => {
      const botones = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'));
      const antes = botones.map((b) => b.disabled);
      botones.forEach((b) => { b.disabled = true; });
      const mensaje = await ejecutar(tipo, { caravanaId: boton.dataset.caravana!, heroeId: p.heroeId, escuadronIds: [boton.getAttribute(atributo)!] });
      // Con éxito el refresco repinta el panel; si falla, se reabren los botones y se dice por qué.
      if (mensaje !== null) { botones.forEach((b, i) => { b.disabled = antes[i]!; }); if (error) error.textContent = mensaje; }
    }));
  escoltar('asignarEscolta', 'data-ceder-escolta');
  escoltar('quitarEscolta', 'data-quitar-escolta');

  // Aparcadas: pasar carga entre su carro y el almacén de esta plaza, o mandarla a su origen.
  const base = { heroeId: p.heroeId, asentamientoId: a.id };
  raiz.querySelectorAll<HTMLButtonElement>('[data-aparcada-mover]').forEach((b) => b.addEventListener('click', () => {
    const [caravanaId, sentido] = b.dataset.aparcadaMover!.split(':');
    const recurso = valor(`[data-aparcada-recurso="${caravanaId}"]`);
    const cantidad = Number(raiz.querySelector<HTMLInputElement>(`[data-aparcada-cantidad="${caravanaId}"]`)?.value);
    if (!recurso || !(cantidad >= 1)) { if (error) error.textContent = 'Elige un recurso y una cantidad de 1 o más.'; return; }
    void lanzar(b, 'moverCargaCaravanaAparcada', { ...base, caravanaId, recurso, cantidad, sentido });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-aparcada-origen]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'enviarCaravanaAlOrigen', { ...base, caravanaId: b.dataset.aparcadaOrigen! })));
}
