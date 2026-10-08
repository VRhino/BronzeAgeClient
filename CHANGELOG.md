# Changelog — Cliente de jugador

Formato: cada entrada anota la **fecha de sincronización con el backend** (`BronzeAgeFase0`) y contra qué
commit suyo se midió. La brecha detallada vive en `docs/Analisis_Brecha_Backend.md` y `docs/COMANDOS.md`.

## [0.21.1] — 2026-10-08 · los plazos de ejército en tiempo real y el aviso de la formación

### Corregido
- Reproducido con dos cuentas en la partida viva: «el ejército se destruye» porque una **formación** (con menos de 3 héroes) se deshace a los 10 min de MUNDO, y ese mundo corre a ~114×: dura unos 6 s reales. Es un plazo del backend (pedida su corrección); desde el cliente, los plazos (formación, petición de unión) se enseñan ahora en **segundos reales**, midiendo el ritmo del mundo entre sondeos (`medirRitmoDeMundo`).
- Al unirte a una formación el aviso decía «ahora sigues su destino»; ahora dice que aún no es un ejército, que hacen falta 3 héroes y cuánto queda.
- El panel ⚑ de una formación avisa de que con menos de 3 héroes no se mueve.

## [0.21.0] — 2026-10-08 · formar y unirse a ejércitos · sync con `BronzeAgeFase0@74413b0` (`main`, sin push)

### Añadido
- **Panel ⚑ «Ejército»** en el riel del mapa (`ui/ejercitos.ts`), con lo que toca según tu columna: personal (organizar un ejército o unirte), formación (cancelar / separarme), ejército (Líder: responder peticiones, acampar, replegar, ceder el mando; el resto: separarme). Lista los ejércitos y formaciones de tu Facción con Líder, héroes, estado, política de unión y distancia; «Unirme» se desactiva con el motivo (lejos, columna no personal, cerrado, sin Facción, petición ya enviada).
- **Unirse a un ejército ya formado** (antes solo se podía a las formaciones): desde el panel o seleccionándolo en el mapa (ficha). Con política «decide el Líder» el solicitante ve «Petición enviada» y el **Líder recibe el aviso al momento** (evento `columna.union_pedida` con `liderId`, y sondeo de respaldo) con Aceptar/Rechazar y cuenta atrás. Avisos de aceptada/rechazada al solicitante.
- **Salir como ejército** desde un campamento (`salirDelCampamento` con política y destino) y desde tu plaza (`movilizarEjercito`, con `carga` del carro): «Columna personal / Ejército», política (abierto, decide el Líder; cerrado solo desde la plaza) y destino elegido con un clic en el mapa del mundo (`ui/salidaComoEjercito.ts`).
- **Unirse desde tu plaza** (`unirseAEjercito`): botón «Ejércitos» en la plaza, con la tropa que aportas y los ejércitos de tu Facción a ≤ 60 de ella (`ui/unirseDesdePlaza.ts`). El backend aún no aplica la política de unión desde la plaza, y el cliente tampoco la oculta.

### Cambiado
- «Mi columna» sale de «Mis cosas» y vive en el panel ⚑.

## [0.20.0] — 2026-10-08 · víveres · sync con `BronzeAgeFase0@b7c097a` (`main`, sin push; BALANCE_VERSION 13)

### Cambiado
- **La barra de comida es ahora la de VÍVERES**: `heroe.viveres` frente a lo que cabe a un héroe (`LOGISTICA.capacidadViveresPorHeroe`, 350, del balance público). Los víveres son el trigo que come la columna (en marcha, media ración; acampada, una décima parte de eso: `factorConsumoEstacionado`), van siempre contigo y no se descargan. En un ejército el backend suma los de todos, pero la proyección solo trae los tuyos: se enseñan los tuyos.
- **«＋ desde el carro»** al final de la barra: abre un selector (barra y número, hasta el menor entre el trigo del carro y el hueco de tus víveres) y envía `pasarAViveres { cantidad }`. Se desactiva, con el motivo en el tooltip, si no eres el Líder, el carro no lleva trigo o los víveres están llenos.
- El carro ya no se come: es solo carga, y todo su trigo se puede guardar (desaparece la «ración gratis» no guardable, `Ejercito.racion`). Textos de moral, deserción y salida de campamento hablan de víveres.
- Las escuadras prestadas salen completas: el tamaño sale de `unidadesPorDefecto` del balance, no del «15 hombres» fijo.

## [0.19.1] — 2026-10-08 · «Aceptar» una solicitud no hacía nada

### Corregido
- Los avisos de error de los botones de Facción (aceptar/denegar solicitudes, anexión, fusión, admisión…) solo se pintaban en el mapa: en campamento y plaza se perdían en silencio y el botón parecía muerto. Ahora salen en un aviso flotante en cualquier pantalla.
- El escudo de la Facción generaba un id nuevo en cada pintado, así que el panel se reconstruía en cada sondeo (3 s) y se llevaba por delante clics y mensajes. El id depende ahora de la forma.
- Backend (causa): al hacerse ciudadano de una Facción por cualquier vía (crearla, fundar una plaza, ser aceptado) se cancelan todas sus solicitudes de ingreso vivas en las demás, y el tick borra las que ya estuvieran caducadas en partidas guardadas; antes quedaban en la lista del Rey y aceptarlas daba `faccion.invalida`. **Hace falta reiniciar el servidor.**

## [0.19.0] — 2026-10-08 · escolta de caravanas · sync con `BronzeAgeFase0@3d884fd` (`main`, sin push)

### Añadido
- **Panel «Escolta»** en la plaza (`ui/panelEscolta.ts`): por cada caravana comercial de tu plaza, una barra de Liderazgo de la escolta («64/100 pts · quedan 36»; `escoltaLiderazgo { usado, cupo }` lo da el backend, no se calcula aquí), tus escuadras cedidas con «Retirar» y las que puedes ceder con «Ceder» (desactivada, con el motivo, si su coste no cabe). Solo con la caravana parada en su origen y siendo residente; el resto, en solo lectura. Ceder no gasta tu Liderazgo (regla del backend). Comandos `asignarEscolta` y `quitarEscolta`.
- **Coste de Liderazgo** (♛ N) como marca pequeña junto al nombre de cada escuadra en «Lo que llevas», las listas del campamento (resumen, Tropa, Salir) y la salida de la plaza.

