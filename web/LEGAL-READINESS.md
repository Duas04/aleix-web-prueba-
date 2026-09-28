# Preparación de la venta — Fumada XXL

La web y la demostración son públicas por solicitud del titular. El panel de pedidos reales sigue siendo privado y la tienda no acepta pagos. Los documentos legales son una preparación basada en los datos facilitados y en las funciones actuales, no una certificación jurídica.

## Confirmado por el titular

- España; nombre y datos fiscales incorporados al aviso legal por indicación del usuario.
- Tapa blanda: 15 EUR. Tapa dura: 20 EUR. PVP final del libro, impuestos incluidos.
- Envío: 7 EUR por pedido a Europa.
- El ejercicio de respiración y la selección de compra funcionan en memoria, sin almacenamiento persistente propio.
- Tipografías y portada servidas desde el propio sitio; licencias de fuentes incluidas.

## Pendiente antes de aceptar pedidos

1. El titular confirma que todavía no tiene cuenta de Stripe. Pendiente: crear/verificar la cuenta, acceso efectivo, entorno de pruebas y conexión de producción. Las habilidades de Stripe instaladas no prueban que una cuenta esté conectada.
2. Integración que determine precios y envío en servidor, cree una Checkout Session, valide la firma de webhooks y gestione idempotencia. Confirmar el pago mediante `checkout.session.completed` y `checkout.session.async_payment_succeeded`, verificando `payment_status`; no dar un pedido por pagado por visitar una URL de éxito.
3. Registro duradero de pedidos y avisos al vendedor, confirmación/condiciones al comprador en soporte duradero, facturación y flujo de preparación/envío.
4. Transportista, destinos europeos efectivamente admitidos y plazos por destino. Teléfono y dirección de devoluciones ya confirmados por el titular. No cambiar retroactivamente condiciones de pedidos ya aceptados.
5. Tratamiento fiscal de la actividad y de las ventas intracomunitarias/exportaciones; altas censales, facturación y encuadramiento de Seguridad Social según circunstancias. Ser asalariado no determina por sí solo exención. Revisar con asesoría. No activar Stripe Tax sin registros fiscales confirmados.
6. Determinar si el titular es editor o revendedor y confirmar PVP/ediciones, características, ISBN cuando corresponda, derechos de explotación y existencias. Respetar el régimen de precio fijo del libro aplicable.
7. Fuera de la UE y territorios especiales: verificar transportista, restricciones, aduanas e impuestos de importación, responsable del pago y divulgación de costes antes de contratar. 'Europa' no equivale a 'Unión Europea'.
8. Inventario real de cookies y tecnologías equivalentes del alojamiento, autenticación y futura pasarela (incluidas HttpOnly). La inspección del código y del DOM no permite certificar las cookies impuestas por la plataforma. No afirmar que la web completa no usa cookies.
9. Contratos/condiciones de alojamiento, correo, pagos y transportista: funciones, destinatarios, conservación y transferencias internacionales. Actualizar privacidad antes de introducir nuevos tratamientos.
10. Evaluar normativa de accesibilidad aplicable (Ley 11/2023, comercio electrónico desde 28-06-2025), sin presumir exención ni declarar certificación.
11. Revisar transposición y aplicación de la función de desistimiento online de la Directiva (UE) 2023/2673 (19-06-2026). Preparar un envío real, confirmación con fecha/hora y acuse duradero; un enlace mailto o un botón decorativo no sustituye automáticamente esta función.
12. Mantener el panel de pedidos reales restringido al propietario. La publicación de la web y de la demostración no habilita el cobro ni elimina los requisitos pendientes para aceptar ventas.

## Fuentes de referencia

- LSSI, arts. 10, 22, 27 y 28: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- Consumo, arts. 66 bis, 97–108 y 117–120: https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555
- RGPD, arts. 6, 12–13, 28 y 44–49: https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=es
- Cookies: https://www.aepd.es/guias/guia-cookies.pdf
- Precio fijo del libro: https://www.boe.es/buscar/act.php?id=BOE-A-2007-12351
- Accesibilidad: https://www.boe.es/buscar/act.php?id=BOE-A-2023-11022
- Desistimiento online: https://eur-lex.europa.eu/eli/dir/2023/2673/oj?locale=es
- Cierre de la plataforma ODR en julio de 2025: https://consumer-redress.ec.europa.eu/site-relocation_en

## Cómo ajustar el catálogo y el envío

El selector actual es una vista previa sin transacciones. Los importes se muestran en `dist/index.html` y se calculan en céntimos en `dist/shop.js`. Si se modifican precios/envío, mantener también las condiciones de venta sincronizadas. Al conectar pagos, estos importes deben fijarse y comprobarse en servidor, no confiar en el navegador.

## Panel privado añadido

El área `/admin`, su autorización en servidor, la base de datos de pedidos y la gestión de envío están implementados. La recogida de pedidos y la confirmación de pago real siguen pendientes de conectar checkout y webhooks verificados. No se han activado notificaciones automáticas, facturación ni correos transaccionales. Los datos de prueba se usan únicamente en tests locales aislados. Antes de aceptar ventas hay que concretar y aplicar la conservación de pedidos y completar los proveedores de la política de privacidad.
