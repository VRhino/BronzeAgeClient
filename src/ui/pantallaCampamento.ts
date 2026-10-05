// Pantalla CAMPAMENTO (backend 2026-10-04, Doc 1.9b): el héroe nace DENTRO de un campamento de mercenarios y vuelve a él.
// Desde aquí sale al mundo con la tropa y la carga que elige, pide tropa prestada, compra en el mercado y, si su Facción no
// tiene asentamiento, aporta al fondo con el que se compra la Caravana de Fundación. Aquí no se decide ninguna regla: quien
// valida es el backend, y su rechazo sale tal cual en `#campamento-error`.
import type { ProyeccionJugador } from '../apiCliente';
import { RECURSO_NOMBRE } from '../paletas';
import type { CampamentoMercenarios } from '../tiposDominio';

/** Manda el comando y refresca; devuelve el mensaje de error o `null`. Lo pone `main.ts`. */
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;
type Escapar = (valor: string) => string;

/** Las tres tropas de leva comunal que presta el campamento (backend `TROPAS_RECLUTABLES`, tecnología `leva_comunal`). */
const TROPAS_PRESTAMO: [string, string][] = [['milicia_lanceros', 'Milicia de lanceros'], ['lenadores', 'Leñadores'], ['granjeros', 'Granjeros']];

const nombreRecurso = (r: string): string => RECURSO_NOMBRE[r] ?? r;

export function campamentoActual(proyeccion: ProyeccionJugador): CampamentoMercenarios | undefined {
  const u = proyeccion.heroe.ubicacion;
  return u.tipo === 'mercenarios' ? proyeccion.campamentosMercenarios.find((c) => c.id === u.campamentoId) : undefined;
}

/** ¿Tiene tu Facción algún asentamiento a la vista o en memoria? Sin ninguno, el campamento le vende la Caravana de Fundación. */
function faccionConPlaza(p: ProyeccionJugador): boolean {
  return p.asentamientos.length > 0 || [...p.asentamientosAvistados, ...p.asentamientosConocidos].some((a) => a.faccionId === p.faccionId);
}

function listaRecursos(recursos: Record<string, number>, e: Escapar): string {
  const filas = Object.entries(recursos).filter(([, n]) => n > 0);
  return filas.length > 0
    ? filas.map(([r, n]) => `<div><span>${e(nombreRecurso(r))}</span><strong>${Math.floor(n)}</strong></div>`).join('')
    : '<p class="mapa-lista-vacia">Nada.</p>';
}

/** El HTML de la pantalla. `#campamento-faccion` lo rellena `main.ts` (el flujo crear/pedir ingreso es común). */
export function renderCampamento(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const almacen = heroe.almacenPersonal ?? {};
  const enCampamento = heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento');
  const prestadas = new Set(heroe.escuadrones.filter((s) => s.prestada).map((s) => s.tropaId));
  const enVenta = Object.entries(c.mercado).filter(([r, n]) => n > 0 && (resides || r === 'trigo'));

  const salir = resides
    ? `<p>Elige la tropa que sacas y lo que cargas de tu almacén. Recibes además la ración gratis de trigo.</p>
      <div class="mapa-lista">${enCampamento.length > 0
        ? enCampamento.map((s) => `<label class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong><span>${s.cantidad} hombres</span></div><input type="checkbox" data-salir-escuadra="${e(s.id)}" checked /></label>`).join('')
        : '<p class="mapa-lista-vacia">No tienes tropa en el campamento.</p>'}</div>
      ${Object.entries(almacen).filter(([, n]) => n > 0).map(([r, n]) => `<label class="campamento-fila"><span>${e(nombreRecurso(r))} (hay ${Math.floor(n)})</span><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-carga="${e(r)}" /></label>`).join('')}`
    : '<p>Sales con la columna con la que entraste, tal cual.</p>';

  const fondoDeFaccion: Record<string, number> = {};
  const ciudadanos = new Set(p.facciones.find((f) => f.id === p.faccionId)?.ciudadanosIds ?? []);
  for (const [heroeId, aporte] of Object.entries(c.fondos)) {
    if (!ciudadanos.has(heroeId)) continue;
    for (const [r, n] of Object.entries(aporte)) fondoDeFaccion[r] = (fondoDeFaccion[r] ?? 0) + n;
  }
  const caravana = p.caravanas.find((k) => k.origenCampamentoId === c.id && k.faccionId === p.faccionId);
  const recursosAportables = [...new Set([...Object.keys(almacen), ...(heroe.oroDeBotin ? ['oro'] : [])])];
  const fondo = p.faccionId !== null && !faccionConPlaza(p)
    ? `<section class="campamento-seccion">
        <span class="faction-kicker">Fundar</span>
        <h3>Fondo de refundación</h3>
        <p>Lo que los ciudadanos de tu Facción reúnen aquí para comprar la Caravana de Fundación. Lo tuyo se retira mientras no se gaste.</p>
        <div class="mapa-seleccion-datos">${listaRecursos(fondoDeFaccion, e)}</div>
        <div class="campamento-fila">
          <select class="form-input" id="fondo-recurso">${recursosAportables.map((r) => `<option value="${e(r)}">${e(nombreRecurso(r))}</option>`).join('')}</select>
          <input class="form-input" id="fondo-cantidad" type="number" min="1" value="10" />
        </div>
        <div class="mapa-seleccion-acciones">
          <button class="btn-secondary" type="button" data-fondo="aportarARefundacion">Aportar</button>
          <button class="btn-secondary" type="button" data-fondo="retirarDeRefundacion">Retirar</button>
          <button class="btn-primary" type="button" id="btn-comprar-caravana"${caravana ? ' disabled' : ''}>Comprar caravana</button>
        </div>
        ${caravana ? `<p>Caravana de Fundación lista${caravana.titularId === heroe.id ? ', y la llevas tú' : ''}: sal con tu columna, engánchala en el mapa y funda donde quieras (panel ⌂).</p>` : ''}
      </section>`
    : '';

  return `
    <div class="campamento-screen">
      <header class="campamento-cabecera">
        <span class="faction-kicker">Campamento de mercenarios${resides ? ' · tu residencia' : ''}</span>
        <h2>${e(c.id)}</h2>
        <div class="mapa-seleccion-datos">
          <div><span>Residentes</span><strong>${c.residentesIds.length}</strong></div>
          <div><span>Oro de botín</span><strong>${Math.floor(heroe.oroDeBotin ?? 0)}</strong></div>
        </div>
        ${resides ? '' : '<button class="btn-secondary" type="button" id="btn-residir">Residir aquí</button>'}
      </header>

      <section class="campamento-seccion">
        <span class="faction-kicker">Salir al mundo</span>
        ${salir}
        <button class="btn-primary" type="button" id="btn-salir-campamento">Salir</button>
      </section>

      ${resides ? `<section class="campamento-seccion">
        <span class="faction-kicker">Tu almacén</span>
        <div class="mapa-seleccion-datos">${listaRecursos(almacen, e)}</div>
      </section>

      <section class="campamento-seccion">
        <span class="faction-kicker">Tropa prestada</span>
        <p>Gratis, para aprender a usar tropa antes de tener la tuya. No gana experiencia.</p>
        <div class="mapa-lista">${TROPAS_PRESTAMO.map(([id, nombre]) => `<label class="mapa-lista-item"><div><strong>${nombre}</strong><span>${prestadas.has(id) ? 'ya la tienes' : '15 hombres'}</span></div><input type="checkbox" data-prestamo="${id}"${prestadas.has(id) ? ' disabled' : ''} /></label>`).join('')}</div>
        <div class="mapa-seleccion-acciones">
          <button class="btn-secondary" type="button" id="btn-pedir-prestamo">Pedir</button>
          ${prestadas.size > 0 ? '<button class="btn-secondary" type="button" id="btn-reponer-prestamo">Reponer bajas</button>' : ''}
        </div>
      </section>` : ''}

      <section class="campamento-seccion">
        <span class="faction-kicker">Mercado</span>
        ${resides ? '' : '<p>Si no resides aquí, solo te venden trigo, y va al carro de tu columna.</p>'}
        ${enVenta.length > 0
          ? enVenta.map(([r, n]) => `<div class="campamento-fila"><span>${e(nombreRecurso(r))} (${Math.floor(n)})</span><input class="form-input" type="number" min="1" max="${Math.floor(n)}" value="10" data-compra="${e(r)}" /><button class="btn-secondary" type="button" data-comprar="${e(r)}">Comprar</button></div>`).join('')
          : '<p class="mapa-lista-vacia">Nada en venta.</p>'}
      </section>

      ${fondo}

      <section class="campamento-seccion" id="campamento-intel"></section>

      <section class="campamento-seccion" id="campamento-faccion"></section>
      <p id="campamento-error" class="faction-error" role="alert"></p>
    </div>`;
}

