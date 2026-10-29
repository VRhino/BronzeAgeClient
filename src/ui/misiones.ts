// MISIONES (motor f859ef5, `Docs/Mechanics/Misiones.md`; diseño en el doc «Interfaz de misiones del cliente de jugador», 2026-10-27).
// Tres dueños: el héroe, la plaza donde estás dentro y tu Facción. No se aceptan: el motor activa cada una al cumplirse su previa, y las
// siguientes son sorpresa (no se enseñan antes). Lo que el jugador «acepta» es SEGUIRLA: fijarla en el rastreador (3 como mucho), que se
// guarda en este navegador por partida y héroe. Cumplir no da la recompensa: se pide con `reclamarRecompensa { duenoId, misionId }`.
//   ventana   el botón «Misiones» de la barra: una ventana centrada como el diario de WoW, con los nombres a la izquierda (Mías · Mi plaza ·
//             Mi Facción) y la misión abierta a la derecha, con sus botones abajo; la barra lleva una insignia de las que puedes reclamar
//   plaza     la subpestaña «Misiones» del Centro urbano (`SUBPESTANA_MISIONES`, en `ganchos.ts`)
//   Facción   la lista de la Facción al pie de su pestaña
//   rastreador las seguidas, arriba a la derecha en el mundo y al principio de la columna izquierda en la plaza y el campamento
import { textosDeMisiones, type ProyeccionJugador } from '../apiCliente';
import type { Mision } from '../tiposDominio';
import { RECURSO_NOMBRE } from '../paletas';
import { estadoCliente } from './estadoCliente';
import { ayuda } from './ayuda';
import type { Ejecutar } from './panelCarro';
import type { SubpestanaPlaza } from './ganchos';

type Escapar = (valor: string) => string;
export type DuenoMision = 'heroe' | 'plaza' | 'faccion';

/** Lo que se sigue como mucho a la vez (decisión de Víctor del 2026-10-27). */
const MAX_SEGUIDAS = 3;

/** Textos de reserva mientras el motor no publique su catálogo en `GET /v1/datos` (pedido el 2026-10-27; allí mandan los suyos). */
const TEXTOS: Record<string, { titulo: string; texto: string }> = {
  H1: { titulo: 'Primeros pasos', texto: 'Sal al mundo desde tu plaza o tu campamento.' },
  H2: { titulo: 'Tropa de préstamo', texto: 'Pide tropa prestada en un campamento de mercenarios.' },
  H3: { titulo: 'Hasta el final del camino', texto: 'Marcha y llega a tu destino.' },
  H4: { titulo: 'Repostar', texto: 'Rellena los víveres de tu columna en una plaza, una avanzada o un campamento.' },
  H5: { titulo: 'Ciudadano', texto: 'Entra en una Facción.' },
  H6: { titulo: 'Tu primera escuadra', texto: 'Recluta una escuadra nueva.' },
  H7: { titulo: 'Un ejército de verdad', texto: 'Recluta 50 de infantería, 25 de tiro y 10 de caballería.' },
  H8: { titulo: 'Juntos', texto: 'Únete a un ejército o a una convocatoria.' },
  H9: { titulo: 'Bautismo de fuego', texto: 'Combate en una batalla.' },
  H10: { titulo: 'Limpieza de caminos', texto: 'Destruye un campamento de bandidos.' },
  H11: { titulo: 'Tesoro escondido', texto: 'Abre un alijo.' },
  H12: { titulo: 'Manos a la obra', texto: 'Entrega materiales a la obra de un pueblo o de una avanzada.' },
  H13: { titulo: 'Forjar al héroe', texto: 'Reparte tus puntos de atributo.' },
  A1: { titulo: 'La aldea', texto: 'Funda una aldea agrícola.' },
  A2: { titulo: 'Abrir el mercado', texto: 'Ten un Mercado activo.' },
  A3: { titulo: 'Primer barracón', texto: 'Ten un Barracón activo.' },
  A4: { titulo: 'Crecer', texto: 'Sube la plaza a nivel 2.' },
  A5: { titulo: 'El primer pueblo', texto: 'Completa un pueblo.' },
  A6: { titulo: 'Oficios', texto: 'Ten algún artesano.' },
  A7: { titulo: 'Murallas', texto: 'Completa un recinto de la muralla.' },
  A8: { titulo: 'Avanzada', texto: 'Completa una avanzada.' },
  A9: { titulo: 'Ciudad', texto: 'Sube la plaza a nivel 3.' },
  A10: { titulo: 'Nobleza', texto: 'Ten algún noble.' },
  A11: { titulo: 'Resistir', texto: 'Resiste un asedio.' },
  F1: { titulo: 'Una capital', texto: 'Funda la primera plaza de tu Facción.' },
  F2: { titulo: 'Repartir cargos', texto: 'Nombra un Embajador o un cargo local.' },
  F3: { titulo: 'Expansión', texto: 'Funda 2 plazas.' },
  F4: { titulo: 'Un reino', texto: 'Funda 5 plazas.' },
  F5: { titulo: 'Progreso', texto: 'Adopta una tecnología.' },
  F6: { titulo: 'Gobernar', texto: 'Activa una política.' },
  F7: { titulo: 'Comercio', texto: 'Cumple un trueque con otra Facción.' },
  F8: { titulo: 'Rutas comerciales', texto: 'Cumple 5 trueques.' },
  F9: { titulo: 'Aliados', texto: 'Acepta una alianza.' },
  F10: { titulo: 'Paz en la región', texto: 'Destruid 5 campamentos de bandidos.' },
  F11: { titulo: 'Conquista', texto: 'Conquista una plaza.' },
  F12: { titulo: 'Cantares', texto: 'Empieza una épica.' },
};

