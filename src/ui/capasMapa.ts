// El botón de capas del mapa (Víctor, 2026-11-03), encima del zoom: en el modo mundo, los nombres de los nodos, la fertilidad del suelo
// (2026-11-04) y hasta dónde se carga el mundo; en el modo mapa, los nombres, la fertilidad y las parcelas de bosque, cada una con su leyenda. Lo puesto se recuerda
// (`mundo/capasDelMapa.ts`). La fertilidad, de un cultivo que se elige en su leyenda (0.190.0: cada cultivo tiene su tierra buena).
import { capasDelMapa, colorDeFertilidad, cultivoDeLaCapa, distanciaDeCarga, fijarCapa, fijarCultivoDeLaCapa, fijarDistanciaDeCarga, type CapasDelMapa } from '../mundo/capasDelMapa';
import { CULTIVOS_DE_ALDEA, esCultivo, type Cultivo } from '../mundo/fertilidad';
import { DISTANCIA_CARGA } from '../mundo3d/config';
import { RECURSO_ICONO } from '../paletas';

/** Cómo se nombra cada cultivo en la leyenda, con el icono de lo que da. */
export const NOMBRE_DE_CULTIVO: Record<Cultivo, { nombre: string; da: string }> = {
  trigo: { nombre: 'Trigo', da: 'trigo' },
  vid: { nombre: 'Vid', da: 'uva' },
  oliva: { nombre: 'Olivo', da: 'aceituna' },
  cebada: { nombre: 'Cebada', da: 'cebada' },
  sesamo: { nombre: 'Sésamo', da: 'sesamo' },
};

