import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/apiCliente', () => ({ textosDeMisiones: () => null, radioDePuerta: () => 2 }));
import { seguirEnRastreador } from '../src/ui/misiones';

describe('El rastreador y la cadena «Tu primera plaza»', () => {
  it('con hueco, entra cualquiera', () => {
    expect(seguirEnRastreador(['heroe:H1'], 'heroe:H6')).toEqual(['heroe:H1', 'heroe:H6']);
  });

  it('lleno, una de fuera de la cadena no entra; una de la cadena saca a la última que no es de ella', () => {
    const lleno = ['heroe:H1', 'heroe:H14', 'heroe:H13'];
    expect(seguirEnRastreador(lleno, 'heroe:H6')).toEqual(lleno);
    expect(seguirEnRastreador(lleno, 'heroe:H15')).toEqual(['heroe:H1', 'heroe:H14', 'heroe:H15']);
  });

  it('nunca saca a otra de la cadena ni repite', () => {
    const cadena = ['heroe:H14', 'heroe:H15', 'heroe:H16'];
    expect(seguirEnRastreador(cadena, 'heroe:H17')).toEqual(cadena);
    expect(seguirEnRastreador(['heroe:H14'], 'heroe:H14')).toEqual(['heroe:H14']);
  });
});
