'use strict';
const ownerElement=id=>document.getElementById(id);
let accessVersion=0,accessLost=false,metricsVersion=0,historyVersion=0,reportsVersion=0,teamBusy=false;
const resolutionDrafts=new Map(),resolutionInputs=new Map();
function teamText(tag,value){const element=document.createElement(tag);element.textContent=value;return element;}
function loseAccess(){
 accessLost=true;accessVersion++;metricsVersion++;historyVersion++;reportsVersion++;
 resolutionDrafts.clear();resolutionInputs.clear();
 for(const id of ['team-members','team-candidate','metrics-summary','moderation-history','community-reports'])ownerElement(id).replaceChildren();
 ownerElement('team-section').hidden=true;
 for(const id of ['metrics-status','moderation-status','reports-status'])ownerElement(id).textContent='Tu sesión o tus permisos han cambiado. Vuelve a entrar con Google desde la comunidad.';
}
async function ownerApi(url,body){
 const version=accessVersion;
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Community-Action':'write'},body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json();}catch{throw Error('No se ha podido conectar. Pulsa Actualizar para reintentar.');}
 if(response.status===401||response.status===403)loseAccess();
 if(accessLost||version!==accessVersion)throw Error('Tu sesión o tus permisos han cambiado. Vuelve a entrar con Google desde la comunidad.');
 if(!response.ok)throw Error(data.error||'No se ha podido completar la acción.');
 return data;
}
const teamApi=(path,body)=>ownerApi('/api/community/'+path,body);
async function refreshMetrics(){
 const version=++metricsVersion,status=ownerElement('metrics-status'),button=ownerElement('refresh-metrics');button.disabled=true;status.textContent='Cargando estadísticas…';
 try{
  const data=await ownerApi('/api/site-metrics');if(version!==metricsVersion)return;
  const totals={view:0,amazon:0};for(const row of data.rows)if(Object.hasOwn(totals,row.event)&&Number.isFinite(row.count))totals[row.event]+=row.count;
  ownerElement('metrics-summary').replaceChildren(...[['Vistas registradas',totals.view],['Clics hacia Amazon',totals.amazon],['Tasa de clics a Amazon',totals.view?(100*totals.amazon/totals.view).toFixed(1)+' %':'Sin datos']].map(([title,value])=>teamText('p',title+': '+value)));
  status.textContent=data.rows.length?'Datos actualizados.':'Todavía no hay eventos con consentimiento.';
 }catch(e){if(version===metricsVersion)status.textContent=e.message;}finally{button.disabled=false;}
}
async function changeRole(member,grant){
 if(teamBusy||!confirm((grant?'Dar permisos de dueño a ':'Retirar permisos de dueño a ')+member.alias+' ('+member.email+')'+(grant?' permitirá moderar conversaciones y consultar estadísticas. ¿Continuar?':' impedirá su acceso privado. ¿Continuar?')))return;
 teamBusy=true;
 try{await teamApi('team/'+(grant?'grant':'revoke'),{userId:member.id,email:member.email,confirmed:true});ownerElement('team-candidate').replaceChildren();await loadTeam();ownerElement('team-status').textContent=grant?'Nuevo dueño añadido. Ya puede entrar con Google.':'Permisos retirados.';}
 catch(e){ownerElement('team-status').textContent=e.message;}finally{teamBusy=false;}
}
function memberCard(member,grant=false){
 const card=teamText('div','');card.className='team-person';card.append(teamText('strong',member.alias),teamText('p',member.email));
 if(member.principal)card.append(teamText('p','Dueño principal · Cuenta protegida'));
 else{const button=teamText('button',grant?'Confirmar nuevo dueño':'Retirar permisos');button.type='button';button.className='secondary';button.addEventListener('click',()=>changeRole(member,grant));card.append(button);}
 return card;
}
async function loadTeam(){const data=await teamApi('team');if(accessLost)return;ownerElement('team-members').replaceChildren(...data.members.map(member=>memberCard(member)));}
ownerElement('team-form').addEventListener('submit',async event=>{
 event.preventDefault();if(teamBusy)return;teamBusy=true;ownerElement('team-candidate').replaceChildren();
 try{const data=await teamApi('team/lookup',{email:ownerElement('team-email').value.trim()});if(accessLost)return;ownerElement('team-candidate').append(memberCard(data.member,true));ownerElement('team-status').textContent='Comprueba la cuenta antes de conceder acceso.';}
 catch(e){ownerElement('team-status').textContent=e.message;}finally{teamBusy=false;}
});
async function loadModerationHistory(){
 const version=++historyVersion;
 try{const data=await teamApi('moderation-history');if(version!==historyVersion)return;
  ownerElement('moderation-history').replaceChildren(...data.events.map(event=>{const item=teamText('div','');item.className='team-person';item.append(teamText('strong',event.action==='published'?'Aprobada':'Retirada'),teamText('p',event.actor+' · '+new Date(event.createdAt).toLocaleString('es-ES')),teamText('p',event.reason||'Aprobada conforme a las normas.'));return item;}));
  ownerElement('moderation-status').textContent=data.events.length?'Últimas '+data.events.length+' decisiones.':'Todavía no hay decisiones de moderación.';
 }catch(e){if(version===historyVersion)ownerElement('moderation-status').textContent=e.message;}
}
function rememberResolutions(){for(const [id,input]of resolutionInputs){if(input.value.trim())resolutionDrafts.set(id,input.value);else resolutionDrafts.delete(id);}}
function reportCard(report){
 const card=teamText('article','');card.className='team-person';
 card.append(teamText('h4',report.title||'Aviso sobre una respuesta'),teamText('p','Aviso de '+report.reporter+' · '+new Date(report.createdAt).toLocaleString('es-ES')),teamText('p',report.reason),teamText('blockquote',report.body));
 const link=teamText('a','Abrir conversación y moderar');link.href='/comunidad?conversacion='+encodeURIComponent(report.threadId);card.append(link);
 const form=document.createElement('form'),label=teamText('label','Decisión sobre el aviso'),input=document.createElement('input');
 input.id='resolution-'+report.id;label.htmlFor=input.id;input.name='resolution';input.required=true;input.minLength=3;input.maxLength=500;input.value=resolutionDrafts.get(report.id)||'';resolutionInputs.set(report.id,input);
 const submit=teamText('button','Marcar como revisado');submit.className='secondary';submit.type='submit';form.append(label,input,submit);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(submit.disabled)return;submit.disabled=true;reportsVersion++;
  try{await teamApi('reports/resolve',{id:report.id,resolution:input.value});resolutionDrafts.delete(report.id);resolutionInputs.delete(report.id);await loadReports();}
  catch(error){ownerElement('reports-status').textContent=error.message;}finally{submit.disabled=false;}
 });card.append(form);return card;
}
async function loadReports(){
 const version=++reportsVersion,status=ownerElement('reports-status');rememberResolutions();
 try{const data=await teamApi('reports');if(version!==reportsVersion)return;rememberResolutions();resolutionInputs.clear();
  const active=new Set(data.reports.map(report=>report.id));for(const id of resolutionDrafts.keys())if(!active.has(id))resolutionDrafts.delete(id);
  ownerElement('community-reports').replaceChildren(...data.reports.map(reportCard));
  status.textContent=data.reports.length?data.reports.length+(data.reports.length===1?' aviso pendiente.':' avisos pendientes en esta tanda.'):'No hay avisos pendientes.';
 }catch(e){if(version===reportsVersion)status.textContent=e.message;}
}
ownerElement('refresh-metrics').addEventListener('click',refreshMetrics);
ownerElement('refresh-moderation').addEventListener('click',loadModerationHistory);
ownerElement('refresh-reports').addEventListener('click',loadReports);
teamApi('me').then(async data=>{if(!accessLost&&data.canManageOwners){ownerElement('team-section').hidden=false;await loadTeam();}}).catch(e=>{ownerElement('metrics-status').textContent=e.message;});
refreshMetrics();loadModerationHistory();loadReports();
