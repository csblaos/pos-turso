import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

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
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.stockThresholds.title")}</h1>
        <p className="text-sm text-muted-foreground">{t(uiLocale, "settings.link.stockThresholds.description")}</p>
      </header>

      <StoreInventorySettings
        initialOutStockThreshold={store?.outStockThreshold ?? 0}
        initialLowStockThreshold={store?.lowStockThreshold ?? 10}
        canUpdate={canUpdate}
      />
    </section>
  );
}
