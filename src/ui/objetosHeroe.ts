// EL EQUIPO, LA MOCHILA Y EL ALMACÉN DE OBJETOS DEL HÉROE (0.206.0, motor 457c278; Heroe_Y_Tropa §4.5 y §4.6, Objetos_Del_Heroe §3).
//  - Siete huecos: arma (siempre puesta: no se quita), casco, torso, guantes, pantalones, botas y montura. La clase del héroe es la de su arma, y la
//    clase dice qué pesos de armadura admite (`CLASES_HEROE.armaduras`).
//  - La mochila (72 casillas) y el almacén de objetos de la residencia (144): cada pieza en su casilla fija, lo apilable junto en una.
//  - Las órdenes: `equiparObjeto { casilla }`, `desequiparObjeto { hueco }` y `usarObjeto { casilla, escuadronId? }` dentro de una plaza (también
//    ajena), un pueblo o un campamento y sin ninguna escuadra en batalla (D2); `guardarObjeto` y `sacarObjeto { casilla, cantidad }` solo dentro de
//    la residencia (D22). Regla de interfaz: cada acción sale solo donde se puede, y con la mochila llena no se ofrece nada que mande una pieza a ella.
// Las cifras de cada pieza salen de su ficha (`OBJETOS`) o, si es forjada, de sus `estadisticas`, ya por su calidad. Aquí no se copia ninguna cifra.
import type { ProyeccionJugador } from '../apiCliente';
import type { Escuadron, HeroeProyectado, ItemInstancia, SlotEquipo } from '../tiposDominio';
import { ayuda } from './ayuda';
import { catalogoDeObjetos, clasesDeHeroe, fichaDeObjeto, nombreDeClase, NOMBRE_DE_ATRIBUTO, type AtributoDeClase, type CombateDeObjeto, type FichaObjeto, type PorTipoDeGolpe } from './clasesHeroe';
import { claveDeRareza, textoDeTier } from './fichaCombate';

type Escapar = (valor: string) => string;
export type Ejecutar = (tipo: string, params: Record<string, unknown>) => Promise<string | null>;
export type DondeObjeto = 'mochila' | 'almacen';

/** Los siete huecos, en el orden de la pantalla. */
export const HUECOS: readonly [SlotEquipo, string][] = [['arma', 'Arma'], ['casco', 'Casco'], ['torso', 'Torso'], ['guantes', 'Guantes'], ['pantalones', 'Pantalones'], ['botas', 'Botas'], ['montura', 'Montura']];
const ICONO_HUECO: Record<SlotEquipo, string> = { arma: '⚔️', casco: '⛑️', torso: '🥋', guantes: '🧤', pantalones: '👖', botas: '🥾', montura: '🐎' };
const ATRIBUTOS: readonly AtributoDeClase[] = ['fuerza', 'destreza', 'armadura', 'vitalidad'];
const GOLPES: readonly [keyof PorTipoDeGolpe, string, string][] = [['perforante', 'Perforante', 'Perf.'], ['cortante', 'Cortante', 'Cort.'], ['contundente', 'Contundente', 'Cont.']];

// ── Lo que dice el catálogo ──

export const casillasDe = (donde: DondeObjeto): number => (donde === 'mochila' ? catalogoDeObjetos()?.casillasMochila ?? 72 : catalogoDeObjetos()?.casillasAlmacen ?? 144);
export const piezasDe = (h: HeroeProyectado, donde: DondeObjeto): ItemInstancia[] => (donde === 'mochila' ? h.inventario : h.almacenObjetos ?? []);
/** Casillas libres en la mochila o en el almacén. */
export const libresEn = (h: HeroeProyectado, donde: DondeObjeto): number => Math.max(0, casillasDe(donde) - piezasDe(h, donde).length);
export const nombreDeObjeto = (id: string): string => fichaDeObjeto(id)?.nombre ?? id.replace(/_/g, ' ');

