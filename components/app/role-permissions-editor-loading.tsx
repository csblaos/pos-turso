"use client";

import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import { t } from "@/lib/i18n/messages";

export function RolePermissionsEditorLoading() {
  const uiLocale = useUiLocale();

  return (
    <article className="rounded-xl border bg-white p-4 text-sm text-muted-foreground shadow-sm">
      {t(uiLocale, "settings.roles.detail.loadingEditor")}
    </article>
  );
}

