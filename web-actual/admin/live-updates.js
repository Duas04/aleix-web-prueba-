// Refresh only visible pages and preserve all unsaved management fields.
(()=>{
 let timer=null,checking=false;
 const dirty=()=>{
  if(!currentOrder)return false;
  const initial={'private-note':currentOrder.private_note||'','carrier':currentOrder.carrier||'','tracking':currentOrder.tracking||'','tracking-carrier':currentOrder.carrier||'','tracking-code':currentOrder.tracking||'','return-status':currentOrder.return_status==='none'||!currentOrder.return_status?'requested':currentOrder.return_status,'return-reason':currentOrder.return_reason||'','return-resolution':currentOrder.return_resolution||'','customer-reply':currentOrder.customer_reply||'','return-carrier':currentOrder.return_carrier||'','return-code':currentOrder.return_code||''};
  return Object.entries(initial).some(([id,value])=>$(id).value!==value)||['ship-confirm','deliver-confirm','portal-revoke-confirm','return-label-remove-confirm'].some(id=>$(id).checked)||!!$('return-label-file').files?.length;
 };
 const schedule=()=>{clearTimeout(timer);if(!document.hidden)timer=setTimeout(poll,5000);};
 async function poll(){
  if(checking||document.hidden||saving||loading){schedule();return;}
  if(document.body.classList.contains('demo-page')&&!window.DemoSession?.ready()){schedule();return;}
  checking=true;
  try{
   if($('detail').open&&currentOrder){
    const version=detailRequest,id=currentOrder.id;
    const {order}=await api('/api/admin/orders/'+encodeURIComponent(id));
    if(version!==detailRequest||!$('detail').open||saving||currentOrder?.id!==id)return;
    if(order.management_version!==currentOrder.management_version){
      clearPortalLink();
      if(dirty()){$('detail-message').textContent='Este pedido cambió en otro dispositivo. Se conservan tus campos; cierra y vuelve a abrir el detalle antes de guardar.';}
      else{renderDetail(order);$('detail-message').textContent='Pedido actualizado desde otro dispositivo.';}
    }
   }else if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.activeElement?.closest?.('#table-wrap'))await load({quiet:true});
  }catch{/* Retain the current view; manual refresh exposes persistent errors. */}
  finally{checking=false;schedule();}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else poll();});
 schedule();
})();
