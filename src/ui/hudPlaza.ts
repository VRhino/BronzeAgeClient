// El HUD de la plaza en 3D tras «rehacer la interfaz de asentamiento» (Víctor, 2026-11-02). Arriba al centro (desde 0.111.0; antes abajo), una barra en tres placas separadas:
// Población (total y clases, que antes iban en el Resumen), Almacén (hasta 8 recursos elegidos; un clic abre su ventana) y Estado (mantenimiento y nutrición, los medidores del
// Resumen). Arriba a la izquierda, el blasón: el lápiz para cambiar el nombre, la casa (resides aquí o no), la corona (capital) y el medallón
// del nivel, que abre la subida. Debajo del blasón, las obras en marcha. Abajo, el riel de iconos de las ventanas de la
// plaza (0.104.0). Arriba al centro, la franja de la ocupación militar. Aquí está el HTML y su cableado; quien lo pinta y ejecuta los comandos es `main.ts`.
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, ObraDeMapa } from '../tiposDominio';
import { textoEnTiempoReal } from './estadoCliente';
import { iconoEdificio } from './iconosEdificio';
import { ahora, barraAvance, cuentaAtras, medallonNivel, miles, tonoDe, type Tono } from './juegoVisual';
import { avanceDeObra } from './panelObras';
import { poblacionDePlaza } from './panelCentro';

type Escapar = (valor: string) => string;

// ---------------------------------------------------------------- la barra de Población, Almacén y Estado (arriba al centro)

/** Una pieza de la barra: icono, cifra y barrita de llenado; al pasar, un letrero con el nombre y el detalle (una línea por elemento). */
export function pieza(icono: string, cifra: string, llenado: number, nombre: string, detalle: string[], clase: string, esc: Escapar): string {
  const pct = Math.max(0, Math.min(100, llenado));
  return `<span class="asent-recurso${clase ? ` ${clase}` : ''}" data-nombre="${esc(nombre)}" data-detalle="${detalle.map(esc).join('&#10;')}">`
    + `<span class="asent-recurso-icono" aria-hidden="true">${icono}</span>${cifra}<span class="asent-recurso-barra" style="--llenado:${pct.toFixed(1)}%"></span></span>`;
}

/** Una placa de la barra, con su letrero encima. `extra`: atributos más (la del Almacén se pulsa). */
export function grupo(clase: string, titulo: string, piezas: string, extra = ''): string {
  return `<section class="asent-pie-grupo asent-pie-${clase}" aria-label="${titulo}"${extra}><span class="asent-pie-titulo">${titulo}</span><div class="asent-pie-piezas">${piezas}</div></section>`;
}

// ---------------------------------------------------------------- qué recursos van en la barra

/** Cuántos recursos caben en la placa del Almacén (Víctor, 2026-11-03). */
export const MAX_BARRA_ALMACEN = 8;

/** La barra de Población, Almacén y Estado va arriba al centro (Víctor, 2026-11-03), junto al blasón y a la izquierda de los botones del jugador,
 * y su alto cambia (en pantallas medianas pasa a dos o tres filas). Se mide y se deja en la raíz (los avisos flotantes cuelgan del body):
 * `--pie-fin`, dónde acaba por abajo (o la barra del jugador, si no hay), para que las ventanas, la franja de ocupación y los avisos se pongan
 * debajo; y `--botones-ancho`, lo que ocupan a la derecha los botones del jugador, hasta donde llega la barra. */
export function vigilarPieArriba(pantalla: HTMLElement | null): void {
  const pie = pantalla?.querySelector<HTMLElement>('.asent-pie');
  if (!pantalla || !pie || typeof ResizeObserver === 'undefined') return;
  const botones = pantalla.querySelector<HTMLElement>('.jugador-botones');
  const barra = pantalla.querySelector<HTMLElement>('.jugador-barra');
  const raiz = document.documentElement.style;
  const medir = (): void => {
    if (!pantalla.isConnected) return;
    const arriba = pantalla.getBoundingClientRect();
    // los letreros de las placas cuelgan 9 px por debajo de la barra
    const fin = pie.hidden ? (barra?.getBoundingClientRect().bottom ?? arriba.top) : pie.getBoundingClientRect().bottom + 10;
    raiz.setProperty('--pie-fin', `${Math.ceil(fin - arriba.top)}px`);
    if (botones) raiz.setProperty('--botones-ancho', `${Math.ceil(arriba.right - botones.getBoundingClientRect().left)}px`);
  };
  const vigia = new ResizeObserver(medir);
  vigia.observe(pie);
  vigia.observe(pantalla);
  if (botones) vigia.observe(botones);
  medir();
}