/** Cómo se lee cada contador bajo su barra («12 / 50 infantería»). */
const CONTADOR: Record<string, string> = {
  salidas: 'salidas', prestamos: 'préstamos', llegadas: 'llegadas', repostajes: 'repostajes', ciudadania: 'Facción', escuadrones: 'escuadras nuevas',
  infanteria: 'infantería', tiro: 'tiro', caballeria: 'caballería', uniones: 'uniones', batallas: 'batallas', bandidos: 'campamentos de bandidos',
  alijos: 'alijos', entregas: 'entregas', atributos: 'repartos de atributos', mercado: 'Mercado', barracon: 'Barracón', nivel: 'nivel', pueblos: 'pueblos',
  artesanos: 'artesanos', nobles: 'nobles', recintos: 'recintos', avanzadas: 'avanzadas', asedios: 'asedios resistidos', aldeas: 'aldeas', capital: 'capital',
  cargos: 'cargos', fundaciones: 'fundaciones', tecnologias: 'tecnologías', politicas: 'políticas', trueques: 'trueques', aliados: 'alianzas',
  conquistas: 'conquistas', epicas: 'épicas',
};

/** Título y texto de una misión: los del motor (catálogo de `GET /v1/datos`) si ya los publica, si no los de reserva. */
export function textoDeMision(id: string): { titulo: string; texto: string; explicacion?: string } {
  const delMotor = textosDeMisiones(() => estadoCliente.proyeccionUltima && alCambiar?.());
  return delMotor?.misiones[id] ?? TEXTOS[id] ?? { titulo: id, texto: '' };
}

/** El nombre de un contador bajo su barra: el del motor si ya lo publica, si no el de reserva. */
export function nombreDeContador(c: string): string {
  return textosDeMisiones()?.contadores[c] ?? CONTADOR[c] ?? c;
}

const PESTANAS: [DuenoMision, string][] = [['heroe', 'Mías'], ['plaza', 'Mi plaza'], ['faccion', 'Mi Facción']];
let alCambiar: (() => void) | undefined;

