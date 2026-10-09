# Features pendientes

Lo que le falta al cliente‑jugador, **contrastado con el backend** (`BronzeAgeFase0@02bd153`: comandos de `src/session/comandos/registro.ts` y canon de `Docs/Game`). Revisado el **2026-10-09**, versión del cliente **0.27.0**. Con 0.26.0 se construyó todo lo pendiente de la revisión anterior que dependía solo del cliente; lo que queda es verificar en vivo y lo que espera al backend.

- Guía visual (leer antes de diseñar UI nueva): [`Diseno_Interfaz.md`](Diseno_Interfaz.md).
- Inventario de info y acciones del asentamiento: [`Panel_Asentamiento.md`](Panel_Asentamiento.md).
- Intención de producto / UX a mano: [`notas.md`](notas.md).
- Catálogo de comandos (qué está cableado): [`COMANDOS.md`](COMANDOS.md).
- Detalle de cada bloque de 0.26.0 (qué hace, comandos, qué quedó sin verificar): [`bloques/`](bloques/).
- Lo que hay que pedir al backend, reunido: [`Peticion_Backend.md`](Peticion_Backend.md) (**borrador sin enviar**).

## Índice

1. [Hecho](#1-hecho)
2. [Pendiente — cliente](#2-pendiente--cliente)
3. [Pendiente — backend](#3-pendiente--backend)
4. [Sin verificar en vivo](#4-sin-verificar-en-vivo)
5. [No aplica](#5-no-aplica)

---

## 1. Hecho

- **Sesión:** login solo con la cuenta y pantalla de partidas (tu héroe, Facción con emblema y nivel; «Cambiar de partida»).
- **Héroe y mundo:** barra del jugador (Héroe, Escuadras, Carro, Facción, **Tecnología**, Avisos), panel Héroe, tiempo real por WebSocket con sondeo de apoyo, presencia, avisos por eventos, panel del Carro, víveres, repintado mínimo (`ui/repintado.ts`) y mapa de errores (`ui/erroresServidor.ts`). **La vista del mapa persiste** (zoom, pan, panel y selección, por partida).
- **Salir al mundo** (tropa y carga; como ejército) y **ejércitos** completos: formar, unirse, preparación, sin destino fijo, entrar entero a campamento o plaza. **Salir de una plaza donde no resides** (`salirDeAsentamiento`).
- **Mapa:** fichas de plaza (con **mercado de la plaza: tomar una orden ajena**), campamentos, alijos, ejércitos propios y **columnas y caravanas ajenas** (inspeccionar, perseguir, atacar/interceptar, dejar de perseguir, plantar cara a quien te persigue, fichas públicas de héroes ajenos).
- **Plaza por edificio:**
  - **Centro urbano:** Resumen, Edificios, Producción, Cola, Cargos, **Muralla, Puerta (puerta y veto), Residencia (dejar residencia, capital), Tesorería (reserva y políticas), Fundación (caravana de fundación de plaza), Recetas, Aliados (reabastecer aliados), Información**.
  - **Reclutamiento**, **Taberna** (intel) y **Mercado:** Órdenes, Caravanas, Escolta, **Trueques, Aparcadas**.
  - **Vista de la ciudad:** clic en un edificio (ficha con mejora y cola), resaltado cruzado con la lista, tooltip con producción, escala derivada del contenido.
- **Caravanas con ejército:** enganchar, soltar, cargar y entregar (panel «Lo que llevas»). **Tope de la flota del Mercado** (caravanas y carros) en Mercado › Caravanas.
- **Campamentos de mercenarios:** planta, residir, préstamo de leva, **reclutar y reponer pagando oro**, mercado, fondo de refundación, taberna, salir.
- **Facción:** crear, unirse, solicitar ingreso, cargos locales, anexión, fusión, admisión de otras Facciones, **traspaso del trono, Embajador, dejar la Facción y toda la diplomacia** (alianza, vasallaje con tributo, guerra, paz, romper, rebelión).
- **Interfaz limpia (0.27.0):** texto explicativo tras un botón «ⓘ» en plaza, mapa, ejércitos, campamento y paneles del jugador; paneles laterales más anchos con tres columnas en plaza y campamento; Mercado con una sola pestaña Caravanas (escolta y aparcadas dentro de cada caravana); emblema de la ciudad en los trueques; sigilo completo de la Facción en el mapa.
- **Tecnología y Aedas:** era y logros, adoptar, comprar a un Aeda, épicas.

## 2. Pendiente — cliente

1. **Mis asentamientos fuera de visión** (§6.2 antiguo): probablemente ya resuelto en el servidor (las plazas propias son ojos de la Facción y salen siempre como avistadas); falta confirmarlo en vivo.

Todo lo demás del cliente está construido; el trabajo abierto es **verificarlo con estado real** (§4) y cuando el backend publique lo de §3 quitar las copias a mano que hay en el cliente.

## 3. Pendiente — backend

Contrastado contra el canon y el código del servidor en [`Peticion_Backend.md`](Peticion_Backend.md) (**enviada a la sesión de Backend el 2026-10-09**). Resumen:

1. **Publicar en el balance** lo que hoy solo está en `constants.ts`: catálogos de carros y animales, oro por soldado del reclutamiento, `MOVIMIENTO` (radios), `CAPITAL`, `PUERTA`, y el precio y las tropas desbloqueadas del campamento.
2. **Catálogo de tecnología y Aedas** (Doc 6), la Era de cada tecnología, la capital de la Facción, el progreso de los hitos y qué admite épica.
3. **Contra el canon:** una vasalla puede llamar a `romperRelacion` sobre su vasallaje (Doc 2.4 no lo contempla); `perseguir` no rechaza aliados, ejército→caravana ni a un no‑Líder (Doc 5.12.3).
4. **Comodidades:** resultado de `inspeccionar` en la proyección, almacén de tus plazas desde el mundo, nombre y estado de partida, evento de posición.
5. **Aceptación de alianza y vasallaje** (decidido por el autor, como anexión y fusión): `responderRelacion` y `propuestasRelacion` en la proyección. Cuando existan, el cliente construye propuestas recibidas (Aceptar o Rechazar) y enviadas (Retirar).

## 4. Sin verificar en vivo

Todo lo de 0.26.0 se probó con **proyección fabricada** (el servidor rechaza los comandos de una plaza que no existe y se comprobó que el rechazo se ve) salvo lo que dice «en vivo». Falta ver con estado real:

- **Plaza:** Muralla, Puerta, Residencia, Tesorería, Fundación (lanzar y desarmar), Recetas, Aliados (el interruptor y la restricción por cargo), mejorar y quitar de cola desde la ficha del edificio; salida real de una plaza ajena con columna aparcada; **Mercado:** órdenes, caravanas, trueques (aceptar y proponer con éxito), aparcadas (cargar y enviar al origen). La ficha de edificio no se vio en captura (el navegador no componía fotogramas).
- **Mapa:** resultado real de inspeccionar, atacar y perseguir (e informe de combate), «Dejar de perseguir» con un `persiguiendo` real, tomar una orden ajena (cantidad servida), restaurar la selección de plaza o alijo, cambio de partida con la vista guardada, `localStorage` bloqueado.
- **Caravanas con ejército:** enganchar, soltar, cargar y entregar aceptados por el servidor; la regla «solo el Líder» no se aplica porque el servidor deja a cualquiera de la columna.
- **Campamento:** pagar con el carro, reponer con bajas, que la escuadra nueva se una a la columna, precio con reputación o sin asentamientos. *(Verificado en vivo: reclutar honderos y escaramuzadores, rechazos por tecnología y por falta de oro.)*
- **Facción:** rebelión con trueques reales, guerra arrastrada por vasallaje con terceros, sucesión del trono con más de dos ciudadanos, un rechazo de dominio en estos paneles. *(Verificado en vivo con dos cuentas: alianza, guerra, paz, vasallaje, rebelión, Embajador, trono, dejar la Facción.)*
- **Tecnología:** adoptar, comprar, empezar y abandonar con éxito; botones apagados por cargo.

- **Interfaz (0.27.0):** el ancho real de las columnas nuevas se vio solo en capturas de Chrome propio a cuatro tamaños (el panel integrado del navegador está oculto); la ficha de edificio por clic en el lienzo; las filas de tropas y el formulario de Mirada e Informe de la Taberna en pantalla; Muralla con botones apagados y la vista `#/legacy`; Anexión y Fusión con propuestas; la ayuda de elegir o crear Facción. Y los comandos de Mercado (escolta, aparcadas) con estado real.

## 5. No aplica

**Unity** (lo resuelve Conquest, no el cliente web):
- Creación completa del héroe: clase, género y aspecto (la pantalla provisional solo pide nombre).
- Equipo, inventario y perks (CQ-004).
- Batallas de Unity: `unirseABatalla`, `cancelarBatalla`, `proyeccion.batallas`, token de asignación.

**Descartado del canon:**
- Entrar a una plaza solo con llegar a la puerta (se queda el botón «Entrar»).
- `comprarCasa` (ya no existe) y `fijarPoliticaDeAcceso` (lo sustituye `fijarPuerta`).
- `iniciarAsedio`: el canon solo reconoce asediar con «Atacar» desde un ejército (Doc 5.12.4); es una vía directa entre plazas vecinas que el backend conserva sin movilizar.

**Resuelto por el backend:** columna huérfana (el héroe huérfano ya no existe, Doc 0) y fundación grupal (los ciudadanos de la columna son cofundadores, Doc 1.3).
