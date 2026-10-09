// «Salir como ejército»: la elección compartida por la pestaña Salir de un campamento y el panel «Salir al mundo» de tu plaza. Sale como COLUMNA PERSONAL
// (por tu cuenta, rumbo libre) o como EJÉRCITO: se convoca (`convocarEjercito`) y los de tu Facción que estén en el mismo lugar se unen
// (`unirseAConvocatoria`) antes de que el Líder pulse «Salir con el ejército» (ver `ui/convocatoria.ts`). Un ejército NO sale con destino: el Líder lo dirige
// con clics en el mapa, tantas veces como quiera (backend 2026-10-08). La tropa y la carga las pone el formulario de salida que lo rodea (`leerSeleccion`).
// Lo elegido vive aquí, fuera del HTML, para sobrevivir a los repintados del sondeo; los cambios se aplican al DOM sin repintar.
import type { ProyeccionJugador } from '../apiCliente';
import { ayuda } from './ayuda';
import { htmlConvocatoriasAbiertas } from './convocatoria';
import { POLITICA } from './ejercitos';
import { pintar } from './repintado';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;
type Politica = 'aceptar' | 'preguntar';

const eleccion: { ejercito: boolean; politica: Politica } = { ejercito: false, politica: 'aceptar' };

export interface Seleccion { escuadronIds: string[]; carga: Record<string, number> }

/** El HTML es constante (la lista de convocatorias se rellena aparte con `actualizarConvocatorias`): así el sondeo no repinta la pestaña ni borra lo que has marcado. */
export function htmlSalidaComoEjercito(p: ProyeccionJugador, e: Escapar): string {
  return `<div class="salida-ejercito">
    <strong class="heroe-sub">Cómo sales${ayuda('salida:modo', '<strong>Columna personal</strong>: por tu cuenta, con el rumbo libre.<br><strong>Ejército</strong>: salís juntos varios héroes de tu Facción; lo dirige su Líder con clics en el mapa.<br>Para unirte a uno que se prepara, pulsa «Unirme»: sales con la tropa y la carga que marques aquí abajo. Para convocar el tuyo, elige quién puede unirse y pulsa «Convocar ejército». Un ejército espera dentro, sin límite de tiempo, hasta que su Líder pulse «Salir con el ejército» o cancele. Necesita al menos una escuadra. Un ejército lo componen ciudadanos de una sola Facción.')}</strong>
    <label class="form-check"><input type="radio" name="salida-modo" value="personal" checked /> Columna personal</label>
    <label class="form-check"><input type="radio" name="salida-modo" value="ejercito" /> Ejército</label>
    <div data-salida-ejercito hidden>
      ${p.faccionId ? '' : '<p class="asent-lado-nota"><strong>No tienes Facción: nadie podrá unirse a tu ejército.</strong></p>'}
      <strong class="heroe-sub">Ejércitos que se están preparando aquí</strong>
      <div data-lista-convocatorias></div>
      <span class="heroe-sub">Quién puede unirse (se fija al convocar)</span>
      ${(['aceptar', 'preguntar'] as Politica[]).map((k) => `<label class="form-check"><input type="radio" name="salida-politica" value="${k}"${k === 'aceptar' ? ' checked' : ''} /> ${e(POLITICA[k])}</label>`).join('')}
    </div></div>`;
}

/**
 * `boton` es el de «Salir» del formulario: en modo ejército se intercepta y convoca (`convocarEjercito`) en vez de salir. `leerSeleccion` lee la tropa y la carga marcadas.
 * Las convocatorias abiertas cambian con el sondeo: `actualizarConvocatorias` repinta solo esa lista.
 */
export function cablearSalidaComoEjercito(
  raiz: ParentNode,
  p: ProyeccionJugador,
  boton: HTMLButtonElement | null,
  textoPersonal: string,
  leerSeleccion: () => Seleccion,
  ejecutar: Ejecutar,
  avisar: (mensaje: string) => void
): void {
  const bloque = raiz.querySelector<HTMLElement>('[data-salida-ejercito]');
  // El HTML es siempre el mismo (si no, el sondeo repintaría la pestaña entera y borraría lo marcado): el estado elegido se aplica al DOM aquí.
  const poner = (): void => { if (boton) boton.textContent = eleccion.ejercito ? 'Convocar ejército' : textoPersonal; };
  raiz.querySelectorAll<HTMLInputElement>('input[name="salida-modo"]').forEach((i) => { i.checked = (i.value === 'ejercito') === eleccion.ejercito; });
  raiz.querySelectorAll<HTMLInputElement>('input[name="salida-politica"]').forEach((i) => { i.checked = i.value === eleccion.politica; });
  if (bloque) bloque.hidden = !eleccion.ejercito;
  poner();
  raiz.querySelectorAll<HTMLInputElement>('input[name="salida-modo"]').forEach((i) => i.addEventListener('change', () => {
    eleccion.ejercito = i.value === 'ejercito';
    if (bloque) bloque.hidden = !eleccion.ejercito;
    poner();
  }));
  raiz.querySelectorAll<HTMLInputElement>('input[name="salida-politica"]').forEach((i) => i.addEventListener('change', () => { eleccion.politica = i.value as Politica; }));
  const enviar = async (b: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    b.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    if (mensaje) { b.disabled = false; avisar(mensaje); }
  };
  // En modo ejército el botón principal convoca, y el formulario de salida no llega a salir.
  boton?.addEventListener('click', (ev) => {
    if (!eleccion.ejercito) return;
    ev.stopImmediatePropagation();
    void enviar(boton, 'convocarEjercito', { heroeId: p.heroeId, politicaDeUnion: eleccion.politica, ...leerSeleccion() });
  }, true);
}

/** Repinta solo la lista de convocatorias abiertas (las altera el sondeo) sin tocar lo marcado en el formulario. */
export function actualizarConvocatorias(raiz: ParentNode, p: ProyeccionJugador, leerSeleccion: () => Seleccion, ejecutar: Ejecutar, avisar: (mensaje: string) => void, escapar: Escapar): void {
  const lista = raiz.querySelector<HTMLElement>('[data-lista-convocatorias]');
  if (!lista) return;
  const html = htmlConvocatoriasAbiertas(p, escapar);
  pintar(lista, html, () => lista.querySelectorAll<HTMLButtonElement>('[data-unirse-conv]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const mensaje = await ejecutar('unirseAConvocatoria', { heroeId: p.heroeId, convocatoriaId: b.dataset.unirseConv, ...leerSeleccion() });
    if (mensaje) { b.disabled = false; avisar(mensaje); }
  })));
}
