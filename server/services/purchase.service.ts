import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import type {
  ApplyPurchaseOrderExtraCostInput,
  CreatePurchaseOrderInput,
  FinalizePOExchangeRateInput,
  ReversePurchaseOrderPaymentInput,
  SettlePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  UpdatePOStatusInput,
} from "@/lib/purchases/validation";
import {
  getNextPoNumber,
  getLatestPurchaseOrderPaymentEntry,
  getPurchaseOrderPaymentById,
  getProductCostBase,
  getProductCurrentStock,
  hasPurchaseOrderPaymentReversal,
  getPurchaseOrderById,
  insertInventoryMovementsForPO,
  insertPurchaseOrder,
  insertPurchaseOrderItems,
  insertPurchaseOrderPayment,
  listPendingExchangeRateQueue,
  listPurchaseOrders,
  listPurchaseOrdersPaged,
  replacePurchaseOrderItems,
  updatePurchaseOrderItemCostFields,
  updateProductCostBase,
  updatePurchaseOrderFields,
  updatePurchaseOrderItemReceived,
  updatePurchaseOrderStatus,
} from "@/server/repositories/purchase.repo";
import type {
  PendingExchangeRateQueueItem,
  PurchaseRepoTx,
  PurchaseOrderListItem,
  PurchaseOrderView,
} from "@/server/repositories/purchase.repo";
import { db } from "@/lib/db/client";
import { auditEvents, productUnits, products, units } from "@/lib/db/schema";
import { parseStoreCurrency } from "@/lib/finance/store-financial";
import { buildAuditEventValues } from "@/server/services/audit.service";
import {
  recordPurchaseOrderPaymentCashFlow,
  recordPurchaseOrderPaymentReversalCashFlow,
} from "@/server/services/cash-flow.service";
import { markIdempotencySucceeded } from "@/server/services/idempotency.service";

export {
  type PendingExchangeRateQueueItem,
  type PurchaseOrderListItem,
  type PurchaseOrderView,
};

type PurchaseAuditContext = {
  actorName: string | null;
  actorRole: string | null;
  request?: Request;
};

type PurchaseIdempotencyContext = {
  recordId: string;
};

type PurchaseDraftItemInput = {
  productId: string;
  unitId: string;
  qtyOrdered: number;
  unitCostPurchase: number;
};

type PurchaseOrderItemSnapshot = {
  purchaseOrderId: string;
  productId: string;
  unitId: string;
  multiplierToBase: number;
  qtyOrdered: number;
  qtyReceived: number;
  qtyBaseOrdered: number;
  qtyBaseReceived: number;
  unitCostPurchase: number;
  unitCostBase: number;
  landedCostPerUnit: number;
};

export class PurchaseServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeIsoDateOrNull(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new PurchaseServiceError(400, "รูปแบบวันที่ไม่ถูกต้อง");
  }
  return date.toISOString();
}

function derivePoPaymentStatus(
  totalPaidBase: number,
  grandTotalBase: number,
): "UNPAID" | "PARTIAL" | "PAID" {
  const normalizedOutstanding = normalizePoOutstandingBase(totalPaidBase, grandTotalBase);
  if (totalPaidBase <= 0) {
    return "UNPAID";
  }
  if (normalizedOutstanding <= 0) {
    return "PAID";
  }
  return "PARTIAL";
}

const PURCHASE_OUTSTANDING_EPSILON_BASE = 5;

function normalizePoOutstandingBase(totalPaidBase: number, grandTotalBase: number): number {
  const rawOutstanding = grandTotalBase - totalPaidBase;
  if (rawOutstanding <= PURCHASE_OUTSTANDING_EPSILON_BASE) {
    return 0;
  }
  return rawOutstanding;
}

function assertSupportedExtraCostCurrency(params: {
  currency: string;
  purchaseCurrency: string;
  storeCurrency: string;
  label: string;
}): string {
  const { currency, purchaseCurrency, storeCurrency, label } = params;
  if (currency === storeCurrency || currency === purchaseCurrency) {
    return currency;
  }
  throw new PurchaseServiceError(
    400,
    `${label} ใช้ได้เฉพาะสกุลร้านหรือสกุลซื้อของ PO`,
  );
}

function resolvePurchaseExtraCost(params: {
  amount: number;
  currency: string;
  purchaseCurrency: string;
  storeCurrency: string;
  exchangeRate: number;
  label: string;
}) {
  const { amount, purchaseCurrency, storeCurrency, exchangeRate, label } = params;
  const normalizedAmount = Math.max(0, Math.round(amount));
  const currency = assertSupportedExtraCostCurrency({
    currency: params.currency,
    purchaseCurrency,
    storeCurrency,
    label,
  });

  if (normalizedAmount <= 0) {
    return {
      amountOriginal: 0,
      currency,
      amountBase: 0,
    };
  }

  if (currency === storeCurrency) {
    return {
      amountOriginal: normalizedAmount,
      currency,
      amountBase: normalizedAmount,
    };
  }

  return {
    amountOriginal: normalizedAmount,
    currency,
    amountBase: Math.round(normalizedAmount * Math.max(1, exchangeRate)),
  };
}

function resolveNextDraftExtraCostCurrency(params: {
  explicitCurrency: string | undefined;
  currentCurrency: string;
  previousPurchaseCurrency: string;
  nextPurchaseCurrency: string;
  storeCurrency: string;
  label: string;
}) {
  const {
    explicitCurrency,
    currentCurrency,
    previousPurchaseCurrency,
    nextPurchaseCurrency,
    storeCurrency,
    label,
  } = params;
  const nextCurrency =
    explicitCurrency ??
    (currentCurrency === previousPurchaseCurrency
      ? nextPurchaseCurrency
      : currentCurrency);

  return assertSupportedExtraCostCurrency({
    currency: nextCurrency,
    purchaseCurrency: nextPurchaseCurrency,
    storeCurrency,
    label,
  });
}

