// Daily, local backup of committed source only. This is not a production DB backup.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const scope='committed source; no production database or environment secrets';
const version=1;
const privateName=/(^|\/)(?:\.env(?:\.(?!example$|sample$|template$)[^/]*)?|[^/]+\.(?:sqlite3?|db|pem|key|p12|pfx|bak|backup)|(?:credentials?|cookies?|oauth(?:-?tokens?)?|client[_-]?secret|service[_-]?account)(?:\.[^/]*)?)$/i;
const placeholder=value=>/^(?:example|sample|test|dummy|placeholder|changeme|your[-_ ]|xxxxx|redacted|<|\$\{|\{\{)/i.test(value);
function unsafeContent(text){
 if(/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(text))return true;
 if(/\b(?:sk-proj-[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/.test(text))return true;
 for(const match of text.matchAll(/["']client_secret["']\s*:\s*["']([^"']+)["']/gi))if(match[1].length>=16&&!placeholder(match[1]))return true;
 return false;
}
function checkCommittedSource(cwd,sha){
 const tree=execFileSync('git',['ls-tree','-rz',sha],{cwd,encoding:'buffer'}).toString('utf8');
 for(const entry of tree.split('\0')){
  if(!entry)continue;
  const parsed=entry.match(/^\d+ blob ([a-f0-9]{40,64})\t([\s\S]+)$/);
  if(!parsed)throw Error('Unexpected tracked Git entry: backup refused');
  const [,sha,name]=parsed;
  if(privateName.test(name))throw Error('Private file type in tracked source: backup refused');
  const blob=execFileSync('git',['cat-file','blob',sha],{cwd,encoding:'buffer',maxBuffer:50*1024*1024});
  if(!blob.includes(0)&&unsafeContent(blob.toString('utf8')))throw Error('Credential in tracked source: backup refused');
 }
}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const destination=path.join(root,'..','copias-codigo');
mkdirSync(destination,{recursive:true});
const manifestPath=path.join(destination,date+'.json');
if(existsSync(manifestPath)){
 const saved=JSON.parse(readFileSync(manifestPath,'utf8'));
 if(saved.date!==date||saved.scope!==scope||saved.version!==undefined&&saved.version!==version||!Array.isArray(saved.files))throw Error('Backup manifest scope or version mismatch');
 const names=saved.files.map(file=>file?.name);
 if(!names.some(name=>typeof name==='string'&&name.startsWith(date+'-site-'))||new Set(names).size!==names.length)throw Error('Backup manifest missing site archive or contains duplicate entries');
 for(const file of saved.files){if(typeof file.name!=='string'||path.basename(file.name)!==file.name||!/^\d{4}-\d{2}-\d{2}-(?:site|github)-[a-f0-9]{12}\.zip$/.test(file.name)||!/^([a-f0-9]{64})$/.test(file.sha256))throw Error('Invalid backup manifest entry');const content=readFileSync(path.join(destination,file.name));if(createHash('sha256').update(content).digest('hex')!==file.sha256)throw Error('Backup checksum mismatch');}
 console.log(JSON.stringify({verified:true,existing:true,manifest:manifestPath}));
}else{
 const files=[];
 const sources=[];
 for(const [label,cwd]of [['site',root],['github',path.join(root,'..','github-fumada-xxl')]]){
  if(!existsSync(path.join(cwd,'.git'))){if(label==='site')throw Error('Source repository missing');continue;}
  const sha=run(['rev-parse','HEAD'],cwd);
  checkCommittedSource(cwd,sha);
  sources.push({label,cwd,sha});
 }
 for(const {label,cwd,sha} of sources){
  const name=`${date}-${label}-${sha.slice(0,12)}.zip`,file=path.join(destination,name);
  run(['archive','--format=zip','--output='+file,sha],cwd);
  const bytes=readFileSync(file);files.push({name,commit:sha,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 writeFileSync(manifestPath,JSON.stringify({version,date,scope,files},null,2)+'\n');
 console.log(JSON.stringify({verified:true,manifest:manifestPath,files:files.length}));
}