/** El icono de una pieza por su ficha: el del hueco en lo que se pone; el plano, el crisol, las medallas y el cofre, el suyo. */
export function iconoDeObjeto(id: string): string {
  const f = fichaDeObjeto(id);
  if (f?.hueco && f.hueco in ICONO_HUECO) return ICONO_HUECO[f.hueco as SlotEquipo];
  if (id === 'crisol') return '🏺';
  if (id.startsWith('plano_')) return '📜';
  if (id.startsWith('medalla_tropa')) return '🎖️';
  if (id.startsWith('medalla_heroe')) return '🏅';
  if (id.startsWith('cofre')) return '🧰';
  return f?.tipo === 'consumible' ? '✨' : '📦';
}

/** Las cifras de una pieza: las de su ficha o, si es forjada, las suyas (`estadisticas`, ya por la calidad). */
export function cifrasDe(item: Pick<ItemInstancia, 'itemDefinitionId' | 'estadisticas'>): CombateDeObjeto {
  const base = fichaDeObjeto(item.itemDefinitionId)?.combate ?? {};
  const est = item.estadisticas ?? [];
  if (!est.length) return base;
  const v = (n: string): number => est.find((x) => x.nombre === n)?.valor ?? 0;
  const terna = (pre: string): PorTipoDeGolpe => ({ perforante: v(`${pre}Perforante`), cortante: v(`${pre}Cortante`), contundente: v(`${pre}Contundente`) });
  const tiene = (pre: string): boolean => est.some((x) => x.nombre.startsWith(pre));
  return {
    ...base,
    atributos: Object.fromEntries(ATRIBUTOS.map((a) => [a, v(a)])),
    ...(tiene('dano') ? { dano: terna('dano'), penetracion: terna('penetracion') } : {}),
    ...(tiene('defensa') ? { defensa: terna('defensa'), salud: v('salud') } : {}),
  };
}

/** Lo que hace un consumible, en una línea. */
export function textoDeEfecto(f: FichaObjeto): string {
  const x = f.efecto;
  if (x?.experienciaTropa) return `Da ${x.experienciaTropa} de experiencia a una escuadra tuya que no sea prestada ni esté en el nivel 10.`;
  if (x?.experienciaHeroePct) return `Da a tu héroe el ${x.experienciaHeroePct}\u00a0% de lo que pide su nivel para subir.`;
  if (x?.monturaDe?.length) return `Una montura: ${x.monturaDe.map((m) => `${nombreDeObjeto(m.objeto)} (${Math.round(m.probabilidad * 100)}\u00a0%)`).join(', ')}. Va a la mochila; si no cabe, al almacén de objetos.`;
  return '';
}

/** Qué es la pieza, en una línea: «Arma de la clase Dagas», «Armadura media para el torso», «Montura», «Material de la forja», «Consumible». */
export function textoDeTipo(f: FichaObjeto): string {
  if (f.tipo === 'arma') return `Arma · clase ${nombreDeClase(f.clase ?? '')}`;
  if (f.tipo === 'armadura') return `Armadura ${f.tipoArmadura ?? ''} · ${HUECOS.find(([h]) => h === f.hueco)?.[1].toLowerCase() ?? f.hueco}`;
  if (f.tipo === 'montura') return 'Montura';
  if (f.tipo === 'material') return 'Material de la forja';
  return 'Consumible';
}

// ── Dónde se puede ──

/** Por qué no se puede equipar, quitar ni usar aquí (D2), o `null` si se puede. */
export function motivoDeLugar(p: ProyeccionJugador): string | null {
  const u = p.heroe.ubicacion.tipo;
  if (u !== 'asentamiento' && u !== 'pueblo' && u !== 'mercenarios') return 'El equipo se cambia dentro de una plaza, un pueblo o un campamento.';
  if (p.heroe.escuadrones.some((s) => s.enBatalla)) return 'Tienes una escuadra en batalla: el equipo no se toca hasta que acabe.';
  return null;
}

