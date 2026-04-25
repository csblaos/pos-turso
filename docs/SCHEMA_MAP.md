# Schema Map

อ้างอิงจาก `lib/db/schema/tables.ts` และ migration ปัจจุบัน

## Migration Status

- journal entries: `46`
- latest migration tag: `0046_black_korg`
- latest focus:
  - เพิ่ม stock read model `inventory_balances`:
    - `store_id`
    - `product_id`
    - `on_hand_base`
    - `reserved_base`
    - `available_base`
    - `updated_at`
    - migration `0046_black_korg.sql` จะ backfill จาก `inventory_movements`
    - `scripts/repair-migrations.mjs` สามารถ rebuild ตารางนี้จาก movement history ได้
    - index ที่เพิ่ม:
      - `inventory_balances_product_id_idx`
      - `inventory_balances_store_available_idx`
      - `inventory_balances_store_on_hand_idx`
  - เพิ่ม index ชุดแรกสำหรับ latency-sensitive read path:
    - `inventory_movements_store_product_idx` บน `(store_id, product_id)`
    - `products_store_name_idx` บน `(store_id, name)`
    - `products_store_category_name_idx` บน `(store_id, category_id, name)`
    - `scripts/repair-migrations.mjs` ensure index ชุดนี้แบบ compat ได้ด้วย สำหรับฐานที่ต้องใช้ `npm run db:repair`
  - เพิ่มสถานะระงับ Client (SUPERADMIN) เพื่อปิดใช้งานทั้ง client ชั่วคราว:
    - `users.client_suspended`
    - `users.client_suspended_at`
    - `users.client_suspended_reason`
    - `users.client_suspended_by`
  - เพิ่ม `store_payment_accounts.currency` สำหรับระบุว่าสกุลเงินจริงของบัญชีรับเงินนั้นคืออะไร
  - เพิ่ม operational cash flow foundation:
    - ตาราง `financial_accounts`
    - ตาราง `cash_flow_entries`
  - เพิ่มภาษา UI ต่อผู้ใช้:
    - `users.ui_locale` (`th|lo|en`, default `th`)
  - โครงสร้างสินค้าแบบ Variant (Phase 1):
    - `product_models`
    - `product_model_attributes`
    - `product_model_attribute_values`
    - คอลัมน์ใหม่ใน `products` (`model_id`, `variant_label`, `variant_options_json`, `variant_sort_order`)
  - เพิ่ม deferred FX lock ใน `purchase_orders`:
    - `exchange_rate_locked_at`
    - `exchange_rate_locked_by`
    - `exchange_rate_lock_note`
  - เพิ่ม PO payment + FX baseline ใน `purchase_orders`:
    - `exchange_rate_initial`
    - `payment_status`
    - `paid_at`
    - `paid_by`
    - `payment_reference`
    - `payment_note`
  - เพิ่ม `purchase_orders.due_date`
  - เพิ่มตาราง ledger การชำระ `purchase_order_payments`:
    - `entry_type` (`PAYMENT`/`REVERSAL`)
    - `amount_base`
    - `paid_at`
    - `reversed_payment_id`
  - เพิ่ม notification workflow:
    - ตาราง `notification_inbox` (in-app inbox + dedupe key)
    - ตาราง `notification_rules` (mute/snooze policy ต่อ entity)
  - เพิ่ม `orders.cod_returned_at` สำหรับ timestamp ตอน COD ตีกลับ
  - เพิ่ม `orders.cod_return_note` สำหรับหมายเหตุสาเหตุ COD ตีกลับ
  - เพิ่มตาราง master `shipping_providers` ต่อร้าน
  - เพิ่ม operational cash flow foundation:
    - `financial_accounts`
    - `cash_flow_entries`
  - เพิ่ม sales-unit controls:
    - `products.allow_base_unit_sale`
    - `product_units.enabled_for_sale`
  - เพิ่ม PO unit snapshot:
    - `purchase_order_items.unit_id`
    - `purchase_order_items.multiplier_to_base`
    - `purchase_order_items.qty_base_ordered`
    - `purchase_order_items.qty_base_received`
  - เพิ่ม extra cost currency ของ PO:
    - `purchase_orders.shipping_cost_original`
    - `purchase_orders.shipping_cost_currency`
    - `purchase_orders.other_cost_original`
    - `purchase_orders.other_cost_currency`

