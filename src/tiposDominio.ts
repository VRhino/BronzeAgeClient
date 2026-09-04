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

/**
 * Un asentamiento AJENO que se está viendo AHORA, tal como llega redactado del servidor: su FICHA. Quién es,
 * de quién es, dónde está y cómo de grande — que es lo que se distingue mirando una ciudad desde fuera.
 *
 * El `nivel` entra porque una ciudad grande se ve grande; no dice cuánta tropa tiene dentro, que es lo que
 * decidiría un ataque. Lo que NO viene —almacén, guarnición, edificios, colas— es telemetría de un rival, y
 * la quita `proyectarParaJugador`, no este cliente: lo que no sale del backend no se puede mirar en un
 * DevTools.
 */
export interface AsentamientoAvistado {
  id: string;
  nombre?: string;
  faccionId: string;
  posicion: Point;
  nivel: number;
  /** Su frontera, con la silueta REAL que calcula el motor (recortada contra sus vecinos). Se dibuja BAJO
   * la niebla, así que del contorno solo se llega a ver el tramo que cae en tierra explorada — que es
   * exactamente lo que verías: la parte de la frontera por delante de la que has pasado. */
  zona: Point[];
}

/**
 * La ÚLTIMA FOTO de un asentamiento ajeno que se vio y ya no se ve. Los mismos campos que
 * `AsentamientoAvistado` más el instante en que se tomó — porque solo lo recordado puede estar rancio.
 *
 * No caduca: se refresca al volver a verlo. El dato viejo se delata solo, y por eso `conocidoEn` viaja — con
 * él la interfaz puede decir "última información: hace 3 horas" y que el jugador juzgue si fiarse.
 */
export interface AsentamientoConocido {
  asentamientoId: string;
  nombre?: string;
  faccionId: string;
  posicion: Point;
  nivel: number;
  /** Instante de MUNDO (ms desde la época Unix) en que se tomó la foto. */
  conocidoEn: number;
  /** Hasta dónde llegaba su tierra cuando se vio — el RADIO, no la silueta. El servidor guarda el número y
   * no el contorno a propósito: la silueta real está recortada contra vecinos que quizá no conozcas, así
   * que congelarla sería congelar información de terceros. Se dibuja como un círculo punteado, que es
   * justo lo que significa: "llegaba más o menos hasta aquí". Ausente en fichas grabadas antes de que
   * existieran las zonas; se rellena sola al volver a ver esa plaza. */
  radioPotencial?: number;
}

/**
 * La niebla de guerra: DOS máscaras de celdas sobre la misma rejilla, más la geometría con que se descifran.
 * De ellas salen los tres estados en que el jugador ve el mundo, sin que este cliente tenga que saber una
 * sola regla del juego:
 *
 * | Estado | Cómo se deduce | Cómo se pinta |
 * |---|---|---|
 * | Nunca visto | el bit NO está en `celdas` | tapado del todo, terreno incluido |
 * | Visto antes | está en `celdas` pero no en `visibles` | terreno con filtro oscuro, como de noche |
 * | Viéndolo | está en `visibles` | tal cual |
 *
 * **Enmascarar es responsabilidad de ESTE cliente** (decisión del usuario, 2026-09-04), no del servidor. La
 * geografía no es información táctica —es la misma para todos y el mapa se cachea entero por su `mapaId`—,
 * así que el servidor solo dice QUÉ has explorado. Lo que no puede salir de él son las ENTIDADES, y eso ya
 * viene filtrado. El cliente de ADMINISTRACIÓN, que es herramienta de operación y no un jugador, no aplica
 * ninguna máscara.
 */
export interface NieblaProyectada {
  /** Lado de una celda, en unidades de MAPA (no de pantalla). */
  tamanoCelda: number;
  columnas: number;
  filas: number;
  /** Explorado alguna vez. Un bit por celda, en hexadecimal, recorriendo el mundo fila a fila desde (0,0);
   * el bit de `(columna, fila)` es el `fila * columnas + columna`, desde el bit MENOS significativo de cada
   * byte, y cada byte son dos caracteres hex. Cadena vacía = nada explorado. */
  celdas: string;
  /** Lo que se ve ahora mismo, mismo formato y misma rejilla. Siempre subconjunto de `celdas`. */
  visibles: string;
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
