import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminSecurityHelpButton } from "@/components/app/superadmin-security-help-button";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { db } from "@/lib/db/client";
import { fbConnections, storeMembers, stores, users, waConnections } from "@/lib/db/schema";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

const toNumber = (value: unknown) => Number(value ?? 0);

export default async function SettingsSuperadminSecurityPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const uiLocale = session.uiLocale;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const memberships = await listActiveMemberships(session.userId);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const storeIds = memberships.map((membership) => membership.storeId);

  const [
    mustChangePasswordTotalRows,
    invitedTotalRows,
    suspendedRows,
    elevatedRoleRows,
    fbErrorRows,
    waErrorRows,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`count(distinct ${users.id})` })
      .from(storeMembers)
      .innerJoin(users, eq(storeMembers.userId, users.id))
      .where(
        and(
          inArray(storeMembers.storeId, storeIds),
          eq(storeMembers.status, "ACTIVE"),
          eq(users.mustChangePassword, true),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)` })
      .from(storeMembers)
      .where(and(inArray(storeMembers.storeId, storeIds), eq(storeMembers.status, "INVITED"))),
    db
      .select({
        storeId: storeMembers.storeId,
        storeName: stores.name,
        count: sql<number>`count(*)`,
      })
      .from(storeMembers)
      .innerJoin(stores, eq(storeMembers.storeId, stores.id))
      .where(and(inArray(storeMembers.storeId, storeIds), eq(storeMembers.status, "SUSPENDED")))
      .groupBy(storeMembers.storeId, stores.name)
      .orderBy(desc(sql<number>`count(*)`)),
    db
      .select({
        userId: users.id,
        userName: users.name,
        email: users.email,
        systemRole: users.systemRole,
      })
      .from(storeMembers)
      .innerJoin(users, eq(storeMembers.userId, users.id))
      .where(
        and(
          inArray(storeMembers.storeId, storeIds),
          eq(storeMembers.status, "ACTIVE"),
          inArray(users.systemRole, ["SUPERADMIN", "SYSTEM_ADMIN"]),
        ),
      )
      .groupBy(users.id, users.name, users.email, users.systemRole)
      .orderBy(users.name)
      .limit(30),
    db
      .select({
        storeId: fbConnections.storeId,
        storeName: stores.name,
        pageName: fbConnections.pageName,
      })
      .from(fbConnections)
      .innerJoin(stores, eq(fbConnections.storeId, stores.id))
      .where(and(inArray(fbConnections.storeId, storeIds), eq(fbConnections.status, "ERROR")))
      .orderBy(stores.name),
    db
      .select({
        storeId: waConnections.storeId,
        storeName: stores.name,
        phoneNumber: waConnections.phoneNumber,
      })
      .from(waConnections)
      .innerJoin(stores, eq(waConnections.storeId, stores.id))
      .where(and(inArray(waConnections.storeId, storeIds), eq(waConnections.status, "ERROR")))
      .orderBy(stores.name),
  ]);

  const totalMustChangeUsers = toNumber(mustChangePasswordTotalRows[0]?.value);
  const totalInvitedRows = toNumber(invitedTotalRows[0]?.value);
  const totalSuspendedMembers = suspendedRows.reduce((sum, row) => sum + toNumber(row.count), 0);
  const channelErrorStoreIds = new Set([
    ...fbErrorRows.map((row) => row.storeId),
    ...waErrorRows.map((row) => row.storeId),
  ]);

  const riskItems: string[] = [];
  if (totalMustChangeUsers > 0) {
    riskItems.push(
      `${t(uiLocale, "superadmin.security.riskSignals.mustChangePrefix")} ${totalMustChangeUsers.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.security.riskSignals.mustChangeSuffix")}`,
    );
  }
  if (totalSuspendedMembers > 0) {
    riskItems.push(
      `${t(uiLocale, "superadmin.security.riskSignals.suspendedPrefix")} ${totalSuspendedMembers.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.security.riskSignals.suspendedSuffix")}`,
    );
  }
  if (totalInvitedRows > 0) {
    riskItems.push(
      `${t(uiLocale, "superadmin.security.riskSignals.invitedPrefix")} ${totalInvitedRows.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.security.riskSignals.invitedSuffix")}`,
    );
  }
  if (channelErrorStoreIds.size > 0) {
    riskItems.push(
      `${t(uiLocale, "superadmin.security.riskSignals.channelErrorsPrefix")} ${channelErrorStoreIds.size.toLocaleString(numberLocale)} ${t(uiLocale, "superadmin.security.riskSignals.channelErrorsSuffix")}`,
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.security.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminSecurityHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.security.card.mustChangePassword")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalMustChangeUsers.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.security.card.suspendedMembers")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalSuspendedMembers.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.security.card.pendingInvites")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalInvitedRows.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.security.card.channelErrors")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {channelErrorStoreIds.size.toLocaleString(numberLocale)}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.security.riskSignals.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.security.riskSignals.subtitle")}
          </p>
        </div>
        {riskItems.length === 0 ? (
          <p className="px-4 py-4 text-sm text-emerald-700">
            {t(uiLocale, "superadmin.security.riskSignals.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {riskItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-slate-700">{item}</p>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.security.elevated.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.security.elevated.subtitle")}
          </p>
        </div>
        {elevatedRoleRows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            {t(uiLocale, "superadmin.security.elevated.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {elevatedRoleRows.map((row) => (
              <li key={row.userId} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{row.userName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.email} • {row.systemRole}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>

    </section>
  );
}
