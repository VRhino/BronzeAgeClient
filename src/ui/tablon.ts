// El tablón de misiones recurrentes (mecánica 55) de una plaza o de una Facción: 7 diarias y 7 semanales. Las individuales las acepta cada
// héroe del ámbito (residente de la plaza, ciudadano de la Facción) y cuentan desde entonces; las grupales cuentan lo de todos. Lo cumplido se
// reclama con `reclamarRecompensa` y el `duenoId` del tablón, aunque haya vencido el periodo. El Gobernador o el Rey eligen lo de la semana que viene.
import type { ProyeccionJugador } from '../apiCliente';
import type { CondicionRecurrente, DefinicionRecurrente, EstadoRecurrente, MisionRecurrente, Tablon } from '../tiposDominio';
import { ayuda } from './ayuda';
import { textoEnTiempoReal } from './estadoCliente';
import { nombreDeContador } from './misiones';
import { nombreDeHeroe } from './nombres';
import { cablearPlegables, plegable } from './plegable';
import type { SubpestanaPlaza } from './ganchos';

type Escapar = (s: string) => string;
type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

/** De quién es el tablón: una plaza (`as-N`) o una Facción (`f-N`). */
export interface DuenoTablon { tipo: 'plaza' | 'faccion'; id: string; tablon: Tablon }

/** Lo que se puede elegir a la vez de cada duración. */
const MAX_ELEGIDAS = 7;

const CARGO_NOMBRE: Record<string, string> = {
  rey: 'Rey', embajador: 'Embajador', gobernador: 'Gobernador', maestroObras: 'Maestro de Obras', tesorero: 'Tesorero', general: 'General', sacerdote: 'Sacerdote',
};
const ESTADO_TEXTO: Record<EstadoRecurrente, string> = { en_curso: 'en curso', cumplida: '¡Cumplida!', reclamada: 'reclamada', caducada: 'caducada' };

/** Lo que el jugador va marcando para la semana que viene, por tablón, hasta que lo guarda. */
const borradores = new Map<string, { diaria: Set<string>; semanal: Set<string> }>();

/** ¿Eres quien elige (Gobernador de la plaza, Rey de la Facción)? */
function eligesTu(p: ProyeccionJugador, d: DuenoTablon): boolean {
  if (d.tipo === 'faccion') return p.facciones.find((f) => f.id === d.id)?.reyId === p.heroeId;
  return p.asentamientos.find((a) => a.id === d.id)?.cargos?.gobernadorId === p.heroeId;
}

