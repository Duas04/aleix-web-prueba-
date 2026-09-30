import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/backup-source.mjs');
const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function fixture(){
 const base=mkdtempSync(path.join(tmpdir(),'source-backup-test-'));
 const root=path.join(base,'site');mkdirSync(path.join(root,'scripts'),{recursive:true});
 copyFileSync(script,path.join(root,'scripts/backup-source.mjs'));
 const git=(...args)=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
 git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Backup Test');
 return {base,root,git,run:()=>spawnSync(process.execPath,['scripts/backup-source.mjs'],{cwd:root,encoding:'utf8'}),cleanup:()=>rmSync(base,{recursive:true,force:true})};
}
test('refuses a tracked credential hidden in ordinary JSON before writing an archive',()=>{
 const f=fixture();try{
  writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({client_secret:'synthetic-private-value-12345678901234567890'}));
  f.git('add','settings.json');f.git('commit','-qm','fixture');
  const result=f.run();assert.notEqual(result.status,0);
  assert.equal(existsSync(path.join(f.base,'copias-codigo',date()+'.json')),false);
  assert.doesNotMatch(result.stderr,/synthetic-private-value/);
 }finally{f.cleanup();}
});
test('refuses tracked credential file names',()=>{
 const f=fixture();try{
  writeFileSync(path.join(f.root,'cookies.txt'),'synthetic data');f.git('add','cookies.txt');f.git('commit','-qm','fixture');
  assert.notEqual(f.run().status,0);
 }finally{f.cleanup();}
});
test('existing manifest with wrong scope is rejected even if checksums are intact',()=>{
 const f=fixture();try{
  const dest=path.join(f.base,'copias-codigo');mkdirSync(dest);
  writeFileSync(path.join(dest,date()+'.json'),JSON.stringify({date:date(),scope:'untrusted broader scope',files:[]}));
  assert.notEqual(f.run().status,0);
 }finally{f.cleanup();}
});
test('legacy manifest with expected scope remains readable',()=>{
 const f=fixture();try{
  const dest=path.join(f.base,'copias-codigo');mkdirSync(dest);
  const name=`${date()}-site-${'a'.repeat(12)}.zip`,bytes=Buffer.from('synthetic archive');
  writeFileSync(path.join(dest,name),bytes);
  writeFileSync(path.join(dest,date()+'.json'),JSON.stringify({date:date(),scope:'committed source; no production database or environment secrets',files:[{name,sha256:createHash('sha256').update(bytes).digest('hex')}]}));
  const result=f.run();assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).existing,true);
 }finally{f.cleanup();}
});
test('existing manifest with no site archive is rejected',()=>{
 const f=fixture();try{
  const dest=path.join(f.base,'copias-codigo');mkdirSync(dest);
  writeFileSync(path.join(dest,date()+'.json'),JSON.stringify({version:1,date:date(),scope:'committed source; no production database or environment secrets',files:[]}));
  assert.notEqual(f.run().status,0);
 }finally{f.cleanup();}
});
test('existing manifest with duplicate archive entries is rejected',()=>{
 const f=fixture();try{
  const dest=path.join(f.base,'copias-codigo');mkdirSync(dest);
  const name=`${date()}-site-${'a'.repeat(12)}.zip`,bytes=Buffer.from('synthetic archive');
  writeFileSync(path.join(dest,name),bytes);
  const file={name,sha256:createHash('sha256').update(bytes).digest('hex')};
  writeFileSync(path.join(dest,date()+'.json'),JSON.stringify({version:1,date:date(),scope:'committed source; no production database or environment secrets',files:[file,file]}));
  assert.notEqual(f.run().status,0);
 }finally{f.cleanup();}
});
test('public client IDs and example placeholders remain archivable',()=>{
 const f=fixture();try{
  writeFileSync(path.join(f.root,'config.json'),JSON.stringify({client_id:'example-public-client-id.apps.googleusercontent.com',client_secret:'example-placeholder-value'}));
  f.git('add','config.json');f.git('commit','-qm','fixture');
  const result=f.run();assert.equal(result.status,0,result.stderr);
  assert.equal(existsSync(path.join(f.base,'copias-codigo',date()+'.json')),true);
 }finally{f.cleanup();}
});
test('a credential in the second repository prevents every archive',()=>{
 const f=fixture();try{
  writeFileSync(path.join(f.root,'public.txt'),'public');f.git('add','public.txt');f.git('commit','-qm','fixture');
  const github=path.join(f.base,'github-fumada-xxl');mkdirSync(github);
  const git=(...args)=>{const result=spawnSync('git',args,{cwd:github,encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
  git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Backup Test');
  writeFileSync(path.join(github,'client_secret.json'),'synthetic');git('add','client_secret.json');git('commit','-qm','fixture');
  assert.notEqual(f.run().status,0);
  assert.equal(existsSync(path.join(f.base,'copias-codigo',date()+'.json')),false);
  assert.deepEqual(readdirSync(path.join(f.base,'copias-codigo')),[]);
 }finally{f.cleanup();}
});
test('a tracked blob with a newline in its path is still scanned',()=>{
 const f=fixture();try{
  writeFileSync(path.join(f.root,'public.txt'),'public');f.git('add','public.txt');f.git('commit','-qm','fixture');
  const content=JSON.stringify({client_secret:'synthetic-private-value-12345678901234567890'});
  const hash=spawnSync('git',['hash-object','-w','--stdin'],{cwd:f.root,input:content,encoding:'utf8'});
  assert.equal(hash.status,0,hash.stderr);
  const tree=spawnSync('git',['mktree','-z'],{cwd:f.root,input:`100644 blob ${hash.stdout.trim()}\todd\nname.json\0`,encoding:'utf8'});
  assert.equal(tree.status,0,tree.stderr);
  const commit=spawnSync('git',['commit-tree',tree.stdout.trim(),'-m','newline path'],{cwd:f.root,encoding:'utf8'});
  assert.equal(commit.status,0,commit.stderr);f.git('update-ref','HEAD',commit.stdout.trim());
  const result=f.run();assert.notEqual(result.status,0);
  assert.deepEqual(readdirSync(path.join(f.base,'copias-codigo')),[]);
  assert.doesNotMatch(result.stderr,/synthetic-private-value/);
 }finally{f.cleanup();}
});
