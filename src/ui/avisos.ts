// Avisos de eventos del backend que le tocan al jugador (cursor `GET .../eventos?desde=`):
//  - que alguien mire su defensa, una columna suya, una caravana, o pida el plano de una plaza (intel de la taberna, Doc 5.12.10): un toast;
//  - los INFORMES DE COMBATE (doc 02 §4.1b: `combate.resuelto`, `combate.campamento_destruido`, `combate.ataque_campamento_fallido`) en los
//    que va tu héroe: un briefing con ganador, poder de cada bando y bajas por escuadra (`ui/informeCombate.ts`).
// Todo se guarda en un HISTORIAL consultable (localStorage, por partida y héroe) con un contador de no leídos, de modo que lo ocurrido mientras
// estabas dentro, o con la pestaña cerrada, no se pierde. Los eventos sin `asentamientoId` llegan a TODOS los clientes: se filtra por `heroesIds`.
import { consultarEventos } from '../apiCliente';
import type { EventoDominio } from '../tiposDominio';
import type { ProyeccionJugador } from '../apiCliente';
import { estadoCliente } from './estadoCliente';
import { informeDeEvento, type InformeDeCombate } from './informeCombate';

/** Los eventos de «alguien te ha mirado»: el backend los emite sin decir quién. */
const CODIGOS_DE_AVISO = new Set(['asentamiento.observado', 'columna.observada', 'caravana.observada', 'asentamiento.informe_pedido']);
const MAX_HISTORIAL = 80;

export interface EntradaAviso {
  version: number;
  /** Fecha de mundo del evento (ISO), si el backend la manda. */
  momento?: string;
  texto: string;
  /** `peligro` = te atacaron; `combate` = un combate tuyo; `baja` = tu tropa menguó (visto en la proyección); `mirada` = alguien te observó. */
  clase: 'peligro' | 'combate' | 'baja' | 'mirada';
  informe?: InformeDeCombate;
}

let ultimaVersion: number | null = null;
let historial: EntradaAviso[] = [];
let noLeidos = 0;
let clave = '';
let temporizador: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();
/** Quien quiera enseñar un briefing nada más llegar (lo pone `main.ts`). */
let alInforme: ((informe: InformeDeCombate) => void) | null = null;

export function alLlegarInforme(cb: (informe: InformeDeCombate) => void): void { alInforme = cb; }
export function alCambiarAvisos(cb: () => void): void { oyentes.add(cb); }
export const historialDeAvisos = (): readonly EntradaAviso[] => historial;
export const avisosNoLeidos = (): number => noLeidos;
export function marcarAvisosLeidos(): void {
  if (noLeidos === 0) return;
  noLeidos = 0;
  guardar();
  oyentes.forEach((cb) => cb());
}

function guardar(): void {
  try { localStorage.setItem(clave, JSON.stringify({ ultimaVersion, noLeidos, historial })); } catch { /* sin almacenamiento: el historial dura lo que la pestaña */ }
}

/** Carga el historial guardado de esta partida y héroe. Devuelve la versión hasta la que ya se había avisado, o `null`. */
function cargar(gameId: string, heroeId: string): number | null {
  clave = `bac_avisos_${gameId}_${heroeId}`;
  try {
    const g = JSON.parse(localStorage.getItem(clave) ?? 'null') as { ultimaVersion?: number; noLeidos?: number; historial?: EntradaAviso[] } | null;
    historial = g?.historial ?? [];
    noLeidos = g?.noLeidos ?? 0;
    return g?.ultimaVersion ?? null;
  } catch {
    historial = [];
    noLeidos = 0;
    return null;
  }
}

function mostrar(texto: string, peligro = false): void {
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
  temporizador = setTimeout(() => { el!.hidden = true; }, 8000);
}

/** Olvida el cursor y el historial en memoria (al cambiar de partida o cerrar sesión): el siguiente refresco vuelve a cargarlos. */
export function reiniciarAvisos(): void {
  ultimaVersion = null;
  tropaVista = null;
  eraHerido = false;
  historial = [];
  noLeidos = 0;
  clave = '';
  oyentes.forEach((cb) => cb());
}

