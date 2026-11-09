// VISTA DE LA CIUDAD (plaza): clic en un edificio del lienzo → ficha con su info y acciones; resaltado cruzado con la lista de edificios;
// producción en el tooltip; subpestañas «Recetas» (alternarReceta) e «Información» (glosario) de Centro urbano. En la bodega y la prensa, la
// receta que trabaja y si está parada, y el selector de receta (`elegirReceta`, motor b55e90f) para el Gobernador y el Maestro de Obras.
// Qué se puede hacer con UN edificio, según el backend (Doc 4 y comandos): mejorarlo (activo, Gobernador/Maestro de Obras) y quitarlo de la cola
// (en cola). NO hay pausa ni prioridad por edificio (la pausa existe por RECETA y la prioridad la fija el motor): no se inventan.
import type { ProyeccionJugador } from '../apiCliente';
import { bloqueDeDatos, nivelesDeEdificio } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';
import { edificioBajoCursor, type SeleccionEdificio } from '../render';
import type { Asentamiento, Edificio } from '../tiposDominio';
import { textoEnTiempoReal } from './estadoCliente';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import type { Ejecutar } from './panelCarro';
import { renderPestanaInformacion } from './pestanaInformacion';
import { pintar } from './repintado';
import { cablearPlegables } from './plegable';
import { mostrar as mostrarAviso } from './avisos';
import { iconoEdificio } from './iconosEdificio';
import { barraAvance, chipsDeCoste, cuentaAtras, duracion } from './juegoVisual';
import { avanceDeObra } from './panelObras';
import { confirmar } from './dialogo';
import { RECETA_DE_INSUMO, esDeUnaReceta, insumoActivo, insumosDe, recetasDistintas, recetasElegibles } from './recetasUnicas';

type Escapar = (valor: string) => string;
type Cargo = 'gobernador' | 'maestroObras' | null;

let seleccion: SeleccionEdificio | null = null;
/** Lo que hay que rehacer al cambiar la selección (lienzo, lista y ficha): lo pone `cablearVistaCiudad`. */
let alCambiar: () => void = () => undefined;

export const edificioSeleccionado = (): SeleccionEdificio | null => seleccion;
export const tipoSeleccionado = (): string | null => seleccion?.tipo ?? null;

const internosDe = (a: Asentamiento): Edificio[] => (a.edificios ?? []).filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa');
const nombreDe = (tipo: string): string => EDIFICIO_NOMBRE[tipo] ?? tipo;
/** Cifras de recurso: enteras sin decimales; con fracción, un decimal solo por debajo de 10 (en valor absoluto). */
const fmt = (n: number): string => (Number.isInteger(n) || Math.abs(n) >= 10 ? Math.round(n).toString() : n.toFixed(1));

function cargoDe(a: Asentamiento, heroeId: string): Cargo {
  if (a.cargos?.gobernadorId === heroeId) return 'gobernador';
  if (a.cargos?.maestroObrasId === heroeId) return 'maestroObras';
  return null;
}

function adoptadasDe(p: ProyeccionJugador): string[] | null {
  const t = p.tecnologia as { propias?: { adoptadas?: string[] } | null } | undefined;
  return t?.propias?.adoptadas ?? (t ? [] : null);
}

const costeTexto = (coste: Record<string, number>, e: Escapar): string =>
  Object.entries(coste).map(([r, n]) => `${RECURSO_ICONO[r] ?? '📦'} ${n} ${e(RECURSO_NOMBRE[r] ?? r)}`).join(' · ');

/** La producción por minuto de UN edificio de ese tipo (la proyección la da por tipo: total y nº de activos; se reparte a partes iguales). Una bodega
 * o una prensa da solo lo de su receta, repartido entre las que trabajan esa misma, y nada si está parada (motor b55e90f). */
function produccionDe(p: ProyeccionJugador, edificio: Edificio): { recurso: string; porMinuto: number; activos: number }[] {
  if (edificio.estado !== 'activo' || edificio.recetaParada) return [];
  const activo = insumoActivo(edificio);
  const produce = activo ? RECETA_DE_INSUMO[activo]?.produce : undefined;
  const a = p.asentamientos[0];
  const conLaMisma = activo && a ? internosDe(a).filter((x) => x.tipo === edificio.tipo && x.estado === 'activo' && !x.recetaParada && insumoActivo(x) === activo).length : 0;
  return (p.produccionDeAsentamiento ?? [])
    .filter((it) => it.tipo === edificio.tipo && it.cantidadPorMinuto > 0 && (!produce || it.recurso === produce))
    .map((it) => {
      const activos = conLaMisma || it.activos;
      return { recurso: it.recurso, porMinuto: it.cantidadPorMinuto / Math.max(1, activos), activos };
    });
}

/** Cuántas veces más rinde un taller con su buey (`factorBuey` del catálogo: solo el molino lo tiene, tanda 69); 1 sin buey. */
function factorDeBuey(e: Edificio, alCargar?: () => void): number {
  if (!e.buey) return 1;
  return bloqueDeDatos<Record<string, { factorBuey?: number }>>('EDIFICIO_CATALOGO', alCargar)?.[e.tipo]?.factorBuey ?? 1;
}
const vecesMas = (factor: number): string => (factor === 2 ? 'el doble' : `${fmt(factor)} veces más`);

/** El buey del molino (tanda 69, Economia_Construccion §5.3): con él muele `factorBuey` veces más gastando el mismo trigo por saco. Se compra
 * del almacén de la plaza con cargo, también con la obra en marcha (`asignarBuey`), y se pierde con el molino. Sin cargo solo se dice si lo tiene. */
