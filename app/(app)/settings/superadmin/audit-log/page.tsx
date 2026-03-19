import Link from "next/link";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  like,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { ChevronRight, ClipboardList, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { getUserSystemRole } from "@/lib/auth/system-admin";
import { db } from "@/lib/db/client";
import { auditEvents, roles, storeMembers, stores, users } from "@/lib/db/schema";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";

type SearchParams = Record<string, string | string[] | undefined>;

type ScopeFilter = "ALL" | "STORE" | "SYSTEM";
type ResultFilter = "ALL" | "SUCCESS" | "FAIL";

const PAGE_SIZE = 30;

const getParam = (params: SearchParams, key: string) => {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

const parseScope = (value: string, canViewSystem: boolean): ScopeFilter => {
  if (value === "STORE") return "STORE";
  if (value === "SYSTEM") return canViewSystem ? "SYSTEM" : "STORE";
  return canViewSystem ? "ALL" : "STORE";
};

const parseResult = (value: string): ResultFilter => {
  if (value === "SUCCESS") return "SUCCESS";
  if (value === "FAIL") return "FAIL";
  return "ALL";
};

const formatDateTime = (locale: UiLocale, value: string) => {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(uiLocaleToDateLocale(locale), {
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

const actionFilterOptions = [
  { value: "", labelKey: "common.filter.all" },
  { value: "order.create", labelKey: "settings.auditLog.actionLabel.order.create" },
  { value: "order.update_shipping", labelKey: "settings.auditLog.actionLabel.order.update_shipping" },
  { value: "order.submit_for_payment", labelKey: "settings.auditLog.actionLabel.order.submit_for_payment" },
  { value: "order.submit_payment_slip", labelKey: "settings.auditLog.actionLabel.order.submit_payment_slip" },
  { value: "order.confirm_paid", labelKey: "settings.auditLog.actionLabel.order.confirm_paid" },
  { value: "order.mark_packed", labelKey: "settings.auditLog.actionLabel.order.mark_packed" },
  { value: "order.mark_shipped", labelKey: "settings.auditLog.actionLabel.order.mark_shipped" },
  { value: "order.cancel", labelKey: "settings.auditLog.actionLabel.order.cancel" },
  { value: "stock.movement.create", labelKey: "settings.auditLog.actionLabel.stock.movement.create" },
  { value: "po.create", labelKey: "settings.auditLog.actionLabel.po.create" },
  { value: "po.update", labelKey: "settings.auditLog.actionLabel.po.update" },
  { value: "po.status.change", labelKey: "settings.auditLog.actionLabel.po.status.change" },
  { value: "store.settings.update", labelKey: "settings.auditLog.actionLabel.store.settings.update" },
  { value: "store.settings.pdf.update", labelKey: "settings.auditLog.actionLabel.store.settings.pdf.update" },
  { value: "store.payment_account.create", labelKey: "settings.auditLog.actionLabel.store.payment_account.create" },
  { value: "store.payment_account.update", labelKey: "settings.auditLog.actionLabel.store.payment_account.update" },
  { value: "store.payment_account.delete", labelKey: "settings.auditLog.actionLabel.store.payment_account.delete" },
  { value: "store.member.create_new", labelKey: "settings.auditLog.actionLabel.store.member.create_new" },
  { value: "store.member.add_existing", labelKey: "settings.auditLog.actionLabel.store.member.add_existing" },
  { value: "store.member.create", labelKey: "settings.auditLog.actionLabel.store.member.create" },
  { value: "store.member.update", labelKey: "settings.auditLog.actionLabel.store.member.update" },
  { value: "store.member.assign_role", labelKey: "settings.auditLog.actionLabel.store.member.assign_role" },
  { value: "store.member.set_status", labelKey: "settings.auditLog.actionLabel.store.member.set_status" },
  { value: "store.member.set_session_limit", labelKey: "settings.auditLog.actionLabel.store.member.set_session_limit" },
  { value: "store.member.set_branch_access", labelKey: "settings.auditLog.actionLabel.store.member.set_branch_access" },
  { value: "store.member.reset_password", labelKey: "settings.auditLog.actionLabel.store.member.reset_password" },
  { value: "store.role.permissions.update", labelKey: "settings.auditLog.actionLabel.store.role.permissions.update" },
  { value: "account.profile.update", labelKey: "settings.auditLog.actionLabel.account.profile.update" },
  { value: "account.password.change", labelKey: "settings.auditLog.actionLabel.account.password.change" },
  { value: "account.settings.update", labelKey: "settings.auditLog.actionLabel.account.settings.update" },
  { value: "system.payment_policy.update", labelKey: "settings.auditLog.actionLabel.system.payment_policy.update" },
  { value: "system.session_policy.update", labelKey: "settings.auditLog.actionLabel.system.session_policy.update" },
  { value: "system.branch_policy.update", labelKey: "settings.auditLog.actionLabel.system.branch_policy.update" },
  { value: "system.store_logo_policy.update", labelKey: "settings.auditLog.actionLabel.system.store_logo_policy.update" },
] as const;

const actionLabelMap: Record<string, MessageKey> = Object.fromEntries(
  actionFilterOptions
    .filter((option) => option.value.length > 0)
    .map((option) => [option.value, option.labelKey]),
) as Record<string, MessageKey>;

const buildHref = (basePath: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
};

export default async function SettingsSuperadminAuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const uiLocale = session.uiLocale;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const [memberships, systemRole, rawParams] = await Promise.all([
    listActiveMemberships(session.userId),
    getUserSystemRole(session.userId),
    searchParams,
  ]);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const membershipStoreIds = memberships.map((membership) => membership.storeId);
  const canViewSystem = systemRole === "SYSTEM_ADMIN";
  const params = rawParams ?? {};

  const creatorOwnedStoreRows = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .innerJoin(roles, eq(storeMembers.roleId, roles.id))
    .where(
      and(
        eq(storeMembers.userId, session.userId),
        eq(storeMembers.status, "ACTIVE"),
        eq(roles.name, "Owner"),
        eq(storeMembers.addedBy, session.userId),
      ),
    );

  const creatorOwnedStoreIdSet = new Set(creatorOwnedStoreRows.map((row) => row.storeId));
  let visibleStoreIds = membershipStoreIds;
  if (!canViewSystem) {
    const creatorOwnedStoreIds = membershipStoreIds.filter((storeId) =>
      creatorOwnedStoreIdSet.has(storeId),
    );
    if (creatorOwnedStoreIds.length > 0) {
      visibleStoreIds = creatorOwnedStoreIds;
    } else {
      // Fallback สำหรับข้อมูลเก่าที่ยังไม่มี added_by: ให้เห็นเฉพาะร้านที่ยังเป็น Owner
      visibleStoreIds = memberships
        .filter((membership) => membership.roleName === "Owner")
        .map((membership) => membership.storeId);
    }
  }

  const q = getParam(params, "q").trim();
  const action = getParam(params, "action").trim();
  const actionLike = getParam(params, "actionLike").trim();
  const selectedStoreIdRaw = getParam(params, "storeId").trim();
  const selectedStoreId = visibleStoreIds.includes(selectedStoreIdRaw) ? selectedStoreIdRaw : "";
  const scope = parseScope(getParam(params, "scope"), canViewSystem);
  const result = parseResult(getParam(params, "result"));
  const fromDate = getParam(params, "from").trim();
  const toDate = getParam(params, "to").trim();
  const cursorAtRaw = getParam(params, "cursorAt").trim();
  const cursorIdRaw = getParam(params, "cursorId").trim();
  const cursorAt =
    cursorAtRaw.length > 0 && !Number.isNaN(Date.parse(cursorAtRaw)) ? cursorAtRaw : "";
  const cursorId = cursorAt && cursorIdRaw ? cursorIdRaw : "";

  const actorUsers = alias(users, "actor_users");

  const whereClauses = [];

  if (!canViewSystem) {
    whereClauses.push(eq(auditEvents.scope, "STORE"));
    if (visibleStoreIds.length > 0) {
      whereClauses.push(inArray(auditEvents.storeId, visibleStoreIds));
    } else {
      whereClauses.push(sql`1 = 0`);
    }
  }

  if (canViewSystem && (scope === "STORE" || scope === "SYSTEM")) {
    whereClauses.push(eq(auditEvents.scope, scope));
  }

  if (selectedStoreId) {
    whereClauses.push(eq(auditEvents.storeId, selectedStoreId));
  }

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

  const whereCondition = whereClauses.length > 0 ? and(...whereClauses) : undefined;

  const [storeOptions, rowsWithExtra] = await Promise.all([
    canViewSystem
      ? db
          .select({ id: stores.id, name: stores.name })
          .from(stores)
          .orderBy(stores.name)
          .limit(200)
      : visibleStoreIds.length === 0
        ? Promise.resolve([])
        : db
            .select({ id: stores.id, name: stores.name })
            .from(stores)
            .where(inArray(stores.id, visibleStoreIds))
            .orderBy(stores.name),
    db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        scope: auditEvents.scope,
        storeId: auditEvents.storeId,
        storeName: stores.name,
        actorUserId: auditEvents.actorUserId,
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
      .leftJoin(stores, eq(auditEvents.storeId, stores.id))
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
  if (scope !== "ALL") baseParams.set("scope", scope);
  if (result !== "ALL") baseParams.set("result", result);
  if (selectedStoreId) baseParams.set("storeId", selectedStoreId);
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
          {t(uiLocale, "superadmin.auditLog.title")}
        </h1>
        <p className="text-sm text-slate-500">
          {t(uiLocale, "superadmin.auditLog.subtitle")}
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
                  {t(uiLocale, option.labelKey)}
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
            {t(uiLocale, "superadmin.auditLog.filter.scope.label")}
            {canViewSystem ? (
              <select
                name="scope"
                defaultValue={scope}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
              >
                <option value="ALL">{t(uiLocale, "superadmin.auditLog.filter.scope.all")}</option>
                <option value="STORE">{t(uiLocale, "superadmin.auditLog.filter.scope.store")}</option>
                <option value="SYSTEM">{t(uiLocale, "superadmin.auditLog.filter.scope.system")}</option>
              </select>
            ) : (
              <>
                <input type="hidden" name="scope" value="STORE" />
                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  {t(uiLocale, "superadmin.auditLog.filter.scope.storeOnly")}
                </div>
              </>
            )}
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
            {t(uiLocale, "superadmin.auditLog.filter.store.label")}
            <select
              name="storeId"
              defaultValue={selectedStoreId}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
            >
              <option value="">{t(uiLocale, "superadmin.auditLog.filter.store.all")}</option>
              {storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
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
            href="/settings/superadmin/audit-log"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
          >
            {t(uiLocale, "settings.auditLog.action.clearFilters")}
          </Link>
          <p className="ml-auto text-xs text-slate-500">
            {t(uiLocale, "settings.auditLog.perPage.prefix")} {rows.length.toLocaleString(numberLocale)}{" "}
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
              const actorName = row.actorNameSnapshot ?? row.actorName ?? t(uiLocale, "common.actor.system");
              const title = actionLabelMap[row.action] ? t(uiLocale, actionLabelMap[row.action]) : row.action;
              const detailBits = [
                `${row.entityType}${row.entityId ? `#${row.entityId}` : ""}`,
                row.reasonCode ? `${t(uiLocale, "settings.auditLog.reasonPrefix")} ${row.reasonCode}` : "",
              ].filter(Boolean);
              const scopeLabel =
                row.scope === "SYSTEM"
                  ? t(uiLocale, "superadmin.auditLog.scopeLabel.SYSTEM")
                  : t(uiLocale, "superadmin.auditLog.scopeLabel.STORE");
              const storeLabel =
                row.storeName ?? t(uiLocale, "superadmin.auditLog.detail.systemLabel");

              const metadataText = metadata
                ? Object.entries(metadata)
                    .slice(0, 4)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(" • ")
                : null;

              return (
                <li key={row.id} className="px-4 py-3">
                  <p className="text-xs text-slate-500">{formatDateTime(uiLocale, row.occurredAt)}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    [{scopeLabel}] {storeLabel} • {t(uiLocale, "settings.auditLog.byPrefix")} {actorName}
                    {row.actorRoleSnapshot ? ` (${row.actorRoleSnapshot})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {detailBits.join(" • ")} • {t(uiLocale, "settings.auditLog.resultPrefix")}{" "}
                    {row.result === "SUCCESS"
                      ? t(uiLocale, "common.result.success")
                      : t(uiLocale, "common.result.fail")}
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
              href={buildHref("/settings/superadmin/audit-log", baseParams)}
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
              href={buildHref("/settings/superadmin/audit-log", nextParams)}
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
          {t(uiLocale, "superadmin.auditLog.nav.section")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings/superadmin"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ClipboardList className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "superadmin.nav.backToCenter.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "superadmin.nav.backToCenter.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings/superadmin/quotas"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Store className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "superadmin.auditLog.nav.toQuotas.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "superadmin.auditLog.nav.toQuotas.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings/stores"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Store className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "superadmin.auditLog.nav.exitMode.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "superadmin.nav.exitMode.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
