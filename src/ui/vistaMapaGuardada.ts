// Vista del mapa (zoom, pan, panel del riel, selección) guardada en localStorage, una clave por partida, para
// que sobreviva a ir a la plaza/campamento y volver, y a recargar. Todo en try/catch: sin localStorage (privado,
// bloqueado, vacío o con basura) la pantalla funciona igual, solo que sin memoria.

export interface VistaMapa {
  zoom: number;
  panX: number;
  panY: number;
  panel: 'columna' | 'ejercito' | 'cosas' | null;
  seleccion: { tipo: string; id: string } | null;
}

const clave = (gameId: string): string => `bronze.vistaMapa.${gameId}`;

export function guardarVistaMapa(gameId: string, vista: VistaMapa): void {
  try { localStorage.setItem(clave(gameId), JSON.stringify(vista)); } catch { /* sin almacenamiento: no pasa nada */ }
}

/** Devuelve la vista guardada de ESA partida o null si no hay / está corrupta. Zoom y pan se vuelven a acotar al
 * aplicarse (`aplicar` de `instalarZoomPan`); la selección se valida contra la proyección al restaurarla. */
export function leerVistaMapa(gameId: string): VistaMapa | null {
  try {
    const v = JSON.parse(localStorage.getItem(clave(gameId)) ?? 'null');
    if (!v || ![v.zoom, v.panX, v.panY].every(Number.isFinite)) return null;
    const s = v.seleccion;
    return {
      zoom: v.zoom, panX: v.panX, panY: v.panY,
      panel: v.panel === 'columna' || v.panel === 'ejercito' || v.panel === 'cosas' ? v.panel : null,
      seleccion: s && typeof s.tipo === 'string' && typeof s.id === 'string' ? { tipo: s.tipo, id: s.id } : null,
    };
  } catch { return null; }
}
