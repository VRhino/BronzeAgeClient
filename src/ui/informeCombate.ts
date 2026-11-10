// Informe de un combate (doc 02 §4.1b, backend 2026-10-06): lo que el servidor cuenta en el payload de sus eventos de resolución, ordenado como un
// briefing breve —ganador, poder de cada bando y bajas por escuadra— para quien iba en uno de los dos lados.
//   combate.resuelto                         { ganador, atacante: LadoDelInforme, defensor: LadoDelInforme, ... }   (asedios y encuentros)
//   combate.campamento_destruido / combate.ataque_campamento_fallido   { nivelCampamento, poderCampamento, atacante: LadoDelInforme, botin, monedas }
// ENTRE JUGADORES (Víctor, 2026-11-10: «que se muestre una ventana con el resultado como cuando atacamos bandidos»; `informeEntreJugadores`). El motor
// los manda planos y en milésimas, sin bajas por escuadra:
//   combate.resuelto                       columna contra columna: `ejercitoId` (la atacante), `ganaElAtacante`, `poderAtacante/Defensor`,
//                                          `bajasAtacante/Defensor`, `heridos`, `robado`, `chatarra`, `botin`; y del `combate.encuentro` que le
//                                          sigue (apiCliente), `ejercitoBId`, `faccionAId` y `faccionBId`. Lo oyen los héroes de las dos columnas.
//   combate.asedio_conquista|_resistido    `faccionAtacanteId/DefensoraId`, poderes y bajas (sin ellos, cayó sin combate), `heridos`, `botin`;
//                                          lo oyen los atacantes y, el resistido, los residentes de la plaza (`asentamientoId`)
//   combate.pueblo_saqueado|_resiste, combate.avanzada_saqueada|_en_ruinas|_destruida|_resiste, combate.caravana_interceptada|_resiste
//                                          los atacantes (`heroesIds`); la caravana con `defensa` y `bajasEscolta`
// Los eventos sin `asentamientoId` viajan a todos los clientes: un informe solo es tuyo si tu héroe está en `heroesIds` de un lado.
import type { ProyeccionJugador } from '../apiCliente';
import type { EventoDominio } from '../tiposDominio';
import { nombreDeHeroe } from './nombres';
import { RECURSO_NOMBRE } from '../paletas';
import { iconoMini } from './iconosTropa';

export interface BajaDeEscuadra { escuadronId: string; tropaId: string; antes: number; despues: number }
export interface LadoDelInforme {
  poder: number;
  heroesIds: string[];
  bajas: BajaDeEscuadra[];
  /** Las bajas en total, cuando no vienen por escuadra (el motor, contra bandidos). */
  bajasTotales?: number;
}

export interface InformeDeCombate {
  version: number;
  momento?: string;
  tipo: 'bandidos' | 'combate';
  resultado: 'victoria' | 'derrota';
  /** Estabas en el lado que se defendía (te atacaron). */
  teAtacaron: boolean;
  titulo: string;
  resumen: string;
  rivalNombre: string;
  propio: LadoDelInforme;
  rival: LadoDelInforme | null;
  /** Solo contra bandidos: el poder del campamento. */
  poderRival: number;
  /** Contra bandidos, si cae (tanda 69): la madera, la piedra y el trigo que entraron en el carro de la columna, y las monedas de los héroes que
   * cobraron (`heroes`: cuántos iban; con uno solo, son las tuyas). */
  botin?: { recursos: Record<string, number>; monedas: number; heroes: number };
  /** Contra bandidos, si aguanta: lo que tu columna pierde de su carro (`carroPerdido`). */
  carroPerdido?: Record<string, number>;
  /** Entre jugadores: lo que entra en tu carro (lo robado y la chatarra) o lo que pierdes, en total; y cuántos héroes quedaron heridos. */
  cargaGanada?: number;
  cargaPerdida?: number;
  heridos?: number;
  /** Entre jugadores: quedas herido (perdiste en persona). */
  quedasHerido?: boolean;
  /** Un asedio que cayó sin combate: no había defensores con soldados. */
  sinCombate?: boolean;
}

const TROPA: Record<string, string> = { milicia_lanceros: 'Milicia de lanceros', lenadores: 'Leñadores', granjeros: 'Granjeros' };
const nombreTropa = (id: string): string => TROPA[id] ?? id.replace(/_/g, ' ');
const redondea = (n: number): string => (Math.round(n * 10) / 10).toString();

