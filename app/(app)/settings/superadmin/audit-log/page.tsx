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
import { Search, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { AuditLogDateRangeFields } from "@/components/app/audit-log-date-range-fields";
import { SuperadminAuditLogHelpButton } from "@/components/app/superadmin-audit-log-help-button";
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
type ParsedAuditObject = Record<string, unknown> | null;

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

const localizeText = (uiLocale: UiLocale, th: string, lo: string, en: string) =>
  uiLocale === "lo" ? lo : uiLocale === "en" ? en : th;

const toSimpleString = (value: unknown, uiLocale: UiLocale): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value.toLocaleString(uiLocaleToDateLocale(uiLocale));
  }

  if (typeof value === "boolean") {
    return localizeText(
      uiLocale,
      value ? "ใช่" : "ไม่ใช่",
      value ? "ແມ່ນ" : "ບໍ່ແມ່ນ",
      value ? "Yes" : "No",
    );
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => toSimpleString(item, uiLocale))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(", ") : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return null;
    }
    return trimmed;
  }

  return null;
};

const getString = (record: ParsedAuditObject, key: string, uiLocale: UiLocale) =>
  toSimpleString(record?.[key], uiLocale);

const getFieldLabel = (key: string, uiLocale: UiLocale) => {
  const labelMap: Record<string, string> = {
    productName: localizeText(uiLocale, "สินค้า", "ສິນຄ້າ", "Product"),
    poNumber: localizeText(uiLocale, "เลขที่เอกสาร", "ເລກທີເອກະສານ", "Document no."),
    orderNo: localizeText(uiLocale, "เลขที่ออเดอร์", "ເລກທີອໍເດີ", "Order no."),
    displayName: localizeText(uiLocale, "ชื่อที่แสดง", "ຊື່ສະແດງ", "Display name"),
    bankName: localizeText(uiLocale, "ธนาคาร", "ທະນາຄານ", "Bank"),
    accountName: localizeText(uiLocale, "ชื่อเจ้าของบัญชี", "ຊື່ເຈົ້າຂອງບັນຊີ", "Account name"),
    accountNumberMasked: localizeText(uiLocale, "เลขบัญชี", "ເລກບັນຊີ", "Account number"),
    currency: localizeText(uiLocale, "สกุลเงิน", "ສະກຸນເງິນ", "Currency"),
    status: localizeText(uiLocale, "สถานะ", "ສະຖານະ", "Status"),
    roleName: localizeText(uiLocale, "บทบาท", "ບົດບາດ", "Role"),
    sessionLimit: localizeText(uiLocale, "Session limit", "Session limit", "Session limit"),
    movementType: localizeText(uiLocale, "ประเภทสต็อก", "ປະເພດສະຕັອກ", "Movement type"),
    qty: localizeText(uiLocale, "จำนวน", "ຈຳນວນ", "Quantity"),
    source: localizeText(uiLocale, "ที่มา", "ທີ່ມາ", "Source"),
    reason: localizeText(uiLocale, "หมายเหตุ", "ໝາຍເຫດ", "Note"),
    note: localizeText(uiLocale, "หมายเหตุ", "ໝາຍເຫດ", "Note"),
    updatedFields: localizeText(uiLocale, "ฟิลด์ที่แก้ไข", "ຟິວທີ່ແກ້", "Updated fields"),
    shippingProvider: localizeText(uiLocale, "ขนส่ง", "ຂົນສົ່ງ", "Shipping provider"),
    trackingNo: localizeText(uiLocale, "เลขติดตาม", "ເລກຕິດຕາມ", "Tracking no."),
    paymentReference: localizeText(uiLocale, "อ้างอิงการชำระ", "ອ້າງອີງການຊຳລະ", "Payment reference"),
    paidAt: localizeText(uiLocale, "วันที่ชำระ", "ວັນທີຊຳລະ", "Paid at"),
  };

  return labelMap[key] ?? key;
};

const formatChangeLine = (
  label: string,
  beforeValue: unknown,
  afterValue: unknown,
  uiLocale: UiLocale,
) => {
  const beforeText = toSimpleString(beforeValue, uiLocale);
  const afterText = toSimpleString(afterValue, uiLocale);
  if (!beforeText && !afterText) {
    return null;
  }

  if (beforeText && afterText && beforeText !== afterText) {
    return `${label}: ${beforeText} -> ${afterText}`;
  }

  return `${label}: ${afterText ?? beforeText}`;
};

