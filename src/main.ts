import {
  ApiError,
  alSesionReemplazada,
  retomarSesion,
  cargarSesionLocal,
  cerrarSesion,
  consultarProyeccion,
  ejecutarComando,
  guardarSesionLocal,
  listarPartidas,
  recordarPartida,
  alTickDeMundo,
  tiempoRealVivo,
  radioDeInspeccion,
  abrirPresencia,
  alEventoTiempoReal,
  cerrarPresencia,
  fijarCanalesTiempoReal,
  loginConClave,
  bloqueDeDatos,
  capacidadDeViveres,
  costoDeRefundacion,
  nivelesBandidos,
  registrarCuenta,
  radioDeVision,
  radioDeEncuentro,
  radioDeProteccionMercenarios,
  radioZonaInicial,
  proyeccionAlInstante,
  obtenerMapa,
  obtenerRelieve,
  radiosDeVisionDelServidor,
  unirseAPartida,
  type ProyeccionJugador,
  type RespuestaComando,
} from './apiCliente';
import { pintarVentanaSalida, reiniciarVentanaSalida, type LugarDeSalida } from './ui/ventanaSalida';
import { elegirPestanaHeroe, minutosHerido, pintarPanelHeroe } from './ui/panelHeroe';
import { htmlBarraJugador, type PanelJugador } from './ui/barraJugador';
import { edificioBajoCursor, pintarAsentamiento, pintarMiradas, pintarPrevisualizacionFundacion, pintarTerreno } from './render';
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from './paletas';
import { iconoEdificio } from './ui/iconosEdificio';
import type { Alijo, Asentamiento, BloqueoAscenso, CampamentoBandido, CampamentoMercenarios, CampamentoParaElegir, Edificio, EvaluacionAscenso, Faccion, ParamsCrearHeroe, Sigilo } from './tiposDominio';
import { svgSigilo } from './sigilo/sigilo';
import { alCargarSigilos } from './sigilo/lienzo';
import { cablearCampamento, campamentoActual, htmlSeccionCampamento, seccionesDeCampamento, type SeccionCampamento } from './ui/pantallaCampamento';
import { leyendaPlanoCampamento, svgPlanoCampamento } from './ui/planoCampamento';
import type { MapaGenerado } from './terreno';
import { estadoCliente, medirRitmoDeMundo, TIPS_FUNDACION } from './ui/estadoCliente';
import { actualizarTip, parcelasAlFundar, resumenRecursosFundacion, sitiosDeAldeaAlFundar } from './ui/pestanaAsentamientos';
import { renderPanelInteraccion } from './ui/panelInteraccion';
import { renderPanelMapa } from './ui/panelMapa';
import { htmlLateralFaccion, htmlListaFacciones, PESTANAS_FACCION, renderPestanaFaccion, type PestanaFaccion } from './ui/pestanaFaccion';
import { cablearAnexion } from './ui/panelAnexion';
import { cablearFusion } from './ui/panelFusion';
import { cablearAdmision } from './ui/panelAdmision';
import { cablearFichaBatalla, cablearFichaFormacion, formacionesVisibles, htmlFichaBatalla, htmlFichaFormacion } from './ui/panelBatalla';
import { cablearPanelEjercito, ejercitosDeLaFaccion, htmlFichaEjercito, htmlPanelEjercito, peticionesNuevas } from './ui/ejercitos';
import { invalidar, olvidarEdicion, pintar, vaciar } from './ui/repintado';
import { aplicarAyudas, ayuda } from './ui/ayuda';
import { htmlInformeDeInspeccion } from './ui/interaccionAjena';
import { cablearProduccionYRecetas, cablearVistaCiudad, edificioSeleccionado, htmlProduccionYRecetas, htmlTooltipEdificio, repintarFicha, tipoSeleccionado } from './ui/vistaCiudad';
import { cablearPlegables } from './ui/plegable';
import { FICHAS_MAPA_EXTRA, SELECTORES_MAPA_EXTRA, SUBPESTANAS_CENTRO_EXTRA, SUBPESTANAS_MERCADO_EXTRA, type ContextoPlaza } from './ui/ganchos';
import { montarPartidas } from './ui/pantallaPartidas';
import { cablearCaravanas, cablearOrdenes, htmlCaravanas, htmlOrdenes } from './ui/panelMercado';
import { cablearReclutamiento, htmlReclutamiento } from './ui/reclutamiento';
import { peticionesNuevasConv } from './ui/convocatoria';
import { cablearUnirseDesdePlaza, htmlUnirseDesdePlaza } from './ui/unirseDesdePlaza';
import { cablearCargos } from './ui/panelCargos';
import { cablearDiplomacia } from './ui/panelDiplomacia';
import { instalarZoomPan, type ControlMapa } from './ui/pantallaMapa';
import { agarre, fijarEscalaDeAgarre } from './ui/agarre';
import { estadoDesdeProyeccion, type EstadoVista, type FundacionEnVista, type RadiosDeVision } from './mundo3d/estado';
import { fuenteDesdeMapa, fuenteDesdeRelieve } from './mundo3d/fuente';
import { VistaMundo3D } from './mundo3d/vista';
import { guardarVistaMapa, leerVistaMapa } from './ui/vistaMapaGuardada';
import { alCambiarAvisos, alLlegarInforme, avisarDeEventos, avisosNoLeidos, hayPeligroSinLeer, historialDeAvisos, mostrar as mostrarAviso, reiniciarAvisos } from './ui/avisos';
import { htmlInforme, type InformeDeCombate } from './ui/informeCombate';
import { cablearAvisos, htmlAvisos } from './ui/panelAvisos';
import { cablearCarro, htmlCarro } from './ui/panelCarro';
import { cablearTecnologia, htmlTecnologia } from './ui/panelTecnologia';
import { cablearColumna, htmlColumna } from './ui/panelColumna';
import { cablearPanelIntel, renderPanelIntel } from './ui/panelIntel';
import { cablearMercadoDePlaza, htmlMercadoDePlaza } from './ui/mercadoDePlaza';
import { svgPlanoBandidos } from './ui/planoBandidos';
import { explicarError } from './ui/erroresServidor';
import { motivosParaCrearFaccion } from './ui/validarFaccion';
import { nombreDeHeroe } from './ui/nombres';
import { htmlEstados } from './ui/estados';
import { cablearInteriorPueblo, htmlAlmacenPueblo, htmlAscensoLocal, htmlPestanasPueblo, htmlTrazadoPueblo, nombreDePueblo, puebloActual, selectorDePunto } from './ui/pueblos';
import { pintarSitiosDeAldea, type SitiosDeAldea } from './mundo/fertilidad';
import { htmlMiembrosFaccion, htmlResidentesPlaza } from './ui/participacion';
import { cablearTablon, htmlTablon } from './ui/tablon';
import { actualizarSeguimiento, cablearMisiones, elegirPestanaMisiones, htmlListaMisiones, htmlPanelMisiones, misionesPorReclamar, pintarRastreador } from './ui/misiones';
import { confirmar } from './ui/dialogo';

const app = document.querySelector<HTMLDivElement>('#app')!;
/** Los campamentos donde se puede nacer, de la última respuesta `sinHeroe` (pantalla Héroe). */
let campamentosParaElegir: CampamentoParaElegir[] = [];

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
  return error instanceof ApiError ? explicarError(error.message) : 'No se pudo completar la operación.';
}

/** Un rechazo de dominio como error: el motivo concreto que da el backend (`detalleError`, p. ej. «La columna no lleva soldados con los
 * que atacar.») y, si no lo da, su código, que `mensajeError` traduce. */
function errorDeRechazo(resultado: RespuestaComando['resultado'], porDefecto: string): ApiError {
  return new ApiError(409, resultado.detalleError ?? resultado.codigoError ?? porDefecto);
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

/** Ejecuta un comando y refresca; devuelve el mensaje de error si lo rechaza, o `null` si fue bien. La usan las
 * tres acciones de muralla (Consideraciones/Murallas_Definicion.md) y `crearHeroe`. */
function ejecutarYRefrescar(tipo: string, params: object): Promise<string | null> {
  return aplicarYRefrescar(ejecutarComando(estadoCliente.gameIdActivo, tipo, params));
}

/** Como `ejecutarYRefrescar`, devolviendo además los `datos` del comando (p. ej. lo que sirvió de verdad una compra). */
async function ejecutarConDatosYRefrescar(tipo: string, params: object): Promise<{ error: string | null; datos?: unknown }> {
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, tipo, params);
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'El servidor rechazó la operación.');
    await refrescarDatosJuego();
    return { error: null, datos: respuesta.resultado.datos };
  } catch (err) {
    return { error: mensajeError(err) };
  }
}

/** Lo mismo con la petición ya lanzada, para los wrappers tipados de `apiCliente.ts` (panel del héroe). */
async function aplicarYRefrescar(peticion: Promise<RespuestaComando>): Promise<string | null> {
  try {
    const respuesta = await peticion;
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'El servidor rechazó la operación.');
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
      const mensaje = await ejecutarYRefrescar(tipo, { asentamientoId, ...paramsAlClic() });
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
 * `renderPestanaFaccion` (`ui/pestanaFaccion.ts`): lo usan el panel legacy, el riel del Mapa y la pantalla Campamento.
 * `rerender` repinta ese contenedor tras un cambio de modo (inicio/crear/pedir ingreso); un éxito va por
 * `refrescarDatosJuego`. */
function cablearFaccion(root: ParentNode, proyeccion: ProyeccionJugador, rerender: () => void): void {
  root.querySelector('#btn-crear-faccion')?.addEventListener('click', () => { estadoCliente.modoPanelFaccion = 'crear'; rerender(); });
  root.querySelector('#btn-unirse-faccion')?.addEventListener('click', () => { estadoCliente.modoPanelFaccion = 'unirse'; rerender(); });
  root.querySelector('#btn-volver-faccion')?.addEventListener('click', () => { estadoCliente.modoPanelFaccion = 'inicio'; rerender(); });

  const form = root.querySelector<HTMLFormElement>('#form-crear-faccion');
  const sigiloElegido = (): Sigilo | null => {
    const valor = (id: string) => root.querySelector<HTMLSelectElement>(`#${id}`)?.value ?? '';
    const sigilo = {
      formaId: valor('sigilo-forma'),
      campoId: valor('sigilo-campo'),
      emblemaId: valor('sigilo-emblema'),
      colorPrimarioId: valor('sigilo-color1'),
      colorSecundarioId: valor('sigilo-color2'),
      colorEmblemaId: valor('sigilo-colorEmblema'),
      orlaId: valor('sigilo-orla'),
      colorOrlaId: valor('sigilo-colorOrla'),
    };
    return sigilo.campoId ? sigilo : null;
  };
  /** Enseña TODOS los motivos por los que el backend rechazaría el formulario (él solo dice el primero) y apaga «Crear» mientras haya alguno. */
  const validar = (mostrar = true): string[] => {
    const motivos = motivosParaCrearFaccion(proyeccion, root.querySelector<HTMLInputElement>('#input-nombre-faccion')?.value ?? '', sigiloElegido());
    const aviso = root.querySelector('#error-faccion');
    if (aviso && mostrar) aviso.innerHTML = motivos.length > 0 ? `<ul class="faction-motivos">${motivos.map((m) => `<li>${escaparHtml(m)}</li>`).join('')}</ul>` : '';
    const crear = root.querySelector<HTMLButtonElement>('#btn-submit-crear-faccion');
    if (crear) crear.disabled = motivos.length > 0;
    return motivos;
  };
  root.querySelectorAll('select[id^="sigilo-"]').forEach((select) => select.addEventListener('change', () => {
    const previa = root.querySelector('#sigilo-previa');
    if (previa) previa.innerHTML = svgSigilo(sigiloElegido() ?? undefined, 88);
    validar();
  }));
  root.querySelector('#input-nombre-faccion')?.addEventListener('input', () => validar());
  // Al abrir solo se apaga «Crear» si hace falta; los motivos salen en cuanto se toca algo.
  if (form) validar(false);
  form?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (validar().length > 0) return;
    const input = root.querySelector<HTMLInputElement>('#input-nombre-faccion');
    const boton = root.querySelector<HTMLButtonElement>('#btn-submit-crear-faccion');
    const error = root.querySelector<HTMLParagraphElement>('#error-faccion');
    if (!input || !boton) return;
    boton.disabled = true;
    boton.textContent = 'Creando...';
    try {
      const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'crearFaccion', { nombre: input.value.trim(), sigilo: sigiloElegido() ?? undefined });
      if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'El servidor rechazó la operación.');
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
      const pedir = (faccion: Faccion): string => (faccion.solicitudesIds ?? []).includes(proyeccion.heroeId)
        ? '<span class="faccion-pedido">Pedido: decide su Rey</span>'
        : `<button class="btn-join-faction" type="button" data-faccion-id="${escaparHtml(faccion.id)}">Pedir ingreso</button>`;
      lista.innerHTML = htmlListaFacciones(proyeccion, escaparHtml, { termino: busqueda.value, accion: pedir });
      lista.querySelectorAll<HTMLButtonElement>('.btn-join-faction').forEach((boton) => boton.addEventListener('click', async () => {
        boton.disabled = true;
        boton.textContent = 'Pidiendo...';
        try {
          const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'solicitarIngreso', { faccionId: boton.dataset.faccionId });
          if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'El servidor rechazó la operación.');
          boton.textContent = 'Pedido: decide su Rey';
          await refrescarDatosJuego();
        } catch (err) {
          boton.disabled = false;
          boton.textContent = 'Pedir ingreso';
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

  // El Rey contesta las solicitudes de ingreso (`renderPestanaFaccion`, vista de detalle).
  root.querySelectorAll<HTMLButtonElement>('[data-solicitud]').forEach((boton) => boton.addEventListener('click', async () => {
    boton.disabled = true;
    const mensaje = await ejecutarYRefrescar('responderSolicitud', { faccionId: proyeccion.faccionId, heroeId: boton.dataset.solicitud, aceptar: boton.dataset.aceptar === 'si' });
    if (mensaje) { boton.disabled = false; avisoMapa(mensaje); }
  }));

  cablearAnexion(root, proyeccion, ejecutarYRefrescar, avisoMapa);
  cablearFusion(root, proyeccion, ejecutarYRefrescar, avisoMapa);
  cablearAdmision(root, proyeccion, ejecutarYRefrescar, avisoMapa);
  cablearCargos(root, proyeccion, ejecutarYRefrescar, avisoMapa);
  cablearDiplomacia(root, proyeccion, ejecutarYRefrescar, avisoMapa);
}

/** Punto de entrada de la creación de héroe, para la pantalla provisional y para la definitiva. Con el héroe
 * creado la proyección deja de venir `sinHeroe` y el router sigue solo (Facción si aún no tiene, luego Mapa: el
 * héroe aparece en el mundo con su columna). */
function crearHeroe(params: ParamsCrearHeroe): Promise<string | null> {
  return ejecutarYRefrescar('crearHeroe', params);
}

/** Lo que la pantalla PROVISIONAL manda además del nombre y el campamento — `Spear` es la única clase que tiene hoy
 * Conquest. docs/Features_Pendientes.md §0. */
const HEROE_PROVISIONAL: Omit<ParamsCrearHeroe, 'displayName' | 'campamentoId'> = {
  classDefinitionId: 'Spear',
  genero: 'masculino',
  avatar: { cabezaId: '', peloId: '', barbaId: '', cejasId: '' },
};

/** Pantalla HÉROE: se llega con `sinHeroe` (membresía sin héroe; el backend no admite otro comando que
 * `crearHeroe`). PROVISIONAL: pide el nombre y el campamento de mercenarios donde nace (Doc 1.3); las dos cifras de
 * cada campamento solo informan. */
function montarHeroe(): void {
  const opciones = campamentosParaElegir
    .map((c, i) => `<label class="mapa-lista-item"><div><strong>${escaparHtml(c.id)}</strong><span>(${Math.round(c.posicion.x)}, ${Math.round(c.posicion.y)}) · lo eligieron ${c.eligieronComoInicial} · residen ${c.residentes}</span></div><input type="radio" name="campamento" value="${escaparHtml(c.id)}"${i === 0 ? ' checked' : ''} /></label>`)
    .join('');
  app.innerHTML = `<div class="login-container"><div class="login-card">
    <div class="login-header"><h1 class="login-title">Tu héroe${ayuda('heroe:crear', 'Nace dentro de un campamento de mercenarios.')}</h1></div>
    <form id="form-crear-heroe">
      <div class="form-group"><label class="form-label" for="input-nombre-heroe">Nombre</label><input type="text" id="input-nombre-heroe" class="form-input" required maxlength="24" autocomplete="off" /></div>
      <div class="form-group"><span class="form-label">Campamento</span><div class="mapa-lista">${opciones || '<p class="mapa-lista-vacia">Esta partida no tiene campamentos.</p>'}</div></div>
      <button type="submit" id="btn-crear-heroe" class="btn-primary">Crear héroe</button>
      <p id="error-heroe" class="faction-error" role="alert"></p>
    </form>
  </div><button id="btn-partidas" class="text-link" type="button">Cambiar de partida</button> <button id="btn-logout" class="text-link" type="button">Cerrar sesión</button></div>`;
  aplicarAyudas(app);
  document.querySelector('#btn-partidas')?.addEventListener('click', () => volverALasPartidas());
  document.querySelector('#btn-logout')?.addEventListener('click', () => cerrarSesionYVolverALogin());
  document.querySelector<HTMLFormElement>('#form-crear-heroe')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nombre = document.querySelector<HTMLInputElement>('#input-nombre-heroe')?.value.trim() ?? '';
    const boton = document.querySelector<HTMLButtonElement>('#btn-crear-heroe');
    if (boton) boton.disabled = true;
    const campamentoId = document.querySelector<HTMLInputElement>('input[name="campamento"]:checked')?.value ?? '';
    const mensaje = await crearHeroe({ ...HEROE_PROVISIONAL, displayName: nombre, campamentoId });
    if (!mensaje) return;
    if (boton) boton.disabled = false;
    const error = document.querySelector<HTMLElement>('#error-heroe');
    if (error) error.textContent = mensaje;
  });
}

/** Subpestaña abierta de la pantalla Campamento (como las del panel del asentamiento). */
let seccionCamp: SeccionCampamento = 'resumen';

/** Pantalla CAMPAMENTO: dentro de un campamento de mercenarios (Doc 1.9b), donde se nace. Como la del asentamiento: la planta a la izquierda y,
 * a la derecha, subpestañas. Lo del jugador (héroe, escuadras, Facción: crear o pedir ingreso) está en la barra superior. */
function montarCampamento(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const campamento = proyeccion && campamentoActual(proyeccion);
  if (!proyeccion || !campamento) { montar('cargando'); return; }
  menuEsquinaAbierto = false;
  seccionCamp = 'resumen';
  app.innerHTML = `<div class="asent-screen camp-screen">
    ${htmlBarraJugador(proyeccion, escaparHtml)}
    <header class="asent-barra">
      <span class="asent-nombre">Campamento ${escaparHtml(campamento.id)}</span>
      <span class="asent-nivel" id="camp-residencia"></span>
      <div class="asent-barra-acciones"><button id="btn-salir-mundo" class="btn-primary" type="button">Salir al mundo</button></div>
    </header>
    <div class="asent-cuerpo">
      <aside class="asent-izq"><div class="camp-leyenda-caja"></div></aside>
      <div class="asent-mapa"><div class="asent-lienzo camp-lienzo"></div></div>
      <aside class="asent-lado"><div class="camp-lado"></div></aside>
    </div>
    ${HTML_VELO_SALIDA}
    <aside class="jugador-panel" hidden></aside>
    ${menuEsquinaHtml()}
  </div>`;
  const contenedor = app.querySelector<HTMLElement>('.asent-screen')!;
  cablearMenuEsquina(contenedor);
  cablearBarraJugador(contenedor);
  contenedor.querySelector('#btn-salir-mundo')?.addEventListener('click', abrirVentanaSalida);
  // Sin tiempo real de datos, el campamento (mercado, fondo, avisos) se pone al día con el mismo sondeo suave que el asentamiento.
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.camp-screen') || !hayQueSondear()) return;
    sondeando = true;
    void refrescarDatosJuego().catch(() => {}).finally(() => { sondeando = false; });
  }, 3000);
  limpiarPantalla = () => clearInterval(sondeo);
}

/** Pantalla de DENTRO DE UN PUEBLO o una aldea (`entrarEnPueblo`), con la forma de la de la plaza: el trazado al centro, el almacén debajo y las
 * pestañas a la derecha. «Salir al mundo» abre la ventana común. */
