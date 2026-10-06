// Validación de «Crear Facción» ANTES de enviar. El backend solo devuelve el primer fallo (`crearFaccion.ts`: nombre vacío, nombre repetido, sigilo
// inválido o repetido, ya perteneces, cooldown); aquí se enseñan TODOS los que se pueden detectar con lo que trae la proyección, con su remedio.
// Las reglas son copia de `engine/sigilo.ts` y `session/comandos/crearFaccion.ts`; quien decide sigue siendo el backend. El cooldown de creación
// no se puede comprobar desde aquí (no viaja): sale del rechazo, traducido en `erroresServidor.ts`.
import type { ProyeccionJugador } from '../apiCliente';
import { CATALOGO_SIGILO } from '../sigilo/sigilo';
import type { Sigilo } from '../tiposDominio';

/** Idénticos a ojos del backend: el color de la orla no cuenta si no hay orla. */
function mismoSigilo(a: Sigilo, b: Sigilo): boolean {
  return (
    a.formaId === b.formaId && a.campoId === b.campoId && a.emblemaId === b.emblemaId &&
    a.colorPrimarioId === b.colorPrimarioId && a.colorSecundarioId === b.colorSecundarioId && a.colorEmblemaId === b.colorEmblemaId &&
    a.orlaId === b.orlaId && (a.orlaId === 'ninguna' || a.colorOrlaId === b.colorOrlaId)
  );
}

function delCatalogo(s: Sigilo): boolean {
  const colores = CATALOGO_SIGILO.colores.map((c) => c.id) as string[];
  return (
    (CATALOGO_SIGILO.formas as readonly string[]).includes(s.formaId) &&
    (CATALOGO_SIGILO.campos as readonly string[]).includes(s.campoId) &&
    (CATALOGO_SIGILO.emblemas as readonly string[]).includes(s.emblemaId) &&
    (CATALOGO_SIGILO.orlas as readonly string[]).includes(s.orlaId) &&
    [s.colorPrimarioId, s.colorSecundarioId, s.colorEmblemaId, s.colorOrlaId].every((c) => colores.includes(c))
  );
}

/** Todos los motivos por los que `crearFaccion` rechazaría este nombre y este sigilo; vacío = nada que objetar desde aquí. */
export function motivosParaCrearFaccion(p: ProyeccionJugador, nombre: string, sigilo: Sigilo | null): string[] {
  const motivos: string[] = [];
  const limpio = nombre.trim();
  if (!limpio) motivos.push('Escribe un nombre para la Facción.');
  else {
    const igual = p.facciones.find((f) => f.nombre.trim().toLowerCase() === limpio.toLowerCase());
    if (igual) motivos.push(`Ya existe una Facción llamada «${igual.nombre}»: elige otro nombre (no distingue mayúsculas).`);
  }
  if (!sigilo) motivos.push('Elige el sigilo completo: forma, fondo y colores.');
  else {
    if (!delCatalogo(sigilo)) motivos.push('Alguna pieza del sigilo no es del catálogo del servidor: recarga la página.');
    if (sigilo.colorPrimarioId === sigilo.colorSecundarioId) motivos.push('El color principal y el secundario del fondo son el mismo: cambia uno de los dos.');
    const repetido = p.facciones.find((f) => f.sigilo && mismoSigilo(f.sigilo, sigilo));
    if (repetido) motivos.push(`La Facción «${repetido.nombre}» ya lleva exactamente este sigilo: cambia alguna pieza o color (los parecidos sí valen).`);
  }
  const actual = p.facciones.find((f) => f.id === p.faccionId);
  if (p.faccionId !== null) motivos.push(`Ya perteneces a la Facción «${actual?.nombre ?? p.faccionId}»: para crear otra tendrías que dejarla antes.`);
  return motivos;
}
