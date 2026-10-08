// EJÉRCITOS de tu Facción (backend Doc 5.12 y 5.14): panel «Ejército» del riel del mapa y ficha de un ejército en el panel de Selección.
// Aquí no se decide ninguna regla: el backend valida quién puede unirse, la distancia y el Liderazgo, y el rechazo se enseña con su motivo. Este módulo
// ofrece lo que tiene sentido en cada estado de TU columna:
//   sin columna         estás dentro: se sale como ejército desde «Salir» (campamento) o «Salir al mundo» (plaza)
//   columna personal    `organizarEjercito` (formar con otros dos) o `unirseEnCampo` a un ejército/formación de tu Facción que tengas al lado
//   formación           `cancelarFormacion` (Líder) / `separarseDelEjercito`
//   ejército            Líder: `responderPeticionDeUnion`, `cederLiderazgo`, `estacionarEjercito`, `replegarEjercito`; el resto: `separarseDelEjercito`
// La política de unión («abierto» = aceptar, «decide el Líder» = preguntar, «cerrado» = rechazar) la fija el Líder al formar y no cambia.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeEncuentro } from '../apiCliente';
import type { Ejercito } from '../tiposDominio';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

/** Héroes que hacen falta para que una formación sea un ejército (`FORMACION_EJERCITO.minimo` del backend). */
export const MINIMO_FORMACION = 3;
const MINUTO = 60_000;

export const POLITICA: Record<'aceptar' | 'preguntar' | 'rechazar', string> = {
  aceptar: 'abierto: se une quien llegue',
  preguntar: 'decide el Líder (10 s)',
  rechazar: 'cerrado',
};

const ESTADO: Record<Ejercito['estado'], string> = { marchando: 'en marcha', estacionado: 'acampado', regresando: 'de vuelta' };

const distancia = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