function montarPueblo(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const pueblo = proyeccion && puebloActual(proyeccion);
  if (!proyeccion || !pueblo) { montar('cargando'); return; }
  menuEsquinaAbierto = false;
  app.innerHTML = `<div class="asent-screen pueblo-screen">
    ${htmlBarraJugador(proyeccion, escaparHtml)}
    <header class="asent-barra">
      <span class="asent-nombre">${escaparHtml(nombreDePueblo(pueblo))}</span><span class="asent-nivel">De visita</span>
      <div class="asent-barra-acciones"><button id="btn-salir-mundo" class="btn-primary" type="button">Salir al mundo</button></div>
    </header>
    <div class="asent-cuerpo">
      <div class="asent-centro">
        <div class="asent-mapa"><div class="asent-lienzo pueblo-lienzo"></div></div>
        <div class="asent-recursos pueblo-almacen"></div>
      </div>
      <aside class="asent-lado"><div class="pueblo-lado"></div></aside>
    </div>
    ${HTML_VELO_SALIDA}
    <aside class="jugador-panel" hidden></aside>
    ${menuEsquinaHtml()}
  </div>`;
  const contenedor = app.querySelector<HTMLElement>('.asent-screen')!;
  cablearMenuEsquina(contenedor);
  cablearBarraJugador(contenedor);
  contenedor.querySelector('#btn-salir-mundo')?.addEventListener('click', abrirVentanaSalida);
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.pueblo-screen') || !hayQueSondear()) return;
    sondeando = true;
    void refrescarDatosJuego().catch(() => {}).finally(() => { sondeando = false; });
  }, 3000);
  limpiarPantalla = () => clearInterval(sondeo);
}

function pintarPueblo(p: ProyeccionJugador): void {
  const pueblo = puebloActual(p);
  const lienzo = app.querySelector<HTMLElement>('.pueblo-lienzo');
  const almacen = app.querySelector<HTMLElement>('.pueblo-almacen');
  const lado = app.querySelector<HTMLElement>('.pueblo-lado');
  if (!pueblo || !lienzo || !almacen || !lado) return;
  const repintar = (): void => { const q = estadoCliente.proyeccionUltima; if (q) pintarPueblo(q); };
  pintar(lienzo, htmlTrazadoPueblo(p, pueblo, escaparHtml), undefined, 'pueblo-trazado');
  pintar(almacen, htmlAlmacenPueblo(pueblo, escaparHtml), undefined, 'pueblo-almacen');
  pintar(lado, htmlPestanasPueblo(p, pueblo, escaparHtml), () => cablearInteriorPueblo(lado, p, pueblo, ejecutarYRefrescar, repintar), 'pueblo');
}

/** Vuelca la proyección en la pantalla Campamento (en cada refresco). No toca el DOM de lo que no cambió, para no llevarse lo que se escribe. */
function pintarCampamento(p: ProyeccionJugador, campamento: CampamentoMercenarios): void {
  const lienzo = app.querySelector<HTMLElement>('.camp-lienzo');
  const leyenda = app.querySelector<HTMLElement>('.camp-leyenda-caja');
  const lado = app.querySelector<HTMLElement>('.camp-lado');
  if (!lienzo || !lado) return;
  // La planta de ESTE campamento: el héroe puede tener el ámbito de más de uno (donde reside y donde está), y antes se tomaba el primero que
  // saliera, que según el orden de llegada era este o el otro: la planta aparecía y desaparecía. Si en un refresco aún no está, se deja la que
  // hay en vez de vaciar el lienzo.
  const escena = p.escenasCampamento.find((e) => e.campamentoId === campamento.id);
  const plano = escena ? svgPlanoCampamento(escena) : '';
  if (plano && lienzo.dataset.pintado !== plano) { lienzo.innerHTML = plano; lienzo.dataset.pintado = plano; if (leyenda && escena) leyenda.innerHTML = leyendaPlanoCampamento(escena); }
  const residencia = app.querySelector<HTMLElement>('#camp-residencia');
  if (residencia) residencia.textContent = campamento.residentesIds.includes(p.heroeId) ? 'Tu residencia' : 'De paso';

  costoDeRefundacion(() => { invalidar(lado); if (estadoCliente.proyeccionUltima) pintarCampamento(estadoCliente.proyeccionUltima, campamento); });
  const secciones = seccionesDeCampamento(p);
  if (!secciones.some((x) => x.id === seccionCamp)) seccionCamp = 'resumen';
  const html = `<div class="asent-tabs asent-tabs-ancho">${secciones.map((x) => `<button class="asent-tab${x.id === seccionCamp ? ' activo' : ''}" type="button" data-seccion="${x.id}">${x.etiqueta}</button>`).join('')}</div>
    <div class="asent-lado-cuerpo">${htmlSeccionCampamento(seccionCamp, p, campamento, escaparHtml)}</div>
    <p id="camp-error" class="faction-error" role="alert"></p>`;
  // Solo se repinta si cambió el HTML, y lo que el jugador tenía marcado o escrito vuelve a su sitio (`ui/repintado.ts`); cada pestaña es un ámbito.
  pintar(lado, html, () => {
    lado.querySelectorAll<HTMLButtonElement>('.asent-tab').forEach((boton) => boton.addEventListener('click', () => {
      seccionCamp = boton.dataset.seccion as SeccionCampamento;
      if (estadoCliente.proyeccionUltima) pintarCampamento(estadoCliente.proyeccionUltima, campamento);
    }));
    cablearCampamento(lado, p, campamento, ejecutarYRefrescar, {
      ejecutarConDatos: ejecutarConDatosYRefrescar,
      repintar: () => { olvidarEdicion(lado); if (estadoCliente.proyeccionUltima) pintarCampamento(estadoCliente.proyeccionUltima, campamento); },
    });
  }, seccionCamp);
  const taberna = lado.querySelector<HTMLElement>('#camp-taberna');
  if (taberna) pintarIntel(taberna, p, () => pintarCampamento(p, campamento));
}

/** La columna en la que MARCHA el jugador (Doc 5.12.2) — su posición en el mundo. `undefined` mientras esté
 * en una plaza o desconectado. */
function miColumna(proyeccion: ProyeccionJugador) {
  return proyeccion.ejercitos.find((ejercito) => ejercito.participantes.some((p) => p.heroeId === proyeccion.heroeId));
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
  const RADIO = agarre(45); // unidades de mundo — un pelo más que el glifo del asentamiento (`ui/agarre.ts`)
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

/** El campamento de bandidos más cercano al punto clicado, dentro de un radio de agarre, o `null`. Los que viajan
 * son solo los que se ven ahora (no tienen memoria). */
function campamentoCercaDe(punto: { x: number; y: number }, proyeccion: ProyeccionJugador): CampamentoBandido | null {
  const distancia = (c: CampamentoBandido): number => Math.hypot(c.posicion.x - punto.x, c.posicion.y - punto.y);
  return proyeccion.campamentosBandidos.filter((c) => distancia(c) < agarre(25)).sort((a, b) => distancia(a) - distancia(b))[0] ?? null;
}

/** El elemento de `lista` más cercano al punto clicado, dentro de un radio de agarre, o `null`. */
function cercano<T extends { posicion: { x: number; y: number } }>(lista: readonly T[], punto: { x: number; y: number }, radio: number): T | null {
  const distancia = (c: T): number => Math.hypot(c.posicion.x - punto.x, c.posicion.y - punto.y);
  return lista.filter((c) => distancia(c) < radio).sort((a, b) => distancia(a) - distancia(b))[0] ?? null;
}

/** A qué distancia se ataca: `LOGISTICA.radioEncuentro` de los datos de juego del motor (3 hoy; el backend TypeScript usaba 15), para avisar
 * antes de mandar la orden. El que decide es el motor. */
const radioDeAtaque = (): number => radioDeEncuentro();

/** Punto de MUNDO bajo un clic en el lienzo de `#/legacy`, que enseña el mundo entero. */
function puntoDeMapa(evento: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, mapa: MapaGenerado): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evento.clientX - rect.left) / rect.width) * mapa.config.ancho,
    y: ((evento.clientY - rect.top) / rect.height) * mapa.config.alto,
  };
}

/** Lo seleccionado en el mapa —un asentamiento o un campamento de bandidos— (abre el panel de Selección). Fuera del
 * `estadoCliente` porque solo vive mientras la pantalla Mapa está montada. */
let seleccionMapa: { tipo: string; id: string } | null = null; // 'asentamiento' | 'campamento' | 'mercenarios' | 'alijo' | 'batalla' | 'formacion' | 'ejercito' o el `tipo` de una `FICHAS_MAPA_EXTRA`
let avisoMapaTimer: ReturnType<typeof setTimeout> | undefined;

function avisoMapa(texto: string): void {
  const el = document.querySelector<HTMLElement>('.mapa-aviso');
  // Fuera del mapa (campamento, plaza) no hay `.mapa-aviso`: el mensaje se perdía en silencio y el botón parecía no hacer nada.
  if (!el) { mostrarAviso(texto, true); return; }
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisoMapaTimer);
  avisoMapaTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

type Objetivo = { tipo: 'punto'; punto: { x: number; y: number } } | { tipo: 'asentamiento'; id: string };

/** Qué hay bajo un clic en `punto` (unidades de mundo): qué se selecciona y adónde se marcha. `null`: suelo vacío. Lo usan el modo mundo y el modo
 * mapa (en este, solo los elementos: un clic en el suelo no mueve a nadie). */
function objetoBajoElClic(proy: ProyeccionJugador, punto: { x: number; y: number }): { seleccion: { tipo: string; id: string }; ir?: Objetivo } | null {
  for (const selector of SELECTORES_MAPA_EXTRA) {
    const bajo = selector(proy, punto);
    if (bajo) return { seleccion: { tipo: bajo.tipo, id: bajo.id }, ir: bajo.ir };
  }
  const batalla = cercano((proy.batallas ?? []).map((b) => ({ ...b, posicion: b.punto })), punto, agarre(20));
  if (batalla) return { seleccion: { tipo: 'batalla', id: batalla.battleId }, ir: { tipo: 'punto', punto: batalla.punto } };
  const formacion = cercano(formacionesVisibles(proy).filter((e) => !('dentroDe' in e && e.dentroDe)).map((e) => ({ ...e, posicion: e.posicionActual })), punto, agarre(20));
  if (formacion) return { seleccion: { tipo: 'formacion', id: formacion.id }, ir: { tipo: 'punto', punto: formacion.posicionActual } };
  const delEjercito = cercano(ejercitosDeLaFaccion(proy).filter((x) => !x.formacion && !x.dentroDe).map((x) => ({ ...x, posicion: x.posicionActual })), punto, agarre(20));
  if (delEjercito) return { seleccion: { tipo: 'ejercito', id: delEjercito.id }, ir: { tipo: 'punto', punto: delEjercito.posicionActual } };
  const alijo = cercano(proy.alijos ?? [], punto, agarre(15));
  if (alijo) return { seleccion: { tipo: 'alijo', id: alijo.id }, ir: { tipo: 'punto', punto: alijo.posicion } };
  const mercenarios = cercano(proy.campamentosMercenarios ?? [], punto, agarre(30));
  if (mercenarios) return { seleccion: { tipo: 'mercenarios', id: mercenarios.id }, ir: { tipo: 'punto', punto: mercenarios.posicion } };
  const campamento = campamentoCercaDe(punto, proy);
  if (campamento) return { seleccion: { tipo: 'campamento', id: campamento.id }, ir: { tipo: 'punto', punto: campamento.posicion } };
  const asentamiento = asentamientoCercaDe(punto, proy);
  if (asentamiento) return { seleccion: { tipo: 'asentamiento', id: asentamiento.id }, ir: { tipo: 'asentamiento', id: asentamiento.id } };
  return null;
}

async function marcharAObjetivo(objetivo: Objetivo): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  // Un ejército lo dirige su Líder con sus clics (backend 2026-10-08); una formación sin 3 héroes no se mueve. Si el clic abrió una ficha, no se avisa.
  const mia = miColumna(proyeccion);
  const impide = mia?.formacion ? 'Una formación espera a ser un ejército (hacen falta 3 héroes): no se mueve.' : mia?.tipo === 'ejercito' && mia.liderId !== proyeccion.heroeId ? 'Solo el Líder decide a dónde va el ejército.' : '';
  if (impide) { if (seleccionMapa === null) avisoMapa(impide); return; }
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'marcharA', { heroeId: proyeccion.heroeId, objetivo });
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'El servidor rechazó la marcha.');
    await refrescarDatosJuego();
  } catch (err) {
    avisoMapa(mensajeError(err));
  }
}

/** Repinta el panel de Selección según `seleccionMapa`. Se llama al montar el Mapa y en cada refresco (para
 * que "Entrar" refleje si la columna ya llegó a la puerta — el backend es quien de verdad lo valida). */
/** El último rechazo de una acción de la ficha abierta: la ficha se repinta con cada sondeo y se llevaba el mensaje, así que se guarda aquí y se vuelve a poner. */
let errorSeleccion: { clave: string; texto: string } | null = null;
const claveSeleccion = (): string => (seleccionMapa ? `${seleccionMapa.tipo}:${seleccionMapa.id}` : '');

function fijarErrorSeleccion(cont: HTMLElement, texto: string | null): void {
  errorSeleccion = texto ? { clave: claveSeleccion(), texto } : null;
  const error = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
  if (error) error.textContent = texto ?? '';
}

function renderSeleccionMapa(): void {
  renderSeleccionMapaCuerpo();
  const cont = document.querySelector<HTMLElement>('.mapa-seleccion');
  if (errorSeleccion && errorSeleccion.clave !== claveSeleccion()) errorSeleccion = null;
  const error = cont?.querySelector<HTMLElement>('#mapa-seleccion-error');
  if (error && errorSeleccion) error.textContent = errorSeleccion.texto;
}

