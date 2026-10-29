// El adaptador de lectura (decisión del autor, 2026-10-26): lo que guarda el almacén de la sesión del contrato 05, convertido a la
// `ProyeccionJugador` que ya leen los paneles (la del REST del backend TypeScript). Las unidades se pasan aquí y en ningún otro sitio:
// el contrato viaja en milésimas (espacio, cantidades, ritmos) y sus instantes cuentan desde 2026-01-01; la interfaz trabaja en unidades
// y en ms de época Unix, como antes.
//
// Lo que el contrato no trae, o aún no está traducido, sale vacío (listas) o ausente (opcionales): los paneles ya lo toleran porque el
// backend viejo tampoco lo mandaba siempre.
import type { Almacen, Cuerpo, CuerpoDe } from '../contrato/almacen';
import type { Punto, Ritmo, Cantidades } from '../contrato/gen/bronzeage/v1/common_pb';
import { TipoEntidad } from '../contrato/gen/bronzeage/v1/common_pb';
import * as pb from '../contrato/gen/bronzeage/v1/entities_pb';
import type { Bienvenida } from '../contrato/gen/bronzeage/v1/session_pb';
import type { ProyeccionJugador, PartidaSinHeroe } from '../apiCliente';
import type * as d from '../tiposDominio';

/** 2026-01-01T00:00:00Z: el cero de los instantes del contrato (common.proto). */
export const EPOCA_CONTRATO = Date.UTC(2026, 0, 1);

// ─────────────────────────── unidades ───────────────────────────

/** Un instante del contrato a ms de época Unix (la forma de siempre de la interfaz). */
export const instante = (ms: bigint | undefined): number | undefined => (ms === undefined ? undefined : Number(ms) + EPOCA_CONTRATO);
/** Y al revés: lo que la interfaz da a lo que el contrato espera. */
export const aContrato = (ms: number): bigint => BigInt(Math.round(ms - EPOCA_CONTRATO));

const mil = (v: bigint | number | undefined): number => Number(v ?? 0) / 1000;
const punto = (p: Punto | undefined): d.Point => ({ x: mil(p?.x), y: mil(p?.y) });
const cantidades = (c: Cantidades | undefined): Record<string, number> =>
  Object.fromEntries(Object.entries(c?.porId ?? {}).map(([k, v]) => [k, mil(v)]));
const opcional = <T>(v: T | undefined | null): T | undefined => (v === undefined || v === null || v === '' ? undefined : v);

/** El valor de un ritmo en el instante de mundo `ahora` (ms del contrato), en unidades. En escalones no se interpola. */
export function valorDeRitmo(r: Ritmo | undefined, ahora: number): number {
  if (!r) return 0;
  let v = Number(r.valorEnT0);
  if (!r.enEscalones) v += (Number(r.porMinuto) * (ahora - Number(r.t0Ms))) / 60_000;
  if (r.maximo !== undefined) v = Math.min(v, Number(r.maximo));
  if (r.minimo !== undefined) v = Math.max(v, Number(r.minimo));
  return v / 1000;
}

/** Dónde está quien sigue un plan en `ahora` (ms del contrato), y lo que le queda de ruta: empieza en la posición de ahora (como la `ruta` del
 * backend TypeScript), así que en marcha tiene siempre dos puntos o más, también en el último tramo. */
export function evaluarPlan(plan: pb.Ejercito['plan'], posicion: Punto | undefined, ahora: number): { posicion: d.Point; ruta: d.Point[] } {
  const v = plan?.vertices ?? [];
  if (v.length === 0) return { posicion: punto(posicion), ruta: [] };
  const t = (i: number) => Number(v[i]!.enMs);
  if (ahora <= t(0)) return { posicion: punto(v[0]!.p), ruta: v.map((x) => punto(x.p)) };
  for (let i = 1; i < v.length; i++) {
    if (ahora < t(i)) {
      const f = (ahora - t(i - 1)) / Math.max(1, t(i) - t(i - 1));
      const a = punto(v[i - 1]!.p), b = punto(v[i]!.p);
      const aqui = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      return { posicion: aqui, ruta: [aqui, ...v.slice(i).map((x) => punto(x.p))] };
    }
  }
  return { posicion: punto(v[v.length - 1]!.p), ruta: [] };
}

function hex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += (b[i]! < 16 ? '0' : '') + b[i]!.toString(16);
  return s;
}

// ─────────────────────────── entidades ───────────────────────────

const ESTADO_EDIFICIO: Record<number, d.Edificio['estado']> = { 1: 'en_cola', 2: 'en_construccion', 3: 'activo' };
const GRUPO_PUERTA: Record<number, d.GrupoPuerta> = { 1: 'neutrales', 2: 'aliados', 3: 'enemigos', 4: 'aedas' };
const CLASE_CELDA: Record<number, d.CeldaMuro['clase']> = { 1: 'muro', 2: 'puerta', 3: 'torre' };
const TIPO_RELACION: Record<number, string> = { 1: 'vasallaje', 2: 'alianza', 3: 'guerra' };
const POLITICA_UNION: Record<number, 'rechazar' | 'aceptar' | 'preguntar'> = { 1: 'rechazar', 2: 'aceptar', 3: 'preguntar' };
const ESTADO_CARAVANA: Record<number, NonNullable<d.Caravana['estado']>> = { 1: 'disponible', 2: 'preparando', 3: 'adjunta', 4: 'aparcada', 5: 'en_transito', 6: 'retornando' };
const TIPO_CARAVANA: Record<number, NonNullable<d.Caravana['tipo']>> = { 1: 'comercial', 2: 'construccion', 3: 'comercial', 4: 'acarreo' };
const ESTADO_TRUEQUE: Record<number, d.AcuerdoTrueque['estado']> = { 1: 'propuesto', 2: 'activo', 3: 'rechazado', 4: 'cumplido', 5: 'expirado' };
const ESTADO_ORDEN: Record<number, d.OrdenMercado['estado']> = { 1: 'activa', 2: 'cumplida', 3: 'expirada' };

function sigilo(s: pb.Faccion['sigilo']): d.Sigilo {
  return {
    formaId: s?.formaId ?? '', campoId: s?.campoId ?? '', emblemaId: s?.emblemaId ?? '', colorPrimarioId: s?.colorPrimarioId ?? '',
    colorSecundarioId: s?.colorSecundarioId ?? '', colorEmblemaId: s?.colorEmblemaId ?? '', orlaId: s?.orlaId ?? '', colorOrlaId: s?.colorOrlaId ?? '',
  };
}

