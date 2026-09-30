# Revisión general: web, comunidad y panel

Revisión sobre la fuente db347e1448873192f99283c7a68faaa19f27ced3 y correcciones posteriores. Se conservan el diseño ocre y las funciones activas; la antigua tienda queda archivada.

## Corregido

- Los borradores de respuesta se conservan por conversación al cerrar y volver a abrir el diálogo, dentro de la pestaña. Se limpian al terminar la sesión; no se guardan en el dispositivo ni se prometen tras recargar.
- Un envío tardío de aviso no puede confirmar ni ocultar otro formulario abierto después.
- Las recargas antiguas de avisos no reemplazan resultados más recientes y se conservan las resoluciones que se están redactando al actualizar.
- Si caducan la sesión o los permisos, el panel vacía sus datos privados e invalida respuestas pendientes para que no reaparezcan.
- La moderación de respuestas pendientes permite abrir la conversación original.
- El panel incluye acceso por teclado «Saltar al contenido». Una cuenta lectora que visite el panel recibe una página de acceso reservado con instrucciones, manteniendo HTTP 403 y no-store/noindex. `/propietario/` redirige a la URL canónica.

## Evidencia

- Suite completa: 167 pruebas pasaron. Se añadieron seis regresiones de interfaz que ejercitan el JavaScript real con un DOM de prueba y respuestas fuera de orden. Los cuatro primeros fallaban antes de corregirlos.
- Edge: portada, comunidad, panel, privacidad y 404 revisados a 320, 390, 768 y 1440 px, sin desbordamiento horizontal. Axe no detectó incumplimientos WCAG A/AA en esas vistas. Esto no certifica accesibilidad completa.
- Recorrido local con cuentas ficticias: enviar aviso, verlo en el panel, resolverlo, retirar una respuesta y conservar borrador al actualizar. Sin errores de JavaScript.
- Tres revisiones independientes: interfaz/comunidad, pruebas públicas y seguridad de servidor. No se confirmó escalada de permisos, CSRF, inyección ni exposición de avisos privados en lo revisado.
- Portada: imágenes, enlaces internos, sitemap, robots, metadatos, consentimiento de analítica y temporizador comprobados. Lighthouse generó datos pero falló al limpiar un temporal en Windows; no se presenta como ejecución completada.

## Límites y dependencias

- No se ha probado Safari/Firefox ni una nueva identidad Google real en esta revisión. OAuth usa pruebas de firma y flujo local; el modo público/pruebas de Google Cloud sigue siendo externo.
- El enlace de Amazon es provisional, según la instrucción del titular. No mide ventas de Amazon.
- Los límites por IP dependen de la cabecera confiable CF-Connecting-IP del hosting. Su ausencia en local agrupa visitantes sin IP; no se verificó esa ausencia en producción ni se trata como fallo confirmado del sitio.
- No se han eliminado ni resuelto avisos o publicaciones reales del usuario. Las pruebas con escrituras utilizan datos locales ficticios.
- No hay garantía de ausencia absoluta de errores ni auditoría legal externa. No se ejecutó Strix ni una prueba intrusiva contra producción.
