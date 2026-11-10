// LAS AVANZADAS POR DENTRO Y DESDE SU PLAZA MADRE (Víctor, 2026-11-07: «a las atalayas y avanzadas se debería poder entrar como en los campamentos,
// plaza, pueblos y aldeas»). Se entra con la columna a su puerta (`entrarEnAvanzada { heroeId, avanzadaId }`), con todo, como en un pueblo: la
// columna sale del mapa. Dentro, la pantalla tiene el esqueleto común (`.plaza-3d`) con estas partes en el riel:
//   resumen     qué es, de qué plaza, si está en ruinas o la atacan, y quién está dentro
//   guarnicion  la de serie (IA, por escalón) y la de los jugadores, con tu cupo de Liderazgo; dejar y retirar escuadras de tu columna
//   almacen     fuerte y ciudadela: lo que guarda de cada recurso; dejar lo de tu carro y llenar los víveres (repostar)
//   tropa       la tropa de serie de cada escalón; la elige el Gobernador de la plaza madre
// Guarnecer, retirar, depositar y repostar se hacen dentro, con la columna con la que se entró, o a la puerta, desde la ficha del mapa; elegir la
// tropa, el Gobernador de la madre dentro de ella o de la avanzada (motor 0e283fb, cliente 0.179.0). Mejorar, reparar, destruir y cancelar su obra
// son de la madre: Territorio, tarjeta de la avanzada.
import { bloqueDeDatos, capacidadDeViveres, radioDePuerta, tropasReclutables, type ProyeccionJugador, type TropaReclutable } from '../apiCliente';
import { RECURSO_ICONO, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, AvanzadaDeMapa, Escuadron } from '../tiposDominio';
import { ayuda } from './ayuda';
import { miColumna } from './ejercitos';
import { iconoEnFila } from './iconosTropa';
import { chipLiderazgo } from './liderazgo';
import { nombreDeHeroe } from './nombres';
import type { Ejecutar } from './panelCarro';
import { textoEnTiempoReal } from './estadoCliente';
import type { AccionPuerta, VentanaPuerta } from './accionesPuerta';

type Escapar = (valor: string) => string;

const ETAPA: Record<number, string> = { 1: 'Atalaya', 2: 'Fuerte', 3: 'Ciudadela' };
const CLAVE: Record<number, string> = { 1: 'atalaya', 2: 'fuerte', 3: 'ciudadela' };
const TRAZO = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const RELLENO = 'fill="var(--relleno, rgba(205,160,90,0.25))" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';
const DIBUJO_AVANZADA: Record<number, string> = {
  // la torre de vigía: tejadillo, plataforma y cuatro pies arriostrados
  1: `<path ${RELLENO} d="M9 12 16 5l7 7Z"/><path ${RELLENO} d="M8 12h16v3H8Z"/><path ${TRAZO} d="M10 15 8 29M22 15l2 14M13 15l-1 14M19 15l1 14M9.3 21h13.4M8.6 26h14.8"/>`,
  // el fuerte: torre cuadrada almenada con su puerta
  2: `<path ${RELLENO} d="M8 29V10h3V7h3v3h4V7h3v3h3v19Z"/><path ${TRAZO} d="M14 29v-5a2 2 0 0 1 4 0v5M12 15v2M20 15v2"/>`,
  // la ciudadela: dos torres almenadas y el lienzo de muro con la puerta entre ellas
  3: `<path ${RELLENO} d="M2 29V12h2V9h2v3h2V9h2v3h2v17ZM20 29V12h2V9h2v3h2V9h2v3h2v17Z"/><path ${RELLENO} d="M12 29V17h8v12Z"/><path ${TRAZO} d="M14 29v-4a2 2 0 0 1 4 0v4M12 17v-2h2v2M18 17v-2h2v2"/>`,
};
/** El icono de una avanzada por su etapa (en el estilo de `iconosEdificio.ts`, 32 × 32). */
export const iconoDeAvanzada = (etapa: number, lado = 28): string =>
  `<svg class="icono-edificio" width="${lado}" height="${lado}" viewBox="0 0 32 32" aria-hidden="true">${DIBUJO_AVANZADA[etapa] ?? DIBUJO_AVANZADA[1]}</svg>`;
const n0 = (v: number): string => String(Math.floor(v));

