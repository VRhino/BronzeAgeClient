// Mercenarios por contrato (motor 7aa44b9, Mercenarios_Por_Contrato; entrada 48). Un héroe bot sin Facción se ofrece en el TABLÓN de su campamento; un cargo
// de una Facción humana va allí en persona, con el oro en el carro, y lo contrata para un trabajo (defender, escoltar, atacar, acompañar) por 1, 3 o 7 días,
// o como permanente. Mientras dura, es ciudadano con MARCA de esa Facción y obedece las órdenes (guardar, ir a, atacar, unirse) de quien le alcance.
//
// La interfaz es la de un juego de estrategia (Víctor, 2026-11-01): tarjetas con insignia de rango y medallas, el precio de cada plazo como fichas que se
// eligen, el trabajo con su icono, y una barra de órdenes como la de un RTS que solo enciende lo que la selección admite. El cliente adelanta lo que el motor
// va a decir (quién firma, qué orden cabe en cada contrato, si llega el oro) para no dejar pulsar lo que se va a rechazar; quien decide sigue siendo el motor.
import { bloqueDeDatos, type ProyeccionJugador } from '../apiCliente';
import type { CampamentoMercenarios, ContratoMercenario, EventoDominio, FichaMercenario, ObjetivoMercenario, OfertaMercenario, Point } from '../tiposDominio';
import { ayuda } from './ayuda';
import { fuentesDeContrato, type FuenteDeContrato, type PagarContratoCon } from './columnaQuePaga';
import { confirmar } from './dialogo';
import { textoEnTiempoReal } from './estadoCliente';
import { iconoMini } from './iconosTropa';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';
import { nombreDeClase } from './clasesHeroe';

type Escapar = (s: string) => string;

// ── catálogo de textos e iconos ──

export const RANGO_MERCENARIO: Record<string, string> = { a_sueldo: 'A sueldo', lanza: 'Lanza', capitan: 'Capitán', veterano: 'Veterano', senor_de_la_guerra: 'Señor de la guerra' };
const RANGO_POR_NUMERO = ['', 'a_sueldo', 'lanza', 'capitan', 'veterano', 'senor_de_la_guerra'];
const MEDALLA: Record<string, { nombre: string; icono: string; como: string }> = {
  palabra_cumplida: { nombre: 'Palabra cumplida', icono: '✋', como: 'contratos acabados por plazo' },
  cazador_de_bandidos: { nombre: 'Cazador de bandidos', icono: '🏹', como: 'campamentos de bandidos vencidos' },
  muralla: { nombre: 'Muralla', icono: '🧱', como: 'defensas ganadas de lo que guardaba' },
  buen_camino: { nombre: 'Buen camino', icono: '🐂', como: 'caravanas escoltadas hasta su destino' },
  asaltante: { nombre: 'Asaltante', icono: '🔥', como: 'asaltos ganados a pueblos, avanzadas o plazas' },
  campana: { nombre: 'Campaña', icono: '⚑', como: 'campañas acabadas dentro del ejército' },
  bien_valorado: { nombre: 'Bien valorado', icono: '👍', como: 'valoraciones buenas' },
  leal: { nombre: 'Leal', icono: '⚓', como: 'días seguidos como permanente' },
};
const GRADO = ['', 'bronce', 'plata', 'oro'];
const TRABAJO: Record<string, { nombre: string; icono: string; texto: string }> = {
  defender: { nombre: 'Defender', icono: '🛡', texto: 'Guarda una plaza, un pueblo o una avanzada tuya y la defiende si la atacan.' },
  escoltar: { nombre: 'Escoltar', icono: '🐂', texto: 'Protege una caravana tuya (también un carro de acarreo, un encargo o una ruta).' },
  atacar: { nombre: 'Atacar', icono: '⚔', texto: 'Un solo ataque contra bandidos o contra algo de una Facción en guerra contigo.' },
  acompanar: { nombre: 'Acompañar', icono: '⚑', texto: 'Se une a una convocatoria o a un ejército tuyo y va con él.' },
  permanente: { nombre: 'Permanente', icono: '🏛', texto: 'Hasta que lo despidas. Reside en la plaza que elijas y admite todas las órdenes. Solo lo firman el Rey o el Embajador.' },
};
const ORDEN: Record<string, { nombre: string; icono: string; texto: string }> = {
  guardar: { nombre: 'Guardar', icono: '🛡', texto: 'Guarnece, escolta y defiende lo que guarda. Sin plazo.' },
  ir_a: { nombre: 'Ir a', icono: '➜', texto: 'Va a un punto del mapa. Caduca a las 24 h.' },
  atacar: { nombre: 'Atacar', icono: '⚔', texto: 'Un solo ataque contra ese objetivo. Caduca a las 24 h si no ataca, o con la paz.' },
  unirse: { nombre: 'Unirse', icono: '⚑', texto: 'Se une a ese ejército o convocatoria, y a ningún otro.' },
};
const CARGO: Record<string, string> = { rey: 'Rey', embajador: 'Embajador', general: 'General', gobernador: 'Gobernador', maestroCaravanas: 'Maestro de Caravanas' };
const FIN: Record<string, string> = { plazo: 'se cumplió el plazo', despido: 'despedido', plaza_perdida: 'se perdió la plaza que lo firmó', sin_ciudadanos: 'no quedan ciudadanos sin marca', faccion_perdida: 'dejó de ser ciudadano' };
const TRABAJOS = ['defender', 'escoltar', 'atacar', 'acompanar', 'permanente'] as const;
const TIPOS_ORDEN = ['guardar', 'ir_a', 'atacar', 'unirse'] as const;
/** Qué órdenes admite cada trabajo (`TRABAJOS_MERCENARIOS.admite`); en defender y escoltar, `guardar` solo sobre el objetivo del contrato y `atacar` cerca de él. */
const ADMITE: Record<string, string[]> = { defender: ['guardar', 'ir_a', 'atacar'], escoltar: ['guardar', 'ir_a'], atacar: ['atacar', 'ir_a'], acompanar: ['unirse', 'atacar', 'ir_a', 'guardar'], permanente: ['guardar', 'ir_a', 'atacar', 'unirse'] };
const PLAZOS = [1, 3, 7];
const LEVA_PROPIA = ['milicia_lanceros', 'granjeros', 'mineros', 'lenadores'];

const oro = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const nombreTropa = (id: string): string => id.replace(/_/g, ' ');
const dias = (d: number): string => `${d} día${d === 1 ? '' : 's'}`;

// ── insignias y ficha ──

/** La insignia del rango: un escudo con tantos galones como su rango (1 a 5), del bronce al oro. */
export function insigniaDeRango(rango: number, lado = 26): string {
  const color = rango >= 5 ? '#f1dcae' : rango >= 4 ? '#d8b878' : rango >= 3 ? '#c9a15e' : rango >= 2 ? '#a9793f' : '#8a6a45';
  const galones = Array.from({ length: Math.max(1, Math.min(5, rango)) }, (_, i) => `<path d="M7 ${18.5 - i * 2.8} l5 -2.4 l5 2.4" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>`).join('');
  return `<svg class="merc-insignia" width="${lado}" height="${lado}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L21 5 V12 C21 17 17 20.5 12 22 C7 20.5 3 17 3 12 V5 Z" fill="#14100c" stroke="${color}" stroke-width="1.4"/>${galones}</svg>`;
}

function medallaHtml(m: FichaMercenario['medallas'][number], e: Escapar, entera: boolean): string {
  const x = MEDALLA[m.id] ?? { nombre: m.id, icono: '★', como: '' };
  const titulo = `${x.nombre}${m.grado ? ` (${GRADO[m.grado]})` : ''}${entera ? `: ${m.cuenta} ${x.como}${m.siguienteUmbral !== undefined ? `; el grado siguiente, a ${m.siguienteUmbral}` : ''}` : ''}`;
  return `<span class="merc-medalla merc-grado-${m.grado}" title="${e(titulo)}">${x.icono}${entera && m.siguienteUmbral !== undefined ? `<small>${m.cuenta}/${m.siguienteUmbral}</small>` : ''}</span>`;
}

/** La ficha de un mercenario. `entera`: con la cuenta de cada medalla y el historial (la propia y la del tablón); si no, la reducida del héroe público. */
export function htmlFichaMercenario(f: FichaMercenario, e: Escapar, entera = true, conRango = true): string {
  const siguiente = f.renombreSiguienteRango;
  const medallas = f.medallas.filter((m) => m.grado > 0 || (entera && m.cuenta > 0));
  const h = f.historial;
  const cumplidos = h && h.firmados > 0 ? Math.round((h.terminados / h.firmados) * 100) : undefined;
  return `<div class="merc-ficha">
    ${conRango ? `<div class="merc-rango">${insigniaDeRango(f.rango)}<div><strong>${e(RANGO_MERCENARIO[f.rangoId] ?? f.rangoId)}</strong><small>${f.renombre}${siguiente ? ` / ${siguiente}` : ''} de renombre</small></div></div>` : `<small class="merc-renombre-texto">Renombre ${f.renombre}${siguiente ? ` / ${siguiente} para ${e(RANGO_MERCENARIO[RANGO_POR_NUMERO[f.rango + 1] ?? ''] ?? 'el siguiente rango')}` : ' · rango máximo'}</small>`}
    ${siguiente ? `<div class="faccion-xp-barra merc-renombre" title="${f.renombre} de ${siguiente} para el rango siguiente"><span style="width:${Math.min(100, (f.renombre / siguiente) * 100).toFixed(1)}%"></span></div>` : ''}
    ${medallas.length ? `<div class="merc-medallas">${medallas.map((m) => medallaHtml(m, e, entera)).join('')}</div>` : ''}
    ${entera && h ? `<div class="merc-historial" title="Contratos firmados, cumplidos, despidos y valoraciones buenas y malas"><span>📜 ${h.firmados}</span><span>✓ ${h.terminados}</span><span>✗ ${h.despidos}</span><span>👍 ${h.buenas}</span><span>👎 ${h.malas}</span>${cumplidos !== undefined ? `<span class="merc-fiable">${cumplidos} % cumplidos</span>` : ''}</div>` : ''}
  </div>`;
}

