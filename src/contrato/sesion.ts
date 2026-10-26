// La sesión del contrato 05: un WebSocket con tramas binarias (una trama = un `MensajeDeServidor` / `MensajeDeCliente`), zstd negociado,
// secuencia sin huecos, órdenes con respuesta causal, reloj sincronizado y reanudación por versión con lo que guarda el `Almacen`.
// Es solo transporte: no sabe nada de la interfaz; quien la usa escucha `alCambiar` y lee el almacén.
import { create, fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf';
import { decompress } from 'fzstd';
import { RectanguloSchema, type Rectangulo } from './gen/bronzeage/v1/common_pb';
import type { EventoDominio } from './gen/bronzeage/v1/events_pb';
import { OrdenSchema } from './gen/bronzeage/v1/orders_pb';
import {
  MensajeDeClienteSchema,
  MensajeDeServidorSchema,
  TipoCliente,
  type Aviso,
  type Bienvenida,
  type Cronica,
  type ErrorSesion,
  type MensajeDeCliente,
  type Reloj,
  type ResultadoOrden,
} from './gen/bronzeage/v1/session_pb';
import { Almacen, Incoherencia } from './almacen';

/** El cuerpo de una orden, sin `peticion_id` (lo pone la sesión): `{ case: 'crearHeroe', value: {...} }`. */
export type CuerpoDeOrden = Exclude<MessageInitShape<typeof OrdenSchema>['cuerpo'], undefined>;

export type EstadoSesion = 'desconectada' | 'conectando' | 'abierta' | 'reconectando' | 'cerrada';

export interface OpcionesSesion {
  /** `ws://host:puerto/` del servidor. */
  url: string;
  token: string;
  /** Mientras el contrato no tenga uno para el cliente web de jugador, `CLIENTE_UNITY`. */
  cliente?: TipoCliente;
  versionCliente: string;
  almacen?: Almacen;
  /** El hash del artefacto de mundo que ya se tiene (no hace falta bajarlo otra vez). */
  mundoHash?: string;
  /** Reconectar solo al caerse la conexión (por defecto sí). */
  reconectar?: boolean;
  /** Para Node o pruebas: el constructor de WebSocket. */
  WebSocket?: typeof WebSocket;
}

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd];
const PING_MS = 10_000;

interface Pendiente<T> {
  resolver: (r: T) => void;
  rechazar: (e: Error) => void;
}

/** Una sesión que acaba con un `ErrorSesion` fatal (token caducado, rol no permitido...). */
export class ErrorDeSesion extends Error {
  constructor(readonly codigo: string, mensaje: string, readonly fatal: boolean) {
    super(mensaje);
  }
}

export class Sesion {
  readonly almacen: Almacen;
  estado: EstadoSesion = 'desconectada';
  bienvenida?: Bienvenida;

  private ws?: WebSocket;
  private secuencia = 0n;
  private vista?: Rectangulo;
  private intentos = 0;
  private cerradaAPeticion = false;
  private temporizadorPing?: ReturnType<typeof setInterval>;
  private ordenes = new Map<string, Pendiente<ResultadoOrden>>();
  private cronicas = new Map<string, Pendiente<Cronica>>();
  private enEspera: { peticionId: string; mensaje: MensajeDeCliente }[] = [];
  private abriendo?: Pendiente<Bienvenida>;

  // El reloj de mundo: `mundoMs` en el instante local `localMs` (performance.now), con su factor; `rtt` de la mejor muestra.
  private reloj = { mundoMs: 0, localMs: 0, factor: 1, pausado: true, rtt: Number.POSITIVE_INFINITY };

  private oyentesCambio = new Set<(ambito: string) => void>();
  private oyentesEvento = new Set<(ambito: string, e: EventoDominio) => void>();
  private oyentesAviso = new Set<(a: Aviso) => void>();
  private oyentesEstado = new Set<(e: EstadoSesion, error?: ErrorSesion) => void>();
  private oyentesBienvenida = new Set<(b: Bienvenida) => void>();

