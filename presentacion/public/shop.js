import {CATALOG, CART_KEY, loadCart, saveCart, totals} from './cart.js';

const dialog=document.querySelector('#order-dialog');
if(dialog){
 const $=selector=>dialog.querySelector(selector);
 const form=$('#order-form');
 const cartButton=document.querySelector('#cart-open');
 const fields=[...form.querySelectorAll('[data-customer-field]')];
 const money=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
 let storage;try{storage=window.localStorage;}catch{}
 let items=loadCart(storage),step='cart',opener;
 const titles={cart:'Tu carrito',details:'Datos de envío',review:'Revisa tu selección'};
 const format=cents=>money.format(cents/100);
 const announce=text=>{$('#order-announcement').textContent=text;};
 function go(next,{focus=true}={}){
  if(next==='details')window.dispatchEvent(new CustomEvent('fumada-cart-details'));
  step=next;
  dialog.querySelectorAll('[data-step]').forEach(panel=>{panel.hidden=panel.dataset.step!==next;});
  $('#order-title').textContent=titles[next];
  dialog.querySelectorAll('[data-step-label]').forEach(label=>{
   if(label.dataset.stepLabel===next)label.setAttribute('aria-current','step');else label.removeAttribute('aria-current');
  });
  dialog.scrollTop=0;
  if(focus&&dialog.open)$('#order-title').focus();
 }
 function clearDetails(){
  form.reset();
  for(const field of fields){field.setCustomValidity('');field.removeAttribute('aria-invalid');$(`#${field.id}-error`).textContent='';}
  $('#form-error').hidden=true;
  $('#review-address').replaceChildren();$('#review-email').textContent='';$('#review-items').replaceChildren();
 }
 function render(){
  const cost=totals(items);
  cartButton.hidden=false;
  document.querySelector('#cart-count').textContent=String(cost.units);
  cartButton.setAttribute('aria-label',`Abrir carrito, ${cost.units} ${cost.units===1?'libro':'libros'}`);
  $('#cart-empty').hidden=!!cost.units;$('#cart-filled').hidden=!cost.units;
  for(const [key,item]of Object.entries(CATALOG)){
   const row=$(`[data-cart-row="${key}"]`),qty=items[key]||0;
   row.hidden=!qty;row.querySelector('select').value=String(qty||1);
   row.querySelector('[data-line-total]').textContent=format(qty*item.cents);
  }
  $('#order-subtotal').textContent=format(cost.subtotal);$('#order-shipping').textContent=format(cost.shipping);$('#order-total').textContent=format(cost.total);
  $('#cart-continue').disabled=!cost.units;
 }
 function persist(){
  const saved=saveCart(storage,items);
  $('#cart-storage-note').textContent=saved?'Solo guardamos los libros y cantidades en este navegador durante 7 días desde el último cambio. Puedes vaciar el carrito cuando quieras.':'Tu navegador no permite guardar el carrito. Puedes usarlo, pero se perderá al recargar la página.';
 }
 function open(source){
  opener=source;go('cart',{focus:false});render();
  if(!dialog.open)dialog.showModal();$('#order-title').focus();
 }
 document.querySelectorAll('[data-edition]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.edition;if(!Object.hasOwn(CATALOG,key))return;
  const qty=items[key]||0;if(qty<10){items[key]=qty+1;persist();}
  if(!dialog.open)open(button);else{go('cart',{focus:false});render();}
  const units=totals(items).units;
  announce(qty<10?`${CATALOG[key].name} añadida. ${units} ${units===1?'libro':'libros'} en el carrito.`:'Puedes seleccionar hasta 10 ejemplares por formato.');
 }));
 cartButton.addEventListener('click',()=>open(cartButton));
 $('#cart-lines').addEventListener('change',event=>{
  const key=event.target.dataset.quantity;if(!Object.hasOwn(CATALOG,key))return;
  const qty=Number(event.target.value);if(!Number.isInteger(qty)||qty<1||qty>10)return;
  items[key]=qty;persist();render();announce(`Total estimado con envío: ${format(totals(items).total)}.`);
 });
 $('#cart-lines').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove]');if(!button)return;
  const key=button.dataset.remove;if(!Object.hasOwn(CATALOG,key))return;
  delete items[key];persist();render();
  const remaining=$('[data-cart-row]:not([hidden]) select');(remaining||$('#cart-empty-heading')).focus();
  announce(`${CATALOG[key].name} eliminada del carrito.`);
 });
 $('#cart-clear').addEventListener('click',()=>{items={};clearDetails();persist();render();$('#cart-empty-heading').focus();announce('Carrito vacío.');});
 $('#cart-continue').addEventListener('click',()=>{if(totals(items).units)go('details');});
 dialog.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.back)));
 function validateField(field){
  field.setCustomValidity('');let error='';
  if(field.required&&!field.value.trim())error='Completa este campo.';
  else if(field.validity.typeMismatch)error='Escribe un correo válido, por ejemplo nombre@dominio.com.';
  else if(field.value.trim().length>(field.maxLength>0?field.maxLength:254))error='El texto es demasiado largo.';
  else if(field.validity.tooShort)error='Revisa este dato: es demasiado corto.';
  field.setCustomValidity(error);
  if(error)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');
  $(`#${field.id}-error`).textContent=error;return !error;
 }
 for(const field of fields)field.addEventListener('input',()=>{if(field.hasAttribute('aria-invalid'))validateField(field);});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(step!=='details'||!totals(items).units)return;
  let firstInvalid;
  for(const field of fields){field.value=field.value.trim();if(!validateField(field)&&!firstInvalid)firstInvalid=field;}
  $('#form-error').hidden=!firstInvalid;if(firstInvalid){firstInvalid.focus();return;}
  const value=name=>form.elements.namedItem(name).value.trim();
  $('#review-email').textContent=value('email');
  const address=[value('fullName'),value('address'),value('addressExtra'),`${value('postalCode')} · ${value('city')}`,value('region'),value('country')].filter(Boolean);
  $('#review-address').replaceChildren(...address.map(text=>{const line=document.createElement('span');line.textContent=text;return line;}));
  $('#review-items').replaceChildren(...Object.entries(items).map(([key,qty])=>{
   const li=document.createElement('li'),name=document.createElement('span'),price=document.createElement('strong');
   name.textContent=`${qty} × ${CATALOG[key].name}`;price.textContent=format(qty*CATALOG[key].cents);li.append(name,price);return li;
  }));
  const cost=totals(items);$('#review-total').textContent=format(cost.total);$('#review-shipping').textContent=format(cost.shipping);go('review');
  window.dispatchEvent(new CustomEvent('fumada-cart-reviewed',{detail:{items:{...items}}}));
 });
 // No payment integration: no address, email or order leaves this page.
 dialog.querySelectorAll('[data-close-cart]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
 dialog.addEventListener('close',()=>{clearDetails();go('cart',{focus:false});opener?.focus();});
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
 });
 window.addEventListener('storage',event=>{
  if(event.key!==CART_KEY&&event.key!==null)return;
  items=loadCart(storage);render();if(dialog.open){go('cart');announce('Carrito actualizado desde otra pestaña.');}
 });
 window.addEventListener('pageshow',event=>{if(event.persisted){clearDetails();items=loadCart(storage);render();go('cart',{focus:false});}});
 render();
 document.querySelectorAll('[data-edition]').forEach(button=>{button.disabled=false;});
 const unavailable=document.querySelector('#cart-unavailable');if(unavailable)unavailable.hidden=true;
 if(!storage)$('#cart-storage-note').textContent='Tu navegador no permite guardar el carrito. Se perderá al recargar la página.';
}