## [0.18.1] — 2026-10-07 · el fondo de refundación enseña el precio y lo que falta

### Cambiado
- **Fondo del campamento**: muestra el precio de la Caravana de Fundación (derivado del balance público: materiales iniciales + granja + viviendas + madera extra, por el porcentaje de refundación), una barra total y una por material con lo reunido por tu Facción, «faltan N» y lo que has puesto tú. «Aportar» enseña lo que tienes y lo que falta de cada material, y tiene «Lo que falta». «Comprar caravana» solo se activa con el precio completo y dice qué falta.

## [0.18.0] — 2026-10-07 · carga del carro al salir (campamento y plaza) y oro de botín separado

### Añadido
- **Salir al mundo desde tu plaza** ya no sale «en seco»: el botón abre un panel donde eliges la tropa que sacas y lo que cargas en el carro del almacén de la plaza (`salirAlMundo.carga`; el backend reserva el trigo que necesita la tropa que se queda).
- Cargar el carro al salir de un campamento y de una plaza comparte módulo (`ui/cargaDeSalida.ts`): cada recurso con lo que hay, cantidad, botón «Todo» y el total contra la capacidad del carro (500). Explica que al volver a entrar a un campamento el carro regresa a tu almacén personal.

### Cambiado
- El **oro de botín** va en su propio recuadro, fuera del carro y del almacén, con la explicación de para qué sirve y que nunca se pierde.

## [0.17.1] — 2026-10-07 · el oro de botín y el carro, explicados

### Cambiado
- Los textos de bandidos decían que su botín iba al carro: es falso. El oro va a `oroDeBotin`, aparte del carro y del almacén, y el backend nunca lo quita al perder (solo se pierde la mitad del carro). El panel del carro lo dice.

## [0.17.0] — 2026-10-07 · barra de comida en el mundo abierto

### Añadido
- **Barra de comida** abajo en el mapa: el trigo que queda en el carro de tu columna, que baja con la marcha (se vacía respecto al máximo que has llevado en el viaje y se pone roja por debajo del 25 %). Con el cursor encima explica qué pasa si se acaba.

## [0.16.2] — 2026-10-07 · «sin membresía» con salida · sync con `BronzeAgeFase0@501459d` (`main`, sin push)

### Cambiado
- Entrar a una partida donde tu cuenta no tiene membresía vigente ya no deja un callejón: el mensaje explica el motivo y hay un botón «Unirme a esta partida».
- Backend: unirse reabre una membresía terminada (p. ej. la cerró el borrado de una partida que luego se recreó con el mismo id) en vez de dar 409; antes el cliente ignoraba ese 409 y el 403 siguiente no tenía salida. **Hace falta reiniciar el servidor** para que lo aplique.

## [0.16.1] — 2026-10-07 · campamentos de mercenarios como en el cliente admin

### Cambiado
- Los campamentos de mercenarios se dibujan como en el cliente admin: cuadrado azul con el anillo de la zona de protección (radio 60, donde nadie inicia un combate).

## [0.16.0] — 2026-10-07 · lo que llevas, errores con motivo, botín en el informe y mercado nuevo · sync con `BronzeAgeFase0@a0945dd` (`main`, sin push)

### Añadido
- **«Lo que llevas»** (⚔ en el riel del mapa, `ui/panelColumna.ts`): la tropa de tu columna en su orden de combate, con hombres, moral y si es prestada,
  flechas para cambiar el orden (comando nuevo del backend `ordenarEscuadras`: la primera entra primero, en la batalla de Unity y en el combate con
  números) y debajo el carro y el almacén personal.
- **Mercado del campamento rediseñado**: lista de bienes en venta (con su precio por unidad) y, del elegido, en venta, lo que ya tienes (almacén o carro),
  el cupo de hoy, tu oro, la cantidad (número y barra) y, en vivo, cuánto pagas, cuánto te queda y cuánto tendrás; después, «Comprar N por T de oro». Tras
  comprar dice lo que se sirvió de verdad. Precio y cupo los manda el backend (`mercadoCampamento`).
- **Botín y pérdida en el informe contra bandidos**: si cae, el oro de botín que ganas; si aguanta, lo que pierdes del carro (backend `oroPorHeroe` /
  `carroPerdido`).
- **Aviso de deserción por hambre**: agrupado por tanda («Desertan por hambre: Milicia −2…»). El backend no le mandaba ese evento a nadie en una columna
  salida de un campamento; ahora lleva el `heroeId`.

### Cambiado
- **Los errores dicen el motivo real**: el backend manda `detalleError` (p. ej. «La columna no lleva soldados con los que atacar.») y es lo que se enseña;
  el texto genérico de `combate.invalido` ya no sugiere distancia o herida.
- «Atacar» avisa antes de enviar si tu columna no lleva soldados vivos o estás a menos de 60 de un campamento de mercenarios.

### Investigado: «no me deja atacar a menos de 15 y sin estar herido»
Reproducido el mismo recorrido (crear Facción, préstamo, salir, ir a 6 del campamento, atacar) contra el backend actual: el ataque se acepta. Tu partida ya no
existía para leer su rechazo, y el backend solo devolvía el código, así que no se puede saber cuál de sus causas fue (columna sin soldados vivos —p. ej.
por deserción—, escuadras de un héroe herido…). Desde ahora el mensaje dice el motivo exacto. Encontrado de paso: una columna sin ración deserta hasta 0
sin avisar (corregido arriba), y tras reiniciar el servidor la recuperación de ticks puede dejarla así.

## [0.15.0] — 2026-10-07 · tiempo real, estados activos y Facción estable · sync con `BronzeAgeFase0@4bf2ac6` (`main`, sin push)

