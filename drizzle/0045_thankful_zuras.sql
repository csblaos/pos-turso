CREATE INDEX `inventory_movements_store_product_idx` ON `inventory_movements` (`store_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `products_store_name_idx` ON `products` (`store_id`,`name`);--> statement-breakpoint
CREATE INDEX `products_store_category_name_idx` ON `products` (`store_id`,`category_id`,`name`);