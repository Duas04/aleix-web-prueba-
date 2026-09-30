'use strict';
const ownerElement=id=>document.getElementById(id);
let accessVersion=0,accessLost=false,metricsVersion=0,historyVersion=0,reportsVersion=0,teamBusy=false;
const resolutionDrafts=new Map(),resolutionInputs=new Map();
let metricsData=null,metricsLoading=false,metricsExporting=false;
const metricDayMs=86400000,metricPages=[['home','Portada'],['community','Comunidad'],['legal','Información legal']];
const metricNumber=new Intl.NumberFormat('es-ES'),metricDecimal=new Intl.NumberFormat('es-ES',{maximumFractionDigits:1});
function teamText(tag,value){const element=document.createElement(tag);element.textContent=value;return element;}
function loseAccess(){
 accessLost=true;accessVersion++;metricsVersion++;historyVersion++;reportsVersion++;
 resolutionDrafts.clear();resolutionInputs.clear();
 for(const id of ['team-members','team-candidate','moderation-history','community-reports'])ownerElement(id).replaceChildren();
 clearMetrics();metricsLoading=false;syncMetricsControls();
 ownerElement('team-section').hidden=true;
 for(const id of ['metrics-status','moderation-status','reports-status'])ownerElement(id).textContent='Tu sesión o tus permisos han cambiado. Vuelve a entrar con Google desde la comunidad.';
}
async function ownerApi(url,body){
 const version=accessVersion;
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Community-Action':'write'},body:JSON.stringify(body)}:{})});
 if(response.status===401||response.status===403)loseAccess();
 let data;try{data=await response.json();}catch{throw Error('No se ha podido conectar. Pulsa Actualizar para reintentar.');}
 if(accessLost||version!==accessVersion)throw Error('Tu sesión o tus permisos han cambiado. Vuelve a entrar con Google desde la comunidad.');
 if(!response.ok)throw Error(data.error||'No se ha podido completar la acción.');
 return data;
}
const teamApi=(path,body)=>ownerApi('/api/community/'+path,body);
async function refreshMetrics(){
 if(accessLost)return;
 const version=++metricsVersion,status=ownerElement('metrics-status'),days=[1,7,30].includes(Number(ownerElement('metrics-range').value))?Number(ownerElement('metrics-range').value):30;
 metricsLoading=true;metricsData=null;syncMetricsControls();ownerElement('metrics-content').setAttribute('aria-busy','true');status.textContent='Cargando estadísticas…';
 try{
  const data=await ownerApi('/api/site-metrics?days='+days);if(version!==metricsVersion)return;
  validateMetrics(data);if(data.days!==days)throw Error('El periodo recibido no coincide. Pulsa Actualizar.');renderMetrics(data);metricsData=data;
  status.textContent='Actualizado a las '+new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date())+'.';
 }catch(e){if(version===metricsVersion){clearMetrics();status.textContent=e.message;}}
 finally{if(version===metricsVersion){metricsLoading=false;ownerElement('metrics-content').setAttribute('aria-busy','false');syncMetricsControls();}}
}
function clearMetrics(){metricsData=null;for(const id of ['metrics-summary','metrics-chart','metrics-days','metrics-pages','metrics-community','metrics-period'])ownerElement(id).replaceChildren();ownerElement('metrics-content').setAttribute('aria-busy','false');}
function syncMetricsControls(){ownerElement('refresh-metrics').disabled=accessLost||metricsLoading;ownerElement('metrics-range').disabled=accessLost;ownerElement('export-metrics').disabled=accessLost||metricsLoading||metricsExporting||!metricsData;}
function metricCount(value){return Number.isSafeInteger(value)&&value>=0?value:0;}
function metricTime(day){const n=typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)?Date.parse(day+'T00:00:00Z'):NaN;if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==day)throw Error('No se han podido interpretar las fechas. Pulsa Actualizar.');return n;}
function validateMetrics(data){
 if(![1,7,30].includes(data.days)||!data.period||!data.community)throw Error('No se han podido leer las estadísticas. Pulsa Actualizar.');
 const p=data.period,start=metricTime(p.start),end=metricTime(p.end),previousStart=metricTime(p.previousStart),previousEnd=metricTime(p.previousEnd);
 if(end-start!==(data.days-1)*metricDayMs||previousEnd-previousStart!==(data.days-1)*metricDayMs||previousEnd+metricDayMs!==start)throw Error('El periodo recibido no es válido. Pulsa Actualizar.');
 for(const [rows,from,to]of [[data.rows,p.start,p.end],[data.previousRows,p.previousStart,p.previousEnd]]){
  if(!Array.isArray(rows)||rows.length>270)throw Error('No se han podido leer las estadísticas. Pulsa Actualizar.');
  for(const row of rows){metricTime(row.day);if(!['view','amazon','whatsapp'].includes(row.event)||!metricPages.some(([key])=>key===row.page)||row.day<from||row.day>to||!Number.isSafeInteger(row.count)||row.count<0)throw Error('Las estadísticas recibidas no son válidas. Pulsa Actualizar.');}
 }
}
function metricTotals(rows,page){const totals={view:0,amazon:0};for(const row of rows)if((!page||row.page===page)&&Object.hasOwn(totals,row.event))totals[row.event]+=row.count;return totals;}
function metricDays(rows,start,days){const daily=Array.from({length:days},(_,i)=>({day:new Date(metricTime(start)+i*metricDayMs).toISOString().slice(0,10),view:0,amazon:0}));const byDate=new Map(daily.map(day=>[day.day,day]));for(const row of rows){const day=byDate.get(row.day);if(day&&Object.hasOwn(day,row.event))day[row.event]+=row.count;}return daily;}
function metricDate(day){return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(metricTime(day)));}
function metricRange(start,end){return start===end?metricDate(start):metricDate(start)+' – '+metricDate(end);}
function metricChange(current,previous,points=false){if(current===null||previous===null)return 'Sin base de comparación';if(current===previous)return 'Sin variación';if(!points&&previous===0)return 'Sin registros anteriores';const change=points?current-previous:100*(current-previous)/previous;return (change>0?'+':'')+metricDecimal.format(change)+(points?' puntos':' %')+' respecto al periodo anterior';}
function metricItem(title,value,comparison){const group=teamText('div','');group.className='metric-item';const detail=teamText('dd',comparison);detail.className='metric-comparison';group.append(teamText('dt',title),teamText('dd',value),detail);return group;}
function metricTable(caption,headings,rows){const table=teamText('table','');table.className='metrics-table';table.append(teamText('caption',caption));const head=teamText('thead',''),header=teamText('tr','');for(const title of headings){const cell=teamText('th',title);cell.setAttribute('scope','col');header.append(cell);}head.append(header);table.append(head);const body=teamText('tbody','');for(const row of rows){const tr=teamText('tr','');row.forEach((value,i)=>{const cell=teamText(i===0?'th':'td',typeof value==='number'?metricNumber.format(value):value);if(i===0)cell.setAttribute('scope','row');tr.append(cell);});body.append(tr);}table.append(body);return table;}
function renderMetrics(data){
 const totals=metricTotals(data.rows),previous=metricTotals(data.previousRows),rate=totals.view?100*totals.amazon/totals.view:null,previousRate=previous.view?100*previous.amazon/previous.view:null;
 ownerElement('metrics-period').textContent=metricRange(data.period.start,data.period.end)+' · Comparado con '+metricRange(data.period.previousStart,data.period.previousEnd)+'. Días en UTC; hoy todavía está en curso.';
 ownerElement('metrics-summary').replaceChildren(metricItem('Vistas registradas',metricNumber.format(totals.view),metricChange(totals.view,previous.view)),metricItem('Clics hacia Amazon',metricNumber.format(totals.amazon),metricChange(totals.amazon,previous.amazon)),metricItem('Relación clics / vistas',rate===null?'Sin datos':metricDecimal.format(rate)+' %',metricChange(rate,previousRate,true)));
 const daily=metricDays(data.rows,data.period.start,data.days);renderMetricChart(daily);
 ownerElement('metrics-days').replaceChildren(metricTable('Detalle diario del periodo seleccionado',['Día (UTC)','Vistas','Clics a Amazon'],daily.map(row=>[metricDate(row.day),row.view,row.amazon])));
 ownerElement('metrics-pages').replaceChildren(metricTable('Vistas y clics por apartado',['Apartado','Vistas','Clics a Amazon'],metricPages.map(([key,name])=>{const count=metricTotals(data.rows,key);return[name,count.view,count.amazon];})));
 const c=data.community,questions=metricCount(c.current?.questions),replies=metricCount(c.current?.replies),pendingQuestions=metricCount(c.pending?.questions),pendingReplies=metricCount(c.pending?.replies);
 ownerElement('metrics-community').replaceChildren(metricItem('Preguntas publicadas',metricNumber.format(questions),metricChange(questions,metricCount(c.previous?.questions))),metricItem('Respuestas publicadas',metricNumber.format(replies),metricChange(replies,metricCount(c.previous?.replies))),metricItem('Esperando revisión ahora',metricNumber.format(pendingQuestions+pendingReplies),metricNumber.format(pendingQuestions)+' preguntas · '+metricNumber.format(pendingReplies)+' respuestas'));
}
function renderMetricChart(daily){
 const root=ownerElement('metrics-chart');root.replaceChildren();
 if(!daily.some(row=>row.view||row.amazon)){const empty=teamText('p','Todavía no hay vistas ni clics registrados en este periodo. Las visitas solo cuentan cuando se acepta la analítica.');empty.className='metrics-empty';root.append(empty);return;}
 const figure=teamText('figure',''),legend=teamText('figcaption','');figure.className='metrics-figure';legend.className='metrics-legend';for(const [name,key]of [['Vistas registradas','view'],['Clics a Amazon','amazon']]){const label=teamText('span',name);label.className='metrics-key '+key;legend.append(label);}figure.append(legend);
 const grid=teamText('div','');grid.className='metrics-plot-grid';const axis=teamText('div','');axis.className='metrics-yaxis';axis.setAttribute('aria-hidden','true');const maximum=Math.max(...daily.flatMap(row=>[row.view,row.amazon]));const ceiling=maximum<=4?Math.max(2,Math.ceil(maximum/2)*2):Math.ceil(maximum/4)*4;for(const n of [ceiling,ceiling/2,0])axis.append(teamText('span',metricNumber.format(n)));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 640 200');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label','Evolución diaria de vistas registradas y clics a Amazon. Los valores exactos están en el detalle diario.');
 const shape=(tag,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));svg.append(node);return node;};
 for(const y of [12,100,188])shape('line',{x1:0,x2:640,y1:y,y2:y,class:'metrics-gridline'});
 const x=i=>daily.length===1?320:10+i*620/(daily.length-1),y=n=>188-176*n/ceiling;
 for(const key of ['view','amazon']){shape('path',{d:daily.map((row,i)=>(i?'L':'M')+x(i)+' '+y(row[key])).join(' '),class:'metrics-series '+key,fill:'none'});daily.forEach((row,i)=>{const dot=shape('circle',{cx:x(i),cy:y(row[key]),r:daily.length>7?2.5:3.5,class:'metrics-point '+key});const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=metricDate(row.day)+': '+metricNumber.format(row[key])+(key==='view'?' vistas':' clics a Amazon');dot.append(title);});}
 grid.append(axis,svg);figure.append(grid);const dates=teamText('div','');dates.className='metrics-xaxis';dates.setAttribute('aria-hidden','true');const indexes=daily.length===1?[0]:daily.length>2?[0,Math.floor((daily.length-1)/2),daily.length-1]:[0,daily.length-1];for(const i of indexes)dates.append(teamText('span',new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(metricTime(daily[i].day)))));figure.append(dates);root.append(figure);
}
function metricCsv(data){
 const rows=[['tipo','periodo','fecha_utc','apartado','vistas','clics_amazon','preguntas_publicadas','respuestas_publicadas','pendientes_preguntas','pendientes_respuestas']];
 for(const [period,events,start,counts]of [['actual',data.rows,data.period.start,data.community.current],['anterior',data.previousRows,data.period.previousStart,data.community.previous]]){
  for(const day of metricDays(events,start,data.days))rows.push(['diario',period,day.day,'todos',day.view,day.amazon,'','','','']);
  for(const [key,name]of metricPages){const total=metricTotals(events,key);rows.push(['apartado',period,'',name,total.view,total.amazon,'','','','']);}
  rows.push(['comunidad',period,'','publicadas','','',metricCount(counts.questions),metricCount(counts.replies),'','']);
 }
 rows.push(['moderacion','ahora','','pendientes','','','','',metricCount(data.community.pending.questions),metricCount(data.community.pending.replies)]);
 const cell=value=>{let text=String(value);if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
async function exportMetrics(){
 if(!metricsData||accessLost||metricsLoading||metricsExporting)return;
 const version=metricsVersion,days=metricsData.days;metricsExporting=true;syncMetricsControls();
 try{
  const data=await ownerApi('/api/site-metrics?days='+days);if(version!==metricsVersion||accessLost)return;validateMetrics(data);
  const blob=new Blob([metricCsv(data)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=teamText('a','');link.href=url;link.download='estadisticas-'+data.period.start+'-'+data.period.end+'.csv';document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  ownerElement('metrics-status').textContent='CSV preparado: incluye solo cifras agregadas del periodo y su comparación.';
 }catch(e){if(version===metricsVersion)ownerElement('metrics-status').textContent=e.message;}
 finally{metricsExporting=false;syncMetricsControls();}
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
ownerElement('metrics-range').addEventListener('change',refreshMetrics);
ownerElement('export-metrics').addEventListener('click',exportMetrics);
ownerElement('refresh-moderation').addEventListener('click',loadModerationHistory);
ownerElement('refresh-reports').addEventListener('click',loadReports);
teamApi('me').then(async data=>{if(!accessLost&&data.canManageOwners){ownerElement('team-section').hidden=false;await loadTeam();}}).catch(e=>{ownerElement('metrics-status').textContent=e.message;});
refreshMetrics();loadModerationHistory();loadReports();
