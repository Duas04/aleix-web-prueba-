# Presentación

Versión estática independiente para enseñar el libro y su panel de ejemplo.

Desde la raíz del repositorio: `node presentacion/serve.mjs`. Abre http://127.0.0.1:4180/ para el libro o http://127.0.0.1:4180/demo para los pedidos ficticios. No abrir el HTML con file://: utiliza el servidor incluido para resolver las rutas.

- `public/index.html`: web del libro.
- `public/demo/index.html`: panel de presentación.
- `public/demo/app.js`: datos y comportamiento del panel, sin API.
- `public/panel.css`: aspecto del panel.
- `public/assets`: portada, fuentes y licencias.

Los cuatro ejemplos muestran pedido pagado por preparar, enviado, pago pendiente y reembolso total simulado de 27 EUR por libro recibido en mal estado. «Reiniciar demo» restaura los ejemplos. No hay compras, reembolsos, envíos ni clientes reales.

Para alojar esta versión en un servidor estático, utiliza public como raíz, resuelve /demo con demo/index.html y configura 404.html como página de error. Esta carpeta no contiene el panel privado.
