// CONSTRUIR de la plaza (0.109.0: el cajón que sustituye al riel al pulsar Construcción): la auto-construcción y la rejilla de edificios que se
// pueden poner en la cola, por tipos. Solo lo que se puede hacer (Víctor, 2026-11-03): sin cargo no hay nada, y lo que el cliente sabe que no se
// puede (único ya levantado, nivel de plaza, tecnología…) no sale; lo que no se puede pagar todavía sí, con el coste en rojo. Las obras en marcha
// y la cola van en el panel bajo el blasón (`htmlObrasHud`, ui/hudPlaza.ts), mejorar va en la ficha del edificio (ui/vistaCiudad.ts) y la
// producción en la ventana del Almacén. Aquí no se decide ninguna regla: el motor valida y su rechazo sale flotando.
// La barra de avance de las obras es una estimación: el motor manda solo cuándo acaba la obra; la duración sale del catálogo
// (`tiempoConstruccionMinutos`, la `obraMinutos` del nivel o `× MEJORA_EDIFICIO.multiplicadorPorNivel`), con las políticas de hoy
// (`factorTiempoConstruccion`) y, si se reconstruye, `OCUPACION.fraccionCosteReconstruccion`.
import { bloqueDeDatos, type ReglasPrestigio } from '../apiCliente';
import { EDIFICIO_NOMBRE, RECURSO_NOMBRE } from '../paletas';
import type { Asentamiento, Edificio } from '../tiposDominio';
import { estadoCliente } from './estadoCliente';
import { iconoEdificio } from './iconosEdificio';
import { ahora, chipsDeCoste, duracion } from './juegoVisual';
import { maximoPorPlaza, topeDeEdificiosLleno } from './recetasUnicas';

type Escapar = (valor: string) => string;
type Cargo = 'gobernador' | 'maestroObras' | null;

const nombreDe = (tipo: string): string => EDIFICIO_NOMBRE[tipo] ?? tipo;

/** Edificios que un Gobernador / Maestro de Obras puede añadir a mano (el backend gatea nivel, únicos y
 * topes; aquí solo se ofrece el catálogo). Fuera: centroUrbano, puestoMercado, los extractores de `mapa` y la Granja (motor e4923d4d: la ciudad
 * solo tiene la de la fundación, que se mejora; el trigo de más sale de las aldeas agrícolas). */
const EDIFICIOS_MANUALES = [
  'vivienda', 'almacen', 'granero', 'lenera',
  'barracon', 'galeriaDeTiro', 'palacio', 'mercado', 'albergueCaravanas', 'taberna',
  'fundicion', 'granFundicion', 'curtiduria', 'armeria', 'carpinteria', 'maravilla',
  'molino', 'horno', 'quesera', 'bodega', 'prensa',
] as const;

interface DefEdificio {
  costo?: Record<string, number>;
  requisitoNivelAsentamientoConstruccion?: number;
  requiereTecnologia?: string;
  nivelFaccionMinimo?: number;
  tiempoConstruccionMinutos?: number;
  niveles?: Record<string, { obraMinutos?: number; requiereEdificio?: string; requiereEdificioNivel?: number }>;
}

/** Por qué no se puede añadir ahora un edificio a la cola, como el motor (`anadir_manual`), o `''` si se puede. Lo que el cliente no sabe (sitio,
 * topes de almacenes y viviendas, cola llena, recursos) lo dice el motor al pedirlo. */
