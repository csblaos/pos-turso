ALTER TABLE `store_payment_accounts`
ADD `currency` text NOT NULL DEFAULT 'LAK';--> statement-breakpoint
UPDATE `store_payment_accounts`
SET `currency` = COALESCE(
  (
    SELECT `currency`
    FROM `stores`
    WHERE `stores`.`id` = `store_payment_accounts`.`store_id`
  ),
  'LAK'
)
WHERE `currency` IS NULL
   OR trim(`currency`) = ''
   OR `currency` = 'LAK';
