/* Technical session for fictional demonstrations only. */
(() => {
 'use strict';
 const enabled=new URLSearchParams(location.search).get('demo')==='1'||['/demo','/demo/'].includes(location.pathname);
 const KEY='fumada-shared-demo-v1',TTL=7*24*60*60*1000,validToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value),validOrder=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
 let token='',expiresAt=0,expiryKnown=false,selectedOrder='',storage,expiryTimer=null,creating=false,stateVersion=0,bar=null;
 const listeners=new Set(),controls={};
 try{storage=window.sessionStorage;}catch{}
 function persist(){try{if(token)storage?.setItem(KEY,JSON.stringify({token,expiresAt,expiryKnown,orderId:selectedOrder}));else storage?.removeItem(KEY);}catch{}}
 function notify(){updateBar();for(const fn of listeners){try{fn();}catch{}}}
 function clear(){if(!token)return;token='';expiresAt=0;expiryKnown=false;selectedOrder='';stateVersion++;if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=null;persist();notify();}
 function ready(){if(token&&expiresAt<=Date.now())clear();return enabled&&!!token;}
 function scheduleExpiry(){if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=token?setTimeout(()=>{expiryTimer=null;if(expiresAt<=Date.now())clear();else scheduleExpiry();},Math.max(1,expiresAt-Date.now())):null;}
 function accept(value,expiry,order='',known=false){token=value;expiresAt=expiry;expiryKnown=known;selectedOrder=validOrder(order)?order:'';stateVersion++;persist();scheduleExpiry();notify();}
 function consume(){
  if(!enabled)return false;const params=new URLSearchParams(location.hash.slice(1));if(params.has('token')||!params.has('session'))return false;
  const value=params.get('session');history.replaceState(null,'',location.pathname+location.search);
  if(!validToken(value)){if(controls.message)controls.message.textContent='El enlace de demostración no es válido. Pide uno nuevo.';return false;}
  accept(value,Date.now()+TTL,params.get('order')||'');return true;
 }
 function link(path,{orderId}={}){
  const url=new URL(path,location.origin);
  if(url.origin!==location.origin||!['/','/devoluciones','/devoluciones.html','/demo'].includes(url.pathname))throw new Error('Ese enlace no pertenece a la demostración.');
  if(url.pathname!=='/demo')url.searchParams.set('demo','1');
  url.hash='';if(ready()){const params=new URLSearchParams({session:token}),id=orderId===undefined?selectedOrder:orderId;if(validOrder(id))params.set('order',id);url.hash=params.toString();}return url.href;
 }
 async function request(path,options={}){
  const url=new URL(path,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/api/demo/'))throw new Error('Solo se pueden consultar datos de la demostración.');
  if(!ready())throw new Error('Inicia una demostración o usa un enlace compartido. La sesión puede haber caducado.');
  const currentToken=token,headers=new Headers(options.headers||{});headers.set('X-Demo-Session',currentToken);
  const response=await fetch(url.pathname+url.search,{...options,headers,cache:'no-store',credentials:'omit'});
  if([401,410].includes(response.status)&&currentToken===token)clear();return response;
 }
 function busy(value){creating=value;for(const key of ['start','importButton'])if(controls[key])controls[key].disabled=value;}
 async function create(){
  if(!enabled||creating)return false;const version=stateVersion;busy(true);if(controls.message)controls.message.textContent='Preparando demostración…';
  try{const response=await fetch('/api/demo/session',{method:'POST',headers:{'Content-Type':'application/json','X-Demo-Action':'session'},body:'{}',cache:'no-store',credentials:'omit'});let data;try{data=await response.json();}catch{throw new Error('No se ha podido iniciar. Inténtalo de nuevo.');}
   if(!response.ok||!validToken(data.token)||!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+TTL+60000)throw new Error('No se ha podido iniciar la demostración. Inténtalo de nuevo.');
   if(version!==stateVersion)return false;accept(data.token,data.expiresAt,'',true);if(controls.message)controls.message.textContent='Demostración conectada. Puedes compartir el enlace con otro dispositivo.';return true;
  }catch(error){if(controls.message)controls.message.textContent=error.message;return false;}finally{busy(false);updateBar();}
 }
 function node(tag,text,id){const value=document.createElement(tag);if(text)value.textContent=text;if(id)value.id=id;return value;}
 function connectPageLinks(){for(const anchor of document.querySelectorAll?.('a[href]')||[]){try{const url=new URL(anchor.getAttribute('href'),location.href);if(url.origin===location.origin&&['/','/devoluciones','/devoluciones.html','/demo'].includes(url.pathname)&&(!url.hash||url.hash.startsWith('#session=')))anchor.href=link(url.pathname);}catch{}}}
 function updateBar(){if(!bar)return;const connected=enabled&&!!token&&expiresAt>Date.now();controls.status.textContent=connected?'Demostración conectada'+(selectedOrder?' · Pedido '+selectedOrder:''):'Demostración sin conectar';controls.start.textContent=connected?'Nueva demostración':'Iniciar demostración';controls.copy.disabled=!connected;controls.expiry.textContent=connected&&expiryKnown?'Caduca el '+new Intl.DateTimeFormat('es-ES',{dateStyle:'medium'}).format(new Date(expiresAt))+'.':'La sesión dura 7 días desde que se crea.';for(const [path,anchor]of controls.links)anchor.href=link(path);connectPageLinks();}
 function mount(){
  if(!enabled||bar||!document.body)return;bar=node('section',null,'demo-session-bar');bar.className='demo-session-bar';bar.setAttribute('aria-label','Sesión de demostración compartida');
  const inner=node('div');inner.className='demo-session-inner';const heading=node('div');heading.className='demo-session-heading';controls.status=node('strong',null,'demo-session-status');controls.status.setAttribute('role','status');controls.status.setAttribute('aria-live','polite');controls.expiry=node('span');heading.append(controls.status,controls.expiry);
  const notice=node('p','Solo datos ficticios: no uses nombres, correos ni direcciones reales. Quien reciba el enlace podrá ver y gestionar los pedidos de esta demostración.');notice.className='demo-session-notice';
  const actions=node('div');actions.className='demo-session-actions';controls.start=node('button','Iniciar demostración','demo-session-start');controls.start.type='button';controls.start.addEventListener('click',create);controls.copy=node('button','Copiar enlace para otro dispositivo','demo-session-copy');controls.copy.type='button';controls.copy.addEventListener('click',async()=>{if(!ready())return;try{await navigator.clipboard.writeText(link('/'));controls.message.textContent='Enlace copiado. Compártelo solo con quien quieras que vea la demostración.';}catch{controls.message.textContent='No se ha podido copiar. Usa el enlace de la tienda y copia su dirección para compartirlo.';}});actions.append(controls.start,controls.copy);
  const nav=node('nav');nav.setAttribute('aria-label','Navegar por la demostración');controls.links=[['/','Tienda'],['/devoluciones','Devoluciones'],['/demo','Panel']].map(([path,text])=>{const anchor=node('a',text);nav.append(anchor);return[path,anchor];});
  const form=node('form',null,'demo-session-import-form');form.className='demo-session-import';const label=node('label','Usar el enlace de otro dispositivo');label.setAttribute('for','demo-session-import');controls.input=node('input',null,'demo-session-import');controls.input.type='text';controls.input.name='demoLink';controls.input.autocomplete='off';controls.input.spellcheck=false;controls.input.placeholder='Pega aquí el enlace compartido…';controls.importButton=node('button','Conectar enlace');controls.importButton.type='submit';form.append(label,controls.input,controls.importButton);
  controls.message=node('p',null,'demo-session-message');controls.message.setAttribute('role','status');controls.message.setAttribute('aria-live','polite');
  form.addEventListener('submit',event=>{event.preventDefault();if(creating)return;try{const url=new URL(controls.input.value.trim(),location.origin),params=new URLSearchParams(url.hash.slice(1));if(url.origin!==location.origin||!['/','/devoluciones','/devoluciones.html','/demo'].includes(url.pathname)||params.has('token')||!validToken(params.get('session')))throw new Error();accept(params.get('session'),Date.now()+TTL,params.get('order')||'');controls.input.value='';controls.message.textContent='Enlace conectado. Los pedidos se comparten con el otro dispositivo.';}catch{controls.message.textContent='Pega un enlace de demostración válido de esta web.';controls.input.focus();}});
  inner.append(heading,notice,actions,nav,form,controls.message);bar.append(inner);document.body.prepend(bar);updateBar();
 }
 window.DemoSession=Object.freeze({enabled,ready,request,link,create,orderId:()=>ready()?selectedOrder:'',selectOrder(id){if(!enabled||!validOrder(id)||id===selectedOrder)return;selectedOrder=id;persist();updateBar();},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},expiry:()=>ready()&&expiryKnown?expiresAt:null});
 if(enabled){try{const record=JSON.parse(storage?.getItem(KEY)||'null');if(validToken(record?.token)&&Number.isFinite(record.expiresAt)&&record.expiresAt>Date.now()&&record.expiresAt<=Date.now()+TTL){token=record.token;expiresAt=record.expiresAt;expiryKnown=record.expiryKnown===true;selectedOrder=validOrder(record.orderId)?record.orderId:'';scheduleExpiry();}else storage?.removeItem(KEY);}catch{}consume();mount();if(!document.body)document.addEventListener('DOMContentLoaded',mount);window.addEventListener('hashchange',consume);}
})();