function renderSeleccionMapaCuerpo(): void {
  const cont = document.querySelector<HTMLElement>('.mapa-seleccion');
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!cont) return;
  const batalla = seleccionMapa?.tipo === 'batalla' ? proyeccion?.batallas?.find((b) => b.battleId === seleccionMapa!.id) : undefined;
  if (proyeccion && batalla) {
    cont.hidden = false;
    if (!pintar(cont, htmlFichaBatalla(proyeccion, batalla, alcanceDeAtaque(proyeccion, batalla.punto).impide, escaparHtml), undefined, claveSeleccion())) return;
    cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
    cablearFichaBatalla(cont, proyeccion, batalla, ejecutarYRefrescar, avisoMapa);
    return;
  }
  const formacion = seleccionMapa?.tipo === 'formacion' ? (proyeccion ? formacionesVisibles(proyeccion) : []).find((e) => e.id === seleccionMapa!.id) : undefined;
  if (proyeccion && formacion) {
    cont.hidden = false;
    if (!pintar(cont, htmlFichaFormacion(proyeccion, formacion, escaparHtml), undefined, claveSeleccion())) return;
    cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
    cablearFichaFormacion(cont, proyeccion, formacion, ejecutarYRefrescar, avisoMapa);
    return;
  }
  const ejercito = seleccionMapa?.tipo === 'ejercito' ? proyeccion?.ejercitos.find((x) => x.id === seleccionMapa!.id) : undefined;
  if (proyeccion && ejercito) {
    cont.hidden = false;
    if (!pintar(cont, htmlFichaEjercito(proyeccion, ejercito, escaparHtml), undefined, claveSeleccion())) return;
    cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
    cablearPanelEjercito(cont, proyeccion, ejecutarYRefrescar, avisoMapa);
    return;
  }
  const campamento = seleccionMapa?.tipo === 'campamento' ? proyeccion?.campamentosBandidos.find((c) => c.id === seleccionMapa!.id) : undefined;
  if (proyeccion && campamento) {
    cont.hidden = false;
    renderSeleccionCampamento(cont, proyeccion, campamento);
    return;
  }
  const mercenarios = seleccionMapa?.tipo === 'mercenarios' ? proyeccion?.campamentosMercenarios.find((c) => c.id === seleccionMapa!.id) : undefined;
  if (proyeccion && mercenarios) {
    cont.hidden = false;
    renderSeleccionMercenarios(cont, proyeccion, mercenarios);
    return;
  }
  const alijo = seleccionMapa?.tipo === 'alijo' ? proyeccion?.alijos.find((a) => a.id === seleccionMapa!.id) : undefined;
  if (proyeccion && alijo) {
    cont.hidden = false;
    renderSeleccionAlijo(cont, alijo);
    return;
  }
  for (const ficha of FICHAS_MAPA_EXTRA) {
    if (!proyeccion || seleccionMapa?.tipo !== ficha.tipo) continue;
    const objeto = ficha.buscar(proyeccion, seleccionMapa.id);
    if (objeto === undefined || objeto === null) break; // ya no está: se cierra más abajo
    cont.hidden = false;
    const ctx = { ejecutar: ejecutarYRefrescar, ejecutarConDatos: ejecutarConDatosYRefrescar, repintar: renderSeleccionMapa, aviso: avisoMapa, cerrar: () => { seleccionMapa = null; renderSeleccionMapa(); }, escapar: escaparHtml };
    if (!pintar(cont, ficha.html(proyeccion, objeto as never, ctx), undefined, claveSeleccion())) return;
    cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', ctx.cerrar);
    ficha.cablear?.(cont, proyeccion, objeto as never, ctx);
    return;
  }
  const asentamiento = seleccionMapa?.tipo === 'asentamiento' && proyeccion
    ? asentamientosDelMapa(proyeccion).find((a) => a.id === seleccionMapa!.id)
    : undefined;
  if (!asentamiento || !proyeccion) {
    seleccionMapa = null;
    cont.hidden = true;
    vaciar(cont);
    return;
  }
  const faccion = proyeccion.facciones.find((f) => f.id === asentamiento.faccionId);
  const propio = asentamiento.faccionId === proyeccion.faccionId;
  const ataque = propio ? null : alcanceDeAtaque(proyeccion, asentamiento.posicion, true);
  const miCol = miColumna(proyeccion);
  const entraEjercito = miCol !== undefined && (miCol.tipo === 'ejercito' || miCol.participantes.length > 1);
  const soyLider = miCol?.liderId === proyeccion.heroeId;
  // Solo un ejército abre un asedio (backend Doc 5.15.1b): una columna personal puede unirse a uno abierto desde su batalla en el mapa.
  if (ataque && !ataque.impide && miColumna(proyeccion)?.tipo === 'personal') ataque.impide = 'Solo un ejército abre un asedio: tu columna personal puede unirse a uno ya abierto.';
  cont.hidden = false;
  // Lo largo (cómo entra un ejército, qué es atacar) va tras ⓘ; el motivo de una línea de un botón apagado se queda a la vista.
  const motivoEntrada = !entraEjercito ? '' : !propio ? 'Un ejército solo entra entero en una plaza de su Facción.' : soyLider ? '' : 'Solo el Líder hace entrar al ejército.';
  const motivoAtaque = ataque ? ataque.impide : '';
  const motivoInspeccion = ataque?.distancia == null ? 'Sal al mundo con tu columna para mirar de cerca.'
    : ataque.distancia > radioDeInspeccion() ? `Acércate: estás a ${ataque.distancia} y se inspecciona a ${radioDeInspeccion()}. Su Facción recibe un aviso.` : '';
  const ayudaPlaza = [
    entraEjercito && propio && soyLider ? 'Tu ejército entra entero y se desarma: los que residen aquí entran como siempre; los demás, de visita. Si lleva caravanas adjuntas, tienen que ser de esta plaza.' : '',
    ataque && !motivoAtaque ? 'Atacar es asediarla: si cae pasa a tu Facción; si aguanta, quedas herido.' : '',
    motivoAtaque.length > 70 ? motivoAtaque : '',
  ].filter(Boolean).map(escaparHtml).join('<br>');
  if (!pintar(cont, `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${propio ? 'Tu asentamiento' : 'Asentamiento'}${asentamiento.recordado !== null ? ' · recordado' : ''}${ayudaPlaza ? ayuda('mapa:ficha-plaza', ayudaPlaza) : ''}</span>
    <h3>${escaparHtml(asentamiento.nombre ?? asentamiento.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Facción</span><strong>${escaparHtml(faccion?.nombre ?? asentamiento.faccionId)}</strong></div>
      <div><span>Nivel</span><strong>${asentamiento.nivel}</strong></div>
      ${asentamiento.recordado !== null ? `<div><span>Visto</span><strong>${escaparHtml(fechaDeMundo(asentamiento.recordado))}</strong></div>` : ''}
      ${ataque?.distancia != null ? `<div><span>Distancia</span><strong>${ataque.distancia}</strong></div>` : ''}
    </div>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-entrar-asent" class="btn-primary" type="button"${entraEjercito && (!propio || !soyLider) ? ` disabled title="${escaparHtml(motivoEntrada)}"` : ''}>${entraEjercito ? 'Entrar con el ejército' : 'Entrar'}</button>
      ${ataque ? `<button id="btn-atacar-asent" class="btn-primary" type="button"${ataque.impide ? ` disabled title="${escaparHtml(ataque.impide)}"` : ''}>Atacar</button>` : ''}
      ${ataque && asentamiento.recordado === null ? `<button id="btn-inspeccionar-asent" class="btn-secondary" type="button"${motivoInspeccion ? ` disabled title="${escaparHtml(motivoInspeccion)}"` : ''}>Inspeccionar</button>` : ''}
    </div>
    ${!propio ? htmlInformeDeInspeccion(proyeccion, 'asentamiento', asentamiento.id, escaparHtml) : ''}
    ${motivoEntrada ? `<p class="mapa-lista-vacia">${motivoEntrada}</p>` : ''}
    ${motivoAtaque && motivoAtaque.length <= 70 ? `<p class="mapa-lista-vacia">${escaparHtml(motivoAtaque)}</p>` : ''}
    ${htmlMercadoDePlaza(proyeccion, asentamiento.id, escaparHtml)}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cablearMercadoDePlaza(cont, asentamiento.id, { ejecutarConDatos: ejecutarConDatosYRefrescar, aviso: avisoMapa }, proyeccion.heroeId);
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector<HTMLButtonElement>('#btn-inspeccionar-asent')?.addEventListener('click', async (evento) => {
    const boton = evento.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const { error } = await ejecutarConDatosYRefrescar('inspeccionar', { heroeId: proyeccion.heroeId, objetivo: { tipo: 'asentamiento', id: asentamiento.id } });
    if (error) { boton.disabled = false; fijarErrorSeleccion(cont, error); } else avisoMapa('Miras de cerca: su Facción recibe un aviso.');
  });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'asentamiento', id: asentamiento.id }));
  cont.querySelector<HTMLButtonElement>('#btn-atacar-asent')?.addEventListener('click', (evento) => void atacarPlaza(cont, evento.currentTarget as HTMLButtonElement, asentamiento.id));
  cont.querySelector('#btn-entrar-asent')?.addEventListener('click', async () => {
    try {
      // Un ejército entra entero y se desarma (`guarnecer`); una columna personal, por la puerta de siempre.
      const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, entraEjercito ? 'guarnecer' : 'entrarEnAsentamiento', { asentamientoId: asentamiento.id, heroeId: proyeccion.heroeId });
      if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'No se pudo entrar.');
      errorSeleccion = null;
      seleccionMapa = null;
      await refrescarDatosJuego(); // si entró, el router lleva a la pantalla Asentamiento
    } catch (err) {
      fijarErrorSeleccion(cont, mensajeError(err));
    }
  });
}

/** Ficha de un campamento de bandidos (Doc 1.9): se ataca con la columna, llegando hasta él. Si cae, su botín va al
 * carro; si aguanta, el héroe queda herido y la columna pierde la mitad del carro. */
/** A qué distancia está tu columna de `punto` y, si no puedes atacarlo, por qué (vacío = puedes). Es solo un aviso:
 * el que decide es el backend. */
/** `conSoldados`: solo un asedio pide soldados en la columna (Combate §6 del motor: «un héroe solo no abre un asedio»); contra bandidos el héroe
 * suma su poder (15) y puede atacar sin tropa. */
function alcanceDeAtaque(proyeccion: ProyeccionJugador, punto: { x: number; y: number }, conSoldados = false): { distancia: number | null; impide: string } {
  const columna = miColumna(proyeccion);
  const distancia = columna ? Math.round(Math.hypot(columna.posicionActual.x - punto.x, columna.posicionActual.y - punto.y)) : null;
  const herido = minutosHerido(proyeccion);
  // Yendo solo, sin soldados vivos en la columna no hay con qué atacar (en un ejército pueden ponerlos los demás).
  const sinSoldados = conSoldados && columna !== undefined && columna.participantes.length === 1
    && !proyeccion.heroe.escuadrones.some((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === columna.id && s.cantidad > 0);
  const cerca = (a: { x: number; y: number }) => proyeccion.campamentosMercenarios.find((c) => Math.hypot(c.posicion.x - a.x, c.posicion.y - a.y) <= radioDeProteccionMercenarios());
  const protegido = columna ? cerca(columna.posicionActual) ?? cerca(punto) : undefined;
  const impide =
    herido !== null ? `Estás herido (${herido} min): no puedes atacar.`
      : distancia === null ? 'Sal al mundo con tu columna para atacar.'
        : distancia > radioDeAtaque() ? `Acércate: estás a ${distancia} y se ataca a ${radioDeAtaque()}.`
          : sinSoldados ? 'Tu columna no lleva soldados vivos: sal del campamento con tropa para atacar.'
            : protegido ? `Estás a menos de ${radioDeProteccionMercenarios()} del campamento de mercenarios ${protegido.id}: a su lado nadie inicia un combate.`
              : '';
  return { distancia, impide };
}

/** Atacar una plaza de otra Facción es asediarla (Doc 5.12.4): llegar a ella solo es acampar delante. Una batalla,
 * cuando se ordena; si cae pasa a tu Facción, y si aguanta quedas herido. */
async function atacarPlaza(cont: HTMLElement, boton: HTMLButtonElement, asentamientoId: string): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  boton.disabled = true;
  const mensaje = await ejecutarYRefrescar('atacar', { heroeId: proyeccion.heroeId, objetivo: { tipo: 'asentamiento', id: asentamientoId } });
  if (mensaje) {
    boton.disabled = false;
    const error = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
    if (error) error.textContent = mensaje;
    return;
  }
  const despues = estadoCliente.proyeccionUltima;
  const enBatalla = despues?.batallas?.some((b) => b.ladoPropio !== undefined && b.contexto.asentamientoId === asentamientoId);
  const caida = despues && asentamientosDelMapa(despues).find((a) => a.id === asentamientoId)?.faccionId === despues.faccionId;
  // Sin combate (sin tropa a ninguno de los dos lados) la plaza aguanta y nadie queda herido: se mira, no se supone.
  const herido = despues && minutosHerido(despues) !== null;
  avisoMapa(enBatalla ? 'Empieza la batalla por la plaza.' : caida ? 'La plaza cae: ahora es de tu Facción.' : herido ? 'La plaza aguanta: quedas herido.' : 'La plaza aguanta.');
}

function renderSeleccionCampamento(cont: HTMLElement, proyeccion: ProyeccionJugador, campamento: CampamentoBandido): void {
  const { distancia, impide } = alcanceDeAtaque(proyeccion, campamento.posicion);
  const nivel = nivelesBandidos(() => renderSeleccionMapa())?.[String(campamento.nivel)];
  const acosa = campamento.asentamientoId
    ? `a ${escaparHtml(asentamientosDelMapa(proyeccion).find((a) => a.id === campamento.asentamientoId)?.nombre ?? campamento.asentamientoId)}`
    : campamento.campamentoMercenariosId ? `al campamento ${escaparHtml(campamento.campamentoMercenariosId)}` : '';
  if (!pintar(cont, `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Campamento de bandidos${ayuda('mapa:ficha-bandidos', `Plano esquemático: el servidor no publica el trazado de los campamentos de bandidos. El botín decrece si se destruyen muchos en un día. ${impide.length > 70 ? `${escaparHtml(impide)} ` : ''}Si cae, su oro va al carro de tu columna (lo que no quepa se pierde). Si aguanta, quedas herido y pierdes la mitad del carro.`)}</span>
    <h3>Bandidos · nivel ${campamento.nivel}</h3>
    <div class="bandidos-nivel" title="Nivel ${campamento.nivel} de 3">${[1, 2, 3].map((n) => `<i${n <= campamento.nivel ? ' class="on"' : ''}></i>`).join('')}<span>Nivel ${campamento.nivel} de 3</span></div>
    ${svgPlanoBandidos(campamento)}
    <div class="mapa-seleccion-datos">
      <div><span>Nivel</span><strong>${campamento.nivel}</strong></div>
      <div><span>Poder</span><strong>${campamento.poder}</strong></div>
      ${nivel ? `<div><span>Defensores</span><strong>${nivel.unidades}</strong></div><div><span>Botín por héroe</span><strong>${nivel.oroPorHeroe} de oro</strong></div>` : ''}
      ${distancia !== null ? `<div><span>Distancia</span><strong>${distancia}</strong></div>` : ''}
      ${acosa ? `<div><span>Acosa</span><strong>${acosa}</strong></div>` : ''}
    </div>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-atacar-campamento" class="btn-primary" type="button"${impide ? ` disabled title="${escaparHtml(impide)}"` : ''}>Atacar</button>
    </div>
    ${impide && impide.length <= 70 ? `<p class="mapa-lista-vacia">${escaparHtml(impide)}</p>` : ''}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'punto', punto: campamento.posicion }));
  cont.querySelector<HTMLButtonElement>('#btn-atacar-campamento')?.addEventListener('click', async (evento) => {
    const boton = evento.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const mensaje = await ejecutarYRefrescar('atacar', { heroeId: proyeccion.heroeId, objetivo: { tipo: 'campamento', id: campamento.id } });
    if (mensaje) {
      boton.disabled = false;
      const error = cont.querySelector<HTMLElement>('#mapa-seleccion-error');
      if (error) error.textContent = mensaje;
      return;
    }
    const sigue = estadoCliente.proyeccionUltima?.campamentosBandidos.some((c) => c.id === campamento.id);
    avisoMapa(sigue ? 'El campamento aguanta: quedas herido y pierdes la mitad del carro.' : 'Campamento destruido: su oro va a tu carro.');
  });
}

/** Una acción de la ficha de Selección: manda el comando y, si lo rechaza, deja el motivo en `#mapa-seleccion-error`. */
function cablearAccionSeleccion(cont: HTMLElement, selector: string, tipo: string, params: object, alAcabar?: () => void): void {
  cont.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', async (evento) => {
    const boton = evento.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const mensaje = await ejecutarYRefrescar(tipo, params);
    boton.disabled = false;
    fijarErrorSeleccion(cont, mensaje);
    if (!mensaje) alAcabar?.();
  });
}

/** Ficha de un campamento de mercenarios (Doc 1.9b): enclave neutral, cualquiera entra con su columna a la puerta. */
function renderSeleccionMercenarios(cont: HTMLElement, proyeccion: ProyeccionJugador, campamento: CampamentoMercenarios): void {
  const columna = miColumna(proyeccion);
  const distancia = columna ? Math.round(Math.hypot(columna.posicionActual.x - campamento.posicion.x, columna.posicionActual.y - campamento.posicion.y)) : null;
  const tuyo = campamento.residentesIds.includes(proyeccion.heroeId);
  const entraEjercito = columna !== undefined && (columna.tipo === 'ejercito' || columna.participantes.length > 1);
  const soyLider = columna?.liderId === proyeccion.heroeId;
  if (!pintar(cont, `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Campamento de mercenarios${tuyo ? ' · tu residencia' : ''}${ayuda('mapa:ficha-mercenarios', `${entraEjercito ? (soyLider ? 'Tu ejército entra entero y se desarma en la puerta: los que residen aquí entran con su tropa y su carro; los demás, de visita, con su columna aparcada. Si lleva caravanas adjuntas, tienen que ser de este lugar.' : 'Solo el Líder hace entrar al ejército.') : 'Se entra con la columna a la puerta.'} Junto al campamento nadie inicia un combate.`)}</span>
    <h3>${escaparHtml(campamento.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Residentes</span><strong>${campamento.residentesIds.length}</strong></div>
      ${distancia !== null ? `<div><span>Distancia</span><strong>${distancia}</strong></div>` : ''}
    </div>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-entrar-mercenarios" class="btn-primary" type="button"${entraEjercito && !soyLider ? ' disabled title="Solo el Líder hace entrar al ejército."' : ''}>${entraEjercito ? 'Entrar con el ejército' : 'Entrar'}</button>
    </div>
    ${entraEjercito && !soyLider ? '<p class="mapa-lista-vacia">Solo el Líder hace entrar al ejército.</p>' : ''}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'punto', punto: campamento.posicion }));
  cablearAccionSeleccion(cont, '#btn-entrar-mercenarios', 'entrarEnCampamento', { campamentoId: campamento.id, heroeId: proyeccion.heroeId }, () => { seleccionMapa = null; });
}

/** Ficha de un alijo de exploración (Doc 1.9b): se abre estando en el sitio, y lo que trae va al carro de la columna. */
function renderSeleccionAlijo(cont: HTMLElement, alijo: Alijo): void {
  const contenido = `${alijo.cantidad} de ${(RECURSO_NOMBRE[alijo.recurso] ?? alijo.recurso).toLowerCase()}`;
  if (!pintar(cont, `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Alijo${ayuda('mapa:ficha-alijo', 'Hay que estar en el sitio. Lo que trae va al carro de tu columna (lo que no quepa se pierde).')}</span>
    <h3>${escaparHtml(contenido)}</h3>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-abrir-alijo" class="btn-primary" type="button">Abrir</button>
    </div>
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'punto', punto: alijo.posicion }));
  cablearAccionSeleccion(cont, '#btn-abrir-alijo', 'abrirAlijo', { alijoId: alijo.id }, () => { seleccionMapa = null; avisoMapa(`Alijo abierto: ${contenido} al carro.`); });
}

// --- INTEL DE LAS TABERNAS (Doc 5.12.10) ---------------------------------------------------------

/** Pinta el panel de Intel dentro de `cont` (la taberna de la plaza o del campamento: la intel no se compra desde el mapa). Si nada cambió no
 * toca el DOM, para no llevarse lo que se está escribiendo con el sondeo de 3 s. `repintar` es cómo se vuelve a pintar en ese sitio. */
function pintarIntel(cont: HTMLElement, p: ProyeccionJugador, repintar: () => void): void {
  const html = renderPanelIntel(p, escaparHtml);
  pintar(cont, html, () => cablearPanelIntel(cont, p, ejecutarYRefrescar, () => { olvidarEdicion(cont); invalidar(cont); repintar(); }), 'intel');
}

// --- RIEL DE ICONOS Y MENÚ DE ESQUINA DEL MAPA (T5) ---------------------------------------------

type PanelRiel = 'columna' | 'ejercito' | 'cosas' | 'fundar';
let panelMapaAbierto: PanelRiel | null = null;
let menuEsquinaAbierto = false;
/** ¿Está montado el modo mundo (la pantalla Mapa)? Desde dentro de una plaza el modo mapa es solo para mirar. */
let enModoMundo = false;

/** Los radios de visión del servidor (`VISION`), para el encuadre de la cámara 3D: el héroe solo y la columna con soldados. */
let radiosDeVision: RadiosDeVision = { solo: 15, ejercito: 30 };

/** La vista previa de fundar para la vista 3D: la zona con que nacería la plaza, dónde cabría una aldea y las parcelas de bosque alrededor del
 * punto. Se recalcula solo cuando cambia el punto o la proyección. */
let fundacion3d: { clave: string; valor: FundacionEnVista | null } = { clave: '', valor: null };
function fundacionEnVista(): FundacionEnVista | null {
  const pos = estadoCliente.modoFundacionActivo ? estadoCliente.posicionFundacion : null;
  const clave = pos ? `${pos.x.toFixed(1)},${pos.y.toFixed(1)}:${estadoCliente.proyeccionUltima?.version ?? 0}` : '';
  if (clave !== fundacion3d.clave) {
    fundacion3d = { clave, valor: pos ? { centro: pos, radio: radioZonaInicial(), sitios: sitiosDeAldeaAlFundar(pos), parcelas: parcelasAlFundar(pos) } : null };
  }
  return fundacion3d.valor;
}

/** El último estado que se dio a la vista 3D: de qué proyección salió, con qué selección, vista previa y reglas, y cuándo. */
let estado3d: { p: ProyeccionJugador; clave: string; en: number; estado: EstadoVista } | null = null;
/** Cada cuánto, como mucho, se recalcula la proyección del instante mientras algo marcha (ms): rehacerla cuesta ~1 ms y a 0,5 u/s la columna
 * no avanza ni 0,02 u entre dos. */
const CADA_PROYECCION_MS = 33;

/** El estado que pinta la vista 3D en cada fotograma. Mientras algo propio marcha (las columnas y caravanas avanzan por su plan sin que el
 * servidor mande nada), la proyección del instante, como mucho cada `CADA_PROYECCION_MS`; si no, la última que llegó. Si no cambió nada, el
 * mismo estado de antes. */
function estadoDeLaVista3D(): EstadoVista | null {
  const base = estadoCliente.proyeccionUltima;
  if (!base) return null;
  const ahora = performance.now();
  const marcha = base.ejercitos.some((e) => e.estado !== 'estacionado' && (e.ruta?.length ?? 0) >= 2) || base.caravanas.some((c) => (c.ruta?.length ?? 0) >= 2);
  const fundacion = fundacionEnVista();
  const reglas = { vision: radiosDeVision, radioZonaInicial: radioZonaInicial(), radioProteccion: radioDeProteccionMercenarios() };
  const clave = `${claveSeleccion()}|${fundacion3d.clave}|${reglas.vision.solo},${reglas.vision.ejercito},${reglas.radioZonaInicial},${reglas.radioProteccion}`;
  const vale = estado3d && estado3d.clave === clave && (marcha ? ahora - estado3d.en < CADA_PROYECCION_MS : estado3d.p === base);
  if (vale) return estado3d!.estado;
  const p = (marcha ? proyeccionAlInstante() : null) ?? base;
  estado3d = { p: marcha ? p : base, clave, en: ahora, estado: estadoDesdeProyeccion(p, reglas, posicionDelHeroe(p), { seleccion: seleccionMapa, fundacion }) };
  return estado3d.estado;
}

/** Monta la vista 3D del modo mundo en `lienzo` cuando están el mapa y el relieve (sin relieve, con el raster de 4 u del artefacto). `null` si
 * no se puede (sin WebGL, o el mapa sin altura): lo dice en el lienzo. */
async function montarVista3D(lienzo: HTMLElement, alClicar: (punto: { x: number; y: number }) => void): Promise<VistaMundo3D | null> {
  const p0 = estadoCliente.proyeccionUltima;
  if (!p0) return null;
  const avisar = (texto: string) => { lienzo.innerHTML = `<p class="mapa-cargando">${escaparHtml(texto)}</p>`; };
  try {
    const [mapa, relieve, radios] = await Promise.all([sincronizarMapa(p0.mapaId), obtenerRelieve().catch(() => null), radiosDeVisionDelServidor()]);
    radiosDeVision = radios;
    const fuente = relieve ? fuenteDesdeRelieve(relieve) : fuenteDesdeMapa(mapa);
    if (!fuente) { avisar('Este mundo no trae relieve: no se puede pintar en 3D.'); return null; }
    if (!lienzo.isConnected) return null;
    lienzo.querySelector('.mapa-cargando')?.remove();
    const vista = new VistaMundo3D(lienzo, {
      fuente,
      mapa,
      estado: estadoDeLaVista3D,
      alClicar: (punto) => alClicar(punto),
      alCambiarEscala: fijarEscalaDeAgarre,
      sinNiebla: import.meta.env.DEV && new URLSearchParams(location.search).has('sinNiebla'),
    });
    if (import.meta.env.DEV) Object.assign(window, { __vista3d: vista }); // para mirarla desde la consola o un navegador de pruebas
    return vista;
  } catch (e) {
    console.error(e);
    avisar('No se pudo pintar el mundo en 3D: tu navegador necesita WebGL.');
    return null;
  }
}

/** ¿Tiene el jugador algún asentamiento propio a la vista o en memoria? Sirve para destacar el icono de
 * Fundar mientras aún no tiene ninguno (no es el gate real: eso lo decide el backend). */
function tieneAsentamientoPropio(proyeccion: ProyeccionJugador): boolean {
  return asentamientosDelMapa(proyeccion).some((a) => a.faccionId === proyeccion.faccionId);
}

/** La Caravana de Fundación de campamento de la que eres titular (Doc 1.8/1.9b): la llevas tú y fundas tú. */
function caravanaDeFundacion(proyeccion: ProyeccionJugador) {
  return proyeccion.caravanas.find((c) => c.titularId === proyeccion.heroeId && c.tipo === 'construccion');
}

