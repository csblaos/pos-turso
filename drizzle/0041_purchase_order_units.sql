PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`multiplier_to_base` integer DEFAULT 1 NOT NULL,
	`qty_ordered` integer NOT NULL,
	`qty_received` integer DEFAULT 0 NOT NULL,
	`qty_base_ordered` integer DEFAULT 0 NOT NULL,
	`qty_base_received` integer DEFAULT 0 NOT NULL,
	`unit_cost_purchase` integer DEFAULT 0 NOT NULL,
	`unit_cost_base` integer DEFAULT 0 NOT NULL,
	`landed_cost_per_unit` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE restrict
);

INSERT INTO `__new_purchase_order_items` (
	`id`,
	`purchase_order_id`,
	`product_id`,
	`unit_id`,
	`multiplier_to_base`,
	`qty_ordered`,
	`qty_received`,
	`qty_base_ordered`,
	`qty_base_received`,
	`unit_cost_purchase`,
	`unit_cost_base`,
	`landed_cost_per_unit`
)
SELECT
	poi.`id`,
	poi.`purchase_order_id`,
	poi.`product_id`,
	p.`base_unit_id`,
	1,
	poi.`qty_ordered`,
	poi.`qty_received`,
	poi.`qty_ordered`,
	poi.`qty_received`,
	poi.`unit_cost_purchase`,
	poi.`unit_cost_base`,
	poi.`landed_cost_per_unit`
FROM `purchase_order_items` poi
INNER JOIN `products` p ON p.`id` = poi.`product_id`;

DROP TABLE `purchase_order_items`;
ALTER TABLE `__new_purchase_order_items` RENAME TO `purchase_order_items`;

CREATE INDEX `po_items_po_id_idx` ON `purchase_order_items` (`purchase_order_id`);
CREATE INDEX `po_items_product_id_idx` ON `purchase_order_items` (`product_id`);

PRAGMA foreign_keys=ON;
