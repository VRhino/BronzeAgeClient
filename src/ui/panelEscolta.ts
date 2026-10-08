// Panel «ESCOLTA» de la plaza (backend Doc 3.13.4, 2026-10-08): ceder escuadras de tu campamento a una caravana comercial PARADA en su origen.
// El cupo es de la caravana, en puntos de Liderazgo (lo da el Mercado del origen: `caravanas[].escoltaLiderazgo { usado, cupo }`, derivado por el backend:
// no se calcula aquí) y lo comparten los residentes; ceder NO gasta el Liderazgo de quien presta. Cada escuadra gasta su `costeLiderazgo` (por escalón,
// no por hombres que le queden). Comandos: `asignarEscolta { caravanaId, heroeId, escuadronIds }` y `quitarEscolta { caravanaId, heroeId, escuadronIds? }`;
// si no cabe, `comercio.caravana_invalida`. Las escuadras vuelven a su campamento al acabar el viaje.
import type { ProyeccionJugador } from '../apiCliente';
import type { Asentamiento, Caravana, Escuadron } from '../tiposDominio';
import { chipLiderazgo } from './liderazgo';
import type { Ejecutar } from './panelCarro';

type Escapar = (valor: string) => string;

const ESTADO: Record<string, string> = {
  disponible: 'parada en su origen',
  preparando: 'cargando para salir',
  adjunta: 'enganchada a un ejército',
  aparcada: 'aparcada en una plaza',
  en_transito: 'en camino',
  retornando: 'de vuelta',
};

/** Los residentes de la plaza (los que llegaron fundando o compraron casa): son los que tienen su campamento y pueden ceder escolta ahí. */
function resideAqui(p: ProyeccionJugador, a: Asentamiento): boolean {
  return [...(a.heroesFundadoresIds ?? []), ...(a.casasCompradas ?? [])].includes(p.heroeId);
}

function barra(usado: number, cupo: number, e: Escapar): string {
  const libre = Math.max(0, cupo - usado);
  return `<div class="escolta-barra${usado >= cupo ? ' llena' : ''}" title="Liderazgo de la escolta: lo que gastan las escuadras cedidas sobre el cupo de la caravana"><i style="width:${cupo > 0 ? Math.min(100, (usado / cupo) * 100).toFixed(1) : 0}%"></i></div>
    <small class="escolta-cifras"><strong>${usado}/${cupo} pts</strong> de Liderazgo · quedan ${e(String(libre))}</small>`;
}

