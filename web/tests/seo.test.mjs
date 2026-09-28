import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
const call=(path,headers={},method='GET')=>worker.fetch(new Request('https://book.example'+path,{headers,method}),{});
test('search metadata identifies the real book without advertising an active checkout',async()=>{
 const html=await(await call('/')).text();
 assert.match(html,/<title>Fumada XXL de Aleix \| Libro de meditación<\/title>/);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 const book=data['@graph'].find(item=>item['@type']==='Book');
 assert.equal(book.name,'Fumada XXL');assert.equal(book.author.name,'Aleix');
 assert.equal(book.url,'https://prueba-aleix.com/#el-libro');
 assert.equal(book.offers,undefined);assert.equal(book.isbn,undefined);assert.equal(book.aggregateRating,undefined);
 assert.match(html,/rel="canonical" href="https:\/\/prueba-aleix.com\/"/);
});
test('sitemap contains the canonical public page and robots lets noindex pages be read',async()=>{
 const sitemap=await call('/sitemap.xml');assert.equal(sitemap.status,200);
 assert.match(sitemap.headers.get('content-type'),/xml/);
 const xml=await sitemap.text();assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),['https://prueba-aleix.com/']);
 const robots=await call('/robots.txt');assert.equal(robots.status,200);const text=await robots.text();
 assert.match(text,/Sitemap: https:\/\/prueba-aleix.com\/sitemap.xml/);assert.doesNotMatch(text,/Disallow:\s*\//);

});
test('only known duplicate routes redirect, preserving queries and private access',async()=>{
 for(const method of ['GET','HEAD']) {
  const r=await call('/index.html?source=test',{},method);assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/?source=test');
 }
 assert.equal((await call('/aviso-legal.html/')).status,404);
 assert.equal((await call('/api/admin/orders')).status,401);
 assert.equal((await call('/admin')).status,302);
});
test('responsive cover is smaller, typed correctly and cacheable by its content version',async()=>{
 const html=await(await call('/')).text();
 const image=html.match(/<img[^>]*fumada-xxl[^>]*>/)[0];
 const paths=[...image.matchAll(/assets\/fumada-xxl-\d+-[a-f0-9]{12}\.webp/g)].map(m=>'/'+m[0]);
 assert.equal(new Set(paths).size,3);assert.match(image,/srcset=/);assert.match(image,/sizes=/);assert.match(image,/fetchpriority="high"/);
 for(const path of new Set(paths)){const r=await call(path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/webp/);assert.match(r.headers.get('cache-control'),/immutable/);assert.ok((await r.arrayBuffer()).byteLength<200000);}
 const old=await call('/assets/fumada-xxl-aleix.png');assert.equal(old.status,301);assert.match(old.headers.get('location'),/\.webp$/);
 assert.equal((await call('/assets/fonts/font-1.ttf')).status,404);
 assert.ok(readFileSync('dist/server/index.js').length<1500000,'unused originals excluded from Worker');
});