async function resolvePurchaseUnitCatalog(
  storeId: string,
  productIds: string[],
  tx: PurchaseRepoTx,
) {
  if (productIds.length === 0) {
    return new Map<
      string,
      {
        baseUnitId: string;
        units: Map<string, { multiplierToBase: number }>;
      }
    >();
  }

  const baseUnits = alias(units, "purchase_base_units");
  const [productRows, conversionRows] = await Promise.all([
    tx
      .select({
        productId: products.id,
        baseUnitId: products.baseUnitId,
      })
      .from(products)
      .innerJoin(baseUnits, eq(products.baseUnitId, baseUnits.id))
      .where(and(eq(products.storeId, storeId), inArray(products.id, productIds))),
    tx
      .select({
        productId: productUnits.productId,
        unitId: productUnits.unitId,
        multiplierToBase: productUnits.multiplierToBase,
      })
      .from(productUnits)
      .innerJoin(products, eq(productUnits.productId, products.id))
      .where(and(eq(products.storeId, storeId), inArray(products.id, productIds))),
  ]);

  const catalog = new Map<
    string,
    {
      baseUnitId: string;
      units: Map<string, { multiplierToBase: number }>;
    }
  >();

  for (const product of productRows) {
    catalog.set(product.productId, {
      baseUnitId: product.baseUnitId,
      units: new Map([[product.baseUnitId, { multiplierToBase: 1 }]]),
    });
  }

  for (const row of conversionRows) {
    const current = catalog.get(row.productId);
    if (!current) continue;
    current.units.set(row.unitId, {
      multiplierToBase: row.multiplierToBase,
    });
  }

  return catalog;
}

function applyLandedCostPerBaseUnit<T extends {
  unitCostBase: number;
  landedCostPerUnit: number;
}>(
  items: T[],
  totalExtraCost: number,
  getQtyBaseForCost: (item: T) => number,
) {
  if (totalExtraCost > 0) {
    const totalItemsCostBase = items.reduce(
      (sum, item) => sum + item.unitCostBase * getQtyBaseForCost(item),
      0,
    );

    for (const item of items) {
      const qtyBaseForCost = getQtyBaseForCost(item);
      const itemTotalCostBase = item.unitCostBase * qtyBaseForCost;
      const proportion =
        totalItemsCostBase > 0 ? itemTotalCostBase / totalItemsCostBase : 0;
      const allocatedExtra = Math.round(totalExtraCost * proportion);
      item.landedCostPerUnit =
        qtyBaseForCost > 0
          ? Math.round((itemTotalCostBase + allocatedExtra) / qtyBaseForCost)
          : 0;
    }
    return;
  }

  for (const item of items) {
    item.landedCostPerUnit = item.unitCostBase;
  }
}

async function buildPurchaseOrderItemSnapshots(params: {
  storeId: string;
  purchaseOrderId: string;
  items: PurchaseDraftItemInput[];
  exchangeRate: number;
  receiveImmediately: boolean;
  tx: PurchaseRepoTx;
}): Promise<PurchaseOrderItemSnapshot[]> {
  const { storeId, purchaseOrderId, items, exchangeRate, receiveImmediately, tx } = params;
  const productIds = [...new Set(items.map((item) => item.productId))];
  const unitCatalog = await resolvePurchaseUnitCatalog(storeId, productIds, tx);

  return items.map((item) => {
    const product = unitCatalog.get(item.productId);
    if (!product) {
      throw new PurchaseServiceError(400, "พบสินค้าที่ไม่อยู่ในร้านหรือไม่พร้อมใช้งาน");
    }

    const unit = product.units.get(item.unitId);
    if (!unit) {
      throw new PurchaseServiceError(400, "หน่วยซื้อที่เลือกไม่ถูกต้องสำหรับสินค้านี้");
    }

    const qtyBaseOrdered = item.qtyOrdered * unit.multiplierToBase;
    const qtyReceived = receiveImmediately ? item.qtyOrdered : 0;
    const qtyBaseReceived = receiveImmediately ? qtyBaseOrdered : 0;

    return {
      purchaseOrderId,
      productId: item.productId,
      unitId: item.unitId,
      multiplierToBase: unit.multiplierToBase,
      qtyOrdered: item.qtyOrdered,
      qtyReceived,
      qtyBaseOrdered,
      qtyBaseReceived,
      unitCostPurchase: item.unitCostPurchase,
      unitCostBase: Math.round(
        (item.unitCostPurchase * exchangeRate) / unit.multiplierToBase,
      ),
      landedCostPerUnit: 0,
    };
  });
}

/* ────────────────────────────────────────────────
 * List
 * ──────────────────────────────────────────────── */

export async function getPurchaseOrderList(storeId: string) {
  return listPurchaseOrders(storeId);
}

export async function getPurchaseOrderListPage(
  storeId: string,
  limit: number,
  offset: number,
) {
  return listPurchaseOrdersPaged(storeId, limit, offset);
}

export async function getPendingExchangeRateQueue(params: {
  storeId: string;
  storeCurrency: "LAK" | "THB" | "USD";
  supplierQuery?: string;
  receivedFrom?: string;
  receivedTo?: string;
  limit?: number;
}) {
  return listPendingExchangeRateQueue(params);
}

/* ────────────────────────────────────────────────
 * Detail
 * ──────────────────────────────────────────────── */

export async function getPurchaseOrderDetail(
  poId: string,
  storeId: string,
): Promise<PurchaseOrderView> {
  const po = await getPurchaseOrderById(poId, storeId);
  if (!po) {
    throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
  }
  return po;
}

