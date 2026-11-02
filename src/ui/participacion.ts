// Participación (mecánica 54): los puntos que gana cada héroe en una plaza al defenderla (asedio, sus pueblos, sus caravanas) y al ganar
// batallas residiendo en ella. Viaja en `Asentamiento.participacion` (desde dentro) y, sumada por miembro, en `Faccion.miembros` (la propia).
// Aquí, la lista de residentes de la plaza con su cargo y sus puntos, y la de miembros de la Facción con su residencia.
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, Faccion } from '../tiposDominio';
import { ayuda } from './ayuda';
import { nombreDeHeroe } from './nombres';
import { chapaDeMarca } from './mercenarios';

type Escapar = (s: string) => string;

const CARGO_NOMBRE: Record<string, string> = {
  rey: 'Rey', embajador: 'Embajador', gobernador: 'Gobernador', maestroObras: 'Maestro de Obras', maestroCaravanas: 'Maestro de Caravanas', tesorero: 'Tesorero', general: 'General', sacerdote: 'Sacerdote',
};
const nombreCargo = (c: string): string => CARGO_NOMBRE[c] ?? c;

/** Los cargos de un héroe en la plaza (los locales) y en su Facción (Rey, Embajador). */
function cargosEnPlaza(a: Asentamiento, f: Faccion | undefined, heroeId: string): string[] {
  const c = a.cargos;
  const locales: [string, string | null | undefined][] = [
    ['gobernador', c?.gobernadorId], ['maestroObras', c?.maestroObrasId], ['tesorero', c?.tesoreroId], ['maestroCaravanas', c?.maestroCaravanasId], ['general', c?.generalId], ['sacerdote', c?.sacerdoteId],
  ];
  return [
    ...(f?.reyId === heroeId ? ['rey'] : []),
    ...(f?.embajadorId === heroeId ? ['embajador'] : []),
    ...locales.filter(([, id]) => id === heroeId).map(([k]) => k),
  ];
}

/** El emblema de cada cargo (sillas de «Cargos» y el ranking de residentes). */
export const CARGO_EMBLEMA: Record<string, string> = {
  rey: '👑', embajador: '📜', gobernador: '🏛️', maestroObras: '🔨', maestroCaravanas: '🐂', tesorero: '💰', general: '⚔️', sacerdote: '🔥',
};

/** Residentes de la plaza como un ranking: puesto (medalla a los tres primeros), nombre con los emblemas de sus cargos, barra de sus puntos contra
 * los del primero y la cifra. Debajo, en otro tono, quien ha sumado puntos aquí sin residir. */
export function htmlResidentesPlaza(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const f = p.facciones.find((x) => x.id === a.faccionId);
  const puntos = a.participacion ?? {};
  const residentes = new Set([
    ...(a.heroesFundadoresIds ?? []),
    ...(a.casasCompradas ?? []),
    ...(f?.miembros ?? []).filter((m) => m.residenciaId === a.id).map((m) => m.heroeId),
  ]);
  const orden = (ids: Iterable<string>) => [...ids].sort((x, y) => (puntos[y] ?? 0) - (puntos[x] ?? 0) || nombreDeHeroe(p, x).localeCompare(nombreDeHeroe(p, y)));
  const maximo = Math.max(1, ...Object.values(puntos));
  const MEDALLA = ['🥇', '🥈', '🥉'];
  const fila = (id: string, i: number, visita: boolean) => {
    const cargos = cargosEnPlaza(a, f, id);
    const emblemas = cargos.map((c) => `<span title="${e(nombreCargo(c))}">${CARGO_EMBLEMA[c] ?? '•'}</span>`).join('');
    const pts = puntos[id] ?? 0;
    const puesto = !visita && pts > 0 && i < 3 ? MEDALLA[i] : String(i + 1);
    return `<li class="ranking-fila${id === p.heroeId ? ' yo' : ''}${visita ? ' visita' : ''}" title="${e(`${nombreDeHeroe(p, id)}${cargos.length ? ` · ${cargos.map(nombreCargo).join(', ')}` : ''} · ${pts} puntos`)}">
      <span class="ranking-puesto">${visita ? '🧳' : puesto}</span>
      <span class="ranking-nombre"><span>${e(nombreDeHeroe(p, id))}</span>${emblemas ? `<span class="ranking-cargos">${emblemas}</span>` : ''}</span>
      <span class="ranking-barra"><i style="width:${((pts / maximo) * 100).toFixed(1)}%"></i></span>
      <strong>${pts}</strong>
    </li>`;
  };
  const visitantes = orden(Object.keys(puntos).filter((id) => !residentes.has(id) && (puntos[id] ?? 0) > 0));
  return `<section class="participacion plaza">
    <div class="obra-titulo"><span class="faction-kicker">Residentes y participación</span><span class="obra-chip">🏠 ${residentes.size}</span>${ayuda('plaza:participacion', 'Puntos que gana cada héroe en esta plaza: al defenderla en un asedio, al defender sus pueblos, aldeas o caravanas, y al ganar una batalla residiendo aquí. Lo ganado en una plaza se queda en ella. Con 🧳, quien ha sumado aquí sin residir.')}</div>
    ${residentes.size ? `<ol class="ranking">${orden(residentes).map((id, i) => fila(id, i, false)).join('')}</ol>` : '<p class="mapa-lista-vacia">Nadie reside aquí.</p>'}
    ${visitantes.length ? `<ol class="ranking">${visitantes.map((id, i) => fila(id, i, true)).join('')}</ol>` : ''}
  </section>`;
}

/** Miembros de tu Facción con sus cargos, dónde residen y su participación sumada. */
export function htmlMiembrosFaccion(p: ProyeccionJugador, f: Faccion, e: Escapar): string {
  if (!f.miembros?.length) return '';
  const residencia = (id?: string): string => {
    if (!id) return 'sin residencia';
    if (id.startsWith('camp-')) return 'campamento de mercenarios';
    const a = [...p.asentamientos, ...(p.asentamientosAvistados ?? [])].find((x) => x.id === id) as { nombre?: string } | undefined;
    return a?.nombre || id;
  };
  const cargo = (c: string): string => {
    const [k, donde] = c.split('@');
    return donde ? `${nombreCargo(k!)} de ${residencia(donde)}` : nombreCargo(k!);
  };
  const miembros = [...f.miembros].sort((x, y) => y.participacion - x.participacion);
  return `<section class="participacion">
    <h3>Miembros${ayuda('faccion:miembros', 'Cada ciudadano con sus cargos, dónde reside y la suma de su participación en las plazas que son hoy de la Facción.')}</h3>
    <ul class="participacion-lista">${miembros.map((m) => `<li class="${m.heroeId === p.heroeId ? 'participacion-yo' : ''}"><span>${e(nombreDeHeroe(p, m.heroeId))} ${chapaDeMarca(m.marca)}${m.cargos.length ? ` <small>· ${e(m.cargos.map(cargo).join(', '))}</small>` : ''}<small class="participacion-donde">${e(residencia(m.residenciaId))}</small></span><strong>${m.participacion}</strong></li>`).join('')}</ul>
  </section>`;
}
