# Revisión de seguridad, funcionamiento y diseño

30 de septiembre de 2026. Se mantiene «Donde siempre estuviste», su paleta ocre, tipografía y venta externa en Amazon. La tienda, las devoluciones y las demostraciones históricas continúan archivadas y excluidas del paquete público.

## Correcciones

- **Consultas de la comunidad:** se reprodujo un consumo excesivo de recursos en las lecturas anónimas. Un índice generado sobre conversación, estado y fecha evita recorrer reiteradamente las respuestas. La consulta sin texto omite la transformación de búsqueda que no necesita. Se conservan las tildes, la ordenación por actividad y las reglas de visibilidad.
- **Protección frente a consultas repetidas:** límite compartido de 120 lecturas por minuto y dirección de origen, y 30 búsquedas con texto. Cambiar filtros, orden o página no reinicia la cuota. Las respuestas de límite incluyen `Retry-After` y no se almacenan en caché.
- **Comunidad ante errores:** las conversaciones públicas siguen cargando si falla la consulta de cuenta. Cambiar filtros limpia resultados antiguos; fallar al cargar más conserva los ya válidos. Se puede reintentar una conversación cuyo primer intento falló y conservar el borrador.
- **Moderación:** lista paginada de aportaciones pendientes, con botón «Más aportaciones». Se probó una cola de 51 publicaciones en páginas de 20, 20 y 11, conservando el acceso privado.
- **Accesibilidad:** aceptar o rechazar el aviso inicial devuelve el foco al contenido, sin saltar al final de la página. Reabrir las preferencias devuelve el foco a su botón. La tabla de cookies puede recibir foco y desplazarse con teclado. Se amplían zonas táctiles de enlaces secundarios y legales.
- **Diseño y carga:** una hoja pública de unos 2 KB sustituye los estilos históricos de compra directa, de unos 12 KB. Colores legales coherentes con el ocre y pies de página sin líneas duplicadas. La composición general se conserva.
- **Publicación:** el empaquetado rechaza el Worker antiguo y recursos de tienda, carrito, devoluciones, demos o panel privado publicados como archivos ordinarios. La lista de recursos permitidos del generador sigue siendo el control principal.
- **Copias del código:** se inspeccionan los blobs versionados de todos los repositorios antes de generar archivos. Se rechazan tipos de archivo privados y patrones conocidos de credenciales, incluidos nombres Git con saltos de línea. Los manifiestos vacíos, duplicados o de alcance incorrecto no se dan por verificados. Esto reduce errores de copia; no es un detector infalible de secretos de cualquier formato.
- **Documentación:** se actualiza la guía de acceso del dueño con Google, se distingue la cookie OAuth de la cookie de sesión y se aclara que los contadores no acreditan personas ni compras reales.

## Evidencias

La reproducción usa una base local separada con 5.000 conversaciones, textos de 3.960 caracteres y el mismo programa antes y después. No se generó carga de ataque contra producción.

| Consulta | Antes | Después |
| --- | --- | --- |
| Lista por actividad, sin búsqueda | 12.899–16.382 ms | 15–35 ms |
| Búsqueda coincidente, página con desplazamiento 4.000 | 14.959–17.221 ms | 206–208 ms |
| Búsqueda sin coincidencias | 213–266 ms | 162–170 ms |
| 130 lecturas de una misma dirección en un minuto | Ningún límite | 10 respuestas 429 |

- `node --test tests/*.test.mjs`: 198 pruebas aprobadas, cero fallos. Incluye pruebas históricas y del código activo, OAuth simulado, permisos, privacidad, búsqueda, moderación, estadísticas y recursos publicados.
- `node scripts/build-public.mjs`: Worker con 37 recursos aprobados, sin tienda ni demo. Migración nueva `0009_blue_nova.sql`: únicamente un índice; no elimina datos.
- Edge con Playwright: nueve páginas en anchos 320, 390, 768 y 1440 px. Respuestas esperadas, sin desbordamiento horizontal ni excepciones JavaScript. Axe detectó una tabla desplazable sin foco en cookies; se corrigió y se repitió esa comprobación en ambos anchos afectados sin incidencias. El resto de las páginas no presentó incidencias automáticas en la revisión.
- Aviso de contenido enviado desde el diálogo y visible en el panel del dueño, con identidad ficticia y base local. La elección inicial de privacidad deja el foco en `main` y el desplazamiento en cero.
- Copia diaria existente: manifiesto y checksums verificados; se conserva una sola ejecución diaria. Es una copia anterior del código de ese día, no de la base de datos ni del estado de producción de esta publicación.
- Investigación previa y revisión independiente de los cambios por agentes de seguridad; revisión funcional y visual por agentes especializados. No se reproducen los fallos corregidos en las pruebas locales.

## Alcance y límites

El escaneo de Codex Security corresponde al código base `83f9566068b18cd846fb92c159650aafa81712c3`: 110 de 145 archivos leídos íntegramente para seguridad, con cobertura parcial explícita. Se revisaron la aplicación activa y sus fronteras de identidad, permisos, contenido, base de datos y publicación; se difirió el análisis interno de recursos binarios y de metadatos generados. El informe original se conserva y la corrección tiene un informe suplementario separado.

Se confirmó un problema de agotamiento de recursos; no se confirmó una vulneración de OAuth, permisos de dueño, inyección SQL, XSS o acceso a aportaciones privadas. Esto expresa el resultado de la revisión, no una garantía de ausencia de vulnerabilidades.

La búsqueda por subcadena todavía recorre las conversaciones y la ordenación depende del tamaño del conjunto. El índice y las cuotas resuelven la reproducción observada; un volumen mucho mayor puede requerir búsqueda de texto completo, paginación por cursor y medidas del proveedor. La paginación conserva el límite histórico de desplazamiento de 10.000.

No se verificaron una restauración real de D1, permisos de infraestructura, la consola de Google ni una cuenta Google ajena al titular. Las comprobaciones de navegador se hicieron en Edge y tamaños simulados; Safari, Firefox y teléfonos físicos quedan fuera de esta validación. No se afirma una puntuación de Core Web Vitals ni una auditoría jurídica certificada.

Se usaron las herramientas pertinentes al proyecto. Supabase no forma parte de esta arquitectura D1; no se ejecutó un pentest externo de Strix ni se habilitaron créditos adicionales. Los contadores anónimos pueden incluir tráfico automatizado que no llegue a los límites y no equivalen a conversiones verificadas en Amazon.
