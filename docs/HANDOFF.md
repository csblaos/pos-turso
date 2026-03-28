# Handoff

## Snapshot Date

- March 26, 2026

## Changed (ล่าสุด)

- ปรับ header ของหน้า `/products`, `/settings`, และ `/stock` ให้เหลือแค่ title (ตัด subtitle ออก) เพื่อประหยัดพื้นที่บนจอเล็ก
- เปลี่ยนพฤติกรรม sheet เปลี่ยนภาษาในหน้า `/settings/language`: บันทึกสำเร็จแล้วปิด sheet อัตโนมัติ (ถ้าไม่มี warning)
- ปรับ UI sheet เปลี่ยนภาษาในหน้า `/settings/language` จาก dropdown เป็น list option เพื่อเลือกภาษาได้เร็วขึ้นบนมือถือ
- ปรับ z-index ของ notification dropdown บน desktop เป็น `z-[60]` ให้สอดคล้องกับ mobile
- ปรับ workspace `AP by Supplier` ในหน้า `/stock?tab=purchase`: ย้าย selection action bar ไปไว้ติดกับ list PO และทำ sticky ภายในกรอบ list; ปุ่ม `ล้างเลือก`/`บันทึกชำระแบบกลุ่ม` จะแสดงเมื่อมี selection แล้วเท่านั้น
- ปรับ workspace `AP by Supplier` ในหน้า `/stock?tab=purchase`: ช่อง `Due from / Due to` อยู่บรรทัดเดียวกันบนมือถือเพื่อลดความสูงของโซน filter
- ปรับ sticky search bar หน้า `/products` ให้เปลี่ยน style ตามสถานะ: ตอนปกติ `py-4 + border` และตอน stuck ด้านบน `py-2` (ไม่มี border)
- ปรับ card list item ในแท็บ `ประวัติ` ของหน้า `/stock` ให้ compact มากขึ้นเพื่อ save area บนมือถือ
- ปรับ layout ช่องวันที่เริ่ม/สิ้นสุด (From/To) ในแท็บ `ประวัติ` ของหน้า `/stock` ให้แสดงบรรทัดเดียวกันบนมือถือ (2 คอลัมน์)
- ปรับ date picker ของช่องวันที่ในแท็บ `ประวัติ` ของหน้า `/stock` บนมือถือให้ popover กว้างเต็มแถว (ไม่ตามความกว้าง input)
- แก้แท็บ `บันทึก` (Recording) ของหน้า `/stock`: เลือกสินค้าแล้วไม่ sync ค่าจาก query กลับมาทับ state จนเกิดอาการโหลด current stock วน; ปรับให้ sync จาก URL เฉพาะตอน URL เปลี่ยนจริง และให้ fetch current stock ผูกกับ `productId`
- แท็บ `บันทึก` (Recording) ของหน้า `/stock` แสดงปุ่ม `ดูสินค้าทั้งหมด` บน desktop ด้วย (เดิมมีเฉพาะ mobile)
- แท็บ `บันทึก` (Recording) ของหน้า `/stock` ปรับกล่องคำอธิบาย/คำแนะนำให้ประหยัดพื้นที่: แสดงสรุปแบบบรรทัดเดียว + ปุ่มขยายดูรายละเอียดและคำแนะนำไป PO (ข้อความยังอยู่ครบ)
- ปุ่ม `ໄປແທັບສັ່ງຊື້ (PO)` ในกล่องคำแนะนำของแท็บ `บันทึก` (Recording) ถูกทำให้ตำแหน่งคงที่ (อยู่ที่เดิมทั้งตอนขยาย/ย่อรายละเอียด) เพื่อลด layout shift
- แท็บ `บันทึก` (Recording) ของหน้า `/stock` กรณี `รับเข้า` เปลี่ยนเป็นปุ่มเล็ก “แก้ต้นทุนในหน้าสินค้า” เพื่อพาไปหน้า `/products` แล้วแก้ต้นทุนใน Product Detail ตาม flow ปกติ (ไม่อัปเดตต้นทุนจากแท็บ Recording โดยตรง)
- แก้ build ให้ผ่าน (Next.js 15): ถอด legacy `pages/_app.tsx`, `pages/_document.tsx`, `pages/_error.tsx` (ทำให้ `next build` ล้มด้วย `/_document`) และปรับจุดที่ใช้ `usePathname()`/`useSearchParams()` ให้ handle nullable + memoize เพื่อไม่ให้ dependency ของ hooks เปลี่ยนทุก render
- ปรับสกุลเงินใน PO ให้ตรงกับ `purchaseCurrency` มากขึ้น:
  - [purchase-order-list.tsx](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/components/app/purchase-order-list.tsx) ใช้ `purchaseCurrency` เป็นค่าหลักใน create wizard summary, ราคาต่อหน่วย/ยอดต่อรายการใน detail sheet, และยอดสินค้า (`products subtotal`) ของ PO; ถ้าเป็น PO ต่างสกุลจะแสดง `≈ storeCurrency` เป็นค่ารอง
  - คง `ค่าขนส่ง`, `ค่าอื่น`, `ยอดรวมต้องจ่าย`, `ยอดชำระแล้ว`, และ `ยอดค้าง` เป็น `storeCurrency` ตาม logic เดิม เพราะเป็นยอดฐานร้าน/ยอดปิดบัญชีจริง
  - [generate-po-pdf.ts](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/lib/pdf/generate-po-pdf.ts) กับ mapping ใน [purchase-order-list.tsx](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/components/app/purchase-order-list.tsx) ปรับแล้วให้ตารางสินค้าใน PDF ใช้ `unitCostPurchase` และ line total ตาม `purchaseCurrency` แทนการพิมพ์ `₭` ทุกแถว
  - รอบล่าสุดปรับ `PO detail modal` ฝั่ง mobile เพิ่ม: badge สถานะ (`ຮັບແລ້ວ`) ถูกบังคับให้อยู่บรรทัดเดียว และ action ด้านบน modal เปลี่ยนเป็นปุ่มเต็มความกว้างเรียงลงมาในมือถือ เพื่อกัน `ປິດເຣດ` ล้นจอ; บน `sm+` ยังกลับไปเป็นปุ่มแนวนอนแบบเดิม
  - เพิ่ม i18n ให้ workspace labels ฝั่ง purchase แล้ว: `PO Operations / Month-End Close / AP by Supplier` ถูกแปลเป็น `งานสั่งซื้อ / ปิดรอบปลายเดือน / เจ้าหนี้ตามซัพพลายเออร์` (ไทย) และ `ວຽກສັ່ງຊື້ / ປິດຮອບປາຍເດືອນ / ໜີ້ຄ້າງຈ່າຍຕາມຜູ້ສະໜອງ` (ลาว) รวมถึงข้อความอ้างอิงอย่าง shortcut active และ month-end empty-state
  - modal `บันทึกชำระ PO` เปลี่ยน field `วันที่ชำระ` จาก native date input มาใช้ `PurchaseDatePickerField` ตัวเดียวกับ create/edit/filter ใน [purchase-order-list.tsx](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/components/app/purchase-order-list.tsx) แล้ว
  - รอบล่าสุดขยับ layout พื้นฐานของ `PurchaseDatePickerField` เข้าไปใน component เอง (`inline-flex + items-center + justify-between`) เพื่อลดปัญหา icon ปฏิทินกับข้อความวันที่วางตำแหน่งเพี้ยนในบาง modal เช่น `บันทึกชำระ`

- เพิ่ม pack view จากหน้า `/orders` โดยตรง:
  - `components/app/orders-management.tsx` เพิ่มปุ่ม `หน้าแพ็ก` ใน action ของ order list ทั้ง mobile/desktop
  - เปิด `SlideUpSheet` บนหน้า list แล้วค่อยดึง `GET /api/orders/[orderId]` ตอนเปิดจริง เพื่อลดโหลดถาวรของ `/orders`
  - ใน sheet reuse `OrderPackContent` และกด `พิมพ์ใบแพ็ก` ผ่าน current-page `window.print()` ได้เลย ไม่ต้องเข้า order detail ก่อน
  - รอบนี้เพิ่ม `bulk print ใบแพ็ก` ใน sticky bulk bar ของ `/orders` แล้ว โดยกรองเฉพาะออเดอร์ที่เปิด pack view ได้ และ merge pack slip หลายใบเป็น current-page print document เดียว

- redesign `shipping sticker`:
  - `lib/orders/queries.ts` ขยาย `OrderDetail` ให้มี `storeName`, `storeSenderName`, `storeSenderPhone` โดยใช้ fallback `pdfCompanyName -> store.name` และ `pdfCompanyPhone -> store.phoneNumber`
  - route [orders/[orderId]/print/label](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/app/(app)/orders/[orderId]/print/label/page.tsx) กับ current-page print ใน [order-detail-view.tsx](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/components/app/order-detail-view.tsx) ใช้ layout ใหม่แบบ shipping sticker 100x150mm: ชื่อร้าน, ผู้ฝาก + QR ด้านบน, ผู้รับ, ที่อยู่ปลายทาง, ติ๊ก `ค่าส่ง ต้นทาง/ปลายทาง` สีเขียวเด่นบนพื้นอ่อน, block `COD` ใช้ badge ติ๊กวงกลมสีเขียวเด่นบนพื้นอ่อน, และชื่อขนส่ง + placeholder โลโก้แบบ dashed box
  - รอบล่าสุดเพิ่ม helper กลาง [shipping-label-print.ts](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/lib/orders/shipping-label-print.ts) แล้ว เพื่อให้ route print, current-page print จาก detail, และ bulk print label จากหน้า `/orders` ใช้ markup/styling เดียวกันจริง และไม่หลุดเป็น A6 template เก่าอีก
  - ตัดข้อมูลที่ไม่จำเป็นกับสติกเกอร์ออกแล้ว เช่น `status`, `createdAt`, `shipping cost`, text `QR ออเดอร์`, และ hint ใต้ QR; ถ้าไม่มี tracking จะซ่อนทั้งบรรทัดแทนการพิมพ์ `Tracking: -`

- ปรับ stock tabs ภาษาลาวไม่ให้ตก 2 บรรทัด:
  - ย่อ label หลักเป็น `ສະຕັອກ / ສັ່ງຊື້ / ບັນທຶກ / ປະຫວັດ`
  - `components/app/stock-tabs.tsx` เพิ่ม `whitespace-nowrap` และซ่อน scrollbar UI ของ tab bar เพื่อให้คง single-line แล้วเลื่อนแนวนอนได้แทน

- เพิ่ม PO extra cost currency แบบ pragmatic:
  - `purchase_orders` เพิ่ม `shipping_cost_original`, `shipping_cost_currency`, `other_cost_original`, `other_cost_currency`
  - UX ของ PO create/edit/apply-extra-cost ให้เลือกสกุลเงินของ `ค่าขนส่ง/ค่าอื่น` ได้ระหว่าง `สกุลร้าน` กับ `สกุลซื้อของ PO`
  - ระบบยังคงเก็บ `shippingCost/otherCost` เป็นยอดฐานร้านสำหรับคำนวณ landed cost / outstanding
  - ตอน `ปิดเรท` จะ recalc ทั้งต้นทุนสินค้าและ extra cost ที่ใช้สกุลซื้อของ PO ใหม่พร้อมกัน
  - `db:repair` backfill PO เดิมให้ `*_cost_original = *_cost` และ `*_cost_currency = store currency`

- ปรับ POS quick add ให้เลือกหน่วยขายก่อนถ้าสินค้ามีหลายแพ็ก:
  - `components/app/orders-management.tsx` เปลี่ยน flow กดสินค้า/สแกน/ค้นหาเองใน `/orders/new` จากการ add `units[0]` ทันที เป็นเปิด `SlideUpSheet` เลือกหน่วยขายก่อนเมื่อสินค้ามีหลายหน่วยที่ขายได้ เช่น `1 / 100 / 1000`
  - quantity cap ใน create order ปรับให้คำนวณตาม `multiplierToBase` ของหน่วยที่เลือกแล้ว ทั้งตอนเพิ่มสินค้า, เปลี่ยนหน่วยใน cart, และ restore draft เดิม เพื่อกันขายแพ็กเกินสต็อกฐาน
  - quick add cards แสดงรหัสหน่วยขาย (`unitCode`) เพิ่ม เพื่อให้เห็นตั้งแต่ก่อนกดว่า SKU นี้ขายได้หลายแพ็ก

- เพิ่ม PO purchase units phase แรก:
  - schema `purchase_order_items` เพิ่ม `unit_id`, `multiplier_to_base`, `qty_base_ordered`, `qty_base_received`
  - flow `create/update/receive/finalize-rate/apply-extra-cost` ของ `server/services/purchase.service.ts` ใช้หน่วยซื้อที่เลือกเป็น source input แต่แปลงกลับเป็น `qty_base_*` ก่อนลงสต็อกและคำนวณต้นทุน
  - หน้า `/stock?tab=purchase` เลือกหน่วยซื้อได้ต่อรายการใน create/edit draft, แสดง preview ว่าเท่ากับกี่หน่วยสต็อก, และ detail/PDF ของ PO แสดงทั้งจำนวนหน่วยซื้อและจำนวนฐาน
  - รายงาน/ยอดรวม PO เปลี่ยนไปใช้ `qty_base_ordered` สำหรับ total cost base แล้ว เพื่อให้ยอดตรงกับต้นทุนต่อหน่วยฐานหลังซื้อเป็นแพ็ก
  - เพิ่ม migration `0041_purchase_order_units.sql` และ snapshot `0041_snapshot.json`
  - `scripts/repair-migrations.mjs` รองรับเติม/backfill คอลัมน์ PO units สำหรับฐานเก่า โดย map `unit_id` กลับไป `products.base_unit_id` และคำนวณ `qty_base_*` ย้อนหลังให้

- เพิ่ม `scan to search` ให้หน้า `/orders`:
  - `GET /api/orders` และ query `listOrdersByTab()` รองรับ query `q` แล้วสำหรับค้นหา `orderNo`, `customerName`, และ `contactDisplayName`
  - หน้า `/orders` เพิ่มช่องค้นหาแบบ server-backed พร้อมปุ่มสแกนในหน้า list
  - scanner เดิมของ `OrdersManagement` ถูก reuse เป็น 2 โหมด: ฝั่ง create ยังสแกนสินค้าเหมือนเดิม, ฝั่ง manage จะ parse `QR ออเดอร์` รูปแบบ `ORDER:${orderNo}` แล้ว apply เป็น search query ให้อัตโนมัติ
  - ผลค้นหาผูกกับ URL (`?q=`) และ clear/search ใหม่ได้จากหน้าเดียว โดยคง flow work queue/tab เดิม

- เพิ่ม pack workflow สำหรับออเดอร์ออนไลน์/จัดส่ง:
  - หน้า detail ใช้ `SlideUpSheet` เป็น pack view หลักแล้ว โดยเปิดจากปุ่ม `หน้าแพ็ก` บนหน้าเดิม, reuse pack content เดียวกัน และมีปุ่ม `พิมพ์ใบแพ็ก` ที่พิมพ์ผ่าน `window.print()` บนหน้าเดิม
  - pack modal ปรับเป็น receipt-style บนจอแล้ว: ใช้แถวข้อมูลแบบบิล + ตาราง `รายการ | จำนวน` เป็นแกนหลัก, ย้าย QR/ผู้รับ/ขนส่งให้อยู่ในจังหวะการอ่านเดียวกับบิลเพื่อให้พนักงานแพ็กเช็กของเร็วขึ้น
  - ใบแพ็กที่พิมพ์จากหน้า detail ถูกย่อเป็นขนาด `80mm` แบบเดียวกับใบเสร็จแล้ว และเปลี่ยนเป็น receipt-style layout แบบเรียบ (ลด card/box ใหญ่, บังคับ word-break ใน field ยาว) เพื่อให้พิมพ์บนกระดาษม้วนได้เสถียรกว่าเดิม
  - แก้ปัญหา mobile print ของ pack modal ที่บางครั้งขึ้นหน้าพิมพ์ว่าง: ปุ่ม `พิมพ์ใบแพ็ก` ใน sheet จะปิด modal ก่อน แล้วค่อยเรียก `window.print()` หลัง body scroll lock ถูกปลด
  - แก้ปัญหาฟอนต์ลาวไม่ขึ้นตอนพิมพ์ในหน้า order detail: เพิ่ม `@font-face` ของ `NotoSansLaoLooped-Regular.ttf` ใน global CSS และให้ inline print CSS เลือก `font-family` ตาม `uiLocale` (`lo` ใช้ `NotoSansLaoLooped` ก่อน) แทนการ fix เป็น `ui-sans-serif`
  - route เก่า `/orders/[orderId]/pack` ถูกเปลี่ยนเป็น legacy redirect กลับ `/orders/[orderId]` เพื่อปิด flow pack page แยก แต่ยังกันลิงก์เก่า/บุ๊กมาร์กไม่พัง
  - เพิ่ม helper `lib/orders/print.ts` เพื่อสร้าง `QR ออเดอร์` แบบ stable (`ORDER:${orderNo}`) และ reuse ร่วมกันทั้งหน้า pack กับ shipping label
  - ป้ายจัดส่งทั้ง route `/orders/[orderId]/print/label` และ current-page print จาก detail แสดง QR ประจำออเดอร์แล้ว
  - `components/app/receipt-print-actions.tsx` รองรับ label ปุ่มแบบส่ง props เพื่อให้หน้า print แต่ละแบบใช้ข้อความ/ปลายทางกลับต่างกันได้

- ปรับ UX ช่องแก้ต้นทุนใน product detail modal:
  - ช่อง `ต้นทุน` ตอน edit ไม่ bind ค่า `0` แบบแข็งแล้ว
  - ถ้าต้นทุนเดิมเป็น `0` จะโชว์ช่องว่างพร้อม placeholder `0`
  - ผู้ใช้ลบจนว่างได้ และตอนกด save ระบบจะตีความค่าว่างเป็น `0`
  - เพิ่ม validation ข้อความใหม่ `products.cost.validation.invalidValue` ครบ 3 ภาษา

- ปรับหน้า `/login` ให้ตรงกับ policy ผู้ใช้ที่ถูกสร้างโดยผู้ดูแลระบบ:
  - เอา CTA `Sign up` ออกจากหน้า login หลัก
  - เปลี่ยนท้ายหน้าเป็น helper text ว่าบัญชีถูกสร้างโดย `Superadmin / System Admin` และให้ติดต่อผู้ดูแลถ้ายังไม่มีบัญชี
  - เพิ่มข้อความ i18n ใหม่ใน `auth.login.accountProvisioned` และ `auth.login.contactAdmin` ครบ 3 ภาษา

- เพิ่ม cash flow report UI แล้วที่ `/reports/cash-flow`:
  - ใช้ `server/services/cash-flow-report.service.ts` query summary, trend, by-account totals และ recent ledger feed จาก `cash_flow_entries`
  - เพิ่ม `components/app/cash-flow-filters.tsx` สำหรับ filter `preset/custom date range + direction + entry type + account` โดย reuse shared `DatePickerField`
  - หน้า `/reports` เพิ่ม CTA เปิดรายงาน cash flow โดยตรง และหน้า `/settings` เพิ่มลิงก์ `กระแสเงินสด` ไป route เดียวกัน
  - ใช้ permission เดิม `reports.view` และยังไม่มี API route ใหม่ เพราะหน้าอ่านข้อมูลจาก query layer ฝั่ง server โดยตรง

- เพิ่ม cash flow foundation แบบ operational ledger โดยยังไม่กระโดดไปบัญชีเต็ม:
  - เพิ่ม migration `0039_cultured_mattie_franklin` สร้างตาราง `financial_accounts` และ `cash_flow_entries`
  - อัปเดต `scripts/repair-migrations.mjs` ให้ฐานเก่าที่ใช้ `npm run db:repair` สร้าง/เติม schema ของ `financial_accounts` และ `cash_flow_entries` ได้ด้วย
  - เพิ่ม `server/services/cash-flow.service.ts` สำหรับ resolve/create บัญชีการเงินแบบ lazy:
    - บัญชีระบบ `CASH_DRAWER` และ `COD_CLEARING`
    - map `store_payment_accounts` -> `financial_accounts` เมื่อมีรายการเงินจริงครั้งแรก
  - ผูก auto-post cash flow แล้วใน flow หลัก:
    - `POST /api/orders` สำหรับออเดอร์ที่ชำระทันทีตั้งแต่ตอนสร้าง
    - `PATCH /api/orders/[orderId]` action `confirm_paid` สำหรับการรับเงินจริง, in-store credit settlement, และ COD settle
    - `POST /api/orders/cod-reconcile` สำหรับ bulk COD settle
    - `settlePurchaseOrderPaymentFlow` / `reversePurchaseOrderPaymentFlow` สำหรับ PO payment ledger
  - trade-off รอบนี้: PO payment/reversal ถูกเขียนลง `cash_flow_entries` แล้ว แต่ `accountId` ยังเป็น `null` พร้อม metadata `accountResolution=UNASSIGNED` ไปก่อน เพราะ UI ปัจจุบันยังไม่มี source-account selection; เลือกทางนี้เพื่อไม่เดาบัญชีต้นทางผิด
  - repair script ยังไม่ backfill cash flow entries ย้อนหลังให้ข้อมูลเก่า เพราะ flow เดิมยังไม่มีข้อมูลบัญชีต้นทางครบพอสำหรับการสร้าง ledger ย้อนหลังแบบเชื่อถือได้

- เพิ่มตั้งค่า “ภาษา” (ไทย/ລາວ/English) แบบผูกกับบัญชีผู้ใช้:
  - เพิ่มคอลัมน์ `users.ui_locale` (default `th`)
  - หน้า `/settings/language` เพิ่ม language picker และบันทึกผ่าน `PATCH /api/settings/account` action `update_locale`
  - session จะ sync locale จาก DB เพื่อให้ข้ามอุปกรณ์เห็นค่าเดียวกัน โดยไม่ต้อง logout
  - เมื่อเลือกภาษาเป็นลาว (`lo`) UI จะใช้ฟอนต์ `GoogleSans` (อ่านภาษาลาวชัดขึ้น) จากไฟล์ใน `public/fonts`
  - ชื่อภาษาที่แสดงใน picker ใช้ key `localeName.*` แต่ fix เป็น native labels คงที่ `ไทย / ລາວ / English` ทุก locale
  - หน้า `/onboarding` ย้ายข้อความใน wizard ไปใช้ key กลุ่ม `onboarding.*` ครอบคลุม stepper, ตัวเลือกประเภทร้าน, ฟอร์มตั้งค่าร้าน, channel setup, validation fallback และ modal ยกเลิก
  - ขยาย i18n ต่อในฝั่ง `system-admin/superadmin`:
    - `components/system-admin/system-store-user-config.tsx` และ `components/system-admin/superadmin-management.tsx` ใช้ key กลุ่ม `systemAdmin.storeUserConfig.*` และ `systemAdmin.superadminManagement.*`
    - หน้า `/settings/superadmin/global-config` ใช้ key กลุ่ม `superadmin.globalConfig.*`
    - หน้า `/settings/superadmin/audit-log` ใช้ key กลุ่ม `superadmin.auditLog.*` และเติม action label ที่ยังขาดใน `settings.auditLog.actionLabel.*`
    - เพิ่ม i18n ต่อใน `components/system-admin/system-store-logo-policy-config.tsx`, `components/system-admin/system-branch-policy-config.tsx`, `app/(system-admin)/layout.tsx`, `components/system-admin/system-admin-bottom-nav.tsx`, `app/(system-admin)/system-admin/page.tsx`, `app/(system-admin)/system-admin/config/page.tsx`, และ `app/(app)/settings/superadmin/page.tsx`
    - เพิ่ม key กลุ่ม `systemAdmin.storeLogoPolicy.*`, `systemAdmin.branchPolicy.*`, `systemAdmin.layout.*`, `systemAdmin.nav.*`, `systemAdmin.configCenter.*`, `systemAdmin.dashboard.*`, และ `settings.superadminHome.*` ครบ 3 ภาษา
    - รอบล่าสุดเพิ่ม i18n ต่อใน `app/(app)/settings/superadmin/quotas/page.tsx`, `app/(app)/settings/superadmin/integrations/page.tsx`, `app/(system-admin)/system-admin/config/clients/page.tsx`, และ `app/(system-admin)/system-admin/config/system/page.tsx`
    - เพิ่ม key กลุ่ม `superadmin.quotas.*`, `superadmin.nav.*` ที่ใช้ร่วมกันข้ามหน้า, `superadmin.integrations.storeTypePrefix`, และ `systemAdmin.clientsPage.*` / `systemAdmin.systemPage.*` ครบ 3 ภาษา
    - รอบนี้เพิ่ม i18n ต่อใน `app/(system-admin)/system-admin/config/stores-users/page.tsx`, `app/(system-admin)/system-admin/config/security/page.tsx`, และ `app/(app)/settings/superadmin/security/page.tsx`
    - เพิ่ม key กลุ่ม `systemAdmin.storesUsersPage.*`, `systemAdmin.securityPage.*`, และ `superadmin.security.*` ครบ 3 ภาษา
    - รอบนี้เพิ่ม i18n ต่อใน `app/(app)/settings/superadmin/stores/page.tsx`, `app/(app)/settings/superadmin/stores/store-config/page.tsx`, และ `app/(app)/settings/superadmin/stores/branch-config/page.tsx`
    - เพิ่ม key กลุ่ม `superadmin.storeConfig.*`, `superadmin.branchConfig.*`, และ `superadmin.workspaceBadge` ครบ 3 ภาษา พร้อมแปล store type label ในหน้า stores ให้ใช้ key เดิมของ onboarding แทน enum raw
    - รอบนี้เพิ่ม i18n ต่อใน `components/app/stores-management.tsx` และ `app/(app)/settings/superadmin/users/page.tsx`
    - ส่ง `uiLocale` เข้า `StoresManagement` จาก `app/(app)/settings/stores/page.tsx`, `app/(app)/settings/superadmin/stores/store-config/page.tsx`, และ `app/(app)/settings/superadmin/stores/branch-config/page.tsx` เพื่อให้ flow switch/create ใช้ locale เดียวกับ session
    - เพิ่ม key กลุ่ม `storesManagement.*` และ `superadmin.usersPage.*` ครบ 3 ภาษา ครอบคลุม store/branch switcher, create store, create branch wizard, validation/feedback และ summary/role template/navigation ของหน้า `/settings/superadmin/users`
    - รอบนี้เก็บ i18n ต่อใน `app/(app)/settings/page.tsx`, `app/(app)/settings/superadmin/overview/page.tsx`, และ `app/(system-admin)/system-admin/loading.tsx`
    - หน้า `/settings` ย้าย label store type, summary capability, system-role prefix, admin entry และ channel labels ไปใช้ key/message กลางแทน hardcode
    - หน้า `/settings/superadmin/overview` ใช้ key กลุ่ม `superadmin.overview.*` ครบ 3 ภาษา สำหรับ header, summary cards, top-stores panel และ reuse nav key เดิมของ superadmin
    - `app/(system-admin)/system-admin/loading.tsx` เปลี่ยนมา reuse key `systemAdmin.dashboard.*` แทนข้อความ loading hardcode
  - ปรับหน้า `/orders` ให้เป็น work queue มากขึ้น:
    - `components/app/orders-management.tsx` เพิ่ม `งานถัดไป` และ quick action จากหน้า list โดยตรง สำหรับ flow routine ที่ไม่ต้องกรอกข้อมูลเพิ่ม (`confirm_paid`, `mark_packed`, `mark_shipped`, `submit_for_payment`)
    - mobile card เปลี่ยนจากการเป็นลิงก์ทั้งใบอย่างเดียวมาเป็น card ที่มีปุ่ม `เปิด` และปุ่ม action หลัก
    - desktop table เพิ่มคอลัมน์ `งานถัดไป` และ `การทำงาน`
    - เคสที่ยังต้องกรอกยอด/บัญชีเพิ่ม เช่น COD settlement หรือ in-store credit settlement จะยังพาเปิด detail และมีข้อความกำกับจากหน้า list
    - phase 2 เพิ่ม multi-select และ sticky bulk action bar บนหน้า `/orders`
    - รองรับ bulk routine actions สำหรับรายการที่เลือก (`confirm_paid`, `mark_packed`, `mark_shipped`, `submit_for_payment`) โดยใช้ PATCH action เดิมทีละออเดอร์และสรุปผลสำเร็จ/ไม่สำเร็จให้หลังจบงาน
    - desktop table เพิ่ม checkbox ทั้งหัวตารางและต่อแถว; mobile card เพิ่ม checkbox ต่อรายการและปุ่ม `เลือกทั้งหมดในหน้า`
    - phase 3 เพิ่ม selection summary (`ยอดรวม`, จำนวนใบเสร็จ, จำนวนป้ายจัดส่ง) ใน bulk bar
    - เพิ่ม bulk print `ใบเสร็จ` และ `ป้ายจัดส่ง` จาก selection ในหน้า `/orders` โดยดึง `GET /api/orders/[orderId]` ของแต่ละรายการมา merge เป็นเอกสารพิมพ์ชุดเดียวในหน้าเดิมแล้วเรียก `window.print()`
    - bulk print ป้ายจะพิมพ์เฉพาะรายการที่มีข้อมูลจัดส่งเพียงพอ; ถ้า selection ไม่มีข้อมูลพอ ระบบจะ block และแสดง error ชัดเจน
    - phase 4 เพิ่ม work-queue tabs แบบ server-backed บนหน้า `/orders` แล้ว: `ทุกออเดอร์`, `ต้องยืนยันชำระ`, `ต้องแพ็ก`, `ต้องจัดส่ง`, `รอลูกค้ารับ`, `COD รอปิดยอด`
    - `lib/orders/queries.ts` เป็น source of truth ของ queue filter และ count badge; `app/(app)/orders/page.tsx` กับ `app/api/orders/route.ts` parse `tab` ผ่าน helper เดียวกันแล้ว
    - queue count badge ดึงจาก server พร้อม response `listOrdersByTab` เพื่อให้จำนวนใน pill กับรายการใน tab ใช้เงื่อนไขชุดเดียวกัน
    - ปุ่ม `เลือกทั้งหมดในหน้า` บน header ของ `/orders` เปลี่ยนเป็น control แบบ compact: mobile เป็น icon-only, desktop เป็น icon + label สั้น เพื่อลดการกินพื้นที่ใน header แต่ยังคง `aria-label/title` เต็ม
    - รอบนี้เพิ่ม review sheet จากหน้า `/orders` สำหรับเคสที่ยังต้องกรอกข้อมูลเพิ่ม:
      - `Walk-in/Pickup + ON_CREDIT` เปิด sheet เลือกวิธีรับเงินจริง (`เงินสด/QR`) และบัญชี QR ได้จาก list แล้วค่อยยิง `PATCH /api/orders/[orderId]`
      - `COD รอปิดยอด` เปิด sheet กรอก `ยอดรับจริง + ค่าธรรมเนียม/ค่าหัก` จาก list แล้วค่อยยิง `POST /api/orders/cod-reconcile` แบบรายการเดียว
    - `COD รอปิดยอด` ที่มีสิทธิ์ `orders.cod_return` มีปุ่มรอง `ตีกลับ` จาก list แล้ว: เปิด sheet กรอก `ค่าตีกลับเพิ่ม + เหตุผล/หมายเหตุ` ก่อนยิง `PATCH /api/orders/[orderId]` action `mark_cod_returned`
    - เพิ่ม default queue by role บน `app/(app)/orders/page.tsx`: ถ้า URL ยังไม่มี `tab`, server จะเลือกคิวเริ่มต้นจาก `activeRoleName` + permissions เช่น pack/warehouse -> `TO_PACK`, payment/cashier/sales -> `PAYMENT_REVIEW`, ship/logistics -> `TO_SHIP`, ส่วน `Owner/Manager` เริ่มที่ `ALL`
    - แถบ queue tabs ของ `/orders` ซ่อน scrollbar UI แล้วโดยคง horizontal swipe/slide เดิมไว้ เพื่อให้ header ดูสะอาดขึ้นบนมือถือ
    - `app/(app)/orders/page.tsx` ส่งสิทธิ์ `orders.cod_return` ลง `OrdersManagement` แล้ว เพื่อให้หน้า list/work-queue แสดงปุ่ม `ตีกลับ` เฉพาะ role ที่มีสิทธิ์
    - review sheet `COD ตีกลับ` แยก summary `ต้นทุนขนส่งขาไปเดิม`, `ค่าตีกลับสะสมเดิม`, `ค่าตีกลับเพิ่ม`, และ `ต้นทุนขนส่งรวมหลังตีกลับ` เพื่อกันความสับสนว่า `shippingCost` เป็นค่าขนส่งทางเดียว
    - mobile card ของหน้า `/orders` จัด action ใหม่เมื่อมี `ตีกลับ`: ให้ปุ่มหลักกินเต็มแถวก่อน แล้วค่อยวาง `ตีกลับ` กับ `เปิด` ในแถวล่าง เพื่อแก้ความอัดแน่นของ 3 ปุ่มบนจอเล็ก
  - ปรับปุ่ม `พิมพ์บาร์โค้ด` ใน Product Detail modal ให้พิมพ์บนหน้าเดิมแบบเดียวกับ order print sticker แล้ว:
    - เลิกเปิด popup/new tab และใช้ inline print-root + `window.print()` + cleanup หลัง `afterprint`
    - ถ้า barcode ดูเป็น `EAN8/EAN13` แต่ render ไม่ผ่าน `jsbarcode` ระบบจะ fallback ไปพิมพ์แบบ `CODE128` อัตโนมัติเพื่อลด toast error `ไม่สามารถพิมพ์บาร์โค้ดได้`