/** El héroe público mercenario en una ficha del mapa: insignia, marca, rango y renombre, y sus medallas como iconos (la ficha reducida). */
export function htmlMercenarioPublico(contratado: string | undefined, f: FichaMercenario | undefined, e: Escapar): string {
  if (!contratado && !f) return '';
  const rango = f ? `${e(RANGO_MERCENARIO[f.rangoId] ?? f.rangoId)} · ${f.renombre} de renombre` : '';
  return `<div class="merc-publico">${f ? insigniaDeRango(f.rango, 22) : ''}<span><strong>${contratado ? `Mercenario ${e(contratado)}` : 'Mercenario sin contrato'}</strong><small>${rango}</small></span>${f ? `<span class="merc-medallas">${f.medallas.filter((m) => m.grado > 0).map((m) => medallaHtml(m, e, false)).join('')}</span>` : ''}</div>`;
}

/** La chapa de la marca para listas de ciudadanos. */
export const chapaDeMarca = (marca?: string): string =>
  marca ? `<span class="merc-marca merc-marca-${marca === 'permanente' ? 'perm' : 'temp'}" title="Mercenario con contrato ${marca}: no recibe cargos, trono ni mando">${marca === 'permanente' ? '🏛' : '⚔'} ${marca}</span>` : '';

// ── el mundo visto para elegir ──

function nombreDePlaza(p: ProyeccionJugador, id: string): string {
  return p.asentamientos.find((x) => x.id === id)?.nombre || p.asentamientosAvistados.find((x) => x.id === id)?.nombre || p.asentamientosConocidos.find((x) => x.asentamientoId === id)?.nombre || id;
}

function posicionDePlaza(p: ProyeccionJugador, id: string): Point | undefined {
  return p.asentamientos.find((x) => x.id === id)?.posicion ?? p.asentamientosAvistados.find((x) => x.id === id)?.posicion ?? p.asentamientosConocidos.find((x) => x.asentamientoId === id)?.posicion;
}

/** Dónde está el jugador: su columna, el lugar donde está dentro o el campamento. */
function miPosicion(p: ProyeccionJugador): Point | undefined {
  const u = p.heroe.ubicacion;
  const columna = p.ejercitos.find((x) => x.participantes.some((y) => y.heroeId === p.heroeId));
  if (columna) return columna.posicionActual;
  if (u.tipo === 'asentamiento') return posicionDePlaza(p, u.asentamientoId);
  if (u.tipo === 'mercenarios') return p.campamentosMercenarios.find((c) => c.id === u.campamentoId)?.posicion;
  if (u.tipo === 'pueblo') return p.pueblos?.find((x) => x.id === u.puebloId)?.posicion;
  if (u.tipo === 'avanzada') return p.avanzadas?.find((x) => x.id === u.avanzadaId)?.posicion;
  return u.tipo === 'desconectado' ? u.punto : undefined;
}

/** Dónde está un objetivo, si se ve. */
export function posicionDeObjetivo(p: ProyeccionJugador, o?: ObjetivoMercenario): Point | undefined {
  if (!o) return undefined;
  const id = o.id ?? '';
  switch (o.campo) {
    case 'asentamientoId': return posicionDePlaza(p, id);
    case 'puebloId': return p.pueblos?.find((x) => x.id === id)?.posicion;
    case 'avanzadaId': return p.avanzadas?.find((x) => x.id === id)?.posicion;
    case 'caravanaId': return p.caravanas.find((x) => x.id === id)?.posicionActual ?? p.caravanasAvistadas?.find((x) => x.id === id)?.posicionActual;
    case 'campamentoId': return p.campamentosBandidos.find((x) => x.id === id)?.posicion;
    case 'ejercitoId': return p.ejercitos.find((x) => x.id === id)?.posicionActual ?? p.ejercitosAvistados.find((x) => x.id === id)?.posicionActual;
    case 'convocatoriaId': {
      const c = p.convocatorias?.find((x) => x.id === id);
      if (!c) return undefined;
      return c.lugar.tipo === 'asentamiento' ? posicionDePlaza(p, c.lugar.id) : p.campamentosMercenarios.find((x) => x.id === c.lugar.id)?.posicion;
    }
    case 'punto': return o.punto;
    default: return undefined;
  }
}

/** «Rey», «General de Micenas». */
export function textoDePuesto(p: ProyeccionJugador, puesto?: string): string {
  if (!puesto) return 'orden inicial';
  const [cargo, donde] = puesto.split('@');
  return `${CARGO[cargo!] ?? cargo}${donde ? ` de ${nombreDePlaza(p, donde)}` : ''}`;
}

export function textoDeObjetivo(p: ProyeccionJugador, o?: ObjetivoMercenario): string {
  if (!o) return '—';
  const id = o.id ?? '';
  switch (o.campo) {
    case 'asentamientoId': return nombreDePlaza(p, id);
    case 'puebloId': {
      const x = p.pueblos?.find((y) => y.id === id);
      return x ? `${x.tipo === 'aldeaAgricola' ? 'Aldea' : 'Pueblo'} de ${nombreDePlaza(p, x.madreId)}` : `Pueblo ${id}`;
    }
    case 'avanzadaId': {
      const x = p.avanzadas?.find((y) => y.id === id);
      return x ? `Avanzada de ${nombreDePlaza(p, x.madreId)}` : `Avanzada ${id}`;
    }
    case 'caravanaId': {
      const x = p.caravanas.find((y) => y.id === id);
      if (x?.nombre) return `${x.nombre}${x.destinoAsentamientoId ? ` (a ${nombreDePlaza(p, x.destinoAsentamientoId)})` : ''}`;
      return x ? `Caravana de ${nombreDePlaza(p, x.origenAsentamientoId)}${x.destinoAsentamientoId ? ` a ${nombreDePlaza(p, x.destinoAsentamientoId)}` : ''}` : `Caravana ${id}`;
    }
    case 'campamentoId': return `Bandidos (${id})`;
    case 'ejercitoId': {
      const x = p.ejercitos.find((y) => y.id === id);
      return x?.liderId ? `Ejército de ${nombreDeHeroe(p, x.liderId)}` : `Ejército ${id}`;
    }
    case 'convocatoriaId': {
      const x = p.convocatorias?.find((y) => y.id === id);
      return x ? `Convocatoria de ${nombreDeHeroe(p, x.liderId)}` : `Convocatoria ${id}`;
    }
    case 'faccionId': return p.facciones.find((f) => f.id === id)?.nombre ?? id;
    case 'punto': return `Punto (${Math.round(o.punto?.x ?? 0)}, ${Math.round(o.punto?.y ?? 0)})`;
    default: return id;
  }
}

interface Opcion { valor: string; etiqueta: string; plaza?: string; posicion?: Point; liderId?: string; bandidos?: boolean }
const clave = (o: ObjetivoMercenario | undefined): string => (o ? `${o.campo}:${o.id ?? ''}` : '');

/** Las Facciones en guerra con la tuya (relación de guerra activa). */
export function enGuerraCon(p: ProyeccionJugador): Set<string> {
  const r = new Set<string>();
  for (const x of p.relaciones ?? []) {
    if (x.tipo !== 'guerra' || x.estado !== 'activa') continue;
    if (x.faccionAId === p.faccionId) r.add(x.faccionBId);
    if (x.faccionBId === p.faccionId) r.add(x.faccionAId);
  }
  return r;
}

function plazasDe(p: ProyeccionJugador, cumple: (faccionId: string) => boolean): { id: string; nombre: string; posicion: Point }[] {
  const m = new Map<string, { id: string; nombre: string; posicion: Point; faccionId: string }>();
  for (const a of p.asentamientosConocidos) m.set(a.asentamientoId, { id: a.asentamientoId, nombre: a.nombre ?? a.asentamientoId, posicion: a.posicion, faccionId: a.faccionId });
  for (const a of [...p.asentamientosAvistados, ...p.asentamientos]) m.set(a.id, { id: a.id, nombre: a.nombre ?? a.id, posicion: a.posicion, faccionId: a.faccionId });
  return [...m.values()].filter((x) => cumple(x.faccionId));
}

