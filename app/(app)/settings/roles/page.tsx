import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { ChevronRight, Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { db } from "@/lib/db/client";
import { roles, storeMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";

function RolesListFallback() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, index) => (
          <li key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function RolesList({
  storeId,
  canManage,
  uiLocale,
}: {
  storeId: string;
  canManage: boolean;
  uiLocale: UiLocale;
}) {
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const roleRows = await db
    .select({
      id: roles.id,
      name: roles.name,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
    })
    .from(roles)
    .where(eq(roles.storeId, storeId))
    .orderBy(asc(roles.name));

  const memberCountRows = await db
    .select({
      roleId: storeMembers.roleId,
      count: sql<number>`count(*)`,
    })
    .from(storeMembers)
    .where(eq(storeMembers.storeId, storeId))
    .groupBy(storeMembers.roleId);

  const memberCountMap = new Map(memberCountRows.map((row) => [row.roleId, Number(row.count)]));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {roleRows.map((role) => {
          const locked = Boolean(role.isSystem) && role.name === "Owner";
          const memberCount = memberCountMap.get(role.id) ?? 0;
          const memberCountLabel = `${t(uiLocale, "settings.roles.memberCount.prefix")} ${memberCount.toLocaleString(numberLocale)} ${t(uiLocale, "settings.roles.memberCount.suffix")}`
            .replace(/\s+/g, " ")
            .trim();

          return (
            <li key={role.id}>
              <Link
                href={`/settings/roles/${role.id}`}
                className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Shield className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{role.name}</p>
                  <p className="text-xs text-slate-500">{memberCountLabel}</p>
                  {locked ? (
                    <p className="mt-0.5 text-xs text-amber-700">
                      {t(uiLocale, "settings.roles.badge.systemLocked")}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <span className="text-xs font-medium text-blue-700">
                    {t(uiLocale, "settings.roles.badge.canEdit")}
                  </span>
                ) : null}
                {!canManage ? (
                  <span className="text-xs font-medium text-slate-500">
                    {t(uiLocale, "settings.permission.viewOnly")}
                  </span>
                ) : null}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function SettingsRolesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canView = isPermissionGranted(permissionKeys, "rbac.roles.view");
  const canManage = isPermissionGranted(permissionKeys, "rbac.roles.update");
  const uiLocale = session.uiLocale;

  if (!canView) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.roles.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1 px-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
          {t(uiLocale, "settings.link.roles.title")}
        </h1>
        <p className="text-sm text-slate-500">{t(uiLocale, "settings.link.roles.description")}</p>
      </header>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t(uiLocale, "settings.roles.section.list")}
        </p>
      </div>
      <Suspense fallback={<RolesListFallback />}>
        <RolesList storeId={session.activeStoreId} canManage={canManage} uiLocale={uiLocale} />
      </Suspense>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Shield className="h-4 w-4" />
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
        </div>
      </div>
    </section>
  );
}
