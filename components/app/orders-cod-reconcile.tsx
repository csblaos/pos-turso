"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client-token";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type CodReconcileRow = {
  id: string;
  orderNo: string;
  customerName: string | null;
  contactDisplayName: string | null;
  shippedAt: string | null;
  shippingProvider: string | null;
  shippingCarrier: string | null;
  expectedCodAmount: number;
  total: number;
  codAmount: number;
  codFee: number;
};

type CodReconcilePage = {
  rows: CodReconcileRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type DraftValue = {
  selected: boolean;
  codAmount: string;
  codFee: string;
};

const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseNonNegativeInt = (raw: string) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.trunc(parsed);
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cod-reconcile-${crypto.randomUUID()}`;
  }
  return `cod-reconcile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatDateTime = (value: string | null, locale: string) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function OrdersCodReconcile() {
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const today = localDateString(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [provider, setProvider] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const [codPage, setCodPage] = useState<CodReconcilePage>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 50,
    pageCount: 1,
  });
  const [providers, setProviders] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const query = new URLSearchParams({
        dateFrom,
        dateTo,
        provider,
        q: keyword.trim(),
        page: String(page),
        pageSize: "50",
      });
      const res = await authFetch(`/api/orders/cod-reconcile?${query.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            page?: CodReconcilePage;
            providers?: string[];
          }
        | null;

      if (!res.ok || !data?.ok || !data.page) {
        setErrorMessage(data?.message ?? t(uiLocale, "orders.codReconcile.error.loadFailed"));
        return;
      }

      setCodPage(data.page);
      setProviders(data.providers ?? []);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const row of data.page?.rows ?? []) {
          const current = prev[row.id];
          next[row.id] = {
            selected: current?.selected ?? false,
            codAmount: current?.codAmount ?? String(row.expectedCodAmount),
            codFee: current?.codFee ?? String(Math.max(0, row.codFee)),
          };
        }
        return next;
      });
    } catch {
      setErrorMessage(t(uiLocale, "orders.codReconcile.error.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, provider, keyword, page, uiLocale]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = codPage.rows;
  const allSelected = rows.length > 0 && rows.every((row) => drafts[row.id]?.selected);

  const rowDraftSummary = useMemo(
    () =>
      rows.map((row) => {
        const draft = drafts[row.id] ?? {
          selected: false,
          codAmount: String(row.expectedCodAmount),
          codFee: String(Math.max(0, row.codFee)),
        };
        const codAmount = parseNonNegativeInt(draft.codAmount);
        const codFee = parseNonNegativeInt(draft.codFee);
        return {
          orderId: row.id,
          orderNo: row.orderNo,
          expectedCodAmount: row.expectedCodAmount,
          codAmount,
          codFee,
          selected: draft.selected,
          invalidInput: codAmount === null || codFee === null,
        };
      }),
    [drafts, rows],
  );

  const selectedRows = useMemo(
    () =>
      rowDraftSummary
        .map((row) => {
          if (!row.selected || row.codAmount === null || row.codFee === null) {
            return null;
          }
          return {
            orderId: row.orderId,
            orderNo: row.orderNo,
            expectedCodAmount: row.expectedCodAmount,
            codAmount: row.codAmount,
            codFee: row.codFee,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [rowDraftSummary],
  );

  const selectedSummary = useMemo(() => {
    return selectedRows.reduce(
      (acc, row) => {
        acc.expected += row.expectedCodAmount;
        acc.actual += row.codAmount;
        acc.fee += row.codFee;
        return acc;
      },
      { expected: 0, actual: 0, fee: 0 },
    );
  }, [selectedRows]);

  const selectedDiff = selectedSummary.actual - selectedSummary.expected;
  const selectedInvalidCount = useMemo(
    () =>
      rowDraftSummary.reduce((acc, row) => {
        if (row.selected && row.invalidInput) {
          return acc + 1;
        }
        return acc;
      }, 0),
    [rowDraftSummary],
  );

  const pageDraftSummary = useMemo(() => {
    const totals = rowDraftSummary.reduce(
      (acc, row) => {
        acc.expected += row.expectedCodAmount;
        acc.actual += row.codAmount ?? 0;
        acc.fee += row.codFee ?? 0;
        if (row.invalidInput) {
          acc.invalidCount += 1;
        }
        return acc;
      },
      { expected: 0, actual: 0, fee: 0, invalidCount: 0 },
    );
    return {
      ...totals,
      diff: totals.actual - totals.expected,
    };
  }, [rowDraftSummary]);

  const toggleSelectAll = () => {
    const nextSelected = !allSelected;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        const current = next[row.id] ?? {
          selected: false,
          codAmount: String(row.expectedCodAmount),
          codFee: String(Math.max(0, row.codFee)),
        };
        next[row.id] = {
          ...current,
          selected: nextSelected,
        };
      }
      return next;
    });
  };

  const onSettleSelected = async () => {
    if (selectedRows.length <= 0) {
      setErrorMessage(t(uiLocale, "orders.codReconcile.error.selectAtLeastOne"));
      return;
    }

    const hasInvalid = rows.some((row) => {
      const draft = drafts[row.id];
      if (!draft?.selected) {
        return false;
      }
      return parseNonNegativeInt(draft.codAmount) === null || parseNonNegativeInt(draft.codFee) === null;
    });
    if (hasInvalid) {
      setErrorMessage(t(uiLocale, "orders.codReconcile.error.invalidInput"));
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const idempotencyKey = createIdempotencyKey();
      const res = await authFetch("/api/orders/cod-reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          items: selectedRows.map((item) => ({
            orderId: item.orderId,
            codAmount: item.codAmount,
            codFee: item.codFee,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            settledCount?: number;
            failedCount?: number;
            results?: Array<{ orderNo: string | null; ok: boolean; message?: string }>;
          }
        | null;

      if (!res.ok || !data?.ok) {
        setErrorMessage(data?.message ?? t(uiLocale, "orders.codReconcile.error.settleFailed"));
        return;
      }

      const settledCount = data.settledCount ?? 0;
      const failedCount = data.failedCount ?? 0;
      const failedMessages = (data.results ?? [])
        .filter((item) => !item.ok)
        .slice(0, 3)
        .map(
          (item) =>
            `${item.orderNo ?? "-"}: ${item.message ?? t(uiLocale, "orders.codReconcile.result.failedFallback")}`,
        );

      if (failedCount > 0) {
        setErrorMessage(
          `${t(uiLocale, "orders.codReconcile.result.summaryMixed.prefixSuccess")} ${settledCount} ${t(uiLocale, "orders.codReconcile.result.summaryMixed.itemSuffix")}, ${t(uiLocale, "orders.codReconcile.result.summaryMixed.infixFailed")} ${failedCount} ${t(uiLocale, "orders.codReconcile.result.summaryMixed.itemSuffix")}` +
            (failedMessages.length > 0 ? ` (${failedMessages.join(" | ")})` : ""),
        );
      } else {
        setSuccessMessage(
          `${t(uiLocale, "orders.codReconcile.result.success")} ${settledCount} ${t(uiLocale, "orders.codReconcile.result.summaryMixed.itemSuffix")}`,
        );
      }

      await loadData();
    } catch {
      setErrorMessage(t(uiLocale, "orders.codReconcile.error.settleFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const toProviderLabel = (row: CodReconcileRow) =>
    row.shippingProvider?.trim() ||
    row.shippingCarrier?.trim() ||
    t(uiLocale, "orders.codReconcile.provider.unknown");

  return (
    <section className="space-y-4">
      <article className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          />
          <input
            type="text"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder={t(uiLocale, "orders.codReconcile.filters.search.placeholder")}
            className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          />
          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          >
            <option value="">{t(uiLocale, "orders.codReconcile.filters.provider.all")}</option>
            {providers.map((providerOption) => (
              <option key={providerOption} value={providerOption}>
                {providerOption}
              </option>
            ))}
          </select>
          <Button type="button" className="h-10" onClick={() => void loadData()} disabled={loading}>
            {t(uiLocale, "orders.codReconcile.filters.refresh")}
          </Button>
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {t(uiLocale, "orders.codReconcile.list.titlePrefix")}{" "}
            {codPage.total.toLocaleString(numberLocale)}{" "}
            {t(uiLocale, "orders.codReconcile.list.itemsSuffix")}
          </p>
          <button
            type="button"
            className="text-xs font-medium text-blue-700"
            onClick={toggleSelectAll}
            disabled={rows.length <= 0}
          >
            {allSelected
              ? t(uiLocale, "orders.codReconcile.list.deselectAll")
              : t(uiLocale, "orders.codReconcile.list.selectAll")}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "orders.codReconcile.selected.expected")}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {selectedSummary.expected.toLocaleString(numberLocale)} LAK
            </p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "orders.codReconcile.selected.actual")}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {selectedSummary.actual.toLocaleString(numberLocale)} LAK
            </p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "orders.codReconcile.selected.fee")}
            </p>
            <p className="text-base font-semibold text-slate-900">
              {selectedSummary.fee.toLocaleString(numberLocale)} LAK
            </p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              {t(uiLocale, "orders.codReconcile.selected.diff")}
            </p>
            <p
              className={`text-base font-semibold ${
                selectedDiff < 0 ? "text-rose-700" : selectedDiff > 0 ? "text-emerald-700" : "text-slate-900"
              }`}
            >
              {selectedDiff.toLocaleString(numberLocale)} LAK
            </p>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          <p>
            {t(uiLocale, "orders.codReconcile.pageDraft.summary.prefix")} •{" "}
            {t(uiLocale, "orders.codReconcile.pageDraft.summary.expectedPrefix")}{" "}
            {pageDraftSummary.expected.toLocaleString(numberLocale)} LAK •{" "}
            {t(uiLocale, "orders.codReconcile.pageDraft.summary.actualPrefix")}{" "}
            {pageDraftSummary.actual.toLocaleString(numberLocale)} LAK •{" "}
            {t(uiLocale, "orders.codReconcile.pageDraft.summary.feePrefix")}{" "}
            {pageDraftSummary.fee.toLocaleString(numberLocale)} LAK •{" "}
            {t(uiLocale, "orders.codReconcile.pageDraft.summary.diffPrefix")}{" "}
            <span
              className={
                pageDraftSummary.diff < 0
                  ? "text-rose-700"
                  : pageDraftSummary.diff > 0
                    ? "text-emerald-700"
                    : "text-slate-600"
              }
            >
              {pageDraftSummary.diff.toLocaleString(numberLocale)} LAK
            </span>
          </p>
          {pageDraftSummary.invalidCount > 0 ? (
            <p className="text-red-600">
              {t(uiLocale, "orders.codReconcile.pageDraft.invalidCount.prefix")}{" "}
              {pageDraftSummary.invalidCount.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "orders.codReconcile.pageDraft.invalidCount.suffix")}
            </p>
          ) : null}
        </div>

        <div className="mt-3 space-y-2">
          {rows.length <= 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {t(uiLocale, "orders.codReconcile.empty")}
            </p>
          ) : (
            rows.map((row) => {
              const draft = drafts[row.id] ?? {
                selected: false,
                codAmount: String(row.expectedCodAmount),
                codFee: String(Math.max(0, row.codFee)),
              };
              const parsedAmount = parseNonNegativeInt(draft.codAmount);
              const parsedFee = parseNonNegativeInt(draft.codFee);
              const rowDiff =
                parsedAmount !== null ? parsedAmount - row.expectedCodAmount : 0;
              return (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...draft,
                              selected: event.target.checked,
                            },
                          }))
                        }
                      />
                      {row.orderNo}
                    </label>
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "orders.codReconcile.shippedAt.prefix")}{" "}
                      {formatDateTime(row.shippedAt, numberLocale)} • {toProviderLabel(row)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {t(uiLocale, "orders.codReconcile.customer.prefix")}{" "}
                    {row.customerName ||
                      row.contactDisplayName ||
                      t(uiLocale, "orders.codReconcile.customer.walkIn")}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <div className="rounded-md bg-slate-50 p-2 text-xs">
                      <p className="text-slate-500">
                        {t(uiLocale, "orders.codReconcile.field.expected")}
                      </p>
                      <p className="font-medium">
                        {row.expectedCodAmount.toLocaleString(numberLocale)} LAK
                      </p>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="text-slate-500">
                        {t(uiLocale, "orders.codReconcile.field.actual")}
                      </p>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draft.codAmount}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...draft,
                              codAmount: event.target.value,
                            },
                          }))
                        }
                        className="h-9 w-full rounded-md border px-2 text-sm outline-none ring-primary focus:ring-2"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="text-slate-500">{t(uiLocale, "orders.codReconcile.field.fee")}</p>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draft.codFee}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...draft,
                              codFee: event.target.value,
                            },
                          }))
                        }
                        className="h-9 w-full rounded-md border px-2 text-sm outline-none ring-primary focus:ring-2"
                      />
                    </div>
                    <div className="rounded-md bg-slate-50 p-2 text-xs">
                      <p className="text-slate-500">{t(uiLocale, "orders.codReconcile.field.diff")}</p>
                      <p
                        className={`font-medium ${
                          rowDiff < 0 ? "text-rose-700" : rowDiff > 0 ? "text-emerald-700" : "text-slate-900"
                        }`}
                      >
                        {rowDiff.toLocaleString(numberLocale)} LAK
                      </p>
                    </div>
                  </div>

                  {parsedAmount === null || parsedFee === null ? (
                    <p className="mt-2 text-xs text-red-600">
                      {t(uiLocale, "orders.codReconcile.validation.correctAmounts")}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="text-xs text-slate-600">
            <p>
              {t(uiLocale, "orders.codReconcile.selected.summary.prefix")}{" "}
              {selectedRows.length.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "orders.codReconcile.list.itemsSuffix")} •{" "}
              {t(uiLocale, "orders.codReconcile.selected.summary.expectedPrefix")}{" "}
              {selectedSummary.expected.toLocaleString(numberLocale)} LAK
            </p>
            <p>
              {t(uiLocale, "orders.codReconcile.selected.summary.actualPrefix")}{" "}
              {selectedSummary.actual.toLocaleString(numberLocale)} LAK •{" "}
              {t(uiLocale, "orders.codReconcile.selected.summary.feePrefix")}{" "}
              {selectedSummary.fee.toLocaleString(numberLocale)} LAK •{" "}
              {t(uiLocale, "orders.codReconcile.selected.summary.diffPrefix")}{" "}
              <span className={selectedDiff < 0 ? "text-rose-700" : selectedDiff > 0 ? "text-emerald-700" : ""}>
                {selectedDiff.toLocaleString(numberLocale)} LAK
              </span>
            </p>
            {selectedInvalidCount > 0 ? (
              <p className="text-red-600">
                {t(uiLocale, "orders.codReconcile.selected.invalid.prefix")}{" "}
                {selectedInvalidCount.toLocaleString(numberLocale)}{" "}
                {t(uiLocale, "orders.codReconcile.list.itemsSuffix")}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={() => void onSettleSelected()}
            disabled={submitting || selectedRows.length <= 0}
          >
            {submitting
              ? t(uiLocale, "orders.codReconcile.action.submitting")
              : t(uiLocale, "orders.codReconcile.action.confirm")}
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={loading || page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            {t(uiLocale, "orders.codReconcile.pagination.prev")}
          </button>
          <p>
            {t(uiLocale, "orders.codReconcile.pagination.pagePrefix")}{" "}
            {codPage.page.toLocaleString(numberLocale)} /{" "}
            {codPage.pageCount.toLocaleString(numberLocale)}
          </p>
          <button
            type="button"
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={loading || page >= codPage.pageCount}
            onClick={() => setPage((prev) => Math.min(codPage.pageCount, prev + 1))}
          >
            {t(uiLocale, "orders.codReconcile.pagination.next")}
          </button>
        </div>
      </article>

      {successMessage ? (
        <p className="text-sm text-emerald-700">{successMessage}</p>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
