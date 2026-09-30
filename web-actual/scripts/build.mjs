import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
// Bundle the existing static bytes without changing public URLs or introducing third-party assets.
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.xml':'application/xml; charset=utf-8','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const assets={};
async function walk(dir,prefix='') {
  for(const ent of await readdir(dir,{withFileTypes:true})) {
    if(ent.name==='server'||ent.name==='.openai') continue;
    const file=path.join(dir,ent.name), key=prefix+'/'+ent.name;
    // Original image and unused TTF sources stay in Git, not in the deployed Worker.
    if(key==='/assets/fumada-xxl-aleix.png'||key.startsWith('/assets/fonts/')&&key.endsWith('.ttf'))continue;
    if(ent.isDirectory()) await walk(file,key);
    else assets[key]={type:types[path.extname(file)]||'application/octet-stream',data:(await readFile(file)).toString('base64')};
  }
}
await walk('dist');
assets['@demoStore']=assets['/tienda-demo.html'];
delete assets['/tienda-demo.html'];
assets['@returns']=assets['/devoluciones.html'];
if(!assets['@returns'])throw new Error('Customer returns portal missing');
assets['@returns'].noIndex=true;
for(const [file,key] of [['index.html','@admin'],['styles.css','/admin/styles.css'],['app.js','/admin/app.js']]) assets[key]={type:types[path.extname(file)],data:(await readFile('admin/'+file)).toString('base64')};
const liveUpdates=await readFile('admin/live-updates.js','utf8');
assets['/admin/app.js'].data=Buffer.from((await readFile('admin/app.js','utf8'))+'\n'+liveUpdates).toString('base64');
const database=await readFile('worker/database.mjs','utf8');
const adminHtml=await readFile('admin/index.html','utf8');
const demoRefund=await readFile('admin/demo-refund.html','utf8');
const demoHtml=adminHtml.replace('/admin/app.js','/demo/app.js')
  .replace('<script src="/demo/app.js"','<meta name="referrer" content="no-referrer"><link rel="stylesheet" href="/demo-session.css"><script src="/demo-session.js" defer></script><script src="/demo/app.js"')
  .replace('<title>Mis pedidos · Fumada XXL</title>','<title>Demo del panel · Fumada XXL</title>')
  .replace('<body>','<body class="demo-page">')
  .replaceAll('Mis pedidos','Pedidos de ejemplo').replaceAll('Tus pedidos','Lista de pedidos')
  .replaceAll('ÁREA PRIVADA','DEMO PÚBLICA').replaceAll('href="/admin"','href="/demo"')
  .replace('href="/signout-with-chatgpt?return_to=%2F" target="_top">Cerrar sesión','href="/">Volver al libro')
  .replace('El cobro todavía no está conectado</h2>','Demostración · Todos los datos son ficticios</h2>')
  .replace('Este es tu espacio privado para gestionar las ventas. Cuando activemos el pago, aquí aparecerán los pedidos y los datos de envío. Ahora la web no acepta compras.','La compra, las devoluciones y este panel comparten la misma demostración durante 7 días. Abre su enlace en el móvil o el ordenador. Los cambios se actualizan cada pocos segundos; no se realizan pagos ni reembolsos reales.')
  .replace('<span class="badge neutral">Pendiente de Stripe</span>','<div class="demo-actions"><button class="button" id="demo-start" type="button">Probar un pedido</button><button class="secondary" id="demo-return" type="button">Probar una devolución</button><button class="secondary" id="demo-refund" type="button">Ver un reembolso</button><button class="secondary" id="demo-reset" type="button">Reiniciar demo</button></div>')
  .replace('Reiniciar demo</button>','Nueva demostración</button>')
  .replace('Pendiente de Stripe</span>','DATOS DE EJEMPLO</span>')
  .replace('Solo tu cuenta puede ver los datos de los compradores.','Demo pública sin conexión con los pedidos de la tienda.')
  .replace('DETALLE DEL PEDIDO','PEDIDO FICTICIO · DEMOSTRACIÓN')
  .replace('<strong>El enlace se envía manualmente.</strong> Prepararlo no envía un correo. Caduca en 30 días y generar uno nuevo invalida el anterior. Compártelo solo con el correo de compra de este pedido.','Este enlace abre la devolución ficticia en la misma demostración. Permite gestionar sus pedidos a quien lo reciba y caduca con la sesión, 7 días después de crearla. No se envían correos.')
  .replace('Se abrirá tu aplicación de correo. Revisa el destinatario y confirma el envío allí.','Abre el enlace en otro dispositivo para mostrar el recorrido del comprador.')
  .replace('Preparar enlace privado','Preparar enlace de prueba').replace('Enlace privado del comprador','Enlace compartido de prueba')
  .replace('<p id="payment-note" class="payment-note"></p>',demoRefund+'<p id="payment-note" class="payment-note"></p>')
  .replace('Confirmo que he entregado este pedido al transportista.','Quiero simular el envío de este pedido ficticio.')
  .replace('Marcar como enviado</button>','Simular envío</button>')
  .replace('Adjunta la etiqueta que hayas preparado con el transportista. Este panel no genera etiquetas ni códigos QR. Se admite PDF, PNG o JPEG de hasta 2 MiB.','Activa una etiqueta de ejemplo para mostrar la descarga en el portal del comprador. No es válida para envíos y no se suben archivos personales.')
  .replace('<label for="return-label-file">Archivo para el comprador</label><input id="return-label-file" name="label" type="file" accept="application/pdf,image/png,image/jpeg"><button class="button" type="submit">Adjuntar etiqueta</button>','<input id="return-label-file" name="label" type="file" hidden disabled><button class="button" type="button" id="demo-label">Añadir etiqueta de ejemplo</button>');