function faccion(f: pb.Faccion, ahora: number): d.Faccion {
  return {
    id: f.id, nombre: f.nombre, sigilo: sigilo(f.sigilo), reyId: f.reyId ?? null, embajadorId: f.embajadorId ?? null, nivel: f.nivel,
    experiencia: mil(f.experiencia), ciudadanosIds: f.ciudadanosIds, solicitudesIds: f.solicitudesIds, reputacion: valorDeRitmo(f.reputacion, ahora),
    admiteOtrasEnAtaques: f.admiteOtrasEnAtaques, capitalDesignadaEn: instante(f.capitalDesignadaEnMs),
    capitalId: f.capitalId, derrotadaPor: f.derrotadaPor,
    liga: f.liga ? { miembrosIds: f.liga.miembrosIds, tieneVasallaje: f.liga.tieneVasallaje, granReyId: f.liga.granReyId } : undefined,
    miembros: f.miembros.length ? f.miembros.map((m) => ({ heroeId: m.heroeId, residenciaId: m.residenciaId, cargos: m.cargos, participacion: Number(m.participacion) })) : undefined,
    tablon: f.tablon ? tablon(f.tablon) : undefined,
  };
}

const ESTADO_RECURRENTE: Record<number, d.EstadoRecurrente> = { 1: 'en_curso', 2: 'cumplida', 3: 'reclamada', 4: 'caducada' };
const condicionesRecurrentes = (cs: pb.CondicionMision[]): d.CondicionRecurrente[] => cs.map((c) => ({ contador: c.contador, avance: Number(c.avance), umbral: Number(c.umbral) }));

function definicionRecurrente(x: pb.DefinicionMisionRecurrente): d.DefinicionRecurrente {
  return {
    id: x.id, duracion: x.duracion === pb.DuracionMision.MISION_SEMANAL ? 'semanal' : 'diaria', tipo: x.tipo === pb.TipoMision.MISION_GRUPAL ? 'grupal' : 'individual',
    limiteSemanal: x.limiteSemanal, cargo: x.cargo, condiciones: condicionesRecurrentes(x.condiciones), experiencia: mil(x.experiencia),
    participacion: Number(x.participacion), oro: mil(x.oro), titulo: x.titulo, texto: x.texto, explicacion: x.explicacion,
  };
}

function tablon(t: pb.Tablon): d.Tablon {
  return {
    misiones: t.misiones.filter((m) => m.definicion).map((m) => ({
      definicion: definicionRecurrente(m.definicion!), desde: instante(m.desdeMs)!, hasta: instante(m.hastaMs)!,
      aceptaciones: m.aceptaciones.map((a) => ({ heroeId: a.heroeId, estado: ESTADO_RECURRENTE[a.estado] ?? 'en_curso', condiciones: condicionesRecurrentes(a.condiciones) })),
      aceptadasSemana: m.aceptadasSemana, estado: ESTADO_RECURRENTE[m.estado], condiciones: condicionesRecurrentes(m.condiciones),
      aportes: Object.fromEntries(Object.entries(m.aportes).map(([k, v]) => [k, Number(v)])),
    })),
    diariasIds: t.diariasIds, semanalesIds: t.semanalesIds, conEleccion: t.conEleccion, elegidasDiariasIds: t.elegidasDiariasIds, elegidasSemanalesIds: t.elegidasSemanalesIds,
    renovacionDiaria: instante(t.renovacionDiariaMs)!, renovacionSemanal: instante(t.renovacionSemanalMs)!, catalogo: t.catalogo.map(definicionRecurrente),
  };
}

function edificio(e: pb.Edificio): d.Edificio {
  return {
    id: e.id, tipo: e.tipo, estado: ESTADO_EDIFICIO[e.estado] ?? 'activo', ambito: e.ambito === pb.AmbitoEdificio.MAPA ? 'mapa' : 'asentamiento',
    // El sitio viaja en milésimas de unidad LOCAL de la plaza.
    posicion: punto(e.posicion), nivelInterno: e.nivelInterno, completaEn: instante(e.completaEnMs), prioridad: e.prioridad, fuenteId: e.fuenteId,
    pausadoPorAlmacenLleno: e.pausadoPorAlmacenLleno || undefined, danado: e.danado || undefined,
    mejora: e.mejora ? { nivelObjetivo: e.mejora.nivelObjetivo, completaEn: instante(e.mejora.completaEnMs)! } : undefined,
  };
}

function recinto(r: pb.Recinto): d.Recinto {
  return {
    id: r.id, nivel: r.nivel, avance: r.avance, mejorandoA: r.mejorandoA, mejoradas: r.mejoradas, siguienteCeldaEn: instante(r.siguienteCeldaEnMs),
    celdas: r.celdas.map((c) => ({ col: c.col, row: c.fila, clase: CLASE_CELDA[c.clase] ?? 'muro' })),
  };
}

function asentamiento(a: pb.Asentamiento, ahora: number): d.Asentamiento {
  return {
    id: a.id, nombre: a.nombre, faccionId: a.faccionId, posicion: punto(a.posicion), nivel: a.nivel, nivelActual: a.nivelActual,
    zonaReal: a.zona.length ? a.zona.map(punto) : undefined,
    medidorMantenimiento: a.medidorMantenimiento ? valorDeRitmo(a.medidorMantenimiento, ahora) : undefined,
    ocupacionHasta: instante(a.ocupacionHastaMs),
    poblacion: a.poblacion
      ? { pesants: valorDeRitmo(a.poblacion.pesants, ahora), artesanos: valorDeRitmo(a.poblacion.artesanos, ahora), nobleza: valorDeRitmo(a.poblacion.nobleza, ahora) }
      : undefined,
    nutricionPoblacion: a.nutricion ? valorDeRitmo(a.nutricion, ahora) : undefined,
    rachaMantenimientoSano: a.rachaMantenimientoSano,
    almacen: Object.keys(a.almacen).length
      ? Object.fromEntries(Object.entries(a.almacen).map(([k, x]) => [k, { cantidad: valorDeRitmo(x.cantidad, ahora), capacidad: mil(x.capacidad), porMinuto: mil(x.cantidad?.porMinuto), producido: mil(x.producidoPorMinuto), consumido: mil(x.consumidoPorMinuto) }]))
      : undefined,
    edificios: a.edificios.map(edificio),
    permiteReabastecerAliados: a.permiteReabastecerAliados || undefined,
    autoConstruccionPausada: a.autoConstruccionPausada || undefined,
    recetasPausadas: a.recetasPausadas.length ? a.recetasPausadas : undefined,
    reservaManual: a.reservaManual ? cantidades(a.reservaManual) : undefined,
    politicasActivas: a.politicasActivas.map((p) => ({ id: p.id, politicaId: p.politicaId, cargo: p.cargo, activadaEn: instante(p.activadaEnMs)!, expiraEn: instante(p.expiraEnMs)! })),
    ultimaCaravanaCreadaEn: instante(a.ultimaCaravanaCreadaEnMs),
    heroesFundadoresIds: a.fundadoresIds,
    casasCompradas: a.casasCompradas,
    cargos: a.cargos
      ? { gobernadorId: a.cargos.gobernadorId ?? null, maestroObrasId: a.cargos.maestroObrasId ?? null, tesoreroId: a.cargos.tesoreroId ?? null, generalId: a.cargos.generalId ?? null, sacerdoteId: a.cargos.sacerdoteId ?? null }
      : undefined,
    recintos: a.recintos.map(recinto),
    ascenso: a.ascenso ? { nivelObjetivo: a.ascenso.nivelObjetivo, iniciadoEn: instante(a.ascenso.iniciadoEnMs)!, completaEn: instante(a.ascenso.completaEnMs)! } : undefined,
    puertaCerradaA: a.puertaCerradaA.length ? a.puertaCerradaA.map((g) => GRUPO_PUERTA[g]!).filter(Boolean) : undefined,
    vetadosIds: a.vetadosIds.length ? a.vetadosIds : undefined,
    capitalDeFaccionId: a.capitalDeFaccionId,
    participacion: Object.keys(a.participacion).length ? Object.fromEntries(Object.entries(a.participacion).map(([k, v]) => [k, Number(v)])) : undefined,
    tablon: a.tablon ? tablon(a.tablon) : undefined,
  };
}

