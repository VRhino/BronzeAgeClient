import { describe, expect, it } from 'vitest';
import { traducirOrden } from '../src/motor/ordenes';

// Los objetivos del REST (`{ tipo, id }`) contra los `oneof tipo` del contrato, que se llaman igual que su discriminante.
describe('traducirOrden: objetivos', () => {
  it('atacar un campamento de bandidos', () => {
    const o = traducirOrden('atacar', { heroeId: 'heroe-1', objetivo: { tipo: 'campamento', id: 'band-1' } });
    expect(o).toMatchObject({ case: 'atacar', value: { heroeId: 'heroe-1', objetivo: { tipo: { case: 'campamentoId', value: 'band-1' } } } });
  });

  it('marchar a una plaza', () => {
    const o = traducirOrden('marcharA', { heroeId: 'heroe-1', objetivo: { tipo: 'asentamiento', id: 'as-3' } });
    expect(o).toMatchObject({ value: { objetivo: { tipo: { case: 'asentamientoId', value: 'as-3' } } } });
  });

  it('marchar a un punto, en milésimas', () => {
    const o = traducirOrden('marcharA', { heroeId: 'heroe-1', objetivo: { tipo: 'punto', punto: { x: 1.5, y: 2 } } });
    expect(o).toMatchObject({ value: { objetivo: { tipo: { case: 'punto', value: { x: 1500n, y: 2000n } } } } });
  });
});
