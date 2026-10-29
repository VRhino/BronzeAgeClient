// La superficie de red del cliente (sin lógica de negocio, solo I/O). Desde la fase 7, sobre la sesión del contrato 05 del motor en Rust.
import type { MapaGenerado } from './terreno';
import { entrar, ErrorDeAcceso, registrar } from './contrato/acceso';
import { ErrorDeSesion, Sesion } from './contrato/sesion';
import { Resultado } from './contrato/gen/bronzeage/v1/session_pb';
import { TipoEntidad } from './contrato/gen/bronzeage/v1/common_pb';
import type { EventoDominio as EventoPb } from './contrato/gen/bronzeage/v1/events_pb';
import { cargarMundo } from './mundo/artefacto';
import { instante, proyectar } from './motor/proyeccion';
import { ComandoDesconocido, traducirOrden } from './motor/ordenes';

import type { AcuerdoTrueque, AedaAvistado, AvanzadaDeMapa, AedaResidenteProyectado, Alijo, Asentamiento, AsentamientoAvistado, AsentamientoConocido, BatallaVisible, CaminoProyectado, CampamentoBandido, CampamentoMercenarios, CampamentoParaElegir, Caravana, CaravanaAvistada, Convocatoria, Ejercito, EjercitoAvistado, EscenaCampamento, EvaluacionAscenso, EventoDominio, Faccion, FaccionDelDirectorio, HeroeProyectado, HeroePublico, InformeDeInspeccion, ObraDeMapa, PuebloDeMapa, InformePlaza, MiradaIntel, Mision, NieblaProyectada, OrdenMercado, ParamsGuardarLoadout, ParamsRepartirPuntos, ProduccionItem, PropuestaAnexion, PropuestaFusion, PropuestaRelacion, RelacionPolitica, Sigilo, TarifasIntel, TecnologiaJugador, Titulo, TrazadoAsentamiento, ZonaFaccion } from './tiposDominio';

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
  /** Todas las Facciones del mundo, en su forma ligera (motor db80cb8); ausente con un motor anterior. */
  directorioFacciones?: FaccionDelDirectorio[];
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
  /** Las caravanas ajenas que se ven AHORA, redactadas (backend Doc 5.12.3): qué llevan, no cuánto. Ausente en un backend anterior. */
  caravanasAvistadas?: CaravanaAvistada[];
  /** Lo último que inspeccionaste (sobrevive a recargar); se filtra por `expiraEn`. Ausente en un backend anterior. */
  informesDeInspeccion?: InformeDeInspeccion[];
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
  /** La planta de cada campamento cuyo ámbito `CAMPAMENTO` tiene el héroe (puede tener más de uno: donde reside y donde está). */
  escenasCampamento: EscenaCampamento[];
  /** El mostrador del campamento donde estás (backend 2026-10-07): precio de UNA unidad de cada bien que te venden (n cuestan `ceil(n × precio)`)
   * y lo que te queda del cupo de hoy (sin entrada = sin cupo). Ausente fuera, o con un backend anterior. */
  mercadoCampamento?: {
    precios: Record<string, number>; cupoRestante: Record<string, number>;
    /** Solo si resides en él: las tropas que permiten sus edificios, con su precio por soldado (recargo, reputación y descuento ya aplicados) y si están desbloqueadas; reclutas disponibles y tope. */
    reclutamiento?: { tropas: { tropaId: string; precioPorSoldado: number; desbloqueada: boolean }[]; poblacion: number; topePoblacion: number };
  };
  /** Alijos a la vista de tu columna que aún no abriste (solo si tu Facción no tiene asentamiento). */
  alijos: Alijo[];
  /** Pueblos activos y obras de mapa: los de tu Facción con todo, los ajenos que se ven solo con dónde y qué. */
  pueblos?: PuebloDeMapa[];
  avanzadas?: AvanzadaDeMapa[];
  obrasDeMapa?: ObraDeMapa[];
  /** Tus Miradas de las tabernas, abiertas o enfriándose (backend 2026-10-05, Doc 5.12.10). Lo que dejan ver llega por las listas de avistados. */
  miradasIntel: MiradaIntel[];
  /** El último Informe de cada plaza ajena que compraste, con su fecha. */
  informesPlaza: InformePlaza[];
  tarifasIntel: TarifasIntel;
  /** Las propuestas de anexión vigentes de tu Facción, ofrecidas o recibidas (backend 2026-10-06, Doc 2.6). Ausente en un backend anterior. */
  propuestasAnexion?: PropuestaAnexion[];
  propuestasRelacion?: PropuestaRelacion[];
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
  /** Las tecnologías adoptadas por tu Facción (`TecnologiasFaccion.adoptadas` del ámbito FACCION, con las de arranque); vacío sin Facción. */
  tecnologiasAdoptadas?: string[];
  /** Las misiones de cada dueño que se ven: las tuyas, las de la plaza donde estás dentro y las de tu Facción. */
  misiones?: { heroe: Mision[]; plaza: Mision[]; plazaId?: string; faccion: Mision[] };
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

