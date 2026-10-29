import type { ProyeccionJugador } from '../apiCliente';
import type { Faccion, Sigilo } from '../tiposDominio';
import { htmlLiga, htmlTitulos, ligaDe } from '../sigilo/imperio';
import { CATALOGO_SIGILO, opciones, sigiloAleatorio, svgSigilo } from '../sigilo/sigilo';
import { ayuda } from './ayuda';
import { estadoCliente } from './estadoCliente';
import { nombreDeHeroe } from './nombres';
import { htmlAnexion } from './panelAnexion';
import { htmlFusion } from './panelFusion';
import { htmlAdmision } from './panelAdmision';
import { htmlCargos, htmlDejarFaccion } from './panelCargos';
import { htmlDiplomacia } from './panelDiplomacia';

/** «Nombre del Rey (Facción)» del Gran Rey de una Liga: el Gran Rey es la Facción señora, y quien la manda es su Rey. */
function granRey(p: ProyeccionJugador, faccionId: string): string {
  const f = p.facciones.find((x) => x.id === faccionId);
  return f?.reyId ? `${nombreDeHeroe(p, f.reyId)} (${f.nombre})` : (f?.nombre ?? faccionId);
}

export function faccionDelJugador(proyeccion: ProyeccionJugador): Faccion | undefined {
  return proyeccion.facciones.find((faccion) => faccion.id === proyeccion.faccionId);
}

/** Las pestañas de la pantalla de Facción (a pantalla completa). Tablón y Misiones las rellena `main.ts`, que es quien las cablea. */
export const PESTANAS_FACCION = [
  ['miembros', 'Miembros'],
  ['plazas', 'Plazas'],
  ['tablon', 'Tablón'],
  ['misiones', 'Misiones'],
  ['diplomacia', 'Diplomacia'],
  ['facciones', 'Facciones'],
  ['ajustes', 'Ajustes del Rey'],
] as const;
/** `resumen` ya no es pestaña: lo suyo va en el panel de la izquierda; queda para los paneles sueltos (`panelInteraccion`). */
export type PestanaFaccion = (typeof PESTANAS_FACCION)[number][0] | 'resumen';

/** Las plazas que el cliente conoce, con su Facción: las que tiene dentro, las que ve y las que recuerda (lo visto ahora gana a lo recordado).
 * El motor no publica cuántas plazas tiene cada Facción: de las ajenas solo se cuentan las que conoces. */
function plazasConocidas(p: ProyeccionJugador): Map<string, { faccionId: string; nombre: string }> {
  const plazas = new Map<string, { faccionId: string; nombre: string }>();
  for (const a of p.asentamientosConocidos) plazas.set(a.asentamientoId, { faccionId: a.faccionId, nombre: a.nombre ?? '' });
  for (const a of p.asentamientos) plazas.set(a.id, { faccionId: a.faccionId, nombre: a.nombre ?? '' });
  for (const a of p.asentamientosAvistados) plazas.set(a.id, { faccionId: a.faccionId, nombre: a.nombre ?? '' });
  return plazas;
}

function plazasDe(p: ProyeccionJugador, faccionId: string): number {
  return [...plazasConocidas(p).values()].filter((x) => x.faccionId === faccionId).length;
}

/** Lo de tu Facción que se ve siempre: nivel, reputación y ciudadanos, Rey y Embajador, si piden entrar y la Liga. */
function htmlResumenFaccion(p: ProyeccionJugador, faccion: Faccion, e: (valor: string) => string): string {
  const liga = ligaDe(faccion.id, p.relaciones ?? []);
  const nombreDe = (id: string) => p.facciones.find((f) => f.id === id)?.nombre ?? id;
  const piden = faccion.reyId === p.heroeId && (faccion.solicitudesIds ?? []).length > 0;
  return `<div class="faction-stats">
        <div><span>Nivel</span><strong>${faccion.nivel}</strong></div>
        <div><span>Reputación</span><strong>${faccion.reputacion ?? 0}</strong></div>
        <div><span>Ciudadanos</span><strong>${faccion.ciudadanosIds?.length ?? 0}</strong></div>
      </div>
      <div class="faction-roles">
        <div><span>Rey</span><strong>${e(faccion.reyId ? nombreDeHeroe(p, faccion.reyId) : 'Sin designar')}</strong></div>
        <div><span>Embajador</span><strong>${e(faccion.embajadorId ? nombreDeHeroe(p, faccion.embajadorId) : 'Sin designar')}</strong></div>
      </div>
      ${piden ? '<p class="asent-lado-nota">Hay héroes que piden entrar: contéstales en Miembros.</p>' : ''}
      <div class="faction-list">
        <span class="faction-kicker">Liga</span>
        ${liga ? `<div class="liga-fila">${htmlLiga(liga, p.facciones)}<div><strong>${liga.tieneVasallaje ? 'Por vasallaje' : 'Por alianza'}</strong><span>${liga.miembrosIds.map((id) => e(nombreDe(id))).join(', ')}</span></div></div>` : '<p class="legend-note">No perteneces a ninguna Liga.</p>'}
      </div>`;
}

