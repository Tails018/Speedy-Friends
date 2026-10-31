# Prototipo aislado: consentimientos de amistad

**No conectado, no listo para producción.** `pair-transaction.mjs` es un modelo experimental de transición para una sola pareja en `socialV2/pairs/<pairKey>`. Una única transacción representa la relación de ambos integrantes y conserva identificadores de operación para reintentos. Solo la persona destinataria puede aceptar o rechazar; solo el remitente puede cancelar. El modelo no modifica las rutas actuales ni la aplicación.

En un servicio real, actorUid debe obtenerse exclusivamente de un ID token Firebase verificado y nunca del cuerpo de la petición. El servidor debe calcular la referencia de pareja y ejecutar la transacción usando el Admin SDK. La política `deny.rules.json` de este directorio es solo una prueba aislada: impide escrituras y lecturas directas del cliente a esa ruta, no es una propuesta completa para producción.

Faltan endpoint autenticado, protección ante abuso y límites de tamaño, consultas privadas por usuario, representación compatible con la UI, migración idempotente de relaciones existentes, control de inconsistencias históricas, observabilidad y estrategia de retención del registro de operaciones. `applySocialOperation` devuelve el estado actual, no la respuesta histórica de una operación repetida: el endpoint no debe interpretar un reintento ya procesado como una nueva aceptación. No se debe activar hasta resolver y probar todo lo anterior.

El valor inicial de una transacción puede llegar como null por falta de caché. Para que una operación posterior a send no se aborte antes de que el servidor contraste el valor real, el adaptador devuelve null si el estado inicial es null y la operación no procede; un commit con snapshot null se trata como rechazo. Se probó esta ruta en el emulador, además de peticiones simultáneas.

Desde `tests/firebase-emulator`, con dependencias instaladas y Java configurado:

```
node --test social/pair-transaction.test.mjs
npx firebase emulators:exec --project demo-speedy-social --config social/firebase.social.json --only database "node --test social/pair-emulator.test.mjs"
```

El 31 de octubre de 2026 pasaron 4 pruebas unitarias y 2 del emulador oficial de Realtime Database (puerto local 19011), usando reglas de prueba aisladas, sin datos ni servicios de producción. El ensayo del emulador usa una conexión con reglas deshabilitadas como sustituto de la autoridad del backend para las transacciones y verifica aparte que un cliente autenticado no puede escribir directamente; no valida el endpoint, pues aún no existe.

Referencia: https://firebase.google.com/docs/database/admin/save-data#section-transaction
