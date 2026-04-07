"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authFetch, clearClientAuthToken } from "@/lib/auth/client-token";
import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { clearNewOrderDraftState } from "@/lib/orders/new-order-draft";
import { clearPurchaseLocalStorage } from "@/lib/purchases/client-storage";

type AppLogoutButtonVariant = "icon" | "menuItem";

export function AppLogoutButton({
  uiLocale,
  variant = "icon",
  onBeforeOpen,
}: {
  uiLocale: UiLocale;
  variant?: AppLogoutButtonVariant;
  onBeforeOpen?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const onLogout = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearClientAuthToken();
      clearPurchaseLocalStorage();
      clearNewOrderDraftState();
    }
    router.replace("/login");
    router.refresh();
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 rounded-full p-0 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98] md:h-9 md:w-9"
          onClick={() => {
            onBeforeOpen?.();
            setOpen(true);
          }}
          aria-label={t(uiLocale, "common.logout")}
          title={t(uiLocale, "common.logout")}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t(uiLocale, "common.logout")}</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start gap-3 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
          onClick={() => {
            onBeforeOpen?.();
            setOpen(true);
          }}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1 text-left">{t(uiLocale, "common.logout")}</span>
        </Button>
      )}

      {isClient && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4"
              onClick={(event) => {
                if (event.target === event.currentTarget && !isBusy) {
                  setOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-logout-title"
                className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
              >
                <h3 id="app-logout-title" className="text-sm font-semibold text-slate-900">
                  {t(uiLocale, "settings.logout.title")}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{t(uiLocale, "settings.logout.hint")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    disabled={isBusy}
                    onClick={() => setOpen(false)}
                  >
                    {t(uiLocale, "common.action.cancel")}
                  </Button>
                  <Button type="button" className="h-9" disabled={isBusy} onClick={onLogout}>
                    <span className="inline-flex items-center gap-2">
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                      )}
                      {t(uiLocale, "common.logout")}
                    </span>
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export const AppLogoutIconButton = AppLogoutButton;
