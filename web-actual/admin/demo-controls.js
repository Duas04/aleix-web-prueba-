// Included only in the fictional demo bundle; never served with the private panel.
$('demo-start').addEventListener('click',()=>openDetail('DEMO-001'));
$('demo-refund').addEventListener('click',()=>openDetail('DEMO-004'));
$('demo-return').addEventListener('click',()=>openDetail('DEMO-002'));
$('demo-reset').addEventListener('click',()=>{$('search-form').reset();window.location.reload();});