/** El panel fijo de la izquierda de la ventana de Facción: el escudo grande, el nombre, el resumen y, abajo, las plazas, los títulos y Dejar la Facción. */
export function htmlLateralFaccion(proyeccion: ProyeccionJugador, e: (valor: string) => string): string {
  const faccion = faccionDelJugador(proyeccion);
  if (!faccion) return '';
  const esGranRey = ligaDe(faccion.id, proyeccion.relaciones ?? [])?.granReyId === faccion.id;
  return `<aside class="faccion-lateral">
    <div class="faccion-lateral-escudo">${svgSigilo(faccion.sigilo, 168, { granRey: esGranRey })}</div>
    <h2 class="faccion-lateral-nombre">${e(faccion.nombre)}</h2>
    <span class="faction-kicker">Tu facción${esGranRey ? ' · Gran Rey' : ''}</span>
    <div class="faccion-lateral-resumen">${htmlResumenFaccion(proyeccion, faccion, e)}</div>
    <div class="faccion-lateral-pie">
      <div class="faccion-lateral-dato"><span>Plazas</span><strong>${plazasDe(proyeccion, faccion.id)}</strong></div>
      <div class="faction-list"><span class="faction-kicker">Títulos del servidor</span>
        ${htmlTitulos(proyeccion.titulos ?? [], proyeccion.facciones, faccion.id, e)}</div>
      ${htmlDejarFaccion(proyeccion, faccion)}
    </div>
  </aside>`;
}

/** La pestaña Plazas: las de tu Facción que conoce el cliente, con su nivel, si es la capital, cuántos ciudadanos residen y «Ver» en el mapa. */
function htmlPlazasFaccion(p: ProyeccionJugador, faccion: Faccion, e: (valor: string) => string): string {
  const plazas = new Map<string, { nombre: string; nivel: number; posicion: { x: number; y: number }; recordada: boolean }>();
  for (const a of p.asentamientosConocidos) if (a.faccionId === faccion.id) plazas.set(a.asentamientoId, { nombre: a.nombre ?? a.asentamientoId, nivel: a.nivel, posicion: a.posicion, recordada: true });
  for (const a of p.asentamientosAvistados) if (a.faccionId === faccion.id) plazas.set(a.id, { nombre: a.nombre ?? a.id, nivel: a.nivel, posicion: a.posicion, recordada: false });
  for (const a of p.asentamientos) if (a.faccionId === faccion.id && !plazas.has(a.id)) plazas.set(a.id, { nombre: a.nombre ?? a.id, nivel: a.nivel, posicion: a.posicion, recordada: false });
  if (plazas.size === 0) return '<p class="mapa-lista-vacia">Tu Facción aún no tiene plazas.</p>';
  const capitalId = faccion.capitalId ?? p.tecnologia?.capitalId ?? undefined;
  const residentes = (id: string) => (faccion.miembros ?? []).filter((m) => m.residenciaId === id).length;
  const lista = [...plazas.entries()].sort(([ia, a], [ib, b]) => Number(ib === capitalId) - Number(ia === capitalId) || b.nivel - a.nivel || a.nombre.localeCompare(b.nombre));
  return `<div class="faction-list faction-list-libre"><span class="faction-kicker">Plazas de tu Facción (${plazas.size})</span>
    ${lista.map(([id, a]) => `<div class="faccion-plaza${id === capitalId ? ' capital' : ''}">
      <div class="faccion-plaza-info"><strong>${e(a.nombre)}${id === capitalId ? ' <span class="faccion-publica-relacion">Capital</span>' : ''}</strong>
        <span>Nivel ${a.nivel} · (${Math.round(a.posicion.x)}, ${Math.round(a.posicion.y)})${a.recordada ? ' · recordada' : ''}</span></div>
      <div class="faccion-publica-cifras"><div><strong>${residentes(id)}</strong><span>Residentes</span></div></div>
      <button class="btn-secondary" type="button" data-centrar-x="${a.posicion.x}" data-centrar-y="${a.posicion.y}">Ver en el mapa</button>
    </div>`).join('')}</div>`;
}

