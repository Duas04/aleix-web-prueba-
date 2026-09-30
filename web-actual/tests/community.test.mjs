import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './database.mjs';
import {handleCommunity,communityHash,communityVerifyIdToken} from '../worker/community.mjs';
const origin='https://book.example';
async function setup(){
 const env={DB:localDatabase(),GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-secret',COMMUNITY_ORIGIN:origin,ADMIN_OWNER_EMAIL:'owner@example.test'};
 const tokens={};for(const id of ['reader','other','owner']){env.DB.sqlite.prepare('INSERT INTO community_users(id,google_sub,email,alias,accepted_at,created_at) VALUES(?,?,?,?,?,?)').run(id,'google-'+id,id+'@example.test',id,Date.now(),Date.now());tokens[id]=id.padEnd(43,'a');env.DB.sqlite.prepare('INSERT INTO community_sessions VALUES(?,?,?)').run(await communityHash(tokens[id]),id,Date.now()+86400000);}
 const call=(path,{user,body,headers={},method=body?'POST':'GET'}={})=>handleCommunity(new Request(origin+path,{method,headers:{...(user?{Cookie:'__Host-community='+tokens[user]}:{}),...(body?{Origin:origin,'Content-Type':'application/json','X-Community-Action':'write'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
 return {env,call,tokens};
}
test('unconfigured Google stays unavailable and cannot accept posts',async()=>{const {env,call}=await setup();delete env.GOOGLE_CLIENT_SECRET;assert.equal((await(await call('/api/community/me')).json()).loginAvailable,false);assert.equal((await call('/auth/google/start')).status,303);assert.equal((await call('/api/community/posts',{user:'reader',body:{title:'Pregunta',body:'Texto'}})).status,503);});
test('retired bootstrap cannot grant owners',async()=>{const {call}=await setup();assert.equal((await call('/api/community/owner',{user:'owner',body:{},headers:{'oai-authenticated-user-id':'site-owner','oai-authenticated-user-email':'owner@example.test'}})).status,410);assert.equal((await(await call('/api/community/me',{user:'owner'})).json()).user.role,'reader');});
test('posts are moderated, private data stays private and forged roles do not grant access',async()=>{
 const {env,call}=await setup();env.DB.sqlite.prepare('INSERT INTO community_owner VALUES(1,?)').run('owner');
 const created=await call('/api/community/posts',{user:'reader',body:{title:'Mi pregunta',body:'¿Cómo empezar?',role:'owner',status:'published'}});assert.equal(created.status,201);const {post}=await created.json();assert.equal(post.status,'pending');assert.equal((await(await call('/api/community/posts')).json()).posts.length,0);
 assert.equal((await call('/api/community/moderation',{user:'reader'})).status,403);
 assert.equal((await call('/api/community/posts/'+post.id+'/moderate',{user:'other',body:{status:'published',version:0,reason:''}})).status,403);
 assert.equal((await call('/api/community/posts/'+post.id+'/moderate',{user:'owner',body:{status:'published',version:0,reason:''}})).status,200);
 const publicText=await(await call('/api/community/posts')).text();assert.match(publicText,/Mi pregunta/);assert.doesNotMatch(publicText,/@example|google-|tokenHash/);
 assert.equal((await call('/api/community/posts/'+post.id+'/moderate',{user:'owner',body:{status:'hidden',version:0,reason:'Duplicado'}})).status,409);
 const reply=await call('/api/community/posts',{user:'owner',body:{parentId:post.id,body:'Puedes empezar con una pausa.'}});assert.equal(reply.status,201);assert.equal((await reply.json()).post.status,'published');
 assert.equal((await call('/api/community/posts/'+post.id+'/delete',{user:'other',body:{version:1}})).status,404);
 assert.equal((await call('/api/community/posts/'+post.id+'/delete',{user:'reader',body:{version:1}})).status,200);assert.equal((await call('/api/community/posts/'+post.id)).status,404);
});
test('writes require same origin and bounded valid input, session logout revokes access',async()=>{const {call}=await setup();for(const headers of [{Origin:'https://evil.example'},{'X-Community-Action':''}])assert.equal((await call('/api/community/posts',{user:'reader',headers,body:{title:'Título',body:'Texto'}})).status,403);assert.equal((await call('/api/community/posts',{body:{title:'Título',body:'Texto'}})).status,401);assert.equal((await call('/api/community/posts',{user:'reader',body:{title:'Título',body:'x'.repeat(5000)}})).status,400);assert.equal((await call('/api/community/logout',{user:'reader',body:{}})).status,200);assert.equal((await(await call('/api/community/me',{user:'reader'})).json()).user,null);});
test('OAuth start binds PKCE, nonce and state to browser; invalid callback never consumes another state',async()=>{const {call,env}=await setup();const start=await call('/auth/google/start');assert.equal(start.status,303);const url=new URL(start.headers.get('location'));assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('nonce'));assert.match(start.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.equal((await call('/auth/google/callback?state='+url.searchParams.get('state')+'&code=bogus')).status,303);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM community_oauth').get().n,1);});
test('Google ID tokens require valid signature, issuer, audience, expiry and nonce',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
 const claims={iss:'https://accounts.google.com',aud:'client',sub:'google-id',email:'x@example.test',email_verified:true,exp:Math.floor(Date.now()/1000)+60,iat:Math.floor(Date.now()/1000),nonce:'nonce'};
 async function token(overrides={},bad=false){const data=[Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),Buffer.from(JSON.stringify({...claims,...overrides})).toString('base64url')].join('.');const sig=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(data))).toString('base64url');return data+'.'+(bad?sig.slice(0,-10)+'aaaaaaaaaa':sig);}
 const fetcher=async()=>new Response(JSON.stringify({keys:[jwk]}));assert.equal((await communityVerifyIdToken(await token(),'client','nonce',fetcher)).sub,'google-id');
 for(const override of [{aud:'other'},{iss:'https://evil.example'},{exp:1},{nonce:'other'},{email_verified:false}])await assert.rejects(communityVerifyIdToken(await token(override),'client','nonce',fetcher));await assert.rejects(communityVerifyIdToken(await token({},true),'client','nonce',fetcher));
});
test('a reader cannot queue more than five pending posts and approval frees one slot',async()=>{
 const {env,call}=await setup(),ids=[];
 for(let i=0;i<5;i++){const response=await call('/api/community/posts',{user:'reader',body:{title:'Pregunta '+i,body:'Mensaje pendiente '+i}});assert.equal(response.status,201);ids.push((await response.json()).post.id);}
 assert.equal((await call('/api/community/posts',{user:'reader',body:{title:'Sexta pregunta',body:'Otro mensaje'}})).status,429);
 assert.equal(env.DB.sqlite.prepare("SELECT count(*) n FROM community_posts WHERE author_id='reader'").get().n,5);
 env.DB.sqlite.prepare('INSERT INTO community_owner VALUES(1,?)').run('owner');
 assert.equal((await call('/api/community/posts/'+ids[0]+'/moderate',{user:'owner',body:{status:'published',version:0,reason:''}})).status,200);
 assert.equal((await call('/api/community/posts',{user:'reader',body:{title:'Sexta pregunta',body:'Otro mensaje'}})).status,201);
});

test('invalid messages do not spend the shared IP quota and concurrent sends respect the pending cap',async()=>{
 const {env,call}=await setup();
 for(let i=0;i<4;i++)assert.equal((await call('/api/community/posts',{user:'reader',body:{title:'Pregunta',body:'Mensaje válido'}})).status,201);
 const responses=await Promise.all([1,2].map(()=>call('/api/community/posts',{user:'reader',body:{title:'Otra pregunta',body:'Otro mensaje válido'}})));
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,429]);
 for(let i=0;i<10;i++)assert.equal((await call('/api/community/posts',{user:'owner',headers:{'CF-Connecting-IP':'192.0.2.99'},body:{title:'x',body:'x'}})).status,400);
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM community_limits WHERE key=?').get(await communityHash('posts-ip:192.0.2.99')).n,0);
});

test('pending posts share a per-IP quota across distinct Google accounts',async()=>{
 const {env,call,tokens}=await setup(),ip={'CF-Connecting-IP':'192.0.2.41'};
 for(let account=0;account<9;account++){
  const id='visitor-'+account;env.DB.sqlite.prepare('INSERT INTO community_users(id,google_sub,email,alias,accepted_at,created_at) VALUES(?,?,?,?,?,?)').run(id,'google-'+id,id+'@example.test',id,Date.now(),Date.now());
  tokens[id]=id.padEnd(43,'a');env.DB.sqlite.prepare('INSERT INTO community_sessions VALUES(?,?,?)').run(await communityHash(tokens[id]),id,Date.now()+86400000);
  for(let post=0;post<(account===8?1:5);post++){const response=await call('/api/community/posts',{user:id,headers:ip,body:{title:'Pregunta',body:'Mensaje pendiente'}});assert.equal(response.status,account===8?429:201);}
 }
 assert.equal(env.DB.sqlite.prepare("SELECT count(*) n FROM community_posts WHERE author_id LIKE 'visitor-%'").get().n,40);
});

test('malformed parent IDs are rejected before creating posts',async()=>{
 const {env,call}=await setup();
 for(const parentId of [7,{},[],true,'x/'.repeat(30),'a'.repeat(81)]){
  const response=await call('/api/community/posts',{user:'reader',body:{parentId,body:'Respuesta de prueba'}});
  assert.equal(response.status,400,JSON.stringify(parentId));
 }
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM community_posts').get().n,0);
});

test('OAuth callback exchanges the code, verifies Google identity and consumes state once',async t=>{
 const {env,call}=await setup(),start=await call('/auth/google/start'),authorization=new URL(start.headers.get('location'));
 const state=authorization.searchParams.get('state'),oauthCookie=start.headers.get('set-cookie').split(';')[0];
 const transaction=env.DB.sqlite.prepare('SELECT verifier,nonce FROM community_oauth WHERE state_hash=?').get(await communityHash(state));
 assert.equal(await communityHash(transaction.verifier),authorization.searchParams.get('code_challenge'));
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='callback-key';
 const claims={iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,sub:'callback-google-sub',email:'new@example.test',email_verified:true,exp:Math.floor(Date.now()/1000)+60,iat:Math.floor(Date.now()/1000),nonce:transaction.nonce};
 const payload=[Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url'),Buffer.from(JSON.stringify(claims)).toString('base64url')].join('.');
 const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(payload))).toString('base64url');
 t.mock.method(globalThis,'fetch',async (endpoint,options={})=>{
  if(endpoint==='https://oauth2.googleapis.com/token'){
   assert.equal(options.method,'POST');assert.equal(options.body.get('code'),'single-use-code');
   assert.equal(options.body.get('code_verifier'),transaction.verifier);
   return new Response(JSON.stringify({id_token:payload+'.'+signature}),{headers:{'Content-Type':'application/json'}});
  }
  if(endpoint==='https://www.googleapis.com/oauth2/v3/certs')return new Response(JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'application/json'}});
  throw new Error('Unexpected external endpoint');
 });
 const callbackPath='/auth/google/callback?state='+state+'&code=single-use-code';
 const response=await call(callbackPath,{headers:{Cookie:oauthCookie}});
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/comunidad');
 const sessionCookie=response.headers.get('set-cookie').match(/__Host-community=[A-Za-z0-9_-]{43}/)?.[0];
 assert.ok(sessionCookie);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM community_oauth').get().n,0);
 const me=await(await call('/api/community/me',{headers:{Cookie:sessionCookie}})).json();
 assert.equal(me.user.role,'reader');assert.ok(me.user.id);assert.equal(env.DB.sqlite.prepare("SELECT count(*) n FROM community_users WHERE google_sub='callback-google-sub'").get().n,1);
 assert.equal((await call(callbackPath,{headers:{Cookie:oauthCookie}})).headers.get('location'),'/comunidad?acceso=error');
 assert.equal(env.DB.sqlite.prepare("SELECT count(*) n FROM community_users WHERE google_sub='callback-google-sub'").get().n,1);
});
