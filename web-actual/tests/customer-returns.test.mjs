import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../worker/index.mjs';
import { localDatabase } from './database.mjs';

const owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'};
const pdf=Buffer.from('%PDF-1.7\nfixture\n%%EOF');
function setup(t){
  const DB=localDatabase();t.after(()=>DB.sqlite.close());const objects=new Map(),deleted=[];
  const FILES={async put(key,bytes,options){objects.set(key,{bytes:Buffer.from(bytes),options});},async get(key){const item=objects.get(key);return item?{body:new Response(item.bytes).body,size:item.bytes.length,httpMetadata:item.options?.httpMetadata}:null;},async delete(key){deleted.push(key);objects.delete(key);}};
  const env={DB,FILES,ADMIN_OWNER_EMAIL:'owner@example.test'};
  const assets={'@returns':{type:'text/html',data:Buffer.from('RETURNS PAGE').toString('base64')}};
  const app=createWorker(assets);
  const call=(path,method='GET',headers={},body)=>app.fetch(new Request('https://book.example'+path,{method,headers,body}),env);
  const seed=(id='one',payment='paid')=>DB.sqlite.prepare(`INSERT INTO orders(id,created_at,customer_name,email,recipient,address1,city,postal_code,country,edition,quantity,subtotal,shipping,total,payment_status,private_note) VALUES(?,10,'Cliente secreto','buyer@example.test','Recipiente secreto','Dirección secreta','Ciudad','00000','ES','paperback',1,1500,700,2200,?,'Nota secreta')`).run(id,payment);
  const admin=(action,body,id='one',extra={})=>call('/api/admin/orders/'+id+'/'+action,'POST',{...owner,origin:'https://book.example','content-type':'application/json','x-admin-action':action,...extra},JSON.stringify(body));
  const access=(body={orderId:'one',email:'buyer@example.test'},ip='192.0.2.1',extra={})=>call('/api/returns/access','POST',{origin:'https://book.example','content-type':'application/json','x-return-action':'access',...(ip?{'cf-connecting-ip':ip}:{}),...extra},JSON.stringify(body));
  const issue=async(version=0,id='one')=>{const response=await admin('portal-link',{expectedVersion:version},id);assert.equal(response.status,200);const data=await response.json();return {...data,token:new URLSearchParams(data.path.split('#')[1]).get('token')};};
  const read=(token,query='')=>call('/api/returns/case'+query,'GET',token?{'x-return-token':token}:{});
  const requestCase=(token,body,extra={})=>call('/api/returns/case','POST',{origin:'https://book.example','content-type':'application/json','x-return-action':'request','x-return-token':token,...extra},JSON.stringify(body));
  const upload=(version,bytes=pdf,type='application/pdf',id='one',extra={})=>call('/api/admin/orders/'+id+'/return-label','POST',{...owner,origin:'https://book.example','content-type':type,'x-admin-action':'return-label','x-order-version':String(version),...extra},bytes);
  const download=(token,extra={})=>call('/api/returns/label','POST',{origin:'https://book.example','x-return-action':'download','x-return-token':token,...extra});
  const row=(id='one')=>DB.sqlite.prepare('SELECT * FROM orders WHERE id=?').get(id);
  return {DB,FILES,env,app,call,seed,admin,access,issue,read,requestCase,upload,download,row,objects,deleted};
}

test('access requests are uniform, persisted only on settled matching orders, and do not open a return',async t=>{
  const {seed,access,row,call}=setup(t);seed();seed('unpaid','pending');
  const matching=await access({orderId:' one ',email:' BUYER@EXAMPLE.TEST '});assert.equal(matching.status,202);const reply=await matching.text();
  for(const body of [{orderId:'missing',email:'buyer@example.test'},{orderId:'one',email:'other@example.test'},{orderId:'unpaid',email:'buyer@example.test'}]){const response=await access(body);assert.equal(response.status,202);assert.equal(await response.text(),reply);}
  assert.ok(row().portal_requested_at>0);assert.equal(row().return_status,'none');assert.equal(row().management_version,0);assert.equal(row().payment_status,'paid');assert.equal(row('unpaid').portal_requested_at,null);
  const stamp=row().portal_requested_at;await access();assert.equal(row().portal_requested_at,stamp);
  const list=await(await call('/api/admin/orders?filter=access_requests','GET',owner)).json();assert.equal(list.count,1);assert.equal(list.stats.accessRequests,1);assert.equal(list.orders[0].portal_requested_at,stamp);
});

