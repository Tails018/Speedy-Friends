# Continuación V5.5: integración local y límites

## Cobro con emuladores

`server/index.cjs` expone `serveCafeOrder` como callable v2, lee el UID de `request.auth`, acepta exclusivamente `orderId` y delega en la transacción de `server/settle-order.cjs`. Comprueba explícitamente trabajador activo o creadora de prueba, precio de carta, saldo y estado; la transacción registra un solo cobro por pedido. La función solo se ejecuta si `FUNCTIONS_EMULATOR=true`, el proyecto es `demo-speedy-integration` y el host de Database Emulator es `127.0.0.1:19000`. La creadora configurada es ficticia. No sustituir estas barreras ni desplegar este archivo como producción sin diseño y revisión.

`tests/firebase-emulator/database.integration.rules.json` deriva del candidato y deniega escrituras directas del navegador en rings, ringHistory, orders y los historiales de cafetería. Es exclusivamente para la prueba de integración: **rompería operaciones actuales** de creación, estados y administración. No se aplica a producción. Los emuladores Auth, Functions y Database se ejecutaron juntos con identidades ficticias y reglas explícitas. Se probaron acceso anónimo y suplantación, escritura directa con token válido, precio no aceptado en el payload, llamadas simultáneas y saldo insuficiente. La lectura autorizada de carta con el mismo token se probó antes de rechazar las escrituras.

`cafe-emulator-client.js` es un adaptador opcional no incluido en las páginas. Solo admite localhost y un Firebase app previamente configurado con el proyecto demo; usa Functions Emulator. `cafeteria-core.js` delega el servicio si se carga y activa ese adaptador; ante error no utiliza el cobro antiguo. El resto de la web aún no configura Auth/Database de prueba ni se ha demostrado el flujo de botones conectado a todos los emuladores. Por defecto la página y el flujo antiguo permanecen iguales; no se debe interpretar el hook como migración terminada.

No se implementaron aún creación segura de pedido, transición de estados, consultas, canjes ni migración de historial. El precio vigente al servir requiere decisión de negocio. La transacción sobre todo el equipo puede ser costosa y entrar en conflicto con escrituras no migradas. Mientras la app y las reglas antiguas estén activas, el sistema real sigue expuesto. Es indispensable adaptar todos los flujos, bloquear rutas antiguas conjuntamente y probar con datos aislados antes de desplegar.

Para repetir en una copia local: Node 22, Java 21, `npm ci --prefix server` y `npm ci --prefix tests/firebase-emulator`; desde `tests/firebase-emulator`, ejecutar `npx firebase emulators:exec --project demo-speedy-integration --config firebase.integration.json --only functions,database,auth "node --test callable.test.cjs"`. La prueba local se realizó con Node 24 porque el emulador usó la versión disponible del host; CI está configurado para Node 22 y aún no se ha ejecutado en GitHub. Firebase indica que desplegar Cloud Functions requiere el plan Blaze: https://firebase.google.com/docs/functions . No se conoce la facturación del proyecto y no se activó ningún plan.

## Cloudinary

`server/cloudinary/delete-fanart.cjs` es un componente sin credenciales ni red que exige autenticación y un vínculo privado proporcionado por adaptadores confiables; el cliente solo proporciona assetId. Sus ocho pruebas usan simulaciones. Los adaptadores para catálogo privado, reserva atómica, autorización, llamada real y reconciliación todavía no existen. El cliente actual continúa usando el mecanismo anterior y puede exponer tokens; no se ha mitigado ese riesgo en producción. El README del módulo describe la transición y no se ha eliminado ningún archivo.

## Dependencias

La auditoría del lock del arnés Firebase identificó 21 paquetes afectados, todos de desarrollo. Una actualización compatible del lock, sin `--force`, redujo a 20 (15 moderados, 5 altos), con instalación limpia y 21 pruebas oficiales aprobadas. Los avisos directos restantes corresponden a grpc-js (GHSA-m9gg-hp2v-232j y GHSA-f596-whhp-79r4), OpenTelemetry (GHSA-8988-4f7v-96qf), glob (GHSA-3g3m-2fjr-6pw4), minimatch (GHSA-g3hv-75wg-m249) y uuid (GHSA-w5hq-g745-h8pq); otros avisos son propagaciones. `npm audit --omit=dev` para ese arnés y el paquete raíz reportaron cero. No cubre SDK cargados por CDN ni afirma ausencia global de problemas.

El lock nuevo de `server` reportó inicialmente 6 moderados transitivos en gaxios, gcp-metadata, glob, google-gax, minimatch y rimraf. `npm audit fix --package-lock-only` sin force resolvió el reporte a cero; una instalación limpia y la integración con emuladores se volvieron a ejecutar. No se desplegó el paquete.

## Seguridad y continuidad

El prototipo social aún no está integrado y las reglas sociales originales siguen vulnerables. Permanecen pendientes protección de medios y firma Cloudinary, privacidad de users, optimización de Base64, diseño, canjes, reglas completas y pruebas de regresión de todos los módulos. No se modificaron reglas activas, recursos de Cloudinary ni datos reales. La rama sigue local; no se creó PR ni se habilitó producción. Antes de una migración real se deben respaldar y verificar reglas desplegadas, definir recuperación y reversión de datos y operaciones, proteger las rutas antiguas, ensayar en un proyecto separado y obtener autorización explícita.
