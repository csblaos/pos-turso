ALTER TABLE `products`
ADD `allow_base_unit_sale` integer DEFAULT 1 NOT NULL;

ALTER TABLE `product_units`
ADD `enabled_for_sale` integer DEFAULT 1 NOT NULL;