### Añadido
- **Tiempo real**: el WebSocket, que antes solo servía para la presencia, se suscribe a `mapa/general`, a `heroe/<tuId>` (canal personal nuevo del
  backend) y a `asentamiento/<id>` de cada plaza de tu Facción que conoces; las suscripciones se rehacen al reconectar y se ajustan con cada
  proyección. Un evento solo avisa: el cliente pide al momento la proyección y el cursor de eventos (agrupando ráfagas en 250 ms). Verificado: el
  briefing de un ataque llega en ~0,5 s en vez de hasta 3 s. El sondeo de 3 s se mantiene, porque el avance de las columnas no genera eventos.
- **Estados activos** («debuffs») en la barra superior, en el mapa, el campamento y el asentamiento (`ui/estados.ts`): icono pequeño y nombre, con la
  descripción en un tooltip al pasar el cursor (o con el foco). Herido, Saliendo del mundo, Moral baja / Deserción de tu columna, Plaza ocupada y
  Hambre / Hambruna de la plaza donde estás. Todo sale de la proyección.

### Cambiado
- **El menú de sesión (avatar) vuelve a verse y a pulsarse**: desde 0.14.0 la barra superior se pintaba encima del avatar (z-index), así que «Cerrar sesión»,
  «Refrescar» y el resto del menú quedaban tapados en todas las pantallas.
- **Sin atajo de teclado para el mapa**: se quita la tecla `M` (y `Esc`); el mapa desde dentro se abre y se cierra solo con el botón «Mapa» y «Volver».
- **El panel de Facción ya no cambia solo**: el selector de escudo generaba un sigilo al azar en cada pintado, así que el HTML cambiaba en cada
  refresco y el panel se repintaba entero, llevándose el nombre y el escudo elegidos. Ahora el sigilo propuesto es fijo y, mientras creas una
  Facción o buscas a cuál pedir ingreso, el panel no se repinta salvo al cambiar de modo.

## [0.14.1] — 2026-10-07 · con los arreglos del backend · sync con `BronzeAgeFase0@60b0939` (`main`, sin push)

### Cambiado
- **El briefing de combate ya llega**: el backend entrega por `GET /eventos` los eventos que nombran a tu héroe (hallazgo 1 de 0.14.0). Verificado en vivo: un
  ataque fallido a un campamento de bandidos de nivel 3 abre su briefing, el toast y el contador de Avisos.
- **Tropa prestada retirada**: se avisa con el evento del backend `mercenarios.prestamo_retirado` (hallazgo 2b). Se quita la detección por diff de proyecciones
  (`vigilarProyeccion`), que con los eventos ya solo duplicaba avisos.
- **Carro**: enseña la ocupación del carro y del almacén personal contra su capacidad (`ejercitos[].capacidadCarga`, `heroe.capacidadAlmacenPersonal`; hallazgo 3).
- Los solicitantes de ingreso salen por nombre (el backend los añade a `nombresDeCompaneros`).
- Revisión de 0.14.0: el panel Carro ya no se repinta mientras escribes una cantidad (en marcha la ración cambia cada tick); Crear Facción no enseña los motivos
  hasta que se toca algo (solo apaga «Crear»); el resumen del combate pone tu poder primero.

### Sigue pendiente en el backend
- El canal `mapa/general` no lleva los eventos de «ninguna plaza» (`asentamientoId: ''`): solo el cursor. Hace falta un canal por héroe cuando el cliente use el tiempo real.
- Trazado de los campamentos de bandidos (el plano de la ficha sigue siendo esquemático).

## [0.14.0] — 2026-10-07 · barra del jugador, campamento por subpestañas, avisos de combate y carro · sync con `BronzeAgeFase0@main` (`d1ae802`, `7680bd3`, `90c0caf`)

### Añadido
- **Barra superior del jugador** común al mapa, al campamento y al asentamiento (`src/ui/barraJugador.ts`): Héroe, Escuadras, Carro, Facción y Avisos. Antes el héroe y la Facción
  vivían en el riel del mapa y en la barra del asentamiento, y el campamento no tenía ni héroe. El riel del mapa conserva solo lo del mapa (Mis cosas, Fundar); la barra del
  asentamiento, lo de la plaza (Cargos, Taberna e intel, Salir al mundo).
- **Campamento de mercenarios por subpestañas**, como el asentamiento (`pantallaCampamento.ts`): planta a la izquierda y, a la derecha, Resumen · Salir · Tropa · Mercado · Fondo (solo sin
  plaza) · Taberna. Ya no hay una columna infinita ni el flujo de Facción metido dentro. Sondeo de 3 s con diff del DOM.
- **Mapa desde dentro**: tecla `M` o botón «Mapa» de la barra superponen el mapa del mundo (zoom y arrastre, la visión que se tiene dentro, solo para mirar) sobre el campamento o la plaza;
  `M` o `Esc` vuelven. No se sale de donde se está.
- **Planta del campamento como la del admin** (`planoCampamento.ts`): suelo, calles, empalizada y rótulos con la paleta de `drawCampamento`, encuadrada sobre la empalizada.
- **Ficha del campamento de bandidos**: nivel (1-3) bien visible, poder, defensores y botín por héroe (de `GET /v1/balance`, `internas.CAMPAMENTOS_BANDIDOS.niveles`), a quién acosa, y un plano
  esquemático (`planoBandidos.ts`). Tipo `CampamentoBandido` con `nivel`, `bosqueId`, `asentamientoId`, `campamentoMercenariosId`.
- **Briefing de combate** (`informeCombate.ts`): ganador, poder de cada bando y bajas por escuadra para `combate.resuelto`, `combate.campamento_destruido` y `combate.ataque_campamento_fallido`,
  filtrado por `heroesIds`. Avisos de eventos (`avisos.ts`) con **historial consultable** (panel Avisos, localStorage por partida y héroe) y contador de no leídos.
