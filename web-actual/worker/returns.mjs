import { database, getOrder } from './database.mjs';

const returnPrivateHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'X-Return-Token, Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const returnJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...returnPrivateHeaders,'Content-Type':'application/json; charset=utf-8'}});
const returnConflict=()=>returnJson({error:'El pedido ha cambiado o esta acción no está permitida. Actualiza la información.'},409);
const returnInvalid=()=>returnJson({error:'Los datos no son válidos.'},400);
const returnUnavailable=()=>returnJson({error:'No se puede completar la operación ahora. Vuelve a intentarlo.'},503);
const returnUnauthorized=()=>returnJson({error:'El enlace no está disponible. Solicita un nuevo acceso a la tienda.'},401);
const returnSettledSql="payment_status IN ('paid','refunded','partially_refunded')";
const returnLabelStatesSql="return_status IN ('approved','received','closed')";
const returnVersion=n=>Number.isSafeInteger(n)&&n>=0;
const returnText=(value,max,multiline=false)=>typeof value==='string'&&value.length<=max&&!(multiline?/[\x00-\x09\x0b-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value);
const returnSameOrigin=(request,action,admin=false)=>request.headers.get('origin')===new URL(request.url).origin&&request.headers.get(admin?'x-admin-action':'x-return-action')===action;
const returnIsJson=request=>/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'');
const returnAccessAcknowledgement=()=>returnJson({ok:true,message:'Si los datos coinciden, la tienda revisará la solicitud y podrá facilitarte un enlace de acceso. No se ha enviado un correo automáticamente.'},202);
const returnLabelLimit=2*1024*1024;

