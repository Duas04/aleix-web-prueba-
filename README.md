# Donde siempre estuviste · Aleix

Código de la web del libro, con las versiones anteriores conservadas. El nombre Fumada XXL era provisional. Fuente activa: `49676fea9897eddc0e8133d377ed0c7f043c6e00`, 30 de septiembre de 2026.

| Carpeta | Estado | Contenido |
| --- | --- | --- |
| [web-actual](web-actual/) | Actual | Presentación ocre, enlace provisional a Amazon, comunidad Google preparada y zona privada de moderación/estadísticas. |
| [web](web/) | Archivo | Versión anterior de venta directa, carrito, pedidos y devoluciones. No se publica ni acepta cobros. |
| [presentacion](presentacion/) | Archivo | Demostración con pedidos, reembolsos y direcciones ficticias. Solo para ejecutar localmente. |

La web vigente es [prueba-aleix.com](https://prueba-aleix.com/), con [comunidad](https://prueba-aleix.com/comunidad). Las antiguas rutas de demo/devoluciones se han retirado. Las carpetas de archivo se conservan completas: no representan la tienda actual, ni la compra en Amazon.

## Ejecutar la versión actual

Node.js 24 o superior:

```sh
cd web-actual
node scripts/build-public.mjs
node --test tests/*.test.mjs
node scripts/preview-public.mjs
```

Abrir http://127.0.0.1:4188/. `node scripts/preview-public.mjs --owner` abre una prueba con cuenta ficticia en el puerto 4189. Su base es local y efímera. No incluye ni utiliza credenciales de Google reales.

## Pendientes reales

Falta la ficha final de Amazon y configurar las credenciales Google para activar la participación. Search Console, Bing, redes sociales y el alias www requieren verificación o datos del titular. La copia de código y vigilancia local no sustituyen una copia restaurable de la base D1.

Consulta [revisión y checklist](web-actual/docs/amazon-comunidad-2026-09-30.md) para las comprobaciones realizadas y las instrucciones de DNS. El código de acceso bloquea los permisos en servidor y no confía en alias ni roles del navegador.

## Código para leer o enviar a otra IA

[CODIGO-WEB-COMPLETO.txt](CODIGO-WEB-COMPLETO.txt) contiene el código de la versión actual en un único archivo de lectura. Las imágenes y fuentes están en el repositorio. No incluye secretos, cookies ni bases de datos con clientes.

## Versiones archivadas

- `node presentacion/serve.mjs` inicia la demo histórica en http://127.0.0.1:4180.
- La carpeta `web/` conserva la antigua tienda y sus pruebas/documentación. Sus textos comerciales no se aplican a la web actual.
- No publicar una versión archivada sobre el sitio actual por error. Este repositorio GitHub no despliega automáticamente el sitio.

Los datos profesionales del aviso legal fueron facilitados por el titular para publicarlos. No hay claves de API en este repositorio. No añadir archivos .env, contraseñas, sesiones ni datos de compradores.
