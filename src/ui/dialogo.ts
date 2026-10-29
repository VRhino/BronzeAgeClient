// Cuadros de confirmación y aviso con la interfaz del juego, en vez de los `confirm`/`alert` del navegador: un velo sobre la pantalla y un cuadro
// de bronce centrado. Escape (o pulsar fuera) cancela; Intro acepta. Solo hay uno a la vez: abrir otro cierra el anterior como cancelado.

let cerrarAbierto: ((ok: boolean) => void) | null = null;

const escapar = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface OpcionesDialogo {
  titulo?: string;
  /** Texto del botón de aceptar («Aceptar» si falta). */
  aceptar?: string;
  /** Texto del botón de cancelar; `null`, sin él (un aviso). */
  cancelar?: string | null;
  /** Lo que se acepta no tiene vuelta atrás: el botón va en rojo. */
  peligro?: boolean;
}

function abrir(texto: string, o: OpcionesDialogo): Promise<boolean> {
  cerrarAbierto?.(false);
  return new Promise((resolver) => {
    const velo = document.createElement('div');
    velo.className = 'dialogo-velo';
    const cancelar = o.cancelar === undefined ? 'Cancelar' : o.cancelar;
    velo.innerHTML = `<div class="dialogo" role="${cancelar === null ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="dialogo-titulo">
      <h3 id="dialogo-titulo" class="dialogo-titulo">${escapar(o.titulo ?? (cancelar === null ? 'Aviso' : '¿Seguro?'))}</h3>
      <p class="dialogo-texto">${escapar(texto)}</p>
      <div class="dialogo-botones">
        ${cancelar !== null ? `<button type="button" class="btn-secondary" data-dialogo="no">${escapar(cancelar)}</button>` : ''}
        <button type="button" class="btn-primary${o.peligro ? ' dialogo-peligro' : ''}" data-dialogo="si">${escapar(o.aceptar ?? 'Aceptar')}</button>
      </div>
    </div>`;
    const previo = document.activeElement as HTMLElement | null;
    const cerrar = (ok: boolean): void => {
      if (cerrarAbierto !== cerrar) return;
      cerrarAbierto = null;
      document.removeEventListener('keydown', teclas, true);
      velo.remove();
      previo?.focus?.();
      resolver(ok);
    };
    const teclas = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cerrar(cancelar === null); }
      else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); cerrar(true); }
    };
    cerrarAbierto = cerrar;
    velo.addEventListener('click', (ev) => {
      if (ev.target === velo) cerrar(cancelar === null);
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-dialogo]');
      if (b) cerrar(b.dataset.dialogo === 'si');
    });
    document.addEventListener('keydown', teclas, true);
    document.body.appendChild(velo);
    velo.querySelector<HTMLButtonElement>('[data-dialogo="si"]')?.focus();
  });
}

/** Pide confirmación: `true` si el jugador acepta. */
export function confirmar(texto: string, o: Omit<OpcionesDialogo, 'cancelar'> & { cancelar?: string } = {}): Promise<boolean> {
  return abrir(texto, o);
}

/** Un aviso con un solo botón. */
export function avisar(texto: string, titulo = 'Aviso'): Promise<void> {
  return abrir(texto, { titulo, cancelar: null }).then(() => undefined);
}