// Dos modos (Víctor, 2026-11-03): mientras el jugador no elija, la barra va sola y enseña lo que la plaza tiene (más de 0), hasta 8, en el orden en
// que fue llegando: un recurso nuevo entra al final si queda sitio y uno que se acaba sale; con 8 a la vista, el noveno no entra hasta que salga
// otro. En cuanto el jugador pone o quita uno en la ventana del Almacén, manda su elección (la misma para todas las plazas) y la barra deja de
// cambiar sola; «Que vaya sola» la devuelve al modo automático.
const CLAVE_BARRA = 'bronzeage:barra-almacen-elegida';

/** La elección del jugador (de este navegador; el motor no guarda nada de esto), en su orden; `null` si no ha elegido: la barra va sola. */
function eleccionGuardada(): string[] | null {
  if (memoria !== undefined) return memoria;
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_BARRA) ?? 'null') as unknown;
    if (Array.isArray(guardado)) return guardado.filter((r): r is string => typeof r === 'string' && r in RECURSO_NOMBRE).slice(0, MAX_BARRA_ALMACEN);
  } catch { /* sin almacenamiento: va sola */ }
  return null;
}

function guardarBarra(lista: string[] | null): void {
  try {
    if (lista) localStorage.setItem(CLAVE_BARRA, JSON.stringify(lista));
    else localStorage.removeItem(CLAVE_BARRA);
  } catch { /* sin almacenamiento: dura hasta recargar */ }
  memoria = lista;
}
/** Lo elegido, también si el navegador no deja guardar (dura hasta recargar); `undefined`: aún no se ha mirado. */
let memoria: string[] | null | undefined;

/** Lo que la barra automática enseña en cada plaza, en el orden en que llegó (en memoria: al recargar se rehace en el orden de siempre). */
const automatica = new Map<string, string[]>();

/** La barra automática de una plaza: quita lo que se acabó y añade lo nuevo que tenga (en el orden de los iconos) mientras quepa. */
function barraAutomatica(a: Asentamiento): string[] {
  const hay = (r: string): boolean => (a.almacen?.[r]?.cantidad ?? 0) >= 1;
  const antes = (automatica.get(a.id) ?? []).filter(hay);
  const orden = Object.keys(RECURSO_ICONO);
  const nuevos = Object.keys(a.almacen ?? {}).filter((r) => hay(r) && !antes.includes(r) && r in RECURSO_NOMBRE)
    .sort((x, y) => (orden.indexOf(x) + 1 || 99) - (orden.indexOf(y) + 1 || 99) || x.localeCompare(y));
  const lista = [...antes, ...nuevos].slice(0, MAX_BARRA_ALMACEN);
  automatica.set(a.id, lista);
  return lista;
}

/** Los recursos de la barra de esta plaza: los que eligió el jugador o, si no eligió, los de la barra automática. */
export function recursosDeLaBarra(a: Asentamiento): string[] {
  return eleccionGuardada() ?? barraAutomatica(a);
}

/** ¿La barra va sola (el jugador no ha elegido)? */
export function barraAutomaticaActiva(): boolean {
  return eleccionGuardada() === null;
}

/** Pone o quita un recurso de la barra; la primera vez parte de lo que se ve ahora, y desde ahí manda el jugador. `false` si ya hay
 * `MAX_BARRA_ALMACEN` y se quería poner otro. */
export function alternarRecursoDeLaBarra(a: Asentamiento, recurso: string): boolean {
  const lista = recursosDeLaBarra(a);
  if (lista.includes(recurso)) { guardarBarra(lista.filter((r) => r !== recurso)); return true; }
  if (lista.length >= MAX_BARRA_ALMACEN) return false;
  guardarBarra([...lista, recurso]);
  return true;
}

// Población con lo que se ve sin leer (Víctor, 2026-11-07: «no se logra interpretar que necesito construir viviendas»). Cada barrita lleva:
//   relleno        la gente que hay
//   raya clara     hasta dónde cabe ahora (las Viviendas para pesants y artesanos, el Palacio para la nobleza; en 👥, el menor del sitio y el techo)
//   rombo dorado   lo que pide el nivel siguiente; si la raya queda antes que el rombo, el tramo entre los dos va rayado en rojo
//   tramo oscuro   en 👥, del límite de ahora al techo del nivel: lo que el nivel deja y no cabe
// Sin sitio, la Vivienda con un «+» late junto a la cifra (un clic abre Construcción con ella marcada) y una flecha dice si la gente llega (▲),
// se va (▼) o está parada por falta de sitio (⏸). El ritmo no lo manda el motor: se mira de una proyección a otra.

