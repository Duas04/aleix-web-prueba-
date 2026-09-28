import { sqliteTable, text, integer, index, check, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const owner = sqliteTable('admin_owner', {
  slot: integer('slot').primaryKey(), userId: text('user_id').notNull(),
}, t => [check('one_owner',sql`${t.slot} = 1`)]);
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), createdAt: integer('created_at').notNull(),
  customerName: text('customer_name').notNull(), email: text('email').notNull(), phone: text('phone'),
  recipient: text('recipient').notNull(), address1: text('address1').notNull(), address2: text('address2'),
  city: text('city').notNull(), postalCode: text('postal_code').notNull(), region: text('region'), country: text('country').notNull(),
  edition: text('edition').notNull(), quantity: integer('quantity').notNull(),
  subtotal: integer('subtotal').notNull(), shipping: integer('shipping').notNull(), total: integer('total').notNull(),
  paymentStatus: text('payment_status').notNull(), fulfillmentStatus: text('fulfillment_status').notNull().default('pending'),
  paidAt: integer('paid_at'), shippedAt: integer('shipped_at'), tracking: text('tracking'),
  carrier: text('carrier'), deliveredAt: integer('delivered_at'),
  privateNote: text('private_note').notNull().default(''), noteUpdatedAt: integer('note_updated_at'),
  returnStatus: text('return_status').notNull().default('none'),
  returnReason: text('return_reason').default(''), returnResolution: text('return_resolution').default(''),
  returnUpdatedAt: integer('return_updated_at'), managementVersion: integer('management_version').notNull().default(0),
}, t => [index('orders_created').on(t.createdAt,t.id),
index('orders_payment_fulfillment_created').on(t.paymentStatus,t.fulfillmentStatus,t.createdAt,t.id),
index('orders_fulfillment_created').on(t.fulfillmentStatus,t.createdAt,t.id),
check('order_edition',sql`${t.edition} IN ('paperback','hardcover')`),
check('order_quantity',sql`${t.quantity} BETWEEN 1 AND 10`),
check('order_payment',sql`${t.paymentStatus} IN ('pending','paid','failed','refunded','partially_refunded')`),
check('order_fulfillment',sql`${t.fulfillmentStatus} IN ('pending','shipped')`),
check('order_total',sql`${t.total} = ${t.subtotal} + ${t.shipping} AND ${t.shipping} >= 0 AND ${t.subtotal} >= 0`)]);
export const orderItems = sqliteTable('order_items', {
  orderId: text('order_id').notNull().references(()=>orders.id,{onDelete:'cascade'}),
  edition: text('edition').notNull(), quantity: integer('quantity').notNull(), unitPrice: integer('unit_price').notNull(),
}, t=>[
  primaryKey({columns:[t.orderId,t.edition]}),
  check('item_edition',sql`${t.edition} IN ('paperback','hardcover')`),
  check('item_quantity',sql`${t.quantity} BETWEEN 1 AND 10`),
  check('item_unit_price',sql`${t.unitPrice} >= 0`),
]);