/** Dentro de la plaza o del campamento donde reside: el único sitio donde se abre su almacén de objetos (D22). */
export function dentroDeSuResidencia(p: ProyeccionJugador): boolean {
  const u = p.heroe.ubicacion, r = p.heroe.residenciaId;
  return Boolean(r) && ((u.tipo === 'asentamiento' && u.asentamientoId === r) || (u.tipo === 'mercenarios' && u.campamentoId === r));
}

/** Los pesos de armadura que admite la clase del arma puesta. */
export function pesosDeLaClase(h: HeroeProyectado): string[] {
  const clase = fichaDeObjeto(h.equipamiento.arma?.itemDefinitionId ?? '')?.clase ?? h.classDefinitionId;
  return clasesDeHeroe()?.find((c) => c.id === clase)?.armaduras ?? [];
}

/** Cuántas piezas volverían a la mochila al equipar esta: la que había en el hueco y, con un arma de otra clase, las armaduras que esa clase no admite. */
export function vuelvenAlEquipar(h: HeroeProyectado, f: FichaObjeto): number {
  if (f.tipo === 'arma') {
    const admite = clasesDeHeroe()?.find((c) => c.id === f.clase)?.armaduras ?? [];
    const fuera = (['casco', 'torso', 'guantes', 'pantalones', 'botas'] as const).filter((x) => {
      const p = h.equipamiento[x];
      const peso = p ? fichaDeObjeto(p.itemDefinitionId)?.tipoArmadura : undefined;
      return p && peso && !admite.includes(peso);
    });
    return 1 + fuera.length;
  }
  return f.hueco && h.equipamiento[f.hueco as SlotEquipo] ? 1 : 0;
}

/** Las escuadras que pueden recibir una medalla de tropa: las suyas, no prestadas, por debajo del nivel 10. */
export const escuadrasParaMedalla = (h: HeroeProyectado): Escuadron[] => h.escuadrones.filter((s) => !s.prestada && s.nivel < 10);

export type AccionDeObjeto =
  | { accion: 'equipar'; casilla: number; vuelven: number }
  | { accion: 'usar'; casilla: number; escuadras?: Escuadron[] }
  | { accion: 'guardar' | 'sacar'; casilla: number; cantidad: number }
  | { accion: 'quitar'; hueco: SlotEquipo };

/** Lo que se puede hacer ahora con la pieza de esa casilla (o puesta en ese hueco): solo lo que el motor aceptaría. */
export function accionesDe(p: ProyeccionJugador, donde: DondeObjeto | 'equipo', clave: number | SlotEquipo): AccionDeObjeto[] {
  const h = p.heroe;
  const lugar = motivoDeLugar(p) === null;
  const residencia = dentroDeSuResidencia(p);
  const r: AccionDeObjeto[] = [];
  if (donde === 'equipo') {
    const hueco = clave as SlotEquipo;
    if (lugar && hueco !== 'arma' && h.equipamiento[hueco] && libresEn(h, 'mochila') >= 1) r.push({ accion: 'quitar', hueco });
    return r;
  }
  const item = piezasDe(h, donde).find((x) => x.casillaInventario === clave);
  const f = item ? fichaDeObjeto(item.itemDefinitionId) : undefined;
  if (!item || !f) return r;
  if (donde === 'mochila') {
    if (lugar && (f.tipo === 'arma' || f.tipo === 'montura' || (f.tipo === 'armadura' && pesosDeLaClase(h).includes(f.tipoArmadura ?? '')))) {
      const vuelven = vuelvenAlEquipar(h, f);
      // la casilla de la pieza que se pone queda libre para la que vuelve
      if (vuelven <= libresEn(h, 'mochila') + 1) r.push({ accion: 'equipar', casilla: item.casillaInventario, vuelven });
    }
    if (lugar && f.tipo === 'consumible') {
      if (f.efecto?.experienciaTropa) { const escuadras = escuadrasParaMedalla(h); if (escuadras.length) r.push({ accion: 'usar', casilla: item.casillaInventario, escuadras }); }
      else r.push({ accion: 'usar', casilla: item.casillaInventario });
    }
    const cabe = libresEn(h, 'almacen') >= 1 || (f.apilable && (h.almacenObjetos ?? []).some((x) => x.itemDefinitionId === item.itemDefinitionId));
    if (residencia && cabe) r.push({ accion: 'guardar', casilla: item.casillaInventario, cantidad: item.cantidad });
  } else {
    const cabe = libresEn(h, 'mochila') >= 1 || (f.apilable && h.inventario.some((x) => x.itemDefinitionId === item.itemDefinitionId));
    if (residencia && cabe) r.push({ accion: 'sacar', casilla: item.casillaInventario, cantidad: item.cantidad });
  }
  return r;
}