/** ¿Reclamas tú las grupales? El Rey en la Facción; en la plaza, el Gobernador o, sin él, un residente. */
function reclamasGrupal(p: ProyeccionJugador, d: DuenoTablon): boolean {
  if (d.tipo === 'faccion') return eligesTu(p, d);
  const a = p.asentamientos.find((x) => x.id === d.id);
  if (!a) return false;
  const gobernador = a.cargos?.gobernadorId;
  if (gobernador) return gobernador === p.heroeId;
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** Tus cargos (para las misiones que solo acepta el titular de uno). */
function misCargos(p: ProyeccionJugador, d: DuenoTablon): Set<string> {
  const f = p.facciones.find((x) => x.id === p.faccionId);
  const r = new Set<string>();
  if (f?.reyId === p.heroeId) r.add('rey');
  if (f?.embajadorId === p.heroeId) r.add('embajador');
  const c = d.tipo === 'plaza' ? p.asentamientos.find((a) => a.id === d.id)?.cargos : undefined;
  for (const [k, id] of Object.entries(c ?? {})) if (id === p.heroeId) r.add(k.replace(/Id$/, ''));
  return r;
}

function recompensa(x: DefinicionRecurrente): string {
  const partes: string[] = [];
  if (x.experiencia > 0) partes.push(`${Math.round(x.experiencia)} XP de Facción`);
  if (x.participacion > 0) partes.push(`${x.participacion} de participación`);
  if (x.oro > 0) partes.push(`${Math.round(x.oro)} oro`);
  return partes.join(', ') || 'sin recompensa';
}

function barras(cs: CondicionRecurrente[], e: Escapar): string {
  return cs.map((c) => {
    const k = c.umbral > 0 ? Math.min(1, c.avance / c.umbral) : 1;
    return `<div class="mision-cond"><div class="mision-barra"><span style="width:${Math.round(k * 100)}%"></span></div><small>${Math.min(c.avance, c.umbral)} / ${c.umbral} ${e(nombreDeContador(c.contador))}</small></div>`;
  }).join('');
}

function tarjeta(p: ProyeccionJugador, d: DuenoTablon, m: MisionRecurrente, e: Escapar): string {
  const x = m.definicion;
  const vencida = m.hasta <= p.instante;
  const mia = m.aceptaciones.find((a) => a.heroeId === p.heroeId);
  const estado = x.tipo === 'grupal' ? m.estado : mia?.estado;
  const meta = [
    x.tipo === 'grupal' ? 'grupal' : `individual · ${m.aceptadasSemana}/${x.limiteSemanal} esta semana`,
    ...(x.cargo ? [`solo ${CARGO_NOMBRE[x.cargo] ?? x.cargo}`] : []),
  ].join(' · ');
  let accion = '';
  if (estado === 'cumplida') {
    accion = x.tipo === 'individual' || reclamasGrupal(p, d)
      ? `<button class="btn-primary" type="button" data-tablon-reclamar="${e(x.id)}">Reclamar ${e(recompensa(x))}</button>`
      : `<small class="asent-lado-nota">${d.tipo === 'faccion' ? 'La reclama el Rey.' : 'La reclama el Gobernador (o un residente si no hay).'}</small>`;
  } else if (x.tipo === 'individual' && !mia && !vencida) {
    const tope = x.limiteSemanal > 0 && m.aceptadasSemana >= x.limiteSemanal;
    const sinCargo = x.cargo !== undefined && !misCargos(p, d).has(x.cargo);
    const motivo = tope ? 'Ya se aceptó todas las veces que permite esta semana.' : sinCargo ? `Solo la acepta el ${CARGO_NOMBRE[x.cargo!] ?? x.cargo}.` : '';
    accion = `<button class="btn-secondary" type="button" data-tablon-aceptar="${e(x.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Aceptar</button>`;
  }
  const avance = x.tipo === 'grupal' ? m.condiciones : mia?.condiciones ?? [];
  const aportes = Object.entries(m.aportes).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a);
  return `<div class="mision${estado === 'cumplida' ? ' mision-cumplida' : estado === 'reclamada' || estado === 'caducada' ? ' mision-reclamada' : ''}">
    <div class="mision-cab"><strong>${e(x.titulo || x.id)}</strong><span class="mision-premio">${estado ? `${e(ESTADO_TEXTO[estado])} · ` : ''}${e(recompensa(x))}</span></div>
    <p class="mision-texto">${e(x.texto)}${vencida ? ' <em>(periodo acabado)</em>' : ''}</p>
    <p class="tablon-meta">${e(meta)}</p>
    ${x.explicacion ? `<details class="mision-explicacion"><summary>Más</summary><p>${e(x.explicacion)}</p></details>` : ''}
    ${estado === 'en_curso' ? barras(avance, e) : ''}
    ${x.tipo === 'grupal' && aportes.length ? `<p class="tablon-meta">Aportan: ${aportes.map(([id, n]) => `${e(nombreDeHeroe(p, id))} (${n})`).join(', ')}</p>` : ''}
    ${accion ? `<div class="mision-acciones">${accion}</div>` : ''}
    <p class="faction-error" data-tablon-error="${e(x.id)}" role="alert"></p>
  </div>`;
}

function columna(p: ProyeccionJugador, d: DuenoTablon, duracion: 'diaria' | 'semanal', e: Escapar): string {
  const t = d.tablon;
  const misiones = t.misiones.filter((m) => m.definicion.duracion === duracion)
    .sort((a, b) => Number(a.hasta <= p.instante) - Number(b.hasta <= p.instante));
  const renueva = duracion === 'diaria' ? t.renovacionDiaria : t.renovacionSemanal;
  return `<div class="tablon-columna">
    <div class="tablon-cab"><strong>${duracion === 'diaria' ? 'Diarias' : 'Semanales'}</strong><small>se renuevan en ${e(textoEnTiempoReal(renueva - p.instante))}</small></div>
    ${misiones.length ? misiones.map((m) => tarjeta(p, d, m, e)).join('') : '<p class="mapa-lista-vacia">Ninguna ahora.</p>'}
  </div>`;
}

function elegir(p: ProyeccionJugador, d: DuenoTablon, e: Escapar): string {
  const t = d.tablon;
  const b = borradores.get(d.id) ?? {
    diaria: new Set(t.conEleccion ? t.elegidasDiariasIds : t.diariasIds),
    semanal: new Set(t.conEleccion ? t.elegidasSemanalesIds : t.semanalesIds),
  };
  const lista = (duracion: 'diaria' | 'semanal') => {
    const marcadas = b[duracion];
    const del = t.catalogo.filter((x) => x.duracion === duracion);
    return `<fieldset class="tablon-elegir"><legend>${duracion === 'diaria' ? 'Diarias' : 'Semanales'} (${marcadas.size}/${MAX_ELEGIDAS})</legend>
      ${del.map((x) => {
        const on = marcadas.has(x.id);
        return `<label title="${e(x.texto)}"><input type="checkbox" data-tablon-elegir="${duracion}" value="${e(x.id)}"${on ? ' checked' : ''}${!on && marcadas.size >= MAX_ELEGIDAS ? ' disabled' : ''}> ${e(x.titulo || x.id)} <small>· ${x.tipo}${x.cargo ? ` · ${e(CARGO_NOMBRE[x.cargo] ?? x.cargo)}` : ''} · ${e(recompensa(x))}</small></label>`;
      }).join('') || '<p class="mapa-lista-vacia">El catálogo no tiene ninguna.</p>'}</fieldset>`;
  };
  const cuerpo = `<p class="asent-lado-nota">Lo que elijas sale desde la próxima renovación semanal (en ${e(textoEnTiempoReal(t.renovacionSemanal - p.instante))}); hasta ${MAX_ELEGIDAS} de cada. ${t.conEleccion ? '' : 'Sin elección, salen las primeras del catálogo.'}</p>
    ${lista('diaria')}${lista('semanal')}
    <div class="mision-acciones"><button class="btn-primary" type="button" data-tablon-guardar>Guardar la elección</button></div>
    <p class="faction-error" data-tablon-error="elegir" role="alert"></p>`;
  return plegable(`tablon:elegir:${d.id}`, '<span class="plegable-titulo">Elegir las de la semana que viene</span>', cuerpo);
}

