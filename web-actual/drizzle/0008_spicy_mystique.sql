CREATE TABLE `community_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`resolved_by` text,
	`resolution` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `community_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_reports_pending` ON `community_reports` (`resolved_at`,`created_at`);