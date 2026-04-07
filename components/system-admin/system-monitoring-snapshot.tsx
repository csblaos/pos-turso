"use client";

import { useState } from "react";
import {
  Activity,
  Database,
  HardDrive,
  Info,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { OverflowTitle } from "@/components/ui/overflow-title";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SnapshotTone = "ok" | "warn" | "bad" | "neutral";

type MonitoringSnapshotCard = {
  titleKey: MessageKey;
  helpKey: MessageKey;
  tone: SnapshotTone;
  rows: ReadonlyArray<{ labelKey: MessageKey; value: string; tone?: SnapshotTone }>;
};

type SystemMonitoringSnapshotProps = {
  databaseCard: MonitoringSnapshotCard;
  cacheCard: MonitoringSnapshotCard;
  messagingCard: MonitoringSnapshotCard;
  storageCard?: MonitoringSnapshotCard;
};

const toneToPillClass = (tone: SnapshotTone) => {
  if (tone === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "bad") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const toneToIcon = (tone: SnapshotTone) => {
  if (tone === "ok") return ShieldCheck;
  if (tone === "warn") return ShieldAlert;
  if (tone === "bad") return ShieldAlert;
  return Waypoints;
};

const toneLabelKey: Record<SnapshotTone, MessageKey> = {
  ok: "systemAdmin.securityPage.tone.ok",
  warn: "systemAdmin.securityPage.tone.warn",
  bad: "systemAdmin.securityPage.tone.bad",
  neutral: "systemAdmin.securityPage.tone.neutral",
};

function SnapshotCard({
  card,
  icon,
  onOpenHelp,
  disabled,
}: {
  card: MonitoringSnapshotCard;
  icon: React.ComponentType<{ className?: string }>;
  onOpenHelp: () => void;
  disabled: boolean;
}) {
  const uiLocale = useUiLocale();
  const Icon = icon;
  const ToneIcon = toneToIcon(card.tone);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{t(uiLocale, card.titleKey)}</h2>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  toneToPillClass(card.tone),
                ].join(" ")}
              >
                <ToneIcon className="h-3.5 w-3.5" />
                {t(uiLocale, toneLabelKey[card.tone])}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHelp}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-60"
          aria-label={t(uiLocale, card.helpKey)}
          title={t(uiLocale, card.helpKey)}
          disabled={disabled}
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {card.rows.map((row) => (
          <div
            key={row.labelKey}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs font-medium text-slate-700">{t(uiLocale, row.labelKey)}</p>
            <OverflowTitle
              value={row.value}
              className={[
                "max-w-[56%] truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                toneToPillClass(row.tone ?? "neutral"),
              ].join(" ")}
            />
          </div>
        ))}
      </div>
    </article>
  );
}

export function SystemMonitoringSnapshot({
  databaseCard,
  cacheCard,
  messagingCard,
  storageCard,
}: SystemMonitoringSnapshotProps) {
  const uiLocale = useUiLocale();
  const [helpTarget, setHelpTarget] = useState<"database" | "cache" | "messaging" | "storage" | null>(null);

  const activeHelp =
    helpTarget === "database"
      ? databaseCard
      : helpTarget === "cache"
        ? cacheCard
        : helpTarget === "messaging"
          ? messagingCard
          : helpTarget === "storage"
            ? storageCard ?? null
          : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          card={databaseCard}
          icon={Database}
          onOpenHelp={() => setHelpTarget("database")}
          disabled={false}
        />
        <SnapshotCard
          card={cacheCard}
          icon={Activity}
          onOpenHelp={() => setHelpTarget("cache")}
          disabled={false}
        />
        <SnapshotCard
          card={messagingCard}
          icon={MessageSquare}
          onOpenHelp={() => setHelpTarget("messaging")}
          disabled={false}
        />
        {storageCard ? (
          <SnapshotCard
            card={storageCard}
            icon={HardDrive}
            onOpenHelp={() => setHelpTarget("storage")}
            disabled={false}
          />
        ) : null}
      </div>

      <SlideUpSheet
        isOpen={helpTarget !== null}
        onClose={() => setHelpTarget(null)}
        title={
          activeHelp
            ? t(uiLocale, activeHelp.titleKey)
            : t(uiLocale, "systemAdmin.monitoringPage.title")
        }
        description={activeHelp ? t(uiLocale, activeHelp.helpKey) : undefined}
      >
        <div className="space-y-2 text-sm text-slate-700" />
      </SlideUpSheet>
    </>
  );
}
