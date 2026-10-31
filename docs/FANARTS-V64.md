# Fanarts V6.4

El editor usa los datos y la operación de actualización existentes; comprueba el propietario en la interfaz antes de abrir y antes de guardar. Esa comprobación no sustituye las reglas de Firebase: la prueba con mock no las evalúa y las reglas desplegadas no se han verificado.

Las nuevas publicaciones no guardan el token de borrado de Cloudinary en Firebase. El borrado existente elimina el registro de la galería, pero un archivo nuevo puede permanecer en Cloudinary: la eliminación segura de medios sigue pendiente de un backend autorizado y no se ha activado en producción. Una subida completada seguida de un fallo de Firebase o un cambio de cuenta también puede dejar un archivo huérfano. Las publicaciones antiguas y sus datos no se migran automáticamente.

La prueba E2E usa Firebase y Cloudinary simulados: cubre edición del propietario, ausencia de controles de edición para otra cuenta, imagen, vídeo, validación de categoría y ausencia del token en el nuevo registro. No verifica permisos reales, entrega de archivos de Cloudinary ni dispositivos físicos.

Al cerrar o cambiar de sesión, la galería cancela su listener, vacía la copia en memoria y cierra los paneles abiertos; también descarta obras al recibir un error del listener. Estas medidas de interfaz no sustituyen la autorización en Firebase.