function motivoParaConstruir(a: Asentamiento, tipo: string, def: DefEdificio, cargo: 'gobernador' | 'maestroObras' | null): string {
  const p = estadoCliente.proyeccionUltima;
  if (!cargo) return 'Solo el Gobernador o el Maestro de Obras.';
  const hay = (a.edificios ?? []).some((e) => e.tipo === tipo);
  const unicos = bloqueDeDatos<string[]>('EDIFICIOS_UNICOS') ?? [];
  if (unicos.includes(tipo) && hay) return 'Solo puede haber uno.';
  const nivel = a.nivelActual ?? a.nivel;
  const pide = def.requisitoNivelAsentamientoConstruccion ?? 0;
  if (nivel < pide) return `Pide la plaza en nivel ${pide}.`;
  if (def.requiereTecnologia && !(p?.tecnologiasAdoptadas ?? []).includes(def.requiereTecnologia)) return `Pide la tecnología ${def.requiereTecnologia.replace(/_/g, ' ')}.`;
  // el edificio que pide su nivel 1, activo y con su nivel (el Albergue de caravanas, un Mercado: motor b5e27ace, `obra.falta_edificio`)
  const n1 = def.niveles?.['1'], pideNivel = n1?.requiereEdificioNivel ?? 1;
  if (n1?.requiereEdificio && !(a.edificios ?? []).some((e) => e.tipo === n1.requiereEdificio && e.estado === 'activo' && (e.nivelInterno ?? 1) >= pideNivel)) {
    return `Pide un ${nombreDe(n1.requiereEdificio)} activo${pideNivel > 1 ? ` de nivel ${pideNivel}` : ''}.`;
  }
  // Tanda 69 (Diplomacia_Facciones §3.5b): la Maravilla pide el prestigio de la Facción, y la estatua solo va en la capital, tantas como umbrales
  // de `PRESTIGIO.estatuas` alcance (contando las hechas y las que están en obra). Sin las reglas todavía, la estatua no sale.
  if (tipo === 'maravilla' || tipo === 'estatua') {
    const reglas = bloqueDeDatos<ReglasPrestigio>('PRESTIGIO');
    const faccion = p?.facciones.find((f) => f.id === p.faccionId);
    const prestigio = faccion?.prestigio ?? 0;
    if (tipo === 'maravilla' && reglas?.maravilla !== undefined && prestigio < reglas.maravilla) return `Pide ${reglas.maravilla} de prestigio de la Facción.`;
    if (tipo === 'estatua') {
      if ((faccion?.capitalId ?? p?.tecnologia?.capitalId) !== a.id) return 'Solo en la capital.';
      const umbrales = reglas?.estatuas ?? [];
      const caben = umbrales.filter((u) => prestigio >= u).length;
      if ((a.edificios ?? []).filter((e) => e.tipo === 'estatua').length >= caben) {
        const siguiente = umbrales[caben];
        return siguiente !== undefined ? `La siguiente estatua pide ${siguiente} de prestigio.` : 'Ya tiene todas las estatuas que da el prestigio.';
      }
    }
  }
  // Bodegas y prensas: tres de cada por plaza, contando la cola y las obras (motor b55e90f, `TALLERES_DE_UNA_RECETA.maximoPorPlaza`).
  if (topeDeEdificiosLleno(a, tipo)) return `Ya tiene las ${maximoPorPlaza(tipo)} que caben en una plaza.`;
  if (tipo === 'granFundicion') {
    const nivelFaccion = p?.facciones.find((f) => f.id === p.faccionId)?.nivel ?? 1;
    if (def.nivelFaccionMinimo && nivelFaccion < def.nivelFaccionMinimo) return `Pide la Facción en nivel ${def.nivelFaccionMinimo}.`;
    if (p?.tecnologia?.capitalId && p.tecnologia.capitalId !== a.id) return 'Solo en la capital.';
  }
  return '';
}


const catalogo = (): Record<string, DefEdificio> | null => bloqueDeDatos<Record<string, DefEdificio>>('EDIFICIO_CATALOGO');

/** El producto de los factores de las políticas activas de la plaza para ese campo (1 si no hay). */
function factorDePoliticas(a: Asentamiento, campo: string): number {
  const politicas = bloqueDeDatos<{ id: string; [k: string]: unknown }[]>('POLITICA_CATALOGO') ?? [];
  return (a.politicasActivas ?? []).reduce((t, x) => { const v = politicas.find((q) => q.id === x.politicaId)?.[campo]; return typeof v === 'number' ? t * v : t; }, 1);
}

/** Cuántos minutos dura la obra (o la mejora) de ese edificio, según el catálogo y las políticas de hoy; `null` sin catálogo. */
export function minutosDeObra(a: Asentamiento, e: Edificio): number | null {
  const def = catalogo()?.[e.tipo];
  if (!def) return null;
  const f = factorDePoliticas(a, 'factorTiempoConstruccion');
  const base = def.tiempoConstruccionMinutos ?? 0;
  if (e.mejora) {
    const n = e.mejora.nivelObjetivo;
    const mult = bloqueDeDatos<{ multiplicadorPorNivel?: number }>('MEJORA_EDIFICIO')?.multiplicadorPorNivel ?? 2;
    return Math.max(1, Math.round((def.niveles?.[String(n)]?.obraMinutos ?? base * mult ** (n - 1)) * f));
  }
  const reconstruir = e.danado ? bloqueDeDatos<{ fraccionCosteReconstruccion?: number }>('OCUPACION')?.fraccionCosteReconstruccion ?? 1 : 1;
  return Math.max(1, Math.round(base * f * reconstruir));
}