const RELACION: Record<string, string> = { alianza: 'Aliada', guerra: 'En guerra', vasallaje: 'Vasallaje' };

/** Qué es esa Facción para la tuya, por las relaciones activas: aliada, en guerra, tu señora o tu vasalla. */
function relacionCon(p: ProyeccionJugador, propiaId: string | null, otraId: string): string {
  if (!propiaId || propiaId === otraId) return '';
  const r = (p.relaciones ?? []).find((x) => x.estado === 'activa'
    && ((x.faccionAId === propiaId && x.faccionBId === otraId) || (x.faccionAId === otraId && x.faccionBId === propiaId)));
  if (!r) return '';
  if (r.tipo === 'vasallaje') return r.faccionAId === propiaId ? 'Tu vasalla' : 'Tu señora';
  return RELACION[r.tipo] ?? r.tipo;
}

/** ¿Hay contacto con esa Facción? Es la tuya, está en tu Liga, tenéis una relación activa (alianza, guerra o vasallaje) o conoces alguna de sus
 * plazas en el mapa (vista o recordada). El motor manda la forma pública de todas; sin contacto, el cliente solo enseña el nombre. */
function hayContacto(p: ProyeccionJugador, f: Faccion, plazas: Map<string, { faccionId: string }>): boolean {
  const propiaId = p.faccionId;
  if (propiaId && (f.id === propiaId || f.liga?.miembrosIds.includes(propiaId) || relacionCon(p, propiaId, f.id))) return true;
  return [...plazas.values()].some((x) => x.faccionId === f.id);
}

/** La lista de Facciones, híbrida: las conocidas con su escudo, lo público y, a la derecha del todo, miembros y plazas; las demás, solo el nombre.
 * La usan la pestaña Facciones y «Pedir ingreso» (que filtra por `termino` y pone en cada fila el botón de `accion`). */
