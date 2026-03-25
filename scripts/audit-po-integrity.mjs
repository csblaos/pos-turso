import { createClient } from "@libsql/client";

const databaseUrl =
  process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: databaseUrl,
  authToken: authToken ? authToken : undefined,
});

const args = process.argv.slice(2);
const storeIdArg =
  args.find((arg) => arg.startsWith("--storeId="))?.slice("--storeId=".length) ??
  process.env.STORE_ID ??
  null;
const jsonOutput = args.includes("--json");

function toNumber(value) {
  return Number(value ?? 0);
}

function recommendAction(status) {
  if (status === "DRAFT") return "EDIT_DRAFT";
  if (status === "ORDERED" || status === "SHIPPED") return "CANCEL_AND_RECREATE";
  if (status === "CANCELLED") return "ARCHIVE_OR_IGNORE";
  return "MANUAL_REPAIR_REQUIRED";
}

function buildIssueLabels(row) {
  const issues = [];
  if (toNumber(row.itemCount) <= 0) issues.push("NO_ITEMS");
  if (toNumber(row.zeroQtyItems) > 0) issues.push("ZERO_QTY_ITEMS");
  if (toNumber(row.zeroQtyBaseItems) > 0) issues.push("ZERO_BASE_QTY_ITEMS");
  if (toNumber(row.zeroPurchaseCostItems) > 0) issues.push("ZERO_PURCHASE_PRICE_ITEMS");
  if (toNumber(row.zeroBaseCostItems) > 0) issues.push("ZERO_BASE_COST_ITEMS");
  if (toNumber(row.totalCostBase) <= 0) issues.push("ZERO_TOTAL_COST_BASE");
  return issues;
}

function buildWhereClause() {
  return storeIdArg ? "where po.store_id = ?" : "";
}

function buildArgs() {
  return storeIdArg ? [storeIdArg] : [];
}

async function main() {
  const rows = await client.execute({
    sql: `
      select
        po.id,
        po.store_id as storeId,
        po.po_number as poNumber,
        po.status,
        po.purchase_currency as purchaseCurrency,
        po.created_at as createdAt,
        po.received_at as receivedAt,
        (
          select count(*)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
        ) as itemCount,
        (
          select coalesce(sum(poi.qty_ordered), 0)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
        ) as qtyOrderedTotal,
        (
          select coalesce(sum(poi.qty_base_ordered), 0)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
        ) as qtyBaseOrderedTotal,
        (
          select count(*)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
            and coalesce(poi.qty_ordered, 0) <= 0
        ) as zeroQtyItems,
        (
          select count(*)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
            and coalesce(poi.qty_base_ordered, 0) <= 0
        ) as zeroQtyBaseItems,
        (
          select count(*)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
            and coalesce(poi.unit_cost_purchase, 0) <= 0
        ) as zeroPurchaseCostItems,
        (
          select count(*)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
            and coalesce(poi.unit_cost_base, 0) <= 0
        ) as zeroBaseCostItems,
        (
          select coalesce(sum(poi.unit_cost_purchase * poi.qty_ordered), 0)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
        ) as totalCostPurchase,
        (
          select coalesce(sum(poi.unit_cost_base * poi.qty_base_ordered), 0)
          from purchase_order_items poi
          where poi.purchase_order_id = po.id
        ) as totalCostBase
      from purchase_orders po
      ${buildWhereClause()}
      order by po.created_at desc
    `,
    args: buildArgs(),
  });

  const suspicious = rows.rows
    .map((row) => {
      const issues = buildIssueLabels(row);
      return {
        id: String(row.id),
        storeId: String(row.storeId),
        poNumber: String(row.poNumber),
        status: String(row.status),
        purchaseCurrency: String(row.purchaseCurrency),
        createdAt: String(row.createdAt),
        receivedAt: row.receivedAt ? String(row.receivedAt) : null,
        itemCount: toNumber(row.itemCount),
        qtyOrderedTotal: toNumber(row.qtyOrderedTotal),
        qtyBaseOrderedTotal: toNumber(row.qtyBaseOrderedTotal),
        totalCostPurchase: toNumber(row.totalCostPurchase),
        totalCostBase: toNumber(row.totalCostBase),
        zeroQtyItems: toNumber(row.zeroQtyItems),
        zeroQtyBaseItems: toNumber(row.zeroQtyBaseItems),
        zeroPurchaseCostItems: toNumber(row.zeroPurchaseCostItems),
        zeroBaseCostItems: toNumber(row.zeroBaseCostItems),
        issues,
        recommendedAction: recommendAction(String(row.status)),
      };
    })
    .filter((row) => row.issues.length > 0);

  const summary = {
    databaseUrl,
    storeId: storeIdArg,
    totalPurchaseOrders: rows.rows.length,
    suspiciousPurchaseOrders: suspicious.length,
    draftEditable: suspicious.filter((row) => row.recommendedAction === "EDIT_DRAFT").length,
    cancelAndRecreate: suspicious.filter(
      (row) => row.recommendedAction === "CANCEL_AND_RECREATE",
    ).length,
    manualRepairRequired: suspicious.filter(
      (row) => row.recommendedAction === "MANUAL_REPAIR_REQUIRED",
    ).length,
  };

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          summary,
          purchaseOrders: suspicious,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.info("[po:audit:integrity] summary");
  console.table([summary]);

  if (suspicious.length === 0) {
    console.info("[po:audit:integrity] no suspicious purchase orders found");
    return;
  }

  console.info("[po:audit:integrity] suspicious purchase orders");
  console.table(
    suspicious.map((row) => ({
      poNumber: row.poNumber,
      status: row.status,
      items: row.itemCount,
      qty: row.qtyOrderedTotal,
      qtyBase: row.qtyBaseOrderedTotal,
      totalPurchase: row.totalCostPurchase,
      totalBase: row.totalCostBase,
      issues: row.issues.join(", "),
      action: row.recommendedAction,
    })),
  );

  console.info("[po:audit:integrity] action guide");
  console.info("- EDIT_DRAFT: เปิด PO แล้วแก้รายการ/ราคาใหม่ได้ตรง ๆ");
  console.info("- CANCEL_AND_RECREATE: แนะนำยกเลิกใบเดิมแล้วสร้างใหม่");
  console.info(
    "- MANUAL_REPAIR_REQUIRED: ใบรับของ/ปิดยอดแล้ว ต้องตรวจเอกสารจริงก่อน repair ย้อนหลัง",
  );
}

main().catch((error) => {
  console.error(
    `[po:audit:integrity] failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
