// PUEBLOS Y OBRAS DE MAPA (Economia_Construccion §14 y §14.0; motor 7086ebc). Un pueblo es de su plaza madre: un extractor sobre un nodo de piedra
// o mineral, o una ALDEA AGRÍCOLA en un punto fértil de la zona para su cultivo (tanda 69: trigo, vid u olivo; motor b55e90f: cebada o sésamo;
// motor 3d05872: la GANADERA, solo corrales y rebaño, sin granjas, y la de trigo ya sin corrales; acarrea lo que da). Se levanta en tres pasos:
//   1. marcar   desde la plaza madre, su Gobernador o su Maestro de Obras, residente y dentro: `marcarPueblo { nodoId }` o `marcarAldea { punto, cultivo }`;
//   2. llevar   la obra queda «pendiente de materiales» en el mapa: una columna de la Facción lleva lo que pide en su carro o en sus caravanas
//               enganchadas y, a la puerta de la obra, cualquiera de sus ciudadanos lo entrega (`entregarEnObra`);
//   3. esperar  con todo entregado arranca la obra (4-8 h) y el pueblo queda activo.
// La aldea sube de nivel igual (`mejorarAldea` deja otra obra de materiales) y sigue produciendo mientras tanto; desde el motor c1ad93d, también la
// Cantera y las minas (niveles 1 a 3, cada uno con la madre en ese nivel). Aquí no se decide ninguna regla: las
// cifras salen de `GET /v1/datos` y el motor valida; su rechazo se enseña tal cual.
//   plaza      la subpestaña «Territorio» del Centro urbano (lo que hay en su zona y sus pueblos) (`SUBPESTANA_PUEBLOS`): cupo, lista, marcar, mejorar, reponer carro, destruir;
//              con aire de juego (2026-11-02): la zona en fichas con casillas, cada pueblo y cada obra en su tarjeta y el marcar en dos cartas
//   mapa       los pueblos y las obras se pintan (`dibujarPueblosYObras`) y se seleccionan (`pueblosYObrasBajoElClic`, fichas `FICHA_PUEBLO`/`FICHA_OBRA`)
//   ascenso    la subida de nivel de la plaza (el nivel 2 pide un pueblo activo, aldea o extractor) se pinta en `panelCentro.ts`
//   dentro     se entra en un pueblo activo como de visita, con la columna entera (`entrarEnPueblo` / `salirDePueblo`); dentro se gestiona con esa
//              columna (`htmlPestanasPueblo`): guarnición, carga, escolta del carro de acarreo y mejora del pueblo. La escolta también se cede desde la plaza.
import { bloqueDeDatos, catalogoDeCaravanas, radioDePuerta, techosDeZona, type ProyeccionJugador } from '../apiCliente';
import { estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE, faccionColor } from '../paletas';
import { iconoEdificio } from './iconosEdificio';
import type { Asentamiento, AvanzadaDeMapa, ObraDeMapa, Point, PuebloDeMapa } from '../tiposDominio';
import { ayuda } from './ayuda';
import { agarre } from './agarre';
import { columnaALaPuerta, miColumna } from './ejercitos';
import { dibujarIconoMapa } from '../mundo/iconosMapa';
import { capaDe, capaDeCultivo, esCultivo, sitiosDeAldea, type Cultivo, type SitiosDeAldea } from '../mundo/fertilidad';
import { NOMBRE_DE_CULTIVO } from './capasMapa';
import type { ContextoFicha, ContextoPlaza, FichaMapaExtra, ObjetoBajoElClic, SubpestanaPlaza } from './ganchos';
import { cablearEscolta, escolta, puntosDeEscoltaDelCarro } from './panelMercado';
import type { Ejecutar } from './panelCarro';
import { nombreDeHeroe } from './nombres';
import { chipLiderazgo } from './liderazgo';
import { confirmar } from './dialogo';
import { iconoEnFila } from './iconosTropa';
import { ICONO_CARRETA, barraAvance, chipsDeCoste, medallonNivel } from './juegoVisual';
import { mostrar as mostrarAviso } from './avisos';
import { cablearPuertaDeAvanzada, claveDeEtapa, faccionAmiga, iconoDeAvanzada, htmlEleccionDeTropa, madreDe, nombreDeEtapa, puertaDeAvanzada, reglasDeObra as reglasDeObraDeAvanzada } from './avanzadas';
import { htmlAccionesPuerta, type AccionPuerta, type VentanaPuerta } from './accionesPuerta';
import { tieneCargoEnPlaza } from './cargosPlaza';
import { recursoDeExtractor } from '../motor/proyeccion';

type Escapar = (valor: string) => string;

interface ParamsPueblos {
  nivelMadreMinimo?: { extractor?: number; aldea?: number };
  cupoPorNivel?: Record<string, number>;
  capacidadAlmacenLocal?: number;
  costeAdicional?: Record<string, number>;
  aldea?: {
    fertilidadMinima?: number;
    separacionMinima?: number;
    niveles?: Record<string, { granjas: number; corrales: number; coste: Record<string, number>; obraMinutos: number }>;
    /** Tanda 69: lo que da cada cultivo, desde qué nivel, si lleva corrales y si lleva granjas (`granjas`, por defecto sí). Desde el motor
     * 3d05872 los corrales son solo de la ganadera, que no lleva granjas. El nivel (`nivelMadre`) es, desde el motor b55e90f, el que ha
     * alcanzado alguna plaza de la Facción, no el de la madre. */
    cultivos?: Partial<Record<Cultivo, { produce: string; nivelMadre: number; corrales: boolean; granjas?: boolean }>>;
  };
  /** La Cantera y las minas de pueblo por nivel (motor c1ad93d, 2026-11-10): el `factor` multiplica lo que sacan y los trabajadores que piden;
   * el nivel 2 y el 3 piden la plaza madre en ese nivel operativo (`nivelMadre`) y su `coste`, que se lleva como una obra. */
  extractor?: { niveles?: Record<string, NivelExtractor> };
}
interface NivelExtractor { factor: number; nivelMadre?: number; coste?: Record<string, number>; obraMinutos?: number }

/** Los cultivos de una aldea (tanda 69, Economia_Construccion §14.0), en el orden en que se ofrecen; lo que dan y su nivel salen de los datos. */
const CULTIVOS: { id: Cultivo; nombre: string; conArticulo: string; aldea: string; granja: string; produce: string; nivelMadre: number; corrales: boolean; granjas: boolean; uso: string }[] = [
  { id: 'trigo', nombre: 'Trigo', conArticulo: 'el trigo', aldea: 'Aldea de trigo', granja: 'Granja', produce: 'trigo', nivelMadre: 1, corrales: false, granjas: true, uso: 'Trigo para la plaza. Sin corrales: el rebaño es de la aldea ganadera.' },
  { id: 'vid', nombre: 'Vid', conArticulo: 'la vid', aldea: 'Aldea de viñas', granja: 'Viña', produce: 'uva', nivelMadre: 3, corrales: false, granjas: true, uso: 'Uva para la bodega, que hace el vino. Sin corrales.' },
  { id: 'oliva', nombre: 'Olivo', conArticulo: 'el olivo', aldea: 'Aldea de olivos', granja: 'Olivar', produce: 'aceituna', nivelMadre: 4, corrales: false, granjas: true, uso: 'Aceituna para la prensa, que hace el aceite. Sin corrales.' },
  // los de la tierra húmeda (motor b55e90f): la cebada en la alta y el sésamo en la baja
  { id: 'cebada', nombre: 'Cebada', conArticulo: 'la cebada', aldea: 'Aldea de cebada', granja: 'Cebadal', produce: 'cebada', nivelMadre: 3, corrales: false, granjas: true, uso: 'Cebada para la bodega, que hace la cerveza. Sin corrales.' },
  { id: 'sesamo', nombre: 'Sésamo', conArticulo: 'el sésamo', aldea: 'Aldea de sésamo', granja: 'Campo de sésamo', produce: 'sesamo', nivelMadre: 4, corrales: false, granjas: true, uso: 'Sésamo para la prensa, que hace aceite. Sin corrales.' },
  // la aldea ganadera (motor 3d05872): solo corrales y su rebaño, sin granjas, en la tierra del trigo y desde el nivel 1
  { id: 'ganado', nombre: 'Ganado', conArticulo: 'el ganado', aldea: 'Aldea ganadera', granja: 'Corral', produce: 'livestock', nivelMadre: 1, corrales: true, granjas: false, uso: 'Corrales con un rebaño que crece solo y da ganado, carne y leche. Sin granjas: pasta en la tierra del trigo.' },
];
/** Un cultivo con lo que dicen los datos de juego (`PUEBLOS_EXTRACTORES.aldea.cultivos`) por encima de lo de serie. */
function cultivo(id: Cultivo): (typeof CULTIVOS)[number] {
  const base = CULTIVOS.find((c) => c.id === id) ?? CULTIVOS[0]!;
  const datos = params()?.aldea?.cultivos?.[id];
  return datos ? { ...base, produce: datos.produce, nivelMadre: datos.nivelMadre, corrales: datos.corrales, granjas: datos.granjas ?? true } : base;
}
/** Lo que tiene una aldea en un nivel, según lo que lleva su cultivo: «2 granjas», «1 corral» (la ganadera). */
function piezasDeAldea(c: (typeof CULTIVOS)[number], n: { granjas: number; corrales: number }): string {
  const cuenta = (k: number, uno: string, varios: string): string => `${k} ${k === 1 ? uno : varios}`;
  return [c.granjas ? cuenta(n.granjas, 'granja', 'granjas') : '', c.corrales ? cuenta(n.corrales, 'corral', 'corrales') : ''].filter(Boolean).join(' y ');
}
/** El cultivo de una aldea; sin el dato, trigo (las de antes de la tanda 69). */
const cultivoDe = (x: PuebloDeMapa): Cultivo => (esCultivo(x.cultivo) ? x.cultivo : 'trigo');
interface Especie { topePorCorral: number; pieDeCriaPorCorral: number; crecimientoPorHora: number; productos: Record<string, number> }

/** Los tipos de nodo que admiten un pueblo extractor (el ganado ya no: sale de las aldeas). */
const NODOS_EXTRAIBLES = new Set(['piedra', 'cobre', 'estano', 'hierro', 'oro']);
const ESPECIE_NOMBRE: Record<string, string> = { vacuno: 'vacuno' };

const distancia = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const n0 = (v: number): string => String(Math.floor(v));
const listaRecursos = (r: Record<string, number>): string =>
  Object.entries(r).filter(([, n]) => n > 0).map(([k, n]) => `${Math.ceil(n)} ${RECURSO_NOMBRE[k] ?? k}`).join(', ');
/** El carro de acarreo con su buey (un carro básico de la flota), que toda obra de pueblo se lleva además de lo suyo. */
function costeCarro(): Record<string, number> | undefined {
  const c = catalogoDeCaravanas(alLlegarDatos);
  return c ? sumar(c.carros.basico?.costo, c.animales.buey?.costo) : undefined;
}
const sumar = (...xs: (Record<string, number> | undefined)[]): Record<string, number> => {
  const r: Record<string, number> = {};
  for (const x of xs) for (const [k, n] of Object.entries(x ?? {})) r[k] = (r[k] ?? 0) + n;
  return r;
};

export const esAldea = (x: { tipo: string }): boolean => x.tipo === 'aldeaAgricola';
/** El nombre de un pueblo sin su nivel: «Aldea de trigo», «Cantera», «Mina de estaño». */
const nombreSinNivel = (x: PuebloDeMapa): string => (esAldea(x) ? cultivo(cultivoDe(x)).aldea : EDIFICIO_NOMBRE[x.tipo] ?? x.tipo);
/** El nombre de un pueblo con su nivel, si llega: la aldea y, desde el motor c1ad93d, también la Cantera y las minas. */
export function nombreDePueblo(x: PuebloDeMapa): string {
  return `${nombreSinNivel(x)}${x.nivelAldea ? ` (nivel ${x.nivelAldea})` : ''}`;
}
/** El nivel de un pueblo; sin el dato (un extractor de antes del motor c1ad93d), 1. */
export const nivelDePueblo = (x: PuebloDeMapa): number => x.nivelAldea ?? 1;
const NOMBRE_OBRA: Record<ObraDeMapa['tipo'], string> = {
  pueblo: 'Obra de pueblo', aldea: 'Obra de aldea agrícola', mejoraAldea: 'Mejora de aldea', avanzada: 'Obra de avanzada', mejoraAvanzada: 'Mejora de avanzada', reparacion: 'Reparación de avanzada',
};

// ---------------------------------------------------------------- los niveles de la Cantera y las minas (motor c1ad93d, 2026-11-10)
// Suben del 1 al 3 con la orden de la aldea (`mejorarAldea { heroeId, puebloId }`), la del Gobernador o el Maestro de Obras de la madre, y solo si
// la madre tiene ya el nivel operativo que pide el siguiente (`PUEBLOS_EXTRACTORES.extractor.niveles.N.nivelMadre`; si no, `pueblo.nivel_insuficiente`).
// La mejora deja una obra de materiales (`ObraDeMapa` `mejoraAldea` con `destinoId` = el pueblo), como la de la aldea; mientras, saca con su nivel de antes.

/** El nivel `n` de la Cantera y las minas, de los datos de juego. */
const nivelDeExtractor = (n: number): NivelExtractor | undefined => params()?.extractor?.niveles?.[String(n)];

/** Lo que multiplica el nivel de un extractor lo que saca (y los trabajadores que pide); sin los datos, su propio nivel (1, 2, 3). */
export const factorDeExtractor = (x: PuebloDeMapa): number => nivelDeExtractor(nivelDePueblo(x))?.factor ?? nivelDePueblo(x);

/** El nivel siguiente de un extractor, si lo hay y la madre tiene ya el nivel operativo que pide; si no, nada (no se enseña el botón). */
export function siguienteDeExtractor(x: PuebloDeMapa, madre: { nivel: number; nivelActual?: number } | undefined): (NivelExtractor & { nivel: number; coste: Record<string, number> }) | undefined {
  if (esAldea(x) || !madre) return undefined;
  const nivel = nivelDePueblo(x) + 1;
  const sig = nivelDeExtractor(nivel);
  if (!sig?.coste) return undefined;
  return (madre.nivelActual ?? madre.nivel) >= (sig.nivelMadre ?? 1) ? { ...sig, coste: sig.coste, nivel } : undefined;
}

const VECES: Record<number, string> = { 2: 'el doble', 3: 'el triple' };
const veces = (f: number): string => VECES[f] ?? `×${f}`;

/** «Al nivel N: …» del botón de mejora de un extractor (sin cifras). */
const textoMejoraExtractor = (n: { nivel: number; factor: number }): string =>
  `Al nivel ${n.nivel}: saca ${veces(n.factor)} que en el nivel 1 y pide ${veces(n.factor)} de trabajadores a la plaza. Lo que pide se lleva al pueblo como una obra.`;

