// Subpestaña «Residencia» de Centro urbano: dejar tu casa sin dejar la Facción (`dejarResidencia`, Doc 2.5) y, si eres el Rey, designar esta plaza capital (`designarCapital`, Doc 2.2).
// Va al pie del Resumen, en tarjetas (2026-11-02): sin residir aquí, la tarjeta ofrece «Hacerla mi base» (`cambiarResidencia`, la cablea `main.ts`).
import { diasDeEnfriamientoDeCapital, diasDeEnfriamientoDeResidencia } from '../apiCliente';
import { ayuda } from './ayuda';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { confirmar } from './dialogo';
import { mostrar as mostrarAviso } from './avisos';

const DIA_MS = 86_400_000;
const CARGO_NOMBRE: Record<string, string> = { gobernadorId: 'Gobernador', maestroObrasId: 'Maestro de Obras', maestroCaravanasId: 'Maestro de Caravanas', tesoreroId: 'Tesorero', generalId: 'General', sacerdoteId: 'Sacerdote' };

/** El enfriamiento de residencia sale del balance (`CIUDADANIA.cooldownCambioResidenciaDias`); mientras no llegue, el aviso es genérico. */
function esperaParaMudarse(c: ContextoPlaza): string {
  const dias = diasDeEnfriamientoDeResidencia(c.refrescar);
  return dias === undefined ? 'hay un enfriamiento antes de poder mudarte de nuevo' : `tendrás que esperar ${dias} días de mundo antes de volver a mudarte`;
}

/** Una tarjeta de la Residencia: emblema, título, una línea debajo y, si hay, el botón. */
const tarjeta = (clase: string, icono: string, titulo: string, linea: string, boton = ''): string =>
  `<div class="resid-tarjeta ${clase}"><span class="resid-icono" aria-hidden="true">${icono}</span><span class="resid-cuerpo"><strong>${titulo}</strong><small>${linea}</small></span>${boton}</div>`;

function seccionResidencia(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a } = c;
  if (!c.resideAqui) {
    // Mudar tu base a esta plaza (`cambiarResidencia`): lo cablea `main.ts` (`#btn-mudarme`), con su confirmación.
    const puedeMudarme = Boolean(p.faccionId) && a.faccionId === p.faccionId;
    return tarjeta('fuera', '🏕️', 'No resides aquí', puedeMudarme ? 'Puedes hacer de esta plaza tu base: tu campamento se muda contigo.' : 'Esta plaza no es de tu Facción.',
      puedeMudarme ? '<button id="btn-mudarme" class="resid-boton" type="button" title="Hacer de esta plaza tu base: tu campamento se muda contigo">🏠 Hacerla mi base</button>' : '');
  }
  const cargos = Object.entries(a.cargos ?? {}).filter(([, id]) => id === p.heroeId).map(([k]) => CARGO_NOMBRE[k] ?? k);
  return tarjeta('dentro', '🏠', `Resides aquí${ayuda('plaza:residencia', `Dejar la residencia libera tu vivienda y vacía tus cargos locales, suelta tu guarnición y te lleva al campamento de mercenarios más cercano. Sigues en tu Facción. No hay reembolso y ${esperaParaMudarse(c)}.`)}`,
    cargos.length ? cargos.join(' · ') : 'Sin cargo en la plaza',
    '<button class="resid-boton peligro" type="button" data-dejar-residencia title="Dejar tu residencia aquí (sigues en tu Facción)">Dejar</button>');
}

function seccionCapital(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a } = c;
  const faccion = p.facciones.find((f) => f.id === a.faccionId);
  const esCapital = a.capitalDeFaccionId === a.faccionId;
  if (esCapital) return tarjeta('capital', '👑', 'Capital de la Facción', 'Aquí se adopta la tecnología; es el centro del mantenimiento por distancia.');
  if (!faccion || faccion.reyId !== p.heroeId) return tarjeta('apagada', '👑', 'No es la capital', 'La capital la designa el Rey, entre las plazas con un Palacio activo.');
  const libreEn = faccion.capitalDesignadaEn !== undefined ? faccion.capitalDesignadaEn + diasDeEnfriamientoDeCapital() * DIA_MS : 0;
  let bloqueo = '';
  if (!a.edificios.some((e) => e.tipo === 'palacio' && e.estado === 'activo')) bloqueo = 'Necesita un Palacio activo.';
  else if (p.instante < libreEn) bloqueo = `La capital se trasladó hace poco: faltan unos ${Math.ceil((libreEn - p.instante) / DIA_MS)} días de mundo.`;
  return tarjeta(bloqueo ? 'apagada' : 'rey', '👑', `Puedes hacerla capital${ayuda('plaza:capital', `Es donde se adopta tecnología y el centro del mantenimiento por distancia. No cuesta recursos, pero trasladarla tiene un enfriamiento de ${diasDeEnfriamientoDeCapital()} días de mundo.`)}`,
    bloqueo || 'Como Rey, sin coste; luego hay un enfriamiento para moverla.',
    `<button class="resid-boton" type="button" data-designar-capital${bloqueo ? ` disabled title="${bloqueo}"` : ''}>Designar</button>`);
}

function html(c: ContextoPlaza): string {
  return `<div class="resid-tarjetas">${seccionResidencia(c)}${seccionCapital(c)}</div>`;
}

function cablear(c: ContextoPlaza): void {
  const { cuerpo, ejecutar, asentamiento: a, proyeccion: p } = c;
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    boton.disabled = false;
    if (mensaje) mostrarAviso(mensaje, true);
  };
  cuerpo.querySelector<HTMLButtonElement>('[data-dejar-residencia]')?.addEventListener('click', (ev) => {
    const boton = ev.currentTarget as HTMLButtonElement;
    void confirmar(`Pierdes tu vivienda en ${a.nombre ?? a.id}, tus cargos locales y tu guarnición aquí, y pasas a un campamento de mercenarios. Sigues en tu Facción.`, { titulo: '¿Dejar tu residencia?', aceptar: 'Dejar la residencia', peligro: true })
      .then((ok) => { if (ok) void lanzar(boton, 'dejarResidencia', { heroeId: p.heroeId }); });
  });
  cuerpo.querySelector<HTMLButtonElement>('[data-designar-capital]')?.addEventListener('click', (ev) => void lanzar(ev.currentTarget as HTMLButtonElement, 'designarCapital', { faccionId: a.faccionId, asentamientoId: a.id }));
}

export const SUBPESTANA_RESIDENCIA: SubpestanaPlaza = { id: 'residencia', etiqueta: 'Residencia', html, cablear };
