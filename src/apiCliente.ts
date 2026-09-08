// Wrapper `fetch` sobre la superficie `/jugador/*` y `/sesiones` del backend (Fase C3) — sin lógica de negocio, solo I/O.
import type { MapaGenerado } from './terreno';

import type { AcuerdoTrueque, Asentamiento, AsentamientoAvistado, AsentamientoConocido, CaminoComercial, CampamentoBandido, Caravana, Ejercito, EjercitoAvistado, Faccion, NieblaProyectada, OrdenMercado, ZonaFaccion, TrazadoAsentamiento } from './tiposDominio';

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
  jugadorId: string;
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
  /** Los ajenos que se estén viendo AHORA —lo que vigilan tus plazas o el radio de visión de una columna
   * tuya—, ya redactados por el servidor (Doc 5.12.7). Entran y salen del array según los pierdas de vista:
   * a diferencia de los asentamientos, de un ejército NO se guarda memoria. Tiene sentido — una ciudad sigue
   * donde estaba, una columna en marcha no. */
  ejercitosAvistados: EjercitoAvistado[];
  caminos: CaminoComercial[];
  /** Ofertas de mercado en pie de CUALQUIER plaza en cuya puerta esté una columna tuya, más las de tus
   * propios asentamientos — el resto no viaja (Doc 3.3, `proyectarParaJugador` en el backend). Sin interfaz
   * que las lea todavía. */
  ordenes: OrdenMercado[];
  /** Trueques propuestos o activos que tocan un asentamiento tuyo (Doc 3.2). Sin interfaz que los lea. */
  acuerdos: AcuerdoTrueque[];
  campamentosBandidos: CampamentoBandido[];
  zonasFusionadas: ZonaFaccion[];
  trazadoPorAsentamiento: Record<string, TrazadoAsentamiento>;
  [campo: string]: unknown;
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
  };
  proyeccion?: ProyeccionJugador;
  [campo: string]: unknown;
}

const V1 = '/v1';
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
        authorization: cabeceraAuth,
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

export async function loginConUsuario(usuario: string): Promise<RespuestaLogin> {
  const sujeto = usuario.trim();
  if (!sujeto) throw new ApiError(400, 'El nombre de usuario no puede estar vacío.');

  const res = await fetchJson<RespuestaLogin>(`${V1}/sesiones`, { method: 'POST' }, `dev ${sujeto}`);
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

export function cargarSesionLocal(): { sesionId: string; usuario: string; gameId: string } | null {
  const sid = localStorage.getItem(STORAGE_KEY_SESION);
  const usr = localStorage.getItem(STORAGE_KEY_USUARIO);
  const gid = localStorage.getItem(STORAGE_KEY_GAME_ID);

  if (sid && usr && gid) {
    sesionIdMemoria = sid;
    usuarioMemoria = usr;
    return { sesionId: sid, usuario: usr, gameId: gid };
  }
  return null;
}

export function cerrarSesion(): void {
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
    if (err instanceof ApiError && err.status === 401) {
      // Si la sesión expiró o es inválida, intentar re-autenticar automáticamente si conocemos el usuario
      if (usuarioMemoria) {
        const loginRes = await loginConUsuario(usuarioMemoria);
        sesionIdMemoria = loginRes.sesionId;
        const local = cargarSesionLocal();
        if (local) guardarSesionLocal(loginRes.sesionId, local.usuario, local.gameId);
        return fetchJson<T>(url, opciones, `sesion ${sesionIdMemoria}`);
      }
    }
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

export function consultarProyeccion(gameId: string): Promise<ProyeccionJugador> {
  return peticion<ProyeccionJugador>(`${V1}/jugador/partidas/${encodeURIComponent(gameId)}`);
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
