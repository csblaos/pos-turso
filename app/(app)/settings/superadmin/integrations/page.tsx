import { asc, desc, inArray } from "drizzle-orm";
import { ShieldCheck, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { SuperadminIntegrationsHelpButton } from "@/components/app/superadmin-integrations-help-button";
import { getSession } from "@/lib/auth/session";
import { listActiveMemberships } from "@/lib/auth/session-db";
import { db } from "@/lib/db/client";
import { fbConnections, stores, waConnections } from "@/lib/db/schema";
import { type UiLocale, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";

type ConnectionStatus = "DISCONNECTED" | "CONNECTED" | "ERROR";

const statusClassName: Record<ConnectionStatus, string> = {
  DISCONNECTED: "border-slate-200 bg-slate-50 text-slate-600",
  CONNECTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ERROR: "border-red-200 bg-red-50 text-red-700",
};

const statusLabelKey: Record<ConnectionStatus, MessageKey> = {
  DISCONNECTED: "settings.channelStatus.DISCONNECTED",
  CONNECTED: "settings.channelStatus.CONNECTED",
  ERROR: "settings.channelStatus.ERROR",
};

const storeTypeLabelKey = {
  ONLINE_RETAIL: "onboarding.storeType.online.title",
  RESTAURANT: "onboarding.storeType.restaurant.title",
  CAFE: "onboarding.storeType.cafe.title",
  OTHER: "onboarding.storeType.other.title",
} as const;

const formatDateTime = (locale: UiLocale, value: string | null) => {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(uiLocaleToDateLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

function StatusPill({
  status,
  uiLocale,
}: {
  status: ConnectionStatus;
  uiLocale: UiLocale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClassName[status]}`}
    >
      {t(uiLocale, statusLabelKey[status])}
    </span>
  );
}

export default async function SettingsSuperadminIntegrationsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const uiLocale = session.uiLocale;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const memberships = await listActiveMemberships(session.userId);
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const storeIds = memberships.map((membership) => membership.storeId);

  const [storeRows, fbRows, waRows] = await Promise.all([
    db
      .select({ id: stores.id, name: stores.name, storeType: stores.storeType })
      .from(stores)
      .where(inArray(stores.id, storeIds))
      .orderBy(asc(stores.name)),
    db
      .select({
        storeId: fbConnections.storeId,
        status: fbConnections.status,
        pageName: fbConnections.pageName,
        connectedAt: fbConnections.connectedAt,
      })
      .from(fbConnections)
      .where(inArray(fbConnections.storeId, storeIds))
      .orderBy(desc(fbConnections.connectedAt)),
    db
      .select({
        storeId: waConnections.storeId,
        status: waConnections.status,
        phoneNumber: waConnections.phoneNumber,
        connectedAt: waConnections.connectedAt,
      })
      .from(waConnections)
      .where(inArray(waConnections.storeId, storeIds))
      .orderBy(desc(waConnections.connectedAt)),
  ]);

  const fbByStore = new Map<string, (typeof fbRows)[number]>();
  for (const row of fbRows) {
    if (!fbByStore.has(row.storeId)) {
      fbByStore.set(row.storeId, row);
    }
  }

  const waByStore = new Map<string, (typeof waRows)[number]>();
  for (const row of waRows) {
    if (!waByStore.has(row.storeId)) {
      waByStore.set(row.storeId, row);
    }
  }

  const connectedFbCount = storeRows.filter(
    (store) => fbByStore.get(store.id)?.status === "CONNECTED",
  ).length;
  const connectedWaCount = storeRows.filter(
    (store) => waByStore.get(store.id)?.status === "CONNECTED",
  ).length;

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "superadmin.workspaceBadge")}
          </p>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(uiLocale, "superadmin.integrations.title")}
          </h1>
        </div>
        <div className="shrink-0">
          <SuperadminIntegrationsHelpButton uiLocale={uiLocale} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.integrations.card.fbConnected")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {connectedFbCount.toLocaleString(numberLocale)} /{" "}
            {storeRows.length.toLocaleString(numberLocale)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">
            {t(uiLocale, "superadmin.integrations.card.waConnected")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {connectedWaCount.toLocaleString(numberLocale)} /{" "}
            {storeRows.length.toLocaleString(numberLocale)}
          </p>
        </article>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "superadmin.integrations.section.storeStatus.title")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(uiLocale, "superadmin.integrations.section.storeStatus.subtitle")}
          </p>
        </div>

        {storeRows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            {t(uiLocale, "superadmin.integrations.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {storeRows.map((store) => {
              const fb = fbByStore.get(store.id);
              const wa = waByStore.get(store.id);
              const fbStatus = (fb?.status ?? "DISCONNECTED") as ConnectionStatus;
              const waStatus = (wa?.status ?? "DISCONNECTED") as ConnectionStatus;

              return (
                <li key={store.id} className="space-y-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Store className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{store.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {t(uiLocale, "superadmin.integrations.storeTypePrefix")}{" "}
                        {t(uiLocale, storeTypeLabelKey[store.storeType])}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">Facebook</p>
                        <StatusPill status={fbStatus} uiLocale={uiLocale} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {t(uiLocale, "superadmin.integrations.label.pagePrefix")}{" "}
                        {fb?.pageName?.trim() || "-"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {t(uiLocale, "superadmin.integrations.label.lastConnectedPrefix")}{" "}
                        {formatDateTime(uiLocale, fb?.connectedAt ?? null)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">WhatsApp</p>
                        <StatusPill status={waStatus} uiLocale={uiLocale} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {t(uiLocale, "superadmin.integrations.label.phonePrefix")}{" "}
                        {wa?.phoneNumber?.trim() || "-"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {t(uiLocale, "superadmin.integrations.label.lastConnectedPrefix")}{" "}
                        {formatDateTime(uiLocale, wa?.connectedAt ?? null)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </article>

    </section>
  );
}
