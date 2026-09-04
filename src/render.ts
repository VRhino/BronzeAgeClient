import { contornosBosques, evaluarBioma, evaluarElevacion, type MapaGenerado } from './terreno';
import type { ProyeccionJugador } from './apiCliente';
import type { Asentamiento, Edificio, NieblaProyectada, Point, RectanguloLocal, TrazadoAsentamiento, TrazadoMuralla } from './tiposDominio';
import {
  BIOMA_COLOR_SIMPLE,
  EDIFICIO_COLOR,
  NIEBLA,
  RECURSO_COLOR,
  faccionColor,
} from './paletas';

// --- GENERADOR DETERMINISTA (Para los árboles) ---
function hashSemilla(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(semilla: number): () => number {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dibujarGlifoArbol(ctx: CanvasRenderingContext2D, x: number, y: number, tamano: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - tamano);
  ctx.lineTo(x + tamano * 0.65, y + tamano * 0.55);
  ctx.lineTo(x - tamano * 0.65, y + tamano * 0.55);
  ctx.closePath();
  ctx.fill();
}

/**
 * Un ejercito en el mapa: un RACIMO de rombos, uno por jugador que va en la columna (Doc 5.12.2), cada uno
 * desplazado medio ancho respecto al anterior — o sea, solapados al 50%. Asi el tamano del racimo dice de un
 * vistazo cuanta gente marcha ahi, que es justo lo que hace falta para decidir si plantarle cara.
 *
 * El racimo se recentra sobre `x` para que la POSICION del ejercito caiga en el medio y no en el primer
 * rombo, y se pinta de atras hacia delante para que el primero quede encima y se lea como una columna.
 *
 * Rombo y no triangulo (caravana) ni circulo (asentamiento) ni diamante rojo (campamento): las cuatro cosas
 * que se mueven o amenazan en este mapa tienen forma propia, para no depender del color. Mismo glifo, mismas
 * medidas y mismo orden de pintado que el cliente de administracion (`cliente/src/ui/canvas.ts`) — es
 * deliberadamente el MISMO dibujo, no una variante.
 */
function dibujarRacimoDeRombos(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  participantes: number,
  color: string
): void {
  const r = 5;
  const inicio = ((participantes - 1) * r) / 2;
  for (let i = participantes - 1; i >= 0; i--) {
    const x = cx - inicio + i * r;
    ctx.beginPath();
    ctx.moveTo(x, cy - r);
    ctx.lineTo(x + r, cy);
    ctx.lineTo(x, cy + r);
    ctx.lineTo(x - r, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1b1a17';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Un asentamiento en el mapa general. Relleno = lo estás viendo (tuyo o avistado); hueco = lo RECUERDAS, y
 * puede haber cambiado desde entonces.
 *
 * El hueco no es decorativo: dice literalmente "aquí hay una ciudad, no sé cómo está ahora". Junto con el
 * filtro oscuro que la niebla le echa encima —lo recordado se pinta DEBAJO de la máscara, a propósito— es
 * todo lo que hace falta para que no se confunda con lo que está a la vista.
 */
function dibujarAsentamiento(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  relleno: boolean
): void {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  if (relleno) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1b1a17';
    ctx.lineWidth = 1.5;
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
  }
  ctx.stroke();
}

// --- NIEBLA DE GUERRA ---

/** Un bit por celda, empaquetados en hexadecimal — ver `NieblaProyectada`. Se decodifica el hex UNA vez por
 * máscara y no una por celda, que serían 6.400 `parseInt` por capa y por frame. */
function bytesDeMascara(hex: string, celdas: number): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(celdas / 8));
  const pares = Math.min(bytes.length, Math.floor(hex.length / 2));
  for (let i = 0; i < pares; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
  return bytes;
}

/**
 * La niebla de guerra, en una sola capa por encima de la geografía (niebla de guerra, Paso 5).
 *
 * **Enmascarar es cosa de ESTE cliente, no del servidor** (decisión del usuario, 2026-09-04). La geografía no
 * es información táctica —es la misma para todos, y el mapa se descarga entero una vez y se cachea por su
 * `mapaId`—, así que el servidor solo dice QUÉ has explorado. Lo que no puede salir de él son las ENTIDADES,
 * y eso ya viene filtrado por `proyectarParaJugador`. El cliente de ADMINISTRACIÓN no aplica esta máscara:
 * es herramienta de operación, no un jugador.
 *
 * El truco de dibujo: la máscara se compone a la resolución de la REJILLA (80x80 sobre el mundo de 2000) y se
 * estira al tamaño del canvas con interpolación. Eso da bordes de niebla suaves gratis — si se pintase celda
 * a celda sobre el canvas grande, el mundo se vería a cuadros y la frontera delataría la rejilla en vez de
 * parecer niebla.
 */
export function pintarNiebla(
  ctx: CanvasRenderingContext2D,
  niebla: NieblaProyectada,
  escalaCanvas: number
): void {
  const { columnas, filas, tamanoCelda } = niebla;
  if (columnas <= 0 || filas <= 0) return;

  const total = columnas * filas;
  const explorado = bytesDeMascara(niebla.celdas, total);
  const visible = bytesDeMascara(niebla.visibles, total);
  const [r, g, b] = NIEBLA.color;

  const capa = document.createElement('canvas');
  capa.width = columnas;
  capa.height = filas;
  const cctx = capa.getContext('2d')!;
  const img = cctx.createImageData(columnas, filas);

  for (let i = 0; i < total; i++) {
    const posicion = i >> 3;
    const mascara = 1 << (i & 7);
    const alfa = (visible[posicion]! & mascara) !== 0
      ? NIEBLA.alfaVisible
      : (explorado[posicion]! & mascara) !== 0
        ? NIEBLA.alfaRecordado
        : NIEBLA.alfaSinVer;

    const p = i * 4;
    img.data[p] = r;
    img.data[p + 1] = g;
    img.data[p + 2] = b;
    img.data[p + 3] = alfa;
  }
  cctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(capa, 0, 0, columnas * tamanoCelda * escalaCanvas, filas * tamanoCelda * escalaCanvas);
  ctx.restore();
}

// --- RENDER BASE DEL TERRENO (Cacheable) ---
const RES_BIOMA = 128;
const ESCALA_RELIEVE = 350;

function hexToRgb(hex: string): readonly [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const BIOMA_RGB_SIMPLE: Record<string, readonly [number, number, number]> = Object.fromEntries(
  Object.entries(BIOMA_COLOR_SIMPLE).map(([k, v]) => [k, hexToRgb(v)])
);

function pintarBiomas(mapa: MapaGenerado): HTMLCanvasElement {
  const capa = document.createElement('canvas');
  capa.width = RES_BIOMA;
  capa.height = RES_BIOMA;
  const cctx = capa.getContext('2d')!;
  const img = cctx.createImageData(RES_BIOMA, RES_BIOMA);
  const paso = mapa.config.ancho / RES_BIOMA;

  for (let fila = 0; fila < RES_BIOMA; fila++) {
    for (let col = 0; col < RES_BIOMA; col++) {
      const punto = { x: (col + 0.5) * paso, y: (fila + 0.5) * paso };
      const bioma = evaluarBioma(mapa.elevacion, mapa.fertilidad, mapa.rios, punto);
      const [r, g, b] = BIOMA_RGB_SIMPLE[bioma] || [0, 0, 0];
      const i = (fila * RES_BIOMA + col) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  cctx.putImageData(img, 0, 0);
  return capa;
}

function aplicarSombreado(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, mapa: MapaGenerado): void {
  const ancho = canvas.width;
  const alto = canvas.height;
  const paso = mapa.config.ancho / ancho;

  const alturas = new Float64Array(ancho * alto);
  for (let fila = 0; fila < alto; fila++) {
    const y = (fila + 0.5) * paso;
    for (let col = 0; col < ancho; col++) {
      alturas[fila * ancho + col] = evaluarElevacion(mapa.elevacion, { x: (col + 0.5) * paso, y }) * ESCALA_RELIEVE;
    }
  }

  const luzX = -0.5;
  const luzY = -0.5;
  const luzZ = Math.SQRT1_2;
  const lambertPlano = luzZ;

  const img = ctx.getImageData(0, 0, ancho, alto);
  const datos = img.data;

  for (let fila = 0; fila < alto; fila++) {
    const arriba = Math.max(0, fila - 1) * ancho;
    const abajo = Math.min(alto - 1, fila + 1) * ancho;
    const actual = fila * ancho;
    for (let col = 0; col < ancho; col++) {
      const dzdx = (alturas[actual + Math.min(ancho - 1, col + 1)]! - alturas[actual + Math.max(0, col - 1)]!) / (2 * paso);
      const dzdy = (alturas[abajo + col]! - alturas[arriba + col]!) / (2 * paso);
      const longitud = Math.hypot(dzdx, dzdy, 1);
      const lambert = Math.max(0, (-dzdx * luzX - dzdy * luzY + luzZ) / longitud);
      const factor = Math.max(0.35, lambert / lambertPlano);

      const i = (actual + col) * 4;
      datos[i] = Math.min(255, datos[i]! * factor);
      datos[i + 1] = Math.min(255, datos[i + 1]! * factor);
      datos[i + 2] = Math.min(255, datos[i + 2]! * factor);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// --- RENDER PRINCIPAL DEL MAPA DEL MUNDO ---

export function pintarTerreno(
  ctx: CanvasRenderingContext2D, 
  mapa: MapaGenerado, 
  proyeccion: ProyeccionJugador,
  escalaCanvas: number
): void {
  const width = mapa.config.ancho * escalaCanvas;
  const height = mapa.config.alto * escalaCanvas;

  // 1. DIBUJAR TERRENO BASE
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(pintarBiomas(mapa), 0, 0, width, height);
  aplicarSombreado(ctx, ctx.canvas, mapa);

  // 2. DIBUJAR BOSQUES
  // Bosques como silueta fusionada (no círculos sueltos), debajo de los ríos — mismo criterio de capas que
  // el cliente de administración. `nonzero` (el relleno por defecto de canvas) recorta solos los claros que
  // queden encerrados por una corona de bosques, porque `contornosBosques` los devuelve como lazo opuesto.
  ctx.fillStyle = 'rgba(27, 94, 32, 0.55)';
  const lazosBosque = contornosBosques(mapa.bosques, mapa.config.ancho);
  if (lazosBosque.length > 0) {
    ctx.beginPath();
    for (const lazo of lazosBosque) {
      if (lazo.length < 3) continue;
      ctx.moveTo(lazo[0]!.x * escalaCanvas, lazo[0]!.y * escalaCanvas);
      for (const p of lazo.slice(1)) ctx.lineTo(p.x * escalaCanvas, p.y * escalaCanvas);
      ctx.closePath();
    }
    ctx.fill('nonzero');
  }

  // Árboles con semilla determinista para conservar el detalle visual y la densidad de cada bosque.
  ctx.fillStyle = 'rgba(22, 62, 24, 0.9)';
  for (const bosque of mapa.bosques) {
    const cx = bosque.centro.x * escalaCanvas;
    const cy = bosque.centro.y * escalaCanvas;
    const radioPx = bosque.radio * escalaCanvas;
    const rand = mulberry32(hashSemilla(bosque.id));
    const numArboles = Math.round(Math.min(60, Math.max(4, (radioPx * radioPx * bosque.densidad) / 22)));
    for (let i = 0; i < numArboles; i++) {
      const angulo = rand() * Math.PI * 2;
      const r = radioPx * Math.sqrt(rand());
      dibujarGlifoArbol(ctx, cx + Math.cos(angulo) * r, cy + Math.sin(angulo) * r, 2.2);
    }
  }

  // 3. DIBUJAR RÍOS
  ctx.strokeStyle = 'rgba(38, 90, 145, 0.9)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const rio of mapa.rios) {
    if (rio.puntos.length < 2) continue;
    ctx.lineWidth = rio.navegable ? 5 : 2.5;
    ctx.beginPath();
    rio.puntos.forEach((p, i) => {
      const x = p.x * escalaCanvas;
      const y = p.y * escalaCanvas;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // 4. DIBUJAR NODOS DE RECURSOS
  for (const nodo of mapa.nodos) {
    ctx.beginPath();
    ctx.arc(nodo.posicion.x * escalaCanvas, nodo.posicion.y * escalaCanvas, 3, 0, Math.PI * 2);
    ctx.fillStyle = RECURSO_COLOR[nodo.tipo] || '#fff';
    ctx.fill();
  }

  // ---------------------------------------------------------------------------------------------------
  // A PARTIR DE AQUI, EL ORDEN DE CAPAS ES LA NIEBLA DE GUERRA, no una preferencia estetica.
  //
  // Lo que se pinta ANTES de la mascara queda tapado donde nunca se estuvo y oscurecido donde solo se
  // recuerda; lo que se pinta DESPUES se ve tal cual. Asi que el criterio es:
  //
  //   - Antes  -> geografia y lo que solo se RECUERDA. Un camino o un campamento en tierra que no has
  //               pisado no puede verse, y uno en tierra que viste hace rato se ve como se ve todo lo demas
  //               de esa zona: a media luz.
  //   - Despues -> lo tuyo y lo que estas VIENDO ahora mismo. El servidor ya se ha encargado de que aqui no
  //               llegue nada que no puedas ver, asi que taparlo seria taparte tu propia informacion.
  //
  // Mover una capa de un lado al otro cambia lo que el jugador sabe. No es refactor.
  // ---------------------------------------------------------------------------------------------------

  // 5. CAMINOS COMERCIALES (infraestructura del mundo, bajo la niebla)
  ctx.strokeStyle = 'rgba(139, 90, 43, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  for (const camino of proyeccion.caminos || []) {
    if (camino.puntos.length < 2) continue;
    ctx.beginPath();
    camino.puntos.forEach((p, i) => {
      const x = p.x * escalaCanvas;
      const y = p.y * escalaCanvas;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 6. CAMPAMENTOS DE BANDIDOS (diamantes rojos). Van BAJO la niebla: hoy la proyeccion los manda todos, sin
  // filtrar por visibilidad, asi que dibujarlos por encima pondria diamantes flotando sobre tierra que el
  // jugador no ha pisado. Taparlos aqui es lo correcto de PRESENTACION; que ademas no viajen es cosa del
  // servidor y esta anotado aparte.
  for (const campamento of proyeccion.campamentosBandidos || []) {
    const x = campamento.posicion.x * escalaCanvas;
    const y = campamento.posicion.y * escalaCanvas;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = '#8b1a1a';
    ctx.fill();
    ctx.strokeStyle = '#1b1a17';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 7. ASENTAMIENTOS RECORDADOS: los que se vieron alguna vez y ahora no se ven. Huecos, y debajo de la
  // mascara para que les caiga el filtro oscuro — que es exactamente lo que son, informacion de anoche.
  for (const conocido of proyeccion.asentamientosConocidos || []) {
    dibujarAsentamiento(
      ctx,
      conocido.posicion.x * escalaCanvas,
      conocido.posicion.y * escalaCanvas,
      faccionColor(conocido.faccionId, proyeccion.facciones),
      false
    );
  }

  // 8. >>> LA NIEBLA <<<
  if (proyeccion.exploracion) pintarNiebla(ctx, proyeccion.exploracion, escalaCanvas);

  // 9. ZONAS DE INFLUENCIA FUSIONADAS (solo la propia)
  for (const zona of proyeccion.zonasFusionadas || []) {
    if (zona.contornos.length === 0) continue;
    const color = faccionColor(zona.faccionId, proyeccion.facciones);
    ctx.beginPath();
    for (const contorno of zona.contornos) {
      contorno.forEach((p, i) => {
        const x = p.x * escalaCanvas;
        const y = p.y * escalaCanvas;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fillStyle = color + '33'; // 20% alpha hex
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 10. EDIFICIOS DEL MAPA (Minas, Canteras...) — solo de asentamientos propios
  const tamanoEdificio = 6;
  for (const asentamiento of proyeccion.asentamientos || []) {
    for (const edificio of asentamiento.edificios || []) {
      if ((edificio.ambito ?? 'asentamiento') !== 'mapa') continue;
      const x = edificio.posicion.x * escalaCanvas;
      const y = edificio.posicion.y * escalaCanvas;
      const color = EDIFICIO_COLOR[edificio.tipo] || '#fff';

      ctx.lineWidth = 1;
      ctx.strokeStyle = color;

      if (edificio.estado === 'activo') {
        ctx.fillStyle = color;
        ctx.fillRect(x - tamanoEdificio / 2, y - tamanoEdificio / 2, tamanoEdificio, tamanoEdificio);
      } else if (edificio.estado === 'en_construccion') {
        ctx.fillStyle = color + '88';
        ctx.fillRect(x - tamanoEdificio / 2, y - tamanoEdificio / 2, tamanoEdificio, tamanoEdificio);
        ctx.strokeRect(x - tamanoEdificio / 2, y - tamanoEdificio / 2, tamanoEdificio, tamanoEdificio);
      } else {
        ctx.strokeRect(x - tamanoEdificio / 2, y - tamanoEdificio / 2, tamanoEdificio, tamanoEdificio);
      }
    }
  }

  // 11. ASENTAMIENTOS PROPIOS
  for (const asentamiento of proyeccion.asentamientos || []) {
    dibujarAsentamiento(
      ctx,
      asentamiento.posicion.x * escalaCanvas,
      asentamiento.posicion.y * escalaCanvas,
      faccionColor(asentamiento.faccionId, proyeccion.facciones),
      true
    );
  }

  // 12. ASENTAMIENTOS AVISTADOS: los ajenos que se ven AHORA. Mismo glifo relleno que los propios —es la
  // misma clase de cosa y el color de su Faccion ya dice que no es tuya—, a diferencia de los recordados,
  // que van huecos. Lo que llega de ellos es su ficha y nada mas: la redaccion la hizo el servidor.
  for (const avistado of proyeccion.asentamientosAvistados || []) {
    dibujarAsentamiento(
      ctx,
      avistado.posicion.x * escalaCanvas,
      avistado.posicion.y * escalaCanvas,
      faccionColor(avistado.faccionId, proyeccion.facciones),
      true
    );
  }

  // 13. RUTAS EN TRÁNSITO (Rastros tenues)
  ctx.strokeStyle = 'rgba(241, 230, 200, 0.35)';
  ctx.lineWidth = 1.5;
  for (const caravana of proyeccion.caravanas || []) {
    if (!caravana.ruta || caravana.ruta.length < 2) continue;
    ctx.beginPath();
    caravana.ruta.forEach((p, i) => {
      const x = p.x * escalaCanvas;
      const y = p.y * escalaCanvas;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // 14. CARAVANAS (Triángulos identificables por color de origen)
  for (const caravana of proyeccion.caravanas || []) {
    const x = caravana.posicionActual.x * escalaCanvas;
    const y = caravana.posicionActual.y * escalaCanvas;

    const origenCaravana = proyeccion.asentamientos.find((a) => a.id === caravana.origenAsentamientoId);
    const color = origenCaravana ? faccionColor(origenCaravana.faccionId, proyeccion.facciones) : '#f1e6c8';

    const r = 4.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1b1a17';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 15. EJERCITOS PROPIOS: rastro de su ruta, igual que las caravanas
  ctx.strokeStyle = 'rgba(241, 230, 200, 0.35)';
  ctx.lineWidth = 1.5;
  for (const ejercito of proyeccion.ejercitos || []) {
    // Estacionado acampo: no tiene trayecto pendiente que ensenar. Marchando y regresando si.
    if (ejercito.estado === 'estacionado' || !ejercito.ruta || ejercito.ruta.length < 2) continue;
    ctx.beginPath();
    ejercito.ruta.forEach((p, i) => {
      const x = p.x * escalaCanvas;
      const y = p.y * escalaCanvas;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // 16. EJERCITOS (racimos de rombos, uno por jugador de la columna)
  for (const ejercito of proyeccion.ejercitos || []) {
    // El color sale del asentamiento de ORIGEN, como en las caravanas, con `faccionId` de reserva por si ese
    // asentamiento ya no existe (a un ejercito se le puede caer la ciudad de la que salio).
    const origen = proyeccion.asentamientos.find((a) => a.id === ejercito.origenAsentamientoId);
    const color = faccionColor(origen ? origen.faccionId : ejercito.faccionId, proyeccion.facciones);
    const participantes = new Set((ejercito.escuadrones || []).map((e) => e.jugadorId)).size;
    dibujarRacimoDeRombos(
      ctx,
      ejercito.posicionActual.x * escalaCanvas,
      ejercito.posicionActual.y * escalaCanvas,
      participantes,
      color
    );
  }

  // 17. EJERCITOS AVISTADOS: los ajenos que se ven ahora mismo (Doc 5.12.7). Mismo glifo que los propios —
  // es la misma clase de cosa— y el color de su Faccion ya dice que no es tuyo. Sin rastro de ruta, y no por
  // simplificar: su ruta NO viaja en la proyeccion, porque seria leerle el plan de campana. Que no dejen
  // estela es exactamente lo que se sabe de ellos.
  //
  // Y sin memoria, a diferencia de los asentamientos: de un ejercito no se guarda "ultimo conocido". Tiene
  // sentido — una ciudad sigue donde estaba, una columna en marcha no.
  for (const avistado of proyeccion.ejercitosAvistados || []) {
    dibujarRacimoDeRombos(
      ctx,
      avistado.posicionActual.x * escalaCanvas,
      avistado.posicionActual.y * escalaCanvas,
      avistado.participantes,
      faccionColor(avistado.faccionId, proyeccion.facciones)
    );
  }
}

export function pintarPrevisualizacionFundacion(
  ctx: CanvasRenderingContext2D,
  mapa: MapaGenerado,
  posicion: Point,
  escalaCanvas: number
): void {
  const x = posicion.x * escalaCanvas;
  const y = posicion.y * escalaCanvas;
  const radio = 30 * escalaCanvas;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(200, 170, 110, 0.18)';
  ctx.fill();
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = '#f1d38b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#f1d38b';
  ctx.fill();
  ctx.strokeStyle = '#1b1a17';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const radioCuadrado = 30 * 30;
  for (const nodo of mapa.nodos) {
    const dx = nodo.posicion.x - posicion.x;
    const dy = nodo.posicion.y - posicion.y;
    if (dx * dx + dy * dy > radioCuadrado) continue;

    const nodoX = nodo.posicion.x * escalaCanvas;
    const nodoY = nodo.posicion.y * escalaCanvas;
    ctx.beginPath();
    ctx.arc(nodoX, nodoY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 235, 150, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#5a3d16';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#1b1a17';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodo.tipo, nodoX + 11, nodoY);
  }
  ctx.restore();
}

// --- RENDER DE LA VISTA DE ASENTAMIENTO (CIUDAD) ---

const BIOMA_TIERRA_PLANA = '#93c26b';

/** Pinta tiradas de celda como ÁREAS rellenas — la calle/camino ocupa suelo, no es una línea (Etapa 6). */
function dibujarAreas(
  ctx: CanvasRenderingContext2D,
  tiradas: RectanguloLocal[],
  aPantalla: (p: Point) => Point,
  escala: number,
  color: string
): void {
  if (!tiradas || tiradas.length === 0) return;
  ctx.fillStyle = color;
  for (const t of tiradas) {
    const esquina = aPantalla({ x: t.x, y: t.y });
    ctx.fillRect(esquina.x, esquina.y, t.ancho * escala, t.alto * escala);
  }
}

/**
 * Pinta los recintos de muralla — mismo criterio visual que el laboratorio del motor
 * (`lab/src/render.ts`): sólido y contorno continuo lo YA LEVANTADO, translúcido y punteado en rojo lo
 * PLANIFICADO (ya ocupa suelo, todavía no está en pie — Paso 2b del doc de murallas: dibujarlo como césped
 * vacío es el peor bug posible, el que parece del motor y es una omisión del dibujo). Puertas en ocre (el
 * dato irreversible del trazo), torres más oscuras (lectura visual del nivel).
 */
function dibujarMurallas(
  ctx: CanvasRenderingContext2D,
  murallas: TrazadoMuralla[],
  aPantalla: (p: Point) => Point,
  escala: number
): void {
  const pintar = (rects: RectanguloLocal[], relleno: string, borde: string): void => {
    if (!rects || rects.length === 0) return;
    ctx.fillStyle = relleno;
    ctx.strokeStyle = borde;
    ctx.lineWidth = 1;
    for (const r of rects) {
      const esquina = aPantalla({ x: r.x, y: r.y });
      const w = r.ancho * escala;
      const h = r.alto * escala;
      ctx.fillRect(esquina.x, esquina.y, w, h);
      ctx.strokeRect(esquina.x, esquina.y, w, h);
    }
  };
  for (const muralla of murallas || []) {
    ctx.setLineDash([3, 2]);
    pintar(muralla.planificado, 'rgba(90, 90, 90, 0.30)', 'rgba(200, 40, 40, 0.95)');
    ctx.setLineDash([]);
    pintar(muralla.muro, 'rgba(90, 90, 90, 0.95)', 'rgba(20, 20, 20, 1)');
    pintar(muralla.torres, 'rgba(45, 45, 45, 1)', 'rgba(10, 10, 10, 1)');
    pintar(muralla.puertas, 'rgba(214, 158, 46, 1)', 'rgba(120, 84, 10, 1)');
  }
}

function dibujarEdificioLocal(
  ctx: CanvasRenderingContext2D,
  edificio: Edificio,
  huella: { x: number; y: number; ancho: number; alto: number }
): void {
  const color = EDIFICIO_COLOR[edificio.tipo] || '#999';
  const esCentro = edificio.tipo === 'centroUrbano';
  const margen = Math.min(1.5, huella.ancho * 0.12, huella.alto * 0.12);
  const x = huella.x + margen;
  const y = huella.y + margen;
  const ancho = Math.max(2, huella.ancho - margen * 2);
  const alto = Math.max(2, huella.alto - margen * 2);

  ctx.lineWidth = esCentro ? 2 : 1.4;
  ctx.strokeStyle = esCentro ? '#1b1a17' : color;
  if (edificio.estado === 'activo') {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, ancho, alto);
    if (esCentro) ctx.strokeRect(x, y, ancho, alto);
  } else if (edificio.estado === 'en_construccion') {
    ctx.fillStyle = color + '88';
    ctx.fillRect(x, y, ancho, alto);
    ctx.strokeRect(x, y, ancho, alto);
  } else {
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(x, y, ancho, alto);
    ctx.setLineDash([]);
  }
}

export function pintarAsentamiento(
  ctx: CanvasRenderingContext2D,
  asentamiento: Asentamiento,
  trazado: TrazadoAsentamiento | undefined
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Fondo verde llano
  ctx.fillStyle = BIOMA_TIERRA_PLANA;
  ctx.fillRect(0, 0, width, height);

  const radioMapa = 60; // Constante estática
  const tamanoCelda = 5;
  const usable = width * 0.92;
  const escala = usable / (radioMapa * 4);
  const cx = width / 2;
  const cy = height / 2;
  const aPantalla = (p: Point): Point => ({ x: cx + p.x * escala, y: cy + p.y * escala });

  // Cuadrícula de fondo
  ctx.strokeStyle = 'rgba(27, 26, 23, 0.08)';
  ctx.lineWidth = 1;
  const pasoPantalla = tamanoCelda * escala;
  const celdasX = Math.ceil(cx / pasoPantalla) + 1;
  const celdasY = Math.ceil(cy / pasoPantalla) + 1;
  ctx.beginPath();
  for (let i = -celdasX; i <= celdasX; i++) {
    const x = cx + i * pasoPantalla;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let j = -celdasY; j <= celdasY; j++) {
    const y = cy + j * pasoPantalla;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  if (!trazado) {
    ctx.fillStyle = '#1b1a17';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`Asentamiento (${asentamiento.id}) · Criterio T2a`, 12, height - 24);
    return;
  }

  // Trazados
  dibujarAreas(ctx, trazado.caminos, aPantalla, escala, 'rgba(140, 118, 88, 0.55)');
  dibujarAreas(ctx, trazado.calles, aPantalla, escala, 'rgba(120, 92, 58, 0.75)');

  // Edificios internos
  const internos = (asentamiento.edificios || []).filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa');
  const enPantalla = (id: string) => {
    const huella = trazado.huellas[id];
    if (!huella) return null;
    const origen = aPantalla({ x: huella.x, y: huella.y });
    return { x: origen.x, y: origen.y, ancho: huella.ancho * escala, alto: huella.alto * escala };
  };

  for (const edificio of [...internos.filter((e) => e.tipo === 'vivienda'), ...internos.filter((e) => e.tipo !== 'vivienda')]) {
    const huella = enPantalla(edificio.id);
    if (huella) dibujarEdificioLocal(ctx, edificio, huella);
  }

  // Muralla ENCIMA de todo: es lo que hay que juzgar de un vistazo (Consideraciones/Murallas_Definicion.md).
  dibujarMurallas(ctx, trazado.murallas, aPantalla, escala);

  // Texto
  ctx.fillStyle = '#1b1a17';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Asentamiento · Nivel ${asentamiento.nivel}`, 12, height - 24);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#4a4436';
  ctx.fillText('Vista de asentamiento (ciudad) · minas y cantera pertenecen a la región (mapa general)', 12, height - 8);
}
