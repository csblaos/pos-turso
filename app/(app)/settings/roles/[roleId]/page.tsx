import dynamic from "next/dynamic";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ChevronRight, Shield } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { permissions, rolePermissions, roles } from "@/lib/db/schema";
import { timeDbQuery, startServerRenderTimer } from "@/lib/perf/server";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { getPermissionCatalog } from "@/lib/rbac/queries";
import { t } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";
import { RolePermissionsEditorLoading } from "@/components/app/role-permissions-editor-loading";

const RolePermissionsEditor = dynamic(
  () =>
    import("@/components/app/role-permissions-editor").then(
      (module) => module.RolePermissionsEditor,
    ),
  {
    loading: () => <RolePermissionsEditorLoading />,
  },
);

function RoleDetailContentFallback() {
  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="hidden sm:block">
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-11 w-full animate-pulse rounded-full bg-slate-100 sm:w-48" />
          </div>
        </div>
      </article>

      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100 px-1" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

async function RoleDetailContent({
  roleId,
  storeId,
  canManage,
  uiLocale,
}: {
  roleId: string;
  storeId: string;
  canManage: boolean;
  uiLocale: UiLocale;
}) {
  const [role] = await timeDbQuery("roles.detail.role", async () =>
    db
      .select({
        id: roles.id,
        name: roles.name,
        isSystem: roles.isSystem,
      })
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.storeId, storeId)))
      .limit(1),
  );

  if (!role) {
    notFound();
  }

  const [allPermissions, assigned] = await Promise.all([
    getPermissionCatalog(),
    timeDbQuery("roles.detail.assignedPermissions", async () =>
      db
        .select({
          key: permissions.key,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id)),
    ),
  ]);

  const assignedPermissionKeys = assigned.map((permission) => permission.key);

  return (
    <>
      <RolePermissionsEditor
        roleId={role.id}
        roleName={role.name}
        locked={Boolean(role.isSystem) && role.name === "Owner"}
        canManage={canManage}
        permissions={allPermissions}
        assignedPermissionKeys={assignedPermissionKeys}
        uiLocale={uiLocale}
      />

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings/roles"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Shield className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.roles.nav.backToRoles.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.roles.nav.backToRoles.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </>
  );
}

export default async function SettingsRoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const finishRenderTimer = startServerRenderTimer("page.settings.roles.detail");

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    const storeId = session.activeStoreId;
    if (!storeId) {
      redirect("/onboarding");
    }

    const permissionKeys = await getUserPermissionsForCurrentSession();
    const canView = isPermissionGranted(permissionKeys, "rbac.roles.view");
    const canManage = isPermissionGranted(permissionKeys, "rbac.roles.update");
    const uiLocale = session.uiLocale;

    if (!canView) {
      return (
        <section className="space-y-3">
          <h1 className="text-xl font-semibold">{t(uiLocale, "settings.roles.detail.noAccessTitle")}</h1>
          <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
          <Link
            href="/settings/roles"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {t(uiLocale, "settings.roles.nav.backToRoles.title")}
          </Link>
        </section>
      );
    }

    const { roleId } = await params;

    return (
      <section className="space-y-5">
        <Suspense fallback={<RoleDetailContentFallback />}>
          <RoleDetailContent
            roleId={roleId}
            storeId={storeId}
            canManage={canManage}
            uiLocale={uiLocale}
          />
        </Suspense>
      </section>
    );
  } finally {
    finishRenderTimer();
  }
}