/** «a, b y c». */
export const enumerar = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Lo que dejan unos bandidos al caer (tanda 69): los recursos (al carro, `destino`) y las monedas de los héroes; `null` si no dejan nada. */
export function textoDeBotin(recursos: Record<string, number>, monedas: number, heroes: number, destino = ' al carro'): string | null {
  const partes = Object.entries(recursos).filter(([, n]) => n >= 1).map(([r, n]) => `${Math.floor(n)} de ${(RECURSO_NOMBRE[r] ?? r).toLowerCase()}`);
  const carro = partes.length ? `${enumerar(partes)}${destino}` : '';
  const suyas = monedas > 0 ? `${monedas} monedas${heroes > 1 ? ` entre los ${heroes} héroes` : ''}` : '';
  return carro || suyas ? enumerar([carro, suyas].filter(Boolean)) : null;
}

function htmlBotin(b: NonNullable<InformeDeCombate['botin']>, e: (s: string) => string): string {
  const texto = textoDeBotin(b.recursos, b.monedas, b.heroes);
  return `<div class="briefing-botin victoria"><span>Botín</span><strong>${texto ? `+${e(texto)}` : 'Sin botín'}</strong>${texto ? '' : '<small>Baja con cada campamento que destruyes en el día, y el de los bandidos de junto a un campamento de mercenarios es solo para quien aún no tiene plaza.</small>'}</div>`;
}

function esLado(v: unknown): v is LadoDelInforme {
  const l = v as LadoDelInforme | null;
  return !!l && typeof l.poder === 'number' && Array.isArray(l.heroesIds) && Array.isArray(l.bajas);
}

/** El informe de un evento de combate si tu héroe va en él; `null` si no es de combate o no es tuyo. */
export function informeDeEvento(e: EventoDominio, heroeId: string, proyeccion?: ProyeccionJugador | null): InformeDeCombate | null {
  const p = e.payload as Record<string, unknown> | undefined;
  if (!p) return null;
  if (e.codigo === 'combate.campamento_destruido' || e.codigo === 'combate.ataque_campamento_fallido') {
    if (!esLado(p.atacante) || !p.atacante.heroesIds.includes(heroeId)) return null;
    const victoria = e.codigo === 'combate.campamento_destruido';
    const nivel = Number(p.nivelCampamento ?? 0);
    const rivalNombre = nivel > 0 ? `Bandidos de nivel ${nivel}` : 'Bandidos';
    return {
      version: e.version, momento: e.momento, tipo: 'bandidos', resultado: victoria ? 'victoria' : 'derrota', teAtacaron: false,
      titulo: victoria ? 'Campamento de bandidos destruido' : 'Ataque fallido al campamento de bandidos',
      resumen: `${victoria ? 'Victoria' : 'Derrota'} contra ${rivalNombre.toLowerCase()} (tu poder ${redondea(p.atacante.poder)} contra ${redondea(Number(p.poderCampamento ?? 0))}).`,
      rivalNombre, propio: p.atacante, rival: null, poderRival: Number(p.poderCampamento ?? 0),
      ...(victoria
        ? { botin: { recursos: (p.botin as Record<string, number> | undefined) ?? {}, monedas: Number(p.monedas ?? 0), heroes: p.atacante.heroesIds.length } }
        : { carroPerdido: (p.carroPerdido as Record<string, number> | undefined) ?? {} }),
    };
  }
  if (e.codigo === 'combate.resuelto' && !esLado(p.atacante)) return informeEntreJugadores(e, heroeId, proyeccion);
  if (CODIGOS_ENTRE_JUGADORES.has(e.codigo)) return informeEntreJugadores(e, heroeId, proyeccion);
  if (e.codigo === 'combate.resuelto') {
    if (!esLado(p.atacante) || !esLado(p.defensor)) return null;
    const atacando = p.atacante.heroesIds.includes(heroeId);
    if (!atacando && !p.defensor.heroesIds.includes(heroeId)) return null;
    const propio = atacando ? p.atacante : p.defensor;
    const rival = atacando ? p.defensor : p.atacante;
    const victoria = p.ganador === (atacando ? 'atacante' : 'defensor');
    return {
      version: e.version, momento: e.momento, tipo: 'combate', resultado: victoria ? 'victoria' : 'derrota', teAtacaron: !atacando,
      titulo: atacando ? 'Atacaste' : 'Te atacaron',
      resumen: `${atacando ? 'Atacaste' : 'Te atacaron'} y ${victoria ? 'ganaste' : 'perdiste'} (tu poder ${redondea(propio.poder)} contra ${redondea(rival.poder)}).`,
      rivalNombre: 'Rival', propio, rival, poderRival: rival.poder,
    };
  }
  return null;
}

