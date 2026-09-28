// The presentation uses its own short-lived server session, never real order APIs.
async function demoApi(path,options={}){
  const session=window.DemoSession;
  if(!session?.ready())throw new Error('Inicia una demostración o abre el enlace compartido de tu otro dispositivo.');
  if(!path.startsWith('/api/admin/orders'))throw new Error('Ruta de demostración no válida.');
  const action=options.headers?.['X-Admin-Action'];
  let body=options.body;
  if(action==='return-label'&&typeof body!=='string')body=JSON.stringify({type:body.type,size:body.size,expectedVersion:Number(options.headers['X-Order-Version'])});
  const response=await session.request(path.replace('/api/admin/','/api/demo/admin/'),{method:options.method||'GET',...(body?{body}:{}),headers:{...(action?{'X-Demo-Action':action,'Content-Type':'application/json'}:{})}});
  let result;try{result=await response.json();}catch{throw new Error('No se puede cargar la demostración. Vuelve a intentarlo.');}
  if(!response.ok)throw new Error(result.error||'No se puede actualizar la demostración.');
  return result;
}
