CREATE TABLE `financial_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`display_name` text NOT NULL,
	`account_type` text NOT NULL,
	`store_payment_account_id` text,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_payment_account_id`) REFERENCES `store_payment_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `financial_accounts_store_id_idx` ON `financial_accounts` (`store_id`);--> statement-breakpoint
CREATE INDEX `financial_accounts_store_type_idx` ON `financial_accounts` (`store_id`,`account_type`);--> statement-breakpoint
CREATE INDEX `financial_accounts_store_active_idx` ON `financial_accounts` (`store_id`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `financial_accounts_payment_account_unique` ON `financial_accounts` (`store_payment_account_id`) WHERE "financial_accounts"."store_payment_account_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `financial_accounts_store_system_type_unique` ON `financial_accounts` (`store_id`,`account_type`) WHERE "financial_accounts"."is_system" = 1;
--> statement-breakpoint
CREATE TABLE `cash_flow_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`account_id` text,
	`direction` text NOT NULL,
	`entry_type` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'LAK' NOT NULL,
	`reference` text,
	`note` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`occurred_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cash_flow_entries_store_occurred_at_idx` ON `cash_flow_entries` (`store_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `cash_flow_entries_store_type_occurred_at_idx` ON `cash_flow_entries` (`store_id`,`entry_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `cash_flow_entries_store_direction_occurred_at_idx` ON `cash_flow_entries` (`store_id`,`direction`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `cash_flow_entries_account_occurred_at_idx` ON `cash_flow_entries` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `cash_flow_entries_source_unique` ON `cash_flow_entries` (`store_id`,`source_type`,`source_id`,`entry_type`);