const ICONO = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
  <path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/></svg>`;

const fila = (capa: keyof CapasDelMapa, texto: string, puesta: boolean): string =>
  `<label class="mapa-capas-fila"><input type="checkbox" data-capa="${capa}"${puesta ? ' checked' : ''}><span>${texto}</span></label>`;

/** La rampa de la fertilidad como degradado CSS, con el corte de la aldea donde salta el color. */
function degradadoFertilidad(minima: number): string {
  const pasos = [0, minima - 0.001, minima, minima + 0.3, Math.min(1, minima + 0.6), 1];
  const rgb = (f: number) => { const [r, g, b] = colorDeFertilidad(Math.max(0, f), minima); return `rgb(${r}, ${g}, ${b})`; };
  return `linear-gradient(90deg, ${pasos.map((f) => `${rgb(f)} ${(Math.max(0, f) * 100).toFixed(1)}%`).join(', ')})`;
}

/** El botón y su lista. `modo` dice qué capas tiene esta pantalla; `minimaAldea`, dónde va el corte de la aldea en la leyenda; `cultivos`, los que
 * tienen capa en este mundo (con uno solo no hay nada que elegir). */
export function htmlCapas(modo: 'mundo' | 'mapa', minimaAldea = 0.3, cultivos: readonly Cultivo[] = CULTIVOS_DE_ALDEA): string {
  const c = capasDelMapa();
  const decimal = (x: number) => x.toFixed(1).replace('.', ',');
  const elegido = cultivos.includes(cultivoDeLaCapa()) ? cultivoDeLaCapa() : 'trigo';
  const deQue = cultivos.length > 1
    ? `<div class="mapa-capas-cultivos" role="radiogroup" aria-label="Fertilidad para el cultivo">${cultivos.map((x) => `<label class="mapa-capas-cultivo" title="${NOMBRE_DE_CULTIVO[x].nombre}"><input type="radio" name="capa-cultivo-${modo}" value="${x}" data-capa-cultivo${x === elegido ? ' checked' : ''}><span><span aria-hidden="true">${RECURSO_ICONO[NOMBRE_DE_CULTIVO[x].da] ?? '🌾'}</span> ${NOMBRE_DE_CULTIVO[x].nombre}</span></label>`).join('')}</div>`
    : '';
  const fertilidad = `${fila('fertilidad', 'Fertilidad del suelo', c.fertilidad)}
      <div class="mapa-capas-leyenda" data-leyenda="fertilidad"${c.fertilidad ? '' : ' hidden'}>
        ${deQue}
        <span class="mapa-capas-rampa" style="background:${degradadoFertilidad(minimaAldea)}"><i style="left:${(minimaAldea * 100).toFixed(1)}%"></i></span>
        <span class="mapa-capas-extremos"><span>Yerma</span><span>Aldea desde ${decimal(minimaAldea)}</span><span>Fértil</span></span>
      </div>`;
  const tematicas = modo === 'mapa'
    ? `${fertilidad}
      ${fila('parcelas', 'Parcelas de bosque', c.parcelas)}
      <div class="mapa-capas-leyenda" data-leyenda="parcelas"${c.parcelas ? '' : ' hidden'}>
        <span class="mapa-capas-muestra"><i style="--c:rgb(96, 200, 84)"></i>Libre: cabe una Leñera</span>
        <span class="mapa-capas-muestra"><i style="--c:rgb(222, 170, 82)"></i>Con Leñera</span>
        <span class="mapa-capas-muestra"><i style="--c:rgb(196, 92, 74)"></i>En zona de otra Facción</span>
        <span class="mapa-capas-nota">Más llena cuanto más densa: más madera.</span>
      </div>
      <p class="mapa-capas-nota">Solo sobre lo que has explorado.</p>`
    : `${fertilidad}
      <p class="mapa-capas-nota">Solo sobre lo que has explorado.</p>
      <span class="faction-kicker">Vista</span>
      <label class="mapa-capas-rango">
        <span>Distancia de carga <output data-carga-valor>${distanciaDeCarga()} u</output></span>
        <input type="range" data-carga min="${DISTANCIA_CARGA.min}" max="${DISTANCIA_CARGA.max}" step="${DISTANCIA_CARGA.paso}" value="${distanciaDeCarga()}">
      </label>
      <p class="mapa-capas-nota">Hasta dónde se carga el mundo a tu alrededor. Más corta, menos trabajo para el equipo; la bruma tapa lo de más allá.</p>`;
  return `<div class="mapa-capas">
    <button type="button" class="mapa-capas-boton" aria-expanded="false" aria-label="Capas del mapa" title="Capas del mapa">${ICONO}</button>
    <div class="mapa-capas-lista" hidden>
      <span class="faction-kicker">Capas</span>
      ${fila('nombresDeNodos', 'Nombres de los nodos', c.nombresDeNodos)}
      ${tematicas}
    </div>
  </div>`;
}

/** Abre y cierra la lista (un clic fuera de ella la cierra) y avisa cada vez que se marca o desmarca una capa o se mueve la distancia de carga. */
export function cablearCapas(raiz: HTMLElement, alCambiar: () => void): void {
  const caja = raiz.querySelector<HTMLElement>(':scope > .mapa-capas');
  const boton = caja?.querySelector<HTMLButtonElement>('.mapa-capas-boton');
  const lista = caja?.querySelector<HTMLElement>('.mapa-capas-lista');
  if (!caja || !boton || !lista) return;
  const abrir = (si: boolean) => { lista.hidden = !si; boton.setAttribute('aria-expanded', String(si)); boton.classList.toggle('activo', si); };
  boton.addEventListener('click', () => abrir(lista.hidden));
  raiz.addEventListener('pointerdown', (ev) => { if (!lista.hidden && !caja.contains(ev.target as Node)) abrir(false); });
  lista.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { abrir(false); boton.focus(); } });
  lista.querySelectorAll<HTMLInputElement>('[data-capa]').forEach((casilla) => casilla.addEventListener('change', () => {
    const capa = casilla.dataset.capa as keyof CapasDelMapa;
    fijarCapa(capa, casilla.checked);
    const leyenda = lista.querySelector<HTMLElement>(`[data-leyenda="${capa}"]`);
    if (leyenda) leyenda.hidden = !casilla.checked;
    alCambiar();
  }));
  lista.querySelectorAll<HTMLInputElement>('[data-capa-cultivo]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked || !esCultivo(r.value)) return;
    fijarCultivoDeLaCapa(r.value);
    alCambiar();
  }));
  const rango = lista.querySelector<HTMLInputElement>('[data-carga]');
  rango?.addEventListener('input', () => {
    fijarDistanciaDeCarga(Number(rango.value));
    const valor = lista.querySelector<HTMLOutputElement>('[data-carga-valor]');
    if (valor) valor.value = `${distanciaDeCarga()} u`;
    alCambiar();
  });
}