/** La ficha de lo que saca un extractor por su nivel: el recurso y su multiplicador. */
function chipDeExtraccion(x: PuebloDeMapa, e: Escapar): string {
  const f = factorDeExtractor(x);
  const r = recursoDeExtractor(x.tipo);
  const titulo = f > 1 ? `Por su nivel saca ${veces(f)} que en el nivel 1, y pide ${veces(f)} de trabajadores a la plaza` : 'Lo que saca de serie: cada nivel más lo multiplica';
  return `<span class="obra-chip" title="${e(titulo)}">${RECURSO_ICONO[r] ?? '⛏'} ${e(RECURSO_NOMBRE[r] ?? r)} ×${f}</span>`;
}

/** ¿Puede el jugador subir de nivel los pueblos de esa madre? Su Gobernador o su Maestro de Obras (desde la plaza o desde dentro del pueblo). */
function gestionaLaMadre(p: ProyeccionJugador, madreId: string): boolean {
  const a = madreDe(p, { madreId }).a ?? ({ id: madreId } as Asentamiento);
  return tieneCargoEnPlaza(p, a, 'gobernador') || tieneCargoEnPlaza(p, a, 'maestroObras');
}
/** El pueblo de una obra: comparten número (`obra-7` ↔ `pueblo-7`). */
const puebloDeObra = (obraId: string): string => obraId.replace(/^obra-/, 'pueblo-');
const faltan = (o: ObraDeMapa): Record<string, number> =>
  Object.fromEntries(Object.entries(o.requerido).map(([k, n]) => [k, Math.max(0, n - (o.entregado[k] ?? 0))] as const).filter(([, n]) => n > 0));

/** Repinta cuando llegan los datos de juego (la primera vez se piden en segundo plano). */
const alLlegarDatos = (): void => { if (estadoCliente.proyeccionUltima) alCargarDatos?.(); };
const params = (): ParamsPueblos | null => bloqueDeDatos<ParamsPueblos>('PUEBLOS_EXTRACTORES', alLlegarDatos);
let alCargarDatos: (() => void) | undefined;

function nombrePlaza(p: ProyeccionJugador, id: string): string {
  return p.asentamientos.find((a) => a.id === id)?.nombre ?? p.asentamientosAvistados?.find((a) => a.id === id)?.nombre ?? id;
}

/** ¿Está `q` dentro del polígono `zona`? (par-impar). */
export function dentro(q: Point, zona: Point[]): boolean {
  let c = false;
  for (let i = 0, j = zona.length - 1; i < zona.length; j = i++) {
    const a = zona[i]!, b = zona[j]!;
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Los de esta plaza: pueblos activos y obras de pueblo o aldea (las de avanzada van aparte). */
function deLaPlaza(p: ProyeccionJugador, a: Asentamiento): { pueblos: PuebloDeMapa[]; obras: ObraDeMapa[] } {
  return {
    pueblos: (p.pueblos ?? []).filter((x) => x.propio && x.madreId === a.id),
    obras: (p.obrasDeMapa ?? []).filter((o) => o.propia && o.madreId === a.id && (o.tipo === 'pueblo' || o.tipo === 'aldea' || o.tipo === 'mejoraAldea')),
  };
}

/** Pueblos que ocupan cupo: los activos y las obras de pueblo o aldea (pendientes o levantándose); la mejora de una aldea no suma. */
function cupo(p: ProyeccionJugador, a: Asentamiento): { usados: number; total: number | null } {
  const { pueblos, obras } = deLaPlaza(p, a);
  const total = params()?.cupoPorNivel?.[String(a.nivelActual ?? a.nivel)];
  return { usados: pueblos.length + obras.filter((o) => o.tipo !== 'mejoraAldea').length, total: total ?? null };
}

/** Nodos de piedra o mineral dentro de la zona real de la plaza que aún no tienen pueblo ni obra. */
function nodosLibres(p: ProyeccionJugador, a: Asentamiento): { id: string; tipo: string; d: number }[] {
  const zona = a.zonaReal;
  const nodos = estadoCliente.mapaCache?.mapa.nodos ?? [];
  if (!zona || zona.length < 3) return [];
  const ocupados = new Set([...(p.pueblos ?? []).map((x) => x.nodoId), ...(p.obrasDeMapa ?? []).map((o) => o.nodoId)].filter(Boolean));
  return nodos
    .filter((n) => NODOS_EXTRAIBLES.has(n.tipo) && !ocupados.has(n.id) && dentro(n.posicion, zona))
    .map((n) => ({ id: n.id, tipo: n.tipo, d: distancia(n.posicion, a.posicion) }))
    .sort((x, y) => x.d - y.d);
}

// ---------------------------------------------------------------- plaza: lo que hay en su zona

const NOMBRE_NODO: Record<string, string> = { piedra: 'Piedra', cobre: 'Cobre', estano: 'Estaño', hierro: 'Hierro', oro: 'Oro', ganado: 'Ganado' };

/** Lo que ocupa un nodo o una parcela: los edificios que lo explotan (`fuenteId`, de las plazas que el cliente ve por dentro) y los pueblos y obras. */
export function fuentesOcupadas(p: ProyeccionJugador): Set<string> {
  return new Set([
    ...[...p.asentamientos, ...(p.asentamientosAvistados ?? [])].flatMap((x) => (x.edificios ?? []).map((ed) => ed.fuenteId)),
    ...(p.pueblos ?? []).map((x) => x.nodoId),
    ...(p.obrasDeMapa ?? []).map((o) => o.nodoId),
  ].filter((x): x is string => Boolean(x)));
}

/** Las parcelas de bosque de dentro de `zona` (un polígono) o de un círculo, con si están ocupadas. */
export function parcelasEn(p: ProyeccionJugador, dentroDe: (q: Point) => boolean): { libres: number; ocupadas: number } {
  const ocupadas = fuentesOcupadas(p);
  const todas = (estadoCliente.mapaCache?.mapa.parcelas ?? []).filter((x) => dentroDe(x.centro));
  const usadas = todas.filter((x) => ocupadas.has(x.id)).length;
  return { libres: todas.length - usadas, ocupadas: usadas };
}

/** El icono de lo que hay en un nodo (su recurso; el ganado, un buey). */
const iconoNodo = (t: string): string => (t === 'ganado' ? '🐂' : RECURSO_ICONO[t] ?? '⛏️');
const coma = (n: number): string => n.toFixed(2).replace('.', ',');
/** Un coste en fichas con icono, sin comparar con el almacén (lo que se lleva al sitio). */
const costeLlano = (coste: Record<string, number>, e: Escapar): string =>
  Object.entries(coste).filter(([, n]) => n > 0).map(([r, n]) => `<span class="obra-coste" title="${e(`${Math.ceil(n)} ${RECURSO_NOMBRE[r] ?? r}`)}">${RECURSO_ICONO[r] ?? '📦'}${Math.ceil(n)}</span>`).join('');
/** Unas casillas, `llenas` de `total` (el cupo de pueblos o de avanzadas). */
const casillas = (llenas: number, total: number): string =>
  `<span class="cupo-casillas" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i${i < llenas ? ' class="usada"' : ''}></i>`).join('')}</span>`;

/**
 * La cabecera de la pestaña Territorio: lo que hay ahora en la zona de influencia de la plaza, una ficha por tipo de nodo y otra para las parcelas
 * de bosque, con los libres en grande y una casilla por sitio (en verde, los libres). Con aire de juego (2026-11-02).
 */
function htmlZona(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const titulo = `<div class="obra-titulo"><span class="faction-kicker">Zona de influencia</span>${ayuda('plaza:zona', 'Lo que cae ahora dentro de la zona de la plaza (crece con su nivel y con las fronteras de las vecinas). Un nodo lo ocupa un pueblo o un edificio que lo explota; una parcela de bosque, una Leñera. Las casillas verdes son los sitios libres.')}</div>`;
  const zona = a.zonaReal;
  if (!zona || zona.length < 3 || !estadoCliente.mapaCache) return `${titulo}<p class="asent-lado-nota">La zona de la plaza aún no ha llegado.</p>`;
  const ocupadas = fuentesOcupadas(p);
  const nodos = estadoCliente.mapaCache.mapa.nodos.filter((n) => dentro(n.posicion, zona));
  const porTipo = new Map<string, { libres: number; ocupados: number }>();
  for (const n of nodos) {
    const t = porTipo.get(n.tipo) ?? { libres: 0, ocupados: 0 };
    if (ocupadas.has(n.id)) t.ocupados++; else t.libres++;
    porTipo.set(n.tipo, t);
  }
  const parcelas = parcelasEn(p, (q) => dentro(q, zona));
  const ficha = (icono: string, nombre: string, libres: number, ocupados: number, ocupa: string): string => {
    const total = libres + ocupados;
    const sitios = total <= 12
      ? `<span class="zona-casillas" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i${i < libres ? ' class="libre"' : ''}></i>`).join('')}</span>`
      : barraAvance(total ? libres / total : 0);
    return `<div class="zona-ficha${libres ? '' : ' agotada'}" title="${e(`${nombre}: ${libres} libre${libres === 1 ? '' : 's'} de ${total}. Lo ocupa ${ocupa}.`)}">
      <span class="zona-icono" aria-hidden="true">${icono}</span><span class="zona-nombre">${e(nombre)}</span>
      <span class="zona-libres"><b>${libres}</b><small>libre${libres === 1 ? '' : 's'} de ${total}</small></span>${sitios}</div>`;
  };
  const fichas = [...porTipo.entries()].sort(([x], [y]) => x.localeCompare(y))
    .map(([t, n]) => ficha(iconoNodo(t), NOMBRE_NODO[t] ?? t, n.libres, n.ocupados, t === 'ganado' ? 'un edificio' : 'un pueblo o un edificio'));
  fichas.push(ficha('🌲', 'Bosque', parcelas.libres, parcelas.ocupadas, 'una Leñera'));
  return `${titulo}<div class="zona-fichas">${fichas.join('')}</div>`;
}

// ---------------------------------------------------------------- plaza: subpestaña «Territorio» (la zona y sus pueblos)

/** El rebaño de una aldea, con su tope (cabezas por corral × corrales del nivel) si llegaron los datos. */
function rebanoDe(x: PuebloDeMapa): { cabezas: number; tope?: number; especie: string } | null {
  if (!x.rebano) return null;
  const especie = bloqueDeDatos<Record<string, Especie>>('ESPECIES', alLlegarDatos)?.[x.rebano.especie];
  const corrales = params()?.aldea?.niveles?.[String(x.nivelAldea ?? 1)]?.corrales;
  return { cabezas: x.rebano.cabezas, tope: especie && corrales ? especie.topePorCorral * corrales : undefined, especie: ESPECIE_NOMBRE[x.rebano.especie] ?? x.rebano.especie };
}

const ESTADO_CARRO_ICONO: Record<string, string> = { disponible: '⏸', en_transito: '➡', retornando: '↩', preparando: '📦', adjunta: '🔗', aparcada: '⏸' };
const fichaRecurso = (r: string, n: number, e: Escapar): string => `<span class="pueblo-recurso" title="${e(RECURSO_NOMBRE[r] ?? r)}">${RECURSO_ICONO[r] ?? '📦'} ${n0(n)}</span>`;

/** El carro de acarreo dentro de la tarjeta del pueblo: dónde va y lo que lleva, y su escolta (que se cede con el carro parado). */
function carroEnTarjeta(p: ProyeccionJugador, x: PuebloDeMapa, madre: Asentamiento, e: Escapar): string {
  if (!x.carroId) return `<div class="pueblo-carro sin"><span class="pueblo-carro-icono">${ICONO_CARRETA}</span><span class="pueblo-carro-texto"><b>Sin carro de acarreo</b><small>La plaza lo repone sola en cuanto puede pagarlo. Mientras, el pueblo acumula hasta llenarse.</small></span></div>`;
  const c = p.caravanas.find((k) => k.id === x.carroId);
  if (!c) return `<div class="pueblo-carro"><span class="pueblo-carro-icono">${ICONO_CARRETA}</span><span class="pueblo-carro-texto"><b>Carro de acarreo</b></span></div>`;
  const estado = c.estado ?? '';
  const carga = Object.entries(c.contenido ?? {}).filter(([, n]) => n > 0);
  const reside = [...(madre.heroesFundadoresIds ?? []), ...(madre.casasCompradas ?? [])].includes(p.heroeId);
  return `<div class="pueblo-carro ${e(estado)}"><span class="pueblo-carro-icono">${ICONO_CARRETA}</span>
      <span class="pueblo-carro-texto"><b>Carro de acarreo</b><small>${ESTADO_CARRO_ICONO[estado] ?? ''} ${e(ESTADO_CARRO[estado] ?? estado)}</small></span>
      ${carga.length ? `<span class="pueblo-carro-carga">${carga.map(([r, n]) => fichaRecurso(r, n, e)).join('')}</span>` : ''}</div>
    <div class="caravana-seccion">${escolta(c, p, reside, c.estado === 'disponible', puntosDeEscoltaDelCarro(madre, alLlegarDatos), e)}</div>`;
}

/**
 * Un pueblo de la plaza como tarjeta (2026-11-02): su emblema (🌾 la aldea, el edificio del extractor), su medallón de nivel (el del extractor desde
 * el motor c1ad93d, con lo que saca por él), el almacén en barra, el rebaño, la fertilidad, el carro de acarreo con su escolta y, para quien
 * gestiona, «⬆ Nivel N» (en un extractor, solo con la madre al nivel que pide), «🛒 Reponer carro» y «✕ Destruir».
 */
