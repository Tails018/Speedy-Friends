# Auditoría y mejoras de Speedy Friends

Base: `main`, commit `e4255ff83ea278534f8312ea873bd990f6ca111d`. Rama de revisión: `codex/frontend-audit-20261027`. Se trabaja en el repositorio existente mediante un worktree; no se crea otra aplicación. Los originales, las copias históricas y la configuración de datos se conservan.

## Alcance y evidencia

Se inventariaron los 329 archivos de la base: catorce páginas activas y una copia histórica de ranking, scripts raíz, `js/`, siete archivos de `vendor/`, reglas JSON y los directorios de recursos. El análisis convencional incluye compilación sintáctica de scripts clásicos y scripts inline, referencias locales, firmas/dimensiones de imágenes, revisión de eventos y navegación con Chromium. `audit-baseline.json` conserva los resultados anteriores; `audit-current.json` describe el resultado corregido.

No se autenticó una cuenta real ni se escribieron datos en Firebase/Cloudinary. En las pruebas se bloquean los servicios externos. El saldo se verifica con una fixture de lectura; el carrito usa almacenamiento local de prueba. Las comprobaciones de interfaz no acreditan los permisos reales del backend.

## Hallazgos y correcciones

| Ubicación en main | Hallazgo comprobado | Resultado |
| --- | --- | --- |
| `index.html:3` y `index.html:6` | Cierre huérfano y script antes de `<html>`; busca un loader que aún no existe y retorna | Orden del documento corregido después de probar el loader activo. Se conserva su HTML y aspecto |
| `index.html:302` y `index.html:314` | Existe un segundo loader activo | `page-loader.js` compartido; DOM antes de inicialización, salida sin esperar imágenes, ARIA y recuperación con `pageshow` |
| `index.html:1260` | Expresión de plantilla inválida en carrusel de fanarts | Error de sintaxis reproducido en navegador y reparado |
| `index.html:482–506` | Botones de accesos cerrados con `</a>` | Cuatro cierres corregidos; permanecen los cinco controles e IDs |
| `app.js:155` | `JSON.parse` sin protección interrumpe arranque con estado corrupto | Lectura y escritura tolerantes a almacenamiento inválido/no disponible |
| `app.js:449` | Selector CSS construido con una ruta HTML | Solo se buscan anclas por ID; rutas continúan como navegación |
| `styles.css` | Treinta secuencias literales `\n` en un parche invalidan reglas | Normalizadas como saltos reales; recursos y selectores conservados |
| `vendor/*.css` | 134 referencias a rutas de imágenes inexistentes | URLs reparadas usando los archivos locales; cero referencias CSS ausentes |
| `fanarts-system.js:188` | Se enlaza cierre solo al primer backdrop, no al botón | Ambos cierran; devuelve foco al control de origen |
| `fanarts-system.js:35` | Galería limitada a doce resultados sin continuación | Botón de carga progresiva; filtros/búsqueda reinician el límite y tienen estado accesible |
| `cafe-worker.html` | Handler de música apunta a un formulario retirado deliberadamente | Registro condicionado, sin ampliar roles; arranque por eventos en lugar de sondeo indefinido |
| `global-ost-player.js:61` | Se asigna posición antes de `load()`, que la reinicia | Se restaura tras metadatos; volumen válido y menos escrituras durante progreso |
| Accesos Tienda / Inventario de portada | Dirigen a secciones Especial / Amigos que no corresponden a sus nombres | Abren el catálogo y la colección local existentes, conservando IDs y datos guardados |

Las líneas de main son referencias de diagnóstico, no posiciones posteriores al cambio. Se mantienen perfiles, ranking, amistades, presencia, publicación/likes de fanarts, administración, cafetería y OST en sus módulos originales. No se cambian Firebase Rules, claves del cliente, rutas de colecciones, saldos ni roles.

## Estado funcional por área

| Área | Implementación/revisión | Límite pendiente |
| --- | --- | --- |
| Portada y loader | Arranque, catorce rutas, controles de carrusel, foco y reducción de movimiento probados | Dependencias externas reales fuera del escenario offline |
| Rings | Panel de consulta, actualización por suscripción y liberación de listener | Lectura real con sesión autorizada; no hay operaciones de saldo desde el panel |
| Cuenta | Mantiene Google Sign-In y acceso obligatorio; informa fallo de carga | Login real y recuperación de sesión con cuenta de pruebas |
| Apariencia | Cambio y persistencia verificados | Revisión visual adicional de todas las combinaciones de contenido real |
| Carrito | Catálogo con los mismos dieciocho IDs/precios de `js/app.js`; guardar, quitar, total estimado y contador. Conserva campos desconocidos del estado original | El canje real no está conectado al portal actual. No se crea una compra ni se descuentan Rings con lógica cliente |
| Tienda / Inventario | Accesos conectados al catálogo y al inventario local de la versión anterior; no desplazan a secciones equivocadas | Equipar o canjear contra un inventario remoto requiere un contrato de backend que el portal actual no expone |
| Perfil | Se conservan editor, IndexedDB, encuadre, OST y sincronización; navegación y móvil comprobados | Guardado, imágenes y perfiles ajenos con sesión y reglas reales |
| OST | Seek persistente corregido, volumen limitado, controles etiquetados, filas accesibles por teclado y mensaje al no haber pista | Reproducción de URLs reales, subida y eliminación con cuenta autorizada |
| Ranking | Filas accionables con teclado, métricas legibles, rutas y vista móvil | Ordenación con datos reales, presencia y relaciones autenticadas |
| Fanarts | Búsqueda sin tildes, filtros ARIA, paginación, cierre/foco, previews sin fugas de Blob URL y respeto a movimiento reducido | Pruebas reales de publicación, likes, edición y eliminación |
| Admin/staff | Loaders reparados, formularios originales conservados, foco visible, páginas `noindex`; carga/rutas/móvil sin excepciones | Roles, escrituras y transacciones necesitan prueba autorizada contra backend |
| Descargas | Miniaturas disponibles identificadas como vistas previas; imagen corresponde al archivo enlazado | No se presentan como originales de alta resolución |
| Redes y clips | Botones/recursos existentes conservados | X/Discord/Facebook no tienen URL en main; se solicitaron las URLs oficiales. Vídeos de portada siguen como demostración porque no hay clips configurados |

