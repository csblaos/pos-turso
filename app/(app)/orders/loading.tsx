import { PageLoadingSkeleton } from "@/components/app/page-loading-skeleton";
import { t } from "@/lib/i18n/messages";
import { getRequestUiLocale } from "@/lib/i18n/request-locale";

export default async function OrdersLoading() {
  const uiLocale = await getRequestUiLocale();
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(uiLocale, "orders.page.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "orders.loading.subtitle")}
        </p>
      </header>
      <PageLoadingSkeleton />
    </section>
  );
}