## Table Inventory (High-level)

### Identity / Store / Access

- `users`
- `stores`
- `system_config`
- `store_type_templates`
- `roles`
- `permissions`
- `role_permissions`
- `store_members`
- `store_branches`
- `store_member_branches`

### Catalog / Inventory

- `units`
- `product_categories`
- `product_models`
- `product_model_attributes`
- `product_model_attribute_values`
- `products`
- `product_units`
- `contacts`
- `inventory_balances`
- `inventory_movements`

### Orders / Shipping / Purchase

- `orders`
- `order_items`
- `order_shipments`
- `shipping_providers`
- `financial_accounts`
- `cash_flow_entries`
- `purchase_orders`
- `purchase_order_items`
- `purchase_order_payments`

### Reliability / Audit / Integration

- `idempotency_requests`
- `audit_events`
- `notification_inbox`
- `notification_rules`
- `fb_connections`
- `wa_connections`

## Core Relationships

### Store and Membership

- `roles.store_id -> stores.id`
- `store_members.store_id -> stores.id`
- `store_members.user_id -> users.id`
- `store_members.role_id -> roles.id`
- `store_branches.store_id -> stores.id`
- `store_member_branches.(store_id,user_id,branch_id)` เชื่อมสมาชิกกับสาขา

### Product and Stock

- `products.store_id -> stores.id`
- `products.base_unit_id -> units.id`
- `products.category_id -> product_categories.id`
- `products.model_id -> product_models.id`
- `product_models.store_id -> stores.id`
- `product_models.category_id -> product_categories.id`
- `product_model_attributes.model_id -> product_models.id`
- `product_model_attribute_values.attribute_id -> product_model_attributes.id`
- `product_units.product_id -> products.id`
- `product_units.unit_id -> units.id`
- `product_units.price_per_unit` = ราคาขายต่อหน่วยแปลงแบบ optional (ถ้า `null` ให้ใช้ราคาหน่วยหลักคูณตัวคูณ)
- `products.allow_base_unit_sale` = คุมว่าหน่วยหลักโผล่ขายใน POS หรือไม่
- `product_units.enabled_for_sale` = คุมว่าหน่วยแปลงใดเปิดขายใน POS
- `purchase_order_items.unit_id` = หน่วยซื้อที่เลือกตอนสร้าง PO
- `purchase_order_items.multiplier_to_base` = snapshot ตัวคูณของหน่วยซื้อเทียบหน่วยสต็อก
- `purchase_order_items.qty_base_ordered` / `qty_base_received` = จำนวนฐานเป็นหน่วยสต็อก ใช้สำหรับรับของและคำนวณต้นทุนจริง
- `purchase_orders.shipping_cost_original` / `other_cost_original` = ยอดต้นฉบับตามสกุลที่กรอกในฟอร์ม PO
- `purchase_orders.shipping_cost_currency` / `other_cost_currency` = สกุลเงินของ extra cost (จำกัดที่ `store currency` หรือ `purchase currency`)
- `purchase_orders.shipping_cost` / `other_cost` = ยอดฐานร้าน (`store currency`) หลังแปลงเรท ใช้เป็น source of truth สำหรับ landed cost / AP / outstanding
- `inventory_balances.store_id -> stores.id`
- `inventory_balances.product_id -> products.id`
- `inventory_movements.store_id -> stores.id`
- `inventory_movements.product_id -> products.id`
- index สำคัญสำหรับ read path latency batch แรก:
  - `inventory_balances_store_available_idx(store_id, available_base, product_id)` รองรับ list/filter low stock จาก read model
  - `inventory_balances_store_on_hand_idx(store_id, on_hand_base, product_id)` รองรับ query on-hand summary
  - `inventory_movements_store_product_idx(store_id, product_id)` รองรับ stock balance lookup ต่อสินค้า
  - `products_store_name_idx(store_id, name)` รองรับ stock/product list ที่ sort ตามชื่อในขอบเขตร้าน
  - `products_store_category_name_idx(store_id, category_id, name)` รองรับ stock/products page เมื่อกรองหมวดแล้ว sort ตามชื่อ

