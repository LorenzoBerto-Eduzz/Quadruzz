UPDATE members SET role='host' WHERE role='owner';
--> statement-breakpoint
UPDATE members SET role='member' WHERE role='admin';