  constructor(private readonly op: OpcionesSesion) {
    this.almacen = op.almacen ?? new Almacen();
  }

  /** Abre la sesión y resuelve con la `Bienvenida` (las fotos de los ámbitos llegan justo después y avisan por `alCambiar`). */
  abrir(): Promise<Bienvenida> {
    this.cerradaAPeticion = false;
    return new Promise((resolver, rechazar) => {
      this.abriendo = { resolver, rechazar };
      this.conectar('conectando');
    });
  }

  cerrar(): void {
    this.cerradaAPeticion = true;
    this.pararPing();
    this.ws?.close();
    this.fijarEstado('cerrada');
    this.fallarPendientes(new Error('sesión cerrada'));
  }

  /** Da una orden. Resuelve con su `ResultadoOrden`: cuando llega, el almacén ya tiene lo que la orden cambió (respuesta causal). */
  ordenar(cuerpo: CuerpoDeOrden, versionEsperada?: bigint): Promise<ResultadoOrden> {
    const peticionId = idDePeticion();
    const orden = create(OrdenSchema, { peticionId, versionEsperada, cuerpo });
    const mensaje = create(MensajeDeClienteSchema, { cuerpo: { case: 'orden', value: orden } });
    return new Promise((resolver, rechazar) => {
      this.ordenes.set(peticionId, { resolver, rechazar });
      this.encolar(peticionId, mensaje);
    });
  }

  /** Una página de la crónica pública (hacia atrás con `hastaVersion`, hacia delante con `desdeVersion`). */
  pedirCronica(p: { desdeVersion?: bigint; hastaVersion?: bigint; limite?: number } = {}): Promise<Cronica> {
    const peticionId = idDePeticion();
    const mensaje = create(MensajeDeClienteSchema, {
      cuerpo: { case: 'pedirCronica', value: { peticionId, desdeVersion: p.desdeVersion, hastaVersion: p.hastaVersion, limite: p.limite ?? 0 } },
    });
    return new Promise((resolver, rechazar) => {
      this.cronicas.set(peticionId, { resolver, rechazar });
      this.encolar(peticionId, mensaje);
    });
  }

  /** Fija el rectángulo de la `VISTA` (milésimas de unidad). Se vuelve a pedir solo al reconectar. */
  cambiarVista(r: MessageInitShape<typeof RectanguloSchema>): void {
    const rectangulo = create(RectanguloSchema, r);
    this.vista = rectangulo;
    if (this.estado === 'abierta') this.enviar(create(MensajeDeClienteSchema, { cuerpo: { case: 'vista', value: { rectangulo } } }));
  }

  /** El instante de mundo ahora, en ms de época, evaluado con el reloj sincronizado. */
  ahoraMundo(): number {
    const r = this.reloj;
    if (r.pausado) return r.mundoMs;
    return r.mundoMs + (ahoraLocal() - r.localMs) * r.factor;
  }

  get relojPausado(): boolean {
    return this.reloj.pausado;
  }

  alCambiar(f: (ambito: string) => void): () => void { return suscribir(this.oyentesCambio, f); }
  alEvento(f: (ambito: string, e: EventoDominio) => void): () => void { return suscribir(this.oyentesEvento, f); }
  alAviso(f: (a: Aviso) => void): () => void { return suscribir(this.oyentesAviso, f); }
  alEstado(f: (e: EstadoSesion, error?: ErrorSesion) => void): () => void { return suscribir(this.oyentesEstado, f); }
  alBienvenida(f: (b: Bienvenida) => void): () => void { return suscribir(this.oyentesBienvenida, f); }

  // ─────────────────────────── por dentro ───────────────────────────

