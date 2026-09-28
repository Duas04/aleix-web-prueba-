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
async function api(path,options={}) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
  let body;try{body=await response.json();}catch{throw new Error('No se ha podido cargar la información. Actualiza e inténtalo de nuevo.');}
  if(!response.ok) throw new Error(body.error||'No se ha podido completar la operación.');
  return body;
}
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
    $('task-access-count').textContent=String(data.stats.accessRequests??0);$('task-access').setAttribute('aria-pressed',String($('filter').value==='access_requests'));
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
function clearPortalLink(){$('portal-url').value='';$('portal-link-output').hidden=true;$('portal-mail').removeAttribute('href');$('portal-expiry').textContent='';}
function lockActions(){for(const id of ['ship-fields','tracking-fields','deliver-fields','note-fields','return-fields','portal-fields','portal-reply-fields','return-label-fields'])$(id).disabled=saving;}
function renderDetail(order){
  currentOrder=order;
  $('detail-title').textContent='Pedido '+order.id;$('detail-date').textContent=date(order.created_at);
  $('detail-payment').textContent=payments[order.payment_status]||'Pago sin confirmar';$('detail-payment').className='badge '+order.payment_status;
  $('detail-shipping').textContent=shippingLabel(order);$('detail-shipping').className='badge '+shippingTone(order);
  $('customer').textContent=order.customer_name;$('email').textContent=order.email;$('phone').textContent=order.phone||'Teléfono no facilitado';$('address').textContent=address(order);
  $('items').replaceChildren(...orderItems(order).map(item=>{const line=document.createElement('li');line.textContent=`${item.quantity} × ${edition(item.edition)} · ${money(item.unit_price)} por ejemplar · Subtotal ${money(item.subtotal)}`;return line;}));
  $('subtotal').textContent=money(order.subtotal);$('shipping').textContent=money(order.shipping);$('total').textContent=money(order.total);
  $('payment-note').textContent=order.payment_status==='paid'?(activeReturn(order)?'Pago confirmado. Hay una devolución activa: revisa su gestión antes de preparar el envío.':order.fulfillment_status==='shipped'?'Pago confirmado por la pasarela. Este pedido ya está enviado.':'Pago confirmado por la pasarela. Puedes preparar este pedido.'):order.payment_status==='pending'?'Pago pendiente de confirmación. No envíes el libro todavía.':order.payment_status==='refunded'?'Pago reembolsado. No prepares un envío.':'Este pago tiene una incidencia o un reembolso. Revisa la operación antes de realizar cualquier envío.';
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
  $('portal-request-status').textContent=order.portal_requested_at?'El comprador pidió acceso el '+date(order.portal_requested_at)+'. Prepara el enlace y envíaselo manualmente.':'No hay una petición de acceso pendiente.';
  $('customer-reply').value=order.customer_reply||'';$('return-carrier').value=order.return_carrier||'';$('return-code').value=order.return_code||'';
  const canLabel=['approved','received','closed'].includes(status);
  $('portal-label-data').hidden=!canLabel;$('return-label-form').hidden=!canLabel;
  $('return-label-current').textContent=order.return_label_key?'Etiqueta disponible para el comprador'+(order.return_label_size?' · '+Math.ceil(order.return_label_size/1024)+' KB':'')+'.':'No hay una etiqueta adjunta.';
  $('return-label-remove').hidden=!order.return_label_key;
  lockActions();$('detail-feedback').textContent='';$('detail-body').hidden=false;
}
async function openDetail(id){
  const restoreRetryFocus=document.activeElement===$('retry-detail');
  detailId=id;$('retry-detail').hidden=true;clearPortalLink();$('return-label-file').value='';
  const version=++detailRequest;currentOrder=null;$('detail-body').hidden=true;$('detail-message').textContent='';$('detail-feedback').textContent='Cargando pedido…';if(!$('detail').open){detailOpener=document.activeElement;$('detail').showModal();}
  try{
    const {order}=await api('/api/admin/orders/'+encodeURIComponent(id));if(version!==detailRequest)return;renderDetail(order);
    if(restoreRetryFocus){$('detail-title').tabIndex=-1;$('detail-title').focus();}
  }catch(error){if(version===detailRequest){$('detail-feedback').textContent=error.message;$('retry-detail').hidden=false;if(restoreRetryFocus)$('retry-detail').focus();}}
}
$('retry-detail').addEventListener('click',()=>{if(detailId)return openDetail(detailId);});
for(const key of ['pending','returns','incidents'])$('task-'+key).addEventListener('click',()=>{$('filter').value=key==='incidents'?'attention':key;$('search').value='';page=1;return load();});
$('task-access').addEventListener('click',()=>{$('filter').value='access_requests';$('search').value='';page=1;return load();});
$('search-form').addEventListener('submit',event=>{event.preventDefault();page=1;load();});$('filter').addEventListener('change',()=>{page=1;load();});$('refresh').addEventListener('click',()=>{if(!loading)load();});$('previous').addEventListener('click',()=>{if(!loading){page--;load();}});$('next').addEventListener('click',()=>{if(!loading){page++;load();}});
$('close-detail').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('close',()=>{detailRequest++;currentOrder=null;clearPortalLink();$('return-label-file').value='';if(detailOpener?.isConnected)detailOpener.focus();else $('refresh').focus();});
$('copy-address').addEventListener('click',async()=>{if(!currentOrder)return;const version=detailRequest;try{await navigator.clipboard.writeText(address(currentOrder));if(version===detailRequest&&$('detail').open)$('detail-message').textContent='Dirección copiada.';}catch{if(version===detailRequest&&$('detail').open)$('detail-message').textContent='No se ha podido copiar. Puedes seleccionar el texto de la dirección.';}});
$('print-order').addEventListener('click',()=>{if(currentOrder)window.print();});
async function saveManagement(action,data,message,focusId,{raw=false,afterSave}={}){
  if(saving||!currentOrder)return;
  const id=currentOrder.id,version=detailRequest,expectedVersion=currentOrder.management_version||0;
  const previousFocus=document.activeElement,drafts=[];
  const sections={ship:['carrier','tracking','ship-confirm'],tracking:['tracking-carrier','tracking-code'],deliver:['deliver-confirm'],notes:['private-note'],return:['return-status','return-reason','return-resolution'],'portal-reply':['customer-reply','return-carrier','return-code']};
  const initial={'carrier':currentOrder.carrier||'','tracking':currentOrder.tracking||'','tracking-carrier':currentOrder.carrier||'','tracking-code':currentOrder.tracking||'','private-note':currentOrder.private_note||'','return-status':(!currentOrder.return_status||currentOrder.return_status==='none')?'requested':currentOrder.return_status,'return-reason':currentOrder.return_reason||'','return-resolution':currentOrder.return_resolution||'','customer-reply':currentOrder.customer_reply||'','return-carrier':currentOrder.return_carrier||'','return-code':currentOrder.return_code||''};
  for(const [section,ids]of Object.entries(sections))if(section!==action)for(const fieldId of ids){const field=$(fieldId),check=fieldId.endsWith('-confirm');if(check?field.checked:field.value!==initial[fieldId])drafts.push({fieldId,value:field.value,checked:field.checked});}
  let saved=false;
  saving=true;lockActions();$('detail-message').textContent='Guardando…';
  const stillCurrent=()=>version===detailRequest&&$('detail').open&&currentOrder?.id===id;
  try{
    const result=await api('/api/admin/orders/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:raw?{'Content-Type':data.type,'X-Admin-Action':action,'X-Order-Version':String(expectedVersion)}:{'Content-Type':'application/json','X-Admin-Action':action},body:raw?data:JSON.stringify({...data,expectedVersion})});
    if(!stillCurrent())return;
    const updated=result.order||(await api('/api/admin/orders/'+encodeURIComponent(id))).order;
    if(!stillCurrent())return;
    renderDetail(updated);
    for(const draft of drafts){$(draft.fieldId).value=draft.value;$(draft.fieldId).checked=draft.checked;}
    if(afterSave)afterSave(result);
    saved=true;$('detail-message').textContent=message;await load();
  }catch(error){if(stillCurrent())$('detail-message').textContent=error.message+' Tus cambios siguen en los campos. Revisa el dato e intenta guardar otra vez; si el pedido cambió en otra pestaña, cierra y vuelve a abrir el detalle.';}
  finally{saving=false;lockActions();if(stillCurrent()){if(saved&&focusId)$(focusId).focus();else if(previousFocus?.isConnected)previousFocus.focus();}}
}
$('ship-form').addEventListener('submit',event=>{event.preventDefault();if(!currentOrder||!$('ship-confirm').checked||currentOrder.payment_status!=='paid'||currentOrder.fulfillment_status!=='pending'||activeReturn(currentOrder))return;return saveManagement('ship',{carrier:$('carrier').value.trim(),tracking:$('tracking').value.trim()},'Pedido marcado como enviado.','close-detail');});
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
$('portal-link-create').addEventListener('click',()=>saveManagement('portal-link',{},'Enlace preparado. Aún debes enviarlo al comprador.',undefined,{afterSave:result=>{
  clearPortalLink();const demoLink=result.path==='/devoluciones?demo=1'&&document.body?.classList?.contains('demo-page');if(!demoLink&&!/^\/devoluciones#token=[A-Za-z0-9_-]{43}$/.test(result.path||''))throw new Error('No se ha recibido un enlace válido. Prepara uno nuevo.');
  const url=location.origin+result.path;$('portal-url').value=url;$('portal-link-output').hidden=false;
  $('portal-expiry').textContent='Caduca el '+date(result.expiresAt)+'. Al generar otro enlace, el anterior deja de funcionar.';
  $('portal-mail').href='mailto:'+encodeURIComponent(currentOrder.email)+'?subject='+encodeURIComponent('Tu enlace privado de devolución · Fumada XXL')+'&body='+encodeURIComponent('Hola,\n\nPuedes consultar tu devolución del pedido '+currentOrder.id+' en este enlace privado:\n'+url+'\n\nGuárdalo en privado. Caduca en 30 días.\n\nAleix');
}}));
$('portal-revoke').addEventListener('click',()=>{if(!$('portal-revoke-confirm').checked){$('detail-message').textContent='Confirma que quieres invalidar el enlace del comprador.';$('portal-revoke-confirm').focus();return;}return saveManagement('portal-revoke',{},'Enlace del comprador invalidado.',undefined,{afterSave:()=>{clearPortalLink();$('portal-revoke-confirm').checked=false;}});});
$('portal-copy').addEventListener('click',async()=>{const url=$('portal-url').value,version=detailRequest;if(!url)return;try{await navigator.clipboard.writeText(url);if(version===detailRequest&&$('detail').open)$('detail-message').textContent='Enlace copiado. Todavía debes enviarlo al comprador.';}catch{if(version===detailRequest&&$('detail').open)$('detail-message').textContent='No se ha podido copiar. Selecciona el enlace y cópialo manualmente.';}});
$('portal-reply-form').addEventListener('submit',event=>{event.preventDefault();if(!currentOrder)return;const canLabel=['approved','received','closed'].includes(currentOrder.return_status);return saveManagement('portal-reply',{reply:$('customer-reply').value.trim(),carrier:canLabel?$('return-carrier').value.trim():(currentOrder.return_carrier||''),code:canLabel?$('return-code').value.trim():(currentOrder.return_code||'')},'Respuesta visible al comprador guardada. No se ha enviado ningún correo.');});
$('return-label-form').addEventListener('submit',event=>{event.preventDefault();if(!currentOrder||!['approved','received','closed'].includes(currentOrder.return_status))return;const file=$('return-label-file').files?.[0];if(!file){$('detail-message').textContent='Selecciona una etiqueta para adjuntar.';$('return-label-file').focus();return;}if(!['application/pdf','image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024||file.size<=0){$('detail-message').textContent='Usa un PDF, PNG o JPEG de hasta 2 MiB.';$('return-label-file').focus();return;}return saveManagement('return-label',file,'Etiqueta adjunta. El comprador puede descargarla desde su enlace.',undefined,{raw:true,afterSave:()=>{$('return-label-file').value='';}});});
$('return-label-remove').addEventListener('click',()=>{if(!$('return-label-remove-confirm').checked){$('detail-message').textContent='Confirma que quieres retirar la etiqueta.';$('return-label-remove-confirm').focus();return;}return saveManagement('return-label-remove',{},'Etiqueta retirada.',undefined,{afterSave:()=>{$('return-label-remove-confirm').checked=false;}});});
load();