/** Las misiones visibles de un dueño, y su id de dueño para reclamar (`undefined` si ahora no se ve ese dueño). */
function delDueno(p: ProyeccionJugador, d: DuenoMision): { misiones: Mision[]; duenoId?: string } {
  const m = p.misiones;
  if (d === 'heroe') return { misiones: m?.heroe ?? [], duenoId: p.heroeId };
  if (d === 'plaza') return { misiones: m?.plaza ?? [], duenoId: m?.plazaId };
  return { misiones: m?.faccion ?? [], duenoId: p.faccionId ?? undefined };
}

/** Quién reclama (Misiones §4): las tuyas, tú; las de una plaza, su Gobernador o, sin Gobernador, un residente; las de la Facción, su Rey. */
function quienReclama(p: ProyeccionJugador, d: DuenoMision): string | null {
  if (d === 'heroe') return null;
  if (d === 'faccion') return p.facciones.find((f) => f.id === p.faccionId)?.reyId === p.heroeId ? null : 'La reclama el Rey de tu Facción.';
  const a = p.asentamientos.find((x) => x.id === p.misiones?.plazaId);
  if (!a) return 'La reclama el Gobernador de la plaza.';
  const gobernador = a.cargos?.gobernadorId;
  if (gobernador) return gobernador === p.heroeId ? null : 'La reclama el Gobernador de la plaza.';
  const reside = [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
  return reside ? null : 'Sin Gobernador, la reclama un residente de la plaza.';
}

/** Las cumplidas que tú puedes reclamar ya (la insignia del botón Misiones). */
export function misionesPorReclamar(p: ProyeccionJugador): number {
  return PESTANAS.reduce((n, [d]) => n + (quienReclama(p, d) ? 0 : delDueno(p, d).misiones.filter((m) => m.estado === 'cumplida').length), 0);
}

function recompensa(m: Mision): string {
  const partes = Object.entries(m.recompensa).filter(([, n]) => n > 0).map(([r, n]) => `${Math.round(n)} ${r === 'oro' ? 'oro' : (RECURSO_NOMBRE[r] ?? r).toLowerCase()}`);
  if (m.recompensaExperiencia > 0) partes.push(`${Math.round(m.recompensaExperiencia)} XP de Facción`);
  return partes.join(', ') || 'sin recompensa';
}

function barras(m: Mision, e: Escapar, fino = false): string {
  return m.condiciones.map((c) => {
    const k = c.umbral > 0 ? Math.min(1, c.avance / c.umbral) : 1;
    return `<div class="mision-cond${fino ? ' fino' : ''}"><div class="mision-barra"><span style="width:${Math.round(k * 100)}%"></span></div>${fino ? '' : `<small>${Math.min(c.avance, c.umbral)} / ${c.umbral} ${e(nombreDeContador(c.contador))}</small>`}</div>`;
  }).join('');
}

// ---------------------------------------------------------------- seguir (en este navegador, por partida y héroe)

interface Seguimiento { seguidas: string[]; conocidas: string[]; nuevas: string[]; plegado: boolean }
let seguimiento: Seguimiento | null = null;
let claveSeguimiento = '';
const claveDe = (d: DuenoMision, id: string): string => `${d}:${id}`;

function cargarSeguimiento(p: ProyeccionJugador): Seguimiento | null {
  const clave = `bac_misiones_${estadoCliente.gameIdActivo}_${p.heroeId}`;
  if (clave === claveSeguimiento && seguimiento) return seguimiento;
  claveSeguimiento = clave;
  try {
    seguimiento = JSON.parse(localStorage.getItem(clave) ?? 'null') as Seguimiento | null;
  } catch {
    seguimiento = null;
  }
  return seguimiento;
}

function guardarSeguimiento(): void {
  try { localStorage.setItem(claveSeguimiento, JSON.stringify(seguimiento)); } catch { /* sin almacenamiento: dura lo que la pestaña */ }
}

/**
 * Tras cada proyección: lo que aparece nuevo se avisa y se marca «nueva»; las tuyas entran solas en el rastreador mientras haya hueco. La
 * primera vez (héroe nuevo o navegador nuevo) no avisa de nada: sigue las tuyas que ya están en marcha (H1 y H13 al empezar).
 */
export function actualizarSeguimiento(p: ProyeccionJugador, avisar: (texto: string) => void): void {
  const previo = cargarSeguimiento(p);
  const vivas = PESTANAS.flatMap(([d]) => delDueno(p, d).misiones.filter((m) => m.estado !== 'reclamada').map((m) => ({ d, m })));
  if (!previo) {
    seguimiento = { seguidas: vivas.filter((x) => x.d === 'heroe').slice(0, MAX_SEGUIDAS).map((x) => claveDe(x.d, x.m.id)), conocidas: vivas.map((x) => claveDe(x.d, x.m.id)), nuevas: [], plegado: false };
    guardarSeguimiento();
    return;
  }
  let cambio = false;
  for (const { d, m } of vivas) {
    const k = claveDe(d, m.id);
    if (previo.conocidas.includes(k)) continue;
    previo.conocidas.push(k);
    previo.nuevas.push(k);
    if (d === 'heroe' && previo.seguidas.length < MAX_SEGUIDAS) previo.seguidas.push(k);
    avisar(`Nueva misión: ${textoDeMision(m.id).titulo}`);
    cambio = true;
  }
  // Las reclamadas salen del rastreador (las de una plaza que ya no se ve se quedan: siguen siendo tuyas).
  const reclamadas = new Set(PESTANAS.flatMap(([d]) => delDueno(p, d).misiones.filter((m) => m.estado === 'reclamada').map((m) => claveDe(d, m.id))));
  const antes = previo.seguidas.length;
  previo.seguidas = previo.seguidas.filter((k) => !reclamadas.has(k));
  if (cambio || previo.seguidas.length !== antes) guardarSeguimiento();
}

// ---------------------------------------------------------------- tarjetas y listas

function tarjeta(p: ProyeccionJugador, d: DuenoMision, m: Mision, e: Escapar): string {
  const t = textoDeMision(m.id);
  const k = claveDe(d, m.id);
  const s = cargarSeguimiento(p);
  const seguida = s?.seguidas.includes(k) ?? false;
  const nueva = s?.nuevas.includes(k) ?? false;
  const otro = quienReclama(p, d);
  const reclamar = m.estado !== 'cumplida' ? '' : otro
    ? `<small class="asent-lado-nota">${e(otro)}</small>`
    : `<button class="btn-primary" type="button" data-mision-reclamar="${e(m.id)}" data-dueno="${d}">Reclamar ${e(recompensa(m))}</button>`;
  const seguir = m.estado === 'reclamada' ? ''
    : `<button class="btn-secondary" type="button" data-mision-seguir="${e(k)}"${!seguida && (s?.seguidas.length ?? 0) >= MAX_SEGUIDAS ? ` disabled title="Ya sigues ${MAX_SEGUIDAS}: deja de seguir alguna"` : ''}>${seguida ? 'Dejar de seguir' : 'Seguir'}</button>`;
  return `<div class="mision mision-${m.estado}" data-mision="${e(k)}">
    <div class="mision-cab"><strong>${e(t.titulo)}</strong>${nueva ? '<span class="mision-nueva">nueva</span>' : ''}<span class="mision-premio">${m.estado === 'cumplida' ? '¡Cumplida! ' : ''}${e(recompensa(m))}</span></div>
    ${t.texto ? `<p class="mision-texto">${e(t.texto)}</p>` : ''}
    ${t.explicacion ? `<details class="mision-explicacion"><summary>Más</summary><p>${e(t.explicacion)}</p></details>` : ''}
    ${m.estado === 'activa' ? barras(m, e) : ''}
    ${reclamar || seguir ? `<div class="mision-acciones">${reclamar}${seguir}</div>` : ''}
    <p class="faction-error" data-mision-error="${e(m.id)}" role="alert"></p>
  </div>`;
}

/** La lista de un dueño: primero las cumplidas por reclamar, luego las activas y, plegadas al final, las reclamadas. */
export function htmlListaMisiones(p: ProyeccionJugador, d: DuenoMision, e: Escapar): string {
  const { misiones, duenoId } = delDueno(p, d);
  if (!duenoId) return `<p class="mapa-lista-vacia">${d === 'plaza' ? 'Las misiones de una plaza solo se ven estando dentro de ella.' : 'Sin Facción no hay misiones de Facción.'}</p>`;
  const de = (estado: Mision['estado']): Mision[] => misiones.filter((m) => m.estado === estado);
  const hechas = de('reclamada');
  const vivas = [...de('cumplida'), ...de('activa')];
  return `${vivas.length ? vivas.map((m) => tarjeta(p, d, m, e)).join('') : '<p class="mapa-lista-vacia">Ninguna en marcha ahora.</p>'}
    ${hechas.length ? `<details class="misiones-hechas"><summary>Hechas: ${hechas.length}</summary>${hechas.map((m) => `<div class="mision mision-reclamada"><div class="mision-cab"><strong>${e(textoDeMision(m.id).titulo)}</strong><span class="mision-premio">${e(recompensa(m))}</span></div></div>`).join('')}</details>` : ''}`;
}

// ---------------------------------------------------------------- la ventana (como el diario de misiones de WoW)

/** La misión abierta en la ventana (`dueño:id`); `null` = la primera que haya. Vive entre repintados. */
let seleccionada: string | null = null;

/** Las misiones de la ventana en el orden de su lista: por dueño, primero las cumplidas, luego las activas; las hechas, aparte. */
function entradas(p: ProyeccionJugador): { d: DuenoMision; m: Mision }[] {
  return PESTANAS.flatMap(([d]) => {
    const ms = delDueno(p, d).misiones;
    return [...ms.filter((m) => m.estado === 'cumplida'), ...ms.filter((m) => m.estado === 'activa'), ...ms.filter((m) => m.estado === 'reclamada')].map((m) => ({ d, m }));
  });
}

function elegida(p: ProyeccionJugador): { d: DuenoMision; m: Mision } | undefined {
  const todas = entradas(p);
  return todas.find((x) => claveDe(x.d, x.m.id) === seleccionada) ?? todas.find((x) => x.m.estado !== 'reclamada') ?? todas[0];
}

/** Las recompensas en etiquetas, como la parte «Recompensas» del diario. */
function htmlRecompensas(m: Mision, e: Escapar): string {
  const r = Object.entries(m.recompensa).filter(([, n]) => n > 0).map(([k, n]) => `<span class="diario-premio${k === 'oro' ? ' oro' : ''}"><strong>${Math.round(n)}</strong> ${e(k === 'oro' ? 'oro' : (RECURSO_NOMBRE[k] ?? k).toLowerCase())}</span>`);
  if (m.recompensaExperiencia > 0) r.push(`<span class="diario-premio xp"><strong>${Math.round(m.recompensaExperiencia)}</strong> XP de Facción</span>`);
  return r.join('') || '<span class="diario-premio">Sin recompensa</span>';
}

/** La columna de la izquierda: los nombres por grupo (Mías, Mi plaza, Mi Facción), con su estado; las hechas, plegadas al final de cada grupo. */
function htmlIndice(p: ProyeccionJugador, abierta: string | undefined, e: Escapar): string {
  const s = cargarSeguimiento(p);
  const item = (d: DuenoMision, m: Mision): string => {
    const k = claveDe(d, m.id);
    const marcas = `${s?.seguidas.includes(k) ? '<i class="diario-seguida" title="La sigues">◆</i>' : ''}${s?.nuevas.includes(k) ? '<i class="diario-nueva" title="Nueva">nueva</i>' : ''}`;
    return `<button class="diario-item diario-${m.estado}${k === abierta ? ' activo' : ''}" type="button" data-mision-abrir="${e(k)}"><span>${e(textoDeMision(m.id).titulo)}</span>${marcas}${m.estado === 'cumplida' ? '<i class="diario-lista">✓</i>' : ''}</button>`;
  };
  return PESTANAS.map(([d, nombre]) => {
    const { misiones, duenoId } = delDueno(p, d);
    const vivas = [...misiones.filter((m) => m.estado === 'cumplida'), ...misiones.filter((m) => m.estado === 'activa')];
    const hechas = misiones.filter((m) => m.estado === 'reclamada');
    const vacio = !duenoId ? (d === 'plaza' ? 'Solo dentro de una plaza.' : 'Sin Facción.') : vivas.length ? '' : 'Ninguna en marcha.';
    return `<div class="diario-grupo"><div class="diario-grupo-cab">${nombre}<small>${vivas.length}</small></div>
      ${vivas.map((m) => item(d, m)).join('')}${vacio ? `<p class="diario-vacio">${vacio}</p>` : ''}
      ${hechas.length ? `<details class="diario-hechas"${hechas.some((m) => claveDe(d, m.id) === abierta) ? ' open' : ''}><summary>Hechas (${hechas.length})</summary>${hechas.map((m) => item(d, m)).join('')}</details>` : ''}</div>`;
  }).join('');
}

/** La parte de la derecha: título, descripción, objetivos, detalles y recompensas; los botones, abajo. */
function htmlDetalle(p: ProyeccionJugador, x: { d: DuenoMision; m: Mision } | undefined, e: Escapar): { cuerpo: string; pie: string } {
  if (!x) return { cuerpo: '<p class="diario-vacio">No tienes misiones todavía. Se activan solas a medida que juegas.</p>', pie: '' };
  const { d, m } = x;
  const t = textoDeMision(m.id);
  const k = claveDe(d, m.id);
  const s = cargarSeguimiento(p);
  const seguida = s?.seguidas.includes(k) ?? false;
  const otro = quienReclama(p, d);
  const estado = m.estado === 'cumplida' ? '¡Cumplida!' : m.estado === 'reclamada' ? 'Hecha' : 'En curso';
  const de = PESTANAS.find(([q]) => q === d)?.[1] ?? '';
  const cuerpo = `<div class="diario-titulo"><h2>${e(t.titulo)}</h2><span class="diario-estado diario-estado-${m.estado}">${estado}</span></div>
    <p class="diario-de">${e(de)}</p>
    ${t.texto ? `<p class="diario-texto">${e(t.texto)}</p>` : ''}
    ${m.estado === 'activa' && m.condiciones.length ? `<h3 class="diario-seccion">Objetivos</h3>${barras(m, e)}` : ''}
    ${t.explicacion ? `<h3 class="diario-seccion">Detalles</h3><p class="diario-texto">${e(t.explicacion)}</p>` : ''}
    <h3 class="diario-seccion">Recompensas</h3><div class="diario-premios">${htmlRecompensas(m, e)}</div>
    ${m.estado === 'cumplida' && otro ? `<p class="diario-nota">${e(otro)}</p>` : ''}
    <p class="faction-error" data-mision-error="${e(m.id)}" role="alert"></p>`;
  const seguir = m.estado === 'reclamada' ? ''
    : `<button class="btn-secondary" type="button" data-mision-seguir="${e(k)}"${!seguida && (s?.seguidas.length ?? 0) >= MAX_SEGUIDAS ? ` disabled title="Ya sigues ${MAX_SEGUIDAS}: deja de seguir alguna"` : ''}>${seguida ? 'Dejar de seguir' : 'Seguir'}</button>`;
  const reclamar = m.estado === 'cumplida' && !otro ? `<button class="btn-primary" type="button" data-mision-reclamar="${e(m.id)}" data-dueno="${d}">Reclamar</button>` : '';
  return { cuerpo, pie: `${seguir}<span class="diario-pie-hueco"></span>${reclamar}` };
}

/** La ventana del botón Misiones de la barra: centrada, con la lista a la izquierda y la misión abierta a la derecha. */
export function htmlPanelMisiones(p: ProyeccionJugador, e: Escapar): string {
  const x = elegida(p);
  const abierta = x ? claveDe(x.d, x.m.id) : undefined;
  const { cuerpo, pie } = htmlDetalle(p, x, e);
  const s = cargarSeguimiento(p);
  return `<div class="diario">
    <header class="diario-cab"><span class="diario-cab-titulo">Misiones${ayuda('jugador:misiones', `Se activan solas: cuando cumples una, aparecen las que venían detrás. Sigue hasta ${MAX_SEGUIDAS} para verlas en pantalla. La recompensa no llega sola: pulsa Reclamar cuando esté cumplida.`)}</span>
      <small>Sigues ${s?.seguidas.length ?? 0}/${MAX_SEGUIDAS}</small><button class="diario-cerrar" type="button" data-mision-cerrar aria-label="Cerrar">✕</button></header>
    <div class="diario-cuerpo">
      <nav class="diario-indice">${htmlIndice(p, abierta, e)}</nav>
      <section class="diario-detalle"><div class="diario-pagina">${cuerpo}</div><footer class="diario-pie">${pie}</footer></section>
    </div>
  </div>`;
}

/** Abre la ventana en un dueño (desde la Facción o el rastreador) o, con `id`, en esa misión. */
export function elegirPestanaMisiones(d: DuenoMision, id?: string): void {
  seleccionada = id ? claveDe(d, id) : null;
  if (!id) {
    const p = estadoCliente.proyeccionUltima;
    const m = p ? delDueno(p, d).misiones.find((q) => q.estado !== 'reclamada') : undefined;
    if (m) seleccionada = claveDe(d, m.id);
  }
}

/** Al enseñar una lista, lo nuevo de ese dueño deja de ser «nuevo». */
function verNuevas(p: ProyeccionJugador, d: DuenoMision): void {
  const s = cargarSeguimiento(p);
  if (!s || !s.nuevas.some((k) => k.startsWith(`${d}:`))) return;
  s.nuevas = s.nuevas.filter((k) => !k.startsWith(`${d}:`));
  guardarSeguimiento();
}

/** Cablea Seguir, Reclamar y las pestañas en `raiz` (el panel, la subpestaña de la plaza o la pestaña Facción). */
export function cablearMisiones(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar, repintar: () => void): void {
  alCambiar = repintar;
  // En la ventana, lo nuevo deja de serlo al abrir cada misión; en la plaza y la Facción, al cabo de un rato de ver la lista.
  const vista = raiz.querySelector('.diario') ? undefined : (raiz.querySelector<HTMLElement>('[data-dueno]')?.dataset.dueno as DuenoMision | undefined);
  if (vista) setTimeout(() => verNuevas(p, vista), 4000);
  raiz.querySelectorAll<HTMLButtonElement>('[data-mision-abrir]').forEach((b) => b.addEventListener('click', () => {
    seleccionada = b.dataset.misionAbrir!;
    // Abrirla es verla: deja de ser «nueva».
    const s = cargarSeguimiento(p);
    if (s?.nuevas.includes(seleccionada)) { s.nuevas = s.nuevas.filter((k) => k !== seleccionada); guardarSeguimiento(); }
    repintar();
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-mision-seguir]').forEach((b) => b.addEventListener('click', () => {
    const s = cargarSeguimiento(p);
    const k = b.dataset.misionSeguir!;
    if (!s) return;
    s.seguidas = s.seguidas.includes(k) ? s.seguidas.filter((x) => x !== k) : [...s.seguidas, k].slice(0, MAX_SEGUIDAS);
    guardarSeguimiento();
    repintar();
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-mision-reclamar]').forEach((b) => b.addEventListener('click', async () => {
    const d = b.dataset.dueno as DuenoMision;
    const duenoId = delDueno(p, d).duenoId;
    if (!duenoId) return;
    b.disabled = true;
    const mensaje = await ejecutar('reclamarRecompensa', { duenoId, misionId: b.dataset.misionReclamar });
    b.disabled = false;
    const campo = raiz.querySelector<HTMLElement>(`[data-mision-error="${b.dataset.misionReclamar}"]`);
    if (campo) campo.textContent = mensaje ?? '';
  }));
}

