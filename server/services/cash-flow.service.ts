import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  cashFlowDirectionEnum,
  cashFlowEntries,
  cashFlowEntryTypeEnum,
  cashFlowSourceTypeEnum,
  financialAccounts,
  financialAccountTypeEnum,
  orderPaymentMethodEnum,
  storePaymentAccounts,
  storeCurrencyEnum,
} from "@/lib/db/schema";

export type CashFlowTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CashFlowExecutor = typeof db | CashFlowTx;

type CashFlowDirection = (typeof cashFlowDirectionEnum)[number];
type CashFlowEntryType = (typeof cashFlowEntryTypeEnum)[number];
type CashFlowSourceType = (typeof cashFlowSourceTypeEnum)[number];
type FinancialAccountType = (typeof financialAccountTypeEnum)[number];
type StoreCurrency = (typeof storeCurrencyEnum)[number];
type OrderPaymentMethod = (typeof orderPaymentMethodEnum)[number];
type FinancialAccountRow = typeof financialAccounts.$inferSelect;

const SYSTEM_ACCOUNT_LABELS: Record<
  Extract<FinancialAccountType, "CASH_DRAWER" | "COD_CLEARING">,
  string
> = {
  CASH_DRAWER: "Cash Drawer",
  COD_CLEARING: "COD Clearing",
};

const getExecutor = (tx?: CashFlowTx): CashFlowExecutor => tx ?? db;

const serializeMetadata = (metadata: Record<string, unknown> | undefined) =>
  JSON.stringify(metadata ?? {});

async function findCashFlowEntry(params: {
  storeId: string;
  sourceType: CashFlowSourceType;
  sourceId: string;
  entryType: CashFlowEntryType;
  tx?: CashFlowTx;
}) {
  const executor = getExecutor(params.tx);
  const [entry] = await executor
    .select()
    .from(cashFlowEntries)
    .where(
      and(
        eq(cashFlowEntries.storeId, params.storeId),
        eq(cashFlowEntries.sourceType, params.sourceType),
        eq(cashFlowEntries.sourceId, params.sourceId),
        eq(cashFlowEntries.entryType, params.entryType),
      ),
    )
    .limit(1);

  return entry ?? null;
}

export async function ensureSystemFinancialAccount(params: {
  storeId: string;
  accountType: Extract<FinancialAccountType, "CASH_DRAWER" | "COD_CLEARING">;
  tx?: CashFlowTx;
}): Promise<FinancialAccountRow> {
  const executor = getExecutor(params.tx);
  const [existing] = await executor
    .select()
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.storeId, params.storeId),
        eq(financialAccounts.accountType, params.accountType),
        eq(financialAccounts.isSystem, true),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  await executor
    .insert(financialAccounts)
    .values({
      storeId: params.storeId,
      displayName: SYSTEM_ACCOUNT_LABELS[params.accountType],
      accountType: params.accountType,
      isSystem: true,
      isActive: true,
    })
    .onConflictDoNothing();

  const [created] = await executor
    .select()
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.storeId, params.storeId),
        eq(financialAccounts.accountType, params.accountType),
        eq(financialAccounts.isSystem, true),
      ),
    )
    .limit(1);

  if (!created) {
    throw new Error(`SYSTEM_FINANCIAL_ACCOUNT_RESOLUTION_FAILED:${params.accountType}`);
  }

  return created;
}

