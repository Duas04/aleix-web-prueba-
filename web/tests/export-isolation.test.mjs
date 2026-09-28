import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('private export omits public demo routes and activation while retaining the real portal',async()=>{
 const call=path=>worker.fetch(new Request('https://book.example'+path),{});
 for(const path of ['/demo','/demo/app.js','/api/demo/session','/demo-session.js'])assert.equal((await call(path)).status,404,path);
 const html=await(await call('/?demo=1')).text();assert.doesNotMatch(html,/<script src="\/demo-/);
 const buyer=await(await call('/devoluciones?demo=1')).text();assert.doesNotMatch(buyer,/<script src="\/demo-/);
 assert.match(await(await call('/returns.js')).text(),/const demo=false;/);
 assert.equal((await call('/admin')).status,302);assert.equal((await call('/api/admin/orders')).status,401);
});
