import { database } from './database.mjs';

const demoHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'X-Demo-Session','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const demoJson=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...demoHeaders,'Content-Type':'application/json; charset=utf-8'}});
function demoFail(status,message){const error=new Error(message);error.demoStatus=status;throw error;}
const demoVersion=n=>Number.isSafeInteger(n)&&n>=0;
const demoActiveCase=order=>['requested','reviewing','approved','received'].includes(order.return_status);
const demoSettled=order=>['paid','refunded','partially_refunded'].includes(order.payment_status);
const demoLabelAllowed=order=>['approved','received','closed'].includes(order.return_status);
const demoStateTransitions={none:['requested'],requested:['reviewing','approved','rejected'],reviewing:['approved','rejected'],approved:['received','closed'],received:['closed'],closed:['requested'],rejected:['requested']};
function demoTextValue(value,max,multiline=false){
  if(typeof value!=='string'||value.length>max||(multiline?/[\x00-\x09\x0b-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value))demoFail(400,'Revisa los datos introducidos.');
  return value.trim();
}
function demoKeys(body,allowed){if(Object.keys(body).some(key=>!allowed.includes(key)))demoFail(400,'Usa únicamente los datos ficticios previstos para esta demostración.');}
function demoRequireMutation(request,action){
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-demo-action')!==action||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))demoFail(403,'Solicitud no permitida.');
}
async function demoReadBody(request){
  const limit=8192;if(Number(request.headers.get('content-length'))>limit)demoFail(413,'Solicitud demasiado grande.');
  const reader=request.body?.getReader();let size=0,raw='';const decoder=new TextDecoder();
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();demoFail(413,'Solicitud demasiado grande.');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}}
  let body;try{body=JSON.parse(raw);}catch{demoFail(400,'Datos no válidos.');}
  if(!body||typeof body!=='object'||Array.isArray(body))demoFail(400,'Datos no válidos.');return body;
}
async function demoHash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
function demoNewSecret(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function demoNewOrderId(){return 'DEMO-'+Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
function demoFictionalOrder(input){
  return {created_at:Date.now(),customer_name:'Persona de ejemplo',email:'compra-ficticia@example.invalid',recipient:'Persona de ejemplo',address1:'Calle de ejemplo, sin dirección real',address2:'Datos ficticios · No realizar envíos',city:'Ciudad de ejemplo',postal_code:'00000',region:'Provincia de ejemplo',country:'ES',phone:null,shipping:700,paid_at:null,shipped_at:null,tracking:null,carrier:'',delivered_at:null,private_note:'',note_updated_at:null,return_status:'none',return_reason:'',return_resolution:'',return_updated_at:null,management_version:0,portal_requested_at:null,customer_reply:'',return_kind:'',return_code:'',return_carrier:'',return_label_key:null,return_label_type:null,return_label_size:null,return_submitted_at:null,demo_portal_revoked:false,...input};
}
function demoSeed(){
  const orders=[
    {id:'DEMO-001',customer_name:'Persona de ejemplo A',email:'ejemplo-a@example.invalid',edition:'paperback',quantity:1,subtotal:1500,total:2200,payment_status:'paid',fulfillment_status:'pending'},
    {id:'DEMO-002',customer_name:'Persona de ejemplo B',email:'ejemplo-b@example.invalid',edition:'hardcover',quantity:2,subtotal:3500,total:4200,payment_status:'paid',fulfillment_status:'shipped',items:[{edition:'paperback',quantity:1,unit_price:1500,subtotal:1500},{edition:'hardcover',quantity:1,unit_price:2000,subtotal:2000}],return_status:'requested',return_reason:'El libro de tapa dura ha llegado con la cubierta doblada. Solicito una devolución.',return_updated_at:1790590000000,private_note:'Ejemplo: revisar el embalaje antes de resolver la solicitud.',portal_requested_at:1790590000000,return_kind:'damaged',return_submitted_at:1790590000000},
    {id:'DEMO-003',customer_name:'Persona de ejemplo C',email:'ejemplo-c@example.invalid',edition:'hardcover',quantity:1,subtotal:2000,total:2700,payment_status:'pending',fulfillment_status:'pending'},
    {id:'DEMO-004',customer_name:'Persona de ejemplo D',email:'ejemplo-d@example.invalid',edition:'hardcover',quantity:1,subtotal:2000,total:2700,payment_status:'refunded',fulfillment_status:'shipped',paid_at:1790586000000,delivered_at:1790589000000,return_status:'closed',return_reason:'El libro ha llegado con la tapa doblada y varias páginas dañadas.',return_resolution:'Ejemplo de reembolso completo ya confirmado: 27 € con envío. No se ha devuelto dinero real.',return_updated_at:1790590000000},
  ].map((order,i)=>demoFictionalOrder({created_at:1790586000000-i*3600000,recipient:order.customer_name,paid_at:order.payment_status==='paid'?1790586000000:null,shipped_at:order.fulfillment_status==='shipped'?1790587000000:null,tracking:order.fulfillment_status==='shipped'?'SEGUIMIENTO-FICTICIO':null,carrier:order.fulfillment_status==='shipped'?'Transportista de ejemplo':'',items:[{edition:order.edition,quantity:order.quantity,unit_price:order.subtotal/order.quantity,subtotal:order.subtotal}],...order}));
  return {orders,purchases:{}};
}
async function demoCreateSession(request,env){
  demoRequireMutation(request,'session');const body=await demoReadBody(request);demoKeys(body,[]);
  const db=database(env),now=Date.now(),start=now-15*60*1000;
  const key=await demoHash('demo-session:ip:'+(request.headers.get('cf-connecting-ip')||'unknown'));
  await db.prepare('DELETE FROM return_rate_limits WHERE key IN (SELECT key FROM return_rate_limits WHERE window_start < ? LIMIT 20)').bind(start).run();
  const rate=await db.prepare('INSERT INTO return_rate_limits(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<=? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<=? THEN ? ELSE window_start END RETURNING count').bind(key,now,start,start,now).first();
  if(rate.count>5)demoFail(429,'Has creado varias demostraciones. Vuelve a intentarlo en quince minutos.');
  await db.prepare('DELETE FROM demo_sessions WHERE token_hash IN (SELECT token_hash FROM demo_sessions WHERE expires_at<=? LIMIT 20)').bind(now).run();
  const token=demoNewSecret(),hash=await demoHash(token),expiresAt=now+7*86400000;
  // The capacity check and insertion execute in one atomic SQLite statement.
  const inserted=await db.prepare('INSERT INTO demo_sessions(token_hash,expires_at,data,revision) SELECT ?,?,?,0 WHERE (SELECT count(*) FROM demo_sessions WHERE expires_at>?)<250 RETURNING token_hash').bind(hash,expiresAt,JSON.stringify(demoSeed()),now).first();
  if(!inserted)demoFail(429,'La demostración está ocupada. Vuelve a intentarlo más tarde.');
  return demoJson({token,expiresAt});
}
async function demoReadSession(env,hash){
  const row=await database(env).prepare('SELECT data,revision,expires_at FROM demo_sessions WHERE token_hash=? AND expires_at>?').bind(hash,Date.now()).first();
  if(!row)demoFail(401,'La sesión de demostración no está disponible. Crea una nueva.');
  const state=JSON.parse(row.data);if(!Array.isArray(state.orders)||state.orders.length>20||!state.purchases||typeof state.purchases!=='object'||Array.isArray(state.purchases))throw new Error('Invalid demo state');
  return {state,revision:row.revision,expiresAt:row.expires_at};
}
async function demoMutateSession(env,hash,apply){
  for(let attempt=0;attempt<4;attempt++){
    const session=await demoReadSession(env,hash),result=apply(session.state,session.expiresAt);
    if(result.unchanged)return demoJson(result.body);
    const changed=await database(env).prepare('UPDATE demo_sessions SET data=?,revision=revision+1 WHERE token_hash=? AND revision=? AND expires_at>? RETURNING revision').bind(JSON.stringify(session.state),hash,session.revision,Date.now()).first();
    if(changed)return demoJson(result.body);
    // Re-read and re-apply: unrelated order edits merge; an obsolete order version fails explicitly.
  }
  demoFail(409,'La demostración ha cambiado. Actualiza y vuelve a intentarlo.');
}
function demoFindOrder(state,id){const order=state.orders.find(o=>o.id===id);if(!order)demoFail(404,'Pedido ficticio no encontrado.');return order;}
function demoCase(order){return {orderId:order.id,status:order.return_status,kind:order.return_kind,reason:order.return_reason,reply:order.customer_reply,carrier:order.return_carrier,code:order.return_code,label:demoLabelAllowed(order)&&order.return_label_key?{type:order.return_label_type,size:order.return_label_size}:null,version:order.management_version,paymentStatus:order.payment_status,submittedAt:order.return_submitted_at};}
function demoCustomerAllowed(order){if(order.demo_portal_revoked)demoFail(401,'El acceso ficticio se ha revocado. Genera otro enlace desde el panel.');if(!demoSettled(order))demoFail(409,'El pedido ficticio no admite devoluciones en su estado actual.');}
function demoResetCase(order,now){Object.assign(order,{customer_reply:'',return_kind:'',return_code:'',return_carrier:'',return_label_key:null,return_label_type:null,return_label_size:null,return_submitted_at:now});}
function demoCheckVersion(order,body){if(!demoVersion(body.expectedVersion))demoFail(400,'Indica una versión válida del pedido ficticio.');if(body.expectedVersion!==order.management_version)demoFail(409,'El pedido ficticio ha cambiado. Actualízalo antes de guardar.');}
function demoPurchase(state,body){
  demoKeys(body,['items','requestId']);
  if(typeof body.requestId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(body.requestId)||!body.items||typeof body.items!=='object'||Array.isArray(body.items))demoFail(400,'Datos de compra ficticia no válidos.');
  demoKeys(body.items,['paperback','hardcover']);
  const quantities={paperback:Object.hasOwn(body.items,'paperback')?body.items.paperback:0,hardcover:Object.hasOwn(body.items,'hardcover')?body.items.hardcover:0};
  if(Object.values(quantities).some(n=>!Number.isInteger(n)||n<0||n>10)||quantities.paperback+quantities.hardcover<1)demoFail(400,'Selecciona entre uno y diez ejemplares de cada edición.');
  const requestId=body.requestId.toLowerCase(),signature=JSON.stringify(quantities),previous=state.purchases[requestId];
  if(previous){if(previous.signature!==signature)demoFail(409,'Esta compra ficticia ya se confirmó con otra selección.');const order=demoFindOrder(state,previous.orderId);return {unchanged:true,body:{order,case:demoCase(order)}};}
  if(state.orders.length>=20)demoFail(409,'Esta demostración admite veinte pedidos, incluidos los cuatro ejemplos. Crea otra para seguir probando.');
  const items=Object.entries(quantities).filter(([,quantity])=>quantity>0).map(([edition,quantity])=>({edition,quantity,unit_price:edition==='paperback'?1500:2000,subtotal:quantity*(edition==='paperback'?1500:2000)}));
  const subtotal=items.reduce((sum,item)=>sum+item.subtotal,0),now=Date.now();let id=demoNewOrderId();while(state.orders.some(o=>o.id===id))id=demoNewOrderId();
  const order=demoFictionalOrder({id,created_at:now,edition:items[0].edition,quantity:quantities.paperback+quantities.hardcover,items,subtotal,total:subtotal+700,payment_status:'paid',fulfillment_status:'pending',paid_at:now});
  state.orders.push(order);state.purchases[requestId]={orderId:id,signature};return {body:{order,case:demoCase(order)}};
}
function demoCustomerRequest(state,id,body){
  demoKeys(body,['kind','reason','expectedVersion']);const order=demoFindOrder(state,id);demoCustomerAllowed(order);demoCheckVersion(order,body);
  const kind=body.kind,reason=demoTextValue(body.reason??'',1000,true);
  if(!['withdrawal','damaged','wrong','other'].includes(kind)||kind!=='withdrawal'&&!reason)demoFail(400,'Indica el motivo de esta devolución ficticia.');
  if(!['none','closed','rejected'].includes(order.return_status))demoFail(409,'Este pedido ya tiene una solicitud ficticia en curso.');
  const now=Date.now();demoResetCase(order,now);Object.assign(order,{return_kind:kind,return_reason:reason||'Desistimiento sin motivo indicado.',return_resolution:'',return_status:'requested',return_updated_at:now,management_version:order.management_version+1});
  return {body:{ok:true,case:demoCase(order)}};
}
function demoAdminMutation(state,id,action,body,token,expiresAt){
  const order=demoFindOrder(state,id);demoCheckVersion(order,body);const now=Date.now();
  const keys={ship:['tracking','carrier'],notes:['note'],tracking:['tracking','carrier'],deliver:['confirmed'],return:['status','reason','resolution'],'portal-link':[],'portal-revoke':[],'portal-reply':['reply','code','carrier'],'return-label':['type','size'],'return-label-remove':[]};
  demoKeys(body,[...keys[action],'expectedVersion']);
  if(action.startsWith('portal-')||action.startsWith('return-label')){if(!demoSettled(order))demoFail(409,'Este pedido ficticio no admite esta gestión.');}
  if(action==='ship'){
    const tracking=demoTextValue(body.tracking,120),carrier=demoTextValue(body.carrier??'',80);
    if(order.payment_status!=='paid'||order.fulfillment_status!=='pending'||demoActiveCase(order))demoFail(409,'El pedido ficticio no está listo para enviar.');Object.assign(order,{fulfillment_status:'shipped',shipped_at:now,tracking,carrier});
  }else if(action==='notes'){order.private_note=demoTextValue(body.note,2000,true);order.note_updated_at=now;}
  else if(action==='tracking'){
    const tracking=demoTextValue(body.tracking,120),carrier=demoTextValue(body.carrier,80);
    if(order.fulfillment_status!=='shipped'||order.delivered_at!==null)demoFail(409,'Solo se puede editar un envío ficticio pendiente de entrega.');Object.assign(order,{tracking,carrier});
  }else if(action==='deliver'){
    if(body.confirmed!==true)demoFail(400,'Confirma la entrega ficticia.');if(order.fulfillment_status!=='shipped'||order.delivered_at!==null)demoFail(409,'No hay una entrega ficticia pendiente.');order.delivered_at=now;
  }else if(action==='return'){
    const reason=demoTextValue(body.reason,1000,true),resolution=demoTextValue(body.resolution,1000,true),status=body.status;
    if(!Object.hasOwn(demoStateTransitions,status)||status==='none'||!reason||['closed','rejected'].includes(status)&&!resolution)demoFail(400,'Indica un motivo y una resolución al cerrar la solicitud ficticia.');
    if(!demoSettled(order)||status!==order.return_status&&!demoStateTransitions[order.return_status].includes(status))demoFail(409,'El cambio de estado ficticio no está permitido.');
    if(status==='requested'&&order.return_status!=='requested')demoResetCase(order,now);Object.assign(order,{return_status:status,return_reason:reason,return_resolution:resolution,return_updated_at:now});
  }else if(action==='portal-link'){order.demo_portal_revoked=false;order.portal_requested_at=null;}
  else if(action==='portal-revoke'){order.demo_portal_revoked=true;order.portal_requested_at=null;}
  else if(action==='portal-reply'){
    const reply=demoTextValue(body.reply,2000,true),code=demoTextValue(body.code??'',200),carrier=demoTextValue(body.carrier??'',80);
    if((code||carrier)&&!demoLabelAllowed(order))demoFail(409,'Aprueba la devolución ficticia antes de indicar el transporte.');Object.assign(order,{customer_reply:reply,return_code:code,return_carrier:carrier,return_updated_at:now});
  }else if(action==='return-label'){
    if(!['application/pdf','image/png','image/jpeg'].includes(body.type)||!Number.isInteger(body.size)||body.size<1||body.size>2*1024*1024)demoFail(400,'Simula un PDF, PNG o JPEG de hasta dos megabytes.');
    if(!demoLabelAllowed(order))demoFail(409,'Aprueba la devolución ficticia antes de simular una etiqueta.');Object.assign(order,{return_label_key:'DEMO-NO-VALIDA-PARA-ENVIOS',return_label_type:body.type,return_label_size:body.size,return_updated_at:now});
  }else if(action==='return-label-remove'){
    if(!demoLabelAllowed(order))demoFail(409,'Este pedido ficticio no admite gestionar la etiqueta.');Object.assign(order,{return_label_key:null,return_label_type:null,return_label_size:null,return_updated_at:now});
  }
  order.management_version++;
  const result={ok:true,order};if(action==='portal-link')Object.assign(result,{path:'/devoluciones?demo=1#session='+token+'&order='+order.id,expiresAt});return {body:result};
}
function demoList(state,url){
  const checks={all:()=>true,pending:o=>o.payment_status==='paid'&&o.fulfillment_status==='pending'&&!demoActiveCase(o),shipped:o=>o.fulfillment_status==='shipped',unpaid:o=>o.payment_status==='pending',incidents:o=>['failed','refunded','partially_refunded'].includes(o.payment_status)||demoActiveCase(o),attention:o=>['failed','partially_refunded'].includes(o.payment_status)||demoActiveCase(o),returns:demoActiveCase,access_requests:o=>o.portal_requested_at!==null,delivered:o=>o.delivered_at!==null};
  const filter=url.searchParams.get('filter')||'all';if(!Object.hasOwn(checks,filter))demoFail(400,'Filtro no válido.');
  const fold=value=>value.normalize('NFD').replace(/[\u0301\u0308\u0303]/g,'').toLowerCase();const query=fold((url.searchParams.get('q')||'').trim().slice(0,120));
  const page=Math.max(1,Math.min(1000000,Number.parseInt(url.searchParams.get('page'),10)||1));
  const orders=state.orders.filter(o=>checks[filter](o)&&[o.customer_name,o.email,o.id].some(value=>fold(value).includes(query))).sort((a,b)=>b.created_at-a.created_at||(a.id<b.id?1:a.id>b.id?-1:0));
  const stats={total:state.orders.length,pending:state.orders.filter(checks.pending).length,shipped:state.orders.filter(checks.shipped).length,incidents:state.orders.filter(checks.attention).length,returns:state.orders.filter(checks.returns).length,delivered:state.orders.filter(checks.delivered).length,accessRequests:state.orders.filter(checks.access_requests).length};
  const rows=orders.slice((page-1)*20,page*20).map(({id,created_at,customer_name,email,edition,quantity,subtotal,total,payment_status,fulfillment_status,carrier,tracking,delivered_at,return_status,management_version,portal_requested_at,items})=>({id,created_at,customer_name,email,edition,quantity,subtotal,total,payment_status,fulfillment_status,carrier,tracking,delivered_at,return_status,management_version,portal_requested_at,items}));
  return {orders:rows,count:orders.length,page,paymentConnected:false,stats};
}
export async function handleDemo(request,env){
  const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/demo/')&&path!=='/api/demo')return null;
  try{
    if(path==='/api/demo/session'){if(request.method!=='POST')demoFail(404,'Ruta o método no disponible.');return await demoCreateSession(request,env);}
    const token=request.headers.get('x-demo-session')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))demoFail(401,'La sesión de demostración no está disponible. Crea una nueva.');const hash=await demoHash(token);
    if(request.method==='GET'){
      const {state}=await demoReadSession(env,hash);
      if(path==='/api/demo/admin/orders')return demoJson(demoList(state,url));
      const detail=/^\/api\/demo\/admin\/orders\/(DEMO-(?:\d{3}|[A-F0-9]{12}))$/.exec(path);if(detail)return demoJson({order:demoFindOrder(state,detail[1])});
      const buyer=/^\/api\/demo\/returns\/(DEMO-(?:\d{3}|[A-F0-9]{12}))$/.exec(path);if(buyer){const order=demoFindOrder(state,buyer[1]);demoCustomerAllowed(order);return demoJson({case:demoCase(order)});}
    }
    if(request.method==='POST'){
      // Authentication precedes payload processing; headers and JSON are bounded before persistence.
      await demoReadSession(env,hash);
      if(path==='/api/demo/orders'){demoRequireMutation(request,'purchase');const body=await demoReadBody(request);return await demoMutateSession(env,hash,state=>demoPurchase(state,body));}
      const buyer=/^\/api\/demo\/returns\/(DEMO-(?:\d{3}|[A-F0-9]{12}))$/.exec(path);if(buyer){demoRequireMutation(request,'request');const body=await demoReadBody(request);return await demoMutateSession(env,hash,state=>demoCustomerRequest(state,buyer[1],body));}
      const admin=/^\/api\/demo\/admin\/orders\/(DEMO-(?:\d{3}|[A-F0-9]{12}))\/(ship|notes|tracking|deliver|return|portal-link|portal-revoke|portal-reply|return-label|return-label-remove)$/.exec(path);
      if(admin){demoRequireMutation(request,admin[2]);const body=await demoReadBody(request);return await demoMutateSession(env,hash,(state,expiresAt)=>demoAdminMutation(state,admin[1],admin[2],body,token,expiresAt));}
    }
    demoFail(404,'Ruta o método no disponible.');
  }catch(error){return demoJson({error:error.demoStatus?error.message:'No se puede abrir la demostración ahora. Vuelve a intentarlo.'},error.demoStatus||503);}
}
