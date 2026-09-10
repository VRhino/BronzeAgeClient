# Panel de asentamiento — inventario de info y acciones

Todo lo que un jugador puede **ver** y **hacer** en un asentamiento de su Facción cuando lo pisa
(pantalla Asentamiento). Sacado de `BronzeAgeFase0` (`src/session/comandos/{registro,esquemas,
autorizacion}.ts`, `src/domain/types.ts`, `src/engine/asentamientoQuery.ts`, `src/constants.ts`) y de
lo que ya pide `notas.md`. Estilo: [`Diseno_Interfaz.md`](Diseno_Interfaz.md).

## Índice

1. [Qué trae la proyección](#1-qué-trae-la-proyección)
2. [Datos derivados que hoy NO viajan](#2-datos-derivados-que-hoy-no-viajan)
3. [Cargos y quién autoriza qué](#3-cargos-y-quién-autoriza-qué)
4. [Acciones — construcción y edificios](#4-acciones--construcción-y-edificios)
5. [Acciones — mantenimiento y economía](#5-acciones--mantenimiento-y-economía)
6. [Acciones — población y tropas](#6-acciones--población-y-tropas)
7. [Acciones — políticas](#7-acciones--políticas)
8. [Acciones — puerta y acceso](#8-acciones--puerta-y-acceso)
9. [Acciones — comercio](#9-acciones--comercio)
10. [Acciones — cargos (en el panel de Facción)](#10-acciones--cargos-en-el-panel-de-facción)
11. [Acciones — residencia y presencia](#11-acciones--residencia-y-presencia)
12. [Estructura propuesta del panel](#12-estructura-propuesta-del-panel)

---

## 1. Qué trae la proyección

`proyeccion.asentamientos[0]` es el `Asentamiento` **completo y sin redactar** (de lo tuyo se ve todo),
solo cuando pisas una plaza de tu Facción. Campos útiles:

| Campo | Contenido |
|---|---|
| `nombre` / `id` | nombre editable · id estable |
| `nivel` / `nivelActual` | nivel alcanzado (monótono) · nivel operativo (sube/baja con el mantenimiento) |
| `rachaMantenimientoSano` | ticks seguidos de mantenimiento pagado (para recuperar nivel) |
| `poblacion` | `{ pesants, artesanos, nobleza }` |
| `almacen` | `recurso -> { cantidad, capacidad }` (ya se pinta en la tira de recursos) |
| `edificios[]` | ver abajo |
| `recintos[]` | murallas (ya cableado en `#/legacy`, `pestanaMuralla`) |
| `cargos` | `{ gobernadorId, tesoreroId, generalId, maestroObrasId, sacerdoteId }` (id o `null`) |
| `politicasActivas[]` | `{ id, politicaId, cargo, activadaEn, expiraEn }` |
| `escuadrones[]` | guarnición: `{ id, nombre, jugadorId, origen, cantidad, ... }` |
| `politicaDeAcceso` | `abierto` \| `faccion_y_aliados` \| `solo_faccion` \| `cerrado` (ausente = `faccion_y_aliados`) |
| `vetadosIds[]` | jugadores vetados por el Gobernador |
| `medidorMantenimiento` | 0-100 (a 0 baja `nivelActual` / cae en ruinas) |
| `nutricionPoblacion` | 0-100 (hambruna; a 0 cuesta población) |
| `autoConstruccionPausada` | bool |
| `permiteReabastecerAliados` | bool |
| `reservaManual` | `recurso -> 0..999` (calibrada por el Tesorero) |
| `ocupacionHasta` | instante; si `> proyeccion.instante` está bajo ocupación post-conquista |
| `ultimaCaravanaCreadaEn` | instante (cooldown de creación de caravana) |

**`Edificio`** (cada uno): `id`, `tipo`, `estado` (`en_cola` \| `en_construccion` \| `activo`),
`completaEn?` (instante fin de obra, solo en `en_construccion`), `ambito` (`asentamiento` \| `mapa`),
`nivelInterno?` (transformación: fundición/curtiduría/armería/carpintería/barracón/galería), `fuenteId?`
(nodo/bosque que explota), `prioridad?` (orden en la cola), `pausadoPorAlmacenLleno?`, `danado?`
(saqueo de conquista), `rotado?`.

`proyeccion.trazadoPorAsentamiento[id]` — geometría del trazado (huellas, calles, murallas) para dibujar.

**Falta en el tipo local del cliente** (`src/tiposDominio.ts`): `nivelActual`, `poblacion`,
`politicasActivas`, `escuadrones`, `politicaDeAcceso`, `vetadosIds`, `autoConstruccionPausada`,
`reservaManual`, `nutricionPoblacion`, `permiteReabastecerAliados`, `casasCompradas`. Hoy `Asentamiento`
del cliente solo copia lo mínimo.

## 2. Datos derivados que hoy NO viajan

El cliente-jugador **no corre el motor** (solo red). Estas consultas viven en
`engine/asentamientoQuery.ts` / `engine/construction.ts` del backend y **no** están en la proyección.
Para un panel completo hay que **añadirlas a `proyectarParaJugador`** (lo natural) o reimplementarlas en
el cliente (como se hace con worldgen). Decisión pendiente.

- **`estadoMejoraEdificio(asent, edificio, capital)`** → `{ nivelActual, nivelSiguiente, costo, elegible,
  motivoBloqueo }` o `null`. Es lo que gobierna el botón "Mejorar" y su coste. **Necesita la capital de
  la Facción** (para `reservaDinamicaConstruccion`) — el cliente no la tiene.
- **`progresoNivelAsentamiento(asent)`** → qué falta para subir de nivel (pesants/artesanos requeridos,
  edificios `N de M` o `todos`, lista de los que faltan).
- **`produccionPorMinuto(asent, mapa, zona)`** → **YA VIAJA** (2026-09-10) como
  `ProyeccionJugador.produccionDeAsentamiento` (`ProduccionItem[]`), solo para la plaza que pisas. La
  calcula el servidor (`RunnerDePartida.produccionDeAsentamiento`, entrada privilegiada) y la muestra la
  pestaña **Producción** del panel. El **consumo** por edificio sigue sin viajar.
- **`poblacionDisponibleParaReclutar(asent, origen)`** y **`TROPAS_RECLUTABLES`** (catálogo con
  `nivelRequerido`, `costoEquipo`, `edificio`, `poderBase`, `velocidad`, `escalon`) → qué tropas se
  pueden reclutar ahora y qué falta para desbloquear la siguiente.
- **`manoObraInfo` / `ratioManoObra`** → cuánta mano de obra hay vs. la que piden los edificios.
- **`cupoCaravanas` / `cupoEscolta` / `cooldownCaravanaRestante`** → para el área de comercio.
- **`POLITICA_CATALOGO`** (id, cargo, nombre, efecto) → qué políticas puede activar cada cargo.
- **`estaOcupado`** — ya derivable en el cliente (`ocupacionHasta > proyeccion.instante`).

## 3. Cargos y quién autoriza qué

Cargos de un asentamiento (`CargoTipo`): **gobernador · tesorero · general · maestroObras · sacerdote**.
La mayoría de acciones exigen **residir** + **tener el cargo** (`residenteConCargo`).

| Acción | Cargo(s) que la autorizan |
|---|---|
| designar Gobernador | **el Rey de la Facción** (2026-09-10 — antes: cualquier residente). No exige residir ni estar presente |
| designar los demás cargos locales | **Gobernador** vigente (residente + presente) |
| añadir a cola / quitar / reordenar / mejorar edificio / comprometer-mejorar recinto | **Gobernador** o **Maestro de Obras** (`CARGO_CONSTRUCTOR`) |
| abandonar recinto de muralla | solo **Gobernador** |
| pausar auto-construcción | **Gobernador** o **Maestro de Obras** |
| calibrar reserva manual | **Tesorero** |
| abrir almacén a aliados (`alternarReabastecerAliados`) | **Gobernador** o **Tesorero** |
| puerta (`fijarPoliticaDeAcceso`) y veto (`vetarJugador`) | solo **Gobernador** |
| activar política | el cargo dueño de esa política (`POLITICA_CATALOGO[].cargo`) |
| renombrar asentamiento | cualquier **residente** |
| reclutar tropa | cualquier **residente** (amplía SU propio escuadrón) |
| colocar orden de mercado / crear caravana | cualquier **residente** |
| trueques (aceptar/rechazar) | residente del lado que contesta |
| asignar Rey / Embajador (Facción) | ver §10 |

`faccion.reyId === proyeccion.jugadorId` ⇒ eres el Rey.
El cliente sabe si tienes un cargo comparando `asentamiento.cargos.<cargo>Id === proyeccion.jugadorId`.

## 4. Acciones — construcción y edificios

| Comando | `params` | Notas |
|---|---|---|
| `anadirEdificioManualmente` | `asentamientoId, cargo, tipo` (`EDIFICIOS_TIPO`) | añade a la cola; exento de `reservaManual` |
| `quitarDeCola` | `asentamientoId, cargo, edificioId` | solo `en_cola` |
| `moverEnCola` | `asentamientoId, cargo, edificioId, direccion` (`arriba`\|`abajo`) | reordena la cola |
| `mejorarEdificioAhora` | `asentamientoId, cargo, edificioId` | fuerza la mejora de uno; mismo gate/costo que la automática (`estadoMejoraEdificio`) |
| `alternarAutoConstruccion` | `asentamientoId, pausada` (bool) | congela la detección de nuevas necesidades; lo pagado sigue |
| `renombrarAsentamiento` | `asentamientoId, nombre` (vacío = volver al id) | |
| `comprometerRecinto` / `abandonarRecinto` / `mejorarRecinto` | (murallas) | ya cableado en `#/legacy` `pestanaMuralla` |

**Info a mostrar por edificio**: nombre, `nivelInterno`, estado (+ cuenta atrás `completaEn -
proyeccion.instante` si `en_construccion`), `pausadoPorAlmacenLleno`, `danado`, `fuenteId`, posición en la
cola (`prioridad`), y —si viaja— `estadoMejoraEdificio` (nivel→nivel, costo, elegible, motivo).
**Cola de construcción**: lista ordenada de `en_cola` + `en_construccion`, con reordenar y quitar.
`notas.md` pide además: al hacer clic sobre el edificio en el mapa, un cuadro con info + estas acciones.

## 5. Acciones — mantenimiento y economía

| Comando | `params` | Notas |
|---|---|---|
| `calibrarReservaManual` | `asentamientoId, recurso, valor` (0-999) | Tesorero; se suma a la reserva de mantenimiento |
| `alternarReabastecerAliados` | `asentamientoId, permitido` (bool) | Gobernador/Tesorero |

**Info**: `medidorMantenimiento` (0-100, con aviso si baja), `nutricionPoblacion` (hambruna),
`reservaManual` por recurso (slider por recurso, "reserva protegida" de `notas.md`), racha para
recuperar nivel, ocupación post-conquista (`ocupacionHasta`).

## 6. Acciones — población y tropas

| Comando | `params` | Notas |
|---|---|---|
| `reclutarTropa` | `asentamientoId, jugadorId, tropaId, origen` (`pesants`\|`artesanos`) | cualquier residente; amplía su escuadrón |
| `movilizarEjercito` | `asentamientoId, jugadorId, escuadronIds, objetivo, politicaDeUnion?` | sacar un ejército de la guarnición |
| `guarnecer` | `asentamientoId, jugadorId` | volcar la columna en la guarnición |

**Info**: `poblacion` (pesants/artesanos/nobleza + total + techos por nivel/vivienda), mano de obra
(`manoObraInfo`), `escuadrones` (guarnición: quién, tipo, tamaño), catálogo `TROPAS_RECLUTABLES`
filtrado por lo que este asentamiento desbloquea + "siguiente tropa y qué falta" (`notas.md`, "Pestaña
Reclutamiento").

## 7. Acciones — políticas

| Comando | `params` | Notas |
|---|---|---|
| `activarPolitica` | `asentamientoId, cargo, politicaId` | el cargo dueño de la política; dura `duracionMinutosPorDefecto`, no cancelable |

`POLITICA_CATALOGO` (backend `constants.ts`): 15 políticas repartidas entre sacerdote (racionamiento,
culto a la fertilidad), maestroObras (vía rápida, 4 ordenanzas de trazado, líneas de producción —
excluyentes, 1 slot), tesorero (comercio abierto/aranceles, ampliación de flota, carga ampliada, rutas
rápidas), general (leva forzosa). `notas.md`: cards de las activas + cards de las que el cargo puede
activar. Solo visible si el jugador tiene un cargo aquí.

## 8. Acciones — puerta y acceso

| Comando | `params` | Notas |
|---|---|---|
| `fijarPoliticaDeAcceso` | `asentamientoId, jugadorId, politica` (`abierto`\|`faccion_y_aliados`\|`solo_faccion`\|`cerrado`) | solo Gobernador |
| `vetarJugador` | `asentamientoId, jugadorId, vetadoId, vetar` (bool) | solo Gobernador; veta/perdona |

**Info**: política de acceso actual, lista de `vetadosIds`.

## 9. Acciones — comercio

Solo Gobernador/Tesorero para lo de gestión; las órdenes abiertas son públicas.

- `colocarOrdenMercado` — `asentamientoId, tipo` (`compra`\|`venta`)`, recurso, cantidad, precio?`
- `proponerTrueque` / `aceptarTrueque` / `rechazarTrueque`
- Caravanas (revamp 2026-09-08): `crearCaravana`, `agregarCarroCaravana`, `comprarAnimalCaravana`,
  `moverCarroCaravana`, `reservarCaravana`, `prepararCaravana`, `cancelarCaravana`, +
  `moverCargaCaravanaAparcada`, `enviarCaravanaAlOrigen`.

**Info**: `proyeccion.ordenes` (las de tus plazas), `proyeccion.acuerdos` (trueques), `proyeccion.caravanas`
(las propias), `cupoCaravanas`/`cupoEscolta`/`cooldownCaravanaRestante` (si viajan). Es un área grande —
probablemente su propio panel más adelante.

## 10. Acciones — cargos (en el panel de Facción)

Petición explícita: **si eres el Rey**, poder asignar los cargos de un asentamiento desde el panel de
Facción.

| Comando | `params` | Quién |
|---|---|---|
| `asignarRey` | `faccionId, jugadorId` | el Rey vigente (traspaso). Toda Facción nace con Rey (su creador), así que "trono vacío" solo ocurre tras conquista/fusión |
| `asignarEmbajador` | `faccionId, jugadorId` | solo el Rey |
| `asignarCargoLocal` (Gobernador) | `asentamientoId, cargo: 'gobernador', jugadorId` | **el Rey de la Facción** (2026-09-10). No exige residir ni estar presente |
| `asignarCargoLocal` (resto) | `asentamientoId, cargo, jugadorId` | el **Gobernador** vigente, residente y presente |

**Alcance (2026-09-10, resuelto)**: designar Gobernador es potestad exclusiva del **Rey** — es un acto de
nivel Facción, como designar Embajador. El panel de Facción muestra la sección "Cargos" acotada a
`proyeccion.asentamientos[0]` (el asentamiento que se pisa): la fila de Gobernador aparece **si eres el
Rey** (`faccion.reyId === proyeccion.jugadorId`); las otras cuatro, si eres el Gobernador de esa plaza.
Editar cargos de OTRA plaza propia sin estar dentro sigue necesitando que la proyección mande la lista
completa de plazas con sus cargos (hoy no lo hace — `Features_Pendientes.md` §6.2).

## 11. Acciones — residencia y presencia

- `salirAlMundo` — ya cableado (en seco). Falta la pantalla de equipamiento.
- `entrarEnAsentamiento` / `salirDeAsentamiento` — cableado el primero (botón "Entrar").
- `comprarCasa` — `asentamientoId, jugadorId` · 2ª vía de entrar en una Facción.
- `cambiarResidencia` — `destinoId, jugadorId` · mudarse a otra plaza propia con hueco.

## 12. Estructura propuesta del panel

La columna derecha (`.asent-lado`) es un **panel de gestión con pestañas**, estilo city-builder.

1. **Resumen** ✅ — nivel/nivel operativo, población (pesants/artesanos/nobleza + total), medidores de
   mantenimiento y nutrición, aviso de ocupación, toggle auto-construcción (`alternarAutoConstruccion`).
   *Falta*: progreso al siguiente nivel (`progresoNivelAsentamiento`, no viaja).
2. **Edificios** ✅ — lista por tipo con estado y avisos; añadir a la cola (catálogo `EDIFICIOS_MANUALES`,
   `anadirEdificioManualmente`); ⬆ mejorar el de menor nivel de cada tipo (`mejorarEdificioAhora`).
   *Falta*: coste/motivo de la mejora (`estadoMejoraEdificio`, no viaja); detalle por instancia.
3. **Cola** ✅ — obras en curso + en cola ordenadas por `prioridad`, con cuenta atrás (`completaEn`),
   reordenar (`moverEnCola`) y quitar (`quitarDeCola`, solo `en_cola`).
4. **Cargos** ✅ — en el panel de **Facción**, acotado al asentamiento que se pisa (`asignarCargoLocal`):
   Gobernador si eres el **Rey** de la Facción; los otros cuatro si eres el Gobernador de esa plaza (§10).

Pendiente (secciones nuevas):
5. **Producción** ✅ — pestaña con la producción/min de cada edificio (`proyeccion.produccionDeAsentamiento`,
   la calcula el servidor). *Falta*: el consumo por edificio (no viaja).
6. **Tropas** — guarnición (`escuadrones`), reclutar, movilizar.
7. **Políticas** — solo si tienes cargo: activas + activables.
8. **Puerta** — solo Gobernador: política de acceso + vetos.
9. **Almacén / reserva** — reserva manual por recurso (Tesorero), abrir a aliados.
10. **Muralla** — traer `pestanaMuralla` de `#/legacy`.
11. **(Comercio** — probablemente panel aparte.)

Clic en un edificio del mapa → abre la sección "Edificios" enfocada en ese edificio (`notas.md`).

Todo comando: comprobar `status` HTTP **y** `resultado.ok`; el `cargo` que se manda en `params` es el
del jugador (elegir el que aplique, o el único que tenga).