test('access throttles hashed IP and order buckets without existence signals or raw IP persistence',async t=>{
  const {seed,access,row,DB}=setup(t);seed();
  for(let i=0;i<5;i++)assert.equal((await access({orderId:'missing_'+i,email:'other@example.test'})).status,202);
  const before=DB.sqlite.prepare('SELECT count(*) AS n FROM return_rate_limits').get().n;
  assert.equal((await access()).status,202);assert.equal(row().portal_requested_at,null);
  for(let i=0;i<15;i++)await access({orderId:'abuse_'+i,email:'bad@example.test'});
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM return_rate_limits').get().n,before);
  const limits=DB.sqlite.prepare('SELECT * FROM return_rate_limits').all();assert.ok(limits.every(r=>/^[a-f0-9]{64}$/.test(r.key)));assert.ok(!JSON.stringify(limits).includes('192.0.2.1'));
  DB.sqlite.exec('DELETE FROM return_rate_limits');
  for(let i=0;i<5;i++)await access({orderId:'one',email:'bad@example.test'},'198.51.100.'+i);
  await access(undefined,'203.0.113.1');assert.equal(row().portal_requested_at,null);
  DB.sqlite.exec('DELETE FROM return_rate_limits');for(let i=0;i<5;i++)await access({orderId:'unknown_'+i,email:'bad@example.test'},null);
  await access(undefined,null);assert.equal(row().portal_requested_at,null);
  DB.sqlite.exec('UPDATE return_rate_limits SET window_start=1');await access(undefined,null);assert.ok(row().portal_requested_at>0);
});

