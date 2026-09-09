import {
  ApiError,
  cargarSesionLocal,
  cerrarSesion,
  consultarProyeccion,
  ejecutarComando,
  guardarSesionLocal,
  loginConClave,
  registrarCuenta,
  obtenerMapa,
  unirseAPartida,
  type ProyeccionJugador,
} from './apiCliente';
import { edificioBajoCursor, pintarAsentamiento, pintarPrevisualizacionFundacion, pintarTerreno } from './render';
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from './paletas';
import type { Asentamiento, Edificio } from './tiposDominio';
import type { MapaGenerado } from './terreno';
import { estadoCliente, TIPS_FUNDACION } from './ui/estadoCliente';
import { actualizarTip, resumenRecursosFundacion } from './ui/pestanaAsentamientos';
import { renderPanelInteraccion } from './ui/panelInteraccion';
import { renderPanelMapa } from './ui/panelMapa';
import { renderPestanaFaccion } from './ui/pestanaFaccion';
import { instalarZoomPan, type ControlMapa } from './ui/pantallaMapa';

const app = document.querySelector<HTMLDivElement>('#app')!;

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>'"]/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[caracter] ?? caracter);
}

function mensajeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operación.';
}

function sincronizarEstado(): void {
  Object.assign(estadoCliente, {
    usuarioActivo: estadoCliente.usuarioActivo,
    gameIdActivo: estadoCliente.gameIdActivo,
    mapaCache: estadoCliente.mapaCache,
    modoVista: estadoCliente.modoVista,
    proyeccionUltima: estadoCliente.proyeccionUltima,
    modoPanelFaccion: estadoCliente.modoPanelFaccion,
    pestanaInteraccion: estadoCliente.pestanaInteraccion,
    modoFundacionActivo: estadoCliente.modoFundacionActivo,
    posicionFundacion: estadoCliente.posicionFundacion,
    puntoFundacionFijado: estadoCliente.puntoFundacionFijado,
    indiceTip: estadoCliente.indiceTip,
  });
}

function cambiarPestana(pestana: typeof estadoCliente.pestanaInteraccion): void {
  estadoCliente.pestanaInteraccion = pestana;
  estadoCliente.modoFundacionActivo = false;
  estadoCliente.posicionFundacion = null;
  estadoCliente.puntoFundacionFijado = false;
  sincronizarEstado();
  if (estadoCliente.proyeccionUltima) {
    renderizarPanelInteraccion(estadoCliente.proyeccionUltima);
    actualizarModoFundacion(estadoCliente.proyeccionUltima);
  }
}

/** Ejecuta un comando de muralla y refresca; devuelve el mensaje de error si lo rechaza, o `null` si fue bien.
 * Las tres acciones (comprometer/abandonar/mejorar, Consideraciones/Murallas_Definicion.md) comparten esta
 * misma forma — a diferencia de crear/unirse a Facción (arriba), que solo se usan una vez cada una y no
 * justificaban factorizar el try/catch. */
async function ejecutarAccionMuralla(tipo: string, params: Record<string, unknown>): Promise<string | null> {
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, tipo, params);
    if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'El servidor rechazó la operación.');
    await refrescarDatosJuego();
    return null;
  } catch (err) {
    return mensajeError(err);
  }
}

/** Cablea los botones de la pestaña Muralla (`ui/pestanaMuralla.ts`) tras cada render — mismo `#wall-error`
 * para las tres acciones, y el `asentamientoId` viaja en `data-asentamiento-id` del `.wall-panel` que las
 * envuelve, no en cada botón (uno solo por asentamiento en vista, no hace falta repetirlo). */
function cablearAccionesMuralla(panel: HTMLDivElement): void {
  const wallPanel = panel.querySelector<HTMLElement>('.wall-panel');
  const asentamientoId = wallPanel?.dataset.asentamientoId;
  const error = panel.querySelector<HTMLParagraphElement>('#wall-error');
  if (!wallPanel || !asentamientoId) return;

  // `paramsAlClic` se evalúa DENTRO del listener, nunca al cablear: el selector de nivel puede cambiar entre
  // que se pinta el panel y que se pulsa el botón, y capturar su `.value` al cablear mandaría un nivel viejo.
  const conBoton = (boton: HTMLButtonElement, tipo: string, paramsAlClic: () => Record<string, unknown>): void => {
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const mensaje = await ejecutarAccionMuralla(tipo, { asentamientoId, ...paramsAlClic() });
      if (mensaje) {
        boton.disabled = false;
        if (error) error.textContent = mensaje;
      }
    });
  };

  const btnComprometer = wallPanel.querySelector<HTMLButtonElement>('#btn-muralla-comprometer');
  if (btnComprometer) {
    const nivelSelect = wallPanel.querySelector<HTMLSelectElement>('#select-muralla-nivel');
    conBoton(btnComprometer, 'comprometerRecinto', () => ({ cargo: btnComprometer.dataset.cargo, nivel: Number(nivelSelect?.value ?? 1) }));
  }
  wallPanel.querySelectorAll<HTMLButtonElement>('[data-abandonar-recinto]').forEach((boton) => {
    conBoton(boton, 'abandonarRecinto', () => ({ recintoId: boton.dataset.abandonarRecinto }));
  });
  wallPanel.querySelectorAll<HTMLButtonElement>('[data-mejorar-recinto]').forEach((boton) => {
    conBoton(boton, 'mejorarRecinto', () => ({ cargo: boton.dataset.cargo, recintoId: boton.dataset.mejorarRecinto }));
  });
}

/** Cablea el flujo crear/unirse a Facción sobre cualquier contenedor que lleve el HTML de
 * `renderPestanaFaccion` (`ui/pestanaFaccion.ts`): lo usan el panel legacy y la pantalla Facción a pantalla
 * completa (`montarFaccion`). `rerender` repinta ese contenedor tras un cambio de modo (inicio/crear/unirse);
 * un crear/unir con éxito va por `refrescarDatosJuego`, que reencamina a otra pantalla. */
function cablearFaccion(root: ParentNode, proyeccion: ProyeccionJugador, rerender: () => void): void {
  root.querySelector('#btn-crear-faccion')?.addEventListener('click', () => { estadoCliente.modoPanelFaccion = 'crear'; rerender(); });
  root.querySelector('#btn-unirse-faccion')?.addEventListener('click', () => { estadoCliente.modoPanelFaccion = 'unirse'; rerender(); });
  root.querySelector('#btn-volver-faccion')?.addEventListener('click', () => { estadoCliente.modoPanelFaccion = 'inicio'; rerender(); });

  const form = root.querySelector<HTMLFormElement>('#form-crear-faccion');
  form?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const input = root.querySelector<HTMLInputElement>('#input-nombre-faccion');
    const boton = root.querySelector<HTMLButtonElement>('#btn-submit-crear-faccion');
    const error = root.querySelector<HTMLParagraphElement>('#error-faccion');
    if (!input || !boton) return;
    boton.disabled = true;
    boton.textContent = 'Creando...';
    try {
      const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'crearFaccion', { nombre: input.value.trim() });
      if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'El servidor rechazó la operación.');
      estadoCliente.modoPanelFaccion = 'inicio';
      estadoCliente.pestanaInteraccion = 'asentamientos';
      await refrescarDatosJuego();
    } catch (err) {
      boton.disabled = false;
      boton.textContent = 'Crear facción';
      if (error) error.textContent = mensajeError(err);
    }
  });

  const lista = root.querySelector<HTMLDivElement>('#lista-facciones');
  const busqueda = root.querySelector<HTMLInputElement>('#input-buscar-faccion');
  if (lista && busqueda) {
    const pintarLista = (): void => {
      const termino = busqueda.value.trim().toLowerCase();
      const facciones = proyeccion.facciones.filter((faccion) => faccion.nombre.toLowerCase().includes(termino));
      lista.innerHTML = facciones.length > 0 ? facciones.map((faccion) => `<div class="faction-list-item"><div><strong>${escaparHtml(faccion.nombre)}</strong><span>Nivel ${faccion.nivel}</span></div><button class="btn-join-faction" type="button" data-faccion-id="${escaparHtml(faccion.id)}">Unirse</button></div>`).join('') : '<p class="faction-empty-list">No hay facciones que coincidan.</p>';
      lista.querySelectorAll<HTMLButtonElement>('.btn-join-faction').forEach((boton) => boton.addEventListener('click', async () => {
        boton.disabled = true;
        boton.textContent = 'Uniendo...';
        try {
          const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'unirseAFaccion', { faccionId: boton.dataset.faccionId });
          if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'El servidor rechazó la operación.');
          await refrescarDatosJuego();
        } catch (err) {
          boton.disabled = false;
          boton.textContent = 'Unirse';
          const aviso = document.createElement('p');
          aviso.className = 'faction-error';
          aviso.textContent = mensajeError(err);
          boton.parentElement?.appendChild(aviso);
        }
      }));
    };
    busqueda.addEventListener('input', pintarLista);
    pintarLista();
  }
}