/** Lo último que se vio de cada clase de cada plaza, para la flecha: el valor, hacia dónde cambió la última vez y cuándo. */
const vistoPob = new Map<string, { valor: number; dir: 1 | -1 | 0; en: number }>();
/** Olvida lo visto (al cambiar de partida; los bancos, para empezar de cero). */
export function olvidarFlechasPob(): void { vistoPob.clear(); }
/** Cuánto dura la flecha tras un cambio (la gente llega a ratos). */
const FLECHA_MS = 5 * 60_000;

function flechaPob(clave: string, valor: number, parado: boolean): string {
  const ahoraMs = Date.now();
  const antes = vistoPob.get(clave);
  if (!antes) vistoPob.set(clave, { valor, dir: 0, en: ahoraMs });
  else if (valor !== antes.valor) vistoPob.set(clave, { valor, dir: valor > antes.valor ? 1 : -1, en: ahoraMs });
  const v = vistoPob.get(clave)!;
  if (v.dir === -1 && ahoraMs - v.en < FLECHA_MS) return '<i class="pob-flecha baja" aria-hidden="true">▼</i>';
  if (parado) return '<i class="pob-flecha parada" aria-hidden="true"></i>';
  if (v.dir === 1 && ahoraMs - v.en < FLECHA_MS) return '<i class="pob-flecha sube" aria-hidden="true">▲</i>';
  return '';
}

/** La barrita de una pieza de población. Todo en % de `escala`. */
function barraPob(tiene: number, escala: number, sitio: number | null, meta: number | undefined, cerrado = false): string {
  const pct = (x: number): number => Math.max(0, Math.min(100, escala > 0 ? (x / escala) * 100 : 0));
  const partes: string[] = [];
  if (sitio !== null && cerrado && pct(sitio) < 100) partes.push(`<i class="pob-cerrado" style="left:${pct(sitio).toFixed(1)}%"></i>`);
  if (sitio !== null && meta !== undefined && sitio < meta) partes.push(`<i class="pob-falta" style="left:${pct(sitio).toFixed(1)}%;width:${(pct(meta) - pct(sitio)).toFixed(1)}%"></i>`);
  if (sitio !== null) partes.push(`<i class="pob-sitio" style="left:${pct(sitio).toFixed(1)}%"></i>`);
  if (meta !== undefined) partes.push(`<i class="pob-meta" style="left:${pct(meta).toFixed(1)}%"></i>`);
  return `<span class="asent-recurso-barra pob-barra" style="--llenado:${pct(tiene).toFixed(1)}%">${partes.join('')}</span>`;
}

/** ¿Ya no cabe más gente de una clase que vive en Viviendas? Lo que enciende el «+» de la Vivienda y el «!» de Construcción. */
export function faltaVivienda(a: Asentamiento): boolean {
  const pob = poblacionDePlaza(a);
  return Boolean(pob?.clases.some((c) => c.vivienda && c.sitio !== null && c.tiene >= c.sitio * 0.95));
}

/** Población: el total contra lo que cabe ahora y el techo del nivel y, tras una raya, cada clase contra su sitio y lo que pide el nivel
 * siguiente. `construir`: quien mira puede poner obras (el «+» de la Vivienda se pulsa). */
export function htmlPoblacionPie(a: Asentamiento, esc: Escapar, alCargar?: () => void, o: { construir?: boolean } = {}): string {
  const pob = poblacionDePlaza(a, alCargar);
  if (!pob) return '';
  const { techo } = pob;
  const sitioTotal = pob.clases.every((c) => c.sitio !== null) ? pob.clases.reduce((t, c) => t + (c.sitio ?? 0), 0) : null;
  const limite = sitioTotal === null ? techo ?? null : techo ? Math.min(techo, sitioTotal) : sitioTotal;
  const lleno = limite !== null && pob.total >= limite * 0.95;
  const escala = Math.max(techo ?? 0, limite ?? 0, pob.total, 1);
  const total = `<span class="asent-recurso pob-pieza${lleno ? ' lleno' : ''}" data-nombre="Población" data-detalle="${[
    limite !== null ? `${miles(pob.total)} de ${miles(limite)} que caben ahora` : `${miles(pob.total)} en total`,
    ...(techo ? [`Techo del nivel ${a.nivel}: ${miles(techo)}`] : []),
  ].map(esc).join('&#10;')}"><span class="asent-recurso-icono" aria-hidden="true">👥</span>${miles(pob.total)}${barraPob(pob.total, escala, limite, undefined, true)}</span>`;
  const clases = pob.clases.map((c) => {
    const sinSitio = c.sitio !== null && (c.vivienda ? c.tiene >= c.sitio * 0.95 : c.sitio > 0 && c.tiene >= c.sitio * 0.95);
    const escalaC = Math.max(c.tiene, c.sitio ?? 0, c.meta ?? 0, 1);
    const flecha = flechaPob(`${a.id}:${c.nombre}`, c.tiene, sinSitio);
    const mas = sinSitio && c.vivienda
      ? (o.construir
        ? `<button type="button" class="pob-vivienda" data-pedir-vivienda aria-label="Construir una Vivienda">${iconoEdificio('vivienda', 16)}<b>+</b></button>`
        : `<span class="pob-vivienda" aria-hidden="true">${iconoEdificio('vivienda', 16)}<b>+</b></span>`)
      : '';
    return `<span class="asent-recurso pob-pieza${sinSitio ? ' lleno' : ''}" data-nombre="${esc(c.nombre)}" data-detalle="${[
      c.sitio !== null ? `${miles(c.tiene)} de ${miles(c.sitio)} que caben` : miles(c.tiene),
      ...(c.meta ? [`El nivel ${pob.nivelMeta} pide ${miles(c.meta)}`] : []),
    ].map(esc).join('&#10;')}"><span class="asent-recurso-icono" aria-hidden="true">${c.icono}</span>${miles(c.tiene)}${flecha}${mas}${barraPob(c.tiene, escalaC, c.sitio, c.meta)}</span>`;
  });
  return grupo('poblacion', 'Población', `${total}<span class="asent-pie-raya" aria-hidden="true"></span>${clases.join('')}`);
}

