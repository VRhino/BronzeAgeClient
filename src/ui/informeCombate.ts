// Informe de un combate (doc 02 §4.1b, backend 2026-10-06): lo que el servidor cuenta en el payload de sus eventos de resolución, ordenado como un
// briefing breve —ganador, poder de cada bando y bajas por escuadra— para quien iba en uno de los dos lados.
//   combate.resuelto                         { ganador, atacante: LadoDelInforme, defensor: LadoDelInforme, ... }   (asedios y encuentros)
//   combate.campamento_destruido / combate.ataque_campamento_fallido   { nivelCampamento, poderCampamento, atacante: LadoDelInforme }
// Los eventos sin `asentamientoId` viajan a todos los clientes: un informe solo es tuyo si tu héroe está en `heroesIds` de un lado.
import type { ProyeccionJugador } from '../apiCliente';
import type { EventoDominio } from '../tiposDominio';
import { nombreDeHeroe } from './nombres';

export interface BajaDeEscuadra { escuadronId: string; tropaId: string; antes: number; despues: number }
export interface LadoDelInforme { poder: number; heroesIds: string[]; bajas: BajaDeEscuadra[] }

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
}

const TROPA: Record<string, string> = { milicia_lanceros: 'Milicia de lanceros', lenadores: 'Leñadores', granjeros: 'Granjeros' };
const nombreTropa = (id: string): string => TROPA[id] ?? id.replace(/_/g, ' ');
const redondea = (n: number): string => (Math.round(n * 10) / 10).toString();

function esLado(v: unknown): v is LadoDelInforme {
  const l = v as LadoDelInforme | null;
  return !!l && typeof l.poder === 'number' && Array.isArray(l.heroesIds) && Array.isArray(l.bajas);
}

/** El informe de un evento de combate si tu héroe va en él; `null` si no es de combate o no es tuyo. */
export function informeDeEvento(e: EventoDominio, heroeId: string): InformeDeCombate | null {
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
    };
  }
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

function tablaBajas(lado: LadoDelInforme, nombre: (b: BajaDeEscuadra) => string, e: (s: string) => string): string {
  if (lado.bajas.length === 0) return '<p class="mapa-lista-vacia">Sin escuadras.</p>';
  return `<table class="briefing-bajas"><thead><tr><th>Escuadra</th><th>Antes</th><th>Después</th><th>Bajas</th></tr></thead><tbody>${lado.bajas
    .map((b) => `<tr><td>${e(nombre(b))}</td><td>${b.antes}</td><td>${b.despues}</td><td class="${b.antes - b.despues > 0 ? 'baja' : ''}">${b.antes - b.despues > 0 ? `−${b.antes - b.despues}` : '0'}</td></tr>`)
    .join('')}</tbody></table>`;
}

/** El briefing completo, para el modal y el historial. */
export function htmlInforme(i: InformeDeCombate, p: ProyeccionJugador, e: (s: string) => string): string {
  const mia = (b: BajaDeEscuadra): string => p.heroe.escuadrones.find((s) => s.id === b.escuadronId)?.nombre ?? nombreTropa(b.tropaId);
  const heroes = (l: LadoDelInforme): string => (l.heroesIds.length > 0 ? l.heroesIds.map((id) => e(nombreDeHeroe(p, id))).join(', ') : 'sin héroes');
  const total = (l: LadoDelInforme): string => `${l.bajas.reduce((s, b) => s + b.antes - b.despues, 0)} bajas`;
  return `
    <span class="faction-kicker">Informe de combate${i.momento ? ` · ${e(new Date(i.momento).toLocaleString())}` : ''}</span>
    <h3 class="briefing-titulo ${i.resultado}">${i.resultado === 'victoria' ? 'Victoria' : 'Derrota'} · ${e(i.titulo)}</h3>
    <div class="briefing-bandos">
      <div><span>Tu bando</span><strong>Poder ${redondea(i.propio.poder)}</strong><small>${heroes(i.propio)} · ${total(i.propio)}</small></div>
      <div><span>${e(i.rivalNombre)}</span><strong>Poder ${redondea(i.poderRival)}</strong><small>${i.rival ? `${heroes(i.rival)} · ${total(i.rival)}` : 'los defiende el campamento'}</small></div>
    </div>
    <strong class="heroe-sub">Tus escuadras</strong>
    ${tablaBajas(i.propio, mia, e)}
    ${i.rival ? `<strong class="heroe-sub">Escuadras rivales</strong>${tablaBajas(i.rival, (b) => nombreTropa(b.tropaId), e)}` : ''}
    ${i.tipo === 'bandidos' && i.resultado === 'derrota' ? '<p class="asent-lado-nota">Quedaste herido y perdiste la mitad del carro.</p>' : ''}`;
}
