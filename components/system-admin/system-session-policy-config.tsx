"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SystemSessionPolicyConfigProps = {
  initialConfig: {
    defaultSessionLimit: number;
  };
};

export function SystemSessionPolicyConfig({ initialConfig }: SystemSessionPolicyConfigProps) {
  const uiLocale = useUiLocale();
  const [defaultSessionLimit, setDefaultSessionLimit] = useState(
    String(initialConfig.defaultSessionLimit),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const save = async () => {
    const parsed = Number(defaultSessionLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      setErrorMessage(t(uiLocale, "systemAdmin.sessionPolicy.error.invalidLimit"));
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/system-admin/config/session-policy", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        defaultSessionLimit: parsed,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          config?: {
            defaultSessionLimit: number;
          };
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "systemAdmin.sessionPolicy.error.saveFailed"));
      setIsSubmitting(false);
      return;
    }

    if (data?.config?.defaultSessionLimit) {
      setDefaultSessionLimit(String(data.config.defaultSessionLimit));
    }

    setSuccessMessage(t(uiLocale, "systemAdmin.sessionPolicy.message.saved"));
    setIsSubmitting(false);
  };

  return (
    <article className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold">{t(uiLocale, "systemAdmin.sessionPolicy.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t(uiLocale, "systemAdmin.sessionPolicy.description")}
      </p>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="global-session-limit">
          {t(uiLocale, "systemAdmin.sessionPolicy.field.defaultSessionLimit")}
        </label>
        <input
          id="global-session-limit"
          type="number"
          min={1}
          max={10}
          value={defaultSessionLimit}
          onChange={(event) => setDefaultSessionLimit(event.target.value)}
          className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
          disabled={isSubmitting}
        />
      </div>

      <Button className="h-10 w-full" onClick={save} disabled={isSubmitting}>
        {isSubmitting
          ? t(uiLocale, "systemAdmin.sessionPolicy.action.saving")
          : t(uiLocale, "systemAdmin.sessionPolicy.action.save")}
      </Button>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </article>
  );
}
