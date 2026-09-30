// Portable Windows-compatible packaging of an already built, committed Worker.
import {mkdtempSync,cpSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const archive=process.argv[2];
if(!archive||!path.isAbsolute(archive))throw new Error('Absolute archive path required');
const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
if(manifest.static||!existsSync('dist/server/index.js'))throw new Error('Build Worker first');
const worker=readFileSync('dist/server/index.js','utf8');
const match=worker.match(/\nexport default createPublicWorker\((\{[^\n]*\})\);\s*$/);
if(!match||!worker.includes('function createPublicWorker(')||/\nexport default createWorker\(/.test(worker))throw new Error('Public Worker build required; run npm run build');
let assets;
try{assets=JSON.parse(match[1]);}catch{throw new Error('Invalid public Worker asset table');}
const privateAssets=new Set(['/tienda-demo.html','/devoluciones.html','/returns.js','/shop.js','/cart.js','/propietario.html']);
if(Object.keys(assets).some(key=>key.startsWith('/admin')||key.startsWith('/demo')||privateAssets.has(key)||key.startsWith('@')&&key!=='@owner'))throw new Error('Private or demo asset in public Worker build');
const stage=mkdtempSync(path.join(tmpdir(),'fumada-worker-'));
mkdirSync(path.join(stage,'dist/server'),{recursive:true});
mkdirSync(path.join(stage,'dist/.openai'),{recursive:true});
cpSync('dist/server/index.js',path.join(stage,'dist/server/index.js'));
cpSync('.openai/hosting.json',path.join(stage,'dist/.openai/hosting.json'));
cpSync('drizzle',path.join(stage,'dist/.openai/drizzle'),{recursive:true});
const result=spawnSync('tar',['-C',stage,'-czf',archive,'dist'],{stdio:'inherit'});
if(result.status!==0)throw new Error('Archive failed');
console.log('Packaged Worker and generated D1 migrations.');
