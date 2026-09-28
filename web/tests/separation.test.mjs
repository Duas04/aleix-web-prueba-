import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('production copy excludes demonstration and protects the owner panel',async()=>{
 const call=p=>worker.fetch(new Request('https://book.example'+p),{});
 for(const p of ['/demo','/demo/','/demo/app.js'])assert.equal((await call(p)).status,404);
 assert.equal((await call('/admin')).status,302);
 assert.equal((await call('/api/admin/orders')).status,401);
 assert.doesNotMatch(await(await call('/')).text(),/href="\/demo"/);
 assert.doesNotMatch(await(await call('/admin/app.js')).text(),/DEMO-004|tapa doblada|demoApi/);
});