export async function ensureMappedFinancialAccount(params: {
  storeId: string;
  paymentAccountId: string;
  tx?: CashFlowTx;
}): Promise<FinancialAccountRow | null> {
  const executor = getExecutor(params.tx);
  const [existing] = await executor
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.storePaymentAccountId, params.paymentAccountId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [paymentAccount] = await executor
    .select({
      id: storePaymentAccounts.id,
      displayName: storePaymentAccounts.displayName,
      accountType: storePaymentAccounts.accountType,
    })
    .from(storePaymentAccounts)
    .where(
      and(
        eq(storePaymentAccounts.id, params.paymentAccountId),
        eq(storePaymentAccounts.storeId, params.storeId),
      ),
    )
    .limit(1);

  if (!paymentAccount) {
    return null;
  }

  await executor
    .insert(financialAccounts)
    .values({
      storeId: params.storeId,
      displayName: paymentAccount.displayName,
      accountType: paymentAccount.accountType === "LAO_QR" ? "QR" : "BANK",
      storePaymentAccountId: paymentAccount.id,
      isSystem: false,
      isActive: true,
    })
    .onConflictDoNothing();

  const [created] = await executor
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.storePaymentAccountId, params.paymentAccountId))
    .limit(1);

  return created ?? null;
}

export async function resolveFinancialAccountForOrderPayment(params: {
  storeId: string;
  paymentMethod: OrderPaymentMethod;
  paymentAccountId?: string | null;
  tx?: CashFlowTx;
}): Promise<FinancialAccountRow | null> {
  if (params.paymentMethod === "CASH") {
    return ensureSystemFinancialAccount({
      storeId: params.storeId,
      accountType: "CASH_DRAWER",
      tx: params.tx,
    });
  }

  if (
    (params.paymentMethod === "LAO_QR" || params.paymentMethod === "BANK_TRANSFER") &&
    params.paymentAccountId
  ) {
    return ensureMappedFinancialAccount({
      storeId: params.storeId,
      paymentAccountId: params.paymentAccountId,
      tx: params.tx,
    });
  }

  return null;
}

export async function recordCashFlowEntry(params: {
  storeId: string;
  accountId?: string | null;
  direction: CashFlowDirection;
  entryType: CashFlowEntryType;
  sourceType: CashFlowSourceType;
  sourceId: string;
  amount: number;
  currency: StoreCurrency;
  occurredAt?: string | null;
  reference?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  tx?: CashFlowTx;
}) {
  const normalizedAmount = Math.max(0, Math.trunc(params.amount));
  if (normalizedAmount <= 0) {
    return null;
  }

  const executor = getExecutor(params.tx);

  await executor
    .insert(cashFlowEntries)
    .values({
      storeId: params.storeId,
      accountId: params.accountId ?? null,
      direction: params.direction,
      entryType: params.entryType,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      amount: normalizedAmount,
      currency: params.currency,
      reference: params.reference?.trim() || null,
      note: params.note?.trim() || null,
      metadata: serializeMetadata(params.metadata),
      occurredAt: params.occurredAt ?? new Date().toISOString(),
      createdBy: params.createdBy ?? null,
    })
    .onConflictDoNothing();

  return findCashFlowEntry({
    storeId: params.storeId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    entryType: params.entryType,
    tx: params.tx,
  });
}

export async function recordOrderPaymentCashFlow(params: {
  storeId: string;
  orderId: string;
  orderNo: string;
  paymentMethod: OrderPaymentMethod;
  paymentAccountId?: string | null;
  amount: number;
  currency: StoreCurrency;
  occurredAt?: string | null;
  createdBy?: string | null;
  isArCollection?: boolean;
  tx?: CashFlowTx;
}) {
  const account = await resolveFinancialAccountForOrderPayment({
    storeId: params.storeId,
    paymentMethod: params.paymentMethod,
    paymentAccountId: params.paymentAccountId,
    tx: params.tx,
  });

  const entryType: CashFlowEntryType = params.isArCollection
    ? "AR_COLLECTION_IN"
    : params.paymentMethod === "CASH"
      ? "SALE_CASH_IN"
      : params.paymentMethod === "BANK_TRANSFER"
        ? "SALE_BANK_IN"
        : "SALE_QR_IN";

  return recordCashFlowEntry({
    storeId: params.storeId,
    accountId: account?.id ?? null,
    direction: "IN",
    entryType,
    sourceType: "ORDER",
    sourceId: params.orderId,
    amount: params.amount,
    currency: params.currency,
    occurredAt: params.occurredAt,
    reference: params.orderNo,
    note: params.isArCollection
      ? `รับชำระหนี้จากออเดอร์ ${params.orderNo}`
      : `รับเงินจากออเดอร์ ${params.orderNo}`,
    metadata: {
      orderNo: params.orderNo,
      paymentMethod: params.paymentMethod,
      paymentAccountId: params.paymentAccountId ?? null,
    },
    createdBy: params.createdBy ?? null,
    tx: params.tx,
  });
}

