CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`dedupe_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_log_dedupe_key_unique` ON `activity_log` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `activity_log_created_idx` ON `activity_log` (`created_at`);
