import {authorizeOwner} from './database.mjs';
import {handleCommunity,communityIsOwner} from './community.mjs';
import {handleMetrics} from './metrics.mjs';
const sitePrivateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const siteSecurityHeaders={'X-Content-Type-Options':'nosniff','Strict-Transport-Security':'max-age=31536000','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const siteJson=(data,status)=>new Response(JSON.stringify(data),{status,headers:{...siteSecurityHeaders,...sitePrivateHeaders,'Content-Type':'application/json; charset=utf-8'}});
const siteRedirect=(to,status=301)=>new Response(null,{status,headers:{...siteSecurityHeaders,Location:to,'Cache-Control':'no-store'}});
const sitePages={'/comunidad':'/comunidad.html','/aviso-legal':'/aviso-legal.html','/privacidad':'/privacidad.html','/cookies':'/cookies.html','/condiciones-de-venta':'/condiciones-de-venta.html','/normas-comunidad':'/normas-comunidad.html'};
export function createPublicWorker(assets){return {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(['www.prueba-aleix.com','fumada-xxl-aleix.scroll-magenta-7y.chatgpt.site'].includes(url.hostname)){url.hostname='prueba-aleix.com';url.protocol='https:';return siteRedirect(url.href,request.method==='GET'||request.method==='HEAD'?301:308);}
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){url.protocol='https:';return siteRedirect(url.href,request.method==='GET'||request.method==='HEAD'?301:308);}
 try{
  if(path.startsWith('/auth/google/')||path.startsWith('/api/community/'))return await handleCommunity(request,env);
  if(path==='/api/event'||path==='/api/site-metrics')return await handleMetrics(request,env);
  if(path.startsWith('/api/'))return siteJson({error:'No encontrado.'},404);
  if(!['GET','HEAD'].includes(request.method))return siteJson({error:'Método no permitido.'},405);
  if(path==='/propietario'){
   const allowed=await authorizeOwner(request,env);if(allowed!==200&&!await communityIsOwner(request,env)){if(allowed!==401)return siteJson({error:'Solo la cuenta titular puede acceder.'},403);const redirect=siteRedirect('/signin-with-chatgpt?return_to=%2Fpropietario',302);for(const [key,value]of Object.entries(sitePrivateHeaders))redirect.headers.set(key,value);return redirect;}
   return siteAsset(assets['@owner'],request,true);
  }
  if(path==='/admin'||path==='/admin/')return siteRedirect('/propietario');
  if(['/devoluciones','/devoluciones/','/devoluciones.html'].includes(path))return siteRedirect('/condiciones-de-venta#amazon');
  if(path==='/demo'||path.startsWith('/demo/')||path==='/tienda-demo.html')return siteAsset(assets['/404.html'],request,false,410);
  if(path==='/'&&url.searchParams.has('demo')){url.searchParams.delete('demo');return siteRedirect(url.pathname+url.search);}
  if(path==='/index.html')return siteRedirect('/'+url.search);
  for(const [clean,file]of Object.entries(sitePages))if(path===file||path===clean+'/')return siteRedirect(clean+url.search);
  if(path==='/health'){await env.DB.prepare('SELECT 1 AS ok').first();return siteJson({ok:true},200);}
  const asset=assets[path==='/'?'/index.html':sitePages[path]||path];
  if(asset?.redirect)return siteRedirect(asset.redirect+url.search);
  return asset?siteAsset(asset,request,false):siteAsset(assets['/404.html'],request,false,404);
 }catch{return siteJson({error:'No disponible temporalmente. Inténtalo de nuevo.'},503);}
}};}
function siteAsset(asset,request,privatePage=false,status=200){
 if(!asset)return siteJson({error:'No encontrado.'},404);
 const headers={...siteSecurityHeaders,'Content-Type':asset.type,...(privatePage?sitePrivateHeaders:{'Cache-Control':asset.immutable?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'})};
 if(status!==200){headers['Cache-Control']='no-store';headers['X-Robots-Tag']='noindex, nofollow';}
 if(!privatePage&&status===200&&asset.etag){headers.ETag=asset.etag;const tag=asset.etag.replace(/^W\//,'');if(request.headers.get('if-none-match')?.split(',').some(v=>v.trim()==='*'||v.trim().replace(/^W\//,'')===tag))return new Response(null,{status:304,headers});}
 if(asset.type.includes('text/html'))headers['Content-Security-Policy']="default-src 'self'; script-src 'self' 'sha256-"+asset.jsonLdHash+"'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com";
 return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{status,headers});
}