// ── Pantalla ──

/** La pieza elegida para ver su ficha; se recuerda entre repintados. */
let elegida: { donde: DondeObjeto | 'equipo'; clave: number | SlotEquipo } | null = null;
export function elegirObjeto(x: typeof elegida): void { elegida = x; }

/** La clase CSS del color de su rareza (`r-rara`…). */
export const rarezaDeObjeto = (id: string): string => { const t = fichaDeObjeto(id)?.tier; return t ? `r-${claveDeRareza(t)}` : 'r-ninguna'; };
const rareza = rarezaDeObjeto;
/** «Arma · clase Dagas · Tier II, poco común», para un `title`. */
export function textoDeTipoDeObjeto(id: string): string {
  const f = fichaDeObjeto(id);
  return f ? `${textoDeTipo(f)}${f.tier ? ` · ${textoDeTier(f.tier)}` : ''}` : id;
}
const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ','));

function htmlCasilla(item: ItemInstancia | undefined, donde: DondeObjeto, n: number, e: Escapar): string {
  if (!item) return `<span class="obj-casilla vacia" aria-hidden="true"></span>`;
  const sel = elegida?.donde === donde && elegida.clave === n ? ' elegida' : '';
  const nombre = nombreDeObjeto(item.itemDefinitionId);
  return `<button type="button" class="obj-casilla ${rareza(item.itemDefinitionId)}${sel}" data-obj-ver="${donde}:${n}" title="${e(nombre)}${item.cantidad > 1 ? ` ×${item.cantidad}` : ''}${item.itemInstanceId ? ' (forjada)' : ''}"><i aria-hidden="true">${iconoDeObjeto(item.itemDefinitionId)}</i>${item.cantidad > 1 ? `<b>${item.cantidad}</b>` : ''}${item.itemInstanceId ? '<em aria-hidden="true">✦</em>' : ''}<span class="ta-sr">${e(nombre)}</span></button>`;
}

/** Una rejilla de casillas: la mochila entera; el almacén, hasta la última fila con algo y una más (lo demás, libre). */
function htmlRejilla(h: HeroeProyectado, donde: DondeObjeto, e: Escapar): string {
  const total = casillasDe(donde);
  const piezas = new Map(piezasDe(h, donde).map((x) => [x.casillaInventario, x]));
  const porFila = 12;
  const ultima = Math.max(-1, ...piezas.keys());
  const visibles = donde === 'mochila' ? total : Math.min(total, Math.max(2 * porFila, (Math.floor(ultima / porFila) + 2) * porFila));
  const celdas = Array.from({ length: visibles }, (_, n) => htmlCasilla(piezas.get(n), donde, n, e)).join('');
  return `<div class="obj-rejilla" data-obj-rejilla="${donde}">${celdas}</div>${visibles < total ? `<p class="obj-nota">Y ${total - visibles} casillas libres más.</p>` : ''}`;
}

