# Petición al Backend (2026-10-09)

**Enviada a la sesión de Backend el 2026-10-09 con permiso del usuario. Respondida: A0 a A5 están hechos (commits 94b0641 a 4e037c4 del servidor); el cliente los usa desde 0.28.0. Lo que queda abierto está en `Features_Pendientes.md` §3.** Reúne lo que los bloques de 0.26.0 anotaron como «necesita Backend», **contrastado contra el canon (`Docs/Game`) y el código del servidor (`BronzeAgeFase0@1e5351c`)**.

Se descartó lo que el cliente ya puede resolver solo y lo que el canon no pide (ver «Descartado»).

## A. Peticiones (el cliente no puede resolverlas solo)

### A0. Aceptación de alianza y vasallaje, como anexión y fusión · decidido por el autor
Hoy `proponerRelacion` deja la relación `activa` al instante («Fase 0 acepta la propuesta al instante», `engine/diplomacia.ts`): un vasallaje se impone sin consentimiento. **El autor decide que hace falta aceptar**, tal cual lo tienen anexión y fusión (Doc 2.6):
- `proponerRelacion` (alianza o vasallaje) deja una **propuesta pendiente**; la proponen el Rey o el Embajador de la Facción que propone, y la contesta **el Rey de la otra** con un comando nuevo `responderRelacion { propuestaId, aceptar }`; el proponente puede retirarla (`retirarRelacion { propuestaId }`, como `retirarAnexion`/`retirarFusion`).
- Aceptar la ejecuta en el acto (nace la relación `activa`, con el tributo pactado en el vasallaje). **Caduca** a los N días de mundo como la anexión, y entre dos Facciones una sola propuesta pendiente en cualquier sentido (a decidir por Backend: lo más coherente es seguir el patrón de `ANEXION`).
- Reglas a revalidar al aceptar (patrón de anexión/fusión): ambas Facciones existen y siguen teniendo Rey, ninguna es ya vasalla de un tercero para un vasallaje, sin batalla abierta, sin guerra entre ambas.
- La proyección debe traer las propuestas de relación vigentes (como `propuestasAnexion`/`propuestasFusion`: `propuestasRelacion`, hechas o recibidas por mi Facción), con `tipo`, facciones, tributo y `expiraEn`.
- `declararGuerra` y `proponerPaz` no cambian.
El cliente construirá la interfaz (propuestas recibidas con Aceptar y Rechazar, enviadas con Retirar) en cuanto estén el comando y el campo de la proyección.

### A1. Publicar en `GET /v1/balance` lo que hoy solo está en `constants.ts` · prioridad alta
El cliente copia a mano o no puede mostrar precios y topes que el canon define.
| Qué | Dónde está hoy | Para qué lo usa el cliente |
|---|---|---|
| `CARRO_CATALOGO`, `ANIMAL_CATALOGO` (coste, capacidad base, factor de carga, velocidad) | `constants.ts` (Doc 3.13.2) | precio de carros y animales antes de pagar; capacidad y velocidad de cada caravana, derivadas (`capacidadCaravana`) |
| `RECLUTAMIENTO_ORO_POR_ESCALON`, `ORO_POR_CABALLO` | `constants.ts` (Doc 5.8) | precio de reclutar en plaza |
| Reclutar en campamento (Doc 5, 2026-10-02): precio por soldado, tropas desbloqueadas por la tecnología del campamento y población | `MERCENARIOS.*` (parcial: sí están `recargo`, `valorEquipoEnOro`, `descuentoSinAsentamientos`) | **mejor en la proyección del campamento donde estás**, como `mercadoCampamento`: `reclutamiento: { tropas: [{ tropaId, precioPorSoldado, desbloqueada }], poblacion }` |
| `MOVIMIENTO.radioInspeccion` (40) y `radioPuerta` (10) | `constants.ts` | hoy van copiados en `ui/interaccionAjena.ts`, `panelIntel.ts`, `panelFundacionDePlaza.ts`, `mercadoDePlaza.ts` |
| `CAPITAL.cooldownDias` (14) y `PUERTA.cerradaAPorDefecto` | `constants.ts` | copiados en `panelResidencia.ts` y `panelPuerta.ts` |

### A2. Catálogo de tecnología y Aedas (Doc 6) · prioridad alta
`TECNOLOGIAS` (nombre, Era, logro, hito, `bonusProduccion`), `ERAS`, `TARIFA_ADOPCION`, `AEDAS` (`venta.factorOro`, `enfriamientoMinutos`) y `EPICAS`. Hoy el panel «Tecnología» solo tiene el id de cada tecnología (lo escribe sin acentos) y copia a mano las tarifas y el enfriamiento de 6 h.
Y en la proyección de la tecnología propia: la **Era de cada aparecida o adoptada** (sin ella no se puede decir cuánto cuesta adoptar o comprar), el **id de la plaza capital** de tu Facción (hoy solo viaja `capitalDeFaccionId` en la plaza donde estás dentro, y `Faccion.capitalDesignadaEn`), el **progreso del hito** de las reveladas y **qué tecnologías admiten épica**.

