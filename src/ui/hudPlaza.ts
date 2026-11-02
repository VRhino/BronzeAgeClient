// El HUD de la plaza en 3D tras «rehacer la interfaz de asentamiento» (Víctor, 2026-11-02). Abajo, una barra en tres placas separadas:
// Población (total y clases, que antes iban en el Resumen), Almacén (la tira de siempre) y Estado (mantenimiento y nutrición, los medidores del
// Resumen). Arriba a la izquierda, el blasón: el lápiz para cambiar el nombre, la casa (resides aquí o no), la corona (capital) y el medallón
// del nivel, que abre la subida. Debajo, el riel de iconos de las ventanas de la plaza y las obras en marcha. Arriba al centro, la franja de la
// ocupación militar. Aquí está el HTML y su cableado; quien lo pinta y ejecuta los comandos es `main.ts`.
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { iconoEdificio } from './iconosEdificio';
import { ahora, cuentaAtras, medallonNivel, miles, tonoDe, type Tono } from './juegoVisual';
import { poblacionDePlaza } from './panelCentro';

type Escapar = (valor: string) => string;

// ---------------------------------------------------------------- la barra de abajo

/** Una pieza de la barra: icono, cifra y barrita de llenado; al pasar, un letrero con el nombre y el detalle (una línea por elemento). */
function pieza(icono: string, cifra: string, llenado: number, nombre: string, detalle: string[], clase: string, esc: Escapar): string {
  const pct = Math.max(0, Math.min(100, llenado));
  return `<span class="asent-recurso${clase ? ` ${clase}` : ''}" data-nombre="${esc(nombre)}" data-detalle="${detalle.map(esc).join('&#10;')}">`
    + `<span class="asent-recurso-icono" aria-hidden="true">${icono}</span>${cifra}<span class="asent-recurso-barra" style="--llenado:${pct.toFixed(1)}%"></span></span>`;
}

/** Una placa de la barra, con su letrero encima. */
function grupo(clase: string, titulo: string, piezas: string): string {
  return `<section class="asent-pie-grupo asent-pie-${clase}" aria-label="${titulo}"><span class="asent-pie-titulo">${titulo}</span><div class="asent-pie-piezas">${piezas}</div></section>`;
}

/** Población: el total contra el techo del nivel y, tras una raya, cada clase contra el sitio que tiene (en rojo si ya no cabe nadie más). */
export function htmlPoblacionPie(a: Asentamiento, esc: Escapar, alCargar?: () => void): string {
  const pob = poblacionDePlaza(a, alCargar);
  if (!pob) return '';
  const { techo } = pob;
  const total = pieza('👥', miles(pob.total), techo ? (pob.total / techo) * 100 : 0, 'Población',
    [techo ? `${miles(pob.total)} de ${miles(techo)}, el techo del nivel ${a.nivel}` : `${miles(pob.total)} en total`],
    techo && pob.total >= techo * 0.95 ? 'lleno' : '', esc);
  const clases = pob.clases.map((c) => {
    const lleno = c.sitio !== null && c.sitio > 0 && c.tiene >= c.sitio * 0.95;
    return pieza(c.icono, miles(c.tiene), c.sitio ? (c.tiene / c.sitio) * 100 : 0, c.nombre, [
      c.sitio !== null ? `${miles(c.tiene)} de ${miles(c.sitio)} que caben` : miles(c.tiene),
      ...(c.meta ? [`El nivel ${pob.nivelMeta} pide ${miles(c.meta)}`] : []),
      ...(lleno ? ['Sin sitio: hacen falta más Viviendas'] : []),
    ], lleno ? 'lleno' : '', esc);
  });
  return grupo('poblacion', 'Población', `${total}<span class="asent-pie-raya" aria-hidden="true"></span>${clases.join('')}`);
}

/** Almacén: lo que hay de cada recurso (solo lo que pasa de 0) contra su capacidad; casi lleno, en rojo. */
export function htmlAlmacenPie(a: Asentamiento, esc: Escapar): string {
  const items = Object.entries(a.almacen ?? {})
    .filter(([, r]) => Math.floor(r.cantidad) >= 1)
    .sort(([x], [y]) => x.localeCompare(y));
  if (!items.length) return '';
  return grupo('almacen', 'Almacén', items.map(([recurso, { cantidad, capacidad }]) => {
    const llenado = capacidad > 0 ? (cantidad / capacidad) * 100 : 0;
    return pieza(RECURSO_ICONO[recurso] ?? '📦', miles(cantidad), llenado, RECURSO_NOMBRE[recurso] ?? recurso,
      [`${miles(cantidad)}${capacidad > 0 ? ` de ${miles(capacidad)}` : ''}`], llenado >= 90 ? 'lleno' : '', esc);
  }).join(''));
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
      'Sube con trigo en el almacén y baja sin él.',
      'Con poca, la gente crece despacio; a cero, muere.',
    ]) : '',
  ].join('');
  return piezas ? grupo('estado', 'Estado', piezas) : '';
}

/** Las tres placas, cada una solo si tiene algo (de una plaza ajena no llegan ni la población ni los medidores ni el almacén). */
export function htmlPieDePlaza(a: Asentamiento, esc: Escapar, alCargar?: () => void): string {
  return htmlPoblacionPie(a, esc, alCargar) + htmlAlmacenPie(a, esc) + htmlEstadoPie(a, esc);
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

/** Las obras en marcha (las 3 que antes acaban, con su cuenta atrás) y cuántas esperan en la cola; un clic abre Construcción. Vacío sin obras. */
export function htmlObrasHud(a: Asentamiento, esc: Escapar): string {
  const enMarcha = a.edificios.flatMap((e) => {
    const fin = e.mejora?.completaEn ?? (e.estado === 'en_construccion' ? e.completaEn : undefined);
    return typeof fin === 'number' ? [{ e, fin, que: e.mejora ? `Mejora a nivel ${e.mejora.nivelObjetivo}` : e.danado ? 'Reparación' : 'Obra nueva' }] : [];
  }).sort((x, y) => x.fin - y.fin);
  const enCola = a.edificios.filter((e) => e.estado === 'en_cola').length;
  if (!enMarcha.length && !enCola) return '';
  const filas = enMarcha.slice(0, 3).map(({ e, fin, que }) => `<span class="obras-hud-fila"><span class="obras-hud-icono">${iconoEdificio(e.tipo, 22)}</span>`
    + `<span class="obras-hud-texto"><strong>${esc(EDIFICIO_NOMBRE[e.tipo] ?? e.tipo)}</strong><small>${que}</small></span><b class="obras-hud-falta">${cuentaAtras(fin)}</b></span>`).join('');
  const mas = [enMarcha.length > 3 ? `${enMarcha.length - 3} más en marcha` : '', enCola ? `${enCola} en cola` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="obras-hud" data-ventana-plaza="construccion" title="Abrir Construcción"><span class="obras-hud-cab">Obras${enMarcha.length ? ` · ${enMarcha.length} en marcha` : ''}</span>${filas}${mas ? `<small class="obras-hud-mas">${mas}</small>` : ''}</button>`;
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
} as const;