// Desde la fase 7 (2026-10-26) esta superficie habla con el motor en Rust y no con el REST del backend TypeScript: por debajo, una sola
// `Sesion` del contrato 05 (`src/contrato/`) y el adaptador de `src/motor/` (lectura: el almacén a `ProyeccionJugador`; escritura: el
// comando de siempre a una `Orden`). Los paneles no cambian. El servidor sirve en un puerto el HTTP de acceso, el artefacto de mundo y el
// WebSocket; `VITE_API_BASE` lo apunta (por defecto, el mismo host en el puerto 7878; el CORS del motor está abierto).
const BASE = import.meta.env.VITE_API_BASE ?? `${location.protocol}//${location.hostname}:7878`;
const URL_WS = `${BASE.replace(/^http/, 'ws')}/`;
const STORAGE_KEY_SESION = 'bac_jugador_sesion_id';
const STORAGE_KEY_USUARIO = 'bac_jugador_usuario';
const STORAGE_KEY_GAME_ID = 'bac_jugador_game_id';
/** El motor tiene una sola partida por servidor: este es su id para la interfaz. */
const PARTIDA = 'mundo';
const VERSION_CLIENTE = 'cliente-jugador';

let sesionIdMemoria: string | null = null;
let usuarioMemoria: string | null = null;
let cuentaIdMemoria: string | null = null;
let sesion: Sesion | null = null;
let abriendo: Promise<Sesion> | null = null;
let oyenteDeEventos: ((evento: EventoDominio) => void) | null = null;
let oyenteDeTick: (() => void) | null = null;
let temporizadorTick: ReturnType<typeof setTimeout> | undefined;
let mapaCargado: { hash: string; mapa: MapaGenerado } | null = null;

function aApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof ErrorDeAcceso) return new ApiError(e.status, e.message && e.message !== e.codigo ? e.message : e.codigo);
  if (e instanceof ErrorDeSesion) return new ApiError(e.codigo === 'token_invalido' ? 401 : 403, `${e.message} (${e.codigo})`);
  return new ApiError(0, 'No se pudo contactar con el servidor. ¿Está corriendo `bronzeage-servidor` (cargo run --release -p servicio en el motor)?');
}

/** Avisa a la interfaz de que el mundo cambió (como el `tick` del WebSocket viejo), agrupando lo que llega seguido. */
function avisarTick(): void {
  if (temporizadorTick) return;
  temporizadorTick = setTimeout(() => {
    temporizadorTick = undefined;
    oyenteDeTick?.();
  }, 100);
}

/** La sesión abierta (la abre si hace falta, con el token guardado). */
/** La sesión se cerró porque la partida se abrió en otra pestaña con la misma cuenta (`sesion.reemplazada`): no se reabre sola, o las dos
 * pestañas se echarían una a la otra sin parar. Se reabre con `retomarSesion` cuando el jugador lo pide. */
let reemplazada = false;
let oyenteReemplazo: (() => void) | null = null;
export function alSesionReemplazada(f: () => void): void {
  oyenteReemplazo = f;
}
export function retomarSesion(): void {
  reemplazada = false;
}

async function sesionAbierta(): Promise<Sesion> {
  if (sesion && sesion.estado !== 'cerrada') return sesion;
  if (abriendo) return abriendo;
  if (reemplazada) throw new ApiError(409, 'La partida está abierta en otra pestaña.');
  if (!sesionIdMemoria && !cargarSesionLocal()) throw new ApiError(401, 'No hay ninguna sesión activa. Inicie sesión primero.');
  const s = new Sesion({ url: URL_WS, token: sesionIdMemoria!, versionCliente: VERSION_CLIENTE, mundoHash: mapaCargado?.hash });
  s.alCambiar(() => avisarTick());
  s.alEvento((_ambito, e) => {
    const evento = eventoDeDominio(e);
    guardarEvento(evento);
    oyenteDeEventos?.(evento);
  });
  s.alEstado((estado, error) => {
    if (estado === 'cerrada' && error?.codigo === 'token_invalido') cerrarSesion();
    if (estado === 'cerrada' && error?.codigo === 'sesion_reemplazada') {
      reemplazada = true;
      oyenteReemplazo?.();
    }
  });
  abriendo = s.abrir().then(
    () => {
      sesion = s;
      // Para depurar desde la consola del navegador (solo en `npm run dev`).
      if (import.meta.env.DEV) (globalThis as { sesionBronzeAge?: Sesion }).sesionBronzeAge = s;
      abriendo = null;
      return s;
    },
    (e) => {
      abriendo = null;
      if (e instanceof ErrorDeSesion && e.codigo === 'token_invalido') cerrarSesion();
      throw aApiError(e);
    },
  );
  return abriendo;
}

function eventoDeDominio(e: EventoPb): EventoDominio {
  const heroesIds = [...e.heroesIds];
  return {
    codigo: e.codigo, mensaje: e.codigo, version: Number(e.version), asentamientoId: e.asentamientoId, heroesIds,
    momento: new Date(instante(e.enMs)!).toISOString(), payload: payloadDelCliente(e.codigo, e.payload as Record<string, unknown> | undefined, heroesIds),
  };
}

/** El payload del motor con la forma que esperan los avisos (la del backend TypeScript), en los códigos donde no coinciden. El motor manda las
 * cifras en milésimas y planas (`poderAtacante`, `oro`, `bajasAtacante`...); el informe de combate quiere `atacante: { poder, heroesIds, bajas }`. */
function payloadDelCliente(codigo: string, p: Record<string, unknown> | undefined, heroesIds: string[]): unknown {
  if (!p) return p;
  if (codigo === 'combate.campamento_destruido' || codigo === 'combate.ataque_campamento_fallido') {
    const num = (k: string): number => Number(p[k] ?? 0) / 1000;
    const oro = num('oro');
    return {
      ...p,
      nivelCampamento: Number(p.nivel ?? 0),
      poderCampamento: num('poderCampamento'),
      // El motor da las bajas en total, no por escuadra.
      atacante: { poder: num('poderAtacante'), heroesIds, bajas: [], bajasTotales: Number(p.bajasAtacante ?? 0) },
      // El oro es el de toda la columna: a cada héroe que iba, el total (con un héroe solo, lo suyo).
      oroPorHeroe: Object.fromEntries(heroesIds.map((h) => [h, Math.floor(oro / Math.max(1, heroesIds.length))])),
      carroPerdido: { recursos: num('carroPerdido') },
    };
  }
  return p;
}

