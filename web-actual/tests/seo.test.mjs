import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
const call=(path,headers={},method='GET')=>worker.fetch(new Request('https://book.example'+path,{headers,method}),{});
test('search metadata identifies the real book without advertising an active checkout',async()=>{
 const html=await(await call('/')).text();
 assert.match(html,/<title>Donde siempre estuviste de Aleix \| Libro de meditación<\/title>/);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 const book=data['@graph'].find(item=>item['@type']==='Book');
 assert.equal(book.name,'Donde siempre estuviste');assert.equal(book.author.name,'Aleix');
 assert.equal(book.url,'https://prueba-aleix.com/#el-libro');
 assert.equal(book.offers,undefined);assert.equal(book.isbn,undefined);assert.equal(book.aggregateRating,undefined);
 assert.match(html,/rel="canonical" href="https:\/\/prueba-aleix.com\/"/);
});
test('sitemap contains the canonical public page and robots lets noindex pages be read',async()=>{
 const sitemap=await call('/sitemap.xml');assert.equal(sitemap.status,200);
 assert.match(sitemap.headers.get('content-type'),/xml/);
 const xml=await sitemap.text();assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),['https://prueba-aleix.com/','https://prueba-aleix.com/comunidad','https://prueba-aleix.com/condiciones-de-venta','https://prueba-aleix.com/aviso-legal','https://prueba-aleix.com/privacidad','https://prueba-aleix.com/cookies','https://prueba-aleix.com/normas-comunidad']);
 const robots=await call('/robots.txt');assert.equal(robots.status,200);const text=await robots.text();
 assert.match(text,/Sitemap: https:\/\/prueba-aleix.com\/sitemap.xml/);assert.doesNotMatch(text,/Disallow:\s*\//);
 const demo=await call('/propietario');assert.match(demo.headers.get('x-robots-tag'),/noindex/);
 assert.match(demo.headers.get('cache-control'),/no-store/);assert.equal(demo.headers.get('etag'),null);
 for(const path of ['/comunidad','/privacidad','/condiciones-de-venta']){
  const response=await call(path,{'if-none-match':'*'});assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),null);assert.match(response.headers.get('cache-control'),/no-store/);
 }
});
test('only known duplicate routes redirect, preserving queries and private access',async()=>{
 for(const method of ['GET','HEAD']) {
  const r=await call('/index.html?source=test',{},method);assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/?source=test');
 }
 assert.equal((await call('/aviso-legal.html/')).status,404);
 assert.equal((await call('/api/admin/orders')).status,404);
 assert.equal((await call('/propietario')).status,302);
});
test('responsive cover is smaller, typed correctly and cacheable by its content version',async()=>{
 const html=await(await call('/')).text();
 const image=html.match(/<img[^>]*donde-siempre-estuviste[^>]*>/)[0];
 const paths=[...image.matchAll(/assets\/donde-siempre-estuviste-\d+-[a-f0-9]{12}\.webp/g)].map(m=>'/'+m[0]);
 assert.equal(new Set(paths).size,3);assert.match(image,/srcset=/);assert.match(image,/sizes=/);assert.match(image,/fetchpriority="high"/);
 for(const path of new Set(paths)){const r=await call(path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/webp/);assert.match(r.headers.get('cache-control'),/immutable/);assert.ok((await r.arrayBuffer()).byteLength<200000);}
 const old=await call('/assets/donde-siempre-estuviste-aleix.png');assert.equal(old.status,404);
 assert.equal((await call('/assets/fonts/font-1.ttf')).status,404);
 assert.ok(readFileSync('dist/server/index.js').length<1500000,'unused originals excluded from Worker');
});

test('every public page has specific share metadata and an accessible brand image',async()=>{
 for(const path of ['/','/comunidad','/privacidad','/cookies','/aviso-legal','/normas-comunidad','/condiciones-de-venta']){
  const html=await(await call(path)).text(),url='https://prueba-aleix.com'+path;
  const value=name=>html.match(new RegExp('<meta (?:property|name)="'+name+'" content="([^\"]*)"'))?.[1];
  assert.equal(value('og:url'),url);assert.ok(value('og:title'));assert.ok(value('og:description'));assert.equal(value('twitter:card'),'summary_large_image');
  const image=new URL(value('og:image'));assert.equal(image.origin,'https://prueba-aleix.com');const response=await call(image.pathname);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image/);
 }
});
