// EJÉRCITOS de tu Facción (backend Doc 5.12 y 5.14): la ventana «Ejército» del riel del mapa (centrada, como la de Misiones, desde la 0.132.0: quiénes
// van con su tropa, la carga, las caravanas y lo que toca hacer), la pestaña «Ejércitos» de la Facción (los demás ejércitos y formaciones, para verlos y
// unirse) y la ficha de un ejército en el panel de Selección.
// Aquí no se decide ninguna regla: el backend valida quién puede unirse, la distancia y el Liderazgo, y el rechazo se enseña con su motivo. Este módulo
// ofrece lo que tiene sentido en cada estado de TU columna:
//   sin columna         estás dentro: se sale como ejército desde «Salir» (campamento) o «Salir al mundo» (plaza)
//   columna personal    `organizarEjercito` (formar con otros dos) o `unirseEnCampo` a un ejército/formación de tu Facción que tengas al lado
//   formación           `cancelarFormacion` (Líder) / `separarseDelEjercito`
//   ejército            Líder: `responderPeticionDeUnion`, `cederLiderazgo`, `estacionarEjercito`, `replegarEjercito`; el resto: `separarseDelEjercito`
// La marcha forzada se pone junto a los víveres, abajo en el mapa (`main.ts`); desde la 0.132.0 ya no sale aquí.
// La política de unión («abierto» = aceptar, «decide el Líder» = preguntar, «cerrado» = rechazar) la fija el Líder al formar y no cambia.
import type { ProyeccionJugador } from '../apiCliente';
import { radioDeEncuentro, radioDePuerta } from '../apiCliente';
import type { Ejercito } from '../tiposDominio';
import { ayuda } from './ayuda';
import { nombreDeHeroe } from './nombres';
import { textoEnTiempoReal } from './estadoCliente';
import { ocupacion, type Ejecutar } from './panelCarro';
import { tropasReclutables } from '../apiCliente';
import { iconoEnFila } from './iconosTropa';
import { nombreDeCaravana } from './panelMercado';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { confirmar } from './dialogo';

type Escapar = (valor: string) => string;

/** Héroes que hacen falta para que una formación sea un ejército (`FORMACION_EJERCITO.minimo` del backend). */
export const MINIMO_FORMACION = 3;

export const POLITICA: Record<'aceptar' | 'preguntar' | 'rechazar', string> = {
  aceptar: 'abierto: se une quien llegue',
  preguntar: 'decide el Líder (10 s)',
  rechazar: 'cerrado',
};

const ESTADO: Record<Ejercito['estado'], string> = { marchando: 'en marcha', estacionado: 'acampado', regresando: 'de vuelta' };

const distancia = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** ¿Va el héroe a bordo de su columna a la puerta de `punto` (a `radioDePuerta` o menos), sin entrar? Lo que el motor 906fb24 acepta además de dentro. */
export function columnaALaPuerta(p: ProyeccionJugador, punto: { x: number; y: number }): boolean {
  const c = miColumna(p);
  return c !== undefined && Math.hypot(c.posicionActual.x - punto.x, c.posicionActual.y - punto.y) <= radioDePuerta();
}

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
  if (mia) return `Petición enviada: el Líder tiene ${textoEnTiempoReal(mia.expiraEn - p.instante)} para contestar.`;
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
  const plazo = c.formacion ? textoEnTiempoReal(c.formacion.expiraEn - p.instante) : '';
  const lejos = mi ? ` · a ${Math.round(distancia(mi.posicionActual, c.posicionActual))} de ti` : '';
  return `<div class="ejercito-fila">
    <div><strong>${c.formacion ? 'Formación' : 'Ejército'} de ${e(lider)}</strong>
      <span>${c.participantes.length} héroe(s)${c.formacion ? ` (hacen falta ${MINIMO_FORMACION}; se deshace en ${plazo})` : ` · ${ESTADO[c.estado]}`} · ${POLITICA[politica]}${lejos}</span></div>
    ${c.dentroDe ? '' : `<button class="btn-secondary" type="button" data-centrar-x="${c.posicionActual.x}" data-centrar-y="${c.posicionActual.y}">Ver en el mapa</button>`}
    <button class="btn-primary" type="button" data-unirse-ejercito="${e(c.id)}"${motivo ? ` disabled title="${e(motivo)}"` : ''}>${politica === 'preguntar' ? 'Pedir unirme' : 'Unirme'}</button>
    ${motivo && mi ? `<small>${e(motivo)}</small>` : ''}</div>`;
}

