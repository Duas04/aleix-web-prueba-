import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
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
}, t => [index('orders_created').on(t.createdAt,t.id),
check('order_edition',sql`${t.edition} IN ('paperback','hardcover')`),
check('order_quantity',sql`${t.quantity} BETWEEN 1 AND 10`),
check('order_payment',sql`${t.paymentStatus} IN ('pending','paid','failed','refunded','partially_refunded')`),
check('order_fulfillment',sql`${t.fulfillmentStatus} IN ('pending','shipped')`),
check('order_total',sql`${t.total} = ${t.subtotal} + ${t.shipping} AND ${t.shipping} >= 0 AND ${t.subtotal} >= 0`)]);
