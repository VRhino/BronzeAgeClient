# Mundo 3D

El modo mundo (la vista pegada al héroe) pasa de Canvas 2D a 3D con three.js. Es el prototipo del cliente final, que sigue siendo Unity. Las
escalas y la cámara se decidieron con la mesa de escalas 3D del motor (`Consideraciones/Escalas_Mundo_3D_Definicion.md` y su artefacto en
`Consideraciones/artefactos/mesa_escalas_3d/`); este documento dice cómo se lleva al cliente.

## Decisiones del autor (2026-10-30)

- **Cambio directo.** Sin interruptor 2D/3D: el 3D se hace en una rama y entra cuando pinta todo lo que pinta el 2D.
- **El modo mapa se queda en 2D**, como mapa estratégico (el mundo entero, zoom libre y arrastre). La vista de la plaza tampoco cambia.
- **Solo sobremesa** en el prototipo.
- **No cambian** el contrato, la proyección (`proyeccionAlInstante`), los paneles, ni el clic: lo que hay bajo él lo sigue eligiendo
  `objetoBajoElClic` en coordenadas del mundo y la orden sigue siendo `marcharA`. En 3D el clic toca el relieve con un rayo.
- **La altura se dibuja tal cual**, la del paquete de relieve. La exageración vive en el generador; así las pendientes que se ven son las que
  usa el servidor para decidir por dónde se anda.
- **La niebla sigue siendo una regla.** Cada capa conserva su lado de la niebla, como en `render.ts`: lo que hoy va debajo (suelo, bosque,
  ríos, caminos, fronteras ajenas, plazas recordadas) se oscurece en el sombreado con los tres estados (sin ver, recordado, visible); lo
  propio y lo que se ve ahora va encima. La rejilla es la de `proyeccion.exploracion` (celdas de 5 u, 534 × 400).

## Valores

| | Valor |
|---|---|
| Copa de árbol | 0,3 u |
| Plazas (maquetas) | ×1: la ciudad es la del juego, al 10 % del radio de su zona |
| Héroes y tropa | ×2 (soldado de 3,3 m de Unity, 1 u = 12 m) |
| Apertura de la cámara | 35° |
| Inclinación | libre, de 10° a 90°; arranca a 30° |
| En pantalla, héroe solo (visión 15 u) | normal 15 u, alejada 22 u |
| En pantalla, con soldados (visión 30 u) | normal 30 u, alejada 45 u |

«En pantalla» es el diámetro del círculo alrededor del héroe que cabe en la pantalla, con cualquier inclinación (desde arriba, el lado corto).
La visión es la del servidor (`VISION` de `Movimiento_Ejercitos`). **Cambio respecto al 2D:** el modo mundo de hoy fija el zoom con la visión
del héroe solo (`radioDeVision`); el 3D tiene que seguir a la de la columna. El encuadre de la caravana grande (visión 60 u) está abierto.

## Piezas

| Pieza | Módulo | Datos |
|---|---|---|
| Altura y agua | `src/mundo/relieve.ts` (hecho) | Paquete de relieve: `InfoMundo.url_relieve`, una vez por mundo |
| Escena, luz, cielo según el tema | `src/mundo3d/escena.ts` | — |
| Cámara de juego | `src/mundo3d/camara.ts` | Visión de la columna y los valores de arriba |
| Terreno por teselas de 64 u alrededor del héroe | `src/mundo3d/terreno.ts` | Relieve; color por clase, roca en laderas, agua |
| Niebla en el sombreado | `src/mundo3d/niebla.ts` | `proyeccion.exploracion` |
| Árboles instanciados por trozos | `src/mundo3d/arboles.ts` | Densidad de bosque del artefacto (4 u) |
| Ríos y vados | `src/mundo3d/rios.ts` | Ríos del artefacto |
| Plazas, pueblos, avanzadas, campamentos | `src/mundo3d/maquetas.ts` | Proyección |
| Héroe, tropa, columnas ajenas, caravanas | `src/mundo3d/columnas.ts` | Proyección: ruta y posición en el instante |
| Ruta, destino, caminos, fronteras, zonas | `src/mundo3d/lineas.ts` | Proyección |
| Etiquetas y clic | `src/mundo3d/etiquetas.ts`, `src/mundo3d/entrada.ts` | El clic acaba en `objetoBajoElClic` y `marcharA` |

## Fases

1. **Datos (hecho, 0.61.0).** Contrato regenerado con el relieve; descarga del paquete, caché en IndexedDB por su hash y teselas que se
   abren a demanda (`Relieve.alturaEn`, `aguaEn`). No cambia nada de lo que se ve.
2. **Se juega en 3D:** escena, cámara, terreno, niebla, tu columna, clic para marchar, ruta y destino.
3. **El mundo:** árboles, ríos y vados, maquetas de plazas, pueblos, avanzadas y campamentos; zonas, fronteras y caminos.
4. **Lo ajeno y lo que falta:** columnas avistadas, caravanas, bandidos, mercenarios, alijos, batallas y formaciones; etiquetas y selección; la
   vista previa de fundación y la elección del sitio de una aldea.
5. **Cierre:** se retira el pintor 2D del modo mundo (`render.ts` sigue para el modo mapa), una pasada de rendimiento y la documentación.

## El paquete de relieve

`PaqueteRelieve` (contrato 06 §8 del motor): la altura cada 0,5 u de todo el mapa (5.335 × 4.001 muestras), con el mismo valor que el raster
`altura` del artefacto (65535 = 1.000 m), y un bit de agua por muestra. Va en 42 × 32 teselas de 64 u, cada una con 129 × 129 muestras que
comparten la última fila y columna con la vecina; cada altura es su diferencia (módulo 2^16) con la predicción izquierda + arriba − diagonal,
y la tesela va con zstd. La semilla 42 ocupa 8,6 MB.

- **Descarga:** `obtenerRelieve()` en `apiCliente.ts` lo pide una vez por mundo; `cargarRelieve` lo lee de IndexedDB
  (`bronzeage-relieve`) si está su hash y, si no, lo baja, comprueba que es el anunciado (sha256 de su serialización con `hash = ""`) y
  lo guarda. Sin `url_relieve` (un servidor sin el paquete) devuelve `null`.
- **Memoria:** el paquete se queda comprimido; `Relieve` abre cada tesela al pedirla y guarda abiertas las 96 últimas (unos 5 MB).
- **Pruebas:** `pruebas/relieve.test.ts` escribe un paquete pequeño según el contrato y comprueba el real del motor contra la ventana de la
  mesa, muestra a muestra; `pruebas/servidor.test.ts` lo baja de un servidor de verdad.