/** Pantalla FACCIÓN a pantalla completa (T2): tarjeta central sobre el fondo de la app, con el flujo
 * crear/unirse. Se llega solo con `faccionId === null`; un crear/unir con éxito reencamina (router). */
function montarFaccion(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) { montar('cargando'); return; }
  app.innerHTML = `<div class="login-container"><div class="login-card">${renderPestanaFaccion(proyeccion, escaparHtml)}</div><button id="btn-logout" class="text-link" type="button">Cerrar sesión</button></div>`;
  document.querySelector('#btn-logout')?.addEventListener('click', () => cerrarSesionYVolverALogin());
  cablearFaccion(app, proyeccion, montarFaccion);
}

/** La columna en la que MARCHA el jugador (Doc 5.12.2) — su posición en el mundo. `undefined` mientras esté
 * en una plaza o desconectado. */
function miColumna(proyeccion: ProyeccionJugador) {
  return proyeccion.ejercitos.find(
    (ejercito) =>
      (ejercito.participantes ?? []).some((p) => p.jugadorId === proyeccion.jugadorId) ||
      ejercito.escuadrones.some((e) => e.jugadorId === proyeccion.jugadorId)
  );
}

// --- MOVIMIENTO Y SELECCIÓN EN EL MAPA (T4) -------------------------------------------------------

interface AsentamientoEnMapa {
  id: string;
  nombre?: string;
  faccionId: string;
  nivel: number;
  posicion: { x: number; y: number };
  /** Instante en que se vio por última vez, o `null` si se está viendo ahora. */
  recordado: number | null;
}

/** Los asentamientos que hay en la proyección con posición en el mapa: los avistados (en vivo) y los
 * recordados (última foto). Los propios llegan por una de esas dos listas cuando no se está dentro. */
function asentamientosDelMapa(proyeccion: ProyeccionJugador): AsentamientoEnMapa[] {
  return [
    ...proyeccion.asentamientosAvistados.map((a) => ({ id: a.id, nombre: a.nombre, faccionId: a.faccionId, nivel: a.nivel, posicion: a.posicion, recordado: null })),
    ...proyeccion.asentamientosConocidos.map((a) => ({ id: a.asentamientoId, nombre: a.nombre, faccionId: a.faccionId, nivel: a.nivel, posicion: a.posicion, recordado: a.conocidoEn })),
  ];
}

/** El asentamiento más cercano al punto de mapa clicado dentro de un radio de agarre, o `null`. */
function asentamientoCercaDe(punto: { x: number; y: number }, proyeccion: ProyeccionJugador): AsentamientoEnMapa | null {
  const RADIO = 45; // unidades de mundo — un pelo más que el glifo del asentamiento
  let mejor: AsentamientoEnMapa | null = null;
  let mejorDist = RADIO * RADIO;
  for (const asentamiento of asentamientosDelMapa(proyeccion)) {
    const dx = asentamiento.posicion.x - punto.x;
    const dy = asentamiento.posicion.y - punto.y;
    const dist = dx * dx + dy * dy;
    if (dist < mejorDist) { mejor = asentamiento; mejorDist = dist; }
  }
  return mejor;
}

/** Punto de MUNDO bajo un clic: `getBoundingClientRect` del canvas ya incluye el `transform` del zoom/pan. */
function puntoDeMapa(evento: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, mapa: MapaGenerado): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evento.clientX - rect.left) / rect.width) * mapa.config.ancho,
    y: ((evento.clientY - rect.top) / rect.height) * mapa.config.alto,
  };
}

/** Asentamiento seleccionado en el mapa (abre el panel de Selección). Fuera del `estadoCliente` porque solo
 * vive mientras la pantalla Mapa está montada. */
let seleccionMapa: { id: string } | null = null;
let avisoMapaTimer: ReturnType<typeof setTimeout> | undefined;

function avisoMapa(texto: string): void {
  const el = document.querySelector<HTMLElement>('.mapa-aviso');
  if (!el) return;
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisoMapaTimer);
  avisoMapaTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

async function marcharAObjetivo(objetivo: { tipo: 'punto'; punto: { x: number; y: number } } | { tipo: 'asentamiento'; id: string }): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'marcharA', { jugadorId: proyeccion.jugadorId, objetivo });
    if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'El servidor rechazó la marcha.');
    await refrescarDatosJuego();
  } catch (err) {
    avisoMapa(mensajeError(err));
  }
}

/** Repinta el panel de Selección según `seleccionMapa`. Se llama al montar el Mapa y en cada refresco (para
 * que "Entrar" refleje si la columna ya llegó a la puerta — el backend es quien de verdad lo valida). */