function tarjetaPueblo(p: ProyeccionJugador, a: Asentamiento, x: PuebloDeMapa, gestiona: boolean, obras: ObraDeMapa[], e: Escapar): string {
  const aldea = esAldea(x);
  const cult = cultivo(cultivoDe(x));
  const niveles = params()?.aldea?.niveles ?? {};
  const nivel = nivelDePueblo(x);
  const deAhora = aldea ? niveles[String(nivel)] : undefined;
  const siguiente = aldea && x.nivelAldea ? niveles[String(x.nivelAldea + 1)] : undefined;
  const sigExtractor = siguienteDeExtractor(x, a);
  const mejorando = obras.some((o) => o.tipo === 'mejoraAldea' && o.destinoId === x.id);
  const guardado = Object.values(x.almacen).reduce((t, n) => t + n, 0);
  const k = x.capacidad > 0 ? Math.min(1, guardado / x.capacidad) : 0;
  const recursos = Object.entries(x.almacen).filter(([, n]) => n > 0);
  const r = rebanoDe(x);
  const nodo = x.nodoId ? estadoCliente.mapaCache?.mapa.nodos.find((n) => n.id === x.nodoId) : undefined;
  const sub = `${nodo ? `${NOMBRE_NODO[nodo.tipo] ?? nodo.tipo} · ` : ''}a ${n0(distancia(x.posicion, a.posicion))} u de la plaza`;
  const chips = [
    x.batallaId ? '<span class="pueblo-alerta">⚔ ¡Atacado!</span>' : '',
    mejorando ? `<span class="obra-chip activa" title="La mejora está en marcha: mira su obra en la lista">🔨 Subiendo a ${nivel + 1}</span>` : '',
    // la fertilidad hace crecer las granjas; a la cría no le cambia nada (la ganadera, motor 3d05872)
    x.fertilidad !== undefined && cult.granjas ? `<span class="obra-chip" title="Fertilidad del punto de la aldea">🌱 ${coma(x.fertilidad)}</span>` : '',
    aldea ? '' : chipDeExtraccion(x, e),
    deAhora && cult.granjas ? `<span class="obra-chip" title="Granjas de la aldea">${RECURSO_ICONO[cult.produce] ?? '🌾'} ${deAhora.granjas} granja${deAhora.granjas === 1 ? '' : 's'}</span>` : '',
    deAhora && cult.corrales ? `<span class="obra-chip" title="Corrales de la aldea">🐄 ${deAhora.corrales} corral${deAhora.corrales === 1 ? '' : 'es'}</span>` : '',
  ].join('');
  const coste = costeCarro();
  const acciones = !gestiona ? '' : `<div class="anillo-acciones pueblo-acciones">
      ${aldea && siguiente && !mejorando ? `<button class="anillo-mejorar" type="button" data-pueblo-accion="mejorar" data-pueblo="${e(x.id)}" title="${e(`Al nivel ${nivel + 1}: ${piezasDeAldea(cult, siguiente)}. Lo que pide se lleva a la aldea como una obra.`)}">⬆ Nivel ${nivel + 1} <span class="pueblo-boton-coste">${costeLlano(siguiente.coste, e)}</span></button>` : ''}
      ${sigExtractor && !mejorando ? `<button class="anillo-mejorar" type="button" data-pueblo-accion="mejorar" data-pueblo="${e(x.id)}" title="${e(textoMejoraExtractor(sigExtractor))}">⬆ Nivel ${sigExtractor.nivel} <span class="pueblo-boton-coste">${costeLlano(sigExtractor.coste, e)}</span></button>` : ''}
      ${x.carroId ? '' : `<button class="pueblo-boton" type="button" data-pueblo-accion="carro" data-pueblo="${e(x.id)}" title="Compra en la plaza un carro con su buey para el acarreo (si no, la plaza lo repone sola en cuanto puede pagarlo).">🛒 Reponer carro${coste ? ` <span class="pueblo-boton-coste">${chipsDeCoste(a, coste, e)}</span>` : ''}</button>`}
      <button class="anillo-abandonar" type="button" data-pueblo-accion="destruir" data-pueblo="${e(x.id)}">✕ Destruir</button></div>`;
  return `<div class="pueblo-tarjeta ${aldea ? 'aldea' : 'extractor'}${x.batallaId ? ' atacado' : ''}">
    <div class="anillo-cab"><span class="pueblo-emblema" aria-hidden="true">${aldea ? RECURSO_ICONO[cult.produce] ?? '🌾' : iconoEdificio(x.tipo, 26)}</span>
      <span class="anillo-titulo"><strong>${e(nombreSinNivel(x))}</strong><small>${e(sub)}</small></span>
      ${medallonNivel(nivel, mejorando ? 'en-obra' : '', `${aldea ? 'Aldea' : x.tipo === 'cantera' ? 'Cantera' : 'Mina'} de nivel ${nivel}`)}</div>
    ${chips ? `<div class="anillo-chips">${chips}</div>` : ''}
    <div class="pueblo-medida${k >= 0.9 ? ' lleno' : ''}" title="Almacén del pueblo: lo acarrea su carro a la plaza; lleno, deja de producir"><span>📦 Almacén</span>${barraAvance(k)}<small>${n0(guardado)} / ${n0(x.capacidad)}</small></div>
    ${recursos.length ? `<div class="pueblo-recursos">${recursos.map(([rr, n]) => fichaRecurso(rr, n, e)).join('')}</div>` : ''}
    ${r ? `<div class="pueblo-medida rebano" title="${e(`Rebaño de ${r.especie}: crece solo hasta llenar los corrales`)}"><span>🐂 Rebaño</span>${r.tope ? barraAvance(Math.min(1, r.cabezas / r.tope)) : '<span></span>'}<small>${n0(r.cabezas)}${r.tope ? ` / ${r.tope}` : ''}</small></div>` : ''}
    ${carroEnTarjeta(p, x, a, e)}
    ${acciones}
  </div>`;
}

const ICONO_OBRA: Record<ObraDeMapa['tipo'], string> = { pueblo: '⛏️', aldea: '🌾', mejoraAldea: '⬆️', avanzada: '🗼', mejoraAvanzada: '⬆️', reparacion: '🔧' };

/** Una obra de mapa como tarjeta: lo entregado de cada material en fichas con barra (como un trueque) o, levantándose, lo que le queda. */
function tarjetaObra(p: ProyeccionJugador, a: Asentamiento, o: ObraDeMapa, gestiona: boolean, e: Escapar): string {
  const levantando = o.terminaEn !== undefined;
  const completa = !levantando && Object.keys(faltan(o)).length === 0;
  const estado = levantando ? 'levantando' : completa ? 'completa' : 'pendiente';
  const nodo = o.nodoId ? estadoCliente.mapaCache?.mapa.nodos.find((n) => n.id === o.nodoId) : undefined;
  const sub = `${nodo ? `${NOMBRE_NODO[nodo.tipo] ?? nodo.tipo} · ` : ''}a ${n0(distancia(o.posicion, a.posicion))} u de la plaza`;
  const lineas = Object.entries(o.requerido).map(([r, n]) => {
    const hay = Math.min(n, o.entregado[r] ?? 0);
    return `<span class="pacto-linea${hay >= n ? ' entregada' : ''}" title="${e(`${RECURSO_NOMBRE[r] ?? r}: entregado ${n0(hay)} de ${n}`)}"><i>${RECURSO_ICONO[r] ?? '📦'}</i><b>${n0(hay)}<small>/${n}</small></b>${barraAvance(n ? hay / n : 1)}</span>`;
  }).join('');
  const deAvanzada = o.tipo === 'avanzada' || o.tipo === 'mejoraAvanzada' || o.tipo === 'reparacion';
  const cancelar = gestiona && o.tipo !== 'mejoraAldea' ? `<div class="anillo-acciones"><button class="anillo-abandonar" type="button" ${deAvanzada ? `data-pueblo-accion="cancelar-obra" data-obra="${e(o.id)}"` : `data-pueblo-accion="destruir" data-pueblo="${e(puebloDeObra(o.id))}"`} title="Cancela la obra: no devuelve lo entregado.">✕ Cancelar</button></div>` : '';
  return `<div class="obra-mapa ${estado}">
    <div class="anillo-cab"><span class="pueblo-emblema" aria-hidden="true">${ICONO_OBRA[o.tipo]}</span>
      <span class="anillo-titulo"><strong>${e(nombreDeObra(o, p))}</strong><small>${e(sub)}</small></span>
      <span class="anillo-estado">${levantando ? '🔨 Levantándose' : completa ? '✓ Materiales' : '📦 Faltan materiales'}</span></div>
    ${levantando ? `<div class="anillo-avance">${barraAvance(null)}<small>⏳ ${e(textoEnTiempoReal(o.terminaEn! - p.instante))}</small></div>`
      : `<div class="pacto-lineas">${lineas}</div>${completa ? '' : '<small class="obra-mapa-nota">Una columna de tu Facción lo lleva y lo entrega a la puerta de la obra.</small>'}`}
    ${cancelar}
  </div>`;
}

/** El nodo marcado en «Extractor» (se recuerda entre repintados). */
let nodoElegido = '';
/** El cultivo elegido para la aldea nueva (se recuerda entre repintados; si la Facción no llega a su nivel, vuelve al trigo). */
let cultivoElegido: Cultivo = 'trigo';

/** El mayor nivel ALCANZADO (no el operativo) entre las plazas que la Facción de `a` tiene ahora, como el motor (`nivel_maximo_de_plazas`, b55e90f):
 * lo que desbloquea los cultivos de las aldeas. Las plazas propias llegan todas en FACCION (como avistadas, con su nivel) y la de dentro, en
 * `asentamientos`. */
export function nivelAlcanzadoEnLaFaccion(p: ProyeccionJugador, a: Asentamiento): number {
  const propias = [...(p.asentamientos ?? []), ...(p.plazasPropias ?? []), ...(p.asentamientosAvistados ?? [])].filter((x) => x.faccionId === a.faccionId);
  return Math.max(a.nivel, ...propias.map((x) => x.nivel));
}

/** Los cultivos que la Facción del jugador ya desbloqueó (por el mayor nivel alcanzado entre sus plazas, como `nivelAlcanzadoEnLaFaccion`): las
 * capas de fertilidad del mapa enseñan solo esos (Víctor, 2026-11-10: «que el jugador no pueda ver los que no tiene disponibles»). Sin Facción
 * ni plazas, los de nivel 1 (el trigo). La ganadera no sale: no tiene capa propia, mira la del trigo. */
export function cultivosDesbloqueados(p: ProyeccionJugador | null | undefined): Cultivo[] {
  const fid = p?.faccionId;
  const propias = p && fid ? [...(p.asentamientos ?? []), ...(p.plazasPropias ?? []), ...(p.asentamientosAvistados ?? [])].filter((x) => x.faccionId === fid) : [];
  const nivel = Math.max(1, ...propias.map((x) => x.nivel));
  return CULTIVOS.map((c) => cultivo(c.id)).filter((c) => nivel >= c.nivelMadre && capaDeCultivo(c.id) === c.id).map((c) => c.id);
}

/** Los cultivos que puede tener la siguiente aldea de esta plaza: los que ya desbloqueó su Facción, sea cual sea el nivel de la madre (motor
 * b55e90f; regla de interfaz: lo que no se puede no se enseña). */
const cultivosPosibles = (p: ProyeccionJugador, a: Asentamiento): (typeof CULTIVOS)[number][] => {
  const nivel = nivelAlcanzadoEnLaFaccion(p, a);
  return CULTIVOS.map((c) => cultivo(c.id)).filter((c) => nivel >= c.nivelMadre);
};
const cultivoDeLaAldeaNueva = (p: ProyeccionJugador, a: Asentamiento): (typeof CULTIVOS)[number] => cultivosPosibles(p, a).find((c) => c.id === cultivoElegido) ?? cultivo('trigo');

/** Marcar un pueblo nuevo: dos cartas, la aldea (con su coste, su anillo y si hay tierra) y el extractor (los nodos libres como casillas). */
function htmlMarcar(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const pr = params();
  const nivel = a.nivelActual ?? a.nivel;
  const { usados, total } = cupo(p, a);
  const titulo = '<div class="obra-titulo"><span class="faction-kicker">Marcar un pueblo nuevo</span></div>';
  if (total !== null && usados >= total) return `${titulo}<p class="pueblo-aviso">🏘 Cupo lleno: para marcar otro pueblo, sube la plaza de nivel o destruye uno.</p>`;
  const aldea1 = pr?.aldea?.niveles?.['1'];
  const costeAldea = aldea1 ? sumar(aldea1.coste, pr?.costeAdicional, costeCarro()) : null;
  const nivelAldea = pr?.nivelMadreMinimo?.aldea ?? 1, nivelExtractor = pr?.nivelMadreMinimo?.extractor ?? 1;
  const libres = nivel >= nivelExtractor ? nodosLibres(p, a) : [];
  const elegido = libres.some((n) => n.id === nodoElegido) ? nodoElegido : libres[0]?.id;
  const anillo = anilloDeAldea(p, a);
  const sinAldea = nivel < nivelAldea;
  // El cultivo (tanda 69): trigo siempre; los demás, en cuanto una plaza de la Facción llega a su nivel. Con uno solo posible no hay nada que elegir.
  const posibles = cultivosPosibles(p, a);
  const deLaAldea = cultivoDeLaAldeaNueva(p, a);
  const cultivos = posibles.length > 1
    ? `<div class="pueblo-cultivos" role="radiogroup" aria-label="Cultivo de la aldea">${posibles.map((c) => `<label class="pueblo-nodo pueblo-cultivo"><input type="radio" name="pueblo-cultivo" value="${c.id}" data-pueblo-cultivo${c.id === deLaAldea.id ? ' checked' : ''}><span aria-hidden="true">${RECURSO_ICONO[c.produce] ?? '🌾'}</span><b>${e(c.nombre)}</b></label>`).join('')}</div>`
    : '';
  const sinExtractor = nivel < nivelExtractor || libres.length === 0;
  const carta = (bloqueada: boolean, cuerpo: string): string => `<div class="pueblo-opcion${bloqueada ? ' bloqueada' : ''}">${cuerpo}</div>`;
  return `${titulo}<div class="pueblo-opciones">
    ${carta(sinAldea, `<span class="pueblo-opcion-icono" aria-hidden="true">${RECURSO_ICONO[deLaAldea.produce] ?? '🌾'}</span>
      <strong>${deLaAldea.id === 'ganado' ? 'Aldea ganadera' : 'Aldea agrícola'}${ayuda('pueblos:aldea', `Granjas en un punto fértil de la zona para su cultivo (fertilidad ${pr?.aldea?.fertilidadMinima ?? 0.3} o más, a ${pr?.aldea?.separacionMinima ?? 3} de toda plaza y todo pueblo, con camino hasta la plaza). El cultivo se elige al marcarla y no cambia: trigo; ganado, la aldea ganadera, sin granjas y con corrales y un rebaño que crece solo y da ganado, carne y leche, que pasta en la tierra del trigo; vid o cebada, que dan uva o cebada para la bodega (el vino o la cerveza), en cuanto una plaza de tu Facción llega al nivel ${cultivo('vid').nivelMadre}; u olivo o sésamo, que dan aceituna o sésamo para la prensa (el aceite), desde que una llega al ${cultivo('oliva').nivelMadre}. La plaza que marca la aldea puede ser de cualquier nivel. Cada cultivo tiene su propia tierra buena: la cebada y el sésamo, la húmeda. Cada aldea va en su anillo: las dos primeras hasta el techo de la zona del nivel 1, la tercera en el anillo que añade el nivel 2, y así, para que no se junten. El nivel 2 de la plaza pide ${pueblosParaElNivel2()}: aldeas o extractores.`)}</strong>
      ${sinAldea ? '' : cultivos}
      <small>${e(deLaAldea.uso)}</small>
      ${sinAldea ? `<span class="anillo-opcion-pide">Desde el nivel ${nivelAldea} de la plaza</span>`
        : `${costeAldea ? `<span class="anillo-opcion-coste" title="Con el carro de acarreo y su buey; se lleva al sitio">${costeLlano(costeAldea, e)}</span>` : ''}
          <small>📍 ${anillo.desde > 0 ? `de ${n0(anillo.desde)} a ` : 'hasta '}${n0(anillo.hasta)} u de la plaza</small>
          ${capaQueFalta(deLaAldea.id) ? `<span class="fundacion-gate falta">${e(capaQueFalta(deLaAldea.id))}</span>` : htmlSitiosDeAldea(sitiosDeLaPlaza(p, a, deLaAldea.id), deLaAldea.conArticulo)}`}
      <button class="pueblo-boton principal" type="button" data-pueblo-accion="elegir-aldea"${sinAldea ? ' disabled' : ''}>🗺 Elegir el sitio</button>`)}
    ${carta(sinExtractor, `<span class="pueblo-opcion-icono" aria-hidden="true">⛏️</span>
      <strong>Extractor${ayuda('pueblos:extractor', 'Una cantera o una mina sobre un nodo libre de la zona. La piedra solo sale de un pueblo de cantera (la Cantera ya no se construye en la plaza), y en el nivel 1 caben dos pueblos: la cantera y la aldea. Pide su edificio, 50 de madera y el carro de acarreo con su buey, que se llevan al sitio.')}</strong>
      <small>Cantera o mina sobre un nodo libre.</small>
      ${nivel < nivelExtractor ? `<span class="anillo-opcion-pide">Desde el nivel ${nivelExtractor} de la plaza</span>`
        : libres.length === 0 ? '<span class="anillo-opcion-pide">No hay nodos de piedra ni de mineral libres en la zona</span>'
          : `<div class="pueblo-nodos">${libres.map((n) => `<label class="pueblo-nodo"><input type="radio" name="pueblo-nodo" value="${e(n.id)}" data-pueblo-nodo${n.id === elegido ? ' checked' : ''}><span aria-hidden="true">${iconoNodo(n.tipo)}</span><b>${e(RECURSO_NOMBRE[n.tipo] ?? n.tipo)}</b><small>a ${n0(n.d)} u</small></label>`).join('')}</div>`}
      <button class="pueblo-boton principal" type="button" data-pueblo-accion="marcar-nodo"${sinExtractor ? ' disabled' : ''}>⛏ Marcar</button>`)}
  </div>`;
}

