// Copia local de los tipos de dominio devueltos por la proyección JSON.
// Mantiene a `cliente-jugador` desacoplado del motor de backend.

export interface Point {
  x: number;
  y: number;
}

/** Sigilo de una Facción: ids de `sigilo/catalogoSigilos.json`. Se elige al crear la Facción y no cambia. */
export interface Sigilo {
  formaId: string;
  campoId: string;
  emblemaId: string;
  colorPrimarioId: string;
  colorSecundarioId: string;
  colorEmblemaId: string;
  orlaId: string;
  colorOrlaId: string;
}

/** Relación diplomática entre dos Facciones (pública). En un vasallaje, A es la señora; en una guerra, quien la declaró. */
export interface RelacionPolitica {
  id?: string;
  tipo: 'vasallaje' | 'alianza' | 'guerra' | string;
  faccionAId: string;
  faccionBId: string;
  estado: 'activa' | 'rota' | string;
  /** Solo en vasallaje: A es la señora, B la vasalla. */
  tributo?: { recurso: string; cantidadPorMinuto: number };
  /** Solo en guerra: la Facción que ya ofreció la paz (la guerra acaba cuando la ofrece la otra). */
  pazPropuestaPor?: string;
}

/** Título de prestigio del servidor (backend Doc 2.9): `tituloId` es estable y da su insignia; `nombre` es solo texto. */
export interface Titulo {
  tituloId?: string;
  nombre: string;
  poseedorId: string;
  valorMetrica: number;
}

export interface Faccion {
  id: string;
  nombre: string;
  sigilo: Sigilo;
  reyId?: string | null;
  embajadorId?: string | null;
  nivel: number;
  experiencia?: number;
  ciudadanosIds?: string[];
  /** Héroes que pidieron entrar (`solicitarIngreso`); el Rey acepta o deniega (`responderSolicitud`). */
  solicitudesIds?: string[];
  reputacion?: number;
  /** Ajuste del Rey (backend Doc 2.2, 5.15.1b): sus ataques admiten héroes de otras Facciones. Ausente = no. */
  admiteOtrasEnAtaques?: boolean;
  /** Instante de MUNDO de la última designación de capital (el traslado tiene enfriamiento, Doc 2.2). */
  capitalDesignadaEn?: number;
  // ... ignoramos otros campos que no impactan el render ...
}

export interface Edificio {
  id: string;
  tipo: string; // EdificioTipo string
  estado: 'en_cola' | 'en_construccion' | 'activo';
  ambito?: 'asentamiento' | 'mapa';
  posicion: Point;
  /** Nivel del edificio (subidas de nivel internas). Ausente = 1. */
  nivelInterno?: number;
  /** Instante de MUNDO (ms) en que la obra pasa a `activo` — solo mientras `estado === 'en_construccion'`.
   * `completaEn - proyeccion.instante` da los ms restantes. */
  completaEn?: number;
  /** Score de necesidad con que entró en la cola: gobierna el orden en que arrancan los proyectos. */
  prioridad?: number;
  /** Nodo de recurso o bosque que explota (cantera/leñera/corral/minas). */
  fuenteId?: string;
  /** El edificio produce pero su recurso no cabe en el almacén, así que está parado. */
  pausadoPorAlmacenLleno?: boolean;
  /** Ocupación post-conquista (backend 2026-09-08, Doc 5.12.9): un saqueo de conquista baja un edificio a
   * `en_cola` marcándolo `danado`; se reconstruye pagando solo una fracción del costo. Ausente = sano. */
  danado?: boolean;
  /** Mejora de nivel interno en marcha (backend 2026-09-26): sigue `activo` y produciendo con su nivel actual, ocupa
   * una cuadrilla de obra, y `nivelInterno` sube al llegar `completaEn`. Ausente = no se está mejorando. */
  mejora?: { nivelObjetivo: number; completaEn: number };
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
  /** No se levanta otra celda antes de este instante de mundo (backend 2026-09-26: la muralla va por minutos por
   * celda). Ausente = se puede ya. */
  siguienteCeldaEn?: number;
}

