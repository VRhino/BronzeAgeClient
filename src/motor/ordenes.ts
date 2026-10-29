// El adaptador de escritura: un comando de los de siempre (`ejecutarComando(gameId, tipo, params)`, el nombre y los parámetros del REST
// del backend TypeScript) convertido a una `Orden` del contrato 05. Los nombres casan solos: el `tipo` de siempre es el caso del `oneof`
// de `Orden` (`marcharA` ↔ `marchar_a`), y sus parámetros, los campos del mensaje. Lo que cambia se traduce aquí, con el descriptor generado:
//  * cantidades y coordenadas: unidades → milésimas (los `sint64` del contrato, `Punto`, `Cantidades`);
//  * instantes: ms de época Unix → ms desde 2026-01-01 (los campos `*_ms`, que en el REST no llevaban el sufijo);
//  * los objetivos `{ tipo: 'asentamiento', id }` → el caso del `oneof` (`asentamientoId`).
// Lo que no case se queda fuera y el servidor lo rechaza con su código.
import { ScalarType, type DescEnum, type DescField, type DescMessage, type DescOneof } from '@bufbuild/protobuf';
import { OrdenSchema } from '../contrato/gen/bronzeage/v1/orders_pb';
import type { CuerpoDeOrden } from '../contrato/sesion';
import { aContrato } from './proyeccion';

/** Un comando que el contrato no tiene. */
export class ComandoDesconocido extends Error {}

const casoDeOrden = (tipo: string): DescField | undefined => OrdenSchema.oneofs[0]?.fields.find((f) => f.localName === tipo);

export function traducirOrden(tipo: string, params: unknown): CuerpoDeOrden {
  const campo = casoDeOrden(tipo);
  if (!campo || campo.fieldKind !== 'message') throw new ComandoDesconocido(`el contrato no tiene la orden «${tipo}»`);
  return { case: tipo, value: mensaje(campo.message, (params ?? {}) as Record<string, unknown>) } as CuerpoDeOrden;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function leer(o: Record<string, unknown>, f: DescField): unknown {
  if (f.localName in o) return o[f.localName];
  // Los instantes del REST no llevaban el sufijo `Ms`.
  if (f.localName.endsWith('Ms')) {
    const sin = f.localName.slice(0, -2);
    if (sin in o) return o[sin];
  }
  return undefined;
}

function mensaje(desc: DescMessage, o: Record<string, unknown>): Record<string, unknown> {
  if (desc.typeName === 'bronzeage.v1.Punto') return { x: milesimas(o.x), y: milesimas(o.y) };
  if (desc.typeName === 'bronzeage.v1.Cantidades') {
    const fuente = esObjeto(o.porId) ? o.porId : o;
    return { porId: Object.fromEntries(Object.entries(fuente).map(([k, v]) => [k, milesimas(v)])) };
  }
  if (desc.typeName === 'google.protobuf.Struct') return o;
  const r: Record<string, unknown> = {};
  for (const m of desc.members) {
    if (m.kind === 'oneof') {
      const caso = oneof(m, o);
      if (caso) r[m.localName] = caso;
      continue;
    }
    const v = leer(o, m);
    if (v === undefined || v === null) continue;
    r[m.localName] = valor(m, v);
  }
  return r;
}

/** Un `oneof`: o viene ya por uno de sus campos (`asentamientoId`), o como `{ tipo, id }` / `{ tipo, punto }` bajo su nombre. */
function oneof(desc: DescOneof, o: Record<string, unknown>): { case: string; value: unknown } | undefined {
  for (const f of desc.fields) {
    const v = leer(o, f);
    if (v !== undefined && v !== null) return { case: f.localName, value: valor(f, v) };
  }
  // El `oneof` de los objetivos se llama `tipo`, igual que el discriminante del REST: `{ tipo: 'campamento', id }` llega entonces al mismo nivel.
  const x = typeof o[desc.localName] === 'string' && desc.localName === 'tipo' ? o : o[desc.localName];
  if (!esObjeto(x) || typeof x.tipo !== 'string') return undefined;
  const t = x.tipo;
  const f = desc.fields.find((c) => c.localName === t || c.localName === `${t}Id`);
  if (!f) return undefined;
  const v = x[f.localName] ?? x[t] ?? x.id;
  return v === undefined ? undefined : { case: f.localName, value: valor(f, v) };
}

function valor(f: DescField, v: unknown): unknown {
  switch (f.fieldKind) {
    case 'scalar': return escalar(f.scalar, f.localName, v);
    case 'enum': return enumerado(f.enum, v);
    case 'message': return esObjeto(v) ? mensaje(f.message, v) : v;
    case 'list': {
      const lista = Array.isArray(v) ? v : [v];
      if (f.listKind === 'scalar') return lista.map((x) => escalar(f.scalar, f.localName, x));
      if (f.listKind === 'enum') return lista.map((x) => enumerado(f.enum, x));
      return lista.map((x) => (esObjeto(x) ? mensaje(f.message, x) : x));
    }
    case 'map': {
      if (!esObjeto(v)) return {};
      const r: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        r[k] = f.mapKind === 'scalar' ? escalar(f.scalar, f.localName, x) : f.mapKind === 'enum' ? enumerado(f.enum, x) : esObjeto(x) ? mensaje(f.message, x) : x;
      }
      return r;
    }
  }
}

function milesimas(v: unknown): bigint {
  return BigInt(Math.round(Number(v ?? 0) * 1000));
}

function escalar(t: ScalarType, nombre: string, v: unknown): unknown {
  switch (t) {
    case ScalarType.STRING: return String(v);
    case ScalarType.BOOL: return Boolean(v);
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT: return Number(v);
    // Los instantes son `int64` acabados en `_ms`; las cantidades y las distancias de juego, `sint64` en milésimas (common.proto).
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
      return nombre.endsWith('Ms') ? aContrato(Number(v)) : BigInt(Math.round(Number(v)));
    // Salvo los índices (`carroIndice`), que el motor lee como entero tal cual, y el instante `salirEn`.
    case ScalarType.SINT64:
      if (nombre.endsWith('Indice')) return BigInt(Math.round(Number(v)));
      if (nombre === 'salirEn') return aContrato(Number(v));
      return milesimas(v);
    default: return Math.round(Number(v));
  }
}

/** Un enumerado: el número tal cual, o el nombre del REST (`'aceptar'`) contra el del contrato (`UNION_ACEPTAR`). */
function enumerado(e: DescEnum, v: unknown): number {
  if (typeof v === 'number') return v;
  const buscado = String(v).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  const valor = e.values.find((x) => x.name === buscado || x.name.endsWith(`_${buscado}`) || x.localName === buscado);
  return valor?.number ?? 0;
}
