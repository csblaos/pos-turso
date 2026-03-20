import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { cashFlowEntries, financialAccounts, stores } from "@/lib/db/schema";
import type { CashFlowFilterState } from "@/lib/finance/cash-flow-filters";

export type CashFlowSummary = {
  totalIn: number;
  totalOut: number;
  net: number;
  entryCount: number;
  unassignedAmount: number;
  unassignedCount: number;
};

export type CashFlowTrendPoint = {
  bucketDate: string;
  totalIn: number;
  totalOut: number;
  net: number;
};

export type CashFlowAccountRow = {
  accountId: string | null;
  accountName: string | null;
  accountType: string | null;
  totalIn: number;
  totalOut: number;
  net: number;
  entryCount: number;
};

export type CashFlowLedgerRow = {
  id: string;
  accountId: string | null;
  accountName: string | null;
  accountType: string | null;
  direction: "IN" | "OUT";
  entryType: string;
  sourceType: string;
  sourceId: string;
  amount: number;
  currency: "LAK" | "THB" | "USD";
  reference: string | null;
  note: string | null;
  occurredAt: string;
};

export type CashFlowFilterOption = {
  value: string;
  label: string;
  type: string | null;
};

export type CashFlowViewData = {
  storeCurrency: "LAK" | "THB" | "USD";
  filters: CashFlowFilterState;
  summary: CashFlowSummary;
  trend: CashFlowTrendPoint[];
  accounts: CashFlowAccountRow[];
  ledger: CashFlowLedgerRow[];
  accountOptions: CashFlowFilterOption[];
};

function buildWhereClauses(storeId: string, filters: CashFlowFilterState) {
  const clauses = [
    eq(cashFlowEntries.storeId, storeId),
    sql`date(${cashFlowEntries.occurredAt}, 'localtime') >= ${filters.dateFrom}`,
    sql`date(${cashFlowEntries.occurredAt}, 'localtime') <= ${filters.dateTo}`,
  ];

  if (filters.direction !== "ALL") {
    clauses.push(eq(cashFlowEntries.direction, filters.direction));
  }

  if (filters.entryType !== "ALL") {
    clauses.push(eq(cashFlowEntries.entryType, filters.entryType));
  }

  if (filters.account === "UNASSIGNED") {
    clauses.push(isNull(cashFlowEntries.accountId));
  } else if (filters.account !== "ALL") {
    clauses.push(eq(cashFlowEntries.accountId, filters.account));
  }

  return clauses;
}