function renderSeleccionMapa(): void {
  const cont = document.querySelector<HTMLElement>('.mapa-seleccion');
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!cont) return;
  const asentamiento = seleccionMapa && proyeccion
    ? asentamientosDelMapa(proyeccion).find((a) => a.id === seleccionMapa!.id)
    : undefined;
  if (!asentamiento || !proyeccion) {
    seleccionMapa = null;
    cont.hidden = true;
    cont.innerHTML = '';
    return;
  }
  const faccion = proyeccion.facciones.find((f) => f.id === asentamiento.faccionId);
  const propio = asentamiento.faccionId === proyeccion.faccionId;
  cont.hidden = false;
  cont.innerHTML = `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${propio ? 'Tu asentamiento' : 'Asentamiento'}${asentamiento.recordado !== null ? ' · recordado' : ''}</span>
    <h3>${escaparHtml(asentamiento.nombre ?? asentamiento.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Facción</span><strong>${escaparHtml(faccion?.nombre ?? asentamiento.faccionId)}</strong></div>
      <div><span>Nivel</span><strong>${asentamiento.nivel}</strong></div>
      ${asentamiento.recordado !== null ? `<div><span>Visto</span><strong>${escaparHtml(fechaDeMundo(asentamiento.recordado))}</strong></div>` : ''}
    </div>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-entrar-asent" class="btn-primary" type="button">Entrar</button>
    </div>
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'asentamiento', id: asentamiento.id }));
  cont.querySelector('#btn-entrar-asent')?.addEventListener('click', async () => {
    try {
      const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'entrarEnAsentamiento', { asentamientoId: asentamiento.id, jugadorId: proyeccion.jugadorId });
      if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'No se pudo entrar.');
      seleccionMapa = null;
      await refrescarDatosJuego(); // si entró, el router lleva a la pantalla Asentamiento
    } catch (err) {
      const error = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
      if (error) error.textContent = mensajeError(err);
    }
  });
}

// --- RIEL DE ICONOS Y MENÚ DE ESQUINA DEL MAPA (T5) ---------------------------------------------

type PanelRiel = 'faccion' | 'cosas' | 'fundar';
let panelMapaAbierto: PanelRiel | null = null;
let menuEsquinaAbierto = false;
let controlMapaActivo: ControlMapa | null = null;

/** ¿Tiene el jugador algún asentamiento propio a la vista o en memoria? Sirve para destacar el icono de
 * Fundar mientras aún no tiene ninguno (no es el gate real: eso lo decide el backend). */
function tieneAsentamientoPropio(proyeccion: ProyeccionJugador): boolean {
  return asentamientosDelMapa(proyeccion).some((a) => a.faccionId === proyeccion.faccionId);
}

async function fundarAqui(): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'fundarAsentamiento', { faccionId: proyeccion.faccionId });
    if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'No se pudo fundar aquí.');
    estadoCliente.modoFundacionActivo = false;
    estadoCliente.posicionFundacion = null;
    panelMapaAbierto = null;
    await refrescarDatosJuego(); // fundar te deja DENTRO: el router lleva a la pantalla Asentamiento
  } catch (err) {
    const error = document.querySelector<HTMLElement>('#mapa-fundar-error');
    if (error) error.textContent = mensajeError(err);
  }
}

/** Abre (o cierra, si ya estaba) un panel del riel. Fundar además enciende la previsualización sobre el
 * canvas (círculo de zona + nodos), centrada en la columna del jugador. */
function abrirPanelRiel(panel: PanelRiel): void {
  menuEsquinaAbierto = false;
  sincronizarMenuEsquina();
  panelMapaAbierto = panelMapaAbierto === panel ? null : panel;
  const columna = estadoCliente.proyeccionUltima ? miColumna(estadoCliente.proyeccionUltima) : undefined;
  estadoCliente.modoFundacionActivo = panelMapaAbierto === 'fundar' && Boolean(columna);
  estadoCliente.posicionFundacion = estadoCliente.modoFundacionActivo && columna ? columna.posicionActual : null;
  renderPanelRiel();
  if (estadoCliente.proyeccionUltima) void dibujarPantallaSegunModo(estadoCliente.proyeccionUltima);
}

// --- MENÚ DE ESQUINA (compartido entre las pantallas Mapa y Asentamiento) -----------------------

/** Markup del avatar + menú desplegable + overlay JSON. Las clases llevan prefijo `mapa-` por herencia,
 * pero el componente es común a las dos pantallas a pantalla completa. */
function menuEsquinaHtml(): string {
  const iniciales = escaparHtml(estadoCliente.usuarioActivo.substring(0, 2).toUpperCase());
  return `
    <button class="mapa-avatar" type="button" aria-label="Menú de sesión">${iniciales}</button>
    <div class="mapa-menu" hidden>
      <button data-menu="refrescar" type="button">Refrescar</button>
      <button data-menu="json" type="button">Ver proyección (JSON)</button>
      <button data-menu="legacy" type="button">Interfaz anterior</button>
      <button data-menu="logout" type="button">Cerrar sesión</button>
    </div>
    <div class="mapa-json" hidden><button class="mapa-json-cerrar" type="button" aria-label="Cerrar">×</button><pre class="mapa-json-pre"></pre></div>`;
}

function sincronizarMenuEsquina(): void {
  const menu = document.querySelector<HTMLElement>('.mapa-menu');
  if (menu) menu.hidden = !menuEsquinaAbierto;
}

function cablearMenuEsquina(contenedor: HTMLElement): void {
  const json = contenedor.querySelector<HTMLElement>('.mapa-json');
  contenedor.querySelector('.mapa-avatar')?.addEventListener('click', () => { menuEsquinaAbierto = !menuEsquinaAbierto; sincronizarMenuEsquina(); });
  contenedor.querySelector('[data-menu="refrescar"]')?.addEventListener('click', () => { menuEsquinaAbierto = false; sincronizarMenuEsquina(); void refrescarDatosJuego(); });
  contenedor.querySelector('[data-menu="legacy"]')?.addEventListener('click', () => { location.hash = '#/legacy'; });
  contenedor.querySelector('[data-menu="logout"]')?.addEventListener('click', () => cerrarSesionYVolverALogin());
  contenedor.querySelector('[data-menu="json"]')?.addEventListener('click', () => {
    menuEsquinaAbierto = false;
    sincronizarMenuEsquina();
    if (json) {
      json.hidden = false;
      const pre = json.querySelector('.mapa-json-pre');
      if (pre) pre.textContent = JSON.stringify(estadoCliente.proyeccionUltima, null, 2);
    }
  });
  json?.querySelector('.mapa-json-cerrar')?.addEventListener('click', () => { if (json) json.hidden = true; });
  sincronizarMenuEsquina();
}

/** Pinta el riel (estado activo de cada icono) y el panel lateral abierto. Se llama al montar el Mapa y en
 * cada refresco. */
function renderPanelRiel(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const riel = document.querySelector<HTMLElement>('.mapa-riel');
  const panel = document.querySelector<HTMLElement>('.mapa-panel');
  if (!riel || !panel || !proyeccion) return;

  const columna = miColumna(proyeccion);
  const puedeFundar = Boolean(columna);
  riel.querySelector('[data-panel="fundar"]')?.toggleAttribute('hidden', !puedeFundar);
  riel.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((boton) => {
    boton.classList.toggle('activo', boton.dataset.panel === panelMapaAbierto);
  });
  riel.querySelector('[data-panel="fundar"]')?.classList.toggle('destaca', puedeFundar && !tieneAsentamientoPropio(proyeccion));

  if (panelMapaAbierto === null) { panel.hidden = true; panel.innerHTML = ''; return; }
  panel.hidden = false;
  if (panelMapaAbierto === 'faccion') {
    panel.innerHTML = `<div class="mapa-panel-jugador">${escaparHtml(estadoCliente.usuarioActivo)}</div>${renderPestanaFaccion(proyeccion, escaparHtml)}`;
  } else if (panelMapaAbierto === 'cosas') {
    const asentamientos = asentamientosDelMapa(proyeccion).filter((a) => a.faccionId === proyeccion.faccionId);
    const columnas = proyeccion.ejercitos;
    panel.innerHTML = `
      <span class="faction-kicker">Mis cosas</span>
      <div class="mapa-lista">
        <strong>Asentamientos</strong>
        ${asentamientos.length > 0
          ? asentamientos.map((a) => `<button class="mapa-lista-item" type="button" data-centrar-x="${a.posicion.x}" data-centrar-y="${a.posicion.y}">${escaparHtml(a.nombre ?? a.id)}<span>Nivel ${a.nivel}${a.recordado !== null ? ' · recordado' : ''}</span></button>`).join('')
          : '<p class="mapa-lista-vacia">Ninguno a la vista.</p>'}
        <strong>Columnas</strong>
        ${columnas.length > 0
          ? columnas.map((e) => `<button class="mapa-lista-item" type="button" data-centrar-x="${e.posicionActual.x}" data-centrar-y="${e.posicionActual.y}">${e.participantes?.some((p) => p.jugadorId === proyeccion.jugadorId) ? 'Tu columna' : escaparHtml(e.id)}<span>${e.estado}</span></button>`).join('')
          : '<p class="mapa-lista-vacia">Ninguna.</p>'}
      </div>`;
    panel.querySelectorAll<HTMLButtonElement>('.mapa-lista-item').forEach((boton) => {
      boton.addEventListener('click', () => {
        const mapa = estadoCliente.mapaCache?.mapa;
        if (mapa && controlMapaActivo) controlMapaActivo.centrar({ x: Number(boton.dataset.centrarX), y: Number(boton.dataset.centrarY) }, mapa.config.ancho, mapa.config.alto);
      });
    });
  } else {
    // fundar
    panel.innerHTML = `
      <span class="faction-kicker">Fundar asentamiento</span>
      <p>Se funda donde está ahora tu columna. Estos son los recursos a tu alcance:</p>
      <div id="mapa-fundar-recursos">${resumenRecursosFundacion(escaparHtml)}</div>
      <button id="btn-fundar-aqui" class="btn-primary" type="button">Fundar aquí</button>
      <p id="mapa-fundar-error" class="faction-error" role="alert"></p>`;
    panel.querySelector('#btn-fundar-aqui')?.addEventListener('click', () => void fundarAqui());
  }
}

/** Pantalla MAPA: el mundo a pantalla completa como fondo, con zoom (rueda y botones) y arrastre acotados
 * (T3), y movimiento por clic + panel de Selección (T4). El terreno lo pinta `dibujarPantallaSegunModo`
 * sobre el mismo canvas `#mapa` de siempre; el zoom es solo `transform` CSS encima. */
function montarMapa(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) { montar('cargando'); return; }
  estadoCliente.modoVista = 'mundo';
  seleccionMapa = null;
  panelMapaAbierto = null;
  menuEsquinaAbierto = false;
  app.innerHTML = `<div class="mapa-screen">
    <div class="mapa-lienzo"><canvas id="mapa" width="900" height="900"></canvas></div>
    <nav class="mapa-riel" aria-label="Paneles del mapa">
      <button type="button" data-panel="faccion" title="Facción" aria-label="Facción">⚑</button>
      <button type="button" data-panel="cosas" title="Mis cosas" aria-label="Mis cosas">📍</button>
      <button type="button" data-panel="fundar" title="Fundar asentamiento" aria-label="Fundar asentamiento" hidden>⌂</button>
    </nav>
    <aside class="mapa-panel" hidden></aside>
    <aside class="mapa-seleccion" hidden></aside>
    <p class="mapa-aviso" role="status" hidden></p>
    <div class="mapa-zoom"><button type="button" data-zoom="in" aria-label="Acercar">+</button><button type="button" data-zoom="out" aria-label="Alejar">−</button></div>
    ${menuEsquinaHtml()}
  </div>`;
  const contenedor = document.querySelector<HTMLElement>('.mapa-screen')!;
  const lienzo = document.querySelector<HTMLElement>('.mapa-lienzo')!;
  const columna = miColumna(proyeccion);
  const alClicar = (evento: PointerEvent): void => {
    const proy = estadoCliente.proyeccionUltima;
    const mapa = estadoCliente.mapaCache?.mapa;
    const canvas = document.querySelector<HTMLCanvasElement>('#mapa');
    if (!proy || !mapa || !canvas) return;
    const punto = puntoDeMapa(evento, canvas, mapa);
    const asentamiento = asentamientoCercaDe(punto, proy);
    if (asentamiento) {
      seleccionMapa = { id: asentamiento.id };
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'asentamiento', id: asentamiento.id });
    } else {
      seleccionMapa = null;
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'punto', punto });
    }
  };
  const control = instalarZoomPan(contenedor, lienzo, { zoomInicial: columna ? 1.6 : 1, alClicar });
  controlMapaActivo = control;
  // El mundo solo avanza por tick y este cliente aún no tiene tiempo real (`WS .../tiempo-real`): sin esto el
  // mapa sería una foto y la columna nunca parecería moverse. Sondeo suave mientras la pantalla Mapa esté
  // montada; se corta al cambiar de pantalla (`limpiarPantalla`).
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.mapa-screen')) return;
    sondeando = true;
    void refrescarDatosJuego().catch(() => {}).finally(() => { sondeando = false; });
  }, 3000);
  limpiarPantalla = () => {
    clearInterval(sondeo);
    control.destruir();
    controlMapaActivo = null;
    estadoCliente.modoFundacionActivo = false;
    estadoCliente.posicionFundacion = null;
  };

  contenedor.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((boton) => {
    boton.addEventListener('click', () => control.zoomHacia(boton.dataset.zoom === 'in' ? 1 : -1));
  });
  contenedor.querySelectorAll<HTMLButtonElement>('.mapa-riel [data-panel]').forEach((boton) => {
    boton.addEventListener('click', () => abrirPanelRiel(boton.dataset.panel as PanelRiel));
  });
  cablearMenuEsquina(contenedor);

  renderPanelRiel();
  void dibujarPantallaSegunModo(proyeccion).then(() => {
    const mapa = estadoCliente.mapaCache?.mapa;
    if (columna && mapa) control.centrar(columna.posicionActual, mapa.config.ancho, mapa.config.alto);
  });
}

