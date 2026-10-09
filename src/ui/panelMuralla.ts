// Subpestaña «Muralla» de Centro urbano: comprometer, ampliar, mejorar y abandonar recintos (`comprometerRecinto`, `mejorarRecinto`, `abandonarRecinto`).
// El HTML es el de `renderPestanaMuralla` (compartido con `#/legacy`); aquí solo se cablea con `ctx.ejecutar` y se desactiva lo que el servidor rechazaría seguro
// (no residir en la plaza, o nivel de asentamiento por debajo del mínimo para trazar el primer recinto) diciendo por qué.
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { NIVEL_MINIMO_MURALLA, renderPestanaMuralla } from './pestanaMuralla';

function html(c: ContextoPlaza): string {
  const { asentamiento: a } = c;
  const nivel = a.nivelActual ?? a.nivel;
  let h = renderPestanaMuralla(a, c.proyeccion, c.escapar);
  const motivos: string[] = [];
  if (!c.resideAqui) motivos.push('Solo quien reside en esta plaza gestiona su muralla.');
  if (nivel < NIVEL_MINIMO_MURALLA && !(a.recintos ?? []).length) motivos.push(`Trazar una muralla exige una plaza de nivel ${NIVEL_MINIMO_MURALLA} (la tuya es de nivel ${nivel}).`);
  if (motivos.length) {
    // Todos los botones del panel son acciones de muralla.
    h = h.replace(/<button /g, '<button disabled ').replace('<p id="wall-error"', `<p class="asent-lado-nota">${c.escapar(motivos.join(' '))}</p><p id="wall-error"`);
  }
  return h;
}

function cablear(c: ContextoPlaza): void {
  const { cuerpo, ejecutar, asentamiento: a } = c;
  const error = cuerpo.querySelector<HTMLElement>('#wall-error');
  // `params` se evalúa al pulsar, no al cablear: el selector de nivel puede haber cambiado entre tanto.
  const lanzar = (boton: HTMLButtonElement, tipo: string, params: () => object): void => {
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const mensaje = await ejecutar(tipo, { asentamientoId: a.id, ...params() });
      boton.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    });
  };
  const comprometer = cuerpo.querySelector<HTMLButtonElement>('#btn-muralla-comprometer');
  if (comprometer) {
    const nivel = cuerpo.querySelector<HTMLSelectElement>('#select-muralla-nivel');
    lanzar(comprometer, 'comprometerRecinto', () => ({ cargo: comprometer.dataset.cargo, nivel: Number(nivel?.value ?? 1) }));
  }
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-abandonar-recinto]').forEach((b) => lanzar(b, 'abandonarRecinto', () => ({ recintoId: b.dataset.abandonarRecinto })));
  cuerpo.querySelectorAll<HTMLButtonElement>('[data-mejorar-recinto]').forEach((b) => lanzar(b, 'mejorarRecinto', () => ({ cargo: b.dataset.cargo, recintoId: b.dataset.mejorarRecinto })));
}

export const SUBPESTANA_MURALLA: SubpestanaPlaza = { id: 'muralla', etiqueta: 'Muralla', html, cablear };
