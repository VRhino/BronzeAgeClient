// El coste de Liderazgo de una escuadra (`costeLiderazgo`, lo calcula el backend por escalón de la tropa), como una marca pequeña junto a su nombre.
export const chipLiderazgo = (s: { costeLiderazgo: number }): string =>
  `<span class="lid-chip" title="Coste de Liderazgo de esta escuadra (por escalón de la tropa, no por hombres)">♛ ${s.costeLiderazgo}</span>`;
