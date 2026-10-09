// «Salir» de una plaza donde NO resides (`salirDeAsentamiento`, Doc 1.10.3): retomas la columna que dejaste aparcada a la puerta, tal cual, sin pantalla de equipamiento.
// De tu residencia se sale con `salirAlMundo` (tropa y carga a elegir). El servidor valida (p. ej. si ya no tienes columna) y su rechazo se enseña tal cual.
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import type { Ejecutar } from './panelCarro';

export function htmlSalidaDePlazaAjena(p: ProyeccionJugador, a: Asentamiento, escapar: (v: string) => string): string {
  const columna = p.ejercitos.find((e) => e.participantes.some((x) => x.heroeId === p.heroeId));
  const carga = Object.values(columna?.suministro ?? {}).reduce((s, n) => s + n, 0);
  return `<span class="faction-kicker">Salir de ${escapar(a.nombre ?? a.id)}</span>
    <p class="asent-lado-nota">No resides aquí. Tu columna: ${columna ? `${carga} de carga` : 'no se ve ninguna columna'}.${ayuda('plaza:salir-ajena', 'Al entrar, tu columna se quedó aparcada a la puerta. Salir la retoma tal cual la dejaste, con su tropa y su carro; no hay nada que elegir. Para equipar tropa y carga hay que salir desde tu propia residencia.')}</p>
    <button class="btn-primary" type="button" data-salir-ajena>Salir y retomar mi columna</button>
    <p class="faction-error" data-campo="error-salida" role="alert"></p>`;
}

export function cablearSalidaDePlazaAjena(panel: HTMLElement, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar): void {
  panel.querySelector<HTMLButtonElement>('[data-salir-ajena]')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const mensaje = await ejecutar('salirDeAsentamiento', { asentamientoId: a.id, heroeId: p.heroeId });
    boton.disabled = false; // si salió bien, el router lleva al mapa
    const error = panel.querySelector<HTMLElement>('[data-campo="error-salida"]');
    if (error) error.textContent = mensaje ?? '';
  });
}
