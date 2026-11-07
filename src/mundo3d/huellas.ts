// Lo que ocupa en el suelo cada maqueta del mundo 3D (0.175.0, Víctor 2026-11-07): de aquí salen el aro de lo seleccionado («el círculo
// alrededor de la maqueta es demasiado grande, que sea del tamaño de la maqueta»), la zona de clic y el claro sin árboles. El colisionador
// de cliente de 0.175.0 se quitó en 0.177.0 (Víctor: con la marcha parada al borde no se llegaba a la puerta para entrar).
import { MUNDO3D } from './config';

const M = (): number => MUNDO3D.maqueta;
/** Pueblos y aldeas (empalizada, casas, campos). */
const P = (): number => MUNDO3D.maqueta * MUNDO3D.pueblo;
/** Avanzadas (atalaya, fuerte, ciudadela). */
const A = (): number => MUNDO3D.maqueta * MUNDO3D.avanzada;

/** Lo que ocupa una plaza: su muralla (desde el nivel 3) o el borde de sus casas: el caserío (1) y el poblado (2), más recogidos. */
export const radioDePlaza = (radioCiudad: number, nivel: number): number => radioCiudad * M() * (nivel <= 1 ? 0.62 : nivel === 2 ? 0.8 : 1);
/** Lo que ocupa un pueblo o una aldea: su empalizada (los campos de la aldea quedan fuera y se pisan). */
export const radioDePueblo = (_aldea: boolean): number => 0.58 * P();
/** Hasta dónde llegan los campos de una aldea (la zona de clic). */
export const radioDeCampos = (): number => 1.4 * P();
/** Lo que ocupa una avanzada: la cerca de la atalaya; las torres de las esquinas del fuerte; las torres del recinto de la ciudadela. */
export const radioDeAvanzada = (etapa: number): number => (etapa <= 1 ? 0.3 : 0.5) * A();
export const radioDeObra = (): number => 0.4 * M();
export const radioDeCampamento = (): number => 0.63 * M() * MUNDO3D.campamento;
export const radioDeBandidos = (): number => 0.48 * M() * MUNDO3D.campamento;
export const radioDeAlijo = (): number => 0.14 * M() * MUNDO3D.alijo;
export const radioDeBatalla = (): number => 0.65;

/** Lo que el aro de lo seleccionado deja de holgura alrededor de la maqueta. */
export const HOLGURA_ARO = 0.12;
