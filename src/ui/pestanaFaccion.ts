import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion } from '../tiposDominio';
import { htmlLiga, htmlTitulos, ligaDe } from '../sigilo/imperio';
import { CATALOGO_SIGILO, opciones, sigiloAleatorio, svgSigilo } from '../sigilo/sigilo';
import { estadoCliente } from './estadoCliente';
import { htmlAnexion } from './panelAnexion';
import { htmlFusion } from './panelFusion';
import { htmlAdmision } from './panelAdmision';

export function faccionDelJugador(proyeccion: ProyeccionJugador): Faccion | undefined {
  return proyeccion.facciones.find((faccion) => faccion.id === proyeccion.faccionId);
}

export function renderPestanaFaccion(
  proyeccion: ProyeccionJugador,
  escaparHtml: (valor: string) => string
): string {
  const faccion = faccionDelJugador(proyeccion);
  const vista = faccion ? 'detalle' : estadoCliente.modoPanelFaccion;

  if (faccion) {
    const liga = ligaDe(faccion.id, proyeccion.relaciones ?? []);
    const esGranRey = liga?.granReyId === faccion.id;
    const nombreDe = (id: string) => proyeccion.facciones.find((f) => f.id === id)?.nombre ?? id;
    return `
      <div class="faction-detail-header">
        <span class="faction-kicker">Tu facción${esGranRey ? ' · Gran Rey' : ''}</span>
        ${svgSigilo(faccion.sigilo, 64, { granRey: esGranRey })}
        <h2>${escaparHtml(faccion.nombre)}</h2>
        <span class="faction-id">${escaparHtml(faccion.id)}</span>
      </div>
      <div class="faction-stats">
        <div><span>Nivel</span><strong>${faccion.nivel}</strong></div>
        <div><span>Reputación</span><strong>${faccion.reputacion ?? 0}</strong></div>
        <div><span>Ciudadanos</span><strong>${faccion.ciudadanosIds?.length ?? 0}</strong></div>
      </div>
      <div class="faction-roles">
        <div><span>Rey</span><strong>${escaparHtml(faccion.reyId ?? 'Sin designar')}</strong></div>
        <div><span>Embajador</span><strong>${escaparHtml(faccion.embajadorId ?? 'Sin designar')}</strong></div>
      </div>
      ${faccion.reyId === proyeccion.heroeId && (faccion.solicitudesIds ?? []).length > 0
        ? `<div class="faction-list"><span class="faction-kicker">Piden entrar</span>${(faccion.solicitudesIds ?? [])
            .map((id) => `<div class="faction-list-item"><div><strong>${escaparHtml(id)}</strong></div><button class="btn-secondary" type="button" data-solicitud="${escaparHtml(id)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-solicitud="${escaparHtml(id)}" data-aceptar="no">Denegar</button></div>`)
            .join('')}</div>`
        : ''}
      ${htmlAnexion(proyeccion, faccion, escaparHtml)}
      ${htmlFusion(proyeccion, faccion, escaparHtml)}
      ${htmlAdmision(proyeccion, faccion)}
      <div class="faction-list">
        <span class="faction-kicker">Liga</span>
        ${liga
          ? `<div class="liga-fila">${htmlLiga(liga, proyeccion.facciones)}<div><strong>${liga.tieneVasallaje ? 'Por vasallaje' : 'Por alianza'}</strong><span>${liga.miembrosIds.map((id) => escaparHtml(nombreDe(id))).join(', ')}</span></div></div>`
          : '<p class="legend-note">No perteneces a ninguna Liga.</p>'}
      </div>
      <div class="faction-list">
        <span class="faction-kicker">Títulos del servidor</span>
        ${htmlTitulos(proyeccion.titulos ?? [], proyeccion.facciones, faccion.id, escaparHtml)}
      </div>
    `;
  }

  if (vista === 'inicio') {
    return `
      <div class="faction-empty-state">
        <span class="faction-kicker">Organización política</span>
        <h2>Elige tu facción</h2>
        <p>Crea una nueva o pide entrar en una existente: su Rey decide.</p>
        <div class="faction-choice-grid">
          <button id="btn-unirse-faccion" class="faction-choice" type="button"><span class="choice-icon">↗</span><strong>Pedir ingreso</strong><span>Explora las facciones del mundo.</span></button>
          <button id="btn-crear-faccion" class="faction-choice" type="button"><span class="choice-icon">✦</span><strong>Crear facción</strong><span>Funda una nueva casa política.</span></button>
        </div>
      </div>
    `;
  }

  if (vista === 'crear') {
    return `
      <div class="faction-form-view">
        <button class="back-button" id="btn-volver-faccion" type="button" aria-label="Volver a elegir facción">←</button>
        <span class="faction-kicker">Nueva identidad</span><h2>Crear facción</h2>
        <p>El nombre será visible para todos los jugadores.</p>
        <form id="form-crear-faccion" class="faction-form">
          <label for="input-nombre-faccion">Nombre de la facción</label>
          <input id="input-nombre-faccion" class="form-input" type="text" maxlength="60" required autocomplete="off" placeholder="Ej. Casa de Micenas" />
          ${renderSelectorSigilo()}
          <p id="error-faccion" class="faction-error" role="alert"></p>
          <button id="btn-submit-crear-faccion" class="btn-primary" type="submit">Crear facción</button>
        </form>
      </div>
    `;
  }

  return `
    <div class="faction-form-view faction-join-view">
      <button class="back-button" id="btn-volver-faccion" type="button" aria-label="Volver a elegir facción">←</button>
      <span class="faction-kicker">Facciones del mundo</span><h2>Pedir ingreso</h2>
      <input id="input-buscar-faccion" class="form-input" type="search" placeholder="Buscar por nombre..." autocomplete="off" />
      <div id="lista-facciones" class="faction-list"></div>
    </div>
  `;
}