function htmlHuecos(h: HeroeProyectado, e: Escapar): string {
  return HUECOS.map(([hueco, nombre]) => {
    const x = h.equipamiento[hueco];
    const sel = elegida?.donde === 'equipo' && elegida.clave === hueco ? ' elegida' : '';
    if (!x) return `<div class="obj-hueco vacio"><i aria-hidden="true">${ICONO_HUECO[hueco]}</i><span>${nombre}</span><strong>Vacío</strong></div>`;
    return `<button type="button" class="obj-hueco ${rareza(x.itemDefinitionId)}${sel}" data-obj-ver="equipo:${hueco}"><i aria-hidden="true">${iconoDeObjeto(x.itemDefinitionId)}</i><span>${nombre}</span><strong>${e(nombreDeObjeto(x.itemDefinitionId))}${x.itemInstanceId ? ' <em title="Forjada">✦</em>' : ''}</strong></button>`;
  }).join('');
}

/** Las cifras de una pieza en filas: atributos, la terna de daño, penetración o defensa, la salud; o lo de la montura (también en la Armería). */
export function htmlCifras(c: CombateDeObjeto): string {
  const filas: string[] = [];
  const atr = ATRIBUTOS.filter((a) => c.atributos?.[a]).map((a) => `${NOMBRE_DE_ATRIBUTO[a]} +${num(c.atributos![a]!)}`);
  if (atr.length) filas.push(`<p class="obj-atributos">${atr.join(' · ')}</p>`);
  const tabla = (['dano', 'penetracion', 'defensa'] as const).filter((k) => c[k]).map((k) => `<tr><th scope="row">${k === 'dano' ? 'Daño' : k === 'penetracion' ? 'Penetración' : 'Defensa'}</th>${GOLPES.map(([g]) => `<td>${c[k]![g] ? num(c[k]![g]) : '·'}</td>`).join('')}</tr>`).join('');
  if (tabla) filas.push(`<table class="ta-combate obj-tabla"><thead><tr><td></td>${GOLPES.map(([, n, corto]) => `<th scope="col" title="${n}"><abbr title="${n}">${corto}</abbr></th>`).join('')}</tr></thead><tbody>${tabla}</tbody></table>`);
  const sueltas = [c.salud ? `Salud ${num(c.salud)}` : '', c.vida ? `Vida ${num(c.vida)}` : '', c.trote ? `Trote ${num(c.trote)}` : '', c.galope ? `Galope ${num(c.galope)}` : '', c.aguante ? `Aguante ${num(c.aguante)}` : ''].filter(Boolean);
  if (sueltas.length) filas.push(`<p class="obj-atributos">${sueltas.join(' · ')}</p>`);
  return filas.join('');
}

function htmlAccion(a: AccionDeObjeto, f: FichaObjeto, e: Escapar): string {
  switch (a.accion) {
    case 'equipar': return `<button class="btn-primary" type="button" data-obj-equipar="${a.casilla}" title="${a.vuelven ? `${a.vuelven === 1 ? 'La que llevas vuelve' : `Vuelven ${a.vuelven} piezas`} a la mochila` : 'El hueco estaba vacío'}">Ponérsela</button>${f.tipo === 'arma' && a.vuelven > 1 ? `<small class="obj-aviso">Cambia tu clase a ${e(nombreDeClase(f.clase ?? ''))}: ${a.vuelven - 1} pieza${a.vuelven > 2 ? 's' : ''} de armadura que no admite vuelve${a.vuelven > 2 ? 'n' : ''} a la mochila.</small>` : ''}`;
    case 'quitar': return `<button class="btn-secondary" type="button" data-obj-quitar="${a.hueco}">Quitársela</button>`;
    case 'usar': return a.escuadras
      ? `<label class="obj-campo"><span>A la escuadra</span><select class="form-input" data-obj-escuadra>${a.escuadras.map((s) => `<option value="${e(s.id)}">${e(s.nombre)} · nivel ${s.nivel}</option>`).join('')}</select></label><button class="btn-primary" type="button" data-obj-usar="${a.casilla}">Usarla</button>`
      : `<button class="btn-primary" type="button" data-obj-usar="${a.casilla}">${f.efecto?.monturaDe ? 'Abrir el cofre' : 'Usarla'}</button>`;
    case 'guardar': case 'sacar': {
      const verbo = a.accion === 'guardar' ? 'Guardar en el almacén' : 'Llevar a la mochila';
      const cuantas = a.cantidad > 1 ? `<input class="form-input obj-cantidad" type="number" min="1" max="${a.cantidad}" value="${a.cantidad}" data-obj-cantidad aria-label="Cuántas" />` : '';
      return `<span class="obj-mover">${cuantas}<button class="btn-secondary" type="button" data-obj-${a.accion}="${a.casilla}">${verbo}</button></span>`;
    }
  }
}

