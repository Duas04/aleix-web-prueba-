# Revisión de Donde siempre estuviste

30 de septiembre de 2026. Alcance final: presentación del libro, compra externa en Amazon, comunidad Google y controles privados del dueño. Conservar la composición y tipografía con acentos ocre. Retirar la venta directa del sitio publicado y conservarla en GitHub.

## Implementado

- Título definitivo en portada, cabeceras, metadatos, datos estructurados y documentos. Nueva propuesta visual ocre; tres imágenes WebP de unos 44, 85 y 119 KB y tarjeta social JPG de 156 KB.
- Una acción principal, Ir a Amazon. Por petición del titular abre la página general de Amazon España y avisa de que todavía no es la ficha del libro. Sin precios, pedidos, cobros o disponibilidad inventados.
- Comunidad adaptable: alias, temas, respuestas, avisos, moderación previa, insignia Dueño y retirada de aportaciones. No hay mensajes de demostración publicados ni distintivos falsos de compra verificada.
- Autenticación preparada: Google OAuth con PKCE, state de un uso ligado al navegador, nonce, firma/emisor/audiencia/caducidad comprobados. Sesiones HttpOnly/Secure con hash en D1. Vinculación de dueño solo desde una identidad titular ya autorizada y sesión Google. El correo y el identificador Google nunca se muestran al público.
- Formularios con validación de tamaños, protección de origen, honeypot y cuotas por cuenta/IP; máximo atómico de cinco aportaciones pendientes por lector. Errores de paginación conservan página y borradores. Los errores de acceso siguen visibles.
- Analítica propia voluntaria: contadores diarios de vistas y clics Amazon/WhatsApp, retirada de consentimiento, DNT/GPC, retención de 90 días con limpieza al recibir tráfico. No mide ventas ni personas únicas. Estadísticas solo en el área privada.
- Aviso legal, privacidad, cookies, información de compra externa y normas de comunidad adaptados. Correo/teléfono tocables, acceso a WhatsApp, redes marcadas Próximamente sin inventar perfiles.
- SEO: títulos/descripciones, Book y WebSite sin ofertas inventadas, canonical, sitemap, robots, favicon y vista previa al compartir. Páginas públicas indexables; controles privados y errores noindex.
- HTTPS y dominio canónico; redirecciones permanentes de duplicados conocidos. 404 personalizada. La demo devuelve 410; devoluciones redirige a información de Amazon; admin redirige al nuevo espacio privado. Las antiguas API de venta/dev/demo no se incluyen en el Worker.
- Recursos locales, imágenes responsivas, fuentes comprimidas con nombre versionado, ETag/304 y caché larga para recursos inmutables. Cabeceras CSP, HSTS, no-sniff y no-store para datos privados.
- Vigilancia horaria de portada y base de datos y copia diaria del código programadas en Codex. Solo avisos por caída confirmada, recuperación o fallo. Requiere equipo y Codex disponibles. No equivale a monitor externo permanente ni a copia de D1.

## Accesos o decisiones pendientes del titular

| Elemento | Situación y siguiente paso |
| --- | --- |
| Google para la comunidad | Faltan ID y secreto del cliente Google. Origen de producción configurado; participación bloqueada hasta activarlos. Validar consentimiento de Google y un inicio de sesión real. |
| Amazon | Falta URL de la ficha. El botón provisional es deliberado. |
| Search Console / Bing Webmaster | No se ha verificado la propiedad en esas cuentas. Requieren acceso del titular y token/registro DNS emitido por cada servicio. Sitemap preparado; no afirmar que se ha enviado. |
| Ficha de Google | No crear una ubicación ficticia. Google exige atención presencial para una ficha de empresa; una actividad solo online no cumple ese criterio. Confirmar elegibilidad con el titular. |
| Redes | Faltan perfiles reales. Solo hay indicación Próximamente, sin enlaces a cuentas ajenas. |
| Copia y restauración de datos | Código archivado y copia local programada. Falta confirmar y probar restauración de la base D1 con el proveedor antes de abrir cuentas reales. |
| SSL | El dominio de Sites devuelve SSL activo. Lo gestiona el alojamiento; no se ha simulado una renovación ni verificado un ciclo futuro. |
| Legal y operativa | Confirmar que los datos profesionales proporcionados siguen siendo los del titular, contratos/transferencias de proveedores, política para menores, atención de derechos y conservación de moderación antes de activar la comunidad. No se presenta esta revisión técnica como certificación jurídica. |

## Evidencias y límites

Las pruebas automáticas cubren la aplicación activa y conservan además la suite histórica de tienda/demo para proteger el archivo. Las de Google simulan respuestas firmadas y endpoints; no prueban credenciales reales. La vista local utiliza una base efímera separada, nunca datos de producción.

