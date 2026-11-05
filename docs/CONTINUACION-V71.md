# V7.1 — Perfil seguro, errores JS, pulido móvil y publicación

## Qué sirve GitHub Pages (5 nov 2026)

El registro de despliegues de GitHub (`environment: github-pages`) muestra un despliegue de la ref `dev/v7-completion` el 5 nov 2026 a las 03:05 UTC, sin workflow. Los ocho archivos comparados (`index.html`, `profile.html`, `ranking.html`, `cafeteria.html`, `firebase-legacy.js`, `friends-system.js`, `styles.css`, `sf-v7.css`) coinciden byte a byte con `origin/dev/v7-completion` y no con `main` ni con `release/pages-v7-visual-safe`. Es decir, **la configuración de Pages publica `dev/v7-completion`**. Cualquier `push` a esa rama se publica en la web pública. Pages sirve con `Cache-Control: max-age=600`.

Por eso el integrante vio «La sesión cambió»: ese código solo existía en `dev/v7-completion` y en la rama de Codex.

## Perfil

**Causa del error.** `activeProfileUid` tomaba `sf.current.uid` una sola vez, al ejecutarse el script, y nunca se actualizaba. Si Firebase Auth aún no había restaurado la sesión (dependía de si IndexedDB respondía antes o después), quedaba vacío y **todo** guardado fallaba. Las imágenes elegidas antes de terminar Auth se quedaban sin dueño.

**Corrección.**
- Estados `pending`, `authenticated` y `signed-out`.
- El borrador (texto e imágenes) pertenece a una sola cuenta. Lo editado mientras Auth está pendiente se asocia a la primera cuenta que Firebase confirme.
- Un cambio real de cuenta sigue bloqueando el guardado.
- El borrador se guarda por UID: texto en `sessionStorage` e imágenes en IndexedDB. Sobrevive a recargas y a errores de red.
- Botón «Reintentar» y mensajes legibles con tono y contraste.

**Escritura mínima.** Antes se enviaba `{...existing, ...}`, el perfil entero. Con el Emulator Suite se comprobó que, con las reglas de referencia, eso devolvía un saldo de Rings cambiado a la vez por la creadora a su valor antiguo. Ahora:
- Solo se envían los campos editables que cambiaron. El propietario solo se completa si faltaba.
- `profileId` sale de `resolve()`, la lectura compartida, en vez de descargar `/users` entero.
- `SpeedyFirebase.saveProfile` aplica la misma lista blanca.

La release (`main`) no tenía la carrera de sesión, pero sí la escritura completa. Se le llevó la escritura mínima.

## Errores JavaScript corregidos (release basada en `main`)

- `Missing } in template expression` (index): paréntesis desequilibrados en una plantilla. Invalidaba **todo** el script de Fanarts de la portada.
- `syncRings is not a function` (index): se usa `watchUserRings`.
- `Cannot read properties of null (reading 'style')` (cafetería): faltaba el enlace `#cafe-role-admin`.
- `Cannot set properties of null (setting 'onsubmit')` (panel de trabajador): formularios opcionales.
- Cafetería: la cartera de staff empezaba abierta y tapaba controles, y a los integrantes les mostraba un ☕ que abría un panel vacío.

`scripts/v7-page-errors.cjs` recorre las 14 páginas con tres roles (creadora, trabajador, integrante) en móvil y busca `pageerror`, promesas rechazadas sin capturar y errores de consola propios. Resultado: **0** en `dev/v7-completion` y **0** en la release.

## Móvil (390×844, táctil; `scripts/v7-mobile-quality.cjs`)

| Página | Texto <12 px | Táctil <44 px | Solapes de flotantes |
|---|---|---|---|
| Perfil | 65 → 0 | 19 → 0 | 0 → 0 |
| Ranking | 45 → 0 | 10 → 0 | 0 |
| Amigos | 29 → 0 | 3 → 0 | 0 |
| Fanarts | 35 → 0* | 14 → 0 | 0 |
| Novedades | 33 → 0 | 7 → 0 | 0 |
| Admin | 38 → 0 | 20 → 0 | 0 |
| Cafetería | 56 → 0 | 15 → 0 | 1 → 0 |
| Inicio | 31 → 0 | 19 → 0 | 1 → 0 |

\* Fanarts se mide antes de que termine de pintarse la galería: sus 12 textos se ajustan unos cientos de milisegundos después (comprobado a los 2,5 s).

Otros cambios en móvil:
- Campos a 16 px, sin zoom automático.
- Tema y efectos al final de la página en lugar de flotar.
- Barra de guardado fija en Perfil.
- Sin nuevos recortes de texto: siguen los 21 decorativos de siempre, y 0 scroll horizontal.

## Versión y caché

`npm run stamp` escribe `sf-version.js` (v7.1.0 + commit base) y añade `?v=7.1.0` a los recursos locales de las 14 páginas. La versión aparece discretamente al pie (`#sf-build-tag`), en `window.SF_BUILD` y en `html[data-sf-build]`.

## Pruebas

- `npm run test:profile` (Firebase simulado, Auth con retraso): 7/7. Cubre los diez casos pedidos: Auth lento, portada inmediata, cambio real de cuenta, cierre de sesión, error de red y reintento, dos cuentas en el mismo equipo, Rings cambiados durante la edición y recarga en Android.
- `npm run test:profile --prefix tests/firebase-emulator` (Emulator Suite real, dos clientes): 8/8. Las suites anteriores del emulador: 21/21 y 15/15.
- `npm test` 19/19 · `npm run test:browser` 25/25 · `npm run test:e2e` 24/24 en escritorio y en móvil emulado.
- En Windows, Java necesita `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=<ruta sin espacios>` si la ruta temporal tiene espacios.

## Pendiente

- Publicar: la web pública sigue con `dev/v7-completion` tal como se subió el 4 nov. Requiere autorización.
- Prioridad 5 (terminar funcionalidades) y nuevas optimizaciones de Firebase más allá del Perfil no se abordaron en esta ronda.
- Probar en un Android físico y con Firebase real. Todo lo anterior es simulado o emulado.
