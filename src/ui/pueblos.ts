// PUEBLOS Y OBRAS DE MAPA (Economia_Construccion §14 y §14.0; motor 7086ebc). Un pueblo es de su plaza madre: un extractor sobre un nodo de piedra
// o mineral, o una ALDEA AGRÍCOLA en un punto fértil de la zona (granjas, corrales y su rebaño; acarrea trigo y ganado). Se levanta en tres pasos:
//   1. marcar   desde la plaza madre, su Gobernador o su Maestro de Obras, residente y dentro: `marcarPueblo { nodoId }` o `marcarAldea { punto }`;
//   2. llevar   la obra queda «pendiente de materiales» en el mapa: una columna de la Facción lleva lo que pide en su carro o en sus caravanas
//               enganchadas y, a la puerta de la obra, cualquiera de sus ciudadanos lo entrega (`entregarEnObra`);
//   3. esperar  con todo entregado arranca la obra (4-8 h) y el pueblo queda activo.
// La aldea sube de nivel igual (`mejorarAldea` deja otra obra de materiales) y sigue produciendo mientras tanto. Aquí no se decide ninguna regla: las
// cifras salen de `GET /v1/datos` y el motor valida; su rechazo se enseña tal cual.
//   plaza      la subpestaña «Territorio» del Centro urbano (lo que hay en su zona y sus pueblos) (`SUBPESTANA_PUEBLOS`): cupo, lista, marcar, mejorar, reponer carro, destruir
//   mapa       los pueblos y las obras se pintan (`dibujarPueblosYObras`) y se seleccionan (`seleccionarPuebloUObra`, fichas `FICHA_PUEBLO`/`FICHA_OBRA`)
//   ascenso    la subida de nivel de la plaza con sus requisitos (`htmlAscensoLocal`): el nivel 2 pide ya una aldea activa
//   dentro     se entra en un pueblo activo como de visita, con la columna entera (`entrarEnPueblo` / `salirDePueblo`); dentro se gestiona con esa
//              columna (`htmlPestanasPueblo`): guarnición, carga, escolta del carro de acarreo y mejora de la aldea. La escolta también se cede desde la plaza.
import { bloqueDeDatos, catalogoDeCaravanas, radioDePuerta, type ProyeccionJugador } from '../apiCliente';
import { barraDeTiempo, estadoCliente, textoEnTiempoReal } from './estadoCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE, faccionColor } from '../paletas';
import { iconoEdificio } from './iconosEdificio';
import type { Asentamiento, AvanzadaDeMapa, ObraDeMapa, Point, PuebloDeMapa } from '../tiposDominio';
import { ayuda } from './ayuda';
import { plegable } from './plegable';
import { agarre } from './agarre';
import { miColumna } from './ejercitos';
import { dibujarIconoMapa } from '../mundo/iconosMapa';
import { sitiosDeAldea, type SitiosDeAldea } from '../mundo/fertilidad';
import type { ContextoPlaza, FichaMapaExtra, ObjetoBajoElClic, SubpestanaPlaza } from './ganchos';
import { cablearEscolta, escolta, puntosDeEscolta } from './panelMercado';
import type { Ejecutar } from './panelCarro';
import { nombreDeHeroe } from './nombres';
import { chipLiderazgo } from './liderazgo';
import { confirmar } from './dialogo';
import { iconoEnFila } from './iconosTropa';

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
  };
}
interface Especie { topePorCorral: number; pieDeCriaPorCorral: number; crecimientoPorHora: number; productos: Record<string, number> }
interface RequisitoNivel { pesants?: number; artesanos?: number; edificios?: string[]; edificiosMinimo?: number; aldeasAgricolas?: number; nivelInternoMinimo?: Record<string, number>; recintoCompletoNivelMinimo?: number; edificiosConNivel?: Record<string, number> }

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
export function nombreDePueblo(x: PuebloDeMapa): string {
  return esAldea(x) ? `Aldea agrícola${x.nivelAldea ? ` (nivel ${x.nivelAldea})` : ''}` : EDIFICIO_NOMBRE[x.tipo] ?? x.tipo;
}
const NOMBRE_OBRA: Record<ObraDeMapa['tipo'], string> = {
  pueblo: 'Obra de pueblo', aldea: 'Obra de aldea agrícola', mejoraAldea: 'Mejora de aldea', avanzada: 'Obra de avanzada', mejoraAvanzada: 'Mejora de avanzada', reparacion: 'Reparación de avanzada',
};
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

/** La cabecera de la pestaña Territorio: lo que hay ahora en la zona de influencia de la plaza, nodos (libres y ocupados) y parcelas de bosque. */
function htmlZona(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const zona = a.zonaReal;
  if (!zona || zona.length < 3 || !estadoCliente.mapaCache) return '<p class="asent-lado-nota">La zona de la plaza aún no ha llegado.</p>';
  const ocupadas = fuentesOcupadas(p);
  const nodos = estadoCliente.mapaCache.mapa.nodos.filter((n) => dentro(n.posicion, zona));
  const porTipo = new Map<string, { libres: number; ocupados: number }>();
  for (const n of nodos) {
    const t = porTipo.get(n.tipo) ?? { libres: 0, ocupados: 0 };
    if (ocupadas.has(n.id)) t.ocupados++; else t.libres++;
    porTipo.set(n.tipo, t);
  }
  const parcelas = parcelasEn(p, (q) => dentro(q, zona));
  const fila = (nombre: string, libres: number, ocupados: number, ocupadoPor: string) =>
    `<tr><td>${e(nombre)}</td><td class="zona-libre">${libres}</td><td class="zona-ocupada">${ocupados}</td><td>${libres + ocupados}</td><td class="zona-por">${e(ocupadoPor)}</td></tr>`;
  const filas = [...porTipo.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([t, n]) => fila(`Nodo de ${NOMBRE_NODO[t] ?? t}`, n.libres, n.ocupados, t === 'ganado' ? 'edificio' : 'pueblo o edificio'));
  filas.push(fila('Parcelas de bosque', parcelas.libres, parcelas.ocupadas, 'Leñera'));
  return `<span class="faction-kicker">Zona de influencia${ayuda('plaza:zona', 'Lo que cae ahora dentro de la zona de la plaza (crece con su nivel y con las fronteras de las vecinas). Un nodo lo ocupa un pueblo o un edificio que lo explota; una parcela de bosque, una Leñera.')}</span>
    <table class="zona-tabla"><thead><tr><th></th><th>Libres</th><th>Ocupados</th><th>Total</th><th>Lo ocupa</th></tr></thead><tbody>${filas.join('')}</tbody></table>`;
}