/** El tablón entero: las dos columnas y, para quien elige, la elección de la semana que viene. */
export function htmlTablon(p: ProyeccionJugador, d: DuenoTablon, e: Escapar): string {
  return `<div class="tablon" data-tablon-dueno="${e(d.id)}" data-tablon-tipo="${d.tipo}">
    <p class="asent-lado-nota">Misiones que vuelven cada día y cada semana.${ayuda(`tablon:${d.tipo}`, d.tipo === 'plaza'
      ? 'Las individuales las acepta cada residente y cuentan desde que la aceptas; las grupales cuentan lo de todos los residentes. Dan experiencia a la Facción, participación en la plaza y, algunas, oro a tu almacén personal. Lo cumplido se reclama aunque haya pasado el día.'
      : 'Las individuales las acepta cada ciudadano y cuentan desde que la aceptas; las grupales cuentan lo de toda la Facción. Lo cumplido se reclama aunque haya pasado el periodo; las grupales las reclama el Rey.')}</p>
    <div class="tablon-columnas">${columna(p, d, 'diaria', e)}${columna(p, d, 'semanal', e)}</div>
    ${eligesTu(p, d) && d.tablon.catalogo.length ? elegir(p, d, e) : ''}
  </div>`;
}

/** Aceptar, reclamar y elegir dentro de `raiz` (donde se pintó `htmlTablon`). */
export function cablearTablon(raiz: HTMLElement, ejecutar: Ejecutar, repintar: () => void): void {
  cablearPlegables(raiz);
  raiz.querySelectorAll<HTMLElement>('[data-tablon-dueno]').forEach((t) => {
    const duenoId = t.dataset.tablonDueno!;
    const error = (id: string, texto: string | null) => {
      const el = t.querySelector<HTMLElement>(`[data-tablon-error="${id}"]`);
      if (el) el.textContent = texto ?? '';
    };
    const accion = (selector: string, orden: string) => t.querySelectorAll<HTMLButtonElement>(`[${selector}]`).forEach((b) => b.addEventListener('click', async () => {
      const misionId = b.getAttribute(selector)!;
      b.disabled = true;
      const r = await ejecutar(orden, { duenoId, misionId });
      b.disabled = false;
      error(misionId, r);
    }));
    accion('data-tablon-aceptar', 'aceptarMision');
    accion('data-tablon-reclamar', 'reclamarRecompensa');
    t.querySelectorAll<HTMLInputElement>('[data-tablon-elegir]').forEach((c) => c.addEventListener('change', () => {
      const actual = borradores.get(duenoId) ?? {
        diaria: new Set(Array.from(t.querySelectorAll<HTMLInputElement>('[data-tablon-elegir="diaria"]:checked')).map((x) => x.value)),
        semanal: new Set(Array.from(t.querySelectorAll<HTMLInputElement>('[data-tablon-elegir="semanal"]:checked')).map((x) => x.value)),
      };
      const conjunto = actual[c.dataset.tablonElegir as 'diaria' | 'semanal'];
      if (c.checked) conjunto.add(c.value); else conjunto.delete(c.value);
      borradores.set(duenoId, actual);
      repintar();
    }));
    t.querySelector<HTMLButtonElement>('[data-tablon-guardar]')?.addEventListener('click', async (ev) => {
      const b = ev.currentTarget as HTMLButtonElement;
      const marcadas = (duracion: string) => Array.from(t.querySelectorAll<HTMLInputElement>(`[data-tablon-elegir="${duracion}"]:checked`)).map((x) => x.value);
      b.disabled = true;
      const r = await ejecutar('elegirTablon', { duenoId, diariasIds: marcadas('diaria'), semanalesIds: marcadas('semanal') });
      b.disabled = false;
      if (r === null) borradores.delete(duenoId);
      error('elegir', r);
    });
  });
}

/** «Tablón» en el Centro urbano: el de la plaza (solo viaja desde dentro). */
export const SUBPESTANA_TABLON: SubpestanaPlaza = {
  id: 'tablon',
  etiqueta: 'Tablón',
  visible: (c) => Boolean(c.asentamiento.tablon),
  html: (c) => (c.asentamiento.tablon ? htmlTablon(c.proyeccion, { tipo: 'plaza', id: c.asentamiento.id, tablon: c.asentamiento.tablon }, c.escapar) : ''),
  cablear: (c) => cablearTablon(c.cuerpo, c.ejecutar, c.refrescar),
};
