'use strict';
const $=id=>document.getElementById(id);
let fragment='',token='';
function consumeFragment(){fragment=location.hash;if(fragment)history.replaceState(null,'',location.pathname+location.search);token=new URLSearchParams(fragment.slice(1)).get('token')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))token='';}
consumeFragment();
const demo=new URLSearchParams(location.search).get('demo')==='1';
const session=window.DemoSession;
let currentCase=null,busy=false,receiptText='',viewRequest=0,pollTimer=null;
const statusLabels={none:'Sin solicitud',requested:'Solicitud registrada',reviewing:'En revisión',approved:'Devolución aprobada',received:'Libro recibido',closed:'Gestión cerrada',rejected:'Solicitud rechazada'};
const kindLabels={withdrawal:'Desistimiento',damaged:'Libro dañado',wrong:'Libro equivocado',other:'Otra consulta'};
function renderProgress(status){
 const stages=['requested','reviewing','approved','received','closed'],active=status==='rejected'?'closed':status;
 $('case-progress').hidden=!stages.includes(active);
 for(const stage of stages){const item=$('stage-'+stage);if(stage===active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');}
 $('stage-closed').textContent=status==='rejected'?'Rechazada':'Cierre';
 const next={none:'Completa el formulario para registrar tu solicitud.',requested:'Tu solicitud está registrada. El siguiente paso es que Aleix revise el caso.',reviewing:'Aleix está revisando tu solicitud. Consulta su respuesta antes de preparar el paquete.',approved:'Devolución aprobada. Sigue la respuesta de Aleix y las indicaciones de envío que aparezcan aquí.',received:'La recepción del libro está registrada. Consulta la respuesta de Aleix para conocer la resolución.',closed:'La gestión está cerrada. Consulta la respuesta de Aleix; este estado no confirma por sí solo un reembolso.',rejected:'Consulta el motivo en la respuesta de Aleix. Puedes escribirle si necesitas aclaraciones.'};
 $('case-next').textContent=next[status]||'Consulta la respuesta de Aleix para conocer el siguiente paso.';
}
const canRequest=()=>currentCase&&['none','closed','rejected'].includes(currentCase.status);
function lock(value){busy=value;$('access-fields').disabled=value;$('request-fields').disabled=value;$('label-download').disabled=value;$('case-refresh').disabled=value;$('demo-order-fields').disabled=value||(demo&&!session?.ready());}
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function api(path,{action,body}={}){
 const headers=demo?{...(action?{'X-Demo-Action':action}:{})}:{...(token?{'X-Return-Token':token}:{}),...(action?{'X-Return-Action':action}:{})};
 if(body)headers['Content-Type']='application/json';
 const options={method:action?'POST':'GET',headers,credentials:'omit',cache:'no-store',...(body?{body:JSON.stringify(body)}:{})};let response;
 if(demo){if(path!=='/api/returns/case'||!session?.ready())throw new Error('Inicia una demostración desde la barra o usa un enlace compartido.');const id=currentCase?.orderId||$('demo-order').value.trim();if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('Indica un número de pedido de prueba válido.');response=await session.request('/api/demo/returns/'+encodeURIComponent(id),options);}else response=await fetch(path,options);
 let data;try{data=await response.json();}catch{throw Object.assign(new Error('No se ha podido cargar la información. Inténtalo de nuevo o escribe a Aleix.'),{status:response.status});}
 if(!response.ok)throw Object.assign(new Error(data.error||'No se ha podido completar la solicitud. Inténtalo de nuevo o pide un enlace nuevo.'),{status:response.status});return data;
}
function render(value){
 currentCase=value;$('access-panel').hidden=true;$('case-panel').hidden=false;$('case-order').textContent=value.orderId;$('case-status').textContent=statusLabels[value.status]||'En revisión';
 renderProgress(value.status);
 $('case-reason').textContent=value.reason?'Tu solicitud: '+value.reason:'';
 $('case-reply').textContent=value.reply||'';$('case-carrier').textContent=value.carrier||'Pendiente de indicar';$('case-code').textContent=value.code||'Pendiente de indicar';
 $('seller-response').hidden=!(value.reply||value.carrier||value.code||value.label);$('label-information').hidden=!(value.carrier||value.code||value.label);
 $('label-download').hidden=!value.label;$('label-help').textContent=value.label?(demo?'Archivo de demostración: no es válido para envíos.':'Sigue las indicaciones de Aleix antes de entregar el paquete. La etiqueta no implica un reembolso.'):'Todavía no hay una etiqueta disponible.';
 $('request-form').hidden=!canRequest();
 $('request-message').textContent=canRequest()?'':'La solicitud está registrada. Puedes actualizar el estado y consultar la respuesta de Aleix.';
 if(value.submittedAt!=null&&value.status!=='none'&&Object.hasOwn(kindLabels,value.kind))showReceipt(value);
 if(demo){$('demo-panel-link').href=session.link('/demo',{orderId:value.orderId});schedulePoll();}
}
function showReceipt(value,kind=value.kind,reason=value.reason){
 const timestamp=new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeStyle:'short'}).format(new Date(value.submittedAt??Date.now()));
 receiptText=`${demo?'DEMOSTRACIÓN — SIN SOLICITUD REAL\n':''}Fumada XXL · Justificante de solicitud\nPedido: ${value.orderId}\nFecha de registro${value.submittedAt!=null?'':' en este navegador'}: ${timestamp}\nTipo: ${kindLabels[kind]}\nDetalles: ${reason||'Desistimiento sin motivo indicado'}\nEstado: ${statusLabels[value.status]}\n\nEsta solicitud no devuelve dinero. No se ha enviado un correo automático.\nContacto: theshoz@gmail.com`;
 $('receipt-text').textContent=receiptText;$('receipt').hidden=false;
}
function reasonState(){const optional=$('return-kind').value==='withdrawal';$('return-reason').required=!optional;$('reason-caption').textContent=optional?'(opcional para desistimiento)':'(necesarios para revisar este caso)';}
function stopPoll(){if(pollTimer!==null)clearTimeout(pollTimer);pollTimer=null;}
function hasDraft(){return!$('request-form').hidden&&($('return-reason').value.trim()||$('return-kind').value!=='withdrawal');}
function schedulePoll(){stopPoll();if(!demo||document.hidden||!currentCase||!session?.ready())return;pollTimer=setTimeout(async()=>{pollTimer=null;if(!document.hidden&&!busy&&!hasDraft())await refresh({silent:true});schedulePoll();},5000);}
function accessLost(error){
 if(demo?![403,404].includes(error.status):error.status!==401)return false;
 if(!demo){$('access-order').value=currentCase?.orderId||$('access-order').value;token='';fragment='';$('access-panel').hidden=false;}
 currentCase=null;receiptText='';stopPoll();$('case-panel').hidden=true;$('receipt').hidden=true;
 for(const id of ['case-order','case-reply','case-reason','case-code','case-carrier','receipt-text','request-message','label-message'])$(id).textContent='';
 $('page-message').hidden=false;$('page-message').textContent=demo?error.message+' Puedes consultar otro pedido de la misma demostración.':'Tu enlace ha caducado o ya no es válido. Solicita otro enlace con tu número de pedido y correo de compra.';
 if(!demo){$('access-fields').disabled=false;$('access-order').focus();}return true;
}
async function refresh({silent=false}={}){if(busy||!currentCase)return;const version=viewRequest;if(!silent){lock(true);$('request-message').textContent='Actualizando…';}else busy=true;try{const value=(await api('/api/returns/case')).case;if(version===viewRequest&&(!silent||value.version!==currentCase?.version))render(value);}catch(error){if(version===viewRequest&&!accessLost(error))$('request-message').textContent=error.message;}finally{if(version===viewRequest){if(!silent)lock(false);else busy=false;}}}
$('return-kind').addEventListener('change',reasonState);
$('access-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;const orderId=$('access-order').value.trim(),email=$('access-email').value.trim();if(!orderId||!email){$('access-message').textContent='Indica el número de pedido y el correo de compra.';(!orderId?$('access-order'):$('access-email')).focus();return;}
 if(demo){$('access-message').textContent='Petición de acceso simulada. No se ha enviado ningún correo ni registrado datos.';return;}
 const version=viewRequest;lock(true);$('access-message').textContent='Registrando petición…';try{await api('/api/returns/access',{action:'access',body:{orderId,email}});if(version===viewRequest)$('access-message').textContent='Si coincide con un pedido, el vendedor enviará el enlace al correo de compra. El envío no es automático; puedes escribir a Aleix si necesitas ayuda.';}catch(error){if(version===viewRequest)$('access-message').textContent=error.message;}finally{if(version===viewRequest)lock(false);}
});
$('request-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!canRequest())return;const kind=$('return-kind').value,reason=$('return-reason').value.trim();if(!Object.hasOwn(kindLabels,kind))return;
 if(kind!=='withdrawal'&&!reason){$('request-message').textContent='Añade detalles para que Aleix pueda revisar el caso.';$('return-reason').focus();return;}
 if(reason.length>1000){$('request-message').textContent='Los detalles pueden tener hasta 1000 caracteres.';$('return-reason').focus();return;}
 const version=viewRequest;lock(true);$('request-message').textContent='Registrando solicitud…';try{
  const value=(await api('/api/returns/case',{action:'request',body:{kind,reason,expectedVersion:currentCase.version}})).case;
  if(version!==viewRequest)return;
  render(value);showReceipt(value,kind,reason);$('request-message').textContent=demo?'Solicitud de prueba guardada en la demostración compartida. Puedes gestionarla desde el panel.':'Solicitud registrada. Descarga el justificante para conservarla.';$('receipt-title').focus();
 }catch(error){if(version===viewRequest&&!accessLost(error))$('request-message').textContent=error.message+' Los detalles siguen en el formulario. Puedes reintentarlo.';}finally{if(version===viewRequest)lock(false);}
});
$('case-refresh').addEventListener('click',()=>refresh());
$('receipt-download').addEventListener('click',()=>{if(receiptText)download(new Blob([receiptText],{type:'text/plain;charset=utf-8'}),'justificante-devolucion.txt');});
$('label-download').addEventListener('click',async()=>{
 if(busy||!currentCase?.label)return;const version=viewRequest;lock(true);$('label-message').textContent='Preparando descarga…';try{
  if(demo){download(new Blob(['EJEMPLO NO VÁLIDO PARA ENVÍOS\nEsta demostración no es una etiqueta de transporte.'],{type:'text/plain;charset=utf-8'}),'etiqueta-ejemplo-no-valida.txt');}
  else{const response=await fetch('/api/returns/label',{method:'POST',headers:{'X-Return-Token':token,'X-Return-Action':'download'},credentials:'omit',cache:'no-store'});if(!response.ok)throw Object.assign(new Error('No se ha podido descargar la etiqueta. Actualiza el estado o escribe a Aleix.'),{status:response.status});const blob=await response.blob();if(version!==viewRequest)return;const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[blob.type];if(!ext)throw new Error('El archivo no tiene un formato admitido. Escribe a Aleix.');download(blob,'etiqueta-devolucion.'+ext);}
  $('label-message').textContent=demo?'Ejemplo descargado; no es válido para envíos.':'Etiqueta descargada.';
 }catch(error){if(version===viewRequest&&!accessLost(error))$('label-message').textContent=error.message;}finally{if(version===viewRequest)lock(false);}
});
$('demo-order-form').addEventListener('submit',async event=>{event.preventDefault();if(busy||!demo||!session?.ready())return;const id=$('demo-order').value.trim().toUpperCase();if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)){$('demo-order-help').textContent='Indica un número de pedido de prueba válido.';$('demo-order').focus();return;}session.selectOrder(id);return start();});
async function start(){
 const version=++viewRequest;stopPoll();currentCase=null;receiptText='';$('case-panel').hidden=true;$('access-panel').hidden=demo;$('page-message').hidden=true;
 for(const id of ['case-order','case-reply','case-reason','case-code','case-carrier','receipt-text','access-message','request-message','label-message'])$(id).textContent='';
 $('return-reason').value='';$('return-kind').value='withdrawal';
 $('receipt').hidden=true;$('demo-note').hidden=!demo;$('demo-order-panel').hidden=!demo;$('demo-panel-link').hidden=!demo;reasonState();lock(false);
 if(demo){const help=$('case-access-help');if(help)help.textContent='La demostración guarda el acceso en esta pestaña, si el navegador lo permite. Para continuar en otro dispositivo o volver a la sesión, usa el enlace compartido de la barra. La sesión caduca 7 días después de crearse. Comparte solo datos ficticios.';token='';const connected=session?.ready();$('demo-order-fields').disabled=!connected;$('demo-order-help').textContent=connected?'Consulta el número de tu compra de prueba o un pedido de ejemplo como DEMO-001.':'Inicia una demostración desde la barra o pega un enlace compartido para consultar pedidos de prueba.';if(!connected)return;$('demo-order').value=session.orderId()||'';if(!$('demo-order').value)return;}
 if(!demo&&!token){if(fragment){$('page-message').hidden=false;$('page-message').textContent='El enlace no es válido. Solicita un enlace nuevo o escribe a Aleix.';}return;}
 lock(true);$('page-message').hidden=false;$('page-message').textContent='Consultando tu devolución…';try{const value=(await api('/api/returns/case')).case;if(version!==viewRequest)return;render(value);$('page-message').hidden=true;}catch(error){if(version===viewRequest&&!accessLost(error))$('page-message').textContent=error.message+(demo?' Comprueba el número y que estés usando el enlace de la misma demostración.':' Abre de nuevo el enlace del correo o solicita uno nuevo.');}finally{if(version===viewRequest)lock(false);}
}
window.addEventListener('hashchange',()=>{if(!location.hash||demo)return;consumeFragment();return start();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPoll();else schedulePoll();});
if(demo&&session)session.subscribe(()=>start());
start();