### Orders

- `orders.store_id -> stores.id`
- `orders.contact_id -> contacts.id`
- `orders.payment_account_id -> store_payment_accounts.id`
- `store_payment_accounts.currency` = สกุลเงินจริงของบัญชีรับเงินนั้น (`LAK | THB | USD`) และ 1 บัญชีใช้ได้กับ 1 สกุลเท่านั้น
- `store_payment_accounts.account_type` ยังเก็บ `BANK | LAO_QR` เพื่อบอก capability `มี QR หรือไม่`; UX ฝั่ง settings ใช้บัญชีเดียว + toggle `มี QR` แทนการแยกประเภทในฟอร์ม
- `orders.created_by -> users.id`
- `order_items.order_id -> orders.id`
- `order_items.product_id -> products.id`
- `order_items.unit_id -> units.id`
- ใน `orders` มี field เวลา COD สำคัญ:
  - `cod_settled_at` (ตอนปิดยอด COD)
  - `cod_returned_at` (ตอนตีกลับ COD)
  - `cod_return_note` (บันทึกสาเหตุ/หมายเหตุการตีกลับ)
- cash flow operational ledger:
  - `financial_accounts.store_id -> stores.id`
  - `financial_accounts.store_payment_account_id -> store_payment_accounts.id`
  - `cash_flow_entries.store_id -> stores.id`
  - `cash_flow_entries.account_id -> financial_accounts.id`
  - `cash_flow_entries.created_by -> users.id`
  - order cash-in ใช้ `cash_flow_entries.source_type = ORDER`

### Shipping

- `shipping_providers.store_id -> stores.id`
- `order_shipments.order_id -> orders.id`
- `order_shipments.store_id -> stores.id`
- `order_shipments.created_by -> users.id`
- order-level snapshot fields in `orders`:
  - `shipping_provider`
  - `shipping_label_status`
  - `shipping_label_url`
  - `shipping_request_id`
  - `tracking_no`
  - `shipping_provider` ใน `orders` เป็น snapshot ตอนสร้างออเดอร์ (แยกจาก master `shipping_providers`)

### Purchase

- `purchase_orders.store_id -> stores.id`
- `purchase_orders.created_by -> users.id`
- `purchase_orders.updated_by -> users.id`
- `purchase_orders.exchange_rate_locked_by -> users.id`
- `purchase_orders.paid_by -> users.id`
- `purchase_order_items.purchase_order_id -> purchase_orders.id`
- `purchase_order_items.product_id -> products.id`
- `purchase_order_items.unit_id -> units.id`
- `purchase_order_payments.purchase_order_id -> purchase_orders.id`
- `purchase_order_payments.store_id -> stores.id`
- `purchase_order_payments.created_by -> users.id`
- `purchase_order_payments.reversed_payment_id -> purchase_order_payments.id`
- PO payment/reversal จะเขียน operational cash flow ลง `cash_flow_entries` ด้วย โดยใช้ `source_type = PURCHASE_ORDER_PAYMENT`

### Reliability / Audit

- `idempotency_requests.store_id -> stores.id`
- `idempotency_requests.created_by -> users.id`
- `audit_events.store_id -> stores.id`
- `audit_events.actor_user_id -> users.id`
- `notification_inbox.store_id -> stores.id`
- `notification_rules.store_id -> stores.id`
- `notification_rules.updated_by -> users.id`

## Important Enums / Statuses

### Orders

- channel: `WALK_IN | FACEBOOK | WHATSAPP`
- payment method: `CASH | LAO_QR | ON_CREDIT | COD | BANK_TRANSFER`
- payment status:
  - `UNPAID`
  - `PENDING_PROOF`
  - `PAID`
  - `COD_PENDING_SETTLEMENT`
  - `COD_SETTLED`
  - `FAILED`
