# Speedy Friends — versión modular

Esta versión parte del `index(2).html` proporcionado y conserva la lógica original.
Primera etapa:
- `index.html`: estructura y contenido.
- `styles.css`: estilos que estaban dentro de `<style>`.
- `js/config.js`: configuración compartida.
- `js/utils.js`: utilidades puras.
- `js/app.js`: lógica principal y scripts restantes.

## Probar en la laptop
Abrir la carpeta en VS Code y usar **Live Server** sobre `index.html`.

No se necesita Node.js ni Python para esta prueba si Live Server ya está instalado.

## Cambios de esta versión
- Ranking separado en Creadora / Administración / Integrantes.
- Buscador en el panel de administración por nombre, correo o UID.
- La creadora puede asignar/quitar el rol `admin` desde el panel.
- El rol `admin` organiza el ranking; el permiso `rings` sigue siendo independiente.
- Los usuarios con permiso Rings pueden modificar a otros integrantes, pero no a la creadora.
- Se incluye `firebase-rules.json` con la protección de servidor para la creadora.
