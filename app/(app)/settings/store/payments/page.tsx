import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { ChevronRight, Settings2, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { StorePaymentAccountsSettings } from "@/components/app/store-payment-accounts-settings";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { storePaymentAccounts, stores } from "@/lib/db/schema";
import { parseStoreCurrency, parseSupportedCurrencies } from "@/lib/finance/store-financial";
import { t } from "@/lib/i18n/messages";
import { getUserPermissionsForCurrentSession, isPermissionGranted } from "@/lib/rbac/access";
import { isPaymentQrR2Configured, resolvePaymentQrImageUrl } from "@/lib/storage/r2";
import { getGlobalPaymentPolicy } from "@/lib/system-config/policy";

export default async function SettingsStorePaymentsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!session.activeStoreId) {
    redirect("/onboarding");
  }
  const activeStoreId = session.activeStoreId;

  const permissionKeys = await getUserPermissionsForCurrentSession();
  const canView = isPermissionGranted(permissionKeys, "settings.view");
  const canUpdate = isPermissionGranted(permissionKeys, "stores.update");
  const uiLocale = session.uiLocale;

  if (!canView) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.paymentAccounts.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.permissionDenied.viewPage")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  const [store, accounts, paymentPolicy] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        currency: stores.currency,
        supportedCurrencies: stores.supportedCurrencies,
      })
      .from(stores)
      .where(eq(stores.id, activeStoreId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    (async () => {
      try {
        return await db
          .select({
            id: storePaymentAccounts.id,
            displayName: storePaymentAccounts.displayName,
            accountType: storePaymentAccounts.accountType,
            bankName: storePaymentAccounts.bankName,
            accountName: storePaymentAccounts.accountName,
            accountNumber: storePaymentAccounts.accountNumber,
            qrImageUrl: storePaymentAccounts.qrImageUrl,
            currency: storePaymentAccounts.currency,
            promptpayId: storePaymentAccounts.promptpayId,
            isDefault: storePaymentAccounts.isDefault,
            isActive: storePaymentAccounts.isActive,
            createdAt: storePaymentAccounts.createdAt,
            updatedAt: storePaymentAccounts.updatedAt,
          })
          .from(storePaymentAccounts)
          .where(eq(storePaymentAccounts.storeId, activeStoreId))
          .orderBy(
            desc(storePaymentAccounts.isDefault),
            desc(storePaymentAccounts.isActive),
            asc(storePaymentAccounts.createdAt),
          );
      } catch {
        return [];
      }
    })(),
    getGlobalPaymentPolicy(),
  ]);

  if (!store) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.link.paymentAccounts.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "common.error.activeStoreNotFound")}</p>
        <Link href="/settings" className="text-sm font-medium text-blue-700 hover:underline">
          {t(uiLocale, "common.backToSettings")}
        </Link>
      </section>
    );
  }

  const normalizedAccounts = accounts.map((account) => ({
    ...account,
    accountType:
      account.accountType === "BANK" || account.accountType === "LAO_QR"
        ? account.accountType
        : account.accountType === "PROMPTPAY"
          ? "LAO_QR"
        : "BANK",
    qrImageUrl: resolvePaymentQrImageUrl(account.qrImageUrl ?? account.promptpayId ?? null),
    currency: parseStoreCurrency(account.currency, store.currency ?? "LAK"),
  }));

  return (
    <section className="space-y-2">
      <StorePaymentAccountsSettings
        initialAccounts={normalizedAccounts}
        initialPolicy={paymentPolicy}
        canUpdate={canUpdate}
        canUploadQrImage={isPaymentQrR2Configured()}
        storeSupportedCurrencies={parseSupportedCurrencies(
          store.supportedCurrencies,
          store.currency ?? "LAK",
        )}
      />

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">
          {t(uiLocale, "settings.section.navigate")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/settings/store"
            className="group flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Store className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "settings.nav.backToStore.title")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "settings.nav.backToStore.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/settings"
            className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {t(uiLocale, "common.backToSettings")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {t(uiLocale, "common.backToSettings.description")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
