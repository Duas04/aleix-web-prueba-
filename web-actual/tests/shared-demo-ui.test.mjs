import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const source=existsSync('dist/demo-session.js')?readFileSync('dist/demo-session.js','utf8'):'';
function harness({enabled=true,hash='',storageWorks=true,path='/demo',clipboardWorks=true}={}){
 assert.ok(source,'shared session script exists');let now=1000000,responseOverride=null;const nodes=[],calls=[],events={},storage=new Map(),timers=new Map();let timerId=0;
 const node=()=>{const n={children:[],events:{},value:'',hidden:false,disabled:false,textContent:'',append(...children){this.children.push(...children);},prepend(...children){this.children.unshift(...children);},addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this[name]=value;},focus(){},removeAttribute(name){delete this[name];}};nodes.push(n);return n;};
 const document={body:node(),createElement:node,addEventListener(name,fn){events[name]=fn;}};
 const location={origin:'https://book.example',pathname:enabled?path:'/devoluciones',search:enabled?'?demo=1':'',hash};
 const window={addEventListener(name,fn){events[name]=fn;},sessionStorage:{getItem(key){if(!storageWorks)throw Error('blocked');return storage.get(key)||null;},setItem(key,value){if(!storageWorks)throw Error('blocked');storage.set(key,value);},removeItem(key){storage.delete(key);}}};
 class ClockDate extends Date{static now(){return now;}}
 const context=vm.createContext({window,document,location,history:{replaceState(_s,_t,path){location.hash='';location.path=path;}},URL,URLSearchParams,Headers,Intl,Date:ClockDate,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},navigator:{clipboard:{writeText:async()=>{if(!clipboardWorks)throw Error('blocked');}}},fetch:async(path,options={})=>{calls.push({path,options});return responseOverride?new Response(JSON.stringify(responseOverride.data),responseOverride.options):new Response(JSON.stringify({token:'a'.repeat(43),expiresAt:now+604800000}));}});
 vm.runInContext(source,context);return {session:window.DemoSession,calls,storage,location,element:id=>nodes.find(n=>n.id===id),response(data,status,headers={}){responseOverride={data,options:{status,headers}};},resetResponse(){responseOverride=null;},advance(ms){now+=ms;for(const [id,timer]of [...timers])if(timer.ms<=ms){timers.delete(id);timer.fn();}},async hash(value){location.hash=value;await events.hashchange?.();},expire(){now+=604800001;},timers};
}
test('real token links are untouched and no room is auto-created',()=>{
 const real=harness({enabled:false,hash:'#token='+'r'.repeat(43)});assert.equal(real.location.hash,'#token='+'r'.repeat(43));assert.equal(real.session.enabled,false);assert.equal(real.calls.length,0);
 const demo=harness();assert.equal(demo.session.ready(),false);assert.equal(demo.calls.length,0);
});
test('explicit create provides private shared navigation and notified subscribers',async()=>{
 const ui=harness();let changes=0;ui.session.subscribe(()=>changes++);await ui.session.create();assert.equal(ui.session.ready(),true);assert.equal(ui.calls[0].options.headers['X-Demo-Action'],'session');assert.equal(ui.session.token,undefined);assert.equal(changes,1);
 ui.session.selectOrder('DEMO-001');assert.equal(changes,1,'selecting an order must not restart session consumers');const url=new URL(ui.session.link('/devoluciones',{orderId:'DEMO-001'}));assert.equal(url.searchParams.get('demo'),'1');assert.match(url.hash,/session=a{43}&order=DEMO-001/);assert.ok(ui.storage.size);assert.throws(()=>ui.session.link('https://evil.example/'),/enlace/i);
});
test('incoming session fragment is removed and order survives navigation',()=>{
 const ui=harness({hash:'#session='+'b'.repeat(43)+'&order=DEMO-002'});assert.equal(ui.location.hash,'');assert.equal(ui.session.ready(),true);assert.equal(ui.session.orderId(),'DEMO-002');assert.equal(ui.calls.length,0);assert.match(ui.session.link('/demo'),/order=DEMO-002/);
});
test('technical storage failure keeps session in memory and navigation links',async()=>{
 const ui=harness({storageWorks:false});await ui.session.create();assert.equal(ui.session.ready(),true);assert.match(ui.session.link('/'),/demo=1#session=/);assert.equal(ui.storage.size,0);
});
test('authenticated requests send token only to same-origin demo APIs',async()=>{
 const ui=harness({hash:'#session='+'c'.repeat(43)});await ui.session.request('/api/demo/orders',{headers:{'X-Demo-Action':'purchase'},method:'POST',body:'{}'});const headers=ui.calls[0].options.headers;assert.equal(new Headers(headers).get('X-Demo-Session'),'c'.repeat(43));assert.equal(ui.calls[0].options.cache,'no-store');assert.equal(ui.calls[0].options.credentials,'omit');await assert.rejects(ui.session.request('https://evil.example/api/demo/orders'),/demostración/i);assert.equal(ui.calls.length,1);
});
test('expiry clears storage and notifies the connected page',async()=>{
 const ui=harness();await ui.session.create();let changes=0;ui.session.subscribe(()=>changes++);ui.expire();assert.equal(ui.session.ready(),false);assert.equal(ui.storage.size,0);assert.equal(changes,1);
});
test('pasting a shared link accepts only this site and refuses real private tokens',async()=>{
 const ui=harness(),form=ui.element('demo-session-import-form'),input=ui.element('demo-session-import');input.value='https://evil.example/?demo=1#session='+'a'.repeat(43);await form.events.submit({preventDefault(){}});assert.equal(ui.session.ready(),false);input.value='https://book.example/devoluciones#token='+'a'.repeat(43);await form.events.submit({preventDefault(){}});assert.equal(ui.session.ready(),false);input.value='https://book.example/devoluciones?demo=1#session='+'d'.repeat(43)+'&order=DEMO-004';await form.events.submit({preventDefault(){}});assert.equal(ui.session.ready(),true);assert.equal(ui.session.orderId(),'DEMO-004');assert.equal(input.value,'');assert.equal(ui.calls.length,0);
});

test('rate limit explains the wait, prevents repeated creation and preserves a connected session',async()=>{
 const ui=harness();await ui.session.create();const originalLink=ui.session.link('/demo');let changes=0;ui.session.subscribe(()=>changes++);
 ui.response({error:'Has iniciado varias demostraciones en poco tiempo.'},429,{'Retry-After':'45'});
 assert.equal(await ui.session.create(),false);assert.match(ui.element('demo-session-message').textContent,/45 segundos/);assert.equal(ui.element('demo-session-start').disabled,true);assert.equal(ui.element('demo-session-import-form').children.at(-1).disabled,false);
 await ui.session.create();assert.equal(ui.calls.length,2);assert.equal(ui.session.link('/demo'),originalLink);assert.equal(changes,0);
 ui.advance(45000);assert.equal(ui.element('demo-session-start').disabled,false);ui.resetResponse();assert.equal(await ui.session.create(),true);
});
test('unavailable service shows its useful error without claiming that a session exists',async()=>{
 const ui=harness();ui.response({error:'No se puede abrir la demostración ahora. Vuelve a intentarlo.'},503);assert.equal(await ui.session.create(),false);assert.match(ui.element('demo-session-message').textContent,/No se puede abrir la demostración ahora/);assert.equal(ui.session.ready(),false);assert.equal(ui.element('demo-session-start').disabled,false);
});

test('denied buyer access keeps the shared room while an expired session clears it',async()=>{
 const ui=harness();await ui.session.create();const link=ui.session.link('/demo');
 ui.response({error:'Acceso revocado'},403);assert.equal((await ui.session.request('/api/demo/returns/DEMO-001')).status,403);assert.equal(ui.session.ready(),true);assert.equal(ui.session.link('/demo'),link);
 ui.response({error:'Sesión caducada'},401);await ui.session.request('/api/demo/admin/orders');assert.equal(ui.session.ready(),false);
});

test('guided navigation marks the current page and keeps sharing controls collapsed',async()=>{
 const ui=harness({path:'/devoluciones'});assert.equal(ui.element('demo-tools').open,false);assert.equal(ui.element('demo-nav-1')['aria-current'],'page');assert.match(ui.element('demo-guide').textContent,/Inicia/);
 await ui.session.create();assert.match(ui.element('demo-guide').textContent,/pedido/);ui.session.selectOrder('DEMO-002');assert.match(ui.element('demo-nav-2').href,/order=DEMO-002/);
});

test('clipboard denial offers a selectable same-session link and clears it on session change',async()=>{
 const ui=harness({clipboardWorks:false});await ui.session.create();await ui.element('demo-session-copy').events.click();assert.equal(ui.element('demo-share-fallback').hidden,false);assert.match(ui.element('demo-share-link').value,/#session=a{43}/);assert.match(ui.element('demo-session-message').textContent,/selecciona/i);
 ui.response({error:'expired'},401);await ui.session.request('/api/demo/admin/orders');assert.equal(ui.element('demo-share-link').value,'');assert.equal(ui.element('demo-share-fallback').hidden,true);
});
