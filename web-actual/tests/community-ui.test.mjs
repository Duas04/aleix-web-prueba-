import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
const post=id=>({id,title:'Conversación '+id,author:'Lector',role:'reader',status:'published',body:'Un mensaje para conversar',version:0,createdAt:1,replyCount:0});
function browser(kind='community',intercept=()=>undefined){
 const nodes=new Map();
 function element(tag='div'){return {tag,children:[],events:{},value:'',textContent:'',hidden:false,disabled:false,open:false,elements:[],attributes:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){(this.events[type]??=[]).push(fn);},async dispatch(type,event={}){for(const fn of this.events[type]||[])await fn({preventDefault(){},...event});},showModal(){this.open=true;},close(){this.open=false;void this.dispatch('close');},focus(){},reset(){},setCustomValidity(){},reportValidity(){}};}
 const html=readFileSync(new URL('../dist/'+(kind==='community'?'comunidad':'propietario')+'.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element());
 const normal=(url)=>url.includes('/site-metrics')?{rows:[]}:url.endsWith('/me')?{loginAvailable:true,user:{id:'owner',alias:'Owner',accepted_at:1,role:'owner'},canManageOwners:true}:url.endsWith('/team')?{members:[]}:url.endsWith('/moderation-history')?{events:[]}:url.endsWith('/reports')?{reports:[]}:url.includes('/posts?')?{posts:[post('one'),post('two')],hasMore:false}:url.includes('/posts/')?{post:post(url.split('/posts/')[1].split('?')[0]),replies:[],hasMore:false}:{ok:true};
 const fetch=async(url,options={})=>{const result=intercept(url,options);return result===undefined?response(normal(url)):await result;};
 vm.runInNewContext(readFileSync(new URL('../dist/'+(kind==='community'?'community':'owner')+'.js',import.meta.url),'utf8'),{document:{hidden:false,getElementById:id=>nodes.get(id),createElement:element,addEventListener(){}},location:{search:'',origin:'https://book.example',assign(){}},fetch,URL,URLSearchParams,Intl,Date,JSON,Map,Set,setInterval(){},clearInterval(){},setTimeout,clearTimeout,confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},window:{addEventListener(){}}});
 const find=(root,label)=>{for(const child of root.children){if(child.tag==='button'&&child.textContent===label)return child;const found=find(child,label);if(found)return found;}};
 return {get:id=>nodes.get(id),click:async(id,label)=>{const target=label?find(nodes.get(id),label):nodes.get(id);assert.ok(target,'Button exists: '+(label||id));await target.dispatch('click');await flush();},flush};
}
test('reply drafts survive closing and reopening, isolated per conversation',async()=>{
 const b=browser();await flush();await b.click('topics','Conversación one');b.get('reply-body').value='Borrador de la primera';await b.click('close-thread');await b.click('topics','Conversación two');assert.equal(b.get('reply-body').value,'');await b.click('close-thread');await b.click('topics','Conversación one');assert.equal(b.get('reply-body').value,'Borrador de la primera');
});
test('late report response does not hide or confirm another report form',async()=>{
 const delayed=pending();const b=browser('community',(url,options)=>url.endsWith('/reports')&&options.method==='POST'?delayed.promise:undefined);await flush();
 await b.click('topics','Avisar de un problema');b.get('report-reason').value='Motivo de aviso anterior';const sending=b.get('report-form').dispatch('submit');await flush();await b.click('close-report');await b.click('topics','Avisar de un problema');b.get('report-reason').value='Un nuevo borrador';delayed.resolve(response({ok:true}));await sending;assert.equal(b.get('report-form').hidden,false);assert.equal(b.get('report-status').textContent,'');assert.equal(b.get('report-reason').value,'Un nuevo borrador');
});
test('old report refresh cannot restore a stale queue after a newer refresh',async()=>{
 const old=pending();let reads=0;const b=browser('owner',(url)=>url.endsWith('/reports')?(++reads===1?old.promise:response({reports:[]})):undefined);await flush();await b.click('refresh-reports');old.resolve(response({reports:[{id:'stale',postId:'one',threadId:'one',title:'Obsoleto',reason:'Aviso ya resuelto',body:'Texto',reporter:'Reader',createdAt:1}]}));await flush();assert.equal(b.get('community-reports').children.length,0);
});
test('refreshing reports preserves the written resolution',async()=>{
 const b=browser('owner',url=>url.endsWith('/reports')?response({reports:[{id:'report-one',postId:'one',threadId:'one',title:'Pregunta',reason:'Un motivo válido',body:'Texto',reporter:'Reader',createdAt:1}]}):undefined);await flush();
 const form=()=>b.get('community-reports').children[0].children.find(el=>el.tag==='form');
 const input=()=>form().children.find(el=>el.tag==='input');input().value='Resolución todavía sin enviar';await b.click('refresh-reports');assert.equal(input().value,'Resolución todavía sin enviar');
});
test('late private responses cannot repopulate the panel after permissions expire',async()=>{
 const reports=pending();const b=browser('owner',url=>url.endsWith('/reports')?reports.promise:url.endsWith('/site-metrics')?response({error:'Acceso privado'},403):undefined);await flush();
 reports.resolve(response({reports:[{id:'private',threadId:'one',reason:'Aviso privado',body:'Texto',reporter:'Reader',createdAt:1}]}));await flush();
 assert.equal(b.get('community-reports').children.length,0);assert.equal(b.get('team-members').children.length,0);assert.equal(b.get('metrics-summary').children.length,0);assert.equal(b.get('team-section').hidden,true);
});
test('moderation of a pending reply can open its original conversation',async()=>{
 const b=browser('community',url=>url.endsWith('/moderation')?response({posts:[{...post('reply'),parentId:'one',title:'',status:'pending'}]}):undefined);await flush();await b.click('moderation');await b.click('topics','Ver conversación original');assert.equal(b.get('thread-title').textContent,'Conversación one');
});