/** Almacén: los recursos de la barra (`recursosDeLaBarra`: los elegidos, también a 0, o los que tiene la plaza) contra su capacidad; casi lleno, en rojo.
 * Un clic en la placa abre la ventana del Almacén (`data-abrir-almacen`), donde se eligen y está la producción. */
export function htmlAlmacenPie(a: Asentamiento, esc: Escapar): string {
  if (!a.almacen) return '';
  const almacen = a.almacen;
  const lista = recursosDeLaBarra(a);
  const piezas = lista.map((recurso) => {
    const { cantidad, capacidad } = almacen[recurso] ?? { cantidad: 0, capacidad: 0 };
    const llenado = capacidad > 0 ? (cantidad / capacidad) * 100 : 0;
    return pieza(RECURSO_ICONO[recurso] ?? '📦', miles(cantidad), llenado, RECURSO_NOMBRE[recurso] ?? recurso,
      [`${miles(cantidad)}${capacidad > 0 ? ` de ${miles(capacidad)}` : ''}`, 'Clic: el almacén entero y qué se ve aquí'], llenado >= 90 ? 'lleno' : '', esc);
  }).join('') || `<span class="asent-pie-vacio">${barraAutomaticaActiva() ? 'Almacén vacío' : 'Elige qué ver'}</span>`;
  // cuántos van, para repartirlos en una fila o en dos iguales (`--n`, `--n2`) cuando la barra va arriba
  const n = Math.max(1, lista.length);
  return grupo('almacen', 'Almacén', piezas, ` data-abrir-almacen role="button" tabindex="0" title="Abrir el Almacén" style="--n:${n};--n2:${Math.ceil(n / 2)}"`);
}

/** En la ventana del Almacén: todos los recursos de la plaza, para elegir cuáles van en la barra de arriba. */
export function htmlEleccionBarra(a: Asentamiento, esc: Escapar): string {
  const lista = recursosDeLaBarra(a);
  const sola = barraAutomaticaActiva();
  const orden = Object.keys(RECURSO_ICONO);
  const hay = Object.entries(a.almacen ?? {}).filter(([, x]) => x.cantidad >= 1 || x.capacidad > 0).map(([r]) => r);
  const recursos = [...new Set([...hay, ...lista])].sort((x, y) => (orden.indexOf(x) + 1 || 99) - (orden.indexOf(y) + 1 || 99) || x.localeCompare(y));
  const lleno = lista.length >= MAX_BARRA_ALMACEN;
  const chip = (r: string): string => {
    const dentro = lista.includes(r);
    const cantidad = a.almacen?.[r]?.cantidad ?? 0;
    const titulo = dentro ? 'Está en la barra: clic para quitarlo' : lleno ? `La barra ya lleva ${MAX_BARRA_ALMACEN}: quita uno antes` : 'Clic para ponerlo en la barra';
    return `<button type="button" class="barra-eleccion${dentro ? ' elegido' : ''}${!dentro && lleno ? ' sin-sitio' : ''}" data-barra-recurso="${esc(r)}" aria-pressed="${dentro}" title="${esc(titulo)}">`
      + `<span aria-hidden="true">${RECURSO_ICONO[r] ?? '📦'}</span><span class="barra-eleccion-nombre">${esc(RECURSO_NOMBRE[r] ?? r)}</span><small>${miles(cantidad)}</small></button>`;
  };
  const nota = sola
    ? `Ahora va sola: enseña lo que tiene la plaza, hasta ${MAX_BARRA_ALMACEN}, y lo nuevo entra si queda sitio. Si pones o quitas uno, manda tu elección.`
    : `La has elegido tú (hasta ${MAX_BARRA_ALMACEN}, la misma en todas tus plazas). Se guarda en este navegador.`;
  return `<div class="obra-titulo"><span class="faction-kicker">En la barra de arriba</span><span class="obra-chip${lleno ? ' activa' : ''}">${lista.length}/${MAX_BARRA_ALMACEN}</span>`
    + `${sola ? '<span class="obra-chip">Automática</span>' : '<button type="button" class="btn-secondary barra-sola" data-barra-sola>Que vaya sola</button>'}</div>
    <p class="asent-lado-nota">${nota}</p>
    <div class="barra-elecciones">${recursos.map(chip).join('')}</div>`;
}