/** `AVANZADA` de Combate: cupo de guarnición por héroe (Liderazgo), la de serie por escalón, la tropa por defecto y lo que tarda en reponerse. */
interface ReglasDeCombate { cupoGuarnicion?: Record<string, number>; guarnicionDeSerie?: Record<string, Record<string, number>>; tropaPorDefecto?: string; reposicionMinutos?: number }
/** `AVANZADAS` de Economía: nivel de la madre por etapa, capacidad de almacén, fracción de la reparación y las obras. */
interface ReglasDeObra { nivelMadre?: Record<string, number>; capacidadAlmacen?: Record<string, number>; fraccionReparacion?: number; obras?: Record<string, { costo?: Record<string, number>; minutos?: number }> }
const combate = (): ReglasDeCombate | null => bloqueDeDatos<ReglasDeCombate>('AVANZADA');
export const reglasDeObra = (): ReglasDeObra | null => bloqueDeDatos<ReglasDeObra>('AVANZADAS');

export const nombreDeEtapa = (etapa: number): string => ETAPA[etapa] ?? 'Avanzada';
export const claveDeEtapa = (etapa: number): string => CLAVE[etapa] ?? 'atalaya';

/** La avanzada en la que está el héroe, si está dentro de una. */
export function avanzadaActual(p: ProyeccionJugador): AvanzadaDeMapa | undefined {
  const u = p.heroe.ubicacion;
  return u.tipo === 'avanzada' ? (p.avanzadas ?? []).find((x) => x.id === u.avanzadaId) : undefined;
}

/** La plaza madre, si se conoce (propia, avistada o recordada), con su nombre. */
export function madreDe(p: ProyeccionJugador, x: { madreId: string }): { a?: Asentamiento; nombre: string; faccionId?: string } {
  const a = p.asentamientos.find((q) => q.id === x.madreId) ?? (p.asentamientosAvistados.find((q) => q.id === x.madreId) as Asentamiento | undefined);
  const c = p.asentamientosConocidos.find((q) => q.asentamientoId === x.madreId);
  return { a, nombre: a?.nombre ?? c?.nombre ?? 'su plaza madre', faccionId: a?.faccionId ?? c?.faccionId };
}

/** Tus cargos en la madre (`gobernador@as-N`, `maestroObras@as-N`), de los miembros de tu Facción. */
function cargosEnLaMadre(p: ProyeccionJugador, madreId: string): { gobernador: boolean; maestroObras: boolean } {
  const yo = p.facciones.find((f) => f.id === p.faccionId)?.miembros?.find((m) => m.heroeId === p.heroeId);
  return { gobernador: Boolean(yo?.cargos.includes(`gobernador@${madreId}`)), maestroObras: Boolean(yo?.cargos.includes(`maestroObras@${madreId}`)) };
}

const resideEnLaMadre = (p: ProyeccionJugador, x: AvanzadaDeMapa): boolean => p.heroe.residenciaId === x.madreId;
const operativa = (x: AvanzadaDeMapa): boolean => !x.enRuinas;

/** Tus escuadras en la guarnición de esa avanzada. */
const tuyasEn = (p: ProyeccionJugador, x: AvanzadaDeMapa): Escuadron[] => p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'avanzada' && s.contenedor.avanzadaId === x.id);
/** Las escuadras de tu columna que se pueden dejar (vivas). */
const deTuColumna = (p: ProyeccionJugador): Escuadron[] => {
  const c = miColumna(p);
  return c ? p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.contenedor.ejercitoId === c.id && s.cantidad > 0) : [];
};

/** ¿Va con ella la Facción de la madre? La tuya, aliada o en vasallaje (en un sentido o en el otro): las que el motor deja entrar. */
function puertaAbierta(p: ProyeccionJugador, x: AvanzadaDeMapa): boolean {
  return x.propia || faccionAmiga(p, madreDe(p, x).faccionId);
}

/** ¿Es la Facción `f` aliada o vasalla de la tuya (en un sentido o en el otro)? Las que el motor deja entrar en lo suyo. */
export function faccionAmiga(p: ProyeccionJugador, f: string | undefined | null): boolean {
  if (!f || !p.faccionId) return false;
  return (p.relaciones ?? []).some((r) => r.estado === 'activa' && (r.tipo === 'alianza' || r.tipo === 'vasallaje')
    && ((r.faccionAId === f && r.faccionBId === p.faccionId) || (r.faccionBId === f && r.faccionAId === p.faccionId)));
}

