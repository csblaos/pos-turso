import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { startServerRenderTimer } from "@/lib/perf/server";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import {
  getOrderManageCatalogForStore,
  type OrderListTab,
  listOrdersByTab,
  parseOrderListTab,
} from "@/lib/orders/queries";

const resolveDefaultOrdersTab = (params: {
  activeRoleName: string | null;
  canMarkPaid: boolean;
  canPack: boolean;
  canShip: boolean;
}): OrderListTab => {
  const roleName = params.activeRoleName?.trim().toLowerCase() ?? "";

  if (roleName === "owner" || roleName === "manager") {
    return "ALL";
  }

  if (
    roleName.includes("warehouse") ||
    roleName.includes("pack") ||
    roleName.includes("picker") ||
    roleName.includes("stock")
  ) {
    if (params.canPack) {
      return "TO_PACK";
    }
    if (params.canShip) {
      return "TO_SHIP";
    }
  }

  if (
    roleName.includes("ship") ||
    roleName.includes("delivery") ||
    roleName.includes("logistic")
  ) {
    if (params.canShip) {
      return "TO_SHIP";
    }
  }

  if (
    roleName.includes("cash") ||
    roleName.includes("sale") ||
    roleName.includes("payment") ||
    roleName.includes("front")
  ) {
    if (params.canMarkPaid) {
      return "PAYMENT_REVIEW";
    }
  }

  if (params.canMarkPaid && !params.canPack) {
    return "PAYMENT_REVIEW";
  }
  if (params.canPack && !params.canMarkPaid) {
    return "TO_PACK";
  }
  if (params.canShip && !params.canMarkPaid && !params.canPack) {
    return "TO_SHIP";
  }
  if (params.canPack && params.canShip && !params.canMarkPaid) {
    return "TO_PACK";
  }

  return "ALL";
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const finishRenderTimer = startServerRenderTimer("page.orders");

  try {
    const [session, permissionKeys, params] = await Promise.all([
      getSession(),
      getUserPermissionsForCurrentSession(),
      searchParams,
    ]);

    if (!session) {
      redirect("/login");
    }

    if (!session.activeStoreId) {
      redirect("/onboarding");
    }

    const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;
    const OrdersManagement = dynamic(
      () =>
        import("@/components/app/orders-management").then(
          (module) => module.OrdersManagement,
        ),
      {
        loading: () => (
          <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
            {t(uiLocale, "orders.page.loadingManagement")}
          </div>
        ),
      },
    );

    const tab = parseOrderListTab(params.tab);
    const pageParam = Number(params.page ?? "1");
    const page = Number.isFinite(pageParam) ? pageParam : 1;
    const q = params.q?.trim() ?? "";

    const canView = isPermissionGranted(permissionKeys, "orders.view");
    const canCreate = isPermissionGranted(permissionKeys, "orders.create");
    const canUpdate = isPermissionGranted(permissionKeys, "orders.update");
    const canMarkPaid = isPermissionGranted(permissionKeys, "orders.mark_paid");
    const canPack = isPermissionGranted(permissionKeys, "orders.pack");
    const canShip = isPermissionGranted(permissionKeys, "orders.ship");
    const canCodReturn = isPermissionGranted(permissionKeys, "orders.cod_return");
    const defaultTab = resolveDefaultOrdersTab({
      activeRoleName: session.activeRoleName,
      canMarkPaid,
      canPack,
      canShip,
    });
    const canRequestCancel =
      canUpdate ||
      isPermissionGranted(permissionKeys, "orders.cancel") ||
      isPermissionGranted(permissionKeys, "orders.delete");
    const canSelfApproveCancel =
      session.activeRoleName === "Owner" || session.activeRoleName === "Manager";

    if (!canView) {
      return (
        <section className="space-y-2">
          <h1 className="text-xl font-semibold">{t(uiLocale, "orders.page.title")}</h1>
          <p className="text-sm text-red-600">{t(uiLocale, "orders.page.noAccess")}</p>
        </section>
      );
    }

    if (!params.tab && defaultTab !== "ALL") {
      const nextParams = new URLSearchParams();
      nextParams.set("tab", defaultTab);
      if (q) {
        nextParams.set("q", q);
      }
      redirect(`/orders?${nextParams.toString()}`);
    }

    const [catalog, ordersPage] = await Promise.all([
      getOrderManageCatalogForStore(session.activeStoreId),
      listOrdersByTab(session.activeStoreId, tab, { page, pageSize: 20, q }),
    ]);

    return (
      <section className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{t(uiLocale, "orders.page.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t(uiLocale, "orders.page.subtitle")}
            </p>
          </div>
          {canMarkPaid ? (
            <Link
              href="/orders/cod-reconcile"
              className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700"
            >
              {t(uiLocale, "orders.page.codReconcileCta")}
            </Link>
          ) : null}
        </header>

        <OrdersManagement
          ordersPage={ordersPage}
          activeTab={tab}
          searchQuery={q}
          catalog={catalog}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canMarkPaid={canMarkPaid}
          canPack={canPack}
          canShip={canShip}
          canCodReturn={canCodReturn}
          canRequestCancel={canRequestCancel}
          canSelfApproveCancel={canSelfApproveCancel}
        />

        <Link href="/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "orders.page.backToDashboard")}
        </Link>
      </section>
    );
  } finally {
    finishRenderTimer();
  }
}
