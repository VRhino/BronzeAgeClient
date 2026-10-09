import {
  ApiError,
  cargarSesionLocal,
  cerrarSesion,
  consultarProyeccion,
  ejecutarComando,
  guardarSesionLocal,
  recordarPartida,
  abrirPresencia,
  alEventoTiempoReal,
  cerrarPresencia,
  fijarCanalesTiempoReal,
  loginConClave,
  capacidadDeViveres,
  costoDeRefundacion,
  nivelesBandidos,
  registrarCuenta,
  obtenerMapa,
  unirseAPartida,
  type ProyeccionJugador,
  type RespuestaComando,
} from './apiCliente';
import { cablearSalidaDePlazaAjena, htmlSalidaDePlazaAjena } from './ui/salidaDePlazaAjena';
import { elegirPestanaHeroe, minutosHerido, pintarPanelHeroe } from './ui/panelHeroe';
import { htmlBarraJugador, type PanelJugador } from './ui/barraJugador';
import { edificioBajoCursor, pintarAsentamiento, pintarMiradas, pintarPrevisualizacionFundacion, pintarTerreno, RADIO_PROTECCION_MERCENARIOS } from './render';
import { EDIFICIO_COLOR, EDIFICIO_NOMBRE, RECURSO_ICONO, RECURSO_NOMBRE } from './paletas';
import type { Alijo, Asentamiento, BloqueoAscenso, CampamentoBandido, CampamentoMercenarios, CampamentoParaElegir, Edificio, EvaluacionAscenso, ParamsCrearHeroe, ProduccionItem, Sigilo } from './tiposDominio';
import { svgSigilo } from './sigilo/sigilo';
import { actualizarSalida, cablearCampamento, campamentoActual, htmlSeccionCampamento, seccionesDeCampamento, type SeccionCampamento } from './ui/pantallaCampamento';
import { leyendaPlanoCampamento, svgPlanoCampamento } from './ui/planoCampamento';
import type { MapaGenerado } from './terreno';
import { estadoCliente, medirRitmoDeMundo, TIPS_FUNDACION } from './ui/estadoCliente';
import { actualizarTip, resumenRecursosFundacion } from './ui/pestanaAsentamientos';
import { renderPanelInteraccion } from './ui/panelInteraccion';
import { renderPanelMapa } from './ui/panelMapa';
import { renderPestanaFaccion } from './ui/pestanaFaccion';
import { cablearAnexion } from './ui/panelAnexion';
import { cablearFusion } from './ui/panelFusion';
import { cablearAdmision } from './ui/panelAdmision';
import { cablearFichaBatalla, cablearFichaFormacion, formacionesVisibles, htmlFichaBatalla, htmlFichaFormacion } from './ui/panelBatalla';
import { cablearPanelEjercito, ejercitosDeLaFaccion, htmlFichaEjercito, htmlPanelEjercito, peticionesNuevas } from './ui/ejercitos';
import { invalidar, olvidarEdicion, pintar, vaciar } from './ui/repintado';
import { cablearVistaCiudad, edificioSeleccionado, htmlTooltipEdificio, repintarFicha, tipoSeleccionado } from './ui/vistaCiudad';
import { FICHAS_MAPA_EXTRA, SELECTORES_MAPA_EXTRA, SUBPESTANAS_CENTRO_EXTRA, SUBPESTANAS_MERCADO_EXTRA, type ContextoPlaza } from './ui/ganchos';
import { montarPartidas } from './ui/pantallaPartidas';
import { cablearCaravanas, cablearOrdenes, htmlCaravanas, htmlOrdenes } from './ui/panelMercado';
import { cablearReclutamiento, htmlReclutamiento } from './ui/reclutamiento';
import { actualizarConvocatorias, cablearSalidaComoEjercito, htmlSalidaComoEjercito } from './ui/salidaComoEjercito';
import { cablearPreparacion, htmlPreparacion, peticionesNuevasConv } from './ui/convocatoria';
import { cablearUnirseDesdePlaza, htmlUnirseDesdePlaza } from './ui/unirseDesdePlaza';
import { cablearCargos } from './ui/panelCargos';
import { cablearDiplomacia } from './ui/panelDiplomacia';
import { instalarZoomPan, type ControlMapa } from './ui/pantallaMapa';
import { guardarVistaMapa, leerVistaMapa } from './ui/vistaMapaGuardada';
import { alCambiarAvisos, alLlegarInforme, avisarDeEventos, avisosNoLeidos, historialDeAvisos, marcarAvisosLeidos, mostrar as mostrarAviso, reiniciarAvisos } from './ui/avisos';
import { htmlInforme, type InformeDeCombate } from './ui/informeCombate';
import { htmlAvisos } from './ui/panelAvisos';
import { cablearCarro, htmlCarro } from './ui/panelCarro';
import { cablearTecnologia, htmlTecnologia } from './ui/panelTecnologia';
import { cablearEscolta, htmlEscolta } from './ui/panelEscolta';
import { chipLiderazgo } from './ui/liderazgo';
import { cablearCargaDeSalida, htmlCargaDeSalida, leerCarga } from './ui/cargaDeSalida';
import { cablearColumna, htmlColumna } from './ui/panelColumna';
import { cablearPanelIntel, renderPanelIntel } from './ui/panelIntel';
import { svgPlanoBandidos } from './ui/planoBandidos';
import { explicarError } from './ui/erroresServidor';
import { motivosParaCrearFaccion } from './ui/validarFaccion';
import { nombreDeHeroe } from './ui/nombres';
import { htmlEstados } from './ui/estados';

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
      const termino = busqueda.value.trim().toLowerCase();
      const facciones = proyeccion.facciones.filter((faccion) => faccion.nombre.toLowerCase().includes(termino));
      lista.innerHTML = facciones.length > 0 ? facciones.map((faccion) => `<div class="faction-list-item"><div><strong>${escaparHtml(faccion.nombre)}</strong><span>Nivel ${faccion.nivel}${faccion.reyId ? ` · Rey: ${escaparHtml(nombreDeHeroe(proyeccion, faccion.reyId))}` : ''}</span></div>${(faccion.solicitudesIds ?? []).includes(proyeccion.heroeId) ? '<span>Pedido: decide su Rey</span>' : `<button class="btn-join-faction" type="button" data-faccion-id="${escaparHtml(faccion.id)}">Pedir ingreso</button>`}</div>`).join('') : '<p class="faction-empty-list">No hay facciones que coincidan.</p>';
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
    <div class="login-header"><h1 class="login-title">Tu héroe</h1><p class="login-subtitle">Nace dentro de un campamento de mercenarios.</p></div>
    <form id="form-crear-heroe">
      <div class="form-group"><label class="form-label" for="input-nombre-heroe">Nombre</label><input type="text" id="input-nombre-heroe" class="form-input" required autocomplete="off" /></div>
      <div class="form-group"><span class="form-label">Campamento</span><div class="mapa-lista">${opciones || '<p class="mapa-lista-vacia">Esta partida no tiene campamentos.</p>'}</div></div>
      <button type="submit" id="btn-crear-heroe" class="btn-primary">Crear héroe</button>
      <p id="error-heroe" class="faction-error" role="alert"></p>
    </form>
  </div><button id="btn-partidas" class="text-link" type="button">Cambiar de partida</button> <button id="btn-logout" class="text-link" type="button">Cerrar sesión</button></div>`;
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
    ${htmlBarraJugador(proyeccion, true, escaparHtml)}
    <header class="asent-barra">
      <span class="asent-nombre">Campamento ${escaparHtml(campamento.id)}</span>
      <span class="asent-nivel" id="camp-residencia"></span>
      <div class="asent-barra-acciones"><button id="btn-salir-mundo" class="btn-primary" type="button">Salir al mundo</button></div>
    </header>
    <div class="asent-cuerpo">
      <div class="asent-mapa"><div class="asent-lienzo camp-lienzo"></div><div class="camp-leyenda-caja"></div></div>
      <aside class="asent-lado"><div class="camp-lado"></div></aside>
    </div>
    <aside class="jugador-panel" hidden></aside>
    ${menuEsquinaHtml()}
  </div>`;
  const contenedor = app.querySelector<HTMLElement>('.asent-screen')!;
  cablearMenuEsquina(contenedor);
  cablearBarraJugador(contenedor);
  contenedor.querySelector('#btn-salir-mundo')?.addEventListener('click', () => { seccionCamp = 'salir'; const lado = contenedor.querySelector<HTMLElement>('.camp-lado'); if (lado) invalidar(lado); refrescarPantalla('campamento'); });
  // Sin tiempo real de datos, el campamento (mercado, fondo, avisos) se pone al día con el mismo sondeo suave que el asentamiento.
  let sondeando = false;
  const sondeo = setInterval(() => {
    if (sondeando || !document.querySelector('.camp-screen')) return;
    sondeando = true;
    void refrescarDatosJuego().catch(() => {}).finally(() => { sondeando = false; });
  }, 3000);
  limpiarPantalla = () => clearInterval(sondeo);
}

