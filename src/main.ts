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
import { pintarAsentamiento, pintarPrevisualizacionFundacion, pintarTerreno } from './render';
import type { MapaGenerado } from './terreno';
import { estadoCliente, TIPS_FUNDACION } from './ui/estadoCliente';
import { actualizarTip, resumenRecursosFundacion } from './ui/pestanaAsentamientos';
import { renderPanelInteraccion } from './ui/panelInteraccion';
import { renderPanelMapa } from './ui/panelMapa';

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
  panel.querySelector('#btn-crear-faccion')?.addEventListener('click', () => {
    estadoCliente.modoPanelFaccion = 'crear';
    renderizarPanelInteraccion(proyeccion);
  });
  panel.querySelector('#btn-unirse-faccion')?.addEventListener('click', () => {
    estadoCliente.modoPanelFaccion = 'unirse';
    renderizarPanelInteraccion(proyeccion);
  });
  panel.querySelector('#btn-volver-faccion')?.addEventListener('click', () => {
    estadoCliente.modoPanelFaccion = 'inicio';
    renderizarPanelInteraccion(proyeccion);
  });
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
  const form = panel.querySelector<HTMLFormElement>('#form-crear-faccion');
  form?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const input = panel.querySelector<HTMLInputElement>('#input-nombre-faccion');
    const boton = panel.querySelector<HTMLButtonElement>('#btn-submit-crear-faccion');
    const error = panel.querySelector<HTMLParagraphElement>('#error-faccion');
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
  const lista = panel.querySelector<HTMLDivElement>('#lista-facciones');
  const busqueda = panel.querySelector<HTMLInputElement>('#input-buscar-faccion');
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
      renderVistaJuego();
      await refrescarDatosJuego();
    } catch (err) { renderVistaLogin(mensajeError(err)); }
  });
}

function renderVistaJuego(): void {
  app.innerHTML = `<div class="game-container"><header class="top-bar"><div class="brand-section"><span class="brand-title">Bronze Age Collapse</span><span class="brand-badge">Cliente Jugador</span></div><div class="user-section"><div class="user-info"><div class="user-avatar">${escaparHtml(estadoCliente.usuarioActivo.substring(0, 2).toUpperCase())}</div><div class="details-group"><button id="btn-toggle-proyeccion" class="user-name" type="button" aria-expanded="false" aria-controls="panel-proyeccion">${escaparHtml(estadoCliente.usuarioActivo)}</button><span class="game-id">Partida: <strong>${escaparHtml(estadoCliente.gameIdActivo)}</strong></span></div></div><button id="btn-toggle-vista" class="btn-secondary">🏙️ Ver Ciudad</button><button id="btn-refrescar" class="btn-secondary">🔄 Refrescar</button><button id="btn-logout" class="btn-secondary">Cerrar Sesión</button></div></header><div class="main-content"><div id="panel-interaccion" class="card-panel interaction-panel"><div class="interaction-loading">Cargando opciones de interacción...</div></div><div id="panel-proyeccion" class="card-panel projection-panel" hidden><h2 class="panel-title">Proyección del Jugador (JSON / HTTP)</h2><pre id="proyeccion">Cargando proyección...</pre></div>${renderPanelMapa()}</div></div>`;
  document.querySelector('#btn-logout')?.addEventListener('click', () => { cerrarSesion(); estadoCliente.usuarioActivo = ''; renderVistaLogin(); });
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
  renderizarPanelInteraccion(proyeccion);
  await dibujarPantallaSegunModo(proyeccion);
  const salida = document.querySelector<HTMLParagraphElement>('#estado');
  const json = document.querySelector<HTMLPreElement>('#proyeccion');
  if (salida) salida.textContent = `Conectado a '${estadoCliente.gameIdActivo}' — ${fechaDeMundo(proyeccion.instante)} | Modo: ${estadoCliente.modoVista} | Facción: ${proyeccion.faccionId ?? '(Ninguna)'}`;
  if (json) json.textContent = JSON.stringify(proyeccion, null, 2);
}

function arrancar(): void {
  const sesion = cargarSesionLocal();
  if (!sesion) { renderVistaLogin(); return; }
  estadoCliente.usuarioActivo = sesion.usuario;
  estadoCliente.gameIdActivo = sesion.gameId;
  renderVistaJuego();
  void refrescarDatosJuego().catch(() => { cerrarSesion(); renderVistaLogin('La sesión previa expiró o el servidor fue reiniciado.'); });
}

arrancar();