/** El avance (0 a 1) de la obra o la mejora en marcha de un edificio; `null` si no hay o no se sabe. */
export function avanceDeObra(a: Asentamiento, e: Edificio): number | null {
  const fin = e.mejora?.completaEn ?? (e.estado === 'en_construccion' ? e.completaEn : undefined);
  const minutos = minutosDeObra(a, e);
  if (typeof fin !== 'number' || !minutos) return null;
  return Math.max(0, Math.min(1, 1 - (fin - ahora()) / (minutos * 60_000)));
}

/** Los tipos de edificio para las pestañas de «Construir» (petición de Víctor, 2026-11-02). El catálogo del motor no los agrupa: es solo cómo se
 * enseñan. Un edificio nuevo del catálogo que no esté en ninguno cae en «Otros». */
const GRUPOS_CONSTRUIR: { id: string; nombre: string; icono: string; tipos: string[] }[] = [
  { id: 'ciudad', nombre: 'Ciudad', icono: 'vivienda', tipos: ['vivienda', 'almacen', 'granero', 'pozo', 'parque', 'plaza'] },
  { id: 'recursos', nombre: 'Recursos', icono: 'granja', tipos: ['granja', 'lenera'] },
  // los talleres de la comida de la tanda 69: pan de pesants y queso, vino y aceite de artesanos
  { id: 'comida', nombre: 'Comida', icono: 'horno', tipos: ['molino', 'horno', 'quesera', 'bodega', 'prensa'] },
  { id: 'talleres', nombre: 'Talleres', icono: 'fundicion', tipos: ['fundicion', 'granFundicion', 'curtiduria', 'armeria', 'carpinteria', 'patioDeGremios'] },
  { id: 'militar', nombre: 'Militar', icono: 'barracon', tipos: ['barracon', 'galeriaDeTiro', 'caballerizas', 'plazaDeArmas'] },
  { id: 'gobierno', nombre: 'Gobierno', icono: 'palacio', tipos: ['salaConsejo', 'palacio', 'taberna', 'mercado', 'albergueCaravanas', 'maravilla', 'estatua'] },
];
const grupoDe = (tipo: string): string => GRUPOS_CONSTRUIR.find((g) => g.tipos.includes(tipo))?.id ?? 'otros';

/** La pestaña de «Construir» elegida. Sin «Todos» desde 0.115.0 (Víctor, 2026-11-03): siempre hay un tipo elegido, de serie el primero que tiene
 * algo. Vive entre repintados. */
let grupoConstruir = '';

/** La Granja es única en la ciudad (motor e4923d4d, `EDIFICIOS_UNICOS`): con la de la fundación en pie no se ofrece otra. */
const hayGranja = (a: Asentamiento): boolean => (a.edificios ?? []).some((x) => x.tipo === 'granja');

/** Construir: pestañas por tipo (ciudad, recursos, comida, talleres, militar, gobierno) con cuántos se pueden levantar ya, y una casilla por edificio
 * con su icono y su coste. Solo los que se pueden pedir: los que el cliente sabe que no (`motivoParaConstruir`) no salen. Vacío sin cargo. */
/** Abre la pestaña de «Construir» donde está ese tipo (el «+» de la Vivienda en la barra de Población, 0.171.0). */
export function elegirGrupoDe(tipo: string): void { grupoConstruir = grupoDe(tipo); }

