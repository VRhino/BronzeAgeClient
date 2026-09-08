# Changelog — Cliente de jugador

Formato: cada entrada anota la **fecha de sincronización con el backend** (`BronzeAgeFase0`) y contra qué
commit suyo se midió. La brecha detallada vive en `docs/Analisis_Brecha_Backend.md` y `docs/COMANDOS.md`.

## [0.1.0] — 2026-09-08 · sync con `BronzeAgeFase0@4fe611b`

Sincronización con los cambios del backend del 2026-09-05 → 09-08 (jugador situado ya estaba, economía del
oro, comando `cambiarResidencia`, revamp de caravanas, ocupación post-conquista). **No se cablearon comandos
nuevos** — el bloque grande (60 de 66 sin interfaz) sigue igual; esto es alineación de contrato, no
funcionalidad.

### Corregido
- **`fundarAsentamiento` ya no manda `posicion`** (backend `76d7e9b`/`4fe611b`, "se funda DONDE SE ESTÁ",
  Doc 1.3). El comando pasó a `{ faccionId }`; el backend deriva la posición de la columna del fundador.
  `confirmarFundacion` (`src/main.ts`) dejó de enviarla. El punto que se elige en el mapa es ahora **solo la
  vista previa de recursos** — el flujo real de fundación necesita `salirAlMundo`, aún sin cablear.
- **Typo `Asentamiento.mantenimiento` → `medidorMantenimiento`** (`src/tiposDominio.ts`). El campo local no
  correspondía a ningún campo del dominio, así que la pestaña "General" mostraba "No disponible" en silencio.
  `pestanaAsentamientos.ts` lee ya el nombre correcto.

### Añadido
- Tipos locales de la **ocupación post-conquista** (backend Doc 5.12.9): `Edificio.danado` y
  `Asentamiento.ocupacionHasta`. La pestaña Asentamientos muestra "· dañado" en los edificios afectados y un
  aviso de ocupación con los minutos restantes en el detalle "General".

### Documentación
- `docs/COMANDOS.md`: 59 → 66 comandos (`cambiarResidencia` + 6 del revamp de caravanas), `fundarAsentamiento`
  sin `posicion`, medido contra `4fe611b`.
- `docs/Analisis_Brecha_Backend.md` y `docs/API_CONTRACT.md`: cifras y fecha de medición al día.

## [0.1] — 2026-09-04

Estado del `git log` antes de este changelog: mapa del mundo (terreno, niebla de guerra, fronteras propias y
ajenas, ejércitos, caravanas, campamentos), vista de asentamiento, panel de interacción con Facción,
Asentamientos, Información y Muralla. 6 de los comandos del backend cableados.
