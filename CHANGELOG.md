# Changelog — Cliente de jugador

Formato: cada entrada anota la **fecha de sincronización con el backend** (`BronzeAgeFase0`) y contra qué
commit suyo se midió. La brecha detallada vive en `docs/Analisis_Brecha_Backend.md` y `docs/COMANDOS.md`.

## [0.2.0] — 2026-09-09 · login con cuenta local (nick + contraseña)

Playtest: los jugadores se registran ellos mismos. Antes el login era `dev <nick>` sin contraseña, con
chips `ana / bruno / carla / jefa` como atajo.

### Cambiado
- Pantalla de login: nick + **contraseña** + casilla "No tengo cuenta — crear una" (revela el campo de
  **código de invitación**, si el backend lo exige). Fuera los chips de usuario.
- `apiCliente.ts`: `loginConUsuario(nick)` → `loginConClave(nick, clave)` (manda `Authorization: clave
  <nick>:<contraseña>`); nueva `registrarCuenta(nick, clave, codigo?)` contra `POST /v1/registro`.
- En un 401 la sesión se cierra y la UI vuelve al login — ya no hay re-autenticación en silencio (no
  guardamos la contraseña).
- `style.css`: `.user-chips` / `.chip-btn` (sin uso) → `.form-check`.

### Backend que lo habilita — `BronzeAgeFase0`
- Proveedor de identidad `clave` (nick + contraseña, hash scrypt en `partidas/identidad.json`) y endpoint
  `POST /v1/registro` (`{nick, clave, codigo?}` → 201 / 400 / 403 / 409). Variable `CODIGO_REGISTRO` opcional.
- El proveedor `dev` sigue vivo solo para el cliente de administración (local).

## [0.1.1] — 2026-09-09 · sync con `BronzeAgeFase0@1b52862` (main)

Alineación de contrato con los cambios del backend del 2026-09-08 → 09-09. **No se cablearon comandos nuevos**
— sigue en 6 de 69; esto es contrato, no funcionalidad.

### Backend nuevo, reflejado en los docs
- **+3 comandos (66 → 69):** `guarnecer` (Doc 5.12.4 — un ejército vuelca su tropa en una plaza propia y se
  consume; sus caravanas adjuntas pasan a `'aparcada'`), `moverCargaCaravanaAparcada` y `enviarCaravanaAlOrigen`
  (operar esas caravanas aparcadas, Doc 3.13.7). `adjuntarCaravana` acepta ahora una caravana `'aparcada'`.
- **Niebla Paso 4 (`f20d64e`):** la visión se comparte EN VIVO con aliados / señor / vasallo. Se suma a las
  capas "viéndolo ahora" (`asentamientosAvistados`, `ejercitosAvistados`, `caravanasAvistadas`,
  `campamentosBandidos`, la máscara `visibles` de la niebla), nunca a lo explorado ni a la memoria. **Sin
  campos ni tipos nuevos** — el cliente ya pinta esas capas, solo que ahora traen también lo que ven tus
  aliados. Al romperse la relación, desaparece en la proyección siguiente.

### Añadido
- `Caravana.estado?` en el tipo local (`src/tiposDominio.ts`), con el enum completo incl. `'aparcada'`. El
  tipo ni siquiera modelaba `estado` antes.

### Documentación
- `docs/COMANDOS.md`, `docs/Analisis_Brecha_Backend.md`, `docs/API_CONTRACT.md`: 66 → 69 comandos, medido
  contra `1b52862` (main), niebla Paso 4 anotada en §3.

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
