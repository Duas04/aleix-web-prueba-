// Only the explicit demonstration can create fictitious orders.
(()=>{
 const session=window.DemoSession,dialog=document.getElementById('order-dialog');
 if(!session?.enabled||!dialog)return;
 const $=id=>document.getElementById(id),button=$('demo-purchase');
 let selection={},requestId='',fingerprint='',pending=false,completed=false,epoch=0;
 const fictitious={fullName:'Persona de ejemplo',email:'compra-ficticia@example.invalid',address:'Calle de ejemplo, sin dirección real',addressExtra:'Datos ficticios · No realizar envíos',postalCode:'00000',city:'Ciudad de ejemplo',region:'Provincia de ejemplo',country:'España'};
 for(const [key,value]of Object.entries(fictitious)){const field=$('customer-'+key);field.value=value;field.readOnly=true;field.autocomplete='off';}
 $('details-privacy').textContent='Demostración conectada: estos datos son ficticios. Solo se enviarán los formatos y cantidades para crear un pedido de prueba; no habrá cobros ni correos.';
 $('order-notice').textContent='Demostración conectada. Puedes generar un pedido ficticio con su número y verlo en el panel. No es una compra real.';
 $('demo-purchase-area').hidden=false;
 $('review-preparation-note').hidden=true;$('real-payment-unavailable').hidden=true;
 $('demo-purchase-note').textContent='Se simulará un pago, sin tarjeta ni dinero. El pedido se guardará en esta demostración durante un máximo de 7 días.';
 const updateLinks=orderId=>{
  $('demo-order-returns').href=session.link('/devoluciones?demo=1',{orderId});
  $('demo-order-admin').href=session.link('/demo',{orderId});
 };
 const availability=()=>{button.disabled=pending||completed||!session.ready()||!Object.keys(selection).length;button.textContent=completed?'Pedido de prueba creado':'Crear pedido de prueba · sin pagar';};
 session.subscribe(()=>{epoch++;requestId='';fingerprint='';completed=false;$('demo-order-confirmation').hidden=true;availability();});
 window.addEventListener('fumada-cart-reviewed',event=>{
  selection={};for(const key of ['paperback','hardcover']){const quantity=event.detail?.items?.[key];if(Number.isInteger(quantity)&&quantity>0&&quantity<=10)selection[key]=quantity;}
  const next=JSON.stringify(selection);if(next!==fingerprint){fingerprint=next;requestId=crypto.randomUUID();completed=false;$('demo-order-confirmation').hidden=true;}
  availability();$('demo-purchase-status').textContent=session.ready()?'':'Inicia una demostración con la barra superior antes de crear el pedido.';
 });
 // The cart clears its fields on close. Restore only synthetic values on reopening.
 window.addEventListener('fumada-cart-details',()=>{for(const [key,value]of Object.entries(fictitious))$('customer-'+key).value=value;});
 button.addEventListener('click',async()=>{
  if(pending||completed||!session.ready()||!Object.keys(selection).length)return;
  if(!requestId)requestId=crypto.randomUUID();
  const version=epoch,purchaseId=requestId;pending=true;availability();$('demo-purchase-status').textContent='Creando pedido de prueba…';
  try{
   const response=await session.request('/api/demo/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Demo-Action':'purchase'},body:JSON.stringify({items:selection,requestId})});
   const result=await response.json();if(version!==epoch)return;
   if(!response.ok)throw new Error(result.error||'No se ha podido crear el pedido. Puedes reintentarlo.');
   const order=result.order;if(!/^DEMO-[A-Za-z0-9]+$/.test(order?.id||''))throw new Error('No se ha recibido un número de pedido válido.');
   if(purchaseId!==requestId){$('demo-purchase-status').textContent='El pedido anterior se ha guardado como '+order.id+'. Puedes verlo en el panel. Revisa la selección actual antes de crear otro.';return;}
   completed=true;
   session.selectOrder(order.id);$('demo-order-number').textContent=order.id;
   $('demo-order-total').textContent=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(order.total/100);
   $('demo-order-confirmation').hidden=false;updateLinks(order.id);
   $('demo-purchase-status').textContent='Pedido de prueba guardado. Conserva su número; ya puedes consultarlo en el panel y solicitar una devolución.';
   if(dialog.open)$('demo-order-title').focus();
  }catch(error){if(version===epoch)$('demo-purchase-status').textContent=error.message;}
  finally{pending=false;availability();}
 });
 $('demo-new-purchase').addEventListener('click',()=>{
  if(pending||!completed||!session.ready())return;
  completed=false;requestId=crypto.randomUUID();$('demo-order-confirmation').hidden=true;availability();$('demo-purchase-status').textContent='Puedes crear otro pedido con esta selección o editar los libros. El pedido anterior sigue guardado en el panel.';button.focus();
 });
 $('demo-order-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('demo-order-number').textContent);$('demo-purchase-status').textContent='Número de pedido copiado.';}catch{$('demo-purchase-status').textContent='Selecciona el número para copiarlo.';}});
 $('demo-order-receipt').addEventListener('click',()=>{
  const id=$('demo-order-number').textContent;if(!id)return;
  const blob=new Blob(['PEDIDO FICTICIO — SIN COMPRA NI PAGO REAL\nFumada XXL\nNúmero de pedido: '+id+'\nTotal simulado: '+$('demo-order-total').textContent+'\nCorreo ficticio: compra-ficticia@example.invalid\nNo se ha enviado ningún correo.\nConserva aparte el enlace de la demostración para volver desde otro dispositivo.'],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='pedido-de-prueba.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 availability();
})();
