# Speedy Friends

Portal estático de la comunidad: HTML, CSS y JavaScript, con las integraciones Firebase existentes para perfiles, amigos, Rings, fanarts, novedades, OST y cafetería.

## Ejecutar y construir

Requiere Node.js 18 o posterior. No hay dependencias necesarias para servir o construir el sitio.

```sh
npm run dev
npm test
npm run build
```

Abrir `http://127.0.0.1:4173/` o `http://127.0.0.1:4173/comunidad.html`. El build genera `dist/`, conserva las rutas HTML e incluye los recursos locales. Se puede publicar el contenido de esa carpeta en un alojamiento estático. El acceso con Google sigue sujeto a los dominios autorizados del proyecto Firebase.

## Comunidad y reglas

`community-groups.json` es la fuente del directorio. Ejecutar `npm run generate` después de editarla para actualizar `comunidad.html`. Las reglas están en el HTML y funcionan sin JavaScript; `community.js` añade búsqueda y filtros sin servicios externos.

Las descripciones se revisaron el 18 de octubre de 2026. La selección y sus límites están en `docs/REVISION.md`. No se publican conversaciones, teléfonos, cumpleaños ni listas de jugadores. Los grupos pendientes no se presentan como verificados.

## Pruebas de navegador

```sh
npm install
npx playwright install chromium --only-shell
npm run dev
# En otra terminal:
npm run test:browser
```

Opciones: `SF_BASE_URL`, `SF_TEST_OUTPUT` y `SF_BROWSER_CHANNEL=msedge` para utilizar Edge instalado. Las pruebas bloquean conexiones externas. No inician sesión ni escriben en Firebase. Las capturas de portada usan una preparación visual que oculta localmente el diálogo de login; no validan autenticación ni permisos del servidor.

Se comprueban búsqueda, filtros, reglas, funcionamiento sin JavaScript, carrusel, teclado, almacenamiento corrupto, rutas existentes y anchos de 360, 390, 768 y 1440 píxeles. No sustituyen una prueba en Android físico.

## Recursos y mantenimiento

- `portal-polish.css`: acabado compartido; portada bajo `.sf-home` y corrección móvil de Novedades.
- `docs/media-inventory.csv`: imágenes, dimensiones, fotogramas y duplicados.
- `docs/media-optimization.json`: originales y seis derivados WebP; todos los originales se conservan.
- `vendor/`: dependencias existentes y rutas reparadas hacia `assets/`.
- Los archivos de respaldo permanecen en el repositorio; el build omite `.before-` sin uso.

Las reglas de Firebase y las integraciones de subida no se han cambiado ni desplegado. Revisar las reglas vigentes y probar con una cuenta autorizada antes de publicar.
