import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './database.mjs';
import {handleCommunity,communityHash} from '../worker/community.mjs';
import {createPublicWorker} from '../worker/site.mjs';
async function setup(){
 const env={DB:localDatabase(),GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',COMMUNITY_ORIGIN:'https://book.example'};
 for(const id of ['root','reader','other']){env.DB.sqlite.prepare('INSERT INTO community_users(id,google_sub,email,alias,accepted_at,created_at) VALUES(?,?,?,?,?,?)').run(id,id,id+'@example.test',id,1,1);env.DB.sqlite.prepare('INSERT INTO community_sessions VALUES(?,?,?)').run(await communityHash(id.padEnd(43,'x')),id,Date.now()+60000);}
 env.DB.sqlite.prepare('INSERT INTO community_owner VALUES(1,?)').run('root');
 const call=(path,user,body,headers={})=>handleCommunity(new Request('https://book.example/api/community/'+path,{method:body?'POST':'GET',headers:{Cookie:'__Host-community='+user.padEnd(43,'x'),Origin:'https://book.example','Content-Type':'application/json','X-Community-Action':'write',...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
 return {call,env};
}
test('only principal grants existing Google users; revoke applies to an existing session and logs changes',async()=>{
 const {call,env}=await setup(),body={userId:'reader',email:'reader@example.test',confirmed:true};
 assert.equal((await call('team','reader')).status,403);
 assert.equal((await call('team/grant','reader',body)).status,403);
 assert.equal((await call('team/grant','root',body,{Origin:'https://evil.example'})).status,403);
 assert.equal((await call('team/grant','root',{...body,confirmed:false})).status,400);
 assert.equal((await call('team/grant','root',{...body,email:'other@example.test'})).status,409);
 assert.equal((await call('team/lookup','root',{email:'absent@example.test'})).status,404);
 assert.equal((await call('team/grant','root',body)).status,200);
 assert.equal((await(await call('me','reader')).json()).user.role,'owner');
 assert.equal((await call('moderation','reader')).status,200);
 assert.equal((await call('team/grant','reader',{userId:'other',email:'other@example.test',confirmed:true})).status,403);
 assert.equal((await call('team/revoke','root',{userId:'root',email:'root@example.test',confirmed:true})).status,409);
 assert.equal((await call('team/revoke','root',body)).status,200);
 assert.equal((await call('moderation','reader')).status,403);
 assert.equal((await(await call('me','reader')).json()).user.role,'reader');
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM community_role_events').get().n,2);
});
test('conversation search folds Spanish accents, counts published replies only and sorts activity',async()=>{
 const {env,call}=await setup();
 const insert=env.DB.sqlite.prepare('INSERT INTO community_posts(id,parent_id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?,?)');
 insert.run('old',null,'root','Ánimo y meditación','Un descanso','published',1);
 insert.run('new',null,'root','Nueva conversación','Otra pausa','published',2);
 insert.run('reply','old','reader','','Respuesta pública','published',3);
 insert.run('private','new','reader','','Secreto privado','pending',10);
 const all=await(await call('posts','reader')).json();assert.equal(all.posts[0].id,'old');assert.equal(all.posts[0].replyCount,1);
 const found=await(await call('posts?q=animo','reader')).json();assert.equal(found.posts.length,1);
 assert.equal((await(await call('posts?q=Secreto','root')).json()).posts.length,0);
 assert.equal((await(await call('posts?sort=new','reader')).json()).posts[0].id,'new');
});
test('reports stay private, deduplicate, require a reason and can only be resolved by owners',async()=>{
 const {call,env}=await setup();
 env.DB.sqlite.prepare('INSERT INTO community_posts(id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?)').run('reported','reader','Pregunta','Contenido de ejemplo','published',1);
 assert.equal((await call('reports','reader',{postId:'reported',reason:'corto'})).status,400);
 const body={postId:'reported',reason:'Este mensaje contiene publicidad no solicitada.'};
 assert.equal((await call('reports','reader',body,{Origin:'https://other.example'})).status,403);
 assert.equal((await call('reports','reader',body)).status,201);
 assert.equal((await call('reports','reader',body)).status,201);
 assert.equal((await call('reports','reader')).status,403);
 assert.doesNotMatch(await(await call('posts','reader')).text(),/publicidad no solicitada/);
 const {reports}=await(await call('reports','root')).json();assert.equal(reports.length,1);
 assert.equal((await call('reports/resolve','reader',{id:reports[0].id,resolution:'Revisado'})).status,403);
 assert.equal((await call('reports/resolve','root',{id:reports[0].id,resolution:'x'})).status,400);
 assert.equal((await call('reports/resolve','root',{id:reports[0].id,resolution:'Revisado; cumple las normas'})).status,200);
 assert.equal((await(await call('reports','root')).json()).reports.length,0);
 assert.equal((await call('reports/resolve','root',{id:reports[0].id,resolution:'Otra revisión'})).status,409);
 assert.equal(env.DB.sqlite.prepare('SELECT resolved_by FROM community_reports').get().resolved_by,'root');
});
test('moderation decisions are audited and their history is owner-only',async()=>{
 const {call,env}=await setup();
 env.DB.sqlite.prepare('INSERT INTO community_posts(id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?)').run('moderated','reader','Pregunta','Contenido de ejemplo','pending',1);
 assert.equal((await call('posts/moderated/moderate','root',{status:'hidden',version:0,reason:''})).status,400);
 assert.equal((await call('posts/moderated/moderate','root',{status:'published',version:0,reason:''})).status,200);
 assert.equal((await call('posts/moderated/moderate','root',{status:'hidden',version:1,reason:'Publicidad no solicitada'})).status,200);
 assert.equal((await call('moderation-history','reader')).status,403);
 assert.equal((await(await call('moderation-history','root')).json()).events.length,2);
 assert.equal((await call('posts/moderated','reader')).status,404);
});
test('OAuth stores only allowed destinations and ignores external redirects',async()=>{
 const {env}=await setup();
 for(const returnTo of ['/propietario','https://evil.example']){
 const r=await handleCommunity(new Request('https://book.example/auth/google/start?return_to='+encodeURIComponent(returnTo)),env);
 const state=new URL(r.headers.get('location')).searchParams.get('state');
 const row=env.DB.sqlite.prepare('SELECT return_path FROM community_oauth WHERE state_hash=?').get(await communityHash(state));
 assert.equal(row.return_path,returnTo==='/propietario'?returnTo:'/comunidad');
 }
});
test('private owner access uses Google sessions and rejects platform-header privilege escalation',async()=>{
 const {env}=await setup(),worker=createPublicWorker({'@owner':{type:'text/html',data:btoa('<h1>Private</h1>')},'/acceso-restringido.html':{type:'text/html',data:btoa('<h1>Access denied</h1>')}});
 const headers={'oai-authenticated-user-id':'root','oai-authenticated-user-email':'root@example.test'};
 const request=(path,cookie)=>new Request('https://book.example'+path,{headers:{...headers,...(cookie?{Cookie:'__Host-community='+cookie.padEnd(43,'x')}:{})}});
 const anonymous=await worker.fetch(request('/propietario'),env);assert.equal(anonymous.status,302);assert.equal(anonymous.headers.get('location'),'/auth/google/start?return_to=%2Fpropietario');
 assert.equal((await worker.fetch(request('/api/site-metrics'),env)).status,403);
 assert.equal((await worker.fetch(request('/propietario','reader'),env)).status,403);
 const owner=await worker.fetch(request('/propietario','root'),env);assert.equal(owner.status,200);assert.match(owner.headers.get('cache-control'),/no-store/);
});
