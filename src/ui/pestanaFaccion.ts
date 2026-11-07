import { bloqueDeDatos, type ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, Faccion, Sigilo } from '../tiposDominio';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { grupo, htmlEstadoPie, htmlPoblacionPie, pieza } from './hudPlaza';
import { iconoEdificio } from './iconosEdificio';
import { iconoTropa } from './iconosTropa';
import { ahora, barraAvance, cuentaAtras, miles } from './juegoVisual';
import { avanceDeObra } from './panelObras';
import { nombreDeTropa } from './ejercitos';
import { fichaRecurso, recursosDelAlmacen } from './vistaCiudad';
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
  ['ejercitos', 'Ejércitos'],
  ['tecnologia', 'Tecnología'],
  ['tablon', 'Tablón'],
  ['misiones', 'Misiones'],
  ['mercenarios', 'Mercenarios'],
  ['diplomacia', 'Diplomacia'],
  ['ajustes', 'Ajustes del Rey'],
] as const;
/** `resumen` ya no es pestaña: lo suyo va en el panel de la izquierda; queda para los paneles sueltos (`panelInteraccion`). */
export type PestanaFaccion = (typeof PESTANAS_FACCION)[number][0] | 'resumen';

/** La Facción abierta en el centro de la pestaña Diplomacia; `null` = la tuya. Se recuerda mientras dura la sesión. */
let faccionElegida: string | null = null;
export function elegirFaccion(id: string | null): void { faccionElegida = id; }

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

/** El cap y los cupos de plazas en el resumen (Víctor, 2026-11-04; motor 95e8eaa4): «Plazas 2 + 0 caravanas de 4» y, de nivel 2 a 5, las que lo
 * ocupan (en ese nivel o subiendo a él) frente a las que caben a la vez. Las cifras vienen de la Facción propia; debajo, lo que abre su nivel siguiente
 * (curvas de /v1/datos). Sin esos datos (motor viejo), solo el número de plazas. */
