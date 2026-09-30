import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMetrics} from '../worker/metrics.mjs';
import {communityHash} from '../worker/community.mjs';
import {localDatabase} from './database.mjs';

const DAY=86400000;
const FIXED=Date.UTC(2026,8,30,18);
const iso=offset=>new Date(FIXED+offset*DAY).toISOString().slice(0,10);
const at=offset=>Date.UTC(2026,8,30+offset);
const TOKEN='m'.repeat(43);
const READER_TOKEN='r'.repeat(43);
const get=(suffix='',cookie=TOKEN)=>new Request('https://book.example/api/site-metrics'+suffix,{headers:cookie?{Cookie:'__Host-community='+cookie}:{}});

async function fixture(){
 const DB=localDatabase(),sql=DB.sqlite;
 sql.prepare('INSERT INTO community_users(id,google_sub,email,created_at) VALUES(?,?,?,?)').run('owner','sub-owner','owner-secret@example.test',1);
 sql.prepare('INSERT INTO community_users(id,google_sub,email,created_at) VALUES(?,?,?,?)').run('reader','sub-reader','reader-secret@example.test',1);
 sql.prepare('INSERT INTO community_owner(slot,user_id) VALUES(1,?)').run('owner');
 sql.prepare('INSERT INTO community_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await communityHash(TOKEN),'owner',FIXED+DAY);
 sql.prepare('INSERT INTO community_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await communityHash(READER_TOKEN),'reader',FIXED+DAY);
 const metric=(offset,event='view',page='home',count=1)=>sql.prepare('INSERT INTO site_metrics(day,event,page,count) VALUES(?,?,?,?)').run(iso(offset),event,page,count);
 const parent=sql.prepare('INSERT INTO community_posts(id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?)');
 parent.run('parent','reader','Older topic','Parent body','published',at(-100));
 let sequence=0;
 const post=(offset,{reply=false,status='published',parentId='parent'}={})=>{
  const id='post-'+(++sequence);
  sql.prepare('INSERT INTO community_posts(id,parent_id,author_id,title,body,status,created_at) VALUES(?,?,?,?,?,?,?)').run(id,reply?parentId:null,'reader','Private title','Private body '+sequence,status,at(offset));
  return id;
 };
 return {env:{DB},metric,post};
}

test('metrics require an owner before validating dates and reject malformed periods',async t=>{
 t.mock.method(Date,'now',()=>FIXED);
 const {env}=await fixture();
 for(const suffix of ['','?days=7','?days=999']){
  const response=await handleMetrics(get(suffix,null),env);
  assert.equal(response.status,403);
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(response.headers.get('x-robots-tag'),'noindex');
 }
 assert.equal((await handleMetrics(get('?days=7',READER_TOKEN),env)).status,403);
 for(const suffix of ['?days=0','?days=2','?days=07','?days=-1','?days=7&days=30','?days=7%20OR%201=1']){
  assert.equal((await handleMetrics(get(suffix),env)).status,400,suffix);
 }
});

test('UTC periods, daily rows and community counts exclude future and out-of-period data',async t=>{
 t.mock.method(Date,'now',()=>FIXED);
 const {env,metric,post}=await fixture();
 for(const offset of [-60,-59,-30,-29,-14,-13,-8,-7,-6,-1,0,1])metric(offset,'view','home',2);
 metric(0,'amazon','community',1);
 post(-14);post(-13);post(-7);post(-6);post(0,{reply:true});post(1);
 post(-6,{status:'hidden'});post(-40,{status:'pending'});post(2,{reply:true,status:'pending'});
 const response=await handleMetrics(get('?days=7'),env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.deepEqual(data.period,{start:iso(-6),end:iso(0),previousStart:iso(-13),previousEnd:iso(-7),timeZone:'UTC',includesToday:true});
 assert.deepEqual(data.rows.map(row=>[row.day,row.event,row.page,row.count]),[[iso(0),'amazon','community',1],[iso(0),'view','home',2],[iso(-1),'view','home',2],[iso(-6),'view','home',2]]);
 assert.deepEqual(data.previousRows.map(row=>row.day),[iso(-7),iso(-8),iso(-13)]);
 assert.deepEqual(data.community,{current:{questions:1,replies:1},previous:{questions:2,replies:0},pending:{questions:1,replies:1}});
 assert.match(data.note,/no son ventas/);
 assert.doesNotMatch(JSON.stringify(data),/secret@example|Private|post-|sub-reader/);
});

test('one day means today against yesterday; thirty days compare with the prior thirty',async t=>{
 t.mock.method(Date,'now',()=>FIXED);
 const {env,metric,post}=await fixture();
 for(const offset of [-60,-59,-30,-29,-1,0,1])metric(offset);
 post(-59);post(-30);post(-29,{reply:true});post(-1);post(0);
 const one=await(await handleMetrics(get('?days=1'),env)).json();
 assert.deepEqual(one.period,{start:iso(0),end:iso(0),previousStart:iso(-1),previousEnd:iso(-1),timeZone:'UTC',includesToday:true});
 assert.deepEqual(one.rows.map(row=>row.day),[iso(0)]);
 assert.deepEqual(one.previousRows.map(row=>row.day),[iso(-1)]);
 assert.deepEqual(one.community.current,{questions:1,replies:0});
 assert.deepEqual(one.community.previous,{questions:1,replies:0});
 const thirty=await(await handleMetrics(get(),env)).json();
 assert.equal(thirty.days,30);
 assert.deepEqual(thirty.period,{start:iso(-29),end:iso(0),previousStart:iso(-59),previousEnd:iso(-30),timeZone:'UTC',includesToday:true});
 assert.deepEqual(thirty.rows.map(row=>row.day),[iso(0),iso(-1),iso(-29)]);
 assert.deepEqual(thirty.previousRows.map(row=>row.day),[iso(-30),iso(-59)]);
 assert.deepEqual(thirty.community.current,{questions:2,replies:1});
 assert.deepEqual(thirty.community.previous,{questions:2,replies:0});
});
test('published metrics exclude replies behind hidden topics while pending remains the real queue',async t=>{
 t.mock.method(Date,'now',()=>FIXED);
 const {env,post}=await fixture();
 const hidden=post(-1,{status:'hidden'});
 post(0,{reply:true,parentId:hidden});
 post(0,{reply:true,status:'pending',parentId:hidden});
 const data=await(await handleMetrics(get('?days=1'),env)).json();
 assert.deepEqual(data.community.current,{questions:0,replies:0});
 assert.deepEqual(data.community.pending,{questions:0,replies:1});
});
