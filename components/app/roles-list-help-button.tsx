"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type RolesListHelpButtonProps = {
  uiLocale: UiLocale;
};

export function RolesListHelpButton({ uiLocale }: RolesListHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-9 rounded-full px-0"
        onClick={() => setIsOpen(true)}
        aria-label={t(uiLocale, "settings.roles.help.ariaLabel")}
      >
        <Info className="h-4 w-4" />
      </Button>

      <SlideUpSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t(uiLocale, "settings.roles.help.sheet.title")}
        description={t(uiLocale, "settings.roles.help.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.roles.help.permissions.title")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.roles.help.permissions.description")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.roles.help.system.title")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.roles.help.system.description")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "settings.roles.help.members.title")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "settings.roles.help.members.description")}
            </p>
          </div>
        </div>
      </SlideUpSheet>
    </>
  );
}
