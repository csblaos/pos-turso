import { ShieldCheck } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

export default async function SystemAdminSecurityPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t(uiLocale, "systemAdmin.workspaceBadge")}
        </div>
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.securityPage.title")}</h1>
      </header>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">{t(uiLocale, "systemAdmin.securityPage.status.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(uiLocale, "systemAdmin.securityPage.status.description")}
        </p>
      </article>
    </section>
  );
}
