CREATE TABLE IF NOT EXISTS `error_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `message` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `error_log_created_idx` ON `error_log` (`created_at`);
