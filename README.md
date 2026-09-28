# Fumada XXL · Aleix

Dos versiones separadas del trabajo del libro. Copia del código publicado el 28 de septiembre de 2026, commit de origen `1d233289c2d4c7e57bce6bbe263cd47fba604f40`.

| Carpeta | Contenido | Inicio local |
| --- | --- | --- |
| [presentacion](presentacion/) | Compra ficticia con número de pedido, devoluciones y panel sincronizados. Servidor Node con SQLite, cuatro ejemplos iniciales y sesiones de siete días. | `node presentacion/serve.mjs` → http://127.0.0.1:4180 |
| [web](web/) | Web de la tienda y panel privado, Worker, base D1, migraciones y pruebas. Excluye la demo pública. | `cd web`, `node scripts/build.mjs`, `node scripts/preview-admin.mjs` → http://127.0.0.1:4181 |

Necesitas Node.js 24 o superior. La presentación no necesita instalar dependencias. Para tareas con Drizzle en web: `pnpm install` (versión indicada en package.json).

## Estado de la venta

Tapa blanda 15 EUR, tapa dura 20 EUR, envío 7 EUR por pedido. Los cobros están desactivados. Stripe, webhooks, disponibilidad, plazos y operativa de venta siguen pendientes: ver [web/LEGAL-READINESS.md](web/LEGAL-READINESS.md). El reembolso de la presentación es ficticio y no ejecuta una devolución de dinero.

## Publicación actual

- Web: https://prueba-aleix.com/
- Demo: https://prueba-aleix.com/demo
- Compra ficticia: https://prueba-aleix.com/?demo=1
- Devoluciones ficticias: https://prueba-aleix.com/devoluciones?demo=1

Para mostrar los mismos pedidos en móvil y ordenador, inicia una demostración y usa **Copiar enlace para otro dispositivo**. Abrir sesiones nuevas crea ejemplos separados. Consulta [las instrucciones y cambios](DEMO-CONECTADA-2026-09-28.md) y [la revisión de las demostraciones](DEMO-REVISION-2026-09-28.md).

Esta organización para GitHub no cambia automáticamente la web publicada. El alojamiento actual mantiene ambas rutas; esta copia las separa para trabajar de forma independiente. No hay despliegue automático desde este repositorio.

## Contenido y seguridad

Se incluyen código, portada, fuentes y sus licencias, migraciones, pruebas y documentación. No se incluyen claves, sesiones, node_modules, bases con pedidos ni archivos de configuración secretos. Los datos profesionales del vendedor presentes en las páginas legales son los publicados por indicación del titular.

`web/.openai/hosting.json` identifica el alojamiento existente; no es una clave. No publicar la presentación sobre ese proyecto ni ejecutar despliegues sin revisar el destino. La autenticación privada depende de los encabezados de identidad confiables del alojamiento Sites y del secreto ADMIN_OWNER_EMAIL, que no se incluye. No alojar el panel privado como una página estática ni confiar en encabezados enviados directamente por visitantes.
