import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './database.mjs';
import {handleCommunity,communityHash} from '../worker/community.mjs';
const origin='https://book.example';
async function fixture(){
 const DB=localDatabase(),token='o'.repeat(43);
 DB.sqlite.prepare('INSERT INTO community_users(id,google_sub,email,alias,accepted_at,created_at) VALUES(?,?,?,?,?,?)').run('owner','owner-sub','owner@example.test','Owner',1,1);
 DB.sqlite.prepare('INSERT INTO community_owner VALUES(1,?)').run('owner');
 DB.sqlite.prepare('INSERT INTO community_sessions VALUES(?,?,?)').run(await communityHash(token),'owner',Date.now()+86400000);
 const env={DB,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',COMMUNITY_ORIGIN:origin};
 const insert=DB.sqlite.prepare('INSERT INTO community_posts(id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?)');
 insert.run('public','owner','Public question','Readable body','published',1);
 return {DB,insert,call:(path,{ip='192.0.2.1',owner=false}={})=>handleCommunity(new Request(origin+path,{headers:{'CF-Connecting-IP':ip,...(owner?{Cookie:'__Host-community='+token}:{})}}),env)};
}
test('public list and thread reads share a bounded IP budget, recover and isolate other visitors',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const {DB,call}=await fixture();t.after(()=>DB.sqlite.close());
 for(let i=0;i<120;i++)assert.equal((await call(i%2?'/api/community/posts/public':'/api/community/posts?sort=new')).status,200);
 const blocked=await call('/api/community/posts/public');assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');
 assert.match(blocked.headers.get('cache-control'),/no-store/);
 assert.equal((await call('/api/community/posts',{ip:'192.0.2.2'})).status,200);
 now+=60001;assert.equal((await call('/api/community/posts/public')).status,200);
});
test('search has its own tighter budget and cannot bypass it with sort, case or alternate offsets',async t=>{
 const {DB,call}=await fixture();t.after(()=>DB.sqlite.close());
 for(let i=0;i<30;i++)assert.equal((await call('/api/community/posts?q='+encodeURIComponent(i%2?'BODY':'body')+'&sort=new&offset='+i)).status,200);
 assert.equal((await call('/api/community/posts?q=public&sort=activity')).status,429);
 assert.equal((await call('/api/community/posts?sort=new')).status,200);
});
test('moderation exposes all pending contributions in bounded pages, with privacy and stable order',async t=>{
 const {DB,insert,call}=await fixture();t.after(()=>DB.sqlite.close());
 for(let i=0;i<51;i++)insert.run('pending-'+String(i).padStart(2,'0'),'owner','Pending '+i,'Awaiting approval','pending',i+2);
 assert.equal((await call('/api/community/moderation')).status,403);
 const ids=[];
 for(const [offset,expected,more]of [[0,20,true],[20,20,true],[40,11,false]]){
  const response=await call('/api/community/moderation?offset='+offset,{owner:true});assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.posts.length,expected);assert.equal(result.hasMore,more);
  ids.push(...result.posts.map(post=>post.id));assert.ok(result.posts.every(post=>post.status==='pending'));
 }
 assert.equal(new Set(ids).size,51);assert.equal(ids[0],'pending-00');assert.equal(ids.at(-1),'pending-50');
});
