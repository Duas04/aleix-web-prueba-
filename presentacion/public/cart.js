// Only product quantities belong in storage. Prices always come from the catalog.
export const CATALOG=Object.freeze({paperback:Object.freeze({name:'Tapa blanda',cents:1500}),hardcover:Object.freeze({name:'Tapa dura',cents:2000})});
export const CART_KEY='fumada-cart-v1';
export const CART_TTL=7*24*60*60*1000;
export function normalizeItems(input){
 const items={};
 if(!input||typeof input!=='object'||Array.isArray(input))return items;
 for(const key of Object.keys(CATALOG)){
  const qty=Object.hasOwn(input,key)?input[key]:0;
  if(Number.isInteger(qty)&&qty>=1&&qty<=10)items[key]=qty;
 }
 return items;
}
export function totals(input){
 const items=normalizeItems(input);
 const units=Object.values(items).reduce((sum,qty)=>sum+qty,0);
 const subtotal=Object.entries(items).reduce((sum,[key,qty])=>sum+CATALOG[key].cents*qty,0);
 const shipping=units?700:0;
 return {units,subtotal,shipping,total:subtotal+shipping};
}
export function loadCart(storage,now=Date.now()){
 try{
  const raw=storage?.getItem(CART_KEY);if(!raw)return {};
  if(raw.length>2048)throw Error('Invalid cart');
  const data=JSON.parse(raw);
  if(data?.version!==1||!Number.isFinite(data.expiresAt)||data.expiresAt<=now||data.expiresAt>now+CART_TTL)throw Error('Expired cart');
  return normalizeItems(data.items);
 }catch{try{storage?.removeItem(CART_KEY);}catch{}return {};}
}
export function saveCart(storage,input,now=Date.now()){
 try{
  if(!storage)return false;
  const items=normalizeItems(input);
  if(!Object.keys(items).length)storage.removeItem(CART_KEY);
  else storage.setItem(CART_KEY,JSON.stringify({version:1,expiresAt:now+CART_TTL,items}));
  return true;
 }catch{return false;}
}