export function htmlListaFacciones(p: ProyeccionJugador, e: (valor: string) => string, opciones: { termino?: string; accion?: (f: Faccion) => string } = {}): string {
  const plazas = plazasConocidas(p);
  const nombreDe = (id: string) => p.facciones.find((f) => f.id === id)?.nombre ?? id;
  const termino = (opciones.termino ?? '').trim().toLowerCase();
  const accion = opciones.accion ?? (() => '');
  const lista = p.facciones.filter((f) => f.nombre.toLowerCase().includes(termino)).sort((a, b) => Number(a.derrotadaPor !== undefined) - Number(b.derrotadaPor !== undefined)
    || (b.ciudadanosIds?.length ?? 0) - (a.ciudadanosIds?.length ?? 0) || a.nombre.localeCompare(b.nombre));
  if (lista.length === 0) return `<p class="mapa-lista-vacia">${termino ? 'No hay facciones que coincidan.' : 'Aún no hay Facciones en el mundo.'}</p>`;
  const conocidas = lista.filter((f) => hayContacto(p, f, plazas));
  const lejanas = lista.filter((f) => !conocidas.includes(f));
  const fila = (f: Faccion): string => {
    const propia = f.id === p.faccionId;
    const relacion = relacionCon(p, p.faccionId, f.id);
    const capital = f.capitalId ? plazas.get(f.capitalId)?.nombre : undefined;
    const derrota = f.derrotadaPor === undefined ? '' : f.derrotadaPor ? `Derrotada por ${nombreDe(f.derrotadaPor)}` : 'Desaparecida';
    const liga = f.liga ? `Liga ${f.liga.tieneVasallaje ? 'por vasallaje' : 'por alianza'}${f.liga.granReyId === f.id ? ' · Gran Rey' : f.liga.granReyId ? ` de ${nombreDe(f.liga.granReyId)}` : ''}` : '';
    const datos = [
      `Nivel ${f.nivel}`,
      `Reputación ${Math.round(f.reputacion ?? 0)}`,
      `Rey: ${f.reyId ? nombreDeHeroe(p, f.reyId) : 'sin designar'}`,
      f.embajadorId ? `Embajador: ${nombreDeHeroe(p, f.embajadorId)}` : '',
      capital ? `Capital: ${capital}` : '',
      liga,
      f.admiteOtrasEnAtaques ? 'Admite a otras Facciones en sus ataques' : '',
    ].filter(Boolean);
    return `<div class="faccion-publica${propia ? ' propia' : ''}${derrota ? ' derrotada' : ''}">
      <div class="faccion-publica-escudo">${svgSigilo(f.sigilo, 56, { granRey: f.liga?.granReyId === f.id })}</div>
      <div class="faccion-publica-info">
        <strong>${e(f.nombre)}${propia ? ' <small>· la tuya</small>' : ''}${relacion ? ` <span class="faccion-publica-relacion rel-${e(relacion === 'En guerra' ? 'guerra' : 'paz')}">${e(relacion)}</span>` : ''}${derrota ? ` <span class="faccion-publica-relacion rel-derrota">${e(derrota)}</span>` : ''}</strong>
        <span>${datos.map(e).join(' · ')}</span>
      </div>
      <div class="faccion-publica-cifras">
        <div><strong>${f.ciudadanosIds?.length ?? 0}</strong><span>Miembros</span></div>
        <div><strong>${[...plazas.values()].filter((x) => x.faccionId === f.id).length}</strong><span>Plazas</span></div>
      </div>
      ${accion(f)}
    </div>`;
  };
  const sencilla = (f: Faccion): string => `<div class="faccion-lejana"><span>${e(f.nombre)}</span>${accion(f)}</div>`;
  return `<div class="faction-list faction-list-libre"><span class="faction-kicker">Conocidas (${conocidas.length})${ayuda('faccion:lista', 'Con contacto: la tuya, las de tu Liga, con las que tienes relación y aquellas de las que conoces alguna plaza en el mapa. Las plazas son las que conoces, no todas las que tienen.')}</span>
    ${conocidas.length ? conocidas.map(fila).join('') : '<p class="legend-note">Aún no has tenido contacto con ninguna.</p>'}</div>
    ${lejanas.length ? `<div class="faction-list faction-list-libre"><span class="faction-kicker">Sin contacto (${lejanas.length})</span><div class="faccion-lejanas">${lejanas.map(sencilla).join('')}</div></div>` : ''}`;
}

/** `conLateral`: va con el panel fijo de la izquierda, que ya lleva el escudo, el nombre y Dejar la Facción.
 * `pestana`: qué parte de tu Facción se pinta (sin Facción, la elección de crear o pedir ingreso, sin pestañas). `miembros` es la lista con la
 * participación (`htmlMiembrosFaccion`), que se pinta en Miembros. */
