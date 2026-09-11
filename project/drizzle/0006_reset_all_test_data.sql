DELETE FROM `presence_sessions`;
--> statement-breakpoint
DELETE FROM `access_requests`;
--> statement-breakpoint
DELETE FROM `board_state`;
--> statement-breakpoint
DELETE FROM `members` WHERE `role` != 'host';
--> statement-breakpoint
UPDATE `members` SET `display_name` = NULL, `profile_image_key` = NULL, `last_seen_at` = NULL, `updated_at` = 0 WHERE `role` = 'host';
--> statement-breakpoint
INSERT INTO `board_state` (`key`,`value`,`updated_at`,`updated_by`) VALUES ('test_reset_pending','1',0,'system');
