// VISTA DE LA CIUDAD (plaza): clic en un edificio del lienzo → ficha con su info y acciones; resaltado cruzado con la lista de edificios;
// producción en el tooltip; subpestañas «Recetas» (alternarReceta) e «Información» (glosario) de Centro urbano.
// Qué se puede hacer con UN edificio, según el backend (Doc 4 y comandos): mejorarlo (activo, Gobernador/Maestro de Obras) y quitarlo de la cola
// (en cola). NO hay pausa ni prioridad por edificio (la pausa existe por RECETA y la prioridad la fija el motor): no se inventan.
import type { ProyeccionJugador } from '../apiCliente';
import { nivelesDeEdificio } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { edificioBajoCursor, type SeleccionEdificio } from '../render';
import type { Asentamiento, Edificio } from '../tiposDominio';
import { textoEnTiempoReal } from './estadoCliente';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import type { Ejecutar } from './panelCarro';
import { renderPestanaInformacion } from './pestanaInformacion';
import { pintar } from './repintado';

type Escapar = (valor: string) => string;
type Cargo = 'gobernador' | 'maestroObras' | null;

let seleccion: SeleccionEdificio | null = null;
/** Lo que hay que rehacer al cambiar la selección (lienzo, lista y ficha): lo pone `cablearVistaCiudad`. */
let alCambiar: () => void = () => undefined;

export const edificioSeleccionado = (): SeleccionEdificio | null => seleccion;
export const tipoSeleccionado = (): string | null => seleccion?.tipo ?? null;

const internosDe = (a: Asentamiento): Edificio[] => (a.edificios ?? []).filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa');
const nombreDe = (tipo: string): string => EDIFICIO_NOMBRE[tipo] ?? tipo;
const fmt = (n: number): string => (n >= 10 ? Math.round(n).toString() : n.toFixed(1));

function cargoDe(a: Asentamiento, heroeId: string): Cargo {
  if (a.cargos?.gobernadorId === heroeId) return 'gobernador';
  if (a.cargos?.maestroObrasId === heroeId) return 'maestroObras';
  return null;
}

function adoptadasDe(p: ProyeccionJugador): string[] | null {
  const t = p.tecnologia as { propias?: { adoptadas?: string[] } | null } | undefined;
  return t?.propias?.adoptadas ?? (t ? [] : null);
}

const costeTexto = (coste: Record<string, number>, e: Escapar): string =>
  Object.entries(coste).map(([r, n]) => `${RECURSO_ICONO[r] ?? '📦'} ${n} ${e(RECURSO_NOMBRE[r] ?? r)}`).join(' · ');

/** La producción por minuto de UN edificio de ese tipo (la proyección la da por tipo: total y nº de activos; se reparte a partes iguales). */
function produccionDe(p: ProyeccionJugador, edificio: Edificio): { recurso: string; porMinuto: number; activos: number }[] {
  if (edificio.estado !== 'activo') return [];
  return (p.produccionDeAsentamiento ?? [])
    .filter((it) => it.tipo === edificio.tipo && it.cantidadPorMinuto > 0)
    .map((it) => ({ recurso: it.recurso, porMinuto: it.cantidadPorMinuto / Math.max(1, it.activos), activos: it.activos }));
}

const tieneRecetas = (e: Edificio): boolean => (nivelesDeEdificio(e.tipo)?.[String(e.nivelInterno ?? 1)]?.recetas.length ?? 0) > 0;

/** Lo que enseña el tooltip del lienzo: nombre, nivel, estado, notas y producción. */
export function htmlTooltipEdificio(p: ProyeccionJugador, edificio: Edificio, e: Escapar): string {
  const estado = edificio.estado === 'activo' ? 'Activo' : edificio.estado === 'en_construccion' ? 'En construcción' : 'En cola';
  const notas = [edificio.danado ? 'dañado (reconstrucción)' : null, edificio.pausadoPorAlmacenLleno ? 'parado — almacén lleno' : null].filter(Boolean).join(' · ');
  const prod = produccionDe(p, edificio)
    .map((x) => `<span>${RECURSO_ICONO[x.recurso] ?? '📦'} ${e(RECURSO_NOMBRE[x.recurso] ?? x.recurso)} · ${x.activos > 1 ? '≈ ' : ''}${fmt(x.porMinuto)}/min</span>`)
    .join('');
  // Necesita Backend: consumo por edificio (la proyección solo trae la producción).
  const consumo = edificio.estado === 'activo' && tieneRecetas(edificio) ? '<span>Consumo por edificio: no lo publica el servidor</span>' : '';
  return `<strong>${e(nombreDe(edificio.tipo))}</strong><span>Nivel ${edificio.nivelInterno ?? 1} · ${estado}</span>${notas ? `<span>${e(notas)}</span>` : ''}${prod}${consumo}`;
}

