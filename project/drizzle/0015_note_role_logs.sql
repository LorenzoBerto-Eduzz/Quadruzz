CREATE TABLE IF NOT EXISTS `note_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `display_name` text NOT NULL,
  `note` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `note_log_created_idx` ON `note_log` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `display_name` text NOT NULL,
  `old_role` text NOT NULL,
  `new_role` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `role_log_created_idx` ON `role_log` (`created_at`);
