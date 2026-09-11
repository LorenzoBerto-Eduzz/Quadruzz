CREATE TABLE IF NOT EXISTS `extension_sessions` (`session_id` text PRIMARY KEY NOT NULL,`user_id` text NOT NULL,`last_seen_at` integer NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `extension_sessions_user_seen_idx` ON `extension_sessions` (`user_id`,`last_seen_at`);
