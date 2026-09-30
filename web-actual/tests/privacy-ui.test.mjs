import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/privacy-controls.js',import.meta.url),'utf8');
function browser({saved=null,dnt=false,gpc=false,storageFails=false}={}){
 const all=[],events=new Map(),requests=[],storage=new Map(saved?[['lectura_privacy_v1',JSON.stringify(saved)]]:[]);
 let focused=null;
 const node=tag=>{const el={tag,children:[],events:new Map(),hidden:false,textContent:'',setAttribute(){},append(...items){this.children.push(...items);},addEventListener(type,fn){this.events.set(type,fn);},querySelector(tag){return all.find(e=>e.tag===tag);},focus(options){focused={element:this,options};}};all.push(el);return el;};
 const main=node('main');
 const document={body:node('body'),createElement:node,querySelector:selector=>selector==='main'?main:null,addEventListener:(type,fn)=>events.set(type,fn)};
 vm.runInNewContext(source,{document,navigator:{doNotTrack:dnt?'1':'0',globalPrivacyControl:gpc},location:{pathname:'/'},localStorage:{getItem:key=>storage.get(key),removeItem:key=>{if(storageFails)throw Error();storage.delete(key);},setItem:(key,val)=>{if(storageFails)throw Error();storage.set(key,val);}},fetch:(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return Promise.resolve();}});
 return {requests,all,storage,get focused(){return focused;},choose(label){all.find(e=>e.tag==='button'&&e.textContent===label).events.get('click')();},click(kind){events.get('click')({target:{closest:()=>({dataset:{track:kind}})}});}};
}
test('analytics stays off before a choice, after rejection and after withdrawal',()=>{
 const b=browser();b.click('amazon');assert.equal(b.requests.length,0);b.choose('Solo necesarias');b.click('whatsapp');assert.equal(b.requests.length,0);
 b.choose('Preferencias de privacidad');b.choose('Aceptar analítica');assert.equal(b.requests.length,1);b.click('amazon');assert.equal(b.requests.length,2);
 b.choose('Preferencias de privacidad');b.choose('Solo necesarias');b.click('amazon');assert.equal(b.requests.length,2);
 assert.deepEqual(b.requests.map(r=>r.body.event),['view','amazon']);assert.ok(b.requests.every(r=>r.options.credentials==='omit'&&r.body.page==='home'&&r.body.consent===true));
});
test('DNT and GPC override stored or newly accepted analytics',()=>{for(const flags of [{dnt:true},{gpc:true}]){const b=browser({...flags,saved:{choice:'analytics',at:Date.now()}});b.click('amazon');b.choose('Aceptar analítica');assert.equal(b.requests.length,0);}});
test('expired, future and invalid preferences never activate analytics',()=>{for(const at of [Date.now()-181*86400000,Date.now()+86400000,'bad',null]){const b=browser({saved:{choice:'analytics',at}});b.click('amazon');assert.equal(b.requests.length,0);assert.equal(b.storage.has('lectura_privacy_v1'),false);}});
test('storage failure still allows an in-memory privacy choice',()=>{const b=browser({storageFails:true});b.choose('Aceptar analítica');b.click('amazon');assert.equal(b.requests.length,2);b.choose('Solo necesarias');b.click('amazon');assert.equal(b.requests.length,2);});

test('initial privacy choice returns to content, while settings return to their visible opener',()=>{
 const b=browser();b.choose('Solo necesarias');assert.equal(b.focused.element.tag,'main');
 b.choose('Preferencias de privacidad');b.choose('Solo necesarias');assert.equal(b.focused.element.textContent,'Preferencias de privacidad');
 assert.notEqual(b.focused.options?.preventScroll,true,'footer opener may scroll into view');
});
