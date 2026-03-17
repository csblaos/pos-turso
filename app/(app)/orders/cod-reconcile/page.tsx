import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";

export default async function OrdersCodReconcilePage() {
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

  const canView = isPermissionGranted(permissionKeys, "orders.view");
  const canMarkPaid = isPermissionGranted(permissionKeys, "orders.mark_paid");

  const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;
  const OrdersCodReconcile = dynamic(
    () =>
      import("@/components/app/orders-cod-reconcile").then(
        (module) => module.OrdersCodReconcile,
      ),
    {
      loading: () => (
        <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
          {t(uiLocale, "orders.codReconcile.page.loading")}
        </div>
      ),
    },
  );

  if (!canView || !canMarkPaid) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">
          {t(uiLocale, "orders.codReconcile.page.titleShort")}
        </h1>
        <p className="text-sm text-red-600">{t(uiLocale, "orders.codReconcile.page.noAccess")}</p>
        <Link href="/orders" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "orders.codReconcile.page.backToOrders")}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "orders.codReconcile.page.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "orders.codReconcile.page.subtitle")}
        </p>
      </header>

      <OrdersCodReconcile />

      <Link href="/orders" className="text-sm font-medium text-blue-700 hover:underline">
        {t(uiLocale, "orders.codReconcile.page.backToOrders")}
      </Link>
    </section>
  );
}
