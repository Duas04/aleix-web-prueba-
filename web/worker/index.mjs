import { authorizeOwner, listOrders, getOrder, shipOrder } from './database.mjs';

const privateHeaders = {'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json = (data,status=200) => new Response(JSON.stringify(data), {status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
const message = (title,text,status) => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · Fumada XXL</title><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/admin/styles.css"><main class="access"><p class="eyebrow">FUMADA XXL · ÁREA PRIVADA</p><h1>${title}</h1><p>${text}</p><a class="button" href="/">Volver a la web</a> <a href="/signout-with-chatgpt?return_to=%2Fadmin" target="_top">Cambiar de cuenta</a></main></html>`,{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}});

export function createWorker(assets) {
  return { async fetch(request,env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const api = p.startsWith('/api/admin/');
    const adminPage = p === '/admin' || p === '/admin/';
    try {
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
          const match = /^\/api\/admin\/orders\/([a-zA-Z0-9_-]{1,200})(\/ship)?$/.exec(p);
          if (match && request.method === 'GET' && !match[2]) {
            const order=await getOrder(env,match[1]);
            return order ? json({order}) : json({error:'No se ha encontrado el pedido.'},404);
          }
          if (match?.[2] && request.method === 'POST') {
            // Authenticated same-origin JSON, plus a non-simple header: no cross-site form writes.
            if (request.headers.get('origin') !== url.origin || request.headers.get('x-admin-action') !== 'ship' || !request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Solicitud no permitida.'},403);
            if (Number(request.headers.get('content-length')) > 2048) return json({error:'Solicitud demasiado grande.'},413);
            const raw=await request.text();
            if(raw.length>2048) return json({error:'Solicitud demasiado grande.'},413);
            let body; try { body=JSON.parse(raw); } catch { return json({error:'Datos no válidos.'},400); }
            if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.tracking !== 'string' || body.tracking.length>120 || /[\x00-\x1f]/.test(body.tracking)) return json({error:'El seguimiento no es válido.'},400);
            const result=await shipOrder(env,match[1],body.tracking.trim());
            return result ? json({ok:true}) : json({error:'Solo se pueden enviar pedidos pagados y pendientes. Actualiza el pedido.'},409);
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
