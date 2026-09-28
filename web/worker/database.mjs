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
export async function listOrders(env, url) {
  const db = database(env);
  const filter = url.searchParams.get('filter') || 'all';
  const page = Math.max(1, Math.min(1000000, Number.parseInt(url.searchParams.get('page'),10) || 1));
  const query = (url.searchParams.get('q') || '').trim().slice(0,120);
  const filters = { all:'1=1', pending:"payment_status = 'paid' AND fulfillment_status = 'pending'", shipped:"fulfillment_status = 'shipped'", unpaid:"payment_status = 'pending'", incidents:"payment_status IN ('failed','refunded','partially_refunded')" };
  if (!Object.hasOwn(filters,filter)) return null;
  const matches = query ? ['customer_name','email','id'].map(column=>`instr(${spanishSearchSql(column)}, ${spanishSearchSql('?')}) > 0`).join(' OR ') : '';
  const where = matches ? `${filters[filter]} AND (${matches})` : filters[filter];
  const params = query ? [query,query,query] : [];
  const statements = [
    db.prepare(`SELECT id,created_at,customer_name,email,edition,quantity,total,payment_status,fulfillment_status FROM orders WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ?`).bind(...params,(page-1)*20),
    db.prepare("SELECT count(*) AS total, coalesce(sum(payment_status = 'paid' AND fulfillment_status = 'pending'),0) AS pending, coalesce(sum(fulfillment_status = 'shipped'),0) AS shipped FROM orders"),
  ];
  // The unfiltered list already gets its total from statistics in this same batch.
  if(query||filter!=='all')statements.push(db.prepare(`SELECT count(*) AS count FROM orders WHERE ${where}`).bind(...params));
  const results = await db.batch(statements);
  if (results.some(r=>!r.success)) throw new Error('Order query failed');
  const stats=results[1].results[0];
  return {orders:results[0].results,count:results[2]?.results[0].count??stats.total,stats,page,paymentConnected:false};
}
export async function getOrder(env,id) {
  return database(env).prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
}
export async function shipOrder(env,id,tracking) {
  return database(env).prepare("UPDATE orders SET fulfillment_status = 'shipped', shipped_at = ?, tracking = ? WHERE id = ? AND payment_status = 'paid' AND fulfillment_status = 'pending' RETURNING id").bind(Date.now(),tracking,id).first();
}
