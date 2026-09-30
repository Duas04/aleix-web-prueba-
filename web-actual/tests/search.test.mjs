import test from 'node:test';
import assert from 'node:assert/strict';
import { listOrders } from '../worker/database.mjs';
import { localDatabase } from './database.mjs';

function seed(db,id,name,email='fixture@example.test',payment='paid',created=10){
  db.sqlite.prepare(`INSERT INTO orders (id,created_at,customer_name,email,recipient,address1,city,postal_code,country,edition,quantity,subtotal,shipping,total,payment_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,created,name,email,'Persona','Calle','Ciudad','00000','ES','paperback',1,1500,700,2200,payment);
}
const search=(DB,q,extra={})=>listOrders({DB},new URL('https://book.example/api/admin/orders?'+new URLSearchParams({q,...extra})));

test('Spanish names match case, accents and composed/decomposed spellings without altering stored text',async()=>{
  const db=localDatabase();
  const names=['Álvaro Érica Íñigo Óscar Úrsula Ü Ñ','álvaro érica íñigo óscar úrsula ü ñ','Álvaro Érica Íñigo Óscar Úrsula Ü Ñ'.normalize('NFD')];
  names.forEach((name,i)=>seed(db,'order_'+i,name));
  for(const q of ['álvaro','ALVARO','érica','INIGO','óscar','ursula','ü','ñ','ÁLVARO'.normalize('NFD')]){
    const data=await search(db,q);assert.equal(data.count,3,q);
  }
  assert.deepEqual((await search(db,'alvaro')).orders.map(o=>o.customer_name),[...names].reverse());
  db.sqlite.close();
});

test('normalized search filters/counts before pagination, including email and ID with bound literal queries',async()=>{
  const db=localDatabase();
  for(let i=0;i<25;i++)seed(db,'match_'+String(i).padStart(2,'0'),'Álvaro',undefined,'paid',i);
  seed(db,'unpaid','Álvaro',undefined,'pending',99);
  seed(db,'unrelated','Otro',undefined,'paid',100);
  seed(db,'email','Otro','ÉRICA@example.test');
  seed(db,'PEDIDO-Ñ','Otro');
  const first=await search(db,'alvaro',{filter:'pending'}),second=await search(db,'alvaro',{filter:'pending',page:'2'});
  assert.equal(first.count,25);assert.equal(second.count,25);assert.equal(first.orders.length,20);assert.equal(second.orders.length,5);
  assert.deepEqual([...first.orders,...second.orders].map(o=>o.id),Array.from({length:25},(_,i)=>'match_'+String(24-i).padStart(2,'0')));
  assert.equal((await search(db,'erica@')).count,1);assert.equal((await search(db,'pedido-n')).count,1);
  for(const q of ["' OR 1=1--",'%', '_missing'])assert.equal((await search(db,q)).count,0);
  db.sqlite.close();
});
