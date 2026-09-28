import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
// Bundle the existing static bytes without changing public URLs or introducing third-party assets.
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const assets={};
async function walk(dir,prefix='') {
  for(const ent of await readdir(dir,{withFileTypes:true})) {
    if(ent.name==='server'||ent.name==='.openai') continue;
    const file=path.join(dir,ent.name), key=prefix+'/'+ent.name;
    if(ent.isDirectory()) await walk(file,key);
    else assets[key]={type:types[path.extname(file)]||'application/octet-stream',data:(await readFile(file)).toString('base64')};
  }
}
await walk('dist');
for(const [file,key] of [['index.html','@admin'],['styles.css','/admin/styles.css'],['app.js','/admin/app.js']]) assets[key]={type:types[path.extname(file)],data:(await readFile('admin/'+file)).toString('base64')};
const database=await readFile('worker/database.mjs','utf8');
const worker=(await readFile('worker/index.mjs','utf8')).replace(/^import .*database\.mjs';\s*/,'');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',`${database}\n${worker}\nexport default createWorker(${JSON.stringify(assets)});\n`);
await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built Worker with ${Object.keys(assets).length} preserved resources.`);
