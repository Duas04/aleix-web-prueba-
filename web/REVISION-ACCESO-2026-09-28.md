# Revisión de tienda, demostración, devoluciones y panel

Fecha: 28 de septiembre de 2026.

## Fallo confirmado y corregido

Cuando caducaba o se invalidaba un enlace real de devolución con la página abierta, el servidor rechazaba correctamente las peticiones, pero la interfaz mantenía el caso anterior visible y no mostraba cómo pedir otro enlace.

Ahora un HTTP 401 al actualizar, registrar una solicitud, abrir el portal o descargar una etiqueta limpia el acceso anterior, oculta el caso y su justificante y muestra el formulario para pedir un nuevo enlace. Conserva el número de pedido y sitúa el foco en ese campo una vez habilitado. Los errores temporales 503 permiten reintentar sin ocultar el caso. Las peticiones de recuperación no reutilizan el token inválido.

No cambia el diseño, los precios, los datos existentes ni la configuración de cobros. No se envían correos ni se ejecutan reembolsos automáticamente.

## Verificación

- 134 pruebas automáticas de la aplicación pasan, incluidas cuatro nuevas pruebas de recuperación del portal real.
- Tres pruebas reprodujeron el fallo antes de corregirlo. La prueba de foco también reprodujo el intento de enfocar un campo deshabilitado antes de ajustar el orden.
- Revisión independiente de interfaz, persistencia de pedidos/demos y seguridad de acceso. No aparecieron otros fallos concretos reproducibles dentro de ese alcance.
- Prueba de navegador local con un pedido ficticio: crear enlace en el panel, abrirlo como comprador, invalidarlo en el panel y actualizar como comprador. Se oculta el caso y reaparece el formulario de acceso.
- Compilación del Worker correcta.

## Límites

La revisión de seguridad no constituye una garantía de ausencia de vulnerabilidades. No se ejecutaron cobros reales ni se comprobaron credenciales de pasarela. Se intentó una revisión adicional mediante Antigravity CLI sobre una copia sin secretos y después sobre código proporcionado directamente; no produjo un informe utilizable antes del tiempo límite y no se contabiliza como revisión completada.
