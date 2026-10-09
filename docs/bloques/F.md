# Bloque F — Vista de la ciudad

## Añadido (texto para el CHANGELOG)
- **Plaza › lienzo de la ciudad:** clic en un edificio abre una ficha flotante (tipo, nivel, estado, producción por minuto, recetas del nivel con sus insumos por unidad) con las acciones que el backend permite de verdad: **Mejorar** (con su coste, requisitos y obra, sacados de `EDIFICIO_CATALOGO`) y **Quitar de la cola** (si está en cola), solo para Gobernador / Maestro de Obras. No hay pausa ni prioridad por edificio en el backend, así que no se ofrecen.
- **Resaltado cruzado:** elegir una fila de Centro urbano › Edificios resalta en el lienzo todos los edificios de ese tipo (el elegido con trazo fuerte; repetir el clic recorre los de un tipo); elegir uno en el lienzo marca su fila.
- **Tooltip:** ahora lleva la producción por minuto del edificio (la proyección la da por tipo: se reparte entre los activos, «≈» si hay varios) y avisa de que el consumo por edificio no lo publica el servidor.
- **Centro urbano › Recetas:** lista las recetas de los talleres activos (una por recurso) con taller, ritmo máximo, insumos por unidad y bloqueo por tecnología; `alternarReceta` para parar/reanudar.
- **Centro urbano › Información:** el glosario de `#/legacy`, ahora dentro de la plaza.
- **Escala del lienzo:** el radio de la vista se deriva del extremo real de edificios y murallas (pasos de 20, mínimo 60, sin tope en 220), así una plaza pequeña no se ve diminuta y una grande no se recorta.

## Comandos cableados
- [x] `alternarReceta` — `asentamientoId`, `recurso`, `pausada` · Centro urbano › Recetas (`ui/vistaCiudad.ts`)
- [x] `mejorarEdificioAhora` — también desde la ficha del edificio (lienzo) · `ui/vistaCiudad.ts`
- [x] `quitarDeCola` — también desde la ficha del edificio en cola · `ui/vistaCiudad.ts`

## Features resueltas
- 12 (interfaz de la ciudad: ficha por edificio, resaltado desde la lista, producción en el tooltip, `alternarReceta`, escala de la vista; el consumo por edificio queda en «Necesita Backend»).
- 14 (glosario «Información» en la plaza).

## Necesita Backend
- **Consumo por edificio:** `produccionDeAsentamiento` solo trae producción (por tipo, no por edificio). La ficha enseña los insumos por unidad de cada receta (catálogo) pero no lo que consume de verdad.
- **Producción por edificio individual:** llega agregada por tipo (`activos`, `cantidadPorMinuto`); se reparte a partes iguales.
- Pausa / prioridad por edificio: no existen comandos (la cola se ordena con `moverEnCola`, ya cableado en Cola).

## Sin verificar en vivo
- Todo con proyección fabricada (plaza inexistente en el servidor): los comandos `mejorarEdificioAhora`, `quitarDeCola` y `alternarReceta` se rechazaron con «Esa plaza no existe.» y el error se mostró bien; no se vio el efecto real (receta parada que desaparece de la producción, mejora en curso).
- El catálogo (`EDIFICIO_CATALOGO.niveles`) sí viene del servidor real (`/v1/balance`).
- Sin captura visual (el panel del navegador no componía fotogramas): resaltado comprobado por píxeles del canvas, el resto por DOM.

## Tocado
`src/ui/vistaCiudad.ts` (nuevo), `src/render.ts` (`radioDeVista`, parámetro de selección), `src/apiCliente.ts` (`nivelesDeEdificio`), `src/tiposDominio.ts` (`Asentamiento.recetasPausadas`), `src/ui/ganchos.ts` (hueco F: dos subpestañas), `src/main.ts` (import, atributo `data-fila-tipo` en las filas, llamada a `cablearVistaCiudad`, tooltip, `pintarAsentamiento` con selección, `repintarFicha` en `renderPanelEdificios`), `src/style.css` (al final).