/** «Misiones» en el Centro urbano de la plaza: las de esa plaza. */
export const SUBPESTANA_MISIONES: SubpestanaPlaza = {
  id: 'misiones',
  etiqueta: 'Misiones',
  html: (c) => `<div data-dueno="plaza">${htmlListaMisiones(c.proyeccion, 'plaza', c.escapar)}</div>`,
  cablear: (c) => cablearMisiones(c.cuerpo, c.proyeccion, c.ejecutar, c.refrescar),
};

// ---------------------------------------------------------------- rastreador

/**
 * Las seguidas que se ven ahora, con su barra fina; las cumplidas, en dorado. En el mundo flota arriba a la derecha; en la plaza y el
 * campamento va al principio de su columna izquierda (allí arriba a la izquierda está la leyenda). Plegado, una línea.
 */
export function pintarRastreador(p: ProyeccionJugador, abrir: (d: DuenoMision, id?: string) => void, e: Escapar): void {
  const izq = document.querySelector<HTMLElement>('.asent-izq');
  const mundo = document.querySelector<HTMLElement>('.mapa-screen:not(.mapa-interior)');
  const sitio = izq ?? mundo;
  let el = document.querySelector<HTMLElement>('.misiones-rastreador');
  if (!sitio) { el?.remove(); return; }
  const s = cargarSeguimiento(p);
  const seguidas = (s?.seguidas ?? []).flatMap((k) => {
    const [d, id] = k.split(':') as [DuenoMision, string];
    const m = delDueno(p, d).misiones.find((x) => x.id === id);
    return m && m.estado !== 'reclamada' ? [{ d, m }] : [];
  });
  if (seguidas.length === 0) { el?.remove(); return; }
  if (!el || el.parentElement !== sitio) {
    el?.remove();
    el = document.createElement('aside');
    el.className = `misiones-rastreador${izq ? ' en-columna' : ''}`;
    sitio.prepend(el);
  }
  const html = `<button class="rastreador-cab" type="button" data-rastreador-plegar aria-expanded="${s?.plegado ? 'false' : 'true'}">Misiones ${seguidas.length}/${MAX_SEGUIDAS} <span>${s?.plegado ? '▸' : '▾'}</span></button>
    ${s?.plegado ? '' : seguidas.map(({ d, m }) => `<button class="rastreador-item${m.estado === 'cumplida' ? ' cumplida' : ''}" type="button" data-rastreador-abrir="${d}" data-rastreador-mision="${e(m.id)}"><strong>${e(textoDeMision(m.id).titulo)}</strong>${m.estado === 'cumplida' ? '<small>¡Cumplida! Reclámala</small>' : barras(m, e, true)}</button>`).join('')}`;
  if (el.dataset.pintado === html) return;
  el.dataset.pintado = html;
  el.innerHTML = html;
  el.querySelector('[data-rastreador-plegar]')?.addEventListener('click', () => {
    if (!s) return;
    s.plegado = !s.plegado;
    guardarSeguimiento();
    pintarRastreador(p, abrir, e);
  });
  el.querySelectorAll<HTMLButtonElement>('[data-rastreador-abrir]').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.rastreadorAbrir as DuenoMision, b.dataset.rastreadorMision)));
}
