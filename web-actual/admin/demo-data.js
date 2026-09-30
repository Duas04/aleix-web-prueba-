// Fictional, resettable examples. This transport never reaches the private API.
const demoOrders = [
  {id:'DEMO-001',customer_name:'Persona de ejemplo A',email:'ejemplo-a@example.invalid',edition:'paperback',quantity:1,subtotal:1500,total:2200,payment_status:'paid',fulfillment_status:'pending'},
  {id:'DEMO-002',customer_name:'Persona de ejemplo B',email:'ejemplo-b@example.invalid',edition:'hardcover',quantity:2,subtotal:3500,total:4200,payment_status:'paid',fulfillment_status:'shipped',
    items:[{edition:'paperback',quantity:1,unit_price:1500,subtotal:1500},{edition:'hardcover',quantity:1,unit_price:2000,subtotal:2000}],
    return_status:'requested',return_reason:'El libro de tapa dura ha llegado con la cubierta doblada. Solicito una devolución.',return_updated_at:1790590000000,
    private_note:'Ejemplo: revisar el embalaje antes de resolver la solicitud.',portal_requested_at:1790590000000,return_kind:'damaged',return_submitted_at:1790590000000},
  {id:'DEMO-003',customer_name:'Persona de ejemplo C',email:'ejemplo-c@example.invalid',edition:'hardcover',quantity:1,subtotal:2000,total:2700,payment_status:'pending',fulfillment_status:'pending'},
  {id:'DEMO-004',customer_name:'Persona de ejemplo D',email:'ejemplo-d@example.invalid',edition:'hardcover',quantity:1,subtotal:2000,total:2700,payment_status:'refunded',fulfillment_status:'shipped',paid_at:1790586000000,
    delivered_at:1790589000000,return_status:'closed',return_reason:'El libro ha llegado con la tapa doblada y varias páginas dañadas.',
    return_resolution:'Ejemplo de reembolso completo ya confirmado: 27 € con envío. No se ha devuelto dinero real.',return_updated_at:1790590000000},
].map((order,i)=>({created_at:1790586000000-i*3600000,recipient:order.customer_name,address1:'Calle de ejemplo, sin dirección real',address2:'Datos ficticios · No realizar envíos',city:'Ciudad de ejemplo',postal_code:'00000',region:'Provincia de ejemplo',country:'ES',phone:null,shipping:700,paid_at:order.payment_status==='paid'?1790586000000:null,shipped_at:order.fulfillment_status==='shipped'?1790587000000:null,tracking:order.fulfillment_status==='shipped'?'SEGUIMIENTO-FICTICIO':null,carrier:order.fulfillment_status==='shipped'?'Transportista de ejemplo':'',delivered_at:null,private_note:'',note_updated_at:null,return_status:'none',return_reason:'',return_resolution:'',return_updated_at:null,management_version:0,items:[{edition:order.edition,quantity:order.quantity,unit_price:order.subtotal/order.quantity,subtotal:order.subtotal}],...order}));
for(const order of demoOrders)Object.assign(order,{portal_requested_at:null,customer_reply:'',return_kind:'',return_code:'',return_carrier:'',return_label_key:null,return_label_type:null,return_label_size:null,return_submitted_at:null,...order});
const demoActiveReturn=order=>['requested','reviewing','approved','received'].includes(order.return_status);
const demoTransitions={none:['requested'],requested:['reviewing','approved','rejected'],reviewing:['approved','rejected'],approved:['received','closed'],received:['closed'],closed:['requested'],rejected:['requested']};
function demoText(value,max,multiline=false){
  if(typeof value!=='string'||value.length>max||(multiline?/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value))throw new Error('Revisa los datos introducidos.');
  return value.trim();
}
async function demoApi(path,options={}) {
  const url=new URL(path,'https://demo.invalid');
  if(url.pathname==='/api/admin/orders'){
    const fold=value=>value.normalize('NFD').replace(/[\u0301\u0308\u0303]/g,'').toLowerCase();
    const filter=url.searchParams.get('filter')||'all',q=fold((url.searchParams.get('q')||'').trim());
    const checks={all:()=>true,pending:o=>o.payment_status==='paid'&&o.fulfillment_status==='pending'&&!demoActiveReturn(o),shipped:o=>o.fulfillment_status==='shipped',unpaid:o=>o.payment_status==='pending',incidents:o=>['failed','refunded','partially_refunded'].includes(o.payment_status)||demoActiveReturn(o),attention:o=>['failed','partially_refunded'].includes(o.payment_status)||demoActiveReturn(o),returns:demoActiveReturn,access_requests:o=>!!o.portal_requested_at,delivered:o=>!!o.delivered_at};
    if(!Object.hasOwn(checks,filter))throw new Error('Filtro no válido.');
    const orders=demoOrders.filter(o=>checks[filter](o)&&[o.customer_name,o.email,o.id].some(v=>fold(v).includes(q)));
    return {orders:structuredClone(orders),count:orders.length,page:1,paymentConnected:false,stats:{accessRequests:demoOrders.filter(checks.access_requests).length,total:demoOrders.length,pending:demoOrders.filter(checks.pending).length,shipped:demoOrders.filter(checks.shipped).length,returns:demoOrders.filter(checks.returns).length,incidents:demoOrders.filter(o=>['failed','partially_refunded'].includes(o.payment_status)||demoActiveReturn(o)).length,delivered:demoOrders.filter(checks.delivered).length}};
  }
  const match=/^\/api\/admin\/orders\/(DEMO-\d+)(?:\/(ship|notes|tracking|deliver|return|portal-link|portal-revoke|portal-reply|return-label|return-label-remove))?$/.exec(url.pathname);
  const order=match&&demoOrders.find(o=>o.id===match[1]);
  if(!order)throw new Error('Ejemplo no encontrado.');
  const action=match[2];
  if(!action)return {order:structuredClone(order)};
  if(options.method!=='POST')throw new Error('Acción no permitida.');
  const body=action==='return-label'?{expectedVersion:Number(options.headers?.['X-Order-Version'])}:JSON.parse(options.body);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Datos no válidos.');
  if((action!=='ship'||body.expectedVersion!==undefined)&&(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==order.management_version))throw new Error('El pedido ha cambiado. Actualízalo antes de guardar.');
  if(action.startsWith('portal-')||action.startsWith('return-label')){
    if(!['paid','refunded','partially_refunded'].includes(order.payment_status))throw new Error('Este pedido no admite devoluciones.');
    if(action==='portal-link'){
      order.portal_requested_at=null;order.management_version++;
      return {ok:true,path:'/devoluciones?demo=1',expiresAt:Date.now()+30*86400000,order:structuredClone(order)};
    }
    if(action==='portal-revoke'){order.portal_requested_at=null;}
    if(action==='portal-reply'){
      const reply=demoText(body.reply,2000,true),code=demoText(body.code,200),carrier=demoText(body.carrier,80);
      if((code||carrier)&&!['approved','received','closed'].includes(order.return_status))throw new Error('Aprueba la devolución antes de adjuntar instrucciones de transporte.');
      Object.assign(order,{customer_reply:reply,return_code:code,return_carrier:carrier});
    }
    if(action==='return-label'){
      if(!['approved','received','closed'].includes(order.return_status))throw new Error('Aprueba la devolución antes de adjuntar una etiqueta.');
      const file=options.body;
      if(!file||file.size>2*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(file.type))throw new Error('Usa un PDF, PNG o JPEG de hasta 2 MB.');
      Object.assign(order,{return_label_key:'DEMO-NO-VALIDA-PARA-ENVIOS',return_label_type:file.type,return_label_size:file.size});
    }
    if(action==='return-label-remove')Object.assign(order,{return_label_key:null,return_label_type:null,return_label_size:null});
  }else if(action==='ship'){
    if(order.payment_status!=='paid'||order.fulfillment_status!=='pending'||demoActiveReturn(order))throw new Error('Este ejemplo no se puede marcar como enviado.');
    const tracking=demoText(body.tracking,120),carrier=demoText(body.carrier??'',80);
    Object.assign(order,{fulfillment_status:'shipped',shipped_at:Date.now(),tracking,carrier});
  }else if(action==='notes'){
    order.private_note=demoText(body.note,2000,true);order.note_updated_at=Date.now();
  }else if(action==='tracking'){
    if(order.fulfillment_status!=='shipped'||order.delivered_at)throw new Error('Solo se puede editar un envío pendiente de entrega.');
    const tracking=demoText(body.tracking,120),carrier=demoText(body.carrier,80);
    Object.assign(order,{tracking,carrier});
  }else if(action==='deliver'){
    if(body.confirmed!==true)throw new Error('Confirma la entrega antes de guardar.');
    if(order.fulfillment_status!=='shipped'||order.delivered_at)throw new Error('Este pedido no tiene una entrega pendiente.');
    order.delivered_at=Date.now();
  }else if(action==='return'){
    if(!['paid','refunded','partially_refunded'].includes(order.payment_status))throw new Error('Este pedido no admite una devolución.');
    const reason=demoText(body.reason,1000,true),resolution=demoText(body.resolution,1000,true),status=body.status;
    if(!Object.hasOwn(demoTransitions,status)||status==='none'||!reason||(['closed','rejected'].includes(status)&&!resolution))throw new Error('Indica el motivo y la resolución cuando cierres la solicitud.');
    if(status!==order.return_status&&!demoTransitions[order.return_status].includes(status))throw new Error('El cambio de estado no está permitido.');
    if(status==='requested'&&order.return_status!=='requested')Object.assign(order,{customer_reply:'',return_kind:'',return_code:'',return_carrier:'',return_label_key:null,return_label_type:null,return_label_size:null,return_submitted_at:Date.now()});
    Object.assign(order,{return_status:status,return_reason:reason,return_resolution:resolution,return_updated_at:Date.now()});
  }
  order.management_version++;
  return {ok:true,order:structuredClone(order)};
}