export function miColumna(p: ProyeccionJugador): Ejercito | undefined {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Los ejércitos y formaciones de tu Facción que no son tu columna (llegan completos en `ejercitos`, estén donde estén). */
export function ejercitosDeLaFaccion(p: ProyeccionJugador): Ejercito[] {
  const mi = miColumna(p);
  return p.ejercitos.filter((c) => c.id !== mi?.id && (c.tipo === 'ejercito' || c.formacion !== undefined));
}

/** Las peticiones de unión que siguen vivas (`peticionesDeUnion`; el backend no las caduca: se miran contra el instante de mundo). */
export function peticionesVivas(c: Ejercito, ahora: number): { heroeId: string; pedidoEn: number; expiraEn: number }[] {
  return (c.peticionesDeUnion ?? []).filter((x) => x.expiraEn > ahora);
}

/** Qué impide unirse en campo a ese ejército ahora mismo, o `''` si nada. Es solo un aviso: el backend decide (`unirseEnCampo`). */
export function motivoParaUnirse(p: ProyeccionJugador, c: Ejercito): string {
  const mi = miColumna(p);
  if (!p.faccionId) return 'Un ejército lo componen ciudadanos de una Facción: tú no tienes.';
  if (c.faccionId !== p.faccionId) return 'Solo se unen ciudadanos de su Facción.';
  if (!mi) return 'Para unirte en campo tienes que estar fuera, con tu columna personal.';
  if (mi.id === c.id) return 'Ya vas en esa columna.';
  if (mi.tipo !== 'personal' || mi.formacion || mi.participantes.length > 1) return 'Solo se une una columna personal: sepárate de la tuya antes.';
  const mia = peticionesVivas(c, p.instante).find((x) => x.heroeId === p.heroeId);
  if (mia) return `Petición enviada: el Líder tiene ${Math.max(0, Math.ceil((mia.expiraEn - p.instante) / 1000))} s para contestar.`;
  if ((c.politicaDeUnion ?? 'rechazar') === 'rechazar') return 'Esa columna no admite a nadie más.';
  const lejos = distancia(mi.posicionActual, c.posicionActual);
  if (lejos > radioDeEncuentro()) return `Estás a ${Math.round(lejos)}: hay que estar a ${radioDeEncuentro()} o menos, uno junto al otro.`;
  return '';
}

function filaEjercito(p: ProyeccionJugador, c: Ejercito, e: Escapar): string {
  const mi = miColumna(p);
  const motivo = motivoParaUnirse(p, c);
  const politica = c.politicaDeUnion ?? 'rechazar';
  const lider = c.liderId ? nombreDeHeroe(p, c.liderId) : '—';
  const minutos = c.formacion ? Math.max(0, Math.ceil((c.formacion.expiraEn - p.instante) / MINUTO)) : 0;
  const lejos = mi ? ` · a ${Math.round(distancia(mi.posicionActual, c.posicionActual))} de ti` : '';
  return `<div class="ejercito-fila">
    <div><strong>${c.formacion ? 'Formación' : 'Ejército'} de ${e(lider)}</strong>
      <span>${c.participantes.length} héroe(s)${c.formacion ? ` (hacen falta ${MINIMO_FORMACION}; se deshace en ${minutos} min)` : ` · ${ESTADO[c.estado]}`} · ${POLITICA[politica]}${lejos}</span></div>
    <button class="btn-secondary" type="button" data-centrar-ejercito="${e(c.id)}">Ver</button>
    <button class="btn-primary" type="button" data-unirse-ejercito="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${politica === 'preguntar' ? 'Pedir unirme' : 'Unirme'}</button>
    ${motivo && mi ? `<small>${e(motivo)}</small>` : ''}</div>`;
}

/** «Mi columna»: lo que toca según el estado de la tuya. */
function htmlMiSituacion(p: ProyeccionJugador, mi: Ejercito | undefined, e: Escapar): string {
  if (!mi) return '<p class="asent-lado-nota">Estás dentro. Para salir como ejército, usa «Salir» en un campamento o «Salir al mundo» en tu plaza y elige «Ejército».</p>';
  const lider = mi.liderId === p.heroeId;
  if (mi.formacion) {
    const minutos = Math.max(0, Math.ceil((mi.formacion.expiraEn - p.instante) / MINUTO));
    return `<p class="asent-lado-nota"><strong>Formación</strong>: ${mi.participantes.length}/${MINIMO_FORMACION} héroes, ${POLITICA[mi.politicaDeUnion ?? 'aceptar']}. Se deshace en ${minutos} min si no llegáis a ${MINIMO_FORMACION}. Te quedas quieto hasta entonces.</p>
      ${lider ? '<button class="btn-secondary" type="button" data-ej="cancelar-formacion">Cancelar la formación</button>' : '<button class="btn-secondary" type="button" data-ej="separarme">Separarme</button>'}`;
  }
  if (mi.tipo === 'ejercito') {
    const peticiones = lider ? peticionesVivas(mi, p.instante) : [];
    const resto = mi.participantes.filter((x) => x.heroeId !== p.heroeId);
    return `<p class="asent-lado-nota"><strong>Tu ejército</strong> · ${mi.participantes.length} héroe(s) · ${ESTADO[mi.estado]} · ${POLITICA[mi.politicaDeUnion ?? 'rechazar']}.
        ${mi.destinoPendiente ? (lider ? ' Está formado: haz clic en el mapa para fijar su destino (solo se fija una vez).' : ' Está formado: espera a que su Líder fije el destino.') : ''}</p>
      <ul class="ejercito-lista">${mi.participantes.map((x) => `<li>${e(nombreDeHeroe(p, x.heroeId))}${x.heroeId === mi.liderId ? ' <em>(Líder)</em>' : ''}${x.heroeId === p.heroeId ? ' · tú' : ''}</li>`).join('')}</ul>
      ${peticiones.length > 0 ? `<strong class="heroe-sub">Piden unirse</strong>${peticiones.map((x) => `<div class="ejercito-fila"><div><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong><span>${Math.max(0, Math.ceil((x.expiraEn - p.instante) / 1000))} s para contestar</span></div>
          <button class="btn-primary" type="button" data-peticion="${e(x.heroeId)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-peticion="${e(x.heroeId)}" data-aceptar="no">Rechazar</button></div>`).join('')}` : ''}
      ${lider
        ? `<div class="mapa-seleccion-acciones">
            ${mi.estado === 'marchando' ? '<button class="btn-secondary" type="button" data-ej="estacionar">Acampar aquí</button>' : ''}
            <button class="btn-secondary" type="button" data-ej="replegar">Replegar (cancelar y volver)</button></div>
          ${resto.length > 0 ? `<div class="campamento-fila"><select class="form-input" id="ej-sucesor">${resto.map((x) => `<option value="${e(x.heroeId)}">${e(nombreDeHeroe(p, x.heroeId))}</option>`).join('')}</select><button class="btn-secondary" type="button" data-ej="ceder">Ceder el mando</button></div>
          <p class="asent-lado-nota">El Líder no puede separarse: para irse tiene que ceder el mando antes.</p>` : ''}`
        : '<button class="btn-secondary" type="button" data-ej="separarme">Separarme del ejército</button><p class="asent-lado-nota">Te llevas lo tuyo y vuelves a ser una columna personal donde estés.</p>'}`;
  }
  // Columna personal
  if (mi.participantes.length === 1) {
    return `<p class="asent-lado-nota">Vas por tu cuenta. Con otros dos héroes de tu Facción puedes formar un ejército aquí, sin pasar por una plaza: te quedas quieto hasta que se unan.</p>
      ${p.faccionId ? '' : '<p class="asent-lado-nota"><strong>Sin Facción nadie podrá unirse a ti</strong>: un ejército lo componen ciudadanos de una sola Facción.</p>'}
      <div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-ej="organizar" data-politica="aceptar">Organizar ejército (abierto)</button>
      <button class="btn-secondary" type="button" data-ej="organizar" data-politica="preguntar">Organizar ejército (decido yo)</button></div>`;
  }
  return '';
}

export function htmlPanelEjercito(p: ProyeccionJugador, e: Escapar): string {
  const mi = miColumna(p);
  const otros = ejercitosDeLaFaccion(p);
  return `<span class="faction-kicker">Ejército</span>
    ${htmlMiSituacion(p, mi, e)}
    <strong class="heroe-sub">Ejércitos y formaciones de tu Facción</strong>
    ${otros.length > 0 ? otros.map((c) => filaEjercito(p, c, e)).join('') : '<p class="asent-lado-nota">No hay ninguno. Se forman con «Organizar ejército» en el mapa, o saliendo como ejército de un campamento o de tu plaza.</p>'}
    <p class="faction-error" data-campo="error-ejercito" role="alert"></p>`;
}

/** Cablea los botones del panel y de la ficha: `centrar` lleva el mapa a un punto; `avisar` es el aviso global si no hay dónde escribir el error. */
export function cablearPanelEjercito(raiz: ParentNode, p: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void, centrar?: (punto: { x: number; y: number }) => void): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-ejercito"]');
  const mi = miColumna(p);
  const enviar = async (boton: HTMLButtonElement, tipo: string, params: object, nota?: string): Promise<void> => {
    boton.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    if (mensaje) {
      boton.disabled = false;
      if (error) error.textContent = mensaje; else avisar(mensaje);
    } else if (nota) avisar(nota);
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-centrar-ejercito]').forEach((b) => b.addEventListener('click', () => {
    const c = p.ejercitos.find((x) => x.id === b.dataset.centrarEjercito);
    if (c) centrar?.(c.posicionActual);
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-unirse-ejercito]').forEach((b) => b.addEventListener('click', () => {
    const c = p.ejercitos.find((x) => x.id === b.dataset.unirseEjercito);
    void enviar(b, 'unirseEnCampo', { ejercitoId: b.dataset.unirseEjercito, heroeId: p.heroeId }, c?.politicaDeUnion === 'preguntar' ? 'Petición enviada: el Líder tiene 10 segundos para contestar.' : undefined);
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-ej]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.ej) {
      case 'organizar': return void enviar(b, 'organizarEjercito', { heroeId: p.heroeId, politicaDeUnion: b.dataset.politica });
      case 'cancelar-formacion': return void enviar(b, 'cancelarFormacion', { heroeId: p.heroeId });
      case 'separarme': return void enviar(b, 'separarseDelEjercito', { heroeId: p.heroeId });
      case 'estacionar': return void (mi && enviar(b, 'estacionarEjercito', { ejercitoId: mi.id }));
      case 'replegar':
        if (mi && confirm('¿Replegar el ejército? Cancela la marcha y todos vuelven a su origen.')) void enviar(b, 'replegarEjercito', { ejercitoId: mi.id });
        return;
      case 'ceder': {
        const sucesorId = raiz.querySelector<HTMLSelectElement>('#ej-sucesor')?.value;
        if (mi && sucesorId) void enviar(b, 'cederLiderazgo', { ejercitoId: mi.id, heroeId: p.heroeId, sucesorId });
        return;
      }
    }
  }));
  raiz.querySelectorAll<HTMLButtonElement>('[data-peticion]').forEach((b) => b.addEventListener('click', () => {
    if (mi) void enviar(b, 'responderPeticionDeUnion', { ejercitoId: mi.id, heroeId: p.heroeId, solicitanteId: b.dataset.peticion, aceptar: b.dataset.aceptar === 'si' });
  }));
}

