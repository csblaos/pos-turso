import dynamicImport from "next/dynamic";
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
import {
  getCachedStockCategories,
  getCachedStockThresholds,
} from "@/lib/stock/page-cache";
import { StockPageSkeleton } from "@/components/app/stock-page-skeleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hnd1", "sin1"];

type StockPageTab = "inventory" | "purchase" | "recording" | "history";

const resolveInitialTab = (value?: string): StockPageTab =>
  value === "purchase"
    ? "purchase"
    : value === "history"
      ? "history"
      : value === "recording"
        ? "recording"
        : "inventory";

export default async function StockPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    inventoryQ?: string;
    inventoryCategoryId?: string;
  }>;
}) {
  const perf = createPerfScope("page.stock", "render");

  try {
    const [session, permissionKeys] = await perf.step(
      "sessionAndPermissions.parallel",
      () => Promise.all([getSession(), getUserPermissionsForCurrentSession()]),
      { kind: "auth" },
    );

    if (!session) {
      redirect("/login");
    }

    if (!session.activeStoreId) {
      redirect("/onboarding");
    }
    const activeStoreId = session.activeStoreId;
    const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;

    const StockTabs = dynamicImport(
      () =>
        import("@/components/app/stock-tabs").then((module) => module.StockTabs),
    );

    const loadingFallback = () => <StockPageSkeleton />;

    const StockRecordingForm = dynamicImport(
      () =>
        import("@/components/app/stock-recording-form").then(
          (module) => module.StockRecordingForm,
        ),
      {
        loading: loadingFallback,
      },
    );

    const StockInventoryView = dynamicImport(
      () =>
        import("@/components/app/stock-inventory-view").then(
          (module) => module.StockInventoryView,
        ),
      {
        loading: loadingFallback,
      },
    );

    const StockMovementHistory = dynamicImport(
      () =>
        import("@/components/app/stock-movement-history").then(
          (module) => module.StockMovementHistory,
        ),
      {
        loading: loadingFallback,
      },
    );

    const PurchaseOrderList = dynamicImport(
      () =>
        import("@/components/app/purchase-order-list").then(
          (module) => module.PurchaseOrderList,
        ),
      {
        loading: loadingFallback,
      },
    );

    const {
      canView,
      canCreate,
      canInbound,
      canAdjust,
      canPostMovement,
      canUpdateCost,
    } = await perf.step(
      "logic.permissionFlags",
      () => {
        const nextCanView = isPermissionGranted(permissionKeys, "inventory.view");
        const nextCanCreate = isPermissionGranted(permissionKeys, "inventory.create");
        const nextCanInbound = isPermissionGranted(permissionKeys, "inventory.in");
        const nextCanAdjust = isPermissionGranted(permissionKeys, "inventory.adjust");
        return {
          canView: nextCanView,
          canCreate: nextCanCreate,
          canInbound: nextCanInbound,
          canAdjust: nextCanAdjust,
          canPostMovement: nextCanCreate && (nextCanInbound || nextCanAdjust),
          canUpdateCost: isPermissionGranted(permissionKeys, "products.cost.update"),
        };
      },
      { kind: "logic" },
    );

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

    const params = await searchParams;
    const initialTab = resolveInitialTab(params?.tab);
    const inventorySearchQuery = params?.inventoryQ?.trim() ?? "";
    const inventoryCategoryId = params?.inventoryCategoryId?.trim() ?? "";
    const [inventoryCategories, inventoryThresholds, purchaseStoreConfig] = await Promise.all([
      perf.step("data.inventory.categories", () => getCachedStockCategories(activeStoreId), {
        kind: "cache",
      }),
      perf.step(
        "data.inventory.storeThresholds",
        () => getCachedStockThresholds(activeStoreId),
        { kind: "cache" },
      ),
      perf.step(
        "data.purchase.storeConfig",
        () =>
          db
            .select({
              currency: stores.currency,
              logoUrl: stores.logoUrl,
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
        { kind: "db" },
      ),
    ]);

    let inventorySeedRows: Awaited<ReturnType<typeof getStockProductsPage>> = [];
    let inventoryHasInitialSeed = false;
    let recordingSeedRows: Awaited<ReturnType<typeof getStockProductsPage>> = [];
    let recordingHasInitialSeed = false;
    let historySeed: Awaited<ReturnType<typeof getStockMovementsPage>> = {
      movements: [],
      total: 0,
    };
    let historyHasInitialSeed = false;
    let purchaseSeedRows: Awaited<ReturnType<typeof getPurchaseOrderListPage>> = [];
    let purchaseHasInitialSeed = false;

    if (initialTab === "inventory") {
      inventorySeedRows = await perf.step(
        "data.inventory.products",
        () =>
          getStockProductsPage({
            storeId: activeStoreId,
            limit: PRODUCT_PAGE_SIZE + 1,
            offset: 0,
            categoryId: inventoryCategoryId || undefined,
            query: inventorySearchQuery || undefined,
            includeUnitOptions: false,
          }),
        { kind: "db" },
      );
      inventoryHasInitialSeed = true;
    }

    if (initialTab === "recording") {
      recordingSeedRows = await perf.step(
        "data.recording.products",
        () =>
          getStockProductsPage({
            storeId: activeStoreId,
            limit: PRODUCT_PAGE_SIZE + 1,
            offset: 0,
            categoryId: inventoryCategoryId || undefined,
            query: inventorySearchQuery || undefined,
            includeUnitOptions: false,
          }),
        { kind: "db" },
      );
      recordingHasInitialSeed = true;
    }

    if (initialTab === "history") {
      historySeed = await perf.step(
        "data.history.page",
        () =>
          getStockMovementsPage({
            storeId: activeStoreId,
            page: 1,
            pageSize: HISTORY_PAGE_SIZE,
          }),
        { kind: "db" },
      );
      historyHasInitialSeed = true;
    }

    if (initialTab === "purchase") {
      purchaseSeedRows = await perf.step(
        "data.purchase.orders",
        () => getPurchaseOrderListPage(activeStoreId, PO_PAGE_SIZE + 1, 0),
        { kind: "db" },
      );
      purchaseHasInitialSeed = true;
    }

    const inventoryPageState = await perf.step(
      "logic.inventory.pageState",
      () => ({
        initialProducts: inventorySeedRows.slice(0, PRODUCT_PAGE_SIZE),
        initialHasMoreProducts: inventorySeedRows.length > PRODUCT_PAGE_SIZE,
      }),
      { kind: "logic" },
    );

    const recordingInitialProducts = await perf.step(
      "logic.recording.pageState",
      () => recordingSeedRows.slice(0, PRODUCT_PAGE_SIZE),
      { kind: "logic" },
    );

    const purchasePageState = await perf.step(
      "logic.purchase.pageState",
      () => {
        const nextHasMorePO = purchaseSeedRows.length > PO_PAGE_SIZE;
        const nextInitialPOs = purchaseSeedRows.slice(0, PO_PAGE_SIZE);
        return {
          hasMorePO: nextHasMorePO,
          initialPOs: nextInitialPOs,
          storeCurrency: parseStoreCurrency(purchaseStoreConfig?.currency),
          storeLogoUrl: purchaseStoreConfig?.logoUrl ?? null,
          storePdfConfig: {
            showLogo: purchaseStoreConfig?.pdfShowLogo ?? true,
            showSignature: purchaseStoreConfig?.pdfShowSignature ?? true,
            showNote: purchaseStoreConfig?.pdfShowNote ?? true,
            headerColor: purchaseStoreConfig?.pdfHeaderColor ?? "#f1f5f9",
            companyName: purchaseStoreConfig?.pdfCompanyName ?? null,
            companyAddress: purchaseStoreConfig?.pdfCompanyAddress ?? null,
            companyPhone: purchaseStoreConfig?.pdfCompanyPhone ?? null,
          },
        };
      },
      { kind: "logic" },
    );

    return perf.step(
      "ui.page.compose",
      () => (
        <section className="space-y-4">
          <StockTabs
            initialTab={initialTab}
            recordingTab={
              <StockRecordingForm
                initialProducts={recordingInitialProducts}
                canCreate={canPostMovement}
                canAdjust={canAdjust}
                canInbound={canInbound}
                canUpdateCost={canUpdateCost}
                hasInitialSeed={recordingHasInitialSeed}
              />
            }
            inventoryTab={
              <StockInventoryView
                products={inventoryPageState.initialProducts}
                categories={inventoryCategories}
                storeOutStockThreshold={inventoryThresholds.outStockThreshold ?? 0}
                storeLowStockThreshold={inventoryThresholds.lowStockThreshold ?? 10}
                pageSize={PRODUCT_PAGE_SIZE}
                initialHasMore={inventoryPageState.initialHasMoreProducts}
                hasInitialSeed={inventoryHasInitialSeed}
              />
            }
            historyTab={
              <StockMovementHistory
                movements={historySeed.movements}
                initialTotal={historySeed.total}
                hasInitialSeed={historyHasInitialSeed}
              />
            }
            purchaseTab={
              <PurchaseOrderList
                purchaseOrders={purchasePageState.initialPOs}
                activeStoreId={activeStoreId}
                userId={session.userId}
                storeCurrency={purchasePageState.storeCurrency}
                canCreate={canCreate}
                pageSize={PO_PAGE_SIZE}
                initialHasMore={purchasePageState.hasMorePO}
                hasInitialSeed={purchaseHasInitialSeed}
                storeLogoUrl={purchasePageState.storeLogoUrl}
                pdfConfig={purchasePageState.storePdfConfig}
              />
            }
          />
        </section>
      ),
      { kind: "ui" },
    );
  } finally {
    perf.end();
  }
}