// ---------------------------------------------------------------- plaza: subpestaña «Territorio» (la zona y sus pueblos)

function htmlAlmacen(x: PuebloDeMapa): string {
  const partes = Object.entries(x.almacen).map(([r, n]) => `${n0(n)} ${r ? RECURSO_NOMBRE[r] ?? r : ''}`.trim());
  return `${partes.join(' · ') || '0'} / ${n0(x.capacidad)}`;
}

function htmlRebano(x: PuebloDeMapa): string {
  if (!x.rebano) return '';
  const especie = bloqueDeDatos<Record<string, Especie>>('ESPECIES', alLlegarDatos)?.[x.rebano.especie];
  const corrales = params()?.aldea?.niveles?.[String(x.nivelAldea ?? 1)]?.corrales;
  const tope = especie && corrales ? ` de ${especie.topePorCorral * corrales}` : '';
  return ` · rebaño ${n0(x.rebano.cabezas)}${tope} cabezas de ${ESPECIE_NOMBRE[x.rebano.especie] ?? x.rebano.especie}`;
}

function htmlFilaPueblo(p: ProyeccionJugador, a: Asentamiento, x: PuebloDeMapa, gestiona: boolean, obras: ObraDeMapa[], e: Escapar): string {
  const aldea = esAldea(x);
  const niveles = params()?.aldea?.niveles ?? {};
  const siguiente = aldea && x.nivelAldea ? niveles[String(x.nivelAldea + 1)] : undefined;
  const mejorando = obras.some((o) => o.tipo === 'mejoraAldea' && o.destinoId === x.id);
  const botones = !gestiona ? '' : `<div class="mapa-seleccion-acciones">
      ${aldea && siguiente && !mejorando ? `<button class="btn-secondary" type="button" data-pueblo-accion="mejorar" data-pueblo="${e(x.id)}" title="${e(`Al nivel ${x.nivelAldea! + 1}: ${siguiente.granjas} granjas y ${siguiente.corrales} corrales. Pide ${listaRecursos(siguiente.coste)}, que se llevan a la aldea como una obra.`)}">Mejorar a nivel ${x.nivelAldea! + 1}</button>` : ''}
      ${x.carroId ? '' : `<button class="btn-secondary" type="button" data-pueblo-accion="carro" data-pueblo="${e(x.id)}" title="Compra en la plaza un carro con su buey para el acarreo (si no, la plaza lo repone sola en cuanto puede pagarlo).">Reponer carro</button>`}
      <button class="btn-secondary" type="button" data-pueblo-accion="destruir" data-pueblo="${e(x.id)}">Destruir</button></div>`;
  return `<div class="mapa-lista-item pueblo-fila"><div><strong>${e(nombreDePueblo(x))}</strong>
      <span>almacén ${e(htmlAlmacen(x))}${e(htmlRebano(x))}${x.fertilidad !== undefined ? ` · fertilidad ${x.fertilidad.toFixed(2).replace('.', ',')}` : ''} · ${x.carroId ? 'con carro' : 'sin carro de acarreo'}${x.batallaId ? ' · <strong>¡atacado!</strong>' : ''}</span>
      ${mejorando ? '<span>Mejora en marcha: mira su obra abajo.</span>' : ''}</div>${botones}</div>
    ${htmlCarroDeAcarreo(p, x, e, a)}`;
}

const ESTADO_CARRO: Record<string, string> = { disponible: 'parado en el pueblo', en_transito: 'camino de la plaza, cargado', retornando: 'volviendo vacío al pueblo', preparando: 'cargando', adjunta: 'enganchado a una columna', aparcada: 'aparcado' };

/** El carro de acarreo del pueblo: dónde va y lo que lleva y, desde su plaza madre (`madre`), su escolta, que se cede con el carro parado. */
function htmlCarroDeAcarreo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar, madre?: Asentamiento): string {
  const c = x.carroId ? p.caravanas.find((k) => k.id === x.carroId) : undefined;
  if (!x.carroId) return '<p class="asent-lado-nota">Sin carro de acarreo: la plaza madre lo repone sola en cuanto puede pagarlo (o lo compra su Gobernador o su Maestro de Obras con «Reponer carro»). Mientras, el pueblo acumula hasta llenarse.</p>';
  if (!c) return '<p class="asent-lado-nota">Tiene carro de acarreo.</p>';
  const lleva = listaRecursos(c.contenido ?? {});
  const cedidas = (c.escoltaIds ?? []).length;
  const linea = `<p class="asent-lado-nota">Carro de acarreo ${e(ESTADO_CARRO[c.estado ?? ''] ?? c.estado ?? '')}${lleva ? ` con ${e(lleva)}` : ''}${cedidas ? ` · ${cedidas} escuadra(s) de escolta` : ' · sin escolta'}.</p>`;
  if (!madre) return linea;
  const reside = [...(madre.heroesFundadoresIds ?? []), ...(madre.casasCompradas ?? [])].includes(p.heroeId);
  return `${linea}<div class="escolta-caravana">${escolta(c, p, reside, c.estado === 'disponible', puntosDeEscolta(madre, alLlegarDatos), e)}</div>`;
}

