CREATE TABLE `presence_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `presence_sessions_user_seen_idx` ON `presence_sessions` (`user_id`,`last_seen_at`);