/** Cablea la elección: cada clic pone o quita y repinta (`alCambiar`); con la barra llena, `avisar`. «Que vaya sola» borra la elección. */
export function cablearEleccionBarra(raiz: HTMLElement, a: Asentamiento, alCambiar: () => void, avisar: (mensaje: string) => void): void {
  raiz.querySelectorAll<HTMLButtonElement>('[data-barra-recurso]').forEach((b) => b.addEventListener('click', () => {
    if (alternarRecursoDeLaBarra(a, b.dataset.barraRecurso!)) alCambiar();
    else avisar(`La barra ya lleva ${MAX_BARRA_ALMACEN} recursos: quita uno antes de poner otro.`);
  }));
  raiz.querySelector('[data-barra-sola]')?.addEventListener('click', () => { guardarBarra(null); alCambiar(); });
}

/** Estado: mantenimiento y nutrición de 0 a 100, en verde, ámbar o rojo, con su palabra y qué los mueve en el letrero. */
export function htmlEstadoPie(a: Asentamiento, esc: Escapar): string {
  const medida = (icono: string, nombre: string, valor: number, palabras: Record<Tono, string>, ayuda: string[]): string => {
    const tono = tonoDe(valor);
    return pieza(icono, String(Math.round(valor)), valor, nombre, [`${palabras[tono]}: ${Math.round(valor)} de 100`, ...ayuda], `tono-${tono}`, esc);
  };
  const piezas = [
    typeof a.medidorMantenimiento === 'number' ? medida('🛠️', 'Mantenimiento', a.medidorMantenimiento, { bien: 'Al día', medio: 'Con retrasos', mal: 'En ruina' }, [
      'Baja si los ingresos no cubren el mantenimiento.',
      'Si se hunde, la plaza rinde como una de nivel menor.',
      ...(a.nivelActual !== undefined && a.nivelActual !== a.nivel ? [`Ahora rinde como una de nivel ${a.nivelActual}.`] : []),
    ]) : '',
    typeof a.nutricionPoblacion === 'number' ? medida('🍞', 'Nutrición', a.nutricionPoblacion, { bien: 'Bien comidos', medio: 'Escasea', mal: 'Hambre' }, [
      'Sube con comida en el almacén y baja sin ella.',
      'Cada clase come primero lo suyo (carne todas; pan los pesants, queso los artesanos, vino y aceite la nobleza) y el trigo pone lo que falte.',
      'Cada bien que comen hace crecer más a su clase.',
      'Con poca, la gente crece despacio; a cero, muere.',
    ]) : '',
  ].join('');
  return piezas ? grupo('estado', 'Estado', piezas) : '';
}

/** Las tres placas, cada una solo si tiene algo (de una plaza ajena no llegan ni la población ni los medidores ni el almacén). */
export function htmlPieDePlaza(a: Asentamiento, esc: Escapar, alCargar?: () => void, o: { construir?: boolean } = {}): string {
  return htmlPoblacionPie(a, esc, alCargar, o) + htmlAlmacenPie(a, esc) + htmlEstadoPie(a, esc);
}

// ---------------------------------------------------------------- el blasón

/** Lo que enseña el blasón de la vista 3D. `escudo`: el SVG del escudo de la Facción dueña. `residencia`: `null` si la plaza no es de tu Facción. */
export interface BlasonHud {
  nombre: string;
  faccion: string;
  /** El Rey de la Facción dueña, en una plaza ajena (lo que decía su Resumen). */
  rey?: string;
  escudo: string;
  nivel: number;
  nivelActual?: number;
  /** Si puedes cambiarle el nombre (resides aquí) y si lo estás cambiando ahora. */
  renombrar: boolean;
  editando: boolean;
  residencia: 'dentro' | 'fuera' | null;
  /** La corona: es la capital, o eres el Rey y podrías designarla; `null`, sin corona. */
  capital: 'si' | 'puede' | null;
  /** Lo que cuelga ahora del blasón. */
  abierto: 'residencia' | 'capital' | null;
  /** El medallón abre la subida de nivel (plaza de tu Facción); `listo`, se puede pedir ya y brilla. */
  ascenso: 'listo' | 'abrir' | null;
}