/** La ficha de la pieza elegida, con lo que se puede hacer con ella. */
function htmlFicha(p: ProyeccionJugador, e: Escapar): string {
  const h = p.heroe;
  if (!elegida) return `<p class="mapa-lista-vacia">Elige una pieza para ver su ficha.</p>`;
  const item = elegida.donde === 'equipo' ? h.equipamiento[elegida.clave as SlotEquipo] : piezasDe(h, elegida.donde).find((x) => x.casillaInventario === elegida!.clave);
  const f = item ? fichaDeObjeto(item.itemDefinitionId) : undefined;
  if (!item || !f) { elegida = null; return `<p class="mapa-lista-vacia">Elige una pieza para ver su ficha.</p>`; }
  const tier = f.tier ? `<span class="ta-rareza r-${e(claveDeRareza(f.tier))}">${e(textoDeTier(f.tier))}</span>` : '';
  const metal = f.metal && f.metal !== 'inicio' ? ` · ${e(f.metal.replace(/_/g, ' '))}` : '';
  const forjada = item.itemInstanceId ? `<p class="obj-forjada">✦ Forjada (${e(item.itemInstanceId)}): sus cifras, por la calidad que le salió.</p>` : '';
  const incompatible = f.tipo === 'armadura' && f.tipoArmadura && !pesosDeLaClase(h).includes(f.tipoArmadura)
    ? `<p class="obj-aviso">Tu clase (${e(nombreDeClase(h.classDefinitionId))}) no admite armadura ${e(f.tipoArmadura)}.</p>` : '';
  const efecto = f.tipo === 'consumible' ? `<p>${e(textoDeEfecto(f))}</p>` : f.tipo === 'material' ? `<p>${f.id === 'crisol' ? 'Se gasta al forjar: cada receta pide sus crisoles.' : `Se gasta al forjar una pieza de tier ${e(String(f.tier ?? f.id.replace('plano_', '')))}.`}</p>` : '';
  const acciones = accionesDe(p, elegida.donde, elegida.clave);
  const donde = elegida.donde === 'equipo' ? 'Puesta' : elegida.donde === 'mochila' ? `En la mochila, casilla ${item.casillaInventario + 1}` : `En el almacén de objetos, casilla ${item.casillaInventario + 1}`;
  return `<div class="obj-ficha-cab"><i aria-hidden="true">${iconoDeObjeto(f.id)}</i><div><h4>${e(f.nombre)}${item.cantidad > 1 ? ` ×${item.cantidad}` : ''}</h4><small>${e(textoDeTipo(f))}${metal}</small></div></div>
    <div class="obj-ficha-tier">${tier}<small>${e(donde)} · ${f.precio} monedas en la tienda</small></div>
    ${forjada}${htmlCifras(cifrasDe(item))}${efecto}${incompatible}
    ${acciones.length ? `<div class="obj-acciones">${acciones.map((a) => htmlAccion(a, f, e)).join('')}</div>` : ''}`;
}

