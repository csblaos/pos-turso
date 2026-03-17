import Link from "next/link";
import {
  and,
  desc,
  eq,
  gte,
  like,
  lt,
  lte,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { ChevronRight, ClipboardList, Settings2 } from "lucide-react";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditEvents, stores, users } from "@/lib/db/schema";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { hasPermission } from "@/lib/rbac/access";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ResultFilter = "ALL" | "SUCCESS" | "FAIL";

const PAGE_SIZE = 30;

const getParam = (params: SearchParams, key: string) => {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

const parseResult = (value: string): ResultFilter => {
  if (value === "SUCCESS") return "SUCCESS";
  if (value === "FAIL") return "FAIL";
  return "ALL";
};

const formatDateTime = (value: string, uiLocale: UiLocale) => {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(uiLocaleToDateLocale(uiLocale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const toDayStartIso = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toDayEndIso = (value: string) => {
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const parseJsonText = (value: string | null) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const actionFilterValues = [
  "order.create",
  "order.update_shipping",
  "order.submit_for_payment",
  "order.submit_payment_slip",
  "order.confirm_paid",
  "order.mark_packed",
  "order.mark_shipped",
  "order.cancel",
  "stock.movement.create",
  "po.create",
  "po.update",
  "po.status.change",
  "store.settings.update",
  "store.settings.pdf.update",
  "store.payment_account.create",
  "store.payment_account.update",
  "store.payment_account.delete",
  "store.member.create_new",
  "store.member.add_existing",
  "store.member.assign_role",
  "store.member.set_status",
  "store.member.set_session_limit",
  "store.member.set_branch_access",
  "store.member.reset_password",
  "store.role.permissions.update",
  "account.profile.update",
  "account.password.change",
] as const;

type ActionFilterValue = (typeof actionFilterValues)[number];

function actionLabelKey(action: ActionFilterValue): MessageKey {
  return `settings.auditLog.actionLabel.${action}` as MessageKey;
}

function getActionFilterOptions(uiLocale: UiLocale) {
  return [
    { value: "", label: t(uiLocale, "common.filter.all") },
    ...actionFilterValues.map((value) => ({
      value,
      label: t(uiLocale, actionLabelKey(value)),
    })),
  ];
}

const buildHref = (basePath: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
};

export default async function SettingsAuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/settings/stores");
  }

  const canViewSettings = await hasPermission(
    { userId: session.userId },
    session.activeStoreId,
    "settings.view",
  );

  if (!canViewSettings) {
    redirect("/settings");
  }

  const storeId = session.activeStoreId;
  const uiLocale = session.uiLocale;
  const params = (await searchParams) ?? {};

  const q = getParam(params, "q").trim();
  const action = getParam(params, "action").trim();
  const actionLike = getParam(params, "actionLike").trim();
  const result = parseResult(getParam(params, "result"));
  const fromDate = getParam(params, "from").trim();
  const toDate = getParam(params, "to").trim();

  const actionFilterOptions = getActionFilterOptions(uiLocale);
  const actionLabelMap: Record<string, string> = Object.fromEntries(
    actionFilterOptions
      .filter((option) => option.value.length > 0)
      .map((option) => [option.value, option.label]),
  );
  const cursorAtRaw = getParam(params, "cursorAt").trim();
  const cursorIdRaw = getParam(params, "cursorId").trim();
  const cursorAt =
    cursorAtRaw.length > 0 && !Number.isNaN(Date.parse(cursorAtRaw)) ? cursorAtRaw : "";
  const cursorId = cursorAt && cursorIdRaw ? cursorIdRaw : "";

  const actorUsers = alias(users, "actor_users");

  const whereClauses = [eq(auditEvents.scope, "STORE"), eq(auditEvents.storeId, storeId)];

  if (result === "SUCCESS" || result === "FAIL") {
    whereClauses.push(eq(auditEvents.result, result));
  }

  if (action) {
    whereClauses.push(eq(auditEvents.action, action));
  }

  if (actionLike) {
    whereClauses.push(like(auditEvents.action, `%${actionLike}%`));
  }

  if (q) {
    const searchCondition = or(
      like(auditEvents.action, `%${q}%`),
      like(auditEvents.entityType, `%${q}%`),
      like(auditEvents.entityId, `%${q}%`),
      like(auditEvents.actorName, `%${q}%`),
      like(actorUsers.name, `%${q}%`),
    );
    if (searchCondition) {
      whereClauses.push(searchCondition);
    }
  }

  const fromIso = fromDate ? toDayStartIso(fromDate) : null;
  const toIso = toDate ? toDayEndIso(toDate) : null;

  if (fromIso) {
    whereClauses.push(gte(auditEvents.occurredAt, fromIso));
  }

  if (toIso) {
    whereClauses.push(lte(auditEvents.occurredAt, toIso));
  }

  if (cursorAt && cursorId) {
    const cursorCondition = or(
      lt(auditEvents.occurredAt, cursorAt),
      and(eq(auditEvents.occurredAt, cursorAt), lt(auditEvents.id, cursorId)),
    );
    if (cursorCondition) {
      whereClauses.push(cursorCondition);
    }
  }

  const whereCondition = and(...whereClauses);

  const [[storeRow], rowsWithExtra] = await Promise.all([
    db
      .select({ name: stores.name })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1),
    db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        actorNameSnapshot: auditEvents.actorName,
        actorRoleSnapshot: auditEvents.actorRole,
        actorName: actorUsers.name,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        result: auditEvents.result,
        reasonCode: auditEvents.reasonCode,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .leftJoin(actorUsers, eq(auditEvents.actorUserId, actorUsers.id))
      .where(whereCondition)
      .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
      .limit(PAGE_SIZE + 1)
      .offset(0),
  ]);

  const hasMore = rowsWithExtra.length > PAGE_SIZE;
  const rows = rowsWithExtra.slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? rows[rows.length - 1] : null;

  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (action) baseParams.set("action", action);
  if (actionLike) baseParams.set("actionLike", actionLike);
  if (result !== "ALL") baseParams.set("result", result);
  if (fromDate) baseParams.set("from", fromDate);
  if (toDate) baseParams.set("to", toDate);

  const nextParams = new URLSearchParams(baseParams);
  if (nextCursor) {
    nextParams.set("cursorAt", nextCursor.occurredAt);
    nextParams.set("cursorId", nextCursor.id);
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1 px-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
          {t(uiLocale, "settings.link.auditLog.title")}
        </h1>
        <p className="text-sm text-slate-500">
          {t(uiLocale, "settings.auditLog.page.descriptionPrefix")} {storeRow?.name ?? "-"}{" "}
          {t(uiLocale, "settings.auditLog.page.descriptionSuffix")}
        </p>
      </header>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" method="GET">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-slate-600">
            {t(uiLocale, "settings.auditLog.filter.q.label")}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={t(uiLocale, "settings.auditLog.filter.q.placeholder")}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            {t(uiLocale, "settings.auditLog.filter.action.label")}
            <select
              name="action"
              defaultValue={action}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            >
              {actionFilterOptions.map((option) => (
                <option key={option.value || "__all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            {t(uiLocale, "settings.auditLog.filter.actionLike.label")}
            <input
              type="text"
              name="actionLike"
              defaultValue={actionLike}
              placeholder={t(uiLocale, "settings.auditLog.filter.actionLike.placeholder")}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            {t(uiLocale, "settings.auditLog.filter.result.label")}
            <select
              name="result"
              defaultValue={result}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            >
              <option value="ALL">{t(uiLocale, "common.filter.all")}</option>
              <option value="SUCCESS">{t(uiLocale, "common.result.success")}</option>
              <option value="FAIL">{t(uiLocale, "common.result.fail")}</option>
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            {t(uiLocale, "settings.auditLog.filter.fromDate.label")}
            <input
              type="date"
              name="from"
              defaultValue={fromDate}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            {t(uiLocale, "settings.auditLog.filter.toDate.label")}
            <input
              type="date"
              name="to"
              defaultValue={toDate}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-white"
          >
            {t(uiLocale, "settings.auditLog.action.search")}
          </button>
          <Link
            href="/settings/audit-log"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
          >
            {t(uiLocale, "settings.auditLog.action.clearFilters")}
          </Link>
          <p className="ml-auto text-xs text-slate-500">
            {t(uiLocale, "settings.auditLog.perPage.prefix")}{" "}
            {rows.length.toLocaleString(uiLocaleToDateLocale(uiLocale))}{" "}
            {t(uiLocale, "settings.auditLog.perPage.suffix")}
          </p>
        </div>
      </form>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{t(uiLocale, "settings.auditLog.title")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t(uiLocale, "settings.auditLog.subtitle")}</p>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">{t(uiLocale, "settings.auditLog.empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const metadata = parseJsonText(row.metadata);
              const actorName =
                row.actorNameSnapshot ?? row.actorName ?? t(uiLocale, "common.actor.system");
              const title = actionLabelMap[row.action] ?? row.action;
              const detailBits = [
                `${row.entityType}${row.entityId ? `#${row.entityId}` : ""}`,
                row.reasonCode
                  ? `${t(uiLocale, "settings.auditLog.reasonPrefix")} ${row.reasonCode}`
                  : "",
              ].filter(Boolean);

              const metadataText = metadata
                ? Object.entries(metadata)
                    .slice(0, 4)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(" • ")
                : null;

              return (
                <li key={row.id} className="px-4 py-3">
                  <p className="text-xs text-slate-500">{formatDateTime(row.occurredAt, uiLocale)}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {t(uiLocale, "settings.auditLog.byPrefix")} {actorName}
                    {row.actorRoleSnapshot ? ` (${row.actorRoleSnapshot})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {detailBits.join(" • ")} • {t(uiLocale, "settings.auditLog.resultPrefix")}{" "}
                    {row.result}
                  </p>
                  {metadataText ? <p className="mt-1 text-xs text-slate-500">{metadataText}</p> : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          {cursorAt ? (
            <Link
              href={buildHref("/settings/audit-log", baseParams)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
            >
              {t(uiLocale, "settings.auditLog.pagination.backToLatest")}
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-slate-300">
              {t(uiLocale, "settings.auditLog.pagination.atLatest")}
            </span>
          )}

          {hasMore && nextCursor ? (
            <Link
              href={buildHref("/settings/audit-log", nextParams)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600"
            >
              {t(uiLocale, "settings.auditLog.pagination.loadMore")}
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-slate-300">
              {t(uiLocale, "settings.auditLog.pagination.noMore")}
            </span>
          )}
        </div>
      </article>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "common.backToSettings")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "common.backToSettings.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings/stores"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ClipboardList className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.link.switchStore.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.link.switchStore.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