/* ────────────────────────────────────────────────
 * Create
 * ──────────────────────────────────────────────── */

export async function createPurchaseOrder(params: {
  storeId: string;
  userId: string;
  storeCurrency: string;
  payload: CreatePurchaseOrderInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { storeId, userId, storeCurrency, payload, audit, idempotency } = params;
  const now = new Date().toISOString();

  const hasLockedRate =
    payload.purchaseCurrency === storeCurrency ||
    (payload.exchangeRate !== undefined && Number(payload.exchangeRate) > 0);

  const exchangeRate = payload.purchaseCurrency === storeCurrency
    ? 1
    : Math.round(payload.exchangeRate ?? 1);
  const dueDate = normalizeIsoDateOrNull(payload.dueDate);
  const shippingCostCurrency = payload.shippingCostCurrency ?? storeCurrency;
  const otherCostCurrency = payload.otherCostCurrency ?? storeCurrency;
  const shippingCost = resolvePurchaseExtraCost({
    amount: payload.shippingCost,
    currency: shippingCostCurrency,
    purchaseCurrency: payload.purchaseCurrency,
    storeCurrency,
    exchangeRate,
    label: "ค่าขนส่ง",
  });
  const otherCost = resolvePurchaseExtraCost({
    amount: payload.otherCost,
    currency: otherCostCurrency,
    purchaseCurrency: payload.purchaseCurrency,
    storeCurrency,
    exchangeRate,
    label: "ค่าใช้จ่ายอื่น",
  });

  const initialStatus = payload.receiveImmediately ? "RECEIVED" : "DRAFT";

  return db.transaction(async (tx) => {
    const poNumber = await getNextPoNumber(storeId, tx);
    const po = await insertPurchaseOrder(
      {
        storeId,
        poNumber,
        supplierName: payload.supplierName || null,
        supplierContact: payload.supplierContact || null,
        purchaseCurrency: payload.purchaseCurrency,
        exchangeRate: Math.round(exchangeRate),
        exchangeRateInitial: Math.round(exchangeRate),
        exchangeRateLockedAt: hasLockedRate ? now : null,
        exchangeRateLockedBy: hasLockedRate ? userId : null,
        exchangeRateLockNote: hasLockedRate
          ? payload.exchangeRateLockNote || null
          : null,
        paymentStatus: "UNPAID",
        paidAt: null,
        paidBy: null,
        paymentReference: null,
        paymentNote: null,
        shippingCostOriginal: shippingCost.amountOriginal,
        shippingCostCurrency: parseStoreCurrency(shippingCost.currency),
        shippingCost: shippingCost.amountBase,
        otherCostOriginal: otherCost.amountOriginal,
        otherCostCurrency: parseStoreCurrency(otherCost.currency),
        otherCost: otherCost.amountBase,
        otherCostNote: payload.otherCostNote || null,
        note: payload.note || null,
        expectedAt: payload.expectedAt || null,
        dueDate,
        status: initialStatus,
        orderedAt: payload.receiveImmediately ? now : null,
        receivedAt: payload.receiveImmediately ? now : null,
        createdBy: userId,
      },
      tx,
    );

    const items = await buildPurchaseOrderItemSnapshots({
      storeId,
      purchaseOrderId: po.id,
      items: payload.items,
      exchangeRate,
      receiveImmediately: payload.receiveImmediately,
      tx,
    });

    // Calculate landed cost per unit (proportional allocation of shipping + other)
    const totalExtraCost = shippingCost.amountBase + otherCost.amountBase;
    applyLandedCostPerBaseUnit(items, totalExtraCost, (item) => item.qtyBaseOrdered);

    await insertPurchaseOrderItems(items, tx);

    // If receiveImmediately, post stock movements + update cost
    if (payload.receiveImmediately) {
      await receiveStockAndUpdateCost(
        storeId,
        userId,
        po.id,
        po.poNumber,
        items,
        tx,
        audit,
      );
    }

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.create",
          entityType: "purchase_order",
          entityId: po.id,
          metadata: {
            poNumber: po.poNumber,
            status: po.status,
            receiveImmediately: payload.receiveImmediately,
            itemCount: payload.items.length,
          },
          request: audit.request,
        }),
      );
    }

    const createdPo = await getPurchaseOrderById(po.id, storeId, tx);
    if (!createdPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: createdPo,
        },
        tx,
      });
    }

    return createdPo;
  });
}

/* ────────────────────────────────────────────────
 * Update Status
 * ──────────────────────────────────────────────── */

