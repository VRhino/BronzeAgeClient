// CENTRO URBANO de la plaza con aire de juego de estrategia (petición de Víctor, 2026-11-02, después de la de Edificios): la subida de nivel (encima
// de las subpestañas; desde la 0.97.0, su propia ventana, que se abre desde el medallón del blasón), la población por clases (para la barra de
// abajo de la plaza), el interruptor de auto-construcción y los Cargos (una silla por cargo, con su emblema). Lo que se pinta sale de la proyección y de `GET /v1/datos` (`NIVEL_ASENTAMIENTO`, `ASCENSO_ASENTAMIENTO`,
// `EDIFICIO_CATALOGO`): el motor no proyecta la evaluación de la subida, así que se calcula aquí con sus mismos requisitos; el cupo de la Facción
// lo comprueba él al pedirla. La solvencia ya no bloquea (motor 906fb24, cliente 0.199.0): llega como aviso en `insolvenciaAscenso` y se enseña
// debajo de la tarjeta, sin tocar el botón. Los rechazos salen flotando (`mostrarAviso`).
import type { ProyeccionJugador } from '../apiCliente';
import { bloqueDeDatos } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { mostrar as mostrarAviso } from './avisos';
import type { ContextoPlaza } from './ganchos';
import { iconoEdificio } from './iconosEdificio';
import { ahora, barraAvance, chipsDeCoste, cuentaAtras, duracion, marcasNivel, medallonNivel, miles } from './juegoVisual';
import { nombreDeHeroe } from './nombres';
import { CARGO_EMBLEMA } from './participacion';
import { plegable } from './plegable';
import { esAldea } from './pueblos';
import { olvidarEdicion } from './repintado';

type Escapar = (valor: string) => string;

interface RequisitoNivel { pesants?: number; artesanos?: number; edificios?: string[]; edificiosMinimo?: number; aldeasAgricolas?: number; pueblosActivos?: number; nivelInternoMinimo?: Record<string, number>; recintoCompletoNivelMinimo?: number; edificiosConNivel?: Record<string, number> }
interface NivelAsentamiento { nivelMaximo?: number; requisitos?: Record<string, RequisitoNivel>; techoPoblacion?: Record<string, number> }
interface AscensoAsentamiento { porNivelObjetivo?: Record<string, { costo: Record<string, number>; obraMinutos: number }>; nivelTechoProvisional?: number }
type DefEdificio = { capacidadPesants?: number; capacidadArtesanos?: number; niveles?: Record<string, { capacidadNobles?: number }> };

const nombreEdificio = (t: string): string => EDIFICIO_NOMBRE[t] ?? t;

// ---------------------------------------------------------------- subida de nivel

/** Un requisito del nivel siguiente: cumplido, no cumplido o `null` (lo comprueba el servidor al pedirla). */
interface Requisito { ok: boolean | null; icono: string; texto: string; barra?: [number, number]; extra?: string }

