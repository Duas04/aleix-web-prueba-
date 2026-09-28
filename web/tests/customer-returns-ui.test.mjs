import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const source=existsSync('dist/returns.js')?readFileSync('dist/returns.js','utf8'):'';
function harness({demo=false,token='',failSave=false,caseOverrides={},deferFirst=false}={}){
 assert.ok(source,'returns script exists');const elements=new Map(),calls=[],downloads=[],timeline=[];let resolveFirst;
 const element=id=>{if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',hidden:false,disabled:false,events:{},children:[],addEventListener(name,fn){this.events[name]=fn;},setAttribute(){},removeAttribute(){},replaceChildren(...nodes){this.children=nodes;},focus(){},append(...nodes){this.children.push(...nodes);},remove(){},click(){downloads.push({name:this.download,href:this.href});},checkValidity(){return true;}});return elements.get(id);};
 element('return-kind').value='withdrawal';const document={getElementById:element,body:element('body'),createElement:()=>element('download'+Math.random())};
 let value={orderId:'PEDIDO-1',status:'none',kind:'',reason:'',reply:'',carrier:'',code:'',label:null,version:4,paymentStatus:'paid',...caseOverrides};
 const listeners={},location={hash:token?'#token='+token:'',search:demo?'?demo=1':'',pathname:'/devoluciones'};
 const context=vm.createContext({document,URLSearchParams,URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},Blob,Intl,Date,console,setTimeout,window:{addEventListener(name,fn){listeners[name]=fn;}},location,history:{replaceState(_s,_t,path){timeline.push('clear');this.path=path;location.hash='';}},fetch:async(path,options={})=>{
  timeline.push('fetch');calls.push({path,options});if(path.endsWith('/access'))return new Response('{}',{status:202});
  if(deferFirst&&calls.length===1)return new Promise(resolve=>{resolveFirst=resolve;});
  if(options.method==='POST'&&path.endsWith('/case')){if(failSave)return new Response(JSON.stringify({error:'No se pudo guardar'}),{status:503});const body=JSON.parse(options.body);value={...value,status:'requested',kind:body.kind,reason:body.reason,version:5};}
  return new Response(JSON.stringify({case:value}));
 }});vm.runInContext(source.replace(/start\(\);\s*$/,'globalThis.started=start();'),context);
 return {element,calls,downloads,timeline,ready:context.started,completeFirst(){resolveFirst(new Response(JSON.stringify({case:{...value,orderId:'PEDIDO-ANTERIOR'}})));},async openHash(value){location.hash='#token='+value;await listeners.hashchange?.();},get hash(){return location.hash;}};
}
const submit=(ui,id)=>ui.element(id).events.submit({preventDefault(){}});
test('private token is removed before fetch and travels only in header',async()=>{
 const token='a'.repeat(43),ui=harness({token});await ui.ready;assert.deepEqual(ui.timeline.slice(0,2),['clear','fetch']);assert.equal(ui.calls[0].path,'/api/returns/case');assert.equal(ui.calls[0].options.headers['X-Return-Token'],token);assert.equal(ui.element('case-order').textContent,'PEDIDO-1');
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
test('access result stays generic and never claims mail was sent',async()=>{
 const ui=harness();await ui.ready;ui.element('access-order').value='PEDIDO-1';ui.element('access-email').value='buyer@example.invalid';await submit(ui,'access-form');
 assert.equal(ui.calls[0].options.headers['X-Return-Action'],'access');assert.match(ui.element('access-message').textContent,/Si coincide/);assert.match(ui.element('access-message').textContent,/no es automático/i);assert.doesNotMatch(ui.element('access-message').textContent,/correo enviado|te hemos enviado/i);
});
test('request confirms only a successful save and creates a token-free receipt',async()=>{
 const ui=harness({token:'b'.repeat(43)});await ui.ready;ui.element('return-kind').value='damaged';ui.element('return-reason').value='Cubierta dañada';await submit(ui,'request-form');
 const save=ui.calls.find(call=>call.options.method==='POST');assert.deepEqual(JSON.parse(save.options.body),{kind:'damaged',reason:'Cubierta dañada',expectedVersion:4});assert.equal(ui.element('receipt').hidden,false);assert.match(ui.element('receipt-text').textContent,/Cubierta dañada/);assert.doesNotMatch(ui.element('receipt-text').textContent,/bbbbbbbb/);
});
test('failed saves preserve text and do not display receipt',async()=>{
 const ui=harness({token:'c'.repeat(43),failSave:true});await ui.ready;ui.element('return-kind').value='other';ui.element('return-reason').value='Mi motivo';await submit(ui,'request-form');assert.equal(ui.element('return-reason').value,'Mi motivo');assert.equal(ui.element('receipt').hidden,true);assert.match(ui.element('request-message').textContent,/No se pudo guardar/);
});
test('demo request and approved example make no network calls',async()=>{
 const ui=harness({demo:true});await ui.ready;await submit(ui,'request-form');await ui.element('demo-approved').events.click();await ui.element('label-download').events.click();assert.equal(ui.calls.length,0);assert.equal(ui.element('demo-note').hidden,false);assert.match(ui.downloads.at(-1).name,/ejemplo/);
});
test('reopening a saved request offers receipt with its original server date',async()=>{
 const ui=harness({token:'d'.repeat(43),caseOverrides:{status:'requested',kind:'damaged',reason:'Cubierta dañada',submittedAt:86400000}});await ui.ready;assert.equal(ui.element('receipt').hidden,false);assert.match(ui.element('receipt-text').textContent,/1970/);assert.match(ui.element('receipt-text').textContent,/Cubierta dañada/);
});
test('hash-only navigation on an already open page loads new private access safely',async()=>{
 const ui=harness();await ui.ready;assert.equal(ui.calls.length,0);await ui.openHash('e'.repeat(43));assert.equal(ui.hash,'');assert.deepEqual(ui.timeline.slice(-2),['clear','fetch']);assert.equal(ui.calls.at(-1).options.headers['X-Return-Token'],'e'.repeat(43));assert.equal(ui.element('case-panel').hidden,false);assert.equal(ui.element('access-panel').hidden,true);
});
test('a late response from an older fragment cannot replace the new case',async()=>{
 const ui=harness({token:'f'.repeat(43),deferFirst:true});await ui.openHash('g'.repeat(43));assert.equal(ui.element('case-order').textContent,'PEDIDO-1');ui.completeFirst();await ui.ready;assert.equal(ui.element('case-order').textContent,'PEDIDO-1');assert.equal(ui.calls.at(-1).options.headers['X-Return-Token'],'g'.repeat(43));
});
