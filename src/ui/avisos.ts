// Avisos de eventos del backend que le tocan al jugador (cursor `GET .../eventos?desde=`):
//  - que alguien mire su defensa, una columna suya, una caravana, o pida el plano de una plaza (intel de la taberna, Doc 5.12.10);
//  - los INFORMES DE COMBATE (doc 02 §4.1b: `combate.resuelto`, `combate.campamento_destruido`, `combate.ataque_campamento_fallido`) en los
//    que va tu héroe: un briefing con ganador, poder de cada bando y bajas por escuadra (`ui/informeCombate.ts`).
// Todo se guarda en un HISTORIAL consultable (localStorage, por partida y héroe) con un contador de no leídos, de modo que lo ocurrido mientras
// estabas dentro, o con la pestaña cerrada, no se pierde. El backend entrega los que nombran a tu héroe (doc 02 §4.1b, 2026-10-07); aquí se mira
// `heroesIds` para saber en qué lado ibas. También avisa de `mercenarios.prestamo_retirado` (te retiran la tropa prestada).
//
// AGRUPACIÓN (bloque J4): cada aviso declara su CATEGORÍA y su URGENCIA. Los URGENTES (te atacan, un combate tuyo, deserción, piden unirse a tu
// ejército, y las propuestas de diplomacia que añada J1) hacen toast propio, no se agrupan y salen arriba y destacados. Los de BAJA urgencia
// (inteligencia, movimientos, tropa prestada…) no hacen toast: suman a la insignia de «Avisos», y los repetidos (misma `clave`: tipo + origen) se
// funden en UNA línea con contador y rango de horas. La insignia cuenta líneas (grupos) sin leer, no eventos.
// Un evento nuevo = una rama en `procesar` que llame a `anotar` con su categoría y urgencia.
import { consultarEventos } from '../apiCliente';
import type { EventoDominio } from '../tiposDominio';
import { esPeticionNueva, MINIMO_FORMACION } from './ejercitos';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { nombreDeHeroe } from './nombres';
import { informeDeEvento, type InformeDeCombate } from './informeCombate';

/** Los eventos de «alguien te ha mirado»: el backend los emite sin decir quién. */
const CODIGOS_DE_AVISO = new Set(['asentamiento.observado', 'columna.observada', 'caravana.observada', 'asentamiento.informe_pedido']);
const MAX_HISTORIAL = 80;

export type CategoriaAviso = 'combate' | 'diplomacia' | 'movimientos' | 'inteligencia' | 'economia';
/** Orden y nombre de las categorías en el panel. */
export const CATEGORIAS: readonly (readonly [CategoriaAviso, string])[] = [
  ['combate', 'Combate'], ['diplomacia', 'Diplomacia'], ['movimientos', 'Movimientos'], ['inteligencia', 'Inteligencia'], ['economia', 'Economía y tropas'],
];

export interface EntradaAviso {
  version: number;
  /** Fecha de mundo del evento (ISO), si el backend la manda. */
  momento?: string;
  texto: string;
  /** `peligro` = te atacaron; `combate` = un combate tuyo; `baja` = te retiraron tropa; `mirada` = alguien te observó. */
  clase: 'peligro' | 'combate' | 'baja' | 'mirada';
  informe?: InformeDeCombate;
  /** Cabecera de la línea («Te observaron»); sin ella, la del panel por `clase`. */
  titulo?: string;
  categoria: CategoriaAviso;
  /** Urgente: pide decisión o es grave. Hace toast, no se agrupa y sale arriba. */
  urgente: boolean;
  leido: boolean;
  /** Cuántos avisos iguales (misma `clave`) se han fundido en esta línea. */
  veces: number;
  /** Tipo + origen: solo los NO urgentes con `clave` se agrupan. */
  clave?: string;
  /** Primera y última llegada, en hora real (ms): el rango se enseña como horas, que no cambian con el reloj del panel. */
  desde: number;
  hasta: number;
}
/** Lo que aporta cada rama de `procesar`; `anotar` rellena el resto. */
type AvisoNuevo = Pick<EntradaAviso, 'version' | 'momento' | 'texto' | 'clase' | 'categoria' | 'urgente'> & Partial<Pick<EntradaAviso, 'titulo' | 'clave' | 'informe'>>;
type Modo = 'vivo' | 'recuperado' | 'historico';

