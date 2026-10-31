# Pruebas aisladas de reglas de Realtime Database

`database.candidate.rules.json` es una propuesta **parcial y experimental** derivada de `../../firebase-rules.json`, no de las reglas de producción desconocidas. Solo modifica la escritura de perfiles: requiere propiedad previa para editar o borrar, conserva identidad y campos de rol y Rings para usuarios normales, y exige valores iniciales restringidos. Puede bloquear perfiles antiguos sin propietario o con datos incompletos, o flujos legítimos; requiere migración y pruebas de compatibilidad. Las demás reglas heredadas, sus privilegios, privacidad y otros módulos no están auditados ni corregidos aquí. **No desplegar esta propuesta**.

Requisitos: Node.js compatible, Java 21+ y conexión a Internet para instalar dependencias y descargar el emulador oficial. Desde este directorio: `npm ci` y después `npm test`. El comando fija el proyecto ficticio `demo-speedy-friends`, la configuración de reglas y la dirección local del emulador; las pruebas rechazan cualquier otra dirección. No ejecuta despliegues ni modifica datos de producción.

El test prepara y limpia datos en el emulador y no utiliza credenciales reales. Se necesitan pruebas adicionales para todas las rutas, Storage y la compatibilidad con los flujos de la aplicación antes de recomendar un despliegue.

Estado de esta sesión: la instalación de dependencias falló dos veces con `EPERM` al crear directorios en `node_modules`; por tanto, no se ha ejecutado el emulador ni se han comprobado estas reglas. La resolución del lock informó 21 vulnerabilidades transitivas (16 moderadas y 5 altas); revisarlas antes de adoptar estas herramientas. Java Temurin 21 se descargó de forma portátil sin modificar el entorno global.