const barra = (valor: number, tope: number): string => {
  const pct = tope > 0 ? Math.min(100, Math.round((valor / tope) * 100)) : 0;
  return `<div class="carro-barra carro-barra-${pct >= 100 ? 'llena' : pct >= 80 ? 'casi' : 'ok'}"><span style="width:${pct}%"></span></div>`;
};

const fila = (s: Escuadron, boton: string, e: Escapar): string =>
  `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div>${boton}</div>`;

// ---------------------------------------------------------------- en el mapa: entrar, guarnecer, depositar y repostar a la puerta

/** Lo que se hace en la ficha del mapa con tu columna a su puerta (0.193.0, Víctor 2026-11-10: un botón por acción, abajo a la derecha). Entrar
 * (el que va solo o el Líder) y llenar los víveres de su trigo (el Líder, fuerte y ciudadela, con sitio en los víveres) actúan al pulsarlos; tu
 * guarnición (quien reside en la madre) y dejar lo del carro en su almacén abren su ventana, con los mismos bloques que por dentro. Lo que no se
 * puede hacer desde donde está tu columna no sale. */
export function puertaDeAvanzada(p: ProyeccionJugador, x: AvanzadaDeMapa, e: Escapar, ejecutar: Ejecutar): { acciones: AccionPuerta[]; ventanas: Record<string, () => VentanaPuerta>; nota: string } {
  const nada = { acciones: [] as AccionPuerta[], ventanas: {} as Record<string, () => VentanaPuerta>, nota: '' };
  const mi = miColumna(p);
  if (!mi || !operativa(x) || !puertaAbierta(p, x)) return nada;
  const d = Math.hypot(mi.posicionActual.x - x.posicion.x, mi.posicionActual.y - x.posicion.y);
  const puerta = radioDePuerta();
  if (d > puerta) return { ...nada, nota: `<p class="asent-lado-nota">Acerca tu columna a su puerta (está a ${n0(d)}; se entra a ${puerta} o menos).</p>` };
  const solo = mi.participantes.length === 1;
  const lider = solo || mi.liderId === p.heroeId;
  const acciones: AccionPuerta[] = [];
  if (lider) acciones.push({ id: 'entrar', etiqueta: solo ? 'Entrar' : 'Entrar con el ejército', icono: '🚪', principal: true });
  const trigo = Math.floor(x.almacen?.trigo ?? 0);
  const hueco = capacidadDeViveres() * Math.max(1, mi.participantes.length) - Math.floor(p.heroe.viveres ?? 0);
  if (lider && trigo >= 1 && hueco >= 1) acciones.push({ id: 'viveres', etiqueta: 'Llenar víveres', icono: '🌾', titulo: `Llena los víveres de tu columna con el trigo de su almacén (hay ${trigo}).` });
  const ventanas: Record<string, () => VentanaPuerta> = {};
  const pie = '<p class="faction-error" data-avanzada-error role="alert"></p>';
  const cablear = (cuerpo: HTMLElement): void => cablearAvanzada(cuerpo, p, x, ejecutar);
  if (x.propia && htmlGuarnicionTuya(p, x, true, e)) {
    acciones.push({ id: 'guarnicion', etiqueta: 'Guarnición', icono: '🛡', ventana: true });
    ventanas.guarnicion = () => ({ titulo: 'Tu guarnición', icono: iconoDeAvanzada(x.etapa), ancho: 'estrecha', html: `${htmlGuarnicionTuya(p, x, true, e)}${pie}`, cablear });
  }
  if (x.propia && htmlCargaAlAlmacen(p, x, true, e, false)) {
    acciones.push({ id: 'carga', etiqueta: 'Carga', icono: '📦', ventana: true });
    ventanas.carga = () => ({ titulo: 'Al almacén', icono: iconoDeAvanzada(x.etapa), ancho: 'estrecha', html: `${htmlCargaAlAlmacen(p, x, true, e, false)}${pie}`, cablear });
  }
  return { acciones, ventanas, nota: `${lider ? '' : '<p class="asent-lado-nota">Solo el Líder hace entrar al ejército.</p>'}${pie}` };
}

