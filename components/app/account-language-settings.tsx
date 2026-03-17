"use client";

import { CheckCircle2, ChevronRight, CircleAlert, Languages, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch, setClientAuthToken } from "@/lib/auth/client-token";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { type UiLocale, uiLocaleValues } from "@/lib/i18n/locales";

type AccountLanguageSettingsProps = {
  locale: UiLocale;
  initialUiLocale: UiLocale;
};

type UpdateLocaleResponse = {
  ok?: boolean;
  message?: string;
  warning?: string | null;
  token?: string;
  user?: {
    uiLocale?: UiLocale;
  };
};

function getLocaleOptionLabel(option: UiLocale, uiLocale: UiLocale) {
  return t(uiLocale, `localeName.${option}` as MessageKey);
}

export function AccountLanguageSettings({ locale, initialUiLocale }: AccountLanguageSettingsProps) {
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [uiLocale, setUiLocale] = useState<UiLocale>(initialUiLocale);
  const [savedUiLocale, setSavedUiLocale] = useState<UiLocale>(initialUiLocale);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setUiLocale(initialUiLocale);
    setSavedUiLocale(initialUiLocale);
  }, [initialUiLocale]);

  const closeSheet = useCallback(() => {
    if (isSaving) return;
    setIsSheetOpen(false);
    setErrorMessage(null);
    setWarningMessage(null);
  }, [isSaving]);

  const isDirty = uiLocale !== savedUiLocale;

  const status = useMemo(() => {
    if (isDirty) {
      return {
        text: t(locale, "settings.language.status.notSaved"),
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: CircleAlert,
      };
    }

    return {
      text: t(locale, "settings.language.status.saved"),
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }, [isDirty, locale]);
  const StatusIcon = status.icon;

  const saveLocale = async () => {
    setSuccessMessage(null);
    setWarningMessage(null);
    setErrorMessage(null);

    if (!isDirty) {
      setSuccessMessage(t(locale, "settings.language.message.noChanges"));
      return;
    }

    setIsSaving(true);

    try {
      const response = await authFetch("/api/settings/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_locale",
          uiLocale,
        }),
      });

      const data = (await response.json().catch(() => null)) as UpdateLocaleResponse | null;
      if (!response.ok) {
        setErrorMessage(data?.message ?? t(locale, "settings.language.error.updateFailed"));
        return;
      }

      const nextLocale = data?.user?.uiLocale ?? uiLocale;
      setUiLocale(nextLocale);
      setSavedUiLocale(nextLocale);
      setWarningMessage(data?.warning ?? null);
      setSuccessMessage(t(locale, "settings.language.message.saved"));

      if (data?.token) {
        setClientAuthToken(data.token);
      }

      router.refresh();
    } catch {
      setErrorMessage(t(locale, "settings.language.error.serverUnreachable"));
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClassName =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none ring-primary focus:ring-2 disabled:bg-slate-100";

  return (
    <>
      <button
        type="button"
        className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-colors hover:bg-slate-50"
        onClick={() => setIsSheetOpen(true)}
      >
        <div className="flex min-h-14 items-center gap-3 px-4 py-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Languages className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">
              {t(locale, "settings.language.cta")}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {getLocaleOptionLabel(savedUiLocale, locale)}
            </span>
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.text}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>

      <SlideUpSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        title={t(locale, "settings.language.title")}
        description={t(locale, "settings.language.description")}
        disabled={isSaving}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="account-language">
              {t(locale, "settings.language.title")}
            </label>
            <select
              id="account-language"
              value={uiLocale}
              onChange={(event) => setUiLocale(event.target.value as UiLocale)}
              className={fieldClassName}
              disabled={isSaving}
            >
              {uiLocaleValues.map((option) => (
                <option key={option} value={option}>
                  {getLocaleOptionLabel(option, locale)}
                </option>
              ))}
            </select>
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {warningMessage ? <p className="text-sm text-amber-700">{warningMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

          <div className="flex justify-end">
            <Button
              type="button"
              className="h-11 min-w-[180px] rounded-xl"
              disabled={isSaving || !isDirty}
              onClick={saveLocale}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t(locale, "settings.language.save.saving")}
                </>
              ) : (
                t(locale, "settings.language.save")
              )}
            </Button>
          </div>
        </div>
      </SlideUpSheet>
    </>
  );
}
