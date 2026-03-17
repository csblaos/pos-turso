"use client";

import { useRouter } from "next/navigation";
import { Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authFetch, clearClientAuthToken } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import { clearNewOrderDraftState } from "@/lib/orders/new-order-draft";
import { clearPurchaseLocalStorage } from "@/lib/purchases/client-storage";

export function SystemAdminLogoutButton() {
  const router = useRouter();
  const uiLocale = useUiLocale();

  const onLogout = async () => {
    try {
      await authFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      clearClientAuthToken();
      clearPurchaseLocalStorage();
      clearNewOrderDraftState();
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      className="h-9 w-9 p-0"
      onClick={onLogout}
      aria-label={t(uiLocale, "common.logout")}
    >
      <Power className="h-4 w-4" />
      <span className="sr-only">{t(uiLocale, "common.logout")}</span>
    </Button>
  );
}
