// Pestaña "Muralla" del detalle de asentamiento — Consideraciones/Murallas_Definicion.md, Paso 6.
//
// Este cliente no importa el motor (a diferencia de `cliente/`, la herramienta de admin/dev): las cifras que
// dependen de reglas de juego (gate de nivel para comprometer) están copiadas A MANO, con su propio
// comentario — mismo criterio T2a ya documentado en `src/terreno/README.md` para el resto del cliente. Si
// `MURALLA.nivelMinimoConstruccion`/`nivelMaximo` (constants.ts, backend) cambian, esto hay que actualizarlo
// aparte; el servidor sigue siendo la autoridad real (un intento con nivel insuficiente se rechaza igual,
// esto solo evita mostrar un botón que fallaría siempre).
import { bloqueDeDatos, catalogoDePoliticas, type ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, Recinto } from '../tiposDominio';
import { ayuda } from './ayuda';
import { barraDeTiempo, textoEnTiempoReal } from './estadoCliente';

/** Nivel de plaza que pide cada anillo (motor: `MURALLA.nivelDePlaza`, Murallas.md): empalizada 2, muro de piedra 3, adarve 4. */
const NIVEL_DE_PLAZA_POR_ANILLO = [2, 3, 4];
export const NIVEL_MINIMO_MURALLA = NIVEL_DE_PLAZA_POR_ANILLO[0]!;
const NIVEL_MAXIMO_MURALLA = 3;

function puertasDe(recinto: Recinto): number {
  return recinto.celdas.filter((c) => c.clase === 'puerta').length;
}

function integridadDe(recinto: Recinto): number {
  return recinto.celdas.length === 0 ? 0 : (recinto.avance + 1) / recinto.celdas.length;
}

/** Lo que tarda cada celda en ms de mundo (`MURALLA.minutosPorCelda[nivel]` × `factorTiempoMuralla` de las políticas activas); `null` sin datos. */
function msPorCelda(a: Asentamiento, nivel: number): number | null {
  const minutos = bloqueDeDatos<{ minutosPorCelda?: Record<string, number> }>('MURALLA')?.minutosPorCelda?.[String(nivel)];
  if (minutos === undefined) return null;
  const politicas = catalogoDePoliticas()?.catalogo ?? [];
  const factor = (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.factorTiempoMuralla; return typeof v === 'number' ? t * v : t; }, 1);
  return minutos * factor * 60_000;
}

/** La obra de un anillo (o su mejora): la celda que se está levantando como barra, y lo que tarda el anillo entero y lo que le queda. */
function tiempoDeObra(recinto: Recinto, a: Asentamiento, ahora: number): string {
  const mejora = recinto.mejorandoA !== undefined;
  const hechas = mejora ? recinto.mejoradas ?? 0 : recinto.avance + 1;
  const quedan = recinto.celdas.length - hechas;
  if (quedan <= 0) return '';
  const porCelda = msPorCelda(a, mejora ? recinto.mejorandoA! : recinto.nivel);
  if (porCelda === null) return '';
  const siguiente = recinto.siguienteCeldaEn;
  // La celda en curso acaba en `siguienteCeldaEn`; sin cita (faltan materiales o la reserva no deja), espera al paso de minuto.
  const celda = siguiente !== undefined && siguiente > ahora
    ? barraDeTiempo(`Celda ${hechas + 1} de ${recinto.celdas.length}`, siguiente - porCelda, siguiente, ahora)
    : '<p class="wall-note">Celda parada: falta material en el almacén o tocaría la reserva. Sigue sola en cuanto lo haya.</p>';
  const resto = (siguiente !== undefined && siguiente > ahora ? siguiente - ahora : porCelda) + Math.max(0, quedan - 1) * porCelda;
  return `${celda}<span class="wall-recinto-tiempo">Anillo entero: ${textoEnTiempoReal(recinto.celdas.length * porCelda)} · quedan ${textoEnTiempoReal(resto)} (${textoEnTiempoReal(porCelda)} por celda)</span>`;
}

function renderTarjetaRecinto(
  a: Asentamiento,
  ahora: number,
  recinto: Recinto,
  esExterior: boolean,
  esGobernador: boolean,
  puedeComprometer: boolean,
  cargoParaComprometer: 'gobernador' | 'maestroObras',
  escaparHtml: (valor: string) => string
): string {
  const integridad = integridadDe(recinto);
  const completo = integridad >= 1;
  const puertas = puertasDe(recinto);
  const pct = Math.round(integridad * 100);
  const estadoTexto =
    recinto.mejorandoA !== undefined
      ? `mejorando a nivel ${recinto.mejorandoA} · ${recinto.mejoradas ?? 0}/${recinto.celdas.length} celdas mejoradas`
      : completo
        ? 'completo'
        : `en obra ${recinto.avance + 1}/${recinto.celdas.length} (${pct}%)`;

  const acciones: string[] = [];
  // Abandonar es solo del Gobernador (§8 del doc: decisión de gobierno, no de obra) y solo sobre un recinto
  // incompleto — uno terminado no se puede abandonar, en Fase 0 no hay demolición.
  if (!completo && esGobernador) {
    acciones.push(`<button class="btn-secondary" data-abandonar-recinto="${escaparHtml(recinto.id)}" type="button">Abandonar</button>`);
  }
  // Mejorar exige el recinto completo y sin otra mejora ya en curso (§7).
  if (completo && recinto.mejorandoA === undefined && recinto.nivel < NIVEL_MAXIMO_MURALLA && puedeComprometer) {
    acciones.push(
      `<button class="btn-secondary" data-mejorar-recinto="${escaparHtml(recinto.id)}" data-cargo="${cargoParaComprometer}" type="button">Mejorar a nivel ${recinto.nivel + 1}</button>`
    );
  }

  return `
    <div class="wall-recinto-card">
      <div class="wall-recinto-heading">
        <strong>${esExterior ? 'Recinto exterior' : 'Recinto interior'} · nivel ${recinto.nivel}</strong>
        <span>${puertas} puerta${puertas === 1 ? '' : 's'} · ${recinto.celdas.length} celdas</span>
      </div>
      <span class="wall-recinto-estado">${escaparHtml(estadoTexto)}</span>
      ${tiempoDeObra(recinto, a, ahora)}
      ${acciones.length > 0 ? `<div class="wall-recinto-acciones">${acciones.join('')}</div>` : ''}
    </div>
  `;
}