/** Los eventos que han llegado por la sesión y aún no se han avisado (`consultarEventos` los entrega y vacía). Un mismo hecho puede llegar por
 * más de un ámbito (`HEROE` y `FACCION`): se cuenta una vez. */
const eventosPorAvisar: EventoDominio[] = [];
const eventosVistos = new Set<string>();
function guardarEvento(e: EventoDominio): void {
  const k = `${e.version}|${e.codigo}|${JSON.stringify(e.payload)}`;
  if (eventosVistos.has(k)) return;
  if (eventosVistos.size > 2000) eventosVistos.clear();
  eventosVistos.add(k);
  eventosPorAvisar.push(e);
}

/** Alta de cuenta en el servicio de acceso del motor (`POST /v1/registro`). No abre sesión — el cliente hace `loginConClave` a
 * continuación con las mismas credenciales. `codigo` solo si la instancia lo exige (`CODIGO_REGISTRO`). */
export async function registrarCuenta(nick: string, clave: string, codigo?: string): Promise<void> {
  try {
    await registrar(BASE, nick, clave, codigo ?? '');
  } catch (e) {
    throw aApiError(e);
  }
}

/** Login (`POST /v1/sesiones`): el token que devuelve es el de `Hola.token`; aquí sigue llamándose `sesionId`. */
export async function loginConClave(nick: string, clave: string): Promise<RespuestaLogin> {
  const sujeto = nick.trim();
  if (!sujeto || !clave) throw new ApiError(400, 'Nick y contraseña son obligatorios.');
  try {
    const r = await entrar(BASE, sujeto, clave);
    sesionIdMemoria = r.token;
    usuarioMemoria = r.nick;
    cuentaIdMemoria = r.cuentaId;
    return { usuarioId: r.cuentaId, sesionId: r.token, expiraEn: new Date(r.expiraMs).toISOString() };
  } catch (e) {
    throw aApiError(e);
  }
}

export function guardarSesionLocal(sesionId: string, usuario: string, gameId: string): void {
  sesionIdMemoria = sesionId;
  usuarioMemoria = usuario;
  localStorage.setItem(STORAGE_KEY_SESION, sesionId);
  localStorage.setItem(STORAGE_KEY_USUARIO, usuario);
  localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
}

export interface PartidaListada {
  gameId: string;
  nombre?: string;
  estado: string;
  membresia: { jugadorId: string } | null;
  heroe: { id: string; nombre: string; nivel: number; faccion: { id: string; nombre: string; emblemaId: string; colorEmblemaId: string; /** El sigilo completo de su Facción (backend, a petición); mientras no llegue se dibuja solo el símbolo. */ sigilo?: Sigilo } | null } | null;
}

/** El motor tiene una sola partida: la del servidor. Su tarjeta lleva el héroe si la cuenta ya tiene uno. */
/** Si la cuenta ya tiene héroe (`Bienvenida.heroe_id`) pero su ámbito `HEROE` aún no ha llegado —la foto viene justo detrás de la
 * Bienvenida—, espera a que llegue (como mucho `ms`). Sin esto, nada más iniciar sesión se proyectaba como «sin héroe». */
function esperarHeroe(s: Sesion, ms = 5000): Promise<void> {
  const id = s.bienvenida?.heroeId;
  const llegado = (): boolean => !id || s.almacen.ambitos.has(`HEROE:${id}`);
  if (llegado()) return Promise.resolve();
  return new Promise((resolver) => {
    const fin = (): void => { clearTimeout(reloj); quitar(); resolver(); };
    const quitar = s.alCambiar(() => { if (llegado()) fin(); });
    const reloj = setTimeout(fin, ms);
  });
}

export async function listarPartidas(): Promise<PartidaListada[]> {
  const s = await sesionAbierta();
  await esperarHeroe(s);
  const p = proyeccionActual(s);
  const heroe = !p.sinHeroe
    ? (() => {
        const f = p.facciones.find((x) => x.id === p.faccionId);
        return { id: p.heroeId, nombre: p.heroe.displayName, nivel: p.heroe.nivel, faccion: f ? { id: f.id, nombre: f.nombre, emblemaId: f.sigilo.emblemaId, colorEmblemaId: f.sigilo.colorEmblemaId, sigilo: f.sigilo } : null };
      })()
    : null;
  return [{ gameId: PARTIDA, nombre: 'Mundo', estado: 'activa', membresia: { jugadorId: cuentaIdMemoria ?? usuarioMemoria ?? '' }, heroe }];
}

export function recordarPartida(gameId: string): void {
  localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
}

export function cargarSesionLocal(): { sesionId: string; usuario: string; gameId: string } | null {
  const sid = localStorage.getItem(STORAGE_KEY_SESION);
  const usr = localStorage.getItem(STORAGE_KEY_USUARIO);
  const gid = localStorage.getItem(STORAGE_KEY_GAME_ID) ?? '';

  if (sid && usr) {
    sesionIdMemoria = sid;
    usuarioMemoria = usr;
    return { sesionId: sid, usuario: usr, gameId: gid };
  }
  return null;
}

/** Los «canales» del WebSocket viejo: el contrato suscribe solo lo que corresponde, así que no hay nada que pedir. */
export function fijarCanalesTiempoReal(_canales: readonly string[]): void {}