async function fundarAqui(): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'fundar', {});
    if (!respuesta.resultado.ok) {
      // El motor dice el porqué en el código (agua, campamento o plaza demasiado cerca…); el detalle solo trae las coordenadas.
      const codigo = respuesta.resultado.codigoError ?? '';
      const explicado = explicarError(codigo);
      throw new ApiError(409, explicado !== codigo ? explicado : respuesta.resultado.detalleError ?? (codigo || 'No se pudo fundar aquí.'));
    }
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
  renderPanelRiel(); // la vista 3D lee la vista previa de fundar en cada fotograma
}

// --- MENÚ DE ESQUINA (compartido entre las pantallas Mapa y Asentamiento) -----------------------

/** Markup del avatar + menú desplegable + overlay JSON. Las clases llevan prefijo `mapa-` por herencia,
 * pero el componente es común a las dos pantallas a pantalla completa. */
function menuEsquinaHtml(): string {
  const nombre = estadoCliente.proyeccionUltima?.heroe.displayName ?? estadoCliente.usuarioActivo;
  const iniciales = escaparHtml(nombre.substring(0, 2).toUpperCase());
  return `
    <button class="mapa-avatar" type="button" aria-label="Menú de sesión">${iniciales}</button>
    <div class="mapa-menu" hidden>
      <button data-menu="refrescar" type="button">Refrescar</button>
      <button data-menu="json" type="button">Ver proyección (JSON)</button>
      <button data-menu="legacy" type="button">Interfaz anterior</button>
      <button data-menu="partidas" type="button">Cambiar de partida</button>
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
  contenedor.querySelector('[data-menu="partidas"]')?.addEventListener('click', () => volverALasPartidas());
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

// --- BARRA SUPERIOR DEL JUGADOR (héroe, escuadras, Facción) Y VISTA DE MAPA DESDE DENTRO ---------------

/** El menú del jugador abierto (la barra es la misma en el mapa, el campamento y el asentamiento). Se cierra al cambiar de pantalla. */
let panelJugador: PanelJugador | null = null;
/** La pestaña abierta de la pantalla de Facción; se recuerda al cerrarla y volverla a abrir. */
let pestanaFaccion: PestanaFaccion = 'miembros';
/** ¿Está abierto el mapa «desde dentro» (botón Mapa de la barra) sobre el campamento o el asentamiento? */
let vistaMapaAbierta = false;
let controlVistaMapa: ControlMapa | null = null;
/** Elegir un punto en el modo mapa (la aldea agrícola, `ui/pueblos.ts`): el clic lo manda en vez de solo mirar. Se olvida al cerrar el mapa. */
let eleccionEnMapa: { texto: string; zona?: { x: number; y: number }[]; alElegir: (q: { x: number; y: number }) => Promise<string | null>; sitios?: SitiosDeAldea | null } | null = null;
selectorDePunto.abrir = (texto, centro, zona, alElegir, sitios) => {
  eleccionEnMapa = { texto, zona, alElegir, sitios };
  alternarVistaMapa(true, centro);
};

/** Pinta el botón activo de la barra y el panel abierto (`.jugador-panel`). Se llama al montar y en cada refresco; si nada cambió no toca el
 * DOM, o el sondeo de 3 s se llevaría lo que se está escribiendo. */
function renderPanelJugador(forzar = false): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const barra = document.querySelector<HTMLElement>('.jugador-barra');
  const panel = document.querySelector<HTMLElement>('.jugador-panel');
  if (!barra || !panel || !proyeccion) return;
  barra.querySelectorAll<HTMLButtonElement>('[data-panel-jugador]').forEach((boton) => {
    boton.classList.toggle('activo', boton.dataset.panelJugador === panelJugador);
  });
  barra.querySelector('[data-ver-mapa]')?.classList.toggle('activo', vistaMapaAbierta);
  pintarAlertas(barra, proyeccion);
  // La Facción va a pantalla completa; el resto, en el panel lateral.
  if (panelJugador !== 'faccion') panel.classList.remove('jugador-panel-completo', 'jugador-panel-faccion');
  if (panelJugador !== 'misiones') panel.classList.remove('jugador-panel-diario');
  if (panelJugador === null) { panel.hidden = true; vaciar(panel); return; }
  panel.hidden = false;
  if (forzar) invalidar(panel);
  if (panelJugador === 'carro' || panelJugador === 'avisos') {
    const html = panelJugador === 'carro' ? htmlCarro(proyeccion, escaparHtml) : htmlAvisos(historialDeAvisos(), escaparHtml);
    const esCarro = panelJugador === 'carro';
    // En marcha el carro y la ración cambian con cada tick: se repinta solo si cambió, devolviendo lo que se estaba escribiendo.
    pintar(panel, html, () => {
      if (esCarro) cablearCarro(panel, ejecutarYRefrescar, proyeccion.heroeId);
      else cablearAvisos(panel, () => renderPanelJugador(), mostrarInforme);
    }, panelJugador);
    return;
  }
  if (panelJugador === 'faccion') {
    // Creando una Facción o buscando a cuál pedir ingreso, el formulario es del jugador: solo se repinta al cambiar de modo (`forzar`).
    if (!forzar && proyeccion.faccionId === null && panel.querySelector('#form-crear-faccion, #input-buscar-faccion')) return;
    // Con Facción, a pantalla completa y por pestañas (sustituye al panel lateral); sin ella, la elección de crear o pedir ingreso.
    const propia = proyeccion.facciones.find((f) => f.id === proyeccion.faccionId);
    const pestana = propia ? (pestanaFaccion === 'resumen' ? 'miembros' : pestanaFaccion) : 'resumen';
    let cuerpo: string;
    if (propia && pestana === 'tablon') {
      cuerpo = propia.tablon ? `<section class="faccion-tablon">${htmlTablon(proyeccion, { tipo: 'faccion', id: propia.id, tablon: propia.tablon }, escaparHtml)}</section>` : '<p class="mapa-lista-vacia">Tu Facción aún no tiene tablón.</p>';
    } else if (propia && pestana === 'misiones') {
      cuerpo = `<section class="faccion-misiones" data-dueno="faccion">${htmlListaMisiones(proyeccion, 'faccion', escaparHtml)}</section>`;
    } else {
      cuerpo = renderPestanaFaccion(proyeccion, escaparHtml, pestana, propia && pestana === 'miembros' ? htmlMiembrosFaccion(proyeccion, propia, escaparHtml) : '', Boolean(propia));
    }
    const pendientes = propia?.reyId === proyeccion.heroeId ? (propia.solicitudesIds ?? []).length : 0;
    const pestanas = propia
      ? `<nav class="faccion-pestanas" role="tablist">${PESTANAS_FACCION.map(([id, nombre]) => `<button type="button" role="tab" class="faccion-pestana${id === pestana ? ' activo' : ''}" aria-selected="${id === pestana}" data-pestana-faccion="${id}">${nombre}${id === 'miembros' && pendientes ? ` <span class="faccion-aviso">${pendientes}</span>` : ''}</button>`).join('')}</nav>`
      : '';
    const cabecera = `<div class="faccion-cabecera"><div class="mapa-panel-jugador">${propia ? 'Facción' : escaparHtml(proyeccion.heroe.displayName)}</div><button class="btn-secondary" type="button" data-cerrar-faccion aria-label="Cerrar">Cerrar</button></div>`;
    // Con Facción: el panel fijo de la izquierda (escudo, nombre, plazas, títulos y Dejar) y, a la derecha, las pestañas.
    const html = propia
      ? `${cabecera}<div class="faccion-marco">${htmlLateralFaccion(proyeccion, escaparHtml)}<div class="faccion-principal">${pestanas}<div class="faccion-cuerpo">${cuerpo}</div></div></div>`
      : `${cabecera}<div class="faccion-cuerpo">${cuerpo}</div>`;
    panel.classList.add('jugador-panel-completo');
    panel.classList.toggle('jugador-panel-faccion', Boolean(propia));
    pintar(panel, html, () => {
      cablearFaccion(panel, proyeccion, () => renderPanelJugador(true));
      panel.querySelectorAll<HTMLButtonElement>('[data-pestana-faccion]').forEach((b) => b.addEventListener('click', () => {
        pestanaFaccion = b.dataset.pestanaFaccion as PestanaFaccion;
        renderPanelJugador(true);
      }));
      panel.querySelector('[data-cerrar-faccion]')?.addEventListener('click', () => { panelJugador = null; renderPanelJugador(true); });
      // «Ver en el mapa» de la pestaña Plazas: cierra la ventana y centra el mapa en la plaza.
      panel.querySelectorAll<HTMLButtonElement>('[data-centrar-x]').forEach((b) => b.addEventListener('click', () => {
        panelJugador = null;
        renderPanelJugador(true);
        alternarVistaMapa(true, { x: Number(b.dataset.centrarX), y: Number(b.dataset.centrarY) });
      }));
      const seccion = panel.querySelector<HTMLElement>('.faccion-misiones');
      if (seccion) cablearMisiones(seccion, proyeccion, ejecutarYRefrescar, () => renderPanelJugador(true));
      const tablon = panel.querySelector<HTMLElement>('.faccion-tablon');
      if (tablon) cablearTablon(tablon, ejecutarYRefrescar, () => renderPanelJugador(true));
    }, `faccion:${pestana}`);
    return;
  }
  if (panelJugador === 'misiones') {
    // La ventana de misiones va centrada, como el diario de misiones de WoW: lista a la izquierda y la misión abierta a la derecha.
    panel.classList.add('jugador-panel-diario');
    pintar(panel, htmlPanelMisiones(proyeccion, escaparHtml), () => {
      cablearMisiones(panel, proyeccion, ejecutarYRefrescar, () => renderPanelJugador(true));
      panel.querySelector('[data-mision-cerrar]')?.addEventListener('click', () => { panelJugador = null; renderPanelJugador(true); });
    }, 'misiones');
    return;
  }
  if (panelJugador === 'tecnologia') {
    pintar(panel, htmlTecnologia(proyeccion, escaparHtml), () => cablearTecnologia(panel, ejecutarYRefrescar), 'tecnologia');
    return;
  }
  pintarPanelHeroe(panel, proyeccion, escaparHtml, aplicarYRefrescar, forzar);
}

/** Los indicadores de peligro de la barra: quién te persigue ahora (`teSigue` de los ejércitos avistados) y los avisos sin leer (rojo si alguno es un ataque). */
function pintarAlertas(barra: HTMLElement, p: ProyeccionJugador): void {
  const estados = barra.querySelector<HTMLElement>('.jugador-estados');
  const htmlDeEstados = htmlEstados(p, escaparHtml);
  if (estados && estados.dataset.pintado !== htmlDeEstados) { estados.innerHTML = htmlDeEstados; estados.dataset.pintado = htmlDeEstados; }
  const sigue = p.ejercitosAvistados.filter((x) => x.teSigue);
  const alerta = barra.querySelector<HTMLElement>('.jugador-alerta');
  if (alerta) {
    alerta.hidden = sigue.length === 0;
    const quien = sigue.map((x) => `${p.facciones.find((f) => f.id === x.faccionId)?.nombre ?? 'sin Facción'}: ${x.heroeIds.map((id) => nombreDeHeroe(p, id)).join(', ') || `${x.participantes} héroes`}`).join(' · ');
    alerta.textContent = sigue.length === 0 ? '' : `⚠ Te persigue${sigue.length === 1 ? ' una columna' : `n ${sigue.length} columnas`} (${quien})`;
    alerta.title = 'Una columna ajena va tras la tuya. En el mapa, púlsalo para abrir su ficha (huir o plantar cara).';
    // En el mapa el aviso lleva a la ficha de quien te persigue (`ui/interaccionAjena.ts`).
    alerta.style.cursor = sigue.length === 0 ? '' : 'pointer';
    alerta.onclick = sigue.length === 0 ? null : () => { if (!document.querySelector('.mapa-seleccion')) return; seleccionMapa = { tipo: 'ejercitoAjeno', id: sigue[0]!.id }; renderSeleccionMapa(); };
  }
  const misiones = barra.querySelector<HTMLElement>('.misiones-badge');
  if (misiones) {
    const n = misionesPorReclamar(p);
    misiones.hidden = n === 0;
    misiones.textContent = String(n);
  }
  const badge = barra.querySelector<HTMLElement>('.jugador-badge:not(.misiones-badge)');
  if (badge) {
    const n = avisosNoLeidos();
    badge.hidden = n === 0;
    badge.textContent = String(n);
    badge.classList.toggle('peligro', hayPeligroSinLeer());
  }
}

/** El briefing de un combate, encima de lo que haya, hasta que se cierre. */
function mostrarInforme(informe: InformeDeCombate): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  document.querySelector('.briefing-fondo')?.remove();
  const fondo = document.createElement('div');
  fondo.className = 'briefing-fondo';
  fondo.innerHTML = `<section class="briefing" role="dialog" aria-label="Informe de combate"><button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar informe">×</button>${htmlInforme(informe, proyeccion, escaparHtml)}</section>`;
  fondo.addEventListener('click', (ev) => { if (ev.target === fondo || (ev.target as HTMLElement).closest('.mapa-seleccion-cerrar')) fondo.remove(); });
  document.body.appendChild(fondo);
}

/** Desde el rastreador: abre el panel Misiones en la pestaña de ese dueño. */
function abrirMisiones(d: Parameters<typeof elegirPestanaMisiones>[0], id?: string): void {
  elegirPestanaMisiones(d, id);
  panelJugador = 'misiones';
  renderPanelJugador(true);
}

function cablearBarraJugador(contenedor: HTMLElement): void {
  contenedor.querySelectorAll<HTMLButtonElement>('[data-panel-jugador]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const id = boton.dataset.panelJugador as PanelJugador;
      menuEsquinaAbierto = false;
      sincronizarMenuEsquina();
      panelJugador = panelJugador === id ? null : id;
      if (id === 'escuadras') elegirPestanaHeroe('escuadras');
      if (id === 'heroe') elegirPestanaHeroe('ficha');
      renderPanelJugador(true);
    });
  });
  contenedor.querySelector('[data-ver-mapa]')?.addEventListener('click', () => alternarVistaMapa());
}

/** Dónde está el héroe en el mundo, para centrar el mapa: su columna, o el campamento o la plaza donde está. */
function posicionDelHeroe(p: ProyeccionJugador): { x: number; y: number } | null {
  return miColumna(p)?.posicionActual ?? campamentoActual(p)?.posicion ?? p.asentamientos[0]?.posicion ?? null;
}

/** Abre o cierra el MODO MAPA (botón Mapa de la barra, en cualquier pantalla): el mapa del mundo con la visión de ahora y zoom libre. En el
 * mundo, un clic sobre un elemento marcha hacia él (como en el modo mundo); en el suelo, nada. Se abre centrado en el héroe, o en `centro` («Mis cosas», el panel de ejército). */
function alternarVistaMapa(abrir: boolean = !vistaMapaAbierta, centro?: { x: number; y: number }): void {
  const pantalla = document.querySelector<HTMLElement>('.asent-screen') ?? document.querySelector<HTMLElement>('.mapa-screen:not(.mapa-interior)');
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!pantalla || !proyeccion) return;
  vistaMapaAbierta = abrir;
  controlVistaMapa?.destruir();
  controlVistaMapa = null;
  pantalla.querySelector('.mapa-interior')?.remove();
  if (abrir) {
    pantalla.insertAdjacentHTML('beforeend', `<div class="mapa-screen mapa-interior">
      <div class="mapa-lienzo"><canvas id="mapa-interior"></canvas></div>
      <div class="mapa-zoom"><button type="button" data-zoom="in" aria-label="Acercar">+</button><button type="button" data-zoom="out" aria-label="Alejar">−</button></div>
      <button class="btn-secondary mapa-interior-cerrar" type="button">Volver</button>
      ${eleccionEnMapa ? `<div class="mapa-eleccion" role="status"><span>${escaparHtml(eleccionEnMapa.texto)}</span><p class="faction-error" data-eleccion-error role="alert"></p></div>` : ''}
    </div>`);
    const interior = pantalla.querySelector<HTMLElement>('.mapa-interior')!;
    // Eligiendo un punto, el clic lo manda; si el motor lo rechaza se dice por qué y se puede probar otro sitio.
    const alClicar = (evento: PointerEvent): void => {
      const eleccion = eleccionEnMapa;
      if (!controlVistaMapa) return;
      // Sin elegir sitio, en el mundo: un clic sobre un elemento (plaza, campamento, pueblo, avanzada…) lo selecciona y marcha hacia él, como en
      // el modo mundo; se vuelve al mundo para verlo. Un clic en el suelo no mueve a nadie, y desde dentro de una plaza el mapa sigue siendo para mirar.
      if (!eleccion) {
        const p = estadoCliente.proyeccionUltima;
        if (!p || !enModoMundo) return;
        const bajo = objetoBajoElClic(p, controlVistaMapa.aMundo(evento));
        if (!bajo) return;
        seleccionMapa = bajo.seleccion;
        alternarVistaMapa(false);
        renderSeleccionMapa();
        if (bajo.ir) void marcharAObjetivo(bajo.ir);
        return;
      }
      const q = controlVistaMapa.aMundo(evento);
      const error = interior.querySelector<HTMLElement>('[data-eleccion-error]');
      if (error) error.textContent = 'Enviando…';
      void eleccion.alElegir(q).then((mensaje) => {
        if (mensaje) { if (error) error.textContent = mensaje; return; }
        eleccionEnMapa = null;
        alternarVistaMapa(false);
      });
    };
    // Arranca a un cuarto de la escala de visión (cuatro veces lo que ves de radio); de ahí, hasta el mundo entero o hasta la visión.
    const control = instalarZoomPan(interior, interior.querySelector<HTMLElement>('.mapa-lienzo')!, { alCambiar: () => void pintarVistaMapa(), factorInicial: eleccionEnMapa ? 1 : 0.25, alClicar });
    controlVistaMapa = control;
    void radioDeVision().then((r) => control.fijarRadioVision(r));
    interior.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => control.zoomHacia(b.dataset.zoom === 'in' ? 1 : -1)));
    interior.querySelector('.mapa-interior-cerrar')?.addEventListener('click', () => alternarVistaMapa(false));
    void pintarVistaMapa(centro ?? true);
  } else {
    // De vuelta al modo mundo: la vista 3D vuelve a pintar sola, y a poner la escala de agarre de sus clics.
    eleccionEnMapa = null;
  }
  renderPanelJugador();
}

/** Da al lienzo del mapa la proporción del mundo (el del motor no es cuadrado); cambiar el alto borra el lienzo, así que solo si hace falta. */
function ajustarLienzo(canvas: HTMLCanvasElement, ancho: number, alto: number): void {
  const h = Math.round((canvas.width * alto) / ancho);
  if (canvas.height !== h) canvas.height = h;
}

/** Un pintado del modo mapa pedido para el próximo fotograma: arrastrar o hacer zoom pide muchos por fotograma y basta con uno. */
let pintadoMapaPedido = false;

/** Pinta el terreno y lo que se ve en el modo mapa; `centrar` (solo al abrirlo) lo lleva al héroe, o al punto dado. Sin `centrar`, a lo
 * sumo uno por fotograma. */
function pintarVistaMapa(centrar: boolean | { x: number; y: number } = false): Promise<void> {
  if (centrar !== false) return pintarVistaMapaYa(centrar);
  if (!pintadoMapaPedido) {
    pintadoMapaPedido = true;
    requestAnimationFrame(() => { pintadoMapaPedido = false; void pintarVistaMapaYa(false); });
  }
  return Promise.resolve();
}

