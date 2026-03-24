ALTER TABLE `purchase_orders` ADD `shipping_cost_original` integer NOT NULL DEFAULT 0;
ALTER TABLE `purchase_orders` ADD `shipping_cost_currency` text NOT NULL DEFAULT 'LAK';
ALTER TABLE `purchase_orders` ADD `other_cost_original` integer NOT NULL DEFAULT 0;
ALTER TABLE `purchase_orders` ADD `other_cost_currency` text NOT NULL DEFAULT 'LAK';

UPDATE `purchase_orders`
SET
  `shipping_cost_original` = coalesce(`shipping_cost`, 0),
  `other_cost_original` = coalesce(`other_cost`, 0);

UPDATE `purchase_orders`
SET
  `shipping_cost_currency` = case
    when `store_id` in (select `id` from `stores`) then (
      select
        case
          when `stores`.`currency` in ('LAK', 'THB', 'USD') then `stores`.`currency`
          else 'LAK'
        end
      from `stores`
      where `stores`.`id` = `purchase_orders`.`store_id`
      limit 1
    )
    else 'LAK'
  end,
  `other_cost_currency` = case
    when `store_id` in (select `id` from `stores`) then (
      select
        case
          when `stores`.`currency` in ('LAK', 'THB', 'USD') then `stores`.`currency`
          else 'LAK'
        end
      from `stores`
      where `stores`.`id` = `purchase_orders`.`store_id`
      limit 1
    )
    else 'LAK'
  end;