- ขยาย i18n ในหน้า Settings/Superadmin เพิ่มเติม:
  - แทนที่ข้อความ hardcode ด้วย `t(uiLocale, ...)` ในหน้า permissions/security/profile/store/users/stores และหน้า `Superadmin: Operations & Governance`
  - เติมคำแปลภาษาอังกฤษสำหรับหน้า `Superadmin: Integrations` ให้ครบชุด key
  - เพิ่มชุดข้อความ `users.*` (th/lo/en) และปรับ `UsersManagement` ให้รองรับหลายภาษาใน flow เพิ่มสมาชิก/แก้ไข/รีเซ็ตรหัสผ่าน
  - แยกข้อความ capability ในหน้า `/settings/permissions` ไปเป็น key `settings.permissions.capability.*` (th/lo/en) และแปล UI ของ `System Admin: Session Policy/Logout` เพิ่มเติม (`systemAdmin.sessionPolicy.*`, `common.logout`)
  - แปล `shell title` และ `preview mode note` บน header ของแอปตาม store type ผ่าน key `storefront.*` (th/lo/en)
  - ปรับ bottom tabs ของ storefront ให้ใช้ key `tab.*` โดยตรง (แทนการพึ่ง label ภาษาไทย hardcode) และรองรับ compact label ผ่าน `compactLabelKey`

- ขยาย i18n ในหน้า `/products` เพิ่มเติม:
  - `ProductsManagement` แทนที่ toast/ข้อความที่ hardcode ด้วย key กลุ่ม `products.cost.*`, `products.clipboard.*`, `products.scanner.*` (th/lo/en)
  - เก็บข้อความ hardcode ในฟอร์ม/หน้ารายละเอียดให้เป็น key เพิ่มเติม (th/lo/en): `products.matrix.*`, `products.variant.*`, `products.form.*`, `products.detail.*`, `products.barcode.print.*`, `products.stockThresholds.*`
  - เพิ่ม action key ที่ใช้ซ้ำได้ เช่น `products.action.save`
  - แก้ชื่อพารามิเตอร์ใน toast renderer ของ barcode scanner เพื่อไม่ชนกับฟังก์ชันแปล `t(...)` (แก้ build error)
  - ปรับปุ่ม `พิมพ์บาร์โค้ด` ใน Product Detail modal ให้พิมพ์บนหน้าเดิมแล้ว (inline print-root + `window.print()` + `afterprint` cleanup) แทนการเปิดแท็บ/หน้าต่างใหม่แบบ popup

- ขยาย i18n ในหน้า `/stock` (หน้าหลักของโมดูลสต็อก) เพิ่มเติม:
  - แทนที่หัวข้อ/คำอธิบาย/ข้อความ no-access และ labels ของแท็บหลักด้วย key กลุ่ม `stock.page.*` และ `stock.tabs.*` (th/lo/en)
  - เพิ่ม `common.loading` เพื่อใช้กับ loading fallback ของ tab views

- แก้ฟอนต์ภาษาลาวใน PO PDF:
  - `lib/pdf/generate-po-pdf.ts` เปลี่ยนไปใช้ไฟล์ที่มีจริงใน `public/fonts` (`NotoSansLaoLooped-Regular.ttf`) เพื่อป้องกันกรณีโหลดฟอนต์ไม่เจอเวลา print/export PO ที่มีภาษาลาว

- ปรับ UX action rail ของ online order ในหน้า `/orders/[orderId]`:
  - ปุ่มหลักเหลือเฉพาะ next step เดียวตามสถานะจริง (`ยืนยันชำระแล้ว/ตรวจสลิปและยืนยันชำระ` -> `แพ็กสินค้า` -> `จัดส่งแล้ว` -> `ยืนยันรับเงินปลายทาง (COD)`)
  - เอาปุ่ม `แพ็กสินค้า` และ `จัดส่งแล้ว` ที่ซ้ำกับ primary action ออกจาก `การทำงานเพิ่มเติม`
  - ข้อความ empty state ของ action rail เปลี่ยนเป็นภาษางาน เช่น `ออเดอร์ออนไลน์นี้จัดส่งแล้ว ไม่มี action หลักเพิ่มเติม`
  - confirm modal ของ `confirm_paid` ปรับ title/description/button ให้สอดคล้องกับบริบท online และ COD มากขึ้น

- ปรับ stepper ของ online order ในหน้า `/orders/[orderId]`:
  - non-COD: `สร้างออเดอร์ -> ยืนยันชำระ -> แพ็กสินค้า -> จัดส่ง`
  - COD: `สร้างออเดอร์ -> แพ็กสินค้า -> จัดส่ง -> ปิดยอด COD`
  - เอา step `ปิดงาน` ออกจาก online flow เพราะไม่มี close action จริงสำหรับทุกเคส

- แก้ build issue ตอน `next build` ที่เคยสะดุดระหว่าง prerender:
  - บังคับ `app/api/stock/current/route.ts` เป็น `force-dynamic`
  - บังคับ `app/(app)/settings/audit-log/page.tsx` เป็น `force-dynamic`
  - ผลคือ `next build` ผ่านแล้วใน sandbox แม้จะยังมี log DNS ของ Turso ระหว่าง collect page data

- ปรับ media upload policy ให้คุม storage cost เข้มขึ้น:
  - `product image`, `shipping label`, และ `payment QR` รับเฉพาะไฟล์ raster (`JPG/PNG/WebP`) แล้ว; ไม่รับ `SVG`
  - ฝั่ง server (`lib/storage/r2.ts`) บังคับ optimize เป็น `WebP` ก่อนเก็บเสมอ และถ้า optimize ไม่สำเร็จจะ reject แทนการ fallback ไปเก็บไฟล์ดิบ
  - หน้า `/products` เพิ่ม client-side compression ก่อนอัปโหลดรูปสินค้า (`640px WebP`)
  - หน้า `/orders/[orderId]` เพิ่ม client-side compression ก่อนอัปโหลดรูปป้ายจัดส่ง (`1600px WebP`)
  - หน้า `/settings/store/payments` ปรับ file picker/validation ให้สอดคล้องกับ policy raster-only ของรูป QR

- ปรับ UX error ตอนอัปโหลดรูปป้ายจัดส่งในหน้า `/orders/[orderId]`:
  - ตรวจชนิดไฟล์และขนาด (`ไม่เกิน 6MB`) ตั้งแต่ฝั่ง client ก่อนยิง `POST /api/orders/[orderId]/shipments/upload-label`
  - เมื่อไฟล์ไม่ผ่าน validation หรือ upload/bind shipping ไม่สำเร็จ ระบบจะแสดง `toast` ทันที
  - คง inline error ไว้ใต้ปุ่ม `อัปโหลด/ถ่ายรูปป้าย` เพื่อให้ผู้ใช้เห็นจุดที่ต้องแก้แม้ toast จะหายไปแล้ว
  - helper text ใต้ปุ่มอัปโหลดระบุข้อจำกัดไฟล์รูป `ไม่เกิน 6MB` ชัดขึ้น
- ปรับ storage ของรูป QR บัญชีรับเงินให้เก็บเป็น `object key/path` ใน DB:
  - `POST/PATCH /api/settings/store/payment-accounts` จะเก็บค่า `upload.objectKey` แทน full public URL สำหรับไฟล์ที่อัปโหลดใหม่
  - ถ้าส่ง `qrImageUrl` เข้ามาเป็น full URL เดิมของ R2/CDN หรือเป็น key/path ของไฟล์ ระบบจะ normalize ให้เป็น key ก่อนบันทึก
  - ตอน query ออกหน้า settings, `/orders/new`, และ `/orders/[orderId]` จะ resolve key กลับเป็น public URL ด้วย `R2_PUBLIC_BASE_URL`
  - ข้อมูลเก่าที่ยังเป็น full URL (`r2.dev`/CDN) ยังอ่านและลบไฟล์ได้เหมือนเดิม

- ปรับ storage ของรูปสินค้าให้เก็บเป็น `object key/path` ใน DB เช่นกัน:
  - `PATCH /api/products/[productId]` (multipart upload image) จะเก็บ `upload.objectKey` ลง `products.imageUrl`
  - ตอน list product, create/update response, และ order catalog ของหน้า POS จะ resolve key กลับเป็น public URL ด้วย `R2_PUBLIC_BASE_URL`
  - ข้อมูลเก่าที่เป็น full URL ยังแสดงรูปและลบไฟล์ได้เหมือนเดิม
  - `next.config.ts` อ่าน `R2_PUBLIC_BASE_URL` แล้วเพิ่ม hostname/path เข้า `images.remotePatterns` อัตโนมัติ เพื่อให้ `next/image` โหลด custom CDN ได้

- ปรับ badge สถานะในหน้า `/orders` สำหรับ online order:
  - เลิกแปล `status=PENDING_PAYMENT` เป็น `ค้างจ่าย` แบบเหมารวมใน list
  - badge หลักของ online จะเป็น `รอดำเนินการ` แทน เพื่อสื่อสถานะงาน
  - badge รองอ่านจาก `paymentMethod/paymentStatus` เช่น `ยังไม่ชำระ`, `รอตรวจสลิป`, `COD`, `COD รอปิดยอด`, `ชำระแล้ว`
  - ใช้ helper เดียวกันทั้ง mobile card list และ desktop table เพื่อลดความคลาดเคลื่อนของการแสดงผล

- ปรับ UX เลือก `บัญชีรับเงิน (QR)` ใน modal checkout ของ `/orders/new`:
  - หลังเลือกบัญชี QR จะมี section `แสดง QR` แบบพับ/เปิด (default ปิด)
  - เมื่อเปิดจะแสดงรูป QR, ชื่อบัญชีที่แสดง, ธนาคาร, ชื่อเจ้าของบัญชี, และเลขบัญชีด้านล่าง พร้อมปุ่ม `คัดลอกเลขบัญชี`
  - บนการ์ดรูป QR มีปุ่มไอคอน `เปิดรูปเต็ม` และ `ดาวน์โหลด`
  - `เปิดรูปเต็ม` เปลี่ยนเป็น preview overlay ในหน้าเดิมเพื่อไม่หลุดจาก flow checkout; ภายใน overlay มี action รอง `เปิดแท็บใหม่`, `ดาวน์โหลด`, และ `ปิด`
  - ปุ่มดาวน์โหลดเปลี่ยนไปเรียก route same-origin `GET /api/orders/payment-accounts/[accountId]/qr-image?download=1` ก่อน เพื่อลดปัญหา CORS/CDN download; ถ้าไม่สำเร็จจะ fallback ไปเปิดรูปในแท็บใหม่

- ปรับ section `ชำระด้วย QR โอนเงิน` ในหน้า `/orders/[orderId]`:
  - หน้า detail ตัด field `ลิงก์หลักฐานการชำระ`, placeholder `https://...`, และปุ่ม `แนบหลักฐาน / ส่งรอตรวจสอบ` ออกแล้ว เพื่อให้ตรงกับ workflow ใช้งานจริงในลาว
  - เคส `Walk-in + ชำระแล้ว` ยังคงเหลือเฉพาะรูป QR + ชื่อบัญชี + ธนาคาร + เลขบัญชีแบบ read-only
  - เพิ่มปุ่ม `ดูรูปเต็ม` และ `ดาวน์โหลด QR` ให้บล็อก QR summary ในหน้า detail แล้ว; ปุ่มดาวน์โหลดจะใช้ route same-origin ก่อนและ fallback เปิดรูปในแท็บใหม่ถ้าดาวน์โหลดไม่สำเร็จ
  - เคส `Pickup/Online` ให้พนักงานตรวจสลิปจากแชต/ช่องทางภายนอก แล้วค่อยกด action หลัก `ยืนยันชำระแล้ว` หรือ `ตรวจสลิปและยืนยันชำระ` ในหน้า detail แทนการบันทึกลิงก์ลงออเดอร์; backend `confirm_paid` เลิกบังคับ `paymentSlipUrl` สำหรับ flow นี้แล้ว
  - reopen checkout modal แล้ว section นี้จะกลับไปปิดเสมอ เพื่อลดความยาวของฟอร์มในจอเล็ก

- ปรับ section `การส่งข้อความ` ในหน้า `/orders/[orderId]`:
  - เอาปุ่ม `Send QR` และข้อความอ้างว่า `ส่งอัตโนมัติได้` ออกแล้ว
  - เปลี่ยนหัวข้อเป็น `ข้อความสำหรับส่งลูกค้า`
  - ปุ่มเป็น contextual actions ตาม channel จริงของออเดอร์: `คัดลอกข้อความ` มีเสมอ, `เปิด WhatsApp` จะแสดงเฉพาะออเดอร์ WhatsApp ที่มี deep link, `เปิด Facebook` จะแสดงเฉพาะออเดอร์ Facebook
  - เพิ่มข้อความชัดเจนว่า system ยังไม่เชื่อม Facebook/WhatsApp API จริง จึงต้องส่งเองจากภายนอก

- ปรับ UX modal `ชำระเงินและรายละเอียดออเดอร์` ในหน้า `/orders/new`:
  - เพิ่ม option `scrollToTopOnOpen` ใน `SlideUpSheet` (default `false`)
  - เปิดใช้กับ checkout sheet เพื่อให้ทุกครั้งที่เปิด modal จะเริ่มจากด้านบนของฟอร์มเสมอ (ไม่ค้างตำแหน่ง scroll เดิม)

- ปรับบล็อก `การจัดส่ง` ในหน้า `/orders/[orderId]` (โหมดออนไลน์) เป็น manual upload-first:
  - เอาช่องกรอก manual (`ขนส่ง/เลขพัสดุ/ลิงก์/ต้นทุน`) และ action เก่า (`สร้าง Shipping Label`, `ส่งข้อมูลจัดส่งให้ลูกค้า`) ออกจากบล็อกนี้
  - คงเฉพาะสรุปข้อมูลจัดส่ง + preview รูปล่าสุด + ปุ่มเดียว `อัปโหลด/ถ่ายรูปป้าย`
  - เมื่อกดปุ่มจะเปิด chooser แบบ `SlideUpSheet` ให้เลือก `เลือกรูปจากเครื่อง` หรือ `ถ่ายรูปจากกล้อง`; บนมือถือเป็น slide-up และ swipe down ปิดได้, ถ้าเครื่อง/ browser ไม่รองรับกล้องจะ disable option กล้องแทน
  - หลังอัปโหลดสำเร็จ ระบบจะ PATCH `update_shipping` ให้อัตโนมัติทันที (ไม่ต้องกดบันทึกซ้ำ)
  - มือถือรองรับการเปิดกล้องโดยตรงผ่าน input `capture="environment"` เมื่อเลือกทาง `ถ่ายรูปจากกล้อง`
  - ถ้ามีรูปป้ายอยู่แล้ว จะมีปุ่ม `ลบรูปป้าย` พร้อม custom confirm modal; การลบรอบนี้จะเคลียร์เฉพาะ `shippingLabelUrl` ออกจากออเดอร์และคงข้อมูลขนส่งอื่นไว้

- ปรับการแสดง `ช่องทาง` ในหน้า `/orders`:
  - desktop เพิ่มคอลัมน์ `ช่องทาง` ใหม่ (แสดงค่าในรูป `Facebook • LAK • COD`) และคอลัมน์ `ยอดรวม` เหลือเฉพาะยอดเงิน
  - ใช้ข้อความเดียวกันทุกหน้าจอเป็น `Facebook` / `WhatsApp` / `Walk-in` / `Pickup`
  - mobile คงรูปแบบบรรทัดเดียวเดิม และแสดงเป็น `Facebook • LAK • COD` (ไม่มี prefix `ช่องทาง`/`จ่าย`)

- ปรับสถานะเริ่มต้นของการสร้างออเดอร์ `ONLINE_DELIVERY` ใน `POST /api/orders`:
  - จากเดิม `DRAFT` เปลี่ยนเป็น `PENDING_PAYMENT` ทันที
  - จองสต็อก (`RESERVE`) ตั้งแต่ตอนสร้างออเดอร์ออนไลน์ เพื่อไม่ต้องกด action เพิ่มในหน้า detail
  - ไม่กระทบ flow เดิมของ `Walk-in` และ `Pickup later`

- ปรับระบบพิมพ์ใน success modal ของหน้า `/orders/new` ให้รองรับ iOS ดีขึ้น:
  - เปลี่ยนจาก hidden iframe (`iframe.contentWindow.print()`) เป็น `window.print()` บนหน้าเดิม
  - ใช้ print-root + print CSS เพื่อพิมพ์เฉพาะบิล/สติ๊กเกอร์ (ไม่พิมพ์ทั้งหน้า)
  - ปุ่มพิมพ์จะรอให้ preview พร้อมก่อน เพื่อหลีกเลี่ยงเคส mobile iOS บล็อก print หลัง async

- ปรับระบบพิมพ์หน้า `/orders/[orderId]` ให้รองรับ iOS ดีขึ้น:
  - เปลี่ยนจาก hidden iframe (`iframe.contentWindow.print()`) เป็น `window.print()` บนหน้าเดิม
  - ตอนกดพิมพ์ ระบบจะ inject print-root เฉพาะเอกสารที่ต้องพิมพ์ (`ใบเสร็จ`/`ป้ายจัดส่ง`) และใช้ print CSS ซ่อนคอนเทนต์อื่นทั้งหมด
  - ผลลัพธ์คือยังคง UX “พิมพ์ในหน้าเดิม” โดยไม่พิมพ์ทั้งหน้า และลดปัญหาปุ่มพิมพ์ไม่ทำงานบน mobile iOS

- ปรับคำใน badge สถานะออเดอร์:
  - เปลี่ยนจาก `รอชำระ` เป็น `ค้างจ่าย` ในหน้า `/orders` และ `/orders/[orderId]`
  - สถานะผสมปรับตาม เช่น `รับสินค้าแล้ว (รอชำระ)` -> `รับสินค้าแล้ว (ค้างจ่าย)`

- ปรับ UX สถานะในหน้า `/orders` ให้แยกเคสรับที่ร้านที่จ่ายแล้ว/ค้างจ่าย:
  - ขยาย `OrderListItem` และ query `listOrdersByTab` ให้คืน `paymentStatus` ใน `GET /api/orders`
  - สถานะหลักยังคงเป็น `รอรับที่ร้าน` แต่เพิ่ม badge รองจาก `paymentStatus`:
    - `PAID/COD_SETTLED` => `ชำระแล้ว`
    - `PENDING_PROOF` => `รอตรวจสลิป`
    - อื่น ๆ => `ค้างจ่าย`
  - แสดงผลทั้ง mobile card list และ desktop/tablet table ของหน้า `/orders`

- ปรับดีไซน์ `สถานะงาน` ในหน้า `/orders/[orderId]`:
  - Mobile ใช้ `ขั้นปัจจุบัน + progress bar` และ stepper compact 1 แถว (`flex-1` ต่อขั้น) พร้อม label 2 บรรทัดเพื่อเห็นครบและไม่ล้นจอ
  - Desktop/Tablet ใช้ stepper แนวนอนบรรทัดเดียว พร้อมเส้นเชื่อมระหว่างขั้น
  - คงลำดับขั้นตาม flow เดิม (`walk-in`, `pickup`, `online`) แต่ visual ชัดขึ้นและสแกนสถานะเร็วขึ้น
  - แก้ bug overflow บน mobile: เอา `-mx` ออกจาก container stepper, เพิ่ม `min-w-0` ที่ rail หลัก, และปรับ stepper ให้ไม่ใช้ `w-max/nowrap`
  - เสริม guard ที่ root ของหน้า detail ด้วย `overflow-x-hidden` กันกรณีข้อความยาวผิดปกติดันหน้าเกินจอ

- เพิ่ม flow pickup แบบ 2 ลำดับในหน้า `/orders/[orderId]` และ API:
  - รองรับทั้ง `ยืนยันรับชำระ -> ยืนยันรับสินค้า` และ `ยืนยันรับสินค้า (ค้างจ่าย) -> ยืนยันรับชำระ`
  - เพิ่ม action ใหม่ `mark_picked_up_unpaid` ใน `PATCH /api/orders/[orderId]` เพื่อรับสินค้าไปก่อน (ปล่อยจอง+ตัดสต็อก) แล้วเปลี่ยนสถานะเป็น `PICKED_UP_PENDING_PAYMENT`
  - ปรับ `confirm_paid` ให้รองรับสถานะ `PICKED_UP_PENDING_PAYMENT` (ปิดยอดโดยไม่ตัดสต็อกซ้ำ) และปรับเคส `READY_FOR_PICKUP + ยังไม่จ่าย` ให้เป็นยืนยันรับชำระอย่างเดียวก่อน
  - ถ้าออเดอร์หน้าร้าน (`Walk-in/Pickup`) อยู่ในโหมด `ค้างจ่าย` (`paymentMethod=ON_CREDIT`) modal `ยืนยันรับชำระ` จะให้เลือกวิธีรับเงินจริงเป็น `เงินสด` หรือ `QR โอน`; ถ้าเลือก QR ต้องเลือกบัญชี QR ของร้านก่อนบันทึก และ modal จะแสดง preview QR พร้อมชื่อบัญชี/ธนาคาร/เลขบัญชี, ปุ่ม `คัดลอกเลขบัญชี`, ปุ่มไอคอน `ดูรูปเต็ม`, และปุ่มไอคอน `ดาวน์โหลด`
  - ฝั่ง API `confirm_paid` จะรับ `paymentMethod/paymentAccountId` สำหรับ in-store credit settlement เท่านั้น และจะอัปเดตค่าบน order ให้ตรงกับการรับเงินจริง โดยไม่บังคับแนบสลิปสำหรับ QR ที่รับชำระหน้าเคาน์เตอร์
  - ปรับ `submit_payment_slip` ให้รองรับ `PICKED_UP_PENDING_PAYMENT`
  - ปรับ `cancel` ให้แยกการคืนสต็อกตาม movement จริง: เคสยังจองใช้ `RELEASE`, เคสรับสินค้าแล้วใช้ `RETURN`
  - หน้า detail เพิ่มปุ่ม `ยืนยันรับสินค้า (ค้างจ่าย)` พร้อม custom confirm modal และซ่อน `การทำงานเพิ่มเติม` สำหรับสถานะ `PICKED_UP_PENDING_PAYMENT`
  - ปรับ badge/label/filter/report ให้รองรับสถานะใหม่ (`PICKED_UP_PENDING_PAYMENT`) ครบทั้ง list/reports/query layer

- ปรับ UX หน้า `/orders/[orderId]` ให้เป็น flat/no-card:
  - เอาโครง card ซ้อนหลายชั้นออก แล้วใช้เส้นคั่น section (`border-b`) + spacing เพื่อใช้พื้นที่คุ้มขึ้น โดยเฉพาะหน้าจอเล็ก
  - เพิ่ม badge บอก `ประเภท flow` (`Walk-in ทันที` / `มารับที่ร้านภายหลัง` / `สั่งออนไลน์/จัดส่ง`) ที่ header ของ detail
  - ซ่อนบล็อก `การจัดส่ง` อัตโนมัติเมื่อเป็นออเดอร์หน้าร้าน/รับที่ร้านที่ไม่มีข้อมูลจัดส่ง เพื่อลด noise
  - ปุ่ม action ใน detail ปรับถ้อยคำไทยให้ชัด (`ยืนยันแพ็กแล้ว`, `ยืนยันจัดส่งแล้ว`, `ยกเลิกออเดอร์`)
  - เคส `Walk-in + ชำระแล้ว` ปรับเป็นหน้าสรุปจบงาน: action rail ซ่อน `แพ็ก/จัดส่ง` และซ่อนข้อความ `ไม่มีป้าย` แต่ยังมี `พิมพ์ใบเสร็จ` และ `ยกเลิกออเดอร์` (เมื่อผู้ใช้มีสิทธิ์) เพื่อรองรับการแก้รายการหน้างาน
  - แก้เงื่อนไข `Walk-in ปิดงาน` ให้ยึด `status=PAID` เท่านั้น (ไม่ใช้ `paymentStatus=PAID` อย่างเดียว) เพื่อให้เคส `READY_FOR_PICKUP + PAID` ยังเห็นปุ่ม `ยืนยันรับสินค้า`
  - เคส `Walk-in + ยกเลิกแล้ว` ซ่อนเมนู `การทำงานเพิ่มเติม` ใน action rail เพื่อลดความสับสน (ไม่มี action ต่อใน flow นี้)
  - เคส `Walk-in + รอชำระ` ซ่อนเมนู `การทำงานเพิ่มเติม` ใน action rail เพื่อให้หน้าโฟกัสแค่ `ยืนยันชำระ` และ `ยกเลิกออเดอร์`
  - เคส `มารับที่ร้านภายหลัง + รอรับที่ร้าน` (ทั้งจ่ายแล้ว/ยังไม่จ่าย) ซ่อนเมนู `การทำงานเพิ่มเติม` ใน action rail เพื่อให้หน้าโฟกัส action หลัก (`ยืนยันชำระ/ยืนยันรับสินค้า/ยกเลิกออเดอร์`)
  - ปุ่ม `ยืนยันรับชำระ` และ `ยืนยันรับสินค้า` (รับที่ร้าน/จ่ายแล้ว) ในหน้า detail เพิ่ม custom confirm modal ก่อนส่ง action `confirm_paid`
  - ซ่อน `ข้อมูลลูกค้า` อัตโนมัติเมื่อเป็นค่า default ของ walk-in (`ลูกค้าหน้าร้าน` + โทร/ที่อยู่ว่าง)
  - ปรับ `รายการสินค้า` ให้อ่านง่ายขึ้นแบบ 2 แถวต่อสินค้า (ชื่อ+ยอดบรรทัด / SKU+จำนวน+หน่วยฐาน) และปรับ summary ด้านล่างให้ตัวเลขชิดขวา (`tabular-nums`) เพื่อสแกนยอดเร็วขึ้น
  - บนจอ `lg+` (รวม tablet แนวนอน) ปรับรายการสินค้าเป็นตารางแนวบิล `รายการ | จำนวน | รวม` เพื่อให้การอ่านเหมือน desktop
  - ปรับ breakpoint หน้า detail ให้ action rail ด้านขวาเริ่มที่ `lg` (tablet แนวนอนใช้ layout เดียวกับ desktop)
  - รวมปุ่มพิมพ์ใบเสร็จที่ซ้ำกันให้เหลือ action เดียวใน action rail และเปลี่ยนพิมพ์ใบเสร็จ/ป้ายเป็น `window.print()` + print-root ในหน้าเดิม (ไม่เปิดแท็บใหม่)
  - แก้ issue พิมพ์ครั้งแรกข้อมูลว่างในหน้า detail: เปลี่ยน flow ให้ iframe โหลดปลายทางด้วย `autoprint=1` แล้วให้หน้าพิมพ์เรียก `window.print()` เองหลัง render data แทนการสั่งจาก parent เร็วเกินไป
  - ปรับการแสดงผลสกุลเงินในหน้า detail/หน้าพิมพ์ให้ใช้ symbol (`₭`, `฿`, `$`) แทนรหัส (`LAK`, `THB`, `USD`) ในจุดแสดงยอดหลัก
  - เอา text link `กลับไปหน้ารายการขาย` ออกจากหน้า detail เพื่อลดปุ่มซ้ำกับ navigation หลักของระบบ

- ปรับ UX หน้า `/orders` ในตาราง desktop/tablet:
  - คลิกได้ทั้งแถวเพื่อเปิดรายละเอียดออเดอร์ (`/orders/[orderId]`) และรองรับคีย์บอร์ด (`Enter`/`Space`)
  - คงตัวอักษรเลขออเดอร์เป็นสีเน้นเพื่อสื่อว่าเป็นรายการที่เปิดดูต่อได้

