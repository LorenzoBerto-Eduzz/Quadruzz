ALTER TABLE access_requests ADD COLUMN display_name text;
--> statement-breakpoint
ALTER TABLE access_requests ADD COLUMN profile_image_key text;
--> statement-breakpoint
ALTER TABLE access_requests ADD COLUMN expires_at integer;