La revisión visual incluye la portada y comunidad en escritorio y a 390 px; las pruebas de pantalla no equivalen a probar un teléfono físico. No se afirma una puntuación Lighthouse ni una comprobación de Safari si no se ha realizado. Las rutas, enlaces y recursos internos se comprueban automáticamente contra el Worker compilado.

## Referencias primarias consultadas

- [Guía de cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf): elección informada y retirada accesible.
- [LSSI, texto consolidado del BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758): información del titular y servicios en línea.
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect): autenticación e identidad.
- [Elegibilidad de Google Business Profile](https://support.google.com/business/answer/13763036): requisito de contacto presencial.

## Archivo

GitHub mantiene `presentacion/` y `web/` como versiones históricas. `web-actual/` recoge este proyecto. Publicar esta versión no borra pedidos históricos de la base, ni hace una migración de compras a Amazon. Las funciones de compra directa quedan fuera del paquete que se sirve al público.

### Resultado de la comprobación local

- 155 pruebas automatizadas aprobadas, incluidas las de privacidad, seguridad, OAuth simulado y rutas activas.
- Edge: portada, comunidad y privacidad sin desbordamiento en anchos 320, 390, 768 y 1440 px. Axe (WCAG 2 A/AA y 2.1 AA) sin incidencias detectadas en esas tres páginas a 1440 px. Esto no sustituye una auditoría manual completa.
- Publicación/respuesta y conservación del borrador tras error comprobados con identidad ficticia en base local separada.
- Navegación adicional revisada en el navegador integrado de Codex (Chromium). Se intentó Firefox con Playwright, pero Windows no permitió iniciar su ejecutable; Firefox y Safari quedan sin verificar.

### Activación de www pendiente de DNS

El dominio principal tiene SSL activo. Se ha solicitado el alias `www.prueba-aleix.com`; aún requiere validar estos registros en IONOS antes de que pueda aplicar la redirección al dominio sin www. No modificar registros de correo.

| Tipo | Nombre en IONOS | Valor |
| --- | --- | --- |
| CNAME | www | custom-domains.chatgpt.site. |
| TXT | _openai-site-verification.www | openai-site-verification=N2lmZcCff_TXvuxyTkjXVbQ-3Td4CoD7N41URoLYgP0 |
| TXT | _cf-custom-hostname.www | 681f3b72-ce18-41ad-a0f5-cdd8c29947d0 |

Si existe un registro A de www, se sustituye por ese CNAME; los TXT anteriores son datos de validación del dominio, no contraseñas. Tras guardarlos, comprobar el estado del alias y SSL en Sites. El dominio principal funciona independientemente de este alias.

### Compatibilidad de seguridad del alojamiento

La comprobación publicada detectó que Cloudflare añade su script de protección contra bots después del Worker. Se incorpora un nonce CSP aleatorio por respuesta para que Cloudflare pueda autorizar únicamente su inyección documentada. No se usa unsafe-inline ni unsafe-eval. El HTML no se reutiliza mediante caché o respuestas 304; fuentes, imágenes y recursos estáticos conservan su caché. Referencia: https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/#if-you-have-a-content-security-policy-csp.

La política de cookies identifica también la comprobación de seguridad de Cloudflare y su posible cookie técnica cf_clearance, sin inventar una duración que depende del proveedor.

### Verificación publicada

La versión publicada con CSP por respuesta se comprobó en Edge: portada y comunidad sin errores de consola, peticiones fallidas ni violaciones CSP observadas. Google indica que falta configuración, sin simular una sesión. Las 13 comprobaciones HTTP de rutas públicas, salud de D1 y retirada de endpoints antiguos dieron el resultado esperado.

Se observaron solo nombres/atributos (nunca se guardaron valores) de tres cookies del alojamiento: __Host-appgarden-visitor, de 90 días; __cf_bm, de 30 minutos; cf_clearance, con caducidad de un año. El inventario público las recoge. Antes de abrir cuentas reales, confirmar con Sites la finalidad jurídica y clasificación del identificador de visitante y la configuración/retención de las cookies del proveedor; nuestra elección de analítica controla únicamente los eventos propios de la web, no la infraestructura del alojamiento.

### Ajuste de compartir el enlace

Por aclaración del titular, se retiran el botón flotante y los enlaces de contacto por WhatsApp. Se conserva la portada ocre como imagen Open Graph/JPEG de 1200 × 900 y se completan los metadatos para compartir título, descripción e imagen. La vista final depende de la aplicación que recibe el enlace y de su caché.