- ปรับ matrix สถานะสร้างออเดอร์ให้ตรง flow หน้างาน (Walk-in/Pickup):
  - `Walk-in ทันที + เงินสด/QR/โอน` -> สร้างเป็น `PAID` และลง movement `OUT` ทันที
  - `Walk-in ทันที + ค้างจ่าย` -> สร้างเป็น `PENDING_PAYMENT` และลง movement `RESERVE`
  - `มารับที่ร้านภายหลัง` -> สร้างเป็น `READY_FOR_PICKUP` และลง movement `RESERVE` เสมอ; ถ้าชำระแล้วจะตั้ง `paymentStatus=PAID` แต่ยังไม่ตัดสต็อกจนกดยืนยันรับสินค้า
  - ปรับ `confirm_paid` ให้รองรับเคส `READY_FOR_PICKUP + paymentStatus=PAID` เป็นการยืนยันรับสินค้า (ปล่อยจอง+ตัดสต็อก) และไม่บังคับสลิปซ้ำ

- เพิ่ม policy ยกเลิกออเดอร์แบบ step-up approval ในหน้า `/orders/[orderId]`:
  - ผู้กดปุ่มยกเลิกต้องมีสิทธิ์ส่งคำขออย่างน้อยหนึ่งสิทธิ์ (`orders.update` หรือ `orders.cancel` หรือ `orders.delete`)
  - รองรับ 2 โหมดยืนยัน:
    - `Owner/Manager` ยืนยันเองด้วย `เหตุผล + สไลด์ยืนยัน` (`approvalMode=SELF_SLIDE`)
    - role อื่นยืนยันด้วย `อีเมลผู้อนุมัติ + รหัสผ่านผู้อนุมัติ + เหตุผล` (`approvalMode=MANAGER_PASSWORD`)
  - API ตรวจ role ฝั่ง server ว่าโหมด `SELF_SLIDE` ใช้ได้เฉพาะ `Owner/Manager` เท่านั้น
  - เมื่อยกเลิกสำเร็จ จะเก็บ `cancelReason` และข้อมูลผู้อนุมัติ (`approvedBy*`) ใน audit metadata
  - ปรับ UI จาก inline form เป็น modal กลางแบบ adaptive ตาม role (คอมโพเนนต์เดียวสำหรับ reuse)
  - เพิ่ม throttle ฝั่ง UI ในโหมดรหัสผ่าน: ถ้ายืนยันไม่สำเร็จติดกันหลายครั้ง ระบบจะพักการยืนยันชั่วคราว (cooldown) ก่อนลองใหม่
  - หน้า detail แสดงสรุป `การอนุมัติยกเลิก` หลังยกเลิกสำเร็จ โดยอ่านจาก `audit_events` (`order.cancel`) เช่น เหตุผล, ผู้อนุมัติ, ผู้กดยกเลิก, เวลาอนุมัติ
  - ปุ่ม `ยกเลิกออเดอร์` ย้ายมาอยู่ action rail หลักของหน้า detail แล้ว (ไม่ซ่อนใน `การทำงานเพิ่มเติม`) เพื่อกดได้ทันที
  - เพิ่มเอกสารเทส `docs/UAT_CANCEL_APPROVAL.md` (6 เคส) ให้ทีมใช้ทดสอบ flow เดียวกัน

- เพิ่ม `Shipping Provider Master` สำหรับ flow ออนไลน์:
  - เพิ่มตารางใหม่ `shipping_providers` (migration `0037_bouncy_leper_queen.sql`) เก็บ master ต่อร้าน (`code`, `displayName`, `branchName`, `aliases`, `active`, `sortOrder`)
  - `getOrderCatalogForStore` คืน `catalog.shippingProviders` จากตารางจริง และมี fallback ค่า default ถ้ายังไม่ได้ migrate
  - หน้า `/orders/new` เปลี่ยนจาก hardcode ขนส่งเป็นอ่านปุ่ม grid จาก `catalog.shippingProviders` + ปุ่ม `อื่นๆ`
  - เพิ่มหน้า settings `/settings/store/shipping-providers` + component `store-shipping-providers-settings` สำหรับจัดการรายการขนส่ง (เพิ่ม/แก้ไข/ปิดใช้งาน/ลบ)
  - เพิ่ม API `/api/settings/store/shipping-providers` (`GET/POST/PATCH/DELETE`) สำหรับ CRUD master ขนส่งของร้าน
  - `POST /api/onboarding/store` seed provider เริ่มต้นให้ร้านใหม่อัตโนมัติ (`Houngaloun`, `Anousith`, `Mixay`)
  - `scripts/repair-migrations.mjs` รองรับสร้างตาราง + index + backfill provider default ให้ฐานเดิม

- เพิ่ม `COD Reconcile Panel (MVP)` สำหรับปิดยอด COD รายวันแบบหลายรายการ:
  - หน้าใหม่ `/orders/cod-reconcile` (client: `components/app/orders-cod-reconcile.tsx`)
  - หน้า `/orders` เพิ่มปุ่มลัด `ปิดยอด COD รายวัน` (แสดงเฉพาะผู้มีสิทธิ์ `orders.mark_paid`)
  - รองรับ filter `dateFrom/dateTo`, `provider`, `q` และ pagination
  - ผู้ใช้แก้ `ยอดโอนจริง` + `codFee` รายรายการ แล้วเลือกหลายรายการเพื่อ `ยืนยันปิดยอดที่เลือก` ได้
  - รอบนี้เพิ่ม action รอง `ตีกลับ` ต่อแถวในหน้า `/orders/cod-reconcile` แล้ว: ถ้า role มีสิทธิ์ `orders.cod_return` จะเปิด review sheet กรอก `ค่าตีกลับเพิ่ม + เหตุผล/หมายเหตุ` ก่อนยิง `PATCH /api/orders/[orderId]` action `mark_cod_returned`
  - รอบนี้ redesign หน้า `/orders/cod-reconcile` เป็น mobile-first ขึ้น: ใช้ filter card ด้านบน, date range เปลี่ยนไปใช้ shared custom date picker (`components/ui/date-picker-field.tsx`), แถวรายการเป็น card ที่อ่านตัวเลขง่ายขึ้น, และย้าย CTA batch ไปเป็น sticky bar ด้านล่างเมื่อมี selection
  - ลำดับ filter ปรับใหม่ให้ search อยู่บนสุดเต็มความกว้าง แล้วค่อยเป็น `ส่งตั้งแต่/ส่งถึง/ขนส่ง/วันนี้/รีเฟรช` เพื่อลดความรู้สึกเป็นฟอร์ม 4 ช่องและให้ mobile หาออเดอร์ได้เร็วกว่าเดิม; รอบล่าสุดตัด label ด้านบนของ search ออกแล้วใช้ช่องค้นหาพร้อม icon ซ้าย + `aria-label` แทน เพื่อให้หน้าเบาและ clean กว่าเดิม และบังคับ dropdown `ขนส่ง` ให้ใช้ความกว้างเต็ม cell เพื่อให้แนวตรงกับ date picker มากขึ้น
  - มี summary card real-time (ยอดต้องได้/ยอดโอนจริง/codFee/ส่วนต่าง) จากรายการที่เลือก + สรุปร่างข้อมูลทั้งหน้าปัจจุบัน
  - API ใหม่:
    - `GET /api/orders/cod-reconcile` ดึงรายการ COD pending reconcile
    - `POST /api/orders/cod-reconcile` ปิดยอดแบบ batch, เขียน audit action `order.confirm_paid.bulk_cod_reconcile`, invalidate cache dashboard/reports, และรองรับ `Idempotency-Key` กันปิดยอดซ้ำ
  - query helper ใหม่ `listPendingCodReconcile` ใน `lib/orders/queries.ts`

- แก้ปัญหา dropdown หน่วยสินค้าในหน้า create order แจ้ง React key ซ้ำ (`unit_ea`):
  - ปรับ `getOrderCatalogForStore` ให้ dedupe `units` ต่อสินค้าโดยยึด `unitId` ไม่ซ้ำ
  - คงข้อมูล base unit เป็นตัวหลัก แล้วเพิ่ม conversion เฉพาะ unit ที่ยังไม่ถูกใส่
  - ลดโอกาสเจอ warning `Encountered two children with the same key` ในฟอร์มตะกร้า/checkout

- แก้เคสเลือก `สั่งออนไลน์/จัดส่ง` แล้วเลือก `COD` แต่ยังโดน validation เด้งว่าใช้ COD ไม่ได้:
  - เพิ่ม `checkoutFlow` ใน `defaultValues` ของ create order form และ sync ทุกครั้งที่เปลี่ยนประเภทออเดอร์
  - ทำให้ `zodResolver(createOrderSchema)` เห็น `checkoutFlow=ONLINE_DELIVERY` จริงขณะ validate `paymentMethod=COD`

- ขยาย COD return flow ตามงานหน้างานจริง:
  - เพิ่มคอลัมน์ `orders.cod_return_note` พร้อม migration (`0036_ambiguous_nuke.sql`) เพื่อเก็บเหตุผล/หมายเหตุตีกลับ
  - หน้า `/orders/[orderId]` (order detail) ในบล็อก COD เพิ่ม textarea `เหตุผล/หมายเหตุ` ตอนกด `ตีกลับเข้าร้าน (COD)` และแสดงหมายเหตุที่บันทึกไว้ในสรุป COD
  - API `PATCH /api/orders/[orderId]` action `mark_cod_returned` รองรับ `codReturnNote` เพิ่มจากเดิม (`codFee`) และบันทึกลงออเดอร์พร้อม audit metadata
  - `scripts/repair-migrations.mjs` รองรับเติมคอลัมน์ `orders.cod_return_note` ให้ฐานเก่าที่ยังไม่มีคอลัมน์นี้

- ขยายรายงาน COD ให้เห็นต้นทุนตีกลับชัดขึ้น:
  - `getCodOverviewSummary` เพิ่ม metric `returnedTodayCodFee` และ `returnedCodFee` (รวม `codFee`)
  - ตาราง `แยกตามขนส่ง` เพิ่มคอลัมน์ metric `returnedCodFee` ต่อผู้ให้บริการ
  - หน้า `/reports` แสดง `ค่าตีกลับวันนี้` และ `ค่าตีกลับสะสม (codFee)` แล้ว เพื่อใช้ติดตามต้นทุนตีกลับรายวัน/รายขนส่ง

- อัปเดต COD settlement/return flow ในหน้า `/orders/[orderId]` และ API:
  - ปุ่ม `ยืนยันรับเงินปลายทาง (COD)` รองรับกรอก `ยอดที่ขนส่งโอนจริง` ก่อนยิง `confirm_paid` (payload `codAmount`)
  - ปุ่ม `ตีกลับเข้าร้าน (COD)` รองรับกรอก `ค่าตีกลับ` ก่อนยิง `mark_cod_returned` (payload `codFee`)
  - backend จะบวก `codFee` เข้า `shippingCost` และสะสมในคอลัมน์ `codFee` เพื่อรองรับเคสต้นทุนค่าส่งมารู้ทีหลัง
  - การ์ดสรุปใน order detail แสดงเพิ่ม `ต้นทุนขนส่งรวม` และ `ค่าตีกลับ COD` เพื่ออ่านผลกำไร/ขาดทุน COD ได้ตรงขึ้น

- ปรับ post-create flow ของหน้า POS (`/orders/new`) ให้แยกตามประเภทออเดอร์:
  - หลังสร้างสำเร็จ:
    - ทุกหน้าจอ (Desktop/Tablet/Mobile และทั้ง mode manage/create-only): แสดง success action sheet ในหน้าเดิมก่อน
  - action หลักใน sheet คือพิมพ์เอกสาร (`พิมพ์ใบเสร็จ` / `พิมพ์ใบรับสินค้า`) และมีทางเลือก `ดูรายละเอียดออเดอร์` หรือ `ออเดอร์ใหม่ต่อ`
  - เพิ่ม preview บิลใน success action sheet โดยโหลดข้อมูลออเดอร์จริงจาก `GET /api/orders/[orderId]`
  - flow `สั่งออนไลน์/จัดส่ง` เพิ่มบล็อก `ข้อมูลสติ๊กเกอร์จัดส่ง` (ผู้รับ/โทร/ที่อยู่/ขนส่ง/tracking/ต้นทุนค่าส่ง) และปุ่ม `พิมพ์สติ๊กเกอร์จัดส่ง`
  - flow `มารับที่ร้านภายหลัง` และ `สั่งออนไลน์/จัดส่ง` มีปุ่ม `ออเดอร์ใหม่ต่อ` ใน success action sheet เพื่อปิด modal แล้วเริ่มออเดอร์ใหม่ได้ทันที
  - หน้า `/orders/new` เพิ่มปุ่ม `ล่าสุด` ใต้แถบค้นหา: เปิด `SlideUpSheet` รายการออเดอร์ล่าสุด 8 รายการจาก `GET /api/orders` พร้อมปุ่ม `เปิดสรุป` (reopen success action sheet) และ `ดูรายละเอียด`
  - รายการ `ออเดอร์ล่าสุด` เพิ่มปุ่ม `ยกเลิก` แล้ว (เฉพาะสิทธิ์ `orders.update/cancel/delete`) และใช้ modal กลางตัวเดียวกับหน้า detail ก่อนยิง `PATCH /api/orders/[orderId]` action `cancel` (Owner/Manager ใช้โหมดสไลด์, role อื่นใช้โหมดรหัสผ่าน Manager)
  - ปุ่มพิมพ์ใน success action sheet พิมพ์ผ่าน `window.print()` + print-root เหมือนกันทุกหน้าจอ (ไม่เปิดแท็บใหม่/ไม่เปลี่ยนหน้า)
  - หน้า `/orders/[orderId]/print/receipt` เพิ่ม print CSS ซ่อน `header/bottom nav` ระหว่างพิมพ์ เพื่อกันการติด layout แอปในบิล
  - สำหรับ `พิมพ์สติ๊กเกอร์จัดส่ง`: ใช้ `window.print()` ในหน้าเดิมทุกหน้าจอ (ไม่เปิดแท็บใหม่)
  - ใน success action sheet ของ `สั่งออนไลน์/จัดส่ง` ปรับ block เป็น `ตัวอย่างสติ๊กเกอร์จัดส่ง` แบบการ์ด preview (แทน text list เดิม) เพื่อให้ visual ใกล้เคียง `ตัวอย่างบิล`

- ปรับ feedback ตอนเพิ่มสินค้าหมดสต็อกในหน้า POS:
  - การ์ดสินค้า `หมดสต็อก/ติดจอง` ยังกดได้ แต่ระบบจะไม่เพิ่มลงตะกร้า
  - เมื่อกดจะขึ้น toast error ทันทีว่าเพิ่มไม่ได้ และมี throttle กัน toast ซ้ำรัว

- ปรับ layout ปุ่ม `สร้างออเดอร์` ใน modal checkout หน้า `/orders/new`:
  - ย้ายปุ่ม submit ไปอยู่ `SlideUpSheet.footer` แทน sticky ในเนื้อหา form
  - ลดปัญหาพื้นหลังโปร่ง/เห็น card ใต้ปุ่มตอนเลื่อนใน modal และทำให้ safe-area ด้านล่างสม่ำเสมอ

- ปรับ flow ออนไลน์ใน modal checkout ให้รองรับช่วงยังไม่เชื่อม CRM/API ลูกค้า:
  - ช่องทางออนไลน์เปลี่ยนจาก dropdown เป็นปุ่มแบบ grid (`Facebook`, `WhatsApp`, `อื่นๆ`)
  - ถ้าเลือก `อื่นๆ` จะมี input `แพลตฟอร์มอื่น (ไม่บังคับ)` สำหรับช่วยกรอกหน้างาน (ยังไม่ผูก schema ช่องทางจริง)
  - ช่อง `เลือกลูกค้า` เปลี่ยนเป็นไม่บังคับ (`contactId` optional)
  - ถ้าไม่เลือกจากรายชื่อ ผู้ใช้ยังสร้างออเดอร์ได้โดยกรอกชื่อ/เบอร์เอง
  - ปรับ UI เป็น section พับ/เปิด (`+ เลือกจากรายชื่อลูกค้า`) เพื่อลดความรกของฟอร์มและเปิดเฉพาะตอนต้องการ
  - เพิ่มช่อง `เติมข้อมูลลูกค้าแบบเร็ว` สำหรับ paste ข้อความดิบแล้วแยก `ชื่อ/เบอร์/ที่อยู่` อัตโนมัติเบื้องต้น
  - เพิ่ม section `ข้อมูลขนส่ง` ใน online flow:
    - เลือก `ผู้ให้บริการขนส่ง` แบบ grid จาก `shipping_providers` ของร้าน + ปุ่ม `อื่นๆ`
    - ค่าเริ่มต้นเป็นว่าง (ไม่ auto select) และผู้ใช้ต้องเลือกเองก่อนกดสร้างออเดอร์
    - ถ้าเลือก `อื่นๆ` กรอกชื่อผู้ให้บริการได้แบบอิสระ
    - เอาช่อง `สาขาที่รับฝาก` ออกจากฟอร์ม checkout online แล้ว (เก็บเฉพาะ provider)

- ปรับ CTA หน้า `/orders` ให้เหลือทางเดียวในการเริ่มขาย:
  - เอาปุ่ม `สร้างด่วน` ออกจากหน้า manage orders
  - เปลี่ยนปุ่ม `สร้างออเดอร์` เป็น `เข้าโหมด POS` และพาไป `/orders/new` โดยตรง
  - ถอด quick-create modal ออกจากหน้า `/orders` เพื่อให้ UX ตัดสินใจเร็วขึ้น (single primary action)

- ปรับ UX `สกุลที่รับชำระในออเดอร์นี้` ใน modal checkout ของ create order:
  - ถ้าร้านรองรับสกุลเดียว ระบบจะ auto-select ให้และแสดงเป็น read-only (ไม่แสดง dropdown/chip ให้เลือกซ้ำ)
  - ถ้ารองรับหลายสกุล เปลี่ยนจาก dropdown เป็นปุ่มเลือกแบบ chips เพื่อกดเลือกได้เร็ว
  - เพิ่ม normalization ในฟอร์มให้ `paymentCurrency` อยู่ในรายการที่รองรับเสมอ (fallback อัตโนมัติเมื่อค่าปัจจุบันไม่ถูกต้อง/หายไป)

- ปรับ UX ตะกร้าใน create order (`/orders` และ `/orders/new`):
  - ปุ่ม `ลบ` ในการ์ดตะกร้าทุกมุมมอง (mobile preview, panel ขวา, cart sheet, และ row editor desktop) ลบได้จนเหลือ `0` รายการแล้ว
  - การ์ดสินค้าในตะกร้า (panel ขวา + cart sheet) แสดงบรรทัด `คงเหลือ ...` ต่อรายการ เพื่อช่วยตัดสินใจตอนปรับจำนวน

- ปรับพฤติกรรม modal `ชำระเงินและรายละเอียดออเดอร์` ใน create order:
  - กดนอก modal (backdrop) แล้วจะไม่ปิด
  - ถ้ากดปิดและมีข้อมูล checkout ที่กรอก/ปรับแล้ว จะขึ้น custom confirm ก่อนปิด
  - ถ้ายังไม่มีข้อมูล checkout ที่กรอก/ปรับ จะปิดได้ทันทีโดยไม่ขึ้น confirm

- ปรับหัวหน้า `/orders/new` ให้กระชับขึ้น:
  - เอาการ์ด header ทั้งบล็อกที่มี `step 1-3` และ `สรุปตะกร้า` ออก
  - ผลลัพธ์คือหน้าเริ่มที่ส่วนค้นหา/สินค้าโดยตรง ทำให้เห็นรายการสินค้าได้เร็วขึ้น

- ปรับ cart panel ฝั่ง tablet/desktop ใน `/orders/new`:
  - บังคับให้ footer (`ยอดรวม` + ปุ่ม `ถัดไป: ชำระเงิน`) ติดอยู่ด้านล่าง panel ตลอด
  - รายการสินค้าในตะกร้าจะเป็นส่วนที่ scroll ได้เอง เพื่อลดเคสต้องเลื่อนหน้าลงเพื่อกดชำระเงิน
  - แก้ issue summary ตะกร้าไม่อัปเดตตามข้อมูลจริงบางจังหวะ: เปลี่ยนจาก `form.watch` หลักไปใช้ `useWatch` และคำนวณ subtotal/cartQty จาก state ปัจจุบันโดยตรง เพื่อให้ยอดรวม/จำนวนชิ้นอัปเดตทันทีเมื่อแก้ qty/หน่วย/ลบรายการ
  - เสริมความเสถียร sticky rail: ตั้ง `md:items-start` ให้ layout grid และคำนวณ `top`/`height` ของ cart rail แบบไดนามิกจากความสูงจริงของ search sticky (`ResizeObserver`) โดยจูนค่าปัจจุบันเป็น `CREATE_ONLY_CART_STICKY_GAP_FALLBACK_PX=13` และ `CREATE_ONLY_CART_STICKY_EXTRA_TOP_PX=13`
  - breakpoint sticky ปัจจุบันตั้ง `TABLET_MIN_WIDTH_PX=1200` เท่ากับ `DESKTOP_MIN_WIDTH_PX=1200` แบบ intentional เพื่อให้ tablet/desktop ใช้สูตร sticky เดียวกัน
  - ปุ่มลัด `ดูตะกร้า` และ sticky checkout bar บนมือถือของ `/orders/new` ปรับ `bottom` เป็น `calc(env(safe-area-inset-bottom) + 0.75rem)` เพื่อให้ติดก้นจอจริงและลดช่องว่างลอยด้านล่าง

- ปรับ UX ตัวกรองสินค้าใน create order ให้เรียบขึ้น:
  - เอา filter เรียงสินค้า (`แนะนำ`, `ชื่อ A-Z`, `ราคาต่ำ-สูง`, `ราคาสูง-ต่ำ`) ออกจากหน้า `/orders/new`
  - เอา dropdown `เรียง` ใน quick add POS-lite (หน้า `/orders`) ออกด้วย เพื่อให้ behavior สอดคล้องกัน

- ปรับโครง sticky ของหน้า `/orders/new`:
  - บล็อกค้นหาด้านบน (search + filter + category chips + scanner helper) ตั้งเป็น sticky ติดบนตลอด และถอดสไตล์การ์ดออกให้เป็น full-width
  - แถว `ค้นหา + สแกน + filter สต็อก` จัดเป็น 3 คอลัมน์บรรทัดเดียวบนมือถือ และย่อ label filter เป็น `มีสต็อก`/`มีสต็อก✓`
  - ปรับ sticky search ลงอีกเล็กน้อยเป็น `top-[3.8rem]` ทั้ง mobile/desktop และคง `border-b` ใต้บล็อก เพื่อให้ตำแหน่งบาลานซ์ขึ้น
  - ดึง container ของหน้า create ขึ้น (`-mt-4`) เพื่อลบช่องว่างระหว่าง navbar กับ search section
  - cart panel ฝั่ง tablet/desktop ยังคง sticky ขวา และ footer ปุ่มชำระเงินติดล่างเหมือนเดิม

- ปรับ layout contract สำหรับ tablet/desktop ให้สอดคล้องกันทั้ง shell + overlay:
  - เปลี่ยนเกณฑ์ desktop จาก `>=1024px` เป็น `>=1200px` ใน app shell และ navbar fullscreen logic
  - app shell หลัก (`(app)` และ `system-admin`) ใช้โหมด tablet (`768-1199px`) แบบเต็มจอพร้อม padding `px-6`, และ desktop (`>=1200px`) แบบ constrained พร้อม padding `px-8`
  - ปรับความกว้าง desktop shell เป็น `80rem` และเตรียม token โหมดกว้าง `90rem` สำหรับหน้าข้อมูลหนาแน่น
  - `SlideUpSheet` ปรับพฤติกรรมเป็น 3 ช่วงชัดเจน:
    - mobile `<768px` = bottom sheet + drag handle
    - tablet `768-1199px` = centered sheet (`min(45rem, 100vw-2rem)`, `max-h: 92dvh`)
    - desktop `>=1200px` = centered modal (ใช้ `panelMaxWidthClass` เฉพาะ desktop)
  - bottom nav ทั้ง app และ system-admin ถูก constrain เฉพาะ desktop (`>=1200px`) เพื่อให้ tablet ใช้งานเต็มความกว้าง
  - quick inbox threshold ฝั่ง navbar เปลี่ยนตามนิยามใหม่: non-desktop = `<1200px`
  - phase 2: migrate custom modal/sheet ที่ยังไม่ได้ใช้ `SlideUpSheet` (users, categories, units, store payment accounts, stores management, force-change password modal) ให้เริ่ม centered mode ที่ `>=768px` และใช้ drag/mobile behavior เฉพาะ `<768px` ตาม contract ใหม่
  - phase 3: ย้าย modal/sheet จาก custom implementation เข้า `SlideUpSheet` กลางครบแล้ว (`/settings/categories`, `/settings/units`, `/settings/store/payments`, `/settings/users`, `/settings/stores`, และ force-change password modal ใน `/login`) โดยคง behavior เดิมของฟอร์ม/validation/API
  - รอบล่าสุดปรับ UX `/login` เพิ่ม quick wins ฝั่ง perceived performance:
    - ปุ่ม `เข้าสู่ระบบ` แสดง spinner icon จริง และ disable input/demo buttons ระหว่าง submit/redirect
    - หลัง login สำเร็จเปลี่ยนจาก `window.location.assign` เป็น `router.replace() + router.refresh()` เพื่อลด full reload และให้ transition เนียนขึ้น
    - `POST /api/auth/login` ขนาน `getUserMembershipFlags` กับ `buildSessionForUser` และข้าม permission lookup สำหรับ store type ที่ไม่ใช่ `ONLINE_RETAIL`

- ปรับ scanner ของหน้า `/orders` และ `/orders/new` ให้ใช้มาตรฐานเดียวกับหน้าอื่น:
  - ย้ายจาก scanner logic ที่ฝังใน `orders-management.tsx` มาใช้คอมโพเนนต์กลาง `components/app/barcode-scanner-panel.tsx`
  - เพิ่ม permission sheet ก่อนเปิดกล้อง (`ยกเลิก` + `อนุญาตและสแกน`) แบบเดียวกับ `/products` และ `/stock`
  - พฤติกรรมเปิด/ปิดกล้อง, เลือกกล้อง, manual barcode fallback, และ cleanup stream ตอนปิด ถูก unify กับหน้าที่ใช้ scanner อื่น ๆ แล้ว
  - policy สำหรับงานถัดไป: หากเพิ่มปุ่ม `สแกนบาร์โค้ด` ในหน้าใหม่ ให้ใช้ `BarcodeScannerPanel` + permission sheet มาตรฐานเดียวกัน (ไม่แยกเขียน logic กล้องใหม่ในหน้า)

- ปรับ performance ของ work-queue tabs หน้า `/orders`:
  - ลดงานฝั่ง server ตอนเปลี่ยน tab โดยรวม `queueCounts` จากหลาย count query ให้เหลือ aggregate query เดียว
  - ฝั่ง client เปลี่ยน tab เป็น optimistic มากขึ้น: tab ที่กดจะ active ทันทีพร้อม spinner badge ระหว่างรอ response
  - ใช้ `router.replace(..., { scroll: false })` สำหรับ tab change เพื่อลด jump/back-stack noise และคง scroll behavior ให้เนียนขึ้นบน mobile
  - content area ใต้ tabs แสดง skeleton ทันทีระหว่าง transition ทั้ง mobile/desktop เพื่อไม่ค้างแสดงรายการของ tab เดิม
  - route `/orders` เปลี่ยนมาใช้ `getOrderManageCatalogForStore()` แทน `getOrderCatalogForStore()` เพื่อตัด payload/query ที่ไม่จำเป็นกับหน้า manage ออก โดยคงข้อมูลขั้นต่ำที่หน้านี้ยังใช้จริง (`storeCurrency`, supported currencies, active payment accounts); full catalog ยังโหลดเฉพาะ `/orders/new`
  - checkbox หน้า row ของ `/orders` แสดงบน mobile ตามเดิม ส่วน desktop ซ่อน checkbox และปุ่ม `เลือกทั้งหน้า` ไว้จนกว่าจะเข้า `Bulk select` mode ใน header; เมื่อเข้าโหมดนี้ click ทั้งแถวจะ select/unselect และไม่ open detail, แต่ยังเข้า detail ได้ผ่านปุ่ม `เปิด` ในคอลัมน์ action; ออกจากโหมดแล้วจะล้าง selection และ desktop กลับไป click แถวเพื่อ open detail ตามเดิม

- ปรับค่าเริ่มต้นฟอร์มสร้างออเดอร์ให้ตะกร้าว่าง:
  - `defaultValues.items` ใน `orders-management.tsx` เปลี่ยนเป็น `[]` (ไม่ preload สินค้าตัวแรกอัตโนมัติ)
  - มีผลกับ flow สร้างออเดอร์หน้า `/orders/new`

- เพิ่ม draft persistence ให้หน้า `/orders/new`:
  - บันทึก draft create order (ตะกร้า + checkout fields + checkout flow) ลง `sessionStorage` ระหว่างผู้ใช้กรอกฟอร์ม
  - ถ้า refresh หน้า `/orders/new` จะกู้คืน draft ล่าสุดอัตโนมัติ (TTL 60 นาที)
  - ถ้ากดยืนยันออกจากหน้า create order ผ่านปุ่ม back (`กลับรายการออเดอร์`) หรือ logout ระบบจะล้าง draft ทิ้งทันที

