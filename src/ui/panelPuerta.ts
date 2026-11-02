// Subpestaña «Puerta» de Centro urbano (Doc 1.10.5 y 2.8): a quién se le cierra la plaza (`fijarPuerta`) y a qué jugadores concretos se veta (`vetarJugador`).
// La puerta la fija el Gobernador de la plaza o el Rey de su Facción (manda el último, no cuesta ni caduca); el veto, solo el Gobernador y nunca a un residente.
// Las plazas de tu Facción traen `puertaCerradaA` y `vetadosIds`; ausente = el cierre por defecto del balance (`PUERTA.cerradaAPorDefecto`).
import { puertaCerradaAPorDefecto } from '../apiCliente';
import type { GrupoPuerta } from '../tiposDominio';
import { ayuda } from './ayuda';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';
import { cablearAliados, htmlAliados } from './panelAliados';
import { mostrar as mostrarAviso } from './avisos';
import { invalidar, olvidarEdicion } from './repintado';

const GRUPOS: [GrupoPuerta, string, string, string][] = [
  ['neutrales', '🕊️', 'Neutrales', 'Ni aliados ni en guerra con la Facción'],
  ['aliados', '🤝', 'Aliados', 'Aliados y vasallos'],
  ['enemigos', '⚔️', 'Enemigos', 'En guerra con la Facción'],
  ['aedas', '📜', 'Aedas', 'Los cronistas viajeros'],
];

/** Lo que el Gobernador o el Rey llevan marcado sin fijar, por plaza (sobrevive a los repintados del sondeo). */
const borrador = new Map<string, Set<GrupoPuerta>>();

/**
 * Puerta, con aire de juego (2026-11-02): un portón con su estado (abierta, a medias o cerrada), una casilla por grupo con candado que se abre o
 * se cierra al pulsarla y «Fijar la puerta» cuando hay cambios; los vetados como fichas con ✕ y «Vetar» al lado del combo; al final, los aliados.
 */
function html(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e } = c;
  const esGobernador = c.cargo === 'gobernador' && c.resideAqui;
  const esRey = p.facciones.find((f) => f.id === a.faccionId)?.reyId === p.heroeId;
  const puede = esGobernador || esRey;
  const fijada = (a.puertaCerradaA ?? (puertaCerradaAPorDefecto() as GrupoPuerta[]));
  const marcada = puede ? borrador.get(a.id) ?? new Set(fijada) : new Set(fijada);
  const cambios = GRUPOS.some(([g]) => marcada.has(g) !== fijada.includes(g));
  const cerradas = fijada.length;
  const estado = cerradas === 0 ? 'abierta' : cerradas === GRUPOS.length ? 'cerrada' : 'entornada';
  const cab = `<div class="puerta-cab ${estado}">
      <span class="puerta-porton" aria-hidden="true">${cerradas === 0 ? '🚪' : '🔒'}</span>
      <span class="puerta-cab-cuerpo"><strong>Puerta de ${e(a.nombre ?? a.id)}</strong>
        <small>${cerradas === 0 ? 'Abierta a todos' : `Cerrada a ${cerradas} de ${GRUPOS.length}`} · ${a.puertaCerradaA ? 'fijada' : 'por defecto'}</small></span>
      <span class="obra-chip" title="Tu Facción y quien reside aquí entran siempre">🏠 los tuyos, siempre</span>
    </div>`;
  const casillas = `<div class="puerta-grupos">${GRUPOS.map(([g, icono, nombre, sub]) => {
    const cerrada = marcada.has(g);
    const cambiada = cerrada !== fijada.includes(g);
    return `<label class="puerta-grupo${cerrada ? ' cerrada' : ''}${cambiada ? ' cambiada' : ''}${puede ? '' : ' solo-ver'}" title="${e(`${nombre}: ${sub}`)}">
      <input type="checkbox" data-puerta-grupo="${g}"${cerrada ? ' checked' : ''}${puede ? '' : ' disabled'} />
      <span class="puerta-grupo-icono" aria-hidden="true">${icono}</span><strong>${nombre}</strong>
      <span class="puerta-candado" aria-hidden="true">${cerrada ? '🔒' : '🔓'}</span><small>${cerrada ? 'cerrada' : 'abierta'}</small></label>`;
  }).join('')}</div>`;
  const fijar = puede
    ? `<div class="puerta-pie">${cambios ? '<button class="puerta-deshacer" type="button" data-puerta-deshacer>Deshacer</button>' : ''}<button class="puerta-fijar" type="button" data-puerta-fijar${cambios ? '' : ' disabled title="Pulsa un grupo para abrirle o cerrarle la puerta"'}>⚑ Fijar la puerta</button></div>`
    : '<p class="asent-lado-nota">Solo el Gobernador de la plaza o el Rey de su Facción pueden fijar la puerta.</p>';

  const residentes = new Set([...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])]);
  const vetados = a.vetadosIds ?? [];
  const candidatos = [...new Set([...Object.keys(p.nombresDeCompaneros), ...p.heroesVisibles.map((h) => h.heroeId)])]
    .filter((id) => id !== p.heroeId && !residentes.has(id) && !vetados.includes(id));
  const fichas = vetados.length === 0 ? '<p class="mapa-lista-vacia">Nadie vetado.</p>'
    : `<div class="puerta-vetados">${vetados.map((id) => `<span class="puerta-vetado"><i aria-hidden="true">⛔</i>${e(nombreDeHeroe(p, id))}${esGobernador ? `<button type="button" data-vetar="${e(id)}" title="Levantar el veto" aria-label="Levantar el veto a ${e(nombreDeHeroe(p, id))}">✕</button>` : ''}</span>`).join('')}</div>`;
  const veto = `<div class="obra-titulo"><span class="faction-kicker">Vetados</span><span class="obra-chip">${vetados.length}</span></div>${fichas}
    ${!esGobernador ? '<p class="asent-lado-nota">Solo el Gobernador de la plaza veta a jugadores concretos.</p>'
      : candidatos.length ? `<div class="puerta-vetar"><select class="form-input" data-campo="vetado" aria-label="A quién vetar">${candidatos.map((id) => `<option value="${e(id)}">${e(nombreDeHeroe(p, id))}</option>`).join('')}</select><button class="puerta-vetar-boton" type="button" data-vetar-elegido>⛔ Vetar</button></div>`
        : '<p class="asent-lado-nota">No hay a quién vetar.</p>'}`;
  const info = ayuda('plaza:puerta', 'Tu Facción y quien reside aquí entran siempre. Sin ningún grupo cerrado, la plaza queda abierta a todos. Es el exilio (Doc 2.8): no caduca, y el Gobernador o el Rey pueden cambiarla cuando quieran.<br>Vetar a jugadores concretos es solo del Gobernador de la plaza (a un residente no se le veta): solo se veta a quien no reside aquí, y solo ves a los ciudadanos de tu Facción y a los héroes que tienes a la vista.');
  return `<div class="obra-titulo"><span class="faction-kicker">Puerta</span>${info}</div>${cab}${casillas}${fijar}${veto}${htmlAliados(c)}`;
}