/** `destacar`: un tipo que hace falta (la Vivienda, cuando ya no cabe más gente): su casilla y su pestaña llevan el «!». */
export function htmlConstruir(a: Asentamiento, cargo: Cargo, esc: Escapar, destacar?: string): string {
  if (!cargo) return '';
  const cat = catalogo();
  const tipos = cat
    ? Object.keys(cat).filter((t) => Object.keys(cat[t]!.costo ?? {}).length > 0 && !t.startsWith('mina') && t !== 'cantera' && t !== 'corral' && !(t === 'granja' && hayGranja(a)))
    : [...EDIFICIOS_MANUALES];
  const info = tipos.map((t) => {
    const def = cat?.[t] ?? {};
    const motivo = cat ? motivoParaConstruir(a, t, def, cargo) : '';
    const coste = def.costo ?? {};
    const caro = Object.entries(coste).some(([r, n]) => (a.almacen?.[r]?.cantidad ?? 0) < n);
    return { t, def, motivo, coste, caro, grupo: grupoDe(t) };
  }).filter((x) => !x.motivo);
  const grupos = [...GRUPOS_CONSTRUIR, { id: 'otros', nombre: 'Otros', icono: 'centroUrbano', tipos: [] }].filter((g) => info.some((x) => x.grupo === g.id));
  if (!grupos.some((g) => g.id === grupoConstruir)) grupoConstruir = grupos[0]?.id ?? '';
  // En cada pestaña, cuántos se pueden poner ya en la cola (sin candado y con qué pagarlos).
  const listos = (id: string): number => info.filter((x) => x.grupo === id && !x.motivo && !x.caro).length;
  const pestana = (id: string, nombre: string, icono: string): string => {
    const n = listos(id);
    const falta = destacar !== undefined && grupoDe(destacar) === id && info.some((x) => x.t === destacar);
    return `<button class="obra-grupo${grupoConstruir === id ? ' activo' : ''}${falta ? ' destaca' : ''}" type="button" data-grupo-construir="${esc(id)}" title="${esc(`${nombre}: ${n} para construir ya`)}" aria-pressed="${grupoConstruir === id}">
      <span class="obra-grupo-icono">${icono}</span><span class="obra-grupo-nombre">${esc(nombre)}</span>${n ? `<span class="obra-grupo-n">${n}</span>` : ''}${falta ? '<b class="asent-aviso-atencion" aria-hidden="true">!</b>' : ''}
    </button>`;
  };
  const pestanas = `<div class="obra-grupos" role="tablist">${grupos.map((g) => pestana(g.id, g.nombre, iconoEdificio(g.icono, 20))).join('')}</div>`;
  const casillas = info.filter((x) => x.grupo === grupoConstruir).map(({ t, def, coste, caro }) => {
    const tiempo = def.tiempoConstruccionMinutos ? ` · ${duracion(Math.round(def.tiempoConstruccionMinutos * factorDePoliticas(a, 'factorTiempoConstruccion')))}` : '';
    const costeTexto = Object.entries(coste).map(([r, n]) => `${n} ${RECURSO_NOMBRE[r] ?? r}`).join(', ');
    const titulo = `${nombreDe(t)}${costeTexto ? ` · ${costeTexto}` : ''}${tiempo}${caro ? ' · No hay bastante en el almacén' : ''}`;
    return `<button class="obra-construir${caro ? ' caro' : ''}${t === destacar ? ' destaca' : ''}" type="button" data-construir="${esc(t)}" title="${esc(titulo)}" aria-label="${esc(titulo)}">
      ${t === destacar ? '<b class="asent-aviso-atencion" aria-hidden="true">!</b>' : ''}<span class="obra-construir-icono">${iconoEdificio(t, 30)}</span>
      <span class="obra-construir-nombre">${esc(nombreDe(t))}</span>
      <span class="obra-construir-coste">${chipsDeCoste(a, coste, esc, 2)}</span>
    </button>`;
  });
  return `${pestanas}
    <div class="obra-construir-rejilla">${casillas.join('') || '<p class="mapa-lista-vacia">Ahora no hay nada que se pueda construir aquí.</p>'}</div>`;
}

/** Los edificios ya construidos de la plaza, por tipo (los activos). */
function construidosPorTipo(a: Asentamiento): Map<string, Edificio[]> {
  const porTipo = new Map<string, Edificio[]>();
  for (const e of a.edificios) if (e.estado === 'activo') porTipo.set(e.tipo, [...(porTipo.get(e.tipo) ?? []), e]);
  return porTipo;
}

/** Cuántos edificios construidos tiene la plaza (lo que dice el botón «Construidos» del cajón). */
export const cuantosConstruidos = (a: Asentamiento): number => a.edificios.filter((e) => e.estado === 'activo').length;

