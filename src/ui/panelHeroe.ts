// Panel del HÉROE (docs/Features_Pendientes.md §0.2): ficha y atributos, escuadras con su guarnición, y loadouts.
// Lo abren el riel del Mapa y la barra del Asentamiento. Todo lo que enseña llega calculado en `proyeccion.heroe`
// (coste de Liderazgo de cada escuadra, lo que suma cada loadout, cupo y ocupación de la guarnición): aquí no se
// decide ninguna regla, solo se suma el loadout que se está editando para avisar antes de guardar. Quien valida
// es el backend (`heroe.invalido`).
import { asignarGuarnicion, borrarLoadout, guardarLoadout, repartirPuntos, retirarGuarnicion, type ProyeccionJugador, type RespuestaComando } from '../apiCliente';
import type { AtributoHeroe, HeroeProyectado, Loadout } from '../tiposDominio';
import { estadoCliente } from './estadoCliente';

/** Manda el comando, comprueba `resultado.ok` y refresca; devuelve el mensaje de error o `null`. Lo pone `main.ts`. */
export type Aplicar = (peticion: Promise<RespuestaComando>) => Promise<string | null>;
type Escapar = (valor: string) => string;
type Pestana = 'ficha' | 'escuadras' | 'loadouts';

const PESTANAS: [Pestana, string][] = [['ficha', 'Ficha'], ['escuadras', 'Escuadras'], ['loadouts', 'Loadouts']];
const ATRIBUTOS: [AtributoHeroe, string][] = [['fuerza', 'Fuerza'], ['destreza', 'Destreza'], ['armadura', 'Armadura'], ['vitalidad', 'Vitalidad']];
const DONDE = { campamento: 'Campamento', ejercito: 'En columna', escolta: 'Escoltando' } as const;

let pestana: Pestana = 'ficha';
/** El loadout que se está editando (`loadoutId` ausente = uno nuevo), o `null`. Mientras exista, el sondeo de 3 s no
 * repinta el panel: se llevaría por delante lo escrito. */
let borrador: { loadoutId?: string; displayName: string; squadIds: Set<string>; activo: boolean } | null = null;
/** Lo último pintado en cada panel. Si el refresco no cambia nada, no se toca el DOM (ni el foco ni los inputs). */
const pintado = new WeakMap<HTMLElement, string>();

/** ¿Está el héroe dentro de su residencia? Solo ahí defiende su loadout activo (Doc 5.12.4). */
function dentroDeSuResidencia(proyeccion: ProyeccionJugador): boolean {
  const aqui = proyeccion.asentamientos[0];
  return Boolean(aqui && [...(aqui.heroesFundadoresIds ?? []), ...(aqui.casasCompradas ?? [])].includes(proyeccion.heroeId));
}

function dondeEsta(heroe: HeroeProyectado, proyeccion: ProyeccionJugador): string {
  const u = heroe.ubicacion;
  if (u.tipo === 'columna') return 'en su columna';
  if (u.tipo === 'desconectado') return 'desconectado';
  const plaza = [...proyeccion.asentamientos, ...proyeccion.asentamientosAvistados].find((a) => a.id === u.asentamientoId);
  return `en ${plaza?.nombre ?? u.asentamientoId}`;
}

function renderFicha(h: HeroeProyectado, proyeccion: ProyeccionJugador, e: Escapar): string {
  const puntos = h.puntosDeAtributoSinGastar;
  const m = h.monedasHeroe;
  return `
    <p class="heroe-nota">${e(h.classDefinitionId)} · ${e(dondeEsta(h, proyeccion))}</p>
    <div class="faction-stats heroe-datos">
      <div><span>Nivel</span><strong>${h.nivel}</strong></div>
      <div><span>Experiencia</span><strong>${h.experienciaHaciaSiguienteNivel}</strong></div>
      <div><span>Liderazgo</span><strong>${h.liderazgoBase}</strong></div>
      <div class="heroe-ancho"><span>Monedas</span><strong>${m.bronce} bronce · ${m.plata} plata · ${m.oro} oro</strong></div>
    </div>
    <strong class="heroe-sub">Atributos · ${puntos} ${puntos === 1 ? 'punto' : 'puntos'} sin gastar</strong>
    <div class="heroe-atributos">
      ${ATRIBUTOS.map(([id, nombre]) => `<label><span>${nombre}</span><strong>${h.atributosBase[id]}</strong>${puntos > 0 ? `<input type="number" min="0" max="${puntos}" value="0" data-atributo="${id}" />` : ''}</label>`).join('')}
    </div>
    ${puntos > 0 ? '<button type="button" class="btn-secondary" data-accion="repartir">Repartir puntos</button>' : ''}`;
}