function objetivosPropios(p: ProyeccionJugador) {
  const o = (campo: string, id: string, resto: Omit<Opcion, 'valor'>): Opcion => ({ valor: `${campo}:${id}`, ...resto });
  return {
    plazas: plazasDe(p, (f) => f === p.faccionId).map((x) => o('asentamientoId', x.id, { etiqueta: `🏰 ${x.nombre}`, plaza: x.id, posicion: x.posicion })),
    pueblos: (p.pueblos ?? []).filter((x) => x.propio).map((x) => o('puebloId', x.id, { etiqueta: `${x.tipo === 'aldeaAgricola' ? (x.cultivo === 'ganado' ? '🐄 Aldea' : '🌾 Aldea') : '⛏ Pueblo'} de ${nombreDePlaza(p, x.madreId)}`, plaza: x.madreId, posicion: x.posicion })),
    avanzadas: (p.avanzadas ?? []).filter((x) => x.propia && !x.enRuinas).map((x) => o('avanzadaId', x.id, { etiqueta: `🗼 Avanzada de ${nombreDePlaza(p, x.madreId)}`, plaza: x.madreId, posicion: x.posicion })),
    caravanas: p.caravanas.filter((x) => !x.faccionId || x.faccionId === p.faccionId).map((x) => o('caravanaId', x.id, { etiqueta: `🐂 ${textoDeObjetivo(p, { campo: 'caravanaId', id: x.id })}`, plaza: x.origenAsentamientoId, posicion: x.posicionActual })),
    ejercitos: p.ejercitos.filter((x) => x.faccionId === p.faccionId && x.tipo === 'ejercito').map((x) => o('ejercitoId', x.id, { etiqueta: `⚑ Ejército de ${x.liderId ? nombreDeHeroe(p, x.liderId) : x.id}`, posicion: x.posicionActual, liderId: x.liderId })),
    convocatorias: (p.convocatorias ?? []).map((x) => o('convocatoriaId', x.id, { etiqueta: `⚑ Convocatoria de ${nombreDeHeroe(p, x.liderId)}`, liderId: x.liderId, posicion: posicionDeObjetivo(p, { campo: 'convocatoriaId', id: x.id }) })),
  };
}

function objetivosAtacables(p: ProyeccionJugador): Opcion[] {
  const guerra = enGuerraCon(p);
  const enemigas = plazasDe(p, (f) => guerra.has(f));
  const madres = new Set(enemigas.map((x) => x.id));
  const faccion = (id?: string) => p.facciones.find((f) => f.id === id)?.nombre ?? id ?? '';
  return [
    ...p.campamentosBandidos.map((x) => ({ valor: `campamentoId:${x.id}`, etiqueta: `☠ Bandidos (${x.id})`, posicion: x.posicion, bandidos: true })),
    ...enemigas.map((x) => ({ valor: `asentamientoId:${x.id}`, etiqueta: `🏰 ${x.nombre} (en guerra)`, posicion: x.posicion })),
    ...(p.pueblos ?? []).filter((x) => !x.propio && madres.has(x.madreId)).map((x) => ({ valor: `puebloId:${x.id}`, etiqueta: `⛏ Pueblo de ${nombreDePlaza(p, x.madreId)} (en guerra)`, posicion: x.posicion })),
    ...(p.avanzadas ?? []).filter((x) => !x.propia && madres.has(x.madreId)).map((x) => ({ valor: `avanzadaId:${x.id}`, etiqueta: `🗼 Avanzada de ${nombreDePlaza(p, x.madreId)} (en guerra)`, posicion: x.posicion })),
    ...p.ejercitosAvistados.filter((x) => guerra.has(x.faccionId)).map((x) => ({ valor: `ejercitoId:${x.id}`, etiqueta: `⚔ Columna de ${faccion(x.faccionId)} (en guerra)`, posicion: x.posicionActual })),
    ...(p.caravanasAvistadas ?? []).filter((x) => x.faccionId && guerra.has(x.faccionId)).map((x) => ({ valor: `caravanaId:${x.id}`, etiqueta: `🐂 Caravana de ${faccion(x.faccionId)} (en guerra)`, posicion: x.posicionActual })),
  ];
}

/** Ordena por cercanía y pone la distancia en la etiqueta: en un mapa grande, lo primero que se mira es qué queda a mano. */
function porCercania(p: ProyeccionJugador, lista: Opcion[]): Opcion[] {
  const yo = miPosicion(p);
  if (!yo) return lista;
  const d = (o: Opcion): number => (o.posicion ? Math.hypot(o.posicion.x - yo.x, o.posicion.y - yo.y) : Infinity);
  return [...lista].sort((a, b) => d(a) - d(b)).map((o) => (Number.isFinite(d(o)) ? { ...o, etiqueta: `${o.etiqueta} · a ${Math.round(d(o))} u` } : o));
}

// ── quién puede (§3.2 y §6.5): el cliente lo adelanta para no ofrecer lo que se va a rechazar ──

interface Puestos { rey: boolean; embajador: boolean; local: (cargo: string, plaza?: string) => boolean; algunLocal: (cargo: string) => boolean }

function misPuestos(p: ProyeccionJugador): Puestos {
  const f = p.facciones.find((x) => x.id === p.faccionId);
  const cargos = f?.miembros?.find((m) => m.heroeId === p.heroeId)?.cargos ?? [];
  return {
    rey: !!f && (f.reyId === p.heroeId || cargos.includes('rey')),
    embajador: !!f && (f.embajadorId === p.heroeId || cargos.includes('embajador')),
    local: (cargo, plaza) => plaza !== undefined && cargos.includes(`${cargo}@${plaza}`),
    algunLocal: (cargo) => cargos.some((c) => c.startsWith(`${cargo}@`)),
  };
}

/** Con qué puesto firmaría el jugador ese trabajo sobre ese objetivo (el de más rango que alcance), o `null`. */
function puestoParaFirmar(p: ProyeccionJugador, yo: Puestos, trabajo: string, o: Opcion): string | null {
  if (yo.rey) return 'Rey';
  if (yo.embajador) return 'Embajador';
  if (trabajo === 'permanente') return null;
  const local = (c: string): string | null => (yo.local(c, o.plaza) ? `${CARGO[c]} de ${nombreDePlaza(p, o.plaza!)}` : null);
  switch (trabajo) {
    case 'defender': return local('general') ?? local('gobernador');
    case 'escoltar': return local('gobernador') ?? local('maestroCaravanas');
    // Bandidos «de su zona»: la zona la comprueba el motor. El General además ataca lo de quien esté en guerra.
    case 'atacar': return yo.algunLocal('general') ? 'General' : o.bandidos && yo.algunLocal('gobernador') ? 'Gobernador' : null;
    case 'acompanar': return yo.algunLocal('general') && o.liderId === p.heroeId ? 'General' : null;
    default: return null;
  }
}

/** ¿Podría el jugador firmar hoy este contrato? (prorrogar y despedir los hace «quien podría firmarlo»). */
function puedeGestionar(yo: Puestos, c: ContratoMercenario): boolean {
  if (yo.rey || yo.embajador) return true;
  if (!c.asentamientoId) return false;
  const en = (cargo: string) => yo.local(cargo, c.asentamientoId);
  switch (c.trabajo) {
    case 'defender': case 'atacar': return en('general') || en('gobernador');
    case 'escoltar': return en('gobernador') || en('maestroCaravanas');
    case 'acompanar': return en('general');
    default: return false;
  }
}

/** Las órdenes que el jugador puede dar a ese contrato: las que admite su trabajo (§6.4) y le deja dar su cargo (§6.5). */
function ordenesPosibles(yo: Puestos, c: ContratoMercenario, residencia?: string): Set<string> {
  const admite = ADMITE[c.trabajo] ?? [];
  if (c.finAplazado) return new Set();
  if (yo.rey || yo.embajador) return new Set(admite);
  const plaza = c.trabajo === 'permanente' ? residencia : c.asentamientoId;
  const mias = new Set<string>();
  if (yo.local('general', plaza)) ['guardar', 'atacar', 'unirse', 'ir_a'].forEach((x) => mias.add(x));
  if (yo.local('gobernador', plaza)) ['guardar', 'atacar', 'ir_a'].forEach((x) => mias.add(x));
  if (c.trabajo === 'escoltar' && yo.local('maestroCaravanas', c.asentamientoId)) ['guardar', 'ir_a'].forEach((x) => mias.add(x));
  return new Set(admite.filter((x) => mias.has(x)));
}

// ── utilidades de formulario ──

const htmlSelect = (atributos: string, opciones: Opcion[], e: Escapar, vacio = 'Ninguno a la vista', clase = ''): string =>
  `<select class="form-input${clase ? ` ${clase}` : ''}" ${atributos}${opciones.length ? '' : ' disabled'}>${opciones.length ? opciones.map((o) => `<option value="${e(o.valor)}">${e(o.etiqueta)}</option>`).join('') : `<option value="">${e(vacio)}</option>`}</select>`;

/** `campo:id` → `{ campo: id }`, la forma del `oneof` que traduce `ordenes.ts`. */
function objetivoDe(valor: string | undefined): Record<string, string> | null {
  if (!valor) return null;
  const i = valor.indexOf(':');
  return i > 0 ? { [valor.slice(0, i)]: valor.slice(i + 1) } : null;
}

/** El botón 📍: cierra la ventana y centra el mapa ahí (lo cablea quien pinta la ventana con `[data-centrar-x]`). */
const botonCentrar = (pos: Point | undefined, titulo: string): string =>
  pos ? `<button class="merc-icono-btn" type="button" data-centrar-x="${pos.x}" data-centrar-y="${pos.y}" title="${titulo}">📍</button>` : '';

// ── el tablón del campamento ──

const SIN_PAGO = 'Se paga con tu almacén personal (si resides aquí), con el carro que llevas aquí o con tus monedas, y no tienes ninguno: llega con tu columna para contratar.';