/** Los hechos de combate entre jugadores, además de `combate.resuelto` (que llega con la forma vieja o con la plana del motor). */
const CODIGOS_ENTRE_JUGADORES = new Set([
  'combate.asedio_conquista', 'combate.asedio_resistido', 'combate.pueblo_saqueado', 'combate.pueblo_resiste', 'combate.avanzada_saqueada',
  'combate.avanzada_en_ruinas', 'combate.avanzada_destruida', 'combate.avanzada_resiste', 'combate.caravana_interceptada', 'combate.caravana_resiste',
]);
/** En los que gana el atacante (en `combate.resuelto` lo dice `ganaElAtacante`). */
const GANA_EL_ATACANTE = new Set(['combate.asedio_conquista', 'combate.pueblo_saqueado', 'combate.avanzada_saqueada', 'combate.avanzada_en_ruinas', 'combate.avanzada_destruida', 'combate.caravana_interceptada']);

/** El título del informe: lo que pasó, visto desde tu lado. */
function tituloEntreJugadores(codigo: string, atacando: boolean, plaza: string): string {
  const en = plaza ? ` ${plaza}` : ' la plaza';
  switch (codigo) {
    case 'combate.resuelto': return atacando ? 'Atacaste una columna' : 'Atacaron tu columna';
    case 'combate.asedio_conquista': return `Conquistaste${en}`;
    case 'combate.asedio_resistido': return atacando ? `${plaza || 'La plaza'} resistió tu asedio` : `Asediaron${en} y resistió`;
    case 'combate.pueblo_saqueado': return 'Saqueaste un pueblo';
    case 'combate.pueblo_resiste': return 'El pueblo resistió tu ataque';
    case 'combate.avanzada_saqueada': return 'Saqueaste una avanzada';
    case 'combate.avanzada_en_ruinas': return 'Dejaste una avanzada en ruinas';
    case 'combate.avanzada_destruida': return 'Destruiste una avanzada';
    case 'combate.avanzada_resiste': return 'La avanzada resistió tu ataque';
    case 'combate.caravana_interceptada': return 'Interceptaste una caravana';
    default: return 'La caravana resistió tu ataque';
  }
}

/** El nombre de una Facción por su id (la tuya, las conocidas o el directorio); `null` si no se sabe. */
function nombreDeFaccion(p: ProyeccionJugador | null | undefined, id: unknown): string | null {
  if (typeof id !== 'string' || !id || !p) return null;
  return p.facciones.find((f) => f.id === id)?.nombre ?? p.directorioFacciones?.find((f) => f.id === id)?.nombre ?? null;
}

