# Revisión — 18 de octubre de 2026

## Cambios

- Se conservan las páginas HTML y los identificadores de integración. Se elimina de la portada un cierre huérfano y un script que se ejecutaba antes de que existiera su loader.
- Se repara un error de sintaxis en el controlador de fanarts y una selección CSS inválida al pulsar enlaces hacia otras páginas.
- Se eliminan los reintentos de fanarts sin sesión y el sondeo de roles de cafetería cada 1,5 segundos. Permanecen los eventos de Firebase y cafetería.
- El loader deja de esperar imágenes y servicios externos. Se mantiene el requisito de iniciar sesión; la comunidad pública es accesible desde ese diálogo. Si no carga la cuenta, aparece un estado legible con acceso a las reglas.
- Portada con navegación horizontal móvil, textos mayores, foco visible, menú con Escape y confinamiento de foco, panel de accesos separado del menú y carrusel con pausa. Se respeta movimiento reducido y se detiene el autoplay al ocultar la pestaña.
- Imágenes distintas en las secciones de portada y vistas previas reales en Descargas. Los fondos y calendario disponibles son miniaturas; no se ofrecen como originales de alta resolución.
- Dimensiones, decodificación asíncrona y carga diferida para imágenes locales. Seis derivados WebP: 449.050 → 373.460 bytes, un 16,8 % menos en esos archivos. No es una medición del sitio entero ni de Lighthouse.
- Se reparan las referencias CSS hacia `images/`, carpeta inexistente. Las pocas imágenes de interfaz ausentes se sustituyen por recursos equivalentes existentes. Se conservan GIF y originales; los sprites de interfaz no se usan como ilustraciones del directorio.
- Se corrige el título y la decoración de Novedades que desbordaban el ancho móvil.
- Build estático reproducible y pruebas de recursos, sintaxis, selección de grupos e interfaz.

## Selección de grupos

La revisión se limita a descripciones y reglas. Hay 23 espacios contando Avisos.

| Decisión | Espacios | Motivo |
|---|---|---|
| Destacar | Lobby, Chat General, Presentaciones, Dibujos, Poemas, Música y audios, Play & Win, Actividades, Cafetería | Función clara para presentar la comunidad. |
| Historias | Rol ON, Aqua Project, Mega Agencia de Súper Detectives | Rol y escenarios. Mega Agencia solo tiene una descripción breve, sin reglamento específico. |
| Mención informativa | Eventos, Economía, Avisos | Sin listas personales ni saldos. Economía está en beta y usa Rings del bot, separados de los del portal. En Avisos solo se resume la norma general; no se verificó un reglamento independiente. |
| Excluir del directorio general | Administración, Roleplay +18 | Dirección interna y espacio adulto. |
| Pendiente | Cosmología | Sin descripción. |
| Pendiente | Imperio Eggman | Descripción insuficiente para definir función y reglas. |
| Pendiente | Memes, Comunidad del team Sonic, Ideas y Sugerencias, Cómics | Sujetos a solicitud. La vista previa de Memes solo mostró el ingreso; no se enviaron solicitudes ni se verificaron las reglas de estos cuatro. |

Las reglas publicadas resumen las descripciones; no se inventan sanciones. La referencia son las reglas vigentes en WhatsApp. No se trasladan conversaciones, teléfonos, cumpleaños ni listas de miembros o jugadores.

## Validación

**7 pruebas estáticas aprobadas:** sintaxis JavaScript; recursos y rutas locales respetando mayúsculas; estructura e identificadores de portada; URLs de imágenes en CSS; selección de 23 espacios; existencia y reducción de los seis WebP; reglas estáticas sin servicios externos.

**8 pruebas de navegador aprobadas:** filtros y búsqueda sin tildes; imágenes y ancho de comunidad a 360/390/768/1440 px; arranque con almacenamiento corrupto y login conservado; foco/Escape/carrusel/enlaces; estructura y ancho de portada; carga y ancho móvil de Amigos, Ranking, OST, Cafetería, Fanarts, Novedades y Perfil; ausencia de excepciones JavaScript; reglas sin JavaScript.

Se ejecutaron en Chromium 151 con Playwright. También se revisó comunidad en Edge conectado. El primer intento automático con Edge no pudo arrancar por restricciones del entorno; se usó Chromium independiente para la batería completa.

Las conexiones externas se bloquearon en las pruebas. No se comprobaron login real, permisos de Firebase, subidas ni datos de producción. Las capturas de portada ocultan localmente el diálogo de login sin autenticar. La emulación móvil no equivale a Android físico. No se ejecutó Lighthouse ni una auditoría de seguridad del backend.

## Recursos y publicación

El inventario incluye 284 archivos y detecta 136 copias idénticas. Se conservan porque algunas rutas o usos dinámicos pueden depender de ellas. No se elimina una imagen solo por no aparecer en portada.

La entrega no modifica `main`, no despliega Firebase y no cambia permisos del backend. El ZIP contiene código y recursos; `npm run build` prepara la carpeta publicable. Revisar con una cuenta autorizada antes de sustituir el sitio en producción.
