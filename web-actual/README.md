# Donde siempre estuviste · Aleix

Web editorial del libro con enlace provisional a Amazon, una pausa de respiración, comunidad moderada y zona privada de estadísticas. El título anterior era provisional. La compra directa, las devoluciones y las demostraciones están retiradas de la publicación y conservadas en el repositorio histórico.

## Ejecutar y comprobar

Necesita Node.js 24 o superior.

```sh
node scripts/build-public.mjs
node --test tests/*.test.mjs
node scripts/preview-public.mjs
```

Abrir http://127.0.0.1:4188/. La opción `--owner` abre otra vista en el puerto 4189 con una identidad ficticia y base efímera para comprobar la comunidad. Es exclusivamente local; no prueba un acceso real con Google. Nunca publicar el servidor de vista previa.

## Publicación activa

- `worker/site.mjs`: único router publicado, HTTPS, URL canónica, caché, páginas y permisos.
- `worker/community.mjs`: Google OAuth, sesiones, alias, conversaciones, moderación y límites contra abuso.
- `worker/metrics.mjs`: contadores agregados voluntarios; clics hacia Amazon y WhatsApp, no ventas confirmadas.
- `scripts/build-public.mjs`: compila recursos seleccionados; excluye tienda, demo, devoluciones y panel antiguo. Fuentes e imágenes con huella de contenido y caché duradera.
- `db/schema.ts` y `drizzle/`: esquema y migraciones aditivas. No editar migraciones ya publicadas.
- `dist/`: fuentes HTML/CSS/JS, imágenes comprimidas y licencias de las tipografías. Las páginas privadas se sirven a través del Worker, no mediante un alojamiento estático.

Los archivos de la venta directa y sus pruebas se conservan para archivo y mantenimiento histórico. `worker/index.mjs`, `scripts/build.mjs`, `admin/`, `demo/` y los scripts de carrito/devoluciones **no son la aplicación activa**. No ejecutar el build antiguo para publicar esta versión. En GitHub están además separados en `web/` y `presentacion/`; el nuevo proyecto vive en `web-actual/`.

## Activar Google

En este momento faltan las credenciales del titular; la web indica que la participación está pendiente. En Google Cloud configurar un cliente OAuth de tipo aplicación web, pantalla de consentimiento y origen `https://prueba-aleix.com`, con retorno exacto `https://prueba-aleix.com/auth/google/callback`. Configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (secreto) y `COMMUNITY_ORIGIN` en el alojamiento, nunca en GitHub. El origen ya está preparado en Sites. Volver a desplegar para aplicar cambios y comprobar el acceso real.

El dueño debe iniciar sesión con la identidad ya autorizada por Sites en `/propietario` y con su Google en `/comunidad`, y pulsar Vincular mi cuenta como dueño. Se fija un único identificador estable en servidor. Iniciar sesión como lector o usar el alias Aleix no concede permisos. La identidad de Sites no se sustituye ni se crea una nueva cuenta de dueño por correo desde el navegador. `ADMIN_OWNER_EMAIL` sigue siendo secreto del alojamiento.

## Operación y pendientes

Ver [la revisión y lista completa](docs/amazon-comunidad-2026-09-30.md). La imagen de portada sigue siendo una propuesta visual. Falta la ficha real de Amazon y las redes sociales del autor. La comunidad no verifica compras de Amazon.

`node scripts/backup-source.mjs` genera una copia diaria de código versionado en `../copias-codigo/`, con comprobación SHA-256. No incluye secretos de entorno ni la base de producción. La vigilancia y esa copia están programadas cada hora/una vez al día en Codex y dependen de la disponibilidad del equipo. La recuperación de D1 debe configurarse y probarse antes de activar cuentas reales.

Los registros históricos de pedidos no se han borrado: se retira su acceso público y se conserva el código. El repositorio no contiene datos de clientes ni credenciales. La configuración de Google, proveedores y documentos legales debe corresponder al titular y al servicio que finalmente active.