/** Cablea los botones de `renderCampamento`. Tras un éxito refresca `ejecutar`, y el router decide la pantalla. */
export function cablearCampamento(root: HTMLElement, p: ProyeccionJugador, c: CampamentoMercenarios, ejecutar: Ejecutar): void {
  const error = root.querySelector<HTMLElement>('#campamento-error');
  const heroeId = p.heroeId;
  const conBoton = (selector: string, tipo: string, params: (this: HTMLButtonElement) => object): void => {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((boton) =>
      boton.addEventListener('click', async () => {
        boton.disabled = true;
        const mensaje = await ejecutar(tipo, params.call(boton));
        boton.disabled = false;
        if (error) error.textContent = mensaje ?? '';
      })
    );
  };
  const marcados = (atributo: string): string[] =>
    Array.from(root.querySelectorAll<HTMLInputElement>(`input[${atributo}]:checked`)).map((i) => i.getAttribute(atributo)!);

  conBoton('#btn-residir', 'residirEnCampamento', () => ({ heroeId, campamentoId: c.id }));
  conBoton('#btn-salir-campamento', 'salirDelCampamento', () => ({
    campamentoId: c.id,
    heroeId,
    escuadronIds: marcados('data-salir-escuadra'),
    carga: Object.fromEntries(
      Array.from(root.querySelectorAll<HTMLInputElement>('input[data-carga]')).map((i) => [i.dataset.carga!, Number(i.value)] as const).filter(([, n]) => n > 0)
    ),
  }));
  conBoton('#btn-pedir-prestamo', 'pedirPrestamo', () => ({ tropaIds: marcados('data-prestamo') }));
  conBoton('#btn-reponer-prestamo', 'reponerPrestamo', () => ({}));
  conBoton('[data-comprar]', 'comprarEnCampamento', function (this: HTMLButtonElement) {
    const recurso = this.dataset.comprar!;
    const cantidad = Number(root.querySelector<HTMLInputElement>(`input[data-compra="${recurso}"]`)?.value ?? 0);
    return { recurso, cantidad, campamentoId: c.id };
  });
  for (const tipo of ['aportarARefundacion', 'retirarDeRefundacion']) {
    conBoton(`[data-fondo="${tipo}"]`, tipo, () => ({
      recurso: root.querySelector<HTMLSelectElement>('#fondo-recurso')?.value ?? '',
      cantidad: Number(root.querySelector<HTMLInputElement>('#fondo-cantidad')?.value ?? 0),
      lado: 'almacen',
    }));
  }
  conBoton('#btn-comprar-caravana', 'comprarCaravanaDeRefundacion', () => ({}));
}