/** El informe de un combate entre jugadores, con lo que manda el motor (planos, en milésimas y sin bajas por escuadra); `null` si no es tuyo. */
export function informeEntreJugadores(e: EventoDominio, heroeId: string, p?: ProyeccionJugador | null): InformeDeCombate | null {
  const d = (e.payload ?? {}) as Record<string, unknown>;
  const num = (k: string): number => Number(d[k] ?? 0);
  const mil = (k: string): number => num(k) / 1000;
  const esColumna = e.codigo === 'combate.resuelto';
  const caravana = e.codigo.startsWith('combate.caravana');
  const nombrados = e.heroesIds ?? [];
  // ¿En qué lado ibas? Columna contra columna, por la columna atacante (`ejercitoId`); en lo demás, los atacantes son los héroes nombrados y,
  // en un asedio resistido, defiende quien reside en la plaza.
  let atacando: boolean;
  if (esColumna) {
    if (!nombrados.includes(heroeId)) return null;
    const atacante = p?.ejercitos.find((c) => c.id === d.ejercitoId);
    const defensora = p?.ejercitos.find((c) => c.id === d.ejercitoBId);
    atacando = atacante ? atacante.participantes.some((x) => x.heroeId === heroeId) : defensora ? !defensora.participantes.some((x) => x.heroeId === heroeId) : true;
  } else if (nombrados.includes(heroeId)) atacando = true;
  else if (e.codigo === 'combate.asedio_resistido' && e.asentamientoId && p?.heroe.residenciaId === e.asentamientoId) atacando = false;
  else return null;
  const ganaAtacante = esColumna ? num('ganaElAtacante') === 1 : GANA_EL_ATACANTE.has(e.codigo);
  const victoria = ganaAtacante === atacando;
  const sinCombate = d.poderAtacante === undefined;
  const lado = (poder: number, bajas: number, heroesIds: string[]): LadoDelInforme => ({ poder, heroesIds, bajas: [], bajasTotales: bajas });
  // los héroes de cada lado, si se ven sus columnas (en el resto, solo los atacantes)
  const de = (id: unknown): string[] => p?.ejercitos.find((c) => c.id === id)?.participantes.map((x) => x.heroeId) ?? [];
  const heroesA = esColumna ? de(d.ejercitoId) : nombrados;
  const heroesD = esColumna ? de(d.ejercitoBId) : atacando ? [] : [heroeId];
  const ladoA = lado(mil('poderAtacante'), num('bajasAtacante'), heroesA);
  const ladoD = lado(mil(caravana ? 'defensa' : 'poderDefensor'), num(caravana ? 'bajasEscolta' : 'bajasDefensor'), heroesD);
  const faccionRival = esColumna ? (atacando ? d.faccionBId : d.faccionAId) : e.codigo.startsWith('combate.asedio') ? (atacando ? d.faccionDefensoraId : d.faccionAtacanteId) : undefined;
  const generico = esColumna ? 'Columna enemiga' : e.codigo.startsWith('combate.asedio') ? (atacando ? 'La plaza' : 'Los asaltantes') : e.codigo.startsWith('combate.pueblo') ? 'El pueblo' : e.codigo.startsWith('combate.avanzada') ? 'La avanzada' : 'La caravana';
  const rivalNombre = nombreDeFaccion(p, faccionRival) ?? generico;
  const plaza = e.asentamientoId ? (p?.asentamientos.find((a) => a.id === e.asentamientoId)?.nombre ?? p?.asentamientosAvistados.find((a) => a.id === e.asentamientoId)?.nombre ?? '') : '';
  const propio = atacando ? ladoA : ladoD, rival = atacando ? ladoD : ladoA;
  const titulo = tituloEntreJugadores(e.codigo, atacando, plaza);
  const cargaGanada = victoria && atacando ? mil('botin') + (esColumna ? 0 : mil('saqueado')) : victoria && esColumna ? mil('botin') : 0;
  return {
    version: e.version, momento: e.momento, tipo: 'combate', resultado: victoria ? 'victoria' : 'derrota', teAtacaron: !atacando,
    titulo,
    resumen: sinCombate ? `${titulo}: no había defensores con soldados.` : `${titulo} y ${victoria ? 'ganaste' : 'perdiste'} (tu poder ${redondea(propio.poder)} contra ${redondea(rival.poder)}).`,
    rivalNombre, propio, rival, poderRival: rival.poder, sinCombate,
    cargaGanada, cargaPerdida: !victoria && esColumna ? mil('robado') : 0, heridos: num('heridos'),
    quedasHerido: !victoria && (esColumna || atacando),
  };
}

function tablaBajas(lado: LadoDelInforme, nombre: (b: BajaDeEscuadra) => string, e: (s: string) => string): string {
  if (lado.bajas.length === 0) return `<p class="mapa-lista-vacia">${lado.bajasTotales ? `${lado.bajasTotales} bajas en total (sin detalle por escuadra).` : 'Sin escuadras.'}</p>`;
  return `<table class="briefing-bajas"><thead><tr><th>Escuadra</th><th>Antes</th><th>Después</th><th>Bajas</th></tr></thead><tbody>${lado.bajas
    .map((b) => `<tr><td>${iconoMini(b.tropaId)}${e(nombre(b))}</td><td>${b.antes}</td><td>${b.despues}</td><td class="${b.antes - b.despues > 0 ? 'baja' : ''}">${b.antes - b.despues > 0 ? `−${b.antes - b.despues}` : '0'}</td></tr>`)
    .join('')}</tbody></table>`;
}

