import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";
import { currencySymbol } from "@/lib/finance/store-financial";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getRequestUiLocale } from "@/lib/i18n/request-locale";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { getPurchaseOrderDetail } from "@/server/services/purchase.service";

const printableStatuses = new Set(["ORDERED", "SHIPPED", "RECEIVED", "CANCELLED"] as const);

export default async function PrintPurchaseOrderPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const uiLocale = await getRequestUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }

  const permissionKeys = await getUserPermissionsForCurrentSession();
  if (!isPermissionGranted(permissionKeys, "inventory.view")) {
    redirect("/stock");
  }

  const { poId } = await params;
  const po = await getPurchaseOrderDetail(poId, session.activeStoreId);
  if (!printableStatuses.has(po.status as "ORDERED" | "SHIPPED" | "RECEIVED" | "CANCELLED")) {
    redirect("/stock");
  }

  const [storeRow] = await db
    .select({
      name: stores.name,
      address: stores.address,
      phoneNumber: stores.phoneNumber,
      currency: stores.currency,
    })
    .from(stores)
    .where(eq(stores.id, session.activeStoreId))
    .limit(1);

  if (!storeRow) {
    notFound();
  }

  const symbol = currencySymbol(storeRow.currency);
  const formatMoney = (value: number) => `${symbol}${value.toLocaleString(numberLocale)}`;
  const grandTotal = po.totalCostBase + po.shippingCost + po.otherCost;

  return (
    <main className="mx-auto w-full max-w-[210mm] bg-white p-6 text-black sm:p-8 print:max-w-none print:p-0">
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-xs text-slate-500">{t(uiLocale, "purchase.print.meta")}</p>
        <h1 className="text-2xl font-semibold">{t(uiLocale, "purchase.print.title")}</h1>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">{storeRow.name}</p>
            <p className="text-slate-600">{storeRow.address || "-"}</p>
            <p className="text-slate-600">
              {t(uiLocale, "common.phone.prefix")} {storeRow.phoneNumber || "-"}
            </p>
          </div>
          <div className="space-y-1 text-sm sm:text-right">
            <p>
              <span className="text-slate-500">{t(uiLocale, "purchase.print.poNumber")}</span>{" "}
              {po.poNumber}
            </p>
            <p>
              <span className="text-slate-500">{t(uiLocale, "purchase.print.createdAt")}</span>{" "}
              {new Date(po.createdAt).toLocaleDateString(numberLocale)}
            </p>
            <p>
              <span className="text-slate-500">{t(uiLocale, "purchase.print.orderedAt")}</span>{" "}
              {po.orderedAt
                ? new Date(po.orderedAt).toLocaleDateString(numberLocale)
                : "-"}
            </p>
            <p>
              <span className="text-slate-500">{t(uiLocale, "purchase.print.supplier")}</span>{" "}
              {po.supplierName || "-"}
            </p>
          </div>
        </div>
      </header>

      <section>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 text-left">
              <th className="px-2 py-2">{t(uiLocale, "purchase.print.table.item")}</th>
              <th className="px-2 py-2">{t(uiLocale, "products.label.sku")}</th>
              <th className="px-2 py-2 text-right">{t(uiLocale, "purchase.print.table.qty")}</th>
              <th className="px-2 py-2 text-right">
                {t(uiLocale, "purchase.print.table.unitPrice")}
              </th>
              <th className="px-2 py-2 text-right">{t(uiLocale, "purchase.print.table.total")}</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="px-2 py-2">{item.productName}</td>
                <td className="px-2 py-2 text-slate-600">{item.productSku}</td>
                <td className="px-2 py-2 text-right">
                  {item.qtyOrdered.toLocaleString(numberLocale)}
                </td>
                <td className="px-2 py-2 text-right">{formatMoney(item.unitCostBase)}</td>
                <td className="px-2 py-2 text-right">
                  {formatMoney(item.unitCostBase * item.qtyOrdered)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 ml-auto w-full max-w-xs space-y-1 text-sm">
        <p className="flex justify-between">
          <span className="text-slate-600">{t(uiLocale, "purchase.print.summary.items")}</span>
          <span>{formatMoney(po.totalCostBase)}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-600">{t(uiLocale, "purchase.print.summary.shipping")}</span>
          <span>{formatMoney(po.shippingCost)}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-600">{t(uiLocale, "purchase.print.summary.other")}</span>
          <span>{formatMoney(po.otherCost)}</span>
        </p>
        <p className="flex justify-between border-t border-slate-300 pt-1 text-base font-semibold">
          <span>{t(uiLocale, "purchase.print.summary.grandTotal")}</span>
          <span>{formatMoney(grandTotal)}</span>
        </p>
      </section>

      <section className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 font-medium">{t(uiLocale, "purchase.print.note.title")}</p>
          <p className="min-h-16 rounded border border-slate-300 p-2 text-slate-700">
            {po.note || "-"}
          </p>
        </div>
        <div className="space-y-6">
          <div>
            <p className="mb-7 border-b border-slate-400" />
            <p className="text-center text-xs text-slate-600">
              {t(uiLocale, "purchase.print.signature.approverBuyer")}
            </p>
          </div>
          <div>
            <p className="mb-7 border-b border-slate-400" />
            <p className="text-center text-xs text-slate-600">
              {t(uiLocale, "purchase.print.signature.supplier")}
            </p>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-slate-500 print:hidden">
        {t(uiLocale, "purchase.print.footer.hint")}
      </p>
    </main>
  );
}
