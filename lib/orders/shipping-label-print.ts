import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { buildOrderQrSvgMarkup } from "@/lib/orders/print";
import type { OrderDetail } from "@/lib/orders/queries";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

type ShippingLabelPrintOrder = Pick<
  OrderDetail,
  | "orderNo"
  | "customerName"
  | "customerPhone"
  | "customerAddress"
  | "contactDisplayName"
  | "contactPhone"
  | "shippingFeeCharged"
  | "shippingProvider"
  | "shippingCarrier"
  | "trackingNo"
  | "total"
  | "paymentMethod"
  | "codAmount"
  | "storeName"
  | "storeSenderName"
  | "storeSenderPhone"
>;

export function buildShippingLabelPrintMarkup({
  order,
  uiLocale,
  numberLocale,
  storeCurrencyDisplay,
}: {
  order: ShippingLabelPrintOrder;
  uiLocale: UiLocale;
  numberLocale: string;
  storeCurrencyDisplay: string;
}) {
  const senderName = order.storeSenderName || order.storeName;
  const senderPhone = order.storeSenderPhone || "-";
  const receiverName =
    order.customerName || order.contactDisplayName || t(uiLocale, "orders.customer.guest");
  const receiverPhone = order.customerPhone || order.contactPhone || "-";
  const destinationPaysShipping = order.shippingFeeCharged > 0;
  const carrierName = order.shippingProvider || order.shippingCarrier || "-";
  const codAmount = order.codAmount > 0 ? order.codAmount : order.total;
  const trackingMarkup = order.trackingNo
    ? `<p style="margin:6px 0 0;font-size:12px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.print.label.trackingPrefix"))} ${escapeHtml(order.trackingNo)}</p>`
    : "";
  const shippingTick = (checked: boolean) =>
    `<span style="display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border:2px solid ${checked ? "#16a34a" : "#94a3b8"};border-radius:7px;background:${checked ? "#f0fdf4" : "#ffffff"};color:${checked ? "#16a34a" : "transparent"};box-shadow:${checked ? "0 0 0 3px #dcfce7" : "none"};font-size:16px;font-weight:900;line-height:1;">✓</span>`;

  return `<section class="print-page print-label">
    <div style="border:1px solid #0f172a;border-radius:10px;padding:10px 10px 8px;min-height:142mm;display:flex;flex-direction:column;gap:10px;background:#ffffff;">
      <section style="text-align:center;">
        <p style="margin:0;font-size:16px;font-weight:800;letter-spacing:0.02em;">${escapeHtml(senderName)}</p>
        <p style="margin:4px 0 0;font-size:13px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.print.label.orderPrefix"))}: ${escapeHtml(order.orderNo)}</p>
      </section>

      <section style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;">
        <div style="min-width:0;">
          <p style="margin:0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;">${escapeHtml(t(uiLocale, "orders.print.label.senderTitle"))}</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:700;line-height:1.3;word-break:break-word;">${escapeHtml(senderName)}</p>
          <p style="margin:3px 0 0;font-size:12px;line-height:1.35;">${escapeHtml(t(uiLocale, "orders.print.label.phonePrefix"))} ${escapeHtml(senderPhone)}</p>
        </div>
        <div style="width:92px;border:1px solid #cbd5e1;border-radius:10px;padding:6px;text-align:center;">
          <div style="width:80px;height:80px;margin:0 auto;">${buildOrderQrSvgMarkup(order.orderNo, {
            size: 80,
            ariaLabel: `${t(uiLocale, "orders.print.label.orderQrTitle")} ${order.orderNo}`,
          })}</div>
        </div>
      </section>

      <section style="border-top:1px dashed #64748b;padding-top:10px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;">${escapeHtml(t(uiLocale, "orders.print.label.receiverTitle"))}</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:800;line-height:1.2;word-break:break-word;">${escapeHtml(receiverName)}</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.print.label.phonePrefix"))} ${escapeHtml(receiverPhone)}</p>
        <p style="margin:6px 0 0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;">${escapeHtml(t(uiLocale, "orders.print.label.destinationAddressPrefix"))}</p>
        <p style="margin:4px 0 0;font-size:14px;white-space:pre-wrap;line-height:1.38;word-break:break-word;">${escapeHtml(order.customerAddress || "-")}</p>
      </section>

      <section style="border-top:1px dashed #64748b;padding-top:10px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;">${escapeHtml(t(uiLocale, "orders.print.label.shippingFeeTitle"))}</p>
        <div style="display:flex;gap:16px;font-size:13px;font-weight:700;align-items:center;">
          <span style="display:inline-flex;align-items:center;gap:6px;">${shippingTick(!destinationPaysShipping)}<span>${escapeHtml(t(uiLocale, "orders.print.label.shippingFeeOrigin"))}</span></span>
          <span style="display:inline-flex;align-items:center;gap:6px;">${shippingTick(destinationPaysShipping)}<span>${escapeHtml(t(uiLocale, "orders.print.label.shippingFeeDestination"))}</span></span>
        </div>
      </section>

      ${
        order.paymentMethod === "COD"
          ? `<section style="border-top:1px dashed #64748b;padding-top:10px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="display:inline-flex;height:30px;width:30px;align-items:center;justify-content:center;border:2px solid #16a34a;border-radius:999px;background:#f0fdf4;color:#16a34a;box-shadow:0 0 0 4px #dcfce7;font-size:18px;font-weight:900;">✓</span>
                <div>
                  <p style="margin:0;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;">${escapeHtml(t(uiLocale, "orders.print.label.codTitle"))}</p>
                  <p style="margin:2px 0 0;font-size:18px;font-weight:800;line-height:1.2;color:#166534;">COD: ${codAmount.toLocaleString(numberLocale)} ${escapeHtml(storeCurrencyDisplay)}</p>
                </div>
              </div>
            </section>`
          : ""
      }

      <section style="margin-top:auto;border-top:1px dashed #64748b;padding-top:10px;">
        <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px;">
          <div style="min-width:0;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;">${escapeHtml(t(uiLocale, "orders.print.label.shippingPrefix"))}</p>
            <div style="margin-top:6px;display:flex;align-items:center;gap:10px;">
              <div style="display:inline-flex;height:38px;width:58px;align-items:center;justify-content:center;border:1px dashed #94a3b8;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#64748b;">${escapeHtml(t(uiLocale, "orders.print.label.logoPlaceholder"))}</div>
              <div style="min-width:0;flex:1;">
                <p style="margin:0;font-size:16px;font-weight:800;line-height:1.2;word-break:break-word;">${escapeHtml(carrierName)}</p>
                ${trackingMarkup}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>`;
}
