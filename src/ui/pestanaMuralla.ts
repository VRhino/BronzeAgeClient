// Pestaña "Muralla" del detalle de asentamiento — Consideraciones/Murallas_Definicion.md, Paso 6.
//
// Este cliente no importa el motor (a diferencia de `cliente/`, la herramienta de admin/dev): las cifras que
// dependen de reglas de juego (gate de nivel para comprometer) están copiadas A MANO, con su propio
// comentario — mismo criterio T2a ya documentado en `src/terreno/README.md` para el resto del cliente. Si
// `MURALLA.nivelMinimoConstruccion`/`nivelMaximo` (constants.ts, backend) cambian, esto hay que actualizarlo
// aparte; el servidor sigue siendo la autoridad real (un intento con nivel insuficiente se rechaza igual,
// esto solo evita mostrar un botón que fallaría siempre).
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, Recinto } from '../tiposDominio';

const NIVEL_MINIMO_MURALLA = 3;
const NIVEL_MAXIMO_MURALLA = 3;

function puertasDe(recinto: Recinto): number {
  return recinto.celdas.filter((c) => c.clase === 'puerta').length;
}

function integridadDe(recinto: Recinto): number {
  return recinto.celdas.length === 0 ? 0 : (recinto.avance + 1) / recinto.celdas.length;
}

function renderTarjetaRecinto(
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
      ? `mejorando a nivel ${recinto.mejorandoA} · obra ${recinto.avance + 1}/${recinto.celdas.length} (${pct}%)`
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
    .map((r, indice) => renderTarjetaRecinto(r, indice === recintos.length - 1, esGobernador, puedeComprometer, cargoParaComprometer, escaparHtml))
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
          <label for="select-muralla-nivel">Nivel del anillo</label>
          <select id="select-muralla-nivel">
            <option value="1">1 · Empalizada (madera)</option>
            <option value="2">2 · Muro de piedra</option>
            <option value="3">3 · Muralla con adarve</option>
          </select>
          <button id="btn-muralla-comprometer" class="btn-primary" data-cargo="${cargoParaComprometer}" type="button">${hayExterior ? 'Ampliar recinto' : 'Trazar y comprometer recinto'}</button>
          <p class="wall-note">Gratis al comprometer — la obra se paga celda a celda con los ticks. Exige nivel de asentamiento ${NIVEL_MINIMO_MURALLA} (nivel operativo actual: ${nivelOperativo}).</p>
        </div>`;

  return `
    <div class="wall-panel" data-asentamiento-id="${escaparHtml(asentamiento.id)}">
      ${listaOVacio}
      ${accionComprometer}
      <p id="wall-error" class="faction-error" role="alert"></p>
    </div>
  `;
}