test('portal link rotates 256-bit secrets stored only as hashes and expiry/revoke invalidate prior tokens',async t=>{
  const {seed,access,issue,admin,read,row,DB}=setup(t);seed();await access();
  const first=await issue();assert.match(first.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(first.order.management_version,1);assert.equal(row().portal_requested_at,null);assert.ok(first.expiresAt>Date.now()+29*86400000);
  const stored=DB.sqlite.prepare('SELECT * FROM return_access').get();assert.match(stored.token_hash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(stored).includes(first.token));assert.equal((await read(first.token)).status,200);
  assert.equal((await admin('portal-link',{expectedVersion:0})).status,409);assert.equal((await read(first.token)).status,200);
  const second=await issue(1);assert.notEqual(second.token,first.token);assert.equal((await read(first.token)).status,401);assert.equal((await read(second.token)).status,200);
  DB.sqlite.exec('UPDATE return_access SET expires_at=1');assert.equal((await read(second.token)).status,401);
  const third=await issue(2);assert.equal((await admin('portal-revoke',{expectedVersion:3})).status,200);assert.equal((await read(third.token)).status,401);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM return_access').get().n,0);
});

test('customer case uses an explicit projection and requires header token rather than URL or identity',async t=>{
  const {seed,issue,read,call}=setup(t);seed();const {token}=await issue();
  const response=await read(token);assert.equal(response.status,200);const data=await response.json();
  assert.deepEqual(Object.keys(data.case).sort(),['orderId','status','kind','reason','reply','carrier','code','label','version','paymentStatus','submittedAt'].sort());
  assert.equal(data.case.orderId,'one');assert.equal(data.case.status,'none');assert.equal(data.case.paymentStatus,'paid');assert.equal(data.case.label,null);
  const raw=JSON.stringify(data);for(const secret of ['buyer@example.test','Dirección secreta','Nota secreta','token_hash','return_label_key'])assert.ok(!raw.includes(secret));
  assert.equal((await read(null,'?token='+token)).status,401);assert.equal((await call('/api/returns/case','GET',owner)).status,401);assert.equal((await read('A'.repeat(43))).status,401);
  for(const key of ['cache-control','x-robots-tag','x-content-type-options','referrer-policy'])assert.ok(response.headers.has(key));assert.match(response.headers.get('cache-control'),/no-store/);
});

test('customer requests reopen only eligible states, preserve payment, and block obsolete versions',async t=>{
  const {seed,issue,requestCase,row,DB}=setup(t);seed();const {token}=await issue();
  assert.equal((await requestCase(token,{kind:'withdrawal',reason:'',expectedVersion:1})).status,200);
  const submitted=row().return_submitted_at;assert.ok(submitted>Date.now()-10000);
  assert.equal(row().return_reason,'Desistimiento sin motivo indicado.');assert.equal(row().return_kind,'withdrawal');assert.equal(row().return_status,'requested');assert.equal(row().payment_status,'paid');assert.equal(row().total,2200);assert.equal(row().management_version,2);
  assert.equal((await requestCase(token,{kind:'damaged',reason:'Roto',expectedVersion:1})).status,409);
  assert.equal((await requestCase(token,{kind:'damaged',reason:'Roto',expectedVersion:2})).status,409);
  DB.sqlite.exec("UPDATE orders SET return_status='rejected',customer_reply='Respuesta antigua',return_code='ANTIGUO',return_carrier='Antiguo',return_label_key='old' WHERE id='one'");
  assert.equal((await requestCase(token,{kind:'damaged',reason:'Tapa dañada\nAdjunto por correo',expectedVersion:2})).status,200);
  assert.ok(row().return_submitted_at>=submitted);
  assert.equal(row().customer_reply,'');assert.equal(row().return_code,'');assert.equal(row().return_carrier,'');assert.equal(row().return_label_key,null);
});

test('public writes enforce CSRF, bounded validation and generic database failures',async t=>{
  const {seed,issue,requestCase,access,env,row,download}=setup(t);seed();const {token}=await issue();
  assert.equal((await access(undefined,undefined,{origin:'https://evil.example'})).status,403);
  assert.equal((await access({orderId:'../one',email:'buyer@example.test'})).status,400);
  assert.equal((await access({orderId:'one',email:'bad'})).status,400);
  assert.equal((await access({orderId:'one',email:'x'.repeat(4096)})).status,413);
  const valid={kind:'damaged',reason:'Tapa dañada',expectedVersion:1};
  for(const headers of [{origin:'https://evil.example'},{'x-return-action':'access'},{'content-type':'text/plain'}])assert.equal((await requestCase(token,valid,headers)).status,403);
  for(const body of [{...valid,reason:''},{...valid,reason:'x'.repeat(1001)},{...valid,reason:'bad\u0000'},{...valid,kind:'free-refund'},{...valid,expectedVersion:'1'}])assert.equal((await requestCase(token,body)).status,400);
  assert.equal((await download(token,{origin:'https://evil.example'})).status,403);assert.equal(row().return_status,'none');
  env.DB.prepare=()=>{throw new Error('outage');};const unavailable=await access();assert.equal(unavailable.status,202);assert.ok(!(await unavailable.text()).includes('outage'));
});

test('all admin portal and label operations retain owner protection and CAS versions',async t=>{
  const {seed,admin,upload,row}=setup(t);seed();
  for(const action of ['portal-link','portal-revoke','portal-reply','return-label-remove']){
    const body={expectedVersion:0,reply:'Respuesta',code:'',carrier:''};
    assert.equal((await admin(action,body,'one',{'oai-authenticated-user-id':''})).status,401);
    assert.equal((await admin(action,body,'one',{'oai-authenticated-user-id':'visitor','oai-authenticated-user-email':'visitor@example.test'})).status,403);
    assert.equal((await admin(action,body,'one',{origin:'https://evil.example'})).status,403);
    assert.equal((await admin(action,body,'one',{'x-admin-action':'wrong'})).status,403);
    assert.equal((await admin(action,{...body,expectedVersion:'0'})).status,400);
  }
  assert.equal((await upload(0,pdf,'application/pdf','one',{'oai-authenticated-user-id':''})).status,401);
  assert.equal((await upload(0,pdf,'application/pdf','one',{origin:'https://evil.example'})).status,403);
  assert.equal(row().management_version,0);
});

test('owner reply is customer-visible without exposing private notes or changing payment',async t=>{
  const {seed,issue,admin,read,row,DB}=setup(t);seed();const {token}=await issue();
  DB.sqlite.exec('UPDATE orders SET return_submitted_at=12345');
  assert.equal((await admin('portal-reply',{reply:'Consulta recibida.\nLa revisaremos.',code:'',carrier:'',expectedVersion:1})).status,200);
  assert.equal((await admin('portal-reply',{reply:'Viejo',code:'',carrier:'',expectedVersion:1})).status,409);
  assert.equal((await admin('portal-reply',{reply:'x'.repeat(2001),code:'',carrier:'',expectedVersion:2})).status,400);
  assert.equal((await admin('portal-reply',{reply:'x',code:'RET-1',carrier:'Correos',expectedVersion:2})).status,409);
  DB.sqlite.exec("UPDATE orders SET return_status='approved' WHERE id='one'");
  assert.equal((await admin('portal-reply',{reply:'Devuelve el libro con esta referencia.',code:' RET-1 ',carrier:' Correos ',expectedVersion:2})).status,200);
  const data=await(await read(token)).json();assert.equal(data.case.reply,'Devuelve el libro con esta referencia.');assert.equal(data.case.code,'RET-1');assert.equal(data.case.carrier,'Correos');assert.equal(data.case.version,3);assert.equal(data.case.submittedAt,12345);assert.equal(row().return_submitted_at,12345);assert.equal(row().payment_status,'paid');assert.equal(row().private_note,'Nota secreta');
});

test('private label verifies magic and size before storage, then streams an authenticated attachment',async t=>{
  const {seed,issue,upload,download,call,DB,row,objects}=setup(t);seed();const {token}=await issue();
  assert.equal((await upload(1)).status,409);DB.sqlite.exec("UPDATE orders SET return_status='approved' WHERE id='one'");
  assert.equal((await upload(1,Buffer.from('<script>bad</script>'))).status,400);
  assert.equal((await upload(1,pdf,'image/png')).status,400);
  assert.equal((await upload(1,pdf,'image/svg+xml')).status,400);
  assert.equal((await upload(1,Buffer.alloc(2*1024*1024+1))).status,413);assert.equal(objects.size,0);
  const saved=await upload(1);assert.equal(saved.status,200);assert.equal((await saved.json()).order.management_version,2);assert.equal(row().return_label_type,'application/pdf');assert.equal(row().return_label_size,pdf.length);assert.match(row().return_label_key,/^return-labels\/[A-Za-z0-9_-]{43}$/);
  assert.equal((await call('/api/returns/label','GET',{'x-return-token':token})).status,404);assert.equal((await download('B'.repeat(43))).status,401);
  const response=await download(token);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
});

test('replacement and removal clean old labels, while a losing upload deletes only its own new object',async t=>{
  const {seed,issue,upload,admin,DB,row,objects,deleted,FILES}=setup(t);seed();await issue();DB.sqlite.exec("UPDATE orders SET return_status='approved' WHERE id='one'");
  assert.equal((await upload(1)).status,200);const originalKey=row().return_label_key;
  assert.equal((await upload(2,Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),'image/png')).status,200);assert.ok(deleted.includes(originalKey));assert.equal(objects.size,1);const currentKey=row().return_label_key;
  const put=FILES.put;FILES.put=async(...args)=>{await put(...args);DB.sqlite.exec('UPDATE orders SET management_version=management_version+1');};
  assert.equal((await upload(3)).status,409);assert.equal(row().return_label_key,currentKey);assert.ok(objects.has(currentKey));assert.equal(objects.size,1);
  assert.equal((await admin('return-label-remove',{expectedVersion:3})).status,409);
  assert.equal((await admin('return-label-remove',{expectedVersion:4})).status,200);assert.equal(row().return_label_key,null);assert.equal(objects.size,0);
});