/** Cablea los botones directos de la puerta de la avanzada (Entrar y Llenar víveres) de la ficha del mapa. */
export function cablearPuertaDeAvanzada(cont: HTMLElement, p: ProyeccionJugador, x: AvanzadaDeMapa, ejecutar: Ejecutar): void {
  const error = cont.querySelector<HTMLElement>('[data-avanzada-error]');
  const enviar = (sel: string, tipo: string, params: object): void => {
    const b = cont.querySelector<HTMLButtonElement>(sel);
    b?.addEventListener('click', async () => {
      b.disabled = true;
      const mensaje = await ejecutar(tipo, params);
      b.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    });
  };
  enviar('[data-puerta="entrar"]', 'entrarEnAvanzada', { heroeId: p.heroeId, avanzadaId: x.id });
  enviar('[data-puerta="viveres"]', 'repostar', { heroeId: p.heroeId, lugarId: x.id });
}

/** Cablea los botones de la avanzada (los de la ficha del mapa y los de la pantalla de dentro). */
export function cablearAvanzada(raiz: HTMLElement, p: ProyeccionJugador, x: AvanzadaDeMapa, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-avanzada-error]');
  const enviar = async (b: HTMLButtonElement, tipo: string, params: object): Promise<void> => {
    b.disabled = true;
    const mensaje = await ejecutar(tipo, params);
    b.disabled = false;
    if (error) error.textContent = mensaje ?? '';
  };
  raiz.querySelectorAll<HTMLButtonElement>('[data-avanzada-mapa]').forEach((b) => b.addEventListener('click', () => {
    const escuadronIds = b.dataset.escuadra ? [b.dataset.escuadra] : [];
    const recurso = b.dataset.recurso ?? '';
    const cantidad = Number(raiz.querySelector<HTMLInputElement>(`input[data-avanzada-cantidad="${recurso}"]`)?.value ?? 0);
    const base = { heroeId: p.heroeId, avanzadaId: x.id };
    switch (b.dataset.avanzadaMapa) {
      case 'entrar': return void enviar(b, 'entrarEnAvanzada', base);
      case 'guarnecer': return void enviar(b, 'guarnecerAvanzada', { ...base, escuadronIds });
      case 'retirar': return void enviar(b, 'retirarDeAvanzada', { ...base, escuadronIds });
      case 'depositar': { const c = miColumna(p); if (c) void enviar(b, 'depositarEnAvanzada', { ejercitoId: c.id, avanzadaId: x.id, recurso, cantidad }); return; }
      case 'repostar': return void enviar(b, 'repostar', { heroeId: p.heroeId, lugarId: x.id });
    }
  }));
  raiz.querySelectorAll<HTMLSelectElement>('[data-avanzada-tropa]').forEach((s) => s.addEventListener('change', () => {
    const tropaId = s.value;
    s.disabled = true;
    void ejecutar('elegirTropaDeAvanzada', { heroeId: p.heroeId, avanzadaId: x.id, tropaId }).then((mensaje) => {
      s.disabled = false;
      if (error) error.textContent = mensaje ?? '';
    });
  }));
}

// ---------------------------------------------------------------- las partes

/** Tu guarnición en ella: tu cupo y, si puedes dar órdenes desde donde estás (`acciones`), «Retirar» las tuyas y «Dejar» las de tu columna. */
function htmlGuarnicionTuya(p: ProyeccionJugador, x: AvanzadaDeMapa, acciones: boolean, e: Escapar): string {
  if (!resideEnLaMadre(p, x)) return '';
  const cupo = combate()?.cupoGuarnicion?.[claveDeEtapa(x.etapa)];
  const tuyas = tuyasEn(p, x);
  const usado = tuyas.reduce((t, s) => t + s.costeLiderazgo, 0);
  const libre = cupo === undefined ? Infinity : cupo - usado;
  const columna = acciones && operativa(x) ? deTuColumna(p) : [];
  if (!tuyas.length && !columna.length) return '';
  return `<div class="carro-ocupacion"><strong class="heroe-sub">Tu guarnición${ayuda('avanzada:guarnicion', 'Quien reside en la plaza madre puede dejar aquí escuadras de su columna, hasta su cupo de Liderazgo de esta etapa. Defienden la avanzada aunque no estés y se quedan al salir; si cae en ruinas, vuelven a tu campamento.')}</strong>${cupo !== undefined ? `<span>${usado} / ${cupo}</span>` : ''}</div>
    ${cupo !== undefined ? barra(usado, cupo) : ''}
    ${tuyas.length ? `<div class="mapa-lista">${tuyas.map((s) => fila(s, acciones ? `<button class="btn-secondary" type="button" data-avanzada-mapa="retirar" data-escuadra="${e(s.id)}">Retirar</button>` : '', e)).join('')}</div>` : ''}
    ${columna.length ? `<small class="asent-lado-nota">De tu columna:</small><div class="mapa-lista">${columna.map((s) => {
      const cabe = s.costeLiderazgo <= libre;
      return fila(s, `<button class="btn-secondary" type="button" data-avanzada-mapa="guarnecer" data-escuadra="${e(s.id)}"${cabe ? '' : ` disabled title="No cabe: te quedan ${Math.max(0, libre)} de Liderazgo"`}>Dejar</button>`, e);
    }).join('')}</div>` : ''}`;
}