  private conectar(estado: EstadoSesion): void {
    this.fijarEstado(estado);
    const WS = this.op.WebSocket ?? WebSocket;
    const ws = new WS(this.op.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.secuencia = 0n;
    ws.onopen = () => {
      const hola = this.almacen.hola({
        token: this.op.token,
        cliente: this.op.cliente ?? TipoCliente.CLIENTE_UNITY,
        versionCliente: this.op.versionCliente,
        mundoHash: this.op.mundoHash,
        relojClienteMs: BigInt(Math.round(ahoraLocal())),
      });
      this.enviar(create(MensajeDeClienteSchema, { cuerpo: { case: 'hola', value: hola } }));
    };
    ws.onmessage = (ev) => this.recibir(new Uint8Array(ev.data as ArrayBuffer));
    ws.onclose = () => this.alCerrarse(ws);
    ws.onerror = () => {};
  }

  private recibir(trama: Uint8Array): void {
    if (ZSTD.every((b, i) => trama[i] === b)) trama = decompress(trama);
    const m = fromBinary(MensajeDeServidorSchema, trama);
    if (m.secuencia !== this.secuencia + 1n) {
      // Un hueco es un error del servidor: se reanuda con lo que hay.
      this.reiniciarConexion();
      return;
    }
    this.secuencia = m.secuencia;
    const c = m.cuerpo;
    switch (c.case) {
      case 'bienvenida': {
        this.bienvenida = c.value;
        if (c.value.reloj) this.ajustarReloj(c.value.reloj, Number.POSITIVE_INFINITY);
        // Lo que reanuda con foto o es nuevo llega en su mensaje; lo que ya no está suscrito se descarta.
        const suscritos = new Set(c.value.ambitos.map((a) => `${a.ambito ? claveCorta(a.ambito.tipo) : ''}:${a.ambito?.id ?? ''}`));
        for (const k of [...this.almacen.ambitos.keys()]) if (!suscritos.has(k)) this.almacen.ambitos.delete(k);
        this.intentos = 0;
        this.fijarEstado('abierta');
        this.iniciarPing();
        if (this.vista) this.cambiarVista(this.vista as Rectangulo);
        for (const p of this.enEspera) this.enviar(p.mensaje);
        for (const f of this.oyentesBienvenida) f(c.value);
        this.abriendo?.resolver(c.value);
        this.abriendo = undefined;
        break;
      }
      case 'foto':
      case 'delta':
      case 'revocado': {
        let ambito: string | undefined;
        try {
          ambito = this.almacen.aplicar(c);
        } catch (e) {
          if (e instanceof Incoherencia) {
            console.warn('[sesion] incoherencia, se reanuda:', e.message);
            // Lo que no encaja se tira y se pide de nuevo: el servidor lo manda como foto.
            this.almacen.vaciar();
            this.reiniciarConexion();
            return;
          }
          throw e;
        }
        if (c.case === 'delta') for (const ev of c.value.eventos) for (const f of this.oyentesEvento) f(ambito!, ev);
        if (ambito) for (const f of this.oyentesCambio) f(ambito);
        break;
      }
      case 'resultado': {
        const p = this.ordenes.get(c.value.peticionId);
        this.ordenes.delete(c.value.peticionId);
        this.sacarDeEspera(c.value.peticionId);
        p?.resolver(c.value);
        break;
      }
      case 'cronica': {
        const p = this.cronicas.get(c.value.peticionId);
        this.cronicas.delete(c.value.peticionId);
        this.sacarDeEspera(c.value.peticionId);
        p?.resolver(c.value);
        break;
      }
      case 'pong': {
        const envio = Number(c.value.clienteEnvioMs);
        const rtt = ahoraLocal() - envio;
        if (c.value.reloj) this.ajustarReloj(c.value.reloj, rtt);
        break;
      }
      case 'aviso':
        if (c.value.reloj) this.ajustarReloj(c.value.reloj, Number.POSITIVE_INFINITY, true);
        for (const f of this.oyentesAviso) f(c.value);
        break;
      case 'error': {
        const e = c.value;
        if (e.fatal) {
          this.cerradaAPeticion = true;
          const error = new ErrorDeSesion(e.codigo, e.mensaje, true);
          this.abriendo?.rechazar(error);
          this.abriendo = undefined;
          this.fallarPendientes(error);
          this.fijarEstado('cerrada', e);
          this.ws?.close();
        } else {
          for (const f of this.oyentesAviso) f({ codigo: e.codigo, mensaje: e.mensaje } as Aviso);
        }
        break;
      }
      default:
        break;
    }
  }

  /** Con una muestra de reloj nueva: se queda con la de menor ida y vuelta (la más fiable), salvo que el reloj haya cambiado de ritmo. */
  private ajustarReloj(r: Reloj, rtt: number, forzar = false): void {
    const factor = r.factorMilesimas / 1000;
    const cambio = forzar || factor !== this.reloj.factor || r.pausado !== this.reloj.pausado;
    const ida = Number.isFinite(rtt) ? rtt / 2 : 0;
    if (!cambio && Number.isFinite(this.reloj.rtt) && rtt > this.reloj.rtt * 1.5) return;
    this.reloj = {
      mundoMs: Number(r.mundoMs) + (r.pausado ? 0 : ida * factor),
      localMs: ahoraLocal(),
      factor,
      pausado: r.pausado,
      rtt: Number.isFinite(rtt) ? Math.min(rtt, cambio ? rtt : this.reloj.rtt) : this.reloj.rtt,
    };
  }

  private encolar(peticionId: string, mensaje: MensajeDeCliente): void {
    this.enEspera.push({ peticionId, mensaje });
    if (this.estado === 'abierta') this.enviar(mensaje);
  }

  private sacarDeEspera(peticionId: string): void {
    this.enEspera = this.enEspera.filter((p) => p.peticionId !== peticionId);
  }

  private enviar(m: MensajeDeCliente): void {
    if (this.ws?.readyState === 1) this.ws.send(toBinary(MensajeDeClienteSchema, m));
  }

  private iniciarPing(): void {
    this.pararPing();
    const ping = () => this.enviar(create(MensajeDeClienteSchema, { cuerpo: { case: 'ping', value: { clienteEnvioMs: BigInt(Math.round(ahoraLocal())) } } }));
    ping();
    this.temporizadorPing = setInterval(ping, PING_MS);
  }

  private pararPing(): void {
    if (this.temporizadorPing) clearInterval(this.temporizadorPing);
    this.temporizadorPing = undefined;
  }

  private reiniciarConexion(): void {
    const ws = this.ws;
    this.ws = undefined;
    ws?.close();
    this.alCerrarse(ws);
  }

  private alCerrarse(ws: WebSocket | undefined): void {
    if (ws && this.ws && ws !== this.ws) return; // una conexión vieja que acaba de cerrarse
    this.pararPing();
    if (this.cerradaAPeticion || this.op.reconectar === false) {
      if (this.estado !== 'cerrada') this.fijarEstado('cerrada');
      const error = new Error('la conexión se cerró');
      this.abriendo?.rechazar(error);
      this.abriendo = undefined;
      this.fallarPendientes(error);
      return;
    }
    // Las órdenes en vuelo se vuelven a mandar con su mismo `peticion_id`: si ya se aplicaron, el servidor contesta `ORDEN_DUPLICADA`.
    const espera = Math.min(30_000, 500 * 2 ** this.intentos++);
    this.fijarEstado('reconectando');
    setTimeout(() => {
      if (!this.cerradaAPeticion) this.conectar('reconectando');
    }, espera);
  }

  private fallarPendientes(e: Error): void {
    for (const p of this.ordenes.values()) p.rechazar(e);
    for (const p of this.cronicas.values()) p.rechazar(e);
    this.ordenes.clear();
    this.cronicas.clear();
    this.enEspera = [];
  }

  private fijarEstado(e: EstadoSesion, error?: ErrorSesion): void {
    this.estado = e;
    for (const f of this.oyentesEstado) f(e, error);
  }
}

function claveCorta(tipo: number): string {
  return ['NO_ESPECIFICADO', 'HEROE', 'ASENTAMIENTO', 'FACCION', 'VISTA', 'BATALLA', 'ADMIN', 'CAMPAMENTO'][tipo] ?? String(tipo);
}

function suscribir<F>(s: Set<F>, f: F): () => void {
  s.add(f);
  return () => s.delete(f);
}

function ahoraLocal(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function idDePeticion(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
