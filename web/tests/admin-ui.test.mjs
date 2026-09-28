import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('admin/app.js','utf8').replace(/\nload\(\);\s*$/,'\n');
const order=id=>({id,created_at:1,customer_name:'Prueba',email:'fixture@example.invalid',recipient:'Prueba',address1:'Calle ficticia',postal_code:'00000',city:'Ciudad',country:'ES',edition:'paperback',quantity:1,subtotal:1500,shipping:700,total:2200,payment_status:'paid',fulfillment_status:'pending'});
function harness(){
 const elements=new Map();let resolveShip,failDetail=false;
 const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',hidden:false,open:false,disabled:false,checked:false,value:'',children:[],events:{},isConnected:true,addEventListener(name,fn){this.events[name]=fn;},setAttribute(){},removeAttribute(){},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},focus(){},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();}});return elements.get(id);};
 const document={getElementById:element,activeElement:element('opener'),createElement:()=>({...element('node'),dataset:{}})};
 const context=vm.createContext({document,Intl,URLSearchParams,console,window:{print(){}},navigator:{clipboard:{writeText:async()=>{}}},fetch:async path=>{
  if(path.endsWith('/ship'))return new Promise(resolve=>{resolveShip=resolve;});
  if(path.includes('?'))return new Response(JSON.stringify({orders:[],count:0,page:1,stats:{total:0,pending:0,shipped:0}}));
  return new Response(JSON.stringify(failDetail?{error:'Error temporal'}:{order:order(path.split('/').pop())}),{status:failDetail?503:200});
 }});
 vm.runInContext(source,context);
 return {element,open:id=>vm.runInContext(`openDetail(${JSON.stringify(id)})`,context),failDetails(value){failDetail=value;},failShipping(){resolveShip(new Response(JSON.stringify({error:'No se pudo guardar A'}),{status:503}));}};
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
