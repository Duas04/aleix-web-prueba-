import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
const sourceRoot=process.env.DEMO_UI_SOURCE_DIR||process.cwd();
const sharedSource=readFileSync(join(sourceRoot,'admin/demo-shared.js'),'utf8');
const liveSource=readFileSync(join(sourceRoot,'admin/live-updates.js'),'utf8');

function shared({connected=true}={}){
 const calls=[];const context=vm.createContext({window:{DemoSession:{ready:()=>connected,async request(path,options){calls.push({path,options});return new Response(JSON.stringify({ok:true,order:{id:'DEMO-001'}}));}}}});vm.runInContext(sharedSource,context);return{calls,api:(path,options={})=>context.demoApi(path,options)};
}
test('demo adapter converts raw label file to JSON metadata and preserves its version',async()=>{
 const ui=shared(),file={type:'application/pdf',size:1234,name:'private-filename.pdf',bytes:'sensitive bytes'};await ui.api('/api/admin/orders/DEMO-001/return-label',{method:'POST',headers:{'X-Admin-Action':'return-label','X-Order-Version':'12'},body:file});const call=ui.calls[0];assert.equal(call.path,'/api/demo/admin/orders/DEMO-001/return-label');assert.equal(call.options.headers['X-Demo-Action'],'return-label');assert.equal(call.options.headers['Content-Type'],'application/json');assert.deepEqual(JSON.parse(call.options.body),{type:'application/pdf',size:1234,expectedVersion:12});assert.doesNotMatch(call.options.body,/sensitive|private-filename/);
});
test('already converted demo label JSON is not converted again',async()=>{
 const ui=shared(),body=JSON.stringify({type:'image/png',size:2048,expectedVersion:3});await ui.api('/api/admin/orders/DEMO-001/return-label',{method:'POST',headers:{'X-Admin-Action':'return-label','X-Order-Version':'3'},body});assert.equal(ui.calls[0].options.body,body);
});
test('demo adapter refuses disconnected sessions and routes outside the order API',async()=>{
 const disconnected=shared({connected:false});await assert.rejects(disconnected.api('/api/admin/orders'),/Inicia/);assert.equal(disconnected.calls.length,0);const ui=shared();await assert.rejects(ui.api('/api/admin/identity'),/Ruta/);assert.equal(ui.calls.length,0);
});

function live({version=1,nextVersion=2,open=true,deferred=false,demo=false,connected=true}={}){
 const elements=new Map(),timers=new Map(),events={},calls=[],loads=[],renders=[];let timerId=0,resolveResponse,clearedLinks=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{id,value:'',checked:false,files:[],textContent:'',open:false});return elements.get(id);};element('detail').open=open;element('return-status').value='requested';
 const order={id:'DEMO-001',management_version:version,return_status:'none',private_note:'',carrier:'',tracking:'',return_reason:'',return_resolution:'',customer_reply:'',return_carrier:'',return_code:''};
 const document={hidden:false,body:{classList:{contains:()=>demo}},activeElement:{tagName:'BODY',closest:()=>null},addEventListener(name,fn){events[name]=fn;}};
 const context=vm.createContext({document,window:{DemoSession:{ready:()=>connected}},currentOrder:order,detailRequest:1,saving:false,loading:false,$:element,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},async api(path){calls.push(path);if(deferred)return new Promise(resolve=>{resolveResponse=resolve;});return{order:{...order,management_version:nextVersion,private_note:'Server note'}};},clearPortalLink(){clearedLinks++;element('portal-url').value='';},renderDetail(updated){renders.push(updated);context.currentOrder=updated;element('private-note').value=updated.private_note;},async load(options){loads.push(options);}});vm.runInContext(liveSource,context);
 return{element,calls,loads,renders,document,context,get clearedLinks(){return clearedLinks;},async poll(){const entry=[...timers.entries()].at(-1);assert.ok(entry,'a poll is scheduled');timers.delete(entry[0]);await entry[1].fn();},async visibility(hidden){document.hidden=hidden;return events.visibilitychange();},resolve(){resolveResponse({order:{...order,management_version:99,private_note:'Late note'}});}};
}
test('polling a changed order preserves drafts and asks to reload before saving',async()=>{
 const ui=live();ui.element('private-note').value='Private draft';ui.element('customer-reply').value='Buyer reply draft';ui.element('portal-url').value='old private link';await ui.poll();assert.equal(ui.renders.length,0);assert.equal(ui.element('private-note').value,'Private draft');assert.equal(ui.element('customer-reply').value,'Buyer reply draft');assert.match(ui.element('detail-message').textContent,/Se conservan tus campos/);assert.equal(ui.clearedLinks,1);assert.equal(ui.element('portal-url').value,'');
});
test('unchanged management version causes no detail DOM rendering',async()=>{
 const ui=live({nextVersion:1});await ui.poll();assert.equal(ui.calls.length,1);assert.equal(ui.renders.length,0);assert.equal(ui.clearedLinks,0);assert.equal(ui.element('detail-message').textContent,'');
});
test('a changed clean order refreshes the detail',async()=>{
 const ui=live();await ui.poll();assert.equal(ui.renders.length,1);assert.equal(ui.element('private-note').value,'Server note');assert.match(ui.element('detail-message').textContent,/actualizado/);
});
test('late polling response cannot update a detail that was reopened',async()=>{
 const ui=live({deferred:true}),pending=ui.poll();ui.context.detailRequest++;ui.element('private-note').value='Newly reopened draft';ui.resolve();await pending;assert.equal(ui.renders.length,0);assert.equal(ui.element('private-note').value,'Newly reopened draft');
});
test('hidden, saving and disconnected demonstration pages do not poll',async()=>{
 const hidden=live();await hidden.visibility(true);assert.equal(hidden.calls.length,0);const saving=live();saving.context.saving=true;await saving.poll();assert.equal(saving.calls.length,0);const disconnected=live({demo:true,connected:false});await disconnected.poll();assert.equal(disconnected.calls.length,0);
});
test('list polling is quiet and pauses while a user edits or focuses an order row',async()=>{
 const ui=live({open:false});await ui.poll();assert.equal(ui.loads.length,1);assert.equal(ui.loads[0].quiet,true);ui.document.activeElement={tagName:'INPUT',closest:()=>null};await ui.poll();assert.equal(ui.loads.length,1);ui.document.activeElement={tagName:'BUTTON',closest:selector=>selector==='#table-wrap'?{}:null};await ui.poll();assert.equal(ui.loads.length,1);
});
test('confirmation checks and a selected label are dirty edits preserved during polling',async()=>{
 const confirmed=live();confirmed.element('deliver-confirm').checked=true;await confirmed.poll();assert.equal(confirmed.renders.length,0);const label=live();label.element('return-label-file').files=[{name:'label.pdf'}];await label.poll();assert.equal(label.renders.length,0);
});
