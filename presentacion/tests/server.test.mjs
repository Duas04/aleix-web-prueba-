import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,cp,readFile,readdir,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startPresentationServer } from '../serve.mjs';

const exportRoot=fileURLToPath(new URL('../',import.meta.url));
const cleanups=new WeakMap();
const cleanup=(t,fn)=>cleanups.get(t).push(fn);
async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'fumada-export-test-'));
  const resources=[];cleanups.set(t,resources);
  t.after(async()=>{for(const close of resources.reverse())await close();if(!path.resolve(root).startsWith(path.join(tmpdir(),'fumada-export-test-')))throw new Error('Unexpected test directory');await rm(root,{recursive:true,force:true});});
  const backend=process.env.DEMO_TEST_BACKEND_ROOT?path.resolve(exportRoot,process.env.DEMO_TEST_BACKEND_ROOT):exportRoot;
  await mkdir(path.join(root,'worker'));await mkdir(path.join(root,'public','demo'),{recursive:true});await mkdir(path.join(root,'drizzle'));
  await cp(path.join(backend,'worker','demo.mjs'),path.join(root,'worker','demo.mjs'));await cp(path.join(backend,'worker','database.mjs'),path.join(root,'worker','database.mjs'));
  const migrations=(await readdir(path.join(backend,'drizzle'))).filter(n=>n.endsWith('.sql')).sort();
  for(const name of migrations){const sql=await readFile(path.join(backend,'drizzle',name),'utf8');await writeFile(path.join(root,'drizzle',name),sql);}
  await writeFile(path.join(root,'public','index.html'),'<!doctype html><title>COMPRA FICTICIA</title>');await writeFile(path.join(root,'public','demo','index.html'),'<!doctype html><title>PANEL FICTICIO</title>');await writeFile(path.join(root,'public','devoluciones.html'),'<!doctype html><title>DEVOLUCIONES FICTICIAS</title>');
  await writeFile(path.join(root,'public','app.js'),'window.fictional=true;');
  return root;
}
async function start(t,root,extra={}){
  const running=await startPresentationServer({rootDir:root,port:0,...extra});assert.ok(running,'Server must start');cleanup(t,()=>running.close());return running;
}
const headers=origin=>({origin,'content-type':'application/json','x-demo-action':'session'});
const create=async origin=>fetch(origin+'/api/demo/session',{method:'POST',headers:headers(origin),body:'{}'});
async function raw(origin,method='GET',extra={},chunks=[]){
  return new Promise((resolve,reject)=>{const req=http.request(origin,{method,headers:extra},res=>{const body=[];res.on('data',chunk=>body.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(body).toString()}));});req.on('error',reject);for(const chunk of chunks)req.write(chunk);req.end();});
}

