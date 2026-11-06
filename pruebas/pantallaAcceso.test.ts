import { describe, expect, it } from 'vitest';
import { validarRegistro } from '../src/ui/pantallaAcceso';

describe('validarRegistro (las reglas del motor, en el cliente)', () => {
  it('acepta un alta correcta', () => {
    expect(validarRegistro('victor_1.a', 'una clave larga', 'una clave larga')).toEqual({});
    expect(validarRegistro('Ñandú', '12345678', '12345678')).toEqual({});
  });
  it('nick: largo y caracteres', () => {
    expect(validarRegistro('ab', '12345678', '12345678').nick).toMatch(/3 a 32/);
    expect(validarRegistro('a'.repeat(33), '12345678', '12345678').nick).toMatch(/3 a 32/);
    expect(validarRegistro('mi nick', '12345678', '12345678').nick).toMatch(/sin espacios/);
    expect(validarRegistro('', '12345678', '12345678').nick).toBeTruthy();
  });
  it('contraseña: largo y repetida', () => {
    expect(validarRegistro('victor', '1234567', '1234567').clave).toMatch(/llevas 7/);
    expect(validarRegistro('victor', '12345678', '12345679').repetir).toMatch(/No coincide/);
    expect(validarRegistro('victor', 'x'.repeat(129), 'x'.repeat(129)).clave).toMatch(/128/);
  });
});
