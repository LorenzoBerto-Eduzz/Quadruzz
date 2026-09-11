DELETE FROM `presence_sessions`;
--> statement-breakpoint
DELETE FROM `access_requests`;
--> statement-breakpoint
DELETE FROM `board_state`;
--> statement-breakpoint
DELETE FROM `members` WHERE `role` != 'owner';
--> statement-breakpoint
INSERT INTO `board_state` (`key`,`value`,`updated_at`,`updated_by`) VALUES ('test_reset_pending','1',0,'system');