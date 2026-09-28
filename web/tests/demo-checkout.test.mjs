import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const source=readFileSync(join(process.env.DEMO_UI_SOURCE_DIR||process.cwd(),'dist/demo-checkout.js'),'utf8');
const fields=['fullName','email','address','addressExtra','postalCode','city','region','country'];
function harness({enabled=true,connected=true,deferred=false,failFirst=false}={}){
 const elements=new Map(),events=new Map(),requests=[],subscribers=[],selected=[];let resolveRequest,requestSequence=0;
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',hidden:true,disabled:false,readOnly:false,open:false,events:{},addEventListener(name,fn){this.events[name]=fn;},focus(){document.activeElement=this;}});return elements.get(id);},createElement:()=>({click(){}})};
 for(const name of fields)document.getElementById('customer-'+name).value='PERSONAL DATA MUST NOT LEAVE THIS PAGE';
 document.getElementById('order-dialog').open=true;
 const session={enabled,ready:()=>connected,subscribe(fn){subscribers.push(fn);},selectOrder(id){selected.push(id);},link(path,{orderId}={}){const url=new URL(path,'https://book.example');url.hash='session='+'a'.repeat(43)+'&order='+orderId;return url.href;},async request(path,options){requests.push({path,options});if(deferred)return new Promise(resolve=>{resolveRequest=resolve;});return new Response(JSON.stringify(failFirst&&requests.length===1?{error:'Fallo de prueba'}:{order:{id:'DEMO-abc123def456',total:4200}}),{status:failFirst&&requests.length===1?503:200});}};
 const context=vm.createContext({document,window:{DemoSession:session,addEventListener(name,fn){events.set(name,fn);}},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++requestSequence).padStart(12,'0')}`},Intl,Blob,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},setTimeout(){},navigator:{clipboard:{writeText:async()=>{}}}});
 vm.runInContext(source,context);
 return{element:id=>document.getElementById(id),requests,selected,review:items=>events.get('fumada-cart-reviewed')?.({detail:{items}}),restore:()=>events.get('fumada-cart-details')?.(),click:()=>document.getElementById('demo-purchase').events.click?.(),changeSession(){for(const fn of subscribers)fn();},resolve(){resolveRequest(new Response(JSON.stringify({order:{id:'DEMO-old123456789',total:2200}})));},get focus(){return document.activeElement;}};
}

test('demo purchase sends only catalog quantities and an idempotency request ID, never customer fields',async()=>{
 const ui=harness();ui.review({paperback:1,hardcover:1,email:'real@example.test',address:'A real address',other:4});
 for(const name of fields)ui.element('customer-'+name).value='PRIVATE '+name;
 await ui.click();const request=ui.requests[0],body=JSON.parse(request.options.body);
 assert.equal(request.path,'/api/demo/orders');assert.equal(request.options.headers['X-Demo-Action'],'purchase');assert.deepEqual(Object.keys(body).sort(),['items','requestId']);assert.deepEqual(body.items,{paperback:1,hardcover:1});assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.doesNotMatch(request.options.body,/PRIVATE|real@example|address|email/i);
});

test('purchase confirmation exposes the returned ID, simulated total and linked returns/admin pages',async()=>{
 const ui=harness();ui.review({paperback:1,hardcover:1});await ui.click();assert.equal(ui.element('demo-order-number').textContent,'DEMO-abc123def456');assert.match(ui.element('demo-order-total').textContent,/42,00/);assert.equal(ui.element('demo-order-confirmation').hidden,false);assert.deepEqual(ui.selected,['DEMO-abc123def456']);assert.equal(ui.focus.id,'demo-order-title');
 for(const [id,path]of [['demo-order-returns','/devoluciones'],['demo-order-admin','/demo']]){const url=new URL(ui.element(id).href);assert.equal(url.pathname,path);assert.match(url.hash,/session=a{43}&order=DEMO-abc123def456/);}assert.equal(new URL(ui.element('demo-order-returns').href).searchParams.get('demo'),'1');
});

test('reopening cart details restores only the fixed fictional recipient',()=>{
 const ui=harness();const initial=Object.fromEntries(fields.map(name=>[name,ui.element('customer-'+name).value]));for(const name of fields){assert.equal(ui.element('customer-'+name).readOnly,true);ui.element('customer-'+name).value='';}
 ui.restore();for(const name of fields)assert.equal(ui.element('customer-'+name).value,initial[name]);assert.match(initial.email,/@example\.invalid$/);assert.match(initial.address,/ejemplo/);
});

test('late order response from an earlier session never confirms or selects the old order',async()=>{
 const ui=harness({deferred:true});ui.review({paperback:1});const pending=ui.click();ui.changeSession();ui.resolve();await pending;assert.equal(ui.element('demo-order-confirmation').hidden,true);assert.equal(ui.element('demo-order-number').textContent,'');assert.equal(ui.element('demo-order-returns').href,undefined);assert.deepEqual(ui.selected,[]);assert.doesNotMatch(ui.element('demo-purchase-status').textContent,/Pedido de prueba guardado/);
});

test('retry preserves idempotency and changing catalog selection creates a new request ID',async()=>{
 const ui=harness({failFirst:true});ui.review({paperback:1});await ui.click();assert.equal(ui.element('demo-order-confirmation').hidden,true);assert.match(ui.element('demo-purchase-status').textContent,/Fallo/);await ui.click();const first=JSON.parse(ui.requests[0].options.body).requestId;assert.equal(JSON.parse(ui.requests[1].options.body).requestId,first);ui.review({hardcover:2});await ui.click();assert.notEqual(JSON.parse(ui.requests[2].options.body).requestId,first);
});

test('real storefront is untouched and a disconnected or empty demo cannot create orders',async()=>{
 const real=harness({enabled:false});assert.equal(real.element('customer-email').value,'PERSONAL DATA MUST NOT LEAVE THIS PAGE');assert.equal(real.element('demo-purchase').events.click,undefined);assert.equal(real.requests.length,0);
 const disconnected=harness({connected:false});disconnected.review({paperback:1});await disconnected.click();assert.equal(disconnected.requests.length,0);assert.equal(disconnected.element('demo-purchase').disabled,true);
 const empty=harness();empty.review({paperback:11,hardcover:-1});await empty.click();assert.equal(empty.requests.length,0);
});
