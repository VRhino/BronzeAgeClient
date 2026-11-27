# BronzeAgeClient: reglas de trabajo para Claude

## Cómo se trabaja el código

Modo **ponytail** siempre encendido, en nivel full, en la nube y en el PC (decidido por el autor el 2026-11-27): en todo trabajo de código se siguen las reglas de `.claude/skills/ponytail/SKILL.md` aunque no se invoque. El nivel ultra no se usa. Antes de abrir un PR se pasa `/ponytail-review`. Mientras el autor no decida otra cosa, no se ponen comentarios `shortcut:` en el código.

- **Cambios quirúrgicos.** Cada línea cambiada sale de lo pedido. No se retoca código, comentarios ni formato de al lado. Lo muerto ajeno se señala, no se borra; lo que deja huérfano el cambio propio, sí.
- **Criterio de éxito comprobable.** Antes de empezar, cada tarea dice cómo se sabrá que está hecha: «arregla X» pasa a «una prueba que reproduce X, y que pase».
- **El cambio más pequeño no recorta las reglas de la casa.** La subida de versión en `package.json` y el `CHANGELOG.md` forman parte del cambio.