/** Si la zona tiene sitio para la aldea de ese cultivo (`paraQue`: «el trigo», «la vid», «la cebada»...): en verde con la mejor fertilidad, o en rojo con el porqué. */
function htmlSitiosDeAldea(s: SitiosDeAldea | null, paraQue = 'el trigo'): string {
  if (!s) return '';
  const { fertilidadMinima, separacionMinima } = reglasDeAldea();
  if (s.validos.length) return `<span class="fundacion-gate ok">Hay tierra buena para ${paraQue} en su anillo (mejor fertilidad ${coma(s.mejor)}).</span>`;
  if (s.cerca.length) return `<span class="fundacion-gate falta">La tierra fértil de la zona está a menos de ${separacionMinima} de una plaza o un pueblo. Crecerá la zona con los edificios.</span>`;
  return `<span class="fundacion-gate falta">El anillo de la siguiente aldea no tiene tierra para ${paraQue} con fertilidad ${coma(fertilidadMinima)} o más dentro de la zona: no cabe. La zona crece con cada edificio terminado.</span>`;
}

/** Lo que está abierto bajo la fila de pueblos de Territorio (Víctor, 2026-11-10: un botón con el icono por pueblo, que abre su detalle, uno a
 * la vez; y «Marcar» tras un «+» al principio, plegable): el id de un pueblo o de una obra, `'marcar'`, o `null` (nada). `undefined`: lo de
 * serie, que es «Marcar» abierto si la plaza no tiene ningún pueblo ni obra (y quien mira puede marcar), y nada si tiene. Se olvida al cambiar
 * de plaza. */
let abiertoEnTerritorio: string | null | undefined;
let plazaDeTerritorio = '';

/** Un pueblo u obra como botón con su icono: el tono del borde dice cómo está (atacado, obra a falta de materiales o levantándose), y un
 * distintivo, el nivel de la aldea; el nombre, al pasar el ratón. */
function botonPueblo(id: string, icono: string, nombre: string, tono: string, distintivo: string, abierto: boolean, e: Escapar): string {
  return `<button type="button" class="pueblo-icono-boton${tono ? ` ${tono}` : ''}${abierto ? ' abierto' : ''}" data-pueblo-abrir="${e(id)}" aria-expanded="${abierto}" title="${e(nombre)}" aria-label="${e(nombre)}">`
    + `<span class="pueblo-emblema" aria-hidden="true">${icono}</span>${distintivo}</button>`;
}

function htmlPueblos(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e } = c;
  const { pueblos, obras } = deLaPlaza(p, a);
  const gestiona = c.cargo !== null && c.resideAqui;
  const { usados, total } = cupo(p, a);
  const lleno = total !== null && usados >= total;
  // A ventana completa (Víctor, 2026-11-06): la zona, los pueblos y marcar uno a la izquierda; las avanzadas a la derecha.
  const avanzadas = esDeMiFaccion(p, a) ? htmlAvanzadasDeLaPlaza(p, a, gestiona, c.cargo === 'gobernador' && c.resideAqui, e) : '';
  // qué está abierto: lo elegido, si sigue ahí; si no, lo de serie
  if (plazaDeTerritorio !== a.id) { plazaDeTerritorio = a.id; abiertoEnTerritorio = undefined; }
  const puedeMarcar = gestiona && !lleno;
  const ids = new Set([...pueblos.map((x) => x.id), ...obras.map((o) => o.id)]);
  let abierto = abiertoEnTerritorio === undefined ? (ids.size === 0 && puedeMarcar ? 'marcar' : null) : abiertoEnTerritorio;
  if (abierto === 'marcar' ? !puedeMarcar : abierto !== null && !ids.has(abierto)) abierto = null;

  const botones = [
    puedeMarcar ? `<button type="button" class="pueblo-icono-boton pueblo-marcar-boton${abierto === 'marcar' ? ' abierto' : ''}" data-pueblo-abrir="marcar" aria-expanded="${abierto === 'marcar'}" title="Marcar un pueblo nuevo" aria-label="Marcar un pueblo nuevo"><span class="pueblo-emblema" aria-hidden="true">+</span></button>` : '',
    ...pueblos.map((x) => {
      const aldea = esAldea(x);
      const cult = cultivo(cultivoDe(x));
      const nombre = `${nombreSinNivel(x)}${x.batallaId ? ' · ¡atacado!' : ''}`;
      const distintivo = `<b class="pueblo-icono-nivel">${nivelDePueblo(x)}</b>${x.batallaId ? '<b class="pueblo-icono-alerta" aria-hidden="true">⚔</b>' : ''}`;
      return botonPueblo(x.id, aldea ? RECURSO_ICONO[cult.produce] ?? '🌾' : iconoEdificio(x.tipo, 22), nombre, x.batallaId ? 'atacado' : '', distintivo, abierto === x.id, e);
    }),
    ...obras.map((o) => {
      const levantando = o.terminaEn !== undefined;
      const completa = !levantando && Object.keys(faltan(o)).length === 0;
      const estado = levantando ? 'levantándose' : completa ? 'con todos los materiales' : 'faltan materiales';
      return botonPueblo(o.id, ICONO_OBRA[o.tipo], `${nombreDeObra(o, p)} · ${estado}`, levantando ? 'obra levantando' : completa ? 'obra completa' : 'obra pendiente', '', abierto === o.id, e);
    }),
  ].join('');
  const x = pueblos.find((y) => y.id === abierto), o = obras.find((y) => y.id === abierto);
  const detalle = abierto === 'marcar' ? htmlMarcar(p, a, e)
    : x ? tarjetaPueblo(p, a, x, gestiona, obras, e)
      : o ? tarjetaObra(p, a, o, gestiona, e) : '';
  return `<div class="cols-completa territorio-cols"><div class="col-completa">${htmlZona(p, a, e)}
    <div class="obra-titulo"><span class="faction-kicker">Pueblos</span><span class="obra-chip${lleno ? ' lleno' : ''}" title="Cupo de pueblos por el nivel de la plaza">🏘 ${usados} / ${total ?? '—'}${total ? casillas(usados, total) : ''}</span>${ayuda('plaza:pueblos', 'Un pueblo es de la plaza: se marca aquí, una columna de tu Facción lleva sus materiales hasta la obra en el mapa y los entrega a su puerta (cualquier ciudadano de la columna), y con todo entregado se levanta. Su carro acarrea lo que produce a la plaza. Pulsa un pueblo para ver su detalle, y «+» para marcar uno nuevo.')}</div>
    ${botones ? `<div class="pueblo-iconos">${botones}</div>` : ''}
    ${ids.size === 0 && !puedeMarcar ? '<p class="mapa-lista-vacia">Esta plaza aún no tiene pueblos.</p>' : ''}
    ${detalle ? `<div class="pueblo-detalle">${detalle}</div>` : ''}
    ${gestiona ? (lleno && abierto === null ? '<p class="asent-lado-nota">🏘 Cupo lleno: para marcar otro pueblo, sube la plaza de nivel o destruye uno.</p>' : '')
      : '<p class="asent-lado-nota">Los pueblos los marca, mejora y destruye el Gobernador o el Maestro de Obras, residente y dentro de la plaza.</p>'}
    </div>${avanzadas ? `<div class="col-completa">${avanzadas}</div>` : ''}</div>`;
}

const ESTADO_CARRO: Record<string, string> = { disponible: 'parado en el pueblo', en_transito: 'camino de la plaza, cargado', retornando: 'volviendo vacío al pueblo', preparando: 'cargando', adjunta: 'enganchado a una columna', aparcada: 'aparcado' };

/** El carro de acarreo del pueblo en su interior (pestaña «Acarreo»): dónde va y lo que lleva y, desde su plaza madre (`madre`), su escolta, que se cede con el
 * carro parado. En Territorio va dentro de la tarjeta del pueblo (`carroEnTarjeta`). */
function htmlCarroDeAcarreo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar, madre?: Asentamiento): string {
  const c = x.carroId ? p.caravanas.find((k) => k.id === x.carroId) : undefined;
  if (!x.carroId) return '<p class="asent-lado-nota">Sin carro de acarreo: la plaza madre lo repone sola en cuanto puede pagarlo (o lo compra su Gobernador o su Maestro de Obras con «Reponer carro»). Mientras, el pueblo acumula hasta llenarse.</p>';
  if (!c) return '<p class="asent-lado-nota">Tiene carro de acarreo.</p>';
  const lleva = listaRecursos(c.contenido ?? {});
  const cedidas = (c.escoltaIds ?? []).length;
  const linea = `<p class="asent-lado-nota">Carro de acarreo ${e(ESTADO_CARRO[c.estado ?? ''] ?? c.estado ?? '')}${lleva ? ` con ${e(lleva)}` : ''}${cedidas ? ` · ${cedidas} escuadra(s) de escolta` : ' · sin escolta'}.</p>`;
  if (!madre) return linea;
  const reside = [...(madre.heroesFundadoresIds ?? []), ...(madre.casasCompradas ?? [])].includes(p.heroeId);
  return `${linea}<div class="escolta-caravana">${escolta(c, p, reside, c.estado === 'disponible', puntosDeEscoltaDelCarro(madre, alLlegarDatos), e)}</div>`;
}

/** Quien abre el mapa para elegir un punto (lo pone `main.ts`): `alElegir` devuelve el error del motor, o `null` si salió bien (y el mapa se cierra).
 * `sitios`, si los hay, se pintan sobre el mapa (los de la aldea). */
export const selectorDePunto: { abrir: ((texto: string, centro: Point, zona: Point[] | undefined, alElegir: (q: Point) => Promise<string | null>, sitios?: SitiosDeAldea | null, cultivo?: Cultivo) => void) | null } = { abrir: null };

/** Lo que ocupa sitio para una aldea: las plazas y los pueblos (y sus obras) que se conocen. */
export function ocupadosParaAldea(p: ProyeccionJugador): Point[] {
  return [
    ...p.asentamientos.map((a) => a.posicion),
    ...(p.asentamientosAvistados ?? []).map((a) => a.posicion),
    ...(p.pueblos ?? []).map((x) => x.posicion),
    ...(p.obrasDeMapa ?? []).filter((o) => o.tipo !== 'mejoraAldea').map((o) => o.posicion),
  ];
}

/** Los mínimos de la aldea: fertilidad y separación (`PUEBLOS_EXTRACTORES.aldea`); 0,3 y 3 mientras no lleguen los datos. */
export function reglasDeAldea(): { fertilidadMinima: number; separacionMinima: number } {
  const r = params()?.aldea;
  return { fertilidadMinima: r?.fertilidadMinima ?? 0.3, separacionMinima: r?.separacionMinima ?? 3 };
}

/** El anillo de la siguiente aldea de la plaza (motor 5907aa6, `anillo_de_aldea`): la k-ésima (contando las que tiene en cualquier estado) va
 * en el anillo que añade a la zona el primer nivel cuyo cupo de pueblos llega a k. Con el cupo 2/3/4/5/6 y los techos 10/15/20/25/30 u: las
 * dos primeras hasta 10 u, la tercera de 10 a 15 u, y así. */
