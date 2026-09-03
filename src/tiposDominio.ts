// Copia local de los tipos de dominio devueltos por la proyección JSON.
// Mantiene a `cliente-jugador` desacoplado del motor de backend.

export interface Point {
  x: number;
  y: number;
}

export interface Faccion {
  id: string;
  nombre: string;
  reyId?: string | null;
  embajadorId?: string | null;
  nivel: number;
  experiencia?: number;
  ciudadanosIds?: string[];
  reputacion?: number;
  // ... ignoramos otros campos que no impactan el render ...
}

export interface Edificio {
  id: string;
  tipo: string; // EdificioTipo string
  estado: 'en_cola' | 'en_construccion' | 'activo';
  ambito?: 'asentamiento' | 'mapa';
  posicion: Point;
}

/** Celda del anillo de un `Recinto` — copia local de `CeldaMuro` (motor). Sirve solo para contar puertas en
 * el cliente (`celdas.filter(c => c.clase === 'puerta').length`); el DIBUJO del anillo no usa esto, llega ya
 * resuelto a rectángulos de pantalla en `TrazadoMuralla` (ver más abajo). */
export interface CeldaMuro {
  col: number;
  row: number;
  clase: 'muro' | 'puerta' | 'torre';
}

/** Copia local de `Recinto` (motor) — `Consideraciones/Murallas_Definicion.md`. Congelado al comprometerse:
 * `celdas`/`nivel` no cambian nunca salvo por una mejora terminada (§7 del doc). */
export interface Recinto {
  id: string;
  nivel: number;
  celdas: CeldaMuro[];
  /** -1 = comprometido pero sin nada en pie; `celdas.length - 1` = anillo cerrado del todo. */
  avance: number;
  /** Nivel al que se está mejorando, si hay una mejora en obra (§7). */
  mejorandoA?: number;
}

export interface Asentamiento {
  id: string;
  nombre?: string;
  faccionId: string;
  posicion: Point;
  nivel: number;
  nivelActual?: number;
  mantenimiento?: number;
  poblacion?: { pesants: number; artesanos: number; nobleza: number };
  almacen?: Record<string, { cantidad: number; capacidad: number }>;
  edificios: Edificio[];
  /** Gobernador/Maestro de Obras/Tesorero/General asignados (Doc 2.5) — quién puede ordenar qué. */
  cargos?: { gobernadorId?: string | null; maestroObrasId?: string | null; tesoreroId?: string | null; generalId?: string | null };
  /** Recintos de muralla, del más interior al más exterior (Paso 2a en adelante). Vacío/ausente = sin muro. */
  recintos?: Recinto[];
}

export interface Caravana {
  id: string;
  origenAsentamientoId: string;
  destinoAsentamientoId?: string;
  posicionActual: Point;
  ruta?: Point[];
}

/** Escuadrón dentro de un ejército propio — copia local reducida a lo que el mapa necesita: de quién es.
 * El número de ROMBOS de una columna es el de jugadores distintos que van en ella (Doc 5.12.2), no el de
 * escuadrones, así que esto es lo único que hay que leer para dibujarla. */
export interface EscuadronEnCampana {
  id: string;
  jugadorId: string;
}

/** Copia local de `Ejercito` (motor, Doc 5.12) — los de TU Facción, que la proyección manda completos.
 * Solo los campos que pinta el mapa; el resto (suministro, objetivo, caravanas adjuntas) llegará cuando haya
 * un panel de campaña que los muestre. */
export interface Ejercito {
  id: string;
  faccionId: string;
  origenAsentamientoId: string;
  escuadrones: EscuadronEnCampana[];
  ruta: Point[];
  posicionActual: Point;
  estado: 'marchando' | 'estacionado' | 'regresando';
}

/**
 * Un ejército AJENO tal como llega redactado del servidor (Doc 5.12.7): dónde está, de qué Facción es y
 * cuántos estandartes se le cuentan. No hay más — ni escuadrones (su poder), ni ruta (su intención), ni
 * estado. La redacción la hace `proyectarParaJugador`, no este cliente: lo que no sale del backend no se
 * puede mirar en un DevTools.
 */
export interface EjercitoAvistado {
  id: string;
  faccionId: string;
  posicionActual: Point;
  participantes: number;
}

export interface ZonaFaccion {
  faccionId: string;
  contornos: Point[][];
}

export interface CampamentoBandido {
  id: string;
  posicion: Point;
}

export interface CaminoComercial {
  id: string;
  puntos: Point[];
}

/** Tirada rectangular de celdas, en coordenadas locales — la calle/camino/muro OCUPA suelo (área), no es una
 * línea sin grosor (Etapa 6 del trazado urbano). Corrige el tipo `SegmentoTrazado` (`{desde,hasta}`) que
 * tenía este archivo: esa forma es de ANTES de Etapa 6, cuando las calles vivían en aristas, no en celdas —
 * quedó desincronizada del contrato real (`RectanguloLocal`, `engine/trazado.ts`) y nunca se notó porque
 * hasta ahora ningún asentamiento real con calles se había llegado a pintar aquí.
 */
export interface RectanguloLocal {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Un recinto ya resuelto para dibujar — copia local de `TrazadoMuralla` (motor). Solo las celdas YA
 * LEVANTADAS van en `muro`/`puertas`/`torres`; `planificado` son las que ya ocupan suelo pero aún no están en
 * pie (se dibujan como obra pendiente, no como césped vacío — ver Paso 2b del doc de murallas). */
export interface TrazadoMuralla {
  nivel: number;
  /** 0..1 — qué fracción del anillo está levantada. */
  integridad: number;
  muro: RectanguloLocal[];
  puertas: RectanguloLocal[];
  torres: RectanguloLocal[];
  planificado: RectanguloLocal[];
}

export interface TrazadoAsentamiento {
  calles: RectanguloLocal[];
  caminos: RectanguloLocal[];
  huellas: Record<string, RectanguloLocal>;
  murallas: TrazadoMuralla[];
}
