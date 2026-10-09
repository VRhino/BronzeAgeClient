// UNIRSE A UN EJÉRCITO DESDE TU PLAZA (backend `unirseAEjercito`, Doc 5.12.1): cuando un ejército de tu Facción pasa cerca de tu plaza, sacas tropas
// frescas de tu campamento y te sumas a él (y tus víveres se llenan del almacén). Solo un residente, y solo si el ejército está a
// `LOGISTICA.radioReabastecimiento` o menos de la plaza. Es distinto de unirse en campo (`unirseEnCampo`, panel «Ejército» del mapa): aquí aportas tropa
// de casa; allí, lo que ya llevas encima. Respeta la política de unión del ejército (cerrado = no admite a nadie; «decide el Líder» no pide permiso desde la plaza). Lo que aportas se valida contra tu Liderazgo; el rechazo del backend se enseña con su motivo.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeReabastecimiento } from '../apiCliente';
import type { Asentamiento } from '../tiposDominio';
import { ayuda } from './ayuda';
import { ejercitosDeLaFaccion, POLITICA } from './ejercitos';
import { chipLiderazgo } from './liderazgo';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

/** Las escuadras que NO has marcado (por defecto, todas van): sobrevive a los repintados. */
const desmarcadas = new Set<string>();

const resideAqui = (p: ProyeccionJugador, a: Asentamiento): boolean => [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);

export function htmlUnirseDesdePlaza(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const radio = radioDeReabastecimiento();
  const tropa = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);
  const ejercitos = ejercitosDeLaFaccion(p).filter((c) => c.tipo === 'ejercito' && !c.formacion);
  const reside = resideAqui(p, a);
  const filas = ejercitos.map((c) => {
    const d = Math.round(Math.hypot(c.posicionActual.x - a.posicion.x, c.posicionActual.y - a.posicion.y));
    const motivo = (c.politicaDeUnion ?? 'rechazar') === 'rechazar' ? 'Esa columna no admite a nadie más (política cerrada).' : !reside ? 'Solo un residente de la plaza saca tropas de ella.' : tropa.length === 0 ? 'No tienes tropa libre en el campamento.' : d > radio ? `Está a ${d} de la plaza: hace falta ${radio} o menos.` : '';
    return `<div class="ejercito-fila"><div><strong>Ejército de ${e(c.liderId ? nombreDeHeroe(p, c.liderId) : c.id)}</strong>
        <span>${c.participantes.length} héroe(s) · a ${d} de la plaza · ${POLITICA[c.politicaDeUnion ?? 'rechazar']}</span></div>
      <button class="btn-primary" type="button" data-unirse-desde-plaza="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>Unirme con esta tropa</button>${motivo ? `<small>${e(motivo)}</small>` : ''}</div>`;
  });
  return `<span class="faction-kicker">Unirse a un ejército${ayuda('plaza:unirse', `Cuando un ejército de tu Facción pasa cerca de tu plaza (a ${radio} o menos) puedes sumarte a él con tropa fresca de tu campamento. Pasas a ir donde lo dirija su Líder. Unirse en campo, con lo que ya llevas encima, se hace desde el mapa. Un ejército se convoca dentro de un campamento o de una plaza (botón «Salir»), o con «Organizar ejército» en el mapa.`)}</span>
    <strong class="heroe-sub">Tropa que aportas</strong>
    ${tropa.length > 0
      ? `<div class="mapa-lista">${tropa.map((s) => `<label class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div><input type="checkbox" data-aporta="${e(s.id)}"${desmarcadas.has(s.id) ? '' : ' checked'} /></label>`).join('')}</div>`
      : '<p class="asent-lado-nota">No tienes tropa libre en el campamento (la de guarnición no sale).</p>'}
    <strong class="heroe-sub">Ejércitos de tu Facción</strong>
    ${filas.length > 0 ? filas.join('') : '<p class="mapa-lista-vacia">Ninguno en marcha.</p>'}
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