export function htmlBuey(a: Asentamiento, edificio: Edificio, cargo: Cargo, e: Escapar): string {
  const factor = bloqueDeDatos<Record<string, { factorBuey?: number }>>('EDIFICIO_CATALOGO')?.[edificio.tipo]?.factorBuey;
  if (!factor) return '';
  if (edificio.buey) return `<p class="asent-lado-nota ficha-buey">🐂 Con su buey muele ${vecesMas(factor)}.</p>`;
  const coste = bloqueDeDatos<Record<string, { costo?: Record<string, number> }>>('ANIMAL_CATALOGO')?.buey?.costo;
  if (!cargo || !coste) return '';
  const caro = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
  return `<div class="ficha-mejora ficha-buey${caro ? ' caro' : ''}">
      <span class="faction-kicker">Buey del molino</span>
      <p class="asent-lado-nota">Con un buey muele ${vecesMas(factor)} gastando el mismo trigo por saco. Se queda en el molino y se pierde con él.</p>
      <div class="ficha-mejora-coste">${chipsDeCoste(a, coste, e)}</div>
      <button class="btn-primary" type="button" data-ficha-buey="${e(edificio.id)}"${caro ? ` title="${e('No hay bastante en el almacén todavía')}"` : ''}>🐂 Comprar el buey</button>
    </div>`;
}

/** La receta de una bodega o una prensa (motor b55e90f): la que trabaja, si está parada y, con cargo, a cuáles se puede pasar (las que no pasan del
 * tope de recetas distintas de la plaza; si no hay ninguna, no sale el selector y se dice por qué). Vacío en los demás edificios. */
export function htmlRecetaUnica(a: Asentamiento, edificio: Edificio, cargo: Cargo, e: Escapar): string {
  if (!esDeUnaReceta(edificio.tipo)) return '';
  const activo = insumoActivo(edificio);
  if (!activo) return '';
  const nivel = String(edificio.nivelInterno ?? 1);
  const porUnidad = (insumo: string): number | undefined => nivelesDeEdificio(edificio.tipo)?.[nivel]?.recetas.find((r) => insumo in r.consumePorUnidad)?.consumePorUnidad[insumo];
  const receta = (insumo: string): string => {
    const r = RECETA_DE_INSUMO[insumo];
    const n = porUnidad(insumo);
    return `${RECURSO_ICONO[r?.produce ?? ''] ?? '📦'} ${e(r?.nombre ?? RECURSO_NOMBRE[insumo] ?? insumo)}${n !== undefined ? `, con ${fmt(n)} ${RECURSO_ICONO[insumo] ?? ''} ${e((RECURSO_NOMBRE[insumo] ?? insumo).toLowerCase())} por unidad` : ''}`;
  };
  const tipo = nombreDe(edificio.tipo).toLowerCase();
  const plural = edificio.tipo === 'bodega' ? 'bodegas' : 'prensas';
  const caben = recetasDistintas(edificio.tipo, a.nivelActual ?? a.nivel);
  const regla = edificio.tipo === 'bodega'
    ? 'Cada bodega hace vino o cerveza, no las dos. Caben tres en una plaza y, en los niveles 3 y 4, todas hacen la misma bebida; en el 5 puede haber de las dos.'
    : 'Cada prensa hace aceite de aceituna o de sésamo, no los dos. Caben tres en una plaza y todas sacan el aceite de la misma fuente.';
  const parada = edificio.recetaParada
    ? `<p class="asent-lado-nota falta">⏸ Parada: la plaza ha bajado de nivel y ya no le caben tantas recetas distintas en sus ${plural}. Vuelve a producir con el nivel o eligiéndole otra receta.</p>`
    : '';
  const elegibles = cargo ? recetasElegibles(a, edificio) : [];
  const otras = insumosDe(edificio).filter((i) => i !== activo);
  const selector = elegibles.length
    ? `<div class="ficha-receta-elegir">${elegibles.map((i) => `<button class="btn-secondary" type="button" data-ficha-receta="${e(i)}" title="${e(`Pasar a ${(RECETA_DE_INSUMO[i]?.nombre ?? i).toLowerCase()}`)}">${RECURSO_ICONO[RECETA_DE_INSUMO[i]?.produce ?? ''] ?? '📦'} Hacer ${e((RECETA_DE_INSUMO[i]?.nombre ?? i).toLowerCase())}</button>`).join('')}</div>`
    // Con cargo y otra receta en el catálogo que ahora no cabe, se dice por qué no hay selector (no se ofrece lo que el motor rechazaría). Con una
    // sola receta distinta y nada parado, todas trabajan la misma: solo cambia la que está sola en la plaza.
    : cargo && otras.length && !edificio.recetaParada && caben === 1
      ? `<p class="asent-lado-nota">Todas las ${plural} de la plaza ${edificio.tipo === 'bodega' ? 'hacen la misma bebida' : 'sacan el aceite de la misma fuente'}: una ${tipo} solo cambia de receta si es la única${edificio.tipo === 'bodega' ? ', o con la plaza en el nivel 5' : ''}.</p>`
      : '';
  return `<div class="ficha-mejora ficha-receta">
      <span class="faction-kicker">Receta${ayuda(`plaza:receta-${edificio.tipo}`, regla)}</span>
      <p class="asent-lado-nota">${receta(activo)}.</p>
      ${parada}${selector}
    </div>`;
}

const tieneRecetas = (e: Edificio): boolean => (nivelesDeEdificio(e.tipo)?.[String(e.nivelInterno ?? 1)]?.recetas.length ?? 0) > 0;

