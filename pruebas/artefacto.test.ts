// El artefacto de mundo real del motor (`generador/salida/mundo/mundo-*.bin`, si se ha generado): se convierte al mapa que pinta el cliente.
import { describe, expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromBinary } from '@bufbuild/protobuf';
import { ArtefactoDeMundoSchema } from '../src/contrato/gen/bronzeage/v1/world_pb';
import { mapaDesdeArtefacto } from '../src/mundo/artefacto';
import { MOTOR } from './motor';

const dir = join(MOTOR, 'generador/salida/mundo');
const archivo = existsSync(dir) ? readdirSync(dir).find((n) => /^mundo-.*\.bin$/.test(n)) : undefined;

describe.skipIf(!archivo)('artefacto de mundo real', () => {
  test('se convierte al mapa en unidades estratégicas, con sus rasters', () => {
    const mapa = mapaDesdeArtefacto(fromBinary(ArtefactoDeMundoSchema, readFileSync(join(dir, archivo!))));
    expect([Math.round(mapa.config.ancho), Math.round(mapa.config.alto)]).toEqual([2667, 2000]);
    const { terreno, altura, densidadBosque } = mapa.rasters!;
    expect([terreno?.columnas, terreno?.filas, terreno?.celda]).toEqual([667, 500, 4]);
    expect(terreno!.datos.length).toBe(667 * 500);
    expect(new Set(terreno!.datos).has(1)).toBe(true); // hay agua
    expect(altura!.datos.length).toBe(667 * 500);
    expect(altura!.datos.reduce((a, b) => Math.max(a, b), 0)).toBeGreaterThan(30_000);
    expect(densidadBosque!.datos.length).toBe(667 * 500);
    expect(mapa.bosques.length).toBeGreaterThan(10);
    expect(mapa.nodos.every((n) => n.posicion.x >= 0 && n.posicion.x <= 2667 && n.posicion.y <= 2000)).toBe(true);
    expect(mapa.rios.length).toBeGreaterThan(0);
  });
});