// --- PANTALLA ASENTAMIENTO (T6) -----------------------------------------------------------------

type PanelAsent = 'faccion' | 'ejercito';
let panelAsentAbierto: PanelAsent | null = null;

/** Salida "en seco" al mundo (Doc 1.10.2): sin tropas ni carga. La pantalla de equipamiento (elegir
 * escuadrones y carro) queda para más adelante — ver docs/Features_Pendientes.md. */
async function salirAlMundo(): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  const asentamiento = proyeccion?.asentamientos[0];
  if (!proyeccion || !asentamiento) return;
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'salirAlMundo', {
      asentamientoId: asentamiento.id,
      jugadorId: proyeccion.jugadorId,
      escuadronIds: [],
      carga: {},
    });
    if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'No se pudo salir al mundo.');
    panelAsentAbierto = null;
    await refrescarDatosJuego(); // el router lleva a la pantalla Mapa
  } catch (err) {
    const error = document.querySelector<HTMLElement>('#asent-error');
    if (error) error.textContent = mensajeError(err);
  }
}

// --- PANEL DE GESTIÓN DEL ASENTAMIENTO (columna derecha): Resumen · Edificios · Cola ------------
// Solo con lo que ya trae la proyección. Las acciones sin dato previo (mejorar, añadir) se mandan y se
// muestra el error del backend si lo rechaza. Ver docs/Panel_Asentamiento.md.

type SeccionAsent = 'resumen' | 'edificios' | 'cola';
let seccionAsent: SeccionAsent = 'edificios';

/** Edificios que un Gobernador / Maestro de Obras puede añadir a mano (el backend gatea nivel, únicos y
 * topes; aquí solo se ofrece el catálogo). Fuera: centroUrbano, puestoMercado y los extractores de `mapa`. */
const EDIFICIOS_MANUALES = [
  'vivienda', 'almacen', 'granero', 'granja', 'lenera', 'corral',
  'barracon', 'galeriaDeTiro', 'palacio', 'mercado',
  'fundicion', 'granFundicion', 'curtiduria', 'armeria', 'carpinteria', 'maravilla',
] as const;

/** El cargo de construcción que el jugador tiene en esta plaza, o `null`. */
function cargoConstructor(asentamiento: Asentamiento, jugadorId: string): 'gobernador' | 'maestroObras' | null {
  if (asentamiento.cargos?.gobernadorId === jugadorId) return 'gobernador';
  if (asentamiento.cargos?.maestroObrasId === jugadorId) return 'maestroObras';
  return null;
}

function esResidente(asentamiento: Asentamiento, jugadorId: string): boolean {
  return Boolean(asentamiento.jugadoresFundadoresIds?.includes(jugadorId) || asentamiento.casasCompradas?.includes(jugadorId));
}

/** "3 min" / "45 s" que faltan para un instante de mundo. */
function cuentaAtras(instanteFin: number | undefined): string {
  if (typeof instanteFin !== 'number') return '';
  const ms = instanteFin - (estadoCliente.proyeccionUltima?.instante ?? Date.now());
  if (ms <= 0) return 'listo';
  const min = Math.round(ms / 60_000);
  return min >= 1 ? `${min} min` : `${Math.round(ms / 1000)} s`;
}

/** Lanza un comando de gestión del asentamiento y refresca; el error va a `#asent-lado-error`. */
async function ejecutarAccionAsent(tipo: string, params: Record<string, unknown>): Promise<void> {
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, tipo, params);
    if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'El servidor rechazó la operación.');
    await refrescarDatosJuego();
  } catch (err) {
    const error = document.querySelector<HTMLElement>('#asent-lado-error');
    if (error) error.textContent = mensajeError(err);
  }
}

/** Pinta y cablea la columna derecha completa (tabs + sección activa). Se llama al montar y en cada
 * refresco/sondeo. Guarda el nombre `renderPanelEdificios` por los sitios que ya lo llaman. */
function renderPanelEdificios(): void {
  const contenedor = document.querySelector<HTMLElement>('.asent-edificios');
  const proyeccion = estadoCliente.proyeccionUltima;
  const asentamiento = proyeccion?.asentamientos[0];
  if (!contenedor || !proyeccion || !asentamiento) return;

  const edificios = asentamiento.edificios ?? [];
  const cargo = cargoConstructor(asentamiento, proyeccion.jugadorId);
  const puedeConstruir = cargo !== null;

  const tabs = (['resumen', 'edificios', 'cola'] as const)
    .map((s) => `<button class="asent-tab${s === seccionAsent ? ' activo' : ''}" type="button" data-seccion="${s}">${s === 'resumen' ? 'Resumen' : s === 'edificios' ? 'Edificios' : 'Cola'}</button>`)
    .join('');

  contenedor.innerHTML = `
    <div class="asent-tabs">${tabs}</div>
    <div class="asent-lado-cuerpo">${
      seccionAsent === 'resumen'
        ? seccionResumen(asentamiento)
        : seccionAsent === 'edificios'
          ? seccionEdificios(asentamiento, cargo)
          : seccionCola(edificios, cargo)
    }</div>
    ${!puedeConstruir && seccionAsent !== 'resumen' ? '<p class="asent-lado-nota">Necesitas ser Gobernador o Maestro de Obras para gestionar la construcción.</p>' : ''}
    <p id="asent-lado-error" class="faction-error" role="alert"></p>`;

  contenedor.querySelectorAll<HTMLButtonElement>('.asent-tab').forEach((boton) => {
    boton.addEventListener('click', () => { seccionAsent = boton.dataset.seccion as SeccionAsent; renderPanelEdificios(); });
  });
  cablearAccionesAsentLado(contenedor, asentamiento, cargo);
}

function seccionResumen(a: Asentamiento): string {
  const pob = a.poblacion;
  const total = pob ? pob.pesants + pob.artesanos + pob.nobleza : null;
  const ocupado = typeof a.ocupacionHasta === 'number' && a.ocupacionHasta > (estadoCliente.proyeccionUltima?.instante ?? 0);
  const medidor = (etiqueta: string, valor: number | undefined) =>
    typeof valor === 'number'
      ? `<div class="asent-medidor"><span>${etiqueta}</span><div class="asent-medidor-track"><span style="width:${Math.max(0, Math.min(100, valor))}%"></span></div><strong>${Math.round(valor)}</strong></div>`
      : '';
  return `
    <div class="asent-ficha-grid">
      <div><span>Nivel</span><strong>${a.nivel}${a.nivelActual !== undefined && a.nivelActual !== a.nivel ? ` (op. ${a.nivelActual})` : ''}</strong></div>
      <div><span>Población</span><strong>${total ?? '—'}</strong></div>
      ${pob ? `<div><span>Pesants</span><strong>${pob.pesants}</strong></div><div><span>Artesanos</span><strong>${pob.artesanos}</strong></div>` : ''}
      ${pob && pob.nobleza > 0 ? `<div><span>Nobleza</span><strong>${pob.nobleza}</strong></div>` : ''}
    </div>
    ${medidor('Mantenimiento', a.medidorMantenimiento)}
    ${medidor('Nutrición', a.nutricionPoblacion)}
    ${ocupado ? `<p class="asent-lado-nota asent-aviso-ocupacion">⚔ Bajo ocupación militar — ${cuentaAtras(a.ocupacionHasta)} restantes.</p>` : ''}
    <label class="asent-toggle"><input type="checkbox" id="chk-autoconstruccion" ${a.autoConstruccionPausada ? '' : 'checked'} /> Auto-construcción</label>`;
}

