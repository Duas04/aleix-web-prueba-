CREATE TABLE `order_items` (
	`order_id` text NOT NULL,
	`edition` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	PRIMARY KEY(`order_id`, `edition`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_edition" CHECK("order_items"."edition" IN ('paperback','hardcover')),
	CONSTRAINT "item_quantity" CHECK("order_items"."quantity" BETWEEN 1 AND 10),
	CONSTRAINT "item_unit_price" CHECK("order_items"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivered_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `private_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `note_updated_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_reason` text DEFAULT '';--> statement-breakpoint
ALTER TABLE `orders` ADD `return_resolution` text DEFAULT '';--> statement-breakpoint
ALTER TABLE `orders` ADD `return_updated_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `management_version` integer DEFAULT 0 NOT NULL;