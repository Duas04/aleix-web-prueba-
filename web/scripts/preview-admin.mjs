// Development-only host adapter. Never imported or bundled by scripts/build.mjs.
// Loopback only; synthetic identity and ephemeral database never reach production.
import http from 'node:http';
import worker from '../dist/server/index.js';
import { localDatabase } from '../tests/database.mjs';
const env={DB:localDatabase(),ADMIN_OWNER_EMAIL:'local-preview@example.test'};
const fixtures=process.argv.includes('--fixtures');
const port=Number(process.env.PORT||4181);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
if(fixtures) env.DB.sqlite.exec("INSERT INTO orders (id,created_at,customer_name,email,recipient,address1,address2,city,postal_code,region,country,edition,quantity,subtotal,shipping,total,payment_status,paid_at) VALUES ('PRUEBA-LOCAL-001',1790636400000,'Comprador de prueba','fixture@example.test','Destinatario de prueba','Calle ficticia 1','Piso 2','Ciudad de prueba','00000','Provincia','ES','hardcover',2,4000,700,4700,'paid',1790636400000)");
const server=http.createServer(async(req,res)=>{
 try{
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,String(value));
  headers.set('oai-authenticated-user-id','local-preview-owner');headers.set('oai-authenticated-user-email','local-preview@example.test');
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Local preview error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/admin (${fixtures?'synthetic TEST fixtures':'empty development database'})`));