let ultimaVersion: number | null = null;
let historial: EntradaAviso[] = [];
let clave = '';
let temporizador: ReturnType<typeof setTimeout> | undefined;
/** Toast de aviso en pantalla: el último texto y cuántos urgentes más llegaron mientras tanto (se funden en uno en vez de pisarse). */
let toastActual: { texto: string; extra: number } | null = null;
const oyentes = new Set<() => void>();
/** Quien quiera enseñar un briefing nada más llegar (lo pone `main.ts`). */
let alInforme: ((informe: InformeDeCombate) => void) | null = null;

export function alLlegarInforme(cb: (informe: InformeDeCombate) => void): void { alInforme = cb; }
export function alCambiarAvisos(cb: () => void): void { oyentes.add(cb); }
export const historialDeAvisos = (): readonly EntradaAviso[] => historial;
/** Cuenta GRUPOS (líneas), no eventos. */
export const avisosNoLeidos = (): number => historial.filter((a) => !a.leido).length;
export const hayPeligroSinLeer = (): boolean => historial.some((a) => !a.leido && a.clase === 'peligro');
/** Marca como leído todo, solo lo urgente, o una categoría (sin los urgentes, que viven en su propia sección). */
export function marcarAvisosLeidos(que: 'todos' | 'urgentes' | CategoriaAviso = 'todos'): void {
  const toca = (a: EntradaAviso) => que === 'todos' || (que === 'urgentes' ? a.urgente : !a.urgente && a.categoria === que);
  const pendientes = historial.filter((a) => !a.leido && toca(a));
  if (pendientes.length === 0) return;
  pendientes.forEach((a) => { a.leido = true; });
  guardar();
  oyentes.forEach((cb) => cb());
}

function guardar(): void {
  try { localStorage.setItem(clave, JSON.stringify({ ultimaVersion, historial })); } catch { /* sin almacenamiento: el historial dura lo que la pestaña */ }
}

/** Carga el historial guardado de esta partida y héroe. Devuelve la versión hasta la que ya se había avisado, o `null`. */
function cargar(gameId: string, heroeId: string): number | null {
  clave = `bac_avisos_${gameId}_${heroeId}`;
  try {
    const g = JSON.parse(localStorage.getItem(clave) ?? 'null') as { ultimaVersion?: number; noLeidos?: number; historial?: Partial<EntradaAviso>[] } | null;
    // Lo guardado antes de J4 no trae categoría ni urgencia: se deducen de la clase; y eran no leídos los `noLeidos` primeros.
    historial = (g?.historial ?? []).map((a, i) => ({
      version: 0, texto: '', clase: 'mirada', ...a,
      categoria: a.categoria ?? (a.clase === 'baja' ? 'economia' : a.clase === 'peligro' || a.clase === 'combate' ? 'combate' : 'inteligencia'),
      urgente: a.urgente ?? (a.clase === 'peligro' || a.clase === 'combate'),
      leido: a.leido ?? i >= (g?.noLeidos ?? 0),
      veces: a.veces ?? 1,
      desde: a.desde ?? 0,
      hasta: a.hasta ?? 0,
    }));
    return g?.ultimaVersion ?? null;
  } catch {
    historial = [];
    return null;
  }
}

/** Un aviso flotante que vale en cualquier pantalla (`.aviso-global`). */
export function mostrar(texto: string, peligro = false): void {
  let el = document.querySelector<HTMLElement>('.aviso-global');
  if (!el) {
    el = document.createElement('div');
    el.className = 'aviso-global';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.classList.toggle('peligro', peligro);
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el!.hidden = true; toastActual = null; }, 8000);
}