export interface Asentamiento {
  id: string;
  nombre?: string;
  faccionId: string;
  posicion: Point;
  nivel: number;
  nivelActual?: number;
  /** El medidor de mantenimiento 0-100. El dominio lo llama `medidorMantenimiento` — antes este tipo lo
   * declaraba como `mantenimiento?` (typo), así que siempre valía `undefined` (bug silencioso, ver
   * `Analisis_Brecha_Backend.md` §3). Corregido en el sync del 2026-09-08. */
  medidorMantenimiento?: number;
  /** Ocupación militar tras una conquista (backend 2026-09-08, Doc 5.12.9): instante de MUNDO (ms desde la
   * época Unix) en que termina. Mientras `instante < ocupacionHasta`: inmune a nuevo asedio, recauda oro
   * reducido, crece más lento, el mantenimiento no degrada. Ausente = no ocupado (caso normal). */
  ocupacionHasta?: number;
  poblacion?: { pesants: number; artesanos: number; nobleza: number };
  /** Nutrición de la población 0-100 (hambruna). Ausente = 100. */
  nutricionPoblacion?: number;
  /** Racha de ticks con mantenimiento sano (para recuperar `nivelActual`). */
  rachaMantenimientoSano?: number;
  almacen?: Record<string, { cantidad: number; capacidad: number }>;
  edificios: Edificio[];
  /** El almacén está abierto a los ejércitos ALIADOS que pasan (`alternarReabastecerAliados`, Doc 5.13). Ausente = cerrado. */
  permiteReabastecerAliados?: boolean;
  /** Auto-construcción congelada: el motor deja de comprometer necesidades nuevas. Ausente = activa. */
  autoConstruccionPausada?: boolean;
  /** Recetas de transformación paradas por el Gobernador o el Maestro de Obras (`alternarReceta`, Doc 4.2.1), por el recurso que producen. Ausente = todas en marcha. */
  recetasPausadas?: string[];
  /** Reserva de recursos calibrada por el Tesorero (0-999 por recurso). */
  reservaManual?: Record<string, number>;
  /** Políticas de cargo en vigor (Doc 4.4): duran un plazo fijo y no se cancelan. */
  politicasActivas?: { id: string; politicaId: string; cargo: string; activadaEn: number; expiraEn: number }[];
  /** Instante de mundo en que esta plaza creó su última caravana (de Fundación o comercial): arranca el cooldown compartido. */
  ultimaCaravanaCreadaEn?: number;
  /** Héroes residentes que llegaron fundando · comprando casa (Doc 2.5). */
  heroesFundadoresIds?: string[];
  casasCompradas?: string[];
  /** Cargos designados (Doc 2.5) — quién puede ordenar qué. Llegan como id o `null`. */
  cargos?: {
    gobernadorId?: string | null;
    maestroObrasId?: string | null;
    tesoreroId?: string | null;
    generalId?: string | null;
    sacerdoteId?: string | null;
  };
  /** Recintos de muralla, del más interior al más exterior (Paso 2a en adelante). Vacío/ausente = sin muro. */
  recintos?: Recinto[];
  /** Obra de ascenso de nivel en curso (Doc 4.5, `solicitarAscenso`): al llegar `completaEn`, `nivel` sube a
   * `nivelObjetivo`. Ya pagada; se pierde si conquistan la plaza. Ausente = no hay obra. */
  ascenso?: { nivelObjetivo: number; iniciadoEn: number; completaEn: number };
  /** La puerta (Doc 1.10.5): grupos a los que se cierra. Ausente = el cierre por defecto (neutrales y enemigos). */
  puertaCerradaA?: GrupoPuerta[];
  /** Jugadores vetados por el Gobernador. Ausente = nadie. */
  vetadosIds?: string[];
  /** Id de la Facción de la que es capital designada (Doc 2.2). */
  capitalDeFaccionId?: string;
}

export type GrupoPuerta = 'neutrales' | 'aliados' | 'enemigos' | 'aedas';

/** Por qué no se puede pedir la subida de nivel (backend `BloqueoAscenso`, `engine/ascenso.ts`). */
export type BloqueoAscenso =
  | 'nivel_maximo'
  | 'ascenso_en_curso'
  | 'falta_poblacion'
  | 'faltan_edificios'
  | 'sin_cupo_de_faccion'
  | 'recursos_insuficientes'
  | 'insolvente';

/** Si la plaza que pisas puede pedir ya la subida de nivel y, si no, por qué (backend `EvaluacionAscenso`). Viaja en
 * `ProyeccionJugador.ascensoDeAsentamiento` solo estando dentro. */
export interface EvaluacionAscenso {
  nivel: number;
  /** `nivel + 1`, o `null` en el máximo. */
  nivelObjetivo: number | null;
  /** Se paga entero del almacén al empezar. */
  costo: Partial<Record<string, number>>;
  obraMinutos: number;
  /** Ingresos de hoy frente al mantenimiento del nivel objetivo, por minuto de mundo y recurso. */
  solvencia: { recurso: string; ingresoPorMinuto: number; costoPorMinuto: number }[];
  bloqueos: BloqueoAscenso[];
  puede: boolean;
}

/** Una batalla de Unity que se ve en el mapa o en la que combates (backend `BatallaVisible`, doc 02 §4.1). Solo existen
 * si el backend declara `SERVIDORES_BATALLA`; sin ellos todo combate se resuelve con números y el array llega vacío.
 * Las columnas y caravanas que están en una no viajan en `ejercitosAvistados`: la batalla las sustituye. */