/** Lo que el jugador eligió en cada oferta (trabajo y plazo): vive entre repintados. */
const eleccion = new Map<string, { trabajo: string; plazo: number }>();
let ordenTablon: 'renombre' | 'precio' = 'renombre';
/** Con qué eligió pagar (si puede elegir); sin elegir, lo que el motor usa por defecto (la primera de `fuentesDeContrato`). */
let pagarConElegido: PagarContratoCon | null = null;

/** Una cifra de tarifa: en oro, «48 🪙», o en monedas (tanda 69), «4800 💰». */
const cifraDe = (n: number, enMonedas: boolean): string => (enMonedas ? `${n.toLocaleString('es-ES')} 💰` : `${oro(n)} 🪙`);
/** Lo que falta para pagar, para leerse tras «Te faltan». */
const faltaDe = (n: number, f: FuenteDeContrato | undefined): string => (f?.enMonedas ? `${n.toLocaleString('es-ES')} monedas` : `${oro(n)} de oro${f ? ` en ${f.nombre}` : ''}`);

/** Desde la taberna de una plaza (tanda 69): el tablón de los campamentos de su región, pagado con el almacén de la plaza o con monedas. */
export interface TablonDeRegion {
  /** La plaza desde cuya taberna se contrata: las distancias a cada campamento se miden desde ella. */
  plaza: { posicion: Point };
  fuentes: FuenteDeContrato[];
}

const SIN_PAGO_REGION = 'Desde la taberna se paga con el oro del almacén de la plaza (firma el Rey, el Embajador o el Gobernador) o con tus monedas, y no tienes ninguna de las dos cosas.';

/** De qué campamento de la región viene una oferta, a qué distancia de la plaza y el 📍 para verlo. */
function htmlCampamentoDeOferta(p: ProyeccionJugador, o: OfertaMercenario, region: TablonDeRegion): string {
  const pos = p.campamentosMercenarios.find((c) => c.id === o.campamentoId)?.posicion;
  const lejos = pos ? ` · a ${Math.round(Math.hypot(pos.x - region.plaza.posicion.x, pos.y - region.plaza.posicion.y))} u` : '';
  return `<div class="merc-campamento"><span>⛺ De un campamento de la región${lejos}</span>${botonCentrar(pos, 'Ver su campamento en el mapa')}</div>`;
}

function htmlOferta(p: ProyeccionJugador, o: OfertaMercenario, yo: Puestos, fuente: FuenteDeContrato | undefined, e: Escapar, region?: TablonDeRegion): string {
  // Lo que hay en lo que paga y en qué se cobra: con monedas, la tarifa en monedas (tanda 69).
  const carro = fuente?.saldo ?? 0, enMonedas = fuente?.enMonedas ?? false;
  const id = e(o.heroeId);
  const el = eleccion.get(o.heroeId) ?? { trabajo: 'defender', plazo: 3 };
  const herido = o.heridoHasta !== undefined && o.heridoHasta > p.instante;
  const publico = p.heroesVisibles.find((h) => h.heroeId === o.heroeId);
  const tropa = o.tropa.length
    ? `<div class="merc-tropa">${o.tropa.map((s) => `<span title="${e(nombreTropa(s.tropaId))}, nivel ${s.nivel}">${iconoMini(s.tropaId)}${s.cantidad}</span>`).join('')}</div>`
    : '<small class="asent-lado-nota">Sin tropa propia</small>';
  const precio = (plazo?: number) => { const t = o.tarifas.find((x) => x.plazoDias === plazo); return t && (enMonedas ? t.monedas : t.oro); };
  const propios = objetivosPropios(p);
  const candidatos: Record<string, Opcion[]> = {
    defender: [...propios.plazas, ...propios.pueblos, ...propios.avanzadas],
    escoltar: propios.caravanas,
    atacar: objetivosAtacables(p),
    acompanar: [...propios.convocatorias, ...propios.ejercitos],
    permanente: propios.plazas,
  };
  // Solo los objetivos que alguno de tus cargos alcanza; el permanente, solo con Rey o Embajador.
  const alcanzables: Record<string, Opcion[]> = Object.fromEntries(TRABAJOS.map((t) => [t, porCercania(p, candidatos[t]!.filter((x) => puestoParaFirmar(p, yo, t, x)))]));
  // Solo se muestra lo que se puede hacer (regla de Víctor): los trabajos que alguno de tus cargos alcanza. Sin Facción, herido o sin ninguno, ni
  // trabajos ni objetivo ni botón: la línea de abajo dice por qué. Si lo elegido ya no se puede, vale el primero que sí.
  const disponibles = TRABAJOS.filter((t) => alcanzables[t]!.length);
  const trabajo = (disponibles as string[]).includes(el.trabajo) ? el.trabajo : disponibles[0] ?? el.trabajo;
  const puede = p.faccionId !== null && !herido && disponibles.length > 0;
  const fichas = [...PLAZOS.map((d) => ({ valor: String(d), texto: dias(d), oro: precio(d) })), { valor: 'perm', texto: 'Permanente', oro: precio(undefined) }]
    .map((f) => {
      const elegida = puede && (trabajo === 'permanente' ? f.valor === 'perm' : f.valor === String(el.plazo));
      const falta = f.oro !== undefined && f.oro > carro;
      const cifra = `<span>${f.texto}</span><strong>${f.oro !== undefined ? cifraDe(f.oro, enMonedas) : '—'}</strong>`;
      // El precio se ve siempre; se elige solo si ese plazo se puede firmar (el permanente, con su trabajo disponible).
      const elegible = puede && (f.valor !== 'perm' ? disponibles.some((t) => t !== 'permanente') : disponibles.includes('permanente'));
      return elegible
        ? `<button type="button" class="merc-tarifa${elegida ? ' activo' : ''}${falta ? ' caro' : ''}" data-merc-tarifa="${f.valor}"${falta ? ` title="Te faltan ${e(faltaDe(f.oro! - carro, fuente))}"` : ''}>${cifra}</button>`
        : `<div class="merc-tarifa fija${falta ? ' caro' : ''}">${cifra}</div>`;
    }).join('');
  const trabajos = disponibles.map((t) =>
    `<button type="button" class="merc-trabajo${t === trabajo ? ' activo' : ''}" data-merc-trabajo="${t}" title="${e(TRABAJO[t]!.texto)}"><span>${TRABAJO[t]!.icono}</span>${TRABAJO[t]!.nombre}</button>`).join('');
  const objetivos = disponibles.map((t) => `<label data-merc-para="${t}"${t === trabajo ? '' : ' hidden'}><span>${t === 'permanente' ? 'Residirá en' : 'Objetivo'}</span>${htmlSelect(`data-merc-objetivo="${t}"`, alcanzables[t]!, e, '')}</label>`).join('');
  const primero = alcanzables[trabajo]?.[0];
  const firma = primero ? puestoParaFirmar(p, yo, trabajo, primero) : null;
  const elegido = trabajo === 'permanente' ? precio(undefined) : precio(el.plazo);
  const motivo = p.faccionId === null ? 'Necesitas una Facción para contratar.'
    : herido ? 'Está herido: espera a que sane.'
      : !puede ? 'Ninguno de tus cargos puede firmarle un trabajo sobre algo que tengas a la vista.'
        : !fuente ? (region ? SIN_PAGO_REGION : SIN_PAGO)
          : elegido !== undefined && elegido > carro ? `Te faltan ${faltaDe(elegido - carro, fuente)}.` : '';
  return `<article class="merc-oferta${herido ? ' herido' : ''}" data-merc-oferta="${id}" data-faccion="${e(p.faccionId ?? '')}">
    <header class="merc-oferta-cab">
      ${o.ficha ? insigniaDeRango(o.ficha.rango, 36) : ''}
      <div><strong>${e(nombreDeHeroe(p, o.heroeId))}</strong><small><span class="merc-rango-nombre">${o.ficha ? e(RANGO_MERCENARIO[o.ficha.rangoId] ?? o.ficha.rangoId) : ''}</span>${publico ? ` · ${e(nombreDeClase(publico.classDefinitionId))} · nivel ${publico.nivel}` : ''}${herido ? ` · <span class="merc-herido">herido ${textoEnTiempoReal(o.heridoHasta! - p.instante)}</span>` : ''}</small></div>
    </header>
    ${region ? htmlCampamentoDeOferta(p, o, region) : ''}
    ${o.ficha ? htmlFichaMercenario(o.ficha, e, true, false) : ''}
    ${tropa}
    <div class="merc-seccion">Plazo y precio</div>
    <div class="merc-tarifas">${fichas}</div>
    ${puede ? `<div class="merc-seccion">Trabajo</div>
    <div class="merc-trabajos">${trabajos}</div>
    <div class="merc-contratar">${objetivos}</div>
    <footer class="merc-oferta-pie">
      <small>${firma ? `Firmarás como <strong>${e(firma)}</strong>` : ''}</small>
      <button class="btn-primary" type="button" data-merc-contratar="${id}" data-merc-trabajo-elegido="${trabajo}" data-merc-pagar-con="${fuente?.pagarCon ?? ''}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Contratar${elegido !== undefined ? ` · ${cifraDe(elegido, enMonedas)}` : ''}</button>
    </footer>` : ''}
    ${motivo ? `<small class="merc-motivo">${e(motivo)}</small>` : ''}
  </article>`;
}

/** La subpestaña «Mercenarios» del campamento `c`: su tablón, con contratar. Con `region`, el de los campamentos de la región desde la taberna de
 * una plaza (tanda 69), con sus formas de pago. */