/** «Mi columna»: lo que toca según el estado de la tuya. */
function htmlMiSituacion(p: ProyeccionJugador, mi: Ejercito | undefined, e: Escapar): string {
  if (!mi) return `<p class="asent-lado-nota">Estás dentro.${ayuda('ejercito:dentro', 'Para salir como ejército, usa «Salir» en un campamento o «Salir al mundo» en tu plaza, elige «Ejército» y convoca uno, o únete al que esté preparando un héroe de tu Facción.')}</p>`;
  const lider = mi.liderId === p.heroeId;
  if (mi.formacion) {
    const plazo = textoEnTiempoReal(mi.formacion.expiraEn - p.instante);
    return `<p class="asent-lado-nota"><strong>Formación</strong>: ${mi.participantes.length}/${MINIMO_FORMACION} héroes, ${POLITICA[mi.politicaDeUnion ?? 'aceptar']}. Se deshace en ${plazo}.${ayuda('ejercito:formacion', `Se deshace si no llegáis a ${MINIMO_FORMACION}: con menos de ${MINIMO_FORMACION} no es un ejército y no se mueve. Te quedas quieto hasta entonces.`)}</p>
      ${lider ? '<button class="btn-secondary" type="button" data-ej="cancelar-formacion">Cancelar la formación</button>' : '<button class="btn-secondary" type="button" data-ej="separarme">Separarme</button>'}`;
  }
  if (mi.tipo === 'ejercito') {
    const peticiones = lider ? peticionesVivas(mi, p.instante) : [];
    const resto = mi.participantes.filter((x) => x.heroeId !== p.heroeId);
    return `<p class="asent-lado-nota"><strong>Unión</strong>: ${POLITICA[mi.politicaDeUnion ?? 'rechazar']}.
        ${ayuda(lider ? 'ejercito:lider' : 'ejercito:integrante', `${lider ? 'Tú lo diriges: haz clic en el mapa y marchará hacia allí; cada clic cambia el rumbo.' : 'Lo dirige su Líder con clics en el mapa.'}${(mi.caravanasAdjuntasIds?.length ?? 0) > 0 ? ' Las caravanas enganchadas se cargan, entregan y sueltan en «Lo que llevas» (⚔).' : ''}${lider && resto.length > 0 ? ' El Líder no puede separarse: para irse tiene que ceder el mando antes.' : ''}${lider ? '' : ' Si te separas, te llevas lo tuyo y vuelves a ser una columna personal donde estés.'}`)}</p>
      ${peticiones.length > 0 ? `<strong class="heroe-sub">Piden unirse</strong>${peticiones.map((x) => `<div class="ejercito-fila"><div><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong><span>${textoEnTiempoReal(x.expiraEn - p.instante)} para contestar</span></div>
          <button class="btn-primary" type="button" data-peticion="${e(x.heroeId)}" data-aceptar="si">Aceptar</button><button class="btn-secondary" type="button" data-peticion="${e(x.heroeId)}" data-aceptar="no">Rechazar</button></div>`).join('')}` : ''}
      ${lider
        ? `<div class="mapa-seleccion-acciones">
            ${mi.estado === 'marchando' ? '<button class="btn-secondary" type="button" data-ej="estacionar">Acampar aquí</button>' : ''}
            <button class="btn-secondary" type="button" data-ej="replegar">Replegar (cancelar y volver)</button></div>
          ${resto.length > 0 ? `<div class="campamento-fila"><select class="form-input" id="ej-sucesor">${resto.map((x) => `<option value="${e(x.heroeId)}">${e(nombreDeHeroe(p, x.heroeId))}</option>`).join('')}</select><button class="btn-secondary" type="button" data-ej="ceder">Ceder el mando</button></div>` : ''}`
        : '<button class="btn-secondary" type="button" data-ej="separarme">Separarme del ejército</button>'}`;
  }
  // Columna personal
  if (mi.participantes.length === 1) {
    return `<p class="asent-lado-nota">Vas por tu cuenta.${ayuda('ejercito:personal', 'Con otros dos héroes de tu Facción puedes formar un ejército aquí, sin pasar por una plaza: te quedas quieto hasta que se unan.')}</p>
      ${p.faccionId ? '' : '<p class="asent-lado-nota"><strong>Sin Facción nadie podrá unirse a ti</strong>: un ejército lo componen ciudadanos de una sola Facción.</p>'}
      <div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-ej="organizar" data-politica="aceptar">Organizar ejército (abierto)</button>
      <button class="btn-secondary" type="button" data-ej="organizar" data-politica="preguntar">Organizar ejército (decido yo)</button></div>`;
  }
  return '';
}

const nombreRecurso = (r: string): string => RECURSO_NOMBRE[r] ?? r;
export const nombreDeTropa = (id: string): string => tropasReclutables()?.find((t) => t.id === id)?.nombre ?? (id.charAt(0).toUpperCase() + id.slice(1)).replace(/_/g, ' ');

