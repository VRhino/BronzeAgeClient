// El botón de capas del mapa (Víctor, 2026-11-03), encima del zoom: en el modo mundo, los nombres de los nodos; en el modo mapa, además la
// fertilidad del suelo y las parcelas de bosque, cada una con su leyenda. Lo puesto se recuerda (`mundo/capasDelMapa.ts`).
import { capasDelMapa, colorDeFertilidad, fijarCapa, type CapasDelMapa } from '../mundo/capasDelMapa';

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

/** El botón y su lista. `modo` dice qué capas tiene esta pantalla; `minimaAldea`, dónde va el corte de la aldea en la leyenda. */
export function htmlCapas(modo: 'mundo' | 'mapa', minimaAldea = 0.3): string {
  const c = capasDelMapa();
  const decimal = (x: number) => x.toFixed(1).replace('.', ',');
  const tematicas = modo === 'mapa'
    ? `${fila('fertilidad', 'Fertilidad del suelo', c.fertilidad)}
      <div class="mapa-capas-leyenda" data-leyenda="fertilidad"${c.fertilidad ? '' : ' hidden'}>
        <span class="mapa-capas-rampa" style="background:${degradadoFertilidad(minimaAldea)}"><i style="left:${(minimaAldea * 100).toFixed(1)}%"></i></span>
        <span class="mapa-capas-extremos"><span>Yerma</span><span>Aldea desde ${decimal(minimaAldea)}</span><span>Fértil</span></span>
      </div>
      ${fila('parcelas', 'Parcelas de bosque', c.parcelas)}
      <div class="mapa-capas-leyenda" data-leyenda="parcelas"${c.parcelas ? '' : ' hidden'}>
        <span class="mapa-capas-muestra"><i style="--c:rgb(96, 200, 84)"></i>Libre: cabe una Leñera</span>
        <span class="mapa-capas-muestra"><i style="--c:rgb(222, 170, 82)"></i>Con Leñera</span>
        <span class="mapa-capas-muestra"><i style="--c:rgb(196, 92, 74)"></i>En zona de otra Facción</span>
        <span class="mapa-capas-nota">Más llena cuanto más densa: más madera.</span>
      </div>
      <p class="mapa-capas-nota">Solo sobre lo que has explorado.</p>`
    : '';
  return `<div class="mapa-capas">
    <button type="button" class="mapa-capas-boton" aria-expanded="false" aria-label="Capas del mapa" title="Capas del mapa">${ICONO}</button>
    <div class="mapa-capas-lista" hidden>
      <span class="faction-kicker">Capas</span>
      ${fila('nombresDeNodos', 'Nombres de los nodos', c.nombresDeNodos)}
      ${tematicas}
    </div>
  </div>`;
}

/** Abre y cierra la lista (un clic fuera de ella la cierra) y avisa con las capas nuevas cada vez que se marca o desmarca una. */
export function cablearCapas(raiz: HTMLElement, alCambiar: (capas: Readonly<CapasDelMapa>) => void): void {
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
    alCambiar(capasDelMapa());
  }));
}

