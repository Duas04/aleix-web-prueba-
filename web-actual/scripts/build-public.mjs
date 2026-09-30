import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.xml':'application/xml; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const assets={};
// Only approved public resources enter the bundle. A stray export or secret in
// dist must never become a publicly accessible asset.
const publicFiles=new Set(['index.html','404.html','acceso-restringido.html','comunidad.html','aviso-legal.html','privacidad.html','cookies.html','condiciones-de-venta.html','normas-comunidad.html','app.js','community.js','owner.js','privacy-controls.js','styles.css','community.css','book-layout.css','legal.css','site-updates.css','fonts.css','favicon.svg','robots.txt','sitemap.xml']);
const publicAsset=key=>publicFiles.has(key.slice(1))||/^\/assets\/donde-siempre-estuviste-(?:\d+-[a-f0-9]{12}\.webp|social-[a-f0-9]{12}\.jpg)$/.test(key)||/^\/assets\/fonts\/(?:font-[1-7]\.woff2|(?:playfairdisplay|manrope|dmsans)-OFL\.txt)$/.test(key);
async function walk(dir,prefix=''){for(const ent of await readdir(dir,{withFileTypes:true})){
 if(['server','.openai'].includes(ent.name))continue;
 const key=prefix+'/'+ent.name,file=path.join(dir,ent.name);
 if(ent.isDirectory()){if(key==='/assets'||key==='/assets/fonts')await walk(file,key);}else if(publicAsset(key))assets[key]={type:types[path.extname(file)],data:(await readFile(file)).toString('base64')};
}}
await walk('dist');assets['@owner']={type:types['.html'],data:(await readFile('dist/propietario.html')).toString('base64')};
// Fingerprint fonts as well as images so long-lived cache entries cannot go stale.
const fontPaths=[];
for(const key of Object.keys(assets).filter(key=>key.endsWith('.woff2'))){const asset=assets[key];const hash=createHash('sha256').update(Buffer.from(asset.data,'base64')).digest('hex').slice(0,12);const versioned=key.replace('.woff2','-'+hash+'.woff2');assets[versioned]=asset;delete assets[key];fontPaths.push([key.slice(1),versioned.slice(1)]);}
for(const asset of Object.values(assets).filter(asset=>/text\/(html|css)/.test(asset.type))){let content=Buffer.from(asset.data,'base64').toString('utf8');for(const [before,after]of fontPaths)content=content.replaceAll(before,after);asset.data=Buffer.from(content).toString('base64');}
for(const [key,asset]of Object.entries(assets)){const bytes=Buffer.from(asset.data,'base64');asset.etag=`W/"${createHash('sha256').update(bytes).digest('hex')}"`;asset.immutable=/^\/assets\/.*-[a-f0-9]{12}\.(?:webp|jpg|woff2)$/.test(key);const json=bytes.toString('utf8').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];asset.jsonLdHash=createHash('sha256').update(json||'').digest('base64');}
const modules=[];for(const name of ['database','community','metrics','site'])modules.push((await readFile('worker/'+name+'.mjs','utf8')).replace(/^import .* from ['"]\.\/[^'"]+['"];?\s*$/gm,''));
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/server/index.js',modules.join('\n')+'\nexport default createPublicWorker('+JSON.stringify(assets)+');\n');await cp('.openai/hosting.json','dist/.openai/hosting.json');console.log(`Built public book/community Worker with ${Object.keys(assets).length} resources; shop/demo excluded.`);
