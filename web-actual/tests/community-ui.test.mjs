import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
const post=id=>({id,title:'Conversación '+id,author:'Lector',role:'reader',status:'published',body:'Un mensaje para conversar',version:0,createdAt:1,replyCount:0});
const report=id=>({id,postId:'one',threadId:'one',title:'Pregunta',reason:'Un motivo válido',body:'Texto',reporter:'Reader',createdAt:1});
const metricFixture=(days,views=0,clicks=0,previousViews=0)=>{
 const end=Date.UTC(2026,8,30),iso=ms=>new Date(ms).toISOString().slice(0,10),start=end-(days-1)*86400000,previousEnd=start-86400000,previousStart=previousEnd-(days-1)*86400000;
 return {days,period:{start:iso(start),end:iso(end),previousStart:iso(previousStart),previousEnd:iso(previousEnd),timeZone:'UTC',includesToday:true},rows:[{day:iso(end),event:'view',page:'home',count:views},{day:iso(end),event:'amazon',page:'home',count:clicks}],previousRows:[{day:iso(previousEnd),event:'view',page:'home',count:previousViews}],community:{current:{questions:2,replies:3},previous:{questions:1,replies:1},pending:{questions:4,replies:5}}};
};
const allText=node=>[node.textContent,...node.children.flatMap(allText)].join(' ');
function browser(kind='community',intercept=()=>undefined){
 const nodes=new Map(),downloads=[],objectUrls=new Map();
 function element(tag='div'){return {tag,children:[],events:{},value:'',textContent:'',hidden:false,disabled:false,open:false,elements:[],attributes:{},append(...items){for(const item of items){item.parent=this;this.children.push(item);}},replaceChildren(...items){for(const item of this.children)item.parent=null;this.children=[];this.append(...items);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){(this.events[type]??=[]).push(fn);},async dispatch(type,event={}){for(const fn of this.events[type]||[])await fn({preventDefault(){},...event});},showModal(){this.open=true;},close(){this.open=false;void this.dispatch('close');},focus(){},reset(){},setCustomValidity(){},reportValidity(){},click(){if(tag==='a')downloads.push({name:this.download,blob:objectUrls.get(this.href)});},remove(){if(this.parent){this.parent.children=this.parent.children.filter(item=>item!==this);this.parent=null;}}};}
 const html=readFileSync(new URL('../dist/'+(kind==='community'?'comunidad':'propietario')+'.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element());
 if(kind==='owner')nodes.get('metrics-range').value='30';
 const normal=(url)=>url.includes('/site-metrics')?{days:30,period:{start:'2026-09-01',end:'2026-09-30',previousStart:'2026-08-02',previousEnd:'2026-08-31',timeZone:'UTC',includesToday:true},rows:[],previousRows:[],community:{current:{questions:0,replies:0},previous:{questions:0,replies:0},pending:{questions:0,replies:0}}}:url.endsWith('/me')?{loginAvailable:true,user:{id:'owner',alias:'Owner',accepted_at:1,role:'owner'},canManageOwners:true}:url.endsWith('/team')?{members:[]}:url.endsWith('/moderation-history')?{events:[]}:url.endsWith('/reports')?{reports:[]}:url.includes('/posts?')?{posts:[post('one'),post('two')],hasMore:false}:url.includes('/posts/')?{post:post(url.split('/posts/')[1].split('?')[0]),replies:[],hasMore:false}:{ok:true};
 const fetch=async(url,options={})=>{const result=intercept(url,options);return result===undefined?response(normal(url)):await result;};
 class TestURL extends URL{static createObjectURL(blob){const id='blob:test-'+(objectUrls.size+1);objectUrls.set(id,blob);return id;}static revokeObjectURL(id){objectUrls.delete(id);}}
 vm.runInNewContext(readFileSync(new URL('../dist/'+(kind==='community'?'community':'owner')+'.js',import.meta.url),'utf8'),{document:{hidden:false,body:element('body'),getElementById:id=>nodes.get(id),createElement:element,createElementNS:(_ns,tag)=>element(tag),addEventListener(){}},location:{search:'',origin:'https://book.example',assign(){}},fetch,URL:TestURL,URLSearchParams,Blob,Intl,Date,JSON,Map,Set,setInterval(){},clearInterval(){},setTimeout,clearTimeout,confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},window:{addEventListener(){}}});
 const find=(root,label)=>{for(const child of root.children){if(child.tag==='button'&&child.textContent===label)return child;const found=find(child,label);if(found)return found;}};
 return {get:id=>nodes.get(id),downloads,click:async(id,label)=>{const target=label?find(nodes.get(id),label):nodes.get(id);assert.ok(target,'Button exists: '+(label||id));await target.dispatch('click');await flush();},flush};
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
 const reports=pending();const b=browser('owner',url=>url.endsWith('/reports')?reports.promise:url.includes('/site-metrics')?response({error:'Acceso privado'},403):undefined);await flush();
 reports.resolve(response({reports:[{id:'private',threadId:'one',reason:'Aviso privado',body:'Texto',reporter:'Reader',createdAt:1}]}));await flush();
 assert.equal(b.get('community-reports').children.length,0);assert.equal(b.get('team-members').children.length,0);assert.equal(b.get('metrics-summary').children.length,0);assert.equal(b.get('team-section').hidden,true);
});
test('changing metrics period ignores the earlier response and keeps current controls enabled',async()=>{
 const old=pending(),b=browser('owner',url=>url.includes('/site-metrics?days=30')?old.promise:url.includes('/site-metrics?days=7')?response(metricFixture(7,7,2,3)):undefined);await flush();
 b.get('metrics-range').value='7';await b.get('metrics-range').dispatch('change');await flush();
 assert.match(allText(b.get('metrics-summary')),/7/);assert.equal(b.get('export-metrics').disabled,false);
 old.resolve(response(metricFixture(30,300,100,200)));await flush();
 assert.doesNotMatch(allText(b.get('metrics-summary')),/300/);assert.equal(b.get('refresh-metrics').disabled,false);assert.equal(b.get('export-metrics').disabled,false);
});
test('loss of owner permission clears displayed analytics and blocks export',async()=>{
 let reads=0;const b=browser('owner',url=>url.includes('/site-metrics')?(++reads===1?response(metricFixture(30,12,3,7)):response({error:'Acceso privado'},403)):undefined);await flush();
 assert.match(allText(b.get('metrics-summary')),/12/);assert.equal(b.get('export-metrics').disabled,false);
 b.get('metrics-range').value='7';await b.get('metrics-range').dispatch('change');await flush();
 for(const id of ['metrics-summary','metrics-chart','metrics-days','metrics-pages','metrics-community'])assert.equal(b.get(id).children.length,0,id);
 assert.equal(b.get('export-metrics').disabled,true);assert.equal(b.get('metrics-range').disabled,true);assert.equal(b.downloads.length,0);
});
test('metrics display handles no prior views and no current views without invalid percentages',async()=>{
 const b=browser('owner',url=>url.includes('/site-metrics')?response(metricFixture(30,0,2,0)):undefined);await flush();
 const summary=allText(b.get('metrics-summary'));
 assert.match(summary,/Sin datos/);assert.doesNotMatch(summary,/NaN|Infinity/);
 assert.match(allText(b.get('metrics-community')),/2.*3.*9/);
});
test('CSV rechecks owner access and exports only aggregate figures',async()=>{
 let reads=0;const b=browser('owner',url=>url.includes('/site-metrics')?(++reads===1?response(metricFixture(30,12,3,7)):response(metricFixture(30,14,4,7))):undefined);await flush();
 await b.click('export-metrics');assert.equal(reads,2);assert.equal(b.downloads.length,1);assert.match(b.downloads[0].name,/^estadisticas-2026-09-01-2026-09-30\.csv$/);
 const bytes=new Uint8Array(await b.downloads[0].blob.arrayBuffer());assert.deepEqual([...bytes.slice(0,3)],[0xef,0xbb,0xbf]);
 const csv=await b.downloads[0].blob.text();assert.match(csv,/"fecha_utc";"apartado";"vistas"/);assert.match(csv,/"2026-09-30";"todos";"14";"4"/);assert.doesNotMatch(csv,/@|google_sub|community_users|cf-connecting-ip/i);
});
test('a server response for a different period cannot enable CSV',async()=>{
 const b=browser('owner',url=>url.includes('/site-metrics?days=30')?response(metricFixture(7,12,3,7)):undefined);await flush();
 assert.equal(b.get('metrics-summary').children.length,0);assert.equal(b.get('export-metrics').disabled,true);
 assert.match(b.get('metrics-status').textContent,/periodo|estadísticas/i);
});
test('CSV does not download if a fresh permission check fails',async()=>{
 let reads=0;const b=browser('owner',url=>url.includes('/site-metrics')?(++reads===1?response(metricFixture(30,12,3,7)):response({error:'Acceso privado'},403)):undefined);await flush();
 await b.click('export-metrics');assert.equal(reads,2);assert.equal(b.downloads.length,0);assert.equal(b.get('export-metrics').disabled,true);assert.equal(b.get('metrics-summary').children.length,0);
});
test('moderation of a pending reply can open its original conversation',async()=>{
 const b=browser('community',url=>url.includes('/moderation?')?response({posts:[{...post('reply'),parentId:'one',title:'',status:'pending'}],hasMore:false}):undefined);await flush();await b.click('moderation');await b.click('topics','Ver conversación original');assert.equal(b.get('thread-title').textContent,'Conversación one');
});
test('public conversations remain readable when account lookup fails',async()=>{
 const b=browser('community',url=>url.endsWith('/me')?response({error:'Cuenta temporalmente inaccesible'},503):undefined);await flush();
 assert.equal(b.get('topics').children.length,2);
 assert.match(b.get('login-note').textContent,/Cuenta temporalmente inaccesible/);
 assert.doesNotMatch(b.get('community-status').textContent,/No se ha podido cargar la comunidad/);
});
test('a failed new filter does not leave old conversations under its selected label',async()=>{
 const delayed=pending();const b=browser('community',url=>url.includes('mine=1')?delayed.promise:url.includes('/posts?')?response({posts:[post('one'),post('two')],hasMore:true}):undefined);await flush();
 assert.equal(b.get('topics').children.length,2);
 const loading=b.get('my-topics').dispatch('click');await flush();
 assert.equal(b.get('topics').children.length,0);assert.equal(b.get('more-topics').hidden,true);
 delayed.resolve(response({error:'No disponible'},503));await loading;await flush();
 assert.equal(b.get('topics').children.length,0);assert.match(b.get('community-status').textContent,/No disponible/);
});
test('a failed additional page retains the loaded conversations and retry control',async()=>{
 const b=browser('community',url=>url.includes('offset=20')?response({error:'No disponible'},503):url.includes('/posts?')?response({posts:[post('one'),post('two')],hasMore:true}):undefined);await flush();
 await b.click('more-topics');assert.equal(b.get('topics').children.length,2);assert.equal(b.get('more-topics').hidden,false);assert.equal(b.get('more-topics').disabled,false);
 assert.match(b.get('community-status').textContent,/reintentar/);
});
test('a failed thread can be refreshed with its requested id and draft intact',async()=>{
 let reads=0;const b=browser('community',url=>url.includes('/posts/one?')?(++reads===1?response({error:'Fallo temporal'},503):response({post:post('one'),replies:[],hasMore:false})):undefined);await flush();
 await b.click('topics','Conversación one');assert.match(b.get('thread-title').textContent,/No se ha podido abrir/);
 b.get('reply-body').value='Borrador conservado';await b.click('refresh-thread');
 assert.equal(reads,2);assert.equal(b.get('thread-title').textContent,'Conversación one');assert.equal(b.get('reply-body').value,'Borrador conservado');
});
test('moderation loads 20 at a time and announces the total displayed',async()=>{
 const requests=[];const b=browser('community',url=>{if(!url.includes('/moderation?'))return undefined;requests.push(url);const offset=Number(new URL(url,'https://book.example').searchParams.get('offset'));return response({posts:Array.from({length:20},(_,i)=>({...post(String(offset+i)),status:'pending'})),hasMore:offset===0});});await flush();
 await b.click('moderation');assert.equal(b.get('topics').children.length,20);assert.equal(b.get('more-topics').textContent,'Más aportaciones');assert.equal(b.get('more-topics').hidden,false);
 await b.click('more-topics');assert.equal(b.get('topics').children.length,40);assert.equal(b.get('more-topics').hidden,true);assert.match(b.get('community-status').textContent,/40 aportaciones/);
 assert.deepEqual(requests,['/api/community/moderation?offset=0','/api/community/moderation?offset=20']);
});
test('thread replies use the server page size of 20',async()=>{
 const requests=[];const b=browser('community',url=>{if(!url.includes('/posts/one?'))return undefined;requests.push(url);const offset=Number(new URL(url,'https://book.example').searchParams.get('offset'));return response({post:post('one'),replies:Array.from({length:20},(_,i)=>({...post('reply-'+(offset+i)),parentId:'one',title:''})),hasMore:offset===0});});await flush();
 await b.click('topics','Conversación one');await b.click('more-replies');
 assert.equal(b.get('thread-replies').children.length,40);
 assert.deepEqual(requests,['/api/community/posts/one?offset=0','/api/community/posts/one?offset=20']);
});
test('owner reports announce loading and expose all cursor pages',async()=>{
 const first=pending(),requests=[];const b=browser('owner',url=>{if(!url.includes('/reports'))return undefined;requests.push(url);const cursor=new URL(url,'https://book.example').searchParams.get('cursor');return cursor==='second'?response({reports:Array.from({length:20},(_,i)=>report('r'+(i+21))),hasMore:true,nextCursor:'third'}):cursor==='third'?response({reports:Array.from({length:11},(_,i)=>report('r'+(i+41))),hasMore:false,nextCursor:null}):first.promise;});
 assert.match(b.get('reports-status').textContent,/Cargando avisos/);assert.equal(b.get('community-reports').attributes['aria-busy'],'true');
 first.resolve(response({reports:Array.from({length:20},(_,i)=>report('r'+(i+1))),hasMore:true,nextCursor:'second'}));await flush();
 await b.click('more-reports');await b.click('more-reports');
 assert.equal(b.get('community-reports').children.length,51);assert.equal(b.get('more-reports').hidden,true);assert.match(b.get('reports-status').textContent,/51 avisos/);
 assert.deepEqual(requests,['/api/community/reports','/api/community/reports?cursor=second','/api/community/reports?cursor=third']);
});
test('failed report pagination retains rows, draft and retry cursor',async()=>{
 let reads=0;const b=browser('owner',url=>url.includes('/reports?cursor=next')?(++reads===1?response({error:'Fallo temporal'},503):response({reports:[report('r2')],hasMore:false,nextCursor:null})):url.endsWith('/reports')?response({reports:[report('r1')],hasMore:true,nextCursor:'next'}):undefined);await flush();
 const input=b.get('community-reports').children[0].children.find(el=>el.tag==='form').children.find(el=>el.tag==='input');input.value='Borrador en la primera página';
 await b.click('more-reports');assert.equal(b.get('community-reports').children.length,1);assert.equal(input.value,'Borrador en la primera página');assert.equal(b.get('more-reports').hidden,false);assert.match(b.get('reports-status').textContent,/Fallo temporal/);
 await b.click('more-reports');assert.equal(reads,2);assert.equal(b.get('community-reports').children.length,2);assert.equal(input.value,'Borrador en la primera página');
});
test('report refresh failure leaves visible rows and resolution drafts intact',async()=>{
 let reads=0;const b=browser('owner',url=>url.endsWith('/reports')?(++reads===1?response({reports:[report('r1')],hasMore:false,nextCursor:null}):response({error:'Red no disponible'},503)):undefined);await flush();
 const input=b.get('community-reports').children[0].children.find(el=>el.tag==='form').children.find(el=>el.tag==='input');input.value='Decisión aún sin enviar';
 await b.click('refresh-reports');assert.equal(b.get('community-reports').children.length,1);assert.equal(input.value,'Decisión aún sin enviar');assert.match(b.get('reports-status').textContent,/Red no disponible/);assert.equal(b.get('community-reports').attributes['aria-busy'],'false');
});
test('overlapping cursor pages do not show the same report twice',async()=>{
 const b=browser('owner',url=>url.includes('/reports?cursor=next')?response({reports:[report('r2'),report('r3')],hasMore:false,nextCursor:null}):url.endsWith('/reports')?response({reports:[report('r1'),report('r2')],hasMore:true,nextCursor:'next'}):undefined);await flush();
 await b.click('more-reports');assert.equal(b.get('community-reports').children.length,3);
});
test('losing owner access during report pagination clears private rows and disables loading more',async()=>{
 const b=browser('owner',url=>url.includes('/reports?cursor=next')?response({error:'Acceso privado'},403):url.endsWith('/reports')?response({reports:[report('r1')],hasMore:true,nextCursor:'next'}):undefined);await flush();
 await b.click('more-reports');assert.equal(b.get('community-reports').children.length,0);assert.equal(b.get('more-reports').hidden,true);assert.equal(b.get('more-reports').disabled,true);assert.match(b.get('reports-status').textContent,/sesión|permisos/);
});
test('failed resolution during pagination restores report controls and ignores the stale page',async()=>{
 const delayed=pending();const b=browser('owner',(url,options)=>url.includes('/reports?cursor=next')?delayed.promise:url.endsWith('/reports/resolve')&&options.method==='POST'?response({error:'Conflicto de moderación'},409):url.endsWith('/reports')?response({reports:[report('r1')],hasMore:true,nextCursor:'next'}):undefined);await flush();
 const pagination=b.get('more-reports').dispatch('click');await flush();
 const form=b.get('community-reports').children[0].children.find(el=>el.tag==='form');form.children.find(el=>el.tag==='input').value='Decisión aún sin enviar';await form.dispatch('submit');await flush();
 assert.equal(b.get('community-reports').attributes['aria-busy'],'false');assert.equal(b.get('more-reports').disabled,false);assert.match(b.get('reports-status').textContent,/Conflicto de moderación/);
 delayed.resolve(response({reports:[report('stale')],hasMore:false,nextCursor:null}));await pagination;assert.equal(b.get('community-reports').children.length,1);
});
test('resolving a report refreshes the queue without losing other resolution drafts',async()=>{
 let resolved=false;const b=browser('owner',(url,options)=>url.endsWith('/reports/resolve')&&options.method==='POST'?(resolved=true,response({ok:true})):url.endsWith('/reports')?response({reports:resolved?[report('r2')]:[report('r1'),report('r2')],hasMore:false,nextCursor:null}):undefined);await flush();
 const cards=b.get('community-reports').children,form=cards[0].children.find(el=>el.tag==='form'),otherInput=cards[1].children.find(el=>el.tag==='form').children.find(el=>el.tag==='input');
 form.children.find(el=>el.tag==='input').value='Decisión final';otherInput.value='Borrador de otro aviso';await form.dispatch('submit');await flush();
 assert.equal(b.get('community-reports').children.length,1);assert.equal(b.get('community-reports').children[0].children.find(el=>el.tag==='form').children.find(el=>el.tag==='input').value,'Borrador de otro aviso');
});
