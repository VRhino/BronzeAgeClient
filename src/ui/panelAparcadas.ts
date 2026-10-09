// Subpestaña «APARCADAS» de Mercado (backend Doc 3.13.7 y Ocupacion_Post_Conquista §2.3d): una caravana `estado: 'aparcada'` que su ejército dejó aquí al entrar.
// Sigue siendo de su ORIGEN: no la usa esta plaza, intercambia carga con el almacén de la anfitriona (`moverCargaCaravanaAparcada`) y solo sale enganchada a un
// ejército o enviada a su origen (`enviarCaravanaAlOrigen`). Operarla exige ser residente del ORIGEN y estar presente aquí; la capacidad y lo que cabe lo topa el servidor.
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Caravana } from '../tiposDominio';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';

function motivoBloqueo(k: Caravana, c: ContextoPlaza): string | null {
  const origen = c.proyeccion.asentamientos.find((x) => x.id === k.origenAsentamientoId);
  const reside = origen && [...(origen.heroesFundadoresIds ?? []), ...(origen.casasCompradas ?? [])].includes(c.proyeccion.heroeId);
  // Sin la ficha del origen no se sabe: se deja probar y el servidor contesta.
  return origen && !reside ? 'Solo los residentes del origen de la caravana la manejan.' : null;
}

function tarjeta(k: Caravana, c: ContextoPlaza): string {
  const e = c.escapar;
  const p = c.proyeccion;
  const origen = p.asentamientos.find((x) => x.id === k.origenAsentamientoId)?.nombre ?? p.asentamientosConocidos.find((x) => x.asentamientoId === k.origenAsentamientoId)?.nombre ?? k.origenAsentamientoId;
  const carga = Object.entries(k.contenido ?? {}).filter(([, n]) => n > 0);
  const almacen = Object.entries(c.asentamiento.almacen ?? {}).filter(([r]) => r !== 'oro');
  const recursos = [...new Set([...carga.map(([r]) => r), ...almacen.map(([r]) => r)])];
  const motivo = motivoBloqueo(k, c);
  const dis = motivo ? ` disabled title="${e(motivo)}"` : '';
  return `<div class="escolta-caravana"><strong class="heroe-sub">Caravana ${e(k.id)} · de ${e(origen)}</strong>
    <p class="asent-lado-nota">Lleva: ${carga.length === 0 ? 'nada' : carga.map(([r, n]) => `${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)} ${Math.floor(n)}`).join(' · ')}</p>
    ${motivo ? `<p class="asent-lado-nota">${e(motivo)}</p>` : ''}
    <div class="mercado-acciones">
      <select class="form-input" data-aparcada-recurso="${e(k.id)}">${recursos.map((r) => `<option value="${e(r)}">${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)} (carro ${Math.floor(k.contenido?.[r] ?? 0)} · almacén ${Math.floor(c.asentamiento.almacen?.[r]?.cantidad ?? 0)})</option>`).join('')}</select>
      <input class="form-input" type="number" min="1" step="1" placeholder="Cantidad" data-aparcada-cantidad="${e(k.id)}" />
      <button class="btn-secondary" type="button" data-aparcada-mover="${e(k.id)}:cargar"${dis}>Cargar (almacén → carro)</button>
      <button class="btn-secondary" type="button" data-aparcada-mover="${e(k.id)}:descargar"${dis}>Descargar (carro → almacén)</button>
    </div>
    <div class="mercado-acciones"><button class="btn-primary" type="button" data-aparcada-origen="${e(k.id)}"${dis}>Enviar a su origen</button></div>
    <p class="asent-lado-nota">Vacía, aparece en su origen al instante; con carga, vuelve por el camino y la deja allí al llegar.</p>
  </div>`;
}

function html(c: ContextoPlaza): string {
  const aqui = c.proyeccion.caravanas.filter((k) => k.estado === 'aparcada' && k.posicionActual.x === c.asentamiento.posicion.x && k.posicionActual.y === c.asentamiento.posicion.y);
  return `<span class="faction-kicker">Caravanas aparcadas</span>
    <p class="asent-lado-nota">Caravanas de tu Facción que un ejército dejó aquí al entrar. No las usa esta plaza: puedes pasar carga entre su carro y el almacén, y solo salen enganchadas a un ejército (desde el panel del ejército) o enviadas a su origen.</p>
    ${aqui.length === 0 ? '<p class="mapa-lista-vacia">No hay caravanas aparcadas en esta plaza.</p>' : aqui.map((k) => tarjeta(k, c)).join('')}
    <p class="faction-error" data-campo="error-aparcadas" role="alert"></p>`;
}

function cablear(c: ContextoPlaza): void {
  const raiz = c.cuerpo;
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-aparcadas"]');
  const lanzar = async (boton: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    boton.disabled = true;
    const mensaje = await c.ejecutar(tipo, params);
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  const base = { heroeId: c.proyeccion.heroeId, asentamientoId: c.asentamiento.id };
  raiz.querySelectorAll<HTMLButtonElement>('[data-aparcada-mover]').forEach((b) => b.addEventListener('click', () => {
    const [caravanaId, sentido] = b.dataset.aparcadaMover!.split(':');
    const recurso = raiz.querySelector<HTMLSelectElement>(`[data-aparcada-recurso="${caravanaId}"]`)?.value;
    const cantidad = Number(raiz.querySelector<HTMLInputElement>(`[data-aparcada-cantidad="${caravanaId}"]`)?.value);
    if (!recurso || !(cantidad >= 1)) { if (error) error.textContent = 'Elige un recurso y una cantidad de 1 o más.'; return; }
    void lanzar(b, 'moverCargaCaravanaAparcada', { ...base, caravanaId, recurso, cantidad, sentido });
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-aparcada-origen]').forEach((b) => b.addEventListener('click', () => void lanzar(b, 'enviarCaravanaAlOrigen', { ...base, caravanaId: b.dataset.aparcadaOrigen! })));
}

export const SUBPESTANA_APARCADAS: SubpestanaPlaza = { id: 'aparcadas', etiqueta: 'Aparcadas', html, cablear };