/** Lo que enseña el tooltip del lienzo: nombre, nivel, estado, notas y producción. */
export function htmlTooltipEdificio(p: ProyeccionJugador, edificio: Edificio, e: Escapar): string {
  const estado = edificio.estado === 'activo' ? 'Activo' : edificio.estado === 'en_construccion' ? 'En construcción' : 'En cola';
  const notas = [edificio.danado ? 'dañado (reconstrucción)' : null, edificio.pausadoPorAlmacenLleno ? 'parado — almacén lleno' : null, edificio.recetaParada ? 'receta parada por el nivel de la plaza' : null].filter(Boolean).join(' · ');
  const activo = insumoActivo(edificio);
  const receta = activo && RECETA_DE_INSUMO[activo] ? `<span>${RECURSO_ICONO[RECETA_DE_INSUMO[activo].produce] ?? '📦'} Hace ${e(RECETA_DE_INSUMO[activo].nombre.toLowerCase())}</span>` : '';
  const prod = produccionDe(p, edificio)
    .map((x) => `<span>${RECURSO_ICONO[x.recurso] ?? '📦'} ${e(RECURSO_NOMBRE[x.recurso] ?? x.recurso)} · ${x.activos > 1 ? '≈ ' : ''}${fmt(x.porMinuto)}/min</span>`)
    .join('');
  // Necesita Backend: consumo por edificio (la proyección solo trae la producción).
  const consumo = edificio.estado === 'activo' && tieneRecetas(edificio) ? '<span>Consumo por edificio: no lo publica el servidor</span>' : '';
  return `<strong>${e(nombreDe(edificio.tipo))}</strong><span>Nivel ${edificio.nivelInterno ?? 1} · ${estado}</span>${receta}${notas ? `<span>${e(notas)}</span>` : ''}${prod}${consumo}`;
}

function htmlFicha(p: ProyeccionJugador, a: Asentamiento, edificio: Edificio, e: Escapar): string {
  const nivel = edificio.nivelInterno ?? 1;
  const cargo = cargoDe(a, p.heroeId);
  const niveles = nivelesDeEdificio(edificio.tipo);
  const estado = edificio.estado === 'activo' ? 'Activo' : edificio.estado === 'en_construccion' ? 'En construcción' : 'En cola';
  const notas = [edificio.danado ? 'dañado (reconstrucción)' : null, edificio.pausadoPorAlmacenLleno ? 'parado — almacén lleno' : null].filter(Boolean);
  const prod = produccionDe(p, edificio)
    .map((x) => `<li>${RECURSO_ICONO[x.recurso] ?? '📦'} ${e(RECURSO_NOMBRE[x.recurso] ?? x.recurso)} · ${x.activos > 1 ? '≈ ' : ''}${fmt(x.porMinuto)}/min</li>`)
    .join('');
  // la bodega y la prensa enseñan su receta en su bloque (`htmlRecetaUnica`), no la lista entera
  const recetas = (esDeUnaReceta(edificio.tipo) ? [] : niveles?.[String(nivel)]?.recetas ?? [])
    .map((r) => `<li>${e(RECURSO_NOMBRE[r.produce] ?? r.produce)}: ${costeTexto(r.consumePorUnidad, e) || 'sin insumos'} por unidad</li>`)
    .join('');

  // La obra en marcha (construcción o mejora): su barra de avance y lo que le queda (Víctor, 2026-11-03).
  const fin = edificio.mejora?.completaEn ?? (edificio.estado === 'en_construccion' ? edificio.completaEn : undefined);
  const obra = typeof fin === 'number'
    ? `<div class="ficha-obra"><span class="ficha-obra-linea"><strong>${edificio.mejora ? `Mejorándose a N${edificio.mejora.nivelObjetivo}` : 'En construcción'}</strong><b>quedan ${cuentaAtras(fin)}</b></span>${barraAvance(avanceDeObra(a, edificio))}</div>`
    : '';

  // Mejorar va en la ficha (antes, en la lista de Construcción): la misma orden, `mejorarEdificioAhora`, con su coste del catálogo en fichas (en
  // rojo lo que falta). Solo con cargo, y solo si el cliente no sabe ya que no se puede (nivel de plaza, edificio o tecnología que pide): «si no lo
  // puedo hacer, para qué lo muestro» (Víctor, 2026-11-03). Lo demás lo valida el servidor y su rechazo sale flotando.
  let acciones = '';
  if (cargo && edificio.tipo !== 'centroUrbano' && edificio.estado === 'activo' && !edificio.mejora) {
    const siguiente = niveles?.[String(nivel + 1)];
    const plazaNivel = a.nivelActual ?? a.nivel;
    const adoptadas = adoptadasDe(p);
    const pideEdificio = siguiente?.requiereEdificio;
    const sePuede = siguiente
      && plazaNivel >= (siguiente.requisitoNivelAsentamiento ?? 0)
      && (!pideEdificio || (a.edificios ?? []).some((x) => x.tipo === pideEdificio && x.estado === 'activo' && (x.nivelInterno ?? 1) >= (siguiente.requiereEdificioNivel ?? 1)))
      && (!siguiente.requiereTecnologia || !adoptadas || adoptadas.includes(siguiente.requiereTecnologia));
    if (siguiente && sePuede) {
      const coste = siguiente.costoMejora ?? {};
      const caro = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
      acciones = `<div class="ficha-mejora${caro ? ' caro' : ''}">
          <span class="faction-kicker">Mejorar a N${nivel + 1}</span>
          <div class="ficha-mejora-coste">${Object.keys(coste).length ? chipsDeCoste(a, coste, e) : '<small>sin coste</small>'}${siguiente.obraMinutos ? `<small class="ficha-mejora-tiempo">⏳ ${duracion(siguiente.obraMinutos)}</small>` : ''}</div>
          <button class="btn-primary" type="button" data-ficha-mejorar="${e(edificio.id)}"${caro ? ` title="${e('No hay bastante en el almacén todavía')}"` : ''}>⬆ Mejorar a N${nivel + 1}</button>
        </div>`;
    }
  } else if (cargo && edificio.estado === 'en_cola') {
    acciones = `<button class="btn-secondary" type="button" data-ficha-quitar="${e(edificio.id)}">Quitar de la cola</button>`;
  }
  // Cancelar la obra o la mejora en curso (motor 87f74932, `cancelarConstruccion`): solo con cargo y solo en marcha; no devuelve nada, se confirma.
  if (cargo && (edificio.estado === 'en_construccion' || edificio.mejora)) {
    acciones += `<button class="btn-secondary ficha-cancelar-obra" type="button" data-ficha-cancelar-obra="${e(edificio.id)}" title="No se devuelve nada de lo pagado">✕ ${edificio.mejora ? 'Cancelar la mejora' : 'Cancelar la obra'}</button>`;
  }

  // lo que el Albergue de caravanas suma a la flota del Mercado a su nivel (motor b5e27ace); sin Mercado activo no suma nada
  const cupo = edificio.tipo === 'albergueCaravanas' ? niveles?.[String(nivel)] : undefined;
  const conMercado = (a.edificios ?? []).some((x) => x.tipo === 'mercado' && x.estado === 'activo');
  const flota = cupo && (cupo.cupoCaravanas || cupo.cupoCarros)
    ? `<p class="asent-lado-nota">${conMercado ? 'Suma' : 'Sin un Mercado activo no suma nada; con él, suma'} a la flota ${cupo.cupoCaravanas ?? 0} caravanas y ${cupo.cupoCarros ?? 0} carros.</p>`
    : '';

  return `<div class="asent-lado-cabecera"><span class="faction-kicker">${e(nombreDe(edificio.tipo))}</span><button type="button" class="asent-ficha-cerrar" data-ficha-cerrar title="Cerrar">✕</button></div>
    <div class="asent-ficha-grid"><div><span>Nivel</span><strong>${nivel}</strong></div><div><span>Estado</span><strong>${e(estado)}</strong></div></div>
    ${notas.length ? `<p class="asent-lado-nota">${e(notas.join(' · '))}</p>` : ''}
    ${flota}
    ${obra}
    ${prod ? `<span class="faction-kicker">Producción</span><ul class="asent-ficha-lista">${prod}</ul>` : ''}
    ${recetas ? `<span class="faction-kicker">Recetas de este nivel ${ayuda('plaza:ficha-recetas', 'Consumo por edificio: no lo publica el servidor.')}</span><ul class="asent-ficha-lista">${recetas}</ul>` : ''}
    ${htmlRecetaUnica(a, edificio, cargo, e)}
    ${htmlBuey(a, edificio, cargo, e)}
    ${acciones}`;
}