export interface BatallaVisible {
  battleId: string;
  estado: 'convocando' | 'asignada' | 'en_curso' | 'aplicada' | 'cancelada' | 'fallida';
  /** `tipo`: `asedio` (con `asentamientoId`), `campo_abierto` (con `columnas`: `ejercitos` = batalla campal, `solitarios` = persecución),
   * `caravana` o `campamento_bandidos` (un evento PvE). */
  contexto: { tipo: string; [campo: string]: unknown };
  punto: Point;
  bandos: Record<'atacante' | 'defensor', { faccionId: string | null; heroes: number; capacidadMaxima: number }>;
  /** Tu bando, si combates en ella. */
  ladoPropio?: 'atacante' | 'defensor';
}

export interface Caravana {
  id: string;
  origenAsentamientoId: string;
  destinoAsentamientoId?: string;
  posicionActual: Point;
  ruta?: Point[];
  /** Estado de la caravana (motor, Doc 3.13). `'aparcada'` (2026-09-09, Doc 3.13.7) = una caravana adjunta
   * que su ejército dejó en una plaza de la Facción al `guarnecer`: sigue siendo de su origen, no la usa la
   * anfitriona. Sin interfaz que lo lea todavía — el mapa solo pinta la posición. */
  estado?: 'disponible' | 'preparando' | 'adjunta' | 'aparcada' | 'en_transito' | 'retornando';
  /** `construccion` = Caravana de Fundación (Doc 1.8): la de un campamento y la que lanza una plaza son la misma entidad. */
  tipo?: 'comercial' | 'construccion' | 'militar' | 'contrabando';
  /** Caravana de Fundación comprada en un campamento (Doc 1.9b): de dónde salió, su Facción y quién la lleva y funda. */
  origenCampamentoId?: string;
  faccionId?: string;
  titularId?: string;
  /** Escuadras cedidas como escolta (ids; backend 2026-10-08, Doc 3.13.4). */
  escoltaIds?: string[];
  /** Liderazgo que gasta su escolta y cupo que le da el Mercado de su origen: derivado por el backend, solo en las comerciales de una plaza propia. */
  escoltaLiderazgo?: { usado: number; cupo: number };
  /** Revamp de caravanas (Doc 3.13): solo en las comerciales. Solo los carros con animal tiran. */
  carros?: { tipoCarro: 'basico' | 'reforzado'; animal?: 'buey' | 'caballo' | 'camello' }[];
  /** Fuera del reparto automático de trueques. */
  reservadaManual?: boolean;
  /** Lo que lleva cargado (recurso -> cantidad). */
  contenido?: Record<string, number>;
  /** Caravana de Fundación suelta: hasta cuándo espera a alguien que la lleve (instante de mundo). */
  caducaEn?: number;
  /** Instante de mundo en que sale, solo en `preparando`. */
  preparaHasta?: number;
}

/** Copia local de `Ejercito` (motor, Doc 5.12) — los de TU Facción, que la proyección manda completos.
 * Solo los campos que pinta el mapa; el resto (suministro, objetivo, caravanas adjuntas) llegará cuando haya
 * un panel de campaña que los muestre. */
export interface Ejercito {
  id: string;
  faccionId: string;
  origenAsentamientoId: string;
  /** Solo ids (backend 2026-09-14): las escuadras viven en su héroe. Las tuyas están en `proyeccion.heroe.escuadrones`;
   * de los demás participantes solo se ve `heroesVisibles[].escuadrasQueLleva`. */
  escuadronIds: string[];
  /** Héroes que MARCHAN en la columna (Doc 5.12.2), lleven tropa o no: un rombo por cada uno. */
  participantes: { heroeId: string; unidoEn: number }[];
  ruta: Point[];
  posicionActual: Point;
  estado: 'marchando' | 'estacionado' | 'regresando';
  /** Caravanas enganchadas a la columna (Doc 3.13): la de Fundación de un campamento se lleva así hasta `fundar`. */
  caravanasAdjuntasIds?: string[];
  /** El carro: lo de todos sus héroes, ya sumado (recurso -> cantidad). En marcha se come de aquí. */
  suministro?: Record<string, number>;
  /** Lo que cabe en el carro, con sus caravanas (DERIVADO por el backend desde 2026-10-07). */
  capacidadCarga?: number;
  /** `personal` (un héroe que sale por su cuenta) o `ejercito`: un ejército y una columna personal nunca combaten entre sí (Doc 5.12.1). */
  tipo?: 'personal' | 'ejercito';
  liderId?: string;
  /** Una formación en campo (Doc 5.14.4): columna quieta que espera a ser tres. Pasado `expiraEn` sin lograrlo se deshace. */
  formacion?: { expiraEn: number };
  /** Quién puede unirse en campo (Doc 5.14.1): la fija el Líder al formar y no cambia. */
  politicaDeUnion?: 'rechazar' | 'aceptar' | 'preguntar';
  /** Con política `preguntar`: las peticiones vivas al Líder (caducan a los 10 s; el backend no las borra, se miran contra el instante de mundo). */
  peticionesDeUnion?: { heroeId: string; pedidoEn: number; expiraEn: number }[];
  /** A quién persigue (Doc 5.12.3): un objetivo móvil en vez de un punto. Ausente = nadie. */
  persiguiendo?: { tipo: 'ejercito' | 'caravana'; id: string };
}

