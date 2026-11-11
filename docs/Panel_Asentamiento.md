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
| `politicaDeAcceso` | `abierto` \| `faccion_y_aliados` \| `solo_faccion` \| `cerrado` (ausente = `faccion_y_aliados`) |
| `vetadosIds[]` | héroes vetados por el Gobernador |
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
`politicasActivas`, `politicaDeAcceso`, `vetadosIds`, `autoConstruccionPausada`,
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
| reclutar tropa | cualquier **residente** (amplía SU propio escuadrón); desde 0.200.0 también el **ciudadano** que no reside y entró con su columna (la escuadra nueva va a la columna), salvo vetado o con el reclutamiento cerrado |
| cerrar el reclutamiento a los ciudadanos (`cerrarReclutamientoACiudadanos`) | **Gobernador** o **General**, residentes |
| pausar el consumo de un bien (`pausarConsumo`) | **Gobernador** o **Tesorero**, residentes y dentro |
| colocar orden de mercado / crear caravana | cualquier **residente** |
| trueques (aceptar/rechazar) | residente del lado que contesta |
| asignar Rey / Embajador (Facción) | ver §10 |

`faccion.reyId === proyeccion.heroeId` ⇒ eres el Rey.
El cliente sabe si tienes un cargo comparando `asentamiento.cargos.<cargo>Id === proyeccion.heroeId`.

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
| `reclutarTropa` | `asentamientoId, heroeId, tropaId, origen` (`pesants`\|`artesanos`) | cualquier residente; amplía su escuadrón |
| `movilizarEjercito` | `asentamientoId, heroeId, escuadronIds, objetivo, politicaDeUnion?` | sacar un ejército con escuadras de tu campamento |
| `guarnecer` | `asentamientoId, heroeId` | deshacer un ejército en una plaza donde residen todos: la tropa vuelve a sus campamentos |
| `asignarGuarnicion` / `retirarGuarnicion` | `squadId` | una escuadra de tu campamento entra en / sale de la guarnición, dentro de `heroe.cupoGuarnicion` |

**Info**: `poblacion` (pesants/artesanos/nobleza + total + techos por nivel/vivienda), mano de obra
(`manoObraInfo`), tus escuadras (`proyeccion.heroe.escuadrones`, con `contenedor` y `enGuarnicion`; la plaza
ya no trae `escuadrones`: su guarnición son las escuadras de sus residentes), catálogo `TROPAS_RECLUTABLES`
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
| `fijarPoliticaDeAcceso` | `asentamientoId, heroeId, politica` (`abierto`\|`faccion_y_aliados`\|`solo_faccion`\|`cerrado`) | solo Gobernador |
| `vetarJugador` | `asentamientoId, heroeId, vetadoId, vetar` (bool) | solo Gobernador; veta/perdona |

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
| `asignarRey` | `faccionId, heroeId` | el Rey vigente (traspaso). Toda Facción nace con Rey (su creador), así que "trono vacío" solo ocurre tras conquista/fusión |
| `asignarEmbajador` | `faccionId, heroeId` | solo el Rey |
| `asignarCargoLocal` (Gobernador) | `asentamientoId, cargo: 'gobernador', heroeId` | **el Rey de la Facción** (2026-09-10). No exige residir ni estar presente |
| `asignarCargoLocal` (resto) | `asentamientoId, cargo, heroeId` | el **Gobernador** vigente, residente y presente |

**Alcance (2026-09-10, resuelto)**: designar Gobernador es potestad exclusiva del **Rey** — es un acto de
nivel Facción, como designar Embajador. El panel de Facción muestra la sección "Cargos" acotada a
`proyeccion.asentamientos[0]` (el asentamiento que se pisa): la fila de Gobernador aparece **si eres el
Rey** (`faccion.reyId === proyeccion.heroeId`); las otras cuatro, si eres el Gobernador de esa plaza.
Editar cargos de OTRA plaza propia sin estar dentro sigue necesitando que la proyección mande la lista
completa de plazas con sus cargos (hoy no lo hace — `Features_Pendientes.md` §6.2).

## 11. Acciones — residencia y presencia

- `salirAlMundo` — ya cableado (en seco). Falta la pantalla de equipamiento.
- `entrarEnAsentamiento` / `salirDeAsentamiento` — cableado el primero (botón "Entrar").
- `comprarCasa` — `asentamientoId, heroeId` · 2ª vía de entrar en una Facción.
- `cambiarResidencia` — `destinoId, heroeId` · mudarse a otra plaza propia con hueco.