test('cleanup failure does not misreport a committed label or reopened request; storage failure commits nothing',async t=>{
  const {seed,issue,upload,requestCase,FILES,DB,row,objects}=setup(t);seed();const {token}=await issue();DB.sqlite.exec("UPDATE orders SET return_status='approved' WHERE id='one'");
  assert.equal((await upload(1)).status,200);FILES.delete=async()=>{throw new Error('cleanup outage');};
  assert.equal((await upload(2)).status,200);assert.equal(row().management_version,3);
  DB.sqlite.exec("UPDATE orders SET return_status='closed' WHERE id='one'");
  assert.equal((await requestCase(token,{kind:'other',reason:'Consulta nueva',expectedVersion:3})).status,200);assert.equal(row().return_label_key,null);assert.equal(row().return_status,'requested');
  DB.sqlite.exec("UPDATE orders SET return_status='approved' WHERE id='one'");FILES.put=async()=>{throw new Error('put outage');};
  const before=row().management_version;assert.equal((await upload(before)).status,503);assert.equal(row().management_version,before);assert.equal(row().return_label_key,null);assert.ok(objects.size>0);
});

test('return portal HTML is served privately with strict policy for anonymous GET and HEAD',async t=>{
  const {call}=setup(t);
  for(const path of ['/devoluciones','/devoluciones/','/devoluciones.html'])for(const method of ['GET','HEAD']){
    const response=await call(path,method);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(await response.text(),method==='HEAD'?'':'RETURNS PAGE');
  }
});

