// Subpestaña «Muralla» de Centro urbano: comprometer, ampliar, mejorar y abandonar recintos (`comprometerRecinto`, `mejorarRecinto`, `abandonarRecinto`).
// Con aire de juego (2026-11-02): el plano de los anillos (celda a celda: en pie, la que se levanta, lo que falta, puertas y torres), una tarjeta por
// anillo con su escudo de nivel, material, puertas, torres, bono de defensa, barra de obra y coste por celda, y los tres anillos posibles como
// casillas para trazar el siguiente. Se desactiva lo que el servidor rechazaría seguro (no residir, no tener cargo, otro anillo en obra) diciendo por
// qué; su rechazo sale flotando. `renderPestanaMuralla` (`#/legacy`) sigue con su forma de siempre.
import { bloqueDeDatos } from '../apiCliente';
import type { Asentamiento, Recinto } from '../tiposDominio';
import { ayuda } from './ayuda';
import { mostrar as mostrarAviso } from './avisos';
import { confirmar } from './dialogo';
import { textoEnTiempoReal } from './estadoCliente';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { barraAvance, chipsDeCoste, medallonNivel } from './juegoVisual';
import { integridadDe, msPorCelda, NIVEL_DE_PLAZA_POR_ANILLO, NIVEL_MAXIMO_MURALLA, NIVEL_MINIMO_MURALLA } from './pestanaMuralla';

type Escapar = (valor: string) => string;
const MATERIAL = ['Empalizada', 'Muro de piedra', 'Muralla con adarve'];
const MATERIAL_ICONO = ['🪵', '🪨', '🏰'];

interface DatosMuralla { tarifaPorCelda?: Record<string, Record<string, number>>; bonoDefensaPorNivel?: Record<string, number>; factorPuerta?: number; factorTorre?: number }
const datosMuralla = (alCargar?: () => void): DatosMuralla | null => bloqueDeDatos<DatosMuralla>('MURALLA', alCargar);

/** Las puertas de un anillo: cada tirada 4-conexa de celdas de puerta es una sola (Murallas §2), aunque mida dos celdas. */
function aberturas(r: Recinto): number {
  const puertas = r.celdas.filter((x) => x.clase === 'puerta');
  const vistas = new Set<number>();
  let n = 0;
  puertas.forEach((_, i) => {
    if (vistas.has(i)) return;
    n += 1;
    const pila = [i];
    vistas.add(i);
    while (pila.length) {
      const k = puertas[pila.pop()!]!;
      puertas.forEach((o, j) => { if (!vistas.has(j) && Math.abs(o.col - k.col) + Math.abs(o.row - k.row) === 1) { vistas.add(j); pila.push(j); } });
    }
  });
  return n;
}

/** Lo que va de una tarifa acumulada a la anterior (el coste de mejorar una celda). */
function diferencia(destino?: Record<string, number>, antes?: Record<string, number>): Record<string, number> | undefined {
  if (!destino) return undefined;
  return Object.fromEntries(Object.entries(destino).map(([r, n]) => [r, Math.max(0, n - (antes?.[r] ?? 0))] as const).filter(([, n]) => n > 0));
}

/** El anillo elegido para trazar (sobrevive a los repintados del sondeo). */
let nivelElegido = 1;

/** Plano de los anillos, celda a celda: en pie (del color de su material), la que se levanta, lo que falta (punteado), puertas y torres. */
function plano(recintos: Recinto[]): string {
  const celdas = recintos.flatMap((r) => r.celdas.map((c, i) => ({ c, i, r })));
  if (celdas.length === 0) return '';
  const cols = celdas.map((x) => x.c.col), filas = celdas.map((x) => x.c.row);
  const minC = Math.min(...cols), minR = Math.min(...filas);
  const ancho = Math.max(...cols) - minC + 1, alto = Math.max(...filas) - minR + 1;
  const tam = Math.max(3, Math.min(12, Math.floor(240 / Math.max(ancho, alto))));
  const rects = celdas.map(({ c, i, r }) => {
    const mejorada = r.mejorandoA !== undefined && i < (r.mejoradas ?? 0);
    const curso = r.mejorandoA !== undefined ? i === (r.mejoradas ?? 0) : i === r.avance + 1;
    const estado = mejorada ? 'pie' : curso ? 'curso' : i <= r.avance ? 'pie' : 'falta';
    const nivel = mejorada ? r.mejorandoA! : r.nivel;
    return `<rect class="mp-${estado} mp-n${nivel} mp-${c.clase}" x="${(c.col - minC) * tam}" y="${(c.row - minR) * tam}" width="${tam - 1}" height="${tam - 1}" rx="${c.clase === 'torre' ? 0 : 1}"/>`;
  }).join('');
  const w = ancho * tam, h = alto * tam;
  return `<svg class="muralla-plano" viewBox="-4 -4 ${w + 8} ${h + 8}" width="${w + 8}" height="${h + 8}" role="img" aria-label="Plano de la muralla">
    <circle class="mp-centro" cx="${w / 2}" cy="${h / 2}" r="${Math.max(3, tam)}"/>${rects}</svg>`;
}

