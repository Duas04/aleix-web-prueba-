// Daily, local backup of committed source only. This is not a production DB backup.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const destination=path.join(root,'..','copias-codigo');
mkdirSync(destination,{recursive:true});
const manifestPath=path.join(destination,date+'.json');
if(existsSync(manifestPath)){
 const saved=JSON.parse(readFileSync(manifestPath,'utf8'));
 for(const file of saved.files){const content=readFileSync(path.join(destination,file.name));if(createHash('sha256').update(content).digest('hex')!==file.sha256)throw Error('Backup checksum mismatch');}
 console.log(JSON.stringify({verified:true,existing:true,manifest:manifestPath}));
}else{
 const files=[];
 for(const [label,cwd]of [['site',root],['github',path.join(root,'..','github-fumada-xxl')]]){
  if(!existsSync(path.join(cwd,'.git'))){if(label==='site')throw Error('Source repository missing');continue;}
  const sha=run(['rev-parse','HEAD'],cwd),tracked=run(['ls-tree','-r','--name-only','HEAD'],cwd).split('\n');
  if(tracked.some(name=>/(^|\/)(\.env($|\.(?!example$))|[^/]+\.(sqlite3?|db|pem|key)$)/i.test(name)))throw Error('Private file type in tracked source: backup refused');
  const name=`${date}-${label}-${sha.slice(0,12)}.zip`,file=path.join(destination,name);
  run(['archive','--format=zip','--output='+file,'HEAD'],cwd);
  const bytes=readFileSync(file);files.push({name,commit:sha,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 writeFileSync(manifestPath,JSON.stringify({date,scope:'committed source; no production database or environment secrets',files},null,2)+'\n');
 console.log(JSON.stringify({verified:true,manifest:manifestPath,files:files.length}));
}