export function anilloDeAldea(p: ProyeccionJugador, a: Asentamiento): { desde: number; hasta: number } {
  const { pueblos, obras } = deLaPlaza(p, a);
  const k = pueblos.filter(esAldea).length + obras.filter((o) => o.tipo === 'aldea').length + 1;
  const techos = techosDeZona(alLlegarDatos);
  const cupos = params()?.cupoPorNivel ?? { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  const nivel = Math.min(techos.length, Math.max(1, Number(Object.keys(cupos).map(Number).sort((x, y) => x - y).find((n) => (cupos[String(n)] ?? 0) >= k) ?? techos.length)));
  return { desde: nivel === 1 ? 0 : techos[nivel - 2]!, hasta: techos[nivel - 1]! };
}

/** Si el mapa ya bajado no trae la capa de fertilidad de ese cultivo (un mundo de antes de la cebada y el sésamo), por qué no se ven sus sitios;
 * `''` si la trae o el mapa aún no está. */
export function capaQueFalta(cultivo: Cultivo): string {
  const mapa = estadoCliente.mapaCache?.mapa;
  if (!mapa || capaDe(mapa, cultivo)) return '';
  return `Este mundo no trae la fertilidad ${NOMBRE_DE_CULTIVO[capaDeCultivo(cultivo)].de}: no se pueden enseñar sus sitios (hay que generar el mundo de nuevo).`;
}

/** Los pueblos activos que pide el nivel 2 de una plaza (`NIVEL_ASENTAMIENTO.requisitos.2.pueblosActivos`; dos desde el motor 3d05872). */
function pueblosParaElNivel2(): string {
  const n = bloqueDeDatos<{ requisitos?: Record<string, { pueblosActivos?: number }> }>('NIVEL_ASENTAMIENTO', alLlegarDatos)?.requisitos?.['2']?.pueblosActivos ?? 2;
  return n === 1 ? 'un pueblo activo' : `${n} pueblos activos`;
}

/** Dónde cabe la aldea de ese cultivo en esta plaza, con el mapa ya bajado; `null` si aún no está o no trae la capa de fertilidad del cultivo. */
export
function sitiosDeLaPlaza(p: ProyeccionJugador, a: Asentamiento, cultivo: Cultivo): SitiosDeAldea | null {
  const mapa = estadoCliente.mapaCache?.mapa;
  if (!mapa) return null;
  const { fertilidadMinima, separacionMinima } = reglasDeAldea();
  const radio = Math.max(...(a.zonaReal ?? []).map((q) => Math.hypot(q.x - a.posicion.x, q.y - a.posicion.y)), 6);
  return sitiosDeAldea(mapa, { centro: a.posicion, radio, poligono: a.zonaReal, anillo: anilloDeAldea(p, a) }, ocupadosParaAldea(p), fertilidadMinima, separacionMinima, cultivo);
}

function cablearPueblos(c: ContextoPlaza): void {
  const { proyeccion: p, asentamiento: a, cuerpo } = c;
  alCargarDatos = c.refrescar;
  cablearEscolta(cuerpo, p, c.ejecutar);
  const enviar = async (b: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    b.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    b.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
  };
  cuerpo.querySelectorAll<HTMLSelectElement>('[data-avanzada-tropa]').forEach((sel) => sel.addEventListener('change', () => {
    const avanzadaId = sel.closest<HTMLElement>('[data-avanzada-tarjeta]')?.dataset.avanzadaTarjeta;
    if (!avanzadaId) return;
    sel.disabled = true;
    void c.ejecutar('elegirTropaDeAvanzada', { heroeId: p.heroeId, avanzadaId, tropaId: sel.value }).then((mensaje) => {
      sel.disabled = false;
      if (mensaje) mostrarAviso(mensaje, true);
    });
  }));
  // un botón de la fila abre su detalle (y cierra el que hubiera); otro clic en el mismo lo cierra
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-pueblo-abrir]').forEach((b) => b.addEventListener('click', () => {
    abiertoEnTerritorio = b.getAttribute('aria-expanded') === 'true' ? null : b.dataset.puebloAbrir!;
    c.refrescar();
  }));
  cuerpo.querySelectorAll<HTMLInputElement>('[data-pueblo-nodo]').forEach((r) => r.addEventListener('change', () => { if (r.checked) nodoElegido = r.value; }));
  // el cultivo cambia lo que da y dónde cabe: se repinta la carta
  cuerpo.querySelectorAll<HTMLInputElement>('[data-pueblo-cultivo]').forEach((r) => r.addEventListener('change', () => { if (r.checked) { cultivoElegido = r.value as Cultivo; c.refrescar(); } }));
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-pueblo-accion]').forEach((b) => b.addEventListener('click', () => {
    const puebloId = b.dataset.pueblo ?? '';
    switch (b.dataset.puebloAccion) {
      case 'mejorar': return void enviar(b, 'mejorarAldea', { heroeId: p.heroeId, puebloId });
      case 'carro': return void enviar(b, 'reponerCarroDeAcarreo', { heroeId: p.heroeId, puebloId });
      case 'destruir':
        {
        const pueblo = puebloId.startsWith('pueblo-') && (p.pueblos ?? []).some((x) => x.id === puebloId);
        void confirmar(pueblo ? 'No se recupera nada de lo que guarda ni de lo que costó.' : 'Lo entregado no se devuelve.', { titulo: pueblo ? '¿Destruir el pueblo?' : '¿Cancelar la obra?', aceptar: pueblo ? 'Destruir' : 'Cancelar la obra', cancelar: 'Volver', peligro: true })
          .then((ok) => { if (ok) void enviar(b, 'destruirPueblo', { heroeId: p.heroeId, puebloId }); });
      }
        return;
      case 'marcar-nodo': {
        const nodoId = cuerpo.querySelector<HTMLInputElement>('[data-pueblo-nodo]:checked')?.value;
        if (nodoId) void enviar(b, 'marcarPueblo', { asentamientoId: a.id, heroeId: p.heroeId, nodoId });
        return;
      }
      case 'elegir-aldea': {
        const cult = cultivoDeLaAldeaNueva(p, a);
        // los cuadritos verdes son la tierra buena de SU cultivo (`sitiosDeLaPlaza` con su capa); el modo mapa pone además la capa de
        // fertilidad en ese cultivo si está puesta (0.194.0, Víctor 2026-11-10)
        const sinCapa = capaQueFalta(cult.id);
        selectorDePunto.abrir?.(sinCapa ? `Pulsa en el mapa donde levantar la ${cult.aldea.toLowerCase()}. ${sinCapa}` : `Pulsa en el mapa donde levantar la ${cult.aldea.toLowerCase()}: en verde, la tierra buena para ${cult.conArticulo} de la zona donde cabe (en gris, buena pero pegada a una plaza o un pueblo).`, a.posicion, a.zonaReal,
          (punto) => c.ejecutar('marcarAldea', { asentamientoId: a.id, heroeId: p.heroeId, punto, cultivo: cult.id }), sitiosDeLaPlaza(p, a, cult.id), cult.id);
        return;
      }
      case 'mejorar-avanzada': return void enviar(b, 'mejorarAvanzada', { heroeId: p.heroeId, avanzadaId: b.dataset.avanzada });
      case 'reparar-avanzada': return void enviar(b, 'repararAvanzada', { heroeId: p.heroeId, avanzadaId: b.dataset.avanzada });
      case 'destruir-avanzada':
        void confirmar('Se pierde lo que guarda su almacén, y las escuadras de su guarnición vuelven a los campamentos de sus héroes.', { titulo: '¿Destruir la avanzada?', aceptar: 'Destruir', cancelar: 'Volver', peligro: true })
          .then((ok) => { if (ok) void enviar(b, 'destruirAvanzada', { heroeId: p.heroeId, avanzadaId: b.dataset.avanzada }); });
        return;
      case 'cancelar-obra':
        void confirmar('Lo entregado no se devuelve.', { titulo: '¿Cancelar la obra?', aceptar: 'Cancelar la obra', cancelar: 'Volver', peligro: true })
          .then((ok) => { if (ok) void enviar(b, 'cancelarObra', { heroeId: p.heroeId, obraId: b.dataset.obra }); });
        return;
      case 'elegir-avanzada':
        selectorDePunto.abrir?.('Pulsa en el mapa donde colocar la atalaya: dentro de la zona de la plaza, fuera de la ciudad y sin pisar otro pueblo, avanzada o campamento.', a.posicion, a.zonaReal,
          (punto) => c.ejecutar('colocarAvanzada', { asentamientoId: a.id, heroeId: p.heroeId, posicion: punto }), null);
        return;
    }
  }));
}

export const SUBPESTANA_PUEBLOS: SubpestanaPlaza = { id: 'pueblos', etiqueta: 'Territorio', html: htmlPueblos, cablear: cablearPueblos };

// ---------------------------------------------------------------- mapa: pintar, seleccionar y fichas

const COLOR_AJENO = '#9a927f';

/** Pinta pueblos (casa; granero si es aldea) y obras (martillo, más tenue). Los propios en el color de tu Facción. */
export function dibujarPueblosYObras(ctx: CanvasRenderingContext2D, p: ProyeccionJugador, escala: number, k: number): void {
  const color = (madreId: string, propio: boolean): string => {
    if (!propio) {
      const f = p.asentamientosAvistados?.find((a) => a.id === madreId)?.faccionId;
      return f ? faccionColor(f, p.facciones) : COLOR_AJENO;
    }
    return faccionColor(p.faccionId ?? '', p.facciones);
  };
  for (const x of p.pueblos ?? []) {
    dibujarIconoMapa(ctx, esAldea(x) ? 'aldea' : 'pueblo', x.posicion.x * escala, x.posicion.y * escala, 14 * k, color(x.madreId, x.propio));
  }
  for (const x of p.avanzadas ?? []) {
    ctx.save();
    if (x.enRuinas) ctx.globalAlpha = 0.5;
    dibujarIconoMapa(ctx, 'avanzada', x.posicion.x * escala, x.posicion.y * escala, (11 + 2 * x.etapa) * k, color(x.madreId, x.propia));
    ctx.restore();
  }
  ctx.save();
  for (const o of p.obrasDeMapa ?? []) {
    if (o.tipo === 'mejoraAldea') continue; // la aldea ya se pinta; su mejora se ve en su ficha
    ctx.globalAlpha = o.terminaEn !== undefined ? 0.9 : 0.6;
    dibujarIconoMapa(ctx, 'obra', o.posicion.x * escala, o.posicion.y * escala, 13 * k, color(o.madreId, o.propia));
  }
  ctx.restore();
}

/** Los pueblos, avanzadas y obras bajo el clic, del más cercano al más lejano. Con columna, el clic además la lleva hacia el pueblo, la avanzada o
 * la obra propia sin terminar. */
export function pueblosYObrasBajoElClic(p: ProyeccionJugador, punto: Point): ObjetoBajoElClic[] {
  const conColumna = !!miColumna(p);
  return [
    ...(p.obrasDeMapa ?? []).filter((o) => o.tipo !== 'mejoraAldea').map((o) => ({ tipo: 'obraMapa', id: o.id, d: distancia(o.posicion, punto), o })),
    ...(p.pueblos ?? []).map((x) => ({ tipo: 'puebloMapa', id: x.id, d: distancia(x.posicion, punto), o: undefined, posicion: x.posicion })),
    ...(p.avanzadas ?? []).map((x) => ({ tipo: 'avanzadaMapa', id: x.id, d: distancia(x.posicion, punto), o: undefined, posicion: x.posicion })),
  ].filter((c) => c.d < agarre(12)).sort((a, b) => a.d - b.d).map((c) => {
    // Con columna, el clic lleva hacia el pueblo o la avanzada (como a una plaza) y a una obra propia sin terminar (para entregar a su puerta).
    const destino = c.o ? (c.o.propia && !c.o.terminaEn ? c.o.posicion : undefined) : c.posicion;
    const ir = destino && conColumna ? { tipo: 'punto' as const, punto: destino } : undefined;
    return { tipo: c.tipo, id: c.id, ...(ir ? { ir } : {}) };
  });
}

const ETAPA_AVANZADA: Record<number, string> = { 1: 'Atalaya', 2: 'Fuerte', 3: 'Ciudadela' };
/** Lo que es una avanzada por su etapa, y una obra de mapa por su tipo (para la lista de qué hay bajo un clic). */
export const nombreDeAvanzada = (etapa: number): string => ETAPA_AVANZADA[etapa] ?? 'Avanzada';
/** El nombre de una obra de mapa: la mejora de un extractor dice de qué y a qué nivel («Mejora de la mina a nivel 2»). */
export function nombreDeObra(o: ObraDeMapa, p: ProyeccionJugador | null | undefined = estadoCliente.proyeccionUltima): string {
  const x = o.tipo === 'mejoraAldea' ? (p?.pueblos ?? []).find((y) => y.id === o.destinoId) : undefined;
  if (x && !esAldea(x)) return `Mejora de ${x.tipo === 'cantera' ? 'la cantera' : 'la mina'} a nivel ${nivelDePueblo(x) + 1}`;
  return NOMBRE_OBRA[o.tipo] ?? 'Obra';
}

/** La obra pendiente de la avanzada (mejora o reparación) o de la aldea (subida de nivel) `destinoId`, si la hay. */
const obraSobre = (p: ProyeccionJugador, destinoId: string): ObraDeMapa | undefined =>
  (p.obrasDeMapa ?? []).find((o) => o.destinoId === destinoId && (o.tipo === 'mejoraAvanzada' || o.tipo === 'reparacion' || o.tipo === 'mejoraAldea'));

/** La obra a la puerta (0.193.0): si es tuya y aún pide materiales, un botón «Obra» que abre la entrega; si ya se levanta, una línea con lo que falta. */
function puertaDeObra(p: ProyeccionJugador, o: ObraDeMapa | undefined, c: ContextoFicha): { accion?: AccionPuerta; ventana?: () => VentanaPuerta; nota: string } {
  if (!o || !o.propia) return { nota: '' };
  if (o.terminaEn !== undefined) return { nota: `<p class="asent-lado-nota">🔨 ${c.escapar(nombreDeObra(o, p))}: se levanta, ${c.escapar(textoEnTiempoReal(o.terminaEn - p.instante))}.</p>` };
  return {
    accion: { id: 'obra', etiqueta: 'Obra', icono: '🔨', ventana: true },
    ventana: () => ({ titulo: nombreDeObra(o, p), icono: '🔨', ancho: 'estrecha', html: htmlEntrega(p, o, c), cablear: (cuerpo) => cablearEntrega(cuerpo, p, o, c) }),
    nota: '',
  };
}

/** «Atacar» un pueblo o una avanzada ajenos (no de una Facción aliada ni vasalla), y «La batalla» si ya la hay; con el motivo si aún no se puede. */
function puertaDeAtaque(p: ProyeccionJugador, x: { madreId: string; posicion: Point; batallaId?: string }, propio: boolean, c: ContextoFicha): AccionPuerta[] {
  const acciones: AccionPuerta[] = [];
  if (x.batallaId && (p.batallas ?? []).some((b) => b.battleId === x.batallaId)) acciones.push({ id: 'batalla', etiqueta: 'La batalla', icono: '⚔', titulo: 'Abre la batalla: desde ella te unes a un lado.' });
  if (propio || faccionAmiga(p, madreDe(p, x).faccionId) || x.batallaId) return acciones;
  const { distancia: d, impide } = c.alcance(x.posicion, true);
  if (d === null) return acciones;
  acciones.push({ id: 'atacar', etiqueta: 'Atacar', icono: '⚔', principal: true, motivo: impide || undefined });
  return acciones;
}

function cablearAtaque(cont: HTMLElement, p: ProyeccionJugador, x: { id: string; batallaId?: string }, tipo: 'pueblo' | 'avanzada', c: ContextoFicha): void {
  const b = cont.querySelector<HTMLButtonElement>('[data-puerta="atacar"]');
  b?.addEventListener('click', async () => {
    b.disabled = true;
    const mensaje = await c.ejecutar('atacar', { heroeId: p.heroeId, objetivo: { tipo, id: x.id } });
    b.disabled = false;
    const err = cont.querySelector<HTMLElement>('[data-puerta-error]');
    if (err) err.textContent = mensaje ?? '';
    if (!mensaje) c.aviso(tipo === 'pueblo' ? 'Atacas el pueblo.' : 'Atacas la avanzada.');
  });
  cont.querySelector<HTMLButtonElement>('[data-puerta="batalla"]')?.addEventListener('click', () => { if (x.batallaId) c.verBatalla(x.batallaId); });
}

/** La ficha de una avanzada: qué es, de qué plaza y si está en ruinas o la atacan, y los botones de lo que se hace a su puerta. */
export const FICHA_AVANZADA: FichaMapaExtra = {
  tipo: 'avanzadaMapa',
  buscar: (p, id) => (p.avanzadas ?? []).find((x) => x.id === id),
  html: (p, x: AvanzadaDeMapa, c) => {
    const e = c.escapar;
    const puerta = puertaDeAvanzada(p, x, e, c.ejecutar);
    const obra = puertaDeObra(p, obraSobre(p, x.id), c);
    const acciones = [...puerta.acciones, ...(obra.accion ? [obra.accion] : []), ...puertaDeAtaque(p, x, x.propia, c)];
    return `<span class="faction-kicker">${x.propia ? 'Avanzada de tu Facción' : 'Avanzada ajena'}</span>
      <h3>${e(ETAPA_AVANZADA[x.etapa] ?? 'Avanzada')}</h3>
      <p class="asent-lado-nota">De ${e(nombrePlaza(p, x.madreId))}.${x.enRuinas ? ' En ruinas.' : ''}${x.batallaId ? ' <strong>La están atacando.</strong>' : ''}</p>
      ${obra.nota}${htmlAccionesPuerta(acciones, e)}${puerta.nota}<p class="faction-error" data-puerta-error role="alert"></p>`;
  },
  cablear: (cont, p, x: AvanzadaDeMapa, c) => { cablearPuertaDeAvanzada(cont, p, x, c.ejecutar); cablearAtaque(cont, p, x, 'avanzada', c); },
  ventanas: (p, x: AvanzadaDeMapa, c) => {
    const obra = puertaDeObra(p, obraSobre(p, x.id), c);
    const ventanas = { ...puertaDeAvanzada(p, x, c.escapar, c.ejecutar).ventanas };
    if (obra.ventana) ventanas.obra = obra.ventana;
    return ventanas;
  },
};