/** Un cuadrito de un tipo construido: su icono, su nombre, cuántos hay (×N) y su nivel (el más alto). Un clic elige en la vista 3D uno de ese
 * tipo, y el siguiente clic el siguiente (`data-construido` = sus ids). */
function casillaConstruido(t: string, lista: Edificio[], esc: Escapar): string {
  const niveles = lista.map((e) => e.nivelInterno ?? 1);
  const max = Math.max(...niveles), min = Math.min(...niveles);
  const mejorando = lista.filter((e) => e.mejora).length, danados = lista.filter((e) => e.danado).length;
  const notas = [mejorando ? `${mejorando} mejorándose` : '', danados ? `${danados} dañado${danados > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  const titulo = `${nombreDe(t)}${lista.length > 1 ? ` ×${lista.length}` : ''} · nivel ${min === max ? max : `${min} a ${max}`}${notas ? ` · ${notas}` : ''}`;
  return `<button type="button" class="construido${danados ? ' danado' : ''}${mejorando ? ' mejorando' : ''}" data-construido="${esc(lista.map((e) => e.id).join(' '))}" title="${esc(titulo)}" aria-label="${esc(titulo)}">
      <span class="construido-icono">${iconoEdificio(t, 24)}</span><span class="construido-nombre">${esc(nombreDe(t))}</span>${lista.length > 1 ? `<b class="construido-n">×${lista.length}</b>` : ''}<b class="construido-nivel">${max}</b></button>`;
}

/** La ventana «Construidos» del cajón de Construcción (Víctor, 2026-11-06; antes, 0.153.0, una barra abajo del cajón): sube desde el cajón con su
 * mismo ancho y enseña los edificios ya construidos agrupados como las pestañas de Construir (Ciudad, Recursos, Talleres, Militar, Gobierno), un
 * cuadrito por tipo. Por tipo y no uno a uno: una plaza grande tiene cientos de viviendas. */
export function htmlConstruidosVentana(a: Asentamiento, esc: Escapar): string {
  const porTipo = construidosPorTipo(a);
  if (!porTipo.size) return '';
  const grupos = [...GRUPOS_CONSTRUIR, { id: 'otros', nombre: 'Otros', icono: '', tipos: [] as string[] }];
  const secciones = grupos.map((g) => {
    const tipos = [...porTipo.keys()].filter((t) => grupoDe(t) === g.id).sort((x, y) => {
      const ix = g.tipos.indexOf(x), iy = g.tipos.indexOf(y);
      return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) || nombreDe(x).localeCompare(nombreDe(y), 'es');
    });
    if (!tipos.length) return '';
    const n = tipos.reduce((t, x) => t + porTipo.get(x)!.length, 0);
    return `<section class="construidos-grupo"><h3>${g.icono ? iconoEdificio(g.icono, 16) : ''}<span>${esc(g.nombre)}</span><small>${n}</small></h3>
      <div class="construidos-fila">${tipos.map((t) => casillaConstruido(t, porTipo.get(t)!, esc)).join('')}</div></section>`;
  }).join('');
  return `<div class="construidos-cab"><h2>Construidos <small>${cuantosConstruidos(a)}</small></h2><button type="button" class="construidos-cerrar" data-construidos-cerrar aria-label="Cerrar">✕</button></div>
    <div class="construidos-cuerpo">${secciones}</div>`;
}

/** Con varios del mismo tipo, cada clic en su cuadrito elige el siguiente. */
const siguienteConstruido = new Map<string, number>();
export function construidoAlClicar(ids: string): string {
  const lista = ids.split(' ').filter(Boolean);
  const k = siguienteConstruido.get(ids) ?? 0;
  siguienteConstruido.set(ids, (k + 1) % lista.length);
  return lista[k % lista.length]!;
}

/** Las pestañas de «Construir»: cambian el tipo que se ve y repintan. */
export function cablearPanelObras(raiz: ParentNode, repintar: () => void): void {
  raiz.querySelectorAll<HTMLButtonElement>('[data-grupo-construir]').forEach((b) => b.addEventListener('click', () => { grupoConstruir = b.dataset.grupoConstruir!; repintar(); }));
}