let estadoSolicitado: (() => ProyeccionJugador | undefined) | null = null;

/** Elige un edificio por la lista: el primero del tipo o, si ya había uno de ese tipo elegido, el siguiente (así se recorren los de un tipo). */
function elegirTipo(tipo: string): void {
  const a = estadoSolicitado?.()?.asentamientos[0];
  if (!a) return;
  const lista = internosDe(a).filter((x) => x.tipo === tipo);
  if (lista.length === 0) return;
  const i = seleccion?.tipo === tipo ? lista.findIndex((x) => x.id === seleccion!.id) : -1;
  seleccion = { id: lista[(i + 1) % lista.length]!.id, tipo };
  alCambiar();
  alElegirDeLista(seleccion.id);
}

/** Lo que hace la plaza cuando se elige un edificio desde la lista (la vista 3D lo enfoca). */
let alElegirDeLista: (id: string) => void = () => undefined;

/** Elige un edificio por su id (el clic en la vista 3D de la plaza), o ninguno con `null`. */
export function elegirEdificio(id: string | null): void {
  const a = estadoSolicitado?.()?.asentamientos[0];
  const e = id && a ? (a.edificios ?? []).find((x) => x.id === id) : undefined;
  seleccion = e ? { id: e.id, tipo: e.tipo } : null;
  alCambiar();
}
let fichaEl: HTMLElement | null = null;
let ejecutarFicha: Ejecutar | null = null;
let escaparFicha: Escapar = (s) => s;

/** Pinta (o esconde) la ficha según la selección y la proyección vigente. */
export function repintarFicha(): void {
  if (!fichaEl?.isConnected) return;
  const p = estadoSolicitado?.();
  const a = p?.asentamientos[0];
  const edificio = a && seleccion ? (a.edificios ?? []).find((x) => x.id === seleccion!.id) : undefined;
  if (!p || !a || !edificio) { seleccion = null; fichaEl.hidden = true; return; }
  fichaEl.hidden = false;
  pintar(fichaEl, htmlFicha(p, a, edificio, escaparFicha), () => {
    // El rechazo sale flotando arriba al centro (`.aviso-global`), no al pie de la ficha, donde se perdía.
    // El botón se queda «en marcha» hasta la respuesta, para que el clic se note al momento.
    const lanzar = async (tipo: string, params: object, boton: HTMLElement): Promise<void> => {
      boton.classList.add('pendiente');
      boton.setAttribute('aria-busy', 'true');
      try {
        const mensaje = await ejecutarFicha!(tipo, params);
        if (mensaje) mostrarAviso(mensaje, true);
      } finally {
        boton.classList.remove('pendiente');
        boton.removeAttribute('aria-busy');
      }
    };
    fichaEl!.querySelector('[data-ficha-cerrar]')?.addEventListener('click', () => { seleccion = null; alCambiar(); });
    fichaEl!.querySelector<HTMLElement>('[data-ficha-mejorar]')?.addEventListener('click', (ev) => void lanzar('mejorarEdificioAhora', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id }, ev.currentTarget as HTMLElement));
    fichaEl!.querySelectorAll<HTMLElement>('[data-ficha-receta]').forEach((b) => b.addEventListener('click', (ev) => void lanzar('elegirReceta', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id, insumo: b.dataset.fichaReceta }, ev.currentTarget as HTMLElement)));
    fichaEl!.querySelector<HTMLElement>('[data-ficha-buey]')?.addEventListener('click', (ev) => void lanzar('asignarBuey', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id }, ev.currentTarget as HTMLElement));
    fichaEl!.querySelector<HTMLElement>('[data-ficha-quitar]')?.addEventListener('click', (ev) => void lanzar('quitarDeCola', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id }, ev.currentTarget as HTMLElement));
    fichaEl!.querySelector<HTMLElement>('[data-ficha-cancelar-obra]')?.addEventListener('click', (ev) => {
      const boton = ev.currentTarget as HTMLElement;
      void confirmarCancelarObra(edificio).then((ok) => { if (ok) void lanzar('cancelarConstruccion', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id }, boton); });
    });
  }, 'ficha-edificio');
}