/** Por qué no salen las acciones, en una línea arriba (lo que no se puede no se ofrece, pero se dice dónde sí). */
function htmlNotaDeLugar(p: ProyeccionJugador, e: Escapar): string {
  const m = motivoDeLugar(p);
  const notas = [m, libresEn(p.heroe, 'mochila') === 0 ? 'La mochila está llena: no se puede quitar ni sacar nada hasta hacer hueco.' : null].filter(Boolean) as string[];
  return notas.length ? `<p class="asent-lado-nota obj-lugar">${notas.map(e).join(' ')}</p>` : '';
}

export function htmlEquipoHeroe(p: ProyeccionJugador, e: Escapar): string {
  const h = p.heroe;
  const residencia = dentroDeSuResidencia(p);
  const enMochila = h.inventario.length, enAlmacen = (h.almacenObjetos ?? []).length;
  return `${htmlNotaDeLugar(p, e)}<div class="obj-pantalla">
    <section class="obj-col obj-col-equipo">
      <div class="obra-titulo"><span class="faction-kicker">Equipo</span><span class="obra-chip" title="La clase es la del arma que llevas">${e(nombreDeClase(h.classDefinitionId))}</span>${ayuda('base:equipo', 'Lo que lleva puesto tu héroe: el arma (siempre puesta; cambiarla cambia tu clase), cinco piezas de armadura del peso que admite tu clase y la montura. Lo que da el equipo lo suma la batalla. Se cambia dentro de una plaza, un pueblo o un campamento.')}</div>
      <div class="obj-huecos">${htmlHuecos(h, e)}</div>
    </section>
    <section class="obj-col obj-col-casillas">
      <div class="obra-titulo"><span class="faction-kicker">Mochila</span><span class="obra-chip" title="Casillas ocupadas">🎒 ${enMochila}/${casillasDe('mochila')}</span>${ayuda('base:mochila', 'Va contigo. Lo que llega sin pedirlo (el botín, un alijo, una diaria) entra aquí; si no cabe, a tu almacén de objetos, y si tampoco, se pierde.')}</div>
      ${htmlRejilla(h, 'mochila', e)}
      <div class="obra-titulo"><span class="faction-kicker">Almacén de objetos</span><span class="obra-chip" title="Casillas ocupadas">🗄 ${enAlmacen}/${casillasDe('almacen')}</span>${residencia ? '' : `<small class="obj-nota">Se abre dentro de tu residencia.</small>`}</div>
      ${htmlRejilla(h, 'almacen', e)}
    </section>
    <section class="obj-col obj-ficha">${htmlFicha(p, e)}<p class="faction-error" data-campo="error-objetos" role="alert"></p></section>
  </div>`;
}

export function cablearEquipoHeroe(panel: HTMLElement, ejecutar: Ejecutar, repintar: () => void): void {
  const error = (m: string | null): void => { const x = panel.querySelector<HTMLElement>('[data-campo="error-objetos"]'); if (x) x.textContent = m ?? ''; };
  panel.querySelectorAll<HTMLButtonElement>('[data-obj-ver]').forEach((b) => b.addEventListener('click', () => {
    const [donde, clave] = b.dataset.objVer!.split(':') as [DondeObjeto | 'equipo', string];
    const c = donde === 'equipo' ? clave as SlotEquipo : Number(clave);
    elegida = elegida?.donde === donde && elegida.clave === c ? null : { donde, clave: c };
    repintar();
  }));
  const orden = (selector: string, tipo: string, params: (b: HTMLButtonElement) => Record<string, unknown>, despues?: () => void): void =>
    panel.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const m = await ejecutar(tipo, params(b));
      if (m !== null) { b.disabled = false; error(m); } else despues?.();
    }));
  const cantidad = (b: HTMLButtonElement): number => {
    const x = b.parentElement?.querySelector<HTMLInputElement>('[data-obj-cantidad]');
    return x ? Math.max(1, Math.min(Number(x.max) || 1, Math.floor(Number(x.value) || 1))) : 1;
  };
  // lo que sale de su casilla deja de estar elegido: la ficha se vaciaría o enseñaría otra pieza
  const soltar = (): void => { elegida = null; };
  orden('[data-obj-equipar]', 'equiparObjeto', (b) => ({ casilla: Number(b.dataset.objEquipar) }), soltar);
  orden('[data-obj-quitar]', 'desequiparObjeto', (b) => ({ hueco: b.dataset.objQuitar }), soltar);
  orden('[data-obj-usar]', 'usarObjeto', (b) => {
    const esc = panel.querySelector<HTMLSelectElement>('[data-obj-escuadra]')?.value;
    return { casilla: Number(b.dataset.objUsar), ...(esc ? { escuadronId: esc } : {}) };
  });
  orden('[data-obj-guardar]', 'guardarObjeto', (b) => ({ casilla: Number(b.dataset.objGuardar), cantidad: cantidad(b) }), soltar);
  orden('[data-obj-sacar]', 'sacarObjeto', (b) => ({ casilla: Number(b.dataset.objSacar), cantidad: cantidad(b) }), soltar);
}