test('HTTP serves only public presentation routes and activates the connected demo with safe redirects',async t=>{
  const root=await fixture(t),{origin}=await start(t,root);
  for(const pathname of ['/','/devoluciones','/devoluciones.html']){
    const response=await fetch(origin+pathname+'?from=test',{redirect:'manual'});assert.equal(response.status,302);const target=new URL(response.headers.get('location'),origin);assert.equal(target.searchParams.get('demo'),'1');assert.equal(target.searchParams.get('from'),'test');
  }
  for(const [pathname,marker] of [['/?demo=1','COMPRA FICTICIA'],['/demo','PANEL FICTICIO'],['/devoluciones?demo=1','DEVOLUCIONES FICTICIAS']]){
    const response=await fetch(origin+pathname);assert.equal(response.status,200);assert.ok((await response.text()).includes(marker));assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    const head=await fetch(origin+pathname,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  assert.equal((await fetch(origin+'/app.js')).headers.get('content-type'),'text/javascript; charset=utf-8');
});

test('real administration, real return APIs, backend files and database files are never exposed',async t=>{
  const root=await fixture(t),{origin}=await start(t,root);
  for(const pathname of ['/admin','/admin/','/admin/index.html','/admin/app.js','/api/admin/orders','/api/returns/access','/worker/demo.mjs','/drizzle/0000.sql','/.data/presentation.sqlite','/package.json','/%2e%2e/worker/database.mjs','/%5c..%5cworker%5cdatabase.mjs'])assert.equal((await fetch(origin+pathname)).status,404,pathname);
  const db=new DatabaseSync(path.join(root,'.data','presentation.sqlite'));cleanup(t,()=>db.close());assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM admin_owner').get().n,0);
});

test('HTTP demo persists across restarts, synchronizes purchase and return, and never writes real orders',async t=>{
  const root=await fixture(t),first=await start(t,root);const sessionResponse=await create(first.origin);assert.equal(sessionResponse.status,200);const {token}=await sessionResponse.json();
  const purchase=await fetch(first.origin+'/api/demo/orders',{method:'POST',headers:{...headers(first.origin),'x-demo-action':'purchase','x-demo-session':token},body:JSON.stringify({items:{paperback:1,hardcover:1},requestId:randomUUID()})});assert.equal(purchase.status,200);const {order}=await purchase.json();assert.equal(order.total,4200);
  await first.close();const second=await start(t,root);
  const detail=await fetch(second.origin+'/api/demo/admin/orders/'+order.id,{headers:{'x-demo-session':token}});assert.equal(detail.status,200);assert.equal((await detail.json()).order.id,order.id);
  const requested=await fetch(second.origin+'/api/demo/returns/'+order.id,{method:'POST',headers:{...headers(second.origin),'x-demo-action':'request','x-demo-session':token},body:JSON.stringify({kind:'withdrawal',reason:'',expectedVersion:0})});assert.equal(requested.status,200);
  const owner=await fetch(second.origin+'/api/demo/admin/orders/'+order.id,{headers:{'x-demo-session':token}});assert.equal((await owner.json()).order.return_status,'requested');
  const db=new DatabaseSync(path.join(root,'.data','presentation.sqlite'));cleanup(t,()=>db.close());assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM return_access').get().n,0);assert.ok(!db.prepare('SELECT data FROM demo_sessions').get().data.includes(token));
});

test('socket IP overrides forged Cloudflare/proxy headers so session quota cannot be bypassed',async t=>{
  const root=await fixture(t),{origin}=await start(t,root);
  for(let i=0;i<6;i++){
    const response=await raw(origin+'/api/demo/session','POST',{...headers(origin),'cf-connecting-ip':'198.51.100.'+i,'x-forwarded-for':'203.0.113.'+i,'x-real-ip':'203.0.113.'+i,'oai-authenticated-user-id':'spoofed'},['{}']);assert.equal(response.status,i<5?200:429);
  }
  const db=new DatabaseSync(path.join(root,'.data','presentation.sqlite'));cleanup(t,()=>db.close());assert.equal(db.prepare('SELECT count(*) AS n FROM demo_sessions').get().n,5);assert.equal(db.prepare('SELECT count(*) AS n FROM return_rate_limits').get().n,1);
});

test('HTTP enforces exact configured origin, ignores forwarded origin and rejects forged Host',async t=>{
  const root=await fixture(t),{origin}=await start(t,root);
  const foreign=await raw(origin+'/api/demo/session','POST',{...headers('https://evil.example'),'x-forwarded-host':'evil.example','x-forwarded-proto':'https'},['{}']);assert.equal(foreign.status,403);
  const forged=await raw(origin+'/api/demo/session','POST',{...headers('http://evil.example'),host:'evil.example'},['{}']);assert.equal(forged.status,421);
  const valid=await create(origin);assert.equal(valid.status,200);
});

test('bounded HTTP bodies reject declared or chunked oversized requests before database writes',async t=>{
  const root=await fixture(t),{origin}=await start(t,root);
  const declared=await raw(origin+'/api/demo/session','POST',{...headers(origin),'content-length':'9000'},['x'.repeat(9000)]);assert.equal(declared.status,413);
  const chunked=await raw(origin+'/api/demo/session','POST',{...headers(origin),'transfer-encoding':'chunked'},['x'.repeat(5000),'x'.repeat(5000)]);assert.equal(chunked.status,413);
  assert.equal((await create(origin)).status,200);
  const db=new DatabaseSync(path.join(root,'.data','presentation.sqlite'));cleanup(t,()=>db.close());assert.equal(db.prepare('SELECT count(*) AS n FROM demo_sessions').get().n,1);
});

test('a reverse-proxy origin is explicit configuration and is never inferred from request headers',async t=>{
  const root=await fixture(t),{origin}=await start(t,root,{publicOrigin:'https://demo.example'});
  const valid=await raw(origin+'/api/demo/session','POST',{...headers('https://demo.example'),host:'demo.example'},['{}']);assert.equal(valid.status,200);
  const bad=await raw(origin+'/api/demo/session','POST',{...headers('https://other.example'),host:'demo.example','x-forwarded-host':'other.example'},['{}']);assert.equal(bad.status,403);
});