/** La ciudad que se dibuja: las calles y caminos del trazado, la huella de cada edificio y las murallas de sus recintos (en unidades locales). */
function trazado(a: pb.Asentamiento): d.TrazadoAsentamiento | undefined {
  const t = a.trazado;
  if (!t) return undefined;
  const rect = (r: pb.RectLocal): d.RectanguloLocal => ({ x: r.x, y: r.y, ancho: r.ancho, alto: r.alto });
  const huellas: Record<string, d.RectanguloLocal> = {};
  for (const e of a.edificios) {
    if (!e.ancho || !e.alto) continue;
    const c = punto(e.posicion);
    huellas[e.id] = { x: c.x - e.ancho / 2, y: c.y - e.alto / 2, ancho: e.ancho, alto: e.alto };
  }
  const T = t.unidadesPorCelda || 3;
  const celda = (c: pb.CeldaMuro): d.RectanguloLocal => ({ x: c.col * T, y: c.fila * T, ancho: T, alto: T });
  const murallas: d.TrazadoMuralla[] = a.recintos.map((r) => {
    const enPie = r.celdas.slice(0, r.avance);
    const de = (clase: pb.ClaseCelda) => enPie.filter((c) => c.clase === clase).map(celda);
    return {
      nivel: r.nivel,
      integridad: r.celdas.length ? r.avance / r.celdas.length : 0,
      muro: de(pb.ClaseCelda.CELDA_MURO),
      puertas: de(pb.ClaseCelda.CELDA_PUERTA),
      torres: de(pb.ClaseCelda.CELDA_TORRE),
      planificado: r.celdas.slice(r.avance).map(celda),
    };
  });
  return { calles: t.calles.map(rect), caminos: t.caminos.map(rect), huellas, murallas };
}

function ejercito(e: pb.Ejercito, ahora: number): d.Ejercito {
  const { posicion, ruta } = evaluarPlan(e.plan, e.posicion, ahora);
  const marcha = ruta.length > 0;
  return {
    id: e.id, dentroDe: opcional(e.dentroDe), faccionId: e.faccionId, origenAsentamientoId: '', escuadronIds: e.escuadronIds,
    participantes: e.participantes.map((p) => ({ heroeId: p.heroeId, unidoEn: instante(p.unidoEnMs)! })),
    ruta, posicionActual: posicion, estado: marcha ? 'marchando' : 'estacionado',
    caravanasAdjuntasIds: e.caravanasAdjuntasIds, suministro: cantidades(e.suministro), capacidadCarga: undefined,
    tipo: e.tipo === pb.TipoColumna.COLUMNA_EJERCITO ? 'ejercito' : 'personal', liderId: opcional(e.liderId),
    formacion: e.formacionExpiraEnMs !== undefined ? { expiraEn: instante(e.formacionExpiraEnMs)! } : undefined,
    politicaDeUnion: POLITICA_UNION[e.politicaDeUnion],
    peticionesDeUnion: e.peticionesDeUnion.map((p) => ({ heroeId: p.heroeId, pedidoEn: instante(p.pedidoEnMs)!, expiraEn: instante(p.expiraEnMs)! })),
    marchaForzada: e.marchaForzada, caravanaFundacionId: opcional(e.caravanaFundacionId),
    persiguiendo: e.persiguiendo ? { tipo: e.persiguiendo.presaEsCaravana ? 'caravana' : 'ejercito', id: e.persiguiendo.presaId } : undefined,
  };
}

function caravana(c: pb.Caravana, ahora: number): d.Caravana {
  const { posicion, ruta } = evaluarPlan(c.plan, c.posicion, ahora);
  return {
    id: c.id, origenAsentamientoId: c.origenAsentamientoId, destinoAsentamientoId: c.destinoAsentamientoId, posicionActual: posicion, ruta,
    estado: ESTADO_CARAVANA[c.estado], tipo: TIPO_CARAVANA[c.tipo], origenCampamentoId: c.origenCampamentoId, faccionId: c.faccionId, titularId: c.titularId,
    escoltaIds: c.escoltaIds, carros: c.carros.map((x) => ({ tipoCarro: x.tipoCarro as 'basico' | 'reforzado', animal: x.animal as 'buey' | 'caballo' | 'camello' | undefined })),
    reservadaManual: c.reservadaManual, contenido: cantidades(c.contenido), caducaEn: instante(c.caducaEnMs), preparaHasta: instante(c.preparaHastaMs),
  };
}

const TIPO_OBRA: Record<number, d.ObraDeMapa['tipo']> = { 1: 'pueblo', 2: 'avanzada', 3: 'mejoraAvanzada', 4: 'reparacion', 5: 'aldea', 6: 'mejoraAldea' };

function pueblo(x: pb.Pueblo, propio: boolean, ahora: number): d.PuebloDeMapa {
  const almacen: Record<string, number> = {};
  for (const [r, e] of Object.entries(x.almacenPorRecurso)) almacen[r] = valorDeRitmo(e.cantidad, ahora);
  if (Object.keys(almacen).length === 0 && x.almacenLocal) almacen[''] = valorDeRitmo(x.almacenLocal.cantidad, ahora);
  return {
    id: x.id, madreId: x.asentamientoMadreId, propio, tipo: x.tipoExtractor, nodoId: opcional(x.nodoId), posicion: punto(x.posicion),
    almacen, capacidad: mil(x.almacenLocal?.capacidad), carroId: opcional(x.carroAcarreoId), guarnicionId: opcional(x.guarnicionEscuadronId), guarnicionReponeEn: instante(x.guarnicionReponeEnMs),
    batallaId: opcional(x.batallaId), nivelAldea: x.nivelAldea, fertilidad: x.fertilidad === undefined ? undefined : mil(x.fertilidad),
    rebano: x.rebanoEspecie ? { especie: x.rebanoEspecie, cabezas: mil(x.rebanoCabezas) } : undefined,
    guarnicionJugadoresIds: x.guarnicionJugadoresIds, cupoGuarnicionPorHeroe: x.cupoGuarnicionPorHeroe ? Number(x.cupoGuarnicionPorHeroe) : undefined,
  };
}

function obraDeMapa(o: pb.ObraDeMapa, propia: boolean): d.ObraDeMapa {
  return {
    id: o.id, madreId: o.asentamientoMadreId, propia, tipo: TIPO_OBRA[o.tipo] ?? 'pueblo', posicion: punto(o.posicion), nodoId: opcional(o.nodoId),
    destinoId: opcional(o.destinoId), requerido: cantidades(o.requerido), entregado: cantidades(o.entregado), terminaEn: instante(o.terminaEnMs),
  };
}