- **«Te persiguen»**: banda roja en la barra con la Facción y los héroes de cada columna con `teSigue`.
- **Carro personal** (`panelCarro.ts`): contenido del carro de la columna (la ración gratis de trigo aparte), almacén personal y oro de botín, con *Guardar* (`guardarEnAlmacenPersonal`) y
  *Al carro* (`sacarDelAlmacenPersonal`) para el Líder. Tipos `Ejercito.suministro/racion`.
- **Crear Facción**: valida antes de enviar y enseña **todos** los motivos detectables (nombre vacío o repetido, colores del fondo iguales, sigilo repetido, ya perteneces) con su remedio, y
  apaga el botón. Cada `codigoError` del backend se traduce (`erroresServidor.ts`), en toda la interfaz.
- **Nombres de dirigentes**: Rey, Embajador, solicitantes de ingreso, Rey de cada Facción en «Pedir ingreso» y Gran Rey de la Liga salen por nombre (`nombresDeCompaneros` +
  `nombresDeDirigentes`, `ui/nombres.ts`).
- **Presencia**: el cliente abre el WebSocket de tiempo real y lo cierra al cerrar sesión (cualquier camino: `cerrarSesion` lo hace) o la pestaña (`pagehide`). El servidor desconecta al héroe
  cuando cierra el último socket; hasta ahora este cliente no abría ninguno, así que nunca figuraba conectado. Verificado: tras cerrar sesión el héroe queda con `desconectaEn`.
- **Bajas vistas en la proyección** (`vigilarProyeccion`): una escuadra que mengua, que desaparece o un héroe que pasa a Herido generan aviso aunque el backend no mande el evento (ver abajo).

### Cambiado
- **Se quita «Taberna e intel» del mapa**: la intel solo se compra dentro de una taberna (plaza propia con taberna o campamento de mercenarios), como ya exigía el backend. El panel de intel
  ya no tiene «elegir punto en el mapa».
- Residir en otro campamento con tropa prestada pide confirmación: el backend retira esa tropa al dejar de residir en el campamento que la prestó (D45), sin ningún evento.
- El campamento enseña TODA la tropa del héroe con su sitio real («en el campamento», «en tu columna, aparcada en la puerta»…): quien entra en un campamento donde no reside deja su columna
  aparcada y sus escuadras NO pasan a `contenedor: campamento`, y la pantalla anterior filtraba solo esas.
- La ficha de Selección del mapa se desplaza si no cabe.

### Hallazgos del backend (no se edita el repo del servidor)
1. **Los eventos de combate no llegan a ningún jugador.** `combate.*`, `ejercito.llega` y otros salen con `asentamientoId: ''` (cadena vacía); `eventosVisiblesParaJugador`
   (`session/proyecciones/jugador.ts`) y `canalDeEvento` (`session/canales.ts`) solo tratan `undefined` como «global», así que `GET .../eventos` los descarta para todos y el canal `mapa/general` no los
   lleva. Reproducido: `combate.campamento_destruido` (v386) y `combate.ataque_campamento_fallido` aparecen en el log de admin y no en `GET /eventos` de ninguna cuenta. El doc 02 §4.1b dice que sí
   viajan. Arreglo propuesto: tratar `''` como `undefined` en esos dos sitios (o no emitir `''` desde el contexto del evento). El cliente ya filtra por `heroesIds`, así que no hace falta más.
2. **Caso del usuario (0/0/0 tras volver a casa)** — reproducido contra el servidor; no es una emboscada ni un bug de bajas: (a) `entrarEnCampamento` en un campamento donde NO resides deja la columna
   aparcada y las escuadras con `contenedor: ejercito`, y la pantalla las enseñaba como «sin tropa» (corregido aquí); (b) `residirEnCampamento` no exige estar allí y el tick **borra** (`sinPrestamosAjenos`)
   la tropa prestada por el campamento anterior, sin evento ni aviso: 3 escuadras de 14 pasan a 0 en un tick. Si el usuario pulsó «Residir aquí» (o se mudó por conquista/ruina), es eso. El backend
   podría emitir un evento al retirarla. (c) Si su cliente no mantenía el WebSocket y otro sí, un cierre desconecta al héroe y a los 2:30 sale del mundo con la columna (`contenedor: fuera`).
3. **El tope del almacén personal y la capacidad del carro no viajan** en la proyección ni en `/v1/balance` (`ALMACEN_PERSONAL.capacidad`, `capacidadCargaDe`): el panel Carro muestra existencias y deja
   que el backend rechace («el almacén personal está lleno»).
4. **Los campamentos de bandidos no tienen trazado publicado** (solo plazas y campamentos de mercenarios): el plano de la ficha es esquemático. Propuesta: un `layoutBandidos(id, nivel)` en el motor.
5. `/v1/balance` no publica `MERCENARIOS.prestamo.unidades` (15): el cliente lo repite en el texto de la pestaña Tropa.

### Pendiente
- Sin verificar en vivo la vista de asentamiento con la barra nueva (no hay plaza en la partida de prueba): comprobada solo por tipos y por el campamento y el mapa, que comparten estructura.
- «Fuiste atacado» y el briefing solo funcionan con el arreglo 1 del backend; mientras tanto avisan las bajas vistas en la proyección (sin saber quién).
- Los solicitantes de ingreso que no son de tu Facción salen por id: `nombresDeDirigentes` solo trae Rey y Embajador.

## [0.13.0] — 2026-10-07 · batallas con héroes y ejércitos en campo · sync con `BronzeAgeFase0@101c035` (rama `claude/elegant-shirley-2ce6d7`, sin push)

### Añadido
- **Batallas en el mapa** (backend Doc 5.15.1b, doc 02 §4.1): las batallas de Unity a la vista salen como un círculo con espadas cruzadas (verde la tuya).
  Al pulsarla se abre su ficha en el panel de Selección (`src/ui/panelBatalla.ts`): qué es (asedio, batalla campal, persecución, asalto a una caravana o
  evento contra bandidos), los bandos con su Facción y sus héroes sobre la capacidad, y **Unirse**. En una **persecución** el bando se elige («Con quien
  persigue» / «Con el perseguido»), porque es libre; en las demás lo deduce el backend; una batalla campal no admite a nadie de fuera. El botón avisa
  de la distancia (a 15) y la herida; el rechazo del backend sale en la propia ficha. Comando `unirseABatalla` con `lado` opcional.
