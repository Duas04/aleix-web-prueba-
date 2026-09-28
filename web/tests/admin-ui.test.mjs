import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('admin/app.js','utf8').replace(/\nload\(\);\s*$/,'\n');
const order=id=>({id,created_at:1,customer_name:'Prueba',email:'fixture@example.invalid',recipient:'Prueba',address1:'Calle ficticia',postal_code:'00000',city:'Ciudad',country:'ES',edition:'paperback',quantity:1,subtotal:1500,shipping:700,total:2200,payment_status:'paid',fulfillment_status:'pending'});
function harness(overrides={},responseUpdates={}){
 const elements=new Map();let resolveShip,resolveCopy,deferredCopy=false,failDetail=false;const requests=[],savedOrders=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',hidden:false,open:false,disabled:false,checked:false,value:'',children:[],events:{},isConnected:true,addEventListener(name,fn){this.events[name]=fn;},setAttribute(){},removeAttribute(){},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},focus(){document.activeElement=this;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();}});return elements.get(id);};
 const document={getElementById:element,activeElement:element('opener'),createElement:()=>({...element('node'),dataset:{}})};
 const context=vm.createContext({document,Intl,URLSearchParams,console,window:{print(){}},navigator:{clipboard:{writeText:()=>deferredCopy?new Promise(resolve=>{resolveCopy=resolve;}):Promise.resolve()}},fetch:async(path,options={})=>{
  requests.push({path,options});
  if(options.method==='POST'){
   if(path.endsWith('/ship'))return new Promise(resolve=>{resolveShip=resolve;});
   const id=path.split('/').at(-2),action=path.split('/').at(-1),body=JSON.parse(options.body),updated={...order(id),...overrides,...savedOrders.get(id),management_version:(body.expectedVersion||0)+1};
   if(action==='notes')updated.private_note=body.note;
   if(action==='tracking')Object.assign(updated,{carrier:body.carrier,tracking:body.tracking});
   if(action==='deliver')updated.delivered_at=123;
   if(action==='return')Object.assign(updated,{return_status:body.status,return_reason:body.reason,return_resolution:body.resolution});
   Object.assign(updated,responseUpdates);savedOrders.set(id,updated);return new Response(JSON.stringify({order:updated}));
  }
  if(path.includes('?'))return new Response(JSON.stringify({orders:[],count:0,page:1,stats:{total:4,pending:2,shipped:1,returns:1,incidents:2,delivered:0}}));
  const id=path.split('/').pop();return new Response(JSON.stringify(failDetail?{error:'Error temporal'}:{order:{...order(id),...overrides,...savedOrders.get(id)}}),{status:failDetail?503:200});
 }});
 vm.runInContext(source,context);
 return {element,requests,load:()=>vm.runInContext('load()',context),open:id=>vm.runInContext(`openDetail(${JSON.stringify(id)})`,context),label:value=>vm.runInContext(`shippingLabel(${JSON.stringify(value)})`,context),get focus(){return document.activeElement;},deferCopy(){deferredCopy=true;},completeCopy(){resolveCopy();},failDetails(value){failDetail=value;},failShipping(){resolveShip(new Response(JSON.stringify({error:'No se pudo guardar A'}),{status:503}));}};
}
test('a delayed shipping error never changes another open order',async()=>{
 const ui=harness();await ui.open('A');ui.element('ship-confirm').checked=true;
 const pending=ui.element('ship-form').events.submit({preventDefault(){}});
 ui.element('detail').close();await ui.open('B');
 ui.element('detail-message').textContent='Mensaje del pedido B';
 ui.element('ship-button').disabled=true;
 ui.failShipping();await pending;
 assert.equal(ui.element('detail-message').textContent,'Mensaje del pedido B');assert.equal(ui.element('ship-button').disabled,true);
});
test('failed order details offer a working retry without closing the dialog',async()=>{
 const ui=harness();ui.failDetails(true);await ui.open('A');
 assert.equal(ui.element('retry-detail').hidden,false);
 assert.ok(ui.element('retry-detail').events.click,'retry is connected');
 ui.failDetails(false);await ui.element('retry-detail').events.click();
 assert.equal(ui.element('detail-body').hidden,false);assert.equal(ui.element('retry-detail').hidden,true);assert.equal(ui.element('detail-title').textContent,'Pedido A');
});
test('unpaid and incident orders never suggest they are ready to ship',()=>{
 const ui=harness();
 for(const [payment,label]of Object.entries({paid:'Por enviar',pending:'Pago pendiente',failed:'No enviar',refunded:'No enviar',partially_refunded:'Revisar pago'})){
  assert.equal(ui.label({payment_status:payment,fulfillment_status:'pending'}),label);
  assert.equal(ui.label({payment_status:payment,fulfillment_status:'shipped'}),'Enviado');
 }
 assert.equal(ui.label({payment_status:'paid',fulfillment_status:'pending',return_status:'requested'}),'En pausa por devolución');
});
test('a delayed clipboard confirmation never changes another order',async()=>{
 const ui=harness();await ui.open('A');ui.deferCopy();
 const pending=ui.element('copy-address').events.click();
 ui.element('detail').close();await ui.open('B');ui.element('detail-message').textContent='Información de B';
 ui.completeCopy();await pending;assert.equal(ui.element('detail-message').textContent,'Información de B');
});
test('retry keeps keyboard focus on the recovered title or the retry button',async()=>{
 const ui=harness();ui.failDetails(true);await ui.open('A');ui.element('retry-detail').focus();
 await ui.element('retry-detail').events.click();assert.equal(ui.focus.id,'retry-detail');
 ui.failDetails(false);await ui.element('retry-detail').events.click();assert.equal(ui.focus.id,'detail-title');
});
const submit=(ui,id)=>ui.element(id).events.submit({preventDefault(){}});
test('mixed editions render quantity, unit price and line subtotal',async()=>{
 const ui=harness({items:[{edition:'paperback',quantity:2,unit_price:1500,subtotal:3000},{edition:'hardcover',quantity:1,unit_price:2000,subtotal:2000}]});await ui.open('M');
 const text=ui.element('items').children.map(node=>node.textContent).join(' ');assert.match(text,/2 × Tapa blanda/);assert.match(text,/15,00/);assert.match(text,/30,00/);assert.match(text,/1 × Tapa dura/);
});
test('task shortcuts show counts and filter the list',async()=>{
 const ui=harness();await ui.load();assert.equal(ui.element('task-returns-count').textContent,'1');await ui.element('task-returns').events.click();assert.equal(ui.element('filter').value,'returns');assert.match(ui.requests.at(-1).path,/filter=returns/);
});
test('notes save the management version and keep payment unchanged',async()=>{
 const ui=harness({management_version:7});await ui.open('N');ui.element('private-note').value='Texto privado';await submit(ui,'note-form');
 const request=ui.requests.find(r=>r.path.endsWith('/notes'));assert.deepEqual(JSON.parse(request.options.body),{note:'Texto privado',expectedVersion:7});assert.equal(request.options.headers['X-Admin-Action'],'notes');assert.equal(ui.element('detail-payment').textContent,'Pagado');assert.equal(ui.element('private-note').value,'Texto privado');
});
test('delivery needs explicit confirmation and hides after delivery',async()=>{
 const ui=harness({fulfillment_status:'shipped',management_version:3});await ui.open('D');await submit(ui,'deliver-form');assert.equal(ui.requests.filter(r=>r.options.method==='POST').length,0);
 ui.element('deliver-confirm').checked=true;await submit(ui,'deliver-form');assert.equal(ui.element('deliver-form').hidden,true);assert.equal(ui.element('tracking-form').hidden,true);assert.equal(ui.element('detail-shipping').textContent,'Entregado');
});
test('return workflow blocks dispatch and never modifies payment',async()=>{
 const ui=harness({return_status:'requested',return_reason:'Libro dañado'});await ui.open('R');assert.equal(ui.element('ship-form').hidden,true);
 ui.element('return-status').value='rejected';ui.element('return-resolution').value='';await submit(ui,'return-form');assert.equal(ui.requests.filter(r=>r.options.method==='POST').length,0);
 ui.element('return-resolution').value='Revisado con el comprador';await submit(ui,'return-form');assert.equal(ui.element('detail-payment').textContent,'Pagado');assert.equal(JSON.parse(ui.requests.find(r=>r.path.endsWith('/return')).options.body).status,'rejected');
});
test('global save lock and request token protect the same order reopened',async()=>{
 const ui=harness();await ui.open('A');ui.element('ship-confirm').checked=true;const pending=submit(ui,'ship-form');ui.element('detail').close();await ui.open('A');
 assert.equal(ui.element('note-fields').disabled,true);
 ui.element('private-note').value='Borrador nuevo';await submit(ui,'note-form');assert.equal(ui.requests.filter(r=>r.path.endsWith('/notes')).length,0);
 ui.element('detail-message').textContent='Nuevo detalle';ui.failShipping();await pending;assert.equal(ui.element('detail-message').textContent,'Nuevo detalle');assert.equal(ui.element('private-note').value,'Borrador nuevo');
});
test('saving tracking preserves unsaved note and return drafts',async()=>{
 const ui=harness({fulfillment_status:'shipped',return_status:'requested',return_reason:'Motivo inicial'});await ui.open('P');
 ui.element('private-note').value='Nota todavía sin guardar';ui.element('return-reason').value='Borrador de motivo';ui.element('return-resolution').value='Borrador de resolución';ui.element('return-status').value='reviewing';
 ui.element('tracking-carrier').value='Transportista';ui.element('tracking-code').value='ABC';await submit(ui,'tracking-form');
 assert.equal(ui.element('private-note').value,'Nota todavía sin guardar');assert.equal(ui.element('return-reason').value,'Borrador de motivo');assert.equal(ui.element('return-resolution').value,'Borrador de resolución');assert.equal(ui.element('return-status').value,'reviewing');
});
test('saving one section shows server changes to other fields that were not edited',async()=>{
 const ui=harness({fulfillment_status:'shipped',private_note:'Nota previa'},{private_note:'Nota actualizada en servidor'});await ui.open('P');
 ui.element('tracking-code').value='ABC';await submit(ui,'tracking-form');assert.equal(ui.element('private-note').value,'Nota actualizada en servidor');
});
