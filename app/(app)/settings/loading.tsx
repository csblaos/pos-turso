import { PageLoadingSkeleton } from "@/components/app/page-loading-skeleton";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getRequestUiLocale } from "@/lib/i18n/request-locale";

export default async function SettingsLoading() {
  const uiLocale = (await getRequestUiLocale()) ?? DEFAULT_UI_LOCALE;

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.page.title")}</h1>
        <p className="text-sm text-muted-foreground">{t(uiLocale, "settings.page.loading")}</p>
      </header>
      <PageLoadingSkeleton />
    </section>
  );
}
