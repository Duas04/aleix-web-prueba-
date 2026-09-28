// D1 prepared queries. Schema changes live exclusively in generated migrations.
export function database(env) {
  if (!env.DB) throw new Error('Database binding unavailable');
  return env.DB;
}
export async function authorizeOwner(request, env) {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) return 401;
  const db = database(env);
  let owner = await db.prepare('SELECT user_id FROM admin_owner WHERE slot = 1').first();
  if (!owner) {
    // Bootstrap only the explicitly configured, platform-authenticated owner.
    // A random first visitor can never claim this slot. After binding, use the stable site ID.
    const email = request.headers.get('oai-authenticated-user-email');
    if (!env.ADMIN_OWNER_EMAIL || !email || email.toLowerCase() !== env.ADMIN_OWNER_EMAIL.toLowerCase()) return 403;
    await db.prepare('INSERT INTO admin_owner (slot, user_id) VALUES (1, ?) ON CONFLICT(slot) DO NOTHING').bind(userId).run();
    owner = await db.prepare('SELECT user_id FROM admin_owner WHERE slot = 1').first();
  }
  return owner?.user_id === userId ? 200 : 403;
}
// SQLite lower() folds ASCII only. Apply the same bounded Spanish search fold
// to columns and bound queries, including decomposed acute/diaeresis/tilde.
// This is intentionally not general Unicode transliteration; stored text is untouched.
function spanishSearchSql(expression) {
  const folds = [['Á','a'],['á','a'],['É','e'],['é','e'],['Í','i'],['í','i'],['Ó','o'],['ó','o'],['Ú','u'],['ú','u'],['Ü','u'],['ü','u'],['Ñ','n'],['ñ','n'],['\u0301',''],['\u0308',''],['\u0303','']];
  return `lower(${folds.reduce((sql,[from,to])=>`replace(${sql}, '${from}', '${to}')`,expression)})`;
}
const activeReturnSql = "return_status IN ('requested','reviewing','approved','received')";
const pendingSql = `payment_status = 'paid' AND fulfillment_status = 'pending' AND NOT (${activeReturnSql})`;
function orderItems(order, rows) {
  if(rows.length)return rows.map(({edition,quantity,unit_price})=>({edition,quantity,unit_price,subtotal:quantity*unit_price}));
  // Historical amounts can contain discounts: never replace them with today's catalogue price.
  return [{edition:order.edition,quantity:order.quantity,unit_price:order.subtotal/order.quantity,subtotal:order.subtotal}];
}
export async function listOrders(env, url) {
  const db = database(env);
  const filter = url.searchParams.get('filter') || 'all';
  const page = Math.max(1, Math.min(1000000, Number.parseInt(url.searchParams.get('page'),10) || 1));
  const query = (url.searchParams.get('q') || '').trim().slice(0,120);
  const filters = { all:'1=1', pending:pendingSql, shipped:"fulfillment_status = 'shipped'", unpaid:"payment_status = 'pending'", incidents:`(payment_status IN ('failed','refunded','partially_refunded') OR ${activeReturnSql})`, attention:`(payment_status IN ('failed','partially_refunded') OR ${activeReturnSql})`, returns:activeReturnSql, delivered:"delivered_at IS NOT NULL", access_requests:"portal_requested_at IS NOT NULL" };
  if (!Object.hasOwn(filters,filter)) return null;
  const matches = query ? ['customer_name','email','id'].map(column=>`instr(${spanishSearchSql(column)}, ${spanishSearchSql('?')}) > 0`).join(' OR ') : '';
  const where = matches ? `${filters[filter]} AND (${matches})` : filters[filter];
  const params = query ? [query,query,query] : [];
  const statements = [
    db.prepare(`SELECT id,created_at,customer_name,email,edition,quantity,subtotal,total,payment_status,fulfillment_status,carrier,tracking,delivered_at,return_status,management_version,portal_requested_at FROM orders WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ?`).bind(...params,(page-1)*20),
    db.prepare(`SELECT count(*) AS total, coalesce(sum(${pendingSql}),0) AS pending, coalesce(sum(fulfillment_status = 'shipped'),0) AS shipped, coalesce(sum(payment_status IN ('failed','partially_refunded') OR ${activeReturnSql}),0) AS incidents, coalesce(sum(${activeReturnSql}),0) AS returns, coalesce(sum(delivered_at IS NOT NULL),0) AS delivered, coalesce(sum(portal_requested_at IS NOT NULL),0) AS accessRequests FROM orders`),
  ];
  // The unfiltered list already gets its total from statistics in this same batch.
  if(query||filter!=='all')statements.push(db.prepare(`SELECT count(*) AS count FROM orders WHERE ${where}`).bind(...params));
  const results = await db.batch(statements);
  if (results.some(r=>!r.success)) throw new Error('Order query failed');
  const stats=results[1].results[0];
  const orders=results[0].results;
  // At most twenty IDs: one related query per page, independent of the number of orders.
  if(orders.length){
    const related=await db.prepare(`SELECT order_id,edition,quantity,unit_price FROM order_items WHERE order_id IN (${orders.map(()=>'?').join(',')}) ORDER BY CASE edition WHEN 'paperback' THEN 0 ELSE 1 END`).bind(...orders.map(o=>o.id)).all();
    if(!related.success)throw new Error('Order items query failed');
    const grouped=new Map();for(const row of related.results){if(!grouped.has(row.order_id))grouped.set(row.order_id,[]);grouped.get(row.order_id).push(row);}
    for(const order of orders)order.items=orderItems(order,grouped.get(order.id)||[]);
  }
  return {orders,count:results[2]?.results[0].count??stats.total,stats,page,paymentConnected:false};
}
export async function getOrder(env,id) {
  const db=database(env);
  const results=await db.batch([
    db.prepare('SELECT * FROM orders WHERE id = ?').bind(id),
    db.prepare("SELECT edition,quantity,unit_price FROM order_items WHERE order_id = ? ORDER BY CASE edition WHEN 'paperback' THEN 0 ELSE 1 END").bind(id),
  ]);
  if(results.some(r=>!r.success))throw new Error('Order detail query failed');
  const order=results[0].results[0];
  if(!order)return null;
  order.items=orderItems(order,results[1].results);return order;
}
export async function shipOrder(env,id,input) {
  const {tracking,carrier='',expectedVersion}=typeof input==='string'?{tracking:input}:input;
  const version=expectedVersion===undefined?'':' AND management_version = ?';
  const values=[Date.now(),tracking,carrier,id];if(expectedVersion!==undefined)values.push(expectedVersion);
  return database(env).prepare(`UPDATE orders SET fulfillment_status = 'shipped', shipped_at = ?, tracking = ?, carrier = ?, management_version = management_version + 1 WHERE id = ? AND ${pendingSql}${version} RETURNING id`).bind(...values).first();
}
// All edits compare and increment the same version in the UPDATE itself.
// No management query writes payment status, monetary amounts, or provider state.
export async function updateNote(env,id,{note,expectedVersion}) {
  return database(env).prepare('UPDATE orders SET private_note = ?, note_updated_at = ?, management_version = management_version + 1 WHERE id = ? AND management_version = ? RETURNING id').bind(note,Date.now(),id,expectedVersion).first();
}
export async function updateTracking(env,id,{carrier,tracking,expectedVersion}) {
  return database(env).prepare("UPDATE orders SET carrier = ?, tracking = ?, management_version = management_version + 1 WHERE id = ? AND management_version = ? AND fulfillment_status = 'shipped' AND delivered_at IS NULL RETURNING id").bind(carrier,tracking,id,expectedVersion).first();
}
export async function deliverOrder(env,id,{expectedVersion}) {
  return database(env).prepare("UPDATE orders SET delivered_at = ?, management_version = management_version + 1 WHERE id = ? AND management_version = ? AND fulfillment_status = 'shipped' AND delivered_at IS NULL RETURNING id").bind(Date.now(),id,expectedVersion).first();
}
const returnTransitions = {
  none:['requested'],requested:['reviewing','approved','rejected'],reviewing:['approved','rejected'],
  approved:['received','closed'],received:['closed'],closed:['requested'],rejected:['requested'],
};
export async function updateReturn(env,id,{status,reason,resolution,expectedVersion}) {
  const db=database(env);
  const previous=status==='requested'?await db.prepare('SELECT return_status,return_label_key FROM orders WHERE id=? AND management_version=?').bind(id,expectedVersion).first():null;
  if(status==='requested'&&!previous)return null;
  const reopening=status==='requested'&&previous.return_status!=='requested';
  const from=Object.keys(returnTransitions).filter(previous=>previous===status||returnTransitions[previous].includes(status));
  const now=Date.now(),values=[status,reason,resolution,now];
  const reset=reopening?", customer_reply='',return_kind='',return_code='',return_carrier='',return_label_key=NULL,return_label_type=NULL,return_label_size=NULL,return_submitted_at=?":'';
  if(reopening)values.push(now);
  values.push(id,expectedVersion,...from);
  const changed=await db.prepare(`UPDATE orders SET return_status = ?, return_reason = ?, return_resolution = ?, return_updated_at = ?${reset}, management_version = management_version + 1 WHERE id = ? AND management_version = ? AND payment_status IN ('paid','refunded','partially_refunded') AND return_status IN (${from.map(()=>'?').join(',')}) RETURNING id`).bind(...values).first();
  if(changed&&reopening&&previous.return_label_key&&env.FILES){
    try{await env.FILES.delete(previous.return_label_key);}catch{/* Optional cleanup cannot turn a committed reopening into a reported failure. */}
  }
  return changed;
}
