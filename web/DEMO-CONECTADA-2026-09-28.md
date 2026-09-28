# Presentación conectada · 28 de septiembre de 2026

La tienda de prueba, las devoluciones y el panel comparten ahora una sesión guardada en el servidor. Se abre en móvil y ordenador con el mismo enlace; las sesiones diferentes no se mezclan.

La página del libro incluye un botón destacado **Devoluciones y reembolsos**, debajo de las ediciones. En modo demostración conserva la sesión y el pedido seleccionado; en la tienda ordinaria abre el portal real de atención.

## Cómo enseñarla

1. Abre `https://prueba-aleix.com/?demo=1` y pulsa **Iniciar demostración**.
2. Añade libros al carrito y crea el pedido de prueba. Se muestran el número propio, importe y justificante; no se cobra dinero.
3. Usa **Copiar enlace para otro dispositivo** y abre ese enlace en el móvil u ordenador. No crees otra demostración si quieres ver los mismos pedidos.
4. Desde la confirmación abre **Solicitar devolución de este pedido**. También puedes escribir su número en el apartado Devoluciones.
5. Registra un caso, por ejemplo libro dañado. Aparece en el Panel de la misma sesión; con la página visible se consulta cada cinco segundos.
6. Aprueba la devolución, escribe una respuesta y añade la etiqueta ficticia. El comprador puede ver los cambios y descargar el ejemplo, que no sirve para enviar un paquete real.

El panel conserva borradores y avisa si otra persona cambia el pedido. El guardado rechaza versiones antiguas para evitar sobrescrituras. La vista deja de consultar cuando está oculta. La sesión caduca a los siete días desde su creación, aunque se importe después. Una nueva sesión no elimina inmediatamente la anterior.

## Separación y límites

- Datos ficticios fijados en servidor. La compra solo acepta ediciones, cantidades y una referencia de reintento; calcula 15/20 euros por ejemplar y siete de envío una sola vez.
- Cuatro pedidos de muestra y hasta dieciséis compras nuevas por sesión. Creación limitada por origen de conexión y capacidad global.
- Clave aleatoria de 256 bits, solo huella en base de datos, sin indexación ni caché de las vistas de demo. El enlace permite gestionar toda esa sesión ficticia: se avisa antes de compartirlo.
- No accede a pedidos reales, no recibe archivos personales y no usa el almacenamiento de etiquetas reales. No introduzcas datos personales en las notas de prueba.
- Privacidad, cookies y condiciones describen el almacenamiento de la demo y su caducidad.
- La tienda ordinaria sigue sin contratar ni cobrar. La compra real, confirmación por correo y reembolso automático requieren conectar la pasarela y completar la operativa pendiente. Las devoluciones reales existentes mantienen su acceso privado independiente.

## Verificación

118 pruebas automatizadas del sitio pasan. Prueba manual local en tres pestañas: compra mixta de 42 euros, número generado, devolución por daños, actualización automática en panel, aprobación, respuesta y etiqueta visibles en comprador. Comprobada anchura móvil de 390 píxeles sin desbordamiento horizontal. Revisiones independientes de frontend, backend y seguridad.

En GitHub, `presentacion` incluye servidor Node y SQLite para la demo ficticia; `web` mantiene el panel privado y deshabilita las rutas de demo pública en su compilación. El alojamiento publicado combina ambas partes con separación de datos. La copia de GitHub no despliega automáticamente por sí sola.

Referencia informativa de almacenamiento técnico y transparencia: [Guía sobre cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf). Los cambios de esta entrega describen el funcionamiento técnico; no certifican el cumplimiento integral de una tienda aún pendiente de activación.