function htmlCuposFaccion(p: ProyeccionJugador, faccion: Faccion, e: (valor: string) => string): string {
  const cap = faccion.capFundacion;
  const cupos = faccion.cuposDeNivel ?? [];
  if (!cap && !cupos.length) return `<div class="faccion-lateral-dato"><span>Plazas</span><strong>${plazasDe(p, faccion.id)}</strong></div>`;
  // Una sola fila de cinco casillas (Víctor, 2026-11-07): Plazas y los niveles 2 a 5, cada una con su «usadas/tope» y una raya de lo lleno debajo.
  const casilla = (icono: string, nombre: string, usado: number, tope: number, nota: string): string => {
    const pct = tope ? Math.min(100, (usado / tope) * 100) : 0;
    return `<div class="faccion-cupo${usado >= tope ? ' lleno' : ''}${tope === 0 ? ' cerrado' : ''}" title="${e(`${nombre}: ${nota}`)}"><span class="faccion-cupo-nombre" aria-label="${e(nombre)}">${icono}</span>
      <strong>${usado}<small>/${tope}</small></strong><span class="faccion-cupo-barra"><i style="width:${pct.toFixed(1)}%"></i></span></div>`;
  };
  const curvas = bloqueDeDatos<Record<string, number[]>>('CUPO_NIVEL_ASENTAMIENTO');
  const capTabla = bloqueDeDatos<number[]>('CAP_FUNDACION_POR_NIVEL');
  const de = (tabla: readonly number[] | undefined, nivel: number): number | undefined => (tabla?.length ? tabla[Math.min(tabla.length, Math.max(1, nivel)) - 1] : undefined);
  const n = faccion.nivel + 1;
  const abre = [
    cap && capTabla && n <= capTabla.length && de(capTabla, n) !== cap.cap ? `${de(capTabla, n)} plazas` : '',
    ...cupos.map((c) => { const t = curvas?.[`maxNivel${c.nivel}`]; const v = t && n <= t.length ? de(t, n) : undefined; return v !== undefined && v !== c.cupo ? `${v} de nivel ${c.nivel}` : ''; }),
  ].filter(Boolean);
  return `<div class="faccion-cupos"><span class="faction-kicker">Plazas · nivel ${faccion.nivel} de Facción${ayuda('faccion:cupos', 'Cuántas plazas puede tener tu Facción (🏛; las Caravanas de Fundación vivas cuentan: no se lanza otra si plazas más caravanas llegan al tope) y cuántas pueden estar a la vez en cada nivel (② a ⑤): ocupan el cupo las de ese nivel y las que suben a él. Sin cupo libre no se pide la subida ni recupera ese nivel una plaza degradada. Todo crece con el nivel de la Facción.')}</span>
      <div class="faccion-cupos-fila">
      ${cap ? casilla('🏛', 'Plazas', cap.plazas + cap.caravanas, cap.cap, `${cap.plazas} plaza(s)${cap.caravanas ? ` y ${cap.caravanas} Caravana(s) de Fundación` : ''} de ${cap.cap} que permite el nivel ${faccion.nivel}`) : ''}
      ${cupos.map((c) => casilla(['', '', '②', '③', '④', '⑤'][c.nivel] ?? '·', `Nivel ${c.nivel}`, c.ocupadas, c.cupo, c.cupo === 0 ? `tu Facción aún no puede tener plazas de nivel ${c.nivel}` : `plazas de nivel ${c.nivel} o subiendo a él`)).join('')}
      </div>
      ${abre.length ? `<p class="legend-note">Con la Facción en nivel ${n}: ${abre.join(', ')}.</p>` : ''}
    </div>`;
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

/** La experiencia de la Facción hacia el nivel siguiente, con su barra: los umbrales acumulados de `NIVEL_FACCION.xpParaNivel` (datos del motor). */
function htmlExperienciaFaccion(faccion: Faccion): string {
  const reglas = bloqueDeDatos<{ nivelMaximo?: number; xpParaNivel?: number[] }>('NIVEL_FACCION');
  const umbrales = reglas?.xpParaNivel;
  if (!umbrales?.length || faccion.experiencia === undefined) return '';
  const xp = faccion.experiencia;
  const maximo = reglas?.nivelMaximo ?? umbrales.length + 1;
  const n = (v: number) => Math.floor(v).toLocaleString('es-ES');
  if (faccion.nivel >= maximo) {
    return `<div class="faccion-xp"><div class="faccion-xp-cab"><span>Experiencia</span><strong>${n(xp)} · nivel máximo</strong></div><div class="faccion-xp-barra"><span style="width:100%"></span></div></div>`;
  }
  const desde = faccion.nivel >= 2 ? umbrales[faccion.nivel - 2] ?? 0 : 0;
  const hasta = umbrales[faccion.nivel - 1] ?? desde;
  const pct = hasta > desde ? Math.max(0, Math.min(100, ((xp - desde) / (hasta - desde)) * 100)) : 100;
  return `<div class="faccion-xp" title="${n(xp - desde)} de ${n(hasta - desde)} para el nivel ${faccion.nivel + 1}">
    <div class="faccion-xp-cab"><span>Experiencia</span><strong>${n(xp)} / ${n(hasta)}</strong></div>
    <div class="faccion-xp-barra" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>
    <small>Faltan ${n(hasta - xp)} para el nivel ${faccion.nivel + 1}</small>
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
    ${htmlExperienciaFaccion(faccion)}
    <div class="faccion-lateral-resumen">${htmlResumenFaccion(proyeccion, faccion, e)}</div>
    <div class="faccion-lateral-pie">
      ${htmlCuposFaccion(proyeccion, faccion, e)}
      <div class="faction-list"><span class="faction-kicker">Títulos del servidor</span>
        ${htmlTitulos(proyeccion.titulos ?? [], [...proyeccion.facciones, ...(proyeccion.directorioFacciones ?? [])], faccion.id, e)}</div>
      ${htmlDejarFaccion(proyeccion, faccion)}
    </div>
  </aside>`;
}

/** Las plazas desplegadas en la pestaña Plazas: sobreviven a los repintados. La capital, de entrada. */
/** Las plazas desplegadas: todas plegadas al abrir (Víctor, 2026-11-07); se despliega una pulsando su fila. */
const plazasAbiertas = new Set<string>();

/** Lo de dentro de una plaza propia vista desde fuera (motor 5776ab69): chips de estado arriba y, desplegado, almacén por minuto, obras y guarnición. */
function htmlInteriorPlaza(p: ProyeccionJugador, a: Asentamiento, abierta: boolean, e: (v: string) => string): { chips: string; detalle: string } {
  const pob = a.poblacion;
  const obras = (a.edificios ?? []).filter((x) => x.estado === 'en_construccion' || x.mejora);
  const parados = (a.edificios ?? []).filter((x) => x.estado === 'activo' && x.pausadoPorAlmacenLleno).length;
  const danados = (a.edificios ?? []).filter((x) => x.danado).length;
  const recursos = recursosDelAlmacen(a);
  const bajan = recursos.filter(([, x]) => (x.porMinuto ?? 0) < 0 && !(x.capacidad > 0 && x.cantidad >= x.capacidad)).length;
  const escuadras = a.guarnicionIds?.length ?? 0;
  const ascenso = a.ascenso;
  // La vista reducida (0.142.0, Víctor 2026-11-04): la barra de la plaza en 3D (Población, Almacén con los recursos elegidos para ella, Estado) y
  // dos placas más con lo que se mueve: Obras (subida de nivel, obras y mejoras, parados y dañados) y Guarnición.
  const enCurso = obras.map((x) => avanceDeObra(a, x)).filter((x): x is number => x !== null);
  const obrasPiezas = [
    ascenso ? (() => {
      const dur = ascenso.completaEn - ascenso.iniciadoEn;
      const x = dur > 0 ? Math.max(0, Math.min(1, (ahora() - ascenso.iniciadoEn) / dur)) : 0;
      return pieza('⬆', `Nivel ${ascenso.nivelObjetivo} · ${e(cuentaAtras(ascenso.completaEn))}`, x * 100, `Subida a nivel ${ascenso.nivelObjetivo}`, [`Acaba en ${cuentaAtras(ascenso.completaEn)}`], '', e);
    })() : '',
    obras.length ? pieza('🏗', String(obras.length), enCurso.length ? (enCurso.reduce((t, x) => t + x, 0) / enCurso.length) * 100 : 0, 'Obras y mejoras',
      obras.map((x) => `${EDIFICIO_NOMBRE[x.tipo] ?? x.tipo}${x.mejora ? ` a nivel ${x.mejora.nivelObjetivo}` : ''}: ${cuentaAtras(x.mejora?.completaEn ?? x.completaEn) || 'en cola'}`), '', e) : '',
    bajan ? pieza('▼', String(bajan), 0, 'Recursos a la baja', recursos.filter(([, x]) => (x.porMinuto ?? 0) < 0 && !(x.capacidad > 0 && x.cantidad >= x.capacidad)).map(([r, x]) => `${RECURSO_NOMBRE[r] ?? r}: ${(x.porMinuto ?? 0).toFixed(1)}/min`), 'tono-mal', e) : '',
    parados ? pieza('⏸', String(parados), 100, 'Parados', [`${parados} edificio(s) parados por almacén lleno`], 'lleno', e) : '',
    danados ? pieza('⚠', String(danados), 100, 'Dañados', [`${danados} edificio(s) dañados`], 'lleno', e) : '',
  ].join('');
  const hombres = (a.guarnicion ?? []).reduce((t, g) => t + g.cantidad, 0);
  const guarnicionPieza = escuadras ? pieza('🛡', hombres ? miles(hombres) : String(escuadras), 0, 'Guarnición', [`${escuadras} escuadra(s)${hombres ? `, ${miles(hombres)} hombres` : ''}`], '', e) : '';
  // El almacén entero, no la elección de la barra de arriba de la plaza (Víctor, 2026-11-04: «solo muestra 5 espacios»): todo lo que tiene.
  const almacenPiezas = recursos.map(([r, x]) => {
    const llenado = x.capacidad > 0 ? (x.cantidad / x.capacidad) * 100 : 0;
    const neto = x.porMinuto ?? 0;
    return pieza(RECURSO_ICONO[r] ?? '📦', miles(x.cantidad), llenado, RECURSO_NOMBRE[r] ?? r,
      [`${miles(x.cantidad)}${x.capacidad > 0 ? ` de ${miles(x.capacidad)}` : ''}`, `${neto > 0 ? '+' : ''}${neto.toFixed(1)} por minuto`], llenado >= 90 ? 'lleno' : '', e);
  }).join('');
  const chips = `<div class="fplaza-pie">${htmlPoblacionPie(a, e)}${almacenPiezas ? grupo('almacen', 'Almacén', almacenPiezas) : ''}${htmlEstadoPie(a, e)}${obrasPiezas ? grupo('obras', 'Obras', obrasPiezas) : ''}${guarnicionPieza ? grupo('guarnicion', 'Guarnición', guarnicionPieza) : ''}</div>`;
  if (!abierta) return { chips, detalle: '' };

  const almacen = recursos.length
    ? `<div class="prod-fichas">${recursos.map(([r, x]) => fichaRecurso(r, x, e)).join('')}</div>`
    : '<p class="mapa-lista-vacia">El almacén está vacío.</p>';
  const poblacion = pob
    ? `<div class="fplaza-poblacion">${[['🧑‍🌾', 'Pesants', pob.pesants], ['🔨', 'Artesanos', pob.artesanos], ['👑', 'Nobleza', pob.nobleza]].map(([i, n, v]) => `<div title="${n}"><span aria-hidden="true">${i}</span><strong>${Math.floor(v as number)}</strong><small>${n}</small></div>`).join('')}</div>`
    : '';
  const lineaAscenso = ascenso
    ? (() => {
      const dur = ascenso.completaEn - ascenso.iniciadoEn;
      const x = dur > 0 ? Math.max(0, Math.min(1, (ahora() - ascenso.iniciadoEn) / dur)) : null;
      return `<div class="fplaza-obra"><span class="fplaza-obra-icono" aria-hidden="true">⬆</span><span class="fplaza-obra-nombre">Subida a nivel ${ascenso.nivelObjetivo}</span>${barraAvance(x)}<small>${e(cuentaAtras(ascenso.completaEn))}</small></div>`;
    })()
    : '';
  const lineasObra = obras.map((x) => {
    const nombre = EDIFICIO_NOMBRE[x.tipo] ?? x.tipo;
    const que = x.mejora ? `a nivel ${x.mejora.nivelObjetivo}` : 'en obra';
    const fin = x.mejora?.completaEn ?? x.completaEn;
    return `<div class="fplaza-obra"><span class="fplaza-obra-icono" aria-hidden="true">${iconoEdificio(x.tipo, 22)}</span><span class="fplaza-obra-nombre">${e(nombre)} <small>${que}</small></span>${barraAvance(avanceDeObra(a, x))}<small>${e(cuentaAtras(fin) || 'en cola')}</small></div>`;
  }).join('');
  const obrasHtml = lineaAscenso || lineasObra ? `${lineaAscenso}${lineasObra}` : '<p class="mapa-lista-vacia">Sin obras ni mejoras en curso.</p>';
  // La guarnición, por dueño y tropa (`guarnicion` en el orden de `guarnicionIds`).
  const porDueno = new Map<string, Map<string, number>>();
  for (const g of a.guarnicion ?? []) {
    const m = porDueno.get(g.heroeId) ?? new Map<string, number>();
    m.set(g.tropaId, (m.get(g.tropaId) ?? 0) + g.cantidad);
    porDueno.set(g.heroeId, m);
  }
  const guarnicion = porDueno.size
    ? [...porDueno.entries()].map(([h, m]) => `<div class="fplaza-guarnicion"><strong class="guarnicion-dueno">${e(h === p.heroeId ? 'Tuya' : nombreDeHeroe(p, h))}</strong>${[...m.entries()].map(([t, n]) => `<span class="fplaza-tropa" title="${e(`${nombreDeTropa(t)} · ${n} hombres`)}">${iconoTropa(t, 22)}<small>${n}</small></span>`).join('')}</div>`).join('')
    : escuadras ? `<p class="legend-note">${escuadras} escuadra(s).</p>` : '<p class="mapa-lista-vacia">Nadie ha dejado tropa en la guarnición.</p>';
  const cupo = a.cupoGuarnicion !== undefined ? `<small>cupo ${a.cupoGuarnicion} pts por héroe</small>` : '';
  const detalle = `<div class="fplaza-detalle">
      <div class="fplaza-bloque fplaza-almacen"><div class="obra-titulo"><span class="faction-kicker">Almacén</span><small>por minuto · ▲ entra, ▼ sale</small></div>${almacen}
        ${a.autoConstruccionPausada ? '<p class="legend-note">La auto-construcción está apagada: no se levantan edificios nuevos solos.</p>' : ''}</div>
      <div class="fplaza-columna">
        ${poblacion ? `<div class="fplaza-bloque"><div class="obra-titulo"><span class="faction-kicker">Población</span></div>${poblacion}</div>` : ''}
        <div class="fplaza-bloque"><div class="obra-titulo"><span class="faction-kicker">Obras y mejoras</span></div>${obrasHtml}</div>
        <div class="fplaza-bloque"><div class="obra-titulo"><span class="faction-kicker">Guarnición</span>${cupo}</div>${guarnicion}</div>
      </div>
    </div>`;
  return { chips, detalle };
}

/** La pestaña Plazas: las de tu Facción que conoce el cliente, con su nivel, si es la capital, cuántos ciudadanos residen y «Ver» en el mapa.
 * Con el interior que da el motor desde fuera (0.141.0, Víctor 2026-11-04): mantenimiento, nutrición, población, obras, ascenso, guarnición y
 * auto-construcción en chips, y desplegada el almacén con lo que entra y sale por minuto. */
function htmlPlazasFaccion(p: ProyeccionJugador, faccion: Faccion, e: (valor: string) => string): string {
  const plazas = new Map<string, { nombre: string; nivel: number; posicion: { x: number; y: number }; recordada: boolean }>();
  for (const a of p.asentamientosConocidos) if (a.faccionId === faccion.id) plazas.set(a.asentamientoId, { nombre: a.nombre ?? a.asentamientoId, nivel: a.nivel, posicion: a.posicion, recordada: true });
  for (const a of p.asentamientosAvistados) if (a.faccionId === faccion.id) plazas.set(a.id, { nombre: a.nombre ?? a.id, nivel: a.nivel, posicion: a.posicion, recordada: false });
  for (const a of p.asentamientos) if (a.faccionId === faccion.id && !plazas.has(a.id)) plazas.set(a.id, { nombre: a.nombre ?? a.id, nivel: a.nivel, posicion: a.posicion, recordada: false });
  const interiores = new Map((p.plazasPropias ?? []).filter((a) => a.faccionId === faccion.id).map((a) => [a.id, a]));
  for (const a of interiores.values()) if (!plazas.has(a.id)) plazas.set(a.id, { nombre: a.nombre ?? a.id, nivel: a.nivel, posicion: a.posicion, recordada: false });
  if (plazas.size === 0) return '<p class="mapa-lista-vacia">Tu Facción aún no tiene plazas.</p>';
  const capitalId = faccion.capitalId ?? p.tecnologia?.capitalId ?? undefined;
  const residentes = (id: string) => (faccion.miembros ?? []).filter((m) => m.residenciaId === id).length;
  const lista = [...plazas.entries()].sort(([ia, a], [ib, b]) => Number(ib === capitalId) - Number(ia === capitalId) || b.nivel - a.nivel || a.nombre.localeCompare(b.nombre));
  return `<div class="faction-list faction-list-libre"><span class="faction-kicker">Plazas de tu Facción (${plazas.size})</span>
    ${lista.map(([id, a]) => {
      const dentro = interiores.get(id);
      const abierta = Boolean(dentro) && plazasAbiertas.has(id);
      const interior = dentro ? htmlInteriorPlaza(p, dentro, abierta, e) : null;
      return `<div class="faccion-plaza${id === capitalId ? ' capital' : ''}${interior ? ' con-interior' : ''}${abierta ? ' abierta' : ''}">
      <div class="faccion-plaza-fila"${interior ? ` role="button" tabindex="0" data-plaza-detalle="${e(id)}" aria-expanded="${abierta}" title="${abierta ? 'Plegar' : 'Desplegar'}"` : ''}>
        <div class="faccion-plaza-info"><strong>${interior ? `<span class="faccion-plaza-flecha" aria-hidden="true">${abierta ? '▾' : '▸'}</span> ` : ''}${e(a.nombre)}${id === capitalId ? ' <span class="faccion-publica-relacion">Capital</span>' : ''}</strong>
          <span>Nivel ${a.nivel}${dentro?.nivelActual !== undefined && dentro.nivelActual < a.nivel ? ` <span class="falta">(rinde como ${dentro.nivelActual})</span>` : ''} · (${Math.round(a.posicion.x)}, ${Math.round(a.posicion.y)})${a.recordada ? ' · recordada' : ''}</span>
</div>
        <div class="faccion-publica-cifras"><div><strong>${residentes(id)}</strong><span>Residentes</span></div></div>
        <button class="btn-secondary" type="button" data-centrar-x="${a.posicion.x}" data-centrar-y="${a.posicion.y}">Ver en el mapa</button>
      </div>
      ${interior?.chips ?? ''}
      ${interior?.detalle ?? ''}
    </div>`;
    }).join('')}</div>`;
}

/** La pestaña Plazas: pulsar la fila de una plaza (o Intro/espacio en ella) la despliega o la pliega; sus botones («Ver en el mapa») van aparte. */
export function cablearPlazasFaccion(root: ParentNode, rerender: () => void): void {
  root.querySelectorAll<HTMLElement>('[data-plaza-detalle]').forEach((fila) => {
    const alternar = () => {
      const id = fila.dataset.plazaDetalle!;
      if (plazasAbiertas.has(id)) plazasAbiertas.delete(id); else plazasAbiertas.add(id);
      rerender();
    };
    fila.addEventListener('click', (ev) => { if (!(ev.target as HTMLElement).closest('button, a, input, select')) alternar(); });
    fila.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === fila) { ev.preventDefault(); alternar(); } });
  });
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
/** «Pedir ingreso» sin Facción (0.135.0, Víctor 2026-11-04): las de bots, ocultas de entrada; la casilla junto al buscador las enseña (al final). */
export let ocultarBotsAlPedirIngreso = true;
export function fijarOcultarBots(valor: boolean): void { ocultarBotsAlPedirIngreso = valor; }

