# Bloque B — Reclutar y reponer tropa en un campamento de mercenarios

## Añadido (para el CHANGELOG)
- Campamento › Tropa: nueva sección «Reclutar». Lista las tropas de los edificios militares del campamento (barracón, galería de tiro, caballerizas, al nivel `MERCENARIOS.nivelEdificios`; no la leva del Centro Urbano) con su edificio, hombres, escalón, equipo que se cobra en oro y lo que ya tienes de cada una. Botón «Reclutar» o «Reponer N» (deshabilitado si la escuadra está completa) y selector «Pagar con» (almacén personal o carro de tu columna, con el oro de cada uno). El rechazo del servidor sale tal cual (sin oro, sin reclutas, tropa no desbloqueada por el campamento, columna lejos…). Si no resides en el campamento, la pestaña explica que hay que residir.
- `apiCliente.ts`: accesor `tropasReclutables()` (catálogo `TROPAS_RECLUTABLES` + `MERCENARIOS.nivelEdificios` del balance).

## Comandos cableados
- [x] `reclutarEnCampamento` — `{ tropaId, pagarCon?: 'almacenPersonal'|'carro' }` · Campamento › Tropa › Reclutar (`src/ui/pantallaCampamento.ts`)

## Features resueltas
- Reclutar/reponer en campamento de mercenarios (el `reclutarEnCampamento` de Features_Pendientes).

## Necesita Backend
- El precio final y los reclutas disponibles no se pueden mostrar antes de pulsar: `RECLUTAMIENTO_ORO_POR_ESCALON` y `ORO_POR_CABALLO` no están en `GET /v1/balance` (sí `MERCENARIOS.recargo`, `valorEquipoEnOro`, `descuentoSinAsentamientos`), y la proyección no trae la población actual del campamento. Pedir: `balance.costesYEconomia.{RECLUTAMIENTO_ORO_POR_ESCALON, ORO_POR_CABALLO}` o, mejor, en la proyección del campamento donde estás, `reclutamiento: { tropas: [{ tropaId, precioPorSoldado, desbloqueada }], poblacion }` (igual que `mercadoCampamento`).
- Las tecnologías que desbloquea el campamento (`tecnologiasDelCampamento`) tampoco viajan: se ofrecen todas las tropas de sus edificios y el servidor rechaza las no desbloqueadas («le falta el edificio o la tecnología»).
- `RECURSO_NOMBRE` (paletas) no tiene nombre para `armaHierro`, `armaBronceCalidad`, etc.: salen con su clave.

## Sin verificar en vivo
- Pagar con el carro y reponer una escuadra con bajas (hacen falta columna a la puerta / bajas). Que la escuadra nueva se una a la columna (`seUne`) no se comprueba.
- Precio con Facción y reputación baja.

Verificado en vivo (servidor propio, héroe recién creado, oro inyectado en el almacén personal): Honderos y Escaramuzadores con jabalina reclutados (Honderos: 300 de oro por 20 hombres, 5000 → 4700), botón pasa a «Completa»; arqueros, arqueros compuestos y honderos rodios rechazados por el servidor con el mensaje de tecnología; sin oro: «No hay oro suficiente en el almacén personal (hacen falta 300)».
