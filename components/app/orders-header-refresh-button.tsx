"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

export function OrdersHeaderRefreshButton() {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const [isPending, startTransition] = useTransition();

  const label = t(uiLocale, "common.action.refresh");

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-9 p-0 sm:w-auto sm:gap-1.5 sm:px-3"
      disabled={isPending}
      aria-label={label}
      title={label}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