async function returnReadBytes(request,limit){
  if(Number(request.headers.get('content-length'))>limit)return {error:returnJson({error:'Solicitud demasiado grande.'},413)};
  const reader=request.body?.getReader();let size=0;const chunks=[];
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return {error:returnJson({error:'Solicitud demasiado grande.'},413)};}chunks.push(value);}}finally{reader.releaseLock();}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return {bytes};
}
async function returnReadJson(request,limit=8192){
  if(!returnIsJson(request))return {error:returnJson({error:'Solicitud no permitida.'},403)};
  const result=await returnReadBytes(request,limit);if(result.error)return result;
  let body;try{body=JSON.parse(new TextDecoder().decode(result.bytes));}catch{return {error:returnInvalid()};}
  if(!body||typeof body!=='object'||Array.isArray(body))return {error:returnInvalid()};return {body};
}
async function returnDigest(value){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
function returnSecret(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
async function returnCleanup(env,key){
  if(!key||!env.FILES)return;
  try{await env.FILES.delete(key);}catch{/* A committed database change must not be reported as failed by optional cleanup. */}
}
function returnBatchSucceeded(results){if(results.some(r=>!r.success))throw new Error('Return storage unavailable');return results;}

async function returnRateAllowed(db,request,orderId){
  const now=Date.now(),start=now-15*60*1000;
  // Cloudflare overwrites this header at the ingress. No raw IP or order ID is persisted in quotas.
  const ipKey=await returnDigest('ip:'+(request.headers.get('cf-connecting-ip')||'unknown'));
  const rate=key=>db.prepare('INSERT INTO return_rate_limits (key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END, window_start=CASE WHEN window_start <= ? THEN ? ELSE window_start END RETURNING count').bind(key,now,start,start,now);
  const results=returnBatchSucceeded(await db.batch([
    db.prepare('DELETE FROM return_rate_limits WHERE key IN (SELECT key FROM return_rate_limits WHERE window_start < ? LIMIT 20)').bind(start),
    rate(ipKey),
  ]));
  // A denied IP cannot grow the table by submitting arbitrary new order IDs.
  if(results[1].results[0].count>5)return false;
  const orderQuota=await rate(await returnDigest('order:'+orderId)).first();
  return orderQuota.count<=5;
}
async function returnRequestAccess(request,env){
  if(request.method!=='POST')return returnJson({error:'Ruta o método no disponible.'},404);
  if(!returnSameOrigin(request,'access'))return returnJson({error:'Solicitud no permitida.'},403);
  const parsed=await returnReadJson(request,4096);if(parsed.error)return parsed.error;
  const {orderId,email}=parsed.body;
  if(!returnText(orderId,200)||!returnText(email,254))return returnInvalid();
  const id=orderId.trim(),normalizedEmail=email.trim().toLowerCase();
  if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id)||!/^\S+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))return returnInvalid();
  // Valid inputs always receive exactly the same acknowledgement, including quota and storage failures.
  try{
    const db=database(env);
    if(await returnRateAllowed(db,request,id))await db.prepare(`UPDATE orders SET portal_requested_at=coalesce(portal_requested_at,?) WHERE id=? AND lower(trim(email))=? AND ${returnSettledSql}`).bind(Date.now(),id,normalizedEmail).run();
  }catch{/* No existence, quota or database details are disclosed by the public access request. */}
  return returnAccessAcknowledgement();
}
async function returnTokenCase(request,env){
  const token=request.headers.get('x-return-token')||'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const tokenHash=await returnDigest(token);
  const row=await database(env).prepare(`SELECT o.id,o.return_status,o.return_kind,o.return_reason,o.customer_reply,o.return_carrier,o.return_code,o.return_label_key,o.return_label_type,o.return_label_size,o.management_version,o.payment_status,o.return_submitted_at FROM orders o JOIN return_access a ON a.order_id=o.id WHERE a.token_hash=? AND a.expires_at>? AND o.${returnSettledSql}`).bind(tokenHash,Date.now()).first();
  return row?{row,tokenHash}:null;
}
function returnCaseProjection(row){
  const showLabel=['approved','received','closed'].includes(row.return_status)&&row.return_label_key;
  return {orderId:row.id,status:row.return_status,kind:row.return_kind||'',reason:row.return_reason||'',reply:row.customer_reply||'',carrier:row.return_carrier||'',code:row.return_code||'',label:showLabel?{type:row.return_label_type,size:row.return_label_size}:null,version:row.management_version,paymentStatus:row.payment_status,submittedAt:row.return_submitted_at};
}
async function returnCustomerRequest(request,env,authenticated){
  if(!returnSameOrigin(request,'request'))return returnJson({error:'Solicitud no permitida.'},403);
  const parsed=await returnReadJson(request);if(parsed.error)return parsed.error;
  const {kind,reason='',expectedVersion}=parsed.body;
  if(!['withdrawal','damaged','wrong','other'].includes(kind)||!returnText(reason,1000,true)||!returnVersion(expectedVersion)||kind!=='withdrawal'&&!reason.trim())return returnInvalid();
  const {row,tokenHash}=authenticated;
  const submittedAt=Date.now();
  const changed=await database(env).prepare(`UPDATE orders SET return_status='requested',return_kind=?,return_reason=?,return_resolution='',customer_reply='',return_code='',return_carrier='',return_label_key=NULL,return_label_type=NULL,return_label_size=NULL,return_updated_at=?,return_submitted_at=?,management_version=management_version+1 WHERE id=? AND management_version=? AND ${returnSettledSql} AND return_status IN ('none','closed','rejected') AND EXISTS(SELECT 1 FROM return_access WHERE order_id=orders.id AND token_hash=? AND expires_at>?) RETURNING id`).bind(kind,reason.trim()||'Desistimiento sin motivo indicado.',submittedAt,submittedAt,row.id,expectedVersion,tokenHash,Date.now()).first();
  if(!changed)return returnConflict();
  await returnCleanup(env,row.return_label_key);
  const updated=await returnTokenCase(request,env);return updated?returnJson({ok:true,case:returnCaseProjection(updated.row)}):returnUnauthorized();
}
async function returnCustomerLabel(request,env,authenticated){
  if(!returnSameOrigin(request,'download'))return returnJson({error:'Solicitud no permitida.'},403);
  const row=authenticated.row;
  if(!['approved','received','closed'].includes(row.return_status)||!row.return_label_key)return returnJson({error:'La etiqueta no está disponible.'},404);
  if(!env.FILES)return returnUnavailable();
  const object=await env.FILES.get(row.return_label_key);if(!object)return returnJson({error:'La etiqueta no está disponible.'},404);
  const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[row.return_label_type];
  if(!ext||object.size>returnLabelLimit||object.size!==row.return_label_size)return returnUnavailable();
  return new Response(object.body,{headers:{...returnPrivateHeaders,'Content-Type':row.return_label_type,'Content-Length':String(object.size),'Content-Disposition':`attachment; filename="etiqueta-devolucion.${ext}"`,'Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'"}});
}
export async function handlePublicReturns(request,env){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/returns/')&&path!=='/api/returns')return null;
  try{
    if(path==='/api/returns/access')return await returnRequestAccess(request,env);
    if(path==='/api/returns/case'&&['GET','POST'].includes(request.method)||path==='/api/returns/label'&&request.method==='POST'){
      const authenticated=await returnTokenCase(request,env);if(!authenticated)return returnUnauthorized();
      if(path==='/api/returns/label')return await returnCustomerLabel(request,env,authenticated);
      return request.method==='GET'?returnJson({case:returnCaseProjection(authenticated.row)}):await returnCustomerRequest(request,env,authenticated);
    }
    return returnJson({error:'Ruta o método no disponible.'},404);
  }catch{return returnUnavailable();}
}

async function returnIssueLink(env,id,expectedVersion){
  const db=database(env),token=returnSecret(),tokenHash=await returnDigest(token),expiresAt=Date.now()+30*24*60*60*1000;
  // One transaction: the token rotation and order version can only both commit for the expected version.
  const results=returnBatchSucceeded(await db.batch([
    db.prepare(`INSERT INTO return_access(order_id,token_hash,expires_at) SELECT id,?,? FROM orders WHERE id=? AND management_version=? AND ${returnSettledSql} ON CONFLICT(order_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at RETURNING order_id`).bind(tokenHash,expiresAt,id,expectedVersion),
    db.prepare(`UPDATE orders SET portal_requested_at=NULL,management_version=management_version+1 WHERE id=? AND management_version=? AND ${returnSettledSql} RETURNING id`).bind(id,expectedVersion),
  ]));
  if(!results[1].results.length)return returnConflict();
  return returnJson({ok:true,path:'/devoluciones#token='+token,expiresAt,order:await getOrder(env,id)});
}
async function returnRevokeLink(env,id,expectedVersion){
  const db=database(env);
  const results=returnBatchSucceeded(await db.batch([
    db.prepare(`DELETE FROM return_access WHERE order_id IN (SELECT id FROM orders WHERE id=? AND management_version=? AND ${returnSettledSql})`).bind(id,expectedVersion),
    db.prepare(`UPDATE orders SET management_version=management_version+1 WHERE id=? AND management_version=? AND ${returnSettledSql} RETURNING id`).bind(id,expectedVersion),
  ]));
  return results[1].results.length?returnJson({ok:true,order:await getOrder(env,id)}):returnConflict();
}
async function returnOwnerReply(env,id,body){
  const {reply,code='',carrier='',expectedVersion}=body;
  if(!returnText(reply,2000,true)||!returnText(code,200)||!returnText(carrier,80))return returnInvalid();
  const changed=await database(env).prepare(`UPDATE orders SET customer_reply=?,return_code=?,return_carrier=?,return_updated_at=?,management_version=management_version+1 WHERE id=? AND management_version=? AND ${returnSettledSql} AND (?='' AND ?='' OR ${returnLabelStatesSql}) RETURNING id`).bind(reply,code.trim(),carrier.trim(),Date.now(),id,expectedVersion,code.trim(),carrier.trim()).first();
  return changed?returnJson({ok:true,order:await getOrder(env,id)}):returnConflict();
}
function returnLabelMagic(bytes,type){
  if(type==='application/pdf')return bytes.length>=5&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d;
  if(type==='image/png')return bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((b,i)=>bytes[i]===b);
  if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  return false;
}
async function returnUploadLabel(request,env,id){
  const rawVersion=request.headers.get('x-order-version')||'';
  if(!/^\d{1,16}$/.test(rawVersion)||!returnVersion(Number(rawVersion)))return returnInvalid();
  const expectedVersion=Number(rawVersion),type=(request.headers.get('content-type')||'').trim().toLowerCase();
  if(!['application/pdf','image/png','image/jpeg'].includes(type))return returnInvalid();
  const parsed=await returnReadBytes(request,returnLabelLimit);if(parsed.error)return parsed.error;
  if(!returnLabelMagic(parsed.bytes,type))return returnInvalid();
  const db=database(env);
  const old=await db.prepare(`SELECT return_label_key FROM orders WHERE id=? AND management_version=? AND ${returnSettledSql} AND ${returnLabelStatesSql}`).bind(id,expectedVersion).first();
  if(!old)return returnConflict();
  if(!env.FILES)return returnUnavailable();
  const key='return-labels/'+returnSecret();
  await env.FILES.put(key,parsed.bytes,{httpMetadata:{contentType:type}});
  let changed;
  try{changed=await db.prepare(`UPDATE orders SET return_label_key=?,return_label_type=?,return_label_size=?,return_updated_at=?,management_version=management_version+1 WHERE id=? AND management_version=? AND ${returnSettledSql} AND ${returnLabelStatesSql} RETURNING id`).bind(key,type,parsed.bytes.byteLength,Date.now(),id,expectedVersion).first();}
  catch(error){await returnCleanup(env,key);throw error;}
  if(!changed){await returnCleanup(env,key);return returnConflict();}
  await returnCleanup(env,old.return_label_key);
  return returnJson({ok:true,order:await getOrder(env,id)});
}
async function returnRemoveLabel(env,id,expectedVersion){
  const db=database(env);
  const old=await db.prepare(`SELECT return_label_key FROM orders WHERE id=? AND management_version=? AND ${returnSettledSql} AND ${returnLabelStatesSql}`).bind(id,expectedVersion).first();
  if(!old)return returnConflict();
  const changed=await db.prepare(`UPDATE orders SET return_label_key=NULL,return_label_type=NULL,return_label_size=NULL,return_updated_at=?,management_version=management_version+1 WHERE id=? AND management_version=? AND ${returnSettledSql} AND ${returnLabelStatesSql} RETURNING id`).bind(Date.now(),id,expectedVersion).first();
  if(!changed)return returnConflict();await returnCleanup(env,old.return_label_key);
  return returnJson({ok:true,order:await getOrder(env,id)});
}
// This handler is called only after index.mjs authorizes the owner on the server.
export async function handleAdminReturns(request,env,id,action){
  if(!['portal-link','portal-revoke','portal-reply','return-label','return-label-remove'].includes(action))return null;
  if(request.method!=='POST')return returnJson({error:'Ruta o método no disponible.'},404);
  if(!returnSameOrigin(request,action,true))return returnJson({error:'Solicitud no permitida.'},403);
  try{
    if(action==='return-label')return await returnUploadLabel(request,env,id);
    const parsed=await returnReadJson(request);if(parsed.error)return parsed.error;
    if(!returnVersion(parsed.body.expectedVersion))return returnInvalid();
    if(action==='portal-link')return await returnIssueLink(env,id,parsed.body.expectedVersion);
    if(action==='portal-revoke')return await returnRevokeLink(env,id,parsed.body.expectedVersion);
    if(action==='portal-reply')return await returnOwnerReply(env,id,parsed.body);
    return await returnRemoveLabel(env,id,parsed.body.expectedVersion);
  }catch{return returnUnavailable();}
}
