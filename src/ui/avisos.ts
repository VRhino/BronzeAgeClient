// Avisos de eventos del backend que le tocan al jugador (cursor `GET .../eventos?desde=`):
//  - que alguien mire su defensa, una columna suya, una caravana, o pida el plano de una plaza (intel de la taberna, Doc 5.12.10): un toast;
//  - los INFORMES DE COMBATE (doc 02 §4.1b: `combate.resuelto`, `combate.campamento_destruido`, `combate.ataque_campamento_fallido`) en los
//    que va tu héroe: un briefing con ganador, poder de cada bando y bajas por escuadra (`ui/informeCombate.ts`).
// Todo se guarda en un HISTORIAL consultable (localStorage, por partida y héroe) con un contador de no leídos, de modo que lo ocurrido mientras
// estabas dentro, o con la pestaña cerrada, no se pierde. El backend entrega los que nombran a tu héroe (doc 02 §4.1b, 2026-10-07); aquí se mira
// `heroesIds` para saber en qué lado ibas. También avisa de `mercenarios.prestamo_retirado` (te retiran la tropa prestada).
import { consultarEventos } from '../apiCliente';
import type { EventoDominio } from '../tiposDominio';
import { esPeticionNueva, MINIMO_FORMACION } from './ejercitos';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { nombreDeHeroe } from './nombres';
import { informeDeEvento, type InformeDeCombate } from './informeCombate';

/** Los eventos de «alguien te ha mirado»: el backend los emite sin decir quién. */
const CODIGOS_DE_AVISO = new Set(['asentamiento.observado', 'columna.observada', 'caravana.observada', 'asentamiento.informe_pedido']);
const MAX_HISTORIAL = 80;

export interface EntradaAviso {
  version: number;
  /** Fecha de mundo del evento (ISO), si el backend la manda. */
  momento?: string;
  texto: string;
  /** `peligro` = te atacaron; `combate` = un combate tuyo; `baja` = te retiraron tropa; `mirada` = alguien te observó. */
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
  temporizador = setTimeout(() => { el!.hidden = true; }, 8000);
}

/** Olvida el cursor y el historial en memoria (al cambiar de partida o cerrar sesión): el siguiente refresco vuelve a cargarlos. */
export function reiniciarAvisos(): void {
  ultimaVersion = null;
  historial = [];
  noLeidos = 0;
  clave = '';
  oyentes.forEach((cb) => cb());
}

/**
 * La deserción por hambre (`tropas.desercion`, con `heroeId` desde el backend 2026-10-07): una columna sin ración pierde moral y, a 0, deserta un
 * 5 % por minuto. Llega un evento por escuadra y minuto, así que los de una tanda se juntan en un solo aviso.
 */
function avisarDeDesercion(eventos: readonly EventoDominio[], heroeId: string, modo: 'vivo' | 'recuperado' | 'historico'): void {
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
  historial.unshift({ version: ultimo.version, momento: ultimo.momento, texto, clase: 'baja' });
  if (modo !== 'historico') noLeidos++;
  if (modo === 'vivo') mostrar(texto, true);
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
    historial.unshift({ version: e.version, momento: e.momento, texto, clase: 'mirada' });
    if (modo !== 'historico') noLeidos++;
    if (!silencioso) mostrar(texto, e.codigo !== 'columna.union_en_campo');
    return;
  }
  if (e.codigo === 'mercenarios.prestamo_retirado') {
    // El campamento te retira la tropa prestada al dejar de residir en él (backend D45): antes desaparecía sin aviso.
    const p = e.payload as { campamentoId?: string; escuadras?: { tropaId: string; cantidad: number }[] } | undefined;
    const tropa = (p?.escuadras ?? []).map((x) => `${x.tropaId.replace(/_/g, ' ')}: ${x.cantidad}`).join(', ');
    const texto = `${p?.campamentoId ?? 'El campamento'} te retira la tropa prestada (${tropa}): ya no resides allí.`;
    historial.unshift({ version: e.version, momento: e.momento, texto, clase: 'baja' });
    if (modo !== 'historico') noLeidos++;
    if (!silencioso) mostrar(texto, true);
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
    avisarDeDesercion(eventos, heroeId, modo);
    if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
    guardar();
    oyentes.forEach((cb) => cb());
  } catch {
    // Un aviso perdido no es un error del juego: el cursor ya avanzó y la proyección sigue siendo la verdad.
  }
}