- **Formar un ejército en campo** (backend Doc 5.14.4): «Mi columna» en «Mis cosas» ofrece *Organizar ejército* (unión abierta o «decido yo») a una columna
  personal que va sola; en una formación, el progreso (n/3 y los minutos que quedan) y *Cancelar la formación* (Líder) o *Separarme*; y con tres, «haz clic en el
  mapa para fijar el destino», que es el clic de siempre (`marcharA`) y vale una sola vez. Las formaciones se dibujan con un anillo discontinuo y se pulsan para
  **unirse** a ellas (`unirseEnCampo`). Comandos `organizarEjercito`, `cancelarFormacion`, `separarseDelEjercito`.
- **Ajuste del Rey** «Ataques abiertos a otras Facciones» en la pestaña Facción (`src/ui/panelAdmision.ts`): activa que en vuestros asedios y asaltos de caravana se
  unan al ataque héroes de Facciones neutrales o enemigas del defensor. Comando `admitirOtrasFacciones`.
- Tipos: `Faccion.admiteOtrasEnAtaques`, `Ejercito.tipo/liderId/formacion/destinoPendiente`, `EjercitoAvistado.tipo/enFormacion` y `columnas` en el contexto de una batalla.

### Cambiado
- **Solo un ejército abre un asedio**: *Atacar* una plaza queda deshabilitado para una columna personal, con el motivo.
- El panel lateral del mapa ya no aplasta sus bloques cuando hay mucho contenido: se desplaza. Las secciones de Anexión y Fusión de la pestaña Facción salían a altura
  cero cuando había más de una.

### Verificado
- Contra el backend real (`npm run server` con `SERVIDORES_BATALLA`), con tres cuentas: formar un ejército entre tres, fijar su destino siendo Líder, el rechazo de
  un integrante que no lo es; abrir una persecución entre dos Facciones y unirse a ella desde la ficha como un tercero sin Facción; y activar el ajuste del Rey.

### Pendiente
- No hay aviso en pantalla de que una batalla se abre, termina o cambia: el cliente no usa todavía el canal `batalla/<id>` (WebSocket); la ficha se actualiza con el sondeo.
- Tampoco hay menú para atacar o perseguir a otra columna, ni la ficha de una columna ajena: solo se atacan plazas y campamentos.

## [0.12.0] — 2026-10-06 · fusión con aceptación · sync con `BronzeAgeFase0@6aced64` (rama `claude/keen-chandrasekhar-c37099`, sin push)

### Añadido
- **Fusión entre Facciones** (backend Doc 2.6 opción 2, modelo en `Docs/Coordinacion/01` §26): sección «Fusión» en la pestaña Facción (`src/ui/panelFusion.ts`).
  El Rey de la Facción que propone elige la otra, el **nombre** de la Facción nueva y quién será su **Rey** (él o el de la otra) y puede retirar la propuesta; solo el
  Rey de la otra **acepta o rechaza**, con la caducidad a la vista. Comandos `proponerFusion`, `responderFusion` y `retirarFusion`; `fusionar` ya no existe.
- Tipo `PropuestaFusion` y el campo opcional `propuestasFusion` de `ProyeccionJugador`.

### Cambiado
- `ui/panelAnexion.ts` exporta `caduca` y `crearEnvio` (envío de comando con el rechazo del backend en el propio panel), que comparten anexión y fusión.

### Pendiente
- Como en la anexión: no hay aviso al Rey cuando le llega una propuesta (los eventos `diplomacia.fusion_*` son públicos y sin plaza). Tras aceptarse, **las dos** Facciones
  desaparecen y nace una con id nuevo (`diplomacia.fusion`, payload `faccionNuevaId`): el cliente se limita a refrescar la proyección.

## [0.11.0] — 2026-10-06 · anexión con aceptación · sync con `BronzeAgeFase0@8a4eae5` (`main`)

### Añadido
- **Anexión entre Facciones** (backend Doc 2.6, modelo en `Docs/Coordinacion/01` §25): sección «Anexión» en la pestaña Facción
  (`src/ui/panelAnexion.ts`). El Rey o el Embajador proponen anexionar a otra Facción (selector) y pueden retirar la propuesta; solo el Rey
  de la absorbida **acepta o rechaza** las que recibe, con la caducidad a la vista. Quien valida es el backend: su rechazo (`anexion.invalida`,
  `anexion.caducada`…) sale en el propio panel. Comandos `proponerAnexion`, `responderAnexion` y `retirarAnexion`; `anexionar` ya no existe.
- Tipo `PropuestaAnexion` y el campo opcional `propuestasAnexion` de `ProyeccionJugador`.

### Pendiente
- Aviso al Rey cuando le llega una propuesta: los eventos `diplomacia.anexion_*` son públicos (sin plaza) y no dicen a quién tocan; hoy solo se ve
  abriendo la pestaña Facción. Tras aceptarse una anexión la Facción absorbida desaparece: el cliente se limita a refrescar la proyección.
- El desarme del señor (sus vasallos quedan libres) no necesita cliente: llega por `relaciones`.

## [0.10.1] — 2026-10-05 · planta del campamento, avisos y cupo de la proyección · sync con `BronzeAgeFase0@cbe7ffa` (rama `claude/gracious-sinoussi-5b2ee7`)

### Añadido
- **Planta del campamento** en su pantalla (backend D73, `escenaCampamento`): calles, empalizada con su puerta y los edificios con la taberna
  en el centro, con leyenda. `src/ui/planoCampamento.ts`. La planta solo viaja estando dentro del campamento.
- **Avisos de «alguien te ha mirado»** (`src/ui/avisos.ts`): el cliente pide `GET .../eventos?desde=<version>` tras cada proyección y muestra
  un aviso global con el mensaje de `asentamiento.informe_pedido` (el plano de tu plaza, sin decir quién) y de las inspecciones
  (`asentamiento.observado`, `columna.observada`, `caravana.observada`). El primer refresco solo fija el cursor: no avisa de lo viejo.

