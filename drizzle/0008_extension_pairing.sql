CREATE TABLE IF NOT EXISTS `extension_pairing_codes` (`code_hash` text PRIMARY KEY NOT NULL,`user_id` text NOT NULL,`created_at` integer NOT NULL,`expires_at` integer NOT NULL,`used_at` integer);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `extension_pairing_codes_user_idx` ON `extension_pairing_codes` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `extension_credentials` (`token_hash` text PRIMARY KEY NOT NULL,`user_id` text NOT NULL,`created_at` integer NOT NULL,`last_used_at` integer NOT NULL,`revoked_at` integer);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `extension_credentials_user_idx` ON `extension_credentials` (`user_id`);
