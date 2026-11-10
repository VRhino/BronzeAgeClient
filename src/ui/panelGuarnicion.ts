// La guarnición de la plaza en la ventana Defensa (0.138.0, petición de Víctor del 2026-11-04): quién la forma y de quién es cada escuadra
// (`Asentamiento.guarnicion`, motor 7a6a0c48), y dejar o sacar las tuyas (`asignarGuarnicion` / `retirarGuarnicion`):
//  - si resides aquí, las de tu campamento (quedan en él con `enGuarnicion`);
//  - de visita en una plaza de tu Facción (0.139.0), las de la columna con la que entraste (pasan a `contenedor: plaza`); al salir no se van contigo
//    y se recogen desde dentro, de vuelta a la columna;
//  - a la puerta, con la columna (0.199.0, motor 906fb24; la ventana Guarnición de la ficha del mundo): se dejan las de la columna (a tu campamento
//    si resides, de visita si no) y las tuyas de la guarnición vuelven a la columna.
// El cupo es por héroe y en Liderazgo (`Asentamiento.cupoGuarnicion`, el mismo de visita). La guarnición defiende en un asedio y no sale, ni escolta, ni ataca.
import type { Escuadron } from '../tiposDominio';
import type { ContextoPlaza, SubpestanaPlaza } from './ganchos';
import { iconoTropa } from './iconosTropa';
import { mostrar as mostrarAviso } from './avisos';
import { columnaALaPuerta, miColumna, nombreDeTropa } from './ejercitos';
import { nombreDeHeroe } from './nombres';

/** El desplegable de escuadras para dejar abierto: sobrevive a los repintados del sondeo. */
let eligiendo = false;

const dentroDe = (c: ContextoPlaza): boolean => c.proyeccion.heroe.ubicacion.tipo === 'asentamiento' && c.proyeccion.heroe.ubicacion.asentamientoId === c.asentamiento.id;
/** Fuera, con tu columna a su puerta: se deja y se recoge con la columna. */
const aLaPuertaDe = (c: ContextoPlaza): boolean => !dentroDe(c) && columnaALaPuerta(c.proyeccion, c.asentamiento.posicion);

/** Tus escuadras en la guarnición de esta plaza: las de tu campamento si resides, las dejadas de visita si no. */
function tuyasDentro(c: ContextoPlaza): Escuadron[] {
  const { proyeccion: p, asentamiento: a, resideAqui } = c;
  return p.heroe.escuadrones.filter((s) => (resideAqui && s.contenedor.tipo === 'campamento' && s.enGuarnicion) || (s.contenedor.tipo === 'plaza' && s.contenedor.asentamientoId === a.id));
}

/** Las que puedes dejar: residente, las del campamento; de visita y dentro de una plaza de tu Facción, las de tu columna. */
function paraDejar(c: ContextoPlaza): { lista: Escuadron[]; de: 'campamento' | 'columna' | null } {
  const { proyeccion: p, resideAqui } = c;
  const puerta = aLaPuertaDe(c) ? miColumna(p) : undefined;
  if (puerta) return { lista: p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === puerta.id && s.cantidad > 0), de: 'columna' };
  if (resideAqui) return { lista: p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0), de: 'campamento' };
  const columna = dentroDe(c) ? miColumna(p) : undefined;
  if (!columna) return { lista: [], de: null };
  return { lista: p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === columna.id && s.cantidad > 0), de: 'columna' };
}

