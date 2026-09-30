import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
test('unknown public URLs offer safe recovery links while keeping a real 404 and private APIs protected',async()=>{
  const path='/demohttps://prueba-aleix.com/demo';
  const response=await worker.fetch(new Request('https://book.example'+path),{});
  assert.equal(response.status,404);
  assert.match(response.headers.get('content-type'),/text\/html/);
  assert.match(response.headers.get('cache-control'),/no-store/);
  const body=await response.text();
  assert.match(body,/href="\/comunidad"/);
  assert.match(body,/href="\/"/);
  assert.doesNotMatch(body,/demohttps|PRIVATE DASHBOARD|address1/);
  const head=await worker.fetch(new Request('https://book.example'+path,{method:'HEAD'}),{});
  assert.equal(head.status,404);assert.equal(await head.text(),'');
  const api=await worker.fetch(new Request('https://book.example/api/not-real'),{});
  assert.equal(api.status,404);assert.match(api.headers.get('content-type'),/application\/json/);
  assert.equal((await worker.fetch(new Request('https://book.example/propietario'),{})).status,302);
});
test('retired demonstrations and real sales APIs are absent from the deployed bundle',async()=>{
 for(const path of ['/demo','/demo/','/demo/app.js'])assert.equal((await worker.fetch(new Request('https://book.example'+path),{})).status,410);
 for(const path of ['/api/admin/orders','/api/returns/case','/api/demo/session','/shop.js'])assert.equal((await worker.fetch(new Request('https://book.example'+path),{})).status,404);
});
test('demo search, details and shipment use fictional, resettable browser state only',async()=>{
  const script=readFileSync('admin/demo-data.js','utf8')+'\ndemoApi;';
  const create=()=>vm.runInNewContext(script,{URL,structuredClone});
  const api=create();
  assert.equal((await api('/api/admin/orders')).count,4);
  assert.equal((await api('/api/admin/orders?filter=pending')).count,1);
  assert.equal((await api('/api/admin/orders?q=DEMO-003')).count,1);
  assert.match((await api('/api/admin/orders/DEMO-001')).order.email,/@example.invalid$/);
  await api('/api/admin/orders/DEMO-001/ship',{method:'POST',body:'{"tracking":"FICTICIO"}'});
  assert.equal((await api('/api/admin/orders?filter=shipped')).count,3);
  assert.equal((await create()('/api/admin/orders?filter=shipped')).count,2);
});

test('refunded demo example appears under incidents and cannot be shipped',async()=>{
  const api=vm.runInNewContext(readFileSync('admin/demo-data.js','utf8')+'\ndemoApi;',{URL,structuredClone});
  const incidents=await api('/api/admin/orders?filter=incidents');
  assert.equal(incidents.count,2);
  assert.ok(incidents.orders.some(order=>order.id==='DEMO-004'));
  const {order}=await api('/api/admin/orders/DEMO-004');
  assert.equal(order.payment_status,'refunded');
  assert.equal(order.total,2700);
  assert.equal(order.fulfillment_status,'shipped');
  await assert.rejects(api('/api/admin/orders/DEMO-004/ship',{method:'POST',body:'{"tracking":"NO-ENVIAR"}'}),/no se puede/);
  assert.equal((await api('/api/admin/orders?filter=pending')).count,1);
  assert.equal((await api('/api/admin/orders?filter=unpaid')).count,1);
});

test('demo management persists only in this demo instance and never changes payment',async()=>{
  const create=()=>vm.runInNewContext(readFileSync('admin/demo-data.js','utf8')+'\ndemoApi;',{URL,structuredClone});
  const api=create();
  const post=(id,action,data)=>api('/api/admin/orders/'+id+'/'+action,{method:'POST',body:JSON.stringify(data)});
  const initial=(await api('/api/admin/orders/DEMO-002')).order;
  assert.equal(initial.items.length,2);
  assert.equal(initial.items.reduce((sum,item)=>sum+item.subtotal,0),initial.subtotal);
  assert.equal((await api('/api/admin/orders?filter=returns')).count,1);
  const saved=await post('DEMO-002','notes',{note:'Revisar embalaje de ejemplo',expectedVersion:0});
  assert.equal(saved.order.private_note,'Revisar embalaje de ejemplo');
  assert.equal(saved.order.management_version,1);
  await assert.rejects(post('DEMO-002','notes',{note:'Obsoleto',expectedVersion:0}),/actualiz|cambi/i);
  const reviewed=await post('DEMO-002','return',{status:'reviewing',reason:initial.return_reason,resolution:'',expectedVersion:1});
  assert.equal(reviewed.order.return_status,'reviewing');
  assert.equal(reviewed.order.payment_status,'paid');
  assert.equal((await create()('/api/admin/orders/DEMO-002')).order.management_version,0);
});

test('demo shipment can save its carrier, correct tracking and confirm delivery',async()=>{
  const api=vm.runInNewContext(readFileSync('admin/demo-data.js','utf8')+'\ndemoApi;',{URL,structuredClone});
  const post=(action,data)=>api('/api/admin/orders/DEMO-001/'+action,{method:'POST',body:JSON.stringify(data)});
  const shipped=await post('ship',{carrier:'Transportista de ejemplo',tracking:'DEMO-123',expectedVersion:0});
  assert.equal(shipped.order.carrier,'Transportista de ejemplo');
  const updated=await post('tracking',{carrier:'Transportista de ejemplo',tracking:'DEMO-456',expectedVersion:1});
  assert.equal(updated.order.tracking,'DEMO-456');
  await assert.rejects(post('deliver',{confirmed:false,expectedVersion:2}),/confirm/i);
  const delivered=await post('deliver',{confirmed:true,expectedVersion:2});
  assert.ok(delivered.order.delivered_at>0);
  assert.equal(delivered.order.payment_status,'paid');
  assert.equal((await api('/api/admin/orders?filter=delivered')).count,2);
});

test('demo portal access, reply and label are fictional and keep payment unchanged',async()=>{
  const api=vm.runInNewContext(readFileSync('admin/demo-data.js','utf8')+'\ndemoApi;',{URL,structuredClone});
  const post=(action,data)=>api('/api/admin/orders/DEMO-002/'+action,{method:'POST',body:JSON.stringify(data)});
  assert.equal((await api('/api/admin/orders?filter=access_requests')).count,1);
  const link=await post('portal-link',{expectedVersion:0});
  assert.equal(link.path,'/devoluciones?demo=1');assert.equal(link.order.payment_status,'paid');
  assert.equal((await api('/api/admin/orders')).stats.accessRequests,0);
  await assert.rejects(post('portal-reply',{expectedVersion:1,reply:'',carrier:'Ejemplo',code:'FICTICIO'}),/Aprueba/);
  await post('return',{status:'approved',reason:'Libro dañado de ejemplo',resolution:'',expectedVersion:1});
  const reply=await post('portal-reply',{expectedVersion:2,reply:'Ejemplo: empaqueta el libro.',carrier:'Ejemplo',code:'FICTICIO'});
  assert.match(reply.order.customer_reply,/empaqueta/);assert.equal(reply.order.payment_status,'paid');
  const label=await api('/api/admin/orders/DEMO-002/return-label',{method:'POST',headers:{'X-Order-Version':'3'},body:{type:'application/pdf',size:100}});
  assert.equal(label.order.return_label_key,'DEMO-NO-VALIDA-PARA-ENVIOS');
  const removed=await post('return-label-remove',{expectedVersion:4});assert.equal(removed.order.return_label_key,null);
  const revoked=await post('portal-revoke',{expectedVersion:5});assert.equal(revoked.order.payment_status,'paid');
});
