// Fictional, resettable examples. This transport never reaches the private API.
const demoOrders = [
  {id:'DEMO-001',customer_name:'Persona de ejemplo A',email:'ejemplo-a@example.invalid',edition:'paperback',quantity:1,subtotal:1500,total:2200,payment_status:'paid',fulfillment_status:'pending'},
  {id:'DEMO-002',customer_name:'Persona de ejemplo B',email:'ejemplo-b@example.invalid',edition:'hardcover',quantity:2,subtotal:3500,total:4200,payment_status:'paid',fulfillment_status:'shipped',
    items:[{edition:'paperback',quantity:1,unit_price:1500,subtotal:1500},{edition:'hardcover',quantity:1,unit_price:2000,subtotal:2000}],
    return_status:'requested',return_reason:'El libro de tapa dura ha llegado con la cubierta doblada. Solicito una devolución.',return_updated_at:1790590000000,
    private_note:'Ejemplo: revisar el embalaje antes de resolver la solicitud.'},
  {id:'DEMO-003',customer_name:'Persona de ejemplo C',email:'ejemplo-c@example.invalid',edition:'hardcover',quantity:1,subtotal:2000,total:2700,payment_status:'pending',fulfillment_status:'pending'},
  {id:'DEMO-004',customer_name:'Persona de ejemplo D',email:'ejemplo-d@example.invalid',edition:'hardcover',quantity:1,subtotal:2000,total:2700,payment_status:'refunded',fulfillment_status:'shipped',paid_at:1790586000000,
    delivered_at:1790589000000,return_status:'closed',return_reason:'El libro ha llegado con la tapa doblada y varias páginas dañadas.',
    return_resolution:'Ejemplo de reembolso completo ya confirmado: 27 € con envío. No se ha devuelto dinero real.',return_updated_at:1790590000000},
].map((order,i)=>({created_at:1790586000000-i*3600000,recipient:order.customer_name,address1:'Calle de ejemplo, sin dirección real',address2:'Datos ficticios · No realizar envíos',city:'Ciudad de ejemplo',postal_code:'00000',region:'Provincia de ejemplo',country:'ES',phone:null,shipping:700,paid_at:order.payment_status==='paid'?1790586000000:null,shipped_at:order.fulfillment_status==='shipped'?1790587000000:null,tracking:order.fulfillment_status==='shipped'?'SEGUIMIENTO-FICTICIO':null,carrier:order.fulfillment_status==='shipped'?'Transportista de ejemplo':'',delivered_at:null,private_note:'',note_updated_at:null,return_status:'none',return_reason:'',return_resolution:'',return_updated_at:null,management_version:0,items:[{edition:order.edition,quantity:order.quantity,unit_price:order.subtotal/order.quantity,subtotal:order.subtotal}],...order}));
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
    const checks={all:()=>true,pending:o=>o.payment_status==='paid'&&o.fulfillment_status==='pending'&&!demoActiveReturn(o),shipped:o=>o.fulfillment_status==='shipped',unpaid:o=>o.payment_status==='pending',incidents:o=>['failed','refunded','partially_refunded'].includes(o.payment_status)||demoActiveReturn(o),attention:o=>['failed','partially_refunded'].includes(o.payment_status)||demoActiveReturn(o),returns:demoActiveReturn,delivered:o=>!!o.delivered_at};
    if(!Object.hasOwn(checks,filter))throw new Error('Filtro no válido.');
    const orders=demoOrders.filter(o=>checks[filter](o)&&[o.customer_name,o.email,o.id].some(v=>fold(v).includes(q)));
    return {orders:structuredClone(orders),count:orders.length,page:1,paymentConnected:false,stats:{total:demoOrders.length,pending:demoOrders.filter(checks.pending).length,shipped:demoOrders.filter(checks.shipped).length,returns:demoOrders.filter(checks.returns).length,incidents:demoOrders.filter(o=>['failed','partially_refunded'].includes(o.payment_status)||demoActiveReturn(o)).length,delivered:demoOrders.filter(checks.delivered).length}};
  }
  const match=/^\/api\/admin\/orders\/(DEMO-\d+)(?:\/(ship|notes|tracking|deliver|return))?$/.exec(url.pathname);
  const order=match&&demoOrders.find(o=>o.id===match[1]);
  if(!order)throw new Error('Ejemplo no encontrado.');
  const action=match[2];
  if(!action)return {order:structuredClone(order)};
  if(options.method!=='POST')throw new Error('Acción no permitida.');
  const body=JSON.parse(options.body);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Datos no válidos.');
  if((action!=='ship'||body.expectedVersion!==undefined)&&(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==order.management_version))throw new Error('El pedido ha cambiado. Actualízalo antes de guardar.');
  if(action==='ship'){
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
    Object.assign(order,{return_status:status,return_reason:reason,return_resolution:resolution,return_updated_at:Date.now()});
  }
  order.management_version++;
  return {ok:true,order:structuredClone(order)};
}