// --- LO QUE SE VE EN LA PROYECCIÓN, SIN EVENTOS ---------------------------------------------------------
// Los informes de combate viajan en eventos sin plaza (`asentamientoId: ''`), y el backend de hoy NO los entrega a ningún cliente (ni por
// `GET /eventos` ni por el canal `mapa/general`: ambos esperan `undefined`; ver CHANGELOG 0.14.0). Mientras tanto el cliente se entera de lo que le
// pasó a su tropa comparando una proyección con la anterior: una escuadra que mengua es una baja (no sabe de quién), una que desaparece se ha
// retirado (la tropa prestada se retira al dejar de residir en su campamento) y un héroe que pasa a Herido ha perdido un combate.
let tropaVista: Map<string, { nombre: string; cantidad: number; prestada: boolean }> | null = null;
let eraHerido = false;

export function vigilarProyeccion(p: ProyeccionJugador): void {
  const ahora = new Map(p.heroe.escuadrones.map((s) => [s.id, { nombre: s.nombre, cantidad: s.cantidad, prestada: Boolean(s.prestada) }] as const));
  const herido = p.heroe.heridoHasta !== undefined && p.heroe.heridoHasta > p.instante;
  const momento = new Date(p.instante).toISOString();
  const nuevos: { texto: string; peligro: boolean }[] = [];
  if (tropaVista) {
    for (const [id, antes] of tropaVista) {
      const despues = ahora.get(id);
      if (!despues) {
        nuevos.push({ texto: `Tu escuadra «${antes.nombre}» (${antes.cantidad} hombres) ya no está.${antes.prestada ? ' La tropa prestada se retira cuando dejas de residir en el campamento que la prestó.' : ''}`, peligro: true });
      } else if (despues.cantidad < antes.cantidad) {
        nuevos.push({ texto: `Tu escuadra «${despues.nombre}» pasó de ${antes.cantidad} a ${despues.cantidad} hombres (−${antes.cantidad - despues.cantidad}).`, peligro: despues.cantidad === 0 });
      }
    }
    if (herido && !eraHerido) nuevos.push({ texto: 'Tu héroe quedó herido: perdió un combate.', peligro: true });
  }
  tropaVista = ahora;
  eraHerido = herido;
  if (nuevos.length === 0) return;
  for (const n of nuevos) {
    historial.unshift({ version: p.version, momento, texto: n.texto, clase: 'baja' });
    noLeidos++;
    mostrar(n.texto, n.peligro);
  }
  if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
  guardar();
  oyentes.forEach((cb) => cb());
}

/** Anota un evento del backend en el historial (y avisa si es nuevo). `silencioso`: lo ocurrido mientras no mirabas, sin toast ni briefing. */
function procesar(e: EventoDominio, heroeId: string, modo: 'vivo' | 'recuperado' | 'historico'): void {
  const silencioso = modo !== 'vivo';
  if (CODIGOS_DE_AVISO.has(e.codigo)) {
    historial.unshift({ version: e.version, momento: e.momento, texto: e.mensaje, clase: 'mirada' });
    if (modo !== 'historico') noLeidos++;
    if (!silencioso) mostrar(e.mensaje);
    return;
  }
  const informe = informeDeEvento(e, heroeId);
  if (!informe) return;
  historial.unshift({ version: e.version, momento: e.momento, texto: informe.resumen, clase: informe.teAtacaron ? 'peligro' : 'combate', informe });
  if (modo !== 'historico') noLeidos++;
  if (silencioso) return;
  mostrar(informe.resumen, informe.teAtacaron);
  alInforme?.(informe);
}

/** Tras cada proyección: la primera vez recupera lo ocurrido desde la última visita (en silencio) y fija el cursor; después pide lo nuevo y avisa. */
export async function avisarDeEventos(gameId: string, version: number): Promise<void> {
  const heroeId = estadoCliente.proyeccionUltima?.heroeId;
  if (!heroeId) return;
  let desde: number;
  // `historico`: primera vez en esta partida, se rellena el historial con lo ya ocurrido sin contarlo como no leído.
  let modo: 'vivo' | 'recuperado' | 'historico' = 'vivo';
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
    if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
    guardar();
    oyentes.forEach((cb) => cb());
  } catch {
    // Un aviso perdido no es un error del juego: el cursor ya avanzó y la proyección sigue siendo la verdad.
  }
}