export const FICHA_PUEBLO: FichaMapaExtra = {
  tipo: 'puebloMapa',
  buscar: (p, id) => (p.pueblos ?? []).find((x) => x.id === id),
  html: (p, x: PuebloDeMapa, c) => {
    const e = c.escapar;
    const entrar = puertaDePueblo(p, x);
    const obra = puertaDeObra(p, obraSobre(p, x.id), c);
    const guarnicion: AccionPuerta[] = x.propio && columnaALaPuerta(p, x.posicion) ? [{ id: 'guarnicion', etiqueta: 'Guarnición', icono: '🛡', ventana: true, titulo: 'Deja o recoge tropa de tu columna sin entrar.' }] : [];
    const acciones = [...entrar.acciones, ...(obra.accion ? [obra.accion] : []), ...guarnicion, ...puertaDeAtaque(p, x, x.propio, c)];
    return `<span class="faction-kicker">${x.propio ? 'Pueblo de tu Facción' : 'Pueblo ajeno'}</span>
      <h3>${e(nombreDePueblo(x))}</h3>
      <p class="asent-lado-nota">De ${e(nombrePlaza(p, x.madreId))}.${x.batallaId ? ' <strong>Lo están atacando.</strong>' : ''}</p>
      ${x.propio ? `<p class="asent-lado-nota">${x.fertilidad !== undefined ? `Fertilidad ${x.fertilidad.toFixed(2).replace('.', ',')}. ` : ''}${x.carroId ? 'Su carro acarrea a la plaza.' : 'Sin carro de acarreo.'}</p>` : ''}
      ${obra.nota}${htmlAccionesPuerta(acciones, e)}${entrar.nota ? `<p class="asent-lado-nota">${e(entrar.nota)}</p>` : ''}<p class="faction-error" data-puerta-error role="alert"></p>`;
  },
  cablear: (cont, p, x: PuebloDeMapa, c) => {
    const b = cont.querySelector<HTMLButtonElement>('[data-puerta="entrar"]');
    b?.addEventListener('click', async () => {
      b.disabled = true;
      const mensaje = await c.ejecutar('entrarEnPueblo', { heroeId: p.heroeId, puebloId: x.id });
      b.disabled = false;
      const err = cont.querySelector<HTMLElement>('[data-puerta-error]');
      if (err) err.textContent = mensaje ?? '';
    });
    cablearAtaque(cont, p, x, 'pueblo', c);
  },
  ventanas: (p, x: PuebloDeMapa, c) => {
    const obra = puertaDeObra(p, obraSobre(p, x.id), c);
    const ventanas: Record<string, () => VentanaPuerta> = {};
    if (obra.ventana) ventanas.obra = obra.ventana;
    // la guarnición de un pueblo o una aldea de tu Facción, con la columna a su puerta (motor 906fb24: guarnecerPueblo / retirarDePueblo)
    if (x.propio && columnaALaPuerta(p, x.posicion)) {
      ventanas.guarnicion = () => ({
        titulo: 'Guarnición', icono: '🛡', ancho: 'normal',
        html: `${htmlGuarnicion(p, x, true, c.escapar)}<p class="faction-error" data-pueblo-dentro-error role="alert"></p>`,
        cablear: (cuerpo) => cablearInteriorPueblo(cuerpo, p, x, c.ejecutar, c.repintar),
      });
    }
    return ventanas;
  },
};

/** «Entrar» en el pueblo: con tu columna a su puerta, en uno de tu Facción o de una aliada o vasalla (el acceso es el de la plaza madre). Entra
 * el que va solo; un ejército, por orden de su Líder. Si aún no se puede, no hay botón y la nota dice por qué. */
function puertaDePueblo(p: ProyeccionJugador, x: PuebloDeMapa): { acciones: AccionPuerta[]; nota: string } {
  const mi = miColumna(p);
  if (!mi || !(x.propio || faccionAmiga(p, madreDe(p, x).faccionId))) return { acciones: [], nota: '' };
  const d = distancia(mi.posicionActual, x.posicion);
  const puerta = radioDePuerta();
  const solo = mi.participantes.length === 1;
  if (d > puerta) return { acciones: [], nota: `Acerca tu columna: está a ${n0(d)} y se entra a ${puerta} o menos.` };
  if (!solo && mi.liderId !== p.heroeId) return { acciones: [], nota: 'Solo el Líder hace entrar al ejército.' };
  return { acciones: [{ id: 'entrar', etiqueta: solo ? 'Entrar' : 'Entrar con el ejército', icono: '🚪', principal: true }], nota: '' };
}

/** Lo que pide la obra, recurso a recurso (0.138.0, Víctor 2026-11-04): icono, barra de lo entregado, «faltan» y lo que lleva tu columna de ese
 * material (en verde si alcanza), con la barra del total arriba. */
function htmlMaterialesDeObra(o: ObraDeMapa, lleva: Record<string, number> | undefined, e: Escapar): string {
  const filas = Object.entries(o.requerido);
  const pedido = filas.reduce((t, [, n]) => t + n, 0);
  const hecho = filas.reduce((t, [r, n]) => t + Math.min(n, o.entregado[r] ?? 0), 0);
  const total = pedido > 0 ? hecho / pedido : 1;
  const lineas = filas.map(([r, n]) => {
    const hay = Math.min(n, o.entregado[r] ?? 0);
    const queda = Math.max(0, n - hay);
    const tuyo = Math.floor(lleva?.[r] ?? 0);
    const listo = queda === 0;
    const columna = listo || lleva === undefined ? '' : `<small class="obra-entrega-lleva${tuyo >= queda ? ' alcanza' : tuyo > 0 ? ' parte' : ''}" title="Lo que lleva tu columna de ${e(RECURSO_NOMBRE[r] ?? r)}">🛒 ${n0(tuyo)}</small>`;
    return `<div class="obra-entrega-fila${listo ? ' lista' : ''}">
        <span class="obra-entrega-icono">${RECURSO_ICONO[r] ?? '📦'}</span>
        <span class="obra-entrega-nombre">${e(RECURSO_NOMBRE[r] ?? r)}</span>
        <span class="obra-entrega-barra">${barraAvance(n ? hay / n : 1)}</span>
        <span class="obra-entrega-cifra"><b>${n0(hay)}</b><small>/${n0(n)}</small></span>
        <span class="obra-entrega-falta">${listo ? '✓' : `faltan ${n0(queda)}`}${columna}</span>
      </div>`;
  }).join('');
  return `<div class="obra-entrega">
      <div class="obra-entrega-total"><span>${total >= 1 ? '✓ Todo entregado: se levanta' : '📦 Materiales entregados'}</span><b>${Math.floor(total * 100)} %</b></div>
      ${barraAvance(total)}
      <div class="obra-entrega-filas">${lineas}</div>
    </div>`;
}

function htmlEntrega(p: ProyeccionJugador, o: ObraDeMapa, c: { escapar: Escapar }): string {
  const e = c.escapar;
  const mi = miColumna(p);
  const d = mi ? distancia(mi.posicionActual, o.posicion) : null;
  const puerta = radioDePuerta();
  const motivo = o.terminaEn !== undefined ? '' : !o.propia ? '' : !mi ? 'Hace falta una columna tuya con los materiales en su carro o en sus caravanas.'
    : d! > puerta ? `Acerca tu columna a la obra: está a ${n0(d!)} y se entrega a ${puerta} o menos (un clic en la obra la lleva).` : '';
  return `${o.terminaEn !== undefined ? `<div class="obra-entrega levantando"><div class="obra-entrega-total"><span>🔨 Levantándose</span><b>⏳ ${e(textoEnTiempoReal(o.terminaEn - p.instante))}</b></div>${barraAvance(null)}</div>`
      : htmlMaterialesDeObra(o, mi?.suministro, e)}
    ${o.propia && o.terminaEn === undefined ? `<div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-obra-entregar="${e(o.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Entregar materiales</button></div>
      ${motivo ? `<p class="asent-lado-nota">${e(motivo)}</p>` : '<p class="asent-lado-nota">Se entrega lo que falta de lo que lleve tu columna: primero el carro, luego las caravanas enganchadas.</p>'}
      <p class="faction-error" data-obra-error role="alert"></p>` : ''}`;
}

function cablearEntrega(cont: HTMLElement, p: ProyeccionJugador, o: ObraDeMapa, c: { ejecutar: (tipo: string, params: object) => Promise<string | null> }): void {
  const b = cont.querySelector<HTMLButtonElement>(`[data-obra-entregar="${o.id}"]`);
  b?.addEventListener('click', async () => {
    b.disabled = true;
    const mensaje = await c.ejecutar('entregarEnObra', { heroeId: p.heroeId, obraId: o.id, materiales: {} });
    b.disabled = false;
    const err = cont.querySelector<HTMLElement>('[data-obra-error]');
    if (err) err.textContent = mensaje ?? '';
  });
}

export const FICHA_OBRA: FichaMapaExtra = {
  tipo: 'obraMapa',
  buscar: (p, id) => (p.obrasDeMapa ?? []).find((o) => o.id === id),
  html: (p, o: ObraDeMapa, c) => `<span class="faction-kicker">${o.propia ? 'Obra de tu Facción' : 'Obra ajena'}</span>
    <h3>${c.escapar(nombreDeObra(o, p))}</h3>
    <p class="asent-lado-nota">De ${c.escapar(nombrePlaza(p, o.madreId))}.${o.propia ? '' : ' Pendiente, se ve pero no se puede atacar.'}</p>
    ${o.propia ? htmlEntrega(p, o, c) : ''}`,
  cablear: (cont, p, o: ObraDeMapa, c) => cablearEntrega(cont, p, o, c),
};

// ---------------------------------------------------------------- dentro del pueblo
// Motor fd9cd58 (Economia_Construccion §14.0.1): dentro, el ciudadano de la Facción de la madre gestiona con la COLUMNA con la que entró. Las
// órdenes no llevan héroe (es el de la cuenta):
//   guarnecerPueblo / retirarDePueblo { puebloId, escuadronIds }   escuadras de la columna a la guarnición (cupo de Liderazgo por héroe) y vuelta
//   cargarDePueblo / dejarEnPueblo   { puebloId, recurso, cantidad } del almacén local al carro de la columna y vuelta (solo lo que el pueblo produce)
//   asignarEscolta / quitarEscolta   sobre su carro de acarreo, con escuadras de la columna (el cupo, el del Mercado de la madre)
//   mejorarAldea                     el Gobernador o el Maestro de Obras de la madre, residente en ella (la aldea o, desde c1ad93d, el extractor)
// El corral y el rebaño siguen solos, y el carro de acarreo se repone solo.

/** El pueblo en el que está el héroe, si está dentro de uno. */
export function puebloActual(p: ProyeccionJugador): PuebloDeMapa | undefined {
  const u = p.heroe.ubicacion;
  return u.tipo === 'pueblo' ? (p.pueblos ?? []).find((x) => x.id === u.puebloId) : undefined;
}

/** Barra de un almacén o del rebaño frente a su tope. */
function barra(valor: number, tope: number): string {
  const pct = tope > 0 ? Math.min(100, Math.round((valor / tope) * 100)) : 0;
  return `<div class="carro-barra carro-barra-${pct >= 100 ? 'llena' : pct >= 80 ? 'casi' : 'ok'}"><span style="width:${pct}%"></span></div>`;
}

/** Lo que produce el pueblo (lo único que se le puede dejar, `Pueblo::recursos` del motor): la aldea, lo de sus granjas y, si lleva corrales (la
 * ganadera, desde el motor 3d05872), lo de su rebaño (ganado, carne y leche); un extractor, lo que guarda su almacén. */
export function produce(x: PuebloDeMapa): string[] {
  if (!esAldea(x)) return Object.keys(x.almacen).filter((r) => r);
  const c = cultivo(cultivoDe(x));
  const rebano = c.corrales ? ['livestock', 'carne', 'leche'] : [];
  return [...new Set([...(c.granjas ? [c.produce] : []), ...rebano])];
}

const fila = (s: { id: string; tropaId: string; nombre: string; cantidad: number; costeLiderazgo: number }, boton: string, e: Escapar): string =>
  `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div>${boton}</div>`;

/** La guarnición: los de serie, la tuya (con «Retirar») y lo que puedes dejar de tu columna (con «Dejar»), dentro de tu cupo de Liderazgo. */
function htmlGuarnicion(p: ProyeccionJugador, x: PuebloDeMapa, ciudadano: boolean, e: Escapar): string {
  const aldea = esAldea(x);
  const mias = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'pueblo' && s.contenedor.puebloId === x.id);
  const columna = miColumna(p);
  const libres = columna ? p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === columna.id && s.cantidad > 0) : [];
  const usado = mias.reduce((t, s) => t + s.costeLiderazgo, 0);
  const cupo = x.cupoGuarnicionPorHeroe;
  const libre = cupo === undefined ? Infinity : cupo - usado;
  const deOtros = Math.max(0, (x.guarnicionJugadoresIds ?? []).length - mias.length);
  const serie = `${aldea ? 'Granjeros' : 'Mineros'} de serie${x.guarnicionReponeEn && x.guarnicionReponeEn > p.instante ? ` (mermada: el siguiente vuelve en ${e(textoEnTiempoReal(x.guarnicionReponeEn - p.instante))})` : ''}`;
  const cabecera = `<div class="carro-ocupacion"><strong class="heroe-sub">Guarnición${ayuda('pueblo:guarnicion', 'Además de los de serie, cada ciudadano de la Facción de la plaza madre puede dejar aquí escuadras de su columna, hasta su cupo de Liderazgo. Defienden el pueblo aunque tú no estés y se quedan al salir; vuelven solas a tu campamento si el pueblo desaparece o dejas la Facción.')}</strong>${cupo !== undefined ? `<span>tu cupo ${usado} / ${cupo}</span>` : ''}</div>
    ${cupo !== undefined ? barra(usado, cupo) : ''}
    <p class="asent-lado-nota">${serie}${deOtros ? ` y ${deOtros} escuadra(s) de otros héroes` : ''}.</p>`;
  if (!ciudadano) return cabecera;
  const tuyas = mias.length ? `<div class="mapa-lista">${mias.map((s) => fila(s, `<button class="btn-secondary" type="button" data-pueblo-dentro="retirar" data-escuadra="${e(s.id)}">Retirar</button>`, e)).join('')}</div>` : '';
  const dejar = libres.length ? `<div class="mapa-lista">${libres.map((s) => {
    const cabe = s.costeLiderazgo <= libre;
    return fila(s, `<button class="btn-secondary" type="button" data-pueblo-dentro="guarnecer" data-escuadra="${e(s.id)}"${cabe ? '' : ` disabled title="No cabe: te quedan ${Math.max(0, libre)} de Liderazgo"`}>Dejar</button>`, e);
  }).join('')}</div>` : '<p class="asent-lado-nota">Tu columna no trae escuadras que dejar.</p>';
  return `${cabecera}${tuyas}<strong class="heroe-sub">De tu columna</strong>${dejar}`;
}