### Cambiado
- El **cupo de Miradas** de una taberna ya no se deduce en el cliente: viaja en `tarifasIntel.cupoMiradas` (por nivel de la de plaza y fijo en
  campamento). `docs/COMANDOS.md` apunta los dos comandos de intel.

## [0.10.0] — 2026-10-05 · taberna e intel · sync con `BronzeAgeFase0@c6dda58` (rama `claude/gracious-sinoussi-5b2ee7`, sin fusionar a `main`)

### Añadido
- **Panel Intel** (backend Doc 5.12.10, modelo en `Docs/Coordinacion/01` §24, comandos en `02` §4.2c): la taberna vende **Miradas** (un ojo de
  150 de radio durante 2 h sobre cualquier punto, en vivo y sin interiores) e **Informes de plaza** (foto con fecha del layout y la defensa
  de una plaza ajena que conoces). Está en tres sitios: el riel del mapa (🔭), la barra de la plaza (**Intel**) y la pantalla Campamento.
  `src/ui/panelIntel.ts`.
  - Se compra en la taberna de una plaza propia (estando dentro; Rey, Embajador o Gobernador) o en la de un campamento de mercenarios
    (dentro, o con la columna a la puerta; cualquier héroe con Facción, con su oro de botín). El selector ofrece las que tengas a mano.
  - **Cotiza antes de comprar** con `tarifasIntel` (la misma cuenta que el backend: base más un tanto por la distancia a tus ojos propios
    más cercanos para la Mirada; por nivel de la plaza para el Informe). Quien valida es el backend: su rechazo (`intel.invalida`) sale tal cual.
  - **Punto de la Mirada**: «Elegir punto en el mapa» (un clic lo fija, sin mandar marchar a la columna), una lista de plazas conocidas y
    campamentos, o coordenadas a mano. La previsualización sale discontinua sobre el mapa.
  - **Mapa**: las Miradas abiertas se pintan como círculo con su cuenta atrás y, tras caducar, un anillo tenue mientras la zona sigue vedada
    (`pintarMiradas`, `render.ts`). Lo que dejan ver llega por las listas de avistados de siempre, así que no hay otra capa.
  - **Informes**: lista con su antigüedad y detalle con mini plano del layout, edificios por tipo, guarnición, héroes y murallas. Es una foto:
    no se actualiza.
- La **Taberna** en el catálogo de edificios (nombre, color) y en el selector «Añadir a la cola» del Gobernador.
- Tipos `MiradaIntel`, `InformePlaza`, `EdificioInforme`, `TarifasIntel`, `OrigenDeIntel` y los campos `miradasIntel`, `informesPlaza` y
  `tarifasIntel` de `ProyeccionJugador`.

### Pendiente
- **Aviso al espiado**: el backend emite `asentamiento.informe_pedido` a la Facción espiada, sin decir quién. Este cliente no consume el canal
  de eventos todavía, así que no se ve.
- El cupo de Miradas de una taberna de plaza se lee del `nivelInterno` (1/2/3, `cupoMiradas` del backend): si cambia el catálogo, hay que
  ajustarlo en `tabernasDisponibles`.
- Verificado a mano contra un servidor local (comprar Mirada e Informe desde el campamento y desde la plaza, elegir punto con clic); falta
  probarlo con dos jugadores reales y con la Mirada de un aliado.

## [0.9.0] — 2026-10-05 · sigilo de Facción · sync con la rama `claude/gracious-sinoussi-5b2ee7` de `BronzeAgeFase0` (sin fusionar a `main`)

### Añadido
- **Sigilo de Facción** (backend Doc 2.8.1): al crear la Facción se elige forma del escudo, fondo (18), dos colores, emblema (56)
  y su color, y orla opcional con su color, con vista previa (`crearFaccion` manda `sigilo`; se elige una vez y no se cambia
  nunca). El halo del emblema cambia a claro u oscuro según su color. La ficha de la Facción lo dibuja.
- `src/sigilo/`: copia del catálogo (`catalogoSigilos.json`, recopiar del backend cuando crezca), el dibujo SVG del
  escudo (`svgSigilo`) y los 56 emblemas de época (micénicos, minoicos, hititas, mesopotámicos, fenicios, egipcios y helénicos)
  con iconos de **game-icons.net** (CC BY 3.0; `emblemas.json`, autores en `src/sigilo/CREDITOS.md` y citados bajo el
  selector), con halo oscuro y relleno crema para leerse sobre cualquier campo. `galeria-sigilos.html` (solo en `npm run dev`) los muestra todos a 96 y a 24 px:
  es la herramienta del paso 0 del backend (probar el catálogo a tamaño de mapa).
- Tipos `Sigilo` y `Faccion.sigilo`.

- **Imperios y títulos** (backend Doc 2.8.1), todo derivado de la proyección (`relaciones` y `titulos`), sin dato nuevo:
  la **corona dorada del Gran Rey** sobre su estandarte, la **Liga** de tu Facción en su ficha (sigilo de la señora si es
  por vasallaje, fila con los de sus miembros si es una alianza) y la lista de **títulos del servidor** con su insignia por
  `tituloId` (castillo, oro, cuartel, corona y lira) y quién los tiene. `src/sigilo/imperio.ts`, `insignias.json`.

### Cambiado
- El territorio y los marcadores de cada Facción en el mapa usan el **color principal de su sigilo** (antes, un color de una
  paleta fija por orden).

### Pendiente
- La crónica de los Aedas no tiene pantalla en este cliente, así que sus insignias de título no se ven ahí.
- Probar el catálogo a ~24 px sobre el mapa (`galeria-sigilos.html`). Faltan iconos de escudo en ocho, Puerta de los Leones,
  águila bicéfala, toro alado, árbol sagrado, casco de colmillos y sol de Vergina: no hay en game-icons.net y hay que
  encargarlos (por eso no están en el catálogo).

