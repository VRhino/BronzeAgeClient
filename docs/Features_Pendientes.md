# Features pendientes

Lo que le falta al cliente‑jugador, **contrastado con el backend** (`BronzeAgeFase0@02bd153`: comandos registrados en `src/session/comandos/registro.ts` y canon de `Docs/Game`). Revisado el **2026-10-09**, versión del cliente **0.25.0**. Sustituye a la lista del revamp de pantallas, que estaba desfasada: casi todo lo que pedía ya está hecho.

- Guía visual (leer antes de diseñar UI nueva): [`Diseno_Interfaz.md`](Diseno_Interfaz.md).
- Inventario de info y acciones del asentamiento: [`Panel_Asentamiento.md`](Panel_Asentamiento.md).
- Intención de producto / UX a mano: [`notas.md`](notas.md).
- Catálogo de comandos (qué está cableado y qué no): [`COMANDOS.md`](COMANDOS.md).

## Índice

1. [Hecho](#1-hecho)
2. [Pendiente — cliente](#2-pendiente--cliente)
3. [Pendiente — backend](#3-pendiente--backend)
4. [No aplica](#4-no-aplica)

---

## 1. Hecho

Para no volver a listarlo como pendiente:

- **Sesión:** login solo con la cuenta y pantalla de **partidas** (lista de partidas abiertas con tu héroe, Facción y nivel; «Cambiar de partida»). 0.25.0.
- **Héroe y mundo:** barra del jugador (Héroe, Escuadras, Carro, Facción, Avisos), panel Héroe (ficha, escuadras, guarnición, loadouts), tiempo real por WebSocket con sondeo de apoyo, presencia, avisos por eventos, panel del Carro, víveres.
- **Salir al mundo** con tropa y carga elegidas (campamento y plaza), y **ejércitos**: formar, unirse en campo y desde la plaza, ejército en preparación (convocar, unirse, partir), sin destino fijo (el Líder lo dirige con clics), entrar entero en un campamento o plaza, editar tu tropa en la preparación.
- **Plaza por edificio** (0.25.0): Centro urbano (resumen, edificios, producción, cola, cargos, ascenso, renombrar la ciudad, «Hacer de esta plaza mi base»), Reclutamiento, Taberna (intel) y Mercado (órdenes, caravanas, escolta). Taberna y Mercado salen bloqueadas con «necesitas construir …».
- **Campamentos de mercenarios:** planta, residir, préstamo de leva, mercado, fondo de refundación, taberna, salir (también como ejército).
- **Facción:** crear, unirse, solicitar ingreso, cargos locales, anexión y fusión, admisión de otras Facciones.
- **Mapa:** fichas de plaza, campamentos (bandidos y mercenarios), alijos y ejércitos; atacar plazas y campamentos de bandidos; riel de columna, ejército, mis cosas y fundar.
- **Interfaz:** repintado mínimo de todos los paneles (`ui/repintado.ts`) y mapa de códigos de error a mensajes (`ui/erroresServidor.ts`).

## 2. Pendiente — cliente

Cada punto dice el comando (ver `COMANDOS.md`) y de dónde sale en el canon.

### 2.1 Mapa y militar
1. **Columnas ajenas** (Doc 5.12.3): `atacar` con objetivo `ejercito`, `perseguir`, `dejarDePerseguir` e `inspeccionar`. Hoy «te persiguen» avisa pero no hay respuesta (huir o plantar cara).
2. **Caravanas ajenas** (Doc 5.12.3): inspeccionar e interceptar; las avistadas (`caravanasAvistadas`) solo se pintan.
3. **Héroes ajenos:** ficha pública al seleccionar una columna propia o avistada (`heroesVisibles`: nombre, clase, nivel, herido, escuadras que lleva).
4. **Reabastecer aliados:** `alternarReabastecerAliados` (Doc 5, reabastecimiento en ruta).
5. **`salirDeAsentamiento`:** retomar la columna aparcada en una plaza ajena (Doc 1.10).
6. **Persistencia de la vista:** zoom, pan, panel del riel abierto y selección se pierden al salir del mapa; conservarlos (`localStorage`).
7. **Mis asentamientos fuera de visión:** «Mis cosas» solo lista los que están en vista o en memoria. Puede necesitar un campo de la proyección (ver 3.4).

### 2.2 Plaza
8. **Muralla:** `comprometerRecinto`, `abandonarRecinto` y `mejorarRecinto` solo funcionan en `#/legacy`; la plaza por edificio no tiene la pestaña. Traerla a Centro urbano.
9. **Puerta y veto** (Doc 1.10.5, Doc 2.8): `fijarPuerta` (`cerradaA`: neutrales, aliados, enemigos, aedas; la fija el Gobernador o el Rey) y `vetarJugador` (solo el Gobernador; a un residente no se le veta). Condicionan quién entra, también un ejército.
10. **Residencia:** `dejarResidencia` (libera la vivienda sin dejar la Facción) y `designarCapital`.
11. **Reclutar en un campamento de mercenarios** (Doc 5, 2026-10-02): `reclutarEnCampamento`, solo oro y población del campamento, para quien reside en él. El cliente solo ofrece el préstamo gratuito.
12. **Interfaz de la ciudad:** clic en un edificio (ficha con mejorar, pausar, prioridad) y resaltado desde la lista; producción y **consumo** en el tooltip; `alternarReceta` (pausar recetas); escala de la vista (`radioMapa = 60` fijo frente al canon `REJILLA_ASENTAMIENTO.radioMapa = 220`: puede recortar plazas grandes).
13. **Tesorero** (Doc 3, Doc 4): `calibrarReservaManual` y `activarPolitica`.
14. **Glosario «Información»:** solo en `#/legacy`.

### 2.3 Comercio y caravanas
15. **Tomar una orden ajena:** `comerciarEnPlaza`, desde el mapa con una columna tuya a la puerta de esa plaza (no se puede desde dentro de la tuya).
16. **Trueques** (Doc 3.2): `proponerTrueque`, `aceptarTrueque` y `rechazarTrueque`.
17. **Caravanas aparcadas** (Doc 3.13.7): `moverCargaCaravanaAparcada` y `enviarCaravanaAlOrigen`.
18. **Caravanas adjuntas a un ejército** (Doc 5.13): `adjuntarCaravana`, `soltarCaravana`, `cargarCaravana` y `entregarDeCaravana`.
19. **Caravana de Fundación de plaza:** `lanzarCaravanaFundacion` y `desarmarCaravanaFundacion`. Confirmar si siguen en el canon: la de un campamento ya se compra.

### 2.4 Facción, diplomacia y tecnología
20. **Cargos de Facción:** `asignarRey`, `asignarEmbajador` y `dejarFaccion`.
21. **Relaciones** (Doc 2.4): `proponerRelacion` (vasallaje o alianza, con tributo), `declararGuerra`, `proponerPaz`, `romperRelacion` y `rebelionVasallo`.
22. **Tecnología y Aedas** (Doc 6): `adoptarTecnologia`, `comprarTecnologiaAeda`, `empezarEpica` y `abandonarEpica`. No hay ninguna interfaz; la proyección ya trae `tecnologia` (era, logros y `propias.aparecidas/adoptadas/reveladas`).
23. **Dudoso:** `iniciarAsedio`. El canon habla de «Atacar» una plaza y el cliente ya usa `atacar`; probablemente no hace falta.

## 3. Pendiente — backend

1. **Costes en el balance:** `GET /v1/balance` no publica el coste de carros y animales (`CARRO_CATALOGO`, `ANIMAL_CATALOGO`) ni el oro por soldado del reclutamiento (`RECLUTAMIENTO_ORO_POR_ESCALON`, `ORO_POR_CABALLO`). Hoy el cliente enseña el rechazo del servidor en vez del precio de antemano.
2. **Lista de partidas:** `GET /jugador/partidas` no trae nombre de partida ni estado distinto de `activa`.
3. **Evento de posición:** el sondeo de 3 s existe solo porque el movimiento de las columnas no genera eventos; con un evento de posición (o un tick por el canal) se quitaría.
4. **Lista de plazas de la Facción:** un asentamiento propio fuera de visión y sin foto en memoria no viaja en la proyección (ver 2.1.7).
5. **Trazado de los campamentos de bandidos:** esquemático hasta que el backend lo publique.

## 4. No aplica

**Unity** (lo resuelve Conquest, no el cliente web):
- Creación completa del héroe: clase, género y aspecto (`crearHeroe`; la pantalla provisional solo pide nombre).
- Equipo, inventario y perks (CQ-004; `equipamiento`, `inventario` y `perksSeleccionados` llegan vacíos).
- Batallas de Unity: `unirseABatalla`, `cancelarBatalla`, `proyeccion.batallas`, el token de asignación.

**Descartado del canon:**
- Entrar a una plaza solo con llegar a la puerta: se queda el botón «Entrar» (y el aviso de «ya puedes entrar» no hace falta).
- `comprarCasa` (ya no existe en el backend).
- `fijarPoliticaDeAcceso` (lo sustituye `fijarPuerta`, punto 9).

**Resuelto por el backend, ya no es una tarea:**
- Columna huérfana: el «héroe huérfano» dejó de existir el 2026-10-02 (Doc 0).
- Fundación grupal: los ciudadanos de la columna del titular son cofundadores, hasta 5 (Doc 1.3).
- Eventos de combate, tiempo real de datos y nombres de los solicitantes de ingreso (cliente 0.14.1 y 0.15.0).