/** Toast de un aviso urgente: si ya hay otro en pantalla no lo pisa, sino que se actualiza con «· +N más en Avisos». */
function toastDeAviso(texto: string, peligro: boolean): void {
  const visible = toastActual !== null && document.querySelector<HTMLElement>('.aviso-global')?.hidden === false;
  if (!visible) { toastActual = { texto, extra: 0 }; mostrar(texto, peligro); return; }
  toastActual!.extra++;
  mostrar(`${toastActual!.texto} · +${toastActual!.extra} más en Avisos`, peligro || document.querySelector('.aviso-global')?.classList.contains('peligro') === true);
}

/** Olvida el cursor y el historial en memoria (al cambiar de partida o cerrar sesión): el siguiente refresco vuelve a cargarlos. */
export function reiniciarAvisos(): void {
  ultimaVersion = null;
  historial = [];
  clave = '';
  oyentes.forEach((cb) => cb());
}

/**
 * Anota un aviso en el historial. Los de baja urgencia con la misma `clave` se funden en la línea anterior (contador + rango de horas, y vuelve
 * arriba como no leída); los urgentes van siempre aparte. Hace toast solo si es urgente y llega en vivo (`peligro` lo pinta en terracota).
 */
export function anotar(a: AvisoNuevo, modo: Modo, peligro = false): void {
  const ahora = Date.now();
  const previa = a.clave && !a.urgente ? historial.findIndex((x) => x.clave === a.clave) : -1;
  const antes = previa >= 0 ? historial.splice(previa, 1)[0] : undefined;
  historial.unshift({ ...a, leido: modo === 'historico', veces: (antes?.veces ?? 0) + 1, desde: antes?.desde || ahora, hasta: ahora });
  if (modo === 'vivo' && a.urgente) toastDeAviso(a.texto, peligro);
}

/**
 * La deserción por hambre (`tropas.desercion`, con `heroeId` desde el backend 2026-10-07): una columna sin ración pierde moral y, a 0, deserta un
 * 5 % por minuto. Llega un evento por escuadra y minuto, así que los de una tanda se juntan en un solo aviso.
 */
function avisarDeDesercion(eventos: readonly EventoDominio[], heroeId: string, modo: Modo): void {
  const porEscuadra = new Map<string, number>();
  let ultimo: EventoDominio | undefined;
  for (const e of eventos) {
    const p = e.payload as { heroeId?: string; escuadronNombre?: string; desertores?: number } | undefined;
    if (e.codigo !== 'tropas.desercion' || p?.heroeId !== heroeId) continue;
    porEscuadra.set(p.escuadronNombre ?? 'una escuadra', (porEscuadra.get(p.escuadronNombre ?? 'una escuadra') ?? 0) + (p.desertores ?? 0));
    ultimo = e;
  }
  if (!ultimo) return;
  const texto = `Desertan por hambre (sin víveres, moral a 0): ${[...porEscuadra].map(([n, d]) => `${n} −${d}`).join(', ')}. Pasa trigo del carro a tus víveres.`;
  anotar({ version: ultimo.version, momento: ultimo.momento, texto, clase: 'baja', titulo: 'Deserción', categoria: 'combate', urgente: true }, modo, true);
}

