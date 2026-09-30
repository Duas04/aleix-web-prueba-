CREATE TABLE `community_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_limit_expiry` ON `community_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `community_moderation` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_oauth` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_oauth_expiry` ON `community_oauth` (`expires_at`);--> statement-breakpoint
CREATE TABLE `community_owner` (
	`slot` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "community_one_owner" CHECK("community_owner"."slot" = 1)
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`author_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `community_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "community_post_status" CHECK("community_posts"."status" IN ('pending','published','hidden'))
);
--> statement-breakpoint
CREATE INDEX `community_posts_parent_created` ON `community_posts` (`parent_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `community_posts_status` ON `community_posts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `community_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `community_session_expiry` ON `community_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `community_users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`alias` text DEFAULT 'Lector' NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_users_google_sub_unique` ON `community_users` (`google_sub`);