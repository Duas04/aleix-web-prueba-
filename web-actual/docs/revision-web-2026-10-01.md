# Revisión de código y web · 1 de octubre de 2026

Base revisada: `36ac0bf60b192d05588f3c0b8ccfe2205c11eedd`. Esta revisión continúa la auditoría del 30 de septiembre y conserva el diseño ocre, la venta mediante Amazon y la comunidad con Google. No modifica los permisos del titular ni la base de datos de producción.

## Correcciones y mejoras

- **Avisos de moderación:** el panel antes recuperaba únicamente los primeros 50. Ahora muestra tandas de 20 con «Más avisos» y un cursor estable por fecha e identificador. Resolver un aviso anterior no salta los siguientes. Tras resolver, recupera las páginas que estaban abiertas. Conserva los borradores, evita duplicados y permite reintentar errores sin vaciar las tarjetas. La pérdida de permisos limpia el contenido privado.
- **Carga del panel:** mensajes de carga, `aria-busy` y controles coherentes cuando coinciden una carga y una decisión. Los errores ofrecen un reintento sin presentar una lista vacía como resultado correcto.
- **Conversaciones:** respuestas de 20 en 20, en lugar de 50 cuerpos por petición. El cliente usa el mismo tamaño. Los offsets superiores a 10.000 se rechazan de forma explícita; la última página permitida no anuncia una siguiente que repetiría los mismos datos.
- **Estadísticas:** las respuestas publicadas bajo una pregunta retirada ya no cuentan como conversación pública. La cola de moderación conserva su significado propio.
- **Privacidad con teclado:** el aviso aparece en el orden del documento inmediatamente después de «Saltar al contenido». No roba el foco al cargar. Su primera elección mantiene el foco en el contenido sin desplazar la página; la reapertura conserva el retorno al botón de preferencias.
- **Copias del código:** inspección, nombre del ZIP, manifiesto y archivo usan el mismo commit capturado. Una prueba reprodujo que, si cambiaba `HEAD` entre la inspección y el archivado, antes se podían copiar archivos distintos de los examinados. Ahora toda la operación queda ligada al SHA inspeccionado. Esto protege las copias de código; no constituye una copia de la base de datos de producción.

## Verificación

- `node --test tests/*.test.mjs`: **213 pruebas aprobadas**, sin fallos ni omisiones. Incluye pruebas históricas archivadas; no significa que la antigua tienda vuelva a publicarse.
- `node scripts/build-public.mjs`: Worker público generado con 37 recursos; tienda, demos y devoluciones excluidas.
- `git diff --check`: correcto.
- Revisión independiente de seguridad de OAuth, sesiones, roles, publicaciones, avisos, estadísticas, rutas, CSP y empaquetado; revisión adicional de las nuevas carreras y cursores. No se encontró un bypass reproducible en los cambios revisados. No es una garantía de ausencia de vulnerabilidades.
- Inspección visual de la portada y comunidad publicadas. Prueba del build local en Edge a 320, 390, 768 y 1440 píxeles para portada, comunidad, propietario, privacidad, cookies, aviso legal, información de Amazon, normas y 404: 36 combinaciones, sin desbordamientos horizontales ni errores JavaScript; sin incidencias detectadas por axe en las reglas WCAG A/AA utilizadas. La 404 respondió con su estado correcto.
- Prueba funcional en una base local sintética: 22 respuestas se recuperan en páginas de 20 y 2; un aviso nuevo llega al panel, que permite recorrer 52 avisos, resolver uno y conservar otro borrador. El total final es 51. No se enviaron avisos ni decisiones a producción.
- Teclado en navegador: primero el enlace de salto, luego «Solo necesarias»; después de elegir, foco en `MAIN` y desplazamiento cero.

## Alcance y límites

No se ejecutaron compras reales: el enlace de Amazon sigue siendo provisional y la venta ocurre fuera de esta web. El acceso real con Google, su consola, los correos, las copias de datos del alojamiento y las alertas externas no se reconfiguraron en esta revisión. No se verificaron Safari ni Firefox, ni se obtuvo una medición de Core Web Vitals de visitantes reales. Las comprobaciones de accesibilidad automáticas no sustituyen una revisión humana completa.

El endpoint privado de avisos añade `hasMore` y `nextCursor`, conserva `reports` y comprueba el rol en cada petición. Se publica junto con el cliente que entiende este contrato; no requiere migraciones ni nuevos secretos.