/** `botsAlFinal`: las Facciones de bots van detrás de las de jugadores en cada grupo; `sinBots`: no salen. */
export function htmlListaFacciones(p: ProyeccionJugador, e: (valor: string) => string, opciones: { termino?: string; accion?: (f: Faccion) => string; botsAlFinal?: boolean; sinBots?: boolean } = {}): string {
  const plazas = plazasConocidas(p);
  const nombreDe = (id: string) => p.facciones.find((f) => f.id === id)?.nombre ?? id;
  const termino = (opciones.termino ?? '').trim().toLowerCase();
  const accion = opciones.accion ?? (() => '');
  // El directorio ligero (motor db80cb8) trae todas las Facciones; las que también llegan completas se enseñan con su detalle.
  const directorio = new Map((p.directorioFacciones ?? []).map((x) => [x.id, x]));
  const miembros = (f: Faccion): number => f.ciudadanosIds?.length ?? directorio.get(f.id)?.ciudadanos ?? 0;
  const esBot = (id: string): boolean => Boolean(p.facciones.find((f) => f.id === id)?.esBot || directorio.get(id)?.esBot);
  const conBots = (id: string): boolean => !opciones.sinBots || !esBot(id);
  const bots = (a: { id: string }, b: { id: string }): number => (opciones.botsAlFinal ? Number(esBot(a.id)) - Number(esBot(b.id)) : 0);
  const lista = p.facciones.filter((f) => f.nombre.toLowerCase().includes(termino) && conBots(f.id)).sort((a, b) => Number(a.derrotadaPor !== undefined) - Number(b.derrotadaPor !== undefined)
    || bots(a, b) || miembros(b) - miembros(a) || a.nombre.localeCompare(b.nombre));
  // Sin Facción, todas con su detalle: son a las que puede pedir el ingreso (el motor se las manda todas en su forma pública).
  const conocidas = p.faccionId === null ? lista : lista.filter((f) => hayContacto(p, f, plazas));
  const yaVistas = new Set(conocidas.map((f) => f.id));
  // Sin contacto: del directorio si llega (con escudo, nivel y miembros; sin las derrotadas), si no, las completas que no son conocidas.
  const lejanas: Faccion[] = p.directorioFacciones
    ? p.directorioFacciones.filter((x) => !yaVistas.has(x.id) && !x.derrotada && x.nombre.toLowerCase().includes(termino) && conBots(x.id))
      .sort((a, b) => bots(a, b) || b.ciudadanos - a.ciudadanos || a.nombre.localeCompare(b.nombre))
      .map((x) => p.facciones.find((f) => f.id === x.id) ?? { id: x.id, nombre: x.nombre, sigilo: x.sigilo, nivel: x.nivel })
    : lista.filter((f) => !yaVistas.has(f.id));
  if (conocidas.length === 0 && lejanas.length === 0) return `<p class="mapa-lista-vacia">${termino ? 'No hay facciones que coincidan.' : opciones.sinBots ? 'No hay Facciones de jugadores todavía. Quita «Ocultar las de bots» para ver las demás.' : 'Aún no hay Facciones en el mundo.'}</p>`;
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
        <div><strong>${miembros(f)}</strong><span>Miembros</span></div>
        <div><strong>${[...plazas.values()].filter((x) => x.faccionId === f.id).length}</strong><span>Plazas</span></div>
      </div>
      ${accion(f)}
    </div>`;
  };
  const sencilla = (f: Faccion): string => `<div class="faccion-lejana">${directorio.has(f.id) ? `<span class="faccion-lejana-escudo">${svgSigilo(f.sigilo, 30)}</span>` : ''}<span class="faccion-lejana-nombre">${e(f.nombre)}${directorio.has(f.id) ? `<small>Nivel ${f.nivel} · ${miembros(f)} miembro${miembros(f) === 1 ? '' : 's'}</small>` : ''}</span>${accion(f)}</div>`;
  return `<div class="faction-list faction-list-libre"><span class="faction-kicker">${p.faccionId === null ? 'Facciones del mundo' : 'Conocidas'} (${conocidas.length})${ayuda('faccion:lista', 'Con contacto: la tuya, las de tu Liga, con las que tienes relación y aquellas de las que conoces alguna plaza en el mapa. Las plazas son las que conoces, no todas las que tienen.')}</span>
    ${conocidas.length ? conocidas.map(fila).join('') : '<p class="legend-note">Aún no has tenido contacto con ninguna.</p>'}</div>
    ${lejanas.length ? `<div class="faction-list faction-list-libre"><span class="faction-kicker">Sin contacto (${lejanas.length})</span><div class="faccion-lejanas">${lejanas.map(sencilla).join('')}</div></div>` : ''}`;
}

/** Una Facción tal como la conoce el cliente: completa (`facciones`) o solo del directorio ligero. */
function faccionConocida(p: ProyeccionJugador, id: string): Faccion | undefined {
  const completa = p.facciones.find((f) => f.id === id);
  if (completa) return completa;
  const d = p.directorioFacciones?.find((f) => f.id === id);
  return d ? { id: d.id, nombre: d.nombre, sigilo: d.sigilo, nivel: d.nivel, esBot: d.esBot } as Faccion : undefined;
}

/** El centro de la pestaña Diplomacia con otra Facción elegida: lo que se sabe de ella (lo público, sus plazas conocidas) y lo que tu Facción
 * puede hacer con ella (`htmlDiplomacia` filtrada a ella). */
function htmlFichaFaccion(p: ProyeccionJugador, propia: Faccion, id: string, e: (valor: string) => string): string {
  const f = faccionConocida(p, id);
  if (!f) return '<p class="mapa-lista-vacia">Esa Facción ya no está a la vista.</p>';
  const completa = p.facciones.some((x) => x.id === id);
  const directorio = p.directorioFacciones?.find((x) => x.id === id);
  const plazas = [...plazasConocidas(p).entries()].filter(([, x]) => x.faccionId === id);
  const nombreDe = (x: string) => faccionConocida(p, x)?.nombre ?? x;
  const relacion = relacionCon(p, propia.id, id);
  const derrota = f.derrotadaPor !== undefined ? (f.derrotadaPor ? `Derrotada por ${nombreDe(f.derrotadaPor)}` : 'Desaparecida') : directorio?.derrotada ? 'Derrotada' : '';
  const capital = f.capitalId ? plazasConocidas(p).get(f.capitalId)?.nombre : undefined;
  const filas: [string, string][] = [
    ['Nivel', String(f.nivel)],
    ['Miembros', String(f.ciudadanosIds?.length ?? directorio?.ciudadanos ?? 0)],
    ['Plazas conocidas', String(plazas.length)],
    ...(completa ? [
      ['Reputación', String(Math.round(f.reputacion ?? 0))],
      ['Rey', f.reyId ? nombreDeHeroe(p, f.reyId) : 'Sin designar'],
      ['Embajador', f.embajadorId ? nombreDeHeroe(p, f.embajadorId) : 'Sin designar'],
    ] as [string, string][] : []),
    ...(capital ? [['Capital', capital]] as [string, string][] : []),
    ...(f.liga ? [['Liga', `${f.liga.tieneVasallaje ? 'Por vasallaje' : 'Por alianza'}${f.liga.granReyId === f.id ? ' · Gran Rey' : f.liga.granReyId ? ` · Gran Rey: ${nombreDe(f.liga.granReyId)}` : ''}`]] as [string, string][] : []),
    // Facción de bots: su Rey es un bot (motor afd53b8, `es_bot` en la Facción y en el directorio).
    ['¿Bot?', f.esBot || directorio?.esBot ? 'Sí: la lleva un Rey bot' : 'No'],
  ];
  const insignias = [
    relacion ? `<span class="faccion-publica-relacion rel-${relacion === 'En guerra' ? 'guerra' : 'paz'}">${e(relacion)}</span>` : '',
    derrota ? `<span class="faccion-publica-relacion rel-derrota">${e(derrota)}</span>` : '',
    f.admiteOtrasEnAtaques ? '<span class="faccion-publica-relacion">Admite a otras en sus ataques</span>' : '',
  ].join('');
  const listaPlazas = plazas.length
    ? `<div class="faction-list"><span class="faction-kicker">Sus plazas que conoces</span>${plazas.map(([pid, x]) => `<div class="faction-list-item"><div><strong>${e(x.nombre || pid)}</strong></div></div>`).join('')}</div>`
    : '';
  return `<div class="diplo-ficha-cab"><div class="faccion-publica-escudo">${svgSigilo(f.sigilo, 72, { granRey: f.liga?.granReyId === f.id })}</div>
      <div><span class="faction-kicker">${completa ? 'Facción conocida' : 'Del directorio: solo lo público'}</span><h3>${e(f.nombre)}</h3><div class="diplo-insignias">${insignias}</div></div></div>
    <div class="diplo-datos">${filas.map(([k, v]) => `<div><span>${e(k)}</span><strong>${e(v)}</strong></div>`).join('')}</div>
    ${htmlDiplomacia(p, propia, e, { id: f.id, nombre: f.nombre })}
    ${listaPlazas}`;
}

/** La lista de la derecha de la pestaña Diplomacia: la tuya, las conocidas y las demás del directorio; cada una se pulsa para verla en el centro. */
function htmlListaDiplomacia(p: ProyeccionJugador, elegidaId: string, e: (valor: string) => string): string {
  const plazas = plazasConocidas(p);
  const directorio = new Map((p.directorioFacciones ?? []).map((x) => [x.id, x]));
  const miembros = (f: Faccion): number => f.ciudadanosIds?.length ?? directorio.get(f.id)?.ciudadanos ?? 0;
  const orden = (a: Faccion, b: Faccion) => Number(a.derrotadaPor !== undefined) - Number(b.derrotadaPor !== undefined) || miembros(b) - miembros(a) || a.nombre.localeCompare(b.nombre);
  const conocidas = p.facciones.filter((f) => f.id !== p.faccionId && hayContacto(p, f, plazas)).sort(orden);
  const vistas = new Set([p.faccionId, ...conocidas.map((f) => f.id)]);
  const lejanas = [...(p.directorioFacciones ?? []).filter((x) => !x.derrotada).map((x) => faccionConocida(p, x.id)!), ...p.facciones.filter((f) => !directorio.has(f.id))]
    .filter((f) => !vistas.has(f.id)).sort(orden);
  const fila = (f: Faccion): string => {
    const relacion = relacionCon(p, p.faccionId, f.id);
    const bot = f.esBot || directorio.get(f.id)?.esBot ? ' · 🤖 bots' : '';
    const sub = (f.id === p.faccionId ? 'La tuya' : relacion || `Nivel ${f.nivel} · ${miembros(f)} miembro${miembros(f) === 1 ? '' : 's'}`) + bot;
    return `<button type="button" class="diplo-fila${f.id === elegidaId ? ' activo' : ''}${relacion === 'En guerra' ? ' guerra' : ''}" data-elegir-faccion="${e(f.id)}">
      <span class="diplo-fila-escudo">${svgSigilo(f.sigilo, 26)}</span><span class="diplo-fila-texto"><strong>${e(f.nombre)}</strong><small>${e(sub)}</small></span></button>`;
  };
  const propia = p.faccionId ? faccionConocida(p, p.faccionId) : undefined;
  // Las de bots se pueden ocultar (0.144.0), salvo la elegida y las que tienen relación con la tuya.
  const esBot = (f: Faccion): boolean => Boolean(f.esBot || directorio.get(f.id)?.esBot);
  const seVe = (f: Faccion): boolean => !diplomaciaSinBots || !esBot(f) || f.id === elegidaId || Boolean(relacionCon(p, p.faccionId, f.id));
  const totalBots = [...conocidas, ...lejanas].filter(esBot).length;
  const seccion = (clave: string, titulo: string, lista: Faccion[], vacio: string, info = ''): string => {
    const visibles = lista.filter(seVe);
    const ocultas = lista.length - visibles.length;
    const abierta = !seccionesPlegadas.has(clave);
    return `<div class="diplo-seccion-fila"><button type="button" class="diplo-seccion" data-diplo-plegar="${clave}" aria-expanded="${abierta}" title="${abierta ? 'Plegar' : 'Desplegar'}"><span aria-hidden="true">${abierta ? '▾' : '▸'}</span><span class="faction-kicker">${titulo} (${visibles.length})</span>${ocultas ? `<small title="${ocultas} de bots ocultas">+${ocultas} 🤖</small>` : ''}</button>${info}</div>
      ${abierta ? (visibles.length ? visibles.map(fila).join('') : `<p class="legend-note">${vacio}</p>`) : ''}`;
  };
  return `${totalBots ? `<button type="button" class="btn-secondary btn-chico diplo-bots${diplomaciaSinBots ? ' activo' : ''}" data-diplo-bots aria-pressed="${diplomaciaSinBots}" title="Las Facciones que lleva un Rey bot">🤖 ${diplomaciaSinBots ? `Mostrar las de bots (${totalBots})` : 'Ocultar las de bots'}</button>` : ''}
    ${propia ? fila(propia) : ''}
    ${seccion('conocidas', 'Conocidas', conocidas, diplomaciaSinBots && conocidas.length ? 'Solo de bots.' : 'Aún no has tenido contacto con ninguna.', ayuda('faccion:lista', 'Con contacto: las de tu Liga, con las que tienes relación y aquellas de las que conoces alguna plaza en el mapa.'))}
    ${lejanas.length ? seccion('lejanas', 'Sin contacto', lejanas, 'Solo de bots.') : ''}`;
}

/** El panel derecho de Diplomacia: ocultar las de bots y plegar Conocidas y Sin contacto (0.144.0). Se recuerda mientras dura la sesión. */
let diplomaciaSinBots = false;
const seccionesPlegadas = new Set<string>();

export function cablearListaDiplomacia(root: ParentNode, rerender: () => void): void {
  root.querySelector<HTMLButtonElement>('[data-diplo-bots]')?.addEventListener('click', () => { diplomaciaSinBots = !diplomaciaSinBots; rerender(); });
  root.querySelectorAll<HTMLButtonElement>('[data-diplo-plegar]').forEach((b) => b.addEventListener('click', () => {
    const clave = b.dataset.diploPlegar!;
    if (seccionesPlegadas.has(clave)) seccionesPlegadas.delete(clave); else seccionesPlegadas.add(clave);
    rerender();
  }));
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
    if (pestana === 'plazas') return htmlPlazasFaccion(proyeccion, faccion, escaparHtml);
    if (pestana === 'miembros') return `${solicitudes}${htmlCargos(proyeccion, faccion, escaparHtml)}${miembros}`;
    const htmlDiplomaciaPropia = (): string => {
      return `${htmlDiplomacia(proyeccion, faccion, escaparHtml)}
      ${htmlAnexion(proyeccion, faccion, escaparHtml)}
      ${htmlFusion(proyeccion, faccion, escaparHtml)}
      <div class="faction-list">
        <span class="faction-kicker">Liga</span>
        ${liga
          ? `<div class="liga-fila">${htmlLiga(liga, proyeccion.facciones)}<div><strong>${liga.tieneVasallaje ? 'Por vasallaje' : 'Por alianza'}</strong><span>${liga.miembrosIds.map((id) => escaparHtml(nombreDe(id))).join(', ')}</span>${liga.granReyId ? `<span>Gran Rey: ${escaparHtml(granRey(proyeccion, liga.granReyId))}</span>` : ''}</div></div>`
          : '<p class="legend-note">No perteneces a ninguna Liga.</p>'}
      </div>`;
    };
    if (pestana === 'diplomacia') {
      // Diplomacia y Facciones juntas (Víctor, 2026-10-31): la lista a la derecha y, en el centro, lo que se sabe de la elegida con lo que se
      // puede hacer con ella; con la tuya elegida, todas tus relaciones, propuestas, anexión, fusión y Liga.
      const elegida = faccionElegida && faccionElegida !== faccion.id ? faccionElegida : null;
      const centro = elegida ? htmlFichaFaccion(proyeccion, faccion, elegida, escaparHtml) : `<div class="diplo-ficha-cab"><div class="faccion-publica-escudo">${svgSigilo(faccion.sigilo, 56, { granRey: esGranRey })}</div><div><span class="faction-kicker">Tu facción</span><h3>${escaparHtml(faccion.nombre)}</h3></div></div>${htmlDiplomaciaPropia()}`;
      return `<div class="diplo-marco"><section class="diplo-centro">${centro}</section><aside class="diplo-lista">${htmlListaDiplomacia(proyeccion, elegida ?? faccion.id, escaparHtml)}</aside></div>`;
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
        ${htmlTitulos(proyeccion.titulos ?? [], [...proyeccion.facciones, ...(proyeccion.directorioFacciones ?? [])], faccion.id, escaparHtml)}
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
      <div class="faction-buscar">
        <input id="input-buscar-faccion" class="form-input" type="search" placeholder="Buscar por nombre..." autocomplete="off" />
        <label class="faction-sin-bots" title="Un jugador no puede entrar en una Facción de bots"><input id="check-sin-bots" type="checkbox"${ocultarBotsAlPedirIngreso ? ' checked' : ''} /> Ocultar las de bots</label>
      </div>
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
