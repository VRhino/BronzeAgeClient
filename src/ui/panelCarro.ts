// Panel del CARRO PERSONAL (backend Doc 2.5, `engine/almacenPersonal.ts`): lo que lleva tu columna en el carro (`ejercito.suministro`) y lo que guardas
// en tu almacén personal (`heroe.almacenPersonal`). Los comandos que mueven cosas entre uno y otro ya existen:
//   guardarEnAlmacenPersonal { recurso, cantidad }   del carro al almacén personal (lo que cabe hasta el tope)
//   sacarDelAlmacenPersonal  { recurso, cantidad }   del almacén personal al carro (lo que cabe en el carro)
//   vaciarCarro { heroeId }  dentro de tu residencia, del carro que traes contigo al almacén personal (el motor no lo vacía al entrar)
//   salirDelCampamento { carga } carga el carro desde el almacén; lo que ya traías en el carro sale contigo
//   cargarDePlaza / dejarEnPlaza { asentamientoId, recurso, cantidad }  dentro de una plaza (motor 1dad4ab, Movimiento_Ejercitos §9.1): sacar al carro
//     cualquier ciudadano de la Facción dueña, salvo que su Gobernador lo cierre (`cerrarAlmacenACiudadanos`); dejar, la Facción y sus aliadas o vasallas
// Ambos exigen ser el LÍDER de la columna (el carro es común) y estar en ella. El tope del almacén personal (`heroe.capacidadAlmacenPersonal`) y
// lo que cabe en el carro (`ejercitos[].capacidadCarga`) los manda el backend ya calculados; si falta sitio, el rechazo es suyo.
import type { ProyeccionJugador } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import { ayuda } from './ayuda';
import { CAPACIDAD_CARRO_SALIDA } from './cargaDeSalida';
import { radioDePuerta } from '../apiCliente';
import type { Point } from '../terreno';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: object) => Promise<string | null>;

const nombre = (r: string): string => RECURSO_NOMBRE[r] ?? r;
const icono = (r: string): string => RECURSO_ICONO[r] ?? '📦';