function htmlFilaObra(p: ProyeccionJugador, o: ObraDeMapa, gestiona: boolean, e: Escapar): string {
  const falta = faltan(o);
  const estado = o.terminaEn !== undefined
    ? `levantándose · termina en ${textoEnTiempoReal(o.terminaEn - p.instante)}`
    : Object.keys(falta).length ? `pendiente de materiales · faltan ${listaRecursos(falta)}` : 'materiales completos';
  const cancelar = gestiona && o.tipo !== 'mejoraAldea' ? `<button class="btn-secondary" type="button" data-pueblo-accion="destruir" data-pueblo="${e(puebloDeObra(o.id))}" title="Cancela la obra: no devuelve lo entregado.">Cancelar</button>` : '';
  return `<div class="mapa-lista-item pueblo-fila obra"><div><strong>${e(NOMBRE_OBRA[o.tipo])}</strong> <span>${e(estado)}</span></div>${cancelar}</div>`;
}

function htmlMarcar(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const pr = params();
  const nivel = a.nivelActual ?? a.nivel;
  const { usados, total } = cupo(p, a);
  const sinCupo = total !== null && usados >= total;
  const aldea1 = pr?.aldea?.niveles?.['1'];
  const costeAldea = aldea1 ? listaRecursos(sumar(aldea1.coste, pr?.costeAdicional, costeCarro())) : '';
  const nivelAldea = pr?.nivelMadreMinimo?.aldea ?? 1, nivelExtractor = pr?.nivelMadreMinimo?.extractor ?? 2;
  const libres = nivel >= nivelExtractor ? nodosLibres(p, a) : [];
  if (sinCupo) return '<p class="asent-lado-nota">Cupo lleno: para marcar otro pueblo, sube la plaza de nivel o destruye uno.</p>';
  return `<strong class="heroe-sub">Marcar un pueblo nuevo</strong>
    <div class="pueblo-marcar">
      <div><strong>Aldea agrícola</strong>${ayuda('pueblos:aldea', `Granjas y corrales en un punto fértil de la zona (fertilidad ${pr?.aldea?.fertilidadMinima ?? 0.3} o más, a ${pr?.aldea?.separacionMinima ?? 3} de toda plaza y todo pueblo, con camino hasta la plaza). Acarrea trigo y ganado; su rebaño crece solo. El nivel 2 de la plaza pide una aldea activa.`)}
        <span class="asent-lado-nota">${nivel < nivelAldea ? `Desde el nivel ${nivelAldea} de la plaza.` : `Obra: ${e(costeAldea || '—')} (con el carro de acarreo y su buey), que se llevan al sitio.`}</span>
        ${htmlSitiosDeAldea(sitiosDeLaPlaza(p, a))}
        <button class="btn-primary" type="button" data-pueblo-accion="elegir-aldea"${nivel < nivelAldea ? ' disabled' : ''}>Elegir el sitio en el mapa</button></div>
      <div><strong>Extractor</strong>${ayuda('pueblos:extractor', 'Una cantera o una mina sobre un nodo libre de la zona. Pide su edificio, 50 de madera y el carro de acarreo con su buey, que se llevan al sitio.')}
        ${nivel < nivelExtractor ? `<span class="asent-lado-nota">Desde el nivel ${nivelExtractor} de la plaza.</span>`
          : libres.length === 0 ? '<span class="asent-lado-nota">No hay nodos de piedra ni de mineral libres en la zona.</span>'
            : `<div class="campamento-fila"><select class="form-input" data-pueblo-nodo>${libres.map((n) => `<option value="${e(n.id)}">${e(RECURSO_NOMBRE[n.tipo] ?? n.tipo)} · a ${n0(n.d)}</option>`).join('')}</select>
              <button class="btn-primary" type="button" data-pueblo-accion="marcar-nodo">Marcar</button></div>`}</div>
    </div>`;
}

/** Si la zona tiene sitio para la aldea: en verde con la mejor fertilidad, o en rojo con el porqué. */
function htmlSitiosDeAldea(s: SitiosDeAldea | null): string {
  if (!s) return '';
  const { fertilidadMinima, separacionMinima } = reglasDeAldea();
  const coma = (n: number) => n.toFixed(2).replace('.', ',');
  if (s.validos.length) return `<span class="fundacion-gate ok">Hay tierra fértil para la aldea en la zona (mejor fertilidad ${coma(s.mejor)}).</span>`;
  if (s.cerca.length) return `<span class="fundacion-gate falta">La tierra fértil de la zona está a menos de ${separacionMinima} de una plaza o un pueblo. Crecerá la zona con los edificios.</span>`;
  return `<span class="fundacion-gate falta">La zona no tiene tierra con fertilidad ${coma(fertilidadMinima)} o más: no cabe una aldea. La zona crece con cada edificio terminado.</span>`;
}

function htmlPueblos(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e } = c;
  const { pueblos, obras } = deLaPlaza(p, a);
  const gestiona = c.cargo !== null && c.resideAqui;
  const { usados, total } = cupo(p, a);
  return `${htmlZona(p, a, e)}
    <span class="faction-kicker">Pueblos ${ayuda('plaza:pueblos', 'Un pueblo es de la plaza: se marca aquí, una columna de tu Facción lleva sus materiales hasta la obra en el mapa y los entrega a su puerta (cualquier ciudadano de la columna), y con todo entregado se levanta. Su carro acarrea lo que produce a la plaza.')}</span>
    <p class="asent-lado-nota">Cupo ${usados} / ${total ?? '—'} (por el nivel de la plaza).</p>
    ${pueblos.length + obras.length === 0 ? '<p class="mapa-lista-vacia">Esta plaza aún no tiene pueblos.</p>'
      : `<div class="mapa-lista">${pueblos.map((x) => htmlFilaPueblo(p, a, x, gestiona, obras, e)).join('')}${obras.map((o) => htmlFilaObra(p, o, gestiona, e)).join('')}</div>`}
    ${gestiona ? htmlMarcar(p, a, e) : '<p class="asent-lado-nota">Los pueblos los marca, mejora y destruye el Gobernador o el Maestro de Obras, residente y dentro de la plaza.</p>'}
    <p class="faction-error" data-pueblo-error role="alert"></p>
    ${esDeMiFaccion(p, a) ? htmlAvanzadasDeLaPlaza(p, a, e) : ''}`;
}

