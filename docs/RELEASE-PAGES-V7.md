# Release visual segura V7 para GitHub Pages

Rama `release/pages-v7-visual-safe`, creada desde `main` (`e4255ff`). No contiene la rama experimental.

## Transferido (solo frontend, sin escrituras nuevas ni cambios de reglas)

- `sf-v7.css` y `sf-v7.js`: paleta azul profundo y oro de Rings, foco visible común, podio oro/plata/bronce en Ranking, animación FLIP al reordenar por Rings (solo `transform`) y apertura de diálogos. Sin animaciones con `prefers-reduced-motion`.
- Admin › Actividad (`admin.html`, `admin-role.html`): sustituye tres filas inventadas por el historial real. Solo **lee** `ringHistory` (últimos 60) y, para la creadora, `cafeteria/activity` (últimos 60), dos rutas que las páginas ya consultaban o que las reglas de referencia permiten leer a esos roles. Tiene filtros y estados de carga, vacío, error y permiso.

## No transferido

- Optimizaciones de Firebase: dependen de `subscribeShared` y de la arquitectura de la rama de desarrollo.
- Identidad (`siteSettings`), clips de la portada y la cartera plegada de Cafetería: `main` usa otro código en esas zonas.
- Reglas, Cloud Functions y prototipos de seguridad: nunca se publican desde aquí.

## Verificación (Firebase simulado, no producción)

- Auditoría de las 14 páginas en escritorio y móvil emulado: 0 recursos que falten y 0 scroll horizontal. Los 4 errores de JavaScript observados (`syncRings is not a function`, `Missing } in template expression` en index; dos `null` en cafeteria y cafe-worker) existen igual en `main` sin estos cambios.
- Actividad: muestra movimientos reales de Rings y Cafetería con datos ficticios; Ranking: podio visible.
- No se ha probado con Firebase real ni en dispositivos físicos.
