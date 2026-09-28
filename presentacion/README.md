# Fumada XXL · Presentación conectada

Demostración autocontenida del recorrido de compra, devolución y gestión de pedidos. Usa exclusivamente compradores, direcciones y pagos ficticios. La etiqueta de devolución es una simulación que no sirve para transportar paquetes.

## Ejecutar

Necesitas Node.js 24 o posterior. El servidor usa los módulos incorporados de Node y SQLite, sin dependencias externas.

```sh
npm start
```

Abre [la compra ficticia](http://127.0.0.1:4180/?demo=1) o [el panel](http://127.0.0.1:4180/demo). El servidor escucha en `127.0.0.1:4180` por defecto. Deténlo con `Ctrl+C`.

La barra de demostración permite crear una sesión explícitamente y compartir su enlace entre dispositivos que puedan alcanzar el mismo servidor. El enlace contiene una clave privada de esa sesión ficticia; compártelo solo con quienes deban ver y gestionar sus ejemplos. La sesión caduca después de siete días. Crear otra inicia cuatro ejemplos nuevos.

Cada sesión admite veinte pedidos, incluidos los cuatro ejemplos iniciales. La compra calcula 15 € por tapa blanda, 20 € por tapa dura y 7 € de envío una vez por pedido. Repetir una confirmación con el mismo identificador de solicitud conserva el mismo pedido. Los cambios del comprador y del panel se sincronizan mediante la API local y versiones de los pedidos.

## Archivos y persistencia

```text
serve.mjs                   Servidor HTTP y adaptador SQLite local
public/index.html           Compra ficticia
public/demo/index.html      Panel de demostración
public/devoluciones.html    Portal de devoluciones ficticias
public/                     Scripts, estilos, fuentes e imágenes
worker/demo.mjs             API exclusiva de la demostración
worker/database.mjs         Función de acceso a la base, reutilizada por la demo
drizzle/*.sql               Migraciones originales del esquema
tests/server.test.mjs       Pruebas de integración HTTP
.data/presentation.sqlite   Estado local, excluido de Git
```

El primer arranque aplica las migraciones y registra su huella. Los siguientes conservan las sesiones; una migración aplicada que se haya modificado se rechaza. SQLite también puede crear archivos `-wal` y `-shm` dentro de `.data/`.

La exportación expone únicamente `/api/demo/*` y los archivos de `public/`. `/admin`, las API privadas y de devoluciones reales, los módulos del servidor, las migraciones y la base de datos no se sirven. No necesita cuentas de Cloudflare, D1, R2, Stripe ni servicios de correo; los enlaces y etiquetas de esta presentación son ficticios. El servidor no ejecuta compras, envíos ni reembolsos reales.

## Pruebas

```sh
npm test
```

Las pruebas levantan servidores en puertos temporales y bases efímeras. Comprueban persistencia tras un reinicio, sincronización, rutas privadas inaccesibles, límite de 8 KiB por petición, origen y Host válidos, y que falsificar cabeceras de Cloudflare o de proxy no evita la cuota de sesiones. No utilizan `.data/` de la presentación.

## Otro puerto, red local o proxy

`PORT` cambia el puerto; `HOST` cambia la interfaz de escucha. Para acceder desde otro dispositivo, configura una dirección de tu ordenador accesible desde esa red en `PUBLIC_ORIGIN` y una interfaz que acepte esas conexiones en `HOST`. Por ejemplo, en PowerShell, sustituyendo la dirección por la de tu ordenador:

```powershell
$env:HOST = '0.0.0.0'
$env:PUBLIC_ORIGIN = 'http://192.168.1.50:4180'
npm start
```

El dispositivo debe abrir ese mismo origen. `PUBLIC_ORIGIN` contiene solamente esquema, host y puerto. Si usas un proxy HTTPS, configura expresamente su origen público y conserva la cabecera `Host` correspondiente. El servidor nunca deduce el origen a partir de `X-Forwarded-*`; obtiene la dirección para las cuotas de la conexión TCP, ignorando direcciones enviadas por el cliente. Detrás de un proxy, la cuota se comparte entre las conexiones que llegan desde ese proxy.

Esta carpeta sirve para la presentación local y como código en GitHub. Publicar sus archivos en GitHub Pages no ejecuta el servidor Node ni conserva sesiones compartidas.
