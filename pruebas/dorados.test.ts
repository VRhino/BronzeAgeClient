// Los ficheros dorados del motor (`contratos/golden/`): este cliente decodifica lo mismo que el servidor, y su almacén sabe dar clave a toda
// entidad que llegue en ellos.
import { describe, expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromBinary, fromJson, toJson } from '@bufbuild/protobuf';
import { MensajeDeClienteSchema, MensajeDeServidorSchema } from '../src/contrato/gen/bronzeage/v1/session_pb';
import { identidad } from '../src/contrato/almacen';
import { MOTOR } from './motor';

const dir = join(MOTOR, 'contratos/golden');
const esquemas = { MensajeDeCliente: MensajeDeClienteSchema, MensajeDeServidor: MensajeDeServidorSchema } as const;

describe.skipIf(!existsSync(dir))('dorados del contrato', () => {
  const nombres = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.bin')).map((n) => n.replace(/\.bin$/, '')) : [];
  for (const nombre of nombres) {
    const tipo = nombre.split('__')[0] as keyof typeof esquemas;
    if (!(tipo in esquemas)) continue;
    test(nombre, () => {
      const schema = esquemas[tipo];
      const bin = fromBinary(schema as typeof MensajeDeServidorSchema, readFileSync(join(dir, `${nombre}.bin`)));
      const json = fromJson(schema as typeof MensajeDeServidorSchema, JSON.parse(readFileSync(join(dir, `${nombre}.json`), 'utf8')));
      expect(toJson(schema as typeof MensajeDeServidorSchema, bin as never)).toEqual(toJson(schema as typeof MensajeDeServidorSchema, json as never));
      if (tipo === 'MensajeDeServidor') {
        const c = (bin as ReturnType<typeof fromBinary<typeof MensajeDeServidorSchema>>).cuerpo;
        const entidades = c.case === 'foto' ? c.value.entidades : c.case === 'delta' ? c.value.cambios.flatMap((x) => (x.datos ? [x.datos] : [])) : [];
        for (const e of entidades) if (e.cuerpo.case) expect(identidad(e.cuerpo)[1]).not.toBe('');
      }
    });
  }
});
