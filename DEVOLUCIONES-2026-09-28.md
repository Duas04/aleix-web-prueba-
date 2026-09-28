# Devoluciones: comprador y administración

El portal `/devoluciones` conecta las solicitudes del comprador con el panel privado. `/devoluciones?demo=1` permite probar el recorrido con datos ficticios y sin peticiones a la API.

## Funcionamiento

1. El comprador pide acceso indicando la referencia y el correo de un pedido existente. La respuesta pública es genérica para no revelar si existe.
2. El panel muestra las solicitudes de enlace pendientes. El vendedor prepara un enlace privado y abre un correo dirigido al email que ya consta en el pedido. Debe enviarlo desde su aplicación de correo: la web no envía emails automáticos.
3. El comprador utiliza ese enlace para registrar un desistimiento (sin motivo obligatorio) o una incidencia, consultar la respuesta y guardar un justificante de recepción.
4. El vendedor gestiona el estado, escribe una respuesta visible al comprador y, una vez aprobada la devolución, añade un transportista, código o etiqueta real obtenida del transportista.
5. El comprador descarga la etiqueta desde su expediente privado. Aprobar, recibir o cerrar la devolución no cambia el pago ni devuelve dinero.

Solicitar acceso no comunica por sí solo un desistimiento. Se mantiene el correo como vía directa para no hacer depender los plazos de recibir un enlace.

## Protección

- Enlaces aleatorios de 256 bits, huella SHA-256 en la base, vigencia de 30 días, sustitución y revocación desde el panel. El código se retira de la URL y se utiliza en memoria.
- El portal solo devuelve la información de devolución: no expone dirección, email, notas privadas ni resolución interna.
- Escrituras con comprobación de origen, acción, tamaño y versión del pedido; un cambio simultáneo no se sobrescribe silenciosamente.
- Límite de acceso por IP y referencia, con claves transformadas, ventanas de 15 minutos y limpieza acotada. Una IP bloqueada no sigue creando filas por referencias inventadas.
- PDF, PNG o JPEG de hasta 2 MiB, verificados en el servidor. Almacenamiento privado `FILES` en R2, descarga autenticada como adjunto y respuestas sin caché. No se aceptan enlaces externos arbitrarios ni SVG/HTML.
- Migración `0003_colossal_nehzno.sql` aditiva, sin datos de prueba, sin borrado o reconstrucción de pedidos.

## Comprobaciones

Pruebas de permisos, tokens, caducidad, revocación, validación, concurrencia, límites, cuotas, subida y descarga de etiquetas y separación de la demo. Recorrido de navegador local con un pedido ficticio: petición de acceso, enlace privado, desistimiento, aprobación, respuesta y etiqueta de prueba. Revisión visual en móvil y escritorio.

La revisión de seguridad encontró y corrigió el crecimiento de filas de cuotas bajo peticiones repetidas. La revisión del navegador también detectó y corrigió la apertura de un nuevo enlace privado cuando el portal ya estaba abierto.

## Pendientes para vender

Los pagos reales siguen deshabilitados; faltan la cuenta y la integración probada de pago y reembolsos. No hay proveedor de correo automático ni contrato/API de transportista. Este portal permite gestión manual y no genera un QR válido de transporte. El titular debe obtener la etiqueta del transportista y revisar los datos antes de adjuntarla.

Los textos de privacidad, cookies y condiciones describen el nuevo funcionamiento; esto no certifica un cumplimiento legal integral. Antes de abrir la venta siguen pendientes las condiciones operativas y la verificación de los requisitos legales de contratación, desistimiento y confirmaciones duraderas.
