"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { type UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type SuperadminQuotasHelpButtonProps = {
  uiLocale: UiLocale;
};

export function SuperadminQuotasHelpButton({
  uiLocale,
}: SuperadminQuotasHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-9 rounded-full px-0"
        onClick={() => setIsOpen(true)}
        aria-label={t(uiLocale, "superadmin.quotas.help.ariaLabel")}
      >
        <Info className="h-4 w-4" />
      </Button>

      <SlideUpSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t(uiLocale, "superadmin.quotas.help.sheet.title")}
        description={t(uiLocale, "superadmin.quotas.help.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "superadmin.quotas.help.storeQuota.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "superadmin.quotas.help.storeQuota.description")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "superadmin.quotas.help.branchPolicies.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "superadmin.quotas.help.branchPolicies.description")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">
              {t(uiLocale, "superadmin.quotas.help.followUp.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(uiLocale, "superadmin.quotas.help.followUp.description")}
            </p>
          </div>
        </div>
      </SlideUpSheet>
    </>
  );
}
