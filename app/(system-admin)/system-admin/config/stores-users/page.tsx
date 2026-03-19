import { asc, desc } from "drizzle-orm";

import { SystemStoreUserConfig } from "@/components/system-admin/system-store-user-config";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { stores, users } from "@/lib/db/schema";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

export default async function SystemAdminStoresUsersConfigPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const [storeRows, userRows] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        storeType: stores.storeType,
        currency: stores.currency,
        vatEnabled: stores.vatEnabled,
        vatRate: stores.vatRate,
        maxBranchesOverride: stores.maxBranchesOverride,
        createdAt: stores.createdAt,
      })
      .from(stores)
      .orderBy(desc(stores.createdAt)),
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        systemRole: users.systemRole,
        canCreateStores: users.canCreateStores,
        maxStores: users.maxStores,
        canCreateBranches: users.canCreateBranches,
        maxBranchesPerStore: users.maxBranchesPerStore,
        sessionLimit: users.sessionLimit,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name), asc(users.createdAt)),
  ]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.storesUsersPage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "systemAdmin.storesUsersPage.subtitle")}
        </p>
      </header>

      <SystemStoreUserConfig stores={storeRows} users={userRows} />
    </section>
  );
}
