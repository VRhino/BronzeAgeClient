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

// El índice de un carro es `sint64` en el contrato pero el motor lo lee como entero tal cual, no en milésimas.
describe('traducirOrden: índices de carro', () => {
  it('comprar animal para el segundo carro', () => {
    const o = traducirOrden('comprarAnimalCaravana', { caravanaId: 'car-2', carroIndice: 1, tipoAnimal: 'buey' });
    expect(o).toMatchObject({ value: { caravanaId: 'car-2', carroIndice: 1n, tipoAnimal: 'buey' } });
  });

  it('mover el tercer carro', () => {
    const o = traducirOrden('moverCarroCaravana', { desdeCaravanaId: 'car-2', haciaCaravanaId: 'car-3', carroIndice: 2 });
    expect(o).toMatchObject({ value: { carroIndice: 2n } });
  });

  it('las cantidades siguen en milésimas', () => {
    const o = traducirOrden('colocarOrdenMercado', { asentamientoId: 'as-1', tipo: 'venta', recurso: 'trigo', cantidad: 5 });
    expect(o).toMatchObject({ value: { cantidad: 5000n } });
  });
});

// El carro frente al almacén de la plaza donde se está dentro (motor 1dad4ab).
describe('traducirOrden: carro y almacén de la plaza', () => {
  it('cargar de la plaza, en milésimas', () => {
    const o = traducirOrden('cargarDePlaza', { asentamientoId: 'as-3', recurso: 'madera', cantidad: 40 });
    expect(o).toMatchObject({ case: 'cargarDePlaza', value: { asentamientoId: 'as-3', recurso: 'madera', cantidad: 40000n } });
  });

  it('dejar en la plaza', () => {
    const o = traducirOrden('dejarEnPlaza', { asentamientoId: 'as-3', recurso: 'trigo', cantidad: 5 });
    expect(o).toMatchObject({ case: 'dejarEnPlaza', value: { cantidad: 5000n } });
  });

  it('cerrar el almacén a los ciudadanos', () => {
    const o = traducirOrden('cerrarAlmacenACiudadanos', { asentamientoId: 'as-3', cerrado: true });
    expect(o).toMatchObject({ case: 'cerrarAlmacenACiudadanos', value: { asentamientoId: 'as-3', cerrado: true } });
  });
});

// Encargos de caravana (motor 2c4bca6): paradas anidadas en milésimas y la hora de salida como instante del contrato.
describe('traducirOrden: encargos de caravana', () => {
  it('dar un envío a una plaza ajena con precios y hora', () => {
    const salir = Date.UTC(2026, 0, 2);
    const o = traducirOrden('encargarCaravana', {
      caravanaId: 'car-2', destinoAsentamientoId: 'as-9', modo: 'envio', salirEnMs: salir,
      paradaOrigen: { recoger: [{ recurso: 'oro', cantidad: 50 }], esperarExistencias: true, dejar: [], desecharSobrante: false },
      paradaDestino: { recoger: [{ recurso: 'cobre', cantidad: 20, precioMax: 1.5 }], esperarExistencias: false, dejar: [{ recurso: 'trigo', tope: 100, precioMin: 0.8 }], desecharSobrante: false },
    });
    expect(o).toMatchObject({
      case: 'encargarCaravana',
      value: {
        caravanaId: 'car-2', destinoAsentamientoId: 'as-9', modo: 'envio', salirEnMs: 86_400_000n,
        paradaOrigen: { recoger: [{ recurso: 'oro', cantidad: 50_000n }], esperarExistencias: true },
        paradaDestino: { recoger: [{ recurso: 'cobre', cantidad: 20_000n, precioMax: 1500n }], dejar: [{ recurso: 'trigo', tope: 100_000n, precioMin: 800n }] },
      },
    });
  });

  it('cancelar el encargo', () => {
    expect(traducirOrden('cancelarEncargo', { caravanaId: 'car-2' })).toMatchObject({ case: 'cancelarEncargo', value: { caravanaId: 'car-2' } });
  });
});

// Mercenarios por contrato (motor 7aa44b9): el objetivo es el `oneof` de `ObjetivoMercenario`; `ir_a` va a un punto en milésimas.
describe('traducirOrden: mercenarios', () => {
  it('contratar a un temporal para escoltar una caravana', () => {
    expect(traducirOrden('contratarMercenario', { mercenarioId: 'heroe-31', trabajo: 'escoltar', objetivo: { caravanaId: 'car-5' }, plazoDias: 7 })).toMatchObject({
      case: 'contratarMercenario', value: { mercenarioId: 'heroe-31', trabajo: 'escoltar', objetivo: { tipo: { case: 'caravanaId', value: 'car-5' } }, plazoDias: 7 },
    });
  });

  it('contratar a un permanente con su residencia', () => {
    expect(traducirOrden('contratarMercenario', { mercenarioId: 'heroe-31', trabajo: 'permanente', objetivo: { faccionId: 'fac-1' }, residenciaAsentamientoId: 'as-4' })).toMatchObject({
      value: { objetivo: { tipo: { case: 'faccionId', value: 'fac-1' } }, residenciaAsentamientoId: 'as-4' },
    });
  });

  it('ordenar a varios ir a un punto', () => {
    expect(traducirOrden('ordenarMercenario', { mercenarioIds: ['heroe-21', 'heroe-23'], tipo: 'ir_a', objetivo: { punto: { x: 392, y: 318.5 } } })).toMatchObject({
      case: 'ordenarMercenario', value: { mercenarioIds: ['heroe-21', 'heroe-23'], tipo: 'ir_a', objetivo: { tipo: { case: 'punto', value: { x: 392_000n, y: 318_500n } } } },
    });
  });

  it('valorar, mudar y reclamar el premio', () => {
    expect(traducirOrden('valorarMercenario', { mercenarioId: 'heroe-31', buena: true })).toMatchObject({ value: { mercenarioId: 'heroe-31', buena: true } });
    expect(traducirOrden('mudarMercenario', { mercenarioId: 'heroe-23', asentamientoId: 'as-1' })).toMatchObject({ value: { asentamientoId: 'as-1' } });
    expect(traducirOrden('reclamarPremioDeRango', { tropaId: 'arqueros' })).toMatchObject({ case: 'reclamarPremioDeRango', value: { tropaId: 'arqueros' } });
  });
});