/** Cuánto lleva y cuánto cabe, con una barra: verde, ámbar desde el 80 % y roja llena. Sin capacidad (un backend anterior), solo el título. */
function ocupacion(titulo: string, recursos: Record<string, number>, capacidad: number | undefined): string {
  if (capacidad === undefined || capacidad <= 0) return `<strong class="heroe-sub">${titulo}</strong>`;
  const total = Math.floor(Object.values(recursos).reduce((a, b) => a + b, 0));
  const pct = Math.min(100, Math.round((total / capacidad) * 100));
  const tono = pct >= 100 ? 'llena' : pct >= 80 ? 'casi' : 'ok';
  return `<div class="carro-ocupacion"><strong class="heroe-sub">${titulo}</strong><span>${total} / ${Math.floor(capacidad)} · ${pct} %</span></div>
    <div class="carro-barra carro-barra-${tono}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
}

/** La puerta de tu residencia: tu plaza (fundador o con casa) o el campamento de mercenarios donde resides. */
function puertaDeResidencia(p: ProyeccionJugador): Point | undefined {
  const plaza = p.asentamientos.find((a) => [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId));
  if (plaza) return plaza.posicion;
  return p.campamentosMercenarios.find((c) => c.residentesIds.includes(p.heroeId))?.posicion;
}

/** ¿Se puede tocar el almacén personal? Como el motor (`a_mano.rs`): dentro de tu residencia, o con tu columna a su puerta (`radioPuerta`). */
function almacenAMano(p: ProyeccionJugador, columna: ReturnType<typeof miColumna>): boolean {
  if (!columna) return p.heroe.ubicacion.tipo === 'asentamiento' || p.heroe.ubicacion.tipo === 'mercenarios';
  const puerta = puertaDeResidencia(p);
  return Boolean(puerta && Math.hypot(columna.posicionActual.x - puerta.x, columna.posicionActual.y - puerta.y) <= radioDePuerta());
}

function miColumna(p: ProyeccionJugador) {
  return p.ejercitos.find((c) => c.participantes.some((x) => x.heroeId === p.heroeId));
}

/** Un botón de una fila: qué orden lanza (`accion`), su texto y, si está apagado, por qué. */
interface AccionDeFila { accion: 'guardar' | 'sacar' | 'aPlaza' | 'dePlaza'; etiqueta: string; motivo?: string | null; tope?: number }

/** Las filas de un montón con su cantidad y sus botones; `clave` separa los campos de cantidad de cada montón (un mismo recurso sale en varios). */
function filas(recursos: Record<string, number>, clave: string, acciones: AccionDeFila[], e: Escapar, plazaId = ''): string {
  const lista = Object.entries(recursos).filter(([, n]) => n >= 1);
  if (lista.length === 0) return '<p class="mapa-lista-vacia">Vacío.</p>';
  return lista
    .map(([r, n]) => {
      const util = Math.floor(n);
      const valor = Math.max(1, Math.min(util, ...acciones.map((x) => x.tope ?? util)));
      const botones = acciones.map((x) => `<button class="btn-secondary" type="button" data-carro="${x.accion}" data-clave="${clave}" data-recurso="${e(r)}"${plazaId ? ` data-plaza="${e(plazaId)}"` : ''}${x.motivo ? ` disabled title="${e(x.motivo)}"` : ''}>${x.etiqueta}</button>`).join('');
      return `<div class="carro-fila"><span>${icono(r)} ${e(nombre(r))}</span><strong>${util}</strong>
        ${acciones.length > 0 ? `<input class="form-input" type="number" min="1" max="${util}" value="${valor}" data-carro-cantidad="${clave}:${e(r)}" />${botones}` : ''}</div>`;
    })
    .join('');
}

/** La plaza en la que está el héroe, si está dentro de una: su almacén solo llega si es de tu Facción (ámbito ASENTAMIENTO). */
function plazaDondeEstas(p: ProyeccionJugador): { id: string; nombre: string; faccionId?: string | null; almacen?: Record<string, number>; cerrado: boolean } | undefined {
  const u = p.heroe.ubicacion;
  if (u.tipo !== 'asentamiento') return undefined;
  const a = p.asentamientos.find((x) => x.id === u.asentamientoId);
  const vista = p.asentamientosAvistados.find((x) => x.id === u.asentamientoId);
  return {
    id: u.asentamientoId,
    nombre: a?.nombre ?? vista?.nombre ?? u.asentamientoId,
    faccionId: a?.faccionId ?? vista?.faccionId,
    almacen: a?.almacen ? Object.fromEntries(Object.entries(a.almacen).map(([r, v]) => [r, v.cantidad])) : undefined,
    cerrado: Boolean(a?.almacenCerradoACiudadanos),
  };
}

/** `cabecera`: la línea con el nombre del héroe (fuera cuando el carro va dentro de otro panel, como «Lo que llevas»). */
export function htmlCarro(p: ProyeccionJugador, e: Escapar, cabecera = true): string {
  const columna = miColumna(p);
  const almacen = p.heroe.almacenPersonal ?? {};
  const esLider = columna?.liderId === p.heroeId;
  const aMano = almacenAMano(p, columna);
  // El resto del carro que se queda aparcado en la puerta de un campamento al entrar sin poder guardarlo todo.
  const aparcadas = p.ejercitos.filter((c) => c !== columna && c.liderId === p.heroeId && Object.values(c.suministro ?? {}).some((n) => n >= 1));
  // Dentro de tu residencia el carro sigue contigo (`heroe.carro`): entrar no lo vacía. De visita en una plaza, el carro es el de la columna con la que entraste.
  const carro = columna ? (columna.suministro ?? {}) : (p.heroe.carro ?? {});
  const capacidad = columna ? columna.capacidadCarga : CAPACIDAD_CARRO_SALIDA;
  const libre = capacidad !== undefined ? Math.max(0, Math.floor(capacidad - Object.values(carro).reduce((t, n) => t + n, 0))) : undefined;
  const hayCarro = Object.values(carro).some((n) => n >= 1);
  const plaza = plazaDondeEstas(p);
  const ciudadano = Boolean(plaza?.faccionId) && plaza?.faccionId === p.faccionId;
  const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
  const gobernador = Boolean(plaza && yo?.cargos.includes(`gobernador@${plaza.id}`));
  const motivoLider = columna && !esLider ? 'Solo el Líder de la columna mueve lo del carro.' : null;

  const accionesCarro: AccionDeFila[] = [];
  if (aMano) accionesCarro.push({ accion: 'guardar', etiqueta: 'Al almacén personal', motivo: motivoLider });
  if (plaza) accionesCarro.push({ accion: 'aPlaza', etiqueta: 'A la plaza', motivo: motivoLider });
  const motivoSacar = motivoLider ?? (plaza?.cerrado && !gobernador ? 'El Gobernador ha cerrado el almacén a los ciudadanos.' : libre === 0 ? 'El carro está lleno.' : null);

  const nota = !columna
    ? 'Dentro de tu residencia el carro sigue contigo: entrar no lo vacía. Pásalo a tu almacén personal o al de la plaza recurso a recurso, o todo de una vez con «Todo al almacén personal». Al salir, lo que haya en el carro sale contigo y en la ventana de salida eliges qué más cargas.'
    : !esLider
      ? 'Solo el Líder de la columna mueve lo del carro: el carro es común a todos los que van en ella.'
      : plaza
        ? 'Dentro de una plaza de tu Facción sacas de su almacén al carro (salvo que su Gobernador lo cierre) y le dejas lo que lleves; en una aliada o vasalla solo puedes dejar.'
        : 'Guarda en tu almacén personal lo que quieras conservar. Al entrar en tu campamento se guarda solo. El carro es solo carga: la columna come de tus víveres (barra de abajo del mapa), y de aquí se les pasa trigo.';
  const almacenPlaza = plaza && ciudadano && plaza.almacen
    ? `${ocupacion(`Almacén de ${e(plaza.nombre)}`, {}, undefined)}
      ${plaza.cerrado ? `<p class="asent-lado-nota">${gobernador ? 'Lo tienes cerrado: los ciudadanos no sacan al carro (dejar sigue abierto).' : 'El Gobernador lo ha cerrado: no se saca al carro, pero se puede dejar.'}</p>` : ''}
      ${filas(plaza.almacen, 'plaza', [{ accion: 'dePlaza', etiqueta: 'Al carro', motivo: motivoSacar, tope: libre }], e, plaza.id)}`
    : plaza && !ciudadano ? '<p class="asent-lado-nota">El almacén de esta plaza solo lo usan sus ciudadanos; si es de una Facción aliada o vasalla puedes dejarle lo del carro.</p>' : '';
  const cierre = plaza && gobernador
    ? `<label class="asent-toggle"><input type="checkbox" data-almacen-cerrar="${e(plaza.id)}"${plaza.cerrado ? ' checked' : ''} /> Cerrar el almacén a los ciudadanos (no sacan al carro)</label>` : '';
  return `
    ${cabecera ? `<div class="mapa-panel-jugador">${e(p.heroe.displayName)} · carro y almacén</div>` : ''}
    <strong class="heroe-sub">Carga${ayuda('jugador:carro', e(nota))}</strong>
    ${ocupacion(columna ? 'Carro de tu columna' : 'Tu carro', carro, capacidad)}${filas(carro, 'carro', hayCarro ? accionesCarro : [], e, plaza?.id)}
    ${!columna && hayCarro && aMano ? '<button class="btn-secondary" type="button" data-vaciar-carro>Todo al almacén personal</button>' : ''}
    ${aparcadas.map((c) => `<strong class="heroe-sub">Resto del carro, aparcado en la puerta</strong>${filas(c.suministro ?? {}, 'aparcado', [], e)}`).join('')}
    ${almacenPlaza}${cierre}
    ${aMano
      ? `${ocupacion('Almacén personal', almacen, p.heroe.capacidadAlmacenPersonal)}${filas(almacen, 'personal', [{ accion: 'sacar', etiqueta: 'Al carro', motivo: motivoLider, tope: libre }], e)}`
      : '<p class="asent-lado-nota">El almacén personal está en tu residencia: se usa dentro o con tu columna a su puerta.</p>'}
    <p class="faction-error" data-campo="error-carro" role="alert"></p>`;
}

export function cablearCarro(raiz: HTMLElement, ejecutar: Ejecutar, heroeId?: string): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-carro"]');
  raiz.querySelector<HTMLButtonElement>('[data-vaciar-carro]')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget as HTMLButtonElement;
    boton.disabled = true;
    const mensaje = await ejecutar('vaciarCarro', { heroeId });
    boton.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  });
  const ORDEN: Record<string, string> = { guardar: 'guardarEnAlmacenPersonal', sacar: 'sacarDelAlmacenPersonal', aPlaza: 'dejarEnPlaza', dePlaza: 'cargarDePlaza' };
  raiz.querySelectorAll<HTMLButtonElement>('[data-carro]').forEach((boton) =>
    boton.addEventListener('click', async () => {
      const { carro: accion, clave, recurso, plaza } = boton.dataset;
      const cantidad = Number(raiz.querySelector<HTMLInputElement>(`input[data-carro-cantidad="${clave}:${recurso}"]`)?.value ?? 0);
      if (!(cantidad >= 1)) { if (error) error.textContent = 'Pon una cantidad de 1 o más.'; return; }
      boton.disabled = true;
      const mensaje = await ejecutar(ORDEN[accion!]!, { ...(plaza && (accion === 'aPlaza' || accion === 'dePlaza') ? { asentamientoId: plaza } : {}), recurso, cantidad });
      boton.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    })
  );
  raiz.querySelectorAll<HTMLInputElement>('[data-almacen-cerrar]').forEach((c) => c.addEventListener('change', async () => {
    const mensaje = await ejecutar('cerrarAlmacenACiudadanos', { asentamientoId: c.dataset.almacenCerrar!, cerrado: c.checked });
    if (mensaje !== null) { c.checked = !c.checked; if (error) error.textContent = mensaje; }
  }));
}
