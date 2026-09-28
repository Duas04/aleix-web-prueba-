import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import { createWorker } from '../worker/index.mjs';
import { localDatabase } from './database.mjs';

test('additive management migration preserves existing orders and owner',t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(readFileSync('drizzle/0000_cultured_mathemanic.sql','utf8'));
  db.exec(readFileSync('drizzle/0001_lonely_black_bolt.sql','utf8'));
  db.exec("INSERT INTO admin_owner(slot,user_id) VALUES(1,'existing-owner'); INSERT INTO orders(id,created_at,customer_name,email,recipient,address1,city,postal_code,country,edition,quantity,subtotal,shipping,total,payment_status) VALUES('legacy',10,'Prueba','example@example.invalid','Prueba','Calle ficticia','Ciudad','00000','ES','paperback',1,1500,700,2200,'paid')");
  const before=db.prepare('SELECT * FROM orders').get();
  db.exec(readFileSync('drizzle/0002_cute_blazing_skull.sql','utf8'));
  const after=db.prepare('SELECT * FROM orders').get();
  for(const [key,value]of Object.entries(before))assert.equal(after[key],value,key);
  assert.equal(after.management_version,0);assert.equal(after.return_status,'none');assert.equal(after.private_note,'');
  assert.equal(db.prepare('SELECT user_id FROM admin_owner').get().user_id,'existing-owner');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});

const owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'};
function setup(t){
  const DB=localDatabase();t.after(()=>DB.sqlite.close());
  const env={DB,ADMIN_OWNER_EMAIL:'owner@example.test'},app=createWorker({});
  function seed(id='one',payment='paid',fulfillment='pending'){
    DB.sqlite.prepare(`INSERT INTO orders(id,created_at,customer_name,email,recipient,address1,city,postal_code,country,edition,quantity,subtotal,shipping,total,payment_status,fulfillment_status) VALUES(?,10,'Álvaro','fixture@example.test','Persona','Calle','Ciudad','00000','ES','paperback',2,3101,700,3801,?,?)`).run(id,payment,fulfillment);
  }
  const request=(path,method='GET',headers=owner,body)=>app.fetch(new Request('https://book.example'+path,{method,headers,body}),env);
  const mutate=(action,body,id='one',headers={})=>request('/api/admin/orders/'+id+'/'+action,'POST',{...owner,origin:'https://book.example','content-type':'application/json','x-admin-action':action,...headers},JSON.stringify(body));
  const detail=async(id='one')=>(await(await request('/api/admin/orders/'+id)).json()).order;
  return {DB,env,app,seed,request,mutate,detail};
}

test('private notes persist with optimistic versions and never change payment or shipment',async t=>{
  const {seed,mutate,detail}=setup(t);seed();
  assert.equal((await mutate('notes',{note:'Llamar mañana.\nPuerta azul',expectedVersion:0})).status,200);
  const order=await detail();assert.equal(order.private_note,'Llamar mañana.\nPuerta azul');assert.equal(order.management_version,1);assert.ok(order.note_updated_at>0);
  assert.equal(order.payment_status,'paid');assert.equal(order.fulfillment_status,'pending');
  assert.equal((await mutate('notes',{note:'Sobrescribir',expectedVersion:0})).status,409);
  assert.equal((await detail()).private_note,'Llamar mañana.\nPuerta azul');
  assert.equal((await mutate('notes',{note:'',expectedVersion:1})).status,200);assert.equal((await detail()).private_note,'');
});

test('management mutations require owner, same origin, matching action and JSON',async t=>{
  const {seed,mutate,request}=setup(t);seed();
  for(const action of ['notes','tracking','deliver','return']){
    const body={note:'Privado',expectedVersion:0};
    assert.equal((await mutate(action,body,'one',{'oai-authenticated-user-id':'visitor','oai-authenticated-user-email':'visitor@example.test'})).status,403);
    assert.equal((await mutate(action,body,'one',{'oai-authenticated-user-id':''})).status,401);
    assert.equal((await mutate(action,body,'one',{origin:'https://evil.example'})).status,403);
    assert.equal((await mutate(action,body,'one',{'x-admin-action':'ship'})).status,403);
    assert.equal((await mutate(action,body,'one',{'content-type':'text/plain'})).status,403);
    assert.equal((await request('/api/admin/orders/one/'+action,'GET')).status,404);
  }
});