/** Cargar del almacén del pueblo al carro de tu columna, y dejarle lo que produce. */
function htmlCargaDelPueblo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const columna = miColumna(p);
  if (!columna) return '';
  const carro = columna.suministro ?? {};
  const enCarro = Math.floor(Object.values(carro).reduce((t, n) => t + n, 0));
  const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
  const linea = (r: string, n: number, accion: 'cargar' | 'dejar', etiqueta: string): string =>
    `<div class="carro-fila"><span>${e(nombre(r))}</span><strong>${n0(n)}</strong><input class="form-input" type="number" min="1" max="${n0(n)}" value="${n0(n)}" data-pueblo-cantidad="${accion}:${e(r)}" /><button class="btn-secondary" type="button" data-pueblo-dentro="${accion}" data-recurso="${e(r)}">${etiqueta}</button></div>`;
  const cargar = Object.entries(x.almacen).filter(([r, n]) => r && n >= 1);
  const dejar = produce(x).map((r) => [r, carro[r] ?? 0] as const).filter(([, n]) => n >= 1);
  return `<div class="carro-ocupacion"><strong class="heroe-sub">Carro de tu columna${ayuda('pueblo:carga', 'Carga lo que guarda el pueblo hasta donde quepa en el carro, o déjale lo que produce (en la aldea, lo de su cultivo y, en la de trigo, ganado, carne y leche) hasta su capacidad. Si el almacén se llena con su carro de acarreo en casa, el carro sale hacia la plaza.')}</strong>${columna.capacidadCarga ? `<span>${enCarro} / ${Math.floor(columna.capacidadCarga)}</span>` : ''}</div>
    ${columna.capacidadCarga ? barra(enCarro, columna.capacidadCarga) : ''}
    ${cargar.length ? `<p class="asent-lado-nota">Del almacén del pueblo al carro:</p>${cargar.map(([r, n]) => linea(r, n, 'cargar', 'Al carro')).join('')}` : '<p class="asent-lado-nota">El almacén del pueblo está vacío.</p>'}
    ${dejar.length ? `<p class="asent-lado-nota">Del carro al almacén del pueblo:</p>${dejar.map(([r, n]) => linea(r, n, 'dejar', 'Dejar')).join('')}` : ''}`;
}

/** Escolta del carro de acarreo desde dentro: escuadras de tu columna, con el carro parado aquí. */
function htmlEscoltaDentro(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const c = x.carroId ? p.caravanas.find((k) => k.id === x.carroId) : undefined;
  if (!c) return '';
  const parada = c.estado === 'disponible';
  const cedidas = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'escolta' && s.contenedor.caravanaId === c.id);
  const columna = miColumna(p);
  const libres = columna ? p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === columna.id && s.cantidad > 0) : [];
  // Dentro del pueblo no se está en la madre: su Mercado (que fija el cupo) se lee de la ficha que llega de ella.
  const madre = p.asentamientos.find((a) => a.id === x.madreId) ?? (p.asentamientosAvistados.find((a) => a.id === x.madreId) as Asentamiento | undefined);
  const cupo = c.escoltaLiderazgo?.cupo ?? (madre ? puntosDeEscoltaDelCarro(madre, alLlegarDatos) : undefined);
  const usado = c.escoltaLiderazgo?.usado ?? cedidas.reduce((t, s) => t + s.costeLiderazgo, 0);
  const libre = cupo === undefined ? Infinity : cupo - usado;
  const otros = Math.max(0, (c.escoltaIds ?? []).length - cedidas.length);
  return `<div class="carro-ocupacion"><strong class="heroe-sub">Escolta del carro${ayuda('pueblo:escolta', 'Cede escuadras de tu columna al carro de acarreo mientras está parado aquí: viajan con él a la plaza y vuelven. El cupo de escolta, en Liderazgo, es el del Mercado de la plaza madre o, si no tiene, el del primer nivel. «Retirar» las devuelve a tu columna.')}</strong><span>${cupo !== undefined ? `cupo ${usado} / ${cupo}` : madre ? 'la madre no tiene Mercado: sin cupo' : 'cupo desconocido'}</span></div>
    ${cupo !== undefined ? barra(usado, cupo) : ''}
    <p class="asent-lado-nota">${cedidas.length + otros ? `${cedidas.length + otros} escuadra(s) de escolta${otros ? `, ${otros} de otros héroes` : ''}` : 'Sin escolta'}.${parada ? '' : ' Solo se cambia con el carro parado aquí.'}</p>
    ${cedidas.length ? `<div class="mapa-lista">${cedidas.map((s) => fila(s, parada ? `<button class="btn-secondary" type="button" data-pueblo-dentro="quitar-escolta" data-escuadra="${e(s.id)}" data-caravana="${e(c.id)}">Retirar</button>` : '', e)).join('')}</div>` : ''}
    ${parada && libres.length ? `<div class="mapa-lista">${libres.map((s) => {
      const cabe = s.costeLiderazgo <= libre;
      return fila(s, `<button class="btn-secondary" type="button" data-pueblo-dentro="escolta" data-escuadra="${e(s.id)}" data-caravana="${e(c.id)}"${cabe ? '' : ` disabled title="No cabe: quedan ${Math.max(0, libre)} de Liderazgo"`}>Escoltar</button>`, e);
    }).join('')}</div>` : ''}`;
}

// DENTRO DEL PUEBLO (decisión de Víctor, 2026-10-29): la misma forma que la pantalla de la plaza. Al centro su trazado (`htmlTrazadoPueblo`), con los
// huecos de todos los niveles aunque aún no estén construidos; debajo, el almacén (`htmlAlmacenPueblo`); a la derecha, pestañas (`htmlPestanasPueblo`).
// Salir va por la ventana común «Salir al mundo» (ventanaSalida.ts).
export type PestanaPueblo = 'resumen' | 'guarnicion' | 'acarreo' | 'carga';
let pestanaPueblo: PestanaPueblo = 'resumen';

/** Un carro de acarreo, para el trazado (no es un edificio del catálogo). */
const ICONO_CARRO = '<svg class="icono-edificio" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><path fill="var(--relleno, rgba(205,160,90,0.25))" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M5 11h17v9H5z"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="23" r="3.5"/><circle cx="18" cy="23" r="3.5"/><path d="M22 15h7"/></g></svg>';

/** El trazado del pueblo: el centro, el almacén, el carro de acarreo y, en una aldea, los huecos de todas sus granjas o, en la ganadera, de
 * todos sus corrales (motor 3d05872: la de trigo ya no tiene rebaño). */
export function htmlTrazadoPueblo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const aldea = esAldea(x);
  const cult = cultivo(cultivoDe(x));
  const niveles = Object.entries(params()?.aldea?.niveles ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const actual = params()?.aldea?.niveles?.[String(x.nivelAldea ?? 1)];
  /** El nivel con el que llega el hueco `i` de un tipo. */
  const llegaCon = (i: number, campo: 'granjas' | 'corrales'): string | undefined => niveles.find(([, n]) => n[campo] > i)?.[0];
  const hueco = (tipo: string, lleno: boolean, titulo: string, estilo: string, icono?: string): string =>
    `<div class="pueblo-hueco${lleno ? '' : ' vacio'}" style="${estilo}" title="${e(titulo)}">${icono ?? iconoEdificio(tipo, 30)}</div>`;
  const anillo: string[] = [];
  if (aldea) {
    const maxGranjas = cult.granjas ? Math.max(actual?.granjas ?? 0, ...niveles.map(([, n]) => n.granjas)) : 0;
    const maxCorrales = cult.corrales ? Math.max(actual?.corrales ?? 0, ...niveles.map(([, n]) => n.corrales)) : 0;
    for (let i = 0; i < maxGranjas; i++) {
      const lleno = i < (actual?.granjas ?? 0);
      anillo.push(`granja|${lleno ? 1 : 0}|${lleno ? `${cult.granja} ${i + 1}` : `${cult.granja} ${i + 1}: llega con el nivel ${llegaCon(i, 'granjas') ?? '?'}`}`);
    }
    for (let i = 0; i < maxCorrales; i++) {
      const lleno = i < (actual?.corrales ?? 0);
      const rebano = lleno && x.rebano && i === 0 ? ` · rebaño de ${n0(x.rebano.cabezas)} cabezas` : '';
      anillo.push(`corral|${lleno ? 1 : 0}|${lleno ? `Corral ${i + 1}${rebano}` : `Corral ${i + 1}: llega con el nivel ${llegaCon(i, 'corrales') ?? '?'}`}`);
    }
  }
  const huecosAnillo = anillo.map((h, i) => {
    const [tipo, lleno, titulo] = h.split('|') as [string, string, string];
    const angulo = (i / anillo.length) * Math.PI * 2 - Math.PI / 2;
    return hueco(tipo, lleno === '1', titulo, `left:${(50 + Math.cos(angulo) * 36).toFixed(1)}%;top:${(50 + Math.sin(angulo) * 36).toFixed(1)}%`);
  }).join('');
  const total = Object.values(x.almacen).reduce((t, n) => t + n, 0);
  const carro = x.carroId ? p.caravanas.find((k) => k.id === x.carroId) : undefined;
  const carroEnCasa = carro?.estado === 'disponible';
  return `<div class="pueblo-trazado${x.batallaId ? ' en-batalla' : ''}">
    <div class="pueblo-recinto"></div>
    ${huecosAnillo}
    <div class="pueblo-hueco centro" style="left:50%;top:50%" title="${e(nombreDePueblo(x))}">${iconoEdificio(aldea ? 'vivienda' : x.tipo, 30)}</div>
    ${hueco('almacen', true, `Almacén · ${n0(total)} / ${n0(x.capacidad)}`, aldea ? 'left:37%;top:67%' : 'left:30%;top:68%')}
    ${carroEnCasa ? hueco('carro', true, 'Carro de acarreo, parado aquí', aldea ? 'left:63%;top:67%' : 'left:70%;top:68%', ICONO_CARRO) : ''}
    ${x.batallaId ? '<p class="pueblo-trazado-aviso">Lo están atacando: si sigues dentro, defiendes.</p>' : ''}
  </div>`;
}

/** El almacén del pueblo, en la tira de abajo como el de la plaza: uno para todo, hasta su capacidad. */
export function htmlAlmacenPueblo(x: PuebloDeMapa, e: Escapar): string {
  const total = Object.values(x.almacen).reduce((t, n) => t + n, 0);
  const llenado = (n: number): number => (x.capacidad > 0 ? Math.min(100, Math.round((n / x.capacidad) * 100)) : 0);
  const chip = (icono: string, nombre: string, n: number, detalle: string): string =>
    `<span class="asent-recurso${llenado(n) >= 90 ? ' lleno' : ''}" data-nombre="${e(nombre)}" data-detalle="${e(detalle)}"><span class="asent-recurso-icono" aria-hidden="true">${icono}</span>${n0(n)}<span class="asent-recurso-barra" style="--llenado:${llenado(n)}%"></span></span>`;
  const recursos = Object.entries(x.almacen).filter(([r]) => r).map(([r, n]) => chip(RECURSO_ICONO[r] ?? '📦', RECURSO_NOMBRE[r] ?? r, n, `${n0(n)} de ${n0(x.capacidad)} entre todo`));
  return `${chip('🏚️', 'Almacén', total, `${n0(total)} / ${n0(x.capacidad)}`)}${recursos.join('') || '<span class="asent-recurso-vacio">Vacío</span>'}`;
}

function htmlResumenPueblo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const aldea = esAldea(x);
  const cult = cultivo(cultivoDe(x));
  const conCorrales = (n: { granjas: number; corrales: number }): string => piezasDeAldea(cult, n);
  const pr = params();
  const nivel = aldea ? pr?.aldea?.niveles?.[String(x.nivelAldea ?? 1)] : undefined;
  const siguiente = aldea && x.nivelAldea ? pr?.aldea?.niveles?.[String(x.nivelAldea + 1)] : undefined;
  const especie = x.rebano ? bloqueDeDatos<Record<string, Especie>>('ESPECIES', alLlegarDatos)?.[x.rebano.especie] : undefined;
  const topeRebano = especie && nivel ? especie.topePorCorral * nivel.corrales : undefined;
  const mejora = (p.obrasDeMapa ?? []).find((o) => o.tipo === 'mejoraAldea' && o.destinoId === x.id);
  const ciudadano = x.propio;
  // subir de nivel: el Gobernador o el Maestro de Obras de la madre; un extractor, además, con la madre al nivel que pide el siguiente
  const gestor = ciudadano && gestionaLaMadre(p, x.madreId);
  const sigExtractor = gestor && !mejora ? siguienteDeExtractor(x, madreDe(p, x).a) : undefined;
  const enMarcha = mejora ? ' Tiene una mejora en marcha: sus materiales se entregan en el mapa, a su puerta.' : '';
  const columna = miColumna(p);
  const dentro = columna ? columna.participantes.map((q) => nombreDeHeroe(p, q.heroeId)).join(', ') : '';
  return `<p class="asent-lado-nota">De ${e(nombrePlaza(p, x.madreId))}.${x.fertilidad !== undefined && cult.granjas ? ` Fertilidad ${x.fertilidad.toFixed(2).replace('.', ',')}.` : ''}${x.batallaId ? ' <strong>Lo están atacando: si sigues dentro, defiendes.</strong>' : ''}</p>
    ${aldea ? `<strong class="heroe-sub">Aldea</strong>
      <p class="asent-lado-nota">${e(cult.aldea)}, nivel ${x.nivelAldea ?? 1}${nivel ? `: ${conCorrales(nivel)}` : ''}. ${e(cult.uso)}${enMarcha}</p>
      ${gestor && siguiente && !mejora ? `<div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-pueblo-dentro="mejorar" title="${e(`Al nivel ${x.nivelAldea! + 1}: ${conCorrales(siguiente)}. Pide ${listaRecursos(siguiente.coste)}, que se traen como una obra.`)}">Mejorar a nivel ${x.nivelAldea! + 1}</button></div>` : ''}
      ${x.rebano ? `<div class="carro-ocupacion"><strong class="heroe-sub">Rebaño ${e(ESPECIE_NOMBRE[x.rebano.especie] ?? x.rebano.especie)}</strong><span>${n0(x.rebano.cabezas)}${topeRebano ? ` / ${topeRebano}` : ''} cabezas</span></div>${topeRebano ? barra(x.rebano.cabezas, topeRebano) : ''}
        <p class="asent-lado-nota">Crece solo hasta el tope de sus corrales; lo que pasa del pie de cría entra como ganado en el almacén.</p>` : ''}` : ''}
    ${aldea ? '' : `<strong class="heroe-sub">${e(EDIFICIO_NOMBRE[x.tipo] ?? x.tipo)}</strong>
      <p class="asent-lado-nota">Nivel ${nivelDePueblo(x)}: ${factorDeExtractor(x) > 1 ? `saca ${veces(factorDeExtractor(x))} que en el nivel 1` : 'saca lo de serie'}.${enMarcha}</p>
      ${sigExtractor ? `<div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-pueblo-dentro="mejorar" title="${e(`${textoMejoraExtractor(sigExtractor)} Pide ${listaRecursos(sigExtractor.coste)}.`)}">Mejorar a nivel ${sigExtractor.nivel}</button></div>` : ''}`}
    <strong class="heroe-sub">Dentro</strong>
    <p class="asent-lado-nota">${dentro ? `Tu columna (${e(dentro)}), fuera del mapa: nadie la ve y sigue comiendo de sus víveres.` : 'Tú.'} Al salir vuelve a la puerta con todo lo que trajo; tu guarnición se queda.</p>
    ${ciudadano ? '' : '<p class="asent-lado-nota">Solo los ciudadanos de la Facción de su plaza madre lo gestionan.</p>'}`;
}

