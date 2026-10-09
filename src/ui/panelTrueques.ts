// Subpestaña «TRUEQUES» de Mercado (backend Doc 3.2): contratos marco entre DOS plazas, cada lado con una o varias líneas (recurso + cantidad).
// `proponerTrueque { asentamientoAId, lineasA, asentamientoBId, lineasB }` (A = esta plaza; solo sus residentes), y el lado receptor (B) contesta con
// `aceptarTrueque`/`rechazarTrueque { acuerdoId }` (solo sus residentes). Una propuesta no obliga a nadie hasta el sí; el plazo para cumplir se cuenta desde el sí.
// Plazos, reparto en caravanas y penalizaciones los decide el servidor: aquí se enseña el rechazo tal cual.
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { AcuerdoTrueque, LineaTrueque } from '../tiposDominio';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';

const RECURSOS = Object.keys(RECURSO_NOMBRE);
const FILAS_POR_LADO = 3;
const ESTADO: Record<AcuerdoTrueque['estado'], string> = {
  propuesto: 'sin contestar',
  activo: 'en vigor',
  rechazado: 'rechazado',
  cumplido: 'cumplido',
  expirado: 'expirado',
};

function falta(hasta: number, instante: number): string {
  const ms = hasta - instante;
  if (ms <= 0) return 'ya';
  const min = ms / 60_000;
  return min >= 60 ? `${Math.round(min / 60)} h` : min >= 1 ? `${Math.round(min)} min` : `${Math.round(ms / 1000)} s`;
}

function nombrePlaza(c: ContextoPlaza, id: string): string {
  const p = c.proyeccion;
  return p.asentamientos.find((x) => x.id === id)?.nombre ?? p.asentamientosAvistados.find((x) => x.id === id)?.nombre ?? p.asentamientosConocidos.find((x) => x.asentamientoId === id)?.nombre ?? id;
}

function lineas(ls: LineaTrueque[], activo: boolean, c: ContextoPlaza): string {
  return ls.map((l) => `${RECURSO_ICONO[l.recurso] ?? '📦'} ${c.escapar(RECURSO_NOMBRE[l.recurso] ?? l.recurso)} ${activo ? `${Math.floor(l.cantidadEntregada)}/` : ''}${Math.floor(l.cantidadTotal)}`).join(' · ');
}

function tarjeta(a: AcuerdoTrueque, c: ContextoPlaza): string {
  const e = c.escapar;
  const recibido = a.asentamientoBId === c.asentamiento.id;
  const pendiente = a.estado === 'propuesto';
  const mostrarProgreso = a.estado === 'activo' || a.estado === 'cumplido';
  const plazo = pendiente ? `contestar en ${falta(a.expiraEn, c.proyeccion.instante)}` : a.estado === 'activo' ? `cumplir en ${falta(a.expiraEn, c.proyeccion.instante)}` : '';
  const quien = pendiente ? (recibido ? 'te toca contestar a ti' : 'espera la respuesta de la otra plaza') : '';
  const acciones = pendiente && recibido
    ? `<div class="mercado-acciones">
        <button class="btn-primary" type="button" data-trueque-aceptar="${e(a.id)}"${c.resideAqui ? '' : ' disabled title="Solo contestan los residentes de esta plaza"'}>Aceptar</button>
        <button class="btn-secondary" type="button" data-trueque-rechazar="${e(a.id)}"${c.resideAqui ? '' : ' disabled title="Solo contestan los residentes de esta plaza"'}>Rechazar</button>
      </div>` : '';
  return `<div class="mapa-lista-item"><div>
      <strong>${e(nombrePlaza(c, a.asentamientoAId))} ⇄ ${e(nombrePlaza(c, a.asentamientoBId))} · ${ESTADO[a.estado]}</strong>
      <span>${e(nombrePlaza(c, a.asentamientoAId))} da: ${lineas(a.lineasA, mostrarProgreso, c)}</span>
      <span>${e(nombrePlaza(c, a.asentamientoBId))} da: ${lineas(a.lineasB, mostrarProgreso, c)}</span>
      ${plazo || quien ? `<span>${[quien, plazo].filter(Boolean).join(' · ')}</span>` : ''}
    </div>${acciones}</div>`;
}

function filasLado(lado: 'A' | 'B'): string {
  const opciones = RECURSOS.map((r) => `<option value="${r}">${RECURSO_ICONO[r] ?? '📦'} ${RECURSO_NOMBRE[r]}</option>`).join('');
  return Array.from({ length: FILAS_POR_LADO }, (_, i) => `<div class="carro-fila">
      <select class="form-input" data-trueque-recurso="${lado}${i}"><option value="">— sin línea —</option>${opciones}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="Cantidad" data-trueque-cantidad="${lado}${i}" />
    </div>`).join('');
}

