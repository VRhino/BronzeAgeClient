# Features pendientes

Lo que el **revamp de pantallas** del cliente‑jugador (mapa a pantalla completa + pantalla de
asentamiento + routing por proyección, plan `twinkly-greeting-peacock.md`) dejó fuera a propósito, para no
olvidarlo. Cada entrada dice **cómo está hoy** y **qué falta**.

- Guía visual (leer antes de diseñar UI nueva): [`Diseno_Interfaz.md`](Diseno_Interfaz.md).
- Inventario de info y acciones del asentamiento: [`Panel_Asentamiento.md`](Panel_Asentamiento.md).
- Intención de producto / UX a mano: [`notas.md`](notas.md).
- Qué hay ya en el backend esperando interfaz: [`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md).
- Catálogo de comandos: [`COMANDOS.md`](COMANDOS.md).

## Índice

0. [Héroe](#0-héroe) — creación y pantalla del héroe
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

## 0. Héroe

### 0.1 Creación del héroe

**Hoy:** desde el modelo de Héroe (backend `BronzeAgeFase0@6281527`, rama `heroe-dominio`) unirse a una
partida ya no basta para jugar: la membresía necesita un héroe. Mientras no lo tenga, la proyección llega como
`{ gameId, instante, version, mapaId, sinHeroe: true }` y cualquier comando que no sea `crearHeroe` es `403`
(`API_CONTRACT.md`, «Partida sin héroe»).

El **cableado está hecho**:
- `refrescarDatosJuego` detecta `sinHeroe` y lo guarda en `estadoCliente.sinHeroe`.
- El router monta la pantalla `heroe` (`montarHeroe` en `src/main.ts`): es la única a la que se llega sin
  héroe, antes incluso que `#/legacy`.
- `crearHeroe(params: ParamsCrearHeroe)` manda el comando y refresca. Con el héroe creado, el router sigue solo:
  Facción si aún no tiene, luego Mapa, porque el héroe aparece en el mundo con su propia columna.

La pantalla es **provisional**: solo pide el nombre. Clase, género y aspecto van fijos (`HEROE_PROVISIONAL`: clase
`Spear`, `masculino`, piezas de avatar vacías), que es lo mismo que llevan los héroes bot del backend.

**Falta:** la pantalla de creación de verdad. `crearHeroe` en el doc 02 §4.2 de `Docs/Coordinacion/` del
backend. La nueva pantalla solo tiene que llamar a `crearHeroe` con los cuatro campos:
- **Nombre** (`displayName`): ya está.
- **Clase** (`classDefinitionId`): el catálogo de clases es de Conquest. BronzeAge lo guarda sin interpretarlo y
  **no lo publica**; hoy solo existe `Spear`. Falta decidir de dónde lo lee este cliente: una tabla en
  `GET /v1/balance`, o una copia versionada como el catálogo de tropas del contrato (`src/contratos/v1/` del
  backend). Ojo: el doc 02 lista «clase inexistente» como rechazo, pero el backend todavía no lo comprueba.
- **Género** (`genero`: `masculino` | `femenino`).
- **Aspecto** (`avatar`: `cabezaId`, `peloId`, `barbaId`, `cejasId`): son ids de piezas del catálogo visual de
  Conquest. Tiene el mismo problema que la clase: sin catálogo publicado no hay nada que ofrecer, ni con qué
  dibujar una vista previa.
- **Errores legibles** para `heroe.nombre_vacio` y `heroe.ya_existe` (ver §7).

Fuera de esta pantalla, el nombre del héroe ya se usa (2026-09-14, `nombreDeHeroe` en `src/main.ts`): iniciales
del menú de esquina, cabecera del panel de Facción y selector de cargos, que enseña el nombre de todos los
compañeros de Facción (`nombresDeCompaneros`, se les vea o no).

### 0.2 Pantalla del héroe: ficha, atributos, escuadras, loadouts y guarnición

**Hoy (cliente 0.5.0):** el **panel Héroe** (`src/ui/panelHeroe.ts`) se abre desde el riel del Mapa (🛡) y desde
la barra del Asentamiento, con tres pestañas. Las reglas son las del canon del backend: Doc 5.16 (el Héroe),
5.12.4 y 5.15.3 (defensa y guarnición).
- **Ficha:** clase, dónde está, si está **herido** y cuánto le queda (Doc 5.16.4), nivel, experiencia hacia el
  siguiente, Liderazgo, monedas y los cuatro atributos.
  Con puntos sin gastar aparece un campo por atributo y «Repartir puntos» (`repartirPuntos`); hoy ningún nivel
  da puntos (CQ-001), así que no sale.
- **Escuadras:** cada escuadra con hombres, nivel, moral, coste de Liderazgo, dónde está y si **defiende** (la
  guarnición, y el loadout activo mientras estás dentro de tu residencia). Arriba, la guarnición ocupada frente al
  cupo; «A la guarnición» / «Retirar» (`asignarGuarnicion`, `retirarGuarnicion`), apagado si no cabe.
- **Loadouts:** lista con su Liderazgo frente al tuyo; activar, editar, borrar y crear (`guardarLoadout`,
  `borrarLoadout`). El editor suma el Liderazgo en vivo con el `costeLiderazgo` de cada escuadra y apaga Guardar
  si no cabe o no tiene nombre. Los perks se conservan tal cual (hoy siempre `[]`).

El sondeo de 3 s no repinta el panel si nada cambió, ni mientras hay un loadout a medio editar.

**Falta:**
1. **Equipo e inventario.** `equipamiento` (6 huecos) e `inventario` llegan vacíos y no hay `equipar` hasta que
   Conquest publique su catálogo de objetos (CQ-004). Con él, una pestaña Equipo.
2. **Perks.** Elegirlos en el editor de loadout cuando exista el catálogo (CQ-004).
3. **Héroes ajenos.** Al seleccionar una columna, propia o avistada (`ejercitosAvistados[].heroeIds`), la ficha
   pública de quien va en ella (`heroesVisibles`: nombre, clase, nivel, si está herido, escuadras que lleva y equipo puesto). Hoy
   el mapa solo selecciona asentamientos (§1.4).
4. **Salir al mundo** (§1.1). La pantalla de equipamiento puede proponer el loadout activo como selección.
5. **Errores legibles** (§7). El backend solo devuelve `heroe.invalido`, sin detalle; el panel evita de antemano
   los casos corrientes (no cabe en el Liderazgo o en el cupo, nombre vacío), y lo demás sale como código.
6. **Probarlo con escuadras de verdad.** Verificado en vivo con un héroe sin escuadras (ficha, loadouts). Las filas
   de la pestaña Escuadras y la guarnición no se han visto aún con datos reales: hace falta una plaza con
   Barracón o Galería de tiro y tropa reclutada.

## 1. Presencia del jugador y movimiento

### 1.1 Pantalla de equipamiento para `salirAlMundo`
**Hoy:** el botón "Salir al mundo" de la barra del asentamiento llama a `salirAlMundo` con
`escuadronIds: []` y `carga: {}` — salida "en seco" (`montarAsentamiento` / `salirAlMundo` en
`src/main.ts`).
**Falta:** la pantalla de equipamiento (Doc 1.10.2): elegir qué escuadras de tu campamento salen
(`heroe.escuadrones`; el loadout activo sirve de propuesta, §0.2) y qué carga el carro del almacén, con el roster
y el almacén delante.

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
puerta + "Entrar"; clic en un **campamento de bandidos** → su ficha (poder, distancia a tu columna) + `marcharA`
hasta él + "Atacar" (`atacar` con `objetivo: campamento`, Doc 1.9), apagado si estás herido o a más de 15.
**Falta** (ver [`notas.md`](notas.md) §"vista mundo"): acciones sobre **ejércitos** (aliado → unirse,
enemigo → perseguir o atacar), **rutas comerciales** (interceptar), y **caravanas avistadas**. La proyección ya trae `ejercitosAvistados`, `campamentosBandidos`, `caminos`,
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
- La **producción por edificio** ya viaja (`proyeccion.produccionDeAsentamiento`, 2026-09-10) y la muestra
  la pestaña **Producción** del panel. Falta el **consumo** por edificio y llevar la producción al tooltip
  de cada edificio.
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
**Hoy:** la columna de aparición de un héroe nace `faccionId: ''` (`columnaDeAparicion` en
`engine/ubicacion.ts`). Si el jugador ya era ciudadano —o se hace ciudadano después—, su columna **no** se
re‑marca con la bandera. `grabarLoVisto` la ignora (filtra por `faccionId`), así que su reconocimiento
solo lo ve él vía `Heroe.exploracionPersonal`.
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
