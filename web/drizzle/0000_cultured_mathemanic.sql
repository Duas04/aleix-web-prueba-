CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`recipient` text NOT NULL,
	`address1` text NOT NULL,
	`address2` text,
	`city` text NOT NULL,
	`postal_code` text NOT NULL,
	`region` text,
	`country` text NOT NULL,
	`edition` text NOT NULL,
	`quantity` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`shipping` integer NOT NULL,
	`total` integer NOT NULL,
	`payment_status` text NOT NULL,
	`fulfillment_status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`shipped_at` integer,
	`tracking` text,
	CONSTRAINT "order_edition" CHECK("orders"."edition" IN ('paperback','hardcover')),
	CONSTRAINT "order_quantity" CHECK("orders"."quantity" BETWEEN 1 AND 10),
	CONSTRAINT "order_payment" CHECK("orders"."payment_status" IN ('pending','paid','failed','refunded','partially_refunded')),
	CONSTRAINT "order_fulfillment" CHECK("orders"."fulfillment_status" IN ('pending','shipped')),
	CONSTRAINT "order_total" CHECK("orders"."total" = "orders"."subtotal" + "orders"."shipping" AND "orders"."shipping" >= 0 AND "orders"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE INDEX `orders_created` ON `orders` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `admin_owner` (
	`slot` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT "one_owner" CHECK("admin_owner"."slot" = 1)
);
