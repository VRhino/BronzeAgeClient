// Lo que pinta el mundo 3D, sacado de la proyección del jugador. La vista no lee la proyección directamente: así se prueba sola (y el banco de
// pruebas de `pruebas/mundo3d/` le da un estado de mentira).
import type { ProyeccionJugador } from '../apiCliente';
import type { NieblaProyectada } from '../tiposDominio';

type Punto = { x: number; y: number };

export interface ColumnaEnVista {
  id: string;
  /** La columna del jugador. */
  propia: boolean;
  posicion: Punto;
  /** Lo que queda por andar (vacío si está quieta). */
  ruta: Punto[];
  /** Héroes a caballo al frente. */
  jinetes: number;
  /** Figuras de tropa detrás. */
  soldados: number;
}

export interface EstadoVista {
  /** Donde mira la cámara: la cabeza de la columna del jugador o, si no va en una, el sitio donde está. */
  heroe: Punto | null;
  /** Radio de visión de la columna del jugador (`VISION` del servidor): decide cuánto cabe en pantalla. */
  radioVision: number;
  columnas: ColumnaEnVista[];
  niebla: NieblaProyectada | null;
}

/** Los radios de visión del servidor (`Movimiento_Ejercitos.VISION`): el héroe solo y la columna con soldados. */
export interface RadiosDeVision { solo: number; ejercito: number }

/** Figuras de tropa por escuadra, y como mucho. */
const FIGURAS_POR_ESCUADRA = 3, MAX_FIGURAS = 18, MAX_JINETES = 4;

/** El estado de la vista para la proyección `p` (la del instante, con las columnas ya movidas). `dondeEsta` es el sitio del héroe cuando no va
 * en una columna en el mapa (dentro de una plaza o de un campamento). */
export function estadoDesdeProyeccion(p: ProyeccionJugador, radios: RadiosDeVision, dondeEsta: Punto | null): EstadoVista {
  // la columna en la que marcha el héroe (como `miColumna` de `ui/ejercitos.ts`, sin traerse la interfaz)
  const mia = p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
  const enElMapa = mia && !mia.dentroDe ? mia : undefined;
  const columnas: ColumnaEnVista[] = [];
  if (enElMapa) {
    columnas.push({
      id: enElMapa.id,
      propia: true,
      posicion: enElMapa.posicionActual,
      ruta: enElMapa.estado !== 'estacionado' ? enElMapa.ruta ?? [] : [],
      jinetes: Math.max(1, Math.min(MAX_JINETES, enElMapa.participantes.length)),
      soldados: Math.min(MAX_FIGURAS, enElMapa.escuadronIds.length * FIGURAS_POR_ESCUADRA),
    });
  }
  return {
    heroe: enElMapa?.posicionActual ?? dondeEsta,
    radioVision: mia && mia.escuadronIds.length > 0 ? radios.ejercito : radios.solo,
    columnas,
    niebla: p.exploracion ?? null,
  };
}
