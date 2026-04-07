"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SystemAdminSaveButtonLabel,
  useSystemAdminSaveUi,
} from "@/components/system-admin/system-admin-save-feedback";
import { authFetch } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SystemBranchPolicyConfigProps = {
  initialConfig: {
    defaultCanCreateBranches: boolean;
    defaultMaxBranchesPerStore: number | null;
  };
  variant?: "card" | "embedded";
};

export function SystemBranchPolicyConfig({
  initialConfig,
  variant = "card",
}: SystemBranchPolicyConfigProps) {
  const uiLocale = useUiLocale();
  const [baseline, setBaseline] = useState(initialConfig);
  const [defaultCanCreateBranches, setDefaultCanCreateBranches] = useState(
    initialConfig.defaultCanCreateBranches,
  );
  const [defaultMaxBranchesPerStore, setDefaultMaxBranchesPerStore] = useState(
    initialConfig.defaultMaxBranchesPerStore !== null
      ? String(initialConfig.defaultMaxBranchesPerStore)
      : "",
  );
  const saveUi = useSystemAdminSaveUi();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = saveUi.state === "saving";
  const parseOptionalLimit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 500) {
      return Number.NaN;
    }

    return parsed;
  };

  const normalizedLimit = parseOptionalLimit(defaultMaxBranchesPerStore);
  const isDirty =
    defaultCanCreateBranches !== baseline.defaultCanCreateBranches ||
    (Number.isNaN(normalizedLimit)
      ? true
      : normalizedLimit !== baseline.defaultMaxBranchesPerStore);

  const save = async () => {
    const parsedLimit = parseOptionalLimit(defaultMaxBranchesPerStore);
    if (Number.isNaN(parsedLimit)) {
      setErrorMessage(t(uiLocale, "systemAdmin.branchPolicy.error.invalidLimit"));
      setSuccessMessage(null);
      saveUi.flashError();
      return;
    }

    saveUi.startSaving();
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/system-admin/config/branch-policy", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        defaultCanCreateBranches,
        defaultMaxBranchesPerStore: parsedLimit,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          config?: {
            defaultCanCreateBranches: boolean;
            defaultMaxBranchesPerStore: number | null;
          };
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "systemAdmin.branchPolicy.error.saveFailed"));
      saveUi.flashError();
      return;
    }

    if (data?.config) {
      setDefaultCanCreateBranches(data.config.defaultCanCreateBranches);
      setDefaultMaxBranchesPerStore(
        data.config.defaultMaxBranchesPerStore !== null
          ? String(data.config.defaultMaxBranchesPerStore)
          : "",
      );
      setBaseline(data.config);
    }

    setSuccessMessage(t(uiLocale, "systemAdmin.branchPolicy.message.saved"));
    saveUi.flashSuccess();
  };

  const content = (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={defaultCanCreateBranches}
        onClick={() => setDefaultCanCreateBranches((prev) => !prev)}
        disabled={isSubmitting}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm outline-none ring-primary transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="font-medium text-slate-800">
          {t(uiLocale, "systemAdmin.branchPolicy.field.defaultCanCreateBranches")}
        </span>
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
            defaultCanCreateBranches
              ? "border-emerald-600 bg-emerald-600"
              : "border-slate-200 bg-slate-200"
          }`}
          aria-hidden="true"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              defaultCanCreateBranches ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </span>
      </button>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600" htmlFor="global-max-branches">
          {t(uiLocale, "systemAdmin.branchPolicy.field.defaultMaxBranchesPerStore")}
        </label>
        <input
          id="global-max-branches"
          type="number"
          min={0}
          max={500}
          value={defaultMaxBranchesPerStore}
          onChange={(event) => setDefaultMaxBranchesPerStore(event.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
          disabled={isSubmitting || !defaultCanCreateBranches}
          placeholder={t(
            uiLocale,
            "systemAdmin.branchPolicy.field.defaultMaxBranchesPerStorePlaceholder",
          )}
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
          <GitBranch className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "systemAdmin.branchPolicy.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t(uiLocale, "systemAdmin.branchPolicy.description")}
          </p>
        </div>
      </div>

      {content}
    </article>
  );
}