export async function recordCodSettlementCashFlow(params: {
  storeId: string;
  orderId: string;
  orderNo: string;
  amount: number;
  currency: StoreCurrency;
  codFee?: number;
  occurredAt?: string | null;
  createdBy?: string | null;
  tx?: CashFlowTx;
}) {
  const account = await ensureSystemFinancialAccount({
    storeId: params.storeId,
    accountType: "COD_CLEARING",
    tx: params.tx,
  });

  return recordCashFlowEntry({
    storeId: params.storeId,
    accountId: account.id,
    direction: "IN",
    entryType: "COD_SETTLEMENT_IN",
    sourceType: "ORDER",
    sourceId: params.orderId,
    amount: params.amount,
    currency: params.currency,
    occurredAt: params.occurredAt,
    reference: params.orderNo,
    note: `รับเงิน COD จากออเดอร์ ${params.orderNo}`,
    metadata: {
      orderNo: params.orderNo,
      codFee: Math.max(0, Math.trunc(params.codFee ?? 0)),
    },
    createdBy: params.createdBy ?? null,
    tx: params.tx,
  });
}

export async function recordPurchaseOrderPaymentCashFlow(params: {
  storeId: string;
  paymentId: string;
  poNumber: string;
  amount: number;
  currency: StoreCurrency;
  occurredAt?: string | null;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  tx?: CashFlowTx;
}) {
  return recordCashFlowEntry({
    storeId: params.storeId,
    accountId: null,
    direction: "OUT",
    entryType: "PURCHASE_PAYMENT_OUT",
    sourceType: "PURCHASE_ORDER_PAYMENT",
    sourceId: params.paymentId,
    amount: params.amount,
    currency: params.currency,
    occurredAt: params.occurredAt,
    reference: params.reference ?? params.poNumber,
    note: params.note?.trim()
      ? `${params.note.trim()}`
      : `จ่ายชำระ PO ${params.poNumber} (ยังไม่ระบุบัญชีต้นทาง)`,
    metadata: {
      poNumber: params.poNumber,
      accountResolution: "UNASSIGNED",
    },
    createdBy: params.createdBy ?? null,
    tx: params.tx,
  });
}

export async function recordPurchaseOrderPaymentReversalCashFlow(params: {
  storeId: string;
  paymentId: string;
  poNumber: string;
  amount: number;
  currency: StoreCurrency;
  occurredAt?: string | null;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  tx?: CashFlowTx;
}) {
  return recordCashFlowEntry({
    storeId: params.storeId,
    accountId: null,
    direction: "IN",
    entryType: "PURCHASE_PAYMENT_REVERSAL_IN",
    sourceType: "PURCHASE_ORDER_PAYMENT",
    sourceId: params.paymentId,
    amount: params.amount,
    currency: params.currency,
    occurredAt: params.occurredAt,
    reference: params.reference ?? params.poNumber,
    note: params.note?.trim()
      ? `${params.note.trim()}`
      : `ย้อนรายการจ่าย PO ${params.poNumber} (ยังไม่ระบุบัญชีปลายทาง)`,
    metadata: {
      poNumber: params.poNumber,
      accountResolution: "UNASSIGNED",
    },
    createdBy: params.createdBy ?? null,
    tx: params.tx,
  });
}