/** Ficha de un ejército de tu Facción en el panel de Selección del mapa. */
export function htmlFichaEjercito(p: ProyeccionJugador, c: Ejercito, e: Escapar): string {
  const politica = c.politicaDeUnion ?? 'rechazar';
  const motivo = motivoParaUnirse(p, c);
  return `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${c.formacion ? 'Formación' : 'Ejército'} de tu Facción</span>
    <h3>${e(c.liderId ? nombreDeHeroe(p, c.liderId) : c.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Héroes</span><strong>${c.participantes.length}</strong></div>
      <div><span>Estado</span><strong>${c.formacion ? 'formándose' : ESTADO[c.estado]}</strong></div>
      <div><span>Unión</span><strong>${POLITICA[politica]}</strong></div></div>
    <ul class="ejercito-lista">${c.participantes.map((x) => `<li>${e(nombreDeHeroe(p, x.heroeId))}${x.heroeId === c.liderId ? ' <em>(Líder)</em>' : ''}</li>`).join('')}</ul>
    <div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-unirse-ejercito="${e(c.id)}"${motivo ? ' disabled' : ''}>${politica === 'preguntar' ? 'Pedir unirme' : 'Unirme'}</button></div>
    ${motivo ? `<p class="mapa-lista-vacia">${e(motivo)}</p>` : '<p class="mapa-lista-vacia">Estás junto a él con tu columna personal: te unes con lo que llevas encima (tropa y carro) y adoptas su destino, que ya no podrás cambiar.</p>'}
    <p class="faction-error" data-campo="error-ejercito" role="alert"></p>`;
}

/** Peticiones de unión a tu ejército ya avisadas (`heroeId@expiraEn`, el mismo `expiraEn` en la petición y en el evento `columna.union_pedida`): el aviso por
 * evento y el de sondeo no se duplican. */
const peticionesAvisadas = new Set<string>();

/** `true` la primera vez que se ve esa petición. */
export function esPeticionNueva(heroeId: string, expiraEn: number): boolean {
  const clave = `${heroeId}@${expiraEn}`;
  if (peticionesAvisadas.has(clave)) return false;
  peticionesAvisadas.add(clave);
  return true;
}

/** Las peticiones vivas a tu ejército que aún no avisaste, por sondeo (por si el evento `columna.union_pedida` no llega a tiempo). */
export function peticionesNuevas(p: ProyeccionJugador): { heroeId: string; expiraEn: number }[] {
  const mi = miColumna(p);
  if (!mi || mi.liderId !== p.heroeId) return [];
  return peticionesVivas(mi, p.instante).filter((x) => esPeticionNueva(x.heroeId, x.expiraEn));
}