export async function updatePurchaseOrderStatusFlow(params: {
  poId: string;
  storeId: string;
  userId: string;
  payload: UpdatePOStatusInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { poId, storeId, userId, payload, audit, idempotency } = params;

  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(poId, storeId, tx);

    if (!po) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["ORDERED", "RECEIVED", "CANCELLED"],
      ORDERED: ["SHIPPED", "RECEIVED", "CANCELLED"],
      SHIPPED: ["RECEIVED", "CANCELLED"],
      RECEIVED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[po.status] ?? [];
    if (!allowed.includes(payload.status)) {
      throw new PurchaseServiceError(
        400,
        `ไม่สามารถเปลี่ยนสถานะจาก "${po.status}" เป็น "${payload.status}" ได้`,
      );
    }

    const updates: Record<string, unknown> = {
      status: payload.status,
      updatedBy: userId,
      updatedAt: now,
    };

    if (payload.status === "ORDERED") {
      updates.orderedAt = now;
    } else if (payload.status === "SHIPPED") {
      updates.shippedAt = now;
      if (payload.trackingInfo) {
        updates.trackingInfo = payload.trackingInfo;
      }
    } else if (payload.status === "RECEIVED") {
      updates.receivedAt = now;

      // Update received quantities
      const receivedMap = new Map(
        (payload.receivedItems ?? []).map((ri) => [ri.itemId, ri.qtyReceived]),
      );

      // Recalculate landed cost based on actual received quantities
      const totalExtraCost = po.shippingCost + po.otherCost;
      const itemsToReceive = po.items.map((item) => {
        const qtyReceived = receivedMap.get(item.id) ?? item.qtyOrdered;
        if (qtyReceived > item.qtyOrdered) {
          throw new PurchaseServiceError(400, "จำนวนรับต้องไม่มากกว่าจำนวนที่สั่งซื้อ");
        }
        return {
          ...item,
          qtyReceived,
          qtyBaseReceived: qtyReceived * item.multiplierToBase,
        };
      });

      applyLandedCostPerBaseUnit(
        itemsToReceive,
        totalExtraCost,
        (item) => item.qtyBaseReceived,
      );

      for (const item of itemsToReceive) {
        const qtyReceived = item.qtyReceived;
        if (qtyReceived <= 0) {
          await updatePurchaseOrderItemReceived(item.id, 0, 0, 0, tx);
          continue;
        }

        await updatePurchaseOrderItemReceived(
          item.id,
          qtyReceived,
          item.qtyBaseReceived,
          item.landedCostPerUnit,
          tx,
        );
      }

      // Stock in + update weighted average cost
      const finalItems = itemsToReceive
        .filter((it) => it.qtyReceived > 0)
        .map((it) => {
          return {
            purchaseOrderId: poId,
            productId: it.productId,
            unitId: it.unitId,
            multiplierToBase: it.multiplierToBase,
            qtyOrdered: it.qtyOrdered,
            qtyReceived: it.qtyReceived,
            qtyBaseOrdered: it.qtyBaseOrdered,
            qtyBaseReceived: it.qtyBaseReceived,
            unitCostPurchase: it.unitCostPurchase,
            unitCostBase: it.unitCostBase,
            landedCostPerUnit: it.landedCostPerUnit,
          };
        });

      await receiveStockAndUpdateCost(
        storeId,
        userId,
        poId,
        po.poNumber,
        finalItems,
        tx,
        audit,
      );
    } else if (payload.status === "CANCELLED") {
      updates.cancelledAt = now;
    }

    await updatePurchaseOrderStatus(poId, updates, tx);

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.status.change",
          entityType: "purchase_order",
          entityId: poId,
          metadata: {
            poNumber: po.poNumber,
            status: payload.status,
          },
          request: audit.request,
        }),
      );
    }

    const updatedPo = await getPurchaseOrderById(poId, storeId, tx);
    if (!updatedPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: updatedPo,
        },
        tx,
      });
    }

    return updatedPo;
  });
}

export async function finalizePurchaseOrderExchangeRateFlow(params: {
  poId: string;
  storeId: string;
  userId: string;
  storeCurrency: string;
  payload: FinalizePOExchangeRateInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { poId, storeId, userId, storeCurrency, payload, audit, idempotency } = params;
  const now = new Date().toISOString();
  const nextRate = Math.round(payload.exchangeRate);

  return db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(poId, storeId, tx);
    if (!po) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }
    if (po.status !== "RECEIVED") {
      throw new PurchaseServiceError(400, "ปิดเรทได้เฉพาะ PO ที่รับสินค้าแล้ว");
    }
    if (po.purchaseCurrency === storeCurrency) {
      throw new PurchaseServiceError(400, "PO สกุลเงินเดียวกับร้านไม่ต้องปิดเรท");
    }
    if (po.exchangeRateLockedAt) {
      throw new PurchaseServiceError(400, "PO นี้ปิดเรทแล้ว");
    }
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      throw new PurchaseServiceError(400, "อัตราแลกเปลี่ยนต้องมากกว่า 0");
    }

    const shippingCost = resolvePurchaseExtraCost({
      amount: po.shippingCostOriginal,
      currency: po.shippingCostCurrency,
      purchaseCurrency: po.purchaseCurrency,
      storeCurrency,
      exchangeRate: nextRate,
      label: "ค่าขนส่ง",
    });
    const otherCost = resolvePurchaseExtraCost({
      amount: po.otherCostOriginal,
      currency: po.otherCostCurrency,
      purchaseCurrency: po.purchaseCurrency,
      storeCurrency,
      exchangeRate: nextRate,
      label: "ค่าใช้จ่ายอื่น",
    });
    const totalExtraCost = shippingCost.amountBase + otherCost.amountBase;
    const itemsWithBaseCost = po.items.map((item) => ({
      ...item,
      qtyForCalc: Math.max(item.qtyBaseReceived, 0),
      unitCostBase: Math.round(
        (item.unitCostPurchase * nextRate) / item.multiplierToBase,
      ),
    }));

    applyLandedCostPerBaseUnit(
      itemsWithBaseCost,
      totalExtraCost,
      (item) => item.qtyForCalc,
    );

    for (const item of itemsWithBaseCost) {
      if (item.qtyForCalc <= 0) {
        await updatePurchaseOrderItemCostFields(item.id, item.unitCostBase, 0, tx);
        continue;
      }
      await updatePurchaseOrderItemCostFields(
        item.id,
        item.unitCostBase,
        item.landedCostPerUnit,
        tx,
      );
    }

    await updatePurchaseOrderFields(
      poId,
      {
        exchangeRate: nextRate,
        exchangeRateLockedAt: now,
        exchangeRateLockedBy: userId,
        exchangeRateLockNote: payload.note || null,
        shippingCost: shippingCost.amountBase,
        otherCost: otherCost.amountBase,
        updatedBy: userId,
        updatedAt: now,
      },
      tx,
    );

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.exchange_rate.lock",
          entityType: "purchase_order",
          entityId: po.id,
          metadata: {
            poNumber: po.poNumber,
            previousRate: po.exchangeRate,
            nextRate,
            note: payload.note || null,
          },
          request: audit.request,
        }),
      );
    }

    const updatedPo = await getPurchaseOrderById(po.id, storeId, tx);
    if (!updatedPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: updatedPo,
        },
        tx,
      });
    }

    return updatedPo;
  });
}

