import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import {
  getStoreProductSummaryCounts,
  listCategories,
  listStoreProductsPage,
  listUnits,
} from "@/lib/products/service";
import { getStoreFinancialConfig } from "@/lib/stores/financial";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ProductsHeaderRefreshButton } from "@/components/app/products-header-refresh-button";
import dynamic from "next/dynamic";

const PRODUCT_PAGE_SIZE = 30;
type ProductStatusFilter = "all" | "active" | "inactive";

function parseStatusFilter(value: string | undefined): ProductStatusFilter {
  if (value === "active" || value === "inactive") {
    return value;
  }
  return "all";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const initialStatusFilter = parseStatusFilter(params?.status);

  const [session, permissionKeys] = await Promise.all([
    getSession(),
    getUserPermissionsForCurrentSession(),
  ]);
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;

  const ProductsManagement = dynamic(
    () =>
      import("@/components/app/products-management").then(
        (module) => module.ProductsManagement,
      ),
    {
      loading: () => (
        <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
          {t(uiLocale, "products.page.loadingManagement")}
        </div>
      ),
    },
  );

  const canView = isPermissionGranted(permissionKeys, "products.view");
  const canCreate = isPermissionGranted(permissionKeys, "products.create");
  const canUpdate = isPermissionGranted(permissionKeys, "products.update");
  const canArchive =
    isPermissionGranted(permissionKeys, "products.archive") ||
    isPermissionGranted(permissionKeys, "products.delete");
  const canViewCost = isPermissionGranted(permissionKeys, "products.cost.view");
  const canUpdateCost = isPermissionGranted(permissionKeys, "products.cost.update");

  if (!canView) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t(uiLocale, "tab.products")}</h1>
        <p className="text-sm text-red-600">
          {t(uiLocale, "products.permissionDenied.description")}
        </p>
      </section>
    );
  }

  const [productPage, summaryCounts, units, categories, financial, storeRow] = await Promise.all([
    listStoreProductsPage({
      storeId: session.activeStoreId,
      status: initialStatusFilter,
      sort: "newest",
      page: 1,
      pageSize: PRODUCT_PAGE_SIZE,
    }),
    getStoreProductSummaryCounts(session.activeStoreId),
    listUnits(session.activeStoreId),
    listCategories(session.activeStoreId),
    getStoreFinancialConfig(session.activeStoreId),
    db
      .select({
        outStockThreshold: stores.outStockThreshold,
        lowStockThreshold: stores.lowStockThreshold,
      })
      .from(stores)
      .where(eq(stores.id, session.activeStoreId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{t(uiLocale, "tab.products")}</h1>
          <ProductsHeaderRefreshButton />
        </div>
      </header>

      <ProductsManagement
        products={productPage.items}
        initialTotalCount={productPage.total}
        initialSummaryCounts={summaryCounts}
        units={units}
        categories={categories}
        currency={financial?.currency ?? "LAK"}
        storeOutStockThreshold={storeRow?.outStockThreshold ?? 0}
        storeLowStockThreshold={storeRow?.lowStockThreshold ?? 10}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canArchive={canArchive}
        canViewCost={canViewCost}
        canUpdateCost={canUpdateCost}
        initialStatusFilter={initialStatusFilter}
      />
    </section>
  );
}
