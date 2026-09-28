// Portable Windows-compatible packaging of an already built, committed Worker.
import {mkdtempSync,cpSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const archive=process.argv[2];
if(!archive||!path.isAbsolute(archive))throw new Error('Absolute archive path required');
const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
if(manifest.static||!existsSync('dist/server/index.js'))throw new Error('Build Worker first');
const stage=mkdtempSync(path.join(tmpdir(),'fumada-worker-'));
mkdirSync(path.join(stage,'dist/server'),{recursive:true});
mkdirSync(path.join(stage,'dist/.openai'),{recursive:true});
cpSync('dist/server/index.js',path.join(stage,'dist/server/index.js'));
cpSync('.openai/hosting.json',path.join(stage,'dist/.openai/hosting.json'));
cpSync('drizzle',path.join(stage,'dist/.openai/drizzle'),{recursive:true});
const result=spawnSync('tar',['-C',stage,'-czf',archive,'dist'],{stdio:'inherit'});
if(result.status!==0)throw new Error('Archive failed');
console.log('Packaged Worker and generated D1 migrations.');