const CASA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/></svg>';
const CORONA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18 3 7l5 4 4-6 4 6 5-4-1 11Z"/><path d="M4 21h16"/></svg>';

/** El blasón: escudo con el medallón del nivel, el nombre (con su lápiz, o el campo para cambiarlo), la Facción y, a la derecha, casa y corona. */
export function htmlBlasonHud(b: BlasonHud, esc: Escapar): string {
  const opera = b.nivelActual !== undefined && b.nivelActual !== b.nivel
    ? `<small class="asent-blason-opera" title="Por el mantenimiento, funciona como una plaza de nivel ${b.nivelActual}">rinde como ${b.nivelActual}</small>` : '';
  const nombre = b.editando && b.renombrar
    ? `<span class="asent-blason-renombrar"><input class="form-input" type="text" maxlength="32" data-campo="nombre-plaza" value="${esc(b.nombre)}" aria-label="Nombre de la ciudad" />
        <button type="button" class="asent-blason-ok" data-guardar-nombre title="Guardar el nombre (Intro)" aria-label="Guardar el nombre">✓</button><button type="button" data-cancelar-nombre title="Cancelar (Esc)" aria-label="Cancelar">✕</button></span>`
    : `<span class="asent-blason-nombre"><strong class="asent-nombre">${esc(b.nombre)}</strong>${b.renombrar ? '<button type="button" class="asent-blason-lapiz" data-editar-nombre title="Cambiar el nombre de la ciudad" aria-label="Cambiar el nombre">✎</button>' : ''}</span>`;
  const icono = (clase: string, dato: string, abierto: boolean, titulo: string, svg: string): string =>
    `<button type="button" class="asent-blason-icono ${clase}" data-${dato} aria-expanded="${abierto}" title="${titulo}" aria-label="${titulo}">${svg}</button>`;
  const iconos = [
    b.residencia === null ? '' : icono(b.residencia, 'residencia', b.abierto === 'residencia', b.residencia === 'dentro' ? 'Resides aquí: es tu base' : 'No resides aquí', CASA),
    b.capital === null ? '' : icono(b.capital === 'si' ? 'dentro' : 'fuera', 'capital', b.abierto === 'capital', b.capital === 'si' ? 'Capital de la Facción' : 'No es la capital: como Rey, puedes designarla', CORONA),
  ].join('');
  const medallon = medallonNivel(b.nivel, '', `Plaza de nivel ${b.nivel}`);
  const titulo = b.ascenso === 'listo' ? `Plaza de nivel ${b.nivel}: ya puede subir a nivel ${b.nivel + 1}` : `Plaza de nivel ${b.nivel}: subir de nivel`;
  return `<span class="asent-blason-escudo">${b.escudo}</span>
    <span class="asent-blason-texto">${nombre}<small>${esc(b.faccion)}</small>${b.rey ? `<small>Rey: ${esc(b.rey)}</small>` : ''}${opera}</span>
    ${b.ascenso ? `<button type="button" class="asent-blason-medallon${b.ascenso === 'listo' ? ' listo' : ''}" data-ascenso title="${titulo}" aria-label="${titulo}">${medallon}</button>` : `<span class="asent-blason-medallon">${medallon}</span>`}
    ${iconos ? `<span class="asent-blason-iconos">${iconos}</span>` : ''}`;
}

/** Qué hace cada cosa del blasón. */
export interface AccionesBlason { editar: () => void; guardar: (nombre: string) => void; cancelar: () => void; residencia: () => void; capital: () => void; ascenso: () => void }

export function cablearBlasonHud(el: HTMLElement, x: AccionesBlason): void {
  const campo = el.querySelector<HTMLInputElement>('[data-campo="nombre-plaza"]');
  el.querySelector('[data-editar-nombre]')?.addEventListener('click', x.editar);
  el.querySelector('[data-guardar-nombre]')?.addEventListener('click', () => x.guardar(campo?.value ?? ''));
  el.querySelector('[data-cancelar-nombre]')?.addEventListener('click', x.cancelar);
  campo?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') x.guardar(campo.value);
    if (ev.key === 'Escape') { ev.stopPropagation(); x.cancelar(); }
  });
  el.querySelector('[data-residencia]')?.addEventListener('click', x.residencia);
  el.querySelector('[data-capital]')?.addEventListener('click', x.capital);
  el.querySelector('[data-ascenso]')?.addEventListener('click', x.ascenso);
}

// ---------------------------------------------------------------- ocupación, obras y riel

