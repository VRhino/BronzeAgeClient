// Batallas de Unity y ejércitos formados en campo (backend Doc 5.14.4, 5.15.1b). Fichas del panel de Selección del mapa y la sección
// «Mi columna» de «Mis cosas». Aquí no se decide ninguna regla: el backend valida quién puede unirse y a qué bando; este panel solo ofrece
// los botones que tienen sentido y deja su rechazo (`batalla.invalida`, `movilizacion.invalida`…) en el propio panel.
import type { ProyeccionJugador } from '../apiCliente';
import type { BatallaVisible, EjercitoAvistado } from '../tiposDominio';
import { crearEnvio, type Ejecutar } from './panelAnexion';
import { MINIMO_FORMACION } from './ejercitos';

type Escapar = (valor: string) => string;


/** Qué clase de batalla es, con la palabra que usa el canon (Doc 5.15.1b). */
export function nombreDeBatalla(batalla: BatallaVisible): string {
  switch (batalla.contexto.tipo) {
    case 'asedio': return 'Asedio';
    case 'campo_abierto': return batalla.contexto['columnas'] === 'ejercitos' ? 'Batalla campal' : 'Persecución';
    case 'caravana': return 'Asalto a una caravana';
    case 'campamento_bandidos': return 'Evento: campamento de bandidos';
    default: return 'Batalla';
  }
}

const ESTADO: Record<BatallaVisible['estado'], string> = {
  convocando: 'convocándose',
  asignada: 'a punto de empezar',
  en_curso: 'en curso',
  aplicada: 'terminada',
  cancelada: 'cancelada',
  fallida: 'fallida',
};

/** Ficha de una batalla a la vista. `impide` es el aviso de alcance o herida (vacío = puedes unirte). */
export function htmlFichaBatalla(proyeccion: ProyeccionJugador, batalla: BatallaVisible, impide: string, escapar: Escapar): string {
  const nombreFaccion = (id: string | null) => (id === null ? 'Bandidos' : escapar(proyeccion.facciones.find((f) => f.id === id)?.nombre ?? id));
  const bando = (lado: 'atacante' | 'defensor') => {
    const b = batalla.bandos[lado];
    return `<div><span>${lado === 'atacante' ? 'Atacan' : 'Defienden'}</span><strong>${nombreFaccion(b.faccionId)} · ${b.heroes}/${b.capacidadMaxima}</strong></div>`;
  };
  const persecucion = batalla.contexto.tipo === 'campo_abierto' && batalla.contexto['columnas'] === 'solitarios';
  const campal = batalla.contexto.tipo === 'campo_abierto' && batalla.contexto['columnas'] === 'ejercitos';
  const deshabilitado = impide ? ' disabled' : '';
  const acciones = batalla.ladoPropio
    ? `<p class="mapa-lista-vacia">Combates aquí, en el bando ${batalla.ladoPropio}.</p>`
    : campal
      ? '<p class="mapa-lista-vacia">Una batalla campal no admite a nadie de fuera.</p>'
      : persecucion
        ? `<div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-unirse-lado="atacante"${deshabilitado}>Con quien persigue</button><button class="btn-primary" type="button" data-unirse-lado="defensor"${deshabilitado}>Con el perseguido</button></div>`
        : `<div class="mapa-seleccion-acciones"><button class="btn-primary" type="button" data-unirse-lado=""${deshabilitado}>Unirse</button></div>`;
  return `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${nombreDeBatalla(batalla)} · ${ESTADO[batalla.estado]}</span>
    <h3>${batalla.bandos.defensor.faccionId === null ? 'Contra bandidos' : 'Batalla'}</h3>
    <div class="mapa-seleccion-datos">${bando('atacante')}${bando('defensor')}</div>
    ${acciones}
    ${!batalla.ladoPropio && !campal && impide ? `<p class="mapa-lista-vacia">${escapar(impide)}</p>` : ''}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`;
}

export function cablearFichaBatalla(raiz: ParentNode, proyeccion: ProyeccionJugador, batalla: BatallaVisible, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'mapa-seleccion-error', ejecutar, avisar);
  raiz.querySelectorAll<HTMLButtonElement>('[data-unirse-lado]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const lado = boton.dataset.unirseLado;
      void enviar(boton, 'unirseABatalla', { heroeId: proyeccion.heroeId, battleId: batalla.battleId, ...(lado ? { lado } : {}) });
    });
  });
}

/** Las formaciones a la vista que no son la tuya, con la forma de un ejército avistado. Las de tu Facción llegan completas en `ejercitos`
 * (son «propias»); las demás, redactadas, en `ejercitosAvistados`. */
export function formacionesVisibles(proyeccion: ProyeccionJugador): EjercitoAvistado[] {
  const delaFaccion = proyeccion.ejercitos
    .filter((e) => e.formacion && !e.participantes.some((p) => p.heroeId === proyeccion.heroeId))
    .map((e): EjercitoAvistado => ({ id: e.id, tipo: e.tipo, enFormacion: true, faccionId: e.faccionId, posicionActual: e.posicionActual, participantes: e.participantes.length, heroeIds: e.participantes.map((p) => p.heroeId) }));
  return [...delaFaccion, ...(proyeccion.ejercitosAvistados ?? []).filter((e) => e.enFormacion)];
}

/** Una formación a la vista (de otra Facción o de la tuya): se le une una columna personal de su Facción, junto a ella. */
export function htmlFichaFormacion(proyeccion: ProyeccionJugador, formacion: EjercitoAvistado, escapar: Escapar): string {
  const faccion = proyeccion.facciones.find((f) => f.id === formacion.faccionId);
  const mia = formacion.faccionId === proyeccion.faccionId;
  const mi = proyeccion.ejercitos.find((e) => e.participantes.some((p) => p.heroeId === proyeccion.heroeId));
  const enUna = !mi || mi.participantes.length > 1 || mi.formacion !== undefined || mi.tipo === 'ejercito';
  return `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Formación de ejército</span>
    <h3>${escapar(faccion?.nombre ?? formacion.faccionId)}</h3>
    <div class="mapa-seleccion-datos"><div><span>Héroes</span><strong>${formacion.participantes}/${MINIMO_FORMACION}</strong></div></div>
    <div class="mapa-seleccion-acciones"><button id="btn-unirse-formacion" class="btn-primary" type="button"${mia && !enUna ? '' : ' disabled'}>Unirse</button></div>
    <p class="mapa-lista-vacia">${mia ? 'Estás junto a ella con tu columna personal: te unes con lo que llevas encima (tropa y carro).' : 'Solo se unen ciudadanos de su Facción.'}</p>
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`;
}

export function cablearFichaFormacion(raiz: ParentNode, proyeccion: ProyeccionJugador, formacion: EjercitoAvistado, ejecutar: Ejecutar, avisar: (mensaje: string) => void): void {
  const enviar = crearEnvio(raiz, 'mapa-seleccion-error', ejecutar, avisar);
  const boton = raiz.querySelector<HTMLButtonElement>('#btn-unirse-formacion');
  boton?.addEventListener('click', () => void enviar(boton, 'unirseEnCampo', { ejercitoId: formacion.id, heroeId: proyeccion.heroeId }));
}