## 12. Estructura propuesta del panel

La columna derecha (`.asent-lado`) es un **panel de gestión con pestañas**, estilo city-builder.

> **Desde 0.92.0 (2026-11-02) ya no es una columna** y **desde 0.98.0 tampoco una sola ventana**: en la plaza en 3D a pantalla
> completa, cada parte se abre en su propia ventana desde el riel de iconos bajo el blasón (Víctor, 2026-11-02: había demasiado en muy
> poco espacio). **Construcción** (auto-construcción y Edificios, Obras, Producción), **Gobierno** (Cargos con los residentes,
> Tesorería), **Defensa** (Muralla, Puerta), **Territorio** (Pueblos y aldeas, Fundación), **Reclutamiento**, **Taberna** y
> **Mercado** (Órdenes, Caravanas, Trueques); «Subir de nivel» sale del medallón del blasón e «Información», del «?» de la barra. El
> Resumen desaparece: la población, el almacén, la nutrición y el mantenimiento van al pie de la pantalla en tres grupos; el nombre,
> la residencia (casa) y la capital (corona), al blasón; la ocupación, a una franja arriba al centro. Las Misiones y el Tablón de la
> plaza, al botón «Misiones» de la barra. El campamento y el pueblo conservan su columna derecha.

> **Centro urbano › Edificios** (0.84.0, 2026-11-02, `ui/panelObras.ts`; banco `pruebas/plaza/`): tres plegables con aire de juego de
> estrategia, más iconos que texto. **Edificios**: rejilla «Construir» (icono y coste en chips, en rojo lo que falta en el almacén, candado
> si no se puede) y una tarjeta por tipo (icono, ×N, nivel en rombos, insignias 🔨 obra / ⬆ mejora / ⏸ parado / ⚠ dañado, botón ⬆ de
> mejorar y barra de la mejora). **Obras**: lo que está en obra con barra de avance estimada (duración del catálogo × políticas) y lo que
> espera en casillas numeradas con ◀ ✕ ▶. **Producción**: el almacén en fichas (neto ▲▼ con color, lleno/cabe, entra frente a sale, «LLENO»
> o cuándo se acaba), la mano de obra en un medidor, los extractores como edificio ➜ recurso y los talleres como insumos ➜ producto con el
> interruptor ▶ / ❚❚. Las cifras van en los títulos (al pasar el ratón).
>
> **Desde 0.114.0** la barra del jugador no lleva el nombre del héroe en la plaza; el blasón sube arriba del todo y la barra de Población,
> Almacén y Estado va a su lado, a su tamaño y centrada hasta los botones del jugador. «Ejércitos» desaparece: unirse a un ejército es un icono
> del riel que solo sale cuando se puede. «Salir al mundo» va abajo a la izquierda.
>
> **Aedas desde 0.170.0** (Víctor, 2026-11-07: «los Aedas son de plaza, no de Facción»): icono de la lira en el riel, solo en una plaza de tu
> Facción con un Aeda dentro (itinerante parado o residente). La ventana (`ui/ventanaAedas.ts`) dice lo que vende el itinerante, con «Comprar»
> para el Rey o el Gobernador, y lo que da cada residente y su épica: en curso, con su capítulo y «Abandonar»; sin ella, las que puede cantar
> (Rey, Gobernador o Sacerdote). Facción → Tecnología se queda con el árbol y los logros.
>
> **Desde 0.125.0** la placa del Almacén va sola mientras el jugador no elija (lo que tiene la plaza, hasta 8, sin echar a nadie); al elegir en
> la ventana del Almacén manda su elección, y «Que vaya sola» la devuelve. Con la subida lista, el medallón del blasón parpadea con un «!»
> (solo para el Gobernador).
>
> **La barra de Población, Almacén y Estado, arriba al centro desde 0.112.0** (2026-11-03): en el hueco entre el blasón y el panel de
> misiones, en una fila (el Almacén estira y, si no cabe, pasa sus recursos a dos filas); abajo solo queda el riel.
>
> **Construcción desde 0.110.0** (2026-11-03, Víctor: «solo mostrar lo que se puede hacer»). Ya no es una ventana: el botón del riel (solo con
> cargo de Gobernador o Maestro de Obras, que es a quien el motor deja tocar la cola y la auto-construcción) cambia el riel por un cajón abajo
> con «← Volver», la auto-construcción y la rejilla «Construir» por tipos, sin lo que el cliente sabe que no se puede (sin candados; lo que
> no se puede pagar sale con el coste en rojo). Las obras en marcha (barra de avance y tiempo) y la cola (◀ ✕ ▶ al pasar, solo con cargo) van
> en el panel bajo el blasón (`htmlObrasHud`). La lista de Edificios desaparece: mejorar va en la ficha del edificio (coste en chips, tiempo
> de obra y, durante la obra o la mejora, su barra y lo que queda). La Producción está en la ventana del Almacén (0.107.0). En el riel solo
> salen las ventanas que se pueden abrir (Taberna y Mercado, con el edificio activo).
>
> **Tooltips con ficha en Construir y en el Almacén** (0.192.0, Víctor 2026-11-10; `ui/tipsPlaza.ts`, con la pinta de los de los árboles).
> **Al pasar por un edificio de «Construir»**: su tamaño en el trazado, si es único o cuántos caben, una frase con su función, el coste (en rojo
> lo que falta) y la obra con las políticas de hoy, lo que da **solo en el nivel 1** (desde 0.196.0: las recetas, qué hacen y con qué, sin
> cifras; el recurso de base; la mano de obra con su tipo de población, sitio para la gente, cabida, flota, Miradas, el buey, las tropas que
> recluta, la política de más de la Sala del Consejo, el prestigio de la estatua y la Maravilla) y, en la plaza, cuántos hay, si hace falta para
> subirla de nivel (solo los niveles que quedan) y qué edificios lo piden. Lo que pide una tecnología que la Facción no tiene no sale. **Al pasar por un recurso del
> Almacén** (las fichas y los botones de la barra), **sin cifras desde 0.195.0** (Víctor: «no mostrar números en general, solo los
> multiplicadores»; las cifras están en la ficha): para qué sirve (qué tipos de población lo comen, la guarnición, los talleres que lo gastan y
> qué hacen, el equipo de las tropas, el reclutamiento, construir, mejorar, subir la plaza y el mantenimiento, con el nivel desde el que lo
> pide), solo con lo que la Facción puede hacer ya (lo que pide una tecnología que no tiene no sale); de dónde sale, solo el sitio
> (extractores, aldeas por cultivo, rebaños, talleres, la recaudación, batallas); y qué lo multiplica (la Cantería, el buey, la fertilidad, el
> bosque, el crecimiento con la ración entera y las políticas, marcadas si están activas). Con el almacén lleno, lo avisa. Se dice «tipos de
> población», no «clases». Todo sale del catálogo y de los bloques del motor. El `title` del navegador se va; las cifras siguen en el
> `aria-label`. **Al pasar por un cuadrito de «Construidos»** (0.195.0; 0.196.0): cuántos hay y de qué nivel, si alguno se mejora o está
> dañado, su función, «Lo que tiene» todo junto (el del mejor), solo la mejora al nivel siguiente con lo que pide y añade (si no pide una
> tecnología que la Facción no tiene), y para qué hace falta en la plaza.
>
> **«En la barra de arriba» con solo lo que hay** (0.195.0): en la ventana del Almacén, la elección de la barra enseña de serie los recursos
> con algo y los que ya van en la barra; «Mostrar todos» enseña el resto.
>
> **Albergue de caravanas** (0.128.0, motor b5e27ace). Sale en «Construir», en Gobierno junto al Mercado, solo con un Mercado activo (lo
> que pide su nivel 1, `requiereEdificio`; el rechazo del motor, `obra.falta_edificio`, tiene su texto). Su ficha dice lo que suma a la flota a
> su nivel (3 caravanas y 5 carros en el 1, 6 y 10 en el 2, 12 y 22 en el 3) y que sin Mercado activo no suma nada; mejorarlo pide el
> Mercado del mismo nivel. La flota del Mercado (Caravanas) cuenta su cupo y el de la «Ampliación de Flota» (`cupoDeFlota`) y lo dice en la
> cabecera («Mercado nivel N · Albergue nivel K»). Un clic en él, en la vista 3D, abre el Mercado en Caravanas.
>
> **Centro urbano › subida de nivel, Resumen y Cargos** (0.86.0, 2026-11-02, `ui/panelCentro.ts`; banco `pruebas/centro/`). **Subida**: tarjeta
> con el escudo de ahora ➜ el del nivel siguiente (apagado, o dorado si se puede), un piloto por requisito (verde, rojo, gris = lo comprueba el
> servidor), el tiempo de obra y el botón ⬆; los requisitos, con barras (pesants, artesanos, pueblos), los edificios pedidos en iconos
> (encendidos si están en marcha) y el coste en chips. Durante la obra, su barra y lo que falta. Desde 0.98.0 es la ventana «Subir de nivel»
> (requisitos abiertos) y el medallón brilla cuando todo está en verde (`ascensoPosible`). **Resumen** (hasta 0.97.0): sus piezas se
> repartieron en 0.98.0. La población por clases con su sitio (Viviendas activas × `capacidadPesants` / `capacidadArtesanos`; nobleza,
> `capacidadNobles` del Palacio) y el techo del nivel (`NIVEL_ASENTAMIENTO.techoPoblacion`), la nutrición y el mantenimiento van al pie
> (`ui/hudPlaza.ts`); el nombre, la Residencia y la capital, al blasón; el interruptor de auto-construcción, a Construcción. **Cargos**: una
> silla por cargo con su emblema (lápiz para cambiar, ＋ en una vacante) y los residentes en ranking (medallas, emblemas de sus cargos, barra de
> puntos), en la ventana Gobierno.
>
> **Reclutamiento y Taberna** (0.87.0, 2026-11-02, `ui/reclutamiento.ts`, `ui/panelIntel.ts`; banco `pruebas/centro/`). **Reclutamiento**: la ficha
> de la tropa como una carta (retrato, escalón en estrellas, poder y velocidad en barras contra lo mejor del catálogo, liderazgo, hombres libres,
> tu escuadra con su barra, coste en chips y botón Reclutar / Reponer / Completa) y una rejilla por edificio militar con barra de escuadra en cada
> casilla. **Taberna**: cabecera con oro y Miradas en ojos, tarjetas de servicio (Mirada, Informe) con el precio en chip, Miradas con su barra de
> tiempo e Informes con el nivel en escudo; el Informe abierto con edificios y guarnición en iconos y la muralla en barras.
>
> **Las cinco ideas del motor 906fb24** (0.200.0, 2026-11-10; bancos `pruebas/hud/`, `pruebas/centro/`, `pruebas/taberna/`). **Reclutamiento**: el
> ciudadano que no reside recluta escuadras nuevas a la columna con la que entró (si no está vetado y la plaza no lo cerró; tiene que caber en su
> Liderazgo), con una línea encima del árbol que lo explica; el Gobernador y el General residentes tienen el interruptor «Cerrar el reclutamiento
> a los ciudadanos» (`ui/reclutamiento.ts`). **Taberna**: la tarjeta «Rumores» con las vetas de estaño de la región (`ui/rumores.ts`), sin botón si
> la Facción ya las tiene exploradas. **Almacén**: «Pausar consumo», un interruptor por bien de consumo para el Gobernador y el Tesorero
> (`ui/consumoPausado.ts`); lo pausado sale en la Nutrición, el tooltip del recurso y la ventana de Facción. **Ascenso**: la solvencia es un aviso
> debajo de la tarjeta (`insolvenciaAscenso`), no un requisito.
>
> **Lo que trae un informe de región** (0.198.0, 2026-11-10, `ui/tabernaRegion.ts`; banco `pruebas/taberna/?ver=intel`). En «Tus informes de
> región», cada informe con algo que ver es un botón (el de órdenes, solo mientras se ven; caducado se queda como texto) que abre debajo, uno a la
> vez, lo que trae: la lista de las plazas de su región (las que ves y las de tu memoria, sin las de tu Facción ni las de una Facción en guerra
> con la tuya, como el motor), por nombre, con el nivel en escudo, su Facción, el sitio y de cuándo es la ficha, y un buscador arriba (nombre o
> Facción, sin tildes; esconde lo que no casa sin repintar, y lo buscado sigue tras el sondeo). En el de órdenes, cada plaza con órdenes lleva
> ▲ ventas y ▼ compras y un clic abre sus órdenes (cantidad, recurso, precio y caducidad; solo para verlas, se toman desde el Mercado › Región);
> las que no tienen dicen «sin órdenes» y no se abren.
>
> **Mercado** (0.88.0, 2026-11-02, `ui/panelMercado.ts`, `ui/panelTrueques.ts`; banco `pruebas/centro/`). **Órdenes**: una boleta con ▲ Vender
> (ámbar) / ▼ Comprar (azul), el almacén como inventario de casillas (lo que hay primero; lo vacío, apagado), cantidad y precio con lo que se cobra
> o paga, y las órdenes en pie como fichas con su barra de cumplido. **Caravanas**: cabecera con el Mercado, los cupos de caravanas y carros en
> casillas, el Liderazgo de escolta y «＋ Crear»; cada caravana, una tarjeta con su carreta, el color de su estado, cuatro cifras (carga, velocidad
> con el color de ritmo, preparación, carros que tiran) y los carros con su animal en una casilla (punteada en rojo si no tiene); «Reservada», en
> interruptor; la aparcada aquí, con su carga en fichas. **Trueques**: cada pacto con las dos plazas frente a frente (escudo, lo que da cada una en
> fichas con lo entregado), el estado como sello y «Aceptar» / «Rechazar»; para proponer, la plaza en tarjetas y una balanza Das / Recibes.
> Todos los rechazos salen flotando.
>
> **Muralla, Puerta, Tesorería y Fundación** (0.89.0, 2026-11-02, `ui/panelMuralla.ts`, `ui/panelPuerta.ts`, `ui/panelAliados.ts`,
> `ui/panelTesoreria.ts`, `ui/panelFundacionDePlaza.ts`; banco `pruebas/centro/`). **Muralla**: el plano de los anillos celda a celda (en pie del
> color de su material, la que se levanta latiendo, lo que falta punteado, puertas y torres), una tarjeta por anillo (escudo de nivel, material,
> puertas contadas como aberturas, torres, celdas, multiplicador de defensa `1 + (bono − 1) × integridad / puertas`, barra de obra o de mejora, la
> celda en curso y el coste por celda con la tarifa acumulada o la diferencia al mejorar) y los tres anillos como casillas para trazar, con candado
> si la plaza no llega; abandonar pide confirmación. **Puerta**: el portón con su estado, una casilla por grupo con candado que se marca en un
> borrador y se manda con «Fijar la puerta», y los vetados en fichas con ✕; **aliados**, en un interruptor. **Tesorería**: la reserva en fichas
> (lo que hay frente a lo que cabe y una raya roja donde empieza la reserva) y cada cargo con su emblema, sus slots en casillas, lo que tiene en
> vigor con la barra de lo que le queda y las políticas como cartas con sus efectos en chips verdes o rojos (las de otros pools del Gobernador,
> plegadas). **Fundación**: la carreta con su coste en fichas, los requisitos como pilotos con su porqué y las caravanas en tarjetas con la barra de
> lo que les queda antes de caducar. Todos los rechazos salen flotando.
>
> **Misiones, Tablón y Territorio** (0.90.0, 2026-11-02, `ui/misiones.ts`, `ui/tablon.ts`, `ui/pueblos.ts`; banco `pruebas/centro/`). **Misiones**:
> cartas con sello (📜 en curso, 🏆 cumplida), objetivos en barras doradas, la recompensa en fichas como en el diario, «◇ Seguir» en la cabecera y
> «🎁 Reclamar» que late en la cumplida; las hechas, en fichas plegadas. **Tablón**: cada columna con su cabecera (lo que falta para renovarse y la
> barra del periodo), las misiones en las mismas cartas (👥 grupal, 👤 individual) y la elección de la semana que viene en casillas. **Territorio**:
> la zona en fichas con una casilla por sitio (verde, libre), el cupo en casillas, cada pueblo en una tarjeta (emblema, escudo de nivel de la
> aldea, almacén y rebaño en barras, carro de acarreo con su escolta, «⬆ Nivel N», «🛒 Reponer carro», «✕ Destruir»), cada obra con lo entregado
> en fichas con barra, marcar en dos cartas (aldea y extractor, con los nodos libres como casillas) y las avanzadas en tarjetas. Todos los
> rechazos salen flotando.
>
> **Pueblos en botones** (0.197.0, Víctor 2026-11-10): los pueblos y las obras de la plaza van en una fila de botones con su icono (el nombre al
> pasar el ratón; el borde dice si está atacado o si la obra espera materiales o se levanta; la aldea lleva su nivel). Un clic abre su tarjeta
> debajo, una sola a la vez, y otro clic la cierra. «Marcar un pueblo nuevo» va tras un «+» al principio de la fila, plegable, y abierto de serie
> si la plaza no tiene ningún pueblo ni obra; con el cupo lleno, el «+» no sale.
>
> **La Cantera y las minas por nivel** (0.201.0, motor `c1ad93d`, contrato 0.22.0): el extractor lleva su nivel (1 a 3) como la aldea: en el
> botón de la fila, el escudo de la tarjeta y el nombre («Mina de estaño (nivel 2)»), y una ficha con lo que saca por él («⚙ Estaño ×2», el
> `factor` de `PUEBLOS_EXTRACTORES.extractor.niveles`, sin cifras por minuto). «⬆ Nivel N» con su coste sale solo al Gobernador o al Maestro de
> Obras residente y dentro, sin mejora en marcha y con la plaza ya en el nivel operativo que pide el siguiente (`nivelMadre`); manda
> `mejorarAldea`. Su obra se llama «Mejora de la mina (o de la cantera) a nivel N» y no ocupa cupo. Dentro del pueblo, el Resumen dice su nivel
> y lo que saca, y «Mejorar a nivel N» (la aldea igual) sale solo a quien tiene ese cargo en la madre (`ui/cargosPlaza.ts`). Banco:
> `/pruebas/hud/?ventana=territorio&minas=1`. Pruebas en `pruebas/extractoresPorNivel.test.ts`.
>
> **La aldea ganadera** (0.203.0, motor `3d05872`): un cultivo más al marcar la aldea (`ganado`, desde el nivel 1), y la carta se llama
> «Aldea ganadera». Solo corrales y rebaño, sin granjas: su tarjeta y su Resumen dicen sus corrales y su rebaño, sin fertilidad; se le deja
> ganado, carne y leche. Sus sitios, en la tierra del trigo. La aldea de trigo ya no tiene corrales. La Granja de la fundación tiene un solo
> nivel (sin «Mejorar») y el nivel 2 pide una Leñera y dos pueblos activos, todo desde los datos. Banco: `/pruebas/hud/?ventana=territorio&aldeas=1`.
> Pruebas en `pruebas/aldeaGanadera.test.ts`.
>
> **Avanzadas en Territorio** (0.174.0, `ui/pueblos.ts`, `tarjetaAvanzada`): cada una con su icono de etapa, la guarnición (de serie y de
> jugadores) y lo que guarda; para el Gobernador o el Maestro de Obras residente y dentro, «⬆ Fuerte / Ciudadela» con su coste (`mejorarAvanzada`),
> «🔧 Reparar» en ruinas (`repararAvanzada`, la mitad del coste de su etapa) y «✕ Destruir» (`destruirAvanzada`); su obra de mejora o reparación
> debajo, con «✕ Cancelar» (`cancelarObra`). El Gobernador elige además la tropa de serie de cada escalón (`elegirTropaDeAvanzada`) entre las que
> la madre recluta.

1. **Resumen** ✅ (repartido en 0.98.0: pie, blasón, Construcción) — nivel/nivel operativo, población
   (pesants/artesanos/nobleza + total), medidores de mantenimiento y nutrición, aviso de ocupación, toggle
   auto-construcción (`alternarAutoConstruccion`).
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
6. **Tropas** — tus escuadras y tu guarnición (`heroe.escuadrones`, ver `Features_Pendientes.md` §0.2),
   reclutar, movilizar.
7. **Políticas** — solo si tienes cargo: activas + activables.
8. **Puerta** — solo Gobernador: política de acceso + vetos.
9. **Almacén / reserva** — reserva manual por recurso (Tesorero), abrir a aliados.
10. **Muralla** — traer `pestanaMuralla` de `#/legacy`.
11. **(Comercio** — probablemente panel aparte.)

Clic en un edificio del mapa → abre la sección "Edificios" enfocada en ese edificio (`notas.md`).

Todo comando: comprobar `status` HTTP **y** `resultado.ok`; el `cargo` que se manda en `params` es el
del jugador (elegir el que aplique, o el único que tenga).
