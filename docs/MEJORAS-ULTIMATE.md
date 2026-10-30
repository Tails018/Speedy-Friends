# Speedy Friends — mejora visual, de rendimiento y funcional

Rama: `upgrade/ultimate-portal`, creada desde `codex/frontend-audit-20261027` (idéntica al ZIP `Speedy-Friends-PR2.zip`). No se fusiona en `main`.

## Skills usadas

Instaladas y leídas: **frontend-design** (dirección visual, un solo elemento protagonista, calidad mínima de accesibilidad y movimiento reducido), **web-design-guidelines** (foco visible, `prefers-reduced-motion`, imágenes con dimensiones, sin desbordamientos), **webapp-testing** (pruebas con Playwright; se reutiliza `tests/browser.cjs` del proyecto en lugar de crear scripts en Python). **vercel-react-best-practices** no aplica: el proyecto es HTML/CSS/JS sin React. No hay skills instaladas de *shader-programming*, *game-feel* ni *web-performance*; se aplicaron técnicas equivalentes (solo `transform`/`opacity`, `requestAnimationFrame`, `IntersectionObserver` y pausa fuera de pantalla).

## Hallazgos de la auditoría

| Hallazgo | Evidencia | Acción |
| --- | --- | --- |
| `js/app.js` pesa 2.142 KB | Contiene 5 avatares JPEG en base64 (~1,5 MB de imagen). **Ninguna página lo carga**: todas usan `app.js` de la raíz. `tests/static.test.mjs` lo lee para verificar el catálogo | Avatares extraídos a `assets/legacy-ranking/`; el archivo pasa a 122 KB sin cambios de lógica. Se conserva porque es la fuente del catálogo |
| Banner de Fanarts: JPG de 995 KB como fondo CSS | Medición por página | WebP 960w (117 KB) / 1440w (215 KB) según ancho; original conservado |
| Fotos de Cafetería y destacado de Novedades sin `srcset` | 197 KB storefront, 332 KB Frontiers | WebP 480/736w con `srcset`; la especialidad se difiere (`loading="lazy"`) |
| Ranking con CLS 0,12–0,16 | Las secciones vacías de creadores y administradores se ocultan después de cargar y «Miembros» sube 200 px. El «RANK» decorativo usa `top:14%` | Se ocultan con CSS mientras están vacías (igual que el estado final del script), «RANK» en px y se reserva la altura de la lista |
| Fanarts con desbordamiento horizontal en móvil | Con movimiento activo, `.hero-orbit` deja la página en 708 px de ancho a 390 px | `overflow:clip` en `.fanart-hero` |
| Portada entre 900 y 1.300 px | Logo pegado a «NOVEDADES», «INVENTARIO» recortado, texto del hero sobre la ilustración, indicador Firebase sobre el CTA | Corregido en `sf-experience.css` |
| Scroll de la portada | `updateScroll` consultaba el DOM y `matchMedia` en cada frame; el parallax del hero no usaba rAF | Nodos en caché, puntero en `requestAnimationFrame` |
| «Entrar al especial» con `href="#"` | `index.html` sección Especial | Lleva a «Últimos momentos», que es contenido existente |
| SDK de Firebase síncronos en `<head>` | El loader espera a `DOMContentLoaded` | `preconnect` a gstatic y a la base de datos. No se difieren: hay scripts inline que usan `firebase` de inmediato |

## Cambios

- **`sf-experience.css` / `sf-experience.js`** (nuevos, ~16 KB sin comprimir, sin dependencias), incluidos en las 14 páginas activas mediante `scripts/include-experience.cjs`:
  - Transiciones entre páginas con View Transitions entre documentos. En navegadores sin soporte se degrada a navegación normal.
  - Barra de velocidad que avanza con el scroll (una sola escritura por frame).
  - Aparición progresiva solo para secciones **bajo el pliegue** sin sistema propio, así que no afecta al LCP. Nunca deja contenido oculto: se muestra todo en `hashchange`/`beforeprint`, y hay una prueba que lo verifica.
  - Respuesta al pulsar con la propiedad `scale`, que se compone con los `transform` de hover existentes sin sobrescribirlos.
  - Elemento distintivo: 5 anillos dorados que giran en 3D y estelas de velocidad en el hero de la portada, con profundidad según scroll y puntero. Son `aria-hidden`, sin eventos de puntero y en pausa fuera de pantalla o con la pestaña oculta.
  - **Modo de efectos ligeros/completos**: automático con movimiento reducido, ahorro de datos, ≤2 GB de memoria o ≤2 núcleos. Se cambia desde el panel «Accesos» y se guarda en `localStorage` (`sfFx`). El modo ligero quita desenfoques, parallax, anillos y estelas.
