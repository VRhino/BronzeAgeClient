// Piezas del HÉROE (docs/Features_Pendientes.md §0.2): la ficha con sus atributos y los loadouts. Desde la 0.161.0 viven en la Base personal
// (`basePersonal.ts`), que las pinta en sus pestañas «Héroe» y «Loadouts». Todo lo que enseñan llega calculado en `proyeccion.heroe`
// (coste de Liderazgo de cada escuadra, lo que suma cada loadout, cupo y ocupación de la guarnición): aquí no se
// decide ninguna regla, solo se suma el loadout que se está editando para avisar antes de guardar. Quien valida
// es el backend (`heroe.invalido`).
import { borrarLoadout, ejecutarComando, guardarLoadout, repartirPuntos, type ProyeccionJugador, type RespuestaComando } from '../apiCliente';
import type { AtributoHeroe, HeroeProyectado, Loadout } from '../tiposDominio';
import { ayuda } from './ayuda';
import { estadoCliente } from './estadoCliente';
import { confirmar } from './dialogo';
import { iconoEnFila } from './iconosTropa';
import { cablearHeroeMercenario, htmlHeroeMercenario } from './mercenarios';

/** Manda el comando, comprueba `resultado.ok` y refresca; devuelve el mensaje de error o `null`. Lo pone `main.ts`. */
export type Aplicar = (peticion: Promise<RespuestaComando>) => Promise<string | null>;
type Escapar = (valor: string) => string;
const ATRIBUTOS: [AtributoHeroe, string][] = [['fuerza', 'Fuerza'], ['destreza', 'Destreza'], ['armadura', 'Armadura'], ['vitalidad', 'Vitalidad']];
export const DONDE = { campamento: 'Campamento', ejercito: 'En columna', escolta: 'Escoltando', pueblo: 'Guarneciendo un pueblo', plaza: 'En la guarnición de otra plaza', avanzada: 'Guarneciendo una avanzada', fuera: 'Fuera del mundo' } as const;

/** El loadout que se está editando (`loadoutId` ausente = uno nuevo), o `null`. Mientras exista, el sondeo de 3 s no
 * repinta la ventana: se llevaría por delante lo escrito. */
let borrador: { loadoutId?: string; displayName: string; squadIds: Set<string>; activo: boolean } | null = null;

/** ¿Hay un loadout a medio editar? La Base no se repinta sola mientras tanto. */
export const editandoLoadout = (): boolean => borrador !== null;
/** Suelta el loadout a medio editar (al cambiar de pestaña o cerrar la Base). */
export function soltarBorrador(): void { borrador = null; }

/** Minutos que le quedan de Herido a tu héroe (Doc 5.16.4), o `null` si está sano. */
export function minutosHerido(proyeccion: ProyeccionJugador): number | null {
  const hasta = proyeccion.heroe.heridoHasta;
  return hasta !== undefined && hasta > proyeccion.instante ? Math.ceil((hasta - proyeccion.instante) / 60_000) : null;
}

/** ¿Está el héroe dentro de su residencia? Solo ahí defiende su loadout activo (Doc 5.12.4). */
export function dentroDeSuResidencia(proyeccion: ProyeccionJugador): boolean {
  const aqui = proyeccion.asentamientos[0];
  return Boolean(aqui && [...(aqui.heroesFundadoresIds ?? []), ...(aqui.casasCompradas ?? [])].includes(proyeccion.heroeId));
}

export function dondeEsta(heroe: HeroeProyectado, proyeccion: ProyeccionJugador): string {
  const u = heroe.ubicacion;
  if (u.tipo === 'columna') return 'en su columna';
  if (u.tipo === 'desconectado') return 'desconectado';
  if (u.tipo === 'mercenarios') return `en el campamento ${u.campamentoId}`;
  if (u.tipo === 'pueblo') return 'dentro de un pueblo';
  if (u.tipo === 'avanzada') return 'dentro de una avanzada';
  const plaza = [...proyeccion.asentamientos, ...proyeccion.asentamientosAvistados].find((a) => a.id === u.asentamientoId);
  return `en ${plaza?.nombre ?? u.asentamientoId}`;
}

