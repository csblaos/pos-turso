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
import { ChevronRight, ClipboardList, Search, Settings2 } from "lucide-react";
import { redirect } from "next/navigation";

import { AuditLogDateRangeFields } from "@/components/app/audit-log-date-range-fields";
import { SettingsAuditLogHelpButton } from "@/components/app/settings-audit-log-help-button";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditEvents, stores, users } from "@/lib/db/schema";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { hasPermission } from "@/lib/rbac/access";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
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
    return localizeText(uiLocale, value ? "ใช่" : "ไม่ใช่", value ? "ແມ່ນ" : "ບໍ່ແມ່ນ", value ? "Yes" : "No");
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
      lines.push(`${getFieldLabel("source", uiLocale)}: ${localizeText(uiLocale, "ปรับเอง", "ແກ້ເອງ", "Manual")}`);
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

  if (action === "store.member.assign_role" || action === "store.member.set_status" || action === "store.member.set_session_limit") {
    const key = action === "store.member.assign_role" ? "roleName" : action === "store.member.set_status" ? "status" : "sessionLimit";
    const changeLine = formatChangeLine(
      getFieldLabel(key, uiLocale),
      before?.[key],
      after?.[key],
      uiLocale,
    );
    if (changeLine) lines.push(changeLine);
    return lines;
  }

  if (action === "store.member.set_branch_access") {
    const beforeMode = getString(before, "mode", uiLocale);
    const afterMode = getString(after, "mode", uiLocale);
    const modeLine = formatChangeLine(
      localizeText(uiLocale, "การเข้าถึงสาขา", "ການເຂົ້າເຖິງສາຂາ", "Branch access"),
      beforeMode,
      afterMode,
      uiLocale,
    );
    if (modeLine) lines.push(modeLine);
    const branchIds = Array.isArray(after?.branchIds) ? after?.branchIds : [];
    if (branchIds.length > 0) {
      lines.push(
        `${localizeText(uiLocale, "จำนวนสาขา", "ຈຳນວນສາຂາ", "Branches")}: ${branchIds.length.toLocaleString(uiLocaleToDateLocale(uiLocale))}`,
      );
    }
    return lines;
  }

  if (action === "store.member.reset_password") {
    lines.push(localizeText(uiLocale, "รีเซ็ตรหัสผ่านและบังคับเปลี่ยนครั้งถัดไป", "ຣີເຊັດລະຫັດຜ່ານ ແລະ ບັງຄັບປ່ຽນໃນຄັ້ງຖັດໄປ", "Password reset and forced change on next login"));
    return lines;
  }

  if (action === "account.profile.update" || action === "account.locale.update") {
    const key = action === "account.profile.update" ? "name" : "uiLocale";
    const changeLine = formatChangeLine(
      action === "account.profile.update"
        ? localizeText(uiLocale, "ชื่อที่แสดง", "ຊື່ສະແດງ", "Display name")
        : localizeText(uiLocale, "ภาษา", "ພາສາ", "Language"),
      before?.[key],
      after?.[key],
      uiLocale,
    );
    if (changeLine) lines.push(changeLine);
    return lines;
  }

  if (action === "account.password.change") {
    lines.push(localizeText(uiLocale, "เปลี่ยนรหัสผ่านสำเร็จ", "ປ່ຽນລະຫັດຜ່ານສຳເລັດ", "Password changed successfully"));
    return lines;
  }

  if (
    action === "store.payment_account.create" ||
    action === "store.payment_account.update" ||
    action === "store.payment_account.delete"
  ) {
    const bankName = getString(after, "bankName", uiLocale) ?? getString(before, "bankName", uiLocale) ?? getString(metadata, "bankName", uiLocale);
    if (bankName) lines.push(`${getFieldLabel("bankName", uiLocale)}: ${bankName}`);
    const currency = getString(after, "currency", uiLocale) ?? getString(before, "currency", uiLocale) ?? getString(metadata, "currency", uiLocale);
    if (currency) lines.push(`${getFieldLabel("currency", uiLocale)}: ${currency}`);
    const defaultLine = formatChangeLine(
      localizeText(uiLocale, "บัญชีหลัก", "ບັນຊີຫຼັກ", "Default account"),
      before?.isDefault,
      after?.isDefault ?? metadata?.isDefault,
      uiLocale,
    );
    if (defaultLine) lines.push(defaultLine);
    return lines;
  }

  if (action === "order.update_shipping") {
    const shippingProvider = getString(metadata, "shippingProvider", uiLocale);
    if (shippingProvider) lines.push(`${getFieldLabel("shippingProvider", uiLocale)}: ${shippingProvider}`);
    const trackingNo = getString(metadata, "trackingNo", uiLocale);
    if (trackingNo) lines.push(`${getFieldLabel("trackingNo", uiLocale)}: ${trackingNo}`);
    return lines;
  }

  if (action === "order.submit_payment_slip") {
    const orderStatus = getString(metadata, "status", uiLocale);
    if (orderStatus) lines.push(`${getFieldLabel("status", uiLocale)}: ${orderStatus}`);
    return lines;
  }

  if (action === "order.confirm_paid" || action === "order.confirm_paid.bulk_cod_reconcile") {
    const paymentLine = formatChangeLine(
      localizeText(uiLocale, "สถานะการชำระ", "ສະຖານະການຊຳລະ", "Payment status"),
      metadata?.fromPaymentStatus ?? before?.paymentStatus,
      metadata?.toPaymentStatus ?? after?.paymentStatus,
      uiLocale,
    );
    if (paymentLine) lines.push(paymentLine);
    return lines;
  }

  const changedLines: string[] = [];
  if (before || after) {
    const keys = Array.from(new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]));
    for (const key of keys) {
      const line = formatChangeLine(getFieldLabel(key, uiLocale), before?.[key], after?.[key], uiLocale);
      if (line) changedLines.push(line);
      if (changedLines.length >= 3) break;
    }
  }

  if (changedLines.length > 0) {
    return changedLines;
  }

  const fallbackLines: string[] = [];
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (key === "message") continue;
      const text = toSimpleString(value, uiLocale);
      if (!text) continue;
      fallbackLines.push(`${getFieldLabel(key, uiLocale)}: ${text}`);
      if (fallbackLines.length >= 3) break;
    }
  }

  return fallbackLines;
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
  "order.create_shipping_label",
  "order.confirm_paid.bulk_cod_reconcile",
  "stock.movement.create",
  "po.create",
  "po.update",
  "po.status.change",
  "po.exchange_rate.lock",
  "po.payment.settle",
  "po.extra_cost.apply",
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
  "product.cost.manual_update",
  "product.cost.auto_from_po",
  "account.profile.update",
  "account.locale.update",
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
        before: auditEvents.before,
        after: auditEvents.after,
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
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-semibold text-slate-900">
              {t(uiLocale, "settings.link.auditLog.title")}
            </p>
            <p className="text-sm text-slate-500">
              {t(uiLocale, "settings.auditLog.page.descriptionPrefix")} {storeRow?.name ?? "-"}{" "}
              {t(uiLocale, "settings.auditLog.page.descriptionSuffix")}
            </p>
          </div>

          <div className="shrink-0">
            <SettingsAuditLogHelpButton uiLocale={uiLocale} />
          </div>
        </div>

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
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600 lg:col-span-2">
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

            <AuditLogDateRangeFields
              uiLocale={uiLocale}
              fromValue={fromDate}
              toValue={toDate}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-white"
            >
              {t(uiLocale, "settings.auditLog.action.search")}
            </button>
            <Link
              href="/settings/audit-log"
              className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-sm text-slate-600"
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
              const beforeState = parseJsonText(row.before);
              const afterState = parseJsonText(row.after);
              const actorName =
                row.actorNameSnapshot ?? row.actorName ?? t(uiLocale, "common.actor.system");
              const title = actionLabelMap[row.action] ?? row.action;
              const detailBits = [
                getAuditReference(row.entityType, row.entityId, metadata, beforeState, afterState, uiLocale),
                `${t(uiLocale, "settings.auditLog.resultPrefix")} ${
                  row.result === "SUCCESS"
                    ? t(uiLocale, "common.result.success")
                    : t(uiLocale, "common.result.fail")
                }`,
                row.reasonCode
                  ? `${t(uiLocale, "settings.auditLog.reasonPrefix")} ${row.reasonCode}`
                  : "",
              ].filter(Boolean);
              const detailLines = buildAuditDetailLines({
                action: row.action,
                metadata,
                before: beforeState,
                after: afterState,
                uiLocale,
              });

              return (
                <li key={row.id} className="px-4 py-3">
                  <p className="text-xs text-slate-500">{formatDateTime(row.occurredAt, uiLocale)}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {t(uiLocale, "settings.auditLog.byPrefix")} {actorName}
                    {row.actorRoleSnapshot ? ` (${row.actorRoleSnapshot})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {detailBits.join(" • ")}
                  </p>
                  {detailLines.map((line) => (
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
              href={buildHref("/settings/audit-log", baseParams)}
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
              href={buildHref("/settings/audit-log", nextParams)}
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

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
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
