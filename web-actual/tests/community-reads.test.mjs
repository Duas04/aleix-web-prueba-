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
 return {DB,insert,call:(path,{ip='192.0.2.1',owner=false,method='GET',body}={})=>handleCommunity(new Request(origin+path,{method,headers:{'CF-Connecting-IP':ip,...(owner?{Cookie:'__Host-community='+token}:{}),...(body?{'Content-Type':'application/json',Origin:origin,'X-Community-Action':'write'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env)};
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
test('offsets beyond 10000 fail clearly for topics, moderation and replies',async t=>{
 const {DB,call}=await fixture();t.after(()=>DB.sqlite.close());
 for(const path of ['/api/community/posts?offset=10020','/api/community/moderation?offset=10020','/api/community/posts/public?offset=10050']){
  const response=await call(path,{owner:true});assert.equal(response.status,400,path);assert.match((await response.json()).error,/10.?000|límite/i);
 }
});
test('the last allowed topic page does not promise an unreachable next page',async t=>{
 const {DB,insert,call}=await fixture();t.after(()=>DB.sqlite.close());
 DB.sqlite.exec('BEGIN');for(let i=0;i<10021;i++)insert.run('bulk-'+String(i).padStart(5,'0'),'owner','Topic '+i,'Body','published',i+2);DB.sqlite.exec('COMMIT');
 const result=await(await call('/api/community/posts?sort=new&offset=10000')).json();
 assert.equal(result.posts.length,20);assert.equal(result.hasMore,false);
});
test('thread replies are returned in pages of twenty',async t=>{
 const {DB,call}=await fixture();t.after(()=>DB.sqlite.close());
 const insert=DB.sqlite.prepare('INSERT INTO community_posts(id,parent_id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?,?)');
 for(let i=0;i<21;i++)insert.run('reply-'+i,'public','owner','','Reply '+i,'published',i+2);
 const first=await(await call('/api/community/posts/public')).json();
 assert.equal(first.replies.length,20);assert.equal(first.hasMore,true);
 const second=await(await call('/api/community/posts/public?offset=20')).json();
 assert.equal(second.replies.length,1);assert.equal(second.hasMore,false);
});
test('owner reports paginate through 51 notices without skipping after resolving an earlier notice',async t=>{
 const {DB,call}=await fixture();t.after(()=>DB.sqlite.close());
 const insert=DB.sqlite.prepare('INSERT INTO community_reports(id,post_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)');
 for(let i=0;i<51;i++)insert.run('report-'+String(i).padStart(2,'0'),'public','owner','Reason '+i,10+Math.floor(i/2));
 assert.equal((await call('/api/community/reports')).status,403);
 const first=await(await call('/api/community/reports',{owner:true})).json();
 assert.deepEqual(first.reports.map(row=>row.id),Array.from({length:20},(_,i)=>'report-'+String(i).padStart(2,'0')));
 assert.equal(first.hasMore,true);assert.match(first.nextCursor,/^[A-Za-z0-9_-]+$/);
 const resolved=await call('/api/community/reports/resolve',{owner:true,method:'POST',body:{id:'report-00',resolution:'Revisado'}});assert.equal(resolved.status,200);
 const second=await(await call('/api/community/reports?cursor='+encodeURIComponent(first.nextCursor),{owner:true})).json();
 assert.deepEqual(second.reports.map(row=>row.id),Array.from({length:20},(_,i)=>'report-'+String(i+20).padStart(2,'0')));
 assert.equal(second.hasMore,true);
 const third=await(await call('/api/community/reports?cursor='+encodeURIComponent(second.nextCursor),{owner:true})).json();
 assert.deepEqual(third.reports.map(row=>row.id),Array.from({length:11},(_,i)=>'report-'+String(i+40).padStart(2,'0')));
 assert.equal(third.hasMore,false);assert.equal(third.nextCursor,null);
 for(const cursor of ['%%%','e30','a'.repeat(257)]){
  const response=await call('/api/community/reports?cursor='+encodeURIComponent(cursor),{owner:true});assert.equal(response.status,400,cursor);
 }
});
