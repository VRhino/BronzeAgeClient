// Panel del CARRO PERSONAL (backend Doc 2.5, `engine/almacenPersonal.ts`): lo que lleva tu columna en el carro (`ejercito.suministro`) y lo que guardas
// en tu almacén personal (`heroe.almacenPersonal`). Los comandos que mueven cosas entre uno y otro ya existen:
//   guardarEnAlmacenPersonal { recurso, cantidad }   del carro al almacén personal (lo que cabe hasta el tope)
//   sacarDelAlmacenPersonal  { recurso, cantidad }   del almacén personal al carro (lo que cabe en el carro)
//   vaciarCarro { heroeId }  dentro de tu residencia, del carro que traes contigo al almacén personal (el motor no lo vacía al entrar)
//   salirDelCampamento { carga } carga el carro desde el almacén; lo que ya traías en el carro sale contigo
// Ambos exigen ser el LÍDER de la columna (el carro es común) y estar en ella. El tope del almacén personal (`heroe.capacidadAlmacenPersonal`) y
// lo que cabe en el carro (`ejercitos[].capacidadCarga`) los manda el backend ya calculados; si falta sitio, el rechazo es suyo.
import type { ProyeccionJugador } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';
import { CAPACIDAD_CARRO_SALIDA } from './cargaDeSalida';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const icono = (r: string): string => RECURSO_ICONO[r] ?? '📦';

/** « · 120 / 1000» si el backend manda la capacidad (un backend anterior no la manda). */
function ocupacion(recursos: Record<string, number>, capacidad: number | undefined): string {
  if (capacidad === undefined) return '';
  const total = Object.values(recursos).reduce((a, b) => a + b, 0);
  return ` · ${Math.floor(total)} / ${Math.floor(capacidad)}`;
}

function miColumna(p: ProyeccionJugador) {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

function filas(recursos: Record<string, number>, accion: string, etiqueta: string, habilitado: boolean, e: Escapar): string {
  const lista = Object.entries(recursos).filter(([, n]) => n >= 1);
  if (lista.length === 0) return '<p class="mapa-lista-vacia">Vacío.</p>';
  return lista
    .map(([r, n]) => {
      const util = Math.floor(n);
      return `<div class="carro-fila"><span>${icono(r)} ${e(nombre(r))}</span><strong>${Math.floor(n)}</strong>
        ${habilitado && util >= 1 ? `<input class="form-input" type="number" min="1" max="${util}" value="${util}" data-carro-cantidad="${e(r)}" /><button class="btn-secondary" type="button" data-carro="${accion}" data-recurso="${e(r)}">${etiqueta}</button>` : ''}</div>`;
    })
    .join('');
}

/** `cabecera`: la línea con el nombre del héroe (fuera cuando el carro va dentro de otro panel, como «Lo que llevas»). */
export function htmlCarro(p: ProyeccionJugador, e: Escapar, cabecera = true): string {
  const columna = miColumna(p);
  const almacen = p.heroe.almacenPersonal ?? {};
  const esLider = columna?.liderId === p.heroeId;
  const carro = columna?.suministro ?? {};
  // El resto del carro que se queda aparcado en la puerta de un campamento al entrar sin poder guardarlo todo.
  const aparcadas = p.ejercitos.filter((c) => c !== columna && c.liderId === p.heroeId && Object.values(c.suministro ?? {}).some((n) => n >= 1));
  // Dentro de tu residencia el carro sigue contigo (`heroe.carro`): entrar no lo vacía.
  const carroContigo = !columna ? (p.heroe.carro ?? {}) : {};
  const hayCarroContigo = Object.values(carroContigo).some((n) => n >= 1);
  const nota = !columna
    ? 'Dentro de tu residencia el carro sigue contigo: entrar no lo vacía. «Pasar al almacén» lo guarda en tu almacén personal hasta su tope, y lo que no quepa se queda en el carro. Al salir, lo que haya en el carro sale contigo y en la pestaña Salir eliges qué más cargas.'
    : !esLider
      ? 'Solo el Líder de la columna mueve lo del carro: el carro es común a todos los que van en ella.'
      : 'Guarda en tu almacén personal lo que quieras conservar. Al entrar en tu campamento se guarda solo. El carro es solo carga: la columna come de tus víveres (barra de abajo del mapa), y de aquí se les pasa trigo.';
  return `
    ${cabecera ? `<div class="mapa-panel-jugador">${e(p.heroe.displayName)} · carro y almacén</div>` : ''}
    <strong class="heroe-sub">Carga${ayuda('jugador:carro', e(nota))}</strong>
    ${columna ? `<strong class="heroe-sub">Carro de tu columna${ocupacion(carro, columna.capacidadCarga)}</strong>${filas(carro, 'guardar', 'Guardar', esLider, e)}` : ''}
    ${!columna ? `<strong class="heroe-sub">Tu carro${ocupacion(carroContigo, CAPACIDAD_CARRO_SALIDA)}</strong>${filas(carroContigo, 'ninguna', '', false, e)}${hayCarroContigo ? '<button class="btn-secondary" type="button" data-vaciar-carro>Pasar al almacén</button>' : ''}` : ''}
    ${aparcadas.map((c) => `<strong class="heroe-sub">Resto del carro, aparcado en la puerta</strong>${filas(c.suministro ?? {}, 'ninguna', '', false, e)}`).join('')}
    <strong class="heroe-sub">Almacén personal${ocupacion(almacen, p.heroe.capacidadAlmacenPersonal)}</strong>
    ${filas(almacen, 'sacar', 'Al carro', Boolean(columna) && esLider, e)}
    <p class="faction-error" data-campo="error-carro" role="alert"></p>`;
}

export function cablearCarro(raiz: HTMLElement, ejecutar: Ejecutar, heroeId?: string): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-carro"]');
  raiz.querySelector<HTMLButtonElement>('[data-vaciar-carro]')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const mensaje = await ejecutar('vaciarCarro', { heroeId });
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  });
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      const recurso = boton.dataset.recurso!;
      const cantidad = Number(raiz.querySelector<HTMLInputElement>(`input[data-carro-cantidad="${recurso}"]`)?.value ?? 0);
      boton.disabled = true;
      const mensaje = await ejecutar(boton.dataset.carro === 'guardar' ? 'guardarEnAlmacenPersonal' : 'sacarDelAlmacenPersonal', { recurso, cantidad });
      boton.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    })
  );
}
