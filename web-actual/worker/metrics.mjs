import {communityHash,communityIsOwner} from './community.mjs';
const metricsHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
const metricsJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:metricsHeaders});
export async function handleMetrics(request,env){
 try{
  const url=new URL(request.url);
  if(url.pathname==='/api/site-metrics'&&request.method==='GET'){
   if(!await communityIsOwner(request,env))return metricsJson({error:'Acceso privado.'},403);
   const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);const data=await env.DB.prepare('SELECT day,event,page,count FROM site_metrics WHERE day>=? ORDER BY day DESC,event,page').bind(since).all();return metricsJson({days:30,rows:data.results,note:'Eventos de visitantes que aceptaron la analítica. Los clics no son ventas confirmadas en Amazon.'});
  }
  if(url.pathname!=='/api/event'||request.method!=='POST')return metricsJson({error:'No encontrado.'},404);
  if(request.headers.get('origin')!==url.origin||request.headers.get('x-site-event')!=='1'||request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1'||!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return metricsJson({error:'No permitido.'},403);
  const reader=request.body?.getReader();if(!reader)return metricsJson({},400);let size=0,raw='';const decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>400){await reader.cancel();return metricsJson({},413);}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
  let body;try{body=JSON.parse(raw);}catch{return metricsJson({},400);}
  if(body?.consent!==true||!['view','amazon','whatsapp'].includes(body.event)||!['home','community','legal'].includes(body.page))return metricsJson({},400);
  const now=Date.now(),key=await communityHash('metric:'+request.headers.get('cf-connecting-ip')+':'+Math.floor(now/3600000));
  const limit=await env.DB.prepare('INSERT INTO community_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+3600000).first();if(limit.count>100)return metricsJson({},429);
  const day=new Date().toISOString().slice(0,10);await env.DB.prepare('INSERT INTO site_metrics(day,event,page,count) VALUES(?,?,?,1) ON CONFLICT(day,event,page) DO UPDATE SET count=count+1').bind(day,body.event,body.page).run();
  await env.DB.prepare('DELETE FROM site_metrics WHERE day<?').bind(new Date(now-90*86400000).toISOString().slice(0,10)).run();await env.DB.prepare('DELETE FROM community_limits WHERE expires_at<?').bind(now-86400000).run();return new Response(null,{status:204,headers:metricsHeaders});
 }catch{return metricsJson({error:'No disponible.'},503);}
}