const $=id=>document.getElementById(id);
const moneyFormat=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const dateFormat=new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'});
const money=n=>moneyFormat.format(n/100);
const date=n=>dateFormat.format(new Date(n));
const payments={paid:'Pagado',pending:'Pago pendiente',failed:'Pago fallido',refunded:'Reembolsado',partially_refunded:'Reembolso parcial'};
const edition=e=>e==='paperback'?'Tapa blanda':'Tapa dura';
const shippingLabel=order=>order.delivered_at?'Entregado':order.fulfillment_status==='shipped'?'Enviado':order.payment_status==='paid'&&activeReturn(order)?'En pausa por devolución':({paid:'Por enviar',pending:'Pago pendiente',failed:'No enviar',refunded:'No enviar',partially_refunded:'Revisar pago'}[order.payment_status]||'Revisar pago');
const shippingTone=order=>order.fulfillment_status==='shipped'?'shipped':activeReturn(order)?'return-state':order.payment_status==='paid'?'pending':['failed','refunded','partially_refunded'].includes(order.payment_status)?order.payment_status:'neutral';
let detailOpener=null,detailId=null;
let page=1,total=0,currentOrder=null,listRequest=0,detailRequest=0,loading=false,loadedPage=1;
let saving=false;
const returnLabels={none:'Sin devolución',requested:'Solicitada',reviewing:'En revisión',approved:'Aprobada',received:'Recibida',closed:'Cerrada',rejected:'Rechazada'};
const returnTransitions={none:['requested'],requested:['reviewing','approved','rejected'],reviewing:['approved','rejected'],approved:['received','closed'],received:['closed'],closed:['requested'],rejected:['requested']};
const activeReturn=order=>['requested','reviewing','approved','received'].includes(order.return_status);
function orderItems(order){return order.items?.length?order.items:[{edition:order.edition,quantity:order.quantity,unit_price:order.quantity?order.subtotal/order.quantity:0,subtotal:order.subtotal}];}
async function api(path,options={}) { return demoApi(path,options); }
function cell(text,label){const e=document.createElement('td');e.setAttribute('role','cell');e.textContent=text;if(label)e.dataset.label=label;return e;}
function badge(status,text){const e=document.createElement('span');e.className='badge '+status;e.textContent=text;return e;}
async function load() {
  const version=++listRequest;
  const paginationFocus=['previous','next'].includes(document.activeElement?.id)?document.activeElement:null;
  const hadRows=$('rows').children.length>0;
  loading=true;$('table-wrap').setAttribute('aria-busy','true');
  for(const id of ['refresh','previous','next'])$(id).setAttribute('aria-disabled','true');
  $('feedback').hidden=false;$('feedback').className='feedback';$('feedback').textContent='Cargando tus pedidos…';$('empty').hidden=true;
  try {
    const params=new URLSearchParams({page:String(page),filter:$('filter').value,q:$('search').value.trim()});
    const data=await api('/api/admin/orders?'+params);
    if(version!==listRequest)return;
    total=data.count;
    if(page>1&&data.orders.length===0){page=1;return load();}
    loadedPage=page;
    $('stat-total').textContent=data.stats.total;$('stat-pending').textContent=data.stats.pending;$('stat-shipped').textContent=data.stats.shipped;
    for(const key of ['pending','returns','incidents'])$('task-'+key+'-count').textContent=String(data.stats[key]??0);
    for(const key of ['pending','returns','incidents'])$('task-'+key).setAttribute('aria-pressed',String($('filter').value===(key==='incidents'?'attention':key)));
    $('result-count').textContent=total===1?'1 pedido':`${total} pedidos`;
    $('rows').replaceChildren();
    for(const order of data.orders) {
      const tr=document.createElement('tr');tr.setAttribute('role','row');
      const customer=cell(order.customer_name), number=document.createElement('small'),small=document.createElement('small');number.className='order-number';number.textContent=order.id;small.textContent=date(order.created_at);customer.append(number,small);
      const book=cell(orderItems(order).map(item=>`${item.quantity} × ${edition(item.edition)}`).join(' · '),'Libro'), amount=cell(money(order.total),'Total'), pay=cell('','Pago'),ship=cell('','Envío'),detail=cell('');
      pay.append(badge(order.payment_status,payments[order.payment_status]||'Sin confirmar'));ship.append(badge(shippingTone(order),shippingLabel(order)));
      if(order.return_status&&order.return_status!=='none')ship.append(badge('return-state','Devolución: '+(returnLabels[order.return_status]||'Revisar')));
      const button=document.createElement('button');button.type='button';button.className='text-link';button.textContent='Ver pedido';button.setAttribute('aria-label',`Ver pedido de ${order.customer_name}, ${order.id}`);button.addEventListener('click',()=>openDetail(order.id));detail.append(button);tr.append(customer,book,amount,pay,ship,detail);$('rows').append(tr);
    }
    $('feedback').hidden=true;
    $('table-wrap').hidden=!data.orders.length;
    if(!data.orders.length){
      $('empty').hidden=false;const filtered=$('filter').value!=='all'||$('search').value.trim();
      $('empty-title').textContent=filtered?'No hay pedidos con estos filtros':'Tu primer pedido tendrá su lugar aquí';
      $('empty-text').textContent=filtered?'Prueba otra búsqueda o selecciona «Todos los pedidos».':'Podrás ver quién ha comprado, a qué dirección enviar el libro y si el pago está confirmado.';
    }else{$('table-wrap').hidden=false;}
    const keepPaginationFocus=paginationFocus&&document.activeElement===paginationFocus;
    $('pagination').hidden=total<=20;$('previous').disabled=page===1;$('next').disabled=page*20>=total;$('page-label').textContent=`Página ${page} de ${Math.max(1,Math.ceil(total/20))}`;
    if(keepPaginationFocus&&paginationFocus.disabled){const target=$('pagination').hidden?$('orders-title'):$('page-label');target.tabIndex=-1;target.focus();}
  }catch(error){if(version!==listRequest)return;page=loadedPage;$('feedback').className='feedback error';$('feedback').textContent=error.message+(hadRows?' Se mantienen los últimos resultados. Pulsa Actualizar para reintentarlo.':'');if(!hadRows){$('result-count').textContent='No disponible';for(const id of ['stat-total','stat-pending','stat-shipped','task-pending-count','task-returns-count','task-incidents-count'])$(id).textContent='—';}}
  finally{if(version===listRequest){loading=false;$('table-wrap').setAttribute('aria-busy','false');for(const id of ['refresh','previous','next'])$(id).removeAttribute('aria-disabled');}}
}
const countries=new Intl.DisplayNames(['es'],{type:'region'});
function countryName(code){try{return countries.of(code)||code;}catch{return code;}}
function address(order){return[order.recipient,order.address1,order.address2,`${order.postal_code} ${order.city}`,order.region,countryName(order.country)].filter(Boolean).join('\n');}
function lockActions(){for(const id of ['ship-fields','tracking-fields','deliver-fields','note-fields','return-fields'])$(id).disabled=saving;}
function renderDetail(order){
  currentOrder=order;
  $('detail-title').textContent='Pedido '+order.id;$('detail-date').textContent=date(order.created_at);
  $('detail-payment').textContent=payments[order.payment_status]||'Pago sin confirmar';$('detail-payment').className='badge '+order.payment_status;
  $('detail-shipping').textContent=shippingLabel(order);$('detail-shipping').className='badge '+shippingTone(order);
  $('customer').textContent=order.customer_name;$('email').textContent=order.email;$('phone').textContent=order.phone||'Teléfono no facilitado';$('address').textContent=address(order);
  $('items').replaceChildren(...orderItems(order).map(item=>{const line=document.createElement('li');line.textContent=`${item.quantity} × ${edition(item.edition)} · ${money(item.unit_price)} por ejemplar · Subtotal ${money(item.subtotal)}`;return line;}));
  $('subtotal').textContent=money(order.subtotal);$('shipping').textContent=money(order.shipping);$('total').textContent=money(order.total);
  $('payment-note').textContent=order.payment_status==='paid'?(activeReturn(order)?'Pago confirmado. Hay una devolución activa: revisa su gestión antes de preparar el envío.':order.fulfillment_status==='shipped'?'Pago simulado: este pedido ficticio figura como enviado.':'Pago simulado: este pedido es ficticio.'):order.payment_status==='pending'?'Pago pendiente de confirmación. No envíes el libro todavía.':order.payment_status==='refunded'?'Reembolso total simulado de '+money(order.total)+' por recibir el libro en mal estado. Incluye el libro y los gastos de envío. No se ha devuelto dinero real.':'Este pago tiene una incidencia o un reembolso. Revisa la operación antes de realizar cualquier envío.';
  $('ship-form').hidden=order.payment_status!=='paid'||order.fulfillment_status!=='pending'||activeReturn(order);
  $('ship-confirm').checked=false;$('carrier').value=order.carrier||'';$('tracking').value=order.tracking||'';$('ship-button').disabled=false;
  const canTrack=order.fulfillment_status==='shipped'&&!order.delivered_at;
  $('tracking-form').hidden=!canTrack;$('deliver-form').hidden=!canTrack;
  $('tracking-carrier').value=order.carrier||'';$('tracking-code').value=order.tracking||'';$('deliver-confirm').checked=false;
  $('shipping-info').textContent=order.fulfillment_status==='shipped'?`Enviado${order.shipped_at?' el '+date(order.shipped_at):''}.${order.carrier?' Transportista: '+order.carrier+'.':''}${order.tracking?' Seguimiento: '+order.tracking+'.':''}${order.delivered_at?' Entrega confirmada el '+date(order.delivered_at)+'.':''}`:'';
  $('private-note').value=order.private_note||'';$('note-date').textContent=order.note_updated_at?'Última actualización: '+date(order.note_updated_at):'Solo visible en este panel. No se incluye al imprimir.';
  $('return-form').hidden=!['paid','refunded','partially_refunded'].includes(order.payment_status);
  const status=order.return_status||'none',options=[...new Set([...(status==='none'?[]:[status]),...(returnTransitions[status]||[])])];
  $('return-status').replaceChildren(...options.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=returnLabels[value];return option;}));
  $('return-status').value=status==='none'?'requested':status;
  $('return-reason').value=order.return_reason||'';$('return-resolution').value=order.return_resolution||'';
  $('return-current').textContent='Estado de devolución: '+(returnLabels[status]||'Revisar');
  $('return-date').textContent=order.return_updated_at?'Última actualización: '+date(order.return_updated_at):'';
  lockActions();$('detail-feedback').textContent='';$('detail-body').hidden=false;
}
async function openDetail(id){
  const restoreRetryFocus=document.activeElement===$('retry-detail');
  detailId=id;$('retry-detail').hidden=true;
  const version=++detailRequest;currentOrder=null;$('detail-body').hidden=true;$('detail-message').textContent='';$('detail-feedback').textContent='Cargando pedido…';if(!$('detail').open){detailOpener=document.activeElement;$('detail').showModal();}
  try{
    const {order}=await api('/api/admin/orders/'+encodeURIComponent(id));if(version!==detailRequest)return;renderDetail(order);
    if(restoreRetryFocus){$('detail-title').tabIndex=-1;$('detail-title').focus();}
  }catch(error){if(version===detailRequest){$('detail-feedback').textContent=error.message;$('retry-detail').hidden=false;if(restoreRetryFocus)$('retry-detail').focus();}}
}
$('retry-detail').addEventListener('click',()=>{if(detailId)return openDetail(detailId);});
for(const key of ['pending','returns','incidents'])$('task-'+key).addEventListener('click',()=>{$('filter').value=key==='incidents'?'attention':key;$('search').value='';page=1;return load();});
$('search-form').addEventListener('submit',event=>{event.preventDefault();page=1;load();});$('filter').addEventListener('change',()=>{page=1;load();});$('refresh').addEventListener('click',()=>{if(!loading)load();});$('previous').addEventListener('click',()=>{if(!loading){page--;load();}});$('next').addEventListener('click',()=>{if(!loading){page++;load();}});
$('close-detail').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('close',()=>{detailRequest++;currentOrder=null;if(detailOpener?.isConnected)detailOpener.focus();else $('refresh').focus();});
$('copy-address').addEventListener('click',async()=>{if(!currentOrder)return;const version=detailRequest;try{await navigator.clipboard.writeText(address(currentOrder));if(version===detailRequest&&$('detail').open)$('detail-message').textContent='Dirección copiada.';}catch{if(version===detailRequest&&$('detail').open)$('detail-message').textContent='No se ha podido copiar. Puedes seleccionar el texto de la dirección.';}});
$('print-order').addEventListener('click',()=>{if(currentOrder)window.print();});
async function saveManagement(action,data,message,focusId){
  if(saving||!currentOrder)return;
  const id=currentOrder.id,version=detailRequest,expectedVersion=currentOrder.management_version||0;
  const previousFocus=document.activeElement,drafts=[];
  const sections={ship:['carrier','tracking','ship-confirm'],tracking:['tracking-carrier','tracking-code'],deliver:['deliver-confirm'],notes:['private-note'],return:['return-status','return-reason','return-resolution']};
  const initial={'carrier':currentOrder.carrier||'','tracking':currentOrder.tracking||'','tracking-carrier':currentOrder.carrier||'','tracking-code':currentOrder.tracking||'','private-note':currentOrder.private_note||'','return-status':(!currentOrder.return_status||currentOrder.return_status==='none')?'requested':currentOrder.return_status,'return-reason':currentOrder.return_reason||'','return-resolution':currentOrder.return_resolution||''};
  for(const [section,ids]of Object.entries(sections))if(section!==action)for(const fieldId of ids){const field=$(fieldId),check=fieldId.endsWith('-confirm');if(check?field.checked:field.value!==initial[fieldId])drafts.push({fieldId,value:field.value,checked:field.checked});}
  let saved=false;
  saving=true;lockActions();$('detail-message').textContent='Guardando…';
  const stillCurrent=()=>version===detailRequest&&$('detail').open&&currentOrder?.id===id;
  try{
    const result=await api('/api/admin/orders/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Action':action},body:JSON.stringify({...data,expectedVersion})});
    if(!stillCurrent())return;
    const updated=result.order||(await api('/api/admin/orders/'+encodeURIComponent(id))).order;
    if(!stillCurrent())return;
    renderDetail(updated);
    for(const draft of drafts){$(draft.fieldId).value=draft.value;$(draft.fieldId).checked=draft.checked;}
    saved=true;$('detail-message').textContent=message;await load();
  }catch(error){if(stillCurrent())$('detail-message').textContent=error.message+' Tus cambios siguen en los campos. Revisa el dato e intenta guardar otra vez; si el pedido cambió en otra pestaña, cierra y vuelve a abrir el detalle.';}
  finally{saving=false;lockActions();if(stillCurrent()){if(saved&&focusId)$(focusId).focus();else if(previousFocus?.isConnected)previousFocus.focus();}}
}
$('ship-form').addEventListener('submit',event=>{event.preventDefault();if(!currentOrder||!$('ship-confirm').checked||currentOrder.payment_status!=='paid'||currentOrder.fulfillment_status!=='pending'||activeReturn(currentOrder))return;return saveManagement('ship',{carrier:$('carrier').value.trim(),tracking:$('tracking').value.trim()},'Envío simulado. No se ha modificado ningún pedido real.','close-detail');});
$('tracking-form').addEventListener('submit',event=>{event.preventDefault();if(!currentOrder||currentOrder.fulfillment_status!=='shipped'||currentOrder.delivered_at)return;return saveManagement('tracking',{carrier:$('tracking-carrier').value.trim(),tracking:$('tracking-code').value.trim()},'Seguimiento actualizado.','close-detail');});
$('deliver-form').addEventListener('submit',event=>{event.preventDefault();if(!currentOrder||!$('deliver-confirm').checked||currentOrder.fulfillment_status!=='shipped'||currentOrder.delivered_at)return;return saveManagement('deliver',{confirmed:true},'Entrega confirmada.','close-detail');});
$('note-form').addEventListener('submit',event=>{event.preventDefault();return saveManagement('notes',{note:$('private-note').value.trim()},'Nota privada guardada.');});
$('return-form').addEventListener('submit',event=>{
  event.preventDefault();if(!currentOrder||!['paid','refunded','partially_refunded'].includes(currentOrder.payment_status))return;
  const status=$('return-status').value,reason=$('return-reason').value.trim(),resolution=$('return-resolution').value.trim(),old=currentOrder.return_status||'none';
  if(status!==old&&!(returnTransitions[old]||[]).includes(status)){$('detail-message').textContent='Ese cambio de estado no está disponible. Vuelve a abrir el pedido.';return;}
  if(!reason){$('detail-message').textContent='Escribe el motivo de la devolución.';$('return-reason').focus();return;}
  if(['closed','rejected'].includes(status)&&!resolution){$('detail-message').textContent='Escribe la resolución antes de cerrar o rechazar la devolución.';$('return-resolution').focus();return;}
  return saveManagement('return',{status,reason,resolution},'Gestión de devolución guardada. El estado del pago no cambia.');
});
load();

// Included only in the fictional demo bundle; never served with the private panel.
$('demo-start').addEventListener('click',()=>openDetail('DEMO-001'));
$('demo-refund').addEventListener('click',()=>openDetail('DEMO-004'));
$('demo-return').addEventListener('click',()=>openDetail('DEMO-002'));
$('demo-reset').addEventListener('click',()=>{$('search-form').reset();window.location.reload();});
