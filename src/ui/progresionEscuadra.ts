// La experiencia y la formación de una escuadra (0.205.0, motor 457c278).
//  - La curva (`MILITAR.experienciaParaSubirEscuadra`, Heroe_Y_Tropa §10.2): lo que pide cada nivel para pasar al siguiente, 1.375 en total
//    hasta el 10. La experiencia de la escuadra es la acumulada (`militar::escuadra::nivel_de_escuadra`), así que lo que lleva hacia el
//    siguiente es lo acumulado menos lo que pidieron los niveles ya pasados. En los niveles de `nivelesHabilidadEscuadra` gana una habilidad
//    de Conquest.
//  - La formación (Heroe_Y_Tropa §10.4): la de reposo y las que no piden tecnología, siempre; las cerradas, con Disciplina de formación en
//    la Facción; sin Facción, solo las que no piden nada. Se elige con `elegirFormacion` salvo mientras la escuadra combate (el ticket ya
//    congeló la suya). Cómo es cada una lo decide Conquest.
import { bloqueDeDatos } from '../apiCliente';
import type { Escuadron } from '../tiposDominio';

type Escapar = (valor: string) => string;

interface Militar { experienciaParaSubirEscuadra?: number[]; nivelMaximoEscuadra?: number; nivelesHabilidadEscuadra?: number[] }
export interface FamiliaDeFormacion { id: string; nombre: string; tecnologia: string | null }

const militar = (): Militar | null => bloqueDeDatos<Militar>('MILITAR');
const CURVA = [10, 25, 50, 100, 150, 200, 250, 275, 315];

/** Hacia el siguiente nivel: lo que lleva, lo que pide y el %; `null` en el nivel de tope. */
export function progresoDeEscuadra(s: Pick<Escuadron, 'nivel' | 'experiencia'>): { lleva: number; pide: number; pct: number } | null {
  const curva = militar()?.experienciaParaSubirEscuadra ?? CURVA;
  const tope = militar()?.nivelMaximoEscuadra ?? curva.length + 1;
  if (s.nivel >= tope || s.nivel < 1 || s.nivel > curva.length) return null;
  const pasado = curva.slice(0, s.nivel - 1).reduce((t, x) => t + x, 0);
  const pide = curva[s.nivel - 1]!;
  const lleva = Math.max(0, Math.min(pide, Math.floor(s.experiencia - pasado)));
  return { lleva, pide, pct: Math.round((lleva / pide) * 100) };
}

/** El siguiente nivel en el que la escuadra gana una habilidad, o `null` si ya no le queda ninguno. */
export function siguienteHabilidad(nivel: number): number | null {
  return (militar()?.nivelesHabilidadEscuadra ?? [4, 7, 10]).find((n) => n > nivel) ?? null;
}

/** Las familias de `FORMACIONES`, la de reposo la primera. */
export const familiasDeFormacion = (): FamiliaDeFormacion[] => bloqueDeDatos<{ familias?: FamiliaDeFormacion[] }>('FORMACIONES')?.familias ?? [];

/** Las que puede elegir una escuadra de un héroe con estas tecnologías adoptadas en su Facción (`null`: sin Facción). */
export function formacionesPermitidas(adoptadas: readonly string[] | null): FamiliaDeFormacion[] {
  return familiasDeFormacion().filter((f) => !f.tecnologia || Boolean(adoptadas?.includes(f.tecnologia)));
}

/** El nombre de una familia por su id; la de reposo si viene vacía. */
export function nombreDeFormacion(id: string | undefined): string {
  const fs = familiasDeFormacion();
  return (fs.find((f) => f.id === (id || fs[0]?.id)) ?? null)?.nombre ?? (id || 'En reposo');
}

/** La barra de experiencia de la escuadra en su fila de Tropas. */
export function htmlExperienciaEscuadra(s: Pick<Escuadron, 'nivel' | 'experiencia' | 'prestada'>): string {
  if (s.prestada) return `<span class="base-esc-nivel">nivel ${s.nivel} · no gana experiencia</span>`;
  const p = progresoDeEscuadra(s);
  const hab = siguienteHabilidad(s.nivel);
  const titulo = p ? `Hacia el nivel ${s.nivel + 1}: ${p.lleva} de ${p.pide}${hab ? `. En el nivel ${hab} gana una habilidad nueva` : ''}` : 'En el nivel de tope';
  return `<span class="base-esc-nivel" title="${titulo}">nivel ${s.nivel}${p ? ` <span class="obra-barra base-esc-xp"><i style="width:${p.pct}%"></i></span> ${p.lleva}/${p.pide}` : ' (el tope)'}${hab ? ` · habilidad en el ${hab}` : ''}</span>`;
}

/** El selector de formación de una escuadra; sin él mientras combate (sale la que lleva) o si solo hay una que elegir. */
export function htmlSelectorFormacion(s: Pick<Escuadron, 'id' | 'formacion' | 'enBatalla'>, permitidas: FamiliaDeFormacion[], e: Escapar): string {
  const actual = s.formacion || permitidas[0]?.id || 'reposo';
  if (s.enBatalla) return `<span class="base-formacion" title="La formación se congeló al empezar la batalla">⛨ ${e(nombreDeFormacion(actual))} <em class="heroe-marca">en batalla</em></span>`;
  if (permitidas.length <= 1) return '';
  // Una elegida que la Facción ya no permite (perdió la tecnología) se sigue viendo, marcada: en la batalla irá la de reposo.
  const fuera = permitidas.some((f) => f.id === actual) ? '' : `<option value="${e(actual)}" selected disabled>${e(nombreDeFormacion(actual))} (ya no la permite tu Facción)</option>`;
  return `<label class="base-formacion" title="La formación que adopta en la batalla, si su tropa la tiene; si no, la de reposo"><span>⛨</span><select class="form-input" data-base-formacion="${e(s.id)}" aria-label="Formación">${fuera}${permitidas.map((f) => `<option value="${e(f.id)}"${f.id === actual ? ' selected' : ''}>${e(f.nombre)}</option>`).join('')}</select></label>`;
}