/** Quien abre el mapa para elegir un punto (lo pone `main.ts`): `alElegir` devuelve el error del motor, o `null` si salió bien (y el mapa se cierra).
 * `sitios`, si los hay, se pintan sobre el mapa (los de la aldea). */
export const selectorDePunto: { abrir: ((texto: string, centro: Point, zona: Point[] | undefined, alElegir: (q: Point) => Promise<string | null>, sitios?: SitiosDeAldea | null) => void) | null } = { abrir: null };

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

/** Dónde cabe la aldea de esta plaza, con el mapa ya bajado; `null` si aún no está o no trae la capa de fertilidad. */
function sitiosDeLaPlaza(p: ProyeccionJugador, a: Asentamiento): SitiosDeAldea | null {
  const mapa = estadoCliente.mapaCache?.mapa;
  if (!mapa) return null;
  const { fertilidadMinima, separacionMinima } = reglasDeAldea();
  const radio = Math.max(...(a.zonaReal ?? []).map((q) => Math.hypot(q.x - a.posicion.x, q.y - a.posicion.y)), 6);
  return sitiosDeAldea(mapa, { centro: a.posicion, radio, poligono: a.zonaReal }, ocupadosParaAldea(p), fertilidadMinima, separacionMinima);
}

function cablearPueblos(c: ContextoPlaza): void {
  const { proyeccion: p, asentamiento: a, cuerpo } = c;
  alCargarDatos = c.refrescar;
  const error = cuerpo.querySelector<HTMLElement>('[data-pueblo-error]');
  cablearEscolta(cuerpo, p, c.ejecutar, error);
  const enviar = async (b: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    b.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    b.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
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
        const nodoId = cuerpo.querySelector<HTMLSelectElement>('[data-pueblo-nodo]')?.value;
        if (nodoId) void enviar(b, 'marcarPueblo', { asentamientoId: a.id, heroeId: p.heroeId, nodoId });
        return;
      }
      case 'elegir-aldea':
        selectorDePunto.abrir?.('Pulsa en el mapa donde levantar la aldea agrícola: en verde, la tierra fértil de la zona donde cabe (en gris, fértil pero pegada a una plaza o un pueblo).', a.posicion, a.zonaReal,
          (punto) => c.ejecutar('marcarAldea', { asentamientoId: a.id, heroeId: p.heroeId, punto }), sitiosDeLaPlaza(p, a));
        return;
    }
  }));
}

export const SUBPESTANA_PUEBLOS: SubpestanaPlaza = { id: 'pueblos', etiqueta: 'Territorio', html: htmlPueblos, cablear: cablearPueblos };

// ---------------------------------------------------------------- subida de nivel de la plaza

/**
 * La subida de nivel con sus requisitos, calculados con `NIVEL_ASENTAMIENTO` y `ASCENSO_ASENTAMIENTO` de los datos (el motor no proyecta su evaluación):
 * población, edificios, aldea activa y coste en el almacén. El cupo de la Facción y la solvencia los comprueba el motor al pedirla.
 */
