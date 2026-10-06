// Nombre de un héroe para pintarlo en lugar de su id (`heroe-59`). La proyección trae tres fuentes, de más a menos cercana: tu propio héroe, los
// ciudadanos de tu Facción (`nombresDeCompaneros`, se les vea o no) y el Rey y el Embajador de CADA Facción (`nombresDeDirigentes`), más los héroes
// ajenos que se ven. Sin ninguna, el id: nadie más se publica.
import type { ProyeccionJugador } from '../apiCliente';

export function nombreDeHeroe(proyeccion: ProyeccionJugador, heroeId: string): string {
  if (heroeId === proyeccion.heroeId) return proyeccion.heroe.displayName;
  return (
    proyeccion.nombresDeCompaneros[heroeId] ??
    proyeccion.nombresDeDirigentes?.[heroeId] ??
    proyeccion.heroesVisibles.find((h) => h.heroeId === heroeId)?.displayName ??
    heroeId
  );
}
