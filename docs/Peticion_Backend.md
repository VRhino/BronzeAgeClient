# Petición al Backend — borrador (2026-10-09)

**Borrador sin enviar**: reúne lo que dejaron anotado los bloques de 0.26.0 como «necesita Backend». Requiere el permiso del usuario antes de mandarse a la sesión de Backend. Cada punto dice quién lo pide (bloque) y qué se hace mientras tanto en el cliente.

## Bloque A1 — Plaza › Centro urbano: Muralla, Puerta y Residencia
- Asumido, no confirmado: que la proyección de las plazas propias trae `puertaCerradaA`, `vetadosIds` y `capitalDeFaccionId` (el dominio los tiene y las plazas propias viajan completas, pero `proyecciones/jugador.ts` no los nombra). Sin ellos la pestaña Puerta muestra el cierre por defecto y ningún vetado; los formularios funcionan igual.
- Candidatos al veto: solo los ciudadanos de la Facción y los héroes a la vista (no hay lista de héroes de otras Facciones).
- El enfriamiento de residencia (`CIUDADANIA.cooldownCambioResidenciaDias`) no viaja: el aviso es genérico. El de capital (14 días) está copiado a mano de `CAPITAL.cooldownDias`.

## Bloque A2 — Tesorería y Caravana de Fundación desde la plaza
- Nada bloqueante. Notas: el coste de la caravana y el Cap se derivan del balance en el cliente (el backend no publica `costoCaravanaFundacion` ya calculado, como pasa con `costoRefundacion`); el radio de la puerta para desarmar (`MOVIMIENTO.radioPuerta` = 10) no está en `/v1/balance` y va fijo en el cliente (igual que en `panelIntel.ts`).
- Las caravanas de fundación llegan en `proyeccion.caravanas` con `tipo: 'construccion'` (no `'fundacion'`): se corrigió el tipo del cliente.

## Bloque B — Reclutar y reponer tropa en un campamento de mercenarios
- El precio final y los reclutas disponibles no se pueden mostrar antes de pulsar: `RECLUTAMIENTO_ORO_POR_ESCALON` y `ORO_POR_CABALLO` no están en `GET /v1/balance` (sí `MERCENARIOS.recargo`, `valorEquipoEnOro`, `descuentoSinAsentamientos`), y la proyección no trae la población actual del campamento. Pedir: `balance.costesYEconomia.{RECLUTAMIENTO_ORO_POR_ESCALON, ORO_POR_CABALLO}` o, mejor, en la proyección del campamento donde estás, `reclutamiento: { tropas: [{ tropaId, precioPorSoldado, desbloqueada }], poblacion }` (igual que `mercadoCampamento`).
- Las tecnologías que desbloquea el campamento (`tecnologiasDelCampamento`) tampoco viajan: se ofrecen todas las tropas de sus edificios y el servidor rechaza las no desbloqueadas («le falta el edificio o la tecnología»).
- `RECURSO_NOMBRE` (paletas) no tiene nombre para `armaHierro`, `armaBronceCalidad`, etc.: salen con su clave.

## Bloque C1 — columnas, caravanas y héroes ajenos en el mapa
- `MOVIMIENTO.radioInspeccion` (40) no se publica en `GET /v1/balance`: va copiado en `ui/interaccionAjena.ts` (`RADIO_INSPECCION`). Publicarlo junto a `LOGISTICA.radioEncuentro`.
- El resultado de `inspeccionar` solo viaja en los `datos` de la respuesta: no queda en la proyección, así que se pierde al recargar la página (la ficha lo guarda en memoria mientras sigue abierta).
- El servidor no impide perseguir a un aliado ni perseguir una caravana con un ejército, ni que un no-Líder persiga; la ficha apaga lo que el canon prohíbe (aliado, ejército→caravana), el resto lo decide el servidor.
- `caravanasAvistadas.escoltada` es solo «adjunta a un ejército»: una caravana con escoltas cedidas sin héroe (`escoltaIds`) llega como no escoltada.

## Bloque C3: salir de una plaza ajena y reabastecer a los aliados
Nada: `permiteReabastecerAliados` viaja en `asentamientos` (los propios van completos) y se añadió a `Asentamiento` en `tiposDominio.ts`.

