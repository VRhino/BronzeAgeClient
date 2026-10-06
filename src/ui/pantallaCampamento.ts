// Pantalla CAMPAMENTO (backend 2026-10-04, Doc 1.9b): el héroe nace DENTRO de un campamento de mercenarios y vuelve a él.
// Se organiza como la del asentamiento: la planta a la izquierda y, a la derecha, subpestañas (Resumen · Salir · Tropa · Mercado ·
// Fondo · Taberna) en vez de una sola columna larga. Aquí no se decide ninguna regla: quien valida es el backend, y su rechazo sale
// tal cual en `#camp-error`. Los menús del jugador (héroe, escuadras, Facción) están en la barra superior (`barraJugador.ts`).
import type { ProyeccionJugador } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_NOMBRE } from '../paletas';
import type { CampamentoMercenarios, Escuadron } from '../tiposDominio';

/** Manda el comando y refresca; devuelve el mensaje de error o `null`. Lo pone `main.ts`. */
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;
type Escapar = (valor: string) => string;

export type SeccionCampamento = 'resumen' | 'salir' | 'tropa' | 'mercado' | 'fondo' | 'taberna';

const ETIQUETA: Record<SeccionCampamento, string> = { resumen: 'Resumen', salir: 'Salir', tropa: 'Tropa', mercado: 'Mercado', fondo: 'Fondo', taberna: 'Taberna' };

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

/** Las subpestañas que hay ahora: el Fondo de refundación solo aparece mientras tu Facción no tiene plaza. */
export function seccionesDeCampamento(p: ProyeccionJugador): { id: SeccionCampamento; etiqueta: string }[] {
  const ids: SeccionCampamento[] = ['resumen', 'salir', 'tropa', 'mercado', ...(p.faccionId !== null && !faccionConPlaza(p) ? ['fondo' as const] : []), 'taberna'];
  return ids.map((id) => ({ id, etiqueta: ETIQUETA[id] }));
}

function listaRecursos(recursos: Record<string, number>, e: Escapar): string {
  const filas = Object.entries(recursos).filter(([, n]) => n > 0);
  return filas.length > 0
    ? `<div class="asent-ficha-grid">${filas.map(([r, n]) => `<div><span>${e(nombreRecurso(r))}</span><strong>${Math.floor(n)}</strong></div>`).join('')}</div>`
    : '<p class="asent-lado-nota">Nada.</p>';
}

/** Dónde está una escuadra, dicho como lo entiende el jugador: la tropa de una columna aparcada en la puerta NO está «en el campamento». */
function dondeEstaLaEscuadra(s: Escuadron, p: ProyeccionJugador): string {
  const c = s.contenedor;
  if (c.tipo === 'campamento') return 'en el campamento';
  if (c.tipo === 'escolta') return 'escoltando una caravana';
  if (c.tipo === 'fuera') return 'fuera del mundo';
  const columna = p.ejercitos.find((x) => x.id === c.ejercitoId);
  return columna?.estado === 'estacionado' ? 'en tu columna, aparcada en la puerta' : 'en tu columna';
}

function filaEscuadra(s: Escuadron, p: ProyeccionJugador, e: Escapar): string {
  return `<div class="mapa-lista-item"><strong>${e(s.nombre)}</strong><span>${s.cantidad} hombres · ${dondeEstaLaEscuadra(s, p)}${s.prestada ? ' · prestada' : ''}</span></div>`;
}

