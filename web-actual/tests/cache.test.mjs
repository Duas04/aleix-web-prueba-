import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createWorker} from '../worker/index.mjs';
import {localDatabase} from './database.mjs';
import builtWorker from '../dist/server/index.js';

const asset = text => ({type:'text/plain',data:Buffer.from(text).toString('base64'),etag:`W/"${createHash('sha256').update(text).digest('hex')}"`});
const publicAsset = asset('PUBLIC VERSION ONE');
const assets = {'/index.html':publicAsset,'/app.js':publicAsset,'@admin':asset('PRIVATE'),'/admin/app.js':asset('ADMIN SCRIPT'),'/404.html':asset('MISSING')};
const request = (path='/',headers={},method='GET') => new Request('https://book.example'+path,{headers,method});

test('matching public validators return 304 with no body for GET and HEAD',async()=>{
  const worker=createWorker(assets);
  const first=await worker.fetch(request(),{});
  assert.equal(first.status,200);
  assert.equal(first.headers.get('etag'),publicAsset.etag);
  assert.match(first.headers.get('cache-control'),/must-revalidate/);
  assert.equal(await first.text(),'PUBLIC VERSION ONE');
  for(const method of ['GET','HEAD']) for(const validator of [publicAsset.etag,publicAsset.etag.slice(2),`"older", ${publicAsset.etag}`,'*']) {
    const response=await worker.fetch(request('/',{'if-none-match':validator},method),{});
    assert.equal(response.status,304);
    assert.equal(await response.text(),'');
    assert.equal(response.headers.get('etag'),publicAsset.etag);
    assert.equal(response.headers.get('cache-control'),first.headers.get('cache-control'));
  }
});

test('a stale validator gets the changed public bytes and a new validator',async()=>{
  const changed=asset('PUBLIC VERSION TWO');
  const response=await createWorker({'/index.html':changed}).fetch(request('/',{'if-none-match':publicAsset.etag}),{});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('etag'),changed.etag);
  assert.equal(await response.text(),'PUBLIC VERSION TWO');
});

test('conditional requests cannot cache private content, bypass login, or hide missing pages',async()=>{
  const worker=createWorker(assets), env={DB:localDatabase(),ADMIN_OWNER_EMAIL:'owner@example.test'};
  const headers={'if-none-match':'*'};
  try {
    const anonymous=await worker.fetch(request('/admin',headers),env);
    assert.equal(anonymous.status,302);
    const owner={...headers,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'};
    for(const [path,status] of [['/admin',200],['/admin/app.js',200],['/api/admin/orders',200],['/missing',404]]) {
      const response=await worker.fetch(request(path,owner),env);
      assert.equal(response.status,status);
      assert.equal(response.headers.get('etag'),null);
      assert.match(response.headers.get('cache-control'),/no-store/);
      assert.ok((await response.text()).length>0);
    }
  } finally { env.DB.sqlite.close(); }
});

test('built public assets have content-derived validators, including binary fonts',async()=>{
  const fonts=await(await builtWorker.fetch(request('/fonts.css'),{})).text();
  const fontUrl=fonts.match(/url\(['"]?([^)'"\s]+\.woff2)['"]?\)/)?.[1];
  assert.ok(fontUrl,'test uses a real font from the site');
  const fontPath=new URL(fontUrl,'https://book.example/fonts.css').pathname;
  assert.match(fontPath,/-[a-f0-9]{12}\.woff2$/);
  assert.match((await builtWorker.fetch(request(fontPath),{})).headers.get('cache-control'),/immutable/);
  for(const path of ['/fonts.css','/app.js',fontPath]) {
    const first=await builtWorker.fetch(request(path),{});
    assert.equal(first.status,200);
    const bytes=Buffer.from(await first.arrayBuffer());
    const expected=`W/"${createHash('sha256').update(bytes).digest('hex')}"`;
    assert.equal(first.headers.get('etag'),expected);
    const cached=await builtWorker.fetch(request(path,{'if-none-match':expected}),{});
    assert.equal(cached.status,304);
    assert.equal((await cached.arrayBuffer()).byteLength,0);
  }
});