- เพิ่มหน้าใหม่ `/orders/new` สำหรับสร้างออเดอร์แบบหน้าเต็ม (full create flow):
  - หน้า `/orders` ปรับบทบาทเป็น “จัดการออเดอร์” และใช้ action หลักเดียว `เข้าโหมด POS` (ไป `/orders/new`)
  - `/orders/new` ใช้คอมโพเนนต์/validation/API ชุดเดียวกับ flow เดิม (`POST /api/orders`) เพื่อลด drift
  - `/orders/new` ปรับเป็น POS-style UI: ตัด heading/description ของหน้า create ออก, แถบ `ค้นหา + สแกน`, product card grid, และ sticky cart/checkout action bar บนมือถือ
  - เพิ่มความกว้าง app shell บน desktop จาก `70rem` เป็น `76rem` เพื่อให้หน้า POS/หน้าจัดการข้อมูลมีพื้นที่ใช้งานมากขึ้น
  - product card รองรับรูปย่อสินค้า (`imageUrl`) พร้อม fallback placeholder
  - ย่อ product card ในหน้า `/orders/new` ให้ compact ขึ้นบนมือถือ (ลด padding/ขนาดรูป/ขนาดตัวอักษรเล็กน้อย) เพื่อเพิ่มจำนวนสินค้าที่เห็นต่อจอ
  - product picker รองรับ `ค้นหา + สแกนบาร์โค้ด + category chips + filter เฉพาะมีสต็อก`
  - เอา sidebar `เลือกหมวดเร็ว` ออกจาก layout หน้า `/orders/new` (desktop) เพื่อไม่ซ้ำกับ category chips ที่อยู่ใต้ search
  - ปรับการ์ดรายการในตะกร้าให้ minimal ทั้ง panel ด้านขวาและ cart sheet: ตัดข้อมูลรอง (SKU/คงเหลือ) และลดขนาดแถวให้โฟกัสที่ `หน่วย + จำนวน +/- + ยอด`
  - แก้ความกว้างช่อง `select หน่วย` ในตะกร้าให้เท่ากันทุกแถว โดย lock ความกว้างคอลัมน์ยอดบรรทัด (ลดอาการ select แกว่งตามจำนวนหลักของราคา)
  - เพิ่ม stock guard ฝั่ง UI ใน create order:
    - ถ้า `available <= 0` product card ยังแสดงสถานะ `หมดสต็อก/ติดจอง` และกดได้ แต่ระบบจะไม่เพิ่มลงตะกร้า พร้อมแจ้ง toast ว่าเพิ่มไม่ได้
    - ปุ่ม `+` ในตะกร้าเพิ่มจำนวนได้ไม่เกิน `available` เท่านั้น (รวมเคสเหลือ 1 ชิ้นเพิ่มได้สูงสุด 1)
  - checkout เพิ่มตัวเลือก `ประเภทออเดอร์` 3 แบบ: `Walk-in ทันที` / `มารับที่ร้านภายหลัง` / `สั่งออนไลน์/จัดส่ง`
  - ฟอร์ม checkout แสดง field แบบ dynamic ตามประเภทออเดอร์ (เช่น ช่องทาง+ลูกค้า+ที่อยู่จะแสดงเฉพาะ flow ออนไลน์)
  - โหมด `Walk-in ทันที` ซ่อนฟิลด์ `ชื่อลูกค้า`/`เบอร์โทร` เพื่อให้ flow หน้าร้านเร็วขึ้น และจะ clear ค่าลูกค้าเดิมอัตโนมัติเมื่อผู้ใช้สลับกลับมา Walk-in
  - โหมด `มารับที่ร้านภายหลัง` พับฟิลด์ `ชื่อลูกค้า`/`เบอร์โทร` เป็นค่าเริ่มต้น แล้วค่อยเปิดกรอกด้วยปุ่ม `+ เพิ่มข้อมูลผู้รับ (ไม่บังคับ)`; ถ้ายังพับอยู่จะแสดงสถานะสรุปข้อมูลผู้รับแทน
  - ดีไซน์ `ส่วนลด` ใน checkout เปลี่ยนเป็น panel เดียว: เปิด/ปิดส่วนลด, preset 5%/10%/20%, สลับกรอก `%` หรือ `จำนวนเงิน`, และแสดงส่วนลดที่คิดจริงแบบ real-time โดยไม่เปลี่ยน contract ค่า `discount` เดิม; แถว `จำนวนเงิน/%/preset` รวมเป็นบรรทัดเดียวและรองรับ scroll แนวนอนบนจอแคบ พร้อมเส้นคั่นระหว่างกลุ่มโหมดกับ preset เพื่อแยกความหมายชัดขึ้น
  - ดีไซน์ `ค่าขนส่ง` ใน checkout ออนไลน์ปรับเป็น panel พับ/เปิดแบบเดียวกับส่วนลดและ default ปิด; เมื่อกดปิดจะรีเซ็ต `ค่าส่งที่เรียกเก็บ` และ `ต้นทุนค่าส่ง` กลับเป็น `0`
  - ปรับ layout desktop ของ checkout ออนไลน์ให้ `ส่วนลด` และ `ค่าขนส่ง` อยู่บรรทัดเดียวแบบ 2 คอลัมน์เท่ากัน (1:1)
  - ดีไซน์ `วิธีรับชำระ` ใน checkout เปลี่ยนจาก dropdown เป็นปุ่มเลือกแบบ chips: หน้าร้าน/รับที่ร้าน = `เงินสด`, `QR`, `ค้างจ่าย`; ออนไลน์ = `เงินสด`, `QR`, `ค้างจ่าย`, `COD` และเพิ่ม enum ใหม่ `ON_CREDIT` สำหรับค้างจ่าย
  - validation ฝั่ง client ตาม flow: `Walk-in ทันที` และ `มารับที่ร้านภายหลัง` ไม่บังคับชื่อ/เบอร์ (แนะนำให้กรอกอย่างน้อย 1 อย่างถ้าทราบ), ส่วน `สั่งออนไลน์/จัดส่ง` ยังบังคับเบอร์โทร+ที่อยู่จัดส่ง และเปิด `COD` เฉพาะ flow ออนไลน์
  - ฝั่ง API `POST /api/orders` รองรับ `checkoutFlow` (optional) พร้อม matrix ล่าสุด: `Walk-in จ่ายแล้ว => PAID+OUT`, `Walk-in ค้างจ่าย => PENDING_PAYMENT+RESERVE`, `Pickup later => READY_FOR_PICKUP+RESERVE` (จ่ายแล้วตั้ง `paymentStatus=PAID` แต่ยังไม่ OUT), และออนไลน์เริ่มที่ `PENDING_PAYMENT+RESERVE`
  - ฝั่ง API `PATCH /api/orders/[orderId]` เปิดให้ `confirm_paid`/`submit_payment_slip` ใช้ได้กับสถานะ `READY_FOR_PICKUP`; `confirm_paid` รองรับเคสรับสินค้าหน้าร้านที่จ่ายล่วงหน้า (`READY_FOR_PICKUP + paymentStatus=PAID`) เพื่อปล่อยจอง+ตัดสต็อกโดยไม่บังคับสลิปซ้ำ, และการ `cancel` จากสถานะนี้จะปล่อยจองสต็อก (`RELEASE`) กลับ
  - อัปเดต flow COD ในหน้า detail/route:
    - `mark_packed` รองรับ COD จาก `PENDING_PAYMENT` และจะลง movement `RELEASE+OUT` ตอนแพ็ก (ไม่ต้องรอ paid)
    - `confirm_paid` สำหรับ COD ใช้ปิดยอดหลัง `SHIPPED` เท่านั้น โดยอัปเดต `paymentStatus=COD_SETTLED` + `codSettledAt`
    - เพิ่ม action `mark_cod_returned` สำหรับ COD ตีกลับจาก `SHIPPED + COD_PENDING_SETTLEMENT` เพื่อคืนสต็อก (`RETURN`) และเปลี่ยนสถานะเป็น `COD_RETURNED` (`paymentStatus=FAILED`)
    - เพิ่ม permission ใหม่ `orders.cod_return` สำหรับ action `mark_cod_returned` และบังคับใช้งานแบบ strict (เลิก fallback `orders.ship`)
    - เพิ่มคอลัมน์ `orders.cod_returned_at` และเซ็ตตอนตีกลับสำเร็จ
  - หน้า `/reports` เพิ่ม section `สรุป COD`: ค้างเก็บเงิน, ปิดยอดวันนี้, ตีกลับวันนี้, ตีกลับสะสม, COD สุทธิสะสม และแยกผลตามผู้ให้บริการขนส่ง (daily return ใช้ `cod_returned_at`)
  - ผู้ใช้เลือกสินค้าในหน้า POS ก่อน แล้วกด `ชำระเงิน / กรอกรายละเอียด` เพื่อเปิด Checkout sheet (ลูกค้า/ชำระเงิน/ที่อยู่)
  - sticky action bar บนมือถือปรับเป็น summary + ปุ่มลัด `ตะกร้า` และปุ่มหลักเดียว `ถัดไป: ชำระเงิน` เพื่อให้ flow checkout ง่ายขึ้น
  - ปุ่ม `ตะกร้า` บน sticky bar มือถือขยายพื้นที่กดและเพิ่มขนาดตัวอักษร (`h-9`, `text-sm`, `font-semibold`) เพื่อกดง่ายขึ้น
  - รีดีไซน์ `/orders/new` รอบล่าสุดเป็น `Scan-First POS`:
    - Desktop (`>=1200px`) เป็น 3 คอลัมน์ (`หมวด/ทางลัด`, `สินค้า`, `ตะกร้า`)
    - Tablet (`768-1199px`) เป็น 2 คอลัมน์ (`สินค้า`, `ตะกร้า`)
    - Mobile (`<768px`) คง 1 คอลัมน์ + sticky checkout bar
  - เพิ่ม step indicator 3 ขั้นด้านบน (`เพิ่มสินค้า`, `ตรวจตะกร้า`, `ชำระเงิน`) เพื่อให้เห็น progress ชัดเจนขึ้นระหว่างทำรายการ
  - ตะกร้าใน tablet/desktop ปรับเป็น inline editor ที่แผงขวา (แก้หน่วย, ปรับจำนวน, ลบสินค้า) ลดการสลับเข้าออก sheet ระหว่างคิดบิล
  - ปุ่ม `สแกนบาร์โค้ด` บนแถบค้นหา `/orders/new` เปลี่ยนจากข้อความเป็น icon-only button พร้อม `aria-label` และ `title`
  - Cart sheet มี action ต่อไป Checkout ได้ทันที และยังกลับไปเลือกสินค้าได้
  - เพิ่ม guard permission ในหน้าใหม่: ถ้าไม่มี `orders.view` จะไม่ให้เข้า และถ้าไม่มี `orders.create` จะเห็นข้อความไม่มีสิทธิ์สร้าง
  - ซ่อน bottom tab navigation อัตโนมัติเมื่ออยู่หน้า `/orders/new` และลดความสูงจองพื้นที่ nav เพื่อให้โหมด create บนมือถือโฟกัสมากขึ้น
  - ปุ่ม back บน navbar สำหรับหน้า `/orders/new` เปลี่ยน label เป็น `กลับรายการออเดอร์` และใช้ custom confirm dialog ก่อนออกเมื่อมี draft ค้าง (แทน browser confirm)
  - ถอดลิงก์ `กลับไปหน้ารายการขาย` ด้านล่างหน้าออก เพื่อลดปุ่มซ้ำและให้ผู้ใช้ใช้ปุ่ม back ใน navbar เป็นทางหลัก
  - checkout sheet ปรับให้ flow กระชับขึ้นโดยตัดปุ่ม `เปิดตะกร้า` ใน step รายละเอียดออก (คงปุ่มกลับไปเลือกสินค้า)
  - เพิ่ม fallback ชื่อลูกค้าอัตโนมัติทั้งฝั่ง client+API เมื่อไม่กรอกชื่อ (`ลูกค้าหน้าร้าน` / `ลูกค้าออนไลน์`)

- เพิ่มฟีเจอร์ราคาขายหน่วยแปลงแบบกำหนดเอง (optional):
  - schema `product_units` เพิ่มคอลัมน์ `price_per_unit` (nullable)
  - ฟอร์มเพิ่ม/แก้ไขสินค้าใน `/products` เพิ่มช่องราคาต่อหน่วยแปลงต่อแถว (เช่น PACK) โดยถ้าไม่กรอกจะใช้สูตรเดิม `ราคาหน่วยหลัก x ตัวคูณ`
  - การคำนวณยอดใน `/orders` และ `/orders/new` รวมถึง `POST /api/orders` เปลี่ยนเป็นใช้ราคาของหน่วยที่ผู้ใช้เลือกจริง
  - fallback compatibility: ข้อมูลสินค้าเดิมที่ไม่มี `price_per_unit` ยังทำงานได้เหมือนเดิม
  - อัปเดต `scripts/repair-migrations.mjs` ให้เติมคอลัมน์ `product_units.price_per_unit` อัตโนมัติสำหรับฐานที่ข้าม migration
  - ปรับ UI มือถือในส่วน `การแปลงหน่วย` ให้แถวกรอกข้อมูลเป็น 2 บรรทัด (บรรทัดแรกเลือกหน่วย+ลบ, บรรทัดสองกรอกตัวคูณ+ราคา) เพื่อลดความแคบและพิมพ์ผิด

- เพิ่ม sales-unit controls สำหรับธุรกิจที่เก็บสต็อกเป็นชิ้นแต่ขายเป็นแพ็ก:
  - schema `products` เพิ่ม `allow_base_unit_sale` (default `true`)
  - schema `product_units` เพิ่ม `enabled_for_sale` (default `true`)
  - หน้า `/products` เพิ่ม toggle ว่า `หน่วยหลักขายใน POS ได้ไหม` และ checkbox ต่อหน่วยแปลงว่า `เปิดขายใน POS`
  - `getOrderCatalogForStore()` จะส่งไป `/orders/new` เฉพาะหน่วยที่เปิดขาย และจะซ่อนสินค้าทั้งตัวจาก POS ถ้าไม่มีหน่วยขายเหลือเลย
  - โครงสต็อก/ต้นทุนไม่เปลี่ยน: inventory ยังเก็บและตัดเป็น `qtyBase` ตามหน่วยหลักเหมือนเดิม

- ปรับ UX ฟอร์มสร้างออเดอร์หน้า `/orders` ให้เป็น mobile-first แบบ POS-lite:
  - เพิ่ม quick add section (`ค้นหา SKU/ชื่อ/บาร์โค้ด`) และการ์ดสินค้าแบบแตะครั้งเดียวเพื่อเพิ่มเข้าตะกร้า
  - คง flow สแกนบาร์โค้ด + fallback manual search เดิม แต่จัด hierarchy ให้เพิ่มสินค้าได้เร็วขึ้น
  - บนมือถือ แสดง cart preview แบบย่อ (2 รายการแรก) และปุ่ม sticky `ดูตะกร้า`
  - เพิ่ม `ตะกร้าสินค้า` sheet สำหรับแก้จำนวน (+/-), เปลี่ยนหน่วย, ลบรายการ และดูยอดรวมก่อนกดสร้างออเดอร์
  - บน tablet/desktop คง row editor รายการสินค้าแบบเดิมเพื่อแก้รายละเอียดได้รวดเร็ว

- ปรับแท็บ `/stock?tab=inventory` เพิ่ม filter หมวดหมู่สินค้า:
  - หน้า `ดูสต็อก` เพิ่ม dropdown `ทุกหมวดหมู่/หมวดหมู่สินค้า` และผูกกับ URL query `inventoryCategoryId`
  - ขยาย API `GET /api/stock/products` ให้รองรับ query `categoryId` เพื่อกรองข้อมูลแบบ server-side ให้ตรงกับ pagination
  - เมื่อเปลี่ยนหมวดหมู่ ระบบจะ reload หน้า 1 อัตโนมัติ (ไม่ใช้แค่กรอง client-side บนข้อมูลที่โหลดมาแล้ว)

- ปรับ UI หน้า `/products` (mobile):
  - แก้ตำแหน่งปุ่มลอย `เพิ่มสินค้า` (FAB) จาก `bottom-20` เป็นการคำนวณจาก `--bottom-tab-nav-height + env(safe-area-inset-bottom)` เพื่อลดเคสปุ่มทับ bottom tab bar ตอนเลื่อนหน้า

- ปรับแท็บ `/stock?tab=inventory` (ดูสต็อก) ให้ใช้งานจริงได้ครบขึ้น:
  - เพิ่ม toolbar มาตรฐานของแท็บ (`รีเฟรชแท็บนี้` + `อัปเดตล่าสุด`)
  - เพิ่ม data flow แบบแบ่งหน้า (`GET /api/stock/products?page&pageSize`) พร้อมปุ่ม `โหลดเพิ่ม` แทนการเห็นเฉพาะ 20 รายการแรก
  - sync ตัวกรองหลักลง URL (`inventoryQ`, `inventoryFilter`, `inventorySort`) เฉพาะตอนแท็บ `inventory` active เพื่อแชร์ลิงก์มุมมองเดียวกันได้โดยไม่ชนกับแท็บอื่น
  - ปรับ logic สแกนบาร์โค้ดให้ resolve ผ่าน `GET /api/products/search?q&includeStock=true` (exact barcode ก่อน แล้ว fallback รายการแรก)
  - standardize scanner UX/logic ให้ตรงกับหน้า `/products` โดยย้ายไปใช้คอมโพเนนต์กลาง `components/app/barcode-scanner-panel.tsx` (camera dropdown, pause/resume, torch/zoom, manual barcode fallback, และ cleanup ตอนปิด)
  - ปรับการ์ดสรุปในแท็บดูสต็อกให้ label `ทั้งหมด` สอดคล้องกับ filter `all`
  - แท็บ `/stock?tab=recording` เปลี่ยนมาใช้ scanner คอมโพเนนต์กลางเดียวกันและปรับ permission sheet ให้ใช้โครงเดียวกับ `/products` (`ยกเลิก` + `อนุญาตและสแกน`)
  - `components/app/stock-ledger.tsx` (legacy component ที่ยังไม่ถูก mount ใน route `/stock` ปัจจุบัน) ถูกย้ายมาใช้ `BarcodeScannerPanel` และ permission/scanner sheet style เดียวกับ `/products` แล้ว เพื่อป้องกัน logic/UI drift

- แก้ issue หน้า `/stock` ที่แท็บ `ประวัติ` มีอาการเด้งแท็บ/โหลดข้อมูลซ้ำระหว่างใช้งาน:
  - สาเหตุหลัก: `StockMovementHistory` ถูก keep-mounted และยังทำ URL sync + fetch แม้แท็บไม่ active ทำให้เกิด race กับ query update จากแท็บอื่น
  - แพตช์: จำกัดให้ logic sync query (`router.replace`) และ data fetch ของ History ทำงานเฉพาะเมื่อ `tab=history` เท่านั้น
  - ผลลัพธ์: ลดการแย่งอัปเดต query ข้ามแท็บ และลดการโหลดข้อมูลที่ไม่จำเป็นตอนผู้ใช้อยู่แท็บอื่น

- แก้ issue เด้งแท็บ/โหลดซ้ำใน `/stock` เพิ่มเติม และปิด prefetch PO ตามที่ต้องการ:
  - `StockRecordingForm` และ `PurchaseOrderList` จำกัด logic sync/query side-effect ให้ทำงานเฉพาะตอนแท็บตัวเอง active (`tab=recording` / `tab=purchase`) ลด race จาก keep-mounted tabs
  - `StockTabs` ปรับการเปลี่ยนแท็บเป็น `router.replace(..., { scroll: false })` และไม่ยิง navigation ซ้ำเมื่อกดแท็บเดิม
  - ยกเลิก PO detail prefetch แบบ intent-driven (hover/focus/touch + auto prefetch รายการต้น ๆ) เหลือโหลดรายละเอียดแบบ on-demand เมื่อผู้ใช้เปิด PO จริง

- ปรับ UX แท็บ `/stock?tab=history` ให้เรียบง่ายและลดการสลับมุมมองเอง:
  - เอาแถวปุ่มประเภท (`ทั้งหมด/รับเข้า/เบิกออก/จอง/ยกเลิกจอง/ปรับสต็อก/รับคืน`) ออก แล้วเปลี่ยนเป็น `ประเภท` แบบ dropdown เดียว
  - แยก draft filter ออกจาก applied filter: เปลี่ยนค่าช่องกรองแล้วยังไม่ fetch/ไม่ sync URL จนกด `ใช้ตัวกรอง`
  - เพิ่ม summary ของตัวกรองที่กำลังใช้จริงใต้ปุ่ม action และคงปุ่ม `ล้างตัวกรอง` เพื่อให้ flow ไม่ซับซ้อนบนมือถือ
  - แก้บั๊กที่ค่าช่องกรอง (dropdown/วันที่) เด้งกลับค่าเดิมระหว่างผู้ใช้แก้ไข: URL-to-form sync ของแท็บ history เปลี่ยนเป็น update เฉพาะตอน query เปลี่ยนจริง ลดอาการพิมพ์ไม่เข้า/เลือกไม่ติด
  - เปลี่ยนช่องวันที่ใน history filter เป็น custom datepicker (calendar popover) แบบเดียวกับ PO เพื่อให้ UX บนมือถือสม่ำเสมอและเลี่ยงปัญหา native `input[type=date]`

- เพิ่ม policy กลางของ date input ฝั่ง UI:
  - ฟีเจอร์ใหม่ที่มีช่องวันที่ต้องใช้ custom datepicker มาตรฐานเดียวกันทั้งระบบ (calendar popover + ค่า `YYYY-MM-DD`)
  - native `input[type=date]` ให้ใช้เฉพาะกรณี internal/admin ที่ไม่กระทบประสบการณ์ผู้ใช้ปลายทาง

- ปรับ UX ฟอร์ม `เพิ่มสินค้า` ในหน้า `/products`:
  - ช่อง `ราคาขาย` เปลี่ยนค่าเริ่มต้นจาก `0` เป็นค่าว่าง และเพิ่ม `placeholder: 0`
  - ถ้าผู้ใช้ไม่กรอกราคาขาย ระบบยัง submit เป็น `0` ตาม schema/coercion เดิม (ไม่เปลี่ยน API contract)
  - เป้าหมายคือให้ผู้ใช้พิมพ์ราคาได้ทันที โดยไม่ต้องลบ `0` เดิมก่อน

- ปรับ visual state ของ workspace tabs ในหน้า `/stock?tab=purchase`:
  - ปุ่ม active ของ `PO Operations` / `Month-End Close` / `AP by Supplier` เปลี่ยนจากโทน slate เป็น `primary theme` (`bg-primary`, `text-primary-foreground`)
  - badge และคำอธิบายใต้ชื่อ tab (ตอน active) ปรับโทนเป็น `primary-foreground` เพื่อคง contrast และอ่านง่าย

- ปรับตัวกรองวันที่ใน `คิว PO รอปิดเรท` (`/stock?tab=purchase` -> workspace `Month-End Close`) ให้ใช้ custom datepicker แบบเดียวกับ `Create PO`:
  - เปลี่ยน `receivedFrom/receivedTo` จาก native `input[type=date]` เป็น `PurchaseDatePickerField` (calendar popover + เก็บค่า `YYYY-MM-DD`)
  - เพิ่ม quick actions (`วันนี้`, `+7 วัน`, `สิ้นเดือน`, `ล้างค่า`) ทั้งช่องวันที่เริ่มและสิ้นสุด เพื่อให้ interaction ของวันที่ตรงกับฟอร์มสร้าง PO
  - คง API/filter contract เดิม (`receivedFrom`, `receivedTo`) จึงไม่ต้องแก้ backend route

- ปรับตัวกรองวันที่ใน `AP by Supplier` (`statement/filter/export`) ให้ใช้ custom datepicker แบบเดียวกับ `Create PO`:
  - เปลี่ยน `dueFrom/dueTo` จาก native `input[type=date]` เป็น `PurchaseDatePickerField` (calendar popover + เก็บค่า `YYYY-MM-DD`)
  - เพิ่ม quick actions (`วันนี้`, `+7 วัน`, `สิ้นเดือน`, `ล้าง`) แยกทั้งช่องเริ่มและสิ้นสุด
  - จัด layout filter ใหม่โดยย้าย `Due ตั้งแต่/Due ถึง` ลงบรรทัดถัดไปใต้ตัวกรองหลัก เพื่อแก้ปัญหาความแคบบนหน้าจอเล็ก
  - คง API/filter/export query contract เดิม (`dueFrom`, `dueTo`) จึงไม่ต้องแก้ endpoint `statement` และ `export-csv`

- ปรับ flow แท็บ `/stock?tab=recording` ให้แยกจากงานบัญชี/PO ชัดขึ้น:
  - เพิ่ม guardrail card ว่า Recording ใช้สำหรับปรับจำนวนสต็อกเท่านั้น (ไม่บันทึกต้นทุน/เรท) และเพิ่มปุ่มลัด `ไปแท็บสั่งซื้อ (PO)`
  - ปรับ guardrail card ให้ข้อความอธิบายยาวเป็นแบบพับ/ขยาย (default ปิด) เพื่อลดความสูงบนมือถือ และยังคงคำเตือนหลักพร้อม CTA ไปแท็บ PO ไว้ด้านบนตลอด
  - เพิ่ม mobile UX: ปุ่ม `บันทึกสต็อก` แบบ sticky ที่ก้นจอ และปุ่ม `ดูสินค้าทั้งหมด` เพื่อเปิด list picker เลือกสินค้าได้โดยไม่ต้องพิมพ์ก่อน
  - harden API `POST /api/stock/movements`: ถ้าส่ง field กลุ่มต้นทุน/เรท (`cost/costBase/rate/exchangeRate/...`) จะตอบ 400 พร้อมข้อความแนะนำให้ไปทำที่ PO/Month-End
  - sync filter หลักของ Recording ลง URL (`recordingType`, `recordingProductId`) เพื่อแชร์มุมมองเดียวกันได้ และใช้ `router.replace(..., { scroll: false })` ลดอาการเด้งจอ

- ปรับแท็บ `/stock?tab=history` ให้แชร์มุมมองได้และกรองครบขึ้น:
  - เพิ่ม filter type `จอง (RESERVE)` และ `ยกเลิกจอง (RELEASE)` ในชุด chip
  - sync filter/page ลง URL (`historyType`, `historyQ`, `historyDateFrom`, `historyDateTo`, `historyPage`) ด้วย `router.replace(..., { scroll: false })`
  - เพิ่ม in-memory cache ต่อ filter key (`type/page/q/date`) เพื่อให้สลับ chip เดิมแสดงผลได้ทันที และค่อย revalidate เบื้องหลัง
  - ปรับ query วันที่ใน history จาก `date(created_at)` เป็นช่วงเวลา (`>= dayStart`, `< nextDayStart`) เพื่อให้ index ทำงานได้ดีขึ้น
  - เพิ่ม composite index ใน `inventory_movements` สำหรับงาน history: `inventory_movements_store_created_at_idx`, `inventory_movements_store_type_created_at_idx`
  - เอาตัวเลข count ออกจาก chip filter เพื่อกันความเข้าใจผิดจากข้อมูลรายหน้า (pagination)

- แก้ปัญหา date input ล้นจอบนมือถือใน PO:
  - ช่อง `คาดว่าจะได้รับ` และ `ครบกำหนดชำระ` (Create PO) ปรับเป็น 1 คอลัมน์บน mobile และ 2 คอลัมน์บนจอใหญ่ (`md+`)
  - ฟอร์ม `แก้ไข PO` ส่วนวันที่/tracking ปรับจาก `sm:3 คอลัมน์` เป็น responsive (`1 -> 2 -> 3`) เพื่อลดการบีบช่องบนจอเล็ก
  - เพิ่ม `min-w-0/max-w-full` ให้ input/group ที่เกี่ยวข้อง เพื่อลดเคส native date control (`dd/mm/yyyy`) ดันความกว้างเกินหน้าจอ
  - เพิ่ม helper text และ quick actions ในช่องวันที่ของ Create/Edit PO (`วันนี้`, `+7 วัน`, `สิ้นเดือน`, `ล้างค่า`) เพื่อทดแทน placeholder ที่ `input[type=date]` บนมือถือไม่รองรับ
  - เพิ่ม hardening สำหรับ production mobile:
    - `SlideUpSheet` content เพิ่ม `overflow-x-hidden` กัน element ดันความกว้างเกิน viewport
    - date input ใน `Edit PO` ปรับเป็น `text-base` บนมือถือ (16px) แล้วค่อย `sm:text-sm` เพื่อลด iOS auto-zoom ที่ทำให้ดูเหมือน modal ล้นจอ
    - เพิ่มคลาส `po-date-input` และ global CSS (เฉพาะ coarse pointer) เพื่อบังคับขนาด/การตัดข้อความของ native date control (`::-webkit-datetime-edit`) ลดเคสล้นจอใน production mobile
  - เปลี่ยนช่อง `วันที่คาดรับ/ครบกำหนดชำระ` ใน Create/Edit PO เป็น custom datepicker (calendar popover) แทน native `type=date` เพื่อแก้เคสล้นจอบน iOS ให้เสถียรกว่า
  - ใน modal `คิว PO รอปิดเรท` ปรับช่องตัวเลข `อัตราแลกเปลี่ยนจริง` และ `ยอดชำระรวมตาม statement` ให้ใช้ placeholder `0` โดยไม่ prefill `0` จริง

- ปรับ UX ตอนสลับ `โหมดการทำงาน`/ตัวกรองที่ผูก URL ในหน้า PO:
  - ก่อน `router.replace` ระบบจะเก็บตำแหน่ง scroll ปัจจุบันไว้ และ restore หลัง query เปลี่ยน (best-effort)
  - ลดอาการหน้าเด้งกลับไปบนสุดระหว่างสลับ `PO Operations` / `Month-End Close` / `AP by Supplier`

- ปรับ UX ช่องตัวเลขใน modal `Create PO`:
  - ช่อง `ราคา/₭` (ต่อรายการสินค้า), `ค่าขนส่ง`, `ค่าอื่นๆ` เปลี่ยนเป็นค่าว่างเริ่มต้น (ไม่ prefill `0`)
  - เพิ่ม placeholder `0` ในทั้ง 3 ช่อง เพื่อลดขั้นตอนที่ผู้ใช้ต้องลบ `0` ก่อนพิมพ์
  - ถ้าผู้ใช้เว้นว่าง ระบบยังคำนวณ/ส่งค่าเป็น `0` อัตโนมัติผ่าน fallback เดิม (`Number(value) || 0`)

- ปรับ layout บนหน้า `/stock?tab=purchase`:
  - ย้ายบล็อก `โหมดการทำงาน` ให้ไปอยู่ใต้บล็อก `ตัวชี้วัดและทางลัด`
  - ปรับการ์ด KPI (`Open PO`, `Pending Rate`, `Overdue AP`, `Outstanding`) เป็นโทนสีปกติ (neutral) เพื่ออ่านง่ายและไม่แย่งสายตา

- เพิ่ม custom confirm ป้องกันการปิดฟอร์มสินค้าโดยไม่ตั้งใจ:
  - modal `เพิ่มสินค้า/แก้ไขสินค้า`: ถ้ามี draft ค้างแล้วกด `ยกเลิก` หรือ `X` จะมี dialog ยืนยันก่อนปิด
  - modal `Product Detail` ตอน `แก้ไขต้นทุน`: ถ้ามีการแก้ไขค้างแล้วกด `ยกเลิก` ในฟอร์มต้นทุนหรือกด `X` ปิดรายละเอียด จะมี dialog ยืนยันก่อนทิ้งข้อมูล
  - ถ้าไม่มีการแก้ไขค้าง ระบบจะปิดได้ทันทีเหมือนเดิม

