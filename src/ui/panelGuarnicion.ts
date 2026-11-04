// La guarnición de la plaza en la ventana Defensa (0.138.0, petición de Víctor del 2026-11-04): quién la forma y de quién es cada escuadra,
// y, si resides aquí, tus escuadras del campamento para dejarlas (`asignarGuarnicion`) o sacarlas (`retirarGuarnicion`).
// El cupo es por héroe residente y en Liderazgo (`heroe.cupoGuarnicion`); la guarnición defiende de oficio en un asedio y no sale, ni escolta, ni ataca.
// De las escuadras de otros residentes el motor solo manda el id (`Asentamiento.guarnicion_ids`), sin tropa ni dueño: salen como «de otro residente».
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { iconoTropa } from './iconosTropa';
import { mostrar as mostrarAviso } from './avisos';

/** El desplegable de escuadras para dejar abierto: sobrevive a los repintados del sondeo. */
let eligiendo = false;

function html(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e, resideAqui } = c;
  const h = p.heroe;
  const mias = h.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && s.enGuarnicion);
  const idsMias = new Set(mias.map((s) => s.id));
  const ajenas = (a.guarnicionIds ?? []).filter((id) => !idsMias.has(id));
  const cupo = resideAqui ? h.cupoGuarnicion : 0;
  const usado = mias.reduce((t, s) => t + s.costeLiderazgo, 0);
  const libre = cupo - usado;
  const candidatas = resideAqui ? h.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0) : [];
  const abierta = eligiendo && candidatas.length > 0;

  const huecos = [
    ...mias.map((s) => `<div class="salida-hueco lleno" title="${e(`${s.nombre} · ${s.cantidad} hombres`)}">
        <span class="salida-hueco-icono">${iconoTropa(s.tropaId, 34)}</span><span class="salida-hueco-nombre">${e(s.nombre)}</span>
        <small>Tuya · ${s.cantidad} hombres · ${s.costeLiderazgo} pts</small>
        <button class="salida-hueco-quitar" type="button" data-guarnicion-retirar="${e(s.id)}" title="Sacarla al campamento" aria-label="Sacar ${e(s.nombre)}">✕</button>
      </div>`),
    ...ajenas.map(() => `<div class="salida-hueco lleno ajena"><span class="salida-hueco-icono escolta-ajena-icono" aria-hidden="true">⚔</span><span class="salida-hueco-nombre">Escuadra</span><small>De otro residente</small></div>`),
  ];
  if (candidatas.length > 0) huecos.push(`<button class="salida-hueco mas${abierta ? ' activo' : ''}" type="button" data-guarnicion-mas title="Dejar una escuadra en la guarnición" aria-label="Dejar una escuadra en la guarnición">+</button>`);

  const lista = abierta ? `<div class="salida-elegir">${candidatas.map((s) => {
    const cabe = s.costeLiderazgo <= libre;
    return `<button class="salida-candidata" type="button" data-guarnicion-asignar="${e(s.id)}"${cabe ? '' : ` disabled title="No cabe: quedan ${Math.max(0, libre)} pts"`}>${iconoTropa(s.tropaId, 26)}<span><strong>${e(s.nombre)}</strong><small>${s.cantidad} hombres · <span class="${cabe ? '' : 'falta'}">${s.costeLiderazgo} de Liderazgo</span></small></span></button>`;
  }).join('')}</div>` : '';

  const total = mias.length + ajenas.length;
  const cabecera = resideAqui
    ? `<span class="salida-liderazgo${usado > cupo ? ' excedido' : ''}" title="Tu cupo de guarnición en esta plaza: cada residente tiene el suyo">Tu cupo ${usado} / ${cupo}</span>`
    : '';
  const barra = resideAqui ? `<div class="escolta-barra${usado >= cupo ? ' llena' : ''}"><i style="width:${cupo > 0 ? Math.min(100, (usado / cupo) * 100).toFixed(1) : 0}%"></i></div>` : '';
  const nota = !resideAqui
    ? '<p class="asent-lado-nota">Solo los residentes dejan tropa en la guarnición de su plaza.</p>'
    : cupo === 0
      ? '<p class="asent-lado-nota">Tu cupo es 0: la plaza necesita un Barracón o una Galería de tiro para admitir guarnición.</p>'
      : candidatas.length === 0 && mias.length === 0
        ? '<p class="asent-lado-nota">No tienes escuadras en el campamento: se reclutan aquí o vuelven con tu columna.</p>'
        : '';
  return `<div class="caravana-seccion guarnicion-plaza">
      <div class="salida-tropa-cab"><strong class="heroe-sub">Guarnición · ${total} ${total === 1 ? 'escuadra' : 'escuadras'}</strong>${cabecera}</div>
      ${barra}
      <p class="asent-lado-nota">Defiende la plaza en un asedio. Lo que dejas aquí no sale contigo, ni escolta, ni ataca, hasta que lo saques.</p>
      ${huecos.length ? `<div class="salida-huecos">${huecos.join('')}</div>` : '<p class="asent-lado-nota">Nadie ha dejado tropa en la guarnición.</p>'}${lista}
      ${nota}
    </div>`;
}

function cablear(c: ContextoPlaza): void {
  const r = c.cuerpo;
  const mandar = async (b: HTMLButtonElement, tipo: string, squadId: string): Promise<void> => {
    b.disabled = true;
    const m = await c.ejecutar(tipo, { squadId });
    if (m) { b.disabled = false; mostrarAviso(m, true); return; }
    c.refrescar();
  };
  r.querySelector<HTMLButtonElement>('[data-guarnicion-mas]')?.addEventListener('click', () => { eligiendo = !eligiendo; c.refrescar(); });
  r.querySelectorAll<HTMLButtonElement>('[data-guarnicion-asignar]').forEach((b) => b.addEventListener('click', () => { eligiendo = false; void mandar(b, 'asignarGuarnicion', b.dataset.guarnicionAsignar!); }));
  r.querySelectorAll<HTMLButtonElement>('[data-guarnicion-retirar]').forEach((b) => b.addEventListener('click', () => void mandar(b, 'retirarGuarnicion', b.dataset.guarnicionRetirar!)));
}

/** Solo en una plaza de tu Facción: la guarnición ajena se ve con «inspeccionar». */
const visible = (c: ContextoPlaza): boolean => c.asentamiento.faccionId === c.proyeccion.faccionId;

export const SUBPESTANA_GUARNICION: SubpestanaPlaza = { id: 'guarnicion', etiqueta: 'Guarnición', html, cablear, visible };
