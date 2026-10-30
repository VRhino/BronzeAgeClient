// El paquete de relieve (contrato 06 §8): uno pequeño escrito aquí según el contrato, y el real del motor (`relieve-*.bin`, si se ha generado)
// comparado con la ventana de la mesa de escalas 3D, que sale del mismo generador.
import { describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as zlib from 'node:zlib';
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { PaqueteRelieveSchema, TeselaRelieveSchema } from '../src/contrato/gen/bronzeage/v1/world_pb';
import { METROS_ALTURA, Relieve, verificarRelieve } from '../src/mundo/relieve';
import { MOTOR } from './motor';

// Node 22 trae zstd, pero los tipos de @types/node 22.10 aún no lo declaran
const zstdCompressSync = (zlib as unknown as { zstdCompressSync: (b: Uint8Array) => Uint8Array }).zstdCompressSync;
const gunzipSync = zlib.gunzipSync;
const u16 = (metros: number) => Math.round((metros / METROS_ALTURA) * 65535);

/** Un paquete de `columnas × filas` muestras cada 0,5 u en teselas de `lado` intervalos, con la altura y el agua que se pidan. */
function paquete(columnas: number, filas: number, lado: number, altura: (i: number, j: number) => number, agua: (i: number, j: number) => boolean) {
  const tx = Math.ceil((columnas - 1) / lado), ty = Math.ceil((filas - 1) / lado), n = lado + 1;
  const teselas = [];
  for (let b = 0; b < ty; b++) {
    for (let a = 0; a < tx; a++) {
      const h = new Uint16Array(n * n), res = new Uint8Array(n * n * 2), bits = new Uint8Array(Math.ceil((n * n) / 8));
      let mojada = false;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const k = j * n + i, gi = Math.min(columnas - 1, a * lado + i), gj = Math.min(filas - 1, b * lado + j);
          h[k] = altura(gi, gj);
          if (agua(gi, gj)) { bits[k >> 3]! |= 1 << (k & 7); mojada = true; }
          const p = i && j ? h[k - 1]! + h[k - n]! - h[k - n - 1]! : i ? h[k - 1]! : j ? h[k - n]! : 0;
          const r = (h[k]! - p) & 0xffff;
          res[2 * k] = r & 0xff;
          res[2 * k + 1] = r >> 8;
        }
      }
      teselas.push(create(TeselaRelieveSchema, { altura: zstdCompressSync(res), agua: mojada ? zstdCompressSync(bits) : new Uint8Array(0) }));
    }
  }
  const m = create(PaqueteRelieveSchema, { hash: '', hashArtefacto: 'abc', paso: 500, ladoTesela: lado, columnas, filas, teselasX: tx, teselasY: ty, teselas });
  m.hash = createHash('sha256').update(toBinary(PaqueteRelieveSchema, m)).digest('hex');
  return m;
}

describe('paquete de relieve', () => {
  // 21 × 13 muestras (10 × 6 u) en teselas de 8: 3 × 2 teselas, la última columna de teselas pasa del borde
  const altura = (i: number, j: number) => (i * 977 + j * 3001 + (i * j) % 7 * 40000) & 0xffff;
  const agua = (i: number, j: number) => (i + 2 * j) % 5 === 0;
  const p = paquete(21, 13, 8, altura, agua);

  test('cada muestra vale lo que se escribió, también en los bordes compartidos y en la última tesela', () => {
    const r = new Relieve(p);
    expect([r.paso, r.lado, r.teselasX, r.teselasY]).toEqual([0.5, 8, 3, 2]);
    for (let j = 0; j < 13; j++) {
      for (let i = 0; i < 21; i++) {
        expect(u16(r.alturaEn(i * 0.5, j * 0.5))).toBe(altura(i, j));
        expect(r.aguaEn(i * 0.5, j * 0.5)).toBe(agua(i, j));
      }
    }
  });

  test('entre muestras interpola, y fuera del mapa da la del borde', () => {
    const r = new Relieve(p), m = (v: number) => (v / 65535) * METROS_ALTURA;
    expect(r.alturaEn(1.25, 1)).toBeCloseTo((m(altura(2, 2)) + m(altura(3, 2))) / 2, 6);
    expect(r.alturaEn(1, 1.25)).toBeCloseTo((m(altura(2, 2)) + m(altura(2, 3))) / 2, 6);
    expect(r.alturaEn(-5, -5)).toBeCloseTo(m(altura(0, 0)), 6);
    expect(r.alturaEn(99, 99)).toBeCloseTo(m(altura(20, 12)), 6);
  });

  test('solo guarda abiertas las últimas teselas que se usaron', () => {
    const r = new Relieve(p, 2);
    r.alturaEn(0, 0); r.alturaEn(5, 0); r.alturaEn(9, 0);
    expect(r.teselasAbiertas).toBe(2);
  });

  test('se comprueba que es el anunciado y que está entero', async () => {
    expect(await verificarRelieve(p, p.hash)).toBe(true);
    expect(await verificarRelieve(p, 'otro')).toBe(false);
    const roto = fromBinary(PaqueteRelieveSchema, toBinary(PaqueteRelieveSchema, p));
    roto.teselas[1]!.altura = zstdCompressSync(new Uint8Array(162));
    expect(await verificarRelieve(roto, p.hash)).toBe(false);
  });
});

const dir = join(MOTOR, 'generador/salida/mundo');
const archivo = existsSync(dir) ? readdirSync(dir).find((n) => /^relieve-.*\.bin$/.test(n)) : undefined;
const ventana = join(MOTOR, 'Consideraciones/artefactos/mesa_escalas_3d/datos-nuevo.json');

describe.skipIf(!archivo || !existsSync(ventana))('paquete de relieve real', () => {
  test('es el del generador: cuadra con la ventana de la mesa, muestra a muestra', async () => {
    const p = fromBinary(PaqueteRelieveSchema, readFileSync(join(dir, archivo!)));
    expect(await verificarRelieve(p, p.hash)).toBe(true);
    expect(archivo).toBe(`relieve-${p.hashArtefacto}.bin`);
    const r = new Relieve(p);
    expect([r.columnas, r.filas, r.teselasX, r.teselasY]).toEqual([5335, 4001, 42, 32]);
    const d = JSON.parse(readFileSync(ventana, 'utf8')) as { x0: number; y0: number; nx: number; ny: number; paso: number; altura: string; agua: string };
    const alt = new Uint16Array(gunzipSync(Buffer.from(d.altura, 'base64')).buffer.slice(0));
    const mojado = gunzipSync(Buffer.from(d.agua, 'base64'));
    let vistas = 0;
    for (let j = 0; j < d.ny; j += 7) {
      for (let i = 0; i < d.nx; i += 7) {
        const x = d.x0 + i * d.paso, y = d.y0 + j * d.paso, k = j * d.nx + i;
        expect(u16(r.alturaEn(x, y))).toBe(alt[k]);
        expect(r.aguaEn(x, y)).toBe(mojado[k] === 1);
        vistas++;
      }
    }
    expect(vistas).toBeGreaterThan(6000);
  });
});
