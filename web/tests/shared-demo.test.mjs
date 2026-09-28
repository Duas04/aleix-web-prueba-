import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { handleDemo } from '../worker/demo.mjs';
import { localDatabase } from './database.mjs';

function setup(t){
  const DB=localDatabase();t.after(()=>DB.sqlite.close());
  const env={DB,FILES:{put(){throw new Error('Demo must not write R2');},get(){throw new Error('Demo must not read R2');},delete(){throw new Error('Demo must not delete R2');}}};
  const call=(path,method='GET',headers={},body)=>handleDemo(new Request('https://book.example'+path,{method,headers,body}),env);
  const create=(ip='192.0.2.1',extra={},body={})=>call('/api/demo/session','POST',{origin:'https://book.example','x-demo-action':'session','content-type':'application/json','cf-connecting-ip':ip,...extra},JSON.stringify(body));
  const session=async()=>{const response=await create();assert.equal(response.status,200);return response.json();};
  const read=(token,path='/api/demo/admin/orders')=>call(path,'GET',{'x-demo-session':token});
  const post=(token,path,action,body,extra={})=>call(path,'POST',{'x-demo-session':token,origin:'https://book.example','x-demo-action':action,'content-type':'application/json',...extra},JSON.stringify(body));
  const action=(token,id,name,body)=>post(token,'/api/demo/admin/orders/'+id+'/'+name,name,body);
  const buy=(token,requestId=randomUUID(),items={paperback:1,hardcover:1},extra={})=>post(token,'/api/demo/orders','purchase',{items,requestId,...extra});
  const detail=async(token,id)=>(await(await read(token,'/api/demo/admin/orders/'+id)).json()).order;
  const customer=async(token,id)=>(await(await read(token,'/api/demo/returns/'+id)).json()).case;
  return {DB,env,call,create,session,read,post,action,buy,detail,customer};
}

test('shared demo creates expiring hashed bearer sessions with four fictional examples and private responses',async t=>{
  const {session,read,DB,call}=setup(t);const {token,expiresAt}=await session();assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.ok(expiresAt>Date.now()+6*86400000);
  const stored=DB.sqlite.prepare('SELECT * FROM demo_sessions').get();assert.equal(stored.token_hash,createHash('sha256').update(token).digest('hex'));assert.ok(!stored.data.includes(token));assert.equal(stored.revision,0);
  const response=await read(token);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  const list=await response.json();assert.equal(list.orders.length,4);assert.equal(list.stats.total,4);assert.equal(list.stats.pending,1);assert.equal(list.stats.returns,1);assert.equal(list.stats.delivered,1);assert.equal(list.paymentConnected,false);
  const mixed=list.orders.find(o=>o.id==='DEMO-002');assert.equal(mixed.items.length,2);assert.equal(mixed.total,4200);assert.equal(mixed.return_status,'requested');assert.equal(list.orders.find(o=>o.id==='DEMO-004').payment_status,'refunded');
  assert.equal(await call('/api/admin/orders'),null);assert.equal(await call('/'),null);
});

test('session creation throttles its own IP quota and respects atomic active-session cap and bounded cleanup',async t=>{
  const {create,DB}=setup(t);
  for(let i=0;i<5;i++)assert.equal((await create()).status,200);
  assert.equal((await create()).status,429);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM demo_sessions').get().n,5);
  const quota=DB.sqlite.prepare('SELECT * FROM return_rate_limits').get();assert.match(quota.key,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(quota).includes('192.0.2.1'));
  DB.sqlite.exec('DELETE FROM demo_sessions');
  const insert=DB.sqlite.prepare('INSERT INTO demo_sessions(token_hash,expires_at,data,revision) VALUES(?,?,?,0)');for(let i=0;i<250;i++)insert.run(createHash('sha256').update('active_'+i).digest('hex'),Date.now()+86400000,'{"orders":[],"purchases":{}}');
  assert.equal((await create('198.51.100.1')).status,429);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM demo_sessions').get().n,250);
  DB.sqlite.exec('DELETE FROM demo_sessions');for(let i=0;i<31;i++)insert.run(createHash('sha256').update('expired_'+i).digest('hex'),1,'{"orders":[],"purchases":{}}');
  assert.equal((await create('198.51.100.2')).status,200);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM demo_sessions WHERE expires_at=1').get().n,11);
});