export function htmlAscensoLocal(p: ProyeccionJugador, a: Asentamiento, soyGobernador: boolean, e: Escapar, alCargar?: () => void): string {
  if (alCargar) alCargarDatos = alCargar;
  const reqs = bloqueDeDatos<{ nivelMaximo?: number; requisitos?: Record<string, RequisitoNivel> }>('NIVEL_ASENTAMIENTO', alLlegarDatos);
  const asc = bloqueDeDatos<{ porNivelObjetivo?: Record<string, { costo: Record<string, number>; obraMinutos: number }>; nivelTechoProvisional?: number }>('ASCENSO_ASENTAMIENTO', alLlegarDatos);
  if (!reqs || !asc) return '';
  const objetivo = a.nivel + 1;
  const techo = Math.min(reqs.nivelMaximo ?? 5, asc.nivelTechoProvisional ?? 5);
  const info = ayuda('plaza:ascenso', 'La subida de nivel no es automática: la pide el Gobernador, se paga entera del almacén y tarda una obra. Si conquistan la plaza durante la obra, se pierde.');
  if (a.ascenso) return `<span class="faction-kicker">Subida de nivel${info}</span>${barraDeTiempo(`Subiendo al nivel ${a.ascenso.nivelObjetivo}`, a.ascenso.iniciadoEn, a.ascenso.completaEn, p.instante)}`;
  if (objetivo > techo) return `<p class="asent-lado-nota">La plaza está en el nivel más alto que se puede alcanzar hoy.${info}</p>`;
  const r = reqs.requisitos?.[String(objetivo)] ?? {};
  const coste = asc.porNivelObjetivo?.[String(objetivo)];
  const pob = a.poblacion ?? { pesants: 0, artesanos: 0, nobleza: 0 };
  const activos = (tipo: string): boolean => a.edificios.some((x) => x.tipo === tipo && x.estado === 'activo' && (x.nivelInterno ?? 1) >= (r.nivelInternoMinimo?.[tipo] ?? 1));
  const hechos = (r.edificios ?? []).filter(activos);
  const minimo = r.edificiosMinimo ?? (r.edificios ?? []).length;
  const aldeas = (p.pueblos ?? []).filter((x) => x.propio && x.madreId === a.id && esAldea(x)).length;
  const almacen = a.almacen ?? {};
  const faltaPagar = Object.entries(coste?.costo ?? {}).filter(([k, n]) => (almacen[k]?.cantidad ?? 0) < n);
  const filas: [boolean, string][] = [
    [Math.floor(pob.pesants) >= (r.pesants ?? 0), `${r.pesants ?? 0} pesants (tiene ${n0(pob.pesants)})`],
    ...((r.artesanos ?? 0) > 0 ? [[Math.floor(pob.artesanos) >= r.artesanos!, `${r.artesanos} artesanos (tiene ${n0(pob.artesanos)})`] as [boolean, string]] : []),
    ...((r.edificios ?? []).length ? [[hechos.length >= minimo, `${minimo === (r.edificios ?? []).length ? 'Todos' : `${minimo}`} de: ${(r.edificios ?? []).map((t) => EDIFICIO_NOMBRE[t] ?? t).join(', ')} (${hechos.length ? `activos: ${hechos.map((t) => EDIFICIO_NOMBRE[t] ?? t).join(', ')}` : 'ninguno activo'})`] as [boolean, string]] : []),
    // Un edificio activo de ese tipo a ese nivel o más (nivel 2: una Granja a nivel 2).
    ...Object.entries(r.edificiosConNivel ?? {}).map(([tipo, nivel]) => [
      a.edificios.some((x) => x.tipo === tipo && x.estado === 'activo' && (x.nivelInterno ?? 1) >= nivel),
      `${EDIFICIO_NOMBRE[tipo] ?? tipo} a nivel ${nivel} o más, en marcha`,
    ] as [boolean, string]),
    ...((r.aldeasAgricolas ?? 0) > 0 ? [[aldeas >= r.aldeasAgricolas!, `Una aldea agrícola activa (pestaña Pueblos)${aldeas ? '' : ': aún no tiene'}`] as [boolean, string]] : []),
    ...(r.recintoCompletoNivelMinimo ? [[true, `Un recinto de muralla completo de nivel ${r.recintoCompletoNivelMinimo} o más (lo comprueba el servidor)`] as [boolean, string]] : []),
    [faltaPagar.length === 0, `En el almacén: ${listaRecursos(coste?.costo ?? {}) || 'sin coste'}${faltaPagar.length ? ` (faltan ${faltaPagar.map(([k, n]) => `${Math.ceil(n - (almacen[k]?.cantidad ?? 0))} ${RECURSO_NOMBRE[k] ?? k}`).join(', ')})` : ''}`],
  ];
  const puede = !a.ascenso && filas.every(([ok]) => ok);
  const cumplidos = filas.filter(([ok]) => ok).length;
  const motivo = !soyGobernador ? 'Solo el Gobernador puede pedir la subida.' : puede ? '' : 'Aún no cumple todos los requisitos (despliégalos debajo).';
  // Arriba el botón (apagado si no se puede); debajo los requisitos, plegados.
  return `<button id="btn-solicitar-ascenso" class="btn-primary" type="button"${puede && soyGobernador ? '' : ` disabled title="${e(motivo)}"`}>Subir a nivel ${objetivo}</button>
    ${plegable('ascenso:requisitos', `<span class="plegable-titulo">Requisitos del nivel ${objetivo}${info}</span><span class="plegable-meta${cumplidos === filas.length ? '' : ' falta'}">${cumplidos} de ${filas.length}</span>`,
      `${coste ? `<p class="asent-lado-nota">Obra de ${Math.round(coste.obraMinutos / 60)} h.</p>` : ''}
      <ul class="ascenso-requisitos">${filas.map(([ok, t]) => `<li class="${ok ? 'ok' : 'falta'}">${ok ? '✓' : '✗'} ${e(t)}</li>`).join('')}</ul>
      <p class="asent-lado-nota">El servidor comprueba además el cupo de tu Facción y que los ingresos cubran el mantenimiento del nivel nuevo.${soyGobernador ? '' : ' Solo el Gobernador puede pedir la subida.'}</p>`)}`;
}

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

/** Qué pueblo, avanzada u obra hay bajo el clic. Con columna, el clic además la lleva hacia el pueblo, la avanzada o la obra propia sin terminar. */
export function seleccionarPuebloUObra(p: ProyeccionJugador, punto: Point): ObjetoBajoElClic | null {
  const candidatos = [
    ...(p.obrasDeMapa ?? []).filter((o) => o.tipo !== 'mejoraAldea').map((o) => ({ tipo: 'obraMapa', id: o.id, d: distancia(o.posicion, punto), o })),
    ...(p.pueblos ?? []).map((x) => ({ tipo: 'puebloMapa', id: x.id, d: distancia(x.posicion, punto), o: undefined, posicion: x.posicion })),
    ...(p.avanzadas ?? []).map((x) => ({ tipo: 'avanzadaMapa', id: x.id, d: distancia(x.posicion, punto), o: undefined, posicion: x.posicion })),
  ].filter((c) => c.d < agarre(12)).sort((a, b) => a.d - b.d);
  const c = candidatos[0];
  if (!c) return null;
  // Con columna, el clic lleva hacia el pueblo o la avanzada (como a una plaza) y a una obra propia sin terminar (para entregar a su puerta).
  const destino = c.o ? (c.o.propia && !c.o.terminaEn ? c.o.posicion : undefined) : c.posicion;
  const ir = destino && miColumna(p) ? { tipo: 'punto' as const, punto: destino } : undefined;
  return { tipo: c.tipo, id: c.id, ...(ir ? { ir } : {}) };
}

const ETAPA_AVANZADA: Record<number, string> = { 1: 'Atalaya', 2: 'Fuerte', 3: 'Ciudadela' };

/** La ficha de una avanzada: qué es, de qué plaza y si está en ruinas o la atacan. */
export const FICHA_AVANZADA: FichaMapaExtra = {
  tipo: 'avanzadaMapa',
  buscar: (p, id) => (p.avanzadas ?? []).find((x) => x.id === id),
  html: (p, x: AvanzadaDeMapa, c) => {
    const e = c.escapar;
    return `<span class="faction-kicker">${x.propia ? 'Avanzada de tu Facción' : 'Avanzada ajena'}</span>
      <h3>${e(ETAPA_AVANZADA[x.etapa] ?? 'Avanzada')}</h3>
      <p class="asent-lado-nota">De ${e(nombrePlaza(p, x.madreId))}.${x.enRuinas ? ' En ruinas.' : ''}${x.batallaId ? ' <strong>La están atacando.</strong>' : ''}</p>`;
  },
};