function tarjetaAnillo(c: ContextoPlaza, r: Recinto, exterior: boolean, puedeComprometer: boolean, esGobernador: boolean, cargo: string, motivo: string, e: Escapar): string {
  const a = c.asentamiento;
  const datos = datosMuralla(c.refrescar);
  const mejora = r.mejorandoA !== undefined;
  const completo = integridadDe(r) >= 1;
  const total = r.celdas.length;
  const hechas = mejora ? r.mejoradas ?? 0 : r.avance + 1;
  const torres = r.celdas.filter((x) => x.clase === 'torre').length;
  const puertas = aberturas(r);
  // Multiplicador de defensa (Murallas §9.1): 1 + (bono − 1) × integridad / puertas; cuenta el anillo exterior de los que alguna vez se cerraron.
  const bonoNivel = datos?.bonoDefensaPorNivel?.[String(r.nivel)];
  const bono = bonoNivel === undefined ? undefined : Math.round((1 + ((bonoNivel - 1) * Math.min(1, integridadDe(r))) / Math.max(1, puertas)) * 100) / 100;
  const estado = mejora ? `⬆ a nivel ${r.mejorandoA}` : completo ? '✓ cerrado' : '🔨 en obra';
  let obra = '';
  if (!completo || mejora) {
    const nivelObra = mejora ? r.mejorandoA! : r.nivel;
    const porCelda = msPorCelda(a, nivelObra);
    const ahora = c.proyeccion.instante;
    const siguiente = r.siguienteCeldaEn;
    const quedan = total - hechas;
    const enCurso = siguiente !== undefined && siguiente > ahora;
    const celda = porCelda === null ? ''
      : enCurso ? `<div class="anillo-celda"><small>Celda ${hechas + 1}</small>${barraAvance(Math.max(0, Math.min(1, 1 - (siguiente - ahora) / porCelda)))}<small>${textoEnTiempoReal(siguiente - ahora)}</small></div>`
        : '<p class="anillo-parada">⏸ Celda parada: falta material en el almacén o tocaría la reserva. Sigue sola en cuanto lo haya.</p>';
    const resto = porCelda === null ? '' : `<small class="anillo-resto">⏳ quedan ${textoEnTiempoReal((enCurso ? siguiente - ahora : porCelda) + Math.max(0, quedan - 1) * porCelda)} · ${textoEnTiempoReal(porCelda)} por celda</small>`;
    // La tarifa es la acumulada (Murallas §11): levantar paga la del nivel; mejorar, la diferencia con la del nivel de antes.
    const tarifa = mejora ? diferencia(datos?.tarifaPorCelda?.[String(nivelObra)], datos?.tarifaPorCelda?.[String(nivelObra - 1)]) : datos?.tarifaPorCelda?.[String(nivelObra)];
    obra = `${celda}${resto}${tarifa ? `<div class="anillo-tarifa" title="Lo que cuesta cada celda de muro; una de puerta, ×${datos?.factorPuerta ?? 4}; una de torre, ×${datos?.factorTorre ?? 3}"><small>Cada celda</small>${chipsDeCoste(a, tarifa, e)}</div>` : ''}`;
  }
  const acciones: string[] = [];
  const apagado = motivo ? ` disabled title="${e(motivo)}"` : '';
  if (completo && !mejora && r.nivel < NIVEL_MAXIMO_MURALLA && puedeComprometer) {
    const pide = NIVEL_DE_PLAZA_POR_ANILLO[r.nivel]!;
    const bajo = (a.nivelActual ?? a.nivel) < pide ? `Mejorar a ${MATERIAL[r.nivel]} pide una plaza de nivel ${pide}.` : '';
    acciones.push(`<button class="anillo-mejorar" type="button" data-mejorar-recinto="${e(r.id)}" data-cargo="${cargo}"${motivo || bajo ? ` disabled title="${e(motivo || bajo)}"` : ''}>⬆ ${MATERIAL_ICONO[r.nivel]} ${MATERIAL[r.nivel]}</button>`);
  }
  // Abandonar: solo el Gobernador y solo un anillo sin cerrar (uno terminado no se derriba).
  if (!completo && esGobernador) acciones.push(`<button class="anillo-abandonar" type="button" data-abandonar-recinto="${e(r.id)}"${apagado}>✕ Abandonar</button>`);
  const pct = total > 0 ? hechas / total : 0;
  return `<div class="anillo ${mejora ? 'mejora' : completo ? 'cerrado' : 'obra'}">
      <div class="anillo-cab">${medallonNivel(r.nivel, completo ? '' : 'apagado', `${MATERIAL[r.nivel - 1] ?? `Nivel ${r.nivel}`}`)}
        <span class="anillo-titulo"><strong>${MATERIAL_ICONO[r.nivel - 1] ?? ''} ${MATERIAL[r.nivel - 1] ?? `Nivel ${r.nivel}`}</strong><small>Recinto ${exterior ? 'exterior' : 'interior'}</small></span>
        <span class="anillo-estado">${estado}</span></div>
      <div class="anillo-chips"><span class="obra-chip" title="Puertas (una abertura de dos celdas cuenta como una)">🚪 ${puertas}</span><span class="obra-chip" title="Torres">🗼 ${torres}</span><span class="obra-chip" title="Celdas del anillo">▦ ${total}</span>${bono !== undefined ? `<span class="obra-chip" title="Multiplicador de defensa: el bono del material repartido entre las puertas y según lo que hay en pie (cuenta el anillo exterior de los que se cerraron)">🛡 ×${bono}</span>` : ''}</div>
      <div class="anillo-avance" title="${hechas} de ${total} celdas${mejora ? ' mejoradas' : ' en pie'}">${barraAvance(pct)}<small>${hechas}/${total} ${mejora ? 'mejoradas' : 'en pie'} · ${Math.round(pct * 100)}%</small></div>
      ${obra}
      ${acciones.length ? `<div class="anillo-acciones">${acciones.join('')}</div>` : ''}
    </div>`;
}

