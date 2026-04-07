"use client";

import { usePathname } from "next/navigation";

import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

export function SystemAdminHeaderTitle() {
  const uiLocale = useUiLocale();
  const pathname = usePathname() ?? "/";

  const shouldShowTitle = pathname === "/system-admin" || pathname === "/system-admin/config";

  if (!shouldShowTitle) {
    return null;
  }

  return (
    <div className="min-w-0 leading-tight">
      <p className="text-[10px] font-semibold text-slate-500">
        {t(uiLocale, "systemAdmin.layout.eyebrow")}
      </p>
      <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
        {t(uiLocale, "systemAdmin.layout.title")}
      </p>
    </div>
  );
}