function html(c: ContextoPlaza): string {
  const p = c.proyeccion;
  const a = c.asentamiento;
  const mios = p.acuerdos.filter((x) => x.asentamientoAId === a.id || x.asentamientoBId === a.id);
  const vivos = mios.filter((x) => x.estado === 'propuesto' || x.estado === 'activo');
  const cerrados = mios.filter((x) => x.estado !== 'propuesto' && x.estado !== 'activo');
  const destinos = [
    ...p.asentamientos.filter((x) => x.id !== a.id).map((x) => ({ id: x.id, nombre: x.nombre ?? x.id })),
    ...p.asentamientosAvistados.map((x) => ({ id: x.id, nombre: x.nombre ?? x.id })),
    ...p.asentamientosConocidos.map((x) => ({ id: x.asentamientoId, nombre: x.nombre ?? x.asentamientoId })),
  ].filter((x, i, v) => x.id !== a.id && v.findIndex((y) => y.id === x.id) === i);
  return `<span class="faction-kicker">Trueques</span>
    <p class="asent-lado-nota">Un trueque es un pacto entre dos plazas: cada una se compromete a entregar sus líneas, que van en caravanas. No obliga a nadie hasta que la otra plaza dice que sí; una propuesta sin contestar caduca sin castigo. Aceptado, el plazo corre desde el sí, y vencer sin cumplir resta reputación a cada lado en proporción a lo que dejó sin entregar (Doc 2.7).</p>
    <strong class="heroe-sub">En curso en esta plaza</strong>
    ${vivos.length === 0 ? '<p class="mapa-lista-vacia">No hay trueques propuestos ni en vigor.</p>' : `<div class="mapa-lista">${vivos.map((x) => tarjeta(x, c)).join('')}</div>`}
    ${cerrados.length === 0 ? '' : `<strong class="heroe-sub">Cerrados</strong><div class="mapa-lista">${cerrados.map((x) => tarjeta(x, c)).join('')}</div>`}
    <strong class="heroe-sub">Proponer un trueque</strong>
    ${!c.resideAqui ? '<p class="asent-lado-nota">Solo quien reside en esta plaza propone trueques en su nombre.</p>'
      : destinos.length === 0 ? '<p class="asent-lado-nota">No conoces otra plaza con la que pactar.</p>'
        : `<select class="form-input" data-trueque-destino>${destinos.map((x) => `<option value="${c.escapar(x.id)}">${c.escapar(x.nombre)}</option>`).join('')}</select>
      <strong class="heroe-sub">${c.escapar(a.nombre ?? a.id)} entrega</strong>${filasLado('A')}
      <strong class="heroe-sub">La otra plaza entrega</strong>${filasLado('B')}
      <button class="btn-primary" type="button" data-trueque-proponer>Proponer trueque</button>
      <p class="asent-lado-nota">Hasta ${FILAS_POR_LADO} líneas por lado, sin repetir recurso. Deja en blanco las que no uses.</p>`}
    <p class="faction-error" data-campo="error-trueques" role="alert"></p>`;
}

function cablear(c: ContextoPlaza): void {
  const raiz = c.cuerpo;
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-trueques"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-trueque-aceptar]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'aceptarTrueque', { acuerdoId: b.dataset.truequeAceptar! })));
  raiz.querySelectorAll<HTMLButtonElement>('[data-trueque-rechazar]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'rechazarTrueque', { acuerdoId: b.dataset.truequeRechazar! })));
  const proponer = raiz.querySelector<HTMLButtonElement>('[data-trueque-proponer]');
  const leer = (lado: 'A' | 'B'): { recurso: string; cantidad: number }[] => Array.from({ length: FILAS_POR_LADO }, (_, i) => ({
    recurso: raiz.querySelector<HTMLSelectElement>(`[data-trueque-recurso="${lado}${i}"]`)?.value ?? '',
    cantidad: Number(raiz.querySelector<HTMLInputElement>(`[data-trueque-cantidad="${lado}${i}"]`)?.value),
  })).filter((l) => l.recurso !== '' || l.cantidad > 0);
  proponer?.addEventListener('click', () => {
    const lineasA = leer('A');
    const lineasB = leer('B');
    if ([...lineasA, ...lineasB].some((l) => !l.recurso || !(l.cantidad >= 1))) { if (error) error.textContent = 'Cada línea necesita recurso y una cantidad de 1 o más.'; return; }
    if (lineasA.length === 0 || lineasB.length === 0) { if (error) error.textContent = 'Cada lado tiene que ofrecer al menos una línea.'; return; }
    void lanzar(proponer, 'proponerTrueque', { asentamientoAId: c.asentamiento.id, lineasA, asentamientoBId: raiz.querySelector<HTMLSelectElement>('[data-trueque-destino]')!.value, lineasB });
  });
}

export const SUBPESTANA_TRUEQUES: SubpestanaPlaza = { id: 'trueques', etiqueta: 'Trueques', html, cablear };
