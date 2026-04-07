"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SystemAdminSaveButtonLabel,
  useSystemAdminSaveUi,
} from "@/components/system-admin/system-admin-save-feedback";
import { authFetch } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SystemStoreLogoPolicyConfigProps = {
  initialConfig: {
    maxSizeMb: number;
    autoResize: boolean;
    resizeMaxWidth: number;
  };
  variant?: "card" | "embedded";
};

export function SystemStoreLogoPolicyConfig({
  initialConfig,
  variant = "card",
}: SystemStoreLogoPolicyConfigProps) {
  const uiLocale = useUiLocale();
  const [baseline, setBaseline] = useState(initialConfig);
  const [maxSizeMb, setMaxSizeMb] = useState(String(initialConfig.maxSizeMb));
  const [autoResize, setAutoResize] = useState(initialConfig.autoResize);
  const [resizeMaxWidth, setResizeMaxWidth] = useState(String(initialConfig.resizeMaxWidth));
  const saveUi = useSystemAdminSaveUi();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = saveUi.state === "saving";
  const normalizedMaxSize = Number(maxSizeMb);
  const normalizedResizeWidth = Number(resizeMaxWidth);
  const isDirty =
    !Number.isInteger(normalizedMaxSize) ||
    !Number.isInteger(normalizedResizeWidth) ||
    normalizedMaxSize !== baseline.maxSizeMb ||
    autoResize !== baseline.autoResize ||
    normalizedResizeWidth !== baseline.resizeMaxWidth;

  const save = async () => {
    const parsedMaxSizeMb = Number(maxSizeMb);
    const parsedResizeMaxWidth = Number(resizeMaxWidth);

    if (!Number.isInteger(parsedMaxSizeMb) || parsedMaxSizeMb < 1 || parsedMaxSizeMb > 20) {
      setErrorMessage(t(uiLocale, "systemAdmin.storeLogoPolicy.error.invalidMaxSize"));
      setSuccessMessage(null);
      saveUi.flashError();
      return;
    }

    if (
      !Number.isInteger(parsedResizeMaxWidth) ||
      parsedResizeMaxWidth < 256 ||
      parsedResizeMaxWidth > 4096
    ) {
      setErrorMessage(t(uiLocale, "systemAdmin.storeLogoPolicy.error.invalidResizeMaxWidth"));
      setSuccessMessage(null);
      saveUi.flashError();
      return;
    }

    saveUi.startSaving();
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
      saveUi.flashError();
      return;
    }

    if (data?.config) {
      setMaxSizeMb(String(data.config.maxSizeMb));
      setAutoResize(data.config.autoResize);
      setResizeMaxWidth(String(data.config.resizeMaxWidth));
      setBaseline(data.config);
    }

    setSuccessMessage(t(uiLocale, "systemAdmin.storeLogoPolicy.message.saved"));
    saveUi.flashSuccess();
  };

  const content = (
    <>
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600" htmlFor="global-store-logo-max-size">
          {t(uiLocale, "systemAdmin.storeLogoPolicy.field.maxSizeMb")}
        </label>
        <input
          id="global-store-logo-max-size"
          type="number"
          min={1}
          max={20}
          value={maxSizeMb}
          onChange={(event) => setMaxSizeMb(event.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          disabled={isSubmitting}
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={autoResize}
        onClick={() => setAutoResize((prev) => !prev)}
        disabled={isSubmitting}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm outline-none ring-primary transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="font-medium text-slate-800">
          {t(uiLocale, "systemAdmin.storeLogoPolicy.field.autoResize")}
        </span>
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
            autoResize ? "border-emerald-600 bg-emerald-600" : "border-slate-200 bg-slate-200"
          }`}
          aria-hidden="true"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              autoResize ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </span>
      </button>

      <div className="space-y-2">
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor="global-store-logo-resize-width"
        >
          {t(uiLocale, "systemAdmin.storeLogoPolicy.field.resizeMaxWidth")}
        </label>
        <input
          id="global-store-logo-resize-width"
          type="number"
          min={256}
          max={4096}
          value={resizeMaxWidth}
          onChange={(event) => setResizeMaxWidth(event.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          disabled={isSubmitting || !autoResize}
        />
      </div>

      <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        {t(uiLocale, "systemAdmin.storeLogoPolicy.hint.recommended")}
      </p>

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
          <ImageIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "systemAdmin.storeLogoPolicy.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t(uiLocale, "systemAdmin.storeLogoPolicy.description")}
          </p>
        </div>
      </div>

      {content}
    </article>
  );
}
