import { notFound, redirect } from "next/navigation";

import { ReceiptPrintActions } from "@/components/app/receipt-print-actions";
import { getSession } from "@/lib/auth/session";
import { currencySymbol, parseStoreCurrency } from "@/lib/finance/store-financial";
import { DEFAULT_UI_LOCALE, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { buildOrderQrSvgMarkup } from "@/lib/orders/print";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { getOrderDetail, type OrderDetail } from "@/lib/orders/queries";

const statusLabelKey: Record<OrderDetail["status"], MessageKey> = {
  DRAFT: "orders.status.DRAFT",
  PENDING_PAYMENT: "orders.status.PENDING_PAYMENT",
  READY_FOR_PICKUP: "orders.status.READY_FOR_PICKUP",
  PICKED_UP_PENDING_PAYMENT: "orders.status.PICKED_UP_PENDING_PAYMENT",
  PAID: "orders.status.PAID",
  PACKED: "orders.status.PACKED",
  SHIPPED: "orders.status.SHIPPED",
  COD_RETURNED: "orders.status.COD_RETURNED",
  CANCELLED: "orders.status.CANCELLED",
};

export default async function PrintLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  if (!isPermissionGranted(permissionKeys, "orders.view")) {
    redirect("/orders");
  }

  const { orderId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const autoPrintParam = resolvedSearchParams?.autoprint;
  const returnToParam = resolvedSearchParams?.returnTo;
  const autoPrint =
    (typeof autoPrintParam === "string" ? autoPrintParam : autoPrintParam?.[0]) === "1";
  const rawReturnTo =
    typeof returnToParam === "string" ? returnToParam : (returnToParam?.[0] ?? "");
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : null;
  const order = await getOrderDetail(session.activeStoreId, orderId);
  const storeCurrencyDisplay = currencySymbol(parseStoreCurrency(order?.storeCurrency));

  if (!order) {
    notFound();
  }

  const uiLocale = session.uiLocale ?? DEFAULT_UI_LOCALE;
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const orderQrSvg = buildOrderQrSvgMarkup(order.orderNo, {
    size: 132,
    ariaLabel: `${t(uiLocale, "orders.print.label.orderQrTitle")} ${order.orderNo}`,
  });

  return (
    <>
      <style>{`
        @media print {
          header,
          nav {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
        }
      `}</style>
      <main className="mx-auto w-[105mm] bg-white p-4 text-black">
        <section className="mx-auto flex min-h-[148mm] flex-col justify-between border bg-white p-4">
          <section className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <h1 className="text-lg font-semibold">{t(uiLocale, "orders.print.label.title")}</h1>
              <p className="text-sm text-slate-700">
                {t(uiLocale, "orders.print.label.orderPrefix")} {order.orderNo}
              </p>
              <p className="text-sm">
                {t(uiLocale, "orders.print.label.statusPrefix")} {t(uiLocale, statusLabelKey[order.status])}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t(uiLocale, "orders.print.label.createdAtPrefix")}{" "}
                {new Date(order.createdAt).toLocaleString(numberLocale)}
              </p>
            </div>
            <div className="w-[36mm] rounded-lg border border-slate-200 p-2 text-center">
              <div
                className="mx-auto h-[32mm] w-[32mm]"
                dangerouslySetInnerHTML={{ __html: orderQrSvg }}
              />
              <p className="mt-2 text-[10px] font-medium leading-tight">
                {t(uiLocale, "orders.print.label.orderQrTitle")}
              </p>
              <p className="mt-1 text-[9px] leading-tight text-slate-500">
                {t(uiLocale, "orders.print.label.orderQrHint")}
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs text-slate-600">{t(uiLocale, "orders.print.label.receiverTitle")}</p>
            <p className="text-base font-medium">
              {order.customerName ||
                order.contactDisplayName ||
                t(uiLocale, "orders.codReconcile.customer.walkIn")}
            </p>
            <p className="text-sm">
              {t(uiLocale, "orders.print.label.phonePrefix")}{" "}
              {order.customerPhone || order.contactPhone || "-"}
            </p>
            <p className="whitespace-pre-wrap text-sm">{order.customerAddress || "-"}</p>
          </section>

          <section className="space-y-1 border-t pt-3 text-sm">
            <p>
              {t(uiLocale, "orders.print.label.shippingPrefix")}{" "}
              {order.shippingProvider || order.shippingCarrier || "-"}
            </p>
            <p>Tracking: {order.trackingNo || "-"}</p>
            <p>
              {t(uiLocale, "orders.print.label.shippingCostPrefix")}{" "}
              {order.shippingCost.toLocaleString(numberLocale)} {storeCurrencyDisplay}
            </p>
          </section>
        </section>
        <ReceiptPrintActions
          autoPrint={autoPrint}
          returnTo={returnTo}
          printLabel={t(uiLocale, "common.action.printAgain")}
          returnLabel={t(uiLocale, "nav.backToOrderDetail")}
        />
      </main>
    </>
  );
}