/** La franja de la ocupación militar, arriba al centro mientras dura (antes, en el Resumen). Vacía sin ocupación. */
export function htmlOcupacion(a: Asentamiento): string {
  return typeof a.ocupacionHasta === 'number' && a.ocupacionHasta > ahora()
    ? `<span aria-hidden="true">⚔️</span><strong>Bajo ocupación militar</strong><span>faltan ${cuentaAtras(a.ocupacionHasta)}</span>` : '';
}

/** El panel de obras bajo el blasón (0.109.0: sustituye a «Obras» de Construcción). Arriba lo que está en obra, cada una con su barra de avance y
 * lo que le falta (las 4 que antes acaban; el resto, en un «N más»); debajo, la cola en casillas numeradas por orden de arranque. Quien puede
 * tocarla (Gobernador o Maestro de Obras, `puedeTocar`) ve ◀ ✕ ▶ en cada casilla; los demás, solo la cola. Vacío sin obras. */
/** Las obras de pueblo y de aldea de la plaza que salen en «Obras» del panel izquierdo (Víctor, 2026-11-04). */
const OBRA_MAPA: Partial<Record<ObraDeMapa['tipo'], [string, string]>> = { pueblo: ['⛏️', 'Pueblo'], aldea: ['🌾', 'Aldea agrícola'], mejoraAldea: ['⬆️', 'Mejora de aldea'] };
/** Y las de avanzada, en su propia sección debajo (Víctor, 2026-11-04 18:48). */
const OBRA_AVANZADA: Partial<Record<ObraDeMapa['tipo'], [string, string]>> = { avanzada: ['🗼', 'Atalaya'], mejoraAvanzada: ['⬆️', 'Mejora de avanzada'], reparacion: ['🔧', 'Reparación de avanzada'] };

/** El tiempo que le queda, en tiempo real al ritmo del mundo, como en la tarjeta de Territorio (0.149.1). */
function filaObraMapa(o: ObraDeMapa, esc: Escapar): string {
  const [icono, nombre] = OBRA_MAPA[o.tipo] ?? OBRA_AVANZADA[o.tipo] ?? ['🔨', 'Obra'];
  const pedido = Object.values(o.requerido).reduce((t, n) => t + n, 0);
  const hecho = Object.entries(o.requerido).reduce((t, [r, n]) => t + Math.min(n, o.entregado[r] ?? 0), 0);
  const avance = pedido > 0 ? hecho / pedido : 1;
  const levantando = o.terminaEn !== undefined;
  return `<div class="obras-hud-fila obras-hud-mapa"><span class="obras-hud-icono" aria-hidden="true">${icono}</span>`
    + `<span class="obras-hud-texto"><span class="obras-hud-linea"><strong>${esc(nombre)}</strong><b class="obras-hud-falta">${levantando ? textoEnTiempoReal(o.terminaEn! - ahora()) : `${Math.floor(avance * 100)} %`}</b></span>`
    + `<small>${levantando ? 'Levantándose en el mapa' : 'Esperando materiales en el mapa'}</small>${barraAvance(levantando ? null : avance)}</span></div>`;
}