export const FICHA_PUEBLO: FichaMapaExtra = {
  tipo: 'puebloMapa',
  buscar: (p, id) => (p.pueblos ?? []).find((x) => x.id === id),
  html: (p, x: PuebloDeMapa, c) => {
    const e = c.escapar;
    const mejora = (p.obrasDeMapa ?? []).find((o) => o.tipo === 'mejoraAldea' && o.destinoId === x.id);
    return `<span class="faction-kicker">${x.propio ? 'Pueblo de tu Facción' : 'Pueblo ajeno'}</span>
      <h3>${e(nombreDePueblo(x))}</h3>
      <p class="asent-lado-nota">De ${e(nombrePlaza(p, x.madreId))}.${x.batallaId ? ' <strong>Lo están atacando.</strong>' : ''}</p>
      ${x.propio ? `<p class="asent-lado-nota">${x.fertilidad !== undefined ? `Fertilidad ${x.fertilidad.toFixed(2).replace('.', ',')}. ` : ''}${x.carroId ? 'Su carro acarrea a la plaza.' : 'Sin carro de acarreo.'}</p>` : ''}
      ${mejora ? htmlEntrega(p, mejora, c) : ''}
      ${htmlEntrar(p, x, e)}`;
  },
  cablear: (cont, p, x: PuebloDeMapa, c) => {
    const mejora = (p.obrasDeMapa ?? []).find((o) => o.tipo === 'mejoraAldea' && o.destinoId === x.id);
    if (mejora) cablearEntrega(cont, p, mejora, c);
    const b = cont.querySelector<HTMLButtonElement>('[data-entrar-pueblo]');
    b?.addEventListener('click', async () => {
      b.disabled = true;
      const mensaje = await c.ejecutar('entrarEnPueblo', { heroeId: p.heroeId, puebloId: x.id });
      b.disabled = false;
      const err = cont.querySelector<HTMLElement>('[data-entrar-error]');
      if (err) err.textContent = mensaje ?? '';
    });
  },
};

/** «Entrar» en la ficha del pueblo: con tu columna a su puerta. Entra el que va solo; un ejército, por orden de su Líder. El acceso es el de la plaza madre. */
function htmlEntrar(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const mi = miColumna(p);
  if (!mi) return '';
  const d = distancia(mi.posicionActual, x.posicion);
  const puerta = radioDePuerta();
  const solo = mi.participantes.length === 1;
  const motivo = d > puerta ? `Acerca tu columna: está a ${n0(d)} y se entra a ${puerta} o menos.` : !solo && mi.liderId !== p.heroeId ? 'Solo el Líder hace entrar al ejército.' : '';
  return `<div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-entrar-pueblo${motivo ? ` disabled title="${e(motivo)}"` : ''}>${solo ? 'Entrar' : 'Entrar con el ejército'}</button></div>
    ${motivo ? `<p class="asent-lado-nota">${e(motivo)}</p>` : ''}<p class="faction-error" data-entrar-error role="alert"></p>`;
}