/**
 * Un ejército AJENO tal como llega redactado del servidor (Doc 5.12.7): dónde está, de qué Facción es,
 * cuántos estandartes se le cuentan y qué héroes van en él. No hay más — ni escuadrones (su poder), ni ruta
 * (su intención), ni estado. La redacción la hace `proyectarParaJugador`, no este cliente: lo que no sale del
 * backend no se puede mirar en un DevTools.
 */
export interface EjercitoAvistado {
  id: string;
  tipo?: 'personal' | 'ejercito';
  /** Una formación en campo (Doc 5.14.4): se le puede unir una columna personal de su Facción. */
  enFormacion?: true;
  faccionId: string;
  posicionActual: Point;
  participantes: number;
  /** Quiénes van (Doc 5.16.7): un héroe que se ve es público. Su ficha, en `proyeccion.heroesVisibles`. */
  heroeIds: string[];
  /** Va tras una columna tuya (backend 2026-10-06): lo único de su intención que se revela, y solo a quien persigue. */
  teSigue?: true;
}

/**
 * Una caravana AJENA que se ve AHORA, redactada (Doc 5.12.3): QUÉ lleva, nunca cuánto. `escoltada` = va adjunta a un ejército O lleva escuadras cedidas sin héroe
 * (backend 2026-10-09); de ahí no se saca cuál de las dos (adjunta = viaja pegada a un ejército avistado).
 */
export interface CaravanaAvistada {
  id: string;
  posicionActual: Point;
  /** De quién es, por su plaza de origen; ausente si esa plaza ya no existe. */
  faccionId?: string;
  escoltada: boolean;
  recursos: string[];
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
  /** Sus edificios ACTIVOS (el servidor filtra los demás): con ellos se sabe, p. ej., si tiene Mercado. */
  edificios?: Edificio[];
  /** Solo de una plaza PROPIA con una columna tuya a su puerta (`radioPuerta`): su almacén. Ausente en el resto. */
  almacen?: Record<string, { cantidad: number; capacidad: number }>;
}

/** Lo que dio `inspeccionar` (backend 2026-10-09): composición de una columna, carga de una caravana o defensa de una plaza. */
export type ContenidoInforme =
  | { ejercitoId: string; faccionId: string; heroesIds: string[]; escuadrones: { tropaId: string; cantidad: number; heroeId: string }[] }
  | { caravanaId: string; escoltada: boolean; recursos: string[] }
  | { asentamientoId: string; faccionId: string; heroesIds: string[]; guarnicion: { tropaId: string; cantidad: number; heroeId: string }[] };

/** Lo último que inspeccionó un héroe tuyo, vigente hasta `expiraEn` (10 min de mundo). Uno por objetivo. */
export interface InformeDeInspeccion {
  heroeId: string;
  objetivo: { tipo: 'ejercito' | 'caravana' | 'asentamiento'; id: string };
  vistoEn: number;
  expiraEn: number;
  donde: Point;
  contenido: ContenidoInforme;
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
  /** Lo que hay que vencer, fijo (Doc 1.9). Se ataca con la columna que llega hasta él (`atacar`). */
  poder: number;
  /** Nivel 1-3 (D21, D37): fija el poder y el oro del botín (`GET /v1/balance`, `internas.CAMPAMENTOS_BANDIDOS.niveles`). */
  nivel: 1 | 2 | 3;
  /** Dónde acampa: el bosque, y a quién acosa — la plaza o el campamento de mercenarios en cuyo anillo vive. */
  bosqueId?: string;
  asentamientoId?: string;
  campamentoMercenariosId?: string;
}

/** Copia local de `CaminoProyectado` (motor, Doc 1.6): un tramo de la red de caminos ya fusionado por el servidor,
 * bajo la niebla. `escalon` por peso (rutas vigentes que lo recorren): 0 sendero, 1 camino, 2 calzada. */
export interface CaminoProyectado {
  id: string;
  escalon: 0 | 1 | 2;
  puntos: Point[];
}

/**
 * Copia local de `OrdenMercado` (motor, Doc 3.3): una oferta de compra/venta EN PIE en un asentamiento.
 * Desde 2026-09-07 el servidor ya no la liquida solo por emparejamiento: hace falta el comando
 * `comerciarEnPlaza`, con la columna del jugador plantada en la puerta de esa plaza
 * (`Comercio_Fisico_Definicion.md` en el backend), y una orden que nadie toma **caduca** en `expiraEn`.
 * Sin interfaz que la lea todavía — ver `Analisis_Brecha_Backend.md` §3.
 */
export interface OrdenMercado {
  id: string;
  asentamientoId: string;
  tipo: 'compra' | 'venta';
  recurso: string;
  cantidad: number;
  cantidadCumplida: number;
  precioUnitario: number;
  /** Instante de MUNDO (ms desde la época Unix), como el resto de instantes del contrato. */
  creadoEn: number;
  expiraEn: number;
  estado: 'activa' | 'cumplida' | 'expirada';
}