export async function settlePurchaseOrderPaymentFlow(params: {
  poId: string;
  storeId: string;
  userId: string;
  storeCurrency: string;
  payload: SettlePurchaseOrderInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { poId, storeId, userId, storeCurrency, payload, audit, idempotency } = params;
  const now = new Date().toISOString();
  const paidAt = normalizeIsoDateOrNull(payload.paidAt) ?? now;
  const amountBase = Math.round(payload.amountBase);
  if (!Number.isFinite(amountBase) || amountBase <= 0) {
    throw new PurchaseServiceError(400, "ยอดชำระต้องมากกว่า 0");
  }

  return db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(poId, storeId, tx);
    if (!po) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }
    if (po.status !== "RECEIVED") {
      throw new PurchaseServiceError(400, "บันทึกชำระได้เฉพาะ PO ที่รับสินค้าแล้ว");
    }
    if (po.purchaseCurrency !== storeCurrency && !po.exchangeRateLockedAt) {
      throw new PurchaseServiceError(
        400,
        "PO ต่างสกุลเงินต้องปิดเรทก่อนบันทึกชำระ",
      );
    }
    const grandTotalBase = po.totalCostBase + po.shippingCost + po.otherCost;
    const outstandingBefore = normalizePoOutstandingBase(po.totalPaidBase, grandTotalBase);
    if (outstandingBefore <= 0) {
      throw new PurchaseServiceError(400, "PO นี้บันทึกชำระครบแล้ว");
    }
    if (amountBase > outstandingBefore) {
      throw new PurchaseServiceError(
        400,
        `ยอดชำระเกินยอดค้าง (ค้างอยู่ ${outstandingBefore.toLocaleString("th-TH")})`,
      );
    }

    const paymentEntry = await insertPurchaseOrderPayment(
      {
        purchaseOrderId: po.id,
        storeId,
        entryType: "PAYMENT",
        amountBase,
        paidAt,
        reference: payload.paymentReference?.trim() || null,
        note: payload.paymentNote?.trim() || null,
        createdBy: userId,
      },
      tx,
    );

    const nextTotalPaidBase = po.totalPaidBase + amountBase;
    const nextPaymentStatus = derivePoPaymentStatus(nextTotalPaidBase, grandTotalBase);

    await updatePurchaseOrderFields(
      po.id,
      {
        paymentStatus: nextPaymentStatus,
        paidAt,
        paidBy: userId,
        paymentReference: payload.paymentReference?.trim() || null,
        paymentNote: payload.paymentNote?.trim() || null,
        updatedBy: userId,
        updatedAt: now,
      },
      tx,
    );

    await recordPurchaseOrderPaymentCashFlow({
      storeId,
      paymentId: paymentEntry.id,
      poNumber: po.poNumber,
      amount: amountBase,
      currency: parseStoreCurrency(storeCurrency),
      occurredAt: paidAt,
      reference: payload.paymentReference?.trim() || null,
      note: payload.paymentNote?.trim() || null,
      createdBy: userId,
      tx,
    });

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.payment.settle",
          entityType: "purchase_order",
          entityId: po.id,
          metadata: {
            poNumber: po.poNumber,
            paidAt,
            amountBase,
            outstandingBefore,
            outstandingAfter: outstandingBefore - amountBase,
            paymentReference: payload.paymentReference?.trim() || null,
          },
          request: audit.request,
        }),
      );
    }

    const updatedPo = await getPurchaseOrderById(po.id, storeId, tx);
    if (!updatedPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: updatedPo,
        },
        tx,
      });
    }

    return updatedPo;
  });
}