function html(c: ContextoPlaza): string {
  const { asentamiento: a, proyeccion: p, escapar: e } = c;
  const cargos = a.cargos ?? {};
  const esGobernador = cargos.gobernadorId === p.heroeId;
  const puedeComprometer = esGobernador || cargos.maestroObrasId === p.heroeId;
  const cargo = esGobernador ? 'gobernador' : 'maestroObras';
  const nivel = a.nivelActual ?? a.nivel;
  const recintos = a.recintos ?? [];
  const enObra = recintos.some((r) => r.avance < r.celdas.length - 1);
  const motivo = !c.resideAqui ? 'Solo quien reside en esta plaza gestiona su muralla.' : '';
  const datos = datosMuralla(c.refrescar);

  const anillos = recintos.length === 0 ? '<p class="mapa-lista-vacia">La plaza aún no tiene ningún recinto amurallado.</p>'
    : `<div class="muralla-vista">${plano(recintos)}<div class="muralla-leyenda"><span><i class="mp-pie mp-n1"></i>en pie</span><span><i class="mp-curso"></i>levantándose</span><span><i class="mp-falta"></i>por levantar</span><span><i class="mp-pie mp-puerta"></i>puerta</span><span><i class="mp-pie mp-torre"></i>torre</span></div></div>
      ${recintos.map((r, i) => tarjetaAnillo(c, r, i === recintos.length - 1, puedeComprometer, esGobernador, cargo, motivo, e)).join('')}`;

  let trazar: string;
  if (!puedeComprometer) trazar = '<p class="asent-lado-nota">Trazar o mejorar la muralla es del Gobernador o del Maestro de Obras de la plaza.</p>';
  else if (enObra) trazar = '<p class="asent-lado-nota">Hay un anillo en obra: termínalo o abandónalo antes de trazar otro.</p>';
  else {
    const permitidos = NIVEL_DE_PLAZA_POR_ANILLO.map((pide, i) => (nivel >= pide ? i + 1 : 0)).filter(Boolean);
    if (!permitidos.includes(nivelElegido)) nivelElegido = permitidos[0] ?? 1;
    const opciones = NIVEL_DE_PLAZA_POR_ANILLO.map((pide, i) => {
      const n = i + 1;
      const bloqueada = nivel < pide;
      const tarifa = datos?.tarifaPorCelda?.[String(n)];
      const porCelda = msPorCelda(a, n);
      const bono = datos?.bonoDefensaPorNivel?.[String(n)];
      return `<label class="anillo-opcion${bloqueada ? ' bloqueada' : ''}" title="${e(bloqueada ? `Pide una plaza de nivel ${pide}` : `${MATERIAL[i]}: se paga celda a celda`)}">
        <input type="radio" name="muralla-nivel" value="${n}"${n === nivelElegido && !bloqueada ? ' checked' : ''}${bloqueada ? ' disabled' : ''} />
        <span class="anillo-opcion-icono" aria-hidden="true">${MATERIAL_ICONO[i]}</span><strong>${MATERIAL[i]}</strong>
        <small${bono !== undefined ? ' title="Bono de defensa del material, antes de repartirlo entre las puertas"' : ''}>${bono !== undefined ? `🛡 ×${bono}` : ''}${porCelda !== null ? ` · ⏱ ${textoEnTiempoReal(porCelda)}/celda` : ''}</small>
        ${tarifa ? `<span class="anillo-opcion-coste" title="Por celda de muro; puertas ×${datos?.factorPuerta ?? 4}, torres ×${datos?.factorTorre ?? 3}">${chipsDeCoste(a, tarifa, e)}</span>` : ''}
        ${bloqueada ? `<span class="anillo-opcion-pide">🔒 plaza nivel ${pide}</span>` : ''}
      </label>`;
    }).join('');
    trazar = `<div class="anillo-opciones" role="radiogroup" aria-label="Anillo que trazar">${opciones}</div>
      <div class="muralla-pie"><button id="btn-muralla-comprometer" class="muralla-trazar" type="button" data-cargo="${cargo}"${motivo || permitidos.length === 0 ? ` disabled title="${e(motivo || 'La plaza no llega a ningún anillo')}"` : ''}>🏗 ${recintos.length ? 'Ampliar con un anillo' : 'Trazar la muralla'}</button></div>`;
  }
  const info = ayuda('plaza:muralla', `Comprometer un anillo es gratis: la obra se paga celda a celda del almacén, al ritmo de la obra, y se para si falta material o tocaría la reserva. Cada anillo pide un nivel de plaza: empalizada ${NIVEL_DE_PLAZA_POR_ANILLO[0]}, muro de piedra ${NIVEL_DE_PLAZA_POR_ANILLO[1]}, muralla con adarve ${NIVEL_DE_PLAZA_POR_ANILLO[2]} (esta plaza rinde como nivel ${nivel}). Un anillo cerrado se mejora al siguiente material; uno a medias solo lo abandona el Gobernador.`);
  return `<div class="obra-titulo"><span class="faction-kicker">Muralla</span><span class="obra-chip" title="Anillos">${recintos.length} ${recintos.length === 1 ? 'anillo' : 'anillos'}</span>${info}</div>
    ${motivo ? `<p class="asent-lado-nota">${e(motivo)}</p>` : ''}
    ${anillos}
    <div class="obra-titulo"><span class="faction-kicker">${recintos.length ? 'Nuevo anillo' : 'Trazar un anillo'}</span></div>
    ${trazar}`;
}

