# Revisión de las demostraciones · 28 de septiembre de 2026

## Correcciones

- Invalidar el acceso del comprador a un pedido ya no desconecta toda la sesión de demostración. El portal oculta el caso revocado y permite consultar otro pedido.
- Una respuesta de compra que llega tarde ya no confirma una selección de libros que se haya cambiado mientras se guardaba el pedido. Se informa del número del pedido anterior, que sigue disponible en el panel.
- Tras confirmar una compra se desactiva el botón de confirmación. «Preparar otro pedido de prueba» permite crear deliberadamente otro pedido con los mismos libros, sin reutilizar su identificador de reintento.
- La búsqueda manual de una devolución ficticia acepta el número escrito en minúsculas.
- Los errores de la demo indican cómo recuperar el pedido y compartir la misma sesión; no remiten a un correo que la demostración no envía.

## Comprobaciones

- Compilación del Worker y 130 pruebas automatizadas, incluidas diez pruebas nuevas. Antes de corregir, los casos de regresión reproducían los fallos.
- Compra mixta: 15 € + 20 € + un único envío de 7 € = 42 €; número de pedido, segunda compra independiente y enlaces al panel y a devoluciones.
- Solicitud por libro dañado, aprobación, respuesta del vendedor y etiqueta ficticia entre pestañas independientes usando el mismo enlace.
- Pantalla estrecha de 390 px mediante un marco local: compra, devolución y gestión desde el panel, sin desbordamiento en los diálogos comprobados. Es una simulación de tamaño; no una prueba en un teléfono físico.
- Batería de pruebas de aislamiento entre sesiones, caducidad, cuotas, escrituras simultáneas, conservación de borradores, validación de importes y protección del panel privado.

## Para la presentación

1. Abre `https://prueba-aleix.com/?demo=1` e inicia una demostración.
2. Añade los libros y crea un pedido ficticio. Conserva su número.
3. Usa «Solicitar devolución de este pedido» y registra un motivo de ejemplo.
4. Abre «Panel» en la barra de la misma demostración para gestionarlo.
5. Para otro dispositivo, despliega «Compartir o conectar otro dispositivo» y usa «Copiar enlace para otro dispositivo». No crees otra sesión si quieres ver los mismos pedidos.

Las sesiones duran siete días. Se admiten cinco sesiones nuevas por IP cada quince minutos y veinte pedidos por sesión, incluidos los cuatro ejemplos. Reutilizar una sesión existente evita consumir nuevas creaciones.

Los cobros, correos y reembolsos de dinero real siguen desactivados. La etiqueta descargable de la demo no sirve para enviar paquetes. Esta revisión funcional no sustituye la configuración pendiente de venta real.

## Mejoras de presentación

- Barra compartida más compacta: navegación numerada Tienda → Devoluciones → Panel, página actual identificada y guía según el pedido seleccionado. Los controles de compartir/conectar quedan en un desplegable.
- Si el navegador bloquea el portapapeles, se ofrece el enlace en un campo seleccionable. Ese campo se borra al cambiar o caducar la sesión.
- Abrir un pedido en el panel actualiza los enlaces de la barra para continuar con ese pedido en las otras vistas; un error al abrirlo no cambia la selección.
- Etapas de devolución y siguiente paso según el estado confirmado. Solo se destaca la etapa actual, sin inventar pasos anteriores ni confundir cierre con devolución de dinero.
- Verificación visual de escritorio y marco de 390 px: tienda conectada, solicitud por cubierta dañada, aprobación y respuesta desde otra pestaña, y recepción del estado en la vista móvil.
- Revisión Impeccable realizada. Se conserva la paleta crema/oliva solicitada. El aviso de contraste corresponde al título grande (cumple el umbral para texto grande); los avisos de espaciado no se reproducen en los paneles visibles, que mantienen su relleno. Se conserva la información funcional sobre solicitudes y dinero.