- ปรับ UX modal `Product Detail` ในหน้า `/products`:
  - ปิดการปิดด้วย backdrop แล้ว (`closeOnBackdrop=false`)
  - ตอนคลิกนอก modal จะไม่ปิด เพื่อลดการเสีย context ระหว่างดูข้อมูลสินค้า
  - เพิ่ม inner padding ของเนื้อหาใน modal เล็กน้อย (จาก base `16px` เป็น `20px` ต่อด้าน) เพื่อให้หายใจขึ้นและอ่านข้อมูลง่ายขึ้น

- ปรับ default filter ของ `PO Operations`:
  - ค่าเริ่มต้นในรายการ PO เปลี่ยนจาก `ทั้งหมด` เป็น `งานเปิด (OPEN)` โดย `OPEN` หมายถึงงานค้างทั้งหมด (รวม `RECEIVED` ที่ยัง `รอปิดเรท/รอชำระ`) เพื่อลดงานที่ปิดแล้วในมุมมองแรก
  - เพิ่ม filter derived ใน `PO Operations`: `รอปิดเรท` (RECEIVED + ต่างสกุล + ยังไม่ล็อกเรท), `รอชำระ` (RECEIVED + outstanding > 0 + ไม่ติดรอปิดเรท), และ `เสร็จแล้ว` (RECEIVED + PAID + ไม่ติดรอปิดเรท)
  - sync URL ของ `poStatus` ให้ถือ `OPEN` เป็น default: ถ้าเป็น `OPEN` จะไม่เขียน query, แต่ถ้าเลือก `ทั้งหมด` หรือสถานะอื่นจะเขียน query เพื่อแชร์/refresh ได้มุมมองเดิม
  - ตอนล้าง shortcut/preset จะกลับมาที่ `OPEN` ตาม default ใหม่ และ empty-state ใน `OPEN` ยังมีปุ่มสร้าง PO ให้ใช้งานต่อได้ทันที

- ปรับ UX modal `Create PO` ให้กันปิดฟอร์มโดยไม่ตั้งใจ:
  - เมื่อมีข้อมูลค้างในฟอร์ม ถ้ากด `ยกเลิก` หรือกด `X` จะขึ้น custom confirm ก่อนปิด
  - ผู้ใช้เลือกได้ว่าจะ `กลับไปแก้ไข` หรือ `ปิดและทิ้งข้อมูล`
  - กรณีฟอร์มยังว่าง (ไม่มี draft) จะปิดได้ทันทีเหมือนเดิม

- เพิ่ม `Bulk settle` จาก workspace `AP by Supplier`:
  - ใน panel statement สามารถติ๊กเลือกหลาย PO แล้วกด `บันทึกชำระแบบกลุ่ม`
  - ใช้ endpoint เดิม `POST /api/stock/purchase-orders/[poId]/settle` แบบลำดับราย PO (ไม่เพิ่ม schema/API ใหม่)
  - รองรับ `ยอดชำระรวมตาม statement` (optional) เพื่อ auto-allocate ตาม due date เก่าสุดก่อน (`oldest due first`)
  - รองรับแสดง progress และรายการที่ fail ราย PO พร้อมข้อความจาก API
  - หลังจบงานจะ refresh ทั้ง list/AP panel เพื่อ sync KPI และยอดค้าง

- รองรับ flow “รับของก่อน ค่อยใส่ค่าขนส่งปลายเดือน” ใน PO:
  - เพิ่ม endpoint `POST /api/stock/purchase-orders/[poId]/apply-extra-cost` (idempotency + audit)
  - เพิ่ม service `applyPurchaseOrderExtraCostFlow`:
    - อนุญาตเฉพาะ PO สถานะ `RECEIVED` ที่ยังไม่ `PAID`
    - บล็อกกรณียอดรวมใหม่ต่ำกว่ายอดที่ชำระแล้ว
    - อัปเดต `shippingCost/otherCost/otherCostNote` และคำนวณ `landedCostPerUnit` ของรายการ PO ใหม่ตาม `qtyReceived`
  - เพิ่ม UI ใน PO Detail (`/stock?tab=purchase`) ปุ่ม `อัปเดตค่าส่ง/ค่าอื่น` + ฟอร์มกรอกยอดและ preview ยอดคงค้างใหม่
  - ข้อจำกัด MVP: อัปเดต AP/Outstanding ทันที แต่ไม่ recost สินค้าย้อนย้อนหลัง

- เพิ่ม notification workflow สำหรับ AP due/overdue (cron + in-app inbox + mute/snooze):
  - เพิ่ม cron endpoint `GET /api/internal/cron/ap-reminders` (auth ด้วย `CRON_SECRET`) เพื่อ sync แจ้งเตือนจาก `getPurchaseApDueReminders`
  - เพิ่ม schema `notification_inbox` (dedupe ต่อ PO+due status) และ `notification_rules` (mute/snooze ราย PO)
  - เพิ่ม API ฝั่ง settings:
    - `GET/PATCH /api/settings/notifications/inbox` (list inbox + mark read/unread/resolve)
    - `PATCH /api/settings/notifications/rules` (snooze/mute/clear)
  - ปรับหน้า `/settings/notifications` จากหน้า static เป็น in-app inbox ใช้งานจริง พร้อม action `อ่านแล้ว`, `ปิดรายการ`, `Snooze`, `Mute`
  - เพิ่ม quick inbox ที่ navbar (`AppTopNav`): bell badge, preview รายการล่าสุด, action `อ่านแล้ว`, และลิงก์ไปหน้า AP/Notification Center
  - ปรับ quick inbox บนจอ non-desktop (`<1024px`) ให้ใช้ popover card แบบเดียวกับ desktop (ไม่ full-screen) โดย render fixed-centered (portal) และจำกัดความสูง `~68dvh` เพื่อลดการล้นจอ/ล้นซ้าย
  - ปรับปุ่ม `เปลี่ยนร้าน` ใน navbar เป็น compact icon-first และซ่อนเมื่ออยู่หน้า `/settings/stores`
  - รอบนี้ปุ่ม `เปลี่ยนร้าน` ใน navbar เปลี่ยนจากลิงก์ไป `/settings/stores` เป็น current-page quick switcher แล้ว: เปิด `SlideUpSheet` บนหน้าเดิมและฝัง `StoresManagement mode="quick"` เพื่อสลับร้าน/สาขาได้เลย โดยยังใช้ `POST /api/stores/switch` และ `POST /api/stores/branches/switch` ชุดเดิม
  - เพิ่ม graceful fallback ที่ `GET /api/settings/notifications/inbox` กรณี schema notification ยังไม่พร้อม: คืนรายการว่าง + warning แทน 500
  - เพิ่มข้อความแนะนำชัดเจนใน `PATCH /api/settings/notifications/inbox` (503) เมื่อ schema notification ยังไม่พร้อม เพื่อให้ผู้ดูแลรัน `npm run db:repair` และ `npm run db:migrate`
  - เพิ่ม cron schedule ใน `vercel.json` สำหรับ Vercel Hobby (`0 0 * * *` UTC) เพื่อรันวันละครั้ง
  - เพิ่ม GitHub Actions workflow `.github/workflows/ap-reminders-cron.yml` เป็น external scheduler fallback (schedule `10 0 * * *` UTC + manual dispatch)

- ปรับ UX หน้า `/stock?tab=purchase` ให้เป็น workspace-first:
  - ใน modal `Create PO` (Step 1) ช่อง `ชื่อซัพพลายเออร์` เป็น hybrid input: พิมพ์ชื่อใหม่ได้ และเพิ่มปุ่ม `ดูซัพพลายเออร์ทั้งหมด` เพื่อเปิด list picker (ค้นหา/แตะเลือกจาก PO history) สำหรับ mobile ที่ `datalist` ทำงานไม่สม่ำเสมอ
  - ช่อง `เบอร์ติดต่อ` ใน Create/Edit PO ปรับเป็น `type="tel"` + `inputMode="tel"` + `autoComplete="tel"` เพื่อให้มือถือเปิดคีย์บอร์ดตัวเลข/โทรศัพท์ทันที
  - ใน modal `Create PO` (Step 2) เพิ่มปุ่ม `ดูสินค้าทั้งหมด/ซ่อนรายการสินค้า` เพื่อเปิด list picker สินค้าโดยไม่ต้องพิมพ์ก่อน พร้อมคงช่องค้นหาเดิม (ชื่อ/SKU)
  - modal `Create PO` ปิดการปิดด้วย backdrop (กดนอก modal ไม่ปิด) และเพิ่มปุ่ม `ยกเลิก` ที่ footer เพื่อให้มีทางออกที่ชัดเจนทุก step
  - แยกบล็อก `โหมดการทำงาน` (workspace tabs) ออกจากบล็อก KPI/shortcut เพื่อไม่ให้ผู้ใช้สับสนระหว่าง navigation กับตัวเลขสรุป
    - เพิ่ม summary strip ด้านบน (`Open PO`, `Pending Rate`, `Overdue AP`, `Outstanding`) เป็น KPI summary-only (ไม่คลิก, สีการ์ดคงที่ไม่ highlight ตาม preset) และใช้ saved preset chip เป็น shortcut (พาไป workspace + ตั้งตัวกรองด่วน)
    - เพิ่ม workspace switcher 3 โหมด: `PO Operations`, `Month-End Close`, `AP by Supplier` (mobile sticky + badge count)
  - เพิ่มแถบ `Applied filter` + ปุ่มล้าง/บันทึก preset และเพิ่ม Saved preset ต่อผู้ใช้ (localStorage) พร้อมปุ่มลบ preset
  - เพิ่มตัวเรียง statement ใน `AP by Supplier` (due date / outstanding desc) และ empty-state guidance (`ล้างตัวกรอง statement`, `ล้างคำค้นหา supplier`)
    - จำ workspace ล่าสุดด้วย `workspace` query + localStorage เพื่อกลับเข้าแท็บแล้วอยู่โหมดเดิมอัตโนมัติ
    - sync ตัวกรองหลักลง URL (`poStatus`, `due`, `payment`, `sort`) เพื่อแชร์ลิงก์มุมมองเดียวกันได้
    - แยกการแสดง section ตาม workspace เพื่อลดความยาวหน้าและลด context-switch ระหว่างงานรายวันกับงานปิดเดือน
    - ไม่เปลี่ยน API เดิม; เป็นการปรับเฉพาะ information architecture และ interaction flow ฝั่ง UI
    - ปรับ localStorage key ของ workspace/preset ให้ผูกราย `storeId + userId` (ไม่ปนกันข้ามผู้ใช้/ข้ามร้านบน browser เดียว) และมี fallback migrate จาก key legacy
    - ตอน logout / force relogin หลังเปลี่ยนรหัสผ่าน จะล้าง localStorage กลุ่ม `csb.stock.purchase.*` เพื่อลดปัญหา preset ค้างบนเครื่อง shared
    - แก้ปัญหาเด้ง workspace ตอนเปิด `AP by Supplier`: ตอน sync filter (`due/payment/sort`) จะยึด query ล่าสุดจาก URL และบังคับคง `workspace=SUPPLIER_AP` ลดโอกาสถูก overwrite จาก query state เก่า

- แก้บั๊ก 500 ของ endpoint AP supplier:
  - สาเหตุจาก SQL expression `totalPaidBase` ใน `getOutstandingPurchaseRows` ปิดวงเล็บไม่ครบ
  - แพตช์ที่ `lib/reports/queries.ts` แล้ว (`GET /api/stock/purchase-orders/ap-by-supplier` กลับมาทำงานได้)

- เพิ่ม workflow ปลายเดือนแบบกลุ่มในคิว `PO รอปิดเรท` (หน้า `/stock?tab=purchase`):
  - เลือกหลาย PO แล้วสั่ง `ปิดเรท + ชำระปลายเดือน` ได้ครั้งเดียว
  - บังคับเลือก PO สกุลเดียวกันต่อรอบ เพื่อใช้อัตราแลกเปลี่ยนเดียวกัน
  - บังคับกรอก `paymentReference` รอบบัตร/รอบชำระ เพื่อ trace ย้อนหลังได้ชัด
  - ประมวลผลแบบลำดับด้วย endpoint เดิม (`finalize-rate` -> `settle`) และแสดง progress + รายการที่ fail เป็นราย PO
  - เพิ่มโหมด `manual-first statement reconcile`: กรอก `ยอดชำระรวมตาม statement` ได้ครั้งเดียว แล้วระบบ auto-match ลง PO ตามครบกำหนดเก่าสุดก่อน (oldest due first)
  - ถ้าไม่กรอกยอด statement ระบบจะชำระเต็มยอดค้างทุกรายการที่เลือกเหมือนเดิม; ถ้ากรอกแล้วมีเงินเหลือ ระบบจะแจ้งยอดที่ยังไม่ถูกจับคู่

- เพิ่ม reminder งานค้างชำระอัตโนมัติบน dashboard (in-app):
  - `getDashboardViewData` เพิ่มข้อมูล `purchaseApReminder` (แยก `overdue` / `due soon`, ยอดค้าง และรายการ PO top 5)
  - reuse logic due-status จาก `purchase-ap.service` ผ่าน `getPurchaseApDueReminders()` เพื่อให้กติกาตรงกับหน้า AP statement
  - dashboard ทุก store type (`online/cafe/restaurant/other`) แสดงบล็อกเตือนงาน AP และลิงก์ไป `/stock?tab=purchase`
  - รอบนี้ dashboard storefront ถูก redesign เป็น mobile-first work dashboard: รวม layout ของ `online/cafe/restaurant/other` ให้ใช้ shared structure เดียวกันผ่าน `components/storefront/dashboard/shared.tsx`, hero แสดงร้าน/สาขา/บทบาท + summary metrics, section `งานวันนี้` เปลี่ยน metrics เป็น action-oriented cards พร้อม deep-link ไป `/orders`, `/stock?tab=inventory`, `/stock?tab=purchase`, ตัด section `ทางลัด` ออกเพราะซ้ำกับ navigator/menu และคงไว้แค่ลิงก์ `รายงาน` จุดเดียว, ส่วน AP + low-stock ถูกย้ายลงส่วน `รายละเอียดการดำเนินงาน`

- เพิ่ม AP ราย supplier แบบ drill-down ในหน้า `/stock?tab=purchase`:
  - เพิ่ม API summary supplier `GET /api/stock/purchase-orders/ap-by-supplier`
  - เพิ่ม API statement ราย supplier `GET /api/stock/purchase-orders/ap-by-supplier/statement` (filter `paymentStatus/dueFilter/dueFrom/dueTo/q`; `q` ค้นหา `poNumber/note`)
  - เพิ่ม API export CSV ราย supplier `GET /api/stock/purchase-orders/ap-by-supplier/export-csv`
  - เพิ่ม service กลาง `server/services/purchase-ap.service.ts` เพื่อ reuse outstanding dataset เดิมให้ตัวเลข summary/statement/export ตรงกัน
  - เพิ่ม UI panel `AP ราย supplier` (ค้นหา supplier, drill-down statement, filter และกดเปิด PO detail ต่อได้)

- เพิ่ม Phase AP/Payment Ledger สำหรับ PO:
  - เพิ่มคอลัมน์ `purchase_orders.due_date`
  - เพิ่มตาราง `purchase_order_payments` รองรับ entry แบบ `PAYMENT` และ `REVERSAL`
  - ขยายสถานะ `purchase_orders.payment_status` เป็น `UNPAID | PARTIAL | PAID`
  - ปรับ endpoint `POST /api/stock/purchase-orders/[poId]/settle` ให้รองรับยอดชำระบางส่วน (`amountBase`)
  - เพิ่ม endpoint `POST /api/stock/purchase-orders/[poId]/payments/[paymentId]/reverse` สำหรับย้อนรายการชำระ
  - เพิ่ม endpoint `GET /api/stock/purchase-orders/outstanding/export-csv` สำหรับ export PO ค้างชำระ + FX delta ต่อซัพพลายเออร์
  - หน้า `/stock` tab PO เพิ่ม due date ใน create/edit, แสดงยอดชำระสะสม/ยอดค้าง, timeline ชำระ และปุ่มย้อนรายการชำระ
  - หน้า `/reports` เพิ่มการ์ด `AP Aging (0-30/31-60/61+)` และลิงก์ export CSV
  - อัปเดต `scripts/repair-migrations.mjs` ให้เติม `due_date`, สร้าง `purchase_order_payments`, และ sync `payment_status` จาก payment ledger

- เพิ่ม Phase ถัดไปของ PO ต่างสกุลเงิน (ปิดเรทก่อนชำระ + คิวงาน + รายงาน):
- เพิ่ม endpoint `GET /api/stock/purchase-orders/pending-rate` สำหรับคิว `รอปิดเรท` (filter: `q` (supplier/poNumber/note), receivedFrom, receivedTo)
  - เพิ่ม endpoint `POST /api/stock/purchase-orders/[poId]/settle` สำหรับบันทึกชำระ PO
  - เพิ่ม business rule: PO ต่างสกุลเงินที่ยังไม่ล็อกเรท จะบันทึกชำระไม่ได้ (ต้อง `finalize-rate` ก่อน)
  - เพิ่มคอลัมน์ `purchase_orders.exchange_rate_initial` เพื่อเก็บเรทตั้งต้นสำหรับเทียบกับเรทจริง
  - เพิ่มคอลัมน์ชำระ PO (`payment_status`, `paid_at`, `paid_by`, `payment_reference`, `payment_note`)
  - หน้า `/stock` tab PO เพิ่มการ์ดคิวรอปิดเรท + filter + ปุ่มลัดเปิด detail จากคิว
  - หน้า PO detail เพิ่ม section สถานะชำระ + ฟอร์ม `บันทึกชำระ` (พร้อม guard กรณีต่างสกุลเงินยังไม่ปิดเรท)
  - หน้า `/reports` เพิ่มการ์ดสรุป FX delta (pending/locked/changed + ผลรวมส่วนต่างมูลค่า)

- ปรับ flow PO สกุลเงินต่างประเทศ (deferred exchange rate):
  - ตอนสร้าง PO รองรับการไม่กรอก `exchangeRate` (ตั้งเป็นสถานะ `รอปิดเรท`)
  - เพิ่ม endpoint `POST /api/stock/purchase-orders/[poId]/finalize-rate` สำหรับปิดเรทจริงภายหลัง
  - เพิ่มคอลัมน์ใน `purchase_orders` เพื่อเก็บสถานะเรท (`exchange_rate_locked_at`, `exchange_rate_locked_by`, `exchange_rate_lock_note`)
  - หน้า PO list/detail แสดงสถานะ `รอปิดเรท` และมีปุ่ม `ปิดเรท` เมื่อ PO รับสินค้าแล้วแต่ยังไม่ล็อกเรท

- ปรับ UX หน้า `/products` ให้คงแท็บสถานะหลัง hard refresh:
  - ผูกแท็บสถานะ (`ทั้งหมด/ใช้งาน/ปิดใช้งาน`) กับ URL query `status`
  - เปิดหน้าใหม่ด้วย `?status=inactive` จะเข้าแท็บ `ปิดใช้งาน` ทันที และกดสลับแท็บแล้ว URL จะอัปเดตตาม

- ปรับ UX หน้า `/stock` ให้เหลือ action รีเฟรชเดียว:
  - เอาปุ่ม `รีเฟรช` ระดับหน้า (header) ออก
  - ให้ใช้เฉพาะปุ่ม `รีเฟรชแท็บนี้` ใน toolbar ของแต่ละแท็บ เพื่อลดความซ้ำซ้อนและลดการกดผิด

- ปรับ performance ของหน้า `/stock` tab `สั่งซื้อ (PO)` เพิ่มเติม:
  - เพิ่ม cache รายละเอียด PO ต่อ `poId` ที่ระดับแท็บ เพื่อให้เปิดรายการเดิมซ้ำได้เร็วทันที
  - เดิมเคยมี intent-driven prefetch ตอนผู้ใช้ `hover/focus/touch` แถวรายการ PO แต่รอบล่าสุดปิดแล้ว (เหลือ on-demand) เพื่อลดโหลดที่ไม่จำเป็นและลด race ข้ามแท็บ
  - ปรับ PO detail sheet ให้ใช้ cache ก่อนโหลดจริง, มีปุ่ม retry ตอนโหลด detail fail และ invalidate cache เมื่อแก้ไข/เปลี่ยนสถานะ PO

- ปรับ Phase 2 ของหน้า `/stock` (History tab):
  - เพิ่มโหมด API `GET /api/stock/movements?view=history` รองรับ server-side pagination/filter (`page`,`pageSize`,`type`,`q`,`productId`,`dateFrom`,`dateTo`)
  - เพิ่ม query layer `getInventoryMovementsPage` และต่อผ่าน repository/service เพื่อแยก concern ชัดเจน
  - ปรับ `StockMovementHistory` ให้ใช้ข้อมูลจาก API แบบแบ่งหน้าและกรองที่เซิร์ฟเวอร์
  - เพิ่ม filter หลักใน UI ประวัติ: ประเภท movement + สินค้า (SKU/ชื่อ) + ช่วงวันที่
  - เพิ่ม windowed virtualization ในรายการประวัติ เพื่อให้เลื่อนลื่นขึ้นเมื่อข้อมูลต่อหน้ามาก

- ปรับ Phase 1 UX/Performance ของหน้า `/stock` (เริ่มจากไม่ใช้ prefetch แบบ bulk):
  - `StockTabs` เปลี่ยนเป็น keep-mounted (mount เฉพาะแท็บที่เปิดแล้วคง state เดิมตอนสลับแท็บ)
  - เพิ่มคอมโพเนนต์กลาง `stock-tab-feedback` สำหรับ state มาตรฐานต่อแท็บ: loading skeleton / empty / error + retry / last updated + refresh button
  - แท็บ `สั่งซื้อ (PO)` เพิ่ม `รีเฟรชแท็บนี้` + `อัปเดตล่าสุด`, เพิ่ม fallback error แบบ retry และปรับ loading ใน PO detail เป็น skeleton
  - แท็บ `ประวัติ` เปลี่ยนเป็น state ฝั่ง client ที่รีเฟรชเองได้ผ่าน `GET /api/stock/movements` พร้อม last updated และ state มาตรฐาน
  - แท็บ `บันทึกสต็อก` เพิ่ม quick preset (`รับเข้า`, `ปรับยอด`, `ของเสีย`) พร้อม note template, เพิ่มรีเฟรชข้อมูลแท็บ, และส่ง `Idempotency-Key` ตอน `POST /api/stock/movements`
  - ปุ่ม `ดูประวัติทั้งหมด` ในแท็บบันทึกสต็อก เปลี่ยนจาก hard reload เป็น `router.push` ไป `?tab=history`

- ปรับ UX หน้า `/stock` tab `สั่งซื้อ (PO)`:
  - เอาปุ่มลัด `ตั้งค่า PDF` ออกจาก header ของรายการ PO
  - คงการตั้งค่าเอกสารไว้ที่หน้า `/settings/pdf?tab=po` เท่านั้น เพื่อลดความรกของ action หลักในหน้า stock

- แก้ปัญหา 500 ที่ `GET /api/stock/purchase-orders/[poId]` จาก schema drift:
  - พบว่า DB บางสภาพแวดล้อมขาดคอลัมน์ `purchase_orders.updated_by/updated_at` (แต่โค้ด query คอลัมน์ดังกล่าว)
  - อัปเดต `scripts/repair-migrations.mjs` ให้เติมคอลัมน์ `updated_by` และ `updated_at` อัตโนมัติ
  - เพิ่ม backfill `updated_at` จาก `created_at` และสร้าง index `po_updated_at_idx`
  - รัน `npm run db:repair` กับฐานที่ใช้งานจริงแล้วเพื่อเติมคอลัมน์ที่ขาด

- ปรับ PO detail sheet ในหน้า `/stock` (tab purchase):
  - เปลี่ยนการโหลดรายละเอียด PO ให้ตรวจ `res.ok` และแสดง error message จาก API จริง
  - เพิ่ม fallback error ที่ชัดเจน (`โหลดรายละเอียดใบสั่งซื้อไม่สำเร็จ`, `เชื่อมต่อไม่สำเร็จ`)
  - เพิ่ม `AbortController` เพื่อยกเลิก request เดิมเมื่อผู้ใช้สลับ/คลิก PO ใหม่เร็ว ๆ
  - ลด false-negative ที่เคยแสดง `ไม่พบข้อมูล` แม้จริง ๆ เป็นปัญหา permission/network/server

- ปรับ performance/UX การสลับแท็บสถานะในหน้า `/products`:
  - แยก loading state ระหว่าง `filter change` กับ `load more` เพื่อลดการบล็อก UI
  - เพิ่ม client cache สำหรับผลลัพธ์หน้าแรกของแต่ละ filter key (`q/category/status/sort`) เพื่อให้สลับแท็บกลับมาที่เดิมได้เร็วขึ้น
  - เพิ่ม `AbortController` ยกเลิก request เก่าที่ค้างเมื่อผู้ใช้เปลี่ยนแท็บ/ฟิลเตอร์เร็ว ๆ
  - ถ้า filter ใหม่ยังไม่มี cache จะแสดง skeleton list ทันทีระหว่างรอ API
  - ถ้ามี cache จะแสดงข้อมูล cache ทันทีและ revalidate เบื้องหลังพร้อมข้อความ `กำลังอัปเดตรายการ...`

- ปรับ Cost Governance สำหรับสินค้า:
  - action `update_cost` (`PATCH /api/products/[productId]`) บังคับให้ส่ง `reason` อย่างน้อย 3 ตัวอักษร
  - เมื่อแก้ต้นทุนมือ ระบบจะเขียน audit event `product.cost.manual_update` พร้อม metadata `reason`, `previousCostBase`, `nextCostBase` และ before/after
  - เมื่อรับสินค้าเข้า PO แล้วต้นทุนเปลี่ยน ระบบจะเขียน audit event `product.cost.auto_from_po` อัตโนมัติจาก service layer
  - Product payload มี `costTracking` เพิ่ม (`source`, `updatedAt`, `actorName`, `reason`, `reference`) เพื่อให้หน้า Product Detail แสดงที่มาของต้นทุนล่าสุดได้
- ปรับ UI หน้า `/products` (Product Detail > tab ต้นทุน):
  - เพิ่มฟอร์มเหตุผลก่อนบันทึกต้นทุน และปิดปุ่มบันทึกจนกว่าจะกรอกเหตุผลครบ
  - เพิ่มบล็อกแสดงที่มาของต้นทุนล่าสุด (แก้ไขมือ/รับเข้า PO), เวลา, ผู้ทำ, หมายเหตุ, และเลขอ้างอิง PO (ถ้ามี)
- ปรับหน้า `/reports`:
  - เพิ่ม current-cost preview คู่กับ realized gross profit
  - แสดง `ต้นทุนสินค้า (ประเมิน)`, `กำไรขั้นต้น (ประเมิน)`, และส่วนต่างเทียบกับ realized
  - redesign เป็น mobile-first analytics workspace: เพิ่ม filter bar (`preset/custom date range + channel`) ผ่าน query string, KPI `ยอดขาย/ออเดอร์/AOV/กำไรขั้นต้น/COD ค้างปิดยอด`, กราฟแนวโน้มยอดขายรายวันแบบ lightweight, และ section `ยอดขายตามช่องทาง` + `สินค้าขายดี` ที่อิง filter เดียวกัน
  - `COD` และ `การเงินจัดซื้อ` คงเป็น operational snapshot ปัจจุบัน แยกจาก filter ช่วงวันที่ เพื่อให้ฝั่งวิเคราะห์ยอดขายกับ snapshot งานบัญชี/ขนส่งไม่ปะปนกัน
- ปรับหน้า `/stock?tab=recording`:
  - เอา field `cost` ออกจาก payload `POST /api/stock/movements`
  - เอา UI ช่องต้นทุน optional ออกจากฟอร์มบันทึกสต็อกเพื่อลดความเข้าใจผิด