export function renderPestanaMuralla(asentamiento: Asentamiento, proyeccion: ProyeccionJugador, escaparHtml: (valor: string) => string): string {
  const cargos = asentamiento.cargos ?? {};
  const heroeId = proyeccion.heroeId;
  const esGobernador = !!heroeId && cargos.gobernadorId === heroeId;
  const esMaestroObras = !!heroeId && cargos.maestroObrasId === heroeId;
  // Comprometer admite Gobernador O Maestro de Obras (§8: es una decisión de obra); abandonar es solo del
  // Gobernador (decisión de gobierno) — ver `renderTarjetaRecinto`. Cuando valen los dos, se prefiere
  // gobernador — da igual cuál se mande, el servidor solo exige que el jugador SEA ese cargo.
  const puedeComprometer = esGobernador || esMaestroObras;
  const cargoParaComprometer = esGobernador ? 'gobernador' : 'maestroObras';

  const nivelOperativo = asentamiento.nivelActual ?? asentamiento.nivel;
  const recintos = asentamiento.recintos ?? [];
  const hayRecintoEnObra = recintos.some((r) => r.avance < r.celdas.length - 1);
  const hayExterior = recintos.length > 0;

  const tarjetas = recintos
    .map((r, indice) => renderTarjetaRecinto(asentamiento, proyeccion.instante, r, indice === recintos.length - 1, esGobernador, puedeComprometer, cargoParaComprometer, escaparHtml))
    .join('');

  const listaOVacio =
    recintos.length > 0
      ? `<div class="wall-recinto-list">${tarjetas}</div>`
      : '<p class="settlement-detail-copy">Este asentamiento no tiene ningún recinto amurallado todavía.</p>';

  // Comprometer sirve para las dos cosas: el primer recinto (no hay ninguno) o una ampliación (ya hay uno
  // completo) — es la MISMA acción de motor (`comprometerRecinto`) en los dos casos; el servidor decide si la
  // ampliación cumple su gate propio (recinto exterior completo + arrabalMinimo, §10). Aquí solo se etiqueta
  // distinto para que el botón diga lo que de verdad va a pasar.
  const accionComprometer = !puedeComprometer
    ? '<p class="wall-note">Necesitas ser Gobernador o Maestro de Obras de este asentamiento para gestionar su muralla.</p>'
    : hayRecintoEnObra
      ? '<p class="wall-note">Ya hay un recinto en obra — hay que terminarlo o abandonarlo antes de trazar otro.</p>'
      : `<div class="wall-action">
          <label for="select-muralla-nivel">Nivel del anillo</label>${ayuda('plaza:muralla', `Gratis al comprometer — la obra se paga celda a celda con los ticks. Cada anillo pide un nivel de plaza: empalizada ${NIVEL_DE_PLAZA_POR_ANILLO[0]}, muro de piedra ${NIVEL_DE_PLAZA_POR_ANILLO[1]}, muralla con adarve ${NIVEL_DE_PLAZA_POR_ANILLO[2]} (nivel operativo actual: ${nivelOperativo}).`)}
          <select id="select-muralla-nivel">
            ${['Empalizada (madera)', 'Muro de piedra', 'Muralla con adarve'].map((nombre, i) => {
              const pide = NIVEL_DE_PLAZA_POR_ANILLO[i]!;
              return `<option value="${i + 1}"${nivelOperativo < pide ? ' disabled' : ''}>${i + 1} · ${nombre}${nivelOperativo < pide ? ` (plaza de nivel ${pide})` : ''}</option>`;
            }).join('')}
          </select>
          <button id="btn-muralla-comprometer" class="btn-primary" data-cargo="${cargoParaComprometer}" type="button">${hayExterior ? 'Ampliar recinto' : 'Trazar y comprometer recinto'}</button>        </div>`;

  return `
    <div class="wall-panel" data-asentamiento-id="${escaparHtml(asentamiento.id)}">
      ${listaOVacio}
      ${accionComprometer}
      <p id="wall-error" class="faction-error" role="alert"></p>
    </div>
  `;
}