## UI, accesibilidad y rendimiento

Se conserva el lenguaje visual Sonic, los colores y los recursos actuales. La mejora es incremental: foco visible, salto al contenido, menús con Escape y devolución de foco, estados de botones, controles de reproducción, texto adaptable, contenedores que no se desbordan y objetivos táctiles legibles. El botón de accesos se separa del menú móvil para que no lo tape. El drawer no se cierra mientras hay otro diálogo abierto ni por un temporizador de una acción local.

La inspección visual móvil llevó a compactar los accesos del hero en una fila desplazable, ajustar titular y fuentes de respaldo y corregir contraste del CTA secundario. Permanecen todos los accesos y los recursos originales.

Las animaciones se ajustan a movimiento reducido; el contenido de secciones permanece visible en esa preferencia. El autoplay se detiene en pestaña oculta y dispone de pausa y navegación manual. Se reutiliza Swiper existente. No se añade un framework de aplicación ni se migra a React.

Siete originales que suman 2.973.620 bytes tienen derivados WebP predeterminados que suman 401.504 bytes (86,5% menos en esa selección), con variantes de hasta 1440 px, sin ampliar imágenes pequeñas. Los originales permanecen en el repositorio; su tamaño total en disco aumenta al añadir variantes. La transferencia real depende de `srcset`, caché, DPR y viewport: no es una medición de todo el sitio ni una puntuación Lighthouse. Se usa WebP; no se afirma haber generado AVIF.

Se añaden dimensiones y decodificación asíncrona a imágenes locales; la primera imagen del hero es prioritaria y las no críticas se difieren. `media-inventory.json` incluye hashes, formato declarado, firma real y dimensiones. Hay archivos `.webp` heredados cuya firma es PNG/JPEG; se documentan y conservan, sin renombrarlos silenciosamente.

## Fuentes, skills y REA realmente utilizados

- Skill instalada: Reverse Engineer Anything, versión 49. Sus instrucciones reservan REA para artefactos compatibles; los fuentes completos del proyecto se revisan por medios convencionales.
- Web Design Guidelines y Vercel React Best Practices no se encontraron instaladas. Se consultaron las [instrucciones oficiales de interfaz](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines), sus [reglas vigentes](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) y la [referencia React](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices). Se aplican los criterios generales de foco, movimiento, carga de imágenes, listeners y almacenamiento; las recomendaciones exclusivas de React/Next no corresponden a este proyecto.
- Sonic Channel: la [portada pública](https://sonic.sega.jp/SonicChannel/index.html) entrega una lectura procesada con agrupaciones editoriales, galerías y enlaces a índices. Esa lectura no permite confirmar sus eventos ni su código de arranque. Las solicitudes del ejecutor a Internet fallan; tampoco se obtuvo código original nuevo mediante la herramienta web. Los CSS ya existentes en `vendor/` contienen referencias históricas a `/SonicChannel/`; su contenido no demuestra que sean la versión desplegada hoy. Se estudia su organización sin copiar código adicional de SEGA.
- REA MCP: se leyeron los contratos de JavaScript y se abrió `vendor/swiper-bundle.min.js`; fue reconocido como `javascript`, artefacto sin arquitectura, SHA-256 `8fe9ec7df2c425c7263e957e79b20d7a8e38d7afb7ccd4fd739db9473c181db1`. `binary_session` confirmó disponibilidad de `analyze_javascript_application` antes de invocarlo sobre esa ruta exacta.
- El análisis de Swiper agotó el plazo del proveedor de 30000 ms. Se reutilizó la evidencia parcial en `inspect_analysis_view`, se exportó `rea-evidence.json` y se cerró la sesión. **REA no completó el parseo de Swiper**: cero fuentes JS parseadas, una omitida y cobertura parcial. No se atribuyen a REA los resultados del análisis convencional ni las pruebas Playwright. `rea-swiper-summary.json` conserva el recibo con sus límites.

## Pruebas y revisión

Ejecutar `npm ci`, `npm test`, `npm run dev` y, en otra terminal, `npm run test:browser`. El navegador usa Edge instalado por defecto; también acepta `SF_BROWSER_EXECUTABLE` con la ruta de un Chromium compatible. Playwright es una dependencia de desarrollo; no se sirve al visitante. No se requiere compilación para publicar los archivos originales.

En esta sesión se usa Chromium 151.0.7922.34. `browser-verification.json` enumera escenarios reales y límites. Las capturas de portada ocultan únicamente el diálogo local para inspeccionar presentación; eso no autentica ni verifica permisos. Emulación responsive no equivale a dispositivos físicos o certificación Safari/Firefox. No se ha ejecutado Lighthouse ni desplegado código o reglas. El PR se deja para revisión, sin merge automático.