function resumen(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const edificios = [...new Set(c.edificios)].map((t) => EDIFICIO_NOMBRE[t] ?? t);
  return `
    <div class="asent-ficha-grid">
      <div><span>Residentes</span><strong>${c.residentesIds.length}</strong></div>
      <div><span>Oro de botín</span><strong>${Math.floor(heroe.oroDeBotin ?? 0)}</strong></div>
    </div>
    ${resides
      ? '<p class="asent-lado-nota">Este campamento es tu residencia: aquí guardas tu almacén, te prestan tropa y compras en el mercado completo.</p>'
      : '<button class="btn-secondary" type="button" id="btn-residir">Residir aquí</button><p class="asent-lado-nota">No resides aquí: sales con la columna con la que entraste y solo te venden trigo. Si te mudas, la tropa prestada por tu campamento anterior se te retira.</p>'}
    ${p.faccionId === null ? '<p class="asent-lado-nota">Aún no tienes Facción: abre «Facción» en la barra de arriba para crear una o pedir ingreso.</p>' : ''}
    <strong class="heroe-sub">Tu tropa</strong>
    ${heroe.escuadrones.length > 0 ? `<div class="mapa-lista">${heroe.escuadrones.map((s) => filaEscuadra(s, p, e)).join('')}</div>` : '<p class="asent-lado-nota">No tienes tropa. En la pestaña Tropa te prestan una.</p>'}
    <strong class="heroe-sub">Tu almacén</strong>
    ${listaRecursos(heroe.almacenPersonal ?? {}, e)}
    <strong class="heroe-sub">Edificios del campamento</strong>
    <p class="asent-lado-nota">${edificios.map(e).join(' · ') || 'Ninguno.'}</p>`;
}

function salir(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const resides = c.residentesIds.includes(heroe.id);
  const almacen = heroe.almacenPersonal ?? {};
  const enCampamento = heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento');
  const aparcadas = heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito');
  if (!resides) {
    return `<p class="asent-lado-nota">Sales con la columna con la que entraste, tal cual${aparcadas.length > 0 ? `: ${aparcadas.map((s) => `${e(s.nombre)} (${s.cantidad})`).join(', ')}` : ''}.</p>
      <button class="btn-primary" type="button" id="btn-salir-campamento">Salir</button>`;
  }
  return `
    <p class="asent-lado-nota">Elige la tropa que sacas y lo que cargas de tu almacén. Recibes además la ración gratis de trigo.</p>
    <div class="mapa-lista">${enCampamento.length > 0
      ? enCampamento.map((s) => `<label class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong><span>${s.cantidad} hombres</span></div><input type="checkbox" data-salir-escuadra="${e(s.id)}" checked /></label>`).join('')
      : '<p class="asent-lado-nota">No tienes tropa en el campamento.</p>'}</div>
    ${Object.entries(almacen).filter(([, n]) => n > 0).map(([r, n]) => `<label class="campamento-fila"><span>${e(nombreRecurso(r))} (hay ${Math.floor(n)})</span><input class="form-input" type="number" min="0" max="${Math.floor(n)}" value="0" data-carga="${e(r)}" /></label>`).join('')}
    <button class="btn-primary" type="button" id="btn-salir-campamento">Salir</button>`;
}

function tropa(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  if (!c.residentesIds.includes(heroe.id)) return '<p class="asent-lado-nota">Solo te prestan tropa en el campamento donde resides.</p>';
  const prestadas = new Map(heroe.escuadrones.filter((s) => s.prestada).map((s) => [s.tropaId, s] as const));
  return `
    <p class="asent-lado-nota">Gratis, para aprender a usar tropa antes de tener la tuya. No gana experiencia. Se retira si dejas de residir en este campamento.</p>
    <div class="mapa-lista">${TROPAS_PRESTAMO.map(([id, nombre]) => {
      const ya = prestadas.get(id);
      return `<label class="mapa-lista-item"><div><strong>${nombre}</strong><span>${ya ? `ya la tienes: ${ya.cantidad} hombres, ${dondeEstaLaEscuadra(ya, p)}` : '15 hombres'}</span></div><input type="checkbox" data-prestamo="${id}"${ya ? ' disabled' : ''} /></label>`;
    }).join('')}</div>
    <div class="mapa-seleccion-acciones">
      <button class="btn-secondary" type="button" id="btn-pedir-prestamo">Pedir</button>
      ${prestadas.size > 0 ? '<button class="btn-secondary" type="button" id="btn-reponer-prestamo">Reponer bajas</button>' : ''}
    </div>
    <strong class="heroe-sub">Toda tu tropa</strong>
    ${heroe.escuadrones.length > 0 ? `<div class="mapa-lista">${heroe.escuadrones.map((s) => filaEscuadra(s, p, e)).join('')}</div>` : '<p class="asent-lado-nota">Ninguna.</p>'}`;
}