const getAuditReference = (
  entityType: string,
  entityId: string | null,
  metadata: ParsedAuditObject,
  before: ParsedAuditObject,
  after: ParsedAuditObject,
  uiLocale: UiLocale,
) => {
  return (
    getString(metadata, "productName", uiLocale) ??
    getString(metadata, "poNumber", uiLocale) ??
    getString(metadata, "orderNo", uiLocale) ??
    getString(metadata, "displayName", uiLocale) ??
    getString(after, "displayName", uiLocale) ??
    getString(before, "displayName", uiLocale) ??
    getString(after, "name", uiLocale) ??
    getString(before, "name", uiLocale) ??
    (entityId
      ? `${localizeText(uiLocale, "รายการ", "ລາຍການ", "Record")} ${entityId.slice(0, 8)}`
      : localizeText(uiLocale, entityType, entityType, entityType))
  );
};

const buildAuditDetailLines = (params: {
  action: string;
  metadata: ParsedAuditObject;
  before: ParsedAuditObject;
  after: ParsedAuditObject;
  uiLocale: UiLocale;
}) => {
  const { action, metadata, before, after, uiLocale } = params;
  const lines: string[] = [];

  if (action === "product.cost.manual_update" || action === "product.cost.auto_from_po") {
    const costLine = formatChangeLine(
      localizeText(uiLocale, "ต้นทุน", "ຕົ້ນທຶນ", "Cost"),
      metadata?.previousCostBase ?? before?.costBase,
      metadata?.nextCostBase ?? after?.costBase,
      uiLocale,
    );
    if (costLine) lines.push(costLine);

    const source = getString(metadata, "source", uiLocale);
    if (source === "MANUAL") {
      lines.push(
        `${getFieldLabel("source", uiLocale)}: ${localizeText(
          uiLocale,
          "ปรับเอง",
          "ແກ້ເອງ",
          "Manual",
        )}`,
      );
    } else if (source === "PURCHASE_ORDER") {
      const poNumber = getString(metadata, "poNumber", uiLocale);
      lines.push(
        `${getFieldLabel("source", uiLocale)}: ${
          poNumber
            ? `${localizeText(uiLocale, "ใบสั่งซื้อ", "ໃບສັ່ງຊື້", "Purchase order")} ${poNumber}`
            : localizeText(uiLocale, "ใบสั่งซื้อ", "ໃບສັ່ງຊື້", "Purchase order")
        }`,
      );
    }

    const note = getString(metadata, "reason", uiLocale) ?? getString(metadata, "note", uiLocale);
    if (note) lines.push(`${localizeText(uiLocale, "หมายเหตุ", "ໝາຍເຫດ", "Note")}: ${note}`);
    return lines;
  }

  if (action === "po.exchange_rate.lock") {
    const rateLine = formatChangeLine(
      localizeText(uiLocale, "เรท", "ເຣດ", "Rate"),
      metadata?.previousRate,
      metadata?.nextRate,
      uiLocale,
    );
    if (rateLine) lines.push(rateLine);
    const note = getString(metadata, "note", uiLocale);
    if (note) lines.push(`${localizeText(uiLocale, "หมายเหตุ", "ໝາຍເຫດ", "Note")}: ${note}`);
    return lines;
  }

  if (action === "po.status.change") {
    const statusLine = formatChangeLine(
      getFieldLabel("status", uiLocale),
      before?.status,
      after?.status ?? metadata?.status,
      uiLocale,
    );
    if (statusLine) lines.push(statusLine);
    return lines;
  }

  if (
    action === "store.member.assign_role" ||
    action === "store.member.set_status" ||
    action === "store.member.set_session_limit"
  ) {
    const key =
      action === "store.member.assign_role"
        ? "roleName"
        : action === "store.member.set_status"
          ? "status"
          : "sessionLimit";
    const changeLine = formatChangeLine(
      getFieldLabel(key, uiLocale),
      before?.[key],
      after?.[key],
      uiLocale,
    );
    if (changeLine) lines.push(changeLine);
    return lines;
  }

  if (action === "order.update_shipping") {
    const shippingLine = formatChangeLine(
      getFieldLabel("shippingProvider", uiLocale),
      before?.shippingProvider,
      after?.shippingProvider,
      uiLocale,
    );
    if (shippingLine) lines.push(shippingLine);
    const trackingLine = formatChangeLine(
      getFieldLabel("trackingNo", uiLocale),
      before?.trackingNo,
      after?.trackingNo,
      uiLocale,
    );
    if (trackingLine) lines.push(trackingLine);
    return lines;
  }

  // Fallback: show a few meaningful metadata fields.
  if (metadata) {
    for (const [key, raw] of Object.entries(metadata).slice(0, 4)) {
      const value = toSimpleString(raw, uiLocale);
      if (!value) continue;
      lines.push(`${getFieldLabel(key, uiLocale)}: ${value}`);
    }
  }

  return lines;
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
        before: auditEvents.before,
        after: auditEvents.after,
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
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.auditLog.title")}
          </h1>
        </div>

        <div className="shrink-0">
          <SuperadminAuditLogHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form className="border-b border-slate-100 px-4 py-4" method="GET">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-600">
              {t(uiLocale, "settings.auditLog.filter.q.label")}
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder={t(uiLocale, "settings.auditLog.filter.q.placeholder")}
                  className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-900 outline-none ring-primary focus:ring-2"
                />
              </div>
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

            <label className="space-y-1 text-xs text-slate-600 lg:col-span-2">
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

            <AuditLogDateRangeFields
              uiLocale={uiLocale}
              fromValue={fromDate}
              toValue={toDate}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-white"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {t(uiLocale, "settings.auditLog.action.search")}
            </button>
            <Link
              href="/settings/superadmin/audit-log"
              className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-sm text-slate-600"
            >
              {t(uiLocale, "settings.auditLog.action.clearFilters")}
            </Link>
            <p className="ml-auto text-xs text-slate-500">
              {t(uiLocale, "settings.auditLog.perPage.prefix")}{" "}
              {rows.length.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "settings.auditLog.perPage.suffix")}
            </p>
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">{t(uiLocale, "settings.auditLog.empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const metadata = parseJsonText(row.metadata);
              const beforeState = parseJsonText(row.before);
              const afterState = parseJsonText(row.after);
              const actorName = row.actorNameSnapshot ?? row.actorName ?? t(uiLocale, "common.actor.system");
              const title = actionLabelMap[row.action] ? t(uiLocale, actionLabelMap[row.action]) : row.action;
              const detailBits = [
                getAuditReference(row.entityType, row.entityId, metadata, beforeState, afterState, uiLocale),
                row.reasonCode ? `${t(uiLocale, "settings.auditLog.reasonPrefix")} ${row.reasonCode}` : "",
              ].filter(Boolean);
              const scopeLabel =
                row.scope === "SYSTEM"
                  ? t(uiLocale, "superadmin.auditLog.scopeLabel.SYSTEM")
                  : t(uiLocale, "superadmin.auditLog.scopeLabel.STORE");
              const storeLabel =
                row.storeName ?? t(uiLocale, "superadmin.auditLog.detail.systemLabel");

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
                  {buildAuditDetailLines({
                    action: row.action,
                    metadata,
                    before: beforeState,
                    after: afterState,
                    uiLocale,
                  }).map((line) => (
                    <p key={line} className="mt-1 text-xs text-slate-500">
                      {line}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          {cursorAt ? (
            <Link
              href={buildHref("/settings/superadmin/audit-log", baseParams)}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-600"
            >
              {t(uiLocale, "settings.auditLog.pagination.backToLatest")}
            </Link>
          ) : (
            <span className="rounded-full border border-slate-100 px-4 py-1.5 text-slate-300">
              {t(uiLocale, "settings.auditLog.pagination.atLatest")}
            </span>
          )}

          {hasMore && nextCursor ? (
            <Link
              href={buildHref("/settings/superadmin/audit-log", nextParams)}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-600"
            >
              {t(uiLocale, "settings.auditLog.pagination.loadMore")}
            </Link>
          ) : (
            <span className="rounded-full border border-slate-100 px-4 py-1.5 text-slate-300">
              {t(uiLocale, "settings.auditLog.pagination.noMore")}
            </span>
          )}
        </div>
      </article>

    </section>
  );
}