function renderEscuadras(h: HeroeProyectado, proyeccion: ProyeccionJugador, e: Escapar): string {
  const libre = h.cupoGuarnicion - h.guarnicionOcupada;
  const activo = h.loadouts.find((l) => l.activo);
  const dentro = dentroDeSuResidencia(proyeccion);
  const cabecera = `<p class="heroe-nota">Guarnición: <strong>${h.guarnicionOcupada} / ${h.cupoGuarnicion}</strong> de Liderazgo.${h.cupoGuarnicion === 0 ? ' Tu residencia no da cupo: hace falta un Barracón o una Galería de tiro.' : ''} Del campamento solo defienden la guarnición y, mientras estás dentro, tu loadout activo.</p>`;
  if (h.escuadrones.length === 0) return `${cabecera}<p class="mapa-lista-vacia">No tienes escuadras: se reclutan en el asentamiento donde resides.</p>`;
  return `${cabecera}<div class="mapa-lista">${h.escuadrones
    .map((s) => {
      const enCampamento = s.contenedor.tipo === 'campamento';
      const defiende = enCampamento && (s.enGuarnicion || (dentro && Boolean(activo?.squadIds.includes(s.id))));
      const boton = !enCampamento
        ? ''
        : s.enGuarnicion
          ? `<button type="button" class="btn-secondary" data-accion="retirar" data-squad="${e(s.id)}">Retirar</button>`
          : `<button type="button" class="btn-secondary" data-accion="asignar" data-squad="${e(s.id)}"${s.costeLiderazgo > libre ? ' disabled title="No cabe en el cupo de guarnición"' : ''}>A la guarnición</button>`;
      return `<div class="mapa-lista-item heroe-fila">
        <div><strong>${e(s.nombre)}</strong>
          <span>${s.cantidad} hombres · nivel ${s.nivel} · moral ${Math.round(s.moral)} · ${s.costeLiderazgo} de Liderazgo</span>
          <span>${DONDE[s.contenedor.tipo]}${s.enGuarnicion ? ' · en guarnición' : ''}${defiende ? ' · <em class="heroe-marca">defiende</em>' : ''}</span></div>
        ${boton}
      </div>`;
    })
    .join('')}</div>`;
}

function sumaDelBorrador(h: HeroeProyectado): number {
  return h.escuadrones.filter((s) => borrador?.squadIds.has(s.id)).reduce((total, s) => total + s.costeLiderazgo, 0);
}

function renderEditor(h: HeroeProyectado, e: Escapar): string {
  const b = borrador!;
  return `
    <strong class="heroe-sub">${b.loadoutId ? 'Editar loadout' : 'Nuevo loadout'}</strong>
    <input class="asent-cargo-sel" type="text" data-campo="nombre" value="${e(b.displayName)}" placeholder="Nombre" autocomplete="off" />
    <div class="mapa-lista">${
      h.escuadrones
        .map((s) => `<label class="mapa-lista-item heroe-fila"><div><strong>${e(s.nombre)}</strong><span>${s.cantidad} hombres · ${s.costeLiderazgo} de Liderazgo · ${DONDE[s.contenedor.tipo]}</span></div><input type="checkbox" data-squad="${e(s.id)}"${b.squadIds.has(s.id) ? ' checked' : ''} /></label>`)
        .join('') || '<p class="mapa-lista-vacia">No tienes escuadras: el loadout irá vacío.</p>'
    }</div>
    <label class="heroe-check"><input type="checkbox" data-campo="activo"${b.activo ? ' checked' : ''} /> Activo (defiende tu residencia)</label>
    <p class="heroe-nota" data-campo="suma"></p>
    <div class="heroe-acciones"><button type="button" class="btn-secondary" data-accion="guardar">Guardar</button><button type="button" class="btn-secondary" data-accion="cancelar">Cancelar</button></div>`;
}

