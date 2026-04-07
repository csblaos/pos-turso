ALTER TABLE `users` ADD `client_suspended` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `client_suspended_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `client_suspended_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `client_suspended_by` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `users_client_suspended_idx` ON `users` (`client_suspended`);