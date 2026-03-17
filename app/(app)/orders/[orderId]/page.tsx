import { notFound, redirect } from "next/navigation";

import { OrderDetailView } from "@/components/app/order-detail-view";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import {
  buildOrderMessageTemplate,
  buildWhatsappDeepLink,
  FACEBOOK_INBOX_URL,
  isWithin24Hours,
} from "@/lib/orders/messages";
import { getActiveQrPaymentAccountsForStore, getOrderDetail } from "@/lib/orders/queries";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canView = isPermissionGranted(permissionKeys, "orders.view");
  const canSelfApproveCancel =
    session.activeRoleName === "Owner" || session.activeRoleName === "Manager";

  const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;

  if (!canView) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">{t(uiLocale, "orders.detail.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "orders.detail.noAccess")}</p>
      </section>
    );
  }

  const { orderId } = await params;
  const [order, qrPaymentAccounts] = await Promise.all([
    getOrderDetail(session.activeStoreId, orderId),
    getActiveQrPaymentAccountsForStore(session.activeStoreId),
  ]);

  if (!order) {
    notFound();
  }

  const message = buildOrderMessageTemplate({
    orderNo: order.orderNo,
    total: order.total,
    currency: order.paymentCurrency,
    customerName: order.customerName ?? order.contactDisplayName,
  });

  const within24h = isWithin24Hours(order.contactLastInboundAt);
  const waDeepLink = order.contactPhone
    ? buildWhatsappDeepLink(order.contactPhone, message)
    : null;

  return (
    <section className="space-y-4">
      <OrderDetailView
        order={order}
        messaging={{
          within24h,
          template: message,
          waDeepLink,
          facebookInboxUrl: FACEBOOK_INBOX_URL,
        }}
        canUpdate={isPermissionGranted(permissionKeys, "orders.update")}
        canMarkPaid={isPermissionGranted(permissionKeys, "orders.mark_paid")}
        canPack={isPermissionGranted(permissionKeys, "orders.pack")}
        canShip={isPermissionGranted(permissionKeys, "orders.ship")}
        canCodReturn={isPermissionGranted(permissionKeys, "orders.cod_return")}
        canCancel={
          isPermissionGranted(permissionKeys, "orders.cancel") ||
          isPermissionGranted(permissionKeys, "orders.delete")
        }
        canSelfApproveCancel={canSelfApproveCancel}
        qrPaymentAccounts={qrPaymentAccounts}
      />
    </section>
  );
}