async function pintarVistaMapaYa(centrar: boolean | { x: number; y: number }): Promise<void> {
  const p = proyeccionAlInstante() ?? estadoCliente.proyeccionUltima;
  const canvas = document.querySelector<HTMLCanvasElement>('#mapa-interior');
  const ctx = canvas?.getContext('2d');
  if (!p || !canvas || !ctx) return;
  const mapa = await sincronizarMapa(p.mapaId);
  if (document.querySelector('#mapa-interior') !== canvas) return; // se cerró mientras llegaba el mapa
  const donde = typeof centrar === 'object' ? centrar : centrar ? posicionDelHeroe(p) : null;
  if (donde) controlVistaMapa?.centrar(donde, mapa.config.ancho, mapa.config.alto);
  controlVistaMapa?.fijarMundo(mapa.config.ancho, mapa.config.alto);
  if (!controlVistaMapa) return;
  const escala = controlVistaMapa.transformar(ctx);
  pintarTerreno(ctx, mapa, p, escala);
  pintarMiradas(ctx, p.miradasIntel ?? [], p.instante, escala);
  // Eligiendo el sitio de una aldea: la zona de la plaza, que es donde cabe.
  const zona = eleccionEnMapa?.zona;
  if (zona && zona.length > 2) {
    ctx.beginPath();
    zona.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x * escala, q.y * escala) : ctx.lineTo(q.x * escala, q.y * escala)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(216, 184, 120, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#d8b878';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (eleccionEnMapa?.sitios) pintarSitiosDeAldea(ctx, eleccionEnMapa.sitios, escala);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  if (panelMapaAbierto === null) { panel.hidden = true; vaciar(panel); return; }
  panel.hidden = false;
  if (panelMapaAbierto === 'columna') {
    pintar(panel, htmlColumna(proyeccion, escaparHtml), () => cablearColumna(panel, proyeccion, ejecutarYRefrescar), 'columna');
  } else if (panelMapaAbierto === 'ejercito') {
    // El modo mundo no se separa del héroe: ver otro sitio es abrir el modo mapa allí.
    pintar(panel, htmlPanelEjercito(proyeccion, escaparHtml), () => cablearPanelEjercito(panel, proyeccion, ejecutarYRefrescar, avisoMapa, (punto) => alternarVistaMapa(true, punto)), 'ejercito');
  } else if (panelMapaAbierto === 'cosas') {
    const asentamientos = asentamientosDelMapa(proyeccion).filter((a) => a.faccionId === proyeccion.faccionId);
    const columnas = proyeccion.ejercitos;
    const htmlCosas = `
      <span class="faction-kicker">Mis cosas</span>
      <div class="mapa-lista">
        <strong>Asentamientos</strong>
        ${asentamientos.length > 0
          ? asentamientos.map((a) => `<button class="mapa-lista-item" type="button" data-centrar-x="${a.posicion.x}" data-centrar-y="${a.posicion.y}">${escaparHtml(a.nombre ?? a.id)}<span>Nivel ${a.nivel}${a.recordado !== null ? ' · recordado' : ''}</span></button>`).join('')
          : '<p class="mapa-lista-vacia">Ninguno a la vista.</p>'}
        <p id="mapa-cosas-error" class="faction-error" role="alert"></p>
        <strong>Columnas</strong>
        ${columnas.length > 0
          ? columnas.map((e) => `<button class="mapa-lista-item" type="button" data-centrar-x="${e.posicionActual.x}" data-centrar-y="${e.posicionActual.y}">${e.participantes.some((p) => p.heroeId === proyeccion.heroeId) ? 'Tu columna' : escaparHtml(e.id)}<span>${e.estado}</span></button>`).join('')
          : '<p class="mapa-lista-vacia">Ninguna.</p>'}
      </div>`;
    pintar(panel, htmlCosas, () => panel.querySelectorAll<HTMLButtonElement>('.mapa-lista-item').forEach((boton) => {
      boton.addEventListener('click', () => alternarVistaMapa(true, { x: Number(boton.dataset.centrarX), y: Number(boton.dataset.centrarY) }));
    }), 'cosas');
  } else {
    // fundar: solo con una Caravana de Fundación enganchada, y donde se está (Doc 1.3, 1.8)
    // La de fundación va en `caravanaFundacionId` de la columna (motor d8ef09c), no en `caravanasAdjuntasIds`; funda el Líder de la columna.
    const llevada = columna?.caravanaFundacionId;
    const caravana = (llevada ? proyeccion.caravanas.find((c) => c.id === llevada) : undefined) ?? caravanaDeFundacion(proyeccion);
    const enganchada = Boolean(llevada || (caravana && columna?.caravanasAdjuntasIds?.includes(caravana.id)));
    const esLider = !columna?.liderId || columna.liderId === proyeccion.heroeId;
    const htmlFundar = `
      <span class="faction-kicker">Fundar asentamiento${!caravana && !enganchada
        ? ayuda('mapa:fundar', 'Una Facción sin plaza la compra en un campamento de mercenarios con el fondo de sus héroes; con plaza, se lanza desde Centro urbano › Fundación. Quien la compra o la lanza la lleva.')
        : enganchada ? ayuda('mapa:fundar', 'Se funda donde está ahora tu columna, no en agua ni a menos de 100 de un campamento.') : ''}</span>
      ${!caravana && !enganchada
        ? '<p>Se funda con una Caravana de Fundación.</p>'
        : enganchada && !esLider
          ? `<p>Tu ejército lleva la Caravana de Fundación. Funda su Líder, ${escaparHtml(nombreDeHeroe(proyeccion, columna!.liderId!))}, donde esté la columna.</p>`
        : enganchada
          ? `<p>Se funda donde está ahora tu columna. Estos son los recursos a tu alcance:</p>
            <div id="mapa-fundar-recursos">${resumenRecursosFundacion(escaparHtml)}</div>
            <button id="btn-fundar-aqui" class="btn-primary" type="button">Fundar aquí</button>`
          : `<p>Tu Caravana de Fundación espera en ${caravana!.origenCampamentoId ? 'su campamento' : 'su plaza'}. Para llevártela, sal de allí como ejército y, al partir, elige llevarla; o lleva tu ejército a la puerta y engánchala.</p>
            <button id="btn-enganchar-caravana" class="btn-primary" type="button">Enganchar caravana</button>`}
      <p id="mapa-fundar-error" class="faction-error" role="alert"></p>`;
    pintar(panel, htmlFundar, () => {
      panel.querySelector('#btn-fundar-aqui')?.addEventListener('click', () => void fundarAqui());
      panel.querySelector('#btn-enganchar-caravana')?.addEventListener('click', async () => {
        const mensaje = await ejecutarYRefrescar('adjuntarCaravana', { ejercitoId: columna?.id, caravanaId: caravana?.id, heroeId: proyeccion.heroeId });
        const error = document.querySelector<HTMLElement>('#mapa-fundar-error');
        if (error) error.textContent = mensaje ?? '';
      });
    }, 'fundar');
  }
}

// Pantalla MAPA (`montarMapa`): el mundo alrededor del héroe a pantalla completa, en 3D (`montarVista3D`, docs/Mundo_3D.md), con movimiento
// por clic y el panel de Selección; el botón Mapa abre encima el modo mapa, en 2D.

/** El selector «añadir a víveres» (abierto o no, y la cantidad que va eligiendo): vive entre repintados, porque el sondeo de 3 s rehace la barra. */
let selectorViveres: { abierto: boolean; cantidad: number } = { abierto: false, cantidad: 1 };

/**
 * Barra inferior del mundo abierto: los VÍVERES de tu héroe (backend Doc 5.13, 2026-10-08): el trigo que come tu columna, siempre contigo y nunca
 * descargable, hasta `LOGISTICA.capacidadViveresPorHeroe`. El carro ya no se come; de él se pasa trigo con «`pasarAViveres`» (solo el Líder, solo lo que
 * cabe). En un ejército el backend suma los víveres de todos, pero la proyección solo trae los tuyos: aquí, los tuyos frente a lo que cabe a un héroe.
 */
function pintarComida(p: ProyeccionJugador): void {
  const caja = document.querySelector<HTMLElement>('.mapa-comida');
  if (!caja) return;
  const columna = p.ejercitos.find((x) => x.participantes.some((y) => y.heroeId === p.heroeId));
  if (!columna) { caja.hidden = true; selectorViveres.abierto = false; return; }
  // Los víveres de una columna son los de todos sus héroes: caben `capacidadViveresPorHeroe` por cada uno (`racion::capacidad_viveres` del motor).
  const capacidad = capacidadDeViveres(() => { invalidar(caja); pintarComida(p); }) * Math.max(1, columna.participantes.length);
  const viveres = Math.floor(p.heroe.viveres ?? 0);
  const hueco = Math.max(0, capacidad - viveres);
  const enElCarro = Math.floor(columna.suministro?.['trigo'] ?? 0);
  const maximo = Math.min(enElCarro, hueco);
  const esLider = columna.liderId === p.heroeId;
  const motivo = !esLider ? 'Solo el Líder de la columna pasa trigo del carro a los víveres.' : enElCarro < 1 ? 'El carro no lleva trigo.' : hueco < 1 ? 'Tus víveres están llenos.' : '';
  if (motivo) selectorViveres.abierto = false;
  selectorViveres.cantidad = Math.max(1, Math.min(selectorViveres.cantidad, maximo || 1));
  const fraccion = capacidad > 0 ? Math.min(1, viveres / capacidad) : 0;
  // Marcha forzada a la izquierda de los víveres: encendida o apagada; solo el Líder la cambia (`marchaForzada { ejercitoId, activa }`).
  const forzada = columna.marchaForzada === true;
  const botonForzada = `<button type="button" class="mapa-forzada${forzada ? ' activa' : ''}" data-viveres="forzada" aria-pressed="${forzada}"${esLider ? '' : ' disabled'} title="${escaparHtml(`Marcha forzada ${forzada ? 'puesta' : 'quitada'}: ×1,5 de velocidad y, solo mientras marcha, ×2 de víveres.${esLider ? ` Pulsa para ${forzada ? 'quitarla' : 'ponerla'}.` : ' Solo el Líder la cambia.'}`)}">» Marcha forzada</button>`;
  const html = `${botonForzada}<span>🌾 Víveres</span><div class="mapa-comida-barra"><i style="width:${(fraccion * 100).toFixed(1)}%"></i></div><strong>${viveres} / ${capacidad}</strong>
    <button type="button" class="btn-secondary" data-viveres="abrir"${motivo ? ' disabled' : ''} title="${escaparHtml(motivo || 'Pasa trigo del carro a tus víveres: lo que cabe.')}">＋ desde el carro</button>
    ${selectorViveres.abierto ? `<div class="mapa-comida-selector"><span>Trigo del carro: ${enElCarro} · cabe ${hueco}</span><input type="range" min="1" max="${maximo}" value="${selectorViveres.cantidad}" data-viveres="barra" /><input type="number" class="form-input" min="1" max="${maximo}" value="${selectorViveres.cantidad}" data-viveres="cantidad" /><button type="button" class="btn-primary" data-viveres="confirmar">Pasar a víveres</button><p class="faction-error" data-campo="error-viveres" role="alert"></p></div>` : ''}`;
  caja.hidden = false;
  caja.classList.toggle('poca', fraccion < 0.25);
  caja.title = 'Víveres: el trigo que come tu columna: en marcha, media ración; acampada, una décima parte de eso. Sin víveres, la moral cae y la tropa deserta. Siempre van contigo.';
  const valor = (): number => Math.max(1, Math.min(maximo, Math.floor(Number(caja.querySelector<HTMLInputElement>('input[data-viveres="cantidad"]')?.value ?? 1)) || 1));
  pintar(caja, html, () => {
    caja.querySelector<HTMLButtonElement>('[data-viveres="forzada"]')?.addEventListener('click', async (ev) => {
      const boton = ev.currentTarget as HTMLButtonElement;
      boton.disabled = true;
      const mensaje = await ejecutarYRefrescar('marchaForzada', { ejercitoId: columna.id, activa: !forzada });
      boton.disabled = false;
      if (mensaje) avisoMapa(mensaje);
    });
    caja.querySelector('[data-viveres="abrir"]')?.addEventListener('click', () => { selectorViveres = { abierto: !selectorViveres.abierto, cantidad: maximo || 1 }; pintarComida(p); });
    caja.querySelector<HTMLInputElement>('input[data-viveres="barra"]')?.addEventListener('input', (ev) => {
      selectorViveres.cantidad = Number((ev.target as HTMLInputElement).value);
      const n = caja.querySelector<HTMLInputElement>('input[data-viveres="cantidad"]'); if (n) n.value = String(selectorViveres.cantidad);
    });
    caja.querySelector<HTMLInputElement>('input[data-viveres="cantidad"]')?.addEventListener('input', () => {
      selectorViveres.cantidad = valor();
      const b = caja.querySelector<HTMLInputElement>('input[data-viveres="barra"]'); if (b) b.value = String(selectorViveres.cantidad);
    });
    caja.querySelector<HTMLButtonElement>('[data-viveres="confirmar"]')?.addEventListener('click', async (ev) => {
      const boton = ev.currentTarget as HTMLButtonElement;
      boton.disabled = true;
      const mensaje = await ejecutarYRefrescar('pasarAViveres', { cantidad: valor() });
      boton.disabled = false;
      if (mensaje === null) { selectorViveres.abierto = false; return; }
      const error = caja.querySelector<HTMLElement>('[data-campo="error-viveres"]'); if (error) error.textContent = mensaje;
    });
  }, 'viveres');
}

function montarMapa(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) { montar('cargando'); return; }
  estadoCliente.modoVista = 'mundo';
  // Vista guardada de ESTA partida (vistaMapaGuardada.ts). La selección se restaura tal cual y
  // `renderSeleccionMapa` la descarta sola si ya no existe en la proyección; restaurar no manda nada al servidor.
  const gameId = estadoCliente.gameIdActivo;
  const vista = leerVistaMapa(gameId);
  seleccionMapa = (vista?.seleccion as typeof seleccionMapa) ?? null;
  panelMapaAbierto = vista?.panel ?? null;
  menuEsquinaAbierto = false;
  app.innerHTML = `<div class="mapa-screen">
    <div class="mapa-lienzo"><p class="mapa-cargando">Cargando el mundo…</p></div>
    ${htmlBarraJugador(proyeccion, escaparHtml)}
    <nav class="mapa-riel" aria-label="Paneles del mapa">
      <button type="button" data-panel="columna" title="Lo que llevas: tropa y carro" aria-label="Lo que llevas: tropa y carro">⚔</button>
      <button type="button" data-panel="ejercito" title="Ejército: formar uno o unirte a uno" aria-label="Ejército">⚑</button>
      <button type="button" data-panel="cosas" title="Mis cosas" aria-label="Mis cosas">📍</button>
      <button type="button" data-panel="fundar" title="Fundar asentamiento" aria-label="Fundar asentamiento" hidden>⌂</button>
    </nav>
    <aside class="mapa-panel" hidden></aside>
    <aside class="jugador-panel" hidden></aside>
    <aside class="mapa-seleccion" hidden></aside>
    <p class="mapa-aviso" role="status" hidden></p>
    <div class="mapa-comida" role="status" hidden></div>
    <div class="mapa-zoom"><button type="button" data-zoom="in" aria-label="Acercar">+</button><button type="button" data-zoom="out" aria-label="Alejar">−</button></div>
    ${menuEsquinaHtml()}
  </div>`;
  const contenedor = document.querySelector<HTMLElement>('.mapa-screen')!;
  const lienzo = document.querySelector<HTMLElement>('.mapa-lienzo')!;
  // Un clic en el terreno (la vista 3D da el punto del mapa bajo el ratón): lo que hay debajo se selecciona y la columna marcha hacia ello.
  const alClicar = (punto: { x: number; y: number }): void => {
    const proy = estadoCliente.proyeccionUltima;
    if (!proy) return;
    const bajo = objetoBajoElClic(proy, punto);
    seleccionMapa = bajo?.seleccion ?? null;
    renderSeleccionMapa();
    if (!bajo) void marcharAObjetivo({ tipo: 'punto', punto });
    else if (bajo.ir) void marcharAObjetivo(bajo.ir);
  };
  // MODO MUNDO, en 3D (docs/Mundo_3D.md): la cámara sigue al héroe y en pantalla cabe lo que dice su visión (15 o 22 u el héroe solo, 30 o 45
  // con soldados); lo que no se ve lo tapa la niebla. Mirar más lejos es el modo mapa, en 2D (botón Mapa). La vista guardada solo aporta panel
  // y selección. Se monta cuando están el mapa y el relieve.
  let vista3d: VistaMundo3D | null = null, desmontado = false;
  enModoMundo = true;
  void montarVista3D(lienzo, alClicar).then((v) => { if (desmontado) v?.destruir(); else vista3d = v; });
  // El mundo solo avanza por tick y este cliente aún no tiene tiempo real (`WS .../tiempo-real`): sin esto el
  // mapa sería una foto y la columna nunca parecería moverse. Sondeo suave mientras la pantalla Mapa esté
  // montada; se corta al cambiar de pantalla (`limpiarPantalla`).
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.mapa-screen') || !hayQueSondear()) return;
    sondeando = true;
    void refrescarDatosJuego().catch(() => {}).finally(() => { sondeando = false; });
  }, 3000);
  // Las columnas avanzan por su plan y el servidor no manda nada mientras marchan: sin esto se verían a saltos (en cada sondeo). La vista 3D
  // pinta en su bucle con la proyección del instante. Con el modo mapa abierto encima, el mundo no se pinta y el mapa, solo si algo marcha o
  // hay algo ajeno a la vista, a ~4 fps.
  let fotograma = 0;
  let ultimoFotograma = 0;
  const animar = (t: number): void => {
    fotograma = requestAnimationFrame(animar);
    // la vista 3D pinta sola, en su bucle; mientras el modo mapa la tapa, descansa
    vista3d?.pausar(vistaMapaAbierta);
    if (!vistaMapaAbierta || estadoCliente.modoVista !== 'mundo') return;
    const p = proyeccionAlInstante();
    if (!p) return;
    const marchaPropia = p.ejercitos.some((e) => e.estado !== 'estacionado' && (e.ruta?.length ?? 0) >= 2) || p.caravanas.some((c) => (c.ruta?.length ?? 0) >= 2);
    const ajenoALaVista = (p.ejercitosAvistados?.length ?? 0) + (p.caravanasAvistadas?.length ?? 0) > 0;
    if (!marchaPropia && !ajenoALaVista) return;
    // El modo mapa ya se repinta al mover la cámara y con cada sondeo: aquí solo mientras algo marcha, y a ~4 fps (a esa escala no se nota más).
    if (t - ultimoFotograma < 250) return;
    ultimoFotograma = t;
    void pintarVistaMapa();
  };
  fotograma = requestAnimationFrame(animar);
  const guardarVista = (): void => {
    const donde = estadoCliente.proyeccionUltima ? posicionDelHeroe(estadoCliente.proyeccionUltima) : null;
    guardarVistaMapa(gameId, { escala: 1, cx: donde?.x ?? 0, cy: donde?.y ?? 0, panel: panelMapaAbierto === 'fundar' ? null : panelMapaAbierto, seleccion: seleccionMapa });
  };
  addEventListener('pagehide', guardarVista); // recarga o cierre de pestaña
  limpiarPantalla = () => {
    guardarVista(); // salir del mapa (plaza, campamento, otra partida, cerrar sesión)
    removeEventListener('pagehide', guardarVista);
    cancelAnimationFrame(fotograma);
    clearInterval(sondeo);
    desmontado = true;
    vista3d?.destruir();
    vista3d = null;
    enModoMundo = false;
    estadoCliente.modoFundacionActivo = false;
    estadoCliente.posicionFundacion = null;
  };

  contenedor.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((boton) => {
    boton.addEventListener('click', () => vista3d?.zoom(boton.dataset.zoom === 'in' ? 'normal' : 'alejado'));
  });
  contenedor.querySelectorAll<HTMLButtonElement>('.mapa-riel [data-panel]').forEach((boton) => {
    boton.addEventListener('click', () => abrirPanelRiel(boton.dataset.panel as PanelRiel));
  });
  cablearMenuEsquina(contenedor);
  cablearBarraJugador(contenedor);

  renderPanelRiel();
  if (seleccionMapa) renderSeleccionMapa();
}

// --- VENTANA «SALIR AL MUNDO» (ui/ventanaSalida.ts): la misma en la plaza, el campamento y el pueblo ---------------------------

const HTML_VELO_SALIDA = '<div class="salida-velo" hidden><section class="salida-ventana" role="dialog" aria-label="Salir al mundo"></section></div>';
let ventanaSalidaAbierta = false;

/** De dónde se sale, según la pantalla montada. */
function lugarDeSalida(p: ProyeccionJugador): LugarDeSalida | null {
  if (pantallaMontada === 'campamento') { const c = campamentoActual(p); return c ? { tipo: 'campamento', campamento: c } : null; }
  if (pantallaMontada === 'pueblo') { const x = puebloActual(p); return x ? { tipo: 'pueblo', pueblo: x } : null; }
  const a = pantallaMontada === 'asentamiento' ? p.asentamientos[0] : undefined;
  if (!a) return null;
  return resideEnLaPlaza(p, a) ? { tipo: 'residencia', asentamiento: a } : { tipo: 'plazaAjena', asentamiento: a };
}

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ventanaSalidaAbierta && !document.querySelector('.dialogo-velo')) cerrarVentanaSalida(); });

function abrirVentanaSalida(): void {
  reiniciarVentanaSalida();
  ventanaSalidaAbierta = true;
  renderVentanaSalida();
}

