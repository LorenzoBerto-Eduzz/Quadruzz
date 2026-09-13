CREATE TABLE IF NOT EXISTS `role_statuses` (
  `key` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `role_statuses` (`key`,`label`,`created_by`,`created_at`) VALUES ('chat','chat','system',0);
--> statement-breakpoint
INSERT OR IGNORE INTO `role_statuses` (`key`,`label`,`created_by`,`created_at`) VALUES ('ticket','ticket','system',0);