/** Vuelca la proyección en la pantalla Campamento (en cada refresco). No toca el DOM de lo que no cambió, para no llevarse lo que se escribe. */
function pintarCampamento(p: ProyeccionJugador, campamento: CampamentoMercenarios): void {
  const lienzo = app.querySelector<HTMLElement>('.camp-lienzo');
  const leyenda = app.querySelector<HTMLElement>('.camp-leyenda-caja');
  const lado = app.querySelector<HTMLElement>('.camp-lado');
  if (!lienzo || !lado) return;
  const escena = p.escenaCampamento?.campamentoId === campamento.id ? p.escenaCampamento : undefined;
  const plano = escena ? svgPlanoCampamento(escena) : '';
  if (lienzo.dataset.pintado !== plano) { lienzo.innerHTML = plano; lienzo.dataset.pintado = plano; if (leyenda) leyenda.innerHTML = escena ? leyendaPlanoCampamento(escena) : ''; }
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
  actualizarSalida(lado, p, ejecutarYRefrescar);
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

/** El campamento de bandidos más cercano al punto clicado, dentro de un radio de agarre, o `null`. Los que viajan
 * son solo los que se ven ahora (no tienen memoria). */
function campamentoCercaDe(punto: { x: number; y: number }, proyeccion: ProyeccionJugador): CampamentoBandido | null {
  const distancia = (c: CampamentoBandido): number => Math.hypot(c.posicion.x - punto.x, c.posicion.y - punto.y);
  return proyeccion.campamentosBandidos.filter((c) => distancia(c) < 25).sort((a, b) => distancia(a) - distancia(b))[0] ?? null;
}

/** El elemento de `lista` más cercano al punto clicado, dentro de un radio de agarre, o `null`. */
function cercano<T extends { posicion: { x: number; y: number } }>(lista: readonly T[], punto: { x: number; y: number }, radio: number): T | null {
  const distancia = (c: T): number => Math.hypot(c.posicion.x - punto.x, c.posicion.y - punto.y);
  return lista.filter((c) => distancia(c) < radio).sort((a, b) => distancia(a) - distancia(b))[0] ?? null;
}

/** A qué distancia se ataca: `LOGISTICA.radioEncuentro` del backend (Doc 5.12.3), copiado aquí para avisar antes de
 * mandar la orden. El que decide es el backend. */
const RADIO_ATAQUE = 15;

/** Punto de MUNDO bajo un clic: `getBoundingClientRect` del canvas ya incluye el `transform` del zoom/pan. */
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

async function marcharAObjetivo(objetivo: { tipo: 'punto'; punto: { x: number; y: number } } | { tipo: 'asentamiento'; id: string }): Promise<void> {
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
  const ataque = propio ? null : alcanceDeAtaque(proyeccion, asentamiento.posicion);
  const miCol = miColumna(proyeccion);
  const entraEjercito = miCol !== undefined && (miCol.tipo === 'ejercito' || miCol.participantes.length > 1);
  const soyLider = miCol?.liderId === proyeccion.heroeId;
  // Solo un ejército abre un asedio (backend Doc 5.15.1b): una columna personal puede unirse a uno abierto desde su batalla en el mapa.
  if (ataque && !ataque.impide && miColumna(proyeccion)?.tipo === 'personal') ataque.impide = 'Solo un ejército abre un asedio: tu columna personal puede unirse a uno ya abierto.';
  cont.hidden = false;
  if (!pintar(cont, `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">${propio ? 'Tu asentamiento' : 'Asentamiento'}${asentamiento.recordado !== null ? ' · recordado' : ''}</span>
    <h3>${escaparHtml(asentamiento.nombre ?? asentamiento.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Facción</span><strong>${escaparHtml(faccion?.nombre ?? asentamiento.faccionId)}</strong></div>
      <div><span>Nivel</span><strong>${asentamiento.nivel}</strong></div>
      ${asentamiento.recordado !== null ? `<div><span>Visto</span><strong>${escaparHtml(fechaDeMundo(asentamiento.recordado))}</strong></div>` : ''}
      ${ataque?.distancia != null ? `<div><span>Distancia</span><strong>${ataque.distancia}</strong></div>` : ''}
    </div>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-entrar-asent" class="btn-primary" type="button"${entraEjercito && (!propio || !soyLider) ? ' disabled' : ''}>${entraEjercito ? 'Entrar con el ejército' : 'Entrar'}</button>
      ${ataque ? `<button id="btn-atacar-asent" class="btn-primary" type="button"${ataque.impide ? ' disabled' : ''}>Atacar</button>` : ''}
    </div>
    ${entraEjercito ? `<p class="mapa-lista-vacia">${!propio ? 'Un ejército solo entra entero en una plaza de su Facción.' : soyLider ? 'Tu ejército entra entero y se desarma: los que residen aquí entran como siempre; los demás, de visita. Si lleva caravanas adjuntas, tienen que ser de esta plaza.' : 'Solo el Líder hace entrar al ejército.'}</p>` : ''}
    ${ataque ? `<p class="mapa-lista-vacia">${escaparHtml(ataque.impide || 'Atacar es asediarla: si cae pasa a tu Facción; si aguanta, quedas herido.')}</p>` : ''}
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
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
function alcanceDeAtaque(proyeccion: ProyeccionJugador, punto: { x: number; y: number }): { distancia: number | null; impide: string } {
  const columna = miColumna(proyeccion);
  const distancia = columna ? Math.round(Math.hypot(columna.posicionActual.x - punto.x, columna.posicionActual.y - punto.y)) : null;
  const herido = minutosHerido(proyeccion);
  // Yendo solo, sin soldados vivos en la columna no hay con qué atacar (en un ejército pueden ponerlos los demás).
  const sinSoldados = columna !== undefined && columna.participantes.length === 1
    && !proyeccion.heroe.escuadrones.some((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === columna.id && s.cantidad > 0);
  const cerca = (a: { x: number; y: number }) => proyeccion.campamentosMercenarios.find((c) => Math.hypot(c.posicion.x - a.x, c.posicion.y - a.y) <= RADIO_PROTECCION_MERCENARIOS);
  const protegido = columna ? cerca(columna.posicionActual) ?? cerca(punto) : undefined;
  const impide =
    herido !== null ? `Estás herido (${herido} min): no puedes atacar.`
      : distancia === null ? 'Sal al mundo con tu columna para atacar.'
        : distancia > RADIO_ATAQUE ? `Acércate: estás a ${distancia} y se ataca a ${RADIO_ATAQUE}.`
          : sinSoldados ? 'Tu columna no lleva soldados vivos: sal del campamento con tropa para atacar.'
            : protegido ? `Estás a menos de ${RADIO_PROTECCION_MERCENARIOS} del campamento de mercenarios ${protegido.id}: a su lado nadie inicia un combate.`
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
    <span class="faction-kicker">Campamento de bandidos</span>
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
    <p class="mapa-lista-vacia">Plano esquemático: el servidor no publica el trazado de los campamentos de bandidos. El botín decrece si se destruyen muchos en un día.</p>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-atacar-campamento" class="btn-primary" type="button"${impide ? ' disabled' : ''}>Atacar</button>
    </div>
    <p class="mapa-lista-vacia">${escaparHtml(impide || 'Si cae, ganas su oro de botín (a salvo: no va en el carro). Si aguanta, quedas herido y pierdes la mitad del carro.')}</p>
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
    avisoMapa(sigue ? 'El campamento aguanta: quedas herido y pierdes la mitad del carro.' : 'Campamento destruido: su oro se suma a tu oro de botín.');
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
    <span class="faction-kicker">Campamento de mercenarios${tuyo ? ' · tu residencia' : ''}</span>
    <h3>${escaparHtml(campamento.id)}</h3>
    <div class="mapa-seleccion-datos">
      <div><span>Residentes</span><strong>${campamento.residentesIds.length}</strong></div>
      ${distancia !== null ? `<div><span>Distancia</span><strong>${distancia}</strong></div>` : ''}
    </div>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-entrar-mercenarios" class="btn-primary" type="button"${entraEjercito && !soyLider ? ' disabled' : ''}>${entraEjercito ? 'Entrar con el ejército' : 'Entrar'}</button>
    </div>
    <p class="mapa-lista-vacia">${entraEjercito ? (soyLider ? 'Tu ejército entra entero y se desarma en la puerta: los que residen aquí entran con su tropa y su carro; los demás, de visita, con su columna aparcada. Si lleva caravanas adjuntas, tienen que ser de este lugar.' : 'Solo el Líder hace entrar al ejército.') : 'Se entra con la columna a la puerta.'} Junto al campamento nadie inicia un combate.</p>
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'punto', punto: campamento.posicion }));
  cablearAccionSeleccion(cont, '#btn-entrar-mercenarios', 'entrarEnCampamento', { campamentoId: campamento.id, heroeId: proyeccion.heroeId }, () => { seleccionMapa = null; });
}

/** Ficha de un alijo de exploración (Doc 1.9b): se abre estando en el sitio, y su oro va al oro de botín. */
function renderSeleccionAlijo(cont: HTMLElement, alijo: Alijo): void {
  if (!pintar(cont, `
    <button class="mapa-seleccion-cerrar" type="button" aria-label="Cerrar selección">×</button>
    <span class="faction-kicker">Alijo</span>
    <h3>${alijo.oro} de oro</h3>
    <div class="mapa-seleccion-acciones">
      <button id="btn-marchar-alli" class="btn-secondary" type="button">Marchar aquí</button>
      <button id="btn-abrir-alijo" class="btn-primary" type="button">Abrir</button>
    </div>
    <p class="mapa-lista-vacia">Hay que estar en el sitio. El oro va a tu oro de botín.</p>
    <p id="mapa-seleccion-error" class="faction-error" role="alert"></p>`, undefined, claveSeleccion())) return;
  cont.querySelector('.mapa-seleccion-cerrar')?.addEventListener('click', () => { seleccionMapa = null; renderSeleccionMapa(); });
  cont.querySelector('#btn-marchar-alli')?.addEventListener('click', () => void marcharAObjetivo({ tipo: 'punto', punto: alijo.posicion }));
  cablearAccionSeleccion(cont, '#btn-abrir-alijo', 'abrirAlijo', { alijoId: alijo.id }, () => { seleccionMapa = null; avisoMapa(`Alijo abierto: ${alijo.oro} de oro de botín.`); });
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
let controlMapaActivo: ControlMapa | null = null;

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
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'No se pudo fundar aquí.');
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
/** ¿Está abierto el mapa «desde dentro» (botón Mapa de la barra) sobre el campamento o el asentamiento? */
let vistaMapaAbierta = false;
let controlVistaMapa: ControlMapa | null = null;

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
  if (panelJugador === null) { panel.hidden = true; vaciar(panel); return; }
  panel.hidden = false;
  if (forzar) invalidar(panel);
  if (panelJugador === 'carro' || panelJugador === 'avisos') {
    const html = panelJugador === 'carro' ? htmlCarro(proyeccion, escaparHtml) : htmlAvisos(historialDeAvisos(), escaparHtml);
    const esCarro = panelJugador === 'carro';
    // En marcha el carro y la ración cambian con cada tick: se repinta solo si cambió, devolviendo lo que se estaba escribiendo.
    pintar(panel, html, () => {
      if (esCarro) cablearCarro(panel, ejecutarYRefrescar);
      else {
        panel.querySelectorAll<HTMLButtonElement>('[data-aviso]').forEach((b) => b.addEventListener('click', () => {
          const informe = historialDeAvisos()[Number(b.dataset.aviso)]?.informe;
          if (informe) mostrarInforme(informe);
        }));
        marcarAvisosLeidos();
      }
    }, panelJugador);
    return;
  }
  if (panelJugador === 'faccion') {
    // Creando una Facción o buscando a cuál pedir ingreso, el formulario es del jugador: solo se repinta al cambiar de modo (`forzar`).
    if (!forzar && proyeccion.faccionId === null && panel.querySelector('#form-crear-faccion, #input-buscar-faccion')) return;
    const html = `<div class="mapa-panel-jugador">${escaparHtml(proyeccion.heroe.displayName)}</div>${renderPestanaFaccion(proyeccion, escaparHtml)}`;
    pintar(panel, html, () => cablearFaccion(panel, proyeccion, () => renderPanelJugador(true)), 'faccion');
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
  const badge = barra.querySelector<HTMLElement>('.jugador-badge');
  if (badge) {
    const n = avisosNoLeidos();
    badge.hidden = n === 0;
    badge.textContent = String(n);
    badge.classList.toggle('peligro', historialDeAvisos().slice(0, n).some((a) => a.clase === 'peligro'));
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

/** Abre o cierra el mapa del mundo sobre la pantalla de dentro. Es el mismo mapa que el de fuera, con la visión de ahora, pero solo para mirar:
 * un clic no manda marchar a nadie. */
function alternarVistaMapa(abrir: boolean = !vistaMapaAbierta): void {
  const pantalla = document.querySelector<HTMLElement>('.asent-screen');
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!pantalla || !proyeccion) return;
  vistaMapaAbierta = abrir;
  controlVistaMapa?.destruir();
  controlVistaMapa = null;
  pantalla.querySelector('.mapa-interior')?.remove();
  if (abrir) {
    pantalla.insertAdjacentHTML('beforeend', `<div class="mapa-screen mapa-interior">
      <div class="mapa-lienzo"><canvas id="mapa-interior" width="900" height="900"></canvas></div>
      <div class="mapa-zoom"><button type="button" data-zoom="in" aria-label="Acercar">+</button><button type="button" data-zoom="out" aria-label="Alejar">−</button></div>
      <button class="btn-secondary mapa-interior-cerrar" type="button">Volver</button>
    </div>`);
    const interior = pantalla.querySelector<HTMLElement>('.mapa-interior')!;
    const control = instalarZoomPan(interior, interior.querySelector<HTMLElement>('.mapa-lienzo')!, { zoomInicial: 1.6 });
    controlVistaMapa = control;
    interior.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => control.zoomHacia(b.dataset.zoom === 'in' ? 1 : -1)));
    interior.querySelector('.mapa-interior-cerrar')?.addEventListener('click', () => alternarVistaMapa(false));
    void pintarVistaMapa(true);
  }
  renderPanelJugador();
}

/** Pinta el terreno y lo que se ve en el mapa de la vista interior; `centrar` la lleva al héroe (solo al abrirla). */
async function pintarVistaMapa(centrar = false): Promise<void> {
  const p = estadoCliente.proyeccionUltima;
  const canvas = document.querySelector<HTMLCanvasElement>('#mapa-interior');
  const ctx = canvas?.getContext('2d');
  if (!p || !canvas || !ctx) return;
  const mapa = await sincronizarMapa(p.mapaId);
  if (document.querySelector('#mapa-interior') !== canvas) return; // se cerró mientras llegaba el mapa
  const escala = canvas.width / mapa.config.ancho;
  pintarTerreno(ctx, mapa, p, escala);
  pintarMiradas(ctx, p.miradasIntel ?? [], p.instante, escala);
  const donde = posicionDelHeroe(p);
  if (centrar && donde) controlVistaMapa?.centrar(donde, mapa.config.ancho, mapa.config.alto);
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
    pintar(panel, htmlPanelEjercito(proyeccion, escaparHtml), () => cablearPanelEjercito(panel, proyeccion, ejecutarYRefrescar, avisoMapa, (punto) => {
      const mapa = estadoCliente.mapaCache?.mapa;
      if (mapa && controlMapaActivo) controlMapaActivo.centrar(punto, mapa.config.ancho, mapa.config.alto);
    }), 'ejercito');
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
      boton.addEventListener('click', () => {
        const mapa = estadoCliente.mapaCache?.mapa;
        if (mapa && controlMapaActivo) controlMapaActivo.centrar({ x: Number(boton.dataset.centrarX), y: Number(boton.dataset.centrarY) }, mapa.config.ancho, mapa.config.alto);
      });
    }), 'cosas');
  } else {
    // fundar: solo con una Caravana de Fundación enganchada, y donde se está (Doc 1.3, 1.8)
    const caravana = caravanaDeFundacion(proyeccion);
    const enganchada = Boolean(caravana && columna?.caravanasAdjuntasIds?.includes(caravana.id));
    const htmlFundar = `
      <span class="faction-kicker">Fundar asentamiento</span>
      ${!caravana
        ? '<p>Se funda con una Caravana de Fundación. Una Facción sin plaza la compra en un campamento de mercenarios con el fondo de sus héroes; con plaza, se lanza desde Centro urbano › Fundación. Quien la compra o la lanza la lleva.</p>'
        : enganchada
          ? `<p>Se funda donde está ahora tu columna (no en agua ni a menos de 100 de un campamento). Estos son los recursos a tu alcance:</p>
            <div id="mapa-fundar-recursos">${resumenRecursosFundacion(escaparHtml)}</div>
            <button id="btn-fundar-aqui" class="btn-primary" type="button">Fundar aquí</button>`
          : `<p>Tu Caravana de Fundación espera en ${caravana.origenCampamentoId ? 'su campamento' : 'su plaza'}. Lleva tu columna a la puerta y engánchala.</p>
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

/** Pantalla MAPA: el mundo a pantalla completa como fondo, con zoom (rueda y botones) y arrastre acotados
 * (T3), y movimiento por clic + panel de Selección (T4). El terreno lo pinta `dibujarPantallaSegunModo`
 * sobre el mismo canvas `#mapa` de siempre; el zoom es solo `transform` CSS encima. */
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
  const capacidad = capacidadDeViveres(() => { invalidar(caja); pintarComida(p); });
  const viveres = Math.floor(p.heroe.viveres ?? 0);
  const hueco = Math.max(0, capacidad - viveres);
  const enElCarro = Math.floor(columna.suministro?.['trigo'] ?? 0);
  const maximo = Math.min(enElCarro, hueco);
  const esLider = columna.liderId === p.heroeId;
  const motivo = !esLider ? 'Solo el Líder de la columna pasa trigo del carro a los víveres.' : enElCarro < 1 ? 'El carro no lleva trigo.' : hueco < 1 ? 'Tus víveres están llenos.' : '';
  if (motivo) selectorViveres.abierto = false;
  selectorViveres.cantidad = Math.max(1, Math.min(selectorViveres.cantidad, maximo || 1));
  const fraccion = capacidad > 0 ? Math.min(1, viveres / capacidad) : 0;
  const html = `<span>🌾 Víveres</span><div class="mapa-comida-barra"><i style="width:${(fraccion * 100).toFixed(1)}%"></i></div><strong>${viveres} / ${capacidad}</strong>
    <button type="button" class="btn-secondary" data-viveres="abrir"${motivo ? ' disabled' : ''} title="${escaparHtml(motivo || 'Pasa trigo del carro a tus víveres: lo que cabe.')}">＋ desde el carro</button>
    ${selectorViveres.abierto ? `<div class="mapa-comida-selector"><span>Trigo del carro: ${enElCarro} · cabe ${hueco}</span><input type="range" min="1" max="${maximo}" value="${selectorViveres.cantidad}" data-viveres="barra" /><input type="number" class="form-input" min="1" max="${maximo}" value="${selectorViveres.cantidad}" data-viveres="cantidad" /><button type="button" class="btn-primary" data-viveres="confirmar">Pasar a víveres</button><p class="faction-error" data-campo="error-viveres" role="alert"></p></div>` : ''}`;
  caja.hidden = false;
  caja.classList.toggle('poca', fraccion < 0.25);
  caja.title = 'Víveres: el trigo que come tu columna: en marcha, media ración; acampada, una décima parte de eso. Sin víveres, la moral cae y la tropa deserta. Siempre van contigo.';
  const valor = (): number => Math.max(1, Math.min(maximo, Math.floor(Number(caja.querySelector<HTMLInputElement>('input[data-viveres="cantidad"]')?.value ?? 1)) || 1));
  pintar(caja, html, () => {
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
    <div class="mapa-lienzo"><canvas id="mapa" width="900" height="900"></canvas></div>
    ${htmlBarraJugador(proyeccion, false, escaparHtml)}
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
  const columna = miColumna(proyeccion);
  const alClicar = (evento: PointerEvent): void => {
    const proy = estadoCliente.proyeccionUltima;
    const mapa = estadoCliente.mapaCache?.mapa;
    const canvas = document.querySelector<HTMLCanvasElement>('#mapa');
    if (!proy || !mapa || !canvas) return;
    const punto = puntoDeMapa(evento, canvas, mapa);
    for (const selector of SELECTORES_MAPA_EXTRA) {
      const bajo = selector(proy, punto);
      if (!bajo) continue;
      seleccionMapa = { tipo: bajo.tipo, id: bajo.id };
      renderSeleccionMapa();
      if (bajo.ir) void marcharAObjetivo(bajo.ir);
      return;
    }
    const batalla = cercano((proy.batallas ?? []).map((b) => ({ ...b, posicion: b.punto })), punto, 20);
    const formacion = batalla ? null : cercano(formacionesVisibles(proy).map((e) => ({ ...e, posicion: e.posicionActual })), punto, 20);
    if (batalla || formacion) {
      seleccionMapa = batalla ? { tipo: 'batalla', id: batalla.battleId } : { tipo: 'formacion', id: formacion!.id };
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'punto', punto: batalla ? batalla.punto : formacion!.posicionActual });
      return;
    }
    const delEjercito = cercano(ejercitosDeLaFaccion(proy).filter((x) => !x.formacion).map((x) => ({ ...x, posicion: x.posicionActual })), punto, 20);
    if (delEjercito) {
      seleccionMapa = { tipo: 'ejercito', id: delEjercito.id };
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'punto', punto: delEjercito.posicionActual });
      return;
    }
    const alijo = cercano(proy.alijos ?? [], punto, 15);
    const mercenarios = alijo ? null : cercano(proy.campamentosMercenarios ?? [], punto, 30);
    const campamento = alijo || mercenarios ? null : campamentoCercaDe(punto, proy);
    const asentamiento = alijo || mercenarios || campamento ? null : asentamientoCercaDe(punto, proy);
    if (alijo || mercenarios) {
      seleccionMapa = alijo ? { tipo: 'alijo', id: alijo.id } : { tipo: 'mercenarios', id: mercenarios!.id };
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'punto', punto: (alijo ?? mercenarios)!.posicion });
    } else if (campamento) {
      seleccionMapa = { tipo: 'campamento', id: campamento.id };
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'punto', punto: campamento.posicion });
    } else if (asentamiento) {
      seleccionMapa = { tipo: 'asentamiento', id: asentamiento.id };
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'asentamiento', id: asentamiento.id });
    } else {
      seleccionMapa = null;
      renderSeleccionMapa();
      void marcharAObjetivo({ tipo: 'punto', punto });
    }
  };
  const control = instalarZoomPan(contenedor, lienzo, { zoomInicial: vista?.zoom ?? (columna ? 1.6 : 1), panInicial: vista ? { x: vista.panX, y: vista.panY } : undefined, alClicar });
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
  const guardarVista = (): void => guardarVistaMapa(gameId, { ...control.estado(), panel: panelMapaAbierto === 'fundar' ? null : panelMapaAbierto, seleccion: seleccionMapa });
  addEventListener('pagehide', guardarVista); // recarga o cierre de pestaña
  limpiarPantalla = () => {
    guardarVista(); // salir del mapa (plaza, campamento, otra partida, cerrar sesión)
    removeEventListener('pagehide', guardarVista);
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
  cablearBarraJugador(contenedor);

  renderPanelRiel();
  if (seleccionMapa) renderSeleccionMapa();
  void dibujarPantallaSegunModo(proyeccion).then(() => {
    const mapa = estadoCliente.mapaCache?.mapa;
    // Con vista guardada manda ella; la primera vez, centrado en tu columna.
    if (!vista && columna && mapa) control.centrar(columna.posicionActual, mapa.config.ancho, mapa.config.alto);
  });
}