function renderLoadouts(h: HeroeProyectado, e: Escapar): string {
  if (borrador) return renderEditor(h, e);
  return `
    <div class="mapa-lista">${h.loadouts
      .map((l) => `<div class="mapa-lista-item heroe-fila">
        <div><strong>${e(l.displayName)}${l.activo ? ' <em class="heroe-marca">activo</em>' : ''}</strong><span>${l.squadIds.length} escuadras · ${l.liderazgoTotal} / ${h.liderazgoBase} de Liderazgo</span></div>
        <div class="heroe-acciones">
          ${l.activo ? '' : `<button type="button" class="btn-secondary" data-accion="activar" data-loadout="${e(l.id)}">Activar</button>`}
          <button type="button" class="btn-secondary" data-accion="editar" data-loadout="${e(l.id)}">Editar</button>
          <button type="button" class="btn-secondary" data-accion="borrar" data-loadout="${e(l.id)}">Borrar</button>
        </div>
      </div>`)
      .join('')}</div>
    <button type="button" class="btn-secondary" data-accion="nuevo">Nuevo loadout</button>
    <p class="heroe-nota">El loadout activo es el que defiende tu residencia mientras estás dentro. Los perks llegarán con el catálogo de Conquest.</p>`;
}

/** Pinta el panel del héroe en `panel`. Sin `forzar`, respeta el borrador abierto y no toca el DOM si nada cambió. */
export function pintarPanelHeroe(panel: HTMLElement, proyeccion: ProyeccionJugador, e: Escapar, aplicar: Aplicar, forzar = false): void {
  if (borrador && !forzar) return;
  const h = proyeccion.heroe;
  const cuerpo = pestana === 'ficha' ? renderFicha(h, proyeccion, e) : pestana === 'escuadras' ? renderEscuadras(h, proyeccion, e) : renderLoadouts(h, e);
  const html = `<div class="heroe-panel">
    <div class="mapa-panel-jugador">${e(h.displayName)}</div>
    <div class="asent-tabs">${PESTANAS.map(([id, nombre]) => `<button class="asent-tab${id === pestana ? ' activo' : ''}" type="button" data-pestana="${id}">${nombre}</button>`).join('')}</div>
    ${cuerpo}
    <p class="faction-error" data-campo="error" role="alert"></p>
  </div>`;
  if (!forzar && pintado.get(panel) === html && panel.querySelector('.heroe-panel')) return;
  panel.innerHTML = html;
  pintado.set(panel, html);
  cablear(panel, h, e, aplicar);
}

