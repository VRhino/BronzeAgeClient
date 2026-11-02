// Las escenas del banco de Centro urbano: una plaza de mentira en tres situaciones (Gobernador y Rey que reside, de visita sin cargo, y con la
// subida de nivel en obra y bajo ocupación).
import type { ProyeccionJugador } from '../../src/apiCliente';
import type { Asentamiento, Edificio } from '../../src/tiposDominio';

export const AHORA = Date.parse('2026-11-02T10:00:00Z');
const MIN = 60_000;
let n = 0;
const ed = (tipo: string, x: Partial<Edificio> = {}): Edificio => ({ id: `ed-${++n}`, tipo, estado: 'activo', posicion: { x: 0, y: 0 }, ...x });
const alm = (cantidad: number, capacidad: number) => ({ cantidad, capacidad, producido: 0, consumido: 0, porMinuto: 0 });

const TEC = ['leva_comunal', 'escudos_ligeros', 'armamento_palacial', 'hostigamiento_tribal', 'arqueria_palacial', 'aleacion_bronce'];
const esc = (id: string, tropaId: string, cantidad: number) => ({ id, nombre: tropaId, heroeId: 'heroe-1', tropaId, cantidad, nivel: 1, moral: 80, contenedor: { tipo: 'campamento' }, enGuarnicion: false });

export type Escena = 'gobernador' | 'visita' | 'obra';

export function escena(cual: Escena): { p: ProyeccionJugador; a: Asentamiento } {
  const edificios: Edificio[] = [
    ed('centroUrbano', { nivelInterno: 2 }), ...Array.from({ length: 24 }, () => ed('vivienda')), ed('almacen'), ed('granero'),
    ed('granja', { nivelInterno: 2 }), ed('granja'), ed('lenera'), ed('curtiduria'), ed('fundicion'), ed('barracon', { nivelInterno: 2 }), ed('galeriaDeTiro', { nivelInterno: 2 }), ed('taberna'),
    ed('armeria', { estado: 'en_construccion', completaEn: AHORA + 200 * MIN }), ed('palacio'),
  ];
  const a = {
    id: 'as-1', nombre: 'Kydonia', faccionId: 'f-1', nivel: 2, posicion: { x: 0, y: 0 }, edificios,
    poblacion: { pesants: 342, artesanos: 118, nobleza: 4 },
    medidorMantenimiento: cual === 'obra' ? 38 : 82, nutricionPoblacion: cual === 'obra' ? 18 : 64,
    almacen: { madera: alm(900, 2000), piedra: alm(620, 2000), oro: alm(260, 1000), lingoteBronce: alm(40, 300), trigo: alm(800, 1000), armaMadera: alm(30, 100), armaCobre: alm(12, 100), armaBronce: alm(4, 100), armaduraBasica: alm(20, 100), cuero: alm(25, 100) },
    cargos: { gobernadorId: 'heroe-1', maestroObrasId: 'heroe-2', tesoreroId: null, maestroCaravanasId: 'heroe-4', generalId: 'heroe-3', sacerdoteId: null },
    heroesFundadoresIds: ['heroe-1', 'heroe-2'], casasCompradas: ['heroe-3', 'heroe-4'],
    participacion: { 'heroe-1': 140, 'heroe-2': 85, 'heroe-3': 210, 'heroe-4': 12, 'heroe-5': 30 },
    capitalDeFaccionId: cual === 'gobernador' ? undefined : 'f-1',
    autoConstruccionPausada: cual === 'obra',
    ...(cual === 'obra' ? { ascenso: { nivelObjetivo: 3, iniciadoEn: AHORA - 3000 * MIN, completaEn: AHORA + 7080 * MIN }, ocupacionHasta: AHORA + 95 * MIN } : {}),
  } as unknown as Asentamiento;
  const yo = cual === 'visita' ? 'heroe-6' : 'heroe-1';
  const p = {
    instante: AHORA, heroeId: yo, faccionId: 'f-1', asentamientos: [a],
    facciones: [{ id: 'f-1', nombre: 'Casa del Toro', nivel: 2, reyId: 'heroe-1', ciudadanosIds: ['heroe-1', 'heroe-2', 'heroe-3', 'heroe-4', 'heroe-5', 'heroe-6'], miembros: [] }, { id: 'f-2', nombre: 'Reino de Hatti', nivel: 3 }],
    nombresDeCompaneros: { 'heroe-1': 'Minos', 'heroe-2': 'Ariadna', 'heroe-3': 'Teseo', 'heroe-4': 'Dédalo', 'heroe-5': 'Ícaro', 'heroe-6': 'Fedra' },
    pueblos: [{ id: 'pu-1', tipo: 'aldeaAgricola', propio: true, madreId: 'as-1', posicion: { x: 3, y: 3 } }],
    tecnologia: { propias: { adoptadas: TEC } }, tecnologiasAdoptadas: TEC, heroesVisibles: [],
    heroe: { id: yo, displayName: yo === 'heroe-1' ? 'Minos' : 'Fedra', ubicacion: { tipo: 'asentamiento', asentamientoId: 'as-1' }, escuadrones: [esc('s1', 'milicia_lanceros', 18), esc('s2', 'honderos', 20), esc('s3', 'arqueros', 6)] },
    ejercitos: [], campamentosMercenarios: [], asentamientosConocidos: [],
    asentamientosAvistados: [{ id: 'as-9', nombre: 'Hattusa', faccionId: 'f-2', nivel: 3, posicion: { x: 120, y: 80 } }, { id: 'as-8', nombre: 'Ugarit', faccionId: 'f-3', nivel: 2, posicion: { x: 60, y: 140 } }],
    miradasIntel: [
      { id: 'm1', faccionId: 'f-1', origenId: 'as-1', centro: { x: 120, y: 80 }, radio: 30, compradaEn: AHORA - 40 * MIN, expiraEn: AHORA + 80 * MIN, libreEn: AHORA + 200 * MIN },
      { id: 'm2', faccionId: 'f-1', origenId: 'as-1', centro: { x: 64, y: 30 }, radio: 30, compradaEn: AHORA - 150 * MIN, expiraEn: AHORA - 30 * MIN, libreEn: AHORA + 90 * MIN },
    ],
    informesPlaza: [{ asentamientoId: 'as-9', faccionId: 'f-2', nombre: 'Hattusa', nivel: 3, conocidoEn: AHORA - 300 * MIN, heroesIds: ['heroe-20', 'heroe-21'],
      edificios: [['centroUrbano', 0, 0], ['vivienda', 3, 0], ['vivienda', 3, 2], ['vivienda', 5, 1], ['barracon', -3, 1], ['granja', 0, 4], ['granja', 2, 5], ['almacen', -2, -2], ['palacio', 1, -3]].map(([tipo, x, y]) => ({ tipo, estado: 'activo', posicion: { x, y } })),
      guarnicion: [{ tropaId: 'lanceros_mimbre', cantidad: 40, heroeId: 'heroe-20' }, { tropaId: 'arqueros', cantidad: 18, heroeId: 'heroe-21' }],
      recintos: [{ nivel: 2, avance: 13, celdas: Array.from({ length: 20 }, (_, i) => ({ clase: i % 7 === 0 ? 'puerta' : 'muro' })) }] }],
  } as unknown as ProyeccionJugador;
  return { p, a };
}