export function renderPestanaFaccion(
  proyeccion: ProyeccionJugador,
  escaparHtml: (valor: string) => string,
  pestana: PestanaFaccion = 'resumen',
  miembros = '',
  conLateral = false
): string {
  const faccion = faccionDelJugador(proyeccion);
  // Con Facción pero sin su ficha todavía: nunca las opciones de quien no la tiene (crear o pedir ingreso).
  if (!faccion && proyeccion.faccionId) return '<p class="faction-empty-list">Cargando tu Facción…</p>';
  const vista = faccion ? 'detalle' : estadoCliente.modoPanelFaccion;

  if (faccion) {
    const liga = ligaDe(faccion.id, proyeccion.relaciones ?? []);
    const esGranRey = liga?.granReyId === faccion.id;
    const nombreDe = (id: string) => proyeccion.facciones.find((f) => f.id === id)?.nombre ?? id;
    const solicitudes = faccion.reyId === proyeccion.heroeId && (faccion.solicitudesIds ?? []).length > 0
      ? `<div class="faction-list"><span class="faction-kicker">Piden entrar</span>${(faccion.solicitudesIds ?? [])
          .map((id) => `<div class="faction-list-item"><div><strong>${escaparHtml(nombreDeHeroe(proyeccion, id))}</strong></div><button class="btn-secondary" type="button" data-solicitud="${escaparHtml(id)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-solicitud="${escaparHtml(id)}" data-aceptar="no">Denegar</button></div>`)
          .join('')}</div>`
      : '';
    if (pestana === 'facciones') return htmlListaFacciones(proyeccion, escaparHtml);
    if (pestana === 'plazas') return htmlPlazasFaccion(proyeccion, faccion, escaparHtml);
    if (pestana === 'miembros') return `${solicitudes}${htmlCargos(proyeccion, faccion, escaparHtml)}${miembros}`;
    if (pestana === 'diplomacia') {
      return `${htmlDiplomacia(proyeccion, faccion, escaparHtml)}
      ${htmlAnexion(proyeccion, faccion, escaparHtml)}
      ${htmlFusion(proyeccion, faccion, escaparHtml)}
      <div class="faction-list">
        <span class="faction-kicker">Liga</span>
        ${liga
          ? `<div class="liga-fila">${htmlLiga(liga, proyeccion.facciones)}<div><strong>${liga.tieneVasallaje ? 'Por vasallaje' : 'Por alianza'}</strong><span>${liga.miembrosIds.map((id) => escaparHtml(nombreDe(id))).join(', ')}</span>${liga.granReyId ? `<span>Gran Rey: ${escaparHtml(granRey(proyeccion, liga.granReyId))}</span>` : ''}</div></div>`
          : '<p class="legend-note">No perteneces a ninguna Liga.</p>'}
      </div>`;
    }
    if (pestana === 'ajustes') {
      const soyRey = faccion.reyId === proyeccion.heroeId;
      return `${soyRey ? '' : '<p class="asent-lado-nota">Estos ajustes los cambia el Rey; aquí ves cómo están.</p>'}${htmlAdmision(proyeccion, faccion)}${conLateral ? '' : htmlDejarFaccion(proyeccion, faccion)}`;
    }
    // Con el panel de la izquierda (`htmlLateralFaccion`), el escudo y el nombre van allí; en los paneles sueltos, arriba.
    const cabecera = conLateral ? '' : `<div class="faction-detail-header">
        <span class="faction-kicker">Tu facción${esGranRey ? ' · Gran Rey' : ''}</span>
        ${svgSigilo(faccion.sigilo, 64, { granRey: esGranRey })}
        <h2>${escaparHtml(faccion.nombre)}</h2>
        <span class="faction-id">${escaparHtml(faccion.id)}</span>
      </div>`;
    return `${cabecera}
      ${htmlResumenFaccion(proyeccion, faccion, escaparHtml)}
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
        <h2>Elige tu facción${ayuda('faccion:elegir', 'Crea una nueva o pide entrar en una existente: su Rey decide.')}</h2>
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
        <span class="faction-kicker">Nueva identidad</span><h2>Crear facción${ayuda('faccion:crear', 'El nombre será visible para todos los jugadores.')}</h2>
        <form id="form-crear-faccion" class="faction-form">
          <label for="input-nombre-faccion">Nombre de la facción</label>
          <input id="input-nombre-faccion" class="form-input" type="text" maxlength="60" required autocomplete="off" placeholder="Ej. Casa de Micenas" />
          ${renderSelectorSigilo()}
          <div id="error-faccion" class="faction-error" role="alert"></div>
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

/** El sigilo con el que arranca el selector: al azar UNA vez y el mismo en cada repintado. Antes salía uno nuevo en cada pintado, así que el HTML
 * del panel cambiaba en cada refresco y el panel se repintaba entero, llevándose el nombre y el escudo que se estaban eligiendo. */
let sigiloPropuesto: Sigilo | null = null;

/** Piezas del sigilo con vista previa. Se elige ahora y no se cambia nunca: avisa de ello. */
function renderSelectorSigilo(): string {
  const s = (sigiloPropuesto ??= sigiloAleatorio());
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
      <small class="sigilo-creditos">Créditos${ayuda('faccion:creditos', 'Emblemas: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a> (CC BY 3.0) — Lorc, Delapouite, Caro Asercion, Cathelineau, Skoll y Willdabeast.')}</small>
    </fieldset>`;
}