## [0.8.0] — 2026-10-04 · campamentos de mercenarios · sync con `BronzeAgeFase0@cb7f343` (`main`)

### Añadido
- **Nacer en un campamento** (Doc 1.3, 1.9b): la pantalla Héroe lista los campamentos de `sinHeroe.campamentos`
  (con cuántos lo eligieron y cuántos residen) y `crearHeroe` manda `campamentoId`.
- **Pantalla Campamento**, cuando `heroe.ubicacion.tipo === 'mercenarios'`: salir al mundo eligiendo tropa y carga
  (`salirDelCampamento`), almacén personal y oro de botín, tropa prestada gratis (`pedirPrestamo`,
  `reponerPrestamo`), mercado (`comprarEnCampamento`), residir (`residirEnCampamento`), crear Facción o pedir ingreso
  y, para una Facción sin asentamiento, el fondo de refundación (`aportarARefundacion`, `retirarDeRefundacion`,
  `comprarCaravanaDeRefundacion`).
- **Mapa**: campamentos de mercenarios (tienda parda) con ficha y «Entrar» (`entrarEnCampamento`), y alijos (punto
  dorado) con «Abrir» (`abrirAlijo`). El panel de Facción del riel ya crea y pide ingreso.
- **Rey**: la ficha de su Facción lista las solicitudes y las acepta o deniega (`responderSolicitud`).
- Tipos `CampamentoMercenarios`, `CampamentoParaElegir`, `Alijo`; `heroe.almacenPersonal`, `heroe.oroDeBotin`,
  `Escuadron.prestada`, contenedor `fuera`, `Faccion.solicitudesIds`, `Caravana.titularId`/`origenCampamentoId`,
  `Ejercito.caravanasAdjuntasIds`.

### Cambiado
- **Fundar** (panel ⌂): solo con la Caravana de Fundación de la que eres titular, enganchada a tu columna
  (`adjuntarCaravana`), y con `fundar` donde estás. `fundarAsentamiento` ya no existe.
- `unirseAFaccion` → `solicitarIngreso`: decide el Rey. Ya no hay pantalla Facción obligatoria: sin Facción se juega
  desde el campamento o el mapa.

### Pendiente
- Los rechazos del campamento llegan solo con el código (`mercenarios.invalido`): el backend no manda el motivo.

## [0.7.1] — 2026-10-02 · red de caminos · sync con `BronzeAgeFase0` `main` (red de caminos, aún sin commit)

### Cambiado
- **Caminos** (Doc 1.6): `proyeccion.caminos` son ahora tramos fusionados de la red de caminos,
  `CaminoProyectado { id, escalon, puntos }` (sustituye a `CaminoComercial`). Se pintan con grosor por escalón:
  sendero, camino, calzada. Contra un servidor anterior, sin `escalon`, se pintan como antes.

## [0.7.0] — 2026-09-26 · subida de nivel y asedio · sync con `BronzeAgeFase0@8091638` (rama `ritmo-crecimiento`)

### Añadido
- **Subida de nivel** (Doc 4.5): la pestaña Resumen enseña la evaluación del servidor (`ascensoDeAsentamiento`:
  coste, obra, déficit de mantenimiento y bloqueos) y el Gobernador la pide con «Subir a nivel N»
  (`solicitarAscenso`). Con una obra en curso (`Asentamiento.ascenso`), su cuenta atrás.
- **Asediar una plaza** (Doc 5.12.4): la ficha de una plaza de otra Facción ofrece «Atacar» (`atacar` con
  `objetivo: asentamiento`), apagado si estás herido o a más de 15. El aviso dice si cae, aguanta o empieza una
  batalla, mirando la proyección.
- **Mejoras con duración**: `Edificio.mejora`; la pestaña Edificios no ofrece mejorar lo que ya se mejora y la Cola
  lista las mejoras en curso. Las cuentas atrás salen en horas.
- Tipos `EvaluacionAscenso`, `BatallaVisible` (`proyeccion.batallas`, sin interfaz) y `Recinto.siguienteCeldaEn`.

### Cambiado
- Los botones del panel de Selección pasan a la línea siguiente si no caben.

### Backend que lo habilita
- El nivel ya no sube solo; `atacar` asedia plazas (llegar solo acampa); +`unirseABatalla`, +`cancelarBatalla`
  (opt-in `SERVIDORES_BATALLA`): 77 comandos, 76 de jugador.

### Documentación
- `COMANDOS.md` (23 de 76), `API_CONTRACT.md`, `Analisis_Brecha_Backend.md`, `Features_Pendientes.md` §1.4 y §1.5,
  README.

## [0.6.0] — 2026-09-15 · Herido y bandidos con columna · sync con `BronzeAgeFase0@3602f71` (rama `heroe-dominio`)

### Añadido
- **Atacar campamentos de bandidos** (Doc 1.9): clic en un campamento abre su ficha en el panel de Selección
  (poder, distancia a tu columna) y marcha hacia él; «Atacar» manda `atacar` con `objetivo: campamento`. Se apaga
  si estás herido o a más de 15 (`RADIO_ATAQUE`, copia de `LOGISTICA.radioEncuentro`), y al terminar avisa de si
  cayó o aguantó.
- **Herido** (Doc 5.16.4): `heridoHasta` en `HeroeProyectado` y `HeroePublico`. La Ficha del panel Héroe enseña los
  minutos que quedan, y el loadout de un herido deja de marcarse como que defiende.
- `CampamentoBandido.poder`.

### Backend que lo habilita
- La Tregua de columna se sustituye por el Herido del héroe; sale `atacarCampamentoBandidos` (desde una plaza):
  74 comandos, 73 de jugador. Al caer una plaza, quien estaba dentro queda fuera en una columna (el router ya
  lleva a Mapa).

### Documentación
- `COMANDOS.md` (22 de 73, `atacar` cableado para campamentos), `API_CONTRACT.md`, `Analisis_Brecha_Backend.md`,
  `Features_Pendientes.md` §0.2 y §1.4, README.

