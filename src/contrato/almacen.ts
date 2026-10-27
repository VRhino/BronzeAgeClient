// Lo que el cliente guarda de sus ámbitos (contrato 05 §5 y §7). Es el puerto a TypeScript del almacén de referencia del motor
// (`crates/contrato/src/almacen.rs`): cada `Foto` sustituye al ámbito, cada `Delta` se aplica sobre él (la plaza parcial con su máscara,
// la niebla parcial por tramos) y tiene que empezar donde acabó la anterior, cada `Revocado` lo descarta; y se guardan los hechos que llegaron.
//
// A diferencia del de referencia, este no se cae ante lo que el contrato no permite: lo cuenta como `Incoherencia` y el que lo usa (la sesión)
// decide reconectar para recibir fotos limpias.
import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { AmbitoTipo, TipoEntidad, type Ambito as AmbitoPb } from './gen/bronzeage/v1/common_pb';
import type { NieblaProyectada } from './gen/bronzeage/v1/entities_pb';
import type { EventoDominio } from './gen/bronzeage/v1/events_pb';
import {
  HolaSchema,
  TipoCambio,
  type Delta,
  type Entidad,
  type Foto,
  type Hola,
  type MensajeDeServidor,
  type Revocado,
  TipoCliente,
} from './gen/bronzeage/v1/session_pb';
import { aplicarPlaza } from './plaza';
import { aplicarNiebla } from './niebla';

/** El cuerpo de una entidad del contrato (el `oneof` de `Entidad`). */
export type Cuerpo = Exclude<Entidad['cuerpo'], { case: undefined }>;

/** El valor de un caso del cuerpo: `CuerpoDe<'heroe'>` es `Heroe`. */
export type CuerpoDe<C extends Cuerpo['case']> = Extract<Cuerpo, { case: C }>['value'];

/** Un ámbito tal como lo tiene el cliente. Las entidades van por `clave(TipoEntidad, id)`. */
export interface Ambito {
  version: bigint;
  entidades: Map<string, Cuerpo>;
  niebla?: NieblaProyectada;
}

/** Lo que el almacén no pudo aplicar porque el contrato no lo permite; la sesión reconecta al verlo. */
export class Incoherencia extends Error {
  /** El ámbito que quedó a medias, si se sabe: basta con tirar ese y pedirlo de nuevo, sin vaciar los demás. */
  constructor(mensaje: string, readonly ambito?: string) {
    super(mensaje);
  }
}

/** La clave `TIPO:id` de un ámbito del contrato (`HEROE:heroe-3`, `VISTA:f-1`, `ADMIN:`). */
export function claveDeAmbito(a: AmbitoPb | undefined): string {
  if (!a) throw new Incoherencia('un mensaje de ámbito sin ámbito');
  return `${AmbitoTipo[a.tipo].replace(/^AMBITO_/, '')}:${a.id}`;
}

/** La clave de una entidad dentro de su ámbito. */
export function clave(tipo: TipoEntidad, id: string): string {
  return `${tipo}:${id}`;
}