export function alEventoTiempoReal(cb: (evento: EventoDominio) => void): void {
  oyenteDeEventos = cb;
}

export function alTickDeMundo(cb: () => void): void {
  oyenteDeTick = cb;
}

export function tiempoRealVivo(): boolean {
  return sesion?.estado === 'abierta';
}

export function abrirPresencia(_gameId: string): void {
  void sesionAbierta().catch(() => {});
}

export function cerrarPresencia(): void {
  sesion?.cerrar();
  sesion = null;
}

export function cerrarSesion(): void {
  cerrarPresencia();
  sesionIdMemoria = null;
  usuarioMemoria = null;
  cuentaIdMemoria = null;
  localStorage.removeItem(STORAGE_KEY_SESION);
  localStorage.removeItem(STORAGE_KEY_USUARIO);
  localStorage.removeItem(STORAGE_KEY_GAME_ID);
}

export function getUsuarioActual(): string | null {
  return usuarioMemoria;
}

export async function obtenerWhoami(_gameId?: string): Promise<RespuestaWhoami> {
  return { usuarioId: cuentaIdMemoria ?? '', esAdministradorGlobal: false, gameId: PARTIDA, jugadorId: sesion?.bienvenida?.heroeId ?? null };
}

/** Con el motor no hace falta unirse: la cuenta entra en la partida del servidor al abrir la sesión. */
export async function unirseAPartida(_gameId: string): Promise<{ jugadorId: string }> {
  await sesionAbierta();
  return { jugadorId: cuentaIdMemoria ?? '' };
}

function proyeccionActual(s: Sesion): ProyeccionJugador | PartidaSinHeroe {
  const p = proyectar({ almacen: s.almacen, bienvenida: s.bienvenida!, ahora: s.ahoraMundo(), gameId: PARTIDA, mapaId: s.bienvenida?.mundo?.hash ?? '' });
  // El Liderazgo de una escuadra va por el escalón de su tropa (LIDERAZGO.costePorEscalon), no por sus hombres: el motor no lo manda en la escuadra.
  if ('heroe' in p) for (const x of p.heroe.escuadrones) x.costeLiderazgo = costeDeLiderazgo(x.tropaId);
  return p;
}

/** Lo que cuesta en Liderazgo una escuadra de esa tropa, sea cual sea su número de hombres (0 mientras no llegue `/v1/datos`). */
export function costeDeLiderazgo(tropaId: string): number {
  const escalon = tropasReclutables()?.find((t) => t.id === tropaId)?.escalon;
  const costes = bloqueDeDatos<{ costePorEscalon?: Record<string, number> }>('LIDERAZGO')?.costePorEscalon;
  return escalon !== undefined ? costes?.[String(escalon)] ?? 0 : 0;
}

/** La proyección recalculada en este instante, sin red y sin esperar a un cambio: las columnas avanzan por su plan (`Plan`) y el servidor no
 * manda nada mientras marchan, así que el mapa la pide en cada fotograma para que se muevan seguido. `null` sin sesión o sin héroe. */
export function proyeccionAlInstante(): ProyeccionJugador | null {
  if (!sesion?.bienvenida || sesion.estado === 'cerrada') return null;
  const p = proyeccionActual(sesion);
  return p.sinHeroe ? null : p;
}

/** La proyección, calculada del almacén de la sesión: no hay viaje de red (lo que cambia llega solo). */
export async function consultarProyeccion(_gameId: string): Promise<ProyeccionJugador | PartidaSinHeroe> {
  const s = await sesionAbierta();
  await esperarHeroe(s);
  // La VISTA la pide el cliente (en el REST venía sola): en cuanto hay héroe, una vez por héroe. La sesión la vuelve a pedir al reconectar.
  const heroe = [...s.almacen.ambitos.keys()].find((k) => k.startsWith('HEROE:'));
  if (heroe && vistaPedidaPara !== heroe) {
    vistaPedidaPara = heroe;
    pedirVistaEntera(s);
  }
  return proyeccionActual(s);
}

let vistaPedidaPara: string | null = null;

/** La VISTA del mundo entero: el servidor filtra por la niebla, así que pedir todo el rectángulo es lo que hacía el REST. */
function pedirVistaEntera(s: Sesion): void {
  const tamano = mapaCargado?.mapa.config;
  const ancho = BigInt(Math.round((tamano?.ancho ?? 2667) * 1000));
  const alto = BigInt(Math.round((tamano?.alto ?? 2000) * 1000));
  s.cambiarVista({ min: { x: 0n, y: 0n }, max: { x: ancho, y: alto } });
}

/** El archivo común de datos de juego del motor (`GET /v1/datos`, el vigente): los bloques de parámetros de `Docs/Mechanics`, por documento. Se pide una vez. */
let datosDeJuego: Promise<DatosDeJuego | null> | null = null;
interface DatosDeJuego { documentos?: Record<string, Record<string, unknown>>; reglas?: { territorio?: { radio_inicial?: number } } }
/** `reglas` de `/v1/datos` (territorio en milésimas), guardadas al llegar el balance. */
let reglasDePartida: DatosDeJuego['reglas'] | null = null;