function htmlFicha(p: ProyeccionJugador, a: Asentamiento, edificio: Edificio, e: Escapar): string {
  const nivel = edificio.nivelInterno ?? 1;
  const cargo = cargoDe(a, p.heroeId);
  const niveles = nivelesDeEdificio(edificio.tipo);
  const estado = edificio.estado === 'activo' ? 'Activo' : edificio.estado === 'en_construccion' ? `En construcción · ${textoEnTiempoReal(Math.max(0, (edificio.completaEn ?? 0) - p.instante))}` : 'En cola';
  const notas = [edificio.danado ? 'dañado (reconstrucción)' : null, edificio.pausadoPorAlmacenLleno ? 'parado — almacén lleno' : null, edificio.mejora ? `mejorándose a N${edificio.mejora.nivelObjetivo} · ${textoEnTiempoReal(Math.max(0, edificio.mejora.completaEn - p.instante))}` : null].filter(Boolean);
  const prod = produccionDe(p, edificio)
    .map((x) => `<li>${RECURSO_ICONO[x.recurso] ?? '📦'} ${e(RECURSO_NOMBRE[x.recurso] ?? x.recurso)} · ${x.activos > 1 ? '≈ ' : ''}${fmt(x.porMinuto)}/min</li>`)
    .join('');
  const recetas = (niveles?.[String(nivel)]?.recetas ?? [])
    .map((r) => `<li>${e(RECURSO_NOMBRE[r.produce] ?? r.produce)}: ${costeTexto(r.consumePorUnidad, e) || 'sin insumos'} por unidad</li>`)
    .join('');

  // Mejorar: la misma orden que la lista (`mejorarEdificioAhora`); el coste sale del catálogo, los requisitos los valida el servidor.
  let acciones = '';
  if (edificio.tipo !== 'centroUrbano' && edificio.estado === 'activo' && !edificio.mejora && cargo) {
    const siguiente = niveles?.[String(nivel + 1)];
    acciones = siguiente
      ? `<button class="btn-primary" type="button" data-ficha-mejorar="${e(edificio.id)}">Mejorar a N${nivel + 1}</button>
         <p class="asent-lado-nota">Coste: ${costeTexto(siguiente.costoMejora ?? {}, e) || 'sin coste'}${siguiente.requisitoNivelAsentamiento ? ` · plaza nivel ${siguiente.requisitoNivelAsentamiento}` : ''}${siguiente.requiereEdificio ? ` · ${e(nombreDe(siguiente.requiereEdificio))} N${siguiente.requiereEdificioNivel ?? 1}` : ''}${siguiente.obraMinutos ? ` · obra de ${siguiente.obraMinutos} min` : ''}.</p>`
      : niveles ? '<p class="asent-lado-nota">Está en su nivel máximo.</p>' : '';
  } else if (edificio.estado === 'en_cola' && cargo) {
    acciones = `<button class="btn-secondary" type="button" data-ficha-quitar="${e(edificio.id)}">Quitar de la cola</button>`;
  } else if (!cargo) {
    acciones = '<p class="asent-lado-nota">Mejorar o quitar de la cola es cosa del Gobernador o del Maestro de Obras.</p>';
  }

  return `<div class="asent-lado-cabecera"><span class="faction-kicker">${e(nombreDe(edificio.tipo))}</span><button type="button" class="asent-ficha-cerrar" data-ficha-cerrar title="Cerrar">✕</button></div>
    <div class="asent-ficha-grid"><div><span>Nivel</span><strong>${nivel}</strong></div><div><span>Estado</span><strong>${e(estado)}</strong></div></div>
    ${notas.length ? `<p class="asent-lado-nota">${e(notas.join(' · '))}</p>` : ''}
    ${prod ? `<span class="faction-kicker">Producción</span><ul class="asent-ficha-lista">${prod}</ul>` : ''}
    ${recetas ? `<span class="faction-kicker">Recetas de este nivel</span><ul class="asent-ficha-lista">${recetas}</ul><p class="asent-lado-nota">Consumo por edificio: no lo publica el servidor.</p>` : ''}
    ${acciones}
    <p class="faction-error" role="alert" data-ficha-error></p>`;
}

let estadoSolicitado: (() => ProyeccionJugador | undefined) | null = null;

