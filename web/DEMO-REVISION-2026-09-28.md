# Revisión de las demostraciones · 28 de septiembre de 2026

## Correcciones

- Invalidar el acceso del comprador a un pedido ya no desconecta toda la sesión de demostración. El portal oculta el caso revocado y permite consultar otro pedido.
- Una respuesta de compra que llega tarde ya no confirma una selección de libros que se haya cambiado mientras se guardaba el pedido. Se informa del número del pedido anterior, que sigue disponible en el panel.
- Tras confirmar una compra se desactiva el botón de confirmación. «Preparar otro pedido de prueba» permite crear deliberadamente otro pedido con los mismos libros, sin reutilizar su identificador de reintento.
- La búsqueda manual de una devolución ficticia acepta el número escrito en minúsculas.
- Los errores de la demo indican cómo recuperar el pedido y compartir la misma sesión; no remiten a un correo que la demostración no envía.

## Comprobaciones

- Compilación del Worker y 126 pruebas automatizadas, incluidas seis pruebas nuevas. Antes de corregir, los casos de regresión reproducían los fallos.
- Compra mixta: 15 € + 20 € + un único envío de 7 € = 42 €; número de pedido, segunda compra independiente y enlaces al panel y a devoluciones.
- Solicitud por libro dañado, aprobación, respuesta del vendedor y etiqueta ficticia entre pestañas independientes usando el mismo enlace.
- Pantalla estrecha de 390 px mediante un marco local: compra, devolución y gestión desde el panel, sin desbordamiento en los diálogos comprobados. Es una simulación de tamaño; no una prueba en un teléfono físico.
- Batería de pruebas de aislamiento entre sesiones, caducidad, cuotas, escrituras simultáneas, conservación de borradores, validación de importes y protección del panel privado.

## Para la presentación

1. Abre `https://prueba-aleix.com/?demo=1` e inicia una demostración.
2. Añade los libros y crea un pedido ficticio. Conserva su número.
3. Usa «Solicitar devolución de este pedido» y registra un motivo de ejemplo.
4. Abre «Panel» en la barra de la misma demostración para gestionarlo.
5. Para otro dispositivo, usa «Copiar enlace para otro dispositivo». No crees otra sesión si quieres ver los mismos pedidos.

Las sesiones duran siete días. Se admiten cinco sesiones nuevas por IP cada quince minutos y veinte pedidos por sesión, incluidos los cuatro ejemplos. Reutilizar una sesión existente evita consumir nuevas creaciones.

Los cobros, correos y reembolsos de dinero real siguen desactivados. La etiqueta descargable de la demo no sirve para enviar paquetes. Esta revisión funcional no sustituye la configuración pendiente de venta real.