function cerrarVentanaSalida(): void {
  ventanaSalidaAbierta = false;
  renderVentanaSalida();
}

function renderVentanaSalida(): void {
  const velo = document.querySelector<HTMLElement>('.salida-velo');
  const ventana = velo?.querySelector<HTMLElement>('.salida-ventana');
  const p = estadoCliente.proyeccionUltima;
  if (!velo || !ventana) return;
  const lugar = p && ventanaSalidaAbierta ? lugarDeSalida(p) : null;
  if (!p || !lugar) { velo.hidden = true; vaciar(ventana); return; }
  if (velo.hidden) {
    velo.hidden = false;
    // Se cierra con el fondo (una vez por velo: cada pantalla monta el suyo) o con Escape.
    if (!velo.dataset.cableado) {
      velo.dataset.cableado = '1';
      velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrarVentanaSalida(); });
    }
  }
  pintarVentanaSalida(ventana, p, lugar, ejecutarYRefrescar, cerrarVentanaSalida, renderVentanaSalida, escaparHtml);
}

// --- PANTALLA ASENTAMIENTO (T6) -----------------------------------------------------------------

type PanelAsent = 'ejercito';
let panelAsentAbierto: PanelAsent | null = null;

/** ¿Resides en la plaza donde estás? (fundadores y quienes compraron casa: así lo cuenta la proyección). */
function resideEnLaPlaza(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

/**
 * Mudar tu base a esta plaza (`cambiarResidencia`, Doc 2.5): atómico, deja la residencia actual (otra plaza de tu Facción o el campamento de mercenarios donde vivas)
 * y toma esta; tu campamento se muda contigo, tu guarnición se suelta y hay un enfriamiento antes de volver a mudarte. El backend valida Facción, puerta y
 * enfriamiento, y su motivo se enseña tal cual.
 */
async function mudarseAEstaPlaza(): Promise<void> {
  const p = estadoCliente.proyeccionUltima;
  const a = p?.asentamientos[0];
  if (!p || !a) return;
  const prestadas = p.heroe.escuadrones.filter((s) => s.prestada);
  const guarnicion = p.heroe.escuadrones.some((s) => s.enGuarnicion);
  const aviso = `Vas a hacer de ${a.nombre ?? a.id} tu base: dejas de residir donde vives ahora y tu campamento se muda contigo.${prestadas.length > 0 ? ` Se te retira la tropa prestada por tu campamento anterior (${prestadas.map((s) => `${s.nombre}: ${s.cantidad}`).join(', ')}).` : ''}${guarnicion ? ' Tu guarnición se suelta.' : ''} Después hay que esperar un tiempo para volver a mudarte. ¿Seguro?`;
  const error = document.querySelector<HTMLElement>('#asent-lado-error');
  if (!(await confirmar(aviso, { titulo: '¿Hacer de esta plaza tu base?', aceptar: 'Hacerla mi base' }))) return;
  const mensaje = await ejecutarYRefrescar('cambiarResidencia', { destinoId: a.id, heroeId: p.heroeId });
  if (error) error.textContent = mensaje ?? '';
}

// --- PANEL DE GESTIÓN DEL ASENTAMIENTO (columna derecha): Resumen · Edificios · Cola ------------
// Solo con lo que ya trae la proyección. Las acciones sin dato previo (mejorar, añadir) se mandan y se
// muestra el error del backend si lo rechaza. Ver docs/Panel_Asentamiento.md.

type SeccionAsent = string; // 'resumen' | 'edificios' | 'produccion' | 'cola' | 'cargos' o el id de una subpestaña de `SUBPESTANAS_CENTRO_EXTRA`
let seccionAsent: SeccionAsent = 'edificios';

/** Edificios que un Gobernador / Maestro de Obras puede añadir a mano (el backend gatea nivel, únicos y
 * topes; aquí solo se ofrece el catálogo). Fuera: centroUrbano, puestoMercado y los extractores de `mapa`. */
const EDIFICIOS_MANUALES = [
  'vivienda', 'almacen', 'granero', 'granja', 'lenera', 'corral',
  'barracon', 'galeriaDeTiro', 'palacio', 'mercado', 'taberna',
  'fundicion', 'granFundicion', 'curtiduria', 'armeria', 'carpinteria', 'maravilla',
] as const;

interface DefEdificio { costo?: Record<string, number>; requisitoNivelAsentamientoConstruccion?: number; requiereTecnologia?: string; nivelFaccionMinimo?: number }

/** Por qué no se puede añadir ahora un edificio a la cola, como el motor (`anadir_manual`), o `''` si se puede. Lo que el cliente no sabe (sitio,
 * topes de almacenes y viviendas, cola llena, recursos) lo dice el motor al pedirlo. */
function motivoParaConstruir(a: Asentamiento, tipo: string, def: DefEdificio, cargo: 'gobernador' | 'maestroObras' | null): string {
  const p = estadoCliente.proyeccionUltima;
  if (!cargo) return 'Solo el Gobernador o el Maestro de Obras.';
  const hay = (a.edificios ?? []).some((e) => e.tipo === tipo);
  if (tipo === 'cantera' && hay) return 'La plaza ya tiene su cantera: las demás son pueblos sobre nodos de piedra.';
  const unicos = bloqueDeDatos<string[]>('EDIFICIOS_UNICOS') ?? [];
  if (unicos.includes(tipo) && hay) return 'Solo puede haber uno.';
  const nivel = a.nivelActual ?? a.nivel;
  const pide = def.requisitoNivelAsentamientoConstruccion ?? 0;
  if (nivel < pide) return `Pide la plaza en nivel ${pide}.`;
  if (def.requiereTecnologia && !(p?.tecnologiasAdoptadas ?? []).includes(def.requiereTecnologia)) return `Pide la tecnología ${def.requiereTecnologia.replace(/_/g, ' ')}.`;
  if (tipo === 'granFundicion') {
    const nivelFaccion = p?.facciones.find((f) => f.id === p.faccionId)?.nivel ?? 1;
    if (def.nivelFaccionMinimo && nivelFaccion < def.nivelFaccionMinimo) return `Pide la Facción en nivel ${def.nivelFaccionMinimo}.`;
    if (p?.tecnologia?.capitalId && p.tecnologia.capitalId !== a.id) return 'Solo en la capital.';
  }
  return '';
}

/** Los botones para añadir a la cola: uno por edificio, con su icono; encendidos los que se pueden construir ahora y apagados, con el motivo, los demás.
 * Fuera: los que nacen solos (sin coste), los de pueblo (minas) y el Corral, que es de la aldea. */
function htmlBotonesConstruir(a: Asentamiento, cargo: 'gobernador' | 'maestroObras' | null): string {
  if (!cargo) return '';
  const catalogo = bloqueDeDatos<Record<string, DefEdificio>>('EDIFICIO_CATALOGO');
  const tipos = catalogo
    ? Object.keys(catalogo).filter((t) => Object.keys(catalogo[t]!.costo ?? {}).length > 0 && !t.startsWith('mina') && t !== 'corral')
    : [...EDIFICIOS_MANUALES];
  const botones = tipos.map((t) => {
    const def = catalogo?.[t] ?? {};
    const motivo = catalogo ? motivoParaConstruir(a, t, def, cargo) : '';
    const coste = Object.entries(def.costo ?? {}).map(([r, n]) => `${n} ${RECURSO_NOMBRE[r] ?? r}`).join(', ');
    const titulo = `${EDIFICIO_NOMBRE[t] ?? t}${coste ? ` · ${coste}` : ''}${motivo ? ` · ${motivo}` : ''}`;
    return `<button class="asent-construir${motivo ? ' apagado' : ''}" type="button" data-construir="${escaparHtml(t)}"${motivo ? ' aria-disabled="true"' : ''} title="${escaparHtml(titulo)}" aria-label="${escaparHtml(titulo)}">${iconoEdificio(t, 30)}</button>`;
  });
  return `<div class="asent-construir-cab"><span class="faction-kicker">Construir</span><small>Pasa el ratón para ver qué es y qué cuesta</small></div>
    <div class="asent-construir-rejilla">${botones.join('')}</div>`;
}

/** El cargo de construcción que el héroe tiene en esta plaza, o `null`. */
function cargoConstructor(asentamiento: Asentamiento, heroeId: string): 'gobernador' | 'maestroObras' | null {
  if (asentamiento.cargos?.gobernadorId === heroeId) return 'gobernador';
  if (asentamiento.cargos?.maestroObrasId === heroeId) return 'maestroObras';
  return null;
}

/** "3 min" / "45 s" que faltan para un instante de mundo. */
function cuentaAtras(instanteFin: number | undefined): string {
  if (typeof instanteFin !== 'number') return '';
  const ms = instanteFin - (estadoCliente.proyeccionUltima?.instante ?? Date.now());
  if (ms <= 0) return 'listo';
  return ms >= 60_000 ? duracion(Math.round(ms / 60_000)) : `${Math.round(ms / 1000)} s`;
}

/** "2 h 15 min" / "40 min": las obras van por horas desde el backend del 2026-09-26. */
function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  return h === 0 ? `${min} min` : min === 0 ? `${h} h` : `${h} h ${min} min`;
}

/** Lanza un comando de gestión del asentamiento y refresca; el error va a `#asent-lado-error`. */
async function ejecutarAccionAsent(tipo: string, params: Record<string, unknown>): Promise<void> {
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, tipo, params);
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'El servidor rechazó la operación.');
    await refrescarDatosJuego();
  } catch (err) {
    const error = document.querySelector<HTMLElement>('#asent-lado-error');
    if (error) error.textContent = mensajeError(err);
  }
}

type EdificioAsent = 'centro' | 'reclutamiento' | 'taberna' | 'mercado';
let edificioAsent: EdificioAsent = 'centro';
type SeccionMercado = string; // 'ordenes' | 'caravanas' o el id de una subpestaña de `SUBPESTANAS_MERCADO_EXTRA`
let seccionMercado: SeccionMercado = 'ordenes';

/** Una pestaña por edificio. Taberna y Mercado existen siempre pero se abren al tener el edificio activo (decir qué falta es parte de la interfaz). */
const PESTANAS_EDIFICIO: { id: EdificioAsent; etiqueta: string; requiere?: { tipo: string; nombre: string } }[] = [
  { id: 'centro', etiqueta: 'Centro urbano' },
  { id: 'reclutamiento', etiqueta: 'Reclutamiento' },
  { id: 'taberna', etiqueta: 'Taberna', requiere: { tipo: 'taberna', nombre: 'una Taberna' } },
  { id: 'mercado', etiqueta: 'Mercado', requiere: { tipo: 'mercado', nombre: 'un Mercado' } },
];

function subpestanas(lista: [string, string][], actual: string): string {
  return `<div class="asent-tabs asent-subtabs">${lista.map(([id, nombre]) => `<button class="asent-tab${id === actual ? ' activo' : ''}" type="button" data-sub="${id}">${nombre}</button>`).join('')}</div>`;
}

/** Pinta y cablea la columna derecha completa (pestañas por edificio + su contenido). Se llama al montar y en cada
 * refresco/sondeo. Guarda el nombre `renderPanelEdificios` por los sitios que ya lo llaman. */
function renderPanelEdificios(): void {
  const raiz = document.querySelector<HTMLElement>('.asent-edificios');
  const tabsEl = raiz?.querySelector<HTMLElement>('.asent-edif-tabs');
  const cuerpo = raiz?.querySelector<HTMLElement>('.asent-edif-cuerpo');
  const proyeccion = estadoCliente.proyeccionUltima;
  const asentamiento = proyeccion?.asentamientos[0];
  if (!tabsEl || !cuerpo || !proyeccion || !asentamiento) return;

  const nombreBarra = document.querySelector<HTMLElement>('.asent-nombre');
  if (nombreBarra) nombreBarra.textContent = asentamiento.nombre ?? asentamiento.id;
  const edificios = asentamiento.edificios ?? [];
  const construido = (tipo: string): boolean => edificios.some((e) => e.tipo === tipo && e.estado === 'activo');
  // De visita en una plaza de otra Facción solo queda lo que se puede ver o usar desde fuera de ella (decisión de Víctor, 2026-10-29): Centro urbano
  // con Resumen y Territorio, y Mercado (con su candado si no lo hay) con las órdenes abiertas. Reclutamiento y Taberna no: el motor solo deja
  // reclutar y comprar intel en las plazas de tu Facción.
  const ajena = esPlazaAjena(proyeccion, asentamiento);
  const pestanas = ajena ? PESTANAS_EDIFICIO.filter((t) => t.id === 'centro' || t.id === 'mercado') : PESTANAS_EDIFICIO;
  const abierta = (id: EdificioAsent): boolean => { const t = pestanas.find((x) => x.id === id); return Boolean(t) && (!t!.requiere || construido(t!.requiere.tipo)); };
  if (!abierta(edificioAsent)) edificioAsent = 'centro';

  const tabs = pestanas.map((t) => abierta(t.id)
    ? `<button class="asent-tab${t.id === edificioAsent ? ' activo' : ''}" type="button" data-edificio="${t.id}">${t.etiqueta}</button>`
    : `<button class="asent-tab bloqueada" type="button" disabled title="Necesitas construir ${t.requiere!.nombre}">${t.etiqueta} 🔒</button>`).join('');
  const bloqueadas = pestanas.filter((t) => !abierta(t.id)).map((t) => `🔒 ${t.etiqueta}: necesitas construir ${t.requiere!.nombre}.`);
  const faltan = bloqueadas.length ? `<p class="asent-lado-nota">Pestañas bloqueadas ${ayuda('plaza:pestanas-bloqueadas', bloqueadas.join('<br>'))}</p>` : '';
  pintar(tabsEl, `<div class="asent-tabs asent-tabs-ancho">${tabs}</div>${faltan}`, () => {
    tabsEl.querySelectorAll<HTMLButtonElement>('[data-edificio]').forEach((boton) => boton.addEventListener('click', () => { edificioAsent = boton.dataset.edificio as EdificioAsent; renderPanelEdificios(); }));
  }, 'edificios');
  repintarFicha();

  const cargo = cargoConstructor(asentamiento, proyeccion.heroeId);
  const pie = '<p id="asent-lado-error" class="faction-error" role="alert"></p>';
  const ctxPlaza: ContextoPlaza = { proyeccion, asentamiento, cuerpo, ejecutar: ejecutarYRefrescar, refrescar: renderPanelEdificios, cargo, resideAqui: resideEnLaPlaza(proyeccion, asentamiento), escapar: escaparHtml };
  let html = '';
  let cablear: () => void = () => undefined;
  let ambito: string = edificioAsent;
  const cablearSub = (alCambiar: (sub: string) => void): void => cuerpo.querySelectorAll<HTMLButtonElement>('[data-sub]').forEach((b) => b.addEventListener('click', () => { alCambiar(b.dataset.sub!); renderPanelEdificios(); }));

  if (edificioAsent === 'centro' && ajena) {
    const SECCIONES: [SeccionAsent, string][] = [['resumen', 'Resumen'], ['pueblos', 'Territorio']];
    if (!SECCIONES.some(([id]) => id === seccionAsent)) seccionAsent = 'resumen';
    const territorio = SUBPESTANAS_CENTRO_EXTRA.find((s) => s.id === 'pueblos')!;
    const contenido = seccionAsent === 'pueblos' ? territorio.html(ctxPlaza) : seccionResumenAjena(proyeccion, asentamiento);
    html = `${subpestanas(SECCIONES, seccionAsent)}<div class="asent-lado-cuerpo">${contenido}</div>${pie}`;
    ambito = `ajena:${seccionAsent}`;
    cablear = () => {
      cablearSub((s) => { seccionAsent = s as SeccionAsent; });
      cablearPlegables(cuerpo);
      if (seccionAsent === 'pueblos') territorio.cablear?.(ctxPlaza);
    };
  } else if (edificioAsent === 'centro') {
    const extras = SUBPESTANAS_CENTRO_EXTRA.filter((s) => s.visible?.(ctxPlaza) ?? true);
    const SECCIONES: [SeccionAsent, string][] = [['resumen', 'Resumen'], ['edificios', 'Edificios'], ['produccion', 'Producción'], ['cola', 'Cola'], ['cargos', 'Cargos'], ...extras.map((s) => [s.id, s.etiqueta] as [string, string])];
    if (!SECCIONES.some(([id]) => id === seccionAsent)) seccionAsent = 'resumen';
    const extra = extras.find((s) => s.id === seccionAsent);
    // La subida de nivel va fuera de las subpestañas, entre las pestañas de arriba y las de abajo: botón arriba y requisitos plegados.
    const ascenso = proyeccion.ascensoDeAsentamiento ? seccionAscenso(asentamiento, proyeccion.ascensoDeAsentamiento, cargo === 'gobernador') : htmlAscensoLocal(proyeccion, asentamiento, cargo === 'gobernador', escaparHtml, renderPanelEdificios);
    const puedeMudarme = Boolean(proyeccion.faccionId) && asentamiento.faccionId === proyeccion.faccionId && !resideEnLaPlaza(proyeccion, asentamiento);
    const formNombre = resideEnLaPlaza(proyeccion, asentamiento)
      ? `<div class="asent-renombrar"><span class="faction-kicker">Nombre de la ciudad ${ayuda('plaza:nombre', 'Vacío = vuelve a mostrarse el identificador.')}</span><div class="mercado-acciones"><input class="form-input" type="text" maxlength="40" data-campo="nombre-plaza" value="${escaparHtml(asentamiento.nombre ?? '')}" placeholder="${escaparHtml(asentamiento.id)}" /><button id="btn-renombrar" class="btn-secondary" type="button">Cambiar nombre</button></div></div>`
      : '';
    const contenido = extra ? extra.html(ctxPlaza) : seccionAsent === 'resumen'
      ? seccionResumen(asentamiento) + formNombre
        + (puedeMudarme ? '<button id="btn-mudarme" class="btn-secondary" type="button" title="Hacer de esta plaza tu base: tu campamento se muda contigo">Hacer de esta plaza mi base</button>' : '')
      : seccionAsent === 'edificios' ? seccionEdificios(asentamiento, cargo)
        : seccionAsent === 'produccion' ? htmlProduccionYRecetas(ctxPlaza)
          : seccionAsent === 'cola' ? seccionCola(edificios, cargo)
            : renderCargosAsentamiento(asentamiento, proyeccion);
    html = `${ascenso ? `<section class="asent-ascenso">${ascenso}</section>` : ''}${subpestanas(SECCIONES, seccionAsent)}<div class="asent-lado-cuerpo">${contenido}</div>
      ${!cargo && (seccionAsent === 'edificios' || seccionAsent === 'cola') ? '<p class="asent-lado-nota">Necesitas ser Gobernador o Maestro de Obras para gestionar la construcción.</p>' : ''}${pie}`;
    ambito = `centro:${seccionAsent}`;
    cablear = () => {
      cablearSub((s) => { seccionAsent = s as SeccionAsent; });
      cuerpo.querySelector('#btn-mudarme')?.addEventListener('click', () => void mudarseAEstaPlaza());
      cuerpo.querySelector('#btn-renombrar')?.addEventListener('click', async () => {
        const nombre = cuerpo.querySelector<HTMLInputElement>('[data-campo="nombre-plaza"]')?.value ?? '';
        const mensaje = await ejecutarYRefrescar('renombrarAsentamiento', { asentamientoId: asentamiento.id, nombre });
        const error = cuerpo.querySelector<HTMLElement>('#asent-lado-error');
        if (error) error.textContent = mensaje ?? '';
        if (mensaje === null) olvidarEdicion(cuerpo);
      });
      cablearAccionesAsentLado(cuerpo, asentamiento, cargo);
      cablearCargosAsentamiento(cuerpo, asentamiento);
      cablearPlegables(cuerpo);
      if (seccionAsent === 'produccion') cablearProduccionYRecetas(ctxPlaza);
      extra?.cablear?.(ctxPlaza);
    };
  } else if (edificioAsent === 'mercado' && ajena) {
    // Las órdenes abiertas de la plaza, que se toman con el carro de tu columna (`comerciarEnPlaza`), como desde su ficha en el mapa.
    const ordenes = htmlMercadoDePlaza(proyeccion, asentamiento.id, escaparHtml);
    html = `<div class="asent-lado-cuerpo">${ordenes || '<p class="asent-lado-nota">No hay órdenes abiertas de compra ni de venta a la vista.</p>'}<p id="mapa-seleccion-error" class="faction-error" role="alert"></p></div>${pie}`;
    ambito = 'mercado:ajena';
    cablear = () => cablearMercadoDePlaza(cuerpo, asentamiento.id, { ejecutarConDatos: ejecutarConDatosYRefrescar, aviso: avisoMapa }, proyeccion.heroeId);
  } else if (edificioAsent === 'reclutamiento') {
    html = `<div class="asent-lado-cuerpo">${htmlReclutamiento(proyeccion, asentamiento, escaparHtml, renderPanelEdificios)}</div>${pie}`;
    cablear = () => cablearReclutamiento(cuerpo, proyeccion, asentamiento, ejecutarYRefrescar, renderPanelEdificios);
  } else if (edificioAsent === 'taberna') {
    html = `${renderPanelIntel(proyeccion, escaparHtml)}${pie}`;
    cablear = () => cablearPanelIntel(cuerpo, proyeccion, ejecutarYRefrescar, () => { olvidarEdicion(cuerpo); invalidar(cuerpo); renderPanelEdificios(); });
  } else {
    const SECCIONES: [SeccionMercado, string][] = [['ordenes', 'Órdenes'], ['caravanas', 'Caravanas'], ...SUBPESTANAS_MERCADO_EXTRA.map((s) => [s.id, s.etiqueta] as [string, string])];
    const extraMercado = SUBPESTANAS_MERCADO_EXTRA.find((s) => s.id === seccionMercado);
    const contenido = extraMercado ? extraMercado.html(ctxPlaza)
      : seccionMercado === 'caravanas' ? htmlCaravanas(proyeccion, asentamiento, escaparHtml, renderPanelEdificios)
        : htmlOrdenes(proyeccion, asentamiento, escaparHtml);
    html = `${subpestanas(SECCIONES, seccionMercado)}<div class="asent-lado-cuerpo">${contenido}</div>${pie}`;
    ambito = `mercado:${seccionMercado}`;
    cablear = () => {
      cablearSub((s) => { seccionMercado = s as SeccionMercado; });
      if (extraMercado) extraMercado.cablear?.(ctxPlaza);
      else if (seccionMercado === 'caravanas') cablearCaravanas(cuerpo, proyeccion, asentamiento, ejecutarYRefrescar);
      else cablearOrdenes(cuerpo, asentamiento, ejecutarYRefrescar);
    };
  }
  // Solo se repinta si cambió (la ciudad produce a cada tick), y lo elegido en los formularios vuelve a su sitio.
  pintar(cuerpo, html, cablear, ambito);
}