test('bearers isolate sessions and expired or URL-only credentials grant no access',async t=>{
  const {session,buy,read,DB}=setup(t);const a=await session(),b=await session();const purchased=await(await buy(a.token)).json();
  assert.equal((await read(b.token,'/api/demo/admin/orders/'+purchased.order.id)).status,404);
  assert.equal((await read('X'.repeat(43))).status,401);assert.equal((await read(undefined,'/api/demo/admin/orders?token='+a.token)).status,401);
  DB.sqlite.prepare('UPDATE demo_sessions SET expires_at=1 WHERE token_hash=?').run(createHash('sha256').update(a.token).digest('hex'));assert.equal((await read(a.token)).status,401);assert.equal((await buy(a.token)).status,401);
});

test('fictional purchase calculates prices on server, is idempotent, and cannot store personal fields or touch real orders',async t=>{
  const {session,buy,DB,read}=setup(t);const {token}=await session(),requestId=randomUUID();
  const response=await buy(token,requestId);assert.equal(response.status,200);const first=await response.json();assert.match(first.order.id,/^DEMO-[A-F0-9]{12}$/);assert.equal(first.order.subtotal,3500);assert.equal(first.order.shipping,700);assert.equal(first.order.total,4200);assert.equal(first.order.payment_status,'paid');assert.equal(first.order.quantity,2);assert.equal(first.order.items.length,2);assert.ok(first.order.email.endsWith('@example.invalid'));
  const second=await(await buy(token,requestId)).json();assert.equal(second.order.id,first.order.id);assert.equal((await(await read(token)).json()).count,5);
  assert.equal((await buy(token,requestId,{paperback:2,hardcover:0})).status,409);
  assert.equal((await buy(token,randomUUID(),{paperback:1,hardcover:0},{email:'real@example.com',address:'Real street'})).status,400);
  for(const table of ['orders','return_access','admin_owner'])assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM '+table).get().n,0);
  const stored=DB.sqlite.prepare('SELECT data FROM demo_sessions').get().data;assert.ok(!stored.includes('real@example.com'));assert.ok(!stored.includes('Real street'));
});

test('purchase bounds and order cap prevent unbounded state while duplicate confirmation still works at capacity',async t=>{
  const {session,buy,read}=setup(t);const {token}=await session();
  for(const items of [{paperback:0,hardcover:0},{paperback:11},{paperback:-1},{paperback:1.5},{paperback:'1'},{paperback:1,extra:1},{paperback:null,hardcover:1},null])assert.equal((await buy(token,randomUUID(),items)).status,400);
  assert.equal((await buy(token,'not-a-uuid')).status,400);
  let first;const requestId=randomUUID();for(let i=0;i<16;i++){const response=await buy(token,i?randomUUID():requestId,{hardcover:10,paperback:10});assert.equal(response.status,200);if(!i)first=(await response.json()).order;}
  assert.equal((await(await read(token)).json()).count,20);assert.equal((await buy(token)).status,409);assert.equal((await(await buy(token,requestId,{hardcover:10,paperback:10})).json()).order.id,first.id);
});

test('all writes need same origin, matching action, bounded JSON and an explicit order version',async t=>{
  const {session,create,post,buy,action,detail}=setup(t);const {token}=await session();
  assert.equal((await create(undefined,{origin:'https://evil.example'})).status,403);assert.equal((await create(undefined,{}, {email:'real@example.test'})).status,400);
  for(const extra of [{origin:'https://evil.example'},{'x-demo-action':'session'},{'content-type':'text/plain'}])assert.equal((await post(token,'/api/demo/orders','purchase',{items:{paperback:1},requestId:randomUUID()},extra)).status,403);
  assert.equal((await action(token,'DEMO-001','notes',{note:'x'.repeat(9000),expectedVersion:0})).status,413);
  assert.equal((await action(token,'DEMO-001','notes',{note:'bad\u0000',expectedVersion:0})).status,400);
  assert.equal((await action(token,'DEMO-001','ship',{tracking:'SIMULADO'})).status,400);assert.equal((await action(token,'DEMO-001','notes',{note:'x',expectedVersion:'0'})).status,400);
  assert.equal((await detail(token,'DEMO-001')).management_version,0);assert.equal((await buy(token)).status,200);
});

