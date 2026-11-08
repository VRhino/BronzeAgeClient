// BASE PERSONAL (Víctor, 2026-11-06): una ventana a pantalla completa con todo lo que es del jugador, centralizado. Sustituye a los botones
// «Héroe», «Escuadras» y «Carro» de la barra de arriba; se abre con el yelmo de la barra o con la tecla B, en cualquier pantalla.
//  - A la izquierda, el héroe: nivel, experiencia, Liderazgo, sus monedas (un solo saldo desde la tanda 69), víveres (y cuánto aguantan), dónde está, dónde reside (solo se ve:
//    la residencia se cambia desde dentro de la plaza o del campamento) y sus cargos, con un acceso a lo que manda cada uno.
//  - Pestañas: Tropas (todas sus escuadras, dónde está cada una, su orden, la guarnición y **reponer** donde se pueda), Bienes (almacén personal,
//    carro, pasar a víveres, inventario y equipo), Loadouts, Héroe (atributos), Historial y Plazas conocidas.
// Regla de Víctor: una acción solo sale donde se puede hacer. Reponer, por ejemplo, solo dentro de la plaza donde la escuadra se repone
// (`reclutarTropa` con la escuadra hecha la completa hasta su tope, motor `militar::reclutamiento`) o en tu campamento de mercenarios
// (`reclutarEnCampamento` para la tuya, `reponerPrestamo` gratis para las prestadas). Lo que no llega (equipo, oro, gente) va en rojo y lo apaga.
// Aquí no se decide ninguna regla del motor: si algo cambia, el rechazo del servidor se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import { asignarGuarnicion, capacidadDeViveres, consumoDeViveres, oroPorSoldado, radioDePuerta, retirarGuarnicion, tropasReclutables, type TropaReclutable } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, CampamentoMercenarios, Ejercito, Escuadron, HeroeProyectado, ItemInstancia, SlotEquipo } from '../tiposDominio';
import { ayuda } from './ayuda';
import { historialDeAvisos } from './avisos';
import { fuentesDePago, type PagarCon } from './columnaQuePaga';
import type { InformeDeCombate } from './informeCombate';
import { iconoEnFila } from './iconosTropa';
import { chipsDeCoste } from './juegoVisual';
import { chipLiderazgo } from './liderazgo';
import { estadoCliente } from './estadoCliente';
import { cablearCarro, htmlCarro, type Ejecutar } from './panelCarro';
import { cablearHeroe, dentroDeSuResidencia, dondeEsta, editandoLoadout, htmlFichaHeroe, htmlLoadouts, minutosHerido, soltarBorrador, type Aplicar } from './panelHeroe';
import { detalleInforme, hace } from './panelIntel';
import { nombreDeAvanzada, nombreDePueblo } from './pueblos';

type Escapar = (valor: string) => string;

export type PestanaBase = 'tropas' | 'bienes' | 'loadouts' | 'heroe' | 'historial' | 'plazas';
const PESTANAS: [PestanaBase, string][] = [['tropas', 'Tropas'], ['bienes', 'Bienes'], ['loadouts', 'Loadouts'], ['heroe', 'Héroe'], ['historial', 'Historial'], ['plazas', 'Plazas conocidas']];

let pestana: PestanaBase = 'tropas';
/** De dónde sale el oro al reponer en el campamento; se recuerda entre repintados. */
let pagarCon: PagarCon | null = null;
/** El informe de plaza abierto en «Plazas conocidas». */
let informeAbierto: string | null = null;

export function elegirPestanaBase(x: PestanaBase): void { pestana = x; soltarBorrador(); }
export const pestanaBase = (): PestanaBase => pestana;
/** Con un loadout a medio editar la ventana no se repinta sola (se llevaría lo escrito). */
export const baseOcupada = (): boolean => pestana === 'loadouts' && editandoLoadout();

/** Lo que la Base pide fuera de ella (lo pone `main.ts`). */
export interface ContextoBase {
  ejecutar: Ejecutar;
  aplicar: Aplicar;
  /** Repinta la Base a la fuerza. */
  repintar: () => void;
  cerrar: () => void;
  abrirInforme: (i: InformeDeCombate) => void;
  /** Abre la ventana de la Facción en esa pestaña. */
  abrirFaccion: (pestana: 'miembros' | 'diplomacia' | 'plazas') => void;
  /** Cierra la Base y centra el modo mapa en ese punto. */
  verEnMapa: (punto: { x: number; y: number }) => void;
}

// ── Utilidades ──

const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];
const nombreRec = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const iconoRec = (r: string): string => RECURSO_ICONO[r] ?? '📦';
const distancia = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const ORIGEN = (escalon: number): 'pesants' | 'artesanos' | 'nobleza' => (escalon <= 2 ? 'pesants' : escalon === 3 ? 'artesanos' : 'nobleza');
const ORIGEN_ICONO: Record<string, string> = { pesants: '🌾', artesanos: '⚒️', nobleza: '👑' };

