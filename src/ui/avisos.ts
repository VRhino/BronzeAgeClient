// Avisos de eventos del backend que le tocan al jugador (cursor `GET .../eventos?desde=`): hoy, que alguien mire la defensa de una plaza suya,
// una columna suya, una caravana, o pida el plano de una plaza (intel de la taberna, Doc 5.12.10). Un toast global, visible en cualquier pantalla.
import { consultarEventos } from '../apiCliente';

/** Los eventos de «alguien te ha mirado»: el backend los emite sin decir quién. */
const CODIGOS_DE_AVISO = new Set(['asentamiento.observado', 'columna.observada', 'caravana.observada', 'asentamiento.informe_pedido']);

let ultimaVersion: number | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;

function mostrar(texto: string): void {
  let el = document.querySelector<HTMLElement>('.aviso-global');
  if (!el) {
    el = document.createElement('div');
    el.className = 'aviso-global';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el!.hidden = true; }, 8000);
}

/** Olvida el cursor (al cambiar de partida o cerrar sesión): el siguiente refresco vuelve a fijarlo sin avisar de lo viejo. */
export function reiniciarAvisos(): void {
  ultimaVersion = null;
}

/** Tras cada proyección: la primera vez solo fija el cursor en su `version`; después pide lo nuevo y avisa de lo que toque. */
export async function avisarDeEventos(gameId: string, version: number): Promise<void> {
  if (ultimaVersion === null) {
    ultimaVersion = version;
    return;
  }
  if (version <= ultimaVersion) return;
  const desde = ultimaVersion;
  ultimaVersion = version;
  try {
    const eventos = await consultarEventos(gameId, desde);
    for (const e of eventos) if (CODIGOS_DE_AVISO.has(e.codigo)) mostrar(e.mensaje);
  } catch {
    // Un aviso perdido no es un error del juego: el cursor ya avanzó y la proyección sigue siendo la verdad.
  }
}