/** Las partes del pueblo por dentro, en orden. «Carga» solo para el ciudadano de la Facción de la madre que entró con columna. */
export function pestanasDePueblo(p: ProyeccionJugador, x: PuebloDeMapa): [PestanaPueblo, string][] {
  return [['resumen', 'Resumen'], ['guarnicion', 'Guarnición'], ['acarreo', 'Acarreo y escolta'], ...(x.propio && miColumna(p) ? [['carga', 'Carga'] as [PestanaPueblo, string]] : [])];
}

/** Lo que va dentro de una parte del pueblo (la ventana de su riel), con su línea de error al pie. */
export function htmlCuerpoPueblo(p: ProyeccionJugador, x: PuebloDeMapa, pestana: PestanaPueblo, e: Escapar): string {
  const ciudadano = x.propio;
  const cuerpo = pestana === 'guarnicion' ? htmlGuarnicion(p, x, ciudadano, e)
    : pestana === 'acarreo' ? `<strong class="heroe-sub">Carro de acarreo</strong>${htmlCarroDeAcarreo(p, x, e)}${ciudadano ? htmlEscoltaDentro(p, x, e) : ''}`
    : pestana === 'carga' ? htmlCargaDelPueblo(p, x, e)
    : htmlResumenPueblo(p, x, e);
  return `${cuerpo}<p class="faction-error" data-pueblo-dentro-error role="alert"></p>`;
}

/** Las pestañas con la abierta (la forma de antes de la pantalla completa, con las partes en pestañas en vez de en el riel). */
export function htmlPestanasPueblo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const pestanas = pestanasDePueblo(p, x);
  if (!pestanas.some(([id]) => id === pestanaPueblo)) pestanaPueblo = 'resumen';
  return `<div class="asent-tabs asent-tabs-ancho">${pestanas.map(([id, etiqueta]) => `<button class="asent-tab${id === pestanaPueblo ? ' activo' : ''}" type="button" data-pueblo-pestana="${id}">${etiqueta}</button>`).join('')}</div>
    <div class="asent-lado-cuerpo">${htmlCuerpoPueblo(p, x, pestanaPueblo, e)}</div>`;
}

export function cablearInteriorPueblo(raiz: HTMLElement, p: ProyeccionJugador, x: PuebloDeMapa, ejecutar: Ejecutar, alCargar: () => void): void {
  alCargarDatos = alCargar;
  const error = raiz.querySelector<HTMLElement>('[data-pueblo-dentro-error]');
  const enviar = async (b: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    b.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    b.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-pueblo-pestana]').forEach((b) => b.addEventListener('click', () => { pestanaPueblo = b.dataset.puebloPestana as PestanaPueblo; alCargar(); }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-pueblo-dentro]').forEach((b) => b.addEventListener('click', () => {
    const escuadronIds = b.dataset.escuadra ? [b.dataset.escuadra] : [];
    const recurso = b.dataset.recurso ?? '';
    const cantidad = Number(raiz.querySelector<HTMLInputElement>(`input[data-pueblo-cantidad="${b.dataset.puebloDentro}:${recurso}"]`)?.value ?? 0);
    switch (b.dataset.puebloDentro) {
      case 'guarnecer': return void enviar(b, 'guarnecerPueblo', { puebloId: x.id, escuadronIds });
      case 'retirar': return void enviar(b, 'retirarDePueblo', { puebloId: x.id, escuadronIds });
      case 'cargar': return void enviar(b, 'cargarDePueblo', { puebloId: x.id, recurso, cantidad });
      case 'dejar': return void enviar(b, 'dejarEnPueblo', { puebloId: x.id, recurso, cantidad });
      case 'escolta': return void enviar(b, 'asignarEscolta', { caravanaId: b.dataset.caravana, heroeId: p.heroeId, escuadronIds });
      case 'quitar-escolta': return void enviar(b, 'quitarEscolta', { caravanaId: b.dataset.caravana, heroeId: p.heroeId, escuadronIds });
      case 'mejorar': return void enviar(b, 'mejorarAldea', { heroeId: p.heroeId, puebloId: x.id });
    }
  }));
}

// ---------------------------------------------------------------- avanzadas: se colocan desde el mapa (decisión de Víctor, 2026-10-29)
// Desde 0.148.0, como la aldea (Víctor, 2026-11-04): el Gobernador o el Maestro de Obras de la madre, residente y dentro, elige el sitio en el mapa desde
// Territorio (`colocarAvanzada { asentamientoId, heroeId, posicion }`), dentro de la zona de la madre. Deja una obra que se levanta como la de un pueblo:
// se le entregan los materiales a su puerta con una columna.

interface ReglasAvanzadas { nivelMadre?: Record<string, number>; cupoPorNivelDeLaMadre?: number; obras?: Record<string, { costo?: Record<string, number>; minutos?: number }> }
const reglasAvanzadas = (): ReglasAvanzadas | null => bloqueDeDatos<ReglasAvanzadas>('AVANZADAS');

/** Las avanzadas de una plaza que ocupan cupo: las levantadas (o en ruinas) y las obras de avanzada nueva. */
function avanzadasDe(p: ProyeccionJugador, madreId: string): { avanzadas: AvanzadaDeMapa[]; obras: ObraDeMapa[] } {
  return {
    avanzadas: (p.avanzadas ?? []).filter((x) => x.propia && x.madreId === madreId),
    obras: (p.obrasDeMapa ?? []).filter((o) => o.madreId === madreId && o.tipo === 'avanzada'),
  };
}

function cupoDeAvanzadas(p: ProyeccionJugador, madreId: string, nivel: number): { usados: number; total: number | null } {
  const { avanzadas, obras } = avanzadasDe(p, madreId);
  const porNivel = reglasAvanzadas()?.cupoPorNivelDeLaMadre;
  return { usados: avanzadas.length + obras.length, total: porNivel === undefined ? null : nivel * porNivel };
}

const esDeMiFaccion = (p: ProyeccionJugador, a: Asentamiento): boolean => Boolean(p.faccionId) && a.faccionId === p.faccionId;


/** Una avanzada de la plaza en Territorio: qué es y cómo está, su guarnición y su almacén y, para quien gestiona (Gobernador o Maestro de Obras,
 * residente y dentro), «⬆» a la etapa siguiente, «🔧 Reparar» en ruinas y «✕ Destruir»; el Gobernador elige además su tropa de serie. Su obra
 * en marcha (mejora o reparación) va debajo, como las demás obras. */
function tarjetaAvanzada(p: ProyeccionJugador, a: Asentamiento, x: AvanzadaDeMapa, gestiona: boolean, gobernador: boolean, e: Escapar): string {
  const r = reglasDeObraDeAvanzada();
  const obra = (p.obrasDeMapa ?? []).find((o) => (o.tipo === 'mejoraAvanzada' || o.tipo === 'reparacion') && o.destinoId === x.id);
  const siguiente = x.etapa < 3 ? claveDeEtapa(x.etapa + 1) : null;
  const nivelPide = siguiente ? r?.nivelMadre?.[siguiente] : undefined;
  const nivel = a.nivelActual ?? a.nivel;
  const costoMejora = siguiente ? r?.obras?.[siguiente]?.costo : undefined;
  const costoObra = r?.obras?.[claveDeEtapa(x.etapa)]?.costo;
  const fraccion = r?.fraccionReparacion ?? 0.5;
  const costoReparar = costoObra ? Object.fromEntries(Object.entries(costoObra).map(([k, n]) => [k, Math.ceil(n * fraccion)])) : undefined;
  const serie = x.guarnicionSerieIds?.length ?? 0;
  const jugadores = x.guarnicionJugadoresIds?.length ?? 0;
  const guardado = Object.values(x.almacen ?? {}).reduce((t, n) => t + n, 0);
  const conAlmacen = Object.values(x.capacidad ?? {}).some((n) => n > 0);
  const motivoMejora = nivelPide !== undefined && nivel < nivelPide ? `La plaza tiene que estar a nivel ${nivelPide}.` : '';
  const acciones = !gestiona ? '' : `<div class="anillo-acciones pueblo-acciones">
      ${siguiente && !x.enRuinas && !obra ? `<button class="anillo-mejorar" type="button" data-pueblo-accion="mejorar-avanzada" data-avanzada="${e(x.id)}"${motivoMejora ? ` disabled title="${e(motivoMejora)}"` : ` title="${e(`A ${nombreDeEtapa(x.etapa + 1).toLowerCase()}: lo que pide se lleva a su puerta como una obra.`)}"`}>⬆ ${e(nombreDeEtapa(x.etapa + 1))}${costoMejora ? ` <span class="pueblo-boton-coste">${costeLlano(costoMejora, e)}</span>` : ''}</button>` : ''}
      ${x.enRuinas && !obra ? `<button class="anillo-mejorar" type="button" data-pueblo-accion="reparar-avanzada" data-avanzada="${e(x.id)}" title="La deja operativa: lo que pide se lleva a su puerta como una obra.">🔧 Reparar${costoReparar ? ` <span class="pueblo-boton-coste">${costeLlano(costoReparar, e)}</span>` : ''}</button>` : ''}
      <button class="anillo-abandonar" type="button" data-pueblo-accion="destruir-avanzada" data-avanzada="${e(x.id)}">✕ Destruir</button></div>`;
  const tropa = gobernador && !x.enRuinas ? htmlEleccionDeTropa(p, x, true, e) : '';
  return `<div class="pueblo-tarjeta avanzada${x.enRuinas ? ' ruinas' : ''}${x.batallaId ? ' atacado' : ''}" data-avanzada-tarjeta="${e(x.id)}">
      <div class="anillo-cab"><span class="pueblo-emblema avanzada" aria-hidden="true">${iconoDeAvanzada(x.etapa, 26)}</span>
        <span class="anillo-titulo"><strong>${e(nombreDeEtapa(x.etapa))}</strong><small>a ${n0(distancia(x.posicion, a.posicion))} u de la plaza</small></span>
        ${x.batallaId ? '<span class="pueblo-alerta">⚔ ¡Atacada!</span>' : x.enRuinas ? '<span class="pueblo-alerta ruinas">🏚 En ruinas</span>' : obra ? `<span class="anillo-estado">${obra.tipo === 'reparacion' ? '🔧 En reparación' : '⬆ Mejorando'}</span>` : ''}</div>
      <div class="avanzada-cifras"><span class="obra-chip" title="Escuadras de serie y de jugadores en su guarnición">⚔ ${serie} de serie${jugadores ? ` · 🛡 ${jugadores} de jugadores` : ''}</span>${conAlmacen ? `<span class="obra-chip" title="Lo que guarda su almacén">📦 ${n0(guardado)}</span>` : ''}</div>
      ${tropa ? `<div class="avanzada-tropa"><small class="asent-lado-nota">Tropa de serie</small>${tropa}</div>` : ''}
      ${acciones}
    </div>${obra ? tarjetaObra(p, a, obra, gestiona, e) : ''}`;
}

/** Las avanzadas en Territorio: las que tiene la plaza en tarjetas, su cupo en casillas, sus obras y cómo se coloca una (con lo que pide la atalaya). */
function htmlAvanzadasDeLaPlaza(p: ProyeccionJugador, a: Asentamiento, gestiona: boolean, gobernador: boolean, e: Escapar): string {
  const { avanzadas, obras } = avanzadasDe(p, a.id);
  const { usados, total } = cupoDeAvanzadas(p, a.id, a.nivelActual ?? a.nivel);
  const nivel = reglasAvanzadas()?.nivelMadre?.atalaya;
  const atalaya = reglasAvanzadas()?.obras?.atalaya;
  const tarjetas = avanzadas.map((x) => tarjetaAvanzada(p, a, x, gestiona, gobernador, e));
  return `<div class="obra-titulo"><span class="faction-kicker">Avanzadas</span>${total !== null ? `<span class="obra-chip${usados >= total ? ' lleno' : ''}" title="Cupo de avanzadas por el nivel de la plaza">🗼 ${usados} / ${total}${total ? casillas(usados, total) : ''}</span>` : ''}${ayuda('plaza:avanzadas', 'Un puesto fortificado de la plaza en su zona: atalaya, fuerte y ciudadela. Ve a lo lejos, guarda un almacén y tiene guarnición propia.')}</div>
    ${avanzadas.length + obras.length === 0 ? '<p class="mapa-lista-vacia">Esta plaza aún no tiene avanzadas.</p>'
      : `<div class="pueblo-cartas">${tarjetas.join('')}${obras.map((o) => tarjetaObra(p, a, o, gestiona, e)).join('')}</div>`}
    ${atalaya?.costo ? `<div class="avanzada-coste"><span>🗼 Atalaya</span>${costeLlano(atalaya.costo, e)}${atalaya.minutos ? `<small>⏱ ${atalaya.minutos >= 60 ? `${n0(atalaya.minutos / 60)} h` : `${atalaya.minutos} min`} de obra</small>` : ''}${nivel ? `<small>· plaza a nivel ${nivel}</small>` : ''}</div>` : ''}
    ${gestiona ? (() => {
      // Como la aldea (Víctor, 2026-11-04): desde la plaza se elige el sitio en el mapa, ahí queda la obra y se le llevan los materiales.
      const motivo = nivel !== undefined && (a.nivelActual ?? a.nivel) < nivel ? `La plaza tiene que estar a nivel ${nivel}.`
        : total !== null && usados >= total ? `Cupo lleno (${usados} / ${total}): sube la plaza de nivel o destruye una.` : '';
      return `<div class="mapa-seleccion-acciones"><button class="pueblo-boton principal" type="button" data-pueblo-accion="elegir-avanzada"${motivo ? ` disabled title="${e(motivo)}"` : ''}>🗺 Elegir el sitio de la atalaya</button></div>
        <p class="asent-lado-nota">${motivo ? e(motivo) : 'Dentro de la zona, fuera de la ciudad y sin pisar otro pueblo, avanzada o campamento. Lo que pide se lleva a su puerta con una columna.'}</p>`;
    })() : '<p class="asent-lado-nota">Las coloca el Gobernador o el Maestro de Obras, residente y dentro de la plaza.</p>'}`;
}