- shipping label status:
  - `NONE`
  - `REQUESTED`
  - `READY`
  - `FAILED`
- order status: `DRAFT | PENDING_PAYMENT | READY_FOR_PICKUP | PICKED_UP_PENDING_PAYMENT | PAID | PACKED | SHIPPED | COD_RETURNED | CANCELLED`

### Reliability

- idempotency status: `PROCESSING | SUCCEEDED | FAILED`
- audit scope: `STORE | SYSTEM`
- audit result: `SUCCESS | FAIL`
- notification topic: `PURCHASE_AP_DUE`
- notification entity type: `PURCHASE_ORDER`
- notification severity: `INFO | WARNING | CRITICAL`
- notification status: `UNREAD | READ | RESOLVED`
- notification due status: `OVERDUE | DUE_SOON`

### Purchase

- PO status: `DRAFT | ORDERED | SHIPPED | RECEIVED | CANCELLED`
- PO payment status: `UNPAID | PARTIAL | PAID`
- PO payment entry type: `PAYMENT | REVERSAL`

### Cash Flow

- financial account type: `CASH_DRAWER | BANK | QR | COD_CLEARING`
- cash flow direction: `IN | OUT`
- cash flow entry type:
  - `SALE_CASH_IN`
  - `SALE_QR_IN`
  - `SALE_BANK_IN`
  - `AR_COLLECTION_IN`
  - `COD_SETTLEMENT_IN`
  - `PURCHASE_PAYMENT_OUT`
  - `PURCHASE_PAYMENT_REVERSAL_IN`
- cash flow source type: `ORDER | PURCHASE_ORDER_PAYMENT`

## Indexes Worth Knowing (Operational)

- orders:
  - `orders_store_status_created_at_idx`
  - `orders_store_payment_method_idx`
  - `orders_store_payment_status_created_at_idx`
  - `orders_store_shipping_label_status_updated_idx`
- order shipments:
  - `order_shipments_order_id_idx`
  - `order_shipments_store_status_created_at_idx`
  - `order_shipments_provider_request_id_idx`
- shipping providers:
  - `shipping_providers_store_id_idx`
  - `shipping_providers_store_active_sort_idx`
  - unique `shipping_providers_store_code_unique`
- idempotency:
  - unique `idempotency_requests_store_action_key_unique`
- audit:
  - `audit_events_scope_occurred_at_idx`
  - `audit_events_store_occurred_at_idx`
- notifications:
  - unique `notification_inbox_store_dedupe_unique`
  - `notification_inbox_store_status_detected_idx`
  - `notification_inbox_store_topic_detected_idx`
  - unique `notification_rules_store_topic_entity_unique`
  - `notification_rules_store_topic_idx`
- inventory movements:
  - `inventory_movements_store_created_at_idx`
  - `inventory_movements_store_type_created_at_idx`
- product variants:
  - `product_models_store_name_unique`
  - `product_model_attributes_model_code_unique`
  - `product_model_attribute_values_attribute_code_unique`
  - `products_model_variant_options_unique`
- purchase:
  - `po_exchange_rate_locked_at_idx`
  - `po_payment_status_paid_at_idx`
  - `po_due_date_idx`
  - `po_supplier_received_at_idx`
  - `po_payments_po_id_idx`
  - `po_payments_store_paid_at_idx`
  - `po_payments_reversed_id_idx`

## Schema Change Checklist

1. แก้ `lib/db/schema/tables.ts`
2. รัน `npm run db:generate`
3. ตรวจไฟล์ที่ต้องเข้า commit:
  - `drizzle/*.sql`
  - `drizzle/meta/*_snapshot.json`
  - `drizzle/meta/_journal.json`
4. apply:

```bash
set -a
source .env.local
set +a
npm run db:repair
npm run db:migrate
```

5. ตรวจคุณภาพ:

```bash
npm run lint
npm run build
```
