import { authorizeOwner, listOrders, getOrder, shipOrder, updateNote, updateTracking, deliverOrder, updateReturn } from './database.mjs';
import { handlePublicReturns, handleAdminReturns } from './returns.mjs';

const privateHeaders = {'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json = (data,status=200) => new Response(JSON.stringify(data), {status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
const message = (title,text,status) => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · Fumada XXL</title><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/admin/styles.css"><main class="access"><p class="eyebrow">FUMADA XXL · ÁREA PRIVADA</p><h1>${title}</h1><p>${text}</p><a class="button" href="/">Volver a la web</a> <a href="/signout-with-chatgpt?return_to=%2Fadmin" target="_top">Cambiar de cuenta</a></main></html>`,{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});
const validVersion=n=>Number.isSafeInteger(n)&&n>=0;
const validText=(value,max,multiline=false)=>typeof value==='string'&&value.length<=max&&!(multiline?/[\x00-\x09\x0b-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value);
const returnStatuses=['requested','reviewing','approved','received','closed','rejected'];
async function readActionBody(request,limit) {
  if(Number(request.headers.get('content-length'))>limit)return {status:413,error:'Solicitud demasiado grande.'};
  // Enforce the bound while reading, including requests without Content-Length.
  const reader=request.body?.getReader();let size=0,raw='';const decoder=new TextDecoder();
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return {status:413,error:'Solicitud demasiado grande.'};}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}}
  let body;try{body=JSON.parse(raw);}catch{return {status:400,error:'Datos no válidos.'};}
  if(!body||typeof body!=='object'||Array.isArray(body))return {status:400,error:'Datos no válidos.'};
  return {body};
}
function actionPayload(action,body) {
  if(action==='ship'){
    if(!validText(body.tracking,120)||body.carrier!==undefined&&!validText(body.carrier,80)||body.expectedVersion!==undefined&&!validVersion(body.expectedVersion))return null;
    return {tracking:body.tracking.trim(),carrier:(body.carrier||'').trim(),expectedVersion:body.expectedVersion};
  }
  if(!validVersion(body.expectedVersion))return null;
  if(action==='notes')return validText(body.note,2000,true)?{note:body.note,expectedVersion:body.expectedVersion}:null;
  if(action==='tracking')return validText(body.carrier,80)&&validText(body.tracking,120)?{carrier:body.carrier.trim(),tracking:body.tracking.trim(),expectedVersion:body.expectedVersion}:null;
  if(action==='deliver')return body.confirmed===true?{expectedVersion:body.expectedVersion}:null;
  if(action==='return'){
    if(!returnStatuses.includes(body.status)||!validText(body.reason,1000,true)||!validText(body.resolution,1000,true)||body.status!=='none'&&!body.reason.trim()||['closed','rejected'].includes(body.status)&&!body.resolution.trim())return null;
    return {status:body.status,reason:body.reason.trim(),resolution:body.resolution.trim(),expectedVersion:body.expectedVersion};
  }
  return null;
}
const managementActions={ship:shipOrder,notes:updateNote,tracking:updateTracking,deliver:deliverOrder,return:updateReturn};