### A3. Una vasalla puede llamar a `romperRelacion` sobre su propio vasallaje · prioridad media
**Contra el canon:** Doc 2.4 da 4 vías de ruptura del vasallaje (rebelión forzada del vasallo, liberación voluntaria **por el señor**, conquista por un tercero, señor desarmado). Que la vasalla rompa con `romperRelacion` no es ninguna de ellas, y además da +6 de reputación a la señora. El motor lo permite. La interfaz solo le ofrece la rebelión.

### A4. `perseguir` no valida lo que el canon prohíbe · prioridad media
Doc 5.12.3 (tabla de interacciones) y 5.14: no se persigue a aliados (dos columnas aliadas no se atacan), un ejército no persigue caravanas, y entre un ejército y una columna personal solo se inspecciona. El servidor no impide perseguir a un aliado ni ejército→caravana ni que un no‑Líder persiga. El cliente apaga lo que el canon prohíbe, pero el motor debería rechazarlo.

### A5. Pequeños, de comodidad · prioridad baja
- **El resultado de `inspeccionar` no queda en la proyección:** solo viaja en `resultado.datos`, así que se pierde al recargar. Un `informesDeInspeccion` temporal en la proyección lo arreglaría (decisión de diseño: ¿cuánto dura?).
- **`caravanasAvistadas.escoltada`** solo significa «adjunta a un ejército»; una caravana con escolta cedida sin héroe (`escoltaIds`) llega como no escoltada.
- **Almacén de tus plazas desde el mundo:** con la columna a la puerta de tu plaza, la plaza llega como avistada sin almacén; `cargarCaravana` lo exige y el selector no puede decir cuánto hay. Y `permiteReabastecerAliados` de plazas aliadas, por si el almacén de una aliada se abre. (Pregunta de diseño: el canon de 2.5 pide estar dentro para construir y comerciar, pero `cargarCaravana` desde la puerta ya está permitido.)
- **Lista de partidas** (`GET /jugador/partidas`): nombre y estado de partida (hoy solo `gameId` y `estado: 'activa'`).
- **Evento de posición** (o un tick por el canal) para quitar el sondeo de 3 s.

## B. Decisiones del autor ya tomadas

1. **Alianza y vasallaje exigen aceptación** → ver A0.
2. **El trazado de los campamentos de bandidos no existe** en el canon: se descarta (el cliente conserva el plano esquemático y no lo espera).

## C. Descartado tras contrastar (el cliente ya lo resuelve o el canon no lo pide)

| Antes decía | Resultado |
|---|---|
| Estado de la puerta, vetos y capital no viajan (A1) | **Sí viajan**: la plaza donde estás va entera (`asentamientos: [dentroDe]`, objeto de dominio completo con `puertaCerradaA`, `vetadosIds`, `capitalDeFaccionId`); `facciones` pasa tal cual (`capitalDesignadaEn`). Solo faltan las constantes de A1. |
| Enfriamiento de residencia no viaja (A1) | **Ya está en el balance** (`cuposYNiveles.CIUDADANIA`): fallo del cliente, se lee de ahí. |
| Si una plaza ajena tiene Mercado activo (D3) | **Ya viaja**: las avistadas llevan `edificios` activos; el cliente puede comprobarlo. |
| Lista de plazas de la Facción (2.1.7) | Probablemente **ya resuelto**: las plazas propias son ojos de la Facción y salen siempre como avistadas (`seVeAhora`); falta confirmarlo en vivo. |
| Capacidad de cada caravana como campo | Se cubre con A1 (publicar `CARRO_CATALOGO` y `ANIMAL_CATALOGO`): el cliente la deriva, no hace falta un campo. |
| Trazado de bandidos (§10.4 antiguo) | No existe en el canon (decisión del autor): se descarta. |
| Consumo por edificio y producción por edificio individual (F) | El canon no lo pide (el consumo es por receta y población); la producción por tipo basta. No se pide. |
| `diplomacia.invalida` llega genérico (E1) | No verificado en el servidor; se comprobará antes de pedirlo. |

## D. Trabajo de cliente que sale de este contraste
- **Leer `CIUDADANIA.cooldownCambioResidenciaDias` del balance** y mostrarlo en la pestaña Residencia (hoy el aviso es genérico).
- **Usar `edificios` de la plaza avistada** para avisar de «sin Mercado» en la ficha de orden ajena (D3).
- **Cupo de la flota** (nuevo canon, `1e5351c`, 2026-10-09): el Mercado limita cuántas caravanas (`cupoCaravanas` 2/4/6) y **cuántos carros en total** (`cupoCarros` 3/9/18, Doc 3.13.2) puede tener la plaza. Ya está en `EDIFICIO_CATALOGO.mercado.niveles` del balance: mostrarlo en Mercado › Caravanas («carros 4/9») y apagar «＋ Carro» con el motivo cuando la flota esté llena.
- **Eventos de tiempo real** (`9ab4e62`): ahora dicen de qué partida son; filtrar por `gameId` en `alEventoTiempoReal` por si hay más de una partida abierta.
