DELETE FROM `presence_sessions`;
--> statement-breakpoint
DELETE FROM `extension_sessions`;
--> statement-breakpoint
DELETE FROM `extension_credentials`;
--> statement-breakpoint
DELETE FROM `extension_pairing_codes`;
--> statement-breakpoint
DELETE FROM `access_requests`;
--> statement-breakpoint
DELETE FROM `activity_log`;
--> statement-breakpoint
DELETE FROM `role_statuses`;
--> statement-breakpoint
DELETE FROM `board_state`;
--> statement-breakpoint
DELETE FROM `members` WHERE `role` != 'host';
--> statement-breakpoint
UPDATE `members` SET `display_name` = NULL, `profile_image_key` = NULL, `acting_state` = 'chat', `note` = NULL, `note_updated_at` = NULL, `last_seen_at` = NULL, `updated_at` = 0 WHERE `role` = 'host';
--> statement-breakpoint
INSERT INTO `board_state` (`key`,`value`,`updated_at`,`updated_by`) VALUES ('test_reset_pending','1',0,'system');