/** La confirmación de cancelar una obra o una mejora en curso: no se devuelve nada (también la usa «Obras» del panel izquierdo). */
export function confirmarCancelarObra(edificio: Edificio): Promise<boolean> {
  const nombre = nombreDe(edificio.tipo);
  return edificio.mejora
    ? confirmar(`${nombre} se queda en su nivel y no se devuelve nada de lo pagado. La siguiente obra de la cola empieza ya.`, { titulo: '¿Cancelar la mejora?', aceptar: 'Cancelar la mejora', cancelar: 'Seguir', peligro: true })
    : confirmar(`${nombre} desaparece con su sitio y no se devuelve nada de lo pagado. La siguiente obra de la cola empieza ya.`, { titulo: '¿Cancelar la obra?', aceptar: 'Cancelar la obra', cancelar: 'Seguir', peligro: true });
}

/** Cablea, una vez al montar la plaza, el clic sobre el lienzo, la ficha flotante y el clic en las filas de la lista de edificios. */
export function cablearVistaCiudad(
  contenedor: HTMLElement,
  o: { proyeccion: () => ProyeccionJugador | undefined; ejecutar: Ejecutar; escapar: Escapar; redibujar: () => void; repintarLista: () => void; enfocar?: (id: string) => void }
): void {
  const canvas = contenedor.querySelector<HTMLCanvasElement>('#mapa');
  const mapa = contenedor.querySelector<HTMLElement>('.asent-mapa');
  if (!canvas || !mapa) return;
  seleccion = null;
  estadoSolicitado = o.proyeccion;
  ejecutarFicha = o.ejecutar;
  escaparFicha = o.escapar;
  fichaEl = document.createElement('aside');
  fichaEl.className = 'asent-ficha';
  fichaEl.hidden = true;
  // en la plaza, al borde derecho (`.asent-der`, desde la 0.97.0); en las demás pantallas, en la columna izquierda
  (contenedor.querySelector('.asent-der') ?? contenedor.querySelector('.asent-izq') ?? mapa).appendChild(fichaEl);
  alCambiar = () => { o.redibujar(); o.repintarLista(); repintarFicha(); };
  alElegirDeLista = o.enfocar ?? (() => undefined);

  canvas.addEventListener('click', (evento) => {
    // de minimapa (bajo la vista 3D), el clic lleva la cámara y no elige
    if (canvas.closest('.asent-minimapa')) return;
    const p = o.proyeccion();
    const a = p?.asentamientos[0];
    if (!p || !a) return;
    const e = edificioBajoCursor(canvas, evento, a, p.trazadoPorAsentamiento?.[a.id]);
    seleccion = e ? { id: e.id, tipo: e.tipo } : null;
    alCambiar();
  });
  canvas.style.cursor = 'pointer';
  contenedor.querySelector('.asent-edificios')?.addEventListener('click', (ev) => {
    const objetivo = ev.target as HTMLElement;
    if (objetivo.closest('button')) return;
    const fila = objetivo.closest<HTMLElement>('[data-fila-tipo]');
    if (fila?.dataset.filaTipo) elegirTipo(fila.dataset.filaTipo);
  });
}

// ---------------------------------------------------------------- Subpestaña «Recetas» (alternarReceta)

interface RecetaAgregada {
  produce: string;
  talleres: Map<string, number>;
  porMinuto: number;
  insumos: Record<string, number>;
  tecnologia?: string;
  edificioReq?: { tipo: string; nivel: number };
}

/** Las recetas que fabrican los talleres activos de la plaza, una por recurso producido (la pausa es por recurso y vale para todos los talleres).
 * La bodega y la prensa cuentan solo su receta activa, y nada si está parada (motor b55e90f). */
function recetasDe(a: Asentamiento, alCargar: () => void): RecetaAgregada[] {
  const porRecurso = new Map<string, RecetaAgregada>();
  for (const ed of internosDe(a)) {
    if (ed.estado !== 'activo' || ed.recetaParada) continue;
    const activo = insumoActivo(ed, alCargar);
    for (const r of nivelesDeEdificio(ed.tipo, alCargar)?.[String(ed.nivelInterno ?? 1)]?.recetas ?? []) {
      if (activo && !(activo in r.consumePorUnidad)) continue;
      const ag = porRecurso.get(r.produce) ?? { produce: r.produce, talleres: new Map(), porMinuto: 0, insumos: r.consumePorUnidad, tecnologia: r.requiereTecnologia, edificioReq: r.requiereEdificio };
      ag.talleres.set(ed.tipo, (ag.talleres.get(ed.tipo) ?? 0) + 1);
      ag.porMinuto += r.produccionBase * factorDeBuey(ed, alCargar);
      porRecurso.set(r.produce, ag);
    }
  }
  // Una receta parada cuyo taller ya no está sigue en la lista de pausadas: se deja a la vista para poder reanudarla.
  for (const r of a.recetasPausadas ?? []) if (!porRecurso.has(r)) porRecurso.set(r, { produce: r, talleres: new Map(), porMinuto: 0, insumos: {} });
  return [...porRecurso.values()].sort((x, y) => (RECURSO_NOMBRE[x.produce] ?? x.produce).localeCompare(RECURSO_NOMBRE[y.produce] ?? y.produce));
}

