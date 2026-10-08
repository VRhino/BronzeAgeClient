// «Salir como ejército»: la elección compartida por la pestaña Salir de un campamento (`salirDelCampamento`) y el panel «Salir al mundo» de tu plaza
// (`movilizarEjercito`). Sale como COLUMNA PERSONAL (por tu cuenta, rumbo libre) o como EJÉRCITO: con destino fijo desde el primer momento y una política de
// unión que fija el Líder y no cambia (Doc 5.12.1, 5.14.1). El destino se elige con un clic en el mapa del mundo (`elegirDestino`, lo abre `main.ts`).
// Lo elegido vive aquí, fuera del HTML, para sobrevivir a los repintados del sondeo; los cambios se aplican al DOM sin repintar (no se pierde lo que
// ya marcaste de tropa y carga).
import type { Point } from '../tiposDominio';
import { POLITICA } from './ejercitos';

type Escapar = (valor: string) => string;
type Politica = 'aceptar' | 'preguntar' | 'rechazar';

const eleccion: { ejercito: boolean; politica: Politica; destino: Point | null } = { ejercito: false, politica: 'aceptar', destino: null };

export interface OpcionesSalida {
  /** Un campamento no admite el ejército «cerrado» (política `rechazar` = columna personal, en su API); una plaza sí. */
  permiteCerrado: boolean;
  /** Sin Facción nadie puede unirse: se avisa. */
  sinFaccion: boolean;
}

export function htmlSalidaComoEjercito(o: OpcionesSalida, e: Escapar): string {
  const politicas: Politica[] = o.permiteCerrado ? ['aceptar', 'preguntar', 'rechazar'] : ['aceptar', 'preguntar'];
  if (!politicas.includes(eleccion.politica)) eleccion.politica = 'aceptar';
  return `<div class="salida-ejercito">
    <strong class="heroe-sub">Cómo sales</strong>
    <label class="form-check"><input type="radio" name="salida-modo" value="personal"${eleccion.ejercito ? '' : ' checked'} /> Columna personal: por tu cuenta, con el rumbo libre.</label>
    <label class="form-check"><input type="radio" name="salida-modo" value="ejercito"${eleccion.ejercito ? ' checked' : ''} /> Ejército: destino fijo desde ya, y otros héroes de tu Facción pueden unirse.</label>
    <div data-salida-ejercito${eleccion.ejercito ? '' : ' hidden'}>
      ${o.sinFaccion ? '<p class="asent-lado-nota"><strong>No tienes Facción: nadie podrá unirse a tu ejército.</strong> Un ejército lo componen ciudadanos de una sola Facción.</p>' : ''}
      <span class="heroe-sub">Quién puede unirse por el camino (no se cambia después)</span>
      ${politicas.map((k) => `<label class="form-check"><input type="radio" name="salida-politica" value="${k}"${eleccion.politica === k ? ' checked' : ''} /> ${e(POLITICA[k])}</label>`).join('')}
      <div class="campamento-fila"><span data-salida-destino>${textoDestino()}</span><button class="btn-secondary" type="button" data-salida-elegir>Elegir destino en el mapa</button></div>
      <p class="asent-lado-nota">Un ejército necesita al menos una escuadra. Se elige un punto del mapa; el ejército marcha hasta allí.</p>
    </div></div>`;
}

function textoDestino(): string {
  return eleccion.destino ? `Destino: (${Math.round(eleccion.destino.x)}, ${Math.round(eleccion.destino.y)})` : 'Sin destino: elígelo en el mapa.';
}

/** `elegirDestino` abre el mapa y llama a `alElegir` con el punto del clic. */
export function cablearSalidaComoEjercito(raiz: ParentNode, elegirDestino: (alElegir: (punto: Point) => void) => void): void {
  const bloque = raiz.querySelector<HTMLElement>('[data-salida-ejercito]');
  const texto = raiz.querySelector<HTMLElement>('[data-salida-destino]');
  raiz.querySelectorAll<HTMLInputElement>('input[name="salida-modo"]').forEach((i) => i.addEventListener('change', () => {
    eleccion.ejercito = i.value === 'ejercito';
    if (bloque) bloque.hidden = !eleccion.ejercito;
  }));
  raiz.querySelectorAll<HTMLInputElement>('input[name="salida-politica"]').forEach((i) => i.addEventListener('change', () => { eleccion.politica = i.value as Politica; }));
  raiz.querySelector('[data-salida-elegir]')?.addEventListener('click', () => elegirDestino((punto) => {
    eleccion.destino = punto;
    if (texto && texto.isConnected) texto.textContent = textoDestino();
  }));
}

/** Lo que se añade a los params de `salirDelCampamento` / `movilizarEjercito`: nada (columna personal), o la política y el rumbo. `error` si falta el destino. */
export function paramsDeSalida(): { params: { politicaDeUnion?: Politica; objetivo?: { tipo: 'punto'; punto: Point } }; error?: string } {
  if (!eleccion.ejercito) return { params: {} };
  if (!eleccion.destino) return { params: {}, error: 'Elige el destino del ejército con un clic en el mapa.' };
  return { params: { politicaDeUnion: eleccion.politica, objetivo: { tipo: 'punto', punto: eleccion.destino } } };
}

export const saleComoEjercito = (): boolean => eleccion.ejercito;