export async function applyPurchaseOrderExtraCostFlow(params: {
  poId: string;
  storeId: string;
  userId: string;
  storeCurrency: string;
  payload: ApplyPurchaseOrderExtraCostInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { poId, storeId, userId, storeCurrency, payload, audit, idempotency } = params;
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(poId, storeId, tx);
    if (!po) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }
    if (po.status !== "RECEIVED") {
      throw new PurchaseServiceError(
        400,
        "อัปเดตค่าขนส่ง/ค่าอื่นได้เฉพาะ PO ที่รับสินค้าแล้ว",
      );
    }
    if (po.paymentStatus === "PAID") {
      throw new PurchaseServiceError(
        400,
        "PO ที่ชำระครบแล้วไม่สามารถแก้ค่าขนส่ง/ค่าอื่นได้",
      );
    }

    const shippingCostCurrency = payload.shippingCostCurrency ?? storeCurrency;
    const otherCostCurrency = payload.otherCostCurrency ?? storeCurrency;

    const shippingCost = resolvePurchaseExtraCost({
      amount: payload.shippingCost,
      currency: shippingCostCurrency,
      purchaseCurrency: po.purchaseCurrency,
      storeCurrency,
      exchangeRate: po.exchangeRate,
      label: "ค่าขนส่ง",
    });
    const otherCost = resolvePurchaseExtraCost({
      amount: payload.otherCost,
      currency: otherCostCurrency,
      purchaseCurrency: po.purchaseCurrency,
      storeCurrency,
      exchangeRate: po.exchangeRate,
      label: "ค่าใช้จ่ายอื่น",
    });
    const nextGrandTotalBase =
      po.totalCostBase + shippingCost.amountBase + otherCost.amountBase;
    if (nextGrandTotalBase < po.totalPaidBase) {
      throw new PurchaseServiceError(
        400,
        "ยอดรวมใหม่ต่ำกว่ายอดที่ชำระแล้ว กรุณาตรวจสอบค่าขนส่ง/ค่าอื่น",
      );
    }

    const totalExtraCost = shippingCost.amountBase + otherCost.amountBase;
    const itemsForCost = po.items.map((item) => ({
      ...item,
      qtyForCalc: Math.max(item.qtyBaseReceived, 0),
    }));

    applyLandedCostPerBaseUnit(
      itemsForCost,
      totalExtraCost,
      (item) => item.qtyForCalc,
    );

    for (const item of itemsForCost) {
      const qtyReceived = Math.max(item.qtyBaseReceived, 0);
      if (qtyReceived <= 0) {
        await updatePurchaseOrderItemCostFields(item.id, item.unitCostBase, 0, tx);
        continue;
      }

      await updatePurchaseOrderItemCostFields(
        item.id,
        item.unitCostBase,
        item.landedCostPerUnit,
        tx,
      );
    }

    const nextPaymentStatus = derivePoPaymentStatus(
      po.totalPaidBase,
      nextGrandTotalBase,
    );

    await updatePurchaseOrderFields(
      po.id,
      {
        shippingCostOriginal: shippingCost.amountOriginal,
        shippingCostCurrency: parseStoreCurrency(shippingCost.currency),
        shippingCost: shippingCost.amountBase,
        otherCostOriginal: otherCost.amountOriginal,
        otherCostCurrency: parseStoreCurrency(otherCost.currency),
        otherCost: otherCost.amountBase,
        otherCostNote: payload.otherCostNote?.trim() || null,
        paymentStatus: nextPaymentStatus,
        updatedBy: userId,
        updatedAt: now,
      },
      tx,
    );

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.extra_cost.apply",
          entityType: "purchase_order",
          entityId: po.id,
          metadata: {
            poNumber: po.poNumber,
            previousShippingCost: po.shippingCost,
            previousShippingCostOriginal: po.shippingCostOriginal,
            previousShippingCostCurrency: po.shippingCostCurrency,
            previousOtherCost: po.otherCost,
            previousOtherCostOriginal: po.otherCostOriginal,
            previousOtherCostCurrency: po.otherCostCurrency,
            previousOtherCostNote: po.otherCostNote,
            shippingCost: shippingCost.amountBase,
            shippingCostOriginal: shippingCost.amountOriginal,
            shippingCostCurrency: shippingCost.currency,
            otherCost: otherCost.amountBase,
            otherCostOriginal: otherCost.amountOriginal,
            otherCostCurrency: otherCost.currency,
            otherCostNote: payload.otherCostNote?.trim() || null,
            totalPaidBase: po.totalPaidBase,
            nextGrandTotalBase,
          },
          request: audit.request,
        }),
      );
    }

    const updatedPo = await getPurchaseOrderById(po.id, storeId, tx);
    if (!updatedPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: updatedPo,
        },
        tx,
      });
    }

    return updatedPo;
  });
}

export async function reversePurchaseOrderPaymentFlow(params: {
  poId: string;
  paymentId: string;
  storeId: string;
  userId: string;
  storeCurrency: string;
  payload: ReversePurchaseOrderPaymentInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { poId, paymentId, storeId, userId, storeCurrency, payload, audit, idempotency } =
    params;
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(poId, storeId, tx);
    if (!po) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }
    if (po.status !== "RECEIVED") {
      throw new PurchaseServiceError(400, "ย้อนรายการชำระได้เฉพาะ PO ที่รับสินค้าแล้ว");
    }

    const targetPayment = await getPurchaseOrderPaymentById(paymentId, tx);
    if (!targetPayment || targetPayment.purchaseOrderId !== po.id) {
      throw new PurchaseServiceError(404, "ไม่พบรายการชำระที่ต้องการย้อน");
    }
    if (targetPayment.entryType !== "PAYMENT") {
      throw new PurchaseServiceError(400, "ย้อนรายการได้เฉพาะรายการชำระปกติ");
    }
    const hasReversed = await hasPurchaseOrderPaymentReversal(targetPayment.id, tx);
    if (hasReversed) {
      throw new PurchaseServiceError(400, "รายการชำระนี้ถูกย้อนแล้ว");
    }
    if (targetPayment.amountBase > po.totalPaidBase) {
      throw new PurchaseServiceError(400, "ยอดชำระสะสมไม่พอสำหรับการย้อนรายการ");
    }

    const reversalEntry = await insertPurchaseOrderPayment(
      {
        purchaseOrderId: po.id,
        storeId,
        entryType: "REVERSAL",
        amountBase: targetPayment.amountBase,
        paidAt: now,
        reference: targetPayment.reference,
        note: payload.note?.trim() || `ย้อนรายการชำระ ${targetPayment.id}`,
        reversedPaymentId: targetPayment.id,
        createdBy: userId,
      },
      tx,
    );

    const grandTotalBase = po.totalCostBase + po.shippingCost + po.otherCost;
    const nextTotalPaidBase = po.totalPaidBase - targetPayment.amountBase;
    const normalizedTotalPaidBase = Math.max(0, nextTotalPaidBase);
    const nextPaymentStatus = derivePoPaymentStatus(
      normalizedTotalPaidBase,
      grandTotalBase,
    );
    const latestEntry = await getLatestPurchaseOrderPaymentEntry(po.id, tx);

    await updatePurchaseOrderFields(
      po.id,
      {
        paymentStatus: nextPaymentStatus,
        paidAt: normalizedTotalPaidBase > 0 ? latestEntry?.paidAt ?? now : null,
        paidBy: normalizedTotalPaidBase > 0 ? latestEntry?.createdBy ?? userId : null,
        paymentReference: normalizedTotalPaidBase > 0 ? latestEntry?.reference ?? null : null,
        paymentNote: payload.note?.trim() || null,
        updatedBy: userId,
        updatedAt: now,
      },
      tx,
    );

    await recordPurchaseOrderPaymentReversalCashFlow({
      storeId,
      paymentId: reversalEntry.id,
      poNumber: po.poNumber,
      amount: targetPayment.amountBase,
      currency: parseStoreCurrency(storeCurrency),
      occurredAt: now,
      reference: targetPayment.reference ?? null,
      note: payload.note?.trim() || null,
      createdBy: userId,
      tx,
    });

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.payment.reverse",
          entityType: "purchase_order",
          entityId: po.id,
          metadata: {
            poNumber: po.poNumber,
            reversedPaymentId: targetPayment.id,
            reversedAmountBase: targetPayment.amountBase,
            note: payload.note?.trim() || null,
          },
          request: audit.request,
        }),
      );
    }

    const updatedPo = await getPurchaseOrderById(po.id, storeId, tx);
    if (!updatedPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: updatedPo,
        },
        tx,
      });
    }

    return updatedPo;
  });
}