function seccionEdificios(a: Asentamiento, cargo: 'gobernador' | 'maestroObras' | null): string {
  const internos = (a.edificios ?? []).filter((e) => (e.ambito ?? 'asentamiento') !== 'mapa');
  const enRegion = (a.edificios ?? []).length - internos.length;

  const grupos = new Map<string, Edificio[]>();
  for (const e of internos) grupos.set(e.tipo, [...(grupos.get(e.tipo) ?? []), e]);

  const filas = [...grupos.entries()]
    .sort(([x, lx], [y, ly]) =>
      (x === 'centroUrbano' ? -1 : 0) - (y === 'centroUrbano' ? -1 : 0) || ly.length - lx.length || x.localeCompare(y)
    )
    .map(([tipo, lista]) => {
      const nivelMax = Math.max(...lista.map((e) => e.nivelInterno ?? 1));
      const enObra = lista.filter((e) => e.estado !== 'activo').length;
      const parados = lista.filter((e) => e.pausadoPorAlmacenLleno).length;
      const meta = [lista.length > 1 ? `×${lista.length}` : '', nivelMax > 1 ? `N${nivelMax}` : ''].filter(Boolean).join(' · ');
      const nota = [enObra ? `${enObra} en obra` : '', parados ? `${parados} parado${parados > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
      // La mejora ataca la instancia ACTIVA de menor nivel interno (todas las de un tipo son intercambiables).
      const objetivoMejora = lista
        .filter((e) => e.estado === 'activo')
        .sort((e1, e2) => (e1.nivelInterno ?? 1) - (e2.nivelInterno ?? 1))[0];
      return `<div class="asent-edif-item" style="--swatch:${EDIFICIO_COLOR[tipo] ?? '#888'}">
        <span class="asent-edif-nombre">${escaparHtml(EDIFICIO_NOMBRE[tipo] ?? tipo)}</span>
        <span class="asent-edif-meta">${escaparHtml(meta)}</span>
        ${cargo && objetivoMejora && tipo !== 'centroUrbano' ? `<button class="asent-edif-mejora" type="button" data-mejorar="${escaparHtml(objetivoMejora.id)}" title="Mejorar el de menor nivel">⬆</button>` : ''}
        ${nota ? `<span class="asent-edif-nota">${escaparHtml(nota)}</span>` : ''}
      </div>`;
    })
    .join('');
  const anadir = cargo
    ? `<div class="asent-anadir">
        <select id="sel-anadir-edificio">${EDIFICIOS_MANUALES.map((t) => `<option value="${t}">${escaparHtml(EDIFICIO_NOMBRE[t] ?? t)}</option>`).join('')}</select>
        <button id="btn-anadir-edificio" class="btn-secondary" type="button">Añadir a la cola</button>
      </div>`
    : '';
  return `
    <div class="asent-lado-cabecera"><span class="faction-kicker">Edificios</span><strong>${internos.length}</strong></div>
    ${anadir}
    <div class="asent-edif-lista">${filas || '<p class="mapa-lista-vacia">Sin edificios.</p>'}</div>
    ${enRegion > 0 ? `<p class="asent-edif-region">+ ${enRegion} en la región (minas, canteras)</p>` : ''}`;
}

function seccionCola(edificios: Edificio[], cargo: 'gobernador' | 'maestroObras' | null): string {
  const cola = edificios
    .filter((e) => e.estado !== 'activo')
    .sort((x, y) => (y.prioridad ?? 0) - (x.prioridad ?? 0));
  if (cola.length === 0) return '<p class="mapa-lista-vacia">Sin obras en curso ni en cola.</p>';
  return `<div class="asent-cola-lista">${cola
    .map((e, i) => `<div class="asent-cola-item" style="--swatch:${EDIFICIO_COLOR[e.tipo] ?? '#888'}">
      <span class="asent-cola-pos">${i + 1}</span>
      <span class="asent-edif-nombre">${escaparHtml(EDIFICIO_NOMBRE[e.tipo] ?? e.tipo)}</span>
      <span class="asent-edif-nota">${e.estado === 'en_construccion' ? `obra · ${cuentaAtras(e.completaEn)}` : 'en cola'}</span>
      ${cargo ? `<span class="asent-cola-acciones">
        <button type="button" data-cola-mover="arriba" data-edificio="${escaparHtml(e.id)}" title="Subir">▲</button>
        <button type="button" data-cola-mover="abajo" data-edificio="${escaparHtml(e.id)}" title="Bajar">▼</button>
        ${e.estado === 'en_cola' ? `<button type="button" data-cola-quitar="${escaparHtml(e.id)}" title="Quitar">✕</button>` : ''}
      </span>` : ''}
    </div>`)
    .join('')}</div>`;
}

function cablearAccionesAsentLado(cont: HTMLElement, a: Asentamiento, cargo: 'gobernador' | 'maestroObras' | null): void {
  cont.querySelector('#chk-autoconstruccion')?.addEventListener('change', (ev) => {
    void ejecutarAccionAsent('alternarAutoConstruccion', { asentamientoId: a.id, pausada: !(ev.target as HTMLInputElement).checked });
  });
  if (!cargo) return;
  cont.querySelector('#btn-anadir-edificio')?.addEventListener('click', () => {
    const tipo = cont.querySelector<HTMLSelectElement>('#sel-anadir-edificio')?.value;
    if (tipo) void ejecutarAccionAsent('anadirEdificioManualmente', { asentamientoId: a.id, cargo, tipo });
  });
  cont.querySelectorAll<HTMLButtonElement>('[data-mejorar]').forEach((b) => {
    b.addEventListener('click', () => void ejecutarAccionAsent('mejorarEdificioAhora', { asentamientoId: a.id, cargo, edificioId: b.dataset.mejorar }));
  });
  cont.querySelectorAll<HTMLButtonElement>('[data-cola-mover]').forEach((b) => {
    b.addEventListener('click', () => void ejecutarAccionAsent('moverEnCola', { asentamientoId: a.id, cargo, edificioId: b.dataset.edificio, direccion: b.dataset.colaMover }));
  });
  cont.querySelectorAll<HTMLButtonElement>('[data-cola-quitar]').forEach((b) => {
    b.addEventListener('click', () => void ejecutarAccionAsent('quitarDeCola', { asentamientoId: a.id, cargo, edificioId: b.dataset.colaQuitar }));
  });
}

/** Tira de recursos del almacén de la plaza que se pisa. La proyección solo trae `asentamientos[0]` cuando
 * es una plaza de tu Facción y con su almacén completo, así que no hace falta comprobar nada más. Solo se
 * listan los recursos con cantidad > 0. */
function renderPanelRecursos(): void {
  const contenedor = document.querySelector<HTMLElement>('.asent-recursos');
  if (!contenedor) return;
  const almacen = estadoCliente.proyeccionUltima?.asentamientos[0]?.almacen ?? {};
  const items = Object.entries(almacen)
    .filter(([, recurso]) => Math.floor(recurso.cantidad) >= 1)
    .sort(([a], [b]) => a.localeCompare(b));
  if (items.length === 0) {
    contenedor.hidden = true;
    contenedor.innerHTML = '';
    return;
  }
  contenedor.hidden = false;
  contenedor.innerHTML = items
    .map(([recurso, { cantidad, capacidad }]) => {
      const llenado = capacidad > 0 ? Math.min(100, Math.round((cantidad / capacidad) * 100)) : 0;
      const casiLleno = llenado >= 90;
      const nombre = escaparHtml(RECURSO_NOMBRE[recurso] ?? recurso);
      const detalle = escaparHtml(`${Math.floor(cantidad)}${capacidad > 0 ? ` / ${Math.floor(capacidad)}` : ''}`);
      return `<span class="asent-recurso${casiLleno ? ' lleno' : ''}" data-nombre="${nombre}" data-detalle="${detalle}">
        <span class="asent-recurso-icono" aria-hidden="true">${RECURSO_ICONO[recurso] ?? '📦'}</span>${Math.floor(cantidad)}
        <span class="asent-recurso-barra" style="--llenado:${llenado}%"></span>
      </span>`;
    })
    .join('');
}

/** Pinta el panel flotante de la barra (Facción / Ejército) según `panelAsentAbierto`. */
function renderPanelAsent(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const barra = document.querySelector<HTMLElement>('.asent-barra');
  const panel = document.querySelector<HTMLElement>('.asent-panel');
  if (!barra || !panel || !proyeccion) return;
  barra.querySelectorAll<HTMLButtonElement>('[data-panel-asent]').forEach((boton) => {
    boton.classList.toggle('activo', boton.dataset.panelAsent === panelAsentAbierto);
  });
  if (panelAsentAbierto === null) { panel.hidden = true; panel.innerHTML = ''; return; }
  panel.hidden = false;
  if (panelAsentAbierto === 'ejercito') {
    panel.innerHTML = `<span class="faction-kicker">Ejército</span><p class="mapa-lista-vacia">Sin comandos militares cableados todavía (composición de columna, reclutamiento, movilización) — ver docs/Features_Pendientes.md.</p>`;
    return;
  }
  panel.innerHTML = renderPestanaFaccion(proyeccion, escaparHtml) + renderCargosAsentamiento(proyeccion.asentamientos[0], proyeccion);
  cablearCargosAsentamiento(panel, proyeccion.asentamientos[0]);
}

/** Sección "Cargos" del panel de Facción, acotada al asentamiento que se pisa. Solo aparecen los cargos que
 * el jugador PUEDE asignar aquí: Gobernador si eres residente; los otros cuatro si eres el Gobernador
 * (Doc 2.2, `asignarCargoLocal` en el backend — el Rey NO tiene autoridad directa sobre cargos locales). */
function renderCargosAsentamiento(asentamiento: Asentamiento | undefined, proyeccion: ProyeccionJugador): string {
  if (!asentamiento) return '';
  const soyGobernador = asentamiento.cargos?.gobernadorId === proyeccion.jugadorId;
  const soyResidente = esResidente(asentamiento, proyeccion.jugadorId);
  if (!soyGobernador && !soyResidente) return '';

  const faccion = proyeccion.facciones.find((f) => f.id === proyeccion.faccionId);
  const ciudadanos = faccion?.ciudadanosIds ?? [];
  const cargos = (
    [
      ['gobernadorId', 'Gobernador', soyResidente],
      ['maestroObrasId', 'Maestro de Obras', soyGobernador],
      ['tesoreroId', 'Tesorero', soyGobernador],
      ['generalId', 'General', soyGobernador],
      ['sacerdoteId', 'Sacerdote', soyGobernador],
    ] as const
  ).filter(([, , puede]) => puede);
  if (cargos.length === 0) return '';

  return `
    <section class="asent-cargos">
      <span class="faction-kicker">Cargos de ${escaparHtml(asentamiento.nombre ?? asentamiento.id)}</span>
      ${cargos.map(([clave, nombre]) => {
        const actual = asentamiento.cargos?.[clave] ?? null;
        return `<div class="asent-cargo" data-cargo="${clave.replace('Id', '')}">
          <span>${nombre}</span>
          <select class="asent-cargo-sel">
            <option value="">— vacante —</option>
            ${ciudadanos.map((id) => `<option value="${escaparHtml(id)}"${id === actual ? ' selected' : ''}>${escaparHtml(id)}</option>`).join('')}
          </select>
          <button class="btn-secondary asent-cargo-btn" type="button">Asignar</button>
        </div>`;
      }).join('')}
      <p id="asent-cargo-error" class="faction-error" role="alert"></p>
    </section>`;
}

function cablearCargosAsentamiento(panel: HTMLElement, asentamiento: Asentamiento | undefined): void {
  if (!asentamiento) return;
  panel.querySelectorAll<HTMLElement>('.asent-cargo').forEach((fila) => {
    const cargo = fila.dataset.cargo;
    const select = fila.querySelector<HTMLSelectElement>('.asent-cargo-sel');
    fila.querySelector<HTMLButtonElement>('.asent-cargo-btn')?.addEventListener('click', async () => {
      const jugadorId = select?.value;
      if (!cargo || !jugadorId) return;
      try {
        const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'asignarCargoLocal', { asentamientoId: asentamiento.id, cargo, jugadorId });
        if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'No se pudo asignar el cargo.');
        await refrescarDatosJuego();
      } catch (err) {
        const error = panel.querySelector<HTMLElement>('#asent-cargo-error');
        if (error) error.textContent = mensajeError(err);
      }
    });
  });
}

/** Pantalla ASENTAMIENTO (rediseño estilo estrategia): barra superior (nombre + nivel + acciones), el mapa
 * de la ciudad ocupando el espacio a la izquierda, y la columna de edificios a la derecha. Facción /
 * Ejército abren un panel flotante sobre el mapa. */
function montarAsentamiento(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const asentamiento = proyeccion?.asentamientos[0];
  if (!proyeccion || !asentamiento) { montar('cargando'); return; }
  estadoCliente.modoVista = 'asentamiento';
  panelAsentAbierto = null;
  menuEsquinaAbierto = false;
  app.innerHTML = `<div class="asent-screen">
    <header class="asent-barra">
      <span class="asent-nombre">${escaparHtml(asentamiento.nombre ?? asentamiento.id)}</span>
      <span class="asent-nivel">Nivel ${asentamiento.nivel}</span>
      <div class="asent-barra-acciones">
        <button type="button" data-panel-asent="faccion">Facción</button>
        <button type="button" data-panel-asent="ejercito">Ejército</button>
        <button id="btn-salir-mundo" class="btn-primary" type="button">Salir al mundo</button>
      </div>
      <p id="asent-error" class="faction-error" role="alert"></p>
    </header>
    <div class="asent-cuerpo">
      <div class="asent-mapa">
        <div class="asent-lienzo"><canvas id="mapa" width="900" height="900"></canvas></div>
        <aside class="asent-panel" hidden></aside>
        <div class="asent-recursos" hidden></div>
      </div>
      <aside class="asent-lado"><div class="asent-edificios"></div></aside>
    </div>
    <div class="asent-tooltip" hidden></div>
    ${menuEsquinaHtml()}
  </div>`;
  const contenedor = document.querySelector<HTMLElement>('.asent-screen')!;
  contenedor.querySelectorAll<HTMLButtonElement>('[data-panel-asent]').forEach((boton) => {
    boton.addEventListener('click', () => {
      panelAsentAbierto = panelAsentAbierto === boton.dataset.panelAsent ? null : (boton.dataset.panelAsent as PanelAsent);
      menuEsquinaAbierto = false;
      sincronizarMenuEsquina();
      renderPanelAsent();
    });
  });
  contenedor.querySelector('#btn-salir-mundo')?.addEventListener('click', () => void salirAlMundo());
  cablearMenuEsquina(contenedor);
  cablearTooltipEdificios(contenedor);
  // La ciudad tiene vida (almacén, producción, población) aunque el jugador no toque nada: mismo sondeo
  // suave que el mapa, hasta que exista el canal de tiempo real.
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.asent-screen')) return;
    sondeando = true;
    void refrescarDatosJuego().catch(() => {}).finally(() => { sondeando = false; });
  }, 3000);
  limpiarPantalla = () => clearInterval(sondeo);
  renderPanelEdificios();
  renderPanelRecursos();
  renderPanelAsent();
  void dibujarPantallaSegunModo(proyeccion);
}

/** Tooltip al pasar el cursor sobre un edificio interno del mapa del asentamiento: nombre, nivel, estado.
 * La economía por edificio no viaja en la proyección (ver docs/Features_Pendientes.md §3.1). */
function cablearTooltipEdificios(contenedor: HTMLElement): void {
  const canvas = contenedor.querySelector<HTMLCanvasElement>('#mapa');
  const tooltip = contenedor.querySelector<HTMLElement>('.asent-tooltip');
  if (!canvas || !tooltip) return;

  canvas.addEventListener('mousemove', (evento) => {
    const proyeccion = estadoCliente.proyeccionUltima;
    const asentamiento = proyeccion?.asentamientos[0];
    if (!proyeccion || !asentamiento) { tooltip.hidden = true; return; }
    const edificio = edificioBajoCursor(canvas, evento, asentamiento, proyeccion.trazadoPorAsentamiento?.[asentamiento.id]);
    if (!edificio) { tooltip.hidden = true; return; }

    const estado = edificio.estado === 'activo' ? 'Activo' : edificio.estado === 'en_construccion' ? 'En construcción' : 'En cola';
    const notas = [
      edificio.danado ? 'dañado (reconstrucción)' : null,
      edificio.pausadoPorAlmacenLleno ? 'parado — almacén lleno' : null,
    ].filter(Boolean).join(' · ');
    tooltip.innerHTML = `<strong>${escaparHtml(EDIFICIO_NOMBRE[edificio.tipo] ?? edificio.tipo)}</strong><span>Nivel ${edificio.nivelInterno ?? 1} · ${estado}</span>${notas ? `<span>${escaparHtml(notas)}</span>` : ''}`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(window.innerWidth - tooltip.offsetWidth - 8, evento.clientX + 14)}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - tooltip.offsetHeight - 8, evento.clientY + 14)}px`;
  });
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
}

function renderizarPanelInteraccion(proyeccion: ProyeccionJugador): void {
  const panel = document.querySelector<HTMLDivElement>('#panel-interaccion');
  if (!panel) return;
  sincronizarEstado();
  panel.innerHTML = renderPanelInteraccion(proyeccion, escaparHtml);
  const animacion = panel.querySelector<HTMLElement>('.faction-panel-view');
  animacion?.classList.add('is-entering');
  requestAnimationFrame(() => animacion?.classList.remove('is-entering'));

  panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((boton) => {
    boton.addEventListener('click', () => cambiarPestana(boton.dataset.tab as typeof estadoCliente.pestanaInteraccion));
  });
  panel.querySelector('#btn-ir-informacion')?.addEventListener('click', () => cambiarPestana('informacion'));
  panel.querySelector('#btn-tip-anterior')?.addEventListener('click', () => {
    estadoCliente.indiceTip = (estadoCliente.indiceTip + TIPS_FUNDACION.length - 1) % TIPS_FUNDACION.length;
    actualizarTip();
  });
  panel.querySelector('#btn-tip-siguiente')?.addEventListener('click', () => {
    estadoCliente.indiceTip = (estadoCliente.indiceTip + 1) % TIPS_FUNDACION.length;
    actualizarTip();
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-settlement-detail-tab]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const tab = boton.dataset.settlementDetailTab;
      if (tab === 'general' || tab === 'edificios' || tab === 'almacen' || tab === 'produccion' || tab === 'militar' || tab === 'muralla') {
        estadoCliente.asentamientoDetalleTab = tab;
        if (estadoCliente.proyeccionUltima) renderizarPanelInteraccion(estadoCliente.proyeccionUltima);
      }
    });
  });
  panel.querySelector('#btn-fundar-asentamiento')?.addEventListener('click', () => {
    if (!estadoCliente.modoFundacionActivo) {
      estadoCliente.modoFundacionActivo = true;
      estadoCliente.puntoFundacionFijado = false;
      actualizarModoFundacion(proyeccion);
      renderizarPanelInteraccion(proyeccion);
    } else if (estadoCliente.posicionFundacion) {
      void confirmarFundacion(proyeccion, estadoCliente.posicionFundacion);
    }
  });
  panel.querySelector('#btn-cancelar-fundacion')?.addEventListener('click', () => {
    estadoCliente.modoFundacionActivo = false;
    estadoCliente.posicionFundacion = null;
    estadoCliente.puntoFundacionFijado = false;
    actualizarModoFundacion(proyeccion);
    renderizarPanelInteraccion(proyeccion);
  });
  cablearAccionesMuralla(panel);
  cablearFaccion(panel, proyeccion, () => renderizarPanelInteraccion(proyeccion));
}

