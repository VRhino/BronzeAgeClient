// «Qué cargas en el carro al salir»: de tu almacén personal al salir de un campamento, del almacén de la plaza al salir de tu residencia
// (`salirDelCampamento.carga` / `salirAlMundo.carga`, mapa recurso → cantidad). El carro de una columna nueva admite `LOGISTICA.capacidadCarroPorJugador`
// del backend (copiado: el backend no lo publica antes de que exista la columna; si cambiara, el rechazo del backend lo dice).
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';

export const CAPACIDAD_CARRO_SALIDA = 500;

type Escapar = (valor: string) => string;

/** `disponible`: recurso → lo que puedes sacar (la reserva de trigo de la plaza la comprueba el backend). `de`: de dónde sale, para la explicación.
 * `yaEnCarro`: lo que el héroe ya trae en el carro (`heroe.carro`), que sale con él y ocupa sitio. */
export function htmlCargaDeSalida(disponible: Record<string, number>, de: string, e: Escapar, yaEnCarro: Record<string, number> = {}): string {
  const filas = Object.entries(disponible).filter(([r, n]) => n >= 1 && r !== 'oro');
  const ya = Object.entries(yaEnCarro).filter(([, n]) => n >= 1);
  const ocupado = Math.floor(ya.reduce((a, [, n]) => a + n, 0));
  return `
    <strong class="heroe-sub" data-carga-ocupado="${ocupado}">Carga del carro <span data-carga-total>${ocupado} / ${CAPACIDAD_CARRO_SALIDA}</span>${ayuda('salida:carga', `Lo que metas en el carro sale contigo, de ${e(de)}. Es lo que llevas para comer o gastar fuera, y lo que se arriesga si pierdes un combate (se pierde la mitad).`)}</strong>
    ${ya.length > 0 ? `<p class="asent-lado-nota">Ya llevas en el carro, y sale contigo: ${ya.map(([r, n]) => `${Math.floor(n)} ${e(RECURSO_NOMBRE[r] ?? r)}`).join(', ')}.</p>` : ''}
    ${filas.length === 0
      ? `<p class="asent-lado-nota">No hay nada que cargar en ${e(de)}.</p>`
      : filas.map(([r, n]) => `<div class="carro-fila"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><small>hay ${Math.floor(n)}</small><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-carga="${e(r)}" /><button class="btn-secondary" type="button" data-carga-todo="${e(r)}">Todo</button></div>`).join('')}`;
}

/** Cablea el total en vivo y los botones «Todo» (limitados a lo que cabe en el carro); `leerCarga` devuelve el mapa a enviar. */
export function cablearCargaDeSalida(raiz: HTMLElement): void {
  const entradas = Array.from(raiz.querySelectorAll<HTMLInputElement>('input[data-carga]'));
  const total = raiz.querySelector<HTMLElement>('[data-carga-total]');
  const ocupado = Number(raiz.querySelector<HTMLElement>('[data-carga-ocupado]')?.dataset.cargaOcupado ?? 0);
  const actualizar = (): void => {
    const suma = ocupado + entradas.reduce((a, i) => a + (Number(i.value) || 0), 0);
    if (total) { total.textContent = `${suma} / ${CAPACIDAD_CARRO_SALIDA}`; total.classList.toggle('excedido', suma > CAPACIDAD_CARRO_SALIDA); }
  };
  entradas.forEach((i) => i.addEventListener('input', actualizar));
  raiz.querySelectorAll<HTMLButtonElement>('[data-carga-todo]').forEach((b) =>
    b.addEventListener('click', () => {
      const entrada = entradas.find((i) => i.dataset.carga === b.dataset.cargaTodo)!;
      const otros = ocupado + entradas.reduce((a, i) => a + (i === entrada ? 0 : Number(i.value) || 0), 0);
      entrada.value = String(Math.max(0, Math.min(Number(entrada.max), CAPACIDAD_CARRO_SALIDA - otros)));
      actualizar();
    })
  );
  actualizar();
}

export function leerCarga(raiz: HTMLElement): Record<string, number> {
  return Object.fromEntries(
    Array.from(raiz.querySelectorAll<HTMLInputElement>('input[data-carga]')).map((i) => [i.dataset.carga!, Number(i.value)] as const).filter(([, n]) => n > 0)
  );
}
