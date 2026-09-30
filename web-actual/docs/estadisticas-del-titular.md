# Estadísticas del titular

El panel privado `/propietario` muestra la actividad agregada de la web. El acceso y la descarga CSV requieren una sesión de Google con permisos de dueño; el servidor vuelve a comprobarlos al descargar.

## Lectura de las cifras

- Periodos: hoy, últimos 7 días y últimos 30 días, incluido hoy.
- Comparación: el bloque inmediatamente anterior de igual duración. Hoy es un día incompleto; todas las fechas de agrupación están en UTC.
- Vistas y clics: eventos de quienes aceptaron la analítica. No representan personas únicas. Los clics hacia Amazon no confirman compras.
- Son señales orientativas: el tráfico automatizado puede alterar los recuentos. Los límites de frecuencia reducen el abuso, pero no certifican que cada evento corresponda a una persona.
- Relación clics / vistas: clics hacia Amazon divididos entre todas las vistas registradas. Puede superar el 100 % si una persona pulsa varias veces. El cambio de esta relación se expresa en puntos porcentuales; los cambios de los recuentos se expresan en porcentaje.
- Desglose: portada, comunidad e información legal, las categorías ya existentes. No se añaden identificadores de visitantes ni nuevas etiquetas de seguimiento.
- Comunidad: preguntas y respuestas creadas en el periodo que están publicadas al consultar. Una aprobación posterior puede modificar el recuento de un periodo anterior. Los pendientes representan la cola actual completa, sin filtro de fechas.

## CSV

El archivo contiene el detalle diario de ambos periodos, el desglose por apartado y los recuentos de comunidad y moderación. Usa UTF-8 con BOM y separador de punto y coma para abrirse en Excel. No contiene nombres, correos, mensajes, direcciones IP ni identificadores de cuentas.

## Verificación

Revisión del 30 de septiembre de 2026:

- 177 pruebas automáticas superadas, con regresiones de periodos, límites de fechas, pérdida de permisos, respuestas fuera de orden y CSV autorizado.
- Navegador Edge en anchuras 320, 390, 768 y 1440 px; filtros de 1, 7 y 30 días, estado vacío, gráficos con cifras de muestra, descarga CSV y pérdida de acceso.
- Sin errores JavaScript ni desbordamiento horizontal en las comprobaciones; axe no detectó infracciones WCAG A/AA en la sección de estadísticas.
- Las cifras usadas para revisar el gráfico se simularon exclusivamente en la vista local. No se introdujeron registros de prueba en producción.

La retención existente de métricas web es de 90 días; este cambio consulta como máximo los 60 días necesarios para comparar dos periodos de 30. No sustituye las estadísticas ni los informes de ventas de Amazon.