- Paleta: se conservan el rojo `#ef263f` y el negro. El azul Sonic `#1f5bff` y el oro de anillo `#f7c548` aparecen solo en la barra y los anillos.
- Imágenes: `scripts/optimize-extra.cjs` genera los derivados y `docs/media-optimization-extra.json` guarda el inventario.
- Medición: `scripts/measure.cjs` (sin conexión; `SF_PAGES` y `SF_VIEWPORT` filtran) y `docs/perf-baseline.json` / `docs/perf-after.json`.

## Métricas (Edge sin conexión, servicios externos bloqueados)

| Página | Vista | KB antes | KB después | Δ | CLS antes → después |
|---|---|---:|---:|---:|---|
| fanarts.html | Móvil | 1264 | 402 | −68% | 0 → 0 |
| fanarts.html | Escritorio | 1264 | 500 | −60% | 0 → 0 |
| cafeteria.html | Móvil | 744 | 456 | −39% | 0 → 0 |
| cafeteria.html | Escritorio | 744 | 647 | −13% | 0 → 0 |
| novedades.html | Ambas | 680 | 468 | −31% | 0 → 0 |
| ranking.html | Móvil | 314 | 331 | +5% | **0,157 → 0,028** |
| ranking.html | Escritorio | 314 | 331 | +5% | **0,123 → 0,007** |
| index, friends, profile, ost, admin | Ambas | — | +16 KB | +2–8% | sin cambio |

`js/app.js` en el repositorio: 2.142 KB → 122 KB. TBT ≈ 0 en todas las páginas antes y después. No es Lighthouse ni una medición con red real: la sesión de Firebase y los SDK externos están bloqueados en la medición.

## Pruebas

- `npm test`: 8/8.
- `npm run test:browser`: 15/15. Incluye 2 nuevas: el interruptor de efectos persiste y el de tema se conserva; decoraciones decorativas; cero contenido oculto tras recorrer 5 páginas; sin desbordamiento horizontal; barra presente; CLS de ranking < 0,1.
- Revisión visual en el panel del navegador a 375, 800 y 1280 px.

## Pendiente o no verificado

- **CLS intermitente de la portada en escritorio (0,256)**: ya estaba en la línea base. Aparece en algunas mediciones y no en otras (0 de 10 ejecuciones aisladas). `scripts/measure.cjs` ahora guarda los nodos responsables en `shifts` para identificarlo.
- Login con Google, restauración de sesión, escrituras, subidas y permisos reales **no se probaron**: requieren una cuenta de pruebas y no se iniciaron sesiones reales.
- Safari/Firefox y dispositivos físicos Android no se probaron; solo emulación en Edge/Chromium.
- Los botones X/Discord/Facebook siguen sin URL oficial (`portal-ui.js` muestra un aviso).

## Riesgos que requieren intervención humana (Firebase)

No se modificó ninguna regla de producción. Recomendaciones, con plan de migración:

1. **`email_verified`**: todas las reglas administrativas comparan `auth.token.email == '…'` sin `auth.token.email_verified == true`. Con solo Google Sign-In el riesgo es bajo, pero si se habilita otro proveedor alguien podría presentar ese correo sin verificarlo. *Migración*: añadir `&& auth.token.email_verified == true` en el Simulador de reglas, probar con la cuenta del propietario y una de pruebas, y después publicar.
2. **Propietario por correo en lugar de por rol**: sería mejor un nodo `/admins/$uid` escrito solo desde la consola (o *custom claims* con Admin SDK) y reglas `root.child('admins').child(auth.uid).exists()`. Hay que mantener la regla por correo durante la transición.
3. **`ownerEmail` controlado por el cliente**: la regla de `rings` protege al propietario comprobando `users/$profileId/ownerEmail`, pero ese campo lo escribe el propio usuario. Un miembro podría poner ese correo en su perfil para que los administradores no puedan modificar sus Rings. *Mitigación*: validar `ownerEmail == auth.token.email` en `users/$profileId`.
4. **8 archivos de reglas parciales** (`firebase-rules*.json`, `*-rules-addon.json`): no se sabe cuál está desplegado. Hay que exportar las reglas activas desde la consola y versionarlas como único archivo de referencia.
5. Las comprobaciones por correo en `index.html`, `ranking.html`, `novedades-admin.html` y `js/config.js` son **solo de interfaz**. La autorización efectiva depende de las reglas anteriores.
