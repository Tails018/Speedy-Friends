# Continuación V7 — estado verificado

Rama `dev/v7-completion` (worktree `Speedy-Friends-V7`), creada desde `codex/ultimate-security-and-completion` (`0d9b14d`). La carpeta original (`release/pages-visual`), sus cambios sin commit y el stash «Speedy Friends - trabajo pendiente Codex V6» no se han tocado. El contenido del stash se copió como primer commit (`09d6518`) sin aplicarlo ni borrarlo.

## Skills usadas

`frontend-ui-engineering` (addyosmani, MIT): estados de carga, vacío, error y permiso; formularios accesibles. `ui-ux-pro-max` (nextlevelbuilder, MIT): pautas de foco, movimiento y contraste. Se descartó su paleta morada porque contradice el brief azul y oro. `performance-optimization`, `security-and-hardening` y `code-simplification` (MIT) se instalaron y orientaron la deduplicación y la caché. `frontend-design` y `web-design-guidelines` ya estaban instaladas. Las skills oficiales de Firebase solo cubren Firestore y no se usaron.

## Hecho en esta ronda

- Admin › Actividad real (Rings y Cafetería, últimos 60), sin las filas inventadas, también en `admin-role.html`.
- Admin › Identidad conectada a `siteSettings`, con validación, solo lectura sin permiso y reflejo en la portada.
- Portada › «En movimiento»: edits de video reales de Fanarts, o la opción de publicar uno.
- Cafetería: la cartera de staff ya no tapa la carta; saldo en vivo con una sola suscripción.
- Firebase: lecturas compartidas, Rings en paralelo, presencia que ya no bloquea, caché pública de Ranking. Ver `FIREBASE-V7.md`.
- Capa visual V7 (`sf-v7.css`, `sf-v7.js`) en las 14 páginas: podio, FLIP, foco y diálogos.
- Herramientas: `scripts/v7-audit.cjs` y `scripts/v7-firebase-metrics.cjs`.

## Pruebas al cierre

- `npm test`: 19/19. `npm run test:browser`: 25/25.
- `npm run test:e2e`: 24/24 en Chromium de escritorio y 24/24 en Chromium móvil emulado (390×844, táctil).
- WebKit: 23/24. Falla «Profile ignores unowned legacy image cache», que ya fallaba en `0d9b14d`: WebKit no admite Blobs en IndexedDB en contextos efímeros. Hubo fallos intermitentes aislados en otras pruebas de Perfil con Blobs.
- `scripts/text-overflow.cjs`: 21 recortes (los mismos 21 decorativos documentados) y 0 scroll horizontal.
- Todo usa Firebase simulado. No se ejecutó el Emulator Suite ni se probaron Firefox ni dispositivos físicos.

## Pendiente (no se presenta como terminado)

- Economía segura: crear pedidos y cobrar con Cloud Functions (`createCafeOrder` y `serveCafeOrder` solo funcionan en el emulador) y el canje del carrito con Rings. Requiere el plan Blaze y una migración de reglas autorizada.
- Reglas: amistades sin consentimiento, lectura de campos privados de `users`, tokens históricos de Cloudinary. Ver `REGLAS-CANDIDATAS-V65.md`.
- Rediseño profundo por página (Perfil, Amigos, Fanarts, Novedades, OST). La capa V7 unifica la identidad, pero no rehace cada página.
- Medición con Firebase real, Emulator Suite y dispositivos físicos.
- Versión pública: `release/pages-v7-visual-safe` en la copia Pages-Safe, pendiente de push y PR.
