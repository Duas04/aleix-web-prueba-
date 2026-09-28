# Web y administración privada

Esta carpeta contiene la tienda y el panel privado de Fumada XXL, con los cambios y correcciones realizados. La presentación con pedidos ficticios está separada en ../presentacion; esta versión no publica /demo ni empaqueta sus datos.

## Comprobar y abrir localmente

Requiere Node.js 24 o superior. Desde esta carpeta:

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
node scripts/preview-admin.mjs
```

Abre http://127.0.0.1:4181/ o http://127.0.0.1:4181/admin. El servidor de vista previa usa identidad sintética y una base efímera local vacía; nunca se publica y no prueba el inicio de sesión de producción. No exponerlo a Internet. PORT permite cambiar el puerto.

Para generar migraciones: pnpm install, luego pnpm db:generate. No reescribir las migraciones ya aplicadas.

## Arquitectura

- dist/: páginas públicas, estilos, scripts, portada y fuentes.
- admin/: plantilla y comportamiento del panel privado, protegido en servidor.
- worker/: autorización del propietario, consulta de pedidos y envío de pedidos pagados.
- db/ y drizzle/: esquema y migraciones D1.
- tests/: pruebas de permisos, datos, envíos y exclusión de la demo.
- .openai/hosting.json: identificación del alojamiento actual y binding lógico DB.

El alojamiento Sites aporta la identidad de usuario confiable. ADMIN_OWNER_EMAIL se configura como secreto en el alojamiento y fija el propietario por ID estable después del primer acceso válido. No contiene credenciales ni datos de compradores. La configuración y los permisos de D1 se gestionan en el alojamiento.

La compilación genera dist/server/index.js, ignorado por Git. scripts/package.mjs recibe una ruta absoluta de archivo tar.gz y empaqueta el Worker y las migraciones. Publicar esta carpeta sería una operación aparte: GitHub no cambia automáticamente prueba-aleix.com.

## Pendientes

Los pagos siguen desactivados. No hay checkout, webhooks ni creación de pedidos reales desde esta interfaz. Consultar LEGAL-READINESS.md antes de abrir la venta. REVIEW-2026-09-28.md conserva el historial de revisiones de la web original, incluida la demo que ahora se conserva en la otra carpeta.