function renderVistaLogin(errorMensaje?: string): void {
  app.innerHTML = `<div class="login-container"><div class="login-card"><div class="login-header"><h1 class="login-title">Bronze Age Collapse</h1><p class="login-subtitle">Cliente de Jugador — Inicio de Sesión</p></div>${errorMensaje ? `<div class="error-banner">⚠️ ${escaparHtml(errorMensaje)}</div>` : ''}<form id="form-login"><div class="form-group"><label class="form-label" for="input-usuario">Nick</label><input type="text" id="input-usuario" class="form-input" value="${escaparHtml(estadoCliente.usuarioActivo)}" required autocomplete="username" /></div><div class="form-group"><label class="form-label" for="input-clave">Contraseña</label><input type="password" id="input-clave" class="form-input" required minlength="6" autocomplete="current-password" /></div><label class="form-check"><input type="checkbox" id="chk-registro" /> No tengo cuenta — crear una</label><div class="form-group" id="grupo-codigo" hidden><label class="form-label" for="input-codigo">Código de invitación</label><input type="text" id="input-codigo" class="form-input" autocomplete="off" /></div><div class="form-group"><label class="form-label" for="input-gameid">ID de Partida</label><input type="text" id="input-gameid" class="form-input" value="${escaparHtml(estadoCliente.gameIdActivo)}" required autocomplete="off" /></div><button type="submit" id="btn-login-submit" class="btn-primary">Entrar a la Partida</button></form></div></div>`;
  const chkRegistro = document.querySelector<HTMLInputElement>('#chk-registro');
  chkRegistro?.addEventListener('change', () => {
    const grupoCodigo = document.querySelector<HTMLDivElement>('#grupo-codigo');
    if (grupoCodigo) grupoCodigo.hidden = !chkRegistro.checked;
    const boton = document.querySelector<HTMLButtonElement>('#btn-login-submit');
    if (boton) boton.textContent = chkRegistro.checked ? 'Crear cuenta y entrar' : 'Entrar a la Partida';
  });
  document.querySelector<HTMLFormElement>('#form-login')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nick = document.querySelector<HTMLInputElement>('#input-usuario')?.value.trim();
    const clave = document.querySelector<HTMLInputElement>('#input-clave')?.value ?? '';
    const codigo = document.querySelector<HTMLInputElement>('#input-codigo')?.value.trim() || undefined;
    const gameId = document.querySelector<HTMLInputElement>('#input-gameid')?.value.trim() || 'local';
    if (!nick || !clave) return;
    try {
      if (chkRegistro?.checked) await registrarCuenta(nick, clave, codigo);
      const login = await loginConClave(nick, clave);
      try { await unirseAPartida(gameId); } catch (err) { if (!(err instanceof ApiError) || err.status !== 409) throw err; }
      guardarSesionLocal(login.sesionId, nick, gameId);
      estadoCliente.usuarioActivo = nick;
      estadoCliente.gameIdActivo = gameId;
      estadoCliente.proyeccionUltima = null;
      pantallaMontada = null;
      enrutar();
      await refrescarDatosJuego();
    } catch (err) { renderVistaLogin(mensajeError(err)); }
  });
}