/** La pestaña «Héroe» de la Base: herido, los atributos con su reparto y, si es mercenario, su ficha. Nivel, Liderazgo y monedas van en el lateral. */
export function htmlFichaHeroe(h: HeroeProyectado, proyeccion: ProyeccionJugador, e: Escapar): string {
  const puntos = h.puntosDeAtributoSinGastar;
  const herido = minutosHerido(proyeccion);
  return `
    ${herido !== null ? `<p class="heroe-herido">Herido: ${herido} min. No atacas, no persigues y tus escuadras no combaten.</p>` : ''}
    <strong class="heroe-sub">Atributos · ${puntos} ${puntos === 1 ? 'punto' : 'puntos'} sin gastar</strong>
    <div class="heroe-atributos">
      ${ATRIBUTOS.map(([id, nombre]) => `<label><span>${nombre}</span><strong>${h.atributosBase[id]}</strong>${puntos > 0 ? `<input type="number" min="0" max="${puntos}" value="0" data-atributo="${id}" />` : ''}</label>`).join('')}
    </div>
    ${puntos > 0 ? '<button type="button" class="btn-secondary" data-accion="repartir">Repartir puntos</button>' : ''}
    ${htmlHeroeMercenario(proyeccion, e)}
    <p class="faction-error" data-campo="error" role="alert"></p>`;
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
        .map((s) => `<label class="mapa-lista-item heroe-fila con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(s.nombre)}</strong><span>${s.cantidad} hombres · ${s.costeLiderazgo} de Liderazgo · ${DONDE[s.contenedor.tipo]}</span></div><input type="checkbox" data-squad="${e(s.id)}"${b.squadIds.has(s.id) ? ' checked' : ''} /></label>`)
        .join('') || '<p class="mapa-lista-vacia">No tienes escuadras: el loadout irá vacío.</p>'
    }</div>
    <label class="heroe-check"><input type="checkbox" data-campo="activo"${b.activo ? ' checked' : ''} /> Activo (defiende tu residencia)</label>
    <p class="heroe-nota" data-campo="suma"></p>
    <div class="heroe-acciones"><button type="button" class="btn-secondary" data-accion="guardar">Guardar</button><button type="button" class="btn-secondary" data-accion="cancelar">Cancelar</button></div>`;
}

/** La pestaña «Loadouts» de la Base: la lista, o el editor si hay uno abierto. */
export function htmlLoadouts(h: HeroeProyectado, e: Escapar): string {
  if (borrador) return renderEditor(h, e) + '<p class="faction-error" data-campo="error" role="alert"></p>';
  return `
    <strong class="heroe-sub">Loadouts${ayuda('jugador:heroe-loadouts', 'El loadout activo es el que defiende tu residencia mientras estás dentro. Los perks llegarán con el catálogo de Conquest.')}</strong>
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
    <p class="faction-error" data-campo="error" role="alert"></p>`;
}

/** Cablea las pestañas «Héroe» y «Loadouts» de la Base; `repintar` la vuelve a pintar a la fuerza (con la proyección de ahora). */
export function cablearHeroe(panel: HTMLElement, h: HeroeProyectado, aplicar: Aplicar, repintar: () => void): void {
  const gameId = estadoCliente.gameIdActivo;
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
  cablearHeroeMercenario(panel, async (tipo, params) => { const m = await aplicar(ejecutarComando(gameId, tipo, params)); if (!m) repintar(); return m; });

  panel.querySelectorAll<HTMLButtonElement>('[data-accion]').forEach((boton) => boton.addEventListener('click', () => {
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
      case 'activar':
        if (elegido) void accion(boton, () => guardarLoadout(gameId, { loadoutId: elegido.id, displayName: elegido.displayName, squadIds: elegido.squadIds, perksSeleccionados: elegido.perksSeleccionados, activo: true }));
        return;
      case 'borrar':
        if (elegido) void confirmar(`Se borra el loadout «${elegido.displayName}».`, { titulo: '¿Borrar el loadout?', aceptar: 'Borrar', peligro: true }).then((ok) => { if (ok) void accion(boton, () => borrarLoadout(gameId, elegido.id)); });
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
