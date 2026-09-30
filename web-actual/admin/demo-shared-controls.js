$('demo-start').addEventListener('click',()=>openDetail('DEMO-001'));
$('demo-refund').addEventListener('click',()=>openDetail('DEMO-004'));
$('demo-return').addEventListener('click',()=>openDetail('DEMO-002'));
$('demo-reset').addEventListener('click',()=>window.DemoSession.create());
$('demo-label').addEventListener('click',()=>saveManagement('return-label',{type:'application/pdf',size:120},'Etiqueta de ejemplo disponible en el portal del comprador. No es válida para envíos.'));
window.DemoSession.subscribe(()=>{
  listRequest++;detailRequest++;if($('detail').open)$('detail').close();
  currentOrder=null;page=1;$('search').value='';$('filter').value='all';load();
});
const sharedSelected=window.DemoSession.orderId();
if(window.DemoSession.ready()&&sharedSelected)openDetail(sharedSelected);
