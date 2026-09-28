import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG, CART_KEY, CART_TTL, normalizeItems, totals, loadCart, saveCart} from '../dist/cart.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
test('mixed editions charge shipping once and an empty cart costs zero',()=>{
 assert.deepEqual(totals({paperback:1,hardcover:2}),{units:3,subtotal:5500,shipping:700,total:6200});
 assert.deepEqual(totals({}),{units:0,subtotal:0,shipping:0,total:0});
 assert.equal(totals({hardcover:2}).total,4700);
 assert.equal(CATALOG.paperback.cents,1500);
});
test('storage is untrusted: unknown keys and invalid quantities cannot affect totals',()=>{
 const dirty=JSON.parse('{"paperback":2,"hardcover":-1,"constructor":99,"__proto__":{"cents":1},"email":"private@example.com","total":1}');
 assert.deepEqual(normalizeItems(dirty),{paperback:2});
 for(const value of [null,[],5,'invalid'])assert.deepEqual(normalizeItems(value),{});
 for(const qty of [-2,0,1.5,11,'2',null])assert.deepEqual(normalizeItems({paperback:qty}),{});
});
test('cart persists only known quantities and expires; clearing removes its storage',()=>{
 const store=memory(),now=1000;
 assert.equal(saveCart(store,{paperback:2,email:'private@example.com',address:'secret'},now),true);
 const raw=store.getItem(CART_KEY);assert.doesNotMatch(raw,/private|secret|address|email|cents|total/);
 assert.deepEqual(loadCart(store,now+1),{paperback:2});
 assert.deepEqual(loadCart(store,now+CART_TTL),{});assert.equal(store.getItem(CART_KEY),null);
 saveCart(store,{hardcover:1},now);saveCart(store,{},now);assert.equal(store.getItem(CART_KEY),null);
});
test('corrupt, oversized, future, or unavailable storage fails safely',()=>{
 const store=memory();
 for(const raw of ['{','x'.repeat(3000),JSON.stringify({version:1,expiresAt:1e20,items:{paperback:1}})]){
  store.setItem(CART_KEY,raw);assert.deepEqual(loadCart(store,1000),{});
 }
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.deepEqual(loadCart(blocked),{});assert.equal(saveCart(blocked,{paperback:1}),false);
});