/** Dejar lo de tu carro en su almacén y llenar los víveres de su trigo (fuerte y ciudadela, con tu columna). */
function htmlCargaAlAlmacen(p: ProyeccionJugador, x: AvanzadaDeMapa, acciones: boolean, e: Escapar, conRepostar = true): string {
  const columna = miColumna(p);
  const capacidad = x.capacidad ?? {};
  if (!acciones || !columna || !operativa(x) || !Object.values(capacidad).some((n) => n > 0)) return '';
  const lider = columna.liderId === p.heroeId || columna.participantes.length === 1;
  const filas = Object.entries(columna.suministro ?? {}).filter(([r, n]) => n >= 1 && (capacidad[r] ?? 0) > 0).map(([r, n]) => {
    const sitio = Math.max(0, (capacidad[r] ?? 0) - (x.almacen?.[r] ?? 0));
    const max = Math.floor(Math.min(n, sitio));
    return `<div class="carro-fila avanzada-carga"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><strong>${n0(n)}</strong><input class="form-input" type="number" min="1" max="${max}" value="${max}" data-avanzada-cantidad="${e(r)}"${max ? '' : ' disabled'} /><button class="btn-secondary" type="button" data-avanzada-mapa="depositar" data-recurso="${e(r)}"${max ? '' : ' disabled title="El almacén no tiene sitio para más."'}>Dejar</button></div>`;
  });
  const viveres = Math.floor(p.heroe.viveres ?? 0);
  const trigo = Math.floor(x.almacen?.trigo ?? 0);
  const repostar = conRepostar && lider && trigo >= 1
    ? `<div class="mapa-seleccion-acciones"><button class="btn-secondary" type="button" data-avanzada-mapa="repostar" title="Llena los víveres de tu columna con el trigo de su almacén (hay ${trigo}).">🌾 Llenar víveres (${viveres})</button></div>` : '';
  if (!filas.length && !repostar) return '';
  if (!filas.length && !conRepostar) return '';
  return `<strong class="heroe-sub">Del carro a su almacén${ayuda('avanzada:almacen', 'El fuerte y la ciudadela guardan recursos para la Facción: se deja lo que lleva el carro de una columna de la Facción y de su trigo se llenan los víveres. La atalaya no tiene almacén.')}</strong>
    ${filas.join('') || '<p class="asent-lado-nota">Tu carro no lleva nada que quepa aquí.</p>'}${repostar}`;
}

/** Las escuadras de serie de su etapa, por escalón, con la tropa elegida o la de por defecto. */
function serie(x: AvanzadaDeMapa): { escalon: number; escuadras: number; tropaId: string }[] {
  const r = combate();
  const porEscalon = r?.guarnicionDeSerie?.[claveDeEtapa(x.etapa)] ?? {};
  return Object.entries(porEscalon).map(([k, n]) => ({ escalon: Number(k), escuadras: n, tropaId: x.tropaPorEscalon?.[Number(k)] ?? r?.tropaPorDefecto ?? '' }))
    .sort((a, b) => a.escalon - b.escalon);
}

const nombreDeTropa = (id: string, catalogo: TropaReclutable[] | null): string => catalogo?.find((t) => t.id === id)?.nombre ?? id.replace(/_/g, ' ');

