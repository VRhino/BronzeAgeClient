// LAS CLASES DEL HÉROE Y LOS OBJETOS (motor c82d6ed, contrato 0.24.0; Objetos_Del_Heroe §2 y §3.2, Heroe_Y_Tropa §3). Crear un héroe pide una
// clase de `CLASES_HEROE` (`crearHeroe.classDefinitionId`; vacía o desconocida, `heroe.clase_desconocida`). Nace con el equipo inicial de su
// clase puesto: el arma de tier I de la clase, las cuatro piezas de tier I de su `armaduraInicial` (torso, guantes, pantalones y botas, sin
// casco) y el caballo de tiro (`montura_tiro`). La clase real del héroe es la del arma que lleva puesta (`Heroe.class_definition_id`).
// Las fichas de los objetos salen de `OBJETOS` (`GET /v1/datos`): aquí no se copia ninguna cifra.
import { bloqueDeDatos } from '../apiCliente';

type Escapar = (valor: string) => string;

export type AtributoDeClase = 'fuerza' | 'destreza' | 'armadura' | 'vitalidad';
export type PesoDeArmadura = 'ligera' | 'media' | 'pesada';

/** Una clase de `CLASES_HEROE.clases`. */
export interface ClaseHeroe {
  id: string;
  nombre: string;
  /** Los pesos de armadura que admite el arma de la clase. */
  armaduras: PesoDeArmadura[];
  armaduraInicial: PesoDeArmadura;
  atributosBase: Record<AtributoDeClase, number>;
}

/** Una ficha de `OBJETOS.objetos`. */
export interface FichaObjeto {
  id: string;
  nombre: string;
  tipo: 'arma' | 'armadura' | 'montura' | 'material' | 'consumible';
  /** Del 1 al 5; `null` en los consumibles y en el crisol. */
  tier: number | null;
  apilable: boolean;
  precio: number;
  hueco?: string;
  clase?: string;
  tipoArmadura?: PesoDeArmadura;
  metal?: string;
}

/** El bloque `OBJETOS`, con lo que hace falta hasta ahora. */
export interface CatalogoDeObjetos {
  objetos: FichaObjeto[];
  rarezas?: Record<string, string>;
}

export const NOMBRE_DE_ATRIBUTO: Record<AtributoDeClase, string> = { fuerza: 'Fuerza', destreza: 'Destreza', armadura: 'Armadura', vitalidad: 'Vitalidad' };
const ORDEN_DE_ATRIBUTOS: readonly AtributoDeClase[] = ['fuerza', 'destreza', 'armadura', 'vitalidad'];
const ORDEN_DE_PESOS: readonly PesoDeArmadura[] = ['ligera', 'media', 'pesada'];
/** Los huecos que llena la armadura inicial: sin casco. */
const HUECOS_INICIALES = ['torso', 'guantes', 'pantalones', 'botas'];

/** Las clases del héroe, en el orden del catálogo; `null` mientras no lleguen los datos. */
export function clasesDeHeroe(alCargar?: () => void): ClaseHeroe[] | null {
  return bloqueDeDatos<{ clases?: ClaseHeroe[] }>('CLASES_HEROE', alCargar)?.clases ?? null;
}

export function catalogoDeObjetos(alCargar?: () => void): CatalogoDeObjetos | null {
  return bloqueDeDatos<CatalogoDeObjetos>('OBJETOS', alCargar);
}

/** La ficha de un objeto por su id, o `undefined`. */
export function fichaDeObjeto(id: string, alCargar?: () => void): FichaObjeto | undefined {
  return catalogoDeObjetos(alCargar)?.objetos.find((o) => o.id === id);
}

/** El nombre de una clase por su id. Sin datos, o con un id que ya no está en el catálogo (un héroe de una partida vieja), el propio id legible. */
export function nombreDeClase(id: string, alCargar?: () => void): string {
  return clasesDeHeroe(alCargar)?.find((c) => c.id === id)?.nombre ?? id.replace(/_/g, ' ');
}

/** Los pesos de armadura de una clase, en palabras: «ligera y media». */
export function textoDeArmaduras(c: ClaseHeroe): string {
  const l = ORDEN_DE_PESOS.filter((x) => c.armaduras.includes(x));
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}

/** El equipo con el que nace un héroe de la clase `c`, como lo pone el motor (`Equipo::inicial`): arma, torso, guantes, pantalones, botas y montura. */
export function equipoInicial(c: ClaseHeroe, objetos: readonly FichaObjeto[]): FichaObjeto[] {
  const arma = objetos.find((o) => o.tipo === 'arma' && o.clase === c.id && o.tier === 1);
  const armadura = HUECOS_INICIALES.map((h) => objetos.find((o) => o.tipo === 'armadura' && o.hueco === h && o.tipoArmadura === c.armaduraInicial && o.tier === 1));
  const montura = objetos.find((o) => o.id === 'montura_tiro');
  return [arma, ...armadura, montura].filter((o): o is FichaObjeto => Boolean(o));
}

/** Los atributos como puntos (●●●○○), sobre el más alto de todas las clases. */
function puntos(valor: number, tope: number): string {
  return `<span class="clase-puntos" aria-label="${valor}">${'●'.repeat(valor)}<span class="tenue">${'○'.repeat(Math.max(0, tope - valor))}</span></span>`;
}

/**
 * El selector de clase de la pantalla de crear héroe: una fila de botones, uno por clase, y debajo la ficha de la elegida (su armadura, sus
 * atributos de base y su equipo inicial). Sin clase elegida no se puede nacer (`elegida` `null`).
 */
export function htmlSelectorDeClase(clases: readonly ClaseHeroe[], objetos: readonly FichaObjeto[] | null, elegida: string | null, e: Escapar): string {
  const tope = Math.max(1, ...clases.flatMap((c) => ORDEN_DE_ATRIBUTOS.map((a) => c.atributosBase[a] ?? 0)));
  const c = clases.find((x) => x.id === elegida);
  const botones = clases.map((x) => `<button type="button" class="clase-boton${x.id === elegida ? ' elegida' : ''}" data-clase="${e(x.id)}" aria-pressed="${x.id === elegida}">${e(x.nombre)}</button>`).join('');
  const ficha = c
    ? `<div class="clase-ficha">
        <p class="clase-armadura">Armadura ${e(textoDeArmaduras(c))}; empieza con la ${e(c.armaduraInicial)}.</p>
        <div class="clase-atributos">${ORDEN_DE_ATRIBUTOS.map((a) => `<span class="clase-atributo"><span>${NOMBRE_DE_ATRIBUTO[a]}</span>${puntos(c.atributosBase[a] ?? 0, tope)}</span>`).join('')}</div>
        ${objetos ? `<p class="clase-equipo"><span class="tenue">Nace con</span> ${equipoInicial(c, objetos).map((o) => e(o.nombre)).join(', ')}.</p>` : ''}
      </div>`
    : '<p class="clase-ficha tenue">Elige la clase de tu héroe: su arma, la armadura que admite y sus atributos de base.</p>';
  return `<span class="form-label">Clase de tu héroe</span><div class="clase-botones" role="group" aria-label="Clase de tu héroe">${botones}</div>${ficha}`;
}
