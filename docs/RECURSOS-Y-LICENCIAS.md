# Recursos, procedencia y licencias

## Reutilizados y derivados

Los archivos multimedia originales de `main` permanecen sin cambios de contenido. Se inventarían en `media-inventory.json`, incluyendo los directorios anidados `assets/images`, fanart-demo, user-carousel y ultimos-momentos. Los hashes permiten identificar duplicados; las 136 copias redundantes detectadas en la base no se eliminan porque pueden usarse mediante rutas dinámicas o históricas.

`assets/optimized/` contiene únicamente derivados WebP de siete imágenes que ya estaban en el repositorio. `media-optimization.json` vincula cada original con sus variantes, tamaños y dimensiones. Son conversiones de recursos existentes; no se les asigna una licencia nueva ni se afirma que el arte de Sonic sea libre. El propietario debe conservar los derechos y atribuciones que correspondan a los originales.

No se descargaron ilustraciones nuevas, audios, vídeos, logos ni fuentes de SEGA. El código frontend añadido es implementación propia sobre el proyecto existente. Los recursos de pruebas no contienen datos de cuentas reales.

## Investigación de recursos adicionales

| Recurso consultado | Fuente de licencia comprobada | Decisión |
| --- | --- | --- |
| Lucide, iconos UI | [Licencia oficial ISC; algunos derivados Feather conservan MIT](https://lucide.dev/license) | Compatible para futuros iconos si se preservan los avisos correspondientes; no añadido porque se reutilizan los controles presentes |
| Logo Sonic en Wikimedia | [Ficha del archivo](https://commons.wikimedia.org/wiki/File:Sonic_The_Hedgehog.svg) | No añadido: no aporta funcionalidad ni se ha acreditado una licencia de reutilización general para nueva ilustración Sonic |
| Imágenes públicas Sonic Channel | [Portada oficial](https://sonic.sega.jp/SonicChannel/index.html) | Solo referencia de organización editorial; visibilidad pública no equivale a licencia |

Se priorizó el material que el sitio ya tenía para conservar identidad y evitar descargas y duplicaciones innecesarias. No se introduce una fuente tipográfica ni una dependencia CDN adicional.

## Bibliotecas existentes

`vendor/jquery-3.7.1.min.js` y Swiper 11.2.4 conservan sus avisos MIT y no se actualizan. Los cambios a los CSS de vendor se limitan a las rutas locales de sus imágenes; no se declara que los CSS de origen SEGA tengan licencia MIT. Los demás CSS de vendor siguen presentes aunque no estén activos en todas las páginas.

Playwright Core 1.58.2 se añade solo para pruebas de desarrollo, con su licencia Apache-2.0 incluida por el paquete. Se reutilizó un navegador local ya instalado. No se empaqueta Playwright ni Chromium como parte del frontend servido.

## Fuentes de respaldo (añadidas en `upgrade/visual-system`)

| Archivo | Fuente | Licencia | Origen |
|---|---|---|---|
| `assets/fonts/archivo-black-latin.woff2` | Archivo Black 400, subconjunto latin | SIL OFL 1.1 (`assets/fonts/OFL-ArchivoBlack.txt`) | `@fontsource/archivo-black@5.3.0` (npm) |
| `assets/fonts/anton-latin.woff2` | Anton 400, subconjunto latin | SIL OFL 1.1 (`assets/fonts/OFL-Anton.txt`) | `@fontsource/anton@5.3.0` (npm) |

Se usan solo como respaldo de `SFDisplay`/`Arial Black` e `Impact` en dispositivos que no tienen esas fuentes (Android, iOS, Linux). Windows sigue usando sus fuentes locales.