function cablear(c: ContextoPlaza): void {
  const { cuerpo, ejecutar, asentamiento: a } = c;
  // `params` se evalúa al pulsar, no al cablear: la casilla elegida puede haber cambiado entre tanto.
  const lanzar = (boton: HTMLButtonElement, tipo: string, params: () => object): void => {
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const mensaje = await ejecutar(tipo, { asentamientoId: a.id, ...params() });
      boton.disabled = false;
      if (mensaje) mostrarAviso(mensaje, true);
    });
  };
  cuerpo.querySelectorAll<HTMLInputElement>('input[name="muralla-nivel"]').forEach((i) => i.addEventListener('change', () => { if (i.checked) nivelElegido = Number(i.value); }));
  const comprometer = cuerpo.querySelector<HTMLButtonElement>('#btn-muralla-comprometer');
  if (comprometer) lanzar(comprometer, 'comprometerRecinto', () => ({ cargo: comprometer.dataset.cargo, nivel: Number(cuerpo.querySelector<HTMLInputElement>('input[name="muralla-nivel"]:checked')?.value ?? nivelElegido) }));
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-mejorar-recinto]').forEach((b) => lanzar(b, 'mejorarRecinto', () => ({ cargo: b.dataset.cargo, recintoId: b.dataset.mejorarRecinto })));
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-abandonar-recinto]').forEach((b) => b.addEventListener('click', () => {
    void confirmar('El anillo se borra entero, celdas levantadas incluidas, y no se devuelve lo gastado.', { titulo: '¿Abandonar el anillo?', aceptar: 'Abandonar', peligro: true }).then(async (ok) => {
      if (!ok) return;
      b.disabled = true;
      const mensaje = await ejecutar('abandonarRecinto', { asentamientoId: a.id, recintoId: b.dataset.abandonarRecinto });
      b.disabled = false;
      if (mensaje) mostrarAviso(mensaje, true);
    });
  }));
}

/** Hasta que la plaza llega al nivel de la empalizada no hay muralla que gestionar (salvo recintos que ya tenga). */
const visible = (c: ContextoPlaza): boolean => (c.asentamiento.nivelActual ?? c.asentamiento.nivel) >= NIVEL_MINIMO_MURALLA || (c.asentamiento.recintos ?? []).length > 0;

export const SUBPESTANA_MURALLA: SubpestanaPlaza = { id: 'muralla', etiqueta: 'Muralla', html, cablear, visible };

/** Solo para el banco: el plano suelto. */
export const planoDeMuralla = (a: Asentamiento): string => plano(a.recintos ?? []);