function miColumna(p: ProyeccionJugador): Ejercito | undefined {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Todas las plazas que el cliente conoce, para poner nombre y sitio a un id. */
function plaza(p: ProyeccionJugador, id: string): { nombre?: string; posicion?: { x: number; y: number } } | undefined {
  return [...p.asentamientos, ...(p.plazasPropias ?? []), ...p.asentamientosAvistados].find((a) => a.id === id);
}
const nombrePlaza = (p: ProyeccionJugador, id: string): string => plaza(p, id)?.nombre ?? id;

/** La residencia: su nombre, si es plaza o campamento y dónde está. */
function residencia(p: ProyeccionJugador): { nombre: string; tipo: 'plaza' | 'campamento'; posicion?: { x: number; y: number } } | null {
  const id = p.heroe.residenciaId
    ?? p.asentamientos.find((a) => [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId))?.id
    ?? p.campamentosMercenarios.find((c) => c.residentesIds.includes(p.heroeId))?.id;
  if (!id) return null;
  if (id.startsWith('camp-')) return { nombre: `Campamento ${id}`, tipo: 'campamento', posicion: p.campamentosMercenarios.find((c) => c.id === id)?.posicion };
  const a = plaza(p, id);
  return { nombre: a?.nombre ?? id, tipo: 'plaza', posicion: a?.posicion };
}

/** Dónde está una escuadra, en palabras. */
function dondeEstaLaEscuadra(p: ProyeccionJugador, s: Escuadron): string {
  const c = s.contenedor;
  switch (c.tipo) {
    case 'campamento': { const r = residencia(p); return r?.tipo === 'plaza' ? `En tu campamento de ${r.nombre}` : r ? `En tu ${r.nombre.toLowerCase().replace('campamento', 'campamento de mercenarios')}` : 'En tu campamento'; }
    case 'ejercito': return miColumna(p)?.id === c.ejercitoId ? 'En tu columna' : 'En una columna';
    case 'escolta': return 'Escoltando una caravana';
    case 'pueblo': { const x = (p.pueblos ?? []).find((q) => q.id === c.puebloId); return `De guarnición en ${x ? nombreDePueblo(x) : 'un pueblo'}`; }
    case 'plaza': return `De guarnición en ${nombrePlaza(p, c.asentamientoId)}`;
    case 'avanzada': { const x = (p.avanzadas ?? []).find((q) => q.id === c.avanzadaId); return `De guarnición en ${x ? `la ${nombreDeAvanzada(x.etapa).toLowerCase()} de ${nombrePlaza(p, x.madreId)}` : 'una avanzada'}`; }
    default: return 'Fuera del mundo';
  }
}

// ── Reponer ──

/** Cómo se repone una escuadra desde donde está el héroe ahora, o `null` si aquí no se puede. */
type Reponer =
  | { tipo: 'plaza'; asentamientoId: string; faltan: number; coste: Record<string, number>; a: Asentamiento; libres: number; origen: string; motivo: string }
  | { tipo: 'campamento'; faltan: number; oro: number; motivo: string }
  | { tipo: 'prestada'; faltan: number };

/** ¿Está esta columna a la puerta de ese punto (`radioPuerta`)? */
function aLaPuerta(p: ProyeccionJugador, ejercitoId: string, puerta: { x: number; y: number }): boolean {
  const col = p.ejercitos.find((x) => x.id === ejercitoId);
  return Boolean(col && distancia(col.posicionActual, puerta) <= radioDePuerta());
}

/** El campamento de mercenarios donde resides si estás en él (dentro o con tu columna a su puerta), como `esta_en_el_campamento` del motor. */
function campamentoAMano(p: ProyeccionJugador): CampamentoMercenarios | undefined {
  const c = p.campamentosMercenarios.find((x) => x.residentesIds.includes(p.heroeId));
  if (!c) return undefined;
  const u = p.heroe.ubicacion;
  if (u.tipo === 'mercenarios') return u.campamentoId === c.id ? c : undefined;
  if (u.tipo === 'columna') return aLaPuerta(p, u.ejercitoId, c.posicion) ? c : undefined;
  return undefined;
}

function oroDe(p: ProyeccionJugador, c: CampamentoMercenarios): { pagarCon: PagarCon; oro: number; nombre: string } | null {
  const fuentes = fuentesDePago(p, c);
  return fuentes.find((f) => f.pagarCon === pagarCon) ?? fuentes[0] ?? null;
}

export function comoReponer(p: ProyeccionJugador, s: Escuadron, tropas: TropaReclutable[]): Reponer | null {
  const t = tropas.find((x) => x.id === s.tropaId);
  if (!t) return null;
  const faltan = t.unidadesPorDefecto - s.cantidad;
  if (faltan <= 0) return null;
  const u = p.heroe.ubicacion;
  // Las prestadas solo se reponen en su campamento, gratis.
  if (s.prestada) {
    const c = campamentoAMano(p);
    if (!c || c.id !== s.prestada.campamentoId) return null;
    const aqui = s.contenedor.tipo === 'campamento' || (s.contenedor.tipo === 'ejercito' && aLaPuerta(p, s.contenedor.ejercitoId, c.posicion));
    return aqui ? { tipo: 'prestada', faltan } : null;
  }
  // Dentro de una plaza de tu Facción: residiendo, las del campamento; ciudadano o residente, las de una columna a su puerta.
  if (u.tipo === 'asentamiento') {
    const a = p.asentamientos.find((x) => x.id === u.asentamientoId);
    if (!a || !a.almacen) return null;
    const reside = [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
    const ciudadano = Boolean(p.faccionId) && a.faccionId === p.faccionId && !(a.vetadosIds ?? []).includes(p.heroeId);
    if (!reside && !ciudadano) return null;
    const aqui = s.contenedor.tipo === 'campamento' ? reside : s.contenedor.tipo === 'ejercito' && aLaPuerta(p, s.contenedor.ejercitoId, a.posicion);
    if (!aqui) return null;
    const nivel = Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === t.edificio && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
    if (t.edificio !== 'centroUrbano' && nivel < t.nivelRequerido) return null;
    const oro = oroPorSoldado(t) ?? 0;
    const porSoldado: Record<string, number> = { ...(t.costoEquipo as Record<string, number>) };
    if (oro > 0) porSoldado['oro'] = (porSoldado['oro'] ?? 0) + oro;
    const coste = Object.fromEntries(Object.entries(porSoldado).map(([r, n]) => [r, Math.ceil(n * faltan)]).filter(([, n]) => (n as number) > 0)) as Record<string, number>;
    const origen = ORIGEN(t.escalon);
    const libres = Math.floor(a.poblacion?.[origen] ?? 0);
    const falta = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
    const motivo = falta ? 'El almacén de la plaza no tiene bastante.' : libres < faltan ? `No hay ${faltan} ${origen} libres en la plaza.` : '';
    return { tipo: 'plaza', asentamientoId: a.id, faltan, coste, a, libres, origen, motivo };
  }
  // En tu campamento de mercenarios: la que recluta el campamento, pagando en oro.
  const c = campamentoAMano(p);
  const oferta = p.mercadoCampamento?.reclutamiento;
  const o = oferta?.tropas.find((x) => x.tropaId === s.tropaId && x.desbloqueada);
  if (!c || !oferta || !o) return null;
  const aqui = s.contenedor.tipo === 'campamento' || (s.contenedor.tipo === 'ejercito' && aLaPuerta(p, s.contenedor.ejercitoId, c.posicion));
  if (!aqui) return null;
  const oro = Math.ceil(o.precioPorSoldado * faltan);
  const fuente = oroDe(p, c);
  const motivo = !fuente ? 'No tienes con qué pagar aquí.' : oferta.poblacion < faltan ? `Faltan reclutas: hay ${Math.floor(oferta.poblacion)} y hacen falta ${faltan}.` : oro > fuente.oro ? `No te llega el oro: ${oro} y tienes ${Math.floor(fuente.oro)} en ${fuente.nombre}.` : '';
  return { tipo: 'campamento', faltan, oro, motivo };
}

// ── Lateral ──

const YELMO = '<svg class="base-yelmo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20v-8a7 7 0 0 1 14 0v8"/><path d="M5 20h4v-6h6v6h4"/><path d="M12 5V2M9 3h6"/></svg>';

const CARGO: Record<string, [string, string]> = {
  rey: ['👑', 'Rey'], embajador: ['📜', 'Embajador'], gobernador: ['🏛️', 'Gobernador'], maestroObras: ['🔨', 'Maestro de Obras'], maestroCaravanas: ['🐂', 'Maestro de Caravanas'],
  tesorero: ['💰', 'Tesorero'], general: ['⚔️', 'General'], sacerdote: ['🔥', 'Sacerdote'],
};

/** Tus cargos (los de `MiembroFaccion.cargos`: `rey`, `embajador`, `gobernador@as-3`…), con el botón que lleva a lo que manda cada uno. */
function htmlCargos(p: ProyeccionJugador, e: Escapar): string {
  const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
  const cargos = yo?.cargos ?? [];
  if (cargos.length === 0) return '';
  return `<div class="base-cargos"><span class="base-lateral-titulo">Tus cargos</span>${cargos.map((c) => {
    const [clave, sitio] = c.split('@');
    const [emblema, nombre] = CARGO[clave!] ?? ['•', clave!];
    const boton = clave === 'rey' ? '<button class="btn-secondary" type="button" data-base-faccion="miembros">Facción</button>'
      : clave === 'embajador' ? '<button class="btn-secondary" type="button" data-base-faccion="diplomacia">Diplomacia</button>'
      : sitio && plaza(p, sitio)?.posicion ? `<button class="btn-secondary" type="button" data-base-mapa="${e(sitio)}">Ver en el mapa</button>` : '';
    return `<div class="base-cargo"><span aria-hidden="true">${emblema}</span><span><strong>${e(nombre)}</strong>${sitio ? `<small>${e(nombrePlaza(p, sitio))}</small>` : ''}</span>${boton}</div>`;
  }).join('')}</div>`;
}

/** Los víveres: lo que llevas, lo que cabe y, en columna personal, cuánto aguantan al paso de ahora. */
function htmlViveres(p: ProyeccionJugador, repintar: () => void): string {
  const col = miColumna(p);
  const viveres = Math.floor(p.heroe.viveres ?? 0);
  if (!col) return `<div class="faccion-lateral-dato"><span>🌾 Víveres</span><strong>${viveres}</strong></div>`;
  const capacidad = capacidadDeViveres(repintar) * Math.max(1, col.participantes.length);
  let dura = '';
  // En un ejército los víveres son de todos y la proyección solo trae los tuyos: ahí no se estima.
  if (col.participantes.length === 1) {
    const soldados = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === col.id).reduce((t, s) => t + s.cantidad, 0);
    const porMinuto = consumoDeViveres(soldados, 1, col.estado !== 'estacionado', col.marchaForzada === true, repintar);
    if (porMinuto && porMinuto > 0) {
      const min = viveres / porMinuto;
      dura = `<small class="base-dura" title="Al paso de ahora (${col.estado === 'estacionado' ? 'acampada' : col.marchaForzada ? 'en marcha forzada' : 'en marcha'}): ${porMinuto.toFixed(2)} de trigo por minuto">aguantan ${min >= 120 ? `${Math.floor(min / 60)} h` : `${Math.floor(min)} min`}</small>`;
    }
  }
  return `<div class="faccion-lateral-dato"><span>🌾 Víveres</span><strong>${viveres} / ${capacidad}</strong></div>${dura}`;
}

function htmlLateral(p: ProyeccionJugador, e: Escapar, repintar: () => void): string {
  const h = p.heroe;
  const herido = minutosHerido(p);
  const r = residencia(p);
  const f = p.facciones.find((x) => x.id === p.faccionId);
  const puntos = h.puntosDeAtributoSinGastar;
  return `<aside class="faccion-lateral base-lateral">
    <div class="base-retrato">${YELMO}<span class="base-nivel" title="Nivel">${h.nivel}</span></div>
    <h2 class="faccion-lateral-nombre">${e(h.displayName)}</h2>
    <p class="base-donde">${e(dondeEsta(h, p))}${f ? ` · ${e(f.nombre)}` : ''}</p>
    ${herido !== null ? `<p class="heroe-herido">Herido: ${herido} min</p>` : ''}
    <div class="faccion-lateral-pie">
      <div class="faccion-lateral-dato"><span>Experiencia</span><strong>${h.experienciaHaciaSiguienteNivel}</strong></div>
      <div class="faccion-lateral-dato"><span>Liderazgo</span><strong>${h.liderazgoBase}</strong></div>
      ${puntos > 0 ? `<button class="base-puntos" type="button" data-base-pestana="heroe">${puntos} ${puntos === 1 ? 'punto' : 'puntos'} sin gastar</button>` : ''}
      <div class="base-monedas" title="Tus monedas: las ganas combatiendo (también contra bandidos) y pagan contratos de mercenario. Aparte del oro de las plazas: 100 monedas valen 1 de oro."><span>💰 Monedas</span><strong>${h.monedas.toLocaleString('es-ES')}</strong></div>
      ${htmlViveres(p, repintar)}
      <div class="base-residencia"><span class="base-lateral-titulo">Resides en${ayuda('base:residencia', 'La residencia se cambia o se deja desde dentro de la plaza o del campamento: en la plaza, en el blasón; en el campamento, en su Resumen.')}</span>
        ${r ? `<strong>${r.tipo === 'plaza' ? '🏠' : '🏕️'} ${e(r.nombre)}</strong>${r.posicion ? `<button class="btn-secondary" type="button" data-base-punto="${r.posicion.x},${r.posicion.y}">Ver en el mapa</button>` : ''}` : '<strong>En ningún sitio</strong>'}
      </div>
      ${htmlCargos(p, e)}
    </div>
  </aside>`;
}

// ── Tropas ──

function htmlTropas(p: ProyeccionJugador, e: Escapar, repintar: () => void): string {
  const h = p.heroe;
  const tropas = tropasReclutables(repintar) ?? [];
  const escuadras = h.escuadrones;
  const total = escuadras.reduce((t, s) => t + s.cantidad, 0);
  const libre = h.cupoGuarnicion - h.guarnicionOcupada;
  const activo = h.loadouts.find((l) => l.activo);
  const dentro = dentroDeSuResidencia(p) && minutosHerido(p) === null;
  const reponer = new Map(escuadras.map((s) => [s.id, comoReponer(p, s, tropas)] as const));
  const prestadas = escuadras.filter((s) => reponer.get(s.id)?.tipo === 'prestada');
  const enCampamento = [...reponer.values()].some((x) => x?.tipo === 'campamento');
  const c = campamentoAMano(p);
  const fuentes = c && enCampamento ? fuentesDePago(p, c) : [];
  const cabecera = `<div class="obra-titulo"><span class="faction-kicker">Tus escuadras</span>
      <span class="obra-chip" title="Escuadras">⚔ ${escuadras.length}</span><span class="obra-chip" title="Hombres en total">🧑 ${total}</span>
      <span class="obra-chip" title="Liderazgo de tus escuadras en la guarnición de tu residencia, frente al cupo que te da">🛡 ${h.guarnicionOcupada}/${h.cupoGuarnicion}</span>
      ${fuentes.length > 1 ? `<label class="camp-pagar-con"><span>Pagar con</span><select class="form-input" data-base-pagar>${fuentes.map((x) => `<option value="${x.pagarCon}"${x.pagarCon === (oroDe(p, c!)?.pagarCon) ? ' selected' : ''}>${e(x.nombre)} (${Math.floor(x.oro)} de oro)</option>`).join('')}</select></label>` : ''}
      ${ayuda('base:tropas', 'Todas tus escuadras, estén donde estén, en su orden de combate (la primera entra primero; se cambia con las flechas). Se reponen hasta su tope solo donde se reclutan: dentro de tu plaza, con el equipo de su almacén y su gente libre (residiendo, las de tu campamento; las de tu columna, con ella a la puerta), o en tu campamento de mercenarios, con oro. Las prestadas se reponen gratis en su campamento.')}</div>`;
  const botonPrestadas = prestadas.length
    ? `<button class="btn-primary base-reponer-prestadas" type="button" data-base-reponer-prestadas>Reponer las prestadas · ${prestadas.reduce((t, s) => t + (reponer.get(s.id) as { faltan: number }).faltan, 0)} hombres, gratis</button>` : '';
  if (escuadras.length === 0) return `${cabecera}<p class="mapa-lista-vacia">No tienes escuadras: se reclutan en la plaza o en el campamento donde resides.</p>`;
  const filas = escuadras.map((s, i) => {
    const t = tropas.find((x) => x.id === s.tropaId);
    const tope = t?.unidadesPorDefecto ?? s.cantidad;
    const pct = tope > 0 ? Math.min(100, Math.round((s.cantidad / tope) * 100)) : 100;
    const enCamp = s.contenedor.tipo === 'campamento';
    const defiende = enCamp && (s.enGuarnicion || (dentro && Boolean(activo?.squadIds.includes(s.id))));
    const guarnicion = !enCamp || s.prestada ? ''
      : s.enGuarnicion ? `<button type="button" class="btn-secondary" data-base-retirar="${e(s.id)}">Retirar de la guarnición</button>`
      : `<button type="button" class="btn-secondary" data-base-asignar="${e(s.id)}"${s.costeLiderazgo > libre ? ' disabled title="No cabe en el cupo de guarnición"' : ''}>A la guarnición</button>`;
    const r = reponer.get(s.id);
    const boton = !r || r.tipo === 'prestada' ? ''
      : r.tipo === 'plaza'
        ? `<button class="btn-primary base-reponer" type="button" data-base-reponer="${e(s.tropaId)}" data-plaza="${e(r.asentamientoId)}"${r.motivo ? ` disabled title="${e(r.motivo)}"` : ''}>Reponer ${r.faltan} <span class="recl-costes">${chipsDeCoste(r.a, r.coste, e)}<span class="obra-coste${r.libres < r.faltan ? ' falta' : ''}" title="${e(`${r.faltan} ${r.origen} libres de la plaza (hay ${r.libres})`)}">${ORIGEN_ICONO[r.origen]}${r.faltan}</span></span></button>`
        : `<button class="btn-primary base-reponer" type="button" data-base-reponer-camp="${e(s.tropaId)}"${r.motivo ? ` disabled title="${e(r.motivo)}"` : ''}>Reponer ${r.faltan} <span class="recl-costes"><span class="obra-coste${r.motivo.startsWith('No te llega') ? ' falta' : ''}">${iconoRec('oro')}${r.oro}</span></span></button>`;
    return `<li class="base-escuadra${s.cantidad < tope ? ' mermada' : ''}">
      <span class="base-orden"><button class="btn-secondary" type="button" data-base-mover="${i}" data-dir="-1" aria-label="Subir ${e(s.nombre)}"${i === 0 ? ' disabled' : ''}>↑</button><button class="btn-secondary" type="button" data-base-mover="${i}" data-dir="1" aria-label="Bajar ${e(s.nombre)}"${i === escuadras.length - 1 ? ' disabled' : ''}>↓</button></span>
      ${iconoEnFila(s.tropaId)}
      <div class="base-escuadra-cuerpo">
        <strong>${e(s.nombre)} ${chipLiderazgo(s)}${s.prestada ? ' <em class="heroe-marca">prestada</em>' : ''}${s.enGuarnicion ? ' <em class="heroe-marca">en guarnición</em>' : ''}${defiende ? ' <em class="heroe-marca">defiende</em>' : ''}</strong>
        <span class="base-hombres"><span class="obra-barra"><i style="width:${pct}%"></i></span><b>${s.cantidad}/${tope}</b> hombres · nivel ${s.nivel} · moral ${Math.round(s.moral)}</span>
        <span class="base-sitio">📍 ${e(dondeEstaLaEscuadra(p, s))}</span>
      </div>
      <div class="base-escuadra-acciones">${boton}${guarnicion}</div>
    </li>`;
  }).join('');
  return `${cabecera}${botonPrestadas}<ol class="base-escuadras">${filas}</ol><p class="faction-error" data-campo="error-base" role="alert"></p>`;
}

// ── Bienes ──

const SLOTS: [SlotEquipo, string][] = [['arma', 'Arma'], ['casco', 'Casco'], ['torso', 'Torso'], ['guantes', 'Guantes'], ['pantalones', 'Pantalones'], ['botas', 'Botas']];
const nombreItem = (i: ItemInstancia): string => i.itemDefinitionId.replace(/_/g, ' ');

function htmlEquipo(h: HeroeProyectado, e: Escapar): string {
  const slots = SLOTS.map(([id, nombre]) => {
    const x = h.equipamiento[id];
    return `<div class="base-slot${x ? '' : ' vacio'}" title="${e(x ? `${nombreItem(x)}${x.estadisticas?.length ? ` · ${x.estadisticas.map((s) => `${s.nombre} ${s.valor}`).join(', ')}` : ''}` : 'Vacío')}"><span>${nombre}</span><strong>${x ? e(nombreItem(x)) : '—'}</strong></div>`;
  }).join('');
  const inventario = h.inventario.length
    ? `<div class="base-inventario">${h.inventario.map((x) => `<div class="base-item" title="${e(`${x.tipo} · ${x.precio} de precio`)}"><strong>${e(nombreItem(x))}</strong>${x.cantidad > 1 ? `<small>×${x.cantidad}</small>` : ''}</div>`).join('')}</div>`
    : '<p class="mapa-lista-vacia">El inventario está vacío.</p>';
  return `<div class="obra-titulo"><span class="faction-kicker">Equipo e inventario</span>${ayuda('base:equipo', 'Lo que lleva puesto tu héroe y lo que guarda. De momento solo se ve: equiparse aún no es una orden del servidor.')}</div>
    <div class="base-slots">${slots}</div>${inventario}`;
}

/** Pasar trigo del carro a los víveres (`pasarAViveres`): solo el Líder de la columna y solo lo que cabe. */
function htmlPasarAViveres(p: ProyeccionJugador, repintar: () => void): string {
  const col = miColumna(p);
  if (!col || col.liderId !== p.heroeId) return '';
  const capacidad = capacidadDeViveres(repintar) * Math.max(1, col.participantes.length);
  const hueco = Math.max(0, Math.floor(capacidad - (p.heroe.viveres ?? 0)));
  const trigo = Math.floor(col.suministro?.['trigo'] ?? 0);
  const maximo = Math.min(hueco, trigo);
  if (maximo < 1) return '';
  return `<div class="base-viveres"><span>🌾 Víveres ${Math.floor(p.heroe.viveres ?? 0)} / ${capacidad} · trigo en el carro ${trigo}</span>
    <input class="form-input" type="number" min="1" max="${maximo}" value="${maximo}" data-base-viveres-cantidad />
    <button class="btn-secondary" type="button" data-base-viveres>Pasar a víveres</button></div>`;
}

function htmlBienes(p: ProyeccionJugador, e: Escapar, repintar: () => void): string {
  return `<div class="base-bienes"><div class="base-bienes-carga">${htmlPasarAViveres(p, repintar)}${htmlCarro(p, e, false, false)}</div><div class="base-bienes-equipo">${htmlEquipo(p.heroe, e)}</div></div>`;
}

// ── Historial ──

function htmlHistorial(p: ProyeccionJugador, e: Escapar): string {
  const h = p.heroe;
  const bandidos = h.bandidosDestruidos ?? [];
  const ultimo = bandidos.length ? Math.max(...bandidos) : null;
  const batallas = historialDeAvisos().map((x, i) => ({ x, i })).filter(({ x }) => x.informe);
  return `<div class="obra-titulo"><span class="faction-kicker">Hazañas</span></div>
    <div class="faction-stats base-hazanas">
      <div><span>Campamentos de bandidos destruidos</span><strong>${bandidos.length}</strong>${ultimo ? `<small>el último hace ${hace(p.instante - ultimo)}</small>` : ''}</div>
      <div><span>Alijos abiertos</span><strong>${(h.alijosAbiertos ?? []).length}</strong></div>
      <div><span>Batallas de esta sesión</span><strong>${batallas.length}</strong></div>
    </div>
    <div class="obra-titulo"><span class="faction-kicker">Informes de combate</span>${ayuda('base:informes', 'Los combates en los que has estado desde que entraste: el servidor los manda como avisos y aquí se guardan los informes. Al cerrar sesión se pierden.')}</div>
    ${batallas.length === 0 ? '<p class="mapa-lista-vacia">Ningún combate desde que entraste.</p>' : `<ul class="base-batallas">${batallas.map(({ x, i }) => {
      const inf = x.informe!;
      return `<li class="${inf.resultado}"><span aria-hidden="true">${inf.resultado === 'victoria' ? '🏆' : '💀'}</span><span><strong>${e(inf.titulo)}</strong><small>${e(inf.resumen)}${x.momento ? ` · ${e(new Date(x.desde).toLocaleTimeString().slice(0, 5))}` : ''}</small></span><button class="btn-secondary" type="button" data-base-informe="${i}">Ver informe</button></li>`;
    }).join('')}</ul>`}`;
}

// ── Plazas conocidas ──

function htmlPlazas(p: ProyeccionJugador, e: Escapar): string {
  const recordadas = p.heroe.plazasRecordadas ?? [];
  const informes = p.informesPlaza;
  const abierto = informes.find((i) => i.asentamientoId === informeAbierto);
  const recuerdo = recordadas.length === 0 ? '<p class="mapa-lista-vacia">Aún no has salido de tu plaza al mundo.</p>'
    : recordadas.map((r) => {
      const a = plaza(p, r.asentamientoId);
      const recursos = Object.entries(r.almacen).filter(([, n]) => n >= 1).sort(([, x], [, y]) => y - x);
      return `<div class="base-recuerdo"><div class="base-recuerdo-cab"><strong>🏠 ${e(a?.nombre ?? r.asentamientoId)}</strong><small>visto hace ${hace(p.instante - r.vistoEn)}</small>
          ${a?.posicion ? `<button class="btn-secondary" type="button" data-base-punto="${a.posicion.x},${a.posicion.y}">Ver en el mapa</button>` : ''}</div>
        <div class="base-recuerdo-datos"><span class="obra-chip" title="Edificios en cola o en obra">🔨 ${r.obras} obras</span><span class="obra-chip" title="Escuadras en su guarnición">🛡 ${r.guarnicion} escuadras</span></div>
        <div class="base-recuerdo-almacen">${recursos.length ? recursos.map(([k, n]) => `<span class="obra-chip" title="${e(nombreRec(k))}">${iconoRec(k)} ${Math.floor(n)}</span>`).join('') : '<small>Almacén vacío</small>'}</div></div>`;
    }).join('');
  return `<div class="obra-titulo"><span class="faction-kicker">Lo que recuerdas de tu plaza</span>${ayuda('base:recuerdo', 'Al salir de tu plaza al mundo te llevas la foto de lo que veías dentro: el almacén, las obras y la guarnición. Se renueva cada vez que sales.')}</div>
    ${recuerdo}
    <div class="obra-titulo"><span class="faction-kicker">Informes comprados</span><span class="obra-chip">${informes.length}</span>${ayuda('base:informes-plaza', 'Los informes de plazas ajenas que compraste en una taberna: la foto, con fecha, de su trazado y su defensa. Se compran en la taberna de tu plaza o de un campamento de mercenarios.')}</div>
    ${informes.length === 0 ? '<p class="mapa-lista-vacia">Ninguno.</p>' : `<div class="intel-informes">${informes.map((i) => `<button class="intel-informe-btn${i === abierto ? ' abierto' : ''}" type="button" data-base-informe-plaza="${e(i.asentamientoId)}"><span><b>${e(i.nombre ?? i.asentamientoId)}</b><small>nivel ${ROMANO[i.nivel] ?? i.nivel} · hace ${hace(p.instante - i.conocidoEn)}</small></span></button>`).join('')}</div>`}
    ${abierto ? detalleInforme(abierto, p, e) : ''}`;
}

// ── La ventana ──

export function htmlBasePersonal(p: ProyeccionJugador, e: Escapar, repintar: () => void): string {
  const cuerpo = pestana === 'tropas' ? htmlTropas(p, e, repintar)
    : pestana === 'bienes' ? htmlBienes(p, e, repintar)
    : pestana === 'loadouts' ? htmlLoadouts(p.heroe, e)
    : pestana === 'heroe' ? htmlFichaHeroe(p.heroe, p, e)
    : pestana === 'historial' ? htmlHistorial(p, e)
    : htmlPlazas(p, e);
  const mermadas = p.heroe.escuadrones.filter((s) => (tropasReclutables()?.find((t) => t.id === s.tropaId)?.unidadesPorDefecto ?? 0) > s.cantidad).length;
  const nav = `<nav class="faccion-pestanas" role="tablist">${PESTANAS.map(([id, nombre]) => `<button type="button" role="tab" class="faccion-pestana${id === pestana ? ' activo' : ''}" aria-selected="${id === pestana}" data-base-pestana="${id}">${nombre}${id === 'tropas' && mermadas ? ` <span class="faccion-aviso" title="Escuadras por debajo de su tope">${mermadas}</span>` : ''}${id === 'heroe' && p.heroe.puntosDeAtributoSinGastar ? ` <span class="faccion-aviso" title="Puntos sin gastar">${p.heroe.puntosDeAtributoSinGastar}</span>` : ''}</button>`).join('')}</nav>`;
  return `<div class="faccion-cabecera"><div class="mapa-panel-jugador">Base personal</div><button class="btn-secondary" type="button" data-base-cerrar aria-label="Cerrar">Cerrar</button></div>
    <div class="faccion-marco">${htmlLateral(p, e, repintar)}<div class="faccion-principal">${nav}<div class="faccion-cuerpo base-cuerpo base-pestana-${pestana}">${cuerpo}</div></div></div>`;
}

export function cablearBasePersonal(panel: HTMLElement, p: ProyeccionJugador, ctx: ContextoBase): void {
  const error = (m: string | null): void => { const x = panel.querySelector<HTMLElement>('[data-campo="error-base"]'); if (x) x.textContent = m ?? ''; };
  const boton = (selector: string, hacer: (b: HTMLButtonElement) => Promise<string | null>): void => panel.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const m = await hacer(b);
    if (m !== null) { b.disabled = false; error(m); }
  }));
  panel.querySelector('[data-base-cerrar]')?.addEventListener('click', ctx.cerrar);
  panel.querySelectorAll<HTMLButtonElement>('[data-base-pestana]').forEach((b) => b.addEventListener('click', () => { elegirPestanaBase(b.dataset.basePestana as PestanaBase); ctx.repintar(); }));
  panel.querySelectorAll<HTMLButtonElement>('[data-base-faccion]').forEach((b) => b.addEventListener('click', () => ctx.abrirFaccion(b.dataset.baseFaccion as 'miembros' | 'diplomacia')));
  panel.querySelectorAll<HTMLButtonElement>('[data-base-mapa]').forEach((b) => b.addEventListener('click', () => { const x = plaza(p, b.dataset.baseMapa!)?.posicion; if (x) ctx.verEnMapa(x); }));
  panel.querySelectorAll<HTMLButtonElement>('[data-base-punto]').forEach((b) => b.addEventListener('click', () => { const [x, y] = b.dataset.basePunto!.split(',').map(Number); ctx.verEnMapa({ x: x!, y: y! }); }));

  // Tropas
  panel.querySelector<HTMLSelectElement>('[data-base-pagar]')?.addEventListener('change', (ev) => { pagarCon = (ev.target as HTMLSelectElement).value as PagarCon; ctx.repintar(); });
  boton('[data-base-reponer]', (b) => ctx.ejecutar('reclutarTropa', { asentamientoId: b.dataset.plaza!, heroeId: p.heroeId, tropaId: b.dataset.baseReponer! }));
  boton('[data-base-reponer-camp]', (b) => {
    const c = campamentoAMano(p);
    return ctx.ejecutar('reclutarEnCampamento', { tropaId: b.dataset.baseReponerCamp!, pagarCon: (c && oroDe(p, c)?.pagarCon) ?? 'almacenPersonal' });
  });
  boton('[data-base-reponer-prestadas]', () => ctx.ejecutar('reponerPrestamo', {}));
  boton('[data-base-asignar]', (b) => ctx.aplicar(asignarGuarnicion(estadoCliente.gameIdActivo, b.dataset.baseAsignar!)));
  boton('[data-base-retirar]', (b) => ctx.aplicar(retirarGuarnicion(estadoCliente.gameIdActivo, b.dataset.baseRetirar!)));
  panel.querySelectorAll<HTMLButtonElement>('[data-base-mover]').forEach((b) => b.addEventListener('click', async () => {
    const ids = p.heroe.escuadrones.map((s) => s.id);
    const i = Number(b.dataset.baseMover), j = i + Number(b.dataset.dir);
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    const flechas = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-base-mover]'));
    const antes = flechas.map((x) => x.disabled);
    flechas.forEach((x) => { x.disabled = true; });
    const m = await ctx.ejecutar('ordenarEscuadras', { escuadronIds: ids });
    if (m !== null) { flechas.forEach((x, k) => { x.disabled = antes[k]!; }); error(m); }
  }));

  // Bienes
  if (pestana === 'bienes') cablearCarro(panel, ctx.ejecutar, p.heroeId);
  boton('[data-base-viveres]', () => {
    const n = Math.floor(Number(panel.querySelector<HTMLInputElement>('[data-base-viveres-cantidad]')?.value ?? 0));
    return n >= 1 ? ctx.ejecutar('pasarAViveres', { cantidad: n }) : Promise.resolve('Pon una cantidad de 1 o más.');
  });

  // Loadouts y Héroe
  if (pestana === 'loadouts' || pestana === 'heroe') cablearHeroe(panel, p.heroe, ctx.aplicar, ctx.repintar);

  // Historial y Plazas
  panel.querySelectorAll<HTMLButtonElement>('[data-base-informe]').forEach((b) => b.addEventListener('click', () => {
    const inf = historialDeAvisos()[Number(b.dataset.baseInforme)]?.informe;
    if (inf) ctx.abrirInforme(inf);
  }));
  panel.querySelectorAll<HTMLButtonElement>('[data-base-informe-plaza]').forEach((b) => b.addEventListener('click', () => {
    informeAbierto = informeAbierto === b.dataset.baseInformePlaza ? null : b.dataset.baseInformePlaza!;
    ctx.repintar();
  }));
}