const ESTADO_MISION: Record<number, d.Mision['estado']> = { 1: 'activa', 2: 'cumplida', 3: 'reclamada' };

function mision(m: pb.Mision): d.Mision {
  return {
    id: m.id, estado: ESTADO_MISION[m.estado] ?? 'activa', previa: opcional(m.previa),
    condiciones: m.condiciones.map((c) => ({ contador: c.contador, avance: Number(c.avance), umbral: Number(c.umbral) })),
    recompensa: cantidades(m.recompensa), recompensaExperiencia: mil(m.recompensaExperiencia),
  };
}

function escuadron(e: pb.Escuadron, ahora: number): d.Escuadron {
  const c = e.contenedor?.donde;
  const contenedor: d.Escuadron['contenedor'] =
    c?.case === 'ejercitoId' ? { tipo: 'ejercito', ejercitoId: c.value } : c?.case === 'caravanaId' ? { tipo: 'escolta', caravanaId: c.value } : c?.case === 'puebloId' ? { tipo: 'pueblo', puebloId: c.value } : c?.case === 'fuera' ? { tipo: 'fuera' } : { tipo: 'campamento' };
  return {
    id: e.id, nombre: e.nombre, heroeId: e.heroeId, tropaId: e.tropaId, origen: e.origen as d.Escuadron['origen'], cantidad: e.cantidad, nivel: e.nivel,
    experiencia: mil(e.experiencia), moral: valorDeRitmo(e.moral, ahora), contenedor,
    prestada: e.prestadaPorCampamentoId ? { campamentoId: e.prestadaPorCampamentoId } : undefined,
    enGuarnicion: e.enGuarnicion, habilidadesDesbloqueadas: e.habilidadesDesbloqueadas, formacionesDesbloqueadas: e.formacionesDesbloqueadas,
    formacionSeleccionada: e.formacionSeleccionada, costeLiderazgo: e.cantidad,
  };
}

function item(i: pb.ItemInstancia): d.ItemInstancia {
  return {
    itemDefinitionId: i.itemDefinitionId, tipo: i.tipo as d.ItemInstancia['tipo'], cantidad: i.cantidad, itemInstanceId: i.itemInstanceId,
    estadisticas: i.estadisticas.map((s) => ({ nombre: s.nombre, valor: Number(s.valor) })), precio: i.precio, casillaInventario: i.casillaInventario,
  };
}

function ubicacion(u: pb.Heroe['ubicacion']): d.HeroeProyectado['ubicacion'] {
  const x = u?.donde;
  switch (x?.case) {
    case 'asentamientoId': return { tipo: 'asentamiento', asentamientoId: x.value };
    case 'ejercitoId': return { tipo: 'columna', ejercitoId: x.value };
    case 'campamentoId': return { tipo: 'mercenarios', campamentoId: x.value };
    case 'desconectadoEn': return { tipo: 'desconectado', punto: punto(x.value) };
    case 'puebloId': return { tipo: 'pueblo', puebloId: x.value };
    case 'avanzadaId': return { tipo: 'avanzada', avanzadaId: x.value };
    default: return { tipo: 'desconectado', punto: { x: 0, y: 0 } };
  }
}

function heroe(h: pb.Heroe, escuadrones: pb.Escuadron[], ahora: number): d.HeroeProyectado {
  const eq = h.equipamiento;
  const propias = escuadrones.filter((e) => e.heroeId === h.id);
  return {
    id: h.id, jugadorId: h.jugadorId ?? null, controlador: h.esBot ? 'bot' : 'humano', displayName: h.displayName, classDefinitionId: h.classDefinitionId,
    genero: h.femenino ? 'femenino' : 'masculino',
    avatar: { cabezaId: h.avatar?.cabezaId ?? '', peloId: h.avatar?.peloId ?? '', barbaId: h.avatar?.barbaId ?? '', cejasId: h.avatar?.cejasId ?? '' },
    liderazgoBase: h.liderazgoBase, ubicacion: ubicacion(h.ubicacion),
    almacenPersonal: cantidades(h.almacenPersonal), capacidadAlmacenPersonal: mil(h.capacidadAlmacenPersonal), carro: cantidades(h.fueraCarro),
    viveres: h.viveres ? valorDeRitmo(h.viveres, ahora) : undefined,
    escuadrones: propias.map((e) => escuadron(e, ahora)),
    nivel: h.nivel, experienciaHaciaSiguienteNivel: Number(h.experienciaHaciaSiguienteNivel),
    puntosDeAtributoSinGastar: h.puntosDeAtributoSinGastar, puntosDePerkSinGastar: h.puntosDePerkSinGastar,
    atributosBase: { fuerza: h.atributosBase?.fuerza ?? 0, destreza: h.atributosBase?.destreza ?? 0, armadura: h.atributosBase?.armadura ?? 0, vitalidad: h.atributosBase?.vitalidad ?? 0 },
    perksDesbloqueados: h.perksDesbloqueados,
    loadouts: h.loadouts.map((l) => ({ id: l.id, displayName: l.displayName, squadIds: l.squadIds, perksSeleccionados: l.perksSeleccionados, activo: l.activo, liderazgoTotal: l.liderazgoTotal })),
    inventario: h.inventario.map(item),
    equipamiento: {
      arma: eq?.arma ? item(eq.arma) : null, casco: eq?.casco ? item(eq.casco) : null, torso: eq?.torso ? item(eq.torso) : null,
      guantes: eq?.guantes ? item(eq.guantes) : null, pantalones: eq?.pantalones ? item(eq.pantalones) : null, botas: eq?.botas ? item(eq.botas) : null,
    },
    monedasHeroe: { bronce: Number(h.monedasHeroe?.bronce ?? 0n), plata: Number(h.monedasHeroe?.plata ?? 0n), oro: Number(h.monedasHeroe?.oro ?? 0n) },
    cupoGuarnicion: h.cupoGuarnicion,
    guarnicionOcupada: propias.filter((e) => e.enGuarnicion).reduce((s, e) => s + e.cantidad, 0),
    heridoHasta: instante(h.heridoHastaMs), desconectaEn: instante(h.desconectaEnMs),
  };
}

function heroePublico(h: pb.Heroe): d.HeroePublico {
  return {
    heroeId: h.id, displayName: h.displayName, classDefinitionId: h.classDefinitionId, nivel: h.nivel, heridoHasta: instante(h.heridoHastaMs),
    escuadrasQueLleva: h.escuadrasQueLleva.map((e) => ({ tropaId: e.tropaId, cantidad: e.cantidad, nivel: e.nivel })),
    equipamiento: { arma: null, casco: null, torso: null, guantes: null, pantalones: null, botas: null },
  };
}

function campamentoMercenarios(c: pb.CampamentoMercenarios): d.CampamentoMercenarios {
  return {
    id: c.id, posicion: punto(c.posicion), origen: c.origen, edificios: c.edificios, residentesIds: c.residentesIds, eligieronComoInicial: c.eligieronComoInicial,
    mercado: cantidades(c.mercado), fondos: Object.fromEntries(Object.entries(c.fondos).map(([k, v]) => [k, cantidades(v)])),
  };
}

