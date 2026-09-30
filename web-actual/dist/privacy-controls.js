'use strict';
(()=>{
 const key='lectura_privacy_v1',lifetime=180*86400000;let choice=null,sent=false;const blocked=navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&['essential','analytics'].includes(saved.choice)&&Number.isFinite(saved.at)&&saved.at<=Date.now()&&Date.now()-saved.at<lifetime)choice=saved.choice;else localStorage.removeItem(key);}catch{try{localStorage.removeItem(key);}catch{}}
 function node(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
 const panel=document.createElement('section');panel.className='privacy-panel';panel.setAttribute('aria-label','Preferencias de privacidad');panel.hidden=!!choice;
 panel.append(node('h2','Tu privacidad, con calma'),node('p','Usamos almacenamiento necesario para recordar esta elección y, al entrar en la comunidad, mantener tu sesión. Si aceptas la analítica, contaremos visitas y clics hacia Amazon, sin perfiles personales.'));
 const actions=document.createElement('div');actions.className='privacy-actions';
 for(const [label,value]of [['Solo necesarias','essential'],['Aceptar analítica','analytics']]){const button=node('button',label);button.type='button';button.className='privacy-choice';button.addEventListener('click',()=>{choice=value;try{localStorage.setItem(key,JSON.stringify({choice:value,at:Date.now()}));}catch{}panel.hidden=true;track('view');settings.focus({preventScroll:true});});actions.append(button);}
 const more=node('a','Ver política de cookies');more.href='/cookies';actions.append(more);panel.append(actions);document.body.append(panel);
 const settings=node('button','Preferencias de privacidad');settings.type='button';settings.className='privacy-settings';settings.addEventListener('click',()=>{panel.hidden=false;panel.querySelector('button').focus();});(document.querySelector('footer')||document.body).append(settings);
 function track(event){if(choice!=='analytics'||blocked||event==='view'&&sent)return;if(event==='view')sent=true;const page=location.pathname==='/'?'home':location.pathname.startsWith('/comunidad')?'community':'legal';fetch('/api/event',{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json','X-Site-Event':'1'},body:JSON.stringify({event,page,consent:true})}).catch(()=>{});}
 document.addEventListener('click',event=>{const link=event.target.closest?.('a[data-track]');if(link&&['amazon','whatsapp'].includes(link.dataset.track))track(link.dataset.track);});track('view');
})();
