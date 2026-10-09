// Wrapper `fetch` sobre la superficie `/jugador/*` y `/sesiones` del backend (Fase C3) — sin lógica de negocio, solo I/O.
import type { MapaGenerado } from './terreno';

import type { AcuerdoTrueque, AedaAvistado, AedaResidenteProyectado, Alijo, Asentamiento, AsentamientoAvistado, AsentamientoConocido, BatallaVisible, CaminoProyectado, CampamentoBandido, CampamentoMercenarios, CampamentoParaElegir, Caravana, Convocatoria, Ejercito, EjercitoAvistado, EscenaCampamento, EvaluacionAscenso, EventoDominio, Faccion, HeroeProyectado, HeroePublico, InformePlaza, MiradaIntel, NieblaProyectada, OrdenMercado, ParamsGuardarLoadout, ParamsRepartirPuntos, ProduccionItem, PropuestaAnexion, PropuestaFusion, RelacionPolitica, TarifasIntel, TecnologiaJugador, Titulo, ZonaFaccion, TrazadoAsentamiento } from './tiposDominio';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    mensaje: string
  ) {
    super(mensaje);
  }
}

export interface ProyeccionJugador {
  gameId: string;
  /** Instante de MUNDO "ahora" de la partida, en ms desde la epoca Unix. Es la UNICA referencia temporal del
   * contrato desde que se cerro la Fase D: el `tick` interno del motor dejo de viajar, y este campo llevaba
   * declarado aqui como `tick: number` desde entonces — o sea, siempre `undefined`. */
  instante: number;
  version: number;
  /** El héroe con el que juega esta membresía (backend 2026-09-14; antes `jugadorId`). Todo id de persona que
   * viaja —cargos, `reyId`, `ciudadanosIds`, dueños de escuadrón, participantes de columna— es un id de héroe. */
  heroeId: string;
  /** Discrimina contra `PartidaSinHeroe`. */
  sinHeroe?: undefined;
  faccionId: string | null;
  mapaId: string;
  facciones: Faccion[];
  /** Los de tu Faccion, completos. */
  asentamientos: Asentamiento[];
  /** Los AJENOS que se estan viendo ahora, redactados a su ficha. Array aparte de `asentamientos` a
   * proposito: la diferencia entre "lo veo entero" y "solo lo avisto" es de tipo, no un campo opcional del
   * que este cliente pueda olvidarse. */
  asentamientosAvistados: AsentamientoAvistado[];
  /** Los que se vieron alguna vez y ahora no se ven: la ultima foto, congelada, con su `conocidoEn`. Nunca
   * repite lo que ya esta en `asentamientosAvistados` — cuando algo se ve y ademas se recuerda, gana lo que
   * se ve. */
  asentamientosConocidos: AsentamientoConocido[];
  /** Las dos mascaras de la niebla (ver `NieblaProyectada`). Aplicarlas es cosa de este cliente. */
  exploracion: NieblaProyectada;
  /** De quien es el suelo que pisa cada ejercito PROPIO: `ejercitoId` -> `faccionId`, o ausente si marcha
   * por tierra de nadie. Lo resuelve el servidor y no este cliente: aqui solo estan las zonas de lo que se
   * ve, asi que fallaria justo en el caso que importa — una capital vigila 240 y una columna ve 150, o sea
   * que se puede entrar en su territorio sin llegar a divisar la ciudad. */
  territorioPorEjercito: Record<string, string>;
  caravanas: Caravana[];
  /** Los ejércitos de tu Facción, completos (Doc 5.12). */
  ejercitos: Ejercito[];
  /** Los ejércitos en preparación del lugar donde estás (plaza o campamento) y de tu Facción, y la tuya si estás en una. */
  convocatorias?: Convocatoria[];
  miConvocatoriaId?: string;
  /** Los ajenos que se estén viendo AHORA —lo que vigilan tus plazas o el radio de visión de una columna
   * tuya—, ya redactados por el servidor (Doc 5.12.7). Entran y salen del array según los pierdas de vista:
   * a diferencia de los asentamientos, de un ejército NO se guarda memoria. Tiene sentido — una ciudad sigue
   * donde estaba, una columna en marcha no. */
  ejercitosAvistados: EjercitoAvistado[];
  /** Tu héroe, completo (backend 2026-09-14). El backend lo tipa `| null`, pero la ruta HTTP responde
   * `PartidaSinHeroe` antes de proyectar a una membresía sin héroe: aquí siempre llega. */
  heroe: HeroeProyectado;
  /** Los héroes AJENOS que se ven —en una columna tuya o avistada, o dentro de la plaza que pisas—, en su parte
   * pública. */
  heroesVisibles: HeroePublico[];
  /** `heroeId` -> nombre de cada ciudadano de tu Facción, tú incluido, se le vea o no. Vacío sin Facción. */
  nombresDeCompaneros: Record<string, string>;
  /** `heroeId` -> nombre del Rey y el Embajador de CADA Facción, la propia o no (backend 2026-10-06). Ausente en un backend anterior. */
  nombresDeDirigentes?: Record<string, string>;
  caminos: CaminoProyectado[];
  /** Ofertas de mercado en pie de CUALQUIER plaza en cuya puerta esté una columna tuya, más las de tus
   * propios asentamientos — el resto no viaja (Doc 3.3, `proyectarParaJugador` en el backend). Sin interfaz
   * que las lea todavía. */
  ordenes: OrdenMercado[];
  /** Trueques propuestos o activos que tocan un asentamiento tuyo (Doc 3.2). Sin interfaz que los lea. */
  acuerdos: AcuerdoTrueque[];
  campamentosBandidos: CampamentoBandido[];
  /** Los campamentos de mercenarios que conoces (como un camino: los explorados, más el tuyo y aquel en que estás). */
  campamentosMercenarios: CampamentoMercenarios[];
  /** La planta del campamento donde estás (backend D73): solo viaja estando dentro de uno. */
  escenaCampamento?: EscenaCampamento;
  /** El mostrador del campamento donde estás (backend 2026-10-07): precio de UNA unidad de cada bien que te venden (n cuestan `ceil(n × precio)`)
   * y lo que te queda del cupo de hoy (sin entrada = sin cupo). Ausente fuera, o con un backend anterior. */
  mercadoCampamento?: { precios: Record<string, number>; cupoRestante: Record<string, number> };
  /** Alijos a la vista de tu columna que aún no abriste (solo si tu Facción no tiene asentamiento). */
  alijos: Alijo[];
  /** Tus Miradas de las tabernas, abiertas o enfriándose (backend 2026-10-05, Doc 5.12.10). Lo que dejan ver llega por las listas de avistados. */
  miradasIntel: MiradaIntel[];
  /** El último Informe de cada plaza ajena que compraste, con su fecha. */
  informesPlaza: InformePlaza[];
  tarifasIntel: TarifasIntel;
  /** Las propuestas de anexión vigentes de tu Facción, ofrecidas o recibidas (backend 2026-10-06, Doc 2.6). Ausente en un backend anterior. */
  propuestasAnexion?: PropuestaAnexion[];
  /** Las propuestas de fusión vigentes de tu Facción, hechas o recibidas (backend 2026-10-06, Doc 2.6). Ausente en un backend anterior. */
  propuestasFusion?: PropuestaFusion[];
  zonasFusionadas: ZonaFaccion[];
  /** Relaciones diplomáticas, públicas: de ellas sale la Liga (`sigilo/imperio.ts`). */
  relaciones?: RelacionPolitica[];
  /** Títulos de prestigio del servidor y quién los tiene; cada uno lleva su insignia por `tituloId`. */
  titulos?: Titulo[];
  trazadoPorAsentamiento: Record<string, TrazadoAsentamiento>;
  /** Producción por minuto de mundo de cada edificio de la plaza que pisas (`asentamientos[0]`) — ausente si
   * estás en el mundo. La calcula el servidor (entrada privilegiada: bosques, yacimientos), este cliente no
   * puede. */
  produccionDeAsentamiento?: ProduccionItem[];
  /** Si la plaza que pisas puede pedir ya la subida de nivel y, si no, por qué (`solicitarAscenso`, Doc 4.5). Mismo
   * caso que `produccionDeAsentamiento`: solo estando dentro, y lo calcula el servidor. */
  ascensoDeAsentamiento?: EvaluacionAscenso;
  /** Batallas de Unity a la vista o en las que combates (backend 2026-09-15). Vacío si el backend no declara
   * servidores de batalla. Sin interfaz que las pinte todavía (`Features_Pendientes.md` §1.5). */
  batallas: BatallaVisible[];
  /** La Era, los logros del mundo y las tecnologías propias (backend Doc 6). Ausente en un backend anterior. */
  tecnologia?: TecnologiaJugador;
  /** Los Aedas residentes de tus plazas, con su épica. */
  aedasResidentes?: AedaResidenteProyectado[];
  /** Los Aedas itinerantes a la vista. */
  aedasAvistados?: AedaAvistado[];
  [campo: string]: unknown;
}