/** Anota un evento del backend en el historial (y avisa si es nuevo). `silencioso`: lo ocurrido mientras no mirabas, sin toast ni briefing. */
export function procesar(e: EventoDominio, heroeId: string, modo: Modo): void {
  const silencioso = modo !== 'vivo';
  const base = { version: e.version, momento: e.momento };
  if (CODIGOS_DE_AVISO.has(e.codigo)) {
    // Intel: informativo, se agrupa por tipo y plaza (o columna/caravana) de origen.
    const titulo = e.codigo === 'asentamiento.informe_pedido' ? 'Pidieron tu plano' : 'Te observaron';
    anotar({ ...base, texto: e.mensaje, clase: 'mirada', titulo, categoria: 'inteligencia', urgente: false, clave: `${e.codigo}|${e.asentamientoId ?? ''}` }, modo);
    return;
  }
  if (e.codigo.startsWith('convocatoria.')) {
    // Ejército en preparación dentro de un lugar (backend 2026-10-08): llegan al Líder y a cada integrante (`heroesIds`).
    const p = e.payload as { heroeId?: string; liderId?: string; heroesIds?: string[]; expiraEn?: number } | undefined;
    const proy = estadoCliente.proyeccionUltima;
    const quien = proy && p?.heroeId ? nombreDeHeroe(proy, p.heroeId) : 'Un héroe';
    const mio = p?.heroeId === heroeId;
    const meToca = mio || p?.liderId === heroeId || (p?.heroesIds ?? []).includes(heroeId);
    let texto: string | null = null;
    switch (e.codigo) {
      case 'convocatoria.union_pedida':
        if (p?.liderId === heroeId && !mio && esPeticionNueva(p.heroeId ?? '', p.expiraEn ?? 0)) texto = `${quien} pide unirse a tu ejército en preparación: tienes ${textoEnTiempoReal((p.expiraEn ?? 0) - (proy?.instante ?? 0))} para contestar.`;
        break;
      case 'convocatoria.unido': texto = mio ? 'Te has unido al ejército en preparación: esperad a que su Líder pulse «Salir con el ejército».' : meToca ? `${quien} se une al ejército en preparación.` : null; break;
      case 'convocatoria.seleccion_cambiada': texto = !mio && meToca ? `${quien} cambia su tropa en el ejército en preparación.` : null; break;
      case 'convocatoria.union_rechazada': texto = mio ? 'El Líder ha rechazado tu petición de unirte al ejército.' : null; break;
      case 'convocatoria.separado': texto = !mio && meToca ? `${quien} se separa del ejército en preparación.` : null; break;
      case 'convocatoria.cancelada': texto = meToca ? 'El Líder ha cancelado la salida del ejército: seguís dentro.' : null; break;
      case 'convocatoria.partio': texto = meToca ? 'El ejército sale: su Líder lo dirige con clics en el mapa.' : null; break;
    }
    if (!texto) return;
    // Solo pedir unirse exige decisión; lo demás informa y se agrupa por tipo.
    const urgente = e.codigo === 'convocatoria.union_pedida';
    anotar({ ...base, texto, clase: 'mirada', titulo: 'Ejército en preparación', categoria: 'movimientos', urgente, clave: e.codigo }, modo, urgente);
    return;
  }
  if (e.codigo === 'ejercito.entra_en_campamento') {
    // El ejército entra entero en un campamento y se desarma (backend 2026-10-08): cada uno queda dentro, residente o de visita.
    const p = e.payload as { heroesIds?: string[] } | undefined;
    if (!(p?.heroesIds ?? []).includes(heroeId)) return;
    const texto = 'El ejército ha entrado en el campamento y se ha desarmado: cada uno queda dentro (los que no residen, de visita).';
    anotar({ ...base, texto, clase: 'mirada', titulo: 'Ejército en el campamento', categoria: 'movimientos', urgente: false, clave: e.codigo }, modo);
    return;
  }
  if (e.codigo === 'columna.union_pedida' || e.codigo === 'columna.union_rechazada' || e.codigo === 'columna.union_en_campo') {
    // Unirse en campo (backend 2026-10-08): al Líder le llega la petición (10 s para contestar) y al solicitante, la respuesta.
    const p = e.payload as { heroeId?: string; liderId?: string; expiraEn?: number } | undefined;
    const proy = estadoCliente.proyeccionUltima;
    const quien = proy && p?.heroeId ? nombreDeHeroe(proy, p.heroeId) : 'Un héroe';
    let texto: string | null = null;
    if (e.codigo === 'columna.union_pedida' && p?.liderId === heroeId && p.heroeId !== heroeId && esPeticionNueva(p.heroeId ?? '', p.expiraEn ?? 0)) texto = `${quien} pide unirse a tu ejército: tienes ${textoEnTiempoReal((p.expiraEn ?? 0) - (proy?.instante ?? 0))} para contestar (botón ⚑ del mapa).`;
    else if (e.codigo === 'columna.union_rechazada' && p?.heroeId === heroeId) texto = 'El Líder ha rechazado tu petición de unirte al ejército.';
    else if (e.codigo === 'columna.union_en_campo' && p?.heroeId === heroeId) {
      const mia = proy?.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === heroeId));
      texto = mia?.formacion
        ? `Te has unido a la formación (${mia.participantes.length}/${MINIMO_FORMACION}): aún no es un ejército, hacen falta ${MINIMO_FORMACION} héroes antes de que se deshaga (${textoEnTiempoReal(mia.formacion.expiraEn - (proy?.instante ?? 0))}).`
        : 'Te has unido al ejército: ahora sigues su destino.';
    }
    if (!texto) return;
    const urgente = e.codigo === 'columna.union_pedida';
    anotar({ ...base, texto, clase: 'mirada', titulo: 'Unirse en campo', categoria: 'movimientos', urgente, clave: e.codigo }, modo, e.codigo !== 'columna.union_en_campo');
    return;
  }
  if (e.codigo === 'mercenarios.prestamo_retirado') {
    // El campamento te retira la tropa prestada al dejar de residir en él (backend D45): antes desaparecía sin aviso.
    const p = e.payload as { campamentoId?: string; escuadras?: { tropaId: string; cantidad: number }[] } | undefined;
    const tropa = (p?.escuadras ?? []).map((x) => `${x.tropaId.replace(/_/g, ' ')}: ${x.cantidad}`).join(', ');
    const texto = `${p?.campamentoId ?? 'El campamento'} te retira la tropa prestada (${tropa}): ya no resides allí.`;
    anotar({ ...base, texto, clase: 'baja', titulo: 'Bajas', categoria: 'economia', urgente: false, clave: `${e.codigo}|${p?.campamentoId ?? ''}` }, modo);
    return;
  }
  const informe = informeDeEvento(e, heroeId);
  if (!informe) return;
  anotar({ ...base, texto: informe.resumen, clase: informe.teAtacaron ? 'peligro' : 'combate', categoria: 'combate', urgente: true, informe }, modo, informe.teAtacaron);
  if (!silencioso) alInforme?.(informe);
}