const sharedApp=await readFile('admin/app.js','utf8');
const apiStart=sharedApp.indexOf('async function api('),apiEnd=sharedApp.indexOf('function cell(');
if(apiStart<0||apiEnd<apiStart)throw new Error('Cannot isolate demo transport');
const demoApp=(await readFile('admin/demo-shared.js','utf8'))+'\n'+sharedApp.slice(0,apiStart)+'async function api(path,options={}) { return demoApi(path,options); }\n'+sharedApp.slice(apiEnd)+'\n'+await readFile('admin/demo-shared-controls.js','utf8')+'\n'+liveUpdates;
const demoScript=demoApp.replaceAll('Pago confirmado por la pasarela. Puedes preparar este pedido.','Pago simulado: este pedido es ficticio.').replaceAll('Pago confirmado por la pasarela. Este pedido ya está enviado.','Pago simulado: este pedido ficticio figura como enviado.').replaceAll('Pago confirmado. Hay una devolución activa:','Pago simulado. Hay una devolución activa:').replaceAll('Pedido marcado como enviado.','Envío simulado. No se ha modificado ningún pedido real.')
  .replace("'Pago reembolsado. No prepares un envío.'","'Reembolso total simulado de '+money(order.total)+' por recibir el libro en mal estado. Incluye el libro y los gastos de envío. No se ha devuelto dinero real.'");
if(/\bfetch\s*\(/.test(demoScript))throw new Error('Demo must not call network APIs');
assets['/demo']={type:types['.html'],data:Buffer.from(demoHtml).toString('base64'),noIndex:true};
assets['/demo/']=assets['/demo'];
assets['/demo/app.js']={type:types['.js'],data:Buffer.from(demoScript).toString('base64')};
// Hash once at build time; unchanged public files can revalidate without downloading again.
for(const [key,asset] of Object.entries(assets)) {
  asset.etag=`W/"${createHash('sha256').update(Buffer.from(asset.data,'base64')).digest('hex')}"`;
  asset.immutable=/^\/assets\/fumada-xxl-\d+-[a-f0-9]{12}\.webp$/.test(key);
}
const originalCover=Object.keys(assets).find(key=>/^\/assets\/fumada-xxl-1536-[a-f0-9]{12}\.webp$/.test(key));
if(!originalCover)throw new Error('Optimized cover missing');
assets['/assets/fumada-xxl-aleix.png']={redirect:originalCover};
const returns=(await readFile('worker/returns.mjs','utf8')).replace(/^import .* from ['"]\.\/database\.mjs['"];?\s*$/gm,'');
const demo=(await readFile('worker/demo.mjs','utf8')).replace(/^import .* from ['"]\.\/database\.mjs['"];?\s*$/gm,'');
const community=(await readFile('worker/community.mjs','utf8')).replace(/^import .* from ['"]\.\/database\.mjs['"];?\s*$/gm,'');
const worker=(await readFile('worker/index.mjs','utf8')).replace(/^import .* from ['"]\.\/(?:database|returns|demo|community)\.mjs['"];?\s*$/gm,'');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',`${database}\n${returns}\n${demo}\n${community}\n${worker}\nexport default createWorker(${JSON.stringify(assets)});\n`);
await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built Worker with ${Object.keys(assets).length} preserved resources.`);