function cargarDatosDeJuego(): Promise<DatosDeJuego | null> {
  datosDeJuego ??= fetch(`${BASE}/v1/datos`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return datosDeJuego;
}

/** El radio de visión de un héroe solo (`Movimiento_Ejercitos.VISION.jugadorSolo`); si no llega, 15, la cifra de hoy. Fija la escala de visión del mapa. */
export function radioDeVision(): Promise<number> {
  return cargarDatosDeJuego().then((d) => {
    const r = Number((d?.documentos?.Movimiento_Ejercitos?.VISION as { jugadorSolo?: number } | undefined)?.jugadorSolo);
    return r > 0 ? r : 15;
  });
}

/** Los textos de las misiones que publica el motor en un catálogo aparte de `GET /v1/datos`, no en la foto
 * (`documentos.Misiones_Textos.TEXTOS_MISIONES`): `misiones.<id>` con título y texto, y `contadores.<contador>` con el nombre de cada barra.
 * `null` mientras no llegue (o si el motor aún no lo publica). */
export interface TextosDeMisiones { misiones: Record<string, { titulo: string; texto: string; explicacion?: string }>; contadores: Record<string, string> }
let textosMisiones: TextosDeMisiones | null = null;
let textosMisionesPedidos = false;
const oyentesTextosMisiones = new Set<() => void>();
export function textosDeMisiones(alCargar?: () => void): TextosDeMisiones | null {
  if (!textosMisiones && alCargar) oyentesTextosMisiones.add(alCargar);
  if (!textosMisiones && !textosMisionesPedidos) {
    textosMisionesPedidos = true;
    void cargarDatosDeJuego().then((d) => {
      const bloque = d?.documentos?.Misiones_Textos?.TEXTOS_MISIONES as { misiones?: Record<string, { titulo?: unknown; texto?: unknown; explicacion?: unknown }>; contadores?: Record<string, unknown> } | undefined;
      if (!bloque?.misiones) return;
      const misiones: TextosDeMisiones['misiones'] = {};
      for (const [id, t] of Object.entries(bloque.misiones)) if (typeof t?.titulo === 'string') misiones[id] = { titulo: t.titulo, texto: typeof t.texto === 'string' ? t.texto : '', ...(typeof t.explicacion === 'string' && t.explicacion ? { explicacion: t.explicacion } : {}) };
      const contadores: TextosDeMisiones['contadores'] = {};
      for (const [k, v] of Object.entries(bloque.contadores ?? {})) if (typeof v === 'string') contadores[k] = v;
      textosMisiones = { misiones, contadores };
      for (const f of oyentesTextosMisiones) f();
      oyentesTextosMisiones.clear();
    });
  }
  return textosMisiones;
}

/** La crónica de la partida va por páginas en la sesión (`pedirCronica`); los avisos de siempre llegan por `alEventoTiempoReal`. */
/** Los eventos llegados por la sesión desde la última consulta. El motor no tiene un cursor de eventos como el REST (`GET .../eventos?desde=`):
 * llegan en las `Delta` y se guardan al llegar (`guardarEvento`). Antes esto devolvía siempre nada y no salía ningún aviso ni informe. */
export async function consultarEventos(_gameId: string, _desde: number): Promise<EventoDominio[]> {
  return eventosPorAvisar.splice(0);
}
export interface TropaReclutable {
  id: string;
  nombre: string;
  tecnologia: string;
  edificio: string;
  nivelRequerido: number;
  costoEquipo: Record<string, number | undefined>;
  unidadesPorDefecto: number;
  escalon: number;
  poderBase?: number;
  velocidad?: number;
  /** Caballos por soldado: se pagan en oro. */
  caballos?: number;
}

/** Una política del catálogo (`POLITICA_CATALOGO`): su cargo, su nombre y los efectos (`factor*`, `cupo*`, `perfilTrazado`) como campos sueltos. */
export interface PoliticaDelCatalogo { id: string; cargo: string; nombre: string; [efecto: string]: string | number | undefined }
/** `POLITICAS` del balance: slots por cargo, el extra del Gobernador por nivel de Facción y la duración de toda política. */
export interface ReglasDePoliticas {
  slotsPorCargo: Record<string, { base: number; maximo: number }>;
  nivelFaccionPorSlotExtraGobernador: number;
  slotSalaConsejo: number;
  duracionMinutosPorDefecto: number;
}

/** Un carro del catálogo: lo que carga sin animal, lo que cuesta y dónde se fabrica (Doc 3.13.1). */
export interface CarroDelCatalogo { capacidadBase: number; costo: Record<string, number>; fabrica: string }
/** Un animal del catálogo: multiplica la capacidad del carro, fija la velocidad de la caravana y se compra con su `costo`. */
export interface AnimalDelCatalogo { factorCarga: number; velocidad: number; costo: Record<string, number> }

/** El balance público (`GET /v1/balance`): se pide una vez, en segundo plano, y avisa con `alCargar` cuando llega. */
interface BalancePublico {
  catalogos?: { EDIFICIO_CATALOGO?: Record<string, { costo?: Record<string, number>; niveles?: Record<string, NivelDeEdificio> }>; TROPAS_RECLUTABLES?: TropaReclutable[]; POLITICA_CATALOGO?: PoliticaDelCatalogo[] };
  cuposYNiveles?: { POLITICAS?: ReglasDePoliticas; CAP_FUNDACION_POR_NIVEL?: number[]; CIUDADANIA?: { cooldownCambioResidenciaDias?: number; cooldownCreacionFaccionDias?: number } };
  caravanas?: { CARAVANA_COOLDOWN?: { cooldownMinutos?: number }; CARRO_CATALOGO?: Record<string, CarroDelCatalogo>; ANIMAL_CATALOGO?: Record<string, AnimalDelCatalogo>; CARAVANA_PREPARACION?: { kPorCarro?: number; maxProgramacionDias?: number }; CARAVANA_ESCOLTA?: { liderazgoPorNivelMercado?: number[] } };
  politica?: { PUERTA?: { cerradaAPorDefecto?: string[] }; CAPITAL?: { cooldownDias?: number } };
  mundoYMilitar?: { LOGISTICA?: { capacidadViveresPorHeroe?: number; radioEncuentro?: number; radioReabastecimiento?: number }; FUNDACION?: { materialesIniciales?: Record<string, number>; viviendasIniciales?: number; costoMaderaExtraCaravana?: number }; MERCENARIOS?: { refundacion?: { porcentajeCoste?: number }; radioProteccion?: number }; MOVIMIENTO?: { radioPuerta?: number; radioInspeccion?: number }; RECLUTAMIENTO_ORO_POR_ESCALON?: Record<string, number>; ORO_POR_CABALLO?: number };
  tecnologia?: CatalogoTecnologia;
  internas?: { CAMPAMENTOS_BANDIDOS?: { niveles?: Record<string, NivelDeBandidos> } };
}
import type { CondicionHito } from './tiposDominio';
/** El grupo `tecnologia` del balance (Doc 6): catálogo de tecnologías, Eras, tarifas de adopción, Aedas y épicas. */
export interface CatalogoTecnologia {
  TECNOLOGIAS: Record<string, { nombre: string; era: string; deArranque?: boolean; logro?: { contador: string; umbral: number }; hito: CondicionHito[]; bonusProduccion?: { recurso: string; factor: number } }>;
  ERAS: Record<string, { orden: number; nombre: string; plazoSemanas: number }>;
  TARIFA_ADOPCION: Record<string, Record<string, number>>;
  AEDAS: { epica: { enfriamientoMinutos: number }; venta: { factorOro: number; ordenEraMaximo: number } };
  EPICAS: Record<string, { nombre: string; capitulos: { hecho: string; cantidad: number; edificio?: string }[] }>;
  TITULO_CAPITULO: Record<string, string>;
}
let balancePublico: BalancePublico | null = null;
let balancePedido = false;
const oyentesDelBalance = new Set<() => void>();
function balance(alCargar?: () => void): BalancePublico | null {
  if (!balancePublico && alCargar) oyentesDelBalance.add(alCargar);
  if (!balancePublico && !balancePedido) {
    balancePedido = true;
    // El balance del backend TypeScript viene ahora de los datos de juego del motor (`GET /v1/datos`). Allí van los mismos bloques
    // (`LOGISTICA`, `CAMPAMENTOS_BANDIDOS`, `TROPAS_RECLUTABLES`...) agrupados por documento de Mechanics y no por los grupos del TS, así que
    // se juntan en uno solo y cada grupo lo ve entero. Si un bloque está en dos documentos, gana el primero.
    void cargarDatosDeJuego().then((d) => {
      if (!d?.documentos) return;
      reglasDePartida = d.reglas ?? null;
      const bloques: Record<string, unknown> = {};
      for (const doc of Object.values(d.documentos)) for (const [k, v] of Object.entries(doc)) if (!(k in bloques)) bloques[k] = v;
      const todo = bloques as never;
      balancePublico = { catalogos: todo, cuposYNiveles: todo, caravanas: todo, politica: todo, mundoYMilitar: todo, tecnologia: todo, internas: todo };
      for (const f of oyentesDelBalance) f();
      oyentesDelBalance.clear();
    });
  }
  return balancePublico;
}

/** Radio con el que nace la zona de una plaza (`reglas.territorio.radio_inicial` de `/v1/datos`); 6, la cifra de hoy, mientras no llegue. */
export function radioZonaInicial(alCargar?: () => void): number {
  balance(alCargar);
  const r = Number(reglasDePartida?.territorio?.radio_inicial) / 1000;
  return r > 0 ? r : 6;
}

/** Un bloque de parámetros de `GET /v1/datos` por su nombre (`PUEBLOS_EXTRACTORES`, `NIVEL_ASENTAMIENTO`…); `null` mientras no llegue. */
export function bloqueDeDatos<T>(nombre: string, alCargar?: () => void): T | null {
  const b = balance(alCargar)?.catalogos as Record<string, unknown> | undefined;
  return (b?.[nombre] as T | undefined) ?? null;
}

/** Una receta de transformación de un nivel de edificio: `produccionBase` por minuto con la mano de obra completa; `consumePorUnidad` = insumo por unidad producida. */
export interface RecetaDeEdificio { produce: string; produccionBase: number; consumePorUnidad: Record<string, number>; requiereTecnologia?: string; requiereEdificio?: { tipo: string; nivel: number } }
/** Un nivel interno de un edificio del catálogo: qué fabrica y qué pide para llegar a él. */
export interface NivelDeEdificio { recetas: RecetaDeEdificio[]; costoMejora?: Record<string, number>; requisitoNivelAsentamiento?: number; requiereEdificio?: string; requiereEdificioNivel?: number; requiereTecnologia?: string; obraMinutos?: number; cupoCaravanas?: number; cupoCarros?: number }

/** Los topes de flota del Mercado a su nivel interno (`cupoCaravanas` y `cupoCarros`, Doc 3.13.2); `null` mientras no llegue el balance o si ese nivel no existe. */
export function cupoDeFlota(nivelMercado: number, alCargar?: () => void): { caravanas?: number; carros?: number } | null {
  const n = nivelesDeEdificio('mercado', alCargar)?.[String(nivelMercado)];
  return n ? { caravanas: n.cupoCaravanas, carros: n.cupoCarros } : null;
}

/** Días de mundo que hay que esperar tras mudarte antes de volver a hacerlo (`CIUDADANIA.cooldownCambioResidenciaDias`); `undefined` mientras no llegue el balance. */
export function diasDeEnfriamientoDeResidencia(alCargar?: () => void): number | undefined {
  return balance(alCargar)?.cuposYNiveles?.CIUDADANIA?.cooldownCambioResidenciaDias;
}

/** Los niveles internos de un tipo de edificio (`EDIFICIO_CATALOGO[tipo].niveles`); `null` mientras no llegue el balance o si el tipo no tiene niveles. */
export function nivelesDeEdificio(tipo: string, alCargar?: () => void): Record<string, NivelDeEdificio> | null {
  return balance(alCargar)?.catalogos?.EDIFICIO_CATALOGO?.[tipo]?.niveles ?? null;
}

/** A qué distancia de la puerta de una plaza o campamento se actúa (`MOVIMIENTO.radioPuerta`); 10 mientras no llegue el balance. */
export function radioDePuerta(): number {
  return balance()?.mundoYMilitar?.MOVIMIENTO?.radioPuerta ?? 10;
}

/** A cuánto se inspecciona a otro (`MOVIMIENTO.radioInspeccion`); 40 mientras no llegue el balance. */
export function radioDeInspeccion(): number {
  return balance()?.mundoYMilitar?.MOVIMIENTO?.radioInspeccion ?? 40;
}

/** Días de mundo entre dos traslados de capital (`CAPITAL.cooldownDias`); 14 mientras no llegue el balance. */
export function diasDeEnfriamientoDeCapital(): number {
  return balance()?.politica?.CAPITAL?.cooldownDias ?? 14;
}

/** Días de mundo sin poder crear otra Facción tras dejar o crear una (`CIUDADANIA.cooldownCreacionFaccionDias`); 7 mientras no llegue el balance. */
export function diasDeEnfriamientoDeCreacionDeFaccion(): number {
  return balance()?.cuposYNiveles?.CIUDADANIA?.cooldownCreacionFaccionDias ?? 7;
}

/** A quién se le cierra una plaza que no fijó su puerta (`PUERTA.cerradaAPorDefecto`); neutrales y enemigos mientras no llegue el balance. */
export function puertaCerradaAPorDefecto(): string[] {
  return balance()?.politica?.PUERTA?.cerradaAPorDefecto ?? ['neutrales', 'enemigos'];
}

/**
 * Oro por soldado al reclutar en una plaza (Doc 5.8): el del escalón + `ORO_POR_CABALLO` por caballo; la tropa del Centro Urbano no paga oro.
 * "Leva Forzosa" solo multiplica el equipo, no esto. `null` mientras no llegue el balance.
 */
export function oroPorSoldado(t: { escalon: number; edificio: string; caballos?: number }): number | null {
  const m = balance()?.mundoYMilitar;
  if (!m?.RECLUTAMIENTO_ORO_POR_ESCALON || m.ORO_POR_CABALLO === undefined) return null;
  return t.edificio === 'centroUrbano' ? 0 : (m.RECLUTAMIENTO_ORO_POR_ESCALON[t.escalon] ?? 0) + (t.caballos ?? 0) * m.ORO_POR_CABALLO;
}

/** Los catálogos de carros y animales y la preparación/escolta de las caravanas (Doc 3.13); `null` mientras no llegue el balance. */
export function catalogoDeCaravanas(alCargar?: () => void): { carros: Record<string, CarroDelCatalogo>; animales: Record<string, AnimalDelCatalogo>; preparacionKPorCarro: number; escoltaPorNivelMercado: number[]; cooldownMinutos: number } | null {
  const c = balance(alCargar)?.caravanas;
  if (!c?.CARRO_CATALOGO || !c.ANIMAL_CATALOGO) return null;
  return { carros: c.CARRO_CATALOGO, animales: c.ANIMAL_CATALOGO, preparacionKPorCarro: c.CARAVANA_PREPARACION?.kPorCarro ?? 0, escoltaPorNivelMercado: c.CARAVANA_ESCOLTA?.liderazgoPorNivelMercado ?? [], cooldownMinutos: c.CARAVANA_COOLDOWN?.cooldownMinutos ?? 0 };
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

/** Alrededor de un campamento de mercenarios nadie inicia un combate (`MERCENARIOS.radioProteccion`); 10 mientras no llegue el balance (el backend
 * TypeScript usaba 60). */
export function radioDeProteccionMercenarios(): number {
  return balance()?.mundoYMilitar?.MERCENARIOS?.radioProteccion ?? 10;
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
  const porcentaje = balance(alCargar)?.mundoYMilitar?.MERCENARIOS?.refundacion?.porcentajeCoste;
  const base = costoCompletoDeCaravanaDeFundacion();
  if (!base || porcentaje === undefined) return null;
  return Object.fromEntries(Object.entries(base).map(([r, n]) => [r, Math.ceil(n * porcentaje)] as const).filter(([, n]) => n > 0));
}

/** El coste COMPLETO de la Caravana de Fundación que lanza una plaza (`costoCaravanaFundacion` del backend, Doc 1.8): los materiales iniciales de una fundación +
 * la granja y las viviendas que nacen con ella + la madera extra. Derivado del balance igual que `costoDeRefundacion`; `null` mientras no llegue. */
export function costoCompletoDeCaravanaDeFundacion(alCargar?: () => void): Record<string, number> | null {
  const b = balance(alCargar);
  const f = b?.mundoYMilitar?.FUNDACION;
  const cat = b?.catalogos?.EDIFICIO_CATALOGO;
  if (!f || !cat?.['granja'] || !cat['vivienda']) return null;
  const costo: Record<string, number> = { ...f.materialesIniciales };
  for (const [r, n] of Object.entries(cat['granja'].costo ?? {})) costo[r] = (costo[r] ?? 0) + n;
  for (const [r, n] of Object.entries(cat['vivienda'].costo ?? {})) costo[r] = (costo[r] ?? 0) + n * (f.viviendasIniciales ?? 0);
  costo['madera'] = (costo['madera'] ?? 0) + (f.costoMaderaExtraCaravana ?? 0);
  return Object.fromEntries(Object.entries(costo).filter(([, n]) => n > 0));
}

/** El cooldown de creación de caravanas (`CARAVANA_COOLDOWN`, minutos de mundo, compartido entre Fundación y comerciales); 10 mientras no llegue el balance. */
export function cooldownDeCaravanaMinutos(alCargar?: () => void): number {
  return balance(alCargar)?.caravanas?.CARAVANA_COOLDOWN?.cooldownMinutos ?? 10;
}

/** El Cap de Fundación de una Facción de ese nivel (`CAP_FUNDACION_POR_NIVEL`, Doc 1.7); `null` mientras no llegue el balance. */
export function capDeFundacion(nivelFaccion: number, alCargar?: () => void): number | null {
  const tabla = balance(alCargar)?.cuposYNiveles?.CAP_FUNDACION_POR_NIVEL;
  return tabla?.length ? (tabla[Math.min(tabla.length, Math.max(1, nivelFaccion)) - 1] ?? tabla[tabla.length - 1] ?? null) : null;
}

/** El catálogo de políticas de cargo y las reglas de slots/duración (Doc 4.4); `null` mientras no llegue el balance. */
export function catalogoDePoliticas(alCargar?: () => void): { catalogo: PoliticaDelCatalogo[]; reglas: ReglasDePoliticas } | null {
  const b = balance(alCargar);
  const catalogo = b?.catalogos?.POLITICA_CATALOGO;
  const reglas = b?.cuposYNiveles?.POLITICAS;
  return catalogo && reglas ? { catalogo, reglas } : null;
}

/** El catálogo de tecnología y Aedas del balance; `null` mientras no llegue (o en un servidor que aún no lo publica). */
export function catalogoDeTecnologia(alCargar?: () => void): CatalogoTecnologia | null {
  return balance(alCargar)?.tecnologia ?? null;
}

/** El mapa como asset (Fase C11a): se pide una sola vez por `mapaId` y se cachea */
/** El mapa del mundo: el artefacto de la `Bienvenida` (por hash, con caché en IndexedDB), como `MapaGenerado`. */
export async function obtenerMapa(_gameId: string, mapaId: string): Promise<MapaGenerado> {
  if (mapaCargado?.hash === mapaId) return mapaCargado.mapa;
  const s = await sesionAbierta();
  const mundo = s.bienvenida?.mundo;
  if (!mundo) throw new ApiError(0, 'el servidor no dijo qué mundo tiene');
  const { mapa } = await cargarMundo(BASE, mundo.urlArtefacto, mundo.hash);
  mapaCargado = { hash: mundo.hash, mapa };
  return mapa;
}

/** Un comando de siempre, como `Orden` del contrato. Cuando llega el resultado, el almacén ya tiene lo que la orden cambió (respuesta
 * causal), así que la proyección que acompaña a la respuesta ya está al día. */
export async function ejecutarComando(_gameId: string, tipo: string, params: unknown): Promise<RespuestaComando> {
  const s = await sesionAbierta();
  let cuerpo;
  try {
    cuerpo = traducirOrden(tipo, params);
  } catch (e) {
    if (e instanceof ComandoDesconocido) return { resultado: { ok: false, codigoError: 'comando_desconocido', detalleError: e.message } };
    throw e;
  }
  let r;
  try {
    r = await s.ordenar(cuerpo);
  } catch (e) {
    throw aApiError(e);
  }
  const ok = r.resultado === Resultado.ORDEN_ACEPTADA || r.resultado === Resultado.ORDEN_SIN_CAMBIOS || r.resultado === Resultado.ORDEN_DUPLICADA;
  const datos = r.datos as Record<string, unknown> | undefined;
  return {
    resultado: ok
      ? { ok, datos: { ...datos, creadas: r.creadas.map((c) => ({ entidad: TipoEntidad[c.entidad], id: c.id })) } }
      : { ok, codigoError: r.rechazo?.codigo ?? 'rechazada', detalleError: detalleLegible(r.rechazo?.codigo, r.rechazo?.mensaje) },
    proyeccion: proyeccionActual(s),
  };
}

/** Rechazos cuyo mensaje del motor lleva cantidades en milésimas: se pasan a unidades para el jugador. */
const RECHAZOS_EN_MILESIMAS = new Set(['reclutamiento.sin_reserva_de_trigo']);

function detalleLegible(codigo: string | undefined, mensaje: string | undefined): string | undefined {
  if (!mensaje || !codigo || !RECHAZOS_EN_MILESIMAS.has(codigo)) return mensaje;
  return mensaje.replace(/-?\d+/g, (n) => String(Math.round(Number(n) / 1000)));
}

export const repartirPuntos = (gameId: string, params: ParamsRepartirPuntos) => ejecutarComando(gameId, 'repartirPuntos', params);
export const guardarLoadout = (gameId: string, params: ParamsGuardarLoadout) => ejecutarComando(gameId, 'guardarLoadout', params);
export const borrarLoadout = (gameId: string, loadoutId: string) => ejecutarComando(gameId, 'borrarLoadout', { loadoutId });
export const asignarGuarnicion = (gameId: string, squadId: string) => ejecutarComando(gameId, 'asignarGuarnicion', { squadId });
export const retirarGuarnicion = (gameId: string, squadId: string) => ejecutarComando(gameId, 'retirarGuarnicion', { squadId });
