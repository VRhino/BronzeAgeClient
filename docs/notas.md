# Features pendientes

Cómo se quiere que sea la interfaz: intención de producto y de UX, escrita a mano.

Es el complemento de [`Analisis_Brecha_Backend.md`](Analisis_Brecha_Backend.md), que mide la otra mitad —qué
hay ya construido en el backend esperando interfaz—. Casi todo lo de aquí abajo tiene detrás uno o varios de
los 53 comandos que ese documento lista como pendientes: la pestaña de reclutamiento necesita
`reclutarTropa`, la de ejército los 9 de campaña (más los 6 de presencia del jugador que hacen falta para
sacarlo de su residencia antes de nada), la cola de construcción `moverEnCola`/`quitarDeCola`, el
reservado del tesorero `calibrarReservaManual`, las cards de política `activarPolitica`, y la pestaña de
comercio `crearCaravana`/`proponerTrueque`/`aceptarTrueque`/`colocarOrdenMercado`/`comerciarEnPlaza` (un
trueque ya no se pacta solo con proponerlo: hace falta que el otro lado acepte, y una orden de mercado se
cumple en persona en la plaza — `Comercio_Fisico_Definicion.md` del backend). Nada de esto está bloqueado por
el servidor.

//de aqui apara abajo es historico, solamente de referencia.

# panel interactivo
## Pestaña asentamiento
+ reserva protegido (pestaña que permite reservar materiales usando un slider solo si el asentamiento tiene un tesorero asignado) -> a nivel de almacen colapsable
### Pestaña edificios[MEJORAR]:
    + cola de construccion -> opciones de construccion manual y el apagar auto construir
    + mejorar edificios disponibles(es mejor desde la vista asentamiento, al hacer clic sobre el edificio sale una ventana de mejorar edificio con su coste).
    + lista de edificios activa completa con su estado
### Pestaña Produccion[MEJORAR]
    + tabla de produccion por tick(cuando cambie a tiempo, por tiempo) |edificio|Activos|Recurso|produccion|
    + tabla de consumo |edificio|activos|recurso|consumo/total| (consumo es cuanto esta consumiendo de lo producido total, total es el total de que puede consumir al estar al 100%)
### Pestaña ejercito[AGERGAR]:
    + Pestaña Reclutamiento -> permite reclutar en base a lo que hay en tu asentamiento base, y muestra el siguiente nivel de tropas a desbloquear y que es lo que se necesita para ello
    + Pestaña Ejercito -> permite ver tu y gestionar tu ejercito actual.
### Pestaña Politica
+ esta pestaña solo esta disponible si el jugador tiene un cargo sobre el asentamiento, aqui se le muestra su cargo y uan vista con las politicas que tiene activa el asentamiento en forma de card y debajo las cards de las politicas que puede agregar
## Pestaña Comercio
+ de esta pestaña esto es solo disponible para gobernadores y tesoreros:
    en esta pestaña estan la opciones comerciales de los asentamientos, trueques, manejo de caravanas, creacion de caravana, rutas activas y asignacion de caravanas a ruta, apertura de ordenes de compra y venta.
+ esto es lo publico:
    las ordenes de compra y venta abiertas
# Panel Mapa
## vista asentamiento.
+ tooltip con infomacion generica al pasar el cursor sobre un edificio
+ al hacer click sobre un edificio sale un cuadro con la info del edificio mas acciones sobre el 
## vista mundo
+ el panel de mundo tiene que ser mas interactivo, al hacer click sobre un elemento:
    + **ASENTAMIENTO**: te muestre la informacion sobre el mismo y las acciones que puedes hace sobre el(visitar, atacar, comerciar...)
    + **CAMPAMENTO DE REBELDES**: te muestre las acciones que puede hacer sobre el(atacar, ...)
    + **RUTA**: muestra info sobre ella, quienes la usan y te muestra las opciones que puedes hacer sobre ella(interceptar,...) 
    + **EJERCITO**: muestra la info sobre el ejercito y te da las acciones que puedes hacer sobre el (aliado -> unirse, enemigo -> perseguir)

# Cambio general
+ hay que cambiar para q el mapa ocupe toda la pantalla y sea el fondo y los paneles interactivos que lo afectan floten a los lados sobre el, ademas se puede hacedr zoom in y zoom out sobre el mapa hasta cierto punto, lo que implica q se puede navegar sobre el con cliks y drags
+ la funcion entrar a asentamiento cambia el mapa de mundo por el mapa de la ciudad a la que entraste a la derecha y el resto de paneles interactivos del asentamiento a la izquierda como esta ahora
+ hay q implementar el movimiento libre en el mapa general 