export function htmlTablonMercenarios(p: ProyeccionJugador, tablon: OfertaMercenario[] | undefined, e: Escapar, c?: Pick<CampamentoMercenarios, 'id' | 'residentesIds'>, region?: TablonDeRegion): string {
  const info = region
    ? ayuda('plaza:mercenarios-region', 'Los mercenarios que se ofrecen en los campamentos de la región de esta plaza: se contratan desde aquí, sin ir. Se paga con el oro del almacén de la plaza (firma el Rey, el Embajador o el Gobernador) o con tus monedas (firma el cargo que alcance el trabajo). Lo pagado no se devuelve nunca. Prorrogar sigue siendo en persona.')
    : ayuda('camp:mercenarios', 'Héroes bot que se ofrecen a sueldo. Firma el Rey, el Embajador o el cargo local que alcance (el de más rango), aquí en persona (dentro o con tu columna a la puerta). La tarifa se paga con tu almacén personal, si resides aquí, o con el carro que llevas: el de tu columna o, dentro de tu residencia, el que trajiste al entrar. También con tus monedas, a la tarifa en monedas (100 por cada oro), que pasan al mercenario. Lo pagado no se devuelve nunca. Mientras dura, el mercenario es ciudadano de tu Facción con marca, y sin orden solo se defiende: se le manda desde Facción › Mercenarios.');
  // De dónde sale el pago (`pagar_con`, motor 2b2c2a58; las monedas, tanda 69): si hay más de uno, se elige como en el mercado del campamento.
  const fuentes = region ? region.fuentes : fuentesDeContrato(p, c);
  const fuente = fuentes.find((f) => f.pagarCon === pagarConElegido) ?? fuentes[0];
  const yo = misPuestos(p);
  const renombre = (o: OfertaMercenario) => o.ficha?.renombre ?? 0;
  const precio = (o: OfertaMercenario) => o.tarifas.find((t) => t.plazoDias === 1)?.oro ?? Infinity;
  const lista = [...(tablon ?? [])].sort((a, b) => (ordenTablon === 'renombre' ? renombre(b) - renombre(a) : precio(a) - precio(b)));
  const chip = (v: typeof ordenTablon, t: string) => `<button type="button" class="merc-chip${ordenTablon === v ? ' activo' : ''}" data-merc-ordenar-tablon="${v}">${t}</button>`;
  const conMayuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
  const bolsa = !fuente
    ? `<span class="merc-bolsa merc-bolsa-sin" title="${e(region ? SIN_PAGO_REGION : SIN_PAGO)}">🪙 sin oro a mano</span>`
    : fuentes.length > 1
      ? `<label class="merc-bolsa merc-pagar"><span>Pagar con</span><select class="form-input" data-merc-pagar>${fuentes.map((f) => `<option value="${f.pagarCon}"${f === fuente ? ' selected' : ''}>${e(conMayuscula(f.nombre))} (${f.enMonedas ? `💰 ${f.saldo.toLocaleString('es-ES')}` : `🪙 ${oro(f.saldo)}`})</option>`).join('')}</select></label>`
      : fuente.enMonedas
        ? `<span class="merc-bolsa" title="Se paga con tus monedas, a la tarifa en monedas">💰 ${fuente.saldo.toLocaleString('es-ES')} monedas</span>`
        : `<span class="merc-bolsa" title="${e(`Se paga con el oro de ${fuente.nombre}`)}">🪙 ${oro(fuente.saldo)} en ${e(fuente.nombre)}</span>`;
  return `<div class="merc-tablon-cab"><strong class="heroe-sub">${region ? 'Mercenarios de la región' : 'Tablón de mercenarios'}${info}</strong>${bolsa}</div>
    ${lista.length > 1 ? `<div class="merc-orden-tablon">Ordenar por ${chip('renombre', 'renombre')}${chip('precio', 'precio')}</div>` : ''}
    ${lista.length ? `<div class="merc-ofertas">${lista.map((o) => htmlOferta(p, o, yo, fuente, e, region)).join('')}</div>` : `<p class="mapa-lista-vacia">${region ? 'Nadie se ofrece ahora en los campamentos de la región.' : 'Nadie se ofrece ahora en este campamento.'}</p>`}`;
}

export function cablearTablonMercenarios(raiz: HTMLElement, ejecutar: Ejecutar, error: (m: string) => void, repintar: () => void): void {
  raiz.querySelectorAll<HTMLButtonElement>('[data-merc-ordenar-tablon]').forEach((b) => b.addEventListener('click', () => { ordenTablon = b.dataset.mercOrdenarTablon as typeof ordenTablon; repintar(); }));
  raiz.querySelector<HTMLSelectElement>('[data-merc-pagar]')?.addEventListener('change', (ev) => { pagarConElegido = (ev.target as HTMLSelectElement).value as PagarContratoCon; repintar(); });
  raiz.querySelectorAll<HTMLElement>('[data-merc-oferta]').forEach((caja) => {
    const id = caja.dataset.mercOferta!;
    const el = (): { trabajo: string; plazo: number } => eleccion.get(id) ?? { trabajo: 'defender', plazo: 3 };
    caja.querySelectorAll<HTMLButtonElement>('[data-merc-trabajo]').forEach((b) => b.addEventListener('click', () => { eleccion.set(id, { ...el(), trabajo: b.dataset.mercTrabajo! }); repintar(); }));
    caja.querySelectorAll<HTMLButtonElement>('[data-merc-tarifa]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.mercTarifa!;
      // «Permanente» es a la vez plazo y trabajo; un plazo devuelve a uno temporal si se venía del permanente.
      eleccion.set(id, v === 'perm' ? { ...el(), trabajo: 'permanente' } : { trabajo: el().trabajo === 'permanente' ? (caja.querySelector<HTMLElement>('[data-merc-trabajo]:not([data-merc-trabajo="permanente"])')?.dataset.mercTrabajo ?? 'defender') : el().trabajo, plazo: Number(v) });
      repintar();
    }));
    const boton = caja.querySelector<HTMLButtonElement>('[data-merc-contratar]');
    boton?.addEventListener('click', async () => {
      const { plazo } = el();
      const trabajo = boton.dataset.mercTrabajoElegido ?? el().trabajo;
      const elegido = objetivoDe(caja.querySelector<HTMLSelectElement>(`[data-merc-objetivo="${trabajo}"]`)?.value);
      if (!elegido) { error(trabajo === 'permanente' ? 'El permanente necesita una plaza de tu Facción donde residir.' : 'Elige a qué apunta el contrato.'); return; }
      boton.disabled = true;
      const pagarCon = boton.dataset.mercPagarCon || undefined;
      const m = await ejecutar('contratarMercenario', trabajo === 'permanente'
        ? { mercenarioId: id, trabajo, objetivo: { faccionId: caja.dataset.faccion }, residenciaAsentamientoId: elegido.asentamientoId, pagarCon }
        : { mercenarioId: id, trabajo, objetivo: elegido, plazoDias: plazo, pagarCon });
      boton.disabled = false;
      error(m ?? '');
      if (!m) eleccion.delete(id);
    });
  });
}

// ── la pestaña «Mercenarios» de la Facción ──

interface Terminado { momento: number; motivo: string; firmadoPorId?: string; trabajo?: string }
/** Los contratos que acabaron hace poco (hecho `mercenarios.terminado`), para valorarlos mientras dura `valoracionHoras`. */
const terminados = new Map<string, Terminado>();
/** Lo último que se vio de cada contrato: al acabar ya no viaja, y la valoración quiere saber quién lo firmó. */
const vistos = new Map<string, ContratoMercenario>();
/** Las valoraciones ya dadas (el motor rechaza la segunda). */
const valorados = new Set<string>();
/** Los mercenarios marcados para la barra de órdenes: viven entre repintados. */
const marcados = new Set<string>();
let tipoElegido = 'guardar';

/** Lo llama `avisos.ts` con cada hecho `mercenarios.*`. */
export function anotarHechoMercenario(e: EventoDominio): void {
  const datos = (e.payload ?? {}) as Record<string, unknown>;
  if (datos.mercenario === undefined) return;
  const id = `heroe-${String(datos.mercenario)}`;
  const momento = e.momento ? Date.parse(e.momento) : Date.now();
  if (e.codigo === 'mercenarios.terminado') {
    const c = vistos.get(id);
    terminados.set(id, { momento, motivo: String(datos.motivo ?? ''), firmadoPorId: c?.firmadoPorId, trabajo: c?.trabajo });
    marcados.delete(id);
  }
  if (e.codigo === 'mercenarios.valorado') { const t = terminados.get(id); if (t) valorados.add(`${id}|${t.momento}`); }
  if (e.codigo === 'mercenarios.contratado') terminados.delete(id);
}

const horasDeValoracion = (): number => bloqueDeDatos<{ valoracionHoras?: number }>('MERCENARIOS_CONTRATO')?.valoracionHoras ?? 72;

function porValorar(p: ProyeccionJugador): [string, Terminado][] {
  const f = p.facciones.find((x) => x.id === p.faccionId);
  const horas = horasDeValoracion();
  return [...terminados.entries()].filter(([id, t]) => p.instante - t.momento < horas * 3_600_000 && !valorados.has(`${id}|${t.momento}`)
    && (f?.reyId === p.heroeId || !t.firmadoPorId || t.firmadoPorId === p.heroeId));
}

