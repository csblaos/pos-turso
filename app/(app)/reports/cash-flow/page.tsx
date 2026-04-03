import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, Landmark, WalletCards } from "lucide-react";

import { CashFlowHelpButton } from "@/components/app/cash-flow-help-button";
import { CashFlowFilters } from "@/components/app/cash-flow-filters";
import { getSession } from "@/lib/auth/session";
import { resolveCashFlowFilterState } from "@/lib/finance/cash-flow-filters";
import { currencySymbol } from "@/lib/finance/store-financial";
import {
  DEFAULT_UI_LOCALE,
  type UiLocale,
  uiLocaleToDateLocale,
} from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { getCashFlowViewData } from "@/server/services/cash-flow-report.service";

type CashFlowPageProps = {
  searchParams: Promise<{
    preset?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    direction?: string | string[];
    entryType?: string | string[];
    account?: string | string[];
  }>;
};

function formatShortDate(value: string, locale: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function formatDateTime(value: string, locale: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRangeLabel(
  uiLocale: UiLocale,
  dateLocale: string,
  filters: { preset: string; dateFrom: string; dateTo: string },
) {
  if (filters.preset !== "CUSTOM") {
    return t(uiLocale, `reports.filters.preset.${filters.preset}` as MessageKey);
  }
  return `${formatShortDate(filters.dateFrom, dateLocale)} - ${formatShortDate(
    filters.dateTo,
    dateLocale,
  )}`;
}

function MetricCard({
  title,
  value,
  hint,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50/70"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/70"
        : "border-slate-200 bg-white";

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

function CashFlowTrendChart({
  points,
  numberLocale,
  currency,
  uiLocale,
}: {
  points: Array<{ bucketDate: string; totalIn: number; totalOut: number; net: number }>;
  numberLocale: string;
  currency: string;
  uiLocale: UiLocale;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t(uiLocale, "cashFlow.common.noData")}</p>;
  }

  const maxValue = Math.max(
    ...points.map((point) => Math.max(point.totalIn, point.totalOut)),
    1,
  );

  return (
    <div className="space-y-3">
      <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2">
        {points.map((point) => {
          const inHeight = Math.max(10, Math.round((point.totalIn / maxValue) * 100));
          const outHeight = Math.max(10, Math.round((point.totalOut / maxValue) * 100));
          return (
            <div key={point.bucketDate} className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-1">
                <div
                  className="w-4 rounded-t-lg bg-emerald-500"
                  style={{ height: `${inHeight}%` }}
                  title={`${t(uiLocale, "cashFlow.summary.totalIn")}: ${point.totalIn.toLocaleString(numberLocale)} ${currency}`}
                />
                <div
                  className="w-4 rounded-t-lg bg-rose-500"
                  style={{ height: `${outHeight}%` }}
                  title={`${t(uiLocale, "cashFlow.summary.totalOut")}: ${point.totalOut.toLocaleString(numberLocale)} ${currency}`}
                />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[11px] font-medium text-slate-700">
                  {formatShortDate(point.bucketDate, numberLocale)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {point.net >= 0 ? "+" : "-"}
                  {Math.abs(point.net).toLocaleString(numberLocale)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t(uiLocale, "cashFlow.summary.totalIn")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          {t(uiLocale, "cashFlow.summary.totalOut")}
        </span>
      </div>
    </div>
  );
}

function getEntryTypeLabel(uiLocale: UiLocale, value: string) {
  return t(uiLocale, `cashFlow.filters.entryType.${value}` as MessageKey);
}

export default async function CashFlowPage({ searchParams }: CashFlowPageProps) {
  const params = await searchParams;
  const [session, permissionKeys] = await Promise.all([
    getSession(),
    getUserPermissionsForCurrentSession(),
  ]);

  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const filters = resolveCashFlowFilterState(params);
  const canView = isPermissionGranted(permissionKeys, "reports.view");

  if (!canView) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t(uiLocale, "cashFlow.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "cashFlow.noAccess")}</p>
      </section>
    );
  }

  const data = await getCashFlowViewData({
    storeId: session.activeStoreId,
    filters,
  });

  const moneySign = currencySymbol(data.storeCurrency);
  const fmtMoney = (value: number) => `${value.toLocaleString(numberLocale)} ${moneySign}`;
  const fmtSignedMoney = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toLocaleString(numberLocale)} ${moneySign}`;
  const activeRangeLabel = formatRangeLabel(uiLocale, numberLocale, filters);

  return (
    <section className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{t(uiLocale, "cashFlow.title")}</h1>
            <CashFlowHelpButton uiLocale={uiLocale} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {t(uiLocale, "cashFlow.link.backToReports")}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {activeRangeLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {t(uiLocale, `cashFlow.filters.direction.${filters.direction}` as MessageKey)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {t(uiLocale, `cashFlow.filters.entryType.${filters.entryType}` as MessageKey)}
          </span>
        </div>
      </header>

      <CashFlowFilters
        uiLocale={uiLocale}
        dateLocale={numberLocale}
        initialFilters={filters}
        accountOptions={data.accountOptions}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title={t(uiLocale, "cashFlow.summary.totalIn")}
          value={fmtMoney(data.summary.totalIn)}
          hint={`${data.summary.entryCount.toLocaleString(numberLocale)} ${t(uiLocale, "cashFlow.summary.entriesSuffix")}`}
          tone="positive"
        />
        <MetricCard
          title={t(uiLocale, "cashFlow.summary.totalOut")}
          value={fmtMoney(data.summary.totalOut)}
        />
        <MetricCard
          title={t(uiLocale, "cashFlow.summary.net")}
          value={fmtSignedMoney(data.summary.net)}
          tone={data.summary.net >= 0 ? "positive" : "warning"}
        />
        <MetricCard
          title={t(uiLocale, "cashFlow.summary.unassignedAmount")}
          value={fmtMoney(data.summary.unassignedAmount)}
          hint={`${data.summary.unassignedCount.toLocaleString(numberLocale)} ${t(uiLocale, "cashFlow.summary.entriesSuffix")}`}
          tone="warning"
        />
        <MetricCard
          title={t(uiLocale, "cashFlow.summary.accountCount")}
          value={data.accountOptions.length.toLocaleString(numberLocale)}
          hint={t(uiLocale, "cashFlow.summary.accountCountHint")}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "cashFlow.chart.title")}</h2>
            <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.chart.description")}</p>
          </div>
          <CashFlowTrendChart
            points={data.trend}
            numberLocale={numberLocale}
            currency={moneySign}
            uiLocale={uiLocale}
          />
        </article>

        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{t(uiLocale, "cashFlow.health.title")}</h2>
            <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.health.description")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.health.unassignedTitle")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {data.summary.unassignedCount.toLocaleString(numberLocale)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t(uiLocale, "cashFlow.health.unassignedHint")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.health.outflowTitle")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(data.summary.totalOut)}</p>
              <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "cashFlow.health.outflowHint")}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.health.positiveAccounts")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {data.accounts
                  .filter((row) => row.net > 0)
                  .length.toLocaleString(numberLocale)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.health.filteredEntries")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {data.summary.entryCount.toLocaleString(numberLocale)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-slate-500" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">{t(uiLocale, "cashFlow.accounts.title")}</h2>
              <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.accounts.description")}</p>
            </div>
          </div>
          {data.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(uiLocale, "cashFlow.common.noData")}</p>
          ) : (
            <div className="space-y-3">
              {data.accounts.map((row) => (
                <div key={row.accountId ?? "UNASSIGNED"} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {row.accountName ?? t(uiLocale, "cashFlow.filters.account.UNASSIGNED")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.accountType
                          ? t(uiLocale, `cashFlow.accountType.${row.accountType}` as MessageKey)
                          : t(uiLocale, "cashFlow.accountType.UNASSIGNED")}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        row.net >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {fmtSignedMoney(row.net)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <p>
                      {t(uiLocale, "cashFlow.summary.totalIn")}: {fmtMoney(row.totalIn)}
                    </p>
                    <p>
                      {t(uiLocale, "cashFlow.summary.totalOut")}: {fmtMoney(row.totalOut)}
                    </p>
                    <p>
                      {row.entryCount.toLocaleString(numberLocale)} {t(uiLocale, "cashFlow.summary.entriesSuffix")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-slate-500" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">{t(uiLocale, "cashFlow.ledger.title")}</h2>
              <p className="text-xs text-slate-500">{t(uiLocale, "cashFlow.ledger.description")}</p>
            </div>
          </div>
          {data.ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(uiLocale, "cashFlow.common.noData")}</p>
          ) : (
            <div className="space-y-3">
              {data.ledger.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            row.direction === "IN"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {t(uiLocale, `cashFlow.filters.direction.${row.direction}` as MessageKey)}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {getEntryTypeLabel(uiLocale, row.entryType)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {row.accountName ?? t(uiLocale, "cashFlow.filters.account.UNASSIGNED")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.reference || row.sourceId}
                        {row.note ? ` • ${row.note}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          row.direction === "IN" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {row.direction === "IN" ? "+" : "-"}
                        {fmtMoney(row.amount)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatDateTime(row.occurredAt, numberLocale)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