/** La interfaz ANTERIOR, intacta, servida solo desde `#/legacy` (Doc `twinkly-greeting-peacock.md`). El
 * revamp de pantallas vive fuera de aquí. */
function montarLegacy(): void {
  app.innerHTML = `<div class="game-container"><header class="top-bar"><div class="brand-section"><span class="brand-title">Bronze Age Collapse</span><span class="brand-badge">Cliente Jugador</span></div><div class="user-section"><div class="user-info"><div class="user-avatar">${escaparHtml(estadoCliente.usuarioActivo.substring(0, 2).toUpperCase())}</div><div class="details-group"><button id="btn-toggle-proyeccion" class="user-name" type="button" aria-expanded="false" aria-controls="panel-proyeccion">${escaparHtml(estadoCliente.usuarioActivo)}</button><span class="game-id">Partida: <strong>${escaparHtml(estadoCliente.gameIdActivo)}</strong></span></div></div><button id="btn-toggle-vista" class="btn-secondary">🏙️ Ver Ciudad</button><button id="btn-refrescar" class="btn-secondary">🔄 Refrescar</button><button id="btn-logout" class="btn-secondary">Cerrar Sesión</button></div></header><div class="main-content"><div id="panel-interaccion" class="card-panel interaction-panel"><div class="interaction-loading">Cargando opciones de interacción...</div></div><div id="panel-proyeccion" class="card-panel projection-panel" hidden><h2 class="panel-title">Proyección del Jugador (JSON / HTTP)</h2><pre id="proyeccion">Cargando proyección...</pre></div>${renderPanelMapa()}</div></div>`;
  document.querySelector('#btn-logout')?.addEventListener('click', () => cerrarSesionYVolverALogin());
  document.querySelector('#btn-toggle-proyeccion')?.addEventListener('click', () => {
    const boton = document.querySelector<HTMLButtonElement>('#btn-toggle-proyeccion');
    const panel = document.querySelector<HTMLDivElement>('#panel-proyeccion');
    if (!boton || !panel) return;
    panel.hidden = !panel.hidden;
    boton.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.querySelector('#btn-refrescar')?.addEventListener('click', () => void refrescarDatosJuego());
  document.querySelector('#btn-toggle-vista')?.addEventListener('click', () => {
    estadoCliente.modoVista = estadoCliente.modoVista === 'mundo' ? 'asentamiento' : 'mundo';
    const boton = document.querySelector<HTMLButtonElement>('#btn-toggle-vista');
    if (boton) boton.textContent = estadoCliente.modoVista === 'mundo' ? '🏙️ Ver Ciudad' : '🗺️ Ver Mapa Mundo';
    if (estadoCliente.proyeccionUltima) void dibujarPantallaSegunModo(estadoCliente.proyeccionUltima);
  });
}

async function sincronizarMapa(mapaId: string): Promise<MapaGenerado> {
  if (estadoCliente.mapaCache?.id === mapaId) return estadoCliente.mapaCache.mapa;
  const mapa = await obtenerMapa(estadoCliente.gameIdActivo, mapaId);
  estadoCliente.mapaCache = { id: mapaId, mapa };
  return mapa;
}

async function dibujarPantallaSegunModo(proyeccion: ProyeccionJugador): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#mapa');
  const titulo = document.querySelector<HTMLHeadingElement>('#titulo-mapa');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (estadoCliente.modoVista === 'mundo') {
    if (titulo) titulo.textContent = 'Mapa del Mundo (Evaluación T2a)';
    const mapa = await sincronizarMapa(proyeccion.mapaId);
    pintarTerreno(ctx, mapa, proyeccion, canvas.width / mapa.config.ancho);
  } else {
    if (titulo) titulo.textContent = 'Vista de Asentamiento (Geometría Urbana T2a)';
    const asentamiento = proyeccion.asentamientos[0];
    if (asentamiento) pintarAsentamiento(ctx, asentamiento, proyeccion.trazadoPorAsentamiento?.[asentamiento.id]);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillText('No perteneces a ningún asentamiento aún.', 20, 40); }
  }
  if (estadoCliente.modoFundacionActivo && estadoCliente.posicionFundacion && estadoCliente.mapaCache?.mapa) {
    pintarPrevisualizacionFundacion(ctx, estadoCliente.mapaCache.mapa, estadoCliente.posicionFundacion, canvas.width / estadoCliente.mapaCache.mapa.config.ancho);
  }
}

