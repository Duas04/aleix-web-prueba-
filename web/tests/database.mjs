import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
export function localDatabase(){
  const sqlite=new DatabaseSync(':memory:');
  for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
  const prepare=sql=>{
    let values=[];
    const stmt={bind(...args){values=args;return stmt;},async first(){return sqlite.prepare(sql).get(...values)||null;},async run(){return {success:true,meta:sqlite.prepare(sql).run(...values)};},async all(){return {success:true,results:sqlite.prepare(sql).all(...values)};}};
    return stmt;
  };
  return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.all());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