/** La clase y el id del contrato de un cuerpo (los mismos que usan los `Cambio`). */
export function identidad(c: Cuerpo): [TipoEntidad, string] {
  switch (c.case) {
    case 'ejercito': return [TipoEntidad.EJERCITO, c.value.id];
    case 'asentamiento': return [TipoEntidad.ASENTAMIENTO, c.value.id];
    case 'faccion': return [TipoEntidad.FACCION, c.value.id];
    case 'tecnologias': return [TipoEntidad.TECNOLOGIA_FACCION, c.value.faccionId];
    case 'heroe': return [TipoEntidad.HEROE, c.value.id];
    case 'informeInspeccion': return [TipoEntidad.INFORME_INSPECCION, c.value.id];
    case 'escuadron': return [TipoEntidad.ESCUADRON, c.value.id];
    case 'caravana': return [TipoEntidad.CARAVANA, c.value.id];
    case 'convocatoria': return [TipoEntidad.CONVOCATORIA, c.value.id];
    case 'acuerdoTrueque': return [TipoEntidad.ACUERDO_TRUEQUE, c.value.id];
    case 'ordenMercado': return [TipoEntidad.ORDEN_MERCADO, c.value.id];
    case 'batalla': return [TipoEntidad.BATALLA, c.value.id];
    case 'relacion': return [TipoEntidad.RELACION_POLITICA, c.value.id];
    case 'propuesta': return [TipoEntidad.PROPUESTA, c.value.id];
    case 'titulo': return [TipoEntidad.TITULO, c.value.tituloId];
    case 'pueblo': return [TipoEntidad.PUEBLO, c.value.id];
    case 'obra': return [TipoEntidad.OBRA_DE_MAPA, c.value.id];
    case 'avanzada': return [TipoEntidad.AVANZADA, c.value.id];
    case 'campamentoMercenarios': return [TipoEntidad.CAMPAMENTO_MERCENARIOS, c.value.id];
    case 'campamentoBandidos': return [TipoEntidad.CAMPAMENTO_BANDIDOS, c.value.id];
    case 'fichaConocida': return [TipoEntidad.FICHA_CONOCIDA, c.value.asentamientoId];
    case 'zonaFaccion': return [TipoEntidad.ZONA_FACCION, c.value.faccionId];
    case 'redCaminos': return [TipoEntidad.RED_CAMINOS, 'red'];
    case 'mirada': return [TipoEntidad.MIRADA_INTEL, c.value.id];
    case 'informe': return [TipoEntidad.INFORME_PLAZA, c.value.asentamientoId];
    case 'estadoTecnologia': return [TipoEntidad.ESTADO_TECNOLOGIA, 'tecnologia'];
    case 'aedaItinerante': return [TipoEntidad.AEDA, c.value.id];
    case 'aedaResidente': return [TipoEntidad.AEDA, c.value.id];
    case 'alijo': return [TipoEntidad.ALIJO, c.value.id];
    case 'nodo': return [TipoEntidad.NODO_RECURSO, c.value.id];
    case 'memoria': return [TipoEntidad.MEMORIA_FACCION, c.value.faccionId];
  }
}

/** Todos los ámbitos del cliente, por su clave `TIPO:id`, y los hechos que le llegaron (con el ámbito por el que llegaron). */
export class Almacen {
  readonly ambitos = new Map<string, Ambito>();
  readonly hechos: { ambito: string; evento: EventoDominio }[] = [];

  /** Aplica un mensaje del servidor; devuelve la clave del ámbito que cambió (o `undefined` si no era de un ámbito). */
  aplicar(m: MensajeDeServidor['cuerpo']): string | undefined {
    switch (m.case) {
      case 'foto': return this.aplicarFoto(m.value);
      case 'delta': return this.aplicarDelta(m.value);
      case 'revocado': return this.aplicarRevocado(m.value);
      default: return undefined;
    }
  }

  private aplicarFoto(f: Foto): string {
    const k = claveDeAmbito(f.ambito);
    const entidades = new Map<string, Cuerpo>();
    for (const e of f.entidades) {
      if (e.cuerpo.case === undefined) continue;
      const [t, id] = identidad(e.cuerpo);
      entidades.set(clave(t, id), e.cuerpo);
    }
    // La VISTA vieja se conserva al reconectar hasta que llega la nueva (ver `Sesion`); la nueva la sustituye, aunque sea de otra perspectiva
    // (de la del héroe solo a la de su Facción).
    if (k.startsWith('VISTA:')) for (const otra of [...this.ambitos.keys()]) if (otra.startsWith('VISTA:') && otra !== k) this.ambitos.delete(otra);
    this.ambitos.set(k, { version: f.version, entidades, niebla: f.niebla });
    return k;
  }

