import { notFound, redirect } from "next/navigation";

import { ReceiptPrintActions } from "@/components/app/receipt-print-actions";
import { getSession } from "@/lib/auth/session";
import { currencySymbol, parseStoreCurrency } from "@/lib/finance/store-financial";
import { DEFAULT_UI_LOCALE, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { getOrderDetail } from "@/lib/orders/queries";
import { buildShippingLabelPrintMarkup } from "@/lib/orders/shipping-label-print";

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
  const labelMarkup = buildShippingLabelPrintMarkup({
    order,
    uiLocale,
    numberLocale,
    storeCurrencyDisplay,
  });

  return (
    <>
      <style>{`
        @page {
          size: 100mm 150mm;
          margin: 0;
        }
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
      <main className="mx-auto w-[100mm] bg-white p-[4mm] text-black">
        <div dangerouslySetInnerHTML={{ __html: labelMarkup }} />
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
