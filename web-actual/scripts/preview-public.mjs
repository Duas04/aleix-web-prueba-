// Local-only synthetic preview. Never included in the deployed Worker.
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {localDatabase} from '../tests/database.mjs';
import {communityHash} from '../worker/community.mjs';
const worker=(await import(pathToFileURL(process.cwd()+'/dist/server/index.js'))).default;
const DB=localDatabase();
const previewOwner=process.argv.includes('--owner');const port=Number(process.env.PREVIEW_PORT)||(previewOwner?4189:4188);
const base={DB,ADMIN_OWNER_EMAIL:'owner@example.test'};
DB.sqlite.prepare('INSERT INTO community_users(id,google_sub,email,alias,accepted_at,created_at) VALUES(?,?,?,?,?,?)').run('preview-owner','preview-google','preview@example.invalid','Aleix',Date.now(),Date.now());
DB.sqlite.prepare('INSERT INTO community_owner VALUES(1,?)').run('preview-owner');
DB.sqlite.prepare('INSERT INTO community_sessions VALUES(?,?,?)').run(await communityHash('p'.repeat(43)),'preview-owner',Date.now()+86400000);
DB.sqlite.prepare('INSERT INTO community_users(id,google_sub,email,alias,accepted_at,created_at) VALUES(?,?,?,?,?,?)').run('preview-reader','reader-google','reader@example.invalid','Lector de prueba',Date.now(),Date.now());
DB.sqlite.prepare('INSERT INTO community_posts(id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?)').run('preview-question','preview-owner','Una pausa entre páginas','¿Qué pequeña idea del libro te ha acompañado hoy? Comparte tu lectura con calma.','published',Date.now());
DB.sqlite.prepare('INSERT INTO community_posts(id,parent_id,author_id,body,status,created_at) VALUES(?,?,?,?,?,?)').run('preview-reply','preview-question','preview-reader','Me quedo con la idea de reservar un momento para mí.','published',Date.now());
http.createServer(async(req,res)=>{try{
 const origin='http://127.0.0.1:'+port,url=new URL(req.url,origin);
 if(url.pathname==='/__mobile'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Vista móvil 390px</title><style>body{margin:0;background:#dedbd4}iframe{display:block;width:390px;height:844px;margin:12px auto;border:1px solid #888}</style><iframe title="Vista móvil" src="'+(url.searchParams.get('page')==='/comunidad'?'/comunidad':'/')+'"></iframe>');return;}
 const headers=new Headers(req.headers);const mode=url.searchParams.get('preview')||req.headers.referer&&new URL(req.headers.referer).searchParams.get('preview');
 const env={...base};if(previewOwner){Object.assign(env,{GOOGLE_CLIENT_ID:'preview',GOOGLE_CLIENT_SECRET:'preview',COMMUNITY_ORIGIN:'https://book.example'});url.protocol='https:';url.host='book.example';url.port='';if(headers.get('origin')===origin)headers.set('origin','https://book.example');headers.set('cookie','__Host-community='+'p'.repeat(43));headers.set('oai-authenticated-user-id','site-owner');headers.set('oai-authenticated-user-email','owner@example.test');}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await worker.fetch(new Request(url,{method:req.method,headers,...(body.length?{body}:{})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Preview error');}}).listen(port,'127.0.0.1',()=>console.log('Local preview on port '+port+'; synthetic owner='+previewOwner));
