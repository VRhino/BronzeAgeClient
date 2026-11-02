# Pantallas de carga

Petición de Víctor (2026-11-02): al pasar de la vista del mundo a las de dentro (plaza, campamento, pueblo) y al revés, y al entrar en la partida,
sale una pantalla de carga con una imagen y un consejo del juego. **Es todo del cliente**: el motor no guarda ni sirve nada de esto.

## Cómo se ve

- La **imagen** del consejo, a pantalla completa, con un acercamiento lento (sin él si el sistema pide menos movimiento).
- El **consejo**, centrado en el cuarto inferior de la pantalla, sobre un fondo opaco en el centro que se aclara hacia las orillas. Encima, «Consejo».
- La **barra de carga**, abajo del todo, con lo que se está haciendo encima («Entrando en Pesinunte», «Saliendo al mundo», «Entrando en el
  campamento», «Cargando la partida»).
- Dura lo que tarde la vista nueva en pintarse (el mundo en 3D baja el relieve y arma el terreno), y **como poco 2,2 s**, para que dé tiempo a
  leer el consejo. Como mucho 15 s, por si una vista no avisa. La barra avanza sola hacia el 90 % mientras espera y se llena al terminar.
- No repite el mismo consejo dos veces seguidas, tampoco al recargar la página.

Código: `src/ui/pantallaCarga.ts`. La abre y la cierra el router de pantallas (`enrutar` en `src/main.ts`) al cambiar entre `mapa`,
`asentamiento`, `campamento` y `pueblo`, y al entrar desde la lista de partidas o la espera de «cargando». Estilos: `.pantalla-carga` en
`src/style.css`.

## El archivo de consejos

Los consejos y sus imágenes están en **`public/carga/`**:

- `public/carga/consejos.json`: el catálogo.
- `public/carga/img/`: las imágenes (JPEG de 1600 × 900).

El cliente lee `consejos.json` en tiempo de ejecución (`<base>/carga/consejos.json`, sin caché), así que **se cambia sin recompilar**. Si no
llega o no vale, la pantalla sale igual, con la barra y sin consejo.

```jsonc
{
  "version": 1,
  "imagenes": {
    // id de la imagen → su archivo, relativo a carga/ (o una URL completa), y una descripción para lectores de pantalla
    "plaza-muralla": { "archivo": "img/plaza-muralla.jpg", "descripcion": "La muralla de piedra de cerca" }
  },
  "consejos": [
    {
      "id": "muralla-puertas",              // único
      "texto": "Cada puerta es una abertura en la muralla…",
      "imagen": "plaza-muralla",            // un id de `imagenes`; sin él, fondo liso
      "vistas": ["asentamiento", "mundo"],  // dónde sale: mundo | asentamiento | campamento | pueblo; vacío o sin él, en todas
      "activo": true                        // false lo aparta sin borrarlo
    }
  ]
}
```

Las vistas son **adónde se entra**: `mundo` al salir de una plaza, un campamento o un pueblo (y al entrar en la partida en el mundo),
`asentamiento` al entrar en una plaza, `campamento` en un campamento de mercenarios y `pueblo` en un pueblo o una aldea. Al entrar en la partida
sale cualquiera.

## Las imágenes de ahora

Doce, cada una elegida para su consejo. Seis son de la **mesa de escalas 3D** del motor (`Consideraciones/artefactos/mesa_escalas_3d/`, a
pantalla completa, sin mandos, rótulos, rejilla ni niebla): `mesa-ciudad`, `mesa-columna`, `mesa-llano`, `mesa-plazas`, `mesa-campamento` y
`mesa-cala`. Otras seis son de la **vista 3D de la plaza** con ciudades reales del motor (`pruebas/ciudad3d/`): `plaza-ciudad`,
`plaza-muralla`, `plaza-centro`, `plaza-pueblo`, `plaza-campamento` y `plaza-aldea`.

## Editarlos desde el cliente de administración

El cliente de administración tendrá una página «Consejos de carga», como la de misiones, para añadir, cambiar, apartar y borrar consejos,
elegir en qué vistas sale cada uno, y subir o cambiar sus imágenes. Lee y escribe este mismo archivo y la carpeta `img/`. Cómo llega a la
carpeta del cliente lo decide el admin; el contrato es solo la forma de arriba.
