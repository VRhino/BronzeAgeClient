// Secciones plegables (`<details>`) que recuerdan si estaban abiertas: los paneles se repintan con cada refresco y un `<details>` nuevo nacería
// cerrado. Cada una lleva una clave; las abiertas se guardan aquí mientras dura la sesión.

const abiertas = new Set<string>();

/** Una sección plegable: `resumen` es la línea que se ve siempre (HTML ya escapado) y `cuerpo` lo que se despliega. */
export function plegable(clave: string, resumen: string, cuerpo: string, abiertaPorDefecto = false): string {
  const abierta = abiertas.has(clave) || (abiertaPorDefecto && !abiertas.has(`!${clave}`));
  return `<details class="plegable" data-plegable="${clave.replace(/"/g, '&quot;')}"${abierta ? ' open' : ''}><summary>${resumen}</summary><div class="plegable-cuerpo">${cuerpo}</div></details>`;
}

/** Recuerda lo que el jugador abre o cierra dentro de `raiz`. */
export function cablearPlegables(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLDetailsElement>('details[data-plegable]').forEach((d) => d.addEventListener('toggle', () => {
    const clave = d.dataset.plegable!;
    if (d.open) { abiertas.add(clave); abiertas.delete(`!${clave}`); } else { abiertas.delete(clave); abiertas.add(`!${clave}`); }
  }));
}