- ปรับฟอร์ม `แก้ไขสินค้า` ใน `/products`:
  - แสดงรูปสินค้าปัจจุบันก่อนเลือกไฟล์ใหม่
  - เมื่อเลือกไฟล์ใหม่จะแสดง preview รูปใหม่ทันที
  - หากลบไฟล์ใหม่ที่เลือก จะกลับไปแสดงรูปปัจจุบัน
  - เพิ่มปุ่ม `ยกเลิก` คู่กับปุ่ม `บันทึก` ใน footer ของฟอร์มเพิ่ม/แก้ไขสินค้า และย้าย action bar ไปอยู่ `SlideUpSheet.footer` เพื่อให้ชิดขอบล่าง
  - ย้ายปุ่ม action ใน Product Detail (`แก้ไข/สำเนา/เปิด-ปิดใช้งาน/พิมพ์บาร์โค้ด`) ไป footer ของ modal แบบ sticky
  - เพิ่ม custom confirm dialog ก่อนปุ่ม `ปิดใช้งาน` ใน Product Detail (ไม่ใช้ browser alert) พร้อม animation เปิด/ปิด และจัดวาง dialog กึ่งกลางจอ
  - ปรับขนาดรูปใน Product Detail ให้เล็กลง (mobile `96px`, sm `112px`) และรองรับแตะรูปเพื่อเปิด preview เต็มจอ (ปิดได้ด้วยพื้นหลัง/ปุ่ม X/ปุ่ม Esc)
  - Modal สแกนบาร์โค้ดใน `/products` เปลี่ยนจากปุ่ม `สลับกล้อง` เป็น dropdown `เลือกกล้อง` (แสดงเมื่อมีกล้องมากกว่า 1 ตัว) เพื่อเลือกกล้องที่ต้องการโดยตรง
  - หน้า `/products` เปลี่ยนรายการสินค้าเป็น server-side pagination/filter/sort โดย `โหลดเพิ่มเติม` จะเรียก `GET /api/products` หน้าถัดไปจริง (ไม่ slice array ฝั่ง client)
  - เพิ่มโครงสร้างฐานข้อมูลรองรับสินค้าแบบ Variant (Phase 1) แบบ additive:
    - ตารางใหม่: `product_models`, `product_model_attributes`, `product_model_attribute_values`
    - คอลัมน์ใหม่ใน `products`: `model_id`, `variant_label`, `variant_options_json`, `variant_sort_order`
    - เพิ่มเอกสารแผน rollout: `docs/product-variants-plan.md`
    - อัปเดต `scripts/repair-migrations.mjs` ให้รองรับ fallback ของตาราง/คอลัมน์ Variant Phase 1
  - เพิ่มการรองรับ Variant ใน flow สินค้า (Phase 2 เริ่มใช้งานจริง):
    - ฟอร์ม `เพิ่ม/แก้ไขสินค้า` มี section `Variant` (toggle, model name, variant label, sort order, options key/value)
    - `POST /api/products` และ `PATCH /api/products/[productId]` รองรับ payload `variant`
    - backend จะหา/สร้าง `product_models` อัตโนมัติ และเติม dictionary ใน `product_model_attributes` / `product_model_attribute_values`
    - list/detail สินค้าแสดงข้อมูล model/variant ที่บันทึกไว้
    - ปรับ copy ในฟอร์มเป็น `คุณสมบัติของ SKU นี้` และเพิ่ม helper text ว่า 1 ฟอร์มบันทึกได้ทีละ 1 SKU
    - ปรับ UX ช่อง Variant options: ค่าเริ่มต้นให้กรอกเฉพาะ `attributeName/valueName` และให้ระบบสร้าง code อัตโนมัติ (ช่อง `attributeCode/valueCode` ซ่อนไว้ในโหมดขั้นสูง)
    - ปรับ layout ส่วน Variant ใน create/edit modal ให้ mobile-first (ไม่ล้นจอมือถือ): เปลี่ยน grid ให้ responsive, แถว option รองรับจอแคบ, และเพิ่มปุ่มพับ/ขยาย Matrix
    - Matrix generator รองรับแบบ 1 แกนหรือ 2 แกน (มี preset `Color อย่างเดียว`, `Size อย่างเดียว`, `Color + Size` และ checkbox `ใช้แกนที่ 2`)
    - ปรับสไตล์ modal เป็น flat hierarchy ลดปัญหา card-in-card-in-card (ลดกรอบซ้อน เหลือ spacing + ring แบบเบา)
    - เพิ่มความกว้าง create/edit product modal บน desktop เป็น `max-w-3xl` (ผ่าน prop ใหม่ของ `SlideUpSheet`) เพื่อให้กรอก Matrix/Variant ได้สบายขึ้น
    - create/edit product modal ปิดการ close เมื่อกด backdrop (คลิกนอกกล่อง) เพื่อลดการสูญเสียข้อมูลจากการปิดฟอร์มโดยไม่ตั้งใจ
    - ช่อง `ชื่อสินค้าแม่ (Model)` เปลี่ยนจาก `datalist` เป็น auto-suggest dropdown ที่ดึงจาก DB ผ่าน `GET /api/products/models` (รองรับเลือกชื่อเดิมหรือพิมพ์ชื่อใหม่)
    - ช่อง `ลำดับแสดง` ใน create + variant เป็น auto by default ตาม `nextSortOrder` ของ Model และยังแก้เองได้ (เมื่อผู้ใช้แก้เองจะไม่ถูก auto override)
    - ช่อง `ชื่อ Variant` เป็น auto-suggest จากรุ่นย่อยเดิมของ Model เดียวกัน (`variantLabels`) แต่ไม่ auto-fill อัตโนมัติ เพื่อกันการบันทึกผิด
    - ช่อง `SKU` ใน create modal auto-generate จากชื่อสินค้าโดยแปลงเป็น Latin ก่อน (รองรับชื่อภาษาลาว/ไทย) และมีช่อง `ชื่ออ้างอิงอังกฤษ (optional)` + ปุ่ม `สร้างใหม่`; ช่องอ้างอิงอังกฤษพับไว้เป็นค่าเริ่มต้นและให้ผู้ใช้เปิดเองได้, เมื่อผู้ใช้แก้ `SKU` เอง ระบบจะไม่ auto ทับ
    - ฟอร์ม `แก้ไขสินค้า` ปรับให้ใช้ UX ช่วยสร้าง SKU แบบเดียวกับ create (เพิ่ม `ชื่ออ้างอิงอังกฤษ (optional)` และปุ่ม `สร้างใหม่`) โดยยังไม่ auto เปลี่ยน SKU เองในโหมด edit
    - ถ้าชื่อที่ใช้สร้าง SKU แปลงเป็น Latin ไม่ได้ ระบบจะ fallback เป็นรหัสรูปแบบ running (`P-000001` หรือ `CAT-000001`)
    - ถ้าบันทึก create แล้วเจอ `SKU` ซ้ำ ระบบจะ auto เติม suffix (`-2`, `-3`, ...) และ retry ให้จนบันทึกผ่าน (หรือครบจำนวนครั้ง)
    - ส่วน `การแปลงหน่วย` เพิ่ม quick templates (`PACK(12)` / `BOX(60)` เมื่อมีหน่วยในระบบ), ปุ่ม `+ เพิ่มหน่วย` เลือกหน่วยที่ยังไม่ถูกใช้อัตโนมัติ, และเพิ่ม helper text อธิบายว่าค่าตัวคูณต้องเทียบกับหน่วยหลักเสมอ
    - เพิ่มปุ่ม `บันทึกและเพิ่ม Variant ถัดไป` (เฉพาะ create + variant) เพื่อสร้างรุ่นย่อยต่อเนื่องโดยไม่ปิดฟอร์ม
    - เมื่อกด `บันทึกและเพิ่ม Variant ถัดไป` ระบบคงค่าหลักไว้ แต่เคลียร์ `SKU/Barcode/รุ่นย่อย` สำหรับกรอก SKU ถัดไป
    - เพิ่ม `Matrix Variant Generator` ใน create modal:
      - ระบุแกนตัวเลือก (เช่น Color/Size) แล้วสร้างตารางรุ่นย่อยอัตโนมัติ
      - ช่วยตั้งค่า `variant label` และ `SKU` ต่อแถว
      - รองรับปุ่มสร้างบาร์โค้ดสำหรับแถวที่ยังว่าง และบันทึกหลายรุ่นย่อยแบบ bulk ครั้งเดียว
    - เมื่อมีแถวใน Matrix แล้ว footer ของ modal จะสลับเป็น action หลักแบบเดียว `ตรวจสอบและบันทึกหลายรุ่นย่อย` และซ่อนปุ่มบันทึกทีละ SKU เพื่อลดการกดผิด flow
  - กรอบรูปสินค้า: `border-dashed` เฉพาะตอนยังไม่มีรูป และเป็น `border-solid` เมื่อมีรูปแล้ว
  - การลบรูปปัจจุบันทำงานแบบ pending และจะลบจริงเฉพาะตอนกด `บันทึก`
  - เอาปุ่ม quick action รูป (`เปลี่ยนรูป`/`ลบรูป`) ออกจาก Product Detail และให้จัดการรูปผ่านฟอร์ม `แก้ไข` เท่านั้น
  - Product Detail modal:
    - sanitize ข้อมูลก่อน inject เข้า popup พิมพ์บาร์โค้ด (ลดความเสี่ยง XSS)
    - sync สถานะ `active` ใน detail card แบบ optimistic ทันทีเมื่อกดเปิด/ปิดใช้งาน (และ rollback เมื่อ API fail)
    - เพิ่ม `role="dialog"`/`aria-modal` + keyboard focus trap/restore focus ให้ทั้ง image preview และ confirm ปิดใช้งาน
    - ปรับ grid ปุ่ม action ใน footer ให้ responsive ตามจำนวนปุ่มจริง (ลดช่องว่างเมื่อ permission ไม่ครบ)
    - ปุ่ม `ยืนยันปิดใช้งาน` เปลี่ยนไปใช้สี `primary` ของ theme (ไม่ hardcode amber)
    - ใน tab `ข้อมูล` เพิ่มปุ่ม `คัดลอก` สำหรับค่า `SKU` และ `บาร์โค้ด` (มี toast แจ้งผลคัดลอกสำเร็จ/ล้มเหลว)
    - แสดง `สต็อกคงเหลือปัจจุบัน` (`stockAvailable`) ใน card เกณฑ์เตือนสต็อก
    - ยกเลิกการ lock ทั้ง Product Detail modal ระหว่าง toggle active; loading จะเกิดเฉพาะปุ่ม `เปิด/ปิดใช้งาน` พร้อมข้อความ `กำลังอัปเดต...`
- อัปเดต `scripts/seed.mjs`:
  - เพิ่ม dummy data สินค้าแบบ variant สำหรับ demo (`กล่องอาหาร` และ `เสื้อยืด Basic`)
  - seed ตาราง `product_models`, `product_model_attributes`, `product_model_attribute_values`
  - seed สินค้า variant ใน `products` พร้อม opening stock
  - summary หลัง seed แสดงจำนวน `product_models` และ `variant_products`
- ปรับ `SlideUpSheet` ให้รองรับ mobile keyboard:
  - เพิ่ม keyboard-aware bottom inset เมื่อ virtual keyboard เปิด
  - เมื่อ focus `input/select/textarea` ใน sheet จะเลื่อนช่องกรอกมาอยู่ในมุมมองอัตโนมัติ
  - ติดตาม `visualViewport` resize/scroll เพื่อ re-align ช่องที่โฟกัสระหว่างคีย์บอร์ดกำลังเปิด/ปิด
  - รองรับ drag down เพื่อปิดจากทั้ง handle และแถบ header บน mobile (ไม่ชนกับปุ่มปิด X)
- ปรับปุ่ม `Full Screen` ที่ navbar:
  - Desktop (`lg` ขึ้นไป) แสดงปุ่มเมื่อ browser รองรับ fullscreen
  - Touch device (POS tablet/mobile) แสดงปุ่มได้เมื่อตั้ง `NEXT_PUBLIC_POS_ALLOW_FULLSCREEN_ON_TOUCH=true`
  - ซ่อนปุ่มเมื่อ browser ไม่รองรับ fullscreen
- ปรับ UX หน้า `/products`:
  - เพิ่มปุ่ม `รีเฟรช` แบบ manual ในบรรทัดเดียวกับ title `สินค้า` และวางด้านขวา
  - ปุ่มมีสถานะ `กำลังรีเฟรช...` ระหว่างโหลด และยังไม่เปิด auto-refresh
- ปรับ UX หน้า `/stock`:
  - เอาปุ่ม `รีเฟรช` ระดับหน้า (header) ออก เพื่อไม่ซ้ำกับ `รีเฟรชแท็บนี้`
  - ยืนยันแนวทางให้รีเฟรชเฉพาะแท็บที่กำลังใช้งานเท่านั้น
- ปรับ UX หน้า `/orders` บน Desktop:
  - ย้ายปุ่ม `Full Screen` ไปที่ navbar หลัก และปรับเป็นปุ่มไอคอน
  - กดซ้ำเพื่อออกจาก Full Screen ได้ และรองรับออกด้วยปุ่ม `Esc`
  - Desktop (`lg` ขึ้นไป) แสดงปุ่ม และ Touch device แสดงได้ผ่าน env flag สำหรับ POS
- เพิ่มระบบ context กลาง:
  - `AI_CONTEXT.md`
  - `docs/CONTEXT_INDEX.md`
  - `docs/CODEBASE_MAP.md`
  - `docs/UI_ROUTE_MAP.md`
  - `docs/API_INVENTORY.md`
  - `docs/SCHEMA_MAP.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/HANDOFF.md`
- เพิ่ม order shipping label flow:
  - route: `POST /api/orders/[orderId]/shipments/label`
  - service: `server/services/order-shipment.service.ts`
  - repository: `server/repositories/order-shipment.repo.ts`
  - provider abstraction: `lib/shipping/provider.ts`
- เพิ่ม payment/shipping status fields และ `order_shipments` schema/migration
- ปรับ UI order detail ให้สร้าง label ได้
- เพิ่ม env + README สำหรับ shipping provider
- เพิ่ม manual shipping fallback:
  - รองรับการกรอกลิงก์รูปบิล/ป้าย (`shippingLabelUrl`) ผ่าน `update_shipping`
  - เพิ่ม endpoint `POST /api/orders/[orderId]/send-shipping`
  - เพิ่ม endpoint `POST /api/orders/[orderId]/shipments/upload-label` สำหรับอัปโหลดรูปบิล/ป้ายขึ้น R2
  - รองรับปุ่มอัปโหลดจากเครื่อง + เปิดกล้องมือถือเพื่อถ่ายรูป (`capture=environment`)
  - เพิ่มปุ่ม `ส่งข้อมูลจัดส่งให้ลูกค้า` + `คัดลอกข้อความ` + quick link WhatsApp/Facebook
  - ปรับ validation ของ `shippingLabelUrl` ให้รองรับทั้ง `https://...` และลิงก์ภายใน `/orders/...`
- ปรับ UX หน้า `/orders` สำหรับสร้างออเดอร์:
  - ใช้ `SlideUpSheet` เดียวกันทั้งระบบ
  - Mobile: slide-up sheet (ปัดลง, กดนอกกล่อง, กด X ปิดได้)
  - Desktop: centered modal (กดนอกกล่อง, กด X, กด Escape ปิดได้)
  - ปุ่มสร้างออเดอร์ sticky ด้านล่างในฟอร์มเพื่อใช้งานง่ายบนจอเล็ก
  - ปรับฟอร์มส่วนตัวเลขให้ responsive (`grid-cols-1` บนจอเล็ก)
  - เพิ่ม Phase 1 สแกนบาร์โค้ดในฟอร์มออเดอร์ (เพิ่มสินค้าอัตโนมัติ + fallback ค้นหาเองเมื่อไม่พบ)

## Impact

- รองรับการตั้งราคาขายแพ็ก/กล่องที่ไม่ต้องเป็นสัดส่วนตรงกับหน่วยย่อย (เช่น EA 1,000 แต่ PACK 12 = 10,000)
- ลดข้อผิดพลาดในยอดออเดอร์เมื่อขายด้วยหน่วยแปลง เพราะ UI/API ใช้ราคาต่อหน่วยที่เลือกตรงกัน
- ลดความหนาแน่นของฟอร์มบนมือถือในหน้าเพิ่ม/แก้ไขสินค้า ทำให้กรอกตัวคูณและราคาแพ็กได้ง่ายขึ้น
- ลดการกดหลุด flow ระหว่างสร้างออเดอร์ เพราะหน้า `/orders/new` ไม่แสดงเมนูล่างหลักชั่วคราว
- ลดการออกจากหน้า create order โดยไม่ตั้งใจ เพราะปุ่ม back จะยืนยันก่อนออกเมื่อมีข้อมูลค้าง
- เอกสารออเดอร์/สลิป/งานพิมพ์ไม่ว่างชื่อผู้รับ แม้ผู้ใช้ไม่กรอกชื่อเอง
- ลดอาการเด้งแท็บในหน้า `/stock` โดยเฉพาะตอนสลับไป/กลับแท็บ `ประวัติ`
- ลดการยิงโหลดข้อมูลประวัติที่ไม่จำเป็นเมื่อผู้ใช้อยู่แท็บอื่น (เพราะ keep-mounted แต่ไม่ active)

- ลด friction ตอนคีย์ `ราคาขาย` ในฟอร์มเพิ่มสินค้า เพราะเริ่มจากช่องว่าง (ไม่ต้องลบ `0` ก่อนพิมพ์)
- คง behavior backend เดิม: ถ้าเว้นว่าง `ราคาขาย` จะถูกตีความเป็น `0` ตอนบันทึก

- ผู้ใช้มองเห็น tab ที่ active ชัดขึ้นในหน้า PO เพราะสี active สอดคล้องกับ `primary` ของระบบ (ไม่กลืนกับกลุ่ม neutral)
- visual language ของ navigation ในหน้า PO สอดคล้องกับ theme หลักมากขึ้น โดยไม่เปลี่ยน workflow/filter logic เดิม

- ลดความสับสนเวลาใช้งานช่วงปิดเดือน เพราะรูปแบบเลือกวันที่ในคิว `PO รอปิดเรท` ตรงกับ `Create PO` (พฤติกรรม/ปุ่มลัดเหมือนกัน)
- ลด friction บน mobile/iOS จาก native date input เดิมในคิว pending-rate และช่วยกรองช่วงวันที่ได้เร็วขึ้นด้วย quick actions
- ผู้ใช้หน้า `AP by Supplier` กรองช่วง due date และ export CSV ได้ด้วย UX วันที่แบบเดียวกับ `Create PO` ลดการสลับ mental model ระหว่าง workspace
- ลดปัญหา native date input บนมือถือใน filter `dueFrom/dueTo` โดยยังคงผลลัพธ์ statement/export เท่าเดิม (query format เดิม)
- ฟอร์มตัวกรองใน `AP by Supplier` อ่านง่ายขึ้นบนจอแคบ เพราะตัวกรองวันที่ถูกแยกออกจากแถว filter หลัก ลดการอัดหลายคอนโทรลในบรรทัดเดียว

- ปิดงานปลายเดือนได้เร็วขึ้นมากในกรณีจ่ายบัตรแบบ top-up ก้อนเดียว (ลดการคีย์ PO ทีละใบ)
- ลดความผิดพลาดจากการใส่ reference ไม่สม่ำเสมอ เพราะ bulk flow บังคับใช้ `paymentReference` เดียวกันทั้งรอบ
- ผู้ใช้เห็นรายการที่สำเร็จ/ไม่สำเร็จเป็นราย PO ทันที ทำให้ retry เฉพาะรายการที่ผิดได้เร็ว

- ผู้ใช้เห็นงาน AP เร่งด่วน (`เลยกำหนด` / `ใกล้ครบกำหนด`) ทันทีที่เข้า dashboard โดยไม่ต้องเข้าหน้า PO ก่อน
- ลดโอกาสหลุดงาน due date เพราะ reminder ใช้กติกาเดียวกับหน้า statement ราย supplier
- เพิ่มความเร็วการตามงานค้าง: จาก dashboard กดไป `/stock?tab=purchase` ต่อได้ทันที

- ทีมจัดซื้อ/บัญชีไล่งาน AP ได้เร็วขึ้นจากหน้าเดียว: เห็นยอดค้างราย supplier -> กดดู statement -> เจาะเข้า PO ได้ทันที
- ลดความคลาดเคลื่อนของตัวเลข เพราะ summary/statement/export ใช้ฐาน outstanding dataset เดียวกัน
- ลดงาน manual ช่วงกระทบยอดปลายเดือนด้วย export CSV ราย supplier ตามตัวกรองจริงในหน้าจอ

- รองรับ flow เจ้าหนี้จริง: จ่ายบางส่วนได้, ย้อนรายการได้, และติดตามยอดค้างเป็น PO-level ledger ได้ชัดเจนขึ้น
- ลดความเสี่ยงยอดชำระคลาดเคลื่อนจากการ overwrite ค่าเดิม เพราะทุก payment/reversal ถูกเก็บเป็นรายการแยก
- ทีมบัญชีเห็นหนี้ค้างตามอายุ (AP Aging) และ export CSV ไปกระทบยอด supplier ได้ทันที
- `db:repair` รองรับฐานเก่าที่ยังไม่มีโครง AP ใหม่ ช่วยลดความเสี่ยง 500 หลัง deploy
- ปิดช่องโหว่ flow การเงิน: ระบบไม่ให้บันทึกชำระ PO ต่างสกุลเงินก่อนล็อกเรทจริง ลดความเสี่ยงบันทึกต้นทุนผิด
- ผู้ใช้มีคิวงานปลายงวดชัดเจนขึ้น (PO รับแล้วแต่ยัง `รอปิดเรท`) และกรองตามซัพพลายเออร์/ช่วงวันที่ได้
- ทีมเห็นผลกระทบส่วนต่าง FX จากข้อมูลจริงในหน้า reports (เรทตั้งต้นเทียบเรทที่ล็อก)
- ติดตามสถานะหนี้ PO ได้ง่ายขึ้นจาก `paymentStatus/paidAt/paidBy` ใน PO detail/list
- ผู้ใช้สามารถสร้าง/รับสินค้า PO ต่างสกุลเงินได้แม้ยังไม่ทราบเรทจริง และกลับมาปิดเรทตอนชำระปลายงวดได้
- ลดการเดาเรทตอนสร้าง PO และเพิ่มความชัดเจนของสถานะเรทผ่าน badge/action ในหน้า PO
- ผู้ใช้หน้า `/products` อยู่แท็บเดิมได้หลัง hard refresh/back-forward ลดการต้องกดแท็บซ้ำในงานจริง
- การเปิด PO detail ซ้ำ/เปิดรายการถัดไปเร็วขึ้นชัดเจน เพราะมี cache ต่อใบและ prefetch เฉพาะ intent ของผู้ใช้
- ลดความรู้สึกหน่วงตอนแตะรายการใน PO tab โดยไม่เพิ่ม request แบบยิงล่วงหน้าเกินจำเป็น (ยังคุม network cost ได้)
- History tab รองรับข้อมูลจำนวนมากขึ้นโดยไม่หน่วงจากการ render ทั้งรายการใน DOM พร้อมกัน
- การกรองข้อมูลประวัติย้ายไปฝั่ง server ลด payload และเวลาค้นหาในกรณีข้อมูลเยอะ
- ผู้ใช้ค้นประวัติได้ตรงขึ้นด้วยตัวกรองสินค้า/ช่วงวันที่ โดยไม่ต้องเลื่อนดูทีละหน้าแบบเดิม
- การสลับแท็บในหน้า stock ไม่รีเซ็ตฟอร์ม/รายการที่ผู้ใช้กำลังทำอยู่ ลดงานซ้ำจากการกรอกใหม่
- ผู้ใช้รีเฟรชข้อมูลเฉพาะแท็บที่ใช้งานอยู่ได้ทันที และเห็นเวลาอัปเดตล่าสุดเพื่อลดการกดซ้ำ
- loading/empty/error ของ 3 แท็บหลักมีรูปแบบเดียวกัน ทำให้เข้าใจสถานะระบบได้เร็วขึ้น
- ลดโอกาส submit stock movement ซ้ำจากการกดซ้ำ/เน็ตแกว่ง ด้วย `Idempotency-Key` จาก client
- หน้า PO โฟกัส action หลักขึ้น (`สร้างใบสั่งซื้อ`) และลดความสับสนจากปุ่มตั้งค่าที่ไม่ใช่งานรายวัน
- ลดโอกาสเกิด 500 ในหน้า PO detail จากฐานข้อมูลที่ขาด migration บางช่วง
- flow เปลี่ยนสถานะ PO ที่เขียน `updated_by/updated_at` จะไม่พังจากคอลัมน์หายอีกในฐานที่ผ่าน `db:repair`
- ผู้ใช้สามารถเห็นสาเหตุจริงเมื่อเปิด PO detail ไม่ได้ (เช่น ไม่มีสิทธิ์/ไม่พบ PO/ระบบผิดพลาด) แทนข้อความ generic
- ลดอาการข้อมูล PO detail เพี้ยนจาก request ตีกัน เมื่อคลิกหลายใบติดกันเร็ว ๆ
- การกดสลับแท็บ `ทั้งหมด/ใช้งาน/ปิดใช้งาน` ตอบสนองเร็วขึ้นอย่างเห็นได้ชัด โดยเฉพาะกรณีสลับกลับแท็บเดิม
- ลดอาการหน้าว่าง/ค้างระหว่างโหลดด้วย skeleton loading เมื่อข้อมูลยังมาไม่ถึง
- ลดโอกาสข้อมูลเด้งย้อนจาก request เก่า (stale response) ด้วยการ abort request ที่ถูกแทนที่
- ปุ่ม `โหลดเพิ่มเติม` ไม่ถูกรบกวนจาก loading ของการเปลี่ยนแท็บ (และกลับกัน)
- เพิ่มความโปร่งใสของต้นทุนสินค้า: ทุกการแก้ต้นทุนแบบ manual ต้องมีเหตุผลและมี audit trail ที่ตรวจย้อนหลังได้
- ลดความเสี่ยงแก้ต้นทุนมือโดยไม่มีที่มา เพราะ Product Detail แสดง cost source ล่าสุดจากระบบจริง
- ต้นทุนที่มาจากการรับเข้า PO ถูก trace ได้ระดับสินค้า (อ้างอิงเลข PO) โดยไม่ต้องเพิ่ม schema ใหม่
- ลดความสับสนในหน้า stock recording: ไม่เหลือช่องต้นทุนที่ผู้ใช้คิดว่ามีผลกับ `products.costBase`
- รายงานกำไรอ่านง่ายขึ้น: แยก realized margin ออกจาก current-cost preview ชัดเจน
- ผู้ใช้รีโหลดข้อมูลสินค้าล่าสุดได้ทันทีจาก header โดยไม่ต้องรีโหลดทั้งหน้าเอง
- ผู้ใช้รีโหลดข้อมูลสต็อกล่าสุดได้ตรงแท็บที่กำลังใช้งานผ่าน `รีเฟรชแท็บนี้` โดยไม่ต้องรีโหลดทั้งหน้า
- ลดการกดซ้ำด้วยสถานะโหลดบนปุ่มรีเฟรช
- ลดเคสช่องกรอกใน modal ถูกคีย์บอร์ดมือถือบัง โดยเฉพาะฟอร์มสร้าง/แก้ไขสินค้า
- ลดอาการช่องกรอกหลุดใต้คีย์บอร์ดระหว่าง animation ของคีย์บอร์ด (เช่น iOS/Android บางรุ่น)
- ใช้งานปิด modal ด้วยมือเดียวได้ง่ายขึ้น เพราะลากปิดได้จาก header ไม่ต้องเล็งเฉพาะ handle
- ผู้ใช้มีทางออกจากฟอร์มที่ชัดเจนขึ้นด้วยปุ่ม `ยกเลิก` ใน footer (ไม่ต้องพึ่ง X/ลากลงอย่างเดียว)
- ปุ่ม action หลักในฟอร์มสินค้าอยู่ตำแหน่งคงที่ชิดขอบล่างของ modal (ลดความรู้สึกว่าปุ่มลอย)
- ปุ่ม action หลักของ Product Detail อยู่ตำแหน่งคงที่ที่ footer ใช้งานง่ายขึ้นเมื่อเลื่อนดูข้อมูลยาว
- ลดความเสี่ยงกดปิดใช้งานผิดพลาดด้วย custom confirm dialog ก่อนทำรายการ และ feedback การเปิด/ปิดลื่นขึ้นจาก animation
- ลดพื้นที่รูปที่กินใน Product Detail และยังดูรายละเอียดรูปได้ด้วย full-screen preview เมื่อแตะรูป
- ลดความสับสนเวลาแก้ไขสินค้า เพราะผู้ใช้เห็นรูปปัจจุบันก่อนตัดสินใจเปลี่ยนรูป
- ทำให้ affordance ชัดขึ้นว่า “มีรูปแล้ว” vs “ยังไม่มีรูป”
- ลดความเสี่ยงลบรูปผิดพลาด เพราะการลบมีผลเมื่อผู้ใช้กดบันทึกเท่านั้น
- ลดความซ้ำซ้อนของปุ่มใน Product Detail โดยรวม action รูปไว้ใน Edit Modal จุดเดียว
- ลดจำนวนการกดซ้ำตอนเปลี่ยนกล้องใน scanner เพราะเลือกกล้องจาก dropdown ได้ทันทีแทนการกดวนทีละตัว
- ลด payload เริ่มต้นของหน้า `/products` และทำให้หน้ารองรับร้านที่มีสินค้าจำนวนมากได้ดีขึ้นด้วย server-side pagination
- วางฐาน schema สำหรับรองรับ variant โดยไม่กระทบ flow เดิมของ order/stock (ลดความเสี่ยง rollout แบบยกเครื่องครั้งเดียว)
- เริ่มใช้งาน variant ได้จากหน้า `/products` จริง โดยยังคงโครง `1 variant = 1 sellable SKU` เดิม (order/stock ไม่ต้องรื้อ)
- ลดงาน manual จัดการ dictionary variant เพราะระบบเติม attribute/value ให้จาก payload ตอนบันทึกสินค้า
- ลดความสับสนในการใช้งานฟอร์ม variant เพราะ UI สื่อชัดขึ้นว่าเพิ่มได้ทีละ SKU
- เพิ่มความเร็วตอนคีย์หลายรุ่นย่อยด้วยปุ่ม `บันทึกและเพิ่ม Variant ถัดไป` (ไม่ต้องเปิดฟอร์มใหม่ทุกครั้ง)
- เพิ่ม throughput การคีย์สินค้าแบบมีหลายรุ่นย่อยด้วย Matrix Generator (ลดการกรอกซ้ำแบบทีละ SKU)
- ลด error manual ตอนกรอกชื่อรุ่นย่อย/SKU ซ้ำ ๆ ด้วยการ generate ตารางเริ่มต้นให้จากแกนตัวเลือก
- ลดเวลาทดสอบ/เดโมระบบ เพราะรัน `db:seed` แล้วมีข้อมูล variant พร้อมใช้งานทันที
- ลดความเสี่ยงฐานข้อมูลบางสภาพแวดล้อมตก migration บางช่วง เพราะ `db:repair` รองรับเติมโครง Variant Phase 1 ได้
- ใช้พื้นที่หน้าจอเต็มบน Desktop ได้ทันที ลดสิ่งรบกวนระหว่างใช้งาน POS
- ผู้ใช้ยังคุม UX เองได้ (ไม่บังคับเข้าเต็มจออัตโนมัติ)
- เข้าถึงปุ่มเต็มจอได้สม่ำเสมอผ่าน navbar โดยไม่ผูกกับการ์ดเฉพาะหน้า
- รองรับ POS touch device ที่ต้องการ fullscreen จริงผ่าน env flag โดยไม่บังคับผู้ใช้มือถือทั่วไป
- รองรับการสร้าง shipping label ได้ทั้งโหมดทดสอบ (`STUB`) และโหมด provider จริง (`HTTP`)
- ลดความเสี่ยงยิงซ้ำด้วย idempotency
- เพิ่ม traceability ผ่าน audit log
- มีเอกสารส่งต่องานให้ AI/ทีมชัดเจนขึ้น
- มี inventory กลางสำหรับ API/Schema ทำให้ AI ตัวถัดไปตามงานได้เร็วขึ้น
- มี route map หน้า UI -> API สำหรับ debug และ onboarding dev/AI ได้เร็วขึ้น
- ถ้า auto messaging ใช้ไม่ได้ ผู้ใช้ยังส่งข้อมูลจัดส่งแบบ manual ได้ทันที (ลดงานค้าง)
- ลดงาน manual copy/paste URL เพราะผู้ใช้แนบรูปจากเครื่องหรือกล้องได้ทันที
- ลด friction ข้ามอุปกรณ์ เพราะพฤติกรรมเปิด/ปิดฟอร์มเหมือนกันทั้ง mobile และ desktop
- ลดโอกาสกดผิดระหว่างทำงาน เพราะมี close affordance ครบ (outside click, X, swipe down, Escape)
- ลดเวลาสร้างออเดอร์หน้าร้านด้วยการสแกนบาร์โค้ดและ auto add รายการสินค้า

