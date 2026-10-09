// Etiqueta de una ciudad: emblema de la Facción dueña junto al nombre y, debajo, más pequeño y tenue, «Facción · Nivel N».
// La plaza se busca en la propia, las avistadas y las conocidas; si no está en ninguna, solo el id (sin emblema ni subtítulo).
import type { ProyeccionJugador } from '../apiCliente';
import { svgEmblema } from '../sigilo/emblemas';
import { colorHex } from '../sigilo/sigilo';

export function datosCiudad(p: ProyeccionJugador, id: string): { nombre: string; faccionId?: string; nivel?: number } {
  const c = p.asentamientos.find((x) => x.id === id) ?? p.asentamientosAvistados.find((x) => x.id === id);
  if (c) return { nombre: c.nombre ?? id, faccionId: c.faccionId, nivel: c.nivel };
  const k = p.asentamientosConocidos.find((x) => x.asentamientoId === id);
  return k ? { nombre: k.nombre ?? id, faccionId: k.faccionId, nivel: k.nivel } : { nombre: id };
}

export function etiquetaCiudad(p: ProyeccionJugador, id: string, escapar: (s: string) => string): string {
  const d = datosCiudad(p, id);
  const f = d.faccionId ? p.facciones.find((x) => x.id === d.faccionId) : undefined;
  const emblema = f?.sigilo?.emblemaId ? `<svg class="ciudad-emblema" viewBox="0 0 100 100" aria-hidden="true">${svgEmblema(f.sigilo.emblemaId, colorHex(f.sigilo.colorEmblemaId))}</svg>` : '';
  const sub = [f?.nombre ?? d.faccionId, d.nivel !== undefined ? `Nivel ${d.nivel}` : ''].filter(Boolean).join(' · ');
  return `<span class="ciudad-etiqueta">${emblema}<span class="ciudad-texto"><strong>${escapar(d.nombre)}</strong>${sub ? `<small>${escapar(sub)}</small>` : ''}</span></span>`;
}