const vencePronto = (p: ProyeccionJugador, c: ContratoMercenario): boolean =>
  c.venceEn !== undefined && !!c.plazoDias && c.venceEn - p.instante < c.plazoDias * 86_400_000 * 0.2;

/** Lo que pide atención en la pestaña (contratos a punto de vencer y valoraciones pendientes): la cifra de su botón. */
export function mercenariosQuePidenAtencion(p: ProyeccionJugador): number {
  const f = p.facciones.find((x) => x.id === p.faccionId);
  return (f?.contratos ?? []).filter((c) => vencePronto(p, c)).length + porValorar(p).length;
}

/** Dónde anda un mercenario: su columna (va en un ejército de la Facción) o su residencia. */
function dondeAnda(p: ProyeccionJugador, id: string, residencia?: string): { texto: string; posicion?: Point } {
  const columna = p.ejercitos.find((x) => x.participantes.some((y) => y.heroeId === id));
  if (columna) return { texto: columna.estado === 'marchando' ? 'en marcha' : columna.estado === 'regresando' ? 'regresando' : 'en el mapa', posicion: columna.posicionActual };
  if (residencia?.startsWith('as-')) return { texto: `en ${nombreDePlaza(p, residencia)}`, posicion: posicionDePlaza(p, residencia) };
  if (residencia?.startsWith('camp-')) return { texto: 'en su campamento', posicion: p.campamentosMercenarios.find((c) => c.id === residencia)?.posicion };
  return { texto: 'fuera de la vista' };
}

function htmlContrato(p: ProyeccionJugador, c: ContratoMercenario, yo: Puestos, e: Escapar): string {
  const id = e(c.mercenarioId);
  const miembro = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === c.mercenarioId);
  const publico = p.heroesVisibles.find((h) => h.heroeId === c.mercenarioId);
  const permanente = c.trabajo === 'permanente';
  const anda = dondeAnda(p, c.mercenarioId, miembro?.residenciaId);
  const total = (c.plazoDias ?? 0) * 86_400_000;
  const queda = c.venceEn !== undefined ? Math.max(0, c.venceEn - p.instante) : undefined;
  const pronto = vencePronto(p, c);
  const barra = queda !== undefined && total > 0
    ? `<div class="merc-plazo${pronto ? ' pronto' : ''}" title="Quedan ${textoEnTiempoReal(queda)} de ${dias(c.plazoDias!)}"><span style="width:${Math.min(100, (queda / total) * 100).toFixed(1)}%"></span></div>`
    : '';
  const o = c.orden;
  const orden = o
    ? `<span class="merc-orden-icono">${ORDEN[o.tipo]?.icono ?? '•'}</span><span><strong>${e(ORDEN[o.tipo]?.nombre ?? o.tipo)}</strong> ${e(textoDeObjetivo(p, o.objetivo))}<small>${e(o.puesto ? `de ${textoDePuesto(p, o.puesto)}` : 'orden inicial')}${o.venceEn !== undefined ? ` · caduca en ${textoEnTiempoReal(Math.max(0, o.venceEn - p.instante))}` : ''}${o.tipo === 'unirse' && o.unido ? ' · ya dentro' : ''}</small></span>${botonCentrar(posicionDeObjetivo(p, o.objetivo), 'Ver el objetivo de la orden en el mapa')}`
    : '<span class="merc-orden-icono">…</span><span class="merc-sin-orden">Sin orden: solo se defiende</span>';
  const gestiona = puedeGestionar(yo, c) && !c.finAplazado;
  const sinGestion = c.finAplazado ? 'Su contrato ya acabó' : 'Solo quien podría firmar hoy este contrato';
  const marcable = ordenesPosibles(yo, c, miembro?.residenciaId).size > 0;
  const otrasPlazas = objetivosPropios(p).plazas.filter((x) => x.plaza !== miembro?.residenciaId);
  // La prórroga se paga con oro (el carro o el almacén personal, como diga el motor) o, si tienes, con tus monedas (tanda 69).
  const misMonedas = p.heroe.monedas ?? 0;
  const pagoProrroga = gestiona && misMonedas > 0
    ? `<select class="form-input merc-mini" data-merc-prorroga-pago="${id}" title="Con qué pagas la prórroga: oro, o tus monedas (tienes ${misMonedas.toLocaleString('es-ES')}) a la tarifa en monedas"><option value="">🪙 Con oro</option><option value="monedas">💰 Con monedas</option></select>`
    : '';
  return `<article class="merc-contrato${marcados.has(c.mercenarioId) ? ' marcado' : ''}${pronto ? ' pronto' : ''}${c.finAplazado ? ' acabado' : ''}">
    <div class="merc-contrato-cab">
      <label${marcable ? ' title="Marcar para darle una orden"' : ' title="Ninguno de tus cargos le da órdenes"'}><input type="checkbox" data-merc-marcado="${id}"${marcados.has(c.mercenarioId) ? ' checked' : ''}${marcable ? '' : ' disabled'}></label>
      ${publico?.fichaMercenario ? insigniaDeRango(publico.fichaMercenario.rango, 30) : insigniaDeRango(1, 30)}
      <span class="merc-nombre"><strong>${e(nombreDeHeroe(p, c.mercenarioId))}</strong><small>${publico?.fichaMercenario ? `${e(RANGO_MERCENARIO[publico.fichaMercenario.rangoId] ?? '')} · ` : ''}${publico ? `nivel ${publico.nivel} · ` : ''}${e(anda.texto)}</small></span>
      ${botonCentrar(anda.posicion, 'Ver dónde anda en el mapa')}
    </div>
    <div class="merc-linea"><span class="merc-linea-icono" title="${e(TRABAJO[c.trabajo]?.texto ?? '')}">${TRABAJO[c.trabajo]?.icono ?? '•'}</span><span><strong>${e(TRABAJO[c.trabajo]?.nombre ?? c.trabajo)}</strong> ${permanente ? (miembro?.residenciaId ? `reside en ${e(nombreDePlaza(p, miembro.residenciaId))}` : '') : e(textoDeObjetivo(p, c.objetivo))}</span>${permanente ? '' : botonCentrar(posicionDeObjetivo(p, c.objetivo), 'Ver el objetivo del contrato en el mapa')}</div>
    ${permanente ? '' : `<div class="merc-tiempo"><span class="${pronto ? 'merc-aviso' : ''}">⏳ ${queda !== undefined ? `Quedan ${textoEnTiempoReal(queda)}${pronto ? ' · prorrógalo a tiempo' : ''}` : ''}</span>${barra}</div>`}
    <div class="merc-linea merc-orden-actual">${orden}</div>
    ${c.finAplazado ? `<small class="merc-motivo">Contrato acabado (${e(FIN[c.finAplazado] ?? c.finAplazado)}): sale al terminar su batalla.</small>` : ''}
    <footer class="merc-acciones">
      <small class="merc-firma">✍ ${e(nombreDeHeroe(p, c.firmadoPorId))}, ${e(textoDePuesto(p, c.puestoFirma))}${c.renombre ? ` · +${c.renombre} de renombre al acabar` : ''}</small>
      <span class="merc-acciones-botones">
      ${permanente ? '' : `<select class="form-input merc-mini" data-merc-prorroga="${id}"${gestiona ? '' : ' disabled'}>${PLAZOS.map((d) => `<option value="${d}">+${dias(d)}</option>`).join('')}</select>${pagoProrroga}<button class="btn-secondary" type="button" data-merc-prorrogar="${id}"${gestiona ? '' : ' disabled'} title="${gestiona ? 'En persona: en su campamento base, con el carro de tu columna o, si resides allí y estás dentro, con tu almacén personal; o con tu columna junto a la suya, con el carro de la columna. Con monedas, en cualquiera de esos sitios. Pagas la tarifa de hoy.' : sinGestion}">Prorrogar</button>`}
      ${permanente && (yo.rey || yo.embajador) && !c.finAplazado ? `${htmlSelect(`data-merc-mudar-a="${id}"`, otrasPlazas, e, 'Sin otra plaza', 'merc-mini')}<button class="btn-secondary" type="button" data-merc-mudar="${id}"${otrasPlazas.length ? '' : ' disabled'} title="A distancia y sin espera">Mudar</button>` : ''}
      <button class="btn-secondary merc-peligro" type="button" data-merc-despedir="${id}"${gestiona ? '' : ' disabled'} title="${gestiona ? 'A distancia. No se devuelve nada.' : sinGestion}">Despedir</button>
      </span>
    </footer>
  </article>`;
}