/** Las recetas de los talleres, una fila por producto: la cadena insumos ➜ producto, los talleres que la hacen y el interruptor ▶ / ⏸. */
export function htmlRecetas(c: ContextoPlaza): string {
  const e = c.escapar;
  const pausadas = new Set(c.asentamiento.recetasPausadas ?? []);
  const adoptadas = adoptadasDe(c.proyeccion);
  const filas = recetasDe(c.asentamiento, c.refrescar).map((r) => {
    const parada = pausadas.has(r.produce);
    const falta = adoptadas && r.tecnologia && !adoptadas.includes(r.tecnologia) ? r.tecnologia : '';
    const nombre = RECURSO_NOMBRE[r.produce] ?? r.produce;
    const insumos = Object.entries(r.insumos).map(([x, n]) => `<span class="prod-insumo" title="${e(`${fmt(n)} ${RECURSO_NOMBRE[x] ?? x} por unidad`)}">${RECURSO_ICONO[x] ?? '📦'}<small>${fmt(n)}</small></span>`).join('');
    const talleres = [...r.talleres].map(([t, n]) => `<span class="prod-taller" title="${e(nombreDe(t))}">${iconoEdificio(t, 16)}${n > 1 ? `<small>×${n}</small>` : ''}</span>`).join('');
    const estado = falta ? 'bloqueada' : parada ? 'parada' : 'marcha';
    const titulo = `${nombre}: ${falta ? `bloqueada, requiere la tecnología «${falta}»` : parada ? 'parada' : 'en marcha'}${r.porMinuto ? ` · hasta ${fmt(r.porMinuto)}/min con la mano de obra completa` : ''}${Object.keys(r.insumos).length ? ` · por unidad: ${Object.entries(r.insumos).map(([x, n]) => `${fmt(n)} ${RECURSO_NOMBRE[x] ?? x}`).join(', ')}` : ''}`;
    const interruptor = c.cargo
      ? `<button class="prod-interruptor${parada ? '' : ' encendido'}" type="button" data-receta="${e(r.produce)}" data-pausar="${parada ? '0' : '1'}" title="${parada ? 'Reanudar' : 'Parar'} en todos los talleres" aria-label="${parada ? 'Reanudar' : 'Parar'} ${e(nombre)}">${parada ? '▶' : '<span class="prod-pausa">❚❚</span>'}</button>`
      : `<span class="prod-estado" aria-hidden="true">${falta ? '🔒' : parada ? '⏸' : '▶'}</span>`;
    return `<div class="prod-receta ${estado}" title="${e(titulo)}">
      <span class="prod-cadena">${insumos || '<span class="prod-insumo vacio">·</span>'}<span class="prod-flecha">➜</span><span class="prod-producto">${RECURSO_ICONO[r.produce] ?? '📦'}</span></span>
      <span class="prod-receta-cuerpo"><strong>${e(nombre)}</strong><span class="prod-receta-pie">${talleres}${r.porMinuto ? `<small>${fmt(r.porMinuto)}/min</small>` : ''}${falta ? '<small class="falta">🔒 tecnología</small>' : ''}</span></span>
      ${interruptor}
    </div>`;
  }).join('');
  return `<div class="obra-titulo"><span class="faction-kicker">Talleres</span>${ayuda('plaza:recetas', 'Cada fila: lo que gasta por unidad ➜ lo que fabrica, con los talleres que la hacen y su ritmo con la mano de obra completa. ⏸ la para en todos los talleres de la plaza; ▶ la reanuda. Con candado: falta la tecnología. Solo el Gobernador o el Maestro de Obras las paran o reanudan.')}</div>
    <div class="prod-recetas">${filas || '<p class="mapa-lista-vacia">Ningún taller activo con recetas.</p>'}</div>`;
}

function cablearRecetas(c: ContextoPlaza): void {
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-receta]').forEach((b) => b.addEventListener('click', async () => {
    const mensaje = await c.ejecutar('alternarReceta', { asentamientoId: c.asentamiento.id, recurso: b.dataset.receta, pausada: b.dataset.pausar === '1' });
    if (mensaje) mostrarAviso(mensaje, true);
  }));
}

/** Lo que fija el catálogo para un extractor o granja: la producción base (`produccionBase<Recurso>`, en la raíz o en el nivel) y los trabajadores. */
interface FichaCatalogo { trabajadoresRequeridos?: number; niveles?: Record<string, Record<string, unknown>>; [clave: string]: unknown }

/** Qué produce un tipo de edificio sin receta y cuánto de base: `produccionBaseTrigo` → trigo. */
function produccionBase(tipo: string, nivel: number, alCargar: () => void): { recurso: string; base: number; trabajadores: number } | null {
  const cat = bloqueDeDatos<Record<string, FichaCatalogo>>('EDIFICIO_CATALOGO', alCargar)?.[tipo];
  if (!cat) return null;
  const delNivel = cat.niveles?.[String(nivel)] ?? {};
  for (const fuente of [delNivel, cat as Record<string, unknown>]) {
    const clave = Object.keys(fuente).find((k) => k.startsWith('produccionBase') && typeof fuente[k] === 'number');
    if (!clave) continue;
    const r = clave.slice('produccionBase'.length);
    const recurso = r === 'Livestock' ? 'livestock' : r.charAt(0).toLowerCase() + r.slice(1);
    const trabajadores = Number(delNivel.trabajadoresRequeridos ?? cat.trabajadoresRequeridos ?? 0);
    return { recurso, base: Number(fuente[clave]), trabajadores };
  }
  return null;
}

