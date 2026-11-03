// UNIRSE A UN EJÉRCITO DESDE TU PLAZA (backend `unirseAEjercito`, Doc 5.12.1): cuando un ejército de tu Facción pasa cerca de tu plaza, sacas tropas
// frescas de tu campamento y te sumas a él (y tus víveres se llenan del almacén). Solo un residente, y solo si el ejército está a
// `LOGISTICA.radioReabastecimiento` o menos de la plaza. Es distinto de unirse en campo (`unirseEnCampo`, panel «Ejército» del mapa): aquí aportas tropa
// de casa; allí, lo que ya llevas encima. Desde 0.113.0 ya no tiene botón fijo («Ejércitos», que Víctor quitó el 2026-11-03): su icono sale en
// el riel solo cuando hay a qué unirse (`ejercitosParaUnirse`), y la ventana enseña solo esos ejércitos («solo mostrar lo que se puede hacer»). Respeta la política de unión del ejército (cerrado = no admite a nadie; «decide el Líder» no pide permiso desde la plaza). Lo que aportas se valida contra tu Liderazgo; el rechazo del backend se enseña con su motivo.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeReabastecimiento } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { ejercitosDeLaFaccion, POLITICA } from './ejercitos';
import { chipLiderazgo } from './liderazgo';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';
import { iconoEnFila } from './iconosTropa';

type Escapar = (valor: string) => string;

/** Las escuadras que NO has marcado (por defecto, todas van): sobrevive a los repintados. */
const desmarcadas = new Set<string>();

const resideAqui = (p: ProyeccionJugador, a: Asentamiento): boolean => [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);

const tropaLibre = (p: ProyeccionJugador) => p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);
const distancia = (c: { posicionActual: { x: number; y: number } }, a: Asentamiento): number => Math.round(Math.hypot(c.posicionActual.x - a.posicion.x, c.posicionActual.y - a.posicion.y));

/** Los ejércitos de tu Facción a los que te puedes unir ahora desde esta plaza: residente, con tropa libre en el campamento, la columna abierta
 * y a `radioReabastecimiento` o menos. Vacío si no hay ninguno (y entonces no sale ni el icono). */
export function ejercitosParaUnirse(p: ProyeccionJugador, a: Asentamiento) {
  if (!resideAqui(p, a) || tropaLibre(p).length === 0) return [];
  const radio = radioDeReabastecimiento();
  return ejercitosDeLaFaccion(p).filter((c) => c.tipo === 'ejercito' && !c.formacion && (c.politicaDeUnion ?? 'rechazar') !== 'rechazar' && distancia(c, a) <= radio);
}

export function htmlUnirseDesdePlaza(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const radio = radioDeReabastecimiento();
  const tropa = tropaLibre(p);
  const filas = ejercitosParaUnirse(p, a).map((c) => `<div class="ejercito-fila"><div><strong>Ejército de ${e(c.liderId ? nombreDeHeroe(p, c.liderId) : c.id)}</strong>
        <span>${c.participantes.length} héroe(s) · a ${distancia(c, a)} de la plaza · ${POLITICA[c.politicaDeUnion ?? 'rechazar']}</span></div>
      <button class="btn-primary" type="button" data-unirse-desde-plaza="${e(c.id)}">Unirme con esta tropa</button></div>`);
  return `<span class="faction-kicker">Unirse a un ejército${ayuda('plaza:unirse', `Cuando un ejército de tu Facción pasa cerca de tu plaza (a ${radio} o menos) puedes sumarte a él con tropa fresca de tu campamento. Pasas a ir donde lo dirija su Líder. Unirse en campo, con lo que ya llevas encima, se hace desde el mapa. Un ejército se convoca dentro de un campamento o de una plaza (botón «Salir»), o con «Organizar ejército» en el mapa.`)}</span>
    <strong class="heroe-sub">Tropa que aportas</strong>
    ${tropa.length > 0
      ? `<div class="mapa-lista">${tropa.map((s) => `<label class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div><input type="checkbox" data-aporta="${e(s.id)}"${desmarcadas.has(s.id) ? '' : ' checked'} /></label>`).join('')}</div>`
      : '<p class="asent-lado-nota">No tienes tropa libre en el campamento (la de guarnición no sale).</p>'}
    <strong class="heroe-sub">Ejércitos que pasan cerca</strong>
    ${filas.length > 0 ? filas.join('') : '<p class="mapa-lista-vacia">Ya no hay ninguno a tu alcance.</p>'}
    <p class="faction-error" data-campo="error-unirse-plaza" role="alert"></p>`;
}

export function cablearUnirseDesdePlaza(raiz: ParentNode, p: ProyeccionJugador, a: Asentamiento, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-unirse-plaza"]');
  raiz.querySelectorAll<HTMLInputElement>('input[data-aporta]').forEach((i) => i.addEventListener('change', () => {
    if (i.checked) desmarcadas.delete(i.dataset.aporta!); else desmarcadas.add(i.dataset.aporta!);
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-unirse-desde-plaza]').forEach((b) => b.addEventListener('click', async () => {
    const escuadronIds = Array.from(raiz.querySelectorAll<HTMLInputElement>('input[data-aporta]:checked')).map((i) => i.dataset.aporta!);
    if (escuadronIds.length === 0) { if (error) error.textContent = 'Marca al menos una escuadra que aportar.'; return; }
    b.disabled = true;
    const mensaje = await ejecutar('unirseAEjercito', { ejercitoId: b.dataset.unirseDesdePlaza, asentamientoId: a.id, heroeId: p.heroeId, escuadronIds });
    if (mensaje) { b.disabled = false; if (error) error.textContent = mensaje; }
  }));
}