/** La barra de órdenes: solo se encienden las que admiten todos los marcados, y el objetivo se elige entre los que valen. */
function htmlBarraOrdenes(p: ProyeccionJugador, contratos: ContratoMercenario[], yo: Puestos, e: Escapar): string {
  const miembros = p.facciones.find((f) => f.id === p.faccionId)?.miembros ?? [];
  const elegidos = contratos.filter((c) => marcados.has(c.mercenarioId));
  const posibles = TIPOS_ORDEN.filter((t) => elegidos.length > 0 && elegidos.every((c) => ordenesPosibles(yo, c, miembros.find((m) => m.heroeId === c.mercenarioId)?.residenciaId).has(t)));
  if (!(posibles as string[]).includes(tipoElegido) && posibles.length) tipoElegido = posibles[0]!;
  const propios = objetivosPropios(p);
  // `guardar` de un defensor o un escolta solo vale sobre el objetivo de su contrato: si todos los marcados comparten uno, es ese; si no, ninguno.
  const fijos = [...new Set(elegidos.filter((c) => c.trabajo === 'defender' || c.trabajo === 'escoltar').map((c) => clave(c.objetivo)))];
  const objetivosDe = (t: string): Opcion[] => {
    if (t === 'guardar') {
      const todos = [...propios.plazas, ...propios.pueblos, ...propios.avanzadas, ...propios.caravanas];
      return fijos.length === 0 ? todos : fijos.length === 1 ? todos.filter((x) => x.valor === fijos[0]) : [];
    }
    if (t === 'atacar') return objetivosAtacables(p);
    if (t === 'unirse') return [...propios.convocatorias, ...propios.ejercitos];
    return [];
  };
  const yoPos = miPosicion(p);
  const botones = TIPOS_ORDEN.map((t) => {
    const vale = (posibles as string[]).includes(t);
    const porque = vale || !elegidos.length ? '' : ' (algún marcado no la admite, o no le alcanzan tus cargos)';
    return `<button type="button" class="merc-orden${t === tipoElegido && vale ? ' activo' : ''}" data-merc-tipo="${t}"${vale ? '' : ' disabled'} title="${e(ORDEN[t]!.texto + porque)}"><span>${ORDEN[t]!.icono}</span>${ORDEN[t]!.nombre}</button>`;
  }).join('');
  const objetivo = tipoElegido === 'ir_a'
    ? `<span class="merc-punto"><select class="form-input" data-merc-lugar><option value="">Un lugar tuyo…</option>${porCercania(p, [...propios.plazas, ...propios.pueblos, ...propios.avanzadas]).filter((x) => x.posicion).map((x) => `<option data-x="${Math.round(x.posicion!.x)}" data-y="${Math.round(x.posicion!.y)}">${e(x.etiqueta)}</option>`).join('')}</select>x <input class="form-input merc-num" type="number" data-merc-x value="${Math.round(yoPos?.x ?? 0)}"> y <input class="form-input merc-num" type="number" data-merc-y value="${Math.round(yoPos?.y ?? 0)}"></span>`
    : htmlSelect(`data-merc-orden-objetivo="${tipoElegido}"`, porCercania(p, objetivosDe(tipoElegido)), e, fijos.length > 1 ? 'Los marcados guardan cosas distintas' : 'Ninguno a la vista');
  const nota = tipoElegido === 'ir_a' ? 'Elige un lugar tuyo o escribe el punto (empieza en tu posición).'
    : elegidos.some((c) => c.trabajo === 'defender') && tipoElegido === 'atacar' ? 'Un defensor solo ataca lo que esté cerca de lo que defiende.' : '';
  return `<div class="merc-barra-ordenes${elegidos.length ? '' : ' vacia'}">
    <div class="merc-barra-cab"><strong>${elegidos.length ? `${elegidos.length} marcado${elegidos.length === 1 ? '' : 's'} de 16` : 'Marca mercenarios para darles una orden'}</strong>
      <span><button type="button" class="merc-chip" data-merc-todos>Marcar todos</button><button type="button" class="merc-chip" data-merc-ninguno${elegidos.length ? '' : ' disabled'}>Ninguno</button></span></div>
    <div class="merc-ordenes">${botones}</div>
    ${elegidos.length && posibles.length ? `<div class="merc-ordenar-fila">${objetivo}<button class="btn-primary" type="button" data-merc-ordenar>Dar la orden</button></div>${nota ? `<small class="asent-lado-nota">${nota}</small>` : ''}` : ''}
  </div>`;
}

/** La pestaña «Mercenarios» de la Facción: lo que pide atención arriba, la barra de órdenes y los contratos, del que vence antes al permanente. */
export function htmlMercenariosFaccion(p: ProyeccionJugador, e: Escapar): string {
  const f = p.facciones.find((x) => x.id === p.faccionId);
  if (!f) return '';
  const contratos = f.contratos ?? [];
  for (const c of contratos) vistos.set(c.mercenarioId, c);
  const yo = misPuestos(p);
  // Fuera de la selección quien ya no está o ya no recibe órdenes tuyas (otro cargo, contrato acabado).
  const residencia = (id: string) => f.miembros?.find((m) => m.heroeId === id)?.residenciaId;
  for (const id of [...marcados]) {
    const c = contratos.find((x) => x.mercenarioId === id);
    if (!c || ordenesPosibles(yo, c, residencia(id)).size === 0) marcados.delete(id);
  }
  const info = ayuda('faccion:mercenarios', 'Se contratan en persona, en el tablón de un campamento de mercenarios. Sin orden un mercenario solo se defiende. Ordena quien le alcanza: el Rey y el Embajador a todos; el General, el Gobernador y el Maestro de Caravanas a los de su plaza. Una orden solo la cambia un cargo de igual o más rango que quien la dio.');
  const temporales = contratos.filter((c) => c.trabajo !== 'permanente').length;
  const pendientes = porValorar(p);
  const resumen = `<div class="faction-stats merc-resumen">
    <div><span>A sueldo</span><strong>${contratos.length}</strong></div>
    <div><span>Temporales</span><strong>${temporales}</strong></div>
    <div><span>Permanentes</span><strong>${contratos.length - temporales}</strong></div>
    <div class="${contratos.some((c) => !c.orden) ? 'merc-aviso' : ''}"><span>Sin orden</span><strong>${contratos.filter((c) => !c.orden).length}</strong></div>
  </div>`;
  const ordenados = [...contratos].sort((a, b) => (a.venceEn ?? Infinity) - (b.venceEn ?? Infinity));
  const valorar = pendientes.length ? `<section class="merc-valorar"><strong class="heroe-sub">Contratos acabados: valóralos</strong>
      ${pendientes.map(([id, t]) => `<div class="merc-valorar-fila"><span><strong>${e(nombreDeHeroe(p, id))}</strong><small>${e(TRABAJO[t.trabajo ?? '']?.nombre ?? 'Contrato')} · ${e(FIN[t.motivo] ?? t.motivo)} · quedan ${textoEnTiempoReal(Math.max(0, t.momento + horasDeValoracion() * 3_600_000 - p.instante))}</small></span><button class="btn-secondary" type="button" data-merc-valorar="${e(id)}" data-buena="si" data-momento="${t.momento}" title="Suma la mitad del renombre que ganó con este contrato">👍 Buena</button><button class="btn-secondary" type="button" data-merc-valorar="${e(id)}" data-buena="no" data-momento="${t.momento}" title="Le quita el renombre que ganó con este contrato">👎 Mala</button></div>`).join('')}
    </section>` : '';
  return `<section class="faccion-mercenarios">
    <div class="merc-tablon-cab"><h3>Mercenarios${info}</h3></div>
    ${valorar}
    ${contratos.length ? `${resumen}${htmlBarraOrdenes(p, contratos, yo, e)}<div class="merc-contratos">${ordenados.map((c) => htmlContrato(p, c, yo, e)).join('')}</div>`
    : '<p class="mapa-lista-vacia">Tu Facción no tiene mercenarios a sueldo. Se contratan en persona en el tablón de un campamento de mercenarios (pestaña «Mercenarios» del campamento).</p>'}
    <p class="faction-error" role="alert" data-merc-error></p>
  </section>`;
}

