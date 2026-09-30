# Revisión de publicación y comunidad — 30 de septiembre de 2026

## Cambios de esta revisión

- Comunidad: cabecera compacta, conversaciones primero en móvil, acceso a cuenta mediante enlace visible, búsqueda/orden alineados, autores con inicial decorativa, fechas semánticas, fichas y diálogos más legibles. Sin cambios a datos, permisos ni API.
- Vistas previas al compartir: Open Graph y Twitter Cards específicos en las siete páginas públicas; portada de marca disponible por HTTPS.
- Sitemap: las siete páginas públicas canónicas, sin propietario, API, demostraciones o rutas privadas.
- Privacidad: se elimina del navegador la preferencia caducada o inválida, en lugar de ignorarla dejando la clave almacenada.
- Accesibilidad: el enlace de marca de inicio toma su nombre del texto visible completo; se retiró una etiqueta ARIA que omitía el subtítulo.
- Empaquetado: lista explícita de recursos públicos permitidos para impedir que una exportación o archivo ajeno añadido a dist se publique accidentalmente.

## Verificado

- 168 pruebas de código, incluida la lógica de cuentas Google, roles, moderación, reportes, borradores, consentimientos y metadatos. La suite incluye también módulos comerciales históricos archivados; no se publican.
- Navegador Edge: anchos 320, 390, 768 y 1440; lista con propietario y visitante, conversación y aviso. Sin desbordamiento horizontal ni errores JavaScript. Axe WCAG A/AA sin infracciones detectadas en los nueve estados probados. Borrador conservado tras cerrar y reabrir un hilo. Pruebas locales con datos ficticios, sin escribir en la base real.
- Web publicada anterior al cambio: inicio, comunidad y health responden 200; HTTP redirige a HTTPS, HSTS activo; propietario anónimo redirige a Google con noindex/no-store; .env y backup.zip responden 404 noindex; demo 410 noindex. No se obtuvo un archivo privado.
- UptimeRobot: portada y health aparecen Up, comprobación cada cinco minutos, cero incidencias en el momento de la revisión. No depende del ordenador. La recepción del aviso de prueba requiere confirmación del destinatario.
- Copia diaria local de código: manifiesto existente verificado mediante SHA-256. Incluye commits de Git, no base de producción, sesiones ni configuración secreta.
- Analítica propia: recuentos agregados de visitas y clics Amazon solo tras aceptar. Sin GA4, Tag Manager o píxeles publicitarios externos. Rechazo, retirada, GPC/DNT comprobados. Los clics no representan ventas realizadas en Amazon.
- Imágenes de portada WebP con srcset/sizes y dimensiones; carga prioritaria de la imagen principal, cuya carga diferida perjudicaría el contenido inicial. Caché inmutable para recursos con huella de contenido.

## Rendimiento medido y límites

PageSpeed Insights API devolvió 429 por cuota compartida; no produjo una medición. Lighthouse local sobre la portada publicada anterior al cambio generó un informe JSON válido: rendimiento 95, accesibilidad 100, SEO 100, buenas prácticas 81; LCP 1,5 s, CLS 0,005, TBT 10 ms. Son mediciones de laboratorio, no INP ni datos de visitas reales. El proceso terminó con EPERM al limpiar su directorio temporal en Windows; el informe existe, pero no se considera una ejecución CLI completamente exitosa. La etiqueta de marca detectada se corrigió en este cambio. Los avisos de API obsoleta corresponden al script de seguridad del alojamiento; el tiempo inicial del servidor y la caché de navegación requieren revisar ese alojamiento, no desactivar protecciones de seguridad.

## No aplicable a esta web

El libro se compra en Amazon. No hay checkout, cobros, formulario de contacto o newsletter propios, ni correos de bienvenida/pedido/recuperación enviados por esta aplicación. No se ha realizado ninguna transacción de pago. La cuenta se autentica mediante Google. El enlace de Amazon sigue siendo el genérico solicitado hasta recibir la ficha real del libro.

## Pendiente del titular o del proveedor

- Enlace definitivo del libro en Amazon y pruebas de compra en su ficha.
- Copia periódica de D1 y ensayo de restauración de la base de producción. No se ha configurado ni verificado mediante las herramientas disponibles.
- Alta y propiedad verificada en Search Console/Bing; sitemap listo, no enviado en esta revisión.
- Recepción de alertas de UptimeRobot en correo/móvil.
- Prueba de alta completa con una cuenta Google externa nueva: consola verificada En producción/Usuarios externos en el turno anterior; selector de cuenta comprobado, acceso nuevo completo no realizado.
- Pruebas en Chrome, Firefox y Safari reales. Edge comprobado; no se encontró Chrome o Firefox instalados en sus rutas habituales. Safari no está disponible en Windows. No se presenta Edge como prueba de esos navegadores.
- Filtro global por IP del equipo no configurado. Elegir Solo necesarias en los navegadores de trabajo excluye sus eventos; GA4/Tag Manager requieren cuenta e identificador si se decide sustituir la analítica propia.
- Correo con dominio propio, contratos de tratamiento, garantías de transferencias, plazos de conservación del historial de moderación y permisos para participación de menores requieren validación del responsable. No se garantiza cumplimiento legal completo por pasar pruebas técnicas.

Referencia para revisar consentimiento y cookies: [Guía de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf). La política identifica a los proveedores reales del alojamiento. No se han borrado datos de personas ni contenido real de la comunidad.
