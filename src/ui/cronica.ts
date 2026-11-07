// La CRÓNICA del mundo (Tecnologia_Aedas §8): lo que cantan los Aedas para todos. Es la misma para todos los jugadores: caídas y fundaciones de
// plazas, guerras y vasallajes, títulos, los logros del mundo y las Eras, los descubrimientos que cantan los Aedas y las épicas que se cumplen.
// El motor la guarda entera y se pide por páginas (`paginaDeCronica`, hacia atrás); lo nuevo llega en vivo (`alEntrarEnCronica`). El contrato no
// trae texto: la frase la compone el cliente aquí, con una de dos variantes según la entrada (siempre la misma para la misma entrada).
import { alEntrarEnCronica, catalogoDeTecnologia, paginaDeCronica, type EntradaCronica, type ProyeccionJugador } from '../apiCliente';
import { textoContador } from './arbolTecnologias';
import { ayuda } from './ayuda';

type Escapar = (valor: string) => string;

let entradas: EntradaCronica[] = [];
let masAntiguas = false;
let estado: 'sin_pedir' | 'cargando' | 'lista' | 'error' = 'sin_pedir';
let error = '';
const claves = new Set<string>();
let alCambiar: (() => void) | null = null;

const claveDe = (x: EntradaCronica): string => `${x.version}|${x.tipo}|${JSON.stringify(x.datos)}`;

function sumar(lista: readonly EntradaCronica[]): void {
  for (const x of lista) {
    const k = claveDe(x);
    if (claves.has(k)) continue;
    claves.add(k);
    entradas.push(x);
  }
  // lo más nuevo arriba; dentro de una versión, en el orden en que llegaron
  entradas.sort((a, b) => b.version - a.version);
}

// Lo que llega en vivo entra si la crónica ya se pidió (si no, ya vendrá en la primera página).
alEntrarEnCronica((x) => {
  if (estado !== 'lista') return;
  sumar([x]);
  alCambiar?.();
});

/** Olvida lo cargado (al cambiar de partida o cerrar sesión). */
export function reiniciarCronica(): void {
  entradas = [];
  claves.clear();
  masAntiguas = false;
  estado = 'sin_pedir';
  error = '';
}

async function pedir(hasta?: number, avisar = true): Promise<void> {
  estado = 'cargando';
  if (avisar) alCambiar?.();
  try {
    const p = await paginaDeCronica(hasta);
    sumar(p.entradas);
    masAntiguas = p.masAntiguas;
    estado = 'lista';
  } catch (e) {
    estado = 'error';
    error = e instanceof Error ? e.message : String(e);
  }
  alCambiar?.();
}

// --- Las frases -----------------------------------------------------------------------------------------------------------------------------