## Files (สำคัญ)

- `lib/db/schema/tables.ts`
- `drizzle/0040_modern_sales_units.sql`
- `drizzle/0034_spooky_talos.sql`
- `drizzle/meta/0040_snapshot.json`
- `drizzle/meta/0034_snapshot.json`
- `drizzle/meta/_journal.json`
- `scripts/repair-migrations.mjs`
- `lib/products/validation.ts`
- `lib/products/service.ts`
- `components/app/products-management.tsx`
- `app/api/products/route.ts`
- `app/api/products/[productId]/route.ts`
- `lib/orders/queries.ts`
- `components/app/orders-management.tsx`
- `components/app/bottom-tab-nav.tsx`
- `components/app/app-top-nav.tsx`
- `components/ui/menu-back-button.tsx`
- `lib/orders/new-order-draft.ts`
- `app/(app)/orders/new/page.tsx`
- `app/api/orders/route.ts`
- `docs/API_INVENTORY.md`
- `docs/SCHEMA_MAP.md`
- `components/app/purchase-order-list.tsx`
- `docs/UI_ROUTE_MAP.md`
- `docs/DECISIONS.md`
- `AI_CONTEXT.md`
- `docs/HANDOFF.md`
- `server/services/dashboard.service.ts`
- `server/services/purchase-ap.service.ts`
- `components/storefront/dashboard/shared.tsx`
- `components/storefront/dashboard/types/online-dashboard.tsx`
- `components/storefront/dashboard/types/cafe-dashboard.tsx`
- `components/storefront/dashboard/types/restaurant-dashboard.tsx`
- `components/storefront/dashboard/types/other-dashboard.tsx`
- `app/(app)/dashboard/page.tsx`
- `docs/UI_ROUTE_MAP.md`
- `docs/DECISIONS.md`
- `AI_CONTEXT.md`
- `docs/HANDOFF.md`
- `app/api/stock/purchase-orders/ap-by-supplier/route.ts`
- `app/api/stock/purchase-orders/ap-by-supplier/statement/route.ts`
- `app/api/stock/purchase-orders/ap-by-supplier/export-csv/route.ts`
- `server/services/purchase-ap.service.ts`
- `components/app/purchase-ap-supplier-panel.tsx`
- `components/app/purchase-order-list.tsx`
- `docs/API_INVENTORY.md`
- `docs/UI_ROUTE_MAP.md`
- `docs/DECISIONS.md`
- `AI_CONTEXT.md`
- `docs/HANDOFF.md`
- `app/api/stock/movements/route.ts`
- `app/api/stock/purchase-orders/[poId]/finalize-rate/route.ts`
- `app/api/stock/purchase-orders/[poId]/payments/[paymentId]/reverse/route.ts`
- `app/api/stock/purchase-orders/[poId]/settle/route.ts`
- `app/api/stock/purchase-orders/outstanding/export-csv/route.ts`
- `app/api/stock/purchase-orders/pending-rate/route.ts`
- `server/services/stock.service.ts`
- `server/repositories/stock.repo.ts`
- `server/services/purchase.service.ts`
- `server/repositories/purchase.repo.ts`
- `lib/inventory/queries.ts`
- `lib/purchases/validation.ts`
- `lib/db/schema/tables.ts`
- `components/app/stock-movement-history.tsx`
- `components/app/stock-tabs.tsx`
- `components/app/stock-tab-feedback.tsx`
- `components/app/purchase-order-list.tsx`
- `components/app/stock-movement-history.tsx`
- `components/app/stock-recording-form.tsx`
- `app/api/products/[productId]/route.ts`
- `lib/products/validation.ts`
- `lib/products/service.ts`
- `server/services/purchase.service.ts`
- `components/app/products-management.tsx`
- `components/app/stock-recording-form.tsx`
- `lib/reports/queries.ts`
- `app/(app)/reports/page.tsx`
- `AI_CONTEXT.md`
- `docs/API_INVENTORY.md`
- `docs/UI_ROUTE_MAP.md`
- `docs/DECISIONS.md`
- `docs/SCHEMA_MAP.md`
- `drizzle/0029_black_thunderbolt_ross.sql`
- `drizzle/0030_old_valkyrie.sql`
- `drizzle/0031_loud_maximus.sql`
- `drizzle/meta/0029_snapshot.json`
- `drizzle/meta/0030_snapshot.json`
- `drizzle/meta/0031_snapshot.json`
- `drizzle/meta/_journal.json`
- `AI_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_INDEX.md`
- `docs/CODEBASE_MAP.md`
- `docs/UI_ROUTE_MAP.md`
- `docs/API_INVENTORY.md`
- `docs/SCHEMA_MAP.md`
- `docs/DECISIONS.md`
- `docs/product-variants-plan.md`
- `docs/HANDOFF.md`
- `app/api/orders/[orderId]/shipments/label/route.ts`
- `app/api/orders/[orderId]/shipments/upload-label/route.ts`
- `app/api/orders/[orderId]/send-shipping/route.ts`
- `server/services/order-shipment.service.ts`
- `server/repositories/order-shipment.repo.ts`
- `lib/shipping/provider.ts`
- `lib/storage/r2.ts`
- `components/app/order-detail-view.tsx`
- `components/app/app-top-nav.tsx`
- `components/ui/slide-up-sheet.tsx`
- `components/app/orders-management.tsx`
- `components/app/products-management.tsx`
- `app/(app)/products/page.tsx`
- `app/api/products/route.ts`
- `app/api/products/[productId]/route.ts`
- `lib/products/service.ts`
- `lib/products/validation.ts`
- `lib/products/variant-options.ts`
- `lib/products/variant-persistence.ts`
- `components/app/products-header-refresh-button.tsx`
- `lib/orders/messages.ts`
- `lib/orders/validation.ts`
- `app/(app)/stock/page.tsx`
- `app/api/orders/[orderId]/route.ts`
- `lib/db/schema/tables.ts`
- `drizzle/0027_tough_the_renegades.sql`
- `drizzle/0028_bouncy_justin_hammer.sql`
- `scripts/repair-migrations.mjs`
- `scripts/seed.mjs`

## How To Verify

1. โหลด env

```bash
set -a
source .env.local
set +a
```

2. DB

```bash
npm run db:repair
npm run db:migrate
```

ตรวจสอบเพิ่ม (optional): ตาราง `purchase_orders` ต้องมีคอลัมน์ `updated_by` และ `updated_at`

3. Quality checks

```bash
npm run lint
npm run build
```

4. Functional check
- เปิด `/products` > เพิ่ม/แก้ไขสินค้า:
  - ตั้งตัวอย่าง `ราคาหน่วยหลัก (EA)=1000`
  - เพิ่มหน่วยแปลง `PACK` ตัวคูณ `12` แล้วกรอก `ราคาต่อหน่วยแปลง=10000`
  - บันทึกแล้วเปิด Product Detail tab `ราคา` ต้องเห็นราคา PACK เป็น `10000` (ไม่ใช่ `12000`)
- เปิด `/orders/new` หรือ modal สร้างออเดอร์ใน `/orders`:
  - เพิ่มสินค้าตัวอย่างข้างต้น แล้วเปลี่ยนหน่วยเป็น `PACK`
  - ยอดรวมบรรทัดต้องคำนวณตาม `10000 x จำนวน` และยอดรวมทั้งออเดอร์ต้องตรงกันกับฝั่ง API ตอนบันทึก
- เปิด `/orders/new` แล้วเพิ่มสินค้าอย่างน้อย 1 รายการ จากนั้นกดปุ่ม back บน navbar:
  - ต้องเห็น confirm เตือนข้อมูลค้าง
  - กด `ยกเลิก` ต้องยังอยู่หน้าเดิมและข้อมูลไม่หาย
  - กด `ตกลง` ต้องกลับ `/orders`
- เปิด `/orders/new` แล้วไม่กรอกชื่อลูกค้า จากนั้นบันทึกออเดอร์:
  - ถ้า channel = `WALK_IN` ชื่อในออเดอร์ต้อง fallback เป็น `ลูกค้าหน้าร้าน`
  - ถ้า channel = `FACEBOOK/WHATSAPP` ชื่อในออเดอร์ต้อง fallback เป็น `ลูกค้าออนไลน์` (เมื่อไม่มีชื่อจาก contact)
- เปิด `/stock?tab=purchase` ในการ์ด `คิว PO รอปิดเรท`:
  - เลือกหลาย PO สกุลเดียวกัน แล้วกด `ปิดเรท + ชำระปลายเดือน`
  - กรอก `อัตราแลกเปลี่ยน`, `วันที่ชำระ`, และ `paymentReference` แล้วเริ่มประมวลผล
  - ต้องเห็น progress ระหว่างรัน และเมื่อสำเร็จ PO เหล่านั้นต้องออกจากคิว `รอปิดเรท`
  - เปิด PO detail แต่ละใบที่สำเร็จ ต้องเห็นสถานะชำระอัปเดตและมี `paymentReference` ตามที่กรอก
- ทดสอบเลือก PO หลายสกุลเงินพร้อมกัน:
  - ระบบต้องไม่ให้เริ่ม bulk และแจ้งเตือนให้เลือกทีละสกุล
- ทดสอบให้บาง PO fail (เช่น ปิดสิทธิ์/แก้ข้อมูลระหว่างรัน):
  - ต้องมีรายการ error ราย PO และยังคงรายการที่ fail ไว้ให้แก้แล้วรันซ้ำได้
- เปิด `/dashboard` (ผู้ใช้ที่มีสิทธิ์ `dashboard.view` + `inventory.view`):
  - ต้องเห็นบล็อก `งานเจ้าหนี้ค้างชำระ (AP)`
  - ถ้ามี PO ค้างชำระเลยกำหนด/ใกล้ครบกำหนด ต้องเห็น count และยอดรวมแยกตามสถานะ
  - รายการเตือนต้องแสดง `PO`, `supplier`, `due date`, และ `ยอดค้าง`
  - ปุ่ม `ไปหน้า PO` ต้องพาไป `/stock?tab=purchase`
- เปิด `/stock?tab=purchase` แล้วดูการ์ด `AP ราย supplier`:
  - ต้องเห็นรายชื่อ supplier พร้อมยอดค้างรวม และจำนวน PO
  - ช่องค้นหา supplier ต้องกรองรายการได้
- เลือก supplier แล้วตรวจ statement:
  - ต้องเห็นรายการ PO ค้างชำระของ supplier นั้น
  - เปลี่ยน filter `payment status` / `due status` / ช่วง `due date` / ค้นหาเลข PO แล้วผลลัพธ์ต้องเปลี่ยนตาม
  - กดรายการใน statement ต้องเปิด PO detail ใบเดียวกันได้
- ใน panel `AP ราย supplier` กด `Export Supplier CSV`:
  - ต้องได้ไฟล์ CSV ที่มีคอลัมน์ `supplier_name`, `po_number`, `payment_status`, `due_status`, `outstanding_base`
  - ข้อมูลในไฟล์ต้องตรงกับ filter ปัจจุบันของ statement
- ไปหน้า `/stock?tab=purchase` แล้วคลิก PO หลายใบติดกันเร็ว ๆ:
  - ต้องไม่ค้างหรือสลับรายละเอียดผิดใบจาก request เก่า
- ทดสอบกรณี API detail ล้มเหลว (เช่น ปิด network ชั่วคราว/poId ไม่ถูกต้อง):
  - ใน sheet ต้องแสดงข้อความ error ที่สื่อสาเหตุจริง ไม่ใช่ `ไม่พบข้อมูล` ตายตัว
- เปิด `/products` แล้วกดสลับแท็บ `ทั้งหมด` <-> `ใช้งาน` <-> `ปิดใช้งาน` ต่อเนื่องเร็ว ๆ:
  - แท็บ active ต้องเปลี่ยนทันที
  - ถ้าแท็บนั้นยังไม่เคยโหลด ต้องเห็น skeleton list ระหว่างรอ
  - ถ้าเคยโหลดแล้ว ต้องเห็นข้อมูลขึ้นเร็วจาก cache และมีข้อความ `กำลังอัปเดตรายการ...` ชั่วคราว
- เปิด `/products` แล้วเลื่อนลงจน search bar ติดบน: ตอนปกติ search bar ต้องเป็น `py-4 + border` และตอน stuck ต้องเปลี่ยนเป็น `py-2` (ไม่มี border); เลื่อนกลับขึ้นบนต้องกลับเป็นแบบเดิม
- ขณะสลับแท็บ ให้กด `โหลดเพิ่มเติม` ตรวจว่า loading ของปุ่มยังแยกจาก loading ของการเปลี่ยนแท็บ
- เปิด `/products` > Product Detail > tab `ต้นทุน` > กด `แก้ไขต้นทุน`
- ไม่กรอกเหตุผลแล้วกดบันทึก: ปุ่มต้อง disabled และ/หรือระบบเตือน
- กรอกเหตุผล + เปลี่ยนต้นทุนแล้วบันทึก: ต้องสำเร็จ และใน tab ต้นทุนต้องเห็น `ที่มาของต้นทุนล่าสุด` เป็น `แก้ไขมือ` พร้อมเหตุผล/เวลา/ผู้ทำ
- สร้างหรือรับเข้า PO ให้ต้นทุนสินค้าเปลี่ยน แล้วกลับไปเปิด Product Detail: source ต้องเป็น `รับเข้า PO` และมีเลข PO ในช่องอ้างอิง
- เปิด `/stock?tab=recording` แล้วตรวจว่าโดย default ไม่มีช่องกรอกต้นทุน
- ใน `/stock?tab=recording` (ประเภท `รับเข้า`) ต้องมีปุ่มเล็ก `แก้ต้นทุนในหน้าสินค้า →` และเมื่อกดแล้วต้องพาไป `/products` พร้อมคำค้นหา SKU/ชื่อของสินค้าที่เลือก
- เปิด `/stock?tab=history` แล้วตรวจว่ารายการประวัติเป็น card แบบ compact (padding น้อยลง/ไม่มี shadow) และถ้า note ยาวต้องถูกตัดด้วย `…` ในบรรทัดเดียว
- เปิด `/stock?tab=history` บนมือถือแล้วตรวจว่า date from/to อยู่บรรทัดเดียวกัน (2 คอลัมน์) ใต้ช่องกรองประเภท/ค้นหาสินค้า
- เปิด `/stock?tab=history` บนมือถือแล้วกดเปิด date picker: popover ปฏิทินต้องกว้างเต็มแถว (ไม่ถูกจำกัดตามความกว้าง input)
- เปิด `/reports` แล้วตรวจว่าการ์ด `กำไรขั้นต้น` มีทั้ง realized และ current-cost preview พร้อมส่วนต่าง
- เปิดหน้า `/products` แล้วตรวจว่ามีปุ่ม `รีเฟรช` อยู่ขวาบนบรรทัดเดียวกับ title `สินค้า`
- กดปุ่ม `รีเฟรช` และตรวจว่าปุ่มแสดง `กำลังรีเฟรช...` ระหว่างโหลด
- สร้าง PO โดยเลือกสกุลเงินต่างประเทศและไม่กรอกเรท:
  - ต้องสร้างสำเร็จและแสดงสถานะ `รอปิดเรท`
- เปลี่ยน PO เป็น `RECEIVED` แล้วเปิด detail:
  - ต้องเห็นปุ่ม `ปิดเรท`
  - ถ้าเป็น PO ต่างสกุลเงิน ต้องเห็น block เรทชัดเจนว่า `เรทที่ใช้ตอนนี้`, `เรทตั้งต้น`, และสถานะ `รอปิดเรท/ปิดเรทแล้ว`
- กด `ปิดเรท` แล้วกรอกเรทจริง:
  - ต้องบันทึกสำเร็จ, badge/ข้อความเปลี่ยนเป็น `ปิดเรทแล้ว` และปุ่ม `ปิดเรท` หาย
  - ก่อนกดยืนยัน ต้องเห็น preview `สินค้า / ค่าขนส่ง / ค่าอื่น / ยอดรวมหลังปิดเรท / ส่วนต่าง` ใน modal เดียวกัน และตัวเลขต้องขยับตามเรทที่พิมพ์แบบ real-time
  - หลังปิดเรทสำเร็จ ถ้ายังมี `ยอดค้าง` ระบบจะเปิดฟอร์ม `บันทึกชำระ` ต่อทันที (prefill ยอดค้าง) เพื่อปิดงานต่อเนื่อง
- PO ที่ `RECEIVED` และต่างสกุลเงิน:
  - ถ้ายัง `รอปิดเรท` ปุ่ม `บันทึกชำระ` ต้องถูก disable/ถูก block ด้วยข้อความชัดเจน
  - หลัง `ปิดเรท` แล้วกด `บันทึกชำระ` ต้องสำเร็จและแสดงสถานะ `ชำระแล้ว`
- ทดสอบ `บันทึกชำระ` แบบบางส่วน:
  - ใส่ยอดน้อยกว่ายอดรวม แล้วสถานะต้องเป็น `ชำระบางส่วน`
  - กรอกยอดเกินยอดค้างต้องถูก block พร้อมข้อความเตือน
- ใน PO detail:
  - ต้องเห็น timeline รายการ `PAYMENT/REVERSAL`
  - กด `ย้อนรายการ` บน payment ที่ยังไม่ถูกย้อน ต้องสำเร็จและยอดค้างเพิ่มกลับ
- เปิด `/reports` การ์ด `AP Aging`:
  - ต้องเห็น bucket `0-30 / 31-60 / 61+` และยอดรวมค้างชำระ
- ทดสอบ export CSV:
  - กด `Export CSV` จากหน้า `/reports` หรือ `/stock?tab=purchase` แล้วต้องได้ไฟล์ที่มีคอลัมน์ `supplier_name`, `po_number`, `outstanding_base`, `fx_delta_base`
- หน้า `/stock?tab=purchase` ส่วน `คิว PO รอปิดเรท`:
  - เปลี่ยน filter ซัพพลายเออร์/ช่วงวันที่แล้วรายการคิวต้องเปลี่ยนตาม
  - กดรายการในคิวต้องเปิด PO detail ใบนั้นได้ทันที
- หน้า `/reports`:
  - ต้องมีการ์ด `ผลต่างอัตราแลกเปลี่ยน (PO)` พร้อมตัวเลข pending/locked/changed และผลรวมผลต่างมูลค่า
- ไปที่ `/products?status=inactive` แล้ว hard refresh: ต้องคงแท็บ `ปิดใช้งาน`
- สลับแท็บสถานะใน `/products`: URL query `status` ต้องเปลี่ยนตาม และกด back/forward แล้วแท็บต้องตาม URL
- เปิดหน้า `/stock` แล้วตรวจว่าไม่มีปุ่ม `รีเฟรช` ระดับหน้าใน header แล้ว
- ตรวจทุกแท็บ (`Inventory/PO/Recording/History`) ว่ามีปุ่ม `รีเฟรชแท็บนี้` และทำงานได้ตามแท็บนั้น
- เปิด `/products` > เพิ่มสินค้าใหม่ บนมือถือ แล้วโฟกัสช่องกรอกล่าง ๆ (เช่น threshold/conversion) เพื่อตรวจว่าหน้าฟอร์มเลื่อนตามและไม่ถูกคีย์บอร์ดบัง
- เปิด `/products` > แก้ไขสินค้า บนมือถือ แล้วสลับโฟกัสช่องบน/ล่างซ้ำหลายครั้งขณะคีย์บอร์ดเปิดอยู่ เพื่อตรวจว่าช่องที่โฟกัสยังอยู่ในมุมมองเสมอ
- เปิด modal บนมือถือแล้วลองลากลงจากแถบ header: ต้องปิดได้เหมือนลากจาก handle และปุ่ม `X` ต้องกดปิดได้ปกติ
- เปิดฟอร์มเพิ่ม/แก้ไขสินค้าแล้วตรวจว่า footer มีปุ่ม `ยกเลิก` และ `บันทึก` ชิดขอบล่างของ modal; กด `ยกเลิก` แล้วต้องปิดฟอร์มได้ทันที
- เปิด Product Detail แล้วตรวจว่าปุ่ม `แก้ไข/สำเนา/เปิด-ปิดใช้งาน/พิมพ์บาร์โค้ด` อยู่ที่ footer แบบ sticky
- กด `ปิดใช้งาน` ใน Product Detail ต้องมี custom confirm dialog (ไม่ใช่ browser alert) พร้อม animation เปิด/ปิด และแสดงกึ่งกลางจอ; กดยืนยันแล้วสถานะต้องเปลี่ยนสำเร็จ
- เปิด Product Detail แล้วตรวจว่าขนาดรูปเล็กลง; แตะรูปแล้วต้องเปิด preview เต็มจอและกดปิดได้ทั้งพื้นหลัง, ปุ่ม `X`, และปุ่ม `Esc`
- เปิด modal สแกนบาร์โค้ดใน `/products` บนอุปกรณ์ที่มีกล้องมากกว่า 1 ตัว แล้วตรวจว่ามี dropdown `เลือกกล้อง`; เมื่อเปลี่ยนกล้องต้องสลับกล้องตามที่เลือกได้ทันที
- เปิด `/products` แล้วตรวจว่าเห็นรายการชุดแรก ~30 รายการ จากนั้นกด `โหลดเพิ่มเติม` ต้องดึงหน้าถัดไปเพิ่ม และจำนวนผลรวมข้าง filter ต้องอิง `total` จาก API
- ลองค้นหา/กรองหมวด/สถานะ/เรียงลำดับ แล้วกด `โหลดเพิ่มเติม` อีกครั้งเพื่อตรวจว่า API ยังคงใช้พารามิเตอร์เดิม (`q`,`categoryId`,`status`,`sort`) พร้อม `page` ที่ถูกต้อง
- เปิด `/products` > เพิ่มสินค้าใหม่ > เปิด toggle `Variant` แล้วกรอก `Model + Variant + options` จากนั้นบันทึก
- ใน create modal เมื่อเปิด `Variant` ต้องเห็น helper text ว่า "ฟอร์มนี้บันทึกได้ทีละ 1 SKU"
- ใน create modal เมื่อเปิด `Variant` ต้องเห็นปุ่ม `บันทึกและเพิ่ม Variant ถัดไป`; กดแล้วฟอร์มต้องไม่ปิด และเคลียร์ `SKU/Barcode/ชื่อรุ่นย่อย`
- ใน create modal เมื่อเปิด `Variant` ต้องเห็น section `สร้างหลายรุ่นย่อยอัตโนมัติ (Matrix)`:
  - กรอกแกนตัวเลือกแล้วกด `สร้างตารางรุ่นย่อย` ต้องได้รายการหลายแถว
  - กด `สร้างบาร์โค้ดที่ยังว่าง` แล้วแถวที่ยังไม่มีบาร์โค้ดต้องถูกเติมค่า
  - กด `บันทึกหลายรุ่นย่อย` แล้วต้องสร้างสินค้าได้ตามจำนวนแถวที่ valid
- เปิดสินค้าที่สร้างแล้วใน Product Detail ต้องเห็น `สินค้าแม่ (Model)`, `รุ่นย่อย`, และ chip ของตัวเลือก
- แก้ไขสินค้าเดิมแล้วปิด toggle `Variant` จากนั้นบันทึก และตรวจว่า detail แสดง `Model/Variant` เป็น `—` (เคลียร์ค่า variant ได้)
- ลองบันทึก variant เดิมซ้ำใน model เดียวกัน (options ชุดเดียวกัน) ต้องได้ข้อความ conflict (กันซ้ำระดับ model+options)
- รัน `npm run db:migrate` แล้วตรวจใน DB ว่ามีตาราง `product_models`, `product_model_attributes`, `product_model_attribute_values` และคอลัมน์ใหม่ใน `products` ครบ
- รัน `npm run db:repair` บนฐานที่ยังไม่ครบ migration เพื่อตรวจว่า script สามารถเติมตาราง/คอลัมน์ของ Variant Phase 1 ได้โดยไม่ error
- รัน `npm run db:seed` แล้วตรวจว่ามีสินค้า variant ตัวอย่าง:
  - `FBX-750`, `FBX-1000`
  - `SHT-WHT-M`, `SHT-BLK-L`
  และใน summary ต้องแสดง `product_models` กับ `variant_products` มากกว่า 0
- เปิด `/products` > รายละเอียดสินค้า > แก้ไขสินค้า แล้วตรวจว่าเห็นรูปปัจจุบันทันที ก่อนเลือกรูปใหม่
- เลือกรูปใหม่แล้วตรวจว่า preview เปลี่ยนเป็นรูปใหม่ และกดลบรูปที่เลือกแล้วกลับมาเห็นรูปปัจจุบัน
- ตรวจกรอบรูป: ไม่มีรูปต้องเป็นเส้น dashed และเมื่อมีรูปต้องเป็นเส้น solid
- ใน edit modal กดตั้งค่าลบรูปปัจจุบัน แล้วกดปิด/ยกเลิกฟอร์ม: กลับมาเปิดใหม่ต้องยังเห็นรูปเดิม (ยังไม่ถูกลบ)
- ใน edit modal กดตั้งค่าลบรูปปัจจุบัน แล้วกด `บันทึก`: รูปต้องถูกลบจริง
- ใน Product Detail ต้องไม่เห็นปุ่ม quick action รูป (`เปลี่ยนรูป`/`ลบรูป`)
- เปิดหน้าในโซนแอปบน Desktop แล้วตรวจว่ามีปุ่มไอคอน `Full Screen` ที่ navbar
- ตั้ง `NEXT_PUBLIC_POS_ALLOW_FULLSCREEN_ON_TOUCH=false` แล้วเปิดหน้าในโซนแอปบน Mobile/Tablet เพื่อตรวจว่าไม่แสดงปุ่ม `Full Screen`
- ตั้ง `NEXT_PUBLIC_POS_ALLOW_FULLSCREEN_ON_TOUCH=true` แล้วเปิดหน้าในโซนแอปบน POS tablet/mobile (browser ที่รองรับ fullscreen) เพื่อตรวจว่าแสดงปุ่ม `Full Screen`
- กดปุ่มเพื่อเข้าเต็มจอ และกดซ้ำ/กด `Esc` เพื่อออก
- เปิด order ที่สถานะ `PACKED` หรือ `SHIPPED`
- กด `สร้าง Shipping Label`
- ตรวจว่ามี `trackingNo`/`labelUrl` และมี audit event
- กรอก `ลิงก์รูปบิล/ป้ายจัดส่ง` ด้วยมือ และกด `บันทึกข้อมูลจัดส่ง`
- ทดสอบปุ่ม `อัปโหลดรูปจากเครื่อง` และ `ถ่ายรูปจากกล้อง` ในหน้า order detail
- ยืนยันว่าอัปโหลดสำเร็จแล้ว `shippingLabelUrl` ถูกเติมอัตโนมัติ และกด `บันทึกข้อมูลจัดส่ง` ได้
- กด `ส่งข้อมูลจัดส่งให้ลูกค้า` และทดสอบปุ่ม `คัดลอกข้อความ`

## Known Issues / Notes

- build อาจเจอข้อผิดพลาด `.next ... [turbopack]_runtime.js` แบบชั่วคราวได้บางครั้ง (rerun แล้วผ่าน)
- ใน environment นี้มี DNS warning ไป Turso ระหว่าง build แต่ build จบได้

## Next Step (แนะนำลำดับ)