/** La planta de un campamento (paridad P7 del motor, `layoutCampamento`), en la forma que dibuja `ui/planoCampamento.ts`: celdas de 3 unidades locales,
 * las piezas con su centro en unidades y su huella en celdas, y la empalizada celda a celda (el motor la manda fusionada en rectángulos). */
function escenaCampamento(c: pb.CampamentoMercenarios): d.EscenaCampamento | undefined {
  if (c.planta.length === 0) return undefined;
  const T = c.trazado?.unidadesPorCelda || 3;
  const celdas = (rects: pb.RectLocal[], clase: 'muro' | 'puerta') =>
    rects.flatMap((r) => {
      const fuera: d.EscenaCampamento['empalizada'] = [];
      for (let col = Math.floor(r.x / T); col < Math.ceil((r.x + r.ancho) / T); col++) {
        for (let row = Math.floor(r.y / T); row < Math.ceil((r.y + r.alto) / T); row++) fuera.push({ col, row, clase });
      }
      return fuera;
    });
  return {
    campamentoId: c.id, origen: c.origen, layoutVersion: c.trazado?.layoutVersion ?? 0, unidadesPorCelda: T,
    edificios: c.planta.map((e) => ({ edificioId: e.id, tipo: e.tipo, posicion: punto(e.posicion), ancho: e.ancho / T, alto: e.alto / T })),
    calles: (c.trazado?.calles ?? []).map((r) => ({ col: r.x / T, row: r.y / T, ancho: r.ancho / T, alto: r.alto / T })),
    empalizada: [...celdas(c.empalizada, 'muro'), ...celdas(c.empalizadaPuerta, 'puerta')],
  };
}

/** El mostrador del campamento donde estás (motor c5c6111): el precio por unidad de cada bien para este héroe (`precios_mercado`, millonésimas de oro;
 * n unidades cuestan ⌈n·p⌉), lo que le queda hoy del cupo (`cupo_diario` menos `Heroe.cupo_campamento`, que vuelve a cero al cambiar el día de mundo,
 * como `CupoDiario::restante`; solo el residente compra con cupo) y, si reside, las tropas que recluta con su precio por soldado. */
function mercadoCampamento(dentro: pb.CampamentoMercenarios[], h: pb.Heroe, ahora: number): ProyeccionJugador['mercadoCampamento'] {
  const c = dentro.find((x) => x.presentesIds.includes(h.id)) ?? dentro[0];
  if (!c) return undefined;
  const precios = Object.fromEntries(Object.entries(c.preciosMercado).map(([r, p]) => [r, Number(p) / 1_000_000]));
  if (!c.residentesIds.includes(h.id)) return { precios, cupoRestante: {} };
  const hoy = Math.floor(ahora / 86_400_000);
  const comprado = h.cupoCampamento?.dia === hoy ? h.cupoCampamento.comprado : {};
  const cupoRestante = Object.fromEntries(Object.entries(cantidades(c.cupoDiario)).map(([r, tope]) => [r, Math.max(0, Math.floor(tope - (comprado[r] ?? 0) / 1000))]));
  const reclutamiento = {
    tropas: c.reclutables.map((t) => ({ tropaId: t.tropaId, precioPorSoldado: mil(t.precioPorSoldado), desbloqueada: t.desbloqueada })),
    poblacion: valorDeRitmo(c.poblacion, ahora),
    topePoblacion: c.poblacion?.maximo !== undefined ? mil(c.poblacion.maximo) : 0,
  };
  return { precios, cupoRestante, reclutamiento };
}

function relacion(r: pb.RelacionPolitica): d.RelacionPolitica {
  return {
    id: r.id, tipo: TIPO_RELACION[r.tipo] ?? 'alianza', faccionAId: r.faccionAId, faccionBId: r.faccionBId,
    estado: r.estado === pb.EstadoRelacion.RELACION_ROTA ? 'rota' : 'activa',
    tributo: r.tributo ? { recurso: r.tributo.recurso, cantidadPorMinuto: mil(r.tributo.cantidadPorMinuto) } : undefined, pazPropuestaPor: r.pazPropuestaPor,
  };
}

/** Una arista de la red (`x1,y1:x2,y2`, en unidades) a sus dos puntos. */
function arista(a: string): d.Point[] {
  return a.split(':').map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x: x ?? 0, y: y ?? 0 };
  });
}

// ─────────────────────────── la proyección ───────────────────────────

export interface Contexto {
  almacen: Almacen;
  bienvenida: Bienvenida;
  /** Instante de mundo ahora, en ms del contrato (`Sesion.ahoraMundo()`). */
  ahora: number;
  /** El id de la partida para la interfaz (hay una sola por servidor). */
  gameId: string;
  /** El hash del artefacto de mundo, que la interfaz usa como `mapaId`. */
  mapaId: string;
}

/** Lo que ve el jugador sin héroe: dónde puede nacer. */
function sinHeroe(c: Contexto): PartidaSinHeroe {
  return {
    gameId: c.gameId, instante: instante(BigInt(Math.round(c.ahora)))!, version: 0, mapaId: c.mapaId, sinHeroe: true,
    campamentos: c.bienvenida.campamentosParaElegir.map((x) => ({ id: x.campamentoId, posicion: punto(x.posicion), origen: x.origen, eligieronComoInicial: x.eligieronComoInicial, residentes: x.residentes })),
  };
}

/** La última ficha completa de la Facción propia que se vio (ver `proyectar`). */
let ultimaFaccionPropia: pb.Faccion | undefined;