/** El hash de las variantes (Tecnologia_Aedas §8): `h = (h·31 + código) mod 2³²`. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

interface Nombres { faccion: (id: string | undefined) => string; plaza: (id: string | undefined) => string }

function nombres(p: ProyeccionJugador): Nombres {
  return {
    faccion: (id) => {
      if (!id) return 'una Facción';
      const n = p.facciones.find((f) => f.id === id)?.nombre ?? p.directorioFacciones?.find((f) => f.id === id)?.nombre;
      return id === p.faccionId ? `${n ?? 'tu Facción'} (la tuya)` : n ?? 'una Facción lejana';
    },
    plaza: (id) => (id ? p.asentamientos.find((a) => a.id === id)?.nombre ?? p.asentamientosAvistados?.find((a) => a.id === id)?.nombre
      ?? p.asentamientosConocidos?.find((a) => a.asentamientoId === id)?.nombre : undefined) ?? 'una plaza lejana',
  };
}

/** Icono y frase de una entrada. */
export function fraseDeCronica(x: EntradaCronica, p: ProyeccionJugador): { icono: string; texto: string } {
  const n = nombres(p), d = x.datos as { faccionIds?: string[]; asentamientoId?: string; nivel?: number; titulo?: string; contador?: string; umbral?: number; era?: string; orden?: number; porPlazo?: number; tecnologia?: string };
  const [a, b, c] = (d.faccionIds ?? []).map((f) => n.faccion(f));
  const plaza = n.plaza(d.asentamientoId);
  const una = (...opciones: string[]): string => opciones[hash(claveDe(x)) % opciones.length]!;
  const cat = catalogoDeTecnologia(() => {});
  const tec = d.tecnologia ? cat?.TECNOLOGIAS[d.tecnologia]?.nombre ?? d.tecnologia.replace(/[._]/g, ' ') : 'un saber nuevo';
  const titulo = (p.titulos ?? []).find((t) => t.tituloId === d.titulo)?.nombre ?? (d.titulo ?? 'un título').replace(/[._]/g, ' ');
  switch (x.tipo) {
    case 'asentamiento.conquistada':
      return { icono: '⚔', texto: una(`${a ?? 'Una Facción'} arranca ${plaza} de manos de ${b ?? 'sus dueños'}.`, `${plaza} cae: sus puertas se abren a ${a ?? 'los vencedores'} y ${b ?? 'sus dueños'} la pierde.`) };
    case 'asentamiento.ruinas':
      return { icono: '🜂', texto: una(`${plaza} queda en ruinas; los Aedas lloran sus muros caídos.`, `Del fuego de ${plaza} solo quedan piedras: nadie la habita ya.`) };
    case 'fundacion.asentamiento_fundado':
      return { icono: '⌂', texto: una(`${a ?? 'Una Facción'} funda ${plaza}.`, `Se alzan las primeras casas de ${plaza}, de ${a ?? 'una Facción'}.`) };
    case 'diplomacia.guerra_declarada':
      return { icono: '⚑', texto: una(`${a ?? 'Una Facción'} declara la guerra a ${b ?? 'otra'}.`, `Suenan los cuernos: ${a ?? 'una Facción'} va a la guerra contra ${b ?? 'otra'}.`) };
    case 'diplomacia.rebelion_vasallo':
      return { icono: '⚑', texto: `Se rompe el vasallaje entre ${a ?? 'dos Facciones'} y ${b ?? 'su señora'}: el vasallo se rebela.` };
    case 'diplomacia.vasallo_liberado':
      return { icono: '⚑', texto: `Termina el vasallaje entre ${a ?? 'dos Facciones'} y ${b ?? 'su vasallo'}: el vasallo queda libre.` };
    case 'diplomacia.vasallo_conquistado':
      return { icono: '⚑', texto: `El vasallaje entre ${a ?? 'dos Facciones'} y ${b ?? 'su vasallo'} se impone por las armas.` };
    case 'diplomacia.anexion':
      return { icono: '⚑', texto: una(`${a ?? 'Una Facción'} se anexiona a ${b ?? 'otra'}.`, `${b ?? 'Una Facción'} deja de existir: ${a ?? 'otra'} la absorbe.`) };
    case 'diplomacia.fusion':
      return { icono: '⚑', texto: `${a ?? 'Dos Facciones'} y ${b ?? 'otra'} se funden en una sola: ${c ?? 'una Facción nueva'}.` };
    case 'titulo.nace':
      return { icono: '★', texto: `Nace el título «${titulo}»: lo gana ${a ?? 'una Facción'}.` };
    case 'titulo.cambia_manos':
      return { icono: '★', texto: `El título «${titulo}» pasa ${b ? `de ${b} ` : ''}a ${a ?? 'otra Facción'}.` };
    case 'tecnologia.logro':
      return { icono: '⚒', texto: `Entre todas las Facciones se llega a ${(d.umbral ?? 0).toLocaleString('es')} ${textoContador(d.contador ?? '')}: algo nuevo puede descubrirse.` };
    case 'era.comienza': {
      const era = (d.era ? cat?.ERAS[d.era]?.nombre : undefined) ?? (d.era ?? '').replace(/[._]/g, ' ');
      return { icono: '☀', texto: `Comienza la Era ${['', 'I', 'II', 'III', 'IV', 'V'][d.orden ?? 0] ?? d.orden ?? ''}${era ? `, ${era}` : ''}${d.porPlazo ? ': se cumplió su plazo' : ''}.` };
    }
    case 'aedas.canta_descubrimiento':
      return { icono: '📜', texto: una(`Los Aedas cantan por los caminos que ${a ?? 'una Facción'} ha descubierto ${tec}.`, `De plaza en plaza se canta el hallazgo de ${a ?? 'una Facción'}: ${tec}.`) };
    case 'aedas.epica_cumplida':
      return { icono: '📜', texto: una(`Un Aeda de ${a ?? 'una Facción'} termina su épica: un saber nuevo entra en sus plazas.`, `Se canta entera la épica de un Aeda de ${a ?? 'una Facción'}.`) };
    case 'asentamiento.nivel_subio':
      return { icono: '♛', texto: `${plaza}${a ? `, de ${a},` : ''} es la primera plaza del mundo en llegar al nivel ${d.nivel ?? '?'}.` };
  }
  return { icono: '•', texto: x.tipo.replace(/[._]/g, ' ') };
}

