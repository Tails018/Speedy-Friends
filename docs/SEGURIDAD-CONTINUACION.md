# Seguridad y continuación — 31 de octubre de 2026

Base: `upgrade/visual-system` en `74c8ac6`. Las reglas locales son referencias diversas, no se ha comprobado su equivalencia con producción. No desplegar ninguna regla ni ejecutar migraciones hasta comparar una exportación de las reglas activas de Realtime Database y Storage y verificar compatibilidad.

## Hallazgos prioritarios en copias locales

- `firebase-rules.json`: la autorización de escritura de perfiles acepta `newData.ownerUid == auth.uid`, lo que puede permitir cambiar el propietario de un perfil existente. Revisar igualmente las variantes antes de consolidar.
- `firebase-rules-novedades-merged.json` y `firebase-legacy.js`: el rol procede de datos de perfil que podrían ser modificables por su dueño; no utilizar roles editables por clientes como fuente de autorización.
- `firebase-rules-cafeteria-final.json`: los permisos de trabajador y pedidos requieren pruebas negativas y restricciones de transición y propiedad. No se ha demostrado que estas reglas estén desplegadas.
- `cafeteria-core.js`: el precio se recibe del cliente y el cobro y archivo son operaciones separadas; un fallo o peticiones concurrentes pueden producir cargos inconsistentes. El cambio de LISTO solo corrige su archivado prematuro, no protege la economía.
- `fanarts-system.js`: se guarda un token de borrado Cloudinary con datos de la obra. Revisar exposición, vigencia y configuración de Cloudinary; no se ha comprobado la configuración externa.
- No se han encontrado reglas Storage ni configuración `firebase.json` en esta rama. Firebase CLI y Java no están disponibles en PATH en este entorno.

## Siguiente paso

1. Obtener una copia de las reglas efectivamente publicadas de Realtime Database y Storage, sin credenciales; inventariar sus rutas junto con las variantes locales y los clientes.
2. Configurar emuladores oficiales aislados con reglas explícitas y probar permisos positivos y negativos antes de proponer una migración. Nunca interpretar los mocks de navegador como pruebas de autorización.
3. Diseñar un servicio confiable para servir y canjear: precios autoritativos, validación de roles y disponibilidad, operación idempotente y saldo/historial consistentes bajo concurrencia. Definir migración y reversión antes de habilitarlo.
4. Continuar con los demás módulos y revisión visual por página; probar con usuarios de prueba y dispositivos o emuladores identificados.

No se han aplicado cambios a producción. El flujo de cobro actual no debe considerarse seguro por la corrección de LISTO.

## Continuación V5.1 — pruebas de navegador

- Node 24.22.1 y npm 11.19.1 disponibles. El arranque de Edge falló en este entorno (`browserType.launch: Target page, context or browser has been closed`; error de Crashpad y de perfil temporal); no se cambió la seguridad de Windows.
- Se descargó Chromium de Playwright 145 en una carpeta temporal del espacio de trabajo y arrancó correctamente. Las pruebas de navegador usan este ejecutable y un servidor local en el puerto 4189.
- Se agregó `.github/workflows/browser-tests.yml` como alternativa reproducible en Linux. Los flujos E2E emplean Firebase simulado, no comprueban reglas ni servicios reales.
- E2E ahora devuelve error si cualquiera de los navegadores solicitados no arranca, o si no se ejecuta ninguno. Sus informes se escriben en `test-results/` para no sobrescribir evidencias previas.
- La rama no existe en origin y todavía no se ha publicado. Antes de publicar, revisar el diff completo y los archivos nuevos en busca de información sensible.

## Reglas experimentales y emulador

En `tests/firebase-emulator/` hay un candidato parcial derivado exclusivamente de `firebase-rules.json` y nueve escenarios propuestos de perfiles y permisos. No es una consolidación y no se ha comparado con producción: conserva otras autorizaciones de la referencia y puede impedir operaciones legítimas. No desplegarlo.

La CLI, bibliotecas y JRE portátil se intentaron configurar sin modificar el sistema; `npm ci` falló con `EPERM` al crear `node_modules/@google-cloud/pubsub`, tanto en el proyecto como en el espacio de trabajo. El emulador y sus pruebas **no se ejecutaron**. La instalación de solo lock reportó 21 vulnerabilidades (16 moderadas y 5 altas), sin evaluación individual. Se añadió un job de GitHub Actions para ejecutar la suite en Linux; aún no se ha ejecutado allí. La seguridad y la compatibilidad quedan sin validar.

Resultados locales adicionales: 9 pruebas Node, 21 de navegador y 8 flujos E2E en Chromium de escritorio más 8 en móvil emulado. Las pruebas E2E usan Firebase simulado.
