# Ampliación del panel de pedidos — 28 de septiembre de 2026

Se conserva la estética marfil, verde oliva y tipografía del libro. La tienda pública mantiene su funcionamiento actual y los cobros siguen desactivados.

## Funciones añadidas

- Accesos a pedidos por preparar, devoluciones activas e incidencias pendientes, con contadores y filtros. Los reembolsos cerrados permanecen en el filtro histórico.
- Transportista y seguimiento al enviar; corrección del seguimiento antes de la entrega; confirmación manual de entrega. No hay conexión automática con transportistas ni notificaciones al comprador.
- Detalle de pedidos con varias ediciones, cantidades, precio por ejemplar, subtotales y envío. Los pedidos antiguos siguen mostrando sus importes originales. La futura integración de cobro deberá escribir sus líneas en `order_items`.
- Notas privadas persistentes por pedido. Quedan fuera de la hoja impresa de preparación.
- Registro manual de devoluciones: solicitada, en revisión, aprobada, recibida, cerrada o rechazada. Motivo y resolución, con validación de transiciones. Guardar la gestión no modifica el estado del pago ni realiza un reembolso. Una devolución activa impide enviar un pedido todavía pendiente.
- Tarjetas y botones amplios en móvil, formularios con etiquetas y confirmaciones, estados de error recuperables y conservación de borradores de otras secciones al guardar.

## Datos y protección

Las notas, envíos y devoluciones del panel privado se guardan en D1. Cada escritura exige la cuenta propietaria, origen coincidente y acción JSON explícita. Las nuevas acciones comparan una versión del pedido antes de guardar, para evitar sobrescrituras entre pestañas. El panel actualizado también envía la versión al marcar un envío; el endpoint conserva compatibilidad con el cliente anterior, manteniendo sus restricciones de estado.

Se limitan los cuerpos durante la lectura y los campos por longitud. Las consultas están parametrizadas y los textos se muestran sin interpretar HTML. Las respuestas privadas no se almacenan en caché. Las acciones no escriben importes ni estados de pago.

La migración `0002_cute_blazing_skull.sql` añade una tabla de líneas y nueve columnas; no reconstruye tablas existentes, borra pedidos ni introduce ejemplos en producción. Los ejemplos de `/demo` son ficticios, no llaman al API privado y se reinician al recargar.

## Comprobaciones

- 54 pruebas automatizadas superadas en la aplicación completa: autenticación, CSRF, validación, conflictos entre escrituras, conservación de datos anteriores al migrar, filtros, líneas, devoluciones, interfaz, demo y regresiones de tienda.
- Navegador local: nota guardada y conservada tras recargar; envío con transportista; seguimiento corregido; entrega confirmada; devolución en revisión manteniendo otra nota sin guardar.
- Vista de 390 px sin desbordamiento horizontal; botones de pedido ocupan el ancho de la tarjeta. Revisión visual a 1280 px y sin errores de consola en las comprobaciones.
- Revisión adicional de backend, frontend y seguridad. Se corrigió una pérdida de borradores al guardar otra sección y se añadió cobertura de regresión.

Estas verificaciones usan datos sintéticos locales y no constituyen una prueba de intrusión del alojamiento ni una certificación de seguridad. Los cobros, los reembolsos monetarios y los correos reales dependen de la futura integración de Stripe y del proceso de venta.

## Dónde verlo

- Panel privado: https://prueba-aleix.com/admin
- Demostración pública: https://prueba-aleix.com/demo
- En GitHub, `web/` contiene la aplicación sin demo y `presentacion/` la presentación con ejemplos ficticios.