## [0.5.0] — 2026-09-14 · panel del héroe · sync con `BronzeAgeFase0@52498a2` (rama `heroe-dominio`)

### Añadido
- **Panel Héroe** (`src/ui/panelHeroe.ts`), en el riel del Mapa (🛡) y en la barra del Asentamiento, con tres
  pestañas:
  - **Ficha**: clase, dónde está, nivel, experiencia, Liderazgo, monedas y atributos; con puntos sin gastar,
    reparte (`repartirPuntos`).
  - **Escuadras**: cada una con hombres, nivel, moral, coste de Liderazgo, dónde está y si defiende; guarnición
    ocupada frente al cupo, y `asignarGuarnicion`/`retirarGuarnicion` (el botón se apaga si no cabe).
  - **Loadouts**: lista con su Liderazgo; activar, editar, borrar y crear (`guardarLoadout`, `borrarLoadout`),
    con la suma de Liderazgo en vivo y Guardar apagado si no cabe o no tiene nombre.
- El sondeo de 3 s no repinta el panel si nada cambió, ni mientras hay un loadout a medio editar.
- `aplicarYRefrescar` en `src/main.ts`: lo mismo que `ejecutarYRefrescar` para una petición ya lanzada.

### Documentación
- `COMANDOS.md`: los cinco comandos del héroe cableados (21 de 74). `Features_Pendientes.md` §0.2 queda en lo
  que falta (equipo, perks, héroes ajenos). README, `API_CONTRACT.md`, `Analisis_Brecha_Backend.md`.

## [0.4.0] — 2026-09-14 · escuadras en el héroe · sync con `BronzeAgeFase0@6d43688` (rama `heroe-dominio`)

Fases 2 y 3 del modelo de Héroe en el backend: las escuadras viven en el héroe, y tu héroe viaja completo en la
proyección. Sigue necesitando el backend de esa rama.

### Cambiado
- `Ejercito.escuadrones` → `escuadronIds` (solo ids), y `participantes` pasa a obligatorio: los rombos de una
  columna y "tu columna" se leen solo de `participantes`. Fuera `EscuadronEnCampana` y `Asentamiento.escuadrones`
  (la guarnición son ahora escuadras del héroe marcadas `enGuarnicion`).
- Las iniciales del menú de esquina y la cabecera del panel de Facción usan el nombre del héroe, no el nick. El
  selector de cargos enseña el nombre de cada compañero de Facción (`nombreDeHeroe`).

### Añadido
- `ProyeccionJugador.heroe` (`HeroeProyectado`, con `costeLiderazgo` en cada escuadra y `guarnicionOcupada`),
  `heroesVisibles` (`HeroePublico`), `nombresDeCompaneros` y `EjercitoAvistado.heroeIds`, y los tipos `Escuadron`,
  `Loadout`, `ItemInstancia`, `AtributoHeroe` y `SlotEquipo`.
- Wrappers tipados de `repartirPuntos`, `guardarLoadout`, `borrarLoadout`, `asignarGuarnicion` y
  `retirarGuarnicion` en `apiCliente.ts`, sin pantalla todavía.

### Backend que lo habilita
- Catálogo 70 → 75 (74 de jugador). Guarnición con cupo por residente; una plaza la defienden su guarnición y el
  loadout activo de los residentes que están dentro.

### Documentación
- `docs/Features_Pendientes.md` §0.2: la pantalla del héroe (ficha, atributos, escuadras, loadouts, guarnición,
  equipo y héroes ajenos).
- `docs/COMANDOS.md`, `docs/API_CONTRACT.md`, `docs/Analisis_Brecha_Backend.md`, `docs/Panel_Asentamiento.md` y
  README.

## [0.3.0] — 2026-09-14 · héroe · sync con `BronzeAgeFase0@6281527` (rama `heroe-dominio`)

El backend pasa a jugar con un **Héroe** (fase 1 del modelo: doc 01 §12 y doc 02 §4 de `Docs/Coordinacion/`).
**Necesita el backend de esa rama**: contra `main`, la proyección todavía trae `jugadorId`.

### Cambiado
- `jugadorId` → `heroeId` en `ProyeccionJugador`, en los tipos locales (dueño de escuadrón, `participantes` de
  columna, `jugadoresFundadoresIds` → `heroesFundadoresIds`) y en los `params` que se mandan (`marcharA`,
  `entrarEnAsentamiento`, `salirAlMundo`, `asignarCargoLocal`). Cargos, Rey y columna propia se comparan contra
  `proyeccion.heroeId`.
- `ejecutarAccionMuralla` → `ejecutarYRefrescar`: la usan la muralla y el héroe.

### Añadido
- La respuesta `sinHeroe` de la proyección (`PartidaSinHeroe` en `apiCliente.ts`, `estadoCliente.sinHeroe`) y la
  pantalla **Héroe** en el router, que con `sinHeroe` es la única. `crearHeroe(params: ParamsCrearHeroe)` manda
  el comando y refresca.
- Pantalla **provisional**: solo el nombre; clase `Spear`, género y avatar van fijos (`HEROE_PROVISIONAL`). La
  definitiva está descrita en `docs/Features_Pendientes.md` §0.

### Backend que lo habilita
- `crearHeroe`: el héroe aparece en el mundo con su columna. Sin héroe, la proyección es
  `{ gameId, instante, version, mapaId, sinHeroe: true }` y cualquier comando salvo `crearHeroe` es `403`.
- Catálogo 69 → 70: entran `crearHeroe` y `crearFaccionNpc` (solo admin: una Facción de jugador ya no se cede a
  la IA) y sale `alternarFaccionNpc`.

### Documentación
- `docs/COMANDOS.md`: params `heroeId`, sección Héroe, y los cableados al día (16 de 69, con los 9 que
  trajeron las pantallas nuevas y no se habían marcado).
- `docs/API_CONTRACT.md`, `docs/Analisis_Brecha_Backend.md`, `docs/Panel_Asentamiento.md` y
  `docs/Features_Pendientes.md` §0.

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