export async function getCashFlowViewData(params: {
  storeId: string;
  filters: CashFlowFilterState;
}): Promise<CashFlowViewData> {
  const whereClauses = buildWhereClauses(params.storeId, params.filters);

  const [storeRow, summaryRows, trendRows, accountRows, ledgerRows, accountOptionsRows] =
    await Promise.all([
      db
        .select({ currency: stores.currency })
        .from(stores)
        .where(eq(stores.id, params.storeId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          totalIn: sql<number>`coalesce(sum(case when ${cashFlowEntries.direction} = 'IN' then ${cashFlowEntries.amount} else 0 end), 0)`,
          totalOut: sql<number>`coalesce(sum(case when ${cashFlowEntries.direction} = 'OUT' then ${cashFlowEntries.amount} else 0 end), 0)`,
          entryCount: sql<number>`count(*)`,
          unassignedAmount: sql<number>`coalesce(sum(case when ${cashFlowEntries.accountId} is null then ${cashFlowEntries.amount} else 0 end), 0)`,
          unassignedCount: sql<number>`coalesce(sum(case when ${cashFlowEntries.accountId} is null then 1 else 0 end), 0)`,
        })
        .from(cashFlowEntries)
        .where(and(...whereClauses)),
      db
        .select({
          bucketDate: sql<string>`date(${cashFlowEntries.occurredAt}, 'localtime')`,
          totalIn: sql<number>`coalesce(sum(case when ${cashFlowEntries.direction} = 'IN' then ${cashFlowEntries.amount} else 0 end), 0)`,
          totalOut: sql<number>`coalesce(sum(case when ${cashFlowEntries.direction} = 'OUT' then ${cashFlowEntries.amount} else 0 end), 0)`,
        })
        .from(cashFlowEntries)
        .where(and(...whereClauses))
        .groupBy(sql`date(${cashFlowEntries.occurredAt}, 'localtime')`)
        .orderBy(sql`date(${cashFlowEntries.occurredAt}, 'localtime') asc`),
      db
        .select({
          accountId: cashFlowEntries.accountId,
          accountName: financialAccounts.displayName,
          accountType: financialAccounts.accountType,
          totalIn: sql<number>`coalesce(sum(case when ${cashFlowEntries.direction} = 'IN' then ${cashFlowEntries.amount} else 0 end), 0)`,
          totalOut: sql<number>`coalesce(sum(case when ${cashFlowEntries.direction} = 'OUT' then ${cashFlowEntries.amount} else 0 end), 0)`,
          entryCount: sql<number>`count(*)`,
        })
        .from(cashFlowEntries)
        .leftJoin(financialAccounts, eq(cashFlowEntries.accountId, financialAccounts.id))
        .where(and(...whereClauses))
        .groupBy(cashFlowEntries.accountId, financialAccounts.displayName, financialAccounts.accountType)
        .orderBy(desc(sql`count(*)`), asc(financialAccounts.displayName)),
      db
        .select({
          id: cashFlowEntries.id,
          accountId: cashFlowEntries.accountId,
          accountName: financialAccounts.displayName,
          accountType: financialAccounts.accountType,
          direction: cashFlowEntries.direction,
          entryType: cashFlowEntries.entryType,
          sourceType: cashFlowEntries.sourceType,
          sourceId: cashFlowEntries.sourceId,
          amount: cashFlowEntries.amount,
          currency: cashFlowEntries.currency,
          reference: cashFlowEntries.reference,
          note: cashFlowEntries.note,
          occurredAt: cashFlowEntries.occurredAt,
        })
        .from(cashFlowEntries)
        .leftJoin(financialAccounts, eq(cashFlowEntries.accountId, financialAccounts.id))
        .where(and(...whereClauses))
        .orderBy(desc(cashFlowEntries.occurredAt), desc(cashFlowEntries.createdAt))
        .limit(60),
      db
        .select({
          value: financialAccounts.id,
          label: financialAccounts.displayName,
          type: financialAccounts.accountType,
        })
        .from(financialAccounts)
        .where(and(eq(financialAccounts.storeId, params.storeId), eq(financialAccounts.isActive, true)))
        .orderBy(asc(financialAccounts.accountType), asc(financialAccounts.displayName)),
    ]);

  const summaryRow = summaryRows[0] ?? {
    totalIn: 0,
    totalOut: 0,
    entryCount: 0,
    unassignedAmount: 0,
    unassignedCount: 0,
  };

  return {
    storeCurrency: (storeRow?.currency ?? "LAK") as "LAK" | "THB" | "USD",
    filters: params.filters,
    summary: {
      totalIn: Number(summaryRow.totalIn ?? 0),
      totalOut: Number(summaryRow.totalOut ?? 0),
      net: Number(summaryRow.totalIn ?? 0) - Number(summaryRow.totalOut ?? 0),
      entryCount: Number(summaryRow.entryCount ?? 0),
      unassignedAmount: Number(summaryRow.unassignedAmount ?? 0),
      unassignedCount: Number(summaryRow.unassignedCount ?? 0),
    },
    trend: trendRows.map((row) => ({
      bucketDate: row.bucketDate,
      totalIn: Number(row.totalIn ?? 0),
      totalOut: Number(row.totalOut ?? 0),
      net: Number(row.totalIn ?? 0) - Number(row.totalOut ?? 0),
    })),
    accounts: accountRows.map((row) => ({
      accountId: row.accountId,
      accountName: row.accountName,
      accountType: row.accountType,
      totalIn: Number(row.totalIn ?? 0),
      totalOut: Number(row.totalOut ?? 0),
      net: Number(row.totalIn ?? 0) - Number(row.totalOut ?? 0),
      entryCount: Number(row.entryCount ?? 0),
    })),
    ledger: ledgerRows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      accountName: row.accountName,
      accountType: row.accountType,
      direction: row.direction as "IN" | "OUT",
      entryType: row.entryType,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      amount: Number(row.amount ?? 0),
      currency: row.currency as "LAK" | "THB" | "USD",
      reference: row.reference,
      note: row.note,
      occurredAt: row.occurredAt,
    })),
    accountOptions: accountOptionsRows.map((row) => ({
      value: row.value,
      label: row.label,
      type: row.type,
    })),
  };
}