export function htmlObrasHud(a: Asentamiento, esc: Escapar, puedeTocar = false, obrasDeMapa: readonly ObraDeMapa[] = []): string {
  const porFin = (x: ObraDeMapa, y: ObraDeMapa): number => (x.terminaEn ?? Infinity) - (y.terminaEn ?? Infinity);
  const deMapa = obrasDeMapa.filter((o) => o.madreId === a.id && o.propia && OBRA_MAPA[o.tipo]).sort(porFin);
  const deAvanzada = obrasDeMapa.filter((o) => o.madreId === a.id && o.propia && OBRA_AVANZADA[o.tipo]).sort(porFin);
  const enMarcha = a.edificios.flatMap((e) => {
    const fin = e.mejora?.completaEn ?? (e.estado === 'en_construccion' ? e.completaEn : undefined);
    return typeof fin === 'number' ? [{ e, fin, que: e.mejora ? `Mejora a nivel ${e.mejora.nivelObjetivo}` : e.danado ? 'Reparación' : 'Obra nueva' }] : [];
  }).sort((x, y) => x.fin - y.fin);
  const esperan = a.edificios.filter((e) => e.estado === 'en_cola').sort((x, y) => (y.prioridad ?? 0) - (x.prioridad ?? 0));
  if (!enMarcha.length && !esperan.length && !deMapa.length && !deAvanzada.length) return '';
  const filas = enMarcha.slice(0, 4).map(({ e, fin, que }) => `<div class="obras-hud-fila"><span class="obras-hud-icono">${iconoEdificio(e.tipo, 22)}</span>`
    + `<span class="obras-hud-texto"><span class="obras-hud-linea"><strong>${esc(EDIFICIO_NOMBRE[e.tipo] ?? e.tipo)}</strong><b class="obras-hud-falta">${cuentaAtras(fin)}</b>${puedeTocar ? `<button type="button" class="obras-hud-cancelar" data-obra-cancelar="${esc(e.id)}" title="${e.mejora ? 'Cancelar la mejora' : 'Cancelar la obra'} (no se devuelve nada)" aria-label="${e.mejora ? 'Cancelar la mejora' : 'Cancelar la obra'}">✕</button>` : ''}</span>`
    + `<small>${que}</small>${barraAvance(avanceDeObra(a, e))}</span></div>`).join('');
  const mas = enMarcha.length > 4 ? `<small class="obras-hud-mas">${enMarcha.length - 4} más en marcha</small>` : '';
  const casillas = esperan.map((e, i) => `<div class="obras-hud-casilla${e.danado ? ' danado' : ''}" title="${esc(`${i + 1}. ${EDIFICIO_NOMBRE[e.tipo] ?? e.tipo}${e.danado ? ' · reconstrucción' : ''}`)}">`
    + `<span class="obras-hud-n">${i + 1}</span>${iconoEdificio(e.tipo, 22)}`
    + (puedeTocar ? `<span class="obras-hud-ctl"><button type="button" data-cola-mover="arriba" data-edificio="${esc(e.id)}" title="Antes" aria-label="Antes"${i === 0 ? ' disabled' : ''}>◀</button><button type="button" data-cola-quitar="${esc(e.id)}" title="Quitar de la cola" aria-label="Quitar">✕</button><button type="button" data-cola-mover="abajo" data-edificio="${esc(e.id)}" title="Después" aria-label="Después"${i === esperan.length - 1 ? ' disabled' : ''}>▶</button></span>` : '')
    + '</div>').join('');
  return `<div class="obras-hud">${enMarcha.length || esperan.length ? `<span class="obras-hud-cab">Obras${enMarcha.length ? ` · ${enMarcha.length} en marcha` : ''}</span>` : ''}${filas}${mas}`
    + (esperan.length ? `<span class="obras-hud-cab obras-hud-cab-cola">En cola · ${esperan.length}</span><div class="obras-hud-cola">${casillas}</div>` : '')
    + (deMapa.length ? `<span class="obras-hud-cab obras-hud-cab-cola">Pueblos y aldeas · ${deMapa.length}</span>${deMapa.map((o) => filaObraMapa(o, esc)).join('')}` : '')
    + (deAvanzada.length ? `<span class="obras-hud-cab obras-hud-cab-cola">Avanzadas · ${deAvanzada.length}</span>${deAvanzada.map((o) => filaObraMapa(o, esc)).join('')}` : '')
    + '</div>';
}

const T = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const R = 'fill="var(--relleno, rgba(205,160,90,0.25))" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';

/** Los iconos del riel que no son de un edificio (en el mismo estilo que los de `iconosEdificio.ts`, 32 × 32). */
export const ICONO_RIEL = {
  // una obra con su andamio y el martillo
  construccion: `<svg class="icono-edificio" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path ${R} d="M5 27V15l8-5 8 5v12Z"/><path ${T} d="M3 27h26M10 27v-6h6v6M24 27V13M21 13h6"/><path ${R} d="M21 4l6 3-2 3-6-3Z"/><path ${T} d="M22 8l-4 8"/></svg>`,
  // una bandera clavada en un cerro, con los campos al pie
  territorio: `<svg class="icono-edificio" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path ${R} d="M3 26l8-11 5 6 4-4 9 9Z"/><path ${T} d="M16 15V4l7 3-7 3M3 29h26M7 26l2 3M13 26l2 3M19 26l2 3"/></svg>`,
  // el sello de la Facción: un escudo con la corona
  gobierno: `<svg class="icono-edificio" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path ${R} d="M16 4l10 4v8c0 7-5 11-10 13C11 27 6 23 6 16V8Z"/><path ${T} d="M11 19l-1-7 3 2 3-4 3 4 3-2-1 7Z"/></svg>`,
  // un estandarte con su asta: unirse a un ejército que pasa
  ejercito: `<svg class="icono-edificio" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path ${R} d="M10 5h15l-4 5 4 5H10Z"/><path ${T} d="M10 3v26M6 29h8M10 5h15l-4 5 4 5H10"/></svg>`,
  // la lira de los Aedas: dos brazos curvos, el yugo arriba, la caja abajo y las cuerdas
  aedas: `<svg class="icono-edificio" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path ${R} d="M10 22c0 4 12 4 12 0v-2H10Z"/><path ${T} d="M11 20C7 15 7 9 10 5M21 20c4-5 4-11 1-15M8 7h16M13 7v14M16 7v14M19 7v14"/></svg>`,
} as const;
