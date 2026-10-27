# Speedy Friends — Sonic-style Animated Portal

Reconstrucción visual de Speedy Friends inspirada en la arquitectura de interacción de Sonic Channel.

### Integración añadida
- Sección **Accesos rápidos** colocada inmediatamente después de **Descargas**.
- Misma tipografía display, ritmo de espaciado y sistema de `reveal`/stagger.
- Cinco controles heredados del panel original de Speedy Friends: Rings, Cuenta, Admin, Apariencia y Carrito.
- Efecto 3D según el puntero, elevación, barrido de luz y barra inferior animada.
- Estado local persistente para los controles de demostración.
- Navegación de escritorio y móvil actualizada con el acceso a la nueva sección.

Los controles están desacoplados del carrusel y del resto de las animaciones para evitar romper la capa visual existente.

### Desarrollo y revisión frontend

Se mantiene este proyecto HTML/CSS/JavaScript y sus páginas originales, sin migración de framework. Consulta [la auditoría](docs/AUDITORIA-FRONTEND.md) y [los recursos y licencias](docs/RECURSOS-Y-LICENCIAS.md) para conocer cambios, evidencias y funciones que requieren validación con una cuenta autorizada.

```sh
npm ci
npm test
npm run dev
```

Abre `http://127.0.0.1:4174`. El servidor local evita las limitaciones de `file://` para Firebase, módulos y persistencia. No hace falta compilar el sitio. En otra terminal, `npm run test:browser` usa Edge instalado; `SF_BROWSER_EXECUTABLE` permite seleccionar un Chromium local compatible. Las dependencias de pruebas no se cargan en producción.

- `npm run audit`: inventario y diagnóstico convencional; `docs/audit-baseline.json` conserva el estado de `main` previo a la corrección.
- `npm test`: sintaxis, enlaces/recursos, loader, conservación de originales, catálogo y persistencia de OST.
- `npm run test:browser`: escenarios offline de navegación, controles, galería y responsive. No inicia sesión ni escribe en servicios reales.
- `node scripts/optimize-media.cjs --inspect-only`: con el servidor abierto, verifica dimensiones y firmas de los recursos locales. Sin ese argumento genera derivados de imágenes existentes; no borra los originales.

El carrito permite guardar/quitar productos y consultar un total estimado; no realiza canjes ni modifica Rings. Los enlaces sociales y clips reales necesitan sus URLs oficiales. Las escrituras de perfiles, administración y subidas deben revisarse con una cuenta de pruebas antes de publicar. Esta revisión se prepara como PR, sin fusionar ni desplegar automáticamente.