export async function updatePurchaseOrderFlow(params: {
  poId: string;
  storeId: string;
  userId: string;
  storeCurrency: string;
  payload: UpdatePurchaseOrderInput;
  audit?: PurchaseAuditContext;
  idempotency?: PurchaseIdempotencyContext;
}): Promise<PurchaseOrderView> {
  const { poId, storeId, userId, storeCurrency, payload, audit, idempotency } = params;
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(poId, storeId, tx);

    if (!po) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (po.status === "RECEIVED" || po.status === "CANCELLED") {
      throw new PurchaseServiceError(
        400,
        "PO ที่รับสินค้าแล้วหรือยกเลิกแล้ว ไม่สามารถแก้ไขได้",
      );
    }

    const isDraft = po.status === "DRAFT";
    const restrictedKeys = [
      "supplierName",
      "supplierContact",
      "purchaseCurrency",
      "exchangeRate",
      "shippingCost",
      "shippingCostCurrency",
      "otherCost",
      "otherCostCurrency",
      "otherCostNote",
      "items",
    ] as const;

    if (!isDraft) {
      const hasRestrictedChange = restrictedKeys.some(
        (key) => payload[key] !== undefined,
      );
      if (hasRestrictedChange) {
        throw new PurchaseServiceError(
          400,
          "สถานะนี้แก้ได้เฉพาะหมายเหตุ วันที่คาดรับ และข้อมูล Tracking",
        );
      }
    }

    const updates: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: now,
    };

    if (payload.note !== undefined) updates.note = payload.note || null;
    if (payload.expectedAt !== undefined) {
      updates.expectedAt = payload.expectedAt || null;
    }
    if (payload.dueDate !== undefined) {
      updates.dueDate = normalizeIsoDateOrNull(payload.dueDate);
    }
    if (payload.trackingInfo !== undefined) {
      updates.trackingInfo = payload.trackingInfo || null;
    }

    if (isDraft) {
      if (payload.supplierName !== undefined) {
        updates.supplierName = payload.supplierName || null;
      }
      if (payload.supplierContact !== undefined) {
        updates.supplierContact = payload.supplierContact || null;
      }
      if (payload.otherCostNote !== undefined) {
        updates.otherCostNote = payload.otherCostNote || null;
      }

      const nextCurrency = payload.purchaseCurrency ?? po.purchaseCurrency;
      const currencyChanged =
        payload.purchaseCurrency !== undefined &&
        payload.purchaseCurrency !== po.purchaseCurrency;
      const nextRate =
        nextCurrency === storeCurrency
          ? 1
          : payload.exchangeRate !== undefined
            ? Math.round(payload.exchangeRate)
            : currencyChanged
              ? 1
              : Math.round(po.exchangeRate);

      if (payload.purchaseCurrency !== undefined || payload.exchangeRate !== undefined) {
        updates.purchaseCurrency = nextCurrency;
        updates.exchangeRate = nextRate;
        updates.exchangeRateInitial = nextRate;
        if (nextCurrency === storeCurrency) {
          updates.exchangeRateLockedAt = now;
          updates.exchangeRateLockedBy = userId;
          updates.exchangeRateLockNote = null;
        } else if (payload.exchangeRate !== undefined) {
          updates.exchangeRateLockedAt = now;
          updates.exchangeRateLockedBy = userId;
          updates.exchangeRateLockNote = null;
        } else if (payload.purchaseCurrency !== undefined) {
          updates.exchangeRateLockedAt = null;
          updates.exchangeRateLockedBy = null;
          updates.exchangeRateLockNote = null;
        }
      }

      const costAffectingChanged =
        payload.items !== undefined ||
        payload.purchaseCurrency !== undefined ||
        payload.exchangeRate !== undefined ||
        payload.shippingCost !== undefined ||
        payload.shippingCostCurrency !== undefined ||
        payload.otherCost !== undefined ||
        payload.otherCostCurrency !== undefined;

      if (costAffectingChanged) {
        const sourceItems =
          payload.items ??
          po.items.map((item) => ({
            productId: item.productId,
            unitId: item.unitId,
            qtyOrdered: item.qtyOrdered,
            unitCostPurchase: item.unitCostPurchase,
          }));

        const nextShippingCostCurrency = resolveNextDraftExtraCostCurrency({
          explicitCurrency: payload.shippingCostCurrency,
          currentCurrency: po.shippingCostCurrency,
          previousPurchaseCurrency: po.purchaseCurrency,
          nextPurchaseCurrency: nextCurrency,
          storeCurrency,
          label: "ค่าขนส่ง",
        });
        const nextOtherCostCurrency = resolveNextDraftExtraCostCurrency({
          explicitCurrency: payload.otherCostCurrency,
          currentCurrency: po.otherCostCurrency,
          previousPurchaseCurrency: po.purchaseCurrency,
          nextPurchaseCurrency: nextCurrency,
          storeCurrency,
          label: "ค่าใช้จ่ายอื่น",
        });
        const shippingCost = resolvePurchaseExtraCost({
          amount: payload.shippingCost ?? po.shippingCostOriginal,
          currency: nextShippingCostCurrency,
          purchaseCurrency: nextCurrency,
          storeCurrency,
          exchangeRate: nextRate,
          label: "ค่าขนส่ง",
        });
        const otherCost = resolvePurchaseExtraCost({
          amount: payload.otherCost ?? po.otherCostOriginal,
          currency: nextOtherCostCurrency,
          purchaseCurrency: nextCurrency,
          storeCurrency,
          exchangeRate: nextRate,
          label: "ค่าใช้จ่ายอื่น",
        });
        const totalExtraCost = shippingCost.amountBase + otherCost.amountBase;

        updates.shippingCostOriginal = shippingCost.amountOriginal;
        updates.shippingCostCurrency = parseStoreCurrency(nextShippingCostCurrency);
        updates.shippingCost = shippingCost.amountBase;
        updates.otherCostOriginal = otherCost.amountOriginal;
        updates.otherCostCurrency = parseStoreCurrency(nextOtherCostCurrency);
        updates.otherCost = otherCost.amountBase;

        const items = await buildPurchaseOrderItemSnapshots({
          storeId,
          purchaseOrderId: po.id,
          items: sourceItems,
          exchangeRate: nextRate,
          receiveImmediately: false,
          tx,
        });

        applyLandedCostPerBaseUnit(items, totalExtraCost, (item) => item.qtyBaseOrdered);

        await replacePurchaseOrderItems(po.id, items, tx);
      }
    }

    await updatePurchaseOrderFields(po.id, updates, tx);

    if (audit) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit.actorName,
          actorRole: audit.actorRole,
          action: "po.update",
          entityType: "purchase_order",
          entityId: po.id,
          metadata: {
            poNumber: po.poNumber,
            updatedFields: Object.keys(payload),
          },
          request: audit.request,
        }),
      );
    }

    const updatedPo = await getPurchaseOrderById(po.id, storeId, tx);
    if (!updatedPo) {
      throw new PurchaseServiceError(404, "ไม่พบใบสั่งซื้อ");
    }

    if (idempotency) {
      await markIdempotencySucceeded({
        recordId: idempotency.recordId,
        statusCode: 200,
        body: {
          ok: true,
          purchaseOrder: updatedPo,
        },
        tx,
      });
    }

    return updatedPo;
  });
}

