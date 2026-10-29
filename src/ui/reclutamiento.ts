// Pestaña «RECLUTAMIENTO» de la plaza: reclutar o reponer tropa con `reclutarTropa { asentamientoId, heroeId, tropaId }`. Todos los edificios militares juntos.
// Cada tropa es un botón con su icono, agrupadas por edificio. Solo se ENSEÑA lo que la Facción puede formar ya (tecnología, edificio y su nivel): lo demás se esconde. La elegida
// se abre en una ficha encima de la rejilla, que dice lo que depende del momento (residencia, la escuadra que ya tienes, hombres libres, equipo) y lleva el botón. Un héroe tiene como mucho UNA escuadra por tropa en toda la partida:
// si ya la tiene, reclutar la REPONE y solo donde está. El oro por soldado sale del balance como en el motor (escalón + caballos; la tropa del Centro Urbano no paga; «Leva Forzosa» solo toca el equipo); si algo falla, el rechazo del servidor se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import { bloqueDeDatos, oroPorSoldado, tropasReclutables, type TropaReclutable } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { iconoTropa } from './iconosTropa';
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

/** La ficha de la tropa elegida: datos, coste de lo que falta y el botón de reclutar o reponer. */
function ficha(t: TropaReclutable, p: ProyeccionJugador, a: Asentamiento, reside: boolean, nivel: number, e: Escapar): string {
  const existente = p.heroe.escuadrones.find((s) => s.tropaId === t.id && !s.prestada);
  const falta = t.unidadesPorDefecto - (existente?.cantidad ?? 0);
  const origen = ORIGEN(t.escalon);
  const libres = a.poblacion?.[origen] ?? 0;
  const almacen = a.almacen ?? {};
  const oroUnidad = oroPorSoldado(t) ?? 0;
  const coste = Object.entries(oroUnidad > 0 ? { ...t.costoEquipo, oro: (t.costoEquipo['oro'] ?? 0) + oroUnidad } : t.costoEquipo)
    .map(([r, n]) => {
      const total = Math.ceil((n ?? 0) * Math.max(falta, 0));
      const hay = Math.floor(almacen[r]?.cantidad ?? 0);
      return `<span class="recl-coste${hay < total ? ' falta' : ''}" title="Hay ${hay} en el almacén">${RECURSO_ICONO[r] ?? '📦'} ${total} ${e(RECURSO_NOMBRE[r] ?? r)}</span>`;
    })
    .join('');
  const liderazgo = bloqueDeDatos<{ costePorEscalon?: Record<string, number> }>('LIDERAZGO')?.costePorEscalon?.[String(t.escalon)];

  const bloqueo = falta <= 0 ? 'Escuadra al completo.'
    : existente && existente.contenedor.tipo !== 'campamento' ? 'Tu escuadra está fuera del campamento: solo se repone donde está.'
    : !reside ? 'Solo quien reside en esta plaza recluta aquí.' : '';
  const dato = (etiqueta: string, valor: string | number | undefined): string => (valor === undefined ? '' : `<span><small>${etiqueta}</small><b>${valor}</b></span>`);
  return `<div class="recl-ficha">
    <div class="recl-ficha-icono">${iconoTropa(t.id, 56)}</div>
    <div class="recl-ficha-cuerpo">
      <div class="recl-ficha-titulo"><strong>${e(t.nombre)}</strong> <span class="recl-esc" title="Escalón de élite">Esc. ${t.escalon}</span></div>
      <small class="recl-ficha-sub">${e(EDIFICIO_NOMBRE[t.edificio] ?? t.edificio)} nivel ${t.nivelRequerido}${nivel ? ` (tienes ${nivel})` : ''}</small>
      <div class="recl-datos">
        ${dato('Hombres', t.unidadesPorDefecto)}${dato('Poder', t.poderBase)}${dato('Velocidad', t.velocidad)}${dato('Liderazgo', liderazgo)}${dato(`Salen de ${origen}`, `${Math.floor(libres)} libres`)}
      </div>
      <div class="recl-costes">${coste || '<span class="recl-coste">sin coste de equipo</span>'}</div>
      ${existente ? `<small class="recl-tienes">Tienes ${existente.cantidad}/${t.unidadesPorDefecto}</small>` : ''}
      ${bloqueo ? `<small class="asent-lado-nota">${bloqueo}</small>` : ''}
      <button class="btn-primary recl-boton" type="button" data-reclutar="${e(t.id)}"${bloqueo ? ' disabled' : ''}>${existente ? `Reponer +${Math.max(falta, 0)}` : 'Reclutar'}</button>
    </div>
  </div>`;
}

/** La tropa abierta en la ficha; se queda al repintar la pestaña. */
let tropaElegida: string | null = null;

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
  const info = ayuda('plaza:reclutamiento', 'Los militares de la plaza, juntos. Elige una tropa para ver su ficha. Reclutas con el equipo del almacén; si ya tienes una escuadra de esa tropa, solo la repones hasta completarla. Aquí solo salen las tropas que tu Facción ya puede formar: otras llegan con más tecnología o edificios militares mejores.<br>El servidor no deja reclutar si dejaría la producción sin brazos.');
  const boton = (t: TropaReclutable): string => {
    const cantidad = p.heroe.escuadrones.find((s) => s.tropaId === t.id && !s.prestada)?.cantidad;
    const titulo = `${t.nombre} · Esc. ${t.escalon}`;
    return `<button class="asent-construir recl-tropa${t.id === elegida?.id ? ' elegida' : ''}" type="button" data-tropa="${e(t.id)}" title="${e(titulo)}" aria-label="${e(titulo)}">${iconoTropa(t.id, 30)}${cantidad !== undefined ? `<span class="recl-tropa-cuenta">${cantidad}</span>` : ''}</button>`;
  };
  return `<span class="faction-kicker">Reclutamiento ${info}</span>
    ${pob ? `<p class="asent-lado-nota">Gente libre: ${Math.floor(pob.pesants)} pesants · ${Math.floor(pob.artesanos)} artesanos · ${Math.floor(pob.nobleza)} nobleza.</p>` : ''}
    ${elegida ? ficha(elegida, p, a, reside, nivelDe(elegida.edificio), e) : '<p class="mapa-lista-vacia">Aún no puedes reclutar ninguna tropa: hace falta la tecnología y el edificio militar de cada una.</p>'}
    <p class="faction-error" data-campo="error-reclutar" role="alert"></p>
    ${porEdificio.map(([tipo, lista]) => `<div class="asent-construir-cab"><strong class="heroe-sub">${e(EDIFICIO_NOMBRE[tipo] ?? tipo)} · nivel ${nivelDe(tipo)}</strong></div><div class="asent-construir-rejilla">${lista.map(boton).join('')}</div>`).join('')}`;
}

export function cablearReclutamiento(raiz: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar, repintar: () => void): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-reclutar"]');
  raiz.querySelectorAll<HTMLButtonElement>('[data-tropa]').forEach((boton) =>
    boton.addEventListener('click', () => { tropaElegida = boton.dataset.tropa!; repintar(); })
  );
  raiz.querySelectorAll<HTMLButtonElement>('[data-reclutar]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const mensaje = await ejecutar('reclutarTropa', { asentamientoId: a.id, heroeId: p.heroeId, tropaId: boton.dataset.reclutar! });
      if (mensaje !== null) { boton.disabled = false; if (error) error.textContent = mensaje; }
    })
  );
}
