"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type SuperadminHomeHelpButtonProps = {
  uiLocale: UiLocale;
};

export function SuperadminHomeHelpButton({ uiLocale }: SuperadminHomeHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-9 rounded-full px-0"
        onClick={() => setIsOpen(true)}
        aria-label={t(uiLocale, "settings.superadminHome.help.ariaLabel")}
      >
        <Info className="h-4 w-4" />
      </Button>

      <SlideUpSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t(uiLocale, "settings.superadminHome.help.sheet.title")}
        description={t(uiLocale, "settings.superadminHome.help.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "settings.superadminHome.help.overview.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.help.overview.description")}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "settings.superadminHome.help.quickActions.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.help.quickActions.description")}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "settings.superadminHome.help.alerts.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.help.alerts.description")}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "settings.superadminHome.help.policy.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.superadminHome.help.policy.description")}
            </p>
          </div>
        </div>
      </SlideUpSheet>
    </>
  );
}