// --- El panel -------------------------------------------------------------------------------------------------------------------------------

export function htmlCronica(p: ProyeccionJugador, e: Escapar): string {
  if (estado === 'sin_pedir') void pedir(undefined, false); // pintando: no se repinta aquí, ya lo hará al llegar
  const cab = `<div class="cronica-cab"><strong>Crónica del mundo</strong>${ayuda('jugador:cronica', 'Lo que cantan los Aedas para todos: la misma crónica para todos los jugadores, desde el principio de la partida. Lo de tu Facción va marcado.')}</div>`;
  if (estado === 'error') return `${cab}<p class="faction-error">No se pudo leer la crónica: ${e(error)}</p><button class="btn-secondary" type="button" data-cronica-reintentar>Reintentar</button>`;
  if (entradas.length === 0) return `${cab}<p class="mapa-lista-vacia">${estado === 'cargando' || estado === 'sin_pedir' ? 'Leyendo la crónica…' : 'La crónica aún no canta nada: el mundo acaba de empezar.'}</p>`;
  const mia = (x: EntradaCronica): boolean => !!p.faccionId && ((x.datos as { faccionIds?: string[] }).faccionIds ?? []).includes(p.faccionId);
  const filas = entradas.map((x) => {
    const f = fraseDeCronica(x, p);
    return `<li class="cronica-entrada${mia(x) ? ' es-propia' : ''}"><span class="cronica-icono" aria-hidden="true">${f.icono}</span><span class="cronica-texto">${e(f.texto)}<small>${e(new Date(x.en).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</small></span></li>`;
  }).join('');
  const mas = masAntiguas ? `<button class="btn-secondary cronica-mas" type="button" data-cronica-mas${estado === 'cargando' ? ' disabled' : ''}>${estado === 'cargando' ? 'Leyendo…' : 'Más antiguas'}</button>` : '';
  return `${cab}<ol class="cronica-lista">${filas}</ol>${mas}`;
}

/** Cablea el panel; `repintar` se llama cuando llega algo (una página o una entrada en vivo). */
export function cablearCronica(panel: HTMLElement, repintar: () => void): void {
  alCambiar = repintar;
  panel.querySelector('[data-cronica-mas]')?.addEventListener('click', () => {
    const vieja = entradas[entradas.length - 1];
    if (vieja) void pedir(vieja.version - 1);
  });
  panel.querySelector('[data-cronica-reintentar]')?.addEventListener('click', () => void pedir());
}

/** Pone la crónica a mano, sin pedirla (los bancos de prueba). */
export function fijarCronica(lista: readonly EntradaCronica[], antiguas = false): void {
  reiniciarCronica();
  sumar(lista);
  masAntiguas = antiguas;
  estado = 'lista';
}

/** El panel se cerró: lo que llegue no lo repinta. */
export function soltarCronica(): void { alCambiar = null; }
