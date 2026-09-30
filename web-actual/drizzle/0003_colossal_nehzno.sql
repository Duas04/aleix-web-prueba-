CREATE TABLE `return_access` (
	`order_id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `return_access_token_hash_unique` ON `return_access` (`token_hash`);--> statement-breakpoint
CREATE TABLE `return_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `return_rate_window` ON `return_rate_limits` (`window_start`);--> statement-breakpoint
ALTER TABLE `orders` ADD `portal_requested_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_reply` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_carrier` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_label_key` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_label_type` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_label_size` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_submitted_at` integer;