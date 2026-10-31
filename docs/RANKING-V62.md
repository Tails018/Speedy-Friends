# Ranking V6.2: verificación y límites

La prueba `tests/ranking-visual.cjs` usa Chromium y `tests/firebase-mock.js` en memoria. Verifica ocho cantidades, sus etiquetas e iconos, el botón de música, el orden después de un cambio de Rings y la limpieza al cerrar sesión en cuatro tamaños. Genera capturas y `test-results/ranking-v62/mock-metrics.json`; ese directorio está ignorado por Git. Ejecutar con el servidor local y `SF_BASE_URL` si se usa otro puerto.

La medición registra el momento en que Playwright observa las ocho filas, no el primer píxel ni la latencia de Firebase real. En una ejecución local se observaron entre 183 y 435 ms; no se registró una línea base comparable y estas cifras no demuestran una mejora de velocidad de red. El mock registró nueve suscripciones iniciales, incluyendo duplicados de `users`, `rings` y `friends` entre Ranking y Amigos. Son eventos de registro, no mediciones de tráfico real.

Ranking conserva nodos de tarjetas sin cambios, reordena los existentes y escucha Rings también en el modo general. Cierra sus suscripciones y vacía datos al cambiar o cerrar la sesión. No se ha añadido caché persistente: las reglas activas de producción no se han verificado y no existe una señal comprobada de revocación que permita garantizar que una copia local sigue autorizada. Una caché debe asociarse al proyecto, equipo y UID, limitar datos y caducidad, borrarse ante cambios de cuenta y permisos, y comprobarse frente al emulador oficial y las reglas desplegadas antes de habilitarla.

Quedan pendientes la eliminación segura de suscripciones duplicadas, mediciones antes/después con la misma configuración, el tiempo de red real y el render individual, la verificación de reglas en el emulador oficial y dispositivos físicos. Los datos de prueba son ficticios y no se ha desplegado ninguna regla.

## Continuación V6.3

Ranking y Amigos comparten durante una sesión las suscripciones idénticas de `users`, `rings` y `friends/<uid>`. La memoria se descarta al cambiar de UID; Firebase sigue autorizando las lecturas y notificando errores. Al recibir `users`, Amigos reconstruye el índice local sin solicitar otra vez ambos nodos completos. En el mock, el registro inicial observado pasó de nueve a seis suscripciones y las lecturas `once` iniciales de diez a ocho en esta configuración. No es una medición de bytes ni de producción; siguen existiendo lecturas iniciales completas.

La copia persistente sigue desactivada: una sesión autenticada no prueba por sí sola que una lectura de `users` y `rings` esté permitida. Un resultado de lectura de esos nodos sí prueba acceso en ese momento, pero ya contiene los datos actuales; sin una señal confiable específica de autorización anterior no permite mostrar la copia privada más temprano de forma segura. Falta comprobar las reglas efectivamente desplegadas y diseñar esa señal antes de habilitar una caché persistente.
