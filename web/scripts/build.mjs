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
assets['@returns']=assets['/devoluciones.html'];
if(!assets['@returns'])throw new Error('Customer returns portal missing');
assets['@returns'].noIndex=true;
for(const [file,key] of [['index.html','@admin'],['styles.css','/admin/styles.css'],['app.js','/admin/app.js']]) assets[key]={type:types[path.extname(file)],data:(await readFile('admin/'+file)).toString('base64')};
const liveUpdates=await readFile('admin/live-updates.js','utf8');
assets['/admin/app.js'].data=Buffer.from((await readFile('admin/app.js','utf8'))+'\n'+liveUpdates).toString('base64');
const database=await readFile('worker/database.mjs','utf8');
for(const key of ['/index.html','@returns']){let html=Buffer.from(assets[key].data,'base64').toString('utf8');html=html.replace(/<script src="\/demo-(?:session|checkout)\.js" defer><\/script>/g,'').replace('<link rel="stylesheet" href="/demo-session.css">','').replace('<a href="/demo" rel="nofollow">Demo del panel</a>','');assets[key].data=Buffer.from(html).toString('base64');}
assets['/returns.js'].data=Buffer.from(Buffer.from(assets['/returns.js'].data,'base64').toString('utf8').replace("const demo=new URLSearchParams(location.search).get('demo')==='1';","const demo=false;")).toString('base64');
for(const key of ['/demo-session.js','/demo-session.css','/demo-checkout.js'])delete assets[key];
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
const worker=(await readFile('worker/index.mjs','utf8')).replace(/^import .* from ['"]\.\/(?:database|returns|demo)\.mjs['"];?\s*$/gm,'');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',`${database}\n${returns}\n${demo}\n${worker}\nexport default createWorker(${JSON.stringify(assets)});\n`);
await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built Worker with ${Object.keys(assets).length} preserved resources.`);