function actualizarModoFundacion(proyeccion: ProyeccionJugador): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#mapa');
  if (!canvas) return;
  if (!estadoCliente.modoFundacionActivo) { canvas.classList.remove('mapa-fundacion-activo'); canvas.onpointermove = null; canvas.onpointerleave = null; canvas.onclick = null; return; }
  canvas.classList.add('mapa-fundacion-activo');
  const punto = (evento: MouseEvent) => { const rect = canvas.getBoundingClientRect(); const mapa = estadoCliente.mapaCache?.mapa; return mapa ? { x: ((evento.clientX - rect.left) / rect.width) * mapa.config.ancho, y: ((evento.clientY - rect.top) / rect.height) * mapa.config.alto } : { x: 0, y: 0 }; };
  canvas.onpointermove = (evento) => { if (estadoCliente.puntoFundacionFijado) return; estadoCliente.posicionFundacion = punto(evento); actualizarPanelFundacion(); void dibujarPantallaSegunModo(proyeccion); };
  canvas.onpointerleave = () => { if (estadoCliente.puntoFundacionFijado) return; estadoCliente.posicionFundacion = null; actualizarPanelFundacion(); };
  canvas.onclick = (evento) => { if (estadoCliente.puntoFundacionFijado) return; estadoCliente.posicionFundacion = punto(evento); estadoCliente.puntoFundacionFijado = true; actualizarPanelFundacion(); void dibujarPantallaSegunModo(proyeccion); };
}

function actualizarPanelFundacion(): void {
  const panel = document.querySelector<HTMLDivElement>('#panel-interaccion');
  const boton = panel?.querySelector<HTMLButtonElement>('#btn-fundar-asentamiento');
  const resumen = panel?.querySelector<HTMLDivElement>('#foundation-resource-summary');
  if (!panel || !boton || !resumen) return;
  boton.classList.toggle('is-active', estadoCliente.modoFundacionActivo && !estadoCliente.posicionFundacion);
  boton.classList.toggle('is-confirmation', Boolean(estadoCliente.posicionFundacion));
  boton.textContent = estadoCliente.posicionFundacion
    ? 'Fundar'
    : estadoCliente.modoFundacionActivo
      ? 'Selecciona punto de fundación'
      : 'Presiona aquí para elegir dónde quieres fundar';
  resumen.innerHTML = resumenRecursosFundacion(escaparHtml);
}

async function confirmarFundacion(proyeccion: ProyeccionJugador, _posicion: { x: number; y: number }): Promise<void> {
  try {
    // Sync backend 2026-09-08 (`BronzeAgeFase0@4fe611b`, "se funda DONDE SE ESTÁ", Doc 1.3): `fundarAsentamiento`
    // ya NO acepta `posicion` — el backend la deriva de la columna del fundador. El punto elegido en el mapa
    // es hoy solo la vista previa de recursos; el flujo de fundación real necesita la presencia del jugador
    // (`salirAlMundo`), aún sin cablear — ver docs/Analisis_Brecha_Backend.md.
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'fundarAsentamiento', { faccionId: proyeccion.faccionId });
    if (!respuesta.resultado.ok) throw new ApiError(409, respuesta.resultado.codigoError ?? 'No se pudo fundar aquí.');
    estadoCliente.modoFundacionActivo = false;
    estadoCliente.posicionFundacion = null;
    estadoCliente.puntoFundacionFijado = false;
    await refrescarDatosJuego();
  } catch (err) {
    const estado = document.querySelector<HTMLParagraphElement>('#estado');
    if (estado) estado.textContent = `Error al fundar: ${mensajeError(err)}`;
  }
}

/** El instante de MUNDO de la partida, legible. Sustituye al `Tick: ${proyeccion.tick}` que llevaba
 * imprimiendo `undefined` desde que la Fase D retiro el `tick` del contrato: lo que viaja es `instante`, ms
 * desde la epoca Unix, y lo que le importa al jugador es la fecha de su mundo, no el contador del motor. */
function fechaDeMundo(instante: number | undefined): string {
  if (typeof instante !== 'number' || !Number.isFinite(instante)) return 'Fecha desconocida';
  return new Date(instante).toLocaleString();
}

async function refrescarDatosJuego(): Promise<void> {
  const proyeccion = await consultarProyeccion(estadoCliente.gameIdActivo);
  estadoCliente.proyeccionUltima = proyeccion;
  enrutar();
}

// --- ROUTER DE PANTALLAS --------------------------------------------------------------------------
// La pantalla que se ve es un reflejo directo del estado de la proyección (Doc de diseño
// `twinkly-greeting-peacock.md`): no hay "última pantalla" guardada, así que recargar devuelve al jugador a
// donde estaba. `#/legacy` es la válvula de escape a la interfaz anterior, intacta, y solo se llega
// escribiéndola en la URL.
type Pantalla = 'login' | 'cargando' | 'faccion' | 'mapa' | 'asentamiento' | 'legacy';

let pantallaMontada: Pantalla | null = null;
/** Limpieza de la pantalla saliente (listeners globales, etc.). La fija quien monta una pantalla que los
 * necesite (hoy solo el Mapa: `window` resize del zoom/pan). */
let limpiarPantalla: (() => void) | null = null;

function esRutaLegacy(): boolean {
  return location.hash.replace(/^#\/?/, '') === 'legacy';
}

function pantallaActual(): Pantalla {
  if (!estadoCliente.usuarioActivo) return 'login';
  if (esRutaLegacy()) return 'legacy';
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return 'cargando';
  if (proyeccion.faccionId === null) return 'faccion';
  if (proyeccion.asentamientos.length > 0) return 'asentamiento';
  return 'mapa';
}

function montar(pantalla: Pantalla): void {
  limpiarPantalla?.();
  limpiarPantalla = null;
  switch (pantalla) {
    case 'login': renderVistaLogin(); break;
    case 'legacy': montarLegacy(); break;
    case 'cargando': app.innerHTML = '<div class="login-container"><div class="login-card"><p class="login-subtitle">Cargando partida…</p></div></div>'; break;
    case 'faccion': montarFaccion(); break;
    case 'mapa': montarMapa(); break;
    case 'asentamiento': montarAsentamiento(); break;
  }
}

/** Rellena los trozos dinámicos de la pantalla ya montada (el DOM se monta una vez, guard de
 * `pantallaMontada`; aquí se le vuelca la proyección en cada refresco): Mapa vuelve a pintar el canvas,
 * legacy repinta panel + canvas + JSON como hacía antes. */
function refrescarPantalla(pantalla: Pantalla): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  if (pantalla === 'mapa') { void dibujarPantallaSegunModo(proyeccion); renderSeleccionMapa(); renderPanelRiel(); return; }
  if (pantalla === 'asentamiento') { void dibujarPantallaSegunModo(proyeccion); renderPanelEdificios(); renderPanelRecursos(); renderPanelAsent(); return; }
  if (pantalla !== 'legacy') return;
  renderizarPanelInteraccion(proyeccion);
  void dibujarPantallaSegunModo(proyeccion);
  const salida = document.querySelector<HTMLParagraphElement>('#estado');
  const json = document.querySelector<HTMLPreElement>('#proyeccion');
  if (salida) salida.textContent = `Conectado a '${estadoCliente.gameIdActivo}' — ${fechaDeMundo(proyeccion.instante)} | Modo: ${estadoCliente.modoVista} | Facción: ${proyeccion.faccionId ?? '(Ninguna)'}`;
  if (json) json.textContent = JSON.stringify(proyeccion, null, 2);
}

function enrutar(): void {
  const destino = pantallaActual();
  if (destino !== pantallaMontada) {
    montar(destino);
    pantallaMontada = destino;
  }
  refrescarPantalla(destino);
}

function cerrarSesionYVolverALogin(mensaje?: string): void {
  cerrarSesion();
  estadoCliente.usuarioActivo = '';
  estadoCliente.proyeccionUltima = null;
  pantallaMontada = 'login';
  renderVistaLogin(mensaje);
}

function arrancar(): void {
  window.addEventListener('hashchange', enrutar);
  const sesion = cargarSesionLocal();
  if (sesion) {
    estadoCliente.usuarioActivo = sesion.usuario;
    estadoCliente.gameIdActivo = sesion.gameId;
  }
  enrutar();
  if (sesion) {
    void refrescarDatosJuego().catch(() => cerrarSesionYVolverALogin('La sesión previa expiró o el servidor fue reiniciado.'));
  }
}

arrancar();