test('owner reopening clears previous customer instructions and label only after a winning update',async t=>{
  const {seed,issue,admin,upload,DB,row,objects,deleted,FILES,read}=setup(t);seed();const {token}=await issue();
  const change=(status,expectedVersion)=>admin('return',{status,reason:'Revisar el libro',resolution:status==='closed'?'Caso resuelto':'',expectedVersion});
  assert.equal((await change('requested',1)).status,200);
  assert.equal((await change('approved',2)).status,200);
  assert.equal((await admin('portal-reply',{reply:'Respuesta antigua',code:'OLD',carrier:'Correos',expectedVersion:3})).status,200);
  assert.equal((await upload(4)).status,200);const label=row().return_label_key;
  DB.sqlite.exec("UPDATE orders SET return_kind='damaged',return_submitted_at=12345");
  assert.equal((await change('closed',5)).status,200);
  assert.equal((await change('requested',5)).status,409);assert.equal(row().return_label_key,label);assert.ok(objects.has(label));assert.ok(!deleted.includes(label));
  assert.equal((await change('requested',6)).status,200);
  assert.equal(row().customer_reply,'');assert.equal(row().return_code,'');assert.equal(row().return_carrier,'');assert.equal(row().return_kind,'');assert.equal(row().return_label_key,null);assert.equal(row().return_label_type,null);assert.equal(row().return_label_size,null);assert.ok(row().return_submitted_at>12345);assert.ok(deleted.includes(label));assert.equal(row().payment_status,'paid');
  assert.equal((await admin('portal-reply',{reply:'Nueva respuesta',code:'',carrier:'',expectedVersion:7})).status,200);
  const submitted=row().return_submitted_at;
  assert.equal((await change('requested',8)).status,200);assert.equal(row().customer_reply,'Nueva respuesta');assert.equal(row().return_submitted_at,submitted);
  assert.equal((await change('approved',9)).status,200);assert.equal((await(await read(token)).json()).case.label,null);
  assert.equal((await upload(10)).status,200);
  assert.equal((await change('closed',11)).status,200);FILES.delete=async()=>{throw new Error('cleanup outage');};
  assert.equal((await change('requested',12)).status,200);assert.equal(row().return_label_key,null);assert.equal(row().management_version,13);
});
