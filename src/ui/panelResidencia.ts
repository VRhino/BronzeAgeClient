// Subpestaña «Residencia» de Centro urbano: dejar tu casa sin dejar la Facción (`dejarResidencia`, Doc 2.5) y, si eres el Rey, designar esta plaza capital (`designarCapital`, Doc 2.2).
// Mudar tu base a esta plaza ya está en Resumen («Hacer de esta plaza mi base»): aquí no se duplica.
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';

const DIA_MS = 86_400_000;
// Copiado a mano de `CAPITAL.cooldownDias` (backend, placeholder): el servidor sigue siendo quien rechaza.
const COOLDOWN_CAPITAL_DIAS = 14;
const CARGO_NOMBRE: Record<string, string> = { gobernadorId: 'Gobernador', maestroObrasId: 'Maestro de Obras', tesoreroId: 'Tesorero', generalId: 'General', sacerdoteId: 'Sacerdote' };

function seccionResidencia(c: ContextoPlaza): string {
  if (!c.resideAqui) return '<p class="asent-lado-nota">No resides en esta plaza: no hay casa que dejar aquí. Para vivir en ella usa «Hacer de esta plaza mi base» en Resumen.</p>';
  const cargos = Object.entries(c.asentamiento.cargos ?? {}).filter(([, id]) => id === c.proyeccion.heroeId).map(([k]) => CARGO_NOMBRE[k] ?? k);
  return `<p class="asent-lado-nota">Resides aquí. Dejar la residencia libera tu vivienda y vacía tus cargos locales${cargos.length ? ` (${cargos.join(', ')})` : ''}, suelta tu guarnición y te lleva al campamento de mercenarios más cercano. Sigues en tu Facción. No hay reembolso y hay un enfriamiento antes de poder mudarte de nuevo.</p>
    <button class="btn-secondary" type="button" data-dejar-residencia>Dejar mi residencia</button>`;
}

function seccionCapital(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a } = c;
  const faccion = p.facciones.find((f) => f.id === a.faccionId);
  const esCapital = a.capitalDeFaccionId === a.faccionId;
  const estado = esCapital ? '<p class="asent-lado-nota">Esta plaza es la capital designada de la Facción.</p>' : '';
  if (!faccion || faccion.reyId !== p.heroeId) return `${estado}<p class="asent-lado-nota">La capital la designa el Rey de la Facción, entre las plazas con un Palacio activo.</p>`;

  const libreEn = faccion.capitalDesignadaEn !== undefined ? faccion.capitalDesignadaEn + COOLDOWN_CAPITAL_DIAS * DIA_MS : 0;
  let bloqueo = '';
  if (esCapital) bloqueo = 'Ya es la capital.';
  else if (!a.edificios.some((e) => e.tipo === 'palacio' && e.estado === 'activo')) bloqueo = 'Necesita un Palacio activo.';
  else if (p.instante < libreEn) bloqueo = `La capital se trasladó hace poco: faltan unos ${Math.ceil((libreEn - p.instante) / DIA_MS)} días de mundo.`;
  return `${estado}<p class="asent-lado-nota">Como Rey puedes hacer de esta plaza la capital: es donde se adopta tecnología y el centro del mantenimiento por distancia. No cuesta recursos, pero trasladarla tiene un enfriamiento de ${COOLDOWN_CAPITAL_DIAS} días de mundo.</p>
    <button class="btn-primary" type="button" data-designar-capital${bloqueo ? ' disabled' : ''}>Designar esta plaza capital</button>
    ${bloqueo ? `<small class="asent-lado-nota">${bloqueo}</small>` : ''}`;
}

function html(c: ContextoPlaza): string {
  return `<span class="faction-kicker">Residencia</span>${seccionResidencia(c)}<span class="faction-kicker">Capital</span>${seccionCapital(c)}<p class="faction-error" data-campo="error-residencia" role="alert"></p>`;
}

function cablear(c: ContextoPlaza): void {
  const { cuerpo, ejecutar, asentamiento: a, proyeccion: p } = c;
  const error = cuerpo.querySelector<HTMLElement>('[data-campo="error-residencia"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  cuerpo.querySelector<HTMLButtonElement>('[data-dejar-residencia]')?.addEventListener('click', (ev) => {
    if (!window.confirm(`¿Dejar tu residencia en ${a.nombre ?? a.id}? Pierdes tu vivienda, tus cargos locales y tu guarnición aquí, y pasas a un campamento de mercenarios. Sigues en tu Facción.`)) return;
    void lanzar(ev.currentTarget as HTMLButtonElement, 'dejarResidencia', { heroeId: p.heroeId });
  });
  cuerpo.querySelector<HTMLButtonElement>('[data-designar-capital]')?.addEventListener('click', (ev) => void lanzar(ev.currentTarget as HTMLButtonElement, 'designarCapital', { faccionId: a.faccionId, asentamientoId: a.id }));
}

export const SUBPESTANA_RESIDENCIA: SubpestanaPlaza = { id: 'residencia', etiqueta: 'Residencia', html, cablear };