test('management validation rejects malformed, oversized and control-bearing payloads without writes',async t=>{
  const {seed,mutate,request,detail}=setup(t);seed();
  const headers={...owner,origin:'https://book.example','content-type':'application/json','x-admin-action':'notes'};
  for(const raw of ['null','[]','{','42'])assert.equal((await request('/api/admin/orders/one/notes','POST',headers,raw)).status,400);
  const invalid=[{}, {note:'x'}, {note:3,expectedVersion:0},{note:'x',expectedVersion:-1},{note:'x',expectedVersion:0.5},{note:'x',expectedVersion:'0'},{note:'x'.repeat(2001),expectedVersion:0},{note:'bad\u0000',expectedVersion:0}];
  for(const body of invalid)assert.equal((await mutate('notes',body)).status,400);
  assert.equal((await mutate('notes',{note:'x'.repeat(8200),expectedVersion:0})).status,413);
  assert.equal((await mutate('tracking',{carrier:'x'.repeat(81),tracking:'ok',expectedVersion:0})).status,400);
  assert.equal((await mutate('tracking',{carrier:'ok',tracking:'bad\ntrack',expectedVersion:0})).status,400);
  assert.equal((await mutate('deliver',{confirmed:false,expectedVersion:0})).status,400);
  assert.equal((await mutate('return',{status:'refunded',reason:'x',resolution:'',expectedVersion:0})).status,400);
  assert.equal((await mutate('return',{status:'none',reason:'',resolution:'',expectedVersion:0})).status,400);
  assert.equal((await detail()).management_version,0);
});

test('tracking and confirmed delivery require shipment, preserve payment, and reject stale edits',async t=>{
  const {seed,mutate,detail}=setup(t);seed();
  assert.equal((await mutate('tracking',{carrier:'Correos',tracking:'A-1',expectedVersion:0})).status,409);
  assert.equal((await mutate('deliver',{confirmed:true,expectedVersion:0})).status,409);
  assert.equal((await mutate('ship',{carrier:' Correos ',tracking:' A-1 ',expectedVersion:0})).status,200);
  assert.equal((await mutate('tracking',{carrier:'SEUR',tracking:'B-2',expectedVersion:0})).status,409);
  assert.equal((await mutate('tracking',{carrier:' SEUR ',tracking:' B-2 ',expectedVersion:1})).status,200);
  assert.equal((await mutate('deliver',{confirmed:true,expectedVersion:2})).status,200);
  const order=await detail();assert.equal(order.carrier,'SEUR');assert.equal(order.tracking,'B-2');assert.equal(order.management_version,3);assert.ok(order.delivered_at>0);assert.equal(order.fulfillment_status,'shipped');assert.equal(order.payment_status,'paid');
  assert.equal((await mutate('deliver',{confirmed:true,expectedVersion:3})).status,409);
  assert.equal((await mutate('tracking',{carrier:'Other',tracking:'C-3',expectedVersion:3})).status,409);
});

test('active returns hold shipping and transitions never refund or rewrite payment',async t=>{
  const {seed,mutate,detail}=setup(t);seed();
  const change=(status,expectedVersion,reason='Tapa dañada\nFotos recibidas',resolution='')=>mutate('return',{status,reason,resolution,expectedVersion});
  assert.equal((await change('approved',0)).status,409);
  assert.equal((await change('requested',0,'')).status,400);
  assert.equal((await change('requested',0)).status,200);
  assert.equal((await mutate('ship',{tracking:'',expectedVersion:1})).status,409);
  assert.equal((await mutate('ship',{tracking:''})).status,409);
  assert.equal((await change('requested',0)).status,409);
  assert.equal((await change('requested',1)).status,200);
  assert.equal((await change('reviewing',2)).status,200);
  assert.equal((await change('received',3)).status,409);
  assert.equal((await change('rejected',3)).status,400);
  assert.equal((await change('approved',3)).status,200);
  assert.equal((await change('received',4)).status,200);
  assert.equal((await change('closed',5,'Tapa dañada','Recambio acordado\nSin devolución de dinero')).status,200);
  const order=await detail();assert.equal(order.return_status,'closed');assert.equal(order.payment_status,'paid');assert.equal(order.fulfillment_status,'pending');assert.ok(order.return_updated_at>0);
  assert.equal((await change('requested',6)).status,200);
  assert.equal((await change('rejected',7,'Consulta','No procede')).status,200);
  assert.equal((await mutate('ship',{tracking:'',expectedVersion:8})).status,200);
});

