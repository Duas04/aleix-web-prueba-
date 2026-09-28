'use strict';
const $=id=>document.getElementById(id);
let fragment='',token='';
function consumeFragment(){fragment=location.hash;if(fragment)history.replaceState(null,'',location.pathname+location.search);token=new URLSearchParams(fragment.slice(1)).get('token')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))token='';}
consumeFragment();
const demo=new URLSearchParams(location.search).get('demo')==='1';
let currentCase=null,busy=false,receiptText='',viewRequest=0;
const statusLabels={none:'Sin solicitud',requested:'Solicitud registrada',reviewing:'En revisión',approved:'Devolución aprobada',received:'Libro recibido',closed:'Gestión cerrada',rejected:'Solicitud rechazada'};
const kindLabels={withdrawal:'Desistimiento',damaged:'Libro dañado',wrong:'Libro equivocado',other:'Otra consulta'};
const canRequest=()=>currentCase&&['none','closed','rejected'].includes(currentCase.status);
function lock(value){busy=value;$('access-fields').disabled=value;$('request-fields').disabled=value;$('label-download').disabled=value;$('case-refresh').disabled=value;$('demo-approved').disabled=value;}
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function api(path,{action,body}={}){
 const headers={...(token?{'X-Return-Token':token}:{}),...(action?{'X-Return-Action':action}:{})};
 if(body)headers['Content-Type']='application/json';
 const response=await fetch(path,{method:action?'POST':'GET',headers,credentials:'omit',cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json();}catch{throw new Error('No se ha podido cargar la información. Inténtalo de nuevo o escribe a Aleix.');}
 if(!response.ok)throw new Error(data.error||'No se ha podido completar la solicitud. Inténtalo de nuevo o pide un enlace nuevo.');return data;
}
function render(value){
 currentCase=value;$('access-panel').hidden=true;$('case-panel').hidden=false;$('case-order').textContent=value.orderId;$('case-status').textContent=statusLabels[value.status]||'En revisión';
 $('case-reason').textContent=value.reason?'Tu solicitud: '+value.reason:'';
 $('case-reply').textContent=value.reply||'';$('case-carrier').textContent=value.carrier||'Pendiente de indicar';$('case-code').textContent=value.code||'Pendiente de indicar';
 $('seller-response').hidden=!(value.reply||value.carrier||value.code||value.label);$('label-information').hidden=!(value.carrier||value.code||value.label);
 $('label-download').hidden=!value.label;$('label-help').textContent=value.label?(demo?'Archivo de demostración: no es válido para envíos.':'Sigue las indicaciones de Aleix antes de entregar el paquete. La etiqueta no implica un reembolso.'):'Todavía no hay una etiqueta disponible.';
 $('request-form').hidden=!canRequest();
 $('request-message').textContent=canRequest()?'':'La solicitud está registrada. Puedes actualizar el estado y consultar la respuesta de Aleix.';
 if(value.submittedAt!=null&&value.status!=='none'&&Object.hasOwn(kindLabels,value.kind))showReceipt(value);
}
function showReceipt(value,kind=value.kind,reason=value.reason){
 const timestamp=new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeStyle:'short'}).format(new Date(value.submittedAt??Date.now()));
 receiptText=`${demo?'DEMOSTRACIÓN — SIN SOLICITUD REAL\n':''}Fumada XXL · Justificante de solicitud\nPedido: ${value.orderId}\nFecha de registro${value.submittedAt!=null?'':' en este navegador'}: ${timestamp}\nTipo: ${kindLabels[kind]}\nDetalles: ${reason||'Desistimiento sin motivo indicado'}\nEstado: ${statusLabels[value.status]}\n\nEsta solicitud no devuelve dinero. No se ha enviado un correo automático.\nContacto: theshoz@gmail.com`;
 $('receipt-text').textContent=receiptText;$('receipt').hidden=false;
}
function reasonState(){const optional=$('return-kind').value==='withdrawal';$('return-reason').required=!optional;$('reason-caption').textContent=optional?'(opcional para desistimiento)':'(necesarios para revisar este caso)';}
async function refresh(){if(busy||!currentCase)return;const version=viewRequest;lock(true);$('request-message').textContent='Actualizando…';try{const value=demo?currentCase:(await api('/api/returns/case')).case;if(version===viewRequest)render(value);}catch(error){if(version===viewRequest)$('request-message').textContent=error.message;}finally{if(version===viewRequest)lock(false);}}
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
  const value=demo?{...currentCase,status:'requested',kind,reason,version:currentCase.version+1}:(await api('/api/returns/case',{action:'request',body:{kind,reason,expectedVersion:currentCase.version}})).case;
  if(version!==viewRequest)return;
  render(value);showReceipt(value,kind,reason);$('request-message').textContent=demo?'Solicitud simulada. No se ha enviado al vendedor.':'Solicitud registrada. Descarga el justificante para conservarla.';$('receipt-title').focus();
 }catch(error){if(version===viewRequest)$('request-message').textContent=error.message+' Los detalles siguen en el formulario. Puedes reintentarlo.';}finally{if(version===viewRequest)lock(false);}
});
$('case-refresh').addEventListener('click',refresh);
$('receipt-download').addEventListener('click',()=>{if(receiptText)download(new Blob([receiptText],{type:'text/plain;charset=utf-8'}),'justificante-devolucion.txt');});
$('label-download').addEventListener('click',async()=>{
 if(busy||!currentCase?.label)return;const version=viewRequest;lock(true);$('label-message').textContent='Preparando descarga…';try{
  if(demo){download(new Blob(['EJEMPLO NO VÁLIDO PARA ENVÍOS\nEsta demostración no es una etiqueta de transporte.'],{type:'text/plain;charset=utf-8'}),'etiqueta-ejemplo-no-valida.txt');}
  else{const response=await fetch('/api/returns/label',{method:'POST',headers:{'X-Return-Token':token,'X-Return-Action':'download'},credentials:'omit',cache:'no-store'});if(!response.ok)throw new Error('No se ha podido descargar la etiqueta. Actualiza el estado o escribe a Aleix.');const blob=await response.blob();if(version!==viewRequest)return;const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[blob.type];if(!ext)throw new Error('El archivo no tiene un formato admitido. Escribe a Aleix.');download(blob,'etiqueta-devolucion.'+ext);}
  $('label-message').textContent=demo?'Ejemplo descargado; no es válido para envíos.':'Etiqueta descargada.';
 }catch(error){if(version===viewRequest)$('label-message').textContent=error.message;}finally{if(version===viewRequest)lock(false);}
});
$('demo-approved').addEventListener('click',()=>{if(!demo||busy)return;render({...currentCase,status:'approved',reply:'Ejemplo de respuesta: protege el libro y espera las indicaciones de Aleix antes de enviarlo.',carrier:'Transportista ficticio',code:'EJEMPLO SIN VALIDEZ',label:{type:'text/plain',size:90}});$('request-message').textContent='Estado aprobado simulado. No corresponde a una solicitud real.';});
async function start(){
 const version=++viewRequest;currentCase=null;receiptText='';$('case-panel').hidden=true;$('access-panel').hidden=false;$('page-message').hidden=true;
 for(const id of ['case-order','case-reply','case-reason','case-code','case-carrier','receipt-text','access-message','request-message','label-message'])$(id).textContent='';
 $('return-reason').value='';$('return-kind').value='withdrawal';
 $('receipt').hidden=true;$('demo-note').hidden=!demo;$('demo-approved').hidden=!demo;reasonState();lock(false);
 if(demo){token='';render({orderId:'DEMO-DEVOLUCION',status:'none',kind:'',reason:'',reply:'',carrier:'',code:'',label:null,version:0,paymentStatus:'paid'});return;}
 if(!token){if(fragment){$('page-message').hidden=false;$('page-message').textContent='El enlace no es válido. Solicita un enlace nuevo o escribe a Aleix.';}return;}
 lock(true);$('page-message').hidden=false;$('page-message').textContent='Consultando tu devolución…';try{const value=(await api('/api/returns/case')).case;if(version!==viewRequest)return;render(value);$('page-message').hidden=true;}catch(error){if(version===viewRequest)$('page-message').textContent=error.message+' Abre de nuevo el enlace del correo o solicita uno nuevo.';}finally{if(version===viewRequest)lock(false);}
}
window.addEventListener('hashchange',()=>{if(!location.hash)return;consumeFragment();return start();});
start();
