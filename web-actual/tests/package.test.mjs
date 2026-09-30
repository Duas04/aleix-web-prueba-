import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/package.mjs');
function fixture(worker){const root=mkdtempSync(path.join(tmpdir(),'package-test-'));mkdirSync(path.join(root,'.openai'));mkdirSync(path.join(root,'dist/server'),{recursive:true});mkdirSync(path.join(root,'drizzle'));writeFileSync(path.join(root,'.openai/hosting.json'),'{"d1":"DB"}');writeFileSync(path.join(root,'dist/server/index.js'),worker);const archive=path.join(root,'worker.tar.gz');return {root,archive,run:()=>spawnSync(process.execPath,[script,archive],{cwd:root,encoding:'utf8'}),cleanup:()=>rmSync(root,{recursive:true,force:true})};}
test('rejects a stale full worker build before archiving',()=>{const f=fixture('function createWorker() {}\nexport default createWorker({"/demo":{},"@admin":{}});\n');try{const result=f.run();assert.notEqual(result.status,0);assert.equal(existsSync(f.archive),false);}finally{f.cleanup();}});
test('accepts a public worker build',()=>{const f=fixture('function createPublicWorker() {}\nexport default createPublicWorker({"/index.html":{}});\n');try{const result=f.run();assert.equal(result.status,0,result.stderr);assert.equal(existsSync(f.archive),true);}finally{f.cleanup();}});
test('rejects private commerce and owner resource keys in an otherwise public worker',()=>{
 for(const key of ['/devoluciones.html','/returns.js','/shop.js','/cart.js','/propietario.html']){
  const f=fixture(`function createPublicWorker() {}\nexport default createPublicWorker(${JSON.stringify({'/index.html':{},[key]:{}})});\n`);
  try{const result=f.run();assert.notEqual(result.status,0,key);assert.equal(existsSync(f.archive),false,key);}finally{f.cleanup();}
 }
});
