// Identidad de imperios y títulos (backend Doc 2.8.1): nada de esto se guarda, se deriva de lo público.
// - La Liga sale de las relaciones activas; el Gran Rey es la señora que nunca es vasalla dentro de ella.
// - El Gran Rey lleva una corona sobre su estandarte (`svgSigilo(..., { granRey: true })`).
// - Una Liga por vasallaje se muestra con el sigilo de su señora; una por alianza, con los de sus miembros.
// - Cada título de servidor tiene una insignia fija por `tituloId` (iconos de game-icons.net, CC BY 3.0).
import insignias from './insignias.json';
import type { Faccion, RelacionPolitica, Titulo } from '../tiposDominio';
import { svgSigilo } from './sigilo';

export interface Liga {
  miembrosIds: string[];
  tieneVasallaje: boolean;
  /** Señora que nunca es vasalla de otra dentro de la Liga (solo si hay vasallaje). */
  granReyId?: string;
}

/** La Liga de una Facción: la red de Facciones conectadas con ella por relaciones activas (vasallaje o alianza). */
export function ligaDe(faccionId: string, relaciones: readonly RelacionPolitica[]): Liga | undefined {
  const activas = relaciones.filter((r) => r.estado === 'activa');
  const miembros = new Set([faccionId]);
  for (let crecio = true; crecio; ) {
    crecio = false;
    for (const r of activas) {
      if (miembros.has(r.faccionAId) !== miembros.has(r.faccionBId)) {
        miembros.add(r.faccionAId);
        miembros.add(r.faccionBId);
        crecio = true;
      }
    }
  }
  if (miembros.size < 2) return undefined;
  const vasallajes = activas.filter((r) => r.tipo === 'vasallaje' && miembros.has(r.faccionAId) && miembros.has(r.faccionBId));
  const vasallas = new Set(vasallajes.map((r) => r.faccionBId));
  const granReyId = vasallajes.map((r) => r.faccionAId).find((id) => !vasallas.has(id));
  return { miembrosIds: [...miembros], tieneVasallaje: vasallajes.length > 0, granReyId };
}

/** Insignia fija de un título: el icono sobre un medallón. Sin insignia conocida, un medallón vacío. */
export function svgInsignia(tituloId: string, ancho = 40): string {
  const icono = (insignias as Record<string, { d: string }>)[tituloId];
  return `<svg class="insignia" width="${ancho}" height="${ancho}" viewBox="0 0 100 100" role="img" aria-label="${tituloId}">`
    + '<circle cx="50" cy="50" r="46" fill="#3a2d12" stroke="#c9a227" stroke-width="5"/>'
    + (icono ? `<g transform="translate(19 19) scale(.118)"><path d="${icono.d}" fill="#f4efe4"/></g>` : '')
    + '</svg>';
}

/** La Liga como imagen: sigilo de la señora con corona si hay vasallaje; fila de los sigilos de los miembros si es una alianza. */
export function htmlLiga(liga: Liga, facciones: readonly Faccion[], ancho = 56): string {
  const de = (id: string) => facciones.find((f) => f.id === id);
  if (liga.tieneVasallaje && liga.granReyId) {
    return `<div class="liga-sigilo">${svgSigilo(de(liga.granReyId)?.sigilo, ancho, { granRey: true })}</div>`;
  }
  const mini = liga.miembrosIds.slice(0, 6).map((id) => svgSigilo(de(id)?.sigilo, Math.round(ancho * 0.55))).join('');
  return `<div class="liga-orla">${mini}</div>`;
}

/** Los títulos de servidor con su insignia y quién los tiene. `propiaId` marca el de tu Facción. */
export function htmlTitulos(titulos: readonly Titulo[], facciones: readonly Faccion[], propiaId: string | null, escapar: (v: string) => string): string {
  if (titulos.length === 0) return '<p class="legend-note">Aún no hay títulos en el servidor.</p>';
  return titulos
    .map((t) => {
      const poseedora = facciones.find((f) => f.id === t.poseedorId);
      const suyo = t.poseedorId === propiaId;
      return `<div class="titulo-item${suyo ? ' titulo-propio' : ''}">${svgInsignia(t.tituloId ?? '', 40)}`
        + `<div><strong>${escapar(t.nombre)}</strong><span>${poseedora ? svgSigilo(poseedora.sigilo, 16) : ''} ${escapar(poseedora?.nombre ?? t.poseedorId)}${suyo ? ' · la tuya' : ''}</span></div></div>`;
    })
    .join('');
}
