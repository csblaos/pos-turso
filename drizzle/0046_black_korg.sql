CREATE TABLE `inventory_balances` (
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`on_hand_base` integer DEFAULT 0 NOT NULL,
	`reserved_base` integer DEFAULT 0 NOT NULL,
	`available_base` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`store_id`, `product_id`),
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `inventory_balances_product_id_idx` ON `inventory_balances` (`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_balances_store_available_idx` ON `inventory_balances` (`store_id`,`available_base`,`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_balances_store_on_hand_idx` ON `inventory_balances` (`store_id`,`on_hand_base`,`product_id`);--> statement-breakpoint
INSERT INTO `inventory_balances` (
	`store_id`,
	`product_id`,
	`on_hand_base`,
	`reserved_base`,
	`available_base`,
	`updated_at`
)
SELECT
	`store_id`,
	`product_id`,
	coalesce(sum(case
		when `type` = 'IN' then `qty_base`
		when `type` = 'RETURN' then `qty_base`
		when `type` = 'OUT' then -`qty_base`
		when `type` = 'ADJUST' then `qty_base`
		else 0
	end), 0) AS `on_hand_base`,
	coalesce(sum(case
		when `type` = 'RESERVE' then `qty_base`
		when `type` = 'RELEASE' then -`qty_base`
		else 0
	end), 0) AS `reserved_base`,
	coalesce(sum(case
		when `type` = 'IN' then `qty_base`
		when `type` = 'RETURN' then `qty_base`
		when `type` = 'OUT' then -`qty_base`
		when `type` = 'ADJUST' then `qty_base`
		else 0
	end), 0) - coalesce(sum(case
		when `type` = 'RESERVE' then `qty_base`
		when `type` = 'RELEASE' then -`qty_base`
		else 0
	end), 0) AS `available_base`,
	CURRENT_TIMESTAMP
FROM `inventory_movements`
GROUP BY `store_id`, `product_id`;