export function proyectar(c: Contexto): ProyeccionJugador | PartidaSinHeroe {
  const { almacen: a, ahora } = c;
  const heroeId = c.bienvenida.heroeId ?? [...a.ambitos.keys()].find((k) => k.startsWith('HEROE:'))?.slice('HEROE:'.length);
  const ambitoHeroe = heroeId ? a.ambitos.get(`HEROE:${heroeId}`) : undefined;
  if (!heroeId || !ambitoHeroe) return sinHeroe(c);

  const deAmbito = <C extends Cuerpo['case']>(prefijo: string, caso: C): CuerpoDe<C>[] => {
    const r: CuerpoDe<C>[] = [];
    const vistos = new Set<string>();
    for (const [k, amb] of a.ambitos) {
      if (!k.startsWith(prefijo)) continue;
      for (const [ke, e] of amb.entidades) {
        if (e.case !== caso || vistos.has(ke)) continue;
        vistos.add(ke);
        r.push(e.value as CuerpoDe<C>);
      }
    }
    return r;
  };
  const heroePb = ambitoHeroe.entidades.get(`${TipoEntidad.HEROE}:${heroeId}`);
  if (heroePb?.case !== 'heroe') return sinHeroe(c);
  const h = heroePb.value;
  const faccionId = h.faccionId ?? c.bienvenida.faccionId ?? null;

  // Lo propio: HEROE, FACCION, ASENTAMIENTO y CAMPAMENTO. Lo de fuera: VISTA.
  const propiasFacciones = deAmbito('FACCION:', 'faccion');
  const todasFacciones = new Map<string, pb.Faccion>();
  for (const f of [...deAmbito('VISTA:', 'faccion'), ...propiasFacciones]) todasFacciones.set(f.id, f);
  // La propia viaja en `FACCION`. Si ese ámbito falta un momento (una incoherencia lo tira hasta que vuelve como foto, o una reconexión), se
  // queda la última que se vio: sin ella, la pestaña Facción saltaba a «sin Facción» y volvía.
  const propia = faccionId ? todasFacciones.get(faccionId) : undefined;
  if (propia) ultimaFaccionPropia = propia;
  else if (faccionId && ultimaFaccionPropia?.id === faccionId) todasFacciones.set(faccionId, ultimaFaccionPropia);

  // Las plazas: la del interior (ASENTAMIENTO) gana a la ficha de FACCION y de VISTA.
  const plazas = new Map<string, pb.Asentamiento>();
  for (const p of [...deAmbito('VISTA:', 'asentamiento'), ...deAmbito('FACCION:', 'asentamiento'), ...deAmbito('ASENTAMIENTO:', 'asentamiento')]) plazas.set(p.id, p);
  const interior = deAmbito('ASENTAMIENTO:', 'asentamiento')[0];
  const propias = [...plazas.values()].filter((p) => p.faccionId === faccionId);
  const ajenas = [...plazas.values()].filter((p) => p.faccionId !== faccionId);

  const escuadrones = deAmbito('HEROE:', 'escuadron');
  const ejercitosTodos = new Map<string, pb.Ejercito>();
  for (const e of [...deAmbito('VISTA:', 'ejercito'), ...deAmbito('FACCION:', 'ejercito'), ...deAmbito('HEROE:', 'ejercito')]) ejercitosTodos.set(e.id, e);
  const esPropio = (e: pb.Ejercito) => (faccionId ? e.faccionId === faccionId : false) || e.participantes.some((p) => p.heroeId === heroeId);
  const ejercitosPropios = [...ejercitosTodos.values()].filter(esPropio);
  const ejercitosAjenos = [...ejercitosTodos.values()].filter((e) => !esPropio(e) && !e.dentroDe);

  const caravanasTodas = new Map<string, pb.Caravana>();
  for (const x of [...deAmbito('VISTA:', 'caravana'), ...deAmbito('FACCION:', 'caravana'), ...deAmbito('HEROE:', 'caravana')]) caravanasTodas.set(x.id, x);
  const carPropia = (x: pb.Caravana) => (faccionId && x.faccionId === faccionId) || x.titularId === heroeId || x.recursosAvistados.length === 0;
  const caravanasPropias = [...caravanasTodas.values()].filter(carPropia);
  const caravanasAjenas = [...caravanasTodas.values()].filter((x) => !carPropia(x));

  // Donde está el héroe (plaza o campamento): las convocatorias que se le enseñan son las de ese lugar, más la suya.
  const lugarDelHeroe = h.ubicacion?.donde?.case === 'campamentoId' || h.ubicacion?.donde?.case === 'asentamientoId' ? h.ubicacion.donde.value : undefined;
  const heroesAjenos = deAmbito('VISTA:', 'heroe').filter((x) => x.id !== heroeId);
  const nombres: Record<string, string> = Object.fromEntries(a.nombresHeroes);
  nombres[h.id] = h.displayName;
  for (const x of heroesAjenos) nombres[x.id] = x.displayName;

  const vista = [...a.ambitos.entries()].find(([k]) => k.startsWith('VISTA:'))?.[1];
  const niebla = vista?.niebla;
  const red = deAmbito('VISTA:', 'redCaminos')[0];
  const fichas = deAmbito('VISTA:', 'fichaConocida').filter((f) => f.tipo === TipoEntidad.TIPO_ENTIDAD_NO_ESPECIFICADO || f.tipo === TipoEntidad.ASENTAMIENTO);

  const trazadoPorAsentamiento: Record<string, d.TrazadoAsentamiento> = {};
  for (const p of plazas.values()) {
    const t = trazado(p);
    if (t) trazadoPorAsentamiento[p.id] = t;
  }

  const territorioPorEjercito: Record<string, string> = {};
  for (const e of ejercitosPropios) if (e.territorioFaccionId) territorioPorEjercito[e.id] = e.territorioFaccionId;

  const proyeccion: ProyeccionJugador = {
    gameId: c.gameId,
    instante: instante(BigInt(Math.round(ahora)))!,
    version: Number([...a.ambitos.values()].reduce((m, x) => (x.version > m ? x.version : m), 0n)),
    heroeId,
    faccionId,
    mapaId: c.mapaId,
    facciones: [...todasFacciones.values()].map((f) => faccion(f, ahora)),
    directorioFacciones: deAmbito('VISTA:', 'directorioFacciones')[0]?.facciones.map((f) => ({ id: f.id, nombre: f.nombre, sigilo: sigilo(f.sigilo), nivel: f.nivel, ciudadanos: f.ciudadanos, derrotada: f.derrotada })),
    // Lo de siempre: SOLO la plaza donde el jugador está (cero o un elemento), con todo su interior.
    asentamientos: interior ? [asentamiento(interior, ahora)] : [],
    asentamientosAvistados: [...ajenas, ...propias.filter((p) => p.id !== interior?.id)].map((p) => ({
      id: p.id, nombre: p.nombre, faccionId: p.faccionId, posicion: punto(p.posicion), nivel: p.nivel, zona: p.zona.map(punto),
      edificios: p.edificios.map(edificio),
      almacen: Object.keys(p.almacen).length ? Object.fromEntries(Object.entries(p.almacen).map(([k, x]) => [k, { cantidad: valorDeRitmo(x.cantidad, ahora), capacidad: mil(x.capacidad) }])) : undefined,
    })),
    asentamientosConocidos: fichas.map((f) => ({
      asentamientoId: f.asentamientoId, nombre: f.nombre, faccionId: f.faccionId, posicion: punto(f.posicion), nivel: f.nivel,
      conocidoEn: instante(f.conocidoEnMs)!, radioPotencial: f.radioPotencial !== undefined ? mil(f.radioPotencial) : undefined,
    })),
    exploracion: niebla
      ? { tamanoCelda: niebla.tamanoCelda / 1000, columnas: niebla.columnas, filas: niebla.filas, celdas: hex(niebla.celdas), visibles: hex(niebla.visibles) }
      : { tamanoCelda: 5, columnas: 0, filas: 0, celdas: '', visibles: '' },
    territorioPorEjercito,
    caravanas: caravanasPropias.map((x) => caravana(x, ahora)),
    ejercitos: ejercitosPropios.map((e) => ejercito(e, ahora)),
    // Los ejércitos que se preparan dentro (`Convocatoria`, la manda el motor a los de la Facción). La tropa de cada integrante solo se
    // detalla si sus escuadras se conocen (las tuyas); de las de otro héroe, su tropa (`tropaIds`, motor 3cfd61e).
    convocatorias: deAmbito('', 'convocatoria').filter((v) => v.lugarId === lugarDelHeroe || v.integrantes.some((i) => i.heroeId === heroeId)).map((v) => {
      const porId = new Map(escuadrones.map((x) => [x.id, x]));
      const sel = (x: pb.SeleccionDeSalida | undefined) => ({ escuadronIds: x?.escuadronIds ?? [], tropaIds: x?.tropaIds ?? [], carga: cantidades(x?.carga) });
      return {
        id: v.id, lugar: { tipo: v.lugarEsCampamento ? 'campamento' : 'asentamiento', id: v.lugarId }, liderId: v.liderId,
        politicaDeUnion: v.politicaDeUnion === pb.PoliticaUnion.UNION_PREGUNTAR ? 'preguntar' : 'aceptar', creadaEn: instante(v.creadaEnMs)!,
        integrantes: v.integrantes.map((i) => ({
          heroeId: i.heroeId, unidoEn: instante(i.unidoEnMs)!, ...sel(i.seleccion),
          tropas: (i.seleccion?.escuadronIds ?? []).flatMap((id) => {
            const x = porId.get(id);
            return x ? [{ escuadronId: id, tropaId: x.tropaId, nombre: x.nombre, nivel: x.nivel, moral: valorDeRitmo(x.moral, ahora), cantidad: x.cantidad }] : [];
          }),
        })),
        peticiones: v.peticiones.map((x) => ({ heroeId: x.heroeId, pedidoEn: instante(x.pedidoEnMs)!, expiraEn: instante(x.expiraEnMs)!, ...sel(x.seleccion) })),
        soyLider: v.liderId === heroeId, soyIntegrante: v.integrantes.some((i) => i.heroeId === heroeId),
      };
    }),
    ejercitosAvistados: ejercitosAjenos.map((e) => ({
      id: e.id, tipo: e.tipo === pb.TipoColumna.COLUMNA_EJERCITO ? 'ejercito' : 'personal', enFormacion: e.formacionExpiraEnMs !== undefined ? true : undefined,
      faccionId: e.faccionId, posicionActual: evaluarPlan(e.plan, e.posicion, ahora).posicion, participantes: e.participantes.length,
      heroeIds: e.participantes.map((p) => p.heroeId), teSigue: e.teSigue ? true : undefined,
      caravanaFundacionId: opcional(e.caravanaFundacionId),
    })),
    caravanasAvistadas: caravanasAjenas.map((x) => ({ id: x.id, posicionActual: evaluarPlan(x.plan, x.posicion, ahora).posicion, faccionId: x.faccionId, escoltada: x.escoltada, recursos: x.recursosAvistados })),
    // Lo que sacó tu héroe de mirar de cerca (`inspeccionar`): viaja en HEROE y vale 10 minutos.
    informesDeInspeccion: deAmbito('HEROE:', 'informeInspeccion').map((i): d.InformeDeInspeccion => {
      const tipo: d.InformeDeInspeccion['objetivo']['tipo'] = i.objetivoId.startsWith('as-') ? 'asentamiento' : i.objetivoId.startsWith('car-') ? 'caravana' : 'ejercito';
      const tropa = (g: { tropaId: string; cantidad: number; heroeId: string }[]) => g.map((x) => ({ tropaId: x.tropaId, cantidad: x.cantidad, heroeId: x.heroeId }));
      const c = i.contenido;
      const contenido: d.ContenidoInforme = c.case === 'plaza'
        ? { asentamientoId: i.objetivoId, faccionId: c.value.faccionId, heroesIds: c.value.heroesIds, guarnicion: tropa(c.value.guarnicion) }
        : c.case === 'caravana'
          ? { caravanaId: i.objetivoId, escoltada: c.value.escoltada, recursos: c.value.recursos }
          : { ejercitoId: i.objetivoId, faccionId: c.value?.faccionId ?? '', heroesIds: c.value?.heroesIds ?? [], escuadrones: tropa(c.value?.escuadras ?? []) };
      return { heroeId: i.heroeId, objetivo: { tipo, id: i.objetivoId }, vistoEn: instante(i.vistoEnMs)!, expiraEn: instante(i.expiraEnMs)!, donde: punto(i.donde), contenido };
    }),
    miConvocatoriaId: deAmbito('', 'convocatoria').find((v) => v.integrantes.some((i) => i.heroeId === heroeId))?.id,
    heroe: (() => {
      // Los víveres viajan en la columna (`Ejercito.viveres`, contract: «en un ejército, los del ejército»); el héroe solo los lleva propios si va sin ella. La interfaz los lee del héroe.
      const x = heroe(h, escuadrones, ahora);
      const columna = ejercitosPropios.find((e) => e.participantes.some((p) => p.heroeId === heroeId));
      if (columna?.viveres) x.viveres = valorDeRitmo(columna.viveres, ahora);
      return x;
    })(),
    heroesVisibles: heroesAjenos.map(heroePublico),
    nombresDeCompaneros: nombres,
    nombresDeDirigentes: {},
    misiones: {
      heroe: h.misiones.map(mision),
      plaza: interior?.misiones.map(mision) ?? [],
      plazaId: interior?.id,
      faccion: (faccionId ? todasFacciones.get(faccionId)?.misiones ?? [] : []).map(mision),
    },
    tecnologiasAdoptadas: deAmbito('FACCION:', 'tecnologias').find((t) => t.faccionId === faccionId)?.adoptadas ?? [],
    // Tecnología (Tecnologia_Aedas): el estado del mundo viaja en `HEROE` (forma pública), lo de tu Facción en `FACCION`. El hito de una revelada y los
    // nombres de las épicas los pone el panel con el catálogo de `/v1/datos`.
    tecnologia: (() => {
      const est = deAmbito('', 'estadoTecnologia')[0];
      if (!est) return undefined;
      const tf = faccionId ? deAmbito('FACCION:', 'tecnologias').find((t) => t.faccionId === faccionId) : undefined;
      return {
        era: est.era, eraDesde: instante(est.eraDesdeMs) ?? 0,
        logros: est.logrosCumplidos.map((l) => ({ contador: l.contador, umbral: Number(l.umbral), en: instante(l.enMs) ?? 0 })),
        propias: faccionId ? { aparecidas: tf?.aparecidas ?? [], adoptadas: tf?.adoptadas ?? [], reveladas: tf?.reveladas ?? [] } : null,
        reveladas: (tf?.detalleReveladas ?? []).map((r) => ({ tecnologiaId: r.tecnologiaId, descubridorFaccionId: r.descubridoraFaccionId, hito: [], cumplidas: r.cumplidas })),
        capitalId: (faccionId ? todasFacciones.get(faccionId)?.capitalId : undefined) ?? null,
        epicasPosibles: tf?.epicasPosibles ?? [],
      } as d.TecnologiaJugador;
    })(),
    aedasResidentes: deAmbito('FACCION:', 'aedaResidente').filter((x) => x.faccionId === faccionId).map((x) => ({
      id: x.id, nombre: x.nombre, asentamientoId: x.asentamientoId,
      epica: x.epica ? {
        tecnologiaId: x.epica.tecnologiaId, nombre: x.epica.tecnologiaId, capitulo: x.epica.capitulo, capitulos: x.epica.capitulos, tituloCapitulo: '',
        hechos: x.epica.hechos, hechosNecesarios: x.epica.hechosNecesarios, ultimoHechoEn: instante(x.epica.ultimoHechoEnMs),
      } : undefined,
    })),
    aedasAvistados: deAmbito('VISTA:', 'aedaItinerante').map((x) => ({ id: x.id, posicion: evaluarPlan(x.plan, x.posicion, ahora).posicion, enAsentamientoId: opcional(x.enAsentamientoId) })),
    // Los tramos ya fundidos (paridad P7); un servidor anterior solo manda las aristas sueltas.
    caminos: !red ? [] : red.tramos.length
      ? red.tramos.map((t) => ({ id: t.id, escalon: Math.min(2, t.escalon) as 0 | 1 | 2, puntos: t.puntos.map(punto) }))
      : red.aristas.map((x, i) => ({ id: x, escalon: (red.escalones[i] ?? 1) as 0 | 1 | 2, puntos: arista(x) })),
    ordenes: deAmbito('FACCION:', 'ordenMercado').map((o) => ({
      id: o.id, asentamientoId: o.asentamientoId, tipo: o.esCompra ? 'compra' : 'venta', recurso: o.recurso, cantidad: mil(o.cantidad), cantidadCumplida: mil(o.cantidadCumplida),
      precioUnitario: mil(o.precioUnitario), creadoEn: instante(o.creadoEnMs)!, expiraEn: instante(o.expiraEnMs)!, estado: ESTADO_ORDEN[o.estado] ?? 'activa',
    })),
    acuerdos: deAmbito('FACCION:', 'acuerdoTrueque').map((t) => ({
      id: t.id, asentamientoAId: t.asentamientoAId, asentamientoBId: t.asentamientoBId,
      lineasA: t.lineasA.map((l) => ({ recurso: l.recurso, cantidadTotal: mil(l.cantidadTotal), cantidadEntregada: mil(l.cantidadEntregada) })),
      lineasB: t.lineasB.map((l) => ({ recurso: l.recurso, cantidadTotal: mil(l.cantidadTotal), cantidadEntregada: mil(l.cantidadEntregada) })),
      creadoEn: instante(t.creadoEnMs)!, expiraEn: instante(t.expiraEnMs)!, estado: ESTADO_TRUEQUE[t.estado] ?? 'propuesto',
    })),
    campamentosBandidos: deAmbito('VISTA:', 'campamentoBandidos').map((b) => ({
      id: b.id, posicion: punto(b.posicion), poder: b.poder, nivel: Math.min(3, Math.max(1, b.nivel)) as 1 | 2 | 3, bosqueId: opcional(b.bosqueId),
      asentamientoId: b.asentamientoId, campamentoMercenariosId: b.campamentoMercenariosId,
    })),
    campamentosMercenarios: (() => {
      const m = new Map<string, pb.CampamentoMercenarios>();
      for (const x of [...deAmbito('VISTA:', 'campamentoMercenarios'), ...deAmbito('CAMPAMENTO:', 'campamentoMercenarios')]) m.set(x.id, x);
      return [...m.values()].map(campamentoMercenarios);
    })(),
    escenasCampamento: deAmbito('CAMPAMENTO:', 'campamentoMercenarios').map(escenaCampamento).filter((e): e is d.EscenaCampamento => Boolean(e)),
    mercadoCampamento: mercadoCampamento(deAmbito('CAMPAMENTO:', 'campamentoMercenarios'), h, ahora),
    pueblos: (() => {
      const propios = [...deAmbito('FACCION:', 'pueblo'), ...deAmbito('ASENTAMIENTO:', 'pueblo')];
      const ids = new Set(propios.map((x) => x.id));
      // El de ASENTAMIENTO (refrescado cada minuto) gana al de FACCION.
      const porId = new Map(propios.map((x) => [x.id, x]));
      return [...[...porId.values()].map((x) => pueblo(x, true, ahora)), ...deAmbito('VISTA:', 'pueblo').filter((x) => !ids.has(x.id)).map((x) => pueblo(x, false, ahora))];
    })(),
    avanzadas: (() => {
      const propias = new Map([...deAmbito('FACCION:', 'avanzada'), ...deAmbito('ASENTAMIENTO:', 'avanzada')].map((x) => [x.id, x]));
      const de = (x: pb.Avanzada, propia: boolean): d.AvanzadaDeMapa => ({
        id: x.id, madreId: x.asentamientoMadreId, etapa: x.etapa, posicion: punto(x.posicion), enRuinas: x.estado === pb.EstadoAvanzada.AVANZADA_EN_RUINAS,
        batallaId: opcional(x.batallaId), propia,
      });
      return [...[...propias.values()].map((x) => de(x, true)), ...deAmbito('VISTA:', 'avanzada').filter((x) => !propias.has(x.id)).map((x) => de(x, false))];
    })(),
    obrasDeMapa: (() => {
      const propias = new Map([...deAmbito('FACCION:', 'obra'), ...deAmbito('ASENTAMIENTO:', 'obra')].map((x) => [x.id, x]));
      return [...[...propias.values()].map((x) => obraDeMapa(x, true)), ...deAmbito('VISTA:', 'obra').filter((x) => !propias.has(x.id)).map((x) => obraDeMapa(x, false))];
    })(),
    alijos: deAmbito('HEROE:', 'alijo').map((x) => ({ id: x.id, posicion: punto(x.posicion), recurso: x.recurso || 'oro', cantidad: mil(x.cantidad) })),
    miradasIntel: deAmbito('VISTA:', 'mirada').map((m) => ({
      id: m.id, faccionId: m.faccionId, origenId: m.origenId, centro: punto(m.centro), radio: mil(m.radio),
      compradaEn: instante(m.compradaEnMs)!, expiraEn: instante(m.expiraEnMs)!, libreEn: instante(m.libreEnMs)!,
    })),
    informesPlaza: [],
    tarifasIntel: { mirada: { radio: 0, duracionMinutos: 0, oroBase: 0, oroPorUnidad: 0, cooldownMinutos: 0 }, informe: { oroPorNivel: 0, cooldownMinutos: 0 }, cupoMiradas: { porNivelDeTaberna: [], campamento: 0 } },
    zonasFusionadas: deAmbito('VISTA:', 'zonaFaccion').map((z) => ({ faccionId: z.faccionId, contornos: z.contornos.map((k) => k.puntos.map(punto)) })),
    relaciones: [...deAmbito('FACCION:', 'relacion'), ...deAmbito('VISTA:', 'relacion')].filter((r, i, l) => l.findIndex((x) => x.id === r.id) === i).map(relacion),
    titulos: deAmbito('VISTA:', 'titulo').map((t) => ({ tituloId: t.tituloId, nombre: t.nombre, poseedorId: t.poseedorId, valorMetrica: mil(t.valorMetrica) })),
    trazadoPorAsentamiento,
    batallas: [],
  };
  return proyeccion;
}