/** Los extractores y granjas activos, por tipo: el total de su base del catálogo y su mano de obra (lo que reduce su rendimiento). */
function extractoresDe(a: Asentamiento, alCargar: () => void): Map<string, { recurso: string; base: number; trabajadores: number; edificios: Edificio[] }> {
  const porTipo = new Map<string, { recurso: string; base: number; trabajadores: number; edificios: Edificio[] }>();
  for (const ed of a.edificios ?? []) {
    if (ed.estado !== 'activo') continue;
    const p = produccionBase(ed.tipo, ed.nivelInterno ?? 1, alCargar);
    if (!p) continue;
    const g = porTipo.get(ed.tipo) ?? { recurso: p.recurso, base: 0, trabajadores: 0, edificios: [] };
    g.base += p.base;
    g.trabajadores += p.trabajadores;
    g.edificios.push(ed);
    porTipo.set(ed.tipo, g);
  }
  return porTipo;
}

type Existencia = { cantidad: number; capacidad: number; porMinuto?: number; producido?: number; produccion?: number; consumido?: number };

/** Lo que rinden los edificios (quepa o no), lo que se consume y lo que se enseña como neto: con el almacén lleno, el balance producción − consumo
 * y no el neto del almacén, que baja a lo que entra y hacía parecer la ficha a la baja (Víctor, 2026-11-03: «sale como si tuviera producción
 * negativa cuando no es así»). */
function flujosDe(x: Existencia): { produce: number; consume: number; neto: number; lleno: boolean } {
  const produce = x.produccion ?? x.producido ?? 0, consume = x.consumido ?? 0;
  const lleno = x.capacidad > 0 && x.cantidad >= x.capacidad;
  return { produce, consume, neto: lleno ? produce - consume : x.porMinuto ?? 0, lleno };
}

/** Los recursos que se mueven o que hay, en el orden de la paleta (los básicos primero). */
export function recursosDelAlmacen(a: Asentamiento): [string, Existencia][] {
  const orden = Object.keys(RECURSO_ICONO);
  const pos = (r: string): number => { const i = orden.indexOf(r); return i < 0 ? orden.length : i; };
  return Object.entries(a.almacen ?? {})
    .filter(([, x]) => x.cantidad >= 1 || (x.porMinuto ?? 0) !== 0 || (x.produccion ?? x.producido ?? 0) !== 0 || (x.consumido ?? 0) !== 0)
    .sort(([r1], [r2]) => pos(r1) - pos(r2) || r1.localeCompare(r2));
}

/** Una ficha del almacén: icono, neto por minuto con flecha y color, lo que hay frente a lo que cabe, lo que entra frente a lo que sale y cuándo
 * se llena o se acaba. */
export function fichaRecurso(r: string, x: Existencia, e: Escapar): string {
  const { produce: p, consume: c, neto: n, lleno } = flujosDe(x);
  const fraccion = x.capacidad > 0 ? Math.min(1, x.cantidad / x.capacidad) : 0;
  const nombre = RECURSO_NOMBRE[r] ?? r;
  const minutos = n > 0 && x.capacidad > 0 && !lleno ? (x.capacidad - x.cantidad) / n : n < 0 && x.cantidad > 0 ? x.cantidad / -n : null;
  const cuando = minutos === null ? '' : `${n > 0 ? 'Lleno' : 'Se acaba'} en ${textoEnTiempoReal(minutos * 60_000)}`;
  const titulo = `${nombre}: ${Math.floor(x.cantidad)} de ${Math.floor(x.capacidad)}${p || c ? ` · por minuto produce ${fmt(p)}, consume ${fmt(c)}` : ''} · ${lleno ? 'balance' : 'neto'} ${n > 0 ? '+' : ''}${fmt(n)}/min${lleno ? ' · almacén lleno: lo que se produce de más se pierde' : cuando ? ` · ${cuando.toLowerCase()}` : ''}`;
  const flujo = p + c > 0 ? `<span class="prod-flujo" aria-hidden="true"><i class="entra" style="width:${((p / (p + c)) * 100).toFixed(1)}%"></i><i class="sale"></i></span>` : '<span class="prod-flujo quieto" aria-hidden="true"></span>';
  const aviso = lleno ? '<span class="prod-ficha-aviso lleno">LLENO</span>' : minutos !== null && n < 0 && minutos < 60 ? `<span class="prod-ficha-aviso baja">⏳${e(textoEnTiempoReal(minutos * 60_000).replace(/ (min|h|s|d)$/, (_, u: string) => (u === 'min' ? 'm' : u)))}</span>` : '';
  return `<div class="prod-ficha${lleno ? ' lleno' : ''}${n < 0 ? ' baja' : n > 0 ? ' sube' : ''}" title="${e(titulo)}">
    <span class="prod-ficha-icono">${RECURSO_ICONO[r] ?? '📦'}</span>
    <span class="prod-ficha-neto ${signo(n)}">${n > 0 ? '▲' : n < 0 ? '▼' : '■'}&nbsp;${n > 0 ? '+' : ''}${fmt(n)}</span>
    <span class="prod-ficha-cifra">${Math.floor(x.cantidad)}${aviso || `<small>/${Math.floor(x.capacidad)}</small>`}</span>
    <span class="prod-stock" aria-hidden="true"><i style="width:${(fraccion * 100).toFixed(1)}%"></i></span>
    ${flujo}
  </div>`;
}

/** La producción de la plaza: la mano de obra en un medidor, el almacén en fichas y los extractores como cadena edificio ➜ recurso. El motor no
 * publica lo que rinde cada edificio: en el extractor va la base del catálogo y el neto real va en la ficha de su recurso. */
