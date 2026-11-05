# Firebase V7: lecturas compartidas, caché pública de Ranking y medición

Rama `dev/v7-completion`. **Ninguna regla ni dato de producción se ha modificado.**

## Qué cambió

| Cambio | Archivo | Efecto |
|---|---|---|
| `readShared(key, ref)`: entrega el primer dato del listener compartido de la sesión y lo conserva 15 s; si ya existe, responde con su último dato | `firebase-legacy.js` | Los módulos que arrancan después reciben el dato sin otra descarga |
| `resolve()` usa `readShared('users')` y pide Rings en paralelo con el `profileId` recordado en la pestaña | `firebase-legacy.js` | Una descarga de `users` menos por página; Rings ya no espera a `users` cuando hay pista |
| La escritura de presencia ya no bloquea `speedy:firebase-ready` | `firebase-legacy.js` | El evento que esperan todos los módulos llega un viaje de red antes |
| Amigos: directorio (`users` + `rings`) en paralelo y relaciones (`friends`, `inbox`, `outbox`) desde los listeners compartidos | `friends-system.js` | Antes se descargaba cada nodo dos veces: `once` y luego `on` |
| Portada · Amigos y Ranking: listeners compartidos, cancelados al cambiar de cuenta y un repintado por fotograma | `home-friends-ranking.js` | Antes abría 3 listeners propios que nunca se cancelaban |
| Admin: `users` y `rings` compartidos; trabajadores con un listener en vez de `once` en cada cambio; Visual Picks sin lectura doble | `admin.html` | |
| Admin › Actividad: `ringHistory` y `cafeteria/activity` limitados a los últimos 60 registros (`orderByKey().limitToLast`, sin índice) | `admin.html`, `admin-role.html` | El historial completo ya no se descarga |
| Cartera de Cafetería: una suscripción en vivo al saldo en vez de releerlo en cada uno de los 5 intentos | `cafeteria.html`, `cafe-worker.html`, `cafe-creator.html` | Además se actualiza sola tras un cobro |
| Caché pública de Ranking (stale-while-revalidate) | `firebase-legacy.js`, `ranking.html` | Al volver a Ranking la lista aparece antes de la red y después se actualiza sin vaciarse |

## Caché pública de Ranking: límites de seguridad

- Solo guarda una **proyección** que cualquier integrante con sesión ya puede leer: nombre, usuario, apodo, título, rol, nivel, Rings y avatar si es una URL `https` corta. **No** guarda correos, descripciones, portadas, imágenes Base64 ni datos de permisos.
- Vive en `sessionStorage` (se borra al cerrar la pestaña), tiene versión (`sfPublicRanking:v1`), caduca a los 10 minutos y está ligada al UID.
- Solo se muestra cuando Firebase Auth ya restauró **esa misma cuenta**. Se borra al cerrar sesión, al cambiar de cuenta y si Firebase deniega la lectura de `users` o `rings`.
- El listener en vivo la reemplaza siempre. `ranking.html` marca `data-ranking-source="cache|live"`.
- Límite conocido: si un permiso se revoca en el servidor, la copia (pública dentro del team) puede verse hasta que llegue la respuesta denegada, que la borra. Los datos privados siguen solo en memoria.

## Medición (Firebase simulado, no producción)

`scripts/v7-firebase-metrics.cjs` usa `tests/firebase-mock.js` con 80 ms de latencia artificial por lectura, por primer evento de un listener y por confirmación de escritura. Escritorio, Edge headless, mediana de 5 ejecuciones. La versión «antes» es el commit `209af90` servido aparte con el mismo simulador y el mismo script. Los tamaños son caracteres JSON entregados por el simulador, **no bytes de red reales**. Resultados completos: `docs/metrics/firebase-v7-antes.json` y `docs/metrics/firebase-v7-despues.json`.

| Página | Listeners | Lecturas `once` | Datos entregados (car. JSON) | `firebase-ready` |
|---|---|---|---|---|
| Ranking | 12 → 8 | 13 → 2 | 8505 → 2215 | 329 → 227 ms |
| Inicio | 16 → 11 | 14 → 3 | 11451 → 3114 | 395 → 305 ms |
| Amigos | 13 → 8 | 13 → 2 | 10552 → 2215 | 304 → 214 ms |
| Perfil | 13 → 8 | 13 → 2 | 10552 → 2215 | 305 → 220 ms |
| Admin | 9 → 9 | 8 → 3 | 4289 → 2414 | 304 → 221 ms |
| Cafetería | 5 → 7 | 6 → 2 | 2139 → 2133 | 307 → 224 ms |
| Fanarts | 14 → 9 | 13 → 2 | 10994 → 2657 | 308 → 228 ms |

| Ranking | Antes | Después |
|---|---|---|
| Primer integrante visible (carga directa) | 220 ms | 143 ms |
| Lista completa (carga directa) | 220 ms | 143 ms |
| Primer integrante al llegar desde Inicio | 196 ms | 102 ms (desde la caché) |
| Latencia de reordenación tras un cambio de Rings | 5 ms | 2 ms |
| Veces que la lista se vació tras cargarse | 0 | 0 |

En Cafetería hay dos listeners más porque el saldo de la cartera pasó de lecturas repetidas a una suscripción en vivo.

## Pendiente

- Medir con Firebase real y dispositivos físicos. Estas cifras no prometen latencia de red.
- `users` sigue siendo un nodo completo: hacen falta proyecciones públicas y privadas en las reglas (ver `docs/REGLAS-CANDIDATAS-V65.md`).
- Índices `.indexOn` y paginación por servidor requieren cambiar reglas publicadas: no se ha hecho.
