"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePickerField, toDateInputValue } from "@/components/ui/date-picker-field";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
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
  shippingCost: number;
  codAmount: number;
  codFee: number;
  codReturnNote: string | null;
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

type CodReturnSheetState = {
  orderId: string;
  orderNo: string;
  customerLabel: string;
  shippingCost: number;
  codFeeAccumulated: number;
  codReturnNote: string;
  codFee: string;
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

export function OrdersCodReconcile({ canCodReturn = false }: { canCodReturn?: boolean }) {
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const today = toDateInputValue(new Date());
  const weekdayLabels = [
    t(uiLocale, "purchase.calendar.weekday.SUN"),
    t(uiLocale, "purchase.calendar.weekday.MON"),
    t(uiLocale, "purchase.calendar.weekday.TUE"),
    t(uiLocale, "purchase.calendar.weekday.WED"),
    t(uiLocale, "purchase.calendar.weekday.THU"),
    t(uiLocale, "purchase.calendar.weekday.FRI"),
    t(uiLocale, "purchase.calendar.weekday.SAT"),
  ] as const;
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
  const [codReturnSheet, setCodReturnSheet] = useState<CodReturnSheetState | null>(null);
  const [codReturnSubmitting, setCodReturnSubmitting] = useState(false);
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

  const codReturnFeeNumber = codReturnSheet ? parseNonNegativeInt(codReturnSheet.codFee) : null;
  const selectedCount = selectedRows.length;

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

  const openCodReturnSheet = (row: CodReconcileRow) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCodReturnSheet({
      orderId: row.id,
      orderNo: row.orderNo,
      customerLabel:
        row.customerName ||
        row.contactDisplayName ||
        t(uiLocale, "orders.codReconcile.customer.walkIn"),
      shippingCost: row.shippingCost,
      codFeeAccumulated: row.codFee,
      codReturnNote: row.codReturnNote ?? "",
      codFee: "0",
    });
  };

  const onConfirmCodReturn = useCallback(async () => {
    if (!codReturnSheet) {
      return;
    }

    const nextFee = parseNonNegativeInt(codReturnSheet.codFee);
    if (nextFee === null) {
      setErrorMessage(t(uiLocale, "orders.management.review.codReturn.error.invalidFee"));
      return;
    }

    setCodReturnSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await authFetch(`/api/orders/${codReturnSheet.orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mark_cod_returned",
          codFee: nextFee,
          codReturnNote: codReturnSheet.codReturnNote.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setErrorMessage(data?.message ?? t(uiLocale, "common.error.saveFailed"));
        return;
      }

      setSuccessMessage(t(uiLocale, "orders.detail.toast.codReturned"));
      setCodReturnSheet(null);
      await loadData();
    } catch {
      setErrorMessage(t(uiLocale, "common.error.saveFailed"));
    } finally {
      setCodReturnSubmitting(false);
    }
  }, [codReturnSheet, loadData, uiLocale]);

  const toProviderLabel = (row: CodReconcileRow) =>
    row.shippingProvider?.trim() ||
    row.shippingCarrier?.trim() ||
    t(uiLocale, "orders.codReconcile.provider.unknown");

  return (
    <section className="space-y-4 pb-32">
      <article className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.codReconcile.page.title")}
            </h2>
            <p className="text-xs text-slate-500">{t(uiLocale, "orders.codReconcile.page.subtitle")}</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                aria-label={t(uiLocale, "orders.codReconcile.filters.searchLabel")}
                placeholder={t(uiLocale, "orders.codReconcile.filters.search.placeholder")}
                className="h-10 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_minmax(0,12rem)_auto_auto]">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">
                  {t(uiLocale, "orders.codReconcile.filters.dateFromLabel")}
                </span>
                <DatePickerField
                  value={dateFrom}
                  onChange={(nextValue) => {
                    setDateFrom(nextValue);
                    setPage(1);
                  }}
                  placeholder={t(uiLocale, "common.datePicker.placeholder")}
                  ariaLabel={t(uiLocale, "orders.codReconcile.filters.dateFromLabel")}
                  dateLocale={numberLocale}
                  weekdayLabels={weekdayLabels}
                  clearLabel={t(uiLocale, "common.action.clear")}
                  closeLabel={t(uiLocale, "common.action.close")}
                  disabled={loading || submitting || codReturnSubmitting}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">
                  {t(uiLocale, "orders.codReconcile.filters.dateToLabel")}
                </span>
                <DatePickerField
                  value={dateTo}
                  onChange={(nextValue) => {
                    setDateTo(nextValue);
                    setPage(1);
                  }}
                  placeholder={t(uiLocale, "common.datePicker.placeholder")}
                  ariaLabel={t(uiLocale, "orders.codReconcile.filters.dateToLabel")}
                  dateLocale={numberLocale}
                  weekdayLabels={weekdayLabels}
                  clearLabel={t(uiLocale, "common.action.clear")}
                  closeLabel={t(uiLocale, "common.action.close")}
                  disabled={loading || submitting || codReturnSubmitting}
                />
              </label>

              <label className="min-w-0 space-y-1.5">
                <span className="text-xs font-medium text-slate-600">
                  {t(uiLocale, "orders.codReconcile.filters.providerLabel")}
                </span>
                <select
                  value={provider}
                  onChange={(event) => {
                    setProvider(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none ring-primary focus:ring-2"
                >
                  <option value="">{t(uiLocale, "orders.codReconcile.filters.provider.all")}</option>
                  {providers.map((providerOption) => (
                    <option key={providerOption} value={providerOption}>
                      {providerOption}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-2 xl:self-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-3 text-xs"
                  disabled={loading || submitting || codReturnSubmitting}
                  onClick={() => {
                    setDateFrom(today);
                    setDateTo(today);
                    setPage(1);
                  }}
                >
                  {t(uiLocale, "orders.codReconcile.filters.today")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-3 text-xs"
                  onClick={() => void loadData()}
                  disabled={loading || submitting || codReturnSubmitting}
                >
                  {t(uiLocale, "orders.codReconcile.filters.refresh")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border bg-white p-4 shadow-sm">
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

        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
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
      </article>

      <div className="space-y-3">
        {rows.length <= 0 ? (
          <p className="rounded-2xl border border-dashed bg-white p-4 text-sm text-muted-foreground shadow-sm">
            {t(uiLocale, "orders.codReconcile.empty")}
          </p>
        ) : (
          rows.map((row) => {
            const defaultAmount = String(row.expectedCodAmount);
            const defaultFee = String(Math.max(0, row.codFee));
            const draft = drafts[row.id] ?? {
              selected: false,
              codAmount: defaultAmount,
              codFee: defaultFee,
            };
            const parsedAmount = parseNonNegativeInt(draft.codAmount);
            const parsedFee = parseNonNegativeInt(draft.codFee);
            const rowDiff = parsedAmount !== null ? parsedAmount - row.expectedCodAmount : 0;
            const hasInvalid = parsedAmount === null || parsedFee === null;
            const hasDraftChanges = draft.codAmount !== defaultAmount || draft.codFee !== defaultFee;

            return (
              <article
                key={row.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  draft.selected
                    ? "border-blue-300 bg-blue-50/30"
                    : hasInvalid
                      ? "border-rose-200"
                      : hasDraftChanges
                        ? "border-amber-200"
                        : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        disabled={submitting || codReturnSubmitting}
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
                      <span className="truncate">{row.orderNo}</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      {row.customerName ||
                        row.contactDisplayName ||
                        t(uiLocale, "orders.codReconcile.customer.walkIn")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "orders.codReconcile.shippedAt.prefix")}{" "}
                      {formatDateTime(row.shippedAt, numberLocale)} • {toProviderLabel(row)}
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {row.expectedCodAmount.toLocaleString(numberLocale)} LAK
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">{t(uiLocale, "orders.codReconcile.field.expected")}</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {row.expectedCodAmount.toLocaleString(numberLocale)} LAK
                    </p>
                  </div>
                  <label className="space-y-1 rounded-xl border border-slate-200 p-3 text-xs">
                    <span className="text-slate-500">{t(uiLocale, "orders.codReconcile.field.actual")}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.codAmount}
                      disabled={submitting || codReturnSubmitting}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: {
                            ...draft,
                            codAmount: event.target.value,
                          },
                        }))
                      }
                      className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none ring-primary focus:ring-2"
                    />
                  </label>
                  <label className="space-y-1 rounded-xl border border-slate-200 p-3 text-xs">
                    <span className="text-slate-500">{t(uiLocale, "orders.codReconcile.field.fee")}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.codFee}
                      disabled={submitting || codReturnSubmitting}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: {
                            ...draft,
                            codFee: event.target.value,
                          },
                        }))
                      }
                      className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none ring-primary focus:ring-2"
                    />
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">{t(uiLocale, "orders.codReconcile.field.diff")}</p>
                    <p
                      className={`mt-1 font-semibold ${
                        rowDiff < 0 ? "text-rose-700" : rowDiff > 0 ? "text-emerald-700" : "text-slate-900"
                      }`}
                    >
                      {rowDiff.toLocaleString(numberLocale)} LAK
                    </p>
                  </div>
                </div>

                {hasInvalid ? (
                  <p className="mt-2 text-xs text-red-600">
                    {t(uiLocale, "orders.codReconcile.validation.correctAmounts")}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {canCodReturn ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-orange-300 px-3 text-xs text-orange-700 hover:bg-orange-50"
                      disabled={submitting || codReturnSubmitting}
                      onClick={() => openCodReturnSheet(row)}
                    >
                      {t(uiLocale, "orders.detail.action.markCodReturned")}
                    </Button>
                  ) : null}
                  <Link
                    href={`/orders/${row.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
                  >
                    {t(uiLocale, "orders.management.action.viewDetails")}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>

      <article className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500">
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

      {selectedCount > 0 ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 md:left-1/2 md:w-[min(56rem,calc(100vw-2rem))] md:-translate-x-1/2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {t(uiLocale, "orders.codReconcile.selected.summary.prefix")}{" "}
                  {selectedCount.toLocaleString(numberLocale)}{" "}
                  {t(uiLocale, "orders.codReconcile.list.itemsSuffix")}
                </p>
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.codReconcile.selected.summary.expectedPrefix")}{" "}
                  {selectedSummary.expected.toLocaleString(numberLocale)} LAK •{" "}
                  {t(uiLocale, "orders.codReconcile.selected.summary.actualPrefix")}{" "}
                  {selectedSummary.actual.toLocaleString(numberLocale)} LAK •{" "}
                  {t(uiLocale, "orders.codReconcile.selected.summary.feePrefix")}{" "}
                  {selectedSummary.fee.toLocaleString(numberLocale)} LAK
                </p>
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.codReconcile.selected.summary.diffPrefix")}{" "}
                  <span className={selectedDiff < 0 ? "text-rose-700" : selectedDiff > 0 ? "text-emerald-700" : ""}>
                    {selectedDiff.toLocaleString(numberLocale)} LAK
                  </span>
                  {selectedInvalidCount > 0 ? (
                    <>
                      {" • "}
                      <span className="text-red-600">
                        {t(uiLocale, "orders.codReconcile.selected.invalid.prefix")}{" "}
                        {selectedInvalidCount.toLocaleString(numberLocale)}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void onSettleSelected()}
                disabled={submitting || codReturnSubmitting || selectedCount <= 0}
              >
                {submitting
                  ? t(uiLocale, "orders.codReconcile.action.submitting")
                  : t(uiLocale, "orders.codReconcile.action.confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {codReturnSheet ? (
        <SlideUpSheet
          isOpen
          onClose={() => {
            if (!codReturnSubmitting) {
              setCodReturnSheet(null);
            }
          }}
          title={t(uiLocale, "orders.management.review.codReturn.title")}
          description={t(uiLocale, "orders.management.review.codReturn.description")}
          panelMaxWidthClass="sm:max-w-lg"
          disabled={codReturnSubmitting}
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full sm:w-auto"
                disabled={codReturnSubmitting}
                onClick={() => setCodReturnSheet(null)}
              >
                {t(uiLocale, "common.action.cancel")}
              </Button>
              <Button
                type="button"
                className="h-10 w-full sm:w-auto"
                disabled={codReturnSubmitting || codReturnFeeNumber === null}
                onClick={() => void onConfirmCodReturn()}
              >
                {codReturnSubmitting
                  ? t(uiLocale, "common.action.saving")
                  : t(uiLocale, "orders.detail.action.markCodReturned")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{codReturnSheet.orderNo}</p>
                  <p className="text-xs text-slate-500">{codReturnSheet.customerLabel}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
              {t(uiLocale, "orders.management.review.codReturn.hint")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-900">
                  {t(uiLocale, "orders.management.review.codReturn.outboundShippingLabel")}
                </span>
                <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {codReturnSheet.shippingCost.toLocaleString(numberLocale)} LAK
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-900">
                  {t(uiLocale, "orders.management.review.codReturn.accumulatedFeeLabel")}
                </span>
                <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {codReturnSheet.codFeeAccumulated.toLocaleString(numberLocale)} LAK
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-900">
                  {t(uiLocale, "orders.management.review.codReturn.feeLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                  value={codReturnSheet.codFee}
                  disabled={codReturnSubmitting}
                  onChange={(event) =>
                    setCodReturnSheet((current) =>
                      current
                        ? {
                            ...current,
                            codFee: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </label>
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-900">
                  {t(uiLocale, "orders.management.review.codReturn.totalShippingLabel")}
                </span>
                <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {(
                    codReturnSheet.shippingCost +
                    (codReturnFeeNumber !== null ? codReturnFeeNumber : 0)
                  ).toLocaleString(numberLocale)}{" "}
                  LAK
                </div>
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-900">
                {t(uiLocale, "orders.management.review.codReturn.noteLabel")}
              </span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
                value={codReturnSheet.codReturnNote}
                disabled={codReturnSubmitting}
                placeholder={t(uiLocale, "orders.management.review.codReturn.notePlaceholder")}
                onChange={(event) =>
                  setCodReturnSheet((current) =>
                    current
                      ? {
                          ...current,
                          codReturnNote: event.target.value,
                        }
                      : current,
                  )
                }
              />
            </label>
          </div>
        </SlideUpSheet>
      ) : null}
    </section>
  );
}
