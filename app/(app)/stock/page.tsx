import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { parseStoreCurrency } from "@/lib/finance/store-financial";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";
import { createPerfScope } from "@/server/perf/perf";
import {
  getStockMovementsPage,
  getStockProductsPage,
} from "@/server/services/stock.service";
import { getPurchaseOrderListPage } from "@/server/services/purchase.service";
import { listCategories } from "@/lib/products/service";

export default async function StockPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const perf = createPerfScope("page.stock", "render");

  try {
    const [session, permissionKeys] = await perf.step("sessionAndPermissions.parallel", async () =>
      Promise.all([getSession(), getUserPermissionsForCurrentSession()]),
    );

    if (!session) {
      redirect("/login");
    }

    if (!session.activeStoreId) {
      redirect("/onboarding");
    }
    const activeStoreId = session.activeStoreId;
    const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;

    const StockTabs = dynamic(
      () =>
        import("@/components/app/stock-tabs").then((module) => module.StockTabs),
    );

    const loadingFallback = () => (
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-10 rounded-md bg-slate-200" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="h-10 rounded-md bg-slate-200" />
            <div className="h-10 rounded-md bg-slate-200" />
            <div className="h-10 rounded-md bg-slate-200" />
            <div className="h-10 rounded-md bg-slate-200" />
          </div>
          <div className="h-28 rounded-xl bg-slate-200" />
        </div>
      </div>
    );

    const StockRecordingForm = dynamic(
      () =>
        import("@/components/app/stock-recording-form").then(
          (module) => module.StockRecordingForm,
        ),
      {
        loading: loadingFallback,
      },
    );

    const StockInventoryView = dynamic(
      () =>
        import("@/components/app/stock-inventory-view").then(
          (module) => module.StockInventoryView,
        ),
      {
        loading: loadingFallback,
      },
    );

    const StockMovementHistory = dynamic(
      () =>
        import("@/components/app/stock-movement-history").then(
          (module) => module.StockMovementHistory,
        ),
      {
        loading: loadingFallback,
      },
    );

    const PurchaseOrderList = dynamic(
      () =>
        import("@/components/app/purchase-order-list").then(
          (module) => module.PurchaseOrderList,
        ),
      {
        loading: loadingFallback,
      },
    );

    const canView = isPermissionGranted(permissionKeys, "inventory.view");
    const canCreate = isPermissionGranted(permissionKeys, "inventory.create");
    const canInbound = isPermissionGranted(permissionKeys, "inventory.in");
    const canAdjust = isPermissionGranted(permissionKeys, "inventory.adjust");
    const canPostMovement = canCreate && (canInbound || canAdjust);
    const canUpdateCost = isPermissionGranted(permissionKeys, "products.cost.update");

    if (!canView) {
      return (
        <section className="space-y-2">
          <h1 className="text-xl font-semibold">{t(uiLocale, "stock.page.noAccess.title")}</h1>
          <p className="text-sm text-red-600">{t(uiLocale, "stock.page.noAccess.description")}</p>
        </section>
      );
    }

    const PRODUCT_PAGE_SIZE = 20;
    const PO_PAGE_SIZE = 20;
    const HISTORY_PAGE_SIZE = 10;

    const [historyPage, purchaseOrderRows, stockProductRows, storeRow, categories] =
      await perf.step("service.getStockAndPO", async () =>
        Promise.all([
          getStockMovementsPage({
            storeId: activeStoreId,
            page: 1,
            pageSize: HISTORY_PAGE_SIZE,
          }),
          getPurchaseOrderListPage(activeStoreId, PO_PAGE_SIZE + 1, 0),
          getStockProductsPage({
            storeId: activeStoreId,
            limit: PRODUCT_PAGE_SIZE + 1,
            offset: 0,
          }),
          db
            .select({
              currency: stores.currency,
              logoUrl: stores.logoUrl,
              outStockThreshold: stores.outStockThreshold,
              lowStockThreshold: stores.lowStockThreshold,
              pdfShowLogo: stores.pdfShowLogo,
              pdfShowSignature: stores.pdfShowSignature,
              pdfShowNote: stores.pdfShowNote,
              pdfHeaderColor: stores.pdfHeaderColor,
              pdfCompanyName: stores.pdfCompanyName,
              pdfCompanyAddress: stores.pdfCompanyAddress,
              pdfCompanyPhone: stores.pdfCompanyPhone,
            })
            .from(stores)
            .where(eq(stores.id, activeStoreId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          listCategories(activeStoreId),
        ]),
      );

    const initialProducts = stockProductRows.slice(0, PRODUCT_PAGE_SIZE);
    const initialHasMoreProducts = stockProductRows.length > PRODUCT_PAGE_SIZE;
    const hasMorePO = purchaseOrderRows.length > PO_PAGE_SIZE;
    const initialPOs = purchaseOrderRows.slice(0, PO_PAGE_SIZE);

    const storeCurrency = parseStoreCurrency(storeRow?.currency);
    const storeLogoUrl = storeRow?.logoUrl ?? null;
    const storePdfConfig = {
      showLogo: storeRow?.pdfShowLogo ?? true,
      showSignature: storeRow?.pdfShowSignature ?? true,
      showNote: storeRow?.pdfShowNote ?? true,
      headerColor: storeRow?.pdfHeaderColor ?? "#f1f5f9",
      companyName: storeRow?.pdfCompanyName ?? null,
      companyAddress: storeRow?.pdfCompanyAddress ?? null,
      companyPhone: storeRow?.pdfCompanyPhone ?? null,
    };
    const storeOutStockThreshold = storeRow?.outStockThreshold ?? 0;
    const storeLowStockThreshold = storeRow?.lowStockThreshold ?? 10;
    const params = await searchParams;
    const initialTab = params?.tab === "purchase"
      ? "purchase"
      : params?.tab === "inventory"
        ? "inventory"
        : params?.tab === "history"
          ? "history"
          : params?.tab === "recording"
            ? "recording"
          : "inventory";

    return (
      <section className="space-y-4">
        <StockTabs
          initialTab={initialTab}
          recordingTab={
            <StockRecordingForm
              initialProducts={initialProducts}
              canCreate={canPostMovement}
              canAdjust={canAdjust}
              canInbound={canInbound}
              canUpdateCost={canUpdateCost}
            />
          }
          inventoryTab={
            <StockInventoryView
              products={initialProducts}
              categories={categories}
              storeOutStockThreshold={storeOutStockThreshold}
              storeLowStockThreshold={storeLowStockThreshold}
              pageSize={PRODUCT_PAGE_SIZE}
              initialHasMore={initialHasMoreProducts}
            />
          }
          historyTab={
            <StockMovementHistory
              movements={historyPage.movements}
              initialTotal={historyPage.total}
            />
          }
          purchaseTab={
            <PurchaseOrderList
              purchaseOrders={initialPOs}
              activeStoreId={activeStoreId}
              userId={session.userId}
              storeCurrency={storeCurrency}
              canCreate={canCreate}
              pageSize={PO_PAGE_SIZE}
              initialHasMore={hasMorePO}
              storeLogoUrl={storeLogoUrl}
              pdfConfig={storePdfConfig}
            />
          }
        />
      </section>
    );
  } finally {
    perf.end();
  }
}
