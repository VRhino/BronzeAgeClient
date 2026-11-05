// Contadores de red del cliente para el panel de rendimiento (F3, `ui/panelRendimiento.ts`; Víctor, 2026-11-05). Son baratos y van siempre:
// unas sumas y unas colas cortas de muestras. Solo se enseñan con el panel abierto. No saben nada de la interfaz.
//   ping      la ida y vuelta de cada Ping/Pong (cada `PING_MS`)
//   ordenes   lo que tarda cada orden desde que se manda hasta su ResultadoOrden, por tipo
//   bytes     lo recibido por el socket (tal cual llega, comprimido o no) en una ventana deslizante
//   aplicar   lo que tarda en aplicar al almacén cada foto, cambio o revocación

/** Cuántas muestras se guardan de cada cosa (para la media, el p95 y el máximo). */
const MUESTRAS = 120;
/** La ventana de los bytes y los mensajes por segundo, en ms. */
const VENTANA_MS = 5_000;

class Serie {
  private v: number[] = [];
  total = 0;
  anotar(x: number): void {
    this.v.push(x);
    if (this.v.length > MUESTRAS) this.v.shift();
    this.total++;
  }
  get ultima(): number | undefined { return this.v[this.v.length - 1]; }
  resumen(): { n: number; ultima?: number; media?: number; p95?: number; max?: number } {
    if (!this.v.length) return { n: this.total };
    const orden = [...this.v].sort((a, b) => a - b);
    return {
      n: this.total,
      ultima: this.ultima,
      media: this.v.reduce((t, x) => t + x, 0) / this.v.length,
      p95: orden[Math.min(orden.length - 1, Math.floor(orden.length * 0.95))],
      max: orden[orden.length - 1],
    };
  }
}

const ping = new Serie();
const aplicar = new Serie();
const ordenes = new Map<string, Serie>();
const salidas = new Map<string, { tipo: string; desde: number }>();
let llegadas: { t: number; bytes: number }[] = [];
let bytesTotales = 0;

const ahora = (): number => performance.now();

export const medidas = {
  ping(rttMs: number): void { if (Number.isFinite(rttMs) && rttMs >= 0) ping.anotar(rttMs); },
  ordenSale(peticionId: string, tipo: string): void { salidas.set(peticionId, { tipo, desde: ahora() }); },
  ordenVuelve(peticionId: string): void {
    const s = salidas.get(peticionId);
    if (!s) return;
    salidas.delete(peticionId);
    let serie = ordenes.get(s.tipo);
    if (!serie) ordenes.set(s.tipo, (serie = new Serie()));
    serie.anotar(ahora() - s.desde);
  },
  /** Las órdenes que ya no tendrán respuesta (sesión cerrada): no cuentan como en vuelo. */
  olvidarOrdenes(): void { salidas.clear(); },
  recibido(bytes: number): void {
    const t = ahora();
    bytesTotales += bytes;
    llegadas.push({ t, bytes });
    if (llegadas.length > 2_000 || t - llegadas[0]!.t > VENTANA_MS * 2) llegadas = llegadas.filter((x) => t - x.t <= VENTANA_MS);
  },
  aplicado(ms: number): void { aplicar.anotar(ms); },

  /** Lo que enseña el panel: todo en ms salvo los bytes. */
  resumen() {
    const t = ahora();
    const ventana = llegadas.filter((x) => t - x.t <= VENTANA_MS);
    const segundos = VENTANA_MS / 1000;
    return {
      ping: ping.resumen(),
      aplicar: aplicar.resumen(),
      bytesPorSegundo: ventana.reduce((s, x) => s + x.bytes, 0) / segundos,
      mensajesPorSegundo: ventana.length / segundos,
      bytesTotales,
      ordenesEnVuelo: salidas.size,
      ordenes: [...ordenes.entries()].map(([tipo, s]) => ({ tipo, ...s.resumen() })).sort((a, b) => (b.ultima ?? 0) - (a.ultima ?? 0)),
    };
  },
};