// ── Avisos ──

const ORIGEN_BOTIN: Record<string, string> = {
  unity: 'de la batalla', bandidos: 'del campamento de bandidos', diaria: 'de la diaria', alijo: 'del alijo', mercenario: 'por tu rango de mercenario', mision: 'de la misión',
};
const lista = (x: unknown): [string, number][] => (Array.isArray(x) ? x.filter((y): y is [string, number] => Array.isArray(y) && typeof y[0] === 'string').map(([o, n]) => [o, Number(n)]) : []);
const enPalabras = (l: [string, number][]): string => l.map(([o, n]) => `${n > 1 ? `${n} × ` : ''}${nombreDeObjeto(o)}`).join(', ');

/** El aviso de `heroe.botin { origen, mochila, almacen, perdido }`: qué fue a la mochila, qué al almacén y qué se perdió. */
export function textoDeBotinDeObjetos(payload: Record<string, unknown>): string {
  const de = ORIGEN_BOTIN[String(payload.origen)] ?? '';
  const [m, a, x] = [lista(payload.mochila), lista(payload.almacen), lista(payload.perdido)];
  const llega = m.length + a.length > 0;
  const partes = [m.length ? `a la mochila ${enPalabras(m)}` : '', a.length ? `al almacén de objetos (la mochila estaba llena) ${enPalabras(a)}` : '', x.length ? `${llega ? 'y ' : ''}se pierde ${enPalabras(x)}, que no cabía` : ''].filter(Boolean);
  return `Botín ${de}: ${partes.join('; ') || 'nada'}.`.replace(/\s+:/, ':');
}

/** El aviso de `heroe.objeto_usado { objeto, escuadra?, montura?, destino? }`. */
export function textoDeObjetoUsado(payload: Record<string, unknown>, escuadras: readonly Escuadron[]): string {
  const objeto = nombreDeObjeto(String(payload.objeto ?? ''));
  if (payload.montura) {
    const destino = payload.destino === 'almacen' ? 'va a tu almacén de objetos (la mochila estaba llena)' : payload.destino === 'perdido' ? 'se pierde: no cabía en la mochila ni en el almacén' : 'va a tu mochila';
    return `Abres el ${objeto}: sale un ${nombreDeObjeto(String(payload.montura))}, que ${destino}.`;
  }
  if (payload.escuadra !== undefined) {
    const id = String(payload.escuadra);
    const s = escuadras.find((x) => x.id === id || x.id === `esc-${id}`);
    return `Usas la ${objeto}${s ? ` con ${s.nombre}` : ''}.`;
  }
  return `Usas la ${objeto}.`;
}

/** Para las recompensas de misión de tipo `objeto`: su nombre y su icono. */
export const premioDeObjeto = (id: string): { icono: string; nombre: string } => ({ icono: iconoDeObjeto(id), nombre: nombreDeObjeto(id) });
