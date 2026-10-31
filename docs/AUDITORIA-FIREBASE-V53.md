# Auditoría Firebase V5.3

## Procedencia y comparación

`rules/realtime-owner-reference.json` es una copia idéntica al archivo recibido (SHA-256 `4117ec25bab682915eaffb82156480e9d5caf78ced5e2d395322b73d1b2007c9`). El propietario la facilitó para revisión; no se ha verificado que sea la versión publicada. Ninguno de los diez archivos de reglas locales coincide completamente. Los archivos de amigos y fanarts son fragmentos; otras variantes incluyen permisos, activity y cafetería diferentes. No mezclar reglas mediante sustitución ciega.

La copia cubre siteSettings, users, permissions, rings, ringHistory, ratings, news, visualPicks, cafeteria, friendRequests, friends, presence y fanarts. No contiene una regla de activity a nivel equipo. La lectura de users y rings permite leer colecciones completas a cualquier usuario autenticado; users contiene ownerEmail. Limitar hijos no revoca una lectura concedida en el padre. La privacidad requiere separar datos públicos y privados y adaptar consumidores antes de cerrar ese acceso.

## Cambios candidatos — no desplegar

`tests/firebase-emulator/database.candidate.rules.json` conserva la estructura de la copia e introduce tres cambios: creación de perfiles propios con identidad coherente, rol Runner y saldo inicial cero; edición o borrado solo por el dueño previo, manteniendo identidad, rol y rings en las ediciones; eliminación de users/auth.uid/role como fuente de autorización para news. Mantiene el acceso administrativo mediante permissions y claims que figuraban en la copia. Agrega `.indexOn` de ownerUid en users por la consulta de cafeteria-core. Esta es una propuesta incremental, no una corrección completa ni garantía de compatibilidad. El navegador ahora determina isAdmin con permissions, no con el rol editable del perfil; sigue siendo una comprobación de interfaz, no autorización de servidor.

## Riesgos no resueltos y compatibilidad

- `firebase-legacy.js` y `profile.html` intentan vincular perfiles antiguos sin ownerUid mediante correo. La regla candidata impide esa vinculación automática; requiere migración verificada en entorno confiable. También puede afectar cuentas sin email o con datos antiguos incompletos. Usuarios con role=admin solo en perfil perderán la interfaz administrativa; asignar previamente permissions mediante autoridad confiable.
- La copia permite que el cliente cree pedidos con estado o precio arbitrario, y que el trabajador modifique o borre pedidos e historiales. La regla de trabajador no exige active=true. No existe backend atómico o idempotente para cobrar: el cliente usa escrituras separadas. En la copia, rings permite escritura a creadora/admin, pero no al trabajador que intenta cobrar: puede fallar. El cliente escribe activity al crear pedido pero esa ruta solo admite staff, de modo que el pedido puede guardarse y la actividad fallar después.
- friends permite crear relaciones por cualquiera de las partes sin demostrar consentimiento. Endurecerlo exige rediseñar y probar las actualizaciones multirruta de friends-system.js; no se ha resuelto.
- Los tokens de borrado Cloudinary se guardan en fanarts legibles por usuarios autenticados. Migrar la eliminación a un servicio confiable y revisar los tokens ya expuestos; no borrar datos históricos automáticamente.
- La copia no exige email_verified para propietaria en varias rutas y permite a administradores modificar rings e historial. No confiar en datos calculados en el navegador para saldo, precio ni autorización. Los campos e índices deben revisarse con todos los consumidores.
- No se proporcionaron reglas de Storage. No hay conclusiones sobre sus permisos ni pruebas de Storage.

## Pruebas y migración

El emulador oficial de Realtime Database con proyecto ficticio ejecutó 17 pruebas: cuatro reproducen en la copia original la apropiación, la escalada, el pedido falsificado y la amistad sin solicitud; trece verifican perfiles, permisos, noticias y lecturas administrativas en el candidato. No se han probado todos los flujos, los ataques de pedidos/amistades/cobros, Storage ni compatibilidad real. Por tanto la base no se declara segura. La prueba de npm necesitó una carpeta temporal, instalación shallow, Java portátil y XDG_CONFIG_HOME escribible; no se cambió la configuración global. No se han desplegado reglas.

Antes de proponer despliegue: exportar reglas activas de RTDB y Storage y comprobar proyecto/fecha; respaldar reglas y datos pertinentes sin borrar información; inventariar perfiles sin propietario y administradores sin permissions; desarrollar un backend confiable de pedidos y Rings con precios autoritativos, operaciones transaccionales idempotentes e historial, y migrar el frontend; rediseñar consentimiento de amistad y separar datos privados; ampliar tests de ataques, concurrencia, borrados y flujos legítimos; ensayar con datos representativos en proyecto aislado; comparar reglas y aprobar ventana de migración. No utilizar el candidato tal como está.

Para reversión, conservar la exportación exacta previa y su versión, comprobar la compatibilidad de los datos modificados, detener o deshabilitar nuevas operaciones económicas de manera controlada y restaurar las reglas anteriores por el procedimiento autorizado, verificando operaciones y auditoría. Si hay cambios de estructura o transacciones, planificar recuperación específica; volver a reglas previas no revierte datos ni cargos.
