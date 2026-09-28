import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorker } from '../worker/index.mjs';
import { localDatabase } from './database.mjs';
const assets={'@admin':{type:'text/html',data:Buffer.from('PRIVATE DASHBOARD').toString('base64')},'/index.html':{type:'text/html',data:Buffer.from('STOREFRONT').toString('base64')}};
const owner={'oai-authenticated-user-id':'site-owner','oai-authenticated-user-email':'owner@example.test'};
const other={'oai-authenticated-user-id':'someone-else','oai-authenticated-user-email':'visitor@example.test'};
function setup(){const env={DB:localDatabase(),ADMIN_OWNER_EMAIL:'owner@example.test'};const app=createWorker(assets);const call=(path,headers={},method='GET',body)=>app.fetch(new Request('https://book.example'+path,{headers,method,body}),env);return {env,call};}
function seed(db,id,payment='paid',created=10){db.sqlite.prepare(`INSERT INTO orders (id,created_at,customer_name,email,recipient,address1,city,postal_code,country,edition,quantity,subtotal,shipping,total,payment_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,created,'Cliente de prueba','fixture@example.test','Persona de prueba','Calle ficticia 1','Ciudad','00000','ES','paperback',1,1500,700,2200,payment);}
test('storefront is accessible; anonymous admin and APIs protected, no first visitor takeover',async()=>{
 const {env,call}=setup();assert.equal(await(await call('/')).text(),'STOREFRONT');
 const admin=await call('/admin');assert.equal(admin.status,302);assert.equal(admin.headers.get('location'),'/signin-with-chatgpt?return_to=%2Fadmin');
 assert.equal((await call('/api/admin/orders')).status,401);assert.equal((await call('/admin',other)).status,403);
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM admin_owner').get().n,0);
 assert.equal((await call('/admin',owner)).status,200);
 assert.equal((await call('/api/admin/orders',other)).status,403);
 assert.equal((await call('/api/admin/orders',{...owner,'oai-authenticated-user-id':'impersonator'})).status,403);
 assert.equal((await call('/admin/index.html',owner)).status,404);
 assert.equal((await call('/@admin',owner)).status,404);
});
test('identity stays pinned to site user ID and private responses are not cached',async()=>{
 const {env,call}=setup();await call('/admin',owner);env.ADMIN_OWNER_EMAIL='replacement@example.test';
 const response=await call('/api/admin/orders',{'oai-authenticated-user-id':'site-owner'});
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).count,0);
 assert.equal((await call('/admin',{'oai-authenticated-user-id':'replacement','oai-authenticated-user-email':'replacement@example.test'})).status,403);
});
test('database failure is unavailable, never a fabricated empty list',async()=>{
 const app=createWorker(assets);const response=await app.fetch(new Request('https://book.example/api/admin/orders',{headers:owner}),{});assert.equal(response.status,503);
});
test('lists, filters, search, details and pagination use persisted database rows',async()=>{
 const {env,call}=setup();for(let i=0;i<23;i++)seed(env.DB,'order_'+i,i%2?'pending':'paid',i);
 const data=await(await call('/api/admin/orders',owner)).json();assert.equal(data.count,23);assert.equal(data.orders.length,20);assert.equal(data.stats.pending,12);assert.equal(data.paymentConnected,false);
 const page=await(await call('/api/admin/orders?page=2',owner)).json();assert.equal(page.orders.length,3);
 const paid=await(await call('/api/admin/orders?filter=pending',owner)).json();assert.equal(paid.count,12);
 const query=await(await call('/api/admin/orders?q=order_22',owner)).json();assert.equal(query.count,1);
 const injection=await(await call('/api/admin/orders?q=%27%20OR%201%3D1--',owner)).json();assert.equal(injection.count,0);
 const detail=await(await call('/api/admin/orders/order_22',owner)).json();assert.equal(detail.order.address1,'Calle ficticia 1');
 assert.equal((await call('/api/admin/orders/missing',owner)).status,404);
 assert.equal((await call('/api/admin/orders?filter=arbitrary',owner)).status,400);
});
test('shipping requires authorization, same origin, explicit action and a paid order; payment cannot be manually changed',async()=>{
 const {env,call}=setup();seed(env.DB,'paid');seed(env.DB,'unpaid','pending');
 const headers={...owner,origin:'https://book.example','content-type':'application/json','x-admin-action':'ship'};
 const body=JSON.stringify({tracking:'TRACK-TEST'});
 assert.equal((await call('/api/admin/orders/paid/ship',{...headers,origin:'https://evil.example'},'POST',body)).status,403);
 assert.equal((await call('/api/admin/orders/paid/ship',owner,'POST',body)).status,403);
 assert.equal((await call('/api/admin/orders/unpaid/ship',headers,'POST',body)).status,409);
 assert.equal((await call('/api/admin/orders/paid/ship',headers,'POST',body)).status,200);
 assert.equal((await call('/api/admin/orders/paid/ship',headers,'POST',body)).status,409);
 const order=await(await call('/api/admin/orders/paid',owner)).json();assert.equal(order.order.fulfillment_status,'shipped');assert.equal(order.order.payment_status,'paid');assert.equal(order.order.tracking,'TRACK-TEST');
 assert.equal((await call('/api/admin/orders/unpaid',headers,'POST',JSON.stringify({payment_status:'paid'}))).status,404);
});
test('migration schema rejects invalid amounts and payment states; browser rendering uses text nodes',()=>{
 const db=localDatabase();seed(db,'one');assert.throws(()=>db.sqlite.exec("UPDATE orders SET payment_status='invented'"));assert.throws(()=>db.sqlite.exec('UPDATE orders SET total=1'));
 const js=readFileSync('admin/app.js','utf8');assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML/);assert.match(js,/textContent/);
});

test('invalid shipping payloads return client errors and never change the order',async()=>{
 const {env,call}=setup();seed(env.DB,'payload-test');
 const headers={...owner,origin:'https://book.example','content-type':'application/json','x-admin-action':'ship'};
 for(const body of ['null','[]','42','{}','{"tracking":false}','{"tracking":"\\u0000"}','{']) {
  assert.equal((await call('/api/admin/orders/payload-test/ship',headers,'POST',body)).status,400,body);
 }
 assert.equal((await call('/api/admin/orders/payload-test/ship',headers,'POST',JSON.stringify({tracking:'a'.repeat(2050)}))).status,413);
 const {order}=await(await call('/api/admin/orders/payload-test',owner)).json();
 assert.equal(order.fulfillment_status,'pending');assert.equal(order.payment_status,'paid');
});
