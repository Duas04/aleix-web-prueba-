import {authorizeOwner} from './database.mjs';

const communityHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex','Vary':'Cookie'};
const communityJson=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:communityHeaders});
const communityBytes=value=>new TextEncoder().encode(value);
const communityBase64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const communityRandom=()=>communityBase64(crypto.getRandomValues(new Uint8Array(32)));
export async function communityHash(value){return communityBase64(await crypto.subtle.digest('SHA-256',communityBytes(value)));}
const communityCookie=(name,value,age)=>`${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
function communityReadCookie(request,name){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';}
function communityConfigured(env){try{return !!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET&&new URL(env.COMMUNITY_ORIGIN).origin===env.COMMUNITY_ORIGIN&&env.COMMUNITY_ORIGIN.startsWith('https://');}catch{return false;}}
function communityRedirect(location,cookie){return new Response(null,{status:303,headers:{...communityHeaders,Location:location,...(cookie?{'Set-Cookie':cookie}:{})}});}
async function communityLimit(env,key,max,windowMs){const now=Date.now();const hash=await communityHash(key);const row=await env.DB.prepare('INSERT INTO community_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count').bind(hash,now+windowMs,now,now,now+windowMs).first();await env.DB.prepare('DELETE FROM community_limits WHERE expires_at<?').bind(now-86400000).run();return row.count<=max;}
async function communitySession(request,env){const token=communityReadCookie(request,'__Host-community');if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;return env.DB.prepare("SELECT u.id,u.alias,u.accepted_at,CASE WHEN o.user_id=u.id THEN 'owner' ELSE 'reader' END role FROM community_sessions s JOIN community_users u ON u.id=s.user_id LEFT JOIN community_owner o ON o.slot=1 WHERE s.token_hash=? AND s.expires_at>?").bind(await communityHash(token),Date.now()).first();}
function communityDecode(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
export async function communityVerifyIdToken(jwt,client,nonce,fetcher=fetch){
 if(typeof jwt!=='string'||jwt.length>16000)throw Error('Invalid token');const parts=jwt.split('.');if(parts.length!==3)throw Error('Invalid token');
 const header=JSON.parse(new TextDecoder().decode(communityDecode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(communityDecode(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Invalid algorithm');
 const response=await fetcher('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Keys unavailable');
 const keys=await response.json(),jwk=keys.keys?.find(key=>key.kid===header.kid&&key.kty==='RSA'&&(!key.use||key.use==='sig'));if(!jwk)throw Error('Unknown key');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,communityDecode(parts[2]),communityBytes(parts[0]+'.'+parts[1])))throw Error('Invalid signature');
 const now=Math.floor(Date.now()/1000),audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||!audiences.includes(client)||(audiences.length>1&&claims.azp!==client)||(claims.azp&&claims.azp!==client)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.nonce!==nonce||claims.email_verified!==true||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||typeof claims.email!=='string'||claims.email.length>320)throw Error('Invalid identity');
 return claims;
}
async function communityOAuth(request,env,url){
 if(!communityConfigured(env))return communityRedirect('/comunidad?acceso=pendiente');
 if(url.origin!==env.COMMUNITY_ORIGIN)return communityRedirect(env.COMMUNITY_ORIGIN+'/comunidad');
 const callback=env.COMMUNITY_ORIGIN+'/auth/google/callback';
 if(url.pathname==='/auth/google/start'){
  if(!await communityLimit(env,'login:'+request.headers.get('cf-connecting-ip'),10,900000))return communityRedirect('/comunidad?acceso=limite');
  const state=communityRandom(),verifier=communityRandom(),nonce=communityRandom();
  await env.DB.prepare('DELETE FROM community_oauth WHERE expires_at<=?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO community_oauth VALUES(?,?,?,?)').bind(await communityHash(state),verifier,nonce,Date.now()+600000).run();
  const login=new URL('https://accounts.google.com/o/oauth2/v2/auth');login.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'openid email',state,nonce,code_challenge:await communityHash(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
  return communityRedirect(login.href,communityCookie('__Host-community-oauth',state,600));
 }
 if(url.pathname!=='/auth/google/callback')return communityJson({error:'No encontrado.'},404);
 const state=url.searchParams.get('state'),cookie=communityReadCookie(request,'__Host-community-oauth');
 const failed=()=>communityRedirect('/comunidad?acceso=error',communityCookie('__Host-community-oauth','',0));
 if(!state||!/^[A-Za-z0-9_-]{43}$/.test(state)||state!==cookie)return failed();
 const transaction=await env.DB.prepare('DELETE FROM community_oauth WHERE state_hash=? RETURNING *').bind(await communityHash(state)).first();
 if(!transaction||transaction.expires_at<=Date.now()||url.searchParams.has('error'))return failed();
 const code=url.searchParams.get('code');if(!code||code.length>4096)return failed();
 try{
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:callback,grant_type:'authorization_code',code_verifier:transaction.verifier}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return failed();const data=await response.json(),identity=await communityVerifyIdToken(data.id_token,env.GOOGLE_CLIENT_ID,transaction.nonce);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO community_users(id,google_sub,email,created_at) VALUES(?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email').bind(id,identity.sub,identity.email,Date.now()).run();
  const user=await env.DB.prepare('SELECT id FROM community_users WHERE google_sub=?').bind(identity.sub).first();
  const token=communityRandom(),old=communityReadCookie(request,'__Host-community');
  await env.DB.prepare('DELETE FROM community_sessions WHERE token_hash=? OR expires_at<=?').bind(await communityHash(old),Date.now()).run();
  await env.DB.prepare('INSERT INTO community_sessions VALUES(?,?,?)').bind(await communityHash(token),user.id,Date.now()+7*86400000).run();
  const result=communityRedirect('/comunidad',communityCookie('__Host-community',token,604800));result.headers.append('Set-Cookie',communityCookie('__Host-community-oauth','',0));return result;
 }catch{return failed();}
}
async function communityBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return null;
 const reader=request.body?.getReader();if(!reader)return null;let size=0,text='';const decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>20000){await reader.cancel();return null;}text+=decoder.decode(part.value,{stream:true});}const body=JSON.parse(text+decoder.decode());return body&&typeof body==='object'&&!Array.isArray(body)?body:null;}catch{return null;}finally{reader.releaseLock();}
}
const communityValid=(text,min,max)=>typeof text==='string'&&text.trim().length>=min&&text.length<=max&&!/[\x00-\x08\x0b-\x1f\x7f]/.test(text);
const communitySelect="SELECT p.id,p.parent_id parentId,p.title,p.body,p.status,p.created_at createdAt,p.version,u.alias author,CASE WHEN o.user_id=p.author_id THEN 'owner' ELSE 'reader' END role,p.author_id authorId FROM community_posts p JOIN community_users u ON u.id=p.author_id LEFT JOIN community_owner o ON o.slot=1";
function communityPublicPost(post,user){const {authorId,...safe}=post;return {...safe,mine:authorId===user?.id};}
async function communityReadPost(env,id){return env.DB.prepare(communitySelect+' WHERE p.id=?').bind(id).first();}
function communityVisible(post,user){return post&&(post.status==='published'||user?.role==='owner'||post.authorId===user?.id);}
export async function handleCommunity(request,env){
 const url=new URL(request.url),p=url.pathname;
 try{
  if(p.startsWith('/auth/google/'))return request.method==='GET'?await communityOAuth(request,env,url):communityJson({error:'Método no permitido.'},405);
  const user=await communitySession(request,env),configured=communityConfigured(env);
  if(p==='/api/community/me'&&request.method==='GET')return communityJson({loginAvailable:configured,user,canLinkOwner:!!user&&await authorizeOwner(request,env)===200});
  if(p==='/api/community/posts'&&request.method==='GET'){
   const offset=Math.floor(Math.max(0,Math.min(10000,Number(url.searchParams.get('offset'))||0)));const mine=url.searchParams.get('mine')==='1';
   const rows=await env.DB.prepare(communitySelect+" WHERE p.parent_id IS NULL AND "+(mine?'p.author_id=?':"p.status='published'")+" ORDER BY p.created_at DESC,p.id DESC LIMIT 21 OFFSET ?").bind(...(mine?[user?.id||'']:[]),offset).all();
   return communityJson({posts:rows.results.slice(0,20).map(row=>communityPublicPost(row,user)),hasMore:rows.results.length>20});
  }
  if(p==='/api/community/moderation'&&request.method==='GET'){
   if(user?.role!=='owner')return communityJson({error:'Solo el dueño puede moderar.'},403);
   const rows=await env.DB.prepare(communitySelect+" WHERE p.status='pending' ORDER BY p.created_at,p.id LIMIT 50").all();return communityJson({posts:rows.results.map(row=>communityPublicPost(row,user))});
  }
  const match=/^\/api\/community\/posts\/([a-zA-Z0-9-]{1,80})(?:\/(moderate|delete))?$/.exec(p);
  if(match&&!match[2]&&request.method==='GET'){
   const post=await communityReadPost(env,match[1]);if(!communityVisible(post,user)||post.status==='hidden'||post.parentId)return communityJson({error:'Conversación no disponible.'},404);
   const offset=Math.floor(Math.max(0,Math.min(10000,Number(url.searchParams.get('offset'))||0)));
   const replies=await env.DB.prepare(communitySelect+" WHERE p.parent_id=? AND (p.status='published' OR p.author_id=? OR ?=1) AND p.status!='hidden' ORDER BY p.created_at,p.id LIMIT 51 OFFSET ?").bind(post.id,user?.id||'',user?.role==='owner'?1:0,offset).all();
   return communityJson({post:communityPublicPost(post,user),replies:replies.results.slice(0,50).map(row=>communityPublicPost(row,user)),hasMore:replies.results.length>50});
  }
  if(request.method!=='POST')return communityJson({error:'No encontrado.'},404);
  if(!configured)return communityJson({error:'La comunidad aún no está activada.'},503);
  if(!user)return communityJson({error:'Inicia sesión para continuar.'},401);
  if(url.origin!==env.COMMUNITY_ORIGIN||request.headers.get('origin')!==url.origin||request.headers.get('x-community-action')!=='write')return communityJson({error:'Solicitud no permitida.'},403);
  const body=await communityBody(request);if(!body)return communityJson({error:'Datos no válidos o demasiado grandes.'},400);
  if(p==='/api/community/logout'){await env.DB.prepare('DELETE FROM community_sessions WHERE token_hash=?').bind(await communityHash(communityReadCookie(request,'__Host-community'))).run();const response=communityJson({ok:true});response.headers.set('Set-Cookie',communityCookie('__Host-community','',0));return response;}
  if(p==='/api/community/owner'){
   if(await authorizeOwner(request,env)!==200)return communityJson({error:'Vincula la cuenta desde la sesión privada del titular.'},403);
   await env.DB.prepare('INSERT INTO community_owner VALUES(1,?) ON CONFLICT(slot) DO NOTHING').bind(user.id).run();
   const owner=await env.DB.prepare('SELECT user_id FROM community_owner WHERE slot=1').first();return owner.user_id===user.id?communityJson({ok:true}):communityJson({error:'Ya existe una cuenta de dueño vinculada.'},409);
  }
  if(!await communityLimit(env,'write:'+user.id,30,3600000))return communityJson({error:'Has enviado muchas acciones. Inténtalo más tarde.'},429);
  if(p==='/api/community/profile'){
   if(!communityValid(body.alias,2,40)||body.accepted!==true)return communityJson({error:'Elige un nombre público y acepta las normas de participación.'},400);
   await env.DB.prepare('UPDATE community_users SET alias=?,accepted_at=? WHERE id=?').bind(body.alias.trim(),Date.now(),user.id).run();return communityJson({ok:true});
  }
  if(p==='/api/community/posts'){
   if(!user.accepted_at)return communityJson({error:'Completa tu perfil y acepta las normas antes de publicar.'},403);
   if(body.parentId!==undefined&&body.parentId!==null&&(typeof body.parentId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(body.parentId)))return communityJson({error:'Conversación no válida.'},400);
   if(body.website||!communityValid(body.body,3,4000)||(!body.parentId&&!communityValid(body.title,3,120)))return communityJson({error:'Escribe un título de 3 a 120 caracteres y un mensaje de 3 a 4000.'},400);
   if(body.parentId){const parent=await communityReadPost(env,body.parentId);if(!parent||parent.parentId||parent.status!=='published')return communityJson({error:'Esta conversación no admite respuestas.'},409);}
   if(user.role!=='owner'){
    const pending=await env.DB.prepare("SELECT count(*) count FROM community_posts WHERE author_id=? AND status='pending'").bind(user.id).first();
    if(pending.count>=5||!await communityLimit(env,'posts-ip:'+request.headers.get('cf-connecting-ip'),40,3600000))return communityJson({error:'Ya hay varias aportaciones en revisión. Espera antes de enviar otra.'},429);
   }
   const id=crypto.randomUUID(),status=user.role==='owner'?'published':'pending';
   const inserted=await env.DB.prepare("INSERT INTO community_posts(id,parent_id,author_id,title,body,status,created_at) SELECT ?,?,?,?,?,?,? WHERE ?=1 OR (SELECT count(*) FROM community_posts WHERE author_id=? AND status='pending')<5 RETURNING id").bind(id,body.parentId||null,user.id,body.parentId?'':body.title.trim(),body.body.trim(),status,Date.now(),user.role==='owner'?1:0,user.id).first();
   if(!inserted)return communityJson({error:'Ya hay varias aportaciones en revisión. Espera antes de enviar otra.'},429);
   return communityJson({post:communityPublicPost(await communityReadPost(env,id),user)},201);
  }
  if(match?.[2]){
   const post=await communityReadPost(env,match[1]);if(!post)return communityJson({error:'No encontrado.'},404);
   if(!Number.isSafeInteger(body.version)||body.version<0)return communityJson({error:'Actualiza la conversación antes de continuar.'},400);
   if(match[2]==='delete'){
    if(post.authorId!==user.id)return communityJson({error:'No encontrado.'},404);
    const removed=await env.DB.prepare("UPDATE community_posts SET status='hidden',body='',title='Publicación retirada',version=version+1 WHERE id=? AND author_id=? AND version=? RETURNING id").bind(post.id,user.id,body.version).first();
    return removed?communityJson({ok:true}):communityJson({error:'La publicación cambió. Actualiza e inténtalo de nuevo.'},409);
   }
   if(user.role!=='owner')return communityJson({error:'Solo el dueño puede moderar.'},403);
   if(!['published','hidden'].includes(body.status)||!communityValid(body.reason,body.status==='hidden'?3:0,500))return communityJson({error:'Indica una decisión y un motivo al retirar contenido.'},400);
   if(post.parentId&&body.status==='published'){const parent=await communityReadPost(env,post.parentId);if(parent?.status!=='published')return communityJson({error:'La conversación original no está publicada.'},409);}
   const results=await env.DB.batch([
    env.DB.prepare('UPDATE community_posts SET status=?,version=version+1 WHERE id=? AND version=? RETURNING id').bind(body.status,post.id,body.version),
    env.DB.prepare('INSERT INTO community_moderation(id,post_id,actor_id,action,reason,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),post.id,user.id,body.status,body.reason.trim(),Date.now())
   ]);
   return results[0].results?.length?communityJson({ok:true}):communityJson({error:'La publicación cambió. Actualiza e inténtalo de nuevo.'},409);
  }
  return communityJson({error:'No encontrado.'},404);
 }catch{return communityJson({error:'No se ha podido completar la operación. Inténtalo de nuevo.'},503);}
}
export async function communityIsOwner(request,env){return (await communitySession(request,env))?.role==='owner';}