  private aplicarDelta(d: Delta): string {
    const k = claveDeAmbito(d.ambito);
    const a = this.ambitos.get(k);
    if (!a) throw new Incoherencia(`una Delta de ${k}, que el cliente no tiene`, k);
    if (d.desde !== a.version) throw new Incoherencia(`la Delta de ${k} empieza en ${d.desde} y el cliente tiene ${a.version} (hueco)`, k);
    if (d.hasta < d.desde) throw new Incoherencia(`la Delta de ${k} va hacia atrás`, k);
    for (const c of d.cambios) {
      const e = clave(c.entidad, c.id);
      const datos = c.datos?.cuerpo;
      if (c.tipo === TipoCambio.CAMBIO_QUITA) {
        // Lo que nació y desapareció dentro del tramo se quita sin que el cliente lo llegara a tener: no es un error.
        a.entidades.delete(e);
      } else if (c.reemplaza) {
        if (!datos || datos.case === undefined) throw new Incoherencia(`ACTUALIZA sin datos en ${k}: ${e}`, k);
        a.entidades.set(e, datos);
      } else {
        const destino = a.entidades.get(e);
        if (destino?.case !== 'asentamiento' || datos?.case !== 'asentamiento') {
          throw new Incoherencia(`en ${k} solo la plaza viaja parcial, y sobre una que el cliente tiene: ${e}`, k);
        }
        aplicarPlaza(destino.value, datos.value, c.campos);
      }
    }
    if (d.niebla) {
      if (d.niebla.parcial && !a.niebla) throw new Incoherencia(`niebla parcial en ${k} sin una niebla previa`, k);
      a.niebla = aplicarNiebla(a.niebla, d.niebla);
    }
    a.version = d.hasta;
    for (const evento of d.eventos) this.hechos.push({ ambito: k, evento });
    return k;
  }

  private aplicarRevocado(r: Revocado): string {
    const k = claveDeAmbito(r.ambito);
    this.ambitos.delete(k);
    return k;
  }

  /** Las entidades de un tipo, de todos los ámbitos (una misma entidad en dos ámbitos sale una vez: son copias de lo mismo). */
  todas<C extends Cuerpo['case']>(caso: C): CuerpoDe<C>[] {
    const vistas = new Map<string, CuerpoDe<C>>();
    for (const a of this.ambitos.values()) {
      for (const [k, c] of a.entidades) if (c.case === caso) vistas.set(k, c.value as CuerpoDe<C>);
    }
    return [...vistas.values()];
  }

  /** El `Hola` de quien reanuda con lo que conserva: la versión de cada ámbito (salvo `VISTA`, que no se reanuda) y la secuencia interior de
   * cada plaza que tiene con su interior (la de su `ASENTAMIENTO` o, en `ADMIN`, todas). */
  hola(datos: { token: string; cliente: TipoCliente; versionCliente: string; mundoHash?: string; relojClienteMs?: bigint }): Hola {
    const init: MessageInitShape<typeof HolaSchema> = {
      versionProtocolo: 1,
      cliente: datos.cliente,
      versionCliente: datos.versionCliente,
      token: datos.token,
      compresiones: ['zstd'],
      mundoHashConocido: datos.mundoHash,
      relojClienteMs: datos.relojClienteMs ?? 0n,
      versionesConocidas: {},
      versionesInterioresConocidas: {},
    };
    const h = create(HolaSchema, init);
    for (const [k, a] of this.ambitos) {
      if (k.startsWith('VISTA:')) continue;
      h.versionesConocidas[k] = a.version;
      if (k.startsWith('ASENTAMIENTO:') || k === 'ADMIN:') {
        for (const c of a.entidades.values()) {
          if (c.case === 'asentamiento') h.versionesInterioresConocidas[`ASENTAMIENTO:${c.value.id}`] = c.value.versionInterior;
        }
      }
    }
    return h;
  }

  vaciar(): void {
    this.ambitos.clear();
    this.hechos.length = 0;
  }
}