test('buyer request, owner response, delivery and fake label stay synchronized between separate clients',async t=>{
  const {session,buy,post,customer,action,detail,read}=setup(t);const {token}=await session();const {order}=await(await buy(token)).json();
  const request=await post(token,'/api/demo/returns/'+order.id,'request',{kind:'withdrawal',reason:'',expectedVersion:0});assert.equal(request.status,200);assert.equal((await customer(token,order.id)).status,'requested');assert.equal((await detail(token,order.id)).return_reason,'Desistimiento sin motivo indicado.');
  assert.equal((await action(token,order.id,'ship',{tracking:'SIMULADO',expectedVersion:1})).status,409);
  assert.equal((await action(token,order.id,'return',{status:'approved',reason:'Desistimiento',resolution:'',expectedVersion:1})).status,200);
  assert.equal((await action(token,order.id,'portal-reply',{reply:'Instrucciones simuladas',carrier:'Transportista ficticio',code:'FICTICIO-123',expectedVersion:2})).status,200);
  assert.equal((await action(token,order.id,'return-label',{type:'application/pdf',size:100,expectedVersion:3})).status,200);
  const current=await customer(token,order.id);assert.equal(current.reply,'Instrucciones simuladas');assert.equal(current.code,'FICTICIO-123');assert.deepEqual(current.label,{type:'application/pdf',size:100});assert.ok(current.submittedAt>0);assert.equal(current.version,4);assert.equal(current.paymentStatus,'paid');assert.ok(!JSON.stringify(current).includes('email'));
  assert.equal((await action(token,order.id,'return-label-remove',{expectedVersion:4})).status,200);assert.equal((await customer(token,order.id)).label,null);
  const link=await(await action(token,order.id,'portal-link',{expectedVersion:5})).json();assert.equal(link.path,'/devoluciones?demo=1#session='+token+'&order='+order.id);
  assert.equal((await action(token,order.id,'portal-revoke',{expectedVersion:6})).status,200);assert.equal((await read(token,'/api/demo/returns/'+order.id)).status,401);
  assert.equal((await action(token,order.id,'portal-link',{expectedVersion:7})).status,200);assert.equal((await read(token,'/api/demo/returns/'+order.id)).status,200);
});

test('management and list filters preserve return holds, shipping states, search and payment separation',async t=>{
  const {session,action,detail,read}=setup(t);const {token}=await session();
  assert.equal((await action(token,'DEMO-003','return',{status:'requested',reason:'x',resolution:'',expectedVersion:0})).status,409);
  assert.equal((await action(token,'DEMO-001','ship',{carrier:'Ficticio',tracking:'DEMO',expectedVersion:0})).status,200);
  assert.equal((await action(token,'DEMO-001','tracking',{carrier:'Otro ficticio',tracking:'DEMO-2',expectedVersion:1})).status,200);
  assert.equal((await action(token,'DEMO-001','deliver',{confirmed:true,expectedVersion:2})).status,200);
  assert.equal((await action(token,'DEMO-001','tracking',{carrier:'x',tracking:'y',expectedVersion:3})).status,409);assert.equal((await detail(token,'DEMO-001')).payment_status,'paid');
  assert.equal((await action(token,'DEMO-002','notes',{note:'Revisar\nEmbalaje',expectedVersion:0})).status,200);assert.equal((await detail(token,'DEMO-002')).private_note,'Revisar\nEmbalaje');
  assert.equal((await(await read(token,'/api/demo/admin/orders?filter=delivered')).json()).count,2);assert.equal((await(await read(token,'/api/demo/admin/orders?filter=returns')).json()).count,1);assert.equal((await(await read(token,'/api/demo/admin/orders?q=DEMO-002')).json()).count,1);
  assert.equal((await read(token,'/api/demo/admin/orders?filter=unknown')).status,400);
});

test('session CAS merges simultaneous edits to different orders and only one same-version edit wins',async t=>{
  const {session,action,detail,DB}=setup(t);const {token}=await session();
  const both=await Promise.all([action(token,'DEMO-001','notes',{note:'A',expectedVersion:0}),action(token,'DEMO-002','notes',{note:'B',expectedVersion:0})]);assert.deepEqual(both.map(r=>r.status),[200,200]);assert.equal((await detail(token,'DEMO-001')).private_note,'A');assert.equal((await detail(token,'DEMO-002')).private_note,'B');
  const conflict=await Promise.all([action(token,'DEMO-001','notes',{note:'C',expectedVersion:1}),action(token,'DEMO-001','notes',{note:'D',expectedVersion:1})]);assert.deepEqual(conflict.map(r=>r.status).sort(),[200,409]);assert.equal(DB.sqlite.prepare('SELECT revision FROM demo_sessions').get().revision,3);
});

test('concurrent duplicate purchases create one ID and one new row in the session',async t=>{
  const {session,buy,read}=setup(t);const {token}=await session(),requestId=randomUUID();const replies=await Promise.all([buy(token,requestId),buy(token,requestId)]);assert.deepEqual(replies.map(r=>r.status),[200,200]);const data=await Promise.all(replies.map(r=>r.json()));assert.equal(data[0].order.id,data[1].order.id);assert.equal((await(await read(token)).json()).count,5);
});