/** Lo que responde la proyección mientras la membresía no tiene héroe: solo el resumen de la partida. El único
 * comando que admite es `crearHeroe` (el resto, `403`). */
export interface PartidaSinHeroe {
  gameId: string;
  instante: number;
  version: number;
  mapaId: string;
  sinHeroe: true;
  /** Dónde se puede nacer (backend 2026-10-04): la pantalla de elección de `crearHeroe`. */
  campamentos: CampamentoParaElegir[];
}

export interface RespuestaLogin {
  usuarioId: string;
  sesionId: string;
  expiraEn: string;
}

export interface RespuestaWhoami {
  usuarioId: string;
  esAdministradorGlobal: boolean;
  gameId?: string;
  rol?: string | null;
  jugadorId?: string | null;
}

export interface RespuestaComando {
  resultado: {
    ok: boolean;
    codigoError?: string;
    /** El motivo concreto, en castellano, cuando el backend lo da (2026-10-07). Para mostrarlo; se decide por `codigoError`. */
    detalleError?: string;
    /** Lo que devuelve el comando si fue bien (p. ej. `{ cantidad, oro }` de una compra). */
    datos?: unknown;
  };
  proyeccion?: ProyeccionJugador | PartidaSinHeroe;
  [campo: string]: unknown;
}