/** Los requisitos del nivel `objetivo`, como el motor (`NIVEL_ASENTAMIENTO` y `ASCENSO_ASENTAMIENTO`). */
function requisitosDeNivel(p: ProyeccionJugador, a: Asentamiento, r: RequisitoNivel, coste: Record<string, number>, esc: Escapar): Requisito[] {
  const pob = a.poblacion ?? { pesants: 0, artesanos: 0, nobleza: 0 };
  const activoA = (tipo: string, nivel = 1): boolean => a.edificios.some((x) => x.tipo === tipo && x.estado === 'activo' && (x.nivelInterno ?? 1) >= nivel);
  const pedidos = r.edificios ?? [];
  const hechos = pedidos.filter((t) => activoA(t, r.nivelInternoMinimo?.[t] ?? 1));
  const minimo = r.edificiosMinimo ?? pedidos.length;
  const deLaPlaza = (p.pueblos ?? []).filter((x) => x.propio && x.madreId === a.id);
  const aldeas = deLaPlaza.filter(esAldea).length;
  const faltan = Object.entries(coste).filter(([k, n]) => (a.almacen?.[k]?.cantidad ?? 0) < n);
  const iconos = (tipos: string[], hecho: (t: string) => boolean): string => tipos.map((t) => `<span class="ascenso-edif${hecho(t) ? ' hecho' : ''}" title="${esc(`${nombreEdificio(t)}${hecho(t) ? ': en marcha' : ': falta'}`)}">${iconoEdificio(t, 22)}</span>`).join('');
  return [
    { ok: Math.floor(pob.pesants) >= (r.pesants ?? 0), icono: '🌾', texto: 'Pesants', barra: [Math.floor(pob.pesants), r.pesants ?? 0] },
    ...((r.artesanos ?? 0) > 0 ? [{ ok: Math.floor(pob.artesanos) >= r.artesanos!, icono: '⚒️', texto: 'Artesanos', barra: [Math.floor(pob.artesanos), r.artesanos!] as [number, number] }] : []),
    ...(pedidos.length ? [{
      ok: hechos.length >= minimo, icono: '🏛️',
      texto: `${minimo === pedidos.length ? 'Edificios en marcha' : `${minimo} de estos edificios`} (${hechos.length}/${minimo})`,
      extra: iconos(pedidos, (t) => hechos.includes(t)),
    }] : []),
    // Un edificio activo de ese tipo a ese nivel o más (el nivel 2 pidió una Granja a nivel 2 hasta el motor 3d05872; hoy ninguno lo usa).
    ...Object.entries(r.edificiosConNivel ?? {}).map(([tipo, nivel]) => {
      const mejor = Math.max(0, ...a.edificios.filter((x) => x.tipo === tipo && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
      return { ok: mejor >= nivel, icono: iconoEdificio(tipo, 18), texto: `${nombreEdificio(tipo)} a nivel ${nivel}`, extra: marcasNivel(Math.min(mejor, nivel), nivel) };
    }),
    ...((r.aldeasAgricolas ?? 0) > 0 ? [{ ok: aldeas >= r.aldeasAgricolas!, icono: '🌾', texto: 'Una aldea agrícola activa (pestaña Territorio)' }] : []),
    // desde el 2026-10-31 vale cualquier pueblo activo, aldea o extractor (`pueblosActivos`)
    ...((r.pueblosActivos ?? 0) > 0 ? [{ ok: deLaPlaza.length >= r.pueblosActivos!, icono: '🏘️', texto: `${r.pueblosActivos === 1 ? 'Un pueblo activo' : `${r.pueblosActivos} pueblos activos`}, aldea o extractor (pestaña Territorio)`, barra: [deLaPlaza.length, r.pueblosActivos!] as [number, number] }] : []),
    ...(r.recintoCompletoNivelMinimo ? [{ ok: null, icono: '🧱', texto: `Un recinto de muralla completo de nivel ${r.recintoCompletoNivelMinimo} o más (lo comprueba el servidor)` }] : []),
    { ok: faltan.length === 0, icono: '📦', texto: faltan.length ? 'En el almacén (en rojo, lo que falta)' : 'En el almacén', extra: `<span class="ascenso-chips">${chipsDeCoste(a, coste, esc) || 'sin coste'}</span>` },
  ];
}

function htmlRequisito(x: Requisito, esc: Escapar): string {
  const clase = x.ok === null ? 'servidor' : x.ok ? 'ok' : 'falta';
  const marca = x.ok === null ? '?' : x.ok ? '✓' : '✗';
  const barra = x.barra
    ? `<span class="ascenso-req-medida"><span class="ascenso-req-barra"><i style="width:${(Math.min(1, x.barra[1] > 0 ? x.barra[0] / x.barra[1] : 1) * 100).toFixed(1)}%"></i></span><small>${miles(x.barra[0])} / ${miles(x.barra[1])}</small></span>`
    : '';
  return `<li class="ascenso-req ${clase}"><span class="ascenso-req-marca" aria-hidden="true">${marca}</span><span class="ascenso-req-icono" aria-hidden="true">${x.icono}</span>
    <span class="ascenso-req-cuerpo"><span>${esc(x.texto)}</span>${barra}${x.extra ? `<span class="ascenso-req-extra">${x.extra}</span>` : ''}</span></li>`;
}

/**
 * La subida de nivel (Doc 4.5): no es automática, la pide el Gobernador, se paga entera del almacén y tarda una obra. Una tarjeta con el escudo de
 * ahora y el del nivel siguiente, un piloto por requisito (verde cumplido, rojo no), el coste y el tiempo, y el botón; los requisitos, plegados
 * debajo, con barras. Durante la obra, su avance.
 */
export function htmlAscensoPlaza(p: ProyeccionJugador, a: Asentamiento, soyGobernador: boolean, esc: Escapar, alCargar?: () => void, requisitosAbiertos = false): string {
  const reqs = bloqueDeDatos<NivelAsentamiento>('NIVEL_ASENTAMIENTO', alCargar);
  const asc = bloqueDeDatos<AscensoAsentamiento>('ASCENSO_ASENTAMIENTO', alCargar);
  if (!reqs || !asc) return '';
  const info = ayuda('plaza:ascenso', 'La subida de nivel no es automática: la pide el Gobernador, se paga entera del almacén y tarda una obra. Si conquistan la plaza durante la obra, se pierde. El servidor comprueba además el cupo de tu Facción. Si lo que llega a la plaza no cubre el mantenimiento del nivel nuevo, lo verás aquí como aviso, pero puedes subir igual.');
  if (a.ascenso) {
    const total = a.ascenso.completaEn - a.ascenso.iniciadoEn;
    const hecho = total > 0 ? Math.max(0, Math.min(1, (ahora() - a.ascenso.iniciadoEn) / total)) : 1;
    return `<div class="ascenso-tarjeta en-obra">
      <span class="ascenso-niveles">${medallonNivel(a.nivel)}<span class="ascenso-flecha" aria-hidden="true">➜</span>${medallonNivel(a.ascenso.nivelObjetivo, 'en-obra', `Subiendo al nivel ${a.ascenso.nivelObjetivo}`)}</span>
      <span class="ascenso-info"><strong>Subiendo a nivel ${a.ascenso.nivelObjetivo}${info}</strong>${barraAvance(hecho)}<small class="obra-tiempo">⏳ faltan ${cuentaAtras(a.ascenso.completaEn)}</small></span>
    </div>`;
  }
  const objetivo = a.nivel + 1;
  const techo = Math.min(reqs.nivelMaximo ?? 5, asc.nivelTechoProvisional ?? 5);
  if (objetivo > techo) {
    return `<div class="ascenso-tarjeta tope"><span class="ascenso-niveles">${medallonNivel(a.nivel, 'listo')}</span>
      <span class="ascenso-info"><strong>Nivel más alto de hoy${info}</strong><small>La plaza no puede subir más por ahora.</small></span></div>`;
  }
  const coste = asc.porNivelObjetivo?.[String(objetivo)];
  const lista = requisitosDeNivel(p, a, reqs.requisitos?.[String(objetivo)] ?? {}, coste?.costo ?? {}, esc);
  const cumplidos = lista.filter((x) => x.ok !== false).length;
  const puede = lista.every((x) => x.ok !== false);
  const motivo = !soyGobernador ? 'Solo el Gobernador puede pedir la subida.' : puede ? `Subir a nivel ${objetivo}` : 'Aún no cumple todos los requisitos (despliégalos debajo).';
  const pilotos = lista.map((x) => `<i class="${x.ok === null ? 'servidor' : x.ok ? 'ok' : 'falta'}" title="${esc(x.texto)}"></i>`).join('');
  return `<div class="ascenso-tarjeta${puede ? ' lista' : ''}">
      <span class="ascenso-niveles">${medallonNivel(a.nivel)}<span class="ascenso-flecha" aria-hidden="true">➜</span>${medallonNivel(objetivo, puede ? 'listo' : 'apagado', `Nivel ${objetivo}`)}</span>
      <span class="ascenso-info">
        <strong>Subir a nivel ${objetivo}${info}</strong>
        <span class="ascenso-pilotos" title="${cumplidos} de ${lista.length} requisitos">${pilotos}<small>${cumplidos}/${lista.length}</small></span>
        ${coste ? `<small class="ascenso-obra">⏳ obra de ${duracion(coste.obraMinutos)}</small>` : ''}
      </span>
      <button id="btn-solicitar-ascenso" class="ascenso-boton" type="button"${puede && soyGobernador ? '' : ' disabled'} title="${esc(motivo)}" aria-label="${esc(motivo)}">⬆</button>
    </div>
    ${htmlAvisoSolvencia(a, objetivo, esc)}
    ${plegable('ascenso:requisitos', `<span class="plegable-titulo">Requisitos del nivel ${objetivo}</span><span class="plegable-meta${puede ? '' : ' falta'}">${cumplidos} de ${lista.length}</span>`,
      `<ul class="ascenso-reqs">${lista.map((x) => htmlRequisito(x, esc)).join('')}</ul>${soyGobernador ? '' : '<p class="asent-lado-nota">Solo el Gobernador puede pedir la subida.</p>'}`, requisitosAbiertos)}`;
}

/** El aviso de solvencia (`insolvenciaAscenso`): cada recurso del mantenimiento del nivel `objetivo` que lo que llega por minuto no cubre. No bloquea. */
export function htmlAvisoSolvencia(a: Asentamiento, objetivo: number, esc: Escapar): string {
  const lista = a.insolvenciaAscenso ?? [];
  if (!lista.length) return '';
  const fmt = (n: number): string => (Math.abs(n) >= 10 ? miles(Math.round(n)) : n.toFixed(1).replace('.', ','));
  const filas = lista.map((x) => `<li><span aria-hidden="true">${RECURSO_ICONO[x.recurso] ?? '📦'}</span><b>${esc(RECURSO_NOMBRE[x.recurso] ?? x.recurso)}</b><small>llega ${fmt(x.llega)} y pediría ${fmt(x.pide)} por minuto</small></li>`).join('');
  return `<div class="ascenso-aviso" role="note"><span class="ascenso-aviso-icono" aria-hidden="true">⚠</span><span class="ascenso-aviso-cuerpo">
      <strong>Con lo que llega hoy, el nivel ${objetivo} no se pagaría solo</strong><small>No impide subir, pero el mantenimiento iría a la baja si no cambia.</small>
      <ul class="ascenso-insolvencia">${filas}</ul></span></div>`;
}

/** ¿Se puede pedir ya la subida? (sin obra en marcha, bajo el techo y con todo lo que se comprueba aquí cumplido): el medallón del blasón brilla. */
export function ascensoPosible(p: ProyeccionJugador, a: Asentamiento, alCargar?: () => void): boolean {
  const reqs = bloqueDeDatos<NivelAsentamiento>('NIVEL_ASENTAMIENTO', alCargar);
  const asc = bloqueDeDatos<AscensoAsentamiento>('ASCENSO_ASENTAMIENTO', alCargar);
  if (!reqs || !asc || a.ascenso) return false;
  const objetivo = a.nivel + 1;
  if (objetivo > Math.min(reqs.nivelMaximo ?? 5, asc.nivelTechoProvisional ?? 5)) return false;
  const coste = asc.porNivelObjetivo?.[String(objetivo)]?.costo ?? {};
  return requisitosDeNivel(p, a, reqs.requisitos?.[String(objetivo)] ?? {}, coste, (v) => v).every((x) => x.ok !== false);
}

// ---------------------------------------------------------------- Población y auto-construcción

/** Una clase de la población: cuántos hay, cuántos caben (viviendas o palacio; `null` sin el catálogo) y lo que pide el nivel siguiente. */
/** `vivienda`: vive en Viviendas (pesants y artesanos; la nobleza, en el Palacio). */
export interface ClaseDePoblacion { icono: string; nombre: string; tiene: number; sitio: number | null; meta?: number; vivienda?: true }

/** La población de la plaza para la barra de arriba: el total con el techo del nivel y las clases con su sitio. */
export interface PoblacionDePlaza { total: number; techo?: number; nivelMeta: number; clases: ClaseDePoblacion[] }

/**
 * La población de la plaza (`null` si no llega, como en una plaza ajena): pesants y artesanos caben en las Viviendas activas, la nobleza en el
 * Palacio; el techo y lo que pide el nivel siguiente salen de `NIVEL_ASENTAMIENTO` y el sitio de cada edificio de `EDIFICIO_CATALOGO`.
 */
export function poblacionDePlaza(a: Asentamiento, alCargar?: () => void): PoblacionDePlaza | null {
  if (!a.poblacion) return null;
  const reqs = bloqueDeDatos<NivelAsentamiento>('NIVEL_ASENTAMIENTO', alCargar);
  const cat = bloqueDeDatos<Record<string, DefEdificio>>('EDIFICIO_CATALOGO', alCargar);
  const pob = a.poblacion;
  const viviendas = a.edificios.filter((x) => x.tipo === 'vivienda' && x.estado === 'activo').length;
  const palacio = a.edificios.find((x) => x.tipo === 'palacio' && x.estado === 'activo');
  const meta = reqs?.requisitos?.[String(a.nivel + 1)];
  const clases: ClaseDePoblacion[] = [
    { icono: '🌾', nombre: 'Pesants', tiene: pob.pesants, sitio: cat?.vivienda?.capacidadPesants !== undefined ? viviendas * cat.vivienda.capacidadPesants : null, meta: meta?.pesants || undefined, vivienda: true },
    { icono: '⚒️', nombre: 'Artesanos', tiene: pob.artesanos, sitio: cat?.vivienda?.capacidadArtesanos !== undefined ? viviendas * cat.vivienda.capacidadArtesanos : null, meta: meta?.artesanos || undefined, vivienda: true },
  ];
  if (pob.nobleza > 0 || palacio) clases.push({ icono: '👑', nombre: 'Nobleza', tiene: pob.nobleza, sitio: cat ? (palacio ? cat.palacio?.niveles?.[String(palacio.nivelInterno ?? 1)]?.capacidadNobles ?? 0 : 0) : null });
  return { total: pob.pesants + pob.artesanos + pob.nobleza, techo: reqs?.techoPoblacion?.[String(a.nivel)], nivelMeta: a.nivel + 1, clases };
}

/** El interruptor de auto-construcción (va a la cabeza de la ventana Construcción desde que no hay Resumen; Víctor, 2026-11-02). */
export function htmlAutoConstruccion(a: Asentamiento): string {
  return `<label class="interruptor" title="Con ella encendida, la plaza pone sola en la cola lo que necesita">
      <input type="checkbox" id="chk-autoconstruccion"${a.autoConstruccionPausada ? '' : ' checked'} />
      <span class="interruptor-pista" aria-hidden="true"><i></i></span><span>🔨 Auto-construcción</span><small>${a.autoConstruccionPausada ? 'en pausa' : 'en marcha'}</small>
    </label>`;
}

// ---------------------------------------------------------------- Cargos

/** Los cargos que se están cambiando (combo a la vista): sobreviven a los repintados del sondeo hasta que se asigna o se cancela. */
const cargosEditando = new Set<string>();

const CARGOS: { clave: 'gobernadorId' | 'maestroObrasId' | 'tesoreroId' | 'maestroCaravanasId' | 'generalId' | 'sacerdoteId'; cargo: string; nombre: string; loNombraElRey: boolean }[] = [
  { clave: 'gobernadorId', cargo: 'gobernador', nombre: 'Gobernador', loNombraElRey: true },
  { clave: 'maestroObrasId', cargo: 'maestroObras', nombre: 'Maestro de Obras', loNombraElRey: false },
  { clave: 'tesoreroId', cargo: 'tesorero', nombre: 'Tesorero', loNombraElRey: false },
  { clave: 'maestroCaravanasId', cargo: 'maestroCaravanas', nombre: 'Maestro de Caravanas', loNombraElRey: false },
  { clave: 'generalId', cargo: 'general', nombre: 'General', loNombraElRey: false },
  { clave: 'sacerdoteId', cargo: 'sacerdote', nombre: 'Sacerdote', loNombraElRey: false },
];

/**
 * Cargos: una silla por cargo con su emblema y quien la ocupa (o «Vacante», en hueco). Quien puede nombrarlo (el Rey al Gobernador, el Gobernador al
 * resto) ve un lápiz: abre un combo con los ciudadanos (sin los mercenarios con marca) y ✓ lo asigna. Debajo, los residentes por participación.
 */
export function htmlCargosPlaza(c: ContextoPlaza, residentes: string): string {
  const { proyeccion: p, asentamiento: a, escapar: esc } = c;
  const faccion = p.facciones.find((f) => f.id === p.faccionId);
  const soyGobernador = a.cargos?.gobernadorId === p.heroeId;
  const soyRey = faccion?.reyId === p.heroeId;
  // Un mercenario con marca no recibe cargos (motor 7aa44b9).
  const ciudadanos = (faccion?.ciudadanosIds ?? []).filter((id) => !faccion?.miembros?.some((m) => m.heroeId === id && m.marca));
  const sillas = CARGOS.map(({ clave, cargo, nombre, loNombraElRey }) => {
    const puede = loNombraElRey ? soyRey : soyGobernador;
    const actual = a.cargos?.[clave] ?? null;
    const editando = puede && cargosEditando.has(cargo);
    const titular = editando
      ? `<select class="cargo-sel" aria-label="${esc(nombre)}">${ciudadanos.map((id) => `<option value="${esc(id)}"${id === actual ? ' selected' : ''}>${esc(nombreDeHeroe(p, id))}</option>`).join('')}</select>`
      : `<strong class="cargo-titular${actual ? '' : ' vacante'}">${actual ? esc(nombreDeHeroe(p, actual)) : 'Vacante'}</strong>`;
    const botones = !puede ? ''
      : editando
        ? '<span class="cargo-botones"><button class="cargo-boton ok" type="button" data-cargo-boton title="Asignar">✓</button><button class="cargo-boton" type="button" data-cargo-cancelar title="Cancelar">✕</button></span>'
        : `<button class="cargo-boton" type="button" data-cargo-boton title="${actual ? 'Cambiar' : 'Nombrar'} ${esc(nombre)}">${actual ? '✎' : '＋'}</button>`;
    return `<div class="cargo-silla${actual ? '' : ' vacante'}${actual === p.heroeId ? ' yo' : ''}${editando ? ' editando' : ''}" data-cargo="${cargo}">
      <span class="cargo-emblema" aria-hidden="true">${CARGO_EMBLEMA[cargo] ?? '•'}</span>
      <span class="cargo-cuerpo"><small>${esc(nombre)}</small>${titular}</span>${botones}
    </div>`;
  }).join('');
  const ocupados = CARGOS.filter(({ clave }) => a.cargos?.[clave]).length;
  return `<div class="obra-titulo"><span class="faction-kicker">Cargos de ${esc(a.nombre ?? a.id)}</span><span class="obra-chip${ocupados < CARGOS.length ? ' activa' : ''}">${ocupados}/${CARGOS.length}</span>${ayuda('plaza:cargos', 'El Rey nombra al Gobernador y el Gobernador, al resto. Pulsa el lápiz (o ＋ en una vacante) para elegir a un ciudadano y ✓ para nombrarlo.')}</div>
    <div class="cargos-rejilla">${sillas}</div>
    ${soyGobernador || soyRey ? '' : '<p class="asent-lado-nota">Solo el Rey (al Gobernador) y el Gobernador (al resto) pueden cambiar los cargos.</p>'}
    ${residentes}`;
}

export function cablearCargosPlaza(c: ContextoPlaza): void {
  const { cuerpo, asentamiento: a } = c;
  cuerpo.querySelectorAll<HTMLElement>('.cargo-silla').forEach((silla) => {
    const cargo = silla.dataset.cargo!;
    silla.querySelector('[data-cargo-cancelar]')?.addEventListener('click', () => { cargosEditando.delete(cargo); olvidarEdicion(cuerpo); c.refrescar(); });
    const boton = silla.querySelector<HTMLButtonElement>("[data-cargo-boton]");
    boton?.addEventListener('click', async () => {
      if (!cargosEditando.has(cargo)) { cargosEditando.add(cargo); c.refrescar(); cuerpo.querySelector<HTMLSelectElement>(`.cargo-silla[data-cargo="${cargo}"] select`)?.focus(); return; }
      const heroeId = silla.querySelector<HTMLSelectElement>('select')?.value;
      if (!heroeId) return;
      boton.disabled = true;
      const mensaje = await c.ejecutar('asignarCargoLocal', { asentamientoId: a.id, cargo, heroeId });
      if (mensaje) { boton.disabled = false; mostrarAviso(mensaje, true); return; }
      cargosEditando.delete(cargo);
      olvidarEdicion(cuerpo);
      c.refrescar();
    });
  });
}
