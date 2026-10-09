// Subpestaña «Puerta» de Centro urbano (Doc 1.10.5 y 2.8): a quién se le cierra la plaza (`fijarPuerta`) y a qué jugadores concretos se veta (`vetarJugador`).
// La puerta la fija el Gobernador de la plaza o el Rey de su Facción (manda el último, no cuesta ni caduca); el veto, solo el Gobernador y nunca a un residente.
// Las plazas de tu Facción traen `puertaCerradaA` y `vetadosIds`; ausente = el cierre por defecto (neutrales y enemigos), copiado a mano de `PUERTA.cerradaAPorDefecto`.
import type { GrupoPuerta } from '../tiposDominio';
import { ayuda } from './ayuda';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { nombreDeHeroe } from './nombres';

const GRUPOS: [GrupoPuerta, string][] = [
  ['neutrales', 'Neutrales (ni aliados ni en guerra con la Facción)'],
  ['aliados', 'Aliados y vasallos'],
  ['enemigos', 'Enemigos (en guerra)'],
  ['aedas', 'Aedas (los cronistas viajeros)'],
];
const CERRADA_POR_DEFECTO: GrupoPuerta[] = ['neutrales', 'enemigos'];

function html(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e } = c;
  const esGobernador = c.cargo === 'gobernador' && c.resideAqui;
  const esRey = p.facciones.find((f) => f.id === a.faccionId)?.reyId === p.heroeId;
  const cerradaA = a.puertaCerradaA ?? CERRADA_POR_DEFECTO;
  const resumen = `<p class="asent-lado-nota">Puerta ${a.puertaCerradaA ? 'fijada' : 'por defecto'}: ${cerradaA.length ? `cerrada a ${e(cerradaA.join(', '))}` : 'abierta a todos'}.</p>`;

  const fijar = esGobernador || esRey
    ? `<div class="mapa-lista">${GRUPOS.map(([g, t]) => `<label class="asent-toggle"><input type="checkbox" data-puerta-grupo="${g}"${cerradaA.includes(g) ? ' checked' : ''} /> Cerrar a ${e(t)}</label>`).join('')}</div>
       <button class="btn-primary" type="button" data-puerta-fijar>Fijar la puerta</button>`
    : '<p class="asent-lado-nota">Solo el Gobernador de la plaza o el Rey de su Facción pueden fijar la puerta.</p>';

  const residentes = new Set([...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])]);
  const vetados = a.vetadosIds ?? [];
  const candidatos = [...new Set([...Object.keys(p.nombresDeCompaneros), ...p.heroesVisibles.map((h) => h.heroeId)])]
    .filter((id) => id !== p.heroeId && !residentes.has(id) && !vetados.includes(id));
  const veto = esGobernador
    ? `<span class="faction-kicker">Vetos</span>
       ${vetados.length ? `<div class="mapa-lista">${vetados.map((id) => `<div class="mapa-lista-item"><span>${e(nombreDeHeroe(p, id))}</span><button class="btn-secondary" type="button" data-vetar="${e(id)}">Levantar veto</button></div>`).join('')}</div>` : '<p class="mapa-lista-vacia">Nadie vetado.</p>'}
       ${candidatos.length ? `<div class="mercado-acciones"><select class="form-input" data-campo="vetado">${candidatos.map((id) => `<option value="${e(id)}">${e(nombreDeHeroe(p, id))}</option>`).join('')}</select><button class="btn-secondary" type="button" data-vetar-elegido>Vetar</button></div>` : '<p class="asent-lado-nota">No hay a quién vetar.</p>'}`
    : `<p class="asent-lado-nota">Solo el Gobernador de la plaza veta a jugadores concretos.${vetados.length ? ` Vetados: ${vetados.map((id) => e(nombreDeHeroe(p, id))).join(', ')}.` : ''}</p>`;
  const info = ayuda('plaza:puerta', 'Tu Facción y quien reside aquí entran siempre. Sin ninguna casilla, la plaza queda abierta a todos. Es el exilio (Doc 2.8): no caduca, y el Gobernador o el Rey pueden cambiarla cuando quieran.<br>Vetar a jugadores concretos es solo del Gobernador de la plaza (a un residente no se le veta): solo se veta a quien no reside aquí, y solo ves a los ciudadanos de tu Facción y a los héroes que tienes a la vista.');
  return `<span class="faction-kicker">Puerta de ${e(a.nombre ?? a.id)} ${info}</span>${resumen}${fijar}${veto}<p class="faction-error" data-campo="error-puerta" role="alert"></p>`;
}

function cablear(c: ContextoPlaza): void {
  const { cuerpo, ejecutar, asentamiento: a, proyeccion: p } = c;
  const error = cuerpo.querySelector<HTMLElement>('[data-campo="error-puerta"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, { asentamientoId: a.id, heroeId: p.heroeId, ...params });
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  cuerpo.querySelector<HTMLButtonElement>('[data-puerta-fijar]')?.addEventListener('click', (ev) => {
    const cerradaA = Array.from(cuerpo.querySelectorAll<HTMLInputElement>('[data-puerta-grupo]')).filter((i) => i.checked).map((i) => i.dataset.puertaGrupo!);
    void lanzar(ev.currentTarget as HTMLButtonElement, 'fijarPuerta', { cerradaA });
  });
  cuerpo.querySelector<HTMLButtonElement>('[data-vetar-elegido]')?.addEventListener('click', (ev) => {
    const vetadoId = cuerpo.querySelector<HTMLSelectElement>('[data-campo="vetado"]')?.value;
    if (vetadoId) void lanzar(ev.currentTarget as HTMLButtonElement, 'vetarJugador', { vetadoId, vetar: true });
  });
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-vetar]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'vetarJugador', { vetadoId: b.dataset.vetar, vetar: false })));
}

export const SUBPESTANA_PUERTA: SubpestanaPlaza = { id: 'puerta', etiqueta: 'Puerta', html, cablear };
