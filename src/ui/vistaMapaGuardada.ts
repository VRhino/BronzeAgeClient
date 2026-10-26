// Vista del mapa (zoom, pan, panel del riel, selección) guardada en localStorage, una clave por partida, para
// que sobreviva a ir a la plaza/campamento y volver, y a recargar. Todo en try/catch: sin localStorage (privado,
// bloqueado, vacío o con basura) la pantalla funciona igual, solo que sin memoria.

export interface VistaMapa {
  /** La cámara (`geometriaVista.ts`): px por unidad y centro de la vista en el mundo. */
  escala: number;
  cx: number;
  cy: number;
  panel: 'columna' | 'ejercito' | 'cosas' | null;
  seleccion: { tipo: string; id: string } | null;
}

// `v2`: desde la cámara en unidades (2026-10-26); la vista vieja (zoom y pan en px de un lienzo cuadrado) no vale y se ignora.
const clave = (gameId: string): string => `bronze.vistaMapa.v2.${gameId}`;

export function guardarVistaMapa(gameId: string, vista: VistaMapa): void {
  try { localStorage.setItem(clave(gameId), JSON.stringify(vista)); } catch { /* sin almacenamiento: no pasa nada */ }
}

/** Devuelve la vista guardada de ESA partida o null si no hay / está corrupta. La cámara se vuelve a acotar al
 * aplicarse (`aplicar` de `instalarZoomPan`); la selección se valida contra la proyección al restaurarla. */
export function leerVistaMapa(gameId: string): VistaMapa | null {
  try {
    const v = JSON.parse(localStorage.getItem(clave(gameId)) ?? 'null');
    if (!v || ![v.escala, v.cx, v.cy].every(Number.isFinite) || !(v.escala > 0)) return null;
    const s = v.seleccion;
    return {
      escala: v.escala, cx: v.cx, cy: v.cy,
      panel: v.panel === 'columna' || v.panel === 'ejercito' || v.panel === 'cosas' ? v.panel : null,
      seleccion: s && typeof s.tipo === 'string' && typeof s.id === 'string' ? { tipo: s.tipo, id: s.id } : null,
    };
  } catch { return null; }
}
