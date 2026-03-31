import { notFound, redirect } from "next/navigation";
import Image from "next/image";

import { ReceiptPrintActions } from "@/components/app/receipt-print-actions";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { currencyLabel, currencySymbol, parseStoreCurrency, vatModeLabel } from "@/lib/finance/store-financial";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { getOrderDetail } from "@/lib/orders/queries";

export default async function PrintReceiptPage({
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
  const paymentQrImageSrc =
    order.paymentAccountQrImageUrl
      ? order.paymentAccountId
        ? `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image`
        : order.paymentAccountQrImageUrl
      : null;
  const paymentMethodLabel = (method: typeof order.paymentMethod) => {
    if (method === "LAO_QR") return t(uiLocale, "orders.paymentMethod.LAO_QR");
    if (method === "ON_CREDIT") return t(uiLocale, "orders.paymentMethod.ON_CREDIT");
    if (method === "COD") return t(uiLocale, "orders.paymentMethod.COD");
    if (method === "BANK_TRANSFER") return t(uiLocale, "orders.paymentMethod.BANK_TRANSFER");
    return t(uiLocale, "orders.paymentMethod.CASH");
  };

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
      <main className="mx-auto w-[80mm] bg-white p-2 text-[12px] leading-tight text-black">
        <h1 className="text-center text-sm font-semibold">{t(uiLocale, "orders.print.receipt.title")}</h1>
        <p className="text-center text-[11px]">
          {t(uiLocale, "orders.print.receipt.noPrefix")} {order.orderNo}
        </p>
        <p className="mt-2">
          {t(uiLocale, "orders.print.receipt.customerPrefix")}{" "}
          {order.customerName ||
            order.contactDisplayName ||
            t(uiLocale, "orders.codReconcile.customer.walkIn")}
        </p>
        <p>
          {t(uiLocale, "orders.print.receipt.datePrefix")}{" "}
          {new Date(order.createdAt).toLocaleString(numberLocale)}
        </p>
        <hr className="my-2 border-dashed" />

        <table className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="text-left">{t(uiLocale, "orders.print.receipt.table.item")}</th>
              <th className="text-right">{t(uiLocale, "orders.print.receipt.table.qty")}</th>
              <th className="text-right">{t(uiLocale, "orders.print.receipt.table.total")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-1">
                  {item.productName}
                  <div className="text-[10px] text-slate-600">{item.productSku}</div>
                </td>
                <td className="py-1 text-right">
                  {item.qty} {item.unitCode}
                </td>
                <td className="py-1 text-right">
                  {item.lineTotal.toLocaleString(numberLocale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr className="my-2 border-dashed" />

        <div className="space-y-1 text-[11px]">
          <p className="flex justify-between">
            <span>{t(uiLocale, "orders.print.receipt.summary.subtotal")}</span>
            <span>{order.subtotal.toLocaleString(numberLocale)}</span>
          </p>
          <p className="flex justify-between">
            <span>{t(uiLocale, "orders.print.receipt.summary.discount")}</span>
            <span>{order.discount.toLocaleString(numberLocale)}</span>
          </p>
          <p className="flex justify-between">
            <span>VAT</span>
            <span>
              {order.vatAmount.toLocaleString(numberLocale)} ({vatModeLabel(order.storeVatMode)})
            </span>
          </p>
          <p className="flex justify-between">
            <span>{t(uiLocale, "orders.print.receipt.summary.shipping")}</span>
            <span>{order.shippingFeeCharged.toLocaleString(numberLocale)}</span>
          </p>
          <p className="flex justify-between font-semibold">
            <span>{t(uiLocale, "orders.print.receipt.summary.netTotal")}</span>
            <span>{order.total.toLocaleString(numberLocale)} {storeCurrencyDisplay}</span>
          </p>
          <p className="flex justify-between">
            <span>{t(uiLocale, "orders.print.receipt.summary.paymentCurrency")}</span>
            <span>{currencyLabel(order.paymentCurrency)}</span>
          </p>
          <p className="flex justify-between">
            <span>{t(uiLocale, "orders.print.receipt.summary.paymentMethod")}</span>
            <span>{paymentMethodLabel(order.paymentMethod)}</span>
          </p>
        </div>

        {paymentQrImageSrc ? (
          <>
            <hr className="my-2 border-dashed" />
            <div className="space-y-2 text-center text-[11px]">
              <p className="font-semibold text-slate-900">
                {t(uiLocale, "orders.print.receipt.qrTitle")}
              </p>
              <p className="text-[10px] text-slate-600">
                {t(uiLocale, "orders.print.receipt.qrHint")}
              </p>
              <Image
                src={paymentQrImageSrc}
                alt={t(uiLocale, "orders.print.receipt.qrTitle")}
                width={112}
                height={112}
                unoptimized
                className="mx-auto h-28 w-28 object-contain"
              />
              <div className="space-y-0.5 text-left text-[10px]">
                {order.paymentAccountDisplayName ? <p>{order.paymentAccountDisplayName}</p> : null}
                {order.paymentAccountBankName ? (
                  <p>
                    {t(uiLocale, "orders.create.paymentAccount.details.bankPrefix")}{" "}
                    {order.paymentAccountBankName}
                  </p>
                ) : null}
                {order.paymentAccountNumber ? (
                  <p>
                    {t(uiLocale, "orders.create.paymentAccount.details.accountNumberLabel")}:{" "}
                    {order.paymentAccountNumber}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <hr className="my-2 border-dashed" />
        <p className="text-center text-[11px]">{t(uiLocale, "orders.print.receipt.thanks")}</p>
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