function tarjeta(c: Caravana, p: ProyeccionJugador, a: Asentamiento, reside: boolean, e: Escapar): string {
  const destino = c.destinoAsentamientoId ? ` → ${e(p.asentamientos.find((x) => x.id === c.destinoAsentamientoId)?.nombre ?? c.destinoAsentamientoId)}` : '';
  const cabecera = `<strong class="heroe-sub">Caravana ${e(c.id)}${destino} · ${ESTADO[c.estado ?? 'disponible'] ?? e(c.estado ?? '')}</strong>`;
  const lid = c.escoltaLiderazgo;
  if (!lid) return `<div class="escolta-caravana">${cabecera}<p class="asent-lado-nota">El backend no publica su cupo de escolta.</p></div>`;
  const cedidas = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'escolta' && s.contenedor.caravanaId === c.id);
  const mias = cedidas.reduce((t, s) => t + s.costeLiderazgo, 0);
  const deOtros = Math.max(0, lid.usado - mias);
  const parada = c.estado === 'disponible' && c.origenAsentamientoId === a.id;
  const libre = lid.cupo - lid.usado;
  const candidatas: Escuadron[] = p.heroe.escuadrones.filter((s) => s.contenedor.tipo === 'campamento' && !s.enGuarnicion && s.cantidad > 0);

  const cedidasHtml = cedidas.length > 0
    ? `<div class="mapa-lista">${cedidas.map((s) => `<div class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres</span></div>${parada ? `<button class="btn-secondary" type="button" data-quitar-escolta="${e(s.id)}" data-caravana="${e(c.id)}">Retirar</button>` : ''}</div>`).join('')}</div>`
    : '<p class="asent-lado-nota">No has cedido ninguna escuadra a esta caravana.</p>';
  const libresHtml = !parada
    ? '<p class="asent-lado-nota">La escolta solo se cambia con la caravana parada en su origen.</p>'
    : !reside
      ? '<p class="asent-lado-nota">Solo quien reside en esta plaza cede escolta: ahí está su campamento.</p>'
      : candidatas.length === 0
        ? '<p class="asent-lado-nota">No tienes escuadras libres en el campamento (las de guarnición, columna o escolta no se pueden ceder).</p>'
        : `<div class="mapa-lista">${candidatas.map((s) => {
            const cabe = s.costeLiderazgo <= libre;
            return `<div class="mapa-lista-item"><div><strong>${e(s.nombre)}</strong> ${chipLiderazgo(s)}<span>${s.cantidad} hombres${cabe ? '' : ` · no cabe: quedan ${Math.max(0, libre)} pts`}</span></div><button class="btn-secondary" type="button" data-ceder-escolta="${e(s.id)}" data-caravana="${e(c.id)}"${cabe ? '' : ' disabled'}>Ceder</button></div>`;
          }).join('')}</div>`;

  return `<div class="escolta-caravana">${cabecera}
    ${barra(lid.usado, lid.cupo, e)}
    ${deOtros > 0 ? `<p class="asent-lado-nota">Otros residentes han cedido ${deOtros} pts.</p>` : ''}
    <span class="heroe-sub">Tus escuadras cedidas</span>${cedidasHtml}
    <span class="heroe-sub">Escuadras que puedes ceder</span>${libresHtml}</div>`;
}

export function htmlEscolta(p: ProyeccionJugador, a: Asentamiento, e: Escapar): string {
  const reside = resideAqui(p, a);
  const caravanas = p.caravanas.filter((c) => c.tipo === 'comercial' && c.origenAsentamientoId === a.id);
  return `<span class="faction-kicker">Escolta de caravanas</span>
    <p class="asent-lado-nota">Cede escuadras de tu campamento a una caravana comercial parada en tu plaza: viajarán con ella y volverán al campamento al acabar el viaje. El cupo es de la caravana, en puntos de Liderazgo (lo da tu Mercado) y lo comparten los residentes. Ceder no gasta tu Liderazgo.</p>
    ${caravanas.length === 0 ? '<p class="mapa-lista-vacia">No hay caravanas comerciales de esta plaza. Se lanzan desde el Mercado.</p>' : caravanas.map((c) => tarjeta(c, p, a, reside, e)).join('')}
    <p class="faction-error" data-campo="error-escolta" role="alert"></p>`;
}

export function cablearEscolta(raiz: HTMLElement, p: ProyeccionJugador, ejecutar: Ejecutar): void {
  const error = raiz.querySelector<HTMLElement>('[data-campo="error-escolta"]');
  const enviar = (tipo: 'asignarEscolta' | 'quitarEscolta', atributo: string) =>
    raiz.querySelectorAll<HTMLButtonElement>(`[${atributo}]`).forEach((boton) =>
      boton.addEventListener('click', async () => {
        const botones = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'));
        const antes = botones.map((b) => b.disabled);
        botones.forEach((b) => { b.disabled = true; });
        const mensaje = await ejecutar(tipo, { caravanaId: boton.dataset.caravana!, heroeId: p.heroeId, escuadronIds: [boton.getAttribute(atributo)!] });
        // Con éxito el refresco repinta el panel; si falla, se reabren los botones y se dice por qué.
        if (mensaje !== null) {
          botones.forEach((b, i) => { b.disabled = antes[i]!; });
          if (error) error.textContent = mensaje;
        }
      })
    );
  enviar('asignarEscolta', 'data-ceder-escolta');
  enviar('quitarEscolta', 'data-quitar-escolta');
}
