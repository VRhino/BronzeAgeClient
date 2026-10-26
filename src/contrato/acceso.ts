// El servicio de acceso del motor (tanda 7B; `Docs/Coordinacion/08_Consumo_del_Contrato.md` del motor): registro y login por HTTP en el mismo
// puerto que la sesión. El token que da el login viaja en `Hola.token` al abrir el WebSocket.

export interface Cuenta {
  cuentaId: string;
  nick: string;
  bot: boolean;
}

export interface SesionDeAcceso extends Cuenta {
  token: string;
  /** Cuándo caduca, en ms de época. */
  expiraMs: number;
}

/** Un error del servicio de acceso, con su código estable (`nick_repetido`, `credenciales_invalidas`...). */
export class ErrorDeAcceso extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

async function pedir<T>(base: string, ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(`${base}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new ErrorDeAcceso(r.status, String(datos.error ?? 'desconocido'), String(datos.mensaje ?? r.statusText));
  return datos as T;
}

/** `POST /v1/registro`. El código es el de invitación (vacío si el servidor tiene el registro abierto). */
export async function registrar(base: string, nick: string, clave: string, codigo: string): Promise<Cuenta> {
  const r = await pedir<{ cuenta_id: string; nick: string; bot: boolean }>(base, '/v1/registro', { nick, clave, codigo });
  return { cuentaId: r.cuenta_id, nick: r.nick, bot: r.bot };
}

/** `POST /v1/sesiones`: cada login da un token nuevo. */
export async function entrar(base: string, nick: string, clave: string): Promise<SesionDeAcceso> {
  const r = await pedir<{ token: string; cuenta_id: string; nick: string; bot: boolean; expira_ms: number }>(base, '/v1/sesiones', { nick, clave });
  return { token: r.token, cuentaId: r.cuenta_id, nick: r.nick, bot: r.bot, expiraMs: r.expira_ms };
}

/** `GET` del artefacto de mundo por su ruta (`InfoMundo.url_artefacto`, relativa al servidor). */
export async function descargarArtefacto(base: string, url: string): Promise<Uint8Array> {
  const r = await fetch(new URL(url, base || location.origin).toString());
  if (!r.ok) throw new ErrorDeAcceso(r.status, 'artefacto', `no se pudo bajar el artefacto de mundo (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}