const NOMBRE_COLOR = (id: string): string => CATALOGO_SIGILO.colores.find((c) => c.id === id)?.nombre ?? id;

/** Piezas del sigilo con vista previa. Se elige ahora y no se cambia nunca: avisa de ello. */
function renderSelectorSigilo(): string {
  const s = sigiloAleatorio();
  const colores = CATALOGO_SIGILO.colores.map((c) => c.id);
  const lista = (id: string, etiqueta: string, ids: readonly string[], elegido: string, nombre?: (id: string) => string): string =>
    `<label>${etiqueta} <select id="${id}" class="form-input">${opciones(ids, elegido, nombre)}</select></label>`;
  return `
    <fieldset class="sigilo-selector">
      <legend>Sigilo (no se podrá cambiar)</legend>
      <div id="sigilo-previa">${svgSigilo(s, 88)}</div>
      ${lista('sigilo-forma', 'Forma del escudo', CATALOGO_SIGILO.formas, s.formaId)}
      ${lista('sigilo-campo', 'Fondo', CATALOGO_SIGILO.campos, s.campoId)}
      ${lista('sigilo-color1', 'Color principal', colores, s.colorPrimarioId, NOMBRE_COLOR)}
      ${lista('sigilo-color2', 'Color secundario', colores, s.colorSecundarioId, NOMBRE_COLOR)}
      ${lista('sigilo-emblema', 'Emblema', CATALOGO_SIGILO.emblemas, s.emblemaId)}
      ${lista('sigilo-colorEmblema', 'Color del emblema', colores, s.colorEmblemaId, NOMBRE_COLOR)}
      ${lista('sigilo-orla', 'Orla', CATALOGO_SIGILO.orlas, s.orlaId)}
      ${lista('sigilo-colorOrla', 'Color de la orla', colores, s.colorOrlaId, NOMBRE_COLOR)}
      <small class="sigilo-creditos">Emblemas: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a> (CC BY 3.0) — Lorc, Delapouite, Caro Asercion, Cathelineau, Skoll y Willdabeast.</small>
    </fieldset>`;
}
