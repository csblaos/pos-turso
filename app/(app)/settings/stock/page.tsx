import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
import { redirect } from "next/navigation";

import { StoreInventorySettings } from "@/components/app/store-inventory-settings";
import { getSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";

export default async function SettingsStockPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canView = isPermissionGranted(permissionKeys, "settings.view");
  const canUpdate = isPermissionGranted(permissionKeys, "settings.update");
  const uiLocale = session.uiLocale;

  if (!canView) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.stockThresholds.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
      </section>
    );
  }

  const [store] = await db
    .select({
      outStockThreshold: stores.outStockThreshold,
      lowStockThreshold: stores.lowStockThreshold,
    })
    .from(stores)
    .where(eq(stores.id, session.activeStoreId))
    .limit(1);

  return (
    <section className="space-y-2">
      <StoreInventorySettings
        initialOutStockThreshold={store?.outStockThreshold ?? 0}
        initialLowStockThreshold={store?.lowStockThreshold ?? 10}
        canUpdate={canUpdate}
        uiLocale={uiLocale}
      />

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
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
        </div>
      </div>
    </section>
  );
}