/** Lo que lleva cada uno: lo tuyo, con el nombre de cada escuadra; lo de los demás, lo que el servidor deja ver (`heroesVisibles[].escuadrasQueLleva`). */
function tropaDe(p: ProyeccionJugador, c: Ejercito, heroeId: string): { tropaId: string; nombre: string; cantidad: number; nivel: number; nota?: string }[] | null {
  if (heroeId === p.heroeId) {
    return p.heroe.escuadrones.filter((s) => c.escuadronIds.includes(s.id) || (s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === c.id))
      .map((s) => ({ tropaId: s.tropaId, nombre: s.nombre, cantidad: s.cantidad, nivel: s.nivel, nota: s.prestada ? 'prestada' : undefined }));
  }
  const visto = p.heroesVisibles.find((h) => h.heroeId === heroeId);
  return visto ? visto.escuadrasQueLleva.map((t) => ({ ...t, nombre: nombreDeTropa(t.tropaId) })) : null;
}

function htmlIntegrantes(p: ProyeccionJugador, c: Ejercito, e: Escapar): string {
  const filas = [...c.participantes].sort((a, b) => Number(b.heroeId === c.liderId) - Number(a.heroeId === c.liderId) || a.unidoEn - b.unidoEn).map((x) => {
    const tropa = tropaDe(p, c, x.heroeId);
    const papel = [x.heroeId === c.liderId ? 'Líder' : '', x.heroeId === p.heroeId ? 'tú' : ''].filter(Boolean).join(' · ');
    const hombres = (tropa ?? []).reduce((t, s) => t + s.cantidad, 0);
    return `<li class="conv-integrante"><div class="conv-integrante-cab"><strong>${e(nombreDeHeroe(p, x.heroeId))}</strong>${papel ? ` <em>${papel}</em>` : ''}<span>${tropa ? `${tropa.length} escuadra(s) · ${hombres} hombres` : ''}</span></div>
      ${tropa === null ? '<small class="asent-lado-nota">Su tropa no se ve desde aquí.</small>'
        : tropa.length === 0 ? '<small class="asent-lado-nota">Sin tropa.</small>'
        : `<ul class="ejv-tropas">${tropa.map((s) => `<li class="ejv-tropa">${iconoEnFila(s.tropaId)}<strong>${e(s.nombre)}</strong><span class="ejv-tropa-dato">${s.cantidad} hombres · nivel ${s.nivel}${s.nota ? ` · ${s.nota}` : ''}</span></li>`).join('')}</ul>`}</li>`;
  }).join('');
  return `<strong class="heroe-sub">Integrantes</strong><ul class="conv-integrantes">${filas}</ul>`;
}

const recursos = (r: Record<string, number> | undefined, e: Escapar): string => {
  const hay = Object.entries(r ?? {}).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]);
  return hay.length ? `<div class="ejv-recursos">${hay.map(([k, n]) => `<span title="${e(nombreRecurso(k))}">${RECURSO_ICONO[k] ?? '📦'} ${Math.floor(n)}</span>`).join('')}</div>` : '<small class="asent-lado-nota">Nada.</small>';
};

const CARRO: Record<string, string> = { basico: 'básico', reforzado: 'reforzado' };

/** Las caravanas que lleva la columna (enganchadas y la de Fundación), con sus carros y su carga. */
function htmlCaravanasDeLaColumna(p: ProyeccionJugador, c: Ejercito, e: Escapar): string {
  const ids = [...new Set([...(c.caravanasAdjuntasIds ?? []), ...(c.caravanaFundacionId ? [c.caravanaFundacionId] : [])])];
  if (ids.length === 0) return '';
  const filas = ids.map((id) => {
    const k = p.caravanas.find((x) => x.id === id);
    if (!k) return '<div class="ejv-caravana"><small class="asent-lado-nota">Una caravana que no llega en tu proyección.</small></div>';
    const fundacion = id === c.caravanaFundacionId || k.titularId !== undefined;
    const carros = (k.carros ?? []).map((r) => `${CARRO[r.tipoCarro] ?? r.tipoCarro} ${r.animal ? `con ${r.animal}` : 'sin animal'}`);
    const carga = Math.floor(Object.values(k.contenido ?? {}).reduce((t, n) => t + n, 0));
    return `<div class="ejv-caravana"><div class="conv-integrante-cab"><strong>${e(fundacion ? 'Caravana de Fundación' : nombreDeCaravana(k))}</strong><span>lleva ${carga}</span></div>
      ${carros.length ? `<small>${carros.length} carro(s): ${e(carros.join(' · '))}</small>` : ''}
      ${(k.escoltaIds?.length ?? 0) > 0 ? `<small>Escolta: ${k.escoltaIds!.length} escuadra(s)</small>` : ''}
      ${recursos(k.contenido, e)}</div>`;
  }).join('');
  return `<strong class="heroe-sub">Caravanas${ayuda('ejercito:caravanas', 'Van con la columna, a su paso. Se cargan, entregan y sueltan en «Lo que llevas» (⚔).')}</strong>${filas}`;
}

