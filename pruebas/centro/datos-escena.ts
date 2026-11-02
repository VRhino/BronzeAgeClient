// Las escenas del banco de Centro urbano: una plaza de mentira en tres situaciones (Gobernador y Rey que reside, de visita sin cargo, y con la
// subida de nivel en obra y bajo ocupación).
import type { ProyeccionJugador } from '../../src/apiCliente';
import type { Asentamiento, Edificio } from '../../src/tiposDominio';

export const AHORA = Date.parse('2026-11-02T10:00:00Z');
const MIN = 60_000;
let n = 0;
const ed = (tipo: string, x: Partial<Edificio> = {}): Edificio => ({ id: `ed-${++n}`, tipo, estado: 'activo', posicion: { x: 0, y: 0 }, ...x });
const alm = (cantidad: number, capacidad: number) => ({ cantidad, capacidad, producido: 0, consumido: 0, porMinuto: 0 });

export type Escena = 'gobernador' | 'visita' | 'obra';

export function escena(cual: Escena): { p: ProyeccionJugador; a: Asentamiento } {
  const edificios: Edificio[] = [
    ed('centroUrbano', { nivelInterno: 2 }), ...Array.from({ length: 24 }, () => ed('vivienda')), ed('almacen'), ed('granero'),
    ed('granja', { nivelInterno: 2 }), ed('granja'), ed('lenera'), ed('curtiduria'), ed('fundicion'), ed('barracon'),
    ed('armeria', { estado: 'en_construccion', completaEn: AHORA + 200 * MIN }), ed('palacio'),
  ];
  const a = {
    id: 'as-1', nombre: 'Kydonia', faccionId: 'f-1', nivel: 2, posicion: { x: 0, y: 0 }, edificios,
    poblacion: { pesants: 342, artesanos: 118, nobleza: 4 },
    medidorMantenimiento: cual === 'obra' ? 38 : 82, nutricionPoblacion: cual === 'obra' ? 18 : 64,
    almacen: { madera: alm(900, 2000), piedra: alm(620, 2000), oro: alm(260, 1000), lingoteBronce: alm(40, 300), trigo: alm(800, 1000) },
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
    facciones: [{ id: 'f-1', nombre: 'Casa del Toro', nivel: 2, reyId: 'heroe-1', ciudadanosIds: ['heroe-1', 'heroe-2', 'heroe-3', 'heroe-4', 'heroe-5', 'heroe-6'], miembros: [] }],
    nombresDeCompaneros: { 'heroe-1': 'Minos', 'heroe-2': 'Ariadna', 'heroe-3': 'Teseo', 'heroe-4': 'Dédalo', 'heroe-5': 'Ícaro', 'heroe-6': 'Fedra' },
    pueblos: [{ id: 'pu-1', tipo: 'aldeaAgricola', propio: true, madreId: 'as-1', posicion: { x: 3, y: 3 } }],
    tecnologia: { propias: { adoptadas: [] } }, tecnologiasAdoptadas: [], heroe: { id: yo, displayName: yo === 'heroe-1' ? 'Minos' : 'Fedra', escuadrones: [] }, heroesVisibles: [],
  } as unknown as ProyeccionJugador;
  return { p, a };
}
