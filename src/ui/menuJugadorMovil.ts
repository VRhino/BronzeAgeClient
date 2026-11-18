// En un móvil apaisado los botones de la barra del jugador (arriba a la derecha) se juntan en uno solo, que abre una ventana pequeña al centro con
// una fila por opción: el icono a la izquierda y el nombre a la derecha (Víctor, 2026-11-18). Al elegir una, el menú se cierra y se abre la ventana
// de esa opción. Los botones de siempre siguen en la barra (escondidos con CSS en el móvil): el menú los lee y les hace clic, así que no sabe
// nada de qué abre cada uno ni hay que mantener una lista aparte.

/** El botón que se ve en el móvil (la barra lo lleva siempre; el CSS lo enseña solo ahí). */
export const BOTON_MENU_JUGADOR = '<button type="button" class="jugador-menu-boton" data-menu-jugador aria-haspopup="dialog" title="Menú" aria-label="Menú"><svg class="jugador-icono" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';

function cerrar(): void {
  document.querySelector('.menu-jugador-velo')?.remove();
}

function abrir(botones: HTMLElement): void {
  cerrar();
  const filas = Array.from(botones.querySelectorAll<HTMLButtonElement>(':scope > button:not(.jugador-menu-boton)')).map((b, i) => {
    const nombre = b.getAttribute('aria-label') || b.title || ((b.textContent ?? '').trim() === '?' ? 'Información' : '');
    const svg = b.querySelector('svg');
    const icono = svg ? svg.outerHTML : `<span class="menu-jugador-glifo" aria-hidden="true">${(b.textContent ?? '').trim().slice(0, 2)}</span>`;
    const aviso = Array.from(b.querySelectorAll<HTMLElement>('.jugador-badge')).find((x) => !x.hidden && (x.textContent ?? '').trim() !== '');
    return `<button type="button" class="menu-jugador-fila${b.classList.contains('activo') ? ' activo' : ''}" data-menu-jugador-fila="${i}">`
      + `<span class="menu-jugador-icono">${icono}</span><span class="menu-jugador-nombre">${nombre.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</span>`
      + `${aviso ? `<b class="menu-jugador-aviso">${(aviso.textContent ?? '').replace(/[&<>"']/g, '')}</b>` : ''}</button>`;
  }).join('');
  const velo = document.createElement('div');
  velo.className = 'menu-jugador-velo';
  velo.innerHTML = `<div class="menu-jugador" role="dialog" aria-label="Menú">${filas}</div>`;
  velo.addEventListener('click', (ev) => {
    const fila = (ev.target as HTMLElement).closest<HTMLElement>('[data-menu-jugador-fila]');
    if (!fila) { if (ev.target === velo) cerrar(); return; }
    const boton = botones.querySelectorAll<HTMLButtonElement>(':scope > button:not(.jugador-menu-boton)')[Number(fila.dataset.menuJugadorFila)];
    cerrar();
    boton?.click();
  });
  document.body.appendChild(velo);
}

let instalado = false;
/** Una sola vez al arrancar: el clic en el botón del menú (de cualquier barra, que se repinta a menudo) y Esc para cerrarlo. */
export function instalarMenuJugadorMovil(): void {
  if (instalado) return;
  instalado = true;
  document.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-menu-jugador]');
    const botones = b?.closest<HTMLElement>('.jugador-botones');
    if (b && botones) abrir(botones);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrar(); });
}
