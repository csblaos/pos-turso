"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SystemAdminSaveButtonLabel,
  useSystemAdminSaveUi,
} from "@/components/system-admin/system-admin-save-feedback";
import { authFetch } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SystemSessionPolicyConfigProps = {
  initialConfig: {
    defaultSessionLimit: number;
  };
  variant?: "card" | "embedded";
};

export function SystemSessionPolicyConfig({
  initialConfig,
  variant = "card",
}: SystemSessionPolicyConfigProps) {
  const uiLocale = useUiLocale();
  const [baseline, setBaseline] = useState(initialConfig);
  const [defaultSessionLimit, setDefaultSessionLimit] = useState(
    String(initialConfig.defaultSessionLimit),
  );
  const saveUi = useSystemAdminSaveUi();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = saveUi.state === "saving";
  const normalizedSessionLimit = Number(defaultSessionLimit);
  const isDirty =
    !Number.isInteger(normalizedSessionLimit) ||
    normalizedSessionLimit !== baseline.defaultSessionLimit;

  const save = async () => {
    const parsed = Number(defaultSessionLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      setErrorMessage(t(uiLocale, "systemAdmin.sessionPolicy.error.invalidLimit"));
      setSuccessMessage(null);
      saveUi.flashError();
      return;
    }

    saveUi.startSaving();
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
      saveUi.flashError();
      return;
    }

    if (data?.config?.defaultSessionLimit) {
      const next = { defaultSessionLimit: data.config.defaultSessionLimit };
      setDefaultSessionLimit(String(next.defaultSessionLimit));
      setBaseline(next);
    }

    setSuccessMessage(t(uiLocale, "systemAdmin.sessionPolicy.message.saved"));
    saveUi.flashSuccess();
  };

  const content = (
    <>
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600" htmlFor="global-session-limit">
          {t(uiLocale, "systemAdmin.sessionPolicy.field.defaultSessionLimit")}
        </label>
        <input
          id="global-session-limit"
          type="number"
          min={1}
          max={10}
          value={defaultSessionLimit}
          onChange={(event) => setDefaultSessionLimit(event.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex justify-end">
        <Button
          className="h-10 w-full rounded-full text-xs font-semibold sm:w-auto"
          onClick={save}
          disabled={isSubmitting || !isDirty}
        >
          <SystemAdminSaveButtonLabel
            uiLocale={uiLocale}
            state={saveUi.state}
            idleLabel={t(uiLocale, "systemAdmin.common.action.save")}
          />
        </Button>
      </div>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </>
  );

  if (variant === "embedded") {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Clock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "systemAdmin.sessionPolicy.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t(uiLocale, "systemAdmin.sessionPolicy.description")}
          </p>
        </div>
      </div>

      {content}
    </article>
  );
}