/** Elige un edificio por la lista: el primero del tipo o, si ya había uno de ese tipo elegido, el siguiente (así se recorren los de un tipo). */
function elegirTipo(tipo: string): void {
  const a = estadoSolicitado?.()?.asentamientos[0];
  if (!a) return;
  const lista = internosDe(a).filter((x) => x.tipo === tipo);
  if (lista.length === 0) return;
  const i = seleccion?.tipo === tipo ? lista.findIndex((x) => x.id === seleccion!.id) : -1;
  seleccion = { id: lista[(i + 1) % lista.length]!.id, tipo };
  alCambiar();
}
let fichaEl: HTMLElement | null = null;
let ejecutarFicha: Ejecutar | null = null;
let escaparFicha: Escapar = (s) => s;

/** Pinta (o esconde) la ficha según la selección y la proyección vigente. */
export function repintarFicha(): void {
  if (!fichaEl?.isConnected) return;
  const p = estadoSolicitado?.();
  const a = p?.asentamientos[0];
  const edificio = a && seleccion ? (a.edificios ?? []).find((x) => x.id === seleccion!.id) : undefined;
  if (!p || !a || !edificio) { seleccion = null; fichaEl.hidden = true; return; }
  fichaEl.hidden = false;
  pintar(fichaEl, htmlFicha(p, a, edificio, escaparFicha), () => {
    const error = fichaEl!.querySelector<HTMLElement>('[data-ficha-error]');
    const lanzar = async (tipo: string, params: object): Promise<void> => {
      const mensaje = await ejecutarFicha!(tipo, params);
      if (error) error.textContent = mensaje ?? '';
    };
    fichaEl!.querySelector('[data-ficha-cerrar]')?.addEventListener('click', () => { seleccion = null; alCambiar(); });
    fichaEl!.querySelector<HTMLElement>('[data-ficha-mejorar]')?.addEventListener('click', () => void lanzar('mejorarEdificioAhora', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id }));
    fichaEl!.querySelector<HTMLElement>('[data-ficha-quitar]')?.addEventListener('click', () => void lanzar('quitarDeCola', { asentamientoId: a.id, cargo: cargoDe(a, p.heroeId), edificioId: edificio.id }));
  }, 'ficha-edificio');
}

/** Cablea, una vez al montar la plaza, el clic sobre el lienzo, la ficha flotante y el clic en las filas de la lista de edificios. */
export function cablearVistaCiudad(
  contenedor: HTMLElement,
  o: { proyeccion: () => ProyeccionJugador | undefined; ejecutar: Ejecutar; escapar: Escapar; redibujar: () => void; repintarLista: () => void }
): void {
  const canvas = contenedor.querySelector<HTMLCanvasElement>('#mapa');
  const mapa = contenedor.querySelector<HTMLElement>('.asent-mapa');
  if (!canvas || !mapa) return;
  seleccion = null;
  estadoSolicitado = o.proyeccion;
  ejecutarFicha = o.ejecutar;
  escaparFicha = o.escapar;
  fichaEl = document.createElement('aside');
  fichaEl.className = 'asent-ficha';
  fichaEl.hidden = true;
  (contenedor.querySelector('.asent-izq') ?? mapa).appendChild(fichaEl);
  alCambiar = () => { o.redibujar(); o.repintarLista(); repintarFicha(); };

  canvas.addEventListener('click', (evento) => {
    const p = o.proyeccion();
    const a = p?.asentamientos[0];
    if (!p || !a) return;
    const e = edificioBajoCursor(canvas, evento, a, p.trazadoPorAsentamiento?.[a.id]);
    seleccion = e ? { id: e.id, tipo: e.tipo } : null;
    alCambiar();
  });
  canvas.style.cursor = 'pointer';
  contenedor.querySelector('.asent-edificios')?.addEventListener('click', (ev) => {
    const objetivo = ev.target as HTMLElement;
    if (objetivo.closest('button')) return;
    const fila = objetivo.closest<HTMLElement>('[data-fila-tipo]');
    if (fila?.dataset.filaTipo) elegirTipo(fila.dataset.filaTipo);
  });
}

// ---------------------------------------------------------------- Subpestaña «Recetas» (alternarReceta)

interface RecetaAgregada {
  produce: string;
  talleres: Map<string, number>;
  porMinuto: number;
  insumos: Record<string, number>;
  tecnologia?: string;
  edificioReq?: { tipo: string; nivel: number };
}