test('returns allow settled payment statuses and reject unpaid orders',async t=>{
  const {seed,mutate,detail}=setup(t);
  for(const payment of ['pending','failed','paid','refunded','partially_refunded']){
    seed(payment,payment);
    assert.equal((await mutate('return',{status:'requested',reason:'Consulta',resolution:'',expectedVersion:0},payment)).status,['pending','failed'].includes(payment)?409:200);
    assert.equal((await detail(payment)).payment_status,payment);
  }
});

test('lists expose management fields and count delivery and active returns across filters and search',async t=>{
  const {seed,DB,request}=setup(t);
  seed('prepare');seed('hold');seed('sent','paid','shipped');seed('received','paid','shipped');seed('failed','failed');seed('refund','refunded');seed('partial','partially_refunded');
  DB.sqlite.exec("UPDATE orders SET return_status='requested' WHERE id='hold'; UPDATE orders SET delivered_at=10 WHERE id='received'");
  const list=async(filter='all',q='')=>(await(await request('/api/admin/orders?'+new URLSearchParams({filter,q}))).json());
  const all=await list();assert.deepEqual(all.stats,{total:7,pending:1,shipped:2,incidents:3,returns:1,delivered:1});
  assert.equal((await list('pending')).count,1);assert.equal((await list('returns')).count,1);assert.equal((await list('delivered')).count,1);assert.equal((await list('shipped')).count,2);assert.equal((await list('incidents')).count,4);assert.equal((await list('attention')).count,3);
  assert.equal((await list('returns','not-present')).count,0);
  const row=all.orders.find(o=>o.id==='hold');assert.equal(row.return_status,'requested');assert.equal(row.management_version,0);assert.ok(Object.hasOwn(row,'carrier'));assert.ok(Object.hasOwn(row,'tracking'));assert.ok(Object.hasOwn(row,'delivered_at'));assert.ok(Array.isArray(row.items));assert.equal(row.private_note,undefined);
});

test('mixed items are fetched by page in one query and legacy fallback keeps the true subtotal',async t=>{
  const {seed,DB,detail,request}=setup(t);seed('mixed');seed('legacy');
  DB.sqlite.prepare('INSERT INTO order_items(order_id,edition,quantity,unit_price) VALUES(?,?,?,?)').run('mixed','paperback',1,1500);
  DB.sqlite.prepare('INSERT INTO order_items(order_id,edition,quantity,unit_price) VALUES(?,?,?,?)').run('mixed','hardcover',2,2000);
  const mixed=await detail('mixed');assert.deepEqual(mixed.items,[{edition:'paperback',quantity:1,unit_price:1500,subtotal:1500},{edition:'hardcover',quantity:2,unit_price:2000,subtotal:4000}]);
  assert.deepEqual((await detail('legacy')).items,[{edition:'paperback',quantity:2,unit_price:1550.5,subtotal:3101}]);
  for(let i=0;i<21;i++)seed('page_'+i);
  let itemQueries=0;const original=DB.prepare;DB.prepare=sql=>{if(/FROM order_items/.test(sql))itemQueries++;return original(sql);};
  const list=await(await request('/api/admin/orders')).json();assert.equal(list.orders.length,20);assert.equal(itemQueries,1);assert.ok(list.orders.every(o=>Array.isArray(o.items)&&o.items.length>0));
});

test('competing updates allow one winner and storage failures do not report success',async t=>{
  const {seed,mutate,detail,env,app}=setup(t);seed();
  const responses=await Promise.all([mutate('notes',{note:'A',expectedVersion:0}),mutate('notes',{note:'B',expectedVersion:0})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await detail()).management_version,1);
  env.DB.prepare=()=>{throw new Error('storage unavailable');};
  const failed=await app.fetch(new Request('https://book.example/api/admin/orders/one/notes',{method:'POST',headers:{...owner,origin:'https://book.example','content-type':'application/json','x-admin-action':'notes'},body:JSON.stringify({note:'C',expectedVersion:1})}),env);
  assert.equal(failed.status,503);assert.match(failed.headers.get('cache-control'),/no-store/);
});