function mercado(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const resides = c.residentesIds.includes(p.heroe.id);
  const enVenta = Object.entries(c.mercado).filter(([r, n]) => n > 0 && (resides || r === 'trigo'));
  return `
    ${resides ? '' : '<p class="asent-lado-nota">Si no resides aquí, solo te venden trigo, y va al carro de tu columna.</p>'}
    ${enVenta.length > 0
      ? enVenta.map(([r, n]) => `<div class="campamento-fila"><span>${e(nombreRecurso(r))} (${Math.floor(n)})</span><input class="form-input" type="number" min="1" max="${Math.floor(n)}" value="10" data-compra="${e(r)}" /><button class="btn-secondary" type="button" data-comprar="${e(r)}">Comprar</button></div>`).join('')
      : '<p class="asent-lado-nota">Nada en venta.</p>'}`;
}

function fondo(p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  const heroe = p.heroe;
  const almacen = heroe.almacenPersonal ?? {};
  const fondoDeFaccion: Record<string, number> = {};
  const ciudadanos = new Set(p.facciones.find((f) => f.id === p.faccionId)?.ciudadanosIds ?? []);
  for (const [heroeId, aporte] of Object.entries(c.fondos)) {
    if (!ciudadanos.has(heroeId)) continue;
    for (const [r, n] of Object.entries(aporte)) fondoDeFaccion[r] = (fondoDeFaccion[r] ?? 0) + n;
  }
  const caravana = p.caravanas.find((k) => k.origenCampamentoId === c.id && k.faccionId === p.faccionId);
  const recursosAportables = [...new Set([...Object.keys(almacen), ...(heroe.oroDeBotin ? ['oro'] : [])])];
  return `
    <p class="asent-lado-nota">Lo que los ciudadanos de tu Facción reúnen aquí para comprar la Caravana de Fundación. Lo tuyo se retira mientras no se gaste.</p>
    ${listaRecursos(fondoDeFaccion, e)}
    <div class="campamento-fila">
      <select class="form-input" id="fondo-recurso">${recursosAportables.map((r) => `<option value="${e(r)}">${e(nombreRecurso(r))}</option>`).join('')}</select>
      <input class="form-input" id="fondo-cantidad" type="number" min="1" value="10" />
    </div>
    <div class="mapa-seleccion-acciones">
      <button class="btn-secondary" type="button" data-fondo="aportarARefundacion">Aportar</button>
      <button class="btn-secondary" type="button" data-fondo="retirarDeRefundacion">Retirar</button>
      <button class="btn-primary" type="button" id="btn-comprar-caravana"${caravana ? ' disabled' : ''}>Comprar caravana</button>
    </div>
    ${caravana ? `<p class="asent-lado-nota">Caravana de Fundación lista${caravana.titularId === heroe.id ? ', y la llevas tú' : ''}: sal con tu columna, engánchala en el mapa y funda donde quieras (panel ⌂).</p>` : ''}`;
}

/** El HTML de una subpestaña. La Taberna (intel) la pinta `main.ts` en `#camp-taberna`, porque comparte panel con la plaza. */
export function htmlSeccionCampamento(seccion: SeccionCampamento, p: ProyeccionJugador, c: CampamentoMercenarios, e: Escapar): string {
  switch (seccion) {
    case 'resumen': return resumen(p, c, e);
    case 'salir': return salir(p, c, e);
    case 'tropa': return tropa(p, c, e);
    case 'mercado': return mercado(p, c, e);
    case 'fondo': return fondo(p, c, e);
    case 'taberna': return '<div id="camp-taberna"></div>';
  }
}

/** Cablea los botones de la subpestaña pintada. Tras un éxito refresca `ejecutar`, y el router decide la pantalla. */
export function cablearCampamento(root: HTMLElement, p: ProyeccionJugador, c: CampamentoMercenarios, ejecutar: Ejecutar): void {
  const error = root.querySelector<HTMLElement>('#camp-error');
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
