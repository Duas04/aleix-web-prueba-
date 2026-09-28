import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdir,readFile,readdir,realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';

const presentationRoot=fileURLToPath(new URL('.',import.meta.url));
const presentationBodyLimit=8192;
const presentationPrivateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const presentationPolicy="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";
const presentationTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.ttf':'font/ttf'};
const presentationAll=Symbol('executeAll');
const presentationJson=(error,status)=>new Response(JSON.stringify({error}),{status,headers:{...presentationPrivateHeaders,'Content-Type':'application/json; charset=utf-8'}});

async function presentationDatabase(rootDir){
  const dataDir=path.join(rootDir,'.data');await mkdir(dataDir,{recursive:true});
  const sqlite=new DatabaseSync(path.join(dataDir,'presentation.sqlite'),{timeout:5000,enableForeignKeyConstraints:true});
  try{
    sqlite.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _presentation_migrations(name TEXT PRIMARY KEY NOT NULL,hash TEXT NOT NULL);');
    const migrationDir=path.join(rootDir,'drizzle');const files=(await readdir(migrationDir)).filter(name=>name.endsWith('.sql')).sort();
    for(const name of files){
      const sql=await readFile(path.join(migrationDir,name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
      const previous=sqlite.prepare('SELECT hash FROM _presentation_migrations WHERE name=?').get(name);
      if(previous){if(previous.hash!==hash)throw new Error('Una migración aplicada ha cambiado: '+name);continue;}
      sqlite.exec('BEGIN');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO _presentation_migrations(name,hash) VALUES(?,?)').run(name,hash);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
    if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='demo_sessions'").get())throw new Error('Falta la migración de demo_sessions.');
    const prepare=sql=>{
      const statement=sqlite.prepare(sql);let values=[];
      const stmt={bind(...args){values=args;return stmt;},async first(){return statement.get(...values)||null;},async run(){return {success:true,meta:statement.run(...values)};},async all(){return stmt[presentationAll]();},[presentationAll](){return {success:true,results:statement.all(...values)};}};
      return stmt;
    };
    return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(stmt=>stmt[presentationAll]());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  }catch(error){sqlite.close();throw error;}
}
async function presentationBody(request){
  if(Number(request.headers['content-length'])>presentationBodyLimit){const error=new Error('body limit');error.httpStatus=413;throw error;}
  const chunks=[];let size=0;
  // Use events rather than an early-ended async iterator: the error response must reach the client.
  return await new Promise((resolve,reject)=>{
    const cleanup=()=>{request.removeListener('data',onData);request.removeListener('end',onEnd);request.removeListener('error',onError);request.removeListener('aborted',onAbort);};
    const onData=chunk=>{size+=chunk.length;if(size>presentationBodyLimit){cleanup();request.resume();const error=new Error('body limit');error.httpStatus=413;reject(error);}else chunks.push(chunk);};
    const onEnd=()=>{cleanup();resolve(Buffer.concat(chunks,size));};const onError=error=>{cleanup();reject(error);};const onAbort=()=>onError(new Error('request aborted'));
    request.on('data',onData);request.on('end',onEnd);request.on('error',onError);request.on('aborted',onAbort);
  });
}
function presentationTrustedHeaders(request){
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)){
    if(name.startsWith('cf-')||name.startsWith('oai-')||['x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','host','connection','transfer-encoding','content-length','expect'].includes(name)||value===undefined)continue;
    headers.set(name,Array.isArray(value)?value.join(', '):value);
  }
  // Worker compatibility header, derived exclusively from the TCP connection rather than client headers.
  headers.set('cf-connecting-ip',(request.socket.remoteAddress||'unknown').replace(/^::ffff:/,''));return headers;
}
function presentationConfiguredOrigin(value){
  if(!value)return null;const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('PUBLIC_ORIGIN debe contener únicamente el origen HTTP o HTTPS, sin ruta ni credenciales.');return url.origin;
}
function presentationIncomingOrigin(request,allowedOrigins,scheme){
  const host=request.headers.host;
  if(typeof host!=='string'||host.length>300||/[\s\\/?#@]/.test(host))return null;
  try{const origin=new URL(scheme+'//'+host).origin;return allowedOrigins.has(origin)?origin:null;}catch{return null;}
}
async function presentationStatic(url,method,publicDir){
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return presentationJson('No encontrado.',404);}
  if(pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').some(part=>part.startsWith('.'))||pathname==='/admin'||pathname.startsWith('/admin/')&&pathname!=='/admin/styles.css')return presentationJson('No encontrado.',404);
  if(['/', '/index.html','/devoluciones','/devoluciones/','/devoluciones.html'].includes(pathname)&&url.searchParams.get('demo')!=='1'){
    url.searchParams.set('demo','1');return new Response(null,{status:302,headers:{...presentationPrivateHeaders,Location:url.pathname+url.search}});
  }
  const routes={'/':'/index.html','/demo':'/demo/index.html','/demo/':'/demo/index.html','/devoluciones':'/devoluciones.html','/devoluciones/':'/devoluciones.html'};
  const filename=path.resolve(publicDir,'.'+(routes[pathname]||pathname));
  if(filename!==publicDir&&!filename.startsWith(publicDir+path.sep))return presentationJson('No encontrado.',404);
  try{
    const actual=await realpath(filename);if(!actual.startsWith(publicDir+path.sep))return presentationJson('No encontrado.',404);
    const bytes=await readFile(actual);return new Response(method==='HEAD'?null:bytes,{headers:{...presentationPrivateHeaders,'Content-Type':presentationTypes[path.extname(actual).toLowerCase()]||'application/octet-stream','Content-Length':String(bytes.length),'Content-Security-Policy':presentationPolicy}});
  }catch{return presentationJson('No encontrado.',404);}
}
async function presentationSend(request,response,webResponse){
  const bytes=request.method==='HEAD'?null:Buffer.from(await webResponse.arrayBuffer());
  response.writeHead(webResponse.status,Object.fromEntries(webResponse.headers));response.end(bytes);
}

export async function startPresentationServer({rootDir=presentationRoot,host='127.0.0.1',port=4180,publicOrigin=null}={}){
  if(Number.parseInt(process.versions.node,10)<24)throw new Error('La presentación requiere Node.js 24 o posterior.');
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT no es un puerto válido.');
  rootDir=path.resolve(rootDir);const configuredOrigin=presentationConfiguredOrigin(publicOrigin);
  const publicDir=await realpath(path.join(rootDir,'public'));
  const {handleDemo}=await import(pathToFileURL(path.join(rootDir,'worker','demo.mjs')).href);
  const DB=await presentationDatabase(rootDir);const env={DB};let origin,scheme,allowedOrigins;
  const server=http.createServer(async(request,response)=>{
    try{
      const incomingOrigin=presentationIncomingOrigin(request,allowedOrigins,scheme);
      if(!incomingOrigin){await presentationSend(request,response,presentationJson('Host no permitido.',421));return;}
      if(typeof request.url!=='string'||!request.url.startsWith('/')||request.url.startsWith('//')){await presentationSend(request,response,presentationJson('Solicitud no válida.',400));return;}
      const url=new URL(request.url,incomingOrigin);
      let result;
      if(url.pathname==='/api/demo'||url.pathname.startsWith('/api/demo/')){
        const method=request.method||'GET',bytes=['GET','HEAD'].includes(method)?null:await presentationBody(request);
        const webRequest=new Request(url,{method,headers:presentationTrustedHeaders(request),...(bytes?{body:bytes}:{})});result=await handleDemo(webRequest,env)||presentationJson('No encontrado.',404);
      }else if(url.pathname.startsWith('/api/'))result=presentationJson('Esta exportación solo expone la API de demostración.',404);
      else if(!['GET','HEAD'].includes(request.method))result=presentationJson('Método no permitido.',405);
      else result=await presentationStatic(url,request.method,publicDir);
      await presentationSend(request,response,result);
    }catch(error){
      if(error.httpStatus===413){response.setHeader('Connection','close');request.resume();}
      if(!response.headersSent&&!response.destroyed)await presentationSend(request,response,presentationJson(error.httpStatus===413?'Solicitud demasiado grande.':'No se puede abrir la presentación ahora.',error.httpStatus||503));
    }
  });
  server.headersTimeout=10000;server.requestTimeout=30000;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});}catch(error){DB.sqlite.close();throw error;}
  const address=server.address(),boundHost=host.includes(':')?'['+host+']':host;
  origin='http://'+boundHost+':'+address.port;const advertisedOrigin=configuredOrigin||origin;scheme=new URL(advertisedOrigin).protocol;allowedOrigins=new Set([advertisedOrigin]);
  if(!configuredOrigin&&['127.0.0.1','localhost','::1'].includes(host))for(const alias of ['127.0.0.1','localhost','[::1]'])allowedOrigins.add('http://'+alias+':'+address.port);
  let closing;
  const close=()=>closing||(closing=new Promise((resolve,reject)=>{server.close(error=>{DB.sqlite.close();if(error)reject(error);else resolve();});server.closeIdleConnections();}));
  return {server,origin,publicOrigin:advertisedOrigin,close};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const running=await startPresentationServer({host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||4180),publicOrigin:process.env.PUBLIC_ORIGIN||null});
    console.log('Presentación: '+running.publicOrigin+'/?demo=1');console.log('Panel: '+running.publicOrigin+'/demo');
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{running.close().catch(()=>{process.exitCode=1;});});
  }catch(error){console.error('No se pudo iniciar la presentación: '+error.message);process.exitCode=1;}
}