// --- PANTALLA ASENTAMIENTO (T6) -----------------------------------------------------------------

type PanelAsent = 'salir' | 'ejercito';
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
  if (!confirm(aviso)) return;
  const mensaje = await ejecutarYRefrescar('cambiarResidencia', { destinoId: a.id, heroeId: p.heroeId });
  if (error) error.textContent = mensaje ?? '';
}

/** Salir al mundo desde tu residencia (Doc 1.10.2) con la tropa y la carga elegidas en el panel «Salir al mundo». */
async function salirAlMundo(escuadronIds: string[], carga: Record<string, number>): Promise<void> {
  const proyeccion = estadoCliente.proyeccionUltima;
  const asentamiento = proyeccion?.asentamientos[0];
  if (!proyeccion || !asentamiento) return;
  try {
    const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'salirAlMundo', { asentamientoId: asentamiento.id, heroeId: proyeccion.heroeId, escuadronIds, carga });
    if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'No se pudo salir al mundo.');
    panelAsentAbierto = null;
    await refrescarDatosJuego(); // el router lleva a la pantalla Mapa
  } catch (err) {
    const error = document.querySelector<HTMLElement>('.asent-panel [data-campo="error-salida"]') ?? document.querySelector<HTMLElement>('#asent-error');
    if (error) error.textContent = err instanceof ApiError ? mensajeError(err) : (err as Error).message;
  }
}

