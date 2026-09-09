# Features pendientes

Lo que el **revamp de pantallas** del cliente‑jugador (mapa a pantalla completa + pantalla de
asentamiento + routing por proyección, plan `twinkly-greeting-peacock.md`) dejó fuera a propósito, para no
olvidarlo. Cada entrada dice **cómo está hoy** y **qué falta**.

- Guía visual (leer antes de diseñar UI nueva): [`Diseno_Interfaz.md`](Diseno_Interfaz.md).
- Intención de producto / UX a mano: [`notas.md`](notas.md).
- Qué hay ya en el backend esperando interfaz: [`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md).
- Catálogo de comandos: [`COMANDOS.md`](COMANDOS.md).

## Índice

1. [Presencia del jugador y movimiento](#1-presencia-del-jugador-y-movimiento)
2. [Tiempo real](#2-tiempo-real)
3. [Pantalla de asentamiento](#3-pantalla-de-asentamiento)
4. [Panel de Ejército](#4-panel-de-ejército)
5. [Contenido que hoy solo vive en `#/legacy`](#5-contenido-que-hoy-solo-vive-en-legacy)
6. [Estado de la interfaz del mapa](#6-estado-de-la-interfaz-del-mapa)
7. [Mensajes de error](#7-mensajes-de-error)
8. [Backend](#8-backend)
9. [Cosmético / pasada de estilos](#9-cosmético--pasada-de-estilos)

---

## 1. Presencia del jugador y movimiento

### 1.1 Pantalla de equipamiento para `salirAlMundo`
**Hoy:** el botón "Salir al mundo" de la barra del asentamiento llama a `salirAlMundo` con
`escuadronIds: []` y `carga: {}` — salida "en seco" (`montarAsentamiento` / `salirAlMundo` en
`src/main.ts`).
**Falta:** la pantalla de equipamiento (Doc 1.10.2): elegir qué escuadrones de la guarnición salen y qué
carga el carro del almacén, con el roster y el almacén delante.

### 1.2 `salirDeAsentamiento` desde una plaza ajena
**Hoy:** solo se contempla salir de la **propia residencia** (`salirAlMundo`).
**Falta:** cuando el jugador está dentro de una plaza ajena, salir es `salirDeAsentamiento` (retoma la
columna aparcada, sin pantalla de equipamiento). La pantalla de asentamiento tendría que ofrecer una u
otra según de quién sea la plaza.

### 1.3 `entrarEnAsentamiento` automático al llegar a la puerta
**Hoy:** en el panel de Selección del mapa hay un botón "Entrar"; el backend valida `enLaPuertaDe` y lo
rechaza si la columna no está en la puerta (`renderSeleccionMapa` en `src/main.ts`).
**Falta:** entrar solo al llegar, o al menos un aviso claro tipo "ya puedes entrar" cuando la columna
alcanza la puerta, en vez de que el jugador pruebe el botón a ciegas.

### 1.4 Interacción rica con entidades del mapa
**Hoy:** clic en terreno → `marcharA` punto; clic en asentamiento → panel de ficha + `marcharA` a la
puerta + "Entrar".
**Falta** (ver [`notas.md`](notas.md) §"vista mundo"): acciones sobre **ejércitos** (aliado → unirse,
enemigo → perseguir), **campamentos de bandidos** (atacar), **rutas comerciales** (interceptar), y
**caravanas avistadas**. La proyección ya trae `ejercitosAvistados`, `campamentosBandidos`, `caminos`,
`caravanasAvistadas`.

## 2. Tiempo real

**Hoy:** la pantalla Mapa **sondea** `refrescarDatosJuego` cada 3 s (`montarMapa` en `src/main.ts`) porque
el cliente no consume `WS /v1/jugador/partidas/{gameId}/tiempo-real`.
**Falta:** sustituir el sondeo por el canal de tiempo real (y el cursor incremental de eventos,
`GET .../eventos?desde={version}`). El sondeo también reconstruye el panel de Selección cada tick, lo que
borra mensajes de error transitorios (ver §7).

## 3. Pantalla de asentamiento

### 3.1 Interacción con el mapa del asentamiento
**Hoy:** `pintarAsentamiento` dibuja trazado, edificios y murallas. Al pasar el cursor sobre un edificio
interno sale un **tooltip** con nombre, nivel y estado (`edificioBajoCursor` en `src/render.ts`,
`cablearTooltipEdificios` en `src/main.ts`). La columna derecha lista los edificios agrupados por tipo
(`renderPanelEdificios`).
**Falta:**
- La **economía por edificio** en el tooltip (producción/consumo por minuto) — no viaja en la proyección,
  el `cliente/` admin la calcula con su propio store.
- **Clic en un edificio** → cuadro con su info + acciones (mejorar con su coste; pausar/reanudar;
  prioridad); y clic en una fila de la lista → resaltarlo/centrarlo en el mapa.
- **Escala de la vista**: `pintarAsentamiento` usa `radioMapa = 60` hard-codeado; el canon es
  `REJILLA_ASENTAMIENTO.radioMapa = 220` (el `cliente/` admin lo usa). El cliente-jugador está más
  acercado y podría **recortar** edificios de un asentamiento grande situados más allá de ±120 locales.

### 3.2 Detalle del asentamiento
**Hoy:** la pantalla nueva muestra el mapa + la barra + la lista de edificios de la columna derecha. El
detalle rico (general / almacén / producción / militar / muralla) sigue **solo en `#/legacy`**.
**Falta:** re‑incorporar ese detalle a la pantalla nueva, incluyendo cola de construcción
(`moverEnCola` / `quitarDeCola`), reserva del tesorero (`calibrarReservaManual`) y tablas de
producción/consumo.

## 4. Panel de Ejército

**Hoy:** el botón "Ejército" de la barra abre un panel **placeholder**.
**Falta:** reclutamiento (`reclutarTropa` + árbol de desbloqueo de tropas), composición y gestión de la
columna (`movilizarEjercito`, `unirseEnCampo`, `guarnecer`, `marcharA` de ejército, `estacionar`, …), y la
pestaña de campaña entera (los 9 comandos militares de [`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md)).

## 5. Contenido que hoy solo vive en `#/legacy`

`#/legacy` conserva la interfaz anterior intacta como red de seguridad. De momento solo ahí están:

- El **detalle de asentamiento** con sus 6 pestañas (ver §3.2).
- El **glosario de "Información"** (`renderPestanaInformacion`).
- Las **acciones de muralla** cableadas (`cablearAccionesMuralla`): comprometer / abandonar / mejorar
  recinto.
- El **flujo de creación de facción** completo también existe en las pantallas nuevas, pero el detalle de
  facción con cargos/Rey/Embajador por asentamiento no.

**Falta:** ir trayendo cada pieza a las pantallas nuevas conforme se aborden.

## 6. Estado de la interfaz del mapa

### 6.1 Persistencia de vista
**Hoy:** zoom, pan, panel del riel abierto y selección se **resetean** al salir de la pantalla Mapa
(estado en cierres de `montarMapa`, no en `estadoCliente`).
**Falta:** conservarlos entre navegaciones y entre sesiones (`localStorage`).

### 6.2 Lista fiable de "mis asentamientos"
**Hoy:** el panel "Mis cosas" lista los asentamientos propios que están en `asentamientosAvistados` o
`asentamientosConocidos` (visión / memoria).
**Falta:** un asentamiento propio fuera de visión y sin foto en memoria **no aparece**. Necesita o un
campo de la proyección con la lista de plazas de la facción, o el arreglo backend §8.1.

## 7. Mensajes de error

**Hoy:** `mensajeError` (`src/main.ts`) devuelve el `codigoError` crudo del backend
(`movilizacion.invalida`, `faccionYaPerteneces`, …). Además el panel de Selección se reconstruye en cada
sondeo (§2) y pierde el texto de error.
**Falta:** un mapa `código → mensaje legible`, y sacar los errores a un toast persistente en vez de a un
`<p>` que el re‑render borra.

## 8. Backend

### 8.1 Reconocimiento compartido de un ciudadano con columna huérfana
**Hoy:** la columna de aparición de un jugador nace `faccionId: ''` (`columnaDeAparicion` en
`engine/ubicacion.ts`). Si el jugador ya era ciudadano —o se hace ciudadano después—, su columna **no** se
re‑marca con la bandera. `grabarLoVisto` la ignora (filtra por `faccionId`), así que su reconocimiento
solo lo ve él vía `Jugador.exploracionPersonal`.
**Parche aplicado:** la proyección funde `exploracionPersonal` con la memoria de la facción, así que el
jugador **sí** ve su propio rastro (`src/session/proyecciones/jugador.ts`).
**Falta:** que ese reconocimiento llegue también a los **compañeros de facción** — o re‑marcando la
columna al `unirseAFaccion`, o haciendo que `grabarLoVisto` cuente una columna como ojo de la facción si
algún participante es ciudadano.

### 8.2 Fundación grupal y consentimiento
Anotado en el propio comando: `fundarAsentamiento` soporta hasta 5 cofundadores en el motor pero no lo
expone porque falta un mecanismo de consentimiento (Doc 1.2/1.3).

## 9. Cosmético / pasada de estilos

- La **barra del asentamiento** (`.asent-barra`) pisa el borde superior del mapa en viewports altos.
- Los **paneles laterales** (`.mapa-panel`, `.asent-panel`) ocupan toda la altura aunque el contenido sea
  corto.
- Los **iconos del riel** (`.mapa-riel`) se ven pequeños y algo apagados.
- El **panel de Selección** y el **menú de esquina** comparten esquina superior derecha; se solapan si se
  abren a la vez.