/** Lo que entra en tu carro o lo que pierdes en un combate entre jugadores, y si quedas herido. */
function htmlCargaEntreJugadores(i: InformeDeCombate, e: (s: string) => string): string {
  if (i.cargaGanada === undefined) return '';
  const partes: string[] = [];
  if (i.sinCombate) partes.push('<div class="briefing-botin victoria"><span>Sin combate</span><strong>No había defensores con soldados</strong></div>');
  if (i.cargaGanada >= 1) partes.push(`<div class="briefing-botin victoria"><span>Botín</span><strong>+${Math.floor(i.cargaGanada)} de carga en tu carro</strong><small>Lo robado y la chatarra de las bajas, hasta lo que cabe en tu carro.</small></div>`);
  if ((i.cargaPerdida ?? 0) >= 1) partes.push(`<div class="briefing-botin derrota"><span>Pierdes del carro</span><strong>${Math.floor(i.cargaPerdida!)} de carga</strong><small>La mitad de lo que llevabas, para el ganador.</small></div>`);
  if (i.quedasHerido) partes.push(`<div class="briefing-botin derrota"><span>Heridos</span><strong>${e(i.heridos ? `${i.heridos} héroe${i.heridos === 1 ? '' : 's'} herido${i.heridos === 1 ? '' : 's'}` : 'Quedas herido')}</strong><small>Un herido no ataca ni persigue durante un rato.</small></div>`);
  return partes.join('');
}

/** El briefing completo, para el modal y el historial. */
export function htmlInforme(i: InformeDeCombate, p: ProyeccionJugador, e: (s: string) => string): string {
  const mia = (b: BajaDeEscuadra): string => p.heroe.escuadrones.find((s) => s.id === b.escuadronId)?.nombre ?? nombreTropa(b.tropaId);
  // entre jugadores no siempre se sabe quién iba en el otro lado: entonces no se dice
  const entreJugadores = i.cargaGanada !== undefined;
  const heroes = (l: LadoDelInforme): string => (l.heroesIds.length > 0 ? l.heroesIds.map((id) => e(nombreDeHeroe(p, id))).join(', ') : entreJugadores ? '' : 'sin héroes');
  const linea = (l: LadoDelInforme): string => [heroes(l), total(l)].filter(Boolean).join(' · ');
  const total = (l: LadoDelInforme): string => `${l.bajasTotales ?? l.bajas.reduce((s, b) => s + b.antes - b.despues, 0)} bajas`;
  return `
    <span class="faction-kicker">Informe de combate${i.momento ? ` · ${e(new Date(i.momento).toLocaleString())}` : ''}</span>
    <h3 class="briefing-titulo ${i.resultado}">${i.resultado === 'victoria' ? 'Victoria' : 'Derrota'} · ${e(i.titulo)}</h3>
    <div class="briefing-bandos">
      <div><span>Tu bando</span><strong>Poder ${redondea(i.propio.poder)}</strong><small>${linea(i.propio)}</small></div>
      <div><span>${e(i.rivalNombre)}</span><strong>Poder ${redondea(i.poderRival)}</strong><small>${i.rival ? linea(i.rival) : 'los defiende el campamento'}</small></div>
    </div>
    ${entreJugadores && i.propio.bajas.length === 0 ? '' : `<strong class="heroe-sub">Tus escuadras</strong>
    ${tablaBajas(i.propio, mia, e)}
    ${i.rival ? `<strong class="heroe-sub">Escuadras rivales</strong>${tablaBajas(i.rival, (b) => nombreTropa(b.tropaId), e)}` : ''}`}
    ${i.botin ? htmlBotin(i.botin, e) : ''}
    ${htmlCargaEntreJugadores(i, e)}
    ${i.carroPerdido !== undefined ? `<div class="briefing-botin derrota"><span>Pierdes del carro</span><strong>${Object.entries(i.carroPerdido).filter(([, n]) => n >= 1).map(([r, n]) => `${Math.floor(n)} ${e(RECURSO_NOMBRE[r] ?? r)}`).join(', ') || 'nada: el carro iba vacío'}</strong><small>Quedas herido: no atacas ni persigues durante 2 minutos.</small></div>` : ''}`;
}