/** Recorta el historial, lo guarda y avisa a quien pinte (el panel, la insignia). */
export function refrescarAvisos(): void {
  if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
  guardar();
  oyentes.forEach((cb) => cb());
}

/** Tras cada proyección: la primera vez recupera lo ocurrido desde la última visita (en silencio) y fija el cursor; después pide lo nuevo y avisa. */
export async function avisarDeEventos(gameId: string, version: number): Promise<void> {
  const heroeId = estadoCliente.proyeccionUltima?.heroeId;
  if (!heroeId) return;
  let desde: number;
  // `historico`: primera vez en esta partida, se rellena el historial con lo ya ocurrido sin contarlo como no leído.
  let modo: Modo = 'vivo';
  if (ultimaVersion === null) {
    const guardada = cargar(gameId, heroeId);
    desde = guardada ?? 0;
    modo = guardada === null ? 'historico' : 'recuperado';
    ultimaVersion = version;
  } else {
    if (version <= ultimaVersion) return;
    desde = ultimaVersion;
    ultimaVersion = version;
  }
  try {
    const eventos = await consultarEventos(gameId, desde);
    for (const e of eventos) procesar(e, heroeId, modo);
    avisarDeDesercion(eventos, heroeId, modo);
    refrescarAvisos();
  } catch {
    // Un aviso perdido no es un error del juego: el cursor ya avanzó y la proyección sigue siendo la verdad.
  }
}
