# Realtime Database: candidato experimental V6.5

**No desplegar.** El archivo principal de trabajo es [`tests/firebase-emulator/database.experimental.rules.json`](../tests/firebase-emulator/database.experimental.rules.json). Es una evolución de `database.candidate.rules.json`, que a su vez deriva de la copia recibida en `rules/realtime-owner-reference.json`. Ninguna se ha contrastado con las reglas activas de producción; los demás archivos `firebase-rules*.json` son referencias o variantes históricas, no reglas definitivas.

## Qué cambia

- El perfil propio conserva `ownerUid`, `ownerEmail`, `role`, `rings` y varias banderas o estructuras habituales de privilegios. Una cuenta nueva no puede introducir esas banderas. No es una lista exhaustiva de todos los campos que futuras versiones podrían considerar privilegiados.
- En Fanarts se rechazan tokens de borrado y likes precargados en una creación, se validan título, descripción, categoría, tipo de medio y tamaño de URL, y un vídeo debe pertenecer a Edits. Las publicaciones con un token histórico pueden conservarlo sin modificarlo durante una edición: no se han borrado datos ni dejado de ser legibles por esta regla.
- La configuración `firebase.experimental.json` apunta solo al candidato y `demo-speedy-experimental`; el workflow ejecuta `npm run test:experimental`. El candidato no se usa por el frontend ni por una configuración de despliegue.

## Límites y bloqueos de migración

Las pruebas `experimental-risks.test.mjs` **pasan cuando reproducen fallos**: un usuario puede crear un ticket servido y manipular su precio; una amistad puede crearse sin consentimiento; un trabajador inactivo puede modificar la carta; y un usuario autenticado puede leer borradores. Se mantienen deliberadamente visibles para evitar interpretar una suite verde como seguridad integral. Las rutas antiguas no se han cerrado: el frontend todavía depende de ellas y no existen alternativas seguras completas para creación y transición de pedidos, amistades, canjes y gestión económica.

La lectura de `users` sigue exponiendo campos privados a usuarios autenticados. La lectura de Fanarts puede exponer tokens históricos. Faltan proyecciones públicas y privadas, migración de perfiles heredados, validación de campos y límites de imágenes con datos reales, revisión de `email_verified`, política de moderación y pruebas de todos los permisos. Las validaciones nuevas pueden impedir operaciones sobre datos históricos incompatibles; deben ensayarse con una copia saneada y autorización apropiada. Ninguna revisión de cliente sustituye las reglas de servidor.

`server/index.cjs` y el adaptador de cafetería están restringidos al emulador; el núcleo transaccional y el componente de eliminación Cloudinary son prototipos, no un backend listo para desplegar. El flujo de producción existente no queda protegido por subir estos archivos a GitHub.

## Pruebas y ejecución

Con Node 22, Java 21 y dependencias instaladas en `tests/firebase-emulator`, ejecutar `npm test` para la referencia/candidato anterior y `npm run test:experimental` para V6.5. Los tests comprueban que la dirección del emulador sea `127.0.0.1:19000`; no utilizan un proyecto real. El emulador oficial probó el candidato experimental y los riesgos documentados. El mock de Playwright no valida reglas ni Cloudinary real. Ver `README.md` del arnés y `docs/CONTINUACION-V55.md` para integración Auth/Functions/Database, límites y comandos.

## Migración y reversión futuras

1. Exportar y conservar con fecha y proyecto las reglas realmente publicadas, el estado de las reglas de Storage y un respaldo apropiado de datos. No asumir que la copia recibida corresponde a producción.
2. Diseñar y probar endpoints autenticados y transacciones para todas las operaciones económicas y sociales; definir precio, consentimiento, idempotencia y recuperación. Preparar adaptadores Cloudinary privados y tratar por separado los tokens ya expuestos.
3. Separar perfiles y noticias públicas de datos privados, migrar registros heredados y adaptar lectores; verificar tamaños de Base64 y compatibilidad de las páginas. Después cerrar conjuntamente las escrituras directas antiguas y probar con reglas reales en emuladores y un proyecto aislado.
4. Revisar riesgos, pruebas y plan operativo con la persona responsable y solicitar autorización explícita antes de cualquier despliegue. Preparar una ventana para detener operaciones económicas y restaurar las reglas exportadas si se requiere reversión. Restaurar reglas no revierte datos, archivos ni cargos; estos necesitan recuperación y conciliación por separado.
