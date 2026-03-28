import { buildOrderQrSvgMarkup } from "@/lib/orders/print";
import type { OrderDetail } from "@/lib/orders/queries";
import type { UiLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";

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

const paymentMethodLabelKey: Record<OrderDetail["paymentMethod"], MessageKey> = {
  CASH: "orders.paymentMethod.CASH",
  LAO_QR: "orders.paymentMethod.LAO_QR",
  ON_CREDIT: "orders.paymentMethod.ON_CREDIT",
  COD: "orders.paymentMethod.COD",
  BANK_TRANSFER: "orders.paymentMethod.BANK_TRANSFER",
};

const paymentStatusLabelKey: Record<OrderDetail["paymentStatus"], MessageKey> = {
  UNPAID: "orders.paymentStatus.UNPAID",
  PENDING_PROOF: "orders.paymentStatus.PENDING_PROOF",
  PAID: "orders.paymentStatus.PAID",
  COD_PENDING_SETTLEMENT: "orders.paymentStatus.COD_PENDING_SETTLEMENT",
  COD_SETTLED: "orders.paymentStatus.COD_SETTLED",
  FAILED: "orders.paymentStatus.FAILED",
};

type OrderPackContentProps = {
  order: OrderDetail;
  uiLocale: UiLocale;
  numberLocale: string;
  storeCurrencyDisplay: string;
  className?: string;
};

export function OrderPackContent({
  order,
  uiLocale,
  numberLocale,
  storeCurrencyDisplay,
  className,
}: OrderPackContentProps) {
  const orderQrSvg = buildOrderQrSvgMarkup(order.orderNo, {
    size: 88,
    ariaLabel: `${t(uiLocale, "orders.pack.page.qrTitle")} ${order.orderNo}`,
  });
  const totalQuantity = order.items.reduce((sum, item) => sum + item.qty, 0);
  const orderFlowLabel =
    order.channel === "WALK_IN"
      ? order.status === "READY_FOR_PICKUP" || order.status === "PICKED_UP_PENDING_PAYMENT"
        ? t(uiLocale, "orders.flow.PICKUP_LATER")
        : t(uiLocale, "orders.flow.WALK_IN_NOW")
      : t(uiLocale, "orders.flow.ONLINE_DELIVERY");

  return (
    <section className={className}>
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t(uiLocale, "orders.pack.page.title")}
            </p>
            <h1 className="mt-2 truncate text-xl font-semibold text-slate-900">{order.orderNo}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {t(uiLocale, "orders.pack.page.flowLabel")}: {orderFlowLabel}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {t(uiLocale, statusLabelKey[order.status])}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {t(uiLocale, paymentStatusLabelKey[order.paymentStatus])}
              </span>
            </div>
          </div>

          <aside className="mx-auto w-fit overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-center sm:mx-0">
            <div
              className="flex h-[88px] w-[88px] items-center justify-center text-slate-900"
              dangerouslySetInnerHTML={{ __html: orderQrSvg }}
            />
            <p className="mt-2 max-w-[88px] truncate text-xs font-medium text-slate-900">
              {order.orderNo}
            </p>
          </aside>
        </header>

        <hr className="my-4 border-0 border-t border-dashed border-slate-300" />

        <section>
          <div className="space-y-1.5 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "orders.pack.page.paymentStatusLabel")}</span>
              <span className="text-right font-medium text-slate-900">
                {t(uiLocale, paymentMethodLabelKey[order.paymentMethod])}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "orders.print.label.createdAtPrefix")}</span>
              <span className="text-right text-slate-900">
                {new Date(order.createdAt).toLocaleString(numberLocale)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "orders.print.label.shippingPrefix")}</span>
              <span className="text-right font-medium text-slate-900">
                {order.shippingProvider || order.shippingCarrier || "-"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "orders.print.label.trackingPrefix")}</span>
              <span className="max-w-[62%] break-all text-right text-slate-900">
                {order.trackingNo || "-"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "orders.pack.page.itemsDistinct")}</span>
              <span className="font-medium text-slate-900">
                {order.items.length.toLocaleString(numberLocale)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span>{t(uiLocale, "orders.pack.page.itemsQtyTotal")}</span>
              <span className="font-semibold text-slate-900">
                {totalQuantity.toLocaleString(numberLocale)}
              </span>
            </div>
            {order.paymentMethod === "COD" ? (
              <div className="mt-2 flex items-start justify-between gap-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>{t(uiLocale, "orders.pack.page.codAmountLabel")}</span>
                <span className="font-semibold">
                  {(order.codAmount > 0 ? order.codAmount : order.total).toLocaleString(numberLocale)}{" "}
                  {storeCurrencyDisplay}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <hr className="my-4 border-0 border-t border-dashed border-slate-300" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.pack.page.customerTitle")}
            </h2>
          </div>
          <div className="space-y-1.5 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "orders.print.label.receiverTitle")}</span>
              <span className="max-w-[62%] text-right font-medium text-slate-900">
                {order.customerName ||
                  order.contactDisplayName ||
                  t(uiLocale, "orders.customer.guest")}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
              <span>{t(uiLocale, "common.phone.prefix")}</span>
              <span className="max-w-[62%] text-right text-slate-900">
                {order.customerPhone || order.contactPhone || "-"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span>{t(uiLocale, "orders.print.label.addressPrefix")}</span>
              <span className="max-w-[62%] whitespace-pre-wrap text-right text-slate-900">
                {order.customerAddress || "-"}
              </span>
            </div>
          </div>
        </section>

        <hr className="my-4 border-0 border-t border-dashed border-slate-300" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.pack.page.itemsTitle")}
            </h2>
            <p className="text-xs text-slate-500">
              {t(uiLocale, "orders.pack.page.itemsDistinct")}:{" "}
              {order.items.length.toLocaleString(numberLocale)}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t(uiLocale, "orders.print.receipt.table.item")}</th>
                  <th className="px-3 py-2 text-right">{t(uiLocale, "orders.print.receipt.table.qty")}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                          {index + 1}.
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium leading-5 text-slate-900">
                            {item.productName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {t(uiLocale, "orders.pack.page.skuLabel")}: {item.productSku || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-semibold text-slate-900">
                        {item.qty.toLocaleString(numberLocale)}
                      </p>
                      <p className="text-xs text-slate-500">{item.unitCode}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </section>
  );
}