/** Una línea de un trueque (motor, `LineaTrueque`): un recurso, lo pactado y lo ya entregado por caravana. */
export interface LineaTrueque {
  recurso: string;
  cantidadTotal: number;
  cantidadEntregada: number;
}

/**
 * Copia local de `AcuerdoTrueque` (motor, Doc 3.2): un contrato marco entre DOS ASENTAMIENTOS —no entre
 * jugadores—, cada lado comprometido a entregar sus líneas (trueque compuesto, 2026-10-02). Nace `'propuesto'` y no
 * obliga a nadie hasta que el lado receptor (B) contesta con `aceptarTrueque`/`rechazarTrueque`.
 */
export interface AcuerdoTrueque {
  id: string;
  asentamientoAId: string;
  asentamientoBId: string;
  lineasA: LineaTrueque[];
  lineasB: LineaTrueque[];
  creadoEn: number;
  /** Propuesto: plazo para contestar; activo: plazo para cumplir (se recuenta desde el sí). */
  expiraEn: number;
  estado: 'propuesto' | 'activo' | 'rechazado' | 'cumplido' | 'expirado';
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

/** Producción por minuto de mundo de un tipo de edificio productor/transformador — la calcula el servidor
 * (`produccionPorMinuto`, entrada privilegiada) y viaja en `ProyeccionJugador.produccionDeAsentamiento` solo
 * para la plaza que pisas. */
export interface ProduccionItem {
  tipo: string;
  recurso: string;
  activos: number;
  cantidadPorMinuto: number;
}

/** `params` de `crearHeroe` (backend `session/comandos/crearHeroe.ts`). `classDefinitionId` y las piezas de
 * `avatar` son ids de los catálogos de Conquest: el backend los guarda sin interpretarlos. */
export interface ParamsCrearHeroe {
  displayName: string;
  classDefinitionId: string;
  genero: 'masculino' | 'femenino';
  avatar: { cabezaId: string; peloId: string; barbaId: string; cejasId: string };
  /** El campamento de mercenarios donde nace, dentro y como residente (backend 2026-10-04, Doc 1.3/1.9b). */
  campamentoId: string;
}

/** Un campamento de la pantalla de elección de `crearHeroe` (`sinHeroe`): las dos cifras solo informan. */
export interface CampamentoParaElegir {
  id: string;
  posicion: Point;
  origen: number;
  eligieronComoInicial: number;
  residentes: number;
}

/** Copia local de `CampamentoMercenarios` (backend, Doc 1.9b): enclave neutral donde se nace, se reside sin plaza, se
 * pide tropa prestada, se compra y se junta el fondo para fundar. Viajan los que tu Facción conoce. */
export interface CampamentoMercenarios {
  id: string;
  posicion: Point;
  origen: number;
  edificios: string[];
  residentesIds: string[];
  eligieronComoInicial: number;
  /** Stock en venta: bien -> unidades. */
  mercado: Record<string, number>;
  /** Fondo de refundación: `heroeId` -> recurso -> lo que aportó. */
  fondos: Record<string, Record<string, number>>;
}

/** Un alijo de exploración a la vista que aún no abriste (Doc 1.9b): su oro va a tu oro de botín. */
export interface Alijo {
  id: string;
  posicion: Point;
  oro: number;
}

export type AtributoHeroe = 'fuerza' | 'destreza' | 'armadura' | 'vitalidad';
export type SlotEquipo = 'arma' | 'casco' | 'torso' | 'guantes' | 'pantalones' | 'botas';

/** Copia local de `ItemInstancia` (backend, doc 01 §12.1: el `InventoryItem` de Conquest). Hoy inventario y equipo
 * llegan siempre vacíos: no hay `equipar` ni de dónde sacar objetos hasta CQ-004. */
export interface ItemInstancia {
  itemDefinitionId: string;
  tipo: 'arma' | 'armadura' | 'consumible' | 'visual';
  cantidad: number;
  /** Solo el equipo único; ausente = apilable. */
  itemInstanceId?: string;
  estadisticas?: { nombre: string; valor: number }[];
  precio: number;
  /** -1 si no ocupa casilla. */
  casillaInventario: number;
}

/** Una escuadra de tu héroe (backend `Escuadron`, Doc 5.16.2). Como mucho una por `tropaId`; persiste a 0 y se
 * repone reclutando. */
export interface Escuadron {
  id: string;
  nombre: string;
  heroeId: string;
  tropaId: string;
  origen: 'pesants' | 'artesanos' | 'nobleza';
  cantidad: number;
  nivel: number;
  experiencia: number;
  /** 0-100, por raciones (Doc 5.4). */
  moral: number;
  /** Dónde está: en el campamento de tu residencia, en una columna o escoltando una caravana. */
  contenedor: { tipo: 'campamento' } | { tipo: 'ejercito'; ejercitoId: string } | { tipo: 'escolta'; caravanaId: string } | { tipo: 'fuera' };
  /** Prestada por un campamento de mercenarios (Doc 1.9b): gratis, sin experiencia. */
  prestada?: { campamentoId: string };
  /** En la guarnición de tu residencia (`asignarGuarnicion`). Solo con `contenedor: campamento`. */
  enGuarnicion: boolean;
  /** Progresión táctica de Conquest: el backend la guarda sin interpretarla. */
  habilidadesDesbloqueadas: string[];
  formacionesDesbloqueadas: number[];
  formacionSeleccionada: number;
  /** Lo que cuesta en Liderazgo, calculado por el servidor: con esto se sabe si un loadout cabe antes de guardarlo. */
  costeLiderazgo: number;
}

/** Una selección de escuadras guardada (Doc 5.16.5). El `activo` es el que defiende tu residencia mientras estás
 * dentro (Doc 5.12.4); solo hay uno. */
export interface Loadout {
  id: string;
  displayName: string;
  squadIds: string[];
  perksSeleccionados: number[];
  activo: boolean;
  /** Liderazgo que suman sus escuadras, calculado por el servidor. */
  liderazgoTotal: number;
}

/** Tu héroe, completo (`HeroeProyectado` del backend, doc 02 §4.1). */
export interface HeroeProyectado {
  id: string;
  jugadorId: string | null;
  controlador: 'humano' | 'bot';
  displayName: string;
  classDefinitionId: string;
  genero: 'masculino' | 'femenino';
  avatar: ParamsCrearHeroe['avatar'];
  liderazgoBase: number;
  ubicacion:
    | { tipo: 'asentamiento'; asentamientoId: string }
    | { tipo: 'columna'; ejercitoId: string }
    | { tipo: 'mercenarios'; campamentoId: string }
    | { tipo: 'desconectado'; punto: Point };
  /** Lo que guarda en su campamento de residencia (Doc 2.5). */
  almacenPersonal?: Record<string, number>;
  /** Tope del almacén personal (DERIVADO por el backend desde 2026-10-07). */
  capacidadAlmacenPersonal?: number;
  /** Oro de bandidos y alijos: solo se gasta en el mercado de un campamento o en el fondo de refundación (Doc 1.9). */
  oroDeBotin?: number;
  /** Víveres (backend 2026-10-08, Doc 5.13): el trigo que come tu columna. Siempre contigo, hasta `LOGISTICA.capacidadViveresPorHeroe`; ausente = 0. */
  viveres?: number;
  /** TODAS tus escuadras, estén donde estén (`contenedor`). */
  escuadrones: Escuadron[];
  nivel: number;
  experienciaHaciaSiguienteNivel: number;
  puntosDeAtributoSinGastar: number;
  puntosDePerkSinGastar: number;
  /** Solo lo repartido (tope 100 por atributo); la base de la clase la suma Conquest. */
  atributosBase: Record<AtributoHeroe, number>;
  perksDesbloqueados: number[];
  loadouts: Loadout[];
  inventario: ItemInstancia[];
  equipamiento: Record<SlotEquipo, ItemInstancia | null>;
  /** Economía propia del héroe, sin relación con el oro recurso. Nace con 500 de bronce. */
  monedasHeroe: { bronce: number; plata: number; oro: number };
  /** Cupo de guarnición que te da tu residencia, en Liderazgo (0 si no resides en ninguna). */
  cupoGuarnicion: number;
  /** Liderazgo de tus escuadras en guarnición: lo libre es `cupoGuarnicion - guarnicionOcupada` (puede ser negativo
   * si el cupo bajó, porque lo asignado se queda). */
  guarnicionOcupada: number;
  /** Herido hasta este instante de mundo (Doc 5.16.4): 2 minutos tras perder una batalla. Mientras dura no ataca, no
   * persigue y sus escuadras no combaten. Vencido o ausente = sano. */
  heridoHasta?: number;
  /** Sin ningún cliente conectado (Doc 1.10.6): sale del mundo en este instante si no vuelve antes. */
  desconectaEn?: number;
}

/** Un héroe ajeno que se ve (Doc 5.16.7): solo su parte pública. */
export interface HeroePublico {
  heroeId: string;
  displayName: string;
  classDefinitionId: string;
  nivel: number;
  /** Solo mientras está herido (Doc 5.16.4). */
  heridoHasta?: number;
  /** Las que lleva en su columna; las del campamento no se ven. */
  escuadrasQueLleva: { tropaId: string; cantidad: number; nivel: number }[];
  /** `itemDefinitionId` de lo que lleva puesto en cada hueco. */
  equipamiento: Record<SlotEquipo, string | null>;
}

/** `params` de `repartirPuntos`: puntos a sumar por atributo, enteros ≥ 0 que no pasen de `puntosDeAtributoSinGastar`. */
export interface ParamsRepartirPuntos {
  atributos: Partial<Record<AtributoHeroe, number>>;
}

/** `params` de `guardarLoadout`. Sin `loadoutId` crea uno; `activo` ausente conserva el que tenía (uno nuevo, no activo). */
export interface ParamsGuardarLoadout {
  loadoutId?: string;
  displayName: string;
  squadIds: string[];
  perksSeleccionados: number[];
  activo?: boolean;
}

// --- Anexión con aceptación (backend 2026-10-06, Doc 2.6) ---

/** Una propuesta de anexión vigente que ofrece o recibe tu Facción: la absorbida desaparece al aceptarla su Rey. Caduca en `expiraEn`. */
export interface PropuestaAnexion {
  id: string;
  absorbenteId: string;
  absorbidaId: string;
  /** El Rey o Embajador de la absorbente que la hizo. */
  propuestaPor: string;
  creadaEn: number;
  expiraEn: number;
}

// --- Alianza y vasallaje con aceptación (backend 2026-10-09, Doc 2.3 y 2.4) ---

/** Una propuesta de alianza o vasallaje vigente que hace o recibe tu Facción: la relación nace si la acepta el Rey de B. En vasallaje A es la señora. Caduca en `expiraEn`. */
export interface PropuestaRelacion {
  id: string;
  tipo: 'alianza' | 'vasallaje';
  faccionAId: string;
  faccionBId: string;
  /** Solo en vasallaje: lo que pagaría B a A. */
  tributo?: { recurso: string; cantidadPorMinuto: number };
  /** El Rey o Embajador de A que la hizo. */
  propuestaPor: string;
  creadaEn: number;
  expiraEn: number;
}

// --- Fusión con aceptación (backend 2026-10-06, Doc 2.6) ---

/** Una propuesta de fusión vigente que hace o recibe tu Facción: al aceptarla el Rey de B, las dos desaparecen y nace una nueva. Caduca en `expiraEn`. */
export interface PropuestaFusion {
  id: string;
  /** Quien propone (su Rey). */
  faccionAId: string;
  /** Quien contesta (su Rey). */
  faccionBId: string;
  nuevoNombre: string;
  /** Rey de la Facción nueva: el Rey de A o el de B. */
  nuevoReyId: string;
  propuestaPor: string;
  creadaEn: number;
  expiraEn: number;
}

// --- Intel de las tabernas (backend 2026-10-05, Doc 5.12.10) ---

/** Una Mirada de tu Facción: un ojo prestado sobre un punto del mapa. Abierta hasta `expiraEn`; la zona sigue vedada hasta `libreEn`. */
export interface MiradaIntel {
  id: string;
  faccionId: string;
  /** La taberna donde se compró: un asentamiento o un campamento de mercenarios. */
  origenId: string;
  centro: Point;
  radio: number;
  compradaEn: number;
  expiraEn: number;
  libreEn: number;
}

/** Un edificio tal como lo cuenta un Informe: sin colas ni trabajadores. `posicion` es local al asentamiento. */
export interface EdificioInforme {
  tipo: string;
  posicion: Point;
  estado: 'en_cola' | 'en_construccion' | 'activo';
  nivelInterno?: number;
  ambito?: 'asentamiento' | 'mapa';
}

/** El Informe de una plaza ajena: la foto, con su fecha, de su layout y su defensa al comprarlo. Nunca el almacén. */
export interface InformePlaza {
  asentamientoId: string;
  faccionId: string;
  nombre?: string;
  nivel: number;
  conocidoEn: number;
  edificios: EdificioInforme[];
  recintos: { nivel: number; celdas: CeldaMuro[]; avance: number }[];
  guarnicion: { tropaId: string; cantidad: number; heroeId: string }[];
  heroesIds: string[];
}

/** Lo que cuesta la intel (`INTEL` del backend), para cotizar antes de comprar. */
export interface TarifasIntel {
  mirada: { radio: number; duracionMinutos: number; oroBase: number; oroPorUnidad: number; cooldownMinutos: number };
  informe: { oroPorNivel: number; cooldownMinutos: number };
  /** Miradas abiertas a la vez por taberna: por nivel interno de la de plaza (índice 0 = nivel 1) y la fija de un campamento. */
  cupoMiradas: { porNivelDeTaberna: number[]; campamento: number };
}

/** Dónde se compra: la taberna de una plaza propia o la de un campamento de mercenarios. */
export type OrigenDeIntel = { tipo: 'asentamiento' | 'campamento'; id: string };

/** La planta de un campamento de mercenarios (backend D73, `EscenaCampamento`): coordenadas locales con el origen en el centro de la taberna,
 * `y` hacia abajo; una celda (col, row) ocupa de (col, row) a (col + 1, row + 1) por `unidadesPorCelda`. Solo viaja estando dentro. */
export interface EscenaCampamento {
  campamentoId: string;
  origen: number;
  layoutVersion: number;
  unidadesPorCelda: number;
  /** `posicion` es el centro de la huella, en unidades; `ancho` y `alto` van en celdas. */
  edificios: { edificioId: string; tipo: string; posicion: Point; ancho: number; alto: number }[];
  /** Calles en celdas: esquina superior izquierda y tamaño. */
  calles: { col: number; row: number; ancho: number; alto: number }[];
  /** La empalizada decorativa; `puerta` es por donde se entra y se sale. */
  empalizada: { col: number; row: number; clase: 'muro' | 'puerta' }[];
}

/** Un evento de dominio del backend tal como lo sirve `GET .../eventos`. */
export interface EventoDominio {
  codigo: string;
  mensaje: string;
  version: number;
  asentamientoId?: string;
  /** Fecha de mundo del evento (ISO). */
  momento?: string;
  payload?: unknown;
}


/** Un ejército EN PREPARACIÓN dentro de una plaza o de un campamento (backend 2026-10-08, Doc 5.14.5): visible para los de su Facción que están en ese lugar. */
export interface Convocatoria {
  id: string;
  lugar: { tipo: 'asentamiento' | 'campamento'; id: string };
  liderId: string;
  politicaDeUnion: 'aceptar' | 'preguntar';
  creadaEn: number;
  /** Solo los que siguen dentro, el Líder primero. */
  integrantes: { heroeId: string; unidoEn: number; escuadronIds: string[]; tropas: { escuadronId: string; tropaId: string; nombre: string; nivel: number; moral: number; cantidad: number }[]; carga: Record<string, number> }[];
  /** El Líder las ve todas; cada solicitante, la suya. Las caducadas no se barren solas: se filtran por `expiraEn`. */
  peticiones: { heroeId: string; pedidoEn: number; expiraEn: number; escuadronIds: string[]; carga: Record<string, number> }[];
  soyLider: boolean;
  soyIntegrante: boolean;
}

// --- Tecnología y Aedas (backend Doc 6) ---

/** Ids de Era y de tecnología tal como viajan; sus nombres, Eras y tarifas están en el balance (`catalogoDeTecnologia` de `apiCliente.ts`). */
export type EraId = string;
export type TecnologiaId = string;

/** Una condición del hito de la Facción (Doc 6.3): `edificio` activo en cualquier plaza propia (`nivelInterno` es un mínimo). */
export type CondicionHito =
  | { tipo: 'edificio'; edificio: string; nivelInterno?: number }
  | { tipo: 'tecnologia'; id: TecnologiaId }
  | { tipo: 'recursoEnCapital'; recurso: string }
  | { tipo: 'capitalEnNivel'; nivel: number; conEdificio: string }
  | { tipo: 'yacimientoEnTerritorio'; recurso: string };

/** Lo que sabe el jugador de la tecnología del mundo (`proyeccion.tecnologia`, Doc 6.3-6.4). */
export interface TecnologiaJugador {
  era: EraId;
  eraDesde: number;
  /** Logros cumplidos, por orden: qué ha pasado en el mundo (`contador` llegó a `umbral`) y cuándo. No dicen qué tecnología abren. */
  logros: { contador: string; umbral: number; en: number }[];
  /** `null` sin Facción. */
  propias: { aparecidas: TecnologiaId[]; adoptadas: TecnologiaId[]; reveladas?: TecnologiaId[] } | null;
  /** Lo que un Aeda le ha revelado y aún no le ha aparecido: quién la desbloqueó y el hito completo (sin progreso). */
  reveladas: { tecnologiaId: TecnologiaId; descubridorFaccionId: string; hito: CondicionHito[]; cumplidas: boolean[] }[];
  /** La Era de cada tecnología tuya (aparecida, adoptada o revelada). */
  eraDe?: Partial<Record<TecnologiaId, EraId>>;
  /** La plaza capital de tu Facción (donde el Rey adopta), o `null`. */
  capitalId?: string | null;
  /** Tecnologías cuya épica puede empezar ahora un Aeda residente tuyo. */
  epicasPosibles?: TecnologiaId[];
}

/** Un Aeda residente de una plaza propia, con su épica en curso si la hay (Doc 6.7). */
export interface AedaResidenteProyectado {
  id: string;
  nombre: string;
  asentamientoId: string;
  epica?: {
    tecnologiaId: TecnologiaId;
    nombre: string;
    /** Capítulo en curso (desde 0), cuántos hay, cómo se llama y cuántos hechos lleva de los que pide. */
    capitulo: number;
    capitulos: number;
    tituloCapitulo: string;
    hechos: number;
    hechosNecesarios: number;
    /** Instante de mundo del último hecho contado; el siguiente no cuenta hasta pasado el enfriamiento. */
    ultimoHechoEn?: number;
  };
}

/** Un Aeda itinerante a la vista; `enAsentamientoId` = la plaza en que está detenido, donde se le puede comprar. */
export interface AedaAvistado {
  id: string;
  posicion: Point;
  enAsentamientoId?: string;
}