function htmlResumen(p: ProyeccionJugador, x: AvanzadaDeMapa, e: Escapar): string {
  const madre = madreDe(p, x);
  const columna = miColumna(p);
  const dentro = columna ? columna.participantes.map((q) => nombreDeHeroe(p, q.heroeId)).join(', ') : '';
  const cupo = combate()?.cupoGuarnicion?.[claveDeEtapa(x.etapa)];
  const capacidad = Object.values(x.capacidad ?? {}).reduce((t, n) => Math.max(t, n), 0);
  const escuadras = serie(x).reduce((t, s) => t + s.escuadras, 0);
  const estado = x.enRuinas
    ? `<p class="avanzada-estado ruinas">🏚 En ruinas: no funciona nada.${x.invulnerableHasta && x.invulnerableHasta > p.instante ? ` No se la puede atacar en ${e(textoEnTiempoReal(x.invulnerableHasta - p.instante))}.` : ''}</p>`
    : x.batallaId ? '<p class="avanzada-estado atacada">⚔ La están atacando: si sigues dentro, defiendes.</p>' : '';
  return `<p class="asent-lado-nota">${e(nombreDeEtapa(x.etapa))} de ${e(madre.nombre)}.</p>${estado}
    <div class="avanzada-cifras">
      ${x.propia && escuadras ? `<span class="obra-chip" title="Escuadras de serie, fuera de cupo">⚔ ${escuadras} de serie</span>` : ''}
      ${cupo !== undefined ? `<span class="obra-chip" title="Cupo de guarnición por héroe, en Liderazgo">🛡 ${cupo} por héroe</span>` : ''}
      ${capacidad > 0 ? `<span class="obra-chip" title="Lo que guarda de cada recurso">📦 ${n0(capacidad)} por recurso</span>` : ''}
    </div>
    <strong class="heroe-sub">Dentro</strong>
    <p class="asent-lado-nota">${dentro ? `Tu columna (${e(dentro)}), fuera del mapa: nadie la ve y sigue comiendo de sus víveres.` : 'Tú.'} Al salir vuelve a la puerta con todo lo que trajo; tu guarnición se queda.</p>`;
}

function htmlGuarnicion(p: ProyeccionJugador, x: AvanzadaDeMapa, e: Escapar): string {
  const catalogo = tropasReclutables();
  const filas = serie(x);
  const hay = x.guarnicionSerieIds?.length;
  const total = filas.reduce((t, s) => t + s.escuadras, 0);
  const minutos = combate()?.reposicionMinutos;
  const deSerie = filas.length ? `<strong class="heroe-sub">De serie${ayuda('avanzada:serie', 'La avanzada trae su propia guarnición, fuera de cupo, que defiende sola. Si cae una escuadra, vuelve a los pocos minutos de mundo. Su tropa la elige el Gobernador de la plaza madre.')}</strong>
    <div class="mapa-lista">${filas.map((s) => `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><strong>${e(nombreDeTropa(s.tropaId, catalogo))}</strong><span>${s.escuadras} escuadra${s.escuadras === 1 ? '' : 's'} · escalón ${s.escalon}</span></div></div>`).join('')}</div>
    ${hay !== undefined && hay < total ? `<p class="asent-lado-nota">Mermada: ${hay} de ${total}${minutos ? `; cada escuadra caída vuelve en ${minutos >= 60 ? `${n0(minutos / 60)} h` : `${minutos} min`}` : ''}.</p>` : ''}` : '';
  const tuyas = tuyasEn(p, x).length;
  const otros = Math.max(0, (x.guarnicionJugadoresIds?.length ?? 0) - tuyas);
  const jugadores = x.propia ? `<p class="asent-lado-nota">${otros ? `${otros} escuadra${otros === 1 ? '' : 's'} de otros héroes de guarnición.` : 'Ningún otro héroe ha dejado escuadras.'}</p>` : '';
  return `${deSerie}${htmlGuarnicionTuya(p, x, true, e)}${jugadores}`;
}

function htmlAlmacen(p: ProyeccionJugador, x: AvanzadaDeMapa, e: Escapar): string {
  const filas = Object.entries(x.capacidad ?? {}).filter(([, c]) => c > 0).sort(([a], [b]) => a.localeCompare(b)).map(([r, c]) => {
    const n = x.almacen?.[r] ?? 0;
    return `<div class="avanzada-recurso"><span>${RECURSO_ICONO[r] ?? '📦'} ${e(RECURSO_NOMBRE[r] ?? r)}</span><strong>${n0(n)} / ${n0(c)}</strong>${barra(n, c)}</div>`;
  });
  return `${filas.join('') || '<p class="asent-lado-nota">Vacío.</p>'}${htmlCargaAlAlmacen(p, x, true, e)}`;
}

/** La tropa de serie de cada escalón; el Gobernador de la madre la cambia entre las que la madre recluta (tecnología de la Facción y edificio). */
function htmlTropa(p: ProyeccionJugador, x: AvanzadaDeMapa, e: Escapar): string {
  return htmlEleccionDeTropa(p, x, true, e);
}

