"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

export function SystemAdminRefreshButton({ uiLocale }: { uiLocale: UiLocale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 rounded-full px-3 text-xs font-semibold"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <span className="inline-flex items-center gap-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {t(uiLocale, "common.action.refresh")}
      </span>
    </Button>
  );
}