## Bloque D1 — Trueques y caravanas aparcadas (plaza › Mercado)
- Nada bloqueante. Observación: `proyeccion.acuerdos` solo trae los acuerdos que tocan una plaza propia, y de las plazas ajenas solo se conocen nombre y Facción: el formulario ofrece las plazas avistadas/conocidas y las propias, y el servidor decide si el pacto es válido.

## Bloque D2 — Caravanas adjuntas a la columna
- **Capacidad de cada caravana**: ni la proyección ni `GET /v1/balance` publican `capacidadCaravana` (los catálogos `CARRO_CATALOGO`/`ANIMAL_CATALOGO` no están en el balance público). Se enseña lo cargado y el servidor topa al cargar. Pedir `capacidad` por caravana en la proyección (como `escoltaLiderazgo`).
- **Stock de las plazas propias desde el mundo**: en el mundo `asentamientos` va vacío y tus plazas llegan como avistadas, sin almacén; el selector de Cargar no puede mostrar cuánto hay. Pedir el almacén de las plazas propias a la vista (o al alcance de la columna).
- Cargar desde una plaza **aliada** que abra su almacén (`permiteReabastecerAliados`): no se ofrece (no hay dato en cliente de esa opción); el comando la admite.

## Bloque D3: tomar una orden de mercado ajena en persona
- Nada bloqueante. Mejora posible: que la proyección diga si la plaza ajena tiene Mercado activo (hoy solo lo comprueba el servidor al rechazar).

## Bloque E1 — Pestaña Facción: cargos, abandono y diplomacia
- **No existe comando de respuesta a una propuesta de alianza o vasallaje**: `proponerRelacion` crea la relación `activa` al instante (`engine/diplomacia.ts`: «Fase 0 acepta la propuesta al instante»). Un vasallaje se impone a la otra Facción sin su consentimiento, y una alianza también. Si se quiere aceptación, hace falta un estado «propuesta» + `responderRelacion`; hoy la interfaz lo avisa en una nota.
- Una vasalla puede llamar a `romperRelacion` sobre su vasallaje (el motor no lo impide y da +6 de reputación a la señora); la interfaz no lo ofrece, solo la rebelión.
- El rechazo de `diplomacia.invalida` llega con el mensaje genérico si el servidor no manda `detalleError`.

## Bloque E2 — Tecnología y Aedas
- **Publicar el catálogo en `GET /v1/balance`**: `TECNOLOGIAS` (nombre, Era, logro, hito, `bonusProduccion`), `ERAS` (nombre, plazo), `TARIFA_ADOPCION`, `AEDAS` (precio de venta `venta.factorOro`, `enfriamientoMinutos`) y `EPICAS`. Hoy el panel solo tiene el id de cada tecnología (lo muestra «legible», sin acentos, p. ej. «Aleacion bronce») y copia a mano las tarifas del canon (Doc 6.5/6.7) y el enfriamiento de 6 h.
- **Era de cada tecnología** (aparecida/adoptada): sin ella no se puede decir cuánto cuesta cada adopción ni cuánto cobraría un Aeda; el panel muestra las tres tarifas.
- **Capital de la Facción** (id) en la proyección, para decir si el Rey está en ella y adoptar con motivo exacto.
- **Progreso del hito** de las reveladas (y qué se cumple de `recursoEnCapital`, `capitalEnNivel`, `yacimientoEnTerritorio`): hoy solo se comprueba en el cliente `edificio` y `tecnologia`.
- **Qué tecnologías admiten épica** (logro cumplido, Era abierta, no aparecida): los logros viajan sin tecnología, así que solo se ofrecen las reveladas. Una tecnología con logro cumplido que ningún Aeda ha revelado aún no se puede elegir.
- **Qué sabe cada Aeda itinerante**: se ofrecen las reveladas como compra posible; el servidor decide (conocimiento, Era I-III, oro).

## Bloque F — Vista de la ciudad
- **Consumo por edificio:** `produccionDeAsentamiento` solo trae producción (por tipo, no por edificio). La ficha enseña los insumos por unidad de cada receta (catálogo) pero no lo que consume de verdad.
- **Producción por edificio individual:** llega agregada por tipo (`activos`, `cantidadPorMinuto`); se reparte a partes iguales.
- Pausa / prioridad por edificio: no existen comandos (la cola se ordena con `moverEnCola`, ya cableado en Cola).