// En dev, Vite proxya `/v1` al backend (mismo origen, sin CORS). En producción, si este cliente se sirve
// desde un dominio distinto al del backend, `VITE_API_BASE` lleva la URL del backend
// (p. ej. `https://mi-backend.fly.dev`) — y el backend debe listar este origen en `ORIGENES_PERMITIDOS`.
const V1 = `${import.meta.env.VITE_API_BASE ?? ''}/v1`;
const STORAGE_KEY_SESION = 'bac_jugador_sesion_id';
const STORAGE_KEY_USUARIO = 'bac_jugador_usuario';
const STORAGE_KEY_GAME_ID = 'bac_jugador_game_id';

let sesionIdMemoria: string | null = null;
let usuarioMemoria: string | null = null;

async function fetchJson<T>(url: string, opciones: RequestInit, cabeceraAuth: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...opciones,
      headers: {
        ...(cabeceraAuth ? { authorization: cabeceraAuth } : {}),
        ...(opciones.body ? { 'content-type': 'application/json' } : {}),
        ...((opciones.headers as Record<string, string>) ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, 'No se pudo contactar con el servidor. ¿Está corriendo `npm run server` en el backend?');
  }
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, cuerpo.error ?? `El servidor respondió ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

/** Alta de cuenta local en el backend (`POST /v1/registro`, proveedor `clave`). No abre sesión — el cliente
 * hace `loginConClave` a continuación con las mismas credenciales. `codigo` solo si la instancia lo exige. */
export async function registrarCuenta(nick: string, clave: string, codigo?: string): Promise<void> {
  await fetchJson<{ nick: string }>(
    `${V1}/registro`,
    { method: 'POST', body: JSON.stringify(codigo ? { nick, clave, codigo } : { nick, clave }) },
    // sin cabecera de auth: el registro es público (o va con `codigo` en el cuerpo)
    ''
  );
}

/** Login con cuenta local: `Authorization: clave <nick>:<contraseña>`. */
export async function loginConClave(nick: string, clave: string): Promise<RespuestaLogin> {
  const sujeto = nick.trim();
  if (!sujeto || !clave) throw new ApiError(400, 'Nick y contraseña son obligatorios.');

  const res = await fetchJson<RespuestaLogin>(`${V1}/sesiones`, { method: 'POST' }, `clave ${sujeto}:${clave}`);
  sesionIdMemoria = res.sesionId;
  usuarioMemoria = sujeto;
  return res;
}

export function guardarSesionLocal(sesionId: string, usuario: string, gameId: string): void {
  sesionIdMemoria = sesionId;
  usuarioMemoria = usuario;
  localStorage.setItem(STORAGE_KEY_SESION, sesionId);
  localStorage.setItem(STORAGE_KEY_USUARIO, usuario);
  localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
}

/** Una partida abierta del servidor y, si el usuario es miembro, su héroe en ella (`GET /v1/jugador/partidas`, backend 02bd153). */
export interface PartidaListada {
  gameId: string;
  estado: string;
  membresia: { jugadorId: string } | null;
  heroe: { id: string; nombre: string; nivel: number; faccion: { id: string; nombre: string; emblemaId: string; colorEmblemaId: string } | null } | null;
}

export async function listarPartidas(): Promise<PartidaListada[]> {
  return (await peticion<{ partidas: PartidaListada[] }>(`${V1}/jugador/partidas`)).partidas;
}

/** Recuerda en qué partida se está (`''` = en ninguna: se vuelve a la lista de partidas). */
export function recordarPartida(gameId: string): void {
  localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
}

export function cargarSesionLocal(): { sesionId: string; usuario: string; gameId: string } | null {
  const sid = localStorage.getItem(STORAGE_KEY_SESION);
  const usr = localStorage.getItem(STORAGE_KEY_USUARIO);
  const gid = localStorage.getItem(STORAGE_KEY_GAME_ID) ?? '';

  // Sin `gameId` la sesión sigue viva pero el jugador no está en ninguna partida: va a la pantalla de partidas.
  if (sid && usr) {
    sesionIdMemoria = sid;
    usuarioMemoria = usr;
    return { sesionId: sid, usuario: usr, gameId: gid };
  }
  return null;
}

// --- TIEMPO REAL (WebSocket) ---------------------------------------------------------------------------
// Un único WebSocket por jugador (backend `rutas/tiempoReal.ts`, doc 02 §2) con dos papeles:
//  - PRESENCIA (Doc 1.10.6): tenerlo abierto es estar conectado; cerrar el ÚLTIMO socket del jugador lo desconecta (sale del mundo 2:30 después
//    si no vuelve). Por eso se cierra al cerrar sesión o la pestaña.
//  - AVISOS: se suscribe a canales (`mapa/general`, `heroe/<tuId>`, `asentamiento/<id>` de tus plazas) y, cuando llega un evento, avisa a quien
//    escuche (`alEventoTiempoReal`). El WebSocket solo avisa: el dato se vuelve a pedir por HTTP (proyección y cursor de eventos), que es la verdad.
// Las suscripciones no sobreviven a una reconexión: al abrirse se mandan todas otra vez.
let socketPresencia: WebSocket | null = null;
let presenciaDeseada: string | null = null;
let reintentoPresencia: ReturnType<typeof setTimeout> | undefined;
/** Los canales que se quieren tener suscritos, y los que el socket abierto tiene ya pedidos. */
let canalesDeseados = new Set<string>();
const canalesPedidos = new Set<string>();
let oyenteDeEventos: ((evento: EventoDominio) => void) | null = null;

function urlTiempoReal(gameId: string, sesionId: string): string {
  const base = import.meta.env.VITE_API_BASE ?? location.origin;
  return `${base.replace(/^http/, 'ws')}/v1/jugador/partidas/${encodeURIComponent(gameId)}/tiempo-real?sesion=${encodeURIComponent(sesionId)}`;
}

/** Pone al día las suscripciones del socket abierto con `canalesDeseados`. */
function sincronizarCanales(): void {
  const socket = socketPresencia;
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  for (const canal of canalesDeseados) if (!canalesPedidos.has(canal)) { socket.send(JSON.stringify({ accion: 'suscribir', canal })); canalesPedidos.add(canal); }
  for (const canal of [...canalesPedidos]) if (!canalesDeseados.has(canal)) { socket.send(JSON.stringify({ accion: 'desuscribir', canal })); canalesPedidos.delete(canal); }
}

/** Qué canales escuchar (se llama con cada proyección; si no cambia nada no se manda nada). */
export function fijarCanalesTiempoReal(canales: readonly string[]): void {
  canalesDeseados = new Set(canales);
  sincronizarCanales();
}

/** Quién recibe los eventos que llegan por el socket (uno solo: `main.ts`). */
export function alEventoTiempoReal(cb: (evento: EventoDominio) => void): void {
  oyenteDeEventos = cb;
}

/** Abre el socket de esa partida si no está abierto (idempotente). Si se cae sin que lo pidamos, reintenta a los 3 s. */
export function abrirPresencia(gameId: string): void {
  presenciaDeseada = gameId;
  if (!sesionIdMemoria || (socketPresencia && socketPresencia.readyState <= WebSocket.OPEN)) return;
  clearTimeout(reintentoPresencia);
  const socket = new WebSocket(urlTiempoReal(gameId, sesionIdMemoria));
  socketPresencia = socket;
  canalesPedidos.clear();
  socket.addEventListener('open', () => sincronizarCanales());
  socket.addEventListener('message', (mensaje) => {
    try {
      const datos = JSON.parse(String(mensaje.data)) as { tipo?: string; evento?: EventoDominio };
      if (datos.tipo === 'evento' && datos.evento) oyenteDeEventos?.(datos.evento);
    } catch {
      // Un mensaje ilegible no rompe nada: el sondeo sigue trayendo la verdad.
    }
  });
  socket.addEventListener('close', () => {
    if (socketPresencia === socket) socketPresencia = null;
    canalesPedidos.clear();
    if (presenciaDeseada === gameId && sesionIdMemoria) reintentoPresencia = setTimeout(() => abrirPresencia(gameId), 3000);
  });
}

/** Cierra el socket y deja de reabrirlo: así el servidor ve que el jugador se fue. */
export function cerrarPresencia(): void {
  presenciaDeseada = null;
  clearTimeout(reintentoPresencia);
  socketPresencia?.close(1000, 'sesion cerrada');
  socketPresencia = null;
  canalesPedidos.clear();
}

export function cerrarSesion(): void {
  cerrarPresencia(); // antes de olvidar la sesión: es lo que desconecta al héroe en el servidor
  sesionIdMemoria = null;
  usuarioMemoria = null;
  localStorage.removeItem(STORAGE_KEY_SESION);
  localStorage.removeItem(STORAGE_KEY_USUARIO);
  localStorage.removeItem(STORAGE_KEY_GAME_ID);
}

export function getUsuarioActual(): string | null {
  return usuarioMemoria;
}

async function peticion<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  if (!sesionIdMemoria) {
    const local = cargarSesionLocal();
    if (!local) throw new ApiError(401, 'No hay ninguna sesión activa. Inicie sesión primero.');
  }

  try {
    return await fetchJson<T>(url, opciones, `sesion ${sesionIdMemoria}`);
  } catch (err) {
    // Con contraseña no se puede re-autenticar en silencio (no la guardamos): si la sesión caducó, se cierra
    // y la UI vuelve al login.
    if (err instanceof ApiError && err.status === 401) cerrarSesion();
    throw err;
  }
}

export function obtenerWhoami(gameId?: string): Promise<RespuestaWhoami> {
  const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
  return peticion<RespuestaWhoami>(`${V1}/sesiones/actual${query}`);
}

/** Une al sujeto actual a la partida como jugador */
export function unirseAPartida(gameId: string): Promise<{ jugadorId: string }> {
  return peticion<{ jugadorId: string }>(`${V1}/jugador/partidas/${encodeURIComponent(gameId)}/membresia`, { method: 'POST' });
}

export function consultarProyeccion(gameId: string): Promise<ProyeccionJugador | PartidaSinHeroe> {
  return peticion<ProyeccionJugador | PartidaSinHeroe>(`${V1}/jugador/partidas/${encodeURIComponent(gameId)}`);
}

/** Los eventos con `version` mayor que `desde`, ya filtrados a lo que este jugador puede ver (cursor de reconexión, doc 02 §4). */
export async function consultarEventos(gameId: string, desde: number): Promise<EventoDominio[]> {
  const r = await peticion<{ eventos: EventoDominio[] }>(`${V1}/jugador/partidas/${encodeURIComponent(gameId)}/eventos?desde=${desde}`);
  return r.eventos;
}

/** Una tropa del catálogo (`TROPAS_RECLUTABLES`): lo que hace falta para reclutarla y lo que cuesta el equipo de cada soldado. */
export interface TropaReclutable {
  id: string;
  nombre: string;
  tecnologia: string;
  edificio: string;
  nivelRequerido: number;
  costoEquipo: Record<string, number | undefined>;
  unidadesPorDefecto: number;
  escalon: number;
}

/** El balance público (`GET /v1/balance`): se pide una vez, en segundo plano, y avisa con `alCargar` cuando llega. */
interface BalancePublico {
  catalogos?: { EDIFICIO_CATALOGO?: Record<string, { costo?: Record<string, number> }>; TROPAS_RECLUTABLES?: TropaReclutable[] };
  mundoYMilitar?: { LOGISTICA?: { capacidadViveresPorHeroe?: number; radioEncuentro?: number; radioReabastecimiento?: number }; FUNDACION?: { materialesIniciales?: Record<string, number>; viviendasIniciales?: number; costoMaderaExtraCaravana?: number }; MERCENARIOS?: { refundacion?: { porcentajeCoste?: number } } };
  internas?: { CAMPAMENTOS_BANDIDOS?: { niveles?: Record<string, NivelDeBandidos> } };
}
let balancePublico: BalancePublico | null = null;
let balancePedido = false;
function balance(alCargar?: () => void): BalancePublico | null {
  if (!balancePublico && alCargar && !balancePedido) {
    balancePedido = true;
    void fetchJson<BalancePublico>(`${V1}/balance`, {}, '')
      .then((b) => { balancePublico = b; alCargar(); })
      .catch(() => { balancePedido = false; });
  }
  return balancePublico;
}

/** Lo que fija cada nivel de bandidos: su poder, los hombres que defienden y el oro del botín por héroe. */
export interface NivelDeBandidos { poder: number; unidades: number; oroPorHeroe: number }

/** Los niveles de bandidos si ya se leyeron; la primera vez los pide al backend en segundo plano y avisa con `alCargar`. */
export function nivelesBandidos(alCargar?: () => void): Record<string, NivelDeBandidos> | null {
  return balance(alCargar)?.internas?.CAMPAMENTOS_BANDIDOS?.niveles ?? null;
}

/** Lo que caben los víveres de un héroe (`LOGISTICA.capacidadViveresPorHeroe`); 350 mientras no llegue el balance. */
export function capacidadDeViveres(alCargar?: () => void): number {
  return balance(alCargar)?.mundoYMilitar?.LOGISTICA?.capacidadViveresPorHeroe ?? 350;
}

/** A cuánto hay que estar de una columna para unirse a ella en campo (`LOGISTICA.radioEncuentro`); 15 mientras no llegue el balance. */
export function radioDeEncuentro(): number {
  return balance()?.mundoYMilitar?.LOGISTICA?.radioEncuentro ?? 15;
}

/** A cuánto de tu plaza tiene que pasar un ejército para recoger tropa o reabastecerse (`LOGISTICA.radioReabastecimiento`); 60 mientras no llegue el balance. */
export function radioDeReabastecimiento(): number {
  return balance()?.mundoYMilitar?.LOGISTICA?.radioReabastecimiento ?? 60;
}

/** El catálogo de tropas reclutables; `null` mientras no llegue el balance (la primera vez lo pide en segundo plano y avisa con `alCargar`). */
export function tropasReclutables(alCargar?: () => void): TropaReclutable[] | null {
  return balance(alCargar)?.catalogos?.TROPAS_RECLUTABLES ?? null;
}

/** Los hombres de una escuadra completa de esa tropa (`unidadesPorDefecto`), que es también lo que presta un campamento; `undefined` mientras no llegue el balance. */
export function unidadesDeTropa(tropaId: string, alCargar?: () => void): number | undefined {
  return balance(alCargar)?.catalogos?.TROPAS_RECLUTABLES?.find((x) => x.id === tropaId)?.unidadesPorDefecto;
}

/**
 * Lo que cuesta la Caravana de Fundación comprada en un campamento (`costoRefundacion` del backend): el coste normal de una Caravana de Fundación
 * —materiales iniciales + una granja + las viviendas iniciales + la madera extra— por `MERCENARIOS.refundacion.porcentajeCoste`, redondeado hacia arriba.
 * El backend no lo publica ya calculado, así que se deriva del balance; `null` mientras no llegue.
 */
export function costoDeRefundacion(alCargar?: () => void): Record<string, number> | null {
  const b = balance(alCargar);
  const f = b?.mundoYMilitar?.FUNDACION;
  const cat = b?.catalogos?.EDIFICIO_CATALOGO;
  const porcentaje = b?.mundoYMilitar?.MERCENARIOS?.refundacion?.porcentajeCoste;
  if (!f || !cat?.['granja'] || !cat['vivienda'] || porcentaje === undefined) return null;
  const costo: Record<string, number> = { ...f.materialesIniciales };
  for (const [r, n] of Object.entries(cat['granja'].costo ?? {})) costo[r] = (costo[r] ?? 0) + n;
  for (const [r, n] of Object.entries(cat['vivienda'].costo ?? {})) costo[r] = (costo[r] ?? 0) + n * (f.viviendasIniciales ?? 0);
  costo['madera'] = (costo['madera'] ?? 0) + (f.costoMaderaExtraCaravana ?? 0);
  return Object.fromEntries(Object.entries(costo).map(([r, n]) => [r, Math.ceil(n * porcentaje)] as const).filter(([, n]) => n > 0));
}

/** El mapa como asset (Fase C11a): se pide una sola vez por `mapaId` y se cachea */
export function obtenerMapa(gameId: string, mapaId: string): Promise<MapaGenerado> {
  return peticion<MapaGenerado>(`${V1}/jugador/partidas/${encodeURIComponent(gameId)}/mapa/${encodeURIComponent(mapaId)}`);
}

export function ejecutarComando(gameId: string, tipo: string, params: unknown): Promise<RespuestaComando> {
  return peticion<RespuestaComando>(`${V1}/jugador/partidas/${encodeURIComponent(gameId)}/comandos`, {
    method: 'POST',
    body: JSON.stringify({ tipo, params }),
  });
}

// Comandos del héroe (backend 2026-09-14). Todavía sin pantalla que los use: docs/Features_Pendientes.md §0.2.
// Un rechazo de dominio llega como `resultado.codigoError === 'heroe.invalido'`.
export const repartirPuntos = (gameId: string, params: ParamsRepartirPuntos) => ejecutarComando(gameId, 'repartirPuntos', params);
export const guardarLoadout = (gameId: string, params: ParamsGuardarLoadout) => ejecutarComando(gameId, 'guardarLoadout', params);
export const borrarLoadout = (gameId: string, loadoutId: string) => ejecutarComando(gameId, 'borrarLoadout', { loadoutId });
export const asignarGuarnicion = (gameId: string, squadId: string) => ejecutarComando(gameId, 'asignarGuarnicion', { squadId });
export const retirarGuarnicion = (gameId: string, squadId: string) => ejecutarComando(gameId, 'retirarGuarnicion', { squadId });
