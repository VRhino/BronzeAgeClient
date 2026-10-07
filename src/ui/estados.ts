// ESTADOS ACTIVOS («debuffs») del jugador, en la barra superior: un icono pequeño y el nombre; al pasar el cursor, la descripción. Se ven igual en
// el mapa, el campamento y el asentamiento. Todo sale de la proyección (ninguna regla nueva): las descripciones cuentan lo que el backend ya aplica.
//   Herido            heroe.heridoHasta (Doc 5.16.4)
//   Saliendo del mundo heroe.desconectaEn (Doc 1.10.6)
//   Sin ración / Deserción   moral de tus escuadras en campaña (Doc 5.4: −20 por minuto sin ración; a 0 deserta un 5 % por minuto)
//   Plaza ocupada     asentamientos[0].ocupacionHasta (Doc 5.12.9), solo dentro
//   Hambre / Hambruna asentamientos[0].nutricionPoblacion (Doc 4.1), solo dentro
import type { ProyeccionJugador } from '../apiCliente';

interface Estado {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
}

/** Iconos de 16×16 dibujados aquí mismo (trazo claro sobre la barra oscura). */
const ICONO: Record<string, string> = {
  herido: '<path d="M8 1.5C8 1.5 3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="#d9573b"/><path d="M6.5 10.5h3M8 9v3" stroke="#fff" stroke-width="1.4"/>',
  desconexion: '<path d="M4 1.5h8M4 14.5h8M5 1.5c0 4 6 4 6 6.5S5 10.5 5 14.5M11 1.5c0 4-6 4-6 6.5s6 2.5 6 6.5" fill="none" stroke="#e0c070" stroke-width="1.3"/>',
  moral: '<path d="M3.5 1v14" stroke="#c9b27c" stroke-width="1.4"/><path d="M4 2h8.5l-2.5 3 2.5 3H4z" fill="#a0672d"/><path d="M6 3.5l4 4M10 3.5l-4 4" stroke="#d9573b" stroke-width="1.3"/>',
  ocupada: '<path d="M2 2l12 12M14 2L2 14" stroke="#d9573b" stroke-width="1.8"/><path d="M2 12l2 2M14 12l-2 2" stroke="#e0c070" stroke-width="2"/>',
  hambre: '<path d="M8 15V5M8 6c-2-1-3-3-3-4 2 0 3 2 3 4zm0 0c2-1 3-3 3-4-2 0-3 2-3 4zM8 10c-2-1-3-3-3-4 2 0 3 2 3 4zm0 0c2-1 3-3 3-4-2 0-3 2-3 4z" fill="#d6a437" stroke="#d6a437" stroke-width=".6"/><path d="M2 14L14 2" stroke="#d9573b" stroke-width="1.6"/>',
};

function minutos(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function estadosActivos(p: ProyeccionJugador): Estado[] {
  const lista: Estado[] = [];
  const h = p.heroe;
  if (h.heridoHasta !== undefined && h.heridoHasta > p.instante) {
    lista.push({ id: 'herido', icono: 'herido', nombre: 'Herido', descripcion: `Perdiste un combate. Durante ${minutos(h.heridoHasta - p.instante)} no atacas ni persigues, no te pueden perseguir y tus escuadras no combaten sin ti.` });
  }
  if (h.desconectaEn !== undefined && h.desconectaEn > p.instante) {
    lista.push({ id: 'desconexion', icono: 'desconexion', nombre: 'Saliendo del mundo', descripcion: `No hay ningún cliente tuyo conectado: si no vuelves en ${minutos(h.desconectaEn - p.instante)}, tu héroe sale del mundo con su columna.` });
  }
  const enCampana = h.escuadrones.filter((s) => s.contenedor.tipo === 'ejercito' && s.cantidad > 0);
  const peor = enCampana.reduce<number | null>((min, s) => (min === null || s.moral < min ? s.moral : min), null);
  if (peor !== null && peor <= 0) {
    lista.push({ id: 'desercion', icono: 'moral', nombre: 'Deserción', descripcion: 'Una escuadra de tu columna tiene la moral a 0 por falta de ración: cada minuto deserta un 5 % de sus hombres. Lleva trigo en el carro.' });
  } else if (peor !== null && peor < 50) {
    lista.push({ id: 'sin-racion', icono: 'moral', nombre: `Moral baja (${Math.round(peor)})`, descripcion: 'Tu columna se queda sin ración: la moral baja 20 por minuto sin trigo y sube 5 con él. A 0, las escuadras empiezan a desertar.' });
  }
  const plaza = p.asentamientos[0];
  if (plaza?.ocupacionHasta !== undefined && plaza.ocupacionHasta > p.instante) {
    lista.push({ id: 'ocupada', icono: 'ocupada', nombre: 'Plaza ocupada', descripcion: `${plaza.nombre ?? 'Esta plaza'} está bajo ocupación militar ${minutos(plaza.ocupacionHasta - p.instante)} más: no se la puede volver a asediar, recauda y crece menos y su mantenimiento está congelado.` });
  }
  if (plaza?.nutricionPoblacion !== undefined && plaza.nutricionPoblacion < 100) {
    const n = Math.round(plaza.nutricionPoblacion);
    lista.push(n <= 0
      ? { id: 'hambruna', icono: 'hambre', nombre: 'Hambruna', descripcion: `No hay trigo para la población de ${plaza.nombre ?? 'la plaza'}: está muriendo gente (los nobles comen primero).` }
      : { id: 'hambre', icono: 'hambre', nombre: `Hambre (${n})`, descripcion: `El trigo no alcanza para la población de ${plaza.nombre ?? 'la plaza'}: no crece, y si la nutrición llega a 0 empieza a morir gente.` });
  }
  return lista;
}

/** Los estados como chips: icono + nombre, y la descripción en un tooltip propio (también accesible con el foco del teclado). */
export function htmlEstados(p: ProyeccionJugador, e: (s: string) => string): string {
  return estadosActivos(p)
    .map((x) => `<span class="estado" tabindex="0" aria-label="${e(x.nombre)}: ${e(x.descripcion)}"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONO[x.icono] ?? ''}</svg>${e(x.nombre)}<span class="estado-tip" role="tooltip"><strong>${e(x.nombre)}</strong>${e(x.descripcion)}</span></span>`)
    .join('');
}