function htmlEntrega(p: ProyeccionJugador, o: ObraDeMapa, c: { escapar: Escapar }): string {
  const e = c.escapar;
  const falta = faltan(o);
  const mi = miColumna(p);
  const d = mi ? distancia(mi.posicionActual, o.posicion) : null;
  const puerta = radioDePuerta();
  const motivo = o.terminaEn !== undefined ? '' : !o.propia ? '' : !mi ? 'Hace falta una columna tuya con los materiales en su carro o en sus caravanas.'
    : d! > puerta ? `Acerca tu columna a la obra: está a ${n0(d!)} y se entrega a ${puerta} o menos (un clic en la obra la lleva).` : '';
  return `<p class="asent-lado-nota">${o.terminaEn !== undefined ? `Levantándose: termina en ${e(textoEnTiempoReal(o.terminaEn - p.instante))}.`
      : `Pide ${e(listaRecursos(o.requerido))}. Entregado: ${e(listaRecursos(o.entregado) || 'nada')}.${Object.keys(falta).length ? ` Faltan ${e(listaRecursos(falta))}.` : ''}`}</p>
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
    <h3>${c.escapar(NOMBRE_OBRA[o.tipo])}</h3>
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
//   mejorarAldea                     el Gobernador o el Maestro de Obras de la madre, residente en ella
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

/** Lo que produce el pueblo (lo único que se le puede dejar): la aldea, trigo y ganado; un extractor, lo que guarda su almacén. */
function produce(x: PuebloDeMapa): string[] {
  return esAldea(x) ? ['trigo', 'ganado'] : Object.keys(x.almacen).filter((r) => r);
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
  return `<div class="carro-ocupacion"><strong class="heroe-sub">Carro de tu columna${ayuda('pueblo:carga', 'Carga lo que guarda el pueblo hasta donde quepa en el carro, o déjale lo que produce (en la aldea, trigo y ganado) hasta su capacidad. Si el almacén se llena con su carro de acarreo en casa, el carro sale hacia la plaza.')}</strong>${columna.capacidadCarga ? `<span>${enCarro} / ${Math.floor(columna.capacidadCarga)}</span>` : ''}</div>
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
  const cupo = c.escoltaLiderazgo?.cupo ?? (madre ? puntosDeEscolta(madre, alLlegarDatos) : undefined);
  const usado = c.escoltaLiderazgo?.usado ?? cedidas.reduce((t, s) => t + s.costeLiderazgo, 0);
  const libre = cupo === undefined ? Infinity : cupo - usado;
  const otros = Math.max(0, (c.escoltaIds ?? []).length - cedidas.length);
  return `<div class="carro-ocupacion"><strong class="heroe-sub">Escolta del carro${ayuda('pueblo:escolta', 'Cede escuadras de tu columna al carro de acarreo mientras está parado aquí: viajan con él a la plaza y vuelven. El cupo de escolta, en Liderazgo, es el del Mercado de la plaza madre. «Retirar» las devuelve a tu columna.')}</strong><span>${cupo !== undefined ? `cupo ${usado} / ${cupo}` : madre ? 'la madre no tiene Mercado: sin cupo' : 'cupo desconocido'}</span></div>
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

/** El trazado del pueblo: el centro, el almacén, el carro de acarreo y, en una aldea, los huecos de todas sus granjas y corrales. */
export function htmlTrazadoPueblo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const aldea = esAldea(x);
  const niveles = Object.entries(params()?.aldea?.niveles ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const actual = params()?.aldea?.niveles?.[String(x.nivelAldea ?? 1)];
  /** El nivel con el que llega el hueco `i` de un tipo. */
  const llegaCon = (i: number, campo: 'granjas' | 'corrales'): string | undefined => niveles.find(([, n]) => n[campo] > i)?.[0];
  const hueco = (tipo: string, lleno: boolean, titulo: string, estilo: string, icono?: string): string =>
    `<div class="pueblo-hueco${lleno ? '' : ' vacio'}" style="${estilo}" title="${e(titulo)}">${icono ?? iconoEdificio(tipo, 30)}</div>`;
  const anillo: string[] = [];
  if (aldea) {
    const maxGranjas = Math.max(actual?.granjas ?? 0, ...niveles.map(([, n]) => n.granjas));
    const maxCorrales = Math.max(actual?.corrales ?? 0, ...niveles.map(([, n]) => n.corrales));
    for (let i = 0; i < maxGranjas; i++) {
      const lleno = i < (actual?.granjas ?? 0);
      anillo.push(`granja|${lleno ? 1 : 0}|${lleno ? `Granja ${i + 1}` : `Granja ${i + 1}: llega con el nivel ${llegaCon(i, 'granjas') ?? '?'}`}`);
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
  const pr = params();
  const nivel = aldea ? pr?.aldea?.niveles?.[String(x.nivelAldea ?? 1)] : undefined;
  const siguiente = aldea && x.nivelAldea ? pr?.aldea?.niveles?.[String(x.nivelAldea + 1)] : undefined;
  const especie = x.rebano ? bloqueDeDatos<Record<string, Especie>>('ESPECIES', alLlegarDatos)?.[x.rebano.especie] : undefined;
  const topeRebano = especie && nivel ? especie.topePorCorral * nivel.corrales : undefined;
  const mejora = (p.obrasDeMapa ?? []).find((o) => o.tipo === 'mejoraAldea' && o.destinoId === x.id);
  const ciudadano = x.propio;
  const columna = miColumna(p);
  const dentro = columna ? columna.participantes.map((q) => nombreDeHeroe(p, q.heroeId)).join(', ') : '';
  return `<p class="asent-lado-nota">De ${e(nombrePlaza(p, x.madreId))}.${x.fertilidad !== undefined ? ` Fertilidad ${x.fertilidad.toFixed(2).replace('.', ',')}.` : ''}${x.batallaId ? ' <strong>Lo están atacando: si sigues dentro, defiendes.</strong>' : ''}</p>
    ${aldea ? `<strong class="heroe-sub">Aldea</strong>
      <p class="asent-lado-nota">Nivel ${x.nivelAldea ?? 1}${nivel ? `: ${nivel.granjas} granjas y ${nivel.corrales} corrales` : ''}.${mejora ? ' Tiene una mejora en marcha: sus materiales se entregan en el mapa, a su puerta.' : ''}</p>
      ${ciudadano && siguiente && !mejora ? `<div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-pueblo-dentro="mejorar" title="${e(`Al nivel ${x.nivelAldea! + 1}: ${siguiente.granjas} granjas y ${siguiente.corrales} corrales. Pide ${listaRecursos(siguiente.coste)}, que se traen como una obra.`)}">Mejorar a nivel ${x.nivelAldea! + 1}</button><small class="asent-lado-nota">El Gobernador o el Maestro de Obras de la plaza madre.</small></div>` : ''}
      ${x.rebano ? `<div class="carro-ocupacion"><strong class="heroe-sub">Rebaño ${e(ESPECIE_NOMBRE[x.rebano.especie] ?? x.rebano.especie)}</strong><span>${n0(x.rebano.cabezas)}${topeRebano ? ` / ${topeRebano}` : ''} cabezas</span></div>${topeRebano ? barra(x.rebano.cabezas, topeRebano) : ''}
        <p class="asent-lado-nota">Crece solo hasta el tope de sus corrales; lo que pasa del pie de cría entra como ganado en el almacén.</p>` : ''}` : ''}
    <strong class="heroe-sub">Dentro</strong>
    <p class="asent-lado-nota">${dentro ? `Tu columna (${e(dentro)}), fuera del mapa: nadie la ve y sigue comiendo de sus víveres.` : 'Tú.'} Al salir vuelve a la puerta con todo lo que trajo; tu guarnición se queda.</p>
    ${ciudadano ? '' : '<p class="asent-lado-nota">Solo los ciudadanos de la Facción de su plaza madre lo gestionan.</p>'}`;
}

/** Las pestañas de la derecha con la abierta. «Carga» solo para el ciudadano de la Facción de la madre que entró con columna. */
export function htmlPestanasPueblo(p: ProyeccionJugador, x: PuebloDeMapa, e: Escapar): string {
  const ciudadano = x.propio;
  const pestanas: [PestanaPueblo, string][] = [['resumen', 'Resumen'], ['guarnicion', 'Guarnición'], ['acarreo', 'Acarreo y escolta'], ...(ciudadano && miColumna(p) ? [['carga', 'Carga'] as [PestanaPueblo, string]] : [])];
  if (!pestanas.some(([id]) => id === pestanaPueblo)) pestanaPueblo = 'resumen';
  const cuerpo = pestanaPueblo === 'guarnicion' ? htmlGuarnicion(p, x, ciudadano, e)
    : pestanaPueblo === 'acarreo' ? `<strong class="heroe-sub">Carro de acarreo</strong>${htmlCarroDeAcarreo(p, x, e)}${ciudadano ? htmlEscoltaDentro(p, x, e) : ''}`
    : pestanaPueblo === 'carga' ? htmlCargaDelPueblo(p, x, e)
    : htmlResumenPueblo(p, x, e);
  return `<div class="asent-tabs asent-tabs-ancho">${pestanas.map(([id, etiqueta]) => `<button class="asent-tab${id === pestanaPueblo ? ' activo' : ''}" type="button" data-pueblo-pestana="${id}">${etiqueta}</button>`).join('')}</div>
    <div class="asent-lado-cuerpo">${cuerpo}<p class="faction-error" data-pueblo-dentro-error role="alert"></p></div>`;
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
// La coloca el Gobernador o el Maestro de Obras de la madre, residente, con su columna EN EL SITIO, dentro de la zona de la madre (`colocarAvanzada
// { asentamientoId, heroeId, posicion }`, motor 5E-1). Deja una obra que se levanta como la de un pueblo: se le entregan los materiales a su puerta.
// Territorio enseña las de la plaza y el cupo; el botón está en «Lo que llevas» del mapa.

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

const costoAtalaya = (): string => {
  const o = reglasAvanzadas()?.obras?.atalaya;
  const costo = listaRecursos(o?.costo ?? {});
  return costo ? `${costo}${o?.minutos ? `, obra de ${o.minutos >= 60 ? `${n0(o.minutos / 60)} h` : `${o.minutos} min`}` : ''}` : '';
};

const esDeMiFaccion = (p: ProyeccionJugador, a: Asentamiento): boolean => Boolean(p.faccionId) && a.faccionId === p.faccionId;

/** Las avanzadas en Territorio: las que tiene la plaza, su cupo y cómo se coloca una. */
function htmlAvanzadasDeLaPlaza(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const { avanzadas, obras } = avanzadasDe(p, a.id);
  const { usados, total } = cupoDeAvanzadas(p, a.id, a.nivelActual ?? a.nivel);
  const nivel = reglasAvanzadas()?.nivelMadre?.atalaya;
  const coste = costoAtalaya();
  return `<span class="faction-kicker">Avanzadas ${ayuda('plaza:avanzadas', 'Un puesto fortificado de la plaza en su zona: atalaya, fuerte y ciudadela. Ve a lo lejos, guarda un almacén y tiene guarnición propia.')}</span>
    <p class="asent-lado-nota">Cupo ${usados} / ${total ?? '—'} (por el nivel de la plaza)${nivel ? ` · la primera pide la plaza a nivel ${nivel}` : ''}.</p>
    ${avanzadas.length + obras.length === 0 ? '<p class="mapa-lista-vacia">Esta plaza aún no tiene avanzadas.</p>'
      : `<div class="mapa-lista">${avanzadas.map((x) => `<div class="mapa-lista-item"><div><strong>${e(ETAPA_AVANZADA[x.etapa] ?? 'Avanzada')}</strong><span>a ${n0(distancia(x.posicion, a.posicion))} de la plaza${x.enRuinas ? ' · en ruinas' : ''}${x.batallaId ? ' · <strong>¡atacada!</strong>' : ''}</span></div></div>`).join('')}${obras.map((o) => htmlFilaObra(p, o, false, e)).join('')}</div>`}
    <p class="asent-lado-nota">Se colocan en el mapa: el Gobernador o el Maestro de Obras que reside aquí sale con su columna, la para en el sitio (dentro de la zona, fuera de la ciudad y sin pisar otro pueblo, avanzada o campamento) y pulsa «Colocar avanzada aquí» en «Lo que llevas».${coste ? ` La atalaya pide ${e(coste)}, que se entregan a su puerta.` : ''}</p>`;
}

/** El botón del mapa (en «Lo que llevas»): solo para quien tiene el cargo en su plaza de residencia; si no se puede aquí, dice por qué. */
export function htmlColocarAvanzada(p: ProyeccionJugador, e: Escapar): string {
  const columna = miColumna(p);
  const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
  const madreId = yo?.residenciaId;
  if (!columna || !madreId?.startsWith('as-')) return '';
  if (!yo!.cargos.some((c) => c === `gobernador@${madreId}` || c === `maestroObras@${madreId}`)) return '';
  const propia = p.asentamientos.find((x) => x.id === madreId);
  const vista = p.asentamientosAvistados.find((x) => x.id === madreId);
  const zona = propia?.zonaReal ?? vista?.zona ?? [];
  const nivel = propia ? propia.nivelActual ?? propia.nivel : vista?.nivel ?? 0;
  const nombre = propia?.nombre ?? vista?.nombre ?? madreId;
  const { usados, total } = cupoDeAvanzadas(p, madreId, nivel);
  const nivelMinimo = reglasAvanzadas()?.nivelMadre?.atalaya;
  const motivo = zona.length < 3 || !dentro(columna.posicionActual, zona) ? `Para la columna dentro de la zona de ${nombre}.`
    : nivelMinimo !== undefined && nivel < nivelMinimo ? `${nombre} tiene que estar a nivel ${nivelMinimo}.`
    : total !== null && usados >= total ? `${nombre} ya tiene su cupo de avanzadas (${usados} / ${total}).`
    : columna.liderId !== p.heroeId ? 'Solo el Líder de la columna la coloca.'
    : '';
  const coste = costoAtalaya();
  return `<strong class="heroe-sub">Avanzada de ${e(nombre)}${ayuda('columna:avanzada', `Se coloca donde está tu columna: dentro de la zona, fuera de la ciudad y sin pisar otro pueblo, avanzada o campamento. Queda una obra a la que se entregan los materiales a su puerta${coste ? ` (la atalaya: ${e(coste)})` : ''}.`)}</strong>
    <div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-colocar-avanzada="${e(madreId)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Colocar avanzada aquí</button></div>
    ${motivo ? `<p class="mapa-lista-vacia">${e(motivo)}</p>` : ''}
    <p class="faction-error" data-campo="error-avanzada" role="alert"></p>`;
}

export function cablearColocarAvanzada(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  const boton = raiz.querySelector<HTMLButtonElement>('[data-colocar-avanzada]');
  boton?.addEventListener('click', async () => {
    const columna = miColumna(p);
    if (!columna) return;
    boton.disabled = true;
    const mensaje = await ejecutar('colocarAvanzada', { asentamientoId: boton.dataset.colocarAvanzada, heroeId: p.heroeId, posicion: columna.posicionActual });
    const error = raiz.querySelector<HTMLElement>('[data-campo="error-avanzada"]');
    if (error) error.textContent = mensaje ?? '';
    if (mensaje) boton.disabled = false;
  });
}