function cablear(c: ContextoPlaza): void {
  const { cuerpo, ejecutar, asentamiento: a, proyeccion: p } = c;
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<boolean> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, { asentamientoId: a.id, heroeId: p.heroeId, ...params });
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
    return mensaje === null;
  };
  // Cada grupo se abre o se cierra en el borrador (y se repinta); «Fijar» lo manda todo de una vez.
  // Lo marcado vive en el borrador, no en las casillas (el repintado devuelve a cada casilla lo último que se tocó): por eso se olvida al deshacer y al fijar.
  const fijada = (): GrupoPuerta[] => a.puertaCerradaA ?? (puertaCerradaAPorDefecto() as GrupoPuerta[]);
  cuerpo.querySelectorAll<HTMLInputElement>('[data-puerta-grupo]').forEach((i) => i.addEventListener('change', () => {
    const marcada = new Set(borrador.get(a.id) ?? fijada());
    const g = i.dataset.puertaGrupo as GrupoPuerta;
    if (marcada.has(g)) marcada.delete(g); else marcada.add(g);
    borrador.set(a.id, marcada);
    c.refrescar();
  }));
  const olvidar = (): void => { borrador.delete(a.id); olvidarEdicion(cuerpo); };
  cuerpo.querySelector<HTMLButtonElement>('[data-puerta-deshacer]')?.addEventListener('click', () => { olvidar(); invalidar(cuerpo); c.refrescar(); });
  cuerpo.querySelector<HTMLButtonElement>('[data-puerta-fijar]')?.addEventListener('click', async (ev) => {
    const marcada = borrador.get(a.id) ?? new Set(fijada());
    const cerradaA = GRUPOS.map(([g]) => g).filter((g) => marcada.has(g));
    if (await lanzar(ev.currentTarget as HTMLButtonElement, 'fijarPuerta', { cerradaA })) olvidar();
  });
  cuerpo.querySelector<HTMLButtonElement>('[data-vetar-elegido]')?.addEventListener('click', (ev) => {
    const vetadoId = cuerpo.querySelector<HTMLSelectElement>('[data-campo="vetado"]')?.value;
    if (vetadoId) void lanzar(ev.currentTarget as HTMLButtonElement, 'vetarJugador', { vetadoId, vetar: true });
  });
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-vetar]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'vetarJugador', { vetadoId: b.dataset.vetar, vetar: false })));
  cablearAliados(c);
}

export const SUBPESTANA_PUERTA: SubpestanaPlaza = { id: 'puerta', etiqueta: 'Puerta', html, cablear };
