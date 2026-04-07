"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { t } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";

export type SystemAdminSaveUiState = "idle" | "saving" | "success" | "error";

export function AnimatedCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={["h-4 w-4", className ?? "", "sa-draw-check"].join(" ").trim()}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 12.5l4.2 4.2L19.5 6.8" />
    </svg>
  );
}

export function AnimatedXIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={["h-4 w-4", className ?? "", "sa-draw-x"].join(" ").trim()}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7l10 10" />
      <path d="M17 7L7 17" />
    </svg>
  );
}

export function useSystemAdminSaveUi(options?: { resetMs?: number }) {
  const resetMs = options?.resetMs ?? 1800;
  const [state, setState] = useState<SystemAdminSaveUiState>("idle");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearPendingReset = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearPendingReset();
    timeoutRef.current = window.setTimeout(() => {
      setState("idle");
      timeoutRef.current = null;
    }, resetMs);
  }, [clearPendingReset, resetMs]);

  const reset = useCallback(() => {
    clearPendingReset();
    setState("idle");
  }, [clearPendingReset]);

  const startSaving = useCallback(() => {
    clearPendingReset();
    setState("saving");
  }, [clearPendingReset]);

  const flashSuccess = useCallback(() => {
    setState("success");
    scheduleReset();
  }, [scheduleReset]);

  const flashError = useCallback(() => {
    setState("error");
    scheduleReset();
  }, [scheduleReset]);

  return { state, reset, startSaving, flashSuccess, flashError } as const;
}

export function SystemAdminSaveButtonLabel({
  uiLocale,
  state,
  idleLabel,
  successLabel,
  errorLabel,
}: {
  uiLocale: UiLocale;
  state: SystemAdminSaveUiState;
  idleLabel: ReactNode;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t(uiLocale, "common.action.saving")}
      </span>
    );
  }

  if (state === "success") {
    return (
      <span className="inline-flex items-center gap-2 text-emerald-700">
        <AnimatedCheckIcon />
        {successLabel ?? t(uiLocale, "systemAdmin.common.action.saved")}
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-2 text-red-700">
        <AnimatedXIcon />
        {errorLabel ?? t(uiLocale, "systemAdmin.common.action.failed")}
      </span>
    );
  }

  return idleLabel;
}