/** Las recetas que fabrican los talleres activos de la plaza, una por recurso producido (la pausa es por recurso y vale para todos los talleres). */
function recetasDe(a: Asentamiento, alCargar: () => void): RecetaAgregada[] {
  const porRecurso = new Map<string, RecetaAgregada>();
  for (const ed of internosDe(a)) {
    if (ed.estado !== 'activo') continue;
    for (const r of nivelesDeEdificio(ed.tipo, alCargar)?.[String(ed.nivelInterno ?? 1)]?.recetas ?? []) {
      const ag = porRecurso.get(r.produce) ?? { produce: r.produce, talleres: new Map(), porMinuto: 0, insumos: r.consumePorUnidad, tecnologia: r.requiereTecnologia, edificioReq: r.requiereEdificio };
      ag.talleres.set(ed.tipo, (ag.talleres.get(ed.tipo) ?? 0) + 1);
      ag.porMinuto += r.produccionBase;
      porRecurso.set(r.produce, ag);
    }
  }
  // Una receta parada cuyo taller ya no está sigue en la lista de pausadas: se deja a la vista para poder reanudarla.
  for (const r of a.recetasPausadas ?? []) if (!porRecurso.has(r)) porRecurso.set(r, { produce: r, talleres: new Map(), porMinuto: 0, insumos: {} });
  return [...porRecurso.values()].sort((x, y) => (RECURSO_NOMBRE[x.produce] ?? x.produce).localeCompare(RECURSO_NOMBRE[y.produce] ?? y.produce));
}

function htmlRecetas(c: ContextoPlaza): string {
  const e = c.escapar;
  const pausadas = new Set(c.asentamiento.recetasPausadas ?? []);
  const adoptadas = adoptadasDe(c.proyeccion);
  const filas = recetasDe(c.asentamiento, c.refrescar).map((r) => {
    const parada = pausadas.has(r.produce);
    const falta = adoptadas && r.tecnologia && !adoptadas.includes(r.tecnologia) ? `requiere la tecnología «${e(r.tecnologia)}»` : '';
    const talleres = [...r.talleres].map(([t, n]) => `${e(nombreDe(t))}${n > 1 ? ` ×${n}` : ''}`).join(', ');
    return `<div class="asent-edif-item receta${parada ? ' pausada' : ''}">
      <span class="asent-edif-nombre">${RECURSO_ICONO[r.produce] ?? '📦'} ${e(RECURSO_NOMBRE[r.produce] ?? r.produce)}</span>
      <span class="asent-edif-meta">${parada ? 'parada' : falta ? 'bloqueada' : 'en marcha'}</span>
      ${c.cargo ? `<button class="btn-secondary" type="button" data-receta="${e(r.produce)}" data-pausar="${parada ? '0' : '1'}">${parada ? 'Reanudar' : 'Parar'}</button>` : ''}
      <span class="asent-edif-nota">${talleres || 'sin taller activo'}${r.porMinuto ? ` · hasta ${fmt(r.porMinuto)}/min` : ''}${Object.keys(r.insumos).length ? ` · insumos por unidad: ${costeTexto(r.insumos, e)}` : ''}${falta ? ` · ${falta}` : ''}</span>
    </div>`;
  }).join('');
  return `<div class="asent-lado-cabecera"><span class="faction-kicker">Recetas</span></div>
    <div class="asent-edif-lista">${filas || '<p class="mapa-lista-vacia">Ningún taller activo con recetas.</p>'}</div>
    <p class="asent-lado-nota">Parar una receta la detiene en todos los talleres de la plaza.${c.cargo ? '' : ' Solo el Gobernador o el Maestro de Obras pueden cambiarlo.'}</p>`;
}

function cablearRecetas(c: ContextoPlaza): void {
  c.cuerpo.querySelectorAll<HTMLButtonElement>('[data-receta]').forEach((b) => b.addEventListener('click', async () => {
    const mensaje = await c.ejecutar('alternarReceta', { asentamientoId: c.asentamiento.id, recurso: b.dataset.receta, pausada: b.dataset.pausar === '1' });
    const error = c.cuerpo.querySelector<HTMLElement>('#asent-lado-error');
    if (error) error.textContent = mensaje ?? '';
  }));
}

export const SUBPESTANA_RECETAS: SubpestanaPlaza = { id: 'recetas', etiqueta: 'Recetas', html: htmlRecetas, cablear: cablearRecetas };
export const SUBPESTANA_INFORMACION: SubpestanaPlaza = { id: 'informacion', etiqueta: 'Información', html: () => renderPestanaInformacion() };
