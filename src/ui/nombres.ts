// Nombre de un héroe para pintarlo en lugar de su id (`heroe-59`). Cada mensaje del servidor trae el nombre de los héroes que nombra
// (`nombres_heroes`), que se van juntando en el almacén y llegan aquí en `nombresDeCompaneros`, junto con tu propio héroe y los ajenos a la
// vista. Sin nombre, «Héroe N».
import type { ProyeccionJugador } from '../apiCliente';

export function nombreDeHeroe(proyeccion: ProyeccionJugador, heroeId: string): string {
  if (heroeId === proyeccion.heroeId) return proyeccion.heroe.displayName;
  return (
    proyeccion.nombresDeCompaneros[heroeId] ??
    proyeccion.nombresDeDirigentes?.[heroeId] ??
    proyeccion.heroesVisibles.find((h) => h.heroeId === heroeId)?.displayName ??
    sinNombre(heroeId)
  );
}

/** Un héroe sin nombre (creado antes de que el motor los guardara, o sin publicar): «Héroe N», como lo proyecta el motor. */
function sinNombre(heroeId: string): string {
  const n = /^heroe-(\d+)$/.exec(heroeId);
  return n ? `Héroe ${n[1]}` : heroeId;
}