function cablear(panel: HTMLElement, h: HeroeProyectado, e: Escapar, aplicar: Aplicar): void {
  const gameId = estadoCliente.gameIdActivo;
  const repintar = (): void => {
    if (estadoCliente.proyeccionUltima) pintarPanelHeroe(panel, estadoCliente.proyeccionUltima, e, aplicar, true);
  };
  const mostrarError = (mensaje: string | null): void => {
    const error = panel.querySelector<HTMLElement>('[data-campo="error"]');
    if (error) error.textContent = mensaje ?? '';
  };
  /** Manda, y si va bien suelta el borrador y repinta con la proyección nueva. */
  const accion = async (boton: HTMLButtonElement, peticion: () => Promise<RespuestaComando>): Promise<void> => {
    boton.disabled = true;
    const mensaje = await aplicar(peticion());
    if (mensaje) { boton.disabled = false; mostrarError(mensaje); return; }
    borrador = null;
    repintar();
  };
  const loadout = (id: string | undefined): Loadout | undefined => h.loadouts.find((l) => l.id === id);

  panel.querySelectorAll<HTMLButtonElement>('[data-pestana]').forEach((boton) => boton.addEventListener('click', () => {
    pestana = boton.dataset.pestana as Pestana;
    borrador = null;
    repintar();
  }));

  panel.querySelectorAll<HTMLButtonElement>('[data-accion]').forEach((boton) => boton.addEventListener('click', () => {
    const squadId = boton.dataset.squad ?? '';
    const elegido = loadout(boton.dataset.loadout);
    switch (boton.dataset.accion) {
      case 'repartir': {
        const atributos = Object.fromEntries(
          Array.from(panel.querySelectorAll<HTMLInputElement>('[data-atributo]')).map((i) => [i.dataset.atributo, Number(i.value)] as const).filter(([, n]) => n > 0)
        );
        if (Object.keys(atributos).length === 0) { mostrarError('Pon al menos un punto en algún atributo.'); return; }
        void accion(boton, () => repartirPuntos(gameId, { atributos }));
        return;
      }
      case 'asignar': void accion(boton, () => asignarGuarnicion(gameId, squadId)); return;
      case 'retirar': void accion(boton, () => retirarGuarnicion(gameId, squadId)); return;
      case 'activar':
        if (elegido) void accion(boton, () => guardarLoadout(gameId, { loadoutId: elegido.id, displayName: elegido.displayName, squadIds: elegido.squadIds, perksSeleccionados: elegido.perksSeleccionados, activo: true }));
        return;
      case 'borrar':
        if (elegido && confirm(`¿Borrar el loadout «${elegido.displayName}»?`)) void accion(boton, () => borrarLoadout(gameId, elegido.id));
        return;
      case 'nuevo': borrador = { displayName: '', squadIds: new Set(), activo: false }; repintar(); return;
      case 'editar':
        if (elegido) { borrador = { loadoutId: elegido.id, displayName: elegido.displayName, squadIds: new Set(elegido.squadIds), activo: elegido.activo }; repintar(); }
        return;
      case 'cancelar': borrador = null; repintar(); return;
      case 'guardar': {
        const b = borrador;
        if (!b) return;
        const previo = loadout(b.loadoutId);
        void accion(boton, () => guardarLoadout(gameId, {
          ...(b.loadoutId ? { loadoutId: b.loadoutId } : {}),
          displayName: b.displayName.trim(),
          squadIds: [...b.squadIds],
          perksSeleccionados: previo?.perksSeleccionados ?? [],
          activo: b.activo,
        }));
      }
    }
  }));

  if (!borrador) return;
  // Editor abierto: lo escrito vive en `borrador`, y la suma de Liderazgo se recalcula sin repintar.
  const actualizarSuma = (): void => {
    const suma = sumaDelBorrador(h);
    const excede = suma > h.liderazgoBase;
    const texto = panel.querySelector<HTMLElement>('[data-campo="suma"]');
    if (texto) texto.innerHTML = `Liderazgo <strong>${suma} / ${h.liderazgoBase}</strong>${excede ? ' — no cabe' : ''}`;
    const guardar = panel.querySelector<HTMLButtonElement>('[data-accion="guardar"]');
    if (guardar) guardar.disabled = excede || !borrador?.displayName.trim();
  };
  panel.querySelector<HTMLInputElement>('[data-campo="nombre"]')?.addEventListener('input', (evento) => {
    if (borrador) borrador.displayName = (evento.target as HTMLInputElement).value;
    actualizarSuma();
  });
  panel.querySelector<HTMLInputElement>('[data-campo="activo"]')?.addEventListener('change', (evento) => {
    if (borrador) borrador.activo = (evento.target as HTMLInputElement).checked;
  });
  panel.querySelectorAll<HTMLInputElement>('input[data-squad]').forEach((casilla) => casilla.addEventListener('change', () => {
    const id = casilla.dataset.squad ?? '';
    if (casilla.checked) borrador?.squadIds.add(id);
    else borrador?.squadIds.delete(id);
    actualizarSuma();
  }));
  actualizarSuma();
}