export function createWorker(assets) {
  return { async fetch(request,env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const api = p.startsWith('/api/admin/');
    const adminPage = p === '/admin' || p === '/admin/';
    try {
      if(p.startsWith('/api/returns/')||p==='/api/returns')return await handlePublicReturns(request,env);
      if(p==='/devoluciones'||p==='/devoluciones/'||p==='/devoluciones.html'){
        if(!['GET','HEAD'].includes(request.method))return json({error:'Método no permitido.'},405);
        return assetResponse(assets['@returns'],request,true);
      }
      if (adminPage || api) {
        const auth = await authorizeOwner(request,env);
        if (auth !== 200) {
          if (api) return json({error:auth===401?'Inicia sesión de nuevo.':'Solo la cuenta propietaria puede acceder.'},auth);
          if (auth === 401) return new Response(null,{status:302,headers:{...privateHeaders,Location:'/signin-with-chatgpt?return_to=%2Fadmin'}});
          return message('Acceso restringido','Esta zona está reservada a la cuenta propietaria de la web. Inicia sesión con esa cuenta.',403);
        }
        if (api) {
          if (p === '/api/admin/orders' && request.method === 'GET') {
            const data=await listOrders(env,url);
            return data ? json(data) : json({error:'Filtro no válido.'},400);
          }
          const returnMatch=/^\/api\/admin\/orders\/([a-zA-Z0-9_-]{1,200})\/(portal-link|portal-revoke|portal-reply|return-label|return-label-remove)$/.exec(p);
          if(returnMatch)return await handleAdminReturns(request,env,returnMatch[1],returnMatch[2]);
          const match = /^\/api\/admin\/orders\/([a-zA-Z0-9_-]{1,200})(?:\/(ship|notes|tracking|deliver|return))?$/.exec(p);
          if (match && request.method === 'GET' && !match[2]) {
            const order=await getOrder(env,match[1]);
            return order ? json({order}) : json({error:'No se ha encontrado el pedido.'},404);
          }
          if (match?.[2] && request.method === 'POST') {
            // Authenticated same-origin JSON, plus a non-simple header: no cross-site form writes.
            const action=match[2];
            if (request.headers.get('origin') !== url.origin || request.headers.get('x-admin-action') !== action || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) return json({error:'Solicitud no permitida.'},403);
            const parsed=await readActionBody(request,action==='ship'?2048:8192);
            if(parsed.status)return json({error:parsed.error},parsed.status);
            const payload=actionPayload(action,parsed.body);
            if(!payload)return json({error:'Los datos de gestión no son válidos.'},400);
            const result=await managementActions[action](env,match[1],payload);
            if(!result)return json({error:'El pedido ha cambiado o esta acción no está permitida en su estado actual. Actualiza el pedido.'},409);
            return json({ok:true,order:await getOrder(env,match[1])});
          }
          return json({error:'Ruta o método no disponible.'},404);
        }
        if (!['GET','HEAD'].includes(request.method)) return json({error:'Método no permitido.'},405);
        return assetResponse(assets['@admin'],request,true);
      }
      if (p.startsWith('/api/') || p.startsWith('/admin/') && !['/admin/styles.css','/admin/app.js'].includes(p)) return json({error:'No encontrado.'},404);
      if (!['GET','HEAD'].includes(request.method)) return new Response('Método no permitido',{status:405});
      if(p==='/index.html')return new Response(null,{status:301,headers:{Location:'/'+url.search,'Cache-Control':'public, max-age=3600'}});
      const asset=assets[p === '/'?'/index.html':p];
      if(asset?.redirect)return new Response(null,{status:301,headers:{Location:asset.redirect+url.search,'Cache-Control':'public, max-age=3600'}});
      if(asset) return assetResponse(asset,request,p.startsWith('/admin/'));
      return assets['/404.html'] ? assetResponse(assets['/404.html'],request,false,404) : new Response('No encontrado',{status:404});
    } catch {
      // Never log addresses, identity headers, request bodies, or customer data.
      console.error('Admin storage operation unavailable');
      return api ? json({error:'No se pueden cargar los pedidos ahora. Vuelve a intentarlo.'},503) : message('No disponible temporalmente','No hemos podido abrir el área privada. Vuelve a intentarlo en unos instantes.',503);
    }
  }};
}
function assetResponse(asset,request,isPrivate,status=200) {
  const headers={'Content-Type':asset.type,'X-Content-Type-Options':'nosniff',...(isPrivate?privateHeaders:{'Cache-Control':'public, max-age=0, must-revalidate'})};
  if(asset.noIndex)headers['X-Robots-Tag']='noindex, nofollow';
  if(!isPrivate&&status===200&&asset.immutable)headers['Cache-Control']='public, max-age=31536000, immutable';
  if(!isPrivate && status===200 && asset.etag) {
    headers.ETag=asset.etag;
    // GET/HEAD use weak comparison; private pages and errors never return cached content.
    const validator=asset.etag.replace(/^W\//,'');
    const matches=request.headers.get('if-none-match')?.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===validator);
    if(matches) return new Response(null,{status:304,headers});
  }
  if(status===404){headers['Cache-Control']='no-store';headers['X-Robots-Tag']='noindex, nofollow';}
  if(isPrivate) headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com";
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{status,headers});
}
