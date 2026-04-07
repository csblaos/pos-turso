import Link from "next/link";

type AccountStatus = "INVITED" | "SUSPENDED" | "NO_ACTIVE_STORE" | "CLIENT_SUSPENDED";

import { getRequestUiLocale } from "@/lib/i18n/request-locale";
import { t } from "@/lib/i18n/messages";

const normalizeStatus = (
  rawStatus: string | string[] | undefined,
): AccountStatus => {
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  if (
    status === "INVITED" ||
    status === "SUSPENDED" ||
    status === "NO_ACTIVE_STORE" ||
    status === "CLIENT_SUSPENDED"
  ) {
    return status;
  }
  return "NO_ACTIVE_STORE";
};

export default async function AccountStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const uiLocale = await getRequestUiLocale();
  const params = await searchParams;
  const status = normalizeStatus(params.status);
  const badgeClassName =
    status === "INVITED"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : status === "SUSPENDED" || status === "CLIENT_SUSPENDED"
        ? "border-rose-300 bg-rose-50 text-rose-700"
        : "border-slate-300 bg-slate-50 text-slate-700";
  const content =
    status === "INVITED"
      ? {
          title: t(uiLocale, "auth.accountStatus.invited.title"),
          description: t(uiLocale, "auth.accountStatus.invited.description"),
        }
      : status === "SUSPENDED"
        ? {
            title: t(uiLocale, "auth.accountStatus.suspended.title"),
            description: t(uiLocale, "auth.accountStatus.suspended.description"),
          }
        : status === "CLIENT_SUSPENDED"
          ? {
              title: t(uiLocale, "auth.accountStatus.clientSuspended.title"),
              description: t(uiLocale, "auth.accountStatus.clientSuspended.description"),
            }
        : {
            title: t(uiLocale, "auth.accountStatus.noActiveStore.title"),
            description: t(uiLocale, "auth.accountStatus.noActiveStore.description"),
          };

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium text-blue-600">SaaS POS</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(uiLocale, "auth.accountStatus.headerTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(uiLocale, "auth.accountStatus.headerDescription")}
        </p>
      </div>

      <div className={`rounded-xl border p-4 ${badgeClassName}`}>
        <p className="text-sm font-semibold">{content.title}</p>
        <p className="mt-2 text-sm">{content.description}</p>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        {t(uiLocale, "auth.accountStatus.help")}
      </div>

      <div className="flex justify-center">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-slate-50"
        >
          {t(uiLocale, "common.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
