# `src/contrato/`: la sesión del contrato 05

Capa de transporte del cliente con el motor en Rust (fase 7). Sustituye, poco a poco, a `src/apiCliente.ts` (el REST `/jugador/*` del backend
TypeScript viejo). No sabe nada de la interfaz.

| Fichero | Qué |
|---|---|
| `gen/` | Tipos generados con `buf generate` desde `proto/` del motor. **No se editan**: `npm run contrato` los regenera. |
| `REVISION` | El commit del motor con el que se generó `gen/` (una versión del contrato es un commit de `main` del motor). |
| `acceso.ts` | `POST /v1/registro`, `POST /v1/sesiones` (token) y la descarga del artefacto de mundo (`GET /v1/mundo/<hash>`). |
| `sesion.ts` | El WebSocket: `Hola`/`Bienvenida`, zstd, secuencia sin huecos, `ordenar()` con respuesta causal, `pedirCronica()`, `cambiarVista()`, reloj sincronizado (`ahoraMundo()`) y reconexión con reanudación por versión. |
| `almacen.ts` | Lo que el cliente guarda por ámbito (`HEROE:heroe-3`, `VISTA:f-1`...). Puerto de `crates/contrato/src/almacen.rs`. |
| `plaza.ts`, `niebla.ts` | El cambio parcial de la plaza (máscara de campos) y la niebla parcial (tramos de bytes). |

## Regenerar el contrato

```sh
npm run contrato                 # desde el checkout hermano del motor (../BronzeAgeFase0 o ../BronzeAge)
MOTOR=/ruta/al/motor npm run contrato
MOTOR_REV=c7f4e60 npm run contrato   # desde GitHub a esa revisión (credenciales de git de la máquina)
```

Antes de cada tanda: `git pull` del motor y `npm run contrato`, y anotar en `CHANGELOG.md` la revisión nueva.

## Pruebas

`npm test` corre los dorados del motor (`contratos/golden/`, si encuentra el checkout) y las del almacén. Contra un servidor de verdad:

```sh
# en el motor: CODIGO_REGISTRO_BOTS=dev-bots cargo run --release -p servicio
BRONZEAGE_URL=http://127.0.0.1:7878 npm test
```

## Tipo de cliente

El contrato aún no tiene un `TipoCliente` para el cliente web de jugador: la sesión abre como `CLIENTE_UNITY` (lo que el servidor deja abrir a
una cuenta humana). Cuando el motor añada uno propio, se cambia el valor por defecto en `sesion.ts`.
