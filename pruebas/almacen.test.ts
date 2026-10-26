// El almacén por ámbito: foto, delta (entera, parcial de la plaza y quita), niebla parcial, revocado, huecos y el `Hola` de reanudación.
import { describe, expect, test } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { AmbitoTipo, TipoEntidad } from '../src/contrato/gen/bronzeage/v1/common_pb';
import { MensajeDeServidorSchema, TipoCambio, TipoCliente, type MensajeDeServidor } from '../src/contrato/gen/bronzeage/v1/session_pb';
import { Almacen, Incoherencia, clave } from '../src/contrato/almacen';

type Init = Parameters<typeof create<typeof MensajeDeServidorSchema>>[1];
const m = (x: Init): MensajeDeServidor['cuerpo'] => create(MensajeDeServidorSchema, x).cuerpo;
const plaza = { tipo: AmbitoTipo.AMBITO_ASENTAMIENTO, id: 'as-3' };
const vista = { tipo: AmbitoTipo.AMBITO_VISTA, id: 'f-1' };

function conPlaza(): Almacen {
  const a = new Almacen();
  a.aplicar(m({ cuerpo: { case: 'foto', value: { ambito: plaza, version: 10n, entidades: [
    { cuerpo: { case: 'asentamiento', value: { id: 'as-3', nombre: 'Tirinto', nivel: 2, versionInterior: 4n } } },
    { cuerpo: { case: 'heroe', value: { id: 'heroe-1', displayName: 'Ana' } } },
  ] } } }));
  return a;
}

describe('almacén', () => {
  test('la foto sustituye al ámbito y nombra las entidades por su clase e id', () => {
    const a = conPlaza();
    expect(a.ambitos.get('ASENTAMIENTO:as-3')?.version).toBe(10n);
    expect([...a.ambitos.get('ASENTAMIENTO:as-3')!.entidades.keys()]).toEqual([clave(TipoEntidad.ASENTAMIENTO, 'as-3'), clave(TipoEntidad.HEROE, 'heroe-1')]);
  });

  test('la delta parcial de la plaza copia solo los campos de la máscara; la entera reemplaza; la quita borra', () => {
    const a = conPlaza();
    a.aplicar(m({ cuerpo: { case: 'delta', value: { ambito: plaza, desde: 10n, hasta: 12n, eventos: [{ codigo: 'plaza.subio' }], cambios: [
      { tipo: TipoCambio.CAMBIO_ACTUALIZA, entidad: TipoEntidad.ASENTAMIENTO, id: 'as-3', reemplaza: false, campos: ['version', 'version_interior', 'nivel'],
        datos: { cuerpo: { case: 'asentamiento', value: { id: 'as-3', nivel: 3, versionInterior: 5n } } } },
      { tipo: TipoCambio.CAMBIO_ACTUALIZA, entidad: TipoEntidad.HEROE, id: 'heroe-1', reemplaza: true, datos: { cuerpo: { case: 'heroe', value: { id: 'heroe-1', displayName: 'Ana la Roja' } } } },
      { tipo: TipoCambio.CAMBIO_QUITA, entidad: TipoEntidad.CARAVANA, id: 'car-9' },
    ] } } }));
    const [p] = a.todas('asentamiento');
    expect([p?.nivel, p?.nombre, p?.versionInterior]).toEqual([3, 'Tirinto', 5n]);
    expect(a.todas('heroe')[0]?.displayName).toBe('Ana la Roja');
    expect(a.ambitos.get('ASENTAMIENTO:as-3')?.version).toBe(12n);
    expect(a.hechos.map((h) => h.evento.codigo)).toEqual(['plaza.subio']);
  });

  test('una delta que no empieza donde acabó la anterior es una incoherencia', () => {
    const a = conPlaza();
    expect(() => a.aplicar(m({ cuerpo: { case: 'delta', value: { ambito: plaza, desde: 11n, hasta: 12n } } }))).toThrow(Incoherencia);
    expect(() => a.aplicar(m({ cuerpo: { case: 'delta', value: { ambito: vista, desde: 0n, hasta: 1n } } }))).toThrow(Incoherencia);
  });

  test('la niebla parcial sobrescribe los bytes de sus tramos', () => {
    const a = new Almacen();
    a.aplicar(m({ cuerpo: { case: 'foto', value: { ambito: vista, version: 1n, niebla: { tamanoCelda: 5000, columnas: 32, filas: 1, celdas: new Uint8Array(4), visibles: new Uint8Array(4) } } } }));
    a.aplicar(m({ cuerpo: { case: 'delta', value: { ambito: vista, desde: 1n, hasta: 2n, niebla: { parcial: true, tramosCeldas: [{ desde: 1, datos: new Uint8Array([0xff, 0x0f]) }], tramosVisibles: [{ desde: 3, datos: new Uint8Array([1]) }] } } } }));
    const n = a.ambitos.get('VISTA:f-1')!.niebla!;
    expect([...n.celdas]).toEqual([0, 0xff, 0x0f, 0]);
    expect([...n.visibles]).toEqual([0, 0, 0, 1]);
    expect(n.columnas).toBe(32);
  });

  test('el Hola de reanudación lleva cada ámbito salvo la VISTA y la secuencia interior de cada plaza', () => {
    const a = conPlaza();
    a.aplicar(m({ cuerpo: { case: 'foto', value: { ambito: vista, version: 7n } } }));
    const h = a.hola({ token: 't', cliente: TipoCliente.CLIENTE_UNITY, versionCliente: 'x' });
    expect(h.versionesConocidas).toEqual({ 'ASENTAMIENTO:as-3': 10n });
    expect(h.versionesInterioresConocidas).toEqual({ 'ASENTAMIENTO:as-3': 4n });
    expect(h.compresiones).toEqual(['zstd']);
  });

  test('el revocado descarta el ámbito', () => {
    const a = conPlaza();
    a.aplicar(m({ cuerpo: { case: 'revocado', value: { ambito: plaza, motivo: 'salió' } } }));
    expect(a.ambitos.size).toBe(0);
  });
});
