# Comunidad, equipo y moderación

- Acceso privado mediante sesión Google; las cabeceras de identidad de la plataforma ya no autorizan el panel ni las estadísticas.
- La cuenta principal ya vinculada conserva sus permisos. Solo ella concede o retira permisos de dueño a cuentas que hayan entrado con Google. Confirmación de identidad y registro de cambios. Los demás dueños moderan y consultan estadísticas, pero no delegan acceso.
- Migraciones Drizzle aditivas 0007 y 0008: equipo, auditoría de permisos, destino OAuth limitado y avisos privados. Conservan usuarios, sesiones, publicaciones y datos existentes.
- Búsqueda con tildes, actividad reciente, contador de respuestas públicas, enlaces a conversaciones y aviso de novedades cada 30 segundos mientras el hilo esté abierto y visible. Actualizar conserva el borrador.
- Preguntas y respuestas de lectores requieren revisión previa. Los dueños aprueban o retiran con motivo. Se conserva historial privado.
- Avisar de un problema abre un formulario interno. Requiere sesión Google; el visitante sin cuenta ve instrucciones y el contacto alternativo. Avisos privados, límite de frecuencia, sin duplicar avisos pendientes de una misma cuenta sobre el mismo mensaje. Los dueños revisan y cierran con una decisión.
- Pruebas automatizadas: permisos, CSRF, identidad Google, retornos OAuth, revocación inmediata, búsqueda, privacidad de avisos, resolución e historial. Verificación local con Edge: móvil 390px, envío/revisión de avisos, retirada de respuesta, concesión y retirada de permisos, conservación de borradores.
- Las pruebas de interfaz usan exclusivamente cuentas y publicaciones sintéticas del servidor local; no se incorporan al Worker publicado.

## Uso

1. Entrar con Google en `/comunidad`.
2. Dueño: abrir «Gestionar comunidad y equipo» o `/propietario`.
3. Principal: buscar el correo de una cuenta existente y confirmar «nuevo dueño». No se conceden permisos a correos que todavía no hayan entrado.
4. Moderación: revisar pendientes en `/comunidad?moderar=1`; consultar avisos e historial en el panel.

El estado de publicación del cliente OAuth en Google Cloud sigue siendo una configuración externa. No se cambia ni se prometen accesos de usuarios no habilitados en modo de pruebas.