export function cablearMercenariosFaccion(raiz: HTMLElement, ejecutar: Ejecutar, repintar: () => void): void {
  const error = (m: string): void => { const el = raiz.querySelector<HTMLElement>('[data-merc-error]'); if (el) el.textContent = m; };
  const con = (selector: string, tipo: string, params: (b: HTMLButtonElement) => object | null | Promise<object | null>, despues?: (b: HTMLButtonElement) => void): void => {
    raiz.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async () => {
      const x = await params(b);
      if (!x) return;
      b.disabled = true;
      const m = await ejecutar(tipo, x);
      b.disabled = false;
      error(m ?? '');
      if (!m) despues?.(b);
    }));
  };
  raiz.querySelectorAll<HTMLInputElement>('[data-merc-marcado]').forEach((i) => i.addEventListener('change', () => {
    const id = i.dataset.mercMarcado!;
    if (i.checked && marcados.size >= 16) { i.checked = false; error('Una orden va a 16 mercenarios como mucho.'); return; }
    if (i.checked) marcados.add(id); else marcados.delete(id);
    repintar();
  }));
  raiz.querySelector('[data-merc-todos]')?.addEventListener('click', () => {
    raiz.querySelectorAll<HTMLInputElement>('[data-merc-marcado]:not(:disabled)').forEach((i) => { if (marcados.size < 16) marcados.add(i.dataset.mercMarcado!); });
    repintar();
  });
  raiz.querySelector('[data-merc-ninguno]')?.addEventListener('click', () => { marcados.clear(); repintar(); });
  raiz.querySelector<HTMLSelectElement>('[data-merc-lugar]')?.addEventListener('change', (ev) => {
    const o = (ev.target as HTMLSelectElement).selectedOptions[0];
    if (!o?.dataset.x) return;
    raiz.querySelector<HTMLInputElement>('[data-merc-x]')!.value = o.dataset.x;
    raiz.querySelector<HTMLInputElement>('[data-merc-y]')!.value = o.dataset.y!;
  });
  raiz.querySelectorAll<HTMLButtonElement>('[data-merc-tipo]').forEach((b) => b.addEventListener('click', () => { tipoElegido = b.dataset.mercTipo!; repintar(); }));
  con('[data-merc-ordenar]', 'ordenarMercenario', () => {
    const ids = [...marcados];
    if (ids.length === 0 || ids.length > 16) { error('Marca entre 1 y 16 mercenarios.'); return null; }
    const objetivo = tipoElegido === 'ir_a'
      ? { punto: { x: Number(raiz.querySelector<HTMLInputElement>('[data-merc-x]')?.value ?? 0), y: Number(raiz.querySelector<HTMLInputElement>('[data-merc-y]')?.value ?? 0) } }
      : objetivoDe(raiz.querySelector<HTMLSelectElement>(`[data-merc-orden-objetivo="${tipoElegido}"]`)?.value);
    if (!objetivo) { error('Elige el objetivo de la orden.'); return null; }
    return { mercenarioIds: ids, tipo: tipoElegido, objetivo };
  }, () => { marcados.clear(); repintar(); });
  con('[data-merc-prorrogar]', 'prorrogarContrato', (b) => {
    const id = b.dataset.mercProrrogar;
    const pagarCon = raiz.querySelector<HTMLSelectElement>(`[data-merc-prorroga-pago="${id}"]`)?.value || undefined;
    return { mercenarioId: id, plazoDias: Number(raiz.querySelector<HTMLSelectElement>(`[data-merc-prorroga="${id}"]`)?.value ?? 1), pagarCon };
  });
  con('[data-merc-mudar]', 'mudarMercenario', (b) => {
    const a = objetivoDe(raiz.querySelector<HTMLSelectElement>(`[data-merc-mudar-a="${b.dataset.mercMudar}"]`)?.value)?.asentamientoId;
    if (!a) { error('Elige otra plaza de tu Facción.'); return null; }
    return { mercenarioId: b.dataset.mercMudar, asentamientoId: a };
  });
  con('[data-merc-despedir]', 'despedirMercenario', async (b) => (await confirmar('El oro pagado no se devuelve, pierde el renombre de este contrato y tu Facción tardará en poder recontratarlo.', { titulo: '¿Despedirlo?', aceptar: 'Despedir' }) ? { mercenarioId: b.dataset.mercDespedir } : null));
  con('[data-merc-valorar]', 'valorarMercenario', (b) => ({ mercenarioId: b.dataset.mercValorar, buena: b.dataset.buena === 'si' }), (b) => { valorados.add(`${b.dataset.mercValorar}|${b.dataset.momento}`); repintar(); });
}

// ── el héroe mercenario ──

/** Para un héroe mercenario: su contrato con la orden vigente, su ficha entera y el premio de rango. Vacío si nunca se ofreció. */
export function htmlHeroeMercenario(p: ProyeccionJugador, e: Escapar): string {
  const h = p.heroe;
  if (!h.fichaMercenario && !h.contrato) return '';
  const c = h.contrato;
  const contrato = c
    ? `<div class="merc-linea"><span class="merc-linea-icono">${TRABAJO[c.trabajo]?.icono ?? '•'}</span><span><strong>${e(TRABAJO[c.trabajo]?.nombre ?? c.trabajo)}</strong> para ${e(p.facciones.find((f) => f.id === c.faccionId)?.nombre ?? c.faccionId)}${c.trabajo === 'permanente' ? '' : ` · ${e(textoDeObjetivo(p, c.objetivo))}`}</span></div>
      <div class="merc-tiempo"><span>⏳ ${c.venceEn !== undefined ? `Vence en ${textoEnTiempoReal(Math.max(0, c.venceEn - p.instante))}` : 'Permanente'}</span></div>
      <div class="merc-linea merc-orden-actual">${c.orden ? `<span class="merc-orden-icono">${ORDEN[c.orden.tipo]?.icono ?? '•'}</span><span><strong>${e(ORDEN[c.orden.tipo]?.nombre ?? c.orden.tipo)}</strong> ${e(textoDeObjetivo(p, c.orden.objetivo))}<small>${e(c.orden.puesto ? `de ${textoDePuesto(p, c.orden.puesto)}` : 'orden inicial')}</small></span>` : '<span class="merc-sin-orden">Sin orden: solo te defiendes</span>'}</div>
      ${c.finAplazado ? `<small class="merc-motivo">El contrato ya acabó (${e(FIN[c.finAplazado] ?? c.finAplazado)}): sales al terminar la batalla.</small>` : ''}`
    : '<p class="asent-lado-nota">Sin contrato.</p>';
  const f = h.fichaMercenario;
  const licencia = (p.mercadoCampamento?.reclutamiento?.tropas ?? []).filter((t) => t.desbloqueada).map((t) => t.tropaId);
  const tropas = [...new Set([...LEVA_PROPIA, ...licencia])];
  const premio = f && f.premios > 0
    ? `<div class="merc-premio"><strong>🎖 ${f.premios} escuadra${f.premios === 1 ? '' : 's'} de premio de rango</strong><div class="merc-ordenar-fila"><select class="form-input" data-merc-premio-tropa>${tropas.map((t) => `<option value="${e(t)}">${e(nombreTropa(t))}</option>`).join('')}</select><button class="btn-primary" type="button" data-merc-premio title="En tu campamento base">Reclamar</button></div></div>`
    : '';
  return `<section class="heroe-mercenario">
    <strong class="heroe-sub">Mercenario${ayuda('heroe:mercenario', 'Tu contrato, tu orden y tu ficha. El premio de rango se reclama en tu campamento base.')}</strong>
    ${contrato}
    ${f ? htmlFichaMercenario(f, e) : ''}
    ${premio}
    <p class="faction-error" role="alert" data-merc-error></p>
  </section>`;
}

export function cablearHeroeMercenario(raiz: HTMLElement, ejecutar: Ejecutar): void {
  const b = raiz.querySelector<HTMLButtonElement>('[data-merc-premio]');
  b?.addEventListener('click', async () => {
    b.disabled = true;
    const m = await ejecutar('reclamarPremioDeRango', { tropaId: raiz.querySelector<HTMLSelectElement>('[data-merc-premio-tropa]')?.value ?? '' });
    b.disabled = false;
    const el = raiz.querySelector<HTMLElement>('[data-merc-error]');
    if (el) el.textContent = m ?? '';
  });
}

// ── los hechos ──

/** « por 12 de oro» o, si se pagó con monedas (tanda 69: el hecho lleva `oro` en milésimas y `monedas`, uno de los dos a 0), « por 1200 monedas». */
function pagado(d: Record<string, unknown>): string {
  const monedas = Number(d.monedas ?? 0), oroPagado = Number(d.oro ?? 0) / 1000;
  return monedas > 0 ? ` por ${monedas.toLocaleString('es-ES')} monedas` : oroPagado > 0 ? ` por ${oro(oroPagado)} de oro` : '';
}

/** El texto de un hecho `mercenarios.*` (los ids de héroe llegan como números). */
export function textoDeHechoMercenario(codigo: string, d: Record<string, unknown>, p: ProyeccionJugador | null): string | null {
  const quien = d.mercenario === undefined ? 'Un mercenario' : p ? nombreDeHeroe(p, `heroe-${String(d.mercenario)}`) : `heroe-${String(d.mercenario)}`;
  const tipo = TIPOS_ORDEN[Number(d.tipo ?? -1)];
  const orden = tipo ? `«${ORDEN[tipo]!.nombre}»` : '';
  switch (codigo) {
    case 'mercenarios.contratado': return `${quien} entra a sueldo de tu Facción${pagado(d)}.`;
    case 'mercenarios.prorrogado': return `Se prorroga el contrato de ${quien}${pagado(d)}.`;
    case 'mercenarios.terminado': return `Acaba el contrato de ${quien}: ${FIN[String(d.motivo ?? '')] ?? String(d.motivo ?? 'terminado')}. Puedes valorarlo en Facción › Mercenarios.`;
    case 'mercenarios.valorado': return `${quien} recibe su valoración.`;
    case 'mercenarios.ordenado': return `${quien} recibe la orden ${orden}.`;
    case 'mercenarios.orden_cumplida': return `${quien} cumple la orden ${orden}.`;
    case 'mercenarios.orden_caducada': {
      const motivo: Record<string, string> = { plazo: 'venció el plazo', objetivo: 'el objetivo ya no vale', paz: 'llegó la paz', salida: 'salió de lo que acompañaba' };
      return `Caduca la orden ${orden} de ${quien}: ${motivo[String(d.motivo ?? '')] ?? String(d.motivo ?? '')}. Sin orden, solo se defiende.`;
    }
    case 'mercenarios.mudado': return `${quien} se muda a otra plaza.`;
    case 'mercenarios.ofrecido': return 'Te ofreces en el tablón de tu campamento.';
    case 'mercenarios.oferta_retirada': return 'Retiras tu oferta del tablón.';
    case 'mercenarios.rango_subido': return `Subes a ${RANGO_MERCENARIO[RANGO_POR_NUMERO[Number(d.rango ?? 0)] ?? ''] ?? `rango ${String(d.rango ?? '')}`}: tienes una escuadra de premio por reclamar.`;
    case 'mercenarios.medalla': return `Ganas una medalla de ${GRADO[Number(d.grado ?? 0)] ?? ''}.`;
    case 'mercenarios.premio_reclamado': return 'Reclamas tu escuadra de premio de rango.';
    case 'mercenarios.leva_recibida': return `Recibes tu leva propia (${String(d.escuadras ?? '')} escuadras).`;
    default: return null;
  }
}