/** Panel «Salir al mundo» de la plaza: tropa que sacas y carga del almacén de la plaza (el backend reserva el trigo que necesita la tropa que se queda). */
function pintarSalidaAsentamiento(panel: HTMLElement, p: ProyeccionJugador, asentamiento: Asentamiento): void {
  // Fuera de tu residencia no hay nada que equipar: se retoma la columna aparcada (`salirDeAsentamiento`).
  if (!resideEnLaPlaza(p, asentamiento)) {
    pintar(panel, htmlSalidaDePlazaAjena(p, asentamiento, escaparHtml), () => cablearSalidaDePlazaAjena(panel, p, asentamiento, ejecutarYRefrescar), 'salir-ajena');
    return;
  }
  const repintarSalida = (): void => { const q = estadoCliente.proyeccionUltima; if (q) pintarSalidaAsentamiento(panel, q, asentamiento); };
  // En un ejército en preparación solo se ve ese panel (cambia cuando llegan integrantes, peticiones o cambios de tropa).
  const preparacion = htmlPreparacion(p, escaparHtml);
  if (preparacion) {
    pintar(panel, preparacion, () => cablearPreparacion(panel, p, ejecutarYRefrescar, avisoMapa, repintarSalida), 'preparacion');
    return;
  }
  const leerSeleccion = () => ({ escuadronIds: Array.from(panel.querySelectorAll<HTMLInputElement>('input[data-salir-escuadra]:checked')).map((i) => i.dataset.salirEscuadra!), carga: leerCarga(panel) });
  const tropa = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);
  const almacen = Object.fromEntries(Object.entries(asentamiento.almacen ?? {}).map(([r, v]) => [r, v.cantidad]));
  const html = `<span class="faction-kicker">Salir al mundo</span>
    <strong class="heroe-sub">Tropa que sacas</strong>
    <div class="mapa-lista">${tropa.length > 0
      ? tropa.map((s) => `<label class="mapa-lista-item"><div><strong>${escaparHtml(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div><input type="checkbox" data-salir-escuadra="${escaparHtml(s.id)}" checked /></label>`).join('')
      : '<p class="asent-lado-nota">No tienes tropa libre en la plaza (la de guarnición no sale). Puedes salir solo.</p>'}</div>
    ${htmlSalidaComoEjercito(p, escaparHtml)}
    ${htmlCargaDeSalida(almacen, 'el almacén de la plaza', escaparHtml)}
    <button class="btn-primary" type="button" data-salir>Salir</button>
    <p class="faction-error" data-campo="error-salida" role="alert"></p>`;
  // El almacén de la plaza cambia con el sondeo: se repinta solo si cambió y lo marcado (tropa, carga, modo) vuelve a su sitio.
  pintar(panel, html, () => {
    cablearCargaDeSalida(panel);
    const boton = panel.querySelector<HTMLButtonElement>('[data-salir]');
    boton?.addEventListener('click', () => void salirAlMundo(leerSeleccion().escuadronIds, leerSeleccion().carga));
    cablearSalidaComoEjercito(panel, p, boton, 'Salir', leerSeleccion, ejecutarYRefrescar, avisoMapa);
  }, 'salir');
  actualizarConvocatorias(panel, p, leerSeleccion, ejecutarYRefrescar, avisoMapa, escaparHtml);
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
type SeccionMercado = string; // 'ordenes' | 'caravanas' | 'escolta' o el id de una subpestaña de `SUBPESTANAS_MERCADO_EXTRA`
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
  const abierta = (id: EdificioAsent): boolean => { const t = PESTANAS_EDIFICIO.find((x) => x.id === id)!; return !t.requiere || construido(t.requiere.tipo); };
  if (!abierta(edificioAsent)) edificioAsent = 'centro';

  const tabs = PESTANAS_EDIFICIO.map((t) => abierta(t.id)
    ? `<button class="asent-tab${t.id === edificioAsent ? ' activo' : ''}" type="button" data-edificio="${t.id}">${t.etiqueta}</button>`
    : `<button class="asent-tab bloqueada" type="button" disabled title="Necesitas construir ${t.requiere!.nombre}">${t.etiqueta} 🔒</button>`).join('');
  const faltan = PESTANAS_EDIFICIO.filter((t) => !abierta(t.id)).map((t) => `<p class="asent-lado-nota">🔒 ${t.etiqueta}: necesitas construir ${t.requiere!.nombre}.</p>`).join('');
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

  if (edificioAsent === 'centro') {
    const SECCIONES: [SeccionAsent, string][] = [['resumen', 'Resumen'], ['edificios', 'Edificios'], ['produccion', 'Producción'], ['cola', 'Cola'], ['cargos', 'Cargos'], ...SUBPESTANAS_CENTRO_EXTRA.map((s) => [s.id, s.etiqueta] as [string, string])];
    const extra = SUBPESTANAS_CENTRO_EXTRA.find((s) => s.id === seccionAsent);
    const puedeMudarme = Boolean(proyeccion.faccionId) && asentamiento.faccionId === proyeccion.faccionId && !resideEnLaPlaza(proyeccion, asentamiento);
    const formNombre = resideEnLaPlaza(proyeccion, asentamiento)
      ? `<div class="asent-renombrar"><span class="faction-kicker">Nombre de la ciudad</span><div class="mercado-acciones"><input class="form-input" type="text" maxlength="40" data-campo="nombre-plaza" value="${escaparHtml(asentamiento.nombre ?? '')}" placeholder="${escaparHtml(asentamiento.id)}" /><button id="btn-renombrar" class="btn-secondary" type="button">Cambiar nombre</button></div><p class="asent-lado-nota">Vacío = vuelve a mostrarse el identificador.</p></div>`
      : '';
    const contenido = extra ? extra.html(ctxPlaza) : seccionAsent === 'resumen'
      ? seccionResumen(asentamiento) + formNombre + seccionAscenso(asentamiento, proyeccion.ascensoDeAsentamiento, cargo === 'gobernador')
        + (puedeMudarme ? '<button id="btn-mudarme" class="btn-secondary" type="button" title="Hacer de esta plaza tu base: tu campamento se muda contigo">Hacer de esta plaza mi base</button>' : '')
      : seccionAsent === 'edificios' ? seccionEdificios(asentamiento, cargo)
        : seccionAsent === 'produccion' ? seccionProduccion(proyeccion.produccionDeAsentamiento)
          : seccionAsent === 'cola' ? seccionCola(edificios, cargo)
            : renderCargosAsentamiento(asentamiento, proyeccion) || '<p class="mapa-lista-vacia">No tienes cargos que asignar en esta plaza: el Rey nombra al Gobernador y el Gobernador, al resto.</p>';
    html = `${subpestanas(SECCIONES, seccionAsent)}<div class="asent-lado-cuerpo">${contenido}</div>
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
      extra?.cablear?.(ctxPlaza);
    };
  } else if (edificioAsent === 'reclutamiento') {
    html = `<div class="asent-lado-cuerpo">${htmlReclutamiento(proyeccion, asentamiento, escaparHtml, renderPanelEdificios)}</div>${pie}`;
    cablear = () => cablearReclutamiento(cuerpo, proyeccion, asentamiento, ejecutarYRefrescar);
  } else if (edificioAsent === 'taberna') {
    html = `${renderPanelIntel(proyeccion, escaparHtml)}${pie}`;
    cablear = () => cablearPanelIntel(cuerpo, proyeccion, ejecutarYRefrescar, () => { olvidarEdicion(cuerpo); invalidar(cuerpo); renderPanelEdificios(); });
  } else {
    const SECCIONES: [SeccionMercado, string][] = [['ordenes', 'Órdenes'], ['caravanas', 'Caravanas'], ['escolta', 'Escolta'], ...SUBPESTANAS_MERCADO_EXTRA.map((s) => [s.id, s.etiqueta] as [string, string])];
    const extraMercado = SUBPESTANAS_MERCADO_EXTRA.find((s) => s.id === seccionMercado);
    const contenido = extraMercado ? extraMercado.html(ctxPlaza) : seccionMercado === 'escolta' ? htmlEscolta(proyeccion, asentamiento, escaparHtml)
      : seccionMercado === 'caravanas' ? htmlCaravanas(proyeccion, asentamiento, escaparHtml)
        : htmlOrdenes(proyeccion, asentamiento, escaparHtml);
    html = `${subpestanas(SECCIONES, seccionMercado)}<div class="asent-lado-cuerpo">${contenido}</div>${pie}`;
    ambito = `mercado:${seccionMercado}`;
    cablear = () => {
      cablearSub((s) => { seccionMercado = s as SeccionMercado; });
      if (extraMercado) extraMercado.cablear?.(ctxPlaza);
      else if (seccionMercado === 'escolta') cablearEscolta(cuerpo, proyeccion, ejecutarYRefrescar);
      else if (seccionMercado === 'caravanas') cablearCaravanas(cuerpo, proyeccion, asentamiento, ejecutarYRefrescar);
      else cablearOrdenes(cuerpo, asentamiento, ejecutarYRefrescar);
    };
  }
  // Solo se repinta si cambió (la ciudad produce a cada tick), y lo elegido en los formularios vuelve a su sitio.
  pintar(cuerpo, html, cablear, ambito);
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
  const cabecera = '<div class="asent-lado-cabecera"><span class="faction-kicker">Subida de nivel</span></div>';
  if (a.ascenso) {
    return `${cabecera}<p class="asent-lado-nota">Obra en curso hacia el nivel ${a.ascenso.nivelObjetivo} · ${cuentaAtras(a.ascenso.completaEn)}. Si conquistan la plaza, se pierde.</p>`;
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
      return `<div class="asent-edif-item${tipoSeleccionado() === tipo ? ' sel' : ''}" data-fila-tipo="${escaparHtml(tipo)}" style="--swatch:${EDIFICIO_COLOR[tipo] ?? '#888'}">
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

/** Solo lectura: producción por minuto de mundo de cada edificio, tal como la calcula el servidor
 * (`ProyeccionJugador.produccionDeAsentamiento` — este cliente no tiene motor para calcularla). */
function seccionProduccion(items: ProduccionItem[] | undefined): string {
  const fmt = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1));
  const filas = (items ?? [])
    .filter((it) => it.cantidadPorMinuto > 0)
    .sort((a, b) => b.cantidadPorMinuto - a.cantidadPorMinuto)
    .map(
      (it) => `<div class="asent-edif-item" style="--swatch:${EDIFICIO_COLOR[it.tipo] ?? '#888'}">
        <span class="asent-edif-nombre">${escaparHtml(EDIFICIO_NOMBRE[it.tipo] ?? it.tipo)}</span>
        <span class="asent-edif-meta">${it.activos > 1 ? `×${it.activos}` : ''}</span>
        <span class="asent-edif-nota">${RECURSO_ICONO[it.recurso] ?? '📦'} ${escaparHtml(RECURSO_NOMBRE[it.recurso] ?? it.recurso)} · ${fmt(it.cantidadPorMinuto)}/min</span>
      </div>`
    )
    .join('');
  return `
    <div class="asent-lado-cabecera"><span class="faction-kicker">Producción</span></div>
    <div class="asent-edif-lista">${filas || '<p class="mapa-lista-vacia">Sin edificios productores activos.</p>'}</div>
    <p class="asent-lado-nota">Por minuto de mundo, con la mano de obra y los yacimientos actuales.</p>`;
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
      <span class="asent-edif-nombre">${escaparHtml(EDIFICIO_NOMBRE[e.tipo] ?? e.tipo)}</span>
      <span class="asent-edif-nota">mejora a N${e.mejora!.nivelObjetivo} · ${cuentaAtras(e.mejora!.completaEn)}</span>
    </div>`)
    .join('');
  if (cola.length === 0 && !mejoras) return '<p class="mapa-lista-vacia">Sin obras en curso ni en cola.</p>';
  return `<div class="asent-cola-lista">${mejoras}${cola
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
  cont.querySelector('#btn-solicitar-ascenso')?.addEventListener('click', () => void ejecutarAccionAsent('solicitarAscenso', { asentamientoId: a.id }));
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

/** Pinta el panel flotante de la barra (Ejércitos / Salir al mundo) según `panelAsentAbierto`. */
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
  if (panelAsentAbierto === 'salir') {
    const asentamiento = proyeccion.asentamientos[0];
    if (asentamiento) pintarSalidaAsentamiento(panel, proyeccion, asentamiento);
    return;
  }
}

/** Sección "Cargos" del panel de Facción, acotada al asentamiento que se pisa. Solo aparecen los cargos que
 * el jugador PUEDE asignar aquí: Gobernador si eres el REY de la Facción; los otros cuatro si eres el
 * Gobernador (Doc 2.2, `asignarCargoLocal` en el backend, 2026-09-10). */
function renderCargosAsentamiento(asentamiento: Asentamiento | undefined, proyeccion: ProyeccionJugador): string {
  if (!asentamiento) return '';
  const faccion = proyeccion.facciones.find((f) => f.id === proyeccion.faccionId);
  const soyGobernador = asentamiento.cargos?.gobernadorId === proyeccion.heroeId;
  const soyRey = faccion?.reyId === proyeccion.heroeId;
  if (!soyGobernador && !soyRey) return '';

  const ciudadanos = faccion?.ciudadanosIds ?? [];
  const cargos = (
    [
      ['gobernadorId', 'Gobernador', soyRey],
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
            ${ciudadanos.map((id) => `<option value="${escaparHtml(id)}"${id === actual ? ' selected' : ''}>${escaparHtml(nombreDeHeroe(proyeccion, id))}</option>`).join('')}
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
      const heroeId = select?.value;
      if (!cargo || !heroeId) return;
      try {
        const respuesta = await ejecutarComando(estadoCliente.gameIdActivo, 'asignarCargoLocal', { asentamientoId: asentamiento.id, cargo, heroeId });
        if (!respuesta.resultado.ok) throw errorDeRechazo(respuesta.resultado, 'No se pudo asignar el cargo.');
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
    ${htmlBarraJugador(proyeccion, true, escaparHtml)}
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
      <div class="asent-mapa">
        <div class="asent-lienzo"><canvas id="mapa" width="900" height="900"></canvas></div>
        <aside class="asent-panel" hidden></aside>
        <div class="asent-recursos" hidden></div>
      </div>
      <aside class="asent-lado"><div class="asent-edificios"><div class="asent-edif-tabs"></div><div class="asent-edif-cuerpo"></div></div></aside>
    </div>
    <div class="asent-tooltip" hidden></div>
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
  contenedor.querySelector('#btn-salir-mundo')?.addEventListener('click', () => {
    panelAsentAbierto = panelAsentAbierto === 'salir' ? null : 'salir';
    menuEsquinaAbierto = false;
    sincronizarMenuEsquina();
    renderPanelAsent();
  });
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
  app.innerHTML = `<div class="login-container"><div class="login-card"><div class="login-header"><h1 class="login-title">Bronze Age Collapse</h1><p class="login-subtitle">Cliente de Jugador — Inicio de Sesión</p></div>${errorMensaje ? `<div class="error-banner">⚠️ ${escaparHtml(errorMensaje)}</div>` : ''}<form id="form-login"><div class="form-group"><label class="form-label" for="input-usuario">Nick</label><input type="text" id="input-usuario" class="form-input" value="${escaparHtml(estadoCliente.usuarioActivo)}" required autocomplete="username" /></div><div class="form-group"><label class="form-label" for="input-clave">Contraseña</label><input type="password" id="input-clave" class="form-input" required minlength="6" autocomplete="current-password" /></div><label class="form-check"><input type="checkbox" id="chk-registro" /> No tengo cuenta — crear una</label><div class="form-group" id="grupo-codigo" hidden><label class="form-label" for="input-codigo">Código de invitación</label><input type="text" id="input-codigo" class="form-input" autocomplete="off" /></div><button type="submit" id="btn-login-submit" class="btn-primary">Entrar</button></form></div></div>`;
  const chkRegistro = document.querySelector<HTMLInputElement>('#chk-registro');
  chkRegistro?.addEventListener('change', () => {
    const grupoCodigo = document.querySelector<HTMLDivElement>('#grupo-codigo');
    if (grupoCodigo) grupoCodigo.hidden = !chkRegistro.checked;
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
    pintarMiradas(ctx, proyeccion.miradasIntel ?? [], proyeccion.instante, canvas.width / mapa.config.ancho);
  } else {
    if (titulo) titulo.textContent = 'Vista de Asentamiento (Geometría Urbana T2a)';
    const asentamiento = proyeccion.asentamientos[0];
    if (asentamiento) pintarAsentamiento(ctx, asentamiento, proyeccion.trazadoPorAsentamiento?.[asentamiento.id], edificioSeleccionado());
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

async function refrescarDatosJuego(): Promise<void> {
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
type Pantalla = 'login' | 'partidas' | 'cargando' | 'heroe' | 'campamento' | 'mapa' | 'asentamiento' | 'legacy';

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
  if (proyeccion.heroe.ubicacion.tipo === 'mercenarios') return 'campamento';
  if (proyeccion.asentamientos.length > 0) return 'asentamiento';
  return 'mapa';
}

function montar(pantalla: Pantalla): void {
  limpiarPantalla?.();
  limpiarPantalla = null;
  panelJugador = null;
  vistaMapaAbierta = false;
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
  }
}

/** Rellena los trozos dinámicos de la pantalla ya montada (el DOM se monta una vez, guard de
 * `pantallaMontada`; aquí se le vuelca la proyección en cada refresco): Mapa vuelve a pintar el canvas,
 * legacy repinta panel + canvas + JSON como hacía antes. */
function refrescarPantalla(pantalla: Pantalla): void {
  const proyeccion = estadoCliente.proyeccionUltima;
  if (!proyeccion) return;
  if (pantalla === 'mapa' || pantalla === 'campamento' || pantalla === 'asentamiento') {
    renderPanelJugador();
    if (vistaMapaAbierta) void pintarVistaMapa();
  }
  if (pantalla === 'mapa') { pintarComida(proyeccion); void dibujarPantallaSegunModo(proyeccion); renderSeleccionMapa(); renderPanelRiel(); return; }
  if (pantalla === 'campamento') { const c = campamentoActual(proyeccion); if (c) pintarCampamento(proyeccion, c); return; }
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

function arrancar(): void {
  window.addEventListener('hashchange', enrutar);
  alEventoTiempoReal(alEventoDelServidor);
  alLlegarInforme(mostrarInforme);
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
    void refrescarDatosJuego().catch(() => cerrarSesionYVolverALogin('La sesión previa expiró o el servidor fue reiniciado.'));
  }
}

arrancar();