function html(c: ContextoPlaza): string {
  const { proyeccion: p, asentamiento: a, escapar: e, resideAqui } = c;
  const mias = tuyasDentro(c);
  const idsMias = new Set(mias.map((s) => s.id));
  // Las de los demás, con su tropa y su dueño (`guarnicion` va en el orden de `guarnicionIds`); sin ella, solo el id.
  const ids = a.guarnicionIds ?? [];
  const ajenas = ids.map((id, i) => ({ id, info: a.guarnicion?.[i] })).filter((x) => !idsMias.has(x.id) && x.info?.heroeId !== p.heroeId);
  const { lista: candidatas, de } = paraDejar(c);
  const puede = de !== null;
  const cupo = a.cupoGuarnicion ?? (resideAqui ? p.heroe.cupoGuarnicion : 0);
  const usado = mias.reduce((t, s) => t + s.costeLiderazgo, 0);
  const libre = cupo - usado;
  const abierta = eligiendo && candidatas.length > 0;

  const huecos = [
    ...mias.map((s) => `<div class="salida-hueco lleno" title="${e(`${s.nombre} · ${s.cantidad} hombres`)}">
        <span class="salida-hueco-icono">${iconoTropa(s.tropaId, 34)}</span><span class="salida-hueco-nombre">${e(s.nombre)}</span>
        <small>Tuya${s.contenedor.tipo === 'plaza' ? ' · de visita' : ''} · ${s.cantidad} hombres · ${s.costeLiderazgo} pts</small>
        ${dentroDe(c) || resideAqui || aLaPuertaDe(c) ? `<button class="salida-hueco-quitar" type="button" data-guarnicion-retirar="${e(s.id)}" title="${s.contenedor.tipo === 'plaza' || aLaPuertaDe(c) ? 'Recogerla a tu columna' : 'Sacarla al campamento'}" aria-label="Sacar ${e(s.nombre)}">✕</button>` : ''}
      </div>`),
    ...ajenas.map(({ info }) => info
      ? `<div class="salida-hueco lleno ajena" title="${e(`${nombreDeTropa(info.tropaId)} · ${info.cantidad} hombres · de ${nombreDeHeroe(p, info.heroeId)}`)}">
          <span class="salida-hueco-icono">${iconoTropa(info.tropaId, 34)}</span><span class="salida-hueco-nombre">${e(nombreDeTropa(info.tropaId))}</span>
          <small>${info.cantidad} hombres · de <strong class="guarnicion-dueno">${e(nombreDeHeroe(p, info.heroeId))}</strong></small></div>`
      : '<div class="salida-hueco lleno ajena"><span class="salida-hueco-icono escolta-ajena-icono" aria-hidden="true">⚔</span><span class="salida-hueco-nombre">Escuadra</span><small>De otro héroe</small></div>'),
  ];
  if (candidatas.length > 0) huecos.push(`<button class="salida-hueco mas${abierta ? ' activo' : ''}" type="button" data-guarnicion-mas title="Dejar una escuadra ${de === 'columna' ? 'de tu columna' : 'del campamento'} en la guarnición" aria-label="Dejar una escuadra en la guarnición">+</button>`);

  const lista = abierta ? `<div class="salida-elegir">${candidatas.map((s) => {
    const cabe = s.costeLiderazgo <= libre;
    return `<button class="salida-candidata" type="button" data-guarnicion-asignar="${e(s.id)}"${cabe ? '' : ` disabled title="No cabe: quedan ${Math.max(0, libre)} pts"`}>${iconoTropa(s.tropaId, 26)}<span><strong>${e(s.nombre)}</strong><small>${s.cantidad} hombres · <span class="${cabe ? '' : 'falta'}">${s.costeLiderazgo} de Liderazgo</span></small></span></button>`;
  }).join('')}</div>` : '';

  const total = mias.length + ajenas.length;
  const cabecera = puede || mias.length
    ? `<span class="salida-liderazgo${usado > cupo ? ' excedido' : ''}" title="Tu cupo de guarnición en esta plaza: cada héroe tiene el suyo">Tu cupo ${usado} / ${cupo}</span>`
    : '';
  const barra = cabecera ? `<div class="escolta-barra${usado >= cupo ? ' llena' : ''}"><i style="width:${cupo > 0 ? Math.min(100, (usado / cupo) * 100).toFixed(1) : 0}%"></i></div>` : '';
  const nota = !puede
    ? ''
    : cupo === 0
      ? '<p class="asent-lado-nota">El cupo es 0: la plaza necesita un Barracón o una Galería de tiro para admitir guarnición.</p>'
      : candidatas.length === 0 && mias.length === 0
        ? `<p class="asent-lado-nota">${de === 'columna' ? 'Tu columna no trae escuadras con soldados.' : 'No tienes escuadras en el campamento: se reclutan aquí o vuelven con tu columna.'}</p>`
        : aLaPuertaDe(c) ? '<p class="asent-lado-nota">A la puerta: dejas tropa de tu columna y la recoges de vuelta a ella sin entrar.</p>'
          : de === 'columna' ? '<p class="asent-lado-nota">De visita: dejas tropa de la columna con la que entraste. No sale contigo; la recoges a tu columna estando dentro o a la puerta.</p>' : '';
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