/** La elección de tropa de serie: de lectura o, con `acciones` y siendo el Gobernador de la madre, con su desplegable por escalón. */
export function htmlEleccionDeTropa(p: ProyeccionJugador, x: AvanzadaDeMapa, acciones: boolean, e: Escapar): string {
  const catalogo = tropasReclutables();
  const madre = madreDe(p, x);
  const elige = acciones && operativa(x) && cargosEnLaMadre(p, x.madreId).gobernador;
  const adoptadas = p.tecnologiasAdoptadas ?? [];
  const niveles: Record<string, number> = {};
  for (const b of madre.a?.edificios ?? []) if (b.estado === 'activo' && (b.ambito ?? 'asentamiento') === 'asentamiento') niveles[b.tipo] = Math.max(niveles[b.tipo] ?? 0, b.nivelInterno ?? 1);
  const recluta = (t: TropaReclutable): boolean => adoptadas.includes(t.tecnologia) && (t.edificio === 'centroUrbano' || !madre.a || (niveles[t.edificio] ?? 0) >= t.nivelRequerido);
  const filas = serie(x).map((s) => {
    const opciones = elige ? (catalogo ?? []).filter((t) => t.escalon === s.escalon && (recluta(t) || t.id === s.tropaId)) : [];
    const control = opciones.length > 1
      ? `<select class="asent-cargo-sel" data-avanzada-tropa="${s.escalon}" aria-label="Tropa del escalón ${s.escalon}">${opciones.map((t) => `<option value="${e(t.id)}"${t.id === s.tropaId ? ' selected' : ''}>${e(t.nombre)}</option>`).join('')}</select>`
      : `<strong>${e(nombreDeTropa(s.tropaId, catalogo))}</strong>`;
    return `<div class="mapa-lista-item con-tropa">${iconoEnFila(s.tropaId)}<div><span>Escalón ${s.escalon} · ${s.escuadras} escuadra${s.escuadras === 1 ? '' : 's'}</span>${control}</div></div>`;
  });
  if (!filas.length) return '';
  const nota = elige ? '' : cargosEnLaMadre(p, x.madreId).gobernador ? `La eliges tú desde Territorio, dentro de ${e(madre.nombre)}.` : `La elige el Gobernador de ${e(madre.nombre)}.`;
  return `<div class="mapa-lista">${filas.join('')}</div>${nota ? `<p class="asent-lado-nota">${nota}</p>` : ''}`;
}

export type ParteAvanzada = 'resumen' | 'guarnicion' | 'almacen' | 'tropa';

/** Las partes de la avanzada por dentro, en orden. El almacén, solo con almacén (fuerte y ciudadela); guarnición y tropa, solo las de tu Facción. */
export function partesDeAvanzada(x: AvanzadaDeMapa): [ParteAvanzada, string][] {
  const conAlmacen = Object.values(x.capacidad ?? {}).some((n) => n > 0);
  return [['resumen', 'Resumen'], ...(x.propia ? [['guarnicion', 'Guarnición'] as [ParteAvanzada, string]] : []),
    ...(conAlmacen ? [['almacen', 'Almacén'] as [ParteAvanzada, string]] : []), ...(x.propia ? [['tropa', 'Tropa de serie'] as [ParteAvanzada, string]] : [])];
}

/** Lo que va dentro de una parte (la ventana de su riel), con su línea de error al pie. */
export function htmlParteAvanzada(p: ProyeccionJugador, x: AvanzadaDeMapa, parte: ParteAvanzada, e: Escapar): string {
  const cuerpo = parte === 'guarnicion' ? htmlGuarnicion(p, x, e) : parte === 'almacen' ? htmlAlmacen(p, x, e) : parte === 'tropa' ? htmlTropa(p, x, e) : htmlResumen(p, x, e);
  return `${cuerpo}<p class="faction-error" data-avanzada-error role="alert"></p>`;
}

/** El almacén en el pie, como el del pueblo; `null` en la atalaya (sin almacén). */
export function almacenDelPie(x: AvanzadaDeMapa): { recursos: Record<string, number>; capacidad: number } | null {
  const capacidad = Object.values(x.capacidad ?? {}).reduce((t, n) => Math.max(t, n), 0);
  return capacidad > 0 ? { recursos: x.almacen ?? {}, capacidad } : null;
}