/** Una plaza de otra Facción (o de una Facción, si no tienes): de visita solo se ve lo de fuera. */
function esPlazaAjena(p: ProyeccionJugador, a: Asentamiento): boolean {
  return Boolean(a.faccionId) && a.faccionId !== p.faccionId;
}

/** El Resumen de una plaza ajena: su nombre, su Rey y la Facción dueña con su escudo completo. */
function seccionResumenAjena(p: ProyeccionJugador, a: Asentamiento): string {
  const f = p.facciones.find((x) => x.id === a.faccionId);
  const dir = p.directorioFacciones?.find((x) => x.id === a.faccionId);
  const nombre = f?.nombre ?? dir?.nombre ?? a.faccionId ?? '';
  const sigilo = f?.sigilo ?? dir?.sigilo;
  const rey = f?.reyId ? nombreDeHeroe(p, f.reyId) : null;
  return `<div class="plaza-ajena-resumen">
      ${sigilo ? `<span class="plaza-ajena-escudo">${svgSigilo(sigilo, 96)}</span>` : ''}
      <div class="asent-ficha-grid">
        <div><span>Plaza</span><strong>${escaparHtml(a.nombre ?? a.id)}</strong></div>
        <div><span>Facción</span><strong>${escaparHtml(nombre)}</strong></div>
        <div><span>Rey</span><strong>${rey ? escaparHtml(rey) : '—'}</strong></div>
      </div>
      <p class="asent-lado-nota">Estás de visita: esta plaza es de otra Facción.</p>
    </div>`;
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

const MOTIVO_BLOQUEO_ASCENSO: Record<BloqueoAscenso, string> = {
  nivel_maximo: 'Ya está en el nivel máximo.',
  ascenso_en_curso: 'Ya hay una obra de ascenso en curso.',
  falta_poblacion: 'Falta población para el nivel siguiente.',
  faltan_edificios: 'Faltan edificios para el nivel siguiente.',
  sin_cupo_de_faccion: 'Tu Facción no tiene cupo para otra plaza de ese nivel.',
  recursos_insuficientes: 'No hay en el almacén con qué pagar la obra.',
  insolvente: 'Los ingresos no cubrirían el mantenimiento del nivel siguiente.',
};

/** Subida de nivel (Doc 4.5): ya no sube sola al cumplir los requisitos; la pide el Gobernador, se paga entera del
 * almacén y tarda una obra. La evaluación (bloqueos, coste, solvencia) la calcula el servidor. */
function seccionAscenso(a: Asentamiento, evaluacion: EvaluacionAscenso | undefined, soyGobernador: boolean): string {
  const cabecera = `<div class="asent-lado-cabecera"><span class="faction-kicker">Subida de nivel ${ayuda('plaza:ascenso', 'La subida de nivel no es automática: la pide el Gobernador, se paga entera del almacén y tarda una obra. Si conquistan la plaza durante la obra, se pierde.')}</span></div>`;
  if (a.ascenso) {
    return `${cabecera}<p class="asent-lado-nota">Obra en curso hacia el nivel ${a.ascenso.nivelObjetivo} · ${cuentaAtras(a.ascenso.completaEn)}.</p>`;
  }
  if (!evaluacion || evaluacion.nivelObjetivo === null) return '';
  const costo = Object.entries(evaluacion.costo)
    .map(([recurso, cantidad]) => `${RECURSO_ICONO[recurso] ?? '📦'} ${Math.ceil(cantidad ?? 0)} ${escaparHtml(RECURSO_NOMBRE[recurso] ?? recurso)}`)
    .join(' · ');
  const fmt = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1));
  const deficit = evaluacion.solvencia
    .filter((s) => s.ingresoPorMinuto < s.costoPorMinuto)
    .map((s) => `${escaparHtml(RECURSO_NOMBRE[s.recurso] ?? s.recurso)}: ${fmt(s.ingresoPorMinuto)} de ${fmt(s.costoPorMinuto)}/min`)
    .join(' · ');
  const motivos = evaluacion.bloqueos.map((b) => `<li>${escaparHtml(MOTIVO_BLOQUEO_ASCENSO[b] ?? b)}</li>`).join('');
  return `${cabecera}
    <p class="asent-lado-nota">Al nivel ${evaluacion.nivelObjetivo}: ${costo || 'sin coste'} · obra de ${duracion(evaluacion.obraMinutos)}.</p>
    ${deficit ? `<p class="asent-lado-nota">No cubre el mantenimiento: ${deficit}.</p>` : ''}
    ${motivos ? `<ul class="asent-lado-nota">${motivos}</ul>` : ''}
    ${soyGobernador
      ? `<button id="btn-solicitar-ascenso" class="btn-primary" type="button"${evaluacion.puede ? '' : ' disabled'}>Subir a nivel ${evaluacion.nivelObjetivo}</button>`
      : '<p class="asent-lado-nota">Solo el Gobernador puede pedir la subida.</p>'}`;
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
      const mejorandose = lista.filter((e) => e.mejora).length;
      const meta = [lista.length > 1 ? `×${lista.length}` : '', nivelMax > 1 ? `N${nivelMax}` : ''].filter(Boolean).join(' · ');
      const nota = [enObra ? `${enObra} en obra` : '', mejorandose ? `${mejorandose} mejorándose` : '', parados ? `${parados} parado${parados > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
      // La mejora ataca la instancia ACTIVA de menor nivel interno que no se esté mejorando ya (todas las de un tipo
      // son intercambiables).
      const objetivoMejora = lista
        .filter((e) => e.estado === 'activo' && !e.mejora)
        .sort((e1, e2) => (e1.nivelInterno ?? 1) - (e2.nivelInterno ?? 1))[0];
      return `<div class="asent-edif-item asent-edif-con-icono${tipoSeleccionado() === tipo ? ' sel' : ''}" data-fila-tipo="${escaparHtml(tipo)}" style="--swatch:${EDIFICIO_COLOR[tipo] ?? '#888'}">
        <span class="asent-edif-nombre">${iconoEdificio(tipo, 26)}${escaparHtml(EDIFICIO_NOMBRE[tipo] ?? tipo)}</span>
        <span class="asent-edif-meta">${escaparHtml(meta)}</span>
        ${cargo && objetivoMejora && tipo !== 'centroUrbano' ? `<button class="asent-edif-mejora" type="button" data-mejorar="${escaparHtml(objetivoMejora.id)}" title="Mejorar el de menor nivel">⬆</button>` : ''}
        ${nota ? `<span class="asent-edif-nota">${escaparHtml(nota)}</span>` : ''}
      </div>`;
    })
    .join('');
  const anadir = htmlBotonesConstruir(a, cargo);
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
  // Las mejoras en curso no están en la cola pero ocupan una cuadrilla de obra: se enseñan encima, sin acciones.
  const mejoras = edificios
    .filter((e) => e.mejora)
    .map((e) => `<div class="asent-cola-item" style="--swatch:${EDIFICIO_COLOR[e.tipo] ?? '#888'}">
      <span class="asent-cola-pos">⬆</span>
      <span class="asent-edif-nombre asent-edif-icono">${iconoEdificio(e.tipo, 22)}${escaparHtml(EDIFICIO_NOMBRE[e.tipo] ?? e.tipo)}</span>
      <span class="asent-edif-nota">mejora a N${e.mejora!.nivelObjetivo} · ${cuentaAtras(e.mejora!.completaEn)}</span>
    </div>`)
    .join('');
  if (cola.length === 0 && !mejoras) return '<p class="mapa-lista-vacia">Sin obras en curso ni en cola.</p>';
  return `<div class="asent-cola-lista">${mejoras}${cola
    .map((e, i) => `<div class="asent-cola-item" style="--swatch:${EDIFICIO_COLOR[e.tipo] ?? '#888'}">
      <span class="asent-cola-pos">${i + 1}</span>
      <span class="asent-edif-nombre asent-edif-icono">${iconoEdificio(e.tipo, 22)}${escaparHtml(EDIFICIO_NOMBRE[e.tipo] ?? e.tipo)}</span>
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
  cont.querySelector('#btn-solicitar-ascenso')?.addEventListener('click', () => void ejecutarAccionAsent('solicitarAscenso', { asentamientoId: a.id }));
  if (!cargo) return;
  cont.querySelectorAll<HTMLButtonElement>('[data-construir]').forEach((b) => b.addEventListener('click', () => {
    // Uno apagado dice por qué no, en vez de pedirlo.
    if (b.classList.contains('apagado')) { const error = document.querySelector<HTMLElement>('#asent-lado-error'); if (error) error.textContent = b.title; return; }
    void ejecutarAccionAsent('anadirEdificioManualmente', { asentamientoId: a.id, cargo, tipo: b.dataset.construir });
  }));
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
    vaciar(contenedor);
    return;
  }
  contenedor.hidden = false;
  const htmlRecursos = items
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
  pintar(contenedor, htmlRecursos, undefined, 'recursos');
}

/** Pinta el panel flotante de la barra (Ejércitos) según `panelAsentAbierto`. */
function renderPanelAsent(): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  const barra = document.querySelector<HTMLElement>('.asent-barra');
  const panel = document.querySelector<HTMLElement>('.asent-panel');
  if (!barra || !panel || !proyeccion) return;
  const botonSalir = barra.querySelector('#btn-salir-mundo');
  const plazaActual = proyeccion.asentamientos[0];
  if (botonSalir && plazaActual) botonSalir.textContent = resideEnLaPlaza(proyeccion, plazaActual) ? 'Salir al mundo' : 'Salir';
  barra.querySelectorAll<HTMLButtonElement>('[data-panel-asent]').forEach((boton) => {
    boton.classList.toggle('activo', boton.dataset.panelAsent === panelAsentAbierto);
  });
  if (panelAsentAbierto === null) { panel.hidden = true; vaciar(panel); return; }
  panel.hidden = false;
  if (panelAsentAbierto === 'ejercito') {
    const asentamiento = proyeccion.asentamientos[0];
    if (!asentamiento) return;
    pintar(panel, htmlUnirseDesdePlaza(proyeccion, asentamiento, escaparHtml), () => cablearUnirseDesdePlaza(panel, proyeccion, asentamiento, ejecutarYRefrescar), 'ejercito');
    return;
  }
}

/** Sección "Cargos" del panel de Facción, acotada al asentamiento que se pisa. Solo aparecen los cargos que
 * el jugador PUEDE asignar aquí: Gobernador si eres el REY de la Facción; los otros cuatro si eres el
 * Gobernador (Doc 2.2, `asignarCargoLocal` en el backend, 2026-09-10). */
/** Los cargos que se están cambiando (combo a la vista): sobreviven a los repintados del sondeo hasta que se asigna. */
const cargosEditando = new Set<string>();

/** Subpestaña «Cargos»: cada cargo con quien lo ocupa (o «vacante») y, si puedes nombrarlo, un botón «Cambiar» al lado. Al pulsarlo el nombre deja
 * su sitio a un combo con los ciudadanos y el botón pasa a «Asignar»; al asignar vuelve el nombre. El Rey nombra al Gobernador; el Gobernador, al resto. */
function renderCargosAsentamiento(asentamiento: Asentamiento | undefined, proyeccion: ProyeccionJugador): string {
  if (!asentamiento) return '';
  const faccion = proyeccion.facciones.find((f) => f.id === proyeccion.faccionId);
  const soyGobernador = asentamiento.cargos?.gobernadorId === proyeccion.heroeId;
  const soyRey = faccion?.reyId === proyeccion.heroeId;
  const ciudadanos = faccion?.ciudadanosIds ?? [];
  const cargos = [
    ['gobernadorId', 'Gobernador', soyRey],
    ['maestroObrasId', 'Maestro de Obras', soyGobernador],
    ['tesoreroId', 'Tesorero', soyGobernador],
    ['generalId', 'General', soyGobernador],
    ['sacerdoteId', 'Sacerdote', soyGobernador],
  ] as const;
  return `
    <section class="asent-cargos">
      <span class="faction-kicker">Cargos de ${escaparHtml(asentamiento.nombre ?? asentamiento.id)} ${ayuda('plaza:cargos', 'El Rey nombra al Gobernador y el Gobernador, al resto.')}</span>
      ${cargos.map(([clave, nombre, puede]) => {
        const cargo = clave.replace('Id', '');
        const actual = asentamiento.cargos?.[clave] ?? null;
        const editando = puede && cargosEditando.has(cargo);
        return `<div class="asent-cargo" data-cargo="${cargo}">
          <span class="asent-cargo-nombre">${nombre}</span>
          <span class="asent-cargo-titular">
            <span class="asent-cargo-texto${actual ? '' : ' vacante'}"${editando ? ' hidden' : ''}>${actual ? escaparHtml(nombreDeHeroe(proyeccion, actual)) : 'vacante'}</span>
            ${puede ? `<select class="asent-cargo-sel"${editando ? '' : ' hidden'}>${ciudadanos.map((id) => `<option value="${escaparHtml(id)}"${id === actual ? ' selected' : ''}>${escaparHtml(nombreDeHeroe(proyeccion, id))}</option>`).join('')}</select>` : ''}
          </span>
          ${puede ? `<button class="btn-secondary asent-cargo-btn" type="button">${editando ? 'Asignar' : 'Cambiar'}</button>` : ''}
        </div>`;
      }).join('')}
      ${soyGobernador || soyRey ? '' : '<p class="asent-lado-nota">Solo el Rey (al Gobernador) y el Gobernador (al resto) pueden cambiar los cargos.</p>'}
      <p id="asent-cargo-error" class="faction-error" role="alert"></p>
    </section>
    ${htmlResidentesPlaza(proyeccion, asentamiento, escaparHtml)}`;
}

function cablearCargosAsentamiento(panel: HTMLElement, asentamiento: Asentamiento | undefined): void {
  if (!asentamiento) return;
  panel.querySelectorAll<HTMLElement>('.asent-cargo').forEach((fila) => {
    const cargo = fila.dataset.cargo!;
    const texto = fila.querySelector<HTMLElement>('.asent-cargo-texto');
    const select = fila.querySelector<HTMLSelectElement>('.asent-cargo-sel');
    const boton = fila.querySelector<HTMLButtonElement>('.asent-cargo-btn');
    boton?.addEventListener('click', async () => {
      const error = panel.querySelector<HTMLElement>('#asent-cargo-error');
      if (!cargosEditando.has(cargo)) {
        // «Cambiar»: el combo ocupa el sitio del nombre.
        cargosEditando.add(cargo);
        texto?.toggleAttribute('hidden', true);
        select?.toggleAttribute('hidden', false);
        boton.textContent = 'Asignar';
        select?.focus();
        return;
      }
      const heroeId = select?.value;
      if (!heroeId) return;
      boton.disabled = true;
      try {
        const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'asignarCargoLocal', { asentamientoId: asentamiento.id, cargo, heroeId });
        if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'No se pudo asignar el cargo.');
        cargosEditando.delete(cargo);
        if (error) error.textContent = '';
        await refrescarDatosJuego();
      } catch (err) {
        boton.disabled = false;
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
    ${htmlBarraJugador(proyeccion, escaparHtml)}
    <header class="asent-barra">
      <span class="asent-nombre">${escaparHtml(asentamiento.nombre ?? asentamiento.id)}</span>
      <span class="asent-nivel">Nivel ${asentamiento.nivel}</span>
      <div class="asent-barra-acciones">
        <button type="button" data-panel-asent="ejercito">Ejércitos</button>
        <button id="btn-salir-mundo" class="btn-primary" type="button">Salir al mundo</button>
      </div>
      <p id="asent-error" class="faction-error" role="alert"></p>
    </header>
    <div class="asent-cuerpo">
      <aside class="asent-izq">
        <aside class="asent-panel" hidden></aside>
      </aside>
      <div class="asent-centro">
        <div class="asent-mapa">
          <div class="asent-lienzo"><canvas id="mapa" width="900" height="900"></canvas></div>
        </div>
        <div class="asent-recursos" hidden></div>
      </div>
      <aside class="asent-lado"><div class="asent-edificios"><div class="asent-edif-tabs"></div><div class="asent-edif-cuerpo"></div></div></aside>
    </div>
    <div class="asent-tooltip" hidden></div>
    ${HTML_VELO_SALIDA}
    <aside class="jugador-panel" hidden></aside>
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
  contenedor.querySelector('#btn-salir-mundo')?.addEventListener('click', () => { panelAsentAbierto = null; menuEsquinaAbierto = false; sincronizarMenuEsquina(); renderPanelAsent(); abrirVentanaSalida(); });
  cablearMenuEsquina(contenedor);
  cablearBarraJugador(contenedor);
  cablearTooltipEdificios(contenedor);
  cablearVistaCiudad(contenedor, {
    proyeccion: () => estadoCliente.proyeccionUltima ?? undefined, ejecutar: ejecutarYRefrescar, escapar: escaparHtml,
    redibujar: () => { if (estadoCliente.proyeccionUltima) void dibujarPantallaSegunModo(estadoCliente.proyeccionUltima); },
    repintarLista: renderPanelEdificios,
  });
  // La ciudad tiene vida (almacén, producción, población) aunque el jugador no toque nada: mismo sondeo
  // suave que el mapa, hasta que exista el canal de tiempo real.
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.asent-screen') || !hayQueSondear()) return;
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

    tooltip.innerHTML = htmlTooltipEdificio(proyeccion, edificio, escaparHtml);
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
  app.innerHTML = `<div class="login-container"><div class="login-card"><div class="login-header"><h1 class="login-title">Bronze Age Collapse</h1><p class="login-subtitle">Cliente de Jugador — Inicio de Sesión</p></div>${errorMensaje ? `<div class="error-banner">⚠️ ${escaparHtml(errorMensaje)}</div>` : ''}<form id="form-login"><div class="form-group"><label class="form-label" for="input-usuario">Nick</label><input type="text" id="input-usuario" class="form-input" value="${escaparHtml(estadoCliente.usuarioActivo)}" required autocomplete="username" /></div><div class="form-group"><label class="form-label" for="input-clave">Contraseña</label><input type="password" id="input-clave" class="form-input" required minlength="8" maxlength="128" autocomplete="current-password" /><small id="ayuda-registro" class="form-ayuda" hidden>Nick de 3 a 32 caracteres (letras, cifras, «_», «-» o «.»); contraseña de 8 a 128.</small></div><label class="form-check"><input type="checkbox" id="chk-registro" /> No tengo cuenta — crear una</label><div class="form-group" id="grupo-codigo" hidden><label class="form-label" for="input-codigo">Código de invitación</label><input type="text" id="input-codigo" class="form-input" autocomplete="off" /></div><button type="submit" id="btn-login-submit" class="btn-primary">Entrar</button></form></div></div>`;
  const chkRegistro = document.querySelector<HTMLInputElement>('#chk-registro');
  chkRegistro?.addEventListener('change', () => {
    const grupoCodigo = document.querySelector<HTMLDivElement>('#grupo-codigo');
    if (grupoCodigo) grupoCodigo.hidden = !chkRegistro.checked;
    const ayuda = document.querySelector<HTMLElement>('#ayuda-registro');
    if (ayuda) ayuda.hidden = !chkRegistro.checked;
    const boton = document.querySelector<HTMLButtonElement>('#btn-login-submit');
    if (boton) boton.textContent = chkRegistro.checked ? 'Crear cuenta y entrar' : 'Entrar';
  });
  document.querySelector<HTMLFormElement>('#form-login')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nick = document.querySelector<HTMLInputElement>('#input-usuario')?.value.trim();
    const clave = document.querySelector<HTMLInputElement>('#input-clave')?.value ?? '';
    const codigo = document.querySelector<HTMLInputElement>('#input-codigo')?.value.trim() || undefined;
    if (!nick || !clave) return;
    try {
      if (chkRegistro?.checked) await registrarCuenta(nick, clave, codigo);
      const login = await loginConClave(nick, clave);
      // Se entra con la cuenta; la partida se elige después, en la pantalla de partidas.
      guardarSesionLocal(login.sesionId, nick, '');
      estadoCliente.usuarioActivo = nick;
      estadoCliente.gameIdActivo = '';
      estadoCliente.proyeccionUltima = null;
      estadoCliente.sinHeroe = false;
      pantallaMontada = null;
      enrutar();
    } catch (err) { renderVistaLogin(mensajeError(err)); }
  });
}

/** Pantalla de partidas: elegir a cuál entrar (unirse si aún no eres miembro) y cargarla como antes. */
function montarPantallaPartidas(): void {
  void montarPartidas(app, {
    usuario: estadoCliente.usuarioActivo,
    previa: cargarSesionLocal()?.gameId ?? '',
    cerrarSesion: () => cerrarSesionYVolverALogin(),
    mensajeError,
    escapar: escaparHtml,
    entrar: async (partida) => {
      if (!partida.membresia) {
        try { await unirseAPartida(partida.gameId); } catch (err) { if (!(err instanceof ApiError) || err.status !== 409) throw err; }
      }
      recordarPartida(partida.gameId);
      estadoCliente.gameIdActivo = partida.gameId;
      estadoCliente.nombrePartidaActiva = partida.nombre ?? '';
      estadoCliente.proyeccionUltima = null;
      estadoCliente.sinHeroe = false;
      await refrescarDatosJuego();
    },
  });
}

/** Deja la partida actual (sin cerrar sesión) y vuelve a la lista de partidas. */
function volverALasPartidas(): void {
  cerrarPresencia();
  reiniciarAvisos();
  recordarPartida('');
  estadoCliente.gameIdActivo = '';
  estadoCliente.proyeccionUltima = null;
  estadoCliente.sinHeroe = false;
  pantallaMontada = null;
  enrutar();
}

/** La interfaz ANTERIOR, intacta, servida solo desde `#/legacy` (Doc `twinkly-greeting-peacock.md`). El
 * revamp de pantallas vive fuera de aquí. */
function montarLegacy(): void {
  app.innerHTML = `<div class="game-container"><header class="top-bar"><div class="brand-section"><span class="brand-title">Bronze Age Collapse</span><span class="brand-badge">Cliente Jugador</span></div><div class="user-section"><div class="user-info"><div class="user-avatar">${escaparHtml(estadoCliente.usuarioActivo.substring(0, 2).toUpperCase())}</div><div class="details-group"><button id="btn-toggle-proyeccion" class="user-name" type="button" aria-expanded="false" aria-controls="panel-proyeccion">${escaparHtml(estadoCliente.usuarioActivo)}</button><span class="game-id" title="${escaparHtml(estadoCliente.gameIdActivo)}">Partida: <strong>${escaparHtml(estadoCliente.nombrePartidaActiva || estadoCliente.gameIdActivo)}</strong></span></div></div><button id="btn-toggle-vista" class="btn-secondary">🏙️ Ver Ciudad</button><button id="btn-refrescar" class="btn-secondary">🔄 Refrescar</button><button id="btn-logout" class="btn-secondary">Cerrar Sesión</button></div></header><div class="main-content"><div id="panel-interaccion" class="card-panel interaction-panel"><div class="interaction-loading">Cargando opciones de interacción...</div></div><div id="panel-proyeccion" class="card-panel projection-panel" hidden><h2 class="panel-title">Proyección del Jugador (JSON / HTTP)</h2><pre id="proyeccion">Cargando proyección...</pre></div>${renderPanelMapa()}</div></div>`;
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
  let escalaMundo = 1;
  if (estadoCliente.modoVista === 'mundo') {
    if (titulo) titulo.textContent = 'Mapa del Mundo (Evaluación T2a)';
    // Solo en `#/legacy`: el mundo entero en el lienzo (el modo mundo del juego es 3D, `src/mundo3d/`).
    const mapa = await sincronizarMapa(proyeccion.mapaId);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    escalaMundo = canvas.width / mapa.config.ancho;
    pintarTerreno(ctx, mapa, proyeccion, escalaMundo);
    pintarMiradas(ctx, proyeccion.miradasIntel ?? [], proyeccion.instante, escalaMundo);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (titulo) titulo.textContent = 'Vista de Asentamiento (Geometría Urbana T2a)';
    const asentamiento = proyeccion.asentamientos[0];
    ajustarLienzo(canvas, 1, 1);
    // El mapa da el color del suelo donde está la plaza; si aún no se ha bajado, se pinta llano.
    const mapa = asentamiento ? await sincronizarMapa(proyeccion.mapaId).catch(() => null) : null;
    if (asentamiento) pintarAsentamiento(ctx, asentamiento, proyeccion.trazadoPorAsentamiento?.[asentamiento.id], edificioSeleccionado(), mapa);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillText('No perteneces a ningún asentamiento aún.', 20, 40); }
  }
  if (estadoCliente.modoFundacionActivo && estadoCliente.posicionFundacion && estadoCliente.mapaCache?.mapa) {
    pintarPrevisualizacionFundacion(ctx, estadoCliente.mapaCache.mapa, estadoCliente.posicionFundacion, escalaMundo, sitiosDeAldeaAlFundar(estadoCliente.posicionFundacion), parcelasAlFundar(estadoCliente.posicionFundacion));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function actualizarModoFundacion(proyeccion: ProyeccionJugador): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#mapa');
  if (!canvas) return;
  if (!estadoCliente.modoFundacionActivo) { canvas.classList.remove('mapa-fundacion-activo'); canvas.onpointermove = null; canvas.onpointerleave = null; canvas.onclick = null; return; }
  canvas.classList.add('mapa-fundacion-activo');
  const punto = (evento: MouseEvent) => { const mapa = estadoCliente.mapaCache?.mapa; return mapa ? puntoDeMapa(evento, canvas, mapa) : { x: 0, y: 0 }; };
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

async function confirmarFundacion(_proyeccion: ProyeccionJugador, _posicion: { x: number; y: number }): Promise<void> {
  try {
    // Backend 2026-10-04 (Doc 1.3): solo se funda con `fundar`, el titular con su Caravana de Fundación enganchada y donde
    // está su columna. El punto elegido en el mapa es solo la vista previa de recursos.
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'fundar', {});
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'No se pudo fundar aquí.');
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

/** Cuándo se pidió la proyección por última vez: con el socket vivo el tick avisa solo y el sondeo es solo de reserva. */
let ultimoRefresco = 0;
const RESERVA_SIN_TICK_MS = 30_000;
/** ¿Toca sondear? Sin socket, siempre; con socket, solo si llevamos mucho sin noticias (por si se perdió un tick). */
function hayQueSondear(): boolean {
  return !tiempoRealVivo() || Date.now() - ultimoRefresco > RESERVA_SIN_TICK_MS;
}

/** El campamento de residencia donde ya se pidió repostar en esta visita: se pide una vez al entrar y se olvida al salir. */
let repostadoEn: string | null = null;

/** Al entrar en tu campamento de residencia, los víveres se llenan solos (`repostarEnCampamento`, gratis para cualquiera en el campamento):
 * así la próxima salida sale al máximo, sin depender de la ración de salida, que tiene plazo. */
function repostarAlEntrar(p: ProyeccionJugador): void {
  const u = p.heroe.ubicacion;
  if (u.tipo !== 'mercenarios') { repostadoEn = null; return; }
  const campamento = p.campamentosMercenarios.find((c) => c.id === u.campamentoId);
  if (!campamento?.residentesIds.includes(p.heroeId) || repostadoEn === campamento.id) return;
  repostadoEn = campamento.id;
  if ((p.heroe.viveres ?? 0) >= capacidadDeViveres() - 0.5) return;
  void ejecutarComando(estadoCliente.gameIdActivo, 'repostarEnCampamento', { campamentoId: campamento.id }).then((r) => {
    if (r.resultado.ok) mostrarAviso('Víveres al máximo: se repostan solos al entrar en tu campamento.');
  }).catch(() => undefined);
}

async function refrescarDatosJuego(): Promise<void> {
  ultimoRefresco = Date.now();
  const respuesta = await consultarProyeccion(estadoCliente.gameIdActivo);
  medirRitmoDeMundo(respuesta.instante);
  estadoCliente.sinHeroe = respuesta.sinHeroe === true;
  estadoCliente.proyeccionUltima = respuesta.sinHeroe ? null : respuesta;
  if (respuesta.sinHeroe) campamentosParaElegir = respuesta.campamentos ?? [];
  if (!respuesta.sinHeroe) {
    abrirPresencia(estadoCliente.gameIdActivo);
    // El Líder de un ejército «decide yo» tiene 10 s para contestar: se le avisa por sondeo hasta que el backend le mande el evento (`columna.union_pedida`).
    for (const x of peticionesNuevasConv(respuesta)) {
      mostrarAviso(`${nombreDeHeroe(respuesta, x.heroeId)} pide unirse a tu ejército en preparación (botón «Salir al mundo» / «Salir»).`, true);
    }
    for (const x of peticionesNuevas(respuesta)) {
      mostrarAviso(`${nombreDeHeroe(respuesta, x.heroeId)} pide unirse a tu ejército: ${Math.max(0, Math.ceil((x.expiraEn - respuesta.instante) / 1000))} s para contestar (botón ⚑ del mapa).`, true);
    }
    actualizarSeguimiento(respuesta, (texto) => mostrarAviso(texto));
    repostarAlEntrar(respuesta);
    fijarCanalesTiempoReal(canalesDe(respuesta));
    void avisarDeEventos(estadoCliente.gameIdActivo, respuesta.version);
  }
  enrutar();
}

// --- ROUTER DE PANTALLAS --------------------------------------------------------------------------
// La pantalla que se ve es un reflejo directo del estado de la proyección (Doc de diseño
// `twinkly-greeting-peacock.md`): no hay "última pantalla" guardada, así que recargar devuelve al jugador a
// donde estaba. `#/legacy` es la válvula de escape a la interfaz anterior, intacta, y solo se llega
// escribiéndola en la URL.
type Pantalla = 'login' | 'partidas' | 'cargando' | 'heroe' | 'campamento' | 'mapa' | 'asentamiento' | 'pueblo' | 'legacy';

let pantallaMontada: Pantalla | null = null;
/** Limpieza de la pantalla saliente (listeners globales, etc.). La fija quien monta una pantalla que los
 * necesite (hoy solo el Mapa: `window` resize del zoom/pan). */
let limpiarPantalla: (() => void) | null = null;

function esRutaLegacy(): boolean {
  return location.hash.replace(/^#\/?/, '') === 'legacy';
}

function pantallaActual(): Pantalla {
  if (!estadoCliente.usuarioActivo) return 'login';
  if (!estadoCliente.gameIdActivo) return 'partidas';
  if (estadoCliente.sinHeroe) return 'heroe';
  if (esRutaLegacy()) return 'legacy';
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return 'cargando';
  // Sin Facción ya no hay pantalla aparte: se nace en un campamento y desde él (o desde el riel del Mapa) se crea o se pide.
  // Dentro de un campamento cuyo ámbito aún no ha llegado (al recargar, `CAMPAMENTO` viene justo detrás de `HEROE`): se espera. Montar el
  // campamento sin él dejaba «Cargando partida…» para siempre, con la pantalla ya marcada como montada.
  if (proyeccion.heroe.ubicacion.tipo === 'mercenarios') return campamentoActual(proyeccion) ? 'campamento' : 'cargando';
  // Dentro de un pueblo o una aldea: su pantalla, si ya llegó su ficha (la de un pueblo ajeno puede no llegar: se ve el mapa).
  if (proyeccion.heroe.ubicacion.tipo === 'pueblo' && puebloActual(proyeccion)) return 'pueblo';
  if (proyeccion.asentamientos.length > 0) return 'asentamiento';
  return 'mapa';
}

function montar(pantalla: Pantalla): void {
  limpiarPantalla?.();
  limpiarPantalla = null;
  panelJugador = null;
  vistaMapaAbierta = false;
  eleccionEnMapa = null;
  controlVistaMapa?.destruir();
  controlVistaMapa = null;
  switch (pantalla) {
    case 'login': renderVistaLogin(); break;
    case 'partidas': montarPantallaPartidas(); break;
    case 'legacy': montarLegacy(); break;
    case 'cargando': app.innerHTML = '<div class="login-container"><div class="login-card"><p class="login-subtitle">Cargando partida…</p></div></div>'; break;
    case 'heroe': montarHeroe(); break;
    case 'campamento': montarCampamento(); break;
    case 'mapa': montarMapa(); break;
    case 'asentamiento': montarAsentamiento(); break;
    case 'pueblo': montarPueblo(); break;
  }
}

/** Rellena los trozos dinámicos de la pantalla ya montada (el DOM se monta una vez, guard de
 * `pantallaMontada`; aquí se le vuelca la proyección en cada refresco): Mapa vuelve a pintar el canvas,
 * legacy repinta panel + canvas + JSON como hacía antes. */
function refrescarPantalla(pantalla: Pantalla): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  if (pantalla === 'mapa' || pantalla === 'campamento' || pantalla === 'asentamiento' || pantalla === 'pueblo') {
    renderPanelJugador();
    pintarRastreador(proyeccion, abrirMisiones, escaparHtml);
    if (vistaMapaAbierta) void pintarVistaMapa();
  }
  if (pantalla === 'mapa') { pintarComida(proyeccion); renderSeleccionMapa(); renderPanelRiel(); return; }
  if (pantalla === 'campamento' || pantalla === 'pueblo' || pantalla === 'asentamiento') renderVentanaSalida();
  if (pantalla === 'campamento') { const c = campamentoActual(proyeccion); if (c) pintarCampamento(proyeccion, c); return; }
  if (pantalla === 'pueblo') { pintarPueblo(proyeccion); return; }
  if (pantalla === 'asentamiento') { void dibujarPantallaSegunModo(proyeccion); renderPanelEdificios(); renderPanelRecursos(); renderPanelAsent(); return; }
  if (pantalla !== 'legacy') return;
  renderizarPanelInteraccion(proyeccion);
  void dibujarPantallaSegunModo(proyeccion);
  const salida = document.querySelector<HTMLParagraphElement>('#estado');
  const json = document.querySelector<HTMLPreElement>('#proyeccion');
  if (salida) salida.textContent = `Conectado a '${estadoCliente.nombrePartidaActiva || estadoCliente.gameIdActivo}' — ${fechaDeMundo(proyeccion.instante)} | Modo: ${estadoCliente.modoVista} | Facción: ${proyeccion.faccionId ?? '(Ninguna)'}`;
  if (json) json.textContent = JSON.stringify(proyeccion, null, 2);
}

function enrutar(): void {
  const destino = pantallaActual();
  if (destino !== pantallaMontada) {
    ventanaSalidaAbierta = false;
    montar(destino);
    pantallaMontada = destino;
  }
  refrescarPantalla(destino);
}

function cerrarSesionYVolverALogin(mensaje?: string): void {
  cerrarSesion();
  reiniciarAvisos();
  estadoCliente.usuarioActivo = '';
  estadoCliente.proyeccionUltima = null;
  estadoCliente.sinHeroe = false;
  pantallaMontada = 'login';
  renderVistaLogin(mensaje);
}

/** Los canales de tiempo real que interesan con esta proyección: lo global, lo que te nombra a ti y lo de cada plaza de tu Facción que conoces. */
function canalesDe(p: ProyeccionJugador): string[] {
  const plazas = new Set([
    ...p.asentamientos.filter((a) => a.faccionId === p.faccionId).map((a) => a.id),
    ...p.asentamientosAvistados.filter((a) => a.faccionId === p.faccionId).map((a) => a.id),
    ...p.asentamientosConocidos.filter((a) => a.faccionId === p.faccionId).map((a) => a.asentamientoId),
  ]);
  return ['mapa/general', `heroe/${p.heroeId}`, ...[...plazas].map((id) => `asentamiento/${id}`)];
}

/** Un evento por el WebSocket solo avisa: se pide la proyección (y con ella el cursor de eventos) al momento, en vez de esperar al sondeo. Los
 * eventos llegan en ráfagas (un tick narra varios), así que se agrupan en un solo refresco. */
let refrescoPorEvento: ReturnType<typeof setTimeout> | undefined;
function alEventoDelServidor(): void {
  clearTimeout(refrescoPorEvento);
  refrescoPorEvento = setTimeout(() => { if (estadoCliente.usuarioActivo) void refrescarDatosJuego().catch(() => {}); }, 250);
}

/** La partida se abrió en otra pestaña con la misma cuenta: el servidor admite una sola sesión por cuenta y cerró esta. Se queda quieta (si se
 * reconectara sola, echaría a la otra, y así sin parar) hasta que el jugador elija seguir aquí, lo que a su vez cierra la otra. */
function mostrarSesionReemplazada(): void {
  if (document.querySelector('#sesion-reemplazada')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="sesion-reemplazada" class="login-container" style="position:fixed;inset:0;z-index:1000;background:rgba(10,8,6,0.85)">
    <div class="login-card"><p class="login-subtitle">Has abierto la partida en otra pestaña o ventana con esta misma cuenta. El servidor solo admite una a la vez, así que esta se ha desconectado.</p>
    <button id="btn-seguir-aqui" class="btn-primary" type="button">Jugar en esta pestaña</button></div></div>`);
  document.querySelector('#btn-seguir-aqui')?.addEventListener('click', () => {
    document.querySelector('#sesion-reemplazada')?.remove();
    retomarSesion();
    void refrescarDatosJuego().catch(() => {});
  });
}

function arrancar(): void {
  window.addEventListener('hashchange', enrutar);
  alCargarSigilos(() => { const p = estadoCliente.proyeccionUltima; if (p) void dibujarPantallaSegunModo(p); });
  alEventoTiempoReal(alEventoDelServidor);
  alTickDeMundo(alEventoDelServidor); // el tick del reloj de mundo avisa de que hay que pedir la proyección (backend 4e037c4)
  alLlegarInforme(mostrarInforme);
  alSesionReemplazada(mostrarSesionReemplazada);
  alCambiarAvisos(() => renderPanelJugador());
  // Cerrar la pestaña o la ventana cierra el socket de presencia (lo haría el navegador, pero así es explícito y también vale al recargar).
  window.addEventListener('pagehide', () => cerrarPresencia());
  const sesion = cargarSesionLocal();
  if (sesion) {
    estadoCliente.usuarioActivo = sesion.usuario;
    estadoCliente.gameIdActivo = sesion.gameId;
  }
  enrutar();
  if (sesion?.gameId) {
    // Al recargar el nombre no está en la sesión: se pide a la lista y se pone en la cabecera cuando llega.
    void listarPartidas().then((lista) => {
      estadoCliente.nombrePartidaActiva = lista.find((x) => x.gameId === sesion.gameId)?.nombre ?? '';
      const el = document.querySelector('.game-id strong');
      if (el) el.textContent = estadoCliente.nombrePartidaActiva || sesion.gameId;
    }).catch(() => undefined);
    void refrescarDatosJuego().catch(() => cerrarSesionYVolverALogin('La sesión previa expiró o el servidor fue reiniciado.'));
  }
}

arrancar();
