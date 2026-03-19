import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

export default function SystemAdminDashboardLoading() {
  const uiLocale = DEFAULT_UI_LOCALE;

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t(uiLocale, "systemAdmin.dashboard.subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          t(uiLocale, "systemAdmin.dashboard.card.totalClients"),
          t(uiLocale, "systemAdmin.dashboard.card.totalStores"),
          t(uiLocale, "systemAdmin.dashboard.card.totalUsers"),
          t(uiLocale, "systemAdmin.dashboard.card.activeMembers"),
        ].map((label) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t(uiLocale, "systemAdmin.dashboard.topClients.title")}</h2>
            <span className="text-sm text-blue-700">{t(uiLocale, "systemAdmin.dashboard.topClients.manage")}</span>
          </div>
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-52 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-48 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </article>

        <article className="space-y-2 rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold">{t(uiLocale, "systemAdmin.dashboard.storePermissions.title")}</h2>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-5 w-full animate-pulse rounded bg-slate-200" />
          ))}
          <span className="inline-block text-sm text-blue-700">
            {t(uiLocale, "systemAdmin.dashboard.storePermissions.goToConfig")}
          </span>
        </article>
      </div>
    </section>
  );
}
