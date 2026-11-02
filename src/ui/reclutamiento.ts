// Pestaña «RECLUTAMIENTO» de la plaza: reclutar o reponer tropa con `reclutarTropa { asentamientoId, heroeId, tropaId }`. Todos los edificios militares juntos.
// Cada tropa es un botón con su icono, agrupadas por edificio. Solo se ENSEÑA lo que la Facción puede formar ya (tecnología, edificio y su nivel): lo demás se esconde. La elegida
// se abre en una ficha encima de la rejilla, que dice lo que depende del momento (residencia, la escuadra que ya tienes, hombres libres, equipo) y lleva el botón (estilo juego, 2026-11-02). Un héroe tiene como mucho UNA escuadra por tropa en toda la partida:
// si ya la tiene, reclutar la REPONE y solo donde está. El oro por soldado sale del balance como en el motor (escalón + caballos; la tropa del Centro Urbano no paga; «Leva Forzosa» solo toca el equipo); si algo falla, el rechazo del servidor se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import { bloqueDeDatos, oroPorSoldado, tropasReclutables, type TropaReclutable } from '../apiCliente';
import { EDIFICIO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { mostrar as mostrarAviso } from './avisos';
import { iconoEdificio } from './iconosEdificio';
import { iconoTropa } from './iconosTropa';
import { chipsDeCoste, marcasNivel } from './juegoVisual';
import { iconoRitmo, piezaDeTropa, velocidadDePiezas } from './velocidadColumna';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const ORDEN_EDIFICIO = ['centroUrbano', 'barracon', 'galeriaDeTiro', 'caballerizas'];
const ORIGEN = (escalon: number): 'pesants' | 'artesanos' | 'nobleza' => (escalon <= 2 ? 'pesants' : escalon === 3 ? 'artesanos' : 'nobleza');

function resideAqui(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/** Tecnologías que adoptó la Facción propia; `null` si el backend no las manda (entonces no se filtra por tecnología). */
function adoptadasDe(p: ProyeccionJugador): string[] | null {
  const t = p.tecnologia as { propias?: { adoptadas?: string[] } | null } | undefined;
  return t?.propias?.adoptadas ?? p.tecnologiasAdoptadas ?? (t ? [] : null);
}

/** Una cifra de la ficha con su barra contra el máximo del catálogo. */
function stat(icono: string, etiqueta: string, valor: number | undefined, maximo: number, clase = ''): string {
  if (valor === undefined) return '';
  return `<span class="recl-stat ${clase}" title="${etiqueta}: ${valor}"><span class="recl-stat-icono" aria-hidden="true">${icono}</span><small>${etiqueta}</small><b>${valor}</b>
    <span class="recl-stat-barra"><i style="width:${((Math.min(valor, maximo) / Math.max(1, maximo)) * 100).toFixed(1)}%"></i></span></span>`;
}

/** Las estrellas del escalón (llenas hasta el suyo, vacías hasta el más alto del catálogo). */
const estrellas = (escalon: number, maximo: number): string =>
  `<span class="recl-estrellas" title="Escalón ${escalon} de ${maximo}" aria-label="Escalón ${escalon}">${Array.from({ length: Math.max(escalon, maximo) }, (_, i) => `<i${i < escalon ? ' class="llena"' : ''}>★</i>`).join('')}</span>`;

const ORIGEN_ICONO: Record<string, string> = { pesants: '🌾', artesanos: '⚒️', nobleza: '👑' };

/** La ficha de la tropa elegida, como la de un juego de estrategia: retrato con su escalón, poder y velocidad en barras contra lo mejor del catálogo
 * (la velocidad con el color de ritmo de la columna), liderazgo y hombres, la escuadra que ya tienes, el coste en chips y el botón. */
function ficha(t: TropaReclutable, todas: TropaReclutable[], p: ProyeccionJugador, a: Asentamiento, reside: boolean, nivel: number, e: Escapar): string {
  const existente = p.heroe.escuadrones.find((s) => s.tropaId === t.id && !s.prestada);
  const falta = t.unidadesPorDefecto - (existente?.cantidad ?? 0);
  const origen = ORIGEN(t.escalon);
  const libres = Math.floor(a.poblacion?.[origen] ?? 0);
  const oroUnidad = oroPorSoldado(t) ?? 0;
  const porSoldado = oroUnidad > 0 ? { ...t.costoEquipo, oro: (t.costoEquipo['oro'] ?? 0) + oroUnidad } : t.costoEquipo;
  const coste = Object.fromEntries(Object.entries(porSoldado).map(([r, n]) => [r, Math.ceil((n ?? 0) * Math.max(falta, 0))]).filter(([, n]) => (n as number) > 0)) as Record<string, number>;
  const liderazgo = bloqueDeDatos<{ costePorEscalon?: Record<string, number> }>('LIDERAZGO')?.costePorEscalon?.[String(t.escalon)];
  const v = velocidadDePiezas([piezaDeTropa(t.id)]);
  const maxPoder = Math.max(1, ...todas.map((x) => x.poderBase ?? 0));
  const maxVel = Math.max(1, ...todas.map((x) => x.velocidad ?? 0));
  const maxEscalon = Math.max(1, ...todas.map((x) => x.escalon));

  const bloqueo = falta <= 0 ? 'Escuadra al completo.'
    : existente && existente.contenedor.tipo !== 'campamento' ? 'Tu escuadra está fuera del campamento: solo se repone donde está.'
    : !reside ? 'Solo quien reside en esta plaza recluta aquí.' : '';
  const escuadra = existente
    ? `<span class="recl-escuadra" title="Tu escuadra: ${existente.cantidad} de ${t.unidadesPorDefecto} hombres"><small>Tu escuadra</small><span class="recl-escuadra-barra"><i style="width:${((Math.min(existente.cantidad, t.unidadesPorDefecto) / t.unidadesPorDefecto) * 100).toFixed(1)}%"></i></span><b>${existente.cantidad}<small>/${t.unidadesPorDefecto}</small></b></span>`
    : `<span class="recl-escuadra nueva"><small>Escuadra nueva</small><b>${t.unidadesPorDefecto} hombres</b></span>`;
  const accion = falta <= 0 ? '✓ Completa' : existente ? `↻ Reponer +${falta}` : '⚔ Reclutar';
  return `<div class="recl-ficha">
    <div class="recl-retrato"><span class="recl-ficha-icono">${iconoTropa(t.id, 60)}</span>${estrellas(t.escalon, maxEscalon)}</div>
    <div class="recl-ficha-cuerpo">
      <div class="recl-ficha-titulo"><strong>${e(t.nombre)}</strong></div>
      <small class="recl-ficha-sub">${iconoEdificio(t.edificio, 14)} ${e(EDIFICIO_NOMBRE[t.edificio] ?? t.edificio)} nivel ${t.nivelRequerido}${nivel ? ` · tienes ${nivel}` : ''}</small>
      <div class="recl-stats">
        ${stat('⚔️', 'Poder', t.poderBase, maxPoder)}
        ${stat(iconoRitmo(v, 12), 'Velocidad', t.velocidad, maxVel, `ritmo-${v.ritmo ?? 'ligera'}`)}
      </div>
      <div class="recl-chips">
        ${liderazgo !== undefined ? `<span class="obra-chip" title="Liderazgo que ocupa la escuadra">♛ ${liderazgo}</span>` : ''}
        <span class="obra-chip${libres < falta ? ' baja' : ''}" title="Salen de los ${origen} libres de la plaza">${ORIGEN_ICONO[origen]} ${libres} ${origen} libres</span>
      </div>
      ${escuadra}
    </div>
    <div class="recl-pie">
      <span class="recl-costes">${falta <= 0 ? '' : Object.keys(coste).length ? chipsDeCoste(a, coste, e) : '<span class="obra-coste">sin coste</span>'}</span>
      <button class="recl-boton" type="button" data-reclutar="${e(t.id)}"${bloqueo ? ` disabled title="${e(bloqueo)}"` : ''}>${accion}</button>
    </div>
    ${bloqueo && falta > 0 ? `<small class="recl-bloqueo">${e(bloqueo)}</small>` : ''}
  </div>`;
}

/** La tropa abierta en la ficha; se queda al repintar la pestaña. */
let tropaElegida: string | null = null;

/**
 * Reclutamiento: la gente libre en chips, la ficha de la tropa elegida y, debajo, una rejilla por edificio militar (icono, nombre y nivel en rombos)
 * con una casilla por tropa: icono, nombre y, si ya tienes su escuadra, una barra de lo llena que está (✓ completa).
 */
export function htmlReclutamiento(p: ProyeccionJugador, a: Asentamiento, e: Escapar, alCargar: () => void): string {
  const tropas = tropasReclutables(alCargar);
  if (!tropas) return '<p class="mapa-lista-vacia">Cargando el catálogo de tropas…</p>';
  const adoptadas = adoptadasDe(p);
  const nivelDe = (tipo: string): number => Math.max(0, ...(a.edificios ?? []).filter((x) => x.tipo === tipo && x.estado === 'activo').map((x) => x.nivelInterno ?? 1));
  const desbloqueada = (t: TropaReclutable): boolean => (adoptadas === null || adoptadas.includes(t.tecnologia)) && nivelDe(t.edificio) >= t.nivelRequerido;
  const reside = resideAqui(p, a);
  const porEdificio = ORDEN_EDIFICIO.map((tipo) => [tipo, tropas.filter((t) => t.edificio === tipo && desbloqueada(t)).sort((x, y) => x.escalon - y.escalon || x.nivelRequerido - y.nivelRequerido)] as const).filter(([, l]) => l.length > 0);
  const ordenadas = porEdificio.flatMap(([, l]) => l);
  const elegida = ordenadas.find((t) => t.id === tropaElegida) ?? ordenadas[0];
  const pob = a.poblacion;
  const origenElegida = elegida ? ORIGEN(elegida.escalon) : null;
  const info = ayuda('plaza:reclutamiento', 'Los militares de la plaza, juntos. Elige una tropa para ver su ficha. Reclutas con el equipo del almacén; si ya tienes una escuadra de esa tropa, solo la repones hasta completarla. Aquí solo salen las tropas que tu Facción ya puede formar: otras llegan con más tecnología o edificios militares mejores.<br>El servidor no deja reclutar si dejaría la producción sin brazos.');
  const nivelesMax = (tipo: string): number => Math.max(1, ...tropas.filter((t) => t.edificio === tipo).map((t) => t.nivelRequerido));
  const casilla = (t: TropaReclutable): string => {
    const tuya = p.heroe.escuadrones.find((s) => s.tropaId === t.id && !s.prestada);
    const llena = tuya ? Math.min(1, tuya.cantidad / t.unidadesPorDefecto) : null;
    const titulo = `${t.nombre} · escalón ${t.escalon}${tuya ? ` · tu escuadra ${tuya.cantidad}/${t.unidadesPorDefecto}` : ''}`;
    return `<button class="recl-tropa${t.id === elegida?.id ? ' elegida' : ''}${llena === 1 ? ' completa' : ''}" type="button" data-tropa="${e(t.id)}" title="${e(titulo)}" aria-label="${e(titulo)}">
      <span class="recl-tropa-icono">${iconoTropa(t.id, 32)}</span><span class="recl-tropa-nombre">${e(t.nombre)}</span>
      ${tuya ? `<span class="recl-tropa-cuenta">${llena === 1 ? '✓' : tuya.cantidad}</span><span class="obra-barra"><i style="width:${((llena ?? 0) * 100).toFixed(1)}%"></i></span>` : ''}
    </button>`;
  };
  const gente = pob ? (['pesants', 'artesanos', 'nobleza'] as const).map((k) => `<span class="obra-chip${k === origenElegida ? ' activa' : ''}" title="${k} libres">${ORIGEN_ICONO[k]} ${Math.floor(pob[k])}</span>`).join('') : '';
  return `<div class="obra-titulo"><span class="faction-kicker">Reclutamiento</span>${gente}${info}</div>
    ${elegida ? ficha(elegida, tropas, p, a, reside, nivelDe(elegida.edificio), e) : '<p class="mapa-lista-vacia">Aún no puedes reclutar ninguna tropa: hace falta la tecnología y el edificio militar de cada una.</p>'}
    ${porEdificio.map(([tipo, lista]) => `<div class="recl-grupo-cab">${iconoEdificio(tipo, 20)}<strong>${e(EDIFICIO_NOMBRE[tipo] ?? tipo)}</strong>${marcasNivel(nivelDe(tipo), nivelesMax(tipo))}</div>
      <div class="recl-rejilla">${lista.map(casilla).join('')}</div>`).join('')}`;
}

export function cablearReclutamiento(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar, repintar: () => void): void {
  raiz.querySelectorAll<HTMLButtonElement>('[data-tropa]').forEach((boton) =>
    boton.addEventListener('click', () => { tropaElegida = boton.dataset.tropa!; repintar(); })
  );
  raiz.querySelectorAll<HTMLButtonElement>('[data-reclutar]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const mensaje = await ejecutar('reclutarTropa', { asentamientoId: a.id, heroeId: p.heroeId, tropaId: boton.dataset.reclutar! });
      if (mensaje !== null) { boton.disabled = false; mostrarAviso(mensaje, true); }
    })
  );
}
