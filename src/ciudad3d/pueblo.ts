// Un pueblo extractor o una aldea en la vista 3D: su planta (la que manda el motor estando dentro, `EscenaPueblo`) dibujada como una plaza pequeña,
// con el estilo de su plaza madre hasta el 3. El ancla (la cantera, la boca de la mina o la granja) va en el origen; luego las casas, el almacén,
// el corral del buey y, en la aldea, sus granjas (de trigo, viñas u olivares, según su cultivo) y corrales. Cada pieza en su huella exacta: el trazado manda (Víctor, 2026-11-02).
import type { Edificio, EscenaPueblo, RectanguloLocal } from '../tiposDominio';
import { ciudadEnVista, type CiudadEnVista, type OpcionesCiudad } from './estado';

/** El estilo más alto de un pueblo: las casas de un pueblo no pasan del adobe (Víctor, 2026-11-02, propuesta). */
export const ESTILO_MAXIMO_DE_PUEBLO = 3;

/** El pueblo que se dibuja, o `null` sin planta. */
export function puebloEnVista(e: EscenaPueblo, o: OpcionesCiudad): CiudadEnVista | null {
  if (e.edificios.length === 0) return null;
  const T = e.unidadesPorCelda || 3;
  const huellas: Record<string, RectanguloLocal> = {};
  const edificios: Edificio[] = e.edificios.map((p) => {
    huellas[p.edificioId] = { x: p.posicion.x - p.ancho / 2, y: p.posicion.y - p.alto / 2, ancho: p.ancho, alto: p.alto };
    return { id: p.edificioId, tipo: p.tipo, estado: 'activo', posicion: p.posicion };
  });
  const nivel = Math.max(1, Math.min(ESTILO_MAXIMO_DE_PUEBLO, e.nivelMadre ?? 1));
  const c = ciudadEnVista(
    { id: e.puebloId, nivel, edificios, recintos: [] },
    { calles: e.calles, caminos: e.caminos, huellas, murallas: [], radio: e.radio > 0 ? e.radio : undefined, celda: T },
    { ...o, centroId: o.centroId ?? e.edificios[0]!.edificioId },
  );
  // las granjas de una aldea de viñas o de olivos (tanda 69): el motor las manda como `granja`; la maqueta las hace viña u olivar
  if (c && (e.cultivo === 'vid' || e.cultivo === 'oliva')) for (const x of c.edificios) if (x.tipo === 'granja') x.cultivo = e.cultivo;
  return c;
}
