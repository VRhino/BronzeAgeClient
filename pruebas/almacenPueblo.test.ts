// El almacén de un pueblo extractor (Víctor, 2026-11-03: «la cantera no excava nada, su almacén siempre está vacío»). El motor lo manda en
// `almacen_local`, sin el nombre del recurso; el cliente lo guardaba con la clave vacía y las placas y el acarreo lo daban por vacío.
import { create } from '@bufbuild/protobuf';
import { describe, expect, test } from 'vitest';
import { RitmoSchema } from '../src/contrato/gen/bronzeage/v1/common_pb';
import { PuebloSchema } from '../src/contrato/gen/bronzeage/v1/entities_pb';
import { puebloDeContrato, recursoDeExtractor } from '../src/motor/proyeccion';
import { htmlPlacaDeRecursos } from '../src/ui/hudInterior';

const extractor = (tipoExtractor: string, milesimas: bigint) =>
  create(PuebloSchema, {
    id: 'pueblo-102', asentamientoMadreId: 'as-7', tipoExtractor, nodoId: 'nodo-2712',
    almacenLocal: { cantidad: create(RitmoSchema, { valorEnT0: milesimas, t0Ms: 0n, porMinuto: 0n }), capacidad: 2_000_000n },
  });

describe('el almacén de un pueblo extractor', () => {
  test('la cantera guarda piedra, con su cantidad', () => {
    const p = puebloDeContrato(extractor('cantera', 380_000n), true, 0);
    expect(p.almacen).toEqual({ piedra: 380 });
    expect(p.capacidad).toBe(2000);
  });

  test('cada mina, su metal', () => {
    expect(['mina', 'minaCobre', 'minaEstano', 'minaHierro'].map(recursoDeExtractor)).toEqual(['oro', 'cobre', 'estano', 'hierro']);
    expect(puebloDeContrato(extractor('minaEstano', 12_500n), true, 0).almacen).toEqual({ estano: 12.5 });
  });

  test('la placa del almacén enseña la piedra, no «Vacío»', () => {
    const p = puebloDeContrato(extractor('cantera', 380_000n), true, 0);
    const html = htmlPlacaDeRecursos('almacen', 'Almacén', p.almacen, (t) => t, p.capacidad);
    expect(html).not.toContain('Vacío');
    expect(html).toContain('380');
    expect(html).toContain('Piedra');
  });
});