export function htmlExtraccion(c: ContextoPlaza): string {
  const e = c.escapar;
  const a = c.asentamiento;
  const porTipo = extractoresDe(a, c.refrescar);
  const necesarios = [...porTipo.values()].reduce((s, g) => s + g.trabajadores, 0);
  const pesants = Math.floor(a.poblacion?.pesants ?? 0);
  const ratio = necesarios <= 0 ? 1 : Math.min(1, pesants / necesarios);
  const obra = `<div class="prod-obra${ratio < 1 ? ' falta' : ''}" title="${e(`Mano de obra: ${pesants} pesants para ${necesarios} puestos de extractores y granjas${ratio < 1 ? ` (${Math.round(ratio * 100)} %: rinden menos)` : ''}.`)}">
      <span class="prod-obra-icono" aria-hidden="true">👷</span>
      <span class="prod-obra-barra"><i style="width:${(ratio * 100).toFixed(1)}%"></i></span>
      <strong>${pesants}<small>/${necesarios}</small></strong>
      <small>${ratio < 1 ? `${Math.round(ratio * 100)} %` : '✔'}</small>
    </div>`;
  const recursos = recursosDelAlmacen(a);
  const fichas = recursos.length ? `<div class="prod-fichas">${recursos.map(([r, x]) => fichaRecurso(r, x, e)).join('')}</div>` : '<p class="mapa-lista-vacia">El almacén está vacío.</p>';
  const extractores = [...porTipo.entries()].sort(([x], [y]) => nombreDe(x).localeCompare(nombreDe(y))).map(([tipo, g]) => {
    const parados = g.edificios.filter((x) => x.pausadoPorAlmacenLleno).length;
    const danados = g.edificios.filter((x) => x.danado).length;
    const multiplica = tipo === 'granja' ? ' La fertilidad de la zona la multiplica.' : tipo === 'lenera' ? ' La densidad del bosque la multiplica.' : '';
    const titulo = `${nombreDe(tipo)}${g.edificios.length > 1 ? ` ×${g.edificios.length}` : ''} ➜ ${RECURSO_NOMBRE[g.recurso] ?? g.recurso}: hasta ${fmt(g.base)}/min con la mano de obra completa (${g.trabajadores} trabajadores).${multiplica}${parados ? ` ${parados} parado(s): almacén lleno.` : ''}${danados ? ` ${danados} dañado(s).` : ''}`;
    return `<div class="prod-extractor${parados ? ' parado' : ''}" title="${e(titulo)}">
      <span class="prod-cadena"><span class="prod-taller">${iconoEdificio(tipo, 24)}${g.edificios.length > 1 ? `<small>×${g.edificios.length}</small>` : ''}</span><span class="prod-flecha">➜</span><span class="prod-producto">${RECURSO_ICONO[g.recurso] ?? '📦'}</span></span>
      <small class="prod-extractor-ritmo">≤ ${fmt(g.base)}/min</small>
      ${parados ? `<span class="obra-insignia parado">⏸${parados > 1 ? parados : ''}</span>` : ''}${danados ? `<span class="obra-insignia danado">⚠${danados > 1 ? danados : ''}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="obra-titulo"><span class="faction-kicker">Almacén</span><small>por minuto</small>${ayuda('plaza:produccion', 'Cada ficha: el neto del último minuto (▲ sube, ▼ baja), lo que hay frente a lo que cabe y, en la tira de abajo, lo que entra (verde) frente a lo que sale (rojo). Entra lo de edificios, pueblos y recaudación; sale la comida de la población y la guarnición, los insumos de los talleres y el mantenimiento. Órdenes, comercio, botín y caravanas no cuentan. LLENO: lo que se produce de más se pierde, y la flecha da el balance de lo que rinden los edificios menos lo que se consume. Pasa el ratón para las cifras.')}</div>
    ${fichas}
    <div class="obra-titulo"><span class="faction-kicker">Extracción</span>${obra}</div>
    <div class="prod-extractores">${extractores || '<p class="mapa-lista-vacia">Sin extractores ni granjas activos.</p>'}</div>`;
}

/** Clase de color de una cifra: verde si suma, rojo si resta, gris si es cero. */
const signo = (n: number): string => (n > 0 ? 'cifra-pos' : n < 0 ? 'cifra-neg' : 'cifra-cero');

/** Producción: el almacén, la extracción y los talleres. */
export function htmlProduccionYRecetas(c: ContextoPlaza): string {
  return `${htmlExtraccion(c)}${htmlRecetas(c)}`;
}

/** El resumen de la producción para la cabecera del plegable: avisos en iconos (almacén lleno, recursos a la baja, extractores parados). */
export function resumenProduccion(c: ContextoPlaza): string {
  const recursos = recursosDelAlmacen(c.asentamiento);
  const llenos = recursos.filter(([, x]) => x.capacidad > 0 && x.cantidad >= x.capacidad).length;
  const bajan = recursos.filter(([, x]) => flujosDe(x).neto < 0).length;
  const parados = (c.asentamiento.edificios ?? []).filter((x) => x.estado === 'activo' && x.pausadoPorAlmacenLleno).length;
  return [
    bajan ? `<span class="obra-chip baja" title="${bajan} recurso(s) a la baja">▼ ${bajan}</span>` : '',
    llenos ? `<span class="obra-chip lleno" title="${llenos} recurso(s) con el almacén lleno">📦 ${llenos}</span>` : '',
    parados ? `<span class="obra-chip parado" title="${parados} edificio(s) parados por almacén lleno">⏸ ${parados}</span>` : '',
  ].join('');
}

export function cablearProduccionYRecetas(c: ContextoPlaza): void {
  cablearRecetas(c);
  cablearPlegables(c.cuerpo);
}

export const SUBPESTANA_INFORMACION: SubpestanaPlaza = { id: 'informacion', etiqueta: 'Información', html: () => renderPestanaInformacion() };