/* ────────────────────────────────────────────────
 * Internal: receive stock + weighted average cost
 * ──────────────────────────────────────────────── */

async function receiveStockAndUpdateCost(
  storeId: string,
  userId: string,
  poId: string,
  poNumber: string,
  items: {
    productId: string;
    qtyReceived?: number;
    qtyOrdered: number;
    qtyBaseReceived?: number;
    qtyBaseOrdered: number;
    landedCostPerUnit: number;
  }[],
  tx: PurchaseRepoTx,
  audit?: PurchaseAuditContext,
) {
  const movements = items.map((item) => ({
    storeId,
    productId: item.productId,
    type: "IN" as const,
    qtyBase: item.qtyBaseReceived ?? item.qtyBaseOrdered,
    refType: "PURCHASE" as const,
    refId: poId,
    note: `รับสินค้าจากใบสั่งซื้อ`,
    createdBy: userId,
  }));

  await insertInventoryMovementsForPO(movements, tx);

  // Update weighted average cost for each product
  for (const item of items) {
    const qtyReceivedBase = item.qtyBaseReceived ?? item.qtyBaseOrdered;
    if (qtyReceivedBase <= 0) continue;

    const currentOnHand = await getProductCurrentStock(storeId, item.productId, tx);
    const currentCostBase = await getProductCostBase(item.productId, tx);

    // Stock BEFORE this receipt (subtract just-added qty)
    const previousOnHand = currentOnHand - qtyReceivedBase;
    const previousTotalCost = previousOnHand * currentCostBase;
    const newTotalCost = qtyReceivedBase * item.landedCostPerUnit;

    let newCostBase: number;
    if (previousOnHand <= 0) {
      // First stock or was empty — use new landed cost directly
      newCostBase = item.landedCostPerUnit;
    } else {
      // Weighted average
      newCostBase = Math.round(
        (previousTotalCost + newTotalCost) / (previousOnHand + qtyReceivedBase),
      );
    }

    await updateProductCostBase(item.productId, newCostBase, tx);

    if (newCostBase !== currentCostBase) {
      await tx.insert(auditEvents).values(
        buildAuditEventValues({
          scope: "STORE",
          storeId,
          actorUserId: userId,
          actorName: audit?.actorName ?? null,
          actorRole: audit?.actorRole ?? null,
          action: "product.cost.auto_from_po",
          entityType: "product",
          entityId: item.productId,
          metadata: {
            source: "PURCHASE_ORDER",
            poId,
            poNumber,
            qtyReceivedBase,
            landedCostPerUnit: item.landedCostPerUnit,
            previousOnHand,
            previousCostBase: currentCostBase,
            nextCostBase: newCostBase,
            note: `รับสินค้าเข้า ${poNumber}`,
          },
          before: {
            costBase: currentCostBase,
          },
          after: {
            costBase: newCostBase,
          },
          request: audit?.request,
        }),
      );
    }
  }
}