/** La ventana «Ejército» del riel del mapa, centrada como la de Misiones: a la izquierda quiénes van y su tropa; a la derecha lo que toca hacer, la carga y
 * las caravanas. */
export function htmlPanelEjercito(p: ProyeccionJugador, e: Escapar): string {
  const mi = miColumna(p);
  const titulo = !mi ? 'Ejército' : mi.formacion ? 'Formación' : mi.tipo === 'ejercito' ? `Ejército de ${nombreDeHeroe(p, mi.liderId ?? p.heroeId)}` : 'Tu columna';
  const hombres = mi ? mi.participantes.reduce((t, x) => t + (tropaDe(p, mi, x.heroeId) ?? []).reduce((u, s) => u + s.cantidad, 0), 0) : 0;
  const resumen = mi ? `${mi.participantes.length} héroe(s) · ${hombres} hombres${mi.formacion ? '' : ` · ${ESTADO[mi.estado]}`}` : '';
  const carga = mi
    ? `${ocupacion('Carga', mi.suministro ?? {}, mi.capacidadCarga)}${recursos(mi.suministro, e)}<small class="asent-lado-nota">Se carga y descarga en «Lo que llevas» (⚔).</small>`
    : '';
  return `<header class="diario-cab"><span class="diario-cab-titulo">${e(titulo)}</span>${resumen ? `<small>${e(resumen)}</small>` : ''}<button class="btn-secondary" type="button" data-cerrar-ejercito aria-label="Cerrar">✕</button></header>
    <div class="ejv-cuerpo">
      ${mi ? `<section class="ejv-col">${htmlIntegrantes(p, mi, e)}</section>` : ''}
      <section class="ejv-col">${htmlMiSituacion(p, mi, e)}${carga}${mi ? htmlCaravanasDeLaColumna(p, mi, e) : ''}
        <p class="faction-error" data-campo="error-ejercito" role="alert"></p></section>
    </div>`;
}

/** La pestaña «Ejércitos» de la Facción (antes, al pie del panel del mapa): los ejércitos y formaciones de tu Facción que no son tu columna. */
export function htmlEjercitosFaccion(p: ProyeccionJugador, e: Escapar): string {
  const otros = ejercitosDeLaFaccion(p);
  return `<section class="faccion-ejercitos">
    <strong class="heroe-sub">Ejércitos y formaciones de tu Facción${ayuda('ejercito:otros', 'Se forman con «Organizar ejército» en la ventana Ejército del mapa (⚑), o convocándolos dentro de un campamento o de tu plaza. Para unirte en campo, ve con tu columna personal junto a él.')}</strong>
    ${otros.length > 0 ? otros.map((c) => filaEjercito(p, c, e)).join('') : '<p class="mapa-lista-vacia">No hay ninguno ahora.</p>'}
    <p class="faction-error" data-campo="error-ejercito" role="alert"></p></section>`;
}

/** Cablea los botones de la ventana, de la pestaña de la Facción y de la ficha («Ver en el mapa» lo cablea quien la monta); `avisar` es el aviso global si no hay dónde escribir el error. */
export function cablearPanelEjercito(raiz: ParentNode, p: ProyeccionJugador, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
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
        if (mi) void confirmar('Cancela la marcha y todos vuelven a su origen.', { titulo: '¿Replegar el ejército?', aceptar: 'Replegar' }).then((ok) => { if (ok) void enviar(b, 'replegarEjercito', { ejercitoId: mi.id }); });
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
    <span class="faction-kicker">${c.formacion ? 'Formación' : 'Ejército'} de tu Facción${motivo ? '' : ayuda('ejercito:ficha', 'Estás junto a él con tu columna personal: te unes con lo que llevas encima (tropa y carro) y pasas a ir donde lo dirija su Líder.')}</span>
    <h3>${e(c.liderId ? nombreDeHeroe(p, c.liderId) : c.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Héroes</span><strong>${c.participantes.length}</strong></div>
      <div><span>Estado</span><strong>${c.formacion ? 'formándose' : ESTADO[c.estado]}</strong></div>
      <div><span>Unión</span><strong>${POLITICA[politica]}</strong></div></div>
    <ul class="ejercito-lista">${c.participantes.map((x) => `<li>${e(nombreDeHeroe(p, x.heroeId))}${x.heroeId === c.liderId ? ' <em>(Líder)</em>' : ''}</li>`).join('')}</ul>
    <div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-unirse-ejercito="${e(c.id)}"${motivo ? ' disabled' : ''}>${politica === 'preguntar' ? 'Pedir unirme' : 'Unirme'}</button></div>
    ${motivo ? `<p class="mapa-lista-vacia">${e(motivo)}</p>` : ''}
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