1. เพิ่ม bulk payment import/reconcile จาก CSV statement ธนาคาร/บัตร แล้ว match เข้า PO/payment ledger แบบ idempotent
2. เพิ่ม role policy แบบละเอียดใน notification (`ใคร mute ได้`, scope ต่อ store/user/role) และเพิ่ม audit event สำหรับ action mute/snooze
3. เพิ่มช่องทางส่งแจ้งเตือนถัดไป (email/push) โดย reuse notification_inbox เป็น source-of-truth
4. เพิ่ม outbox worker สำหรับส่งข้อความ shipping label ไป Facebook/WhatsApp
- PO detail modal บน mobile ปรับ badge สถานะให้ใช้ `self-start` แล้ว เพื่อให้ `ຮັບແລ້ວ`/status อื่นเป็น fit-content ไม่ stretch เต็มความกว้าง; action buttons ยังคง stack เต็มความกว้างตามเดิม
- PO detail modal เปลี่ยน behavior ของ action status update แล้ว: หลัง `ORDERED/SHIPPED/RECEIVED/CANCELLED` สำเร็จ จะไม่ปิด modal หลักอีก แต่จะคง sheet ไว้และอัปเดตข้อมูล PO เดิมต่อทันที
- Product detail tab `ต้นทุน` แสดง `ต้นทุนจาก PO ล่าสุด` เป็นบรรทัดรองแล้ว โดยอิง audit `product.cost.auto_from_po`; ถ้า current cost ถูก manual override และต่างจาก PO cost ล่าสุด จะมีข้อความเตือนว่า override อยู่พร้อม delta
- PO create/edit เพิ่มโหมดกรอกราคา `ต่อหน่วย / ยอดรวมรายการ` ต่อ item แล้ว; ใช้เพื่อรองรับเคสคัดลอกราคารวมจาก marketplace แต่ระบบยัง submit `unitCostPurchase` เดิมเข้า backend
- PO create/edit ปรับ UX ของช่อง `ยอดรวมรายการ` แล้ว: ตอนสลับเข้า mode นี้จะไม่ auto ยัด `0` ค้างใน input ถ้ายังไม่มีราคาจริง และใน edit form ก็ใช้ placeholder `0` เหมือนช่อง `ราคาต่อหน่วย`
- แก้ bug ของ create PO flow ที่ปุ่มสร้างแล้วเปลี่ยนสถานะต่อทันทีเคยส่ง `unitCostPurchase = 0` เมื่อผู้ใช้กรอกแบบ `ยอดรวมรายการ`; ตอนนี้ทุก create path ใช้ `getPurchaseItemResolvedUnitCost(...)` เหมือนกันแล้ว ทำให้ยอด PO และ settle payment ไม่เพี้ยนเป็น 0
- PO item editor ใน create/edit ล็อก label row ของ `จำนวน` และ `ราคา` ให้สูงเท่ากันแล้ว พร้อมเพิ่ม label ชัดใน edit modal ด้วย เพื่อลดอาการ input ขยับตำแหน่งเมื่อสลับโหมดราคา
- PO item editor บน mobile คง `จำนวน`/`ราคา` ไว้แถวเดียว 2 คอลัมน์ตาม UX เดิม แต่เพิ่ม `min-w-0` + `appearance-none` ให้ number inputs และคง label row สูงเท่ากัน เพื่อกันอาการ input ดูขยับตำแหน่งตอนกรอกค่าหรือสลับโหมดราคา
- เพิ่ม script [scripts/audit-po-integrity.mjs](/Users/csl-dev/Desktop/alex/lex-pos/pos-turso/scripts/audit-po-integrity.mjs) และ npm script `npm run po:audit:integrity` สำหรับตรวจ PO ที่ข้อมูลสินค้า/ต้นทุนเพี้ยนเป็น 0 จากฐานเดิม พร้อมจัดกลุ่ม action recommendation ตาม status (`EDIT_DRAFT`, `CANCEL_AND_RECREATE`, `MANUAL_REPAIR_REQUIRED`)
- การ์ด list ของ PO ในหน้า `/stock?tab=purchase` ปรับยอดรวมให้ตรงกับ detail แล้ว: list API คืน `totalCostPurchase` เพิ่ม และ UI จะโชว์ยอดซื้อจริงใน `purchaseCurrency` เป็นหลักสำหรับ PO ต่างสกุลเงิน พร้อม `≈` ยอดฐานร้านเป็นค่ารอง
- `PurchaseOrderList` ตั้ง `cache: "no-store"` ให้ GET ของ `/api/stock/purchase-orders`, `/api/stock/purchase-orders/[poId]`, และ `/api/stock/purchase-orders/pending-rate` แล้ว เพื่อลดอาการหน้า list PO ค้างค่าเก่าหลัง create/receive/settle ขณะที่ detail สดกว่า
- route GET ของ `/api/stock/purchase-orders`, `/api/stock/purchase-orders/[poId]`, และ `/api/stock/purchase-orders/pending-rate` ส่ง `Cache-Control: no-store` แล้วด้วย เพื่อปิดโอกาสที่ browser/Next cache ฝั่ง response ทำให้การ์ด list PO ค้าง `0 items / $0 / outstanding` ทั้งที่ detail ถูกต้อง
- ต้นเหตุอีกชั้นของ PO list ไม่ตรง detail คือ `components/app/purchase-order-list.tsx` ใช้ `useState(initialList)` แล้วไม่ sync prop ใหม่จาก `router.refresh()`; เพิ่ม `useEffect` รีเซ็ต `poList/poPage/hasMore` เมื่อ `initialList` เปลี่ยนแล้ว จึงไม่ค้างค่าเก่าระดับ client state อีก
- เพิ่ม helper แปลง `PurchaseOrderDetail` เป็น `PurchaseOrderListItem` ใน `components/app/purchase-order-list.tsx` แล้ว และให้ `PODetailSheet` upsert แถวใน `poList` ทันทีหลัง `save edit / change status / finalize rate / settle / apply extra cost / reverse payment` เพื่อลดเคส list card ค้าง `0 items / $0 / outstanding` แม้ detail ถูก
- เพิ่ม force refresh ของ PO list เมื่อแท็บ `/stock?tab=purchase` ถูกเปิดครั้งแรกด้วย `reloadFirstPage()` ผ่าน API `no-store`; ช่วยปิดช่องว่างกรณี `initialPOs` จาก server render stale กว่า detail API
- การ์ด PO list ปรับ UX เพิ่ม: ถ้า `totalCostPurchase = 0` แต่ยังมี `shipping/other cost` จะไม่โชว์ `$0` เป็นยอดหลักอีก แต่จะใช้ยอดฐานร้านเป็นหลักแทน และ `Outstanding` จะไม่แสดงเมื่อสถานะชำระเป็น `PAID` หรือยอดค้าง `<= 0`
- การ์ด PO list ดึง `firstItemName` จาก query summary แล้ว และแสดงชื่อสินค้าจริง (`สินค้าแรก + จำนวนที่เหลือ`) เพื่อให้การ์ดอ่านง่ายกว่า `0 items / n items` อย่างเดียว
- `CurrencyAmountStack` ใน `components/app/purchase-order-list.tsx` รองรับ layout แบบ `inline` แล้ว และการ์ด PO list ใช้โหมดนี้เพื่อให้ยอดต่างสกุลอย่าง `$1 ≈ ₭1` อยู่บรรทัดเดียวกัน ไม่แตกเป็นสองบรรทัดบน card
- ฟอร์ม `อัปเดตค่าขนส่ง/ค่าอื่น` ใน `PODetailSheet` จะ default สกุลเงินของ `shipping/other cost` ตาม `purchaseCurrency` เมื่อ PO เป็นเงินต่างประเทศและยังไม่มีค่าเดิมแล้ว เพื่อลดเคสบันทึกค่าขนส่งเป็น LAK โดยไม่ตั้งใจ
- route `POST /api/stock/purchase-orders` normalize `shippingCostCurrency` และ `otherCostCurrency` แล้ว ถ้า request ไม่ส่ง field นี้มา ระบบจะ fallback เป็น `purchaseCurrency` ของ PO แทน `LAK`; ช่วยกันเคส create PO เป็น USD/THB แต่ shipping/other ถูกเก็บเป็น LAK เพราะ schema default เดิม
- create PO summary ใน `components/app/purchase-order-list.tsx` แสดง mini รายการสินค้าแล้ว: แต่ละบรรทัดมี `ชื่อสินค้า`, `จำนวน × ราคาต่อหน่วยซื้อ`, และ `ยอดต่อบรรทัด` แทนการโชว์แค่ `Products (n items)` + ยอดรวมก้อนเดียว เพื่อให้ผู้ใช้ตรวจ PO ก่อนบันทึกได้ง่ายขึ้น
- create PO summary ปรับ `Shipping cost` และ `Other cost` ให้แสดง `สกุลเงินจริงที่กรอก` เป็นหลักแล้ว; ถ้าเป็นเงินต่างสกุลจากร้าน จะโชว์ `≈ store currency` เป็นบรรทัดรองเหมือนยอดสินค้า
- ปรับ PO list card ใน `/stock?tab=purchase` ให้แยกยอด `สินค้า`, `ค่าขนส่ง`, และ `ค่าอื่น` เป็นคนละบรรทัด แทนการสรุปรวมก้อนเดียว เพื่อให้ใบต่างสกุลเงินอ่านง่ายขึ้น เช่น `สินค้า $1 ≈ ₭...` และ `ค่าขนส่ง $1 ≈ ₭...`; ฝั่ง list repo ถูกขยายให้ส่ง `shippingCostOriginal/shippingCostCurrency` และ `otherCostOriginal/otherCostCurrency` มาที่ client แล้ว
- ปรับ compact layout ของ PO list card เพิ่มเติม: `สินค้า / ค่าขนส่ง / ค่าอื่น` ถูกรวมเป็นบรรทัด summary เดียวคั่นด้วย `·` เพื่อ save area บนมือถือ แต่ `Outstanding` ถูกแยกลงอีกบรรทัดเพื่อให้สถานะการค้างชำระไม่ไปรบกวนการอ่านต้นทุน
- ปรับ logic `paymentStatus/outstanding` ของ PO ให้ derive จากยอดรวมจริงพร้อม tolerance `5` หน่วยของสกุลร้านแทนการเชื่อค่าใน DB ตรง ๆ เพื่อกันเคส `Paid` แต่ยังเหลือ outstanding 1-2 หน่วยจากการปัดเรท; PO detail จะไม่โชว์ข้อความ outstanding เมื่อยอดค้างถูก normalize เป็นศูนย์
- ปรับ card ใน workspace `Month-End Close` ให้แสดง `ยอดซื้อจริงตาม purchase currency` เพิ่ม (`สินค้า $... ≈ ₭...`) เพื่อให้ผู้ใช้เห็นว่าต้องปิดเรทให้ยอดต้นฉบับเท่าไร และถ้า outstanding เป็นศูนย์จะซ่อนบรรทัด outstanding ออก
- เพิ่ม guard ใน card `Month-End Close`: ถ้า queue item ยังไม่มียอดต้นฉบับ (`totalCostPurchase <= 0`) จะไม่แสดง `$0/฿0` หลอก แต่ fallback ไปแสดงยอดฐานร้านแทนชั่วคราว
- ปรับ `Month-End Close` เพิ่มเติมให้ดึง `shipping original currency` จาก queue/backend แล้ว และถ้า queue summary ยังขาดยอดต้นฉบับของบางใบ จะ fallback จาก `poList` ที่โหลดอยู่เพื่อเลี่ยงการ์ดแบบ `Products ₭0` ทั้งที่ PO จริงมีราคา/ค่าขนส่ง
- ปรับ compact layout ของ card `Month-End Close` อีกชั้น: `สินค้า ...` และ `ค่าขนส่ง ...` อยู่บรรทัดเดียวกันแบบคั่น `·` เพื่อประหยัดพื้นที่ แต่ `Outstanding` ยังคงแยกอีกบรรทัดเพื่อให้สถานะการเงินชัด
- เปลี่ยน bulk flow ของ `Month-End Close` จาก panel inline ใต้ toolbar ไปเป็น `SlideUpSheet` เดียวสำหรับ `Finalize rate + batch settle` แล้ว; ภายใน sheet ใช้ฟิลด์/preview/error เดิมทั้งหมด แต่ช่วยคง context ของคิว PO และไม่ดัน list ลงเมื่อเปิดฟอร์มปิดรอบ
- เพิ่ม preview ใน modal `Finalize exchange rate` ของ PO detail แล้ว: ผู้ใช้เห็น breakdown `สินค้า / ค่าขนส่ง / ค่าอื่น` พร้อม `ยอดรวมปัจจุบัน / ยอดรวมหลังปิดเรท / ส่วนต่าง` ก่อนยืนยัน โดยใช้สูตรเดียวกับ backend ฝั่ง `finalize-rate`
- ปรับ block เรทใน `PO detail` เป็นแบบ compact เพื่อลดพื้นที่บนมือถือ: แสดง `badge + 1 {currency} = {rate} {storeCurrency}` ในบรรทัดแรก และบรรทัด meta `เริ่มต้น / ปิดเมื่อ / Δ` พร้อม note เฉพาะเมื่อมี
- ปรับ field ใน `Month-End Close` bulk sheet:
  - ถอดบล็อก `ยอดที่จะลงชำระรอบนี้` ออกแล้ว เพื่อไม่ให้ซ้ำกับ preview summary ด้านล่าง
  - `เลขอ้างอิงการจ่าย` เปลี่ยนเป็น optional; ถ้าไม่กรอก ระบบยัง finalize rate + settle ได้ตามปกติ และจะไม่สร้าง note อ้างอิงปลอม
- ค่าที่แสดงใน `ยอดที่จะลงชำระรอบนี้` และ preview ราย PO จะอัปเดตตาม `rate` ที่พิมพ์อยู่แบบ real-time แล้ว โดยใช้ยอดต้นฉบับของ `สินค้า/ค่าขนส่ง/ค่าอื่น` ร่วมกับ `totalPaidBase` จาก queue แทนการยึด `outstandingBase` เก่าอย่างเดียว
- preview ราย PO ใน `Month-End Close` bulk sheet แยกโชว์ breakdown `สินค้า / ค่าขนส่ง / ค่าอื่น` ต่อใบแล้ว เพื่อช่วย debug เคสต่างสกุลเงิน เช่น `สินค้า USD + ขนส่ง LAK`; ผู้ใช้จะเห็นได้ทันทีว่า component ที่เป็น `store currency` ไม่ถูก re-rate
- ปรับ preview `Amount to settle this run` อีกชั้นให้ preload detail ของ PO ที่เลือก แล้วคำนวณด้วยสูตรระดับ item แบบเดียวกับ backend ตอน `finalize-rate` (แปลง `unitCostPurchase -> unitCostBase` ต่อ item ก่อนรวม) เพื่อลด mismatch จากการปัดเศษเมื่อเทียบกับสูตร aggregate เดิม
- ปรับ default currency ของ `Shipping cost` และ `Other cost` ให้คงเส้นคงวาเป็น `store currency`:
  - หน้า `Create PO` ใช้ store currency เป็นค่าเริ่มต้นเหมือนเดิม
  - modal `อัปเดตค่าขนส่ง/ค่าอื่น` ถ้าใบนี้ยังไม่มีค่าเดิม จะ default เป็น store currency แล้ว ไม่เด้งไปตาม purchase currency อัตโนมัติ
- panel `AP by Supplier` ตั้ง fetch ของ supplier summary/statement เป็น `cache: "no-store"` แล้ว และ API GET ที่เกี่ยวข้องส่ง `Cache-Control: no-store` เพื่อกันตัวเลขค้างจาก payload เก่า
- การ์ด PO row ใน `AP by Supplier` เปลี่ยนให้โชว์ `ยอดทั้งใบ` (`grandTotalBase`) เป็นตัวเลขหลัก ส่วน `จ่ายแล้ว / ค้าง` ย้ายไปบรรทัดรอง เพื่อให้แยกความหมายระหว่าง total กับ outstanding ชัดขึ้น
- แก้ `syncPurchaseLinkedCurrency(...)` เพิ่ม: ถ้า `Shipping/Other` ยังอยู่ที่ `store currency` จะคงค่าเดิมไว้เมื่อผู้ใช้สลับ `purchase currency` (เช่น LAK -> USD แล้วค่าขนส่งยังเป็น LAK); การตาม purchase currency จะเกิดเฉพาะเคสที่ผู้ใช้ตั้งให้ cost currency ตาม PO อยู่แล้ว
- ปรับ backend ให้ fallback currency ตรงกับ UI:
  - create PO route/service ไม่ default `shipping/other` ไปที่ `purchase currency` แล้ว แต่ใช้ `store currency`
  - apply-extra-cost route ก็ normalize แบบเดียวกัน
  - `applyPurchaseOrderExtraCostSchema` เลิก default hardcoded `LAK` แล้ว ให้ route เป็นคนเติม `store currency` แทน
- ปรับ query `AP by Supplier` ใน `lib/reports/queries.ts` ให้ fallback สำหรับ PO ต่างสกุลที่ `unitCostBase` ฝั่ง item เป็น `0` แต่ยังมียอดซื้อจริง:
  - derive `product base` จาก `totalCostPurchase × effectiveRate`
  - ใช้ `exchangeRate` ถ้า lock แล้ว ไม่งั้นใช้ `exchangeRateInitial`
  - แล้วค่อยรวม `shipping/other` เพื่อคำนวณ `grandTotalBase/outstandingBase`
  - ย้ายการกรอง `outstanding > 0` มาหลัง map/fallback แล้ว เพื่อไม่ให้ PO ที่ base raw เป็น 0 หลุดออกจาก AP statement ผิดพลาด
- ปรับ dataset ฝั่ง outstanding/AP ให้ derive `paymentStatus` ใหม่จาก `grandTotalBase` กับ `totalPaidBase` แทนการใช้ `purchase_orders.payment_status` ดิบ เพื่อกันเคส inconsistency เช่น API คืน `PAID` ทั้งที่ `totalPaidBase = 0` และ `outstandingBase > 0`
- ปรับ `server/services/purchase-ap.service.ts` ให้ workspace/API `AP by Supplier` ใช้ source จาก `listPurchaseOrders()` แทน `getOutstandingPurchaseRows()` แล้ว เพื่อให้ยอดรวม/ยอดค้างตรงกับ `PO Operations` และ PO detail ที่ผู้ใช้เห็นอยู่จริง ลดความเสี่ยงจาก query aggregate คนละเส้นทาง
- ย้ายฟอร์ม `Bulk settle` ของ `AP by Supplier` จาก inline panel ใต้ statement ไปเป็น `SlideUpSheet` ใน `components/app/purchase-ap-supplier-panel.tsx` แล้ว โดยยัง reuse state/preview/submit logic เดิมทั้งหมด แต่ไม่ดัน list ลงเมื่อเปิดฟอร์ม และคง context ของ statement ไว้เหมือน pattern ใน `Month-End Close`
- ปรับ `AP by Supplier` bulk settle sheet ให้ตัด field `statement total / Amount to settle this run` ออกแล้ว: ตอนนี้ sheet ใช้ preview summary เป็น source-of-truth และชำระเต็มยอดค้างของ PO ที่เลือกทั้งหมด (`outstandingBase`) โดยไม่รองรับ partial-allocation จากยอด statement ก้อนเดียวใน flow นี้อีก
- ปรับ date range ของ workspace `AP by Supplier` บนมือถือให้ `Due ຈາກ` และ `Due ຫາ` อยู่บรรทัดเดียวกันแล้ว เพื่อลดความสูงของ filter card
- custom date picker ของ `Due ຈາກ / Due ຫາ` ใน `AP by Supplier` จะขยายเต็มความกว้างของแถวบนมือถือแทนการกว้างเท่าช่อง input เดิม และตัด shortcut `+7 ມື້` ออก เหลือ `ມື້ນີ້ / ທ້າຍເດືອນ / ລ້າງ`
- mobile supplier selector ของ `AP by Supplier` เพิ่ม badge ข้าง label แล้ว เพื่อบอกจำนวน `supplier` และจำนวน `PO` รวมจาก summary ปัจจุบันก่อนผู้ใช้กดเปิด picker
- mobile filter layout ของ `AP by Supplier` ปรับเป็น `search เต็มบรรทัด`, `payment + due` แถวเดียว, และ `sort` แยกอีกบรรทัด โดยคง layout เดิมบน desktop (`xl`) ไว้
- stock section tabs หลักของหน้า `/stock` (`inventory / purchase / recording / history`) ใช้ sticky wrapper ใน `components/app/stock-tabs.tsx` แล้ว และเพิ่ม scroll restore ตอนสลับแท็บแบบ 2 โหมด:
  - ถ้า tab bar ยังไม่ sticky จะ restore `window.scrollX/Y` เดิมหลัง mount
  - ถ้า tab bar กำลัง sticky อยู่ จะ restore แบบ `keep_sticky` โดยคำนวณ scroll ใหม่จาก `tabBar.getBoundingClientRect().top` เทียบกับ `computed top` ของ sticky bar เพื่อให้หลังเปลี่ยนแท็บ bar ยังคง stuck ต่อ ไม่เด้งกลับไปช่วงที่แท็บยังไม่ sticky
- workspace tabs ภายในหน้า purchase (`components/app/purchase-order-list.tsx`) เพิ่ม stuck-state UI แล้ว: ตอนยังไม่ติด sticky คง `rounded card` เดิมไว้ แต่เมื่อชน offset `top-[3.8rem]` จะสลับเป็น full-width bar ทุก breakpoint โดยขยายตาม gutter ของหน้า (`-mx-4/md:-mx-6/min-[1200px]:-mx-8`) พร้อม `border-y px-* py-2 shadow-sm`; ใช้ `getBoundingClientRect().top` + `requestAnimationFrame` เพื่อตรวจสถานะ sticky
- workspace tabs ในหน้า purchase ถอดข้อความ `purchase.workspace.title` ออกจาก bar แล้ว เพื่อลดความสูงทั้งตอนปกติและตอน sticky
- ตอนสลับ workspace ภายในหน้า purchase เพิ่ม scroll restore 2 โหมดแล้ว:
  - ถ้า workspace bar ยังไม่ sticky จะ restore `window.scrollX/Y` เดิมหลัง workspace ใหม่พร้อม
  - ถ้า workspace bar กำลัง sticky อยู่ จะ restore แบบ `keep_sticky` โดยคำนวณ scroll ใหม่จาก `workspaceStickyBarRef.getBoundingClientRect().top` เทียบกับ `computed top` ของ sticky bar เพื่อให้หลังสลับ workspace bar ยังคง stuck ต่อ ไม่เด้งกลับลงไปช่วงที่ bar ยังไม่ sticky
- กรณี `SUPPLIER_AP` panel จะส่ง loading state (`supplier summary` + `statement`) กลับไปหา parent แล้ว เพื่อให้ `purchase-order-list` ชะลอ workspace scroll restore จนข้อมูลพร้อมจริง; ฝั่ง panel debounce ตอนปล่อย `loading=false` `120ms` เพื่อกัน false gap ระหว่าง fetch รายชื่อ supplier กับ statement
- แท็บ `สต็อก` ในหน้า `/stock` แยกแถว `search input + scan button` ออกเป็น sticky bar ใต้แถบด้านบน (`top-[7.4rem]`) แล้ว ส่วน `category/sort/summary` ยังอยู่ใน card ปกติด้านล่าง เพื่อลดการบังพื้นที่ list ขณะเลื่อน
- แถว `search input + scan button` ของแท็บ `สต็อก` มี stuck-state แล้ว: ตอนปกติไม่ใส่ background ซ้ำ และเมื่อ sticky จริงค่อยสลับเป็น `bg-white/95 + border-y + shadow`
- แท็บ `stock` ของหน้า `/stock` เพิ่ม result alignment ตอน search แล้ว: ถ้า search bar กำลัง sticky และหัวผลลัพธ์ถูกซ่อนเหนือ bar หลังกรองเสร็จ ระบบจะ `scrollBy` ขึ้นเพียงระยะสั้น ๆ ให้เห็นรายการแรก และเพิ่ม `min-height` ให้ result area ระหว่าง search เพื่อคง sticky context
- หน้า `/stock` ลบ page header title (`stock.page.title`) ออกแล้ว เหลือ tab bar เป็นองค์ประกอบบนสุดของหน้าเพื่อลดพื้นที่แนวตั้ง
- แท็บ `ສະຕັອກ / ບັນທຶກ / ປະຫວັດ` ในหน้า `/stock` ย้าย `title` เข้าไปอยู่เหนือบรรทัด `อัปเดตล่าสุด` ใน `StockTabToolbar` แล้ว และถอด subtitle ออกเพื่อ save area ให้ header ของแต่ละแท็บเตี้ยลง
- skeleton loading ของแท็บ `stock / recording / history` ในหน้า `/stock` เปลี่ยนเป็น layout skeleton ตามโครง UI จริงของแต่ละแท็บแล้ว, ตัดข้อความ loading ด้านล่างออก, และในเคส initial loading จะ `early return` เป็น skeleton ทั้งแท็บเลยเพื่อไม่ให้ title/toolbar จริงโผล่ค้างด้านบน
- dynamic `loadingFallback` ของหน้า `/stock` ใน `app/(app)/stock/page.tsx` ถูกเปลี่ยนจาก text card (`common.loading`) เป็น skeleton block แล้ว เพื่อตัดข้อความ `กำลังโหลดข้อมูล...` ระหว่างรอ dynamic import ของ tab content
- `app/(app)/products/loading.tsx` ถูกทำ i18n แล้ว: ใช้ `getRequestUiLocale()` + `DEFAULT_UI_LOCALE` และ render `tab.products` / `products.page.loadingManagement` แทนข้อความ hardcoded
- แท็บ `stock` ของหน้า `/stock` ปรับเฉพาะ UI ของ `category + sort` แล้ว: ยังคง native `select`/logic เดิม แต่เปลี่ยนเป็น pill-style controls แบบเดียวกับหน้า `/products` (icon ซ้าย, chevron ขวา, category active = blue tint)
- แท็บ `stock` ของหน้า `/stock` ใช้ pill-style `category + sort` แบบเดียวกับหน้า `/products` แต่คงขนาดใหญ่กว่าสำหรับงาน operation (`h-10`, `text-sm`, `category min-w-[10rem]`, `sort min-w-[9rem]`) เพื่อให้กดง่ายและอ่านสบายกว่าในหน้า stock
- แท็บ `stock` ของหน้า `/stock` ขยาย search ให้รองรับ `barcode` จริงแล้ว: placeholder/helper ระบุว่า search/scan ได้ด้วย barcode no., filter ฝั่ง client match `sku + name + barcode`, และเมื่อสแกน barcode ระบบจะใส่เลข barcode ลง search input โดยตรงแทน SKU; list cards ของสินค้าแสดง barcode แบบ mini text เมื่อมีค่า
- หน้า `/products` ปรับ redesign เฉพาะหน้าตา `category` และ `sort` แล้ว: คง native select เดิม แต่หุ้มให้เป็น pill-style buttons (icon ซ้าย + chevron ขวา) และใช้ขนาด `h-10 + text-sm` (`category min-w-[10rem]`, `sort min-w-[9rem]`)
- ช่องค้นหาในแท็บ `สต็อก` เอา `focus ring` ออกแล้ว และเหลือแค่ `focus:border-blue-300`
- ช่องค้นหาในหน้า `/products` เอา `focus ring` ออกแล้ว และเหลือแค่ `focus:border-blue-300` เพื่อให้ลุคเรียบขึ้นโดยยังคงมี focus affordance
- หน้า `/products` เปลี่ยนเป็น scroll-driven sticky เฉพาะแถว `search + scan (+ create desktop)` แล้ว; `category + sort + result count` ไม่ sticky และเลื่อนตาม content ปกติ
- flow search/filter ของหน้า `/products` ไม่ scroll กลับ top เองแล้ว; ตอนมี `query` และ search bar กำลัง stuck ระบบจะซ่อน summary strip, เพิ่ม `min-height` ให้ result area และถ้าหัวผลลัพธ์ถูกซ่อนเหนือ sticky bar หลังโหลดเสร็จ จะ `scrollBy` ขึ้นเพียงระยะสั้น ๆ เพื่อให้เห็นรายการแรกพอดี
- หน้า `/orders` ลบ subtitle ใต้ title ออกแล้ว และจัด header ใหม่ให้ title กับปุ่ม `ปิด COD` อยู่บรรทัดเดียวกันบนมือถือด้วย (`justify-between`, title `truncate`, ปุ่ม `shrink-0`) เพื่อลดความสูงส่วนบนของหน้า
- flow COD reconcile ใช้ label สั้นชุดเดียวกันแล้ว: CTA ใน `/orders` และ title/titleShort ของ `/orders/cod-reconcile` เปลี่ยนเป็น `ปิดยอด COD` / `ປິດຍອດ COD` / `Close COD`
- ช่องค้นหาในหน้า `/orders` เพิ่มไอคอน `Search` ไว้ใน input แล้ว โดยยังคงปุ่มสแกนสินค้าและพฤติกรรม submit/search เดิม
- ช่องค้นหาในหน้า `/orders` เพิ่มปุ่ม `X` เพื่อล้างคำค้นแล้ว; กดแล้วจะ clear input และ apply search ว่างทันที โดยไม่กระทบ search ของ create order
- ปุ่ม `เปิด/ເປີດ/Open` ใน list cards ของหน้า `/orders` ปรับเป็น `outline pill` พร้อมไอคอน `ExternalLink` แล้ว เพื่อให้ CTA ดูชัดขึ้นโดยไม่เปลี่ยน logic หรือ flow
- คอลัมน์ `ยอดรวม/ຍອດລວມ/Total` ในตาราง desktop ของ `/orders` ใช้ `whitespace-nowrap` แล้ว และเปลี่ยนการแสดง currency จาก code เป็น symbol (`₭/฿/$`) ผ่าน `currencySymbol(...)`
- ปุ่ม scan ของหน้า `/orders` ในโหมด manage/search เปลี่ยน icon เป็น `QrCode` แล้ว เพื่อสื่อว่า flow นี้รองรับการสแกน QR order; ปุ่ม scan ของ create order ยังใช้ `ScanLine` ตาม semantic การสแกนสินค้า
- `BarcodeScannerPanel` เพิ่ม prop `scanMode` แล้ว โดยหน้า `/orders` โหมด manage/search ส่ง `qr` เพื่อเปลี่ยน overlay เป็นกรอบสี่เหลี่ยมและ hint แบบ QR เท่านั้น; หน้าอื่นยังใช้โหมด barcode เดิมทั้งหมด
- หน้า order detail (`/orders/[orderId]`) เพิ่ม mini `QR ออเดอร์` กลับมาใน header แล้ว: วางด้านขวาใน header row เดียวกับ title/chips ทั้ง mobile และ desktop, ใช้ขนาด compact `80px`, กดเปิด viewer เต็มและดาวน์โหลด SVG ได้
- หน้า `/orders` list ซ่อนปุ่ม `หน้าแพ็ก` สำหรับออเดอร์ที่จบงานแล้ว (`SHIPPED`, `COD_RETURNED`, รวมทั้ง walk-in ที่ไม่ใช่ pickup states ตามเดิม) เพื่อให้ action ใน list เหลือเฉพาะงานถัดไปจริง
- คอลัมน์ `งานถัดไป/ວຽກຕໍ່ໄປ` ในหน้า `/orders` เปลี่ยนข้อความ fallback ของออเดอร์ที่ไม่มี quick action แล้วจากโทน `ไม่มีงานด่วน` เป็นข้อความจบงานตรง ๆ (`เสร็จแล้ว` / `ສຳເລັດແລ້ວ` / `Done`)
- modal `หน้าแพ็กออเดอร์` (`OrderPackContent`) ย้าย QR จาก body ด้านขวาไปเป็น mini card ที่มุม header แล้ว และปรับให้ขนาด SVG ตรงกับ container (`88px`) พร้อม `overflow-hidden`; container QR ใช้ `flex items-center justify-center` เพื่อให้ตัว QR อยู่กึ่งกลาง card จริง
- แท็บ `history` บนหน้า `/stock` ปรับเฉพาะ UI ของ dropdown `ประเภทการเคลื่อนไหว` แล้ว: คง native `select`/logic เดิม แต่เปลี่ยนเป็น pill-style trigger (`ListFilter` ซ้าย, `ChevronDown` ขวา, active = blue tint) ให้ visual scale ตรงกับปุ่ม filter หน้า stock/products
- `BarcodeScannerPanel` เพิ่ม one-shot guard แล้ว: ทุกทางเข้า result (`decodeFromStream()` และ manual submit/search) วิ่งผ่าน `emitResultOnce()` ที่ใช้ `resultHandledRef` กัน callback ซ้ำในรอบสแกนเดียว เพื่อลดเคสสแกน barcode/QR ครั้งเดียวแต่ handler ถูกยิงซ้ำจนเพิ่มสินค้า/ค้นหาซ้ำหลายครั้ง
- แท็บ `history` ของ `/stock` ถอด inner scroll ของรายการออกแล้ว: ไม่ใช้ `max-h/overflow-y-auto` และไม่ใช้ virtualization ที่ผูกกับ scroll container เดิมอีกต่อไป เพื่อให้หน้าใช้ page scroll เดียวและลด nested scroll UX
- initial data ของแท็บ `history` ใน `/stock` เปลี่ยนเป็น query หน้าแรกจริงของ history (`page=1`, `pageSize=10`, มี `total`) แทน recent 30 แล้ว เพื่อลดอาการ summary ตัวแรกแสดง `30/30` ก่อนค่อยเด้งเป็นค่าจริงหลัง fetch
