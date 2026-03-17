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
import { getOrderCatalogForStore } from "@/lib/orders/queries";

export default async function NewOrderPage() {
  const finishRenderTimer = startServerRenderTimer("page.orders.new");

  try {
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
    const OrdersManagement = dynamic(
      () =>
        import("@/components/app/orders-management").then(
          (module) => module.OrdersManagement,
        ),
      {
        loading: () => (
          <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
            {t(uiLocale, "orders.new.loadingForm")}
          </div>
        ),
      },
    );

    const canView = isPermissionGranted(permissionKeys, "orders.view");
    const canCreate = isPermissionGranted(permissionKeys, "orders.create");
    const canRequestCancel =
      isPermissionGranted(permissionKeys, "orders.update") ||
      isPermissionGranted(permissionKeys, "orders.cancel") ||
      isPermissionGranted(permissionKeys, "orders.delete");
    const canSelfApproveCancel =
      session.activeRoleName === "Owner" || session.activeRoleName === "Manager";

    if (!canView) {
      return (
        <section className="space-y-2">
          <h1 className="text-xl font-semibold">{t(uiLocale, "orders.new.title")}</h1>
          <p className="text-sm text-red-600">{t(uiLocale, "orders.page.noAccess")}</p>
          <Link href="/orders" className="text-sm font-medium text-blue-700 hover:underline">
            {t(uiLocale, "orders.codReconcile.page.backToOrders")}
          </Link>
        </section>
      );
    }

    const catalog = await getOrderCatalogForStore(session.activeStoreId);

    return (
      <section>
        <OrdersManagement
          mode="create-only"
          catalog={catalog}
          canCreate={canCreate}
          canRequestCancel={canRequestCancel}
          canSelfApproveCancel={canSelfApproveCancel}
        />
      </section>
    );
  } finally {
    finishRenderTimer();
  }
}
