const $=id=>document.getElementById(id);
const moneyFormat=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const dateFormat=new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'});
const money=n=>moneyFormat.format(n/100);
const date=n=>dateFormat.format(new Date(n));
const payments={paid:'Pagado',pending:'Pago pendiente',failed:'Pago fallido',refunded:'Reembolsado',partially_refunded:'Reembolso parcial'};
const edition=e=>e==='paperback'?'Tapa blanda':'Tapa dura';
const shippingLabel=order=>order.fulfillment_status==='shipped'?'Enviado':order.payment_status==='refunded'?'No enviar':'Por enviar';
const shippingTone=order=>order.payment_status==='refunded'&&order.fulfillment_status!=='shipped'?'refunded':order.fulfillment_status;
let detailOpener=null,detailId=null;
let page=1,total=0,currentOrder=null,listRequest=0,detailRequest=0,loading=false,loadedPage=1;
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
    $('result-count').textContent=total===1?'1 pedido':`${total} pedidos`;
    $('rows').replaceChildren();
    for(const order of data.orders) {
      const tr=document.createElement('tr');tr.setAttribute('role','row');
      const customer=cell(order.customer_name), number=document.createElement('small'),small=document.createElement('small');number.className='order-number';number.textContent=order.id;small.textContent=date(order.created_at);customer.append(number,small);
      const book=cell(`${order.quantity} × ${edition(order.edition)}`,'Libro'), amount=cell(money(order.total),'Total'), pay=cell('','Pago'),ship=cell('','Envío'),detail=cell('');
      pay.append(badge(order.payment_status,payments[order.payment_status]||'Sin confirmar'));ship.append(badge(shippingTone(order),shippingLabel(order)));
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
  }catch(error){if(version!==listRequest)return;page=loadedPage;$('feedback').className='feedback error';$('feedback').textContent=error.message+(hadRows?' Se mantienen los últimos resultados. Pulsa Actualizar para reintentarlo.':'');if(!hadRows){$('result-count').textContent='No disponible';for(const id of ['stat-total','stat-pending','stat-shipped'])$(id).textContent='—';}}
  finally{if(version===listRequest){loading=false;$('table-wrap').setAttribute('aria-busy','false');for(const id of ['refresh','previous','next'])$(id).removeAttribute('aria-disabled');}}
}
const countries=new Intl.DisplayNames(['es'],{type:'region'});
function countryName(code){try{return countries.of(code)||code;}catch{return code;}}
function address(order){return[order.recipient,order.address1,order.address2,`${order.postal_code} ${order.city}`,order.region,countryName(order.country)].filter(Boolean).join('\n');}
async function openDetail(id){
  detailId=id;$('retry-detail').hidden=true;
  const version=++detailRequest;currentOrder=null;$('detail-body').hidden=true;$('detail-message').textContent='';$('detail-feedback').textContent='Cargando pedido…';if(!$('detail').open){detailOpener=document.activeElement;$('detail').showModal();}
  try{
    const {order}=await api('/api/admin/orders/'+encodeURIComponent(id));if(version!==detailRequest)return;currentOrder=order;
    $('detail-title').textContent='Pedido '+order.id;$('detail-date').textContent=date(order.created_at);
    $('detail-payment').textContent=payments[order.payment_status]||'Pago sin confirmar';$('detail-payment').className='badge '+order.payment_status;
    $('detail-shipping').textContent=shippingLabel(order);$('detail-shipping').className='badge '+shippingTone(order);
    $('customer').textContent=order.customer_name;$('email').textContent=order.email;$('phone').textContent=order.phone||'Teléfono no facilitado';$('address').textContent=address(order);
    $('items').textContent=`Fumada XXL · ${order.quantity} × ${edition(order.edition)}`;$('subtotal').textContent=money(order.subtotal);$('shipping').textContent=money(order.shipping);$('total').textContent=money(order.total);
    $('payment-note').textContent=order.payment_status==='paid'?(order.fulfillment_status==='shipped'?'Pago confirmado por la pasarela. Este pedido ya está enviado.':'Pago confirmado por la pasarela. Puedes preparar este pedido.'):order.payment_status==='pending'?'Pago pendiente de confirmación. No envíes el libro todavía.':order.payment_status==='refunded'?'Pago reembolsado. No prepares un envío.':'Este pago tiene una incidencia o un reembolso. Revisa la operación antes de realizar cualquier envío.';
    $('ship-form').hidden=order.payment_status!=='paid'||order.fulfillment_status!=='pending';$('ship-confirm').checked=false;$('tracking').value='';$('ship-button').disabled=false;
    $('shipping-info').textContent=order.fulfillment_status==='shipped'?`Enviado${order.shipped_at?' el '+date(order.shipped_at):''}.${order.tracking?' Seguimiento: '+order.tracking:''}`:'';
    $('detail-feedback').textContent='';$('detail-body').hidden=false;
  }catch(error){if(version===detailRequest){$('detail-feedback').textContent=error.message;$('retry-detail').hidden=false;}}
}
$('retry-detail').addEventListener('click',()=>{if(detailId)return openDetail(detailId);});
$('search-form').addEventListener('submit',event=>{event.preventDefault();page=1;load();});$('filter').addEventListener('change',()=>{page=1;load();});$('refresh').addEventListener('click',()=>{if(!loading)load();});$('previous').addEventListener('click',()=>{if(!loading){page--;load();}});$('next').addEventListener('click',()=>{if(!loading){page++;load();}});
$('close-detail').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('close',()=>{detailRequest++;currentOrder=null;if(detailOpener?.isConnected)detailOpener.focus();else $('refresh').focus();});
$('copy-address').addEventListener('click',async()=>{if(!currentOrder)return;try{await navigator.clipboard.writeText(address(currentOrder));$('detail-message').textContent='Dirección copiada.';}catch{$('detail-message').textContent='No se ha podido copiar. Puedes seleccionar el texto de la dirección.';}});
$('print-order').addEventListener('click',()=>{if(currentOrder)window.print();});
$('ship-form').addEventListener('submit',async event=>{event.preventDefault();if(!currentOrder||!$('ship-confirm').checked)return;const id=currentOrder.id;$('ship-button').disabled=true;$('detail-message').textContent='Guardando…';try{await api('/api/admin/orders/'+encodeURIComponent(id)+'/ship',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Action':'ship'},body:JSON.stringify({tracking:$('tracking').value.trim()})});await load();if($('detail').open&&currentOrder?.id===id){await openDetail(id);if($('detail').open&&currentOrder?.id===id){$('close-detail').focus();$('detail-message').textContent='Pedido marcado como enviado.';}}}catch(error){if($('detail').open&&currentOrder?.id===id){$('detail-message').textContent=error.message;$('ship-button').disabled=false;}}});
load();
