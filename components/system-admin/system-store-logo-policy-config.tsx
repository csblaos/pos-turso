"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SystemStoreLogoPolicyConfigProps = {
  initialConfig: {
    maxSizeMb: number;
    autoResize: boolean;
    resizeMaxWidth: number;
  };
};

export function SystemStoreLogoPolicyConfig({ initialConfig }: SystemStoreLogoPolicyConfigProps) {
  const uiLocale = useUiLocale();
  const [maxSizeMb, setMaxSizeMb] = useState(String(initialConfig.maxSizeMb));
  const [autoResize, setAutoResize] = useState(initialConfig.autoResize);
  const [resizeMaxWidth, setResizeMaxWidth] = useState(String(initialConfig.resizeMaxWidth));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const save = async () => {
    const parsedMaxSizeMb = Number(maxSizeMb);
    const parsedResizeMaxWidth = Number(resizeMaxWidth);

    if (!Number.isInteger(parsedMaxSizeMb) || parsedMaxSizeMb < 1 || parsedMaxSizeMb > 20) {
      setErrorMessage(t(uiLocale, "systemAdmin.storeLogoPolicy.error.invalidMaxSize"));
      setSuccessMessage(null);
      return;
    }

    if (
      !Number.isInteger(parsedResizeMaxWidth) ||
      parsedResizeMaxWidth < 256 ||
      parsedResizeMaxWidth > 4096
    ) {
      setErrorMessage(t(uiLocale, "systemAdmin.storeLogoPolicy.error.invalidResizeMaxWidth"));
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/system-admin/config/store-logo-policy", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxSizeMb: parsedMaxSizeMb,
        autoResize,
        resizeMaxWidth: parsedResizeMaxWidth,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          config?: {
            maxSizeMb: number;
            autoResize: boolean;
            resizeMaxWidth: number;
          };
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "systemAdmin.storeLogoPolicy.error.saveFailed"));
      setIsSubmitting(false);
      return;
    }

    if (data?.config) {
      setMaxSizeMb(String(data.config.maxSizeMb));
      setAutoResize(data.config.autoResize);
      setResizeMaxWidth(String(data.config.resizeMaxWidth));
    }

    setSuccessMessage(t(uiLocale, "systemAdmin.storeLogoPolicy.message.saved"));
    setIsSubmitting(false);
  };

  return (
    <article className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold">{t(uiLocale, "systemAdmin.storeLogoPolicy.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t(uiLocale, "systemAdmin.storeLogoPolicy.description")}
      </p>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="global-store-logo-max-size">
          {t(uiLocale, "systemAdmin.storeLogoPolicy.field.maxSizeMb")}
        </label>
        <input
          id="global-store-logo-max-size"
          type="number"
          min={1}
          max={20}
          value={maxSizeMb}
          onChange={(event) => setMaxSizeMb(event.target.value)}
          className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          disabled={isSubmitting}
        />
      </div>

      <label className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
        <span>{t(uiLocale, "systemAdmin.storeLogoPolicy.field.autoResize")}</span>
        <input
          type="checkbox"
          checked={autoResize}
          onChange={(event) => setAutoResize(event.target.checked)}
          disabled={isSubmitting}
        />
      </label>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="global-store-logo-resize-width">
          {t(uiLocale, "systemAdmin.storeLogoPolicy.field.resizeMaxWidth")}
        </label>
        <input
          id="global-store-logo-resize-width"
          type="number"
          min={256}
          max={4096}
          value={resizeMaxWidth}
          onChange={(event) => setResizeMaxWidth(event.target.value)}
          className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          disabled={isSubmitting || !autoResize}
        />
      </div>

      <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        {t(uiLocale, "systemAdmin.storeLogoPolicy.hint.recommended")}
      </p>

      <Button className="h-10 w-full" onClick={save} disabled={isSubmitting}>
        {isSubmitting
          ? t(uiLocale, "systemAdmin.storeLogoPolicy.action.saving")
          : t(uiLocale, "systemAdmin.storeLogoPolicy.action.save")}
      </Button>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </article>
  );
}
